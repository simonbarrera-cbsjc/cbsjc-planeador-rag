import 'server-only'
import { GoogleGenerativeAI } from '@google/generative-ai'
import type { Language, Periodo } from '@/types'
import {
  GROUNDING_RULES,
  buildGroundedContext,
  buildQueryTerms,
  isQuoteSupported,
  normalizeForMatch,
} from './grounding'
import {
  type ArcSkeleton,
  type WeekPlan,
  buildArcTableMarkdown,
  buildEvaluationPlanMarkdown,
  formatWeekCell,
  normalizeSkeleton,
  parseEffectiveWeeks,
} from './arc'
import {
  type VerificationIssue,
  type VerificationReport,
  flagUnsupportedRows,
  sectionBody,
  verifyPlanningBook,
  weekDepthProblems,
} from './verifier'

if (typeof window !== 'undefined') {
  throw new Error('lib/ai/generator.ts must only be used on the server.')
}

/**
 * Sanitizes user input string against prompt injection, control chars, and XSS.
 */
function sanitizeInputText(input: string | undefined | null, maxLength: number): string {
  if (!input) return ''
  return input
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
    .replace(/<\/?(?:system|instruction|docente_instrucciones|contexto_curricular|prompt|admin|user|script|iframe)[^>]*>/gi, '')
    .trim()
    .slice(0, maxLength)
}

function getGenAIClient(): GoogleGenerativeAI {
  const apiKey = process.env.GOOGLE_AI_API_KEY || process.env.GEMINI_API_KEY
  if (!apiKey) {
    throw new Error(
      'Falta la clave de API de Google Gemini (GOOGLE_AI_API_KEY). Por favor configúrala en tus variables de entorno.'
    )
  }
  return new GoogleGenerativeAI(apiKey)
}

export interface GeneratePlanningParams {
  docente: string
  area: string
  grado: string
  periodo: Periodo | string
  semanas?: string
  semanasEfectivas?: string
  tema: string
  additionalInstructions?: string
  language?: Language
  contextDocs: Array<{
    tipo: 'plan_de_area' | 'siap' | 'cuadernillo' | 'adicional'
    filename: string
    content: string
  }>
}

export interface GeneratedPlanningOutput {
  planningBookMarkdown: string
  verification: VerificationReport
  rubricsMarkdown: string
  cibercolegiosSnippet: string
  excelSpec: {
    docente: string
    area: string
    grado: string
    periodo: string
    semanas: string
    tema: string
    evidenciaPrincipal: string
    actividades: Array<{
      nombre: string
      pilar: 'SABER' | 'SABER HACER' | 'SABER SER' | 'SABER CONVIVIR'
      porcentaje: number
    }>
  }
}

/**
 * Ordered fallback candidate models with high token output capacity.
 * Prioritizes high-throughput models with proven uptime and low 503 concurrency contention.
 * Excludes models with low RPD free tier caps (e.g. gemini-3.6-flash has a 20 RPD cap).
 */
export const CANDIDATE_MODELS = [
  'gemini-3.5-flash-lite',
  'gemini-3.1-flash-lite',
  'gemini-3.1-flash-lite-preview',
  'gemini-flash-lite-latest',
] as const

const MAX_RETRIES_PER_MODEL = 2
const BASE_RETRY_DELAY_MS = 800

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function isTransientError(errorMessage: string): boolean {
  // If the model reached daily quota or rate limit, do NOT retry this model; jump immediately to the next candidate model
  if (
    errorMessage.includes('per day limit exceeded') ||
    errorMessage.includes('RequestsPerDay') ||
    errorMessage.includes('Please retry in') ||
    errorMessage.includes('429') ||
    errorMessage.includes('RESOURCE_EXHAUSTED') ||
    errorMessage.includes('quota') ||
    errorMessage.includes('rate limit') ||
    errorMessage.includes('exceeded your current quota')
  ) {
    return false
  }

  return (
    errorMessage.includes('503') ||
    errorMessage.includes('UNAVAILABLE') ||
    errorMessage.includes('high demand') ||
    errorMessage.includes('overloaded') ||
    errorMessage.includes('500') ||
    errorMessage.includes('INTERNAL') ||
    errorMessage.includes('504') ||
    errorMessage.includes('DEADLINE_EXCEEDED') ||
    errorMessage.includes('fetch failed') ||
    errorMessage.includes('ECONNRESET') ||
    errorMessage.includes('ETIMEDOUT') ||
    errorMessage.includes('socket hang up')
  )
}

function isNotFoundError(errorMessage: string): boolean {
  return (
    errorMessage.includes('404') ||
    errorMessage.includes('NOT_FOUND') ||
    errorMessage.includes('is not found') ||
    errorMessage.includes('not supported') ||
    errorMessage.includes('no longer available') ||
    errorMessage.includes('deprecated')
  )
}

function isAuthError(errorMessage: string): boolean {
  return (
    errorMessage.includes('API_KEY_INVALID') ||
    errorMessage.includes('API key not valid') ||
    errorMessage.includes('PERMISSION_DENIED') ||
    errorMessage.includes('403')
  )
}

/**
 * Low-level model caller: fallback chain, retries, JSON mode, per-call timeout, truncation detection.
 * A module-level semaphore caps concurrent Gemini calls to avoid 503 "high demand" bursts.
 */
interface ModelCallOptions {
  maxOutputTokens?: number
  temperature?: number
  preferredModel?: string
  json?: boolean
  deadline?: number
}

interface ModelCallResult {
  text: string
  model: string
  truncated: boolean
}

const MAX_CONCURRENT_CALLS = 8
const PER_CALL_TIMEOUT_MS = 60_000
let activeCalls = 0
const slotWaiters: Array<() => void> = []

async function withSlot<T>(fn: () => Promise<T>): Promise<T> {
  if (activeCalls >= MAX_CONCURRENT_CALLS) {
    await new Promise<void>((resolve) => slotWaiters.push(resolve))
  }
  activeCalls++
  try {
    return await fn()
  } finally {
    activeCalls--
    const next = slotWaiters.shift()
    if (next) next()
  }
}

function isTimeoutError(errorMessage: string): boolean {
  return /aborted|AbortError|timeout|timed out/i.test(errorMessage)
}

async function callModelDetailed(prompt: string, opts: ModelCallOptions = {}): Promise<ModelCallResult> {
  const { maxOutputTokens = 16384, temperature = 0.25, preferredModel, json = false, deadline } = opts
  const genAI = getGenAIClient()
  let lastError: Error | null = null

  // Put preferredModel first if specified to balance load across different model queues
  const models = preferredModel
    ? [preferredModel, ...CANDIDATE_MODELS.filter((m) => m !== preferredModel)]
    : [...CANDIDATE_MODELS]

  return withSlot(async () => {
    for (const modelName of models) {
      for (let attempt = 1; attempt <= MAX_RETRIES_PER_MODEL + 1; attempt++) {
        const remaining = deadline ? deadline - Date.now() : Infinity
        if (remaining < 8_000) {
          throw new Error('Se agotó el tiempo máximo de generación. Por favor intenta de nuevo en unos minutos.')
        }
        try {
          const model = genAI.getGenerativeModel(
            {
              model: modelName,
              generationConfig: {
                temperature,
                topP: 0.95,
                maxOutputTokens,
                ...(json ? { responseMimeType: 'application/json' } : {}),
              },
            },
            { timeout: Math.min(PER_CALL_TIMEOUT_MS, remaining - 2_000) }
          )

          const result = await model.generateContent(prompt)
          const response = await result.response
          const text = response.text()
          const finishReason = String(response.candidates?.[0]?.finishReason || '')

          if (text && text.trim().length > 0) {
            return { text: text.trim(), model: modelName, truncated: finishReason === 'MAX_TOKENS' }
          }
          throw new Error('Respuesta de generación vacía')
        } catch (err: unknown) {
          const rawMessage = err instanceof Error ? err.message : String(err)
          lastError = err instanceof Error ? err : new Error(rawMessage)

          console.warn(`[generator] Model ${modelName} attempt ${attempt} failed: ${rawMessage.slice(0, 200)}`)

          if (isAuthError(rawMessage)) {
            throw new Error(`Error de autenticación con Google Gemini: ${rawMessage}`)
          }

          if (isNotFoundError(rawMessage) || isTimeoutError(rawMessage)) {
            break // switch to next model immediately
          }

          if (isTransientError(rawMessage) && attempt <= MAX_RETRIES_PER_MODEL) {
            const backoffDelay = BASE_RETRY_DELAY_MS * attempt + Math.floor(Math.random() * 500)
            await delay(backoffDelay)
            continue
          }

          break
        }
      }
    }

    throw new Error(`Error generando contenido curricular con Gemini. Último error: ${lastError?.message || 'Sin respuesta'}`)
  })
}

/**
 * Disciplinary Area Profiles:
 * Dynamically provides tailored pedagogical evaluations, ICFES components, driving questions,
 * and institutional projects across all curricular areas taught at CBSJC (Ciencias Naturales,
 * Matemáticas, Español / Humanidades, Tecnología e Informática, Educación Física, Ciencias Sociales,
 * Inglés, and Educación Artística).
 */
export interface AreaProfile {
  areaGroup: string
  icfesDefault: string
  drivingQuestionEn: string
  projectDefault: string
  eval1Title: string
  eval1Evidence: string
  eval1Q2Type: string
  eval1Q6Type: string
  eval1Q7Type: string
  eval1Q8Type: string
  eval1Q9Type: string
  eval2Instrument: string
  eval2Evidences: string
  eval2Context: string
  eval2Safety: string
  station1Name: string
  station1Materials: string
  station1Procedure: string
  station1Record: string
  station2Name: string
  station2Materials: string
  station2Procedure: string
  station2Record: string
  station3Name: string
  station3Materials: string
  station3Procedure: string
  station3PromptA2: string
  station4Name: string
  station4Materials: string
  station4Procedure: string
  station4Record: string
  rubricC1Name: string
  rubricC2Name: string
  rubricC3Name: string
  rubricC4Name: string
  eval3Title: string
  eval3Dynamics: string
  eval3Step1Guidance: string
  eval3Step2Guidance: string
  eval3Step3Guidance: string
  eval3Step4Guidance: string
  eval3QuestionsGuide: string
  eval3RubricProduct: string
  eval3RubricArgument: string
}

export function getAreaProfile(rawArea: string): AreaProfile {
  const norm = (rawArea || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')

  // 1. Matemáticas y Geometría
  if (/matemat|geom|algeb|trig|calcul|estadist|aritmet/i.test(norm)) {
    return {
      areaGroup: 'Matemáticas',
      icfesDefault: 'Componente Numérico-Variacional / Geométrico-Métrico / Aleatorio (Razonamiento, Modelación y Formulación-Ejecución)',
      drivingQuestionEn: 'How can mathematical models and geometric representations help us predict patterns and optimize real-world solutions?',
      projectDefault: 'Proyecto Institucional de Educación Económica y Financiera / Pensamiento Lógico Matemático y Resolución de Problemas en el Entorno CBSJC',
      eval1Title: 'Prueba de Desempeño Escrito, Modelación y Razonamiento Matemático',
      eval1Evidence: 'Evidencia 1 Central (DBA Matemáticas), Evidencia 2 Modelación y solución de problemas, Meta ACE Bilingüe A2 (Math Vocabulary), y Aporte al Proyecto Financiero/Lógico.',
      eval1Q2Type: 'Análisis de datos, gráficas de funciones o relaciones numérico-geométricas',
      eval1Q6Type: 'Construcción Geométrica, Gráfica de Funciones o Diagramación de Patrones con Rotulación en Inglés A2',
      eval1Q7Type: 'Demostración Algorítmica y Justificación de Procedimientos Matemáticos',
      eval1Q8Type: 'Modelación de Situación Problema y Formulación de Ecuación/Estrategia de Solución',
      eval1Q9Type: 'Comprensión de Problema Verbal en Inglés A2 (Word Problem Solving with Data Interpretation)',
      eval2Instrument: 'Laboratorio Práctico de Matemáticas Aplicadas, Modelación y Geometría Dinámica',
      eval2Evidences: 'Manipulación de instrumentos de medición geométrica, construcción de modelos a escala, resolución de desafíos analíticos a ciegas y rigor algorítmico.',
      eval2Context: '60 minutos en total (4 Estaciones Rotativas de 15 minutos cada una, trabajo en parejas con roles rotativos).',
      eval2Safety: 'Manejo cuidadoso de instrumentos de trazo (compás, transportador, reglas metálicas), orden en el uso de calculadoras/tabletas y entrega del puesto despejado y limpio.',
      station1Name: 'Montaje de Medición y Construcción Geométrica/Espacial',
      station1Materials: 'Juego de geometría técnico, papel milimetrado, cintas métricas, calculadora o software de geometría dinámica (GeoGebra).',
      station1Procedure: 'Trazo preciso de figuras, cálculo analítico de magnitudes o modelación espacial con registro sistemático de variables.',
      station1Record: 'Ficha técnica con construcciones geométricas acotadas a escala, fórmulas utilizadas y rotulación matemática en inglés A2.',
      station2Name: 'Desafío de Resolución de Problemas a Ciegas (Mystery Math Challenge)',
      station2Materials: '3 tarjetas de situaciones problema no vistas previamente (Problema Alfa, Problema Beta y Problema Gamma) con datos incompletos o patrones encubiertos.',
      station2Procedure: 'Deducción analítica de patrones, identificación de la operación/modelo óptimo y comprobación rigurosa del resultado.',
      station2Record: 'Tabla comparativa con planteamiento de hipótesis matemática, procedimiento de despeje y justificación lógica en 3 pasos.',
      station3Name: 'Modelado con Material Manipulativo y Micro-Pitch en Inglés A2',
      station3Materials: 'Material manipulativo concreto (bloques poligonales, policubos, planos cartesianos o tarjetas algebraicas) y cronómetro.',
      station3Procedure: 'Construcción tridimensional o gráfica del problema en 10 minutos y sustentación oral individual de 1 minuto ante el docente en inglés A2.',
      station3PromptA2: 'This mathematical model represents... because the relationship between variable X and variable Y is... Therefore, the solution proves that...',
      station4Name: 'Bitácora Algorítmica, Comprobación y Verificación de Soluciones',
      station4Materials: 'Ficha consolidada de registro matemático, rúbrica de comprobación paso a paso y calculadora para verificación inversa.',
      station4Procedure: 'Comprobación cruzada de algoritmos mediante cálculo inverso, verificación de coherencia de unidades y entrega formal de la bitácora.',
      station4Record: 'Checklist de verificación analítica y entrega firmada del informe técnico de laboratorio matemático.',
      rubricC1Name: 'Destreza Técnica y Precisión en el Trazo/Cálculo (HACER)',
      rubricC2Name: 'Modelación y Rotulación Matemática en Inglés A2 (HACER)',
      rubricC3Name: 'Resolución Analítica y Justificación Lógica (SABER)',
      rubricC4Name: 'Rigor Metodológico, Orden y Verificación de Procedimientos (SER)',
      eval3Title: 'Sustentación Oral y Defensa de Proyecto Matemático (A2 Mathematical Pitch)',
      eval3Dynamics: 'Simposio de Solución de Problemas: Exposición de 3 a 5 minutos ante panel con poster o modelo matemático, seguida de 2 preguntas de defensa analítica.',
      eval3Step1Guidance: 'Good morning teachers and classmates. Welcome to our presentation. Today I will present our mathematical model to solve [Problem / Topic], demonstrating how algebraic and geometric analysis provides optimized solutions.',
      eval3Step2Guidance: 'At the foundational level, we identified variables and constructed equations such as [formulas]. Through rigorous calculation, we determined key patterns and rates of change.',
      eval3Step3Guidance: 'These mathematical relationships allow us to predict outcomes under different constraints. For example, when variable [X] increases, the model shows that [Y] responds proportionally.',
      eval3Step4Guidance: 'This model directly contributes to our financial education project by optimizing resource allocation and preventing errors. Thank you for your attention.',
      eval3QuestionsGuide: 'preguntas sobre validez del modelo, límites del algoritmo, interpretación de variables y aplicaciones en la vida cotidiana',
      eval3RubricProduct: 'Rigor y Calidad del Modelo Matemático Capstone (HACER)',
      eval3RubricArgument: 'Solvencia Argumentativa y Demostración Matemática (SABER)',
    }
  }

  // 2. Humanidades y Lengua Castellana (Español)
  if (/espanol|lengu|castell|humanid|literat|comunic/i.test(norm)) {
    return {
      areaGroup: 'Lengua Castellana',
      icfesDefault: 'Lectura Crítica (Identificar contenidos locales, Comprender articulación textual, Reflexionar y evaluar contenidos y premisas)',
      drivingQuestionEn: 'How do literary and argumentative texts construct perspectives that influence individual identity and social transformation?',
      projectDefault: 'Proyecto Transversal de Comunicación Asertiva, Prensa Escolar, Oralidad y Plan Lector Institucional CBSJC',
      eval1Title: 'Prueba de Lectura Crítica, Análisis Textual y Producción Escrita',
      eval1Evidence: 'Evidencia 1 Central (DBA Lenguaje), Evidencia 2 Coherencia y Cohesión Textual, Meta ACE Bilingüe A2 (Text Analysis Terms), y Aporte al Plan Lector.',
      eval1Q2Type: 'Análisis de intención comunicativa, tipología textual y recursos retóricos en fragmentos seleccionados',
      eval1Q6Type: 'Mapa de Jerarquías Textuales, Red Semántica o Esquema Argumentativo con Rotulación de Conectores en Inglés A2',
      eval1Q7Type: 'Análisis Comparativo Intertextual y Explicación de Premisas en Textos Continuos y Discontinuos',
      eval1Q8Type: 'Postura Crítica Frente al Texto y Formulación de Tesis Argumentativa Justificada',
      eval1Q9Type: 'Comprensión de Lectura Crítica Bilingüe A2 (Reading Comprehension and Author Purpose Inference)',
      eval2Instrument: 'Taller de Producción Textual, Corrección Estilística y Competencia Discursiva',
      eval2Evidences: 'Habilidades de análisis crítico de tipología textual, diagnóstico de falacias y vicios de redacción, producción multimodal y rigor ortotipográfico.',
      eval2Context: '60 minutos en total (4 Estaciones Rotativas de 15 minutos cada una, trabajo cooperativo con rotación de roles).',
      eval2Safety: 'Uso ordenado de diccionarios, manuales de estilo y corpus impreso; respeto absoluto por la autoría y normas de citación ética (normas APA / Icontec).',
      station1Name: 'Taller de Deconstrucción Textual y Coherencia Semántica',
      station1Materials: 'Muestras impresas de textos continuos/discontinuos, marcadores de realce de conectores y matriz de tipología discursiva.',
      station1Procedure: 'Identificación de ideas centrales, marcadores de transición y estructura organizativa del texto.',
      station1Record: 'Ficha de deconstrucción estructural con esquema del texto y glosario de marcadores discursivos en español e inglés A2.',
      station2Name: 'Taller de Corrección Estilística a Ciegas (Mystery Text Diagnosis)',
      station2Materials: '3 textos con errores sintácticos, discordancias, ambigüedades o falacias argumentativas (Texto A, Texto B y Texto C).',
      station2Procedure: 'Detección crítica de anomalías discursivas, identificación de la falacia o falla lógica y reescritura estilística depurada.',
      station2Record: 'Matriz de diagnóstico con fragmento original, falla detectada, regla gramatical/retórica aplicable y propuesta de corrección en 3 líneas.',
      station3Name: 'Producción Creativa Multimodal y Micro-Pitch en Inglés A2',
      station3Materials: 'Plantillas de micro-ensayo / storyboard argumentativo, tarjetas de conectores de causa-efecto y cronómetro.',
      station3Procedure: 'Redacción de un micro-texto argumentativo en 10 minutos y sustentación oral individual de 1 minuto ante el docente en inglés A2.',
      station3PromptA2: 'This text addresses the central theme of... The main argument developed states that... because as evidence shows... Therefore, I conclude that...',
      station4Name: 'Mesa de Edición Ortotipográfica, Coevaluación y Cierre de Portafolio',
      station4Materials: 'Manual de normas ortográficas RAE, rúbrica de edición Praise & Polish y carpeta de portafolio de producción escrita.',
      station4Procedure: 'Revisión final de acentuación, puntuación y coherencia del texto; coevaluación entre pares con el protocolo 1 elogio + 1 recomendación.',
      station4Record: 'Checklist de edición editorial debidamente diligenciado y manuscrito final corregido entregado al docente.',
      rubricC1Name: 'Análisis Crítico y Deconstrucción Textual (SABER)',
      rubricC2Name: 'Producción Escrita, Coherencia y Riqueza Léxica (HACER)',
      rubricC3Name: 'Argumentación Oral y Expresión Bilingüe A2 (HACER)',
      rubricC4Name: 'Edición Ortotipográfica, Ética y Coevaluación Constructiva (SER / CONVIVIR)',
      eval3Title: 'Ponencia Oral y Defensa del Ensayo/Discurso Capstone (A2 Rhetorical Pitch)',
      eval3Dynamics: 'Foro Académico de Oratoria: Presentación de 3 a 5 minutos ante panel evaluador, seguida de 2 preguntas de defensa argumentativa y contraargumentación.',
      eval3Step1Guidance: 'Good morning teachers and fellow classmates. Today I will present our rhetorical analysis and argumentative essay on [Theme / Book], exploring how discourse influences social perspectives.',
      eval3Step2Guidance: 'In our literary investigation, we identified key narrative voices and structural devices, such as [literary devices], which emphasize the authors central message.',
      eval3Step3Guidance: 'By connecting text evidence with contemporary reality, our thesis argues that [thesis statement in English A2], supported by verified social and historical evidence.',
      eval3Step4Guidance: 'This project enhances our institutional reading and oral communication plan, fostering critical thinking and empathetic dialogue. Thank you for your attention.',
      eval3QuestionsGuide: 'preguntas sobre la solidez de la tesis, validez de las fuentes consultadas, posibles contraargumentos y trascendencia social del mensaje',
      eval3RubricProduct: 'Calidad y Coherencia del Discurso / Ensayo Capstone (HACER)',
      eval3RubricArgument: 'Solvencia Argumentativa, Defensa de Tesis y Retórica (SABER)',
    }
  }

  // 3. Tecnología e Informática (Sistemas)
  if (/tecnol|inform|sistem|comput|robotic|program|software/i.test(norm)) {
    return {
      areaGroup: 'Tecnología e Informática',
      icfesDefault: 'Componente Tecnológico MEN: Naturaleza y evolución de la tecnología, Apropiación y uso, Solución de problemas y Tecnología y sociedad',
      drivingQuestionEn: 'How can computational thinking and system design create ethical, scalable technological solutions for everyday challenges?',
      projectDefault: 'Proyecto Institucional de Alfabetización Digital, Ciudadanía Tecnológica Responsable y Automatización Escolar CBSJC',
      eval1Title: 'Prueba de Lógica Computacional, Algoritmos y Arquitectura de Sistemas',
      eval1Evidence: 'Evidencia 1 Central (Competencias TIC MEN), Evidencia 2 Diseño Algorítmico y Pseudocódigo, Meta ACE Bilingüe A2 (Tech Terminology), y Aporte al Proyecto Digital.',
      eval1Q2Type: 'Traza algorítmica, análisis de estructuras de control (condicionales/bucles) o evaluación de flujo de datos',
      eval1Q6Type: 'Diagrama de Flujo de Datos, Modelo Entidad-Relación o Esquema de Arquitectura con Nodos Rotulados en Inglés A2',
      eval1Q7Type: 'Diseño de Procedimiento Computacional para Optimización de Procesos o Gestión de Datos',
      eval1Q8Type: 'Planteamiento de Solución Algorítmica y Formulación de Casos de Prueba (Test Cases)',
      eval1Q9Type: 'Comprensión de Especificación Técnica en Inglés A2 (Software Requirements & System Architecture Brief)',
      eval2Instrument: 'Laboratorio Práctico de Innovación Digital, Algoritmos y Prototipado Tecnológico',
      eval2Evidences: 'Diseño lógico de soluciones, depuración técnica de código/sistemas a ciegas, maquetación de interfaces y documentación en bitácora técnica.',
      eval2Context: '60 minutos en total (4 Estaciones Rotativas de 15 minutos cada una, trabajo en estaciones informáticas en parejas).',
      eval2Safety: 'Uso responsable del hardware y periféricos de la sala de cómputo, navegación segura, respaldo regular de archivos y desconexión correcta de equipos.',
      station1Name: 'Estación de Modelado Lógico y Diagramación de Arquitectura',
      station1Materials: 'Entorno de diagramación (diagramas de flujo / UML / pseudocódigo), plantillas lógicas y especificación del problema.',
      station1Procedure: 'Estructuración del flujo de información, definición de variables, entradas, procesos algorítmicos y salidas esperadas.',
      station1Record: 'Ficha técnica con diagrama formal de procesos, tabla de variables y rotulación técnica en inglés A2.',
      station2Name: 'Depuración de Sistemas a Ciegas (Mystery Bug / Code Diagnosis)',
      station2Materials: '3 fragmentos de código o esquemas técnicos con errores lógicos o de sintaxis (Bug Alfa, Bug Beta y Bug Gamma).',
      station2Procedure: 'Prueba de escritorio (dry run), identificación de la causa raíz de la falla y corrección depurada del código/diagrama.',
      station2Record: 'Matriz de depuración con línea del error, tipo de anomalía (lógica/sintaxis/seguridad) y solución técnica documentada.',
      station3Name: 'Prototipado Rápido de Solución y Micro-Pitch Técnico en Inglés A2',
      station3Materials: 'Entorno interactivo de prototipado (software de desarrollo / simulador / wireframes) y temporizador.',
      station3Procedure: 'Construcción funcional de un componente o interfaz en 10 minutos y explicación técnica individual de 1 minuto ante el docente en inglés A2.',
      station3PromptA2: 'This digital system is designed to solve the problem of... The algorithm works by processing... and the expected output provides...',
      station4Name: 'Bitácora Técnica, Validación de Pruebas y Ciberseguridad',
      station4Materials: 'Ficha consolidada de pruebas de caja negra, checklist de buenas prácticas de programación y repositorio de código.',
      station4Procedure: 'Ejecución de batería de pruebas con valores límite, validación de excepciones, guardado en repositorio y verificación de integridad.',
      station4Record: 'Checklist de pruebas unitarias firmado y entrega formal de la documentación técnica al docente.',
      rubricC1Name: 'Diseño Lógico, Diagramación y Arquitectura del Sistema (SABER)',
      rubricC2Name: 'Implementación Técnica y Depuración de Errores (HACER)',
      rubricC3Name: 'Sustentación Técnica Oral y Vocabulario en Inglés A2 (HACER)',
      rubricC4Name: 'Buenas Prácticas, Ciberseguridad y Trabajo Colaborativo (SER / CONVIVIR)',
      eval3Title: 'Demo Day Tecnológico y Defensa de Solución Digital (A2 Tech Pitch & Live Demo)',
      eval3Dynamics: 'Demostración de Software/Hardware en Vivo: Presentación interactiva de 3 a 5 minutos ante panel evaluador, seguida de 2 preguntas de arquitectura y casos límite.',
      eval3Step1Guidance: 'Good morning teachers and evaluators. Today I will demonstrate our technical prototype: [System Name], created to solve the challenge of [problem description].',
      eval3Step2Guidance: 'The technical architecture relies on modular components, including input validation and algorithmic logic that ensures reliable data processing.',
      eval3Step3Guidance: 'During runtime testing, our prototype achieved efficiency by reducing redundant steps and securing data flow against common vulnerabilities.',
      eval3Step4Guidance: 'This development supports our school digital citizenship project by promoting ethical technology and accessible software solutions. Thank you.',
      eval3QuestionsGuide: 'preguntas sobre escalabilidad del sistema, gestión de excepciones, seguridad de la información y valor añadido para el usuario',
      eval3RubricProduct: 'Calidad, Robustez y Usabilidad del Prototipo Digital Capstone (HACER)',
      eval3RubricArgument: 'Solvencia en la Demostración Técnica y Argumentación Algorítmica (SABER)',
    }
  }

  // 4. Educación Física, Recreación y Deportes
  if (/educaci[oó]n\s*f[ií]sica|ed\.?\s*f[ií]sica|deport|recrea|motriz|atlet/i.test(norm) || (norm.includes('fisic') && (norm.includes('educ') || norm.includes('deport')))) {
    return {
      areaGroup: 'Educación Física',
      icfesDefault: 'Lineamientos MEN de Educación Física: Competencia Motriz (condición física y destrezas), Expresiva Corporal y Axiológica Corporal',
      drivingQuestionEn: 'How does understanding motor biomechanics and tactical cooperation enhance athletic performance and lifelong wellness?',
      projectDefault: 'Proyecto Transversal de Estilos de Vida Saludable, Ergonomía, Convivencia Escolar y Deporte Formativo CBSJC',
      eval1Title: 'Prueba de Biomecánica, Fisiología del Ejercicio, Reglamento y Autocuidado',
      eval1Evidence: 'Evidencia 1 Central (Orientaciones Curriculares MEN), Evidencia 2 Comprensión Biomecánica y Táctica, Meta ACE Bilingüe A2 (Sports Terminology), y Aporte a Hábitos Saludables.',
      eval1Q2Type: 'Análisis de trayectorias, ángulos articulares o principios de palancas mecánicas en gestos deportivos',
      eval1Q6Type: 'Diagrama de Pizarra Táctica, Zonas de Juego o Secuencia de Movimiento Motor Rotulada en Inglés A2',
      eval1Q7Type: 'Explicación de la Respuesta Cardiovascular y Fisiológica Durante el Esfuerzo Físico',
      eval1Q8Type: 'Planteamiento de Estrategia Táctica Colectiva ante una Situación Defensiva u Ofensiva',
      eval1Q9Type: 'Comprensión de Regla Oficial o Caso de Juego Limpio en Inglés A2 (Sports Rule & Fair Play Reading)',
      eval2Instrument: 'Circuito Polimotor de Habilidades Físico-Atléticas, Táctica y Eficiencia Biomecánica',
      eval2Evidences: 'Ejecución técnica de patrones motores fundamentales y específicos, toma de decisiones tácticas a ciegas, autocuidado y registro fisiológico.',
      eval2Context: '60 minutos en total (Circuito de 4 Estaciones Polimotoras de 15 minutos cada una, trabajo individual y en pequeños equipos).',
      eval2Safety: 'Calentamiento previo obligatorio, indumentaria deportiva adecuada, hidratación programada, control de zonas seguras y ergonomía postural.',
      station1Name: 'Estación de Destreza Técnico-Motriz y Control Coordinativo',
      station1Materials: 'Conos, balones específicos, cronómetros, vallas de agilidad y cintas métricas.',
      station1Procedure: 'Ejecución de un recorrido técnico de agilidad con precisión de gestos específicos (conducción, pase, salto o lanzamiento).',
      station1Record: 'Ficha técnica con tiempos cronometrados, número de aciertos técnicos y autoevaluación motriz en inglés A2.',
      station2Name: 'Resolución Táctica a Ciegas (Mystery Game Scenario Challenge)',
      station2Materials: 'Pizarra magnética de juego con 3 disposiciones tácticas sorpresa (Escenario A: superioridad numérica, Escenario B: repliegue, Escenario C: transición rápida).',
      station2Procedure: 'Lectura instantánea de la situación de juego, selección de la respuesta táctica más eficiente y ejecución práctica en campo reducido.',
      station2Record: 'Matriz de decisión táctica con descripción del rol defensivo/ofensivo adoptado y justificación de la decisión en 3 líneas.',
      station3Name: 'Expresión Corporal / Coreografía Funcional y Micro-Pitch en Inglés A2',
      station3Materials: 'Espacio delimitado, implementos rítmicos o funcionales y temporizador.',
      station3Procedure: 'Ejecución de una secuencia motriz coordinada en 10 minutos y micro-explicación oral individual de 1 minuto ante el docente en inglés A2.',
      station3PromptA2: 'In this physical exercise, the primary muscle groups activated are... Proper biomechanical posture prevents injury by... and improves athletic performance.',
      station4Name: 'Monitoreo Fisiológico, Hidratación, Autocuidado y Orden de Material',
      station4Materials: 'Ficha de pulsometría (frecuencia cardíaca en reposo, esfuerzo y recuperación), pulsómetros o palpación radial, toallas y termos de hidratación.',
      station4Procedure: 'Toma sistemática de pulso, cálculo de zonas de intensidad aeróbica, protocolo de hidratación consciente y recogida responsable de implementos.',
      station4Record: 'Gráfica individual de frecuencia cardíaca completada y checklist de cuidado corporal y orden deportivo firmado.',
      rubricC1Name: 'Eficiencia Biomecánica y Coordinación Motriz (HACER)',
      rubricC2Name: 'Toma de Decisiones y Resolución Táctica (SABER)',
      rubricC3Name: 'Sustentación Oral de Principios Biomecánicos en Inglés A2 (HACER)',
      rubricC4Name: 'Autocuidado Fisiológico, Juego Limpio y Trabajo en Equipo (SER / CONVIVIR)',
      eval3Title: 'Festival Atlético / Exhibición Deportiva Capstone y Defensa Táctica (A2 Sports Pitch)',
      eval3Dynamics: 'Demostración Práctica en Campo y Defensa: Ejecución de una rutina o partido formativo ante pares y docente, seguida de 2 preguntas de análisis táctico y fisiológico.',
      eval3Step1Guidance: 'Good morning teachers and teammates. Today I will present our tactical performance plan and biomechanical execution in [Sport / Movement Topic].',
      eval3Step2Guidance: 'Biomechanically, executing this movement requires core stability, proper footwork, and precise timing to optimize power and avoid joint strain.',
      eval3Step3Guidance: 'In team coordination, strategic communication and rapid transitions create scoring opportunities while maintaining a balanced defensive structure.',
      eval3Step4Guidance: 'This practice reinforces our healthy lifestyles project by establishing lifelong fitness habits, hydration discipline, and fair play values. Thank you.',
      eval3QuestionsGuide: 'preguntas sobre la justificación biomecánica del gesto, gestión del cansancio físico, cooperación colectiva y aplicación de hábitos de vida saludable',
      eval3RubricProduct: 'Calidad y Eficiencia de la Demostración Motriz Capstone (HACER)',
      eval3RubricArgument: 'Análisis Táctico, Conciencia Corporal y Fundamentación (SABER)',
    }
  }

  // 5. Ciencias Sociales, Historia, Geografía y Filosofía
  if (/social|histor|geogr|filosof|ciudadan|democrac|etio|constituc/i.test(norm)) {
    return {
      areaGroup: 'Ciencias Sociales',
      icfesDefault: 'Ciencias Sociales y Ciudadanas (Pensamiento Social, Interpretación y Análisis de Perspectivas, Pensamiento Reflexivo y Sistémico)',
      drivingQuestionEn: 'How do historical memories and geographic spatial interactions shape democratic participation and social justice today?',
      projectDefault: 'Proyecto Institucional de Democracia, Derechos Humanos, Cátedra de Paz, Memoria Histórica y Convivencia Ciudadana CBSJC',
      eval1Title: 'Prueba de Pensamiento Social, Análisis Histórico-Geográfico y Ciudadanía Crítica',
      eval1Evidence: 'Evidencia 1 Central (DBA Ciencias Sociales), Evidencia 2 Multiperspectivismo y Contexto Histórico, Meta ACE Bilingüe A2 (Social Studies Terms), y Aporte a la Cátedra de Paz.',
      eval1Q2Type: 'Análisis de fuentes primarias, mapas temáticos o estadísticas demográficas comparativas',
      eval1Q6Type: 'Cartografía Temática, Pirámide Social o Cronología Comparada con Rotulación en Inglés A2',
      eval1Q7Type: 'Explicación de Causalidad Multidimensional (Económica, Política y Cultural) de un Fenómeno Social',
      eval1Q8Type: 'Análisis de Perspectivas en Conflicto y Formulación de Alternativas de Solución Pacífica',
      eval1Q9Type: 'Comprensión de Documento Histórico o Noticia Internacional en Inglés A2 (Primary Source Reading & Point of View)',
      eval2Instrument: 'Laboratorio de Cartografía Social, Análisis de Fuentes Primarias y Dilemas Éticos',
      eval2Evidences: 'Interpretación de fuentes históricas contrastadas, cartografía temática espacial, argumentación en dilemas morales y deliberación democrática.',
      eval2Context: '60 minutos en total (4 Estaciones Rotativas de 15 minutos cada una, trabajo de investigación en equipos).',
      eval2Safety: 'Manejo riguroso y ético de la información, respeto absoluto por las diversas posturas y testimonios históricos, y preservación del material cartográfico.',
      station1Name: 'Estación de Cartografía Social y Lectura Espacial de Fuentes Primarias',
      station1Materials: 'Mapas históricos y temáticos, atlas geográfico, cartas georreferenciadas y convenciones cromáticas.',
      station1Procedure: 'Superposición de variables geográficas y socioeconómicas para identificar relaciones de ocupación territorial y dinámicas humanas.',
      station1Record: 'Ficha cartográfica con mapa rotulado a escala, cuadro de convenciones y leyenda explicativa en inglés A2.',
      station2Name: 'Análisis de Dilemas Históricos a Ciegas (Mystery Historical Case Challenge)',
      station2Materials: '3 expedientes documentales anónimos de crisis históricas o dilemas ciudadanos reales (Caso Alfa, Caso Beta y Caso Gamma).',
      station2Procedure: 'Identificación del conflicto de intereses entre los actores involucrados, contraste de fuentes y deducción de las consecuencias de las decisiones tomadas.',
      station2Record: 'Matriz de multiperspectivismo con identificación de actores, demandas en tensión y propuesta de resolución pacífica.',
      station3Name: 'Construcción de Red de Causalidad y Micro-Pitch en Inglés A2',
      station3Materials: 'Tarjetas de causas estructurales, coyunturales y detonantes, tablero de conexiones y cronómetro.',
      station3Procedure: 'Elaboración de una red de causas y consecuencias en 10 minutos y sustentación oral individual de 1 minuto ante el docente en inglés A2.',
      station3PromptA2: 'This historical event was mainly caused by... Different social groups reacted by... and its enduring consequence on human rights was...',
      station4Name: 'Mesa de Deliberación Democrática, Matriz de Derechos y Conclusiones',
      station4Materials: 'Constitución Política de Colombia, Declaración Universal de los Derechos Humanos y rúbrica de deliberación asertiva.',
      station4Procedure: 'Debate regulado con turnos de palabra, contraste con el marco constitucional y redacción concertada de acuerdos de convivencia.',
      station4Record: 'Acta de consensos ciudadanos debidamente firmada por los integrantes del equipo y entregada al docente.',
      rubricC1Name: 'Comprensión y Pensamiento Social Crítico (SABER)',
      rubricC2Name: 'Interpretación de Fuentes y Cartografía Temática (HACER)',
      rubricC3Name: 'Argumentación Oral y Expresión Bilingüe A2 (HACER)',
      rubricC4Name: 'Deliberación Democrática, Empatía y Convivencia Pacífica (SER / CONVIVIR)',
      eval3Title: 'Simulación de Juicio Histórico / Foro Ciudadano Capstone (A2 Historical Debate Pitch)',
      eval3Dynamics: 'Asamblea de Deliberación Pública: Presentación de 3 a 5 minutos asumiendo un rol histórico o ciudadano ante panel de pares, seguida de 2 preguntas de defensa de postura.',
      eval3Step1Guidance: 'Good morning honored assembly and teachers. Today I present our historical investigation regarding [Historical Event / Social Movement], analyzing its social and political dimensions.',
      eval3Step2Guidance: 'Our primary source analysis revealed contrasting perspectives between key actors, highlighting structural inequalities and civic demands.',
      eval3Step3Guidance: 'By connecting these historical lessons with current democratic challenges, we argue that active citizen participation is essential to safeguard human rights.',
      eval3Step4Guidance: 'This research contributes directly to our school peace and democracy project, fostering restorative dialogue and constitutional awareness. Thank you.',
      eval3QuestionsGuide: 'preguntas sobre la coherencia del argumento con el contexto de la época, ponderación de derechos fundamentales y lecciones éticas para el presente',
      eval3RubricProduct: 'Calidad de la Investigación y Rigor del Rol Histórico Capstone (HACER)',
      eval3RubricArgument: 'Solvencia Argumentativa, Multiperspectivismo y Ética Ciudadana (SABER)',
    }
  }

  // 6. Idioma Extranjero: Inglés (Bilingual Program)
  if (/ingl|english|bilingu|idiom/i.test(norm)) {
    return {
      areaGroup: 'Inglés',
      icfesDefault: 'Prueba ICFES Saber 11 Inglés / Estándares MEN de Bilingüismo (Partes 1 a 7: Avisos, Diálogos, Vocabulario, Lectura Literal e Inferencial)',
      drivingQuestionEn: 'How does developing intercultural communicative competence enable us to connect with global communities and share our local identity?',
      projectDefault: 'Proyecto Transversal de Ciudadanía Global, Bilingüismo e Interculturalidad CBSJC',
      eval1Title: 'Integrated English Assessment: Reading, Language Use, Listening & Writing',
      eval1Evidence: 'Evidencia 1 Central (Estándares Básicos de Inglés MEN), Evidencia 2 Producción Textual Estructurada, Meta ACE Bilingüe A2/B1, y Aporte a la Comunicación Global.',
      eval1Q2Type: 'Contextual Dialogue Completion and Pragmatic Meaning Inference',
      eval1Q6Type: 'Visual Storyboard, Infographic Labeling or Concept Web in English A2/B1',
      eval1Q7Type: 'Cohesive Paragraph Writing with Transitional Phrases and Academic Sentence Starters',
      eval1Q8Type: 'Critical Reading Response and Evidence-Based Personal Opinion Formulation',
      eval1Q9Type: 'Informational Text Reading Comprehension (Main Idea, Details and Author Perspective)',
      eval2Instrument: 'Interactive Language Lab & Communicative Competence Circuit',
      eval2Evidences: 'Fluidez en lectura guiada, detección de patrones lingüísticos a ciegas, interacción oral espontánea en parejas y edición de portafolio bilingüe.',
      eval2Context: '60 minutos en total (Circuito de 4 Estaciones de Habilidades Comunicativas de 15 minutos cada una, dinámica colaborativa).',
      eval2Safety: 'Respeto mutuo y escucha activa durante la producción oral de los compañeros, cuidado de los recursos de audio, y uso exclusivo del inglés (English Only Zone).',
      station1Name: 'Reading Comprehension and Text-Evidence Scanning Station',
      station1Materials: 'Authentic adapted articles, graphic organizers, highlighters and vocabulary context cards.',
      station1Procedure: 'Scanning for specific data, skimming for general meaning and extracting textual evidence to support inferences.',
      station1Record: 'Structured reading log with main claim, 3 supporting arguments, and vocabulary definition in context.',
      station2Name: 'Mystery Dialogue & Error Diagnosis Station',
      station2Materials: '3 short unscripted dialogues or transcripts with missing connectors, register mismatches or grammatical errors.',
      station2Procedure: 'Critical identification of register inconsistencies or tense shifts, and revision to achieve clear communicative intent.',
      station2Record: 'Diagnostic worksheet detailing the communicative error, the grammatical rule, and the corrected version.',
      station3Name: 'Flash Communicative Roleplay and Oral Micro-Pitch',
      station3Materials: 'Situation prompt cards, character role descriptions, and timer.',
      station3Procedure: 'Preparation of a 2-minute dialogue in pairs and individual oral defense of 1 minute in front of the teacher.',
      station3PromptA2: 'In this real-life scenario, my role requires me to negotiate... by explaining that... and proposing a solution where both parties agree.',
      station4Name: 'Collaborative Writing, Peer Review & Portfolio Closure',
      station4Materials: 'Writing rubric checklist, peer-review feedback slips (Praise & Polish), and learning portfolio folders.',
      station4Procedure: 'Proofreading partner writing draft, verifying sentence variety, spelling and punctuation, and assembling the final piece into the portfolio.',
      station4Record: 'Completed peer review form and final corrected written draft submitted to the teacher.',
      rubricC1Name: 'Reading Comprehension and Textual Analysis (SABER)',
      rubricC2Name: 'Written Production, Cohesion and Vocabulary Range (HACER)',
      rubricC3Name: 'Spoken Fluency, Pronunciation and Interaction (HACER)',
      rubricC4Name: 'Collaborative Spirit, Active Listening and Feedback (SER / CONVIVIR)',
      eval3Title: 'Capstone Bilingual Showcase & Oral Defense (A2/B1 Exhibition Pitch)',
      eval3Dynamics: 'Interactive Exhibition / Ted-Style Talk: 3 to 5 minutes oral presentation delivered entirely in English with visual slides or tangible project, followed by 2 follow-up defense questions.',
      eval3Step1Guidance: 'Good morning teachers and peers. Welcome to my presentation. Today I will present our research on [Global Topic / Culture], exploring international perspectives and language nuances.',
      eval3Step2Guidance: 'In this project, we analyzed authentic cultural narratives, comparing how linguistic expressions reflect community values and social customs.',
      eval3Step3Guidance: 'Through communicative collaboration, we crafted a multimedia message demonstrating that language serves as a bridge for intercultural empathy.',
      eval3Step4Guidance: 'This presentation connects with our global citizenship project, encouraging respectful cross-cultural communication in our school and beyond. Thank you.',
      eval3QuestionsGuide: 'questions regarding argumentation depth, vocabulary choices, personal perspective, and connections to real-world global challenges',
      eval3RubricProduct: 'Quality, Creativity and Organization of the Capstone Project (HACER)',
      eval3RubricArgument: 'Oral Fluency, Grammatical Accuracy and Spontaneous Q&A Defense (SABER / HACER)',
    }
  }

  // 7. Educación Artística y Cultural
  if (/art|plastic|music|danz|teatr|estet/i.test(norm)) {
    return {
      areaGroup: 'Educación Artística',
      icfesDefault: 'Lineamientos MEN de Educación Artística: Sensibilidad Estética, Apreciación Estética y Comunicación Creativa',
      drivingQuestionEn: 'How do visual arts and cultural expressions convey identity, emotion, and community narratives?',
      projectDefault: 'Proyecto Institucional del Festival de las Artes, Expresión Sensorial y Patrimonio Cultural CBSJC',
      eval1Title: 'Prueba de Apreciación Estética, Historia del Arte y Teoría de la Composición',
      eval1Evidence: 'Evidencia 1 Central (Lineamientos de Artística MEN), Evidencia 2 Análisis Compositivo y Lenguaje Visual/Sonoro, Meta ACE Bilingüe A2 (Art Terms), y Aporte al Festival de Artes.',
      eval1Q2Type: 'Análisis de elementos plásticos/sonoros (ritmo, armonía, color, textura, luz y sombra) en obras de referencia',
      eval1Q6Type: 'Boceto Técnico de Composición, Esquema de Perspectiva o Notación Visual con Rotulación en Inglés A2',
      eval1Q7Type: 'Interpretación del Mensaje Simbólico y Contexto Histórico-Cultural de una Obra de Arte',
      eval1Q8Type: 'Propuesta de Intervención Creativa o Proyecto Plástico con Justificación Conceptual',
      eval1Q9Type: 'Comprensión de Reseña Crítica de Arte en Inglés A2 (Art Critique & Exhibition Review Reading)',
      eval2Instrument: 'Taller de Creación Plástica, Exploración Sensorial y Composición Técnica',
      eval2Evidences: 'Destreza en la manipulación de técnicas y materiales, lectura iconográfica a ciegas, modelado creativo y cuidado del espacio de taller.',
      eval2Context: '60 minutos en total (4 Estaciones de Creación Plástica y Perceptiva de 15 minutos cada una, trabajo en taller).',
      eval2Safety: 'Uso responsable de pigmentos, pinceles, herramientas de modelado, limpieza de paletas y respeto por las obras en proceso de los compañeros.',
      station1Name: 'Estación de Exploración Técnica y Aplicación Cromática/Sensorial',
      station1Materials: 'Papeles de diferentes gramajes, pigmentos, carboncillos, espátulas o instrumentos de percusión menor.',
      station1Procedure: 'Aplicación controlada de contrastes tonales, degradados, texturas táctiles o armonías compositivas.',
      station1Record: 'Ficha técnica con muestrario de técnicas aplicadas, escala de valores y rotulación en inglés A2.',
      station2Name: 'Lectura Iconográfica a Ciegas (Mystery Artwork Diagnosis)',
      station2Materials: '3 reproducciones de obras de arte anónimas o fragmentos sonoros (Obra Alfa, Obra Beta y Obra Gamma).',
      station2Procedure: 'Identificación de la corriente estética, técnica empleada, punto focal y mensaje emotivo/conceptual transmitido.',
      station2Record: 'Ficha museográfica comparativa con identificación de técnica, paleta o ritmo y justificación en 3 líneas.',
      station3Name: 'Modelado Plástico Rápido y Micro-Pitch en Inglés A2',
      station3Materials: 'Arcilla de secado rápido, plastilina técnica, alambre o materiales reciclados y temporizador.',
      station3Procedure: 'Creación tridimensional de una escultura o maqueta conceptual en 10 minutos y micro-pitch de 1 minuto ante el docente en inglés A2.',
      station3PromptA2: 'This artistic creation is inspired by... I used contrasting textures and colors to represent... and create an emotional resonance with...',
      station4Name: 'Curaduría Museográfica, Ficha de Obra y Orden del Taller',
      station4Materials: 'Fichas museográficas institucionales, adhesivos de montaje, elementos de limpieza y rúbrica Praise & Polish.',
      station4Procedure: 'Redacción de la ficha técnica de la obra (título, autor, técnica, dimensiones y reseña), montaje en el panel del taller y limpieza del puesto.',
      station4Record: 'Ficha de catalogación formal debidamente diligenciada y puesto de trabajo entregado impecable.',
      rubricC1Name: 'Sensibilidad y Apreciación Estética (SABER)',
      rubricC2Name: 'Destreza en la Técnica y Producción Plástica (HACER)',
      rubricC3Name: 'Sustentación Oral Bilingüe de la Propuesta Visual en Inglés A2 (HACER)',
      rubricC4Name: 'Cuidado de Materiales, Curaduría Ética y Trabajo en Taller (SER / CONVIVIR)',
      eval3Title: 'Exposición Museográfica / Galería Capstone y Defensa Estética (A2 Art Exhibition Pitch)',
      eval3Dynamics: 'Recorrido de Galería de Arte (Vernissage): Presentación de 3 a 5 minutos junto a la obra expuesta ante panel de pares y docente, seguida de 2 preguntas de sustentación estética.',
      eval3Step1Guidance: 'Good morning teachers and visitors. Welcome to my artistic exhibition. Today I present our visual Capstone project: [Artwork Title], exploring identity and cultural expression.',
      eval3Step2Guidance: 'Technically, I combined specific compositional elements such as color balance and tactile textures to establish an evocative visual rhythm.',
      eval3Step3Guidance: 'This artwork connects conceptual symbolism with our campus landscape, illustrating how aesthetic expression transforms human perception.',
      eval3Step4Guidance: 'This piece contributes to our school arts festival, celebrating creative diversity and cultural heritage in our community. Thank you.',
      eval3QuestionsGuide: 'preguntas sobre la selección de materiales, intención comunicativa, decisiones compositivas y conexión con el patrimonio cultural',
      eval3RubricProduct: 'Rigor Técnico, Acabado y Expresividad de la Obra Capstone (HACER)',
      eval3RubricArgument: 'Sustentación Conceptual, Coherencia Curatorial y Discurso Estético (SABER)',
    }
  }

  // 8. Ciencias Naturales y Educación Ambiental (Default)
  return {
    areaGroup: 'Ciencias Naturales',
    icfesDefault: 'Ciencias Naturales (Entorno Vivo, Entorno Físico, Ciencia, Tecnología y Sociedad - CTS, Indagación y Explicación de Fenómenos)',
    drivingQuestionEn: 'How do cellular structures, organ systems, and ecological interactions sustain life and biodiversity in our campus ecosystem?',
    projectDefault: 'Proyecto Transversal PRAE Institucional SJB-PGA012 "Biodiversidad en Tienda Nueva: conocer para conservar"',
    eval1Title: 'Prueba de Desempeño Escrito y Análisis Científico',
    eval1Evidence: 'Evidencia 1 Central (DBA Ciencias Naturales), Evidencia 2 Relación estructura-función, Meta ACE Bilingüe A2 (Scientific Terminology), y Aporte PRAE Tienda Nueva.',
    eval1Q2Type: 'Análisis de datos experimentales, ciclos biogeoquímicos o procesos fisiológicos celulares',
    eval1Q6Type: 'Diagramación y Rotulación Anatómica/Ecológica con Nomenclatura Científica en Inglés A2',
    eval1Q7Type: 'Integración Sistémica y Explicación de Fenómenos Homeostáticos o Ecológicos',
    eval1Q8Type: 'Indagación Científica y Formulación de Hipótesis ante Alteraciones Ambientales',
    eval1Q9Type: 'Comprensión de Lectura Científica Bilingüe A2 (Contexto Ambiental PRAE Tienda Nueva)',
    eval2Instrument: 'Examen Práctico de Desempeño y Habilidades Experimentales en Laboratorio',
    eval2Evidences: 'Destrezas de manipulación instrumental, registro técnico a escala, diagnóstico conceptual a ciegas y bioseguridad.',
    eval2Context: '60 minutos en total (4 Estaciones Rotativas de 15 minutos cada una, trabajo individual o en parejas).',
    eval2Safety: 'Uso obligatorio de bata de laboratorio, manipulación responsable de reactivos y microscopios/instrumental, y entrega del puesto limpio.',
    station1Name: 'Montaje Experimental y Enfoque Instrumental (Técnica y Manipulación)',
    station1Materials: 'Microscopios/instrumentos de medición, portaobjetos, reactivos/tinciones y muestras biológicas o físicas.',
    station1Procedure: 'Preparación autónoma de montajes experimentales, enfoque nítido y calibración instrumental.',
    station1Record: 'Instrucciones exactas de lo que dibuja o anota a escala, incluyendo rotulación bilingüe en inglés A2.',
    station2Name: 'Diagnóstico e Identificación a Ciegas (Mystery Sample Diagnosis)',
    station2Materials: '3 muestras rotuladas Muestra X, Muestra Y, Muestra Z.',
    station2Procedure: 'Observación comparativa y deducción técnica del tipo de muestra, tejido o fenómeno.',
    station2Record: 'Tabla comparativa donde registra identificación, origen biológico/físico y justificación técnica en 3 líneas.',
    station3Name: 'Modelado Táctil "Structure - Function Challenge" y Micro-Pitch Oral en Inglés A2',
    station3Materials: 'Materiales de modelado rápido, tarjetas guía y temporizador.',
    station3Procedure: 'Modelado tridimensional en 10 minutos y micro-sustentación oral de 1 minuto ante el docente en inglés A2.',
    station3PromptA2: 'This structure is shaped like... because its main function is to... which allows the organism to adapt to...',
    station4Name: 'Bitácora de Resultados, Bioseguridad y Orden del Puesto',
    station4Materials: 'Papel de arroz, soluciones limpiadoras, contenedores de desechos y ficha técnica consolidada.',
    station4Procedure: 'Consolidación de datos, protocolo de limpieza de lentes/materiales, desconexión segura y verificación de orden.',
    station4Record: 'Checklist de bioseguridad y entrega formal de la bitácora técnica al docente.',
    rubricC1Name: 'Técnica Instrumental y Manipulación Experimental (HACER)',
    rubricC2Name: 'Registro Técnico y Rotulación Bilingüe (HACER)',
    rubricC3Name: 'Diagnóstico y Modelado Estructura-Función (SABER)',
    rubricC4Name: 'Bioseguridad, Autonomía y Orden del Laboratorio (SER)',
    eval3Title: 'Sustentación Oral Bilingüe (A2 Scientific Pitch)',
    eval3Dynamics: 'Feria Científica en Stands: Presentación de 3 a 5 minutos ante panel evaluador (docente y pares), seguida de 2 preguntas de defensa.',
    eval3Step1Guidance: 'Good morning teachers and classmates. Welcome to my presentation. Today I will explain the biological architecture and vital functions of [Species / Subject], an important component of our campus ecosystem in Tienda Nueva.',
    eval3Step2Guidance: 'At the microscopic level, this organism is built of specialized cells such as [cell types]. These cells have unique structures that allow them to perform vital tasks. When grouped together, they form [tissue types], whose main function is to [function in A2 English].',
    eval3Step3Guidance: 'These tissues organize into organs like [organs], which work together in complex organ systems. For example, the transport system interacts directly with the energy acquisition system to supply every single cell with essential nutrients.',
    eval3Step4Guidance: 'Human activities and environmental degradation directly threaten these biological structures in Tienda Nueva. My active commitment for our School Biodiversity Observatory is to protect local habitats and promote environmental stewardship. Thank you for your attention.',
    eval3QuestionsGuide: 'preguntas de profundización sobre causalidad, función y adaptaciones biológicas u ecológicas',
    eval3RubricProduct: 'Calidad y Rigor del Producto Capstone (HACER)',
    eval3RubricArgument: 'Solvencia Argumentativa ante Preguntas Científicas (SABER)',
  }
}

/**
 * Stage 1 Prompt: Identificación, 13 Referentes de Calidad (Tabla) y Arco Pedagógico (Semanas Efectivas)
 */
function buildStage1Prompt(params: GeneratePlanningParams, formattedContext: string): string {
  const { docente, area, grado, periodo, semanas, semanasEfectivas, tema, additionalInstructions } = params
  const safeDocente = sanitizeInputText(docente, 200)
  const safeArea = sanitizeInputText(area, 200)
  const safeGrado = sanitizeInputText(grado, 100)
  const safePeriodo = sanitizeInputText(String(periodo), 50)
  const safeSemanas = sanitizeInputText(semanas || '4 semanas (16 horas de clase — sesiones de 90 min)', 150)
  const safeSemanasEfectivas = sanitizeInputText(semanasEfectivas || '4 semanas efectivas de clase directa', 150)
  const safeTema = sanitizeInputText(tema, 300)
  const safeInstructions = sanitizeInputText(additionalInstructions, 3000)
  const profile = getAreaProfile(area)

  return `Eres el Diseñador Curricular y Asistente Pedagógico Oficial del Colegio Bilingüe San José Campestre (CBSJC).
Tu misión es generar la **ETAPA 1** de la Planeación Curricular Maestra bajo el formato oficial **SJB-RGA006 Planning Book**.
Debes producir una redacción EXHAUSTIVA, EXTENSA, PROFUNDA Y SIN RESÚMENES (mínimo 12.000 a 18.000 caracteres solo para esta etapa).

REGLAS FUNDAMENTALES DE FORMATO Y PROFUNDIDAD PEDAGÓGICA:
1. La Sección 0 DEBE SER UNA TABLA MARKDOWN (| Identificación | Detalle |).
2. La Sección 1 DEBE SER UNA TABLA MARKDOWN (| Referente Curricular | Contenido y Articulación Institucional |) con EXACTAMENTE 14 FILAS. DEBES INCLUIR FILAS SEPARADAS PARA 'Competencias Fijas (Plan de Área / SIAP)' Y 'Competencias Electivas (Profundización / Énfasis)'. CADA FILA DEBE TENER ENTRE 10 Y 20 LÍNEAS DE CONTENIDO PEDAGÓGICO COMPLETO. NUNCA USES LISTAS DE PUNTOS EN LUGAR DE LA TABLA.
3. TERMINA inmediatamente después de la tabla de la Sección 1. NO generes la Sección 2 ni ninguna sección posterior (se generan por separado).

${GROUNDING_RULES}

DATOS DE LA SECUENCIA:
- Docente(s): ${safeDocente}
- Área / Asignatura: ${safeArea}
- Grado / Grupo: ${safeGrado}
- Período / Subciclo: ${safePeriodo} (Año Lectivo 2026)
- Intervalo de Fechas / Semanas Totales: ${safeSemanas}
- Semanas Efectivas de Clase Directa: ${safeSemanasEfectivas}
- Tema o Pregunta de Sentido: ${safeTema}

${safeInstructions ? `<docente_instrucciones>\n${safeInstructions}\n</docente_instrucciones>` : ''}

<contexto_curricular>
${formattedContext || 'Utiliza los referentes oficiales del MEN, DBA de Colombia, estándares EBC y lineamientos pedagógicos del Colegio Bilingüe San José Campestre.'}
</contexto_curricular>

GENERA EXACTAMENTE ESTE BLOQUE EN MARKDOWN (SIN ETIQUETAS HTML NI CÓDIGO BRUTO):

# Secuencia Didáctica: Antes — Durante — Después · Subciclos 3 a 6
**Colegio Bilingüe San José Campestre**

| Identificación | Detalle |
|---|---|
| **Docente(s)** | ${safeDocente} |
| **Área / Asignatura** | ${safeArea} |
| **Grado / Grupo** | ${safeGrado} |
| **Período / Subciclo** | ${safePeriodo} (Año Lectivo 2026) |
| **Fecha(s) / Semanas Totales** | ${safeSemanas} |
| **Semanas Efectivas de Clase** | ${safeSemanasEfectivas} (docencia directa, sin contar exámenes ni eventos) |

## 1. IDENTIFICACIÓN Y REFERENTES DE CALIDAD

| Referente Curricular | Contenido y Articulación Institucional |
|---|---|
| **Meta del subciclo y posición del grado** | (Escribir el subciclo correspondiente, ej. Subciclo 4 — 4.° a 6.° — Descubrimiento del Mundo, declarar posición: Inicia / Desarrolla / Consolida y verifica, y redactar en 15-20 líneas completas el perfil integral de egreso del subciclo). |
| **Competencias Fijas (Plan de Área / SIAP)** | (Detalle exhaustivo de las competencias fijas obligatorias del área y grado según el Plan de Área y SIAP institucional adaptadas a ${safeArea}). |
| **Competencias Electivas (Profundización / Énfasis)** | (Detalle exhaustivo de las competencias electivas de profundización, articulación interdisciplinar o énfasis transversal seleccionadas por el docente a partir de los documentos rectores y adaptadas al grupo). |
| **Estándar Básico de Competencia (EBC)** | (3 estándares oficiales del MEN plenamente citados y articulados al grado para ${safeArea}). |
| **Derecho Básico de Aprendizaje (DBA)** | (Código oficial DBA y enunciado curricular completo del Ministerio de Educación Nacional). |
| **Evidencias de aprendizaje (DBA)** | (Redactar detalladamente: Evidencia 1 Central de la Secuencia, Evidencia Complementaria 2, y Evidencia Complementaria 3 multimodal bilingüe). |
| **Componente evaluado por el ICFES** | (${profile.icfesDefault}). |
| **Pregunta de sentido del período** | (Pregunta rectora institucional en español y Driving Question completa en inglés para el enfoque bilingüe: ej. "${profile.drivingQuestionEn}"). |
| **Aprendizaje esperado de la secuencia** | (Redacción exhaustiva del aprendizaje esperado integrando dimensiones cognitiva, procedimental, contextual y comunicativa en inglés A2). |
| **Evidencia de aprendizaje principal** | (Nombre técnico y descripción detallada del producto o proyecto Capstone central de la secuencia adaptado a ${safeArea}). |
| **Componente ACE del período** | **Alcance:** Aplicación disciplinar en el área de ${safeArea}.<br>**Meta ACE:** En nivel A2/B1, describe y sustenta oralmente en inglés...<br>**Núcleo Lingüístico:** (Mínimo 15 términos disciplinares en inglés con traducción específicos de ${safeArea}).<br>**Expresiones Funcionales:** (Mínimo 5 estructuras de oración completas para producción oral y escrita en ${safeArea}). |
| **Instrumento · nombre de la nota en Cibercolegios** | (Nombre exacto del instrumento para la planilla con porcentajes de pilares y rúbrica Menú de Desafíos). |
| **Proyecto integrador al que aporta** | (${profile.projectDefault}). |
| **Número de semanas e intervalo de fechas** | ${safeSemanas} (${safeSemanasEfectivas} de docencia directa) |

(FIN DEL BLOQUE. Detente aquí: no escribas la Sección 2 ni ninguna otra sección.)
`
}

/**
 * Stage 2 Prompt: Pilares, Rúbrica Menú de Desafíos, Cibercolegios y Firmas.
 * (Section 3 — Plan de Evaluación Continua — is computed by code in lib/ai/arc.ts so percentages add up exactly.)
 */
function buildStage2Prompt(params: GeneratePlanningParams, formattedContext: string, sk: ArcSkeleton): string {
  const { docente, area, grado, periodo, semanas, semanasEfectivas, tema } = params
  const safeDocente = sanitizeInputText(docente, 200)
  const safeArea = sanitizeInputText(area, 200)
  const safeGrado = sanitizeInputText(grado, 100)
  const safePeriodo = sanitizeInputText(String(periodo), 50)
  const safeSemanas = sanitizeInputText(semanas || '4 semanas', 150)
  const safeSemanasEfectivas = sanitizeInputText(semanasEfectivas || '4 semanas efectivas de clase directa', 150)
  const safeTema = sanitizeInputText(tema, 300)
  const w = sk.pesos
  const arcSummary = sk.semanas
    .map((s) => `- Semana ${s.n} (${s.momento}): ${s.eje_tematico}. Producto: ${s.producto_semana || 'por definir'}. Actividad evaluativa: ${s.actividad_evaluativa}.`)
    .join('\n')

  return `Eres el Diseñador Curricular y Asistente Pedagógico Oficial del Colegio Bilingüe San José Campestre (CBSJC).
Tu misión es generar la **ETAPA 2** de la Planeación Curricular Maestra bajo el formato oficial **SJB-RGA006 Planning Book**.
Debes producir una redacción EXHAUSTIVA, EXTENSA, PROFUNDA Y EN FORMATO DE TABLAS MARKDOWN ESTRICTAS (mínimo 12.000 a 18.000 caracteres).

${GROUNDING_RULES}

REGLAS DE FORMATO Y EVALUACIÓN OBLIGATORIAS:
1. EMPIEZA DIRECTAMENTE con el encabezado "## 4. PILARES Y COMPETENCIAS INSTITUCIONALES EN ESTA SECUENCIA". No escribas introducciones. NO generes la Sección 3 (ya existe) ni las Secciones 0, 1, 2 u 8.
2. La Sección 4 DEBE SER UNA TABLA DE 3 COLUMNAS (| Pilar Institucional | Competencia(s) Evaluada(s) | Manifestación en la Evidencia Principal |).
   IMPORTANTE: EN LA COLUMNA 'Competencia(s) Evaluada(s)' PUEDES Y DEBES INCLUIR MÁS DE UNA COMPETENCIA POR PILAR, tomadas de las competencias fijas y electivas del contexto, para dar total flexibilidad al docente.
3. La Sección 5 DEBE SER UNA TABLA DE 5 COLUMNAS (| Pilar · Competencia | Sin categoría (1.0 – 3.9) | Bronze (4.0 – 4.5) Esperado | Silver (4.6 – 4.7) Profundización | Gold (4.8 – 5.0) Excelencia |) con DESCRIPTORES ANALÍTICOS DE 6 A 10 LÍNEAS POR CELDA, específicos del área y del tema (no genéricos).
4. La Sección 6 DEBE SER EL BLOQUE PARA CIBERCOLEGIOS (bloque de código \`\`\`text).
5. La Sección 7 DEBE SER LA BITÁCORA (TABLA 2 COLUMNAS) Y LA TABLA DE 3 FIRMAS (| ELABORÓ | REVISÓ | APROBÓ |).
6. NO INCLUYAS ETIQUETAS HTML CRUDAS (<strong class="...">, </span>, etc.) salvo <br> dentro de celdas. USA EXCLUSIVAMENTE MARKDOWN LIMPIO (**negrilla**, *cursiva*).
7. Los pesos de los pilares en el período YA ESTÁN DEFINIDOS: SABER ${w.SABER}%, SABER HACER ${w['SABER HACER']}%, SABER SER ${w['SABER SER']}%, SABER CONVIVIR ${w['SABER CONVIVIR']}%. Úsalos tal cual; no los modifiques.

DATOS DE LA SECUENCIA:
- Docente(s): ${safeDocente}
- Área / Asignatura: ${safeArea}
- Grado / Grupo: ${safeGrado}
- Período: ${safePeriodo} (Año Lectivo 2026)
- Intervalo de Semanas / Fechas: ${safeSemanas}
- Semanas Efectivas de Clase: ${safeSemanasEfectivas}
- Tema: ${safeTema}

ARCO PEDAGÓGICO YA DEFINIDO (para que la evidencia y las rúbricas sean coherentes con él):
${arcSummary}

<contexto_curricular>
${formattedContext || 'Utiliza los referentes oficiales del MEN y lineamientos del Colegio Bilingüe San José Campestre.'}
</contexto_curricular>

GENERA EXACTAMENTE ESTE BLOQUE EN MARKDOWN:

## 4. PILARES Y COMPETENCIAS INSTITUCIONALES EN ESTA SECUENCIA

| Pilar Institucional | Competencia(s) Evaluada(s) | Manifestación en la Evidencia Principal |
|---|---|---|
| **SABER (${w.SABER}%)** | (Una o más competencias cognitivas del contexto, nombradas literalmente) | (Cómo se manifiesta en la evidencia principal del tema ${safeTema}) |
| **SABER HACER (${w['SABER HACER']}%)** | (Una o más competencias procedimentales/comunicativas del contexto, incluida la comunicación en inglés A2 si el contexto la contempla) | (Cómo se manifiesta en la evidencia principal) |
| **SABER SER (${w['SABER SER']}%)** | (Una o más competencias actitudinales del contexto) | (Cómo se manifiesta en la evidencia principal) |
| **SABER CONVIVIR (${w['SABER CONVIVIR']}%)** | (Una o más competencias relacionales del contexto) | (Cómo se manifiesta en la evidencia principal) |

## 5. RÚBRICA GLOBAL DE LA EVIDENCIA DE APRENDIZAJE · MENÚ DE DESAFÍOS

| Pilar · Competencia | Sin categoría (1.0 – 3.9) | Bronze (4.0 – 4.5) Esperado | Silver (4.6 – 4.7) Profundización | Gold (4.8 – 5.0) Excelencia |
|---|---|---|---|---|
| **SABER (${w.SABER}%)**<br>(competencia) | (Descriptor: logro insuficiente, específico del tema) | (Descriptor: el aprendizaje esperado completo del grado) | (Descriptor: lo anterior y además profundiza) | (Descriptor: lo anterior y además transfiere/crea) |
| **SABER HACER (${w['SABER HACER']}%)**<br>(competencia) | (…) | (…) | (…) | (…) |
| **SABER SER (${w['SABER SER']}%)**<br>(competencia) | (…) | (…) | (…) | (…) |
| **SABER CONVIVIR (${w['SABER CONVIVIR']}%)**<br>(competencia) | (…) | (…) | (…) | (…) |

*Salvaguardas Pedagógicas CBSJC:* El descriptor Bronze es el aprendizaje esperado completo del grado; Silver y Gold exigen profundización y excelencia alcanzable dentro del tiempo de la secuencia. La reentrega formativa siempre mejora el aprendizaje y la valoración según la banda alcanzada.

## 6. BLOQUE DE TRASLADO A CIBERCOLEGIOS
\`\`\`text
NOMBRE (instrumento): ${safeTema} (SJB-RGA006)
DESCRIPCIÓN: Pregunta de sentido: (tomada del contexto) | DBA: (del contexto) | Evidencia principal: (nombre) | Competencias por pilar: SABER (${w.SABER}%) - ...; SABER HACER (${w['SABER HACER']}%) - ...; SABER SER (${w['SABER SER']}%) - ...; SABER CONVIVIR (${w['SABER CONVIVIR']}%) - ... | Rúbrica: Menú de Desafíos adjunta en el recurso de la actividad | Bandas de valoración: Sin categoría (1.0 - 3.9) | Bronze (4.0 - 4.5: esperado completo) | Silver (4.6 - 4.7: profundización) | Gold (4.8 - 5.0: excelencia y transferencia).
\`\`\`

## 7. BITÁCORA DE LA SECUENCIA · SE DILIGENCIA AL CIERRE

| Aspecto Reflexivo | Registro del Docente |
|---|---|
| **Qué ocurrió frente a lo planeado** | [Espacio reservado para el registro reflexivo del docente al finalizar las ${safeSemanasEfectivas}: ajustes sobre la marcha, gestión de tiempos y adaptaciones metodológicas]. |
| **Distribución de niveles del grupo** | [Registro cuantitativo institucional: N.° de estudiantes en Sin Categoría / Bronze / Silver / Gold — Sin nombres individuales]. |
| **Lectura del docente** | [Lectura pedagógica del docente: análisis de logros del grupo, seguimiento a estudiantes con ajustes PIAR/DUA y acuerdos de mejora para la siguiente secuencia]. |

| ELABORÓ | REVISÓ | APROBÓ |
|---|---|---|
| _____________________________<br>${safeDocente}<br>${safeGrado} — Subciclo 4<br>Colegio Bilingüe San José Campestre | _____________________________ <br>Coordinación de Área<br>Comité Curricular y Pedagógico<br>Colegio Bilingüe San José Campestre | _____________________________ <br>Coordinación Académica General<br>Rectoría Institucional<br>Colegio Bilingüe San José Campestre |
`
}

/**
 * Stage 3 Prompt: 3 Evaluaciones Finales Completas adaptadas por disciplina (10 preguntas, 4 estaciones prácticas, pitch A2) + Rúbricas Analíticas
 */
function buildStage3Prompt(params: GeneratePlanningParams, formattedContext: string): string {
  const { docente, area, grado, periodo, semanas, tema } = params
  const safeDocente = sanitizeInputText(docente, 200)
  const safeArea = sanitizeInputText(area, 200)
  const safeGrado = sanitizeInputText(grado, 100)
  const safePeriodo = sanitizeInputText(String(periodo), 50)
  const safeTema = sanitizeInputText(tema, 300)
  const profile = getAreaProfile(area)

  return `Eres el Diseñador Curricular y Asistente Pedagógico Oficial del Colegio Bilingüe San José Campestre (CBSJC).
Tu misión es generar la **ETAPA 3** (ANEXOS EVALUATIVOS COMPLETOS) bajo el formato oficial **SJB-RGA006 Planning Book**.
Debes producir una redacción EXHAUSTIVA, EXTENSA, PROFUNDA Y COMPLETA PALABRA POR PALABRA (mínimo 22.000 a 30.000 caracteres solo para esta sección de evaluaciones).

REGLAS DE OBLIGATORIEDAD ABSOLUTA:
1. CADA PREGUNTA DE LA 1 A LA 10 DEBE ESTAR ESCRITA COMPLETA Y DETALLADA PALABRA POR PALABRA (sin abreviaciones, sin elipsis '...', sin omitir opciones A, B, C, D ni claves de respuesta).
2. EL PROTOCOLO DE LAS 4 ESTACIONES PRÁCTICAS DEBE DESCRIBIR PROCEDIMIENTOS, MATERIALES, FICHAS DE REGISTRO Y MODELADO EN DETALLE, estrictamente adaptado al área de ${safeArea} (NUNCA uses microscopios ni conceptos biológicos a menos que el área sea Ciencias Naturales/Biología).
3. ESTÁ TOTALMENTE PROHIBIDO EL USO DE DIAGRAMAS ASCII ART, BLOQUES DE CÓDIGO CON '+---+' O DIBUJOS DE TEXTO MONOSPACIO PARA EXPLICAR LAS ESTACIONES. Debes usar tablas Markdown formales o texto narrativo estructurado con viñetas.
4. EL GUION DE SUSTENTACIÓN ORAL EN INGLÉS A2 DEBE TENER LOS 5 TEXTOS COMPLETOS EN INGLÉS (Apertura, Fundamentación, Aplicación, Proyecto y Defensa).
5. CADA EVALUACIÓN DEBE LLEVAR SU TABLA DE FICHA TÉCNICA Y SU TABLA DE RÚBRICA ANALÍTICA DE 5 COLUMNAS (| Criterio / Dimensión | Sin Categoría (1.0 - 3.9) | Bronze (4.0 - 4.5) Esperado | Silver (4.6 - 4.7) Profundización | Gold (4.8 - 5.0) Excelencia |).

DATOS DE LA SECUENCIA:
- Docente: ${safeDocente}
- Asignatura: ${safeArea}
- Grado: ${safeGrado}
- Período: ${safePeriodo}
- Tema: ${safeTema}

${GROUNDING_RULES}

Las preguntas de las evaluaciones deben evaluar EXCLUSIVAMENTE contenidos del tema y de los referentes del contexto para ${safeArea}; toda clave de respuesta debe ser correcta y verificable. Empieza directamente con el encabezado "## 8." sin introducciones.

<contexto_curricular>
${formattedContext || 'Utiliza únicamente referentes generales del MEN.'}
</contexto_curricular>

GENERA EXACTAMENTE ESTE BLOQUE EN MARKDOWN:

## 8. ANEXO INSTITUCIONAL: TRES (3) EVALUACIONES FINALES Y RÚBRICAS ANALÍTICAS

### EVALUACIÓN FINAL 1: PRUEBA ESCRITA Y ANÁLISIS COGNITIVO (SABER 35% / HACER 15%)

| Campo Institucional | Detalle de la Evaluación Escrita |
|---|---|
| **Nombre del Instrumento** | ${profile.eval1Title}: '${safeTema}' |
| **Evidencias Evaluadas** | ${profile.eval1Evidence} |
| **Dimensiones SIEE y Ponderación** | SABER (35% - Comprensión y argumentación) + SABER HACER (15% - Registro y aplicación bilingüe). |
| **Tiempo de Aplicación** | 60 minutos (Sesión individual). |
| **Indicaciones Generales** | Lee atentamente cada enunciado. Responde con claridad, justifica tus respuestas en las preguntas conceptuales y utiliza el vocabulario técnico en inglés en las secciones bilingües. |

#### CUESTIONARIO COMPLETO DE LA PRUEBA ESCRITA (10 PREGUNTAS DETALLADAS PALABRA POR PALABRA):

1. **(Selección Múltiple - Tipo ICFES con justificación conceptual):**
   (Redactar un enunciado completo y riguroso contextualizado en el tema de ${safeArea}, con 4 opciones completas A, B, C, D y un espacio de justificación: 'Justifica brevemente tu respuesta').
2. **(Selección Múltiple - ${profile.eval1Q2Type}):**
   (Redactar un enunciado contextualizado en el tema de ${safeArea}, con 4 opciones completas A, B, C, D).
3. **(Análisis de Caso Contextualizado y Transferencia Práctica - ${profile.projectDefault}):**
   (Redactar un caso práctico completo sobre el impacto o aplicación del tema en el entorno escolar/social y formular 2 preguntas abiertas de análisis).
4. **(Matching Bilingüe A2 en ${safeArea}):**
   (Presentar 5 términos disciplinares en inglés emparejados con 5 definiciones técnicas completas en inglés A2 específicas de ${safeArea}).
5. **(Sentence Completion A2 con Banco de Palabras de ${safeArea}):**
   (Presentar un párrafo conceptual en inglés con 5 espacios en blanco y su respectivo word bank disciplinar de ${safeArea}: [palabra1, palabra2, palabra3, palabra4, palabra5]).
6. **(${profile.eval1Q6Type}):**
   (Instrucción precisa para dibujar, rotular, modelar o esquematizar 6 elementos o etapas clave utilizando terminología técnica en inglés A2).
7. **(${profile.eval1Q7Type}):**
   (Pregunta abierta de desarrollo amplio donde el estudiante describe el funcionamiento, procedimiento o interacción completa en ${safeArea}).
8. **(${profile.eval1Q8Type}):**
   (Situación problemática donde el estudiante formula una hipótesis, estrategia de resolución o propuesta fundamentada en ${safeArea}).
9. **(Comprensión de Lectura Bilingüe A2 - ${profile.eval1Q9Type}):**
   (Texto técnico/académico de 80-100 palabras en inglés sobre el tema y 2 preguntas de comprensión e inferencia en inglés A2).
10. **(Metacognición, Autocuidado y Compromiso Ético - SABER SER):**
    (Pregunta reflexiva donde el estudiante formula 2 decisiones personales de autorregulación/cuidado y 1 acción concreta de aplicación comunitaria o institucional).

#### RÚBRICA ANALÍTICA — PRUEBA ESCRITA (MENÚ DE DESAFÍOS)

| Criterio / Dimensión | Sin Categoría (1.0 - 3.9) | Bronze (4.0 - 4.5) Esperado | Silver (4.6 - 4.7) Profundización | Gold (4.8 - 5.0) Excelencia |
|---|---|---|---|---|
| **Comprensión Conceptual Disciplinar (SABER)** | Identifica con imprecisiones conceptos clave o comete errores al diferenciar procesos básicos de ${safeArea}. | Explica con precisión los conceptos y jerarquías fundamentales respondiendo correctamente los ítems de ${safeArea}. | Lo anterior, y además justifica con rigor técnico la relación entre estructuras, principios o funciones. | Lo anterior, y además integra análisis sistémico avanzado y formula hipótesis explicativas impecables. |
| **Aplicación y Resolución Práctica (SABER HACER)** | Dificultad para resolver situaciones problema o esquemas de aplicación técnica. | Resuelve problemas cotidianos y diagramas aplicando correctamente los principios de ${safeArea}. | Lo anterior, y además analiza casos complejos contextualizados en el entorno con fundamentación sólida. | Lo anterior, y además propone modelos explicativos innovadores y soluciones contextualizadas al territorio. |
| **Precisión Lingüística Bilingüe A2 (Componente ACE)** | Omite términos en inglés o presenta errores frecuentes en matching y completación. | Completa correctamente los ítems en inglés A2 utilizando el banco de palabras y rotulación técnica. | Lo anterior, y además responde con oraciones completas y vocabulario disciplinar preciso en inglés. | Lo anterior, y además demuestra comprensión de lectura superior y redacción bilingüe fluida sin errores. |
| **Reflexión, Autonomía y Ética (SABER SER)** | No formula compromisos de autocuidado o muestra respuestas superficiales. | Formula decisiones de autorregulación y reconoce la importancia del aprendizaje en su contexto. | Lo anterior, y además argumenta con claridad el impacto de sus hábitos y conocimientos en su entorno. | Lo anterior, y además asume un compromiso ético activo y ejemplar con la comunidad escolar. |

---

### EVALUACIÓN FINAL 2: ${profile.eval2Instrument.toUpperCase()} (SABER HACER 45% / SER 20% / SABER 20%)

| Campo Institucional | Detalle de la Evaluación Práctica |
|---|---|
| **Nombre del Instrumento** | ${profile.eval2Instrument}: '${safeTema}' |
| **Evidencias Evaluadas** | ${profile.eval2Evidences} |
| **Dimensiones SIEE y Ponderación** | SABER HACER (45% - Procedimientos y registro) + SABER SER (20% - Autonomía y responsabilidad) + SABER (20% - Diagnóstico y aplicación). |
| **Duración y Dinámica** | ${profile.eval2Context} |
| **Normas de Procedimiento y Seguridad** | ${profile.eval2Safety} |

#### PROTOCOLO COMPLETO DE LAS 4 ESTACIONES PRÁCTICAS ROTATIVAS (15 MINUTOS POR ESTACIÓN):

- **ESTACIÓN 1: ${profile.station1Name}:**
  - *Materiales y Equipos:* ${profile.station1Materials}
  - *Procedimiento y Tarea del Estudiante:* ${profile.station1Procedure}
  - *Ficha de Registro:* ${profile.station1Record}

- **ESTACIÓN 2: ${profile.station2Name}:**
  - *Materiales y Equipos:* ${profile.station2Materials}
  - *Procedimiento y Tarea del Estudiante:* ${profile.station2Procedure}
  - *Ficha de Registro:* ${profile.station2Record}

- **ESTACIÓN 3: ${profile.station3Name}:**
  - *Materiales y Equipos:* ${profile.station3Materials}
  - *Procedimiento y Tarea del Estudiante:* ${profile.station3Procedure}
  - *Guion Oral en Inglés A2:* (Estructura exacta que debe decir el estudiante: '${profile.station3PromptA2}').

- **ESTACIÓN 4: ${profile.station4Name}:**
  - *Materiales y Equipos:* ${profile.station4Materials}
  - *Procedimiento y Tarea del Estudiante:* ${profile.station4Procedure}
  - *Ficha de Registro:* ${profile.station4Record}

#### RÚBRICA ANALÍTICA — PRÁCTICA FORMATIVA (MENÚ DE DESAFÍOS)

| Criterio / Dimensión | Sin Categoría (1.0 - 3.9) | Bronze (4.0 - 4.5) Esperado | Silver (4.6 - 4.7) Profundización | Gold (4.8 - 5.0) Excelencia |
|---|---|---|---|---|
| **${profile.rubricC1Name}** | Requiere asistencia continua para ejecutar procedimientos o comete errores graves en la manipulación. | Ejecuta los procedimientos de forma autónoma, utiliza adecuadamente los instrumentos y sigue la secuencia técnica. | Lo anterior, y además ajusta parámetros con precisión para maximizar la calidad y exactitud del trabajo. | Lo anterior, y además demuestra destreza técnica impecable asistiendo a sus compañeros con liderazgo formativo. |
| **${profile.rubricC2Name}** | Registros incompletos o imprecisos; omite rotulación o vocabulario técnico en inglés A2. | Registra esquemas proporcionales y claros, rotulando correctamente en inglés 4 o más elementos clave. | Lo anterior, y además incluye especificaciones detalladas, notas explicativas y escalas rigurosas. | Lo anterior, y además elabora registros de calidad técnica y editorial con descripciones exhaustivas en inglés. |
| **${profile.rubricC3Name}** | Diagnósticos erróneos o incapacidad para justificar las soluciones y modelos presentados. | Identifica y diagnostica correctamente las situaciones problema, justificando con claridad su funcionamiento. | Lo anterior, y además modela de forma creativa y sustenta oralmente en inglés A2 con fluidez y precisión. | Lo anterior, y además transfiere los aprendizajes a situaciones complejas e innovadoras del entorno CBSJC. |
| **${profile.rubricC4Name}** | Incumple acuerdos de trabajo o deja su estación desordenada y con material sin organizar. | Cumple los acuerdos y normas de la estación, maneja los recursos con cuidado y entrega su estación ordenada. | Lo anterior, y además demuestra excelente gestión del tiempo completando las estaciones antes del límite. | Lo anterior, y además lidera el protocolo de verificación y entrega del espacio de trabajo con autonomía ejemplar. |

---

### EVALUACIÓN FINAL 3: SUSTENTACIÓN ORAL Y DEFENSA CAPSTONE (SABER HACER 45% / SER 20% / CONVIVIR 10%)

| Campo Institucional | Detalle de la Sustentación Oral |
|---|---|
| **Nombre del Instrumento** | ${profile.eval3Title}: '${safeTema}' |
| **Evidencias Evaluadas** | Dominio conceptual del producto Capstone, fluidez y pronunciación en inglés A2, solvencia argumentativa ante preguntas y coevaluación formativa. |
| **Dimensiones SIEE y Ponderación** | SABER HACER (45% - Producto y expresión oral) + SABER SER (20% - Seguridad y autonomía) + SABER CONVIVIR (10% - Respeto y coevaluación). |
| **Dinámica de la Evaluación** | ${profile.eval3Dynamics} |

#### GUÍA Y GUION DE SUSTENTACIÓN ORAL EN INGLÉS (A2 CAPSTONE PITCH — 5 PASOS TEXTUALES):

1. **APERTURA Y PRESENTACIÓN DEL PROYECTO (30 segundos):**
   - *Guion en Inglés de Referencia:* "${profile.eval3Step1Guidance}"
2. **FUNDAMENTOS CONCEPTUALES Y DESARROLLO TÉCNICO (1.5 minutos):**
   - *Guion en Inglés de Referencia:* "${profile.eval3Step2Guidance}"
3. **INTEGRACIÓN SISTÉMICA Y APLICACIÓN PRÁCTICA (1.5 minutos):**
   - *Guion en Inglés de Referencia:* "${profile.eval3Step3Guidance}"
4. **IMPACTO CONTEXTUAL Y PROYECTO INSTITUCIONAL (30 segundos):**
   - *Guion en Inglés de Referencia:* "${profile.eval3Step4Guidance}"
5. **DEFENSA Y RESPUESTA ANTE PREGUNTAS DEL PANEL (1 minuto):**
   - *Dinámica:* El estudiante responde 2 preguntas de profundización formuladas por el evaluador en inglés o español: ${profile.eval3QuestionsGuide}.

#### RÚBRICA ANALÍTICA — SUSTENTACIÓN ORAL CAPSTONE (MENÚ DE DESAFÍOS)

| Criterio / Dimensión | Sin Categoría (1.0 - 3.9) | Bronze (4.0 - 4.5) Esperado | Silver (4.6 - 4.7) Profundización | Gold (4.8 - 5.0) Excelencia |
|---|---|---|---|---|
| **${profile.eval3RubricProduct}** | El producto presenta niveles incompletos, errores conceptuales o acabado deficiente. | Elabora el producto completo con todos los elementos requeridos, rotulación en inglés y organización adecuada. | Lo anterior, y además incorpora elementos creativos de calidad técnica superior. | Lo anterior, y además elabora una pieza sobresaliente de divulgación digna del repositorio institucional. |
| **Fluidez y Precisión Oral en Inglés A2 (Componente ACE)** | Dificultad marcada para comunicarse en inglés; lectura total de notas o uso predominante de español. | Expone con fluidez básica en nivel A2 siguiendo el guion estructurado, con pronunciación clara y vocabulario técnico. | Lo anterior, y además expone con notable naturalidad, entonación adecuada y sin dependencia de notas escritas. | Lo anterior, y además demuestra dominio comunicativo excepcional, interactuando en inglés con espontaneidad y precisión. |
| **${profile.eval3RubricArgument}** | No responde las preguntas de indagación o brinda explicaciones contradictorias. | Responde satisfactoriamente las preguntas del panel explicando con claridad los conceptos y fundamentos clave. | Lo anterior, y además fundamenta sus respuestas articulando ejemplos reales y solventes. | Lo anterior, y además formula explicaciones sistémicas profundas vinculando principios disciplinares avanzados. |
| **Responsabilidad, Coevaluación y Trabajo Cooperativo (SER / CONVIVIR)** | Manifiesta desinterés durante las presentaciones de sus pares o no participa constructivamente. | Cumple el tiempo asignado, participa con respeto en la coevaluación (Praise & Polish) y formula su reflexión formativa. | Lo anterior, y además brinda retroalimentación constructiva de alto valor a sus compañeros durante la sesión. | Lo anterior, y además destaca como líder inspirador del evento, promoviendo el rigor académico y la empatía colectiva. |
`
}

/* ------------------------------------------------------------------------------------------------
 * Arc planning (skeleton) + per-week deep generation + Section 1 audit
 * ---------------------------------------------------------------------------------------------- */

const SPREAD_MODELS = [
  'gemini-3.5-flash-lite',
  'gemini-3.1-flash-lite',
  'gemini-3.1-flash-lite-preview',
  'gemini-flash-lite-latest',
] as const

function pickModel(i: number): string {
  return SPREAD_MODELS[i % SPREAD_MODELS.length]
}

function extractJson(text: string): string {
  const t = text.replace(/```(?:json)?/gi, '').trim()
  const a = t.indexOf('{')
  const b = t.lastIndexOf('}')
  return a >= 0 && b > a ? t.slice(a, b + 1) : t
}

/** Removes any preamble before the expected first heading and unwraps a full-document code fence. */
function trimToHeading(text: string, headingRe: RegExp): string {
  let t = text.trim()
  if (/^```(?:markdown|md)?\s*\n/i.test(t)) {
    t = t.replace(/^```(?:markdown|md)?\s*\n/i, '').replace(/\n```\s*$/i, '')
  }
  const m = headingRe.exec(t)
  if (m && m.index > 0) t = t.slice(m.index)
  return t.trim()
}

function buildSkeletonPrompt(params: GeneratePlanningParams, formattedContext: string, total: number): string {
  const safeArea = sanitizeInputText(params.area, 200)
  const safeGrado = sanitizeInputText(params.grado, 100)
  const safePeriodo = sanitizeInputText(String(params.periodo), 50)
  const safeTema = sanitizeInputText(params.tema, 300)
  const safeSemanas = sanitizeInputText(params.semanas || '4 semanas', 150)
  const safeInstructions = sanitizeInputText(params.additionalInstructions, 3000)

  return `Eres el Diseñador Curricular del Colegio Bilingüe San José Campestre (CBSJC). Vas a PLANIFICAR (no redactar en detalle) el arco pedagógico ANTES — DURANTE — DESPUÉS de una secuencia didáctica de ${total} semana(s) efectiva(s).

${GROUNDING_RULES}

DATOS:
- Área: ${safeArea} · Grado: ${safeGrado} · Período: ${safePeriodo}
- Marco de semanas / horario: ${safeSemanas}
- Semanas efectivas de clase directa: ${total}
- Tema / pregunta de sentido: ${safeTema}
${safeInstructions ? `- Instrucciones del docente: ${safeInstructions}` : ''}

<contexto_curricular>
${formattedContext || 'Sin documentos: usa únicamente referentes generales del MEN.'}
</contexto_curricular>

TAREA:
1. Busca en el contexto los PESOS de los cuatro pilares para el período (SABER, SABER HACER, SABER SER, SABER CONVIVIR). Si aparecen explícitamente y suman 100, devuélvelos en "pesos_pilares". Si NO aparecen, devuelve "pesos_pilares": null (NO los inventes).
2. Diseña ${total} semanas con progresión lógica: la Semana 1 es ANTES (conecta y reta, exploración sin costo en nota), las intermedias son DURANTE (explora, construye y aplica) y la última es DESPUÉS (evidencia, mejora, reflexiona y transfiere). Cada semana debe AVANZAR un producto/evidencia acumulativa hacia la evidencia principal; no repitas actividades entre semanas.
3. Cada semana lleva UNA actividad evaluativa concreta, los pilares que valora (al menos uno; en conjunto las semanas deben cubrir los cuatro pilares) y una síntesis de rúbrica de 1-2 frases coherente con el Menú de Desafíos (Bronze/Silver/Gold).

RESPONDE ÚNICAMENTE CON JSON VÁLIDO con esta forma exacta:
{
  "pesos_pilares": {"SABER": 35, "SABER HACER": 35, "SABER SER": 20, "SABER CONVIVIR": 10} | null,
  "semanas": [
    {
      "n": 1,
      "eje_tematico": "…",
      "can_do": "Declaración en primera persona, bilingüe (español + 'I can…' en inglés A2)",
      "producto_semana": "evidencia intermedia concreta de esta semana",
      "actividad_evaluativa": "nombre concreto de la actividad evaluativa",
      "pilares": ["SABER", "SABER SER"],
      "rubrica_sintesis": "1-2 frases",
      "foco_conceptual": ["3 a 5 conceptos clave que se trabajan esta semana"],
      "rutina_pensamiento": "nombre de una rutina de pensamiento visible de Harvard (p. ej. See-Think-Wonder, 3-2-1 Bridge, Claim-Support-Question, Connect-Extend-Challenge, Parts-Purposes-Complexities, Zoom In, I Used to Think… Now I Think…)"
    }
  ]
}`
}

function summarizeArc(sk: ArcSkeleton): string {
  return sk.semanas
    .map(
      (s) =>
        `- Semana ${s.n} (${s.momento}): eje "${s.eje_tematico}" · producto: ${s.producto_semana || 'por definir'} · conceptos: ${s.foco_conceptual.join(', ') || 'por definir'} · rutina: ${s.rutina_pensamiento}`
    )
    .join('\n')
}

function buildWeekPrompt(
  params: GeneratePlanningParams,
  formattedContext: string,
  sk: ArcSkeleton,
  week: WeekPlan
): string {
  const safeArea = sanitizeInputText(params.area, 200)
  const safeGrado = sanitizeInputText(params.grado, 100)
  const safePeriodo = sanitizeInputText(String(params.periodo), 50)
  const safeTema = sanitizeInputText(params.tema, 300)
  const safeSemanas = sanitizeInputText(params.semanas || '4 semanas (sesiones de 90 min)', 150)
  const safeInstructions = sanitizeInputText(params.additionalInstructions, 3000)
  const total = sk.semanas.length

  const momentGuide: Record<string, string> = {
    ANTES:
      'ANTES — Conecta y reta. Activación cognitiva con un fenómeno/reto real del contexto escolar, exploración diagnóstica SIN costo en la nota, publicación y explicación de la Rúbrica Menú de Desafíos (Bronze-Silver-Gold) y apertura del Tablero de Progreso (Anexo A6) en el cuaderno.',
    DURANTE:
      'DURANTE — Explora, construye y aplica. Trabajo cooperativo con roles, construcción por fases de la evidencia principal, coevaluación formativa con protocolo Praise & Polish (1 elogio técnico + 1 sugerencia) y actualización del Tablero de Progreso.',
    'DESPUÉS':
      'DESPUÉS — Evidencia, mejora, reflexiona y transfiere. Ensamble final de la evidencia, sustentación oral bilingüe ante panel de pares y docente, metacognición, reentrega para mejorar y transferencia al proyecto integrador/PRAE si el contexto lo contempla.',
  }

  return `Eres el Diseñador Curricular del Colegio Bilingüe San José Campestre (CBSJC). Redacta ÚNICAMENTE el desarrollo EXHAUSTIVO de la SEMANA ${week.n} de ${total} del arco pedagógico, sesión por sesión, para que un docente pueda ejecutarlo sin consultar nada más.

${GROUNDING_RULES}

DATOS:
- Área: ${safeArea} · Grado: ${safeGrado} · Período: ${safePeriodo}
- Tema / pregunta de sentido: ${safeTema}
- Marco de semanas y horario (úsalo para repartir los minutos): ${safeSemanas}
${safeInstructions ? `- Instrucciones del docente (respétalas): ${safeInstructions}` : ''}

ARCO COMPLETO DE LA SECUENCIA (para dar continuidad y NO repetir actividades de otras semanas):
${summarizeArc(sk)}

ESTA SEMANA — ${momentGuide[week.momento] || week.momento}
- Eje temático: ${week.eje_tematico}
- Can-Do base: ${week.can_do || 'redáctalo tú (bilingüe)'}
- Producto/evidencia de esta semana: ${week.producto_semana || 'defínelo coherente con el arco'}
- Conceptos a trabajar: ${week.foco_conceptual.join('; ') || 'derívalos del tema y del contexto'}
- Rutina de pensamiento sugerida: ${week.rutina_pensamiento}
- Actividad evaluativa vinculada: ${week.actividad_evaluativa} (pilares: ${week.pilares.join(', ')})

<contexto_curricular>
${formattedContext || 'Sin documentos: usa únicamente referentes generales del MEN.'}
</contexto_curricular>

FORMATO DE SALIDA (texto plano, SIN markdown, SIN tablas, SIN asteriscos). Cada bloque empieza EXACTAMENTE con su etiqueta en mayúsculas seguida de dos puntos. Escribe todas las etiquetas, en este orden:

EJE TEMÁTICO: …
CAN-DO STATEMENT: … (español) / I can … (inglés A2)
RUTINA DE PENSAMIENTO VISIBLE: nombre de la rutina + protocolo exacto de registro en el cuaderno (qué escribe/dibuja el estudiante y en qué orden).
MOMENTO 1 · WARM-UP / PRE-TASK (xx min): …
MOMENTO 2 · CORE TASK (xx min): …
MOMENTO 3 · WRAP-UP & LANGUAGE FOCUS (xx min): …
SENTENCE FRAMES (ENGLISH A2/B1): …
TICKET DE SALIDA: …
EVIDENCIA / PRODUCTO DE LA SEMANA: …
CONSIGNAS DOCENTES: …
AJUSTES DUA & PIAR: …

EXIGENCIAS DE PROFUNDIDAD (cumple TODAS; el texto total debe tener entre 5.000 y 9.000 caracteres):
- Cada MOMENTO indica minutos exactos (los tres suman la duración de una sesión según el horario) y se redacta PASO A PASO con pasos numerados (1., 2., 3., …). Cada paso dice qué hace el docente y qué hace el estudiante.
- MOMENTO 2 (Core Task) incluye roles de aprendizaje cooperativo (Líder Científico/de Equipo, Registrador ACE, Gestor de Materiales, Diseñador de Datos/Vocero), los materiales concretos y el producto intermedio tangible. Si la semana tiene varias sesiones, desglosa cada sesión ("Sesión 1 …", "Sesión 2 …").
- SENTENCE FRAMES: mínimo 4 estructuras literales en inglés entre comillas, con el vocabulario disciplinar clave de esta semana y su uso (oral/escrito).
- TICKET DE SALIDA: mínimo 2 preguntas concretas sobre el contenido de ESTA semana, cada una con la respuesta esperada entre paréntesis.
- CONSIGNAS DOCENTES: mínimo 5, numeradas (1)…(5), de mediación pedagógica (preguntas provocadoras a formular, errores conceptuales frecuentes a anticipar, cómo andamiar el inglés, cómo retroalimentar).
- AJUSTES DUA & PIAR: mínimo 5 estrategias concretas y diferenciadas por nivel (apoyo / estándar / desafío) para estudiantes con TDAH y estilos diversos (código de color de alto contraste, temporizador visual de 15 min, pausas activas, banco de palabras, modalidades alternativas de respuesta).
- Todo debe ser específico del área, grado y tema: nada genérico, nada de otras áreas. No repitas actividades de las otras semanas.
- No dejes textos entre paréntesis tipo "(Redactar…)". Escribe todo completo.`
}

async function generateWeekCell(
  params: GeneratePlanningParams,
  formattedContext: string,
  sk: ArcSkeleton,
  week: WeekPlan,
  taskIndex: number,
  deadline: number
): Promise<{ cell: string; truncated: boolean }> {
  const basePrompt = buildWeekPrompt(params, formattedContext, sk, week)
  let feedback = ''
  let best = { cell: '', truncated: false, problems: ['sin contenido'] as string[] }

  for (let attempt = 0; attempt < 2; attempt++) {
    const r = await callModelDetailed(basePrompt + feedback, {
      maxOutputTokens: 8192,
      temperature: 0.3,
      preferredModel: pickModel(taskIndex + attempt),
      deadline,
    })
    const cell = formatWeekCell(r.text)
    const problems = weekDepthProblems(cell)
    if (best.cell === '' || problems.length < best.problems.length) {
      best = { cell, truncated: r.truncated, problems }
    }
    if (problems.length === 0) break
    console.warn(`[generator] Week ${week.n} attempt ${attempt + 1} rejected: ${problems.join('; ')}`)
    feedback = `\n\nCORRECCIÓN OBLIGATORIA: tu respuesta anterior fue rechazada porque: ${problems.join('; ')}. Reescribe la semana COMPLETA cumpliendo todas las exigencias, con más detalle y respetando exactamente las etiquetas.`
  }
  return { cell: best.cell, truncated: best.truncated }
}

const AUDITED_ROWS = [
  'competencias fijas',
  'competencias electivas',
  'estandar basico',
  'derecho basico',
  'evidencias de aprendizaje',
  'icfes',
  'pregunta de sentido',
]

/**
 * Quote-grounded audit of the official data rows in Section 1.
 * The model must copy a LITERAL fragment of the rector documents for every row; the quote is then verified
 * programmatically. Rows without a verifiable quote are flagged for the teacher.
 */
async function auditSection1(
  stage1Text: string,
  groundedContext: string,
  allContextNorm: string,
  deadline: number
): Promise<{ flags: Array<{ rowLabel: string; reason: string }>; checked: number; ok: boolean }> {
  const rows = sectionBody(stage1Text, 1)
    .split('\n')
    .filter((l) => l.trim().startsWith('|') && !/^\|\s*[-:]+/.test(l.trim()))
    .map((l) => l.split('|').map((c) => c.trim()))
    .map((cells) => ({ label: (cells[1] || '').replace(/\*/g, ''), content: (cells[2] || '').replace(/<br>/g, ' ') }))
    .filter((r) => AUDITED_ROWS.some((a) => normalizeForMatch(r.label).includes(a)))
    .filter((r) => !/NO CONSTA EN LOS DOCUMENTOS/i.test(r.content))

  if (rows.length === 0) return { flags: [], checked: 0, ok: true }

  const prompt = `Eres un AUDITOR de fidelidad documental. Debes verificar si el contenido de cada fila de una planeación está respaldado por los DOCUMENTOS RECTORES.

Para CADA fila:
- Copia LITERALMENTE (sin modificar ni resumir) un fragmento de 8 a 40 palabras de los documentos que respalde su contenido oficial, en "cita_textual".
- Si no existe respaldo en los documentos, usa "apoyado": false y "cita_textual": "".
- NO inventes citas. Una cita falsa es el peor error posible.

FILAS A AUDITAR:
${rows.map((r, i) => `${i + 1}. [${r.label}] ${r.content.slice(0, 1200)}`).join('\n')}

<documentos_rectores>
${groundedContext}
</documentos_rectores>

Responde SOLO con JSON: {"filas":[{"fila":"<etiqueta exacta>","apoyado":true|false,"cita_textual":"…"}]}`

  try {
    const r = await callModelDetailed(prompt, {
      json: true,
      temperature: 0,
      maxOutputTokens: 4096,
      preferredModel: pickModel(1),
      deadline,
    })
    const parsed = JSON.parse(extractJson(r.text)) as { filas?: Array<{ fila?: string; apoyado?: boolean; cita_textual?: string }> }
    const flags: Array<{ rowLabel: string; reason: string }> = []
    for (const row of rows) {
      const hit = (parsed.filas || []).find((f) => normalizeForMatch(f.fila || '') === normalizeForMatch(row.label))
      const supported = !!hit && hit.apoyado === true && isQuoteSupported(hit.cita_textual || '', allContextNorm)
      if (!supported) {
        flags.push({
          rowLabel: row.label,
          reason: 'este contenido no pudo comprobarse con una cita literal de los documentos cargados; contrástalo con el documento rector antes de usarlo.',
        })
      }
    }
    return { flags, checked: rows.length, ok: true }
  } catch (err) {
    console.warn('[generator] Section 1 audit unavailable:', err instanceof Error ? err.message : err)
    return { flags: [], checked: 0, ok: false }
  }
}

/**
 * Main Generation Orchestrator.
 *  1. Plan the arc skeleton (JSON) — one small call.
 *  2. In parallel (bounded concurrency): Stage 1 (sections 0-1), N week-by-week expansions (section 2),
 *     Stage 2 (sections 4-7), Stage 3 (annexes).
 *  3. Section 3 is computed by code (exact percentages); Section 1 is audited with quote-grounding.
 *  4. Deterministic verification report.
 */
export async function generatePlanningDocument(
  params: GeneratePlanningParams
): Promise<GeneratedPlanningOutput> {
  const startedAt = Date.now()
  const deadline = startedAt + 270_000
  const total = parseEffectiveWeeks(params.semanasEfectivas)

  const docs = params.contextDocs.map((d) => ({
    tipo: d.tipo,
    filename: d.filename,
    content: sanitizeInputText(d.content, 400_000),
  }))
  const terms = buildQueryTerms([params.tema, params.area, params.grado, `periodo ${params.periodo}`])
  const ctxFull = buildGroundedContext(docs, 90_000, terms)
  const ctxMid = buildGroundedContext(docs, 40_000, terms)
  const ctxWeek = buildGroundedContext(docs, 28_000, terms)
  const allContextText = docs.map((d) => d.content).join('\n')
  const allContextNorm = normalizeForMatch(allContextText)

  console.log(`[generator] Planning arc skeleton for ${total} effective week(s)...`)
  let skeleton: ArcSkeleton
  try {
    const sr = await callModelDetailed(buildSkeletonPrompt(params, ctxFull, total), {
      json: true,
      temperature: 0.2,
      maxOutputTokens: 8192,
      preferredModel: pickModel(0),
      deadline,
    })
    skeleton = normalizeSkeleton(JSON.parse(extractJson(sr.text)), total, params.tema)
  } catch (err) {
    console.warn('[generator] Skeleton planning failed, using deterministic fallback:', err instanceof Error ? err.message : err)
    skeleton = normalizeSkeleton({}, total, params.tema)
  }
  console.log(`[generator] Skeleton ready in ${Date.now() - startedAt} ms. Launching stages and ${total} week expansions...`)

  const truncatedStages: string[] = []

  const stage1P = callModelDetailed(buildStage1Prompt(params, ctxFull), {
    maxOutputTokens: 16384,
    temperature: 0.2,
    preferredModel: pickModel(0),
    deadline,
  })
  const weekPs = skeleton.semanas.map((w, i) => generateWeekCell(params, ctxWeek, skeleton, w, i, deadline))
  const stage2P = callModelDetailed(buildStage2Prompt(params, ctxMid, skeleton), {
    maxOutputTokens: 16384,
    temperature: 0.25,
    preferredModel: pickModel(1),
    deadline,
  })
  const stage3P = callModelDetailed(buildStage3Prompt(params, ctxMid), {
    maxOutputTokens: 16384,
    temperature: 0.25,
    preferredModel: pickModel(2),
    deadline,
  })
  const auditP = stage1P
    .then((s1) => auditSection1(s1.text, ctxMid, allContextNorm, deadline))
    .catch(() => ({ flags: [] as Array<{ rowLabel: string; reason: string }>, checked: 0, ok: false }))

  const [s1, weekResults, s2, s3, audit] = await Promise.all([stage1P, Promise.all(weekPs), stage2P, stage3P, auditP])

  if (s1.truncated) truncatedStages.push('Identificación y referentes (Sección 1)')
  if (s2.truncated) truncatedStages.push('Pilares, rúbrica y cierre (Secciones 4-7)')
  if (s3.truncated) truncatedStages.push('Anexos evaluativos (Sección 8)')
  weekResults.forEach((r, i) => {
    if (r.truncated) truncatedStages.push(`Arco pedagógico · Semana ${i + 1}`)
  })

  console.log(`[generator] Stage 1: ${s1.text.length} chars · Stage 2: ${s2.text.length} chars · Stage 3: ${s3.text.length} chars`)
  console.log(`[generator] Weeks: ${weekResults.map((r) => r.cell.length).join(', ')} chars · audit flags: ${audit.flags.length}/${audit.checked}`)

  const weekCells: Record<number, string> = {}
  weekResults.forEach((r, i) => {
    weekCells[i + 1] = r.cell
  })

  const stage1Text = flagUnsupportedRows(trimToHeading(s1.text, /^#\s+Secuencia Did[aá]ctica/m), audit.flags)
  const section2 = buildArcTableMarkdown(skeleton, weekCells)
  const section3 = buildEvaluationPlanMarkdown(
    skeleton,
    params.semanasEfectivas || `${total} semanas efectivas de clase directa`
  )
  const stage2Text = trimToHeading(s2.text, /^##\s*4\./m)
  const stage3Text = trimToHeading(s3.text, /^##\s*8\./m)

  // Combine into the master Planning Book Markdown
  const fullText = [stage1Text, section2, section3, stage2Text, '---', stage3Text].join('\n\n')
  console.log(`[generator] Total Master Curriculum Length: ${fullText.length} chars in ${Math.round((Date.now() - startedAt) / 1000)}s`)

  // Rubrics tab: evaluation plan + pillars/rubric + annexes
  const rubricsMarkdown = [section3, stage2Text, '---', stage3Text].join('\n\n')

  // Cibercolegios block
  let cibercolegiosSnippet = ''
  const ciberMatch = fullText.match(/```(?:text|markdown)?\s*([\s\S]*?)\s*```/i)
  if (ciberMatch && ciberMatch[1].trim().length > 10) {
    cibercolegiosSnippet = ciberMatch[1].trim()
  } else {
    cibercolegiosSnippet = `NOMBRE (instrumento): Secuencia Didáctica - ${params.tema} · Grado: ${params.grado} · Docente: ${params.docente} · Rúbrica Menú de Desafíos: Bronze (4.0-4.5) · Silver (4.6-4.7) · Gold (4.8-5.0) · Sin categoría (1.0-3.9)`
  }

  const extraIssues: VerificationIssue[] = audit.flags.map((f) => ({
    severity: 'advertencia' as const,
    section: 'Referentes (auditoría)',
    message: `La fila "${f.rowLabel}" no pudo respaldarse con una cita literal de los documentos rectores.`,
  }))
  if (!audit.ok) {
    extraIssues.push({
      severity: 'info',
      section: 'Referentes (auditoría)',
      message: 'La auditoría automática de referentes no estuvo disponible en esta generación; verifica manualmente los datos oficiales.',
    })
  }

  const verification = verifyPlanningBook({
    markdown: fullText,
    effectiveWeeks: total,
    contextText: allContextText,
    tema: params.tema,
    area: params.area,
    pesos: skeleton.pesos,
    truncatedStages,
    extraIssues,
  })
  console.log(`[generator] Verification score: ${verification.score}/100 (${verification.issues.length} issue(s))`)

  const excelSpec = {
    docente: params.docente,
    area: params.area,
    grado: params.grado,
    periodo: String(params.periodo),
    semanas: params.semanas ? `${params.semanas} (${params.semanasEfectivas || `${total} semanas efectivas`})` : `${total} semanas`,
    semanasEfectivas: params.semanasEfectivas || `${total} semanas efectivas`,
    tema: params.tema,
    evidenciaPrincipal: `Evidencia principal: ${params.tema}`,
    actividades: [
      { nombre: 'Actividad 1 (SABER - Conceptos & Teoría)', pilar: 'SABER' as const, porcentaje: skeleton.pesos.SABER },
      { nombre: 'Actividad 2 (SABER HACER - Producto ACE)', pilar: 'SABER HACER' as const, porcentaje: skeleton.pesos['SABER HACER'] },
      { nombre: 'Actividad 3 (SABER SER - Autonomía & Metacognición)', pilar: 'SABER SER' as const, porcentaje: skeleton.pesos['SABER SER'] },
      { nombre: 'Actividad 4 (SABER CONVIVIR - Trabajo en Equipo)', pilar: 'SABER CONVIVIR' as const, porcentaje: skeleton.pesos['SABER CONVIVIR'] },
    ],
  }

  return {
    planningBookMarkdown: fullText,
    rubricsMarkdown,
    cibercolegiosSnippet,
    excelSpec,
    verification,
  }
}

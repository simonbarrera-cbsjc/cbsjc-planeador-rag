import 'server-only'
import { GoogleGenerativeAI } from '@google/generative-ai'
import type { Language, Periodo } from '@/types'

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

export function buildOfficialPrompt(params: GeneratePlanningParams): string {
  const {
    docente,
    area,
    grado,
    periodo,
    semanas,
    tema,
    additionalInstructions,
    contextDocs,
  } = params

  const safeDocente = sanitizeInputText(docente, 200)
  const safeArea = sanitizeInputText(area, 200)
  const safeGrado = sanitizeInputText(grado, 100)
  const safePeriodo = sanitizeInputText(String(periodo), 50)
  const safeSemanas = sanitizeInputText(semanas || '4 semanas (16 horas de clase — sesiones de 90 min)', 150)
  const safeTema = sanitizeInputText(tema, 300)
  const safeInstructions = sanitizeInputText(additionalInstructions, 3000)

  const formattedContext = contextDocs
    .map(
      (doc, i) =>
        `=== [DOCUMENTO RECTOR / FUENTE ${i + 1}: ${doc.tipo.toUpperCase()} (${doc.filename})] ===\n${sanitizeInputText(doc.content, 12000)}\n`
    )
    .join('\n')

  return `Eres el Diseñador Curricular y Asistente Pedagógico Oficial del Colegio Bilingüe San José Campestre (CBSJC).
Tu misión es generar la planeación curricular MAESTRA EXHAUSTIVA y COMPLETA (Secuencia Didáctica de extensión profesional, mínimo 18 páginas completas en formato impreso/Word, sin resúmenes, sin texto truncado ni marcadores de posición), bajo el formato oficial **SJB-RGA006 Planning Book (Secuencia Didáctica: Antes — Durante — Después · Subciclos 3 a 6)**.

FUNDAMENTO PEDAGÓGICO INSTITUCIONAL DEL CBSJC:
1. Ponderación fija inalterable de los 4 pilares: SABER (35%), SABER HACER (35%), SABER SER (20%), SABER CONVIVIR (10%).
2. Menú de Desafíos con 4 bandas de evaluación rigurosas:
   - Sin categoría (1.0 – 3.9): En proceso de consolidación / aprueba con debilidades.
   - Bronze (4.0 – 4.5): Aprendizaje esperado completo del grado.
   - Silver (4.6 – 4.7): Lo anterior, y además profundización y justificación extendida.
   - Gold (4.8 – 5.0): Lo anterior, y además excelencia, transferencia original y liderazgo ecológico/PRAE.
3. Arco pedagógico estructurado semana a semana y sesión a sesión:
   - ANTES (Conecta y reta): Rutinas See-Think-Wonder, indagación, presentación de metas en Tablero de Progreso Anexo A6 sin costo en la nota.
   - DURANTE (Explora, construye y aplica): Explicación conceptual, estaciones de trabajo, prácticas/laboratorios, modelación guiada y componente ACE bilingüe con núcleos lingüísticos y expresiones funcionales.
   - DESPUÉS (Evidencia, mejora, reflexiona y transfiere): Consolidación de productos, sustentación oral bilingüe, coevaluación Praise & Polish y metacognición.
4. TRES (3) INSTRUMENTOS DE EVALUACIÓN FINAL COMPLETOS Y DETALLADOS (ANEXOS EVALUATIVOS):
   - Anexo 1: Prueba Escrita de 10 ítems estructurados (Selección múltiple tipo ICFES, análisis de casos contextualizados, matching bilingüe A2, rotulación de diagramas y preguntas abiertas de argumentación) + Rúbrica Analítica de 4 criterios.
   - Anexo 2: Examen Práctico / Guía de Laboratorio de 4 Estaciones Rotativas (protocolos paso a paso, materiales, tareas experimentales y ficha técnica) + Rúbrica Analítica de 4 criterios.
   - Anexo 3: Guía de Sustentación Oral Bilingüe A2 (Scientific Pitch con guion paso a paso de apertura, desarrollo, cierre y defensa) + Rúbrica Analítica de 4 criterios.

DATOS DE LA SECUENCIA:
- Docente(s): ${safeDocente}
- Área / Asignatura: ${safeArea}
- Grado / Grupo: ${safeGrado}
- Período / Subciclo: ${safePeriodo}
- Semanas / Intervalo: ${safeSemanas}
- Tema o Pregunta de Sentido: ${safeTema}

${safeInstructions ? `<docente_instrucciones>\n${safeInstructions}\n</docente_instrucciones>` : ''}

<contexto_curricular>
${formattedContext || 'Utiliza los referentes oficiales del MEN, DBA de Colombia, estándares EBC y lineamientos pedagógicos del Colegio Bilingüe San José Campestre.'}
</contexto_curricular>

DESARROLLA EL DOCUMENTO ÍNTEGRO EN MARKDOWN CON LA MÁXIMA PROFUNDIDAD Y EXTENSIÓN, RESPETANDO EXACTAMENTE ESTA ESTRUCTURA:

# Secuencia Didáctica: Antes — Durante — Después · Subciclos 3 a 6
**Colegio Bilingüe San José Campestre**

| Identificación | Detalle |
|---|---|
| **Docente(s)** | ${safeDocente} |
| **Área / Asignatura** | ${safeArea} |
| **Grado / Grupo** | ${safeGrado} |
| **Período / Subciclo** | ${safePeriodo} (Año Lectivo 2026) |
| **Fecha(s) / Semanas** | ${safeSemanas} |

## 1. IDENTIFICACIÓN Y REFERENTES DE CALIDAD

| Referente Curricular | Contenido y Articulación Institucional |
|---|---|
| **Meta del subciclo y posición del grado** | (Detallar subciclo correspondiente, si inicia/desarrolla/consolida/verifica, y descripción amplia del perfil del estudiante al egresar del subciclo) |
| **Competencia disciplinar (Plan de Área)** | (Detallar competencias del Plan de Área: Uso comprensivo del conocimiento, Explicación de fenómenos, Indagación, etc.) |
| **Estándar Básico de Competencia (EBC)** | (3 estándares del MEN plenamente articulados) |
| **Derecho Básico de Aprendizaje (DBA)** | (DBA oficial completo del grado con su código y enunciado) |
| **Evidencias de aprendizaje (DBA)** | (Evidencia Central y 2 evidencias complementarias desglosadas) |
| **Componente evaluado por el ICFES** | (Componente evaluado: Entorno Vivo, Entorno Físico, Numérico-Variacional, Comunicación Escrita, etc.) |
| **Pregunta de sentido del período** | (Pregunta rectora en español y Driving Question en inglés para enfoque bilingüe) |
| **Aprendizaje esperado de la secuencia** | (Redacción exhaustiva del aprendizaje integrando saber, hacer y contexto) |
| **Evidencia de aprendizaje principal** | (Nombre y descripción completa del producto/capstone central de la secuencia) |
| **Componente ACE del período** | **Alcance:** ...<br>**Meta ACE:** En nivel A2/B1...<br>**Núcleo Lingüístico:** (Mínimo 10 términos disciplinares en inglés)<br>**Expresiones Funcionales:** (Mínimo 4 estructuras de oración completas) |
| **Instrumento · nombre de la nota en Cibercolegios** | (Nombre exacto para la plataforma con porcentajes de pilares) |
| **Proyecto integrador al que aporta** | (Articulación con PRAE Institucional SJB-PGA012 u otro proyecto transversal) |
| **Número de semanas e intervalo de fechas** | ${safeSemanas} |

## 2. ARCO PEDAGÓGICO DE LA SECUENCIA

### ANTES: Conecta y Reta (Semana 1)
- **Eje Temático:** ...
- **Can-Do Statement:** (Declaración 'I can...' bilingüe en primera persona).
- **Momento 1 - Warm-up / Pre-task:** (Rutina de pensamiento, situación retadora contextualizada en el campus campestre, publicación de la Rúbrica Menú de Desafíos y registro en Tablero de Progreso Anexo A6).
- **Momento 2 - Core Task:** (Indagación, diagnóstico sin costo en la nota, exploración inicial guiada).
- **Momento 3 - Wrap-up & Language Focus:** (Práctica oral guiada con sentence frames en inglés y Ticket de Salida).
- **Consignas Docentes:** (Pautas pedagógicas explícitas de mediación).
- **Ajustes DUA & PIAR:** (Estrategias concretas para estudiantes con TDAH y diversidad cognitiva).

### DURANTE: Aprende, Construye y Aplica (Semanas 2 y 3)
#### ■ SEMANA 2: Profundización Conceptual y Estaciones Prácticas
- **Eje Temático:** ...
- **Can-Do Statement:** ...
- **Momento 1 (Warm-up):** ...
- **Momento 2 (Core Task - Fase 1 Capstone):** (Trabajo en estaciones, laboratorios, modelación guiada, trabajo colaborativo).
- **Momento 3 (Wrap-up):** (Coevaluación intermedia y actualización del Tablero de Progreso).
- **Consignas Docentes:** ...
- **Ajustes DUA & PIAR:** ...

#### ■ SEMANA 3: Integración Disciplinar y Desarrollo de la Evidencia Principal
- **Eje Temático:** ...
- **Can-Do Statement:** ...
- **Momento 1 (Warm-up):** ...
- **Momento 2 (Core Task - Fase 2 Capstone):** (Construcción del producto central, diagramas de flujo, aplicación del recurso ACE bilingüe).
- **Momento 3 (Wrap-up):** ...
- **Consignas Docentes:** ...
- **Ajustes DUA & PIAR:** ...

### DESPUÉS: Evidencia, Mejora, Reflexiona y Transfiere (Semana 4)
- **Eje Temático:** ...
- **Can-Do Statement:** ...
- **Momento 1 (Warm-up):** (Preparación de stands / pitch drill de 30 segundos en inglés).
- **Momento 2 (Core Task):** (Ensamble final, entrega de evidencia completa, sustentación oral bilingüe ante pares y docente, coevaluación Praise & Polish).
- **Momento 3 (Wrap-up & Metacognición):** (Cierre reflexivo sobre la Driving Question, autoevaluación en Tablero de Progreso y retroalimentación que permite reentrega para mejorar).
- **Consignas Docentes:** ...
- **Ajustes DUA & PIAR:** ...

## 3. PLAN DE EVALUACIÓN CONTINUA DE LA SECUENCIA

| Actividad evaluativa | Semana · momento | Pilar(es) que valora | % dentro del pilar | Rúbrica específica (síntesis coherente con la global) |
|---|---|---|---|---|
| **1. Actividad Formativa Inicial** | Semana 1 (ANTES) | SABER (35%) / SABER HACER (35%) | SABER: 30%<br>HACER: 25% | ... |
| **2. Taller Práctico / Laboratorio de Profundización** | Semana 2 (DURANTE) | SABER (35%) / SABER HACER (35%) | SABER: 35%<br>HACER: 25% | ... |
| **3. Desarrollo y Modelado de la Evidencia Principal** | Semana 3 (DURANTE) | SABER (35%) / SABER HACER (35%) / SABER SER (20%) | SABER: 35%<br>HACER: 25%<br>SER: 50% | ... |
| **4. Producto Capstone Final + Sustentación Oral A2** | Semana 4 (DESPUÉS) | SABER HACER (35%) / SABER SER (20%) / SABER CONVIVIR (10%) | HACER: 25%<br>SER: 50%<br>CONVIVIR: 100% | ... |

*(Verificación: La suma de porcentajes dentro de cada pilar individual suma exactamente 100%).*

## 4. PILARES Y COMPETENCIAS INSTITUCIONALES EN ESTA SECUENCIA

| Pilar Institucional | Competencia Evaluada | Manifestación en la Evidencia Principal |
|---|---|---|
| **SABER (35%)** | ... | ... |
| **SABER HACER (35%)** | ... | ... |
| **SABER SER (20%)** | Autonomía, mentalidad de crecimiento, persistencia | ... |
| **SABER CONVIVIR (10%)** | Colaboración, trabajo en equipo, compromiso ecológico PRAE | ... |

## 5. RÚBRICA GLOBAL DE LA EVIDENCIA DE APRENDIZAJE · MENÚ DE DESAFÍOS

| Pilar · Competencia | Sin categoría (1.0 – 3.9) | Bronze (4.0 – 4.5) Esperado | Silver (4.6 – 4.7) Profundización | Gold (4.8 – 5.0) Excelencia |
|---|---|---|---|---|
| **SABER (35%)** | ... | ... | ... | ... |
| **SABER HACER (35%)** | ... | ... | ... | ... |
| **SABER SER (20%)** | ... | ... | ... | ... |
| **SABER CONVIVIR (10%)** | ... | ... | ... | ... |

## 6. BLOQUE DE TRASLADO A CIBERCOLEGIOS
\`\`\`text
NOMBRE (instrumento): ... (SJB-RGA006)
DESCRIPCIÓN: Pregunta de sentido: ... | DBA: ... | Evidencia principal: ... | Competencias por pilar: SABER (35%), SABER HACER (35%), SABER SER (20%), SABER CONVIVIR (10%) | Meta ACE: ... | Rúbrica: Menú de Desafíos adjunta en el recurso de la actividad | Bandas de valoración: Sin categoría (1.0 - 3.9) | Bronze (4.0 - 4.5) | Silver (4.6 - 4.7) | Gold (4.8 - 5.0).
\`\`\`

## 7. BITÁCORA DE LA SECUENCIA · SE DILIGENCIA AL CIERRE

| Aspecto Reflexivo | Registro del Docente |
|---|---|
| **Qué ocurrió frente a lo planeado** | [Espacio reservado para el registro reflexivo del docente al finalizar las 4 semanas: ajustes sobre la marcha, gestión de tiempos y adaptaciones]. |
| **Distribución de niveles del grupo** | [Registro cuantitativo: N.° estudiantes en Sin Categoría / Bronze / Silver / Gold]. |
| **Lectura del docente** | [Análisis de logros grupales, seguimiento PIAR/TDAH y acuerdos de ajuste pedagógico para la siguiente secuencia]. |

| ELABORÓ | REVISÓ | APROBÓ |
|---|---|---|
| _____________________________<br>${safeDocente}<br>${safeGrado} — Subciclo 4<br>Colegio Bilingüe San José Campestre | _____________________________ <br>Coordinación de Área<br>Comité Curricular y Pedagógico<br>Colegio Bilingüe San José Campestre | _____________________________ <br>Coordinación Académica General<br>Rectoría Institucional<br>Colegio Bilingüe San José Campestre |

---

## 8. ANEXO INSTITUCIONAL: TRES (3) EVALUACIONES FINALES COMPLETAS Y RÚBRICAS ANALÍTICAS

### EVALUACIÓN FINAL 1: PRUEBA ESCRITA Y ANÁLISIS COGNITIVO (SABER 35% / HACER 15%)
- **Nombre del Instrumento:** Prueba de Desempeño Escrito y Análisis Científico: '${safeTema}'
- **Evidencias Evaluadas:** (Evidencias DBA, Meta ACE, Aporte PRAE).
- **CUESTIONARIO COMPLETO (10 PREGUNTAS DETALLADAS):**
  1. (Selección Múltiple - ICFES con justificación conceptual)
  2. (Selección Múltiple con análisis de datos)
  3. (Análisis de Caso Contextualizado en el Campus de Tienda Nueva - PRAE)
  4. (Matching Bilingüe A2 de 5 términos con sus definiciones técnicas)
  5. (Sentence Completion A2 con banco de palabras disciplinares)
  6. (Diagramación y Rotulación técnica de esquemas en inglés)
  7. (Integración de Procesos y Explicación de Fenómenos)
  8. (Indagación Científica y Formulación de Hipótesis)
  9. (Comprensión de Lectura Bilingüe A2 - Texto científico breve y preguntas de inferencia)
  10. (Metacognición, Autocuidado y Compromiso Ético PRAE)

#### RÚBRICA ANALÍTICA — PRUEBA ESCRITA (MENÚ DE DESAFÍOS)
| Criterio / Dimensión | Sin Categoría (1.0 - 3.9) | Bronze (4.0 - 4.5) Esperado | Silver (4.6 - 4.7) Profundización | Gold (4.8 - 5.0) Excelencia |
|---|---|---|---|---|
| **Comprensión Conceptual Disciplinar (SABER)** | ... | ... | ... | ... |
| **Aplicación y Relación de Conceptos (SABER HACER)** | ... | ... | ... | ... |
| **Precisión Lingüística Bilingüe A2 (Componente ACE)** | ... | ... | ... | ... |
| **Reflexión, Autonomía y PRAE (SABER SER)** | ... | ... | ... | ... |

### EVALUACIÓN FINAL 2: EXAMEN PRÁCTICO Y ESTACIONES DE LABORATORIO (SABER HACER 45% / SER 20%)
- **Nombre del Instrumento:** Examen Práctico de Desempeño y Habilidades Experimentales: '${safeTema}'
- **Evidencias Evaluadas:** ...
- **PROTOCOLO DE 4 ESTACIONES PRÁCTICAS ROTATIVAS (15 min por estación):**
  - **ESTACIÓN 1:** (Montaje experimental, manipulación de instrumentos y toma de datos).
  - **ESTACIÓN 2:** (Identificación a ciegas o diagnóstico de muestras).
  - **ESTACIÓN 3:** (Modelado táctil / resolución de reto práctico con sustentación oral breve en inglés A2).
  - **ESTACIÓN 4:** (Bitácora de resultados, bioseguridad, orden del puesto y entrega técnica).

#### RÚBRICA ANALÍTICA — PRÁCTICA EXPERIMENTAL (MENÚ DE DESAFÍOS)
| Criterio / Dimensión | Sin Categoría (1.0 - 3.9) | Bronze (4.0 - 4.5) Esperado | Silver (4.6 - 4.7) Profundización | Gold (4.8 - 5.0) Excelencia |
|---|---|---|---|---|
| **Destreza Procedimental y Manipulación (HACER)** | ... | ... | ... | ... |
| **Registro Técnico y Rotulación Bilingüe (HACER)** | ... | ... | ... | ... |
| **Diagnóstico y Modelación Conceptual (SABER)** | ... | ... | ... | ... |
| **Bioseguridad, Orden y Autonomía (SER)** | ... | ... | ... | ... |

### EVALUACIÓN FINAL 3: SUSTENTACIÓN ORAL Y DEFENSA CAPSTONE (SABER HACER 45% / SER 20% / CONVIVIR 10%)
- **Nombre del Instrumento:** Sustentación Oral Bilingüe (A2 Scientific Pitch): '${safeTema}'
- **Evidencias Evaluadas:** ...
- **GUÍA Y ESTRUCTURA DE SUSTENTACIÓN ORAL EN INGLÉS (PITCH DE 3 A 5 MINUTOS):**
  1. Apertura y Presentación del Producto (30 seg con guion bilingüe de referencia).
  2. Explicación de Fases Iniciales y Fundamentos (1.5 min).
  3. Demostración de Resultados, Modelos y Conexiones (1.5 min).
  4. Impacto Ambiental y Compromiso PRAE (30 seg).
  5. Defensa y Respuesta a Preguntas del Panel Evaluador (1 min).

#### RÚBRICA ANALÍTICA — SUSTENTACIÓN ORAL CAPSTONE (MENÚ DE DESAFÍOS)
| Criterio / Dimensión | Sin Categoría (1.0 - 3.9) | Bronze (4.0 - 4.5) Esperado | Silver (4.6 - 4.7) Profundización | Gold (4.8 - 5.0) Excelencia |
|---|---|---|---|---|
| **Calidad y Rigor de la Evidencia Principal (HACER)** | ... | ... | ... | ... |
| **Fluidez y Precisión Oral en Inglés A2 (ACE)** | ... | ... | ... | ... |
| **Solvencia Argumentativa ante Preguntas (SABER)** | ... | ... | ... | ... |
| **Responsabilidad, Coevaluación y PRAE (SER/CONVIVIR)** | ... | ... | ... | ... |
`
}

/**
 * Ordered fallback candidate models with high token output capacity.
 */
export const CANDIDATE_MODELS = [
  'gemini-3.7-flash',
  'gemini-3.5-flash',
  'gemini-3.6-flash',
  'gemini-flash-latest',
  'gemini-3.1-flash-lite',
] as const

const MAX_RETRIES_PER_MODEL = 2
const BASE_RETRY_DELAY_MS = 1000

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function isTransientError(errorMessage: string): boolean {
  return (
    errorMessage.includes('503') ||
    errorMessage.includes('UNAVAILABLE') ||
    errorMessage.includes('high demand') ||
    errorMessage.includes('overloaded') ||
    errorMessage.includes('429') ||
    errorMessage.includes('RESOURCE_EXHAUSTED') ||
    errorMessage.includes('quota') ||
    errorMessage.includes('rate limit') ||
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

export async function generatePlanningDocument(
  params: GeneratePlanningParams
): Promise<GeneratedPlanningOutput> {
  const genAI = getGenAIClient()
  const prompt = buildOfficialPrompt(params)

  const modelAttemptsLog: Array<{ model: string; error?: string; status: 'success' | 'failed' | 'retried' }> = []
  let fullText = ''
  let lastError: Error | null = null

  for (const modelName of CANDIDATE_MODELS) {
    console.log(`[generator] Evaluating candidate model for exhaustive planning: ${modelName}...`)

    let modelSucceeded = false

    for (let attempt = 1; attempt <= MAX_RETRIES_PER_MODEL + 1; attempt++) {
      try {
        const model = genAI.getGenerativeModel({
          model: modelName,
          generationConfig: {
            temperature: 0.35,
            topP: 0.95,
            maxOutputTokens: 16384, // Exhaustive 18+ page generation
          },
        })

        const result = await model.generateContent(prompt)
        const response = await result.response
        const text = response.text()

        if (text && text.trim().length > 0) {
          fullText = text
          modelSucceeded = true
          modelAttemptsLog.push({ model: modelName, status: 'success' })
          console.log(`[generator] Successfully generated exhaustive curriculum using ${modelName} on attempt ${attempt} (${text.length} chars)`)
          break
        } else {
          throw new Error('Respuesta de generación vacía')
        }
      } catch (err: unknown) {
        const rawMessage = err instanceof Error ? err.message : String(err)
        lastError = err instanceof Error ? err : new Error(rawMessage)

        console.warn(
          `[generator] Model ${modelName} attempt ${attempt}/${MAX_RETRIES_PER_MODEL + 1} failed: ${rawMessage}`
        )

        if (isAuthError(rawMessage)) {
          throw new Error(
            `Error de autenticación con Google Gemini: La clave de API no es válida o no tiene permisos. Detalle: ${rawMessage}`
          )
        }

        if (isNotFoundError(rawMessage)) {
          console.warn(`[generator] Model ${modelName} is not available (404/deprecated). Switching to next candidate...`)
          modelAttemptsLog.push({ model: modelName, error: `404 Not Found / Deprecated: ${rawMessage}`, status: 'failed' })
          break
        }

        if (isTransientError(rawMessage) && attempt <= MAX_RETRIES_PER_MODEL) {
          const jitter = Math.floor(Math.random() * 500)
          const backoffDelay = Math.min(BASE_RETRY_DELAY_MS * Math.pow(2, attempt - 1) + jitter, 4000)
          console.log(`[generator] Retrying ${modelName} in ${backoffDelay}ms due to transient error...`)
          modelAttemptsLog.push({ model: modelName, error: `Attempt ${attempt}: ${rawMessage}`, status: 'retried' })
          await delay(backoffDelay)
          continue
        }

        modelAttemptsLog.push({ model: modelName, error: rawMessage, status: 'failed' })
        break
      }
    }

    if (modelSucceeded && fullText.trim().length > 0) {
      break
    }
  }

  if (!fullText || fullText.trim().length === 0) {
    const errorSummary = modelAttemptsLog
      .map((l) => `• ${l.model}: ${l.error || l.status}`)
      .join('\n')

    console.error(`[generator] All candidate models failed. Summary:\n${errorSummary}`)

    const isOverloaded = modelAttemptsLog.some((l) => l.error && isTransientError(l.error))
    if (isOverloaded) {
      throw new Error(
        `Los servidores de Google Gemini presentan alta demanda o límite de tasa en este momento. Se intentaron los modelos (${CANDIDATE_MODELS.join(
          ', '
        )}). Por favor espera unos momentos e intenta de nuevo.`
      )
    }

    throw new Error(
      `No se pudo generar la secuencia pedagógica con ningún modelo disponible (${CANDIDATE_MODELS.join(
        ', '
      )}). Último error: ${lastError?.message || 'Sin respuesta del proveedor de IA'}`
    )
  }

  try {
    // Extract Rubrics Section (Section 5 and/or Anexos 8)
    let rubricsMarkdown = ''
    let cibercolegiosSnippet = ''

    const rubricsSectionMatch = fullText.match(/(?:##\s*5\.?|###\s*5\.?|#\s*5\.?)\s*R[UÚ]BRICA[\s\S]*?(?=(?:##\s*6\.?|###\s*6\.?|#\s*6\.?)\s*BLOQUE|$)/i)
    const annexesRubricMatch = fullText.match(/(?:##\s*8\.?|###\s*8\.?|#\s*8\.?)\s*ANEXO[\s\S]*$/i)

    if (rubricsSectionMatch || annexesRubricMatch) {
      rubricsMarkdown = [rubricsSectionMatch?.[0] || '', annexesRubricMatch?.[0] || ''].filter(Boolean).join('\n\n---\n\n')
    } else {
      rubricsMarkdown = fullText
    }

    const ciberMatch = fullText.match(/```(?:text|markdown)?\s*([\s\S]*?)\s*```/i)
    if (ciberMatch && ciberMatch[1].trim().length > 10) {
      cibercolegiosSnippet = ciberMatch[1].trim()
    } else {
      cibercolegiosSnippet = `NOMBRE (instrumento): Secuencia Didáctica - ${params.tema} · Grado: ${params.grado} · Docente: ${params.docente} · Rúbrica Menú de Desafíos: Bronze (4.0-4.5) · Silver (4.6-4.7) · Gold (4.8-5.0) · Sin categoría (1.0-3.9)`
    }

    const excelSpec = {
      docente: params.docente,
      area: params.area,
      grado: params.grado,
      periodo: String(params.periodo),
      semanas: params.semanas || '4 semanas',
      tema: params.tema,
      evidenciaPrincipal: `Evidencia principal: ${params.tema}`,
      actividades: [
        { nombre: 'Actividad 1 (SABER - Conceptos & Teoría)', pilar: 'SABER' as const, porcentaje: 35 },
        { nombre: 'Actividad 2 (SABER HACER - Producto ACE)', pilar: 'SABER HACER' as const, porcentaje: 35 },
        { nombre: 'Actividad 3 (SABER SER - Autonomía & Metacognición)', pilar: 'SABER SER' as const, porcentaje: 20 },
        { nombre: 'Actividad 4 (SABER CONVIVIR - Trabajo en Equipo)', pilar: 'SABER CONVIVIR' as const, porcentaje: 10 },
      ],
    }

    return {
      planningBookMarkdown: fullText,
      rubricsMarkdown,
      cibercolegiosSnippet,
      excelSpec,
    }
  } catch (error) {
    console.error('[generator] Error processing generated output:', error)
    throw new Error(
      `Error en el procesamiento del resultado generado: ${
        error instanceof Error ? error.message : String(error)
      }`
    )
  }
}

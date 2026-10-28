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
 */
export const CANDIDATE_MODELS = [
  'gemini-3.5-flash-lite',
  'gemini-3.1-flash-lite-preview',
  'gemini-3.6-flash',
  'gemini-3.5-flash',
  'gemini-3.8-flash',
  'gemini-3.7-flash',
] as const

const MAX_RETRIES_PER_MODEL = 2
const BASE_RETRY_DELAY_MS = 1000

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function isTransientError(errorMessage: string): boolean {
  // If the model reached daily quota limit, do NOT retry this model; jump immediately to the next candidate model
  if (
    errorMessage.includes('per day limit exceeded') ||
    errorMessage.includes('RequestsPerDay') ||
    errorMessage.includes('Please retry in')
  ) {
    return false
  }

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

const MAX_CONCURRENT_CALLS = 4
const PER_CALL_TIMEOUT_MS = 100_000
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
| **Competencias Fijas (Plan de Área / SIAP)** | (Detalle exhaustivo de las competencias fijas obligatorias del área y grado según el Plan de Área y SIAP institucional: 1. Uso comprensivo del conocimiento disciplinar/científico; 2. Explicación de fenómenos y procesos; 3. Indagación guiada con recolección de evidencias). |
| **Competencias Electivas (Profundización / Énfasis)** | (Detalle exhaustivo de las competencias electivas de profundización, articulación interdisciplinar o énfasis transversal seleccionadas por el docente a partir de los documentos rectores y adaptadas al grupo). |
| **Estándar Básico de Competencia (EBC)** | (3 estándares oficiales del MEN plenamente citados y articulados al grado). |
| **Derecho Básico de Aprendizaje (DBA)** | (Código oficial DBA y enunciado curricular completo del Ministerio de Educación Nacional). |
| **Evidencias de aprendizaje (DBA)** | (Redactar detalladamente: Evidencia 1 Central de la Secuencia, Evidencia Complementaria 2, y Evidencia Complementaria 3 multimodal bilingüe). |
| **Componente evaluado por el ICFES** | (Componente de prueba de Estado: ej. Entorno Vivo / Entorno Físico / Procesos Biológicos y Homeostasis). |
| **Pregunta de sentido del período** | (Pregunta rectora institucional en español y Driving Question completa en inglés para el enfoque bilingüe). |
| **Aprendizaje esperado de la secuencia** | (Redacción exhaustiva del aprendizaje esperado integrando dimensiones cognitiva, procedimental, contextual y comunicativa en inglés A2). |
| **Evidencia de aprendizaje principal** | (Nombre técnico y descripción detallada del producto o proyecto Capstone central de la secuencia). |
| **Componente ACE del período** | **Alcance:** Aplicación disciplinar en el área.<br>**Meta ACE:** En nivel A2/B1, describe y sustenta oralmente en inglés...<br>**Núcleo Lingüístico:** (Mínimo 15 términos disciplinares en inglés con traducción).<br>**Expresiones Funcionales:** (Mínimo 5 estructuras de oración completas para producción oral y escrita). |
| **Instrumento · nombre de la nota en Cibercolegios** | (Nombre exacto del instrumento para la planilla con porcentajes de pilares y rúbrica Menú de Desafíos). |
| **Proyecto integrador al que aporta** | (Articulación exhaustiva con el Proyecto Transversal PRAE Institucional SJB-PGA012 'Biodiversidad en Tienda Nueva: conocer para conservar' y aporte concreto de la secuencia). |
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
 * Stage 3 Prompt: 3 Evaluaciones Finales Completas (10 preguntas, 4 estaciones lab, pitch A2) + Rúbricas Analíticas
 */
function buildStage3Prompt(params: GeneratePlanningParams, formattedContext: string): string {
  const { docente, area, grado, periodo, semanas, tema } = params
  const safeDocente = sanitizeInputText(docente, 200)
  const safeArea = sanitizeInputText(area, 200)
  const safeGrado = sanitizeInputText(grado, 100)
  const safePeriodo = sanitizeInputText(String(periodo), 50)
  const safeTema = sanitizeInputText(tema, 300)

  return `Eres el Diseñador Curricular y Asistente Pedagógico Oficial del Colegio Bilingüe San José Campestre (CBSJC).
Tu misión es generar la **ETAPA 3** (ANEXOS EVALUATIVOS COMPLETOS) bajo el formato oficial **SJB-RGA006 Planning Book**.
Debes producir una redacción EXHAUSTIVA, EXTENSA, PROFUNDA Y COMPLETA PALABRA POR PALABRA (mínimo 22.000 a 30.000 caracteres solo para esta sección de evaluaciones).

REGLAS DE OBLIGATORIEDAD ABSOLUTA:
1. CADA PREGUNTA DE LA 1 A LA 10 DEBE ESTAR ESCRITA COMPLETA Y DETALLADA PALABRA POR PALABRA (sin abreviaciones, sin elipsis '...', sin omitir opciones A, B, C, D ni claves de respuesta).
2. EL PROTOCOLO DE LAS 4 ESTACIONES DE LABORATORIO DEBE DESCRIBIR PROCEDIMIENTOS, MATERIALES, FICHAS DE REGISTRO A ESCALA Y BIOMODELADO EN DETALLE.
3. ESTÁ TOTALMENTE PROHIBIDO EL USO DE DIAGRAMAS ASCII ART, BLOQUES DE CÓDIGO CON '+---+' O DIBUJOS DE TEXTO MONOSPACIO PARA EXPLICAR LAS ESTACIONES. Debes usar tablas Markdown formales o texto narrativo estructurado con viñetas.
4. EL GUION DE SUSTENTACIÓN ORAL EN INGLÉS A2 DEBE TENER LOS 5 TEXTOS COMPLETOS EN INGLÉS (Apertura, Micro, Macro, PRAE y Defensa).
5. CADA EVALUACIÓN DEBE LLEVAR SU TABLA DE FICHA TÉCNICA Y SU TABLA DE RÚBRICA ANALÍTICA DE 5 COLUMNAS (| Criterio / Dimensión | Sin Categoría (1.0 - 3.9) | Bronze (4.0 - 4.5) Esperado | Silver (4.6 - 4.7) Profundización | Gold (4.8 - 5.0) Excelencia |).

DATOS DE LA SECUENCIA:
- Docente: ${safeDocente}
- Asignatura: ${safeArea}
- Grado: ${safeGrado}
- Período: ${safePeriodo}
- Tema: ${safeTema}

${GROUNDING_RULES}

Las preguntas de las evaluaciones deben evaluar EXCLUSIVAMENTE contenidos del tema y de los referentes del contexto; toda clave de respuesta debe ser correcta y verificable. Empieza directamente con el encabezado "## 8." sin introducciones.

<contexto_curricular>
${formattedContext || 'Utiliza únicamente referentes generales del MEN.'}
</contexto_curricular>

GENERA EXACTAMENTE ESTE BLOQUE EN MARKDOWN:

## 8. ANEXO INSTITUCIONAL: TRES (3) EVALUACIONES FINALES Y RÚBRICAS ANALÍTICAS

### EVALUACIÓN FINAL 1: PRUEBA ESCRITA Y ANÁLISIS COGNITIVO (SABER 35% / HACER 15%)

| Campo Institucional | Detalle de la Evaluación Escrita |
|---|---|
| **Nombre del Instrumento** | Prueba de Desempeño Escrito y Análisis Científico: '${safeTema}' |
| **Evidencias Evaluadas** | Evidencia 1 Central (DBA), Evidencia 2 Relación estructura-función, Meta ACE Bilingüe A2, y Aporte PRAE Tienda Nueva. |
| **Dimensiones SIEE y Ponderación** | SABER (35% - Comprensión y argumentación) + SABER HACER (15% - Registro y aplicación bilingüe). |
| **Tiempo de Aplicación** | 60 minutos (Sesión individual). |
| **Indicaciones Generales** | Lee atentamente cada enunciado. Responde con claridad, justifica tus respuestas en las preguntas conceptuales y utiliza el vocabulario técnico en inglés en las secciones bilingües. |

#### CUESTIONARIO COMPLETO DE LA PRUEBA ESCRITA (10 PREGUNTAS DETALLADAS PALABRA POR PALABRA):

1. **(Selección Múltiple - Tipo ICFES con justificación conceptual):**
   (Redactar un enunciado completo y riguroso contextualizado en el tema, con 4 opciones completas A, B, C, D y un espacio de justificación: 'Justifica brevemente tu respuesta').
2. **(Selección Múltiple - Análisis de datos o procesos biológicos/físicos):**
   (Redactar un enunciado con análisis funcional o fisiológico, con 4 opciones completas A, B, C, D).
3. **(Análisis de Caso Contextualizado en el Campus de Tienda Nueva - PRAE):**
   (Redactar un caso completo sobre cómo las especies o fenómenos del campus campestre de Tienda Nueva responden a factores ambientales y formular 2 preguntas abiertas de análisis).
4. **(Matching Bilingüe A2):**
   (Presentar 5 términos disciplinares en inglés emparejados con 5 definiciones técnicas completas en inglés A2).
5. **(Sentence Completion A2 con Banco de Palabras):**
   (Presentar un párrafo conceptual en inglés con 5 espacios en blanco y su respectivo word bank disciplinar: [palabra1, palabra2, palabra3, palabra4, palabra5]).
6. **(Diagramación y Rotulación Técnica en Inglés):**
   (Instrucción precisa para dibujar/rotular 6 estructuras o partes clave utilizando su terminología técnica en inglés).
7. **(Integración Sistémica y Explicación de Fenómenos):**
   (Pregunta abierta de desarrollo amplio donde el estudiante describe el recorrido o interacción entre componentes de un sistema completo).
8. **(Indagación Científica y Formulación de Hipótesis):**
   (Situación problemática experimental donde el estudiante formula una hipótesis científica explicativa ante una alteración de variables).
9. **(Comprensión de Lectura Científica Bilingüe A2 - Contexto Ambiental PRAE):**
   (Texto científico de 80-100 palabras en inglés sobre el tema y 2 preguntas de comprensión e inferencia en inglés A2).
10. **(Metacognición, Autocuidado y Compromiso Ético - SABER SER):**
    (Pregunta reflexiva donde el estudiante formula 2 decisiones personales de autocuidado diario y 1 acción concreta para el cuidado ambiental en el colegio).

#### RÚBRICA ANALÍTICA — PRUEBA ESCRITA (MENÚ DE DESAFÍOS)

| Criterio / Dimensión | Sin Categoría (1.0 - 3.9) | Bronze (4.0 - 4.5) Esperado | Silver (4.6 - 4.7) Profundización | Gold (4.8 - 5.0) Excelencia |
|---|---|---|---|---|
| **Comprensión Conceptual Disciplinar (SABER)** | Identifica con imprecisiones conceptos clave o comete errores al diferenciar procesos básicos. | Explica con precisión los conceptos y jerarquías fundamentales respondiendo correctamente los ítems disciplinares. | Lo anterior, y además justifica con rigor técnico la relación entre estructuras y funciones. | Lo anterior, y además integra análisis sistémico avanzado y formula hipótesis biológicas/disciplinares impecables. |
| **Aplicación y Relación de Conceptos (SABER HACER)** | Dificultad para resolver situaciones problema o esquemas de integración sistémica. | Resuelve problemas cotidianos y diagramas aplicando correctamente los principios estudiados. | Lo anterior, y además analiza casos complejos contextualizados en el campus con fundamentación sólida. | Lo anterior, y además propone modelos explicativos innovadores y soluciones contextualizadas al territorio. |
| **Precisión Lingüística Bilingüe A2 (Componente ACE)** | Omite términos en inglés o presenta errores frecuentes en matching y completación. | Completa correctamente los ítems en inglés A2 utilizando el banco de palabras y rotulación técnica. | Lo anterior, y además responde con oraciones completas y vocabulario disciplinar preciso en inglés. | Lo anterior, y además demuestra comprensión de lectura superior y redacción bilingüe fluida sin errores. |
| **Reflexión, Autonomía y PRAE (SABER SER)** | No formula compromisos de autocuidado o muestra respuestas superficiales. | Formula decisiones de autocuidado diario y reconoce la importancia de conservar la biodiversidad escolar. | Lo anterior, y además argumenta con claridad el impacto de sus hábitos en su salud y entorno. | Lo anterior, y además asume un compromiso ético activo y ejemplar con el observatorio ecológico escolar. |

---

### EVALUACIÓN FINAL 2: EXAMEN PRÁCTICO Y ESTACIONES DE LABORATORIO (SABER HACER 45% / SER 20%)

| Campo Institucional | Detalle de la Evaluación de Laboratorio |
|---|---|
| **Nombre del Instrumento** | Examen Práctico de Desempeño y Habilidades Experimentales: '${safeTema}' |
| **Evidencias Evaluadas** | Destrezas de manipulación instrumental, registro histológico/técnico a escala, diagnóstico conceptual a ciegas y bioseguridad. |
| **Dimensiones SIEE y Ponderación** | SABER HACER (45% - Procedimientos y registro) + SABER SER (20% - Autonomía y bioseguridad) + SABER (20% - Diagnóstico). |
| **Duración y Dinámica** | 60 minutos en total (4 Estaciones Rotativas de 15 minutos cada una, trabajo individual o en parejas). |
| **Normas de Bioseguridad** | Uso obligatorio de bata de laboratorio, manipulación responsable de reactivos y microscopios, y entrega del puesto limpio. |

#### PROTOCOLO COMPLETO DE LAS 4 ESTACIONES PRÁCTICAS ROTATIVAS (15 MINUTOS POR ESTACIÓN):

- **ESTACIÓN 1: Montaje Experimental y Enfoque Instrumental (Técnica y Manipulación):**
  - *Materiales y Equipos:* (Detallar microscopios/instrumentos, portaobjetos, reactivos/tinciones y muestras biológicas o físicas).
  - *Procedimiento y Tarea del Estudiante:* (Paso a paso exacto de lo que hace el estudiante de forma autónoma).
  - *Ficha de Registro:* (Instrucciones exactas de lo que dibuja o anota a escala, incluyendo rotulación bilingüe en inglés A2).

- **ESTACIÓN 2: Diagnóstico e Identificación a Ciegas (Mystery Sample Diagnosis):**
  - *Materiales y Equipos:* (3 muestras rotuladas Muestra X, Muestra Y, Muestra Z).
  - *Procedimiento y Tarea del Estudiante:* (Observación comparativa y deducción técnica del tipo de muestra/tejido).
  - *Ficha de Registro:* (Tabla comparativa donde registra identificación, origen biológico y justificación técnica en 3 líneas).

- **ESTACIÓN 3: Modelado Táctil 'Structure - Function Challenge' y Micro-Pitch Oral en Inglés A2:**
  - *Materiales y Equipos:* (Materiales de modelado rápido, tarjetas guía y temporizador).
  - *Procedimiento y Tarea del Estudiante:* (Modelado tridimensional en 10 minutos y micro-sustentación oral de 1 minuto ante el docente en inglés A2).
  - *Guion Oral en Inglés A2:* (Estructura exacta que debe decir el estudiante: 'This structure is shaped like... because its main function is to...').

- **ESTACIÓN 4: Bitácora de Resultados, Bioseguridad y Orden del Puesto:**
  - *Materiales y Equipos:* (Papel de arroz, soluciones limpiadoras, contenedores de desechos y ficha técnica consolidada).
  - *Procedimiento y Tarea del Estudiante:* (Consolidación de datos, protocolo de limpieza de lentes/materiales, desconexión segura y verificación de orden).
  - *Ficha de Registro:* (Checklist de bioseguridad y entrega formal de la bitácora técnica al docente).

#### RÚBRICA ANALÍTICA — PRÁCTICA DE LABORATORIO (MENÚ DE DESAFÍOS)

| Criterio / Dimensión | Sin Categoría (1.0 - 3.9) | Bronze (4.0 - 4.5) Esperado | Silver (4.6 - 4.7) Profundización | Gold (4.8 - 5.0) Excelencia |
|---|---|---|---|---|
| **Técnica Instrumental y Manipulación (HACER)** | Requiere asistencia continua para preparar montajes o manipular equipos; genera muestras defectuosas. | Prepara montajes de forma autónoma, enfoca con nitidez y cuida los equipos e instrumentos adecuadamente. | Lo anterior, y además ajusta parámetros finos (diafragma/luz/enfoque) para maximizar la calidad del ensayo. | Lo anterior, y además demuestra destreza técnica impecable asistiendo a sus compañeros con liderazgo pedagógico. |
| **Registro Técnico y Rotulación Bilingüe (HACER)** | Dibujos imprecisos; omite escalas o rotulación básica en inglés A2. | Registra esquemas proporcionales a escala, rotulando correctamente en inglés 4 o más elementos clave. | Lo anterior, y además incluye aumentos, escalas precisas y notas morfológicas explicativas detalladas. | Lo anterior, y además elabora registros de calidad científica editorial con descripciones exhaustivas en inglés. |
| **Diagnóstico y Modelado Estructura-Función (SABER)** | Identifica erróneamente las muestras o no justifica la relación entre estructura y función. | Identifica correctamente las muestras misteriosas y explica con claridad su función en el organismo o sistema. | Lo anterior, y además modela tridimensionalmente y sustenta oralmente en inglés A2 con fluidez. | Lo anterior, y además compara las adaptaciones observadas con las condiciones ecológicas del campus CBSJC. |
| **Bioseguridad, Autonomía y Orden (SER)** | Incumple normas de bioseguridad o deja su estación desordenada y con material sucio. | Cumple las normas de bioseguridad, maneja reactivos con responsabilidad y entrega su estación limpia. | Lo anterior, y además demuestra excelente gestión del tiempo completando las estaciones antes del límite. | Lo anterior, y además lidera el protocolo de verificación y cierre del laboratorio con autonomía ejemplar. |

---

### EVALUACIÓN FINAL 3: SUSTENTACIÓN ORAL Y DEFENSA CAPSTONE (SABER HACER 45% / SER 20% / CONVIVIR 10%)

| Campo Institucional | Detalle de la Sustentación Oral |
|---|---|
| **Nombre del Instrumento** | Sustentación Oral Bilingüe (A2 Scientific Pitch): '${safeTema}' |
| **Evidencias Evaluadas** | Dominio conceptual del producto Capstone, fluidez y pronunciación en inglés A2, solvencia argumentativa ante preguntas y coevaluación. |
| **Dimensiones SIEE y Ponderación** | SABER HACER (45% - Producto y expresión oral) + SABER SER (20% - Seguridad y autonomía) + SABER CONVIVIR (10% - Respeto y coevaluación). |
| **Dinámica de la Evaluación** | Feria Científica en Stands: Presentación de 3 a 5 minutos ante panel evaluador (docente y pares), seguida de 2 preguntas de defensa. |

#### GUÍA Y GUION DE SUSTENTACIÓN ORAL EN INGLÉS (A2 SCIENTIFIC PITCH — 5 PASOS TEXTUALES):

1. **APERTURA Y PRESENTACIÓN DEL PROYECTO (30 segundos):**
   - *Guion en Inglés de Referencia:* "Good morning teachers and classmates. Welcome to my presentation. Today I will explain the biological architecture and vital functions of [Species / Subject], an important component of our campus ecosystem in Tienda Nueva."
2. **DESGLOSE DE NIVELES MICRO / FUNDAMENTOS CONCEPTUALES (1.5 minutos):**
   - *Guion en Inglés de Referencia:* "At the microscopic level, this organism is built of specialized cells such as [cell types]. These cells have unique structures that allow them to perform vital tasks. When grouped together, they form [tissue types], whose main function is to [function in A2 English]."
3. **DESGLOSE DE NIVELES MACRO / INTEGRACIÓN SISTÉMICA (1.5 minutos):**
   - *Guion en Inglés de Referencia:* "These tissues organize into organs like [organs], which work together in complex organ systems. For example, the transport system interacts directly with the energy acquisition system to supply every single cell with essential nutrients."
4. **IMPACTO AMBIENTAL Y COMPROMISO PRAE (30 segundos):**
   - *Guion en Inglés de Referencia:* "Human activities and environmental degradation directly threaten these biological structures in Tienda Nueva. My active commitment for our School Biodiversity Observatory is to protect local habitats and promote environmental stewardship. Thank you for your attention."
5. **DEFENSA Y RESPUESTA ANTE PREGUNTAS DEL PANEL (1 minuto):**
   - *Dinámica:* El estudiante responde 2 preguntas de profundización formuladas por el evaluador en inglés o español sobre causalidad, función y adaptaciones biológicas.

#### RÚBRICA ANALÍTICA — SUSTENTACIÓN ORAL CAPSTONE (MENÚ DE DESAFÍOS)

| Criterio / Dimensión | Sin Categoría (1.0 - 3.9) | Bronze (4.0 - 4.5) Esperado | Silver (4.6 - 4.7) Profundización | Gold (4.8 - 5.0) Excelencia |
|---|---|---|---|---|
| **Calidad y Rigor del Producto Capstone (HACER)** | El producto presenta niveles incompletos, errores conceptuales o acabado deficiente. | Elabora el producto completo con todos los niveles requeridos, rotulación en inglés y organización visual adecuada. | Lo anterior, y además incorpora elementos tridimensionales creativos y acabados de calidad técnica superior. | Lo anterior, y además elabora una pieza de divulgación científica sobresaliente digna del repositorio institucional. |
| **Fluidez y Precisión Oral en Inglés A2 (Componente ACE)** | Dificultad marcada para comunicarse en inglés; lectura total de notas o uso predominante de español. | Expone con fluidez básica en nivel A2 siguiendo el guion estructurado, con pronunciación clara y vocabulario técnico. | Lo anterior, y además expone con notable naturalidad, entonación adecuada y sin dependencia de notas escritas. | Lo anterior, y además demuestra dominio comunicativo excepcional, interactuando en inglés con espontaneidad y precisión. |
| **Solvencia Argumentativa ante Preguntas (SABER)** | No responde las preguntas de indagación o brinda explicaciones contradictorias. | Responde satisfactoriamente las preguntas del panel explicando con claridad los procesos y funciones clave. | Lo anterior, y además fundamenta sus respuestas articulando ejemplos reales observados en el campus de Tienda Nueva. | Lo anterior, y además formula explicaciones sistémicas profundas vinculando principios ecológicos y adaptaciones. |
| **Responsabilidad, Coevaluación y PRAE (SER / CONVIVIR)** | Manifiesta desinterés durante las presentaciones de sus pares o no presenta compromiso ambiental. | Cumple el tiempo asignado, participa con respeto en la coevaluación (Praise & Polish) y formula su compromiso PRAE. | Lo anterior, y además brinda retroalimentación constructiva de alto valor a sus compañeros durante la feria. | Lo anterior, y además destaca como líder inspirador del evento, promoviendo el rigor científico y la empatía colectiva. |
`
}

/* ------------------------------------------------------------------------------------------------
 * Arc planning (skeleton) + per-week deep generation + Section 1 audit
 * ---------------------------------------------------------------------------------------------- */

const SPREAD_MODELS = [
  'gemini-3.5-flash-lite',
  'gemini-3.1-flash-lite-preview',
  'gemini-3.5-flash',
  'gemini-3.6-flash',
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
    preferredModel: pickModel(2),
    deadline,
  })
  const weekPs = skeleton.semanas.map((w, i) => generateWeekCell(params, ctxWeek, skeleton, w, i + 3, deadline))
  const stage2P = callModelDetailed(buildStage2Prompt(params, ctxMid, skeleton), {
    maxOutputTokens: 16384,
    temperature: 0.25,
    preferredModel: pickModel(3),
    deadline,
  })
  const stage3P = callModelDetailed(buildStage3Prompt(params, ctxMid), {
    maxOutputTokens: 16384,
    temperature: 0.25,
    preferredModel: pickModel(0),
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

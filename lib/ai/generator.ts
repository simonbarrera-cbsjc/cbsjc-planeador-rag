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
 */
export const CANDIDATE_MODELS = [
  'gemini-3.6-flash',
  'gemini-flash-latest',
  'gemini-3.1-flash-lite',
  'gemini-3.5-flash',
  'gemini-3.1-pro-preview',
  'gemini-3.7-flash',
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
 * Executes an LLM generation with fallback through candidate models and automatic retries.
 */
async function callGenerativeModel(prompt: string, maxOutputTokens = 65536): Promise<string> {
  const genAI = getGenAIClient()
  let lastError: Error | null = null

  for (const modelName of CANDIDATE_MODELS) {
    for (let attempt = 1; attempt <= MAX_RETRIES_PER_MODEL + 1; attempt++) {
      try {
        const model = genAI.getGenerativeModel({
          model: modelName,
          generationConfig: {
            temperature: 0.35,
            topP: 0.95,
            maxOutputTokens,
          },
        })

        const result = await model.generateContent(prompt)
        const response = await result.response
        const text = response.text()

        if (text && text.trim().length > 0) {
          return text.trim()
        }
        throw new Error('Respuesta de generación vacía')
      } catch (err: unknown) {
        const rawMessage = err instanceof Error ? err.message : String(err)
        lastError = err instanceof Error ? err : new Error(rawMessage)

        console.warn(`[generator] Model ${modelName} attempt ${attempt} failed: ${rawMessage}`)

        if (isAuthError(rawMessage)) {
          throw new Error(`Error de autenticación con Google Gemini: ${rawMessage}`)
        }

        if (isNotFoundError(rawMessage)) {
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
Debes producir una redacción EXHAUSTIVA, EXTENSA, PROFUNDA Y SIN RESÚMENES (mínimo 18.000 a 25.000 caracteres solo para esta etapa).

REGLA FUNDAMENTAL DE FORMATO:
- La Sección 0 DEBE SER UNA TABLA MARKDOWN (| Identificación | Detalle |).
- La Sección 1 DEBE SER UNA TABLA MARKDOWN (| Referente Curricular | Contenido y Articulación Institucional |) con EXACTAMENTE 14 FILAS. DEBES INCLUIR FILAS SEPARADAS PARA 'Competencias Fijas (Plan de Área / SIAP)' Y 'Competencias Electivas (Profundización / Énfasis)'. CADA FILA DEBE TENER ENTRE 10 Y 20 LÍNEAS DE CONTENIDO PEDAGÓGICO COMPLETO. NUNCA USES LISTAS DE PUNTOS EN LUGAR DE LA TABLA.
- La Sección 2 DEBE COMENZAR OBLIGATORIAMENTE CON LA TABLA DE ARCO PEDAGÓGICO DE 3 COLUMNAS (| Momento / Fase | Enfoque Pedagógico | Semanas, Sesiones y Actividades Detalladas |) estructurando Antes, Durante y Después distribuidas a lo largo de las ${safeSemanasEfectivas}, seguida del desarrollo minucioso de Warm-up, Core Task, Wrap-up, Consignas Docentes y DUA/PIAR para TDAH.

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

## 2. ARCO PEDAGÓGICO DE LA SECUENCIA

| Momento / Fase | Enfoque Pedagógico | Semanas, Sesiones y Actividades Detalladas |
|---|---|---|
| **ANTES** | **Conecta y reta**<br>Activación y encuadre inicial | **Semana 1 - Actividad 1: Activación y planificación (producción inicial + roles):**<br>- El docente retoma la pregunta de sentido y presenta el desafío rector o fenómeno del campus de Tienda Nueva.<br>- Cada estudiante elabora una producción inicial (mapa mental, hipótesis exploratoria) respondiendo a la pregunta de sentido.<br>- El docente publica la rúbrica global del informe final (bloque 5); las actividades están diseñadas para alcanzar el nivel Gold.<br>- Se conforman equipos cooperativos de 3-4 integrantes, se asignan roles y se registran metas en el Tablero de Progreso. |
| **DURANTE** | **Explora, construye y aplica**<br>Indagación profunda, laboratorios y modelado | **Semana 2 - Actividad 2: Análisis de fuentes y primer borrador:**<br>- El docente proporciona un kit de recursos clave (lecturas, datos, vocabulario bilingüe ACE).<br>- Los equipos analizan las fuentes y elaboran una tabla comparativa.<br>- Protocolo de estaciones de aprendizaje activo y registro de datos.<br>- Redacción de la primera sección del informe o evidencia.<br><br>**Semana 3 - Actividad 3: Investigación específica y sección individual:**<br>- Cada equipo selecciona una variable o caso de profundización.<br>- Cada estudiante redacta su propia sección individual del producto aplicando pensamiento crítico.<br>- Pruebas experimentales y coevaluación intermedia con protocolo Praise & Polish. |
| **DESPUÉS** | **Consolida, evalúa y proyecta**<br>Cierre, sustentación y transferencia | **Semana 4 - Actividad 4: Informe final, sustentación oral A2 y metacognición:**<br>- Consolidación y entrega de la versión final del producto Capstone.<br>- Sustentación oral bilingüe en inglés A2/B1 ante panel evaluador y pares.<br>- Evaluación sumativa con Rúbrica Menú de Desafíos, coevaluación y autoevaluación reflexiva con Ticket de Salida y cierre en el Tablero de Progreso. |

*(Nota pedagógica: Adapta la distribución de los momentos Antes, Durante y Después a las ${safeSemanasEfectivas} indicadas por el docente).*

### ANTES: Conecta y Reta (Semana 1)
- **Eje Temático:** (Nombre del eje temático y fundamentos de inicio).
- **Can-Do Statement:** (Declaración en primera persona bilingüe: 'Reconozco... y expreso en inglés... / I can identify... and explain in A2 English...').
- **Momento 1 - Warm-up / Pre-task:** (Descripción completa: Situación retadora o fenómeno observado en el campus de Tienda Nueva, rutina de pensamiento See-Think-Wonder, publicación de la Rúbrica Menú de Desafíos y registro de metas en el Tablero de Progreso Anexo A6 en el cuaderno del estudiante).
- **Momento 2 - Core Task:** (Indagación diagnóstica guiada sin costo en la nota, toma de muestras, montaje exploratorio y registro en esquemas).
- **Momento 3 - Wrap-up & Language Focus:** (Práctica oral guiada con sentence frames en inglés, consolidación de vocabulario ACE y Ticket de Salida individual).
- **Consignas Docentes:** (4 pautas pedagógicas explícitas de mediación y modelado).
- **Ajustes DUA & PIAR:** (Estrategias concretas de diseño universal y ajustes para estudiantes con TDAH y estilos diversos).

### DURANTE: Aprende, Construye y Aplica (Semanas 2 y 3)

#### ■ SEMANA 2: Profundización Conceptual y Estaciones Prácticas
- **Eje Temático:** (Especialización, funciones complejas y relación estructura-función).
- **Can-Do Statement:** (Declaración 'I can...' bilingüe completa).
- **Momento 1 - Warm-up:** (Activación cognitiva y análisis comparativo).
- **Momento 2 - Core Task (Fase 1 Capstone):** (Trabajo en estaciones rotativas de laboratorio, modelado guiado, matrices técnicas 'Structure - Function' y registro sistemático).
- **Momento 3 - Wrap-up:** (Coevaluación intermedia, retroalimentación formativa y actualización del Tablero de Progreso).
- **Consignas Docentes:** (Pautas pedagógicas de andamiaje).
- **Ajustes DUA & PIAR:** (Apoyos visuales, temporizadores y roles diferenciados).

#### ■ SEMANA 3: Integración Disciplinar y Desarrollo de la Evidencia Principal
- **Eje Temático:** (Integración sistémica, flujo de nutrientes y adaptación ecosistémica).
- **Can-Do Statement:** (Declaración 'I can...' bilingüe completa).
- **Momento 1 - Warm-up:** (Conexión sistémica y revisión de avances).
- **Momento 2 - Core Task (Fase 2 Capstone):** (Construcción editorial del producto central, diagramas de flujo tridimensionales, rotulación en inglés A2 y matrices técnicas).
- **Momento 3 - Wrap-up:** (Revisión de avance por pares y preparación de la sustentación oral).
- **Consignas Docentes:** (Monitoreo de rigor conceptual y lingüístico).
- **Ajustes DUA & PIAR:** (Segmentación de tareas y listas de chequeo).

### DESPUÉS: Evidencia, Mejora, Reflexiona y Transfiere (Semana 4)
- **Eje Temático:** (Divulgación científica, sustentación oral bilingüe y compromiso PRAE).
- **Can-Do Statement:** (Declaración 'I can...' bilingüe completa).
- **Momento 1 - Warm-up:** (Montaje de stands para la Feria Científica y pitch drill bilingüe de 30 segundos).
- **Momento 2 - Core Task (Sustentación Oral y Defensa Capstone):** (Exposiciones orales en stands ante panel docente y pares usando guion en inglés A2, coevaluación Praise & Polish y entrega del producto completo).
- **Momento 3 - Wrap-up & Metacognición:** (Cierre reflexivo sobre la Driving Question, autoevaluación final en el Tablero de Progreso Anexo A6 y retroalimentación formativa que permite reentrega para mejorar).
- **Consignas Docentes:** (Evaluación con rúbrica Menú de Desafíos y retroalimentación constructiva).
- **Ajustes DUA & PIAR:** (Opciones de sustentación asistida y apoyos visuales).
`
}

/**
 * Stage 2 Prompt: Plan de Evaluación Continua, Pilares, Rúbrica Menú de Desafíos, Cibercolegios y Firmas
 */
function buildStage2Prompt(params: GeneratePlanningParams, formattedContext: string): string {
  const { docente, area, grado, periodo, semanas, semanasEfectivas, tema } = params
  const safeDocente = sanitizeInputText(docente, 200)
  const safeArea = sanitizeInputText(area, 200)
  const safeGrado = sanitizeInputText(grado, 100)
  const safePeriodo = sanitizeInputText(String(periodo), 50)
  const safeSemanas = sanitizeInputText(semanas || '4 semanas', 150)
  const safeSemanasEfectivas = sanitizeInputText(semanasEfectivas || '4 semanas efectivas de clase directa', 150)
  const safeTema = sanitizeInputText(tema, 300)

  return `Eres el Diseñador Curricular y Asistente Pedagógico Oficial del Colegio Bilingüe San José Campestre (CBSJC).
Tu misión es generar la **ETAPA 2** de la Planeación Curricular Maestra bajo el formato oficial **SJB-RGA006 Planning Book**.
Debes producir una redacción EXHAUSTIVA, EXTENSA, PROFUNDA Y EN FORMATO DE TABLAS MARKDOWN ESTRICTAS (mínimo 12.000 a 18.000 caracteres).

REGLAS DE FORMATO Y EVALUACIÓN OBLIGATORIAS:
1. La Sección 3 DEBE SER UNA TABLA DE 5 COLUMNAS (| Actividad evaluativa | Semana · momento | Pilar(es) que valora | % dentro del pilar | Rúbrica específica (síntesis coherente con la global) |).
   IMPORTANTE - CALIBRACIÓN MATEMÁTICA SEGÚN SEMANAS EFECTIVAS:
   - La planeación cuenta con **${safeSemanasEfectivas}** dentro de un marco de ${safeSemanas}.
   - Debes distribuir las actividades evaluativas exactamente entre las **${safeSemanasEfectivas}** de clase.
   - En la columna '% DENTRO DEL PILAR', asigna micro-porcentajes pequeños y ponderados por cada actividad (ej. SABER 2% a 5%, SABER HACER 4% a 6%, SABER SER 1% a 3%, SABER CONVIVIR 1% a 2%).
   - NUNCA coloques el 25% o 35% total en una sola actividad.
   - La sumatoria de los micro-porcentajes evaluados a lo largo de las semanas efectivas DEBE SUMAR CON EXACTITUD MATEMÁTICA el porcentaje total acumulado asignado a la secuencia en el periodo lectivo (ej. SABER 15% a 35%, SABER HACER 17.5% a 35%, SABER SER 8% a 20%, SABER CONVIVIR 5% a 10%).
   - Incluye OBLIGATORIAMENTE al pie de la tabla la nota de verificación matemática institucional desglosando la suma de las semanas efectivas.
2. La Sección 4 DEBE SER UNA TABLA DE 3 COLUMNAS (| Pilar Institucional | Competencia(s) Evaluada(s) | Manifestación en la Evidencia Principal |).
   IMPORTANTE: EN LA COLUMNA 'Competencia(s) Evaluada(s)' PUEDES Y DEBES INCLUIR MÁS DE UNA COMPETENCIA POR PILAR (ej. 'Competencia histórica y ciudadana (común) + Competencia lectora y crítica (común)' o 'Uso comprensivo del conocimiento + Explicación de fenómenos') para dar total flexibilidad al docente.
3. La Sección 5 DEBE SER UNA TABLA DE 5 COLUMNAS (| Pilar · Competencia | Sin categoría (1.0 – 3.9) | Bronze (4.0 – 4.5) Esperado | Silver (4.6 – 4.7) Profundización | Gold (4.8 – 5.0) Excelencia |) con DESCRIPTORES ANALÍTICOS DE 6 A 10 LÍNEAS POR CELDA.
4. La Sección 6 DEBE SER EL BLOQUE PARA CIBERCOLEGIOS.
5. La Sección 7 DEBE SER LA BITÁCORA (TABLA 2 COLUMNAS) Y LA TABLA DE 3 FIRMAS (| ELABORÓ | REVISÓ | APROBÓ |).
6. NO INCLUYAS ETIQUETAS HTML CRUDAS (<strong class="...">, </span>, etc.). USA EXCLUSIVAMENTE MARKDOWN LIMPIO (**negrilla**, *cursiva*).

DATOS DE LA SECUENCIA:
- Docente(s): ${safeDocente}
- Área / Asignatura: ${safeArea}
- Grado / Grupo: ${safeGrado}
- Período: ${safePeriodo} (Año Lectivo 2026)
- Intervalo de Semanas / Fechas: ${safeSemanas}
- Semanas Efectivas de Clase: ${safeSemanasEfectivas}
- Tema: ${safeTema}

GENERA EXACTAMENTE ESTE BLOQUE EN MARKDOWN:

## 3. PLAN DE EVALUACIÓN CONTINUA DE LA SECUENCIA

| Actividad evaluativa | Semana · momento | Pilar(es) que valora | % dentro del pilar | Rúbrica específica (síntesis coherente con la global) |
|---|---|---|---|---|
| **Actividad 1: Activación y planificación (producción inicial + roles)** | Semana 1 - ANTES | SABER · SABER SER · SABER CONVIVIR | SABER: 3%<br>SABER SER: 2%<br>SABER CONVIVIR: 1% | Rúbrica de activación: organización de roles, preguntas iniciales, mapa mental de ideas previas y compromiso del equipo. |
| **Actividad 2: Análisis de fuentes y primer borrador** | Semana 2 - DURANTE | SABER · SABER HACER · SABER SER · SABER CONVIVIR | SABER: 5%<br>SABER HACER: 6%<br>SABER SER: 2%<br>SABER CONVIVIR: 1.5% | Rúbrica de análisis y borrador: extracción de datos, tabla comparativa, protocolos de laboratorio y calidad de la sección preliminar. |
| **Actividad 3: Investigación específica y sección individual** | Semana 3 - DURANTE | SABER · SABER HACER · SABER SER · SABER CONVIVIR | SABER: 4%<br>SABER HACER: 6%<br>SABER SER: 1%<br>SABER CONVIVIR: 1.5% | Rúbrica de aporte individual: profundidad del análisis disciplinar, propuesta de solución y rigor de la redacción técnica. |
| **Actividad 4: Informe final, sustentación oral A2 y metacognición** | Semana 4 - DESPUÉS | SABER · SABER HACER · SABER SER · SABER CONVIVIR | SABER: 3%<br>SABER HACER: 5.5%<br>SABER SER: 3%<br>SABER CONVIVIR: 1% | Rúbrica global (bloque 5) aplicada al informe final; rúbrica de sustentación oral en inglés A2; rúbrica de metacognición. |

*(Verificación matemática institucional: La suma acumulada de las actividades a lo largo de las ${safeSemanasEfectivas} evalúa con rigor el porcentaje asignado a la secuencia en el periodo lectivo: SABER = 3%+5%+4%+3% = 15%; SABER HACER = 6%+6%+5.5% = 17.5%; SABER SER = 2%+2%+1%+3% = 8%; SABER CONVIVIR = 1%+1.5%+1.5%+1% = 5%. Cada semana efectiva evalúa micro-porcentajes ponderados que totalizan la meta del periodo).*

## 4. PILARES Y COMPETENCIAS INSTITUCIONALES EN ESTA SECUENCIA

| Pilar Institucional | Competencia(s) Evaluada(s) | Manifestación en la Evidencia Principal |
|---|---|---|
| **SABER (35%)** | Dimensión Cognitiva y Conceptual: Uso comprensivo del conocimiento disciplinar (común) + Explicación de fenómenos (común) | El estudiante explica con precisión analítica, relaciones causales y vocabulario técnico cómo interactúan los conceptos disciplinares y formula explicaciones fundamentadas en el producto final. |
| **SABER HACER (35%)** | Dimensión Procedimental y Bilingüe: Pensamiento crítico y resolución de problemas (común) + Indagación e investigación (común) + Comunicación oral en inglés A2 | Modela representaciones técnicas de alta calidad, ejecuta experimentos en estaciones de laboratorio, registra datos empíricos y sustenta oralmente con solvencia en inglés A2/B1. |
| **SABER SER (20%)** | Dimensión Actitudinal y Autonomía: Autonomía y mentalidad de crecimiento (común) + Ética y autocuidado | Demuestra autorregulación, persistencia frente a desafíos, mejora su desempeño mediante la reentrega formativa y diligencia con honestidad el Tablero de Progreso. |
| **SABER CONVIVIR (10%)** | Dimensión Relacional y Colaborativa: Colaboración y trabajo en equipo (común) + Conciencia ambiental PRAE | Cumple activamente el rol asignado en el equipo cooperativo, practica la coevaluación respetuosa (Praise & Polish), escucha a sus pares y cuida el entorno natural en Tienda Nueva. |

## 5. RÚBRICA GLOBAL DE LA EVIDENCIA DE APRENDIZAJE · MENÚ DE DESAFÍOS

| Pilar · Competencia | Sin categoría (1.0 – 3.9) | Bronze (4.0 – 4.5) Esperado | Silver (4.6 – 4.7) Profundización | Gold (4.8 – 5.0) Excelencia |
|---|---|---|---|---|
| **SABER (35%)**<br>Dimensión Cognitiva | (Descriptor detallado: Identifica con imprecisiones...) | (Descriptor detallado: Explica con claridad y precisión el aprendizaje esperado completo del grado...) | (Descriptor detallado: Lo anterior, y además profundiza en justificaciones causales complejas...) | (Descriptor detallado: Lo anterior, y además formula hipótesis avanzadas, análisis sistémico y transferencia original al entorno...). |
| **SABER HACER (35%)**<br>Dimensión Procedimental y Bilingüe | (Descriptor detallado: Construye con inconsistencias...) | (Descriptor detallado: Elabora la evidencia completa con los niveles solicitados, rotulación técnica y expresión oral en inglés A2...) | (Descriptor detallado: Lo anterior, y además modela representaciones de alta calidad y sustenta oralmente con notable fluidez A2...) | (Descriptor detallado: Lo anterior, y además elabora un producto de calidad editorial sobresaliente y defiende con solvencia superior en inglés). |
| **SABER SER (20%)**<br>Dimensión Actitudinal y Autonomía | (Descriptor detallado: Muestra desinterés o baja persistencia...) | (Descriptor detallado: Diligencia su Tablero de Progreso, cuida los recursos y muestra persistencia para completar tareas a tiempo...) | (Descriptor detallado: Lo anterior, y además demuestra alta autonomía, formula preguntas investigables y mejora con la reentrega...) | (Descriptor detallado: Lo anterior, y además actúa como modelo de mentalidad de crecimiento y liderazgo proactivo). |
| **SABER CONVIVIR (10%)**<br>Dimensión Relacional y Colaborativa | (Descriptor detallado: Dificultades para asumir un rol cooperativo...) | (Descriptor detallado: Trabaja armónicamente en su equipo cooperativo, cumple su rol y respeta las normas de convivencia...) | (Descriptor detallado: Lo anterior, y además apoya a sus compañeros y aporta soluciones constructivas...) | (Descriptor detallado: Lo anterior, y además lidera la sinergia grupal, fomenta inclusión y promueve activamente el cuidado del entorno escolar). |

*Salvaguardas Pedagógicas CBSJC:* El descriptor Bronze es el aprendizaje esperado completo del grado; Silver y Gold exigen profundización y excelencia alcanzable dentro del tiempo de la secuencia. La reentrega formativa siempre mejora el aprendizaje y la valoración según la banda alcanzada.

## 6. BLOQUE DE TRASLADO A CIBERCOLEGIOS
\`\`\`text
NOMBRE (instrumento): ${safeTema} (SJB-RGA006)
DESCRIPCIÓN: Pregunta de sentido: ${safeTema} | DBA: Oficial del grado | Evidencia principal: Producto Capstone y sustentación oral bilingüe | Competencias por pilar: SABER (35%) - Explicación de fenómenos; SABER HACER (35%) - Indagación y bilingüismo A2; SABER SER (20%) - Autonomía y Tablero de Progreso; SABER CONVIVIR (10%) - Trabajo en equipo y compromiso PRAE | Meta ACE: En nivel A2, describe y compara en inglés | Rúbrica: Menú de Desafíos adjunta en el recurso de la actividad | Bandas de valoración: Sin categoría (1.0 - 3.9) | Bronze (4.0 - 4.5: esperado completo) | Silver (4.6 - 4.7: profundización) | Gold (4.8 - 5.0: excelencia y transferencia).
\`\`\`

## 7. BITÁCORA DE LA SECUENCIA · SE DILIGENCIA AL CIERRE

| Aspecto Reflexivo | Registro del Docente |
|---|---|
| **Qué ocurrió frente a lo planeado** | [Espacio reservado para el registro reflexivo del docente al finalizar las 4 semanas: ajustes sobre la marcha, gestión de tiempos y adaptaciones metodológicas]. |
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

/**
 * Main Generation Orchestrator: Multi-Stage Parallel Execution
 */
export async function generatePlanningDocument(
  params: GeneratePlanningParams
): Promise<GeneratedPlanningOutput> {
  const formattedContext = params.contextDocs
    .map(
      (doc, i) =>
        `=== [DOCUMENTO RECTOR / FUENTE ${i + 1}: ${doc.tipo.toUpperCase()} (${doc.filename})] ===\n${sanitizeInputText(doc.content, 12000)}\n`
    )
    .join('\n')

  const stage1Prompt = buildStage1Prompt(params, formattedContext)
  const stage2Prompt = buildStage2Prompt(params, formattedContext)
  const stage3Prompt = buildStage3Prompt(params, formattedContext)

  console.log('[generator] Launching Multi-Stage Generation in parallel for maximum 18+ page depth...')

  // Execute all 3 stages in parallel
  const [stage1Text, stage2Text, stage3Text] = await Promise.all([
    callGenerativeModel(stage1Prompt, 65536),
    callGenerativeModel(stage2Prompt, 65536),
    callGenerativeModel(stage3Prompt, 65536),
  ])

  console.log(`[generator] Stage 1 finished: ${stage1Text.length} chars`)
  console.log(`[generator] Stage 2 finished: ${stage2Text.length} chars`)
  console.log(`[generator] Stage 3 finished: ${stage3Text.length} chars`)

  // Combine into the master Planning Book Markdown
  const fullText = [stage1Text, stage2Text, stage3Text].join('\n\n---\n\n')
  console.log(`[generator] Total Master Curriculum Length: ${fullText.length} chars (Target: 18+ pages)`)

  // Extract Rubrics Section
  const rubricsMarkdown = [stage2Text, stage3Text].join('\n\n---\n\n')

  // Extract Cibercolegios block
  let cibercolegiosSnippet = ''
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
    semanas: params.semanas ? `${params.semanas} (${params.semanasEfectivas || '4 semanas efectivas'})` : '4 semanas',
    semanasEfectivas: params.semanasEfectivas || '4 semanas efectivas',
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
}

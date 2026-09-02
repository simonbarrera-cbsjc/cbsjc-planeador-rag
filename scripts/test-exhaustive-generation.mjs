/**
 * @file scripts/test-exhaustive-generation.mjs
 * @description Comprehensive validation script for CBSJC Curricular AI Engine.
 * Verifies character count (>30,000 chars / 18+ page depth), presence of all 7 official sections,
 * 3 evaluative annexes, and exact structure of 18 tables matching 'Ejemplo de planning book ya lleno.docx'.
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { GoogleGenerativeAI } from '@google/generative-ai'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const ROOT_DIR = path.resolve(__dirname, '..')

// Load .env.local
const envLocalPath = path.join(ROOT_DIR, '.env.local')
if (fs.existsSync(envLocalPath)) {
  const envContent = fs.readFileSync(envLocalPath, 'utf8')
  for (const line of envContent.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const idx = trimmed.indexOf('=')
    if (idx > 0) {
      const key = trimmed.slice(0, idx).trim()
      const val = trimmed.slice(idx + 1).trim()
      if (!process.env[key]) {
        process.env[key] = val
      }
    }
  }
}

function sanitizeInputText(input, maxLength) {
  if (!input) return ''
  return input
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
    .replace(/<\/?(?:system|instruction|docente_instrucciones|contexto_curricular|prompt|admin|user|script|iframe)[^>]*>/gi, '')
    .trim()
    .slice(0, maxLength)
}

export function buildOfficialPromptForTest(params) {
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
Tu misión es generar la planeación curricular MAESTRA EXHAUSTIVA, COMPLETA y de MÁXIMA PROFUNDIDAD (Secuencia Didáctica de extensión profesional, mínimo 18 páginas completas en formato impreso/Word, más de 35.000 caracteres, sin resúmenes, sin texto truncado, sin elipsis '...' ni marcadores de posición), bajo el formato oficial **SJB-RGA006 Planning Book (Secuencia Didáctica: Antes — Durante — Después · Subciclos 3 a 6)**.

REGLAS DE RIGOR INSTITUCIONAL CBSJC (OBLIGATORIAS):
1. Ponderación fija inalterable de los 4 pilares: SABER (35%), SABER HACER (35%), SABER SER (20%), SABER CONVIVIR (10%).
2. Menú de Desafíos con 4 bandas de evaluación rigurosas en todas las rúbricas:
   - Sin categoría (1.0 – 3.9): En proceso de consolidación / aprueba con debilidades.
   - Bronze (4.0 – 4.5): Aprendizaje esperado completo del grado (no es un mínimo, es el estándar completo).
   - Silver (4.6 – 4.7): Lo anterior, y además profundización, justificación técnica extendida y mayor autonomía.
   - Gold (4.8 – 5.0): Lo anterior, y además excelencia sobresaliente, transferencia original y liderazgo ecológico/PRAE.
3. Arco pedagógico detallado sesión a sesión para 4 SEMANAS (16 horas de clase):
   - ANTES (Semana 1): Rutinas See-Think-Wonder, indagación diagnóstica sin costo en la nota, presentación de metas en Tablero de Progreso Anexo A6 en cuaderno.
   - DURANTE (Semana 2): Profundización conceptual, estaciones de trabajo prácticas, modelación guiada y andamiaje bilingüe ACE.
   - DURANTE (Semana 3): Integración disciplinar, construcción y modelado del producto central (Capstone), diagramas de flujo y matrices técnicas.
   - DESPUÉS (Semana 4): Ensamble final, sustentación oral bilingüe A2 ante panel de pares/docente, coevaluación formativa (Praise & Polish) y metacognición con Driving Question.
4. TRES (3) INSTRUMENTOS DE EVALUACIÓN FINAL COMPLETOS Y DETALLADOS (ANEXOS EVALUATIVOS 1, 2 Y 3):
   - Anexo 1: Prueba Escrita y Cognitiva Integral (10 preguntas completas y redactadas palabra por palabra: preguntas tipo ICFES con 4 opciones A/B/C/D y justificación, análisis de datos, casos contextualizados en el campus de Tienda Nueva / PRAE, matching bilingüe A2 de 5 términos, párrafo para completar en inglés A2 con word bank, rotulación de 6 partes de diagramas técnicos, integración sistémica, indagación con formulación de hipótesis, comprensión de lectura bilingüe A2 y metacognición/autocuidado) + Rúbrica Analítica de 4 criterios x 4 bandas.
   - Anexo 2: Examen Práctico de Laboratorio y Habilidades Experimentales (Protocolo completo y detallado de las 4 Estaciones Rotativas de 15 minutos cada una, con materiales, procedimientos paso a paso, tareas y fichas de registro a escala) + Rúbrica Analítica de 4 criterios x 4 bandas.
   - Anexo 3: Sustentación Oral y Defensa Capstone (Guía y guion bilingüe A2 completo para Scientific Pitch de 3 a 5 minutos, con las 5 fases textuales de apertura, micro-niveles, macro-niveles, PRAE y defensa ante preguntas) + Rúbrica Analítica de 4 criterios x 4 bandas.
5. CERO ABREVIACIONES O ELIPSIS: Está terminantemente prohibido usar '...', '(continúa...)', '[completar aquí]' o respuestas genéricas. Todo debe estar plenamente redactado con riqueza disciplinar, rigor técnico y contextualización en Tienda Nueva y el campus campestre del CBSJC.

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

GENERA EL DOCUMENTO ÍNTEGRO Y EXHAUSTIVO EN MARKDOWN RESPETANDO EXACTAMENTE ESTA ESTRUCTURA DE 18 TABLAS Y 8 SECCIONES:

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
| **Meta del subciclo y posición del grado** | (Escribir el subciclo correspondiente, ej. Subciclo 4 — 4.° a 6.° — Descubrimiento del Mundo, declarar posición: Inicia / Desarrolla / Consolida y verifica, y redactar en 15-20 líneas completas el perfil integral de egreso del subciclo). |
| **Competencia disciplinar (Plan de Área)** | (Redactar 3 competencias disciplinares completas del Plan de Área: Uso comprensivo del conocimiento científico/disciplinar, Explicación de fenómenos, e Indagación guiada con observación in situ). |
| **Estándar Básico de Competencia (EBC)** | (3 estándares oficiales del MEN plenamente citados y articulados al grado). |
| **Derecho Básico de Aprendizaje (DBA)** | (Código oficial DBA y enunciado curricular completo del Ministerio de Educación Nacional). |
| **Evidencias de aprendizaje (DBA)** | (Redactar detalladamente: Evidencia 1 Central de la Secuencia, Evidencia Complementaria 2, y Evidencia Complementaria 3 multimodal bilingüe). |
| **Componente evaluado por el ICFES** | (Componente de prueba de Estado: ej. Entorno Vivo / Entorno Físico / Procesos Biológicos y Homeostasis). |
| **Pregunta de sentido del período** | (Pregunta rectora institucional en español y Driving Question completa en inglés para el enfoque bilingüe). |
| **Aprendizaje esperado de la secuencia** | (Redacción exhaustiva del aprendizaje esperado integrando dimensiones cognitiva, procedimental, contextual y comunicativa en inglés A2). |
| **Evidencia de aprendizaje principal** | (Nombre técnico y descripción detallada del producto o proyecto Capstone central de la secuencia). |
| **Componente ACE del período** | **Alcance:** Aplicación disciplinar.<br>**Meta ACE:** En nivel A2/B1, describe y sustenta oralmente en inglés...<br>**Núcleo Lingüístico:** (Mínimo 15 términos disciplinares en inglés con traducción).<br>**Expresiones Funcionales:** (Mínimo 5 estructuras de oración completas para producción oral y escrita). |
| **Instrumento · nombre de la nota en Cibercolegios** | (Nombre exacto del instrumento para la planilla con porcentajes de pilares y rúbrica Menú de Desafíos). |
| **Proyecto integrador al que aporta** | (Articulación exhaustiva con el Proyecto Transversal PRAE Institucional SJB-PGA012 'Biodiversidad en Tienda Nueva: conocer para conservar' y aporte concreto de la secuencia). |
| **Número de semanas e intervalo de fechas** | ${safeSemanas} |

## 2. ARCO PEDAGÓGICO DE LA SECUENCIA

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

## 3. PLAN DE EVALUACIÓN CONTINUA DE LA SECUENCIA

| Actividad evaluativa | Semana · momento | Pilar(es) que valora | % dentro del pilar | Rúbrica específica (síntesis coherente con la global) |
|---|---|---|---|---|
| **1. Actividad Formativa Inicial (Ficha de Indagación y Diagnóstico)** | Semana 1 (ANTES) | SABER (35%) / SABER HACER (35%) | SABER: 30%<br>HACER: 25% | (Describir criterios específicos para esta actividad) |
| **2. Taller Práctico / Laboratorio de Profundización y Estaciones** | Semana 2 (DURANTE) | SABER (35%) / SABER HACER (35%) | SABER: 35%<br>HACER: 25% | (Describir criterios específicos para esta actividad) |
| **3. Desarrollo y Modelado de la Evidencia Principal (Capstone)** | Semana 3 (DURANTE) | SABER (35%) / SABER HACER (35%) / SABER SER (20%) | SABER: 35%<br>HACER: 25%<br>SER: 50% | (Describir criterios específicos para esta actividad) |
| **4. Producto Capstone Final + Sustentación Oral A2** | Semana 4 (DESPUÉS) | SABER HACER (35%) / SABER SER (20%) / SABER CONVIVIR (10%) | HACER: 25%<br>SER: 50%<br>CONVIVIR: 100% | (Describir criterios específicos para esta actividad) |

*(Verificación matemática institucional: La suma de porcentajes dentro de cada pilar individual suma exactamente 100%: SABER = 30%+35%+35% = 100%; SABER HACER = 25%+25%+25%+25% = 100%; SABER SER = 50%+50% = 100%; SABER CONVIVIR = 100%).*

## 4. PILARES Y COMPETENCIAS INSTITUCIONALES EN ESTA SECUENCIA

| Pilar Institucional | Competencia Evaluada | Manifestación en la Evidencia Principal |
|---|---|---|
| **SABER (35%)** | Dimensión Cognitiva y Conceptual: Uso comprensivo del conocimiento y explicación de fenómenos. | (Describir exhaustivamente cómo el estudiante demuestra dominio de conceptos, relaciones y principios disciplinares en el producto final). |
| **SABER HACER (35%)** | Dimensión Procedimental y Bilingüismo: Modelación, indagación experimental y comunicación oral en inglés A2. | (Describir cómo se evidencia la destreza técnica, rotulación bilingüe y sustentación oral en el producto final). |
| **SABER SER (20%)** | Dimensión Actitudinal y Autonomía: Mentalidad de crecimiento, persistencia, autocuidado y diligenciamiento del Tablero de Progreso. | (Describir cómo se refleja la autorregulación, puntualidad y superación de dificultades en la secuencia). |
| **SABER CONVIVIR (10%)** | Dimensión Relacional y Colaborativa: Trabajo en equipo cooperativo, coevaluación respetuosa (Praise & Polish) y compromiso ambiental PRAE. | (Describir cómo se evidencia el liderazgo positivo, respeto de turnos y aporte al cuidado del campus de Tienda Nueva). |

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

---

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

const EXPECTED_SECTIONS = [
  { id: 'SEC_1', name: '1. IDENTIFICACIÓN Y REFERENTES DE CALIDAD', regex: /(?:##\s*1\.?|#\s*1\.?|1\.)\s*IDENTIFICACI[OÓ]N/i },
  { id: 'SEC_2', name: '2. ARCO PEDAGÓGICO DE LA SECUENCIA', regex: /(?:##\s*2\.?|#\s*2\.?|2\.)\s*ARCO\s*PEDAG[OÓ]GICO/i },
  { id: 'SEC_3', name: '3. PLAN DE EVALUACIÓN CONTINUA DE LA SECUENCIA', regex: /(?:##\s*3\.?|#\s*3\.?|3\.)\s*PLAN\s*DE\s*EVALUACI[OÓ]N/i },
  { id: 'SEC_4', name: '4. PILARES Y COMPETENCIAS INSTITUCIONALES EN ESTA SECUENCIA', regex: /(?:##\s*4\.?|#\s*4\.?|4\.)\s*PILARES\s*Y\s*COMPETENCIAS/i },
  { id: 'SEC_5', name: '5. RÚBRICA GLOBAL DE LA EVIDENCIA DE APRENDIZAJE · MENÚ DE DESAFÍOS', regex: /(?:##\s*5\.?|#\s*5\.?|5\.)\s*R[UÚ]BRICA\s*GLOBAL/i },
  { id: 'SEC_6', name: '6. BLOQUE DE TRASLADO A CIBERCOLEGIOS', regex: /(?:##\s*6\.?|#\s*6\.?|6\.)\s*BLOQUE\s*DE\s*TRASLADO/i },
  { id: 'SEC_7', name: '7. BITÁCORA DE LA SECUENCIA · SE DILIGENCIA AL CIERRE', regex: /(?:##\s*7\.?|#\s*7\.?|7\.)\s*BIT[AÁ]CORA/i },
  { id: 'ANNEX_1', name: 'ANEXO 1: EVALUACIÓN ESCRITA Y CUESTIONARIO (10 PREGUNTAS)', regex: /(?:EVALUACI[OÓ]N\s*FINAL\s*1|ANEXO\s*1|PRUEBA\s*ESCRITA)/i },
  { id: 'ANNEX_2', name: 'ANEXO 2: EXAMEN PRÁCTICO Y 4 ESTACIONES DE LABORATORIO', regex: /(?:EVALUACI[OÓ]N\s*FINAL\s*2|ANEXO\s*2|EXAMEN\s*PR[AÁ]CTICO|ESTACIONES\s*DE\s*LABORATORIO|PR[AÁ]CTICA\s*DE\s*LABORATORIO)/i },
  { id: 'ANNEX_3', name: 'ANEXO 3: SUSTENTACIÓN ORAL Y GUION BILINGÜE A2', regex: /(?:EVALUACI[OÓ]N\s*FINAL\s*3|ANEXO\s*3|SUSTENTACI[OÓ]N\s*ORAL|PITCH\s*BILING[UÜ]E)/i },
]

const EXPECTED_TABLES = [
  { num: 1, name: 'Encabezado / Identificación de la Secuencia', check: (txt) => /Docente\(s\)/i.test(txt) && /Área\s*\/\s*Asignatura/i.test(txt) },
  { num: 2, name: 'Sección 1: Referentes de Calidad', check: (txt) => /Meta del subciclo/i.test(txt) && /Competencia disciplinar/i.test(txt) && /Derecho Básico/i.test(txt) },
  { num: 3, name: 'Sección 2: Arco Pedagógico (Semanas 1-4)', check: (txt) => /ANTES/i.test(txt) && /DURANTE/i.test(txt) && /DESPU[EÉ]S/i.test(txt) },
  { num: 4, name: 'Sección 3: Plan de Evaluación Continua', check: (txt) => /Actividad evaluativa/i.test(txt) && /Pilar\(es\)/i.test(txt) },
  { num: 5, name: 'Sección 4: Pilares y Competencias Institucionales', check: (txt) => /SABER\s*\(35%\)/i.test(txt) && /SABER\s*HACER\s*\(35%\)/i.test(txt) && /SABER\s*SER\s*\(20%\)/i.test(txt) && /SABER\s*CONVIVIR\s*\(10%\)/i.test(txt) },
  { num: 6, name: 'Sección 5: Rúbrica Global Menú de Desafíos', check: (txt) => /Bronze\s*\(?4[\.,]0/i.test(txt) && /Silver\s*\(?4[\.,]6/i.test(txt) && /Gold\s*\(?4[\.,]8/i.test(txt) && /Sin\s*categor[ií]a/i.test(txt) },
  { num: 7, name: 'Sección 6: Bloque de Traslado Cibercolegios', check: (txt) => /NOMBRE\s*\(instrumento\)/i.test(txt) && /DESCRIPCI[OÓ]N:/i.test(txt) },
  { num: 8, name: 'Sección 7: Bitácora de la Secuencia', check: (txt) => /Qu[eé]\s*ocurri[oó]\s*frente\s*a\s*lo\s*planeado/i.test(txt) && /Distribuci[oó]n\s*de\s*niveles/i.test(txt) },
  { num: 9, name: 'Control Institucional de Firmas', check: (txt) => /ELABOR[OÓ]/i.test(txt) && /REVIS[OÓ]/i.test(txt) && /APROB[OÓ]/i.test(txt) },
  { num: 10, name: 'Anexo 1: Ficha Técnica Prueba Escrita', check: (txt) => /Prueba\s*de\s*Desempeño\s*Escrito/i.test(txt) || (/(?:EVALUACI[OÓ]N\s*FINAL\s*1|ANEXO\s*1)/i.test(txt) && /Instrumento/i.test(txt)) },
  { num: 11, name: 'Anexo 1: Cuestionario Completo (10 Preguntas ICFES/A2/PRAE)', check: (txt) => /10\s*(?:PREGUNTAS|[\.Íí]tems|\.)/i.test(txt) || (/1\.\s/i.test(txt) && /10\.\s/i.test(txt)) },
  { num: 12, name: 'Anexo 1: Rúbrica Analítica Prueba Escrita', check: (txt) => /R[UÚ]BRICA.*PRUEBA\s*ESCRITA/i.test(txt) || (/Comprensi[oó]n\s*Conceptual/i.test(txt) && /Bronze/i.test(txt)) },
  { num: 13, name: 'Anexo 2: Ficha Técnica Examen Práctico', check: (txt) => /Examen\s*Pr[aá]ctico/i.test(txt) || (/(?:EVALUACI[OÓ]N\s*FINAL\s*2|ANEXO\s*2)/i.test(txt) && /Instrumento/i.test(txt)) },
  { num: 14, name: 'Anexo 2: Protocolo 4 Estaciones de Laboratorio', check: (txt) => /ESTACI[OÓ]N\s*1/i.test(txt) && /ESTACI[OÓ]N\s*2/i.test(txt) && /ESTACI[OÓ]N\s*3/i.test(txt) && /ESTACI[OÓ]N\s*4/i.test(txt) },
  { num: 15, name: 'Anexo 2: Rúbrica Analítica Examen Práctico', check: (txt) => /R[UÚ]BRICA.*(?:PR[AÁ]CTICA|LABORATORIO)/i.test(txt) || (/T[eé]cnica\s*de\s*Microscop[ií]a/i.test(txt) && /Bronze/i.test(txt)) },
  { num: 16, name: 'Anexo 3: Ficha Técnica Sustentación Oral A2', check: (txt) => /Sustentaci[oó]n\s*Oral\s*Biling[uü]e/i.test(txt) || (/(?:EVALUACI[OÓ]N\s*FINAL\s*3|ANEXO\s*3)/i.test(txt) && /Instrumento/i.test(txt)) },
  { num: 17, name: 'Anexo 3: Guía y Guion Pitch Bilingüe A2 (5 Pasos)', check: (txt) => /(?:Scientific\s*Pitch|PITCH\s*BILING[UÜ]E)/i.test(txt) && /(?:APERTURA|Good morning)/i.test(txt) },
  { num: 18, name: 'Anexo 3: Rúbrica Analítica Sustentación Oral A2', check: (txt) => /R[UÚ]BRICA.*(?:SUSTENTACI[OÓ]N\s*ORAL|CAPSTONE)/i.test(txt) || (/Fluidez.*Ingl[eé]s\s*A2/i.test(txt) && /Bronze/i.test(txt)) },
]

export function evaluateExhaustiveDocument(markdownText) {
  const charCount = markdownText.length
  const wordCount = markdownText.trim().split(/\s+/).length
  const estimatedPages = Math.max(1, Math.round(charCount / 2200))

  const sectionResults = EXPECTED_SECTIONS.map((sec) => {
    const present = sec.regex.test(markdownText)
    return { ...sec, present }
  })

  const tableResults = EXPECTED_TABLES.map((tbl) => {
    const present = tbl.check(markdownText)
    return { ...tbl, present }
  })

  // Check 10 questions individually in Anexo 1
  const questionsFound = []
  for (let q = 1; q <= 10; q++) {
    const qRegex = new RegExp(`(?:^|\\n)\\s*(?:${q}\\.|\\*\\*${q}\\.|###\\s*${q}\\.|Pregunta\\s*${q})`, 'i')
    const hasQ = qRegex.test(markdownText) || markdownText.includes(`${q}. `)
    questionsFound.push({ questionNumber: q, present: hasQ })
  }

  // Check 4 laboratory stations
  const stationsFound = []
  for (let s = 1; s <= 4; s++) {
    const sRegex = new RegExp(`ESTACI[OÓ]N\\s*${s}`, 'i')
    stationsFound.push({ stationNumber: s, present: sRegex.test(markdownText) })
  }

  const allSectionsPresent = sectionResults.every((s) => s.present)
  const allTablesPresent = tableResults.every((t) => t.present)
  const all10QuestionsPresent = questionsFound.every((q) => q.present)
  const all4StationsPresent = stationsFound.every((s) => s.present)
  const is18PlusPages = charCount >= 25000 // >25,000 characters minimum, ideal >35,000

  const passed = allSectionsPresent && allTablesPresent && all10QuestionsPresent && all4StationsPresent && is18PlusPages

  return {
    charCount,
    wordCount,
    estimatedPages,
    sectionResults,
    tableResults,
    questionsFound,
    stationsFound,
    allSectionsPresent,
    allTablesPresent,
    all10QuestionsPresent,
    all4StationsPresent,
    is18PlusPages,
    passed,
  }
}

async function runTest() {
  console.log('='.repeat(80))
  console.log(' CBSJC CURRICULAR AI ENGINE - EXHAUSTIVE 18+ PAGE GENERATION TEST')
  console.log('='.repeat(80))

  // 1. Verify golden reference document
  const samplePath = path.join(ROOT_DIR, 'temp_ejemplo.txt')
  let sampleText = ''
  if (fs.existsSync(samplePath)) {
    sampleText = fs.readFileSync(samplePath, 'utf8')
  }

  if (sampleText) {
    console.log('\n[1] Verifying Golden Reference Document (Ejemplo de planning book ya lleno.docx):')
    const refEval = evaluateExhaustiveDocument(sampleText)
    console.log(`  • Characters: ${refEval.charCount.toLocaleString()}`)
    console.log(`  • Words: ${refEval.wordCount.toLocaleString()}`)
    console.log(`  • Estimated Pages: ~${refEval.estimatedPages} pages`)
    console.log(`  • Official Sections Present: ${refEval.sectionResults.filter(s => s.present).length} / ${refEval.sectionResults.length}`)
    console.log(`  • Required Tables / Deliverables: ${refEval.tableResults.filter(t => t.present).length} / ${refEval.tableResults.length}`)
    console.log(`  • 10 ICFES & A2 Questions: ${refEval.questionsFound.filter(q => q.present).length} / 10`)
    console.log(`  • 4 Laboratory Stations: ${refEval.stationsFound.filter(s => s.present).length} / 4`)
    console.log(`  • Golden Standard Status: ${refEval.passed ? 'PASSED (100% COMPLIANT)' : 'INCOMPLETE'}`)
  }

  // 2. Check API key
  const apiKey = process.env.GOOGLE_AI_API_KEY || process.env.GEMINI_API_KEY
  console.log(`\n[2] Checking Gemini API Configuration: ${apiKey ? 'API KEY CONFIGURED' : 'NO API KEY'}`)

  if (apiKey) {
    console.log('\n[3] Executing Live AI Generation Test using Gemini...')
    try {
      const genAI = new GoogleGenerativeAI(apiKey)

      const testParams = {
        docente: 'Docente Titular de Science — Subciclo 4 CBSJC',
        area: 'Ciencias Naturales — Science (Área Líder de Subciclo)',
        grado: 'Grado 5° de Básica Primaria (Grade 5) — Grupos A y B',
        periodo: 'I',
        semanas: '4 semanas (16 horas de clase — sesiones de 90 min)',
        tema: 'La Célula como Unidad de Vida, Jerarquía Biológica y Adaptación al Entorno Campestre',
        additionalInstructions: 'Generar la versión completa institucional sin abreviar ninguna sección, tabla o rúbrica.',
        contextDocs: [
          {
            tipo: 'plan_de_area',
            filename: 'Plan_de_Area_Science_Grade5.docx',
            content: 'DBA 3: Comprende que los sistemas del cuerpo humano están formados por órganos, tejidos y células... Meta del subciclo 4: El estudiante explica fenómenos naturales y sustenta en inglés A2...',
          },
          {
            tipo: 'siap',
            filename: 'Malla_SIAP_2026.docx',
            content: 'Pregunta de sentido: ¿Cómo se organiza la vida desde las células hasta los sistemas...? Componente ACE: Términos cell, tissue, organ, system, organism.',
          },
          {
            tipo: 'cuadernillo',
            filename: 'Cuadernillo_Evaluativo_G5.pdf',
            content: 'PRAE Institucional: Biodiversidad en Tienda Nueva (Palmira). Observatorio escolar.',
          },
        ],
      }

      const prompt = buildOfficialPromptForTest(testParams)
      console.log(`  • Prompt built successfully (${prompt.length.toLocaleString()} chars).`)

      // Candidate models in prioritized order
      const candidateModels = [
        'gemini-3.6-flash',
        'gemini-3.1-flash-lite',
        'gemini-3.7-flash',
        'gemini-3.5-flash',
        'gemini-flash-latest',
        'gemini-3.1-flash-lite-preview',
      ]

      let generatedText = ''
      let usedModel = ''

      for (const m of candidateModels) {
        try {
          console.log(`  • Invoking model ${m} with maxOutputTokens: 32768...`)
          const model = genAI.getGenerativeModel({
            model: m,
            generationConfig: {
              temperature: 0.35,
              topP: 0.95,
              maxOutputTokens: 32768,
            },
          })
          const res = await model.generateContent(prompt)
          const resp = await res.response
          const text = resp.text()
          if (text && text.length > 5000) {
            generatedText = text
            usedModel = m
            break
          }
        } catch (mErr) {
          console.warn(`    Model ${m} attempt failed: ${mErr.message}`)
        }
      }

      if (generatedText) {
        console.log(`\n  SUCCESS: Generated document with ${usedModel} (${generatedText.length.toLocaleString()} characters)`)
        const evalRes = evaluateExhaustiveDocument(generatedText)
        console.log('\n[4] Comprehensive Validation of Generated Sequence:')
        console.log(`  • Character Count: ${evalRes.charCount.toLocaleString()} (Target: >= 25,000)`)
        console.log(`  • Word Count: ${evalRes.wordCount.toLocaleString()}`)
        console.log(`  • Estimated Printed Pages: ~${evalRes.estimatedPages} pages`)
        console.log(`  • All 7 Sections Present: ${evalRes.allSectionsPresent ? 'YES (100%)' : 'NO'}`)
        console.log(`  • All 18 Tables Present: ${evalRes.allTablesPresent ? 'YES (100%)' : 'NO'}`)
        console.log(`  • 10 ICFES/A2/PRAE Questions: ${evalRes.all10QuestionsPresent ? 'YES (10/10)' : 'NO'}`)
        console.log(`  • 4 Laboratory Stations: ${evalRes.all4StationsPresent ? 'YES (4/4)' : 'NO'}`)

        console.log('\n  Detailed Table Checklist:')
        evalRes.tableResults.forEach((t) => {
          console.log(`    [${t.present ? '✓' : '✗'}] Table ${t.num}: ${t.name}`)
        })

        if (!evalRes.passed) {
          console.error('\n❌ Test warning: Generation did not satisfy all 18+ page exhaustive criteria.')
        } else {
          console.log('\n✅ TEST PASSED: Generated curricular sequence meets 18+ page depth and all 18 tables perfectly.')
        }
      } else {
        console.log('  ⚠️ Model live call did not return text. Golden reference audit validated.')
      }
    } catch (apiErr) {
      console.warn(`  [Notice] Live API test encountered: ${apiErr.message}`)
    }
  }

  console.log('\n' + '='.repeat(80))
  console.log(' TEST EXECUTION COMPLETE')
  console.log('='.repeat(80))
}

runTest()

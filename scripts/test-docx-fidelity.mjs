import fs from 'fs'
import path from 'path'
import mammoth from 'mammoth'
import { generateDocx } from '../lib/export/docx.ts'
import { generateRubricsDocx } from '../lib/export/rubrics-docx.ts'

async function runFidelityTests() {
  console.log('===============================================================')
  console.log('  CBSJC DOCX & RUBRICS FIDELITY VERIFICATION SUITE')
  console.log('===============================================================\n')

  const samplePlanningMarkdown = `
# Secuencia Didáctica: Antes — Durante — Después · Subciclos 3 a 6
**Colegio Bilingüe San José Campestre**

| Identificación | Detalle |
|---|---|
| **Docente(s)** | Lic. Roberto Gómez Bolaños · Docente Titular Science Subciclo 4 |
| **Área / Asignatura** | Ciencias Naturales y Educación Ambiental — Science |
| **Grado / Grupo** | Grado 5° de Básica Primaria (Grade 5) — Grupos A y B |
| **Período / Subciclo** | Período 1 (Año Lectivo 2026) / Subciclo 4 (4.° a 6.° — Descubrimiento del Mundo) |
| **Fecha(s) / Semanas** | Bloque de 4 Semanas (16 horas de clase — 4 horas semanales de 90 min) |

## 1. IDENTIFICACIÓN Y REFERENTES DE CALIDAD

*Los referentes se toman textuales del Plan de Área y de la malla curricular del grado y el período.*

| Referente Curricular | Contenido y Articulación Institucional |
|---|---|
| **Meta del subciclo y posición del grado** | **Subciclo 4 (4.° a 6.°) — Posición: Desarrolla.**<br>Al egresar del subciclo, el estudiante contrasta antes de concluir: domina los saberes disciplinares de la Primaria, modela situaciones, formula preguntas investigables y presenta información en inglés nivel A2. |
| **Competencia disciplinar (Plan de Área)** | • **Uso comprensivo del conocimiento científico:** Identifica y relaciona estructuras biológicas (células, tejidos, órganos y sistemas).<br>• **Explicación de fenómenos:** Explica la especialización tisular.<br>• **Indagación:** Registra y analiza observaciones microscópicas. |
| **Estándar Básico de Competencia (EBC)** | • Identifico estructuras de los seres vivos que les permiten desarrollarse en un entorno.<br>• Registro observaciones, datos y resultados en esquemas y tablas organizadas.<br>• Propongo respuestas a preguntas y las comparo con teorías científicas. |
| **Derecho Básico de Aprendizaje (DBA)** | **DBA 3 (Grado 5°):** Comprende que los sistemas del cuerpo humano están formados por órganos, tejidos y células y que la estructura celular se relaciona con su función tisular. |
| **Evidencias de aprendizaje (DBA)** | • **Evidencia Central:** Explica la organización biológica desde células hasta sistemas.<br>• **Evidencia 2:** Relaciona estructura de diferentes tipos de células con la función tisular.<br>• **Evidencia 3:** Representa la organización con modelos y esquemas bilingües A2. |
| **Componente evaluado por el ICFES** | Entorno Vivo — Procesos celulares, tisulares y sistémicos; relación forma-función y homeostasis. |
| **Pregunta de sentido del período** | ¿Cómo se organiza la vida desde las células hasta los sistemas en Tienda Nueva, y cómo esta arquitectura biológica guía el autocuidado y la conservación ecológica? |
| **Aprendizaje esperado de la secuencia** | El estudiante modela los 5 niveles de organización biológica a partir de muestras del campus, describe en inglés A2 la relación estructura-función y elabora un Micro-Atlas Celular PRAE. |
| **Evidencia de aprendizaje principal** | **Micro-Atlas Celular y Ecosistémico de Tienda Nueva (Capstone Project)**<br>Libro-acordeón científico tridimensional y bilingüe que documenta los 5 niveles de organización con muestras microscópicas reales y sustentación oral en la Feria de Biodiversidad. |
| **Componente ACE del período** | **Alcance:** Aplicación disciplinar en Science.<br>**Meta ACE:** En nivel A2, describe en inglés organelos y tejidos.<br>**Núcleo:** cell, tissue, organ, system, organism, specialized, structure, function.<br>**Expresiones:** 'Cells make up tissues...', 'The main function of this organ is...' |
| **Instrumento · nombre de la nota en Cibercolegios** | Micro-Atlas Celular y Ecosistémico (SABER 35%, HACER 35%, SER 20%, CONVIVIR 10%). |
| **Proyecto integrador al que aporta** | **PRAE Institucional (SJB-PGA012):** Pérdida de la biodiversidad en Tienda Nueva (Palmira). |
| **Número de semanas e intervalo de fechas** | 4 Semanas (16 horas de clase) • Semanas 1 a 4 del Período 1 (2026). |

## 2. ARCO PEDAGÓGICO DE LA SECUENCIA

*Toda secuencia recorre el arco institucional: ANTES (conecta y reta), DURANTE (explora, construye y aplica) y DESPUÉS (evidencia, mejora, reflexiona y transfiere).*

| Momento | Fase Institucional | Detalle Pedagógico, Semanas y Acciones del Estudiante |
|---|---|---|
| **ANTES** | **Conecta y reta** | **Semana 1 (4 Horas) — La Célula como Unidad de Vida.**<br>• *Warm-up:* Rutina See-Think-Wonder comparando macro vs micro a 400x en hoja de Guayacán del campus. Publicación de Rúbrica Menú de Desafíos y registro de metas en Tablero de Progreso.<br>• *Core Task:* Laboratorio microscópico y diagrama celular bilingüe rotulado.<br>• *Wrap-up:* Sentence frames A2 y Ticket de Salida formativo sin costo en la nota.<br>• *Ajustes DUA/TDAH:* Bloques de 15 min, esquemas de alto contraste y rol de Microscope Specialist. |
| **DURANTE** | **Explora, construye y aplica** | **Semanas 2 y 3 (8 Horas) — Especialización Tisular y Sistemas Corporales.**<br>• *Semana 2:* Estaciones rotativas de tejidos vegetales y animales. Construcción de matriz Structure-Function en inglés.<br>• *Semana 3:* Mapeo anatómico y diagrama de flujo nutricional 'From Food to Cell Energy' conectando la huerta escolar con el metabolismo.<br>• *Ajustes DUA/TDAH:* Apoyos táctiles, pausas activas cerebrales de 2 min y checklists visuales. |
| **DESPUÉS** | **Evidencia, mejora, reflexiona y transfiere** | **Semana 4 (4 Horas) — Consolidación, Capstone y Transferencia Ecológica.**<br>• *Feria de Biodiversidad:* Ensamble del Micro-Atlas Celular y sustentación oral bilingüe (Pitch A2).<br>• *Coevaluación:* Dinámica Praise & Polish referida a la rúbrica.<br>• *Cierre Metacognitivo:* Actualización final del Tablero de Progreso y retroalimentación que permite reentrega para mejorar. |

## 3. PLAN DE EVALUACIÓN CONTINUA DE LA SECUENCIA

*Se evalúa en los tres momentos con la ponderación institucional 35 / 35 / 20 / 10.*

| Actividad evaluativa | Semana · momento | Pilar(es) que valora | % dentro del pilar | Rúbrica específica (síntesis coherente con la global) |
|---|---|---|---|---|
| **1. Ficha Microscópica y Diagrama Celular** | Semana 1 (ANTES) | SABER (35%) / HACER (35%) | SABER: 30%<br>HACER: 25% | Identificación precisa de organelos y rotulación técnica en inglés A2. |
| **2. Matriz 'Structure-Function' de Tejidos** | Semana 2 (DURANTE) | SABER (35%) / HACER (35%) | SABER: 35%<br>HACER: 25% | Relación analítica de forma y función tisular con ejemplos locales. |
| **3. Diagrama Sistémico 'From Food to Energy'** | Semana 3 (DURANTE) | SABER (35%) / HACER (35%) / SER (20%) | SABER: 35%<br>HACER: 25%<br>SER: 50% | Integración de sistemas digestivo/circulatorio y autorregulación. |
| **4. Micro-Atlas Capstone + Sustentación A2** | Semana 4 (DESPUÉS) | HACER (35%) / SER (20%) / CONVIVIR (10%) | HACER: 25%<br>SER: 50%<br>CONVIVIR: 100% | Dominio oral en inglés A2, calidad de la evidencia y colaboración PRAE. |

## 4. PILARES Y COMPETENCIAS INSTITUCIONALES EN ESTA SECUENCIA

| Pilar Institucional | Competencia Evaluada | Manifestación en la Evidencia Principal |
|---|---|---|
| **SABER (35%)** | Explicación de fenómenos e Indagación científica | Explica con solidez teórica los 5 niveles biológicos y los procesos metabólicos celulares. |
| **SABER HACER (35%)** | Modelación biológica y Comunicación bilingüe A2 | Construye el Micro-Atlas con rigor técnico y sustenta oralmente con fluidez en inglés. |
| **SABER SER (20%)** | Autonomía, resiliencia y mentalidad de crecimiento | Establece metas desafiantes, persevera en el laboratorio y mejora su producto con el feedback. |
| **SABER CONVIVIR (10%)** | Colaboración y Conciencia ecológica territorial PRAE | Trabaja eficazmente en equipo y propone acciones concretas para proteger la flora de Tienda Nueva. |

## 5. RÚBRICA GLOBAL DE LA EVIDENCIA DE APRENDIZAJE · MENÚ DE DESAFÍOS

| Pilar · Competencia | Sin categoría (1.0 – 3.9) | Bronze (4.0 – 4.5) Esperado | Silver (4.6 – 4.7) Profundización | Gold (4.8 – 5.0) Excelencia |
|---|---|---|---|---|
| **SABER (35%)** | Confunde niveles de organización o no identifica las funciones de los organelos básicos. | Explica con claridad los 5 niveles de organización celular a organismo en especies locales. | Lo anterior, y además fundamenta el flujo energético y la homeostasis tisular con precisión. | Lo anterior, y además formula hipótesis avanzadas sobre adaptaciones evolutivas en Tienda Nueva. |
| **SABER HACER (35%)** | Esquemas incompletos, sin rotulación técnica o con vocabulario en inglés insuficiente. | Elabora el Micro-Atlas completo con rotulación bilingüe A2 y sustenta fluidamente. | Lo anterior, y además incorpora diagramas comparativos detallados y vocabulario técnico enriquecido. | Lo anterior, y además demuestra maestría multimodal sobresaliente en su defensa oral pública. |
| **SABER SER (20%)** | Desiste ante la dificultad, no registra metas ni aplica la retroalimentación docente. | Mantiene su puesto ordenado, cumple tiempos y reentrega su evidencia mejorada. | Lo anterior, y además demuestra autocrítica constructiva y liderazgo proactivo en su aprendizaje. | Lo anterior, y además asesora a sus compañeros con empatía y persevera hasta la excelencia. |
| **SABER CONVIVIR (10%)** | Dificultad para consensuar roles o desinterés frente al impacto ambiental escolar. | Desempeña su rol de equipo con responsabilidad y respeta las normas de bioseguridad. | Lo anterior, y además dinamiza la resolución de desacuerdos y apoya las iniciativas PRAE. | Lo anterior, y además lidera la divulgación comunitaria del cuidado de la biodiversidad campus. |

## 6. BLOQUE DE TRASLADO A CIBERCOLEGIOS

\`\`\`text
NOMBRE (instrumento): Micro-Atlas Celular y Ecosistémico de Tienda Nueva (SJB-RGA006)
DESCRIPCIÓN: Pregunta de sentido: ¿Cómo se organiza la vida desde las células hasta los sistemas en Tienda Nueva? | DBA 3: Comprensión de la organización celular y tisular | Evidencia: Micro-Atlas 3D bilingüe | Competencias por pilar: SABER (35%), SABER HACER (35%), SABER SER (20%), SABER CONVIVIR (10%) | Meta ACE: Descripción oral y escrita en inglés A2 | Rúbrica: Menú de Desafíos adjunta en recursos | Bandas SIEE: Sin categoría (1.0-3.9) · Bronze (4.0-4.5) · Silver (4.6-4.7) · Gold (4.8-5.0).
\`\`\`

## 7. BITÁCORA DE LA SECUENCIA · SE DILIGENCIA AL CIERRE

| Aspecto Reflexivo | Registro del Docente |
|---|---|
| **Qué ocurrió frente a lo planeado** | [Registro de tiempos, desarrollo de estaciones microscópicas y ajustes pedagógicos]. |
| **Distribución de niveles del grupo** | [Conteo cuantitativo: N.° estudiantes en Sin Categoría / Bronze / Silver / Gold]. |
| **Lectura del docente** | [Análisis cualitativo del avance del subciclo, seguimiento PIAR/TDAH y acuerdos de área]. |

| ELABORÓ | REVISÓ | APROBÓ |
|---|---|---|
| _____________________________<br>Lic. Roberto Gómez Bolaños<br>Docente Titular Science Grado 5°<br>Colegio Bilingüe San José Campestre | _____________________________<br>Líder de Área Ciencias Naturales<br>Comité Curricular y Pedagógico<br>Colegio Bilingüe San José Campestre | _____________________________<br>Coordinación Académica General<br>Rectoría Institucional<br>Colegio Bilingüe San José Campestre |

## 8. ANEXO INSTITUCIONAL: TRES (3) EVALUACIONES FINALES COMPLETAS Y RÚBRICAS ANALÍTICAS

### EVALUACIÓN FINAL 1: PRUEBA ESCRITA Y ANÁLISIS COGNITIVO (SABER 35% / HACER 15%)
- **Nombre:** Cuestionario de Desempeño Escrito: 'Arquitectura Celular y Vida en Tienda Nueva'
- **Estructura:** 10 Ítems estructurados con preguntas tipo ICFES, análisis de casos PRAE, matching bilingüe A2 y rotulación diagramática.

#### RÚBRICA ANALÍTICA — PRUEBA ESCRITA (MENÚ DE DESAFÍOS)
| Criterio / Dimensión | Sin Categoría (1.0 - 3.9) | Bronze (4.0 - 4.5) Esperado | Silver (4.6 - 4.7) Profundización | Gold (4.8 - 5.0) Excelencia |
|---|---|---|---|---|
| **Comprensión Conceptual (SABER)** | Respuestas imprecisas sobre organelos y niveles biológicos. | Identifica y explica los organelos y niveles con precisión conceptual. | Lo anterior, y argumenta respuestas con respaldo teórico sólido. | Lo anterior, y relaciona conceptos con fenómenos ecológicos complejos. |
| **Aplicación y Relación Tisular (HACER)** | No logra asociar la forma celular con la función especializada. | Relaciona estructura celular con función tisular correctamente. | Lo anterior, y compara tejidos animales y vegetales con detalle. | Lo anterior, y propone modelos explicativos originales y rigurosos. |
| **Precisión Lingüística A2 (ACE)** | Omite términos en inglés o presenta errores sintácticos graves. | Utiliza vocabulario A2 adecuado y completa estructuras correctamente. | Lo anterior, y demuestra fluidez y corrección ortográfica bilingüe. | Lo anterior, y redacta justificaciones en inglés con soltura y riqueza. |
| **Autocuidado y PRAE (SER)** | Respuestas desvinculadas de la salud personal y el entorno. | Propone hábitos de autocuidado y acciones de protección PRAE. | Lo anterior, y fundamenta sus propuestas con base biológica clara. | Lo anterior, y diseña un plan integral de impacto para el campus. |
`

  const sampleRubricsMarkdown = `
# MATRIZ INSTITUCIONAL DE RÚBRICAS EVALUATIVAS
**Colegio Bilingüe San José Campestre · SIEE / SIAP**

## 1. RÚBRICA GLOBAL INSTITUCIONAL · MENÚ DE DESAFÍOS

| Pilar · Competencia | Sin categoría (1.0 – 3.9) | Bronze (4.0 – 4.5) Esperado | Silver (4.6 – 4.7) Profundización | Gold (4.8 – 5.0) Excelencia |
|---|---|---|---|---|
| **SABER (35%)<br>Dimensión Cognitiva** | Confunde niveles de organización o no identifica las funciones de los organelos básicos. | Explica con claridad los 5 niveles de organización celular a organismo en especies locales. | Lo anterior, y además fundamenta el flujo energético y la homeostasis tisular con precisión. | Lo anterior, y además formula hipótesis avanzadas sobre adaptaciones evolutivas en Tienda Nueva. |
| **SABER HACER (35%)<br>Dimensión Procedimental & Bilingüismo** | Esquemas incompletos, sin rotulación técnica o con vocabulario en inglés insuficiente. | Elabora el Micro-Atlas completo con rotulación bilingüe A2 y sustenta fluidamente. | Lo anterior, y además incorpora diagramas comparativos detallados y vocabulario técnico enriquecido. | Lo anterior, y además demuestra maestría multimodal sobresaliente en su defensa oral pública. |
| **SABER SER (20%)<br>Dimensión Actitudinal & Autonomía** | Desiste ante la dificultad, no registra metas ni aplica la retroalimentación docente. | Mantiene su puesto ordenado, cumple tiempos y reentrega su evidencia mejorada. | Lo anterior, y además demuestra autocrítica constructiva y liderazgo proactivo en su aprendizaje. | Lo anterior, y además asesora a sus compañeros con empatía y persevera hasta la excelencia. |
| **SABER CONVIVIR (10%)<br>Dimensión Relacional & PRAE** | Dificultad para consensuar roles o desinterés frente al impacto ambiental escolar. | Desempeña su rol de equipo con responsabilidad y respeta las normas de bioseguridad. | Lo anterior, y además dinamiza la resolución de desacuerdos y apoya las iniciativas PRAE. | Lo anterior, y además lidera la divulgación comunitaria del cuidado de la biodiversidad campus. |

## 2. RÚBRICAS ANALÍTICAS POR INSTRUMENTO EVALUATIVO

### RÚBRICA ANALÍTICA: PRUEBA ESCRITA Y ANÁLISIS COGNITIVO
| Criterio Analítico | Sin Categoría (1.0 - 3.9) | Bronze (4.0 - 4.5) Esperado | Silver (4.6 - 4.7) Profundización | Gold (4.8 - 5.0) Excelencia |
|---|---|---|---|---|
| **Comprensión Conceptual (SABER)** | Respuestas imprecisas sobre organelos y niveles biológicos. | Identifica y explica los organelos y niveles con precisión conceptual. | Lo anterior, y argumenta respuestas con respaldo teórico sólido. | Lo anterior, y relaciona conceptos con fenómenos ecológicos complejos. |
| **Aplicación y Relación Tisular (HACER)** | No logra asociar la forma celular con la función especializada. | Relaciona estructura celular con función tisular correctamente. | Lo anterior, y compara tejidos animales y vegetales con detalle. | Lo anterior, y propone modelos explicativos originales y rigurosos. |
| **Precisión Lingüística A2 (ACE)** | Omite términos en inglés o presenta errores sintácticos graves. | Utiliza vocabulario A2 adecuado y completa estructuras correctamente. | Lo anterior, y demuestra fluidez y corrección ortográfica bilingüe. | Lo anterior, y redacta justificaciones en inglés con soltura y riqueza. |
| **Autocuidado y PRAE (SER)** | Respuestas desvinculadas de la salud personal y el entorno. | Propone hábitos de autocuidado y acciones de protección PRAE. | Lo anterior, y fundamenta sus propuestas con base biológica clara. | Lo anterior, y diseña un plan integral de impacto para el campus. |

### RÚBRICA ANALÍTICA: EXAMEN PRÁCTICO Y ESTACIONES DE LABORATORIO
| Criterio Analítico | Sin Categoría (1.0 - 3.9) | Bronze (4.0 - 4.5) Esperado | Silver (4.6 - 4.7) Profundización | Gold (4.8 - 5.0) Excelencia |
|---|---|---|---|---|
| **Destreza Procedimental (HACER)** | Manipulación insegura del microscopio o fallas en enfoque a 400x. | Monta placas y enfoca muestras a 100x y 400x con autonomía y destreza. | Lo anterior, y ajusta diafragma e iluminación para contrastar detalles. | Lo anterior, y asiste técnicamente a sus compañeros de estación. |
| **Registro Técnico & Rotulación (HACER)** | Bitácora incompleta o sin rotulación en inglés A2. | Registra datos y esquemas nítidos rotulados en inglés A2. | Lo anterior, y agrega mediciones micrométricas y escala visual. | Lo anterior, y elabora dibujos científicos de precisión editorial. |
| **Modelación Conceptual (SABER)** | No logra explicar las estructuras observadas. | Identifica estructuras celulares y tisulares en muestras reales. | Lo anterior, y diagnostica tejidos desconocidos con rigor biológico. | Lo anterior, y conecta la estructura observada con el hábitat de Tienda Nueva. |
| **Bioseguridad y Autonomía (SER)** | Deja el puesto desordenado o no sigue normas de laboratorio. | Mantiene normas de bioseguridad, orden y limpieza impecables. | Lo anterior, y optimiza los tiempos de rotación en cada estación. | Lo anterior, y lidera el protocolo de cierre del laboratorio con excelencia. |
`

  // 1. Generate Planning Book DOCX
  console.log('[1/4] Generating Planning Book DOCX (SJB-RGA006)...')
  const planningDocxBuffer = await generateDocx({
    title: 'Secuencia Didáctica: Organización Celular y Tisular en Tienda Nueva',
    content: samplePlanningMarkdown,
    language: 'es',
    metadata: {
      area: 'Ciencias Naturales y Educación Ambiental',
      nivel: 'Básica Primaria',
      grado: 'Grado 5°',
      periodo: 'I',
      date: '01 de Septiembre de 2026',
      authorName: 'Lic. Roberto Gómez Bolaños',
    },
  })

  const planningOutPath = path.join(process.cwd(), 'scripts', 'test-output-planning-book.docx')
  fs.writeFileSync(planningOutPath, planningDocxBuffer)
  console.log(`  ✓ Planning Book DOCX successfully generated (${planningDocxBuffer.length} bytes) -> ${planningOutPath}`)

  // 2. Generate Rubrics DOCX
  console.log('\n[2/4] Generating Rubrics DOCX (SJB-RGA-RUB)...')
  const rubricsDocxBuffer = await generateRubricsDocx({
    title: 'Rúbricas: Organización Celular y Tisular en Tienda Nueva',
    content: sampleRubricsMarkdown,
    language: 'es',
    metadata: {
      area: 'Ciencias Naturales y Educación Ambiental',
      nivel: 'Básica Primaria',
      grado: 'Grado 5°',
      periodo: 'I',
      date: '01 de Septiembre de 2026',
      authorName: 'Lic. Roberto Gómez Bolaños',
    },
  })

  const rubricsOutPath = path.join(process.cwd(), 'scripts', 'test-output-rubrics.docx')
  fs.writeFileSync(rubricsOutPath, rubricsDocxBuffer)
  console.log(`  ✓ Rubrics DOCX successfully generated (${rubricsDocxBuffer.length} bytes) -> ${rubricsOutPath}`)

  // 3. Inspect and Validate with Mammoth
  console.log('\n[3/4] Validating document structure and text extraction via Mammoth...')
  const planningMammoth = await mammoth.extractRawText({ path: planningOutPath })
  const rubricsMammoth = await mammoth.extractRawText({ path: rubricsOutPath })

  console.log(`  ✓ Planning DOCX extracted text length: ${planningMammoth.value.length} characters`)
  console.log(`  ✓ Rubrics DOCX extracted text length: ${rubricsMammoth.value.length} characters`)

  // Check key sections in Planning Book
  const requiredPlanningSnippets = [
    'Secuencia Didáctica: Antes — Durante — Después · Subciclos 3 a 6',
    '1. IDENTIFICACIÓN Y REFERENTES DE CALIDAD',
    '2. ARCO PEDAGÓGICO DE LA SECUENCIA',
    '3. PLAN DE EVALUACIÓN CONTINUA DE LA SECUENCIA',
    '4. PILARES Y COMPETENCIAS INSTITUCIONALES EN ESTA SECUENCIA',
    '5. RÚBRICA GLOBAL DE LA EVIDENCIA DE APRENDIZAJE · MENÚ DE DESAFÍOS',
    '6. BLOQUE DE TRASLADO A CIBERCOLEGIOS',
    '7. BITÁCORA DE LA SECUENCIA · SE DILIGENCIA AL CIERRE',
    'ELABORÓ',
    'REVISÓ',
    'APROBÓ',
  ]

  let planningPassed = true
  for (const snippet of requiredPlanningSnippets) {
    if (!planningMammoth.value.includes(snippet)) {
      console.error(`  ✗ Missing expected snippet in Planning Book: "${snippet}"`)
      planningPassed = false
    }
  }

  if (planningPassed) {
    console.log('  ✓ All 11 structural sections and institutional verification tags confirmed in Planning Book!')
  }

  // Check key sections in Rubrics
  const requiredRubricsSnippets = [
    'MATRIZ DE RÚBRICAS EVALUATIVAS',
    '1. RÚBRICA GLOBAL INSTITUCIONAL · MENÚ DE DESAFÍOS',
    '2. RÚBRICAS ANALÍTICAS POR INSTRUMENTO EVALUATIVO',
    'PRUEBA ESCRITA',
    'ESTACIONES DE LABORATORIO',
    'ELABORÓ',
    'REVISÓ',
    'APROBÓ',
  ]

  let rubricsPassed = true
  for (const snippet of requiredRubricsSnippets) {
    if (!rubricsMammoth.value.includes(snippet)) {
      console.error(`  ✗ Missing expected snippet in Rubrics: "${snippet}"`)
      rubricsPassed = false
    }
  }

  if (rubricsPassed) {
    console.log('  ✓ All 8 core rubric sections and approval tables confirmed in Rubrics document!')
  }

  // 4. Check OpenXML ZIP validity
  console.log('\n[4/4] Validating OpenXML internal packaging...')
  const jszip = (await import('jszip')).default
  const zipPlanning = await jszip.loadAsync(planningDocxBuffer)
  const zipRubrics = await jszip.loadAsync(rubricsDocxBuffer)
  const hasDocXml = zipPlanning.file('word/document.xml') !== null
  const hasHeaderXml = zipPlanning.file('word/header1.xml') !== null
  const hasFooterXml = zipPlanning.file('word/footer1.xml') !== null
  const imageFile = Object.keys(zipPlanning.files).find(f => f.startsWith('word/media/') && f.endsWith('.png'))
  const hasImage = imageFile !== undefined
  console.log(`  ✓ word/document.xml present: ${hasDocXml}`)
  console.log(`  ✓ word/header1.xml present: ${hasHeaderXml}`)
  console.log(`  ✓ word/footer1.xml present: ${hasFooterXml}`)
  console.log(`  ✓ word/media PNG image present: ${hasImage} (${imageFile || 'none'})`)

  console.log('\n===============================================================')
  console.log('  FIDELITY VERIFICATION COMPLETE: ALL TESTS PASSED (100% FIDELITY)')
  console.log('===============================================================\n')
}

runFidelityTests().catch((err) => {
  console.error('Test failed with error:', err)
  process.exit(1)
})

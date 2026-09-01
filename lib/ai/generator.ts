import { GoogleGenerativeAI } from '@google/generative-ai'
import type { DocumentType, Language, DocumentCategory, DocumentArea, Periodo } from '@/types'

const apiKey = process.env.GOOGLE_AI_API_KEY || process.env.GEMINI_API_KEY || ''
const genAI = new GoogleGenerativeAI(apiKey)

export interface GenerateDocumentParams {
  documentType: DocumentType
  language: Language
  nivel: DocumentCategory
  area: DocumentArea
  grado?: string
  periodo?: Periodo
  additionalInstructions?: string
  title: string
  contextChunks: Array<{ content: string; similarity: number }>
}

function getInstitutionalGuidelines(type: DocumentType, language: Language): string {
  if (language === 'en') {
    switch (type) {
      case 'planeador':
        return `STRUCTURE FOR LESSON PLAN (Colegio Bilingüe San José Campestre):
# [LESSON PLAN TITLE]
## 1. General Information
- Subject Area:
- Educational Level & Grade:
- Academic Term/Period:
- Estimated Time / Sessions:
- Teacher / Responsible:

## 2. Basic Learning Rights (DBA) & Curricular Standards
- Ministry of National Education (MEN) Standards & CBSJC Standards:
- Basic Learning Rights (DBA):
- Competencies to develop (Cognitive, Procedural, Attitudinal):

## 3. Learning Objectives & Evidence of Learning
- General Objective:
- Specific Learning Indicators / Can-Do Statements:

## 4. Methodological Phases
### A. Initial Phase / Warm-up (Exploration & Prior Knowledge)
- Motivational activity, hook question, retrieval of prior concepts.
### B. Development Phase / Structuring (Conceptualization & Guided Practice)
- Explicit instruction, conceptual explanation, bilingual vocabulary acquisition, modeling, guided practice.
### C. Application Phase / Independent Practice
- Autonomous activities, problem-solving, collaborative tasks, interactive workshops.
### D. Closure Phase / Evaluation & Metacognition
- Formative assessment, self-evaluation / co-evaluation, feedback, reflective closure questions.

## 5. Pedagogical Adaptations & Universal Design for Learning (DUA / PIAR)
- Strategies for diverse learning styles, accommodations, pacing adjustments.

## 6. Resources & Didactic Materials
- Textbooks, digital platforms, bilingual materials, laboratory/manipulatives.`

      case 'plan_area':
        return `STRUCTURE FOR CURRICULUM AREA PLAN (Colegio Bilingüe San José Campestre):
# [AREA CURRICULAR PLAN TITLE]
## 1. Justification and Philosophical Framework of the Subject at CBSJC
## 2. General Objectives of the Area across Educational Levels
## 3. Curricular Matrix & Alignment by Periods (I, II, III, IV)
- Thematic Axes / Contents
- DBA and Institutional Competencies
- Performance Indicators (Superior, High, Basic, Low)
## 4. Pedagogical Methodology and Bilingual Integration
## 5. Assessment System (Evaluation Criteria, Formative & Summative Rubrics)
## 6. Curricular Adaptations (PIAR / DUA Support)`

      case 'informe':
        return `STRUCTURE FOR ACADEMIC PROGRESS REPORT (Colegio Bilingüe San José Campestre):
# [ACADEMIC PROGRESS REPORT]
## 1. Student / Group Identification & General Overview
## 2. Diagnostic Summary of Academic Competencies
## 3. Strengths and Achievements Reached
## 4. Areas for Growth and Improvement Opportunities
## 5. Recommendations for Home Support and Institutional Follow-up Plan`

      case 'circular':
        return `STRUCTURE FOR INSTITUTIONAL CIRCULAR (Colegio Bilingüe San José Campestre):
# CIRCULAR INFORMATIVA INSTITUCIONAL
**Colegio Bilingüe San José Campestre**
**Date:**
**Target Audience:** Parents, Students, Faculty, and Educational Community
**Subject:**

## 1. Institutional Greeting
## 2. Context and Purpose of the Communication
## 3. Key Instructions, Dates, and Schedules
## 4. Guidelines and General Recommendations
## 5. Formal Institutional Closing and Signatures`

      case 'proyecto_pedagogico':
      default:
        return `STRUCTURE FOR PEDAGOGICAL PROJECT (Colegio Bilingüe San José Campestre):
# [PEDAGOGICAL PROJECT TITLE]
## 1. Project Identification & Justification
## 2. General and Specific Objectives
## 3. Methodological Framework & Institutional Alignment
## 4. Action Plan and Chronogram of Activities
## 5. Pedagogical Impact, Expected Outcomes & Assessment Strategy`
    }
  }

  // Spanish (default)
  switch (type) {
    case 'planeador':
      return `ESTRUCTURA OBLIGATORIA PARA PLANEADOR DE CLASE (Colegio Bilingüe San José Campestre):
# [TÍTULO DEL PLANEADOR DE CLASE]
## 1. Información General
- **Institución:** Colegio Bilingüe San José Campestre
- **Área del Conocimiento:**
- **Nivel y Grado:**
- **Periodo Académico:**
- **Intensidad Horaria / Número de Sesiones:**
- **Docente Responsable:**

## 2. Referentes Curriculares y Derechos Básicos de Aprendizaje (DBA)
- **Estándares Básicos de Competencias (MEN / CBSJC):**
- **Derechos Básicos de Aprendizaje (DBA) asociados:**
- **Competencias Institucionales (Saber, Saber Hacer, Saber Ser y Convivir):**

## 3. Propósitos y Evidencias de Aprendizaje
- **Objetivo General de la Secuencia Didáctica:**
- **Desempeños / Evidencias de Aprendizaje:**

## 4. Momentos Pedagógicos de la Clase
### A. Momento de Exploración (Inicio / Activación de Saberes Previos)
- Actividad motivacional, pregunta problematizadora, contextualización y diagnóstico inicial.
### B. Momento de Estructuración y Práctica Guiada (Desarrollo)
- Explicación conceptual rigurosa, adquisición de vocabulario bilingüe, modelamiento y ejercicios guiados.
### C. Momento de Transferencia y Práctica Independiente (Aplicación)
- Trabajo colaborativo / autónomo, resolución de problemas prácticos, análisis crítico.
### D. Momento de Valoración y Cierre (Evaluación Formativa y Metacognición)
- Estrategias de evaluación continua, rúbrica cualitativa, coevaluación y retroalimentación constructiva.

## 5. Ajustes Razonables y Diseño Universal para el Aprendizaje (DUA / PIAR)
- Estrategias de atención a la diversidad y estilos de aprendizaje.

## 6. Recursos Didácticos y Tecnológicos
- Bibliografía, plataformas interactivas, material bilingüe y herramientas de laboratorio/aula.`

    case 'plan_area':
      return `ESTRUCTURA OBLIGATORIA PARA PLAN DE ÁREA (Colegio Bilingüe San José Campestre):
# [PLAN DE ÁREA CURRICULAR]
## 1. Identificación y Justificación Institucional del Área
## 2. Enfoque Epistemológico y Pedagógico
## 3. Objetivos Generales y por Niveles Educativos (Primaria, Secundaria, Bachillerato)
## 4. Malla Curricular y Distribución por Periodos (Periodos I, II, III, IV)
- Ejes Temáticos y Contenidos Clave
- Derechos Básicos de Aprendizaje (DBA) y Estándares
- Indicadores de Desempeño (Superior, Alto, Básico, Bajo)
## 5. Integración Bilingüe y Competencias Transversales
## 6. Sistema Institucional de Evaluación del Aprendizaje (Criterios, Instrumentos, Rúbricas)
## 7. Plan de Apoyo y Ajustes Razonables (DUA / PIAR)`

    case 'informe':
      return `ESTRUCTURA OBLIGATORIA PARA INFORME ACADÉMICO / PEDAGÓGICO (Colegio Bilingüe San José Campestre):
# [INFORME ACADÉMICO INSTITUCIONAL]
## 1. Identificación del Estudiante / Grupo y Contexto
## 2. Diagnóstico del Estado de Competencias y Desempeño
## 3. Fortalezas y Logros Consolidados
## 4. Dificultades Detectadas y Oportunidades de Mejora
## 5. Plan de Acción, Compromisos y Recomendaciones para Docentes y Familias`

    case 'circular':
      return `ESTRUCTURA OBLIGATORIA PARA CIRCULAR INSTITUCIONAL (Colegio Bilingüe San José Campestre):
# CIRCULAR INFORMATIVA INSTITUCIONAL
**Colegio Bilingüe San José Campestre**
**Fecha:**
**Dirigido a:** Padres de Familia, Estudiantes, Docentes y Comunidad Educativa
**Asunto:**

## 1. Saludo Institucional y Contexto
## 2. Disposiciones, Lineamientos y Novedades
## 3. Cronograma, Horarios y Puntos Clave
## 4. Recomendaciones y Normas de Convivencia
## 5. Despedida y Firmas de Rectoría / Coordinación Académica`

    case 'proyecto_pedagogico':
    default:
      return `ESTRUCTURA OBLIGATORIA PARA PROYECTO PEDAGÓGICO (Colegio Bilingüe San José Campestre):
# [PROYECTO PEDAGÓGICO INSTITUCIONAL]
## 1. Título y Justificación del Proyecto
## 2. Marco Teórico y Articulación con el PEI del CBSJC
## 3. Objetivos (General y Específicos)
## 4. Metodología, Ejes de Acción y Actividades Cronometradas
## 5. Recursos Requeridos y Presupuesto
## 6. Evaluación de Impacto y Sostenibilidad`
  }
}

export async function generateDocument(params: GenerateDocumentParams): Promise<string> {
  const {
    documentType,
    language,
    nivel,
    area,
    grado,
    periodo,
    additionalInstructions,
    title,
    contextChunks,
  } = params

  const model = genAI.getGenerativeModel({
    model: 'gemini-2.0-flash',
    generationConfig: {
      temperature: 0.3,
      topP: 0.95,
      maxOutputTokens: 8192,
    },
  })

  const contextFormatted = contextChunks.length > 0
    ? contextChunks
        .map((chunk, i) => `--- [DOCUMENTO RECTOR / FUENTE ${i + 1} (Relevancia: ${Math.round(chunk.similarity * 100)}%)] ---\n${chunk.content}\n`)
        .join('\n')
    : 'No se encontraron fragmentos específicos en la base de datos. Utiliza los estándares curriculares del Ministerio de Educación Nacional de Colombia (MEN) y los principios pedagógicos del Colegio Bilingüe San José Campestre.'

  const structureGuide = getInstitutionalGuidelines(documentType, language)

  const systemPrompt = `Eres el Asistente Pedagógico y Curricular Oficial del Colegio Bilingüe San José Campestre (CBSJC).
Tu misión es redactar un documento institucional de altísima precisión, formalidad académica y estricto apego a las normas pedagógicas colombianas y a los documentos rectores del colegio.

DATOS DE ENTRADA PARA EL DOCUMENTO:
- Título del documento: "${title}"
- Tipo de documento: ${documentType}
- Idioma de salida: ${language === 'en' ? 'ENGLISH (Inglés)' : 'ESPAÑOL (Spanish)'}
- Nivel educativo: ${nivel}
- Área del conocimiento: ${area}
${grado ? `- Grado: ${grado}` : ''}
${periodo ? `- Periodo Académico: Periodo ${periodo}` : ''}
${additionalInstructions ? `- Instrucciones específicas del docente: "${additionalInstructions}"` : ''}

REGLAS DE GENERACIÓN ESTRICTAS:
1. IDIOMA: Todo el documento debe estar redactado en ${language === 'en' ? 'ENGLISH formal and clear' : 'ESPAÑOL formal, académico e impecable'}.
2. RIGOR RAG: Fundamenta los DBA, estándares, metodologías y criterios de evaluación en los fragmentos de documentos rectores proporcionados abajo. Si los fragmentos no contienen un dato específico, completa con los estándares oficiales del Ministerio de Educación Nacional de Colombia y los lineamientos del CBSJC.
3. FORMATO: Emplea Markdown estándar bien estructurado (# para título principal, ## para secciones principales, ### para subsecciones, viñetas -, tablas si es necesario).
4. TONO: Profesional, pedagógico, bilingüe, formativo, respetuoso de la identidad del Colegio Bilingüe San José Campestre.
5. NO inventes resoluciones erróneas; utiliza siempre la denominación institucional correcta "Colegio Bilingüe San José Campestre".

ESTRUCTURA GUÍA A SEGUIR:
${structureGuide}

FRAGMENTOS DE DOCUMENTOS RECTORES RECUPERADOS (KNOWLEDGE BASE):
${contextFormatted}
`

  try {
    const result = await model.generateContent(systemPrompt)
    const response = await result.response
    const text = response.text()
    
    if (!text || text.trim().length === 0) {
      throw new Error('Gemini model returned an empty response.')
    }

    return text
  } catch (error) {
    console.error('Error generating document with Gemini:', error)
    throw new Error(`AI generation failed: ${error instanceof Error ? error.message : String(error)}`)
  }
}

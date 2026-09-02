import 'server-only'

export interface PromptBankParams {
  docente: string
  area: string
  grado: string
  periodo: string
  tema: string
  evidenciaPrincipal?: string
}

/**
 * Generates a comprehensive, highly customized bank of 30 ready-to-copy AI Prompts
 * (for ChatGPT, Claude, Gemini, etc.) to help teachers generate extra classroom resources,
 * gamification, differentiated activities, bilingual ACE materials, and DUA adaptations.
 */
export function generatePromptsBankTxt(params: PromptBankParams): string {
  const { docente, area, grado, periodo, tema, evidenciaPrincipal } = params

  return `================================================================================
COLEGIO BILINGÜE SAN JOSÉ CAMPESTRE (CBSJC)
BANCO DE 30 PROMPTS DE INTELIGENCIA ARTIFICIAL PARA EL DOCENTE
Recursos Didácticos, Actividades STEAM, Bilingüismo ACE y Evaluación
================================================================================

DATOS DE LA SECUENCIA:
- Docente: ${docente}
- Área / Asignatura: ${area}
- Grado: ${grado}
- Período: ${periodo}
- Tema Curricular: ${tema}
- Evidencia Principal: ${evidenciaPrincipal || tema}
================================================================================

INSTRUCCIONES DE USO PARA EL DOCENTE:
Copia y pega cualquiera de estos 30 prompts directamente en ChatGPT, Claude o Gemini
para generar al instante materiales listos para imprimir, proyectar o aplicar en clase.
Puedes personalizar el texto entre corchetes si deseas hacer ajustes específicos.

================================================================================
BLOQUE 1: JUEGOS, GAMIFICACIÓN Y DINÁMICAS ACTIVAS (PROMPTS 1 A 5)
================================================================================

[PROMPT 1 - ESCAPE ROOM EN EL AULA]
"Actúa como un diseñador de juegos educativos. Crea un Escape Room temático de 4 estaciones para estudiantes de ${grado} sobre el tema '${tema}'. Cada estación debe tener un enigma conceptual, una pista encriptada y un código numérico o palabra clave para desbloquear la siguiente estación. Incluye la historia narrativa ambientada en el campus campestre, las soluciones paso a paso para el docente y una hoja de respuestas para el estudiante."

[PROMPT 2 - JEOPARDY / TRIVIA DE 25 PREGUNTAS]
"Genera un tablero de juego estilo Jeopardy para evaluar '${tema}' en ${grado}. Diseña 5 categorías conceptuales con 5 preguntas cada una (valores: 100, 200, 300, 400 y 500 puntos, aumentando en dificultad). Incluye la pregunta exacta, la respuesta modelo y una pista opcional para el moderador."

[PROMPT 3 - JUEGO DE ROL COOPERATIVO CON PERSONAJES]
"Diseña una dinámica de juego de rol cooperativo para equipos de 4 estudiantes de ${grado} sobre '${tema}'. Asigna 4 roles específicos con habilidades y responsabilidades únicas (ej. El Investigador, El Analista de Datos, El Diseñador Bilingüe, El Vocero Científico). Plantea una misión retadora con 3 decisiones críticas que el equipo debe resolver en 20 minutos."

[PROMPT 4 - RALLY CIENTÍFICO / BÚSQUEDA DEL TESORO]
"Crea un Rally de 5 pistas para realizar en los senderos y zonas verdes del colegio sobre el tema '${tema}'. Cada pista debe formularse como un acertijo en rima o dilema conceptual que lleve a un lugar físico y obligue a los estudiantes de ${grado} a registrar una observación o recolectar un dato clave."

[PROMPT 5 - JUEGO DE MESA IMPRIMIBLE (BIOMARATÓN / RETO STEAM)]
"Diseña las reglas y 24 tarjetas de preguntas y retos para un juego de mesa imprimible en cartulina sobre '${tema}' para ${grado}. Divide las tarjetas en 3 tipos: (1) Tarjetas Saber (conceptos), (2) Tarjetas Saber Hacer (dibujar o modelar en 1 minuto), y (3) Tarjetas Sorpresa PRAE (situaciones ecológicas de avance o retroceso)."

================================================================================
BLOQUE 2: GUÍAS PRÁCTICAS, LABORATORIOS Y TRABAJO DE CAMPO (PROMPTS 6 A 10)
================================================================================

[PROMPT 6 - GUÍA DE LABORATORIO CASERO / BAJO COSTO]
"Diseña una práctica de laboratorio de 45 minutos sobre '${tema}' para ${grado}, utilizando exclusivamente materiales cotidianos y de bajo costo (cocina, jardín, reciclables). Incluye: objetivo de indagación, medidas de bioseguridad, procedimiento paso a paso ilustrado con texto, tabla de recolección de datos y 3 preguntas de análisis de resultados."

[PROMPT 7 - FICHA DE OBSERVACIÓN DE CAMPO (SENDERO ECOLÓGICO)]
"Genera una ficha de campo imprimible de una página para que estudiantes de ${grado} exploren el entorno natural y registren datos sobre '${tema}'. Incluye espacios para registrar hora, condiciones climáticas, croquis a escala, tabla de frecuencias y una sección de conclusiones basadas en evidencia."

[PROMPT 8 - ORGANIZADORES GRÁFICOS Y PLANTILLAS DE PENSAMIENTO]
"Crea el contenido y estructura para 3 organizadores gráficos interactivos sobre '${tema}' para ${grado}: (1) Un Diagrama de Venn comparativo, (2) Un Diagrama de Causa-Efecto (Espina de Pescado), y (3) Un Mapa de Jerarquía Sistémica. Proporciona las palabras clave y relaciones que el estudiante debe completar."

[PROMPT 9 - BITÁCORA DE INDAGACIÓN EXPERIMENTAL DE 15 DÍAS]
"Redacta una bitácora científica de seguimiento de 15 días para un proyecto experimental escolar sobre '${tema}' en ${grado}. Diseña la tabla de registro diario de variables dependientes e independientes, pautas para fotografiar o dibujar cambios y preguntas de síntesis final."

[PROMPT 10 - TALLER DE RESOLUCIÓN DE CASOS Y PROBLEMAS DEL ENTORNO]
"Redacta 3 estudios de caso contextualizados en problemáticas ambientales y de salud sobre '${tema}' para estudiantes de ${grado}. Cada caso debe presentar un dilema real, datos numéricos o gráficos sencillos y 4 preguntas abiertas que requieran argumentación científica."

================================================================================
BLOQUE 3: COMPONENTE BILINGÜE ACE (INGLÉS A2/B1 EN ACCIÓN) (PROMPTS 11 A 15)
================================================================================

[PROMPT 11 - SET DE FLASHCARDS BILINGÜES CON PRONUNCIACIÓN]
"Crea un set de 15 flashcards bilingües sobre '${tema}' para nivel A2/B1 en ${grado}. Para cada término incluye: (1) Palabra en inglés, (2) Guía de pronunciación fonética amigable en español, (3) Definición concisa en inglés (máx. 15 palabras), y (4) Oración de ejemplo en contexto escolar."

[PROMPT 12 - LECTURA CIENTÍFICA GRADUADA EN INGLÉS A2 CON PREGUNTAS]
"Escribe un texto de divulgación científica en inglés nivel A2 de 120 palabras sobre '${tema}', adaptado para estudiantes de ${grado}. Agrega un glosario con 6 palabras clave, 3 preguntas de opción múltiple en inglés y 2 preguntas de inferencia."

[PROMPT 13 - PLANTILLAS DE PRODUCCIÓN ORAL (SENTENCE FRAMES)]
"Genera 8 plantillas de oraciones (sentence frames) en inglés A2 para ayudar a estudiantes de ${grado} a sustentar oralmente sus proyectos de '${tema}'. Incluye estructuras para: (a) Introducir una idea, (b) Comparar dos elementos, (c) Explicar causa y efecto, y (d) Concluir con un compromiso ambiental."

[PROMPT 14 - CRUCIGRAMA Y SOPA DE LETRAS TÉCNICA EN INGLÉS]
"Genera una lista de 10 palabras técnicas en inglés sobre '${tema}' con sus pistas y definiciones en inglés A2 para construir un crucigrama. Incluye la solución completa numerada y una cuadrícula de coordenadas sugerida."

[PROMPT 15 - DIÁLOGO CIENTÍFICO DRAMATIZADO EN PAREJAS]
"Escribe un guion de diálogo corto (10 intervenciones en inglés A2) entre dos estudiantes de ${grado} que discuten un experimento sobre '${tema}'. El diálogo debe usar vocabulario técnico, conectores de secuencia (First, Then, Because, Therefore) y tener un tono dinámico y curioso."

================================================================================
BLOQUE 4: EVALUACIÓN FORMATIVA, QUIZZES Y METACOGNICIÓN (PROMPTS 16 A 20)
================================================================================

[PROMPT 16 - BANCO DE 10 PREGUNTAS TIPO ICFES CON JUSTIFICACIÓN]
"Diseña 10 preguntas de selección múltiple con única respuesta tipo ICFES / Saber sobre '${tema}' para ${grado}. Cada pregunta debe tener un contexto o situación problema, 4 opciones (A, B, C, D) donde los distractores representen errores conceptuales frecuentes, y la explicación pedagógica detallada de por qué la opción correcta es la adecuada."

[PROMPT 17 - 10 TICKETS DE SALIDA (EXIT TICKETS) FORMATIVOS]
"Crea 10 Tickets de Salida (Exit Tickets) rápidos de 3 minutos para evaluar formativamente el avance clase a clase sobre '${tema}' en ${grado}. Utiliza rutinas de pensamiento como '3-2-1', 'Color-Símbolo-Imagen', 'Antes pensaba... Ahora pienso...', y 'Una pregunta que aún tengo'."

[PROMPT 18 - RÚBRICA DE AUTOEVALUACIÓN Y COEVALUACIÓN PRAISE & POLISH]
"Genera una ficha de autoevaluación y coevaluación entre pares con la técnica 'Praise & Polish' (Elogio y Mejora) para el proyecto de '${tema}' en ${grado}. Diseña 4 criterios observables y una escala amigable de caritas o niveles con espacio para retroalimentación cualitativa constructiva."

[PROMPT 19 - CUESTIONARIO LISTO PARA KAHOOT / QUIZIZZ]
"Genera una tabla con 10 preguntas listas para importar a Kahoot o Quizizz sobre '${tema}' para ${grado}. La tabla debe tener las columnas: Pregunta, Opción 1, Opción 2, Opción 3, Opción 4, Respuesta Correcta (1-4) y Tiempo Límite en segundos (20s o 30s)."

[PROMPT 20 - GUÍA DE RETROALIMENTACIÓN FORMATIVA Y REENTREGA]
"Redacta una guía de retroalimentación formativa de 1 página para entregar a estudiantes que obtuvieron nivel 'Sin categoría' (1.0-3.9) o 'Bronze' (4.0-4.5) en su evaluación de '${tema}'. Proporciona 3 actividades de refuerzo focalizadas y una lista de verificación para que mejoren su producto y alcancen nivel 'Silver' o 'Gold' en la reentrega."

================================================================================
BLOQUE 5: AJUSTES DUA, PIAR Y DIVERSIDAD EN EL AULA (PROMPTS 21 A 25)
================================================================================

[PROMPT 21 - ADAPTACIÓN DUA PARA ESTUDIANTES CON TDAH]
"Adapta la actividad principal de '${tema}' para estudiantes de ${grado} con TDAH. Diseña: (1) Segmentación de la tarea en micro-pasos de 10 minutos con temporizador visual, (2) Sistema de código de color para las instrucciones, (3) Rol activo asignado, y (4) Lista de chequeo 'To-Do / Done'."

[PROMPT 22 - VERSIÓN DE LECTURA FÁCIL CON APOYOS VISUALES]
"Reescribe el resumen conceptual de '${tema}' en formato de 'Lectura Fácil' para estudiantes con dificultades de comprensión lectora o adaptación PIAR en ${grado}. Usa oraciones cortas (máx. 10 palabras), tipografía clara, viñetas sencillas y sugerencias de pictogramas o iconos para cada concepto."

[PROMPT 23 - RETO DE ENRIQUECIMIENTO Y PROFUNDIZACIÓN (NIVEL GOLD)]
"Diseña un reto de profundización y alta exigencia (Nivel Gold) sobre '${tema}' para estudiantes con talentos excepcionales o ritmo de aprendizaje avanzado en ${grado}. El reto debe requerir investigación independiente, modelación matemática o transferencia de soluciones a un problema real de Palmira/Valle del Cauca."

[PROMPT 24 - GUÍA DE APRENDIZAJE MULTISENSORIAL Y KINESTÉSICO]
"Diseña una estación de aprendizaje multisensorial para enseñar '${tema}' a través del tacto, el movimiento corporal y la construcción 3D en ${grado}. Describe cómo los estudiantes pueden usar plastilina, materiales reciclables o dramatizaciones corporales para representar los conceptos clave."

[PROMPT 25 - TARJETA DE AUTOMONITOREO Y REGULACIÓN EMOCIONAL]
"Crea una tarjeta de bolsillo de autorregulación y concentración para que los estudiantes de ${grado} la tengan en su pupitre durante la clase de '${tema}'. Incluye: pasos a seguir si me siento frustrado o atascado, cómo pedir ayuda al docente y 3 metas personales de aprendizaje para la sesión."

================================================================================
BLOQUE 6: PROYECTO TRANSVERSAL PRAE, STEAM Y COMUNIDAD (PROMPTS 26 A 30)
================================================================================

[PROMPT 26 - MICRO-PROYECTO PRAE DE CIENCIA CIUDADANA]
"Diseña un micro-proyecto de Ciencia Ciudadana articulado al PRAE sobre '${tema}' para ${grado}. Los estudiantes deben recolectar datos reales en el campus campestre o en sus hogares, tabular los resultados en una base de datos escolar y proponer una acción concreta de mitigación o conservación."

[PROMPT 27 - DESAFÍO DE INGENIERÍA Y DISEÑO STEAM]
"Plantea un reto de diseño e ingeniería STEAM de 90 minutos relacionado con '${tema}' para ${grado}. Especifica: el problema del mundo real a resolver, los materiales permitidos (cartón, pitillos, cinta, etc.), las restricciones de tiempo y presupuesto, y la prueba de resistencia o funcionalidad del prototipo."

[PROMPT 28 - RETO CIENTÍFICO EN FAMILIA PARA EL FIN DE SEMANA]
"Redacta una carta amigable y una actividad experimental sencilla de 20 minutos para que los estudiantes de ${grado} realicen en casa con sus familias el fin de semana sobre '${tema}'. Incluye una pregunta para conversar en la mesa y un espacio para que los padres dejen una firma y un comentario reflexivo."

[PROMPT 29 - GUION PARA PODCAST ESCOLAR O VIDEO DIVULGATIVO DE 2 MINUTOS]
"Escribe la estructura y guion modelo para que un equipo de estudiantes de ${grado} grabe un video corto o episodio de podcast de 2 minutos explicando '${tema}' a la comunidad escolar. Incluye intro llamativa, analogía cotidiana, dato curioso y llamado a la acción ambiental."

[PROMPT 30 - CAMPAÑA DE COMUNICACIÓN Y PÓSTERES PARA EL CAMPUS]
"Diseña una campaña escolar de sensibilización visual liderada por los estudiantes de ${grado} sobre '${tema}'. Proporciona 5 lemas o eslóganes bilingües impactantes, ideas para infografías de gran formato y rúbrica para evaluar la claridad y creatividad del mensaje en las carteleras del colegio."

================================================================================
FIN DEL BANCO DE PROMPTS · COLEGIO BILINGÜE SAN JOSÉ CAMPESTRE (2026)
================================================================================
`
}

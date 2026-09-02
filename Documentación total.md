# Documentación Total — Plataforma Curricular RAG CBSJC (2026)

## 1. Resumen Ejecutivo
Plataforma web curricular integral diseñada para el **Colegio Bilingüe San José Campestre (Campus Tienda Nueva, Palmira)**. El sistema automatiza la producción del **Planning Book Oficial SJB-RGA006 (Versión 4, Vigencia 2026)**, Rúbricas analíticas del **Menú de Desafíos**, Planilla de Calificaciones en **Excel (.xlsx)** y un **Banco de 30 Prompts Pedagógicos IA**.

---

## 2. Arquitectura de Exportación & Resolución de Fallos Críticos

### A. Sustitución de Motor de PDF (Resolución Definitiva de `unsupported number: -2.55e+21`)
- **Problema:** El motor previo `@react-pdf/renderer` utiliza una implementación de *Yoga Flexbox* que, al procesar documentos extensos de 18 a 35 páginas (más de 110.000 caracteres) con tablas anidadas y encabezados fijos, sufría desbordamientos de punto flotante (*float overflow*), arrojando `unsupported number: -2.5551135894139537e+21` y bloqueando la exportación tanto individual como dentro del archivo ZIP.
- **Solución Implementada (`lib/export/pdf.tsx`):**
  - Reemplazo total por **`PDFKit` nativo**, eliminando la capa de React/Yoga y renderizando de manera vectorial directa.
  - Medición estricta de altura de texto (`doc.heightOfString`), control de saltos de página deterministas y paginación con buffer de dos pasadas (`doc.bufferedPageRange()`).
  - Encabezado institucional SJB-RGA006 dibujado en cada página con código de calidad y vigencia 2026.
  - Tablas institucionales con anchos porcentuales exactos (28% clave / 72% valor en 2 columnas, o equitativo en matrices).
  - Pie de página automático con numeración dinámica: `Colegio Bilingüe San José Campestre • Formato SJB-RGA006 • Docente: [Nombre] | Pág. X de Y`.
- **Verificación:** Probado y validado en local y producción sobre el documento real `e5693811-059b-469e-889e-51aecb53e8ac` (110.437 caracteres), generando un PDF de 106.535 bytes en menos de 0.5 segundos con 0 errores.

---

## 3. Entregables Generados por la Plataforma
1. **`1_Planning_Book_SJB-RGA006_[Tema].docx`**: Documento oficial de Word con tablas bordeadas, fuentes Calibri/Times, sin asteriscos markdown y con firmas del docente titular.
2. **`2_Planning_Book_SJB-RGA006_[Tema].pdf`**: Documento PDF institucional de alta resolución generado mediante PDFKit.
3. **`3_Rubricas_Menu_Desafios_[Tema].docx`**: Rúbricas analíticas discriminadas por bandas (Sin Categoría 1.0-3.9, Bronze 4.0-4.5, Silver 4.6-4.7, Gold 4.8-5.0).
4. **`4_Planilla_Notas_[Tema].xlsx`**: Libro Excel automatizado con ponderaciones CBSJC (Saber 35%, Saber Hacer 35%, Saber Ser 20%, Saber Convivir 10%) y fórmulas `=SUM(...)`.
5. **`5_Banco_30_Prompts_IA_Recursos_[Tema].txt`**: 30 prompts personalizados distribuidos en 6 bloques pedagógicos (Gamificación, Laboratorios, Bilingüismo ACE, Evaluación Formativa, DUA/PIAR y PRAE/STEAM).
6. **`6_Traslado_Cibercolegios_[Tema].txt`**: Texto limpio y formateado listo para copiar y pegar en la plataforma de gestión escolar Cibercolegios.

---

## 4. Estado de Despliegue
- **Producción:** `https://cbsjc-planeador-rag.vercel.app`
- **Repositorio:** `simonbarrera-cbsjc/cbsjc-planeador-rag`
- **Build Status:** Compilación Next.js 15.3.9 exitosa (0 errores, 0 advertencias de tipos).

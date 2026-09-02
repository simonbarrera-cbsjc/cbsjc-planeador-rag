import fs from 'fs'
import path from 'path'
import { generatePdf } from '../lib/export/pdf.tsx'

async function testPdf() {
  console.log('Testing PDF generation with Roboto...')
  const sampleMarkdown = `# Secuencia Didáctica: Antes — Durante — Después
**Colegio Bilingüe San José Campestre**

| Identificación | Detalle |
|---|---|
| **Docente** | Manolito Pérez |
| **Área** | Ciencias Naturales |
| **Grado** | Grado 6° |

## 1. IDENTIFICACIÓN Y REFERENTES DE CALIDAD
- **Meta del subciclo**: El estudiante **contrasta antes de concluir** y formula preguntas investigables.
- **Competencia**: Explicación de fenómenos biológicos y ecológicos.

## 2. ARCO PEDAGÓGICO DE LA SECUENCIA
### ANTES: Conecta y Reta (Semana 1)
- **Momento 1 - Warm-up**: Rutina de pensamiento See-Think-Wonder.
- **Momento 2 - Core Task**: Laboratorio de observación celular con muestras de Tienda Nueva.
`

  try {
    const pdfBuf = await generatePdf({
      title: 'Planning Book Oficial',
      content: sampleMarkdown,
      metadata: {
        authorName: 'Manolito Pérez',
        date: '1/09/2026',
        area: 'Ciencias Naturales',
        grado: 'Grado 6°',
        periodo: 'I',
      },
    })

    console.log('PDF generated successfully! Size:', pdfBuf.length, 'bytes')
    fs.writeFileSync('scripts/test-sample.pdf', pdfBuf)
  } catch (err) {
    console.error('PDF generation FAILED:', err)
  }
}

testPdf()

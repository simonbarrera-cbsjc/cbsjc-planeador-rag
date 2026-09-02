import { generatePdf } from '../lib/export/pdf'
import fs from 'fs'
import path from 'path'

async function testLargeTablePdf() {
  console.log('Testing generatePdf with large multi-row table...')
  
  // Create a massive 20-row table with large text blocks, just like Section 1 in our real document
  let markdown = `# 1. REFERENTES DE CALIDAD INSTITUCIONAL\n\n| Referente | Detalle Curricular Exhaustivo |\n|---|---|\n`
  for (let i = 1; i <= 20; i++) {
    markdown += `| **Referente ${i}** | Este es un texto muy extenso para la fila ${i} que contiene múltiples oraciones explicativas, conceptos disciplinares, evidencias de aprendizaje, terminología en inglés A2 como *cell structure*, *photosynthesis* y análisis de impacto ambiental en el campus de Tienda Nueva para asegurar que la tabla ocupe varias páginas completas. |\n`
  }

  markdown += `\n## 2. ARCO PEDAGÓGICO\n`
  for (let i = 1; i <= 10; i++) {
    markdown += `- **Semana ${i}:** Descripción detallada de actividades con texto en **negrilla** y texto en *cursiva*.\n`
  }

  try {
    const buffer = await generatePdf({
      title: 'Planeacion Masiva',
      content: markdown,
      documentType: 'planeador',
      language: 'es',
      metadata: {
        date: '02/09/2026',
        authorName: 'Manolito Pérez',
      },
    })

    console.log(`SUCCESS! Generated PDF size: ${buffer.length} bytes`)
    fs.writeFileSync(path.join(process.cwd(), 'scripts', 'test-large.pdf'), buffer)
  } catch (err: any) {
    console.error('FAILED with error:', err)
  }
}

testLargeTablePdf().catch(console.error)

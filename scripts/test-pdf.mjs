import { generatePdf } from '../lib/export/pdf'
import fs from 'fs'
import path from 'path'

async function testPdf() {
  console.log('Testing generatePdf...')
  const sampleMarkdown = `
# 1. IDENTIFICACIÓN Y REFERENTES

| Campo | Detalle |
|---|---|
| **Docente(s)** | Manolito Pérez |
| **Área** | Ciencias Naturales |

Este es un párrafo de prueba con texto en **negrilla**, texto en *cursiva*, y texto en ***negrilla cursiva***.

## 2. ARCO PEDAGÓGICO
- **Momento 1:** Indagación sobre la biodiversidad en *Tienda Nueva*.
- **Momento 2:** Estructura *celular* y **funciones**.
`

  const buffer = await generatePdf({
    title: 'Planeacion de Prueba',
    content: sampleMarkdown,
    documentType: 'planeador',
    language: 'es',
    metadata: {
      date: '01/09/2026',
      authorName: 'Manolito Pérez',
    },
  })

  console.log(`PDF generated successfully! Buffer size: ${buffer.length} bytes`)
  const outPath = path.join(process.cwd(), 'scripts', 'test-output.pdf')
  fs.writeFileSync(outPath, buffer)
  console.log(`Saved test PDF to ${outPath}`)
}

testPdf().catch(console.error)

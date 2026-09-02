import fs from 'fs'
import { generatePlanningDocument } from '../lib/ai/generator.ts'
import { generateDocx } from '../lib/export/docx.ts'
import { generatePdf } from '../lib/export/pdf.tsx'

let apiKey = process.env.GOOGLE_AI_API_KEY || process.env.GEMINI_API_KEY
if (!apiKey && fs.existsSync('.env.local')) {
  const envContent = fs.readFileSync('.env.local', 'utf-8')
  const match = envContent.match(/(?:GOOGLE_AI_API_KEY|GEMINI_API_KEY)\s*=\s*["']?([^"'\r\n]+)/)
  if (match) {
    process.env.GOOGLE_AI_API_KEY = match[1].trim()
  }
}

async function testExhaustive() {
  console.log('Generating exhaustive 18+ page plan...')
  const result = await generatePlanningDocument({
    docente: 'Manolito Pérez',
    area: 'Ciencias Naturales y Educación Ambiental (Science / Biology)',
    grado: 'Grado 6°',
    periodo: 'I',
    semanas: '4 semanas (4 sesiones semanales de 90 min — 16 horas)',
    tema: 'Ecosistemas, Biodiversidad y Niveles de Organización Biológica en Tienda Nueva',
    additionalInstructions: 'Enfocar en especies nativas del campus campestre de Tienda Nueva (Palmira). Articular al PRAE. Rúbricas y evaluaciones con máximo detalle sin omitir nada.',
    contextDocs: [],
  })

  console.log('Planning Book Markdown length:', result.planningBookMarkdown.length, 'characters')
  fs.writeFileSync('scripts/generated-exhaustive-plan.md', result.planningBookMarkdown)

  const docxBuf = await generateDocx({
    title: 'Secuencia Didáctica: Ecosistemas Grado 6°',
    content: result.planningBookMarkdown,
    metadata: {
      date: '1/09/2026',
      authorName: 'Manolito Pérez',
      area: 'Ciencias Naturales',
      grado: 'Grado 6°',
      periodo: 'I',
    },
  })

  fs.writeFileSync('scripts/generated-exhaustive-plan.docx', docxBuf)
  console.log('DOCX generated successfully:', docxBuf.length, 'bytes')

  const pdfBuf = await generatePdf({
    title: 'Secuencia Didáctica: Ecosistemas Grado 6°',
    content: result.planningBookMarkdown,
    metadata: {
      date: '1/09/2026',
      authorName: 'Manolito Pérez',
      area: 'Ciencias Naturales',
      grado: 'Grado 6°',
      periodo: 'I',
    },
  })

  fs.writeFileSync('scripts/generated-exhaustive-plan.pdf', pdfBuf)
  console.log('PDF generated successfully:', pdfBuf.length, 'bytes')
}

testExhaustive().catch(console.error)

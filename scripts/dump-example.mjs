import mammoth from 'mammoth'
import fs from 'fs'

async function dumpFullText() {
  const result = await mammoth.extractRawText({ path: 'Ejemplo de planning book ya lleno.docx' })
  fs.writeFileSync('scripts/example-dump.txt', result.value, 'utf-8')
  console.log('Saved example text dump. Total characters:', result.value.length)
}

dumpFullText().catch(console.error)

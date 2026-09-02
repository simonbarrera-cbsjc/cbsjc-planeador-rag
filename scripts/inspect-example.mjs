import mammoth from 'mammoth'
import fs from 'fs'

async function inspectDocx(filename) {
  console.log(`=== Inspecting ${filename} ===`)
  const result = await mammoth.extractRawText({ path: filename })
  console.log('Text length:', result.value.length)
  console.log('First 2000 chars:\n', result.value.substring(0, 2000))
  console.log('\n--- Mid section (chars 5000-7000) ---\n', result.value.substring(5000, 7000))
  console.log('\n--- End section (last 2000 chars) ---\n', result.value.substring(result.value.length - 2000))
}

async function run() {
  await inspectDocx('Ejemplo de planning book ya lleno.docx')
}

run().catch(console.error)

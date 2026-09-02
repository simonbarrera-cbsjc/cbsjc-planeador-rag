import mammoth from 'mammoth'

async function inspectHtml(filename) {
  console.log(`=== HTML Structure of ${filename} ===`)
  const result = await mammoth.convertToHtml({ path: filename })
  console.log('HTML length:', result.value.length)
  // Find all table tags, h1, h2, h3, etc.
  const tables = (result.value.match(/<table[\s\S]*?<\/table>/g) || [])
  console.log('Total tables in document:', tables.length)
  tables.forEach((tbl, idx) => {
    console.log(`--- Table ${idx + 1} preview (first 300 chars) ---`)
    console.log(tbl.substring(0, 300))
  })
}

inspectHtml('Ejemplo de planning book ya lleno.docx').catch(console.error)

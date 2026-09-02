import JSZip from 'jszip'
import fs from 'fs'

async function inspectDocxXml(filename) {
  console.log(`=== Inspecting XML of ${filename} ===`)
  const buffer = fs.readFileSync(filename)
  const zip = await JSZip.loadAsync(buffer)
  
  const files = Object.keys(zip.files)
  console.log('Files in DOCX archive:', files)
  
  const documentXml = await zip.file('word/document.xml')?.async('text')
  if (documentXml) {
    console.log('document.xml length:', documentXml.length)
    fs.writeFileSync('scripts/template-document.xml', documentXml, 'utf-8')
  }

  const header1 = await zip.file('word/header1.xml')?.async('text')
  if (header1) {
    console.log('header1.xml length:', header1.length)
    fs.writeFileSync('scripts/template-header1.xml', header1, 'utf-8')
  }
}

inspectDocxXml('SJB-RGA006_Planning_Book_Primary_Secondary (1).docx').catch(console.error)

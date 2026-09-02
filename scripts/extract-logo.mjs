import JSZip from 'jszip'
import fs from 'fs'

async function extractLogo() {
  const buffer = fs.readFileSync('SJB-RGA006_Planning_Book_Primary_Secondary (1).docx')
  const zip = await JSZip.loadAsync(buffer)
  
  const logoFile = zip.file('word/media/image1.png')
  if (logoFile) {
    const logoBuffer = await logoFile.async('nodebuffer')
    fs.writeFileSync('public/cbsjc-crest.png', logoBuffer)
    console.log('Saved official CBSJC crest logo to public/cbsjc-crest.png, size:', logoBuffer.length)
  }
}

extractLogo().catch(console.error)

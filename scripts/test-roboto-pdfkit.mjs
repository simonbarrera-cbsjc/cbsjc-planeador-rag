import PDFDocument from 'pdfkit'
import fs from 'fs'
import path from 'path'

async function testRobotoPdfKit() {
  console.log('Testing PDFKit with explicit Roboto TTF font buffers...')

  const fontDir = path.join(process.cwd(), 'public', 'fonts')
  const regularBuffer = fs.readFileSync(path.join(fontDir, 'Roboto-Regular.ttf'))
  const boldBuffer = fs.readFileSync(path.join(fontDir, 'Roboto-Bold.ttf'))
  const italicBuffer = fs.readFileSync(path.join(fontDir, 'Roboto-Italic.ttf'))

  const doc = new PDFDocument({
    size: 'A4',
    margin: 35,
    bufferPages: true,
  })

  // Register explicit fonts with Buffer - this completely bypasses standard-fonts/ AFM loading!
  doc.registerFont('Roboto', regularBuffer)
  doc.registerFont('Roboto-Bold', boldBuffer)
  doc.registerFont('Roboto-Italic', italicBuffer)

  const buffers = []
  doc.on('data', (c) => buffers.push(c))
  
  const finishPromise = new Promise((resolve, reject) => {
    doc.on('end', () => resolve(Buffer.concat(buffers)))
    doc.on('error', reject)
  })

  doc.font('Roboto-Bold').fontSize(16).fillColor('#0E1B4D').text('COLEGIO BILINGÜE SAN JOSÉ CAMPESTRE')
  doc.font('Roboto').fontSize(10).fillColor('#1E293B').text('Prueba de exportación con fuentes TTF integradas en memoria.')

  doc.end()

  const pdfBuffer = await finishPromise
  console.log(`SUCCESS! Generated PDF: ${pdfBuffer.length} bytes`)
}

testRobotoPdfKit().catch(console.error)

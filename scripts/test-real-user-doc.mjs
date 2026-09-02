import { createClient } from '@supabase/supabase-js'
import PDFDocument from 'pdfkit'
import fs from 'fs'
import path from 'path'

const SUPABASE_URL = 'https://yqygtibydldsuikktzao.supabase.co'
const SUPABASE_SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlxeWd0aWJ5ZGxkc3Vpa2t0emFvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4ODI4MjMwMCwiZXhwIjoyMTAzODU4MzAwfQ.lyIxUxXII7l4QziXAlT364Z_04AFt4aSQ30kP6yhA5I'

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

async function testRealUserDoc() {
  const docId = 'e5693811-059b-469e-889e-51aecb53e8ac'
  console.log(`Fetching real document ${docId} from Supabase...`)

  const { data: doc, error } = await supabase
    .from('generated_documents')
    .select('*')
    .eq('id', docId)
    .single()

  if (error || !doc) {
    console.error('Error fetching doc:', error)
    return
  }

  console.log(`Fetched doc "${doc.title}", content length: ${doc.content.length} chars`)

  // Now run the exact PDFKit generation logic on this 34-page real document!
  const title = doc.title
  const content = doc.content
  const safeDocente = doc.metadata?.authorName || 'Docente Titular CBSJC'

  const pdfDoc = new PDFDocument({
    size: 'A4',
    margin: 35,
    bufferPages: true,
    autoFirstPage: true,
    info: {
      Title: title,
      Author: safeDocente,
    },
  })

  const buffers = []
  pdfDoc.on('data', (c) => buffers.push(c))
  
  const finishPromise = new Promise((resolve, reject) => {
    pdfDoc.on('end', () => resolve(Buffer.concat(buffers)))
    pdfDoc.on('error', reject)
  })

  const PAGE_WIDTH = 595.28
  const PAGE_HEIGHT = 841.89
  const MARGIN = 35
  const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2

  const COLOR_NAVY = '#0E1B4D'
  const COLOR_RED = '#D71921'
  const COLOR_GRAY_BG = '#F1F5F9'
  const COLOR_BORDER = '#CBD5E1'
  const COLOR_TEXT = '#1E293B'

  const drawHeader = () => {
    const top = 18
    const height = 40
    pdfDoc.save()
    pdfDoc.rect(MARGIN, top, CONTENT_WIDTH, height).lineWidth(0.75).stroke(COLOR_BORDER)
    pdfDoc.rect(MARGIN, top, 80, height).lineWidth(0.5).stroke(COLOR_BORDER)
    pdfDoc.font('Helvetica-Bold').fontSize(11).fillColor(COLOR_NAVY)
    pdfDoc.text('CBSJC', MARGIN, top + 14, { width: 80, align: 'center' })

    const centerWidth = CONTENT_WIDTH - 80 - 130
    pdfDoc.rect(MARGIN + 80, top, centerWidth, height).lineWidth(0.5).stroke(COLOR_BORDER)
    pdfDoc.font('Helvetica-Bold').fontSize(8.5).fillColor(COLOR_NAVY)
    pdfDoc.text('COLEGIO BILINGÜE SAN JOSÉ CAMPESTRE', MARGIN + 80, top + 5, { width: centerWidth, align: 'center' })
    pdfDoc.font('Helvetica-Bold').fontSize(7.5).fillColor(COLOR_RED)
    pdfDoc.text('PLANNING BOOK PRIMARY & SECONDARY', MARGIN + 80, top + 16, { width: centerWidth, align: 'center' })
    pdfDoc.font('Helvetica').fontSize(6.5).fillColor('#64748B')
    pdfDoc.text('Secuencia Didáctica: Antes — Durante — Después · Subciclos 3 a 6', MARGIN + 80, top + 27, { width: centerWidth, align: 'center' })

    const rightX = MARGIN + 80 + centerWidth
    pdfDoc.rect(rightX, top, 130, height).fillAndStroke(COLOR_GRAY_BG, COLOR_BORDER)
    pdfDoc.font('Helvetica-Bold').fontSize(7).fillColor(COLOR_NAVY)
    pdfDoc.text('CÓDIGO: SJB-RGA006', rightX + 6, top + 6, { width: 118, align: 'left' })
    pdfDoc.font('Helvetica').fontSize(6.5).fillColor('#64748B')
    pdfDoc.text('VERSIÓN: 4  VIGENCIA: 2026', rightX + 6, top + 17, { width: 118, align: 'left' })
    pdfDoc.restore()
  }

  let currentY = 70

  const checkPageBreak = (neededHeight) => {
    if (currentY + neededHeight > PAGE_HEIGHT - 45) {
      pdfDoc.addPage()
      drawHeader()
      currentY = 70
    }
  }

  drawHeader()

  const cleanText = (str) => {
    return str
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/\*\*\*(.*?)\*\*\*/g, '$1')
      .replace(/\*\*(.*?)\*\*/g, '$1')
      .replace(/\*(.*?)\*/g, '$1')
      .replace(/_{1,3}(.*?)_{1,3}/g, '$1')
      .trim()
  }

  const lines = content.split('\n')
  let tableRows = []

  const renderTable = (rows) => {
    if (!rows || rows.length === 0) return
    const headers = rows[0] || []
    const dataRows = rows.slice(1)
    const isTwoCol = headers.length === 2
    const numCols = headers.length || 1

    const colWidths = []
    for (let c = 0; c < numCols; c++) {
      if (isTwoCol) {
        colWidths.push(c === 0 ? CONTENT_WIDTH * 0.28 : CONTENT_WIDTH * 0.72)
      } else {
        colWidths.push(CONTENT_WIDTH / numCols)
      }
    }

    const getRowHeight = (cells, isHeader = false) => {
      let maxHeight = 16
      cells.forEach((cell, ci) => {
        const w = colWidths[ci] || 50
        pdfDoc.font(isHeader ? 'Helvetica-Bold' : 'Helvetica').fontSize(7)
        const textH = pdfDoc.heightOfString(cleanText(cell), { width: w - 8 })
        if (textH + 8 > maxHeight) maxHeight = textH + 8
      })
      return maxHeight
    }

    const headerH = getRowHeight(headers, true)
    checkPageBreak(headerH)

    pdfDoc.save()
    pdfDoc.rect(MARGIN, currentY, CONTENT_WIDTH, headerH).fillAndStroke(COLOR_NAVY, COLOR_BORDER)
    let curX = MARGIN
    headers.forEach((h, ci) => {
      const w = colWidths[ci]
      pdfDoc.font('Helvetica-Bold').fontSize(7).fillColor('#FFFFFF')
      pdfDoc.text(cleanText(h), curX + 4, currentY + 4, { width: w - 8, align: 'left' })
      curX += w
    })
    pdfDoc.restore()
    currentY += headerH

    dataRows.forEach((r, ri) => {
      const rowH = getRowHeight(r, false)
      checkPageBreak(rowH)

      pdfDoc.save()
      const bg = isTwoCol ? undefined : (ri % 2 === 1 ? '#F8FAFC' : '#FFFFFF')
      if (bg) {
        pdfDoc.rect(MARGIN, currentY, CONTENT_WIDTH, rowH).fill(bg)
      }
      pdfDoc.rect(MARGIN, currentY, CONTENT_WIDTH, rowH).lineWidth(0.5).stroke(COLOR_BORDER)

      let rowX = MARGIN
      r.forEach((c, ci) => {
        const w = colWidths[ci]
        if (isTwoCol && ci === 0) {
          pdfDoc.rect(rowX, currentY, w, rowH).fillAndStroke(COLOR_GRAY_BG, COLOR_BORDER)
          pdfDoc.font('Helvetica-Bold').fontSize(7).fillColor(COLOR_NAVY)
        } else {
          pdfDoc.font('Helvetica').fontSize(7).fillColor(COLOR_TEXT)
        }
        pdfDoc.text(cleanText(c), rowX + 4, currentY + 4, { width: w - 8, align: 'left' })
        rowX += w
      })
      pdfDoc.restore()
      currentY += rowH
    })

    currentY += 8
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim()

    if (line.startsWith('|') && line.endsWith('|')) {
      if (/^\|[\s\-:|]+\|$/.test(line)) continue
      const cells = line.slice(1, -1).split('|').map((c) => c.trim())
      tableRows.push(cells)
      continue
    } else if (tableRows.length > 0) {
      renderTable(tableRows)
      tableRows = []
    }

    if (!line) {
      currentY += 3
      continue
    }

    if (line.startsWith('# ')) {
      checkPageBreak(25)
      const text = cleanText(line.substring(2))
      pdfDoc.font('Helvetica-Bold').fontSize(11).fillColor(COLOR_NAVY)
      pdfDoc.text(text, MARGIN, currentY, { width: CONTENT_WIDTH })
      currentY += pdfDoc.heightOfString(text, { width: CONTENT_WIDTH }) + 5
    } else if (line.startsWith('## ')) {
      checkPageBreak(20)
      const text = cleanText(line.substring(3))
      pdfDoc.font('Helvetica-Bold').fontSize(10).fillColor(COLOR_NAVY)
      pdfDoc.text(text, MARGIN, currentY, { width: CONTENT_WIDTH })
      currentY += pdfDoc.heightOfString(text, { width: CONTENT_WIDTH }) + 4
    } else if (line.startsWith('### ')) {
      checkPageBreak(18)
      const text = cleanText(line.substring(4))
      pdfDoc.font('Helvetica-Bold').fontSize(8.5).fillColor(COLOR_RED)
      pdfDoc.text(text, MARGIN, currentY, { width: CONTENT_WIDTH })
      currentY += pdfDoc.heightOfString(text, { width: CONTENT_WIDTH }) + 3
    } else if (line.startsWith('#### ') || line.startsWith('##### ') || line.startsWith('###### ')) {
      checkPageBreak(16)
      const text = cleanText(line.replace(/^#{4,6}\s*/, ''))
      pdfDoc.font('Helvetica-Bold').fontSize(8).fillColor(COLOR_NAVY)
      pdfDoc.text(text, MARGIN, currentY, { width: CONTENT_WIDTH })
      currentY += pdfDoc.heightOfString(text, { width: CONTENT_WIDTH }) + 3
    } else if (line.startsWith('- ') || line.startsWith('* ')) {
      const bulletContent = cleanText(line.substring(2))
      pdfDoc.font('Helvetica').fontSize(8)
      const textH = pdfDoc.heightOfString(bulletContent, { width: CONTENT_WIDTH - 15 })
      checkPageBreak(textH + 2)
      pdfDoc.font('Helvetica-Bold').fontSize(8).fillColor(COLOR_RED).text('•', MARGIN + 4, currentY)
      pdfDoc.font('Helvetica').fontSize(8).fillColor(COLOR_TEXT).text(bulletContent, MARGIN + 14, currentY, { width: CONTENT_WIDTH - 14 })
      currentY += textH + 2
    } else {
      const text = cleanText(line)
      pdfDoc.font('Helvetica').fontSize(8)
      const textH = pdfDoc.heightOfString(text, { width: CONTENT_WIDTH })
      checkPageBreak(textH + 3)
      pdfDoc.font('Helvetica').fontSize(8).fillColor(COLOR_TEXT).text(text, MARGIN, currentY, { width: CONTENT_WIDTH, align: 'justify' })
      currentY += textH + 3
    }
  }

  if (tableRows.length > 0) {
    renderTable(tableRows)
    tableRows = []
  }

  const range = pdfDoc.bufferedPageRange()
  console.log(`Document generated ${range.count} pages! Adding footers...`)
  for (let p = 0; p < range.count; p++) {
    pdfDoc.switchToPage(p)
    pdfDoc.save()
    pdfDoc.rect(MARGIN, PAGE_HEIGHT - 26, CONTENT_WIDTH, 0.5).fill(COLOR_BORDER)
    pdfDoc.font('Helvetica').fontSize(6.5).fillColor('#94A3B8')
    pdfDoc.text(`Colegio Bilingüe San José Campestre • Formato SJB-RGA006 • Docente: ${safeDocente}`, MARGIN, PAGE_HEIGHT - 20, { width: CONTENT_WIDTH * 0.75, align: 'left' })
    pdfDoc.text(`Pág. ${p + 1} de ${range.count}`, MARGIN + CONTENT_WIDTH * 0.75, PAGE_HEIGHT - 20, { width: CONTENT_WIDTH * 0.25, align: 'right' })
    pdfDoc.restore()
  }

  pdfDoc.end()

  const finalPdf = await finishPromise
  console.log(`🎉 SUCCESS! Rendered real doc into PDF: ${finalPdf.length} bytes over ${range.count} pages!`)
  fs.writeFileSync(path.join(process.cwd(), 'scripts', 'real-doc-output.pdf'), finalPdf)
}

testRealUserDoc().catch(console.error)

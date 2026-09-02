import PDFDocument from 'pdfkit'
import fs from 'fs'
import path from 'path'

async function generatePdfWithPdfKit(title, content, metadata) {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: 'A4',
        margin: 35,
        bufferPages: true,
        autoFirstPage: true,
        info: {
          Title: title,
          Author: metadata.authorName || 'Docente CBSJC',
        },
      })

      const buffers = []
      doc.on('data', (chunk) => buffers.push(chunk))
      doc.on('end', () => resolve(Buffer.concat(buffers)))
      doc.on('error', reject)

      const PAGE_WIDTH = 595.28
      const PAGE_HEIGHT = 841.89
      const MARGIN = 35
      const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2 // 525.28

      const COLOR_NAVY = '#0E1B4D'
      const COLOR_RED = '#D71921'
      const COLOR_GRAY_BG = '#F1F5F9'
      const COLOR_BORDER = '#CBD5E1'
      const COLOR_TEXT = '#1E293B'

      const drawHeader = () => {
        const top = 18
        const height = 40
        doc.save()
        doc.rect(MARGIN, top, CONTENT_WIDTH, height).lineWidth(0.75).stroke(COLOR_BORDER)
        
        // Left Column (Crest placeholder)
        doc.rect(MARGIN, top, 80, height).lineWidth(0.5).stroke(COLOR_BORDER)
        doc.font('Helvetica-Bold').fontSize(11).fillColor(COLOR_NAVY)
        doc.text('CBSJC', MARGIN, top + 14, { width: 80, align: 'center' })

        // Center Column (Title)
        const centerWidth = CONTENT_WIDTH - 80 - 130
        doc.rect(MARGIN + 80, top, centerWidth, height).lineWidth(0.5).stroke(COLOR_BORDER)
        doc.font('Helvetica-Bold').fontSize(8.5).fillColor(COLOR_NAVY)
        doc.text('COLEGIO BILINGÜE SAN JOSÉ CAMPESTRE', MARGIN + 80, top + 5, { width: centerWidth, align: 'center' })
        doc.font('Helvetica-Bold').fontSize(7.5).fillColor(COLOR_RED)
        doc.text('PLANNING BOOK PRIMARY & SECONDARY', MARGIN + 80, top + 16, { width: centerWidth, align: 'center' })
        doc.font('Helvetica').fontSize(6.5).fillColor('#64748B')
        doc.text('Secuencia Didáctica: Antes — Durante — Después · Subciclos 3 a 6', MARGIN + 80, top + 27, { width: centerWidth, align: 'center' })

        // Right Column (Quality code)
        const rightX = MARGIN + 80 + centerWidth
        doc.rect(rightX, top, 130, height).fillAndStroke(COLOR_GRAY_BG, COLOR_BORDER)
        doc.font('Helvetica-Bold').fontSize(7).fillColor(COLOR_NAVY)
        doc.text('CÓDIGO: SJB-RGA006', rightX + 6, top + 6, { width: 118, align: 'left' })
        doc.font('Helvetica').fontSize(6.5).fillColor('#64748B')
        doc.text('VERSIÓN: 4  VIGENCIA: 2026', rightX + 6, top + 17, { width: 118, align: 'left' })
        doc.restore()
      }

      // Start y position below header
      let currentY = 70

      const checkPageBreak = (neededHeight) => {
        if (currentY + neededHeight > PAGE_HEIGHT - 45) {
          doc.addPage()
          drawHeader()
          currentY = 70
        }
      }

      drawHeader()

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

        // Measure row height
        const getRowHeight = (cells, isHeader = false) => {
          let maxHeight = 16
          cells.forEach((cell, ci) => {
            const w = colWidths[ci] || 50
            doc.font(isHeader ? 'Helvetica-Bold' : 'Helvetica').fontSize(7)
            const textH = doc.heightOfString(cell.replace(/\*\*/g, '').replace(/<br\s*\/?>/gi, '\n'), { width: w - 8 })
            if (textH + 8 > maxHeight) maxHeight = textH + 8
          })
          return maxHeight
        }

        // Header Row
        const headerH = getRowHeight(headers, true)
        checkPageBreak(headerH)

        doc.save()
        doc.rect(MARGIN, currentY, CONTENT_WIDTH, headerH).fillAndStroke(COLOR_NAVY, COLOR_BORDER)
        let curX = MARGIN
        headers.forEach((h, ci) => {
          const w = colWidths[ci]
          doc.font('Helvetica-Bold').fontSize(7).fillColor('#FFFFFF')
          doc.text(h.replace(/\*\*/g, ''), curX + 4, currentY + 4, { width: w - 8, align: 'left' })
          curX += w
        })
        doc.restore()
        currentY += headerH

        // Data Rows
        dataRows.forEach((r, ri) => {
          const rowH = getRowHeight(r, false)
          checkPageBreak(rowH)

          doc.save()
          const bg = isTwoCol ? undefined : (ri % 2 === 1 ? '#F8FAFC' : '#FFFFFF')
          if (bg) {
            doc.rect(MARGIN, currentY, CONTENT_WIDTH, rowH).fill(bg)
          }
          doc.rect(MARGIN, currentY, CONTENT_WIDTH, rowH).lineWidth(0.5).stroke(COLOR_BORDER)

          let rowX = MARGIN
          r.forEach((c, ci) => {
            const w = colWidths[ci]
            if (isTwoCol && ci === 0) {
              doc.rect(rowX, currentY, w, rowH).fillAndStroke(COLOR_GRAY_BG, COLOR_BORDER)
              doc.font('Helvetica-Bold').fontSize(7).fillColor(COLOR_NAVY)
            } else {
              doc.font('Helvetica').fontSize(7).fillColor(COLOR_TEXT)
            }
            doc.text(c.replace(/\*\*/g, '').replace(/<br\s*\/?>/gi, '\n'), rowX + 4, currentY + 4, { width: w - 8, align: 'left' })
            rowX += w
          })
          doc.restore()
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
          doc.font('Helvetica-Bold').fontSize(11).fillColor(COLOR_NAVY)
          doc.text(line.substring(2).replace(/\*\*/g, ''), MARGIN, currentY, { width: CONTENT_WIDTH })
          currentY += doc.heightOfString(line.substring(2).replace(/\*\*/g, ''), { width: CONTENT_WIDTH }) + 5
        } else if (line.startsWith('## ')) {
          checkPageBreak(20)
          doc.font('Helvetica-Bold').fontSize(10).fillColor(COLOR_NAVY)
          doc.text(line.substring(3).replace(/\*\*/g, ''), MARGIN, currentY, { width: CONTENT_WIDTH })
          currentY += doc.heightOfString(line.substring(3).replace(/\*\*/g, ''), { width: CONTENT_WIDTH }) + 4
        } else if (line.startsWith('### ')) {
          checkPageBreak(18)
          doc.font('Helvetica-Bold').fontSize(8.5).fillColor(COLOR_RED)
          doc.text(line.substring(4).replace(/\*\*/g, ''), MARGIN, currentY, { width: CONTENT_WIDTH })
          currentY += doc.heightOfString(line.substring(4).replace(/\*\*/g, ''), { width: CONTENT_WIDTH }) + 3
        } else if (line.startsWith('#### ') || line.startsWith('##### ') || line.startsWith('###### ')) {
          checkPageBreak(16)
          doc.font('Helvetica-Bold').fontSize(8).fillColor(COLOR_NAVY)
          const text = line.replace(/^#{4,6}\s*/, '').replace(/\*\*/g, '')
          doc.text(text, MARGIN, currentY, { width: CONTENT_WIDTH })
          currentY += doc.heightOfString(text, { width: CONTENT_WIDTH }) + 3
        } else if (line.startsWith('- ') || line.startsWith('* ')) {
          const bulletContent = line.substring(2).replace(/\*\*/g, '')
          doc.font('Helvetica').fontSize(8)
          const textH = doc.heightOfString(bulletContent, { width: CONTENT_WIDTH - 15 })
          checkPageBreak(textH + 2)
          doc.font('Helvetica-Bold').fontSize(8).fillColor(COLOR_RED).text('•', MARGIN + 4, currentY)
          doc.font('Helvetica').fontSize(8).fillColor(COLOR_TEXT).text(bulletContent, MARGIN + 14, currentY, { width: CONTENT_WIDTH - 14 })
          currentY += textH + 2
        } else {
          const text = line.replace(/\*\*/g, '')
          doc.font('Helvetica').fontSize(8)
          const textH = doc.heightOfString(text, { width: CONTENT_WIDTH })
          checkPageBreak(textH + 3)
          doc.font('Helvetica').fontSize(8).fillColor(COLOR_TEXT).text(text, MARGIN, currentY, { width: CONTENT_WIDTH, align: 'justify' })
          currentY += textH + 3
        }
      }

      if (tableRows.length > 0) {
        renderTable(tableRows)
        tableRows = []
      }

      // Add page numbers on all pages in buffer
      const range = doc.bufferedPageRange()
      for (let p = 0; p < range.count; p++) {
        doc.switchToPage(p)
        doc.save()
        doc.rect(MARGIN, PAGE_HEIGHT - 26, CONTENT_WIDTH, 0.5).fill(COLOR_BORDER)
        doc.font('Helvetica').fontSize(6.5).fillColor('#94A3B8')
        doc.text(`Colegio Bilingüe San José Campestre • Formato SJB-RGA006 • Docente: ${metadata.authorName || 'Docente CBSJC'}`, MARGIN, PAGE_HEIGHT - 20, { width: CONTENT_WIDTH * 0.75, align: 'left' })
        doc.text(`Pág. ${p + 1} de ${range.count}`, MARGIN + CONTENT_WIDTH * 0.75, PAGE_HEIGHT - 20, { width: CONTENT_WIDTH * 0.25, align: 'right' })
        doc.restore()
      }

      doc.end()
    } catch (err) {
      reject(err)
    }
  })
}

// Test generating a 35-page document with massive tables!
let testMarkdown = `# 1. REFERENTES DE CALIDAD INSTITUCIONAL\n\n| Referente | Detalle Curricular Exhaustivo |\n|---|---|\n`
for (let i = 1; i <= 35; i++) {
  testMarkdown += `| **Referente ${i}** | Descripción exhaustiva para la fila ${i} de la malla curricular del CBSJC, integrando competencias, estándares de calidad EBC, derechos básicos de aprendizaje (DBA), metas del subciclo, componente ACE bilingüe con vocabulario técnico en inglés y articulación con el proyecto transversal PRAE en Tienda Nueva. |\n`
}
testMarkdown += `\n## 2. ARCO PEDAGÓGICO DE LA SECUENCIA\n`
for (let s = 1; s <= 20; s++) {
  testMarkdown += `### Sesión ${s}: Profundización y Trabajo en Aula\n- **Momento 1:** Activación cognitiva mediante rutina See-Think-Wonder en el campus campestre.\n- **Momento 2:** Trabajo práctico con registro sistemático de observaciones en la bitácora escolar.\n- **Momento 3:** Cierre reflexivo con Ticket de Salida y sentence frames en inglés.\n\n`
}

console.log('Generating massive PDF with PDFKit...')
generatePdfWithPdfKit('Planeacion Oficial CBSJC', testMarkdown, { authorName: 'Manolito Pérez' })
  .then((buf) => {
    console.log(`SUCCESS! Generated PDF buffer size: ${buf.length} bytes`)
    fs.writeFileSync(path.join(process.cwd(), 'scripts', 'test-pdfkit-massive.pdf'), buf)
    console.log('Saved to scripts/test-pdfkit-massive.pdf')
  })
  .catch((err) => {
    console.error('FAILED:', err)
  })

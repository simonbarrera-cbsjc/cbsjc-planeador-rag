import 'server-only'
import PDFDocument from 'pdfkit'
import path from 'path'
import fs from 'fs'

if (typeof window !== 'undefined') {
  throw new Error('lib/export/pdf.tsx must only be used on the server.')
}

interface GeneratePdfParams {
  title: string
  content: string
  documentType?: string
  language?: 'es' | 'en'
  metadata: {
    area?: string
    nivel?: string
    grado?: string
    periodo?: string
    date: string
    authorName?: string
  }
}

/**
 * Generates the official CBSJC Planning Book (SJB-RGA006) in PDF using native PDFKit.
 * Uses explicit in-memory TrueType fonts (Roboto) to bypass any AFM / standard-fonts bundling issues.
 */
export async function generatePdf(params: GeneratePdfParams): Promise<Buffer> {
  const { title, content, metadata } = params
  const safeDocente = metadata.authorName || 'Docente Titular CBSJC'

  // Load TTF font buffers
  const fontDir = path.join(process.cwd(), 'public', 'fonts')
  const regularPath = path.join(fontDir, 'Roboto-Regular.ttf')
  const boldPath = path.join(fontDir, 'Roboto-Bold.ttf')
  const italicPath = path.join(fontDir, 'Roboto-Italic.ttf')

  const regularFont = fs.existsSync(regularPath) ? fs.readFileSync(regularPath) : null
  const boldFont = fs.existsSync(boldPath) ? fs.readFileSync(boldPath) : null
  const italicFont = fs.existsSync(italicPath) ? fs.readFileSync(italicPath) : null

  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: 'A4',
        margin: 35,
        bufferPages: true,
        autoFirstPage: true,
        info: {
          Title: title,
          Author: safeDocente,
          Subject: 'Planning Book SJB-RGA006 CBSJC',
        },
      })

      // Register explicit TTF fonts
      if (regularFont) doc.registerFont('Roboto', regularFont)
      if (boldFont) doc.registerFont('Roboto-Bold', boldFont)
      if (italicFont) doc.registerFont('Roboto-Italic', italicFont)

      const fontReg = regularFont ? 'Roboto' : 'Helvetica'
      const fontBold = boldFont ? 'Roboto-Bold' : 'Helvetica-Bold'
      const fontItalic = italicFont ? 'Roboto-Italic' : 'Helvetica-Oblique'

      const buffers: Buffer[] = []
      doc.on('data', (chunk: Buffer) => buffers.push(chunk))
      doc.on('end', () => resolve(Buffer.concat(buffers)))
      doc.on('error', (err) => reject(err))

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
        doc.font(fontBold).fontSize(11).fillColor(COLOR_NAVY)
        doc.text('CBSJC', MARGIN, top + 14, { width: 80, align: 'center' })

        // Center Column (Title)
        const centerWidth = CONTENT_WIDTH - 80 - 130
        doc.rect(MARGIN + 80, top, centerWidth, height).lineWidth(0.5).stroke(COLOR_BORDER)
        doc.font(fontBold).fontSize(8.5).fillColor(COLOR_NAVY)
        doc.text('COLEGIO BILINGÜE SAN JOSÉ CAMPESTRE', MARGIN + 80, top + 5, { width: centerWidth, align: 'center' })
        doc.font(fontBold).fontSize(7.5).fillColor(COLOR_RED)
        doc.text('PLANNING BOOK PRIMARY & SECONDARY', MARGIN + 80, top + 16, { width: centerWidth, align: 'center' })
        doc.font(fontReg).fontSize(6.5).fillColor('#64748B')
        doc.text('Secuencia Didáctica: Antes — Durante — Después · Subciclos 3 a 6', MARGIN + 80, top + 27, { width: centerWidth, align: 'center' })

        // Right Column (Quality code)
        const rightX = MARGIN + 80 + centerWidth
        doc.rect(rightX, top, 130, height).fillAndStroke(COLOR_GRAY_BG, COLOR_BORDER)
        doc.font(fontBold).fontSize(7).fillColor(COLOR_NAVY)
        doc.text('CÓDIGO: SJB-RGA006', rightX + 6, top + 6, { width: 118, align: 'left' })
        doc.font(fontReg).fontSize(6.5).fillColor('#64748B')
        doc.text('VERSIÓN: 4  VIGENCIA: 2026', rightX + 6, top + 17, { width: 118, align: 'left' })
        doc.restore()
      }

      let currentY = 70

      const checkPageBreak = (neededHeight: number) => {
        if (currentY + neededHeight > PAGE_HEIGHT - 45) {
          doc.addPage()
          drawHeader()
          currentY = 70
        }
      }

      drawHeader()

      const cleanText = (str: string) => {
        if (!str) return ''
        return str
          .replace(/<br\s*\/?>/gi, '\n')
          .replace(/<strong[^>]*>(.*?)<\/strong>/gi, '$1')
          .replace(/<b[^>]*>(.*?)<\/b>/gi, '$1')
          .replace(/<em[^>]*>(.*?)<\/em>/gi, '$1')
          .replace(/<i[^>]*>(.*?)<\/i>/gi, '$1')
          .replace(/<span[^>]*>(.*?)<\/span>/gi, '$1')
          .replace(/<p[^>]*>(.*?)<\/p>/gi, '$1\n')
          .replace(/<div[^>]*>(.*?)<\/div>/gi, '$1\n')
          .replace(/<[^>]+>/g, '')
          .replace(/\*\*\*(.*?)\*\*\*/g, '$1')
          .replace(/\*\*(.*?)\*\*/g, '$1')
          .replace(/\*(.*?)\*/g, '$1')
          .replace(/_{1,3}(.*?)_{1,3}/g, '$1')
          .replace(/[*#]/g, '')
          .trim()
      }

      const lines = content.split('\n')
      let tableRows: string[][] = []

      const renderTable = (rows: string[][]) => {
        if (!rows || rows.length === 0) return
        const headers = rows[0] || []
        const dataRows = rows.slice(1)
        const isTwoCol = headers.length === 2
        const numCols = headers.length || 1

        const colWidths: number[] = []
        if (isTwoCol) {
          colWidths.push(CONTENT_WIDTH * 0.28, CONTENT_WIDTH * 0.72)
        } else if (numCols === 3) {
          const isMoments = headers.some((h) => /momento|fase/i.test(h)) || rows.some((r) => /ANTES|DURANTE/i.test(r[0]))
          if (isMoments) {
            colWidths.push(CONTENT_WIDTH * 0.16, CONTENT_WIDTH * 0.26, CONTENT_WIDTH * 0.58)
          } else {
            colWidths.push(CONTENT_WIDTH * 0.20, CONTENT_WIDTH * 0.35, CONTENT_WIDTH * 0.45)
          }
        } else if (numCols === 5) {
          const isRubric = headers.some((h) => /bronze|silver|gold|sin categor/i.test(h))
          if (isRubric) {
            colWidths.push(CONTENT_WIDTH * 0.18, CONTENT_WIDTH * 0.20, CONTENT_WIDTH * 0.21, CONTENT_WIDTH * 0.21, CONTENT_WIDTH * 0.20)
          } else {
            // Plan de evaluación continua
            colWidths.push(CONTENT_WIDTH * 0.25, CONTENT_WIDTH * 0.15, CONTENT_WIDTH * 0.18, CONTENT_WIDTH * 0.14, CONTENT_WIDTH * 0.28)
          }
        } else {
          for (let c = 0; c < numCols; c++) {
            colWidths.push(CONTENT_WIDTH / numCols)
          }
        }

        const getRowHeight = (cells: string[], isHeader = false) => {
          let maxHeight = 16
          cells.forEach((cell, ci) => {
            const w = colWidths[ci] || 50
            doc.font(isHeader ? fontBold : fontReg).fontSize(7)
            const textH = doc.heightOfString(cleanText(cell), { width: w - 8 })
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
          doc.font(fontBold).fontSize(7).fillColor('#FFFFFF')
          doc.text(cleanText(h), curX + 4, currentY + 4, { width: w - 8, align: 'left' })
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
              doc.font(fontBold).fontSize(7).fillColor(COLOR_NAVY)
            } else {
              doc.font(fontReg).fontSize(7).fillColor(COLOR_TEXT)
            }
            doc.text(cleanText(c), rowX + 4, currentY + 4, { width: w - 8, align: 'left' })
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
          const text = cleanText(line.substring(2))
          doc.font(fontBold).fontSize(11).fillColor(COLOR_NAVY)
          doc.text(text, MARGIN, currentY, { width: CONTENT_WIDTH })
          currentY += doc.heightOfString(text, { width: CONTENT_WIDTH }) + 5
        } else if (line.startsWith('## ')) {
          checkPageBreak(20)
          const text = cleanText(line.substring(3))
          doc.font(fontBold).fontSize(10).fillColor(COLOR_NAVY)
          doc.text(text, MARGIN, currentY, { width: CONTENT_WIDTH })
          currentY += doc.heightOfString(text, { width: CONTENT_WIDTH }) + 4
        } else if (line.startsWith('### ')) {
          checkPageBreak(18)
          const text = cleanText(line.substring(4))
          doc.font(fontBold).fontSize(8.5).fillColor(COLOR_RED)
          doc.text(text, MARGIN, currentY, { width: CONTENT_WIDTH })
          currentY += doc.heightOfString(text, { width: CONTENT_WIDTH }) + 3
        } else if (line.startsWith('#### ') || line.startsWith('##### ') || line.startsWith('###### ')) {
          checkPageBreak(16)
          const text = cleanText(line.replace(/^#{4,6}\s*/, ''))
          doc.font(fontBold).fontSize(8).fillColor(COLOR_NAVY)
          doc.text(text, MARGIN, currentY, { width: CONTENT_WIDTH })
          currentY += doc.heightOfString(text, { width: CONTENT_WIDTH }) + 3
        } else if (line.startsWith('- ') || line.startsWith('* ')) {
          const bulletContent = cleanText(line.substring(2))
          doc.font(fontReg).fontSize(8)
          const textH = doc.heightOfString(bulletContent, { width: CONTENT_WIDTH - 15 })
          checkPageBreak(textH + 2)
          doc.font(fontBold).fontSize(8).fillColor(COLOR_RED).text('•', MARGIN + 4, currentY)
          doc.font(fontReg).fontSize(8).fillColor(COLOR_TEXT).text(bulletContent, MARGIN + 14, currentY, { width: CONTENT_WIDTH - 14 })
          currentY += textH + 2
        } else {
          const text = cleanText(line)
          doc.font(fontReg).fontSize(8)
          const textH = doc.heightOfString(text, { width: CONTENT_WIDTH })
          checkPageBreak(textH + 3)
          doc.font(fontReg).fontSize(8).fillColor(COLOR_TEXT).text(text, MARGIN, currentY, { width: CONTENT_WIDTH, align: 'justify' })
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
        doc.font(fontReg).fontSize(6.5).fillColor('#94A3B8')
        doc.text(`Colegio Bilingüe San José Campestre • Formato SJB-RGA006 • Docente: ${safeDocente}`, MARGIN, PAGE_HEIGHT - 20, { width: CONTENT_WIDTH * 0.75, align: 'left' })
        doc.text(`Pág. ${p + 1} de ${range.count}`, MARGIN + CONTENT_WIDTH * 0.75, PAGE_HEIGHT - 20, { width: CONTENT_WIDTH * 0.25, align: 'right' })
        doc.restore()
      }

      doc.end()
    } catch (err) {
      reject(err)
    }
  })
}

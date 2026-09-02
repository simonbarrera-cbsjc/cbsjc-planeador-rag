import 'server-only'
import {
  Document,
  Paragraph,
  TextRun,
  HeadingLevel,
  Packer,
  Table,
  TableRow,
  TableCell,
  WidthType,
  BorderStyle,
  AlignmentType,
  Header,
  Footer,
  PageNumber,
  ShadingType,
  ImageRun,
} from 'docx'
import fs from 'fs'
import path from 'path'

if (typeof window !== 'undefined') {
  throw new Error('lib/export/docx.ts must only be used on the server.')
}

interface GenerateDocxParams {
  title: string
  content: string
  documentType: string
  language: 'es' | 'en'
  metadata: {
    area?: string
    nivel?: string
    grado?: string
    periodo?: string
    date: string
    authorName?: string
  }
}

function parseMarkdownTables(content: string) {
  // Extract sections and lines
  return content
}

export async function generateDocx(params: GenerateDocxParams): Promise<Buffer> {
  const { title, content, metadata } = params

  if (!content || content.trim().length === 0) {
    throw new Error('generateDocx: document content must not be empty.')
  }

  try {
    let logoBuffer: Buffer | null = null
    const logoPath = path.join(process.cwd(), 'public', 'cbsjc-crest.png')
    if (fs.existsSync(logoPath)) {
      logoBuffer = fs.readFileSync(logoPath)
    }

    // Helper for table borders
    const standardBorder = {
      top: { style: BorderStyle.SINGLE, size: 1, color: '94A3B8' },
      bottom: { style: BorderStyle.SINGLE, size: 1, color: '94A3B8' },
      left: { style: BorderStyle.SINGLE, size: 1, color: '94A3B8' },
      right: { style: BorderStyle.SINGLE, size: 1, color: '94A3B8' },
    }

    const cell = (
      text: string | string[],
      opts: {
        bold?: boolean
        fill?: string
        width?: number
        color?: string
        size?: number
        align?: (typeof AlignmentType)[keyof typeof AlignmentType]
        colSpan?: number
      } = {}
    ) => {
      const {
        bold = false,
        fill = undefined,
        width = undefined,
        color = '0E1B4D',
        size = 19, // ~9.5pt
        align = AlignmentType.LEFT,
        colSpan = undefined,
      } = opts

      const lines = Array.isArray(text) ? text : [String(text)]
      return new TableCell({
        width: width ? { size: width, type: WidthType.PERCENTAGE } : undefined,
        columnSpan: colSpan,
        shading: fill ? { fill } : undefined,
        borders: standardBorder,
        children: lines.map(
          (l) =>
            new Paragraph({
              children: [
                new TextRun({
                  text: l,
                  bold,
                  color,
                  size,
                  font: 'Calibri',
                }),
              ],
              alignment: align,
              spacing: { before: 40, after: 40 },
            })
        ),
      })
    }

    // 1. Header Table (Colegio Bilingüe San José Campestre)
    const headerTable = new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: [
        new TableRow({
          children: [
            new TableCell({
              width: { size: 18, type: WidthType.PERCENTAGE },
              borders: standardBorder,
              children: logoBuffer
                ? [
                    new Paragraph({
                      children: [
                        new ImageRun({
                          data: logoBuffer,
                          transformation: { width: 50, height: 50 },
                          type: 'png',
                        }),
                      ],
                      alignment: AlignmentType.CENTER,
                    }),
                  ]
                : [
                    new Paragraph({
                      children: [
                        new TextRun({
                          text: 'CBSJC',
                          bold: true,
                          size: 20,
                          color: '0E1B4D',
                          font: 'Calibri',
                        }),
                      ],
                      alignment: AlignmentType.CENTER,
                    }),
                  ],
            }),
            new TableCell({
              width: { size: 57, type: WidthType.PERCENTAGE },
              borders: standardBorder,
              children: [
                new Paragraph({
                  children: [
                    new TextRun({
                      text: 'COLEGIO BILINGÜE SAN JOSÉ CAMPESTRE\n',
                      bold: true,
                      size: 18,
                      color: '0E1B4D',
                      font: 'Calibri',
                    }),
                    new TextRun({
                      text: 'PLANNING BOOK PRIMARY & SECONDARY\n',
                      bold: true,
                      size: 16,
                      color: 'D71921',
                      font: 'Calibri',
                    }),
                    new TextRun({
                      text: 'Secuencia Didáctica: Antes — Durante — Después · Formato RGA006',
                      size: 13,
                      color: '64748B',
                      font: 'Calibri',
                    }),
                  ],
                  alignment: AlignmentType.CENTER,
                }),
              ],
            }),
            new TableCell({
              width: { size: 25, type: WidthType.PERCENTAGE },
              borders: standardBorder,
              children: [
                new Paragraph({
                  children: [
                    new TextRun({
                      text: 'CÓDIGO: SJB-RGA006\n',
                      bold: true,
                      size: 13,
                      color: '0E1B4D',
                      font: 'Calibri',
                    }),
                    new TextRun({ text: 'VERSIÓN: 4\n', size: 13, color: '64748B', font: 'Calibri' }),
                    new TextRun({ text: 'VIGENCIA: 2026\n', size: 13, color: '64748B', font: 'Calibri' }),
                    new TextRun({ text: 'PÁGINA: ', size: 13, color: '64748B', font: 'Calibri' }),
                    new TextRun({
                      children: [PageNumber.CURRENT],
                      size: 13,
                      color: '0E1B4D',
                      bold: true,
                      font: 'Calibri',
                    }),
                  ],
                  alignment: AlignmentType.RIGHT,
                }),
              ],
            }),
          ],
        }),
      ],
    })

    // Parse markdown lines & tables to render structured DOCX elements
    const bodyElements: (Paragraph | Table)[] = []

    // Title banner
    bodyElements.push(
      new Paragraph({
        children: [
          new TextRun({
            text: 'Secuencia Didáctica: Antes — Durante — Después · Subciclos 3 a 6',
            bold: true,
            size: 24,
            color: '0E1B4D',
            font: 'Calibri',
          }),
        ],
        alignment: AlignmentType.CENTER,
        spacing: { before: 180, after: 140 },
      })
    )

    // Table 1: Identificación Docente
    bodyElements.push(
      new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: [
          new TableRow({
            children: [
              cell('Docente(s)', { bold: true, width: 25, fill: 'F1F5F9', color: '0E1B4D' }),
              cell(metadata.authorName || 'Docente Titular CBSJC', { width: 75 }),
            ],
          }),
          new TableRow({
            children: [
              cell('Área / Asignatura', { bold: true, width: 25, fill: 'F1F5F9', color: '0E1B4D' }),
              cell(metadata.area || 'Ciencias Naturales y Educación Ambiental', { width: 75 }),
            ],
          }),
          new TableRow({
            children: [
              cell('Grado / Grupo', { bold: true, width: 25, fill: 'F1F5F9', color: '0E1B4D' }),
              cell(metadata.grado || 'Grado 6°', { width: 75 }),
            ],
          }),
          new TableRow({
            children: [
              cell('Período / Subciclo', { bold: true, width: 25, fill: 'F1F5F9', color: '0E1B4D' }),
              cell(`Periodo ${metadata.periodo || 'I'} (Año Lectivo 2026)`, { width: 75 }),
            ],
          }),
          new TableRow({
            children: [
              cell('Fecha(s) / Semanas', { bold: true, width: 25, fill: 'F1F5F9', color: '0E1B4D' }),
              cell(`Bloque de 4 Semanas (Sesiones de 90 min) • Generado: ${metadata.date}`, { width: 75 }),
            ],
          }),
        ],
      })
    )

    bodyElements.push(new Paragraph({ text: '', spacing: { before: 120, after: 120 } }))

    // Process markdown sections and tables
    const markdownLines = content.split('\n')
    let currentTableRows: string[][] = []
    let inTable = false

    const flushTable = () => {
      if (currentTableRows.length > 0) {
        const rows = currentTableRows.map((row, rIdx) => {
          const isHeader = rIdx === 0
          return new TableRow({
            children: row.map((colText) =>
              cell(colText.trim(), {
                bold: isHeader,
                fill: isHeader ? '0E1B4D' : rIdx % 2 === 1 ? 'FFFFFF' : 'F8FAFC',
                color: isHeader ? 'FFFFFF' : '1E293B',
                size: isHeader ? 19 : 18,
              })
            ),
          })
        })

        bodyElements.push(
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows,
          })
        )
        bodyElements.push(new Paragraph({ text: '', spacing: { after: 100 } }))
        currentTableRows = []
        inTable = false
      }
    }

    for (let i = 0; i < markdownLines.length; i++) {
      const rawLine = markdownLines[i]
      const line = rawLine.trim()

      // Table line detection
      if (line.startsWith('|') && line.endsWith('|')) {
        // Skip separator line |---|---|
        if (/^\|[\s\-:|]+\|$/.test(line)) {
          continue
        }
        const cols = line
          .slice(1, -1)
          .split('|')
          .map((c) => c.trim().replace(/\*\*/g, ''))
        currentTableRows.push(cols)
        inTable = true
        continue
      } else if (inTable) {
        flushTable()
      }

      if (!line) {
        bodyElements.push(new Paragraph({ text: '', spacing: { after: 60 } }))
        continue
      }

      // Headings
      if (line.startsWith('# ')) {
        bodyElements.push(
          new Paragraph({
            children: [
              new TextRun({
                text: line.substring(2).replace(/\*\*/g, ''),
                bold: true,
                size: 26,
                color: '0E1B4D',
                font: 'Calibri',
              }),
            ],
            heading: HeadingLevel.HEADING_1,
            spacing: { before: 240, after: 120 },
          })
        )
      } else if (line.startsWith('## ')) {
        const hText = line.substring(3).replace(/\*\*/g, '')
        bodyElements.push(
          new Paragraph({
            children: [
              new TextRun({
                text: hText,
                bold: true,
                size: 22,
                color: '0E1B4D',
                font: 'Calibri',
              }),
            ],
            heading: HeadingLevel.HEADING_2,
            spacing: { before: 200, after: 100 },
          })
        )
      } else if (line.startsWith('### ')) {
        const hText = line.substring(4).replace(/\*\*/g, '')
        bodyElements.push(
          new Paragraph({
            children: [
              new TextRun({
                text: hText,
                bold: true,
                size: 20,
                color: 'D71921',
                font: 'Calibri',
              }),
            ],
            heading: HeadingLevel.HEADING_3,
            spacing: { before: 160, after: 80 },
          })
        )
      } else if (line.startsWith('- ') || line.startsWith('* ') || /^\d+\.\s/.test(line)) {
        const cleanText = line.replace(/^[-*]\s+|\d+\.\s+/, '')
        // Parse bold runs
        const parts = cleanText.split(/(\*\*.*?\*\*)/g)
        const runs: TextRun[] = []
        for (const p of parts) {
          if (p.startsWith('**') && p.endsWith('**')) {
            runs.push(new TextRun({ text: p.slice(2, -2), bold: true, size: 20, color: '0E1B4D', font: 'Calibri' }))
          } else if (p.length > 0) {
            runs.push(new TextRun({ text: p, size: 20, color: '1E293B', font: 'Calibri' }))
          }
        }
        bodyElements.push(
          new Paragraph({
            bullet: { level: 0 },
            children: runs,
            spacing: { after: 60 },
          })
        )
      } else {
        // Regular paragraph with bold parsing
        const parts = line.split(/(\*\*.*?\*\*)/g)
        const runs: TextRun[] = []
        for (const p of parts) {
          if (p.startsWith('**') && p.endsWith('**')) {
            runs.push(new TextRun({ text: p.slice(2, -2), bold: true, size: 20, color: '0E1B4D', font: 'Calibri' }))
          } else if (p.length > 0) {
            runs.push(new TextRun({ text: p, size: 20, color: '334155', font: 'Calibri' }))
          }
        }
        bodyElements.push(
          new Paragraph({
            children: runs,
            spacing: { after: 100 },
            alignment: AlignmentType.JUSTIFIED,
          })
        )
      }
    }

    if (inTable) {
      flushTable()
    }

    // Append institutional signatures table at the end
    bodyElements.push(new Paragraph({ text: '', spacing: { before: 200, after: 100 } }))
    bodyElements.push(
      new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: [
          new TableRow({
            children: [
              cell('ELABORÓ', { bold: true, fill: 'F1F5F9', align: AlignmentType.CENTER, width: 33 }),
              cell('REVISÓ', { bold: true, fill: 'F1F5F9', align: AlignmentType.CENTER, width: 34 }),
              cell('APROBÓ', { bold: true, fill: 'F1F5F9', align: AlignmentType.CENTER, width: 33 }),
            ],
          }),
          new TableRow({
            children: [
              cell(
                [
                  '_____________________________',
                  metadata.authorName || 'Docente Titular de Asignatura',
                  `${metadata.grado || 'Grado 6°'} — Subciclo 4`,
                  'Colegio Bilingüe San José Campestre',
                ],
                { align: AlignmentType.CENTER }
              ),
              cell(
                [
                  '_____________________________',
                  'Líder de Área / Coordinación de Subciclo',
                  'Comité Curricular y Pedagógico',
                  'Colegio Bilingüe San José Campestre',
                ],
                { align: AlignmentType.CENTER }
              ),
              cell(
                [
                  '_____________________________',
                  'Coordinación Académica General',
                  'Rectoría Institucional',
                  'Colegio Bilingüe San José Campestre',
                ],
                { align: AlignmentType.CENTER }
              ),
            ],
          }),
        ],
      })
    )

    // Build the official Document
    const doc = new Document({
      sections: [
        {
          properties: {
            page: {
              margin: {
                top: 1200,
                bottom: 1200,
                left: 1200,
                right: 1200,
              },
            },
          },
          headers: {
            default: new Header({
              children: [headerTable],
            }),
          },
          footers: {
            default: new Footer({
              children: [
                new Paragraph({
                  children: [
                    new TextRun({
                      text: `Colegio Bilingüe San José Campestre • Formato Oficial SJB-RGA006 • Página `,
                      size: 15,
                      color: '64748B',
                      font: 'Calibri',
                    }),
                    new TextRun({
                      children: [PageNumber.CURRENT],
                      size: 15,
                      color: '0E1B4D',
                      bold: true,
                      font: 'Calibri',
                    }),
                  ],
                  alignment: AlignmentType.CENTER,
                }),
              ],
            }),
          },
          children: bodyElements,
        },
      ],
    })

    const buffer = await Packer.toBuffer(doc)
    return buffer
  } catch (error) {
    console.error('Error generating DOCX:', error)
    throw new Error(`DOCX generation failed: ${error instanceof Error ? error.message : String(error)}`)
  }
}

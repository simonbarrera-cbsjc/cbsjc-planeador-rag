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
  VerticalAlignTable,
} from 'docx'
import fs from 'fs'
import path from 'path'

if (typeof window !== 'undefined') {
  throw new Error('lib/export/rubrics-docx.ts must only be used on the server.')
}

export interface GenerateRubricsDocxParams {
  title: string
  content: string
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

// Institutional Colors
const COLOR_PRIMARY_NAVY = '1F3864' // Deep Institutional Navy
const COLOR_DARK_NAVY = '0E1B4D' // Dark Heading Navy
const COLOR_ACCENT_NAVY = '2E5395' // Accent Navy
const COLOR_CBSJC_RED = 'D71921' // Institutional Red
const COLOR_TEXT_DARK = '1E293B' // Body Text Dark Slate
const COLOR_TEXT_MUTED = '64748B' // Muted Slate Gray
const COLOR_TEXT_WHITE = 'FFFFFF' // White Text
const COLOR_BORDER_GRAY = 'CBD5E1' // Single 0.5pt Border
const COLOR_SHADING_LIGHT = 'D9E2F3' // Light Blue/Gray Metadata Fill
const COLOR_SHADING_SOFT = 'EEF2F9' // Soft Ice Blue/Gray Fill
const COLOR_SHADING_ZEBRA = 'F8FAFC' // Table Zebra Fill

const standardBorder = {
  top: { style: BorderStyle.SINGLE, size: 4, color: COLOR_BORDER_GRAY },
  bottom: { style: BorderStyle.SINGLE, size: 4, color: COLOR_BORDER_GRAY },
  left: { style: BorderStyle.SINGLE, size: 4, color: COLOR_BORDER_GRAY },
  right: { style: BorderStyle.SINGLE, size: 4, color: COLOR_BORDER_GRAY },
}

/**
 * Parses markdown inline formatting (bold, italic, code) into TextRun objects.
 */
function parseInlineRuns(
  text: string,
  defaults: {
    bold?: boolean
    italics?: boolean
    color?: string
    size?: number
    font?: string
  } = {}
): TextRun[] {
  const {
    bold = false,
    italics = false,
    color = COLOR_TEXT_DARK,
    size = 18,
    font = 'Calibri',
  } = defaults

  const runs: TextRun[] = []
  const regex = /(\*\*.*?\*\*|\*.*?\*|`.*?`)/g
  const parts = text.split(regex)

  for (const part of parts) {
    if (!part) continue

    if (part.startsWith('**') && part.endsWith('**') && part.length >= 4) {
      runs.push(
        new TextRun({
          text: part.slice(2, -2),
          bold: true,
          italics,
          color: color === COLOR_TEXT_WHITE ? COLOR_TEXT_WHITE : COLOR_DARK_NAVY,
          size,
          font,
        })
      )
    } else if (part.startsWith('*') && part.endsWith('*') && part.length >= 2) {
      runs.push(
        new TextRun({
          text: part.slice(1, -1),
          bold,
          italics: true,
          color,
          size,
          font,
        })
      )
    } else if (part.startsWith('`') && part.endsWith('`') && part.length >= 2) {
      runs.push(
        new TextRun({
          text: part.slice(1, -1),
          bold,
          color: COLOR_DARK_NAVY,
          size: size - 1,
          font: 'Consolas',
        })
      )
    } else {
      runs.push(
        new TextRun({
          text: part,
          bold,
          italics,
          color,
          size,
          font,
        })
      )
    }
  }

  return runs.length > 0
    ? runs
    : [
        new TextRun({
          text,
          bold,
          italics,
          color,
          size,
          font,
        }),
      ]
}

/**
 * Creates a styled TableCell supporting rich multiline text and borders.
 */
function createStyledCell(
  content: string | string[] | Paragraph[],
  opts: {
    bold?: boolean
    italics?: boolean
    fill?: string
    width?: number
    color?: string
    size?: number
    align?: (typeof AlignmentType)[keyof typeof AlignmentType]
    colSpan?: number
    vAlign?: (typeof VerticalAlignTable)[keyof typeof VerticalAlignTable]
  } = {}
): TableCell {
  const {
    bold = false,
    italics = false,
    fill = undefined,
    width = undefined,
    color = COLOR_TEXT_DARK,
    size = 18,
    align = AlignmentType.LEFT,
    colSpan = undefined,
    vAlign = VerticalAlignTable.CENTER,
  } = opts

  let children: Paragraph[] = []

  if (Array.isArray(content) && content.length > 0 && content[0] instanceof Paragraph) {
    children = content as Paragraph[]
  } else {
    const rawLines: string[] = []
    const inputLines = Array.isArray(content) ? (content as string[]) : [String(content)]

    for (const item of inputLines) {
      const subLines = String(item).split(/<br\s*\/?>|\n/i)
      rawLines.push(...subLines)
    }

    children = rawLines.map((line) => {
      const trimmed = line.trim()
      const runs = parseInlineRuns(trimmed, {
        bold,
        italics,
        color,
        size,
        font: 'Calibri',
      })
      return new Paragraph({
        children: runs,
        alignment: align,
        spacing: { before: 30, after: 30, line: 240 },
      })
    })
  }

  return new TableCell({
    width: width ? { size: width, type: WidthType.PERCENTAGE } : undefined,
    columnSpan: colSpan,
    shading: fill ? { fill } : undefined,
    borders: standardBorder,
    verticalAlign: vAlign,
    margins: {
      top: 80,
      bottom: 80,
      left: 120,
      right: 120,
    },
    children: children.length > 0 ? children : [new Paragraph({ text: '' })],
  })
}

/**
 * Builds the official 3-column CBSJC header table for Rubrics documents.
 */
function buildRubricsHeaderTable(logoBuffer: Buffer | null): Table {
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({
        children: [
          // Column 1: Institutional Crest Logo
          new TableCell({
            width: { size: 18, type: WidthType.PERCENTAGE },
            borders: standardBorder,
            verticalAlign: VerticalAlignTable.CENTER,
            margins: { top: 60, bottom: 60, left: 60, right: 60 },
            children: logoBuffer
              ? [
                  new Paragraph({
                    children: [
                      new ImageRun({
                        data: logoBuffer,
                        transformation: { width: 52, height: 52 },
                        type: 'png',
                        altText: {
                          name: 'CBSJC Crest',
                          description: 'Escudo Institucional Colegio Bilingüe San José Campestre',
                          title: 'CBSJC Crest',
                        },
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
                        size: 22,
                        color: COLOR_PRIMARY_NAVY,
                        font: 'Calibri',
                      }),
                    ],
                    alignment: AlignmentType.CENTER,
                  }),
                ],
          }),

          // Column 2: Document Header Title
          new TableCell({
            width: { size: 56, type: WidthType.PERCENTAGE },
            borders: standardBorder,
            verticalAlign: VerticalAlignTable.CENTER,
            margins: { top: 60, bottom: 60, left: 100, right: 100 },
            children: [
              new Paragraph({
                children: [
                  new TextRun({
                    text: 'COLEGIO BILINGÜE SAN JOSÉ CAMPESTRE\n',
                    bold: true,
                    size: 19,
                    color: COLOR_PRIMARY_NAVY,
                    font: 'Calibri',
                  }),
                  new TextRun({
                    text: 'MATRIZ DE RÚBRICAS & MENÚ DE DESAFÍOS\n',
                    bold: true,
                    size: 17,
                    color: COLOR_CBSJC_RED,
                    font: 'Calibri',
                  }),
                  new TextRun({
                    text: 'Sistema Institucional de Evaluación de los Aprendizajes (SIEE / SIAP)',
                    size: 14,
                    color: COLOR_TEXT_MUTED,
                    font: 'Calibri',
                  }),
                ],
                alignment: AlignmentType.CENTER,
                spacing: { before: 20, after: 20, line: 240 },
              }),
            ],
          }),

          // Column 3: Quality Management Metadata Box
          new TableCell({
            width: { size: 26, type: WidthType.PERCENTAGE },
            borders: standardBorder,
            verticalAlign: VerticalAlignTable.CENTER,
            margins: { top: 60, bottom: 60, left: 80, right: 80 },
            children: [
              new Paragraph({
                children: [
                  new TextRun({
                    text: 'CÓDIGO: SJB-RGA-RUB\n',
                    bold: true,
                    size: 15,
                    color: COLOR_PRIMARY_NAVY,
                    font: 'Calibri',
                  }),
                  new TextRun({
                    text: 'VERSIÓN: 4\n',
                    size: 14,
                    color: COLOR_TEXT_MUTED,
                    font: 'Calibri',
                  }),
                  new TextRun({
                    text: 'VIGENCIA: 2026\n',
                    size: 14,
                    color: COLOR_TEXT_MUTED,
                    font: 'Calibri',
                  }),
                  new TextRun({
                    text: 'PÁGINA: ',
                    size: 14,
                    color: COLOR_TEXT_MUTED,
                    font: 'Calibri',
                  }),
                  new TextRun({
                    children: [PageNumber.CURRENT],
                    bold: true,
                    size: 14,
                    color: COLOR_PRIMARY_NAVY,
                    font: 'Calibri',
                  }),
                  new TextRun({
                    text: ' DE ',
                    size: 14,
                    color: COLOR_TEXT_MUTED,
                    font: 'Calibri',
                  }),
                  new TextRun({
                    children: [PageNumber.TOTAL_PAGES],
                    bold: true,
                    size: 14,
                    color: COLOR_PRIMARY_NAVY,
                    font: 'Calibri',
                  }),
                ],
                alignment: AlignmentType.RIGHT,
                spacing: { before: 20, after: 20, line: 240 },
              }),
            ],
          }),
        ],
      }),
    ],
  })
}

/**
 * Builds the official 3-column Signatures table for rubrics document.
 */
function buildRubricsSignaturesTable(authorName: string, grado: string): Table {
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({
        children: [
          createStyledCell('ELABORÓ', {
            bold: true,
            fill: COLOR_SHADING_LIGHT,
            color: COLOR_DARK_NAVY,
            align: AlignmentType.CENTER,
            width: 33,
            size: 18,
          }),
          createStyledCell('REVISÓ', {
            bold: true,
            fill: COLOR_SHADING_LIGHT,
            color: COLOR_DARK_NAVY,
            align: AlignmentType.CENTER,
            width: 34,
            size: 18,
          }),
          createStyledCell('APROBÓ', {
            bold: true,
            fill: COLOR_SHADING_LIGHT,
            color: COLOR_DARK_NAVY,
            align: AlignmentType.CENTER,
            width: 33,
            size: 18,
          }),
        ],
      }),
      new TableRow({
        children: [
          createStyledCell(
            [
              '_____________________________',
              authorName || 'Docente Titular de Asignatura',
              `${grado || 'Grado 6°'} — Subciclos 3 a 6`,
              'Colegio Bilingüe San José Campestre',
            ],
            { align: AlignmentType.CENTER, size: 16, width: 33 }
          ),
          createStyledCell(
            [
              '_____________________________',
              'Líder de Área / Coordinación Pedagógica',
              'Comité de Evaluación y Calidad',
              'Colegio Bilingüe San José Campestre',
            ],
            { align: AlignmentType.CENTER, size: 16, width: 34 }
          ),
          createStyledCell(
            [
              '_____________________________',
              'Coordinación Académica General',
              'Rectoría Institucional',
              'Colegio Bilingüe San José Campestre',
            ],
            { align: AlignmentType.CENTER, size: 16, width: 33 }
          ),
        ],
      }),
    ],
  })
}

/**
 * Builds high-fidelity rubrics tables with column widths and band styles.
 */
function formatRubricTable(rawRows: string[][]): Table {
  if (rawRows.length === 0) {
    return new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: [] })
  }

  const numCols = Math.max(...rawRows.map((r) => r.length))

  // 5-Column Rubric Matrix (Criterio / Sin categoría / Bronze / Silver / Gold)
  if (numCols === 5) {
    const colWidths = [18, 20, 21, 21, 20]
    const rows = rawRows.map((row, rIdx) => {
      const isHeader = rIdx === 0
      return new TableRow({
        children: row.map((colText, cIdx) => {
          const width = colWidths[cIdx] || 20

          if (isHeader) {
            return createStyledCell(colText, {
              bold: true,
              fill: COLOR_PRIMARY_NAVY,
              color: COLOR_TEXT_WHITE,
              width,
              size: 17,
              align: cIdx > 0 ? AlignmentType.CENTER : AlignmentType.LEFT,
            })
          }

          const isFirstCol = cIdx === 0
          return createStyledCell(colText, {
            bold: isFirstCol,
            fill: isFirstCol
              ? COLOR_SHADING_LIGHT
              : rIdx % 2 === 1
              ? COLOR_TEXT_WHITE
              : COLOR_SHADING_ZEBRA,
            color: isFirstCol ? COLOR_DARK_NAVY : COLOR_TEXT_DARK,
            width,
            size: 17,
          })
        }),
      })
    })

    return new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows })
  }

  // 2-Column Key-Value or Criteria Table
  if (numCols === 2) {
    const rows = rawRows.map((row, rIdx) => {
      const isHeader = rIdx === 0 && /criterio|dimensi[oó]n|aspecto/i.test(row[0])
      return new TableRow({
        children: [
          createStyledCell(row[0] || '', {
            bold: true,
            fill: isHeader ? COLOR_PRIMARY_NAVY : COLOR_SHADING_LIGHT,
            color: isHeader ? COLOR_TEXT_WHITE : COLOR_DARK_NAVY,
            width: 30,
            size: 17,
          }),
          createStyledCell(row[1] || '', {
            bold: isHeader,
            fill: isHeader ? COLOR_PRIMARY_NAVY : undefined,
            color: isHeader ? COLOR_TEXT_WHITE : COLOR_TEXT_DARK,
            width: 70,
            size: 17,
          }),
        ],
      })
    })

    return new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows })
  }

  // Fallback generic table
  const colWidth = Math.floor(100 / numCols)
  const rows = rawRows.map((row, rIdx) => {
    const isHeader = rIdx === 0
    return new TableRow({
      children: row.map((colText, cIdx) =>
        createStyledCell(colText, {
          bold: isHeader,
          fill: isHeader ? COLOR_PRIMARY_NAVY : cIdx === 0 ? COLOR_SHADING_LIGHT : undefined,
          color: isHeader ? COLOR_TEXT_WHITE : cIdx === 0 ? COLOR_DARK_NAVY : COLOR_TEXT_DARK,
          width: colWidth,
          size: 17,
        })
      ),
    })
  })

  return new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows })
}

/**
 * Main export function to generate standalone DOCX rubrics document.
 */
export async function generateRubricsDocx(params: GenerateRubricsDocxParams): Promise<Buffer> {
  const { title, content, metadata } = params

  if (!content || content.trim().length === 0) {
    throw new Error('generateRubricsDocx: document content must not be empty.')
  }

  try {
    let logoBuffer: Buffer | null = null
    const logoPath = path.join(process.cwd(), 'public', 'cbsjc-crest.png')
    if (fs.existsSync(logoPath)) {
      logoBuffer = fs.readFileSync(logoPath)
    }

    const headerTable = buildRubricsHeaderTable(logoBuffer)
    const bodyElements: (Paragraph | Table)[] = []

    // 1. Document Title Banner
    bodyElements.push(
      new Paragraph({
        children: [
          new TextRun({
            text: 'MATRIZ DE RÚBRICAS EVALUATIVAS: MENÚ DE DESAFÍOS & CRITERIOS ANALÍTICOS',
            bold: true,
            size: 24, // 12pt
            color: COLOR_DARK_NAVY,
            font: 'Calibri',
          }),
        ],
        alignment: AlignmentType.CENTER,
        spacing: { before: 120, after: 140 },
      })
    )

    // 2. Metadata Identification Box
    if (metadata) {
      bodyElements.push(
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          rows: [
            new TableRow({
              children: [
                createStyledCell('Docente(s)', {
                  bold: true,
                  width: 25,
                  fill: COLOR_SHADING_LIGHT,
                  color: COLOR_DARK_NAVY,
                }),
                createStyledCell(metadata.authorName || 'Docente Titular CBSJC', { width: 75 }),
              ],
            }),
            new TableRow({
              children: [
                createStyledCell('Área / Asignatura', {
                  bold: true,
                  width: 25,
                  fill: COLOR_SHADING_LIGHT,
                  color: COLOR_DARK_NAVY,
                }),
                createStyledCell(metadata.area || 'Ciencias Naturales y Educación Ambiental', {
                  width: 75,
                }),
              ],
            }),
            new TableRow({
              children: [
                createStyledCell('Grado / Subciclo', {
                  bold: true,
                  width: 25,
                  fill: COLOR_SHADING_LIGHT,
                  color: COLOR_DARK_NAVY,
                }),
                createStyledCell(
                  `${metadata.grado || 'Grado 6°'} • Periodo ${metadata.periodo || 'I'} (Año Lectivo 2026)`,
                  { width: 75 }
                ),
              ],
            }),
            new TableRow({
              children: [
                createStyledCell('Evidencia Principal / Tema', {
                  bold: true,
                  width: 25,
                  fill: COLOR_SHADING_LIGHT,
                  color: COLOR_DARK_NAVY,
                }),
                createStyledCell(title.replace(/^R[uú]bricas\s*:\s*/i, ''), { width: 75 }),
              ],
            }),
            new TableRow({
              children: [
                createStyledCell('Escala Institucional SIEE', {
                  bold: true,
                  width: 25,
                  fill: COLOR_SHADING_LIGHT,
                  color: COLOR_DARK_NAVY,
                }),
                createStyledCell(
                  'Sin categoría (1,0 – 3,9) • Bronze (4,0 – 4,5) • Silver (4,6 – 4,7) • Gold (4,8 – 5,0)',
                  { width: 75, bold: true, color: COLOR_PRIMARY_NAVY }
                ),
              ],
            }),
          ],
        })
      )
      bodyElements.push(new Paragraph({ text: '', spacing: { before: 100, after: 100 } }))
    }

    // Process markdown sections & tables
    const lines = content.split('\n')
    let currentTableRows: string[][] = []
    let inTable = false

    const flushTable = () => {
      if (currentTableRows.length > 0) {
        const table = formatRubricTable(currentTableRows)
        bodyElements.push(table)
        bodyElements.push(new Paragraph({ text: '', spacing: { after: 120 } }))
        currentTableRows = []
        inTable = false
      }
    }

    for (let i = 0; i < lines.length; i++) {
      const rawLine = lines[i]
      const line = rawLine.trim()

      // Table line detection
      if (line.startsWith('|') && line.endsWith('|')) {
        if (/^\|[\s\-:|]+\|$/.test(line)) {
          continue
        }
        const cols = line
          .slice(1, -1)
          .split('|')
          .map((c) => c.trim())
        currentTableRows.push(cols)
        inTable = true
        continue
      } else if (inTable) {
        flushTable()
      }

      if (!line) {
        continue
      }

      // Headings
      if (line.startsWith('# ')) {
        const hText = line.substring(2).replace(/\*\*/g, '').trim()
        bodyElements.push(
          new Paragraph({
            children: [
              new TextRun({
                text: hText,
                bold: true,
                size: 24, // 12pt
                color: COLOR_DARK_NAVY,
                font: 'Calibri',
              }),
            ],
            heading: HeadingLevel.HEADING_1,
            spacing: { before: 240, after: 100 },
          })
        )
      } else if (line.startsWith('## ')) {
        const hText = line.substring(3).replace(/\*\*/g, '').trim()
        bodyElements.push(
          new Paragraph({
            children: [
              new TextRun({
                text: hText,
                bold: true,
                size: 22, // 11pt
                color: COLOR_PRIMARY_NAVY,
                font: 'Calibri',
              }),
            ],
            heading: HeadingLevel.HEADING_2,
            spacing: { before: 200, after: 80 },
          })
        )
      } else if (line.startsWith('### ')) {
        const hText = line.substring(4).replace(/\*\*/g, '').trim()
        bodyElements.push(
          new Paragraph({
            children: [
              new TextRun({
                text: hText,
                bold: true,
                size: 20, // 10pt
                color: COLOR_CBSJC_RED,
                font: 'Calibri',
              }),
            ],
            heading: HeadingLevel.HEADING_3,
            spacing: { before: 160, after: 60 },
          })
        )
      } else if (line.startsWith('#### ')) {
        const hText = line.substring(5).replace(/\*\*/g, '').trim()
        bodyElements.push(
          new Paragraph({
            children: [
              new TextRun({
                text: hText,
                bold: true,
                size: 19, // 9.5pt
                color: COLOR_ACCENT_NAVY,
                font: 'Calibri',
              }),
            ],
            heading: HeadingLevel.HEADING_4,
            spacing: { before: 120, after: 40 },
          })
        )
      } else if (line.startsWith('> ') || (line.startsWith('*') && line.endsWith('*') && !line.includes('**'))) {
        const noteText = line.replace(/^>\s*/, '').replace(/^\*|\*$/g, '').trim()
        bodyElements.push(
          new Paragraph({
            children: parseInlineRuns(noteText, {
              italics: true,
              color: COLOR_TEXT_MUTED,
              size: 17,
            }),
            spacing: { before: 40, after: 80 },
            alignment: AlignmentType.JUSTIFIED,
          })
        )
      } else if (line.startsWith('- ') || line.startsWith('* ') || /^\d+\.\s/.test(line)) {
        const cleanText = line.replace(/^[-*]\s+|\d+\.\s+/, '')
        bodyElements.push(
          new Paragraph({
            bullet: { level: 0 },
            children: parseInlineRuns(cleanText, { size: 18 }),
            spacing: { before: 20, after: 40 },
          })
        )
      } else if (line === '---' || line === '***') {
        bodyElements.push(new Paragraph({ text: '', spacing: { before: 100, after: 100 } }))
      } else {
        bodyElements.push(
          new Paragraph({
            children: parseInlineRuns(line, { size: 18 }),
            spacing: { before: 30, after: 60 },
            alignment: AlignmentType.JUSTIFIED,
          })
        )
      }
    }

    if (inTable) {
      flushTable()
    }

    // Append institutional signatures table
    bodyElements.push(new Paragraph({ text: '', spacing: { before: 200, after: 80 } }))
    bodyElements.push(
      buildRubricsSignaturesTable(
        metadata.authorName || 'Docente Titular CBSJC',
        metadata.grado || 'Grado 6°'
      )
    )

    // Build Document
    const doc = new Document({
      sections: [
        {
          properties: {
            page: {
              margin: {
                top: 1600,
                bottom: 1000,
                left: 1000,
                right: 1000,
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
                      text: 'Colegio Bilingüe San José Campestre • Matriz Oficial SJB-RGA-RUB • Página ',
                      size: 15,
                      color: COLOR_TEXT_MUTED,
                      font: 'Calibri',
                    }),
                    new TextRun({
                      children: [PageNumber.CURRENT],
                      size: 15,
                      color: COLOR_PRIMARY_NAVY,
                      bold: true,
                      font: 'Calibri',
                    }),
                    new TextRun({
                      text: ' de ',
                      size: 15,
                      color: COLOR_TEXT_MUTED,
                      font: 'Calibri',
                    }),
                    new TextRun({
                      children: [PageNumber.TOTAL_PAGES],
                      size: 15,
                      color: COLOR_PRIMARY_NAVY,
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
    console.error('Error generating Rubrics DOCX:', error)
    throw new Error(
      `Rubrics DOCX generation failed: ${error instanceof Error ? error.message : String(error)}`
    )
  }
}

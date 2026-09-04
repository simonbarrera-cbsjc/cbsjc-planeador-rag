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
  throw new Error('lib/export/docx.ts must only be used on the server.')
}

export interface GenerateDocxParams {
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
const COLOR_SHADING_CONTAINER = 'F1F5F9' // Cibercolegios Box Fill

const standardBorder = {
  top: { style: BorderStyle.SINGLE, size: 4, color: COLOR_BORDER_GRAY },
  bottom: { style: BorderStyle.SINGLE, size: 4, color: COLOR_BORDER_GRAY },
  left: { style: BorderStyle.SINGLE, size: 4, color: COLOR_BORDER_GRAY },
  right: { style: BorderStyle.SINGLE, size: 4, color: COLOR_BORDER_GRAY },
}

/**
 * Parses markdown inline formatting (bold, italic, code, line breaks) into TextRun objects.
 */
function parseInlineRuns(
  rawText: string,
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
    size = 18, // 9pt
    font = 'Calibri',
  } = defaults

  if (!rawText) return [new TextRun({ text: '', size, font })]

  let text = String(rawText)

  // 1. Normalize HTML tags to markdown or clean plain text
  text = text.replace(/<strong[^>]*>(.*?)<\/strong>/gi, '**$1**')
  text = text.replace(/<b[^>]*>(.*?)<\/b>/gi, '**$1**')
  text = text.replace(/<em[^>]*>(.*?)<\/em>/gi, '*$1*')
  text = text.replace(/<i[^>]*>(.*?)<\/i>/gi, '*$1*')
  text = text.replace(/<span[^>]*>(.*?)<\/span>/gi, '$1')
  text = text.replace(/<br\s*\/?>/gi, '\n')
  text = text.replace(/<p[^>]*>(.*?)<\/p>/gi, '$1\n')
  text = text.replace(/<div[^>]*>(.*?)<\/div>/gi, '$1\n')
  // Strip any remaining unknown HTML tags
  text = text.replace(/<[^>]+>/g, '')
  // Strip leading hashes (e.g. ### Header)
  text = text.replace(/^#{1,6}\s*/, '')

  const runs: TextRun[] = []
  // Split on bold (**text**) or italic (*text*) or code (`code`)
  const regex = /(\*\*.*?\*\*|\*.*?\*|`.*?`)/g
  const parts = text.split(regex)

  for (const part of parts) {
    if (!part) continue

    if (part.startsWith('**') && part.endsWith('**') && part.length >= 4) {
      const clean = part.slice(2, -2).replace(/\*/g, '')
      runs.push(
        new TextRun({
          text: clean,
          bold: true,
          italics,
          color: color === COLOR_TEXT_WHITE ? COLOR_TEXT_WHITE : COLOR_DARK_NAVY,
          size,
          font,
        })
      )
    } else if (part.startsWith('*') && part.endsWith('*') && part.length >= 2) {
      const clean = part.slice(1, -1).replace(/\*/g, '')
      runs.push(
        new TextRun({
          text: clean,
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
      const clean = part.replace(/\*\*/g, '')
      runs.push(
        new TextRun({
          text: clean,
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
          text: text.replace(/[*#]/g, ''),
          bold,
          italics,
          color,
          size,
          font,
        }),
      ]
}

/**
 * Creates a styled TableCell supporting rich multiline text, bold markers, and borders.
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
    shading: fill ? { fill, type: ShadingType.CLEAR, color: 'auto' } : undefined,
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
 * Builds the official 3-column CBSJC header table.
 */
function buildHeaderTable(logoBuffer: Buffer | null): Table {
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

          // Column 2: Institution & Planning Book Title
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
                    size: 19, // 9.5pt
                    color: COLOR_PRIMARY_NAVY,
                    font: 'Calibri',
                  }),
                  new TextRun({
                    text: 'PLANNING BOOK PRIMARY & SECONDARY\n',
                    bold: true,
                    size: 17, // 8.5pt
                    color: COLOR_CBSJC_RED,
                    font: 'Calibri',
                  }),
                  new TextRun({
                    text: 'Secuencia didáctica · Sistema Institucional de Arquitectura Pedagógica (SIAP)',
                    size: 14, // 7pt
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
                    text: 'CÓDIGO: SJB-RGA006\n',
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
 * Builds the official 3-column Institutional Signatures table.
 */
function buildSignaturesTable(authorName: string, grado: string): Table {
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
              'Líder de Área / Coordinación de Subciclo',
              'Comité Curricular y Pedagógico',
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
 * Formats table rows according to CBSJC section fidelity rules.
 */
function formatTableByContext(rawRows: string[][], sectionContext: string): Table {
  if (rawRows.length === 0) {
    return new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: [] })
  }

  const numCols = Math.max(...rawRows.map((r) => r.length))

  // 1. Signatures Table (ELABORÓ | REVISÓ | APROBÓ)
  if (
    numCols === 3 &&
    rawRows[0].some((c) => /ELABOR[OÓ]/i.test(c)) &&
    rawRows[0].some((c) => /REVIS[OÓ]/i.test(c))
  ) {
    const rows = rawRows.map((row, rIdx) => {
      const isHeader = rIdx === 0
      return new TableRow({
        children: row.map((cellText, cIdx) =>
          createStyledCell(cellText, {
            bold: isHeader,
            fill: isHeader ? COLOR_SHADING_LIGHT : undefined,
            color: isHeader ? COLOR_DARK_NAVY : COLOR_TEXT_DARK,
            align: AlignmentType.CENTER,
            width: cIdx === 1 ? 34 : 33,
            size: isHeader ? 18 : 16,
          })
        ),
      })
    })
    return new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows })
  }

  // 2. 2-Column Key-Value Metadata / Referentes / Bitácora Table
  if (numCols === 2) {
    const isFirstRowHeader =
      /referente|identificaci[oó]n|aspecto|campo/i.test(rawRows[0][0]) &&
      /contenido|detalle|registro|articulaci[oó]n/i.test(rawRows[0][1])

    const rows = rawRows.map((row, rIdx) => {
      const isHeaderRow = rIdx === 0 && isFirstRowHeader
      const col1Text = row[0] || ''
      const col2Text = row[1] || ''

      if (isHeaderRow) {
        return new TableRow({
          children: [
            createStyledCell(col1Text, {
              bold: true,
              fill: COLOR_PRIMARY_NAVY,
              color: COLOR_TEXT_WHITE,
              width: 28,
              size: 18,
            }),
            createStyledCell(col2Text, {
              bold: true,
              fill: COLOR_PRIMARY_NAVY,
              color: COLOR_TEXT_WHITE,
              width: 72,
              size: 18,
            }),
          ],
        })
      }

      return new TableRow({
        children: [
          createStyledCell(col1Text, {
            bold: true,
            fill: COLOR_SHADING_LIGHT,
            color: COLOR_DARK_NAVY,
            width: 28,
            size: 17,
          }),
          createStyledCell(col2Text, {
            width: 72,
            size: 17,
            color: COLOR_TEXT_DARK,
          }),
        ],
      })
    })

    return new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows })
  }

  // 3. 3-Column Moments Table (ANTES | DURANTE | DESPUÉS)
  if (
    numCols === 3 &&
    (/arco|pedag[oó]gico|momento/i.test(sectionContext) ||
      rawRows.some((r) => /ANTES|DURANTE|DESPU[EÉ]S/i.test(r[0])))
  ) {
    const rows = rawRows.map((row, rIdx) => {
      const isHeader = rIdx === 0 && /momento|fase/i.test(row[0])
      const momentLabel = row[0] || ''
      const subTitle = row[1] || ''
      const content = row[2] || ''

      if (isHeader) {
        return new TableRow({
          children: [
            createStyledCell(momentLabel, {
              bold: true,
              fill: COLOR_PRIMARY_NAVY,
              color: COLOR_TEXT_WHITE,
              width: 16,
              size: 18,
            }),
            createStyledCell(subTitle, {
              bold: true,
              fill: COLOR_PRIMARY_NAVY,
              color: COLOR_TEXT_WHITE,
              width: 26,
              size: 18,
            }),
            createStyledCell(content, {
              bold: true,
              fill: COLOR_PRIMARY_NAVY,
              color: COLOR_TEXT_WHITE,
              width: 58,
              size: 18,
            }),
          ],
        })
      }

      return new TableRow({
        children: [
          createStyledCell(momentLabel, {
            bold: true,
            fill: COLOR_PRIMARY_NAVY,
            color: COLOR_TEXT_WHITE,
            align: AlignmentType.CENTER,
            width: 16,
            size: 18,
          }),
          createStyledCell(subTitle, {
            bold: true,
            fill: COLOR_SHADING_LIGHT,
            color: COLOR_DARK_NAVY,
            width: 26,
            size: 17,
          }),
          createStyledCell(content, {
            width: 58,
            size: 17,
            color: COLOR_TEXT_DARK,
          }),
        ],
      })
    })

    return new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows })
  }

  // 4. 3-Column Pilares Table (Pilar | Competencia | Manifestación)
  if (
    numCols === 3 &&
    (/pilar/i.test(sectionContext) || rawRows.some((r) => /SABER/i.test(r[0])))
  ) {
    const rows = rawRows.map((row, rIdx) => {
      const isHeader = rIdx === 0
      if (isHeader) {
        return new TableRow({
          children: [
            createStyledCell(row[0] || 'Pilar Institucional', {
              bold: true,
              fill: COLOR_PRIMARY_NAVY,
              color: COLOR_TEXT_WHITE,
              width: 20,
              size: 18,
            }),
            createStyledCell(row[1] || 'Competencia Institucional', {
              bold: true,
              fill: COLOR_PRIMARY_NAVY,
              color: COLOR_TEXT_WHITE,
              width: 35,
              size: 18,
            }),
            createStyledCell(row[2] || 'Manifestación en la Evidencia', {
              bold: true,
              fill: COLOR_PRIMARY_NAVY,
              color: COLOR_TEXT_WHITE,
              width: 45,
              size: 18,
            }),
          ],
        })
      }

      return new TableRow({
        children: [
          createStyledCell(row[0] || '', {
            bold: true,
            fill: COLOR_SHADING_LIGHT,
            color: COLOR_DARK_NAVY,
            width: 20,
            size: 17,
          }),
          createStyledCell(row[1] || '', {
            width: 35,
            size: 17,
            color: COLOR_TEXT_DARK,
          }),
          createStyledCell(row[2] || '', {
            width: 45,
            size: 17,
            color: COLOR_TEXT_DARK,
          }),
        ],
      })
    })

    return new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows })
  }

  // 5. 5-Column Table: Rubrics (Menú de Desafíos) or Evaluation Plan
  if (numCols === 5) {
    const isRubric = rawRows[0].some((c) => /bronze|silver|gold|sin categor/i.test(c))
    const colWidths = isRubric ? [18, 20, 21, 21, 20] : [25, 15, 18, 14, 28]

    const rows = rawRows.map((row, rIdx) => {
      const isHeader = rIdx === 0
      return new TableRow({
        children: row.map((colText, cIdx) => {
          const width = colWidths[cIdx] || Math.floor(100 / numCols)

          if (isHeader) {
            return createStyledCell(colText, {
              bold: true,
              fill: COLOR_PRIMARY_NAVY,
              color: COLOR_TEXT_WHITE,
              width,
              size: 17,
              align: cIdx > 0 && isRubric ? AlignmentType.CENTER : AlignmentType.LEFT,
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

  // 6. Generic Table Default (N columns)
  const colWidth = Math.floor(100 / numCols)
  const rows = rawRows.map((row, rIdx) => {
    const isHeader = rIdx === 0
    return new TableRow({
      children: row.map((colText, cIdx) =>
        createStyledCell(colText, {
          bold: isHeader,
          fill: isHeader
            ? COLOR_PRIMARY_NAVY
            : cIdx === 0
            ? COLOR_SHADING_LIGHT
            : rIdx % 2 === 1
            ? COLOR_TEXT_WHITE
            : COLOR_SHADING_ZEBRA,
          color: isHeader ? COLOR_TEXT_WHITE : cIdx === 0 ? COLOR_DARK_NAVY : COLOR_TEXT_DARK,
          width: colWidth,
          size: isHeader ? 18 : 17,
        })
      ),
    })
  })

  return new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows })
}

/**
 * Main export function to generate high-fidelity DOCX planning books.
 */
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

    const headerTable = buildHeaderTable(logoBuffer)
    const bodyElements: (Paragraph | Table)[] = []

    // 1. Document Title Banner
    bodyElements.push(
      new Paragraph({
        children: [
          new TextRun({
            text: 'Secuencia Didáctica: Antes — Durante — Después · Subciclos 3 a 6',
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

    // Check if the markdown starts with an identification table or if we should inject one
    const lines = content.split('\n')
    const hasMarkdownIdentTable =
      lines.slice(0, 15).some((l) => /Docente\(s\)|Área \/ Asignatura|Grado \/ Grupo/i.test(l))

    if (!hasMarkdownIdentTable && metadata) {
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
                createStyledCell('Grado / Grupo', {
                  bold: true,
                  width: 25,
                  fill: COLOR_SHADING_LIGHT,
                  color: COLOR_DARK_NAVY,
                }),
                createStyledCell(metadata.grado || 'Grado 6°', { width: 75 }),
              ],
            }),
            new TableRow({
              children: [
                createStyledCell('Período / Subciclo', {
                  bold: true,
                  width: 25,
                  fill: COLOR_SHADING_LIGHT,
                  color: COLOR_DARK_NAVY,
                }),
                createStyledCell(
                  `Periodo ${metadata.periodo || 'I'} (Año Lectivo 2026) / Subciclos 3 a 6`,
                  { width: 75 }
                ),
              ],
            }),
            new TableRow({
              children: [
                createStyledCell('Fecha(s) / Semanas', {
                  bold: true,
                  width: 25,
                  fill: COLOR_SHADING_LIGHT,
                  color: COLOR_DARK_NAVY,
                }),
                createStyledCell(
                  `Bloque de 4 Semanas (Sesiones de 90 min) • Generado: ${metadata.date}`,
                  { width: 75 }
                ),
              ],
            }),
          ],
        })
      )
      bodyElements.push(new Paragraph({ text: '', spacing: { before: 100, after: 100 } }))
    }

    // Process markdown sections, paragraphs, bullet lists, code blocks, and tables
    let currentTableRows: string[][] = []
    let inTable = false
    let currentSectionContext = ''
    let inCodeBlock = false
    let codeBlockLines: string[] = []

    const flushTable = () => {
      if (currentTableRows.length > 0) {
        const table = formatTableByContext(currentTableRows, currentSectionContext)
        bodyElements.push(table)
        bodyElements.push(new Paragraph({ text: '', spacing: { after: 120 } }))
        currentTableRows = []
        inTable = false
      }
    }

    const flushCodeBlock = () => {
      if (codeBlockLines.length > 0) {
        const textContent = codeBlockLines.join('\n')
        bodyElements.push(
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: [
              new TableRow({
                children: [
                  createStyledCell(textContent, {
                    fill: COLOR_SHADING_CONTAINER,
                    color: COLOR_DARK_NAVY,
                    size: 16,
                  }),
                ],
              }),
            ],
          })
        )
        bodyElements.push(new Paragraph({ text: '', spacing: { after: 100 } }))
        codeBlockLines = []
        inCodeBlock = false
      }
    }

    for (let i = 0; i < lines.length; i++) {
      const rawLine = lines[i]
      const line = rawLine.trim()

      // Handle code block fences ```text or ```
      if (line.startsWith('```')) {
        if (inCodeBlock) {
          flushCodeBlock()
        } else {
          if (inTable) flushTable()
          inCodeBlock = true
          codeBlockLines = []
        }
        continue
      }

      if (inCodeBlock) {
        codeBlockLines.push(rawLine)
        continue
      }

      // Markdown Table Line Detection
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

      // Skip empty lines
      if (!line) {
        continue
      }

      // Skip redundant markdown title if it duplicates the banner
      if (
        (line.startsWith('# ') || line.startsWith('**Secuencia')) &&
        /Secuencia Did[aá]ctica/i.test(line) &&
        i < 5
      ) {
        continue
      }

      // Headings
      if (line.startsWith('# ')) {
        const hText = line.substring(2).replace(/\*\*/g, '').trim()
        currentSectionContext = hText
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
        currentSectionContext = hText
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

    if (inCodeBlock) {
      flushCodeBlock()
    }
    if (inTable) {
      flushTable()
    }

    // Append institutional signatures table if not already present
    const hasSignatures = lines.some((l) => /ELABOR[OÓ].*REVIS[OÓ].*APROB[OÓ]/i.test(l))
    if (!hasSignatures) {
      bodyElements.push(new Paragraph({ text: '', spacing: { before: 200, after: 80 } }))
      bodyElements.push(
        buildSignaturesTable(
          metadata.authorName || 'Docente Titular CBSJC',
          metadata.grado || 'Grado 6°'
        )
      )
    }

    // Build the Official Document
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
                      text: 'Colegio Bilingüe San José Campestre • Formato Oficial SJB-RGA006 • Página ',
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
    console.error('Error generating DOCX:', error)
    throw new Error(
      `DOCX generation failed: ${error instanceof Error ? error.message : String(error)}`
    )
  }
}

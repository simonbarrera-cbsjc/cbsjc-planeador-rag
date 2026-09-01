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
} from 'docx'

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

export async function generateDocx(params: GenerateDocxParams): Promise<Buffer> {
  const { title, content, metadata } = params

  if (!content || content.trim().length === 0) {
    throw new Error('generateDocx: document content must not be empty.')
  }

  try {
    const lines = content.split('\n')
    const contentChildren: Paragraph[] = []

    // Document Title
    contentChildren.push(
      new Paragraph({
        text: title,
        heading: HeadingLevel.TITLE,
        alignment: AlignmentType.CENTER,
        spacing: { before: 240, after: 240 },
      })
    )

    // Parse markdown lines into Word paragraphs
    for (const rawLine of lines) {
      const line = rawLine.trim()
      if (!line) continue

      if (line.startsWith('# ')) {
        contentChildren.push(
          new Paragraph({
            text: line.substring(2).replace(/\*\*/g, ''),
            heading: HeadingLevel.HEADING_1,
            spacing: { before: 300, after: 120 },
          })
        )
      } else if (line.startsWith('## ')) {
        contentChildren.push(
          new Paragraph({
            text: line.substring(3).replace(/\*\*/g, ''),
            heading: HeadingLevel.HEADING_2,
            spacing: { before: 240, after: 100 },
          })
        )
      } else if (line.startsWith('### ')) {
        contentChildren.push(
          new Paragraph({
            text: line.substring(4).replace(/\*\*/g, ''),
            heading: HeadingLevel.HEADING_3,
            spacing: { before: 180, after: 80 },
          })
        )
      } else if (line.startsWith('- ') || line.startsWith('* ') || /^\d+\.\s/.test(line)) {
        const cleanText = line.replace(/^[-*]\s+|\d+\.\s+/, '').replace(/\*\*/g, '')
        contentChildren.push(
          new Paragraph({
            bullet: { level: 0 },
            children: [
              new TextRun({
                text: cleanText,
                size: 22, // 11pt
                font: 'Calibri',
              }),
            ],
            spacing: { after: 60 },
          })
        )
      } else {
        // Regular paragraph with potential bold markdown
        const parts = line.split(/(\*\*.*?\*\*)/g)
        const runs: TextRun[] = []

        for (const part of parts) {
          if (part.startsWith('**') && part.endsWith('**')) {
            runs.push(
              new TextRun({
                text: part.slice(2, -2),
                bold: true,
                size: 22,
                font: 'Calibri',
              })
            )
          } else if (part.length > 0) {
            runs.push(
              new TextRun({
                text: part,
                size: 22,
                font: 'Calibri',
              })
            )
          }
        }

        contentChildren.push(
          new Paragraph({
            children: runs,
            spacing: { after: 120 },
            alignment: AlignmentType.JUSTIFIED,
          })
        )
      }
    }

    // Create Document with CBSJC official branding
    const doc = new Document({
      styles: {
        default: {
          document: {
            run: {
              font: 'Calibri',
              color: '1A1A2E',
            },
          },
        },
      },
      sections: [
        {
          properties: {
            page: {
              margin: {
                top: 1440, // 1 inch
                bottom: 1440,
                left: 1440,
                right: 1440,
              },
            },
          },
          headers: {
            default: new Header({
              children: [
                new Paragraph({
                  children: [
                    new TextRun({
                      text: 'COLEGIO BILINGÜE SAN JOSÉ CAMPESTRE',
                      bold: true,
                      color: '0E1B4D',
                      size: 20,
                    }),
                    new TextRun({
                      text: ' • Sistema de Planeación Curricular',
                      color: 'D71921',
                      size: 18,
                    }),
                  ],
                  alignment: AlignmentType.RIGHT,
                  spacing: { after: 200 },
                }),
              ],
            }),
          },
          footers: {
            default: new Footer({
              children: [
                new Paragraph({
                  children: [
                    new TextRun({
                      text: `Colegio Bilingüe San José Campestre | Generado el ${metadata.date} | Página `,
                      size: 16,
                      color: '64748B',
                    }),
                    new TextRun({
                      children: [PageNumber.CURRENT],
                      size: 16,
                      color: '64748B',
                    }),
                  ],
                  alignment: AlignmentType.CENTER,
                }),
              ],
            }),
          },
          children: [
            // Institutional metadata table
            new Table({
              width: { size: 100, type: WidthType.PERCENTAGE },
              rows: [
                new TableRow({
                  children: [
                    new TableCell({
                      children: [
                        new Paragraph({
                          children: [
                            new TextRun({ text: 'Institución: ', bold: true, color: '0E1B4D' }),
                            new TextRun({ text: 'Colegio Bilingüe San José Campestre' }),
                          ],
                        }),
                      ],
                      borders: {
                        top: { style: BorderStyle.SINGLE, size: 1, color: 'E2E8F0' },
                        bottom: { style: BorderStyle.SINGLE, size: 1, color: 'E2E8F0' },
                        left: { style: BorderStyle.SINGLE, size: 1, color: 'E2E8F0' },
                        right: { style: BorderStyle.SINGLE, size: 1, color: 'E2E8F0' },
                      },
                      shading: { fill: 'F4F6F9' },
                    }),
                    new TableCell({
                      children: [
                        new Paragraph({
                          children: [
                            new TextRun({ text: 'Fecha: ', bold: true, color: '0E1B4D' }),
                            new TextRun({ text: metadata.date }),
                          ],
                        }),
                      ],
                      borders: {
                        top: { style: BorderStyle.SINGLE, size: 1, color: 'E2E8F0' },
                        bottom: { style: BorderStyle.SINGLE, size: 1, color: 'E2E8F0' },
                        left: { style: BorderStyle.SINGLE, size: 1, color: 'E2E8F0' },
                        right: { style: BorderStyle.SINGLE, size: 1, color: 'E2E8F0' },
                      },
                      shading: { fill: 'F4F6F9' },
                    }),
                  ],
                }),
                new TableRow({
                  children: [
                    new TableCell({
                      children: [
                        new Paragraph({
                          children: [
                            new TextRun({ text: 'Área / Nivel: ', bold: true, color: '0E1B4D' }),
                            new TextRun({ text: `${metadata.area || 'General'} (${metadata.nivel || 'Institucional'})` }),
                          ],
                        }),
                      ],
                      borders: {
                        top: { style: BorderStyle.SINGLE, size: 1, color: 'E2E8F0' },
                        bottom: { style: BorderStyle.SINGLE, size: 1, color: 'E2E8F0' },
                        left: { style: BorderStyle.SINGLE, size: 1, color: 'E2E8F0' },
                        right: { style: BorderStyle.SINGLE, size: 1, color: 'E2E8F0' },
                      },
                      shading: { fill: 'F4F6F9' },
                    }),
                    new TableCell({
                      children: [
                        new Paragraph({
                          children: [
                            new TextRun({ text: 'Grado / Periodo: ', bold: true, color: '0E1B4D' }),
                            new TextRun({ text: `${metadata.grado || 'N/A'} - Periodo ${metadata.periodo || 'N/A'}` }),
                          ],
                        }),
                      ],
                      borders: {
                        top: { style: BorderStyle.SINGLE, size: 1, color: 'E2E8F0' },
                        bottom: { style: BorderStyle.SINGLE, size: 1, color: 'E2E8F0' },
                        left: { style: BorderStyle.SINGLE, size: 1, color: 'E2E8F0' },
                        right: { style: BorderStyle.SINGLE, size: 1, color: 'E2E8F0' },
                      },
                      shading: { fill: 'F4F6F9' },
                    }),
                  ],
                }),
              ],
            }),
            new Paragraph({ text: '', spacing: { after: 200 } }),
            ...contentChildren,
          ],
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

import {
  Document,
  Paragraph,
  TextRun,
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
import mammoth from 'mammoth'

async function run() {
  const logo = fs.readFileSync('public/cbsjc-crest.png')
  const border = {
    top: { style: BorderStyle.SINGLE, size: 4, color: 'CBD5E1' },
    bottom: { style: BorderStyle.SINGLE, size: 4, color: 'CBD5E1' },
    left: { style: BorderStyle.SINGLE, size: 4, color: 'CBD5E1' },
    right: { style: BorderStyle.SINGLE, size: 4, color: 'CBD5E1' },
  }

  const doc = new Document({
    sections: [
      {
        properties: {
          page: {
            margin: {
              top: 1400,
              bottom: 1000,
              left: 1000,
              right: 1000,
            },
          },
        },
        headers: {
          default: new Header({
            children: [
              new Table({
                width: { size: 100, type: WidthType.PERCENTAGE },
                rows: [
                  new TableRow({
                    children: [
                      new TableCell({
                        width: { size: 18, type: WidthType.PERCENTAGE },
                        borders: border,
                        children: [
                          new Paragraph({
                            children: [
                              new ImageRun({
                                data: logo,
                                transformation: { width: 50, height: 50 },
                              }),
                            ],
                            alignment: AlignmentType.CENTER,
                          }),
                        ],
                      }),
                      new TableCell({
                        width: { size: 56, type: WidthType.PERCENTAGE },
                        borders: border,
                        children: [
                          new Paragraph({
                            children: [
                              new TextRun({ text: 'COLEGIO BILINGÜE SAN JOSÉ CAMPESTRE\n', bold: true, size: 18, color: '1F3864' }),
                              new TextRun({ text: 'PLANNING BOOK PRIMARY & SECONDARY\n', bold: true, size: 16, color: 'D71921' }),
                              new TextRun({ text: 'Secuencia didáctica · Sistema Institucional de Arquitectura Pedagógica (SIAP)', size: 14, color: '64748B' }),
                            ],
                            alignment: AlignmentType.CENTER,
                          }),
                        ],
                      }),
                      new TableCell({
                        width: { size: 26, type: WidthType.PERCENTAGE },
                        borders: border,
                        children: [
                          new Paragraph({
                            children: [
                              new TextRun({ text: 'CÓDIGO: SJB-RGA006\n', bold: true, size: 14, color: '1F3864' }),
                              new TextRun({ text: 'VERSIÓN: 4\n', size: 14, color: '64748B' }),
                              new TextRun({ text: 'VIGENCIA: 2026\n', size: 14, color: '64748B' }),
                              new TextRun({ text: 'PÁGINA: ', size: 14, color: '64748B' }),
                              new TextRun({ children: [PageNumber.CURRENT], bold: true, size: 14, color: '1F3864' }),
                              new TextRun({ text: ' DE ', size: 14, color: '64748B' }),
                              new TextRun({ children: [PageNumber.TOTAL_PAGES], bold: true, size: 14, color: '1F3864' }),
                            ],
                            alignment: AlignmentType.RIGHT,
                          }),
                        ],
                      }),
                    ],
                  }),
                ],
              }),
            ],
          }),
        },
        children: [
          new Paragraph({
            children: [
              new TextRun({ text: 'Test Document Body for CBSJC', bold: true, size: 24 }),
            ],
          }),
        ],
      },
    ],
  })

  const buf = await Packer.toBuffer(doc)
  fs.writeFileSync('scripts/test-fidelity-out.docx', buf)
  console.log('Saved scripts/test-fidelity-out.docx, size:', buf.length)

  const textRes = await mammoth.extractRawText({ path: 'scripts/test-fidelity-out.docx' })
  console.log('Mammoth extracted text:\n', textRes.value)
}

run().catch(console.error)

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

async function buildFullDocx() {
  const logoBuffer = fs.readFileSync('public/cbsjc-crest.png')

  // Helper cell builder
  const createCell = (text, opts = {}) => {
    const { bold = false, fill = undefined, width = undefined, color = '000000', size = 20, align = AlignmentType.LEFT, colSpan = undefined } = opts
    return new TableCell({
      width: width ? { size: width, type: WidthType.PERCENTAGE } : undefined,
      columnSpan: colSpan,
      shading: fill ? { fill, val: ShadingType.CLEAR, color: 'auto' } : undefined,
      children: Array.isArray(text)
        ? text.map(t => new Paragraph({ children: [new TextRun({ text: t, bold, color, size, font: 'Calibri' })], alignment: align }))
        : [new Paragraph({ children: [new TextRun({ text: String(text), bold, color, size, font: 'Calibri' })], alignment: align })],
      borders: {
        top: { style: BorderStyle.SINGLE, size: 1, color: '94A3B8' },
        bottom: { style: BorderStyle.SINGLE, size: 1, color: '94A3B8' },
        left: { style: BorderStyle.SINGLE, size: 1, color: '94A3B8' },
        right: { style: BorderStyle.SINGLE, size: 1, color: '94A3B8' },
      },
    })
  }

  // Official 3-column Header Table
  const headerTable = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({
        children: [
          new TableCell({
            width: { size: 20, type: WidthType.PERCENTAGE },
            children: [
              new Paragraph({
                children: [
                  new ImageRun({
                    data: logoBuffer,
                    transformation: { width: 55, height: 55 },
                  }),
                ],
                alignment: AlignmentType.CENTER,
              }),
            ],
            borders: {
              top: { style: BorderStyle.SINGLE, size: 1, color: 'CBD5E1' },
              bottom: { style: BorderStyle.SINGLE, size: 1, color: 'CBD5E1' },
              left: { style: BorderStyle.SINGLE, size: 1, color: 'CBD5E1' },
              right: { style: BorderStyle.SINGLE, size: 1, color: 'CBD5E1' },
            },
          }),
          new TableCell({
            width: { size: 55, type: WidthType.PERCENTAGE },
            children: [
              new Paragraph({
                children: [
                  new TextRun({ text: 'COLEGIO BILINGÜE SAN JOSÉ CAMPESTRE\n', bold: true, size: 18, color: '0E1B4D', font: 'Calibri' }),
                  new TextRun({ text: 'PLANNING BOOK PRIMARY & SECONDARY\n', bold: true, size: 16, color: 'D71921', font: 'Calibri' }),
                  new TextRun({ text: 'Secuencia Didáctica: Antes — Durante — Después · Formato RGA006', size: 14, color: '64748B', font: 'Calibri' }),
                ],
                alignment: AlignmentType.CENTER,
              }),
            ],
            borders: {
              top: { style: BorderStyle.SINGLE, size: 1, color: 'CBD5E1' },
              bottom: { style: BorderStyle.SINGLE, size: 1, color: 'CBD5E1' },
              left: { style: BorderStyle.SINGLE, size: 1, color: 'CBD5E1' },
              right: { style: BorderStyle.SINGLE, size: 1, color: 'CBD5E1' },
            },
          }),
          new TableCell({
            width: { size: 25, type: WidthType.PERCENTAGE },
            children: [
              new Paragraph({
                children: [
                  new TextRun({ text: 'CÓDIGO: SJB-RGA006\n', bold: true, size: 14, color: '0E1B4D', font: 'Calibri' }),
                  new TextRun({ text: 'VERSIÓN: 4\n', size: 14, color: '64748B', font: 'Calibri' }),
                  new TextRun({ text: 'VIGENCIA: 2026\n', size: 14, color: '64748B', font: 'Calibri' }),
                  new TextRun({ text: 'PÁGINA: ', size: 14, color: '64748B', font: 'Calibri' }),
                  new TextRun({ children: [PageNumber.CURRENT], size: 14, color: '0E1B4D', bold: true, font: 'Calibri' }),
                ],
                alignment: AlignmentType.RIGHT,
              }),
            ],
            borders: {
              top: { style: BorderStyle.SINGLE, size: 1, color: 'CBD5E1' },
              bottom: { style: BorderStyle.SINGLE, size: 1, color: 'CBD5E1' },
              left: { style: BorderStyle.SINGLE, size: 1, color: 'CBD5E1' },
              right: { style: BorderStyle.SINGLE, size: 1, color: 'CBD5E1' },
            },
          }),
        ],
      }),
    ],
  })

  console.log('Header table configured!')
}

buildFullDocx().catch(console.error)

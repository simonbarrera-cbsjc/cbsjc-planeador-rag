/**
 * @file scripts/test-export-pipeline.mjs
 * @description Test script for the CBSJC Export Pipeline.
 * Tests:
 * 1. Planning Book Word (.docx)
 * 2. Planning Book PDF (.pdf) with Roboto TrueType fonts (zero Helvetica.afm dependency)
 * 3. Rúbricas Menú de Desafíos Word (.docx)
 * 4. Planilla de Notas Excel (.xlsx)
 * 5. Deliverables ZIP Bundle (.zip) containing all 4 deliverables
 */

import fs from 'fs'
import path from 'path'
import React from 'react'
import JSZip from 'jszip'
import ExcelJS from 'exceljs'
import {
  Document as DocxDocument,
  Paragraph,
  TextRun,
  HeadingLevel,
  Packer,
  Table as DocxTable,
  TableRow as DocxTableRow,
  TableCell as DocxTableCell,
  WidthType,
  BorderStyle,
  AlignmentType,
  Header,
  Footer,
  PageNumber,
  ShadingType,
} from 'docx'
import {
  Document as PdfDocument,
  Page as PdfPage,
  Text as PdfText,
  View as PdfView,
  StyleSheet as PdfStyleSheet,
  Font as PdfFont,
  renderToBuffer as renderPdfToBuffer,
} from '@react-pdf/renderer'

// Configure Roboto TrueType fonts for @react-pdf/renderer
PdfFont.registerHyphenationCallback((word) => [word])
PdfFont.register({
  family: 'Roboto',
  fonts: [
    {
      src: 'https://cdnjs.cloudflare.com/ajax/libs/ink/3.1.10/fonts/Roboto/roboto-light-webfont.ttf',
      fontWeight: 300,
    },
    {
      src: 'https://cdnjs.cloudflare.com/ajax/libs/ink/3.1.10/fonts/Roboto/roboto-regular-webfont.ttf',
      fontWeight: 400,
    },
    {
      src: 'https://cdnjs.cloudflare.com/ajax/libs/ink/3.1.10/fonts/Roboto/roboto-medium-webfont.ttf',
      fontWeight: 500,
    },
    {
      src: 'https://cdnjs.cloudflare.com/ajax/libs/ink/3.1.10/fonts/Roboto/roboto-bold-webfont.ttf',
      fontWeight: 700,
    },
    {
      src: 'https://cdnjs.cloudflare.com/ajax/libs/ink/3.1.10/fonts/Roboto/roboto-italic-webfont.ttf',
      fontWeight: 400,
      fontStyle: 'italic',
    },
    {
      src: 'https://cdnjs.cloudflare.com/ajax/libs/ink/3.1.10/fonts/Roboto/roboto-bolditalic-webfont.ttf',
      fontWeight: 700,
      fontStyle: 'italic',
    },
  ],
})

const pdfStyles = PdfStyleSheet.create({
  page: {
    paddingTop: 35,
    paddingBottom: 45,
    paddingHorizontal: 40,
    fontSize: 9,
    fontFamily: 'Roboto',
    color: '#1E293B',
    backgroundColor: '#FFFFFF',
    lineHeight: 1.4,
  },
  headerBox: {
    borderWidth: 1,
    borderColor: '#94A3B8',
    marginBottom: 12,
    flexDirection: 'row',
  },
  headerColLeft: {
    width: '20%',
    padding: 8,
    borderRightWidth: 1,
    borderRightColor: '#94A3B8',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0E1B4D',
  },
  headerLogoText: {
    fontFamily: 'Roboto',
    color: '#FFFFFF',
    fontWeight: 700,
    fontSize: 14,
    textAlign: 'center',
  },
  headerColCenter: {
    width: '55%',
    padding: 6,
    borderRightWidth: 1,
    borderRightColor: '#94A3B8',
    justifyContent: 'center',
    alignItems: 'center',
  },
  schoolName: {
    fontFamily: 'Roboto',
    fontSize: 10,
    fontWeight: 700,
    color: '#0E1B4D',
    textAlign: 'center',
  },
  planningTitle: {
    fontFamily: 'Roboto',
    fontSize: 9,
    fontWeight: 700,
    color: '#D71921',
    marginTop: 2,
    textAlign: 'center',
  },
  formatText: {
    fontFamily: 'Roboto',
    fontSize: 7.5,
    color: '#64748B',
    marginTop: 1,
    textAlign: 'center',
  },
  headerColRight: {
    width: '25%',
    padding: 6,
    justifyContent: 'center',
    alignItems: 'flex-end',
    backgroundColor: '#F8FAFC',
  },
  codeText: {
    fontFamily: 'Roboto',
    fontSize: 7.5,
    color: '#0E1B4D',
    fontWeight: 700,
  },
  subCodeText: {
    fontFamily: 'Roboto',
    fontSize: 7,
    color: '#64748B',
    marginTop: 1,
  },
  metaTable: {
    borderWidth: 1,
    borderColor: '#94A3B8',
    marginBottom: 12,
    backgroundColor: '#FFFFFF',
  },
  metaRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#CBD5E1',
  },
  metaKey: {
    fontFamily: 'Roboto',
    width: '28%',
    backgroundColor: '#F1F5F9',
    padding: 4,
    borderRightWidth: 1,
    borderRightColor: '#CBD5E1',
    fontWeight: 700,
    fontSize: 8,
    color: '#0E1B4D',
  },
  metaVal: {
    fontFamily: 'Roboto',
    width: '72%',
    padding: 4,
    fontSize: 8,
    color: '#1E293B',
  },
  h1: {
    fontFamily: 'Roboto',
    fontSize: 12,
    fontWeight: 700,
    color: '#0E1B4D',
    marginTop: 10,
    marginBottom: 4,
    borderBottomWidth: 1,
    borderBottomColor: '#CBD5E1',
    paddingBottom: 2,
  },
  h2: {
    fontFamily: 'Roboto',
    fontSize: 10.5,
    fontWeight: 700,
    color: '#0E1B4D',
    marginTop: 8,
    marginBottom: 3,
  },
  h3: {
    fontFamily: 'Roboto',
    fontSize: 9,
    fontWeight: 700,
    color: '#D71921',
    marginTop: 6,
    marginBottom: 2,
  },
  paragraph: {
    fontFamily: 'Roboto',
    fontSize: 8.5,
    marginBottom: 4,
    textAlign: 'justify',
    lineHeight: 1.35,
  },
  bulletItem: {
    flexDirection: 'row',
    marginBottom: 2,
    paddingLeft: 6,
  },
  bulletDot: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: '#D71921',
    marginRight: 4,
    marginTop: 4,
  },
  bulletText: {
    fontFamily: 'Roboto',
    fontSize: 8.5,
    flex: 1,
  },
  table: {
    borderWidth: 1,
    borderColor: '#94A3B8',
    marginVertical: 6,
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#CBD5E1',
  },
  tableHeaderRow: {
    backgroundColor: '#0E1B4D',
  },
  tableHeaderCell: {
    fontFamily: 'Roboto',
    padding: 4,
    fontSize: 7.5,
    fontWeight: 700,
    color: '#FFFFFF',
    borderRightWidth: 1,
    borderRightColor: '#94A3B8',
  },
  tableCell: {
    fontFamily: 'Roboto',
    padding: 4,
    fontSize: 7.5,
    color: '#1E293B',
    borderRightWidth: 1,
    borderRightColor: '#CBD5E1',
  },
  signaturesBox: {
    marginTop: 16,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#94A3B8',
  },
  sigHeaderRow: {
    flexDirection: 'row',
    backgroundColor: '#F1F5F9',
    borderBottomWidth: 1,
    borderBottomColor: '#CBD5E1',
  },
  sigHeaderCell: {
    fontFamily: 'Roboto',
    flex: 1,
    padding: 4,
    fontSize: 7.5,
    fontWeight: 700,
    color: '#0E1B4D',
    textAlign: 'center',
    borderRightWidth: 1,
    borderRightColor: '#CBD5E1',
  },
  sigBodyRow: {
    flexDirection: 'row',
    minHeight: 40,
  },
  sigBodyCell: {
    fontFamily: 'Roboto',
    flex: 1,
    padding: 4,
    fontSize: 6.5,
    color: '#334155',
    textAlign: 'center',
    borderRightWidth: 1,
    borderRightColor: '#CBD5E1',
    justifyContent: 'flex-end',
  },
  footer: {
    position: 'absolute',
    bottom: 20,
    left: 40,
    right: 40,
    borderTopWidth: 1,
    borderTopColor: '#CBD5E1',
    paddingTop: 5,
    flexDirection: 'row',
    justifyContent: 'space-between',
    fontSize: 7,
    fontFamily: 'Roboto',
    color: '#64748B',
  },
})

// Sample Test Data
const sampleMetadata = {
  area: 'Ciencias Naturales y Educación Ambiental',
  nivel: 'Secundaria',
  grado: 'Grado 6°',
  periodo: 'I',
  date: '2026-09-01',
  authorName: 'Lic. Claudia Mendoza',
}

const samplePlanningMarkdown = `# SECUENCIA DIDÁCTICA: ECOSISTEMAS Y BIODIVERSIDAD COLOMBIANA

## 1. MOMENTO ANTES (Activación de Saberes Previos)
- Exploración de conceptos previos mediante lluvia de ideas.
- Pregunta Orientadora: ¿Cómo interactúan los factores bióticos y abióticos en un páramo colombiano?
- Dinámica grupal de clasificación de especies nativas.

## 2. MOMENTO DURANTE (Construcción y Modelación)
- Análisis de cadenas tróficas y flujo de energía en ecosistemas terrestres.
- Trabajo colaborativo: Construcción de terrarios experimentales y matrices de observación.
- Integración bilingüe: Identificación de vocabulario clave en inglés (Ecosystem, Biodiversity, Producers, Consumers, Decomposers).

| Fase | Actividad Pedagógica | Evidencia / Producto | Tiempo |
| --- | --- | --- | --- |
| Fase 1 | Indagación Teórica | Mapa Conceptual Interactivo | 90 min |
| Fase 2 | Laboratorio Experimental | Modelo de Terrario Páramo | 180 min |
| Fase 3 | Socialización y Debate | Presentación Oral Bilingüe | 90 min |

## 3. MOMENTO DESPUÉS (Metacognición y Transferencia)
- Autoevaluación guiada y bitácora de aprendizaje metacognitivo.
- Aplicación práctica: Propuesta de conservación ambiental para la microcuenca local.
- Menú de Desafíos de evaluación formativa.`

const sampleRubricsMarkdown = `# RÚBRICAS EVALUATIVAS: MENÚ DE DESAFÍOS (4 PILARES)

## Matriz de Criterios y Niveles de Desempeño

| Criterio / Pilar | Gold (4.8 - 5.0) | Silver (4.6 - 4.7) | Bronze (4.0 - 4.5) | Sin Categoría (1.0 - 3.9) |
| --- | --- | --- | --- | --- |
| **SABER (35%)** Dominio Conceptual | Explica con rigurosidad científica y vocabulario bilingüe preciso la interacción biótica. | Comprende los conceptos clave y los relaciona adecuadamente. | Identifica conceptos básicos con apoyo de guías. | Confunde conceptos fundamentales del ecosistema. |
| **SABER HACER (35%)** Producto ACE | Construye un terrario funcional con variables controladas y registro sistemático. | Elabora el modelo experimental siguiendo la guía con mínimas correcciones. | Presenta el modelo de manera parcial o incompleta. | No presenta el producto o evidencia solicitada. |
| **SABER SER (20%)** Metacognición | Reflexiona críticamente sobre su proceso y propone mejoras continuas autónomas. | Demuestra compromiso y autorregulación en sus entregas. | Cumple de manera básica con las actividades asignadas. | Poca disposición y falta de compromiso en el trabajo. |
| **SABER CONVIVIR (10%)** Rol & Equipo | Lidera positivamente, media en el equipo y respeta los roles colaborativos. | Colabora activamente y apoya a sus pares en el desarrollo del proyecto. | Participa en el equipo pero requiere mediación docente. | Dificultades para trabajar cooperativamente. |`

const sampleExcelSpec = {
  docente: 'Lic. Claudia Mendoza',
  area: 'Ciencias Naturales y Educación Ambiental',
  grado: 'Grado 6°',
  periodo: 'Período I',
  tema: 'Ecosistemas y Biodiversidad Colombiana',
}

// DOCX Generator implementation
async function generateTestDocx(title, content, metadata) {
  const standardBorder = {
    top: { style: BorderStyle.SINGLE, size: 1, color: '94A3B8' },
    bottom: { style: BorderStyle.SINGLE, size: 1, color: '94A3B8' },
    left: { style: BorderStyle.SINGLE, size: 1, color: '94A3B8' },
    right: { style: BorderStyle.SINGLE, size: 1, color: '94A3B8' },
  }

  const cell = (text, opts = {}) => {
    const { bold = false, fill = undefined, width = undefined, color = '0E1B4D', size = 19, align = AlignmentType.LEFT, colSpan = undefined } = opts
    const lines = Array.isArray(text) ? text : [String(text)]
    return new DocxTableCell({
      width: width ? { size: width, type: WidthType.PERCENTAGE } : undefined,
      columnSpan: colSpan,
      shading: fill ? { fill, val: ShadingType.CLEAR, color: 'auto' } : undefined,
      borders: standardBorder,
      children: lines.map(
        (l) =>
          new Paragraph({
            children: [new TextRun({ text: l, bold, color, size, font: 'Calibri' })],
            alignment: align,
            spacing: { before: 40, after: 40 },
          })
      ),
    })
  }

  const headerTable = new DocxTable({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new DocxTableRow({
        children: [
          new DocxTableCell({
            width: { size: 18, type: WidthType.PERCENTAGE },
            borders: standardBorder,
            children: [
              new Paragraph({
                children: [new TextRun({ text: 'CBSJC', bold: true, size: 20, color: '0E1B4D', font: 'Calibri' })],
                alignment: AlignmentType.CENTER,
              }),
            ],
          }),
          new DocxTableCell({
            width: { size: 57, type: WidthType.PERCENTAGE },
            borders: standardBorder,
            children: [
              new Paragraph({
                children: [
                  new TextRun({ text: 'COLEGIO BILINGÜE SAN JOSÉ CAMPESTRE\n', bold: true, size: 18, color: '0E1B4D', font: 'Calibri' }),
                  new TextRun({ text: 'PLANNING BOOK PRIMARY & SECONDARY\n', bold: true, size: 16, color: 'D71921', font: 'Calibri' }),
                  new TextRun({ text: 'Secuencia Didáctica: Antes — Durante — Después · Formato RGA006', size: 13, color: '64748B', font: 'Calibri' }),
                ],
                alignment: AlignmentType.CENTER,
              }),
            ],
          }),
          new DocxTableCell({
            width: { size: 25, type: WidthType.PERCENTAGE },
            borders: standardBorder,
            children: [
              new Paragraph({
                children: [
                  new TextRun({ text: 'CÓDIGO: SJB-RGA006\n', bold: true, size: 13, color: '0E1B4D', font: 'Calibri' }),
                  new TextRun({ text: 'VERSIÓN: 4\n', size: 13, color: '64748B', font: 'Calibri' }),
                  new TextRun({ text: 'VIGENCIA: 2026\n', size: 13, color: '64748B', font: 'Calibri' }),
                  new TextRun({ text: 'PÁGINA: ', size: 13, color: '64748B', font: 'Calibri' }),
                  new TextRun({ children: [PageNumber.CURRENT], size: 15, color: '0E1B4D', bold: true, font: 'Calibri' }),
                ],
                alignment: AlignmentType.RIGHT,
              }),
            ],
          }),
        ],
      }),
    ],
  })

  const bodyElements = []
  bodyElements.push(
    new Paragraph({
      children: [new TextRun({ text: title, bold: true, size: 24, color: '0E1B4D', font: 'Calibri' })],
      alignment: AlignmentType.CENTER,
      spacing: { before: 180, after: 140 },
    })
  )

  bodyElements.push(
    new DocxTable({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: [
        new DocxTableRow({
          children: [
            cell('Docente(s)', { bold: true, width: 25, fill: 'F1F5F9', color: '0E1B4D' }),
            cell(metadata.authorName || 'Docente Titular CBSJC', { width: 75 }),
          ],
        }),
        new DocxTableRow({
          children: [
            cell('Área / Asignatura', { bold: true, width: 25, fill: 'F1F5F9', color: '0E1B4D' }),
            cell(metadata.area || 'Ciencias Naturales', { width: 75 }),
          ],
        }),
        new DocxTableRow({
          children: [
            cell('Grado / Grupo', { bold: true, width: 25, fill: 'F1F5F9', color: '0E1B4D' }),
            cell(metadata.grado || 'Grado 6°', { width: 75 }),
          ],
        }),
        new DocxTableRow({
          children: [
            cell('Período / Subciclo', { bold: true, width: 25, fill: 'F1F5F9', color: '0E1B4D' }),
            cell(`Periodo ${metadata.periodo || 'I'} (Año Lectivo 2026)`, { width: 75 }),
          ],
        }),
      ],
    })
  )

  const lines = content.split('\n')
  let currentTableRows = []
  let inTable = false

  const flushTable = () => {
    if (currentTableRows.length > 0) {
      const rows = currentTableRows.map((row, rIdx) => {
        const isHeader = rIdx === 0
        return new DocxTableRow({
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
      bodyElements.push(new DocxTable({ width: { size: 100, type: WidthType.PERCENTAGE }, rows }))
      bodyElements.push(new Paragraph({ text: '', spacing: { after: 100 } }))
      currentTableRows = []
      inTable = false
    }
  }

  for (const rawLine of lines) {
    const line = rawLine.trim()
    if (line.startsWith('|') && line.endsWith('|')) {
      if (/^\|[\s\-:|]+\|$/.test(line)) continue
      const cols = line.slice(1, -1).split('|').map((c) => c.trim().replace(/\*\*/g, ''))
      currentTableRows.push(cols)
      inTable = true
      continue
    } else if (inTable) {
      flushTable()
    }

    if (!line) continue

    if (line.startsWith('# ')) {
      bodyElements.push(new Paragraph({ children: [new TextRun({ text: line.substring(2).replace(/\*\*/g, ''), bold: true, size: 26, color: '0E1B4D', font: 'Calibri' })], heading: HeadingLevel.HEADING_1, spacing: { before: 240, after: 120 } }))
    } else if (line.startsWith('## ')) {
      bodyElements.push(new Paragraph({ children: [new TextRun({ text: line.substring(3).replace(/\*\*/g, ''), bold: true, size: 22, color: '0E1B4D', font: 'Calibri' })], heading: HeadingLevel.HEADING_2, spacing: { before: 200, after: 100 } }))
    } else if (line.startsWith('- ') || line.startsWith('* ')) {
      bodyElements.push(new Paragraph({ bullet: { level: 0 }, children: [new TextRun({ text: line.replace(/^[-*]\s+/, '').replace(/\*\*/g, ''), size: 20, color: '1E293B', font: 'Calibri' })], spacing: { after: 60 } }))
    } else {
      bodyElements.push(new Paragraph({ children: [new TextRun({ text: line.replace(/\*\*/g, ''), size: 20, color: '334155', font: 'Calibri' })], spacing: { after: 100 } }))
    }
  }

  if (inTable) flushTable()

  const doc = new DocxDocument({
    sections: [
      {
        properties: { page: { margin: { top: 1200, bottom: 1200, left: 1200, right: 1200 } } },
        headers: { default: new Header({ children: [headerTable] }) },
        footers: {
          default: new Footer({
            children: [
              new Paragraph({
                children: [
                  new TextRun({ text: `Colegio Bilingüe San José Campestre • Formato Oficial SJB-RGA006 • Página `, size: 15, color: '64748B', font: 'Calibri' }),
                  new TextRun({ children: [PageNumber.CURRENT], size: 15, color: '0E1B4D', bold: true, font: 'Calibri' }),
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

  return await Packer.toBuffer(doc)
}

// PDF Generator implementation
async function generateTestPdf(title, content, metadata) {
  const lines = content.split('\n')
  const blocks = []
  let tableRows = []
  let inTable = false

  const flushTable = () => {
    if (tableRows.length > 0) {
      blocks.push({ type: 'table', rows: tableRows })
      tableRows = []
      inTable = false
    }
  }

  for (const rawLine of lines) {
    const line = rawLine.trim()
    if (line.startsWith('|') && line.endsWith('|')) {
      if (/^\|[\s\-:|]+\|$/.test(line)) continue
      const cols = line.slice(1, -1).split('|').map((c) => c.trim().replace(/\*\*/g, ''))
      tableRows.push(cols)
      inTable = true
      continue
    } else if (inTable) {
      flushTable()
    }

    if (!line) continue

    if (line.startsWith('# ')) {
      blocks.push({ type: 'h1', text: line.substring(2).replace(/\*\*/g, '') })
    } else if (line.startsWith('## ')) {
      blocks.push({ type: 'h2', text: line.substring(3).replace(/\*\*/g, '') })
    } else if (line.startsWith('### ')) {
      blocks.push({ type: 'h3', text: line.substring(4).replace(/\*\*/g, '') })
    } else if (line.startsWith('- ') || line.startsWith('* ')) {
      blocks.push({ type: 'bullet', text: line.replace(/^[-*]\s+/, '').replace(/\*\*/g, '') })
    } else {
      blocks.push({ type: 'paragraph', text: line.replace(/\*\*/g, '') })
    }
  }
  if (inTable) flushTable()

  const doc = React.createElement(
    PdfDocument,
    null,
    React.createElement(
      PdfPage,
      { size: 'A4', style: pdfStyles.page },
      // Header Table
      React.createElement(
        PdfView,
        { style: pdfStyles.headerBox },
        React.createElement(
          PdfView,
          { style: pdfStyles.headerColLeft },
          React.createElement(PdfText, { style: pdfStyles.headerLogoText }, 'CBSJC'),
          React.createElement(PdfText, { style: { fontFamily: 'Roboto', color: '#FFFFFF', fontSize: 6.5 } }, 'EST. 2000')
        ),
        React.createElement(
          PdfView,
          { style: pdfStyles.headerColCenter },
          React.createElement(PdfText, { style: pdfStyles.schoolName }, 'COLEGIO BILINGÜE SAN JOSÉ CAMPESTRE'),
          React.createElement(PdfText, { style: pdfStyles.planningTitle }, 'PLANNING BOOK PRIMARY & SECONDARY'),
          React.createElement(PdfText, { style: pdfStyles.formatText }, 'Secuencia Didáctica: Antes — Durante — Después · Formato RGA006')
        ),
        React.createElement(
          PdfView,
          { style: pdfStyles.headerColRight },
          React.createElement(PdfText, { style: pdfStyles.codeText }, 'CÓDIGO: SJB-RGA006'),
          React.createElement(PdfText, { style: pdfStyles.subCodeText }, 'VERSIÓN: 4 · VIGENCIA: 2026')
        )
      ),
      // Metadata Box
      React.createElement(
        PdfView,
        { style: pdfStyles.metaTable },
        React.createElement(
          PdfView,
          { style: pdfStyles.metaRow },
          React.createElement(PdfText, { style: pdfStyles.metaKey }, 'Docente(s):'),
          React.createElement(PdfText, { style: pdfStyles.metaVal }, metadata.authorName || 'Docente Titular CBSJC')
        ),
        React.createElement(
          PdfView,
          { style: pdfStyles.metaRow },
          React.createElement(PdfText, { style: pdfStyles.metaKey }, 'Área / Asignatura:'),
          React.createElement(PdfText, { style: pdfStyles.metaVal }, metadata.area || 'Ciencias Naturales')
        ),
        React.createElement(
          PdfView,
          { style: pdfStyles.metaRow },
          React.createElement(PdfText, { style: pdfStyles.metaKey }, 'Grado / Periodo:'),
          React.createElement(PdfText, { style: pdfStyles.metaVal }, `${metadata.grado || 'Grado 6°'} • Periodo ${metadata.periodo || 'I'} (2026)`)
        ),
        React.createElement(
          PdfView,
          { style: [pdfStyles.metaRow, { borderBottomWidth: 0 }] },
          React.createElement(PdfText, { style: pdfStyles.metaKey }, 'Fecha de Emisión:'),
          React.createElement(PdfText, { style: pdfStyles.metaVal }, metadata.date)
        )
      ),
      // Content Blocks
      ...blocks.map((block, idx) => {
        if (block.type === 'h1') return React.createElement(PdfText, { key: idx, style: pdfStyles.h1 }, block.text)
        if (block.type === 'h2') return React.createElement(PdfText, { key: idx, style: pdfStyles.h2 }, block.text)
        if (block.type === 'h3') return React.createElement(PdfText, { key: idx, style: pdfStyles.h3 }, block.text)
        if (block.type === 'bullet') {
          return React.createElement(
            PdfView,
            { key: idx, style: pdfStyles.bulletItem },
            React.createElement(PdfView, { style: pdfStyles.bulletDot }),
            React.createElement(PdfText, { style: pdfStyles.bulletText }, block.text)
          )
        }
        if (block.type === 'table' && block.rows) {
          const colCount = block.rows[0]?.length || 1
          const cellWidthPercent = `${Math.floor(100 / colCount)}%`
          return React.createElement(
            PdfView,
            { key: idx, style: pdfStyles.table },
            block.rows.map((row, rIdx) => {
              const isHeader = rIdx === 0
              return React.createElement(
                PdfView,
                {
                  key: rIdx,
                  style: [
                    pdfStyles.tableRow,
                    isHeader ? pdfStyles.tableHeaderRow : { backgroundColor: rIdx % 2 === 1 ? '#FFFFFF' : '#F8FAFC' },
                  ],
                },
                row.map((col, cIdx) =>
                  React.createElement(
                    PdfText,
                    {
                      key: cIdx,
                      style: [isHeader ? pdfStyles.tableHeaderCell : pdfStyles.tableCell, { width: cellWidthPercent }],
                    },
                    col
                  )
                )
              )
            })
          )
        }
        return React.createElement(PdfText, { key: idx, style: pdfStyles.paragraph }, block.text)
      }),
      // Institutional Signatures Block
      React.createElement(
        PdfView,
        { style: pdfStyles.signaturesBox, wrap: false },
        React.createElement(
          PdfView,
          { style: pdfStyles.sigHeaderRow },
          React.createElement(PdfText, { style: pdfStyles.sigHeaderCell }, 'ELABORÓ'),
          React.createElement(PdfText, { style: pdfStyles.sigHeaderCell }, 'REVISÓ'),
          React.createElement(PdfText, { style: [pdfStyles.sigHeaderCell, { borderRightWidth: 0 }] }, 'APROBÓ')
        ),
        React.createElement(
          PdfView,
          { style: pdfStyles.sigBodyRow },
          React.createElement(
            PdfView,
            { style: pdfStyles.sigBodyCell },
            React.createElement(PdfText, { style: { marginTop: 12 } }, '_____________________________'),
            React.createElement(PdfText, { style: { fontWeight: 700, color: '#0E1B4D', marginTop: 2 } }, metadata.authorName || 'Docente Titular CBSJC'),
            React.createElement(PdfText, null, `${metadata.grado || 'Grado 6°'} — Docente de Asignatura`),
            React.createElement(PdfText, null, 'Colegio Bilingüe San José Campestre')
          ),
          React.createElement(
            PdfView,
            { style: pdfStyles.sigBodyCell },
            React.createElement(PdfText, { style: { marginTop: 12 } }, '_____________________________'),
            React.createElement(PdfText, { style: { fontWeight: 700, color: '#0E1B4D', marginTop: 2 } }, 'Líder de Área / Coordinación'),
            React.createElement(PdfText, null, 'Comité Curricular y Pedagógico'),
            React.createElement(PdfText, null, 'Colegio Bilingüe San José Campestre')
          ),
          React.createElement(
            PdfView,
            { style: [pdfStyles.sigBodyCell, { borderRightWidth: 0 }] },
            React.createElement(PdfText, { style: { marginTop: 12 } }, '_____________________________'),
            React.createElement(PdfText, { style: { fontWeight: 700, color: '#0E1B4D', marginTop: 2 } }, 'Coordinación Académica General'),
            React.createElement(PdfText, null, 'Rectoría Institucional'),
            React.createElement(PdfText, null, 'Colegio Bilingüe San José Campestre')
          )
        )
      ),
      // Footer
      React.createElement(
        PdfView,
        { style: pdfStyles.footer, fixed: true },
        React.createElement(PdfText, null, 'Colegio Bilingüe San José Campestre • Formato Oficial SJB-RGA006'),
        React.createElement(PdfText, { render: ({ pageNumber, totalPages }) => `Página ${pageNumber} de ${totalPages}` })
      )
    )
  )

  const buf = await renderPdfToBuffer(doc)
  return Buffer.from(buf)
}

// Excel Generator implementation
async function generateTestExcel(params) {
  const workbook = new ExcelJS.Workbook()
  workbook.creator = 'Colegio Bilingüe San José Campestre'
  workbook.created = new Date()

  const sheet = workbook.addWorksheet('Planilla de Notas', {
    pageSetup: { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0 },
    views: [{ showGridLines: true }],
  })

  sheet.columns = [
    { width: 6 },
    { width: 32 },
    { width: 22 },
    { width: 22 },
    { width: 20 },
    { width: 20 },
    { width: 16 },
    { width: 24 },
    { width: 30 },
  ]

  sheet.mergeCells('A1:I1')
  const titleCell = sheet.getCell('A1')
  titleCell.value = 'COLEGIO BILINGÜE SAN JOSÉ CAMPESTRE'
  titleCell.font = { name: 'Arial', size: 14, bold: true, color: { argb: 'FFFFFFFF' } }
  titleCell.alignment = { horizontal: 'center', vertical: 'middle' }
  titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0E1B4D' } }
  sheet.getRow(1).height = 28

  sheet.mergeCells('A2:I2')
  const subtitleCell = sheet.getCell('A2')
  subtitleCell.value = 'SISTEMA INSTITUCIONAL DE EVALUACIÓN Y SEGUIMIENTO PEDAGÓGICO'
  subtitleCell.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FFFFFFFF' } }
  subtitleCell.alignment = { horizontal: 'center', vertical: 'middle' }
  subtitleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD71921' } }
  sheet.getRow(2).height = 20

  const headerRowIndex = 8
  const headers = [
    '#',
    'Apellidos y Nombres del Estudiante',
    'SABER (35%)\nComprensión & Conceptos',
    'SABER HACER (35%)\nAplicación & Producto ACE',
    'SABER SER (20%)\nAutonomía & Metacognición',
    'SABER CONVIVIR (10%)\nTrabajo en Equipo & Rol',
    'NOTA FINAL\n(1.0 a 5.0)',
    'NIVEL ALCANZADO\n(Menú de Desafíos)',
    'Observaciones / Retroalimentación',
  ]

  const headerRow = sheet.getRow(headerRowIndex)
  headerRow.values = headers
  headerRow.height = 36

  headers.forEach((_, idx) => {
    const cell = headerRow.getCell(idx + 1)
    cell.font = { name: 'Arial', size: 9, bold: true, color: { argb: 'FFFFFFFF' } }
    cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true }
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: idx === 6 ? 'FFD71921' : idx === 7 ? 'FF162874' : 'FF0E1B4D' },
    }
  })

  const startRow = 9
  const totalStudents = 30
  for (let i = 0; i < totalStudents; i++) {
    const currentRow = startRow + i
    const row = sheet.getRow(currentRow)
    row.getCell(1).value = i + 1
    row.getCell(2).value = i === 0 ? 'Álvarez Morales, Santiago' : ''
    if (i === 0) {
      row.getCell(3).value = 4.8
      row.getCell(4).value = 4.7
      row.getCell(5).value = 5.0
      row.getCell(6).value = 4.5
      row.getCell(9).value = 'Excelente dominio conceptual.'
    }
    const finalGradeCell = row.getCell(7)
    finalGradeCell.value = {
      formula: `IF(OR(C${currentRow}="",D${currentRow}="",E${currentRow}="",F${currentRow}=""), "", ROUND(C${currentRow}*0.35 + D${currentRow}*0.35 + E${currentRow}*0.20 + F${currentRow}*0.10, 2))`,
    }
    finalGradeCell.numFmt = '0.0'

    const levelCell = row.getCell(8)
    levelCell.value = {
      formula: `IF(G${currentRow}="","", IF(G${currentRow}>=4.8,"Gold (4.8 - 5.0)", IF(G${currentRow}>=4.6,"Silver (4.6 - 4.7)", IF(G${currentRow}>=4.0,"Bronze (4.0 - 4.5)","Sin Categoría (1.0 - 3.9)"))))`,
    }
  }

  const buffer = await workbook.xlsx.writeBuffer()
  return Buffer.from(buffer)
}

// Deliverables ZIP Packager implementation
async function packageDeliverablesZip(params) {
  const zip = new JSZip()
  const cleanTitle = (params.title || 'Planeacion_CBSJC').replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 50)
  const folder = zip.folder(`CBSJC_${cleanTitle}`) || zip

  if (params.planningDocx) {
    folder.file(`1_Planning_Book_SJB-RGA006_${cleanTitle}.docx`, params.planningDocx)
  }
  if (params.planningPdf) {
    folder.file(`2_Planning_Book_SJB-RGA006_${cleanTitle}.pdf`, params.planningPdf)
  }
  if (params.rubricsDocx) {
    folder.file(`3_Rubricas_Menu_Desafios_${cleanTitle}.docx`, params.rubricsDocx)
  }
  if (params.excelSpreadsheet) {
    folder.file(`4_Planilla_Notas_${cleanTitle}.xlsx`, params.excelSpreadsheet)
  }
  if (params.cibercolegiosTxt) {
    folder.file(`5_Traslado_Cibercolegios_${cleanTitle}.txt`, params.cibercolegiosTxt)
  }

  return await zip.generateAsync({
    type: 'nodebuffer',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 },
  })
}

// ----------------------------------------------------
// MAIN RUNNER & TEST ASSERTIONS
// ----------------------------------------------------
async function runExportPipelineTests() {
  console.log('=================================================================')
  console.log('  CBSJC SERVERLESS EXPORT PIPELINE VERIFICATION SUITE')
  console.log('  Testing 4 Formats + Deliverables ZIP Bundle')
  console.log('=================================================================\n')

  let passedCount = 0
  let failedCount = 0

  function assertTest(condition, name, details = '') {
    if (condition) {
      passedCount++
      console.log(`  ✅ [PASS] ${name} ${details ? `(${details})` : ''}`)
    } else {
      failedCount++
      console.error(`  ❌ [FAIL] ${name} - ${details}`)
    }
  }

  // 1. Test Planning Book Word (.docx)
  console.log('--- 1. Testing Planning Book Word (.docx) Export ---')
  const startDocx = Date.now()
  let planningDocxBuf
  try {
    planningDocxBuf = await generateTestDocx(
      'Planning Book: Ecosistemas y Biodiversidad',
      samplePlanningMarkdown,
      sampleMetadata
    )
    const docxDuration = Date.now() - startDocx
    assertTest(Buffer.isBuffer(planningDocxBuf) && planningDocxBuf.length > 5000, 'Planning Book DOCX generated', `${planningDocxBuf.length} bytes in ${docxDuration}ms`)
    assertTest(planningDocxBuf.slice(0, 2).toString('utf8') === 'PK', 'Planning Book DOCX valid ZIP/OpenXML magic bytes (PK)')
  } catch (err) {
    assertTest(false, 'Planning Book DOCX generation threw error', err.message)
  }

  // 2. Test Planning Book PDF (.pdf) with Roboto TrueType fonts
  console.log('\n--- 2. Testing Planning Book PDF (.pdf) Export with Roboto Fonts ---')
  const startPdf = Date.now()
  let planningPdfBuf
  try {
    planningPdfBuf = await generateTestPdf(
      'Planning Book: Ecosistemas y Biodiversidad',
      samplePlanningMarkdown,
      sampleMetadata
    )
    const pdfDuration = Date.now() - startPdf
    assertTest(Buffer.isBuffer(planningPdfBuf) && planningPdfBuf.length > 10000, 'Planning Book PDF generated', `${planningPdfBuf.length} bytes in ${pdfDuration}ms`)
    const pdfHeader = planningPdfBuf.slice(0, 5).toString('utf8')
    assertTest(pdfHeader.startsWith('%PDF-'), 'Planning Book PDF valid PDF header (%PDF-)', pdfHeader)
  } catch (err) {
    assertTest(false, 'Planning Book PDF generation threw error (e.g. Helvetica.afm missing)', err.message)
  }

  // 3. Test Rúbricas Menú de Desafíos Word (.docx)
  console.log('\n--- 3. Testing Rúbricas Menú de Desafíos Word (.docx) Export ---')
  const startRubrics = Date.now()
  let rubricsDocxBuf
  try {
    rubricsDocxBuf = await generateTestDocx(
      'Rúbricas Menú de Desafíos: Ecosistemas',
      sampleRubricsMarkdown,
      sampleMetadata
    )
    const rubricsDuration = Date.now() - startRubrics
    assertTest(Buffer.isBuffer(rubricsDocxBuf) && rubricsDocxBuf.length > 5000, 'Rúbricas Menú de Desafíos DOCX generated', `${rubricsDocxBuf.length} bytes in ${rubricsDuration}ms`)
    assertTest(rubricsDocxBuf.slice(0, 2).toString('utf8') === 'PK', 'Rúbricas DOCX valid ZIP/OpenXML magic bytes (PK)')
  } catch (err) {
    assertTest(false, 'Rúbricas DOCX generation threw error', err.message)
  }

  // 4. Test Planilla de Notas Excel (.xlsx)
  console.log('\n--- 4. Testing Planilla de Notas Excel (.xlsx) Export ---')
  const startExcel = Date.now()
  let excelBuf
  try {
    excelBuf = await generateTestExcel(sampleExcelSpec)
    const excelDuration = Date.now() - startExcel
    assertTest(Buffer.isBuffer(excelBuf) && excelBuf.length > 5000, 'Planilla de Notas Excel XLSX generated', `${excelBuf.length} bytes in ${excelDuration}ms`)
    assertTest(excelBuf.slice(0, 2).toString('utf8') === 'PK', 'Planilla Excel valid ZIP/OpenXML magic bytes (PK)')
  } catch (err) {
    assertTest(false, 'Planilla Excel generation threw error', err.message)
  }

  // 5. Test Complete Deliverables ZIP Bundle (.zip)
  console.log('\n--- 5. Testing Complete Deliverables ZIP Bundle (.zip) ---')
  const startZip = Date.now()
  let zipBuf
  try {
    zipBuf = await packageDeliverablesZip({
      title: 'Ecosistemas_Grado_6',
      planningDocx: planningDocxBuf,
      planningPdf: planningPdfBuf,
      rubricsDocx: rubricsDocxBuf,
      excelSpreadsheet: excelBuf,
      cibercolegiosTxt: 'MENSAJE CIBERCOLEGIOS: Actividades y secuencia cargadas exitosamente.',
    })
    const zipDuration = Date.now() - startZip
    assertTest(Buffer.isBuffer(zipBuf) && zipBuf.length > 20000, 'Deliverables ZIP package created', `${zipBuf.length} bytes in ${zipDuration}ms`)
    assertTest(zipBuf.slice(0, 2).toString('utf8') === 'PK', 'Deliverables ZIP valid ZIP magic bytes (PK)')

    // Unpack ZIP and verify all 4 deliverables are inside
    const loadedZip = await JSZip.loadAsync(zipBuf)
    const fileNames = Object.keys(loadedZip.files)
    console.log('    ZIP Entry list:', fileNames)

    const hasPlanningDocx = fileNames.some((f) => f.includes('1_Planning_Book_') && f.endsWith('.docx'))
    const hasPlanningPdf = fileNames.some((f) => f.includes('2_Planning_Book_') && f.endsWith('.pdf'))
    const hasRubricsDocx = fileNames.some((f) => f.includes('3_Rubricas_Menu_Desafios_') && f.endsWith('.docx'))
    const hasExcel = fileNames.some((f) => f.includes('4_Planilla_Notas_') && f.endsWith('.xlsx'))
    const hasCibercolegios = fileNames.some((f) => f.includes('5_Traslado_Cibercolegios_') && f.endsWith('.txt'))

    assertTest(hasPlanningDocx, 'ZIP contains 1. Planning Book Word (.docx)')
    assertTest(hasPlanningPdf, 'ZIP contains 2. Planning Book PDF (.pdf)')
    assertTest(hasRubricsDocx, 'ZIP contains 3. Rúbricas Menú de Desafíos Word (.docx)')
    assertTest(hasExcel, 'ZIP contains 4. Planilla de Notas Excel (.xlsx)')
    assertTest(hasCibercolegios, 'ZIP contains 5. Cibercolegios snippet (.txt)')

  } catch (err) {
    assertTest(false, 'Deliverables ZIP packaging threw error', err.message)
  }

  console.log('\n=================================================================')
  console.log(`  TOTAL TESTS: ${passedCount + failedCount} | PASSED: ${passedCount} | FAILED: ${failedCount}`)
  console.log('=================================================================')

  if (failedCount > 0) {
    process.exit(1)
  } else {
    console.log('🎉 ALL EXPORT FORMATS AND ZIP BUNDLE VERIFIED WITH 0 ERRORS!\n')
    process.exit(0)
  }
}

runExportPipelineTests().catch((e) => {
  console.error('Fatal test suite crash:', e)
  process.exit(1)
})

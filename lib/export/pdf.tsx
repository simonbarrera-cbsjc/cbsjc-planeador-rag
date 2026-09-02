import 'server-only'
import React from 'react'
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Font,
  renderToBuffer,
} from '@react-pdf/renderer'
import path from 'path'
import fs from 'fs'

if (typeof window !== 'undefined') {
  throw new Error('lib/export/pdf.tsx must only be used on the server.')
}

// Disable hyphenation to prevent word break glitches in serverless
Font.registerHyphenationCallback((word) => [word])

// Register complete Roboto font family (Normal, Bold, Italic, BoldItalic)
const fontDir = path.join(process.cwd(), 'public', 'fonts')
const regularFontPath = path.join(fontDir, 'Roboto-Regular.ttf')
const boldFontPath = path.join(fontDir, 'Roboto-Bold.ttf')
const italicFontPath = path.join(fontDir, 'Roboto-Italic.ttf')
const boldItalicFontPath = path.join(fontDir, 'Roboto-BoldItalic.ttf')

const regularSrc = fs.existsSync(regularFontPath)
  ? regularFontPath
  : 'https://cdnjs.cloudflare.com/ajax/libs/ink/3.1.10/fonts/Roboto/roboto-regular-webfont.ttf'
const boldSrc = fs.existsSync(boldFontPath)
  ? boldFontPath
  : 'https://cdnjs.cloudflare.com/ajax/libs/ink/3.1.10/fonts/Roboto/roboto-bold-webfont.ttf'
const italicSrc = fs.existsSync(italicFontPath)
  ? italicFontPath
  : 'https://cdnjs.cloudflare.com/ajax/libs/ink/3.1.10/fonts/Roboto/roboto-italic-webfont.ttf'
const boldItalicSrc = fs.existsSync(boldItalicFontPath)
  ? boldItalicFontPath
  : 'https://cdnjs.cloudflare.com/ajax/libs/ink/3.1.10/fonts/Roboto/roboto-bolditalic-webfont.ttf'

Font.register({
  family: 'Roboto',
  fonts: [
    { src: regularSrc, fontWeight: 'normal', fontStyle: 'normal' },
    { src: boldSrc, fontWeight: 'bold', fontStyle: 'normal' },
    { src: italicSrc, fontWeight: 'normal', fontStyle: 'italic' },
    { src: boldItalicSrc, fontWeight: 'bold', fontStyle: 'italic' },
  ],
})

const NAVY = '#0E1B4D'
const RED = '#D71921'
const GRAY_BG = '#F1F5F9'
const BORDER = '#CBD5E1'

const styles = StyleSheet.create({
  page: {
    paddingTop: 65,
    paddingBottom: 40,
    paddingHorizontal: 35,
    fontSize: 9,
    fontFamily: 'Roboto',
    color: '#1E293B',
    backgroundColor: '#FFFFFF',
    lineHeight: 1.35,
  },
  headerBox: {
    position: 'absolute' as const,
    top: 15,
    left: 35,
    right: 35,
    height: 42,
    borderWidth: 1,
    borderColor: '#94A3B8',
    flexDirection: 'row' as const,
  },
  headerColLeft: {
    width: '16%',
    padding: 4,
    borderRightWidth: 1,
    borderRightColor: '#94A3B8',
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
  },
  headerColCenter: {
    width: '58%',
    padding: 4,
    borderRightWidth: 1,
    borderRightColor: '#94A3B8',
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
    textAlign: 'center' as const,
  },
  headerColRight: {
    width: '26%',
    padding: 4,
    justifyContent: 'center' as const,
    backgroundColor: GRAY_BG,
  },
  titleMain: {
    fontFamily: 'Roboto',
    fontSize: 8.5,
    fontWeight: 'bold' as const,
    color: NAVY,
    textAlign: 'center' as const,
  },
  titleSub: {
    fontFamily: 'Roboto',
    fontSize: 7.5,
    fontWeight: 'bold' as const,
    color: RED,
    textAlign: 'center' as const,
    marginTop: 1,
  },
  titleDesc: {
    fontFamily: 'Roboto',
    fontSize: 6.5,
    color: '#64748B',
    textAlign: 'center' as const,
  },
  codeText: {
    fontFamily: 'Roboto',
    fontSize: 7,
    color: NAVY,
    fontWeight: 'bold' as const,
  },
  subCodeText: {
    fontFamily: 'Roboto',
    fontSize: 6.5,
    color: '#64748B',
    marginTop: 1,
  },
  h1: {
    fontFamily: 'Roboto',
    fontSize: 11,
    fontWeight: 'bold' as const,
    color: NAVY,
    marginTop: 8,
    marginBottom: 3,
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
    paddingBottom: 2,
  },
  h2: {
    fontFamily: 'Roboto',
    fontSize: 10,
    fontWeight: 'bold' as const,
    color: NAVY,
    marginTop: 7,
    marginBottom: 3,
  },
  h3: {
    fontFamily: 'Roboto',
    fontSize: 8.5,
    fontWeight: 'bold' as const,
    color: RED,
    marginTop: 5,
    marginBottom: 2,
  },
  paragraph: {
    fontFamily: 'Roboto',
    fontSize: 8,
    marginBottom: 3,
    textAlign: 'justify' as const,
    lineHeight: 1.3,
  },
  bulletItem: {
    flexDirection: 'row' as const,
    marginBottom: 2,
    paddingLeft: 6,
  },
  bulletDot: {
    width: 8,
    color: RED,
    fontWeight: 'bold' as const,
    fontSize: 8,
  },
  bulletText: {
    fontFamily: 'Roboto',
    flex: 1,
    fontSize: 8,
    lineHeight: 1.3,
  },
  table: {
    width: '100%',
    borderWidth: 0.5,
    borderColor: BORDER,
    marginVertical: 3,
  },
  tableHeaderRow: {
    flexDirection: 'row' as const,
    backgroundColor: NAVY,
  },
  tableHeaderCell: {
    padding: 3,
    borderRightWidth: 0.5,
    borderRightColor: '#334155',
  },
  tableHeaderCellText: {
    fontFamily: 'Roboto',
    color: '#FFFFFF',
    fontWeight: 'bold' as const,
    fontSize: 7,
  },
  tableRow: {
    flexDirection: 'row' as const,
    borderBottomWidth: 0.5,
    borderBottomColor: '#E2E8F0',
  },
  tableRowAlt: {
    flexDirection: 'row' as const,
    borderBottomWidth: 0.5,
    borderBottomColor: '#E2E8F0',
    backgroundColor: '#F8FAFC',
  },
  tableCell: {
    padding: 3,
    borderRightWidth: 0.5,
    borderRightColor: '#E2E8F0',
  },
  tableCellKey: {
    padding: 3,
    backgroundColor: GRAY_BG,
    borderRightWidth: 0.5,
    borderRightColor: BORDER,
  },
  footer: {
    position: 'absolute' as const,
    bottom: 15,
    left: 35,
    right: 35,
    flexDirection: 'row' as const,
    justifyContent: 'space-between' as const,
    alignItems: 'center' as const,
    borderTopWidth: 0.5,
    borderTopColor: BORDER,
    paddingTop: 3,
  },
  footerText: {
    fontFamily: 'Roboto',
    fontSize: 6.5,
    color: '#94A3B8',
  },
})

// ── Rich text rendering (bold, italic, normal spans) with zero nulls ──
function renderRichText(text: string, baseFontSize = 8): React.ReactNode {
  if (!text || typeof text !== 'string') return ''
  const clean = text
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/^#{1,6}\s*/, '')
    .trim()

  if (!clean) return ''

  if (!clean.includes('*') && !clean.includes('_')) {
    return clean
  }

  const parts = clean.split(/(\*\*\*.*?\*\*\*|___.*?___|\*\*.*?\*\*|__.*?__|\*.*?\*|_.*?_)/g)

  const nodes: React.ReactNode[] = []
  for (let i = 0; i < parts.length; i++) {
    const part = parts[i]
    if (!part || part.length === 0) continue

    if (
      (part.startsWith('***') && part.endsWith('***') && part.length >= 6) ||
      (part.startsWith('___') && part.endsWith('___') && part.length >= 6)
    ) {
      nodes.push(
        <Text
          key={i}
          style={{
            fontWeight: 'bold',
            fontStyle: 'italic',
            color: NAVY,
            fontFamily: 'Roboto',
            fontSize: baseFontSize,
          }}
        >
          {part.slice(3, -3)}
        </Text>
      )
    } else if (
      (part.startsWith('**') && part.endsWith('**') && part.length >= 4) ||
      (part.startsWith('__') && part.endsWith('__') && part.length >= 4)
    ) {
      nodes.push(
        <Text
          key={i}
          style={{
            fontWeight: 'bold',
            color: NAVY,
            fontFamily: 'Roboto',
            fontSize: baseFontSize,
          }}
        >
          {part.slice(2, -2)}
        </Text>
      )
    } else if (
      (part.startsWith('*') && part.endsWith('*') && part.length >= 2) ||
      (part.startsWith('_') && part.endsWith('_') && part.length >= 2)
    ) {
      nodes.push(
        <Text
          key={i}
          style={{
            fontStyle: 'italic',
            fontFamily: 'Roboto',
            fontSize: baseFontSize,
          }}
        >
          {part.slice(1, -1)}
        </Text>
      )
    } else {
      nodes.push(part)
    }
  }

  return nodes.length === 1 ? nodes[0] : nodes
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

export async function generatePdf(params: GeneratePdfParams): Promise<Buffer> {
  const { title, content, metadata } = params
  const safeDocente = metadata.authorName || 'Docente Titular CBSJC'

  // Parse lines for PDF elements
  const lines = content.split('\n')
  const elements: React.ReactNode[] = []
  let tableRows: string[][] = []

  const flushTable = (key: number) => {
    if (tableRows.length === 0) return null
    const headers = tableRows[0] || []
    const dataRows = tableRows.slice(1)
    const isTwoCol = headers.length === 2
    const numCols = headers.length || 1
    const colWidthPct = `${(100 / numCols).toFixed(2)}%`

    const rendered = (
      <View key={`tbl-${key}`} style={styles.table}>
        {/* Table Header */}
        <View style={styles.tableHeaderRow} wrap={false}>
          {headers.map((h, ci) => (
            <View
              key={ci}
              style={[
                styles.tableHeaderCell,
                isTwoCol
                  ? { width: ci === 0 ? '28%' : '72%' }
                  : { width: colWidthPct },
              ]}
            >
              <Text style={styles.tableHeaderCellText}>
                {h.replace(/\*\*/g, '').trim()}
              </Text>
            </View>
          ))}
        </View>

        {/* Table Data Rows */}
        {dataRows.map((r, ri) => (
          <View
            key={ri}
            style={ri % 2 === 0 ? styles.tableRow : styles.tableRowAlt}
            wrap={false}
          >
            {r.map((c, ci) => (
              <View
                key={ci}
                style={[
                  isTwoCol && ci === 0 ? styles.tableCellKey : styles.tableCell,
                  isTwoCol
                    ? { width: ci === 0 ? '28%' : '72%' }
                    : { width: colWidthPct },
                ]}
              >
                <Text style={{ fontSize: 7, fontFamily: 'Roboto' }}>
                  {renderRichText(c.trim(), 7)}
                </Text>
              </View>
            ))}
          </View>
        ))}
      </View>
    )
    tableRows = []
    return rendered
  }

  let elementKey = 0

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i]
    const line = rawLine.trim()

    // Table line detection
    if (line.startsWith('|') && line.endsWith('|')) {
      if (/^\|[\s\-:|]+\|$/.test(line)) continue
      const cells = line
        .slice(1, -1)
        .split('|')
        .map((c) => c.trim())
      tableRows.push(cells)
      continue
    } else if (tableRows.length > 0) {
      const tbl = flushTable(elementKey++)
      if (tbl) elements.push(tbl)
    }

    if (!line) continue

    // Headings
    if (line.startsWith('# ')) {
      elements.push(
        <Text key={elementKey++} style={styles.h1}>
          {line.substring(2).replace(/\*\*/g, '').trim()}
        </Text>
      )
    } else if (line.startsWith('## ')) {
      elements.push(
        <Text key={elementKey++} style={styles.h2}>
          {line.substring(3).replace(/\*\*/g, '').trim()}
        </Text>
      )
    } else if (line.startsWith('### ')) {
      elements.push(
        <Text key={elementKey++} style={styles.h3}>
          {line.substring(4).replace(/\*\*/g, '').trim()}
        </Text>
      )
    } else if (line.startsWith('#### ') || line.startsWith('##### ') || line.startsWith('###### ')) {
      elements.push(
        <Text key={elementKey++} style={[styles.h3, { color: NAVY, fontSize: 8 }]}>
          {line.replace(/^#{4,6}\s*/, '').replace(/\*\*/g, '').trim()}
        </Text>
      )
    } else if (line.startsWith('- ') || line.startsWith('* ')) {
      elements.push(
        <View key={elementKey++} style={styles.bulletItem} wrap={false}>
          <Text style={styles.bulletDot}>•</Text>
          <Text style={styles.bulletText}>
            {renderRichText(line.substring(2).trim(), 8)}
          </Text>
        </View>
      )
    } else if (line.startsWith('```')) {
      continue
    } else {
      elements.push(
        <Text key={elementKey++} style={styles.paragraph}>
          {renderRichText(line, 8)}
        </Text>
      )
    }
  }

  // Flush any remaining table
  if (tableRows.length > 0) {
    const tbl = flushTable(elementKey++)
    if (tbl) elements.push(tbl)
  }

  const pdfDoc = (
    <Document title={title} author={safeDocente}>
      <Page size="A4" style={styles.page}>
        {/* Fixed Header Table - Positioned Absolutely */}
        <View style={styles.headerBox} fixed>
          <View style={styles.headerColLeft}>
            <Text style={{ fontFamily: 'Roboto', fontSize: 11, fontWeight: 'bold', color: NAVY }}>
              CBSJC
            </Text>
          </View>
          <View style={styles.headerColCenter}>
            <Text style={styles.titleMain}>COLEGIO BILINGÜE SAN JOSÉ CAMPESTRE</Text>
            <Text style={styles.titleSub}>PLANNING BOOK PRIMARY & SECONDARY</Text>
            <Text style={styles.titleDesc}>Secuencia Didáctica: Antes — Durante — Después · Subciclos 3 a 6</Text>
          </View>
          <View style={styles.headerColRight}>
            <Text style={styles.codeText}>CÓDIGO: SJB-RGA006</Text>
            <Text style={styles.subCodeText}>VERSIÓN: 4  VIGENCIA: 2026</Text>
          </View>
        </View>

        {/* Content Elements */}
        {elements}

        {/* Running Footer */}
        <View style={styles.footer} fixed>
          <Text style={styles.footerText}>
            Colegio Bilingüe San José Campestre • Formato SJB-RGA006 • Docente: {safeDocente}
          </Text>
          <Text
            style={styles.footerText}
            render={({ pageNumber, totalPages }) => `Pág. ${pageNumber} de ${totalPages}`}
          />
        </View>
      </Page>
    </Document>
  )

  const pdfBuffer = await renderToBuffer(pdfDoc)
  return pdfBuffer
}

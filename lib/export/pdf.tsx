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

// Register fonts using local files bundled with the deployment.
// In Vercel serverless, process.cwd() => /var/task, and public/ is at /var/task/public/
// We use path.join to construct paths that work in both local dev and Vercel.
const fontDir = path.join(process.cwd(), 'public', 'fonts')
const regularFontPath = path.join(fontDir, 'Roboto-Regular.ttf')
const boldFontPath = path.join(fontDir, 'Roboto-Bold.ttf')
const italicFontPath = path.join(fontDir, 'Roboto-Italic.ttf')
const boldItalicFontPath = path.join(fontDir, 'Roboto-BoldItalic.ttf')

// Check if local fonts exist. If yes, register from file. Otherwise, use CDN as fallback.
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
    flexDirection: 'row' as const,
  },
  headerColLeft: {
    width: '18%',
    padding: 8,
    borderRightWidth: 1,
    borderRightColor: '#94A3B8',
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
  },
  headerColCenter: {
    width: '56%',
    padding: 6,
    borderRightWidth: 1,
    borderRightColor: '#94A3B8',
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
    textAlign: 'center' as const,
  },
  headerColRight: {
    width: '26%',
    padding: 6,
    justifyContent: 'center' as const,
    backgroundColor: GRAY_BG,
  },
  titleMain: {
    fontFamily: 'Roboto',
    fontSize: 9.5,
    fontWeight: 'bold' as const,
    color: NAVY,
    textAlign: 'center' as const,
  },
  titleSub: {
    fontFamily: 'Roboto',
    fontSize: 8.5,
    fontWeight: 'bold' as const,
    color: RED,
    textAlign: 'center' as const,
    marginTop: 1,
  },
  titleDesc: {
    fontFamily: 'Roboto',
    fontSize: 7,
    color: '#64748B',
    textAlign: 'center' as const,
    marginTop: 1,
  },
  codeText: {
    fontFamily: 'Roboto',
    fontSize: 7.5,
    color: NAVY,
    fontWeight: 'bold' as const,
  },
  subCodeText: {
    fontFamily: 'Roboto',
    fontSize: 7,
    color: '#64748B',
    marginTop: 1,
  },
  h1: {
    fontFamily: 'Roboto',
    fontSize: 12,
    fontWeight: 'bold' as const,
    color: NAVY,
    marginTop: 10,
    marginBottom: 4,
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
    paddingBottom: 2,
  },
  h2: {
    fontFamily: 'Roboto',
    fontSize: 10.5,
    fontWeight: 'bold' as const,
    color: NAVY,
    marginTop: 8,
    marginBottom: 3,
  },
  h3: {
    fontFamily: 'Roboto',
    fontSize: 9,
    fontWeight: 'bold' as const,
    color: RED,
    marginTop: 6,
    marginBottom: 2,
  },
  paragraph: {
    fontFamily: 'Roboto',
    fontSize: 8.5,
    marginBottom: 4,
    textAlign: 'justify' as const,
    lineHeight: 1.35,
  },
  bulletItem: {
    flexDirection: 'row' as const,
    marginBottom: 2,
    paddingLeft: 8,
  },
  bulletDot: {
    width: 10,
    color: RED,
    fontWeight: 'bold' as const,
    fontSize: 9,
  },
  bulletText: {
    fontFamily: 'Roboto',
    flex: 1,
    fontSize: 8.5,
    lineHeight: 1.35,
  },
  table: {
    width: '100%',
    borderWidth: 0.5,
    borderColor: BORDER,
    marginVertical: 4,
  },
  tableHeaderRow: {
    flexDirection: 'row' as const,
    backgroundColor: NAVY,
  },
  tableHeaderCell: {
    fontFamily: 'Roboto',
    flex: 1,
    padding: 4,
    color: '#FFFFFF',
    fontWeight: 'bold' as const,
    fontSize: 7.5,
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
    fontFamily: 'Roboto',
    flex: 1,
    padding: 4,
    fontSize: 7.5,
    color: '#334155',
  },
  tableCellKey: {
    fontFamily: 'Roboto',
    flex: 1,
    padding: 4,
    fontSize: 7.5,
    color: NAVY,
    fontWeight: 'bold' as const,
    backgroundColor: GRAY_BG,
    borderRightWidth: 0.5,
    borderRightColor: BORDER,
  },
  footer: {
    position: 'absolute' as const,
    bottom: 20,
    left: 40,
    right: 40,
    flexDirection: 'row' as const,
    justifyContent: 'space-between' as const,
    alignItems: 'center' as const,
    borderTopWidth: 0.5,
    borderTopColor: BORDER,
    paddingTop: 4,
  },
  footerText: {
    fontFamily: 'Roboto',
    fontSize: 6.5,
    color: '#94A3B8',
  },
})

// ── Rich text rendering (bold, italic, bold-italic + normal spans) ──
function renderRichText(text: string, baseFontSize = 8.5): React.ReactNode[] {
  const clean = text
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/^#{1,6}\s*/, '')

  const parts = clean.split(/(\*\*\*.*?\*\*\*|___.*?___|\*\*.*?\*\*|__.*?__|\*.*?\*|_.*?_)/g)

  return parts.map((part, i) => {
    if (
      (part.startsWith('***') && part.endsWith('***') && part.length >= 6) ||
      (part.startsWith('___') && part.endsWith('___') && part.length >= 6)
    ) {
      return (
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
    }
    if (
      (part.startsWith('**') && part.endsWith('**') && part.length >= 4) ||
      (part.startsWith('__') && part.endsWith('__') && part.length >= 4)
    ) {
      return (
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
    }
    if (
      (part.startsWith('*') && part.endsWith('*') && part.length >= 2) ||
      (part.startsWith('_') && part.endsWith('_') && part.length >= 2)
    ) {
      return (
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
    }
    return (
      <Text key={i} style={{ fontFamily: 'Roboto', fontSize: baseFontSize }}>
        {part}
      </Text>
    )
  })
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

    const rendered = (
      <View key={`tbl-${key}`} style={styles.table} wrap={false}>
        <View style={styles.tableHeaderRow}>
          {headers.map((h, ci) => (
            <Text
              key={ci}
              style={[
                styles.tableHeaderCell,
                isTwoCol && ci === 0 ? { flex: 0.4 } : {},
              ]}
            >
              {h.replace(/\*\*/g, '').trim()}
            </Text>
          ))}
        </View>
        {dataRows.map((r, ri) => (
          <View
            key={ri}
            style={ri % 2 === 0 ? styles.tableRow : styles.tableRowAlt}
          >
            {r.map((c, ci) => (
              <View
                key={ci}
                style={[
                  isTwoCol && ci === 0 ? styles.tableCellKey : styles.tableCell,
                  isTwoCol && ci === 0 ? { flex: 0.4 } : {},
                ]}
              >
                <Text>{renderRichText(c.trim(), 7.5)}</Text>
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

    // Table line
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
        <Text key={elementKey++} style={[styles.h3, { color: NAVY, fontSize: 8.5 }]}>
          {line.replace(/^#{4,6}\s*/, '').replace(/\*\*/g, '').trim()}
        </Text>
      )
    } else if (line.startsWith('- ') || line.startsWith('* ')) {
      elements.push(
        <View key={elementKey++} style={styles.bulletItem}>
          <Text style={styles.bulletDot}>•</Text>
          <Text style={styles.bulletText}>
            {renderRichText(line.substring(2).trim(), 8.5)}
          </Text>
        </View>
      )
    } else if (line.startsWith('```')) {
      continue
    } else {
      elements.push(
        <Text key={elementKey++} style={styles.paragraph}>
          {renderRichText(line, 8.5)}
        </Text>
      )
    }
  }

  // Flush remaining table
  if (tableRows.length > 0) {
    const tbl = flushTable(elementKey++)
    if (tbl) elements.push(tbl)
  }

  const pdfDoc = (
    <Document title={title} author={safeDocente}>
      <Page size="A4" style={styles.page}>
        {/* Header Table */}
        <View style={styles.headerBox} fixed>
          <View style={styles.headerColLeft}>
            <Text style={{ fontFamily: 'Roboto', fontSize: 13, fontWeight: 'bold', color: NAVY }}>
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
            <Text style={styles.subCodeText}>VERSIÓN: 4</Text>
            <Text style={styles.subCodeText}>VIGENCIA: 2026</Text>
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

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

// Check if local fonts exist. If yes, register from file. Otherwise, use CDN as fallback.
const regularSrc = fs.existsSync(regularFontPath)
  ? regularFontPath
  : 'https://cdnjs.cloudflare.com/ajax/libs/ink/3.1.10/fonts/Roboto/roboto-regular-webfont.ttf'
const boldSrc = fs.existsSync(boldFontPath)
  ? boldFontPath
  : 'https://cdnjs.cloudflare.com/ajax/libs/ink/3.1.10/fonts/Roboto/roboto-bold-webfont.ttf'

Font.register({
  family: 'Roboto',
  fonts: [
    { src: regularSrc, fontWeight: 'normal' },
    { src: boldSrc, fontWeight: 'bold' },
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
    backgroundColor: NAVY,
  },
  headerLogoText: {
    fontFamily: 'Roboto',
    color: '#FFFFFF',
    fontWeight: 'bold' as const,
    fontSize: 14,
    textAlign: 'center' as const,
  },
  headerColCenter: {
    width: '55%',
    padding: 6,
    borderRightWidth: 1,
    borderRightColor: '#94A3B8',
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
  },
  schoolName: {
    fontFamily: 'Roboto',
    fontSize: 10,
    fontWeight: 'bold' as const,
    color: NAVY,
    textAlign: 'center' as const,
  },
  planningTitle: {
    fontFamily: 'Roboto',
    fontSize: 9,
    fontWeight: 'bold' as const,
    color: RED,
    marginTop: 2,
    textAlign: 'center' as const,
  },
  formatText: {
    fontFamily: 'Roboto',
    fontSize: 7.5,
    color: '#64748B',
    marginTop: 1,
    textAlign: 'center' as const,
  },
  headerColRight: {
    width: '27%',
    padding: 6,
    justifyContent: 'center' as const,
    alignItems: 'flex-end' as const,
    backgroundColor: GRAY_BG,
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
    fontFamily: 'Roboto',
    color: RED,
    fontWeight: 'bold' as const,
    fontSize: 8,
    marginRight: 4,
  },
  bulletText: {
    fontFamily: 'Roboto',
    fontSize: 8.5,
    flex: 1,
    lineHeight: 1.35,
  },
  tableContainer: {
    borderWidth: 1,
    borderColor: BORDER,
    marginBottom: 8,
    marginTop: 4,
  },
  tableHeaderRow: {
    flexDirection: 'row' as const,
    backgroundColor: NAVY,
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
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

// ── Rich text rendering (bold + normal spans) ──
function renderRichText(text: string, baseFontSize = 8.5): React.ReactNode[] {
  const clean = text.replace(/\*\*\*(.+?)\*\*\*/g, '**$1**') // normalize ***bold*** to **bold**
  const parts = clean.split(/(\*\*[^*]+\*\*)/g)
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return (
        <Text key={i} style={{ fontWeight: 'bold', color: NAVY, fontFamily: 'Roboto', fontSize: baseFontSize }}>
          {part.slice(2, -2)}
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

// ── Markdown-to-React-PDF component ──
function MarkdownContent({ markdown }: { markdown: string }) {
  const lines = markdown.split('\n')
  const elements: React.ReactNode[] = []
  let currentTable: string[][] = []
  let tableKey = 0

  function flushTable() {
    if (currentTable.length > 0) {
      const rows = [...currentTable]
      const headerRow = rows[0]
      elements.push(
        <View key={`tbl-${tableKey++}`} style={styles.tableContainer} wrap={false}>
          <View style={styles.tableHeaderRow}>
            {headerRow.map((cell, ci) => (
              <Text key={ci} style={styles.tableHeaderCell}>
                {cell.replace(/\*\*/g, '')}
              </Text>
            ))}
          </View>
          {rows.slice(1).map((row, ri) => (
            <View key={ri} style={ri % 2 === 0 ? styles.tableRow : styles.tableRowAlt}>
              {row.map((cell, ci) => (
                <Text key={ci} style={ci === 0 ? styles.tableCellKey : styles.tableCell}>
                  {cell.replace(/\*\*/g, '')}
                </Text>
              ))}
            </View>
          ))}
        </View>
      )
      currentTable = []
    }
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim()

    // Table row
    if (line.startsWith('|') && line.endsWith('|')) {
      if (/^\|[\s\-:|]+\|$/.test(line)) continue // separator row
      const cols = line
        .slice(1, -1)
        .split('|')
        .map((c) => c.trim())
      currentTable.push(cols)
      continue
    } else {
      flushTable()
    }

    if (!line) continue

    if (line.startsWith('# ')) {
      elements.push(
        <Text key={i} style={styles.h1}>
          {line.substring(2).replace(/\*\*/g, '')}
        </Text>
      )
    } else if (line.startsWith('## ')) {
      elements.push(
        <Text key={i} style={styles.h2}>
          {line.substring(3).replace(/\*\*/g, '')}
        </Text>
      )
    } else if (line.startsWith('### ')) {
      elements.push(
        <Text key={i} style={styles.h3}>
          {line.substring(4).replace(/\*\*/g, '')}
        </Text>
      )
    } else if (line.startsWith('#### ')) {
      elements.push(
        <Text key={i} style={{ ...styles.h3, color: NAVY, fontSize: 8.5 }}>
          {line.substring(5).replace(/\*\*/g, '')}
        </Text>
      )
    } else if (line.startsWith('- ') || line.startsWith('* ') || /^\d+\.\s/.test(line)) {
      const clean = line.replace(/^[-*]\s+|\d+\.\s+/, '')
      elements.push(
        <View key={i} style={styles.bulletItem}>
          <Text style={styles.bulletDot}>•</Text>
          <Text style={styles.bulletText}>{renderRichText(clean)}</Text>
        </View>
      )
    } else if (line.startsWith('---')) {
      elements.push(
        <View
          key={i}
          style={{ borderBottomWidth: 0.5, borderBottomColor: BORDER, marginVertical: 6 }}
        />
      )
    } else if (line.startsWith('```')) {
      // skip code fences
    } else if (line.startsWith('*') && !line.startsWith('**')) {
      elements.push(
        <Text key={i} style={{ ...styles.paragraph, fontStyle: 'italic', fontSize: 7.5, color: '#64748B' }}>
          {line.replace(/^\*|\*$/g, '')}
        </Text>
      )
    } else {
      elements.push(
        <Text key={i} style={styles.paragraph}>
          {renderRichText(line)}
        </Text>
      )
    }
  }

  flushTable()

  return <>{elements}</>
}

// ── PDF Document interface ──
export interface PdfOptions {
  title: string
  content: string
  documentType?: string
  language?: 'es' | 'en'
  metadata?: {
    area?: string | null
    nivel?: string | null
    grado?: string
    periodo?: string
    date?: string
    authorName?: string
  }
}

function PlanningPdfDocument({ title, content, metadata }: PdfOptions) {
  return (
    <Document
      title={title}
      author={metadata?.authorName || 'Docente CBSJC'}
      subject="Planning Book SJB-RGA006"
      creator="CBSJC Planeador RAG"
    >
      <Page size="LETTER" style={styles.page} wrap>
        {/* Official 3-Column Header */}
        <View style={styles.headerBox} fixed>
          <View style={styles.headerColLeft}>
            <Text style={styles.headerLogoText}>CBSJC</Text>
          </View>
          <View style={styles.headerColCenter}>
            <Text style={styles.schoolName}>COLEGIO BILINGÜE SAN JOSÉ CAMPESTRE</Text>
            <Text style={styles.planningTitle}>PLANNING BOOK PRIMARY & SECONDARY</Text>
            <Text style={styles.formatText}>
              Secuencia Didáctica: Antes — Durante — Después · Formato RGA006
            </Text>
          </View>
          <View style={styles.headerColRight}>
            <Text style={styles.codeText}>CÓDIGO: SJB-RGA006</Text>
            <Text style={styles.subCodeText}>VERSIÓN: 4</Text>
            <Text style={styles.subCodeText}>VIGENCIA: 2026</Text>
          </View>
        </View>

        {/* Document Body */}
        <MarkdownContent markdown={content} />

        {/* Footer */}
        <View style={styles.footer} fixed>
          <Text style={styles.footerText}>
            Colegio Bilingüe San José Campestre · SJB-RGA006 · {metadata?.date || '2026'}
          </Text>
          <Text
            style={styles.footerText}
            render={({ pageNumber, totalPages }) => `Página ${pageNumber} de ${totalPages}`}
          />
        </View>
      </Page>
    </Document>
  )
}

export async function generatePdf(options: PdfOptions): Promise<Buffer> {
  const buffer = await renderToBuffer(<PlanningPdfDocument {...options} />)
  return Buffer.from(buffer)
}

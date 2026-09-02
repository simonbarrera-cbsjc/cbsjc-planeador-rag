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

if (typeof window !== 'undefined') {
  throw new Error('lib/export/pdf.tsx must only be used on the server.')
}

// Disable hyphenation to prevent word break glitches and font lookup issues
Font.registerHyphenationCallback((word) => [word])

// Register standard TrueType fonts from CDN so pdfkit does not seek local .afm files in Lambda
Font.register({
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

interface GeneratePdfParams {
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

interface ParsedPdfBlock {
  type: 'h1' | 'h2' | 'h3' | 'bullet' | 'paragraph' | 'table'
  text?: string
  rows?: string[][]
}

function parseMarkdownToPdfBlocks(content: string): ParsedPdfBlock[] {
  if (!content) return []
  const lines = content.split('\n')
  const blocks: ParsedPdfBlock[] = []
  let tableRows: string[][] = []
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
      const cols = line
        .slice(1, -1)
        .split('|')
        .map((c) => c.trim().replace(/\*\*/g, ''))
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
    } else if (line.startsWith('- ') || line.startsWith('* ') || /^\d+\.\s/.test(line)) {
      const cleanText = line.replace(/^[-*]\s+|\d+\.\s+/, '').replace(/\*\*/g, '')
      blocks.push({ type: 'bullet', text: cleanText })
    } else {
      blocks.push({ type: 'paragraph', text: line.replace(/\*\*/g, '') })
    }
  }

  if (inTable) {
    flushTable()
  }

  return blocks
}

function InstitutionalPdfDocument({ title, content, metadata }: GeneratePdfParams) {
  const blocks = parseMarkdownToPdfBlocks(content)

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header Table */}
        <View style={styles.headerBox}>
          <View style={styles.headerColLeft}>
            <Text style={styles.headerLogoText}>CBSJC</Text>
            <Text style={{ fontFamily: 'Roboto', color: '#FFFFFF', fontSize: 6.5 }}>EST. 2000</Text>
          </View>
          <View style={styles.headerColCenter}>
            <Text style={styles.schoolName}>COLEGIO BILINGÜE SAN JOSÉ CAMPESTRE</Text>
            <Text style={styles.planningTitle}>PLANNING BOOK PRIMARY & SECONDARY</Text>
            <Text style={styles.formatText}>Secuencia Didáctica: Antes — Durante — Después · Formato RGA006</Text>
          </View>
          <View style={styles.headerColRight}>
            <Text style={styles.codeText}>CÓDIGO: SJB-RGA006</Text>
            <Text style={styles.subCodeText}>VERSIÓN: 4 · VIGENCIA: 2026</Text>
          </View>
        </View>

        {/* Identification Metadata Table */}
        <View style={styles.metaTable}>
          <View style={styles.metaRow}>
            <Text style={styles.metaKey}>Docente(s):</Text>
            <Text style={styles.metaVal}>{metadata.authorName || 'Docente Titular CBSJC'}</Text>
          </View>
          <View style={styles.metaRow}>
            <Text style={styles.metaKey}>Área / Asignatura:</Text>
            <Text style={styles.metaVal}>{metadata.area || 'Ciencias Naturales'}</Text>
          </View>
          <View style={styles.metaRow}>
            <Text style={styles.metaKey}>Grado / Periodo:</Text>
            <Text style={styles.metaVal}>
              {metadata.grado || 'Grado 6°'} • Periodo {metadata.periodo || 'I'} (2026)
            </Text>
          </View>
          <View style={[styles.metaRow, { borderBottomWidth: 0 }]}>
            <Text style={styles.metaKey}>Fecha de Emisión:</Text>
            <Text style={styles.metaVal}>{metadata.date}</Text>
          </View>
        </View>

        {/* Content Elements */}
        {blocks.map((block, idx) => {
          if (block.type === 'h1') {
            return (
              <Text key={idx} style={styles.h1}>
                {block.text}
              </Text>
            )
          }
          if (block.type === 'h2') {
            return (
              <Text key={idx} style={styles.h2}>
                {block.text}
              </Text>
            )
          }
          if (block.type === 'h3') {
            return (
              <Text key={idx} style={styles.h3}>
                {block.text}
              </Text>
            )
          }
          if (block.type === 'bullet') {
            return (
              <View key={idx} style={styles.bulletItem}>
                <View style={styles.bulletDot} />
                <Text style={styles.bulletText}>{block.text}</Text>
              </View>
            )
          }
          if (block.type === 'table' && block.rows) {
            const colCount = block.rows[0]?.length || 1
            const cellWidthPercent = `${Math.floor(100 / colCount)}%`

            return (
              <View key={idx} style={styles.table}>
                {block.rows.map((row, rIdx) => {
                  const isHeader = rIdx === 0
                  return (
                    <View
                      key={rIdx}
                      style={[
                        styles.tableRow,
                        isHeader ? styles.tableHeaderRow : { backgroundColor: rIdx % 2 === 1 ? '#FFFFFF' : '#F8FAFC' },
                      ]}
                    >
                      {row.map((col, cIdx) => (
                        <Text
                          key={cIdx}
                          style={[
                            isHeader ? styles.tableHeaderCell : styles.tableCell,
                            { width: cellWidthPercent },
                          ]}
                        >
                          {col}
                        </Text>
                      ))}
                    </View>
                  )
                })}
              </View>
            )
          }
          return (
            <Text key={idx} style={styles.paragraph}>
              {block.text}
            </Text>
          )
        })}

        {/* Institutional Signatures Table */}
        <View style={styles.signaturesBox} wrap={false}>
          <View style={styles.sigHeaderRow}>
            <Text style={styles.sigHeaderCell}>ELABORÓ</Text>
            <Text style={styles.sigHeaderCell}>REVISÓ</Text>
            <Text style={[styles.sigHeaderCell, { borderRightWidth: 0 }]}>APROBÓ</Text>
          </View>
          <View style={styles.sigBodyRow}>
            <View style={styles.sigBodyCell}>
              <Text style={{ marginTop: 12 }}>_____________________________</Text>
              <Text style={{ fontWeight: 700, color: '#0E1B4D', marginTop: 2 }}>
                {metadata.authorName || 'Docente Titular CBSJC'}
              </Text>
              <Text>{metadata.grado || 'Grado 6°'} — Docente de Asignatura</Text>
              <Text>Colegio Bilingüe San José Campestre</Text>
            </View>
            <View style={styles.sigBodyCell}>
              <Text style={{ marginTop: 12 }}>_____________________________</Text>
              <Text style={{ fontWeight: 700, color: '#0E1B4D', marginTop: 2 }}>
                Líder de Área / Coordinación
              </Text>
              <Text>Comité Curricular y Pedagógico</Text>
              <Text>Colegio Bilingüe San José Campestre</Text>
            </View>
            <View style={[styles.sigBodyCell, { borderRightWidth: 0 }]}>
              <Text style={{ marginTop: 12 }}>_____________________________</Text>
              <Text style={{ fontWeight: 700, color: '#0E1B4D', marginTop: 2 }}>
                Coordinación Académica General
              </Text>
              <Text>Rectoría Institucional</Text>
              <Text>Colegio Bilingüe San José Campestre</Text>
            </View>
          </View>
        </View>

        {/* Footer */}
        <View style={styles.footer} fixed>
          <Text>Colegio Bilingüe San José Campestre • Formato Oficial SJB-RGA006</Text>
          <Text render={({ pageNumber, totalPages }) => `Página ${pageNumber} de ${totalPages}`} />
        </View>
      </Page>
    </Document>
  )
}

export async function generatePdf(params: GeneratePdfParams): Promise<Buffer> {
  if (!params.content || params.content.trim().length === 0) {
    throw new Error('generatePdf: document content must not be empty.')
  }
  try {
    const doc = <InstitutionalPdfDocument {...params} />
    const buffer = await renderToBuffer(doc)
    return Buffer.from(buffer)
  } catch (error) {
    console.error('Error generating PDF:', error)
    throw new Error(`PDF generation failed: ${error instanceof Error ? error.message : String(error)}`)
  }
}

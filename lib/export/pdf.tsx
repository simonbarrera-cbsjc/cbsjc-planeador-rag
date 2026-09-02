import 'server-only'
import React from 'react'
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  renderToBuffer,
} from '@react-pdf/renderer'

if (typeof window !== 'undefined') {
  throw new Error('lib/export/pdf.tsx must only be used on the server.')
}

// Create styles for institutional PDF with official CBSJC brand colors
const styles = StyleSheet.create({
  page: {
    paddingTop: 45,
    paddingBottom: 50,
    paddingHorizontal: 50,
    fontSize: 10,
    fontFamily: 'Helvetica',
    color: '#1A1A2E',
    backgroundColor: '#FFFFFF',
    lineHeight: 1.5,
  },
  header: {
    borderBottomWidth: 2,
    borderBottomColor: '#0E1B4D',
    paddingBottom: 12,
    marginBottom: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerLeft: {
    flex: 1,
  },
  schoolName: {
    fontSize: 14,
    fontFamily: 'Helvetica-Bold',
    color: '#0E1B4D',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  schoolSubtitle: {
    fontSize: 8.5,
    color: '#D71921',
    fontFamily: 'Helvetica-Bold',
    marginTop: 2,
  },
  headerBadge: {
    backgroundColor: '#0E1B4D',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 4,
  },
  headerBadgeText: {
    color: '#FFFFFF',
    fontSize: 8,
    fontFamily: 'Helvetica-Bold',
  },
  metaTable: {
    backgroundColor: '#F4F6F9',
    borderRadius: 6,
    padding: 10,
    marginBottom: 18,
    flexDirection: 'row',
    flexWrap: 'wrap',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  metaItem: {
    width: '50%',
    marginBottom: 4,
    flexDirection: 'row',
  },
  metaLabel: {
    fontFamily: 'Helvetica-Bold',
    color: '#0E1B4D',
    fontSize: 8.5,
    width: 80,
  },
  metaValue: {
    color: '#334155',
    fontSize: 8.5,
    flex: 1,
  },
  documentTitle: {
    fontSize: 15,
    fontFamily: 'Helvetica-Bold',
    color: '#0E1B4D',
    marginBottom: 14,
    textAlign: 'center',
  },
  h1: {
    fontSize: 13,
    fontFamily: 'Helvetica-Bold',
    color: '#0E1B4D',
    marginTop: 14,
    marginBottom: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    paddingBottom: 3,
  },
  h2: {
    fontSize: 11,
    fontFamily: 'Helvetica-Bold',
    color: '#0E1B4D',
    marginTop: 10,
    marginBottom: 4,
  },
  h3: {
    fontSize: 10,
    fontFamily: 'Helvetica-Bold',
    color: '#1E293B',
    marginTop: 8,
    marginBottom: 3,
  },
  paragraph: {
    fontSize: 9.5,
    marginBottom: 6,
    textAlign: 'justify',
    lineHeight: 1.45,
  },
  bulletItem: {
    flexDirection: 'row',
    marginBottom: 3,
    paddingLeft: 10,
  },
  bulletDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#D71921',
    marginRight: 6,
    marginTop: 5,
  },
  bulletText: {
    fontSize: 9.5,
    flex: 1,
    lineHeight: 1.4,
  },
  footer: {
    position: 'absolute',
    bottom: 25,
    left: 50,
    right: 50,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    paddingTop: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    fontSize: 7.5,
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

interface ParsedLine {
  type: 'h1' | 'h2' | 'h3' | 'bullet' | 'paragraph'
  text: string
}

function parseMarkdownToPdfLines(content: string): ParsedLine[] {
  if (!content) return []
  const lines = content.split('\n')
  const result: ParsedLine[] = []

  for (const rawLine of lines) {
    const line = rawLine.trim()
    if (!line) continue

    if (line.startsWith('# ')) {
      result.push({ type: 'h1', text: line.substring(2).replace(/\*\*/g, '') })
    } else if (line.startsWith('## ')) {
      result.push({ type: 'h2', text: line.substring(3).replace(/\*\*/g, '') })
    } else if (line.startsWith('### ')) {
      result.push({ type: 'h3', text: line.substring(4).replace(/\*\*/g, '') })
    } else if (line.startsWith('- ') || line.startsWith('* ') || /^\d+\.\s/.test(line)) {
      const cleanText = line.replace(/^[-*]\s+|\d+\.\s+/, '').replace(/\*\*/g, '')
      result.push({ type: 'bullet', text: cleanText })
    } else {
      result.push({ type: 'paragraph', text: line.replace(/\*\*/g, '') })
    }
  }

  return result
}

function InstitutionalPdfDocument({ title, content, documentType, language, metadata }: GeneratePdfParams) {
  const parsedLines = parseMarkdownToPdfLines(content)

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Text style={styles.schoolName}>Colegio Bilingüe San José Campestre</Text>
            <Text style={styles.schoolSubtitle}>Excelencia Académica • Formación Bilingüe • Valores Campestres</Text>
          </View>
          <View style={styles.headerBadge}>
            <Text style={styles.headerBadgeText}>CBSJC OFICIAL</Text>
          </View>
        </View>

        {/* Metadata Table */}
        <View style={styles.metaTable}>
          {metadata.area && (
            <View style={styles.metaItem}>
              <Text style={styles.metaLabel}>Área:</Text>
              <Text style={styles.metaValue}>{metadata.area}</Text>
            </View>
          )}
          {metadata.nivel && (
            <View style={styles.metaItem}>
              <Text style={styles.metaLabel}>Nivel:</Text>
              <Text style={styles.metaValue}>{metadata.nivel}</Text>
            </View>
          )}
          {metadata.grado && (
            <View style={styles.metaItem}>
              <Text style={styles.metaLabel}>Grado:</Text>
              <Text style={styles.metaValue}>{metadata.grado}</Text>
            </View>
          )}
          {metadata.periodo && (
            <View style={styles.metaItem}>
              <Text style={styles.metaLabel}>Periodo:</Text>
              <Text style={styles.metaValue}>Periodo {metadata.periodo}</Text>
            </View>
          )}
          <View style={styles.metaItem}>
            <Text style={styles.metaLabel}>Fecha:</Text>
            <Text style={styles.metaValue}>{metadata.date}</Text>
          </View>
          {metadata.authorName && (
            <View style={styles.metaItem}>
              <Text style={styles.metaLabel}>Elaborado por:</Text>
              <Text style={styles.metaValue}>{metadata.authorName}</Text>
            </View>
          )}
        </View>

        {/* Document Title */}
        <Text style={styles.documentTitle}>{title}</Text>

        {/* Content Body */}
        {parsedLines.map((item, index) => {
          if (item.type === 'h1') {
            return <Text key={index} style={styles.h1}>{item.text}</Text>
          }
          if (item.type === 'h2') {
            return <Text key={index} style={styles.h2}>{item.text}</Text>
          }
          if (item.type === 'h3') {
            return <Text key={index} style={styles.h3}>{item.text}</Text>
          }
          if (item.type === 'bullet') {
            return (
              <View key={index} style={styles.bulletItem}>
                <View style={styles.bulletDot} />
                <Text style={styles.bulletText}>{item.text}</Text>
              </View>
            )
          }
          return <Text key={index} style={styles.paragraph}>{item.text}</Text>
        })}

        {/* Footer */}
        <View style={styles.footer} fixed>
          <Text>Colegio Bilingüe San José Campestre — Sistema de Gestión y Planeación Curricular</Text>
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

export type BlockType =
  | 'h1'
  | 'h2'
  | 'h3'
  | 'h4'
  | 'paragraph'
  | 'bullet'
  | 'number-list'
  | 'table'
  | 'code'
  | 'divider'

export interface TableBlockData {
  headers: string[]
  rows: string[][]
}

export interface DocumentBlock {
  id: string
  type: BlockType
  content: string // text content for headings, paragraphs, lists, code
  tableData?: TableBlockData
  language?: string
}

export interface DocumentPage {
  pageNumber: number
  title: string
  blocks: DocumentBlock[]
}

/**
 * Generates a unique ID for blocks
 */
function uid(): string {
  return 'b_' + Math.random().toString(36).substring(2, 9)
}

/**
 * Parses raw markdown into an array of editable DocumentBlocks
 */
export function parseMarkdownToBlocks(markdown: string): DocumentBlock[] {
  if (!markdown) return []

  const lines = markdown.split('\n')
  const blocks: DocumentBlock[] = []
  let inCodeBlock = false
  let codeBuffer: string[] = []
  let codeLang = ''
  let currentTableRows: string[][] = []

  const flushTable = () => {
    if (currentTableRows.length > 0) {
      const headers = currentTableRows[0] || []
      const rows = currentTableRows.slice(1)
      blocks.push({
        id: uid(),
        type: 'table',
        content: '',
        tableData: {
          headers: headers.map((h) => h.trim()),
          rows: rows.map((r) => r.map((c) => c.trim())),
        },
      })
      currentTableRows = []
    }
  }

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i]
    const line = rawLine.trim()

    // Handle code blocks
    if (line.startsWith('```')) {
      if (inCodeBlock) {
        // Close code block
        blocks.push({
          id: uid(),
          type: 'code',
          content: codeBuffer.join('\n'),
          language: codeLang,
        })
        codeBuffer = []
        codeLang = ''
        inCodeBlock = false
      } else {
        flushTable()
        inCodeBlock = true
        codeLang = line.replace('```', '').trim()
      }
      continue
    }

    if (inCodeBlock) {
      codeBuffer.push(rawLine)
      continue
    }

    // Handle markdown tables
    if (line.startsWith('|') && line.endsWith('|')) {
      // Check if it's a separator line like |---|---|
      if (/^\|[\s\-:|]+\|$/.test(line)) {
        continue
      }
      const cells = line
        .slice(1, -1)
        .split('|')
        .map((c) => c.trim())
      currentTableRows.push(cells)
      continue
    } else {
      flushTable()
    }

    // Blank lines
    if (!line) {
      continue
    }

    // Horizontal rule / divider
    if (line === '---' || line === '***' || line === '___') {
      blocks.push({
        id: uid(),
        type: 'divider',
        content: '',
      })
      continue
    }

    // Headings
    if (line.startsWith('# ')) {
      blocks.push({
        id: uid(),
        type: 'h1',
        content: line.substring(2).trim(),
      })
    } else if (line.startsWith('## ')) {
      blocks.push({
        id: uid(),
        type: 'h2',
        content: line.substring(3).trim(),
      })
    } else if (line.startsWith('### ')) {
      blocks.push({
        id: uid(),
        type: 'h3',
        content: line.substring(4).trim(),
      })
    } else if (line.startsWith('#### ')) {
      blocks.push({
        id: uid(),
        type: 'h4',
        content: line.substring(5).trim(),
      })
    } else if (line.startsWith('- ') || line.startsWith('* ')) {
      blocks.push({
        id: uid(),
        type: 'bullet',
        content: line.replace(/^[-*]\s+/, '').trim(),
      })
    } else if (/^\d+\.\s/.test(line)) {
      blocks.push({
        id: uid(),
        type: 'number-list',
        content: line.replace(/^\d+\.\s+/, '').trim(),
      })
    } else {
      blocks.push({
        id: uid(),
        type: 'paragraph',
        content: line,
      })
    }
  }

  flushTable()

  return blocks
}

/**
 * Serializes DocumentBlocks back to standard Markdown
 */
export function blocksToMarkdown(blocks: DocumentBlock[]): string {
  const parts: string[] = []

  blocks.forEach((block) => {
    switch (block.type) {
      case 'h1':
        parts.push(`# ${block.content}\n`)
        break
      case 'h2':
        parts.push(`## ${block.content}\n`)
        break
      case 'h3':
        parts.push(`### ${block.content}\n`)
        break
      case 'h4':
        parts.push(`#### ${block.content}\n`)
        break
      case 'bullet':
        parts.push(`- ${block.content}`)
        break
      case 'number-list':
        parts.push(`1. ${block.content}`)
        break
      case 'paragraph':
        parts.push(`${block.content}\n`)
        break
      case 'divider':
        parts.push(`---\n`)
        break
      case 'code':
        parts.push(`\`\`\`${block.language || ''}\n${block.content}\n\`\`\`\n`)
        break
      case 'table':
        if (block.tableData && block.tableData.headers.length > 0) {
          const { headers, rows } = block.tableData
          const colCount = Math.max(
            headers.length,
            ...rows.map((r) => r.length)
          )

          // Normalize headers
          const paddedHeaders = [...headers]
          while (paddedHeaders.length < colCount) paddedHeaders.push('')

          const headerLine = `| ${paddedHeaders.map((h) => h || ' ').join(' | ')} |`
          const separatorLine = `| ${paddedHeaders.map(() => '---').join(' | ')} |`
          const rowLines = rows.map((r) => {
            const paddedRow = [...r]
            while (paddedRow.length < colCount) paddedRow.push('')
            return `| ${paddedRow.map((c) => c || ' ').join(' | ')} |`
          })

          parts.push([headerLine, separatorLine, ...rowLines].join('\n') + '\n')
        }
        break
    }
  })

  return parts.join('\n')
}

/**
 * Estimate block content weight to ensure realistic A4 sheet capacity (Word physical pages)
 */
function getBlockWeight(block: DocumentBlock): number {
  if (block.type === 'table' && block.tableData) {
    const rowCount = block.tableData.rows.length
    const cellChars = block.tableData.rows.reduce(
      (acc, r) => acc + r.reduce((a, c) => a + c.length, 0),
      0
    )
    return Math.max(rowCount * 120, cellChars * 0.8)
  }
  if (block.type === 'h1') return 250
  if (block.type === 'h2') return 180
  if (block.type === 'h3') return 120
  if (block.type === 'h4') return 90
  return block.content.length
}

/**
 * Splits blocks into logical A4 pages for paginated Word-like display
 */
export function splitBlocksIntoPages(blocks: DocumentBlock[]): DocumentPage[] {
  if (blocks.length === 0) {
    return [{ pageNumber: 1, title: 'Planeación Curricular', blocks: [] }]
  }

  const pages: DocumentPage[] = []
  let currentBlocks: DocumentBlock[] = []
  let currentPageTitle = '1. Identificación y Referentes'
  let pageNum = 1
  let currentPageWeight = 0
  const MAX_PAGE_WEIGHT = 2200 // Target ~2000-2400 chars/weight per Word A4 sheet

  const finishPage = (nextTitle: string) => {
    if (currentBlocks.length > 0) {
      pages.push({
        pageNumber: pageNum++,
        title: currentPageTitle,
        blocks: [...currentBlocks],
      })
      currentBlocks = []
      currentPageWeight = 0
      currentPageTitle = nextTitle
    }
  }

  for (let i = 0; i < blocks.length; i++) {
    const block = blocks[i]
    const weight = getBlockWeight(block)

    // Explicit breaks on section headings
    if (block.type === 'h2') {
      const content = block.content.toUpperCase()
      if (content.includes('2. ARCO PEDAGÓGICO')) {
        finishPage('2. Arco Pedagógico: Antes y Durante')
      } else if (content.includes('3. PLAN DE EVALUACIÓN')) {
        finishPage('3. Plan de Evaluación Continua')
      } else if (content.includes('4. PILARES')) {
        finishPage('4. Pilares y Competencias')
      } else if (content.includes('5. RÚBRICA GLOBAL')) {
        finishPage('5. Rúbrica Global Menú de Desafíos')
      } else if (content.includes('7. BITÁCORA')) {
        finishPage('7. Bitácora de la Secuencia & Firmas')
      } else if (content.includes('8. ANEXO INSTITUCIONAL')) {
        finishPage('8. Anexos Evaluativos Oficiales')
      }
    } else if (block.type === 'h3') {
      const content = block.content.toUpperCase()
      if (content.includes('DURANTE: SEMANA 3') || content.includes('DESPUÉS: EVIDENCIA')) {
        finishPage('2. Arco Pedagógico: ' + block.content)
      } else if (content.includes('EVALUACIÓN FINAL 1:')) {
        finishPage('Anexo 1: Prueba Escrita 10 Ítems')
      } else if (content.includes('EVALUACIÓN FINAL 2:')) {
        finishPage('Anexo 2: Examen Práctico Laboratorio')
      } else if (content.includes('EVALUACIÓN FINAL 3:')) {
        finishPage('Anexo 3: Sustentación Oral A2 Pitch')
      }
    } else if (block.type === 'divider') {
      finishPage(currentPageTitle)
      continue
    }

    // Weight-based page break to simulate physical A4 pages
    if (currentPageWeight + weight > MAX_PAGE_WEIGHT && currentBlocks.length > 0) {
      finishPage(currentPageTitle)
    }

    currentBlocks.push(block)
    currentPageWeight += weight
  }

  if (currentBlocks.length > 0) {
    pages.push({
      pageNumber: pageNum,
      title: currentPageTitle,
      blocks: currentBlocks,
    })
  }

  return pages.length > 0 ? pages : [{ pageNumber: 1, title: 'Planeación Curricular', blocks }]
}

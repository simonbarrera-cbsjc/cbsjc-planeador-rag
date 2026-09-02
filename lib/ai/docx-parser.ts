import 'server-only'
import mammoth from 'mammoth'

if (typeof window !== 'undefined') {
  throw new Error('lib/ai/docx-parser.ts must only be used on the server.')
}

export interface ExtractedDocxResult {
  text: string
  pageCount: number
}

/**
 * Extracts raw textual content from a Word (.docx) Buffer using mammoth.
 * Cleans excessive spacing and carriage returns for optimal RAG chunking.
 */
export async function extractTextFromDocx(buffer: Buffer): Promise<ExtractedDocxResult> {
  try {
    const result = await mammoth.extractRawText({ buffer })

    const cleanedText = (result.value || '')
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n')
      .replace(/[ \t]+/g, ' ')
      .replace(/\n{3,}/g, '\n\n')
      .trim()

    // Estimate pages based on character density (approx 2500 chars per standard page)
    const estimatedPageCount = Math.max(1, Math.ceil(cleanedText.length / 2500))

    return {
      text: cleanedText,
      pageCount: estimatedPageCount,
    }
  } catch (error) {
    console.error('[DOCX Parser] Error parsing DOCX buffer:', error)
    const msg = error instanceof Error ? error.message : String(error)
    if (msg.includes('Can\'t find end of central directory') || msg.includes('zip') || msg.includes('corrupted')) {
      throw new Error(
        'El archivo Word parece estar dañado o en formato binario antiguo (.doc). Por favor guárdalo como .docx en Microsoft Word antes de subirlo.'
      )
    }
    throw new Error(`Error al procesar documento Word (.docx): ${msg}`)
  }
}


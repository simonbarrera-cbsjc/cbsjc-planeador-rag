import 'server-only'
import { extractTextFromPdf } from './pdf-parser'
import { extractTextFromDocx } from './docx-parser'
import { extractTextFromMd } from './md-parser'

export interface ExtractedFileResult {
  text: string
  filename: string
  format: 'pdf' | 'docx' | 'md'
  pageCount: number
  isOcr?: boolean
}

/**
 * Extracts text from any supported institutional format (PDF, Word DOCX, Markdown, TXT).
 * Automatically chooses the right parser and falls back to OCR for scanned PDF pages.
 */
export async function extractTextFromFile(
  buffer: Buffer,
  filename: string,
  mimeType?: string
): Promise<ExtractedFileResult> {
  if (!buffer || buffer.length === 0) {
    throw new Error(`El archivo "${filename}" está vacío (0 bytes).`)
  }

  const lowerName = (filename || '').trim().toLowerCase()
  const lowerMime = (mimeType || '').trim().toLowerCase()

  // Word Document (.docx / .doc)
  if (
    lowerName.endsWith('.docx') ||
    lowerName.endsWith('.doc') ||
    lowerMime.includes('wordprocessingml') ||
    lowerMime.includes('msword')
  ) {
    const result = await extractTextFromDocx(buffer)
    return {
      text: result.text,
      filename,
      format: 'docx',
      pageCount: result.pageCount,
      isOcr: false,
    }
  }

  // Markdown or plain text (.md / .txt)
  if (
    lowerName.endsWith('.md') ||
    lowerName.endsWith('.txt') ||
    lowerMime.includes('markdown') ||
    lowerMime.includes('text/plain')
  ) {
    const result = await extractTextFromMd(buffer)
    return {
      text: result.text,
      filename,
      format: 'md',
      pageCount: result.pageCount,
      isOcr: false,
    }
  }

  // Default to PDF (with automated OCR fallback for scanned pages)
  const result = await extractTextFromPdf(buffer)
  return {
    text: result.text,
    filename,
    format: 'pdf',
    pageCount: result.pageCount,
    isOcr: result.isOcr ?? false,
  }
}


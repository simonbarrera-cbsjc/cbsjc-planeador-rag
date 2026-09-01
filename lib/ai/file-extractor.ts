import { extractTextFromPdf } from './pdf-parser'
import { extractTextFromDocx } from './docx-parser'
import { extractTextFromMd } from './md-parser'

export interface ExtractedFileResult {
  text: string
  filename: string
  format: 'pdf' | 'docx' | 'md'
  pageCount: number
}

/**
 * Extracts text from any supported institutional format (PDF, DOCX, Markdown).
 * Automatically chooses the right parser and falls back to OCR if needed.
 */
export async function extractTextFromFile(
  buffer: Buffer,
  filename: string
): Promise<ExtractedFileResult> {
  const lowerName = filename.toLowerCase()

  if (lowerName.endsWith('.docx') || lowerName.endsWith('.doc')) {
    const result = await extractTextFromDocx(buffer)
    return {
      text: result.text,
      filename,
      format: 'docx',
      pageCount: result.pageCount,
    }
  }

  if (lowerName.endsWith('.md') || lowerName.endsWith('.txt')) {
    const result = await extractTextFromMd(buffer)
    return {
      text: result.text,
      filename,
      format: 'md',
      pageCount: result.pageCount,
    }
  }

  // Default to PDF
  const result = await extractTextFromPdf(buffer)
  return {
    text: result.text,
    filename,
    format: 'pdf',
    pageCount: result.pageCount,
  }
}

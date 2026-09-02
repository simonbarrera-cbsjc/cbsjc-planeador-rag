import 'server-only'
import pdf from 'pdf-parse'
import { ocrScannedPdfFallback } from './ocr-parser'

export interface ExtractedPdfResult {
  text: string
  pageCount: number
  isOcr?: boolean
  info?: Record<string, unknown>
}

/**
 * Extracts raw textual content from a PDF Buffer.
 * If the PDF is a scanned image (or has no selectable text layer < 50 chars),
 * it automatically triggers Tesseract OCR as a fallback.
 */
export async function extractTextFromPdf(buffer: Buffer): Promise<ExtractedPdfResult> {
  let cleanedText = ''
  let pageCount = 1
  let info: Record<string, unknown> = {}

  try {
    const data = await pdf(buffer)
    cleanedText = (data.text || '')
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n')
      .replace(/[ \t]+/g, ' ')
      .replace(/\n{3,}/g, '\n\n')
      .trim()

    pageCount = data.numpages || 1
    info = (data.info as Record<string, unknown>) || {}
  } catch (pdfParseError) {
    console.warn('[PDF Parser] Direct text extraction failed, trying OCR fallback:', pdfParseError)
  }

  // If text is empty or too short (typical for scanned documents), activate Tesseract OCR fallback
  if (cleanedText.length < 50) {
    console.log('[PDF Parser] PDF contains sparse/no text layer. Activating Tesseract OCR fallback...')
    try {
      const ocrResult = await ocrScannedPdfFallback(buffer)
      if (ocrResult.text && ocrResult.text.length > cleanedText.length) {
        return {
          text: ocrResult.text,
          pageCount: Math.max(pageCount, ocrResult.pagesProcessed || 1),
          isOcr: true,
          info,
        }
      }
    } catch (ocrErr) {
      console.error('[PDF Parser] OCR fallback failed:', ocrErr)
    }
  }

  return {
    text: cleanedText,
    pageCount,
    isOcr: false,
    info,
  }
}

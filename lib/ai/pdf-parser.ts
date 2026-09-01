import pdf from 'pdf-parse'

export interface ExtractedPdfResult {
  text: string
  pageCount: number
  info?: Record<string, unknown>
}

/**
 * Extracts raw textual content from a PDF Buffer.
 * Cleans excessive spacing and carriage returns for better chunking.
 */
export async function extractTextFromPdf(buffer: Buffer): Promise<ExtractedPdfResult> {
  try {
    const data = await pdf(buffer)
    
    // Normalize and clean extracted text
    const cleanedText = data.text
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n')
      .replace(/[ \t]+/g, ' ')
      .replace(/\n{3,}/g, '\n\n')
      .trim()

    return {
      text: cleanedText,
      pageCount: data.numpages || 1,
      info: data.info as Record<string, unknown>,
    }
  } catch (error) {
    console.error('Error parsing PDF buffer:', error)
    throw new Error(`Failed to parse PDF document: ${error instanceof Error ? error.message : String(error)}`)
  }
}

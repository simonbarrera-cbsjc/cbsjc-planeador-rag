import mammoth from 'mammoth'

export interface ExtractedDocxResult {
  text: string
  pageCount: number
}

/**
 * Extracts raw textual content from a Word (.docx) Buffer.
 * Cleans excessive spacing and carriage returns for optimal RAG chunking.
 */
export async function extractTextFromDocx(buffer: Buffer): Promise<ExtractedDocxResult> {
  try {
    const result = await mammoth.extractRawText({ buffer })

    const cleanedText = result.value
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n')
      .replace(/[ \t]+/g, ' ')
      .replace(/\n{3,}/g, '\n\n')
      .trim()

    // Estimate pages based on word/character count (approx 3000 chars per page)
    const estimatedPageCount = Math.max(1, Math.ceil(cleanedText.length / 3000))

    return {
      text: cleanedText,
      pageCount: estimatedPageCount,
    }
  } catch (error) {
    console.error('Error parsing DOCX buffer:', error)
    throw new Error(`Failed to parse DOCX document: ${error instanceof Error ? error.message : String(error)}`)
  }
}

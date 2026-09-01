/**
 * @file lib/ai/md-parser.ts
 * @description Plain text and Markdown (.md) document extractor.
 */

export interface ExtractedMdResult {
  text: string
  pageCount: number
}

/**
 * Extracts clean text from a Markdown (.md) or text buffer.
 */
export async function extractTextFromMd(buffer: Buffer): Promise<ExtractedMdResult> {
  try {
    const rawText = buffer.toString('utf-8')
    const cleanedText = rawText
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n')
      .replace(/[ \t]+/g, ' ')
      .replace(/\n{3,}/g, '\n\n')
      .trim()

    // Estimate pages based on character density (approx 3000 chars per page)
    const estimatedPages = Math.max(1, Math.ceil(cleanedText.length / 3000))

    return {
      text: cleanedText,
      pageCount: estimatedPages,
    }
  } catch (error) {
    console.error('Error parsing Markdown buffer:', error)
    throw new Error(`Error al leer archivo Markdown: ${error instanceof Error ? error.message : String(error)}`)
  }
}

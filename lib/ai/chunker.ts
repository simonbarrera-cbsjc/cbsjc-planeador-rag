/**
 * Text chunking utility for RAG ingestion.
 * Splits documents into overlapping chunks suitable for embedding.
 */

import 'server-only'

/** Simple token count estimate: 1 token ≈ 4 characters. */
export function estimateTokens(text: string): number {
  if (!text) return 0
  return Math.ceil(text.trim().length / 4)
}

/**
 * Splits `text` into overlapping chunks of approximately `chunkSize` tokens.
 *
 * Strategy (in order of preference):
 *  1. Split on paragraph boundaries (double newline).
 *  2. Split on sentence boundaries (`. `, `! `, `? `).
 *  3. Hard-split at the character limit.
 *
 * Consecutive chunks overlap by `overlap` tokens so context is not lost
 * at chunk boundaries.
 *
 * @param text       - Raw input text.
 * @param chunkSize  - Target chunk size in tokens (default 1 000).
 * @param overlap    - Overlap between consecutive chunks in tokens (default 200).
 * @returns Array of chunk strings, each at least 50 characters long (or full text if shorter).
 */
export function chunkText(
  text: string,
  chunkSize = 1000,
  overlap = 200,
): string[] {
  if (!text || text.trim().length === 0) return []

  // Protect against invalid or extreme parameters
  const effectiveChunkSize = Math.max(chunkSize, 10)
  const effectiveOverlap = Math.min(Math.max(0, overlap), Math.floor(effectiveChunkSize / 2))

  const chunkChars = effectiveChunkSize * 4   // tokens -> chars
  const overlapChars = effectiveOverlap * 4   // tokens -> chars

  // Step 1: coarse split on paragraph boundaries
  const paragraphs = text
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter((p) => p.length > 0)

  const chunks: string[] = []
  let buffer = ''

  const flushBuffer = () => {
    const trimmed = buffer.trim()
    if (trimmed.length >= 50 || (chunks.length === 0 && trimmed.length > 0)) {
      chunks.push(trimmed)
    }
    buffer = ''
  }

  for (const para of paragraphs) {
    // If adding this paragraph keeps us within the chunk size, accumulate.
    if ((buffer + '\n\n' + para).length <= chunkChars) {
      buffer = buffer ? buffer + '\n\n' + para : para
      continue
    }

    // The paragraph itself fits in one chunk - flush current buffer first.
    if (para.length <= chunkChars) {
      if (buffer) {
        // Carry over overlap from the current buffer into the next chunk.
        const overlapText = buffer.slice(-overlapChars)
        flushBuffer()
        buffer = overlapText ? overlapText + '\n\n' + para : para
      } else {
        buffer = para
      }
      continue
    }

    // Step 2: paragraph is too large - split on sentences
    if (buffer) {
      const overlapText = buffer.slice(-overlapChars)
      flushBuffer()
      buffer = overlapText || ''
    }

    const sentences = splitOnSentences(para)
    for (const sentence of sentences) {
      if ((buffer + ' ' + sentence).length <= chunkChars) {
        buffer = buffer ? buffer + ' ' + sentence : sentence
      } else if (sentence.length <= chunkChars) {
        const overlapText = buffer.slice(-overlapChars)
        flushBuffer()
        buffer = overlapText ? overlapText + ' ' + sentence : sentence
      } else {
        // Step 3: sentence itself is too long - hard split
        if (buffer) {
          const overlapText = buffer.slice(-overlapChars)
          flushBuffer()
          buffer = overlapText || ''
        }
        const hardChunks = hardSplit(sentence, chunkChars, overlapChars)
        for (let i = 0; i < hardChunks.length - 1; i++) {
          const hardTrimmed = hardChunks[i].trim()
          if (hardTrimmed.length >= 50 || (chunks.length === 0 && hardTrimmed.length > 0)) {
            chunks.push(hardTrimmed)
          }
        }
        // Keep the last hard chunk in buffer so it can accumulate more text.
        buffer = hardChunks[hardChunks.length - 1] ?? ''
      }
    }
  }

  // Flush whatever remains.
  flushBuffer()

  // Final guarantee: if text was provided, never return empty array
  if (chunks.length === 0 && text.trim().length > 0) {
    chunks.push(text.trim())
  }

  return chunks
}

// Internal helpers

/** Split text on sentence-ending punctuation while preserving the delimiter. */
function splitOnSentences(text: string): string[] {
  const raw = text.split(/(?<=[.!?])\s+/)
  return raw.map((s) => s.trim()).filter((s) => s.length > 0)
}

/**
 * Hard-split `text` into segments of at most `maxChars` characters,
 * carrying `overlapChars` from the previous segment into the next.
 */
function hardSplit(
  text: string,
  maxChars: number,
  overlapChars: number,
): string[] {
  const result: string[] = []
  let start = 0
  const step = Math.max(maxChars - overlapChars, 1)

  while (start < text.length) {
    const end = Math.min(start + maxChars, text.length)
    result.push(text.slice(start, end))
    start += step
  }

  return result
}

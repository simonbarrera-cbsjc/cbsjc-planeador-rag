export function chunkText(text, chunkSize = 1000, overlap = 200) {
  if (!text || text.trim().length === 0) return []
  const effectiveChunkSize = Math.max(chunkSize, 10)
  const effectiveOverlap = Math.min(Math.max(0, overlap), Math.floor(effectiveChunkSize / 2))
  const chunkChars = effectiveChunkSize * 4
  const overlapChars = effectiveOverlap * 4

  const paragraphs = text
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter((p) => p.length > 0)

  const chunks = []
  let buffer = ''

  const flushBuffer = () => {
    const trimmed = buffer.trim()
    if (trimmed.length >= 50 || (chunks.length === 0 && trimmed.length > 0)) {
      chunks.push(trimmed)
    }
    buffer = ''
  }

  for (const para of paragraphs) {
    if ((buffer + '\n\n' + para).length <= chunkChars) {
      buffer = buffer ? buffer + '\n\n' + para : para
      continue
    }

    if (para.length <= chunkChars) {
      if (buffer) {
        const overlapText = buffer.slice(-overlapChars)
        flushBuffer()
        buffer = overlapText ? overlapText + '\n\n' + para : para
      } else {
        buffer = para
      }
      continue
    }

    if (buffer) {
      const overlapText = buffer.slice(-overlapChars)
      flushBuffer()
      buffer = overlapText || ''
    }

    const sentences = para.split(/(?<=[.!?])\s+/).map((s) => s.trim()).filter((s) => s.length > 0)
    for (const sentence of sentences) {
      if ((buffer + ' ' + sentence).length <= chunkChars) {
        buffer = buffer ? buffer + ' ' + sentence : sentence
      } else if (sentence.length <= chunkChars) {
        const overlapText = buffer.slice(-overlapChars)
        flushBuffer()
        buffer = overlapText ? overlapText + ' ' + sentence : sentence
      } else {
        if (buffer) {
          const overlapText = buffer.slice(-overlapChars)
          flushBuffer()
          buffer = overlapText || ''
        }
        let start = 0
        const step = Math.max(chunkChars - overlapChars, 1)
        while (start < sentence.length) {
          const end = Math.min(start + chunkChars, sentence.length)
          const hardChunk = sentence.slice(start, end).trim()
          if (hardChunk.length >= 50) chunks.push(hardChunk)
          start += step
        }
      }
    }
  }

  flushBuffer()
  if (chunks.length === 0 && text.trim().length > 0) {
    chunks.push(text.trim())
  }
  return chunks
}

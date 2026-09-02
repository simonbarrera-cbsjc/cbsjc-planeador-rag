import 'server-only'
import { createWorker } from 'tesseract.js'

if (typeof window !== 'undefined') {
  throw new Error('lib/ai/ocr-parser.ts must only be used on the server.')
}

export interface OcrResult {
  text: string
  confidence: number
}

/**
 * Performs OCR text recognition on an image buffer using Tesseract.js.
 * Supports Spanish ('spa') and English ('eng') for bilingual documents.
 */
export async function performOcr(
  imageBuffer: Buffer,
  languages: string = 'spa+eng'
): Promise<OcrResult> {
  let worker = null
  try {
    worker = await createWorker(languages)
    const result = await worker.recognize(imageBuffer)

    const cleanedText = (result.data?.text || '')
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n')
      .replace(/[ \t]+/g, ' ')
      .replace(/\n{3,}/g, '\n\n')
      .trim()

    return {
      text: cleanedText,
      confidence: result.data?.confidence || 0,
    }
  } catch (error) {
    console.error('[OCR Engine] Error performing OCR:', error)
    throw new Error(`Error en el motor OCR Tesseract: ${error instanceof Error ? error.message : String(error)}`)
  } finally {
    if (worker) {
      try {
        await worker.terminate()
      } catch (err) {
        console.warn('[OCR Engine] Worker termination error:', err)
      }
    }
  }
}

/**
 * Scans a PDF buffer for embedded scanned image streams (JPEG / PNG blocks commonly produced by document scanners).
 */
export function extractEmbeddedImagesFromPdf(pdfBuffer: Buffer): Buffer[] {
  const images: Buffer[] = []

  // 1. Search for JPEG streams: starts with 0xFFD8 and ends with 0xFFD9
  let offset = 0
  while (offset < pdfBuffer.length - 4) {
    const startIdx = pdfBuffer.indexOf(Buffer.from([0xff, 0xd8, 0xff]), offset)
    if (startIdx === -1) break

    const endIdx = pdfBuffer.indexOf(Buffer.from([0xff, 0xd9]), startIdx + 3)
    if (endIdx === -1) break

    const jpegBuffer = pdfBuffer.subarray(startIdx, endIdx + 2)
    // Only keep reasonable image sizes (> 10 KB to ignore tiny icons/artifacts)
    if (jpegBuffer.length > 10 * 1024) {
      images.push(Buffer.from(jpegBuffer))
    }

    offset = endIdx + 2
  }

  // 2. Search for PNG streams: starts with 0x89504E470D0A1A0A
  offset = 0
  const pngHeader = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
  const pngIEnd = Buffer.from('IEND')
  while (offset < pdfBuffer.length - 8) {
    const startIdx = pdfBuffer.indexOf(pngHeader, offset)
    if (startIdx === -1) break

    const endIdx = pdfBuffer.indexOf(pngIEnd, startIdx + 8)
    if (endIdx === -1) break

    const pngBuffer = pdfBuffer.subarray(startIdx, endIdx + 8)
    if (pngBuffer.length > 10 * 1024) {
      images.push(Buffer.from(pngBuffer))
    }

    offset = endIdx + 8
  }

  return images
}

/**
 * OCR Fallback for Scanned PDFs:
 * Extracts scanned images from the PDF and runs Tesseract OCR.
 */
export async function ocrScannedPdfFallback(pdfBuffer: Buffer): Promise<{ text: string; pagesProcessed: number }> {
  const embeddedImages = extractEmbeddedImagesFromPdf(pdfBuffer)

  if (embeddedImages.length === 0) {
    console.log('[OCR Engine] No discrete JPEG/PNG image streams found in PDF for OCR extraction.')
    return { text: '', pagesProcessed: 0 }
  }

  const recognizedPages: string[] = []

  // Limit processing to first 10 scanned pages to avoid excessive server execution times
  const maxPagesToProcess = Math.min(embeddedImages.length, 10)

  for (let i = 0; i < maxPagesToProcess; i++) {
    try {
      const pageResult = await performOcr(embeddedImages[i], 'spa+eng')
      if (pageResult.text && pageResult.text.trim().length > 10) {
        recognizedPages.push(pageResult.text.trim())
      }
    } catch (err) {
      console.warn(`[OCR Engine] Error processing scanned page ${i + 1}:`, err)
    }
  }

  const combinedText = recognizedPages.join('\n\n--- [Página Escaneada] ---\n\n').trim()

  return {
    text: combinedText,
    pagesProcessed: recognizedPages.length,
  }
}


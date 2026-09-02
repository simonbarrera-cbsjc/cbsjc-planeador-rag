/**
 * Google AI Studio embeddings via text-embedding-004.
 * Produces 768-dimensional vectors suitable for pgvector similarity search.
 */

import 'server-only'
import { GoogleGenerativeAI } from '@google/generative-ai'

// Constants

const EMBEDDING_MODELS = ['gemini-embedding-001', 'gemini-embedding-2']
const MAX_INPUT_CHARS = 2000
const BATCH_SIZE = 20
const BATCH_DELAY_MS = 100
const MAX_RETRIES = 3

// Lazy client initialisation

function getClient(): GoogleGenerativeAI {
  const apiKey = process.env.GOOGLE_AI_API_KEY || process.env.GEMINI_API_KEY
  if (!apiKey) {
    throw new Error(
      'Missing environment variable: GOOGLE_AI_API_KEY or GEMINI_API_KEY. ' +
        'Set it in your .env.local file.',
    )
  }
  return new GoogleGenerativeAI(apiKey)
}

// Internal retry helper

async function embedWithRetry(text: string, attempt = 1): Promise<number[]> {
  const client = getClient()
  let lastError: unknown = null

  for (const modelName of EMBEDDING_MODELS) {
    try {
      const model = client.getGenerativeModel({ model: modelName })
      const result = await model.embedContent(text)

      const values = result.embedding?.values
      if (values && values.length > 0) {
        return values
      }
    } catch (err: unknown) {
      lastError = err
    }
  }

  const message = lastError instanceof Error ? lastError.message : String(lastError)
  const isRateLimitOrTransient =
    message.includes('429') ||
    message.includes('RESOURCE_EXHAUSTED') ||
    message.includes('503') ||
    message.includes('overloaded') ||
    message.includes('fetch failed')

  if (isRateLimitOrTransient && attempt < MAX_RETRIES) {
    const backoffMs = Math.pow(2, attempt) * 500
    console.warn(`[embeddings] Transient error (attempt ${attempt}/${MAX_RETRIES}): ${message}. Retrying in ${backoffMs}ms...`)
    await delay(backoffMs)
    return embedWithRetry(text, attempt + 1)
  }

  throw new Error(`generateEmbedding failed: ${message}`)
}

// Public API

/**
 * Generate a single 768-dimensional embedding for `text`.
 *
 * @param text - Input string. Truncated to 2 000 chars before embedding.
 * @returns Float array of length 768.
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  if (!text || text.trim().length === 0) {
    throw new Error('generateEmbedding: input text must not be empty.')
  }

  const truncated = text.trim().slice(0, MAX_INPUT_CHARS)
  return embedWithRetry(truncated)
}

/**
 * Generate embeddings for a batch of texts.
 *
 * Texts are processed in groups of {@link BATCH_SIZE} with a short delay
 * between groups to respect Google AI rate limits.
 *
 * @param texts - Array of input strings.
 * @returns Array of 768-dimensional float arrays, in the same order as `texts`.
 */
export async function generateEmbeddings(
  texts: string[],
): Promise<number[][]> {
  if (texts.length === 0) return []

  const results: number[][] = []

  for (let i = 0; i < texts.length; i += BATCH_SIZE) {
    const batch = texts.slice(i, i + BATCH_SIZE)

    // Process each item in the batch concurrently.
    const batchResults = await Promise.all(
      batch.map(async (text, idx) => {
        const cleaned = text?.trim() || ''
        if (cleaned.length === 0) {
          // Fallback zero vector for empty chunk if encountered
          return new Array(768).fill(0)
        }
        try {
          return await generateEmbedding(cleaned)
        } catch (err) {
          console.error(`[embeddings] Error embedding chunk ${i + idx}:`, err)
          throw err
        }
      }),
    )

    results.push(...batchResults)

    // Pause between batches (but not after the last one).
    if (i + BATCH_SIZE < texts.length) {
      await delay(BATCH_DELAY_MS)
    }
  }

  return results
}

// Internal helpers

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

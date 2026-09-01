/**
 * Google AI Studio embeddings via text-embedding-004.
 * Produces 768-dimensional vectors suitable for pgvector similarity search.
 */

import { GoogleGenerativeAI } from '@google/generative-ai';

// Constants

const EMBEDDING_MODEL = 'text-embedding-004';
const MAX_INPUT_CHARS = 2000;
const BATCH_SIZE = 20;
const BATCH_DELAY_MS = 100;

// Lazy client initialisation

function getClient(): GoogleGenerativeAI {
  const apiKey = process.env.GOOGLE_AI_API_KEY;
  if (!apiKey) {
    throw new Error(
      'Missing environment variable: GOOGLE_AI_API_KEY. ' +
        'Set it in your .env.local file.',
    );
  }
  return new GoogleGenerativeAI(apiKey);
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
    throw new Error('generateEmbedding: input text must not be empty.');
  }

  const truncated = text.slice(0, MAX_INPUT_CHARS);

  try {
    const client = getClient();
    const model = client.getGenerativeModel({ model: EMBEDDING_MODEL });
    const result = await model.embedContent(truncated);

    const values = result.embedding?.values;
    if (!values || values.length === 0) {
      throw new Error(
        'generateEmbedding: API returned an empty embedding vector.',
      );
    }

    return values;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(`generateEmbedding failed: ${message}`);
  }
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
  if (texts.length === 0) return [];

  const results: number[][] = [];

  for (let i = 0; i < texts.length; i += BATCH_SIZE) {
    const batch = texts.slice(i, i + BATCH_SIZE);

    // Process each item in the batch concurrently.
    const batchResults = await Promise.all(
      batch.map((text) => generateEmbedding(text)),
    );

    results.push(...batchResults);

    // Pause between batches (but not after the last one).
    if (i + BATCH_SIZE < texts.length) {
      await delay(BATCH_DELAY_MS);
    }
  }

  return results;
}

// Internal helpers

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

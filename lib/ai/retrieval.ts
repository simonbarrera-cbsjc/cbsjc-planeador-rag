/**
 * RAG retrieval logic.
 * Converts a natural-language query into an embedding and searches the
 * `chunks` table via the `match_chunks` Postgres function.
 */

import { supabaseAdmin } from '@/lib/supabase/admin'
import { generateEmbedding } from './embeddings'

export interface RetrievedChunk {
  id: string
  source_doc_id: string
  content: string
  metadata: Record<string, unknown>
  similarity: number
}

export interface RetrievalOptions {
  /** Number of chunks to return (default: 10). */
  matchCount?: number
  /** Minimum cosine similarity threshold (default: 0.65). */
  matchThreshold?: number
  /** Filter by curricular area slug. */
  filterArea?: string
  /** Filter by document category slug. */
  filterCategory?: string
}

export async function retrieveRelevantChunks(
  query: string,
  options: RetrievalOptions = {}
): Promise<RetrievedChunk[]> {
  const {
    matchCount = 10,
    matchThreshold = 0.65,
    filterArea,
    filterCategory,
  } = options

  if (!query || query.trim().length === 0) {
    return []
  }

  // 1. Embed the query
  let embedding: number[]
  try {
    embedding = await generateEmbedding(query)
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error(`[retrieval] Failed to embed query: ${message}`)
    return []
  }

  // 2. Call Supabase RPC
  try {
    const { data, error } = await supabaseAdmin.rpc('match_chunks', {
      query_embedding: embedding,
      match_count: matchCount,
      match_threshold: matchThreshold,
      filter_area: filterArea || undefined,
      filter_category: filterCategory || undefined,
    })

    if (error) {
      console.error('[retrieval] match_chunks RPC error:', error.message)
      return []
    }

    if (!data || !Array.isArray(data)) {
      return []
    }

    return data as RetrievedChunk[]
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error(`[retrieval] Unexpected error calling match_chunks: ${message}`)
    return []
  }
}

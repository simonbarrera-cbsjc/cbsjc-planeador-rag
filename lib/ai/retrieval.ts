/**
 * RAG retrieval logic.
 * Converts a natural-language query into an embedding and searches the
 * `chunks` table via the `match_chunks` Postgres function with multi-tier fallback.
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
  /** Minimum desired chunks before attempting fallback relaxation (default: 3). */
  minChunksDesired?: number
}

async function executeMatchRpc(
  embedding: number[],
  matchCount: number,
  matchThreshold: number,
  filterArea?: string,
  filterCategory?: string,
): Promise<RetrievedChunk[]> {
  try {
    const { data, error } = await supabaseAdmin.rpc('match_chunks', {
      query_embedding: embedding,
      match_count: matchCount,
      match_threshold: matchThreshold,
      filter_area: filterArea || undefined,
      filter_category: filterCategory || undefined,
    })

    if (error) {
      console.warn('[retrieval] match_chunks RPC notice:', error.message)
      return []
    }

    if (!data || !Array.isArray(data)) {
      return []
    }

    return data as RetrievedChunk[]
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.warn(`[retrieval] Error calling match_chunks: ${message}`)
    return []
  }
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
    minChunksDesired = 3,
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
    console.warn(`[retrieval] Failed to embed query: ${message}`)
    return []
  }

  // 2. Primary retrieval with provided filters and threshold
  const primaryResults = await executeMatchRpc(
    embedding,
    matchCount,
    matchThreshold,
    filterArea,
    filterCategory
  )

  // If sufficient results found, return them directly
  if (primaryResults.length >= minChunksDesired) {
    return primaryResults
  }

  // 3. Fallback Tier 1: If filters were applied and few chunks found, relax filters
  // (to allow general institutional documents like PEI, SIEE, and DBA to surface)
  const combinedResults = [...primaryResults]
  const existingIds = new Set(primaryResults.map((c) => c.id))

  if (filterArea || filterCategory) {
    const relaxedThreshold = Math.max(0.4, matchThreshold - 0.2)
    const generalResults = await executeMatchRpc(
      embedding,
      matchCount,
      relaxedThreshold,
      undefined, // remove area filter
      undefined  // remove category filter
    )

    for (const chunk of generalResults) {
      if (!existingIds.has(chunk.id)) {
        existingIds.add(chunk.id)
        combinedResults.push(chunk)
      }
    }
  }

  // 4. Fallback Tier 2: If still fewer than minChunksDesired, try relaxed threshold globally
  if (combinedResults.length < minChunksDesired) {
    const fallbackThreshold = 0.3
    const broadResults = await executeMatchRpc(
      embedding,
      matchCount,
      fallbackThreshold,
      undefined,
      undefined
    )

    for (const chunk of broadResults) {
      if (!existingIds.has(chunk.id)) {
        existingIds.add(chunk.id)
        combinedResults.push(chunk)
      }
    }
  }

  // Sort by similarity descending and cap at matchCount
  combinedResults.sort((a, b) => b.similarity - a.similarity)
  return combinedResults.slice(0, matchCount)
}

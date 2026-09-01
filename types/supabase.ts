/**
 * @file types/supabase.ts
 * @description Supabase Database generic type definition for the CBSJC Planeador RAG system.
 *
 * This type is consumed by the Supabase client factory:
 * ```ts
 * import { createClient } from '@supabase/supabase-js'
 * import type { Database } from '@/types/supabase'
 *
 * const supabase = createClient<Database>(url, key)
 * ```
 *
 * Keep in sync with migrations in supabase/migrations/.
 * Run `supabase gen types typescript --linked` to regenerate from a live project.
 */

import type {
  DocumentArea,
  DocumentCategory,
  DocumentType,
  GeneratedDocumentStatus,
  Language,
  Periodo,
  SourceDocumentStatus,
} from './index'

// ---------------------------------------------------------------------------
// Re-usable column shapes (Row / Insert / Update triads)
// ---------------------------------------------------------------------------

// -- profiles ----------------------------------------------------------------

type ProfileRow = {
  id: string
  email?: string
  full_name: string | null
  avatar_url?: string | null
  role: 'teacher' | 'coordinator' | 'admin'
  language: Language
  created_at: string
  updated_at: string
}

type ProfileInsert = {
  /** Must match an existing auth.users.id */
  id: string
  email?: string
  full_name?: string | null
  avatar_url?: string | null
  role?: 'teacher' | 'coordinator' | 'admin'
  language?: Language
  created_at?: string
  updated_at?: string
}

type ProfileUpdate = Partial<Omit<ProfileInsert, 'id'>>

// -- source_documents --------------------------------------------------------

type SourceDocumentRow = {
  id: string
  user_id: string
  title: string
  description: string | null
  category: DocumentCategory
  area: DocumentArea
  storage_path: string
  file_type: string
  file_size: number
  status: SourceDocumentStatus
  chunk_count: number | null
  error_message: string | null
  metadata: Record<string, unknown>
  created_at: string
  updated_at: string
}

type SourceDocumentInsert = {
  id?: string
  user_id: string
  title: string
  description?: string | null
  category: DocumentCategory
  area: DocumentArea
  storage_path: string
  file_type: string
  file_size: number
  status?: SourceDocumentStatus
  chunk_count?: number | null
  error_message?: string | null
  metadata?: Record<string, unknown>
  created_at?: string
  updated_at?: string
}

type SourceDocumentUpdate = Partial<
  Omit<SourceDocumentInsert, 'id' | 'user_id' | 'created_at'>
>

// -- document_chunks ---------------------------------------------------------

type DocumentChunkRow = {
  id: string
  source_doc_id: string
  content: string
  /**
   * The pgvector column is returned as a number[] by PostgREST.
   * Null until the embedding job completes.
   */
  embedding: number[] | null
  chunk_index: number
  metadata: Record<string, unknown>
  created_at: string
}

type DocumentChunkInsert = {
  id?: string
  source_doc_id: string
  content: string
  embedding?: number[] | null
  chunk_index: number
  metadata?: Record<string, unknown>
  created_at?: string
}

type DocumentChunkUpdate = Partial<
  Pick<DocumentChunkInsert, 'embedding' | 'metadata'>
>

// -- generated_documents -----------------------------------------------------

type GeneratedDocumentRow = {
  id: string
  user_id: string
  title: string
  document_type: DocumentType
  nivel: DocumentCategory
  area: DocumentArea
  grado: string | null
  periodo: Periodo | null
  content: string
  additional_instructions: string | null
  sources_used: number
  status: GeneratedDocumentStatus
  pdf_storage_path: string | null
  docx_storage_path: string | null
  gdocs_url: string | null
  language: Language
  created_at: string
  updated_at: string
}

type GeneratedDocumentInsert = {
  id?: string
  user_id: string
  title: string
  document_type: DocumentType
  nivel: DocumentCategory
  area: DocumentArea
  grado?: string | null
  periodo?: Periodo | null
  content: string
  additional_instructions?: string | null
  sources_used?: number
  status?: GeneratedDocumentStatus
  pdf_storage_path?: string | null
  docx_storage_path?: string | null
  gdocs_url?: string | null
  language?: Language
  created_at?: string
  updated_at?: string
}

type GeneratedDocumentUpdate = Partial<
  Omit<GeneratedDocumentInsert, 'id' | 'user_id' | 'created_at'>
>

// ---------------------------------------------------------------------------
// RPC function argument / return types
// ---------------------------------------------------------------------------

/**
 * Arguments accepted by the match_chunks Postgres function.
 * The function performs an approximate nearest-neighbour search using pgvector.
 */
type MatchChunksArgs = {
  /** Query vector produced by text-embedding-004 (1536 dimensions) */
  query_embedding: number[]
  /** Minimum cosine similarity score to include (default 0.7) */
  match_threshold?: number
  /** Maximum number of chunks to return (default 5) */
  match_count?: number
  /** Optional DocumentArea filter applied before vector search */
  filter_area?: string
  /** Optional DocumentCategory filter applied before vector search */
  filter_category?: string
}

/** Single row returned by the match_chunks RPC. */
type MatchChunksRow = {
  id: string
  source_doc_id: string
  content: string
  metadata: Record<string, unknown>
  /** Cosine similarity in [0, 1]; higher = more relevant */
  similarity: number
}

// ---------------------------------------------------------------------------
// Database root type
// ---------------------------------------------------------------------------

/**
 * Full Supabase Database type used to parameterise the typed client:
 *
 * ```ts
 * createClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY)
 * ```
 *
 * Keep in sync with migrations in supabase/migrations/.
 */
export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: ProfileRow
        Insert: ProfileInsert
        Update: ProfileUpdate
        /** No foreign key relationships declared here; handled via RLS. */
        Relationships: []
      }
      source_documents: {
        Row: SourceDocumentRow
        Insert: SourceDocumentInsert
        Update: SourceDocumentUpdate
        Relationships: [
          {
            foreignKeyName: 'source_documents_user_id_fkey'
            columns: ['user_id']
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
        ]
      }
      document_chunks: {
        Row: DocumentChunkRow
        Insert: DocumentChunkInsert
        Update: DocumentChunkUpdate
        Relationships: [
          {
            foreignKeyName: 'document_chunks_source_doc_id_fkey'
            columns: ['source_doc_id']
            referencedRelation: 'source_documents'
            referencedColumns: ['id']
          },
        ]
      }
      generated_documents: {
        Row: GeneratedDocumentRow
        Insert: GeneratedDocumentInsert
        Update: GeneratedDocumentUpdate
        Relationships: [
          {
            foreignKeyName: 'generated_documents_user_id_fkey'
            columns: ['user_id']
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
        ]
      }
    }
    Views: Record<string, never>
    Functions: {
      /**
       * Semantic similarity search over document_chunks.
       * Uses the `embedding <=> query_embedding` cosine-distance operator
       * from the pgvector extension.
       *
       * @example
       * ```ts
       * const { data } = await supabase
       *   .rpc('match_chunks', {
       *     query_embedding: embeddingVector,
       *     match_threshold: 0.72,
       *     match_count: 6,
       *     filter_area: 'matematicas',
       *   })
       * ```
       */
      match_chunks: {
        Args: MatchChunksArgs
        Returns: MatchChunksRow[]
      }
    }
    Enums: Record<string, never>
    CompositeTypes: Record<string, never>
  }
}

// ---------------------------------------------------------------------------
// Convenience type aliases (re-exported for external consumers)
// ---------------------------------------------------------------------------

/** Strongly-typed Row shape for a given table. */
export type Tables<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Row']

/** Strongly-typed Insert shape for a given table. */
export type TablesInsert<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Insert']

/** Strongly-typed Update shape for a given table. */
export type TablesUpdate<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Update']

/** Strongly-typed Args + Returns for a given RPC function. */
export type Functions<T extends keyof Database['public']['Functions']> =
  Database['public']['Functions'][T]

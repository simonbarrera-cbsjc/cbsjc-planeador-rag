/**
 * @file types/index.ts
 * @description Central TypeScript type definitions for the CBSJC Planeador RAG system.
 *
 * Covers:
 *  - Database row types (mirroring Supabase tables)
 *  - Enum-like string literal union types
 *  - API request / response shapes
 *  - UI / form helper types
 */

// ---------------------------------------------------------------------------
// Enum-like string literal types
// ---------------------------------------------------------------------------

/** Educational level / grade band at CBSJC. */
export type DocumentCategory =
  | 'primaria'
  | 'secundaria'
  | 'bachillerato'
  | 'general'

/** Academic subject area. */
export type DocumentArea =
  | 'matematicas'
  | 'ciencias'
  | 'humanidades'
  | 'ingles'
  | 'sociales'
  | 'artes'
  | 'educacion_fisica'
  | 'tecnologia'
  | 'religion'
  | 'general'

/** Type of institutional document to be generated. */
export type DocumentType =
  | 'planeador'
  | 'plan_area'
  | 'informe'
  | 'circular'
  | 'proyecto_pedagogico'

/** Supported output / UI language. */
export type Language = 'es' | 'en'

/** Processing status of a source document uploaded for embedding. */
export type SourceDocumentStatus = 'pending' | 'processing' | 'ready' | 'error'

/** Lifecycle status of an AI-generated document. */
export type GeneratedDocumentStatus =
  | 'generated'
  | 'exported_pdf'
  | 'exported_docx'
  | 'exported_gdocs'

/** Academic period (quarter) within the school year. */
export type Periodo = 'I' | 'II' | 'III' | 'IV'

// ---------------------------------------------------------------------------
// Database row types (matching Supabase table columns)
// ---------------------------------------------------------------------------

/**
 * A user profile record, extended from Supabase auth.users.
 * Created automatically via database trigger on sign-up.
 */
export type Profile = {
  /** UUID — matches auth.users.id */
  id: string
  /** Email address */
  email?: string
  /** Display name (e.g. teacher full name) */
  full_name: string | null
  /** User avatar URL from Google OAuth */
  avatar_url?: string | null
  /** Role within the institution */
  role: 'teacher' | 'coordinator' | 'admin'
  /** Preferred UI language */
  language: Language
  /** ISO 8601 timestamp */
  created_at: string
  /** ISO 8601 timestamp */
  updated_at: string
}

/**
 * A source document uploaded by a user that will be chunked and embedded
 * into the pgvector store for RAG retrieval.
 */
export type SourceDocument = {
  /** UUID primary key */
  id: string
  /** FK -> profiles.id — document owner */
  user_id: string
  /** Human-readable document title */
  title: string
  /** Optional free-text description */
  description: string | null
  /** Educational level this document belongs to */
  category: DocumentCategory
  /** Subject area this document covers */
  area: DocumentArea
  /** Supabase Storage object path */
  storage_path: string
  /** MIME type of the uploaded file */
  file_type: string
  /** File size in bytes */
  file_size: number
  /** Current processing / embedding status */
  status: SourceDocumentStatus
  /** Number of chunks generated after embedding (null until processed) */
  chunk_count: number | null
  /** Error message if status === 'error' */
  error_message: string | null
  /** Arbitrary key/value metadata (e.g. grade, period, author) */
  metadata: Record<string, unknown>
  /** ISO 8601 timestamp */
  created_at: string
  /** ISO 8601 timestamp */
  updated_at: string
}

/**
 * A single semantic chunk derived from a SourceDocument.
 * Stores the raw text plus its pgvector embedding for similarity search.
 */
export type DocumentChunk = {
  /** UUID primary key */
  id: string
  /** FK -> source_documents.id */
  source_doc_id: string
  /** Plain-text content of this chunk */
  content: string
  /**
   * text-embedding-004 vector (1536 dimensions).
   * Represented as a number array in application code;
   * stored as vector in Postgres.
   */
  embedding: number[] | null
  /**
   * Sequential index of this chunk within its source document
   * (0-based, used for ordering and overlap calculation).
   */
  chunk_index: number
  /** Inherited metadata from parent SourceDocument for fast filtering */
  metadata: Record<string, unknown>
  /** ISO 8601 timestamp */
  created_at: string
}

/**
 * An AI-generated institutional document produced by the RAG pipeline.
 * Stores the full HTML/Markdown content and export metadata.
 */
export type GeneratedDocument = {
  /** UUID primary key */
  id: string
  /** FK -> profiles.id — generating user */
  user_id: string
  /** Document title provided at generation time */
  title: string
  /** Type of institutional document */
  document_type: DocumentType
  /** Educational level the document targets */
  nivel: DocumentCategory
  /** Subject area the document addresses */
  area: DocumentArea
  /** Specific grade (e.g. "3", "10") — nullable for general docs */
  grado: string | null
  /** Academic period — nullable for non-period docs */
  periodo: Periodo | null
  /** Full generated content (rich Markdown / HTML) */
  content: string
  /** Additional user instructions supplied at generation time */
  additional_instructions: string | null
  /** Number of source chunks retrieved and used during generation */
  sources_used: number
  /** Current lifecycle status */
  status: GeneratedDocumentStatus
  /** Supabase Storage path for exported PDF (null if not yet exported) */
  pdf_storage_path: string | null
  /** Supabase Storage path for exported DOCX (null if not yet exported) */
  docx_storage_path: string | null
  /** Google Docs URL if exported to Google Docs (null if not yet exported) */
  gdocs_url: string | null
  /** Language used during generation */
  language: Language
  /** ISO 8601 timestamp */
  created_at: string
  /** ISO 8601 timestamp */
  updated_at: string
}

// ---------------------------------------------------------------------------
// API request / response types
// ---------------------------------------------------------------------------

// -- Embedding ---------------------------------------------------------------

/** Body sent to POST /api/embed */
export type EmbedDocumentRequest = {
  /** ID of the SourceDocument to chunk and embed */
  sourceDocId: string
}

/** Response from POST /api/embed */
export type EmbedDocumentResponse = {
  success: boolean
  /** Total number of chunks created and embedded */
  chunkCount: number
  /** Present only when success === false */
  error?: string
}

// -- Generation --------------------------------------------------------------

/** Body sent to POST /api/generate */
export type GenerateDocumentRequest = {
  /** What kind of document to produce */
  documentType: DocumentType
  /** Output language for the generated content */
  language: Language
  /** Target educational level */
  nivel: DocumentCategory
  /** Target subject area */
  area: DocumentArea
  /** Specific grade, e.g. "5" (optional) */
  grado?: string
  /** Academic period (optional) */
  periodo?: Periodo
  /** Free-form additional instructions for the LLM */
  additionalInstructions?: string
  /** Document title */
  title: string
}

/** Response from POST /api/generate */
export type GenerateDocumentResponse = {
  success: boolean
  /** ID of the newly persisted GeneratedDocument */
  documentId?: string
  /** Full generated content */
  content?: string
  /** Number of source chunks used during generation */
  sourcesUsed?: number
  /** Present only when success === false */
  error?: string
}

// -- Export ------------------------------------------------------------------

/** Supported export formats */
export type ExportFormat = 'pdf' | 'docx' | 'gdocs'

/** Body sent to POST /api/export */
export type ExportRequest = {
  /** ID of the GeneratedDocument to export */
  documentId: string
  /** Desired export format */
  format: ExportFormat
}

/** Response from POST /api/export */
export type ExportResponse = {
  success: boolean
  /**
   * Signed Supabase Storage URL for direct download.
   * Present for 'pdf' and 'docx' formats.
   */
  downloadUrl?: string
  /**
   * Public Google Docs URL.
   * Present for 'gdocs' format.
   */
  gdocsUrl?: string
  /** Present only when success === false */
  error?: string
}

// -- Source documents list ---------------------------------------------------

/** Response from GET /api/source-documents */
export type ListSourceDocumentsResponse = {
  success: boolean
  documents: SourceDocument[]
  error?: string
}

/** Response from DELETE /api/source-documents/[id] */
export type DeleteSourceDocumentResponse = {
  success: boolean
  error?: string
}

// -- Generated documents list ------------------------------------------------

/** Response from GET /api/generated-documents */
export type ListGeneratedDocumentsResponse = {
  success: boolean
  documents: GeneratedDocument[]
  error?: string
}

// ---------------------------------------------------------------------------
// UI / form helper types
// ---------------------------------------------------------------------------

/**
 * A chunk returned by the match_chunks RPC, enriched with a similarity
 * score for display in the "sources used" panel.
 */
export type MatchedChunk = {
  id: string
  source_doc_id: string
  content: string
  metadata: Record<string, unknown>
  /** Cosine similarity score in [0, 1] */
  similarity: number
}

/**
 * Values managed by the document generation form.
 * Mirrors GenerateDocumentRequest so it can be passed directly to the API.
 */
export type DocumentFormValues = GenerateDocumentRequest

/**
 * Sidebar navigation item shape.
 */
export type NavItem = {
  label: string
  href: string
  /** lucide-react icon component name (string key, resolved at runtime) */
  icon: string
  /** Whether this item is only visible to admins/coordinators */
  adminOnly?: boolean
}

/**
 * Toast / notification severity levels.
 */
export type AlertSeverity = 'info' | 'success' | 'warning' | 'error'

/**
 * Generic paginated API response wrapper.
 */
export type PaginatedResponse<T> = {
  data: T[]
  total: number
  page: number
  pageSize: number
  hasNextPage: boolean
}

/**
 * Upload progress event shape emitted by the file upload component.
 */
export type UploadProgress = {
  fileName: string
  /** Progress percentage in [0, 100] */
  percent: number
  status: 'uploading' | 'processing' | 'done' | 'error'
  error?: string
}

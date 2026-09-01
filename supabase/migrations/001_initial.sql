-- =============================================================================
-- CBSJC Planeador RAG — Initial Migration
-- 001_initial.sql
-- Created: 2026-09-01
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 0. Extensions
-- -----------------------------------------------------------------------------

CREATE EXTENSION IF NOT EXISTS vector;

-- -----------------------------------------------------------------------------
-- 1. TABLE: profiles
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.profiles (
  id          uuid        PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  email       text        NOT NULL,
  full_name   text,
  avatar_url  text,
  role        text        NOT NULL DEFAULT 'teacher' CHECK (role IN ('teacher', 'coordinator', 'admin')),
  language    text        NOT NULL DEFAULT 'es' CHECK (language IN ('es', 'en')),
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

-- -----------------------------------------------------------------------------
-- 2. TABLE: source_documents
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.source_documents (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid        NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  title         text        NOT NULL,
  description   text,
  category      text        NOT NULL CHECK (category IN (
                              'primaria', 'secundaria', 'bachillerato', 'general'
                            )),
  area          text        CHECK (area IN (
                              'matematicas', 'ciencias', 'humanidades', 'ingles',
                              'sociales', 'artes', 'educacion_fisica', 'tecnologia',
                              'religion', 'general'
                            )),
  storage_path  text        NOT NULL,
  file_type     text        NOT NULL DEFAULT 'application/pdf',
  file_size     bigint      NOT NULL DEFAULT 0,
  status        text        NOT NULL DEFAULT 'pending' CHECK (status IN (
                              'pending', 'processing', 'ready', 'error'
                            )),
  error_message text,
  chunk_count   integer     DEFAULT 0,
  metadata      jsonb       NOT NULL DEFAULT '{}'::jsonb,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

-- -----------------------------------------------------------------------------
-- 3. TABLE: document_chunks
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.document_chunks (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  source_doc_id uuid        NOT NULL REFERENCES public.source_documents (id) ON DELETE CASCADE,
  content       text        NOT NULL,
  embedding     vector(768),          -- Google text-embedding-004 → 768 dimensions
  chunk_index   integer     NOT NULL,
  page_number   integer,
  metadata      jsonb       NOT NULL DEFAULT '{}'::jsonb,
  created_at    timestamptz NOT NULL DEFAULT now()
);

-- -----------------------------------------------------------------------------
-- 4. TABLE: generated_documents
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.generated_documents (
  id                      uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                 uuid        NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  title                   text        NOT NULL,
  document_type           text        NOT NULL CHECK (document_type IN (
                                    'planeador', 'plan_area', 'informe', 'circular', 'proyecto_pedagogico'
                                  )),
  language                text        NOT NULL DEFAULT 'es' CHECK (language IN ('es', 'en')),
  nivel                   text        CHECK (nivel IN (
                                    'primaria', 'secundaria', 'bachillerato', 'general'
                                  )),
  area                    text,
  grado                   text,
  periodo                 text        CHECK (periodo IN ('I', 'II', 'III', 'IV')),
  parameters              jsonb       NOT NULL DEFAULT '{}'::jsonb,
  content                 text        NOT NULL,
  additional_instructions text,
  sources_used            integer     NOT NULL DEFAULT 0,
  source_chunks           jsonb       NOT NULL DEFAULT '[]'::jsonb,
  status                  text        NOT NULL DEFAULT 'generated' CHECK (status IN (
                                    'generated', 'exported_pdf', 'exported_docx', 'exported_gdocs'
                                  )),
  pdf_storage_path        text,
  docx_storage_path       text,
  gdocs_url               text,
  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now()
);

-- -----------------------------------------------------------------------------
-- 5. INDEXES
-- -----------------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_document_chunks_source_doc_id
  ON public.document_chunks (source_doc_id);

CREATE INDEX IF NOT EXISTS idx_source_documents_user_id_status
  ON public.source_documents (user_id, status);

CREATE INDEX IF NOT EXISTS idx_generated_documents_user_id_created_at
  ON public.generated_documents (user_id, created_at DESC);

-- -----------------------------------------------------------------------------
-- 6. FUNCTION: match_chunks — cosine-similarity RAG retrieval
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.match_chunks(
  query_embedding  vector(768),
  match_threshold  float   DEFAULT 0.5,
  match_count      int     DEFAULT 10,
  filter_area      text    DEFAULT NULL,
  filter_category  text    DEFAULT NULL
)
RETURNS TABLE (
  id            uuid,
  source_doc_id uuid,
  content       text,
  metadata      jsonb,
  similarity    float
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    dc.id,
    dc.source_doc_id,
    dc.content,
    dc.metadata,
    (1 - (dc.embedding <=> query_embedding))::float AS similarity
  FROM public.document_chunks dc
  INNER JOIN public.source_documents sd
    ON sd.id = dc.source_doc_id
  WHERE
    sd.status = 'ready'
    AND dc.embedding IS NOT NULL
    AND (1 - (dc.embedding <=> query_embedding)) >= match_threshold
    AND (filter_area     IS NULL OR sd.area     = filter_area)
    AND (filter_category IS NULL OR sd.category = filter_category)
  ORDER BY similarity DESC
  LIMIT match_count;
END;
$$;

-- -----------------------------------------------------------------------------
-- 7. ROW LEVEL SECURITY
-- -----------------------------------------------------------------------------

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "profiles: select own"
  ON public.profiles FOR SELECT TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "profiles: update own"
  ON public.profiles FOR UPDATE TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

ALTER TABLE public.source_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "source_documents: select all authenticated"
  ON public.source_documents FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "source_documents: insert own"
  ON public.source_documents FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "source_documents: update own"
  ON public.source_documents FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "source_documents: delete own"
  ON public.source_documents FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

ALTER TABLE public.document_chunks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "document_chunks: select all authenticated"
  ON public.document_chunks FOR SELECT TO authenticated
  USING (true);

ALTER TABLE public.generated_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "generated_documents: select own"
  ON public.generated_documents FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "generated_documents: insert own"
  ON public.generated_documents FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "generated_documents: update own"
  ON public.generated_documents FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "generated_documents: delete own"
  ON public.generated_documents FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- -----------------------------------------------------------------------------
-- 8. TRIGGER: auto-create profile on user signup
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, avatar_url)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', ''),
    COALESCE(NEW.raw_user_meta_data ->> 'avatar_url', NULL)
  )
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- -----------------------------------------------------------------------------
-- 9. updated_at auto-maintenance trigger
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_profiles_updated_at            ON public.profiles;
DROP TRIGGER IF EXISTS trg_source_documents_updated_at    ON public.source_documents;
DROP TRIGGER IF EXISTS trg_generated_documents_updated_at ON public.generated_documents;

CREATE TRIGGER trg_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_source_documents_updated_at
  BEFORE UPDATE ON public.source_documents
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_generated_documents_updated_at
  BEFORE UPDATE ON public.generated_documents
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

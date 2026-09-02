-- =============================================================================
-- CBSJC Planeador RAG — Security Hardening Migration
-- 002_security_hardening.sql
-- Created: 2026-09-01
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. SEARCH PATH ISOLATION & FUNCTION HARDENING
-- -----------------------------------------------------------------------------

-- Fix search_path on set_updated_at function
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Fix search_path on handle_new_user function
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
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

-- -----------------------------------------------------------------------------
-- 2. ROLE ESCALATION PREVENTION TRIGGER ON PROFILES
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.prevent_profile_role_escalation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  -- If role is being changed, verify caller is admin or service_role
  IF NEW.role IS DISTINCT FROM OLD.role THEN
    IF auth.uid() IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    ) THEN
      RAISE EXCEPTION 'No tienes permisos para modificar el rol de usuario.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_profile_role_escalation ON public.profiles;

CREATE TRIGGER trg_prevent_profile_role_escalation
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_profile_role_escalation();

-- -----------------------------------------------------------------------------
-- 3. HARDENED MATCH_CHUNKS WITH MULTI-TENANCY & PARAMETER SANITIZATION
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.match_chunks(
  query_embedding       vector(768),
  match_threshold       float   DEFAULT 0.5,
  match_count           int     DEFAULT 10,
  filter_area           text    DEFAULT NULL,
  filter_category       text    DEFAULT NULL,
  filter_user_id        uuid    DEFAULT NULL,
  filter_source_doc_id  uuid    DEFAULT NULL
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
SET search_path = public, extensions, pg_temp
AS $$
DECLARE
  v_match_count int;
  v_threshold   float;
BEGIN
  -- Defensive check: query embedding must not be null
  IF query_embedding IS NULL THEN
    RETURN;
  END IF;

  -- Bound match_count between 1 and 100 to prevent DoS / memory exhaustion
  v_match_count := LEAST(GREATEST(COALESCE(match_count, 10), 1), 100);

  -- Clamp match_threshold to [0.0, 1.0]
  v_threshold := LEAST(GREATEST(COALESCE(match_threshold, 0.5), 0.0), 1.0);

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
    AND (1 - (dc.embedding <=> query_embedding)) >= v_threshold
    AND (filter_area           IS NULL OR sd.area          = filter_area)
    AND (filter_category       IS NULL OR sd.category      = filter_category)
    AND (filter_user_id        IS NULL OR sd.user_id       = filter_user_id)
    AND (filter_source_doc_id  IS NULL OR sd.id            = filter_source_doc_id)
  ORDER BY similarity DESC
  LIMIT v_match_count;
END;
$$;

-- Revoke public execution privileges and grant only to authenticated and service_role
REVOKE ALL ON FUNCTION public.match_chunks FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.match_chunks TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.handle_new_user FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.handle_new_user TO service_role;

REVOKE ALL ON FUNCTION public.prevent_profile_role_escalation FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.prevent_profile_role_escalation TO authenticated, service_role;

-- -----------------------------------------------------------------------------
-- 4. ROW LEVEL SECURITY (RLS) POLICIES ENHANCEMENT
-- -----------------------------------------------------------------------------

-- Ensure RLS is active on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.source_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_chunks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.generated_documents ENABLE ROW LEVEL SECURITY;

-- profiles: allow authenticated insert for own profile (e.g. initial setup)
DROP POLICY IF EXISTS "profiles: insert own" ON public.profiles;
CREATE POLICY "profiles: insert own"
  ON public.profiles FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = id);

-- profiles: allow delete own profile
DROP POLICY IF EXISTS "profiles: delete own" ON public.profiles;
CREATE POLICY "profiles: delete own"
  ON public.profiles FOR DELETE TO authenticated
  USING (auth.uid() = id);

-- document_chunks: scoped RLS policies
DROP POLICY IF EXISTS "document_chunks: select all authenticated" ON public.document_chunks;
DROP POLICY IF EXISTS "document_chunks: select accessible" ON public.document_chunks;
CREATE POLICY "document_chunks: select accessible"
  ON public.document_chunks FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.source_documents sd
      WHERE sd.id = document_chunks.source_doc_id
    )
  );

DROP POLICY IF EXISTS "document_chunks: insert own source" ON public.document_chunks;
CREATE POLICY "document_chunks: insert own source"
  ON public.document_chunks FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.source_documents sd
      WHERE sd.id = document_chunks.source_doc_id
        AND sd.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "document_chunks: update own source" ON public.document_chunks;
CREATE POLICY "document_chunks: update own source"
  ON public.document_chunks FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.source_documents sd
      WHERE sd.id = document_chunks.source_doc_id
        AND sd.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.source_documents sd
      WHERE sd.id = document_chunks.source_doc_id
        AND sd.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "document_chunks: delete own source" ON public.document_chunks;
CREATE POLICY "document_chunks: delete own source"
  ON public.document_chunks FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.source_documents sd
      WHERE sd.id = document_chunks.source_doc_id
        AND sd.user_id = auth.uid()
    )
  );

-- -----------------------------------------------------------------------------
-- 5. VECTOR INDEX (HNSW) FOR HIGH-PERFORMANCE COSINE SIMILARITY
-- -----------------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_document_chunks_embedding_hnsw
  ON public.document_chunks
  USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

-- -----------------------------------------------------------------------------
-- 6. STORAGE BUCKET & STORAGE RLS POLICIES
-- -----------------------------------------------------------------------------

INSERT INTO storage.buckets (id, name, public)
VALUES ('source-documents', 'source-documents', false)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public)
VALUES ('generated-exports', 'generated-exports', false)
ON CONFLICT (id) DO NOTHING;

-- Storage object policies for source-documents
DROP POLICY IF EXISTS "source_documents_bucket: authenticated select" ON storage.objects;
CREATE POLICY "source_documents_bucket: authenticated select"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'source-documents');

DROP POLICY IF EXISTS "source_documents_bucket: authenticated insert own" ON storage.objects;
CREATE POLICY "source_documents_bucket: authenticated insert own"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'source-documents'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "source_documents_bucket: authenticated delete own" ON storage.objects;
CREATE POLICY "source_documents_bucket: authenticated delete own"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'source-documents'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Storage object policies for generated-exports
DROP POLICY IF EXISTS "generated_exports_bucket: authenticated select own" ON storage.objects;
CREATE POLICY "generated_exports_bucket: authenticated select own"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'generated-exports'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "generated_exports_bucket: authenticated insert own" ON storage.objects;
CREATE POLICY "generated_exports_bucket: authenticated insert own"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'generated-exports'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "generated_exports_bucket: authenticated delete own" ON storage.objects;
CREATE POLICY "generated_exports_bucket: authenticated delete own"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'generated-exports'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );


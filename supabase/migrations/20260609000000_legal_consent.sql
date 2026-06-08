-- ============================================================================
-- Versioned legal consent: legal_documents (catalog) + user_consents (audit).
-- Follows the project convention (20260608000000_profiles_role.sql):
-- SECURITY DEFINER ... SET search_path = public, REVOKE ... GRANT EXECUTE.
-- ============================================================================

-- ── Catalog of legal-document versions ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.legal_documents (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  doc_type       text NOT NULL CHECK (doc_type IN ('terms','privacy','coach_terms')),
  version        text NOT NULL,                       -- semantic, e.g. '2026-06-09'
  locale         text NOT NULL DEFAULT 'he',
  effective_date timestamptz NOT NULL,
  content_url    text,                                -- nullable: body lives in repo
  content_hash   text NOT NULL,                       -- sha256 of the accepted text
  is_published   boolean NOT NULL DEFAULT false,
  created_at     timestamptz NOT NULL DEFAULT now(),
  UNIQUE (doc_type, version, locale)
);

-- ── Append-only audit trail of acceptances ──────────────────────────────────
CREATE TABLE IF NOT EXISTS public.user_consents (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  doc_type      text NOT NULL CHECK (doc_type IN ('terms','privacy','coach_terms')),
  version       text NOT NULL,
  locale        text NOT NULL DEFAULT 'he',
  content_hash  text NOT NULL,                        -- snapshot of what was shown
  accepted_at   timestamptz NOT NULL DEFAULT now(),
  is_minor      boolean NOT NULL DEFAULT false,
  guardian_acknowledged boolean NOT NULL DEFAULT false,
  user_agent    text,
  UNIQUE (user_id, doc_type, version)                 -- append-only / idempotent
);
CREATE INDEX IF NOT EXISTS user_consents_user_doc_idx
  ON public.user_consents (user_id, doc_type, accepted_at DESC);

-- ── RLS ─────────────────────────────────────────────────────────────────────
ALTER TABLE public.legal_documents ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS legal_read ON public.legal_documents;
CREATE POLICY legal_read ON public.legal_documents
  FOR SELECT TO authenticated, anon USING (is_published = true);
-- No client INSERT/UPDATE/DELETE: managed via migrations / service role only.

ALTER TABLE public.user_consents ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS consent_owner_read ON public.user_consents;
CREATE POLICY consent_owner_read ON public.user_consents
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
-- Writes ONLY through record_consent() RPC (no direct INSERT/UPDATE/DELETE policy).

-- ── RPC: current effective versions + what the caller already accepted ───────
CREATE OR REPLACE FUNCTION public.current_legal_versions(_locale text DEFAULT 'he')
RETURNS TABLE (doc_type text, current_version text, content_hash text,
               effective_date timestamptz, accepted_version text, needs_consent boolean)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH current AS (
    SELECT DISTINCT ON (d.doc_type) d.doc_type, d.version, d.content_hash, d.effective_date
    FROM public.legal_documents d
    WHERE d.is_published AND d.locale = _locale AND d.effective_date <= now()
    ORDER BY d.doc_type, d.effective_date DESC
  )
  SELECT c.doc_type, c.version, c.content_hash, c.effective_date,
         uc.version AS accepted_version,
         (uc.version IS NULL OR uc.version <> c.version) AS needs_consent
  FROM current c
  LEFT JOIN public.user_consents uc
    ON uc.user_id = auth.uid() AND uc.doc_type = c.doc_type AND uc.version = c.version;
$$;

-- ── RPC: append-only consent write (idempotent on (user,doc,version)) ────────
CREATE OR REPLACE FUNCTION public.record_consent(
  _doc_type text, _version text, _locale text DEFAULT 'he',
  _is_minor boolean DEFAULT false, _guardian_ack boolean DEFAULT false)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid := auth.uid(); h text;
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'unauthenticated' USING ERRCODE = 'insufficient_privilege';
  END IF;
  SELECT content_hash INTO h FROM public.legal_documents
    WHERE doc_type = _doc_type AND version = _version AND locale = _locale AND is_published;
  IF h IS NULL THEN
    RAISE EXCEPTION 'unknown_legal_version' USING ERRCODE = 'check_violation';
  END IF;
  INSERT INTO public.user_consents(user_id, doc_type, version, locale, content_hash,
                                   is_minor, guardian_acknowledged)
  VALUES (uid, _doc_type, _version, _locale, h, _is_minor, _guardian_ack)
  ON CONFLICT (user_id, doc_type, version) DO NOTHING;  -- audit immutable
END; $$;

REVOKE ALL ON FUNCTION public.record_consent(text,text,text,boolean,boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_consent(text,text,text,boolean,boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_legal_versions(text) TO authenticated, anon;

-- ============================================================================
-- Seed v1 of the legal documents (terms / privacy / coach_terms, he).
-- content_hash is a version fingerprint = sha256('<doc_type>|<version>')
-- computed server-side via pgcrypto, so no local build step is required.
-- The full document body lives in src/content/legal/legalDocs.ts (code-reviewed)
-- and is rendered by the public /legal/* pages.
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

INSERT INTO public.legal_documents (doc_type, version, locale, effective_date, content_hash, is_published)
VALUES
  ('terms',       '2026-06-09', 'he', now(), encode(digest('terms|2026-06-09', 'sha256'), 'hex'),       true),
  ('privacy',     '2026-06-09', 'he', now(), encode(digest('privacy|2026-06-09', 'sha256'), 'hex'),     true),
  ('coach_terms', '2026-06-09', 'he', now(), encode(digest('coach_terms|2026-06-09', 'sha256'), 'hex'), true)
ON CONFLICT (doc_type, version, locale) DO NOTHING;

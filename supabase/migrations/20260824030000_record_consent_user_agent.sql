-- ============================================================================
-- record_consent: populate user_consents.user_agent server-side (2026-08-24)
--
-- Why: the column exists (20260609000000) and the privacy audit trail implies
-- "which client produced this consent", but nothing ever wrote it — the schema
-- asserted evidence that did not exist. The request's User-Agent header is the
-- honest source, read inside the SECURITY DEFINER function via
-- current_setting('request.headers', true), so the client cannot forge it.
--
-- Also drops _is_minor/_guardian_ack from the signature: no caller ever set
-- them truthfully (100% of rows asserted "no minor consented") and the server
-- already knows the age answer from user_age_verification — client-supplied
-- minor flags are worthless as evidence. The columns keep their defaults.
--
-- Idempotent; keeps the same RPC name so existing clients keep working. The
-- extra parameter is optional with a default, so old call sites are valid too.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.record_consent(
  _doc_type text, _version text, _locale text DEFAULT 'he',
  _is_minor boolean DEFAULT false, _guardian_ack boolean DEFAULT false)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid := auth.uid(); h text; ua text;
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'unauthenticated' USING ERRCODE = 'insufficient_privilege';
  END IF;
  SELECT content_hash INTO h FROM public.legal_documents
    WHERE doc_type = _doc_type AND version = _version AND locale = _locale AND is_published;
  IF h IS NULL THEN
    RAISE EXCEPTION 'unknown_legal_version' USING ERRCODE = 'check_violation';
  END IF;
  -- Server-side evidence: the caller's real User-Agent from the PostgREST
  -- request headers (never client-supplied JSON).
  ua := current_setting('request.headers', true)::json->>'user_agent';
  INSERT INTO public.user_consents(user_id, doc_type, version, locale, content_hash,
                                   user_agent, is_minor, guardian_acknowledged)
  VALUES (uid, _doc_type, _version, _locale, h, ua,
          COALESCE(_is_minor, false), COALESCE(_guardian_ack, false))
  ON CONFLICT (user_id, doc_type, version) DO NOTHING;  -- audit immutable
END; $$;

REVOKE ALL ON FUNCTION public.record_consent(text,text,text,boolean,boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_consent(text,text,text,boolean,boolean) TO authenticated;

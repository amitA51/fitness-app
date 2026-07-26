-- ============================================================================
-- ATOMIC RATE LIMITING
-- ============================================================================
-- Every edge function currently rate-limits with a read-then-insert pair:
--
--     insert into rate_limit_events ...        -- or after the count, depending
--     select count(*) from rate_limit_events   -- ... where created_at > window
--     if count > limit then reject
--
-- Two problems, both exploitable:
--
--   1. NOT ATOMIC. N concurrent requests all run their SELECT before any INSERT
--      is visible, so they all observe a below-limit count and all proceed. The
--      quota is per-round-trip, not per-window — which is precisely what an
--      attacker exploits to burn AI provider budget or brute-force invite codes.
--
--   2. ERRORS LOOK LIKE ZERO. `const { count } = await admin.from(...)` ignores
--      the accompanying `error`, and PostgREST returns `count: null` on failure.
--      `(count ?? 0) > limit` is then false, so a database or RLS problem reads
--      as "no usage yet" and opens the gate.
--
-- This function does the whole decision in ONE transaction, serialised per
-- (bucket, subject) with a transaction-scoped advisory lock, and returns a plain
-- boolean. A caller that gets an error instead of a boolean must fail CLOSED —
-- there is no ambiguous middle value to misread.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.consume_rate_limit(
  p_bucket         text,
  p_subject        text,
  p_window_seconds integer,
  p_max_events     integer
)
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_count integer;
BEGIN
  IF p_bucket IS NULL OR p_subject IS NULL THEN
    RAISE EXCEPTION 'consume_rate_limit requires a bucket and a subject';
  END IF;
  IF p_window_seconds IS NULL OR p_window_seconds <= 0
     OR p_max_events IS NULL OR p_max_events < 0 THEN
    RAISE EXCEPTION 'consume_rate_limit requires a positive window and a non-negative max';
  END IF;

  -- Serialise concurrent callers for this exact bucket+subject. Transaction
  -- scoped, so it is released automatically — including on error.
  PERFORM pg_advisory_xact_lock(hashtextextended(p_bucket || ':' || p_subject, 0));

  SELECT count(*) INTO v_count
  FROM public.rate_limit_events
  WHERE bucket = p_bucket
    AND subject = p_subject
    AND created_at > now() - make_interval(secs => p_window_seconds);

  IF v_count >= p_max_events THEN
    RETURN false;
  END IF;

  INSERT INTO public.rate_limit_events (bucket, subject) VALUES (p_bucket, p_subject);
  RETURN true;
END;
$$;

-- Service role only: these functions run from Edge Functions, never the browser.
-- A client that could call this would be able to burn another user's quota.
REVOKE ALL ON FUNCTION public.consume_rate_limit(text, text, integer, integer)
  FROM PUBLIC, anon, authenticated;

COMMENT ON FUNCTION public.consume_rate_limit(text, text, integer, integer) IS
  'Atomic rate-limit decision. Returns true when the event was recorded and the caller may proceed, false when the window is exhausted. Callers must fail CLOSED on error.';

-- Housekeeping: the ledger grows forever otherwise. Callers only ever look at a
-- recent window, so anything older than a day is dead weight.
CREATE OR REPLACE FUNCTION public.prune_rate_limit_events(p_older_than interval DEFAULT interval '1 day')
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_deleted integer;
BEGIN
  DELETE FROM public.rate_limit_events WHERE created_at < now() - p_older_than;
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted;
END;
$$;

REVOKE ALL ON FUNCTION public.prune_rate_limit_events(interval) FROM PUBLIC, anon, authenticated;

-- The lookup every call performs.
CREATE INDEX IF NOT EXISTS rate_limit_events_bucket_subject_created_idx
  ON public.rate_limit_events (bucket, subject, created_at DESC);

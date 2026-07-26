-- ============================================================================
-- consume_rate_limit behaviour test
-- ============================================================================
-- Covers 20260726130000_rate_limit_atomic.sql:
--   * the Nth call within the window is allowed, the (N+1)th is not
--   * buckets and subjects are independent
--   * events outside the window do not count
--   * invalid arguments raise instead of silently allowing
--   * the function is not callable by anon/authenticated
--   * prune_rate_limit_events removes only old rows
--
-- Prerequisites:
--   psql -f supabase/tests/fixtures/supabase_min_stub.sql
--   psql -f supabase/migrations/20260726130000_rate_limit_atomic.sql
--   psql -f supabase/tests/rate_limit_test.sql
--
-- Expected final line: "consume_rate_limit: ALL ASSERTIONS PASSED".
-- ============================================================================

BEGIN;

DO $$
DECLARE
  v_ok      boolean;
  v_count   integer;
  v_pruned  integer;
  v_raised  boolean;
BEGIN
  -- ── Within the window: exactly `max` calls succeed ───────────────────────
  FOR v_count IN 1..3 LOOP
    SELECT public.consume_rate_limit('test_bucket', 'user-a', 60, 3) INTO v_ok;
    ASSERT v_ok, format('call %s of 3 was denied', v_count);
  END LOOP;

  SELECT public.consume_rate_limit('test_bucket', 'user-a', 60, 3) INTO v_ok;
  ASSERT NOT v_ok, 'the 4th call within the window was allowed';

  -- The denied call must NOT have added a row (otherwise a hammering client
  -- would inflate the ledger without bound).
  SELECT count(*) INTO v_count FROM public.rate_limit_events
  WHERE bucket = 'test_bucket' AND subject = 'user-a';
  ASSERT v_count = 3, format('expected 3 ledger rows, found %s', v_count);

  -- ── Subjects are independent ─────────────────────────────────────────────
  SELECT public.consume_rate_limit('test_bucket', 'user-b', 60, 3) INTO v_ok;
  ASSERT v_ok, 'a different subject was blocked by another subject usage';

  -- ── Buckets are independent ──────────────────────────────────────────────
  SELECT public.consume_rate_limit('other_bucket', 'user-a', 60, 3) INTO v_ok;
  ASSERT v_ok, 'a different bucket was blocked by another bucket usage';

  -- ── Events outside the window do not count ───────────────────────────────
  UPDATE public.rate_limit_events
     SET created_at = now() - interval '2 hours'
   WHERE bucket = 'test_bucket' AND subject = 'user-a';

  SELECT public.consume_rate_limit('test_bucket', 'user-a', 60, 3) INTO v_ok;
  ASSERT v_ok, 'expired events still counted against the quota';

  -- ── A zero maximum denies everything (usable as a kill switch) ───────────
  SELECT public.consume_rate_limit('kill_switch', 'user-a', 60, 0) INTO v_ok;
  ASSERT NOT v_ok, 'a max of 0 still allowed a call';

  -- ── Invalid arguments RAISE, so a caller can never read them as "allowed" ─
  v_raised := false;
  BEGIN
    PERFORM public.consume_rate_limit('b', 's', 0, 5);
  EXCEPTION WHEN others THEN v_raised := true;
  END;
  ASSERT v_raised, 'a non-positive window did not raise';

  v_raised := false;
  BEGIN
    PERFORM public.consume_rate_limit(NULL, 's', 60, 5);
  EXCEPTION WHEN others THEN v_raised := true;
  END;
  ASSERT v_raised, 'a NULL bucket did not raise';

  -- ── Pruning removes only rows older than the cutoff ─────────────────────
  DELETE FROM public.rate_limit_events;
  INSERT INTO public.rate_limit_events (bucket, subject, created_at)
  VALUES ('old', 'x', now() - interval '3 days'),
         ('new', 'x', now());

  SELECT public.prune_rate_limit_events(interval '1 day') INTO v_pruned;
  ASSERT v_pruned = 1, format('expected to prune 1 row, pruned %s', v_pruned);
  SELECT count(*) INTO v_count FROM public.rate_limit_events;
  ASSERT v_count = 1, format('expected 1 surviving row, found %s', v_count);

  RAISE NOTICE 'consume_rate_limit: core rules verified';
END;
$$;

-- ── The limiter must not be reachable from a browser session ───────────────
DO $$
DECLARE
  v_denied boolean := false;
BEGIN
  SET LOCAL ROLE authenticated;
  BEGIN
    PERFORM public.consume_rate_limit('test_bucket', 'anyone', 60, 3);
  EXCEPTION WHEN insufficient_privilege THEN v_denied := true;
  END;
  RESET ROLE;
  ASSERT v_denied, 'an authenticated client could call consume_rate_limit';

  v_denied := false;
  SET LOCAL ROLE authenticated;
  BEGIN
    PERFORM public.prune_rate_limit_events(interval '1 day');
  EXCEPTION WHEN insufficient_privilege THEN v_denied := true;
  END;
  RESET ROLE;
  ASSERT v_denied, 'an authenticated client could prune the rate-limit ledger';

  RAISE NOTICE 'consume_rate_limit: ALL ASSERTIONS PASSED';
END;
$$;

ROLLBACK;

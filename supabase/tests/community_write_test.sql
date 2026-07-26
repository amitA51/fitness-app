-- ============================================================================
-- Community write-path test
-- ============================================================================
-- Covers 20260726140000_community_write_rpcs.sql:
--   * create_post / create_comment exist and return the inserted row
--     (the client already called them; they were defined nowhere)
--   * validation rejects empty/oversized bodies and non-https image URLs
--   * the per-user window raises the literal `rate_limited` the client matches
--   * a blocked relationship prevents commenting in BOTH directions
--   * duplicate reports are a silent no-op
--   * direct INSERT is no longer possible for an authenticated client
--
-- Prerequisites:
--   supabase_min_stub.sql, 20260611000000_community.sql,
--   20260726130000_rate_limit_atomic.sql, 20260726140000_community_write_rpcs.sql
--
-- Expected final line: "community_write: ALL ASSERTIONS PASSED".
-- ============================================================================

BEGIN;

CREATE TEMP TABLE _cids (label text PRIMARY KEY, id uuid);

DO $$
DECLARE
  v_a uuid;
  v_b uuid;
BEGIN
  INSERT INTO auth.users (email) VALUES ('poster@example.com') RETURNING id INTO v_a;
  INSERT INTO auth.users (email) VALUES ('other@example.com') RETURNING id INTO v_b;
  INSERT INTO _cids VALUES ('a', v_a), ('b', v_b);
END;
$$;

DO $$
DECLARE
  v_a       uuid := (SELECT id FROM _cids WHERE label = 'a');
  v_b       uuid := (SELECT id FROM _cids WHERE label = 'b');
  v_post    public.posts;
  v_comment public.post_comments;
  v_count   integer;
  v_err     text;
  v_raised  boolean;
BEGIN
  PERFORM set_config('request.jwt.claim.sub', v_a::text, true);

  -- ── Happy path: the RPC returns the inserted row ─────────────────────────
  SELECT * INTO v_post FROM public.create_post('  שלום קהילה  ', 'strength', NULL);
  ASSERT v_post.id IS NOT NULL, 'create_post returned no row';
  ASSERT v_post.author_id = v_a, 'post attributed to the wrong author';
  ASSERT v_post.body = 'שלום קהילה', format('body was not trimmed: %L', v_post.body);
  ASSERT v_post.topic = 'strength', 'topic was lost';

  -- ── Validation ──────────────────────────────────────────────────────────
  v_raised := false;
  BEGIN PERFORM public.create_post('   ', NULL, NULL);
  EXCEPTION WHEN others THEN v_raised := true; v_err := SQLERRM; END;
  ASSERT v_raised AND v_err LIKE '%invalid_body%', format('empty body accepted (%L)', v_err);

  v_raised := false;
  BEGIN PERFORM public.create_post(repeat('x', 4001), NULL, NULL);
  EXCEPTION WHEN others THEN v_raised := true; v_err := SQLERRM; END;
  ASSERT v_raised AND v_err LIKE '%invalid_body%', 'an oversized body was accepted';

  v_raised := false;
  BEGIN PERFORM public.create_post('ok', NULL, 'http://evil.example/x.png');
  EXCEPTION WHEN others THEN v_raised := true; v_err := SQLERRM; END;
  ASSERT v_raised AND v_err LIKE '%invalid_image_url%',
    format('a non-https image url was accepted (%L)', v_err);

  -- ── Comments ────────────────────────────────────────────────────────────
  SELECT * INTO v_comment FROM public.create_comment(v_post.id, 'תגובה');
  ASSERT v_comment.id IS NOT NULL, 'create_comment returned no row';
  ASSERT v_comment.author_id = v_a, 'comment attributed to the wrong author';

  v_raised := false;
  BEGIN PERFORM public.create_comment(gen_random_uuid(), 'על פוסט שלא קיים');
  EXCEPTION WHEN others THEN v_raised := true; v_err := SQLERRM; END;
  ASSERT v_raised AND v_err LIKE '%invalid_post%', 'commented on a non-existent post';

  -- The count trigger from the community migration must still fire through the RPC.
  SELECT comment_count INTO v_count FROM public.posts WHERE id = v_post.id;
  ASSERT v_count = 1, format('comment_count is %s, expected 1', v_count);

  -- ── Blocks apply to commenting, not just to the feed ────────────────────
  INSERT INTO public.user_blocks (blocker_id, blocked_id) VALUES (v_a, v_b);

  PERFORM set_config('request.jwt.claim.sub', v_b::text, true);
  v_raised := false;
  BEGIN PERFORM public.create_comment(v_post.id, 'לא אמור לעבור');
  EXCEPTION WHEN others THEN v_raised := true; v_err := SQLERRM; END;
  ASSERT v_raised AND v_err LIKE '%blocked%',
    format('a blocked user could comment (%L)', v_err);

  -- ...and in the other direction too.
  DELETE FROM public.user_blocks;
  INSERT INTO public.user_blocks (blocker_id, blocked_id) VALUES (v_b, v_a);
  v_raised := false;
  BEGIN PERFORM public.create_comment(v_post.id, 'גם לא');
  EXCEPTION WHEN others THEN v_raised := true; v_err := SQLERRM; END;
  ASSERT v_raised AND v_err LIKE '%blocked%', 'blocking was one-directional';
  DELETE FROM public.user_blocks;

  -- ── Duplicate reports are a no-op ───────────────────────────────────────
  PERFORM public.report_content(v_post.id, NULL, 'spam');
  PERFORM public.report_content(v_post.id, NULL, 'spam again');
  SELECT count(*) INTO v_count FROM public.post_reports WHERE reporter_id = v_b;
  ASSERT v_count = 1, format('expected 1 report row, found %s', v_count);

  -- ── The hourly window raises the literal the client looks for ───────────
  PERFORM set_config('request.jwt.claim.sub', v_a::text, true);
  -- One post already consumed above; nine more reach the hourly cap of ten.
  FOR v_count IN 1..9 LOOP
    PERFORM public.create_post('post ' || v_count, NULL, NULL);
  END LOOP;

  v_raised := false;
  BEGIN PERFORM public.create_post('one too many', NULL, NULL);
  EXCEPTION WHEN others THEN v_raised := true; v_err := SQLERRM; END;
  ASSERT v_raised, 'the hourly post cap did not trigger';
  ASSERT v_err LIKE '%rate_limited%',
    format('the client matches on the literal "rate_limited", got %L', v_err);

  RAISE NOTICE 'community_write: RPC rules verified';
END;
$$;

-- ── The REST bypass must be closed ─────────────────────────────────────────
DO $$
DECLARE
  v_a      uuid := (SELECT id FROM _cids WHERE label = 'a');
  v_denied boolean;
BEGIN
  PERFORM set_config('request.jwt.claim.sub', v_a::text, true);
  SET LOCAL ROLE authenticated;

  v_denied := false;
  BEGIN
    INSERT INTO public.posts (author_id, body) VALUES (v_a, 'straight through REST');
  EXCEPTION WHEN insufficient_privilege OR check_violation THEN v_denied := true;
  END;
  ASSERT v_denied, 'a client could INSERT a post directly, bypassing the rate limit';

  v_denied := false;
  BEGIN
    INSERT INTO public.post_comments (post_id, author_id, body)
    VALUES ((SELECT id FROM public.posts LIMIT 1), v_a, 'direct');
  EXCEPTION WHEN insufficient_privilege OR check_violation THEN v_denied := true;
  END;
  ASSERT v_denied, 'a client could INSERT a comment directly';

  v_denied := false;
  BEGIN
    INSERT INTO public.post_reports (post_id, reporter_id, reason)
    VALUES ((SELECT id FROM public.posts LIMIT 1), v_a, 'direct');
  EXCEPTION WHEN insufficient_privilege OR check_violation THEN v_denied := true;
  END;
  ASSERT v_denied, 'a client could INSERT a report directly';

  -- Reading the feed must still work.
  PERFORM 1 FROM public.posts LIMIT 1;

  RESET ROLE;
  RAISE NOTICE 'community_write: ALL ASSERTIONS PASSED';
END;
$$;

ROLLBACK;

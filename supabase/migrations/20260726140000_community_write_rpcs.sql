-- ============================================================================
-- COMMUNITY WRITE PATH — the RPCs the client already calls, plus real limits
-- ============================================================================
-- Two separate problems, both live:
--
--   1. BROKEN FEATURE. src/services/community/communityService.ts calls
--      `create_post` and `create_comment` and treats their absence as a generic
--      failure. Neither function is defined in any migration, so posting and
--      commenting could not work at all. The client's comment even claims the
--      direct INSERT policy "was dropped" — it was not (see
--      20260611000000_community.sql: posts_insert_own, comments_insert_own).
--
--   2. NO RATE LIMIT, AND A BYPASS. The client is written as if these RPCs
--      enforce a per-user window, and surfaces `rate_limited` to the user. In
--      reality nothing limited posting, and even once the RPCs exist the direct
--      INSERT policies would let a caller skip them entirely via REST.
--
-- This migration defines both RPCs with validation and an ATOMIC limit (reusing
-- consume_rate_limit from 20260726130000, which is service-role-only and
-- therefore reachable only from inside a SECURITY DEFINER function), then removes
-- the direct INSERT policies so the RPC is the only write path. `report_content`
-- gains the same treatment, since an unlimited report endpoint is a moderation
-- denial-of-service.
--
-- The limits below are starting values, deliberately generous for a real user and
-- hostile to automation. Adjust them here, not in the client.
-- ============================================================================

-- Posts: enough for an enthusiastic day, far short of a script.
--
-- No parameter DEFAULTs anywhere in this file, on purpose: Postgres cannot change
-- a function's defaults with CREATE OR REPLACE ("cannot remove parameter defaults
-- from existing function"), so adding one here would make any later migration
-- that redefines the same function fail. The client always passes every argument.
CREATE OR REPLACE FUNCTION public.create_post(
  _body      text,
  _topic     text,
  _image_url text
)
RETURNS public.posts
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_user uuid := auth.uid();
  v_row  public.posts;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'unauthenticated';
  END IF;

  _body := btrim(coalesce(_body, ''));
  IF char_length(_body) < 1 OR char_length(_body) > 4000 THEN
    RAISE EXCEPTION 'invalid_body';
  END IF;

  -- Topic is a short label, not free text: bound it so it cannot be used as a
  -- second body field.
  _topic := nullif(btrim(coalesce(_topic, '')), '');
  IF _topic IS NOT NULL AND char_length(_topic) > 40 THEN
    RAISE EXCEPTION 'invalid_topic';
  END IF;

  -- Only our own Storage/CDN URLs. A free-form image_url makes every feed item a
  -- potential link to attacker-controlled content.
  _image_url := nullif(btrim(coalesce(_image_url, '')), '');
  IF _image_url IS NOT NULL THEN
    IF char_length(_image_url) > 500 OR _image_url !~ '^https://' THEN
      RAISE EXCEPTION 'invalid_image_url';
    END IF;
  END IF;

  -- 10 posts/hour and 40/day. `rate_limited` is the literal the client matches.
  IF NOT public.consume_rate_limit('community_post_hour', v_user::text, 3600, 10) THEN
    RAISE EXCEPTION 'rate_limited';
  END IF;
  IF NOT public.consume_rate_limit('community_post_day', v_user::text, 86400, 40) THEN
    RAISE EXCEPTION 'rate_limited';
  END IF;

  INSERT INTO public.posts (author_id, body, topic, image_url)
  VALUES (v_user, _body, _topic, _image_url)
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;

CREATE OR REPLACE FUNCTION public.create_comment(
  _post_id uuid,
  _body    text
)
RETURNS public.post_comments
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_user uuid := auth.uid();
  v_row  public.post_comments;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'unauthenticated';
  END IF;
  IF _post_id IS NULL THEN
    RAISE EXCEPTION 'invalid_post';
  END IF;

  _body := btrim(coalesce(_body, ''));
  IF char_length(_body) < 1 OR char_length(_body) > 2000 THEN
    RAISE EXCEPTION 'invalid_body';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.posts WHERE id = _post_id) THEN
    RAISE EXCEPTION 'invalid_post';
  END IF;

  -- Do not let a user comment on someone who has blocked them, in either
  -- direction. The feed already hides blocked authors, so without this the block
  -- would be visual only.
  IF EXISTS (
    SELECT 1
    FROM public.posts p
    JOIN public.user_blocks b
      ON (b.blocker_id = p.author_id AND b.blocked_id = v_user)
      OR (b.blocker_id = v_user AND b.blocked_id = p.author_id)
    WHERE p.id = _post_id
  ) THEN
    RAISE EXCEPTION 'blocked';
  END IF;

  -- 30 comments/hour and 120/day.
  IF NOT public.consume_rate_limit('community_comment_hour', v_user::text, 3600, 30) THEN
    RAISE EXCEPTION 'rate_limited';
  END IF;
  IF NOT public.consume_rate_limit('community_comment_day', v_user::text, 86400, 120) THEN
    RAISE EXCEPTION 'rate_limited';
  END IF;

  INSERT INTO public.post_comments (post_id, author_id, body)
  VALUES (_post_id, v_user, _body)
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;

-- ── Reports: same shape, now rate limited and duplicate-tolerant ─────────────
-- Signature deliberately identical to 20260611000000_community.sql (no defaults)
-- so CREATE OR REPLACE keeps working in either direction.
CREATE OR REPLACE FUNCTION public.report_content(
  _post_id    uuid,
  _comment_id uuid,
  _reason     text
)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_user uuid := auth.uid();
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'unauthenticated';
  END IF;
  IF _post_id IS NULL AND _comment_id IS NULL THEN
    RAISE EXCEPTION 'invalid_target';
  END IF;

  _reason := nullif(btrim(coalesce(_reason, '')), '');
  IF _reason IS NOT NULL AND char_length(_reason) > 500 THEN
    RAISE EXCEPTION 'invalid_reason';
  END IF;

  -- Reporting the same thing twice is a no-op rather than an error: the user has
  -- already been heard, and duplicates only dilute the moderation queue.
  IF EXISTS (
    SELECT 1 FROM public.post_reports
    WHERE reporter_id = v_user
      AND post_id IS NOT DISTINCT FROM _post_id
      AND comment_id IS NOT DISTINCT FROM _comment_id
  ) THEN
    RETURN;
  END IF;

  -- An unlimited report endpoint is a way to flood the moderation queue.
  IF NOT public.consume_rate_limit('community_report_day', v_user::text, 86400, 30) THEN
    RAISE EXCEPTION 'rate_limited';
  END IF;

  INSERT INTO public.post_reports (post_id, comment_id, reporter_id, reason)
  VALUES (_post_id, _comment_id, v_user, _reason);
END;
$$;

-- ── Close the REST bypass ───────────────────────────────────────────────────
-- With the RPCs in place, a direct INSERT policy is exactly the hole that makes
-- the rate limit optional. Reads, deletes and the reaction/block/follow paths are
-- untouched.
--
-- Both the policy drop AND the table-level REVOKE are needed: re-running
-- 20260611000000_community.sql would recreate the policies, but it never grants
-- INSERT explicitly (it relies on Supabase's default privileges granted at table
-- creation), so the REVOKE keeps the bypass closed even then.
DROP POLICY IF EXISTS posts_insert_own ON public.posts;
DROP POLICY IF EXISTS comments_insert_own ON public.post_comments;
DROP POLICY IF EXISTS reports_insert_any ON public.post_reports;

REVOKE INSERT ON public.posts FROM anon, authenticated;
REVOKE INSERT ON public.post_comments FROM anon, authenticated;
REVOKE INSERT ON public.post_reports FROM anon, authenticated;

-- ── Grants: the RPC is the write path ───────────────────────────────────────
REVOKE ALL ON FUNCTION public.create_post(text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_post(text, text, text) TO authenticated;

REVOKE ALL ON FUNCTION public.create_comment(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_comment(uuid, text) TO authenticated;

REVOKE ALL ON FUNCTION public.report_content(uuid, uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.report_content(uuid, uuid, text) TO authenticated;

COMMENT ON FUNCTION public.create_post(text, text, text) IS
  'The only way to create a post. Validates, enforces an atomic per-user window, and returns the inserted row. Direct INSERT is revoked on purpose.';
COMMENT ON FUNCTION public.create_comment(uuid, text) IS
  'The only way to comment. Enforces block relationships and an atomic per-user window.';

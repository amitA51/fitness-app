-- ============================================================================
-- COMMUNITY — trainee-facing social layer (feed, comments, likes) + the
-- moderation surface Apple requires for UGC (Guideline 1.2): report + block.
--
-- Separate from the coach-groups layer (consent-gated) — this is public-read
-- among authenticated trainees, rate-limited at the app layer. Follows the
-- project convention (20260609000000_legal_consent.sql,
-- 20260610000100_entitlements.sql): RLS, DROP POLICY IF EXISTS/CREATE POLICY,
-- SECURITY DEFINER ... SET search_path = public, REVOKE/GRANT EXECUTE.
--
-- Fail-safe: the client service treats a missing table / null supabase as an
-- empty feed and silent no-ops, so the app keeps working before this is live.
-- ============================================================================

-- ── Posts — one text body (+ optional single image) per row ──────────────────
CREATE TABLE IF NOT EXISTS public.posts (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  body          text NOT NULL CHECK (char_length(body) BETWEEN 1 AND 4000),
  topic         text,
  image_url     text,
  like_count    int NOT NULL DEFAULT 0,
  comment_count int NOT NULL DEFAULT 0,
  created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS posts_feed_idx   ON public.posts (created_at DESC, id);
CREATE INDEX IF NOT EXISTS posts_author_idx ON public.posts (author_id, created_at DESC);
CREATE INDEX IF NOT EXISTS posts_topic_idx  ON public.posts (topic, created_at DESC);

-- ── Comments — flat replies under a post ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.post_comments (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id    uuid NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  author_id  uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  body       text NOT NULL CHECK (char_length(body) BETWEEN 1 AND 2000),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS post_comments_post_idx ON public.post_comments (post_id, created_at);

-- ── Reactions — a single "like" per (post,user) ──────────────────────────────
CREATE TABLE IF NOT EXISTS public.post_reactions (
  post_id    uuid NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  user_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (post_id, user_id)
);

-- ── Reports — UGC moderation queue (Apple Guideline 1.2) ─────────────────────
CREATE TABLE IF NOT EXISTS public.post_reports (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id     uuid REFERENCES public.posts(id) ON DELETE CASCADE,
  comment_id  uuid REFERENCES public.post_comments(id) ON DELETE CASCADE,
  reporter_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reason      text,
  status      text NOT NULL DEFAULT 'open' CHECK (status IN ('open','reviewed','actioned')),
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS post_reports_status_idx ON public.post_reports (status, created_at DESC);

-- ── Blocks — the viewer hides another user's content everywhere ──────────────
CREATE TABLE IF NOT EXISTS public.user_blocks (
  blocker_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  blocked_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (blocker_id, blocked_id)
);

-- ── Follows — directed social edge ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.follows (
  follower_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  followee_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (follower_id, followee_id)
);

-- ── Count-maintenance triggers (keep like_count / comment_count accurate) ────
CREATE OR REPLACE FUNCTION public.posts_bump_like_count()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.posts SET like_count = like_count + 1 WHERE id = NEW.post_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.posts SET like_count = GREATEST(like_count - 1, 0) WHERE id = OLD.post_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END; $$;

DROP TRIGGER IF EXISTS post_reactions_count_trg ON public.post_reactions;
CREATE TRIGGER post_reactions_count_trg
  AFTER INSERT OR DELETE ON public.post_reactions
  FOR EACH ROW EXECUTE FUNCTION public.posts_bump_like_count();

CREATE OR REPLACE FUNCTION public.posts_bump_comment_count()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.posts SET comment_count = comment_count + 1 WHERE id = NEW.post_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.posts SET comment_count = GREATEST(comment_count - 1, 0) WHERE id = OLD.post_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END; $$;

DROP TRIGGER IF EXISTS post_comments_count_trg ON public.post_comments;
CREATE TRIGGER post_comments_count_trg
  AFTER INSERT OR DELETE ON public.post_comments
  FOR EACH ROW EXECUTE FUNCTION public.posts_bump_comment_count();

-- ── RLS ─────────────────────────────────────────────────────────────────────
-- Blocks are enforced in SELECT: a row is hidden when its author is blocked by
-- the viewer. NOT EXISTS keeps it index-friendly and symmetric across tables.

ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS posts_read ON public.posts;
CREATE POLICY posts_read ON public.posts
  FOR SELECT TO authenticated
  USING (
    NOT EXISTS (
      SELECT 1 FROM public.user_blocks b
      WHERE b.blocker_id = auth.uid() AND b.blocked_id = posts.author_id
    )
  );
DROP POLICY IF EXISTS posts_insert_own ON public.posts;
CREATE POLICY posts_insert_own ON public.posts
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = author_id);
DROP POLICY IF EXISTS posts_delete_own ON public.posts;
CREATE POLICY posts_delete_own ON public.posts
  FOR DELETE TO authenticated USING (auth.uid() = author_id);

ALTER TABLE public.post_comments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS comments_read ON public.post_comments;
CREATE POLICY comments_read ON public.post_comments
  FOR SELECT TO authenticated
  USING (
    NOT EXISTS (
      SELECT 1 FROM public.user_blocks b
      WHERE b.blocker_id = auth.uid() AND b.blocked_id = post_comments.author_id
    )
  );
DROP POLICY IF EXISTS comments_insert_own ON public.post_comments;
CREATE POLICY comments_insert_own ON public.post_comments
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = author_id);
DROP POLICY IF EXISTS comments_delete_own ON public.post_comments;
CREATE POLICY comments_delete_own ON public.post_comments
  FOR DELETE TO authenticated USING (auth.uid() = author_id);

ALTER TABLE public.post_reactions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS reactions_read ON public.post_reactions;
CREATE POLICY reactions_read ON public.post_reactions
  FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS reactions_owner_write ON public.post_reactions;
CREATE POLICY reactions_owner_write ON public.post_reactions
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS reactions_owner_delete ON public.post_reactions;
CREATE POLICY reactions_owner_delete ON public.post_reactions
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

ALTER TABLE public.post_reports ENABLE ROW LEVEL SECURITY;
-- Any authenticated user may file a report; reporters may read only their own.
DROP POLICY IF EXISTS reports_insert_any ON public.post_reports;
CREATE POLICY reports_insert_any ON public.post_reports
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = reporter_id);
DROP POLICY IF EXISTS reports_owner_read ON public.post_reports;
CREATE POLICY reports_owner_read ON public.post_reports
  FOR SELECT TO authenticated USING (auth.uid() = reporter_id);
-- Triage (status updates) happens via the service role / a coach-moderation
-- surface — no client UPDATE/DELETE policy.

ALTER TABLE public.user_blocks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS blocks_owner_read ON public.user_blocks;
CREATE POLICY blocks_owner_read ON public.user_blocks
  FOR SELECT TO authenticated USING (auth.uid() = blocker_id);
DROP POLICY IF EXISTS blocks_owner_write ON public.user_blocks;
CREATE POLICY blocks_owner_write ON public.user_blocks
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = blocker_id);
DROP POLICY IF EXISTS blocks_owner_delete ON public.user_blocks;
CREATE POLICY blocks_owner_delete ON public.user_blocks
  FOR DELETE TO authenticated USING (auth.uid() = blocker_id);

ALTER TABLE public.follows ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS follows_read ON public.follows;
CREATE POLICY follows_read ON public.follows
  FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS follows_owner_write ON public.follows;
CREATE POLICY follows_owner_write ON public.follows
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = follower_id);
DROP POLICY IF EXISTS follows_owner_delete ON public.follows;
CREATE POLICY follows_owner_delete ON public.follows
  FOR DELETE TO authenticated USING (auth.uid() = follower_id);

-- ── RPC: toggle a like (insert/delete; count maintained by trigger) ──────────
-- Returns true when the post is now liked by the caller, false when un-liked.
CREATE OR REPLACE FUNCTION public.toggle_like(_post_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid := auth.uid(); existed boolean;
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'unauthenticated' USING ERRCODE = 'insufficient_privilege';
  END IF;
  DELETE FROM public.post_reactions
    WHERE post_id = _post_id AND user_id = uid;
  GET DIAGNOSTICS existed = ROW_COUNT;
  IF existed THEN
    RETURN false;  -- was liked → now un-liked
  END IF;
  INSERT INTO public.post_reactions(post_id, user_id) VALUES (_post_id, uid)
    ON CONFLICT (post_id, user_id) DO NOTHING;
  RETURN true;
END; $$;

-- ── RPC: report a post or a comment (Apple Guideline 1.2) ────────────────────
CREATE OR REPLACE FUNCTION public.report_content(
  _post_id uuid, _comment_id uuid, _reason text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid := auth.uid();
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'unauthenticated' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF _post_id IS NULL AND _comment_id IS NULL THEN
    RAISE EXCEPTION 'report_target_required' USING ERRCODE = 'check_violation';
  END IF;
  INSERT INTO public.post_reports(post_id, comment_id, reporter_id, reason)
  VALUES (_post_id, _comment_id, uid, left(coalesce(_reason, ''), 500));
END; $$;

-- ── RPC: block another user (Apple Guideline 1.2) ────────────────────────────
CREATE OR REPLACE FUNCTION public.block_user(_blocked uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid := auth.uid();
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'unauthenticated' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF _blocked IS NULL OR _blocked = uid THEN
    RAISE EXCEPTION 'cannot_block_self' USING ERRCODE = 'check_violation';
  END IF;
  INSERT INTO public.user_blocks(blocker_id, blocked_id) VALUES (uid, _blocked)
    ON CONFLICT (blocker_id, blocked_id) DO NOTHING;
  -- A block also severs any follow edge in either direction.
  DELETE FROM public.follows
    WHERE (follower_id = uid AND followee_id = _blocked)
       OR (follower_id = _blocked AND followee_id = uid);
END; $$;

REVOKE ALL ON FUNCTION public.toggle_like(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.report_content(uuid, uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.block_user(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.toggle_like(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.report_content(uuid, uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.block_user(uuid) TO authenticated;

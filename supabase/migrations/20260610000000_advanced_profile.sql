-- ============================================================================
-- ADVANCED PROFILE — public-safe profile fields + achievements engine.
--
-- Extends the EXISTING public.profiles table (do not duplicate). Only
-- PUBLIC-safe fields land here (display_name, bio, avatar_url, is_public),
-- because coach queries select profiles.* — PII like DOB stays in the
-- dedicated public.user_age_verification table (see 20260609000200).
--
-- Achievements: a read-all catalog (public.achievements) plus a per-user
-- ledger (public.user_achievements). Clients NEVER self-write the ledger —
-- the only write path is the SECURITY DEFINER RPC award_achievement(), which
-- inserts ON CONFLICT DO NOTHING for auth.uid().
-- ============================================================================

-- 1. Public-safe profile columns -------------------------------------------
ALTER TABLE public.profiles
    ADD COLUMN IF NOT EXISTS display_name TEXT,
    ADD COLUMN IF NOT EXISTS bio          TEXT,
    ADD COLUMN IF NOT EXISTS avatar_url   TEXT,
    ADD COLUMN IF NOT EXISTS is_public    BOOLEAN NOT NULL DEFAULT false;

-- Public read of profiles when the owner has opted in. The owner's own-row
-- read policy (defined elsewhere) is unaffected; this only widens SELECT to
-- others for explicitly public profiles. Body metrics / role internals are
-- never surfaced to the public UI — the service layer selects only safe
-- columns, and DOB lives in a separate table entirely.
DROP POLICY IF EXISTS "profiles_public_read" ON public.profiles;
CREATE POLICY "profiles_public_read" ON public.profiles
    FOR SELECT TO authenticated, anon
    USING (is_public = true);

-- 2. Achievements catalog (read-all) ---------------------------------------
CREATE TABLE IF NOT EXISTS public.achievements (
    id          TEXT PRIMARY KEY,                 -- 'first_workout', 'streak_7'
    title       TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    icon        TEXT NOT NULL DEFAULT 'award',     -- lucide icon name
    category    TEXT NOT NULL DEFAULT 'general',
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.achievements ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "achievements_read_all" ON public.achievements;
CREATE POLICY "achievements_read_all" ON public.achievements
    FOR SELECT TO authenticated, anon
    USING (true);
-- Writes: service role only (no client INSERT/UPDATE/DELETE policy).

-- 3. Per-user achievements ledger ------------------------------------------
CREATE TABLE IF NOT EXISTS public.user_achievements (
    user_id        UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    achievement_id TEXT NOT NULL REFERENCES public.achievements(id),
    awarded_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, achievement_id)
);

ALTER TABLE public.user_achievements ENABLE ROW LEVEL SECURITY;

-- Read: owner reads their own; others may read when the owner's profile is
-- public (community badge display).
DROP POLICY IF EXISTS "user_achievements_read" ON public.user_achievements;
CREATE POLICY "user_achievements_read" ON public.user_achievements
    FOR SELECT TO authenticated, anon
    USING (
        user_id = (SELECT auth.uid())
        OR EXISTS (
            SELECT 1 FROM public.profiles p
            WHERE p.id = user_id AND p.is_public = true
        )
    );
-- No INSERT/UPDATE/DELETE policy => clients cannot self-award. The award RPC
-- below (SECURITY DEFINER) is the sole write path.

-- 4. Award RPC — the only client-reachable write path ----------------------
-- Inserts an award for the current user, idempotent. The achievement must
-- exist in the catalog (FK enforces it); a bad id raises, which the service
-- layer swallows. ON CONFLICT keeps re-awarding a no-op.
CREATE OR REPLACE FUNCTION public.award_achievement(_achievement_id TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    uid UUID := auth.uid();
BEGIN
    IF uid IS NULL THEN
        RAISE EXCEPTION 'unauthenticated' USING ERRCODE = 'insufficient_privilege';
    END IF;

    INSERT INTO public.user_achievements (user_id, achievement_id)
    VALUES (uid, _achievement_id)
    ON CONFLICT (user_id, achievement_id) DO NOTHING;
END;
$$;

REVOKE ALL ON FUNCTION public.award_achievement(TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.award_achievement(TEXT) TO authenticated;

-- 5. Seed an initial catalog ------------------------------------------------
INSERT INTO public.achievements (id, title, description, icon, category)
VALUES
    ('first_workout', 'אימון ראשון',   'השלמת את האימון הראשון שלך',       'dumbbell', 'milestone'),
    ('streak_7',      'שבוע ברצף',      'שמרת על רצף של 7 ימי פעילות',       'flame',    'streak'),
    ('pr_milestone',  'שיא אישי',       'קבעת שיא אישי חדש',                 'trophy',   'milestone')
ON CONFLICT (id) DO NOTHING;

-- 6. Avatars Storage bucket (public read) ----------------------------------
-- Public-read bucket so a public profile avatar resolves via a stable public
-- URL (getPublicUrl) without per-load signing. Path convention: {uid}/...
-- Writes/deletes restricted to the owner's own top-level folder, mirroring
-- 20260608000300_progress_photos_storage.sql.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'avatars',
    'avatars',
    true,
    2097152, -- 2MB
    ARRAY['image/webp', 'image/jpeg', 'image/png']
)
ON CONFLICT (id) DO NOTHING;

-- Public read of avatars (bucket is public; this makes the SELECT explicit).
DROP POLICY IF EXISTS "avatars_public_read" ON storage.objects;
CREATE POLICY "avatars_public_read" ON storage.objects
    FOR SELECT TO authenticated, anon
    USING (bucket_id = 'avatars');

-- Write only into your own top-level folder.
DROP POLICY IF EXISTS "avatars_insert_own" ON storage.objects;
CREATE POLICY "avatars_insert_own" ON storage.objects
    FOR INSERT WITH CHECK (
        bucket_id = 'avatars'
        AND (storage.foldername(name))[1] = (SELECT auth.uid())::text
    );

-- Replace (upsert) your own avatar.
DROP POLICY IF EXISTS "avatars_update_own" ON storage.objects;
CREATE POLICY "avatars_update_own" ON storage.objects
    FOR UPDATE USING (
        bucket_id = 'avatars'
        AND (storage.foldername(name))[1] = (SELECT auth.uid())::text
    );

-- Delete: owner only.
DROP POLICY IF EXISTS "avatars_delete_own" ON storage.objects;
CREATE POLICY "avatars_delete_own" ON storage.objects
    FOR DELETE USING (
        bucket_id = 'avatars'
        AND (storage.foldername(name))[1] = (SELECT auth.uid())::text
    );

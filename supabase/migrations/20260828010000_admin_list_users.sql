-- ============================================================================
-- ADMIN USER LOOKUP — the missing half of admin coach assignment (2026-08-28)
--
-- Why: 20260828000000_admin_coach_assignment.sql gave an admin the ability to
-- PROMOTE a user (admin_set_coach) but no way to FIND one. profiles RLS is
--   profiles_select_visible: id = auth.uid() OR is_coach_of(id) OR is_client_of(id)
-- (20260529000000_coach_platform.sql:78), so an admin can read exactly one
-- profile — their own. The admin screen had no lookup path at all.
--
-- Why a SECURITY DEFINER function and NOT a widened policy: a policy that let
-- admins read profiles would expose every profile row to every ordinary SELECT
-- the admin's client ever makes, including anything the client library joins or
-- prefetches. This function exposes ONE narrow, auditable projection
-- (id, email, display_name, role), capped and gated. profiles_select_visible is
-- deliberately left untouched.
--
-- Out of scope on purpose: demotion / un-assign. Not requested. Also no write
-- capability of any kind — this function is STABLE and read-only.
-- ============================================================================

-- ------------------------------------------------------------
-- 1. Index for the empty-query case
-- ------------------------------------------------------------
-- With no _query the function returns the most recently created users, i.e.
-- ORDER BY created_at DESC LIMIT n. Without this index that plan is a full sort
-- of public.profiles on every admin screen load. profiles is 1:1 with
-- auth.users and written once per signup, so the write cost is negligible.
-- The substring search itself is intentionally NOT indexed: ILIKE '%x%' cannot
-- use a btree index, and a pg_trgm GIN index would mean shipping a new
-- extension for a low-frequency operator screen bounded by a small LIMIT.
CREATE INDEX IF NOT EXISTS idx_profiles_created_at_desc
    ON public.profiles (created_at DESC);

-- ------------------------------------------------------------
-- 2. admin_list_users() — admin-only user lookup
-- ------------------------------------------------------------
-- SECURITY DEFINER is exactly what makes reading other users' rows possible:
-- it runs as the function owner, so neither profiles RLS nor the fact that
-- auth.users is unreachable from a client role applies. The privilege gate is
-- therefore the FIRST statement in the body, same shape as admin_set_coach().
CREATE OR REPLACE FUNCTION public.admin_list_users(_query TEXT DEFAULT NULL, _limit INT DEFAULT 20)
RETURNS TABLE (user_id UUID, email TEXT, display_name TEXT, role TEXT)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    _lim  INT;
    _needle TEXT;
BEGIN
    IF NOT public.is_app_admin() THEN
        RAISE EXCEPTION 'not_app_admin' USING ERRCODE = 'insufficient_privilege';
    END IF;

    -- Clamped server-side: the client does not get to ask for the whole table.
    -- NULL/0/negative -> default 20; anything above 100 -> 100.
    _lim := LEAST(GREATEST(COALESCE(NULLIF(_limit, 0), 20), 1), 100);

    -- Blank-or-whitespace is treated as "no filter", not as a match-everything
    -- LIKE pattern, so the empty search box returns the newest users.
    _needle := NULLIF(btrim(COALESCE(_query, '')), '');

    RETURN QUERY
    SELECT u.id,
           u.email::TEXT,
           p.display_name,
           p.role
    FROM auth.users u
    JOIN public.profiles p ON p.id = u.id          -- PK join, already indexed
    WHERE _needle IS NULL
       OR u.email ILIKE '%' || _needle || '%'      -- ILIKE = case-insensitive
       OR p.display_name ILIKE '%' || _needle || '%'
    ORDER BY p.created_at DESC NULLS LAST, u.id
    LIMIT _lim;
END;
$$;

-- authenticated keeps EXECUTE: the gate lives inside the function, exactly like
-- admin_set_coach(). anon and PUBLIC lose it outright — an unauthenticated
-- caller has no auth.uid(), and there is no reason for the grant to exist.
REVOKE ALL ON FUNCTION public.admin_list_users(TEXT, INT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_list_users(TEXT, INT) TO authenticated;

COMMENT ON FUNCTION public.admin_list_users(TEXT, INT) IS
  'Admin-only user lookup for the promotion screen. Refuses unless is_app_admin(). Case-insensitive substring match on email or display_name; empty query returns the newest users. Read-only, limit clamped to 100.';

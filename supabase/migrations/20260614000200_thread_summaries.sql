-- ============================================================
-- Thread-summary RPCs for the messages hub.
-- The client previously fetched the latest 500 rows and reduced
-- in JS — preview/unread became inexact past the window and the
-- payload grew with history. These aggregates compute exact
-- per-thread last-message + unread in the DB in one call.
-- SECURITY INVOKER: messages/group_messages RLS applies as-is.
-- ============================================================

-- One row per 1:1 client thread of the calling COACH.
CREATE OR REPLACE FUNCTION public.coach_thread_summaries()
RETURNS TABLE (
    client_id UUID,
    last_body TEXT,
    last_at TIMESTAMPTZ,
    unread BIGINT
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
    SELECT
        m.client_id,
        (ARRAY_AGG(m.body ORDER BY m.created_at DESC))[1] AS last_body,
        MAX(m.created_at) AS last_at,
        COUNT(*) FILTER (
            WHERE m.sender_id <> auth.uid() AND m.read_at IS NULL
        ) AS unread
    FROM public.messages m
    WHERE m.coach_id = auth.uid()
    GROUP BY m.client_id;
$$;

-- One row per group thread the caller participates in, per role.
-- A user can hold both roles for the same group (coach owns it AND
-- is a member); each role keeps its own read cursor, so the role
-- column lets the client pick the right row for its viewer.
CREATE OR REPLACE FUNCTION public.group_thread_summaries()
RETURNS TABLE (
    group_id UUID,
    role TEXT,
    last_body TEXT,
    last_at TIMESTAMPTZ,
    unread BIGINT
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
    WITH my_groups AS (
        SELECT g.id AS gid, 'coach'::TEXT AS role, g.coach_last_read_at AS last_read
        FROM public.client_groups g
        WHERE g.coach_id = auth.uid()
        UNION ALL
        SELECT m.group_id, 'member'::TEXT, m.last_read_at
        FROM public.client_group_members m
        WHERE m.client_id = auth.uid()
    )
    SELECT
        mg.gid,
        mg.role,
        (SELECT gm.body FROM public.group_messages gm
          WHERE gm.group_id = mg.gid
          ORDER BY gm.created_at DESC LIMIT 1),
        (SELECT MAX(gm.created_at) FROM public.group_messages gm
          WHERE gm.group_id = mg.gid),
        (SELECT COUNT(*) FROM public.group_messages gm
          WHERE gm.group_id = mg.gid
            AND gm.sender_id <> auth.uid()
            AND (mg.last_read IS NULL OR gm.created_at > mg.last_read))
    FROM my_groups mg;
$$;

REVOKE ALL ON FUNCTION public.coach_thread_summaries() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.coach_thread_summaries() TO authenticated;
REVOKE ALL ON FUNCTION public.group_thread_summaries() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.group_thread_summaries() TO authenticated;

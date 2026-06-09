-- ============================================================
-- set_group_members — atomic group-membership replacement
-- Replaces the client-side diff (read → insert → delete: two
-- round-trips, non-atomic) with ONE transactional RPC, so a
-- mid-failure can never leave membership half-updated.
-- SECURITY DEFINER (bypasses RLS) → re-implements the policy
-- checks explicitly: caller must own the group, and every new
-- member must be an ACTIVE client of the caller.
-- ============================================================

CREATE OR REPLACE FUNCTION public.set_group_members(_group_id UUID, _client_ids UUID[])
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    _ids UUID[] := COALESCE(_client_ids, '{}'::UUID[]);
    _bad_count INTEGER;
BEGIN
    -- Ownership: mirrors the client_group_members_coach_all RLS policy.
    IF NOT EXISTS (
        SELECT 1 FROM public.client_groups g
        WHERE g.id = _group_id AND g.coach_id = auth.uid()
    ) THEN
        RAISE EXCEPTION 'not_group_owner' USING ERRCODE = 'insufficient_privilege';
    END IF;

    -- Every requested member must be an ACTIVE client of this coach
    -- (the UI only offers active clients; enforce it server-side too).
    SELECT COUNT(*) INTO _bad_count
    FROM unnest(_ids) AS u(client_id)
    WHERE NOT EXISTS (
        SELECT 1 FROM public.coach_clients cc
        WHERE cc.coach_id = auth.uid()
          AND cc.client_id = u.client_id
          AND cc.status = 'active'
    );
    IF _bad_count > 0 THEN
        RAISE EXCEPTION 'not_an_active_client' USING ERRCODE = 'check_violation';
    END IF;

    -- Diff inside one transaction: delete removed, insert added.
    DELETE FROM public.client_group_members m
    WHERE m.group_id = _group_id
      AND m.client_id <> ALL (_ids);

    INSERT INTO public.client_group_members (group_id, client_id)
    SELECT _group_id, u.client_id
    FROM unnest(_ids) AS u(client_id)
    ON CONFLICT (group_id, client_id) DO NOTHING;
END;
$$;

REVOKE ALL ON FUNCTION public.set_group_members(UUID, UUID[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_group_members(UUID, UUID[]) TO authenticated;

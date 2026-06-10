-- Security-advisor hardening: SECURITY DEFINER functions were executable by anon
-- (default PUBLIC grant). RLS helper fns keep authenticated EXECUTE (policies
-- evaluate them as the querying role); trigger fns need no EXECUTE at all
-- (fired with owner privileges); set_group_members is an authenticated-only RPC.
-- current_legal_versions intentionally left callable by anon: read-only version
-- metadata consumed by the pre-auth consent/legal flow.

-- RLS helpers
REVOKE EXECUTE ON FUNCTION public.is_coach_of(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_client_of(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_group_member(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_coach_of(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_client_of(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_group_member(uuid) TO authenticated, service_role;

-- Authenticated-only RPC
REVOKE EXECUTE ON FUNCTION public.set_group_members(uuid, uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_group_members(uuid, uuid[]) TO authenticated, service_role;

-- Trigger functions: no direct invocation by any client role
REVOKE EXECUTE ON FUNCTION public.enforce_seat_limit() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.enforce_invite_seat_limit() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;

-- ============================================================
-- COACH PLATFORM — hardening (addresses security advisor warnings)
-- Trigger functions are invoked by the trigger system / RLS, never via the
-- public REST RPC API, so remove their REST-callable surface and pin
-- search_path. (RLS still works: a trigger function's EXECUTE privilege is not
-- checked when the trigger fires.) The is_coach_of/is_client_of/is_group_member
-- helpers intentionally remain executable by `authenticated` — RLS policy
-- evaluation requires it, and they only reveal the caller's own relationship.
-- ============================================================

ALTER FUNCTION public.update_updated_at_column() SET search_path = public;

REVOKE EXECUTE ON FUNCTION public.update_updated_at_column() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.enforce_seat_limit() FROM anon, authenticated;

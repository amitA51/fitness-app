-- ============================================================================
-- Trigger-only functions must not be part of the REST API surface
-- ============================================================================
-- Flagged by the Supabase database linter (0028/0029) right after
-- 20260726100000_billing_core.sql and 20260726120000_sync_integrity.sql were
-- deployed: `billing_sync_entitlement`, `enforce_free_template_quota`,
-- `sync_lww_guard` and `update_updated_at_column` were all EXECUTE-able by
-- `anon` and `authenticated`, which means PostgREST published them at
-- `/rest/v1/rpc/<name>`.
--
-- These are trigger functions. Postgres refuses a direct call ("can only be
-- called as a trigger"), so this is not a privilege-escalation hole — but two of
-- them are SECURITY DEFINER, they should never have been reachable from a
-- browser, and leaving them exposed keeps a permanent WARN in the advisor output
-- that hides real findings. 20260615000100_harden_secdef_function_grants.sql
-- established this exact pattern; these four were simply added later and missed.
--
-- `FROM PUBLIC` is the important part: Postgres grants EXECUTE to PUBLIC on new
-- functions by default, and `anon`/`authenticated` inherit it from there, so
-- revoking only the two roles would leave the grant in place.
-- ============================================================================

REVOKE ALL ON FUNCTION public.billing_sync_entitlement()
  FROM PUBLIC, anon, authenticated;

REVOKE ALL ON FUNCTION public.enforce_free_template_quota()
  FROM PUBLIC, anon, authenticated;

REVOKE ALL ON FUNCTION public.sync_lww_guard()
  FROM PUBLIC, anon, authenticated;

REVOKE ALL ON FUNCTION public.update_updated_at_column()
  FROM PUBLIC, anon, authenticated;

COMMENT ON FUNCTION public.sync_lww_guard() IS
  'BEFORE UPDATE guard for multi-device synced tables: drops stale writes (RETURN NULL), preserves tombstones, clamps forged future timestamps. Trigger-only: EXECUTE is revoked from anon/authenticated so it is not published as an RPC.';

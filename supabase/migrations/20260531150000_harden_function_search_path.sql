-- Advisor hardening after the data-sync + security migrations.
-- 1) update_updated_at_column: pin an immutable search_path (now() resolves via pg_catalog).
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF NEW.updated_at IS NULL OR NEW.updated_at <= OLD.updated_at THEN
    NEW.updated_at = now();
  END IF;
  RETURN NEW;
END;
$$;

-- 2) immutable_coach_client_columns: revoke direct RPC executability from PUBLIC
--    (anon/authenticated were already revoked in 20260531130000). Trigger execution is unaffected.
REVOKE EXECUTE ON FUNCTION public.immutable_coach_client_columns() FROM PUBLIC;

-- SECURITY (LWW hardening): a malicious client could send a far-future
-- updated_at so its row wins EVERY future last-write-wins merge across devices.
-- Redefine update_updated_at_column to CLAMP updated_at to at most 5 minutes
-- ahead of server now() (tolerating real client clock skew) while keeping:
--   * the existing bump-to-now-if-stale-or-missing behaviour, and
--   * the immutable search_path hardening from 20260531150000.
-- This does NOT rewrite historical migrations; it is an additive redefinition.
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  -- Bump to now() when the client omitted the value or sent a stale one
  -- (a genuinely newer client value is preserved for correct LWW merges).
  IF NEW.updated_at IS NULL OR NEW.updated_at <= OLD.updated_at THEN
    NEW.updated_at = now();
  END IF;
  -- Clamp the (possibly client-supplied) value so it can never be forged into
  -- the far future. COALESCE guards against NULL leaking through.
  NEW.updated_at = LEAST(COALESCE(NEW.updated_at, now()), now() + interval '5 minutes');
  RETURN NEW;
END;
$$;

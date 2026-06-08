-- ============================================================================
-- Age verification. DOB + verification status live in a DEDICATED table (not on
-- public.profiles) because coach queries select profiles.* and would otherwise
-- leak DOB (PII) to coaches. Age is computed server-side (tamper-proof).
-- ============================================================================

-- Per-country minimum age (default row 'XX'). Change the law => UPDATE a row.
CREATE TABLE IF NOT EXISTS public.age_thresholds (
  country_code text PRIMARY KEY,                 -- 'IL', 'XX' (global default)
  min_age      smallint NOT NULL CHECK (min_age BETWEEN 13 AND 18),
  updated_at   timestamptz NOT NULL DEFAULT now()
);
INSERT INTO public.age_thresholds(country_code, min_age)
VALUES ('XX', 16), ('IL', 16)
ON CONFLICT (country_code) DO NOTHING;

ALTER TABLE public.age_thresholds ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS age_thresholds_read ON public.age_thresholds;
CREATE POLICY age_thresholds_read ON public.age_thresholds
  FOR SELECT TO authenticated, anon USING (true);
-- Writes: service role only (no client policy).

-- Per-user verification record. Owner-readable only; no direct writes.
CREATE TABLE IF NOT EXISTS public.user_age_verification (
  user_id                 uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  birth_date              date,
  age_verified            boolean NOT NULL DEFAULT false,
  min_age_at_verification smallint,
  age_verified_at         timestamptz,
  parental_consent_status text NOT NULL DEFAULT 'not_required'
    CHECK (parental_consent_status IN ('not_required','pending','granted','denied')),
  CONSTRAINT chk_birth_date_sane
    CHECK (birth_date IS NULL OR (birth_date <= current_date AND birth_date >= '1900-01-01'))
);

ALTER TABLE public.user_age_verification ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS age_owner_read ON public.user_age_verification;
CREATE POLICY age_owner_read ON public.user_age_verification
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
-- Writes ONLY through set_birth_date() RPC (no direct INSERT/UPDATE/DELETE policy).

-- Atomic, server-authoritative age computation (client clock cannot cheat).
CREATE OR REPLACE FUNCTION public.set_birth_date(_dob date, _country text DEFAULT 'XX')
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid := auth.uid(); yrs int; threshold smallint;
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'unauthenticated' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF _dob > current_date OR _dob < DATE '1900-01-01' THEN
    RAISE EXCEPTION 'invalid_birth_date' USING ERRCODE = 'check_violation';
  END IF;
  SELECT min_age INTO threshold FROM public.age_thresholds
    WHERE country_code IN (_country, 'XX')
    ORDER BY (country_code = _country) DESC LIMIT 1;
  IF threshold IS NULL THEN threshold := 16; END IF;
  yrs := date_part('year', age(_dob))::int;
  INSERT INTO public.user_age_verification(
    user_id, birth_date, age_verified, min_age_at_verification, age_verified_at, parental_consent_status)
  VALUES (
    uid, _dob, yrs >= threshold, threshold, now(),
    CASE WHEN yrs >= threshold THEN 'not_required' ELSE 'pending' END)
  ON CONFLICT (user_id) DO UPDATE SET
    birth_date = EXCLUDED.birth_date,
    age_verified = EXCLUDED.age_verified,
    min_age_at_verification = EXCLUDED.min_age_at_verification,
    age_verified_at = EXCLUDED.age_verified_at,
    parental_consent_status = EXCLUDED.parental_consent_status;
  RETURN jsonb_build_object('age', yrs, 'min_age', threshold, 'verified', yrs >= threshold);
END; $$;

REVOKE ALL ON FUNCTION public.set_birth_date(date, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_birth_date(date, text) TO authenticated;

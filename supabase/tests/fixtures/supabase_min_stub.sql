-- Minimal Supabase-shaped stub so the migrations added on 2026-07-26 can be
-- applied and exercised against a plain Postgres container. It provides only
-- what those migrations reference: the `auth` schema with `users` and `uid()`,
-- the anon/authenticated roles, and the pre-existing tables they build on.
--
-- Not part of the app schema. Used by the local validation run documented in
-- reports/00-MASTER-PRODUCTION-READINESS.md.

CREATE SCHEMA IF NOT EXISTS auth;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    CREATE ROLE anon NOLOGIN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    CREATE ROLE authenticated NOLOGIN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    CREATE ROLE service_role NOLOGIN BYPASSRLS;
  END IF;
END;
$$;

-- Supabase grants anon/authenticated broad table privileges by default and
-- relies on RLS for row-level control. Mirroring that here is what makes the
-- REVOKE statements in the migrations meaningful during a local test: without
-- these grants, every table would look "secure" simply because nothing was ever
-- granted, and a missing REVOKE would go unnoticed.
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT USAGE ON SCHEMA auth TO anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO anon, authenticated;

CREATE TABLE IF NOT EXISTS auth.users (
  id    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text
);

-- Stand-in for Supabase's auth.uid(): reads a session GUC the tests can set.
CREATE OR REPLACE FUNCTION auth.uid()
RETURNS uuid LANGUAGE sql STABLE AS $$
  SELECT NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid;
$$;

-- ── Tables the new migrations build on ──────────────────────────────────────
--
-- `entitlements`, `billing_events` and `current_entitlement()` are NOT recreated
-- here: the real 20260610000100_entitlements.sql is applied as part of the chain
-- so its RLS and policies are the ones under test. Hand-copying that table into
-- this stub previously hid the fact that its RLS was never enabled locally.

CREATE TABLE IF NOT EXISTS public.rate_limit_events (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bucket     text NOT NULL,
  subject    text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- workout_templates is referenced by the free-tier quota trigger. Created here
-- with the tombstone column the tombstones migration adds in production.
CREATE TABLE IF NOT EXISTS public.workout_templates (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name       text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);

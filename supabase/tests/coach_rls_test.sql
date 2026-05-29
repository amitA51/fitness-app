-- ============================================================
-- RLS ISOLATION TESTS — coach platform
-- Run with:  supabase test db
-- Verifies: trainee<->trainee isolation, coach access gated on an ACTIVE
-- link (consent), and instant revocation when the link ends.
-- ============================================================

BEGIN;
SELECT plan(7);

-- ---- seed users (coach C, clients A and B) --------------------------------
INSERT INTO auth.users (id, instance_id, aud, role, email)
VALUES
  ('00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'coach@test.dev'),
  ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'a@test.dev'),
  ('00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'b@test.dev');

-- seat allowance for the coach
INSERT INTO public.coach_subscriptions (coach_id, plan, seat_limit, status)
VALUES ('00000000-0000-0000-0000-0000000000c1', 'pro', 10, 'active');

-- C coaches A (active, consented); C<->B only pending (no consent yet)
INSERT INTO public.coach_clients (coach_id, client_id, status, consent_at)
VALUES
  ('00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-0000000000a1', 'active', NOW()),
  ('00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-0000000000b1', 'pending', NULL);

-- A and B each log one workout session (as themselves)
SET LOCAL ROLE authenticated;

SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}', true);
INSERT INTO public.workout_sessions (id, user_id, start_time, exercises)
VALUES ('00000000-0000-0000-0000-00000000a111', '00000000-0000-0000-0000-0000000000a1', NOW(), '[]');

SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000b1","role":"authenticated"}', true);
INSERT INTO public.workout_sessions (id, user_id, start_time, exercises)
VALUES ('00000000-0000-0000-0000-00000000b111', '00000000-0000-0000-0000-0000000000b1', NOW(), '[]');

-- ---- trainee<->trainee isolation: A cannot see B's session ------------------
SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}', true);
SELECT is(
  (SELECT count(*)::int FROM public.workout_sessions WHERE user_id = '00000000-0000-0000-0000-0000000000b1'),
  0, 'trainee A cannot read trainee B sessions');
SELECT is(
  (SELECT count(*)::int FROM public.workout_sessions WHERE user_id = '00000000-0000-0000-0000-0000000000a1'),
  1, 'trainee A can read own sessions');

-- ---- coach access gated on ACTIVE link -------------------------------------
SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000c1","role":"authenticated"}', true);
SELECT is(
  (SELECT count(*)::int FROM public.workout_sessions WHERE user_id = '00000000-0000-0000-0000-0000000000a1'),
  1, 'coach can read ACTIVE client A sessions');
SELECT is(
  (SELECT count(*)::int FROM public.workout_sessions WHERE user_id = '00000000-0000-0000-0000-0000000000b1'),
  0, 'coach cannot read PENDING (no-consent) client B sessions');

-- coach can write to an active client (full control)
SELECT lives_ok($$
  INSERT INTO public.workout_templates (id, user_id, name, exercises, updated_by)
  VALUES ('00000000-0000-0000-0000-0000000000t1', '00000000-0000-0000-0000-0000000000a1', 'Coach plan', '[]', '00000000-0000-0000-0000-0000000000c1')
$$, 'coach can write a template to an active client');

-- ---- instant revocation: A disconnects -> coach loses access ---------------
SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}', true);
UPDATE public.coach_clients SET status = 'ended'
WHERE coach_id = '00000000-0000-0000-0000-0000000000c1' AND client_id = '00000000-0000-0000-0000-0000000000a1';

SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000c1","role":"authenticated"}', true);
SELECT is(
  (SELECT count(*)::int FROM public.workout_sessions WHERE user_id = '00000000-0000-0000-0000-0000000000a1'),
  0, 'coach access is revoked immediately when the link ends');

-- ---- seat limit enforcement ------------------------------------------------
SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000c1","role":"authenticated"}', true);
UPDATE public.coach_subscriptions SET seat_limit = 0 WHERE coach_id = '00000000-0000-0000-0000-0000000000c1';
SELECT throws_ok($$
  INSERT INTO public.coach_clients (coach_id, client_id, status, consent_at)
  VALUES ('00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-0000000000b1', 'active', NOW())
$$, 'seat_limit_reached', 'seat limit blocks activating beyond the plan');

SELECT * FROM finish();
ROLLBACK;

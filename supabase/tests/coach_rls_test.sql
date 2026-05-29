-- ============================================================
-- RLS ISOLATION TESTS — coach platform
-- Run with:  supabase test db
-- Verifies: trainee<->trainee isolation, coach access gated on an ACTIVE
-- link (consent), and instant revocation when the link ends.
-- ============================================================

BEGIN;
SELECT plan(28);

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
  VALUES ('00000000-0000-0000-0000-0000000000e1', '00000000-0000-0000-0000-0000000000a1', 'Coach plan', '[]', '00000000-0000-0000-0000-0000000000c1')
$$, 'coach can write a template to an active client');

-- ---- messages: participant-only --------------------------------------------
SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000c1","role":"authenticated"}', true);
SELECT lives_ok($$
  INSERT INTO public.messages (coach_id, client_id, sender_id, body)
  VALUES ('00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000c1', 'hello A')
$$, 'coach can send a message to an active client');

SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}', true);
SELECT is(
  (SELECT count(*)::int FROM public.messages WHERE coach_id = '00000000-0000-0000-0000-0000000000c1' AND client_id = '00000000-0000-0000-0000-0000000000a1'),
  1, 'client A reads the coach<->A thread');

SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000b1","role":"authenticated"}', true);
SELECT is(
  (SELECT count(*)::int FROM public.messages WHERE client_id = '00000000-0000-0000-0000-0000000000a1'),
  0, 'non-participant B cannot read the coach<->A thread');

-- ---- assignments: direct target only ---------------------------------------
SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000c1","role":"authenticated"}', true);
SELECT lives_ok($$
  INSERT INTO public.assignments (coach_id, client_id, kind, title)
  VALUES ('00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-0000000000a1', 'note', 'Eat well')
$$, 'coach can create a direct assignment for a client');

SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}', true);
SELECT is(
  (SELECT count(*)::int FROM public.assignments WHERE client_id = '00000000-0000-0000-0000-0000000000a1'),
  1, 'client A sees their direct assignment');

SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000b1","role":"authenticated"}', true);
SELECT is(
  (SELECT count(*)::int FROM public.assignments WHERE client_id = '00000000-0000-0000-0000-0000000000a1'),
  0, 'client B cannot see A''s direct assignment');

-- ---- groups: coach-owned; fan-out to members only --------------------------
SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000c1","role":"authenticated"}', true);
SELECT lives_ok($$
  INSERT INTO public.client_groups (id, coach_id, name)
  VALUES ('00000000-0000-0000-0000-0000000000d1', '00000000-0000-0000-0000-0000000000c1', 'Squad')
$$, 'coach can create a group');
SELECT lives_ok($$
  INSERT INTO public.client_group_members (group_id, client_id)
  VALUES ('00000000-0000-0000-0000-0000000000d1', '00000000-0000-0000-0000-0000000000b1')
$$, 'coach can add a member to their own group');
SELECT lives_ok($$
  INSERT INTO public.assignments (coach_id, group_id, kind, title)
  VALUES ('00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-0000000000d1', 'announcement', 'Group news')
$$, 'coach can create a group assignment');

SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000b1","role":"authenticated"}', true);
SELECT is(
  (SELECT count(*)::int FROM public.assignments WHERE group_id = '00000000-0000-0000-0000-0000000000d1'),
  1, 'group member B sees the group assignment (fan-out)');

SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}', true);
SELECT is(
  (SELECT count(*)::int FROM public.assignments WHERE group_id = '00000000-0000-0000-0000-0000000000d1'),
  0, 'non-member A cannot see the group assignment');

-- ---- reminders: direct target only -----------------------------------------
SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000c1","role":"authenticated"}', true);
SELECT lives_ok($$
  INSERT INTO public.reminders (coach_id, client_id, title)
  VALUES ('00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-0000000000a1', 'Drink water')
$$, 'coach can create a reminder for a client');

SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}', true);
SELECT is(
  (SELECT count(*)::int FROM public.reminders WHERE client_id = '00000000-0000-0000-0000-0000000000a1'),
  1, 'client A sees their reminder');

SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000b1","role":"authenticated"}', true);
SELECT is(
  (SELECT count(*)::int FROM public.reminders WHERE client_id = '00000000-0000-0000-0000-0000000000a1'),
  0, 'client B cannot see A''s reminder');

-- ---- push subscriptions: private to owner ----------------------------------
SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}', true);
SELECT lives_ok($$
  INSERT INTO public.push_subscriptions (user_id, endpoint, keys)
  VALUES ('00000000-0000-0000-0000-0000000000a1', 'https://push.example/a1', '{"p256dh":"x","auth":"y"}'::jsonb)
$$, 'user can register their own push subscription');

SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000b1","role":"authenticated"}', true);
SELECT is(
  (SELECT count(*)::int FROM public.push_subscriptions WHERE user_id = '00000000-0000-0000-0000-0000000000a1'),
  0, 'push subscriptions are private to their owner');

-- ---- check_ins: owner writes; active coach reads; others blocked -----------
SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}', true);
SELECT lives_ok($$
  INSERT INTO public.check_ins (id, user_id, date, mood)
  VALUES ('00000000-0000-0000-0000-00000000cc01', '00000000-0000-0000-0000-0000000000a1', '2026-05-29', 4)
$$, 'client A can insert own check_in');

SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000c1","role":"authenticated"}', true);
SELECT is(
  (SELECT count(*)::int FROM public.check_ins WHERE user_id = '00000000-0000-0000-0000-0000000000a1'),
  1, 'coach c1 can SELECT active client A check_ins');

SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000b1","role":"authenticated"}', true);
SELECT is(
  (SELECT count(*)::int FROM public.check_ins WHERE user_id = '00000000-0000-0000-0000-0000000000a1'),
  0, 'pending client B sees 0 of A check_ins');

-- ---- coach_notes: private to authoring coach; client cannot see ------------
SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000c1","role":"authenticated"}', true);
SELECT lives_ok($$
  INSERT INTO public.coach_notes (id, coach_id, client_id, body)
  VALUES ('00000000-0000-0000-0000-00000000cn01', '00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-0000000000a1', 'private note')
$$, 'coach c1 can insert a coach_note for client A');

SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}', true);
SELECT is(
  (SELECT count(*)::int FROM public.coach_notes WHERE client_id = '00000000-0000-0000-0000-0000000000a1'),
  0, 'client A sees 0 coach_notes (private to coach)');

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

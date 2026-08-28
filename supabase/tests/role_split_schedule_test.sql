-- ============================================================
-- RLS + ROLE-SPLIT TESTS — profiles.role, become_coach(),
-- workout_schedule policies, progress-photos storage policies.
-- Run with:  supabase test db
-- ============================================================

BEGIN;
SELECT plan(20);

-- ---- seed users (coach-to-be C2, trainee A2, unrelated B2) -----------------
INSERT INTO auth.users (id, instance_id, aud, role, email)
VALUES
  ('00000000-0000-0000-0000-0000000000c2', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'coach2@test.dev'),
  ('00000000-0000-0000-0000-0000000000a2', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'a2@test.dev'),
  ('00000000-0000-0000-0000-0000000000b2', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'b2@test.dev');

-- ---- 1. role defaults to trainee at signup (handle_new_user) ---------------
SELECT is(
  (SELECT role FROM public.profiles WHERE id = '00000000-0000-0000-0000-0000000000a2'),
  'trainee', 'new signups default to role=trainee');

-- ---- 2. guard: cannot self-promote to coach without coach_profiles ----------
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a2","role":"authenticated"}', true);
SELECT throws_ok($$
  UPDATE public.profiles SET role = 'coach' WHERE id = '00000000-0000-0000-0000-0000000000a2'
$$, '23514', 'role_coach_requires_coach_profile', 'self-promotion to coach without coach_profiles is blocked');

-- ---- 3. same-value role update is a no-op (guard does not block) ------------
SELECT lives_ok($$
  UPDATE public.profiles SET role = 'trainee' WHERE id = '00000000-0000-0000-0000-0000000000a2'
$$, 'same-value role update passes the guard');

-- ---- 4-8. promotion to coach is ADMIN-ONLY ----------------------------------
-- 20260828000000_admin_coach_assignment.sql revoked become_coach() from the
-- `authenticated` role: a trainee promoting itself to coach is a privilege
-- escalation (a coach reads and writes its trainees' data). The only promotion
-- path is now an app_admins member calling admin_set_coach().
SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000c2","role":"authenticated"}', true);
SELECT throws_ok($$ SELECT public.become_coach('סטודיו כושר') $$,
  '42501', NULL, 'become_coach() is refused for an authenticated user (self-promotion closed)');

-- seed an operator (out-of-band, as superuser) and promote C2 through the admin path
RESET ROLE;
INSERT INTO auth.users (id, instance_id, aud, role, email)
VALUES ('00000000-0000-0000-0000-0000000000d2', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'admin2@test.dev');
INSERT INTO public.app_admins (user_id) VALUES ('00000000-0000-0000-0000-0000000000d2');
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000d2","role":"authenticated"}', true);
SELECT public.admin_set_coach('00000000-0000-0000-0000-0000000000c2', 'סטודיו כושר');

RESET ROLE;
SELECT is(
  (SELECT role FROM public.profiles WHERE id = '00000000-0000-0000-0000-0000000000c2'),
  'coach', 'admin_set_coach() flips profiles.role to coach');
SELECT is(
  (SELECT count(*)::int FROM public.coach_profiles WHERE id = '00000000-0000-0000-0000-0000000000c2'),
  1, 'admin_set_coach() creates the coach_profiles row');
SELECT is(
  (SELECT count(*)::int FROM public.coach_subscriptions WHERE coach_id = '00000000-0000-0000-0000-0000000000c2'),
  1, 'admin_set_coach() seeds a subscription row');

-- and it stays shut for a user who is already a coach
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000c2","role":"authenticated"}', true);
SELECT throws_ok($$ SELECT public.become_coach() $$,
  '42501', NULL, 'become_coach() stays refused after the admin promotion');

-- ---- seed an ACTIVE coach<->client link (C2 coaches A2) ---------------------
RESET ROLE;
UPDATE public.coach_subscriptions SET seat_limit = 10 WHERE coach_id = '00000000-0000-0000-0000-0000000000c2';
INSERT INTO public.coach_clients (coach_id, client_id, status, consent_at)
VALUES ('00000000-0000-0000-0000-0000000000c2', '00000000-0000-0000-0000-0000000000a2', 'active', NOW());
SET LOCAL ROLE authenticated;

-- ---- 9-15. workout_schedule policies ----------------------------------------
-- coach schedules a workout for the ACTIVE client
SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000c2","role":"authenticated"}', true);
SELECT lives_ok($$
  INSERT INTO public.workout_schedule (id, coach_id, user_id, template_id, scheduled_date, title)
  VALUES ('00000000-0000-0000-0000-00000000ee01', '00000000-0000-0000-0000-0000000000c2',
          '00000000-0000-0000-0000-0000000000a2', '00000000-0000-0000-0000-00000000aa01', CURRENT_DATE, 'יום A')
$$, 'coach can schedule a workout for an ACTIVE client');

-- coach cannot schedule for an unrelated user
SELECT throws_ok($$
  INSERT INTO public.workout_schedule (coach_id, user_id, scheduled_date, title)
  VALUES ('00000000-0000-0000-0000-0000000000c2', '00000000-0000-0000-0000-0000000000b2', CURRENT_DATE, 'X')
$$, '42501', NULL, 'coach cannot schedule for a non-client');

-- trainee reads own schedule
SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a2","role":"authenticated"}', true);
SELECT is(
  (SELECT count(*)::int FROM public.workout_schedule WHERE user_id = '00000000-0000-0000-0000-0000000000a2'),
  1, 'trainee sees the coach-scheduled workout');

-- trainee marks it done
SELECT lives_ok($$
  UPDATE public.workout_schedule SET status = 'done', completed_at = NOW()
  WHERE id = '00000000-0000-0000-0000-00000000ee01'
$$, 'trainee can mark a scheduled workout done');

-- unrelated user sees nothing
SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000b2","role":"authenticated"}', true);
SELECT is(
  (SELECT count(*)::int FROM public.workout_schedule WHERE user_id = '00000000-0000-0000-0000-0000000000a2'),
  0, 'unrelated user cannot read another user''s schedule');

-- trainee self-schedules
SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a2","role":"authenticated"}', true);
SELECT lives_ok($$
  INSERT INTO public.workout_schedule (user_id, scheduled_date, title)
  VALUES ('00000000-0000-0000-0000-0000000000a2', CURRENT_DATE + 1, 'אימון עצמי')
$$, 'trainee can self-schedule a workout');

-- coach sees both rows
SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000c2","role":"authenticated"}', true);
SELECT is(
  (SELECT count(*)::int FROM public.workout_schedule WHERE user_id = '00000000-0000-0000-0000-0000000000a2'),
  2, 'coach reads the active client''s full schedule');

-- ---- 16-20. progress-photos storage policies --------------------------------
SELECT is(
  (SELECT count(*)::int FROM storage.buckets WHERE id = 'progress-photos'),
  1, 'progress-photos bucket exists');

-- owner uploads into own folder
SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a2","role":"authenticated"}', true);
SELECT lives_ok($$
  INSERT INTO storage.objects (bucket_id, name, owner)
  VALUES ('progress-photos', '00000000-0000-0000-0000-0000000000a2/ci1/p1.webp',
          '00000000-0000-0000-0000-0000000000a2')
$$, 'owner can upload into their own folder');

-- the active coach can read it
SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000c2","role":"authenticated"}', true);
SELECT is(
  (SELECT count(*)::int FROM storage.objects
   WHERE bucket_id = 'progress-photos'
     AND name = '00000000-0000-0000-0000-0000000000a2/ci1/p1.webp'),
  1, 'active coach can read the client''s progress photo');

-- an unrelated user cannot
SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000b2","role":"authenticated"}', true);
SELECT is(
  (SELECT count(*)::int FROM storage.objects
   WHERE bucket_id = 'progress-photos'
     AND name = '00000000-0000-0000-0000-0000000000a2/ci1/p1.webp'),
  0, 'unrelated user cannot read another user''s progress photo');

-- nobody can upload into someone else's folder
SELECT throws_ok($$
  INSERT INTO storage.objects (bucket_id, name, owner)
  VALUES ('progress-photos', '00000000-0000-0000-0000-0000000000a2/ci1/p2.webp',
          '00000000-0000-0000-0000-0000000000b2')
$$, '42501', NULL, 'cross-folder upload is blocked');

SELECT * FROM finish();
ROLLBACK;

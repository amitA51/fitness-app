-- ============================================================
-- ADMIN-ONLY COACH ASSIGNMENT TESTS — app_admins, is_app_admin(),
-- admin_set_coach(), and the closed become_coach() self-promotion path.
-- Run with:  supabase test db
-- ============================================================

BEGIN;
SELECT plan(15);

-- ---- seed users (admin D3, promotion target C3, plain trainees A3/B3) ------
INSERT INTO auth.users (id, instance_id, aud, role, email)
VALUES
  ('00000000-0000-0000-0000-0000000000d3', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'admin3@test.dev'),
  ('00000000-0000-0000-0000-0000000000c3', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'target3@test.dev'),
  ('00000000-0000-0000-0000-0000000000a3', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'a3@test.dev'),
  ('00000000-0000-0000-0000-0000000000b3', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'b3@test.dev');

-- Admin membership is granted out-of-band only (service_role / superuser SQL).
INSERT INTO public.app_admins (user_id)
VALUES ('00000000-0000-0000-0000-0000000000d3');

-- ---- 1-2. is_app_admin() reflects membership -------------------------------
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a3","role":"authenticated"}', true);
SELECT is(public.is_app_admin(), false, 'is_app_admin() is false for a normal authenticated user');

SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000d3","role":"authenticated"}', true);
SELECT is(public.is_app_admin(), true, 'is_app_admin() is true for an app_admins member');

-- ---- 3. a normal authenticated user cannot INSERT into app_admins ----------
SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a3","role":"authenticated"}', true);
SELECT throws_ok($$
  INSERT INTO public.app_admins (user_id) VALUES ('00000000-0000-0000-0000-0000000000a3')
$$, '42501', NULL, 'a normal authenticated user cannot INSERT into app_admins (no self-service admin)');

-- ---- 4. not even an admin can grant admin from a client session ------------
SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000d3","role":"authenticated"}', true);
SELECT throws_ok($$
  INSERT INTO public.app_admins (user_id) VALUES ('00000000-0000-0000-0000-0000000000b3')
$$, '42501', NULL, 'an app_admins member still cannot INSERT into app_admins from a client session');

-- ---- 5-6. app_admins is readable own-row-only -------------------------------
SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a3","role":"authenticated"}', true);
SELECT is(
  (SELECT count(*)::int FROM public.app_admins),
  0, 'a non-admin cannot see any app_admins row');

SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000d3","role":"authenticated"}', true);
SELECT is(
  (SELECT count(*)::int FROM public.app_admins),
  1, 'an admin sees exactly its own app_admins row');

-- ---- 7. become_coach() is no longer reachable from a client session --------
SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a3","role":"authenticated"}', true);
SELECT throws_ok($$
  SELECT public.become_coach('סטודיו עצמי')
$$, '42501', NULL, 'a normal authenticated user calling become_coach() is refused (self-promotion closed)');

-- ---- 8-11. the admin path promotes the target ------------------------------
SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000d3","role":"authenticated"}', true);
SELECT lives_ok($$
  SELECT public.admin_set_coach('00000000-0000-0000-0000-0000000000c3', 'סטודיו אימונים')
$$, 'an app_admins member can call admin_set_coach()');

RESET ROLE;
SELECT is(
  (SELECT role FROM public.profiles WHERE id = '00000000-0000-0000-0000-0000000000c3'),
  'coach', 'admin_set_coach() leaves the target with profiles.role = coach');
SELECT is(
  (SELECT count(*)::int FROM public.coach_profiles WHERE id = '00000000-0000-0000-0000-0000000000c3'),
  1, 'admin_set_coach() creates the target coach_profiles row');
SELECT is(
  (SELECT count(*)::int FROM public.coach_subscriptions WHERE coach_id = '00000000-0000-0000-0000-0000000000c3'),
  1, 'admin_set_coach() seeds the target subscription row');

-- ---- 12-13. idempotent on re-call ------------------------------------------
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000d3","role":"authenticated"}', true);
SELECT lives_ok($$
  SELECT public.admin_set_coach('00000000-0000-0000-0000-0000000000c3')
$$, 'admin_set_coach() is idempotent on re-call');

RESET ROLE;
SELECT is(
  (SELECT count(*)::int FROM public.coach_profiles WHERE id = '00000000-0000-0000-0000-0000000000c3'),
  1, 'the re-call did not duplicate the coach_profiles row');

-- ---- 14-15. a non-admin cannot use the admin path --------------------------
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a3","role":"authenticated"}', true);
SELECT throws_ok($$
  SELECT public.admin_set_coach('00000000-0000-0000-0000-0000000000b3', 'סטודיו מזויף')
$$, '42501', 'not_app_admin', 'a non-admin calling admin_set_coach() is refused');

RESET ROLE;
SELECT is(
  (SELECT role FROM public.profiles WHERE id = '00000000-0000-0000-0000-0000000000b3'),
  'trainee', 'the refused admin_set_coach() call left the target a trainee');

SELECT * FROM finish();
ROLLBACK;

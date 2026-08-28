-- ============================================================
-- ADMIN USER LOOKUP TESTS — public.admin_list_users()
--
-- Sibling of admin_coach_assignment_test.sql. Proves the privilege gate, the
-- case-insensitive substring match on email OR display_name, the empty-query
-- behaviour, and the server-side _limit clamp.
--
-- Run with:  supabase test db
-- ============================================================

BEGIN;
SELECT plan(19);

-- ---- seed users (admin D4, plain trainees A4/B4/C4) ------------------------
INSERT INTO auth.users (id, instance_id, aud, role, email)
VALUES
  ('00000000-0000-0000-0000-0000000000d4', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'admin4@test.dev'),
  ('00000000-0000-0000-0000-0000000000a4', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'alice.runner@test.dev'),
  ('00000000-0000-0000-0000-0000000000b4', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'bob.lifter@example.org'),
  ('00000000-0000-0000-0000-0000000000c4', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'carol.swim@test.dev');

-- handle_new_user() seeded display_name from the email local-part. Overwrite so
-- the display_name proofs use a needle that does NOT also appear in the email.
UPDATE public.profiles SET display_name = 'Alice Runner'  WHERE id = '00000000-0000-0000-0000-0000000000a4';
UPDATE public.profiles SET display_name = 'Bob Lifter'    WHERE id = '00000000-0000-0000-0000-0000000000b4';
UPDATE public.profiles SET display_name = 'Carol Swimmer' WHERE id = '00000000-0000-0000-0000-0000000000c4';

-- Admin membership is granted out-of-band only (service_role / superuser SQL).
INSERT INTO public.app_admins (user_id)
VALUES ('00000000-0000-0000-0000-0000000000d4');

-- ---- 1-2. grants: the gate is inside the function, not on the grant --------
SELECT is(
  has_function_privilege('anon', 'public.admin_list_users(text,int)', 'EXECUTE'),
  false, 'anon has no EXECUTE on admin_list_users()');
SELECT is(
  has_function_privilege('authenticated', 'public.admin_list_users(text,int)', 'EXECUTE'),
  true, 'authenticated keeps EXECUTE on admin_list_users() — the gate is inside');

-- ---- 3. a non-admin is refused --------------------------------------------
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a4","role":"authenticated"}', true);
SELECT throws_ok($$
  SELECT * FROM public.admin_list_users('alice')
$$, '42501', 'not_app_admin', 'a non-admin calling admin_list_users() is refused');

-- ---- 4-7. an admin finds a user by an EMAIL substring ----------------------
-- 'example' appears only in bob.lifter@example.org, never in a display_name.
SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000d4","role":"authenticated"}', true);
SELECT lives_ok($$
  SELECT * FROM public.admin_list_users('example')
$$, 'an app_admins member can call admin_list_users()');

SELECT is(
  (SELECT count(*)::int FROM public.admin_list_users('example')),
  1, 'an email substring matches exactly the one seeded user');
SELECT is(
  (SELECT user_id FROM public.admin_list_users('example')),
  '00000000-0000-0000-0000-0000000000b4'::uuid,
  'the email substring match returns the right user_id');
SELECT is(
  (SELECT email FROM public.admin_list_users('example')),
  'bob.lifter@example.org',
  'the projection carries auth.users.email — unreadable without SECURITY DEFINER');

-- ---- 8-9. an admin finds a user by a DISPLAY_NAME substring ----------------
-- 'Swimmer' appears only in the display_name; the email is carol.swim@test.dev.
SELECT is(
  (SELECT count(*)::int FROM public.admin_list_users('Swimmer')),
  1, 'a display_name substring matches exactly the one seeded user');
SELECT is(
  (SELECT user_id FROM public.admin_list_users('Swimmer')),
  '00000000-0000-0000-0000-0000000000c4'::uuid,
  'the display_name substring match returns the right user_id');

-- ---- 10-11. the match is case-insensitive on both columns ------------------
SELECT is(
  (SELECT count(*)::int FROM public.admin_list_users('sWiMmEr')),
  1, 'the display_name match is case-insensitive');
SELECT is(
  (SELECT count(*)::int FROM public.admin_list_users('EXAMPLE.ORG')),
  1, 'the email match is case-insensitive');

-- ---- 12-14. NULL / empty / whitespace query lists instead of erroring ------
SELECT ok(
  (SELECT count(*)::int FROM public.admin_list_users(NULL)) >= 4,
  'a NULL query returns the most recent users rather than erroring');
SELECT ok(
  (SELECT count(*)::int FROM public.admin_list_users('')) >= 4,
  'an empty query is treated as no filter');
SELECT ok(
  (SELECT count(*)::int FROM public.admin_list_users('   ')) >= 4,
  'a whitespace-only query is treated as no filter');

-- ---- 15. _limit is respected -----------------------------------------------
SELECT is(
  (SELECT count(*)::int FROM public.admin_list_users(NULL, 2)),
  2, '_limit caps the row count');

-- ---- 16-17. the role column is live, not a constant ------------------------
SELECT lives_ok($$
  SELECT public.admin_set_coach('00000000-0000-0000-0000-0000000000c4', 'סטודיו שחייה')
$$, 'seed: promote C4 so the role column has something to report');
SELECT is(
  (SELECT role FROM public.admin_list_users('Swimmer')),
  'coach', 'the role column reflects the promotion');

-- ---- 18-19. the clamp, proven against MORE than the maximum ----------------
-- 105 extra users so "clamped to 100" is a real observation and not just
-- "there were never 100 rows to return".
RESET ROLE;
INSERT INTO auth.users (id, instance_id, aud, role, email)
SELECT gen_random_uuid(), '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
       'bulk' || g || '@test.dev'
FROM generate_series(1, 105) g;

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000d4","role":"authenticated"}', true);
SELECT is(
  (SELECT count(*)::int FROM public.admin_list_users(NULL, 100000)),
  100, 'an absurd client _limit is clamped server-side to 100');
SELECT is(
  (SELECT count(*)::int FROM public.admin_list_users(NULL, 0)),
  20, 'a zero _limit falls back to the default 20');

RESET ROLE;
SELECT * FROM finish();
ROLLBACK;

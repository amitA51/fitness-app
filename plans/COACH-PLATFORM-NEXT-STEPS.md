# Coach Platform — Next Steps (Agent Handoff)

> Hand this file to an implementing agent. It continues the "Coach Mode" work
> already merged (see `plans/COACH-PLATFORM-PLAN.md` and `docs/COACH_PLATFORM.md`).
> Goal: take coaching from a working backbone to a polished, production-grade,
> deeply integrated part of the app.

---

## 0. Context the agent must read first

**What already exists (built, typecheck/lint/test/build green, NOT yet deployed):**
- DB migration `supabase/migrations/20260529000000_coach_platform.sql` — profiles,
  coach_profiles, coach_clients (the link), coach_invites, client_groups(+members),
  assignments, messages, reminders, coach_subscriptions, push_subscriptions; RLS helpers
  `is_coach_of/is_client_of/is_group_member`; cross-user coach RLS on 9 trainee tables;
  seat-limit trigger; `updated_by` audit columns; profile signup trigger + backfill.
- Edge functions `supabase/functions/coach-invite-accept` and `coach-push-send`.
- Services `src/services/coach/*` (profile, relationship, invite, coachApi, assignment,
  message, group, reminder, push, realtime, mappers, barrel `index.ts`).
- Context `src/contexts/CoachContext.tsx` (`useCoach`: isCoach, coachProfile, subscription, enable).
- Pages `src/pages/coach/*` + `src/pages/MyCoach.tsx` + `src/pages/JoinPage.tsx`.
- Wiring: routes `/coach*`, `/my-coach*`, `/join` in `src/App.tsx`; context-aware "מאמן" tab
  in `src/components/ui/BottomNav.tsx`; Web Push handler `public/push-sw.js` via
  `vite.config.ts` `importScripts`; reminder materialization interval in `AppShell`.
- Tests: `src/services/__tests__/coach.test.ts` (units) + `supabase/tests/coach_rls_test.sql` (pgTAP).

**Conventions (match these):**
- Hebrew RTL, "Fresh Steel" design via CSS vars (`--fs-bg/-ink/-surface/-surface-2/-accent/-primary/-heading/-muted`, `--font-body/-mono`). Reuse `components/ui/Button`, `Toast.showToast`, and `pages/coach/_shared.tsx` (`CoachPage`, `Section`, `ListRow`, `EmptyHint`, `useAsyncData`, `formatDate`).
- **Dual data path (critical):** the coach reads/writes a trainee's data via `coachApi` (direct Supabase, online). NEVER route a trainee's data through the coach's local IndexedDB. The trainee's own data stays local-first.
- Services degrade gracefully (return `[]`/`{error}`), use `logger`, snake_case columns, `getCurrentUser()` from `services/supabaseAuth`.
- Don't edit historical migrations — add new timestamped ones and keep `supabase/schema.sql` in sync.
- New network endpoints must auth the JWT and authorize against `coach_clients` — never trust client IDs.

**Verify after every task:** `npm run typecheck` · `npm run lint:check` (baseline already has
~131 pre-existing a11y findings in OTHER files — do not add new ones) · `npm run test:run` ·
`npm run build`. Do not commit unless asked.

---

## Phase A — Make it live (infra; use Supabase + Netlify MCP)

- **A1. Apply the migration.** Run `20260529000000_coach_platform.sql` on the project (it is
  idempotent). *Accept:* all coach tables + policies exist; `select public.is_coach_of(gen_random_uuid())` runs.
- **A2. Deploy edge functions + secrets.** Deploy `coach-invite-accept` and `coach-push-send`.
  Set secrets: `ALLOWED_ORIGIN` (prod + localhost), `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`,
  `VAPID_SUBJECT` (`npx web-push generate-vapid-keys`). *Accept:* functions return 401 without a JWT, 200 with one.
- **A3. Enable Realtime** on `assignments`, `messages`, and the trainee tables coaches edit
  (`workout_templates`, `nutrition_logs`). *Accept:* `subscribeToAssignments` fires on insert.
- **A4. Netlify env (project already exists — only ADD vars).** Add `VITE_VAPID_PUBLIC_KEY`
  (and confirm `VITE_SUPABASE_URL`/`ANON_KEY` are set). Trigger a deploy. *Accept:* built app
  registers a push subscription without `no_vapid_key`.
- **A5. Run the RLS suite:** `supabase test db`. *Accept:* `coach_rls_test.sql` passes (7 assertions).

---

## Phase B — Close the wiring gaps

- **B1. Settings integration.** In `src/pages/Settings.tsx` add a "Coaching / מאמן" card:
  a display-name row (use `profileService.getMyProfile/updateMyProfile`), a "מצב מאמן" toggle
  (uses `useCoach().enable()` / shows status), and links to `/coach` and `/my-coach`.
  *Accept:* user edits name, enables coach mode, and navigates to both hubs from Settings.
- **B2. Live messaging + unread badges.** In `src/pages/coach/MessageThread.tsx` subscribe to the
  thread via Realtime (extend `services/coach/realtime.ts` with `subscribeToThread(coachId, clientId, cb)`),
  appending new messages live. Add an unread badge to the "מאמן" nav tab using
  `messageService.getUnreadCount` (poll or Realtime). *Accept:* two browsers see messages live; badge clears on open.
- **B3. Reflect coach edits to the trainee.** When a coach edits a template/nutrition target,
  the trainee's local-first store must update. Add a trainee-side Realtime listener (reuse
  `subscribeToUserTable('workout_templates', me, ...)`) that triggers the existing cloud
  pull/merge (`mergeWorkoutTemplatesFromCloud`) and a `dataEvents` refresh. *Accept:* coach edit
  appears on the trainee's Templates screen without a manual sync.
- **B4. Assigned program → start workout.** Render `assignments` of kind `program` in `MyCoach`
  with a "התחל אימון" action that loads the referenced template into the existing ActiveWorkout
  flow (`/workout/:templateId`). *Accept:* trainee starts a coach-assigned workout end-to-end.
- **B5. Assigned nutrition target → drives goals.** When an active `nutrition_target` assignment
  exists, surface it as the trainee's daily goal on `src/pages/Nutrition.tsx` (read via
  `assignmentService.listMyAssignments`). *Accept:* the assigned calories/macros show as the target ring.

---

## Phase C — Elevate to product grade

- **C1. Program builder (coach).** A multi-day program editor: coach composes
  days/exercises/sets and assigns as one `program` assignment (payload = structured plan, or a
  real `workout_templates` row written to the client via `coachApi.upsertClientTemplate`).
  *Accept:* coach builds a 3-day split and assigns it; trainee sees all days.
- **C2. Coach dashboard analytics.** On `/coach` and `/coach/clients/:id`, compute per-client
  adherence (sessions/week vs target), last-activity, 4-week volume trend, and flag clients
  inactive ≥ N days. Reuse `analyticsService` patterns on coachApi data. *Accept:* roster shows a
  status chip per client; inactive clients are flagged.
- **C3. Check-ins, notes, timeline.** Add a `check_ins` table (weekly: weight, photos ref, mood,
  free text) + coach private notes on a client + a unified activity timeline. New migration +
  RLS (coach + owner). *Accept:* trainee submits a weekly check-in; coach sees it on the client page.
- **C4. Roster UX.** Search, sort, tag/segment filters (use `coach_clients.tags`), and a status
  manager (active/paused/ended) with confirm. *Accept:* coach filters roster by tag and pauses a client.
- **C5. Notifications.** Call `coach-push-send` (and create reminder-driven pushes) on: new
  assignment, new message, coach-set reminders; notify the coach on client workout completion /
  missed days. *Accept:* trainee receives a push for a new assignment with the app closed.
- **C6. Trainee onboarding via invite.** A user who opens `/join?code=` while logged out should
  sign up, then auto-accept and land in `MyCoach`. *Accept:* cold invite link → signup → connected.

---

## Phase D — Hardening & quality

- **D1. Expand RLS tests** to `messages`, `assignments`, `client_groups(+members)`, `reminders`,
  `push_subscriptions` (participant-only; group fan-out; non-member denial). Extend `coach_rls_test.sql`.
- **D2. Edge-function validation + rate limiting.** Validate/normalize input; throttle invite
  creation and accept attempts (per-user, per-IP). *Accept:* brute-forcing codes is rate-limited.
- **D3. Audit log.** Add an `audit_log` table written on coach writes to client data (who/what/when);
  surface a per-client audit view. *Accept:* a coach edit produces an audit row.
- **D4. E2E happy path** (Playwright or similar): invite → consent → coach views → assigns →
  messages → trainee disconnects → access revoked.
- **D5. Unit/component coverage.** Mock Supabase for every `coach/*` service; render-test each
  coach page (loading/empty/error). Target the project's existing coverage bar.
- **D6. Polish.** Loading skeletons (reuse `SkeletonLoader`), empty states (`EmptyState`),
  a11y on new screens (labels, focus, roles — keep Biome clean), and consistent error toasts.

---

## Phase E — Billing (design-only → real)

- **E1. Stripe.** Replace manual seats with Stripe subscriptions + per-seat metering; seat
  management UI; billing portal; webhook → `coach_subscriptions`. Volume-discount tiers for coaches,
  solo plan for individuals. Keep the existing seat trigger as the enforcement floor.
  *Accept:* purchasing seats raises `seat_limit`; exceeding it still blocks at the DB.

---

## Suggested order
A (live) → B (gaps, immediately useful) → C1/C2/C5 (highest product value) → D (harden) →
C3/C4/C6 → E (when monetizing). Ship each task behind the existing coach gating so the trainee
experience is never regressed.

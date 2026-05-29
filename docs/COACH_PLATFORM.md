# Coach Platform — Architecture & Security

A coaching layer on top of the single-user SparkOS app. One account can be both a
trainee (trains themselves, local-first) and a coach (manages others, online).

## Data path (the key split)

- **Trainee (own data):** unchanged — IndexedDB local-first → `syncEngine` → Supabase.
- **Coach (a trainee's data):** `src/services/coach/coachApi.ts` reads/writes Supabase
  **directly**, parameterized by `clientId`. It never touches the coach's local IndexedDB
  (which is wiped on logout and only holds the current user's own data).

```
Trainee UI ─▶ IndexedDB ─▶ syncEngine ─▶ Supabase(RLS)
Coach UI   ─▶ coachApi ───────────────▶ Supabase(RLS)
```

## Security model (RLS is the boundary)

Migration: `supabase/migrations/20260529000000_coach_platform.sql`.

- Helper `is_coach_of(client)` / `is_client_of(coach)` (STABLE, SECURITY DEFINER) check an
  **ACTIVE** `coach_clients` link. `is_group_member(group)` checks membership.
- Every trainee-data table (`workout_sessions`, `workout_templates`, `personal_exercises`,
  `body_weight`, `body_measurements`, `personal_records`, `recovery_logs`, `nutrition_logs`,
  `water_logs`) gets coach `SELECT/INSERT/UPDATE/DELETE` policies gated on `is_coach_of(user_id)`.
  `user_settings` and `ai_conversations` are intentionally **excluded** (private).
- **Consent:** a link becomes `active` only when the trainee accepts (sets `consent_at`).
  `pending`/`paused`/`ended` deny coach access. Disconnect = set `ended` → access cut **immediately**.
- **Coach edits** stamp `updated_by` for an audit trail.
- **Seats:** `enforce_seat_limit()` trigger blocks activating a link beyond
  `coach_subscriptions.seat_limit` (design-only; no payment processor).

RLS isolation is verified by `supabase/tests/coach_rls_test.sql` — run with `supabase test db`.
It asserts: trainee↔trainee denial, coach access only on active link, instant revocation,
coach write to an active client, and seat-limit enforcement.

## Edge functions (trusted server logic)

- `coach-invite-accept` — JWT-authenticated; validates the invite code/expiry, enforces seats,
  records consent, and activates the link with the service role (RLS hides invites from clients).
- `coach-push-send` — authorizes coach→client (active link) or self, then fans Web Push out to the
  target's `push_subscriptions`. Requires VAPID secrets.

Both verify the caller's JWT and authorize against `coach_clients`; they never trust client IDs.

## Surfaces

- Coach: `/coach` (roster + enable CTA), `/coach/clients/:id`, `/coach/invites`,
  `/coach/groups`, `/coach/messages[/:otherId]`.
- Trainee: `/my-coach` (connect by code, assignments inbox, disconnect),
  `/my-coach/messages/:otherId`, `/join?code=` (consent screen).
- `BottomNav` shows a context-aware "מאמן" tab (coach hub when coach, else My Coach).

## Reminders & Web Push

- Reminders materialize as local notifications while the app is open
  (`reminderService.materializeDueReminders`, polled每60s from `AppShell`).
- Closed-app delivery uses Web Push: `pushService` subscribes the device; `public/push-sw.js`
  (imported into the Workbox SW) displays the notification; `coach-push-send` delivers it.
- Set `VITE_VAPID_PUBLIC_KEY` (client) + `VAPID_PUBLIC_KEY`/`VAPID_PRIVATE_KEY`/`VAPID_SUBJECT`
  (Supabase secrets). Generate with `npx web-push generate-vapid-keys`.

## Deploy checklist

1. Apply the migration (Supabase SQL editor or `supabase db push`).
2. `supabase functions deploy coach-invite-accept` and `coach-push-send`.
3. Set secrets: `ALLOWED_ORIGIN`, VAPID keys.
4. Set `VITE_VAPID_PUBLIC_KEY` in the web env.
5. `supabase test db` to run the RLS isolation suite.

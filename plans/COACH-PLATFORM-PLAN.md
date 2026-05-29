# Implementation Plan — Coaching Platform ("Coach Mode")

> Status: in execution. Do NOT commit at end — leave changes for review.

## Problem
Transform the single-user SparkOS journal into a coaching platform: a coach manages many
trainees (view + edit workouts/nutrition/progress), assigns programs/recommendations,
messages them, sets reminders, and groups them — while individuals keep using the app solo.

## Confirmed decisions
- Coach mode is a LAYER on the existing app; one account can be both trainee and coach.
- FULL CONTROL: coach can view + directly edit a linked trainee's data.
- Connection: coach email invite + shareable code/QR, explicit trainee CONSENT, either side disconnects.
- MANY-TO-MANY in schema; UI defaults to one coach for v1.
- ASYNC envelope: messages, announcements, reminders, send programs/notes. No live chat.
- GROUPS + bulk tools.
- Billing DESIGN-ONLY: model seats/entitlements + gate features; no payment processor.
- Keep current UI/design, Hebrew RTL.

## Two critical findings (verified in code)
1. Local-first wipes on sign-out (`supabaseAuth.ts`) — coach screens read/write Supabase
   DIRECTLY via `coachApi`, parameterized by `clientId`. Trainee path stays local-first.
2. Notifications are local-only (`notificationService.ts`) — cross-user reminders need Web Push.

## Data model (new tables)
profiles, coach_profiles, coach_clients (linchpin), coach_invites, client_groups,
client_group_members, assignments, messages, reminders, coach_subscriptions, push_subscriptions.

RLS helper `is_coach_of(client)` / `is_client_of(coach)` (STABLE, SECURITY DEFINER) drive
cross-user policies. Coach gets SELECT + INSERT/UPDATE/DELETE on trainee-data tables.

## Phases / tasks
- P0: (1) profiles + service, (2) enable coach mode.
- P1: (3) coach_clients/invites + RLS, (4) invite+consent flow, (5) roster.
- P2: (6) coachApi reads, (7) client detail.
- P3: (8) assignments, (9) coach edit + audit + realtime, (10) trainee My Coach.
- P4: (11) messages model, (12) messaging UI.
- P5: (13) groups, (14) bulk assign / announcements.
- P6: (15) reminders, (16) Web Push.
- P7: (17) entitlements/seats (design-only).
- P8: (18) security & audit pass + docs.

## Verify after each task
`npm run typecheck` · `npm run lint:check` · `npm run test:run` · `npm run build` (per phase).

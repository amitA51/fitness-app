# Coach platform — follow-ups for a new session

> **STATUS 2026-06-09 (later session): ALL 10 ITEMS DONE.** tsc 0 · 782 tests · build OK ·
> 3 migrations APPLIED to live Supabase (`set_group_members`, `invite_seat_enforcement`,
> `thread_summaries`) · `coach-invite-accept` v5 DEPLOYED · `qrcode.react` added.
> Per-item notes inline below (✅). Still open: the **Decisions needed** section (A–D)
> and the **Verify with a REAL coach account** checklist at the bottom.

> Created 2026-06-09 after the coach view-switch + 8-wave audit/fix campaign.
> Branch: `feat/screen-elevation` · Status at handoff: **tsc 0 · 770 tests · build OK · UNCOMMITTED**.
> Background: see memory `coach-viewswitch-overhaul-2026-06-09` and the audit/fix
> workflow outputs. The P0 correctness fixes (soft-delete reads, silent-failure
> epidemic, association robustness) are **already done**. Everything below was
> deliberately deferred because it needs a DB migration, an edge-function change,
> a new npm dependency, a cross-file refactor, or a product decision.

## How to use this file
Each item is self-contained: **What / Why / Where / How / Needs / Done-when.**
Pick any item; they're independent unless noted. Re-run the gate after each:
`npx tsc --noEmit && npx vitest run && npx vite build`.

---

## P0 — correctness & data-integrity (server-side; finish what the client stopgaps point at)

### 1. Atomic `set_group_members` RPC ✅ DONE
- **What:** Replace the client-side diff-based group-membership update with a single transactional RPC.
- **Why:** `groupService.setGroupMembers` now diffs (insert added / delete removed) so a mid-failure can't wipe a group — but it's still two round-trips, not atomic. A true RPC removes the race entirely.
- **Where:** `src/services/coach/groupService.ts` + new `supabase/migrations/*_set_group_members.sql`.
- **How:** `create function set_group_members(_group_id uuid, _client_ids uuid[])` (SECURITY DEFINER, scoped to `coach_id = auth.uid()`) that diffs inside one transaction; call it from the service and delete the client-side diff loop.
- **Needs:** DB migration (apply to live Supabase).
- **Done-when:** group membership edit is one call; a forced failure leaves membership unchanged; existing groupService tests still pass.

### 2. `coach-invite-accept` edge function should emit `'already'` ✅ DONE (v5 deployed)
- **What:** When a trainee re-accepts a code for a coach they're already linked to, return `{ ok:false, error:'already' }`.
- **Why:** The client already maps `'already'` → "כבר מחוברים למאמן הזה" and softened the success toast to "מחובר למאמן", but the function never returns it, so a re-accept still reads as a *new* connection.
- **Where:** `supabase/functions/coach-invite-accept/index.ts` (edge function) + verify `inviteService.acceptInvite` / `useAcceptInvite.inviteErrorMessage` mapping.
- **How:** Before inserting the `coach_clients` link, check for an existing active link and return `'already'`.
- **Needs:** Edge-function deploy.
- **Done-when:** re-entering a known code shows "כבר מחוברים…", not a new-connection toast.

### 3. Server-side seat enforcement on invite creation ✅ DONE (BEFORE INSERT trigger)
- **What:** Reject creating a new *pending* invite once `active clients ≥ seat_limit`.
- **Why:** Seats are only enforced at accept-time today; the UI now disables the create button when full, but a determined client/API call can still mint codes that fail later at the trainee.
- **Where:** invite-create path — either a `before insert` trigger / RLS check on `coach_invites`, or move creation into an RPC. Client: `src/services/coach/inviteService.ts createInvite`.
- **Needs:** DB migration (trigger or RPC).
- **Done-when:** server refuses new pending invites when seats are full; client surfaces the rejection.

### 4. `getClientWeekAdherence` → error state ✅ DONE (throws via throwOnError readers; WeekGrid+StreakStrip SectionError fire)
- **What:** Return a discriminated result on failure and render an error state instead of an all-zero week.
- **Why:** Wave 1 added logging, but a fetch failure is still rendered identically to a genuinely empty week (the return shape stayed `DayAdherence[]` to avoid rippling).
- **Where:** `src/services/coach/coachAnalytics.ts` (signature) → `src/pages/coach/client/tabs/OverviewTab.tsx`, `WeekGrid.tsx`, `StreakStrip` (callers).
- **How:** Change the return to `{ ok:true; days } | { ok:false }`; thread an error state through the callers; add an inline retry (reuse `SectionError`).
- **Needs:** cross-file refactor (no migration).
- **Done-when:** a forced fetch failure shows an error+retry, not a fake empty week.

---

## P1 — features & efficiency (need a dep or a DB view)

### 5. QR-code invite dialog ✅ DONE (qrcode.react + Sheet)
- **What:** Add a QR dialog to `CoachInvites` for in-person onboarding.
- **Why:** Wave 5 shipped share/copy-code/copy-link; QR was skipped to avoid adding a dependency.
- **Where:** `src/pages/coach/CoachInvites.tsx`.
- **How:** add `qrcode` (or `qrcode.react`); render the `inviteLink(code)` in a `<Sheet>`/dialog; Hebrew aria-label; tokenized.
- **Needs:** npm dependency.
- **Done-when:** tapping "QR" shows a scannable code for the invite link.

### 6. Roster signal chips on `CoachClients` ✅ DONE (shared useRosterSignals + RowSignalChips in rosterPrimitives)
- **What:** Show per-client unread / recent-check-in chips on the roster rows (CoachHome already does this for its top-3).
- **Why:** Deferred to keep the wave surgical (it adds a new batched fetch + prop plumbing).
- **Where:** `src/pages/coach/CoachClients.tsx` (fetch `getUnreadCountByClient`, `getRecentCheckInFlags`) + `src/pages/coach/rosterPrimitives.tsx` (`RosterRow` optional `unread?`/`hasRecentCheckIn?` props).
- **Needs:** none (data fns already exist; reuse the CoachHome pattern).
- **Done-when:** roster rows show the same signals as CoachHome's attention list, one batched fetch (no N+1).

### 7. Messaging: "load earlier" + preview/unread aggregate ✅ DONE (getThreadPage/getGroupThreadPage + coach_thread_summaries/group_thread_summaries RPCs with JS fallback)
- **What:** Pagination UI for long threads + an efficient per-thread last-message/unread aggregate for the hub.
- **Why:** Wave 4 shipped the safe client half (bounded desc+limit+reverse); the pagination UI and the aggregate need a DB view/RPC to avoid N queries.
- **Where:** `src/services/coach/messageService.ts`, `groupMessageService.ts`, `src/pages/coach/CoachMessages.tsx`, `MessageThread.tsx`, `GroupThread.tsx`.
- **Needs:** DB view or RPC (for the aggregate); UI work.
- **Done-when:** threads can load older pages; the hub shows last-message + unread without per-thread fan-out.

### 8. `CoachInvites` — expired-row actions + sort ✅ DONE
- **What:** Add a "צור הזמנה חדשה" action on expired/non-pending rows (pre-filling the label) and sort pending-first.
- **Where:** `src/pages/coach/CoachInvites.tsx`.
- **Needs:** none.
- **Done-when:** expired invites are re-creatable in one tap; pending invites sort to the top.

---

## P2 — design tokens & type hygiene

### 9. Define (or remove) missing CSS tokens ✅ DONE (--fs-ink-2 → --fs-muted; bonus: --fs-warning → --fs-warn in LegalDocPage; audit confirms zero undefined --fs-* refs)
- **What:** `var(--fs-ink-2)` is used (e.g. `src/pages/settings/sections/CoachSection.tsx`) but is **not defined** in `src/styles/tokens.css` → it resolves to nothing. `--fs-muted-on-surface` is referenced in audit notes and also missing.
- **How:** either add `--fs-ink-2` / `--fs-muted-on-surface` to tokens.css for **both** light and dark with AA-verified values, or replace the usages with existing tokens (`--fs-ink` / `--fs-muted`). Grep first: `var(--fs-ink-2)`.
- **Needs:** none.
- **Done-when:** no `var(--fs-…)` in `src/` references an undefined token; CoachSection text passes AA in both modes.

### 10. Decide `WorkoutSession.title` concept ✅ DONE (notes-only model; ClientSessionInput shim removed; writers mirror notes→title)
- **What:** `WorkoutSession` (types/index.ts) has no `title`; coachApi now accepts a forward-compat `ClientSessionInput { title? }` and EditSessionSheet uses a notes-only "כותרת" model.
- **How:** either add a real `title` field to `WorkoutSession` end-to-end (type, sync mappers, UI) or keep notes-only and drop the forward-compat shim. Pick one for consistency.
- **Needs:** none (but touches sync types if you add the field).
- **Done-when:** session title is modeled one way across coach + trainee paths.

---

## Decisions needed (no code until you choose)

- **A. Demo flag for prod.** `DEMO_OPEN_VIEW_SWITCH` (CoachContext) defaults ON → *any* authenticated user can flip to coach view and is lazily promoted via `become_coach`. For production set `VITE_DEMO_VIEW_SWITCH='false'` (locks the switch to real coaches; a coach still keeps their personal trainee side). Decide before any prod release.
- **B. Guest coach-view.** Guests can currently preview an empty coach shell (no promotion, RLS-empty). Keep for demo, or hide the switch for guests (`canSwitchView` → require `status==='authenticated'`).
- **C. First-time promote hint.** Becoming a coach via the switch mutates `profiles.role` server-side (the role guard blocks demotion). Consider a one-time confirm/hint the first time a non-coach flips to coach.
- **D. Commit / merge.** Branch `feat/screen-elevation` is UNCOMMITTED and not merged (pushing master may trigger a Netlify prod deploy). Decide commit + merge/deploy strategy.

---

## Verify with a REAL coach account (important)
All browser verification this session was done as a **guest** (empty coach data), which proves the UI/routing but not the data paths. Before shipping, sign in as a real authenticated coach with ≥1 linked client and exercise:
- the **soft-delete read fix** (delete a client workout/template as the coach → confirm it does NOT resurrect in roster/charts/analytics);
- the **silent-failure fixes** (force a failed assign/revoke/disconnect → confirm an error toast, not false success);
- the **association flow** end-to-end (create invite → accept on a second account → message → assign program → disconnect).

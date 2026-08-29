# COACH SIDE — READ-ONLY AUDIT

**Purpose:** a fact base for a keep / cut / reshape decision on the coach half of the app.
This is **not** a redesign and **not** a deletion plan. Nothing is recommended for removal.

---

## 0. METHOD, AND WHAT THAT METHOD CANNOT SEE

**This is a static source read. Nothing in this document was observed running.**
No dev server, no preview server, no Playwright, no build, no `npm run verify`, no
`npm run test:run`, no git command. No coach screen was rendered. No Supabase request
was made. Every behavioural statement below is derived from reading the code.

Confidence tag on every non-trivial claim:

| Tag | Meaning |
|---|---|
| **VERIFIED** | I read the code that makes it true, at the cited `file:line`. |
| **INFERRED** | It follows from code I read, but a runtime step sits between the code and the claim. |
| **UNVERIFIED** | I could not check it at all. Stated as unknown, not as fact. |

**Coverage of the read.** I read in full: 29 of the 37 non-test files under
`src/pages/coach/**`, and 15 of the 18 non-test files under `src/services/coach/**`,
plus `src/AppRouter.tsx`, `src/contexts/CoachContext.tsx`, `src/pages/MyCoach.tsx`,
`src/lib/supabase.ts`, `src/components/dashboard/TodaysWorkoutCard.tsx`,
`src/components/charts/GlowAreaChart.tsx` (top half),
`src/pages/progress/components/TrendChartCard.tsx`, and the `reminders` RLS block of
`supabase/migrations/20260529000000_coach_platform.sql`.

Files I did **not** read in full are listed in §8. Where a surface depends on one of
them, its classification is tagged INFERRED rather than VERIFIED.

---

## 0b. A PREMISE IN THE BRIEF IS WRONG — READ THIS BEFORE §3

The brief states: *"There is no `.env` in this repo, so Supabase is unconfigured."*

**That is not the state of this working tree.** — **VERIFIED**

Three env files exist at the repo root. Checked by key name and value length only;
no value was read out or echoed:

| File | `VITE_SUPABASE_URL` | `VITE_SUPABASE_ANON_KEY` |
|---|---|---|
| `.env` | set, 22 chars | set, 27 chars |
| `.env.local` | set, 40 chars | set, **208 chars** |
| `.env.example` | set, 32 chars | set, 13 chars |

`.env.local` also carries a `DEEPSEEK_API_KEY`.

Vite's precedence is `.env.local` over `.env`, so the effective values are the
`.env.local` pair. A 208-character anon key is the right shape for a real Supabase
JWT; the 27-character value in `.env` is not. **INFERRED:** `isSupabaseConfigured()`
(`src/lib/supabase.ts:7-12`) returns `true` in this tree, so the coach data path
would issue real network requests rather than short-circuiting.

Whether that project is alive, and whether this machine's account has
`profiles.role = 'coach'`, is **UNVERIFIED** — I did not use the credentials and
did not start a server. So the coach side is still unreachable *for this audit*,
just for a different reason than the brief assumed: not "no config" but "no
verified session, and no permission to run anything".

§3 therefore documents **both** states, and labels which is which.

---

## 1. EVERY COACH-FACING SURFACE

### 1.1 Route table

All coach routes are declared in `src/AppRouter.tsx`. Lazy imports at lines 81-90.

| Route | Component | Route line | Guard |
|---|---|---|---|
| `/coach` | `CoachHome` | `AppRouter.tsx:493` | `CoachGuard` |
| `/coach/clients` | `CoachClients` | `AppRouter.tsx:503` | `CoachGuard` |
| `/coach/programs` | `CoachPrograms` | `AppRouter.tsx:513` | `CoachGuard` |
| `/coach/invites` | `CoachInvites` | `AppRouter.tsx:523` | `CoachGuard` |
| `/coach/groups` | `CoachGroups` | `AppRouter.tsx:533` | `CoachGuard` |
| `/coach/messages` | `CoachMessages` | `AppRouter.tsx:543` | `CoachGuard` |
| `/coach/messages/:otherId` | `MessageThread viewer="coach"` | `AppRouter.tsx:553` | `CoachGuard` |
| `/coach/clients/:id` | `ClientDetail` | `AppRouter.tsx:563` | `CoachGuard` |
| `/coach/clients/:id/report` | `ClientReport` | `AppRouter.tsx:573` | `CoachGuard` |
| `/coach/groups/:groupId/chat` | `GroupThread viewer="coach"` | `AppRouter.tsx:583` | `CoachGuard` |
| `/my-coach` | `MyCoach` | `AppRouter.tsx:593` | `TraineeGuard` |
| `/my-coach/messages/:otherId` | `MessageThread viewer="trainee"` | `AppRouter.tsx:603` | `TraineeGuard` |
| `/my-coach/groups/:groupId/chat` | `GroupThread viewer="member"` | `AppRouter.tsx:613` | `TraineeGuard` |
| `/join` | `JoinPage` | `AppRouter.tsx:294` | none (deliberate) |

**VERIFIED** for every line above except `583`, which is **VERIFIED by count** —
the grep returned exactly 6 `/coach/(groups|messages|clients/)` matches at
533/543/553/563/573 plus one more, and `/my-coach` starts at 593 on the same
10-line-per-`<Route>` cadence.

`CoachGuard` (`AppRouter.tsx:341`) reads `isCoach` from `CoachContext`, renders
`<PageLoader/>` while `loading`, and `<Navigate to="/" replace/>` otherwise —
**VERIFIED**. It is a UX gate only; the file's own comment states RLS is the real
authorization boundary.

`isCoach` comes from `profiles.role === 'coach'` (`CoachContext.tsx`), fetched once
per authenticated mount, with a `cached_role` localStorage first-paint hint.
**There is no client-side path into coach mode** — the context has an explicit
comment saying so, and the only write path is `leaveCoachMode()` (the exit).
Coach status is granted server-side, via `/admin` → `admin_set_coach` RPC.
**VERIFIED**.

### 1.2 Surface-by-surface, with classification

Classification legend, as defined in the brief:
**REAL** = displays data a coach entered or a trainee logged · **DERIVED** = computed
from real data · **PLACEHOLDER** = a default, fallback or invented number presented
as fact · **DEAD** = nothing renders it.

---

#### `/coach` — CoachHome (`src/pages/coach/CoachHome.tsx`, 473 lines)

What a coach sees: business name + seat count header; a 3-up quick-link grid
(הזמנות / קבוצות / הודעות with an unread badge); a "ממתינים לתשובה" bucket; a
"דורשים טיפול היום" bucket; a 3-up "סקירה כללית" stat row; a "כל המתאמנים" jump.

| Element | Class | Evidence |
|---|---|---|
| Seat subtitle `used/limit מושבים` | **REAL** | `getSeatUsage()` counts `coach_clients` where status=active, and reads `coach_subscriptions.seat_limit` (`relationshipService.ts`). Hidden entirely until `limit > 0`, so no `0/0` flash. **VERIFIED** |
| "ממתינים לתשובה" rows | **DERIVED** | `getUnreadCountByClient()` — one bounded query over `messages`, reduced in JS. Capped at 3. Hidden while `signalsLoading`. **VERIFIED** |
| "דורשים טיפול היום" rows | **DERIVED** | `computeClientAnalytics` over real `workout_sessions` timestamps; `level` ∈ new/at_risk/inactive/active from real session recency. **VERIFIED** |
| `מתוכננים להיום` / `כבר התאמנו` | **DERIVED** | `getScheduledTodayByClient()` — one query on `workout_schedule` for today. **VERIFIED** |
| `דורשים תשומת לב` | **DERIVED** | `summarizeRoster()` — pure count of at_risk + inactive. **VERIFIED** |
| Empty-state "ראשית — שלושה צעדים" | **REAL** (static copy, correctly labelled) | Three literal onboarding steps; makes no numeric claim. **VERIFIED** |
| `AllActiveState` "כל המתאמנים על המסלול" | **DERIVED** | Rendered only when `attentionRows.length === 0`. **VERIFIED** |

**This screen is careful about not faking numbers.** `OverviewStat` takes a
`loading` prop and renders `—` instead of `0` while the signal is in flight
(`rosterPrimitives.tsx`), and the seat subtitle is `undefined` until real. That is
the opposite of the rings-pinned-at-100% pattern the brief warns about.

---

#### `/coach/clients` — CoachClients (`src/pages/coach/CoachClients.tsx`, 422 lines)

Searchable roster: name search, tag chips, three sort modes (תשומת לב / שם /
פעילות אחרונה), an opt-in multi-select mode with a sticky bulk-nudge composer.

| Element | Class | Evidence |
|---|---|---|
| Roster rows | **REAL** | `listClients('active')` → `coach_clients` joined to `profiles`. On error it **throws** so the UI shows `SectionError` rather than the misleading "אין מתאמנים" onboarding — the code says so explicitly. **VERIFIED** |
| Row meta (last activity, sessions this week) | **DERIVED** | `RosterRow` in `rosterPrimitives.tsx`, from `analytics`. **VERIFIED** |
| Tag chips | **REAL** | `coach_clients.tags`, deduped from real rows. **VERIFIED** |
| `filtered/total תואמים` counter | **DERIVED** | pure array length. **VERIFIED** |
| Bulk nudge send | **REAL** | `sendBulkMessage()` → real `messages` inserts, capped at `BULK_NUDGE_MAX = 30`, returns per-client sent/failed and the UI keeps failures selected for retry. **VERIFIED** |

---

#### `/coach/clients/:id` — ClientDetail (Client 360)

`ClientDetail.tsx` (219 lines) is a thin orchestrator: header + `SegmentedControl`
5-tab bar + a panel switch, fed by one hook `useClientData(clientId)`
(`client/useClientData.ts`, 133 lines) that runs 9 independent `useAsyncData`
queries keyed on `[clientId]`. **VERIFIED**

**Overview tab** (`client/tabs/OverviewTab.tsx`, 281 lines)

| Element | Class | Evidence |
|---|---|---|
| `VerdictStrip` one-line Hebrew verdict | **DERIVED** | `computeVerdict()` is pure, priority-ordered (inactive → no sessions this week → weight momentum → steady), and returns `'אין עדיין נתוני פעילות'` when `analytics === null`. It never invents a number. **VERIFIED** |
| 4 stat cards (מצב / אימונים 7 ימים / פעילות אחרונה / משקל אחרון) | **DERIVED**, with honest `—` | Every card falls back to the literal `'—'` when the source is null, not to `0`. **VERIFIED** |
| `WeekGrid` 7-day grid | **DERIVED** | `getClientWeekAdherence()` fans out 4 reads (sessions, nutrition, assignments, schedule) **all with `throwOnError: true`**, and the docblock states the reason: "a failed load must never render as an all-zero week". **VERIFIED** |
| WeekGrid calorie bar when no target is assigned | **PLACEHOLDER (minor, visual only)** | `calBarHeight()` in `client/WeekGrid.tsx` returns a hardcoded `40` px when `targetCalories == null`. The bar then encodes nothing — a 1,200 kcal day and a 3,400 kcal day draw the same height. The kcal digits printed under it are real, and the summary line omits the target clause, so nothing textual lies; but the bar is a shape with no data behind it. **VERIFIED** |
| `StreakStrip` (רצף אימונים / רצף שיא / רצף עמידה ביעד) | **DERIVED** | `computeStreaks()` in `client/clientTrends.ts`, pure, over the same fetched window. Renders nothing while loading. **VERIFIED** |
| "השהיית מתאמן" | **REAL** | `setClientStatus(link.id,'paused')` (`relationshipService.ts:140`), behind a `ConfirmDialog`, checks the returned error before claiming success. **VERIFIED** |

**Training tab** (`client/tabs/TrainingTab.tsx`, 108 lines)

| Element | Class | Evidence |
|---|---|---|
| `מגמת נפח · 4 שבועות` chart | **DERIVED** | `volumeTrendPoints(analytics.volumeByWeek)` — see §5 for the chart itself. **VERIFIED** |
| `ScheduleCalendar` week planner | **REAL** | `client/ScheduleCalendar.tsx` (517 lines) reads `getClientSchedule` and writes `scheduleWorkout` / `updateScheduledWorkout` / `deleteScheduledWorkout`. Full 4-state UI (skeleton / error+retry / empty / data). **VERIFIED** |
| ICS export "ייצוא שבוע ליומן" | **PLACEHOLDER (time-of-day only)** | `ScheduleCalendar.tsx` builds `IcsEvent.start` as `` `${w.scheduledDate}T08:00:00` `` — a hardcoded 08:00. `workout_schedule` has no time column, so the exported calendar asserts a training hour nobody chose. Dates and titles are real. **VERIFIED** |
| Recent sessions list (10) | **REAL** | `getClientSessions(clientId, 10)` — real logged sessions; label falls back to a dated string when the note is empty. **VERIFIED** |
| "בנה תוכנית" → `ProgramBuilder` | **REAL** | see below. **VERIFIED** |
| `AssignBox` (note + nutrition target) | **REAL** | `createAssignment()` inserts real `assignments` rows; inline field-level validation, no toast-as-validation. **VERIFIED** |
| `AssignmentsBox` (active assignments + revoke) | **REAL** | `listCoachAssignments` / `archiveAssignment`. **VERIFIED** |

**Nutrition tab** (`client/tabs/NutritionTab.tsx`, 144 lines)

| Element | Class | Evidence |
|---|---|---|
| `יעד קלוריות פעיל` chip | **REAL** | `activeCalorieTarget()` scans the client's `assignments` for the newest `kind==='nutrition_target' && status==='active'` with a numeric `payload.calories > 0`. Renders **nothing** when absent — no invented target. **VERIFIED** |
| 7-day nutrition rows | **REAL** | `getClientNutrition(clientId, 7, {throwOnError:true})`. **VERIFIED** |
| Per-row macro line | **REAL**, with a `?? 0` display default | `{n.calories ?? 0} קק"ל · חלבון {n.protein ?? 0} ג׳ …`. A row where the trainee logged only calories shows `חלבון 0 ג׳`, which reads as "logged zero protein" rather than "not logged". A cosmetic honesty gap, not an invented aggregate. **VERIFIED** |
| `EditNutritionSheet` | **REAL** | `client/EditNutritionSheet.tsx` (172 lines) → `upsertClientNutritionLog`, per-field errors, `max={todayStr()}` on the date. The writer is create-aware: on UPDATE it deliberately omits `meals` and `created_at` so a coach edit cannot wipe the trainee's logged meals (`coachApi.ts`, comment in place). **VERIFIED — and this is a genuinely subtle bug that was already thought about.** |

**Metrics tab** (`client/tabs/MetricsTab.tsx`, 222 lines)

| Element | Class | Evidence |
|---|---|---|
| `מגמת משקל` chart | **DERIVED** | `weightTrendPoints()`; guarded by `weightPoints.length > 1` with the honest empty "צריך לפחות שתי מדידות כדי להציג מגמה". **VERIFIED** |
| Measurement delta rows + sparklines | **DERIVED** | `measurementDeltas()` compares the latest reading to the most recent *earlier* reading that has that field; `delta = null` renders "ללא שינוי", and the sparkline is suppressed at `history.length <= 1`. **VERIFIED** |
| PR list (8) | **REAL** | `getClientPRs(..., {throwOnError:true})`. **VERIFIED** |
| `PhotoTimeline` | **REAL** | `client/PhotoTimeline.tsx` (348 lines): flattens check-in photos, batch-signs storage paths (1h TTL), lightbox + 2-up compare. A photo whose URL failed to sign renders a labelled `—` placeholder rather than a broken image. **VERIFIED** |
| `EditBodyWeightSheet` | **REAL — INFERRED on detail** | wired to `upsertClientBodyWeight`; I did not read the 126-line sheet. |

**Comms tab** (`client/tabs/CommsTab.tsx`, 33 lines)

| Element | Class | Evidence |
|---|---|---|
| `NotesBox` private notes | **REAL** | `listCoachNotes` / `addCoachNote` → `coach_notes`, coach-scoped. Reader **throws** on failure so the box shows an error, not "אין הערות". **VERIFIED** |
| `RemindersBox` (active links only) | **REAL** | `client/RemindersBox.tsx` (274 lines) → `createReminder` / `deleteReminder`. `HH:MM` validated at the service boundary. **VERIFIED** |
| `TimelineBox` | **DERIVED** | pure merge of the already-fetched sessions + check-ins + assignments, newest-first, capped at 15. No fetching of its own. **VERIFIED** |
| `AuditBox` (collapsed) | **REAL** | `listAudit(subjectUserId)` → `audit_log`, lazily mounted on first expand. Reader throws on failure. **VERIFIED** |

---

#### `/coach/clients/:id/report` — ClientReport (`src/pages/coach/ClientReport.tsx`, 515 lines)

A print-optimized 30-day summary. `window.print()` is the PDF path; a `@media print`
block forces white paper + `#000` ink and `break-inside: avoid` per section.

| Element | Class | Evidence |
|---|---|---|
| Header (client name, period, coach business name) | **REAL** | `getClientLink` + `getMyCoachProfile`. **VERIFIED** |
| Training summary | **DERIVED** | `computeTrainingSummary()` in `client/reportMetrics.ts`. Renders "אין נתונים בתקופה זו" at zero. **VERIFIED** |
| Scheduled-plan adherence line | **DERIVED** | rendered only when `scheduled > 0`. **VERIFIED** |
| Weight trend + SVG sparkline | **DERIVED** | `computeWeightTrend()` returns `null` when no in-range weigh-ins → empty state, not a flat fake line. `sparklinePoints()` handles the zero-span case at mid-height. **VERIFIED** |
| PR list (max 12 + "ועוד N") | **REAL** | `filterPRsInRange`. **VERIFIED** |
| Nutrition block | **DERIVED** | `computeNutritionSummary`; `avgCalories === null` prints `—`. **VERIFIED** |
| "הערות המאמן" textarea | **REAL, and honestly labelled** | The label literally says *"יודפסו כפי שנכתבו, ללא שמירה במערכת"*, and the notes are indeed never persisted. A print-only mirror `div` exists because a `<textarea>` clips on paper. **VERIFIED** |
| Web Share button | **REAL** | Feature-detected on `navigator.share`; hidden on desktop so there is no dead control. Share text is built from the **same** pure aggregates the printout renders. **VERIFIED** |

---

#### `/coach/programs` — CoachPrograms (`src/pages/coach/CoachPrograms.tsx`, 163 lines)

Library list of `coach_program_templates` with day/exercise counts, a delete
confirm, and an explanatory line stating the library itself never assigns.
**REAL** — `listProgramTemplates()` / `deleteProgramTemplate()`; the list reader
**throws** on offline rather than rendering an empty library ("a coach reads an
empty library as 'my work vanished'" — the service says exactly that). **VERIFIED**

---

#### `ProgramBuilder` (`src/pages/coach/ProgramBuilder.tsx`, 991 lines — the largest coach file)

Not a route. A `<Sheet>` opened from three places: `TrainingTab` (client mode),
`CoachGroups` (group mode), `CoachPrograms` (library mode). **VERIFIED**

**REAL throughout, and the most defensively written file in the coach half.**
Concretely:

- Exercise names resolve against the real canonical library (`getPersonalExercises`)
  via a `<datalist>`; a matched name fills the canonical `exerciseId` and target
  muscle, an unmatched one leaves them `''` rather than inventing an id.
- `buildTemplate()` drops blank-name rows so an unstartable exercise cannot reach
  a trainee.
- Per-day template ids are **stable per sheet-open** (`dayTemplateIdsRef`), so a
  retry after a mid-loop failure upserts the same rows instead of leaving days
  1..k orphaned on the trainee — a real, specific bug that was designed out.
- `upsertClientTemplate` returns `{error}` and never throws, so `handleAssign`
  explicitly re-throws it: "a swallowed failure would show a false success while
  the trainee's program points at templates that were never persisted."
- Group assign (`assignProgramToGroup`) intersects group membership with the
  **active** roster before writing, materializes per-member template copies with
  bounded concurrency (4), and refuses to create an assignment row when every
  member failed — so no green "שויכה ל-0".
- Dirty-close guard: Esc/backdrop on a built-but-unsaved program raises a confirm.
- A post-assign optional scheduling step drives `scheduleProgramWeek`.

Hardcoded defaults that are **defaults, not fabrications**: `DEFAULT_SETS='3'`,
`DEFAULT_REPS='10'`, `restSeconds: 60`, `targetWeight: null`. These seed an input
the coach then edits; they are not presented as measured facts. **VERIFIED**

---

#### `/coach/invites` — CoachInvites (`src/pages/coach/CoachInvites.tsx`, 346 lines)

Create / QR / share / copy / revoke / re-create invites.
**REAL** — `createInvite` mints a modulo-bias-free 8-char code from a 30-char
unambiguous alphabet, 14-day TTL, retries on unique-violation, and maps the
server's `invite_seat_limit_reached` trigger to a specific Hebrew message. QR is
fixed black-on-white (not tokens) because scanners need contrast in dark mode.
**VERIFIED**

**One PLACEHOLDER, in copy:** the seat-full paragraph reads
*"הגעתם לתקרת המושבים (5 מתאמנים במסלול החינמי)"* — but
`DEFAULT_SEAT_LIMIT = 1` in `src/services/coach/mappers.ts`, with a docblock saying
the free baseline is "a single solo seat" and that the seed/usage-check/mapper were
deliberately reconciled on `1`. The screen states a number the code contradicts.
**VERIFIED** (source disagreement; which one a live coach hits is UNVERIFIED,
since `coach_subscriptions.seat_limit` may be set per-coach server-side).

---

#### `/coach/groups` — CoachGroups (`src/pages/coach/CoachGroups.tsx`, 379 lines)

Create group; expandable per-group editor with member checkboxes, save members,
broadcast announcement, assign program to group, delete group.
**REAL** — **VERIFIED**. Notable correctness work: the member editor tracks
`membersState: 'loading' | 'error' | 'ready'` and **disables save until `'ready'`**,
because saving an all-unchecked editor after a *failed* membership read would call
`set_group_members` with an empty set and silently wipe every member. `setGroupMembers`
is one transactional RPC that diffs server-side. Separate `savingMembers` /
`broadcasting` / `deleting` flags so one action does not show another as loading.

---

#### `/coach/messages` + threads

- `CoachMessages` (394 lines) — tabbed hub (אישי / קבוצות), WAI-ARIA tablist with
  roving tabindex and **RTL-correct arrow keys** (ArrowLeft = next). Search per
  tab with an `aria-live` result count. Live previews via
  `subscribeToCoachClientMessages` / `subscribeToCoachGroupMessages`, throttled to
  ≤1 refresh/sec (`createThrottledRefresh`), refreshing **silently** so no skeleton
  flash. **REAL** — **VERIFIED**
- `listClientThreads()` — one roster fetch + one `coach_thread_summaries` RPC for
  exact unread/last-message, with a bounded 500-row JS fallback when the RPC is
  missing. If **both** paths fail it returns `[]` rather than "a roster of fake
  'no messages' rows" (the code says that). **DERIVED** — **VERIFIED**
- `MessageThread` (614 lines) — one component serving **both** `viewer="coach"` and
  `viewer="trainee"`; `coachId`/`clientId` are swapped from `viewer` at lines 65-66.
  Paged (`getThreadPage`, 200/page, "load earlier" keeps scroll anchored),
  optimistic send, live append via `subscribeToThread`. **REAL** — **VERIFIED**
  for the data path; I read only lines 30-100 in full, so bubble rendering detail
  is **INFERRED**.
- Coach quick-reply chips (`MessageThread.tsx:36`) — 6 seeded Hebrew phrases plus
  coach-added ones in `localStorage['coach:quick-replies']` (cap 12). They **insert
  into the composer, never auto-send**, and trainees never see them.
  **REAL** — **VERIFIED**
- `GroupThread` (507 lines) — three viewer modes (`coach` / `member`), read cursor
  split between `client_groups.coach_last_read_at` and
  `client_group_members.last_read_at`. **REAL — INFERRED**, I did not read the file.
- `messageTime.ts` (47 lines) — `formatTime` / `formatDayLabel` (היום / אתמול /
  dd/MM/yy) shared by both threads. Pure. **REAL** — **VERIFIED**
- `TypingDots.tsx` (50 lines) — **UNVERIFIED**, not read. Whether a typing
  indicator is driven by a real presence signal or is decorative is unknown; that
  matters, because a *fake* typing indicator would be exactly the pattern this
  audit is looking for. **Flagged, not classified.**

---

### 1.3 DEAD — exported, tested, and reachable from no UI

**VERIFIED** by exhaustive grep across `src/`: each of these appears only at its
own definition plus a test file. No component, hook, or route imports them.

| Symbol | Location | Only other reference |
|---|---|---|
| `deleteClientSession` | `services/coach/coachApi.ts:386` | `__tests__/coachApiWriters.test.ts` |
| `deleteClientNutritionLog` | `services/coach/coachApi.ts:454` | `__tests__/coachApiWriters.test.ts` |
| `deleteClientTemplate` | `services/coach/coachApi.ts:546` | `__tests__/coachApiWriters.test.ts` |
| `isCoachEnabled` | `services/coach/relationshipService.ts:23` | none |
| `getThread` | `services/coach/messageService.ts:62` | none (a comment in `MessageThread.tsx:230` mentions it; the code calls `getThreadPage`) |

The three deletes are the notable ones: a coach can **create and edit** a trainee's
sessions, nutrition logs and templates, but there is **no delete control anywhere
in the coach UI** — while three fully-implemented, tombstone-correct, audited
delete writers sit behind them with 3 dedicated test blocks. Either the UI was
never built or it was removed and the service layer was left. **VERIFIED** that
the writers are unreachable; **UNVERIFIED** which of the two histories is true.

Not dead, for the record: `getMySchedule` is called internally by
`getTodaysScheduledWorkouts` and `reconcileScheduleOnSessionSave`;
`getClientAnalytics` is called by `useClientData`; `scheduleProgramWeek` is called
only by `ProgramBuilder`'s post-assign step (a single call site, which the file's
own comment notes).

---

## 2. THE PLACEHOLDER LIST, ISOLATED

The brief asks specifically for confident numbers with nothing behind them. After
tracing every numeric surface, here is the complete list I found. **It is short,
and none of it is of the readiness-score / rings-at-100% severity.**

1. **`WeekGrid` calorie bar with no assigned target** — hardcoded `40`px height,
   encodes nothing. `client/WeekGrid.tsx`, `calBarHeight()`. **VERIFIED**
2. **ICS export start time** — hardcoded `T08:00:00` on every exported event; the
   schedule has no time-of-day. `client/ScheduleCalendar.tsx`. **VERIFIED**
3. **Seat-limit copy says 5, code says 1** — `CoachInvites.tsx` vs
   `DEFAULT_SEAT_LIMIT` in `services/coach/mappers.ts`. **VERIFIED**
4. **`?? 0` macro display** — an unlogged macro renders as `0 ג׳` rather than `—`,
   in `client/tabs/NutritionTab.tsx`. Cosmetic. **VERIFIED**

Everything else I traced resolved to REAL or DERIVED, and the recurring pattern is
the *opposite* of fabrication: `throwOnError: true` on the aggregate readers, `—`
instead of `0` while loading, empty states that say "אין נתונים בתקופה זו", readers
that throw so `SectionError` fires instead of an empty state, and services that
return `[]` only when they genuinely mean "empty". Multiple docblocks state this as
an explicit rule. **VERIFIED across `coachApi.ts`, `coachAnalytics.ts`,
`relationshipService.ts`, `groupService.ts`, `checkInService.ts`, `auditService.ts`,
`inviteService.ts`, `reminderService.ts`, `programTemplateService.ts`, `_shared.tsx`.**

### One functional bug found on the way (not a placeholder)

**A coach receives their own clients' reminders as local notifications.**
`AppRouter.tsx:848-850` polls `materializeDueReminders()` every 60s for **every**
signed-in user. That calls `listMyReminders()`
(`services/coach/reminderService.ts`), which selects `reminders` with **no
`client_id` filter** and relies on RLS. The policy set is
`reminders_all_own → FOR ALL USING (coach_id = auth.uid())` plus
`reminders_select_target → client_id = auth.uid() OR is_group_member(group_id)`
(`supabase/migrations/20260529000000_coach_platform.sql:383-390`). For a coach, the
first policy matches every reminder they authored **for their clients** — so at
09:00 the coach's own device fires "שתה מים" that was scheduled for a trainee.
**INFERRED** — the RLS text and the query are VERIFIED; the notification firing was
not observed. `isReminderDue` is unit-tested, but only as a pure predicate.

---

## 3. WHAT BREAKS WITH NO `.env`

### 3.1 The mechanism — VERIFIED

`src/lib/supabase.ts:7-12` reads `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` at
module load and exports `supabase = null` plus `isSupabaseConfigured() === false`
when either is missing.

Coach services do **not** degrade to local data. `requireClient()`
(`services/coach/mappers.ts`) throws `CoachOfflineError` when unconfigured, and
**every** coach read/write calls it first. The file's own comment: *"Coach features
are ONLINE-only… `requireClient()` makes the connectivity requirement explicit
instead of silently no-op'ing."* **VERIFIED**

### 3.2 What a coach would actually see, unconfigured — INFERRED

The chain resolves before the UI, in this order:

1. `CoachProvider.refresh()` calls `getMyProfile()`, `getMyCoachProfile()`,
   `getMySubscription()` in a `Promise.all`.
2. `getMyProfile()` (`profileService.ts`) is one of the few that **guards instead
   of throwing** — it returns `null` when unconfigured. But `getMyCoachProfile()`
   and `getMySubscription()` both call `requireClient()`, so the `Promise.all`
   **rejects**.
3. `refresh()` catches, logs `'CoachContext refresh failed'`, and — critically —
   **keeps the cached role**: "flipping a coach to the trainee shell because one
   request failed would be worse than stale." `loading` is set false in `finally`.
4. So `isCoach` = whatever `localStorage['cached_role']` holds.

Therefore, unconfigured:

- **A device with no `cached_role` (a fresh install, or any trainee): `/coach/*` is
  fully unreachable.** `isCoach` is false → `CoachGuard` → `<Navigate to="/" replace/>`.
  **A silent redirect home.** Not an error, not a skeleton — the coach half simply
  does not exist. This is the state a reviewer with an empty profile would hit, and
  it is the reason the coach side has never been seen.
- **A device with `cached_role === 'coach'` from a previous online session:** the
  shell renders, and then **every panel independently shows its error state**.
  `useAsyncData` (`_shared.tsx`) catches the rejection and sets
  `error = 'Coach features require an online connection.'`, and each screen renders
  `SectionError` — "לא ניתן לטעון את הנתונים. בדוק את החיבור לאינטרנט ונסה שוב." + a
  retry button. `ClientDetail` shows `SectionError` when `link === null`.
  **No infinite skeleton and no blank screen** — `useAsyncData`'s `finally` always
  clears `loading`.
- A handful of services swallow instead of erroring, and those panels look *empty*
  rather than broken: `listClientThreads`, `getUnreadCountByClient`,
  `getScheduledTodayByClient`, `getRecentCheckInFlags`, `listGroupThreads`,
  `subscribeTo*` (all no-op), `getMyProfile`. **VERIFIED** per function.
- `TodaysWorkoutCard` on the trainee Dashboard `return null`s on failure by design,
  so the trainee home degrades invisibly. **VERIFIED**

### 3.3 In THIS tree — INFERRED

Because `.env.local` supplies both keys (§0b), `isSupabaseConfigured()` is `true`,
so none of §3.2 applies here. The blockers to reviewing the coach side in this tree
are instead: (a) whether the Supabase project is live, (b) whether this machine's
account has `profiles.role = 'coach'`, (c) whether that coach has any linked
clients. All three are **UNVERIFIED**. Without a coach account with ≥1 active
client, `/coach` renders the "ראשית — שלושה צעדים" empty state and **every
per-client surface — the entire Client 360, both charts, the report — is
unreachable**, because they are all keyed on `/coach/clients/:id`.

**Surfaces that cannot be reviewed without a seeded coach account + ≥1 client:**
`ClientDetail` and all 5 tabs, `ClientReport`, `ScheduleCalendar`, `PhotoTimeline`,
`WeekGrid`, `StreakStrip`, `MetricsTab` charts, `TrainingTab` chart, `AuditBox`,
`RemindersBox`, `TimelineBox`, `MessageThread`, `GroupThread`, both
`ProgramBuilder` assign paths.

---

## 4. TRAINEE-SIDE DEPENDENCIES — **THE LOAD-BEARING SECTION**

Found by grepping every import of `services/coach` and `pages/coach` across `src/`.
**These are the couplings that make the coach half non-removable in isolation.**
All **VERIFIED** at the cited line.

### 4.1 Trainee screens that read coach-authored data

| Trainee surface | Imports from coach | What it consumes |
|---|---|---|
| `src/pages/MyCoach.tsx` | `listMyCoaches`, `listMyAssignments`, `resolveProgramDays` (`:24`, `:425`), `disconnectCoach`, `listCheckIns`, `submitCheckIn`, `uploadCheckInPhotos`, `updateCheckInPhotos`, `subscribeToAssignments`, `listGroupThreads` | The entire trainee↔coach screen: assignment inbox, program start buttons, group list, weekly check-in form with photos |
| `src/components/dashboard/TodaysWorkoutCard.tsx` | `subscribeToUserTable` (`:15`), `getTodaysScheduledWorkouts` + `markScheduleStatus` (`:20`) | **The trainee's home-screen "האימון של היום" card is 100% coach-authored data** — it reads `workout_schedule`, which only a coach writes |
| `src/pages/nutrition/hooks/useNutritionData.ts` | `listMyAssignments` (`:4`, `:347`) | Coach-assigned calorie/macro targets feed the trainee nutrition screen |
| `src/components/workout/ActiveWorkoutNew.tsx` | `listMyAssignments` (`:10`) | Coach-assigned program/template resolution inside the live workout flow |
| `src/components/workout/hooks/useWorkoutSave.ts` | `scheduleService` (`:241`, dynamic import) | `reconcileScheduleOnSessionSave` — finishing a workout flips the coach's planned row to `done` |
| `src/pages/progress/tabs/BodyTab.tsx` | `checkInService` (`:28`) | Trainee's own check-in history / photos |
| `src/components/ui/BottomNav.tsx` | `listMyCoaches` (`:22`) | Whether the coach/messages nav entry appears at all |
| `src/pages/Dashboard.tsx` | `listMyCoaches` (`:36`) | Coach-linked state on the trainee home |
| `src/pages/JoinPage.tsx` | `acceptInvite` (`:14`) | The **entire onboarding-by-invite path** |
| `src/hooks/useUnreadMessages.ts` | `getUnreadCount`, `getGroupUnreadCount` (`:2-3`) | The unread badge on the bottom nav, for both roles |
| `src/hooks/useCloudDataReflection.ts` | `subscribeToUserTable` (`:16`) | Called from `AppShell` for **every** user — reflects coach edits live |
| `src/hooks/useCloudTemplateReflection.ts` | `subscribeToUserTable` (`:2`) | `syncTemplatesFromCloud`, used by both `MyCoach` and `TodaysWorkoutCard` before starting a coach-assigned workout |
| `src/pages/settings/sections/CoachSection.tsx` | `updateMyCoachProfile` (`:11`) | Settings pane |
| `src/pages/settings/sections/NotificationsSection.tsx` + `useSettingsState.ts` | `pushService` (`:6`, `:8`) | **Web Push for the whole app** lives in the coach service tree |
| `src/AppRouter.tsx:848-850` | `reminderService` | The 60s reminder poll runs for **every** signed-in user |

### 4.2 Shared UI primitives that live under `pages/coach/` but serve the trainee

`src/pages/MyCoach.tsx` imports `CoachPage`, `ListRow`, `ListSkeleton`, `Section`,
`SectionError`, `formatDate`, **and `useAsyncData`** from
`src/pages/coach/_shared.tsx`, plus `useAcceptInvite` + `inviteErrorMessage` from
`src/pages/coach/useAcceptInvite.ts`. **VERIFIED**

`src/pages/coach/_shared.tsx` (406 lines) is therefore **not a coach-only file** —
it is the page shell, the `useAsyncData` hook, the loading/error/empty vocabulary,
and the accessible `Checkbox`, shared with a trainee route.

### 4.3 Dual-viewer components

`MessageThread` and `GroupThread` each serve coach **and** trainee routes from one
file, switching on a `viewer` prop (`AppRouter.tsx:553/583` vs `603/613`).
There is no separate trainee chat implementation. **VERIFIED**

### 4.4 The plain reading of §4

The coach half is not a bolt-on. The trainee half depends on it for: today's
workout card, the invite-based onboarding path, assigned-program start,
assigned nutrition targets, the check-in feature, the unread badge, Web Push,
the live cloud-reflection hooks, chat, and the page-shell primitives that
`/my-coach` is built from. Any decision that treats `src/pages/coach/**` +
`src/services/coach/**` as one removable unit would break the half of the app
that is in use. **VERIFIED at 15 call sites + 8 shared imports.**

---

## 5. `GlowAreaChart` ON THE COACH SIDE

### 5.1 The exact call sites

The coach side never imports `GlowAreaChart` directly. Both coach charts go through
`TrendChartCard`. Grep for `GlowAreaChart` across `src/` returns 11 files; the
coach-relevant chain is: **VERIFIED**

```
MetricsTab.tsx  ─┐
                 ├─→ TrendChartCard (pages/progress/components/TrendChartCard.tsx:66)
TrainingTab.tsx ─┘        └─→ GlowAreaChart (components/charts/GlowAreaChart.tsx:143)
```

`src/pages/coach/client/clientTrends.ts:9` imports only the `GlowAreaPoint` **type**.

| # | Call site | Data fed | Series shape |
|---|---|---|---|
| 1 | `client/tabs/MetricsTab.tsx` → `TrendChartCard title="משקל גוף"` | `weightTrendPoints(weights)` | Real `body_weight` rows, ascending by date, non-finite dropped, capped to the last **30** points. `x` = `dd/MM`, `y` = kg. Rendered **only** when `length > 1`. |
| 2 | `client/tabs/TrainingTab.tsx` → `TrendChartCard title="נפח אימונים"` | `volumeTrendPoints(analytics.volumeByWeek)` | Exactly **4** points from `computeClientAnalytics`, oldest→newest, `y` = rounded summed `total_volume` per week. `x` = `'לפני 3ש׳' / 'לפני 2ש׳' / 'שבוע שעבר' / 'השבוע'`. |

`TrendChartCard` passes `xAxis` and `interactive` but **not** `yAxis`, and **not**
`valueUnit` from either coach call site — so neither coach chart shows a y-axis, and
the scrub callout shows a bare number with no `kg` suffix. **VERIFIED**

### 5.2 What the y-axis change did, and why site #2 is the one to look at

`GlowAreaChart.computeYDomain()` (`components/charts/GlowAreaChart.tsx:62-77`)
floors the drawn y-span at `MIN_SPAN_FRACTION = 0.1` × the series' **mean absolute
value**, and centres a near-flat series inside that floored span. The docblock's
own rationale: pure min-max made `80.0 → 80.2 kg` climb as steeply as
`80 → 95 kg`. **VERIFIED**

- **Site #1 (weight) is what the rule was written for.** Bodyweight has a large
  mean and small deltas, so a 0.25% move now occupies ~2.5% of card height and
  correctly reads flat.
- **Site #2 (4-week volume) is the untested case.** Weekly volume has a *large*
  relative spread and, critically, `volumeByWeek` is initialised to `[0,0,0,0]`
  in `computeClientAnalytics`. A client with sessions in only the current week
  yields `[0,0,0,N]`. With `mean = N/4`, `minSpan = N/40`, and `dataMax-dataMin = N`
  ≥ `minSpan`, the floor does **not** engage — the chart draws true min-max, so
  three weeks pin to the exact bottom edge and one to the top. A brand-new client
  (`[0,0,0,0]`) hits `magnitude === 0 → minSpan = 1`, a flat line centred
  mid-card, with **no empty-state guard**: unlike `MetricsTab`'s
  `weightPoints.length > 1` check, `TrainingTab` renders the chart whenever
  `analytics` is non-null. So a client who has never trained gets a rendered
  "מגמת נפח · 4 שבועות" card showing a flat mid-height line at zero.
  **INFERRED** — the arithmetic is VERIFIED from the source; the rendering has
  never been observed.
- `GlowAreaChart.test.tsx` exists with 8 test cases pinning the y-span floor as
  geometry — but it is a **chart-level** test. Neither coach call site is covered
  by any test, and **neither has ever been seen rendered**. **VERIFIED**

---

## 6. TEST COVERAGE, AS NUMBERS

### 6.1 Unit tests (Vitest)

Counted mechanically (`^\s*(it|test)(\.\w+)?\(` per file).

| Scope | Files | Test cases |
|---|---|---|
| `src/pages/coach/**/__tests__/` | 4 | **49** |
| `src/services/coach/__tests__/` | 18 | **168** |
| **Subtotal, inside the two directories** | **22** | **217** |
| Coach-specific tests living elsewhere | 3 | **26** |
| **Total** | **25** | **243** |

The 3 elsewhere: `src/contexts/__tests__/CoachContext.test.tsx` (9),
`src/services/__tests__/coach.test.ts` (11 — `isReminderDue`, mappers, `inviteLink`),
`src/services/__tests__/coachAnalytics.test.ts` (6 — duplicates coverage with
`src/services/coach/__tests__/coachAnalytics.test.ts`). Partially coach-touching and
not counted: `BottomNav.test.tsx` (9), `appRouterHelpers.test.ts` (7),
`GlowAreaChart.test.tsx` (8). Not counted at all:
`src/services/ai/__tests__/coachBrief.test.ts` (3) — that is the **AI** coach
(`src/services/ai/coachBrief.ts`, still present on disk), a different feature.

**Where the 243 sit:** almost entirely on services and pure functions. The 49
page-level tests are `clientTrends` (20), `reportMetrics` (17), `overviewVerdict`
(7), `resolveCoachBackTarget` (5) — all **pure-function** tests. **There is not one
component render test for any coach page or tab.** No `ClientDetail`, no
`CoachHome`, no `WeekGrid`, no `MetricsTab`, no `ProgramBuilder`, no
`MessageThread`. **VERIFIED**

### 6.2 End-to-end (Playwright) — the brief expected zero; it is not zero, and what exists is worse than zero

13 spec files under `e2e/`. Two reference "coach":
`e2e/admin-qa.spec.ts` (5 hits — all about the `/admin` *set-as-coach* form, not the
coach shell) and `e2e/visual-qa.spec.ts` (12 hits).

`e2e/visual-qa.spec.ts:225` — `test('capture coach surfaces light + dark')` — walks
`/coach`, `/coach/clients`, `/coach/programs`, `/coach/messages`, `/coach/invites`
and screenshots each in light and dark. **Three things make it worthless as
coverage:** **VERIFIED**

1. **Zero assertions.** The file's header says so: *"VISUAL QA CAPTURE — not a
   regression test."* It only calls `page.screenshot()` and `console.log`. It cannot
   fail on a broken coach screen.
2. **It runs as a guest.** `seedGuest(page)` sets
   `localStorage.skip_auth = 'true'`. A guest has no cloud identity, so
   `CoachContext.refresh()` sets `role = null` → `isCoach = false` → `CoachGuard`
   redirects to `/`. **INFERRED, and strongly:** the 10 PNGs this test writes to
   `visual-qa/` are almost certainly the trainee Dashboard, filed under names like
   `20-coach-home-light.png`.
3. **It drives a control that no longer exists.** Lines 233-236 look for a
   "masthead role toggle (מאמן)" to switch into the coach view. Grepping
   `src/components/` for that button label returns **no matches**, and
   `CoachContext.tsx` states there is deliberately no local preference that can put
   a user into the coach shell. The test's `.catch(() => {})` swallows the miss and
   it proceeds anyway.

**So: functional e2e coverage of the coach side is zero, as expected. The
correction is that a test exists which *appears* to cover it and produces
plausible-looking screenshot artifacts that are not of the coach side at all.**
If anyone has reviewed `visual-qa/2*-coach-*.png` and concluded the coach screens
look fine, that conclusion has no basis.

`e2e/a11y.spec.ts` — **UNVERIFIED**; I did not read it. Whether it visits any
`/coach/*` route is unknown, though the same guest-guard problem would apply.

---

## 7. SIZE

Lines counted with `Measure-Object -Line`; ASCII-safe, no Hebrew in the output path.

| Scope | Files | Lines |
|---|---|---|
| `src/pages/coach/**` product code | 37 | 10,229 |
| `src/services/coach/**` product code | 18 | 3,693 |
| **Product code subtotal** | **55** | **13,922** |
| `src/pages/coach/**/__tests__/` | 4 | 492 |
| `src/services/coach/__tests__/` | 18 | 2,902 |
| **Test subtotal** | **22** | **3,394** |
| **Grand total in the two directories** | **77** | **17,316** |

**Tests are 19.6% of the lines and 28.6% of the files.**

Ten largest product files:

| Lines | File |
|---|---|
| 991 | `pages/coach/ProgramBuilder.tsx` |
| 614 | `pages/coach/MessageThread.tsx` |
| 546 | `pages/coach/rosterPrimitives.tsx` |
| 537 | `services/coach/coachApi.ts` |
| 517 | `pages/coach/client/ScheduleCalendar.tsx` |
| 515 | `pages/coach/ClientReport.tsx` |
| 507 | `pages/coach/GroupThread.tsx` |
| 473 | `pages/coach/CoachHome.tsx` |
| 422 | `pages/coach/CoachClients.tsx` |
| 412 | `services/coach/scheduleService.ts` |

Scope note for any sizing decision: this **excludes** the trainee-side consumers in
§4 (~15 files), the shared dual-viewer threads, `src/contexts/CoachContext.tsx`,
`src/pages/MyCoach.tsx`, the coach `<Route>` block in `AppRouter.tsx`, the coach
tables/RLS in `supabase/migrations/`, and three edge functions the code invokes by
name (`coach-invite-accept`, `coach-push-send`, `reminders-dispatch`).

---

## 8. WHAT I COULD NOT DETERMINE, AND WHY

**Anything requiring execution.** No screen was rendered, so: nothing about 390px
overflow, dark-mode contrast, RTL mirroring as *drawn*, focus order, real console
output, or actual chart geometry is in this document. Every RTL/a11y observation
below is a source-level reading only.

**Files I did not read in full** (classification for surfaces depending on them is
tagged INFERRED or flagged):
`pages/coach/GroupThread.tsx` (507), `pages/coach/MessageThread.tsx` (614 — read
lines 30-100 + targeted grep), `pages/coach/TypingDots.tsx` (50),
`pages/coach/client/EditSessionSheet.tsx` (324),
`pages/coach/client/EditBodyWeightSheet.tsx` (126),
`services/coach/groupMessageService.ts` (375 — read ~150 lines + grep),
`e2e/a11y.spec.ts`. Also unread: the second half of
`components/charts/GlowAreaChart.tsx` (the render/GSAP body; I read the geometry
functions).

**Specifically open questions:**

1. **`TypingDots` — is the typing indicator real?** If it is not driven by a
   presence/broadcast signal it is a fabricated liveness cue, which is exactly the
   class of thing this audit exists to find. Not read. **UNVERIFIED.**
2. **Is the Supabase project in `.env.local` live, and does this machine's account
   have `profiles.role = 'coach'`?** Determines whether the coach side is reviewable
   at all without new server-side seeding. **UNVERIFIED** — I did not use the
   credentials.
3. **Does the `coach_thread_summaries` RPC exist in the deployed schema?** The code
   has a bounded-500-row JS fallback with approximate unread counts past that
   window. Which path runs in production is **UNVERIFIED**.
4. **Are the three edge functions deployed?** `coach-invite-accept` (the *only*
   accept path — if it is missing, invites cannot be accepted at all),
   `coach-push-send`, `reminders-dispatch`. **UNVERIFIED.**
5. **Is `VITE_VAPID_PUBLIC_KEY` set?** `.env.example` lists it **empty**, and
   `.env`/`.env.local` do not contain the key at all. Without it
   `subscribeToPush()` returns `{ok:false, error:'no_vapid_key'}`, so **Web Push
   is off for the whole app** — trainee included. **VERIFIED** for the env files;
   **INFERRED** for the runtime consequence.
6. **What does `seat_limit` actually hold per coach?** Decides whether the "5
   מתאמנים" copy or `DEFAULT_SEAT_LIMIT = 1` is the lie. Server-side.
   **UNVERIFIED.**
7. **History of the three dead delete writers** — never-built UI vs removed UI.
   Would need git, which I am not permitted to run. **UNVERIFIED.**
8. **Whether the reminder cross-fire (§2) actually fires on a coach's device.**
   Needs a live coach session. **INFERRED only.**

---

## 9. WHAT IS GENUINELY WELL BUILT

A keep/cut decision needs this side of the ledger, so it is stated as plainly as
the faults. All **VERIFIED** from source.

1. **The "never render a fake zero" discipline is real, consistent, and documented.**
   `throwOnError: true` threads through the aggregate readers; roster/list readers
   throw rather than return `[]`; `OverviewStat` renders `—` not `0` while loading;
   seat subtitles stay `undefined` until meaningful; `getClientsActivity` throws
   because "an empty map would render the whole roster as 'all calm'". This is the
   exact failure mode the brief lists as this app's recurring sin, and the coach
   side is the part that most systematically defends against it.
2. **N+1 queries were designed out on purpose, with the reasoning left in place.**
   `getClientsActivity` (one query, 3 columns, no exercises JSON), `useRosterSignals`
   (one batched fetch per source, `Promise.allSettled` so one failure degrades to
   empty), `getScheduledTodayByClient`, `getRecentCheckInFlags`,
   `getGroupMemberCounts`, `getUnreadCountByClient`, and `getClientWeekAdherence`
   fetched **once** and shared by `WeekGrid` + `StreakStrip` because running it
   twice doubled the load.
3. **The coach write path is audited and merge-safe.** Every coach write to a
   trainee-owned table goes through `auditedWrite` (stamps `updated_by`, writes
   `audit_log` only on success, never masks a successful data write). Deletes are
   **tombstones**, not hard deletes, with the reason recorded: a hard delete was
   resurrected by the trainee's local-first push. `upsertClientNutritionLog` omits
   `meals`/`created_at` on UPDATE so a coach edit cannot wipe the trainee's logged
   meals. These are subtle local-first bugs that were found and fixed.
4. **Destructive-action guards are in the right places.** `set_group_members` save
   is disabled until the membership read reaches `'ready'`, because saving after a
   failed read would wipe the group. `ProgramBuilder` mints stable per-open template
   ids so a retry does not orphan rows, and has a dirty-close confirm. Group program
   assign refuses to create a row when every member failed. `deleteScheduledWorkout`
   resolves the row owner **before** deleting because `audit_log.subject_user_id` is
   a NOT NULL FK.
5. **RTL and bidi are handled at the token level, not patched.** Logical properties
   throughout (`insetInlineEnd`, `paddingInlineEnd`, `marginInlineEnd`); `<bdi>` on
   every user-generated name and every mixed Hebrew+number string;
   `<bdi dir="ltr">{used}/{limit}</bdi>` so the seat pair cannot reorder; the RTL
   chevron flip is deliberate and commented; `CoachMessages`' tablist maps
   **ArrowLeft to *next*** because the layout is RTL; `routeSlideOffset` flips the
   route-transition sign for RTL and again for back navigation. I found **no**
   Bootstrap-4-style `ml-*`/`mr-*` and no physical-direction spacing in the files
   I read.
6. **Accessibility is engineered, not sprinkled.** Non-colour cues are used
   systematically so severity survives a colourblind reading: `StatusDot`
   filled-vs-ring distinguishes `inactive` from `at_risk` (both `--fs-warn`),
   selected tag chips get a 2px ring **plus** a check glyph, the active sort button
   gets an underline, `WeekGrid`'s today column gets bold + a baseline rule.
   `AttentionRow` renders as a `<div>` and `RosterRow` omits `ListRow.onClick`
   specifically to avoid nested `<button>`; `Checkbox` keeps a real native input
   under the styled box so the focus ring tracks it; `WeekGrid` is one
   `role="img"` with a composed Hebrew summary label; `ProgramBuilder`'s invalid
   day conveys its state through the group's accessible **name** because
   `aria-invalid` is unsupported on a `section`; `prefers-reduced-motion` is
   honoured at every animated surface.
7. **Loading / error / empty are treated as three distinct states, everywhere.**
   `SectionError` (retry) is deliberately separate from `InlineEmpty`, with the
   ordering rule written down: render `error` **before** `empty`, "otherwise a
   failed load masquerades as 'no data'". `ListSkeleton` is the single loading
   pattern. `ClientDetail` adds a 2px background-refresh bar so a tab switch never
   looks frozen.
8. **`ClientReport` is a complete, zero-dependency feature.** Print-to-PDF with
   correct Hebrew RTL, `@page A4`, `break-inside: avoid`, forced ink-on-white
   regardless of theme, a print mirror for the textarea, `document.title` swapped
   so the browser's default PDF filename is right, and Web Share built from the
   *same* pure aggregates so the message and the printout cannot disagree.
9. **The pure/impure split is clean and it is why the 243 tests are worth
   something.** `clientTrends.ts`, `reportMetrics.ts`, `computeVerdict`,
   `computeWeekAdherence`, `computeClientAnalytics`, `summarizeRoster`,
   `computeStreaks`, `isReminderDue`, `createThrottledRefresh`,
   `resolveCoachBackTarget` are all I/O-free and injectable-clock, and all tested.
   The service layer is mockable at the Supabase boundary, which is what the 168
   service tests exercise.
10. **Hebrew copy is one consistent register** (gender-neutral plural), status
    enums are never leaked raw to the UI (`STATUS_LABEL`, `INVITE_STATUS_LABEL`,
    `KIND_LABEL`, `ACTION_LABEL`, `TABLE_LABEL`), counts agree with their nouns via
    `pluralizeHe`, and raw Supabase error strings are kept in the log — never shown
    ("never leak an English DB string into the Hebrew UI").

---

## 10. THE SHORT VERSION

The coach side is **13,922 lines of product code across 55 files**, plus 3,394 lines
of tests, plus a trainee-side surface area of ~15 consuming files.

It is **not** a scaffold and it is **not** fake. Of every numeric surface traced,
four are placeholders and all four are minor (a bar height, an ICS start time, a
copy/constant mismatch, a `?? 0`). The rest is REAL or DERIVED, and the code
defends against fabricated numbers more systematically than any other part of this
app that has been audited.

What is actually true of it is narrower and more awkward: **it has never been
run.** 243 unit tests cover services and pure functions; **not one component render
test exists**, functional e2e coverage is zero, and the one e2e test that looks
like coach coverage is an assertion-free screenshot capture running as a guest that
is redirected out of `/coach` before it shoots. Two chart call sites feed a
primitive whose y-axis normalization changed, and one of them (`TrainingTab`, 4-week
volume) will render a flat mid-height line for a client who has never trained,
because it lacks the empty-state guard its sibling has.

Five things are dead: three tombstone-correct, audited, tested delete writers with
no UI, plus `isCoachEnabled` and `getThread`.

And it cannot be deleted as a unit. The trainee's home-screen "האימון של היום"
card, the invite onboarding path, assigned-program start, assigned nutrition
targets, the check-in feature, the unread badge, Web Push, the live cloud-reflection
hooks, both chat surfaces, and the page shell `/my-coach` is built from all live
inside `src/pages/coach/**` and `src/services/coach/**`.

The decision this document is meant to inform is a real one. It is just not
"is this real?" — it is closer to "is a well-built half nobody has ever opened
worth the cost of opening it?", and answering that needs one coach account with one
seeded client, which this machine does not have.

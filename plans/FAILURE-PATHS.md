# FAILURE-PATHS — what this app does when something fails

T-109. Audit date 2026-08-30. Read-only audit; no product code, test or config was touched.

---

## METHOD

Static reading only. **No build, no dev server, no browser, no test run** — another worker
holds the build this batch. No `.env*` file was read. No git command was run.

Every claim below is labelled:

- **VERIFIED** — I read the code at the cited `file:line` and the claim follows from what is
  written there.
- **INFERRED** — I reasoned about runtime behaviour I could not execute, or about third-party
  library behaviour I did not read the source of. Treat these as hypotheses to confirm.

Files read end-to-end: `src/services/sessionDb.ts`, `src/services/offlineQueue.ts`,
`src/services/syncEngine.ts`, `src/services/indexedDBCore.ts`,
`src/services/supabaseSyncOrchestrator.ts`, `src/services/authSessionTransition.ts`,
`src/services/userScopedLocalData.ts`, `src/services/coach/assignmentService.ts`,
`src/components/workout/core/WorkoutProvider.tsx`,
`src/components/workout/hooks/useWorkoutSave.ts`, `src/components/ui/OfflineIndicator.tsx`.
Partially read: `src/services/supabaseAuth.ts`, `src/contexts/AuthContext.tsx`,
`src/pages/Settings.tsx`, `src/components/workout/components/WorkoutActions.tsx`,
`src/components/workout/WorkoutSummary.tsx`, `src/hooks/useCloudDataReflection.ts`,
`src/pages/nutrition/hooks/useNutritionData.ts`, `src/services/prService.ts`.

One methodological note, because it affects how much of Q5 you should trust: the exhaustive
`catch`-block sweep I intended to run via PowerShell failed — the shell mangled the quoting and
returned a false `0` with exit code 0 (the known non-ASCII/stdout hazard on this host). I did
not retry it. Q5 is therefore scoped to the workout save / sync / draft-persistence paths I
read directly, **not** to all 46 service files. The population size is real and measured
(152 candidate `catch` sites across 46 files in `src/services`, grep count mode) but I
classified only the workout-data ones. See *Not determined*.

---

## HEADLINE

**Yes — a logged workout can be actually lost, not merely delayed. Three ways.** None of them
is in the sync layer. The sync layer is the best-defended part of this codebase and I found no
defect in it. The losses are in the *local* durability layer and in one gap between "no cloud
attempt was made" and "queued for later".

The cloud-sync degradation behaviour is **CORRECT** and should not be changed. The observed
401s are **NOISE**. The three loss paths are **DEFECTS**.

---

## 1. SAVING A WORKOUT — what does the user SEE when the save fails?

**They see a Hebrew error inside the still-open confirm overlay, AND an 8-second error toast
with a working "נסה שוב" retry button. This path is handled well.** (VERIFIED)

Trace:

- `src/components/workout/hooks/useWorkoutSave.ts:177` — `await saveWorkoutSession(session)`.
- `src/services/sessionDb.ts:27` — the real implementation (`dataService.ts:31` only re-exports it).
- `src/services/sessionDb.ts:28` — `await dbPut(STORES.WORKOUT_SESSIONS, session)`. `dbPut`
  rejects on `tx.onerror` / `tx.onabort` (`src/services/indexedDBCore.ts:271-283`), so a failed
  local write **does** propagate.
- `src/components/workout/hooks/useWorkoutSave.ts:278` — `setSaveError(\`שגיאה בשמירת האימון: …\`)`.
- `:283-291` — `showToast('שמירת האימון נכשלה', { variant:'error', duration:8000, action:{ label:'נסה שוב' … } })`,
  and the retry is dispatched through `retryFinishRef` (`:298`) specifically so the toast
  closure cannot capture a stale handler.

Three deliberate details worth crediting, because they are the difference between this being
handled and not:

1. The confirm overlay is kept **open** across the `await` (comment at `:160-165`). An earlier
   version closed it first, so a failed save rendered its error into an unmounted component and
   the user saw nothing.
2. `trackFunnel('workout_completed')` fires **after** the await (`:181`), so the funnel cannot
   claim a workout that was not persisted.
3. Zero completed sets is caught **before** anything closes: `setSaveError('לא הושלם אף סט…')`
   at `:146`.

Classification: **CORRECT / already handled well.** No action.

### 1a. The second, weaker finish path

There is a parallel finish implementation in `src/components/workout/components/WorkoutActions.tsx:307`.
It sets `saveError` (`:341`) but has **no toast and no retry action**, and its post-save
verification is decorative: `throw new Error('Session verification failed …')` at `:315` is
caught by its own bare `} catch {` at `:317`, whose entire body is the comment
"Session may still be saved - continue without verification" (`:318`). (VERIFIED)

Classification: **DEFECT (low).** Not data loss — the local write already succeeded or already
threw. It is a dead throw and an inconsistent error surface between two paths that do the same
job. Worth deleting the fake verification rather than "fixing" it.

---

## 2. NETWORK LOST MID-WORKOUT — and can a logged workout ever be LOST?

### Does the workout continue? Yes. (VERIFIED)

In-progress logging touches **no network at all**. Every set goes to a reducer and is persisted
to `localStorage` under `active_workout_v3_state`
(`src/components/workout/core/WorkoutProvider.tsx:34`), via four independent triggers: a 500 ms
debounce (`:249`), an unmount flush (`:263`), visibility-hidden + beforeunload (`:275`, `:284`),
and a 30 s interval backup (`:305`). Connectivity is irrelevant to all four.

### Does anything tell them? Yes. (VERIFIED)

`src/components/ui/OfflineIndicator.tsx:130-158` renders a sticky `role="status"`
`aria-live="polite"` banner reading `אין חיבור - האפליקציה פועלת במצב לא מקוון`, and when there
are queued rows it shows the count plus a `סנכרן עכשיו` button (`:88-127`). It correctly
renders nothing for a guest who is online (`:84`), because a guest's queue never drains.

### Is the local write independent of the cloud write? Yes, and in the right order. (VERIFIED)

`src/services/sessionDb.ts:27-41`:

```
await dbPut(...)                     // local, AWAITED — blocks the UI, surfaces failure
const user = await getCurrentUser()  // line 30
if (user) { syncWithRetry(..., { type:'session:update', payload }) }   // lines 31-38, NOT awaited
emitWorkoutSaved()                   // line 41
```

The cloud call is fire-and-forget with an offline-queue descriptor attached. A network failure
cannot block, delay or fail the save the user is waiting on. That is exactly right for an
offline-first app.

### CAN A LOGGED WORKOUT BE LOST? YES. Three ways.

I am not hedging this. Two of the three need no unusual conditions.

---

#### DEFECT-2a — the 12-hour draft expiry silently deletes an unfinished workout

**Severity: high.** Data loss, no notice, no trace, no recovery.

`src/components/workout/core/WorkoutProvider.tsx:40` sets `MAX_DRAFT_AGE_MS = 12 hours`.
On load, `:158-161`:

```
if (lastWrite && Date.now() - lastWrite > MAX_DRAFT_AGE_MS) {
  platform.removeItem(STORAGE_KEY);
  return null;
}
```

Repro:
1. Start a workout, log several sets.
2. Do not tap finish. Background the app (phone dies, battery, interruption, you simply forget).
3. Reopen more than 12 hours after the last persist.

Expected: the sets are still there, or the user is told they were dropped and why.
Actual: `localStorage` key removed, `null` returned, a blank new workout state is created. No
toast, no log, no dialog. Every logged set is gone and the user has no way to know it ever existed.

The 12-hour window is not generous in practice. The stamp is the **last persist**, not the start,
so an evening session logged around 21:00 expires around 09:00 the next morning — which is
squarely inside "I'll finish logging this tomorrow".

The guard itself is defensible: the code comment (`:36-38`) explains that resuming an ancient
draft made the timer open at hours-elapsed and produced a nonsensical saved duration. That is a
real problem. But the current fix trades a wrong *duration* for a silent loss of the *data*.
Deleting the draft is not the only way to fix a bad `startTimestamp`.

Evidence: `src/components/workout/core/WorkoutProvider.tsx:40`, `:150-162`.

---

#### DEFECT-2b — `persistState` reports failure and all four call sites ignore it

**Severity: high.** Data loss, no notice.

`persistState` returns `boolean` and returns `false` when both the full and the slim write fail
(`src/components/workout/core/WorkoutProvider.tsx:64`, `:101`). It is called at `:249`, `:263`,
`:275`, `:284` and `:305`. **Not one of those five call sites reads the return value.** (VERIFIED)

So when `localStorage` cannot be written — quota exhausted, Safari private mode, a storage
policy — the app logs `logger.workout.error` to the console (`:100`) and carries on rendering a
workout that is not being saved anywhere. The user keeps logging sets into RAM. A reload, a tab
eviction, or iOS reclaiming the tab loses all of them, with no signal at any point.

This one is strictly worse than 2a in kind, because 2a at least only fires after a long absence,
whereas this fires silently for the whole session.

Note the mitigation that *is* present and is good: the slim-payload retry at `:82-97` drops
overlay/celebration state and re-tries with only durable fields. That makes a total failure
much rarer. It does not make it observable.

Evidence: `src/components/workout/core/WorkoutProvider.tsx:64-103`, `:249`, `:263`, `:275`,
`:284`, `:305`.

---

#### DEFECT-2c — a save made while `getCurrentUser()` returns null is never queued, never
pushed, and is invisible to the sign-out warning that then destroys it

**Severity: high.** Data loss, no notice, and it defeats a guard that was purpose-built to
prevent exactly this.

The chain, each link cited:

1. **The queue descriptor lives inside the `if (user)` branch.**
   `src/services/sessionDb.ts:30-38`. If `getCurrentUser()` returns `null`, the session is
   written to IndexedDB and **nothing is enqueued** — no `mutation_queue` row, no dead-letter
   row, no `pending_sync` row. (`STORES.PENDING_SYNC` is created at
   `src/services/indexedDBCore.ts:140-143` and is **never read or written anywhere in `src/`** —
   dead store. VERIFIED by grep: only the schema definition and one unrelated comment.)
   (VERIFIED)

2. **Nothing ever pushes local-only rows afterwards.** Sign-in only *pulls*:
   `src/contexts/AuthContext.tsx:126-131` calls `pullAllData()` on `SIGNED_IN`. A warm open only
   pulls: `src/hooks/useCloudDataReflection.ts:110-119`. The only paths that push local→cloud
   are the per-record `syncWithRetry` at write time (skipped here), offline-queue replay
   (nothing queued), `adoptGuestDataForUser` (guest→first account only,
   `src/services/offlineQueue.ts:1030-1046`), and a manual "sync now" in Settings
   (`src/pages/settings/hooks/useCloudSync.ts:68`). The row is local-only indefinitely.
   (VERIFIED)

3. **The sign-out data-loss guard cannot see it.** `src/pages/Settings.tsx:116-137` counts
   `getQueueDepth()` + `getDeadLetterCount()` and only warns `if (depth + held > 0)` (`:135`).
   Both are zero here, so no warning is shown. (VERIFIED)

4. **Sign-out then wipes it.** `signOut()` → `transitionAuthSession(null, { forceCleanup: true })`
   (`src/services/supabaseAuth.ts:289`) → `clearUserScopedLocalData()`
   (`src/services/authSessionTransition.ts:143`) → `dbClear` over every store including
   `workout_sessions` (`src/services/userScopedLocalData.ts:104-111`). Gone. (VERIFIED)

How does `getCurrentUser()` return null for someone who has an account? Two triggers:

- **A 401 or "invalid JWT" during a token refresh.** `getCurrentUser`
  (`src/services/supabaseAuth.ts:120-148`) routes that through `handleExpiredSession`, which
  signs out and returns `null` (`:101-118`, `:132`). This is a case the file explicitly models,
  so the hole is reachable through the codebase's own documented path. (VERIFIED)
- **Offline with an expired access token.** `getSession()` is a local read, but a token past
  expiry triggers a refresh, which fails with a network error offline. `isSessionExpiredError`
  (`:34-70`) correctly does **not** match a plain fetch failure, so the session is not dropped —
  but execution falls through to `supabase.auth.getUser()` at `:141`, which is a network call,
  which fails offline, and `user` is `null`. (**INFERRED** — this depends on the exact
  `getSession()` / `getUser()` behaviour of the pinned `@supabase/supabase-js`, which I did not
  read. The 401-refresh trigger above does not depend on it.)

Note the bitter irony worth flagging to whoever fixes this: the offline queue, the dead-letter
store, the owner stamping, the sign-out warning and the `handleExpiredSession` rewrite are all
sophisticated, well-commented defences built specifically to stop unsynced data being destroyed.
They all key off *the queue*. A write that never entered the queue is outside every one of them.
The OfflineIndicator has the same blind spot — it reports queue depth, so it displays a
reassuring nothing in precisely the case where data is at risk.

Suggested direction (not implemented, read-only task): enqueue unconditionally and stamp the
owner as `GUEST_OWNER` / `UNKNOWN_OWNER`, which `offlineQueue` already supports and already
quarantines correctly (`src/services/offlineQueue.ts:74-88`, `:790-800`). That turns this silent
loss into the existing, already-good "אשרו אותם מההגדרות" recovery flow.

---

### What is NOT a loss (stated explicitly, because it looks like one)

- **Degrading to local-only when offline.** Designed behaviour. `CORRECT`.
- **A queued mutation waiting up to 30 minutes.** Backoff schedule 5s/30s/2m/10m/30m,
  `src/services/offlineQueue.ts:104`. Delay, not loss.
- **A permanently rejected push.** Payload preserved in the dead-letter store. See Q3.

---

## 3. A SYNC PUSH IS REJECTED BY THE SERVER

**Handled well. No defect found. No poison-message path exists.** (VERIFIED)

What happens to a rejected queued change:

- Errors are classified by SQLSTATE first, HTTP status second
  (`src/services/offlineQueue.ts:176-243`). `NON_RETRIABLE_STATUS = {400,401,403,404,413,415,422}`
  (`:128`). The 40xxx/08xxx/53xxx classes are explicitly *retriable* (`:141-156`) because
  serialization failures and deadlocks are the database asking you to retry.
- Permanent error → `moveToDeadLetter(mutation, 'permanent_error')` (`:863`). Retries exhausted
  (`MAX_RETRIES = 5`, `:101`) → `moveToDeadLetter(mutation, 'max_retries')` (`:879`).
- `moveToDeadLetter` moves the row in **one transaction** across both stores (`:436-450`), so a
  crash mid-move cannot drop the payload.
- **The payload is preserved, not deleted.** There is a full recovery API: `listDeadLetters`,
  `retryDeadLetter`, `retryAllDeadLetters`, `discardDeadLetter`, `exportDeadLetters`
  (`:1056-1150`), reachable from Settings.
- The user is told, once per pass, correctly pluralised, and the wording is honest about where
  the data is: `שינוי אחד לא נשמר בענן. הוא נשמר במכשיר וניתן לנסות שוב מההגדרות` (`:900-910`).
  Quarantined ownerless entries get a *separate, non-alarming* message (`:915-925`) because the
  user has to make a decision rather than being told sync broke.

**Is there a poison-message path where one bad row blocks the queue? No.** The replay loop
processes entries independently and `continue`s past every failure class
(`:790`, `:800`, `:812`, `:822`, `:868`). Each failing entry carries its own `nextAttemptAt`
backoff (`:872`) so it cannot burn attempts on every tick. Head-of-line blocking is structurally
impossible here.

Two further things that are right and rarely are: replay is revision-guarded, so a re-edit
during an in-flight request is not silently discarded (`deleteMutationIfUnchanged` `:322-352`,
`putMutationIfUnchanged` `:359-380`); and entries are owner-stamped so a queued write can never
replay into another account on a shared device (`:790-810`).

Bulk push (`syncAllData`) is equally careful: a rejected upsert batch is counted, logged, and
**downgrades the result to failure** rather than reporting success
(`src/services/supabaseSyncOrchestrator.ts:264-283`, `:390-405`), and a local store that could
not even be *read* also fails the result (`:398-401`) — because "we skipped a whole store" must
never look like "backed up".

One genuine nit, NOISE level: `syncWithRetry`'s trailing `.catch` can itself throw if
`queueMutation` fails inside it (`src/services/syncEngine.ts:110-117`), and the call from
`sessionDb.ts:32` is un-awaited, so that would surface as an unhandled promise rejection. Harmless
in effect; the local write already succeeded.

Classification: **CORRECT.**

---

## 4. A READ RETURNS 401 OR 403

**Found it. The task's hypothesis is right: this is NOISE, and the correct action is to delete
the calls, not to alarm about them.** (VERIFIED)

The 401 comes from `listMyAssignments` (`src/services/coach/assignmentService.ts:241-256`). It
queries `assignments` with **no authentication guard at all**:

```
const supabase = requireClient();                 // :242 — checks CONFIG only, not session
const { data, error } = await supabase.from('assignments')…   // :243-248
if (error) { logger.db.error('listMyAssignments failed', error); return []; }   // :250-253
```

`requireClient()` (`src/services/coach/mappers.ts:34-39`) only throws when Supabase is
*unconfigured*. It says nothing about whether anyone is signed in. So for a guest, PostgREST
answers 401, the error is logged to the console, and `[]` is returned.

**Two call sites, which is exactly the two requests observed per workout:** (VERIFIED)

1. `src/components/workout/ActiveWorkoutNew.tsx:150` — mount effect on the workout screen,
   looking for a coach-assigned program card. Its `catch` logs
   `logger.workout.warn('coach program assignment load failed')` with the comment
   "Offline/guest: no coach card … never surface to the user here" (`:151-154`).
2. `src/pages/nutrition/hooks/useNutritionData.ts:347` — mount effect looking for a coach
   nutrition target.

Is the 401 handled, swallowed, or printed? **Printed.** `logger.db.error` inside the service,
plus `logger.workout.warn` at the workout call site. Nothing reaches the UI, which is right —
a guest has no coach, so there is nothing to tell them.

**Other reads with the same shape:** yes. The sibling `listCoachAssignments`
(`:216-239`) *does* guard (`if (!user) return []`, `:219`), which shows the guard was simply
omitted from the trainee-facing one. I did not enumerate every coach reader; the pattern
"`requireClient()` → query → `logger.db.error` → `return []`" recurs throughout
`src/services/coach/`, and the same guest 401 will occur on any surface that calls one of them
without an auth/guest gate.

Classification: **NOISE.** Harms nothing — the fallback `[]` is the correct value for a guest and
the UI degrades to "no coach card", which is what a guest should see. Worth removing because two
guaranteed-failing requests per workout pollute the console for everyone debugging anything else,
and a red 401 in the network panel trains people to ignore red 401s. The fix is a guard at the
call sites (or an `if (!user) return []` at `:242`, matching `listCoachAssignments`), not error
handling.

---

## 5. SILENT SWALLOWS ON USER-DATA PATHS

**Excluded by design, and why:** analytics/funnel (`trackFunnel`), haptics
(`triggerHaptic`, `vibratePattern`), push notifications (`sendCoachPush`), toast delivery
(`notify`'s own `catch` at `src/services/offlineQueue.ts:748-752`), the PR celebration
notification, and the coach schedule / program-progress reconciliations. A failure in any of
these costs the user nothing they can perceive as data, and several are *deliberately*
best-effort with comments saying so and with the save explicitly protected from them
(`useWorkoutSave.ts:214-222`, `:232-260`). Swallowing there is correct engineering, not a defect.

On paths that touch user data, these are real:

| # | Site | What is swallowed | Consequence | Class |
|---|---|---|---|---|
| 5a | `WorkoutProvider.tsx:163-165` — `loadState`'s `catch { }`, comment "Ignore persistence errors silently" | any failure reading/parsing the in-progress draft | a corrupt or unreadable draft becomes a blank new workout; the user's unfinished session vanishes with no message | **DEFECT (medium)** — same family as 2a, different trigger |
| 5b | `WorkoutActions.tsx:317-319` — `} catch { }` swallowing its own `throw` from `:315` | the post-save verification result | the verification is decorative; it can never report anything | **DEFECT (low)** — dead code, delete it |
| 5c | `sessionDb.ts:47-58` — `getWorkoutSession`'s `catch { return null }` | any IndexedDB read failure | a read failure is indistinguishable from "this workout does not exist"; callers cannot tell "gone" from "could not check" | **DEFECT (low)** |
| 5d | `WorkoutSummary.tsx:425-427` — rating save, `logger.workout.warn` only | failure to persist the workout rating | the star stays lit in local state, so the UI says saved when it was not | **DEFECT (low)** — misreports success on user data |
| 5e | `useWorkoutSave.ts:209-211` — `catch { }` on the `_completed` marker write | failure to mark the draft completed | the finished workout can be offered for "restore" again | **DEFECT (low)** — annoyance, not loss (the session is already persisted) |

5a is the one that matters. The other four are small and honest to report as small.

**Not classified:** the remaining ~140 candidate `catch` sites in `src/services` outside the
workout save/sync/draft paths — notably nutrition, water, body-stats and community writes. See
*Not determined*.

---

## SUMMARY TABLE

| Finding | Class | Severity | Data loss? |
|---|---|---|---|
| 2a — 12h draft expiry deletes an unfinished workout silently | DEFECT | high | **yes** |
| 2b — `persistState` failure ignored at all 5 call sites | DEFECT | high | **yes** |
| 2c — unqueued save + pull-only sign-in + blind sign-out warning | DEFECT | high | **yes** |
| 5a — draft load `catch { }` | DEFECT | medium | yes (unfinished draft) |
| 1a / 5b — dead verification throw, no toast on the second finish path | DEFECT | low | no |
| 5c — `getWorkoutSession` read failure reads as "not found" | DEFECT | low | no |
| 5d — workout rating save failure shown as success | DEFECT | low | no (one field) |
| 5e — `_completed` marker write swallowed | DEFECT | low | no |
| Q1 — visible error + toast + working retry on save failure | CORRECT | — | no |
| Q2 — local write independent of and prior to cloud write | CORRECT | — | no |
| Q2 — offline banner, `aria-live`, queue count, manual sync | CORRECT | — | no |
| Q3 — dead-letter store, classifier, no head-of-line blocking | CORRECT | — | no |
| Q3 — bulk push refuses to report partial success | CORRECT | — | no |
| Q3 — `syncWithRetry` trailing `.catch` can reject unhandled | NOISE | — | no |
| Q4 — two guest 401s on `/rest/v1/assignments` per workout | NOISE | — | no |

Five of the eight defects are low-severity and I would not have filed them alone. The three
high ones are the task.

---

## WHAT I COULD NOT DETERMINE, AND WHY

1. **Whether `getCurrentUser()` actually returns `null` for an offline user with an expired
   access token.** This is the most reachable trigger for DEFECT-2c and it is **INFERRED**. It
   depends on the pinned `@supabase/supabase-js` behaviour of `getSession()` (does it attempt a
   refresh, and does it return the stale session or an error when that refresh fails offline?)
   and of `getUser()` offline. I did not read the library source and could not run anything.
   The *other* trigger — a 401 during refresh — is VERIFIED from
   `src/services/supabaseAuth.ts:101-148` and is sufficient on its own to make 2c real, so the
   defect stands regardless. But the *frequency* of 2c hinges on this, so confirm it before
   sizing the fix.

2. **Whether 2a and 2b ever actually fire in the field.** Both are structurally certain from the
   code; neither is instrumented. `logger.workout.error` at `WorkoutProvider.tsx:100` goes to
   the console only — there is no `reportError` call on that path, so no telemetry exists to say
   how often a persist fails or how many drafts are GC'd at 12 hours. This cannot be answered
   from source at all.

3. **Runtime confirmation of anything.** No browser, no dev server, no test run, no build, per
   the task constraints. Nothing below is backed by an observed screen, a screenshot, a console
   capture or a passing/failing test. Every claim is a reading of source.

4. **The ~140 remaining `catch` sites** in `src/services` outside the workout paths. My
   exhaustive sweep failed (shell quoting mangled the command and it returned a false `0` at
   exit 0) and I did not retry it. Nutrition, water, body-stats and community write paths are
   therefore **unexamined** for silent swallows. If DEFECT-2c's shape (`if (user)` guarding the
   queue descriptor) is repeated in those services, the same loss applies to those record types
   — `waterService`, `bodyStatsService` and `nutritionService` are the ones I would check first,
   and I did not check them.

5. **RTL / a11y / 390px rendering of any of these failure states.** Out of scope for this task
   and untestable without a browser. In particular I could not check whether the
   `שגיאה בשמירת האימון: ${errorMessage}` interpolation renders sanely when `errorMessage` is a
   Latin-script DOMException name inside a Hebrew sentence — that is a plausible bidi problem at
   `useWorkoutSave.ts:278` and it is unverified.

6. **Whether the 12-hour draft window was a deliberate product decision.** The code comment
   (`WorkoutProvider.tsx:36-38`) justifies discarding *stale timestamps*, not discarding *data*.
   I could not tell whether anyone chose to accept the data loss as the price, or whether it was
   an unnoticed consequence. That is a question for whoever wrote it, and it changes whether 2a
   is a bug or a bad requirement.

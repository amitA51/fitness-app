# T-117 — Sync-shape sweep of five never-opened write-path services

Report only. No code was changed. Every claim is tagged **VERIFIED** (I read the cited
line) or **INFERRED** (I reasoned from what I read).

## Verdict up front

| Service | Repeats the sessionDb shape? | Worst realistic outcome |
|---|---|---|
| `src/services/templateDb.ts` | **Yes** — all 3 write paths | User's authored template lost, warning says nothing |
| `src/services/prService.ts` | **Yes** — both write paths | Personal record lost, no automatic rebuild exists |
| `src/services/exerciseDb.ts` | **Yes** — all 4 write paths | Custom exercise lost; built-ins re-seed, so mostly harmless |
| `src/services/personalItemsDb.ts` | **No** — no enqueue anywhere, by design | In-progress workout scratch state, rebuildable |
| `src/services/programProgressService.ts` | **No** — enqueues unconditionally | None found; this is the correct pattern |

Three of the five repeat the shape. Two do not, and one of those
(`programProgressService.ts`) is the shape the other three should be copying.

---

## The shape, both halves

**The mechanism** — VERIFIED. `syncWithRetry` takes the offline-queue descriptor as its
**4th argument** (`src/services/syncEngine.ts:85`), and that is the only thing that ever
calls `queueMutation` on failure (`src/services/syncEngine.ts:99-101`, `:109-111`).
So when a guarded call never runs, **no queue row is created at all** — there is no
partial state, no half-queued record, nothing for any recovery machinery to find.

Note also `src/services/syncEngine.ts:87` — if Supabase is not configured the function
returns before queueing anything. That is deliberate and not a defect (no cloud, nothing
at risk), and the fixed `sessionDb` mirrors it at `src/services/sessionDb.ts:196`.

**Why `if (user)` is the wrong guard** — VERIFIED. `getCurrentUser()` returns `null`, not
an error, for somebody who genuinely has an account: `src/services/supabaseAuth.ts:128-131`
and `:141-145` both call `handleExpiredSession()` and `return null` when the session or
refresh fails. A signed-in user mid-token-refresh is indistinguishable from a guest at
these call sites.

**The corrected shape** — VERIFIED, `src/services/sessionDb.ts:196-225`: gate on
`isSupabaseConfigured()` (`:196`), record a local ledger marker first (`:201`), sync when
a user resolves (`:203`), and **in the `else` branch enqueue unconditionally** (`:224`).
`queueMutation` stamps ownership itself, so the call site needs no user id.

### The loss chain, confirmed end to end

1. **Nothing pushes it later, automatically.** VERIFIED. A bulk push exists —
   `syncAllDataImpl` reads `WORKOUT_TEMPLATES`, `PERSONAL_EXERCISES` and
   `PERSONAL_RECORDS` (`src/services/supabaseSyncOrchestrator.ts:170-183`) — but it has
   only two production callers: the manual Settings actions
   (`src/pages/settings/hooks/useCloudSync.ts:67-68`, `:125-126`) and guest→first-account
   adoption (`src/services/offlineQueue.ts:1040-1041`, reached only from
   `src/services/authSessionTransition.ts:111`). Neither fires on an ordinary
   re-authentication, so recovery depends on the user pressing "sync now" without ever
   being told they need to.
2. **A pull will not destroy it, and will not save it.** VERIFIED. The pull path merges
   rather than replaces (`src/services/supabaseSyncOrchestrator.ts:549`, `:551`, `:554`),
   so a local-only row survives a pull — and stays local-only.
3. **A wipe destroys it.** VERIFIED. `USER_SCOPED_STORAGE_REGISTRY.indexedDbStores` is
   `Object.values(STORES)` — every store, no exceptions
   (`src/services/userScopedLocalData.ts:16-17`). Triggered by explicit sign-out and
   account deletion (`forceCleanup`) and by an account switch
   (`src/services/authSessionTransition.ts:143`). A lost credential alone does *not* wipe
   (`src/services/authSessionTransition.ts:117-122`), so the record can sit on the device
   for weeks before the sign-out that kills it.
4. **The warning reports nothing.** VERIFIED. The sign-out guard counts
   `depth + held + unsyncedSessions` (`src/pages/Settings.tsx:158-160`), and
   `getUnsyncedSessionCount()` reads a ledger that only ever contains **workout sessions**
   (`src/services/sessionDb.ts:126`). A template, exercise or PR that never entered the
   queue contributes zero to all three terms. Same blind spot in the offline badge, which
   reads queue depth plus session count only (`src/components/ui/OfflineIndicator.tsx:29-36`).

That is the full sessionDb failure, reproduced for three more record types.

---

## 1. `src/services/templateDb.ts` — REPEATS THE SHAPE (3/3 write paths)

| Write | Enqueue exists? | Inside an auth guard? | Lines |
|---|---|---|---|
| `createWorkoutTemplate` | Yes | **Yes** | guard `:100-101`, enqueue `:107` |
| `updateWorkoutTemplate` | Yes | **Yes** | guard `:132-133`, enqueue `:138` |
| `deleteWorkoutTemplate` | Yes | **Yes** | guard `:153-154`, enqueue `:166` |

1. **Enqueue at all?** Yes — VERIFIED, `:107`, `:138`, `:166`, each the 4th argument to
   `syncWithRetry`.
2. **Inside a guard?** Yes — VERIFIED. Each is wrapped in `const user = await getCurrentUser();`
   / `if (user) {` with **no `else`**: `:100-101`, `:132-133`, `:153-154`. Textually the
   same construct as the pre-fix `sessionDb`.
3. **What the user sees on failure:** nothing. VERIFIED by construction — the local
   `dbPut` at `:98` (create), `:130` (update) and `dbDelete` at `:151` (delete) all
   succeed and the function returns the record normally; `syncWithRetry` is called
   fire-and-forget (no `await`, no `.catch`) and routes failures to `reportError`, which
   only reaches Sentry and `console` (`src/services/errorReporter.ts:33-36`). The UI shows
   a saved template.
4. **Can the record be lost?** **Yes.** VERIFIED against the four-step chain above. Write
   a template while auth is transiently null → local row, no queue row → next explicit
   sign-out or account switch wipes `WORKOUT_TEMPLATES` while the dialog reports nothing
   pending.

## 2. `src/services/prService.ts` — REPEATS THE SHAPE (2/2 write paths)

| Write | Enqueue exists? | Inside an auth guard? | Lines |
|---|---|---|---|
| `savePR` | Yes | **Yes** | guard `:116-117`, enqueue `:132` |
| `deletePR` | Yes | **Yes** (early return) | guard `:172-173`, enqueue `:192` |

1. **Enqueue at all?** Yes — VERIFIED, `:132` and `:192`.
2. **Inside a guard?** Yes — VERIFIED. `savePR` uses `if (user) {` at `:117` with no
   `else`. `deletePR` is the same defect in a different syntax: `if (!user) return;` at
   **`:173`**, placed *after* the local `dbDelete` at `:170`.
3. **What the user sees on failure:** nothing for the sync. VERIFIED — same
   fire-and-forget construction. Worth noting the PR *toast/notification* fires from
   `checkForNewPR` (`:288-299`) purely on the local write, so the user is actively
   **congratulated** on a record that has no cloud copy and no queue row.
4. **Can the record be lost?** **Yes, and with a twist in each direction.** VERIFIED.
   - `savePR`: the PR is wiped like any other unqueued row.
   - `deletePR`: when `user` is null the local row is deleted at `:170` and the function
     returns at `:173` **without queueing the tombstone**. The cloud copy stays live, so
     the next pull re-inserts the PR the user deleted. This is the resurrection bug the
     comment at `:151-158` says the tombstone exists to prevent — the guard defeats it.
   - INFERRED: `rebuildPRsFromHistory` (`:430`) could recompute PRs from surviving
     sessions, but a grep across all of `src/` finds **no caller at all** — only the
     definition. So there is no automatic repair, and I found no UI that triggers one.

## 3. `src/services/exerciseDb.ts` — REPEATS THE SHAPE (4/4 write paths)

| Write | Enqueue exists? | Inside an auth guard? | Lines |
|---|---|---|---|
| `createPersonalExercise` | Yes | **Yes** | guard `:153-154`, enqueue `:159` |
| `updatePersonalExercise` | Yes | **Yes** | guard `:188-189`, enqueue `:194` |
| `deletePersonalExercise` | Yes | **Yes** | guard `:231-232`, enqueue `:237` |
| `removeDuplicateExercises` | Yes | **Yes** | guard `:331-332`, enqueue `:341` |

1. **Enqueue at all?** Yes — VERIFIED, `:159`, `:194`, `:237`, `:341`.
2. **Inside a guard?** Yes — VERIFIED, and in a shape slightly worse than the others:
   three of the four use a floating `getCurrentUser().then((user) => { if (user) {…} })`
   (`:153-154`, `:188-189`, `:231-232`) with **no `.catch` and no `else`**. INFERRED: if
   `getCurrentUser()` ever rejects rather than resolving null, that becomes an unhandled
   rejection and the sync silently never happens — a second, independent way to reach the
   same no-queue-row state. `removeDuplicateExercises` uses the plain
   `await` / `if (user)` form at `:331-332`.
3. **What the user sees on failure:** nothing. VERIFIED — the local writes commit inside
   their own IndexedDB transactions (`store.add` `:150`, `store.put` `:185`, `dbDelete`
   `:228`) and `resolve()` runs regardless of the sync outcome.
4. **Can the record be lost?** **Yes, but severity splits sharply.** VERIFIED for the
   mechanism; the split is INFERRED from the seeding logic:
   - A **user-created custom exercise** written during null auth is real authored content
     and is lost exactly like a template.
   - A **built-in catalogue entry** is re-seeded automatically on the next read by
     `loadAndSeedBuiltIns` (`:29-53`, matching on name), so losing one costs the user
     nothing they would notice.
   - `useCount` / `lastUsed` / `isFavorite` updates (`:246-268`) lose sort order and
     favourites — mildly annoying, not a data-loss event.
   - `deletePersonalExercise` and `removeDuplicateExercises` have the resurrection variant:
     no tombstone queued means the next pull re-adds the exercise the user deleted, and the
     comments at `:212-222` and `:317-325` state that this is precisely what those
     tombstones were added to stop.

## 4. `src/services/personalItemsDb.ts` — DOES **NOT** REPEAT THE SHAPE

1. **Enqueue at all?** **No — none, anywhere.** VERIFIED: the entire import list is
   `../types` and `./indexedDBCore` (`:23-24`). It imports no `syncEngine`, no
   `offlineQueue`, no `supabaseAuth`. All three writes are bare local calls:
   `addPersonalItem` `dbPut` at `:35`, `updatePersonalItem` `dbPut` at `:58`,
   `removePersonalItem` `dbDelete` at `:62`.
2. **Inside a guard?** Not applicable — there is no auth guard and no enqueue to guard.
   This is **not** the sessionDb shape: nothing was made conditional and then broken. The
   file declares the omission deliberately at `:3` ("DELIBERATELY NOT CLOUD-SYNCED, and
   that is not an oversight") and argues it across `:1-22`.
3. **What the user sees on failure:** an IndexedDB failure in `addPersonalItem` rejects and
   propagates to the caller; `updatePersonalItem` silently returns when the row is missing
   (`:46`). No sync failure is possible because no sync is attempted.
4. **Can the record be lost?** Yes, but it is scratch state. VERIFIED that the store is
   wiped (`Object.values(STORES)`, `src/services/userScopedLocalData.ts:16-17`) and absent
   from both sync directions. INFERRED, and I agree with the file's own reasoning at
   `:5-11`: a `PersonalItem` is the container for an **in-progress** workout materialised
   from a template by `templateDb.loadWorkoutFromTemplate` (`templateDb.ts:174-208`), and
   the durable outcome is the `WorkoutSession`, which *is* synced. Tapping the template
   again rebuilds it.

   One honest caveat I could not close: a user mid-workout who signs out loses that
   in-progress workout with no warning. That is a real if narrow gap, but it is a
   *missing feature* (cross-device live-workout state), not this bug — and note there is a
   separate `active_workout_v3_state` localStorage key in the wipe registry
   (`userScopedLocalData.ts:17`) which I did not trace.

## 5. `src/services/programProgressService.ts` — DOES **NOT** REPEAT THE SHAPE

This is the file that already gets it right, and it is worth reading before fixing the
other three.

1. **Enqueue at all?** Yes — VERIFIED. `mirrorToCloud` (`:81-91`) writes the local mirror
   (`dbPut` to `USER_SETTINGS`, `:84`) and then calls
   `queueMutation('setting:update', …)` at **`:86`**.
2. **Inside a guard?** **No.** VERIFIED — the decisive line. `mirrorToCloud` never calls
   `getCurrentUser()`; the whole file never imports `supabaseAuth` or `syncEngine`. The
   enqueue at `:86` is unconditional, inside a `try` whose only `catch` logs a warning
   (`:87-89`). Every write path funnels through it: `saveProgress` (`:93-101`) → `:100`,
   `saveSwaps` (`:222-228`) → `:227`, `resetProgram` (`:156-168`) → `:165-166`. So
   `startProgram`, `markProgramDayPending`, `setSwap`, `resetProgram` and
   `reconcileProgramOnSessionSave` are all covered.
3. **What the user sees on failure:** nothing directly — it is fire-and-forget
   (`void (async () => …)`, `:82`) with a `logger.app.warn`. **But** because the row does
   land in the queue, it becomes visible to the offline badge
   (`OfflineIndicator.tsx:29-31`) and, if it later fails permanently and dead-letters, to
   the sign-out warning's `held` term (`Settings.tsx:152`). That visibility is the entire
   difference between this file and the other three.
4. **Can the record be lost?** No path found. VERIFIED that the loss chain breaks at
   step 4: the queue row exists regardless of auth state, so the sign-out dialog counts it
   and the user is warned before the wipe. INFERRED: a mutation queued while auth is null
   is stamped `GUEST_OWNER`/`UNKNOWN_OWNER` and quarantined into the dead-letter store on
   replay (per `sessionDb.ts:214-222`), where it is still counted and recoverable from
   Settings — degraded, but never invisible. `restoreProgramProgressFromCloud` (`:108-136`)
   closes the loop on the way back in.

---

## Ranked by how much a real user would care

1. **`templateDb.ts` — highest.** A workout template is content the user *authored*, and
   nothing can regenerate it. All three write paths are affected, and templates are edited
   often enough that the exposure window is wide.
2. **`prService.ts` — high.** A personal record is the emotional payload of the app, and
   the user is shown a congratulatory notification for a PR that has no cloud copy
   (`prService.ts:288-299`). In principle derivable from session history, but
   `rebuildPRsFromHistory` has **no caller** (`:430`), so in practice it is gone.
   `deletePR`'s missing tombstone also resurrects deleted PRs — user-visible as records
   returning from the dead.
3. **`exerciseDb.ts` — mixed, mostly medium.** Custom exercises are authored content and
   belong with the templates above; built-in catalogue rows self-heal via
   `loadAndSeedBuiltIns` (`:29-53`) and losing one costs nothing. The delete-tombstone gap
   is the part a user would actually notice: deleted exercises reappearing.
4. **`personalItemsDb.ts` — low.** Deliberate local-only scratch state; rebuilt by tapping
   the template again. No fix warranted.
5. **`programProgressService.ts` — none.** Correct already.

---

## What the fix WOULD be, per file

**Not applied.** A sibling worker is fixing this same shape in the water, nutrition and
body-stats services; divergent copies of one rule are this project's most repeated defect,
so these should land in whatever form that worker settles on. Sketches only:

- **`templateDb.ts`** — give each of the three `if (user)` blocks (`:101`, `:133`, `:154`)
  an `else` that calls `queueMutation` with the same `type`/`payload` already passed as the
  4th argument at `:107`, `:138`, `:166`, and wrap the pair in an
  `isSupabaseConfigured()` check as `sessionDb.ts:196` does.
- **`prService.ts`** — same `else` for `savePR` (`:117`). For `deletePR`, replace the
  `if (!user) return;` at `:173` with a branch that queues the `tombstone` object already
  built at `:176-187`; the object does not depend on `user`, so this is a move, not a
  rewrite.
- **`exerciseDb.ts`** — same `else` in all four (`:154`, `:189`, `:232`, `:332`), and
  while there, give the three floating `getCurrentUser().then(...)` chains a `.catch` so a
  rejection cannot silently skip both branches.
- **`personalItemsDb.ts`** — no change. If anything is wanted here it is a separate
  feature (surviving an in-progress workout across sign-out), and the file already argues
  the case at `:1-22`.
- **`programProgressService.ts`** — no change. Consider it the reference for the others.

**Deliberately out of scope, flagged not fixed:** `deleteWorkoutSession` in the *already
fixed* `sessionDb.ts` still has a bare `if (user)` with no `else`
(`src/services/sessionDb.ts:385`), so a session deleted during null auth queues no
tombstone and can be resurrected by the next pull. Same family as `deletePR` above. Not
one of my five files — raising it, not touching it.

---

## Limits — what I could not determine

- **Runtime confirmation: none.** No gates, build, tests or browser were run, per the
  task's constraints. Every finding is a static read of the current tree.
- **Frequency of the trigger is unquantified.** I verified that `getCurrentUser()` *can*
  return null for a signed-in user (`supabaseAuth.ts:128-131`, `:141-145`) but not how
  often that window is open in practice. That governs how likely this is, not whether it
  is real.
- **`active_workout_v3_state`** (`userScopedLocalData.ts:17`) is in the wipe registry and
  is plausibly the real home of in-progress workout state rather than
  `PERSONAL_ITEMS`. I did not trace it — outside the five files, and it would change the
  `personalItemsDb` reasoning only in detail, not in verdict.
- **UI callers were not audited exhaustively.** My answer to "what does the user see" is
  grounded in the fire-and-forget call construction plus `errorReporter.ts:33-36`, which is
  sufficient to establish silence for the *sync* failure. I did not enumerate every screen
  that calls these functions to check for local-write error handling.
- **`removeDuplicateExercises`** — I read the tombstone path (`:331-341`) but did not
  establish what invokes the cleanup, so I cannot say how often that path runs.

# SILENT-WRITE-SWEEP — T-114

Read-only audit. No product code, config, or test was modified. No gates, build, browser, or git
commands were run.

Scope: `src/services/nutritionService.ts`, `src/services/waterService.ts`,
`src/services/bodyStatsService.ts`, plus the files they delegate their writes to
(`syncEngine.ts`, `offlineQueue.ts`, `localStateMirror.ts`, `supabaseSyncOrchestrator.ts`,
`userScopedLocalData.ts`, `indexedDBCore.ts`).

Every claim is tagged **VERIFIED** (I read the line) or **INFERRED** (I reasoned about it).

---

## Verdict

**All three files repeat the sessionDb shape.** 12 of 13 write functions place their offline-queue
enqueue inside an `if (user)` guard. One does not (`saveNutritionGoals`) and is the clean
counter-example. Nothing was indeterminate on the central question.

| File | Write fns | Repeat the shape | Clean |
|---|---|---|---|
| `nutritionService.ts` | 5 | 4 | 1 |
| `waterService.ts` | 2 | 1 | 1 (no cloud write at all — see W-2) |
| `bodyStatsService.ts` | 7 | 7 | 0 |

The loss consequence is **not identical** to sessions, and the difference matters for severity —
see [Why this is not a straight copy](#why-this-is-not-a-straight-copy-of-the-session-bug).

---

## The shape, stated mechanically

In this codebase the enqueue is **the 4th argument to `syncWithRetry`**, not a separate statement.
`syncEngine.ts:80-113` (VERIFIED): `syncWithRetry(syncFn, tag, maxRetries, queue?)` forwards
`queue` to `queueMutation` only on final failure — so if the `syncWithRetry` **call itself** never
runs, no enqueue exists at all.

The defective pattern is therefore:

```ts
await dbPut(STORE, record);            // local write succeeds
const user = await getCurrentUser();   // null during a 401 token refresh
if (user) {
  syncWithRetry(fn, tag, 3, { type, payload });   // ← the ONLY enqueue, inside the guard
}
```

`getCurrentUser()` returning `null` for someone who genuinely has an account is a real, modelled
state — `sessionDb.ts:33-40` documents it as a 401 during token refresh (VERIFIED, read in the
pre-fix version of that file).

Two secondary facts that make the guard load-bearing:

- `syncWithRetry` also returns early when `!isSupabaseConfigured()` (`syncEngine.ts:86-88`,
  VERIFIED). That early return is *correct* — no cloud configured means nothing at risk.
- `queueMutation` itself has **no** user guard and stamps `GUEST_OWNER` when auth is absent
  (`offlineQueue.ts:661-671`, VERIFIED). Replay then quarantines ownerless entries into the
  dead-letter store, which **preserves the payload** and surfaces a Hebrew toast plus a
  Settings recovery path (`offlineQueue.ts:absolute lines 800-830 region, notify + moveToDeadLetter`,
  VERIFIED). So enqueueing while `user == null` is strictly better than not enqueueing: the record
  becomes visible and recoverable instead of invisible.

---

## Findings

### nutritionService.ts

**N-1 — `addFoodFromPreset` repeats the shape, and is doubly detached.** HIGH.
`:106` fn start · `:144` `dbPut` · `:149` `if (user)` · `:169-174` `syncWithRetry` with the
`nutrition:update` descriptor **inside** the guard. VERIFIED.
Aggravating, unique to this one: the whole auth+sync block is wrapped in a fire-and-forget
`void (async () => { … })()` at `:146-179` with a bare `catch {}` at `:176-178` whose only content
is the comment *"Best-effort sync — failure is handled by the retry queue"* (VERIFIED). That
comment is false when `user` is null: there is no queue entry to handle it. The caller cannot await
or observe the outcome either.

**N-2 — `addMealEntry` repeats the shape.** HIGH.
`:184` fn · `:191` `dbPut` · `:193` `getCurrentUser` · `:194` `if (user)` · `:214` `syncWithRetry`
with `nutrition:update` inside the guard. VERIFIED.

**N-3 — `updateMealEntry` repeats the shape.** HIGH.
`:223` fn · `:224` `dbPut` · `:226` `getCurrentUser` · `:227` `if (user)` · `:247` `syncWithRetry`.
VERIFIED.

**N-4 — `deleteMealEntry` repeats the shape.** MEDIUM.
`:254` fn · `:255` `dbDelete` · `:257` `getCurrentUser` · `:258` `if (user)` · `:259`
`syncWithRetry` with `nutrition:delete`. VERIFIED.
Different failure mode, lower severity: a dropped delete does not destroy new data, it **resurrects
a deleted meal** on the next pull, because `mergeNutritionLogsFromCloud` re-inserts a cloud row
that has no local counterpart (INFERRED from the merge being called at
`supabaseSyncOrchestrator.ts:551` and the tombstone-aware merge semantics described there).

**N-5 — `saveNutritionGoals` does NOT repeat the shape. This is the clean pattern.** No bug.
`:41` fn · `:42` `writeJsonStorage` · `:51` `mirrorLocalKey(NUTRITION_GOALS_KEY)`. VERIFIED.
`mirrorLocalKey` (`localStateMirror.ts:84-107`) calls
`await queueMutation('setting:update', …)` at `:97-103` with **no `if (user)` anywhere in the
function** (VERIFIED). This is the line that proves the file is not uniformly broken, and it is the
shape the other 12 sites should converge on.

### waterService.ts

**W-1 — `addWaterEntry` is the most literal repeat of the sessionDb bug.** HIGH.
`:89` fn · `:96` `dbPut` · `:97` `broadcastWaterUpdated()` · `:99` `getCurrentUser` · `:100`
`if (user)` · `:103` `catch` · `:104` `await queueMutation('water:create', entry)`. VERIFIED.
This one does not go through `syncWithRetry` — it calls `queueMutation` directly, inside the guard,
which is character-for-character the construct that was commented out in `sessionDb.ts`. When
`user` is null the `try/catch/queueMutation` block is never entered, so the entry is local-only with
no queue row.

**W-2 — `saveWaterSettings` writes nothing to the cloud, and is missing from BOTH registries.** LOW,
and a different bug class — not data loss but cross-account leakage.
`:72` fn · `:77` `writeJsonStorage(WATER_SETTINGS_KEY, clamped)`, no mirror call (VERIFIED).
`WATER_SETTINGS_KEY = 'water_settings'` (`src/constants/nutrition.ts:66`, VERIFIED).
That string appears in **neither** `USER_SCOPED_STORAGE_REGISTRY.localStorageKeys`
(`userScopedLocalData.ts:20-46`) **nor** `MIRRORED_LOCAL_KEYS` (`localStateMirror.ts:59-69`) —
both lists read in full, VERIFIED. Consequence: the hydration goal and glass size are not wiped on
sign-out, so on a shared device account B inherits account A's water goal. Not lost; leaked.
Compare `nutrition_goals`, which is in both lists.

**W-3 — observation, not a bug.** `waterService.ts` has no local delete function. `deleteCloudWaterEntry`
(`:165`) is reached only by queue replay (`offlineQueue.ts:562-563`, VERIFIED). Removal in the UI is
implemented as a **negative** entry — `WaterTracker.tsx:204` calls `addWaterEntry(-glassMl)`
(VERIFIED) — so the `water:delete` mutation type has no local producer. Consistent, just worth
knowing before anyone "fixes" the missing delete.

### bodyStatsService.ts

All seven write functions repeat the shape. Same construct each time: `dbPut`/`dbDelete`, then
`const user = await getCurrentUser()`, then the queue-carrying `syncWithRetry` inside `if (user)`.
All VERIFIED.

| Fn | fn line | local write | `if (user)` | enqueue (inside guard) | descriptor |
|---|---|---|---|---|---|
| `addBodyWeight` | `:95` | `:110` | `:113` | `:114` | `bodyweight:create` |
| `updateBodyWeight` | `:136` | `:141` | `:144` | `:145` | `bodyweight:create` |
| `deleteBodyWeight` | `:152` | `:153` | `:156` | `:159` | `bodyweight:delete` |
| `addBodyMeasurement` | `:218` | `:229` | `:232` | `:252` | `measurement:create` |
| `addRecoveryLog` | `:281` | `:304` | `:310` | `:326` | `recovery:create` |
| `updateRecoveryLog` | `:345` | `:348` | `:351` | `:367` | `recovery:create` |
| `deleteRecoveryLog` | `:376` | `:377` | `:379` | `:381` | `recovery:delete` |

**B-1 — `addRecoveryLog` has a second, worse asymmetry.** HIGH.
Between `:304` and `:309` (VERIFIED content, exact numbers INFERRED within that range) it
unconditionally hard-deletes same-day duplicate logs locally:
`const duplicateLogs = existingForDate.slice(1); await Promise.all(duplicateLogs.map((log) => dbDelete(STORES.RECOVERY_LOGS, log.id)))`.
The matching cloud tombstones are issued at `:331-338`, **inside** `if (user)` (VERIFIED). So the
local delete always happens and the cloud delete sometimes does not: when `user` is null the
duplicate is destroyed locally while staying live in the cloud, and the next pull resurrects it.
That re-creates the very duplicate this de-duplication exists to remove. The local delete being
outside the guard while its cloud counterpart is inside is a strictly worse split than the plain
shape.

**B-2 — `addBodyWeight` is also reachable through a second entry point.** Informational.
`bodyWeightDb.ts:22` delegates to `addBodyWeight` (VERIFIED), so any fix at the service level
covers both callers. No separate defect.

---

## Q3 — what the user sees when the write fails

Two distinct failure modes, and the distinction is the whole point.

**Local `dbPut`/`dbDelete` failure** (quota, corruption) — the function rejects, and the UI mostly
handles it:

- Nutrition: error toasts throughout `useNutritionData.ts` — `:157-158` `'שמירת הארוחה נכשלה'`,
  `:171-173` `'מחיקת הארוחה נכשלה'`, `:190-192` `'שחזור הארוחה נכשל'`, `:216-218`
  `'רישום הארוחה נכשל'`, `:234-237` + `:240-242` `'הוספת הארוחה נכשלה'`. VERIFIED.
- Body weight: inline error inside the sheet, `AddWeightModal.tsx:46-51` →
  `'שמירת המשקל נכשלה. נסו שוב.'`, sheet stays open so the typed value is not lost. VERIFIED.
  (`Progress.tsx:159-167` `handleSaveWeight` has no `try/catch` of its own, but the modal catches,
  so there is no unhandled rejection. I checked this specifically because the sibling comment at
  `Progress.tsx:170-172` warns about exactly that failure mode for measurements.)
- Measurement / recovery: error toasts at `Progress.tsx:176-178` and `:187-189`. VERIFIED.
- **Water: silent.** `WaterTracker.tsx:194-198`, `:203-207`, `:215-220` each catch and only roll the
  optimistic counter back — no toast, no error state, no log. VERIFIED.

**Cloud orphaning while `user == null`** — the case this audit is about: **silent in every one of the
13 write paths.** The local write succeeded, so the UI runs its success branch: the meal toast says
`'הארוחה נשמרה'` (`useNutritionData.ts:154`), water animates and celebrates, the body-stats sheets
close with a success haptic. Nothing anywhere tells the user the record exists on one device only.
VERIFIED for the UI strings; INFERRED (from the absence of any enqueue, ledger write, or toast on
that branch) that no other signal exists.

---

## Q4 — can a record written by these paths be lost?

**Yes, for all three files.** The chain, each link verified:

1. No queue row exists, so `getQueueDepth()` (`offlineQueue.ts:939`) returns 0 for it, and
   `processQueue` cannot see it — replay iterates queue rows only.
2. No dead-letter row exists either, so `getDeadLetterCount()` (`offlineQueue.ts:1056`) is 0.
3. **The unsynced ledger does not cover these stores.** `getUnsyncedSessionIds`
   (`sessionDb.ts:106-124`) reads `pending_sync` markers prefixed `unsynced-session:` and
   reconciles them against `STORES.WORKOUT_SESSIONS` only (VERIFIED). Nutrition, water and
   body-stats orphans are counted by **nothing**.
4. The sign-out guard therefore under-reports to zero. `Settings.tsx:142-160` computes
   `depth + held + unsyncedSessions` and only warns when that sum is `> 0` (VERIFIED). For an
   orphaned meal, water entry, weight, measurement or recovery log all three terms are zero, so
   `handleSignOut` falls through to `performSignOut()` with no dialog.
5. The wipe then destroys the record. `clearUserScopedLocalData` iterates
   `USER_SCOPED_STORAGE_REGISTRY.indexedDbStores`, which is `Object.values(STORES)`
   (`userScopedLocalData.ts:16`, VERIFIED) — and `STORES` includes `body_weight`,
   `body_measurements`, `recovery_logs`, `nutrition_logs` and `water_logs`
   (`indexedDBCore.ts:14-23`, VERIFIED). `signOut` calls this via `transitionAuthSession(null, { forceCleanup: true })`
   at `supabaseAuth.ts:288` (VERIFIED).

Net: the same silent-destruction-with-reassurance outcome as the session bug, reached through a
warning that is structurally incapable of counting these records.

### Why this is not a straight copy of the session bug

One thing genuinely differs, and it lowers severity from blocker to high. **A full push does exist
and it reads local IndexedDB directly**, so an orphaned record is not permanently unreachable the
way the write-up's "never leaves the device" implies. `syncAllDataImpl`
(`supabaseSyncOrchestrator.ts:155-430`) bulk-upserts `nutrition_logs` (`:377`), `body_weight`
(`:349`), `body_measurements` (`:354`), `recovery_logs` (`:371`) and `water_logs` (`:404`) from
`dbGetAll` reads — no queue involvement (VERIFIED).

But it is **never triggered automatically.** Callers of `syncAllData` are exactly two (VERIFIED by
grep across `src/`):

- `pages/settings/hooks/useCloudSync.ts:68` and `:126` — the user manually pressing sync in Settings.
- `offlineQueue.ts:1041` inside `adoptGuestDataForUser` — guest → first sign-in only.

Sign-in itself pulls only: `AuthContext.tsx:128` calls `pullAllData()` (VERIFIED), matching the
"sign-in only pulls" premise. So the record is recoverable **only** if the user happens to press
"sync now" in Settings before signing out. That is a real mitigation, not a reliable one, and it does
not close the window the sign-out warning fails to report.

---

## What the fix would be — described, not applied

Do not implement this here. A sibling worker owns the canonical fix in `sessionDb.ts`, and a second
copy of one rule is this project's most-repeated defect.

The correct shape is already in this codebase twice: `mirrorLocalKey`
(`localStateMirror.ts:97-103`) enqueues unconditionally, and `flushUnsyncedSessions`
(`sessionDb.ts:169-177`) falls back to `queueMutation` when there is no user. Whatever the sibling
lands should be the single source, and these 12 sites should adopt it rather than re-derive it:

1. **Move the enqueue out of `if (user)`.** Keep `syncWithRetry` inside the guard (it needs
   `user.id`); add an `else { await queueMutation(type, payload) }` using the same descriptor the
   guarded branch already constructs. `queueMutation` resolves and stamps ownership itself
   (`offlineQueue.ts:661-671`), so the null-user case lands in the dead-letter store as *recoverable*
   rather than invisible. Keep the `isSupabaseConfigured()` early-out — no cloud means nothing at risk.
2. **Decide whether the ledger generalises.** The sign-out guard's blind spot is not fixed by
   enqueueing alone if the enqueue itself can fail. If the sibling's ledger is worth extending past
   sessions, that is one design decision for the lead — `getUnsyncedSessionCount` becomes an
   unsynced-*record* count and `Settings.tsx:158` reads that. If not, the enqueue fallback alone
   closes most of the window. **Do not fork this decision across four files.**
3. **`addRecoveryLog` needs its own thought (B-1):** the unconditional local duplicate-delete
   between `:304` and `:309` must not stay paired with a guarded cloud tombstone, independently of
   the enqueue change.
4. **`W-2` is separate and independent:** add `'water_settings'` to
   `USER_SCOPED_STORAGE_REGISTRY.localStorageKeys` and to `MIRRORED_LOCAL_KEYS`. That is a
   registry-membership bug, not the enqueue bug, and it should not ride along on the same change.

---

## Not determined

- **Runtime frequency.** I did not measure how often `getCurrentUser()` actually returns null for a
  signed-in user. The path is documented (`sessionDb.ts:33-40`) and modelled in `supabaseAuth.ts`,
  but no gate, test, or instrumentation was run — per the read-only constraint. Severity here rests
  on consequence, not on a measured rate.
- **Coach-side write paths.** `MetricsTab.tsx:229` passes an `onSaved` weight callback in the coach
  flow. I did not trace whether it reaches `addBodyWeight` or a separate coach API — out of the
  three-file scope.
- **`personalItemsDb` / `templateDb` / `exerciseDb` / `prService` / `programProgressService`.** Not
  in scope. From the import lists they use the same `syncWithRetry` idiom, so they are plausible
  further instances (INFERRED, unexamined). Worth a follow-up ticket; I did not look, so I am not
  claiming they are affected.
- **Exact line numbers for the `addRecoveryLog` duplicate-delete loop.** Content VERIFIED; the
  numbers fall between `:304` and `:309` (the two anchors I confirmed by grep).

---

## Note for the lead: `sessionDb.ts` changed while I audited

I read `sessionDb.ts` at the start of this task and it contained a live
`// TEMPORARY REVERT — MEASUREMENT ONLY` block with `// await queueMutation('session:update', payload);`
commented out in `saveWorkoutSession`'s `else` branch. A re-grep at the end of the audit found that
comment **gone** and `await queueMutation('session:update', payload);` live at `:224`, with a new
explanatory comment at `:218` (VERIFIED, both states observed).

So the sibling's fix appears to have landed mid-audit. The bug shape I compared against is the
pre-fix state described in the task, which is the right reference — but any line number I would have
quoted from that file is now stale, which is why this report cites `sessionDb.ts` only for the
ledger/comment facts I re-verified. I changed nothing in that file.

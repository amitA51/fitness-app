# T-125 — Silent-write final sweep (read-only)

Scope: every function in `src/services/**` (excluding `__tests__`) that writes local data —
IndexedDB via `indexedDBCore` helpers (`dbPut` / `dbDelete` / `dbClear`) or raw
`store.put/add/delete/clear` on an open transaction, plus `localStorage` / `sessionStorage`
writes of user data. Calls followed one hop into helpers (`pushExerciseMutation`,
`mirrorToCloud`, `mirrorLocalKey`, `markRecordUnsynced`, `queueMutation`, `syncWithRetry`).

Method: `read` / `grep` only. No shell, no gates, no browser, no git. Nothing outside this file
was written.

## 0. The mechanical key, confirmed first-hand

`src/services/syncEngine.ts:80-113`:

```
export const syncWithRetry = (
  syncFn: () => Promise<void>,
  tag: string,
  maxRetries = 3,
  queue?: { type: MutationType; payload: unknown }   // <- line 84: the enqueue IS the 4th argument
): Promise<boolean> => {
  if (!isSupabaseConfigured()) return Promise.resolve(false);
  ...
        if (queue) {                                  // <- line 100: only reachable INSIDE the call
          const { queueMutation } = await import('./offlineQueue');
          await queueMutation(queue.type, queue.payload);
```

There is no enqueue anywhere else on that path. So when the guarded call never runs — an early
`return` inside an auth guard, an `if (user)` with no `else`, or a throw before the call — there is
**no queue row at all**. `offlineQueue.processQueue`, the dead-letter store, the owner stamping and
the sign-out guard all read the queue, so none of them can see the write. That is the whole reason
this family is silent rather than merely delayed. Confirmed.

Second-order consequence, also confirmed: the ledger (`src/services/sessionDb.ts:160-193`, rows in
`STORES.PENDING_SYNC`) is the only other thing that can see such a write, and its two consumers are
`src/pages/Settings.tsx:169` (sign-out guard) and `src/components/ui/OfflineIndicator.tsx:42,105`.
A write with neither a queue row nor a marker is invisible to the entire app.

## 1. Enumeration

`enq?` = does a cloud enqueue exist on this path. `skip?` = can a guard skip it.

| function | file:line | writes | enqueue? | guard can skip? | verdict |
|---|---|---|---|---|---|
| `markRecordUnsynced` | `src/services/sessionDb.ts:173` | `dbPut` pending_sync | n/a (ledger) | no | EXCEPTION (plumbing) |
| `clearUnsyncedRecordMarker` | `src/services/sessionDb.ts:183` | `dbDelete` pending_sync | n/a | no | EXCEPTION |
| `flushUnsyncedSessions` | `src/services/sessionDb.ts:302` | — (push/queue only) | yes, unconditional | no | OK |
| `saveWorkoutSession` | `src/services/sessionDb.ts:314` | `dbPut` workout_sessions | yes (`:331` 4th arg, `:349` else) + marker `:326` | no | OK |
| `reAddWorkoutSession` | `src/services/sessionDb.ts:472` | `dbPut` workout_sessions | no | no | EXCEPTION (cloud→local) |
| `replaceWorkoutSessionsFromCloud` | `src/services/sessionDb.ts:484-486` | `clear` + `put` | no | no | EXCEPTION (cloud→local, clears markers `:496`) |
| `deleteWorkoutSession` | `src/services/sessionDb.ts:505` | `dbDelete` | yes (`:534` 4th arg, `:539` else) | no | OK |
| `mergeWorkoutSessionsFromCloud` | `src/services/sessionDb.ts:605-608` | `put` + `delete` | no | no | EXCEPTION (cloud→local, clears `:620`) |
| `saveWaterSettings` | `src/services/waterService.ts:75` | localStorage `water_settings` | no | no | DEFECT #6 (low) |
| `addWaterEntry` | `src/services/waterService.ts:97` | `dbPut` water_logs | yes (`:120` try/catch, `:134` else) + marker `:109` | no | OK |
| `mergeWaterLogsFromCloud` | `src/services/waterService.ts:~270` | `put` + `delete` | no | no | EXCEPTION (clears `:261`) |
| `saveNutritionGoals` | `src/services/nutritionService.ts:44` | localStorage `nutrition_goals` | yes (mirrored key, `localStateMirror`) | no | OK |
| `addFoodFromPreset` | `src/services/nutritionService.ts:147` | `dbPut` nutrition_logs | yes (`:191` 4th arg, `:196` else) + marker `:181` | no — **auth throw handled at `:185`** | OK (reference shape) |
| `addMealEntry` | `src/services/nutritionService.ts:210` | `dbPut` nutrition_logs | yes (`:249` else) + marker `:234` | auth throw at `:212` — see DEFECT #5 | OK / DEFECT #5 |
| `updateMealEntry` | `src/services/nutritionService.ts:257` | `dbPut` nutrition_logs | yes (`:293` else) + marker `:281` | auth throw at `:259` — DEFECT #5 | OK / DEFECT #5 |
| `deleteMealEntry` | `src/services/nutritionService.ts:299` | `dbDelete` nutrition_logs | yes (`:316` else) | auth throw at `:303` — DEFECT #5 | OK / DEFECT #5 |
| `addBodyWeight` | `src/services/bodyStatsService.ts:113` | `dbPut` body_weight | yes (`:126` 4th arg, `:134` else) + marker `:119` | auth throw at `:115` — DEFECT #5 | OK / DEFECT #5 |
| `updateBodyWeight` | `src/services/bodyStatsService.ts:159` | `dbPut` body_weight | yes (`:175` else) + marker `:163` | auth throw at `:161` — DEFECT #5 | OK / DEFECT #5 |
| `deleteBodyWeight` | `src/services/bodyStatsService.ts:181` | `dbDelete` body_weight | yes (`:198` else) | auth throw at `:185` — DEFECT #5 | OK / DEFECT #5 |
| `addBodyMeasurement` | `src/services/bodyStatsService.ts:266` | `dbPut` body_measurements | yes (`:302` else) + marker `:290` | auth throw at `:268` — DEFECT #5 | OK / DEFECT #5 |
| `addRecoveryLog` (new row) | `src/services/bodyStatsService.ts:350` | `dbPut` recovery_logs | yes (`:399` else) + marker `:377` | auth throw at `:359` — DEFECT #5 | OK / DEFECT #5 |
| `addRecoveryLog` (same-day dupes) | `src/services/bodyStatsService.ts:~354` | `dbDelete` recovery_logs | yes (`:407` else) | auth throw at `:359` — DEFECT #5 | OK / DEFECT #5 |
| `updateRecoveryLog` | `src/services/bodyStatsService.ts:418` | `dbPut` recovery_logs | yes (`:~450` else) + marker `:438` | auth throw at `:420` — DEFECT #5 | OK / DEFECT #5 |
| `deleteRecoveryLog` | `src/services/bodyStatsService.ts:~453` | `dbDelete` recovery_logs | yes (`:~470` else) | auth throw at `:459` — DEFECT #5 | OK / DEFECT #5 |
| `createWorkoutTemplate` | `src/services/templateDb.ts:101` | `dbPut` workout_templates | yes (`:118` 4th arg, `:~142` else) + marker `:112` | auth throw at `:103` — DEFECT #5 | OK / DEFECT #5 |
| `updateWorkoutTemplate` | `src/services/templateDb.ts:163` | `dbPut` workout_templates | yes (`:~186` else) + marker `:168` | auth throw at `:165` — DEFECT #5 | OK / DEFECT #5 |
| `deleteWorkoutTemplate` | `src/services/templateDb.ts:197` | `dbDelete` workout_templates | yes (`:~222` else) | auth throw at `:201` — DEFECT #5 | OK / DEFECT #5 |
| `reAddWorkoutTemplate` | `src/services/templateDb.ts:273` | `dbPut` | no | no | EXCEPTION (cloud→local) |
| `replaceWorkoutTemplatesFromCloud` | `src/services/templateDb.ts:~285` | `clear` + `put` | no | no | EXCEPTION (clears `:297`) |
| `mergeWorkoutTemplatesFromCloud` | `src/services/templateDb.ts:~370` | `put` + `delete` | no | no | EXCEPTION (clears `:387`) |
| `loadAndSeedBuiltIns` | `src/services/exerciseDb.ts:52` | `dbPut` personal_exercises | no | no | EXCEPTION (re-seeds itself) |
| `healDuplicateBuiltIns` | `src/services/exerciseDb.ts:88` | `dbDelete` personal_exercises | no | no | EXCEPTION (adjudicated, by design) |
| `pushExerciseMutation` | `src/services/exerciseDb.ts:169-186` | — (push/queue only) | yes, `else` at `:182` | no — **auth throw caught at `:175-177`** | OK (reference shape) |
| `createPersonalExercise` | `src/services/exerciseDb.ts:~205` (`store.add`) | personal_exercises | yes, awaited via helper | no | OK |
| `updatePersonalExercise` | `src/services/exerciseDb.ts:~240` (`store.put`) | personal_exercises | yes, via helper | no | OK |
| `deletePersonalExercise` | `src/services/exerciseDb.ts:280` | `dbDelete` personal_exercises | yes, via helper | no | OK |
| `savePR` | `src/services/prService.ts:116` | `dbPut` personal_records | yes (`:139` 4th arg, `:157` else) | auth throw at `:129` — DEFECT #5 | OK / DEFECT #5 (no marker = adjudicated EXCEPTION) |
| `deletePR` | `src/services/prService.ts:185` | `dbDelete` personal_records | yes (`:~207` 4th arg, `:223` else) | auth throw at `:187` — DEFECT #5 | OK / DEFECT #5 |
| `addPersonalItem` | `src/services/personalItemsDb.ts:35` | `dbPut` personal_items | no | no | EXCEPTION (documented: in-progress scratch) |
| `updatePersonalItem` | `src/services/personalItemsDb.ts:58` | `dbPut` personal_items | no | no | EXCEPTION (same) |
| `removePersonalItem` | `src/services/personalItemsDb.ts:62` | `dbDelete` personal_items | no | no | EXCEPTION (same) |
| `saveBodyWeight` | `src/services/bodyWeightDb.ts:21` | delegates to `addBodyWeight` | inherited | inherited | OK |
| `reAddBodyWeight` | `src/services/bodyWeightDb.ts:53` | `dbPut` body_weight | no | no | EXCEPTION (cloud→local) |
| `replaceBodyWeightFromCloud` | `src/services/bodyWeightDb.ts:~60` | `clear` + `put` | no | no | EXCEPTION (cloud→local) |
| `syncConversation` | `src/services/ai/chat.ts:51-52` | — (push only) | **no `else`, bare `return`** | **yes** | **DEFECT #1** |
| `createConversation` | `src/services/ai/chat.ts:90-91` | `dbPut` ai_conversations + localStorage | no | no | EXCEPTION (empty shell; content arrives via `sendMessage`) |
| `sendMessage` | `src/services/ai/chat.ts:146` | `dbPut` ai_conversations | only via `syncConversation` | **yes** | **DEFECT #1** |
| `clearConversation` | `src/services/ai/chat.ts:156` | `dbDelete` ai_conversations | `if (user)` at `:159`, **no else** | **yes** | **DEFECT #2** |
| `deleteConversation` | `src/services/ai/chat.ts:178` | `dbDelete` ai_conversations | `if (user)` at `:187`, **no else** | **yes** | **DEFECT #2** |
| `mirrorLocalKey` | `src/services/localStateMirror.ts:91` | `dbPut` user_settings | yes, unconditional `:97` | no | OK (reference shape) |
| `restoreMirroredLocalKeys` | `src/services/localStateMirror.ts:157` | localStorage (from cloud) | no | no | EXCEPTION (cloud→local) |
| `mirrorToCloud` | `src/services/programProgressService.ts:84` | `dbPut` user_settings | yes, unconditional `:86` | no | OK |
| `saveProgress` | `src/services/programProgressService.ts:96` | localStorage `bbt_program_progress_v1` | yes, via `mirrorToCloud` | no | OK |
| `resetProgram` | `src/services/programProgressService.ts:158-159` | localStorage removeItem ×2 | yes, tombstone mirrors | no | OK |
| `saveSwaps` | `src/services/programProgressService.ts:224` | localStorage `bbt_program_swaps_v1` | yes, `:227` mirror | no | OK |
| `restoreProgramProgressFromCloud` | `src/services/programProgressService.ts:127` | localStorage (from cloud) | no | no | EXCEPTION (cloud→local) |
| `startProgramDay` | `src/services/programCatalogService.ts:218` | `dbPut` workout_templates | no | no | EXCEPTION (scratch, `isProgramHidden`, filtered out of the bulk push, regenerated on demand) |
| `importFullBackup` (rows) | `src/services/settingsService.ts:275` | `dbPut` ×N across 10 stores | **no** | n/a — never scheduled | **DEFECT #4** |
| `importFullBackup` (settings) | `src/services/settingsService.ts:298` | localStorage ×N | **no** | n/a | **DEFECT #4** |
| `rewriteStoreIds` | `src/services/idNormalization.ts:74-75` | `dbPut` + `dbDelete` (5 stores) | no — but runs inside `syncAllData`/`pullAllData`, push follows | no | EXCEPTION |
| `rewriteRecoveryLogs` | `src/services/idNormalization.ts:100-101` | `dbPut` + `dbDelete` | same | no | EXCEPTION |
| `remapCurrentConversationPointer` | `src/services/idNormalization.ts:112` | localStorage pointer | no | no | EXCEPTION (derived pointer) |
| `safeSetFlag` | `src/services/idNormalization.ts:58` | localStorage flag | no | no | EXCEPTION (migration flag) |
| `clearUserScopedLocalData` | `src/services/userScopedLocalData.ts:113` | `dbClear` ×13 + localStorage/sessionStorage | n/a | no | EXCEPTION (the deliberate wipe) |
| `queueMutation` | `src/services/offlineQueue.ts:~635` (`store.put`) | queue DB | n/a | no — **auth throw caught at `:627-631` → `UNKNOWN_OWNER`** | OK (reference shape) |
| `updateConfig` | `src/services/notificationService.ts:40` | localStorage `notification_settings` | no | no | DEFECT #6 (low) |
| `setConsent` | `src/services/tracking/trackingConsent.ts:84` | localStorage consent | no | no | EXCEPTION (device-scoped consent) |
| `markGuidanceSeen` / reset | `src/services/guidanceService.ts:37,46` | localStorage flags | no | no | EXCEPTION (recomputable) |
| `track` | `src/services/eventTracker.ts:27` | localStorage ring buffer | no | no | EXCEPTION (analytics) |
| `markReminderFired` | `src/services/coach/reminderService.ts:190` | localStorage `coach_reminders_fired` | no | no | EXCEPTION (transient dedupe) |
| `rememberInviteContinuation` / clear | `src/services/authContinuation.ts:26,27,93,94` | localStorage transient | no | no | EXCEPTION (auth round-trip) |
| `transitionAuthSession` (owner marker) | `src/services/authSessionTransition.ts:41-42` | localStorage `sparkos_last_user_id` | no | no | EXCEPTION (identity marker) |

### Guest → account migration (asked for explicitly)

**Checked and it holds.** `adoptGuestDataForUser` (`src/services/offlineQueue.ts:1013-1045`) does two
things on a first sign-in: it re-stamps every `GUEST_OWNER` queue and dead-letter row to the real
account id, then calls `syncAllData()` (`:1040-1041`). `syncAllDataImpl`
(`src/services/supabaseSyncOrchestrator.ts:155-230`) reads **all eleven** local stores —
templates, sessions, personal_exercises, body_weight, body_measurements, personal_records,
recovery_logs, nutrition_logs, user_settings, **ai_conversations**, water_logs — and pushes them.

So a guest write with no per-write enqueue is **not** lost when that guest signs in: the bulk
adoption push carries it. This is what makes DEFECT #1 an expired-token defect rather than a guest
defect — the adoption path does not run for a user who already has an account.

One caveat worth recording: `syncAllData` has only two production callers —
`src/pages/settings/hooks/useCloudSync.ts:68,126` (the manual Settings buttons) and the adoption
path above. There is **no** automatic periodic bulk push. Anything that misses its per-write
enqueue and is not a first-time guest reaches the cloud only if the user presses a button in
Settings.

## 2. Defects

### DEFECT #1 — a chat message written while auth cannot answer is never enqueued (HIGH)

**Severity: high.** Same mechanism, same store class and same blast radius as the seven already-fixed
services: the local write lands, no queue row exists, no ledger marker exists, and
`clearUserScopedLocalData` wipes `ai_conversations` (it is in `STORES`, so it is in
`USER_SCOPED_STORAGE_REGISTRY.indexedDbStores`). The sign-out dialog counts queue depth + dead
letters + ledger markers, all three zero, tells the user there is nothing to lose, and the wipe
destroys the conversation. `ai:create` / `ai:update` are already valid `MutationType`s
(`src/services/offlineQueue.ts:546-548`) — the machinery exists and is simply not called.

**The exact losing line — `src/services/ai/chat.ts:52`:**

```
const syncConversation = async (conversation: Conversation): Promise<void> => {
  const user = await getCurrentUser();          // :51
  if (!user) return;                            // :52  <- THE LOSING LINE
```

**Repro**
1. Sign in with a real account, open the AI coach, send a message. Confirm the conversation exists.
2. Force the token-refresh failure `src/services/supabaseAuth.ts:129-133` models: invalidate the
   refresh token server-side, or stub `supabase.auth.getSession()` to return
   `{ data: { session: null }, error: { status: 401 } }` and `getUser()` to return `{ user: null }`.
   `getCurrentUser()` now returns `null` for a user who genuinely has an account.
3. Send another chat message.
4. Inspect the queue DB — no row. Inspect `pending_sync` — no marker.
5. Open Settings → sign out. The guard reports nothing unsynced.
6. Sign back in as the same user and open the AI coach.

**Expected** — step 3 enqueues `ai:create`; the message survives step 6 (or at minimum the step-5
dialog warns).
**Actual** — step 3 writes IndexedDB only; step 6 shows the conversation at its pre-step-3 state,
and the messages from step 3 are gone with no warning anywhere.

**Evidence** — `src/services/ai/chat.ts:51-52` (early return, no `else`, no `queueMutation`);
`src/services/ai/chat.ts:146-148` (`dbPut` then `void syncConversation(...)` — the local write is
unconditional, the cloud leg is not); `grep -c queueMutation src/services/ai/chat.ts` → 0;
`grep -c markRecordUnsynced src/services/ai/chat.ts` → 0. Contrast
`src/services/exerciseDb.ts:169-186` and `src/services/nutritionService.ts:185`, which handle the
identical situation correctly.

**Suspected location** — `src/services/ai/chat.ts:52` (guard), reached from
`src/services/ai/chat.ts:148`.

**Proposed fix (not implemented).** Give `syncConversation` the same two-branch shape every other
write path now has: keep `const user = await getCurrentUser()` but wrap it so a rejection is treated
as `null` (as `pushExerciseMutation` does at `exerciseDb.ts:175-177`), gate the whole body on
`isSupabaseConfigured()` first so an unconfigured install still queues nothing, and replace the bare
`if (!user) return;` with `if (user) { syncWithRetry(..., { type: 'ai:create', payload }) } else {
await queueMutation('ai:create', payload) }` using the payload that is already built at
`chat.ts:53-73`. Then make `sendMessage` `await` it instead of `void`-ing it at `:148`, so the queue
row is durable before the caller (and the tab) moves on — the same correction
`createPersonalExercise` received. Whether to also add a `markRecordUnsynced(STORES.AI_CONVERSATIONS, id)`
marker is a separate call: `mergeAIConversationsFromCloud` (`cloudMerge.ts:~255`) does not clear
markers, so adding one today would reproduce DEFECT #3 in a fourth place — add the clear-on-pull
first or leave chats marker-less like PRs.

### DEFECT #2 — deleting a conversation under null auth resurrects it on the next pull (HIGH)

**Severity: high.** Identical shape to the `deleteWorkoutSession` / `deletePR` /
`deleteWorkoutTemplate` holes closed in T-119, and the resurrection path is live:
`mergeAIConversationsFromCloud` re-adds any non-tombstoned cloud row that is missing locally
(`src/services/cloudMerge.ts:~272`, `if (!local) { writes.push(cloud); added++; }`). The local
delete is unconditional; the cloud tombstone sits behind `if (user)` with no `else`.

**The exact losing lines:**

```
// src/services/ai/chat.ts — clearConversation
await dbDelete(STORES.AI_CONVERSATIONS, conversation.id);   // :156 unconditional
const user = await getCurrentUser();                        // :159
if (user) { syncWithRetry(... 'ai:delete' ...) }             // :160  <- no else

// src/services/ai/chat.ts — deleteConversation
await dbDelete(STORES.AI_CONVERSATIONS, id);                 // :178 unconditional
const user = await getCurrentUser();                         // :187
if (user) { syncWithRetry(... 'ai:delete' ...) }              // :188  <- no else
```

**Repro**
1. Signed in, with at least one conversation already synced to the cloud (press "upload to cloud" in
   Settings to guarantee it).
2. Induce the null-auth state from DEFECT #1 step 2.
3. Delete that conversation from the chat list.
4. Restore auth (sign in again as the same user) and let the pull run.

**Expected** — the deletion is queued as `ai:delete` and propagates; the conversation stays deleted.
**Actual** — the conversation reappears. The user's delete existed on no device and in no queue.

**Evidence** — `src/services/ai/chat.ts:156,159-160` and `:178,187-188` (no `else` on either
guard); `src/services/cloudMerge.ts:~272` (the re-add); `ai:delete` is a valid `MutationType` at
`src/services/offlineQueue.ts:549`, so nothing is missing but the call. The comment at
`chat.ts:157-158` already states this exact failure as the reason the tombstone was added — it was
added only for the authenticated half.

**Suspected location** — `src/services/ai/chat.ts:160` and `src/services/ai/chat.ts:188`.

**Proposed fix (not implemented).** Add the `else { await queueMutation('ai:delete', id); }` branch to
both functions, exactly as `deleteWorkoutSession` (`sessionDb.ts:539`) and `deletePR`
(`prService.ts:223`) do. `ai:delete` already replays through `softDeleteCloudAIConversation`, so the
queued form is a soft delete and converges the same way as the direct call — no new mutation type and
no mapper change. Also treat a rejected `getCurrentUser()` as `null` here (same as #5) so an auth
failure does not skip the queue and does not surface as an unhandled rejection from a floating
promise.

### DEFECT #3 — the unsynced marker is never cleared for four of the seven ledgered stores (MEDIUM)

**Severity: medium.** No data loss, but it permanently breaks the warning that exists to prevent data
loss. Markers are written for seven stores. A marker is cleared on (a) same-call sync success,
(b) a local delete, or (c) a cloud pull — and (c) exists for only three stores. There is **no**
marker clearing in `offlineQueue.ts` at all, so a successful queued replay never clears one either.

Consequence: log a meal offline → marker written → `queueMutation` → back online → the queue
replays successfully → the marker survives. `getUnsyncedRecords` reconciles against live ids
(`sessionDb.ts:216-219`) and the row *is* live, so it keeps being counted forever. The sign-out
dialog (`src/pages/Settings.tsx:169`) and the offline indicator
(`src/components/ui/OfflineIndicator.tsx:42,105`) then warn about data that is safely in the cloud,
with no user action that can clear it. This is exactly the "a marker would stick forever" reasoning
that (correctly) kept markers off PRs and exercises — but it applies here, where the markers were
added anyway.

| store | marker written | cleared on pull? |
|---|---|---|
| `workout_sessions` | `sessionDb.ts:326` | yes — `sessionDb.ts:496`, `:620` |
| `water_logs` | `waterService.ts:109` | yes — `waterService.ts:261` |
| `workout_templates` | `templateDb.ts:112,168` | yes — `templateDb.ts:297`, `:387` |
| `nutrition_logs` | `nutritionService.ts:181,234,281` | **no** |
| `body_weight` | `bodyStatsService.ts:119,163` | **no** |
| `body_measurements` | `bodyStatsService.ts:290` | **no** |
| `recovery_logs` | `bodyStatsService.ts:377,438` | **no** |

**The exact losing line — `src/services/cloudMerge.ts:206-221`,** the shared merge those four stores
pull through (`mergeNutritionLogsFromCloud`, `mergeBodyMeasurementsFromCloud`,
`mergeRecoveryLogsFromCloud`, and `mergeGenericRecords(STORES.BODY_WEIGHT, …)` via
`bodyWeightDb.ts:~80`):

```
  if (writes.length > 0 || deletes.length > 0) {
    ...
      tx.oncomplete = () => resolve();
    });
  }
  return { added, updated, kept, deleted, conflictedDeletes: conflictedDeletes.length };
  //  <- returns with no clearUnsyncedRecordMarker call for any written/confirmed id
```

**Repro**
1. Signed in and online, go offline (DevTools → Offline).
2. Log a meal, a body weight and a recovery log.
3. Go back online and let the queue drain — confirm the three rows are in Supabase.
4. Open Settings and start sign-out.

**Expected** — the guard reports 0 unsynced records.
**Actual** — it reports 3, and will keep reporting 3 on every future sign-out, offline-indicator
poll, and app start, for rows that are safely stored.

**Evidence** — `grep -n "clearUnsynced" src/services/offlineQueue.ts` → no matches;
`grep -n "clearUnsynced" src/services/cloudMerge.ts` → no matches;
`grep -n "clearUnsynced" src/services/supabaseSyncOrchestrator.ts` → no matches. The complete
clear-site list is the six files in the table above and nothing else.

**Suspected location** — `src/services/cloudMerge.ts:221` (the missing clear) and
`src/services/offlineQueue.ts` (`processQueue` success path, no clear on a drained mutation).

**Proposed fix (not implemented).** Prefer the single point of leverage: clear the marker where a
mutation is *confirmed*, not in each merge. After a queued mutation succeeds in `processQueue`, derive
`(store, recordId)` from the mutation type and record id — `getRecordId` already exists in
`offlineQueue.ts` for dedup — and call `clearUnsyncedRecordMarker`. That fixes all seven stores with
one call site and covers the replay path the merges cannot see. Then, for symmetry with the three
stores that already do it, have `mergeGenericRecords` return the list of confirmed keys and let the
four body-stat/nutrition callers clear them, following the revision rule `mergeWorkoutTemplatesFromCloud`
already documents (`templateDb.ts:~350`): clear when the cloud copy is at or ahead of the local
revision, keep the marker when it is older, since these rows are mutable.

### DEFECT #4 — a restored backup is invisible to every sync defence (MEDIUM)

**Severity: medium.** A restore is the one moment a user has explicitly told the app "this data
matters". `importFullBackup` writes up to 50,000 rows per store across ten stores plus the
localStorage settings, and schedules **nothing**: no `queueMutation`, no `markRecordUnsynced`, no
push. The restored rows are local-only and uncounted, so the next sign-out wipe destroys the restore
while the guard reports nothing unsynced. The caller confirms there is no compensating push — it
toasts and reloads.

**The exact losing lines — `src/services/settingsService.ts:275` and `:298`:**

```
          await dbPut(store, row as object);      // :275  local write, nothing scheduled
          records++;
...
        localStorage.setItem(lsKey, value);       // :298  same
        settings++;
...
  return { records, settings };                   // :~305  no enqueue, no marker, no push
```

and the caller, `src/pages/settings/sections/BackupSection.tsx:49-52`:

```
      const result = await importFullBackup(text);
      showToast(`השחזור הושלם · ${result.records} רשומות`);
      setTimeout(() => window.location.reload(), 1200);   // reload, no push
```

**Repro**
1. Sign in, export a full backup from Settings, then sign out and sign in on a clean profile.
2. Restore that backup file.
3. Without pressing "upload to cloud", inspect the queue DB and `pending_sync` — both empty.
4. Sign out. The guard reports nothing unsynced; the wipe removes every restored row.

**Expected** — restored rows are either pushed or queued, and at minimum counted by the sign-out
guard.
**Actual** — they are local-only and silently destroyed by the next wipe.

**Evidence** — `grep -n "queueMutation\|markRecordUnsynced" src/services/settingsService.ts` → no
matches; `src/pages/settings/sections/BackupSection.tsx:49-52` (no push after restore);
`src/services/supabaseSyncOrchestrator.ts:130-133` (`syncAllData` has only the two manual callers
plus guest adoption, so nothing else picks these rows up).

**Suspected location** — `src/services/settingsService.ts:275` / `:298`, with the missing trigger at
`src/pages/settings/sections/BackupSection.tsx:50`.

**Proposed fix (not implemented).** Do not enqueue 50,000 individual mutations — that is what the
bulk path is for. Have `importFullBackup` return the set of `(store, id)` pairs it wrote and, after
the loop, call `markRecordUnsynced` for each so the restore is immediately visible to the sign-out
guard and the offline indicator; then have `BackupSection.handleConfirmRestore` await one
`syncAllData()` before the reload (it already runs inside an authenticated Settings screen, and
`syncAllData` self-guards on `getUserId()` and the cross-tab lock), reporting failure in the toast
instead of claiming success. That reuses the existing bulk push rather than adding a path, and the
markers make the failure case honest instead of silent.

### DEFECT #5 — 13 write paths still let a rejected `getCurrentUser()` skip the enqueue (MEDIUM)

**Severity: medium — structurally certain, trigger not empirically proven.** Every fixed path
resolves auth with a bare `const user = await getCurrentUser();` placed **after** the local write and
**before** both `markRecordUnsynced` and `queueMutation`. If that call rejects rather than resolving
`null`, the local write has already happened and neither the marker nor the enqueue is reached — the
function rejects with the row sitting in IndexedDB, in no queue and in no ledger. That is the same
end state as the null-user bug, reached through the other door named in the mechanical key ("a caught
throw before the call").

This project has adjudicated three separate times that `getCurrentUser()` can reject and that a
rejection must take the null path:

- `src/services/nutritionService.ts:182-185` — *"A THROW here is the same situation as a null user —
  auth cannot answer — so it must take the same path, not skip the queue."* → `getCurrentUser().catch(() => null)`
- `src/services/exerciseDb.ts:156-158` — *"A REJECTED `getCurrentUser()` takes the same road as null
  instead of becoming an unhandled rejection"* → `try/catch` at `:174-177`
- `src/services/offlineQueue.ts:626-631` — *"Auth genuinely unavailable (not 'signed out')"* →
  `catch { userId = UNKNOWN_OWNER; }`

Only those three sites are defended. The other 13 are not:

`nutritionService.ts:212, 259, 303` · `bodyStatsService.ts:115, 161, 185, 268, 359, 420, 459` ·
`templateDb.ts:103, 165, 201` · `prService.ts:129, 187` · `sessionDb.ts:317, 509` ·
`waterService.ts:99` · `ai/chat.ts:51, 159, 187` (the last three are DEFECT #1/#2 regardless).

What I verified: the call sites, their ordering relative to the local write, and that a rejection
propagates out of every one of them un-caught. What I did **not** verify: that `getCurrentUser()
` actually rejects in this app's `@supabase/supabase-js` version. Reading
`src/services/supabaseAuth.ts:118-146`, both `getSession()` and `getUser()` return `{ data, error }`
rather than throwing for the ordinary failures, so the plausible rejection sources are the lock and
storage layers underneath them (`NavigatorLockAcquireTimeoutError` in a multi-tab race, or a storage
adapter that throws in a partitioned/private context) — not something I can prove by reading. I am
filing it because the codebase itself concluded three times that it happens, and because the fix is
the same two lines in each place.

**Repro (deterministic, in a test rather than the browser)** — stub `getCurrentUser` to reject:
1. `vi.mock('../supabaseAuth', () => ({ getCurrentUser: vi.fn().mockRejectedValue(new Error('lock timeout')) }))`.
2. `await expect(addBodyWeight({ date, weight: 80 })).rejects.toThrow()`.
3. Assert the row **is** in `body_weight` (`dbGetAll`), and that the queue DB and `pending_sync` are
   both empty.

**Expected** — the write is enqueued and marked, exactly as when `getCurrentUser()` resolves `null`.
**Actual** — local row present, queue empty, ledger empty, caller sees a rejection.

**Evidence** — the 13 call sites above; the three defended sites quoted verbatim; ordering, e.g.
`bodyStatsService.ts:113` (`dbPut`) → `:115` (bare `await getCurrentUser()`) → `:119`
(`markRecordUnsynced`) → `:134` (`queueMutation`).

**Suspected location** — the 13 lines listed above.

**Proposed fix (not implemented).** Stop repeating the decision at each call site. Add one helper —
`resolveCurrentUserOrNull()` in `supabaseAuth.ts`, returning `getCurrentUser().catch(err => { logger.auth.warn(...); return null; })`
— and use it in every write path, so a rejection lands in the existing `else` branch that already
queues correctly. Sixteen sites then share one rule instead of three of them being individually
right; divergent copies of one rule are the defect this whole family keeps reproducing. Worth pairing
with a single parameterised test that asserts, for each write function, that a rejecting
`getCurrentUser` produces exactly the same queue row as a `null`-resolving one.

### DEFECT #6 — user-set preferences are wiped with no cloud copy (LOW)

**Severity: low** — the only low-severity item here, and filed as one entry rather than five because
it is one class with one fix. `localStateMirror.ts:56-58` instructs: *"Add a key here whenever new
user-meaningful state lands in localStorage, and it will survive an account switch instead of being
silently destroyed."* These keys are in `USER_SCOPED_STORAGE_REGISTRY.localStorageKeys` (so
`clearUserScopedLocalData` deletes them) but absent from `MIRRORED_LOCAL_KEYS`:

| key | written at | content |
|---|---|---|
| `water_settings` | `src/services/waterService.ts:75` | daily hydration goal + glass size |
| `notification_settings` | `src/services/notificationService.ts:40` | reminder configuration |
| `coach:quick-replies` | outside `src/services/**` | coach-authored reply snippets |
| `date_prefs`, `app_locale` | outside `src/services/**` | date format, locale |

**Repro** — set a custom water goal and glass size → sign out → sign in → the goal is back to
`DEFAULT_WATER_GOAL_ML`.
**Expected** — mirrored and restored like `nutrition_goals` and `workout_prefs`.
**Actual** — silently reset.
**Evidence** — `src/services/userScopedLocalData.ts:31-52` (registry, includes `WATER_SETTINGS_KEY`)
vs `src/services/localStateMirror.ts:61-68` (`MIRRORED_LOCAL_KEYS`, does not).
**Suspected location** — `src/services/localStateMirror.ts:61-68`.

**Proposed fix (not implemented).** Add `water_settings` and `notification_settings` to
`MIRRORED_LOCAL_KEYS` and call `mirrorLocalKey(...)` from `saveWaterSettings`
(`waterService.ts:75`) and the notification config write (`notificationService.ts:40`), matching what
`saveNutritionGoals` already does. `coach:quick-replies` is coach-authored content and deserves the
same treatment but is written outside `src/services/**`, so it is out of this sweep's scope — flagging
it, not filing it. `date_prefs` / `app_locale` are arguably device-scoped; a deliberate "NOT mirrored,
on purpose" line in the `localStateMirror` header would close them either way.

## 3. Per-scenario outcome for the defective paths

| path | (a) guest | (b) signed in, offline | (c) signed in, expired token |
|---|---|---|---|
| `sendMessage` → `syncConversation` | no queue row, **but** adopted by `syncAllData` on first sign-in → not lost | cached session present → `user` non-null → `syncWithRetry` retries, then queues via 4th arg → safe | **`getCurrentUser()` → null → `return` at `:52` → nothing anywhere → destroyed by the sign-out wipe** |
| `clearConversation` / `deleteConversation` | no cloud row to tombstone → nothing lost | `user` non-null → tombstone queued → safe | **local delete only → resurrected by the next pull** |
| body-stat / nutrition markers (#3) | marker only written when Supabase is configured; no cloud, no stale marker | marker written, queue replays, **marker never cleared → permanent false warning** | same as (b) |
| `importFullBackup` (#4) | local-only; adopted on first sign-in → survives | local-only, uncounted; survives until a wipe | local-only, uncounted; **destroyed by the sign-out wipe, guard says nothing to lose** |
| bare `getCurrentUser()` (#5) | resolves `null` cleanly → `else` branch queues → safe | resolves → safe | **if it rejects: local row, no queue, no marker, caller sees a rejection** |

## 4. Not covered

- **No runtime verification.** Brief was read-only with no gates, no browser and no dev server, so
  every finding is a code-path claim. #1, #2, #4 and #6 are deterministic from the source. #3 is
  deterministic given that no `clearUnsynced*` call exists outside the six files listed. #5 depends
  on `getCurrentUser()` actually rejecting, which I could not prove by reading — see its own caveat.
- **`src/services/coach/**`, `community/**`, `billing/**`, `admin/**`, `consent/**`,
  `profile/**`** were checked for local writes only. They are cloud-first (direct Supabase calls,
  no IndexedDB mirror), so they cannot exhibit this family — except `coach/reminderService.ts:190`,
  which is transient dedupe state and is in the table. Their own null-auth behaviour (what a coach
  action does when `getCurrentUser()` is null) is a different question and was not swept.
- **Writers outside `src/services/**`** — hooks and components that call `dbPut` directly, if any,
  were out of scope. `coach:quick-replies`, `date_prefs` and `app_locale` (DEFECT #6) are written
  outside this tree and were not traced to their write sites.
- **`active_workout_v3_state`** — deliberately unmirrored per `localStateMirror.ts:33-36`; I did not
  re-litigate it. A mid-workout reload is a live-state question, not a silent-write one.
- **Whether `supabase.auth.getSession()` can reject** in the pinned `@supabase/supabase-js` version —
  needs either a node_modules read or an instrumented run, neither of which this brief allowed.

---

VERDICT: NOT EMPTY (6 defects)

Proving line — `src/services/ai/chat.ts:52`: `if (!user) return;` — an early return inside an auth
guard, in a function whose only caller has already written to IndexedDB
(`src/services/ai/chat.ts:146`), where the enqueue is `syncWithRetry`'s 4th argument
(`src/services/syncEngine.ts:84`) and is therefore never reached: no queue row, no ledger marker,
and `ai_conversations` is wiped by `clearUserScopedLocalData`.

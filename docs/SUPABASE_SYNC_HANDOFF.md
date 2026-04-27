# Supabase Sync — Handoff Notes

> Written 2026-04-22 for the next agent/developer who picks up persistence work on this app.
> The goal of this document is to capture **what was fixed, what is left, and how to verify it** without requiring them to re-discover the problems.

---

## 0. TL;DR

The app has a hybrid persistence model: **IndexedDB** (local, offline-first) + **Supabase Postgres** (cloud, per-user).
Until 2026-04-22 the cloud half was broken in multiple places — writes silently failed because `user_id` was missing, entire categories of data (recovery / nutrition / PRs / measurements) were never synced, and several type mismatches would have caused Postgres to reject the rows.

Those are fixed now. What remains is:

1. **Run the schema migration** on the live Supabase project.
2. **Decide whether Settings should sync** across devices (currently localStorage-only).
3. **Close the type drift** between `supabaseSync.ts` local interfaces and the canonical `src/types/index.ts`.
4. **Commit the 3 uncommitted files** once reviewed (`bodyStatsService.ts`, `nutritionService.ts`, `recoveryService.ts`).
5. (Optional) Decide if `personal_items` should become a real cloud table.

---

## 1. Architecture recap

```
User action
    │
    ▼
React component
    │
    ▼
Service (workoutDb.ts, recoveryService.ts, etc.)
    │
    ├──► dbPut / dbDelete  ──► IndexedDB  (source of truth locally)
    │
    └──► syncWithRetry(() => syncXxx(userId, record)) ──► supabaseSync.ts ──► Supabase
                                                                              (cloud backup,
                                                                               multi-device)
```

**Contract for any new persistence code:**

- Always write to IndexedDB first. Never throw on cloud failure.
- Always get the user via `getCurrentUser()` from `./supabaseAuth`. If null (logged out), skip cloud sync.
- Wrap the cloud call in `syncWithRetry` from `./indexedDBCore` so transient failures retry.
- Always pass `user_id` as the first arg to the sync function. RLS (`auth.uid() = user_id`) depends on it.
- Never use `as unknown as Parameters<typeof syncX>[1]` to bypass type errors. If the shapes don't match, write an explicit object-literal mapper.

**Template to copy (see `src/services/workoutDb.ts` for the canonical example):**

```ts
await dbPut(STORES.X, record);

const user = await getCurrentUser();
if (user) {
  syncWithRetry(
    () => syncX(user.id, {
      // explicit field-by-field mapping, no casts
      id: record.id,
      foo: record.foo,
      // ...
    }),
    `operationName:${record.id}`,
  );
}
```

---

## 2. What was fixed on 2026-04-22

### 2.1. Broken user_id in festoreService (CRITICAL)

`src/services/festoreService.ts` had 4 `syncXxx` and 4 delete functions, all of them accepting `_userId` as a parameter but **never including it in the Supabase upsert body**. Every workout-template / session / exercise / body-weight sync was being silently rejected by Postgres (NOT NULL violation on `user_id`, or RLS failure).

**Action taken:**

- `festoreService.ts` deleted entirely.
- `src/services/workoutDb.ts` and `src/services/workoutService.ts` now import from `./supabaseSync` (which correctly passes `user_id`).
- `src/services/__tests__/workoutDb.test.ts` mock updated.

### 2.2. Four services were not syncing at all (CRITICAL)

Recovery logs, nutrition/meals, PRs, body weight/measurements — all of these wrote only to IndexedDB. If a user cleared browser storage, switched devices, or logged in from a fresh browser, this data was gone.

**Action taken:** Each of the four services now fires `syncWithRetry(...)` after every `dbPut`/`dbDelete`:

- `src/services/recoveryService.ts` — `saveRecoveryLog`, `deleteRecoveryLog`
- `src/services/nutritionService.ts` — `addFoodFromPreset`, `addMealEntry`, `updateMealEntry`, `deleteMealEntry`
- `src/services/prService.ts` — `savePR`, `deletePR`
- `src/services/bodyStatsService.ts` — `addBodyWeight`, `updateBodyWeight`, `deleteBodyWeight`, `addBodyMeasurement`, `addRecoveryLog`, `updateRecoveryLog`, `deleteRecoveryLog`

### 2.3. Type/shape mismatches that Postgres would reject (HIGH)

Three real bugs were lurking behind `as unknown as` casts:

| Entity          | Local shape                                               | Wire shape expected by Supabase                                 | Bug if cast is used                                 |
| --------------- | --------------------------------------------------------- | --------------------------------------------------------------- | --------------------------------------------------- |
| PersonalRecord  | `type: 'weight'\|'reps'\|'volume'`                        | `recordType: '1rm'\|'volume'\|'reps'`, CHECK excludes `'weight'`| `record.recordType` is `undefined`; CHECK rejects   |
| BodyMeasurement | flat `{ chest, waist, hips, arms, thighs, neck, bodyFat }` | nested `{ measurements: { chest, waist, ... } }` JSONB column | Top-level fields that don't exist as columns → reject |
| MealEntry       | nested `totalMacros: { calories, protein, carbs, fat }`   | flat `calories INTEGER, protein INTEGER, ...` columns           | `calories` is undefined; also loses decimals        |

**Action taken:**

- Replaced all `as unknown as` casts with explicit object-literal mappers.
- For nutrition, wrapped numeric fields in `Math.round()` to satisfy the INTEGER columns.
- For PR, extended `record_type` CHECK in `schema.sql` to accept `'weight'` and widened the `supabaseSync.ts` union.
- For BodyMeasurement, the mapper nests the flat fields into `measurements: { ... }`.

### 2.4. Recovery schema was missing columns (MEDIUM)

Local `RecoveryLog` has `stressLevel`, `tightAreas`, `overallScore`, `sessionId`. The schema did not have matching columns, and `supabaseSync.syncRecoveryLog` dropped them silently.

**Action taken:**

- `supabase/schema.sql` — added `stress_level`, `tight_areas` (JSONB), `overall_score`, `session_id` to `recovery_logs`.
- `src/services/supabaseSync.ts` — `RecoveryLog` interface + `syncRecoveryLog` upsert + `fetchRecoveryLogs` mapper all extended.
- Migration snippet appended to the bottom of `schema.sql` (commented-out) for existing deployments.

### 2.5. personal_items was writing to a non-existent table

`src/services/personalItemsDb.ts` tried to upsert into `supabase.from('personal_items')`. That table is not in `schema.sql`. Every call failed silently.

**Action taken:** Supabase calls removed from `personalItemsDb.ts`. Only IndexedDB writes remain. The table can be added later if desired (see §3.5).

---

## 3. Outstanding tasks

### 3.1. Run the schema migration on the live Supabase project [REQUIRED]

The code assumes the schema has:

- `personal_records.record_type` CHECK accepting `'weight'`
- `recovery_logs` has columns `stress_level`, `tight_areas`, `overall_score`, `session_id`

Without the migration, PR syncs and full recovery-log syncs will be rejected in production.

**How to run:**

Open the Supabase dashboard → SQL Editor → paste and run:

```sql
ALTER TABLE personal_records
  DROP CONSTRAINT IF EXISTS personal_records_record_type_check,
  ADD CONSTRAINT personal_records_record_type_check
  CHECK (record_type IN ('weight', '1rm', 'volume', 'reps'));

ALTER TABLE recovery_logs
  ADD COLUMN IF NOT EXISTS stress_level INTEGER CHECK (stress_level >= 1 AND stress_level <= 5),
  ADD COLUMN IF NOT EXISTS tight_areas JSONB DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS overall_score INTEGER CHECK (overall_score >= 0 AND overall_score <= 100),
  ADD COLUMN IF NOT EXISTS session_id TEXT;
```

Safe to re-run (uses `IF EXISTS` / `IF NOT EXISTS`). No downtime expected.

Also available, uncommented, at the bottom of `supabase/schema.sql`.

**Verification after migration:**

```sql
-- Expected: returns 'weight, 1rm, volume, reps' (any order)
SELECT pg_get_constraintdef(oid)
FROM pg_constraint
WHERE conname = 'personal_records_record_type_check';

-- Expected: stress_level, tight_areas, overall_score, session_id in the list
SELECT column_name FROM information_schema.columns
WHERE table_name = 'recovery_logs'
ORDER BY ordinal_position;
```

### 3.2. Wire Settings sync (OPTIONAL — product decision required)

`src/contexts/SettingsContext.tsx` currently persists via `localStorage.setItem('appSettings', ...)` only. The schema already has a `user_settings` table with RLS, and `supabaseSync.syncUserSetting` / `fetchUserSettings` exist.

**The decision:** Should settings follow the user between devices (phone ↔ desktop ↔ another browser)? If yes, wire it. If no, remove the `user_settings` table from the schema to avoid dead code.

**If wiring it:**

1. Inside `SettingsContext.tsx`, augment `persistSettings` to also call `syncUserSetting` per top-level key. Keep `localStorage.setItem` first (so offline still works). Pattern:

   ```ts
   const persistSettings = (settings: AppSettings) => {
     try {
       localStorage.setItem('appSettings', JSON.stringify(settings));
     } catch {
       /* ignore */
     }

     void (async () => {
       const user = await getCurrentUser();
       if (!user) return;
       syncWithRetry(
         () => syncUserSetting(user.id, { key: 'appSettings', value: settings }),
         `persistSettings:${user.id}`,
       );
     })();
   };
   ```

2. On mount, after loading from localStorage, also pull from cloud. If a cloud value exists and is newer than local, prefer it. Use `updatedAt` from the `user_settings` row.

3. Decide on conflict policy: last-writer-wins is the default the app already implicitly uses elsewhere. Don't build a merge strategy unless product asks.

4. Add coverage: open the app in two browsers, change a setting in one, confirm it reflects in the other after a refresh.

**If NOT wiring it:** delete the `user_settings` table + policies from `schema.sql`, and delete `syncUserSetting`/`fetchUserSettings`/`deleteCloudUserSetting` from `supabaseSync.ts`. Also remove their usage in `syncAllData` / `pullAllData`. Update this doc.

### 3.3. Close the type drift between supabaseSync.ts and types/index.ts (MEDIUM)

`npm run typecheck` currently reports errors like:

```
supabaseSync.ts(1152,40): 'WorkoutTemplate' is missing: lastUsed, timesUsed, isFavorite
supabaseSync.ts(1153,39): 'WorkoutSession' is missing: status, templateId, rating, caloriesBurned, updatedAt
supabaseSync.ts(1155,34): 'BodyWeightEntry.createdAt' string | undefined not assignable to string
```

**What this means at runtime:** `pullAllData()` pulls from cloud and calls `replace*FromCloud(list)` in `workoutDb.ts`, which passes them to `dbPut`. Because the local copy of the type inside `supabaseSync.ts` is narrower than the canonical one in `src/types/index.ts`, pulled records are **missing** fields like `lastUsed`, `isFavorite`, `templateId`, etc. Those fields will be `undefined` after a pull — subtle data loss.

**How to fix:**

Option A (preferred) — **stop redefining types inside `supabaseSync.ts`**. Import the canonical types from `src/types/index.ts`. Drop fields that don't belong in the cloud payload at the mapper, not at the type level. This is more work but eliminates drift permanently.

Option B (faster) — extend each local interface inside `supabaseSync.ts` to match the canonical type. Write a ticket to consolidate later. Still leaves the risk of drift next time the canonical type changes.

If going with Option A, the pattern is:

```ts
import type { WorkoutTemplate } from '../types';

export const syncWorkoutTemplate = async (
  userId: string,
  template: WorkoutTemplate,
): Promise<void> => {
  // ... map only the fields that go to the cloud
};

export const fetchWorkoutTemplates = async (
  userId: string,
): Promise<WorkoutTemplate[]> => {
  // ... map row -> WorkoutTemplate, set client-side-only fields to sensible defaults
  return (data ?? []).map((row) => ({
    id: row.id,
    name: row.name,
    // ...
    lastUsed: undefined,          // cloud doesn't track this — computed locally
    timesUsed: 0,                 // same
    isFavorite: false,            // same — or sync via user_settings if meaningful
  }));
};
```

Audit the "extra" fields per type and decide for each:

- Client-side only (no cloud value) → default at fetch time.
- Should actually live in cloud → add the column to the schema and map it both ways.

### 3.4. Commit the uncommitted type-mapping fixes [QUICK]

At the time of writing, three files have uncommitted changes that replace the last `as unknown as` casts with proper mappers:

```
M src/services/bodyStatsService.ts
M src/services/nutritionService.ts
M src/services/recoveryService.ts
```

Review the diff, run `npm run typecheck`, then commit. Suggested message:

```
Replace unsafe sync casts with explicit wire-shape mappers

PR type now maps through recordType correctly; BodyMeasurement flat
fields nest under measurements{} as the JSONB column expects; MealEntry
totalMacros flatten to integer calories/protein/carbs/fat; recovery
logs now send stress_level/tight_areas/overall_score/session_id.
```

### 3.5. Decide on personal_items (OPTIONAL)

`PersonalItem` is currently local-only. This is an acceptable state — personal items are ephemeral workout entries, not durable training history. But if the user expects them to survive device changes, the table should be added.

**If keeping local-only:** no action needed. Consider adding a short comment at the top of `personalItemsDb.ts` stating this is intentional.

**If promoting to cloud:** create a migration that adds the table (mirror `workout_templates` shape but with a generic `type` and `content` column since `PersonalItem` is polymorphic). Then restore the `syncWithRetry(() => supabase.from('personal_items')...)` blocks but pass `user_id` explicitly. Mirror the pattern in `workoutDb.ts`.

### 3.6. Pre-existing unrelated issues surfaced by typecheck

These exist in `master` from before this work. They are noted here so the next agent does not waste time investigating whether this persistence work caused them:

- `src/utils/errorReporting.ts:44` — references undefined `userMessage`. Real bug, separate cleanup.
- Various unused-import warnings (`App.tsx`, `ExerciseNav.tsx`, `StatsGrid.tsx`, `EmptyWorkoutState.tsx`, `Settings.tsx`, `Templates.tsx`, `errorReporting.ts`, etc).
- `noUncheckedIndexedAccess` warnings in `pages/History.tsx`, `pages/Nutrition.tsx`, `pages/Progress.tsx` — add `?? defaultValue` guards.
- `components/workout/components/ExerciseList.tsx:40` — passes `style` prop to a component that does not accept it.
- `components/workout/effects/ParticleExplosion.tsx:49` — references `Particle.id` that does not exist.
- `workoutDb.ts:894-934` — `replace*FromCloud(list: unknown[])` passes `unknown` to `dbPut` which expects `object`. Narrow the parameter type.

---

## 4. File map

| File                                                    | Role                                                                           |
| ------------------------------------------------------- | ------------------------------------------------------------------------------ |
| `supabase/schema.sql`                                   | Source of truth for Supabase schema + RLS. Migration snippet at the bottom.    |
| `src/lib/supabase.ts`                                   | Client initialization. Check env (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`). |
| `src/services/supabaseAuth.ts`                          | `getCurrentUser()` returns logged-in user or null.                             |
| `src/services/supabaseSync.ts`                          | All cloud sync + fetch functions. Every sync function takes `userId` as arg 1. |
| `src/services/indexedDBCore.ts`                         | Low-level IndexedDB helpers (`dbPut`, `dbDelete`, `dbGetAll`, `syncWithRetry`). |
| `src/services/offlineQueue.ts`                          | Queues failed cloud mutations for replay on reconnect. Already wired correctly. |
| `src/services/workoutDb.ts`                             | Canonical example of the IndexedDB + cloud sync pattern. Mirror this.         |
| `src/services/workoutService.ts`                        | Also canonical.                                                                |
| `src/services/recoveryService.ts`                       | Recovery logs. Syncs to cloud as of 2026-04-22.                                |
| `src/services/nutritionService.ts`                      | Meal entries. Syncs to cloud as of 2026-04-22.                                 |
| `src/services/prService.ts`                             | Personal records. Syncs to cloud as of 2026-04-22.                             |
| `src/services/bodyStatsService.ts`                      | Body weight + measurements + recovery. Syncs to cloud as of 2026-04-22.        |
| `src/services/personalItemsDb.ts`                       | Local-only. No cloud table.                                                    |
| `src/contexts/SettingsContext.tsx`                      | localStorage-only. Cloud sync not wired (see §3.2).                            |

---

## 5. How to verify sync end-to-end

Before shipping any further changes, run this manual check. There is no automated test for round-trip persistence yet — that would be a good thing to add.

1. Sign in with a real Supabase user in the app.
2. Open DevTools → Application → IndexedDB → `sparkos-fitness-db`. Leave it visible.
3. Perform an action for each category:
   - Log a workout session (ends in `saveWorkoutSession` → `workout_sessions` table).
   - Save a body-weight entry (`addBodyWeight` → `body_weight`).
   - Save a body measurement (`addBodyMeasurement` → `body_measurements`).
   - Log a meal (`addMealEntry` → `nutrition_logs`).
   - Save a recovery log (`saveRecoveryLog` → `recovery_logs`).
   - Save a personal record (hit a new 1RM in a workout; triggers `savePR` → `personal_records`).
4. For each action, confirm:
   - A row appeared in IndexedDB immediately.
   - Watching Network, the matching POST/PATCH to Supabase REST returned `2xx`.
   - A row appeared in the Supabase dashboard Table Editor with the correct `user_id`.
5. Sign out, clear IndexedDB, sign in again.
6. In Settings, press the "Pull from cloud" button (calls `pullAllData` in `supabaseSync.ts`).
7. Confirm all categories re-populated in IndexedDB.

If step 4 fails with a 400/403/409:

- 400 = schema mismatch. The type mapping drifted again; fix the mapper.
- 403 = RLS rejected. Either `user_id` is missing in the payload or the user session expired.
- 409 = conflict. Usually means the primary key already exists and the `upsert` did not include the conflict column. Check `onConflict` options.

---

## 6. Rules for any future agent touching this area

- **Never** use `as unknown as Parameters<typeof X>[1]` to quiet a sync-related type error. It will produce runtime data loss. Write a real mapper.
- **Never** skip `getCurrentUser()` and pass a hardcoded `user_id`. RLS will drop the write.
- **Never** stop writing to IndexedDB first. The app is offline-first. Cloud is the mirror, not the master.
- **Never** throw out of a `syncWithRetry` callback. Let `syncWithRetry` handle the retry/log; the caller has already returned success to the UI.
- **Do** add the same schema column on both ends — `schema.sql` and the migration snippet at its bottom — when adding a new persisted field.
- **Do** use the canonical types in `src/types/index.ts`. If supabaseSync's local types drift, fix supabaseSync, not the canonical.
- **Do** keep this document up to date when closing one of the outstanding tasks in §3.

---

_End of handoff._

# Review 04 — Services Domain Layer

**Scope:** 11 service files covering analytics aggregations, nutrition, body stats, recovery, water tracking, training load, Supabase auth, Supabase sync, offline queue, notifications, and Web Vitals.
**Date:** 2026-05-28
**Verdict:** The domain services layer is feature-complete but suffers from **dead code duplication** ([`recoveryService.ts`](src/services/recoveryService.ts) is entirely redundant), **SRP violations** in [`bodyStatsService.ts`](src/services/bodyStatsService.ts) (body weight + measurements + recovery all in one file), **inconsistent sync patterns** (inline sync in nutrition/water vs. delegated sync in body stats), and **no conflict resolution strategy** in the Supabase sync layer. The offline queue is well-designed but underutilized — domain services use `syncWithRetry` from [`indexedDBCore.ts`](src/services/indexedDBCore.ts) instead of the dedicated [`offlineQueue.ts`](src/services/offlineQueue.ts).

---

## Table of Contents

1. [Per-File Analysis](#1-per-file-analysis)
   - [1.1 analyticsService.ts](#11-analyticsservicets)
   - [1.2 nutritionService.ts](#12-nutritionservicets)
   - [1.3 bodyStatsService.ts](#13-bodystatsservicets)
   - [1.4 recoveryService.ts](#4-recoveryservicets)
   - [1.5 waterService.ts](#15-waterservicets)
   - [1.6 trainingLoadService.ts](#16-trainingloadservicets)
   - [1.7 supabaseAuth.ts](#17-supabaseauthts)
   - [1.8 supabaseSync.ts](#18-supabasesyncts)
   - [1.9 offlineQueue.ts](#19-offlinequeuets)
   - [1.10 notificationService.ts](#110-notificationservicets)
   - [1.11 webVitals.ts](#111-webvitalsts)
2. [Cross-Cutting Analysis](#2-cross-cutting-analysis)
   - [2.1 CRUD vs Business Logic Separation](#21-crud-vs-business-logic-separation)
   - [2.2 Consistency of Patterns](#22-consistency-of-patterns)
   - [2.3 Duplicate Code Across Services](#23-duplicate-code-across-services)
   - [2.4 Supabase Sync Reliability & Conflict Resolution](#24-supabase-sync-reliability--conflict-resolution)
   - [2.5 Offline Queue Robustness](#25-offline-queue-robustness)
   - [2.6 Error Handling Consistency](#26-error-handling-consistency)
   - [2.7 Test Coverage Gaps](#27-test-coverage-gaps)
3. [Prioritized Recommendations](#3-prioritized-recommendations)

---

## 1. Per-File Analysis

### 1.1 `analyticsService.ts`

**File:** [`src/services/analyticsService.ts`](src/services/analyticsService.ts) — 857 lines
**Purpose:** Pure computation layer for the Progress page — aggregations over workout sessions (volume history, frequency, muscle distribution, personal records, forecasting, strength progression, week-over-week deltas).

#### Strengths

- **Pure functions dominate**: Most exports are synchronous, side-effect-free transforms over `WorkoutSession[]` — easy to test and reason about.
- **`linearRegression()`** (line 90–115): Correct least-squares implementation with R²; handles edge cases (n < 2, denominator = 0).
- **`getISOWeek()`** (line 82–88): Proper ISO 8601 week calculation using UTC — avoids timezone-dependent off-by-one errors.
- **`computeSessionVolume` / `computeSessionStats`** (lines 118–149): Shared building blocks that filter `isCompleted && !isWarmup` consistently.
- **`filterByWeeks()`** (line 157–163): Reusable time-window filter applied across multiple exports.

#### Issues

| # | Severity | Line(s) | Issue |
|---|----------|---------|-------|
| A1 | 🟡 Medium | 215–227 | **Dynamic `import('./workoutDb')` inside `getAnalyticsSummary`** — this is a top-level API function called frequently. The lazy import adds latency on every call and makes the dependency graph opaque. Should be a top-level import or the function should accept sessions as a parameter. |
| A2 | 🟡 Medium | 354–376 | **Same dynamic import in `getProgressData`** — duplicates the pattern from A1. Two different functions fetch all sessions from IDB independently. |
| A3 | 🟡 Medium | 220 | **Magic number `1000`** in `getWorkoutSessions(1000)` — hard-coded limit with no pagination. If a user has >1000 sessions, older data is silently dropped. |
| A4 | 🟢 Low | 352 | **Alias export** `getMuscleGroupDistribution = calculateMuscleGroupDistribution` — backward-compatibility shim that should be removed once consumers are updated. |
| A5 | 🟢 Low | 254–257, 304–309 | **Duplicate day-counting logic** — `getAnalyticsSummary` and `calculateFrequency` both compute `dayCounts` the same way. Should share a helper. |
| A6 | 🟡 Medium | 174 | **`computeSessionVolume` computes volume but `findPersonalRecords` also computes `set.reps * set.weight` inline** — no shared `setVolume()` helper, so the formula is repeated 10+ times across the file. |
| A7 | 🟢 Low | 225–227 | **Silent error swallowing** — `catch { sessions = []; }` hides IDB failures with no logging. |
| A8 | 🟡 Medium | 847 | **Epley 1RM formula** `maxWeight * (1 + maxReps / 30)` is embedded inline in `calculateStrengthProgression` — should be a named utility (e.g. `estimate1RM(weight, reps)`) so the formula can be tested and swapped. |
| A9 | 🟡 Medium | 857 | **857 lines in a single file** — the file mixes "original" analytics with "new" analytics and "additional exports for useFitnessInsights". Should be split into `analytics/volume.ts`, `analytics/muscles.ts`, `analytics/progression.ts`. |

#### Architectural Concerns

- **No dependency injection**: Functions that need data (`getAnalyticsSummary`, `getProgressData`) internally import and call `getWorkoutSessions`. This couples the analytics layer to the storage layer and makes unit testing require mocking the entire IDB chain. The synchronous functions (most of the file) correctly accept sessions as parameters — the async functions should follow the same pattern.
- **Interface proliferation**: 12 exported interfaces (`AnalyticsSummary`, `VolumeDataPoint`, `FrequencyData`, `MuscleGroupData`, `WeeklyVolume`, `MuscleBalanceData`, `ForecastData`, `ExerciseProgressData`, `LastWorkoutSummary`, `MuscleGroupLastTrained`, `ProgressDelta`, `StrengthProgressPoint`). Many are structurally similar — consider a generic `TimeSeries<T>` pattern.

---

### 1.2 `nutritionService.ts`

**File:** [`src/services/nutritionService.ts`](src/services/nutritionService.ts) — 884 lines
**Purpose:** Manages nutrition logging — food library, meal presets, CRUD for meal entries, macro calculations, daily/weekly summaries, sync to Supabase.

#### Strengths

- **Clean CRUD separation**: [`addMealEntry()`](src/services/nutritionService.ts:664), [`updateMealEntry()`](src/services/nutritionService.ts:702), [`deleteMealEntry()`](src/services/nutritionService.ts:733) each handle IDB write → cloud sync in a consistent pattern.
- **`calcMacroTotals()`** (line 563–574): Correct per-serving macro aggregation with fiber support.
- **`getMacroPercentages()`** (line 777–789): Proper calorie-weighted percentages (P×4, C×4, F×9).
- **Hebrew food library** (lines 22–463): Localized food database with realistic Israeli foods — good UX for target audience.

#### Issues

| # | Severity | Line(s) | Issue |
|---|----------|---------|-------|
| N1 | 🔴 High | 22–463 | **440-line hardcoded food library** — 40 food items with Hebrew names baked into the service file. This should be a JSON data file or a database seed, not TypeScript source. It inflates the bundle and makes food management a code change. |
| N2 | 🟡 Medium | 632–659 | **Fire-and-forget sync in `addFoodFromPreset`** — `void (async () => { ... })()` swallows sync errors completely. If the sync fails, the user gets no indication and the mutation is lost (not queued). |
| N3 | 🟡 Medium | 632 | **Duplicate sync code** — the sync block in `addFoodFromPreset` (lines 632–659) is nearly identical to the sync block in `addMealEntry` (lines 672–697). Both construct the same Supabase payload shape. Should be extracted to a shared `syncMealToCloud()` helper. |
| N4 | 🟡 Medium | 674–696, 707–730 | **Sync payload construction repeated 3 times** — `addMealEntry`, `updateMealEntry`, and `addFoodFromPreset` all build the same `syncNutritionLog()` payload with identical `Math.round()` calls. Violates DRY. |
| N5 | 🟡 Medium | 465–550 | **8 meal presets hardcoded** — similar to N1, presets should be data, not code. |
| N6 | 🟡 Medium | 576–578 | **`todayStr()` helper duplicated** — identical implementation exists in [`waterService.ts`](src/services/waterService.ts:16) and [`bodyStatsService.ts`](src/services/bodyStatsService.ts:344). Should be in `dateUtils.ts`. |
| N7 | 🟢 Low | 559–561 | **`generateId()` uses `Date.now()` + `Math.random()`** — not cryptographically unique. Should use `crypto.randomUUID()` for collision safety, especially when syncing across devices. |
| N8 | 🟢 Low | 866–873 | **Lucide icons imported in a service file** — `MEAL_TYPE_ICONS` mixes UI concerns (React components) into a data service. Should live in a UI constants file. |
| N9 | 🟡 Medium | 742–753 | **`dbGetAll` + filter pattern** — every query loads the entire store into memory then filters. For a nutrition log that grows daily, this becomes O(n) on every page load. Needs indexed queries. |

#### Architectural Concerns

- **SRP violation**: This single file handles food data, meal presets, CRUD operations, macro calculations, percentage calculations, weekly summaries, AND UI constants (icons, labels). Should be split into at least `nutritionData.ts`, `nutritionCrud.ts`, `nutritionCalculations.ts`.
- **No validation**: `addMealEntry` accepts `Omit<MealEntry, 'id' | 'createdAt'>` but validates nothing — negative calories, empty food arrays, future dates are all accepted.

---

### 1.3 `bodyStatsService.ts`

**File:** [`src/services/bodyStatsService.ts`](src/services/bodyStatsService.ts) — 474 lines
**Purpose:** Body weight tracking, body measurements, AND recovery logging — three distinct domains in one file.

#### Strengths

- **Input validation** (line 94–96): `addBodyWeight` validates weight range (0–700 kg) using [`ValidationError`](src/errors/index.ts:16).
- **Custom event dispatch** (lines 111–121): `BODY_WEIGHT_UPDATED` event allows other modules (TDEE, nutrition) to react to weight changes — good decoupling.
- **Duplicate recovery log cleanup** (lines 249–268): `addRecoveryLog` deduplicates by date, keeping only the latest entry per day.
- **`calculateRecoveryScore()`** (lines 376–393): Weighted formula (sleep 30%, soreness 25%, energy 25%, stress 20%) with clear documentation.

#### Issues

| # | Severity | Line(s) | Issue |
|---|----------|---------|-------|
| B1 | 🔴 High | 1–474 | **SRP violation — three domains in one file**: Body weight (lines 91–185), body measurements (lines 194–244), and recovery logging (lines 246–470) are unrelated concerns. This file is imported by consumers who only need one of these three domains, pulling in unnecessary code. |
| B2 | 🔴 High | 1–10 | **Imports recovery sync functions** — `deleteCloudRecoveryLog`, `syncRecoveryLog` are imported at the top level (line 9). Any consumer of `addBodyWeight` also loads the recovery sync module. |
| B3 | 🟡 Medium | 12 | **Hardcoded store name** `BODY_MEASUREMENTS_STORE = 'body_measurements'` — this duplicates the value in [`STORES.BODY_MEASUREMENTS`](src/services/indexedDBCore.ts:18) but as a raw string, bypassing the centralized constant. If the store name changes in `indexedDBCore`, this breaks silently. |
| B4 | 🟡 Medium | 87–89 | **`generateId()` uses `Date.now() + Math.random()`** — same issue as N7. Should use `crypto.randomUUID()`. |
| B5 | 🟡 Medium | 160–178 | **`calculateWeightTrend` uses Hebrew strings** in the `direction` field (`'עלייה'`, `'ירידה'`, `'יציב'`). Domain logic should return enums, not locale-specific strings. |
| B6 | 🟡 Medium | 187–192 | **`getBMICategory` returns Hebrew labels and hex colors** — mixing localization and presentation into a domain function. |
| B7 | 🟡 Medium | 71–77 | **`LegacyRecoveryScore` type** — backward-compatibility shim that adds `score`, `sleepScore`, etc. as aliases. Dead weight if no consumers use it. |
| B8 | 🟢 Low | 455–473 | **`BODY_AREAS` and `TIGHTNESS_AREAS`** — Hebrew body-part lists hardcoded. Should be a data file. Duplicated in [`recoveryService.ts`](src/services/recoveryService.ts:50–65). |
| B9 | 🟡 Medium | 396–421 | **`getLegacyRecoveryScore`** — backward-compat wrapper with Hebrew label mapping. Should be in a UI adapter, not a domain service. |

#### Architectural Concerns

- **Split into 3 files**: `bodyWeightService.ts`, `bodyMeasurementService.ts`, `recoveryService.ts` (replacing the dead one).
- **Recovery logic belongs in its own file**: The recovery score calculation, weekly averages, body areas, and CRUD are a complete domain that happens to share the same IDB database but not the same concerns.

---

### 1.4 `recoveryService.ts`

**File:** [`src/services/recoveryService.ts`](src/services/recoveryService.ts) — 278 lines
**Purpose:** **DEPRECATED — entirely dead code.** The file's own JSDoc (line 1–6) states it is not imported anywhere and all recovery functionality lives in `bodyStatsService.ts`.

#### Issues

| # | Severity | Line(s) | Issue |
|---|----------|---------|-------|
| R1 | 🔴 High | 1–278 | **Dead code** — 278 lines of unused, duplicated code. Every function, interface, and constant in this file has an equivalent in [`bodyStatsService.ts`](src/services/bodyStatsService.ts). |
| R2 | 🔴 High | 16–39 | **`RecoveryLog` interface** — duplicates [`bodyStatsService.ts:RecoveryLog`](src/services/bodyStatsService.ts:36–59) with a subtle difference: `notes` is `string` (required) here vs `string?` (optional) in `bodyStatsService.ts`. If a consumer imported from the wrong file, type mismatches would occur. |
| R3 | 🟡 Medium | 8–10 | **Wasted imports** — imports `syncWithRetry`, `getCurrentUser`, `syncRecoveryLog`, `deleteCloudRecoveryLog` for code that never runs. |
| R4 | 🟡 Medium | 71–80, 82–87, 89–117 | **Duplicated helper functions** — `mapSleepHoursToScore`, `getScoreLabel`, `calculateRecoveryScore` are identical to those in `bodyStatsService.ts` (lines 353–393). |

#### Recommendation

**Delete this file immediately.** It is a textbook example of dead code accumulating technical debt. The deprecation notice is good practice but the file should not remain in the codebase.

---

### 1.5 `waterService.ts`

**File:** [`src/services/waterService.ts`](src/services/waterService.ts) — 86 lines
**Purpose:** Water intake tracking — add entries, query today's total, date-range queries, Supabase sync.

#### Strengths

- **Small, focused file** — 86 lines doing exactly one thing.
- **Direct Supabase sync** (lines 69–85): `syncWaterEntry` performs inline upsert with proper error throwing for retry.
- **Constants exported** (lines 13–14): `WATER_GOAL_ML` and `GLASS_ML` are configurable constants, not magic numbers.

#### Issues

| # | Severity | Line(s) | Issue |
|---|----------|---------|-------|
| W1 | 🟡 Medium | 69–85 | **Inline Supabase sync** — `syncWaterEntry` directly uses the `supabase` client, bypassing the `syncWithRetry` pattern used by other services. If this sync fails, there's no retry mechanism. |
| W2 | 🟡 Medium | 1 | **Direct `supabase` import** — other services use `syncWithRetry` from `indexedDBCore` or delegate to `supabaseSync.ts`. This service creates a third pattern. |
| W3 | 🟢 Low | 16–18 | **`todayStr()` duplicated** — same implementation as in `nutritionService.ts` and `bodyStatsService.ts`. |
| W4 | 🟢 Low | 20–22 | **`generateId()` uses `Date.now() + Math.random()`** — same pattern as other services; should use `crypto.randomUUID()`. |
| W5 | 🟡 Medium | 49–53, 55–59, 61–67 | **`dbGetAll` + filter** — loads all water entries into memory for every query. Needs an index on `date`. |
| W6 | 🟢 Low | 24–26, 28–30 | **`getWaterGoal()` and `getGlassSize()`** — trivial getters over constants. Could be exported constants directly. |

#### Architectural Concerns

- **No `deleteWaterEntry` function** — users can add water but cannot undo/correct a mistaken entry.
- **No integration with `offlineQueue`** — if the inline sync fails while offline, the mutation is silently lost.

---

### 1.6 `trainingLoadService.ts`

**File:** [`src/services/trainingLoadService.ts`](src/services/trainingLoadService.ts) — 323 lines
**Purpose:** Computes training load metrics — acute/chronic workload ratio, fatigue score, readiness, per-muscle recovery state, and training recommendations.

#### Strengths

- **Pure computation** — no I/O, no side effects. Accepts sessions and recovery logs as parameters and returns a result object. Excellent testability.
- **Well-typed outputs** — [`TrainingLoadResult`](src/services/trainingLoadService.ts:24), [`MuscleRecoveryState`](src/services/trainingLoadService.ts:13), [`TrainingLoadRecommendation`](src/services/trainingLoadService.ts:4) are precise discriminated unions.
- **Named helper functions** — `clamp`, `round`, `getDateKey`, `daysBetween`, `getMuscle`, `isCompletedWorkingSet` are small, composable utilities.
- **`calculateMuscleRecovery`** (lines 131–222): Comprehensive per-muscle analysis combining volume, days-since-trained, tightness, and volume change.
- **Good test coverage** — [`trainingLoadService.test.ts`](src/services/__tests__/trainingLoadService.test.ts) exists with 142 lines.

#### Issues

| # | Severity | Line(s) | Issue |
|---|----------|---------|-------|
| T1 | 🟡 Medium | 64–65 | **`getMuscle` duplicates `getMuscleKey`** from `analyticsService.ts` (line 152–154). Both resolve `muscleGroup || targetMuscle || 'Unknown'`. Should be a shared utility. |
| T2 | 🟡 Medium | 69–73, 75–81 | **`getExerciseVolume` and `getSessionVolume`** duplicate volume computation logic from `analyticsService.ts` (`computeSessionVolume`, `computeSessionStats`). Three separate implementations of "sum weight × reps for completed non-warmup sets". |
| T3 | 🟢 Low | 224 | **`recoveryLogs` parameter defaults to `[]`** — callers can omit it, silently disabling recovery-aware recommendations. Should be explicitly required or the default behavior documented. |
| T4 | 🟡 Medium | 189–199 | **Magic numbers in recovery score** — `35`, `12`, `25`, `0.3`, `45` are penalty weights without named constants or documentation of their derivation. |
| T5 | 🟢 Low | 274 | **`rpeFactor` defaults to `0.7`** when no RPE data exists — undocumented assumption. |

#### Architectural Concerns

- **Import coupling**: Line 2 imports `calculateRecoveryScore` from `bodyStatsService`. This creates a dependency from a pure computation service to a CRUD service. The recovery score calculation should be a standalone utility.
- **No shared volume helpers**: The file implements its own volume computation (`getExerciseVolume`, `getSessionVolume`) because there's no shared `fitness-math.ts` utility module. Both `analyticsService.ts` and `trainingLoadService.ts` need the same math.

---

### 1.7 `supabaseAuth.ts`

**File:** [`src/services/supabaseAuth.ts`](src/services/supabaseAuth.ts) — 384 lines
**Purpose:** Supabase authentication — sign in/up/out, Google OAuth, password reset/update, session management, guest mode data cleanup.

#### Strengths

- **Thorough sign-out cleanup** (lines 234–273): `clearUserScopedLocalData` clears 12 IDB stores, 8 localStorage keys, and dynamic prefixed keys. Prevents cross-user data leakage on shared devices.
- **Session expiry detection** (lines 74–109): `isSessionExpiredError` checks HTTP status, error codes, and message patterns — comprehensive pattern matching for stale JWTs.
- **`handleExpiredSession`** (lines 116–131): Best-effort cleanup + `auth:session-expired` custom event for app-layer handling.
- **Password strength validation** (lines 329–337): Client-side checks (min 8 chars, letter, digit) with Hebrew error messages.
- **Defensive coding**: Every function checks `isSupabaseConfigured()` before accessing Supabase.

#### Issues

| # | Severity | Line(s) | Issue |
|---|----------|---------|-------|
| SA1 | 🟡 Medium | 332 | **Hebrew regex** `/[a-zA-Z֐-׿]/` — the Unicode range `֐-׿` covers Hebrew letters but the regex is fragile. A simpler `/[a-zA-Z\u0590-\u05FF]/` would be clearer. |
| SA2 | 🟡 Medium | 59–64 | **`initSupabaseAuth` is a no-op** — the JSDoc explains it's kept for backward compatibility, but it should emit a deprecation warning or be removed. |
| SA3 | 🟢 Low | 15–29, 34–43, 48 | **Three separate lists** (`USER_SCOPED_STORES`, `USER_SCOPED_LS_KEYS`, `USER_SCOPED_LS_KEY_PREFIXES`) must be kept in sync with any new store or key. No validation that all stores are covered. |
| SA4 | 🟡 Medium | 256–262 | **localStorage iteration** — `for (let i = 0; i < localStorage.length; i++)` can miss keys if `localStorage` is mutated during iteration (unlikely but possible with concurrent tabs). |
| SA5 | 🟢 Low | 287–294 | **`signOut` calls `clearUserScopedLocalData` BEFORE `supabase.auth.signOut()`** — this is intentional (documented in comment) but means if Supabase signOut fails, the local data is already wiped. The user is effectively logged out locally but Supabase still has their session. This is acceptable for security but could cause confusion. |

#### Architectural Concerns

- **No token refresh handling**: The service relies on Supabase's built-in token refresh but doesn't implement explicit refresh-on-401 logic. If `getUser()` returns a 401, the service signs out rather than attempting a refresh first.
- **`signOut` is async but callers may not await it**: If a component calls `signOut()` without `await`, the cleanup may not complete before navigation.

---

### 1.8 `supabaseSync.ts`

**File:** [`src/services/supabaseSync.ts`](src/services/supabaseSync.ts) — 1312 lines
**Purpose:** Full bidirectional sync layer — push local data to Supabase, pull cloud data to IndexedDB, real-time subscriptions, connection testing.

#### Strengths

- **Consistent pattern**: Every entity has `sync*`, `fetch*`, `deleteCloud*` triple — predictable API surface.
- **`syncAllData()`** (lines 1021–1168): Parallel push of all 10 entity types with counted results.
- **`pullAllData()`** (lines 1219–1292): Parallel fetch + merge using canonical type mappers.
- **Canonical type mappers** (lines 1174–1217): `toCanonicalTemplate`, `toCanonicalSession`, etc. provide safe defaults for missing fields when pulling from Supabase.
- **Real-time subscriptions** (lines 876–986): Proper channel management with cleanup functions.

#### Issues

| # | Severity | Line(s) | Issue |
|---|----------|---------|-------|
| SS1 | 🔴 High | 1–1312 | **1312-line monolith** — 10 entity types × (sync + fetch + delete) = 30 nearly identical functions. Each follows the same pattern: check `isSupabaseConfigured`, call `supabase.from(table).upsert/select/delete`, log error. This is a textbook case for a generic CRUD factory. |
| SS2 | 🔴 High | 30–218 | **190 lines of duplicate interfaces** — the file defines its own `WorkoutTemplate`, `WorkoutSession`, `PersonalExercise`, `BodyWeightEntry`, `BodyMeasurement`, `PersonalRecord`, `RecoveryLog`, `NutritionLog`, `UserSetting`, `AIConversation` interfaces that shadow the canonical types from `src/types/index.ts`. The JSDoc (lines 30–40) explains this is intentional but it creates maintenance burden — any field change requires updating both places. |
| SS3 | 🟡 Medium | 240–242, 308–309 | **`created_at` overwritten on sync** — `syncWorkoutSession` sets `created_at: new Date().toISOString()` on every upsert, even for updates. This corrupts the original creation timestamp. |
| SS4 | 🟡 Medium | 297–309 | **Missing `status` field in session upsert** — `syncWorkoutSession` doesn't push `status`, `templateId`, `rating`, or `caloriesBurned` to Supabase. When pulled back via `toCanonicalSession` (line 1195), `status` defaults to `'completed'` if `endTime` exists, which may be wrong for cancelled sessions. |
| SS5 | 🟡 Medium | 1071–1153 | **`syncAllData` uses `Promise.all` without batching** — if a user has 500 sessions, it fires 500 concurrent Supabase requests. This will hit rate limits and potentially OOM on mobile. |
| SS6 | 🟡 Medium | 1153 | **No partial failure handling** — `Promise.all` rejects on the first failure. If session 347 of 500 fails, the entire sync aborts and no counts are returned. Should use `Promise.allSettled`. |
| SS7 | 🟡 Medium | 1300 | **`testConnection` queries `workout_templates`** — this is a side effect (it reads data) for a connection test. Should use a lighter check like `supabase.rpc('ping')` or a HEAD request. |
| SS8 | 🟢 Low | 874 | **`realtimeChannels` is module-level mutable state** — no cleanup on user sign-out. If a user signs out and another signs in, stale channels may still be subscribed. |
| SS9 | 🟡 Medium | 1255–1261 | **`pullAllData` passes raw Supabase types to merge functions for some entities** — `mergeBodyMeasurementsFromCloud(bodyMeasurements)` passes the sync-layer `BodyMeasurement` type, while `mergeBodyWeightFromCloud` uses `toCanonicalBodyWeight`. Inconsistent mapping. |

#### Architectural Concerns

- **No conflict resolution**: All syncs use `upsert` with `onConflict: 'id'`. If a record is edited on two devices, the last write wins with no merge, no timestamp comparison, and no user notification. This is the single biggest reliability risk in the sync layer.
- **No optimistic locking**: No `updated_at` comparison before overwriting. A stale client can silently overwrite newer data.
- **Generic CRUD factory would eliminate ~1000 lines**: A pattern like `createSyncService<T>(table, toRow, fromRow)` would reduce each entity to 5–10 lines of configuration.

---

### 1.9 `offlineQueue.ts`

**File:** [`src/services/offlineQueue.ts`](src/services/offlineQueue.ts) — 496 lines
**Purpose:** Queues failed cloud mutations for retry when back online. Separate IndexedDB database (`SparkOS_Queue`), error classification, dedup, and auto-processing on `online` event.

#### Strengths

- **Error classification** (lines 62–113): `isRetriableError` distinguishes permanent failures (4xx, Postgres SQLSTATE codes, RLS violations) from transient ones (network, 5xx, timeout). This prevents infinite retry loops on bad data.
- **Dedup** (lines 281–302, 316–347): If the same record is edited multiple times while offline, only the latest payload is queued. Uses `getDedupKey(type, payload)` to identify record identity.
- **Dedup during processing** (lines 372–383): `processedKeys` set skips redundant queued entries for the same record within a single pass.
- **Max retries** (line 47): `MAX_RETRIES = 5` with per-mutation retry counting.
- **Separate IDB database** (line 125): `SparkOS_Queue` is independent of the main app DB — queue corruption doesn't affect user data.
- **Auto-initialization** (lines 483–495): `initOfflineSync()` sets up the `online` listener and processes pending mutations on startup.

#### Issues

| # | Severity | Line(s) | Issue |
|---|----------|---------|-------|
| OQ1 | 🔴 High | 196–269 | **Dynamic import of `supabaseSync` on every `processQueue` call** — `getSyncFn` does `await import('./supabaseSync')` which loads the entire 1312-line module. This import happens on every queue processing pass. Should be a top-level import. |
| OQ2 | 🟡 Medium | 219–268 | **`getSyncFn` uses `as` casts** — `payload as Parameters<typeof syncWorkoutTemplate>[1]` bypasses type safety. If the queued payload shape doesn't match the expected type, runtime errors occur. |
| OQ3 | 🟡 Medium | 462–475 | **Single-flight guard `isProcessing`** — if the queue is processing and the user comes online again, the second `online` event is silently dropped. No queuing of the processing request itself. |
| OQ4 | 🟡 Medium | 490–494 | **Startup queue processing ignores failures** — `processQueue().then(...)` only logs successes. If all mutations fail on startup, there's no notification to the user. |
| OQ5 | 🟡 Medium | 354 | **Dynamic import of `supabaseAuth`** — `getCurrentUser` is imported lazily on every `processQueue` call, adding latency. |
| OQ6 | 🟢 Low | 374 | **Sequential processing** — mutations are processed one at a time in a `for` loop. For large queues, parallel processing (with concurrency limit) would be faster. |
| OQ7 | 🟡 Medium | 316–347 | **Dedup requires loading entire queue** — `getAllMutations()` reads all queued entries to find a match. For a large queue, this is O(n) per enqueue. A Map-based index would be O(1). |
| OQ8 | 🟢 Low | 47 | **`MAX_RETRIES = 5`** is a constant with no way to configure it per-mutation-type. A 409 Conflict should have 0 retries; a network timeout might warrant 10. |

#### Architectural Concerns

- **Underutilized by domain services**: The nutrition, body stats, water, and recovery services all use `syncWithRetry` from `indexedDBCore.ts` instead of this queue. This means there are **two competing retry mechanisms** — `syncWithRetry` (exponential backoff, in-memory) and `offlineQueue` (persistent IDB, error classification). The queue is more robust but isn't used by most services.
- **No integration with `syncAllData`**: The `supabaseSync.ts` push path doesn't use this queue either. Failed items in `syncAllData` are simply lost.

---

### 1.10 `notificationService.ts`

**File:** [`src/services/notificationService.ts`](src/services/notificationService.ts) — 91 lines
**Purpose:** Browser notification management — config storage, permission requests, workout/nutrition/PR reminders.

#### Strengths

- **Small and focused** — 91 lines, single responsibility.
- **`safeJsonParse`** (line 29): Uses the project's safe JSON utility for localStorage reads.
- **RTL/LTR aware** (line 58): Notifications set `dir: 'rtl'` and `lang: 'he'`.

#### Issues

| # | Severity | Line(s) | Issue |
|---|----------|---------|-------|
| NT1 | 🔴 High | 52–61 | **`showNotification` uses deprecated `new Notification()` API** — the Notification constructor is deprecated in favor of `ServiceWorkerRegistration.showNotification()`. The constructor doesn't work in many mobile browsers and doesn't support actions, tags, or renotify. |
| NT2 | 🟡 Medium | 1–91 | **No scheduling mechanism** — the service can show notifications but has no timer/interval to trigger reminders at configured times. `workoutReminderTime`, `nutritionReminderTimes` are stored but never scheduled. The service is effectively a config store + one-shot display function. |
| NT3 | 🟡 Medium | 79–90 | **`checkMissedWorkouts` requires manual invocation** — it doesn't self-trigger. No integration with `setInterval`, service worker periodic sync, or app lifecycle. |
| NT4 | 🟢 Low | 25–33 | **Config stored in localStorage** — not synced to Supabase. Notification preferences are lost on device change. |
| NT5 | 🟢 Low | 42–49 | **No error handling for `Notification.requestPermission`** — if the browser blocks the permission dialog (e.g., due to iframe restrictions), this throws. |

#### Architectural Concerns

- **Needs a service worker**: For persistent reminders, the notification system should use the Push API + Service Worker, not the page-level Notification API. Without a service worker, notifications only work while the app is open.
- **No integration with DataContext**: `checkMissedWorkouts` takes `lastWorkoutDate` as a parameter but nothing in the app calls it automatically.

---

### 1.11 `webVitals.ts`

**File:** [`src/services/webVitals.ts`](src/services/webVitals.ts) — 28 lines
**Purpose:** Initializes Core Web Vitals tracking (CLS, LCP, FCP, TTFB, INP) with a dev-mode console logger.

#### Strengths

- **Minimal and correct** — 28 lines, no unnecessary complexity.
- **Custom handler support** (line 21): `initWebVitals(handler)` accepts a custom `MetricHandler` for production telemetry integration.
- **Dev-only logging** (line 13): Uses `import.meta.env.DEV` to avoid console noise in production.
- **Good test coverage** — [`webVitals.test.ts`](src/test/webVitals.test.ts) verifies all 5 metrics are initialized.

#### Issues

| # | Severity | Line(s) | Issue |
|---|----------|---------|-------|
| WV1 | 🟡 Medium | 1 | **`onINP` imported but may not be available** — `web-vitals` v4+ renamed `onFID` to `onINP`. If the installed version is older, this import fails at runtime. |
| WV2 | 🟢 Low | 13–18 | **Only dev-mode logging** — no production telemetry endpoint. The `handler` parameter exists but the default caller in `main.tsx` presumably uses the default `logMetric`, meaning production metrics are collected nowhere. |

---

## 2. Cross-Cutting Analysis

### 2.1 CRUD vs Business Logic Separation

The services exhibit **three distinct patterns** for separating CRUD from business logic:

| Pattern | Services | Assessment |
|---------|----------|------------|
| **Pure computation (no I/O)** | `analyticsService`, `trainingLoadService`, `webVitals` | ✅ Excellent — these accept data as parameters and return results. |
| **CRUD + inline sync** | `nutritionService`, `waterService`, `bodyStatsService` | ⚠️ Mixed — each write function does IDB put → Supabase sync in the same function body. Business logic (e.g., recovery score calculation) is interleaved with storage operations. |
| **CRUD delegated to sync layer** | `supabaseSync` (push/pull) | ⚠️ The sync layer handles CRUD for Supabase but not for IDB — that's in `indexedDBCore.ts` and `workoutDb.ts`. |

**Key problem**: The CRUD services (`nutritionService`, `bodyStatsService`, `waterService`) each implement their own "write to IDB, then sync to cloud" pattern with slight variations. There is no shared `Repository<T>` abstraction that handles IDB + cloud sync atomically.

### 2.2 Consistency of Patterns

| Aspect | Consistent? | Details |
|--------|-------------|---------|
| ID generation | ❌ No | `nutritionService` and `waterService` use `Date.now() + Math.random()`; `bodyStatsService` uses `prefix + Date.now() + Math.random()`; `offlineQueue` uses `crypto.randomUUID()`. |
| `todayStr()` | ❌ No | Duplicated in 3 files with identical implementation. |
| Error handling | ❌ No | `analyticsService` swallows errors silently; `nutritionService` uses fire-and-forget; `bodyStatsService` throws `ValidationError`; `waterService` throws raw `Error`; `supabaseSync` logs + throws; `supabaseAuth` logs + returns `{ error }`. |
| Sync pattern | ❌ No | `nutritionService` uses `syncWithRetry`; `waterService` uses inline Supabase call; `bodyStatsService` uses `syncWithRetry`; `offlineQueue` exists but isn't used by any of these. |
| Logging | ⚠️ Partial | `supabaseAuth`, `supabaseSync`, `offlineQueue` use `logger.*`; `analyticsService`, `nutritionService`, `bodyStatsService`, `waterService` have no logging at all. |
| Store constants | ❌ No | `bodyStatsService` hardcodes `'body_measurements'` instead of using `STORES.BODY_MEASUREMENTS`. |

### 2.3 Duplicate Code Across Services

| Duplicated Code | Locations | Lines Affected |
|-----------------|-----------|----------------|
| **Volume computation** (`set.reps * set.weight` for completed non-warmup sets) | `analyticsService.ts:118-128`, `analyticsService.ts:131-149`, `trainingLoadService.ts:69-73`, `trainingLoadService.ts:75-81` | ~40 lines × 4 |
| **Muscle key resolution** (`muscleGroup \|\| targetMuscle \|\| 'Unknown'`) | `analyticsService.ts:152-154`, `trainingLoadService.ts:64-65`, `analyticsService.ts:239-240` (inline) | ~10 lines × 3 |
| **`todayStr()`** (`new Date().toISOString().split('T')[0] ?? ''`) | `nutritionService.ts:576-578`, `waterService.ts:16-18`, `bodyStatsService.ts:344` (inline) | ~3 lines × 3 |
| **`generateId()`** (`Date.now() + Math.random`) | `nutritionService.ts:559-561`, `waterService.ts:20-22`, `bodyStatsService.ts:87-89` | ~3 lines × 3 |
| **Recovery score calculation** | `bodyStatsService.ts:353-393`, `recoveryService.ts:71-117` | ~45 lines × 2 (one is dead code) |
| **Body areas list** | `bodyStatsService.ts:455-470`, `recoveryService.ts:50-65` | ~16 lines × 2 (one is dead code) |
| **Sync payload construction for meals** | `nutritionService.ts:636-656`, `nutritionService.ts:675-695`, `nutritionService.ts:708-729` | ~20 lines × 3 |
| **`dbGetAll + filter` query pattern** | `nutritionService.ts:743-744`, `nutritionService.ts:751-752`, `waterService.ts:51-52`, `waterService.ts:57-58`, `waterService.ts:65-66`, `bodyStatsService.ts:148-151` | ~5 lines × 8 |

### 2.4 Supabase Sync Reliability & Conflict Resolution

**Current strategy: Last-write-wins (LWW) via `upsert` with `onConflict: 'id'`.**

This is the simplest possible sync strategy and has several failure modes:

1. **Silent data loss on concurrent edits**: If a user edits a workout on their phone (offline) and their tablet (online), the last device to sync overwrites the other's changes with no merge or notification.

2. **No `updated_at` comparison**: The sync layer doesn't check whether the cloud version is newer before overwriting. A stale client can regress data.

3. **No tombstones for deletes**: `deleteCloud*` functions perform hard deletes. If a device is offline when a record is deleted, then comes online and syncs, the deleted record may be re-upserted by another device's pending queue.

4. **`syncAllData` is push-only**: It pushes all local data to the cloud but doesn't pull first. If the cloud has newer data, it's overwritten by potentially stale local data.

5. **No sync versioning**: There's no sync generation counter or vector clock. The system cannot detect or resolve divergent histories.

**Recommendation**: Implement at minimum:
- `updated_at` comparison on upsert (skip if cloud is newer)
- Tombstone table for deletes (soft-delete with TTL)
- Pull-before-push in `syncAllData`
- Conflict detection with user notification

### 2.5 Offline Queue Robustness

**The `offlineQueue.ts` is well-designed but has an adoption problem:**

| Aspect | Status |
|--------|--------|
| Persistent storage (separate IDB) | ✅ Good |
| Error classification (retriable vs permanent) | ✅ Good |
| Dedup (same record = same queue entry) | ✅ Good |
| Max retries with backoff | ✅ Good (5 retries, but no backoff between retries) |
| Auto-process on `online` event | ✅ Good |
| Startup processing | ✅ Good |
| **Used by domain services** | ❌ **No** — `nutritionService`, `bodyStatsService`, `waterService` all use `syncWithRetry` from `indexedDBCore.ts` instead |

The `syncWithRetry` mechanism in `indexedDBCore.ts` is an **in-memory retry with exponential backoff** — if the page is closed during retry, the mutation is lost. The `offlineQueue` persists mutations to IDB so they survive page reloads. The domain services should be migrated to use `offlineQueue` instead of `syncWithRetry`.

**Missing features**:
- No backoff between retries (retries happen immediately in sequence)
- No dead-letter queue for permanently failed mutations (they're just dropped)
- No user-facing indicator of pending mutations
- No integration with `syncAllData` / `pullAllData`

### 2.6 Error Handling Consistency

The error handling across domain services is **inconsistent in four dimensions**:

| Service | IDB Write Error | Sync Error | Validation Error |
|---------|----------------|------------|-----------------|
| `analyticsService` | `catch { sessions = []; }` (silent swallow) | N/A (read-only) | None |
| `nutritionService` | Thrown by IDB (unhandled by service) | Fire-and-forget in `addFoodFromPreset`; `syncWithRetry` elsewhere | None |
| `bodyStatsService` | Thrown by IDB (unhandled by service) | `syncWithRetry` | `ValidationError` for weight range |
| `waterService` | Thrown by IDB (unhandled by service) | Inline throw (no retry) | None |
| `trainingLoadService` | N/A (pure computation) | N/A | None |
| `supabaseAuth` | N/A | `logger.error` + return `{ error }` | Password strength checks |
| `supabaseSync` | N/A | `logger.error` + `throw error` | None |
| `offlineQueue` | `logger.error` (best-effort enqueue) | Error classification + retry | None |
| `notificationService` | N/A | N/A | None |

**Key gaps**:
- No service-level error boundary — IDB errors propagate uncaught to callers
- `nutritionService` and `waterService` don't log sync failures
- `analyticsService` silently returns empty data on IDB failure
- No standardized error type for sync failures (some throw raw `Error`, some throw Supabase error objects)

### 2.7 Test Coverage Gaps

| Service | Test File | Coverage Assessment |
|---------|-----------|---------------------|
| `analyticsService` | ❌ None | **No tests** for an 857-line file with complex math (linear regression, ISO weeks, PR detection, forecasting). High risk of regressions. |
| `nutritionService` | ❌ None | **No tests** for CRUD, macro calculations, presets, or weekly summaries. |
| `bodyStatsService` | ✅ [`bodyStatsService.test.ts`](src/services/__tests__/bodyStatsService.test.ts) (84 lines) | Covers recovery CRUD and `calculateRecoveryScore`. **Missing**: body weight CRUD, body measurements, `calculateWeightTrend`, `calculateBMI`, `getBMICategory`. |
| `recoveryService` | ❌ None | Dead code — testing it would be wasteful. Delete the file instead. |
| `waterService` | ❌ None | **No tests** for water tracking CRUD or sync. |
| `trainingLoadService` | ✅ [`trainingLoadService.test.ts`](src/services/__tests__/trainingLoadService.test.ts) (142 lines) | Good coverage of `calculateTrainingLoad` with various scenarios. |
| `supabaseAuth` | ❌ None | **No tests** for auth flows, session expiry detection, or sign-out cleanup. Critical for security. |
| `supabaseSync` | ❌ None | **No tests** for 1312 lines of sync logic, type mappers, or real-time subscriptions. |
| `offlineQueue` | ❌ None | **No tests** for error classification, dedup, queue processing, or retry logic. |
| `notificationService` | ❌ None | **No tests** for config persistence, permission handling, or notification display. |
| `webVitals` | ✅ [`webVitals.test.ts`](src/test/webVitals.test.ts) (43 lines) | Good — verifies all metrics initialized and custom handler support. |

**Summary**: 3 of 11 services have tests. The remaining 8 (including the 1312-line sync monolith and the 857-line analytics service) have **zero test coverage**.

---

## 3. Prioritized Recommendations

### P0 — Critical (Fix immediately)

| # | Recommendation | Impact |
|---|----------------|--------|
| 1 | **Delete `recoveryService.ts`** — 278 lines of dead, duplicated code. | Reduces confusion, eliminates type divergence risk. |
| 2 | **Split `bodyStatsService.ts`** into `bodyWeightService.ts`, `bodyMeasurementService.ts`, `recoveryService.ts`. Move `RecoveryLog` interface and `calculateRecoveryScore` to the new recovery service. | SRP compliance, reduces import coupling. |
| 3 | **Add `updated_at` comparison to Supabase upserts** — skip write if cloud `updated_at` > local `updated_at`. | Prevents silent data loss from concurrent edits. |
| 4 | **Migrate domain services from `syncWithRetry` to `offlineQueue`** — nutrition, body stats, water, and recovery should queue mutations through the persistent offline queue. | Survives page reloads, better error classification. |

### P1 — High (Fix this sprint)

| # | Recommendation | Impact |
|---|----------------|--------|
| 5 | **Extract shared utilities** — create `src/services/utils/fitness-math.ts` with `setVolume()`, `sessionVolume()`, `muscleKey()`, `estimate1RM()`. Create `src/utils/dateUtils.ts:addTodayStr()`. Create `src/utils/id.ts` with `generateId()` using `crypto.randomUUID()`. | Eliminates ~100 lines of duplication across 4 files. |
| 6 | **Create generic sync CRUD factory** — `createEntitySync<T>(table, toRow, fromRow)` returns `{ sync, fetch, delete }`. Reduces `supabaseSync.ts` from 1312 lines to ~200. | Dramatic complexity reduction, single source of truth for sync pattern. |
| 7 | **Extract food library to JSON** — move the 40-item `FOOD_LIBRARY` array and `MEAL_PRESETS` from `nutritionService.ts` to `src/data/foodLibrary.json`. | Reduces service file from 884 to ~400 lines, enables non-code food management. |
| 8 | **Fix `syncAllData` to use `Promise.allSettled`** — partial failures should not abort the entire sync. | Prevents data loss from single-record failures. |
| 9 | **Add `pullAllData` before `syncAllData`** — always pull latest from cloud before pushing local changes. | Prevents stale local data from overwriting newer cloud data. |

### P2 — Medium (Fix next sprint)

| # | Recommendation | Impact |
|---|----------------|--------|
| 10 | **Replace `new Notification()` with Service Worker push** — integrate with the PWA service worker for persistent notifications. | Enables notifications when app is closed. |
| 11 | **Add IndexedDB indexes on `date` fields** — `nutrition_logs`, `water_logs`, `body_weight`, `recovery_logs` all filter by date. Add IDB indexes to avoid full-table scans. | Performance improvement for date-range queries. |
| 12 | **Add tests for `analyticsService`** — the linear regression, ISO week calculation, and PR detection algorithms are complex and currently untested. | Prevents regression in core Progress page functionality. |
| 13 | **Add tests for `offlineQueue`** — error classification, dedup, and retry logic are critical for data integrity. | Ensures offline reliability. |
| 14 | **Standardize error handling** — adopt a pattern: IDB errors throw `StorageError`, sync errors throw `SyncError`, validation throws `ValidationError`. All services log via `logger.*`. | Consistent error UX across the app. |
| 15 | **Move `MEAL_TYPE_ICONS` and `MEAL_TYPE_LABELS`** from `nutritionService.ts` to a UI constants file. | Removes React component imports from a data service. |

### P3 — Low (Backlog)

| # | Recommendation | Impact |
|---|----------------|--------|
| 16 | **Remove backward-compat shims** — `getMuscleGroupDistribution` alias (analyticsService:352), `LegacyRecoveryScore` type (bodyStatsService:71), `initSupabaseAuth` no-op (supabaseAuth:59), `TIGHTNESS_AREAS` alias (bodyStatsService:473). | Reduces dead code surface. |
| 17 | **Add backoff to `offlineQueue` retries** — currently retries happen immediately in sequence. Add exponential backoff (1s, 2s, 4s, 8s, 16s). | Reduces server load during outages. |
| 18 | **Add dead-letter queue** — permanently failed mutations (exceeded retries, non-retriable errors) should be preserved for debugging, not silently dropped. | Improves observability. |
| 19 | **Domain services should emit domain events** — instead of directly calling sync functions, emit events like `meal:created`, `weight:recorded` that a sync subscriber handles. | Further decouples CRUD from sync. |

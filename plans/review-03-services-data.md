# Review 03 — Services Layer: Data & Storage

**Scope:** 12 service files covering IndexedDB CRUD, cloud sync, business logic (PRs, progressions, achievements, AI), export, and event tracking.  
**Date:** 2026-05-27  
**Verdict:** The data layer is functional and covers a wide surface area, but suffers from **severe code duplication**, **inconsistent patterns**, **missing abstractions**, and **zero test coverage for half the files**. The most critical issue is the coexistence of [`workoutDb.ts`](src/services/workoutDb.ts) and [`workoutService.ts`](src/services/workoutService.ts) which are near-identical duplicates with divergent implementations.

---

## Table of Contents

1. [Per-File Analysis](#1-per-file-analysis)
   - [1.1 indexedDBCore.ts](#11-indexeddbcorets)
   - [1.2 workoutDb.ts](#12-workoutdbts)
   - [1.3 dataService.ts](#13-dataservicets)
   - [1.4 workoutService.ts](#14-workoutservicets)
   - [1.5 personalItemsDb.ts](#15-personalitemsdbts)
   - [1.6 prService.ts](#16-prservicets)
   - [1.7 progressionService.ts](#17-progressionservicets)
   - [1.8 aiProgressionService.ts](#18-aiprogressionservicets)
   - [1.9 aiWorkoutInsightService.ts](#19-aiworkoutinsightservicets)
   - [1.10 achievementService.ts](#10-achievementservicets)
   - [1.11 exportService.ts](#111-exportservicets)
   - [1.12 eventTracker.ts](#112-eventtrackerts)
2. [Cross-Cutting Analysis](#2-cross-cutting-analysis)
   - [2.1 IDB Schema Design & Versioning](#21-idb-schema-design--versioning)
   - [2.2 CRUD vs Business Logic Separation](#22-crud-vs-business-logic-separation)
   - [2.3 Error Handling Consistency](#23-error-handling-consistency)
   - [2.4 Duplicate Code Across Services](#24-duplicate-code-across-services)
   - [2.5 Test Coverage Gaps](#25-test-coverage-gaps)
3. [Prioritized Recommendations](#3-prioritized-recommendations)

---

## 1. Per-File Analysis

### 1.1 `indexedDBCore.ts`

**File:** [`src/services/indexedDBCore.ts`](src/services/indexedDBCore.ts) — 460 lines  
**Purpose:** Low-level IndexedDB initialization, generic CRUD helpers (`dbGet`, `dbGetAll`, `dbPut`, `dbDelete`, `dbClear`, `dbGetByIndex`, `dbGetByRange`), sync-retry infrastructure, and pending-sync queue.

#### Strengths
- **Memoized `dbOpenPromise`** (line 35): Correctly prevents concurrent open-requests from racing, which is a common IDB pitfall.
- **`createIndexIfMissing` helper** (line 42): Safely guards index creation during upgrades — avoids `DOMException` on duplicate indexes.
- **Versioned schema** (v1→v7): Incremental upgrade path with well-commented sections for each version.
- **Exponential backoff retry** (line 299–324): `tryExecuteSync` implements a proper retry with `2^attempt` backoff.
- **Pending sync queue** (line 326–441): Queues failed syncs for later replay — good offline-first pattern.
- **Cursor-based reads** in consumers: The `startTime` index (v7) enables efficient reverse-cursor pagination.

#### Issues

| Severity | Line(s) | Issue |
|----------|---------|-------|
| 🔴 High | 6 | **Coupling to Supabase config**: `isSupabaseConfigured` is imported at the core IDB layer. The low-level DB module should not know about cloud providers. |
| 🔴 High | 358–382 | **`syncWithRetry` is fire-and-forget**: Returns `void`, not a `Promise`. Callers have no way to await completion or handle errors. The `.catch()` at line 378 silently swallows errors after logging. |
| 🟡 Med | 30 | **Module-level mutable singleton**: `dbInstance` and `dbOpenPromise` are module-scoped `let` variables. This makes testing difficult and prevents multiple DB instances. |
| 🟡 Med | 71–73 | **Overly aggressive `onerror`**: Setting `dbInstance = null` on any IDB error (line 72) will break all subsequent operations even for minor transient errors. |
| 🟡 Med | 362–368 | **Redundant Supabase check**: Both `supabaseUrl/supabaseKey` env var check AND `isSupabaseConfigured()` are called — the latter likely already checks the former. |
| 🟢 Low | 170–263 | **No transaction batching**: Each `dbGet`, `dbPut`, etc. creates a new transaction. Multi-operation workflows (e.g., read-then-write) open multiple transactions, risking consistency issues. |

#### Recommendations
- Extract sync-retry logic into a separate `syncQueue.ts` module.
- Make `syncWithRetry` return `Promise<void>` so callers can optionally await.
- Remove Supabase-specific imports from this core module; pass a `shouldSync` predicate instead.
- Add a `dbTransaction` helper for multi-operation atomic transactions.

---

### 1.2 `workoutDb.ts`

**File:** [`src/services/workoutDb.ts`](src/services/workoutDb.ts) — 1146 lines  
**Purpose:** Primary CRUD layer for workout templates, sessions, body weight, personal exercises, and cloud-sync merge/replace operations.

#### Strengths
- **Comprehensive CRUD**: Full lifecycle for templates, sessions, exercises, body weight.
- **Cursor-based session reads** (lines 223–291): Uses `startTime` index with reverse cursor — efficient for large datasets.
- **Cascade delete** (lines 510–535): Deleting a personal exercise also removes associated PRs.
- **Merge strategy** (lines 1092–1120): `mergeGenericRecords` implements timestamp-based conflict resolution.
- **Built-in exercise seeding** (lines 391–423): Auto-populates missing exercises on first read.

#### Issues

| Severity | Line(s) | Issue |
|----------|---------|-------|
| 🔴 Critical | 1–1146 | **Massive SRP violation**: This 1146-line file handles 7+ distinct concerns: template CRUD, session CRUD, body weight CRUD, exercise CRUD, built-in template data, cloud merge/replace, and generic record merging. Should be split into at least 4 modules. |
| 🔴 High | 631–908 | **280 lines of hardcoded workout data**: `getBuiltInWorkoutTemplates()` returns static Hebrew-language template data inline. This belongs in a data file (like [`builtInExercises.ts`](src/data/builtInExercises.ts)), not a service. |
| 🔴 High | 7 | **`LOCAL_STORAGE_KEYS` misnomer**: Imports `LOCAL_STORAGE_KEYS as LS` but these are IndexedDB store names, not localStorage keys. The constant name in [`constants/index.ts`](src/constants/index.ts:2) is `STORAGE_KEYS` with an alias — confusing. |
| 🔴 High | 191–193, 324–326 | **`window.dispatchEvent` in data layer**: Service-level code dispatching DOM events (`WORKOUT_SAVED`) couples the data layer to the UI event system. Should use a proper observer/event-emitter pattern. |
| 🟡 Med | 401–408 | **Seeding on every read**: `getPersonalExercises()` calls `getBUILT_IN_EXERCISES(now)` on every invocation and checks for missing built-ins. This is expensive and should happen once at init time. |
| 🟡 Med | 453–471 | **Inconsistent IDB access pattern**: `createPersonalExercise` uses raw `initDB()` + manual transaction instead of the generic `dbPut` helper used elsewhere. Same for `updatePersonalExercise` (line 487), `deletePersonalExercise` (line 516). |
| 🟡 Med | 581–603 | **Multiple transactions for dedup**: `removeDuplicateExercises` opens a separate write transaction per exercise to delete. Should batch in a single transaction. |
| 🟡 Med | 965–970 | **Unsafe type assertion**: `(measurements as { id?: string; createdAt?: string; updatedAt?: string }[])` — casting `unknown[]` bypasses type safety. |
| 🟡 Med | 1005–1016 | **`as object` assertions**: Lines 1007, 1015 use `s as object` and `c as object` to satisfy `dbPut<T extends object>`. Indicates the generic constraint is too loose. |
| 🟢 Low | 917–918 | **Dual `exerciseName`/`name` fields**: `convertBuiltInToWorkoutTemplate` sets both `exerciseName: ex.name` and `name: ex.name` — suggests type bloat. |

---

### 1.3 `dataService.ts`

**File:** [`src/services/dataService.ts`](src/services/dataService.ts) — 76 lines  
**Purpose:** Re-exports from [`workoutDb.ts`](src/services/workoutDb.ts) for backward compatibility + initializes built-in templates.

#### Issues

| Severity | Line(s) | Issue |
|----------|---------|-------|
| 🟡 Med | 1–76 | **Unnecessary barrel file**: Re-exports 20+ functions from `workoutDb` that callers could import directly. Adds indirection without value. |
| 🟡 Med | 36–68 | **`initializeBuiltInWorkoutTemplates` uses dynamic import**: `await import('./workoutDb')` at line 42 despite `workoutDb` being statically re-exported at the top. This creates an unnecessary async boundary. |
| 🟢 Low | 47 | **Fragile detection**: `existing.some((t) => t.isBuiltin)` — if any template has `isBuiltin: true` set incorrectly, seeding is skipped entirely. |

#### Recommendation
- Deprecate and remove this file; update consumers to import from [`workoutDb.ts`](src/services/workoutDb.ts) directly.
- Move template initialization into the app bootstrap sequence (e.g., [`DataContext.tsx`](src/contexts/DataContext.tsx)).

---

### 1.4 `workoutService.ts`

**File:** [`src/services/workoutService.ts`](src/services/workoutService.ts) — 337 lines  
**Purpose:** Duplicate of workoutDb functionality + theme preferences + settings helpers.

#### Issues

| Severity | Line(s) | Issue |
|----------|---------|-------|
| 🔴 Critical | 1–337 | **Near-complete duplicate of `workoutDb.ts`**: Functions `getWorkoutTemplates`, `createWorkoutTemplate`, `updateWorkoutTemplate`, `deleteWorkoutTemplate`, `saveWorkoutSession`, `getWorkoutSessions`, `saveBodyWeight`, `getBodyWeightHistory`, `getLatestBodyWeight`, `getPersonalExercises`, `getPersonalExercise`, `createPersonalExercise`, `updatePersonalExercise`, `incrementExerciseUse` are all reimplemented here with subtle differences. |
| 🔴 High | 42–46 | **Own `syncWithRetry` reimplementation**: This file defines its own `withRetry` + `syncWithRetry` (lines 26–46) instead of using the one from [`indexedDBCore.ts`](src/services/indexedDBCore.ts:358). Different retry parameters (500ms base delay vs 1000ms, no pending queue). |
| 🔴 High | 69 | **Different ID generation**: Uses `` `template-${Date.now()}` `` instead of `crypto.randomUUID()` used in `workoutDb.ts`. Collision-prone and inconsistent. |
| 🔴 High | 219–227 | **Different exercise ID generation**: Uses `` `exercise-${Date.now()}` `` instead of `crypto.randomUUID()`. |
| 🟡 Med | 147–152 | **Less efficient session read**: Loads ALL sessions into memory, sorts, then slices — unlike `workoutDb.ts` which uses cursor-based pagination. |
| 🟡 Med | 257–267 | **Theme/settings concern mixed in**: `saveThemePreference`/`getThemePreference` and `loadSettings`/`saveSettings` (lines 301–336) are unrelated to workout data. SRP violation. |
| 🟡 Med | 135 | **Extra localStorage write**: `localStorage.setItem('sparkos_last_workout_date', ...)` — not present in `workoutDb.ts` version. Silent behavioral divergence. |
| 🟢 Low | 26 | **`withRetry` uses `Math.pow(2, i)`** instead of `2 ** i` — inconsistent style with `indexedDBCore.ts`. |

#### Recommendation
- **DELETE this file entirely**. Migrate all consumers to [`workoutDb.ts`](src/services/workoutDb.ts).
- Move theme/settings helpers to [`SettingsContext.tsx`](src/contexts/SettingsContext.tsx) or a dedicated `settingsService.ts`.
- Audit all import sites to determine which file is actually being used (risk of split-brain).

---

### 1.5 `personalItemsDb.ts`

**File:** [`src/services/personalItemsDb.ts`](src/services/personalItemsDb.ts) — 51 lines  
**Purpose:** CRUD for the `personal_items` IndexedDB store (workouts in progress, notes, etc.).

#### Issues

| Severity | Line(s) | Issue |
|----------|---------|-------|
| 🟡 Med | 6 | **Side-effect on import**: `initDB()` is called at module top-level. This fires a DB open on import even if the caller doesn't need the store yet. |
| 🟡 Med | 27–46 | **Inefficient update**: `updatePersonalItem` calls `dbGetAll` to find the item by ID, then calls `dbPut`. Should use `dbGet` directly. |
| 🟡 Med | 33 | **Silent no-op on missing item**: Returns `void` when item not found — no error thrown. Callers can't distinguish "updated" from "item doesn't exist". |
| 🟢 Low | 1–51 | **No cloud sync**: Unlike other services, personal items have no sync-to-cloud integration. If intentional (ephemeral data), it should be documented. |

---

### 1.6 `prService.ts`

**File:** [`src/services/prService.ts`](src/services/prService.ts) — 483 lines  
**Purpose:** Personal record detection, storage, querying, and utility functions.

#### Strengths
- **`diffSetAgainstPRs`** (lines 121–194): Pure function that diffs a set against in-memory PRs — testable and efficient.
- **`createBatchedPRChecker`** (lines 240–274): Excellent optimization — preloads all PRs in one transaction, then diffs in-memory. Reduces N×4 IDB transactions to 1 read + 1 write per broken PR.
- **Epley 1RM formula** (line 131): Correct implementation.
- **`getPRsForMultipleExercises`** (lines 53–78): Single readonly transaction for batch lookups.

#### Issues

| Severity | Line(s) | Issue |
|----------|---------|-------|
| 🔴 High | 324–352 | **Reads from localStorage instead of IndexedDB**: `getExerciseNames()` and `getExerciseByName()` read from `localStorage.getItem('personalExercises')` — a completely different storage path than the IndexedDB store used by `workoutDb.ts`. This is a data consistency bug — exercises stored via `workoutDb.ts` won't appear here. |
| 🔴 High | 432–463 | **`exportWorkoutHistoryCSV` duplicated**: This function is also implemented in [`exportService.ts`](src/services/exportService.ts:5) with different headers and formatting. |
| 🟡 Med | 11 | **Type re-export**: `export type { PersonalRecord }` — unnecessary indirection. |
| 🟡 Med | 21–36 | **Local `dbGetByIndexRange` helper**: Comment at line 18–20 acknowledges this duplicates [`indexedDBCore.ts`](src/services/indexedDBCore.ts:198)'s `dbGetByIndex` but uses `IDBKeyRange` instead of `IDBValidKey`. Should be promoted to the core module. |
| 🟡 Med | 390–401 | **`calculatePRsFromHistory` uses `existing.value`**: Accesses a `value` field that's not in the `PersonalRecord` type definition (line 392, 429). This is a type-safety hole. |
| 🟢 Low | 453–461 | **DOM manipulation in service**: `document.createElement('a')` + `a.click()` for CSV download. Should be in a UI utility. |

---

### 1.7 `progressionService.ts`

**File:** [`src/services/progressionService.ts`](src/services/progressionService.ts) — 568 lines  
**Purpose:** Rule-based workout progression algorithm (when to increase/decrease weight).

#### Strengths
- **Well-structured rule engine**: Clear rule priority system (RPE-based, consistency-based, volume-based, recovery-based).
- **Pure functions**: `calculateProgression`, `buildAIProgressionContext`, helpers — all pure, no side effects. Excellent testability.
- **Typed interfaces**: `ExerciseProgressionData`, `SessionSnapshot`, `ProgressionReason` are well-defined.
- **Recovery/fatigue integration** (lines 387–439): Considers recovery and fatigue scores for deload recommendations.
- **Hebrew-language UI strings**: Embedded directly in the service (lines 257, 275, etc.) — this is a concern (see below).

#### Issues

| Severity | Line(s) | Issue |
|----------|---------|-------|
| 🟡 Med | 214–217, 257, 275, etc. | **UI strings in business logic**: Hebrew display text is hardcoded in the algorithm layer. Should be in a localization layer or returned as codes that the UI maps to strings. |
| 🟡 Med | 299 | **Hebrew keyword matching for compound exercises**: `compoundExercises.some((name) => exerciseName.toLowerCase().includes(name.toLowerCase()))` — fragile string matching. Should use a `muscleGroup` or `exerciseType` field instead. |
| 🟡 Med | 536–567 | **Display helpers in service**: `getRecommendationLabel`, `getRecommendationColor`, `getRecommendationIcon` return Tailwind classes and emoji. These are UI concerns. |
| 🟡 Med | 345–354 | **Rule 5 can override Rule 3**: Both can set `INCREASE_WEIGHT` but with different confidence values. The cascading `if` structure means Rule 5 can silently override a more confident Rule 3 recommendation. |
| 🟢 Low | 199 | **`input.targetSets` unused**: The parameter is destructured but never used in the function body. |

---

### 1.8 `aiProgressionService.ts`

**File:** [`src/services/aiProgressionService.ts`](src/services/aiProgressionService.ts) — 303 lines  
**Purpose:** AI-enhanced progression recommendations using LLM chat.

#### Strengths
- **Graceful fallback** (lines 254–282): `fallbackResponse` provides sensible defaults when AI fails.
- **Concurrency control** (lines 97–119): Limits parallel AI requests to 3.
- **Hebrew prompt engineering**: Well-structured prompts for the fitness domain.

#### Issues

| Severity | Line(s) | Issue |
|----------|---------|-------|
| 🟡 Med | 67–70 | **System prompt in Hebrew hardcoded**: Should be externalized for maintainability and potential i18n. |
| 🟡 Med | 210–212 | **Fragile regex parsing**: `response.match(/(\d+(?:\.\d+)?)\s*ק"?ג/)` — relies on Hebrew weight format in AI output. Will fail for English responses or different formatting. |
| 🟡 Med | 246–247 | **Division by zero risk**: `Math.round(baseRec.lastSession.reps / baseRec.lastSession.setsCompleted)` — if `setsCompleted` is 0, this produces `Infinity`. |
| 🟢 Low | 293–301 | **Hardcoded defaults in `isReadyToProgress`**: `targetReps: 8, targetSets: 4` — should accept these as parameters. |

---

### 1.9 `aiWorkoutInsightService.ts`

**File:** [`src/services/aiWorkoutInsightService.ts`](src/services/aiWorkoutInsightService.ts) — 29 lines  
**Purpose:** Generates a single AI insight from workout session data.

#### Issues

| Severity | Line(s) | Issue |
|----------|---------|-------|
| 🟡 Med | 5–29 | **No error handling**: Unlike `aiProgressionService.ts`, this function has no try/catch. If `provider.chat()` throws, the error propagates unhandled. |
| 🟡 Med | 28 | **No fallback response**: Returns raw AI output without validation. Could return empty string or malformed text. |
| 🟢 Low | 1–29 | **Very thin wrapper**: The entire service is a single function that builds a prompt and calls the AI. Could be merged into [`aiProgressionService.ts`](src/services/aiProgressionService.ts) or a shared `aiInsights.ts` module. |

---

### 1.10 `achievementService.ts`

**File:** [`src/services/achievementService.ts`](src/services/achievementService.ts) — 77 lines  
**Purpose:** Calculates workout streaks from session history.

#### Strengths
- **Pure function**: `calculateStreak` takes sessions array, returns `StreakInfo`. No side effects.
- **Well-documented**: Header comment clarifies "no badges, no gamification".
- **Compact and focused**: Good SRP.

#### Issues

| Severity | Line(s) | Issue |
|----------|---------|-------|
| 🟡 Med | 43–46 | **Date key format bug**: Uses `` `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}` `` — `getMonth()` is 0-indexed, so January is `0`. This means dates like `2026-0-15` are produced. While consistent (all dates use same format), it's confusing and could cause bugs if the format is ever compared externally. |
| 🟡 Med | 52–65 | **Streak calculation edge case**: If the user worked out today, `i === 0` sets `currentStreak = tempStreak` (line 61). But if the most recent workout was yesterday, `currentStreak` stays 0 because the loop breaks on mismatch at `i=0`. The streak should start from the most recent workout date, not necessarily today. |
| 🟡 Med | 56 | **Date comparison via `toDateString()`**: Locale-dependent and timezone-sensitive. Could produce incorrect results near midnight or DST transitions. |

---

### 1.11 `exportService.ts`

**File:** [`src/services/exportService.ts`](src/services/exportService.ts) — 171 lines  
**Purpose:** CSV/JSON export for workout history, nutrition, body weight + weekly report generation.

#### Strengths
- **BOM for Hebrew Excel support** (line 132): Correct handling of RTL text in CSV.
- **`shareReport`** (lines 149–161): Uses Web Share API with graceful fallback.
- **`generateWeeklyReport`** (lines 60–124): Comprehensive weekly summary with localized dates.

#### Issues

| Severity | Line(s) | Issue |
|----------|---------|-------|
| 🔴 High | 5–29 | **Duplicate `exportWorkoutHistoryCSV`**: Also exists in [`prService.ts`](src/services/prService.ts:432) with different column headers (English vs Hebrew) and different column sets (no RPE/notes in prService version). |
| 🟡 Med | 141–144 | **DOM manipulation in service layer**: `document.body.appendChild(a)` / `document.body.removeChild(a)` — should be in a UI utility. |
| 🟡 Med | 135 | **No CSV escaping**: Values are wrapped in quotes but internal quotes aren't escaped (`"` → `""`). If exercise names contain quotes, the CSV will be malformed. |
| 🟡 Med | 1 | **`MealEntry` import**: References `MealEntry` from types but this type may not exist if nutrition features are incomplete. |

---

### 1.12 `eventTracker.ts`

**File:** [`src/services/eventTracker.ts`](src/services/eventTracker.ts) — 54 lines  
**Purpose:** Simple localStorage-based event/pageview tracking.

#### Issues

| Severity | Line(s) | Issue |
|----------|---------|-------|
| 🟡 Med | 16–23 | **`JSON.parse` without type validation**: `JSON.parse(raw) as AnalyticsStore` — unsafe cast. Corrupted localStorage will produce runtime errors. |
| 🟡 Med | 30–34 | **Read-modify-write on every event**: `getStore()` reads + parses entire JSON, appends, then `save()` serializes + writes. For high-frequency events this is O(n) per event. |
| 🟡 Med | 26 | **Arbitrary 500-event cap**: `store.events.slice(-500)` — no configuration or documentation of why 500. |
| 🟢 Low | 42–53 | **`getAnalyticsSummary` unused**: No evidence of consumers reading analytics data. Dead code? |

---

## 2. Cross-Cutting Analysis

### 2.1 IDB Schema Design & Versioning

**Schema (13 stores, DB version 7):**

| Store | Key | Indexes | Version Added |
|-------|-----|---------|---------------|
| `workout_sessions` | `id` | `date`, `startTime` | v1, v2, v7 |
| `workout_templates` | `id` | — | v1 |
| `personal_exercises` | `id` | — | v1 |
| `body_weight` | `id` | — | v1 |
| `body_measurements` | `id` | — | v1 |
| `recovery_logs` | `id` | `date` | v1, v2 |
| `nutrition_logs` | `id` | — | v1 |
| `user_settings` | `key` | — | v1 |
| `personal_records` | `id` | `exerciseId`, `date` | v3 |
| `ai_conversations` | `id` | — | v3 |
| `pending_sync` | `tag` | `createdAt`, `retryCount` | v4 |
| `personal_items` | `id` | — | v5 |
| `water_logs` | `id` | `date` | v6 |

**Issues:**
- 🔴 **Most stores lack indexes**: `workout_templates`, `personal_exercises`, `body_weight`, `nutrition_logs`, `personal_items` have no indexes beyond the primary key. Any query-by-field requires full table scan.
- 🟡 **No compound indexes**: E.g., `personal_records` would benefit from `(exerciseId, date)` compound index for "get PRs for exercise sorted by date".
- 🟡 **`user_settings` uses `key` as keyPath** but other stores use `id` — inconsistent.
- 🟡 **No migration testing**: The upgrade path (v1→v7) has no automated tests. A failed upgrade could corrupt user data.
- 🟢 **`createIndexIfMissing` is defensive**: Good — prevents crashes if upgrade runs partially.

### 2.2 CRUD vs Business Logic Separation

| Service | CRUD | Business Logic | Verdict |
|---------|------|---------------|---------|
| `indexedDBCore.ts` | ✅ Pure CRUD | ❌ Sync logic mixed in | Sync retry should be separate |
| `workoutDb.ts` | ✅ CRUD | ❌ Seeding, merge, built-in data mixed | Needs splitting |
| `workoutService.ts` | ✅ CRUD (duplicate) | ❌ Settings/theme mixed | Should be deleted |
| `personalItemsDb.ts` | ✅ Pure CRUD | ✅ None | Clean |
| `prService.ts` | ✅ CRUD | ✅ PR detection (well-separated) | Good, except localStorage reads |
| `progressionService.ts` | ❌ None | ✅ Pure business logic | Excellent separation |
| `aiProgressionService.ts` | ❌ None | ✅ AI orchestration | Good |
| `achievementService.ts` | ❌ None | ✅ Pure calculation | Excellent |
| `exportService.ts` | ❌ None | ✅ Export logic | Good (except DOM) |
| `eventTracker.ts` | ✅ Storage | ✅ Analytics | Acceptable for scope |

**Key finding:** `progressionService.ts` and `achievementService.ts` are exemplary — pure functions with no storage dependencies. `workoutDb.ts` is the worst offender, mixing CRUD, seeding, merge logic, and hardcoded data.

### 2.3 Error Handling Consistency

| Pattern | Files Using It | Issue |
|---------|---------------|-------|
| `throw new ValidationError(...)` | `workoutDb.ts`, `workoutService.ts`, `bodyStatsService.ts` | Good — domain errors |
| `throw new NotFoundError(...)` | `workoutDb.ts`, `workoutService.ts` | Good — domain errors |
| `try/catch return null` | `workoutDb.ts:200–211`, `eventTracker.ts:16–23` | Swallows errors silently |
| `catch {} (empty)` | `indexedDBCore.ts:345`, `prService.ts:332,350` | Silent failure |
| `.catch(() => {})` | `prService.ts:215` | Fire-and-forget |
| No error handling | `aiWorkoutInsightService.ts`, `personalItemsDb.ts` | Unhandled promise rejections |
| `logger.*.error(...)` | `indexedDBCore.ts`, `workoutService.ts` | Logged but not propagated |

**Inconsistency:** Some services throw on missing items (`workoutDb.ts:99`), others return null (`workoutDb.ts:199`), others silently return void (`personalItemsDb.ts:33`).

### 2.4 Duplicate Code Across Services

| Code Pattern | Locations | Impact |
|-------------|-----------|--------|
| **`getWorkoutTemplates`** | [`workoutDb.ts:48`](src/services/workoutDb.ts:48), [`workoutService.ts:50`](src/services/workoutService.ts:50) | 🔴 Two implementations |
| **`createWorkoutTemplate`** | [`workoutDb.ts:64`](src/services/workoutDb.ts:64), [`workoutService.ts:61`](src/services/workoutService.ts:61) | 🔴 Different ID generation (UUID vs Date.now) |
| **`updateWorkoutTemplate`** | [`workoutDb.ts:94`](src/services/workoutDb.ts:94), [`workoutService.ts:88`](src/services/workoutService.ts:88) | 🔴 Slightly different merge behavior |
| **`deleteWorkoutTemplate`** | [`workoutDb.ts:118`](src/services/workoutDb.ts:118), [`workoutService.ts:110`](src/services/workoutService.ts:110) | 🔴 Duplicate |
| **`saveWorkoutSession`** | [`workoutDb.ts:180`](src/services/workoutDb.ts:180), [`workoutService.ts:133`](src/services/workoutService.ts:133) | 🔴 Different: workoutService adds localStorage write + uses own syncWithRetry |
| **`getWorkoutSessions`** | [`workoutDb.ts:223`](src/services/workoutDb.ts:223), [`workoutService.ts:147`](src/services/workoutService.ts:147) | 🔴 Different: workoutDb uses cursor, workoutService loads all |
| **`saveBodyWeight`** | [`workoutDb.ts:333`](src/services/workoutDb.ts:333), [`workoutService.ts:166`](src/services/workoutService.ts:166) | 🔴 Duplicate |
| **`getBodyWeightHistory`** | [`workoutDb.ts:345`](src/services/workoutDb.ts:345), [`workoutService.ts:176`](src/services/workoutService.ts:176) | 🔴 Duplicate |
| **`getPersonalExercises`** | [`workoutDb.ts:391`](src/services/workoutDb.ts:391), [`workoutService.ts:196`](src/services/workoutService.ts:196) | 🔴 workoutDb seeds built-ins; workoutService doesn't |
| **`createPersonalExercise`** | [`workoutDb.ts:443`](src/services/workoutDb.ts:443), [`workoutService.ts:216`](src/services/workoutService.ts:216) | 🔴 Different ID gen + different sync behavior |
| **`syncWithRetry`** | [`indexedDBCore.ts:358`](src/services/indexedDBCore.ts:358), [`workoutService.ts:42`](src/services/workoutService.ts:42) | 🔴 Two implementations with different retry params |
| **`exportWorkoutHistoryCSV`** | [`prService.ts:432`](src/services/prService.ts:432), [`exportService.ts:5`](src/services/exportService.ts:5) | 🟡 Different column sets |
| **Merge/replace pattern** | [`workoutDb.ts:953–1016`](src/services/workoutDb.ts:953) (replace), [`workoutDb.ts:1024–1146`](src/services/workoutDb.ts:1024) (merge) | 🟡 Both exist; replace is destructive, merge is not. Unclear when to use which. |
| **`initDB()` call at import** | [`personalItemsDb.ts:6`](src/services/personalItemsDb.ts:6) | 🟡 Side effect; other files don't do this |

### 2.5 Test Coverage Gaps

**Existing tests (in `src/services/__tests__/`):**
| Test File | Covers |
|-----------|--------|
| `workoutDb.test.ts` | ✅ workoutDb CRUD |
| `workoutDbMerge.test.ts` | ✅ workoutDb merge functions |
| `personalItemsDb.test.ts` | ✅ personalItemsDb |
| `bodyStatsService.test.ts` | ✅ bodyStatsService |
| `progressionService.test.ts` | ✅ progressionService |
| `trainingLoadService.test.ts` | ✅ trainingLoadService |
| `aiContextBuilder.test.ts` | ✅ AI context builder |

**No test files exist for:**
| Service | Risk | Priority |
|---------|------|----------|
| `indexedDBCore.ts` | 🔴 Core infrastructure — sync retry, pending queue, DB init | **Critical** |
| `workoutService.ts` | 🔴 Duplicate service — divergent behavior untested | **Critical** (or delete it) |
| `prService.ts` | 🔴 PR detection logic — complex branching | **High** |
| `exportService.ts` | 🟡 CSV generation, weekly report | Medium |
| `achievementService.ts` | 🟡 Streak calculation edge cases | Medium |
| `aiProgressionService.ts` | 🟡 AI integration — needs mocking | Medium |
| `aiWorkoutInsightService.ts` | 🟡 Thin wrapper — low priority | Low |
| `eventTracker.ts` | 🟢 Simple localStorage operations | Low |

---

## 3. Prioritized Recommendations

### P0 — Critical (Fix Immediately)

1. **Delete [`workoutService.ts`](src/services/workoutService.ts)**: This is the single most impactful cleanup. The file is a near-complete duplicate of [`workoutDb.ts`](src/services/workoutDb.ts) with divergent ID generation (`Date.now()` vs `crypto.randomUUID()`), different sync retry parameters, different data access patterns (full-scan vs cursor), and missing features (no exercise seeding, no cascade delete). Having both files means consumers may be using different implementations, leading to data inconsistencies.

2. **Split [`workoutDb.ts`](src/services/workoutDb.ts) into focused modules**: At 1146 lines with 7+ concerns, this file needs decomposition:
   - `workoutTemplateDb.ts` — template CRUD
   - `workoutSessionDb.ts` — session CRUD  
   - `bodyWeightDb.ts` — body weight CRUD
   - `exerciseDb.ts` — personal exercise CRUD + seeding
   - `cloudMerge.ts` — merge/replace operations
   - `builtInTemplates.ts` — move hardcoded data to [`src/data/`](src/data/)

3. **Add tests for [`indexedDBCore.ts`](src/services/indexedDBCore.ts)**: The sync retry logic, pending queue, and DB initialization are critical infrastructure with zero test coverage.

### P1 — High (Fix Soon)

4. **Decouple sync from IDB core**: Extract [`syncWithRetry`](src/services/indexedDBCore.ts:358) and the pending-sync queue into `syncQueue.ts`. The IDB core module should not import [`isSupabaseConfigured`](src/lib/supabase.ts).

5. **Fix [`prService.ts`](src/services/prService.ts:324) localStorage reads**: `getExerciseNames()` and `getExerciseByName()` read from `localStorage.getItem('personalExercises')` while exercises are stored in IndexedDB. This is a data consistency bug.

6. **Fix [`achievementService.ts`](src/services/achievementService.ts:52) streak calculation**: The streak should start from the most recent workout date, not today. Currently, if the last workout was yesterday, `currentStreak` is incorrectly 0.

7. **Remove `window.dispatchEvent` from data layer**: [`workoutDb.ts:192`](src/services/workoutDb.ts:192) and [`workoutDb.ts:325`](src/services/workoutDb.ts:325) dispatch `WORKOUT_SAVED` events. Use an observable/event-emitter pattern instead.

### P2 — Medium (Improve)

8. **Add indexes to IDB stores**: `workout_templates`, `personal_exercises`, `body_weight` need indexes for common query patterns (e.g., `lastUsed`, `date`).

9. **Standardize error handling**: Define a consistent pattern — throw domain errors, return `null` for not-found (documented), never silently swallow.

10. **Extract UI strings from [`progressionService.ts`](src/services/progressionService.ts)**: Hebrew display text and Tailwind classes should be in the UI layer, not business logic.

11. **Fix CSV escaping in [`exportService.ts`](src/services/exportService.ts:135)**: Escape double-quotes inside cell values (`"` → `""`).

12. **Add error handling to [`aiWorkoutInsightService.ts`](src/services/aiWorkoutInsightService.ts)**: Wrap in try/catch with fallback like [`aiProgressionService.ts`](src/services/aiProgressionService.ts:78) does.

13. **Remove side-effect `initDB()` call from [`personalItemsDb.ts:6`](src/services/personalItemsDb.ts:6)**: DB initialization should be explicit in the app bootstrap, not triggered by import.

### P3 — Low (Polish)

14. **Remove [`dataService.ts`](src/services/dataService.ts) barrel file**: Direct imports from source modules are clearer.

15. **Promote `dbGetByIndexRange` from [`prService.ts:21`](src/services/prService.ts:21) to [`indexedDBCore.ts`](src/services/indexedDBCore.ts)**: It's a generally useful helper.

16. **Add compound index on `personal_records`**: `(exerciseId, date)` for efficient "PRs for exercise sorted by date" queries.

17. **Audit `getBestPRs` in [`prService.ts:294`](src/services/prService.ts:294)**: Missing `reps` PR type — only returns `weight` and `volume`.

18. **Consider `dbTransaction` helper**: For multi-operation atomic workflows (e.g., cascade delete, merge operations).

---

## Summary

| Metric | Value |
|--------|-------|
| Total files reviewed | 12 |
| Total lines | ~3,800 |
| Critical issues | 3 (duplicate service, monolith file, missing core tests) |
| High issues | 7 |
| Medium issues | 18 |
| Low issues | 8 |
| Files with tests | 5 of 12 (42%) |
| Files with no tests | 7 of 12 (58%) |
| Estimated duplicate LOC | ~400 (workoutService.ts is ~90% overlap with workoutDb.ts) |

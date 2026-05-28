# SparkOS Fitness — Remaining Fix Plan (execute exactly)

> **Created:** 2026-05-28 (by Opus, after verifying all 9 review docs against real code)
> **For:** a fresh session on **Sonnet** — execute each item exactly as written.
> **Source of truth:** the ACTUAL code, not the review docs (which contained hallucinations — see §0).

---

## HOW TO USE THIS FILE (ground rules — read first)

1. **Verify before editing.** Line numbers below were accurate on 2026-05-28 but may drift.
   Before each edit, `grep` for the quoted snippet to confirm the exact current location.
2. **Run `npx tsc --noEmit` after every group.** Keep it green. Fix any type error you introduce
   immediately (e.g. `useRef<T | null>(null)` not `useRef<T>(null)` for mutable refs).
3. **No emoji in `src/`** — there is a test (`src/test/no-emoji.test.ts`) that fails on emoji.
   Use inline SVG or plain letters/symbols, never emoji characters.
4. **Immutability** — never mutate objects in place; return new copies (project rule).
5. **No `console.log`** in production code (project rule + hook). For AI features, return a
   user-facing Hebrew fallback string instead of logging.
6. **Run `npm run test:run` and `npm run build` at the very end.** Both must pass.
7. Work top-down: §A (correctness) → §B (AI) → §C (dedup) → §D (cosmetic) → §E (infra) → §F (big).
   §F (CSS + god-component splits) is HIGH RISK — see the warning there; do it last and carefully.

---

## §0 — ALREADY DONE (do NOT redo)

Fixed in the working tree before/at planning time — verified present:
- Client API key removed from `src/services/ai/bootstrap.ts` (no `VITE_*_API_KEY` in `src/`).
- Reducer routing fixed (`TOGGLE_PAUSE` in `TIMER_ACTIONS`, modal actions in `MODAL_ACTIONS`).
- Deleted: `recoveryService.ts`, `workoutService.ts`, `workoutSelectors.ts`, `workoutDb.ts.bak`.
- Model lists synced (`AI_DEFAULT_MODEL='openai/gpt-oss-120b:free'` ∈ edge `ALLOWED_MODELS`).
- `todayStr()` unified to a LOCAL-date helper in `src/utils/dateUtils.ts`; used by
  `waterService`, `nutritionService`, `exportService`, `aiDashboardService`.
- `achievementService.ts` streak date key now zero-padded `YYYY-MM-DD`.
- `useMobileKeyboard.ts` `useInputFocus` uses `useRef<T | null>(null)`.
- `builtInExercises.ts` duplicate `'Traps'` removed (both entries).
- `no-emoji.test.ts` regex now excludes `.test.tsx` too.
- `public/manifest.webmanifest`: `theme_color`/`background_color` = `#F2F4EC` (matches index.html);
  icon `purpose` split into separate `any` + `maskable` entries.
- `src/services/ai/features.ts`: `getWorkoutAdvice` + `suggestWeight` wrapped in try/catch with
  Hebrew fallback.
- `src/services/supabaseSync.ts` line ~308: workout-session `created_at` now uses `session.startTime`.

## §0b — CONFIRMED HALLUCINATIONS (do NOT act on these — they are false)

- `Screen` type does NOT contain `passwords`/`investments`/`logos` — it is clean fitness routes.
- Line counts in review-04/05 are inflated ~10-20% (written against stale code). Ignore the numbers.
- "tsconfig strict mode disabled" — FALSE, `"strict": true` is set.
- "PageThemeContext is a no-op/unused" — FALSE, it is used and sets CSS variables. (The *real*
  sub-issue is that every page uses the same accent `#43C7A5` — that part is true, see §C8.)
- "duplicate `exportWorkoutHistoryCSV` in prService" — FALSE, it only exists in `exportService`.
- "nutrition sync is fire-and-forget" — FALSE, it uses `syncWithRetry`.
- "z-index conflict (modal=1100 vs --z-modal=90)" — the JS values and CSS tokens both exist, BUT
  the CSS `--z-*` tokens have ZERO usages, so there is no runtime conflict. Treat as §D5 cleanup only.

---

## §A — CORRECTNESS / DATA BUGS (do first)

### A1. supabaseSync — `created_at` overwritten on every upsert (body_weight + audit others)
**File:** `src/services/supabaseSync.ts`
- Line ~449 (`syncBodyWeight`): `created_at: new Date().toISOString(),` overwrites the original
  creation timestamp every sync.
- **Fix:** use a stable source value. Check the `BodyWeightEntry` type:
  - If it has a `createdAt` field → `created_at: entry.createdAt ?? new Date().toISOString(),`
  - If not → add `createdAt: string` to `BodyWeightEntry` (set at creation in `bodyStatsService`),
    OR as a minimal fix use the entry's own date midnight: `created_at: entry.createdAt ?? entry.date`.
    Prefer adding `createdAt` to the type for consistency with other entities.
- **Audit the rest:** lines 240, 382, 505, 566, 634, 703, 764, 822 already use
  `x.createdAt || new Date()...` (correct — preserves). Confirm none still use a bare `new Date()`.
  Run: `grep -n "created_at: new Date" src/services/supabaseSync.ts` — should return nothing when done.

### A2. supabaseSync — `Promise.all` aborts entire sync on one failure
**File:** `src/services/supabaseSync.ts` (lines ~1045, ~1153, ~1237, ~1250)
- `Promise.all([...])` rejects on the first failed record → the whole push/pull aborts and later
  records never sync (silent data loss).
- **Fix:** replace with `Promise.allSettled`, then log/count rejections without aborting:
  ```ts
  const results = await Promise.allSettled([...]);
  const failed = results.filter((r) => r.status === 'rejected');
  if (failed.length) {
    logger.sync.error(`${failed.length} sync operations failed`, failed.map((f) => (f as PromiseRejectedResult).reason));
  }
  ```
  (Use the existing `logger.sync` already imported in this file.)
- For the destructured ones (lines ~1045/1237 `const [a,b,c] = await Promise.all([...])`), keep
  `Promise.all` ONLY if a single failure genuinely should abort that read batch; otherwise convert
  to `allSettled` and default failed reads to empty arrays. Decide per call site by reading context.

### A3. workout_sessions missing `updated_at` column + trigger
**File:** new migration under `supabase/migrations/` (follow existing migration naming/format).
- `workout_sessions` has only `created_at`; all other tables have `updated_at` with an auto-update
  trigger. Without it, last-write-wins sync has no basis.
- **Fix:** add a migration:
  ```sql
  ALTER TABLE workout_sessions ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();
  CREATE TRIGGER update_workout_sessions_updated_at
    BEFORE UPDATE ON workout_sessions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  ```
  (Confirm the trigger function name `update_updated_at_column` matches existing triggers in
  `supabase/schema.sql` / other migrations; reuse whatever the other tables use.)
- Then include `updated_at: new Date().toISOString()` in the session upsert payload (line ~298 block).

### A4. SettingsContext — side effect inside setState updater
**File:** `src/contexts/SettingsContext.tsx` (lines ~139-142)
- `persistSettings(next)` is called INSIDE the `setSettings((prev) => {...})` updater. React Strict
  Mode runs updaters twice → double localStorage writes; also impure.
- **Fix:** keep the updater pure (return `next` only). Persist via an effect:
  ```ts
  useEffect(() => { persistSettings(settings); }, [settings]);
  ```
  Guard the very first run if needed so it doesn't overwrite freshly-loaded settings with defaults
  (use a `useRef(false)` "hydrated" flag).

### A5. WorkoutStartModal — dual onClick + onPointerDown (double execution)
**File:** `src/components/workout/WorkoutStartModal.tsx` (buttons around lines ~152, 186, 229, 257, 321, 411)
- Each button has BOTH `onClick` and `onPointerDown` calling the same handler → can fire twice
  (e.g. start workout twice).
- **Fix:** keep ONE. Use `onClick` only (default, accessible). Remove the `onPointerDown` duplicates.
  If `onPointerDown` was added for latency, instead debounce or guard with a ref so the action runs
  once. VERIFY by reading each button: if `onPointerDown` does something different from `onClick`,
  keep both but make them idempotent. Also check `WorkoutTemplates.tsx` for the same pattern.

### A6. notificationService — deprecated `new Notification()`
**File:** `src/services/notificationService.ts` (line ~55)
- `new Notification(title, ...)` is deprecated and fails on iOS / many mobile browsers.
- **Fix:** prefer the service-worker path:
  ```ts
  const reg = await navigator.serviceWorker?.getRegistration();
  if (reg) { await reg.showNotification(title, options); }
  else if ('Notification' in window) { new Notification(title, options); } // fallback
  ```
  Keep permission checks as-is.

---

## §B — AI LAYER

### B1. aiWorkoutInsightService — name mismatch / missing error handling
- **NOTE:** review-05 referenced `src/services/ai/aiWorkoutInsightService.ts` which **does not exist**.
  First `grep -rn "WorkoutInsight\|generateAIWorkoutInsight" src/` to find the real file/function.
- Wherever the workout-insight AI call lives, wrap the `provider.chat(...)` in try/catch with a
  Hebrew fallback (same pattern as `features.ts`).

### B2. Inconsistent "weak muscle" thresholds
- `src/services/ai/contextBuilder.ts` (~line 91) uses `* 0.8` (80%); `aiDashboardService.ts`
  (~line 128) uses `* 0.7` (70%).
- **Fix:** extract `const WEAK_MUSCLE_THRESHOLD = 0.75;` to a shared AI constants file and use it in
  both. (Pick 0.75, or confirm intended value with product owner.)

### B3. Duplicated streak calculation
- `contextBuilder.ts` (~105-119) and `aiDashboardService.ts` (~132-144) duplicate the same streak
  algorithm. Note `achievementService.ts` already has `calculateStreak`.
- **Fix:** reuse a single `calculateStreak(sessions)` (export from `achievementService` or a shared
  util) in all three places. Ensure date keying matches the fixed local-date format.

### B4. suggestWeight — persona duplication
- `src/services/ai/features.ts` `suggestWeight` hardcodes its own system prompt (~line 42). When
  routed through a provider that also prepends `withPersona()`, the model gets two persona blocks.
- **Fix:** verify whether the provider applies a persona. If yes, drop the inline system message and
  rely on the provider persona. If no, leave as-is.

### B5. Misleading AI function names (cost/latency clarity)
- In `features.ts`: `suggestExercises`, `getFormTips`, `generateWorkoutSummary` are **rule-based**
  (no AI call) but named as if they use AI.
- **Fix (low risk):** add a JSDoc note on each ("rule-based, no network call"). Optionally move them
  to a `ruleBasedFeatures.ts`. Do NOT change exported names without updating all importers.

### B6. Unused `_weakMuscles` parameter
- `features.ts` `suggestExercises(muscleGroup, currentExercises, _weakMuscles = [])` — `_weakMuscles`
  is never used. Either implement it (filter suggestions by weak muscles) or remove the param and
  update callers. Removing is simplest if no caller passes it meaningfully (grep callers first).

### B7. Fragile Hebrew regex parsing of AI responses
- `aiDashboardService.ts` (~488-516) and `aiProgressionService.ts` (~205-240) parse free-form AI
  text with regex that matches only some Hebrew quote characters.
- **Fix:** request structured JSON from the model (instruct it to reply as JSON) and parse with the
  existing `safeJsonParse`. Fall back to current regex if JSON parse fails. Medium effort — do
  carefully and keep the fallback.

---

## §C — DEDUPLICATION & QUALITY

### C1. Volume formula duplicated (~12+ sites)
- `set.weight * set.reps` (with warmup exclusion / null guards) appears across `analyticsService`,
  `trainingLoadService`, `prService`, `exportService`, `WorkoutSummary.tsx`,
  `PerformanceAnalytics.tsx`, `features.ts`, `aiDashboardService.ts`, `contextBuilder.ts`.
- **Fix:** add to a shared util (e.g. `src/utils/workoutMath.ts`):
  ```ts
  export const setVolume = (set: { weight?: number; reps?: number; isWarmup?: boolean }): number =>
    set.isWarmup ? 0 : (set.weight || 0) * (set.reps || 0);
  ```
  Replace occurrences. `grep -rn "weight.*\*.*reps\|reps.*\*.*weight" src/` to find them. Verify each
  replacement preserves the original warmup handling.

### C2. `generateId` duplicated (4 sites, different behavior)
- Defined in `nutritionService.ts` (`meal-`, slice(2,9)), `waterService.ts` (`water-`, slice(2,7)),
  `ai/chat.ts` (`conv-`, slice(2,7)), `bodyStatsService.ts` (takes `prefix`, slice(2,9)).
- **Fix:** create `src/utils/id.ts`:
  ```ts
  export const generateId = (prefix: string, randomLength = 7): string =>
    `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 2 + randomLength)}`;
  ```
  Replace each local def + call, PRESERVING behavior:
  - nutrition: `generateId('meal', 7)`  · water: `generateId('water', 5)`
  - chat: `generateId('conv', 5)`        · bodyStats: `generateId(prefix, 7)`

### C3. Dual haptic systems
- `src/utils/haptics.ts` and `src/hooks/useHaptics.ts` both implement haptics; different components
  use different ones.
- **Fix:** pick ONE as canonical (the hook is more idiomatic for components; the util for non-React).
  Have the hook wrap the util so there is a single implementation. Update all importers to the
  canonical API. `grep -rn "haptics\|useHaptics" src/` to map usage first.

### C4. Triple button components
- `Button.tsx`, `AccessibleButton` (inline in `Login.tsx`), `FSButton` (inline in `OnboardingFlow.tsx`).
- **Fix:** consolidate to a single `Button.tsx` with a `variant` prop covering the needed styles;
  replace the two inline ones. Do this alongside §F Login/Onboarding extraction to limit churn.

### C5. DumbbellIcon duplicated inline
- Identical inline SVG in `ExerciseFilter.tsx` and `ExerciseList.tsx` (comment claims "avoid circular
  import" but no such import exists).
- **Fix:** move the SVG to `src/components/ui/icons.tsx` (or wherever icons live) and import it in both.

### C6. WorkoutSummary stats duplicated
- `computeStats` in `WorkoutSummary.tsx` overlaps `calculateAllStats`/logic in `PerformanceAnalytics.tsx`
  and `WorkoutHistoryScreen.tsx`.
- **Fix:** extract one shared stats function (in `workoutMath.ts` from C1) and reuse. Use `setVolume`.

### C7. Hooks not memoized → unnecessary re-renders
- `src/contexts/WorkoutContext.tsx` `useCurrentExercise()`, `useWorkoutSettings()`, `useRestTimer()`
  (~lines 84-118) read full state and return computed values WITHOUT `useMemo`.
- **Fix:** wrap each returned object in `useMemo` with granular deps (mirror the already-correct
  `useWorkoutOverlays`/`useWorkoutCelebration` in the same file).

### C8. PageThemeContext — all pages share one accent
- Every page theme uses `#43C7A5`; `isDark` is hardcoded `false` (never reads SettingsContext).
- **Fix:** either (a) give each route a distinct accent (real per-page theming) or (b) simplify by
  removing the per-page abstraction if uniform color is intended. Also wire `isDark` to SettingsContext.
  Confirm desired direction before doing — low priority.

### C9. DataContext monolith re-renders
- `src/contexts/DataContext.tsx` exposes ~10 fields in one value; any change re-renders all consumers.
  Also loads everything on mount (`Promise.all` of all exercises/sessions/templates).
- **Fix (medium):** split into focused contexts or memoize the value and add selector hooks. Add
  pagination to the sessions load (e.g. last 100, load more on demand). Lower priority; do after §A/§B.

---

## §D — MINOR / COSMETIC (P2/P3) — include for completeness

### D1. `§` completion badge in AnimatedProgressRing
- `src/components/ui/AnimatedProgressRing.tsx` (~line 238): `<span ...>§</span>` shows a section sign
  instead of a checkmark. **Do NOT use a ✓/emoji** (no-emoji test). Replace with an inline SVG check:
  ```tsx
  <svg viewBox="0 0 24 24" width="24" height="24" aria-label="הושלם" role="img">
    <path d="M5 13l4 4L19 7" fill="none" stroke="currentColor" stroke-width="2.5"
      stroke-linecap="round" stroke-linejoin="round" />
  </svg>
  ```

### D2. `getBuiltinTemplateIcon` always returns `§`
- `src/components/workout/WorkoutTemplates.tsx` (~line 19): returns `'§'` ignoring the param.
- **Fix:** map template name → a small inline SVG/letter, or return an existing icon component.
  Avoid emoji. If the design just wants a dumbbell, reuse the shared DumbbellIcon (see C5).

### D3. Input.tsx uses `Math.random()` for id
- `src/components/ui/Input.tsx` (~line 19): `Math.random().toString(36)...` → use React `useId()`:
  ```tsx
  const reactId = useId();
  const inputId = id ?? reactId;
  ```
  (import `useId` from 'react'). Fixes SSR/collision concerns.

### D4. M-01: duplicate Sentry error handlers
- `src/main.tsx` (~lines 46-62): manual `window.addEventListener('error'|'unhandledrejection')` that
  call `Sentry.captureException`, duplicating Sentry.init's built-in handlers → double-reporting.
- **Fix:** remove the manual listeners (Sentry already captures these), OR if they add context, keep
  but ensure they don't double-report (e.g. only add custom context, don't re-capture).

### D5. Dead CSS `--z-*` tokens
- `src/styles/tokens.css` (~lines 282-289): `--z-*` variables with ZERO usages anywhere.
- **Fix:** remove them (confirm 0 usages first: `grep -rn "var(--z-" src/`). The live z-index system
  is `src/constants/zIndex.ts` — leave that as the single source of truth.

### D6. M-02/M-03: main.tsx silent catch + redundant cast
- Silent `.catch(() => {})` (~lines 66-73) — add minimal context or a comment; don't swallow blindly.
- `import.meta.env.VITE_SENTRY_DSN as string | undefined` cast (~line 21) — add an `ImportMetaEnv`
  interface in `src/vite-env.d.ts` so the cast is unnecessary and env vars are typed.

### D7. QuickExerciseForm double `memo`
- `src/components/workout/.../QuickExerciseForm.tsx`: wrapped in `memo()` at definition AND exported
  as `React.memo(...)`. Remove one.

### D8. DeleteConfirmDialog bypasses ModalOverlay
- Manually renders a fixed overlay with hardcoded `z-index: 13000`, no focus trap/scroll lock.
- **Fix:** render through the shared `ModalOverlay` component and use `zIndex.ts` constants.

### D9. Workout routes missing PageErrorBoundary
- `src/App.tsx` (~lines 264-265): `/workout` route(s) not wrapped in `PageErrorBoundary`.
- **Fix:** wrap with `<PageErrorBoundary pageLabel="אימון">...</PageErrorBoundary>` like other routes.

### D10. components/index.ts barrel incomplete
- `src/components/workout/components/index.ts` exports ~15 of ~30 components.
- **Fix:** add the missing exports (AlternativesSheet, NotesBottomSheet, RPEPicker, SetEditBottomSheet,
  SlideToComplete, InlineRestTimer, etc.). Verify each path before adding.

---

## §E — INFRA / CONFIG

### E1. CI: no coverage thresholds
- `.github/workflows/ci.yml` (~line 41) runs `npm run test:run` (no coverage). `test:coverage` exists.
- **Fix:** run `npm run test:coverage` in CI and add thresholds in `vitest.config`/`vite.config`
  (start realistic, e.g. lines 30%, ratchet up toward 80%). Do not set 80% immediately — it will fail.

### E2. CI: single Node version
- `.github/workflows/ci.yml` (~line 16) `node-version: [20.x]`.
- **Fix:** `node-version: [20.x, 22.x]` (add 18.x only if the project still supports it; check `engines`).

### E3. biome `noExplicitAny` is `warn`
- `biome.json` (~line 24). **Fix:** set to `"error"` ONLY after fixing existing `any` usages, else the
  build/lint breaks. First `grep -rn ": any\|<any>\|as any" src/` and clean those, then flip to error.

### E4. Legacy ESLint `lint` script
- `package.json` (~line 10) has an ESLint `lint` script alongside Biome's `lint:check`.
- **Fix:** remove the ESLint script (and eslint dev deps if truly unused), or repoint `lint` to Biome.
  Verify nothing in CI/hooks calls the old script first.

### E5. Placeholder URLs in robots.txt / sitemap.xml
- `public/robots.txt` (~line 4) and `public/sitemap.xml` (~lines 4-5) reference
  `https://your-site.netlify.app` and a stale `2024-01-01` date.
- **Fix:** replace with the real production domain (ASK the owner for it) and a current date. If the
  domain is unknown, remove the sitemap reference rather than ship a broken placeholder.

### E6. offlineQueue: dynamic import per item
- `src/services/offlineQueue.ts` (~line 217) `await import('./supabaseSync')` runs per queued mutation.
- **Fix:** hoist the import once (module top or memoize the resolved module) instead of per item.
- Also: domain services use `syncWithRetry` instead of this queue (offlineQueue is largely unused).
  Decide whether to wire services through offlineQueue or remove it. Document the decision; do not
  leave two competing sync paths silently.

### E7. Data-layer coupling (architectural — medium)
- `src/services/workoutDb.ts` (~lines 192, 325): `window.dispatchEvent(...)` from the data layer.
  Move event emission to a callback/observer the UI subscribes to, or a dedicated events module.
- `src/services/indexedDBCore.ts` (~line 6): imports `isSupabaseConfigured` — core IDB shouldn't know
  about cloud. Invert the dependency (pass a sync callback in).
- `syncWithRetry` returns `void` (fire-and-forget) — callers can't await/handle errors. Consider
  returning a Promise<boolean> and letting callers decide. Touches many call sites — do carefully.

---

## §F — LARGE REFACTORS (HIGH RISK — do last, with care)

> ⚠️ **WARNING:** Test coverage is ~6%. Splitting 1000-3000 line files or merging 2500 lines of CSS
> "without bugs" is NOT safe blind. For each item below: (1) write characterization tests for the
> current behavior FIRST, (2) extract incrementally, (3) `tsc` + tests + manual smoke after each step,
> (4) verify visually in the running app for any UI/CSS change. Do ONE file per PR.

### F1. CSS consolidation (`global.css` + `components.css`)
- Both are imported in `main.tsx` (components.css last → it wins). Duplicate selectors with DIFFERENT
  values: `.card`, `.btn-primary`, `.glass`, `.badge`, `.input`; duplicate `@keyframes shimmer/spin`.
- **Approach:** For each duplicated selector, diff the two definitions. Decide the intended final
  style (usually the components.css "winner" since it loads last). Keep ONE definition, delete the
  other. After EACH selector, load the app and compare the affected component visually. Do not batch
  blindly — cascade interactions are subtle. Consider moving shared primitives fully into Tailwind
  `@layer components` if that matches the project direction.

### F2. God-component splits (one file per PR, tests first)
Real, verified line counts (2026-05-28):
- `src/pages/Progress.tsx` — 3258 lines (12+ inline components) → split into tab files + chart files.
- `src/pages/Settings.tsx` — 2000 lines → extract inline UI primitives to `components/ui/`.
- `src/pages/Login.tsx` — 1691 lines → extract `AccessibleButton`/inputs to `components/ui/`.
- `src/components/workout/ActiveWorkoutNew.tsx` — 1400 lines (46 useCallback handlers) → extract
  hooks: `useWorkoutSave`, `useSupersetMode`, `useExerciseSuggestions`, swipe handling.
  Also: `handleConfirmFinish` is ~141 lines — extract to a `useWorkoutSave` hook.
- `src/services/workoutDb.ts` — 1145 lines (7 concerns) → split `templateDb.ts`, `sessionDb.ts`,
  `bodyWeightDb.ts`, `exerciseDb.ts`, move hardcoded Hebrew template data to `src/data/`.
- `src/services/supabaseSync.ts` — ~1134 lines → extract the repeated row<->camelCase mappers and
  shared interfaces into a `supabaseSyncMappers.ts`.

### F3. RestTimer duplication / lazy-loading
- `RestTimer.tsx` (~411 lines) appears unused (only via `InlineRestTimer`); `RestTimerOverlay.tsx`
  (~909 lines) is NOT lazy-loaded in `ActiveWorkoutNew` while smaller overlays are.
- **Fix:** confirm `RestTimer.tsx` is dead (grep imports) and remove if so. Lazy-load
  `RestTimerOverlay` like the other overlays (`React.lazy`).

### F4. WorkoutSummary expensive fetch
- `WorkoutSummary.tsx` (~line 217) calls `getAllWorkoutSessions()` (full history) on every display to
  compute PRs. **Fix:** pass needed PR data in via props, or cache, or query a bounded range.

### F5. i18n
- Hebrew strings hardcoded across 100+ components. **Fix (large):** introduce an i18n layer
  (e.g. a simple `t()` + JSON dictionaries) incrementally. Lowest priority.

---

## FINAL VERIFICATION (run before declaring done)
1. `npx tsc --noEmit` — 0 errors.
2. `npm run lint:check` (Biome) — clean.
3. `npm run test:run` — all pass (incl. `no-emoji` test).
4. `npm run build` — succeeds.
5. Manually smoke-test in the app: start/finish a workout, log water/meal/weight (check correct day),
   open AI dashboard/insight (force an AI error to see the fallback), PWA install (icon/theme).

---

## SESSION COMPLETION LOG — 2026-05-28 (Opus 4.8)

State at hand-off: `tsc --noEmit` 0 errors · `test:run` 60/60 pass (incl. no-emoji) ·
`build` succeeds. (`lint:check`/`format:check` still report PRE-EXISTING Biome debt in
untouched files — see E3/notes below — none introduced this session.)

### DONE & verified
- **§A1–A6** all done: body_weight `created_at` preserved; `Promise.all`→`allSettled` for
  push/merge/local-reads in supabaseSync; workout_sessions `updated_at` column + trigger
  (migration `20260528000000_*` + schema.sql + upsert payload); SettingsContext side-effect
  moved to effect (hydrated-ref guard); dual onClick/onPointerDown removed in WorkoutStartModal
  AND WorkoutTemplates; notificationService now uses SW `showNotification` w/ constructor fallback.
- **§B1–B7** all done: workout-insight wrapped in try/catch (real file `aiWorkoutInsightService.ts`);
  `WEAK_MUSCLE_THRESHOLD=0.75` in new `ai/constants.ts` (was 0.8 vs 0.7); streak unified to
  `achievementService.calculateStreak` in contextBuilder + aiDashboard; suggestWeight inline persona
  dropped (provider injects it); rule-based fns JSDoc'd; `_weakMuscles` param removed; AI responses
  now request JSON + parse via safeJsonParse with regex/line fallback (aiProgressionService +
  aiDashboardService).
- **§C**: C2 (shared `utils/id.ts` generateId, 5 services + personalItemsDb), C5 (shared
  `components/icons/CustomDumbbellIcon`), C7 (memoized useCurrentExercise/useWorkoutSettings).
  C1 PARTIAL: created `utils/workoutMath.ts` (setVolume/exerciseVolume/sessionVolume), applied to
  features.ts + exportService (semantics-identical sites only). **Remaining C1 sites NOT migrated**
  on purpose — analyticsService/Progress/WorkoutDetail/contextBuilder/aiDashboard compute volume
  WITHOUT warmup exclusion, so swapping to setVolume would change behavior. Migrate only if you also
  intend to make them warmup-aware.
- **§C DEFERRED**: C3 (dual haptics — behavioral consolidation, needs device testing),
  C4 (triple Button — tied to §F Login/Onboarding split), C6 (stats dedup — tied to §F),
  C8 (per-page accent — needs product decision), C9 (DataContext split — medium, do after).
- **§D1–D10** all done: progress-ring `§`→SVG check; template icon `§`→CustomDumbbellIcon;
  Input `useId`; main.tsx duplicate Sentry handlers removed; dead `--z-*` tokens removed;
  env typed via `ImportMetaEnv` (cast removed) + silent catch logged; QuickExerciseForm double-memo
  fixed; DeleteConfirmDialog now renders through ModalOverlay; /workout routes wrapped in
  PageErrorBoundary; components barrel completed. (Also fixed pre-existing emoji in WorkoutSummary
  rating selector / Progress / WorkoutDetail share-text to keep no-emoji test green.)
- **§E1,E2,E4,E6** done: CI runs `test:coverage`; vitest thresholds set as regression floor
  (stmts 6 / branch 40 / funcs 18 / lines 6 — ratchet up over time); CI node matrix [20.x,22.x] +
  `engines.node>=20`; dead eslint `lint` script repointed to Biome; offlineQueue dynamic import memoized.
- **§E3 BLOCKED**: the 2 `any`s in src are fixed (Button has biome-ignore; useWorkoutAudio typed),
  but flipping biome `noExplicitAny` warn→error is blocked by the repo's config-protection hook.
  Flip it manually (or disable the hook) — code is already clean.
- **§E5 DEFERRED** (user choice): robots.txt/sitemap.xml still use the `your-site.netlify.app`
  placeholder. Provide the real production domain to finish.
- **§E7 DEFERRED**: data-layer coupling (workoutDb window.dispatchEvent, indexedDBCore→isSupabaseConfigured,
  syncWithRetry void return) — architectural, many call sites, do carefully.
- **§F3** done: dead `RestTimer.tsx` (411 lines) deleted. NOTE: `RestTimerOverlay.tsx` (909 lines)
  is ALSO never rendered (only `InlineRestTimer` is used) — left in place as it's exported public API
  and may be an intentionally-disabled feature; the plan's "lazy-load it" step is moot. Decide whether
  to delete it.
- **§F4** done: WorkoutSummary PR computation (full-history fetch) now gated on `isOpen` so it no
  longer scans all sessions while the summary is closed.
- **§F2 (supabaseSync)** done: row interfaces + toCanonical* mappers extracted to
  `supabaseSyncMappers.ts` (supabaseSync 1338→1112 lines).

### NOT DONE — require the running-app visual-verification loop (do one file per PR)
- **§F1 CSS consolidation** (global.css + components.css duplicate selectors) — needs visual diffing.
- **§F2 god-component splits**: Progress.tsx (3258), Settings.tsx (2000), Login.tsx (1691),
  ActiveWorkoutNew.tsx (1400, extract useWorkoutSave/useSupersetMode/etc.), workoutDb.ts (1145,
  split templateDb/sessionDb/bodyWeightDb/exerciseDb + move Hebrew template data to src/data).
  workoutDb is logic-only and tsc-verifiable; the four UI files need the browser.
- **§F5 i18n** — large, lowest priority.

### Pre-existing tech debt (NOT in this plan's scope, not introduced here)
- Biome `lint:check`: ~343 pre-existing errors (mostly a11y `useSemanticElements` on `role="button"`
  divs) and `format:check`: 33 pre-existing errors, all in files NOT touched this session. CI's
  lint/format steps were already red before this work. Cleaning these is a separate effort.

# SparkOS Fitness — Remaining Work (execute exactly, fresh session)

> **Created:** 2026-05-28 by Opus 4.8, after completing §A–§E + the safe §F items of `FIX-PLAN.md`.
> **Audience:** a fresh agent session. This file is SELF-CONTAINED — you do not need any prior context.
> **Companion:** `plans/FIX-PLAN.md` (see its "SESSION COMPLETION LOG" for what is already done).
> **Scope:** everything still open, INCLUDING the low-confidence / "decide" items — the user asked for
> ALL of it. Where a real product/UX decision is needed, the default action is written in **DEFAULT:**.

---

## GROUND RULES (read first — non-negotiable)

1. **Verify before editing.** Line numbers here were correct on 2026-05-28 but WILL drift. Before each
   edit, `grep`/search for the quoted snippet to find the current location.
2. **Keep the build green after EVERY item.** Run, in order:
   - `npx tsc --noEmit` → 0 errors
   - `npm run test:run` → all pass (60 at baseline, incl. `src/test/no-emoji.test.ts`)
   - `npm run build` → succeeds
   If any goes red, fix immediately before moving on. Never batch multiple risky items before verifying.
3. **No emoji anywhere under `src/`.** `src/test/no-emoji.test.ts` fails on any `\p{Extended_Pictographic}`
   character. Use inline SVG or plain letters/symbols. (`✓`/`✗` U+2713/2717 are NOT flagged; real emoji are.)
4. **Immutability** — never mutate objects/arrays in place; return new copies (project rule).
5. **No `console.log`** in production code (hook-enforced). Use the existing `logger` (`src/utils/logger.ts`).
   For AI features, return a user-facing Hebrew fallback string instead of logging-and-throwing.
6. **Formatting:** run `npx biome format --write <files-you-touched>` on your OWN files only. Do NOT run
   `npm run format` (writes all of `src/` and will reformat ~33 pre-existing-dirty files you didn't touch).
7. **Pre-existing lint debt:** `npm run lint:check` already reports ~343 Biome errors and `format:check`
   ~33, ALL in files untouched by the 2026-05-28 session (mostly a11y `useSemanticElements` on
   `role="button"` divs). CI's lint/format steps were already red. Do NOT treat these as your regressions —
   cross-check failing files against `git diff --name-only HEAD`. Cleaning them is a separate task (§G below).
8. **`biome.json` is edit-protected** by a repo hook (rejects edits as "weakening config"). To change a
   Biome rule you must fix the source first, then flip the rule manually or temporarily disable the hook.
9. **UI/CSS changes need visual verification.** For every item under §F-UI and §F-CSS: run the app
   (`npm run dev`), open the affected screen, and compare before/after. A headless agent that cannot open a
   browser should STILL do the extraction (it is type-safe) but must flag in its report that visual
   verification is pending.
10. **One logical change per commit.** These are large refactors; small commits make rollback cheap.

**Pure-extraction discipline (applies to all god-component splits):** move code to a new file WITHOUT
changing behavior. Keep prop names, types, and logic identical. The extracted child receives via props
exactly what it closed over before. After extraction the parent imports and renders the child the same way.
`tsc` catches almost all breakage; the residual risk is runtime/visual, hence rule 9.

---

## PRIORITY ORDER

Do logic-only / verifiable work first (no browser needed), then UI, then CSS, then polish:

1. §F2-workoutDb (logic only, tsc-verifiable)
2. §C1-rest, §C3, §C4, §C6, §C9 (dedup/perf — mostly logic)
3. §E3, §E5, §E7 (infra/decisions)
4. §F2-UI splits: Progress → Settings → Login → ActiveWorkoutNew (one PR each, visual verify)
5. §C8 (per-page theme), RestTimerOverlay decision
6. §F1 CSS consolidation (highest visual risk — last)
7. §F5 i18n (largest, lowest priority)
8. §G lint/format debt cleanup (optional, large)

---

## §F2-workoutDb — split `src/services/workoutDb.ts` (1145 lines, LOGIC ONLY)

**Why:** 7 unrelated concerns in one file. Pure data layer — fully tsc-verifiable, no browser needed.

**Steps:**
1. Read the whole file. Identify the concern groups (templates, sessions, body-weight, personal
   exercises, the cloud-merge functions `merge*FromCloud`, and the hardcoded Hebrew built-in template data).
2. Create sibling files and MOVE (not copy) the matching functions, preserving signatures:
   - `src/services/templateDb.ts` — workout-template CRUD + `mergeWorkoutTemplatesFromCloud`.
   - `src/services/sessionDb.ts` — workout-session CRUD + `mergeWorkoutSessionsFromCloud`.
   - `src/services/bodyWeightDb.ts` — body-weight CRUD + `mergeBodyWeightFromCloud`.
   - `src/services/exerciseDb.ts` — personal-exercise CRUD + `mergePersonalExercisesFromCloud`.
   - Move the hardcoded Hebrew built-in template/exercise seed data into `src/data/` (e.g.
     `src/data/builtInWorkoutTemplates.ts`) and import it back.
3. CAUTION: `src/services/supabaseSync.ts` imports the `merge*FromCloud` functions FROM `./workoutDb`.
   After moving them, either (a) update supabaseSync's import paths, or (b) keep `workoutDb.ts` as a thin
   barrel that re-exports from the new modules (lower churn, safer). Prefer (b) first to keep the diff small,
   then optionally migrate importers later.
4. `grep -rn "from './workoutDb'\|from '../services/workoutDb'" src/` to find ALL importers; ensure each
   symbol still resolves (barrel re-export covers this).
5. Verify: `tsc` + tests + build.

---

## §C1-rest — finish the `setVolume` migration (PARTIAL)

**Done already:** `src/utils/workoutMath.ts` exists (`setVolume`, `exerciseVolume`, `sessionVolume`) and is
used in `features.ts` + `exportService.ts`.

**Remaining sites** (run `grep -rn "weight.*\*.*reps\|reps.*\*.*weight" src/ --include=*.ts --include=*.tsx`):
`analyticsService.ts` (~10 sites), `Progress.tsx`, `WorkoutDetail.tsx`, `RecentWorkouts.tsx`,
`WorkoutComparison.tsx`, `ActiveWorkoutNew.tsx`, `AICoach.tsx`, `PerformanceAnalytics.tsx`,
`WorkoutHistoryScreen.tsx`, `useWorkoutHistory.ts`, `WorkoutProvider.tsx`, `ai/contextBuilder.ts`,
`ai/aiDashboardService.ts`, `progressionService.ts`, `prService.ts`.

**CRITICAL semantic caveat:** `setVolume(set)` returns `0` for warmup sets. MANY of these sites currently
compute `weight*reps` WITHOUT excluding warmups. Replacing them blindly CHANGES behavior.
- For each site, determine the intended semantics:
  - If the site already filters `!isWarmup` (or guards warmups) → replacing with `setVolume`/`exerciseVolume`
    is behavior-preserving → SAFE, do it.
  - If the site does NOT currently exclude warmups → **DECIDE:** the product intent is that warmups don't
    count toward training volume. **DEFAULT:** make them warmup-aware by switching to `setVolume` (more
    correct), and note the behavior change in the commit. (Skip only `prService` 1RM/Epley formulas and
    raw per-set display cells where volume isn't the concept.)
- 1RM formulas (`weight * (1 + reps/30)`) are NOT volume — leave them.

---

## §C3 — consolidate the dual haptic systems

**Problem:** two implementations: `src/utils/haptics.ts` (module-level, gated by `setHapticsEnabled` synced
from SettingsProvider; exports `haptics`, `triggerHaptic`, legacy `hapticTap` etc.) and
`src/hooks/useHaptics.ts` (hook reading settings directly; its own `VIBRATION_PATTERNS`, intensity, iOS
handling, `triggerEffect`/`hapticSuccess`/...). They use DIFFERENT vibration patterns.

**Plan:** make `utils/haptics.ts` the single source of truth for the actual `navigator.vibrate` calls and
the enable-flag gating. Refactor `useHaptics` to be a thin React wrapper that calls into `utils/haptics`
(so there is ONE vibration code path), keeping the hook's richer API surface for components.
1. `grep -rn "useHaptics\|from '.*utils/haptics'\|triggerHaptic\|haptics\." src/` to map every call site.
2. Define the canonical pattern vocabulary ONCE in `utils/haptics.ts` (merge the two pattern sets;
   **DEFAULT:** keep the hook's "Quiet Luxury" softer patterns where they conflict — they are the newer,
   intentional design).
3. Reimplement `useHaptics` methods to delegate to the util (e.g. `triggerEffect` looks up the canonical
   pattern and calls a util function), preserving the hook's exported method names/signatures so no caller
   changes.
4. Keep iOS handling in one place.
5. **Verify on a real device if possible** (haptics can't be verified headless) — at minimum confirm no
   call site broke (`tsc`) and the Settings haptics toggle still gates everything.

---

## §C4 — consolidate triple Button components

**Problem:** three button implementations:
- `src/components/ui/Button.tsx` (canonical, has `variant`/`size` props).
- `AnnualButton` inline in `src/pages/Login.tsx` (~line 336, `memo(function AnnualButton...)`).
- `FSButton` inline in `src/components/onboarding/OnboardingFlow.tsx` (search for `FSButton`).

**Plan:** extend `Button.tsx` with whatever variants the two inline ones need, then replace them.
1. Read all three; enumerate the visual variants (the Login "Annual" editorial style, the Onboarding "FS"
   style) and add them as `variant` values to `Button.tsx`.
2. Replace `AnnualButton`/`FSButton` usages with `<Button variant="...">`.
3. **Best done alongside the Login split (§F2-Login) and an Onboarding pass** to limit churn — if doing
   Login split first, extract `AnnualButton` into `Button.tsx` as part of that PR.
4. Visual-verify Login + Onboarding screens.

---

## §C6 — extract shared workout-stats function

**Problem:** `computeStats` in `WorkoutSummary.tsx` overlaps stats logic in
`components/PerformanceAnalytics.tsx` and `WorkoutHistoryScreen.tsx`.
**Plan:** add one shared stats function to `src/utils/workoutMath.ts` (reuse `setVolume`/`sessionVolume`),
returning `{ totalVolume, totalSets, completedSets, durationMin, ... }`. Replace the three local copies.
Verify each call site renders identical numbers. Do this AFTER §C1-rest so `setVolume` semantics are settled.

---

## §C9 — DataContext re-render / load optimization

**File:** `src/contexts/DataContext.tsx`. Exposes ~10 fields in one context value → any change re-renders all
consumers; also `Promise.all`-loads everything (exercises/sessions/templates) on mount.
**Plan (medium):**
1. Memoize the context value (`useMemo`) with granular deps; OR split into focused contexts
   (e.g. ExercisesContext / SessionsContext / TemplatesContext) with selector hooks.
2. Paginate the sessions load (e.g. most recent 100; "load more" on demand) instead of loading all.
3. Verify dashboard/history still populate correctly and there's no infinite-load.

---

## §E3 — Biome `noExplicitAny` warn → error

The 2 `any`s in `src/` are already handled (Button has a `biome-ignore`; `useWorkoutAudio.ts` is typed).
**Action:** flip `noExplicitAny` from `"warn"` to `"error"` in `biome.json` (suspicious section).
**Blocker:** the config-protection hook blocks `biome.json` edits. Either disable that hook for one edit, or
ask the user to flip it. After flipping, run `npm run lint:check` and fix any new `any` that surfaces.

---

## §E5 — real production domain in robots.txt / sitemap.xml

`public/robots.txt` and `public/sitemap.xml` use placeholder `https://your-site.netlify.app` and a stale
`2024-01-01` date.
**Action:** ASK the user for the real production domain, then replace in both files and set `<lastmod>` to
the current date. **DEFAULT if the user is unavailable:** remove the `Sitemap:` line from robots.txt and the
placeholder `<loc>` from sitemap.xml rather than ship a broken URL.

---

## §E7 — data-layer coupling (architectural, careful)

1. `src/services/workoutDb.ts` (~lines 192, 325): `window.dispatchEvent(...)` emitted from the data layer.
   Move event emission to a callback/observer the UI subscribes to, or a dedicated events module.
   (Coordinate with §F2-workoutDb split.)
2. `src/services/indexedDBCore.ts` (~line 6): imports `isSupabaseConfigured` — core IDB should not know about
   cloud. Invert the dependency: pass a sync callback/flag in from the caller instead of importing it.
3. `syncWithRetry` returns `void` (fire-and-forget) — callers can't await/handle errors. Consider returning
   `Promise<boolean>` and letting callers decide. Touches MANY call sites — do carefully, grep all callers,
   verify each still compiles and handles the result (or explicitly ignores it).

---

## §F2-UI — god-component splits (ONE PR EACH, visual-verify)

General method: each listed inline component is already a self-contained `memo(function X(props){...})` or
`function X(props){...}`. For each → move it to its own file under a new folder, export it, import it back
into the parent. Move shared types too. Re-run tsc + open the screen.

### Progress.tsx (3258 lines) → `src/pages/progress/`
Inline components to extract (verify current line via grep of the component name):
- `WorkoutHistoryList` (~73), `ProgressInsightCard` (~337), `WeightTab` (~1190), `MeasurementsTab` (~1457),
  `RecoveryTab` (~1617), `StrengthTab` (~1980), `RecoveryBar` (~2625), `AddWeightModal` (~2661),
  `AddMeasurementModal` (~2808), `AddRecoveryModal` (~2967), `SliderInput` (~3190).
Suggested layout: `progress/tabs/{WeightTab,MeasurementsTab,RecoveryTab,StrengthTab}.tsx`,
`progress/modals/{AddWeightModal,AddMeasurementModal,AddRecoveryModal}.tsx`,
`progress/components/{WorkoutHistoryList,ProgressInsightCard,RecoveryBar,SliderInput}.tsx`.
Keep `Progress.tsx` as the tab-orchestrating shell. Extract shared chart helpers into `progress/charts/`.
Watch for shared state/handlers passed down — pass them as props (don't recreate state in children).

### Settings.tsx (2000 lines) → extract UI primitives to `src/components/ui/`
Inline primitives: `SectionLabel` (~118), `SettingsCard` (~141), `SettingsRow` (~165), `Toggle` (~204),
`NumberInput` (~263), `SaveButton` (~314), `ProfileAvatar` (~360). Move these to `components/ui/` (some,
like `Toggle`/`NumberInput`, may already have cousins there — reuse/merge rather than duplicate). Keep the
handlers (`handleSyncToCloud`, `handlePullFromCloud`, `handleSyncAll`, `handleDeleteAllData`,
`handleSignOut`, etc.) in `Settings.tsx`; optionally extract a `useSettingsSync` hook for the sync logic.

### Login.tsx (1691 lines) → `src/pages/login/`
Inline: `AnnualInput` (~124), `AnnualPasswordInput` (~231), `AnnualButton` (~336 — feed into §C4 Button),
`GhostLink` (~448), `Masthead` (~477), `ChoiceStep` (~552), `SignInStep` (~794), `SignUpStep` (~1028),
`ForgotPasswordStep` (~1367), and the `LoginPage` shell (~1562). Extract inputs to `components/ui/`, the
steps to `login/steps/`, and keep `LoginPage` as the step router.

### ActiveWorkoutNew.tsx (1400 lines, ~46 useCallback handlers) → extract hooks
Extract custom hooks (under `src/components/workout/hooks/`):
- `useWorkoutSave` — pull out `handleConfirmFinish` (~141 lines) and related save/finish logic.
- `useSupersetMode` — superset state + handlers.
- `useExerciseSuggestions` — suggestion fetching/state.
- swipe-handling logic → a `useSwipeNavigation` (or similar) hook.
This is the RISKIEST split (effects, refs, timers, state interplay). Move one hook at a time, verify the
live workout flow (start → log sets → rest timer → finish → summary) after EACH extraction. Watch effect
dependency arrays and ref identity.

---

## §C8 — PageThemeContext (decide)

`src/contexts/PageThemeContext` sets CSS variables but every route uses the SAME accent `#43C7A5`, and
`isDark` is hardcoded `false` (never reads SettingsContext).
**Two valid directions — DEFAULT: option (a):**
(a) Give each route a distinct accent (real per-page theming) AND wire `isDark` to read
   `useSettings().settings.darkMode`. OR
(b) If uniform color is intended, delete the per-page abstraction and inline the single accent, and still
   wire `isDark` to SettingsContext.
Confirm with the user which they want; if unavailable, do (a) (it's the feature the abstraction implies).

---

## RestTimerOverlay — decide (dead-code candidate)

`src/components/workout/overlays/RestTimerOverlay.tsx` (909 lines) is NEVER rendered (only `InlineRestTimer`
is used). It's exported through the workout barrel as public API. The original plan assumed it was used.
**DECIDE:** if it's an abandoned/duplicate of `InlineRestTimer` → delete it + remove its barrel exports
(`overlays/index.tsx`, `components/workout/index.tsx`). If it's an intentionally-disabled feature to be
re-enabled → leave it and add a `// TODO: not currently mounted` note. **DEFAULT:** ask the user; if
unavailable, leave it (deleting 909 lines of intentional work is destructive).

---

## §F1 — CSS consolidation (HIGHEST visual risk — do last, app running)

`src/styles/global.css` (1210) and `src/styles/components.css` (1271) are BOTH imported in `main.tsx`
(components.css last → it wins on conflicts). Duplicate selectors with DIFFERENT values:
`.card`, `.btn-primary`, `.glass`, `.badge`, `.input`; duplicate `@keyframes shimmer` / `spin`.
**Method (per selector, NOT batched):**
1. `grep -n "\.card\b\|\.btn-primary\b\|\.glass\b\|\.badge\b\|\.input\b\|@keyframes shimmer\|@keyframes spin"`
   in both files. Diff each duplicated block.
2. Decide the intended final value (usually the components.css "winner" since it loads last).
3. Keep ONE definition, delete the other.
4. **After EACH selector**: reload the app and visually compare every component that uses it. Cascade
   interactions are subtle — do not batch.
5. Consider moving shared primitives into a Tailwind `@layer components` if it matches project direction.
Note: the `--z-*` CSS tokens were already removed (dead); the live z-index system is `src/constants/zIndex.ts`.

---

## §F5 — i18n (largest, lowest priority)

Hebrew strings are hardcoded across 100+ components. Introduce a lightweight i18n layer incrementally:
a `t()` helper + JSON dictionaries (e.g. `src/i18n/he.json`). Migrate screen-by-screen; do NOT attempt all
at once. Lowest priority — only after everything above is stable.

---

## §G — OPTIONAL: pre-existing Biome lint/format debt (~343 + ~33 errors)

NOT introduced by recent work; CI's lint/format steps were already red. Mostly a11y
`useSemanticElements` (interactive `role="button"` on `<div>`s → convert to `<button>` or fix roles),
`noSvgWithoutTitle`, `useFocusableInteractive`. Large, mechanical, and touches many files. Tackle only if the
goal is a green CI lint step. Run `npx biome check ./src` to enumerate; fix per-rule; re-run after each batch.
Do NOT use `biome check --fix --unsafe` blindly — review each change (some a11y fixes alter DOM semantics).

---

## FINAL VERIFICATION (before declaring done)
1. `npx tsc --noEmit` — 0 errors.
2. `npm run test:run` — all pass (incl. `no-emoji`).
3. `npm run build` — succeeds.
4. `npm run lint:check` — at minimum NO NEW errors vs the pre-existing baseline (ideally clean if §G done).
5. Manual smoke test (app running): start/finish a workout (rest timer + summary + PR detection),
   log water/meal/weight (correct calendar day), open AI dashboard/insight (force an AI error to see the
   Hebrew fallback), Login/SignUp/ForgotPassword flow, Settings sync to/from cloud, PWA install (icon/theme),
   and visually diff every screen touched by §F1/§F2.

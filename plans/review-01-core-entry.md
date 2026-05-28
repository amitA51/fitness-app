# SparkOS Fitness — Deep Dive Review: Core & Entry Files

> **Review Date:** 2026-05-27  
> **Reviewer:** Roo (Automated Code Review)  
> **Scope:** 16 files — App entry point, router, types, constants, errors, Supabase client, CSS architecture  
> **Severity Scale:** 🔴 Critical · 🟠 High · 🟡 Medium · 🔵 Low · ⚪ Info

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [File-by-File Analysis](#2-file-by-file-analysis)
   - [2.1 src/main.tsx](#21-srccomponentsmaintsx)
   - [2.2 src/App.tsx](#22-srcapptsx)
   - [2.3 src/vite-env.d.ts](#23-srcvite-envdts)
   - [2.4 src/types/index.ts](#24-srctypesindexts)
   - [2.5 src/constants/index.ts](#25-srcconstantsindexts)
   - [2.6 src/constants/workoutConstants.ts](#26-srcconstantsworkoutconstantsts)
   - [2.7 src/constants/zIndex.ts](#27-srcconstantszindexts)
   - [2.8 src/errors/index.ts](#28-srcerrorsindexts)
   - [2.9 src/errors/PageErrorBoundary.tsx](#29-srcerrorspageerrorboundarytsx)
   - [2.10 src/errors/RootErrorBoundary.tsx](#210-srcerrorsrooterrorboundarytsx)
   - [2.11 src/lib/supabase.ts](#211-srclibsupabasets)
   - [2.12 src/styles/tokens.css](#212-srcstylestokenscss)
   - [2.13 src/styles/global.css](#213-srcstylesglobalcss)
   - [2.14 src/styles/components.css](#214-srcstylescomponentscss)
   - [2.15 src/styles/motion.css](#215-srcstylesmotioncss)
   - [2.16 src/styles/typography.css](#216-srcstylestypographycss)
3. [Cross-Cutting Analysis](#3-cross-cutting-analysis)
   - [3.1 Type System Assessment](#31-type-system-assessment)
   - [3.2 Constants Organization](#32-constants-organization)
   - [3.3 Error Boundary Coverage](#33-error-boundary-coverage)
   - [3.4 CSS Architecture](#34-css-architecture)
4. [Issue Summary Table](#4-issue-summary-table)
5. [Recommendations Priority Matrix](#5-recommendations-priority-matrix)

---

## 1. Executive Summary

The SparkOS Fitness core and entry layer is **solidly built with clear intent**, featuring proper code-splitting, error boundaries at multiple levels, a well-structured CSS token system, and comprehensive type definitions. The codebase shows evidence of iterative refinement — legacy aliases, backward-compat shims, and design system evolution from a "bone/navy" palette to "Fresh Steel."

**Key Strengths:**
- Clean entry point with proper Sentry, Web Vitals, and PWA initialization
- Two-tier error boundary architecture (Root + Page)
- Comprehensive CSS custom property system with light/dark mode
- Proper `reduce-motion` accessibility throughout all CSS
- RTL support baked into the design system

**Key Concerns:**
- [`src/App.tsx`](src/App.tsx) is a 512-line "god component" mixing routing, auth gating, onboarding, scroll management, and workout placeholder logic
- [`src/types/index.ts`](src/types/index.ts) has significant type bloat and overlap (`Exercise` vs `PersonalExercise` vs `PersonalItem`)
- Duplicate CSS class definitions across [`global.css`](src/styles/global.css) and [`components.css`](src/styles/components.css)
- Legacy variable aliases creating confusion and dead code surface area
- Hardcoded Hebrew strings without i18n infrastructure

---

## 2. File-by-File Analysis

### 2.1 [`src/main.tsx`](src/main.tsx)

**Purpose:** Application bootstrap — initializes Sentry, axe-core, Web Vitals, AI service, notifications, global error handlers, renders root React tree, and registers PWA service worker.

**Lines:** 94 | **Responsibility:** Entry point / bootstrap orchestration

#### Issues

| # | Severity | Line(s) | Issue | Recommendation |
|---|----------|---------|-------|----------------|
| M-01 | 🟠 High | 46–62 | **Global error handlers duplicate Sentry's own `onError`/`onUnhandledRejection` hooks.** When Sentry is initialized, it already captures uncaught errors and unhandled rejections. The manual `window.addEventListener` calls result in double-reporting. | Remove the manual `window.addEventListener` handlers or configure Sentry's `integrations` to disable its default handlers if custom behavior is needed. |
| M-02 | 🟡 Medium | 66–73 | **Silent `.catch(() => {})` swallows notification permission errors.** If `requestNotificationPermission` or `checkMissedWorkouts` throws, there's no logging. | Add `logger.app.warn(...)` in the catch block. |
| M-03 | 🟡 Medium | 21 | **Redundant type assertion `as string \| undefined`** on `import.meta.env.VITE_SENTRY_DSN`. Vite's `ImportMetaEnv` typing already handles this if [`vite-env.d.ts`](src/vite-env.d.ts) is properly configured. | Declare the env vars in a custom `ImportMetaEnv` interface in [`vite-env.d.ts`](src/vite-env.d.ts) instead of casting inline. |
| M-04 | 🔵 Low | 14–18 | **CSS import order** — `global.css` is imported before `tokens.css`, but `global.css` references token variables. This works because CSS custom properties are resolved at render time, but the logical order should be tokens first. | Reorder to: `tokens.css` → `typography.css` → `global.css` → `components.css` → `motion.css`. |
| M-05 | ⚪ Info | 32–41 | **axe-core loaded asynchronously with `.catch(() => {})`.** This is fine for dev, but the empty catch could hide import resolution errors. | Log a debug message: `logger.app.debug('axe-core not available')`. |

#### Quality Score: 7.5/10
Clean and well-organized bootstrap. The main concern is redundant error handling and import ordering.

---

### 2.2 [`src/App.tsx`](src/App.tsx)

**Purpose:** The application shell — provides auth context, routing, lazy-loaded page code-splitting, onboarding gate, scroll position management, page transitions, workout placeholder, and helper functions.

**Lines:** 512 | **Responsibility:** Router + Auth Gate + Onboarding Gate + App Shell + Workout Placeholder + Helpers

#### Issues

| # | Severity | Line(s) | Issue | Recommendation |
|---|----------|---------|-------|----------------|
| A-01 | 🔴 Critical | 1–512 | **SRP violation — single file has 7+ distinct responsibilities.** Auth gating, routing, onboarding, scroll management, workout placeholder, page accent mapping, and helper functions are all in one file. This makes the file difficult to test, navigate, and maintain. | Extract into: `AppRouter.tsx`, `AppShell.tsx`, `WorkoutPlaceholder.tsx`, `OnboardingGate.tsx`, `pageAccentMap.ts`, `onboardingHelpers.ts`. |
| A-02 | 🟠 High | 486–509 | **`saveOnboardingData()` duplicates the profile hydration logic** from the `useEffect` at lines 182–209. Both write the same `user_profile` and `workout_prefs` to `localStorage` with identical structure. | Create a single `hydrateUserProfile(data: OnboardingData)` function and call it from both places. |
| A-03 | 🟠 High | 461–484 | **Hardcoded Hebrew strings in `getWeightGoalFromOnboarding` and `getActivityLevelFromOnboarding`.** These functions return Hebrew strings that are stored in `localStorage` as user data. This couples the data layer to the UI locale. | Store English keys in `localStorage` and translate at render time, or use an enum/constant map. |
| A-04 | 🟡 Medium | 267–268 | **Workout routes (`/workout`, `/workout/:templateId`) are NOT wrapped in `PageErrorBoundary`**, unlike every other route. If the workout component throws, the error propagates to `RootErrorBoundary` with no graceful recovery. | Wrap `<WorkoutPlaceholder />` in `<PageErrorBoundary pageLabel="אימון">`. |
| A-05 | 🟡 Medium | 51–54 | **Dynamic import of `WorkoutContent` uses a non-standard pattern** (`mod.WorkoutContent`). If the export is renamed or the module structure changes, this silently breaks at runtime. | Export `WorkoutContent` as default, or add a TypeScript assertion on the import shape. |
| A-06 | 🟡 Medium | 104–113 | **`placeholderItem` is a module-level mutable object** with a hardcoded Hebrew title. It's passed to `WorkoutProvider` and `WorkoutContent` as props, meaning every workout session starts with this stale reference. | Use `useMemo` or create a factory function. The Hebrew string should be a constant. |
| A-07 | 🟡 Medium | 389–403 | **`AppRoutes` is rendered twice** when `reduceMotion` is false — once inside the `AnimatePresence` and the component tree is duplicated. The `motion.div` wrapper is fine, but `AppRoutes` creates the entire route tree each time. | This is actually correct for AnimatePresence semantics, but note that `location` is passed as a prop to avoid stale closures. No action needed, but worth documenting. |
| A-08 | 🔵 Low | 315 | **`memo(BottomNav)`** — The `memo` is applied but there's no evidence that `BottomNav` receives changing props. If it's a pure component or only reads from context, the memo is unnecessary overhead. | Verify if `BottomNav` receives props that change on route navigation; if not, remove `memo`. |
| A-09 | 🔵 Low | 66–67 | **Hebrew `aria-label` in `PageLoader`** — `"טוען"` is hardcoded. For an i18n-ready app, this should use the app's locale system. | Acceptable for now if the app is Hebrew-only, but document this as a future i18n concern. |
| A-10 | 🔵 Low | 129–137 | **`PATH_LABEL_MAP` duplicates route patterns** from `PATH_ACCENT_MAP`. Both arrays iterate the same routes. | Merge into a single `PATH_CONFIG_MAP: Array<[RegExp, PageAccent, string]>` to keep accent and label in sync. |
| A-11 | ⚪ Info | 227–232 | **Login page creates its own `BrowserRouter`** at line 227, while the main app creates another at line 245. This means the login screen and authenticated app are in separate router contexts. | This is intentional (login doesn't need app routes), but should be documented. |

#### Quality Score: 5.5/10
Functional but suffers from god-component syndrome. The file needs significant decomposition.

---

### 2.3 [`src/vite-env.d.ts`](src/vite-env.d.ts)

**Purpose:** TypeScript declarations for Vite and PWA plugin client types.

**Lines:** 2 | **Responsibility:** Type augmentation

#### Issues

| # | Severity | Line(s) | Issue | Recommendation |
|---|----------|---------|-------|----------------|
| V-01 | 🟡 Medium | 1–2 | **Missing custom `ImportMetaEnv` declarations.** The app uses `VITE_SENTRY_DSN`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` with inline `as` casts throughout the codebase. | Add an `interface ImportMetaEnv` block declaring all `VITE_*` environment variables with proper types to eliminate runtime casts. |

```typescript
// Recommended addition:
interface ImportMetaEnv {
  readonly VITE_SENTRY_DSN?: string;
  readonly VITE_SUPABASE_URL?: string;
  readonly VITE_SUPABASE_ANON_KEY?: string;
  // ... other env vars
}
```

#### Quality Score: 6/10
Functional but underutilized — should be the single source of truth for env var types.

---

### 2.4 [`src/types/index.ts`](src/types/index.ts)

**Purpose:** Central TypeScript type definitions for the entire application domain model — workouts, exercises, nutrition, settings, analytics, UI.

**Lines:** 533 | **Responsibility:** Domain type definitions

#### Issues

| # | Severity | Line(s) | Issue | Recommendation |
|---|----------|---------|-------|----------------|
| T-01 | 🔴 Critical | 120–150, 321–356 | **The `Exercise` interface (120) and `PersonalItem` interface (321) have massive field overlap.** `PersonalItem` contains 20+ optional fields that duplicate `Exercise` properties (`targetMuscle`, `muscleGroup`, `equipment`, `instructions`, `isCustom`, `isTimed`, etc.). This suggests `PersonalItem` is a "catch-all" type used for multiple domain concepts. | Split `PersonalItem` into domain-specific union types: `PersonalItem = WorkoutItem \| ExerciseLibraryItem \| NoteItem`. Use discriminated unions with a `type` field. |
| T-02 | 🟠 High | 29–46, 88–105 | **`WorkoutExercise` and `WorkoutTemplateExercise` share 80%+ identical fields** (`id`, `exerciseId`, `exerciseName`, `targetMuscle`, `restSeconds`, `order`, `notes`, plus optional `name`, `muscleGroup`, `tempo`). | Create a `BaseExercise` interface and extend it: `WorkoutExercise extends BaseExercise` and `WorkoutTemplateExercise extends BaseExercise`. |
| T-03 | 🟠 High | 303 | **`WorkoutTheme` type has 5 theme values** but there's no corresponding validation or enum. If a new theme is added, the type and any switch statements must be updated manually. | Create a `WORKOUT_THEMES` constant array and derive the type: `type WorkoutTheme = typeof WORKOUT_THEMES[number]`. |
| T-04 | 🟡 Medium | 390–486 | **`WorkoutSettings` is a 50+ field interface** with no grouping or documentation. It mixes display, behavior, audio, reminders, accessibility, progressive overload, smart rest, workout flow, PR, timer, quick actions, gym mode, body weight, and analytics settings. | Split into sub-interfaces: `DisplaySettings`, `AudioSettings`, `ReminderSettings`, `AccessibilitySettings`, `ProgressionSettings`, etc. and compose them into `WorkoutSettings`. |
| T-05 | 🟡 Medium | 488–495 | **`AppSettings` duplicates fields from `WorkoutSettings`.** `soundEnabled`, `keepAwake`, and `theme` appear in both `AppSettings` and `WorkoutSettings`. | `AppSettings` should reference `WorkoutSettings` and only add top-level settings not covered by it. |
| T-06 | 🟡 Medium | 512–532 | **`Screen` type contains suspicious values** that don't belong in a fitness app: `'passwords'`, `'investments'`, `'views'`, `'logos'`, `'signup'`, `'feed'`, `'assistant'`, `'search'`. These appear to be copy-pasted from another project. | Audit and remove unused screen types. Keep only: `'dashboard' \| 'workout' \| 'history' \| 'templates' \| 'settings' \| 'nutrition' \| 'progress'`. |
| T-07 | 🟡 Medium | 48–71 | **`WorkoutSession` has 22 fields**, many optional (`userId?`, `workoutItemId?`, `goalType?`, `lastUsed?`, `timesUsed?`, `isFavorite?`, `muscleGroups?`, `isBuiltin?`). Several of these (`isFavorite`, `timesUsed`, `isBuiltin`) belong to `WorkoutTemplate`, not a session. | Audit which fields are actually used on sessions vs templates and split accordingly. |
| T-08 | 🟡 Medium | 373–384 | **`createWorkoutSet` is a runtime factory function in a types file.** Type files should contain only type declarations and minimal type guards. | Move to `src/utils/workoutHelpers.ts` or `src/factories/workout.ts`. |
| T-09 | 🔵 Low | 111–118 | **`ProgramExtras` has `[key: string]: unknown` index signature**, which undermines type safety. Any property can be added without compile-time checks. | Define explicit optional fields or use a stricter index signature with a union type. |
| T-10 | 🔵 Low | 40 | **`name?: string` comment says "Alias for exerciseName (backward compatibility)"** — this backward-compat pattern appears on multiple interfaces. | Create a migration plan to consolidate `name`/`exerciseName` and remove the aliases. |

#### Quality Score: 5/10
The type system covers the domain well but suffers from bloat, duplication, and contamination from unrelated projects.

---

### 2.5 [`src/constants/index.ts`](src/constants/index.ts)

**Purpose:** Re-exports all constants and defines `STORAGE_KEYS`.

**Lines:** 18 | **Responsibility:** Constants barrel + storage key definitions

#### Issues

| # | Severity | Line(s) | Issue | Recommendation |
|---|----------|---------|-------|----------------|
| C-01 | 🟡 Medium | 13 | **`LOCAL_STORAGE_KEYS` is an alias for `STORAGE_KEYS`.** This creates two names for the same thing. | Remove the alias or deprecate it with a `@deprecated` JSDoc tag. |
| C-02 | 🔵 Low | 2–10 | **`STORAGE_KEYS` is not `as const`**, so its values are typed as `string` rather than string literals. | Add `as const` for stricter typing: `export const STORAGE_KEYS = { ... } as const;`. |

#### Quality Score: 7/10
Minimal and clean. Minor typing improvement needed.

---

### 2.6 [`src/constants/workoutConstants.ts`](src/constants/workoutConstants.ts)

**Purpose:** Centralized workout-related constants — defaults, limits, muscle groups, exercise categories, meal types, workout status, PR types.

**Lines:** 72 | **Responsibility:** Domain constants

#### Issues

| # | Severity | Line(s) | Issue | Recommendation |
|---|----------|---------|-------|----------------|
| W-01 | 🔵 Low | 30–41 | **`MUSCLE_GROUPS` uses mixed casing** — some values are title-case (`'Chest'`, `'Back'`), while the key `ALL` maps to lowercase `'all'`. The `ABS` key duplicates `CORE` semantically. | Standardize to lowercase kebab-case keys and values. Document the distinction between `CORE` and `ABS`. |
| W-02 | ⚪ Info | 52–59 | **`MEAL_TYPES` defines meal categories** but this is nutrition-domain, not workout-domain. | Consider moving to a `nutritionConstants.ts` file. |

#### Quality Score: 8/10
Well-organized with `as const`. Good use of comments.

---

### 2.7 [`src/constants/zIndex.ts`](src/constants/zIndex.ts)

**Purpose:** Centralized z-index layering constants.

**Lines:** 23 | **Responsibility:** Z-index scale

#### Issues

| # | Severity | Line(s) | Issue | Recommendation |
|---|----------|---------|-------|----------------|
| Z-01 | 🟠 High | 5–18 vs [`tokens.css:281–290`](src/styles/tokens.css:281) | **Z-index values are defined in TWO places** — [`zIndex.ts`](src/constants/zIndex.ts) (JS) and [`tokens.css`](src/styles/tokens.css) (CSS `--z-*` variables) — with **different values**. JS: `modal=1100`, `toast=1400`, `overlay=1500`. CSS: `modal=90`, `toast=100`, `overlay=80`. This creates a maintenance hazard where JS-controlled z-indexes and CSS-controlled z-indexes can conflict. | Consolidate to a single source of truth. Either generate CSS from the JS constants, or vice versa. Document which system to use. |
| Z-02 | 🔵 Low | 21 | **`Z_INDEX` is a redundant alias** for `zIndex`. | Remove `Z_INDEX` or deprecate it. |

#### Quality Score: 6/10
Good intent but dual-definition problem is a real risk.

---

### 2.8 [`src/errors/index.ts`](src/errors/index.ts)

**Purpose:** Custom error class hierarchy and utility functions.

**Lines:** 56 | **Responsibility:** Error types + error handling utilities

#### Issues

| # | Severity | Line(s) | Issue | Recommendation |
|---|----------|---------|-------|----------------|
| E-01 | 🟡 Medium | 9–14 | **`AppError` doesn't capture a `code` or `cause` property.** Modern error handling benefits from error codes for programmatic handling and `cause` for error chaining (supported in ES2022). | Add `code?: string` and use `Error(message, { cause })` constructor pattern. |
| E-02 | 🟡 Medium | 49–51 | **`handleError` only logs — it doesn't report to Sentry or re-throw.** Callers may assume it handles the error completely, but it just logs. | Either rename to `logError` for clarity, or add Sentry reporting and optional re-throw. |
| E-03 | 🔵 Low | 53–55 | **`isAppError` type guard uses `instanceof`**, which breaks across iframe/realm boundaries and after code transpilation in some bundler configs. | Acceptable for same-realm usage; document the limitation. |

#### Quality Score: 7/10
Clean hierarchy. Missing `code`/`cause` is the main gap.

---

### 2.9 [`src/errors/PageErrorBoundary.tsx`](src/errors/PageErrorBoundary.tsx)

**Purpose:** React error boundary for individual page routes — catches rendering errors and shows a localized recovery UI.

**Lines:** 78 | **Responsibility:** Page-level error isolation

#### Issues

| # | Severity | Line(s) | Issue | Recommendation |
|---|----------|---------|-------|----------------|
| PE-01 | 🟡 Medium | 23–28 | **`componentDidCatch` logs but doesn't report to Sentry.** The `RootErrorBoundary` reports to Sentry, but `PageErrorBoundary` only uses `logger`. Since `PageErrorBoundary` catches errors before they reach `RootErrorBoundary`, Sentry never sees page-level errors. | Add `Sentry.captureException(error, { contexts: { react: { componentStack: info.componentStack } } })`. |
| PE-02 | 🔵 Low | 77 | **`export default PageErrorBoundary`** is redundant since it's already named-exported at line 16 and re-exported from [`errors/index.ts`](src/errors/index.ts:7). | Remove the default export to avoid confusion about which import style to use. |

#### Quality Score: 7.5/10
Good UX with Hebrew localized error messages. Missing Sentry integration.

---

### 2.10 [`src/errors/RootErrorBoundary.tsx`](src/errors/RootErrorBoundary.tsx)

**Purpose:** Top-level React error boundary — catches catastrophic errors that escape page boundaries.

**Lines:** 146 | **Responsibility:** Last-resort error UI

#### Issues

| # | Severity | Line(s) | Issue | Recommendation |
|---|----------|---------|-------|----------------|
| RE-01 | 🟡 Medium | 41–43 | **`handleReset` sets state to clear the error but doesn't attempt to re-render children.** After `setState({ hasError: false })`, if the underlying error persists, it will re-throw synchronously and cause an infinite error loop. | Add a retry counter and after N retries, force a page reload instead of resetting state. |
| RE-02 | 🟡 Medium | 56–143 | **The fallback UI uses inline `style` objects** (50+ lines of inline styles), while [`PageErrorBoundary`](src/errors/PageErrorBoundary.tsx:41–74) uses Tailwind classes. This inconsistency means the root boundary can't benefit from the design token system. | Use Tailwind classes + CSS custom properties consistently, matching [`PageErrorBoundary`](src/errors/PageErrorBoundary.tsx)'s approach. |
| RE-03 | 🔵 Low | 45–47 | **`handleReload` doesn't have a `typeof window` guard** unlike [`PageErrorBoundary`](src/errors/PageErrorBoundary.tsx:36). If rendered in SSR, this will throw. | Add the guard for consistency. |

#### Quality Score: 7/10
Sentry integration is good. Style inconsistency and retry-loop risk need attention.

---

### 2.11 [`src/lib/supabase.ts`](src/lib/supabase.ts)

**Purpose:** Supabase client initialization with graceful offline fallback.

**Lines:** 19 | **Responsibility:** Supabase client singleton

#### Issues

| # | Severity | Line(s) | Issue | Recommendation |
|---|----------|---------|-------|----------------|
| S-01 | 🟡 Medium | 8–9 | **Environment variables are cast with `as string \| undefined`** instead of using the typed `ImportMetaEnv` approach. | Define in [`vite-env.d.ts`](src/vite-env.d.ts) and remove casts. |
| S-02 | 🔵 Low | 15 | **`supabase` is `null` when not configured.** Every consumer must null-check. Consider a pattern where the client is always defined but operations no-op. | This is actually a reasonable pattern for optional Supabase — document it clearly. |
| S-03 | 🔵 Low | 19 | **`export type SupabaseClient = SupabaseClientType`** — re-exporting the type with a local alias. The alias name is identical to the import, creating potential confusion. | Remove the re-export; consumers can import directly from `@supabase/supabase-js`. |

#### Quality Score: 8/10
Clean and minimal. Good offline-first pattern.

---

### 2.12 [`src/styles/tokens.css`](src/styles/tokens.css)

**Purpose:** Design token definitions — color palette, typography, spacing, shadows, motion, z-index, layout, and dark mode variant.

**Lines:** 454 | **Responsibility:** CSS custom properties (design tokens)

#### Issues

| # | Severity | Line(s) | Issue | Recommendation |
|---|----------|---------|-------|----------------|
| CSS-01 | 🟠 High | 28–46 | **Massive legacy alias block** — 14 legacy variable names (`--bone`, `--navy`, `--mustard`, `--ink`, `--stone`, etc.) are mapped to new `--fs-*` values. These aliases are duplicated in the dark mode block (lines 334–346). This doubles the maintenance surface. | Audit which legacy variables are still used. Create a migration script to replace all legacy references with `--fs-*` names, then remove the aliases. |
| CSS-02 | 🟠 High | 281–290 vs [`zIndex.ts`](src/constants/zIndex.ts:5) | **Z-index scale in CSS differs from JS constants** (see Z-01 above). CSS uses small values (0–110), JS uses large values (0–19999). | Consolidate (see Z-01 recommendation). |
| CSS-03 | 🟡 Medium | 50–101 | **Many `--color-*` variables are thin wrappers** around `--fs-*` variables (e.g., `--color-primary: var(--fs-primary)`). This adds a layer of indirection without clear benefit. | Either use `--fs-*` directly everywhere, or make `--color-*` the primary API and remove direct `--fs-*` usage in components. Pick one naming convention. |
| CSS-04 | 🟡 Medium | 94–101 | **All `--accent-*` page tokens map to the same value** (`var(--fs-accent)`). They were presumably intended for per-page accent colors but were never differentiated. | Either differentiate them or remove the per-page accent tokens and use `--fs-accent` directly. |
| CSS-05 | 🔵 Low | 169–180 | **Typography size scale includes `--text-display-hero: 120px`** — a 120px font size on mobile is extreme. This is likely only used in workout hero displays. | Document usage constraints. Consider responsive clamping with `clamp()`. |
| CSS-06 | 🔵 Low | 259–275 | **Duplicate motion easing variables** — `--ease-spring-bouncy` (line 130) and `--ease-spring-bounce` (line 264) are defined separately but have similar names. `--ease-spring-smooth` (line 265) aliases `--ease-out`. | Consolidate naming: pick one convention (`-bouncy` or `-bounce`) and remove the duplicate. |

#### Quality Score: 7/10
Comprehensive token system with excellent dark mode support. Legacy aliases and naming inconsistencies are the main issues.

---

### 2.13 [`src/styles/global.css`](src/styles/global.css)

**Purpose:** Global styles — Tailwind directives, base resets, component utilities (cards, buttons, inputs), active workout UI, editorial layout components, animations, view transitions, swipe gestures, mobile optimizations.

**Lines:** 1211 | **Responsibility:** Global/base styles + component utilities + layout systems

#### Issues

| # | Severity | Line(s) | Issue | Recommendation |
|---|----------|---------|-------|----------------|
| G-01 | 🔴 Critical | 1–1211 | **This 1211-line CSS file is a "god stylesheet."** It contains base resets, Tailwind layers, card systems, button systems, input systems, active workout UI (masthead, hero, sets), editorial layout (chapter heads, data strips, skill bars), Fresh Steel cards/panels, utility classes, animations, view transitions, swipe gestures, mobile keyboard handling, touch optimizations, scroll performance, and bottom sheet enhancements. | Split into focused files: `base.css`, `workout-active.css`, `editorial.css`, `swipe.css`, `mobile.css`. |
| G-02 | 🟠 High | 109–117, 144–173 vs [`components.css`](src/styles/components.css:11–18, 96–169) | **`.card` and `.btn-primary` are defined in BOTH `global.css` and `components.css` with DIFFERENT styles.** `global.css` `.card` uses `border-radius: 18px` and `background-color: var(--fs-surface-2)`. `components.css` `.card` uses `border-radius: var(--radius-2xl)` and `background: var(--color-surface)`. The last-loaded file wins, creating implicit ordering dependencies. | Remove duplicate definitions. Decide which file owns each component class and delete the other. |
| G-03 | 🟠 High | 824–828 vs [`components.css`](src/styles/components.css:385–390) | **`.glass` is defined in both files** — `global.css` uses `color-mix(in srgb, var(--fs-surface) 90%, transparent)` while `components.css` uses `color-mix(in srgb, var(--fs-surface) 82%, transparent)` with different blur values. | Consolidate to one definition. |
| G-04 | 🟡 Medium | 867–880 | **`@keyframes shimmer` and `@keyframes spin` are duplicated** in both `global.css` and [`motion.css`](src/styles/motion.css:57–71). | Define keyframes in one file only (`motion.css` is the logical home). |
| G-05 | 🟡 Medium | 904–913 | **`@media (prefers-reduced-motion: reduce)` block is duplicated** in `global.css` and [`motion.css`](src/styles/motion.css:345–357). | Consolidate to `motion.css`. |
| G-06 | 🟡 Medium | 842–846 vs [`components.css`](src/styles/components.css:488–492) | **`.flex-center` is defined in both files.** | Remove from one file. |
| G-07 | 🟡 Medium | 806–813 vs [`components.css`](src/styles/components.css:452–459) | **`.no-scrollbar` is defined in both files.** | Remove from one file. |
| G-08 | 🟡 Medium | 940–942 | **`[style*="contain"] { contain: layout style; }`** — This selector matches ANY element with a `style` attribute containing the word "contain", which is extremely broad and could match unintended elements. | Remove this rule; containment should be applied explicitly per component. |
| G-09 | 🔵 Low | 956–958 | **`main > *` applies `pageEnter` animation to ALL direct children of main**, including non-page elements. This could cause unexpected animation on utility divs. | Scope the animation to page route wrappers. |
| G-10 | 🔵 Low | 1093–1094 | **`var(--color-danger)` referenced** but not defined in [`tokens.css`](src/styles/tokens.css). The correct token is `--color-error`. | Fix to `var(--color-error)` or define `--color-danger`. |

#### Quality Score: 4.5/10
Overloaded file with significant duplication across the CSS architecture.

---

### 2.14 [`src/styles/components.css`](src/styles/components.css)

**Purpose:** Component-level CSS — card system, button system, badge system, input system, toggle switch, glass surfaces, skeleton loading, layout utilities, Fresh Steel components, premium layer.

**Lines:** 1272 | **Responsibility:** Component styles

#### Issues

| # | Severity | Line(s) | Issue | Recommendation |
|---|----------|---------|-------|----------------|
| CC-01 | 🔴 Critical | 1–1272 | **1272-line component stylesheet** contains 30+ component systems. Many duplicate definitions from [`global.css`](src/styles/global.css). | Split into per-component or per-system files. |
| CC-02 | 🟠 High | 149–169 vs [`global.css`](src/styles/global.css:145–173) | **`.btn-primary` redefined** with different hover/active states. `global.css` uses `background-color: #1A1A1A` on hover; `components.css` uses `filter: brightness(1.1)` + `transform: translateY(-1px)`. | Remove one definition entirely. |
| CC-03 | 🟡 Medium | 263–271 vs [`global.css`](src/styles/global.css:225–235) | **`.badge` redefined** with different padding and border-radius. | Consolidate. |
| CC-04 | 🟡 Medium | 302–330 vs [`global.css`](src/styles/global.css:201–222) | **`.input` redefined** with different border-radius and padding. | Consolidate. |
| CC-05 | 🟡 Medium | 699–721 | **`btn-primary-fs` and `btn-secondary-fs`** are Fresh Steel variants of `btn-primary`/`btn-secondary`. This naming convention (`-fs` suffix) suggests these were added without removing the originals. | Migrate all usage to the `-fs` variants and remove the originals, or vice versa. |
| CC-06 | 🔵 Low | 563–573 | **iOS font-size fix** uses `!important` on all input types below 768px. This is a common iOS zoom-prevention hack but overrides all explicit font-size settings. | Acceptable for iOS, but document why `!important` is needed. |
| CC-07 | ⚪ Info | 1043–1091 | **Premium layer classes** (`glass-surface`, `ambient-mesh`, `scrim-noise`, `breathing-dot`, `kinetic-number`, `magnetic-card`, `premium-shimmer`) are well-designed but form a "design system within a design system." | Consider extracting to a `premium.css` file with its own documentation. |

#### Quality Score: 4/10
Heavily duplicated with [`global.css`](src/styles/global.css). Needs consolidation.

---

### 2.15 [`src/styles/motion.css`](src/styles/motion.css)

**Purpose:** Animation keyframes, animation utility classes, stagger delays, transition utilities, reduced-motion handling, page-specific motion variants.

**Lines:** 420 | **Responsibility:** Motion/animation system

#### Issues

| # | Severity | Line(s) | Issue | Recommendation |
|---|----------|---------|-------|----------------|
| MO-01 | 🟡 Medium | 57–64 vs [`global.css`](src/styles/global.css:867–874) | **`@keyframes shimmer` duplicated.** | Remove from `global.css`. |
| MO-02 | 🟡 Medium | 67–71 vs [`global.css`](src/styles/global.css:876–880) | **`@keyframes spin` duplicated.** | Remove from `global.css`. |
| MO-03 | 🟡 Medium | 345–357 vs [`global.css`](src/styles/global.css:904–913) | **`@media (prefers-reduced-motion: reduce)` duplicated.** | Remove from `global.css`. |
| MO-04 | 🔵 Low | 359–370 | **`html.reduce-motion` class-based reduced motion** duplicates the `prefers-reduced-motion` media query. Both are present, which is good for the app's toggle, but the CSS is nearly identical. | Extract the shared reduced-motion styles into a mixin or shared rule. |
| MO-05 | 🔵 Low | 377–394 | **Page-specific motion variants** (`.page-dashboard`, `.page-workout`, etc.) reference class names that must be applied by the JS layer. | Document the required class name contract between JS and CSS. |

#### Quality Score: 7/10
Well-organized motion system. Duplication with `global.css` is the main issue.

---

### 2.16 [`src/styles/typography.css`](src/styles/typography.css)

**Purpose:** Typography system — font imports, base styles, display scale, heading scale, body scale, label/caption scale, font weight/height/spacing utilities, text colors, special components, RTL support, focus styles, page-specific typography.

**Lines:** 419 | **Responsibility:** Typography system

#### Issues

| # | Severity | Line(s) | Issue | Recommendation |
|---|----------|---------|-------|----------------|
| TY-01 | 🟠 High | 1 | **Google Fonts loaded via `@import url(...)` in CSS.** This is a render-blocking request. The comment in [`tokens.css`](src/styles/tokens.css:6) says "Google Fonts loaded via index.html with preconnect," suggesting the fonts are ALSO loaded in HTML. This double-loading wastes bandwidth. | Remove the CSS `@import` if fonts are preloaded in `index.html`. Or use the CSS `@import` only and remove the HTML link. |
| TY-02 | 🟡 Medium | 28–41 | **All `h1-h6` headings forced to `text-transform: uppercase`.** This is a very aggressive global style that affects all heading elements including those in third-party components or user-generated content. | Scope the uppercase to `.heading` class and specific page contexts, not bare `h1-h6`. |
| TY-03 | 🟡 Medium | 367–386 vs [`global.css`](src/styles/global.css:58–76) | **`.skip-link` defined in both files** with different positioning. `global.css` uses `top: -100%`, `typography.css` uses `transform: translateY(-150%)`. | Consolidate to one definition. |
| TY-04 | 🔵 Low | 401–409 | **`.page-workout .page-title` has `font-size: 220px`.** This is extremely large and likely only works on desktop. | Use `clamp()` for responsive sizing. |
| TY-05 | 🔵 Low | 165–182 | **Font weight utilities** (`.font-normal` through `.font-black`) duplicate Tailwind's `font-thin` through `font-black`. | Remove if Tailwind is available, or document as non-Tailwind fallback. |

#### Quality Score: 6.5/10
Good typography scale design. Double font loading and aggressive global styles are concerns.

---

## 3. Cross-Cutting Analysis

### 3.1 Type System Assessment

**Strengths:**
- Comprehensive domain coverage (workouts, exercises, nutrition, settings, analytics)
- Proper use of `as const` for literal types
- Good use of optional fields for progressive enhancement

**Weaknesses:**
- **Type explosion:** [`Exercise`](src/types/index.ts:120), [`PersonalExercise`](src/types/index.ts:153), [`PersonalItem`](src/types/index.ts:321), [`WorkoutExercise`](src/types/index.ts:29), [`WorkoutTemplateExercise`](src/types/index.ts:88) — 5 types with 60%+ field overlap
- **Mixed concerns in [`WorkoutSession`](src/types/index.ts:48)** — contains template-level fields (`isFavorite`, `timesUsed`, `isBuiltin`)
- **[`Screen`](src/types/index.ts:512) type** has values from an unrelated project (`passwords`, `investments`, `logos`)
- **[`WorkoutSettings`](src/types/index.ts:390)** is a 50-field monolith with no grouping
- **Runtime code in types file** ([`createWorkoutSet`](src/types/index.ts:373))
- **No discriminated unions** — the type system doesn't leverage TypeScript's discriminated union pattern for polymorphic entities

**Recommendation:** Introduce a type hierarchy:

```typescript
// Base exercise (shared fields)
interface BaseExercise {
  id: string;
  exerciseId: string;
  exerciseName: string;
  targetMuscle: string;
  restSeconds: number;
  order: number;
  notes: string;
}

// Domain-specific extensions
interface WorkoutExercise extends BaseExercise { sets: WorkoutSet[]; ... }
interface TemplateExercise extends BaseExercise { targetSets: number; targetReps: number; ... }

// Discriminated union for personal items
type PersonalItem = 
  | { type: 'exercise'; ... }
  | { type: 'workout'; ... }
  | { type: 'note'; ... };
```

### 3.2 Constants Organization

**Current structure:**
- [`constants/index.ts`](src/constants/index.ts) — `STORAGE_KEYS` + re-exports
- [`constants/workoutConstants.ts`](src/constants/workoutConstants.ts) — workout, muscle, exercise, meal, status, PR constants
- [`constants/zIndex.ts`](src/constants/zIndex.ts) — z-index layering

**Assessment:** Reasonably organized but:
1. `MEAL_TYPES` belongs in a nutrition constants file
2. Z-index constants exist in both JS and CSS with conflicting values
3. No constants for route paths (hardcoded in [`App.tsx`](src/App.tsx:119–137))
4. No constants for `localStorage` keys used outside `STORAGE_KEYS` (e.g., `onboarding_completed`, `onboarding_data`, `user_profile`, `workout_prefs` in [`App.tsx`](src/App.tsx:172, 186, 189, 201))

### 3.3 Error Boundary Coverage

```
RootErrorBoundary (src/main.tsx:77)
  └── AuthProvider
       ├── AppRouter
       │    ├── [unauthenticated] Login — NO PageErrorBoundary ⚠️
       │    ├── [onboarding] OnboardingFlow — NO PageErrorBoundary ⚠️
       │    └── [authenticated] AppShell
       │         ├── PageErrorBoundary("הדשבורד") → Dashboard ✅
       │         ├── WorkoutPlaceholder — NO PageErrorBoundary ⚠️
       │         ├── PageErrorBoundary("עמוד התזונה") → Nutrition ✅
       │         ├── PageErrorBoundary("עמוד ההתקדמות") → Progress ✅
       │         ├── PageErrorBoundary("התבניות") → Templates ✅
       │         ├── PageErrorBoundary("פרטי האימון") → WorkoutDetail ✅
       │         └── PageErrorBoundary("ההגדרות") → Settings ✅
```

**Gaps:**
- 🔴 **Login page** — no error boundary; if Login throws, the entire app crashes to `RootErrorBoundary`
- 🔴 **OnboardingFlow** — no error boundary
- 🟠 **WorkoutPlaceholder** — no error boundary; workout is the most complex feature and most likely to throw
- 🟡 **PageErrorBoundary doesn't report to Sentry** — errors caught at page level are invisible in error tracking

### 3.4 CSS Architecture

**File inventory:**

| File | Lines | Purpose | Duplication Level |
|------|-------|---------|-------------------|
| [`tokens.css`](src/styles/tokens.css) | 454 | Design tokens | Low (legacy aliases) |
| [`typography.css`](src/styles/typography.css) | 419 | Typography system | Low |
| [`motion.css`](src/styles/motion.css) | 420 | Animation system | Medium (shimmer, spin, reduced-motion) |
| [`global.css`](src/styles/global.css) | 1211 | Base + components + layout + utilities | **High** (duplicates components.css) |
| [`components.css`](src/styles/components.css) | 1272 | Component styles | **High** (duplicates global.css) |

**Total:** 3,776 lines of CSS

**Key problems:**

1. **Dual-definition hell:** `.card`, `.btn-primary`, `.btn-secondary`, `.badge`, `.input`, `.glass`, `.flex-center`, `.no-scrollbar`, `.skip-link`, `.eyebrow`, `.section-title`, `@keyframes shimmer`, `@keyframes spin`, `@media (prefers-reduced-motion)` — all defined in multiple files with different values
2. **No clear ownership model:** There's no rule about which file owns which class
3. **Legacy alias debt:** 14+ legacy variable names (`--bone`, `--navy`, `--mustard`, etc.) still present
4. **Three naming conventions coexist:** `--fs-*` (new), `--color-*` (semantic), `--bone`/`--navy` (legacy)
5. **Good foundations:** Token system, dark mode, RTL support, reduced-motion, accessibility focus styles, and responsive design are all well-implemented

---

## 4. Issue Summary Table

| ID | Severity | File | Issue |
|----|----------|------|-------|
| A-01 | 🔴 | [`App.tsx`](src/App.tsx) | God component — 7+ responsibilities in 512 lines |
| T-01 | 🔴 | [`types/index.ts`](src/types/index.ts) | `Exercise`/`PersonalItem` massive field overlap |
| G-01 | 🔴 | [`global.css`](src/styles/global.css) | 1211-line god stylesheet |
| CC-01 | 🔴 | [`components.css`](src/styles/components.css) | 1272-line component stylesheet with duplicates |
| G-02 | 🟠 | [`global.css`](src/styles/global.css) + [`components.css`](src/styles/components.css) | `.card`, `.btn-primary` defined in both files differently |
| Z-01 | 🟠 | [`zIndex.ts`](src/constants/zIndex.ts) + [`tokens.css`](src/styles/tokens.css) | Z-index values conflict between JS and CSS |
| M-01 | 🟠 | [`main.tsx`](src/main.tsx) | Global error handlers duplicate Sentry hooks |
| A-02 | 🟠 | [`App.tsx`](src/App.tsx) | `saveOnboardingData` duplicates profile hydration |
| A-03 | 🟠 | [`App.tsx`](src/App.tsx) | Hardcoded Hebrew in localStorage data |
| T-02 | 🟠 | [`types/index.ts`](src/types/index.ts) | `WorkoutExercise`/`WorkoutTemplateExercise` field overlap |
| CSS-01 | 🟠 | [`tokens.css`](src/styles/tokens.css) | 14 legacy variable aliases duplicated in dark mode |
| TY-01 | 🟠 | [`typography.css`](src/styles/typography.css) | Double font loading (CSS + HTML) |
| T-04 | 🟡 | [`types/index.ts`](src/types/index.ts) | 50-field monolith `WorkoutSettings` |
| T-06 | 🟡 | [`types/index.ts`](src/types/index.ts) | `Screen` type has unrelated project values |
| A-04 | 🟡 | [`App.tsx`](src/App.tsx) | Workout routes missing `PageErrorBoundary` |
| PE-01 | 🟡 | [`PageErrorBoundary.tsx`](src/errors/PageErrorBoundary.tsx) | No Sentry reporting |
| RE-01 | 🟡 | [`RootErrorBoundary.tsx`](src/errors/RootErrorBoundary.tsx) | Retry loop risk on `handleReset` |
| V-01 | 🟡 | [`vite-env.d.ts`](src/vite-env.d.ts) | Missing `ImportMetaEnv` declarations |
| G-08 | 🟡 | [`global.css`](src/styles/global.css) | `[style*="contain"]` overly broad selector |
| TY-02 | 🟡 | [`typography.css`](src/styles/typography.css) | All headings forced uppercase globally |

**Total:** 20 issues at 🟡 Medium or above + numerous 🔵 Low items.

---

## 5. Recommendations Priority Matrix

### 🔴 P0 — Fix Before Next Release

1. **Wrap unprotected routes in `PageErrorBoundary`** — Login, Onboarding, Workout routes
2. **Add Sentry reporting to `PageErrorBoundary`** — page errors are invisible to monitoring
3. **Remove duplicate CSS definitions** — audit `global.css` vs `components.css` and establish single ownership

### 🟠 P1 — Fix Within Sprint

4. **Decompose [`App.tsx`](src/App.tsx)** into `AppRouter`, `AppShell`, `WorkoutPlaceholder`, `OnboardingGate`, helper modules
5. **Consolidate z-index source of truth** — pick JS or CSS, remove the other
6. **Create `ImportMetaEnv` interface** in [`vite-env.d.ts`](src/vite-env.d.ts) and remove all `as` casts
7. **Extract base exercise type** to reduce type duplication
8. **Remove legacy CSS aliases** after migrating all references
9. **Fix double font loading** — remove CSS `@import` if HTML `<link>` exists

### 🟡 P2 — Technical Debt Sprint

10. **Split [`global.css`](src/styles/global.css)** into focused files
11. **Split [`components.css`](src/styles/components.css)** into per-system files
12. **Decompose [`WorkoutSettings`](src/types/index.ts:390)** into sub-interfaces
13. **Clean up [`Screen`](src/types/index.ts:512) type** — remove unrelated values
14. **Consolidate `STORAGE_KEYS`** — add all `localStorage` keys used in the app
15. **Add error codes to custom error classes**

### 🔵 P3 — Polish

16. **Remove `Z_INDEX` alias** and `LOCAL_STORAGE_KEYS` alias
17. **Add `as const` to `STORAGE_KEYS`**
18. **Document `placeholderItem` usage** and consider factory pattern
19. **Move `createWorkoutSet` out of types file**
20. **Scope heading uppercase to components** instead of global `h1-h6`

---

*End of Review — 16 files analyzed, 50+ issues identified across code quality, architecture, type system, CSS, and error handling.*

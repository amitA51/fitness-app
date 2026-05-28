# Review 06 — Pages Layer

**Scope:** All 9 files in `src/pages/`  
**Date:** 2026-05-28  
**Total Lines:** ~14,217 across 9 files

---

## Executive Summary

The pages layer is the **largest code surface** in the app at ~14K lines, dominated by two monolithic files: [`Progress.tsx`](src/pages/Progress.tsx) (3,259 lines) and [`Nutrition.tsx`](src/pages/Nutrition.tsx) (1,599 lines). Pages are properly lazy-loaded via `React.lazy()` in [`App.tsx`](src/App.tsx:42), but several pages violate Single Responsibility Principle by embedding sub-components, modals, data-fetching logic, and inline UI primitives directly in the page file. Hebrew/RTL handling is generally consistent (`dir="rtl"` on root elements), and accessibility is above average with `role="tab"`, `aria-selected`, keyboard navigation in tabs, and `aria-label` on interactive elements.

### Line Count Summary

| File | Lines | Rating |
|------|------:|--------|
| [`Dashboard.tsx`](src/pages/Dashboard.tsx) | 909 | ⚠️ Medium — mixed computation + UI |
| [`Login.tsx`](src/pages/Login.tsx) | 1,692 | 🔴 Too large — 4 sub-forms + UI primitives |
| [`OnboardingFlow.tsx`](src/pages/OnboardingFlow.tsx) | 1,539 | 🔴 Too large — 6 step components inline |
| [`Nutrition.tsx`](src/pages/Nutrition.tsx) | 1,599 | 🔴 Too large — 3 sub-views + modal inline |
| [`Progress.tsx`](src/pages/Progress.tsx) | 3,259 | 🔴🔴 Critical — 4 tabs + 3 modals + chart logic |
| [`Settings.tsx`](src/pages/Settings.tsx) | 2,001 | 🔴 Too large — 8 sections + sync logic |
| [`Templates.tsx`](src/pages/Templates.tsx) | 1,143 | ⚠️ Medium — modal + card inline |
| [`WorkoutDetail.tsx`](src/pages/WorkoutDetail.tsx) | 1,176 | ⚠️ Medium — custom hook + sub-components |
| [`index.ts`](src/pages/index.ts) | 10 | ✅ Fine |

---

## File-by-File Analysis

---

### 1. [`src/pages/Dashboard.tsx`](src/pages/Dashboard.tsx) — 909 lines

**Purpose:** Main home screen — CTA buttons, weekly activity rings, metrics row, weekly calendar, consistency tracker, muscle distribution, recent workouts, PR banner, and forecast nudge.

**Responsibilities (too many):**
- Template loading & sorting
- Week offset navigation & week data calculation
- 4-week consistency computation
- Weekly muscle group aggregation
- Hero rings configuration
- Pull-to-refresh integration
- Rendering 8+ distinct UI sections

#### Code Quality Issues

1. **Excessive `useMemo` nesting** (lines 58–261): 9 `useMemo` calls and 8 `useCallback` calls create a dense reactive graph. [`getWeekData`](src/pages/Dashboard.tsx:96) is a `useCallback` that contains significant business logic (volume delta calculation, week filtering) — this should be extracted to a utility or custom hook.

2. **Business logic in component** (lines 96–137, 192–236): Week data calculation, consistency scoring, and muscle group aggregation are all computed inline. These are pure functions that belong in a `useDashboardMetrics` hook or utility module.

3. **Inline styles throughout** (lines 264–763): Nearly every element uses inline `style={{}}` objects. This makes the component harder to read and prevents CSS optimization. Example at [line 341](src/pages/Dashboard.tsx:341) — a single `<button>` has 15 style properties.

4. **Magic numbers**: `8000` for volume max (line 249), `240` for minutes max (line 256), `4` for workouts goal (line 243) — should be named constants.

5. **`BentoRow` and `MetricCard` defined at bottom** (lines 787–908): These are good `memo`'d sub-components but are co-located in the page file rather than extracted.

6. **`SectionTitle` memo** (line 767): Memoizing a simple `<h2>` with one prop is micro-optimization overhead.

#### Architectural Concerns
- **SRP violation**: Dashboard is simultaneously a data layer (fetching templates, computing metrics) and a presentation layer.
- **Missing `useDashboardData` hook**: Template loading (line 44–56), week data, consistency data, muscle data, and hero rings should be a single custom hook.
- **Direct service call** at [line 19](src/pages/Dashboard.tsx:19): `getWorkoutTemplates` is called directly rather than through a data context or hook.

#### Data Fetching Pattern
- ✅ Has loading state via `useData()` context
- ✅ Pull-to-refresh with `usePullToRefresh` hook
- ⚠️ No error boundary or error state UI — errors are silently logged
- ⚠️ `WORKOUT_SAVED` custom event listener (line 54) is a fragile coupling mechanism

#### Hebrew/RTL
- ✅ `dir="rtl"` on root div (line 265)
- ✅ Hebrew labels throughout ("אימונים השבוע", "נפח", "משך ממוצע")
- ⚠️ Mixed Hebrew/English in section headers ("§ WEEKLY · SUMMARY")

#### Accessibility
- ✅ `aria-label` on primary CTA (line 338)
- ✅ `aria-label` on quick action buttons (lines 396, 422)
- ✅ `aria-hidden="true"` on decorative SVG (line 311)
- ✅ `aria-label` on summary section (line 458)
- ⚠️ Pull-to-refresh indicator has no screen reader announcement

---

### 2. [`src/pages/Login.tsx`](src/pages/Login.tsx) — 1,692 lines

**Purpose:** Authentication page with 5 form steps: choice, sign-in, sign-up, forgot-password, and success states.

**Responsibilities (too many):**
- 4 custom input components (`AnnualInput`, `AnnualPasswordInput`, `AnnualButton`, `GhostLink`)
- Brand masthead component
- 4 step components (ChoiceStep, SignInStep, SignUpStep, ForgotPasswordStep)
- Form validation logic (duplicated across steps)
- Supabase auth integration
- Google OAuth integration

#### Code Quality Issues

1. **Custom UI primitives embedded** (lines 110–471): `AnnualInput`, `AnnualPasswordInput`, `AnnualButton`, and `GhostLink` are reusable UI components defined inside a page file. These should be in `src/components/ui/`.

2. **Duplicated validation regex** (lines 818, 1051, 1377): The email regex `/^[^\s@]+@[^\s@]+\.[^\s@]+$/` is copy-pasted 3 times. Should be in [`src/utils/validation.ts`](src/utils/validation.ts).

3. **Duplicated error display pattern** (lines 953–979, 1319–1345, 1524–1545): The same styled error box with `AlertCircle` icon is repeated 3 times. Should be an `ErrorMessage` component.

4. **`memo` on sub-components** (lines 124, 231, 336): Good use of `memo` for input components, but these shouldn't be in this file at all.

5. **Animation constants** (lines 71–104): `pageVariants`, `slideFromRight`, `slideFromLeft`, `staggerContainer`, `staggerItem` are well-defined but should be shared animation presets (partially exist in [`src/components/animations/`](src/components/animations/)).

6. **`isSupabaseConfigured` loaded via dynamic import** (line 1570): Good pattern for avoiding bundle bloat, but the state management is awkward — could use a context.

#### Architectural Concerns
- **Massive SRP violation**: This file contains 8+ components that should each be their own file.
- **Form state management**: Each step manages its own `useState` for form fields, errors, loading. A form library (react-hook-form) or custom `useAuthForm` hook would reduce boilerplate.
- **Inline SVG for Google logo** (lines 740–757): Should be an extracted icon component.

#### Data Fetching Pattern
- ✅ Loading states on submit buttons
- ✅ Error states with user-facing Hebrew messages
- ✅ Supabase availability check on mount
- ⚠️ No rate limiting or debouncing on form submissions

#### Hebrew/RTL
- ✅ `dir="rtl"` and `lang="he"` on root (line 1604–1605)
- ✅ All UI text in Hebrew
- ✅ `autoComplete` attributes in Hebrew context ("email", "current-password")
- ✅ Skip link for accessibility (line 1608)

#### Accessibility
- ✅ Skip link (`<a href="#main-content">`) at line 1608
- ✅ `role="alert"` on OAuth error (line 763)
- ✅ `autoFocus` on first input in each step
- ✅ `aria-label` on password toggle (line 298)
- ✅ `aria-hidden="true"` on decorative icons
- ✅ Min touch target 44px on buttons (line 461)

---

### 3. [`src/pages/OnboardingFlow.tsx`](src/pages/OnboardingFlow.tsx) — 1,539 lines

**Purpose:** Multi-step onboarding wizard collecting user profile, fitness goals, experience level, and workout preferences.

**Responsibilities:**
- 6 step components (Welcome, Profile, Goals, Experience, Preferences, Complete)
- Custom input/toggle components (`MobileInput`, `MobileToggle`)
- Progress dots component
- Step header component
- Step navigation & validation
- Session persistence (draft saving)

#### Code Quality Issues

1. **`MobileInput` and `MobileToggle`** (lines 115–265): Reusable components that duplicate functionality already in [`AnnualInput`](src/pages/Login.tsx:124) from Login.tsx. Should be a shared `MobileInput` in `src/components/ui/`.

2. **`JSON.parse` without safe wrapper** (line 1362): Uses raw `JSON.parse(saved)` despite the project having [`safeJsonParse`](src/utils/safeJson.ts). Inconsistent with other files.

3. **Step rendering via switch** (lines 1410–1427): `renderStep()` function with a switch statement is fine for 6 steps but would benefit from a step registry pattern for extensibility.

4. **Validation in `canProceed`** (lines 1395–1408): Validation logic is a simple switch — clean but doesn't provide user feedback about why they can't proceed.

5. **Duplicate UI patterns**: The selection card pattern (icon + title + description + check mark) is repeated identically in [`GoalsStep`](src/pages/OnboardingFlow.tsx:621) and [`ExperienceStep`](src/pages/OnboardingFlow.tsx:756). Should be a `SelectionCard` component.

#### Architectural Concerns
- **Good data flow**: Props-down pattern with `data` and `onChange` is clean.
- **Session persistence** (lines 1368–1375): Draft saving to `sessionStorage` is a nice touch for crash recovery.
- **Missing**: No integration with auth context — onboarding data is passed up via `onComplete` callback but the parent (`App.tsx`) handles persistence.

#### Hebrew/RTL
- ✅ `dir="rtl"` on root (line 1438)
- ✅ All labels and descriptions in Hebrew
- ✅ RTL-aware layout (text-right, etc.)

#### Accessibility
- ✅ Min touch targets 48–56px throughout
- ✅ Safe area handling (line 1456, 1492)
- ✅ Keyboard-accessible navigation
- ⚠️ No `aria-live` region for step transitions
- ⚠️ Progress dots lack `aria-label` describing current step

---

### 4. [`src/pages/Nutrition.tsx`](src/pages/Nutrition.tsx) — 1,599 lines

**Purpose:** Nutrition tracking — daily macro display, meal logging, food library search, meal presets, water tracking, and hydration history.

**Responsibilities (too many):**
- Main page state management (17 `useState` calls!)
- 3 tab views (log, library, presets)
- Add meal modal
- Food library component
- Meal entry card component
- Meal preset card component
- Empty state component
- Water history chart
- Date navigation

#### Code Quality Issues

1. **17 `useState` calls** (lines 51–71): This is a strong signal that state should be consolidated into a `useReducer` or custom hook. State includes entries, macros, goals, tabs, meal type, search, selected foods, date, water history.

2. **Inline `AddMealModal`** (lines 1182–1598): A 416-line modal component defined inline. This is the single largest inline component across all pages.

3. **Direct `localStorage` access** (lines 197–218): Macro goals are read from `localStorage` with a `storage` event listener. This is a fragile cross-component communication pattern — should use SettingsContext.

4. **Dynamic import for water service** (line 82): `await import('../services/waterService')` inside a callback — inconsistent with other service imports at the top of the file.

5. **`searchFoods` called synchronously** (line 192): `searchFoods(searchQuery)` is called in `useMemo` — if this does filtering over a large dataset, it blocks the main thread.

6. **Duplicate search input pattern**: The search input with icon is implemented identically in `FoodLibrary` (line 859) and `AddMealModal` (line 1484). Should be a shared `SearchInput` component.

7. **`MealPresetCard` calls `getFoodLibrary()` in render** (lines 1039, 1105): Synchronous data access during render is a performance concern and breaks React's data-flow model.

#### Architectural Concerns
- **No nutrition context/hook**: All state management is local to the page. A `useNutritionData` hook would encapsulate entries, macros, goals, and CRUD operations.
- **Cross-component state via localStorage** (line 197): Settings goals are read via `localStorage` + `storage` event instead of consuming `SettingsContext`.
- **FAB button positioning** (line 642): `fixed bottom-24 z-40` with `left: '20px'` — hardcoded position that may conflict with bottom nav.

#### Hebrew/RTL
- ✅ `dir="rtl"` on root (line 249)
- ✅ Proper `role="tablist"` with `role="tab"` and `role="tabpanel"` (lines 464–496)
- ✅ Arrow key navigation between tabs (lines 476–489)
- ✅ `aria-selected`, `aria-controls`, `tabIndex` on tabs

#### Accessibility
- ✅ Best tab accessibility implementation in the codebase
- ✅ `aria-label` on FAB (line 654)
- ✅ `aria-label` on delete buttons (line 757)
- ✅ `role="img"` with `aria-label` on water chart (line 589)
- ✅ Min touch targets 44–48px
- ⚠️ Modal lacks focus trap
- ⚠️ No `aria-live` for meal save confirmation

---

### 5. [`src/pages/Progress.tsx`](src/pages/Progress.tsx) — 3,259 lines ⚠️ CRITICAL

**Purpose:** Progress tracking with 4 tabs (weight, measurements, recovery, strength), workout history, and 3 add-data modals.

**This is the largest single file in the codebase.**

**Responsibilities (massively overloaded):**
- Main page with 12 `useState` calls
- 4 tab components (`WeightTab`, `MeasurementsTab`, `RecoveryTab`, `StrengthTab`)
- 3 modal components (`AddWeightModal`, `AddMeasurementModal`, `AddRecoveryModal`)
- 2 embedded sub-components (`WorkoutHistoryList`, `ProgressInsightCard`)
- 1 utility component (`RecoveryBar`, `SliderInput`)
- Custom SVG chart rendering (strength curve, lines 2414–2491)
- PR leaderboard
- Activity rings hero section
- Volume trajectory chart integration

#### Code Quality Issues

1. **3,259 lines in one file**: This is 5–10x what a page component should be. It contains at least 12 distinct components that should each be their own file.

2. **Inline SVG chart** (lines 2412–2491): A hand-rolled SVG line chart with area fill, dots, and date labels. This duplicates functionality from [`GlowAreaChart`](src/components/charts/GlowAreaChart.tsx) and [`GradientSparkline`](src/components/charts/GradientSparkline.tsx) which are already in the codebase.

3. **`StrengthTab` loads its own data** (lines 1985–2066): Fetches `getWorkoutSessions(100)` independently of the parent's data loading. This means the same data may be fetched twice.

4. **Massive metric card duplication** (lines 850–997): Three nearly identical metric cards are rendered with the same structure — should be a `MetricCard` component (one already exists in Dashboard.tsx but isn't shared).

5. **`AddMeasurementModal`** (lines 2808–2965): 6 individual `useState` calls for body measurements (lines 2817–2822). Should use a single state object or form library.

6. **`AddRecoveryModal`** (lines 2967–3188): 7 `useState` calls for recovery inputs. Again, should be consolidated.

7. **`SliderInput` component** (lines 3190–3258): A reusable component defined at the bottom of a 3K-line page file. Should be in `src/components/ui/`.

8. **`RecoveryBar` component** (lines 2625–2659): Another reusable component buried in this file.

9. **Non-null assertions** (lines 2041–2042): `uniquePoints[uniquePoints.length - 1]!` and `uniquePoints[0]!` — TypeScript strict mode violations.

#### Architectural Concerns
- **Extreme SRP violation**: This file is essentially an entire feature module compressed into one component.
- **Duplicate data loading**: `StrengthTab` (line 1988) and parent `ProgressPage` (line 457) both call `getWorkoutSessions()`.
- **`RecoveryTab` loads its own history** (line 1636): Another independent data fetch within a sub-component.
- **No progress context/hook**: Weight, measurements, recovery, and strength data should each have their own hook or be in a shared `useProgressData` hook.

#### Data Fetching Pattern
- ✅ `Promise.all` for parallel loading (line 450)
- ✅ Loading skeleton via `DetailSkeleton` pattern in `StrengthTab`
- ✅ Cancelled flag for async cleanup (line 489)
- ⚠️ No error state UI for the main page
- ⚠️ Multiple independent data fetches without coordination

#### Hebrew/RTL
- ✅ `dir="rtl"` on root (line 618)
- ✅ Hebrew labels on all tabs and sections
- ✅ `toLocaleDateString('he-IL')` for date formatting

#### Accessibility
- ✅ Proper `role="tablist"` / `role="tab"` / `role="tabpanel"` (lines 1007–1058)
- ✅ Arrow key navigation between tabs (lines 1019–1032)
- ✅ `aria-selected`, `aria-controls`, `tabIndex` management
- ✅ `aria-label` on recovery score SVG (line 1727)
- ⚠️ Modal focus management missing
- ⚠️ Chart SVGs lack `role="img"` and `aria-label`

---

### 6. [`src/pages/Settings.tsx`](src/pages/Settings.tsx) — 2,001 lines

**Purpose:** App settings — user profile, nutrition goals, workout preferences, notifications, display/theme, data export, cloud sync, and danger zone.

**Responsibilities (too many):**
- 5 inline UI primitives (`SectionLabel`, `SettingsCard`, `SettingsRow`, `Toggle`, `NumberInput`, `SaveButton`, `ProfileAvatar`)
- Profile management (name, age, height, weight goal, activity level)
- Nutrition goals with TDEE calculation
- Workout preferences (rest time, toggles)
- Notification settings
- Theme/display settings
- Cloud sync (push/pull/full sync)
- Export (CSV, JSON backup, weekly report)
- Account management (sign out)
- Danger zone (delete all data)

#### Code Quality Issues

1. **7 inline UI primitives** (lines 117–354): `SectionLabel`, `SettingsCard`, `SettingsRow`, `Toggle`, `NumberInput`, `SaveButton` are all reusable components defined in the page file. The `Toggle` component (lines 204–251) duplicates [`ToggleSwitch`](src/components/ui/ToggleSwitch.tsx) which already exists.

2. **`loadFromStorage` / `saveToStorage`** (lines 99–111): Generic localStorage helpers defined inline. Should be in [`src/utils/safeJson.ts`](src/utils/safeJson.ts) or a shared utility.

3. **3 sync handler functions with identical patterns** (lines 497–582): `handleSyncToCloud`, `handlePullFromCloud`, `handleSyncAll` follow the same try/catch/finally pattern with nearly identical error handling. Should be a single parameterized function.

4. **Dynamic imports for sync services** (lines 467, 481, 505, 532, 559): 5 separate dynamic imports of `../services/supabaseSync` and `../services/indexedDBCore`. These should be a single lazy-loaded sync service.

5. **Inline backup export logic** (lines 1712–1748): 36 lines of backup creation logic (IndexedDB reads, JSON serialization, blob download) embedded in an `onClick` handler. Should be in [`exportService`](src/services/exportService.ts).

6. **Hebrew type literals** (lines 48–49): `WeightGoal` and `ActivityLevel` types use Hebrew string literals (`'ירידה במשקל'`, `'לא פעיל'`). This is fragile — should use English keys with Hebrew display labels.

7. **`handleDeleteAllData`** (lines 614–625): Iterates all stores and clears them, then does `window.location.reload()`. No confirmation beyond the UI toggle — the reload is a hard refresh that loses React state.

#### Architectural Concerns
- **Settings is a kitchen sink**: Profile, nutrition, workout prefs, notifications, theme, sync, export, and danger zone are all in one component. Should be split into at least 4 page-level sections or a tabbed settings page.
- **Dual persistence**: Settings are saved to both `localStorage` (via `saveToStorage`) and `SettingsContext` (via `updateWorkoutSettings`). This creates a split-brain problem.
- **No form state management**: Each section has its own `useState` + `handleSave*` pattern with `setTimeout` for "saved" feedback. This is boilerplate-heavy.

#### Hebrew/RTL
- ✅ `dir="rtl"` on root (line 679)
- ✅ Hebrew labels throughout
- ✅ `aria-label` on inputs and toggles (lines 777, 887, 936)
- ✅ `aria-pressed` on unit system buttons (lines 994, 1016)
- ✅ `role="switch"` with `aria-checked` on toggles (lines 208–210)
- ✅ `aria-live="polite"` on sync message (line 1507)

#### Accessibility
- ✅ Best toggle implementation — proper `role="switch"` + `aria-checked` + `aria-label`
- ✅ Semantic labeling on all form inputs
- ✅ Min touch targets 44px
- ⚠️ Delete confirmation lacks focus management
- ⚠️ No landmark regions (`<nav>`, `<main>`)

---

### 7. [`src/pages/Templates.tsx`](src/pages/Templates.tsx) — 1,143 lines

**Purpose:** Template browser — list, create, duplicate, delete, and favorite workout templates.

**Responsibilities:**
- Template CRUD operations
- Create modal with exercise picker
- Template card with actions
- Loading/error states
- Favorites/regular separation

#### Code Quality Issues

1. **`CreateModal`** (lines 69–555): A 486-line modal with its own exercise picker, search, and form state. Should be extracted.

2. **`any[]` type** (line 78): `const [allExercises, setAllExercises] = useState<any[]>([])` — should use `PersonalExercise[]`.

3. **`getPersonalExercises` in effect** (line 82): Loaded only when picker opens — good lazy pattern but no error handling.

4. **`estimatedMinutes` calculation** (lines 94–104): Business logic (set time estimation) in a modal component — should be a utility.

5. **`onMouseEnter`/`onMouseLeave` for hover** (lines 464–467): Direct DOM style manipulation instead of CSS `:hover` — breaks React's declarative model.

#### Architectural Concerns
- **Good CRUD patterns**: `handleToggleFavorite`, `handleDelete`, `handleDuplicate` use optimistic UI updates with loading sets (`deletingIds`, `favoritingIds`).
- **Good state management**: Uses `Set<string>` for tracking in-progress operations — clean pattern.
- **Template card is well-factored**: `TemplateCard` is `memo`'d with clear props interface.

#### Hebrew/RTL
- ✅ `dir="rtl"` on root (line 977)
- ✅ Hebrew text throughout

#### Accessibility
- ✅ `aria-label` on action buttons (lines 689, 705, 730, 747)
- ✅ `aria-busy` on loading states (lines 706, 748)
- ✅ Min touch targets 44px
- ⚠️ Modal lacks focus trap
- ⚠️ Exercise picker list items lack `role="listbox"` pattern

---

### 8. [`src/pages/WorkoutDetail.tsx`](src/pages/WorkoutDetail.tsx) — 1,176 lines

**Purpose:** Detailed view of a completed workout session — stats, exercises, sets, muscle breakdown, comparison with previous session, and sharing.

**Responsibilities:**
- Session data loading by ID
- Previous session comparison (custom hook)
- Exercise card rendering
- Stat items
- Muscle breakdown chart
- Share functionality
- Skeleton loading state

#### Code Quality Issues

1. **`usePreviousSession` hook** (lines 554–600): Good extraction of a custom hook, but it loads 30 sessions to find one previous — inefficient. Should filter at the database level.

2. **`getBestSet` utility** (lines 62–77): Clean helper function — good pattern.

3. **`DetailSkeleton`** (lines 83–131): Proper skeleton loading state — good.

4. **`getColor` function** (lines 451–463): Color cycling for muscle bars uses a hardcoded array. Should use design tokens or a shared color utility.

5. **Share handler** (lines 642–678): Uses `navigator.share` with clipboard fallback — good progressive enhancement.

6. **Inconsistent border variables**: Uses both `var(--color-border)` (line 155) and `var(--fs-surface-2)` (line 132) for borders — inconsistent design token usage.

#### Architectural Concerns
- **Best-composed page**: Sub-components (`ExerciseCard`, `StatItem`, `MuscleBreakdown`, `DetailSkeleton`) are well-factored.
- **Custom hook pattern**: `usePreviousSession` demonstrates good hook extraction.
- **Still 1,176 lines**: `ExerciseCard`, `StatItem`, and `MuscleBreakdown` should be in separate files.

#### Hebrew/RTL
- ✅ `dir="rtl"` on root (line 763)
- ✅ Hebrew labels throughout
- ✅ Uses `insetInlineStart` for RTL-aware positioning (lines 165, 356, 484, 1023)
- ✅ Uses `borderStartStartRadius` / `borderEndStartRadius` (lines 171–172)

#### Accessibility
- ✅ `aria-label` on back button (line 777)
- ✅ Min touch targets 44px
- ⚠️ Exercise cards lack expand/collapse semantics
- ⚠️ Share button has no loading state indication

---

### 9. [`src/pages/index.ts`](src/pages/index.ts) — 10 lines

**Purpose:** Barrel exports for pages.

**Issues:**
- **Missing exports**: Only exports 5 of 8 page components. [`Login`](src/pages/Login.tsx), [`OnboardingFlow`](src/pages/OnboardingFlow.tsx), and [`WorkoutDetail`](src/pages/WorkoutDetail.tsx) are not exported. Since all pages are lazy-loaded in [`App.tsx`](src/App.tsx:42), this barrel is unused — it exists only for documentation/organization.
- **Chinese comment** (line 3): `// 页面导出索引` — should be in Hebrew or English for consistency.

---

## Cross-Cutting Analysis

### Lazy Loading & Code Splitting ✅

[`App.tsx`](src/App.tsx:42-49) properly uses `React.lazy()` for all 8 page components:

```typescript
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Login = lazy(() => import('./pages/Login'));
const Nutrition = lazy(() => import('./pages/Nutrition'));
const OnboardingFlow = lazy(() => import('./pages/OnboardingFlow'));
const Progress = lazy(() => import('./pages/Progress'));
const Settings = lazy(() => import('./pages/Settings'));
const Templates = lazy(() => import('./pages/Templates'));
const WorkoutDetail = lazy(() => import('./pages/WorkoutDetail'));
```

A shared [`PageLoader`](src/App.tsx:60) skeleton fallback is provided with `aria-live="polite"` and `role="status"`.

**However:** The large file sizes (especially Progress at 3,259 lines) mean each lazy chunk is unnecessarily large. Extracting sub-components into separate files would allow the bundler to tree-shake more effectively and reduce initial chunk sizes.

### Data Fetching Patterns

| Pattern | Used? | Notes |
|---------|-------|-------|
| Loading states | ✅ All pages | Skeleton loaders, spinners |
| Error states | ⚠️ Inconsistent | Templates & WorkoutDetail have error UI; Dashboard, Progress, Nutrition silently log |
| Parallel fetching | ✅ Progress | `Promise.all` at line 450 |
| Context consumption | ✅ Dashboard | Uses `useData()` and `useFitnessInsights()` |
| Direct service calls | ⚠️ Most pages | Nutrition, Progress, Templates, WorkoutDetail all call services directly |
| Pull-to-refresh | ✅ Dashboard only | Other pages don't support it |
| Cancellation | ⚠️ Partial | `usePreviousSession` and PR fetch use cancelled flags; others don't |

**Key Problem:** There's no consistent data-fetching pattern. Some pages use context (`useData`), some call services directly, some use custom hooks. A unified `usePageData` pattern or React Query/SWR would standardize this.

### Component Composition vs Monolithic

| File | Sub-components | Inline | Extractable |
|------|:-:|:-:|:-:|
| Dashboard | 3 | 2 | `getWeekData`, `consistencyData` → hook |
| Login | 8 | 0 | All 4 input primitives → `components/ui/` |
| OnboardingFlow | 8 | 2 | `MobileInput`, `MobileToggle` → `components/ui/` |
| Nutrition | 5 | 1 | `AddMealModal` (416 lines) → separate file |
| Progress | 12 | 0 | All tabs + modals → separate files |
| Settings | 7 | 0 | All primitives → `components/ui/` |
| Templates | 4 | 0 | `CreateModal` → separate file |
| WorkoutDetail | 5 | 0 | Already well-factored |

**~40+ sub-components are defined inline across page files.** These should be extracted to reduce page file sizes and enable independent testing.

### Hebrew/RTL Handling

**Consistency: ✅ Good**
- All 8 page components set `dir="rtl"` on their root element
- Hebrew text used throughout for labels, buttons, and messages
- `toLocaleDateString('he-IL')` used for date formatting
- [`WorkoutDetail.tsx`](src/pages/WorkoutDetail.tsx) uses logical CSS properties (`insetInlineStart`, `borderStartStartRadius`) — the gold standard for RTL
- [`Progress.tsx`](src/pages/Progress.tsx) uses `left: 0` for accent bars (lines 868–876) instead of `insetInlineStart` — inconsistent with WorkoutDetail

**Issues:**
- Mixed Hebrew/English in section headers (e.g., "§ WEEKLY · SUMMARY", "§01 · WEIGHT")
- [`Login.tsx`](src/pages/Login.tsx) sets `lang="he"` but no other page does
- [`Settings.tsx`](src/pages/Settings.tsx) uses Hebrew type literals (`'ירידה במשקל'`) instead of English keys

### Accessibility Summary

| Feature | Dashboard | Login | Onboarding | Nutrition | Progress | Settings | Templates | WorkoutDetail |
|---------|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|
| `dir="rtl"` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `aria-label` | ✅ | ✅ | ⚠️ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Tab semantics | — | — | — | ✅ | ✅ | — | — | — |
| Keyboard nav | ⚠️ | ✅ | ✅ | ✅ | ✅ | ✅ | ⚠️ | ⚠️ |
| Focus management | ⚠️ | ✅ | ⚠️ | ⚠️ | ⚠️ | ⚠️ | ⚠️ | ⚠️ |
| Skip links | — | ✅ | — | — | — | — | — | — |
| Min touch 44px | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `role="switch"` | — | — | — | — | — | ✅ | — | — |
| Error announcements | ⚠️ | ✅ | — | — | ⚠️ | ✅ | ⚠️ | ⚠️ |

**Nutrition and Progress have the best tab implementations** with proper `role="tablist"`, `role="tab"`, `role="tabpanel"`, `aria-selected`, `aria-controls`, and arrow-key navigation.

**Focus management is the weakest area** — modals across all pages lack focus traps, and step transitions in OnboardingFlow lack `aria-live` announcements.

### Mobile Responsiveness

- ✅ Safe area insets used (`env(safe-area-inset-*)`) in Dashboard, Nutrition, OnboardingFlow, Settings, Templates
- ✅ `minHeight: '100dvh'` for dynamic viewport height
- ✅ Bottom padding accounts for nav bar: `pb-[max(7rem,calc(4rem+env(safe-area-inset-bottom)))]`
- ✅ `touchAction: 'pan-y'` on Dashboard for pull-to-refresh
- ✅ Thumb-zone optimization in OnboardingFlow (CTAs at bottom)
- ⚠️ Some hardcoded pixel values that don't scale with viewport

---

## Priority Recommendations

### 🔴 Critical (do first)

1. **Split Progress.tsx into 8+ files**: Extract `WeightTab`, `MeasurementsTab`, `RecoveryTab`, `StrengthTab`, `AddWeightModal`, `AddMeasurementModal`, `AddRecoveryModal`, `WorkoutHistoryList`, `ProgressInsightCard`, `RecoveryBar`, `SliderInput` into `src/components/progress/`.

2. **Split Login.tsx**: Extract `AnnualInput`, `AnnualPasswordInput`, `AnnualButton`, `GhostLink` to `src/components/ui/`. Extract each step to `src/components/auth/`.

3. **Extract shared input components**: `MobileInput` (OnboardingFlow), `AnnualInput` (Login), and the Settings `NumberInput` all do similar things. Create a unified `FormField` component.

4. **Fix `any[]` in Templates.tsx** (line 78): Replace with `PersonalExercise[]`.

### ⚠️ High (do next)

5. **Create `useDashboardData` hook**: Move week calculation, consistency scoring, muscle aggregation, and template loading out of Dashboard.tsx.

6. **Create `useNutritionData` hook**: Consolidate the 17 `useState` calls in Nutrition.tsx into a custom hook or `useReducer`.

7. **Extract `AddMealModal`** from Nutrition.tsx (416 lines) to `src/components/nutrition/AddMealModal.tsx`.

8. **Extract Settings primitives**: `Toggle`, `NumberInput`, `SettingsRow`, `SettingsCard`, `SaveButton` to `src/components/ui/` or `src/components/settings/`.

9. **Standardize error handling**: Add error state UI to Dashboard, Nutrition, and Progress pages (currently only Templates and WorkoutDetail show errors).

10. **Fix Hebrew type literals in Settings.tsx** (lines 48–49): Use English enum keys with Hebrew display labels.

### 💡 Medium (improve)

11. **Consolidate duplicate validation**: Email regex appears 3 times in Login.tsx — extract to [`validation.ts`](src/utils/validation.ts).

12. **Replace inline hover styles**: Templates.tsx uses `onMouseEnter`/`onMouseLeave` for hover effects — use CSS classes.

13. **Standardize RTL positioning**: WorkoutDetail uses `insetInlineStart` (correct), Progress uses `left` (incorrect for RTL). Audit all pages.

14. **Add `lang="he"` consistently**: Only Login.tsx sets `lang="he"` — all pages should.

15. **Add focus traps to modals**: All modal components across pages lack focus trapping. Consider a shared `Modal` component with built-in focus management.

16. **Extract inline backup/export logic** from Settings.tsx (lines 1712–1748) to [`exportService`](src/services/exportService.ts).

17. **Replace `JSON.parse` with `safeJsonParse`** in OnboardingFlow.tsx (line 1362).

18. **Remove Chinese comment** from [`index.ts`](src/pages/index.ts:3).

---

## Proposed File Structure

```
src/
├── components/
│   ├── auth/
│   │   ├── AnnualButton.tsx          ← from Login.tsx
│   │   ├── AnnualInput.tsx           ← from Login.tsx
│   │   ├── AnnualPasswordInput.tsx   ← from Login.tsx
│   │   ├── ChoiceStep.tsx            ← from Login.tsx
│   │   ├── ForgotPasswordStep.tsx    ← from Login.tsx
│   │   ├── GhostLink.tsx             ← from Login.tsx
│   │   ├── Masthead.tsx              ← from Login.tsx
│   │   ├── SignInStep.tsx            ← from Login.tsx
│   │   └── SignUpStep.tsx            ← from Login.tsx
│   ├── nutrition/
│   │   ├── AddMealModal.tsx          ← from Nutrition.tsx
│   │   ├── FoodLibrary.tsx           ← from Nutrition.tsx
│   │   ├── MealEntryCard.tsx         ← from Nutrition.tsx
│   │   └── MealPresetCard.tsx        ← from Nutrition.tsx
│   ├── onboarding/
│   │   ├── CompleteStep.tsx          ← from OnboardingFlow.tsx
│   │   ├── ExperienceStep.tsx        ← from OnboardingFlow.tsx
│   │   ├── GoalsStep.tsx             ← from OnboardingFlow.tsx
│   │   ├── MobileInput.tsx           ← from OnboardingFlow.tsx (shared)
│   │   ├── MobileToggle.tsx          ← from OnboardingFlow.tsx (shared)
│   │   ├── PreferencesStep.tsx       ← from OnboardingFlow.tsx
│   │   ├── ProfileStep.tsx           ← from OnboardingFlow.tsx
│   │   └── WelcomeStep.tsx           ← from OnboardingFlow.tsx
│   ├── progress/
│   │   ├── AddMeasurementModal.tsx   ← from Progress.tsx
│   │   ├── AddRecoveryModal.tsx      ← from Progress.tsx
│   │   ├── AddWeightModal.tsx        ← from Progress.tsx
│   │   ├── MeasurementsTab.tsx       ← from Progress.tsx
│   │   ├── ProgressInsightCard.tsx   ← from Progress.tsx
│   │   ├── RecoveryBar.tsx           ← from Progress.tsx
│   │   ├── RecoveryTab.tsx           ← from Progress.tsx
│   │   ├── SliderInput.tsx           ← from Progress.tsx
│   │   ├── StrengthTab.tsx           ← from Progress.tsx
│   │   ├── WeightTab.tsx             ← from Progress.tsx
│   │   └── WorkoutHistoryList.tsx    ← from Progress.tsx
│   ├── settings/
│   │   ├── NumberInput.tsx           ← from Settings.tsx
│   │   ├── ProfileAvatar.tsx         ← from Settings.tsx
│   │   ├── SaveButton.tsx            ← from Settings.tsx
│   │   ├── SectionLabel.tsx          ← from Settings.tsx
│   │   ├── SettingsCard.tsx          ← from Settings.tsx
│   │   ├── SettingsRow.tsx           ← from Settings.tsx
│   │   └── Toggle.tsx                ← from Settings.tsx
│   └── templates/
│       └── CreateModal.tsx           ← from Templates.tsx
├── hooks/
│   ├── useDashboardData.ts           ← extracted from Dashboard.tsx
│   └── useNutritionData.ts           ← extracted from Nutrition.tsx
└── pages/
    ├── Dashboard.tsx                 ← ~300 lines (hooks + layout)
    ├── Login.tsx                     ← ~200 lines (step orchestration)
    ├── Nutrition.tsx                 ← ~300 lines (layout + tabs)
    ├── OnboardingFlow.tsx            ← ~200 lines (step orchestration)
    ├── Progress.tsx                  ← ~300 lines (layout + tabs)
    ├── Settings.tsx                  ← ~400 lines (layout)
    ├── Templates.tsx                 ← ~300 lines (layout)
    ├── WorkoutDetail.tsx             ← ~400 lines (layout)
    └── index.ts                      ← 10 lines
```

This would reduce the average page file from ~1,500 lines to ~300 lines, with the largest (Settings) at ~400 lines.

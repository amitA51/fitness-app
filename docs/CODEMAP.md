# SparkOS Fitness — Codebase Map

> Purpose: Let an agent locate any file or feature in seconds, without reading
> the whole tree. Each entry below is one line: `path — what it does`. When you
> need to change something, find the section, read only the listed file(s).
>
> Last verified against the tree on 2026-04-26.

---

## 1. Stack

- **React 18** + **TypeScript 5.3** + **Vite 5** + **TailwindCSS 3.4**
- **State:** `useReducer` + `useImmerReducer` (`use-immer`), split contexts
- **Routing:** `react-router-dom v6` (`BrowserRouter` + lazy routes)
- **Persistence:** **IndexedDB** via `idb` (primary) + `localStorage` (settings/draft) + **Supabase** (optional cloud sync)
- **Animation:** `framer-motion`
- **Icons:** `lucide-react`
- **Tests:** `vitest` + `@testing-library/react` + `fake-indexeddb` + `jsdom`
- **Lint/Format:** `biome` (primary) + ESLint
- **PWA:** `vite-plugin-pwa` (Workbox runtime caching for Supabase / fonts / assets)
- **Path alias:** `@/*` → `src/*` (see `vite.config.ts`)
- **Locale:** Hebrew/RTL (`<html dir="rtl" lang="he">` configured in `index.html`)

### Scripts (`package.json`)

```
dev         → vite dev server, port 3000
build       → vite build (manual chunks: react-vendor, framer, supabase, idb, immer, icons)
typecheck   → tsc --noEmit
verify      → typecheck + lint:check + format:check
test        → vitest (watch)
test:run    → vitest run
test:coverage → vitest run --coverage
```

---

## 2. Top-Level Files

| File | Purpose |
|---|---|
| `index.html` | App shell, RTL/Hebrew, mounts `#root` |
| `src/main.tsx` | React root, imports global CSS, registers SW |
| `src/App.tsx` | Router + auth gate + onboarding gate + AppShell + lazy routes |
| `vite.config.ts` | Vite + PWA + manualChunks + terser |
| `tailwind.config.js` | Theme tokens (bone, ink, navy, accents) — UI palette source of truth |
| `tsconfig.json` | TS config, `@/*` alias |
| `biome.json` | Formatter / linter config |
| `vitest.config.ts` | Test config (jsdom + setup file) |
| `netlify.toml` | Deploy config |
| `supabase/schema.sql` | Cloud DB schema (templates, sessions, exercises, body, settings) |
| `supabase/functions/ai-chat/` | Edge function for AI chat |

Design previews (`design-preview*.html`) and `VISION*.md` are **non-code design docs** — ignore unless redesigning.

---

## 3. Entry & Routing — `src/App.tsx`

Single source of routing truth. Layered providers:

```
<AuthProvider>                      ← contexts/AuthContext.tsx
  <AppRouter>                       ← decides: loading | login | onboarding | shell
    <BrowserRouter>
      <SettingsProvider>            ← contexts/SettingsContext.tsx
        <DataProvider>              ← contexts/DataContext.tsx (loads IDB on mount)
          <PageThemeProvider>       ← per-route accent
            <AppShell>
              <Routes>              ← all lazy
                /          → Dashboard
                /workout(/:templateId) → WorkoutPlaceholder (wraps WorkoutProvider+WorkoutContent)
                /nutrition → Nutrition
                /progress  → Progress
                /templates → Templates
                /history/:id → WorkoutDetail
                /settings  → Settings
              </Routes>
              <BottomNav> (hidden on /workout)
```

- `PATH_ACCENT_MAP` / `PATH_LABEL_MAP` (lines ~115–133) map URL → accent + Hebrew label.
- `AppShell` handles **scroll restore** via `sessionStorage` key `scroll:<path>`.
- `WorkoutPlaceholder` (line ~386) is the only place `WorkoutProvider` mounts.
- Onboarding completion writes `localStorage`: `onboarding_completed`, `onboarding_data`, `user_profile`, `workout_prefs`.

---

## 4. State Architecture

### 4.1 Global app contexts — `src/contexts/`

| File | Provides | Notes |
|---|---|---|
| `AuthContext.tsx` | `useAuth()` → `{ status, user, signIn, signOut, ... }` | status: `loading \| authenticated \| guest \| unauthenticated`. Uses `services/supabaseAuth.ts`. |
| `SettingsContext.tsx` | `useSettings()`, `loadStoredSettings`, `DEFAULT_SETTINGS`, `DEFAULT_WORKOUT_SETTINGS` | Reads/writes `localStorage.appSettings`. |
| `DataContext.tsx` | `useData()` → `{ exercises, sessions, templates, personalItems, loading, refreshData, addPersonalItem, ... }` | Loads from IndexedDB on mount via `Promise.all`. Single source of truth for exercise list, session list, templates. |
| `PageThemeContext.tsx` | `usePageTheme`, `useAccentColor`, `useAccentGradient`, `useIsEnergetic`, `useIsCalm`, `PAGE_THEMES` | Per-route accent (dashboard, workout, nutrition, progress, templates, history, settings). |
| `index.ts` | Barrel re-exports | Import from `@/contexts` not the individual files. |

### 4.2 Workout state (the heavy one) — `src/components/workout/core/`

A separate state machine, only mounted while in `/workout`. **Three split contexts** for performance — never reads cause re-renders on dispatch.

| File | Role |
|---|---|
| `workoutTypes.ts` | All Workout state shapes + every `Action` type + `createInitialState()` + `HAPTIC_PATTERNS`. Source of truth for shape. |
| `workoutReducer.ts` | Sliced reducer: `exerciseReducer`, `setReducer`, `timerReducer`, `uiReducer`, `modalReducer`, `dataReducer`, routed by an action-type → slice `Set` map for efficiency. |
| `workoutSelectors.ts` | Pure selectors derived from state. |
| `WorkoutContext.tsx` | Three contexts: `WorkoutStateContext` (data), `WorkoutDispatchContext` (stable), `WorkoutDerivedContext` (memoized totals). Hooks: `useWorkoutState`, `useWorkoutDispatch`, `useWorkoutDerived`, `useWorkout`, `useCurrentExercise`, `useWorkoutSettings`, `useRestTimer`, `useWorkoutOverlays`, `useWorkoutCelebration`. |
| `WorkoutProvider.tsx` | Mounts `useImmerReducer`, hydrates from `localStorage.active_workout_v3_state`, debounced auto-save (500 ms), 30-s backup save, `visibilitychange`/`beforeunload` save, wake-lock when `keepAwake`, runs haptics on `pendingHaptic`, computes derived values. |
| `WorkoutErrorBoundary.tsx` | Boundary around the whole workout. |
| `OverlayErrorBoundary.tsx` | Boundary around individual overlays so one crash doesn't kill the workout. |
| `index.tsx` | Barrel: named exports only (no `export *`) — keeps tree-shaking clean. |

**Persistence key:** `localStorage.active_workout_v3_state`. If the saved state has `_completed: true`, it is wiped on load to prevent reopen loops.

### 4.3 Action vocabulary (cheat sheet)

Slices map to action prefixes. Pick the slice file when changing behavior:

- **Exercise** (`ADD_EXERCISE`, `REMOVE_EXERCISE`, `REORDER_EXERCISES`, `CHANGE_EXERCISE`, `RENAME_EXERCISE`, `UPDATE_EXERCISE_META`, `SET_EXERCISES`, `CREATE_SUPERSET`) → `exerciseReducer`
- **Set** (`UPDATE_SET`, `COMPLETE_SET`, `UNDO_LAST_SET`, `EDIT_SPECIFIC_SET`, `DELETE_SET`, `UPDATE_SET_RPE`, `UPDATE_SET_NOTES`) → `setReducer` (also drives auto-increment, rest-timer start, confetti, haptic)
- **Timer** (`TOGGLE_PAUSE`, `SKIP_REST`, `ADD_REST_TIME`, `SET_REST_TIME`, `SYNC_REST_TIMER`) → `timerReducer`
- **UI** (numpad, drawer, settings, selectors, library, AI coach toggles) → `uiReducer`
- **Modal** (`SET_MODAL_STATE`, `SHOW_TUTORIAL`, `SHOW_PR_CELEBRATION`, `HIDE_PR_CELEBRATION`, `HIDE_CONFETTI`) → `modalReducer`
- **Data** (`UPDATE_SETTINGS`, `SET_PREVIOUS_DATA`, `CLEAR_PENDING_HAPTIC`) → `dataReducer`

---

## 5. Pages — `src/pages/`

All lazy-loaded from `App.tsx`. Each page reads from `useData()` + service calls.

| File | Route | Role |
|---|---|---|
| `Dashboard.tsx` | `/` | Greeting + weekly stats + recent workouts + AI insight + streak + forecast |
| `Login.tsx` | (when unauthenticated) | Supabase sign-in or guest mode |
| `OnboardingFlow.tsx` | (first run) | Multi-step form, exports `OnboardingData` type, writes `localStorage` keys |
| `Templates.tsx` | `/templates` | Browse / create / start workout templates |
| `Nutrition.tsx` | `/nutrition` | Meals, water, macros |
| `Progress.tsx` | `/progress` | Charts of volume, body weight, PRs |
| `WorkoutDetail.tsx` | `/history/:id` | Read-only past session view |
| `Settings.tsx` | `/settings` | App + workout settings forms |
| `History.tsx` | (used inside other pages) | Session list component |
| `index.ts` | Barrel | |

---

## 6. Workout Module — `src/components/workout/`

The largest feature. Layout:

```
workout/
  ActiveWorkoutNew.tsx        ← orchestrator (~1200 lines). Composes everything below.
  core/                       ← state engine (see §4.2)
  components/                 ← stateless workout UI pieces
  components/ui/              ← workout-only UI primitives (OverlayLoader, Toast)
  hooks/                      ← workout-scoped React hooks
  overlays/                   ← full-screen modals (lazy)
  states/                     ← screens shown based on workout state (PreWorkout, Empty)
  ExerciseSelector/           ← picker (split into folder due to size)
  common/IconMap.tsx          ← muscle-group → icon lookup
  effects/                    ← (currently empty — reserved)
  themes.ts                   ← workout theme palettes
  icons.tsx                   ← workout icon set
  index.tsx                   ← barrel
```

### 6.1 `ActiveWorkoutNew.tsx`

Single composer. Imports core, components, overlays (lazy), hooks, services. Exports `WorkoutContent` (the lazy entry from `App.tsx`). All heavy children (`WorkoutSummary`, `ExerciseTutorial`, `AICoach`, `ExerciseSelector`, `QuickExerciseForm`, `WorkoutSettingsOverlay`, `WarmupCooldownFlow`, `WorkoutGoalSelector`, `ExerciseReorder`, `NumpadOverlay`, `ConfirmExitOverlay`) are `React.lazy`.

### 6.2 `components/`

Stateless pieces consumed by `ActiveWorkoutNew`. Key ones:

| File | Role |
|---|---|
| `WorkoutHeader.tsx` | Top bar: timer, progress, settings button |
| `ExerciseDisplay.tsx` | Center area: shows current exercise + sets |
| `ExerciseNav.tsx` | Bottom nav between exercises |
| `ExerciseList.tsx` | Drawer list of all exercises |
| `ExerciseCard.tsx` | Single exercise row |
| `ExerciseFilter.tsx` | Filter UI inside selectors |
| `ExerciseForm.tsx` | Form for creating/editing exercise |
| `SetInputCard.tsx` | Active set input (weight/reps) |
| `SetEditBottomSheet.tsx` | Edit a specific past set |
| `SetProgress.tsx` | Per-set progress dots |
| `RPEPicker.tsx` | RPE scale picker |
| `NotesBottomSheet.tsx` | Free-text notes |
| `ProgressBar.tsx` | Overall % done |
| `InlineRestTimer.tsx` | Editorial inline rest strip (small, eager-loaded) |
| `IntensityMeter.tsx` | Volume/intensity gauge |
| `MuscleRadarChart.tsx` | Per-session muscle balance |
| `PerformanceAnalytics.tsx` | In-workout analytics widget |
| `PRHighlights.tsx` | Highlighted PRs banner |
| `StatsGrid.tsx` | Numerical grid (sets, volume, etc.) |
| `SummaryExerciseList.tsx` | Used in WorkoutSummary |
| `SwipeComplete.tsx` / `SlideToComplete.tsx` | Swipe-to-complete gestures |
| `TrendLineOverlay.tsx` | Trend graph overlay |
| `WaterReminderHandler.tsx` | Triggers water reminders |
| `WorkoutActions.tsx` | Action buttons row |
| `AlternativesSheet.tsx` | "Swap exercise" picker |
| `DeleteConfirmDialog.tsx` | Confirm delete prompt |
| `ExerciseSuggestionLoader.tsx` | Loading skeleton for AI suggestions |
| `index.ts` | Barrel |
| `ui/` | Workout-only loader/toast |

### 6.3 `hooks/` (workout-scoped)

| Hook | Purpose |
|---|---|
| `useWorkoutTimer.ts` | Live elapsed timer + `useRestTimer` (local 100 ms tick, no parent re-render) + `formatTime` util |
| `useWorkoutSettings.ts` | Selectors for settings: `useThemeSettings`, `useRestTimerSettings`, `useDisplaySettings`, `useAccessibilitySettings` + `DEFAULT_WORKOUT_SETTINGS` |
| `usePersonalRecords.ts` | Compute PRs during workout |
| `usePRs.ts` | Aggregate PRs across history |
| `usePreviousData.ts` | "Ghost" values from previous session |
| `useVoiceCountdown.ts` | TTS countdown + `useAudioBeep` |
| `useWorkoutAudio.ts` | Centralized audio cues |
| `useWorkoutHistory.ts` | History fetch hook |
| `useAnimatedNumber.ts` | Smooth numeric transitions |
| `index.tsx` | Barrel |

### 6.4 `overlays/` (modal screens, all lazy)

| File | Role |
|---|---|
| `NumpadOverlay.tsx` | Custom on-screen numpad (driven by `numpad` slice of state) |
| `RestTimerOverlay.tsx` | Full-screen rest countdown |
| `WorkoutSettingsOverlay.tsx` | In-workout settings panel; exports `WorkoutSettingsData` |
| `SettingsPrimitives.tsx` | Shared toggle/select primitives for settings overlays |
| `ConfirmExitOverlay.tsx` | "Discard workout?" |
| `index.tsx` | Barrel |

### 6.5 `states/`

Screens that REPLACE the workout body when no exercise is active.

| File | Role |
|---|---|
| `EmptyWorkoutState.tsx` | "No exercises yet" empty state |
| `PreWorkoutScreen.tsx` | Pre-start screen (template preview) |
| `index.ts` | Barrel |

### 6.6 Other top-level workout components

| File | Role |
|---|---|
| `AICoach.tsx` | AI coaching overlay (uses `services/ai*`) |
| `AnalyticsDashboard.tsx` | Analytics tab |
| `ExerciseLibraryTab.tsx` | Library browser tab |
| `ExerciseReorder.tsx` | Drag-reorder exercises |
| `ExerciseTutorial.tsx` | Tutorial overlay (text + video) |
| `ForecastChart.tsx` | Volume/PR forecast chart |
| `PlanEditorModal.tsx` | Edit workout plan in place |
| `PRCelebration.tsx` | PR celebration animation |
| `PRHistoryTab.tsx` | PR history list |
| `ProgramCard.tsx` | Built-in program card |
| `ProgressionRecommendation.tsx` | AI-driven next-set recommendation |
| `QuickExerciseForm.tsx` | Quick add exercise form |
| `RestTimer.tsx` | Standalone timer (used outside overlay too) |
| `WarmupCooldownFlow.tsx` | Warmup / cooldown wizard |
| `WaterReminderToast.tsx` | Water reminder toast (eager) |
| `WorkoutCalendar.tsx` | Calendar view of past sessions |
| `WorkoutGoalSelector.tsx` | Pick goal (strength/hypertrophy/etc.) |
| `WorkoutHistoryScreen.tsx` | History screen |
| `WorkoutStartModal.tsx` | "Start workout?" prompt |
| `WorkoutSummary.tsx` | End-of-workout recap |
| `WorkoutTemplates.tsx` | Templates panel inside workout |
| `ExerciseSelector/index.tsx` + `CategoryPill.tsx` | Exercise selector with category pills |

---

## 7. Services — `src/services/`

Pure-function modules that talk to storage / network. Components should call services, not call IndexedDB directly.

### 7.1 Local storage (IndexedDB)

| File | Role |
|---|---|
| `indexedDBCore.ts` | Low-level: opens DB `sparkos-fitness-db` (v6), defines `STORES` (workout_sessions, workout_templates, personal_exercises, body_weight, body_measurements, recovery_logs, nutrition_logs, user_settings, personal_records, ai_conversations, pending_sync, personal_items, water_logs), promise-based CRUD helpers |
| `workoutDb.ts` | Sessions / templates / personal exercises / body weight CRUD + built-in templates (the BIG one, ~1100 lines) |
| `personalItemsDb.ts` | Personal items store helpers |
| `dataService.ts` | Re-exports + `initializeBuiltInWorkoutTemplates()`. **Components import from here** for compatibility — keep it as the public seam. |

### 7.2 Domain services

| File | Role |
|---|---|
| `workoutService.ts` | Template list + workout-flow helpers |
| `prService.ts` | Personal-record detection / queries; exports `PersonalRecord` + `getExerciseNames()` |
| `progressionService.ts` | Rule-based next-set progression |
| `aiProgressionService.ts` | AI-assisted progression |
| `aiWorkoutInsightService.ts` | AI insight generation for dashboard/workouts |
| `ai.ts` + `ai/` | AI client(s) for the Supabase `ai-chat` edge function |
| `analyticsService.ts` | Aggregations for Progress page |
| `bodyStatsService.ts` | Body-weight / measurements |
| `recoveryService.ts` | Recovery / soreness logs |
| `nutritionService.ts` | Meals + macros |
| `waterService.ts` | Water tracking |
| `notificationService.ts` | Reminders / push (browser notifications) |
| `achievementService.ts` | Streaks / badges (no celebration UI per project policy) |
| `exportService.ts` | CSV/JSON export |

### 7.3 Cloud + sync

| File | Role |
|---|---|
| `supabaseAuth.ts` | Sign in/up/out, guest mode, session listener |
| `supabaseSync.ts` | Pull/push between IDB and Supabase tables |
| `offlineQueue.ts` | Queues writes while offline; `initOfflineSync()` is called once from `App.tsx` |
| `../lib/supabase.ts` | Supabase client + `isSupabaseConfigured()` |

### 7.4 Tests

`services/__tests__/` — colocated vitest specs for service modules.

---

## 8. Global Hooks — `src/hooks/`

Cross-page hooks. (Workout-only hooks live under `components/workout/hooks/`.)

| File | Purpose |
|---|---|
| `useCelebration.ts` | Confetti/celebration trigger (suppressed per project policy — see memory) |
| `useFocusTrap.ts` | Trap focus inside modal |
| `useHaptics.ts` | Haptic API wrapper |
| `useMobileKeyboard.ts` | Detect mobile keyboard open |
| `usePullToRefresh.ts` | Pull-to-refresh gesture |
| `useReducedMotion.ts` | Respect `prefers-reduced-motion` |
| `useSwipeGesture.tsx` | Swipe gesture detection |
| `useViewTransition.ts` | View Transitions API wrapper |
| `fitness/` | Fitness-specific shared hooks |

---

## 9. UI Primitives — `src/components/ui/`

Small reusable building blocks. Treat as a mini design system.

| File | Role |
|---|---|
| `Accessible.tsx` | A11y helpers (visually-hidden, skip link helpers) |
| `AnimatedNumber.tsx` | Animated counter |
| `AnimatedProgressRing.tsx` | Circular progress |
| `AuroraBackground.tsx` | Decorative gradient backdrop |
| `BottomNav.tsx` | App tab bar (hidden during workout) |
| `Button.tsx` | Primary button. Variants: `primary`, `secondary`, `ghost`, `glass`, `danger`, `pill`, `card-action` (white pill for hero CTAs), `start` (accent gradient for start-workout). Sizes: `sm`, `md`, `lg`, `icon` (44x44, 15px radius). |
| `EmptyState.tsx` | Generic empty state |
| `Input.tsx` | Text input |
| `LoadingSpinner.tsx` | Spinner |
| `LongPressMenu.tsx` | Long-press contextual menu |
| `ModalOverlay.tsx` | Backdrop + centering for modals |
| `OfflineIndicator.tsx` | Mounted by `App.tsx`, listens to `online`/`offline` events |
| `Premium3DCard.tsx` / `UltraCard.tsx` | Decorative card variants |
| `PremiumSelect.tsx` | Custom select |
| `PullToRefresh.tsx` | Pull-to-refresh wrapper |
| `SkeletonLoader.tsx` / `WorkoutSkeletons.tsx` | Skeletons |
| `SmoothLoader.tsx` | Cross-fade loader |
| `Toast.tsx` | Toast container + helper |
| `ToggleSwitch.tsx` | Toggle |
| `label.tsx` | Radix label re-export |
| `index.tsx` | Barrel |

---

## 10. Dashboard — `src/components/dashboard/`

Composed inside `pages/Dashboard.tsx`.

| File | Role |
|---|---|
| `DashboardHeader.tsx` | Header w/ greeting & date |
| `Greeting.tsx` | Personalized greeting |
| `WeeklyStatsBlock.tsx` | Weekly volume/time stats |
| `WeeklyGrid.tsx` | 7-day workout grid |
| `RecentWorkouts.tsx` | Recent sessions list |
| `RecentPRBanner.tsx` | Latest PR banner |
| `MuscleFrequencyTracker.tsx` | Per-muscle frequency view |
| `WorkoutStreak.tsx` | Streak counter |
| `TemplateQuickStart.tsx` | One-tap template start |
| `AIInsightCard.tsx` | AI insight tile |
| `ImprovementScore.tsx` | Score widget |
| `ForecastNudge.tsx` | Forecast nudge |
| `ChapterBreak.tsx` | Section divider |

Other component groups: `src/components/animations/`, `src/components/fitness/`, `src/components/icons/`, `src/components/nutrition/`, `src/components/charts/` (premium data-viz: `RingProgress`, `ActivityRings` Apple-Health-style, `GradientSparkline`, `GlowAreaChart`, `AnimatedBar`) — open them only when working on their domain.

---

## 11. Data & Storage Map

### 11.1 IndexedDB (`sparkos-fitness-db`, v6)

Stores defined in `services/indexedDBCore.ts → STORES`:
`workout_sessions`, `workout_templates`, `personal_exercises`, `body_weight`, `body_measurements`, `recovery_logs`, `nutrition_logs`, `user_settings`, `personal_records`, `ai_conversations`, `pending_sync`, `personal_items`, `water_logs`.

**To add a store:** bump `DB_VERSION`, extend `STORES`, add upgrade migration in `indexedDBCore.ts`, add CRUD wrapper in the matching service.

### 11.2 Supabase (`supabase/schema.sql`)

Tables include `workout_templates`, `workout_sessions`, plus more below the snippet (open the file when changing schema). Sync bridges live in `services/supabaseSync.ts`. Edge function: `supabase/functions/ai-chat/`.

### 11.3 `localStorage` keys (the full list)

| Key | Owner | Notes |
|---|---|---|
| `appSettings` | `SettingsContext` + `WorkoutProvider` | `AppSettings` JSON |
| `active_workout_v3_state` | `WorkoutProvider` | Full workout state, debounced 500 ms; cleared if `_completed` |
| `onboarding_completed` | `App.tsx` | `'true'` flag |
| `onboarding_data` | `App.tsx` | `OnboardingData` JSON |
| `user_profile` | `App.tsx` | Profile derived from onboarding |
| `workout_prefs` | `App.tsx` | Quick prefs |
| `scroll:<path>` | `AppShell` (`sessionStorage`) | Per-route scroll position |

Always read via `utils/safeJson.ts` (`safeJsonParse`) — never `JSON.parse` directly.

---

## 12. Types — `src/types/index.ts`

Single file, ~500 lines, all shared types:

- **Workout:** `WorkoutSet`, `WorkoutExercise`, `WorkoutSession`, `WorkoutTemplate`, `WorkoutTemplateExercise`, `Exercise`, `PersonalExercise`, `CreatePersonalExerciseInput`, `ExercisePR`, `PersonalRecord`, `ProgramExtras`
- **Nutrition:** `MealEntry`, `Meal`, `MealType`, `FoodItem`, `MacroNutrients`
- **Goals:** `UserGoals`, `FitnessGoals`, `NutritionGoals`, `MealTiming`
- **Analytics:** `WorkoutAnalytics`, `NutritionAnalytics`
- **UI:** `WorkoutTheme`, `ThemeColors`, `Screen`
- **Settings:** `WorkoutSettings`, `AppSettings`
- **Misc:** `BodyWeightEntry`, `PersonalItem`, `WorkoutGoal`, `WarmupPreference`, `WarmupMode`
- **Helpers:** `createWorkoutSet(overrides)` — always use this to construct a `WorkoutSet`

**Workout-internal types** (state, actions) live in `components/workout/core/workoutTypes.ts` — keep them isolated; do not pull them into global `types/`.

---

## 13. Utilities — `src/utils/`

| File | Role |
|---|---|
| `animations.ts` | Motion variants for framer-motion |
| `audio.ts` | `playSuccess`, beeps |
| `dateUtils.ts` | Date formatting (Hebrew-friendly) |
| `errorReporting.ts` | Central error reporter |
| `haptics.ts` | `vibratePattern`, `triggerHaptic` |
| `logger.ts` | Namespaced logger (`logger.app`, `logger.db`, ...) — use instead of `console.*` |
| `routePrefetch.ts` | Prefetch lazy routes on idle/hover |
| `safeJson.ts` | `safeJsonParse<T>` — always use instead of `JSON.parse` |
| `styles.ts` | `cn()` (class merger) |
| `tdee.ts` | Calorie / TDEE calc |
| `units.ts` | Metric ↔ imperial |
| `__tests__/` | Vitest specs |

---

## 14. Constants & Styles

- `src/constants/workoutConstants.ts` — REST/SETS/RPE defaults, magic numbers for workout
- `src/constants/zIndex.ts` — z-index scale
- `src/constants/index.ts` — barrel
- `src/styles/tokens.css` — CSS variables (Fresh Steel palette, motion easings, premium shadows: `--shadow-glow-accent`, `--shadow-deep`, `--shadow-lift`, `--shadow-glass`; easings: `--ease-premium`, `--ease-spring-bouncy`)
- `src/styles/typography.css` — font setup
- `src/styles/global.css` — resets + base (`.chip` is now a pill: 999px, currentColor border)
- `src/styles/components.css` — component-level CSS. Two main blocks:
  - **FRESH STEEL PRIMITIVES**: `.primary-btn`, `.start-workout-btn`, `.icon-btn`, `.tab-row`/`.tab`, `.field`, `.day-cell` (+`.today`,`.done`), `.stepper-card`/`.stepper-value`/`.step-btn` (+`.plus`)/`.ghost-value`, `.template-card`/`.quick-card`, `.fs-accent-rail` (RTL-aware 4px bar), `.fs-progress-track`/`.fs-progress-fill`, `.fs-brand-icon`, `.fs-grid-texture`
  - **PREMIUM LAYER ($100M motion + glass + mesh)**: `.glass-surface`, `.glass-surface-dark`, `.ambient-mesh` (+`.strong`,`.soft`), `.scrim-noise`, `.breathing-dot` (+`.signal`,`.warn`), `.kinetic-number` (+`.large`), `.magnetic-card`, `.premium-shimmer`, `.accent-glow`, `.signal-glow`, `.ring-track`/`.ring-progress` (+`.signal`,`.warn`), `.section-spotlight`, `.premium-dark-surface`
- `src/styles/motion.css` — animation utilities: `.animate-shimmer`, `.fade-rise-in`, `.scale-pop-in`

Token source of truth is shared between `tailwind.config.js` and `styles/tokens.css`. When adding a color token, update both. Tailwind exposes the Fresh Steel palette as the `fs.*` color namespace (e.g. `bg-fs-accent`, `text-fs-ink`) plus premium shadow utilities (`shadow-glow-accent`, `shadow-deep`, `shadow-glass`).

---

## 15. Errors & Boundaries — `src/errors/`

| File | Role |
|---|---|
| `PageErrorBoundary.tsx` | Wraps each route in `App.tsx`. Accepts `pageLabel` prop. |
| `index.ts` | Barrel |
| `__tests__/` | Specs |

Workout has its own boundary (`components/workout/core/WorkoutErrorBoundary.tsx`) and per-overlay boundary (`OverlayErrorBoundary.tsx`).

---

## 16. Data Seeds — `src/data/`

| File | Role |
|---|---|
| `builtInExercises.ts` | Bundled exercise library |
| `workoutPrograms.ts` | Bundled programs |

Loaded by `services/workoutDb.ts → getBuiltInWorkoutTemplates()` and seeded via `dataService.initializeBuiltInWorkoutTemplates()`.

---

## 17. Tests

- Config: `vitest.config.ts` (jsdom + setup file `src/test/`)
- Specs colocated under `__tests__/` next to the code (e.g. `src/utils/__tests__/`, `src/services/__tests__/`, `src/errors/__tests__/`)
- Mocks: `fake-indexeddb/auto` for IDB
- Run: `npm test` (watch) or `npm run test:run` (single)

---

## 18. "Where do I change X?" — Recipes

| Goal | Files to touch |
|---|---|
| Add a route | `src/App.tsx` (`Routes`, `PATH_ACCENT_MAP`, `PATH_LABEL_MAP`), create page in `src/pages/`, register in `src/pages/index.ts`, add route to `BottomNav.tsx` if visible |
| Add a workout action | `core/workoutTypes.ts` (action union) → `core/workoutReducer.ts` (slice + add type to slice `Set`) → dispatch from a component via `useWorkoutDispatch()` |
| Add a workout setting | `types/index.ts → WorkoutSettings` → `hooks/useWorkoutSettings.ts → DEFAULT_WORKOUT_SETTINGS` → form in `overlays/WorkoutSettingsOverlay.tsx` → consume via `useWorkoutSettings()` |
| Add an IndexedDB store | `services/indexedDBCore.ts` (bump `DB_VERSION`, add `STORES` entry, upgrade callback) → wrapper service → re-export from `dataService.ts` |
| Add a Supabase table | `supabase/schema.sql` → mapping in `services/supabaseSync.ts` → run migration |
| Tweak rest-timer logic | `core/workoutReducer.ts → setReducer` (search `parseRestTimeString` and the `shouldStartRest` block) |
| Change auto-increment behavior | `core/workoutReducer.ts → setReducer → COMPLETE_SET` (search `shouldIncrement`) |
| Adjust persistence cadence | `core/WorkoutProvider.tsx` (debounce in main effect, 30 s backup interval, visibility/beforeunload handlers) |
| Add a global hook | `src/hooks/` — workout-only hooks go under `components/workout/hooks/` |
| Add a UI primitive | `src/components/ui/` + add to `index.tsx` barrel |
| Add a dashboard widget | `src/components/dashboard/` + mount in `pages/Dashboard.tsx` |
| Change colors / accent | `tailwind.config.js` + `src/styles/tokens.css` together |
| Add an offline-safe write | Call through service that uses `services/offlineQueue.ts` |
| Add an AI prompt / route | `services/ai.ts` or `services/ai/` + edge function `supabase/functions/ai-chat/` |

---

## 19. Conventions Worth Knowing

- **Named exports only** in barrel files (no `export *`) — preserves tree-shaking. Keep this when adding to `core/index.tsx`, `components/index.ts`, etc.
- **`React.lazy` heavy overlays** — anything not visible on first paint of the workout. See `ActiveWorkoutNew.tsx` top.
- **Three split contexts** for workout — never merge state + dispatch into one provider; doing so will re-render the whole tree on every action.
- **`useImmerReducer`** — mutate the `draft` directly inside reducer slices. Do not return new objects.
- **All JSON reads** go through `utils/safeJson.ts`.
- **All logs** go through `utils/logger.ts` (namespaced). Don't add `console.log`.
- **RTL/Hebrew** — UI strings are Hebrew; layout is RTL by default. Test in RTL.
- **No celebration UI / no badges/XP** — per project policy, achievement layer is silent (see `services/achievementService.ts`).

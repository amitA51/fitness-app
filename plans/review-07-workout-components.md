# Review 07 — Workout Components (Non-Core)

> **Scope:** 57 files across `src/components/workout/` — everything outside `core/` and `hooks/`.
> **Date:** 2026-05-28

---

## Executive Summary

The workout component layer is the largest module in the app (~57 files, ~8,500+ lines). It follows a "shell orchestrator + lazy overlays" architecture: [`ActiveWorkoutNew.tsx`](src/components/workout/ActiveWorkoutNew.tsx) is the main entry, delegating to child components via `React.lazy()`. The codebase shows evidence of a significant refactor (replacing a 1,295-line monolith) but carries substantial residual complexity. The editorial "VISION" design system is consistently applied via inline `style` objects. **Key risks:** ActiveWorkoutNew is still a 1,401-line God component with 40+ `useCallback` handlers; WorkoutSummary duplicates stats logic; overlay lazy loading is good but inconsistent; and the `components/` subfolder has unclear boundaries with the parent directory.

---

## 1. File-by-File Analysis

### 1.1 Top-Level Workout Components

#### 1. `ActiveWorkoutNew.tsx` — Main Orchestrator (1,401 lines)

- **Purpose:** Composes the entire active workout experience — header, exercise display, navigation, overlays, timers, save/finish flow.
- **Quality Issues:**
  - **Still monolithic despite refactor.** 40+ `useCallback` handlers defined inline; the component manages superset mode, swipe gestures, finish/save logic, template loading, water reminders, and overlay orchestration all in one file.
  - **Duplicated exercise loading logic** — the `useEffect` on line 200 loads personal exercises and sessions, duplicating what `useExerciseSuggestions` already does in [`components/ExerciseSuggestionLoader.tsx`](src/components/workout/components/ExerciseSuggestionLoader.tsx).
  - **`handleConfirmFinish` is ~100 lines** (728–874) — contains save logic, verification, localStorage manipulation, calorie estimation, and error handling. This is a service-level concern injected into a UI component.
  - **`eslint-disable-next-line react-hooks/exhaustive-deps`** on line 280 — suppresses missing dependency warning for the startup flow `useEffect`.
  - **Hebrew error messages** hardcoded inline (e.g., line 763: `'לא הושלמו סטים באימון זה...'`). Should be in a constants/i18n file.
  - **`emptyStringArray`** constant (line 94) is a workaround for referential stability — correct but signals the component needs memoization helpers.
  - **Type assertion** on line 1392: `onUpdate as (id: string, updates: Record<string, unknown>) => void` — unsafe cast to satisfy `WorkoutProvider` props.
- **Architectural Concerns:**
  - **SRP violation:** This component is simultaneously a layout orchestrator, a data loader, a save-workout service consumer, a gesture handler, and a modal manager.
  - **Missing abstraction:** The finish/save flow should be extracted to a custom hook (e.g., `useWorkoutSave`).
  - **Swipe gesture logic** (lines 550–609) is inlined rather than using the existing [`useSwipeGesture`](src/hooks/useSwipeGesture.tsx) hook.
- **Recommendations:**
  1. Extract `handleConfirmFinish` → `useWorkoutSave` hook.
  2. Extract superset mode state → `useSupersetMode` hook.
  3. Extract swipe navigation → use `useSwipeGesture` or a dedicated `useExerciseSwipeNav` hook.
  4. Use `useExerciseSuggestions` hook instead of duplicating loading logic.
  5. Extract Hebrew strings to a constants file.
  6. Target: reduce from 1,401 lines to ~600–800 lines.

#### 2. `AICoach.tsx` — AI Coaching Overlay (567 lines)

- **Purpose:** Three-tab AI assistant (chat, suggestions, analysis) during workouts.
- **Quality Issues:**
  - `renderContent` (line 292) is a `useMemo` that returns JSX — this is an anti-pattern; should be a regular function or separate components.
  - **DOMPurify sanitization** (line 462) is good security practice, but the markdown→HTML regex replacement (line 464) is fragile.
  - **`dangerouslySetInnerHTML`** with manual regex-to-HTML is a risk; consider a proper markdown parser.
  - **Offline tips** (lines 69–86) are hardcoded Hebrew strings — good fallback but should be externalized.
  - **`_i` unused variable** in `handleGetSuggestions` (line 167).
- **Architectural Concerns:** Imports `getRecoveryLogsByDateRange` and nutrition service directly — tight coupling to services that should be abstracted.
- **Recommendations:** Extract tabs into sub-components; use a markdown library instead of regex; externalize offline tips.

#### 3. `AnalyticsDashboard.tsx` — In-Workout Analytics (1,010 lines)

- **Purpose:** Volume charts, muscle balance radar, calendar heatmap, forecast.
- **Quality Issues:**
  - Very long file with extensive inline SVG charting.
  - **`shouldReduceMotion`** correctly used for accessibility.
  - **Duplicate color maps** — `MUSCLE_COLORS` (line 28) duplicates color logic found elsewhere.
  - **No error boundary** around analytics data loading.
- **Recommendations:** Extract chart sub-components (BarChart, Legend, ForecastSection) into separate files; centralize muscle color mapping.

#### 4. `ExerciseLibraryTab.tsx` — Library Browser (227 lines)

- **Purpose:** Searchable, filterable exercise library with create/delete.
- **Quality Issues:**
  - Clean delegation to child components (`ExerciseFilter`, `ExerciseForm`, `ExerciseList`, `DeleteConfirmDialog`).
  - **Retry logic** on line 91: `setTimeout(resolve, 300)` then re-fetch — brittle polling pattern.
  - `selectedCategory` state (line 75) is created but never updated (`[selectedCategory]` — no setter).
- **Recommendations:** Remove unused `selectedCategory` state; replace retry polling with proper error recovery.

#### 5. `ExerciseReorder.tsx` — Drag-Reorder Exercises (1,263 lines)

- **Purpose:** Bottom sheet with Framer Motion `Reorder.Group` for exercise reordering, set editing, superset creation.
- **Quality Issues:**
  - **Very large file** — includes `ExerciseReorderItem` and `SetEditRow` sub-components inline.
  - **`SetEditRow`** is 400+ lines of inline editing UI — should be its own file.
  - **Superset mode** state management is local but interacts with parent via props — could be confusing.
- **Recommendations:** Extract `SetEditRow` and `ExerciseReorderItem` to separate files; reduce to ~400 lines.

#### 6. `ExerciseTutorial.tsx` — Tutorial Overlay (489 lines)

- **Purpose:** Step-by-step exercise tutorial with AI-powered tips.
- **Quality Issues:**
  - **Hardcoded exercise tutorials** (lines 48–79) for Bench Press, Squat, Deadlift — limited coverage.
  - **Dynamic import** of AI service (line 107) is good for code splitting.
  - Keyboard navigation (arrow keys, Escape) is properly implemented.
- **Recommendations:** Move hardcoded tutorials to a data file; expand coverage or rely entirely on AI.

#### 7. `ForecastChart.tsx` — Volume/PR Forecast (231 lines)

- **Purpose:** Exercise-specific progression chart with forecast overlay.
- **Quality Issues:** Clean, focused component. Uses `GlowAreaChart` from charts module. Memoized.
- **No significant issues.**

#### 8. `icons.tsx` — Workout Icon Set (9 lines)

- **Purpose:** Re-exports Lucide icons used across workout components.
- **Quality:** Minimal, clean. No issues.

#### 9. `index.tsx` — Barrel Exports (107 lines)

- **Purpose:** Central export point for the workout module.
- **Quality Issues:**
  - Exports both `useRestTimer` from core and `useRestTimer as useRestTimerHook` from hooks — naming collision workaround.
  - "Legacy exports" section (lines 86–95) should be removed after migration.
- **Recommendations:** Clean up legacy exports; resolve `useRestTimer` naming conflict.

#### 10. `PlanEditorModal.tsx` — Edit Workout Plan (512 lines)

- **Purpose:** Modal for creating/editing workout templates with exercise library integration.
- **Quality Issues:**
  - **Import order violation:** `import { logger }` on line 56 appears after function definitions (lines 19–49) — should be at top.
  - **`templateExToEditorEx` / `editorExToTemplateEx`** mapping functions (lines 19–49) are good but could be in a utility.
  - Uses `ExerciseLibraryTab` in selection mode — good reuse.
- **Recommendations:** Move mapping functions to a utility; fix import order.

#### 11. `PRCelebration.tsx` — PR Celebration Animation (360 lines)

- **Purpose:** Confetti animation and PR display with share functionality.
- **Quality Issues:**
  - **Pre-computed confetti particles** (lines 19–37) — good for performance.
  - **`document.dir === 'rtl'`** (line 41) — accessed during render, not in effect; should use a hook or context.
  - **`useReducedMotion`** correctly used throughout.
- **Recommendations:** Extract RTL detection to a hook; consider sharing confetti logic with `PRHighlights.tsx`.

#### 12. `PRHistoryTab.tsx` — PR History List (161 lines)

- **Purpose:** Displays all personal records grouped by exercise.
- **Quality Issues:**
  - Clean, well-structured. Proper cancellation pattern in `useEffect`.
  - **`logger.workout?.error?.`** optional chaining (line 64) — defensive but indicates logger may be undefined.
- **No significant issues.**

#### 13. `ProgramCard.tsx` — Built-in Program Card (181 lines)

- **Purpose:** Displays workout programs with progress tracking.
- **Quality Issues:**
  - Reads `program_progress_${id}` from localStorage (line 36) — tight coupling to storage format.
  - Uses `safeJsonParse` correctly.
- **No significant issues.**

#### 14. `ProgressionRecommendation.tsx` — AI Next-Set Recommendation (326 lines)

- **Purpose:** Displays weight progression recommendations with confidence indicators.
- **Quality Issues:**
  - Exports three components: `ProgressionRecommendation`, `ProgressionHistory`, `ProgressionSummary` — good separation.
  - Uses service functions (`getRecommendationLabel`, etc.) properly.
- **No significant issues.**

#### 15. `QuickExerciseForm.tsx` — Quick Add Exercise Form (341 lines)

- **Purpose:** Bottom sheet form for quickly adding exercises during a workout.
- **Quality Issues:**
  - **Double memo** — `memo()` wrapper on line 16 AND `React.memo` on export line 340 — redundant.
  - **`as unknown as CreatePersonalExerciseInput`** type assertion (line 67) — unsafe cast.
  - **`id: ex-${Date.now()}`** (line 35) — potential collision; should use `crypto.randomUUID()`.
- **Recommendations:** Remove double memo; fix type assertion; use UUID for IDs.

#### 16. `RestTimer.tsx` — Standalone Timer (412 lines)

- **Purpose:** Full-screen rest timer with circular progress, pause/resume, time adjustments.
- **Quality Issues:**
  - Timestamp-based timing (line 29) — correctly survives background tabs.
  - **Visibility change handler** (line 62) — good for background recovery.
  - **Duplicate logic** with `RestTimerOverlay.tsx` (910 lines) — two rest timer implementations.
- **Architectural Concerns:** `RestTimer.tsx` and `RestTimerOverlay.tsx` overlap significantly. The overlay is used in the active workout; this standalone version appears unused or legacy.
- **Recommendations:** Consolidate into one implementation; check if `RestTimer.tsx` is actually imported anywhere.

#### 17. `themes.ts` — Workout Theme Palettes (46 lines)

- **Purpose:** Stub file — theme system was removed.
- **Quality Issues:** `WORKOUT_THEMES` is still exported and used by `SettingsPrimitives.tsx` (line 7). The `getThemeVariables` returns an empty object — dead code.
- **Recommendations:** Either fully remove the stub or restore theme functionality; currently misleading.

#### 18. `WarmupCooldownFlow.tsx` — Warmup/Cooldown Wizard (955 lines)

- **Purpose:** Selection + timed execution flow for warmup/cooldown routines.
- **Quality Issues:**
  - **Well-structured** with `useReducer` for state management (line 796).
  - **SelectionStep** and **ActiveStep** are extracted as sub-components — good separation.
  - **Timer uses `setTimeout` + `dispatch`** (line 847) — could use `requestAnimationFrame` or `setInterval` for smoother updates.
  - **`eslint-disable-next-line react-hooks/exhaustive-deps`** (line 827) — suppressed dependency warning.
- **Recommendations:** Consider `useRef` for timer instead of re-rendering on every second; fix exhaustive-deps.

#### 19. `WaterReminderToast.tsx` — Water Reminder Toast (39 lines)

- **Purpose:** Auto-dismissing water reminder toast.
- **Quality:** Minimal, clean. Properly memoized. No issues.

#### 20. `WorkoutCalendar.tsx` — Calendar Heatmap (471 lines)

- **Purpose:** Monthly workout calendar with heatmap and click-through navigation.
- **Quality Issues:**
  - **Hebrew number map** (lines 18–50) — hardcoded; should be a utility.
  - **`useNavigate`** from react-router-dom — tight coupling to routing.
  - Proper accessibility: `role="gridcell"`, `aria-label`, `aria-current="date"`.
- **Recommendations:** Extract Hebrew number utility; consider abstracting navigation.

#### 21. `WorkoutGoalSelector.tsx` — Goal Picker (151 lines)

- **Purpose:** Modal for selecting workout goal before starting.
- **Quality Issues:**
  - **z-index `100`** (line 28) — extremely low; will be behind other overlays that use 9000+.
  - Uses raw CSS classes (`masthead`, `kicker`) — mixing with inline styles.
- **Recommendations:** Use consistent z-index from `constants/zIndex.ts`; standardize styling approach.

#### 22. `WorkoutHistoryScreen.tsx` — History Screen (782 lines)

- **Purpose:** Full workout history with search, grouping, stats.
- **Quality Issues:**
  - **`StatCard` and `SessionCard`** are memoized sub-components — good.
  - **`formatDuration`** and **`formatDate`** are duplicated from other files (also in `dateUtils.ts`).
  - **`calculateSessionVolume`** and **`getMainMuscleGroup`** duplicate logic from `WorkoutSummary.tsx`.
- **Recommendations:** Extract shared date/volume formatting to utilities; use existing `dateUtils`.

#### 23. `WorkoutStartModal.tsx` — Start Workout Prompt (574 lines)

- **Purpose:** Bottom sheet with templates, quick start, and recent exercises.
- **Quality Issues:**
  - **Dual event handlers** — both `onClick` and `onPointerDown` on buttons (e.g., lines 152–160, 186–194) — causes double-fire.
  - `loadData` defined as regular function (line 41) — should be wrapped in `useCallback` or moved inside `useEffect`.
- **Recommendations:** Remove duplicate event handlers; wrap `loadData` properly.

#### 24. `WorkoutSummary.tsx` — End-of-Workout Recap (721 lines)

- **Purpose:** Post-workout summary with stats, PRs, rating, share/export.
- **Quality Issues:**
  - **`computeStats` function** (lines 44–104) duplicates volume/set calculation logic found in `WorkoutHistoryScreen.tsx` and `PerformanceAnalytics.tsx`.
  - **PR computation** (lines 202–257) loads `getAllWorkoutSessions()` — expensive full-history fetch on every summary display.
  - **Comparison logic** (lines 133–199) duplicates volume calculation from `computeStats`.
  - **Workout rating** uses inline emoji objects (lines 439–445) — should be constants.
  - **`handleExportCSV`** and **`handleShare`** are direct service calls — good separation.
- **Architectural Concerns:**
  - **Should be split:** The stats computation, comparison logic, PR detection, and UI rendering are all in one file. The `computeStats` function should be a shared utility.
  - **Missing loading/error states** for PR computation.
- **Recommendations:**
  1. Extract `computeStats` to `utils/workoutStats.ts`.
  2. Extract comparison logic to a hook.
  3. Cache PR computation results.
  4. Target: reduce from 721 lines to ~400 lines.

#### 25. `WorkoutTemplates.tsx` — Templates Panel (1,017 lines)

- **Purpose:** Template list with create/edit/delete functionality.
- **Quality Issues:**
  - **Dual event handlers** (`onClick` + `onPointerDown`) throughout — causes double execution.
  - **`getBuiltinTemplateIcon`** (line 19) always returns `'§'` — dead parameter.
  - **Delete confirmation** is inline (lines 873–1000) — should use `DeleteConfirmDialog` component.
- **Recommendations:** Remove duplicate handlers; use existing `DeleteConfirmDialog`; extract template card to a sub-component.

### 1.2 Stateless Components (`components/` subfolder)

#### 26. `AlternativesSheet.tsx` (142 lines)
- **Purpose:** Bottom sheet for alternative exercise selection.
- **Quality:** Clean, uses `ModalOverlay`, proper focus trap. No issues.

#### 27. `DeleteConfirmDialog.tsx` (150 lines)
- **Purpose:** Confirmation dialog for exercise deletion.
- **Quality Issues:**
  - **Not using `ModalOverlay`** — manually renders fixed overlay (line 23–34) with hardcoded `z-index: 13000`.
  - No focus trap or scroll lock.
- **Recommendations:** Refactor to use `ModalOverlay` for consistency and accessibility.

#### 28. `ExerciseCard.tsx` (248 lines)
- **Purpose:** Single exercise row in the library list.
- **Quality:** Well-memoized, proper accessibility (`role="button"`, `tabIndex`, `onKeyDown`). Hebrew name rendering logic (`renderExerciseName`) is hoisted — good.

#### 29. `ExerciseDisplay.tsx` (582 lines)
- **Purpose:** Center area display during active workout — exercise card, input cards, action chips.
- **Quality Issues:**
  - **Many sub-components** inlined (`ActionChip`) — should be separate for reuse.
  - **Multiple bottom sheets** managed via local state (`showSetEditor`, `showRPEPicker`, `showNotesSheet`, `showAlternatives`) — each is a boolean toggle.
  - **`showVolumePreview`** prop accepted but never used (line 41).
- **Recommendations:** Extract `ActionChip` to shared components; consider a reducer for bottom sheet state.

#### 30. `ExerciseFilter.tsx` (368 lines)
- **Purpose:** Search input with suggestions, favorites, muscle group pills.
- **Quality Issues:**
  - **Inline `DumbbellIcon` SVG** (lines 346–364) — to "avoid circular import" — but the icon is already in `icons.tsx`.
  - **`favorites` computed on every render** (line 48) — should be memoized.
- **Recommendations:** Use existing icon; memoize favorites.

#### 31. `ExerciseForm.tsx` (285 lines)
- **Purpose:** Create/edit exercise form.
- **Quality:** Clean, well-structured. Exports both `ExerciseForm` and `AddExerciseButton`. No significant issues.

#### 32. `ExerciseList.tsx` (169 lines)
- **Purpose:** Exercise list with virtualization for large lists.
- **Quality Issues:**
  - **Virtualization threshold** of 15 (line 10) — reasonable.
  - **`getScrollElement`** walks up DOM tree (lines 111–118) — fragile; could break with layout changes.
  - **Inline `DumbbellIcon`** (lines 13–25) — duplicate of the one in `ExerciseFilter.tsx`.
- **Recommendations:** Share `DumbbellIcon` across components; consider a ref-based scroll container.

#### 33. `ExerciseNav.tsx` (239 lines)
- **Purpose:** Bottom navigation between exercises (prev/next/list/add).
- **Quality:** Excellent custom `memo` comparator (lines 223–233) that deep-compares exercises. Keyboard navigation (arrow keys) properly handled. Well-optimized.

#### 34. `ExerciseSuggestionLoader.tsx` (52 lines)
- **Purpose:** Custom hook for loading exercise suggestions.
- **Quality Issues:**
  - **Not used by `ActiveWorkoutNew.tsx`** — which duplicates the same logic inline (lines 199–221).
  - **Returns `useExerciseSuggestions` as default export** — but the file is named "Loader", not "hook".
- **Recommendations:** Use this hook in `ActiveWorkoutNew.tsx`; rename to `useExerciseSuggestions.ts`.

#### 35. `components/index.ts` (22 lines)
- **Purpose:** Barrel exports for components subfolder.
- **Quality Issues:** Missing exports for many components (`AlternativesSheet`, `NotesBottomSheet`, `RPEPicker`, `SetEditBottomSheet`, `SlideToComplete`, `InlineRestTimer`, `WorkoutAriaLive`, `SummaryExerciseList`, `TrendLineOverlay`, `PRHighlights`, `StatsGrid`, `MuscleRadarChart`).
- **Recommendations:** Add missing exports for completeness.

#### 36. `InlineRestTimer.tsx` (241 lines)
- **Purpose:** Compact inline rest timer strip shown during rest periods.
- **Quality:** Clean, uses `useRestTimer` hook. Proper `prefers-reduced-motion` detection. Memoized.

#### 37. `IntensityMeter.tsx` (476 lines)
- **Purpose:** Real-time workout intensity gauge with zones.
- **Quality Issues:**
  - **Apple Fitness+ style zones** with hardcoded colors (lines 47–82) — uses non-design-system colors (`#30D158`, `#FFD60A`, etc.) instead of CSS variables.
  - **`useSpring` + `useTransform`** from Framer Motion — proper animation approach.
  - **`displayIntensity`** uses `setTimeout` for animation delay (line 347) — could use `useSpring` directly.
- **Recommendations:** Align colors with design system CSS variables.

#### 38. `MuscleRadarChart.tsx` (280 lines)
- **Purpose:** SVG radar chart for muscle group balance.
- **Quality:** Clean SVG implementation with proper hover tooltips. Memoized. No significant issues.

#### 39. `NotesBottomSheet.tsx` (304 lines)
- **Purpose:** Free-text notes input with quick note presets.
- **Quality:** Uses `ModalOverlay`. Quick notes are Hebrew strings (lines 18–27) — should be constants. Otherwise clean.

#### 40. `PerformanceAnalytics.tsx` (499 lines)
- **Purpose:** Real-time workout performance dashboard.
- **Quality Issues:**
  - **`calculateAllStats`** (lines 79–112) is a good single-pass calculation.
  - **`calculateVolume`** and **`calculateCompletedSets`** are legacy wrappers (lines 115–121) — exported but may be unused.
  - **Duplicate `formatDuration`** with `WorkoutHistoryScreen.tsx`.
- **Recommendations:** Consolidate `formatDuration` into shared utility.

#### 41. `PRHighlights.tsx` (158 lines)
- **Purpose:** PR celebration with confetti and RPE display.
- **Quality Issues:**
  - **`Confetti`** component uses `Math.random()` in `useMemo` (line 22) — non-deterministic; `PRCelebration.tsx` uses pre-computed particles. Inconsistent approach.
  - **Duplicate confetti logic** with `PRCelebration.tsx`.
- **Recommendations:** Share confetti implementation between PR components.

#### 42. `ProgressBar.tsx` (142 lines)
- **Purpose:** Top progress indicator with glow effects and milestones.
- **Quality:** Clean, memoized. Shimmer animation and glow effects are well-implemented. No issues.

#### 43. `SlideToComplete.tsx` (221 lines)
- **Purpose:** Swipe-to-complete gesture for set completion.
- **Quality:** Excellent implementation with RTL support, keyboard accessibility (Enter/Space), haptic feedback, threshold-based completion. Proper pointer capture management.

#### 44. `StatsGrid.tsx` (350 lines)
- **Purpose:** Numerical stats grid with animated counters and comparison badges.
- **Quality:** Clean, memoized sub-components. `AnimatedCounter` uses `setInterval` for counting animation — reasonable. No significant issues.

### 1.3 Exercise Selector

#### 45. `CategoryPill.tsx` (35 lines)
- **Purpose:** Category filter pill for exercise selector.
- **Quality:** Minimal, uses design tokens. No issues.

#### 46. `ExerciseSelector/index.tsx` (375 lines)
- **Purpose:** Full exercise selection overlay with tabs (exercises/templates).
- **Quality Issues:**
  - **`_onCreateNew` and `_goal`** (lines 40–41) — props accepted but prefixed with underscore (unused).
  - **`_userTemplates` and `_builtinTemplates`** (lines 43–44) — state set but never read in JSX.
  - **Multi-select mode** with `pendingExercises` state — good UX pattern.
- **Recommendations:** Remove unused props/state or implement the features.

### 1.4 Overlays

#### 47. `ConfirmExitOverlay.tsx` (397 lines)
- **Purpose:** Confirmation for finishing/canceling workout.
- **Quality:** Uses `ModalOverlay` with proper focus trap. Shows workout stats. Loading state for save. Clean.

#### 48. `overlays/index.tsx` (6 lines)
- **Purpose:** Barrel exports.
- **Quality:** Missing `PlateCalculatorOverlay` and `SettingsPrimitives` exports.

#### 49. `NumpadOverlay.tsx` (689 lines)
- **Purpose:** On-screen numpad for weight/reps entry.
- **Quality Issues:**
  - **Very large** for a numpad — includes presets, increments, animated value display.
  - **Properly uses `ModalOverlay`** with focus trap.
  - **Reduced motion** support throughout.
- **Recommendations:** Extract `AnimatedValue` and preset buttons to sub-components.

#### 50. `PlateCalculatorOverlay.tsx` (400 lines)
- **Purpose:** Plate-per-side calculator for barbell loading.
- **Quality:** Pure presentational component with greedy algorithm. Uses `ModalOverlay`. Clean.

#### 51. `RestTimerOverlay.tsx` (910 lines)
- **Purpose:** Full-screen and mini rest timer with voice countdown, next exercise preview.
- **Quality Issues:**
  - **910 lines** — the largest overlay. Includes MiniTimer, FullTimer, and voice countdown.
  - **`createPortal`** used directly (line 8) instead of `ModalOverlay` — inconsistent with other overlays.
  - **`STRONG_VIBRATION_PATTERN`** (lines 71–85) — good haptic design.
- **Recommendations:** Extract MiniTimer and FullTimer to separate files; consider using `ModalOverlay` for consistency.

#### 52. `SettingsPrimitives.tsx` (350 lines)
- **Purpose:** Reusable settings UI primitives (Toggle, ChipSelector, Slider, etc.).
- **Quality:** Good extraction from `WorkoutSettingsOverlay`. Clean memoized primitives. Exports `SETTINGS_TABS`, `GOALS`, etc.

#### 53. `WorkoutSettingsOverlay.tsx` (698 lines)
- **Purpose:** Full workout settings overlay with tabs.
- **Quality Issues:**
  - **Imports `AnalyticsDashboard`** (line 10) — a heavy component loaded eagerly within the settings overlay.
  - **Imports `ExerciseLibraryTab`** and `PRHistoryTab`** — all eagerly loaded.
  - **9 tabs** (from `SETTINGS_TABS`) — very complex settings surface.
- **Recommendations:** Lazy-load tab content (AnalyticsDashboard, ExerciseLibraryTab, PRHistoryTab).

### 1.5 States

#### 54. `EmptyWorkoutState.tsx` (178 lines)
- **Purpose:** Empty state when no exercises in workout.
- **Quality:** Clean, memoized. Uses design tokens. No issues.

#### 55. `states/index.ts` (7 lines)
- **Purpose:** Barrel exports.
- **Quality:** Clean.

#### 56. `PreWorkoutScreen.tsx` (663 lines)
- **Purpose:** Welcome screen before starting workout with template suggestions, muscle group data, streak.
- **Quality Issues:**
  - **663 lines** for a pre-workout screen — complex.
  - **Imports from `analyticsService`** and `workoutDb`** directly — tight coupling.
  - **`NOISE_TEXTURE_SVG`** (line 22) — inline SVG data URI — should be in CSS or a shared asset.
- **Recommendations:** Extract muscle suggestion cards and template quick-start to sub-components.

### 1.6 Common

#### 57. `common/IconMap.tsx` (67 lines)
- **Purpose:** Maps icon name strings to Lucide components with legacy emoji support.
- **Quality:** Clean. Unicode escapes for emoji keys (line 46+) — good practice. Fallback to Dumbbell.

---

## 2. Cross-Cutting Analysis

### 2.1 ActiveWorkoutNew.tsx Composition — Is It Monolithic?

**Verdict: Partially decomposed, still too large.**

The component was refactored from a 1,295-line monolith to a 1,401-line orchestrator. While overlays are now lazy-loaded and state is managed via `WorkoutProvider`/`workoutReducer`, the orchestrator itself still:

- Manages 15+ pieces of local state
- Defines 40+ `useCallback` handlers
- Contains the entire save-workout flow (~150 lines)
- Handles swipe gesture detection (~60 lines)
- Manages superset mode (~30 lines)
- Controls all modal open/close transitions

**Recommendation:** Extract into a `useWorkoutOrchestrator` hook that returns all handlers and state, keeping the JSX clean.

### 2.2 WorkoutSummary.tsx — Should It Be Split?

**Verdict: Yes.**

At 721 lines, `WorkoutSummary` contains:

1. **Stats computation** (`computeStats`) — 60 lines of pure calculation
2. **Comparison loading** — 67 lines of async data fetching
3. **PR computation** — 56 lines of async history analysis
4. **UI rendering** — ~400 lines of JSX across two views (overview/details)
5. **Share/Export handlers** — 30 lines

**Recommended split:**
- `utils/workoutStats.ts` — `computeStats` function
- `hooks/useWorkoutComparison.ts` — comparison data loading
- `hooks/useWorkoutPRs.ts` — PR detection
- `WorkoutSummary.tsx` — pure UI (~300 lines)

### 2.3 Overlay Lazy Loading Effectiveness

**Verdict: Good for main overlays, inconsistent for nested ones.**

In [`ActiveWorkoutNew.tsx`](src/components/workout/ActiveWorkoutNew.tsx), the following are lazy-loaded:
- ✅ `NumpadOverlay` (689 lines)
- ✅ `ConfirmExitOverlay` (397 lines)
- ✅ `PlateCalculatorOverlay` (400 lines)
- ✅ `WorkoutSettingsOverlay` (698 lines)
- ✅ `WorkoutSummary` (721 lines)
- ✅ `ExerciseTutorial` (489 lines)
- ✅ `ExerciseSelector` (375 lines)
- ✅ `QuickExerciseForm` (341 lines)
- ✅ `WarmupCooldownFlow` (955 lines)
- ✅ `WorkoutGoalSelector` (151 lines)
- ✅ `ExerciseReorder` (1,263 lines)

**Issues:**
- ❌ `WorkoutSettingsOverlay` eagerly imports `AnalyticsDashboard` (1,010 lines), `ExerciseLibraryTab` (227 lines), and `PRHistoryTab` (161 lines) — defeating lazy loading.
- ❌ `RestTimerOverlay` (910 lines) is NOT lazy-loaded — it's used via direct import in the workout provider.
- ❌ `WaterReminderToast` (39 lines) is eagerly imported — acceptable given its small size.

### 2.4 Component Reusability vs Workout-Specific Coupling

**Most reusable (generic):**
- `SlideToComplete` — generic gesture component
- `ProgressBar` — generic progress indicator
- `NotesBottomSheet` — generic notes input
- `DeleteConfirmDialog` — generic confirmation (but needs ModalOverlay refactor)
- `StatsGrid` — generic stats display
- `MuscleRadarChart` — generic radar chart
- `ExerciseCard` — generic list item
- `ExerciseList` — generic virtualized list
- Settings primitives (`Toggle`, `ChipSelector`, `SliderSetting`)

**Workout-specific (tightly coupled):**
- `ExerciseDisplay` — deeply coupled to workout state shape
- `ExerciseNav` — coupled to exercise array navigation
- `InlineRestTimer` — coupled to rest timer state
- `IntensityMeter` — coupled to workout intensity calculation
- `PerformanceAnalytics` — coupled to exercise data shape
- `NumpadOverlay` — coupled to weight/reps input model

**Coupling issues:**
- Many components import from `../core/workoutTypes` — acceptable within the workout module.
- `AnalyticsDashboard` imports from `analyticsService` directly — could be abstracted.
- `WorkoutCalendar` uses `useNavigate` from react-router — routing coupling in a presentation component.

### 2.5 `components/` Subfolder Separation

**Verdict: Unclear boundaries, needs cleanup.**

The `components/` subfolder contains:
- **Workout-internal components** (`ExerciseDisplay`, `ExerciseNav`, `InlineRestTimer`, `SetInputCard`, `WorkoutHeader`) — used only by `ActiveWorkoutNew.tsx`
- **Library components** (`ExerciseCard`, `ExerciseList`, `ExerciseFilter`, `ExerciseForm`, `DeleteConfirmDialog`) — used by `ExerciseLibraryTab.tsx`
- **Summary components** (`StatsGrid`, `SummaryExerciseList`, `PRHighlights`) — used by `WorkoutSummary.tsx`
- **Analytics components** (`MuscleRadarChart`, `TrendLineOverlay`) — used by `AnalyticsDashboard.tsx`
- **Generic components** (`ProgressBar`, `SlideToComplete`, `NotesBottomSheet`) — reusable

**Issues:**
- The barrel export in `components/index.ts` only exports 15 of 25+ components.
- No clear naming convention separates workout-internal from reusable components.
- `DumbbellIcon` is defined inline in both `ExerciseFilter.tsx` and `ExerciseList.tsx` instead of being shared.

**Recommendations:**
- Create `components/workout-internal/` for components only used during active workout.
- Move `DumbbellIcon` to `icons.tsx`.
- Complete the barrel exports.

---

## 3. Recurring Patterns & Anti-Patterns

### ✅ Good Patterns
1. **Consistent editorial design** — "VISION Sport Annual" typography, sharp corners, navy/mustard/bone palette applied consistently via CSS variables.
2. **`React.memo`** used extensively on sub-components with proper `displayName`.
3. **`ModalOverlay`** abstraction for overlays with focus trap and scroll lock.
4. **Lazy loading** of heavy overlays via `React.lazy()`.
5. **Accessibility** — `aria-label`, `role="dialog"`, `aria-modal`, keyboard navigation in many components.
6. **Reduced motion** support via `useReducedMotion()`.
7. **Haptic feedback** integration throughout.

### ❌ Anti-Patterns
1. **Dual event handlers** — `onClick` + `onPointerDown` on the same element (WorkoutStartModal, WorkoutTemplates) causes double execution.
2. **Duplicate utility functions** — `formatDuration`, `formatDate`, `calculateSessionVolume`, `getMainMuscleGroup` are defined in multiple files.
3. **Duplicate `DumbbellIcon`** — inline SVG in `ExerciseFilter.tsx` and `ExerciseList.tsx`.
4. **Hardcoded Hebrew strings** — scattered throughout instead of centralized.
5. **Type assertions** — `as unknown as CreatePersonalExerciseInput` patterns.
6. **`eslint-disable` comments** — suppressing `react-hooks/exhaustive-deps` warnings.
7. **Mixed styling approaches** — inline `style` objects, Tailwind classes, and CSS classes mixed in the same component.
8. **Duplicate confetti implementations** — `PRCelebration.tsx` vs `PRHighlights.tsx`.

---

## 4. Priority Recommendations

### P0 — Critical
1. **Extract `handleConfirmFinish` from `ActiveWorkoutNew.tsx`** to `useWorkoutSave` hook — reduces God component complexity.
2. **Consolidate `RestTimer.tsx` and `RestTimerOverlay.tsx`** — check if `RestTimer.tsx` is unused and remove it.
3. **Fix dual event handlers** in `WorkoutStartModal.tsx` and `WorkoutTemplates.tsx` — causes bugs.

### P1 — High
4. **Extract `computeStats` from `WorkoutSummary.tsx`** to shared utility — eliminates duplication across 3 files.
5. **Lazy-load tab content in `WorkoutSettingsOverlay`** — `AnalyticsDashboard` (1,010 lines) defeats lazy loading.
6. **Complete `components/index.ts` exports** — 10+ components are missing from the barrel.
7. **Use `ModalOverlay` in `DeleteConfirmDialog`** — currently lacks focus trap and scroll lock.

### P2 — Medium
8. **Extract `SetEditRow` from `ExerciseReorder.tsx`** — 400+ lines of inline sub-component.
9. **Consolidate `DumbbellIcon`** — move to `icons.tsx`, remove inline copies.
10. **Consolidate `formatDuration`/`formatDate`** — use existing `dateUtils.ts`.
11. **Fix `WorkoutGoalSelector` z-index** — currently `100`, should use `Z_INDEX` constants.
12. **Remove unused props/state** in `ExerciseSelector/index.tsx` (`_goal`, `_onCreateNew`, `_userTemplates`, `_builtinTemplates`).

### P3 — Low
13. **Clean up `themes.ts` stub** — either restore or fully remove.
14. **Externalize Hebrew strings** to constants.
15. **Fix `PRHighlights` confetti** to use deterministic particles (like `PRCelebration`).
16. **Standardize styling approach** — pick one of inline styles or Tailwind consistently.

---

## 5. File Size Summary

| File | Lines | Risk |
|------|------:|------|
| ActiveWorkoutNew.tsx | 1,401 | 🔴 God component |
| ExerciseReorder.tsx | 1,263 | 🔴 Too large |
| RestTimerOverlay.tsx | 910 | 🟡 Large overlay |
| WarmupCooldownFlow.tsx | 955 | 🟡 Large but well-structured |
| WorkoutHistoryScreen.tsx | 782 | 🟡 Acceptable |
| WorkoutSummary.tsx | 721 | 🟡 Should be split |
| NumpadOverlay.tsx | 689 | 🟡 Acceptable |
| WorkoutSettingsOverlay.tsx | 698 | 🟡 Acceptable |
| PreWorkoutScreen.tsx | 663 | 🟡 Large welcome screen |
| ExerciseDisplay.tsx | 582 | 🟢 Acceptable |
| WorkoutStartModal.tsx | 574 | 🟢 Acceptable |
| AICoach.tsx | 567 | 🟢 Acceptable |
| PerformanceAnalytics.tsx | 499 | 🟢 Good |
| WorkoutCalendar.tsx | 471 | 🟢 Good |
| IntensityMeter.tsx | 476 | 🟢 Good |
| ExerciseTutorial.tsx | 489 | 🟢 Good |
| PlateCalculatorOverlay.tsx | 400 | 🟢 Good |
| ConfirmExitOverlay.tsx | 397 | 🟢 Good |
| ExerciseSelector/index.tsx | 375 | 🟢 Good |
| ExerciseFilter.tsx | 368 | 🟢 Good |
| StatsGrid.tsx | 350 | 🟢 Good |
| SettingsPrimitives.tsx | 350 | 🟢 Good |
| QuickExerciseForm.tsx | 341 | 🟢 Good |
| ProgressionRecommendation.tsx | 326 | 🟢 Good |
| NotesBottomSheet.tsx | 304 | 🟢 Good |
| MuscleRadarChart.tsx | 280 | 🟢 Good |
| ExerciseForm.tsx | 285 | 🟢 Good |
| ForecastChart.tsx | 231 | 🟢 Good |
| ExerciseNav.tsx | 239 | 🟢 Good |
| SlideToComplete.tsx | 221 | 🟢 Good |
| ExerciseLibraryTab.tsx | 227 | 🟢 Good |
| InlineRestTimer.tsx | 241 | 🟢 Good |
| ExerciseCard.tsx | 248 | 🟢 Good |
| EmptyWorkoutState.tsx | 178 | 🟢 Good |
| ExerciseList.tsx | 169 | 🟢 Good |
| PRHistoryTab.tsx | 161 | 🟢 Good |
| PRHighlights.tsx | 158 | 🟢 Good |
| ProgramCard.tsx | 181 | 🟢 Good |
| WorkoutGoalSelector.tsx | 151 | 🟢 Good |
| AlternativesSheet.tsx | 142 | 🟢 Good |
| ProgressBar.tsx | 142 | 🟢 Good |
| DeleteConfirmDialog.tsx | 150 | 🟢 Good |
| PRCelebration.tsx | 360 | 🟢 Good |
| WorkoutTemplates.tsx | 1,017 | 🟡 Large |
| AnalyticsDashboard.tsx | 1,010 | 🟡 Large |

**Total estimated lines: ~19,800+**

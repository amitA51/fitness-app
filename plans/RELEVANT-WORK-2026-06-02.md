# SparkOS Fitness — Relevant Work Only

> **Purpose:** a cleaned, current-only planning file.
> This file keeps only items that still appear relevant in the current codebase or remain a product/architecture decision.
> It excludes items already fixed, items that are clearly outdated, and items that depend on unresolved product choices.
>
> **Source basis:** current code inspection + existing plan docs. Where a finding is still a risk but not fully verified here, it is marked **needs re-check** rather than stated as fact.

---

## What this file is for

Use this file as the active checklist for follow-up work. If something is already fixed in code or depends on an old plan that no longer matches the repo, it should not be listed here.

---

## 1. Verified current issues

### 1.1 `App.tsx` still mixes multiple responsibilities
**Status:** still relevant

`src/App.tsx` still contains routing, auth gating, onboarding gating, page shell logic, page accent selection, and workout placeholder wiring.

**Why it matters:** the file is hard to maintain and test as a single unit.

**Recommended direction:**
- extract `AppRouter`
- extract `AppShell`
- keep route-level helpers in smaller files
- keep the main file focused on composition only

---

### 1.2 Login and onboarding routes are not wrapped in `PageErrorBoundary`
**Status:** still relevant

From the current app flow, unauthenticated users reach `Login`, and first-run users reach `OnboardingFlow`, but those paths are not wrapped in a page-level error boundary the way the main routed pages are.

**Why it matters:** a render failure in either screen can escalate straight to the root error boundary.

**Recommended direction:**
- wrap `Login` in `PageErrorBoundary`
- wrap `OnboardingFlow` in `PageErrorBoundary`
- add the same treatment to any other high-risk route that is still unprotected

---

### 1.3 Workout placeholder route still lacks page-level protection
**Status:** still relevant

`WorkoutPlaceholder` is still rendered directly and should be reviewed for page-level error isolation.

**Why it matters:** the workout flow is one of the most complex parts of the app.

**Recommended direction:**
- wrap the workout entry route in `PageErrorBoundary`
- keep the in-workout overlay boundary as an inner layer, not the only safety net

---

### 1.4 `PageThemeContext` should be checked against the current product direction
**Status:** needs product decision

The app still applies page-based accent variables through `PageThemeProvider`, but the broader product direction should decide whether that abstraction should stay or be simplified.

**Recommended options:**
- keep distinct per-page theming if the current visual system still wants route-specific accents
- simplify to a single accent pipeline if uniformity is the intended design

---

### 1.5 `RestTimerOverlay` should be re-checked for actual use
**Status:** needs re-check

The file still exists in the codebase and is referenced in comments, but it should be verified against current imports before any decision is made.

**Recommended direction:**
- if truly unused, delete it and remove any barrel exports
- if intentionally kept for future use, mark it clearly as dormant/disabled

---

## 2. Still likely relevant, but should be verified before editing

These items came from the larger review docs and may still matter, but they should only be acted on after a quick code check.

### 2.1 CSS duplication between `global.css` and `components.css`
**Status:** likely still relevant, but must be visually verified

The same component classes appear in both files in the review docs, with different values and cascade dependencies.

**Do not edit blindly.** If this is still present, any cleanup must be done with the app running and a visual check after each selector change.

---

### 2.2 `workoutDb` / service split work
**Status:** partially relevant, mostly architecture work

The old plans describe splitting a large data-service file into smaller modules. This may still be a good refactor if the current file is still large, but it should only be done if the code still matches the old shape.

**Recommended direction:**
- verify the current file sizes and module boundaries first
- keep only the splits that are still needed
- avoid copying old plan text that no longer matches the current code

---

### 2.3 DataContext and workout-state optimization
**Status:** still plausible, but should be checked against current performance needs

The older plans describe broad context re-renders and large mount-time loads. This may still be a useful optimization target, but it is not a first-order cleanup task.

**Recommended direction:**
- verify current context value size and load strategy
- only keep the work if the current code still loads too much on mount

---

## 3. Things that should NOT be carried forward from the old plans

Do not keep these in the active plan unless a fresh code check brings them back:

- issues already fixed in the current branch
- old line counts and file-size estimates without re-checking the code
- old claims about unrelated type fields that do not exist anymore
- stale phase plans that duplicate newer handoff files
- any note that only exists because an older review was written against a previous state of the repo

---

## 4. Suggested active next steps

1. Verify whether `RestTimerOverlay` is truly unused.
2. Decide whether `PageThemeContext` should remain route-based or be simplified.
3. Add `PageErrorBoundary` coverage to `Login`, `OnboardingFlow`, and the workout entry route.
4. If CSS duplication is still present, audit it with the app running and clean one selector at a time.
5. Only then consider larger refactors like service splitting or DataContext optimization.

---

## 5. Notes

This file is intentionally short. It is meant to replace the older overlapping plan files as the current working checklist.

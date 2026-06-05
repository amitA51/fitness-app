# Implementation Plan: In-App First-Use Guidance ("הדרכה איך להשתמש")

> Authored by planning agent, 2026-06-05. Execute AFTER fix-wave-1 lands (touchpoints overlap App.tsx / Settings.tsx).

## What already exists (confirmed)

- **`OnboardingFlow`** (`src/pages/OnboardingFlow.tsx`) is a profile-collection wizard (name/age/goals), gated by `localStorage['onboarding_completed']`. It is **not** "how to use the app" guidance — it runs *before* `AppShell` mounts and collects data. Our feature is separate and runs *inside* `AppShell`, after onboarding. Do not touch the onboarding gate.
- **Reusable sheet primitive**: `src/components/ui/Sheet.tsx` → `src/components/ui/ModalOverlay.tsx` already provides focus trap, scroll lock, Esc-to-close, backdrop-click, portal-to-body, `prefers-reduced-motion` (durations collapse to 0), RTL logical props, and token-only styling via `useFocusTrap` (`src/hooks/useFocusTrap.ts`). **This is the foundation — do not hand-roll a dialog.**
- **Z-index scale**: `src/constants/zIndex.ts`. `ModalOverlay` uses `Z_INDEX.modal` (1100). Coach-marks must sit on `Z_INDEX.overlay` (1000) so they never cover the welcome sheet.
- **Persistence pattern**: plain `localStorage` string flags read lazily in `useState` initializers (e.g. `App.tsx:186`), guarded writes in try/catch.
- **No existing** coachmark/hint/tour/`hasSeen` system, and **no tour library** in `package.json`.

## Recommendation: hand-rolled, NOT driver.js

**Do not add driver.js or any tour library.** It duplicates ModalOverlay + useFocusTrap, is not RTL-first, not token-aware, and adds bundle weight the audit already flags. The welcome sheet is just `<Sheet>` with paged content; coach-marks are ~120 lines.

**Chosen pattern (three lightweight layers):**
1. **(a) One-time welcome sheet** — 4 paged steps on first launch, built on `<Sheet>`. Primary teaching surface. Skippable, persists "seen".
2. **(b) Contextual coach-mark hints** — one dismissible hint chip per key screen (dashboard CTA, active-workout empty state, nutrition) on first visit. Each tracked by its own flag.
3. **(c) Re-launch entry** in Settings ("הצג הדרכה מחדש") that clears flags and reopens the welcome sheet.

## State & persistence design

**New file: `src/services/guidanceService.ts`**
```ts
const KEYS = {
  welcomeSeen: 'guidance_welcome_seen_v1',
  hintDashboard: 'guidance_hint_dashboard_v1',
  hintWorkout: 'guidance_hint_workout_v1',
  hintNutrition: 'guidance_hint_nutrition_v1',
} as const;
```
Exports: `hasSeenWelcome()`, `markWelcomeSeen()`, `resetGuidance()`, `isHintDismissed(key)`, `dismissHint(key)`. All reads return `false` on localStorage throw, writes in try/catch. `_v1` suffix allows future re-show via `_v2`.

**New file: `src/contexts/GuidanceContext.tsx`** — mirrors `SettingsContext` shape (createContext + provider + `useGuidance` hook that throws if unused). State: `isWelcomeOpen`, `openWelcome()`, `closeWelcomeAndMark()`, `relaunchGuidance()`. On mount: `useState(() => !hasSeenWelcome())` to auto-open once.

## New files (exact paths)

1. `src/services/guidanceService.ts` — flag persistence.
2. `src/contexts/GuidanceContext.tsx` — provider + `useGuidance` hook.
3. `src/components/guidance/WelcomeGuideSheet.tsx` — 4-step paged welcome sheet (built on `<Sheet>`).
4. `src/components/guidance/guidanceSteps.tsx` — step content data (icon + title + body + Hebrew copy). Lucide icons only.
5. `src/components/guidance/CoachMark.tsx` — reusable dismissible hint chip (token-only, RTL, `aria-live`, Esc/✕ dismiss, `Z_INDEX.overlay`).
6. `src/pages/settings/sections/GuidanceSection.tsx` — Settings re-launch row.

## Touchpoints in existing files

1. **`src/App.tsx`** — wrap shell tree with `GuidanceProvider` around the `<DataProvider><CoachProvider>` block (~line 569); render `<WelcomeGuideSheet />` near `<ToastContainer />` (~line 580). Line numbers may shift after fix-wave-1 — locate by structure.
2. **`src/pages/Dashboard.tsx`** — `<CoachMark>` rendered as a chip directly beneath the primary "התחל אימון" CTA (~line 289), gated by `hintDashboard`.
3. **`src/components/workout/states/EmptyWorkoutState.tsx`** — one coach-mark line about slide-to-complete + rest timer beneath subtitle (~line 99), gated by `hintWorkout`.
4. **`src/pages/Nutrition.tsx`** — `<CoachMark>` as first child of scroll body (implementer: open the file to pin the exact anchor), gated by `hintNutrition`.
5. **`src/pages/Settings.tsx`** — add `<GuidanceSection />` after `<ThemeSection />` (~line 98). Button calls `useGuidance().relaunchGuidance()`.

## Hebrew copy (final draft)

Sheet title: **"איך להשתמש באפליקציה"**

- **Step 1** (icon `Dumbbell`) — title **"ברוכים הבאים"** — body **"כאן תנהלו את האימונים, התזונה וההתקדמות שלכם — הכול במקום אחד. ננווט בקצרה על מה שאפשר לעשות."**
- **Step 2** (icon `Dumbbell`) — title **"להתחיל אימון"** — body **"לחצו על 'התחל אימון', בחרו תרגילים והזינו משקל וחזרות. לסיום סט החליקו את הכפתור — ואז יופעל טיימר מנוחה אוטומטי. בסיום האימון לחצו 'סיים'."**
- **Step 3** (icon `UtensilsCrossed`) — title **"תזונה ומים"** — body **"בעמוד התזונה תתעדו ארוחות ותעקבו אחרי קלוריות ומאקרו. מתחת לכך אפשר לעדכן כמה מים שתיתם במהלך היום."**
- **Step 4** (icon `TrendingUp`) — title **"מעקב והתאמה אישית"** — body **"בעמוד 'התקדמות' תראו גרפים, נפח ושיאים אישיים, ותעדכנו את משקל הגוף. דרך 'עוד' אפשר להתחבר למאמן עם קוד הזמנה, וכל ההגדרות נמצאות שם גם כן."**

Buttons: Skip (ghost, every step) **"דילוג"** · Back (2–4) **"חזרה"** · Next (1–3) **"הבא"** · Finish (4) **"סיום"**. Step dots `aria-label="שלב N מתוך 4"`. Step counter wrapped `dir="ltr"`.

Coach-marks:
- Dashboard: **"מתחילים מכאן — בחרו תרגילים והאפליקציה תנחה אתכם דרך הסטים."** Dismiss: visible **"הבנתי"**, `aria-label="הבנתי, סגירה"`.
- Active-workout: **"בסיום כל סט החליקו את הכפתור והמנוחה תתחיל אוטומטית."**
- Nutrition: **"תעדו כאן ארוחות ומים — הנתונים מתעדכנים מיד בסיכום היומי."**

Settings: section **"הדרכה"**, row **"הצגת ההדרכה מחדש"**, button **"הצג"** (or `HelpCircle` icon with `aria-label="הצג הדרכה מחדש"`).

Copy note: verify register against `OnboardingFlow` copy — if the app standard is singular imperative, switch "לחצו"→"לחץ" etc. consistently.

## A11y / design compliance

- Tokens only (`var(--fs-*)`); both themes verified; focus trap/Esc/restore free from `ModalOverlay`.
- Coach-mark is NON-modal: no trap; `focus-visible` ring on dismiss; Esc-to-dismiss while focused; entrance respects `useReducedMotion()` (`src/hooks/useReducedMotion.ts`).
- Lucide only: `Dumbbell`, `UtensilsCrossed`, `TrendingUp`, `HelpCircle`, `X`.
- Containers ≤ 2 nesting; no `.fs-accent-rail` on chips; one label per intent.

## Build order

1. `guidanceService.ts` (+ unit test) → 2. `GuidanceContext.tsx` → 3. `guidanceSteps.tsx` → 4. `WelcomeGuideSheet.tsx` → 5. wire `App.tsx` → 6. `CoachMark.tsx` → 7. placements (Dashboard / EmptyWorkoutState / Nutrition) → 8. `GuidanceSection.tsx` + wire Settings → 9. a11y/theme pass.

Agent split if two: Agent A = 1–5 (sheet path), Agent B = 6–8 (coach-marks + settings). Frozen shared contract: `guidanceService.ts` keys + `useGuidance()` API.

## Risks / notes

- Welcome sheet mounts inside `AppShell` which renders only after `onboardingDone` — ordering correct by construction.
- Guests: localStorage per-device "seen" works identically. No auth coupling.
- Nutrition anchor unverified — implementer must open `src/pages/Nutrition.tsx` first.

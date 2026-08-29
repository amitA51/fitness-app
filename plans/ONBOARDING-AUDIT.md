# Onboarding audit — read-only map

**Scope:** the first 60 seconds of SparkOS for a brand-new user, from cold launch to a first
logged set. Read-only: nothing outside this file was modified, no gate was run, no server was
started, no git command was issued.

**Date:** 2026-08-29

---

## 0. Method, and what is verified vs inferred

Everything below was derived by reading source and by tracing every field name across `src/`
with grep. No browser, no build, no test run — so nothing here rests on observed runtime
behaviour. Two audit documents in this repo were previously found to carry wrong figures, so
each claim is tagged:

- **VERIFIED (code)** — I read the producer and every consumer, and the chain closes in source.
  A "no consumer" claim means: I grepped the field name and every storage key it lands in across
  all of `src/`, and the only hits were the write site, the type declaration, and tests.
- **INFERRED** — follows from the code but depends on runtime/browser behaviour I did not execute.
- **UNVERIFIED** — I could not settle it without running the app. Marked as such, not guessed.

Searches used to establish "unread": the field name itself, plus the localStorage keys
`onboarding_data`, `user_profile`, `workout_prefs`, `appSettings`, and the sessionStorage keys
`onboarding_step`, `onboarding_draft`. The only readers of `onboarding_data` anywhere in the
codebase are `src/services/intelligence/profile.ts:97-101` and the hydration effect at
`src/AppRouter.tsx:208-245`. That is the whole surface, which is what makes the dead-field
findings below checkable rather than rhetorical.

The starting hint in the brief was accurate: the flow is `src/pages/OnboardingFlow.tsx` +
`src/pages/onboarding/**` + `src/appOnboarding.ts`, and `role` does survive on the data type
(`src/pages/onboarding/types.ts:31`) with no step behind it.

---

## 1. The steps, in order

Step list: `src/pages/onboarding/types.ts:72-78`. One flat list for every user, no branching
(confirmed by `src/pages/onboarding/useOnboardingWizard.ts:28` and asserted in
`src/pages/onboarding/__tests__/onboardingFlow.logic.test.ts:35-42`).

The wizard is entered from `src/AppRouter.tsx:308-314` — after auth, before the age and consent
gates.

| # | id | File | What it asks | To get past it | Skippable |
|---|----|------|--------------|----------------|-----------|
| 0 | `welcome` | `src/pages/onboarding/steps/WelcomeStep.tsx:127-135` | Nothing. Brand promise + one proof point ("שיא אישי חדש מזוהה אוטומטית") | Tap **בואו נתחיל** | No skip button here (`src/pages/OnboardingFlow.tsx:108`), but nothing is collected |
| 1 | `profile` | `src/pages/onboarding/steps/ProfileStep.tsx:40-160` | שם, מגדר, גיל (required); גובה, משקל (optional); health disclaimer | Name non-empty + gender chosen + age 10–100; height/weight must be sane *if* entered (`useOnboardingWizard.ts:69-81`) | Yes — **דלגו** (`OnboardingFlow.tsx:109-127`) |
| 2 | `goals` | `src/pages/onboarding/steps/GoalsStep.tsx:13-45` | One of 5 primary goals | Pick one (`useOnboardingWizard.ts:82-83`) | Yes — דלגו |
| 3 | `equipment` | `src/pages/OnboardingFlow.tsx:262-490` | Three things on one screen: רמת ניסיון (3), ציוד (4 cards), ימי אימון בשבוע (1–7) | **Only equipment is gated** (`useOnboardingWizard.ts:86-89`). Experience and days can be left untouched | Yes — דלגו |
| 4 | `complete` | `src/pages/onboarding/steps/CompleteStep.tsx:64-215` | Nothing. Recap + two CTAs | Tap either CTA (`CompleteStep.tsx:195-212`) | N/A |

Two notes on the step chrome:

- The advance button reads **סיום** on step 3 (`OnboardingFlow.tsx:60,196`) but one more screen
  follows it. VERIFIED (code).
- `STEPS[].title` and `STEPS[].subtitle` (`types.ts:73-77`) are **never rendered**. Only `.id` is
  read (`useOnboardingWizard.ts:33`); each step component hardcodes its own header. So
  `'הכר את עצמך'` / `'ספר לנו על עצמך'` / `'מה המטרות שלך?'` are dead strings — and they carry the
  wrong register (see §7). VERIFIED (code).

### What is genuinely well built here

Worth stating, because an audit that only lists faults is not a map:

- **The disabled-button block is explained.** `validationHint()` returns a per-step Hebrew reason,
  rendered in an `aria-live="polite"` region above the CTA and wired via `aria-describedby`
  (`OnboardingFlow.tsx:59,148-183`). Most wizards just grey the button out.
- **Range gates are real, not decorative.** Age 10–100, height 100–250, weight 30–300 are enforced
  both at the advance gate (`useOnboardingWizard.ts:76-80`) and inline under the offending field
  (`ProfileStep.tsx:16-27`). The code comment says decorative `min`/`max` used to let age 5 through.
- **Number inputs do not fight the user.** `MobileInput` keeps a raw draft so `"1."` and empty
  states are not clobbered mid-typing (`MobileInput.tsx:41-66`).
- **Text inputs are properly labelled.** `Input` owns `htmlFor`/`id`, `aria-invalid`,
  `aria-describedby` and the error id (`src/components/ui/Input.tsx:42,63-64,81-83,136`).
- **RTL direction is handled deliberately, not accidentally.** Forward is `ChevronLeft`, back is
  `ChevronRight`, with the reasoning written down (`OnboardingFlow.tsx:16-18,175,197`); the step
  slide reverses on back (`direction`, `useOnboardingWizard.ts:16`); and the progress dots are
  explicitly forced to `direction: ltr` so they fill step-1→N rather than reading backwards
  (`ProgressDots.tsx:15-17`).
- **The progress indicator is announced correctly** — `role="progressbar"` with a Hebrew
  "שלב N מתוך M" label, and the redundant second progress bar was already removed
  (`ProgressDots.tsx:18-23`, `OnboardingFlow.tsx:101-104`).
- **Skipping does not throw away typed data.** `savePartialOnboardingData` writes only filled
  fields and merges onto any existing profile (`appOnboarding.ts:107-142`).

---

## 2. Every field collected, classified

`OnboardingData` is declared at `src/pages/onboarding/types.ts:8-32` (18 fields). Only **8** are
ever presented to the user. The other 10 exist only as defaults.

### USED — a feature genuinely reads it

| Field | Asked at | Consumer chain (VERIFIED) |
|---|---|---|
| `name` | `ProfileStep.tsx:46-51` | `appOnboarding.ts:75` → `user_profile.name` → dashboard greeting `src/components/dashboard/DashboardHeader.tsx:17-20`; also the completion headline `CompleteStep.tsx:123` |
| `age` | `ProfileStep.tsx:106-115` | `user_profile.age` → `calculateBMR` `src/utils/tdee.ts:36-56` via `computeMacrosFromProfile` `src/services/settingsService.ts:23-31`, called from the nutrition goal auto-calc `src/pages/nutrition/components/GoalsEditor.tsx:125-138`. Also `profile.ts:57` → `describeProfile` → AI prompt `src/services/ai/contextBuilder.ts:79` |
| `weight` | `ProfileStep.tsx:131-140` | Same TDEE path, **plus** the strongest consumer in the app: `readAthleteProfile().weightKg` feeds `estimateCaloriesBurned` on every workout save (`src/components/workout/components/WorkoutActions.tsx:293-299`) |
| `height` | `ProfileStep.tsx:117-126` | TDEE path, **plus** BMI on the progress page (`src/pages/Progress.tsx:105-125`) |
| `gender` | `ProfileStep.tsx:56-99` | `user_profile.gender` → the sex term in Mifflin-St Jeor (`tdee.ts:55`) |
| `primaryGoal` | `GoalsStep.tsx:13-45` | Mapped to Hebrew `weightGoal` (`appOnboarding.ts:39-49,80`) → macro target `tdee.ts:27-31`; and `profile.ts:66-73` → `weightDirection` → goal-aware nutrition adherence `contextBuilder.ts:283-289`; and `describeProfile` |
| `experienceLevel` | `OnboardingFlow.tsx:299-330` | Mapped to Hebrew `activityLevel` (`appOnboarding.ts:51-62,81`) → TDEE activity multiplier `tdee.ts:20-26`; and `describeProfile`. **But it is not gated — see the finding below.** |

### STORED-BUT-UNREAD

**`equipment`** — asked with four full-width descriptive cards, the visual centrepiece of step 3
(`OnboardingFlow.tsx:235-260,340-420`). It is read exactly once, at `profile.ts:74`, into
`AthleteProfile.equipment`. From there:

- `describeProfile` (`profile.ts:104-125`) builds the Hebrew line that reaches the AI prompt and
  **omits equipment entirely** — it emits only age, weight, experience, goal.
- No exercise filter, template filter, or program generator references it. The `equipment` field on
  exercises (`src/data/exercises/*.ts`) is a *different* vocabulary (`barbell`/`dumbbell`/`machine`)
  and is never compared against the onboarding value.
- Its only behavioural effect: it is one of seven fields counted in `completeness`
  (`profile.ts:76-88`), which surfaces as a single "פרופיל חלקי" gap flag at `contextBuilder.ts:125`.

So a four-card question about where the user trains buys one presence bit and changes not a single
recommended exercise. VERIFIED (code).

**`preferredWorkoutDays`** — asked with a 7-option scroller plus a live summary line
(`OnboardingFlow.tsx:434-486`). Written into `onboarding_data`. The only place it is read is its own
recap card on the very next screen (`CompleteStep.tsx:166-173`). No schedule, no reminder, no
program, no split selection reads it. VERIFIED (code).

**`restBetweenSets`** — never asked; constant `90` (`types.ts:41`). Written to
`workout_prefs.defaultRestTime` (`appOnboarding.ts:85-93`, and again in the recovery hydration at
`AppRouter.tsx:237-243`). That write does not reach the rest timer: the live value comes from
`SettingsContext`, which loads the separate `appSettings` key (`SettingsContext.tsx:22,113-129`),
and the settings screen actively overwrites the loaded `workout_prefs.defaultRestTime` with the
context value on mount (`src/pages/settings/hooks/useSettingsState.ts:80-88`). The written value
happens to equal the context default, so nothing is visibly wrong — but the write is inert.
VERIFIED (code).

**`role`** — no step sets it; default `''` (`types.ts:51`). Read once, at `AppRouter.tsx:253`:
`trackFunnel('onboarding_completed', { role: data.role ?? 'trainee' })`. `??` does not catch the
empty-string sentinel, so **every** activation event reports `role: ""` rather than `"trainee"`.
The comment above it says the role is "reported only", which is true — it is just reported wrong.
VERIFIED (code).

### DEAD — declared, never collected, never read

All of these appear only in `types.ts` (declaration + default) and nowhere else in `src/`:

| Field | Line | Note |
|---|---|---|
| `workoutDuration` | `types.ts:17` | Never asked. **But it is displayed as a settled fact**: the recap card "משך כל אימון — 60 דקות" (`CompleteStep.tsx:179-186`) presents the hardcoded default as if the user had chosen it. Same class of arranged number the brief warns about. |
| `preferredTime` | `types.ts:18` | |
| `preferCompound` | `types.ts:20` | |
| `includeCardio` | `types.ts:21` | |
| `trackNutrition` | `types.ts:22` | |
| `dailyCalorieGoal` | `types.ts:23` | |
| `unitSystem` | `types.ts:26` | Shadows the real one: the app's actual unit system is `AppSettings.unitSystem` off `appSettings` (`SettingsContext.tsx:81`). The onboarding copy is never read. |

**Score: of 8 questions put to a new user, 6 feed something real, 2 (equipment, days/week) feed
nothing.** Of 18 declared fields, 7 are dead weight on the type.

---

## 3. Shortest honest path to a first logged workout

Counted from cold launch. Guest path, because it is the shortest one the app offers.

| # | Action | Anchor |
|---|---|---|
| 1 | Tap **המשיכו כאורח** | `src/pages/login/steps/ChoiceStep.tsx:214-227` |
| 2 | Tap **בואו נתחיל** (welcome) | `WelcomeStep.tsx:127` |
| 3 | Type **name** | `ProfileStep.tsx:46-51` |
| 4 | Tap a **gender** | `ProfileStep.tsx:70-97` |
| 5 | Type **age** | `ProfileStep.tsx:106-115` |
| 6 | Tap **הבא** | `OnboardingFlow.tsx:187` |
| 7 | Tap a **goal** | `GoalsStep.tsx:64` |
| 8 | Tap **הבא** | |
| 9 | Tap an **equipment card** | `OnboardingFlow.tsx:351-355` |
| 10 | Tap **סיום** | |
| 11 | Tap a completion CTA | `CompleteStep.tsx:195-212` |
| 12 | Dismiss the welcome guide sheet, which auto-opens on first home mount | `src/contexts/GuidanceContext.tsx:26-27`, `src/components/guidance/WelcomeGuideSheet.tsx` (3 paged steps, or one close) |
| 13 | Tap **בחרו תבנית מוכנה** in FirstRunHero | `src/pages/Dashboard.tsx:320,466-471` |
| 14 | Tap **התחל אימון** on a template | `src/pages/templates/hooks/useTemplates.ts:200-202` |
| 15-16 | Type **weight**, type **reps** | workout screen |
| 17 | Mark the set done | |
| 18 | Tap **סיים אימון** | `src/components/workout/components/WorkoutHeader.tsx:339` |
| 19 | Confirm in the finish overlay | `src/components/workout/overlays/ConfirmExitOverlay.tsx:175` |

**≈ 15 taps + 4 typed values, guest path.** VERIFIED for steps 1-14 (each anchored above);
steps 15-19 are INFERRED at tap granularity — the finish and confirm controls are anchored, the
per-set interaction was not opened in depth as it is outside this audit's scope.

**Signed-up path adds** (all AFTER onboarding, `AppRouter.tsx:316-327`): email + password + submit,
then a date-of-birth gate (`src/components/consent/AgeGate.tsx:151-300`), then two consent
checkboxes + submit (`src/components/consent/ConsentGate.tsx:33-50,128-160`).
**≈ 21 taps + 7 typed values.** Guests skip both gates — `AgeGateContext.tsx:38-43` and
`ConsentContext.tsx:60-73` both fail open for non-authenticated status. VERIFIED (code).

### Which of these the app genuinely cannot work without

**None of the onboarding fields.** The workout logger reads no profile field to start, log, or save
a session. The single per-workout consumer is `weightKg` for the calorie estimate
(`WorkoutActions.tsx:293-299`), and it accepts `null` — `readAthleteProfile()` returns nulls for
everything on an empty profile (`profile.ts:93-96`).

Defensible as pre-workout questions: **weight** (used on every save), and **goal + experience**
(they change nutrition targets and the AI's framing). **name** earns its keep cheaply — it powers
the greeting the user sees every single day. **age/height/gender** only matter once the user opens
nutrition or BMI; **equipment** and **days/week** buy nothing today.

---

## 4. Where a user can be lost

Ordered worst first.

**a) The hint tells the user to enter an age that is visibly already on screen.**
`MobileInput` keeps the typed value in local state and only commits to the wizard on **blur**
(`MobileInput.tsx:41,60-64`), while the gate reads `data.age` (`useOnboardingWizard.ts:72`). So
with `30` sitting in the field and the cursor still in it, **הבא** stays disabled and the live
region keeps saying "הזינו את גילכם כדי להמשיך". VERIFIED (code) for the contradiction.
Whether the user must then tap twice — once to blur, once to advance — depends on whether a
pointer-down on a `disabled` button blurs the focused input in the target browsers.
**UNVERIFIED**; it needs a real device to settle, and it is the single highest-value thing to
check next because it sits on the only required typed field in the flow.

**b) Experience level looks required and is not — and its absence is written down as a fact.**
Step 3 gates on `equipment` only (`useOnboardingWizard.ts:86-89`). Leave "רמת ניסיון" untouched and
you still pass. Then `saveOnboardingData` unconditionally writes
`activityLevel: getActivityLevelFromOnboarding('')`, whose `default` branch returns
**`'פעיל מתון'`** (`appOnboarding.ts:51-62,81`) — moderately active, multiplier 1.55
(`tdee.ts:20-26`). A user who answered nothing is recorded as moderately active and gets calorie
targets built on that assumption, with no indication anywhere that it was assumed. VERIFIED (code).
Note the skip path is honest about this (`appOnboarding.ts:120-122` writes it only when filled) —
it is the *complete* path that fabricates.

**c) The completion screen's two CTAs make different promises and do the same thing.**
"בואו נתחיל — אימון ראשון" calls `handleFinish(true)`, which seeds the path from
`postOnboardingDestination(data)` — and that function returns the constant `'/'`
(`appOnboarding.ts:11,20-22`, asserted in `onboardingFlow.logic.test.ts:17-23`). The quiet
"כניסה למסך הבית" calls `handleFinish(false)` and lands on the same home. For a normal cold
launch the two buttons are indistinguishable in outcome; the button that says "first workout"
delivers the home screen. VERIFIED (code). The home screen does then guide toward a workout
(FirstRunHero), so this is a copy-vs-behaviour mismatch, not a dead end.

**d) Skipping is a one-way door, and its promise is only two-thirds true.**
The dialog says "אפשר להשלים זאת בהגדרות מאוחר יותר" (`OnboardingFlow.tsx:208`). Skip sets
`onboarding_completed = 'true'` (`AppRouter.tsx:258-264`), and nothing in `src/` ever clears or
re-enters it — the only removal is the account-scoped wipe on sign-out/account switch
(`src/services/userScopedLocalData.ts:20-21`). Settings can complete name/age/height/weight/gender/
weightGoal/activityLevel (`src/pages/settings/sections/ProfileSection.tsx:54-145`) but has **no
control for `equipment`, `experienceLevel`, or the `primaryGoal` enum**. A skipper's AI profile
completeness is therefore permanently capped, with no path to fix it. VERIFIED (code).

**e) Age is asked twice, in two different shapes, and the second one can lock the account.**
Onboarding requires `גיל` as a number (`ProfileStep.tsx:106-115`). Immediately after finishing, an
authenticated user hits a date-of-birth gate (`AgeGate.tsx:151-300`) that blocks the app if the
computed age is under the minimum. The order is also backwards from a consent standpoint: the app
collects name, gender, age, height and bodyweight *before* asking for terms and privacy consent
(`AppRouter.tsx:308-327`). VERIFIED (code). The under-age screen does have escape hatches (guest
mode, sign-out) and the comment says a mistyped year used to brick the account — so that specific
trap is already fixed.

**f) A restored session can complete the wizard with an empty profile.**
`currentStep` and the draft are restored from two separate sessionStorage keys
(`useOnboardingWizard.ts:5-25`). If the draft parse throws, the `catch` returns
`DEFAULT_ONBOARDING` while the step index still restores to 3. `goNext` only validates the
*current* step (`useOnboardingWizard.ts:48-56`), so the user advances straight to complete and
`saveOnboardingData` writes `age: ''`, `height: ''`, `weight: ''` into `user_profile`
(`appOnboarding.ts:72-83`). There is no final all-steps check. VERIFIED (code) as reachable in
principle; how often the parse actually fails is UNVERIFIED. Downstream mostly survives it —
`Progress.tsx:110-119` coerces a string height and refuses to show BMI outside 100-250, and
`calculateBMR` guards non-finite input (`tdee.ts:43-56`) — but `GoalsEditor.tsx:126-130` silently
substitutes **weight 70 / height 175 / age 25** and presents the resulting macros as the user's own.

**g) Two selectors on step 3 are invisible to a screen reader.**
Equipment cards carry `aria-pressed` (`OnboardingFlow.tsx:356`) and gender buttons do too
(`ProfileStep.tsx:79`), but the experience-level buttons (`OnboardingFlow.tsx:311-330`) and the
days-per-week buttons (`OnboardingFlow.tsx:446-470`) carry neither `aria-pressed` nor any group
association — their headings "רמת ניסיון" / "כמה ימי אימון בשבוע?" are plain `<span>`s
(`OnboardingFlow.tsx:293-299,436-442`) with no `role="group"` / `aria-labelledby`. A screen-reader
user hears "מתחיל / בינוני / מנוסה" and "1 2 3 4 5 6 7" with no context and no selected state.
VERIFIED (code); the lived severity on NVDA/VoiceOver in Hebrew is UNVERIFIED.

**h) Measurements a beginner may not know.** Height in cm and bodyweight in kg are asked on the
second screen, before any value has been delivered. Both are optional and the disclaimer explains
what the numbers are for (`ProfileStep.tsx:145-160`), which is the right instinct. Nothing explains
why **gender** is required — it is the only required field with no stated purpose, and its real
purpose (a ±166 kcal term in the BMR formula, `tdee.ts:55`) is not something a user would guess.

**i) No drop-off telemetry inside the flow.** `FUNNEL_EVENTS`
(`src/services/analytics/funnel.ts:27-40`) contains `onboarding_completed` and no per-step event.
For the flow whose whole business case is activation, there is no way to know which screen loses
people. VERIFIED (code).

---

## 5. What happens to someone who quits halfway

**Progress is held in sessionStorage, not localStorage** (`useOnboardingWizard.ts:35-42`), so:

- **Backgrounds the app / navigates within the same tab** → resumes at the same step with the same
  data (`useOnboardingWizard.ts:5-25`). A stale index from an older, longer step list is clamped so
  it cannot point past the end (`useOnboardingWizard.ts:32`) — a defect someone already fixed.
- **Closes the tab or fully closes the PWA** → sessionStorage dies with it. **Restart from step 0,
  everything typed is gone.** Nothing is written to `onboarding_data` until finish or explicit skip
  (`appOnboarding.ts:64-65,109`), so a half-finished wizard leaves no trace at all.
- **Signs out or switches account** → both keys are cleared deliberately
  (`userScopedLocalData.ts:49`).
- **Taps דלגו** → partial data is preserved truthfully, empty sentinels are not written
  (`appOnboarding.ts:107-142`), and onboarding is marked done forever (see 4d).

VERIFIED (code). The asymmetry is the finding: an *explicit* quit preserves data, an *accidental*
one (close the tab) loses all of it — the opposite of what a user would expect.

---

## 6. Keep / cut / defer

### Steps

| Step | Verdict | Reasoning |
|---|---|---|
| `welcome` | **Keep** | One tap, no input, and it names a real mechanic instead of a vague benefit. Cheapest screen in the flow. |
| `profile` | **Keep, trimmed** | It holds the one field with a per-workout consumer (weight) and the one field seen daily (name). |
| `goals` | **Keep** | Single tap, and it genuinely branches nutrition targets and AI framing. |
| `equipment` | **Cut two of its three questions** | Only `equipment` is gated and only `equipment` is even read — and it is read as a presence bit. See per-field rows. |
| `complete` | **Keep, honest** | Good place to land, but its recap must stop showing values nobody chose, and its two CTAs must stop making different promises for identical behaviour. |

### Fields

| Field | Verdict | Reasoning |
|---|---|---|
| `name` | **Keep** | Read every day by the dashboard greeting; one cheap typed value. |
| `gender` | **Keep, explain** | Real ±166 kcal term in BMR; currently the only required field with no stated reason. |
| `age` | **Keep** — or **cut and derive** | Already collected a second time as DOB by the age gate right after. Asking twice is the defect, not asking once. |
| `height` | **Defer** | Only needed when the user opens nutrition or BMI. Ask it there, where the payoff is visible. |
| `weight` | **Keep** | The strongest consumer in the app: every workout save uses it for the calorie estimate. |
| `primaryGoal` | **Keep** | Drives macro direction and nutrition adherence. Earns its one tap. |
| `experienceLevel` | **Keep, but gate it** | It is read (TDEE multiplier, AI framing) yet optional, and skipping it silently records "פעיל מתון". Either require it or stop writing an assumed value. |
| `equipment` | **Defer** | Nothing filters on it. Ask it when the app can actually honour the answer — i.e. when template/exercise selection respects it. |
| `preferredWorkoutDays` | **Cut** | Asked with the flow's largest control; read only by its own recap card. |
| `restBetweenSets` | **Cut from the write path** | Never asked; the write to `workout_prefs` never reaches the timer. |
| `role` | **Cut** | No step behind it; its only read emits `""` instead of `"trainee"` into the activation event. |
| `workoutDuration` | **Cut, or ask it** | Never asked but displayed as a chosen value. Presenting a default as a user decision is the exact pattern this crew keeps getting caught by. |
| `preferredTime`, `preferCompound`, `includeCardio`, `trackNutrition`, `dailyCalorieGoal`, `unitSystem` | **Cut** | Dead on the type; `unitSystem` additionally shadows the real setting in `appSettings`. |
| `STEPS[].title` / `.subtitle` | **Cut** | Never rendered, and wrong register. |

---

## 7. Hebrew copy check

The documented standard is plural-imperative — "לחצו", "בחרו"
(`src/components/guidance/guidanceSteps.tsx:6`).

### Register breaks (singular where the standard is plural)

| String | Location | Note |
|---|---|---|
| `כתוב סטים. תראה התקדמות.` | `WelcomeStep.tsx:64` | Singular masculine imperative ×2. The comment at `WelcomeStep.tsx:49-50` says this deliberately matches the login masthead, so it is a considered brand line — but it is the first Hebrew a user reads and it contradicts the standard. Worth a deliberate decision, not a silent exception. |
| `קצת עליך` / `…להתאים את המערכת אליך` | `ProfileStep.tsx:40-41` | Should be `עליכם` / `אליכם`. |
| `מה המטרה שלך?` (title) vs `בחרו את המטרה העיקרית` (subtitle) | `GoalsStep.tsx:58` vs `:59` | Singular and plural **on the same screen, two lines apart**. The clearest instance in the flow. |
| `המטרה שלך` (recap label) | `CompleteStep.tsx:158` | Singular, while the headline two cards up is plural (`מוכנים לאימון!`, `:124`). |
| `ברוך הבא` / `הכר את עצמך` / `ספר לנו על עצמך` / `מה המטרות שלך?` | `types.ts:73-77` | All singular masculine — and all dead strings (never rendered). Fix or delete; do not leave them as a template for the next author. |

### Reads as translated English rather than native Hebrew

- `נזדקק למידע הבסיסי כדי להתאים את המערכת אליך` (`ProfileStep.tsx:41`) — "we will require the
  basic information" in Hebrew clothing. `נצטרך כמה פרטים כדי להתאים את התוכנית אליכם` is how a
  Hebrew speaker says it. Also "המערכת" is engineer-speak for a fitness app.
- `אפשר להשלים זאת בהגדרות מאוחר יותר` (`OnboardingFlow.tsx:208`) — `זאת` pointing at an abstract
  process is stiff; `תמיד אפשר להשלים את ההגדרה בהגדרות` is natural. Separately, this sentence is
  **partly false** (see 4d).
- `ניסיון, ציוד ותדירות — הכל במסך אחד` (`OnboardingFlow.tsx:283`) — describes the app's own
  refactor (three screens merged into one), not anything the user gains. Implementation detail as UX copy.

### Terminology inconsistencies across surfaces

- Onboarding labels the field **מגדר** (`ProfileStep.tsx:65`) while Settings labels the same field
  **מין** (`ProfileSection.tsx:119`). Pick one.
- The options under מגדר are `זכר / נקבה / אחר` (`ProfileStep.tsx:70-74`) — biological-sex terms
  under a gender label. If the purpose is the BMR sex term, say so; if it is gender, the options
  are wrong.
- `דאמבלים` (`OnboardingFlow.tsx:251`) is a transliteration; the app's own equipment glossary says
  `משקולת יד` (`src/constants/equipmentNames.ts:29`).

### Content notes, not register

- `כל יום! (ללא מנוחה)` (`OnboardingFlow.tsx:479`) — an exclamation mark endorsing 7 days a week,
  with a parenthetical that hints at a warning without being one.
- `מתאמן` badge (`CompleteStep.tsx:107`) — singular masculine, and it labels a role the user was
  never offered (the role step was deleted). Accurate, but it appears out of nowhere.
- **Good, native, keep as-is:** `רשמו כל אימון וצפו במשקלים, בנפח ובשיאים מטפסים עם הזמן.`
  (`WelcomeStep.tsx:82`), `שיא אישי חדש מזוהה אוטומטית בכל פעם שאתם משתפרים.`
  (`WelcomeStep.tsx:114`), the health disclaimer (`ProfileStep.tsx:157-159`), and
  `הפרופיל הוגדר. בשלב הבא תבחרו תבנית אימון ותתחילו — זה לוקח דקה.` (`CompleteStep.tsx:140`).
  All plural, concrete, and specific.

---

## 8. Not covered

- **No runtime verification of anything.** No browser, no 390px capture, no dark mode, no console
  check, no gate — per instruction. Every "the user sees X" statement is a reading of source.
- **The blur/disabled-button interaction (4a)** is the one finding I could not settle from code.
- **Overflow and truncation at 390px** with a long Hebrew name or a long goal description — not
  measurable without rendering.
- **The set-logging interaction itself** (steps 15-17 of §3) was not audited in depth; it is a
  different screen and outside this brief.
- **Server-side onboarding effects** (`profiles.role`, the age-gate RPC, consent records) were read
  only as far as the client calls them.
- **`src/components/workout/ActiveWorkoutNew.tsx:858`** — the known pre-existing typecheck error
  another worker owns. Not examined, not a finding here.

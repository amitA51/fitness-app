# Onboarding proposal — the first 60 seconds

**Input:** `plans/ONBOARDING-AUDIT.md` (412 lines, read in full).
**Scope:** a proposal. No code was written, no gate run, no server started, no git command issued.
**Date:** 2026-08-29

The governing fact from the audit: **nothing collected in onboarding is required to log a
workout.** The logger reads no profile field to start, log or save; the one per-workout consumer
(`weightKg`, for the calorie estimate) accepts null. Every question is therefore negotiable, and
the burden of proof sits on each question, not on the decision to cut it.

The commercial fact sets the direction: a user who does not reach three workouts in two weeks
churns at roughly 3-4x the rate of one who does. So onboarding should collect only what it can
**spend inside the first session**, and ask for the rest on the screen that needs it.

---

## 0. Spot-check — four figures in the audit need correcting

I re-read every producer and consumer I was about to build on. The audit holds up on every
load-bearing claim (equipment dead, activityLevel fabricated, no telemetry, skip promise false).
Four things were off, and two of them change a recommendation.

| Audit claim | Correction | Consequence |
|---|---|---|
| "Only **8** are ever presented to the user" and "of 8 questions … 6 feed something real, 2 feed nothing" (§2) | **9 fields are presented**: name, gender, age, height, weight, primaryGoal, experienceLevel, equipment, preferredWorkoutDays. **7 feed something real, 2 feed nothing.** The §2 score line is internally inconsistent — it excludes `preferredWorkoutDays` from the 8 (it is the only pre-filled field, default `3`) but then names it as one of "the 2". | Cosmetic. The 7 USED / 4 STORED-BUT-UNREAD / 7 DEAD split is correct and sums to 18. |
| `completeness` "surfaces as a **single** 'פרופיל חלקי' gap flag at `contextBuilder.ts:125`" (§2) | **Two consumers.** Also `coachBrief.ts:82` — `signals >= 3 && ds.profileCompleteness >= 0.5` is required to reach `'high'` confidence. | Load-bearing for §6. Bounded, though: `coachBrief.ts:80` returns `'low'` when `sessionCount < 3`, so completeness cannot affect a brand-new user's confidence at all. |
| The fabricated `activityLevel` is one write site (`appOnboarding.ts:81`) | **Four fabrication sites**, three for activity and one for gender: `appOnboarding.ts:81` (`getActivityLevelFromOnboarding('')` → `'פעיל מתון'`); `GoalsEditor.tsx:131` (`stored.activityLevel ?? 'פעיל מתון'`); `settings/types.ts:66` (`DEFAULT_PROFILE.activityLevel: 'פעיל מתון'`); `settings/types.ts:64` (`DEFAULT_PROFILE.gender: 'male'`). | Load-bearing for §3. "Store null" fails unless all four are addressed — the Settings screen would still *display* `פעיל מתון` as the user's choice. |
| Settings can complete fields in the "פרופיל" section (§4d) | The section is labelled **`פרטים אישיים`** (`ProfileSection.tsx:30`). "פרופיל" is a *different*, public-facing editor below it. | The skip promise must name `פרטים אישיים` or it points at the wrong card. |

Two further items found while checking, both small and both cuts:

- `useOnboardingWizard.ts:84-85` has a `case 'experience'` branch in `validationHint`. No step has
  id `'experience'`. Dead code from the merge that produced today's step 3.
- `UserProfile.gender`, `.weightGoal` and `.activityLevel` are **non-nullable unions with no unknown
  state** (`settings/types.ts:6-18`), while `.age`, `.height`, `.weight` all carry the `| ''`
  sentinel. `OnboardingData.gender` carries `''` too (`types.ts:10`). So the onboarding type can
  represent "not answered" and the settings type cannot. That asymmetry is why the defaults in §0
  above exist.

**Carried forward UNVERIFIED, not promoted:** number inputs commit on blur
(`MobileInput.tsx:41,60-64`) while the gate reads `data.age` (`useOnboardingWizard.ts:72`), so the
hint may keep saying `הזינו את גילכם` with `30` visibly in the field. I confirmed the code
contradiction; whether the user must tap twice depends on whether pointer-down on a `disabled`
button blurs the focused input in the target browsers. **Needs a real device.** My proposal removes
`age` — today's only *gated* typed field — which incidentally removes the one place this can bite
today. That is a side effect, **not a fix**: `weight` is still a blur-committing number field, so
the contradiction class returns the moment any number field is gated again.

---

## 1. The proposed flow

Three screens instead of five. Two questions that pay off in session 1, one that costs a single tap,
one optional. Register is plural-imperative throughout (`guidanceSteps.tsx:6`), logical properties
only, all targets ≥ 44px.

### Screen 0 — welcome (unchanged)

No collection. One tap. Keep the existing content: the brand line
`כתוב סטים. תראה התקדמות.`, the body `רשמו כל אימון וצפו במשקלים, בנפח ובשיאים מטפסים עם הזמן.`,
and the proof point `שיא אישי חדש מזוהה אוטומטית בכל פעם שאתם משתפרים.`

Button: **`בואו נתחיל`**

The brand line is singular-imperative and breaks the standard. I am **not** changing it — the
comment at `WelcomeStep.tsx:49-50` says it deliberately matches the login masthead. It needs a
ratified exception from whoever owns brand voice, not a silent flip by me.

### Screen 1 — `בואו נכיר`

Replaces today's `קצת עליך` / `נזדקק למידע הבסיסי כדי להתאים את המערכת אליך` (singular, and
"we will require the basic information" in Hebrew clothing).

- **Title:** `בואו נכיר`
- **Subtitle:** `שני פרטים, ואפשר להתחיל.`

| Field | Label | Placeholder / unit | Helper |
|---|---|---|---|
| name | `שם` | `איך לקרוא לכם?` | — |
| weight | `משקל נוכחי` | `—` · `ק"ג` | `לפי המשקל נחשב את הקלוריות בכל אימון.` |
| experienceLevel *(optional)* | `רמת ניסיון` | `מתחיל` / `בינוני` / `מנוסה` | `לא חובה — משפיע על ההמלצות בלבד.` |

Health disclaimer stays **verbatim** — the audit rates it native and it is correctly placed at the
point of body-data collection: `הנתונים משמשים לחישוב עומסי אימון ותזונה — האפליקציה אינה מהווה ייעוץ רפואי. עם מצב רפואי, היוועצו ברופא לפני פעילות גופנית.`

- **Gate:** name non-empty. Nothing else. Weight is prominent but ungated — the app works without
  it, and gating a body number on the first screen buys no functional guarantee.
- **Hint (unchanged, already plural):** `הזינו שם כדי להמשיך`
- **Button:** `הבא`
- **A11y I now own:** keeping the experience row means fixing it. It carries neither `aria-pressed`
  nor a group association today (`OnboardingFlow.tsx:311-330`, heading is a bare `<span>` at
  `:293-299`). It needs `aria-pressed` per button and `role="group"` + `aria-labelledby` pointing at
  a real heading element — matching what the gender and equipment buttons already do.

The three experience labels are singular masculine. If the team wants gender-neutral labels, the
cheapest route that maps 1:1 onto the existing enum is tenure: `עד שנה` → `beginner`,
`1–3 שנים` → `intermediate`, `מעל 3 שנים` → `advanced`. Offered, not imposed — it changes the
wording, not the stored value.

### Screen 2 — `מה המטרה שלכם?`

- **Title:** `מה המטרה שלכם?` — fixes the flow's clearest register break: today the title is
  `מה המטרה שלך?` (singular) and the subtitle `בחרו את המטרה העיקרית` (plural), two lines apart
  (`GoalsStep.tsx:58-59`).
- **Subtitle: deleted.** The title already asks the question. Deleting it removes the clash outright
  instead of patching one half of it.
- Five cards **unchanged** — `בניית כוח` / `בניית שריר` / `סיבולת` / `ירידה במשקל` / `כושר כללי`
  with their existing descriptions. All native noun phrases.
- **Auto-advance on tap.** No `הבא`. This is the terminal question and a card tap is unambiguous.

### Screen 3 — `complete`: **cut**

Three verified reasons, no compensating work required:

1. Its two CTAs make different promises and do the same thing. `postOnboardingDestination` returns
   the constant `'/'` (`appOnboarding.ts:11,20-22`), so `בואו נתחיל — אימון ראשון` delivers the
   home screen, exactly like `כניסה למסך הבית`.
2. Two of its three recap cards display values nobody chose: `משך כל אימון — 60 דקות`
   (`workoutDuration`, never asked) and `תדירות אימונים — 3 ימים בשבוע` (`preferredWorkoutDays`,
   default). Both cards render **unconditionally** (`CompleteStep.tsx:162-188`); only the goal card
   is conditional.
3. The closure it provides already exists on the destination. `DashboardHeader.tsx:17-20` greets by
   name from `user_profile.name`, and `FirstRunHero` (`Dashboard.tsx:320,466-471`) is the
   "what to do next" surface. Landing there delivers what the honest CTA would have promised.

The only real loss is the success haptic (`CompleteStep.tsx:46-50`). Cheap to re-fire on the
first-run hero if anyone misses it; not proposed here.

### Skip dialog — see §4.

### Count

Same span as the audit's §3: cold launch → first logged set, guest path (the shortest the app
offers).

| # | Action |
|---|---|
| 1 | Tap `המשיכו כאורח` |
| 2 | Tap `בואו נתחיל` |
| 3 | Type **name** |
| 4 | Type **weight** |
| 5 | Tap `הבא` |
| 6 | Tap a **goal** card → auto-advance ends onboarding, lands on home |
| 7 | Dismiss the welcome guide sheet *(see note)* |
| 8 | Tap `בחרו תבנית מוכנה` |
| 9 | Tap `התחל אימון` on a template |
| 10-11 | Type set **weight**, type **reps** |
| 12 | Mark the set done |
| 13 | Tap `סיים אימון` |
| 14 | Confirm in the finish overlay |

**19 → 14 numbered actions** (10 taps + 4 typed). Typed inputs stay at 4, but two of them change
identity: today they are name + age; here they are name + weight. `age` has no session-1 consumer;
`weight` is read on every workout save.

The five taps removed: gender (deferred), the equipment card (cut), `הבא` on goals (auto-advance),
`סיום` on step 3 and the completion CTA (screen cut).

**Note on action 7.** The welcome guide sheet auto-opens on first home mount
(`GuidanceContext.tsx:26-27`). Stopping the auto-open takes this to **13 actions**, but that is a
behaviour change outside onboarding, so I am flagging it rather than banking it. Both numbers are
stated so nobody has to trust the more flattering one.

Steps 9-14 inherit the audit's own INFERRED granularity for the set-logging interaction. I did not
re-derive them.

---

## 2. Keep / cut / defer — all 18 fields

`OnboardingData` (`types.ts:8-32`). **4 keep · 3 defer · 11 cut.**

| # | Field | Verdict | Reasoning |
|---|---|---|---|
| 1 | `name` | **Keep** | Rendered every day by the dashboard greeting (`DashboardHeader.tsx:17-20`); the flow's only gated field. |
| 2 | `weight` | **Keep** | Strongest consumer in the app — read on every workout save for the calorie estimate (`WorkoutActions.tsx:293-299`). Pays off in session 1. Ungated; it accepts null. |
| 3 | `primaryGoal` | **Keep** | One tap. Drives macro direction (`tdee.ts:27-31`), goal-aware nutrition adherence (`contextBuilder.ts:283-289`) and the AI's framing via `describeProfile`. |
| 4 | `experienceLevel` | **Keep, optional, never fabricated** | Genuinely read for `describeProfile`'s `ניסיון` line. One tap on a control that already exists. Un-gate it and stop writing a value when it is empty — see §3. |
| 5 | `gender` | **Defer** → Nutrition macro auto-calc (`GoalsEditor.handleAutoCalc`), editable in **Settings › פרטים אישיים** where the row already exists as `מין`. | Its only consumer is the ±166 kcal sex term in Mifflin-St Jeor (`tdee.ts:55`), which is only ever computed in Nutrition. Asked there the reason is self-evident; asked on screen 2 of onboarding it is the flow's only required field with no stated purpose. Deferring also resolves the `מגדר`/`מין` terminology split by leaving one label standing. |
| 6 | `age` | **Defer** → same two places (`גיל` row already exists in Settings › פרטים אישיים). | Consumed only by BMR (`tdee.ts:36-56`) and `describeProfile`. For signed-up users it is already collected a second time, as DOB, by the age gate seconds later (`AgeGate.tsx:151-300`) — asking twice is the defect. Guests get no DOB gate, which is why Nutrition is the real home. |
| 7 | `height` | **Defer** → Nutrition auto-calc, Progress BMI card, Settings › פרטים אישיים (`גובה` row exists). | Already optional today. The Progress side already handles absence correctly (BMI hidden, `Progress.tsx:104-121`); the Nutrition side must be brought to that standard — see §3. |
| 8 | `equipment` | **Cut** | Its *value* is never used: `describeProfile` omits it (`profile.ts:104-125`), no exercise or template filter reads it, and the exercise-level `equipment` vocabulary is a different one (`barbell`/`dumbbell`/`machine`). Entire effect is +1/7 on `completeness`. **Not deferred, because no screen today could honour the answer** — a deferred question with no home is a deleted question, so this is a deletion and I am calling it one. Re-ask it when equipment-aware filtering exists; building that is a separate decision. |
| 9 | `preferredWorkoutDays` | **Cut** | Asked with the flow's largest control; read only by its own recap card (`CompleteStep.tsx:166-173`), which is also being removed. No schedule, reminder, split or program reads it. |
| 10 | `restBetweenSets` | **Cut from the write path** | Never asked. The write to `workout_prefs.defaultRestTime` never reaches the timer — that reads `appSettings` via `SettingsContext` (`SettingsContext.tsx:22,113-129`), and the settings screen overwrites the loaded value on mount (`useSettingsState.ts:80-88`). |
| 11 | `role` | **Cut** | No step sets it. Its only read emits `""` rather than `"trainee"` into the activation event, because `??` does not catch the empty-string sentinel (`AppRouter.tsx:253`). Replace the payload with a literal — see §5. |
| 12 | `workoutDuration` | **Cut** | Never asked, yet displayed as a settled fact (`CompleteStep.tsx:179-186`). Cutting the recap removes the display; cutting the field removes the temptation to re-add it. |
| 13 | `preferredTime` | **Cut** | Declaration + default only, nowhere else in `src/`. |
| 14 | `preferCompound` | **Cut** | Same. |
| 15 | `includeCardio` | **Cut** | Same. |
| 16 | `trackNutrition` | **Cut** | Same. |
| 17 | `dailyCalorieGoal` | **Cut** | Same; nutrition targets come from the TDEE calc and the goals editor. |
| 18 | `unitSystem` | **Cut** | Shadows the real setting — the app's actual unit system is `AppSettings.unitSystem` off `appSettings` (`SettingsContext.tsx:81`). Two sources of truth for units is a bug waiting to be filed. |

Also cut, not fields: `STEPS[].title` / `.subtitle` (never rendered, wrong register,
`types.ts:73-77`) and the dead `case 'experience'` branch in `validationHint`.

---

## 3. The fabricated `activityLevel`

### Recommendation: store nothing, and make the consumer ask at the point of use.

This mirrors the precedent the app already set, in writing, for the same class of error. From
`Progress.tsx:104-110`:

> There is **NO** default: BMI and its category are a health claim, and a claim derived from an
> assumed height is worse than no claim — a wrong height flips the category label, not just a digit.

`activityLevel` is the same shape of claim. `'פעיל מתון'` is a 1.55 multiplier where a beginner's
is 1.375 (`tdee.ts:17-22`). For a 30-year-old, 80 kg, 175 cm male, BMR is 1749, so the fabrication
is **2711 vs 2405 kcal/day — a 306 kcal/day error**, roughly 2100 kcal a week. In a weight-loss
plan that is not a rounding error; it is the difference between a deficit and maintenance. Category,
not digit.

### One thing must change beyond "don't write the empty case"

The skill→activity derivation is itself a category error, independent of the empty case.
`getActivityLevelFromOnboarding` maps a **skill** self-report onto an **activity-volume**
multiplier: `advanced` → `'פעיל מאוד'` → 1.725. "I am experienced" does not mean "I burn 1.725× my
BMR" — an experienced lifter training once a week is not very active. So the fix is not to guard
the default branch; it is to **stop deriving `activityLevel` from `experienceLevel` at all**.

Settings already owns the correct construct: a direct `רמת פעילות` control over the real 5-value
scale (`ProfileSection.tsx:133-141`, `ACTIVITY_LEVEL_OPTIONS`). That is where the multiplier should
come from.

### What that means concretely — four sites, because "store null" fails otherwise

1. `appOnboarding.ts:81` — stop writing `activityLevel` from onboarding entirely. Note the honest
   version already exists eleven lines below, in `savePartialOnboardingData:120-122`, which writes
   it only when filled. The *skip* path is already truthful; only the *complete* path fabricates.
2. `GoalsEditor.tsx:126-131` — stop substituting. Today `handleAutoCalc` silently supplies
   **weight 70, height 175, age 25, gender male, activityLevel `'פעיל מתון'`, weightGoal
   `'שמירה על משקל'`** and presents the result as the user's own macros. Six defaults, one button.
   Replace with an inline ask in the existing editor (copy below) and refuse to produce a number
   until the inputs exist.
3. `settings/types.ts:66` — `DEFAULT_PROFILE.activityLevel: 'פעיל מתון'`. Without this, the
   Settings screen displays `פעיל מתון` as the user's selection even after (1) and (2) are fixed.
4. `settings/types.ts:64` — `DEFAULT_PROFILE.gender: 'male'`, same problem for the ±166 kcal term.

Cost, named honestly: `UserProfile.gender` and `.activityLevel` are non-nullable unions
(`settings/types.ts:6-18`), so they must widen to carry an unknown state. The codebase already uses
`| ''` for exactly this on `.age`/`.height`/`.weight`, and `OnboardingData.gender` already carries
it — so this follows existing convention rather than introducing one. Touch points: the two type
declarations, `DEFAULT_PROFILE`, the `ACTIVITY_MAP` lookup in `tdee.ts:17-22`, and the two
`SettingsSelect` call sites.

### Nutrition point-of-use copy (the deferred home)

Inline in the existing `GoalsEditor`, shown when the auto-calc is tapped and inputs are missing:

- Heading: `נשלים כמה פרטים`
- Body: `לחישוב יעד קלוריות נדרשים גיל, גובה, מין ורמת פעילות. בלי אלה לא נציג יעד — עדיף בלי מספר מאשר מספר לא נכון.`
- Fields: `גיל` (`שנים`) · `גובה` (`ס"מ`) · `מין` (`זכר` / `נקבה` / `אחר`) · `רמת פעילות` (the existing 5 options)
- Primary: `חשבו יעד`
- Secondary: `הזנה ידנית`

### Why not the alternatives

- **Ask it honestly in onboarding.** Costs a required tap in the 60 seconds we are shortening, and
  the answer is a self-report users are demonstrably bad at. It also puts a nutrition question in
  front of a user who has not logged a set.
- **Derive it from logged behaviour.** The right long-term answer, and the only one that would be
  *accurate*. It needs 2-3 weeks of sessions and a derivation nobody has built. That is the "build
  the consumer" decision, and it is not mine to assume.

---

## 4. The skip path, made honest

Today the dialog promises `אפשר להשלים זאת בהגדרות מאוחר יותר` (`OnboardingFlow.tsx:208`) and skip
sets `onboarding_completed = 'true'` permanently — nothing in `src/` ever clears it outside the
account-scoped wipe (`userScopedLocalData.ts:20-21`). The promise is two-thirds false: Settings has
no control for `equipment`, `experienceLevel` or the `primaryGoal` enum.

**Make the promise true.** After §2, onboarding asks four things, and three already have a home:

| Field | Home | Status |
|---|---|---|
| `name` | Settings › פרטים אישיים → `שם` | exists |
| `weight` | Settings › פרטים אישיים → `משקל` | exists |
| `experienceLevel` | Settings › פרטים אישיים → `רמת פעילות` | **partial** |
| `primaryGoal` | Settings › פרטים אישיים | **missing** |
| `equipment` | — | cut, so no promise is owed |

Two named additions close the gap:

- **`primaryGoal`** — add a `מטרה עיקרית` row to Settings › פרטים אישיים with the same five options,
  writing `onboarding_data.primaryGoal`. The existing `מטרת משקל` row is the *mapped* 3-value
  `weightGoal`, so the 5-value enum the AI reads (`strength`/`muscle`/`endurance`/`general`) cannot
  be recovered from it today.
- **`experienceLevel`** — Settings edits the mapped `activityLevel`, not `experienceLevel`, so
  `describeProfile`'s `ניסיון` line and the completeness count stay empty for a skipper. Since §3
  breaks the skill→activity mapping anyway, add `רמת ניסיון` as its own row rather than trying to
  reverse-derive it. **Do not reverse-derive**: `DEFAULT_PROFILE.activityLevel` is `'פעיל מתון'`, so
  a derivation would read the default back as a real answer and re-create the fabrication in a new
  place.

**New dialog copy:**

- Title: `לדלג בינתיים?`
- Description: `אפשר להשלים את הפרטים בכל רגע בהגדרות, במקטע "פרטים אישיים".`
- Confirm: `דלגו` · Cancel: `נמשיך`

`זאת` pointing at an abstract process is stiff, and `המשך הגדרה` reads like a noun. `נמשיך` is how
a Hebrew speaker declines to leave.

The one-way door itself (skip marks onboarding done forever) I am leaving alone — see §7.

---

## 5. Telemetry — two new event names

Constraints I verified, which shape the design:

- `FUNNEL_EVENTS` is a closed TS union **and** an RLS `CHECK` allow-list
  (`funnel.ts:27-40`, migration `20260726110000_product_events.sql`). Every new name is a database
  migration plus a code change, deployed in that order. So names are expensive; **props are free**
  (`FunnelProps = Record<string, string | number | boolean>`, size-capped server-side).
- `trackFunnel` returns before the server write when `!hasAnalyticsConsent()` or when there is no
  authenticated user (`funnel.ts:69-73`).
- `handleOnboardingSkip` fires **no** funnel event at all (`AppRouter.tsx:261-268`).

### The minimum set

| Event | Props | Answers |
|---|---|---|
| `onboarding_step_viewed` *(new)* | `{ step: 'profile', index: 1 }` | **The whole question.** Fired on each step mount; step-to-step deltas are the drop-off curve. `step: 'welcome'` is the denominator, so no separate "started" event is needed. |
| `onboarding_skipped` *(new)* | `{ step: 'goals', fields_filled: 2 }` | Separates "left through the skip door" from "vanished". Today this path is silent. |
| `onboarding_completed` *(existing — fix the payload)* | `{ role: 'trainee', fields_filled: 3 }` | Not a new name. Replace `data.role ?? 'trainee'`, which emits `""`, with the literal; add the count so completion can be read against how much was actually answered. |

One event per step would have cost four or five allow-list entries for the same information. Two
names is the floor that still answers the question.

### The caveat that matters more than the events

**As built, none of this will be visible on the server for the population that matters most.**
Analytics consent defaults to `false` with `decidedAt: null` (`trackingConsent.ts:37-45`), and
guests are dropped outright (`if (!user) return`) — and the guest path is the shortest path through
onboarding. The cookie banner *is* mounted as a sibling of the router (`App.tsx:33-34`) so it can be
answered during onboarding, but until it is, the write is skipped.

So step-level drop-off will only be measurable for **signed-up users who accepted analytics before
finishing onboarding.** Two honest responses:

1. **Accept the cohort and label every chart with it.** Recommended for now — it is cheap and it is
   truthful.
2. Read the local mirror. `trackLocalEvent` writes to localStorage unconditionally — offline, for
   guests, without consent — and could be uploaded once consent arrives. Real work, and it has its
   own consent question. Named as the follow-up, not proposed here.

Without (1) stated explicitly on the dashboard, someone will read a guest-heavy funnel as a
completion cliff. That misreading is more expensive than the events are.

---

## 6. Risks

**a) The cut I could most regret: `equipment`.** It is the only signal about where the user trains.
Cutting it is correct today — nothing reads the value — but the moment anyone builds
equipment-aware template or exercise filtering, the question has to come back, and by then there
is a cohort with no answer stored. *Mitigation:* keep the `EquipmentAccess` type and the four
option definitions in the codebase. They cost nothing and make re-introduction a UI change rather
than a re-design. Same argument, lower stakes, for `preferredWorkoutDays` if scheduling or
reminders ever ship.

**b) What breaks for an existing user.** Three distinct cases:

- **Stored `onboarding_data` keeps all 18 keys.** `safeJsonParse<Partial<OnboardingData>>` still
  parses them and extra keys are ignored at runtime, so there is no data loss and no crash. But the
  recovery seed at `AppRouter.tsx:228-243` reads `data.restBetweenSets` and
  `getActivityLevelFromOnboarding(data.experienceLevel)`. If those leave the type without that
  block changing in lockstep, it writes `undefined` into `user_profile` / `workout_prefs`. **Those
  two sites must move in the same change.**
- **`normalizeProfile` reads `onboarding?.equipment`** (`profile.ts:74`). Recommendation: **keep
  reading it for back-compat, stop writing it, and remove it from the `fields` array** so the
  completeness denominator is identical for old and new users. If it stays in the array while no
  new user can populate it, the ceiling silently becomes 6/7 for everyone and the metric stops
  meaning "complete".
- **The already-fabricated cohort cannot be fixed in place.** Every existing user who completed
  onboarding without picking an experience level already has `activityLevel: 'פעיל מתון'` in
  `user_profile`, and fixing the write site does not undo it. They are indistinguishable from users
  who genuinely chose `'פעיל מתון'` — *except* by one signature: `activityLevel` set **and**
  `onboarding_data.experienceLevel === ''`, and that raw draft is still in localStorage. A one-time
  clear on exactly that pair would un-fabricate them. **This writes to stored user data, so it is a
  deliberate decision, not a cleanup** — flagging it rather than recommending it.

**c) What depends on `completeness`.** Denominator is 7:
`[age, weightKg, heightCm, gender, experienceLevel, primaryGoal, equipment]` (`profile.ts:85`).

A new user under this proposal has weight + goal + experience present = **3/7 = 0.43**, below the
0.5 threshold. Today the same user would reach 6/7 = 0.86. Consequences, precisely:

- `contextBuilder.ts:125` — `'פרופיל חלקי'` is added to the AI prompt's gap list, instructing the
  model to qualify its confidence. **This will fire for every new user until they open Nutrition.**
  I am accepting it: the profile genuinely *is* incomplete, and a hedged AI on an incomplete
  profile is the system working. The wrong fix would be padding the numerator.
- `coachBrief.ts:82` — `'high'` confidence requires `completeness >= 0.5`. **Much smaller than it
  looks:** `coachBrief.ts:80` returns `'low'` when `sessionCount < 3`, so completeness cannot affect
  a brand-new user's confidence at all, and by three sessions most users who care about calories
  have opened Nutrition. This is the consumer the audit missed, and having checked it, it is not a
  blocker.
- Removing `equipment` from the array (see b) makes the same user 3/6 = **0.50** — which clears the
  threshold by sitting exactly on it. **Do not rely on that.** Sitting on a boundary is not a
  design; if the gap flag is genuinely unacceptable, keep `age` in onboarding (4/6 = 0.67) rather
  than tuning the denominator until the number looks good.

**d) Interaction risks.** Auto-advance on the goal cards has no undo beyond the back chevron — a
mis-tap advances. It is the one interaction I would verify on a real device before shipping. Cutting
the completion screen removes the success haptic. Neither is severe.

**e) A gain I am not claiming.** Weight is optional today and stays optional here; the proposal
moves it next to a stated reason but does not make it more likely to be filled. Whether
"נחשב את הקלוריות בכל אימון" raises fill rate is unknown until §5's telemetry exists. I am not
counting it as a win.

**f) Accidental-quit data loss is unchanged.** Progress lives in sessionStorage
(`useOnboardingWizard.ts:35-42`), so closing the tab still restarts from step 0. Shortening the flow
to three questions shrinks the loss to near-nothing, which is a mitigation by accident rather than
a fix — see §7.

---

## 7. What I deliberately did not propose

1. **Equipment-aware template or exercise filtering.** This is the consumer that would justify
   keeping the equipment question. Building it is a separate decision and explicitly not mine to
   assume — which is why §2 records equipment as a **cut**, not a defer.
2. **Deriving `activityLevel` from logged sessions.** The only option that would be genuinely
   accurate, and the right long-term answer. Needs weeks of data and a derivation nobody has built.
3. **Re-entrant onboarding.** Not clearing `onboarding_completed` on skip, or letting the
   `FirstRunHero` re-offer the wizard, would fix the one-way door properly. It is a routing change
   with its own failure modes; pointing skippers at a Settings section that can now actually
   complete every field is cheaper and enough.
4. **Persisting wizard progress to localStorage.** Would fix the accidental-quit asymmetry (§6f),
   but it is a persistence change with a privacy dimension for guests, and a three-question flow
   makes it low-value.
5. **Branching the flow by goal or experience.** The flat list is deliberate and asserted by tests
   (`onboardingFlow.logic.test.ts:35-42`). Branching doubles the QA surface for no verified gain.
6. **Moving the age and consent gates before onboarding.** The audit is right that collecting name,
   gender, age, height and bodyweight *before* terms and privacy consent is backwards
   (`AppRouter.tsx:308-327`). That is a legal-sequencing decision owned by whoever owns consent, not
   an onboarding-copy change. Deferring age and gender does reduce what is collected pre-consent to
   name + weight, which helps incidentally.
7. **Changing the welcome brand line** `כתוב סטים. תראה התקדמות.` — a commented, deliberate match
   to the login masthead. It needs a ratified exception, not a silent flip.
8. **Anything on the login screen** (`המשיכו כאורח`) — outside the flow.
9. **A BMI empty-state prompt on Progress** (`הוסיפו גובה כדי לראות BMI`). Tempting, but the defer
   verdict for `height` already has a real home in Settings › פרטים אישיים, so this is a
   nice-to-have and a new UI element. Listed so it is on the record, not in the plan.
10. **A fix for the blur/disabled-gate contradiction.** It is UNVERIFIED (§0) and needs a real
    device. Removing `age` sidesteps it today; that is not the same as fixing it.

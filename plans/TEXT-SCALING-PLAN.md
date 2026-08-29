# TEXT-SCALING-PLAN — making `טקסט גדול` actually scale

**Status:** plan only. No source touched, no build, no browser, no git.
**Scope of authority for this document:** read-only survey + dispatchable batches.

---

## 0. What is actually wired today (verified from source)

| Fact | Evidence |
|---|---|
| The switch writes a class on `<html>` | `src/contexts/SettingsContext.tsx:255` — `classList.toggle('large-text', …)` |
| The switch UI | `src/pages/settings/sections/ThemeSection.tsx:87` (`טקסט גדול`), duplicated at `src/components/workout/overlays/WorkoutSettingsOverlay.tsx:459` |
| The class's entire effect | `src/styles/tokens.css:265` — `html.large-text { font-size: 1.125rem; }` |
| The root is hard-pinned to px | `src/styles/typography.css:14` — `html { font-size: 16px; }` |
| Tailwind's named sizes are `rem` | `tailwind.config.js:102–119` — every entry is rem (`sm: 0.8125rem`, `base: 0.9375rem`, `lg: 1.0625rem` …) |
| The design-token type scale is px | `src/styles/tokens.css:230–241` — all 12 `--text-*` tokens are px |

**The mechanism, stated precisely.** `1.125rem` on the root element resolves against the
browser's *initial* font size (16px), not against the `16px` declared one line away — so the
class sets the root to **18px, exactly +12.5%**. `html.large-text` (specificity 0,1,1) beats
`html` (0,0,1), so the toggle does take effect even though `typography.css` loads after
`tokens.css` (`src/main.tsx:18–22`). Everything expressed in `rem` therefore grows 12.5%;
everything expressed in px is unaffected by definition. That is the whole defect.

The +12.5% figure and the lead's measured "≈12.5% of text grows" are two different numbers that
happen to coincide. The 12.5% *factor* is a fact from source; the 12.5% *proportion of text* is
the lead's runtime measurement, which I cannot reproduce this batch.

**Second, separate defect found in the same two lines.** `html { font-size: 16px }` overrides the
user's own browser/OS font-size preference for every rem in the app. A user who set 20px text in
their browser gets 16px here. Fixing this is one character-level edit (`16px` → `100%`) and is
independent of the in-app switch.

**The rule being broken**, `~/.kiro/skills/apple-design/SKILL.md` §15 (line 218 ff.):
> *"Respect the user's text-size setting (Dynamic Type). Scale layout **with** the text — spacing
> in `rem`/`em`, not fixed px — so a larger font doesn't break the layout."*

This is why §3 below is the section that decides whether the conversion is safe at all. Growing
text without growing its container is not an improvement; it is a different bug.

---

## 1. Inventory — counted, not estimated

### How I counted (so the numbers are checkable)

Every number below comes from the `grep` **tool** (not a shell pipe — the shell truncates at the
first non-ASCII byte and still returns exit 0), run against `C:\Users\amit0\Desktop\fitness-app`:

| # | Regex | Meaning |
|---|---|---|
| A | `font-size:` | all font-size declarations in a CSS file |
| B | `font-size:\s*[0-9.]+px` | the px-literal subset of A |
| C | `fontSize:` | all inline-style font sizes in `src/**` |
| D | `fontSize:\s*[0-9]` | unitless numeric — React appends `px`, so these **are** px |
| E | `fontSize:\s*['"][0-9.]+px['"]` | quoted px string |
| F | `fontSize:\s*['"]var\(` | token reference |
| G | `fontSize:\s*[A-Za-z_({\`]` | identifier / expression / template literal |
| H | `text-\[[0-9.]+px\]` | Tailwind **arbitrary** size — does not scale |

Non-font px (borders, heights, gaps) was counted with a separate regex anchored on the property
name (`(^\|[^-a-z])(height\|min-height\|max-height\|width\|min-width\|max-width\|line-height):\s*[0-9.]+px`)
so it can never collide with a `font-size` match. Where A ≠ B I read the lines and classified by
hand; those hand classifications are listed by line number below, so they are re-checkable.

### 1a. CSS files

Note: the brief scoped this to `src/styles/**`. There is a **sixth stylesheet outside that
directory** — `src/components/workout/exercise-library.css`. It is included here; a survey that
obeyed the stated scope literally would have missed it.

| File | A: font-size decls | B: px literal | already `rem` | via `var(--text-*)` (px underneath) | `clamp()` with px |
|---|---|---|---|---|---|
| `src/styles/components.css` | 23 | **22** | 0 | 0 | 1 — line 1647 `clamp(48px, 14vw, 92px)` |
| `src/styles/global.css` | 17 | **14** | 3 — lines 215, 237, 293 | 0 | 0 |
| `src/styles/typography.css` | 19 | **4** — lines 14, 313, 367, 375 | 0 | 15 | 0 |
| `src/styles/tokens.css` | 1 | 0 | 1 — line 265 (`html.large-text`) | 0 | 0 |
| `src/styles/motion.css` | 0 | 0 | 0 | 0 | 0 |
| `src/components/workout/exercise-library.css` | 9 | **0** | 0 | 9 | 0 |
| **Total** | **69** | **40** | **4** | **24** | **1** |

Plus the scale itself: **12 px tokens** at `tokens.css:230–241`
(`--text-display-hero: 120px` … `--text-caption: 10px`).

**65 of the 69 CSS font-size declarations are px-derived.** 40 directly, 24 through the token
scale, 1 inside a `clamp()`.

The good news is in the "via var" column: those 24 declarations plus every other `--text-*`
consumer become scalable the moment 12 lines of `tokens.css` change. `exercise-library.css` needs
**zero** edits — all 9 of its sizes are token-driven.

### 1b. Inline `style` objects across `src/**`

| Form | Count | Files | Scales today? |
|---|---|---|---|
| D — `fontSize: 13` (unitless → px) | **889** | 160 | no |
| E — `fontSize: '13px'` | **213** | 57 | no |
| F — `fontSize: 'var(--text-…)'` | 5 | 3 | no (token is px) — yes after Batch 1 |
| G — expression / identifier | 9 | 7 | unknown, must be read individually |
| residual (C − D − E − F − G) | 5 | — | unclassified; read before converting |
| **C — total `fontSize:`** | **1121** | **205** | — |

**px-equivalent inline sites: 1102.** The dominant form is the unitless number, which is easy to
miss with a naive `px` grep — 889 of the 1102 have no `px` anywhere in the source text.

Heaviest files (D+E): `ExerciseTutorial.tsx` 27 · `history/WorkoutHistory.tsx` 22 ·
`states/PreWorkoutScreen.tsx` 20 · `pages/Program.tsx` 20 · `reorder/SetEditRow.tsx` 18 ·
`pages/WorkoutDetail.tsx` 17 · `components/SetEditBottomSheet.tsx` 16 · `WorkoutSummary.tsx` 16 ·
`nutrition/AddMealModal.tsx` 15 · `templates/CreateTemplateModal.tsx` 15.

### 1c. Tailwind arbitrary sizes

**H = 25 sites in 11 files.** These are the neighbour that does not grow while `text-sm` beside it
does — the patchiness the lead observed:

`components/ui/Button.tsx` 4 (lines 157, 260–262) · `components/fitness/WorkoutComparison.tsx` 4 ·
`components/workout/components/PerformanceAnalytics.tsx` 3 · `errors/PageErrorBoundary.tsx` 3 ·
`pages/progress/tabs/RecoveryTab.tsx` 3 · `components/ui/AnimatedProgressRing.tsx` 2 ·
`components/workout/components/PRHighlights.tsx` 2 · `components/ui/BottomNav.tsx` 1 (line 196) ·
`components/ui/EmptyState.tsx` 1 · `components/calendar/ExportCalendarButton.tsx` 1 ·
`components/workout/components/IntensityMeter.tsx` 1.

### 1d. Non-font px, for contrast

`(min-/max-)height|width|line-height` in px: **42 in `components.css`, 15 in `global.css`** = 57.
These are *not* font sizes and most of them must stay px — see §2. Fixed `height:` (not
`min-height`) in `components.css`: lines 253, 346, 380, 453, 458, 483, 695, 713, 941, 1076, 1273,
1366, 1388, 1455.

---

## 2. Verdict per group

### SAFE TO CONVERT — px → rem, 1:1, no layout consequence

| Group | Where | Why safe |
|---|---|---|
| The 12 `--text-*` tokens | `tokens.css:230–241` | Pure type scale. The rem equivalents **already exist and are already agreed** in `tailwind.config.js:102–119` (`0.8125rem` = 13px, `0.9375rem` = 15px, `1.0625rem` = 17px, `2.25rem` = 36px …). Converting the tokens makes the two scales agree instead of diverge. |
| Root font size | `typography.css:14` | `16px` → `100%`. Restores the browser preference. Computes to the same 16px for a default user, so it is a no-op for everyone except the users it fixes. |
| Body-copy and label font-sizes in CSS | most of the 40 px literals | Text that sits in an auto-height flow box. Growth pushes the box taller, which is the intended behaviour. |
| The iOS zoom guard | `components.css:586` `font-size: 16px !important` | Convert to `1rem`. **Constraint: this value may never compute below 16px** or iOS zooms the viewport on input focus. `1rem` satisfies that at default and grows above it; any smaller rem value does not. |
| The 1102 inline `fontSize` px sites | `src/**` | Same reasoning as CSS body copy, *once §3 has cleared their containers*. |
| The 25 Tailwind arbitrary sizes | §1c | Prefer replacing with the **named** token (`text-label` for `text-[11px]`, `text-[10px]` → `text-caption`) rather than `text-[0.6875rem]` — same result, and it stops the class of bug recurring. |

### NEEDS LAYOUT WORK — convert the font, but fix the container in the same commit

| # | Site | Problem |
|---|---|---|
| N1 | `--nav-height: 64px` (`tokens.css:383`) consumed by `components.css:998` `padding-bottom: calc(var(--nav-height) + 28px + env(safe-area-inset-bottom))` | The bottom nav's own labels are text. If the label grows the nav grows, but `--nav-height` is a constant, so the page's bottom padding no longer clears it and the nav covers page content. The token must become rem, or the padding must be measured, not assumed. |
| N2 | `components/ui/Button.tsx:157` — `h-[52px] px-6 text-[17px]` | Hard `h-`, not `min-h-`. 17px → 19.1px inside a frozen 52px box. Fix: `min-h-[52px]`. |
| N3 | `components/ui/BottomNav.tsx:234,240,242` — badge `height: 16, fontSize: 9, lineHeight: '16px'` | Fixed 16px pill, 9px numeral, hard 16px line-height. Three constants that must move together or not at all. |
| N4 | `pages/progress/tabs/RecoveryTab.tsx:321` — `w-8 h-8 rounded-full … text-[13px]` | 32px circle, text inside. Round means width and height are locked to each other. |
| N5 | `.load-plate` `components.css:695–701` — `58×58`, `border: 10px`, `font-size: 11px` | A weight plate is a circle by definition; its inner label has ~38px of usable width. The label must scale with the plate or stay put. |
| N6 | `.fs-brand-icon` `components.css:1388–1396` — `42×42`, `border: 7px`, `font-size: 14px` | Same shape as N5. |
| N7 | `.choice-row-icon` `components.css:941` — `46×46` circle | Icon-only today; becomes N4 if it ever holds a glyph label. Convert nothing, note the constraint. |
| N8 | Line-clamped text: `global.css:614` (`-webkit-line-clamp: 1`), `global.css:621` (`: 2`) | Clamping is by *line count*, so it survives scaling — but the clamped box's own height must be em/rem-derived, or the second line is cut mid-glyph. Read both rules before converting anything near them. |
| N9 | Single-line text: `whitespace-nowrap` at 7 sites in 5 files (`pages/coach/ClientReport.tsx` ×2, `templates/CreateTemplateModal.tsx` ×2, `coach/client/tabs/OverviewTab.tsx`, `coach/ClientDetail.tsx`, `coach/CoachClients.tsx`); `white-space: nowrap` in `exercise-library.css:67,314`; Tailwind `truncate` at 7 sites in 5 files | Text that cannot wrap must overflow. In an RTL layout the overflow escapes on the *left*, which is the side people check last. |
| N10 | `.stepper-value` `components.css:1289–1294` — `min-height: 56px`, `font-size: 46px`, `line-height: 1` | This one is **already correct** and is the pattern to copy: `min-height` floor + unitless `line-height`. Listed here as the reference shape, not as a defect. |

### MUST STAY PX — converting these is a regression

| Group | Sites | Why |
|---|---|---|
| Hairlines and 1px rules | `components.css:453,458`; `global.css:264,497` (`height: 1px`) | A hairline is a device-pixel artefact. `0.0625rem` at 112% = 1.12px, which the browser resolves to a blurry or intermittently-invisible line. Separator thickness is not typographic. |
| 1px borders | throughout both stylesheets | Same reason. A border that scales with text is a border that disappears at some zoom level. |
| Progress-track / bar / dot geometry | `components.css:483` (4px), `713` (8px), `1273` (5px), `1366` (10px), `1455` (12px); `global.css:85,995` (4px) | Fixed-geometry indicators. A 4px track is a designed thickness, not a function of the text near it. |
| The iOS toggle | `components.css:346` (`51×31`), `380` (thumb `27×27`) | 51×31 is the platform switch dimension. It is a recognised control shape; scaling it makes it a different, unrecognised control. Its thumb `transform: translateX` distance is also computed from these constants. |
| Icon-box dimensions | `components.css:253` (`.btn-arrow .arrow-icon` 28×28), `941` (46×46), `1076` (`.icon-btn` 44×44) | These size a **glyph**, not text. Lucide icons are drawn at a px size. |
| Avatar dimensions | `components/ui/ProfileAvatar.tsx` | An avatar is an image frame. |
| `min-height: 44px` touch targets | `components.css:121,143,878,1043`; `global.css:301`; `Button.tsx:260–262` (`min-h-[44px]`) | 44px is the WCAG/HIG **floor**, and `min-height` is already a floor, so growing text simply makes the target bigger — which is correct. Converting to rem would let it shrink below 44px if a user *reduced* their font size, turning an accessibility guarantee into an accessibility bug. **Leave every 44/48/52px `min-height` in px.** |

The distinction that carries most of §2: **`min-height` is a floor and is safe; `height` is a
ceiling and is a clip risk.** Of the 57 fixed dimensions, the `min-height` ones mostly need no
work at all. That is why the honest conversion is far smaller than "57 things to fix".

---

## 3. What breaks when text grows — the hard part

Ordered by how likely it is to be visible to a user during a set.

1. **Bottom nav covering page content (N1).** The highest-consequence item, because it affects
   every screen rather than one component, and because the failure is *occlusion*, not clipping —
   the user loses access to a control rather than seeing a squeezed label.
2. **The nav label itself (`BottomNav.tsx:196`, `text-[10px] leading-none`).** `leading-none` means
   no leading slack whatsoever; five labels share the 480px cap. At 12.5% the labels are the first
   thing to collide with each other. Today they do not grow at all — so **fixing the scaling makes
   this row worse before it makes it better.** It has to be in the same batch as N1.
3. **`Button.tsx:157` (N2).** Hard `h-[52px]` with 17px text and `font-semibold`. One-character
   fix, high visibility, affects the primary CTA shape.
4. **Round badges and plates (N3–N6).** A circle cannot reflow. Either the diameter is derived from
   the font size (`em`), or the label stays px. Do not split the difference.
5. **`whitespace-nowrap` / `truncate` in the coach screens (N9).** 14 sites. Long Hebrew client
   names are already the worst case here; scaling adds 12.5%. RTL means the clipped end is on the
   left, so this is exactly the class of defect a quick LTR-habit glance misses.
6. **Hero numbers.** `components.css:1292` (46px), `1647` (`clamp(48px,14vw,92px)`),
   `typography.css:313` (120px), `367` (48px), `375` (220px), `global.css:389` (96px), `428` (44px).
   These sit in `min-height` boxes with `line-height: 1`, which is the safe shape (N10) — but at
   120px→135px and 220px→247.5px they are also the sizes most likely to exceed the 480px width cap.
   Because they are already display-scale, **the accessibility argument for scaling them is weak**:
   a user who needs larger text does not need a 247px numeral. Recommend `clamp()` with a rem
   preferred value and a px-ish max, or leaving the ≥88px tier alone. Decide before Batch 2, not
   during.
7. **Input font size (`components.css:586`).** Behaviour change is intended and beneficial, but any
   error here costs an iOS viewport zoom on every field focus, which is very visible. Treat as its
   own verification step.

**Verdict on whether the conversion is safe: yes, conditionally.** No item above is
unfixable, and the two structural ones (N1, N2) are small. But every one of them lives *outside*
the font-size lines themselves, which is precisely why eight batches of font-size-only work would
not have found them. The gate is: **N1 and N2 must land in or before the batch that makes the
tokens scale**, or the first user to flip the switch gets an occluded nav.

---

## 4. `--font-scale` — delete it

**Delete.** Not adopt.

The facts: written at `src/components/workout/hooks/useWorkoutSettings.ts:400` (`'1.2'`) and `:402`
(`'1'`), removed at `:422`. Read by **zero** stylesheets and zero components — `grep "var(--font-scale"`
across the whole repo returns nothing.

Four reasons it cannot be the mechanism:

1. **Wrong lifetime.** Its only consumer-side owner, `useAccessibilitySettings()`, is mounted in
   exactly one place: `src/components/workout/ActiveWorkoutNew.tsx:336`. The property therefore
   exists only while the active-workout screen is mounted and is deleted on unmount. A global text
   setting that evaporates when you leave one screen is not a mechanism.
2. **Two disagreeing sources of truth.** `--font-scale` says 1.2 (+20%); `html.large-text` says
   1.125rem (+12.5%). One user setting, two magnitudes. Whichever survives, the other must go.
3. **Strictly more work than rem, for a worse result.** Using it means rewriting every size as
   `calc(var(--text-body) * var(--font-scale))` — 65 CSS declarations *and* 1102 inline sites,
   because an inline `fontSize: 13` cannot read a CSS variable without becoming
   `fontSize: 'calc(13px * var(--font-scale))'`. Converting to rem touches strictly fewer places.
4. **It does not solve the §15 problem.** Multiplying font sizes still leaves spacing, padding, and
   container heights in px. `rem` on the root scales type *and* every rem-based dimension from one
   declaration — which is the actual remedy §15 names.

`html.large-text { font-size: … }` on the root is the cascade-native mechanism, needs no JS, cannot
drift from the class, and survives navigation. Keep it; align its value with whatever multiplier the
product wants (1.125 today, 1.2 if the lead prefers the larger step — say so explicitly rather than
inheriting it by accident); delete the property and the three lines that write and clean it up.

---

## 5. Batches — file-exclusive, ordered by value-for-risk

Each batch is one worker owning its files outright. No file appears twice.

| # | Files owned | Work | Why here in the order |
|---|---|---|---|
| **B1** | `src/styles/tokens.css`, `src/styles/typography.css` | 12 `--text-*` → rem using the `tailwind.config.js:102–119` values as the reference table; `html{font-size:16px}` → `100%`; settle the `html.large-text` multiplier; convert `typography.css:313,367,375` (or clamp them per §3.6) | **Cheapest genuine win, by a wide margin.** ~15 edited lines make 24 CSS declarations, all 9 of `exercise-library.css`, and every `--text-*` consumer scale — and fix the ignored browser preference for free. Touches no geometry, so it cannot break layout on its own. |
| **B2** | `src/components/ui/BottomNav.tsx`, `src/components/ui/Button.tsx` | N1 (nav-height/padding relationship — coordinate the `--nav-height` value with B1), N2 (`h-[52px]` → `min-h-[52px]`), N3 (badge triplet), and the 5 `text-[Npx]` in these two files | **The safety gate.** Must land with or immediately after B1 — B1 alone makes the nav label grow inside furniture that does not. Two files, both small. |
| **B3** | `src/components/workout/hooks/useWorkoutSettings.ts` | Delete `--font-scale` (lines 400, 402, 422) and prune the now-stale comment at 415–421 | Two-line deletion, removes a live contradiction, zero risk once B1 owns the mechanism. Independent of every other batch. |
| **B4** | the other 9 files in §1c | Replace 20 `text-[Npx]` with named token classes | Mechanical, self-contained, and it removes the *visible symptom* the lead reported (two labels in one row scaling differently). Good value per unit of risk. |
| **B5** | `src/styles/components.css` | 22 px font-sizes → rem; `:586` → `1rem` with the ≥16px constraint documented in-file; **leave every entry in §2 MUST STAY PX alone**; N5, N6, N7 | Largest single stylesheet and it holds both the input guard and the plate/brand geometry, so it wants an owner who has read §2 and §3 rather than a fast pass. |
| **B6** | `src/styles/global.css` | 14 px font-sizes → rem; leave `:264,497` hairlines and `:85,995` 4px tracks; verify N8 line-clamp boxes | Same shape as B5, smaller, and the 3 rem values already there (`:215,237,293`) are the in-file precedent to match. |
| **B7** | `src/components/workout/**` (`.tsx`) | Inline `fontSize` → rem across the workout tree — the heaviest cluster (`ExerciseTutorial` 27, `PreWorkoutScreen` 20, `SetEditRow` 18, `SetEditBottomSheet` 16, `WorkoutSummary` 16, …) | The tail starts here because this is the surface a user is on *during a set*, so it has the highest accessibility payoff per file — but it is high-churn, so it goes after the cheap structural wins. |
| **B8** | `src/pages/**` (`.tsx`) | Inline `fontSize` → rem; resolve N9 (`whitespace-nowrap`/`truncate` in the coach screens) in the same pass | Largest file count. N9 lives almost entirely in here, so pairing them avoids a second visit. |
| **B9** | `src/components/**` except `workout/`, plus `src/errors/**` | Remaining inline `fontSize`; read and individually classify the 9 expression-form (G) and 5 residual sites before converting | Last because it is the residue, and because the unclassified 14 sites need judgement rather than a rule. |

Sequencing constraint: **B1 → B2 is the only hard ordering.** B3 and B4 are independent and can run
alongside. B5–B9 all depend on B1 for the token values but not on each other.

Suggested dispatch: B1 alone; then B2, B3, B4 in parallel; then B5–B9 in parallel.

---

## 6. What I could NOT determine

Stated plainly, because §3 would otherwise read as measurement when it is reasoning.

1. **Every overflow, clip, and collision claim in §3 is INFERRED FROM SOURCE, not observed.** I had
   no browser this batch (another worker holds it). I read a fixed `height`/`h-[]` next to a
   font-size and concluded "clips". I did not see a clipped pixel. Specifically unverified: N1
   (does the nav actually occlude content, and by how much), N2, N3, N4, N5, N6, and the hero-number
   width overflow in §3.6.
2. **The lead's "≈12.5% of text grows" is not reproduced.** I derived the +12.5% *factor* from
   `tokens.css:265`, which is a source fact. The *proportion* of on-screen text that responds is a
   runtime measurement I cannot repeat without a browser. The two numbers coinciding is arithmetic
   coincidence, not corroboration.
3. **`--font-scale` is dead by static analysis only.** `grep "var(--font-scale"` finds no readers in
   the repo. A runtime read via `getComputedStyle(...).getPropertyValue('--font-scale')`, or a
   consumer in a file type I did not search, would not appear in that grep. I consider this low risk
   but it is not proof.
4. **14 inline sites are unclassified** — the 9 expression-form (G) matches in `HeroStat.tsx`,
   `PageHeader.tsx`, `RingProgress.tsx`, `WeeklyGrid.tsx`, `SmoothLoader.tsx`, `NumpadOverlay.tsx`,
   `MacroGrid.tsx`, plus 5 residual sites the five regexes did not account for (1121 total −
   889 − 213 − 5 − 9). Each needs reading; a blanket rule would be guessing. Assigned to B9.
5. **Per-file inline counts for B7–B9 are grep totals, not reviewed diffs.** A `fontSize` inside a
   comment, a test fixture, or an SVG `<text>` attribute would inflate the count. Expect the real
   edit count to come in slightly under 1102.
6. **The clamp at `components.css:1647` was counted but its behaviour under scaling was not
   reasoned through.** `clamp(48px, 14vw, 92px)` is viewport-relative in the middle term, so it
   ignores the root font size entirely. Whether that is desirable is a design decision, not a
   mechanical conversion. Flagged for B5's owner; not decided here.
7. **No verification was run** — no `npm run verify`, no `npm run test:run`, no build, per the
   read-only constraint and to avoid corrupting the other workers' evidence. Nothing in this plan
   has been type-checked or linted, because nothing in this plan is code.

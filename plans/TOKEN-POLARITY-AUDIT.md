# Token polarity audit — `--fs-primary` and its non-flipping siblings

**Status:** read-only audit. No product code was changed. This file is the only artefact.
**Date:** 2026-08-28
**Method:** **static read of the stylesheets and sources only.** No dev server, no
Playwright, no preview, no browser measurement — another agent held the browser
(port 4173) during this batch. Every contrast figure below is **computed
arithmetically from the resolved hexes in `src/styles/tokens.css`**, not sampled
from a rendered page. See *Arithmetic source* for validation.

---

## 0. Arithmetic source

WCAG 2.x relative luminance and contrast, computed by hand:

```
c_srgb = channel / 255
c_lin  = c_srgb <= 0.03928 ? c_srgb / 12.92 : ((c_srgb + 0.055) / 1.055) ^ 2.4
L      = 0.2126*R_lin + 0.7152*G_lin + 0.0722*B_lin
ratio  = (L_lighter + 0.05) / (L_darker + 0.05)
```

Validation — the three figures already established by prior fixes reproduce exactly:

| Known figure (from prior fixes) | Recomputed here | Match |
|---|---|---|
| week-strip trained day, light — 11.83:1 | 11.84:1 (`#16292d` on `#dbe6e3`) | ✓ |
| week-strip trained day, dark — 1.31:1 | 1.31:1 (`#0a0a0a` on `#262626`) | ✓ |
| warmup countdown, light — 15.12:1 | 15.12:1 (`#16292d` on `#ffffff`) | ✓ |

Resolved luminances used throughout:

| Token | Light hex | L | Dark hex | L |
|---|---|---|---|---|
| `--fs-primary` | `#16292d` | 0.019452 | `#0a0a0a` | 0.003035 |
| `--fs-surface` | `#ffffff` | 1.000000 | `#111111` | 0.005605 |
| `--fs-bg` | `#eef3f1` | 0.886305 | `#000000` | 0.000000 |
| `--fs-surface-2` | `#dbe6e3` | 0.771994 | `#262626` | 0.019382 |
| `--fs-accent` | `#43c7a5` | 0.447519 | `#4ddcbb` | 0.563465 |
| `--fs-signal` | `#e2fb70` | 0.863552 | `#e2fb70` | 0.863552 |
| `--fs-rubber` | `#0d1516` | 0.006795 | `#050505` | 0.001518 |
| `--navy-deep` | `#0d1a1c` | 0.009088 | `#050505` | 0.001518 |
| `--btn-primary-text` | `#43c7a5` | 0.447519 | `#071412` | 0.005887 |

**No component-level dark override exists anywhere.** A grep for `^html\.dark`
across `src/styles/` returns exactly one hit — the token block at
`src/styles/tokens.css:376`. Every stylesheet rule therefore resolves through the
token, and there is no rescue rule anywhere. That eliminates a whole class of
false positives, and it also means the token value is the *only* lever.

---

## 1. The token, quoted exactly

`src/styles/tokens.css:22` (Fresh Steel, light — `:root`):

```css
  --fs-primary: #16292d;
```

`src/styles/tokens.css:397` (Obsidian, dark — `html.dark`):

```css
  --fs-primary: #0a0a0a;
```

**It does not flip.** It is dark in both themes. Every *surface* token in this app
does flip. So the relationship between `--fs-primary` and whatever it sits on
inverts, and the contrast collapses from 11.8–15.1:1 to 1.05–1.31:1.

### The whole failure surface in one table

Every fill, border and text use of `--fs-primary` reduces to one of these five
pairings. This table is the audit's core measurement; the per-site sections below
just say which row applies.

| `--fs-primary` against | Light | Dark | Verdict |
|---|---|---|---|
| `--fs-surface` (`#ffffff` → `#111111`) | **15.12:1** | **1.05:1** | broken |
| `--fs-bg` (`#eef3f1` → `#000000`) | **13.48:1** | **1.06:1** | broken |
| `--fs-surface-2` (`#dbe6e3` → `#262626`) | **11.84:1** | **1.31:1** | broken |
| `--fs-accent` (`#43c7a5` → `#4ddcbb`) | 7.16:1 | 11.57:1 | **safe** |
| `--fs-signal` (`#e2fb70` → `#e2fb70`) | 13.15:1 | 17.23:1 | **safe** |

The two safe rows are why the discriminator matters: `--fs-accent` and
`--fs-signal` stay mid-bright/bright in *both* themes, so they and `--fs-primary`
move together. Those are the only surfaces on which `--fs-primary` is legitimate.

> **One correction to the brief's discriminator.** The brief says a text use is
> safe if its surface "is also theme-flipped in the same direction". No surface in
> this app flips in the *same* direction as `--fs-primary` — `--fs-primary` does
> not flip at all, and every surface token flips light→dark, i.e. the opposite
> way. So `--fs-primary` used as **text on `--fs-surface` / `--fs-bg` /
> `--fs-surface-2` is broken too**, at exactly the same 1.05–1.31:1. I have
> classified those as at-risk and measured them rather than waving them through.
> The genuinely safe text uses are the ones on a **non-flipping light fill**
> (`--fs-accent`, `--fs-signal`) — 13 of them, listed in §5.

### Sibling tokens that share the defect

| Token | Light | Dark | Consumers | Verdict |
|---|---|---|---|---|
| `--navy` | `var(--fs-primary)` | `var(--fs-primary)` | 0 outside `tokens.css` | alias, dormant |
| `--color-primary` | `var(--fs-primary)` | `var(--fs-primary)` | `components.css:367` (dead rule) | dormant |
| `--navy-deep` | `#0d1a1c` | `#050505` | via `--color-primary-hover` | **broken — see §2.1** |
| `--color-primary-hover` | `var(--navy-deep)` | `#050505` | `Button.tsx:66,67` | **broken — see §2.1** |
| `--navy-light` | `#1c363b` | `#222222` | 0 | dormant |
| `--fs-rubber` | `#0d1516` | `#050505` | `components.css:683`, `InlineRestTimer.tsx:249` | **broken — 18.49:1 → 1.08:1** |

Tokens that stay fixed **on purpose** and are correct — do not "fix" these:
`--color-ink-on-accent` (`#071412` both; its surface is mint in both),
`--fs-signal` (`#e2fb70` both; light in both), `--color-on-mustard`
(`var(--fs-primary)` on `--fs-signal` → 13.15:1 / 17.23:1),
`--color-scrim` (a scrim's job is to darken).

### The house tokens that already invert correctly

These are the replacements. All three prior fixes used one of them; finding the
house solution beats inventing one.

| Token | Light | Dark | Use for |
|---|---|---|---|
| `--btn-primary-bg` / `--btn-primary-text` | `--fs-primary` / `--fs-accent` | `--fs-accent` / `#071412` | primary CTA fill + its ink |
| `--nav-pill-bg` / `--nav-pill-text` | `--fs-primary` / `#ffffff` | `--fs-accent` / `#071412` | "most prominent item in a row" fill (selected/active/trained) |
| `--fs-heading` | `--fs-primary` | `--fs-ink` (`#f0f0f0`) | heading/emphasis **text** on bg or surface |
| `--color-border-strong` | `--fs-primary` | `rgba(255,255,255,0.26)` | structural borders and rules |
| `--color-ink-on-dark` | `#ffffff` | `#f0f0f0` | ink on a deliberately-dark fill |
| `--color-ink-on-accent` | `#071412` | `#071412` | ink on a mint fill |

`global.css:410` and `components.css:1109` already carry in-file comments
explaining exactly this. The knowledge exists in the codebase; it just was not
applied everywhere.

---

## 2. Occurrence census

`--fs-primary` appears **249 times across 89 files**. Not all are suspects:

| Category | Count |
|---|---|
| Token definitions / aliases in `tokens.css` | 11 |
| Comment-only mentions (no paint) | 10 |
| **Real paint sites** | **228** |

Paint sites by role:

| Role | Count | Status |
|---|---|---|
| fill / background | **113** | 112 at risk, 1 safe-by-purpose (`ModalOverlay.tsx:333` scrim) |
| border | **92** | all at risk |
| text / icon colour | **19** | 6 at risk, 13 safe (on `--fs-accent` / `--fs-signal`) |
| SVG `stroke` | **3** | all at risk |
| indirect (theme map) | **1** | not determined |
| | **228** | **214 at risk · 14 safe** |

Of the 214 at-risk sites, **~40 are "deliberately dark chrome"** (mastheads,
overlay headers) where the *ink* stays legible via `--color-ink-on-dark` and only
the block's boundary against the page dissolves. Those are banded separately in
§4 as **degraded, not broken**, and should not be fixed the same way. See
§6 for what I could not determine about them.

---

## 3. Band A — broken and information-bearing

These are the ones that matter. A user cannot see state, cannot read a label, or
cannot see a control. Surfaces verified by reading the call site.

### 3.1 The worst one

**`src/components/ui/ToggleSwitch.tsx:142`** — role **fill** (the knob).
Surface: the track, which animates `--fs-accent` (on) / `--fs-surface-2` (off).

```
off state:  light 11.84:1   →   dark 1.31:1
```

The knob colour is unconditional `var(--fs-primary)`. In light, the off-knob is
the crispest thing in the control. In dark, it is *the darkest thing in the
control* — a near-black disc on a `#262626` track. Polarity fully inverted: the
element whose whole job is to show position stops having a position. Every toggle
rendered by this component is affected.

**`src/components/ui/SettingsToggle.tsx:70`** is the same bug in the second toggle
component (`background: checked ? 'var(--fs-surface)' : 'var(--fs-primary)'`).

### 3.2 The worst pure contrast number, with nothing to fall back on

**`src/AppRouter.tsx:939`** — role **border** (`2px solid var(--fs-primary)`,
`borderTopColor: transparent`, `animate-spin`). Surface: the route surface.

```
light 15.12:1   →   dark 1.05:1
```

This is the global route-transition spinner. Unlike a CTA there is no label to
rescue it — the element *is* pure geometry. In Obsidian the app shows a blank
screen during every lazy route load.

### 3.3 Full Band A list

| `file:line` | Role | Sits on | Light | Dark | Why it matters |
|---|---|---|---|---|---|
| `src/components/ui/Button.tsx:66` | fill (hover) | replaces `--btn-primary-bg` | 8.42:1 | **1.08:1** | see §2.1 below — **blocker** |
| `src/components/ui/Button.tsx:67` | fill (active) | replaces `--btn-primary-bg` | 8.42:1 | **1.08:1** | same, on press |
| `src/components/ui/ToggleSwitch.tsx:142` | fill (knob) | `--fs-surface-2` (off) | 11.84:1 | 1.31:1 | knob invisible when off |
| `src/components/ui/ToggleSwitch.tsx:126` | border (track) | `--fs-surface-2` | 11.84:1 | 1.31:1 | track outline gone |
| `src/components/ui/ToggleSwitch.tsx:159` | text (label) | `--fs-surface` | 15.12:1 | 1.05:1 | checked label unreadable |
| `src/components/ui/SettingsToggle.tsx:70` | fill (knob) | `--fs-surface-2` (off) | 11.84:1 | 1.31:1 | knob invisible when off |
| `src/components/ui/SettingsToggle.tsx:58` | border (track) | `--fs-surface-2` | 11.84:1 | 1.31:1 | track outline gone |
| `src/AppRouter.tsx:939` | border (spinner) | `--fs-surface` | 15.12:1 | 1.05:1 | global loader invisible |
| `src/errors/RootErrorBoundary.tsx:115` | fill (CTA) | `--fs-surface` | 15.12:1 | 1.05:1 | crash-recovery button has no body |
| `src/components/ui/PremiumSelect.tsx:201` | text | `--fs-surface-2` (selected row) | 11.84:1 | 1.31:1 | **selected** option's label vanishes |
| `src/pages/MyCoach.tsx:753` | fill (selected) | `--fs-surface` siblings | 15.12:1 | 1.05:1 | rating: selected value is *less* prominent than unselected |
| `src/pages/MyCoach.tsx:577` | fill (acked) | `--fs-surface` | 15.12:1 | 1.05:1 | mint border partly rescues it |
| `src/pages/onboarding/steps/GoalsStep.tsx:120` | text | `--fs-surface` | 15.12:1 | 1.05:1 | selecting a goal makes its description invisible |
| `src/pages/onboarding/steps/GoalsStep.tsx:87` | fill (icon box) | `--fs-surface` | 15.12:1 | 1.05:1 | selected icon box disappears |
| `src/pages/templates/components/TemplateCard.tsx:228` | icon fill | `--fs-surface` | 15.12:1 | 1.05:1 | favourite star invisible |
| `src/pages/templates/components/TemplateCard.tsx:229` | icon colour | `--fs-surface` | 15.12:1 | 1.05:1 | star outline invisible in **both** states (no-op ternary) |
| `src/pages/templates/components/TemplateCard.tsx:254` | text | `--fs-surface` | 15.12:1 | 1.05:1 | delete chip label invisible |
| `src/pages/templates/components/TemplateCard.tsx:223` | border (spinner) | `--fs-surface` | 15.12:1 | 1.05:1 | favouriting spinner invisible |
| `src/pages/settings/sections/ThemeSection.tsx:50` | fill (icon box) | `--fs-surface` | 15.12:1 | 1.05:1 | the dark-mode row's own icon box vanishes in dark mode |
| `src/pages/settings/sections/ThemeSection.tsx:51` | border | `--fs-surface` | 15.12:1 | 1.05:1 | same box |
| `src/pages/settings/sections/WorkoutPrefsSection.tsx:65` | fill (segment) | `--fs-surface` | 15.12:1 | 1.05:1 | active segment pill gone; only mint text |
| `src/components/workout/overlays/SettingsPrimitives.tsx:399` | fill (segment) | `--fs-surface` | 15.12:1 | 1.05:1 | same shape |
| `src/components/workout/overlays/SettingsPrimitives.tsx:401` | border (segment) | `--fs-surface` | 15.12:1 | 1.05:1 | same |
| `src/components/workout/states/WorkoutPlanScreen.tsx:445` | text | parent surface | 15.12:1 | 1.05:1 | "add exercise" affordance invisible |
| `src/components/workout/states/WorkoutPlanScreen.tsx:446` | border (dashed 40%) | parent surface | ~4:1 | **~1.02:1** | same element, worse |
| `src/pages/coach/client/WeekGrid.tsx:38` | bar fill | card surface | 15.12:1 | 1.05:1 | calorie bar disappears (data viz) |
| `src/pages/coach/client/WeekGrid.tsx:39` | bar fill | card surface | 15.12:1 | 1.05:1 | same |
| `src/pages/workout-detail/MuscleBreakdown.tsx:27` | bar fill (palette slot 5) | card surface | 15.12:1 | 1.05:1 | one muscle group's bar disappears |
| `src/components/ui/AnimatedProgressRing.tsx:92` | confetti fill (slot 6) | page | 13.48:1 | 1.06:1 | black confetti on black |
| `src/components/ui/EmptyState.tsx:37` | SVG gradient stop / fill ×5 | illustration | 13.48:1 | 1.06:1 | empty-state art loses a stop |
| `src/components/workout/components/InlineRestTimer.tsx:249` | SVG fill (`--fs-rubber`) | `--fs-surface` | **18.49:1** | **1.08:1** | rest-timer ring track disappears |
| `src/styles/global.css:309` | fill | `.tab-item` strip on surface | 15.12:1 | 1.05:1 | **live** (`Nutrition.tsx:214`) — active tab pill gone |
| `src/styles/components.css:1108` | fill | `.tab-row` bg = `--fs-surface-2` | 11.84:1 | 1.31:1 | **live** (`NumpadOverlay.tsx:685`, `WorkoutSummary.tsx:710`) |
| `src/styles/global.css:122` | border | `.card-outlined` on `--fs-surface` | 15.12:1 | 1.05:1 | latent (no consumer) |
| `src/styles/global.css:130` | border | `.card-interactive` on `--fs-surface` | 15.12:1 | 1.05:1 | latent (no consumer) |
| `src/styles/global.css:594` | text-gradient stop | `.text-gradient` | see note | see note | latent; both stops fail — light end `#dbe6e3` on white, dark end `#0a0a0a` on black |
| `src/styles/components.css:1148` | fill | `.day-cell.done` | 11.84:1 | 1.31:1 | **bug #1's original rule, still present** — only inert because `WeeklyGrid.tsx` inline-overrides it |
| `src/styles/components.css:611` | fill | `.chip-fs.active` | 15.12:1 | 1.05:1 | latent (no consumer) |
| `src/styles/components.css:613` | border | `.chip-fs.active` | 15.12:1 | 1.05:1 | latent |
| `src/styles/components.css:718` | fill | `.btn-primary-fs` | 15.12:1 | 1.05:1 | latent — **bug #3's exact shape**, waiting for its first consumer |
| `src/styles/components.css:1321` | fill (tick texture, 14%) | `--fs-surface-2` | ~1.6:1 | ~1.1:1 | **live** — progress-track ticks fade out |

### 2.1 — `Button.tsx:66-67`, the blocker

This is the app's shared `Button`, `variant="primary"`. Resting state is correct
(`--btn-primary-bg` / `--btn-primary-text`, which invert properly). Hover and
active override the background with `--color-primary-hover`:

- **Light:** rest `#16292d` → press `#0d1a1c`. A slightly deeper navy. Correct.
- **Dark:** rest `#4ddcbb` (bright mint) → press `#050505` (near-black). The ink
  stays `--btn-primary-text` = `#071412`. Pressed contrast: **1.08:1.**

So in Obsidian, pressing any primary button in the app turns it from a bright mint
pill into a near-black rectangle with near-black text — illegible for the duration
of the press. This is the same defect as bug #3, one indirection deeper, and it is
in the shared component rather than one screen.

**There is no existing token for this.** `--btn-primary-bg` has no `-hover`
sibling. `--color-secondary-hover` (`#35b392` light / `#3fc9a8` dark) is the
closest existing pair that inverts correctly, but it is mint in *both* themes and
would change the light-mode look. Correct fix is a new
`--btn-primary-bg-hover` defined next to `--btn-primary-bg`
(light `--navy-deep`, dark `#3fc9a8`). **Flagged for the lead — I am not inventing
a token in an audit.**

---

## 4. Band B — broken structure (borders)

**92 border uses.** Every one resolves to a row of the §1 table; there is no
per-site variation to measure, so they are listed as `file:line` grouped by file
rather than re-measured individually.

Ratios: border on `--fs-surface` → **15.12:1 light / 1.05:1 dark**; on
`--fs-surface-2` → **11.84:1 light / 1.31:1 dark**.

Effect: in Obsidian the app's entire 2px editorial border language disappears.
Cards, inputs, steppers, chart frames and dividers lose their edges, and the
"sharp corners + heavy rule" identity collapses into flat dark blocks.

The replacement is `--color-border-strong` in every case — `global.css:410`
already documents this decision for `.data-strip`.

| File | Border lines |
|---|---|
| `src/components/ui/WorkoutSkeletons.tsx` | 103, 134, 245, 257, 262, 325, 360, 406, 449 |
| `src/components/workout/reorder/SetEditRow.tsx` | 69, 128, 153, 176, 216, 241, 264, 287, 306 |
| `src/components/workout/overlays/NumpadOverlay.tsx` | 195, 267, 287, 348, 378, 601, 805 |
| `src/components/workout/components/SetEditBottomSheet.tsx` | 31, 128, 190, 251, 321, 341 |
| `src/components/workout/QuickExerciseForm.tsx` | 109, 146, 158, 183, 210, 331 |
| `src/components/workout/WorkoutCalendar.tsx` | 174, 221, 377, 385, 393, 405 |
| `src/components/ui/LoadingSpinner.tsx` | 37, 38, 242, 316, 317 |
| `src/components/workout/reorder/ExerciseReorderItem.tsx` | 98, 161, 290, 320, 351 |
| `src/components/workout/overlays/ConfirmExitOverlay.tsx` | 123, 204, 210, 238 |
| `src/components/workout/overlays/SettingsPrimitives.tsx` | 162, 284, 333 |
| `src/components/workout/WorkoutGoalSelector.tsx` | 40, 78 |
| `src/components/workout/WorkoutSummary.tsx` | 948, 1014 |
| `src/components/ui/PremiumSelect.tsx` | 128, 178 |
| `src/components/workout/states/WorkoutPlanScreen.tsx` | 275 |
| `src/components/workout/states/PreWorkoutScreen.tsx` | 710 |
| `src/components/workout/components/SupersetPicker.tsx` | 263 |
| `src/components/workout/components/DraftConflictDialog.tsx` | 55 |
| `src/components/workout/components/StatsGrid.tsx` | 312 |
| `src/components/workout/overlays/WorkoutSettingsOverlay.tsx` | 115 |
| `src/components/workout/ExerciseReorder.tsx` | 270 |
| `src/pages/nutrition/components/MacroStrip.tsx` | 121, 140 |
| `src/pages/nutrition/components/NutritionTrendChart.tsx` | 38, 89 |
| `src/pages/nutrition/components/WaterHistoryChart.tsx` | 23, 56 |
| `src/pages/Nutrition.tsx` | 185, 317 |
| `src/pages/settings/sections/ExportSection.tsx` | 242 |

*(Band A already lists the borders in `ToggleSwitch`, `SettingsToggle`,
`ThemeSection`, `TemplateCard`, `SettingsPrimitives:401`, `AppRouter`,
`WorkoutPlanScreen:446` and the two `global.css` card rules, and does not repeat
them here.)*

---

## 5. Band C — degraded, not broken: the "deliberately dark chrome" fills

~40 fills paint a **masthead / overlay header / dark hero** that is meant to be a
dark block in both themes, and pair it with `--color-ink-on-dark` (`#ffffff` →
`#f0f0f0`) or a literal `#fff`.

- **Text legibility is fine in both themes** — the ink token flips correctly.
  `#f0f0f0` on `#0a0a0a` is 18.4:1.
- **What is lost is the block's boundary.** In Obsidian, `#0a0a0a` chrome against
  `#000000` page (**1.06:1**) or a `#111111` sheet (**1.05:1**) has no visible
  edge. The app's whole "dark masthead over light body" idiom — which is its
  visual signature in Fresh Steel — flattens into one undifferentiated black
  field. It is a design-identity and spatial-orientation regression, not an
  unreadable-text bug.

These should be fixed **differently** from Band A: keep the dark fill, add a
`--fs-border-on-dark` hairline or step the chrome to `--fs-surface` so it reads
against `--fs-bg`. Do not swap them to `--nav-pill-bg`, which would turn every
masthead mint in dark mode.

Representative sites (verified by reading the call site): `global.css:316`
(`.masthead`, live via `WorkoutGoalSelector.tsx:45`), `global.css:343`
(`.chapter-break`, live via `PreWorkoutScreen.tsx:279` and
`WarmupCooldownSelectionStep.tsx:47`), `components.css:1738`, `1739`
(`.premium-dark-surface`, live via `WorkoutSummary.tsx:600`),
`WarmupCooldownFlow.tsx:156`, `WarmupCooldownActiveStep.tsx:63`,
`WarmupCooldownSelectionStep.tsx:42`, `WorkoutPlanScreen.tsx:194`,
`PreWorkoutScreen.tsx:272`, `NumpadOverlay.tsx:609`, `ConfirmExitOverlay.tsx:132`,
`DraftConflictDialog.tsx:64`, `WorkoutSettingsOverlay.tsx:139`,
`SupersetPicker.tsx:118`, `ExerciseReorder.tsx:301`, `ExerciseSelector/index.tsx:236`,
`WelcomeGuideSheet.tsx:150`, `ProfileAvatar.tsx:13`, `Login.tsx:142`,
`CoachMessages.tsx:76`, `CommunityFeed.tsx:126`, `CoachHome.tsx:148`,
`CoachClients.tsx:170`, `ClientDetail.tsx:79`, `CoachPrograms.tsx:63`,
`GroupThread.tsx:510`, `MessageThread.tsx:410`, `WelcomeStep.tsx:15`, `100`,
`ChoiceStep.tsx:96`, `154`, `185`, `CompleteStep.tsx:92`, `OnboardingFlow.tsx:418`,
`WorkoutSkeletons.tsx:162`, `166`, `183`, `WorkoutHeader.tsx:261`,
`components.css:1341` (`.fs-brand-icon`), `components.css:626`, `627`
(`.hero-card`, latent).

**Which of these are truly "intended dark chrome" versus a card fill that should
have flipped, I could not determine for all of them without rendering.** See §6.

---

## 6. Safe uses — counted, not enumerated

**14 safe sites.**

| Role | Count | Why safe |
|---|---|---|
| text / icon colour on a `--fs-accent` fill | 10 | 7.16:1 light / 11.57:1 dark — both clear AA. `--fs-accent` stays mid-bright in both themes, so it and `--fs-primary` move together. |
| text / icon colour on a `--fs-signal` fill | 3 | 13.15:1 light / 17.23:1 dark. `--fs-signal` is `#e2fb70` in **both** themes. |
| fill used as a scrim | 1 | `ModalOverlay.tsx:333` — a scrim's job is to darken; `#0a0a0a` darkens more than `#16292d`. Correct in both. Would be tidier as `--color-scrim`, which already exists. |

*(For the record, the ten accent-backed sites are `WorkoutCalendar.tsx:331`,
`ExerciseReorderItem.tsx:155`, `289`, `WorkoutSummary.tsx:1031`, `1046`, `1059`,
`WorkoutPlanScreen.tsx:289`, `ExerciseReorder.tsx:347`, `Button.tsx:419`,
`WeekGrid.tsx:179`, `IconBox.tsx:20` — plus `WorkoutSummary.tsx:673`,
`PRCelebrationBanner.tsx:72` on signal. Canonically these should use
`--color-ink-on-accent` / `--color-on-mustard`, but they are not bugs.)*

---

## 7. Prioritized fix list, grouped for exclusive ownership

Grouped by file or directory so no two tasks touch the same file.

### P0 — blocker, shared component

**Task A · `src/components/ui/Button.tsx`** (+ a token addition in
`src/styles/tokens.css`)
Lines 66, 67. Pressed/hovered primary CTA is 1.08:1 in dark across the whole app.
**Replacement token: does not exist.** Needs a new `--btn-primary-bg-hover` pair
(light `--navy-deep`, dark `#3fc9a8` — the value `--color-secondary-hover` already
uses). *Token work touches `tokens.css`, so this task must own that file too, or
be split with the lead's sign-off.*

### P1 — controls whose state becomes unreadable

**Task B · `src/components/ui/` toggles** — `ToggleSwitch.tsx` (126, 142, 159),
`SettingsToggle.tsx` (58, 70).
Knob → `--nav-pill-bg`; track border → `--color-border-strong`; label →
`--fs-heading`.

**Task C · `src/components/ui/` loaders + selects** — `PremiumSelect.tsx`
(128, 178, 201), `LoadingSpinner.tsx` (37, 38, 68, 90, 137, 177, 207, 242, 316,
317), `AnimatedProgressRing.tsx` (92), `EmptyState.tsx` (37), `BottomNav.tsx`
(247), `SmoothLoader.tsx` (209), `ProfileAvatar.tsx` (13), `ModalOverlay.tsx`
(333 — leave, or move to `--color-scrim`), `WorkoutSkeletons.tsx` (15 sites).
Borders → `--color-border-strong`; selected text → `--fs-heading`; spinner
strokes → `--color-border-strong`. `BottomNav.tsx:247` is the inverse case: a
focus-ring **offset** must *match* the bar, so it is wrong in **light** and right
in dark — use `--nav-bg`.

**Task D · `src/AppRouter.tsx` + `src/errors/RootErrorBoundary.tsx` +
`src/contexts/PageThemeContext.tsx`**
`AppRouter.tsx:939` spinner border → `--color-border-strong`.
`RootErrorBoundary.tsx:115` fill → `--btn-primary-bg` / `--btn-primary-text`
(keep the literal fallback).
`PageThemeContext.tsx` `settings.primary` — **not determined**, see §8.

### P2 — selection state on settings and templates

**Task E · `src/pages/settings/`** — `ThemeSection.tsx` (50, 51),
`WorkoutPrefsSection.tsx` (65), `ExportSection.tsx` (242), `IconBox.tsx` (20 —
safe, optionally canonicalize to `--color-ink-on-accent`).
Active segment / icon box fill → `--nav-pill-bg` + `--nav-pill-text`; borders →
`--color-border-strong`.

**Task F · `src/pages/templates/components/TemplateCard.tsx`** — 223, 228, 229, 254.
Star fill + colour and the delete-chip text → `--fs-heading`; spinner border →
`--color-border-strong`. Also fix the no-op ternary at 229.

**Task G · `src/components/workout/overlays/SettingsPrimitives.tsx`** — 162, 284,
333, 399, 401. Active chip → `--nav-pill-bg` / `--nav-pill-text`; borders →
`--color-border-strong`.

### P3 — data visualisation that vanishes

**Task H · `src/pages/coach/client/WeekGrid.tsx`** — 38, 39 (bar fill →
`--nav-pill-bg` or `--fs-accent-2`), 179 (safe).

**Task I · `src/pages/workout-detail/MuscleBreakdown.tsx`** — 27. Palette slot 5
→ a token that is visible on a dark card (`--fs-accent-2`, `--fs-steel`).

**Task J · `src/components/workout/components/InlineRestTimer.tsx`** — 249.
`--fs-rubber` → `--fs-surface-2` (the ring track's job is to be a quiet step
above the card, which is exactly what `--fs-surface-2` does in both themes).

### P4 — stylesheets: live rules

**Task K · `src/styles/global.css`** — 122, 130 (card borders →
`--color-border-strong`), 309 (`.tab-item.active` fill → `--nav-pill-bg` +
`--nav-pill-text`; **live** via `Nutrition.tsx:214`), 316, 343 (Band C chrome —
add a `--fs-border-on-dark` edge, keep the fill), 594 (`.text-gradient`, latent).

**Task L · `src/styles/components.css`** — 1108 (`.tab-row .tab.active` fill →
`--nav-pill-bg` + `--nav-pill-text`; **live**), 1321 (tick texture →
`--color-border` so it survives dark), 1148 (`.day-cell.done` — align the rule
with the `WeeklyGrid.tsx` inline fix so the next consumer does not regress),
611/613/718 (latent: `.chip-fs.active`, `.btn-primary-fs` — fix or delete),
367 (`.toggle-switch` — see §8), 626/627/1341/1738/1739 (Band C).

### P5 — the 92 borders, by directory

Each is a mechanical `--fs-primary` → `--color-border-strong` swap on a border
property. Split by directory so tasks stay file-exclusive:

**Task M ·** `src/components/workout/reorder/` (`SetEditRow.tsx`,
`ExerciseReorderItem.tsx`)
**Task N ·** `src/components/workout/overlays/` (`NumpadOverlay.tsx`,
`ConfirmExitOverlay.tsx`, `WorkoutSettingsOverlay.tsx`)
**Task O ·** `src/components/workout/components/` (`SetEditBottomSheet.tsx`,
`SupersetPicker.tsx`, `DraftConflictDialog.tsx`, `StatsGrid.tsx`)
**Task P ·** `src/components/workout/` top level (`QuickExerciseForm.tsx`,
`WorkoutCalendar.tsx`, `WorkoutGoalSelector.tsx`, `WorkoutSummary.tsx`,
`ExerciseReorder.tsx`)
**Task Q ·** `src/components/workout/states/` (`WorkoutPlanScreen.tsx`,
`PreWorkoutScreen.tsx`)
**Task R ·** `src/pages/nutrition/` + `src/pages/Nutrition.tsx`
**Task S ·** `src/pages/coach/` fills (`MyCoach.tsx` 367/577/753/947,
`CoachClients.tsx`, `CoachHome.tsx`, `GroupThread.tsx`, `MessageThread.tsx`,
`rosterPrimitives.tsx`, `CoachGroups.tsx`, `_shared.tsx`, `RemindersBox.tsx`,
`PhotoTimeline.tsx`, `ClientDetail.tsx`, `CoachPrograms.tsx`, `CoachMessages.tsx`)
— selection fills → `--nav-pill-bg`; message bubbles are Band C.
**Task T ·** `src/pages/onboarding/` + `src/pages/login/` (`GoalsStep.tsx`,
`WelcomeStep.tsx`, `CompleteStep.tsx`, `ProgressDots.tsx`, `OnboardingFlow.tsx`,
`ChoiceStep.tsx`)
**Task U ·** `src/pages/progress/` + `src/pages/Dashboard.tsx` +
`src/pages/community/CommunityFeed.tsx` (`AddRecoveryModal.tsx`,
`AddWeightModal.tsx`, `WeightSection.tsx`)

### P6 — latent, no consumer today

`.btn-primary-fs`, `.chip-fs`, `.card-outlined`, `.card-interactive`,
`.hero-card`, `.text-gradient`, `.toggle-switch`/`.toggle-track` and
`.day-cell.done` have **no consumers in `src/`** — I checked every file type in
the repo, and the only other hits are `mockups/design-preview-palettes.html`,
`docs/DESIGN_SYSTEM.md` and `DESIGN.md`.

The most dangerous latent one: **`components.css:367`**,
`.toggle-switch input:checked + .toggle-track { background-color: var(--color-primary) }`.
The unchecked track is `--color-surface-input`, which is `#0a0a0a` in dark — the
same value `--color-primary` resolves to. **Checked and unchecked would render
identically: 1.00:1.** Fix or delete before anyone adopts the class.

---

## 8. Not determined

Said plainly, no guessing:

1. **Which of the ~40 Band C fills are intentional dark chrome and which are cards
   that should flip.** I verified the call site for every one listed, and the
   named mastheads/`chapter-break`/`premium-dark-surface` cases are clearly
   intentional (they pair with `--color-ink-on-dark` and carry comments saying
   so). For the coach message bubbles (`GroupThread.tsx:368`,
   `MessageThread.tsx:541`), `PhotoTimeline.tsx:80`, `MyCoach.tsx:367`/`947`,
   `rosterPrimitives.tsx:277`/`480`, `PlanSetRow.tsx:164`,
   `SlideToComplete.tsx:357`, `BarcodeScanner.tsx:196`, `FoodLibrary.tsx:221`,
   `MealPresetCard.tsx:100`, `GoalsEditor.tsx:171`/`214`, `Dashboard.tsx:294`,
   `WeightSection.tsx:180`, `AddMealModal.tsx:114`, `AddWeightModal.tsx:187`,
   `AddRecoveryModal.tsx:171`, `ProgressDots.tsx:62`, `CoachGroups.tsx:122`,
   `_shared.tsx:251`, `RemindersBox.tsx:60`, `PhotoTimeline.tsx:302`,
   `ConfirmExitOverlay.tsx:363`/`397`, `PreWorkoutScreen.tsx:558`,
   **I could not tell from the source whether the intent is "dark chrome" or
   "prominent selected fill"** without seeing them rendered. They are all
   1.05–1.31:1 in dark either way; what differs is the correct replacement
   (`--nav-pill-bg` vs. keep-and-add-an-edge). A visual pass will settle it in
   minutes and I could not run one.

2. **`src/contexts/PageThemeContext.tsx` — `settings.primary: 'var(--fs-primary)'`.**
   This is a theme map consumed indirectly. I did not trace every consumer of
   `PageTheme.primary`, so I cannot say whether it lands on a fill, a border or
   text. **Not determined.** Trace it before changing it.

3. **`src/components/workout/components/WorkoutHeader.tsx:261`.** The
   `--fs-primary` sits inside a multi-line `background` value; I read the block and
   it is a radial-gradient base under a `--fs-steel` ring, so the ring likely
   preserves the shape in dark. I did not measure the composited result of the
   gradient over the ring, so the severity is estimated, not measured.

4. **Perceived rather than computed severity.** Every number here is arithmetic on
   resolved hexes. I did not verify a single one on screen, at 390px or otherwise,
   because the browser was held by another agent. Anything involving opacity
   stacking, `backdrop-filter`, `color-mix` over translucency, or a gradient
   composite (`components.css:1321`, `WorkoutPlanScreen.tsx:446`,
   `ExerciseSelector/index.tsx:236`, `PhotoTimeline.tsx:80`,
   `ModalOverlay.tsx:333`) is an estimate and marked `~`.

5. **RTL, 390px overflow, keyboard and a11y** were out of scope for this audit and
   were not examined.

---

## 9. Where I stopped

Complete, in the required order: token values → `tokens.css` siblings →
`global.css` → `components.css` → `src/components` → `src/pages` → the three
remaining root files. All 249 occurrences are accounted for (11 definitions,
10 comments, 228 paint sites). Nothing was left unread.

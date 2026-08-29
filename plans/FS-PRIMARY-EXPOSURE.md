# `--fs-primary` — real exposure, measured in all four theme states

**Supersedes `plans/TOKEN-POLARITY-AUDIT.md`.** Every figure below was re-derived from the token
graph; nothing was inherited from that document. Read-only audit — no code was changed.

**Inventory (reconciled, not estimated):** `var(--fs-primary)` appears **223 times across 83 files**
under `src/`. Of those, 9 are the token's own definitions/aliases in `tokens.css`, 1 is a comment in
`components.css`, and 2 are comments in a test file — leaving **211 live paint sites in 81 files**.
(Outside `src/`: 43 further hits in `plans/`, `reports/`, `docs/`, `mockups/`, `tailwind.config.js` —
prose and a mockup, no runtime effect.)

**Headline:** the defect is invisible to any text-contrast audit. Where `--fs-primary` fills a
control, the *label on that fill* passes in all four states (7.16:1 – 17.37:1) because the ink beside
it is `--fs-accent` or `--color-ink-on-dark`. What fails is the **fill and border against their
surroundings** — 1.05:1 in dark, 1.06:1 in dark+HC, 1.39:1 in light+HC. The app is legible and
shapeless.

---

## 1. Method, and proof it reproduces this repo's own numbers

**Luminance formula (WCAG 2.x, sRGB).** For each channel, `cs = c/255`; `clin = cs/12.92` if
`cs <= 0.03928`, else `clin = ((cs + 0.055)/1.055)^2.4`. Then
`L = 0.2126·Rlin + 0.7152·Glin + 0.0722·Blin`, and `ratio = (Llighter + 0.05)/(Ldarker + 0.05)`.

Alpha values (`rgba(255,255,255,α)`) are composited onto the named backdrop first
(`out = α·fg + (1-α)·bg`), then measured — a translucent colour has no luminance of its own.

**Reproductions.** Four figures this repository already publishes:

| Published | Where | My arithmetic | Match |
|---|---|---|---|
| `--fs-primary` L = 0.019452 | `plans/TOKEN-POLARITY-AUDIT.md:36` | `#16292d` → Rlin 0.0080242, Glin 0.0221765, Blin 0.0262231 → **L = 0.019460** | ✓ (5th dp rounding) |
| `--fs-primary` dark L = 0.003035 | same line | `#0a0a0a` → 10/255 = 0.039216 ≤ 0.03928, so linear branch: 0.039216/12.92 → **L = 0.0030353** | ✓ exact |
| 15.12:1, `#fff` on `#16292d` | `TOKEN-POLARITY-AUDIT.md:30`, `THEME-AXES-PROBE.md:43` | (1.0+0.05)/(0.019460+0.05) = 1.05/0.069460 = **15.117** | ✓ |
| 11.83:1, `#16292d` on `#dbe6e3` | `TOKEN-POLARITY-AUDIT.md:28` | L(`#dbe6e3`) = 0.771999 → 0.821999/0.069460 = **11.834** | ✓ |
| 1.31:1, `#0a0a0a` on `#262626` | `TOKEN-POLARITY-AUDIT.md:29`, `CREW-BOARD.md:1020` | L(`#262626`) = 0.019411 → 0.069411/0.053035 = **1.3087** | ✓ |
| 1.39:1, `#16292d` on black | `CREW-BOARD.md:1413` | 0.069460/0.05 = **1.3892** | ✓ |

The method reproduces every published figure. Proceeding.

**Cross-check against sampled pixels.** `visual-qa/tokens-light.json`, `tokens-dark.json`,
`tokens-light-hc.json`, `tokens-dark-hc.json` confirm my cascade resolution exactly — e.g.
`--fs-surface` = `#ffffff` / `#111111` / `#000000` / `#000000` and `--btn-primary-bg` = `#16292d` /
`#4ddcbb` / `#8efad8` / `#8efad8` across the four states. **None of the four files samples
`--fs-primary` itself**, which is precisely why it survived the sampling pass. (`_summary.json`
ignored as instructed.)

**Cascade rule applied.** `html.dark` (`tokens.css:381`) and `html.high-contrast` (`:587`) have
identical specificity and no combined selector; HC is later in the file, so per token: **HC wins if
it declares it, else dark's value survives, else light's.** HC never declares `--fs-primary`, so it
is `#16292d` in light+HC and `#0a0a0a` in dark+HC. HC *does* repoint `--nav-pill-bg`,
`--btn-primary-bg` and `--btn-primary-text` to the accent — so the two semantic pairs are already
fixed, and **the 211 raw references bypass that fix entirely.** That is the whole bug.

**Resolved values used throughout:**

| Token | light | dark | light+HC | dark+HC |
|---|---|---|---|---|
| `--fs-primary` | `#16292d` (L .019460) | `#0a0a0a` (.0030353) | `#16292d` | `#0a0a0a` |
| `--fs-surface` | `#ffffff` (1.0) | `#111111` (.005605) | `#000000` (0) | `#000000` |
| `--fs-surface-2` | `#dbe6e3` (.771999) | `#262626` (.019411) | `#111111` (.005605) | `#111111` |
| `--fs-bg` | `#eef3f1` (.886208) | `#000000` | `#000000` | `#000000` |
| `--fs-accent` | `#43c7a5` (.447576) | `#4ddcbb` (.563512) | `#8efad8` (.790588) | `#8efad8` |
| `--fs-signal` | `#e2fb70` (.863190) | `#e2fb70` | `#e2fb70` | `#e2fb70` |
| `--fs-heading` | `#16292d` | `#f0f0f0` (.871372) | `#ffffff` | `#ffffff` |

---

## 2. Floors, and how I avoided the label trap

| Floor | Applied to | Why |
|---|---|---|
| **4.5:1** (WCAG 1.4.3) | `--fs-primary` used as `color` / `stroke` on text, and every label sitting **on** an `--fs-primary` fill | All such text is 9–16px — below the 18.66px-bold / 24px large-text threshold, so no exemption |
| **3:1** (WCAG 1.4.11) | Fills and borders that bound an **interactive control**, indicate a **selected/active state**, or are a **graphic conveying status** (spinner, chart bar, step dot, icon stroke) | Non-text contrast for UI components and meaningful graphics |
| **no WCAG floor** | Decorative chrome (masthead/hero bands, full-screen dark panels), skeleton placeholders, illustration linework, texture gradients | Nothing is identified or read from these; judged against design intent instead → **DEGRADED**, never BROKEN |

**The label trap, resolved explicitly.** For every fill I scored at 3:1 I checked the same style
object and its children for a text label. Every label I found on an `--fs-primary` fill uses
`--fs-accent` or `--color-ink-on-dark`, and passes 4.5:1 in all four states:

- accent ink on the fill: **7.16 / 11.57 / 12.10 / 15.85** (light / dark / L+HC / D+HC)
- `--color-ink-on-dark` on the fill: **15.12 / 17.37 / 15.12 / 17.37**

So no site converts from "passes at 3:1" to "fails at 4.5:1". The conversion runs the *other* way —
the fill fails 3:1 while its label passes 4.5:1 — which is exactly why a text-only pass reported
this token clean.

**One residual per-site check the workers must run** (I verified it only at the sites I read):
a fill of `--fs-primary` whose own text uses **`--fs-heading`** is a 1.00:1 collision in light,
because `--fs-heading` *is* `--fs-primary` there (`tokens.css:95`). The mirror-image bug is already
documented as real 9 times over in `plans/fix-batches/hebrew-copy-contrast.md` (accent fill +
`--fs-heading` ink). It is a one-line check per site: *does this element's own label use
`--fs-heading`?* I found none in the sites I opened; I am not claiming a clean sweep of all 211.

---

## 3. Measurement classes

Every site maps to one of these. The four ratios are properties of the (role, surface) pair, so they
are measured once here and applied by reference — this is what makes 211 sites auditable.

| Class | Role · surface | light | dark | light+HC | dark+HC | Floor | Verdict |
|---|---|---|---|---|---|---|---|
| **A** | FILL or BORDER vs `--fs-surface` (card) | 15.12 | **1.05** | **1.39** | **1.06** | 3:1 | fails 3 of 4 |
| **B** | FILL or BORDER vs `--fs-surface-2` (elevated / track) | 11.83 | **1.31** | **1.25** | **1.05** | 3:1 | fails 3 of 4 |
| **C** | FILL or BORDER vs `--fs-bg` (page) | 13.48 | **1.06** | **1.39** | **1.06** | 3:1 | fails 3 of 4 |
| **H** | INK / `stroke` on `--fs-surface` | 15.12 | **1.05** | **1.39** | **1.06** | 4.5:1 | fails 3 of 4 |
| **H2** | INK / `stroke` on `--fs-surface-2` | 11.83 | **1.31** | **1.25** | **1.05** | 4.5:1 | fails 3 of 4 |
| **F** | INK or graphic **on `--fs-accent`** | 7.16 | 11.57 | 12.10 | 15.85 | 4.5:1 | **passes all 4 — SAFE** |
| **G** | INK or graphic **on `--fs-signal`** | 13.15 | 17.22 | 13.15 | 17.22 | 4.5:1 | **passes all 4 — SAFE** |
| **I** | The label **on** an `--fs-primary` fill (accent ink) | 7.16 | 11.57 | 12.10 | 15.85 | 4.5:1 | **passes all 4 — SAFE** |

Worked example, class A dark: fill `#0a0a0a` (L .0030353) on card `#111111` (L .005605) →
(0.055605)/(0.053035) = **1.048**. Class B light+HC: `#16292d` (.019460) on `#111111` (.005605) →
(0.069460)/(0.055605) = **1.249**.

Classes F and G are the only genuinely safe roles: their backing fill is bright in **all four**
states, so near-black ink is correct everywhere. That is the precise sense in which "text on a
surface that flips alongside it is fine" — it is not the ink that flips, it is that the fill never
goes dark.

---

## 4. Verdict counts

| | Sites | Files |
|---|---|---|
| **BROKEN** | 118 | 63 |
| **DEGRADED** | 78 | 27 |
| **SAFE** | 13 | 10 |
| Token definitions (`tokens.css`) | 9 | 1 |
| Comments, no paint | 3 | 2 |
| **Total** | **223** | **83** |

**The 13 SAFE sites, summarised as instructed** — all are class F/G/I or non-painting: near-black ink
or a small graphic sitting on `--fs-accent` or `--fs-signal`, both of which stay bright in every
state, so `--fs-primary` is the *correct* colour there and must not be swept:
`WorkoutCalendar.tsx:331,347,385,393` (day number, dot and two legend swatches on the
signal/accent intensity fills — `getIntensityStyle`, `WorkoutCalendar.tsx:98–110`, returns accent or
signal whenever `count > 0`), `WorkoutSummary.tsx:1031,1046,1059` (three labels on the PR row's
accent fill), `Button.tsx:422`, `settings/components/IconBox.tsx:20`,
`settings/sections/WorkoutPrefsSection.tsx:65` (accent fill + primary ink),
`components/ui/ModalOverlay.tsx:333` (backdrop scrim — near-black in dark is correct),
`styles/components.css:1372` (14%-alpha decorative stripe), `styles/tokens.css:51`
(`--color-on-mustard`, correct by design and DO-NOT-TOUCH).

**A finding about the plumbing, not a site:** HC repointed `--btn-primary-bg` and `--nav-pill-bg`
away from `--fs-primary` but left **`--color-primary` (`tokens.css:68`, `:446`) and `--navy`
(`:41`, `:418`) still aliasing it in all four states.** Any component reaching for `--color-primary`
as a fill has this defect too, without appearing in the 223. Worth a follow-up count.

---

## 5. Recommendations — two new semantic pairs, token untouched

Following the house pattern: **`--fs-primary` does not move.** Brighten it and the lime accent loses
its ink (`--color-on-mustard`); black it out and the light-theme active border goes to 1.00:1. The
pairs that merely alias it get repointed instead — exactly what `html.dark` and `html.high-contrast`
already do for `--btn-primary-bg` / `--nav-pill-bg`.

**Disqualified, re-measured independently:** `--color-border-strong` in dark is
`rgba(255,255,255,0.26)` (`tokens.css:471`) → composites to `#6b6b6b`/`#4f4f4f`/`#5e5e5e` over
`#000`/`#111`/`#262626` → **2.10:1 / 2.30:1 / 2.35:1**. The audit's 2.33:1 sits inside my range; the
disqualification stands on my own arithmetic, and on the page it is worse than published.

**Untouched, by instruction:** `--color-ink-on-accent`, `--fs-signal`, `--color-on-mustard`,
`--color-scrim`.

### `--fs-edge` — for every BORDER and every control fill that must be findable

```css
:root            { --fs-edge: var(--fs-primary); }          /* #16292d — light look unchanged */
html.dark        { --fs-edge: rgba(255, 255, 255, 0.42); }
html.high-contrast { --fs-edge: var(--color-border); }       /* #ffffff */
```

| | light | dark | light+HC | dark+HC |
|---|---|---|---|---|
| vs `--fs-surface` | 15.12 | **4.10** | 21.00 | 21.00 |
| vs `--fs-surface-2` | 11.83 | **3.89** | 18.88 | 18.88 |
| vs `--fs-bg` | 13.48 | **3.95** | 21.00 | 21.00 |

Clears 3:1 in all four states. The dark value is the existing dark border idiom
(`--color-border` .10, `--color-border-strong` .26) raised to the first alpha that clears the floor
on the *elevated* surface — not a new colour concept. Light is byte-identical to today, so no light
regression.

*Alternative if the lead wants the dark edge to read as brand:* `#318d78` = every channel of
`--fs-accent` (`#4ddcbb`) scaled by **0.64**, the factor already in use for the dark ON track —
identical hue and saturation. Measures **4.69 / 3.75 / 5.21** against surface / surface-2 / bg. Both
options are inside the house technique; `0.55` was tested and rejected (2.90:1 on `--fs-surface-2`,
under the floor). No third hue is introduced either way.

### `--fs-panel` — for deliberate dark chrome (mastheads, hero bands, full-bleed dark screens)

```css
:root              { --fs-panel: var(--fs-primary); }        /* #16292d — unchanged */
html.dark          { --fs-panel: var(--fs-surface-2); }      /* #262626 */
html.high-contrast { --fs-panel: var(--fs-surface-2); }      /* #111111 */
```

Ink stays `--color-ink-on-dark`, which already flips (`#ffffff` / `#f0f0f0`): **15.12 / 13.27 /
18.88 / 18.88** — passes 4.5:1 in all four.

Stated plainly: the band itself lands at **1.39:1** (dark) and **1.11:1** (HC) against the page.
That is deliberate — it is the app's own elevation step (`bg → surface → surface-2`), not a boundary
claim, and no WCAG floor applies to a decorative band. If a band must read as a distinct region,
add a 1px `--fs-edge` outline rather than lightening the fill.

### INK sites — no new token needed

Swap `color`/`stroke: var(--fs-primary)` on a surface for **`--fs-heading`**, which already flips
correctly: **15.12 / 16.57 / 21.00 / 21.00** on `--fs-surface`, **11.83 / 13.27 / 18.88 / 18.88** on
`--fs-surface-2`. Light is unchanged (`--fs-heading` *is* `--fs-primary` in light). Hard constraint
carried forward from `tokens.css:94`: **never put `--fs-heading` on an accent or signal fill** —
that is the bug in `plans/fix-batches/hebrew-copy-contrast.md`. On accent/signal fills the correct
ink is `--color-ink-on-accent` (or `--fs-primary`, already SAFE there).

---

## 6. Batches — nine workers, exclusive file ownership, ordered by user impact

No file appears in two batches. **Batch 1 must land first**; batches 2–9 are then fully parallel and
never touch the same file. Counts reconcile: 22+31+34+24+31+21+22+10+26 = 221 sites + 2 comment
lines = 223, across 82 + 1 files = 83.

### Batch 1 — Token plumbing and the global CSS classes · 22 sites, 3 files · **BLOCKING**
`src/styles/tokens.css` (9) · `src/styles/global.css` (6) · `src/styles/components.css` (7)

Highest impact per line in the repo: `.card-outlined` and `.card-interactive` (`global.css:122,130`,
class A) and `.tab-item.active` (`:309`, class A fill, selected state = information) are *classes*,
so they carry unknown further blast radius beyond the 223 counted sites.

One worker: define `--fs-edge` and `--fs-panel` in the three blocks; repoint `.card-outlined`,
`.card-interactive`, `.tab-item.active` to `--fs-edge`; `.masthead` (`:316`, class C, DEGRADED),
`global.css:343` and `:594`, `.hero-card` (`components.css:642,643`), the dotted panel (`:1392`) and
`.premium-dark-surface` (`:1789,1790`) to `--fs-panel`. Leave `components.css:1372` (SAFE) and
`tokens.css:51` (DO-NOT-TOUCH) alone. Do not move `--fs-primary`. `global.css:343` and
`components.css:1789` need one look each to confirm which of the two new tokens applies.

### Batch 2 — Active set-logging · 31 sites, 7 files
`components/workout/reorder/SetEditRow.tsx` (11) · `components/workout/components/SetEditBottomSheet.tsx` (8) ·
`components/workout/overlays/NumpadOverlay.tsx` (8) · `components/workout/components/PlanSetRow.tsx` (1) ·
`components/workout/components/SlideToComplete.tsx` (1) · `components/workout/components/WorkoutHeader.tsx` (1) ·
`components/workout/components/StatsGrid.tsx` (1)

**Worst user impact in the app** — this is the screen a user is holding mid-workout, and it is almost
entirely 2px borders on `--fs-surface`/`--fs-surface-2` (class A/B) around inputs, steppers and the
numpad. In dark every input box, every ± stepper and every numpad key loses its outline (1.05–1.31:1)
while its glyph stays bright: the pad becomes an unstructured field of numbers. Verified surfaces at
`SetEditRow.tsx:69` (on `--fs-surface-2`), `:128,:153` (on `--fs-surface`), `:175/176` (fill + border,
accent ink → fill is BROKEN, label SAFE).

Worker changes: every `border: … var(--fs-primary)` → `--fs-edge`; the `--fs-primary` *fills* on
interactive controls (`SetEditRow.tsx:175,263`, `SetEditBottomSheet.tsx:30,340`,
`NumpadOverlay.tsx:609`) → `--fs-edge` for the border and keep the fill only where the label is
accent ink, else `--fs-panel`. `SlideToComplete.tsx:357` and `WorkoutHeader.tsx:261` are gradients →
`--fs-panel`, DEGRADED.

### Batch 3 — Workout flow chrome and overlays · 34 sites, 13 files
`states/WorkoutPlanScreen.tsx` (5) · `states/PreWorkoutScreen.tsx` (3) · `overlays/ConfirmExitOverlay.tsx` (5) ·
`overlays/WorkoutSettingsOverlay.tsx` (2) · `overlays/SettingsPrimitives.tsx` (5) ·
`components/SupersetPicker.tsx` (3) · `components/DraftConflictDialog.tsx` (2) ·
`components/PRCelebrationBanner.tsx` (2) · `WorkoutGoalSelector.tsx` (2) ·
`WarmupCooldownSelectionStep.tsx` (2) · `WarmupCooldownActiveStep.tsx` (1) · `WarmupCooldownFlow.tsx` (1) ·
`ExerciseSelector/index.tsx` (1)

Mixed: the `background: var(--fs-primary)` screen headers (`WorkoutPlanScreen.tsx:194`,
`PreWorkoutScreen.tsx:272`, `WarmupCooldownSelectionStep.tsx:42`) are class C **DEGRADED** →
`--fs-panel`. The selected-state fills and borders in `SettingsPrimitives.tsx:284,333,399,401`
(`active ? --fs-primary : --fs-steel`) are class A/B **BROKEN** — an active setting is
indistinguishable from an inactive one in dark → `--fs-edge`.

### Batch 4 — Reorder and summary · 24 sites, 4 files
`reorder/ExerciseReorderItem.tsx` (7) · `ExerciseReorder.tsx` (3) · `WorkoutSummary.tsx` (6) ·
`QuickExerciseForm.tsx` (8)

Borders → `--fs-edge`. Note `WorkoutSummary.tsx:1014`: one declaration paints a border over *both*
an accent fill (SAFE) and a `--fs-surface-2` fill (class B, BROKEN) — split the branch, do not blanket
it. `QuickExerciseForm.tsx:307` is `accentColor: var(--fs-primary)` on a native checkbox: in dark the
checked box is near-black on a near-black card, so **checked state is unreadable** — BROKEN, use
`--fs-accent` with `--color-ink-on-accent`. `ExerciseReorderItem.tsx:155` needs one look to confirm
whether its surface is the accent step-circle (SAFE) or the card (BROKEN).

### Batch 5 — Shared UI primitives · 31 sites, 10 files
`ui/WorkoutSkeletons.tsx` (15) · `ui/LoadingSpinner.tsx` (6) · `ui/SmoothLoader.tsx` (1) ·
`ui/PremiumSelect.tsx` (3) · `ui/ModalOverlay.tsx` (1) · `ui/EmptyState.tsx` (1) ·
`ui/ProfileAvatar.tsx` (1) · `ui/AnimatedProgressRing.tsx` (1) · `ui/BottomNav.tsx` (1) · `ui/Button.tsx` (1)

Largest file count of `--fs-primary` in the repo (`WorkoutSkeletons.tsx`, 15) but **all 15 are
DEGRADED, not BROKEN** — transient placeholder blocks and their borders, no information conveyed;
they simply stop reading as a skeleton on dark. Deliberately ranked below batches 2–4 for that
reason. The BROKEN sites here are the loaders: `LoadingSpinner.tsx:68,90,137,242` and
`SmoothLoader.tsx:209` are status graphics at 1.05–1.06:1 in dark — a spinner that cannot be seen is
a lost loading state (3:1). `PremiumSelect.tsx:128,178` are the open-state border of a select
(class A, BROKEN). `Button.tsx:422` and `ModalOverlay.tsx:333` are SAFE — leave them.
`BottomNav.tsx:252` is a `ring-offset` colour (OTHER, cosmetic: a navy halo on a white bar in light);
`EmptyState.tsx:37` and `AnimatedProgressRing.tsx:92` are palette-map entries — resolve the consumer
before swapping.

### Batch 6 — Data visualisation and calendar · 21 sites, 7 files
`components/workout/WorkoutCalendar.tsx` (10) · `pages/nutrition/components/MacroStrip.tsx` (2) ·
`pages/nutrition/components/NutritionTrendChart.tsx` (2) · `pages/nutrition/components/WaterHistoryChart.tsx` (2) ·
`pages/workout-detail/MuscleBreakdown.tsx` (1) · `pages/progress/tabs/WeightSection.tsx` (1) ·
`pages/coach/client/WeekGrid.tsx` (3)

The most surgical batch, because `WorkoutCalendar.tsx` holds both verdicts: 4 SAFE sites (on the
bright intensity fills) and 6 BROKEN (`:174,:221` nav-button borders on transparent-over-card,
`:192,:238` chevron `stroke` — class A graphics at 1.05:1 in dark, so the month arrows disappear —
`:377` the count-0 legend swatch border on `--fs-surface-2`, `:405` the stats separator). A blanket
sweep of this file would destroy the 4 SAFE sites. Chart series colours
(`MuscleBreakdown.tsx:27`, `WeekGrid.tsx:38,39`) are data-bearing graphics: 3:1, BROKEN in dark →
they need a real series colour, not `--fs-edge`.

### Batch 7 — Coach console · 22 sites, 13 files
`pages/MyCoach.tsx` (4) · `pages/coach/CoachHome.tsx` (2) · `CoachClients.tsx` (2) · `GroupThread.tsx` (2) ·
`MessageThread.tsx` (2) · `rosterPrimitives.tsx` (2) · `client/PhotoTimeline.tsx` (2) · `CoachGroups.tsx` (1) ·
`CoachMessages.tsx` (1) · `CoachPrograms.tsx` (1) · `ClientDetail.tsx` (1) · `_shared.tsx` (1) ·
`client/RemindersBox.tsx` (1)

Two repeating shapes. (a) `{ background: --fs-primary, color: --fs-accent }` header pills
(`CoachHome.tsx:148`, `CoachClients.tsx:170`, `GroupThread.tsx:510`, `MessageThread.tsx:410`,
`ClientDetail.tsx:79`, `CoachPrograms.tsx:63`) — class C fill, DEGRADED, label SAFE → `--fs-panel`.
(b) `selected ? --fs-primary : --fs-surface` selection fills (`CoachClients.tsx:209`,
`CoachGroups.tsx:122`, `_shared.tsx:251`, `RemindersBox.tsx:60`, `MyCoach.tsx:582,758`,
`PhotoTimeline.tsx:302`) — class A, **BROKEN**: in dark the selected row is 1.05:1 from the unselected
one, so selection state is lost. These need `--fs-edge` plus a fill that differs from
`--fs-surface`. Chat bubbles (`GroupThread.tsx:368`, `MessageThread.tsx:541`) carry "mine vs theirs"
information — same treatment, not `--fs-panel`.

### Batch 8 — Nutrition and progress modals · 10 sites, 8 files
`pages/Nutrition.tsx` (2) · `pages/nutrition/components/GoalsEditor.tsx` (2) · `AddMealModal.tsx` (1) ·
`BarcodeScanner.tsx` (1) · `FoodLibrary.tsx` (1) · `MealPresetCard.tsx` (1) ·
`pages/progress/modals/AddRecoveryModal.tsx` (1) · `pages/progress/modals/AddWeightModal.tsx` (1)

Mostly enabled/disabled and active/inactive CTA fills (`AddMealModal.tsx:114`,
`AddWeightModal.tsx:187`, `AddRecoveryModal.tsx:171` all switch between `--fs-primary` and
`--fs-surface-2`): class A/B, BROKEN — in dark, `#0a0a0a` vs `#262626` is 1.31:1, so **enabled and
disabled look identical**. This is the one batch where the correct fix is likely
`--btn-primary-bg`/`--btn-primary-text`, which HC and dark already handle, rather than a new token.

### Batch 9 — Onboarding, login, settings, misc · 26 sites, 17 files
`pages/OnboardingFlow.tsx` (1) · `onboarding/steps/GoalsStep.tsx` (3) · `WelcomeStep.tsx` (2) ·
`CompleteStep.tsx` (1) · `onboarding/components/ProgressDots.tsx` (1) · `login/steps/ChoiceStep.tsx` (3) ·
`pages/Login.tsx` (1) · `settings/sections/ThemeSection.tsx` (2) · `WeeklyReportSection.tsx` (1) ·
`WorkoutPrefsSection.tsx` (1) · `settings/components/IconBox.tsx` (1) · `pages/Dashboard.tsx` (1) ·
`community/CommunityFeed.tsx` (1) · `templates/components/TemplateCard.tsx` (4) ·
`guidance/WelcomeGuideSheet.tsx` (1) · `contexts/PageThemeContext.tsx` (1) · `errors/RootErrorBoundary.tsx` (1)

Lowest impact per site but two worth naming. `ProgressDots.tsx:62` — the active step dot is class C,
**BROKEN in dark (1.06:1)**: a first-run user cannot tell which onboarding step they are on.
`TemplateCard.tsx:229` reads
`color: template.isFavorite ? 'var(--fs-primary)' : 'var(--fs-primary)'` — **both branches are
identical**, a latent bug independent of theming; flag it, do not silently "fix" the intent.
`ThemeSection.tsx:56,57` is the theme picker's own swatch — it is *meant* to show the navy, so
confirm intent before swapping. `GoalsStep.tsx:87,120` are selection fill + ink (class B, BROKEN).
`RootErrorBoundary.tsx:115` is DEGRADED chrome, and it carries a literal fallback
(`var(--fs-primary, #16292d)`) that must be preserved — it renders when the token layer may be gone.

### No work
`src/components/ui/__tests__/SettingsToggle.test.tsx:12,13` — two comment lines documenting an
already-fixed instance of this same defect (`1.31:1 on the OFF fill (dark)`, i.e. my class B). Do not
delete or weaken that test.

---

## 7. What I did not cover

- **I did not open all 211 sites.** I read the surfaces at ~40 sites across the heaviest files and
  the ambiguous ones, and assigned the remainder by class from the declaration plus the sibling
  `background` in the same style object. Class assignment fixes the four ratios exactly; what a
  reading could still change is the *surface* at a given site, and therefore which class row applies.
  Six sites are explicitly marked as needing one look: `global.css:343`, `components.css:1789`,
  `ExerciseReorderItem.tsx:155`, `EmptyState.tsx:37`, `AnimatedProgressRing.tsx:92`,
  `PageThemeContext.tsx:64`. `Dashboard.tsx:294` is a 44px badge inside the hero CTA — SAFE (class F,
  7.16:1) if that button is the mint fill, class A BROKEN if it is a card; I could not resolve the
  parent without reading further.
- **Surface drift is the one way these numbers go wrong.** In dark, `--fs-surface` `#111111`,
  `--fs-plate` `#1a1a1a` and `--fs-surface-2` `#262626` give **1.05 / 1.14 / 1.31** for the same
  `#0a0a0a` paint. A figure quoted against the wrong one of those three looks plausible and is
  wrong — which is the failure mode of the superseded audit. Every figure here names its surface.
- **No browser, no build, no test, no gate, no git** — as instructed. Nothing here is verified
  against a rendered pixel except through the four existing `visual-qa/tokens-*.json` samples, and
  those do not sample `--fs-primary`. A screenshot pass over batches 2 and 6 in dark and dark+HC
  would confirm the visual claim cheaply.
- **`--color-primary` / `--navy` exposure is uncounted.** Both still alias `--fs-primary` in all four
  states; components using them have the same defect and are outside the 223.

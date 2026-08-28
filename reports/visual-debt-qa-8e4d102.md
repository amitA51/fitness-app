# Visual-debt QA — three accumulated batches

**Verdict: PASS with 6 findings (0 blocker, 0 high, 3 medium, 3 low).**
No batch introduced a visual regression on any surface I could reach. Every
failure below is a *coverage* gap or pre-existing debt, not a broken intent.

- **Tree under test:** HEAD `8e4d102`, working tree clean except `plans/CREW-BOARD.md`
  at the moment `npm run build` ran and `dist/` was produced.
- **Evidence base:** `dist/` built fresh at the start (host trap: a stale bundle
  fakes regressions). All 68 PNGs come from that bundle.
- **Tree moved mid-run.** By the time the gates ran, other workers had modified
  `src/pages/Progress.tsx`, `src/pages/progress/tabs/RecoveryTab.tsx`,
  `src/pages/progress/tabs/WeightSection.tsx`, `src/pages/progress/useProgressData.ts`,
  `src/services/aiWorkoutInsightService.ts`, `src/styles/components.css`, and added
  `ReadinessReadingCard.*` + `SectionCard.test.tsx`. **My screenshots therefore
  describe `8e4d102`, not the current working tree.** Two of those files
  (`WeightSection.tsx`, `components.css`) back surfaces I photographed; nothing I
  report is attributed to their in-flight edits.
- **Capture rig:** 390×1500 and 1280×1500, `fullPage: false` (the host trap is
  real — the scroller is an inner `MAIN`). Fresh browser context per
  width×theme combo, so `localStorage` and every IndexedDB store start empty;
  theme forced pre-paint via `appSettings.darkMode` so the first frame is correct.
- Raw measurements: `reports/_measure-<combo>.json`, `reports/_gaps-<combo>.json`.

---

## 1. Coverage

| # | Surface | 390 L/D | 1280 L/D | Result |
|---|---------|:---:|:---:|---|
| 1 | ExerciseDetail strength curve — near-flat series | ✓ | ✓ | **PASS** |
| 1 | ExerciseDetail strength curve — steep series | ✓ | ✓ | **PASS** |
| 1 | ForecastChart (behind ExerciseDetail's מתקדם) | ✓ | ✓ | **PASS** |
| 1 | BodyTab weight trend — realistic 2 kg loss | ✓ | ✓ | **PASS** |
| 1 | BodyTab weight trend — 15 kg loss | ✓ | ✓ | **PASS** |
| 1 | Workouts volume trend (behind מתקדם) | ✓ | ✓ | **PASS** |
| 1 | coach MetricsTab / TrainingTab | — | — | **NOT COVERED — F3** |
| 2 | Progress Overview collapsed + expanded | ✓ | ✓ | **PASS** (see note) |
| 2 | Progress Workouts collapsed + expanded | ✓ | ✓ | **PASS** |
| 3 | Recovery sub-score bars N/100 | — | — | **NOT COVERED — excluded tab** |
| 4 | Home week strip trained/rest/empty | ✓ | ✓ | **PASS** |
| 5 | ToggleSwitch ON/OFF | — | — | **NOT COVERED — F1** |
| 5 | SettingsToggle ON/OFF (what actually ships) | ✓ | ✓ | **FAIL — F2** |
| 6 | Pressed primary button | ✓ | ✓ | **PASS** |

Also exercised: console/pageerror capture on every combo, RTL check at 390 on
every surface, keyboard-free interaction only (no a11y sweep — see §4).

### Batch 1 — the shared chart's new y-geometry

The intent holds, and the numbers are proportional rather than binary. Measured
drawn vertical extent of the line path, as a percentage of the chart's inner band:

| Series | Real change | Span floor (10% of mean) | Drawn extent | Reads as |
|---|---|---|---|---|
| e1RM 80.0→80.2 (quantized to 80) | 0% | 8.0 | **0.00%** | flat ✓ |
| Body weight 82.0→80.0 (mean 81) | 2.5% | 8.1 | **24.69%** | gentle real decline ✓ |
| Weekly volume trend | — | — | **87.12%** | fills ✓ |
| e1RM 80→95 (mean 90.4) | 19% | 9.0 | **100.00%** | fills ✓ |
| Body weight 95→80 (mean 87.5) | 18.5% | 8.75 | **100.00%** | fills ✓ |

24.69% is exactly 2.0 ÷ 8.1 — the floor scales the drawing, it does not flatten
it. A dieter's 2 kg still reads as a trend (`debt-bodyweight-real-collapsed-390-light.png`);
a 0.2 kg wobble reads as nothing (`debt-exercisedetail-flat-390-dark.png`).

**Centring verified numerically**, not by eye: in every floored case the drawn
line's mid-y equals the inner band's mid-y — `lineMid 81.00` vs `bandMid 81.00`,
`offCentreByPctOfInner 0.00`. The near-flat curve sits mid-card, not pinned to an edge.

The two y-axis labels on ExerciseDetail stayed truthful for the floored span
(`"84"` / `"76"` for the flat series — the drawn axis, not the data range). See
**F6** for the one input where that rounding degrades.

### Batch 2 — the מתקדם expander

Present in both tabs with identical label, geometry and behaviour, at both widths
and themes. `aria-expanded` flips to `"true"`; children are unmounted while
collapsed. Overview's expander reveals level, consistency, muscle distribution and
the balance insight (`debt-progress-overview-expanded-390-dark.png`); Workouts'
reveals the range control + volume trend (`debt-progress-workouts-expanded-*.png`).

*Note on "three cards":* with my seeded data Overview's top level rendered the
verdict sentence + one KPI card + the expander. The PR board self-hides because
seeding sessions straight into IndexedDB creates no PR records. I could not
confirm the count of three; I saw no defect either.

### Batch 4 — week strip by fill luminance

Measured fill luminance and WCAG contrast between states (my in-page helper
mis-parsed `color(srgb …)`, so these are recomputed by hand from the raw
computed values in the dumps — the ratios reproduce the values in the CSS
comments to within rounding):

| Pair | Light | Dark |
|---|---|---|
| trained vs empty | 13.25:1 | 9.90:1 |
| trained vs rest | 4.33:1 | 3.25:1 |
| rest vs empty | 3.06:1 | 3.05:1 |

Luminance ordering is monotonic and theme-inverting — light: empty 0.870 > rest
0.251 > trained 0.019; dark: trained 0.564 > rest 0.139 > empty 0.012. All three
pairs clear 3:1 on fill alone; the dashed border is now redundant, not
load-bearing. Confirmed visually in `debt-weekstrip-390-light.png` /
`debt-weekstrip-390-dark.png`.

### Batch 6 — pressed primary button

| Theme | Fill | Ink | Pressed | Ink-on-fill |
|---|---|---|---|---|
| dark | `#4ddcbb` mint | `#071412` | `brightness(0.97)` + `scale(0.97)` | ~10.2:1 |
| light | `#16292d` navy | `#43c7a5` | same | 7.16:1 |

No near-black-on-black. `filter: brightness()` scales fill *and* text together,
so the ratio is preserved by construction rather than by luck.
`debt-btn-primary-pressed-390-dark.png`, `debt-btn-primary-rest-390-light.png`.

---

## 2. Findings, worst first

### F1 — `ToggleSwitch` has no mount point; batch 5 is unverifiable in situ
**Severity: medium.** Not user-facing (nobody can reach it), but the batch's claim
cannot be confirmed by photograph, and the component carries ~90 lines of
contrast reasoning that no surface exercises.

**Repro**
1. `grep -r "from '.*ToggleSwitch'" src/` → two hits: its own test, and
   `src/pages/onboarding/components/MobileToggle.tsx`.
2. `grep -r "MobileToggle" src/` → only its own definition and one comment in
   `ToggleSwitch.tsx:68`. No JSX call site anywhere.
3. Load `/settings` and count `input[role="switch"]` → **0**.

**Expected vs actual** — expected the ON/OFF states photographable on a real
screen; actual: `ToggleSwitch` → `MobileToggle` → *nothing*. The `/settings`
switches are a different component (`SettingsToggle`, a `button[role="switch"]`).

**Evidence** — `switchCount: 0` in all four `reports/_measure-*.json`.
**Suspected location** — `src/components/ui/ToggleSwitch.tsx` (orphaned),
`src/pages/onboarding/components/MobileToggle.tsx` (never rendered).

### F2 — the shipping toggle's OFF track has a 1.31:1 boundary in dark
**Severity: medium.** WCAG 1.4.11 asks ≥3:1 of a component boundary. This is the
*same* defect `ToggleSwitch` documents fixing, still live in the sibling that
users actually meet.

**Repro**
1. `/settings` in dark → "תצוגה ונגישות".
2. Inspect an OFF row ("הפחתת אנימציות").
3. Track fill `--fs-surface-2` = `rgb(38,38,38)`; its 2px border `--fs-primary` =
   `rgb(10,10,10)` (both read off the live dark page).

**Expected vs actual** — expected a visible track outline; actual
(0.0194+0.05)/(0.00304+0.05) = **1.31:1**, i.e. no perceivable edge. The pill is
identified only by its grey fill against the card.

**Evidence** — `debt-settingstoggle-state1-390-dark.png` (the two OFF pills below
the mint ON pill read as borderless); `toggleState1.trackBorder: "rgb(10, 10, 10)"`
in `reports/_gaps-390-dark.json`.
**Suspected location** — `src/components/ui/SettingsToggle.tsx:58` —
`border: '2px solid var(--fs-primary)'`. `--fs-primary` does not invert
(`#16292d` → `#0a0a0a`); `--fs-ink` does, which is the fix `ToggleSwitch` already
adopted.

*Caveat:* ON/OFF *state* legibility is fine (mint vs grey ≈ 12:1). I could not
measure the OFF state's label colour in dark — my probe toggled the dark-mode
switch itself, which flipped the theme and confounded the reading. The label was
legible in every screenshot.

### F3 — the two coach chart surfaces are unreachable in this build
**Severity: medium (coverage).** Exactly the two surfaces the brief flagged as
never photographed, and they remain so.

**Repro**
1. No `.env` exists (only `.env.example`) → `isSupabaseConfigured()` is false.
2. `getClientBodyWeight` / `getClientAnalytics` short-circuit to `[]` / `null`
   before any request, so `MetricsTab`'s `TrendChartCard` and `TrainingTab`'s
   never mount (both are gated on data).
3. In guest mode `/coach/clients` redirects to the trainee dashboard.

**Expected vs actual** — expected a client-360 with a weight trend and a 4-week
volume trend; actual: the trainee dashboard.
**Evidence** — `debt-coach-clients-390-light.png` shows "ערב טוב, דנה";
`coachHasClientRow: false` and `coachClientsBody` (dashboard copy) in the dumps.
**Partial mitigation, stated as such:** both coach tabs render the *same*
`TrendChartCard` → `GlowAreaChart` I verified on Progress and Body, so the
geometry is shared code. What is *not* exercised is the coach-specific series
builders (`weightTrendPoints`, 30-point cap; `volumeTrendPoints`, 4 Hebrew week
labels) inside a browser. `clientTrends.ts` has unit coverage; the rendered
composition does not.
**Suspected location** — environmental, not a code defect.

### F4 — invalid `height="auto"` on an `<svg>` logs a console error on Progress
**Severity: low.** Cosmetic + log noise; the map still draws (`viewBox` +
`maxWidth` carry it).

**Repro** 1. `/progress` → סקירה. 2. Expand מתקדם. 3. Console.
**Expected vs actual** — expected a clean console; actual, twice per visit:
`Error: <svg> attribute height: Expected length, "auto".`
`auto` is not a valid SVG length.
**Evidence** — `consoleErrors` in `reports/_measure-390-light.json`.
**Suspected location** — `src/components/fitness/MuscleMap.tsx:93`.
Newly *surfaced* by batch 2: MuscleDistribution now lives inside the expander
users open, rather than always-on.

### F5 — PR markers are uncapped and crowd the curve at 390px
**Severity: low. Pre-existing** — markers were not part of these batches.

**Repro** 1. Log a progressively heavier top set every session (12 sessions).
2. Progress → אימונים → כוח → open the exercise.
**Expected vs actual** — x-axis labels cap at 5 via `pickXLabels`; markers do not
cap, so a genuine overload streak paints ~10 ringed dots plus ~10 "PR" captions
across ~300px. The annotation competes with the curve it annotates.
**Evidence** — `debt-exercisedetail-steep-390-light.png`; `xLabelCount: 15`
(5 axis + 10 marker captions) in `reports/_measure-390-light.json`.
**Suspected location** — `src/components/charts/GlowAreaChart.tsx` markers block
(no thinning) fed by `prMarkers` in
`src/pages/progress/components/ExerciseDetail.tsx:265`.

### F6 — y-axis can print the same number twice for a low-magnitude series
**Severity: low. Code-derived — I did NOT photograph this.**

The axis labels are `Math.round(yMax)` / `Math.round(yMin)`, and with the floored
span the two differ by exactly `0.1 × mean`. When `mean < 10` that gap is under 1,
so both labels round to the same integer and the axis reads e.g. "4" over "4".
Reachable for light isolation work (a 4 kg lateral raise → e1RM ≈ 4).

**Why unverified:** my seeded 4 kg exercise row never appeared in the strength
list (`lowmag: "ROW_NOT_FOUND"`), so I could not open its curve. Treat as a
hypothesis with arithmetic behind it, not a measurement.
**Suspected location** — `src/components/charts/GlowAreaChart.tsx`, the `yAxis`
label block (`{Math.round(yMax)}` / `{Math.round(yMin)}`). Only ExerciseDetail
passes `yAxis`.

---

## 3. Gate output

| Gate | Result |
|---|---|
| `npm run build` | **pass** — `built in 12.91s`, exit 0. Only the pre-existing chunk-size advisory. |
| `npm run verify` | **pass** — exit 0. tsc clean; biome `Checked 700 files in 224ms. No fixes applied.`; format `Checked 700 files in 92ms.` Run against the *dirty* tree, so the other workers' in-flight files also typecheck clean. |
| `npm run test:run` | **pass** — `Test Files 161 passed (161)`, `Tests 1415 passed (1415)`, `Duration 19.88s`, exit 0. No failures to attribute to anyone. |
| `npm run db:test` | **could not run** — exit 1: `[db:test] Docker is not available or the daemon is not running.` Environmental; no app signal either way. |
| `npx playwright test <scratch spec>` | 2 passes (2.3m + 1.9m), 68 PNGs. |

`GlowAreaChart` still has **no test coverage** before or after the change. The
geometry is now pinned only by the numbers in this report, which will not fail a
build. Three assertions would lock the intent permanently: extent ≈ 0 for a
single-valued series, `lineMid == bandMid` for any floored series, extent == 100%
when the real span exceeds the floor. I did not add them — that is a change to the
test suite the lead may want scoped deliberately.

---

## 4. Not covered, and why

- **Progress RECOVERY tab and the N/100 sub-score bars (batch 3).** Excluded by
  instruction. `RecoveryBar`'s only consumer is `RecoveryTab.tsx` (grep: 5 hits,
  all in that file), so the bars have no second surface to photograph. Reading
  `src/pages/progress/components/RecoveryBar.tsx` shows the component now derives
  `pct = clamp(round(value/max*100))` and prints `{value}/{max}` — proportional
  against the real scale — but the `max` it receives comes from the excluded call
  site, so "N/100" itself is unconfirmed. The file is also being rewritten
  concurrently.
- **coach MetricsTab / TrainingTab** — F3.
- **`ToggleSwitch` ON/OFF** — F1. Unreachable, so not photographed. I did not
  build a harness to mount it: that would mean new non-test scaffolding for a
  component with no user path, and the honest finding is the missing path.
- **The low-magnitude y-axis case** — F6, hypothesis only.
- **Accessibility sweep.** Not run. `e2e/a11y.spec.ts` + axe is the right home and
  the brief said extend it, but the expander, the week-strip states and the toggle
  rows each need their own case, and I had no signal that a11y was in scope for
  these three batches. Keyboard reachability and focus rings were not tested.
- **Offline / PWA, mid-workout reload, rest-day-only week, zero-sets** — not
  exercised. My seeding path writes completed sessions straight into IndexedDB, so
  no in-progress workout ever existed to reload.
- **Very long Hebrew string overflow** — not injected. No overflow was observed at
  390 with real content on any captured surface.
- One desktop observation I am deliberately *not* filing as a defect: at 1280 the
  Progress lists stretch edge-to-edge with content clustered at both ends
  (`debt-progress-workouts-expanded-1280-dark.png`). For a mobile-first PWA that
  may be intended; it is not a regression from these batches.

## 5. PNG index

68 files, `visual-qa/debt-*.png`, suffixed `-<width>-<theme>`:

`weekstrip` · `btn-primary-rest` · `btn-primary-pressed` ·
`progress-overview-collapsed` · `progress-overview-expanded` ·
`progress-workouts-collapsed` · `progress-workouts-expanded` ·
`progress-strength-list` · `exercisedetail-flat` · `exercisedetail-steep` ·
`forecast-flat` · `forecast-steep` · `bodyweight-real-collapsed` ·
`bodyweight-big-collapsed` · `settingstoggle-state1` · `settingstoggle-state2` ·
`coach-clients`

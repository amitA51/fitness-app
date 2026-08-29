# `--fs-primary` — real exposure, measured in all four theme states

**Supersedes `plans/TOKEN-POLARITY-AUDIT.md`.** Every figure below was re-derived from the token
graph; nothing was inherited from that document. Read-only audit — no code was changed.

> **SECOND PASS — verification, 2026-08-29. Read this before executing any batch.**
> An independent reviewer re-derived the inventory from scratch, reproduced the contrast method, and
> resolved the surround at **every** site rather than inferring it. The audit's *physics* held up
> completely: every published ratio reproduces, the class table is correct, the disqualification of
> `--color-border-strong` stands, the two proposed token pairs are sound, and seven of the nine batch
> file lists are byte-for-byte right. Its *bookkeeping* did not:
>
> | | as published | verified |
> |---|---|---|
> | Raw references | 223 / 83 files | **247 lines / 251 occurrences / 85 files** |
> | Live paint sites | 211 | **208** (78 files + `tokens.css`) |
> | BROKEN / DEGRADED / SAFE | 118 / 78 / 13 = **209 ✗** | **108 / 79 / 21 = 208 ✓** |
> | Sites needing a human look | 7 | **0** |
>
> **The three changes that would have caused wrong edits:** (1) all three `GoalsStep.tsx` sites and
> nine others are SAFE because their surround is `--fs-accent`/`--fs-signal` — sweeping them breaks
> working UI; (2) `WorkoutPrefsSection.tsx:65` was filed SAFE with its fill and ink read backwards, and
> is BROKEN; (3) **`tokens.css` line citations below line 28 are stale by +15** because the
> `--fs-accent-text` block landed after this was written. Corrected numbers are inline throughout;
> superseded figures are left visible with the correction beside them.

**Inventory — RE-DERIVED 2026-08-29, and the original was wrong twice in ways that cancelled.**
`--fs-primary` appears on **247 lines / 251 occurrences across 85 files** under `src/` — not 223/83.
Subtracting **38 non-paint lines** leaves **209 live references**, of which one is dead plumbing
(below), giving **208 live paint sites in 78 files** (+ `tokens.css`, whose 11 token declarations are
the real Batch 1 work but paint nothing directly = **79 files touched**).

| | lines | note |
|---|---|---|
| Raw references | **247** | 251 occurrences; 4 lines carry the token twice (`GlobalToast.tsx:57`, `TemplateCard.tsx:229`, `components.css:734`, `global.css:410`) |
| − `tokens.css` token layer | 14 | 2 definitions (`:22`, `:417`) + 9 aliases + 3 comments — **not 9** |
| − `components.css` comments | 9 | `:367,615,616,734,1128,1136,1184,1771,1775` — **not 1** |
| − `global.css` comment | 1 | `:410`, the `.data-strip` rationale |
| − test/component comments + regression assertions | 12 | `SettingsToggle.test.tsx` (7), `SettingsToggle.tsx` (2), `AppRouter.tsx` (1), `GlobalToast.tsx` (1), `WeeklyGrid.test.tsx` (1) |
| − JSX/JS comments inside components | 2 | `StatsGrid.tsx:299`, `ExerciseReorderItem.tsx:189` |
| **Live references** | **209** | |
| − dead plumbing | 1 | `PageThemeContext.tsx:64` — writes `--accent-current` / `--dynamic-accent-start`, which **no rule anywhere reads** |
| **Live paint sites** | **208** | across **78 files** (+ `tokens.css` = 79 touched) |

**How the original landed on 211 anyway.** It undercounted the raw total by 24 (247 → 223) *and*
undercounted non-paint by 26 (38 → 12). `223 − 12 = 211` and `247 − 38 = 209`; the two errors very
nearly cancelled, so the headline looked reconciled while both inputs were wrong. The old figure is
not reusable — a worker who greps `--fs-primary` today sees 247 and cannot tie it to anything here.

**Drift since the original pass, which a batch worker would have hit as a merge conflict:**
- **`tokens.css` line numbers below ~line 28 are stale by +15.** The `--fs-accent-text` block landed
  after this audit was written. Every `tokens.css:NN` citation in the original text is off:
  `--navy` is `:56` not `:41`, `--color-on-mustard` `:66` not `:51`, `--color-primary` `:83` not
  `:68`, `--fs-heading` `:110` not `:95`. `WorkoutSummary.tsx` citations are stale by +5
  (`:1014→:1019`, `:1031→:1036`, `:1046→:1051`, `:1059→:1064`); `ProgressDots` `:62→:63`;
  `SlideToComplete` `:357→:491`; `GoalsStep` `:87→:93`, `:120→:126`.
- **Two files it batches no longer carry the token.** `pages/OnboardingFlow.tsx` still exists but has
  zero `--fs-primary` references; **`CompleteStep.tsx` does not exist anywhere under `src/`**. Both
  must come out of Batch 9 (−2 sites, −2 files).
- **Four files it never lists** now reference the token, all comment-only, all describing this very
  defect after it was fixed there: `SettingsToggle.tsx`, `AppRouter.tsx`, `GlobalToast.tsx`,
  `WeeklyGrid.test.tsx`. No work — but they are why a naive grep count jumped.

(Outside `src/`: not re-verified this pass; the original's "43 hits in `plans/`, `reports/`, `docs/`,
`mockups/`, `tailwind.config.js`" is carried forward unchecked and has no runtime effect either way.)

**Tooling note for the batch workers.** The `grep` tool in this repo silently truncates at **5
matches per file** — it reported 5 of 14 for `tokens.css` — and the shell truncates its output at the
first non-ASCII byte while still exiting 0, so a truncated run reads as "no matches" and is a lie.
The enumeration above was taken with `Select-String` piped through `-replace '[^\x20-\x7E]',''`,
which is ASCII-clean and therefore safe. Use that shape, not a bare grep.

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

**Independent re-verification (second pass, 2026-08-29).** I recomputed three of this repo's
published ratios from raw hex without reusing any intermediate above. Full arithmetic:

1. **15.12:1 — `#ffffff` on `#16292d`** (`TOKEN-POLARITY-AUDIT.md:30`, `THEME-AXES-PROBE.md:43`).
   `R 22/255=0.0862745 → ((0.0862745+0.055)/1.055)^2.4 = 0.1339095^2.4 = 0.0080244`;
   `G 41/255=0.1607843 → 0.2045349^2.4 = 0.0221728`;
   `B 45/255=0.1764706 → 0.2194035^2.4 = 0.0262465`.
   `L = 0.2126(0.0080244) + 0.7152(0.0221728) + 0.0722(0.0262465) = 0.00170599 + 0.01585796 + 0.00189500 = 0.01945895`.
   Ratio `= 1.05 / 0.06945895 = **15.117**` ✓
2. **11.83:1 — `#16292d` on `#dbe6e3`** (`TOKEN-POLARITY-AUDIT.md:28`).
   `L(#dbe6e3): R 0.708274, G 0.791293, B 0.768152 → 0.2126(0.708274)+0.7152(0.791293)+0.0722(0.768152) = 0.150579+0.565933+0.055461 = 0.771973`.
   Ratio `= 0.821973 / 0.069459 = **11.834**` ✓
3. **1.31:1 — `#0a0a0a` on `#262626`** (`TOKEN-POLARITY-AUDIT.md:29`, `CREW-BOARD.md:1020`).
   `#0a0a0a`: `10/255 = 0.0392157 ≤ 0.03928` → linear branch → `L = 0.0392157/12.92 = 0.00303527`.
   `#262626`: `38/255 = 0.1490196 → 0.1933835^2.4 = 0.019383`.
   Ratio `= 0.069383 / 0.053035 = **1.3082**` ✓

I also reproduced the proposal's own `--fs-edge` figures, since those were previously unchecked by
anyone but their author. `rgba(255,255,255,0.42)` composited per `out = α·fg + (1−α)·bg`:
over `#111111` → `0.42(255)+0.58(17) = 116.96 ≈ #757575`, `L = 0.17793`, ratio `0.22793/0.055605 = **4.099**`;
over `#262626` → `≈#818181`, `L = 0.219478`, ratio `0.269478/0.069411 = **3.882**`;
over `#000000` → `≈#6b6b6b`, `L = 0.147098`, ratio `0.197098/0.05 = **3.942**`.
Published as 4.10 / 3.89 / 3.95 — all three reproduce. **The proposal's arithmetic is sound.**

### The finding that de-risks the whole sweep

`--fs-primary` in each failing state is **darker than every non-accent surface in the palette**, so a
misread surface changes the *ratio* but never the *verdict*:

| state | `--fs-primary` | vs `--fs-bg` | vs `--fs-surface` | vs `--fs-plate` | vs `--fs-surface-2` | worst |
|---|---|---|---|---|---|---|
| dark | `#0a0a0a` | 1.06 | 1.05 | 1.14 | 1.31 | **1.31** |
| dark+HC | `#0a0a0a` | 1.06 | 1.06 | 1.05 | 1.05 | **1.06** |
| light+HC | `#16292d` | 1.39 | 1.39 | 1.25 | 1.25 | **1.39** |

Every cell is under 3:1, so **no confusion among bg / surface / plate / surface-2 can rescue a site.**
The only surround that makes `--fs-primary` correct is one that is bright in all four states —
`--fs-accent` or `--fs-signal`, which never go dark. That collapses the 168-site "assigned by class,
not by looking" risk from *"which of four surfaces is this?"* to a single binary per site:
**is the adjacent fill accent/signal, or is it not?** That question is answerable from the same style
object with certainty, and it is the question I answered at every site below.

Consequence for the batch workers: the class rows A / B / C / H / H2 are **interchangeable for
remediation purposes** — all five fail all three states, all five take the same replacement. Getting
A-vs-B wrong at a site costs nothing. Getting *accent-vs-not* wrong costs a working site.

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
fixed, and **the 208 live paint sites bypass that fix entirely.** That is the whole bug.

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
because `--fs-heading` *is* `--fs-primary` there (`tokens.css:110`, cited here as `:95`). The
mirror-image bug is already documented as real 9 times over in
`plans/fix-batches/hebrew-copy-contrast.md` (accent fill + `--fs-heading` ink). It is a one-line check
per site: *does this element's own label use `--fs-heading`?*

**Second pass: this check is now complete across all 208 sites, and it found one hit.** No site puts
`--fs-heading` on an `--fs-primary` fill, so the 1.00:1 light collision does **not** occur anywhere —
the original's worry was well-founded but the case is clean. The *mirror* case does occur once:
`SettingsPrimitives.tsx:162` puts `color: var(--fs-heading)` on an `--fs-accent` fill, failing 4.5:1 in
three of four states (1.50:1 dark, 1.25:1 both HC). Written up in §4c — it is an adjacent defect the
`--fs-primary` sweep will walk straight past unless Batch 3 is told about it.

---

## 3. Measurement classes

Every site maps to one of these. The four ratios are properties of the (role, surface) pair, so they
are measured once here and applied by reference — this is what makes 208 sites auditable.

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

**RE-DERIVED. The original counts did not close, and the gap was not attributable.** As published,
`118 + 78 + 13 = 209` against a stated 211 live paint sites — two sites unaccounted for. That gap
**cannot be pinned to two specific lines**, because the document never published a per-site ledger:
it published three aggregate totals and prose. At least five sites in the prose carry no class at all
(`BottomNav.tsx:252` is explicitly labelled "OTHER"; `EmptyState.tsx:37` and
`AnimatedProgressRing.tsx:92` are "resolve the consumer before swapping"; `Dashboard.tsx:294` is
"could not resolve"; `PageThemeContext.tsx:64` is listed only as needing a look), so the true number
of unclassified sites was **five, not two** — the aggregate happened to be off by two. The only
honest repair is a rebuilt ledger, below. Two further bookkeeping faults fed the same gap:

- **`tokens.css:51` (really `:66`, `--color-on-mustard`) was double-counted** — once in the 13 SAFE
  and again in the 9 token definitions. It is a token alias, not a paint site; it belongs only in the
  token layer.
- **`components.css` had 9 comment lines counted as 1**, so 8 comment lines were being carried inside
  a paint-site total.

| | Sites | Files |
|---|---|---|
| **BROKEN** | **108** | 46 |
| **DEGRADED** | **79** | 49 |
| **SAFE** | **21** | 12 |
| **Live paint sites** | **208** | **78** |
| Dead plumbing (`PageThemeContext.tsx:64`) | 1 | 1 |
| Token layer (`tokens.css`: 2 defs + 9 aliases) | 11 | 1 |
| Comments and regression assertions, no paint | 27 | 8 |
| **Total raw lines** | **247** | **85** |

`108 + 79 + 21 = 208` ✓ · `208 + 1 + 11 + 27 = 247` ✓ · files `78 paint + tokens.css + 6 comment-only = 85` ✓

BROKEN falls from 118 to 108 and DEGRADED rises from 78 to 79 — the net is not a reprieve, it is
**re-sorting**: 12 sites leave BROKEN for SAFE because their surround is accent or signal, several
separators drop to DEGRADED, and four previously-undescribed sites enter BROKEN. Full move list next.

### 4a. Every site that changed class row

**Moved to SAFE — the surround is `--fs-accent` or `--fs-signal`, so `--fs-primary` is *correct* here
and sweeping it would break a working site.** These are the twelve the "assign by class" shortcut
would have damaged.

| Site | OLD row | NEW row | Proof of surround |
|---|---|---|---|
| `GoalsStep.tsx:93` | B BROKEN | **SAFE** (F) | selected card is `background: var(--fs-accent)` (`:80`), icon chip sits on it |
| `GoalsStep.tsx:126` | B BROKEN | **SAFE** (F) | description ink on that same accent card — 7.16:1 worst state |
| `GoalsStep.tsx:139` | implied BROKEN | **SAFE** (F) | check badge on the accent card; its own `--fs-accent` ink on the primary fill is class I |
| `WorkoutSummary.tsx:678` | implied BROKEN | **SAFE** (G) | same style object: `background: var(--fs-signal)`, `color: var(--fs-primary)` |
| `PRCelebrationBanner.tsx:72` | implied BROKEN | **SAFE** (G) | trophy chip is `background: var(--fs-signal)` |
| `ExerciseReorderItem.tsx:155` | **flagged, unresolved** | **SAFE** (F) | ink is emitted only on the `isActive` branch, whose fill is `var(--fs-accent)` |
| `ExerciseReorderItem.tsx:289` | implied BROKEN | **SAFE** (F) | `background: isExpanded ? var(--fs-accent)`, ink switches on the same flag |
| `WorkoutPlanScreen.tsx:289` | implied BROKEN | **SAFE** (F) | 26px numbered chip, `background: var(--fs-accent)` |
| `ExerciseReorder.tsx:347` | implied BROKEN | **SAFE** (F) | enabled branch fill is `var(--fs-accent)`; disabled branch never uses `--fs-primary` |
| `WeekGrid.tsx:179` | implied BROKEN | **SAFE** (F) | badge renders only under `hasWorkout`, whose square is `background: var(--fs-accent)` |
| `WarmupCooldownSelectionStep.tsx:137` | implied BROKEN | **SAFE** (F) | checkmark stroke renders only under `item.selected`, whose box is `background: var(--fs-accent)` |
| `Dashboard.tsx:294` | **flagged, unresolved** | **SAFE** (F) | parent is `.home-start-cta`, `background: var(--fs-accent)` (`components.css:971`) |

**Moved OUT of SAFE — the original read the pair backwards.**

| Site | OLD row | NEW row | Why |
|---|---|---|---|
| `WorkoutPrefsSection.tsx:65` | **SAFE** ("accent fill + primary ink") | **BROKEN** (A) | The code is `{ background: 'var(--fs-primary)', color: 'var(--fs-accent)' }` — the **fill is primary**, the ink is accent. It is the exact mirror of `IconBox.tsx:20`, and the two were conflated. Selected-state chip fill → 3:1 → fails 3 of 4. |
| `tokens.css:51` → really `:66` | **SAFE** | **token layer** | `--color-on-mustard` is an alias, not a paint site. Still DO-NOT-TOUCH; simply not a site. |

**Moved BROKEN → DEGRADED — a floor question, not a surface question.** Plain separators and dividers
carry no WCAG floor under this document's own floor table; they were being scored at 3:1.
`WorkoutCalendar.tsx:405`, `ExerciseReorder.tsx:270`, `QuickExerciseForm.tsx:146`, `:158`,
`NumpadOverlay.tsx:601`, `WorkoutSettingsOverlay.tsx:130`, `SupersetPicker.tsx:263`,
`Nutrition.tsx:185`, `MacroStrip.tsx:121`, `:140`, `NutritionTrendChart.tsx:38`,
`WaterHistoryChart.tsx:23`. Also `WorkoutSummary.tsx:953` and `ExerciseReorderItem.tsx:161` — both are
borders on a fill that is `--fs-accent` in the very state they mark, so the state is carried by the
fill and the border is redundant; and `PRCelebrationBanner.tsx:60`, whose fill is bounded by a 2px
`--fs-signal` border at 18.26:1 against the dark page.

**Moved DEGRADED → BROKEN — four sites the original mis-assigned or never described.**

| Site | OLD row | NEW row | Why it is worse than filed |
|---|---|---|---|
| `global.css:594` | DEGRADED, "→ `--fs-panel`" | **BROKEN** (H) | `.text-gradient` is **text**, not a panel: `linear-gradient(135deg, var(--fs-primary), var(--fs-surface-2))` with `-webkit-text-fill-color: transparent`. In dark that is a `#0a0a0a → #262626` gradient on a near-black page — **unreadable text**, 4.5:1 floor. Sending it to `--fs-panel` would paint surface-2 on surface-2. |
| `WorkoutPlanScreen.tsx:445` | undescribed | **BROKEN** (H) | "add exercise" button: `background: transparent`, `color: var(--fs-primary)` → the button's **label** is 1.05:1 on the dark card. |
| `WorkoutPlanScreen.tsx:446` | undescribed | **BROKEN** (A) | its `2px dashed color-mix(--fs-primary 40%, transparent)` composites to `#0e0e0e` over `#111111` = **1.02:1** — the dashed outline is the only thing marking the control, and it is gone. |
| `PremiumSelect.tsx:201` | counted, undescribed | **BROKEN** (H2) | selected option ink `--fs-primary` on `backgroundColor: var(--fs-surface-2)` — 1.31 / 1.25 / 1.05. The **selected row's label** is what vanishes. |

**Newly severe, previously understated.** `TemplateCard.tsx:223,228,229,254` were filed under "lowest
impact per site". They are four BROKEN sites in one control cluster, and together they mean the
**favourite state is entirely invisible in dark**: `:228` is the star's `fill` (the only state
differentiator) and `:229` is its `color` — and because `:229` reads
`isFavorite ? 'var(--fs-primary)' : 'var(--fs-primary)'`, *both* branches paint the same near-black.
The original correctly flagged the identical-branch bug but did not connect it to the loss of the
state indicator. `:223` is the busy spinner on the same chip, `:254` the delete glyph. Treat this
cluster as Batch-2-grade, not Batch-9.

**The 21 SAFE sites — every one confirmed by opening the file, not inferred.** All are class F/G/I:
near-black ink or a small graphic sitting on `--fs-accent` or `--fs-signal`, both of which stay bright
in **all four** states, so `--fs-primary` is the *correct* colour there and **must not be swept**.

*Carried over from the original and re-confirmed (9):* `WorkoutCalendar.tsx:331,347,385,393` — day
number, indicator dot and the signal/accent legend swatch borders; `getIntensityStyle`
(`WorkoutCalendar.tsx:98–110`) returns accent or signal whenever `count > 0`, and `:347` renders only
under `count > 0`. `WorkoutSummary.tsx:1036,1051,1064` (was cited as `1031,1046,1059`) — three labels
on the PR row's accent fill. `Button.tsx:422` — `bg-[var(--fs-accent)] text-[var(--fs-primary)]`.
`settings/components/IconBox.tsx:20` — `{ background: var(--fs-accent), color: var(--fs-primary) }`.

*Newly established (12):* `WorkoutSummary.tsx:678`, `PRCelebrationBanner.tsx:72`,
`GoalsStep.tsx:93,126,139`, `ExerciseReorderItem.tsx:155,289`, `WorkoutPlanScreen.tsx:289`,
`ExerciseReorder.tsx:347`, `WeekGrid.tsx:179`, `WarmupCooldownSelectionStep.tsx:137`,
`Dashboard.tsx:294` — surrounds proved in the move table above.

*Two sites left SAFE for a different reason and are re-filed as DEGRADED* — not a risk change, the
instruction is identical (do not sweep), but "SAFE" should mean "clears its floor in all four states",
and these clear no floor because none applies: `components/ui/ModalOverlay.tsx:333` (backdrop scrim —
near-black in dark is the intent) and `styles/components.css:1372` (14%-alpha decorative stripe on the
progress track). `styles/tokens.css:66` (`--color-on-mustard`) leaves the site list entirely — it is a
token alias, still DO-NOT-TOUCH.

### 4b. The six flagged sites — verdicts

The original marked six sites as needing one human look, plus `Dashboard.tsx:294`. **All seven are now
resolved; none needs a human.**

| Site | Verdict | Reasoning |
|---|---|---|
| `global.css:343` | **DEGRADED → `--fs-panel`** | `.chapter-break` is `background: var(--fs-primary)` + `color: var(--color-ink-on-dark)` — structurally identical to `.masthead` eight lines above, a deliberate dark strip with an ink token that already flips. Same treatment as `.masthead`. |
| `components.css:1789` | **DEGRADED → `--fs-panel`** | `.premium-dark-surface` self-documents at `:1775`: "Always a dark surface (derived from `--fs-primary`) — text must be light in both modes", and its ink is `--color-ink-on-dark`. `:1790` is the same gradient's second stop and travels with it. Confirms the original's guess. |
| `ExerciseReorderItem.tsx:155` | **SAFE** | It is the accent step-circle, not the card — the ink is emitted only on the `isActive` branch whose fill is `var(--fs-accent)`. The original offered exactly these two options and the accent one is right. |
| `EmptyState.tsx:37` | **DEGRADED**, but it is **1 line feeding 5 paint consumers** | `FS.primary` is consumed at `:55, :159, :171, :190, :389` — four SVG `<stop>` colours and one `<circle fill … opacity="0.15">`. All illustration linework inside empty-state art: no WCAG floor. Do not sweep, but know that touching this one line moves five visuals. |
| `AnimatedProgressRing.tsx:92` | **DEGRADED** | It is the 6th entry of a **confetti particle** colour array. One sixth of celebration confetti is invisible on dark; no information is carried. Lowest priority site in the audit. |
| `PageThemeContext.tsx:64` | **DEAD — no work, remove from the count** | It sets the `settings` page theme's `primary`, which `PageThemeProvider` writes to `--accent-current` and `--dynamic-accent-start` (`:97, :100`). **Nothing in `src/` reads either variable** — `var(--accent-current` and `var(--dynamic-accent` return zero matches. Written, never read. This is the one live reference that paints nothing. |
| `Dashboard.tsx:294` | **SAFE** | The 44px badge's parent is `<button className="home-start-cta">`, and `.home-start-cta` is `background: var(--fs-accent)` (`components.css:971`). So it is the mint fill, class F, 7.16:1 worst state — the branch the original hoped for. |

### 4c. An adjacent defect this sweep will walk past

`SettingsPrimitives.tsx:162` is one of the five sites already counted (BROKEN border). While
confirming its surface I found a **second, independent failure in the same style object**, of exactly
the class §2 warned about and could not clear:

```
border: '1.5px solid var(--fs-primary)',
background: active ? 'var(--fs-accent)' : 'var(--fs-surface)',
color: 'var(--fs-heading)',          ← on an accent fill
```

`--fs-heading` on `--fs-accent`: light `#16292d` on `#43c7a5` = 7.16:1 (passes), but **dark `#f0f0f0`
on `#4ddcbb` = 1.50:1**, and both HC states `#ffffff` on `#8efad8` = **1.25:1**. The label fails 4.5:1
in three of four states. §2 said "I found none in the sites I opened; I am not claiming a clean sweep
of all 211" — this is one, found on the sweep. The fix is `--color-ink-on-accent`, not any new token,
and it is **not** part of the `--fs-primary` migration: a worker who only re-points the border will
leave it broken. Batch 3 owns this file; give it the extra line.

**A finding about the plumbing, not a site:** HC repointed `--btn-primary-bg` and `--nav-pill-bg`
away from `--fs-primary` but left **`--color-primary` (really `tokens.css:83`, `:465` — cited here as
`:68`, `:446`) and `--navy` (really `:56`, `:437` — cited as `:41`, `:418`) still aliasing it in all
four states.** The diagnosis is exactly right, and the stale numbers are the +15/+19 `--fs-accent-text`
drift described in the inventory. The follow-up count it asks for is now done: **zero consumers** —
`var(--color-primary)` and `var(--navy)` appear nowhere in `src/`. Both are dead aliases; see §7.

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

### Judged against the `--fs-accent-text` precedent — VERDICT: same shape, ship it

`--fs-accent-text` now exists in `tokens.css` and is the proven instance of this exact manoeuvre:

```css
:root              { --fs-accent-text: #256d5b; }        /* :43  literal */
html.dark          { --fs-accent-text: var(--fs-accent); } /* :425 re-point */
html.high-contrast { --fs-accent-text: var(--fs-accent); } /* :683 re-point */
```

Both proposed pairs match it on the property that actually carries the safety guarantee: **every one
of the three blocks declares the token, so all four states are pinned and none inherits by accident.**
That matters specifically because `html.dark` and `html.high-contrast` have equal specificity with no
combined selector — dark+HC resolves to the HC value only because HC is later in the file. A pair that
declared in `:root` and `html.dark` but *not* in `html.high-contrast` would silently hand light+HC the
light value. Neither proposed pair has that hole. Checked explicitly:

| | light | dark | light+HC | dark+HC |
|---|---|---|---|---|
| `--fs-edge` | `--fs-primary` `#16292d` | `rgba(255,255,255,.42)` | `--color-border` `#ffffff` | `#ffffff` |
| `--fs-panel` | `--fs-primary` `#16292d` | `--fs-surface-2` `#262626` | `--fs-surface-2` `#111111` | `#111111` |

**One structural difference, and it is an improvement, not a defect.** The precedent puts a *literal*
in `:root` and *aliases* in the overrides; both proposals invert that — alias in `:root`, literal (or a
different alias) in the overrides. The precedent needed a literal because `--fs-accent` in light is the
wrong value for text (1.88–2.11:1, `reports/04-A11Y-RTL-HEBREW.md:21`), so it could not alias. For
`--fs-edge` and `--fs-panel`, light's `--fs-primary` **is** the wanted value, so aliasing it makes
"light is byte-identical" true *by construction* rather than by a coincidence of two hex strings
matching. A literal `#16292d` would be equally correct today and would silently drift the day anyone
moves `--fs-primary` in light. Keep the alias.

**Two things to fix before this ships.**

1. **`--fs-panel` makes both HC states *lower* contrast than they are now**, and the proposal states
   the number without flagging the direction. A masthead today is `#16292d` on the HC black page =
   1.39:1; under `--fs-panel` it becomes `#111111` = **1.11:1**. That is a regression in the one state
   whose entire purpose is maximum separation. It is defensible — no floor applies to a decorative
   band, and the app's own elevation step is `bg → surface → surface-2` — but it is a *design decision
   about high-contrast mode*, not a mechanical consequence, and the lead should sign it off rather than
   discover it. The proposal's own remedy (a 1px `--fs-edge` outline, which is `#ffffff` at 21:1 in
   both HC states) closes it cheaply; recommend applying it to every band in Batch 1 and Batch 3
   rather than leaving it conditional on "if a band must read as a distinct region".
2. **Do not let `.data-strip` become the precedent it looks like.** `global.css:410` already fixed this
   exact shape with `--color-border-strong`, and documents the reasoning in a comment. That token is
   the one disqualified here at 2.10–2.35:1. The existing `.data-strip` fix is *acceptable* only
   because a panel frame carries no floor — so `.data-strip` must not be cited as justification for
   any site that does carry one. `MacroStrip.tsx:121,140` is `.data-strip`'s un-migrated twin and may
   follow it, but only on the strength of its own DEGRADED grade (§4a), not by analogy.

The `--fs-edge` arithmetic (4.10 / 3.89 / 3.95) and the disqualification range for
`--color-border-strong` both reproduce independently — see §1. **No objection to either pair.**
The INK recommendation also reproduces: `--fs-heading` gives 15.12 / 16.57 / 21.00 / 21.00 on
`--fs-surface` (dark `#f0f0f0` on `#111111` = `0.921372/0.055605`), so it clears 4.5:1 in all four.

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
never touch the same file.

**Counts re-derived (supersedes `22+31+34+24+31+21+22+10+26 = 221 … = 223 across 83 files`):**

| Batch | paint sites | files | change from original |
|---|---|---|---|
| 1 | **12** | 3 | was 22 — `tokens.css` contributes **0 paint sites**; its 11 token declarations are the batch's real work but are not sites. `global.css` 6 ✓, `components.css` 6 ✓ |
| 2 | 31 | 7 | unchanged ✓ |
| 3 | 34 | 13 | unchanged ✓ |
| 4 | 24 | 4 | unchanged ✓ |
| 5 | 31 | 10 | unchanged ✓ |
| 6 | 21 | 7 | unchanged ✓ |
| 7 | 22 | 13 | unchanged ✓ |
| 8 | 10 | 8 | unchanged ✓ |
| 9 | **23** | **14** | was 26/17 — `OnboardingFlow.tsx` no longer references the token, `CompleteStep.tsx` does not exist, `PageThemeContext.tsx:64` is dead plumbing |
| **Total** | **208** | **78** | + `tokens.css` = **79 files touched** |

`12+31+34+24+31+21+22+10+23 = 208` ✓ · `208 paint + 1 dead + 11 token declarations + 27 comment/test
lines = 247` ✓ · `78 paint files + tokens.css + 6 comment-only files = 85` ✓

Seven of the nine batch file lists are **byte-for-byte correct** — batches 2–8 needed no change at all.
The original's file partition is sound; only Batch 1's site count and Batch 9's membership were wrong.

### Batch 1 — Token plumbing and the global CSS classes · 22 sites, 3 files · **BLOCKING**
`src/styles/tokens.css` (9) · `src/styles/global.css` (6) · `src/styles/components.css` (7)

Highest impact per line in the repo: `.card-outlined` and `.card-interactive` (`global.css:122,130`,
class A) and `.tab-item.active` (`:309`, class A fill, selected state = information) are *classes*,
so they carry unknown further blast radius beyond the 223 counted sites.

One worker: define `--fs-edge` and `--fs-panel` in the three blocks; repoint `.card-outlined`,
`.card-interactive`, `.tab-item.active` to `--fs-edge`; `.masthead` (`:316`, class C, DEGRADED),
`global.css:343` and `:594`, `.hero-card` (`components.css:642,643`), the dotted panel (`:1392`) and
`.premium-dark-surface` (`:1789,1790`) to `--fs-panel`. Leave `components.css:1372` (decorative) and
`tokens.css:66` (`--color-on-mustard`, DO-NOT-TOUCH — cited above as `:51`) alone. Do not move
`--fs-primary`.

**Batch 1 corrections from the second pass — read these before editing:**
- **`global.css:594` must NOT go to `--fs-panel`.** `.text-gradient` is a **text** fill
  (`-webkit-text-fill-color: transparent` over `linear-gradient(135deg, var(--fs-primary),
  var(--fs-surface-2))`). Sending it to `--fs-panel` paints surface-2 on surface-2. It is BROKEN at the
  4.5:1 floor — unreadable gradient text in dark — and needs an ink treatment, not a panel token. See
  §4a.
- **Both "need one look" items are resolved, no look required.** `global.css:343` = `.chapter-break`
  → `--fs-panel` (identical shape to `.masthead`); `components.css:1789,1790` = `.premium-dark-surface`
  → `--fs-panel` (the file says so itself at `:1775`). See §4b.
- **`components.css:1392`** (`.fs-brand-icon`) is the **brand mark** — a 42px logo circle. WCAG exempts
  logotypes from 1.4.11, and `--fs-panel` would change brand colour. Get design sign-off rather than
  sweeping it with the rest.
- **Site count is 12, not 22.** `tokens.css` contributes 0 paint sites; its 11 token declarations
  (2 definitions + 9 aliases) are the batch's real work. `global.css` 6 ✓ and `components.css` 6 ✓ are
  both correct as named.
- **Blast radius beyond the count is real and was correctly called.** `.card-outlined`,
  `.card-interactive` and `.tab-item.active` are classes; their consumers are not in the 247.

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
indistinguishable from an inactive one in dark → `--fs-edge`. **Confirmed on re-read**: `:399` is
`background: active ? var(--fs-primary) : var(--fs-surface)` with `:401` the matching border, and the
`--fs-accent` label on the active fill is class I, SAFE.

**Batch 3 owes two extra things the original did not name:**
1. **`SettingsPrimitives.tsx:162` has a SECOND defect in the same style object**, unrelated to
   `--fs-primary`: `color: 'var(--fs-heading)'` on `background: active ? 'var(--fs-accent)'`. That is
   `--fs-heading` on an accent fill — **1.50:1 in dark, 1.25:1 in both HC states**, failing 4.5:1 in
   three of four. It is the exact hazard §2 flagged and could not clear. Fix with
   `--color-ink-on-accent`. A worker who only re-points the border leaves this broken. See §4c.
2. **Two sites in this batch are SAFE and must not be swept:** `WorkoutPlanScreen.tsx:289` (ink on the
   accent numbered chip) and `PRCelebrationBanner.tsx:72` (trophy ink on `--fs-signal`).
   `PRCelebrationBanner.tsx:60` drops to DEGRADED — its fill is bounded by a 2px `--fs-signal` border at
   18.26:1 against the dark page, so the banner never loses its shape.
   Conversely `WorkoutPlanScreen.tsx:445,446` are **newly BROKEN and severe**: the "add exercise"
   control has `background: transparent` with `color: var(--fs-primary)` (label at 1.05:1) and a
   `2px dashed color-mix(--fs-primary 40%, transparent)` outline that composites to `#0e0e0e` on
   `#111111` = **1.02:1**. Both the label and the only outline vanish. See §4a.

### Batch 4 — Reorder and summary · 24 sites, 4 files
`reorder/ExerciseReorderItem.tsx` (7) · `ExerciseReorder.tsx` (3) · `WorkoutSummary.tsx` (6) ·
`QuickExerciseForm.tsx` (8)

Borders → `--fs-edge`. Note `WorkoutSummary.tsx:1019` (cited above as `:1014` — stale by +5): one
declaration paints a border over *both*
an accent fill (SAFE) and a `--fs-surface-2` fill (class B, BROKEN) — split the branch, do not blanket
it. **Confirmed correct on re-read**: the row is
`background: prExercises.has(…) ? var(--fs-accent) : var(--fs-surface-2)` with a single
`border: 2px solid var(--fs-primary)`.
`QuickExerciseForm.tsx:307` is `accentColor: var(--fs-primary)` on a native checkbox: in dark the
checked box is near-black on a near-black card, so **checked state is unreadable** — BROKEN, use
`--fs-accent` with `--color-ink-on-accent`. **`ExerciseReorderItem.tsx:155` is RESOLVED — SAFE.** Its
surface is the accent step-circle, not the card: the ink is emitted only on the `isActive` branch whose
fill is `var(--fs-accent)`. No look needed.

**Batch 4 also owns four sites that moved to SAFE or DEGRADED — do not sweep them:**
`ExerciseReorderItem.tsx:155` and `:289` are SAFE (ink on accent); `ExerciseReorder.tsx:347` is SAFE
(ink on the enabled accent fill); `WorkoutSummary.tsx:678` is SAFE (ink on `--fs-signal`).
`ExerciseReorderItem.tsx:161`, `WorkoutSummary.tsx:953`, `ExerciseReorder.tsx:270` and
`QuickExerciseForm.tsx:146,158` drop to DEGRADED. That leaves **17 of this batch's 24 sites as real
work**, not 24. Note `ExerciseReorderItem.tsx:189` is a comment, not a site — the file has 8 matching
lines but 7 paint sites, exactly as the original counted.

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
`BottomNav.tsx:252` is a `ring-offset` colour (cosmetic: a navy halo on a white bar in light) — graded
DEGRADED, but see §7: it is the gap between element and focus ring, so a designer could reasonably
call it a focus-visibility concern.

**Both palette-map entries are RESOLVED — no consumer hunt needed:**
- `EmptyState.tsx:37` — `FS.primary` is consumed at `:55, :159, :171, :190, :389`: four SVG `<stop>`
  colours and one `<circle fill … opacity="0.15">`. All illustration linework in empty-state art →
  **DEGRADED**, no floor. But note this is **one line feeding five paint consumers** — the smallest
  edit in the batch with the widest visual reach.
- `AnimatedProgressRing.tsx:92` — the 6th entry of a **confetti particle** colour array →
  **DEGRADED**. One sixth of celebration confetti is invisible on dark; nothing is conveyed. Lowest
  priority site in the audit.

**Two Batch 5 sites the original counted but never described, both real:**
`PremiumSelect.tsx:201` is `color: isSelected ? var(--fs-primary)` on
`backgroundColor: var(--fs-surface-2)` — **BROKEN class H2** at the 4.5:1 floor, so the *selected
option's label* is what disappears (1.31 / 1.25 / 1.05), not just its border.
`LoadingSpinner.tsx:177` (decorative blurred glow gradient) and `:207` (an SVG gradient stop whose
partner stop is `--fs-accent`) are both **DEGRADED**, which is why the batch's real loader work is the
four at `:68,90,137,242`.

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
they need a real series colour, not `--fs-edge`. **All three confirmed on re-read** —
`MuscleBreakdown.tsx:27` is the 7th entry of a chart series array, and `WeekGrid.tsx:38,39` are the
return values of the calorie-bar colour function.

**Batch 6 corrections:** `WeekGrid.tsx:179` is **SAFE** — the session-count badge renders only under
`hasWorkout`, whose square is `background: var(--fs-accent)`; do not sweep it. `WorkoutCalendar.tsx:405`
drops **BROKEN → DEGRADED** (a monthly-stats section separator carries no floor), as do
`MacroStrip.tsx:121,140`, `NutritionTrendChart.tsx:38` and `WaterHistoryChart.tsx:23` (panel frames and
column dividers). But `NutritionTrendChart.tsx:89` and `WaterHistoryChart.tsx:56` stay **BROKEN** — both
are `border: isLast ? '2px solid var(--fs-primary)' : 'none'`, i.e. the border *is* the marker
distinguishing the latest bar, which is data-bearing. The original's four SAFE sites in
`WorkoutCalendar.tsx` (`:331,347,385,393`) are all confirmed correct, so its warning that "a blanket
sweep of this file would destroy the 4 SAFE sites" stands exactly as written.

**One precedent trap for this batch.** `MacroStrip.tsx:121,140` is the un-migrated twin of
`.data-strip` (`global.css:410`), which was already fixed with `--color-border-strong` — the token
disqualified here at 2.10–2.35:1. `MacroStrip` may follow `.data-strip` **only** because both are
graded DEGRADED (no floor). Do not cite `.data-strip` as precedent for any site that carries a floor.

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

### Batch 9 — Onboarding, login, settings, misc · 23 sites, 14 files
`onboarding/steps/GoalsStep.tsx` (3) · `WelcomeStep.tsx` (2) ·
`onboarding/components/ProgressDots.tsx` (1) · `login/steps/ChoiceStep.tsx` (3) ·
`pages/Login.tsx` (1) · `settings/sections/ThemeSection.tsx` (2) · `WeeklyReportSection.tsx` (1) ·
`WorkoutPrefsSection.tsx` (1) · `settings/components/IconBox.tsx` (1) · `pages/Dashboard.tsx` (1) ·
`community/CommunityFeed.tsx` (1) · `templates/components/TemplateCard.tsx` (4) ·
`guidance/WelcomeGuideSheet.tsx` (1) · `errors/RootErrorBoundary.tsx` (1)

**Three entries removed from this batch by the second pass:** `pages/OnboardingFlow.tsx` (the file
exists but has **zero** `--fs-primary` references now), `CompleteStep.tsx` (**the file does not exist
anywhere under `src/`**), and `contexts/PageThemeContext.tsx` (`:64` is dead plumbing — it writes
`--accent-current` / `--dynamic-accent-start`, which nothing reads; see §4b). 26 sites / 17 files →
**23 sites / 14 files**.

Lowest impact per site but several worth naming. `ProgressDots.tsx:63` (cited as `:62`) — the active
step dot is class C,
**BROKEN in dark (1.06:1)**: a first-run user cannot tell which onboarding step they are on.
`TemplateCard.tsx:229` reads
`color: template.isFavorite ? 'var(--fs-primary)' : 'var(--fs-primary)'` — **both branches are
identical**, a latent bug independent of theming; flag it, do not silently "fix" the intent.
**Confirmed verbatim on re-read.** But it is worse than filed: `:228` is the star's `fill` and the only
other state differentiator, and it is also `--fs-primary`, so in dark **the favourite state is entirely
invisible** — both the filled and unfilled star paint near-black on the near-black chip. With `:223`
(busy spinner) and `:254` (delete glyph) that is four BROKEN sites in one control cluster; treat it as
Batch-2-grade priority, not "lowest impact". See §4a.
`ThemeSection.tsx:56,57` is the theme picker's own swatch — it is *meant* to show the navy, so
confirm intent before swapping; graded DEGRADED.
**`GoalsStep.tsx:93,126` (cited as `:87,120`) are NOT class B BROKEN — all three GoalsStep sites are
SAFE.** The selected card fills with `var(--fs-accent)` (`GoalsStep.tsx:80`), so `:93` (icon chip),
`:126` (description ink) and `:139` (check badge) all sit on the mint. Sweeping them would break three
working sites. This is the single largest misread in the original and the clearest example of why the
class-by-inference shortcut was unsafe. See §4a.
**`WorkoutPrefsSection.tsx:65` is NOT SAFE** — the original read the pair backwards. It is
`{ background: 'var(--fs-primary)', color: 'var(--fs-accent)' }`: the fill is primary. BROKEN, class A.
`IconBox.tsx:20` is its mirror (`background: accent`, `color: primary`) and *is* SAFE.
`RootErrorBoundary.tsx:115` is DEGRADED chrome, and it carries a literal fallback
(`var(--fs-primary, #16292d)`) that must be preserved — it renders when the token layer may be gone.

### No work — comment-only and dead references (27 lines, 6 files)
Every one of these matches a `--fs-primary` grep and **none of them paints anything**. A worker who
sweeps by grep will hit all of them.

- `components/ui/__tests__/SettingsToggle.test.tsx` — **7 lines**, not 2: comments at `:5,12,13` and
  four live **regression assertions** at `:56,63,74,81` (`expect(border).not.toContain('--fs-primary')`).
  These pin an already-fixed instance of this same defect (`1.31:1 on the OFF fill (dark)`, class B).
  **Do not delete or weaken this test, and do not "fix" the string literals inside it** — the assertions
  exist precisely to fail if `--fs-primary` ever returns to that component.
- `components/ui/SettingsToggle.tsx:44,152` — comments explaining the fix that landed there. The live
  code uses `--fs-ink`.
- `AppRouter.tsx:979` — comment; the spinner beside it already uses `--fs-heading`.
- `components/ui/GlobalToast.tsx:57` — comment (two occurrences on one line); `info` uses `--fs-ink`.
- `components/dashboard/WeeklyGrid.test.tsx:35` — comment; `.day-cell.done` now uses `--nav-pill-*`.
- `contexts/PageThemeContext.tsx:64` — **dead plumbing**, the one live reference that paints nothing.

Also grep-visible but non-painting inside files that *do* have work: `StatsGrid.tsx:299` and
`ExerciseReorderItem.tsx:189` are comments, and `components.css` has **9** comment lines
(`:367,615,616,734,1128,1136,1184,1771,1775`) plus `global.css:410` — all of them prose explaining
where this token was already removed. Nine of those comments are, in effect, the changelog of this
migration.

---

## 7. What I did not cover

- ~~**I did not open all 211 sites.**~~ **SUPERSEDED by the second pass.** The original read ~40 of
  211 surfaces and inferred the rest. The second pass enumerated all **247** lines with their actual
  declarations and resolved the surround at **every** site. What made that affordable is the finding in
  §1: because `--fs-primary` is darker than every non-accent surface in all three failing states, the
  only surface question that can change a verdict is *accent/signal or not*, which is answerable from
  the same style object. All seven previously-flagged sites are resolved in §4b; **nothing is left
  needing a human look.** Twelve sites moved to SAFE, two moved out of SAFE, fourteen moved between
  BROKEN and DEGRADED — all named with old and new rows in §4a.
- **What the second pass did NOT do.** It did not open the ~30 `background: var(--fs-primary)` chrome
  bands one by one to confirm which parent they sit in; they are DEGRADED either way (no floor applies
  to a decorative band, and every candidate surround fails identically), so the grade is safe but the
  *choice between `--fs-panel` and deletion* is a design call per band. It also did not re-verify the
  43 hits outside `src/`.
- **Three DEGRADED grades are judgement calls a designer could overturn**, and a worker should not
  treat them as settled: `SlideToComplete.tsx:491` (the slide-to-complete **track** — I graded it
  decorative because the knob and label carry the affordance, but a slider track boundary has a real
  case for 3:1), `BottomNav.tsx:252` (a `ring-offset` colour — it is the gap between element and focus
  ring, so it touches focus visibility even though the ring itself is `--fs-focus-ring`), and
  `LoadingSpinner.tsx:207` (an SVG gradient stop; the arc's other stop is `--fs-accent`, so the graphic
  survives on dark at partial strength).
- **Surface drift is the one way these numbers go wrong.** In dark, `--fs-surface` `#111111`,
  `--fs-plate` `#1a1a1a` and `--fs-surface-2` `#262626` give **1.05 / 1.14 / 1.31** for the same
  `#0a0a0a` paint. A figure quoted against the wrong one of those three looks plausible and is
  wrong — which is the failure mode of the superseded audit. Every figure here names its surface.
- **No browser, no build, no test, no gate, no git** — as instructed. Nothing here is verified
  against a rendered pixel except through the four existing `visual-qa/tokens-*.json` samples, and
  those do not sample `--fs-primary`. A screenshot pass over batches 2 and 6 in dark and dark+HC
  would confirm the visual claim cheaply.
- **`--color-primary` / `--navy` exposure — QUESTION NOW CLOSED, and the answer is zero.** The original
  was **right** that both still alias `--fs-primary` in all four states: light `:root` and `html.dark`
  both declare them as `var(--fs-primary)` and `html.high-contrast` declares neither, so they resolve
  to the defective token everywhere. It asked for a follow-up count. The count is **0** —
  `var(--color-primary)` and `var(--navy)` have **no consumers anywhere in `src/`**. Both are dead
  aliases, in the same category as the `--accent-current` plumbing behind
  `PageThemeContext.tsx:64`. No batch work, no hidden blast radius. Worth deleting on a cleanup pass,
  not worth a batch.
- **The other five aliasers are already fixed, verified.** `--btn-primary-bg` and `--nav-pill-bg` are
  re-pointed to the accent in both `html.dark` and `html.high-contrast`; `--fs-heading` becomes
  `var(--fs-ink)` in dark and `#ffffff` in HC; `--color-border-strong` becomes
  `rgba(255,255,255,.26)` in dark and `#ffffff` in HC; `--color-on-mustard` becomes a `#0a0a0a` literal
  in dark and is correct on `--fs-signal` in every state (13.15 / 17.22). Only the two dead ones above
  were ever exposed.

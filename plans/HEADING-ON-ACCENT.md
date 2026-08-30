# HEADING-ON-ACCENT — theme-varying ink on a fixed bright fill

**T-093 · READ-ONLY MAP. No source touched.** Scope: all of `src/` — `.tsx`, `.ts`,
`.css`. Enumerated with `Select-String` (not the grep tool, which caps at 5
matches per file).

The defect: a colour token that CHANGES with the theme so text stays readable on
a page (`--fs-heading`, `--fs-ink`, `--fs-ink-muted`, `--fs-muted`) placed as ink
on a fill that is bright in EVERY theme by design (`--fs-accent`, `--fs-signal`).
The fill never darkens; the ink lightens in dark and high-contrast; the label
fades into its own button.

**Result: the family is real but SMALL — 8 sites / 12 declarations.** Against
them sit **26 sites that look identical to a grep and are correct**, plus ~25
accent-*wash* surfaces that are not accent fills at all. A mechanical
find-and-replace on this pattern would have done more damage than the defect.

---

## 1. Method check — reproduced before trusting

WCAG 2.x relative luminance + `(L1+0.05)/(L2+0.05)`, sRGB, alpha composited to
8-bit channels, `color-mix(in srgb …)` as a linear mix of gamma-encoded channels.

Reproduced against figures this repo already publishes for itself:

| # | Figure | Source | Published | Mine |
|---|--------|--------|-----------|------|
| a | `#256d5b` on `#ffffff` | `tokens.css` `--fs-accent-text` | 6.15 | **6.15** |
| b | `#256d5b` on `#eef3f1` | same | 5.48 | **5.48** |
| c | `#256d5b` on `#dbe6e3` | same | 4.81 | **4.81** |
| d | `#256d5b` on `#dceee9` | same | 5.11 | **5.11** |
| e | `#4ddcbb` on `#000000` | `tokens.css` dark `--fs-accent-text` | 12.27 | **12.27** |
| f | `#4ddcbb` on `#111111` | same | 11.03 | **11.03** |
| g | `#8efad8` on `#000000` | `tokens.css` HC block | 16.82 | **16.82** |
| h | `#43c7a5` on `#eef3f1` / `#ffffff` / `#dbe6e3` | `reports/04-A11Y-RTL-HEBREW.md:21` | 1.88 / 2.11 / 1.65 | **1.88 / 2.11 / 1.65** |
| i | `#4e8a77` on `#000000` | `tokens.css` HC `--btn-primary-bg-hover` | 5.23 | **5.23** |
| j | `#ffffff` on `#1c363b` | `tokens.css` HC `--fs-panel` | 12.80 | **12.80** |
| k | `--fs-ink` on `.day-cell.rest` fill | `components.css:1210` comment | 4.64 / 4.89 | **4.64 / 4.89** |
| l | on-accent ink on accent, 4 states | `SettingsPrimitives.tsx:164` comment | 8.90 / 10.98 / 16.82 / 16.82 | **8.90 / 10.98 / 16.82 / 16.82** |
| m | `--fs-heading` on accent, dark + HC | task brief + `SettingsPrimitives.tsx:162` | 1.50 / 1.25 / 1.25 | **1.50 / 1.25 / 1.25** |
| n | near-black ring on the mint, light → dark+HC | `SetEditRow.tsx:323` comment | 7.16 → 15.85 | **7.16 → 15.85** |

14 of 14 exact. Three alpha-composited figures elsewhere in `tokens.css`
(`--fs-edge` 3.95/3.89, `--color-drag-handle` 3.20) come out 0.01 low — I round
composited channels to 8-bit integers, the repo evidently kept them in float.
Immaterial, and it affects no figure in this document: every number below is on
opaque fills.

## 2. Resolved token values per state

Read from `src/styles/tokens.css` — `:root` (light), `html.dark` (lines
428–647), `html.high-contrast` (lines 659–773). The two class blocks have equal
specificity and there is no combined selector, so **HC wins over dark only where
HC actually declares the token**; where it does not, `html.dark`'s value survives
into dark+HC and `:root`'s into light+HC.

| Token | light | dark | light+HC | dark+HC | declared in HC? |
|---|---|---|---|---|---|
| `--fs-accent` (fill) | `#43c7a5` | `#4ddcbb` | `#8efad8` | `#8efad8` | yes |
| `--fs-signal` (fill) | `#e2fb70` | `#e2fb70` | `#e2fb70` | `#e2fb70` | **no** — same either way |
| `--fs-heading` | `#16292d` | `#f0f0f0` | `#ffffff` | `#ffffff` | yes |
| `--fs-ink` | `#132327` | `#f0f0f0` | `#ffffff` | `#ffffff` | yes |
| `--fs-muted` | `#4d5c5a` | `#a3a3a3` | `#f2f2f2` | `#f2f2f2` | yes |
| `--fs-ink-muted` | `#4d5c5a` | `#a3a3a3` | `#f2f2f2` | **`#a3a3a3`** | **no — trap, see B2** |
| `--fs-primary` | `#16292d` | `#0a0a0a` | `#16292d` | `#0a0a0a` | **no** — near-black in all four |
| `--color-ink-on-accent` | `#071412` | `#071412` | `#000000` | `#000000` | yes |
| `--fs-surface` | `#ffffff` | `#111111` | `#000000` | `#000000` | yes |
| `--fs-surface-2` | `#dbe6e3` | `#262626` | `#111111` | `#111111` | yes |

**`--fs-ink-muted` is the trap the brief warned about.** `:root` declares it as
`var(--fs-muted)`; `html.dark` declares it as the **literal** `#a3a3a3`; the HC
block declares it not at all. So light+HC resolves through `:root` to HC's
`#f2f2f2`, while dark+HC keeps dark's literal `#a3a3a3`. **The two HC states
disagree** — the only token in this map that does.

`--fs-primary` is NOT a member of this family. It is near-black in all four
states, so it is a *legitimate* ink on the mint (7.16 → 15.85). Nine sites below
use it exactly that way. Its known defect is the opposite one — as a border or
band on dark surfaces — and belongs to `plans/FS-PRIMARY-EXPOSURE.md`.

### Reference pairings (used throughout section 3)

| Pairing | light | dark | light+HC | dark+HC | vs 4.5:1 |
|---|---|---|---|---|---|
| `--fs-heading` on `--fs-accent` | 7.16 | **1.50** | **1.25** | **1.25** | fails 3 of 4 |
| `--fs-ink` on `--fs-accent` | 7.67 | **1.50** | **1.25** | **1.25** | fails 3 of 4 |
| `--fs-ink-muted` on `--fs-accent` | **3.32** | **1.47** | **1.12** | **2.02** | fails 4 of 4 |
| `--fs-heading` on `--fs-signal` | 13.15 | **1.01** | **1.15** | **1.15** | fails 3 of 4 |
| `--color-ink-on-accent` on `--fs-accent` | 8.90 | 10.98 | 16.82 | 16.82 | passes |
| `--color-ink-on-accent` on `--fs-signal` | 16.34 | 16.34 | 18.27 | 18.27 | passes |
| `--fs-primary` on `--fs-accent` | 7.16 | 11.57 | 12.10 | 15.85 | passes |
| `--fs-primary` on `--fs-signal` | 13.15 | 17.22 | 13.15 | 17.22 | passes |
| `--fs-heading` on `--fs-surface` (inactive branch) | 15.12 | 16.57 | 21.00 | 21.00 | passes |
| `--fs-muted` on `--fs-surface-2` (inactive branch) | 5.49 | 6.00 | 16.87 | 16.87 | passes |
| **`--color-ink-on-accent` on `--fs-surface`** — the flat-swap trap | 18.79 | **1.01** | **1.00** | **1.00** | **fails 3 of 4** |

That last row is why several sites need a conditional and not a swap: pushing
on-accent ink onto the inactive branch paints near-black on near-black.

---

## 3. Site ledger

### BROKEN — 8 sites, 12 declarations

#### B1 · `src/styles/global.css:395` — `.block-hero`
Ink `--fs-heading` · fill `--fs-accent` (`:394`, unconditional).
**7.16 / 1.50 / 1.25 / 1.25.** Fails dark + both HC.
Two children inherit it and carry the same numbers: `.block-hero .number`
(`:410`, 96px → 3:1 large-text floor, so it fails at 1.50/1.25/1.25 too) and
`.block-hero .sub` (`:418`, 16px/500 → 4.5:1). One declaration fixes all three.
→ **`--color-ink-on-accent`.** Flat swap is safe; the fill has no conditional.

#### B2 · `src/styles/global.css:408` — `.block-hero .label`
Ink `--fs-ink-muted` · fill `--fs-accent` inherited from `.block-hero`.
**3.32 / 1.47 / 1.12 / 2.02.** 12px/600 → 4.5:1. **Fails all four states** — the
only site in the family that does, and the reason is the token's own comment: it
was moved off `opacity: 0.75` on the heading ink to fix a *dark-surface* problem,
which is the right call on a surface and the wrong one on the mint.
→ **Needs a decision, not a swap.** There is no "muted ink on accent" token, and
I will not invent one in a read-only pass. Two options:
  - `--color-ink-on-accent` — correct (8.90/10.98/16.82/16.82) but flattens the
    label into the same weight as the hero number, losing the intended hierarchy.
  - `color-mix(in srgb, var(--color-ink-on-accent) 72%, var(--fs-accent))` —
    **5.03 / 5.69 / 8.28 / 8.28**, clears the floor in all four while staying a
    visible step below full on-accent ink. 72% is the first safe step: 66%
    lands at 4.31 in light and misses. 78% gives 5.85/6.73/10.21/10.21 if more
    margin is wanted. This is the same "scale the channels, keep the hue"
    technique `--fs-accent-text` (0.55) and `--btn-primary-bg-hover` (0.86 dark,
    0.55 HC) already use.

#### B3 · `src/components/workout/reorder/SetEditRow.tsx:334` — save button (שמור)
Ink `--fs-heading` · fill `--fs-accent` (`:321`, unconditional).
**7.16 / 1.50 / 1.25 / 1.25.** → **`--color-ink-on-accent`**, flat swap.
*Do not touch* `:310` — the adjacent cancel button, same `--fs-heading`, on
`--fs-surface-2`: 11.83 / 13.28 / 18.88 / 18.88. Correct. The two buttons sit in
one flex row and look identical in the diff.
*Do not touch* the `2px solid var(--fs-primary)` ring at `:326` — its own comment
documents why it is deliberately not `--fs-edge`.

#### B4 · `src/components/workout/components/SetEditBottomSheet.tsx:141, 160, 222, 303`
Ink `--fs-heading` ×4 · fill `--fs-accent` at **`:123–124`**, the wrapper `div`
(`isEditing ? accent : isCompleted ? success-tint : surface`).
**7.16 / 1.50 / 1.25 / 1.25** each.
This is a *descendant* case, not a sibling one — which is why the brief's
"around line 334" does not land (see §6). The four declarations live inside the
`{isEditing ? …}` branch, which renders **only** when the wrapper is the mint,
so the fill is unconditional *from their point of view*.
→ **`--color-ink-on-accent`** on all four. Flat swap safe.
*Do not touch* `:196`, `:257`, `:328` — insulated by their own
`background: 'var(--fs-surface)'` (15.12/16.57/21.00/21.00). *Do not touch*
`:384`, `:411`, `:433` — inside the `!isEditing` branch. *Do not touch* `:348`
(`--fs-accent` ink on the `--fs-primary` fill at `:340`) or `:37`.

#### B5 · `src/components/workout/reorder/ExerciseReorderItem.tsx:261` — superset chip
Ink `--fs-heading` · fill `--fs-accent` (`:262`, same style object).
**7.16 / 1.50 / 1.25 / 1.25.** 10px mono/700 → 4.5:1.
→ **`--color-ink-on-accent`**, flat swap.
*Do not touch* `:289` or `:147–156` in the same file — both CORRECT, see C3/C4.

#### B6 · `src/components/workout/overlays/SettingsPrimitives.tsx:292` — `GoalSelector`
Ink `--fs-heading` **flat** · fill `active ? 'var(--fs-accent)' : 'var(--fs-surface)'` (`:287`).
- active: **7.16 / 1.50 / 1.25 / 1.25** — fails 3 of 4
- inactive: 15.12 / 16.57 / 21.00 / 21.00 — correct today

→ **NEEDS A CONDITIONAL:** `active ? 'var(--color-ink-on-accent)' : 'var(--fs-heading)'`.
A flat swap fixes the active branch and breaks the inactive one in three states
(1.01 / 1.00 / 1.00). The fix already exists 130 lines above it — `ChipSelector`
at `:168`, with a comment stating this exact reasoning.

#### B7 · `src/components/workout/overlays/SettingsPrimitives.tsx:338` — `RestTimeSelector`
Identical shape to B6; fill at `:336`. Same numbers, same conditional.

#### B8 · `src/components/workout/WorkoutSummary.tsx:942–949` — workout rating buttons
**No `color` key at all.** The button renders `{r.value}` — the digit 1–5 at
`fontSize: 22`, no `fontWeight` — and inherits `body { color: var(--color-text) }`
(`global.css:30`) → `--fs-ink`. Fill is `workoutRating === r.value ? 'var(--fs-accent)' : 'var(--fs-surface-2)'`.
- selected: **7.67 / 1.50 / 1.25 / 1.25** — fails 3 of 4
- unselected: `--fs-ink` on `--fs-surface-2` — correct

22px unbolded is below the large-text threshold (24px, or 18.66px bold), so the
floor is 4.5:1, not 3:1.
→ **NEEDS A CONDITIONAL, and the `color` key must be ADDED:**
`workoutRating === r.value ? 'var(--color-ink-on-accent)' : 'var(--fs-ink)'`.
This is the inherited-ink variant of the family and the reason a sweep for
`color:` lines alone will always undercount it.

### CORRECT AS IS — 26 sites a mechanical sweep would have broken

**Conditional ink already tracking a conditional fill (10)** —
`SettingsPrimitives.tsx:168` · `RPEPicker.tsx:262` and `:208` (child span of the
`:193` fill) · `NumpadOverlay.tsx:271` · `PlateCalculatorOverlay.tsx:143` ·
`ActionChip.tsx:42` · `ReportReasonSheet.tsx:93` · `Program.tsx:301, 516, 664, 712` ·
`StrengthSection.tsx:110` · `MealTypeSelector.tsx:60` · `BarcodeScanner.tsx:275` ·
`ProfileStep.tsx:116` · `GoalsStep.tsx:114–116` · `ExerciseSelector/index.tsx:271, 292` ·
`CommentSheet.tsx:303` · `PostComposer.tsx:175` · `AgeGate.tsx:281` ·
`ConsentGate.tsx:163` · `PaywallScreen.tsx:92, 217` · `PurchasePanel.tsx:191`.
Active branch gets `--color-ink-on-accent`, inactive keeps a theme ink on a
theme surface. Already the shape B6/B7/B8 need.

**C2 · `SupersetPicker.tsx:196`** — flat `--color-ink-on-accent` on
`isSelected ? accent : transparent`. Looks like the inverse defect (near-black
ink on a dark surface, 1.01 / 1.00 / 1.00) — but the child is
`{isSelected && <Check …>}`, so **no ink exists in the unselected state**.
Correct, and the single most deceptive site in the file.

**C3 · `ExerciseReorderItem.tsx:289`** — `isExpanded ? '--fs-primary' : '--fs-muted'`
on `isExpanded ? accent : surface`. 7.16 / 11.57 / 12.10 / 15.85 active.
**C4 · `ExerciseReorderItem.tsx:147–156`** — `isActive ? '--fs-primary' : '--fs-muted'`
on a three-way fill. Same numbers.
Not the canonical token, but `--fs-primary` is near-black in all four states, so
both clear with margin. Re-pointing them at `--color-ink-on-accent` would be a
no-op improvement at the cost of a diff; leave them.

**C5 · `--fs-primary` on `--fs-signal` (2)** — `PRCelebrationBanner.tsx:72`,
`WorkoutSummary.tsx:678`. 13.15 / 17.22 / 13.15 / 17.22. This is the documented
`--color-on-mustard` pairing and the reason `--fs-primary` cannot move.

**C6 · `--fs-primary` on `--fs-accent` (5)** — `IconBox.tsx:20` ·
`WorkoutPlanScreen.tsx:289` · `ExerciseReorder.tsx:318–321` ·
`WorkoutSummary.tsx:1022–1024` · `TemplateCard.tsx:212` (icon-only chip).

**C7 · `components.css:1215–1216` — `.day-cell.rest`.** `--fs-ink` on
`color-mix(in srgb, var(--nav-pill-bg) 46%, var(--fs-plate))`. In dark and HC
`--nav-pill-bg` **is** `--fs-accent`, so this is a theme-varying ink on an
accent-derived fill — and it **passes**: fill resolves `#7e8c8d` / `#317364` /
`#4a7c6d` / `#4a7c6d`, giving **4.64 / 4.89 / 4.78 / 4.78**. Diluting the mint
to 46% is what makes it legal. Exactly the case a token-name-matching sweep
destroys.

**C8 · `typography.css:354–355` — `::selection`.** `--fs-ink` on
`--color-secondary-glow` (accent at 0.3 alpha) → **12.93 / 8.21 / 12.19 / 11.21**
composited over the surface. The alpha keeps the mint from ever dominating.

**C9 · `ConfirmExitOverlay.tsx:140`** — on-accent ink on `isFinishing ? accent : warn`;
on `--fs-warn` it reads 5.85 / 8.12 / 13.00 / 13.00.

**C10 · Properly-tokenized nav pairs (3)** — `components.css:1146, 1198, 627`
(`--nav-pill-bg` with `--nav-pill-text`) and `:150, 746, 372` (`--btn-primary-bg`
with `--btn-primary-text`). Both pairs invert together per state by construction.

### NOT IN FAMILY — ~25 accent *washes*, not accent fills
`color-mix(in srgb, var(--fs-accent) 8–20%, var(--fs-surface))` and
`rgba(var(--fs-accent-rgb), 0.07–0.18)` with `--fs-accent-2` or `--fs-accent`
ink — `ExerciseDisplay.tsx:129, 608, 798, 915` · `DropSetSheet.tsx:171` ·
`AlternativesSheet.tsx:172` · `SetInputCard.tsx:310` · `Dashboard.tsx:505, 572, 742` ·
`OverviewTab.tsx:115, 172` · `TemplateList.tsx:49` · `CoachHome.tsx:436` ·
`EmptyWorkoutState.tsx:76` · `WorkoutStreak.tsx:140` · `UltraCard.tsx:66` ·
`CoachMark.tsx:89` and others. These are tinted **surfaces** — the accent is a
minority ingredient and the fill still tracks the theme. Out of scope.

Also excluded, having checked each: **~40 decorative accent fills with no text** —
progress bars, 4px accent rails (`global.css:489, 514`), 8px dots
(`components.css:1604`, `NumpadOverlay.tsx:286`), calendar intensity cells,
`ProgressDots.tsx:33`, spinner arcs, `SlideToComplete.tsx:517`. Verified
self-closing or empty; a fill with no glyph has no text contrast obligation.

### ADJACENT — same family, non-text floor, 1 site
`global.css:280` declares `.chip { border: 1px solid currentColor; color: var(--fs-heading) }`.
`TemplateCard.tsx:210–212` keeps `className="chip"` and overrides only the
background to `--fs-accent`, so the **border** inherits `--fs-heading` through
`currentColor`: **1.50 / 1.25 / 1.25** against the 3:1 non-text floor of WCAG
1.4.11. The chip's glyph is fine (explicit `--fs-primary`). Reported, not
counted — it is a border, not ink, and I did not verify whether that chip's edge
is load-bearing for the control's findability. Cheapest fix if wanted: add
`borderColor: 'var(--fs-primary)'` alongside the inline background.

---

## 4. Count

| Verdict | Sites | Declarations |
|---|---|---|
| **BROKEN** | **8** | **12** |
| — flat swap sufficient | 4 (B1, B3, B4, B5) | 8 |
| — needs a conditional | 3 (B6, B7, B8) | 3 |
| — needs a token decision | 1 (B2) | 1 |
| **CORRECT AS IS** | **26** | — |
| Not in family (washes / decorative) | ~65 | — |
| Adjacent (non-text floor) | 1 | — |

Fails all four states: **1** (B2). Fails three of four: **7**.
Ratio of correct-looking-broken to actually-broken is roughly **3 : 1** — this
family cannot be fixed by pattern match.

The family is **smaller than feared**. Two of the three sites the brief named as
known are real; the third was already fixed. The five genuinely new sites are
concentrated in two places: the `.block-hero` block in `global.css`, and the
set-editing UI under `src/components/workout/`.

## 5. Suggested batches — file-exclusive, no file appears twice

| Batch | Files | Work |
|---|---|---|
| **A** | `src/styles/global.css` | B1 flat swap; **B2 needs the lead's call on the mix vs the flat token before it can be written.** Highest value — B1 alone repairs three inherited text roles, and B2 is the only 4-state failure. |
| **B** | `src/components/workout/reorder/SetEditRow.tsx`, `src/components/workout/reorder/ExerciseReorderItem.tsx` | B3, B5. Two flat swaps, one line each. Both files carry adjacent `--fs-heading` declarations that are correct — the "do not touch" lists in B3/B5 are the whole risk. |
| **C** | `src/components/workout/components/SetEditBottomSheet.tsx`, `src/components/workout/WorkoutSummary.tsx` | B4 (four flat swaps in one branch), B8 (add a `color` key with a conditional). |
| **D** | `src/components/workout/overlays/SettingsPrimitives.tsx` | B6, B7. Two conditionals, copying the pattern and comment already at `:161–168` in the same file. |

A, B, C, D are mutually independent and can run in parallel. B2 is the only item
gated on a decision; if the lead wants A to proceed unblocked, split B1 (swap)
from B2 (decide) — they are 13 lines apart in one rule and can be separate edits.

Whoever fixes these should add a regression guard. There is none today, and the
reason this family survived is mechanical: every existing audit sweeps for the
token it was chasing, and B8 has no `color` declaration to find at all. A guard
has to walk *fill → governing ink*, including inherited ink, not grep for a
token name.

## 6. Two corrections to the brief

1. **`SetEditBottomSheet.tsx` "around line 334" is not the site.** Line 334 is
   inside a button whose own fill is `--fs-surface`, and line 340/348 is
   `--fs-accent` ink on a `--fs-primary` fill — both correct. The real defect is
   a wrapper fill at **`:123–124`** governing `--fs-heading` at **`:141, 160,
   222, 303`** — four declarations, not one, and a descendant relationship rather
   than the sibling one at B3. My first sweep missed it too: the `background:`
   keyword and the `var(--fs-accent)` token are on different lines, so a
   single-line pattern cannot see it. I re-ran multi-line-aware to close that
   gap, which is also how B8 surfaced.
2. **`SettingsPrimitives.tsx:162` is already fixed.** It carries
   `active ? 'var(--color-ink-on-accent)' : 'var(--fs-heading)'` at `:168` plus a
   comment quoting 8.90 / 10.98 / 16.82 / 16.82 and the 1.50 / 1.25 failures. It
   is the model for B6/B7, which sit in the same file and were missed when it was
   fixed.

## 7. Also noticed — not touched, not part of this family

- `--fs-ink-muted` is undeclared in the HC block, so **light+HC and dark+HC
  resolve it differently** (`#f2f2f2` vs `#a3a3a3`). B2 is the only site where
  that reaches an accent fill, but the split is latent everywhere the token is
  used and contradicts the pinning discipline `tokens.css` states for
  `--fs-edge` / `--fs-panel`. `--fs-signal`, `--fs-primary` and `--fs-accent-2`
  are also undeclared there; for the first two the fall-through happens to be
  harmless, and `--fs-accent-2` differs between the HC states (`#2c7f91` vs
  `#38b5c9`) with the same latent risk.
- `--fs-accent-2` as ink on the accent *washes* reads 2.19 / 1.42 / 3.69 / 1.95
  against the undiluted mint. On the 8–20% washes those sites actually use it is
  fine, but any future site that puts `--fs-accent-2` on a full-strength accent
  fill joins this family immediately.

---

*Read-only pass. No file under `src/`, `e2e/` or any config was modified; no
gate, build, dev server or Playwright run was started; no git command was run.
Contrast arithmetic was done in throwaway inline PowerShell — no scratch script
was left on disk.*

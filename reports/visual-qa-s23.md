# Visual QA — s23 evidence round (Settings, `/settings`)

Verdict-from-evidence pass. No browser, no build, no dev server, no gates, no git were
run for this report. Everything below comes from the 20 `s23-*.png` files and
`visual-qa/s23-measure.json` already on disk, plus read-only source lookups used to
attribute a pixel finding to a line of code.

---

## 1 · Verdict

**PASS on the headline. The `מתקדם` expander trigger fix holds in the default light
theme: measured 5.09–5.49:1 against the real composited background, against a 4.5:1
text floor.** The predicted 5.11:1 is confirmed — it lands inside the measured band and
matches the two `i1` surfaces to within 0.06. The old 1.75:1 mint-on-pale-mint state is
gone: the glyph pixels are now `#256d5b` (`--fs-accent-text`), present at full token
value in every one of the four light crops.

High-contrast (light + `html.high-contrast`) is far above the floor at **15.01–16.22:1**.

Elsewhere on the screen the round surfaced **three findings, worst first: two medium,
one low-medium.** Nothing found is a blocker. Dark, dark+high-contrast and the 1280
width are **NOT CAPTURED** — see §2.

---

## 2 · Coverage — explicit

The capture round timed out half-way. What is on disk:

| State | Width | Captured? |
|---|---|---|
| light | 390 | **YES** — 10 PNGs |
| light + high-contrast | 390 | **YES** — 10 PNGs |
| dark | 390 | **NO — UNVERIFIED** |
| dark + high-contrast | 390 | **NO — UNVERIFIED** |
| any state | 1280 | **NO — UNVERIFIED** |

**Every statement in this report describes light @390 and light-hc @390 only.** No claim
here is transferred to dark, dark-hc or 1280. Where a mechanism is theme-dependent I say
so instead of extrapolating.

One naming trap worth recording: the `light-hc` combo is not a light surface. Its
fingerprint (`s23-measure.json`, record 16) resolves `--fs-bg: #000000`,
`--fs-surface: #000000`, `--fs-ink: #ffffff`, `--fs-accent-text: #8efad8`. The
high-contrast frames are black-background. Anyone reading "light-hc" as "pale" will
misread them.

Exercised: both `מתקדם` triggers collapsed and expanded, the two previously-unseen
groups `אימון והתראות` and `נתונים ופרטיות`, the two full-page stitches collapsed and
expanded, all 5 toggles in the אימון group and the 1 in the נתונים group, the rest-time
chip row, the legal-links rows, the cloud-sync card, the two revealed advanced panels.

`visual-qa/_summary.json` was **not read and is not cited**, per instruction.

---

## 3 · Method verification, before any verdict

Contrast was computed as WCAG 2.x sRGB relative luminance,
`(L_light + 0.05) / (L_dark + 0.05)`. Before trusting it I reproduced **17 contrast
figures this repo already publishes**. All 17 match; worst absolute delta **0.005**.

| Published figure | Repo says | This pass | Δ |
|---|---:|---:|---:|
| `--fs-ink` on `bg` / `surface` / `surface-2` (`reports/04-A11Y-RTL-HEBREW.md:21`) | 14.43 / 16.19 / 12.67 | 14.43 / 16.19 / 12.67 | 0.00 |
| `--fs-muted` on `bg` / `surface` / `surface-2` (same table) | 6.25 / 7.01 / 5.49 | 6.25 / 7.01 / 5.49 | 0.00 |
| `--fs-accent` on `bg` / `surface` / `surface-2` (same table) | 1.88 / 2.11 / 1.65 | 1.88 / 2.11 / 1.65 | 0.00 |
| `--fs-link` on `surface` (same table) | 6.62 | 6.62 | 0.00 |
| `--color-ink-on-accent` on `--fs-accent` (same table) | 8.90 | 8.90 | 0.00 |
| `--fs-warn` / `--fs-error` on `surface` (same table) | 3.21 / 4.64 | 3.21 / 4.64 | 0.00 |
| `--fs-accent-text` on `#fff` / `--fs-bg` / mesh `#dceee9` / `--fs-surface-2` (`src/styles/tokens.css:36-39`) | 6.15 / 5.48 / 5.11 / 4.81 | 6.15 / 5.48 / 5.11 / 4.81 | 0.00 |

Method verified. Proceeding.

### The measure JSON's foreground sampler is unusable as a text verdict — demonstrated here

The brief warned about this trap under the name `inkOnFill`. This JSON does not carry
that field; the equivalent is `sampledForeground`, and its own `meta.colorSampling`
admits the mechanism: *"pixel furthest from it in RGB Euclidean distance among colours
with share >= 0.004"*. In this dataset it fails exactly as predicted:

- `s23-label-metkadem-i1-light-390-row.png` — JSON `sampledForeground` = `#d9e4e1`
  against `#dfeaea`. Taken as the text colour that is **1.06:1**. The actual label ink in
  that same PNG is `#256d5b` at **5.00:1**.
- `s23-label-metkadem-i2-light-390-row.png` — JSON `sampledForeground` = `#dbe6e3`
  against `#eef3f1` → **1.14:1**. Real label ink: **5.48:1**.

In both cases the sampler locked onto a divider/border tint and discarded the glyphs. It
would have invented a catastrophic defect. Every contrast number in this report is
sampled from the PNG pixels directly.

---

## 4 · The headline question — trigger contrast in default light

`--fs-accent-text` = `#256d5b` = rgb(37, 109, 91). Relative luminance **0.12086**.

The token is not merely *specified* — it is *painted*. Each 44×23 tight crop contains
**17–19 pixels at exactly `#256d5b`** (1.7–1.9% of the crop), which is the expected
fully-opaque stroke-core count for a 13px/600 Hebrew word at dpr 1. The measure JSON
independently records `computedColor: "rgb(37, 109, 91)"` on all three triggers.

| PNG | measured local background | L(bg) | ratio | verdict |
|---|---|---:|---:|---|
| `s23-label-metkadem-i1-light-390.png` | `#e3edec` | 0.82955 | **5.15:1** | pass |
| `s23-label-metkadem-i2-light-390.png` | `#edf4e7` | 0.88475 | **5.47:1** | pass |
| `s23-label-metkadem-i1-open-light-390.png` | `#e1eceb` | 0.81997 | **5.09:1** | pass |
| `s23-label-metkadem-i2-open-light-390.png` | `#eef4ea` | 0.88819 | **5.49:1** | pass |
| `s23-label-metkadem-i1-light-390-row.png` | `#dfeaea` | 0.80474 | **5.00:1** | pass |
| `s23-label-metkadem-i2-light-390-row.png` | `#eef3f1` | 0.88629 | **5.48:1** | pass |

Arithmetic, worked for the tightest case (`i1` expanded, the lowest of the six):

```
L(#256d5b) = 0.12086
L(#e1eceb) = 0.81997
ratio = (0.81997 + 0.05) / (0.12086 + 0.05)
      = 0.86997 / 0.17086
      = 5.092
```

Floor is 4.5:1. Worst measured case clears it by **13%**. The prediction of 5.11:1 was
made for the accent-mesh surface `#dceee9`; the surfaces that actually composited under
the two triggers are `#e1eceb`/`#e3edec` (i1) and `#edf4e7`/`#eef4ea` (i2), so the real
result is 5.09–5.15 for i1 and 5.47–5.49 for i2. **Prediction confirmed, slightly
conservative for i2.**

High-contrast, same triggers, `#8efad8` ink:

| PNG | background | ratio |
|---|---|---:|
| `s23-label-metkadem-i1-light-hc-390.png` | `#040909` | **16.04:1** |
| `s23-label-metkadem-i2-light-hc-390.png` | `#111308` | **15.01:1** |
| `s23-label-metkadem-i1-open-light-hc-390.png` | `#060c0c` | **15.78:1** |
| `s23-label-metkadem-i2-open-light-hc-390.png` | `#0c0d06` | **15.63:1** |

Both `מתקדם` triggers also report a DOM box of exactly **350 × 44** in
`s23-measure.json` (records 4, 12, 20, 28) — the 44px target floor is met, in both
collapsed and expanded phases, in both captured themes.

---

## 5 · Findings

### F1 · MEDIUM — two toggle styles on one screen disagree about what a dark knob means

**Evidence:** `s23-group-imun-vehatraot-light-390.png` (5 toggles) vs
`s23-group-netunim-ufratiut-light-390.png` (1 toggle), both light @390.

Sampled inside the track (x 38–88) of each control:

| Control | State | Track | Knob | Knob position |
|---|---|---|---|---|
| `אימון והתראות` rows (×3 ON) | ON | `#43c7a5` 45% | `#ffffff` | left of centre (cx 54.9, mid 63) |
| `אימון והתראות` rows (×2 OFF) | OFF | `#dbe6e3` 45% | `#132327` | right of centre (cx 69.4) |
| `מעקב אנליטיקה ויציבות` | ON | `#43c7a5` 50% | `#071412` | left of centre (cx 50.5) |

So on the same screen, at the same moment: a **near-black knob means OFF** in the
notifications card and **ON** in the privacy card. The two knob colours are
`#132327` and `#071412` — **1.16:1 apart, i.e. the same colour to the eye.**

Position still differentiates (both components animate `insetInlineStart`, so ON is
left and OFF is right in RTL — correctly mirrored), but colour is a strong conflicting
signal layered on top of it.

**Suspected location:** `src/pages/settings/sections/LegalLinksSection.tsx:84-95` renders
a bespoke `role="switch"` whose knob is `analytics ? var(--color-ink-on-accent) :
var(--fs-muted)`. The canonical component,
`src/components/ui/SettingsToggle.tsx:153`, is `checked ? var(--fs-surface) :
var(--fs-ink)` — and carries a comment explaining that the knob must invert per state.
The bespoke copy does not inherit that.

**Expected:** one switch appearance per screen; knob colour meaning the same thing in
every card.
**Actual:** two appearances; knob colour inverted between them in the default theme.

Theme-scoped: in `light-hc` the two happen to agree (shared ON knob resolves to
`--fs-surface` = `#000000`, bespoke ON knob is `#071412` — both dark on mint;
`s23-group-imun-vehatraot-light-hc-390.png` shows `#8efad8` 45% / `#000000` 29% /
`#ffffff` 13%). **So this is a default-light-theme defect.** Dark and dark-hc are
UNVERIFIED.

### F2 · MEDIUM — the same bespoke switch is a 30px tap target inside a previously-unseen group

**Evidence:** `s23-group-netunim-ufratiut-light-390.png`, the
`מעקב אנליטיקה ויציבות` row. The painted track measures **32px tall** in the PNG
(band y 573–604).

Source confirms there is no larger hit area:
`src/pages/settings/sections/LegalLinksSection.tsx:66-79` declares `width: 52,
height: 30`, `border: 'none'`, no padding wrapper. The canonical component
(`src/components/ui/SettingsToggle.tsx:114-120`) does the opposite — an explicit
`minWidth: '44px', minHeight: '44px'` wrapper around the same 52×32 visual track, with
the comment *"Tap target ≥44×44 (a11y); the visual track inside stays ~32px tall."*

**Expected:** 44×44 per the product contract already tracked in
`reports/04-A11Y-RTL-HEBREW.md` (P2, 44px targets).
**Actual:** 52×30. 14px short on the cross axis.

This sits in one of the two groups no previous round had captured, which is why it has
not been reported before.

### F3 · LOW-MEDIUM — the disabled `סנכרון מלא` label is effectively unreadable

**Evidence:** `s23-group-netunim-ufratiut-light-390.png`, pill interior y 222–254,
x 60–330. Fill `#a1a9ab` (67% of the interior). The label's brightest pixel is
`#b3e9db` → **1.78:1**. No pixel anywhere in the pill is within ±10 of `--fs-accent`,
so the mint has been blended away by the disabled opacity, not merely darkened.
In `light-hc` (`s23-group-netunim-ufratiut-light-hc-390.png`): fill `#396456`, label
extreme `#000000` → **3.13:1**.

**Not a WCAG failure, and I am not filing it as one.**
`src/pages/settings/sections/CloudSyncSection.tsx:145-156` renders the button with
`disabled={disabled}`, and WCAG 1.4.3 exempts inactive user-interface components. The
report-worthy part is product-side: this is the card's *only* primary action, it is
disabled precisely in the state a new user arrives in (`לא מחובר`, with the explanatory
`התחברו לחשבון כדי לסנכרן את הנתונים עם הענן.` right above it), and at 1.78:1 the user
cannot read what the greyed control would even do.

### Measured, below my filing threshold — stated so the numbers exist

- **Expander trigger border is invisible.** `--fs-surface-2` `#dbe6e3` against the
  trigger's own background: **1.04:1** (i1 row) and **1.14:1** (i2 row); in hc,
  `#111111` at 1.06:1 / 1.11:1. Not a 1.4.11 failure — the 5.09:1 label plus the chevron
  identify the control on their own — but the border is decorative in practice.
- **Shared toggle's ON knob vs its track is 2.11:1** (`#ffffff` on `#43c7a5`), under the
  3:1 an indicator would want. The 2px `--fs-ink` outline supplies the component
  boundary at 16.19:1 against the card, and the OFF state is 12.67:1, so the control is
  identifiable and its state is carried by position as well as colour.
- **Antialiasing at dpr 1.** Across the four light tight crops, only 10–17% of inked
  pixels reach 4.5:1; the median inked pixel is 2.44–2.53:1. This is normal for 13px/600
  text and is *not* a defect — WCAG evaluates the specified foreground, which is present
  at full value. Recorded because the same distribution on a real dpr 2–3 phone is
  UNVERIFIED.

### A false defect I nearly filed — documented as a method note

The selected rest-time chip's navy fill measures **42px tall** (bbox y 132–173 in
`s23-group-imun-vehatraot-light-390.png`), which reads as 2px under the 44px floor. It
is not: `src/pages/settings/sections/WorkoutPrefsSection.tsx:55-63` sets
`minHeight: '44px'` with a `1px solid` border, so 44 − 2×1 = 42px of visible fill. The
outlined chips confirm it — their border rows run y 131–174 and y 183–226, i.e. **44px
outer**. Measuring paint alone would have produced a bogus bug.

---

## 6 · The two previously-unseen groups — judgement

Both are **coherent, unclipped and free of overlap** in both captured themes. Details:

**`אימון והתראות`** — `s23-group-imun-vehatraot-light-390.png`,
`-light-hc-390.png`.
Contains a rest-timer card (`זמן מנוחה ברירת מחדל` + 5 chips), two workout toggles
(`התחלה אוטומטית של טיימר`, `רטט (Haptic Feedback)`), then a `התראות` sub-label with
three notification toggles (`תזכורת אימון`, `התראת שיא אישי (PR)`,
`התראות בזמן אמת` with a two-line description). Grouping is coherent: timing and
haptics, then alerts. Nothing is truncated inside the frame; the two-line description
row expands its card rather than clipping.

**`נתונים ופרטיות`** — `s23-group-netunim-ufratiut-light-390.png`,
`-light-hc-390.png`.
Contains the cloud-sync card (`לא מחובר`, `בהמתנה: 0`, explainer, disabled
`סנכרון מלא`), a single-row `דוח שבועי` card, a `משפטי ופרטיות` sub-label with three
link rows (`תנאי שימוש`, `מדיניות פרטיות`, `הצהרת נגישות`) plus the analytics switch,
the collapsed `מתקדם` trigger, and the head of `אזור מסוכן`. Coherent. The one-row
`דוח שבועי` card is a slightly lonely container but reads fine and is not a defect.

**Touch targets, what is actually provable:** the only DOM rects in the evidence are the
three expander triggers (350×44 — pass). Chips are 44px by CSS (§5 method note).
Toggles: canonical ones are 44×44 by CSS, the bespoke one is 30px (F2). Link rows in the
legal card paint ~50px tall but their hit rects are **not in the evidence** — plausible,
not proven.

**RTL, what the pixels prove:**
- Row icons sit at the **start (right)** edge, labels right-aligned beside them, controls
  at the left — correct for RTL, and consistent across every card in both frames.
- Drill-in chevrons on the legal rows point **left** — correct forward direction in RTL
  (`ChevronLeft`, `LegalLinksSection.tsx:56`).
- `בהמתנה: 0` renders with the colon bound to the Hebrew word and the numeral to its
  left — correct, not a stray-punctuation bug.
- **Hebrew+number order is correct, and I proved it rather than eyeballing it.** In the
  selected chip the label ink splits into two glyph clusters, x 160–172 and x 180–193.
  Rasterising each: the **right** cluster contains two closed forms with enclosed
  counters (7 enclosed pixels in 3 blobs), the **left** cluster is a dense mass with 2
  (antialiasing only). Digits `9` and `0` enclose counters; `ש` and `נ` do not.
  So the numeral is on the right and the unit `שנ` on its left — which is exactly the
  bidi-correct rendering of the logical string `'30 שנ'`
  (`src/pages/settings/types.ts:104-110`, number-first, no isolation wrapper). **No
  reversed string.**
- Nothing overflows 390px in either frame; the chip row wraps to a second line that is
  right-aligned, i.e. wrapping follows RTL flow.
- Selected chip label `--fs-accent` on `--fs-primary` = **7.16:1** measured (33 pixels at
  full token value inside the chip). Passes AA.

**Group headings:** the JSON verifies both by DOM (`verifiedText` matches
`requestedHeading`, colour `rgb(19, 35, 39)` light / `rgb(255, 255, 255)` hc). In their
own frames both headings sit at y ≈ −0.2 / −0.5, i.e. behind the sticky page header, so
those two frames do not *show* them. Both are nonetheless pixel-verified elsewhere in
this same evidence set: `נתונים ופרטיות` renders in the clear at the foot of
`s23-group-imun-vehatraot-light-390.png`, and `אימון והתראות` renders in the clear in
`s23-settings-expanded-light-390.png` at document y ≈ 1590.

---

## 7 · The expanded state

**It works.** `s23-settings-expanded-light-390.png` / `-light-hc-390.png` plus the four
`-open-` label crops.

- **Disclosure fires.** `s23-measure.json` records `ariaExpandedAfterClick: "true"` for
  both triggers in both captured themes (records 10, 11, 26, 27), and the follow-up
  inventories (12, 28) show `ariaExpanded: "true"` persisting.
- **Chevron state is clear.** Collapsed frames show the chevron pointing **down**;
  in the expanded stitch both triggers show it pointing **up**. Unambiguous.
- **Revealed content belongs to its group — confirmed structurally, not guessed.** Under
  the display group's trigger the panel reveals a `הדרכה` sub-label and a
  `הצגת ההדרכה מחדש` row with a `הצג` button. That looked at first glance like a new
  top-level section, so I checked: `src/pages/Settings.tsx:248-250` wraps
  `<GuidanceSection />` inside `<AdvancedSection id="settings-display-advanced">`, and
  `GuidanceSection.tsx:18` is where `הדרכה` comes from. It is genuinely inside the group.
  Visually the hierarchy holds too — the revealed `הדרכה` sub-label is rendered smaller
  and lighter than the group title `אימון והתראות` immediately below it.
  The data group's panel reveals export/backup rows
  (`ייצוא היסטוריית אימונים (CSV)`, `גיבוי מלא (JSON) — נתוני המכשיר`,
  `שחזור מגיבוי (JSON)`) plus a directional-sync explainer with
  `הורידו מענן` / `העלו לענן`. Squarely `נתונים ופרטיות` material.
- **No layout jump that the stills can show.** Document height goes 3551 → **4194**, so
  the two panels insert **643px** below their triggers. The triggers keep their x/width
  (20 / 350) and 44px height across collapsed and expanded inventories. No overlap, no
  content pushed under a neighbour, no clipped card edge at either insertion point.
- **Trigger contrast does not regress when open** — 5.09:1 and 5.49:1 expanded, vs
  5.15:1 and 5.47:1 collapsed (§4). Within a pixel of each other.
- Latin-in-Hebrew inside the revealed rows (`(CSV)`, `(JSON)`) renders with the
  parenthesised Latin at the left end of the Hebrew phrase and the parens correctly
  oriented, as far as the raster shows.

---

## 8 · What the pixels prove vs. what I infer

**Proven from pixels in these PNGs:** every contrast ratio in §4, §5 and §6; the knob
colours, sizes and positions in F1; the 32px painted track in F2; the disabled label's
1.78:1 and 3.13:1; the 42px navy chip fill and 44px outlined chip; the digit-cluster
geometry establishing correct Hebrew+number order; the chevron up/down states; the
absence of clipping and overlap in the four group frames; the two group headings
rendering in the clear in adjacent frames.

**Proven from `s23-measure.json` (DOM, not pixels):** the 350×44 trigger boxes; the
`computedColor` on all three triggers; `ariaExpanded` before and after the clicks; the
3551 → 4194 document growth; the heading text match; the `light-hc` token fingerprint.

**Read from source, only to attribute a pixel finding to a line:** the two toggle
implementations (F1, F2), the `disabled` prop on the sync button (F3), the chip
`minHeight: 44px` (method note), the panel ownership of `הדרכה` (§7), the chip label
strings (§6).

**Inferred, and labelled as inference:** that F1 will also mismatch in dark (the two
components resolve different token pairs, and only light and light-hc are captured — dark
is UNVERIFIED); that the legal-row hit rects are ~50px (painted height only); that
real-device dpr 2–3 stroke rendering resembles these dpr 1 crops.

**Capture artifact, not a product bug:** the two stitched PNGs are assembled from
successive 844px clip-screenshots (`meta.captureMethod`), so each seam bakes in a copy of
the sticky page header and the floating bottom nav mid-image. Vertical rhythm *across a
seam* cannot be judged from these files. I did not file anything based on a seam.

---

## 9 · Could not determine, and why

1. **Dark and dark+high-contrast at any width** — not captured; the round timed out.
   Everything about them is UNVERIFIED, including whether F1's knob-colour contradiction
   exists there (the two components resolve different tokens, so it must be measured, not
   reasoned).
2. **The 1280 desktop width** — not captured. No claim about desktop layout, wrapping or
   the chip row at wide viewports.
3. **Motion, animation and jank** — stills only. Whether the 643px disclosure animates
   smoothly, whether `prefers-reduced-motion` is honoured at runtime, and whether opening
   a panel causes a visible jump *in time* cannot be answered from PNGs.
4. **Keyboard focus** — no focused state was captured. Focus-ring visibility and contrast
   on the triggers, chips and switches are unverified.
5. **Screen-reader output** — out of reach from pixels. The `aria-expanded` /
   `aria-controls` / `role="switch"` wiring is present in the JSON and source, but no
   announcement was heard.
6. **Hit rects for anything without a DOM box** — only the three triggers carry one. The
   legal link rows, the sync button and the chip row's own container are painted-size only.
7. **The chevron glyph's own colour** — the tight crops enclose only the 38.1×17 text box,
   and in the row crops the chevron contributes almost no fully-opaque pixels (its stroke
   is thin and antialiased). It inherits the trigger's `computedColor` per the JSON, but I
   did not measure it independently.
8. **Whether the group headings are occluded in real use** — in these frames they sit at
   y ≈ 0 behind the sticky header, but that is the capture's scroll choice
   (`scrollTopAtCapture` 1452 and 2175), not evidence about a user's scroll position.
9. **Everything outside each group frame's single 844px window** — `אזור מסוכן` in
   particular is only visible as a heading plus the top edge of its card; its contents
   are uncaptured.
10. **Offline / IndexedDB, mid-workout reload, empty and rest-day states** — no such
    frames exist in this round.

---

*Written from evidence on disk. A throwaway pixel-analysis script was used for the
sampling and arithmetic in §3–§7 and has been deleted, along with its intermediate
crops, from the session scratch directory. No file under `src/`, `supabase/`, `e2e/` or
any config was modified.*

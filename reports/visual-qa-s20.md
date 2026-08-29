# s20 — Settings rebuild + high-contrast round trip: visual QA verdict

Analysis-only run. No browser, no server, no build, no test, no gate, no git — every figure
below comes from PNGs and JSON already on disk under `visual-qa/`, read as pixels.

---

## 1. Verdict

**The bug fix PASSES. The screen FAILS QA.**

The round trip proves the high-contrast fix at 390: shot 06 shows exactly one switch drawn in
the ON state and it is `ניגודיות גבוהה`; shot 07 shows exactly two, `מצב כהה` **and**
`ניגודיות גבוהה`, in the same frame. Neither the read-back nor the dark-mode toggle destroys
the preference.

The screen fails on something else: in the **default light theme** the three progressive-disclosure
triggers that the whole rebuild hangs on (`פרופיל ציבורי`, `מתקדם` ×2) are painted in brand mint on
a pale mint card at **1.75:1** (390) / **1.68:1** (1280) against a 4.5:1 floor. This repo already
documents that exact token as forbidden for text on light surfaces.

And a third thing that is neither: **the evidence itself is truncated.** All eight full-page
Settings captures, plus shots 06 and 07, paint only their first 1500 px and then carry ~1980 px of
blank canvas. Groups 4 (`אימון והתראות`) and 5 (`נתונים ופרטיות`) were never photographed in any
frame. Question 2 cannot be answered visually for 40% of the structure it asks about.

---

## 2. Method, verified before use

Luminance, WCAG 2.x sRGB (identical to the formula in `e2e/settings-s20.spec.ts`):

```
c_lin = (c/255) <= 0.03928 ? (c/255)/12.92 : (((c/255)+0.055)/1.055)^2.4
L     = 0.2126*R_lin + 0.7152*G_lin + 0.0722*B_lin
ratio = (Lmax + 0.05) / (Lmin + 0.05)
```

Reproducing three ratios this repo already publishes, by hand, before trusting any new number:

| Published | Source | My arithmetic | Match |
|---|---|---|---|
| `--fs-ink` on `--fs-surface` = **16.19:1** | `reports/04-A11Y-RTL-HEBREW.md:19` | `#132327` on `#ffffff` → L 0.014871 / 1.0 → **16.19** | ✅ |
| Ink on active nav fill = **15.12:1** light | `src/styles/components.css:1131` | `#ffffff` on `#16292d` → L 1.0 / 0.019433 → **15.12** | ✅ |
| Ink on active nav fill = **10.98:1** dark | same comment | `#4ddcbb` on `#071412` → L 0.563544 / 0.005883 → **10.98** | ✅ |

Three for three. The method is sound, so the figures below stand.

### The `inkOnFill` trap, confirmed and corrected

The warning was accurate. `s20-measure.json` reports `inkOnFill: 1.08` for
`s20-txt-advanced-trigger-light-390.png`. The spec's `palette()` (`e2e/settings-s20.spec.ts`,
`if (n / total < 0.005) continue`) rejects any colour holding under 0.5% of the crop — and a
six-glyph Hebrew word inside a 350×45 button is ~0.14% of it, so every real glyph colour is
discarded and the "ink" ends up being a neighbouring fill. I replaced the share floor with an
**absolute floor of 8 pixels**, which keeps antialiasing fringe out while letting stroke cores
through. Same crop, corrected: **1.75:1**.

Both methods agree on the only thing that matters here — that crop contains no 4.5:1 text at all.
Every "measured" figure below is my corrected pass; where I quote the spec's own number I say so.

---

## 3. Coverage — what was actually exercised

| Exercised | How |
|---|---|
| HC round trip, 9 frames @390 | frame-by-frame palette + ON-track band geometry |
| Settings, 4 theme states × 2 widths | painted-extent scan, per-row ink extents, modal fills |
| 24 text crops | corrected fill-vs-glyph-core contrast, all 8 states × 3 surfaces |
| Touch targets, overflow, bidi strings, switch states, expander states | `s20-measure.json` DOM audit, all 8 combos |
| Switch ON/OFF ground truth | cross-referenced against the labelled `hc-toggle-{on,off}-*` crops |

Not exercised: anything requiring a browser. Frames were not re-captured.

---

## 4. Findings, worst first

### F1 — HIGH — light theme: expander trigger labels at 1.75:1, on the rebuild's core affordance

The three `button[aria-expanded]` controls are the rebuild's entire depth mechanism. In the light
theme their label is brand mint on a pale mint card.

**Evidence.** `visual-qa/s20-txt-advanced-trigger-light-390.png` — 350×45, modal fill `#dceee9`,
highest-contrast colour present anywhere in the crop `#43c7a5` at **1.75:1** (22 px). Hand check:
L(`#43c7a5`)=0.447475, L(`#dceee9`)=0.822503 → 0.872503/0.497475 = **1.75**. The 1280 crop
(`-light-1280.png`, 1240×45) measures **1.68:1**.

**Floor applied: 4.5:1** (WCAG 1.4.3). The label is ~15 px and not bold, so it is not "large text"
and the 3:1 large-text allowance does not apply.

**Not a one-off token accident.** `reports/04-A11Y-RTL-HEBREW.md:21` already states
`--fs-accent` on bg/surface/surface-2 = 1.88 / 2.11 / 1.65:1 and — in the report's own words —
`נכשל לטקסט ולרכיב UI; אין להשתמש בו לטקסט על משטחים בהירים`. `src/styles/tokens.css:26-28` repeats
it and offers `--fs-link` (`#1d6575`) as the compliant alternative.

**Repro**
1. Open `/settings` in the light theme at 390 (default state: `darkMode:false`, `highContrast:false`).
2. Look at the `פרופיל ציבורי` trigger under `הפרופיל שלי`, and the `מתקדם` trigger under
   `תצוגה ונגישות`.
3. Expected: label ≥4.5:1 against the card. Actual: 1.75:1.

**Expected vs actual.** Expected a legible trigger label; got mint-on-mint, at the one control a
user must find to reach the settings that were moved behind it.

**Scope.** The crop set only measured trigger #1. Trigger #2 (`מתקדם`, `תצוגה ונגישות`) is visibly
the same mint treatment in `s20-settings-light-390.png` at y≈1020-1032 and in
`s20-settings-light-1280.png`. Trigger #3 sits below the painted region and is inferred, not seen.
Dark and both HC states pass comfortably: 10.74 / 10.96 / 15.72 / 15.13 / 14.38 / 14.38:1.

**Suspected location:** unknown. The mint is `--fs-accent` (`src/styles/tokens.css:22`); which rule
applies it to the expander trigger was not traced — that needs the component source, not the PNGs.

---

### F2 — HIGH (evidence defect, not product) — every full-page capture is truncated at one viewport

Measured painted extent, threshold 0.02 luminance delta from the modal fill:

| PNG | canvas | inked rows | blank tail |
|---|---|---|---|
| `s20-settings-light-390.png` | 390×3471 | y0..1499 | **1971 px** |
| `s20-settings-light-hc-390.png` | 390×3471 | y0..1486 | 1984 px |
| `s20-settings-dark-390.png` | 390×3471 | y0..1488 | 1982 px |
| `s20-settings-dark-hc-390.png` | 390×3471 | y0..1486 | 1984 px |
| `s20-settings-{light,light-hc,dark,dark-hc}-1280.png` | 1280×3281 | y0..~1490 | ~1790 px |
| `s20-rt-390-06-settings-hc-on.png` | 390×3471 | y25..1486 | 1984 px |
| `s20-rt-390-07-settings-dark-hc-still-on.png` | 390×3471 | y26..1486 | 1984 px |

Bucketed inked-row counts are non-zero for every 250 px band up to 1500 and **exactly zero** for
every band after it. The fixed bottom nav is stamped at y≈1445-1484 — the bottom of the first
viewport — with nothing below.

The spec's own header names the cause: *"`fullPage: true` captures only the first viewport in this
app because the scrolling box is the inner `#main-content`, not the document."* Switching to
element screenshots (`shootEl`) sizes the canvas to the element's full 3471 px box but does not fix
the underlying problem: the inner scroll container never scrolls, so nothing below the first
viewport is ever composited.

**Consequence.** Groups `אימון והתראות` and `נתונים ופרטיות`, two of the three `מתקדם` triggers, and
six of the ten switches appear in **no frame**. The DOM audit confirms they exist (5 `h2`s, 3
expanders all `aria-expanded=false`, 10 switches, `overflowing: []`) — but "does the structure hold
visually" is unanswerable for them. See §5.

**Fix belongs in `e2e/`**: scroll `#main-content` and stitch, or capture per-group element shots.

---

### F3 — MEDIUM — three native `<select>` controls are 20.6 px tall, in all eight states

From the DOM audit, byte-identical across all 4 combos × 2 widths:

| control | size @390 | size @1280 |
|---|---|---|
| `מין` | 46.4 × **20.6** | 46.7 × **20.7** |
| `מטרת משקל` | 82 × **20.6** | 82.4 × **20.7** |
| `רמת פעילות` | 70.4 × **20.6** | 70.7 × **20.7** |

**Floors.** 20.6 px fails the project's own 44 px rule, fails WCAG 2.2 SC 2.5.5 (44×44, AAA), and
fails even SC 2.5.8 Target Size (Minimum) at **24×24 CSS px, AA**. Under 24 px there is no spacing
exception to fall back on. Visible in `s20-settings-light-390.png` at y≈539-886 as the
`נקבה` / `עלייה במסה` / `פעיל מתון` rows.

---

### F4 — MEDIUM — a `role="switch"` with no accessible name, 52 × 30 px

The tenth entry in every `switches` array is `{"name": "", "checked": "true"}`, and the only switch
in `smallTargets`: `{"role":"switch","w":52,"h":30}`. Present in all eight states. A switch with an
empty accessible name is announced as unlabelled by NVDA/JAWS/VoiceOver, and 30 px fails the 44 px
rule (the other nine switches do not appear in `smallTargets`, so their hit boxes clear 44 — only
their 48×28 visual track is smaller).

Cannot be seen: this switch sits below y1500 in every capture (F2). Location unknown.

---

### F5 — MEDIUM (desktop only) — at 1280 the cards are full-bleed, so each label and its control are ~1150 px apart

`s20-settings-light-1280.png`: the cards span essentially the whole 1280 px viewport with no
max-width. Every row puts its Hebrew label flush right and its control flush left. Measured heading
runs sit at x1147..1259 (rightGap 20-24 px) while the paired inputs sit at x≈27-140 — `שם` and its
text field are ~900 px apart; `מצב כהה` and its switch ~1150 px apart.

Related, same shot: the expander trigger label is **dead-centre in a 1240 px control** —
`s20-txt-advanced-trigger-light-1280.png` is 1240 px wide and its 84 px of label ink measures
leftGap 599 / rightGap 597. Every other label on the screen is flush right; these two are centred.

This is a phone-first app, so I am not calling it a blocker — but at 1280 the label/control pairing
is broken, and 1280 is one of the two widths this evidence set exists to cover.

---

### F6 — LOW — the `משפטי ופרטיות` label renders on inverted surfaces at 390 vs 1280 (light theme)

| crop | modal fill | glyph core | ratio |
|---|---|---|---|
| `s20-txt-legal-label-light-390.png` | `#132327` (dark navy) | `#eff4ef` | 14.53:1 |
| `s20-txt-legal-label-light-1280.png` | `#eef3f1` (page) | `#122226` | 14.60:1 |

Same label, same theme, opposite polarity: light glyphs on a dark chip at 390, dark glyphs on the
light page at 1280. Both clear 4.5:1 comfortably, so this is cosmetic, but it means the element is
styled or nested differently per width. I cannot see it in context — it is below y1500 in both
full-page shots (F2).

---

### F7 — LOW — near-duplicate copy: group `נתונים ופרטיות` containing a label `משפטי ופרטיות`

Group heading 5 is `נתונים ופרטיות`; the crop set proves a card label `משפטי ופרטיות` exists. Two
labels sharing `ופרטיות` inside one group is the near-duplication the brief asks about. I could not
put them in one frame (F2), so I cannot judge how adjacent they read. Flagging, not asserting.

---

### F8 — INFO — 401s in the console, no page errors

`s20-roundtrip-390.json` records 3 × `Failed to load resource: the server responded with a status
of 401 ()`; `s20-measure.json` records 8. No `pageerror:` entries in either, so nothing threw.
Consistent with a `skip_auth` guest hitting an authenticated endpoint, but I did not verify which
request 401s — that needs a network log this evidence set does not contain.

### F9 — INFO — high contrast overrides the light/dark choice entirely

`s20-settings-light-hc-390.png` and `s20-settings-dark-hc-390.png` both have a modal fill of
`#000000` at 79% / 78.9% share, and differ from each other in only **0.34%** of pixels. For
comparison, `dark` vs `dark-hc` differ in **26.58%**. So switching `ניגודיות גבוהה` on collapses
light and dark to one near-identical black palette; the residual 0.34% is almost entirely the ON
switch track (`#8efad8` in light+HC vs `#318d78` in dark+HC). Whether that is intended is a design
question, not a defect I can call — but it is why §5 has to prove dark mode via track colour rather
than page colour.

---

## 5. The six questions, answered

### Q1 — Does the round trip prove the fix? **Yes, at 390.**

I established the ON/OFF rendering convention first, from the labelled crops of the earlier capture
set, then confirmed it against a frame whose state is independently known.

| labelled crop | track | verdict cue |
|---|---|---|
| `hc-toggle-on-light-hc-390.png` | `#8efad8` 32.3% | ON = filled bright-mint track |
| `hc-toggle-off-light-hc-390.png` | `#111111` 42.5% + `#ffffff` 36.3% | OFF = dark track, white ring/knob |
| `hc-toggle-on-dark-hc-390.png` | `#318d78` 42.4% | ON = filled teal track |
| `hc-toggle-off-dark-hc-390.png` | `#111111` 42.5% + `#ffffff` 36.3% | OFF, identical to light-HC OFF |

Confirmation the convention reads correctly: in `s20-settings-dark-hc-390.png` (DOM: `מצב כהה`
true, `ניגודיות גבוהה` true, the other two false) the `#318d78` ON-track scan returns **exactly two**
bands, y1076-1103 and y1296-1323. In `s20-settings-light-390.png` (all four false) the ON-track scan
returns **zero** bands. No false positives, no false negatives.

Switch row geometry, from track-band scan (48 px wide, x39-86): row 1 `מצב כהה` y≈1074, row 2
`הפחתת אנימציות` y≈1148, row 3 `טקסט גדול` y≈1221, row 4 `ניגודיות גבוהה` y≈1296 — DOM order, top
to bottom.

**Shot 06, `visual-qa/s20-rt-390-06-settings-hc-on.png`** (after the user toggled HC inside the
workout and left it). Scanning for the light-HC ON track `#8efad8`:

```
ON-track y263-310   x38-351   <- the 314px-wide התחברות או הרשמה CTA, not a switch
ON-track y1296-1323 x39-86    <- switch row 4 = ניגודיות גבוהה : ON
ON-track y1445-1484 x27-75    <- the bottom-nav active pill, not a switch
```

y1074 (`מצב כהה`) is **absent** — dark mode correctly still off. So the Settings control reads the
in-workout change: **one switch is ON and it is the right one.** Corroborating crop
`s20-rt-390-06b-hc-row.png` (52×45) holds `#8efad8` at 31.1% with a black knob, and its
bright-pixel distribution (left 297 / right 733) is **identical** to the labelled
`hc-toggle-on-light-hc-390.png`. Not similar — identical.

**Shot 07, `visual-qa/s20-rt-390-07-settings-dark-hc-still-on.png`** (after tapping `מצב כהה`).
Scanning for the dark-HC ON track `#318d78`:

```
ON-track y1074-1100 x39-85   <- switch row 1 = מצב כהה        : ON
ON-track y1296-1322 x39-85   <- switch row 4 = ניגודיות גבוהה : ON
```

Both ON, same frame, same x-geometry as shot 06's row 4. **High contrast survived the dark-mode
toggle.** Crop `s20-rt-390-07b-hc-row.png` confirms independently: same row, track recoloured
`#8efad8` → `#318d78` (the light-HC → dark-HC ON pair), still a filled ON track, never the
`#111111`+white OFF signature.

Two further cross-checks. Shot 06 is pixel-identical (0.00% differing at tolerance 8) to the
independently captured `s20-settings-light-hc-390.png`; shot 07 differs from
`s20-settings-dark-hc-390.png` by only 0.88% and from shot 06 by 1.15%. And the round trip's own
frame palettes track the state change through the workout: 01 and 02 are `#eef3f1` (light, HC off),
03 flips to `#000000` the moment the overlay switch is tapped, 04 and 05 stay black through closing
the overlay and leaving the workout, 06 and 07 stay black in Settings.

Honest limit: the PNGs prove the *rendered state* is correct. They cannot prove *provenance* — that
this state arrived via the in-workout overlay rather than being set directly. That link comes from
`s20-roundtrip-390.json`, which logs `03-overlay-hc-toggled-on` → `overlayAriaChecked:"true"`, then
`06-settings-after-workout` → `navPath:"gear-link"`, `settingsHcAriaChecked:"true"`, then
`07-after-dark-toggle` → both `"true"`, then `08-after-reload` → `{dark:true, highContrast:true}`.
Shot 06 being byte-equal to a directly-set light-HC capture is exactly what a working read-back
should look like, but on its own it is not a provenance proof.

### Q2 — Does the 5-group structure hold in all four states at both widths? **Partly — and unprovable for two groups.**

What the DOM audit establishes for all 8 combos, identically: `groupHeadings` = exactly
`["חשבון","הפרופיל שלי","תצוגה ונגישות","אימון והתראות","נתונים ופרטיות"]`; three
`button[aria-expanded]` all `"false"`; `overflowing: []`; `docScrollWidth === innerWidth`
(390/390, 1280/1280) — so **no clipping and no horizontal overflow anywhere**, including the parts
no camera saw.

What the pixels establish, for the three groups that were painted, in all four states at both widths:

- **No empty group.** `חשבון` → account card + `התחברות או הרשמה` CTA. `הפרופיל שלי` → the
  `פרטים אישיים` card, 7 rows. `תצוגה ונגישות` → 4 switch rows.
- **No duplicated words.** No group heading is repeated as a card label beneath it. `הפרופיל שלי`
  over a card titled `פרטים אישיים` is a heading plus a distinct sub-label, not a duplicate.
- **Collapsed means collapsed.** Both visible triggers show nothing beneath them in every state;
  the next group heading follows directly.
- **Spacing is regular.** Group-heading baselines at 390 land on y126, y367, y1020 with matching
  24 px right gaps, and card rows step at a consistent 73 px pitch (y539, y611, y684, y751, y812,
  y873).
- **Nothing clipped or overflowing** in the painted region, at either width, in any state.

What is **not** established: `אימון והתראות` and `נתונים ופרטיות` were never photographed (F2). The
crop set proves their content renders and is legible — `s20-txt-legal-label-*` was captured via
`scrollIntoViewIfNeeded` and measures 14.53-21:1 in all eight states, and the audit lists group 4's
five switches — but empty-group, duplicate-label, spacing and clipping for those two groups are
**unverified**. I am not going to imply otherwise: that is 2 of 5 groups, i.e. 40% of the thing
question 2 asks about.

### Q3 — Per-element contrast

**Floors applied.** 4.5:1 (WCAG 1.4.3) for all three crop surfaces, because all three are small
text: the group heading is ~15 px non-bold in a 23 px box, the legal label ~12 px in a 19 px box,
the trigger label ~15 px — none reaches 24 px, or 18.66 px bold, so the 3:1 large-text allowance
does not apply to any of them. 3:1 (1.4.11) is applied below only to switch tracks and knobs, which
are non-text UI.

| surface | light | light-hc | dark | dark-hc | floor | |
|---|---|---|---|---|---|---|
| group heading `תצוגה ונגישות` @390 | 12.91 | 19.74 | 16.71 | 19.04 | 4.5 | ✅ |
| group heading @1280 | 13.02 | 19.87 | 17.04 | 19.42 | 4.5 | ✅ |
| legal label `משפטי ופרטיות` @390 | 14.53 | 21.00 | 18.43 | 21.00 | 4.5 | ✅ |
| legal label @1280 | 14.60 | 21.00 | 17.94 | 20.47 | 4.5 | ✅ |
| expander trigger label @390 | **1.75** | 15.72 | 10.74 | 15.13 | 4.5 | ❌ light |
| expander trigger label @1280 | **1.68** | 14.38 | 10.96 | 14.38 | 4.5 | ❌ light |

Non-text (1.4.11, 3:1), from colours measured in the s20 frames themselves:

| pair | ratio | |
|---|---|---|
| black knob on light-HC ON track (`#000000` / `#8efad8`) | 16.81 | ✅ |
| black knob on dark-HC ON track (`#000000` / `#318d78`) | 5.21 | ✅ |
| light-HC ON track vs page (`#8efad8` / `#000000`) | 16.81 | ✅ |
| dark-HC ON track vs page (`#318d78` / `#000000`) | 5.21 | ✅ |
| HC ON track vs HC OFF track (`#8efad8` / `#111111`) | 15.12 | ✅ |
| HC OFF track vs page (`#111111` / `#000000`) | 1.11 | ⚠️ see note |

The 1.11:1 OFF-track fill would be a 1.4.11 failure on its own, but the labelled
`hc-toggle-off-light-hc-390.png` shows 36.3% `#ffffff` — the OFF switch is drawn with a heavy white
ring, so the component boundary is carried at 21:1 by the ring, not by the fill. Not a defect.

I did **not** carry over the light-theme knob figures (white knob on `#43c7a5` = 2.11:1) as a
finding: the `#43c7a5` flat track comes from the earlier `hc-toggle-on-light-390.png` capture set,
and scanning the s20 light page for a flat `#43c7a5` track returns nothing, so I cannot confirm that
pair is what the current Settings screen paints. Unverified, therefore not reported as a defect.

### Q4 — Touch targets

Four controls under 44 px, in **all eight** state/width combinations: `מין` 46.4×20.6,
`מטרת משקל` 82×20.6, `רמת פעילות` 70.4×20.6, and the unnamed switch 52×30. See F3 and F4. Nothing
else in the audit falls below 44 in its smaller dimension. Note the audit only measures controls
matching `button, a[href], [role=switch], input, select, textarea, summary` — a `div` with a click
handler would not appear, and I cannot rule one out.

### Q5 — RTL

Measured on inked glyph extents, not block boxes.

**390, light** — every heading and label run ends flush at the right edge with a consistent gap
equal to the page or card padding, and the ink extends leftwards:

```
y  26-  32  ink[262..369]  rightGap=20   <- התאמות אישיות וסנכרון (eyebrow)
y  53-  72  ink[279..368]  rightGap=21   <- הגדרות (h1)
y 126- 141  ink[321..365]  rightGap=24   <- חשבון
y 367- 381  ink[272..365]  rightGap=24   <- הפרופיל שלי
y 407- 416  ink[284..365]  rightGap=24   <- פרטים אישיים
y1020-1032  ink[257..365]  rightGap=24   <- תצוגה ונגישות
y 539- 550  ink[ 38..344]  rightGap=45   <- card row (extra card padding)
```

**1280, light** — same runs, same right gaps (20/21/24/24/24/24), ink at x1147..1259. Headings hug
the right edge at both widths. Correct.

**One exception**, and it is the same control as F1/F5: the expander trigger label is centred, not
flush right — `y949-956 rightGap=152 leftGap=155` at 390, `rightGap=597 leftGap=599` at 1280.

**Mirroring**: chevrons on the `מין` / `מטרת משקל` / `רמת פעילות` rows point left (toward the
value) and the row icons sit on the right with labels to their left; the `התחברות או הרשמה` CTA
places its icon to the left of the text. Consistent with RTL throughout the painted region.

**Hebrew+digit strings**: the audit finds five, all in the rest-timer group — `30 שנ`, `60 שנ`,
`90 שנ`, `2 דק`, `3 דק` — each with `direction:"rtl"`, `unicodeBidi:"normal"`, `hasDirChild:false`.
Digit-then-Hebrew is the safe logical order and needs no isolation to render correctly, so I expect
no reversal. But **I could not see any of them**: every one lives below y1500 in every capture (F2).
Unverified visually. Numbers I *can* see — `30`, `170`, `68` in the profile inputs, with `שנים`,
`ס"מ`, `ק"ג` beside them — render LTR with the unit correctly to the left.

**Overflow**: `overflowing: []` and `docScrollWidth === innerWidth` in all eight combos. Nothing
overflows at 390.

### Q6 — What is missing from this evidence

Confirmed on disk: exactly 43 `s20-*` files — 9 round-trip PNGs, 8 full Settings PNGs, 24 crops,
`s20-measure.json`, `s20-roundtrip-390.json`. Nothing else exists.

The two known gaps, confirmed:
1. **No `מתקדם` expanded, in any state.** Test B in the spec writes
   `s20-settings-expanded-{light,dark}-{390,1280}.png` and `s20-measure-expanded.json` — **none of
   those files exist**, so that test did not complete. Everything about the expanded state is
   unverified: whether children render, whether spacing survives, whether the chevron rotates,
   whether anything overflows once open.
2. **Round trip @390 only.** `s20-roundtrip-1280.json` does not exist and there are no
   `s20-rt-1280-*` PNGs. The fix is unproven at desktop width.

Additional gaps I found, which the brief did not name:
3. **The bottom ~57% of every Settings capture is blank** (F2) — groups 4 and 5, two of three
   `מתקדם` triggers, and six of ten switches are in no frame.
4. **The crops labelled `advanced-trigger` are not of a `מתקדם` trigger.** The spec uses
   `page.locator('button[aria-expanded]').first()`, and the audit's expander order is
   `["פרופיל ציבורי","מתקדם","מתקדם"]` — so all 8 crops are of `פרופיל ציבורי`, under a filename
   that says otherwise. The image confirms it: the visible label is `פרופיל ציבורי`. F1's ratio is
   therefore measured on trigger #1; the two real `מתקדם` triggers are unmeasured (though trigger #2
   is visibly the same mint treatment).
5. **No hover, focus-visible, or pressed state** in any frame — so keyboard focus visibility and
   focus-ring contrast are entirely unverified. The brief's a11y list asks for visible focus; this
   evidence cannot answer it.
6. **No `large-text` and no `reduce-motion` state.** `htmlState` reports both `false` in every
   frame. `טקסט גדול` is one of the four switches in the rebuilt `תצוגה ונגישות` group and its
   effect on the new layout — the most likely source of overflow — is untested.
7. **No offline / IndexedDB-failure state, no rest day, no zero-sets, no mid-workout reload** on
   Settings. Not applicable to most of this screen, but the brief asks, and the answer is no.
8. **No axe run.** `e2e/a11y.spec.ts` was not executed here and there is no axe output in this
   evidence set, so programmatic a11y violations on the rebuilt screen are unknown.
9. **Provenance of the 401s** (F8) — no network log was captured.
10. **Contrast beyond three surfaces.** Only `group-heading`, `advanced-trigger` (mislabelled) and
    `legal-label` were cropped. Switch row labels, helper text (`התחברו כדי לסנכרן…`), input values,
    unit suffixes, disabled states and the `מוצע`/badge text were never measured per-element.

**`visual-qa/_summary.json` is STALE** (dated Aug 28, predates the entire s20 set) and was not used
for any figure above. Cited here only to record that it was deliberately ignored.

---

## 6. Gate output

None. This run was explicitly analysis-only: no `npm run verify`, no `npm run test:run`, no
`npm run test:e2e`, no `npm run db:test`, no dev server, no browser, no git. **Every gate is
therefore unknown, and nothing in this report should be read as a passing build.** Two earlier
attempts died at a 30-minute wall trying to capture and analyse in one run; this run analysed only.

Tooling used, for reproducibility: three throwaway Node scripts under the OS temp directory
(`s20probe.js` … `s20probe4.js`), requiring the repo's existing `sharp` to read raw pixels, deleted
afterwards. No repo file was modified. This report is the only file written.

---

## 7. Recommended next actions

| # | Action | Why |
|---|---|---|
| 1 | Retarget the expander trigger label off `--fs-accent` in the light theme (`--fs-link` `#1d6575` clears AA on all three light surfaces) | F1, the only hard WCAG failure found |
| 2 | Fix the capture harness in `e2e/settings-s20.spec.ts` — scroll `#main-content` and stitch, or shoot one element per group | F2; without it no one can review groups 4-5 |
| 3 | Re-run test B (`מתקדם` expanded) and the 1280 round trip | Q6 gaps 1-2, both already written and both produced nothing |
| 4 | Give the three profile `<select>`s a ≥44 px hit box | F3, fails even the 24 px AA floor |
| 5 | Name the unlabelled `role="switch"` | F4, unlabelled for screen readers |
| 6 | Rename the `advanced-trigger` crops, or point the locator at a real `מתקדם` | Q6 gap 4; the filenames currently misdescribe the evidence |
| 7 | Add a `large-text` + light-theme capture at 390 | Q6 gap 6, most likely overflow source in the new layout |

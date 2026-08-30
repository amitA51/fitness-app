# Visual QA — T-092 container cap + grabber recolour (task T-094)

Read-only verdict from the 26 usable `t092-*` PNGs and `visual-qa/t092-capture.json`.
No browser, no build, no server, no Playwright, no gates, no git — two workers were
editing `src/` during this review, so any gate would have measured half-finished work.

---

## 1. Verdict

**PASS on everything that was actually captured — with two real defects, both in the
header rather than in the capped column, and a coverage gap that is larger than the
task brief stated.**

| Question | Verdict | Basis |
|---|---|---|
| Q1 content capped to a centred column @1280 | **PASS** (3 of 5 pages) | content pixel energy confined to x=[400..880] |
| Q1 background still full-bleed @1280 | **PASS** (all frames) | dark margins measure luminance 0.000–0.008, not white |
| Q1 unchanged @390 | **PASS** (all 10 frames) | content x=[20..370], no centring gutters |
| Q2 Settings @1280 in all four theme states | **PASS** | shell x=400 w=480 in light, light-hc, dark, dark-hc |
| Q3 grabber legible on its own sheet | **PASS** (light + light-hc only) | 64/64 core px exact; 3.21:1 and 21.00:1 |
| Q4 anything else visibly wrong | **2 defects + 2 observations** | see §3 |

The specific regression Q1 was worried about — capping the wrong layer and shrinking the
background to a narrow strip — **did not happen**. In every dark frame the margins outside
the column are `#000000`. Had the background been capped, those margins would have read
near-white; they measure a mean luminance of 0.000–0.008.

Two of the five Q1 pages, however, never rendered their real layout (§2), so "5 pages
verified" would be false. Three are verified.

---

## 2. Method check (mandatory, done before any new figure)

Reproduced **39 contrast figures this repo already publishes**, from
`src/styles/tokens.css` comments and the token table in
`reports/04-A11Y-RTL-HEBREW.md`. **34 reproduced within 0.01.** The 5 apparent
mismatches were resolved, and neither cause is an arithmetic error:

**(a) Compositing model.** Quantising composited alpha to integer channels put the
grabber's `.33` step at 3.003 against a published 2.98. Compositing in float and
converting once at the end reproduces **all 8 published grabber steps within 0.006**:

```
light alpha 0.50 -> 3.213  published 3.21     dark alpha 0.35 -> 3.206  published 3.20
light alpha 0.48 -> 3.035  published 3.04     dark alpha 0.33 -> 2.982  published 2.98
light alpha 0.47 -> 2.951  published 2.95     dark alpha 0.20 -> 1.838  published 1.84
light alpha 0.20 -> 1.506  published 1.51     dark alpha 0.42 -> 4.096  published 4.10
```

Float compositing is therefore the model used for every figure below.

**(b) Four stale figures in `reports/04-A11Y-RTL-HEBREW.md` (dated 2026-07-26).** Its
four dark rows for `--fs-muted` and `--fs-ink`-on-`surface-2` do not match current
tokens. One consistent *older* token pair reproduces **all four exactly**:

```
with --fs-muted #8c8c8c and --fs-surface-2 #1a1a1a:
  dark --fs-muted on bg/surface/surface-2 = 6.25 / 5.62 / 5.18   published 6.25 / 5.62 / 5.18
  dark --fs-ink #f0f0f0 on surface-2      = 15.27                published 15.27
```

Corroboration: `dark --fs-ink` on `bg` (18.43) and on `surface` (16.57) both reproduce
exactly, so `#f0f0f0`/`#000`/`#111` never moved — only `--fs-muted` and dark
`--fs-surface-2` did. That report has drifted from the tokens; the tokens are right.
All 13 light-theme rows of the same table reproduce exactly.

**Trap 1 honoured — no pre-aggregated colour field was used.** `t092-capture.json`
carries `inkOnFill`, `sampledInk`, `sampledFill` and `inkShare` per record. They are
unreliable here in the defect-inventing direction, demonstrably: for
`t092-g1-legal-terms-light-1280.png` the file reports `sampledInk #d7e5e6`,
`inkOnFill 1.29`, `inkShare 0.01`. `#d7e5e6` is a divider colour and 0.01 means it
matched 1% of sampled pixels — the page's actual body ink is `--fs-ink #132327` on
`#ffffff`, which is **16.19:1**. Every figure in this report is instead computed from
**counted pixels** in the region being judged.

**Trap 2 honoured — crop margins checked.** Before concluding anything from the grabber
sample, 116 pixels surrounding the pill were compared against the sheet fill: **maximum
deviation 0**. The sampling region is genuinely interior, with no bleed from an
adjacent card.

`visual-qa/s26-measure.json` was **not** cited (it is a 1.3 KB stub).

---

## 3. Findings

### F1 — Page title stranded 196–272 px outside its own content column. Severity: MEDIUM

At 1280 the header text sits hard against the right viewport edge while the content it
titles is a 480 px column centred at x=640. Nothing in the header aligns with anything
in the column. This is the Q4 "heading no longer aligned with its own content column"
case, and it affects **all five pages that render a header, in every theme state**.

Measured start of header ink, against a content column of x=[400..880]:

| Frame | header ink starts | px right of column edge (880) |
|---|---|---|
| `t092-g2-settings-dark-1280.png` | x=1152 | **272** |
| `t092-g1-legal-terms-light-1280.png` | x=1148 | **268** |
| `t092-g1-progress-light-1280.png` | x=1138 | **258** |
| `t092-g1-accessibility-light-1280.png` | x=1120 | **240** |
| `t092-g1-public-profile-light-1280.png` | x=1076 | **196** |

Independently corroborated by the per-column edge-energy profile: on
`t092-g1-legal-terms-light-1280.png` there is **exactly zero** edge energy in
x=[880..1119], then a cluster at x=[1120..1279] confined to rows y=26..98 — i.e. header
text, alone, far right, with a 240 px empty gap between it and its own content.

- **Repro:** 1. open `/legal/terms` (or `/settings`, `/progress`, `/accessibility`) at
  1280×1500. 2. Look at the page title versus the card column below it.
- **Expected:** the title shares an edge with the column it introduces.
- **Actual:** the title is ~270 px to the right of the column's right edge.
- **Evidence:** `visual-qa/t092-g1-legal-terms-light-1280.png`,
  `visual-qa/t092-g2-settings-dark-1280.png`.
- **Suspected location:** unknown. The header is outside the capped element — DOM shows
  `pageShellCount: 1` with the shell at x=400 w=480, and the header band's bottom edge
  is straight across all 1280 px, so the header was never inside the shell.
- **Is it a regression?** Consistent with being introduced by this cap — before it, the
  full-width content would have shared the header's right edge — but **I have no
  before-frame and cannot prove that.** Stated as observed state, not as a diff.

### F2 — 259 px notch in the top band, on Settings and public profile only. Severity: LOW

The top band's bottom boundary is not straight: it sits 12–13 px higher for x ≥ 1021,
making a 259 px-wide step at the top-right corner. Probed at 10 columns per frame:

```
t092-g2-settings-light-1280.png     bottom edge y=109 (x100-1000)  y=96 (x1040-1270)  STEP at x~1021
t092-g2-settings-light-hc-1280.png  same, step 13 px, seam contrast 1.05:1
t092-g2-settings-dark-1280.png      same, step 13 px, seam contrast 1.08:1
t092-g2-settings-dark-hc-1280.png   same, step 13 px, seam contrast 1.08:1
t092-g1-public-profile-light-1280   bottom edge y=101 -> y=89, step 12 px, seam contrast 1.11:1
t092-g1-public-profile-dark-1280    bottom edge y=101 -> y=89, step 12 px, seam contrast 1.08:1
```

Absent on `legal-terms`, `accessibility` and `progress`, where the boundary is identical
at all 10 probe columns (y=125 / y=88 / y=96 respectively) — so this is per-page, not a
global header issue.

Severity LOW on measured evidence: the seam contrast is **1.05–1.11:1**, at or below the
perceptual floor. It is a structural inconsistency worth a look, not a visible break.

- **Evidence:** `visual-qa/t092-g2-settings-dark-hc-1280.png`,
  `visual-qa/t092-g1-public-profile-light-1280.png`.
- **Suspected location:** unknown.

### F3 — `/u/:username` emits 2 console errors on every load. Severity: MEDIUM

All 8 console errors recorded for group 1 are `Failed to load resource: the server
responded with a status of 400`, and the cumulative counter in `t092-capture.json`
increments by **exactly 2 at each of the 4 public-profile loads** and at no other frame
— a clean attribution.

A **400** (not 404) for a username that simply does not exist points at a malformed
request rather than a missing row. Group 2 additionally logged 4 × **401** on
`/settings`, which is expected for an unauthenticated capture and is not a defect.

- **Evidence:** `visual-qa/t092-capture.json`, records with a `consoleErrors` key
  (indices 20 and 25), plus the per-frame `consoleErrorCount` deltas.
- **Suspected location:** unknown — the capture recorded no request URLs.

### Observation O1 — high-contrast does not flatten the page to pure black

`html.high-contrast` declares `--fs-bg: #000000` and sets `--fs-mesh-accent` /
`--fs-mesh-signal` / `--fs-body-overlay` to `transparent`, but the margins of both HC
frames still carry a dark teal gradient: modal colours `#000000`, `#0e1916`, `#111e1a`,
mean luminance 0.008. `#111e1a` against pure black is **~1.22:1** — below the perceptual
threshold, so not a defect, but it does indicate a page tint that escaped the HC
overrides. Frames: `t092-g2-settings-light-hc-1280.png`,
`t092-g2-settings-dark-hc-1280.png`.

### Observation O2 — 2 px artefact at the extreme right edge of every 1280 frame

Every 1280 frame has 2–3 strongly-contrasting pixels at x=1278..1279, including
`t092-g1-workout-detail-*-1280.png`, which renders no header at all. Because it survives
on a header-less page it is a viewport-edge artefact (border or scrollbar remnant), not
content. Flagged only because it contaminates any right-hand bound measured from these
PNGs — the F1 table therefore quotes ink *start*, which is unaffected.

---

## 4. Detail behind the PASS verdicts

### Q1 — the colour-free geometric check the brief asked for

Content extent versus background extent in the same 1280 frame:

| Frame | content x-extent | edge energy inside x=[400..880] | outer-margin mean luminance | verdict |
|---|---|---|---|---|
| `t092-g1-legal-terms-light-1280.png` | 420..860 | 96.9% | 0.837 / 0.801 | content narrow, bg full |
| `t092-g1-legal-terms-dark-1280.png` | 420..860 | 96.9% | 0.006 / 0.004 | content narrow, bg full |
| `t092-g1-accessibility-light-1280.png` | 420..860 | 97.5% | 0.855 / 0.828 | content narrow, bg full |
| `t092-g1-accessibility-dark-1280.png` | 420..860 | 97.6% | 0.004 / 0.003 | content narrow, bg full |
| `t092-g1-progress-light-1280.png` | 420..860* | 88.4% | 0.874 / 0.862 | content narrow, bg full |
| `t092-g1-progress-dark-1280.png` | 420..860* | 88.9% | 0.002 / 0.002 | content narrow, bg full |

\* the residual off-column energy on `progress`, `public-profile` and `settings` is
entirely the header ink of F1 plus the F2 notch, all confined to rows y≤106. Below the
header, every row's content lies inside x=[400..880].

Neither failure mode in the brief is present:

- **Both full width (cap never applied)?** No — zero edge energy in x=[0..399] on every
  frame, and the DOM agrees: `pageShellMaxWidth: "480px"`,
  `pageShellMarginInline: "400px/400px"`, `pageShellBox x=400 w=480 right=880`.
- **Both narrow (wrong layer capped)?** No — this is the decisive one. Outer margins
  carry the page background, not a default white strip:
  - dark frames: modal `#000000`, mean luminance **0.000–0.008**
  - light frames: modal `#eef3f1` and the mesh family `#daeee8`–`#e9f2f0`, i.e.
    `--fs-bg` and its accent-mesh tint
  - seam test: the median colour of x=[0..360) versus the strip immediately left of the
    shell, x=[380..398], differs by **0–1 per channel** on every frame — there is no
    discontinuity where a capped background would have ended.

`mainBackground` and `shellBackground` are both `rgba(0, 0, 0, 0)` in all 30 frame
records, i.e. neither the main element nor the shell paints the page — consistent with
the background living on an ancestor and therefore staying full-bleed. `overflowingElements: 0`
on all 30.

### Q1 @390 — unchanged, desktop-only as intended

All ten 390 frames: `pageShellBox x=0 w=390 right=390` with `pageShellMaxWidth: "480px"`
— the 480 cap exceeds the 390 viewport, so it cannot bite. Content pixels run x=[20..370]
on all eight populated frames: full width minus symmetric 20 px page padding, no
centring gutters.

### Q2 — Settings holds in all four theme states, including the two never captured before

| Frame | shell box | content x-extent | outer-margin luminance |
|---|---|---|---|
| `t092-g2-settings-light-1280.png` | x=400 w=480 | 420..860 | 0.830 / 0.791 |
| `t092-g2-settings-light-hc-1280.png` | x=400 w=480 | 420..860 | 0.008 / 0.003 |
| `t092-g2-settings-dark-1280.png` | x=400 w=480 | 420..860 | 0.007 / 0.005 |
| `t092-g2-settings-dark-hc-1280.png` | x=400 w=480 | 420..860 | 0.008 / 0.005 |

94.1–94.4% of edge energy inside the column in all four, the remainder being F1/F2 in the
top 106 rows. Dark and dark+high-contrast — the two states no previous round captured —
behave identically to light.

Note for whoever reads the HC frames next: **`html.high-contrast` is a black theme in
both light-HC and dark-HC** (`--fs-bg`/`--fs-surface: #000000`, `--fs-ink: #ffffff`). A
black "light-hc" screenshot is correct, not a bug.

### Q3 — the grabber, from counted pixels

Both usable sheet frames are 390×508 and the pill measures **exactly the specified
36 × 4**, horizontally centred to within 0.5 px:

| | `t092-g3-sheet-light-sheet.png` | `t092-g3-sheet-light-hc-sheet.png` |
|---|---|---|
| pill bbox | x=[177..212] w=36, y=[12..15] h=4 | x=[177..212] w=36, y=[12..15] h=4 |
| sheet fill (modal) | `#ffffff`, 11043/12090 px = 91.3% | `#000000`, 11045/12090 px = 91.4% |
| pill core, 64 px sampled | `#899193`, **64/64 = 100.0%** | `#ffffff`, **64/64 = 100.0%** |
| within 2 of expected | **64/64 = 100.0%** | **64/64 = 100.0%** |
| crop-trap guard | 116 px, max deviation **0** | 116 px, max deviation **0** |
| measured ratio | **3.21:1** (published 3.21:1) | **21.00:1** (published 21.00:1) |
| WCAG 1.4.11 floor 3:1 | **PASS** | **PASS** |

`#899193` is exactly `rgba(19, 35, 39, 0.5)` composited over `#ffffff`; the HC pill is
`--color-drag-handle: var(--color-border)` resolving to `#ffffff` on the black sheet, as
`tokens.css:781` intends. The recolour holds in both captured states, and the pill reads
against the sheet's own fill rather than against the page.

---

## 5. Commands run

No gate was run, by instruction — `npm run verify`, `npm run test:run`,
`npm run test:e2e` and `npm run db:test` were **not** executed, because two workers were
editing `src/` and any result would have described a moving tree, not this change. No
browser, server, Playwright or git command was run either. Nothing in this report is a
gate result and nothing here should be read as one.

What was run, all read-only against files already on disk (Python 3 + PIL 12.3.0):

| Step | Result |
|---|---|
| Reproduce 39 published contrast figures | 34 within 0.01; 5 resolved in §2 (compositing model + stale report) |
| Reproduce all 8 published grabber steps, float compositing | worst delta **0.0055** |
| Inventory 32 records of `t092-capture.json` vs disk | 30 records carry a `png`; 2 hold `consoleErrors`; 26 PNGs usable, 2 empty |
| Row/column scan of 14 frames @1280 (187 rows each) | content extent, edge-energy profile, margin colours — §4 |
| Row scan of 12 frames @390 | content x=[20..370] on all populated frames |
| Header band bottom edge probed at 10 columns × 14 frames | straight on 3 pages, 12–13 px step at x=1021 on 6 frames (F2) |
| Grabber locate + pixel count on 2 sheet frames | 64/64 exact in both; guard deviation 0 |

Scratch scripts written for this analysis —
`_scratch_t092_validate.py`, `_scratch_t092_resolve.py`, `_scratch_t092_inventory.py`,
`_scratch_t092_pixels.py`, `_scratch_t092_diag.py`, `_scratch_t092_header.py`,
`_scratch_t092_band.py`, `_scratch_t092_final.py`, `_scratch_t092_title.py` — were all
**deleted after the run**. No product code, test, config or capture artefact was
modified; this report is the only file written.

---

## 6. Could not determine

Coverage is partial. The capture worker stopped after groups 1 and 2, and two of group
1's five pages did not render their real layout. Everything below is **unverified** — no
result should be inferred for any of it.

**Never captured at all:**

1. **Bottom sheet in dark** — no frame exists. The dark grabber is `rgba(255,255,255,0.35)`
   on `#111111`, which *computes* to 3.206:1, but **computing is not verifying** and no
   pixel of it was measured.
2. **Bottom sheet in dark + high contrast** — no frame exists.
3. **Weight/reps numpad** — never captured.
4. **Set editor** — never captured.

**Captured but unusable:**

5. `visual-qa/t092-g3-sheet-light-grabber.png` — **416 bytes**, blank. Not merely dark:
   there is no image content to read.
6. `visual-qa/t092-g3-sheet-light-hc-grabber.png` — **424 bytes**, blank. Same.
   The two close-crop frames intended to settle the grabber contribute nothing; the Q3
   PASS above rests entirely on the two full-sheet frames.

**Captured, but the page never rendered its real layout — so Q1 is verified for 3 of
its 5 pages, not 5:**

7. **Public profile (populated).** `/u/t092-qa-probe` rendered the not-found state
   ("הפרופיל לא נמצא"), because the probe username does not exist. The centred card and
   the full-bleed background *are* observable and correct in that state, but a populated
   public profile — avatar, stats, workout list — was never laid out at 1280.
   Frames: `t092-g1-public-profile-{light,dark}-{1280,390}.png`.
8. **Workout detail — not verified at all.** `/detail/t092-qa-probe` rendered
   "האימון לא נמצא" with **`pageShellCount: 0`** in all four of its records: the shared
   container element is not present on the page in this state, so there is nothing to
   check. Its 59–66 KB PNGs versus 450–530 KB for its siblings reflect an almost empty
   page. **This is not a claim that the page failed the cap — it is a claim that the
   evidence cannot speak to it.** Re-run with a real workout id.

**Structurally out of reach from these artefacts:**

9. **Whether F1 and F2 are regressions or pre-existing.** No before-frames exist in
   `visual-qa/`, so I can report the current state but not attribute it to this change.
10. **Any viewport between 390 and 1280.** Only those two widths were captured, so the
    breakpoint where the 480 cap starts to bite is unverified — including the 480–520 px
    region where a 480 px cap and page padding are most likely to interact badly.
11. **Offline / IndexedDB, mid-workout reload, rest day, zero sets logged.** No frames.
12. **Keyboard reachability, focus visibility, real labels.** Static PNGs cannot show
    focus order or the accessibility tree; `e2e/a11y.spec.ts` is the right place and it
    was not run (no gates, by instruction).
13. **Long-Hebrew-string overflow.** `overflowingElements: 0` is reported for all 30
    frames, but every frame used ordinary-length content, so the field says nothing about
    the long-string case.
14. **The two console-error sources.** `t092-capture.json` recorded messages but no
    request URLs, so the failing endpoint behind the 400s is unidentified.

# visual-qa-s26 — verdict from screenshots on disk

Round s26. Evidence: 62 `visual-qa/s26-*.png` + `visual-qa/s26-measure.json`.
No browser, no build, no server, no Playwright, no test run, no git in this round —
every figure below comes from reading files already on disk.

---

## 1. Verdict

**PASS on the two changed controls. FAIL on the six-sheet migration claim (2 of 6 refuted).
Layout holds in all four theme states at both widths — with one desktop defect: the page is
uncapped at 1280.**

| Claim under test | Verdict |
|---|---|
| 1 — icon tile became the shared quiet chip (fill drops in light / light+HC, glyph improves in all four) | **CONFIRMED from pixels** |
| 2 — consent switch became the shared component (ON/OFF knobs 1.16 → ~16.2 apart, target 52x30 → 52x44) | **CONFIRMED from pixels** (before-geometry on disk is 52x33, not 52x30) |
| 3 — six bottom sheets migrated to the canonical drag-to-dismiss overlay | **PARTIALLY REFUTED** — numpad has no grabber; tutorial is not a sheet at all |

---

## 2. Method check — 15 published ratios reproduced with my own arithmetic

Own sRGB-linearise + `(L1+0.05)/(L2+0.05)`, before any comparison. All 15 match to ±0.01.

| pair | source of the published figure | published | mine |
|---|---|---|---|
| `#132327` on `#dbe6e3` | `reports/04-A11Y-RTL-HEBREW.md:19`, `reports/visual-qa-s23.md:66` | 12.67 | **12.67** |
| `#132327` on `#eef3f1` | same | 14.43 | **14.43** |
| `#132327` on `#ffffff` | same | 16.19 | **16.19** |
| `#256d5b` on `#ffffff` | `src/styles/tokens.css:36-39` | 6.15 | **6.15** |
| `#256d5b` on `#eef3f1` | same | 5.48 | **5.48** |
| `#256d5b` on `#dceee9` | same | 5.11 | **5.11** |
| `#256d5b` on `#dbe6e3` | same | 4.81 | **4.81** |
| `#43c7a5` on `#ffffff` | `tokens.css:40` (raw accent must not be text) | 2.11 | **2.11** |
| `#ffffff` on `#16292d` | `reports/visual-qa-s20.md:44`, `visual-qa-14bd.md:44` | 15.12 | **15.12** |
| `#16292d` on `#000000` | `visual-qa/contrast-shared-primitives.txt` | 1.39 | **1.39** |
| `#f0f0f0` on `#262626` | same | 13.28 | **13.28** |
| `#ffffff` on `#111111` | same, and `visual-qa-14bd.md:180` | 18.88 | **18.88** |
| `#111111` on `#000000` | same | 1.11 | **1.11** |
| `#071412` vs `#132327` (the F1 clash) | `reports/visual-qa-s23.md:161` | 1.16 | **1.16** |
| `#8efad8` on `#111111` | `reports/visual-qa-s20.md:355` | 15.12 | **15.12** |

The method reproduces every known figure, so the new figures below rest on the same arithmetic.

### Provenance of every number in this report

- **From pixels (mine):** every chip, row, switch, toggle, grabber, button and layout figure in
  §3–§5. Sampling rule: mode of the region = fill; glyph = the extreme-luminance tail
  (peak pixel + mean of the 12 most extreme), reported with the pixel count.
- **From `s26-measure.json`:** only geometry and labels — `rect`, `computed.width/height`,
  `className`, `direction`, `verifiedAriaLabel`, `mainContent.scrollHeight`. **No colour field
  from that file is cited anywhere in this report.**
- **From the repo's own token arithmetic:** the before/after *predictions* in
  `visual-qa/contrast-shared-primitives.txt` and the `tokens.css` comments. These are
  predictions I recomputed independently — they are the thing being tested, never the evidence.
- **The pre-aggregated-colour trap:** `s26-measure.json` carries no `foreground` /
  `sampledForeground` / `inkOnFill`-style field at all; its `pixelSamples` is a raw top-14 census.
  I still did not use it for contrast. I also hit the trap's mirror image in my own first pass:
  a naive census of `s26-chip-darkmode-light-1280.png` reported the glyph as `#ffffff` at 1.28:1,
  which would have been a fabricated blocker — it is the **crop bleeding 2px of the white card**
  along its left and bottom edges. Insetting the crop by 3px shows the real glyph is dark ink at
  ~11.4:1. Every chip figure below is measured on the inset.
- `visual-qa/_summary.json` is stale and is not cited.

---

## 3. Settings screen — verdict per theme state

Frames: `s26-settings-{light,light-hc,dark,dark-hc}-{390,1280}.png` (8, first-ever capture of
dark, dark+HC and 1280) and `s26-settings-expanded-*` (8, same states with the disclosures open).

**Does the group layout hold? Yes — in all four states, at both widths, identically.**

Card-band segmentation (rows where the card fill occupies >45% of the row) is *byte-identical*
across all eight base frames:

| state | 390 bands | 1280 bands | card extent at 1280 |
|---|---|---|---|
| light | 159-262, 435-908, 1054-1346 | 159-262, 435-908, 1054-1346 | x21..1258, **w=1238** |
| light+HC | same | same | same |
| dark | same | same | same |
| dark+HC | same | same | same |

Read out of the frames: `חשבון` → `הפרופיל שלי` (+ collapsed `פרופיל ציבורי`) →
`תצוגה ונגישות` (4 toggle rows) → collapsed `מתקדם`; the expanded frames add
`התראות בזמן אמת`, `נתונים ופרטיות`, `משתמשים חסומים`, `אזור מסוכן`.

- **No group is cut off, overlapped or unreadable in any of the 16 frames.**
- **No wrong control state anywhere.** All four accessibility toggles were measured per frame
  (track hue + knob side): light = 4x OFF; light+HC = `ניגודיות גבוהה` ON, rest OFF;
  dark = `מצב כהה` ON, rest OFF; dark+HC = both ON. The analytics consent toggle reads OFF in
  all four states at both widths. Semantics are correct everywhere.
- **Row label ink is nowhere near the phantom values of earlier rounds.** Sampled from
  `s26-row-darkmode-*`: light `#132327` → **16.19:1**, light+HC `#ffffff` → **21.00:1**,
  dark `#edeeed` → **16.23:1**, dark+HC `#fcfcfc` → **20.47:1**. The s23-era 1.06 / 1.14
  readings do not reproduce.
- **Dark and dark+HC are visually sound** — cards `#111111` / `#000000`, mint accents, the
  top-of-page mesh gradient present in all four states.
- **1280 is where it goes wrong** — see D1. Nothing breaks, but nothing is capped either.

---

## 4. The two changed controls, as numbers, in all four theme states

### 4.1 The 32px icon tile in the `מצב כהה` row — CONFIRMED

Fill sampled from `s26-chip-darkmode-*`; card sampled from the same-state `s26-row-darkmode-*`.
"Before" is the repo's token arithmetic (`contrast-shared-primitives.txt`), not a prior capture —
no earlier chip crop exists on disk.

| state | chip fill (px) | card (px) | fill:card BEFORE | fill:card AFTER (mine) | glyph peak (px) | glyph AFTER (mine) | glyph token target |
|---|---|---|---|---|---|---|---|
| light | `#dbe6e3` | `#ffffff` | 15.12 | **1.28** | `#192c30` | **11.38** (390: 11.08) | 11.83 |
| light+HC | `#111111` | `#000000` | 1.39 | **1.11** | `#fafafa` | **18.09** (390: 17.63) | 18.88 |
| dark | `#262626` | `#111111` | 1.05 | **1.25** | `#eeeeee` | **13.04** (390: 12.69) | 13.28 |
| dark+HC | `#111111` | `#000000` | 1.06 | **1.11** | `#fdfdfd` | **18.56** (390: 18.09) | 18.88 |

The predicted fill drop is real and exact: **15.12 → 1.28** in light and **1.39 → 1.11** in
light+HC, matching the three sibling rows. The glyph improved in all four states and reaches
**~18.1-18.6:1 in both high-contrast states**. Measured glyph peaks sit 0.3-0.8 below the token
targets because a 32px stroke icon is almost entirely antialiased — 74-111 glyph pixels per
crop, no single core shade repeating more than a few times. The direction and magnitude confirm
the prediction; the exact token values are not recoverable from a 32px raster and I do not claim
them.

ASCII luminance maps of the crops show the same moon-and-stars glyph in all four states — dark
ink on a pale chip in light, near-white on `#111111`/`#262626` elsewhere. Nothing is missing.

### 4.2 The consent switch — CONFIRMED

Knob/track identified by ASCII-mapping the crops (the knob is a disc at one end; ON sits at the
inline-start/left, OFF at the right; a `#132327`-family ink border rings the whole pill).

| state | ON knob | ON track | OFF knob | OFF track | **ONk:OFFk BEFORE** | **ONk:OFFk AFTER** | ONk:ONtrack | OFFk:OFFtrack | ONtrack:OFFtrack |
|---|---|---|---|---|---|---|---|---|---|
| light | `#ffffff` | `#43c7a5` | `#132327` | `#dbe6e3` | **1.16** | **16.19** | 2.11 | 12.67 | 1.65 |
| light+HC | `#000000` | `#8efad8` | `#ffffff` | `#111111` | 21.00 | **21.00** | 16.82 | 18.88 | 15.12 |
| dark | `#111111` | `#318d78` | `#f0f0f0` | `#262626` | 16.48 | **16.57** | 4.69 | 13.28 | 3.76 |
| dark+HC | `#000000` | `#318d78` | `#ffffff` | `#111111` | 21.00 | **21.00** | 5.21 | 18.88 | 4.69 |

The F1 clash was light-only and is fixed: two knobs that were **1.16:1** apart — the same colour
to the eye while meaning opposite things — are now **16.19:1** apart. Dark and both HC states
were already separated and stay separated.

**Touch target.** Every one of the 16 `s26-switch-analytics-*` crops is **52x45 px** (the element
box Playwright captured), with the painted pill measuring **52x32** inside it — i.e. ~6px of
padding above and below. 45 ≥ 44, so the minimum target is met in all four states at both widths.
The same 52x32 painted pill is confirmed in-place inside the settings frames at both widths.
Correction to the brief: the on-disk "before" for this control family is
`visual-qa/hc-toggle-{on,off}-*.png` at **52x33** (previous round, painted == hit area, so it
failed 44px), **not 52x30**. No earlier crop of the analytics switch itself exists on disk.

---

## 5. Defects

### D1 — Settings is uncapped at desktop width — MEDIUM (cosmetic/usability)
- **What a user sees:** a 1238px-wide settings row with the Hebrew label pinned to the right
  edge and its control pinned to the far left — roughly 1100px of empty card between a label and
  the switch it belongs to. No max-width container, no centred column.
- **Repro:** 1. open Settings at 1280. 2. look at `תצוגה ונגישות`. 3. follow `מצב כהה` to its toggle.
- **Expected:** a capped, centred content column at desktop (the migrated sheets are said to cap
  at 512px — the settings page caps at nothing).
- **Actual:** card extent x21..1258, **w=1238**, margins 21px/21px, in all eight 1280 frames.
  The row crop is 1246px wide for the same reason.
- **Evidence:** `s26-settings-light-1280.png`, `s26-settings-dark-1280.png`,
  `s26-settings-light-hc-1280.png`, `s26-settings-dark-hc-1280.png`,
  `s26-settings-expanded-*-1280.png`, `s26-row-darkmode-*-1280.png` (1246x73).
- **Suspected location:** unknown (Settings page container).
- Not a wrong state, nothing unreachable — hence medium, not high.

### D2 — the drag grabber is below the 3:1 non-text floor in every sheet — MEDIUM (a11y, WCAG 1.4.11)
- **What a user sees:** the only visual cue that a migrated sheet can be dragged away is a pill
  that barely separates from the surface behind it.
- **Measured (pixels), grabber vs the surface it sits on:**

  | sheet | light | dark |
  |---|---|---|
  | `workout-settings` | `#dbe6e3` on `#eef3f1` = **1.14** | `#262626` on `#000000` = **1.39** |
  | `reorder` | `#b9c8c6` on `#ffffff` = **1.73** | `#2a2a2a` on `#111111` = **1.32** |
  | `tools` | `#d0d3d4` on `#ffffff` = **1.51** | `#404040` on `#111111` = **1.82** |
  | `add-exercise` | `#5d6b6e` on `#192c30` = **2.63** | `#4e4e4e` on `#0a0a0a` = **2.38** |

- **Expected:** ≥3:1 for a control affordance. **Actual:** 1.14-2.63, all eight frames.
- **Evidence:** `s26-sheet-workout-settings-light-390.png` (worst, 1.14),
  `s26-sheet-reorder-dark-390.png`, `s26-sheet-tools-light-390.png`,
  `s26-sheet-add-exercise-dark-390.png`.
- **Suspected location:** the shared sheet component's grabber colour token — unknown file.

### D3 — two of the six "migrated" sheets do not show the canonical treatment — MEDIUM
- **numpad:** no grabber at all. Scanning rows 0-25 of `s26-sheet-numpad-light-390.png` and
  `-dark-390.png` for a centred 20-90px pill returns nothing; the only central run is the
  `WEIGHT · משקל` title text at y=24-25. The other four sheets return a clean pill
  (reorder y14-17 48px, tools y12-15 36px, workout-settings y15-18 39px, add-exercise y8-11 40px).
- **tutorial:** not a bottom sheet in any sense. `s26-sheet-tutorial-{light,dark}-390.png` is
  **390x1500** — full viewport — with square top corners, no grabber, and the *page* background
  (`#eef3f1` light / `#000000` dark). From `s26-measure.json` geometry: `className` is **empty**
  where the other five carry `w-full max-w-lg`, `rect` is the whole viewport, and
  `backgroundColor` is the page fill rather than transparent-over-scrim.
- **Expected:** six sheets on the canonical overlay. **Actual:** four.
- **Evidence:** the four PNGs named above.
- **Suspected location:** unknown; the tutorial overlay is a different component that was not
  migrated.

### D4 — the tutorial dialog has no accessible name — MEDIUM (a11y)
- `[role="dialog"]` with `verifiedAriaLabel: null`, `ariaLabelledByText: null`,
  `headingText: null` in `s26-measure.json`, while the frame plainly shows a visible
  `מאמן AI` title. A screen-reader user entering this dialog is told nothing about it.
- **Evidence:** `s26-sheet-tutorial-light-390.png` + the two tutorial records in
  `s26-measure.json` (label fields only — no colour field used).
- **Suspected location:** unknown (tutorial overlay component).

### D5 — high-contrast ON track differs between the two HC states — LOW (cosmetic)
- Same black page, same `high-contrast` flag, two different mints: light+HC paints the ON track
  `#8efad8` (**16.82:1** against the card), dark+HC paints it `#318d78` (**5.21:1**). The ON
  state is ~3x less prominent when dark is also on, and ON-vs-OFF track separation drops from
  15.12 to 4.69.
- Both clear 3:1, so nothing fails — it is an inconsistency, not a barrier.
- **Evidence:** `s26-switch-analytics-on-light-hc-390.png` vs
  `s26-switch-analytics-on-dark-hc-390.png` (and the same pair at 1280).

### D6 — light ON knob against its own track is 2.11:1 — LOW
- `#ffffff` knob on `#43c7a5` track = **2.11**, below the 3:1 non-text floor; the OFF track
  against the card is also thin (**1.28** light, 1.25 dark, 1.11 HC). The state is still
  unambiguous because it is carried by knob *position* plus knob *colour* (16.19:1 against the
  other state's knob), and the pill silhouette is carried by its ink border (16.19:1 in light).
  No user sees a wrong state. Recording it because it is the residual after the fix, not a regression.
- **Evidence:** `s26-switch-analytics-on-light-390.png`, `s26-switch-analytics-off-light-390.png`.

### D7 — disabled `סנכרון מלא` label is unreadable in light — LOW (pre-existing, out of scope)
- Glyph vs fill, sampled from the expanded frames: light `#b3e8da` on `#a1a9ab` = **1.76**;
  dark 2.67; light+HC and dark+HC 3.13. WCAG exempts disabled controls, but the light state is
  effectively illegible.
- **Evidence:** `s26-settings-expanded-light-390.png` (button at y≈332-363).
- Untouched by this batch; listed once, not padded.

---

## 6. Gate output

**No gate was run this round, by instruction** — no `npm run verify`, no `npm run test:run`,
no `npm run test:e2e`, no `npm run db:test`, no build, no server, no git. Claiming any of their
output would be a fabrication. The commands actually run were read-only:

```
Get-ChildItem visual-qa -Filter "s26-*"                  -> 62 PNG + s26-measure.json (76,704 B)
python -c "<PIL census / ASCII maps / WCAG arithmetic>"  -> all figures in this report
python <scratch>/s26probe.py {method,chip,row,switch,settings,sheets}
Remove-Item <scratch>/s26probe.py                        -> "scratch deleted"
```

The scratch probe lived outside the repo and is gone; `reports/visual-qa-s26.md` is the only
file this round created.

One finding about the evidence itself: **`s26-measure.json` contains 16 records, all of group
`g3-bottom-sheets`.** There is not one record for the 46 settings / chip / row / switch PNGs,
even though `meta.labelling` claims "every crop records verifiedText / verifiedAriaLabel /
verifiedAriaChecked". So the `on` / `off` in the switch filenames is **not** corroborated by the
JSON — I inferred state from the mint track hue and the knob side, which agree with the tokens
and with the four display toggles whose expected states are known. Worth fixing in the capture
spec so the next round can cross-check filenames against the DOM.

---

## 7. Not covered — blind spots of this verdict

1. **No 1280 sheet capture exists.** The claimed desktop change (migrated sheets capped at 512px
   and centred instead of full-bleed) is **UNVERIFIED**. All 12 sheet frames are 390 only, where
   a 512px cap cannot bind. The only supporting signal is the `w-full max-w-lg` class on 5 of 6
   sheets in the JSON — a mechanism, not a rendering.
2. **No HC sheet capture.** Sheets exist in light and dark only; `light-hc` / `dark-hc` sheets
   were never taken.
3. **Drag-to-dismiss itself is unobservable in stills** — the gesture, the scrim, the dismiss
   threshold, the rubber-band. I verified the *grabber affordance*, nothing about behaviour.
4. **No keyboard or focus evidence.** Tab order, visible focus rings, focus trap in the sheets,
   Escape-to-close: none of it is in a screenshot. No axe run (`e2e/a11y.spec.ts` not executed).
5. **No frame shows the bottom of the Settings page.** Base and expanded frames are at two
   different scroll positions, every frame is exactly 1500px tall, and no settings record carries
   `mainContent.scrollHeight`, so I cannot tell whether the page pads for the bottom nav. In the
   four expanded 390 frames the `אזור מסוכן` body text runs into the nav bar at the frame edge —
   consistent with either "more scroll below" or "missing bottom padding". Unresolved.
6. **Chip "before" is arithmetic, not a capture.** No earlier chip crop exists, so the
   15.12 → 1.28 transition is measured only at its "after" end.
7. **Untested edges:** offline / IndexedDB, empty states, zero sets logged, a rest day, a
   mid-workout reload, a very long Hebrew string, 320px width. Nothing in this batch captures them.
8. **`s26-workout-live-{light,dark}-390.png`** were not analysed beyond the JSON note that
   `mainContent` is 1500/1500 (no scroll overflow).

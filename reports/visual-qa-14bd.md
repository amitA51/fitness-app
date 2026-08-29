# VISUAL-QA 14b3dbd — hand-derived vs sampled: the high-contrast verdict

**Verdict: PROVEN WITH EXCEPTIONS.** 3 exceptions, listed in §6.
**Scope:** read-only comparison of on-disk artifacts. No browser, no build, no dev server, no
Playwright, no test, no gate, no git command was run. The only file written is this one.
**Commit under test:** `14b3dbd` (the commit stamped in `visual-qa/gates-14bd.json`,
`measure-controls.json`, `measure-home.json`, `measure-readiness.json`).

**`visual-qa/_summary.json` is STALE** (mtime 2026-08-28 11:53, ~6 hours before the batch it would
purport to summarise, whose artifacts are stamped 17:42–18:02). It is not cited anywhere below and no
figure in this report derives from it.

---

## 0. METHOD, VERIFIED BEFORE USE

**Luminance and contrast — WCAG 2.1/2.2 §1.4.3 + §1.4.11, the same formula the probe used:**

```
for each channel c in {R,G,B} as 0..255:
    s   = c / 255
    lin = s / 12.92                     if s <= 0.03928
    lin = ((s + 0.055) / 1.055) ^ 2.4   otherwise
L     = 0.2126*Rlin + 0.7152*Glin + 0.0722*Blin
ratio = (Lbrighter + 0.05) / (Ldarker + 0.05)
```

`color-mix(in srgb, A p%, B)` computed as linear interpolation of the **gamma-encoded** 0–255
channels, then luminance from the resulting hex.

**How the "sampled" column was obtained.** Two independent sources, and I state which per row:
1. `visual-qa/measure-controls.json`, `measure-home.json`, `measure-readiness.json` — **148 readings**
   produced by the screenshot round itself, each naming its PNG.
2. My own lossless PNG decode of the crops in `visual-qa/` (Pillow, `get_flattened_data()` →
   per-pixel histogram). PNG is lossless and the crops are DPR-1 (a 310px-wide tab crop at the 1280
   viewport, 86px at 390 — no downscaling), so every pixel value below is the value the browser wrote.

### 0.1 Method self-check — reproducing figures this repo already publishes

| Repo's own published figure | Where | My derivation | Match |
| --- | --- | --- | --- |
| `#318d78` has L = 0.210572 | `src/components/ui/SettingsToggle.tsx:71` comment | **0.210588** | ✅ (Δ1.6e-5, repo rounded) |
| ON knob `--fs-surface` vs `#318d78` = 4.69:1 (dark) | same comment | **4.6864** | ✅ |
| `--nav-pill-text` on `--nav-pill-bg` = 15.12:1 (light) | `src/styles/components.css:1131` comment | **15.1168** | ✅ |

### 0.2 Second self-check — reproducing the *sampler's* own luminances and fills

This is the stronger check, because it validates my arithmetic against the pixel round rather than
against another hand derivation.

| Sampler's value | Source | My derivation | Match |
| --- | --- | --- | --- |
| `lumTrained` 0.7908 for `#8efad8` | `measure-home.json` weekstrip-polarity | 0.790799 | ✅ |
| `lumRest` 0.1702 for `#4b7c6d` | same | 0.170153 | ✅ |
| `lumEmpty` 0.0027 for `#090909` | same | 0.002732 | ✅ |
| `lumTrained` 0.0195 for `#16292d` (plain light) | same | 0.019459 | ✅ |
| `lumRest` 0.2511 for `#7e8c8d` (plain light) | same | 0.251149 | ✅ |

### 0.3 Third self-check — reproducing sampled PIXELS from the CSS cascade

| Declaration | My computation | Sampled pixel | Match |
| --- | --- | --- | --- |
| empty cell = `color-mix(#111111 55%, #000000)` | `#090909` | `#090909` | ✅ exact |
| rest cell HC = `color-mix(#8efad8 46%, #111111)` | `#4a7c6d` | `#4b7c6d` | ✅ 1 LSB (R = 74.50, an exact .5 tie; the browser rounds up, Python's `round` rounds to even). Ratio unaffected at 2dp. |
| rest cell plain dark = `color-mix(#4ddcbb 46%, #1a1a1a)` | `#317364` | `#317364` | ✅ exact |
| rest cell plain light = `color-mix(#16292d 46%, #d7e0de)` | `#7e8c8d` | `#7e8c8d` | ✅ exact |
| pressed CTA = `#8efad8 × 0.55` uniform | `#4e8a77` | `#4e8a77` | ✅ exact (matches the declared literal) |

**My method reproduces 3 repo-published figures, 5 sampler luminances and 5 sampled pixels. It is
sound; the comparisons below can be trusted.**

---

## 1. CONTRAST FLOORS AND WHERE EACH APPLIES

| Floor | Clause | Applies here to |
| --- | --- | --- |
| **4.5:1** | §1.4.3 body text | Day-cell weekday letters (all three states — see §4.3), CTA label on its fill, nav labels, link text, body ink on a hovered card, badge text. |
| **3:1** | §1.4.3 large text (≥18.66px bold or ≥24px) | **Nothing in this comparison relies on it.** No HC figure below is justified by the large-text exemption; I checked, because it is the easiest way to launder a failing 4.5 figure. |
| **3:1** | §1.4.11 non-text contrast | Selected-state fill vs its track; CTA fill vs the page; pressed-vs-resting state change; toggle border vs track; the three day-cell fills against each other; icon-tile fill vs the page. |
| exempt | §1.4.11 exemption | Purely decorative graphics. Invoked exactly once below, for the Settings icon tile (§5.1), and only because `IconBox.tsx`'s own docstring calls it "Purely decorative". |

### 1.1 Re-check of the mislabelled-floor class T-051 caught

T-051 found the probe scoring the rest cell's dashed border (3.49 light+HC / 4.46 dark+HC) against the
**3:1 non-text** floor when the cell's own label sits on that same fill, making them **4.5:1 text**
figures. **I re-checked this and CONFIRM the reclassification, on source not inference:**
`src/styles/components.css:1204-1209` — `.day-cell.rest { border-color: var(--fs-ink); color: var(--fs-ink); }`.
The rest cell sets `color` explicitly, so its label is `--fs-ink` = `#ffffff` in HC, not the
`--fs-muted` that `.day-cell` sets for the other states. The pixels agree: the rest crop contains
`#ffffff` (66 px) and **no `#f2f2f2` at all**. So 4.77:1 against the 4.5 floor is the right figure on
the right floor.

I tested the reverse hypothesis before publishing: **had** the label been `--fs-muted` `#f2f2f2`, the
real figure would be **4.26:1 — a FAILURE**. It is not, because of that one `color:` line. Worth
recording, because the margin is 0.27.

**I looked for a second instance of the same class and did not find one in the probe.** Every other
3:1 row there is genuinely fill-vs-fill or boundary-vs-fill with the text figure measured separately
(H-1 measures the active-tab label at 15.12 on its own row; H-6's toggle track carries no text).
**I did find the mirror-image error in the SAMPLED data instead — see §5.4.**

---

## 2. TABLE A — TOKEN VALUES: hand-derived cascade vs sampled

Hand-derived column = the value the cascade produces, from `src/styles/tokens.css` (`:root`,
`html.dark`, `html.high-contrast:587-621`) as tabulated in `plans/THEME-AXES-PROBE.md` §2.2–2.3.
Sampled column = `visual-qa/tokens-{light,dark,light-hc,dark-hc}.json`.

| Token | State | Hand-derived | Sampled | Verdict |
| --- | --- | --- | --- | --- |
| `--fs-bg` | light | `#eef3f1` | `#eef3f1` | AGREE |
| | dark | `#000000` | `#000000` | AGREE |
| | light+HC | `#000000` | `#000000` | AGREE |
| | dark+HC | `#000000` | `#000000` | AGREE |
| `--fs-surface` | light / dark | `#ffffff` / `#111111` | `#ffffff` / `#111111` | AGREE |
| | light+HC / dark+HC | `#000000` / `#000000` | `#000000` / `#000000` | AGREE |
| `--fs-surface-2` | light / dark | `#dbe6e3` / `#262626` | `#dbe6e3` / `#262626` | AGREE |
| | light+HC / dark+HC | `#111111` / `#111111` | `#111111` / `#111111` | AGREE |
| `--fs-ink` | light / dark | `#132327` / `#f0f0f0` | `#132327` / `#f0f0f0` | AGREE |
| | light+HC / dark+HC | `#ffffff` / `#ffffff` | `#ffffff` / `#ffffff` | AGREE |
| `--fs-accent` | light / dark | `#43c7a5` / `#4ddcbb` | `#43c7a5` / `#4ddcbb` | AGREE |
| | light+HC / dark+HC | `#8efad8` / `#8efad8` | `#8efad8` / `#8efad8` | AGREE |
| `--fs-plate` | light / dark | `#d7e0de` / `#1a1a1a` | `#d7e0de` / `#1a1a1a` | AGREE |
| | light+HC / dark+HC | `var(--fs-surface-2)` → `#111111` | `#111111` / `#111111` | AGREE |
| `--nav-pill-bg` | light / dark | `#16292d` / `#4ddcbb` | `#16292d` / `#4ddcbb` | AGREE |
| | light+HC / dark+HC | `var(--fs-accent)` → `#8efad8` | `#8efad8` / `#8efad8` | AGREE |
| `--nav-pill-text` | light / dark | `#ffffff` / `#071412` | `#ffffff` / `#071412` | AGREE |
| | light+HC / dark+HC | `var(--color-ink-on-accent)` → `#000000` | `#000000` / `#000000` | AGREE |
| `--nav-bg` | light / dark | `rgba(255,255,255,.78)` / `rgba(17,17,17,.86)` | same, verbatim | AGREE |
| | light+HC / dark+HC | `var(--fs-surface)` → `#000000` **opaque** | `#000000` / `#000000` | AGREE |
| `--btn-primary-bg` | light / dark | `#16292d` / `#4ddcbb` | `#16292d` / `#4ddcbb` | AGREE |
| | light+HC / dark+HC | `#8efad8` / `#8efad8` | `#8efad8` / `#8efad8` | AGREE |
| `--btn-primary-text` | light / dark | `#43c7a5` / `#071412` | `#43c7a5` / `#071412` | AGREE |
| | light+HC / dark+HC | `#000000` / `#000000` | `#000000` / `#000000` | AGREE |
| `--btn-primary-bg-hover` | light / dark | `#0d1a1c` / `#42bda1` | `#0d1a1c` / `#42bda1` | AGREE |
| | light+HC / dark+HC | `#4e8a77` (= accent × 0.55) | `#4e8a77` / `#4e8a77` | AGREE |
| `--color-surface-hover` | light / dark | `#f0f5f3` / `#222222` | `#f0f5f3` / `#222222` | AGREE |
| | light+HC / dark+HC | `var(--fs-surface-2)` → `#111111` | `#111111` / `#111111` | AGREE |
| `--fs-link` | light / dark | `#1d6575` / `#4ddcbb` | `#1d6575` / `#4ddcbb` | AGREE |
| | light+HC / dark+HC | `var(--fs-accent)` → `#8efad8` | `#8efad8` / `#8efad8` | AGREE |
| `--color-ink-on-accent` | all four | `#071412` light+dark, `#000000` in HC | `#071412` / `#071412` / `#000000` / `#000000` | AGREE |

**60 of 60 token-state comparisons agree. Zero disagreements at token level.**

Two structural facts the sampled files establish that no hand derivation could:

- **`tokens-light-hc.json` and `tokens-dark-hc.json` are byte-identical across all 15 tokens.** The
  `html.high-contrast` comment's claim "Resolves identically in light+HC and dark+HC" is now measured,
  not argued. A consequence worth stating plainly for product: **light + high-contrast is a DARK
  palette** (`#000000` page, `#ffffff` ink). T-051 documented this as intended; it is not a defect,
  but a user who turns on "ניגודיות גבוהה" while in light mode gets a black app.
- `--nav-bg` sampled as the literal string `#000000` in both HC states confirms the de-translucency
  actually landed. Pre-fix it was `rgba(255,255,255,.78)`, which composites over black to `#c7c7c7`
  (0.78 × 255 = 198.9 → 199 = `0xc7`) — I reproduce the probe's composite exactly.

---

## 3. TABLE B — CONTRAST FIGURES: hand-derived vs sampled

Sampled source per row: **[M]** = `measure-*.json` reading; **[P]** = my own PNG pixel decode;
**[T]** = recomputed by me from the **sampled token values** in Table A (used where the surface was
not photographed — flagged, never presented as a photograph).

### 3.1 Post-fix figures — the ones the fix is claiming

| # | Surface (both HC states unless noted) | Hand | Sampled | Src | Verdict |
| --- | --- | --- | --- | --- | --- |
| 1 | CTA / selected fill vs page | 16.82 | 16.82 | [M] | AGREE |
| 2 | Ink on CTA / selected fill | 16.82 | 16.82 | [M] | AGREE |
| 3 | Selected fill vs `--fs-surface-2` track | 15.12 | 15.12 | [T] | AGREE (not photographed) |
| 4 | Pressed CTA fill vs page | 5.23 | 5.23 | [M] | AGREE |
| 5 | Black label on pressed fill | 5.23 | 5.23 | [M] | AGREE |
| 6 | Pressed vs resting fill (state change) | 3.22 | 3.22 | [M] | AGREE |
| 7 | Counterfactual: 0.64 factor vs resting | 2.46 | 2.46 | [T] | AGREE — the rejected factor really does fail |
| 8 | Nav pill vs nav bar | 16.82 | 16.82 | [M] | AGREE |
| 9 | Inactive nav icon/label vs bar | 18.76 | 18.76 | [M] | AGREE |
| 10 | `--fs-link` vs surface | 16.82 | 16.82 | [T] | AGREE (token-level) |
| 11 | Body ink on hovered card | 18.88 | 18.88 | [M] corroborated | AGREE |
| 12 | Hovered card fill vs page | 1.11 | 1.11 | [M] | AGREE (deliberate — see 3.2 #24) |
| 13 | `--fs-steel` border vs card | 21.00 | 21.00 | [M] | AGREE |
| 14 | Trained day vs empty day | 15.94 | 15.94 | [M] | AGREE |
| 15 | Rest label + dashed border on rest fill | 4.77 | 4.77 | [M][P] | AGREE |
| 16 | **Active tab fill vs `.tab-row` track** | **15.12** | **1.01** | [M] | **DISAGREE — §5.2** |
| 17 | Toggle white border on ON track (light+HC) | 1.25 | 1.25 | [M] | AGREE (known, unfixed) |
| 18 | Toggle black knob on ON track (dark+HC) | 5.21 | 5.21 | [M] | AGREE |
| 19 | Toggle white border on `#318d78` (dark+HC) | 4.03 | 4.03 | [M] | AGREE |
| 20 | Toggle OFF track vs card | 1.11 | 1.11 | [M] | AGREE |
| 21 | Inactive label on `#111111` track | 16.87 | 16.87 | [M] `computedOnComputed` | AGREE |

### 3.2 Pre-fix baselines these before/after figures rest on

The pre-fix state cannot be photographed — the fix is already in the tree. Every row here is
recomputed by me from the pre-fix cascade, which is what "is the *before* number honest?" reduces to.

| # | Surface | Hand | Recomputed | Verdict |
| --- | --- | --- | --- | --- |
| 22 | light+HC CTA resting vs page (`#16292d` on `#000000`) | 1.39 | 1.39 | AGREE |
| 23 | light+HC pressed vs page, and pressed vs resting | 1.18 / 1.18 | 1.18 / 1.18 | AGREE |
| 24 | light+HC active tab vs track (`#16292d` on `#111111`) | 1.25 | 1.25 | AGREE |
| 25 | light+HC `--fs-link` `#1d6575` on `#000000` | 3.17 | 3.17 | AGREE |
| 26 | light+HC body ink on hovered `#f0f5f3` | 1.10 | 1.10 | AGREE |
| 27 | light+HC hovered card vs page (the figure that went DOWN) | 19.06 | 19.06 | AGREE |
| 28 | light+HC trained vs empty | 1.31 (probe) / 1.32 (T-051) | **1.32** | probe off by 0.01; T-051 right |
| 29 | light+HC rest vs empty (`#7e8c8d` vs `#090909`) | 5.69 (probe) | **5.71** | probe off by 0.02 |
| 30 | dark+HC trained vs empty | 15.91 (probe) | **15.94** | probe off by 0.03 |
| 31 | **dark+HC rest dashed border** | **5.65 (probe)** | **4.46** | **DISAGREE — probe wrong, T-051 right; §5.3** |
| 32 | dark+HC rest vs empty; trained vs rest | 4.47 / 3.56 | 4.47 / 3.57 | AGREE |
| 33 | dark+HC pressed vs resting (`#42bda1` vs `#8efad8`) | 1.86 | 1.863 | AGREE |
| 34 | **`.perfect-week` vs empty** | **16.82 (probe)** | **15.94** | **DISAGREE — mislabel, T-051 right; §5.3** |
| 35 | Mint pill on the white-bar composite `#c7c7c7` | 1.35 | 1.35 | AGREE — the second-order catch is real |
| 36 | Plain light `.perfect-week` vs empty | 1.85 | 1.85 | AGREE (pre-existing plain-theme defect) |
| 37 | Plain `--fs-steel` hairline, light / dark | 1.73 / 1.32 | 1.73 / 1.32 | AGREE |
| 38 | Plain CTA pressed-vs-resting, light / dark | 1.18 / 1.36 | 1.18 / 1.36 [M] | AGREE |

### 3.3 Count

**38 figures compared. 32 agree exactly. 3 agree to within 0.03 (rows 28–30, hand rounding, no verdict
changes). 3 materially disagree (rows 16, 31, 34).** Plus 60/60 token-value agreements (Table A), 3
repo-published self-checks, 5 sampler-luminance reproductions and 5 pixel reproductions.

**On two of the three material disagreements, T-051 had already found and corrected the error itself
and its corrected value is the one the pixels support.** The third (row 16) is new and is a surface
mislabel, not a defect.

---

## 4. WHAT THE PNGs ANSWER THAT THE JSON CANNOT

### 4.1 Week-strip monotonic ordering — CONFIRMED

The task asks specifically whether the three states are ordered monotonically by brightness in each
theme state, and whether both HC states match plain dark. Sampled fills, from my own decode of
`hc-daycell-{done,rest,empty}-*-{390,1280}.png` (12 crops; the 390 and 1280 fills are identical):

| State | trained `.done` | rest | empty | Ordering |
| --- | --- | --- | --- | --- |
| plain light | `#16292d` L=0.0195 | `#7e8c8d` L=0.2511 | `#ebf1f0` L=0.8686 | monotonic, **trained darkest** |
| plain dark | `#4ddcbb` L=0.5635 | `#317364` L=0.1383 | `#1d1d1d` L=0.0123 | monotonic, **trained brightest** |
| light + HC | `#8efad8` L=0.7908 | `#4b7c6d` L=0.1702 | `#090909` L=0.0027 | monotonic, **trained brightest** |
| dark + HC | `#8efad8` L=0.7908 | `#4b7c6d` L=0.1702 | `#090909` L=0.0027 | identical to light+HC |

- **All four states are monotonic.** No state has rest as an interior maximum.
- **Both HC states match plain dark's direction exactly, and match each other pixel-for-pixel.**
  T-051's claim is confirmed by pixels.
- The pre-fix inversion is confirmed arithmetically: light+HC rest resolved to `#7e8c8d` (L=0.2511)
  against a trained cell at `#16292d` (L=0.0195), i.e. **rest was 13× brighter than trained** — an
  interior maximum, exactly as reported. The mechanism is visible in the token diff: `--fs-plate`
  now resolves to `#111111` under HC instead of staying at the light theme's pale `#d7e0de`.
- Operative clause "trained never dimmer than rest": **holds in all four states.**

### 4.2 Both HC states are pixel-identical on every crop I decoded

For all 7 crop families shot in all four states (`daycell-{done,rest,empty}`, `cta-{resting,hover,pressed}`,
`nav-pill`, `nav-inactive`, `toggle-{on,off}`, `partial-badge`), the light+HC and dark+HC crops carry
the same modal fills. This is the strongest single piece of evidence for the fix: the two HC states did
not merely both pass, they **converged**, which is what "leave `--fs-primary` alone and repoint the
semantic pair" was supposed to achieve.

### 4.3 Every day-cell state carries a weekday letter, and all three clear 4.5:1

Read from the crops as images plus per-pixel search (the Hebrew glyphs are small and heavily
antialiased, so only ~5 px sit at the exact token value — see §5.4):

| Cell | Label token | Label vs its own fill (HC) | Floor | Verdict |
| --- | --- | --- | --- | --- |
| trained `.done` | `--nav-pill-text` `#000000` | 16.82 | 4.5 | ✅ |
| rest | `--fs-ink` `#ffffff` | 4.77 | 4.5 | ✅ (margin 0.27) |
| empty | `--fs-muted` `#f2f2f2` | **17.79** | 4.5 | ✅ |

The empty cell's label was measured by **neither** document. It passes comfortably.

### 4.4 Gate readings carry no HC signal

`gates-14bd.json` contains 32 findings and they are the **same four findings repeated across all four
theme states at both viewports** (`nav-nutrition-count=0`, `/nutrition → /`, `premium-row-count=0`,
`/paywall → /`). Those are feature-gating observations for a non-premium non-admin user, identical in
light, dark, light+HC and dark+HC. **No gate behaves differently under high-contrast** — a small but
real negative result.

---

## 5. THE DISAGREEMENTS, AND WHICH SIDE IS RIGHT

### 5.1 ⚠️ NEW, and the most important thing in this report: `--fs-primary` is still painting a tile in BOTH HC states

**Pixel-proven, not inferred.** Counting exact `#16292d` pixels in the full-page 1280 screenshots:

| Screenshot | `#16292d` pixels |
| --- | --- |
| `hc-settings-light-1280.png` | 58,937 |
| `hc-settings-light-hc-1280.png` | **693** |
| `hc-home-light-1280.png` | 4,922 |
| `hc-home-light-hc-1280.png` | **1,304** |
| `hc-progress-light-hc-1280.png` | 0 |
| any `*-dark-*` / `*-dark-hc-*` | 0 |

So the fix removed **98.8%** of the light-theme navy from the Settings screen under HC — and left a
residue. I located both residues by bounding box and then by region histogram:

**Home (1,304 px, a 42×42 disc at y 139–180):** the disc is `#8efad8` (1,451 px) with a `#16292d`
glyph inside. Glyph-on-accent = **12.10:1** in light+HC, `#0a0a0a` on `#8efad8` = **15.85:1** in
dark+HC. **Both pass. Not a defect** — this is `--fs-primary` used correctly, as ink on the accent.

**Settings (693 px, a 32×32 rounded tile at y 1142–1173):** region histogram is `#000000` × 912
(page), `#16292d` × 693 (tile fill), `#111111` × 92, `#8efad8` × 30 (the glyph). In dark+HC the same
region is `#000000` × 912, **`#0a0a0a` × 703**, `#111111` × 92, `#8efad8` × 30.

I matched that signature to source: **`src/pages/settings/sections/ThemeSection.tsx:53-59`** — the
`מצב כהה` row's icon, a hand-rolled 32×32 `borderRadius: 12` box with
`backgroundColor: 'var(--fs-primary)'` + `border: '2px solid var(--fs-primary)'` wrapping a `Moon`
icon coloured `var(--fs-accent)`. Size, radius, fill token and accent glyph all match the pixels.

| Measurement | plain light | plain dark | light+HC | dark+HC | Floor |
| --- | --- | --- | --- | --- | --- |
| Tile fill vs its surroundings | 15.12 ✅ | **1.05** ⛔ | **1.39** ⛔ | **1.06** ⛔ | 3:1 §1.4.11 |
| `Moon` glyph on the tile | 12.10 ✅ | 15.85 ✅ | 12.10 ✅ | 15.85 ✅ | 3:1 |

**Which is right, and the arithmetic.** L(`#16292d`) = 0.019459, L(`#000000`) = 0,
(0.019459+0.05)/(0+0.05) = **1.389**. L(`#0a0a0a`) = 0.003035 → (0.053035)/(0.05) = **1.061**;
against the plain-dark card `#111111` (L=0.005605) → (0.055605)/(0.053035) = **1.048**. Nothing to
massage: the tile has no boundary in three of the four states.

**How to read it.** The glyph is legible in every state, so there is no §1.4.3 exposure and no
information is lost. `IconBox.tsx`'s docstring calls this element "Purely decorative", which is
precisely the §1.4.11 exemption — so I am **not** scoring this as a WCAG failure. Two things still
matter:

1. **It contradicts "dark + high-contrast still holds — every metric meets its floor."** At 1.06:1
   this tile is worse in dark+HC than in light+HC, and it is worse still than the neighbouring
   `IconBox` tiles (`#111111` on `#000000` = 1.11:1). Dark+HC is not clean; it is *no worse than
   plain dark*, which is a different claim.
2. **`ThemeSection.tsx` duplicates `IconBox` inline and reached for the one token HC deliberately
   cannot move.** The shared component (`src/pages/settings/components/IconBox.tsx:20`) would have
   produced a `#111111` tile with an 18.88:1 white glyph. This is the same "a second copy of the
   house component" pattern the board has flagged before, and it is what let `--fs-primary` survive
   the fix on this screen.

**And the exception is much larger than the three lines T-051 named.** A grep for
`var(--fs-primary)` across `src/` returns **222 references in 82 files** (22 of them inside
`src/styles/` — the token graph itself — and 2 in a test comment, leaving ~198 live component
references). T-051's finding list names `SettingsPrimitives.tsx:284,333,401`. In light+HC every one of
those sites that paints a fill or a border resolves to `#16292d` against a `#000000` page: **1.39:1**.
`ThemeSection.tsx` is proof that at least one more of them is on a screen a user reaches in two taps.
This is not an argument against the architectural call — leaving a dual-use token alone was correct —
it is a statement that **the size of the resulting exception was never measured.**

### 5.2 Row 16 — active tab 15.12 vs sampled 1.01: a surface mislabel, hand figure right

The hand figure is `.tab-row .tab.active` (`components.css:1210`), which paints
`background: var(--nav-pill-bg)` — a filled pill — inside `.tab-row`, whose track is
`background: var(--fs-surface-2)` (`components.css:1102-1110`). Under HC that is `#8efad8` on
`#111111`: L 0.790799 vs 0.005605 → (0.840799)/(0.055605) = **15.12**. The sampled tokens in Table A
confirm both operands independently. **The hand figure is correct.**

**The sampled 1.01 is measuring something else.** I decoded the crops per row:

| Crop | modal backdrop | row 42 of 45 | `#8efad8` pixel count |
| --- | --- | --- | --- |
| `hc-tab-active-light-hc-1280` (310×45) | `#050f11` | **`#8efad8` × 310, full width** | 310 |
| `hc-tab-active-dark-hc-1280` | `#061417` | `#8efad8` × 310 | 310 |
| `hc-tab-active-light-hc-390` (86×45) | `#040d0f` | `#8efad8` × 86 | 86 |
| `hc-tab-active-light-1280` | `#d7e5e6` | `#43c7a5` × 310 | 0 (`#16292d` also 0) |

Exactly one saturated pixel row, at the bottom edge, spanning the full crop width, coloured
`--fs-accent` in every state. **That is an underline indicator, not a filled pill.** `.tab-row .tab`
has `border-radius: 12px` and no bottom rule, so this is a different component — it matches
`src/pages/coach/CoachMessages.tsx:245`
(`borderBottom: isActive ? '2px solid var(--fs-accent)' : '2px solid transparent'`), and the CTA
reading in the same file carries `note: "route /my-coach"`, which puts the shoot on the coach screens.

So the sampler's `fill` for `tab-active` is the tab row's own backdrop and its `vsTrack: 1.01` is
**backdrop against backdrop** — two near-identical near-blacks. Not a failure, not a regression: a
comparison of a surface with itself.

Confirmation that the sampler's numbers are internally consistent once relabelled: its
`inkOnFill` for `tab-active` is 15.72 (light+HC/390), 15.53 (light+HC/1280) and 15.01 (dark+HC). I
computed `#8efad8` against each crop's own backdrop and got **15.72 / 15.53 / 15.01** — exact. So the
sampler's "ink" is the accent underline and its "fill" is the backdrop; it measured
**indicator-vs-backdrop** and labelled it text contrast. As a §1.4.11 selected-state figure that is
15.0–15.7:1, comfortably over 3:1. ✅

**Net:** the hand figure and the sample are both arithmetically right about different surfaces.
`.tab-row .tab.active` and the active filter chip (`components.css:626`) were **never photographed** —
that is exception E1 in §6, not a contradiction.

### 5.3 Rows 31 and 34 — the probe was wrong twice, and T-051's corrections are the ones the pixels support

**Row 31, dark+HC rest dashed border.** Probe: 5.65. My recomputation: **4.46**. The probe contradicts
itself — it states L(`#4f8171`) = 0.185927 on its own page, and 1.05/(0.185927+0.05) = **4.45**, not
5.65. (My L(`#4f8171`) = 0.18555 → 4.458.) A fill yielding 5.65 under white would need L = 0.1358,
which is no surface in that cascade. T-051's 4.46 is right. Nothing turns on it: both clear 3:1, and
under the corrected 4.5 text floor (§1.1) the **pre-fix** figure was failing in dark+HC too — which
is T-051's actual finding, and it survives.

**Row 34, `.perfect-week` vs empty.** Probe: 16.82. That is `#8efad8` against **pure `#000000`**. The
empty cell is not pure black — it is `color-mix(#111111 55%, #000000)` = `#090909`, which I reproduce
exactly and which the sampler photographed as `#090909`. Against the real neighbour the figure is
**15.94** (`measure-home.json` `trainedVsEmpty: 15.94`, matching my 15.94). A mislabelled reference
surface, not a defect; T-051's correction is right and the sample confirms it.

**One place I checked the probe and it was right where I initially thought it wrong:** its dark+HC
"pressed vs resting 1.86" pairs `#42bda1` against the *HC* resting fill `#8efad8` (not plain dark's
`#4ddcbb`, which gives 1.36 and is what the sampler reports for plain dark). L(`#42bda1`) = 0.4013 →
(0.840799)/(0.451300) = **1.863**. Probe correct; I nearly filed a false finding by mis-pairing the
operands, which is the same class of error as row 34 in the opposite direction.

### 5.4 The sampler's `inkOnFill` is not safe to read as a text verdict on small glyphs

Two readings in `measure-*.json` are false lows, both from a modal-colour heuristic meeting a thin
antialiased glyph. This is a caveat on the sampled dataset, not a defect in the app:

| Reading | Sampled | Actual | Why |
| --- | --- | --- | --- |
| `daycell-empty` `inkOnFill` (all four states) | 1.05 | **17.79** | The weekday letter's core colour `#f2f2f2` occupies **5 pixels** in a 3,192-pixel crop. The heuristic's "ink" landed on the cell border `#111111` (1.05:1 against `#090909`). |
| `partial-badge` `inkOnFill` (HC) | 14.99 | **16.87** | Sampled ink is an antialiased edge value; the file's own `partial-badge-computed` row reports `computedOnComputed: 16.87`, agreeing with my arithmetic. |

The sampler was right to also emit `*-computed` rows; where both exist, the computed one is the
trustworthy figure.

### 5.5 One place the pixels disagree with the fix's own premise

`html.high-contrast` repaints surfaces to **pure black**, and the token JSONs confirm the token values.
But the photographed backdrop behind the coach-messages tab row is not black:

| State | Backdrop | White ink on it | Accent on it |
| --- | --- | --- | --- |
| light+HC | `#040e10` (L 0.0035) | 19.63 (vs 21.00 predicted) | 15.72 (vs 16.82) |
| dark+HC | `#061416` (L 0.0060) | 18.75 | 15.01 |
| plain dark | `#061416` — **identical to dark+HC** | 18.75 | 15.01 |

The variance within a crop is ±1–2 per channel across 130–190 distinct values, i.e. a real subtle
gradient, not compression (PNG is lossless). The teal cast rules out `--fs-surface-2` in either theme
(`#111111` / `#262626` are neutral greys), and the fact that dark+HC is **byte-identical to plain
dark** means whatever paints it is not reached by `html.high-contrast` at all. I ruled out
`.glass-surface` / `.glass-surface-dark` (`components.css:1417,1424`) — both resolve to
`var(--fs-surface)`, which HC does set to `#000000`. **Cause not determined.** Severity: low — every
ratio still clears its floor by 5×. It is a corroboration of T-051's own finding #5 (HC's
de-translucency rule targets four class names with zero call sites) rather than a new failure.

---

## 6. VERDICT

> ### PROVEN WITH EXCEPTIONS.
>
> Every figure the fix claims for the surfaces that were actually photographed is confirmed by the
> pixel evidence, to the decimal: CTA fill 16.82, pressed 5.23, pressed-vs-resting 3.22, nav pill vs
> bar 16.82, inactive nav label 18.76, trained-vs-empty 15.94, rest label 4.77, hovered-card ink
> 18.88, steel border 21.00. All 60 token-state values match. The week strip is monotonic in all four
> states and both HC states match plain dark's ordering pixel-for-pixel. The de-translucified nav is
> opaque `#000000` as claimed, so the 1.35:1 "new invisible selection" the fix pre-empted is real and
> was pre-empted. No gate behaves differently under high-contrast.

**The exceptions:**

- **E1 — the two headline surfaces were never photographed.** `.tab-row .tab.active`
  (1.25 → 15.12) and the active filter chip (1.39 → 16.82) have **no crop in this batch**. The tab
  crop that exists is a different component (§5.2). Both figures are token-level arithmetic that I
  independently reproduce from the *sampled* token values, so they are well-supported — but they are
  not pixel-proven, and T-051's summary presents them as measured.
- **E2 — `--fs-primary` still paints a real tile, and dark+HC is not clean.**
  `src/pages/settings/sections/ThemeSection.tsx:53-59` renders a 32×32 tile at **1.39:1** (light+HC)
  and **1.06:1** (dark+HC) against the page, pixel-proven in `hc-settings-light-hc-1280.png` (693 px)
  and `hc-settings-dark-hc-1280.png` (703 px). Decorative, so not a WCAG failure — but it falsifies
  "dark+HC: every metric meets its floor", and the unaudited surface behind it is **222
  `var(--fs-primary)` references across 82 files**, not the 3 lines the finding list names (§5.1).
- **E3 — three known-and-unfixed findings remain unverified at element level.** `.toggle-thumb`
  (`components.css:381`, claimed 15.12 → 1.25) and `SettingsPrimitives.tsx:284,333,401` (claimed
  1.39) have no crop; the `hc-toggle-*` crops are `SettingsToggle`, a different component. Of the
  three, only `SettingsToggle`'s `#318d78` claim is pixel-confirmed — the dark+HC ON track samples as
  `#318d78` with a white border at 4.03:1 and a black knob at 5.21:1, and light+HC samples the white
  border on `#8efad8` at exactly the claimed **1.25:1**.

**On the disagreements specifically, since that is the point of this task:** 3 of 38 figures
materially disagree. Two of them (rows 31, 34) are errors T-051 had already found in the probe and
corrected, and in both cases **the corrected value is the one the pixels support** — so the earlier
report's self-correction is itself now verified. The third (row 16) is a surface mislabel in the
sampled data, resolved in §5.2 with both operands identified. **No hand figure that the pixels
contradict has survived into the fix.** The one genuinely new problem (§5.1) is not a wrong number —
it is a missing one.

---

## 7. WHAT I COULD NOT DETERMINE FROM THESE FILES, AND WHY

1. **`.tab-row .tab.active` and `.chip-fs.active` at pixel level.** No crop of either exists in
   `visual-qa/`. Needs one screenshot of a screen that renders a `.tab-row` (the crops in this batch
   are the coach-messages underline tabs).
2. **`.toggle-thumb` (`components.css:381`) and `SettingsPrimitives` active borders.** Not
   photographed. `SettingsPrimitives` lives inside the in-workout settings overlay, and this batch
   contains no overlay screenshot at all.
3. **Whether the HC unmount bug is actually fixed.** That is a runtime `classList` behaviour
   (enter a workout → leave → observe `<html>`). No static artifact can show it. The 2-line removal in
   `useWorkoutSettings` is visible in source; its effect is not.
4. **The source of the non-black `#040e10` / `#061416` tab-row backdrop** (§5.5). I ruled out
   `.glass-surface` / `.glass-surface-dark`. Identifying it needs the DOM, which needs a browser.
5. **DOM confirmation that the Settings tile is `ThemeSection.tsx:53-59`.** The match is strong —
   32×32, `borderRadius: 12`, fill exactly `--fs-primary` per theme, glyph exactly `--fs-accent`, 30
   accent pixels consistent with a 16px `Moon` stroke — but it is a signature match, not a selector
   readback.
6. **A full 390px overflow / RTL-mirroring sweep.** I inspected the crops and the four full-page
   390px screenshots' target regions, not every row of every screen. Mixed Hebrew+number strings and
   clipping at 390px are not assessed here.
7. **Anything about the week strip beyond the three photographed states.** `.day-cell.today` (an
   accent border + inset ring) and `.day-cell.done.perfect-week` have no crop in this batch; the
   `perfect-week` figure in §3.2 row 34 is arithmetic on sampled tokens.
8. **Whether the plain-theme figures changed.** T-051 claims all 28 metrics are identical before and
   after for plain light and plain dark. I can confirm the *post*-fix plain values against the
   sampled data, but there is no pre-fix sampled set on disk to diff against, so "identical before and
   after" is verified only by the structural argument that every edit sits inside
   `html.high-contrast` — which I did confirm by reading the block (`tokens.css:587-621`, plus the two
   rule blocks at 624-637 that are also HC-scoped).

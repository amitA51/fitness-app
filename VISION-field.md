# VISION — Field Guide (alternative 06)

> Concept: training as expedition journal. Preview: `design-preview-field.html` (tbd).

## Soul
A training app built as a **field-guide journal** — the kind a surveyor or alpinist would carry into the mountains. Kraft-paper covers, topographic contour overlays, hand-drawn compass marks, ink-stamped dates. Every workout is a **survey entry** in an expedition log. Every PR is a summit record. Warm, tactile, narrative — but scientific in its precision. Think USGS survey maps meets a 1960s Arc'teryx catalogue meets a Leuchtturm1917 field notebook. An overcast morning in the forest, pulled into a screen.

## DNA — 5 words
**Tactile · Expeditionary · Topographic · Warm · Earned**

---

## 1. Color System

### 1.1 Primary Palette

| Token | Hex | Role | Contrast on kraft |
|---|---|---|---|
| `--kraft` | `#E8DFC7` | warm kraft-paper page background | — |
| `--kraft-deep` | `#D4C7A3` | card surfaces, section fills, inset blocks | — |
| `--vellum` | `#F3ECD9` | elevated surfaces, cards resting on kraft | — |
| `--sage` | `#788C6B` | muted secondary — trail-marker green, hairlines | 3.2:1 (large + decorative) |
| `--moss` | `#3A4A2D` | **primary action color** — deep forest moss | 8.9:1 ✅ AAA |
| `--moss-deep` | `#28351F` | pressed state, hero blocks, deepest ink | 12.1:1 ✅ AAA |
| `--oxide` | `#A24A1E` | **accent** — oxidized iron/rust; PR stamps, live indicator, elevation gain | 4.8:1 ✅ AA |
| `--bone-ink` | `#2A2420` | primary text — warm ink, never black | 12.8:1 ✅ AAA |
| `--ash-ink` | `#7A6F62` | secondary text, captions, marginalia | 4.6:1 ✅ AA |
| `--compass` | `#5C5246` | neutral metalwork for compass glyphs, rule lines | 6.1:1 ✅ AAA |

The palette feels pulled from an overcast morning in the forest — no pure white, no pure black, no neon. Kraft carries the page, moss commits the action, oxide stamps the event.

### 1.2 Semantic Tokens

| Token | Maps to | Use |
|---|---|---|
| `--color-primary` | `var(--moss)` | primary actions, focus rings, active nav |
| `--color-primary-hover` | `var(--moss-deep)` | hover / pressed primary |
| `--color-secondary` | `var(--sage)` | secondary actions, muted chips |
| `--color-accent` | `var(--oxide)` | PR stamps, live indicators, elevation gain |
| `--color-success` | `#4F6B3E` | positive feedback (on kraft: 5.1:1 ✅ AA) |
| `--color-warning` | `#B07A1C` | caution (on kraft: 4.7:1 ✅ AA) |
| `--color-error` | `#8E2A1C` | destructive (on kraft: 6.2:1 ✅ AAA) |
| `--color-text` | `var(--bone-ink)` | primary body text |
| `--color-text-secondary` | `var(--ash-ink)` | captions, secondary labels |
| `--color-text-muted` | `rgba(42,36,32,0.45)` | hint text, placeholders |
| `--color-background` | `var(--kraft)` | page background |
| `--color-surface` | `var(--vellum)` | elevated cards |
| `--color-surface-inset` | `var(--kraft-deep)` | inset, secondary cards |
| `--color-border` | `rgba(120,140,107,0.35)` | default hairlines — sage-tinted |
| `--color-border-strong` | `var(--oxide)` | card binding edges, emphasized borders |
| `--color-rule` | `var(--compass)` | compass rules, section dividers |

### 1.3 Contrast Rules

- Oxide rust (`#A24A1E`) on kraft (`#E8DFC7`) = **4.8:1 ✅ AA** for all body text ≥14px and large text.
- Sage (`#788C6B`) on kraft = **3.2:1** — decorative and large-text only. Never body text.
- Moss (`#3A4A2D`) on vellum or kraft passes AAA at every size — use freely.
- Ash ink on kraft passes AA for body. Use for marginalia coordinates and captions.
- Oxide on moss = **2.1:1** — decorative contrast only; pair oxide with kraft/vellum instead.
- The rust/sage combination used in stamps and compass rules satisfies AA because oxide carries the meaning and sage supports it decoratively.

---

## 2. Typography

### 2.1 Font Stack

| Role | Family | Fallback | Source |
|---|---|---|---|
| Display | `Fraunces` | `Georgia, 'Times New Roman', serif` | Google Fonts, weights 500/700 |
| Body | `Inter Tight` | `system-ui, -apple-system, sans-serif` | Google Fonts, weights 400/500/600 |
| Data / coordinates | `JetBrains Mono` | `ui-monospace, Menlo, monospace` | Google Fonts, weights 400/500 |
| Hand-drawn accent | `Caveat` | `'Segoe Script', cursive` | Google Fonts, weight 500 |
| Hebrew display | `Frank Ruhl Libre` | serif, `'Times New Roman'` | Google Fonts, weights 500/700 |
| Hebrew body | `Rubik` | system-ui, sans-serif | Google Fonts, weights 400/500 |
| Hebrew label | `Miriam Libre` | sans-serif | Google Fonts, weights 400/700 |

```css
@import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,700&family=Inter+Tight:wght@400;500;600&family=JetBrains+Mono:wght@400;500&family=Caveat:wght@500&family=Frank+Ruhl+Libre:wght@500;700&family=Rubik:wght@400;500&family=Miriam+Libre:wght@400;700&display=swap');
```

### 2.2 Type Scale

| Token | Size | Weight | Font | Line-height | Letter-spacing | Use |
|---|---|---|---|---|---|---|
| `--text-summit` | 96px | 700 | Fraunces | 0.95 | -0.02em | summit / PR hero numbers |
| `--text-display-xl` | 72px | 500 | Fraunces | 1.0 | -0.015em | session weight, hero stat |
| `--text-display-lg` | 48px | 500 | Fraunces | 1.05 | -0.01em | masthead titles, elevation |
| `--text-display` | 32px | 500 | Fraunces | 1.1 | 0 | card titles, chapter heads |
| `--text-title` | 22px | 500 | Fraunces | 1.2 | 0 | exercise names, entries |
| `--text-headline` | 18px | 600 | Inter Tight | 1.3 | 0 | card headlines, form labels |
| `--text-body-lg` | 16px | 400 | Inter Tight | 1.6 | 0 | large body, descriptions |
| `--text-body` | 14px | 400 | Inter Tight | 1.55 | 0 | default body |
| `--text-body-sm` | 13px | 500 | Inter Tight | 1.5 | 0.01em | small body, secondary meta |
| `--text-label` | 11px | 500 | JetBrains Mono | 1.4 | 0.16em | uppercase labels, section kickers |
| `--text-coord` | 10px | 400 | JetBrains Mono | 1.3 | 0.08em | coordinate marginalia |
| `--text-caption` | 9px | 500 | JetBrains Mono | 1.35 | 0.24em | tiny field notes, stamp text |
| `--text-hand` | 16px | 500 | Caveat | 1.15 | 0 | pencil-mark annotation (max 2/screen) |

### 2.3 Hebrew Typography

Hebrew titles use **Frank Ruhl Libre** (warm serif that pairs with Fraunces). Body uses **Rubik** (close metrics to Inter Tight). Uppercase labels use **Miriam Libre** as a structural sans — Hebrew has no true uppercase, so labels rely on weight + tracking.

- `letter-spacing: 0` on Hebrew body (no tracking needed)
- `line-height` increased by ~0.08 for Hebrew readability
- Weight 700 replaces italic — Hebrew has no true italic
- Numbers inside Hebrew runs stay LTR via `<span dir="ltr">` or `unicode-bidi: isolate`
- Coordinate marginalia stays in JetBrains Mono (Latin) even in RTL — scientific notation is universal

### 2.4 Number & Coordinate Formatting

- Data numbers use `JetBrains Mono` with `font-variant-numeric: tabular-nums`
- Thousands separator: comma (`12,450 kg`)
- Decimals: period (`+4.1%`, `90.5 kg`)
- Coordinates: `34.021° N · 35.248° E · 247m` — lat, lon, elevation, separated by middle dot
- Bearings: three-digit degree (`007°`, `284°`) for compass references
- Dates on stamps: `WED / 23.04.26 / 06:12` — day / DD.MM.YY / HH:MM
- Entry numbers: zero-padded three-digit (`ENTRY 047`)
- Hebrew numbers remain LTR; wrap with `dir="ltr"` inside RTL paragraphs

---

## 3. Spacing & Layout

### 3.1 Spacing Scale (4/8pt Grid)

| Token | Value | Use |
|---|---|---|
| `--space-0` | 0 | — |
| `--space-1` | 4px | inline icon gaps, micro-offsets |
| `--space-2` | 8px | tight element gaps |
| `--space-3` | 12px | compact internal padding |
| `--space-4` | 16px | standard gaps, related-item spacing |
| `--space-5` | 20px | page horizontal padding, card padding |
| `--space-6` | 24px | section internal gaps |
| `--space-8` | 32px | section separation |
| `--space-10` | 40px | major section breaks |
| `--space-12` | 48px | chapter-level separation |
| `--space-16` | 64px | page-level separation |
| `--space-20` | 80px | hero / summit separation |

### 3.2 Content Width & Padding

| Property | Mobile (<768px) | Tablet (768–1024px) | Desktop (>1024px) |
|---|---|---|---|
| Content max-width | 100% | 680px | 480px (phone-like) |
| Horizontal padding | 20px | 32px | auto-centered |
| Card padding | 20px | 24px | 24px |
| Marginalia inset | 12px from edge | 16px | 16px |

### 3.3 Responsive Breakpoints

| Name | Width | Description |
|---|---|---|
| `sm` | 375px | small phone baseline — primary target |
| `md` | 768px | tablet |
| `lg` | 1024px | desktop / wide tablet |
| `xl` | 1440px | wide desktop (still 480px phone-like center column) |

Mobile-first. Desktop centers a phone-like column; the surrounding page can display the marginalia coordinates at full width like a map-margin.

---

## 4. Borders, Radius, Shadows

### 4.1 Border Radius

| Token | Value | Use |
|---|---|---|
| `--radius-none` | 0 | section fills, chapter strips, ink-stamp rectangles |
| `--radius-xs` | 2px | inline chips, coordinate pills |
| `--radius-sm` | 4px | small cards, input underlines |
| `--radius-md` | 6px | buttons, default cards |
| `--radius-lg` | 10px | hero cards, elevated surfaces |
| `--radius-full` | 9999px | compass dial, circular toggles |

The Field Guide prefers slight radius (6–10px) for most surfaces — warm and notebook-like, never sharp-editorial.

### 4.2 Borders

| Style | Spec | Use |
|---|---|---|
| Binding edge | `2px solid var(--oxide)` top-only | card "binding" on kraft-deep |
| Hairline rule | `1px solid var(--color-border)` | section dividers, list separators |
| Compass rule | `1px solid var(--compass)` full-width with 24px compass glyph at center | section breaks |
| Input underline | `1px solid var(--ash-ink)`, focus `2px solid var(--moss)` | form fields |
| Entry edge | `1px dashed rgba(122,111,98,0.4)` | future/pending entries |

### 4.3 Shadows

Shadows are subtle and warm-toned — the Field Guide uses **binding borders, grain texture, and elevation-contour depth**, not drop shadows.

| Token | Value | Use |
|---|---|---|
| `--shadow-stamp` | `inset 0 1px 0 rgba(255,247,228,0.35), inset 0 -1px 2px rgba(40,53,31,0.10)` | stamped-into-paper effect on buttons |
| `--shadow-card` | `0 1px 2px rgba(40,53,31,0.06), 0 4px 10px rgba(40,53,31,0.05)` | elevated vellum cards |
| `--shadow-elevated` | `0 6px 18px rgba(40,53,31,0.14)` | modals, overlays |
| `--shadow-ink-bleed` | `0 0 0 1px rgba(162,74,30,0.25), 0 0 8px rgba(162,74,30,0.12)` | oxide stamp ink-bleed on press |

---

## 5. Motion & Animation

### 5.1 Duration Scale

| Token | Value | Use |
|---|---|---|
| `--duration-instant` | 80ms | opacity ticks, color shifts |
| `--duration-fast` | 160ms | button press, toggle |
| `--duration-base` | 220ms | card hover, tab change |
| `--duration-slow` | 340ms | page transitions, stamp descent |
| `--duration-contour` | 600ms | topographic contour line draw-in |
| `--duration-survey` | 900ms | hero number count-up, elevation fill |

### 5.2 Easing

| Token | Value | Use |
|---|---|---|
| `--ease-out` | `cubic-bezier(0.22, 0.61, 0.36, 1)` | elements entering view |
| `--ease-in` | `cubic-bezier(0.55, 0.06, 0.68, 0.19)` | elements leaving view |
| `--ease-paper` | `cubic-bezier(0.16, 1, 0.3, 1)` | page/chapter reveals — settles like paper |
| `--ease-stamp` | `cubic-bezier(0.68, -0.20, 0.35, 1.20)` | stamp descent — slight overshoot |
| `--ease-contour` | `cubic-bezier(0.65, 0, 0.35, 1)` | contour line draw — steady pen |

### 5.3 Animation Patterns

| Pattern | Animation | Duration | Easing |
|---|---|---|---|
| Page enter | opacity 0→1 + translateY(6px→0) | 340ms | ease-paper |
| Contour draw-in | `stroke-dashoffset` N→0, staggered from bottom contour upward | 600ms, stagger 60ms | ease-contour |
| Hero number count-up | tween to target | 900ms | ease-out |
| Elevation fill | contours fill bottom→top, each contour 120ms | 720ms total | ease-paper |
| Stamp descent | translateY(-8px)→0, opacity 0→0.7, rotate(-5deg→-3deg) | 260ms | ease-stamp |
| Ink bleed (press) | box-shadow 0→`--shadow-ink-bleed`, scale 1→0.98 | 140ms | ease-out |
| Compass rotate (nav change) | rotate bearing diff (e.g. +35deg) | 420ms | ease-paper |
| Toast / field-note | slide-up from bottom + fade | 260ms | ease-paper |
| Modal | scale(0.96→1) + opacity + backdrop blur | 300ms | ease-paper |
| Exit | 60–70% of enter duration | — | ease-in |

### 5.4 Reduced Motion

Respect `prefers-reduced-motion: reduce`:

- **Disable contour line draw-in** → contours appear fully drawn on mount
- **Disable stamp ink-bleed** → stamp appears at final opacity without overshoot
- **Disable count-up** → show final number instantly
- **Disable compass rotation** → pointer snaps to new bearing
- Keep functional press feedback (≤100ms color change) so taps still register visibly
- Never rely on animation alone to convey state — pair with static cues

---

## 6. Z-Index Scale

| Token | Value | Use |
|---|---|---|
| `--z-contour` | -1 | topographic contour overlays (behind content) |
| `--z-base` | 0 | default content |
| `--z-marginalia` | 10 | coordinate margin notes |
| `--z-sticky` | 20 | sticky chapter headers, compass rules |
| `--z-stamp` | 30 | ink stamps hovering over cards |
| `--z-nav` | 40 | bottom navigation |
| `--z-dropdown` | 60 | dropdowns, select menus |
| `--z-overlay` | 80 | modal backdrop |
| `--z-modal` | 90 | modal content |
| `--z-toast` | 100 | field-note toasts |
| `--z-tooltip` | 110 | tooltips, coordinate callouts |

---

## 7. Five Signature Elements

1. **Topographic contour overlays** — faint concentric SVG contour paths sit at `z-index: -1` behind every hero number block. `stroke: var(--sage); stroke-width: 1; stroke-opacity: 0.12; fill: none`. Contours are generated procedurally around the number's center; spacing is tighter near the peak (like a steep slope) and wider at the edges. Each contour has a `stroke-dasharray` + `stroke-dashoffset` animation that draws in sequentially on mount. Every stat sits on a mapped elevation.

2. **Ink-stamp date markers** — every workout card gets a stamp in the top-right corner: an oxide-rust rectangle (`background: var(--oxide)`), mono caps text `WED / 23.04.26 / 06:12`, rotated `-3deg`, opacity `0.7`, slight grain texture. A faint `inset 0 0 2px rgba(40,53,31,0.25)` gives the ink-absorbed edge. Never digital-clean. Uses `mix-blend-mode: multiply` to bleed into kraft.

3. **Compass-mark section dividers** — between sections, a hairline sage rule spans full width with a 24px SVG compass glyph centered on it. The glyph shows N/E/S/W tick marks and a subtle bearing indicator, `stroke: var(--ash-ink)`, `stroke-width: 1.25`. Rule: `1px solid var(--compass)`. On navigation change, the compass pointer animates to a new bearing matching the current screen.

4. **Elevation-gain progress** — progress bars are not horizontal bars. They are stacked topographic contours (5–8 concentric arcs) that fill in from bottom to top as progress advances. Each contour fills `var(--moss)` when reached, stays sage-faint when not. Feels like climbing a hill. A small oxide triangle marks the current summit percentage.

5. **Marginalia coordinates** — every screen shows small monospace coordinates in the outer margin: `34.021° N · 35.248° E · 247m` at 10px, `color: var(--sage)`, vertically aligned. On mobile they sit inline under the masthead; on desktop they float in the page margin like map-sheet notation. These are decorative but real — derived from the user's approximate training location (with permission) or a poetic default (`34.021° N · 35.248° E` — the Carmel ridge).

---

## 8. Component Specifications

### 8.1 Buttons

| Variant | Background | Text | Border | Radius | Padding | Min-height |
|---|---|---|---|---|---|---|
| Primary | `var(--moss)` | `var(--vellum)` | none | 6px | 14px 22px | 48px |
| Secondary | `var(--vellum)` | `var(--moss)` | `1px solid var(--moss)` | 6px | 14px 22px | 48px |
| Ghost | transparent | `var(--moss)` | none | 6px | 10px 16px | 44px |
| Destructive | `var(--color-error)` | `var(--vellum)` | none | 6px | 14px 22px | 48px |
| Stamp (PR) | `var(--oxide)` | `var(--vellum)` | none | 4px | 10px 14px | 36px |
| Small | `var(--moss)` | `var(--vellum)` | none | 4px | 8px 14px | 36px |

All buttons use **Inter Tight 600**, tracking `0.04em`, never full uppercase — sentence case or Title Case. Primary buttons carry `--shadow-stamp` to feel stamped into paper.

**States:**
- Hover: shift to `--moss-deep`
- Active/pressed: `scale(0.98)` + `--shadow-ink-bleed` (ink bleeds around edges), 140ms
- Disabled: `opacity: 0.4; cursor: not-allowed`
- Focus-visible: `outline: 2px solid var(--oxide); outline-offset: 3px`

### 8.2 Cards

| Type | Background | Border | Padding | Radius |
|---|---|---|---|---|
| Entry card | `var(--kraft-deep)` | `2px solid var(--oxide)` top-only | 20px | 8px |
| Elevated card | `var(--vellum)` | `1px solid var(--color-border)` | 20px | 10px |
| Inset card | `var(--kraft-deep)` | none, inset feel | 16px | 6px |
| Summit card | `var(--moss-deep)` | none | 24px | 10px |

Entry cards have a 2px oxide top border (the "binding" of a notebook page) and a subtle paper-grain CSS pattern at 4% opacity. Cards receive the ink-stamp date marker in the top-right corner and optional marginalia coordinate on the bottom edge.

### 8.3 Inputs

| Property | Value |
|---|---|
| Background | `var(--vellum)` |
| Border | none on sides, `1px solid var(--ash-ink)` underline only; focus `2px solid var(--moss)` |
| Text | Inter Tight 400, 15px, `var(--bone-ink)` |
| Label | above field, JetBrains Mono 11px, `var(--ash-ink)`, tracking `0.16em`, uppercase |
| Height | 48px minimum |
| Padding | 10px 4px (underline style has minimal horizontal padding) |
| Radius | 0 on top, 2px on bottom corners |
| Focus ring | underline thickens to 2px moss + `box-shadow: 0 1px 0 0 rgba(58,74,45,0.25)` below |
| Placeholder | `color: var(--color-text-muted); font-style: italic` |

Inputs feel like a paper form — no box, underline only, vellum background. No drop shadows.

### 8.4 Data Strip

Two- or three-column grid with hairline sage dividers:

- Value: Fraunces 500, 36px, `var(--bone-ink)`
- Delta chip: oxide or moss background, vellum text, JetBrains Mono 11px
- Label: JetBrains Mono 11px, `var(--ash-ink)`, uppercase, tracking `0.16em`
- Column divider: `1px solid rgba(120,140,107,0.25)`
- Background: `var(--vellum)`, inset `16px 20px`
- Optional: faint contour overlay behind each value

### 8.5 Elevation Progress (signature)

Replaces traditional progress bars.

```
╭─ MUSCLE-UP · SUMMIT AT 100% ──────╮
│                    ▲ 67%          │
│               ≈≈≈≈≈≈≈≈             │ ← filled contour (moss)
│            ≈≈≈≈≈≈≈≈≈≈≈≈≈≈          │ ← filled contour
│         ≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈       │ ← filled contour
│      ╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌     │ ← unfilled contour (sage 30%)
│   ╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌   │ ← unfilled contour
╰───────────────────────────────────╯
```

- Structure: 6 stacked SVG arcs, each spans a portion of the progress range
- Filled contours: `stroke: var(--moss); stroke-width: 2; stroke-opacity: 0.85`
- Unfilled contours: `stroke: var(--sage); stroke-width: 1; stroke-opacity: 0.3; stroke-dasharray: 2 3`
- Summit marker: oxide triangle `▲` at current summit position
- Percentage: JetBrains Mono 11px, `var(--oxide)`, inline with marker
- Fill animation: contours light up bottom→top, 120ms each, eased-paper

### 8.6 Bottom Navigation

- Height: 60px + `env(safe-area-inset-bottom)`
- Background: `var(--vellum)` with `1px solid var(--color-border)` top rule
- Items: 4–5 max (Dashboard, Workout, Log, Nutrition, Settings)
- Active: `color: var(--moss)`, 2px oxide top-indicator line above icon (8px wide)
- Inactive: `color: var(--ash-ink)`
- Icon size: 22px, line weight 1.5 (feel hand-drawn, not filled)
- Label: JetBrains Mono 10px, tracking `0.14em`, uppercase, shown on all states
- Compass mini-glyph on Dashboard tab as active indicator

### 8.7 Stamp / Seal (PR marker)

The sole visual celebration of a PR — quiet, earned, not a parade.

```css
.pr-stamp {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  background: var(--oxide);
  color: var(--vellum);
  font-family: 'JetBrains Mono', monospace;
  font-size: 10px;
  font-weight: 500;
  letter-spacing: 0.22em;
  text-transform: uppercase;
  padding: 4px 8px;
  border-radius: 2px;
  transform: rotate(-3deg);
  opacity: 0.85;
  box-shadow: var(--shadow-ink-bleed);
  mix-blend-mode: multiply;
}
/* content: "SUMMIT · 90 KG" or "NEW RECORD" */
```

Stamps animate on appear with `ease-stamp` — a slight descent and overshoot. They fade from 0 to 0.85 opacity, never to full. No confetti. No badge. No XP. A quiet mark that says "this is logged."

### 8.8 Toast / Field Note

- Slide up from bottom, 16px from safe-area
- Background: `var(--moss-deep)` with `var(--vellum)` text
- Max width: 340px, centered
- 1px oxide left border (binding tab)
- Icon: small compass or map-pin SVG, 16px
- Auto-dismiss: 3s (info), 5s (warning), manual (destructive)
- `role="status"` + `aria-live="polite"`, `role="alert"` for errors
- Mono label above message: `FIELD NOTE` / `WARNING` / `ERROR LOGGED`

### 8.9 Modal / Overlay

- Backdrop: `rgba(40, 53, 31, 0.55)` with `backdrop-filter: blur(10px)`
- Content: `var(--vellum)` background, `1px solid var(--color-border)`, `border-radius: 10px`
- Top edge: 2px oxide binding line
- Enters with `scale(0.96→1) + opacity(0→1)`, 300ms, ease-paper
- Close button: top-right, `×` in moss, 44x44px hit area, ghost variant
- Focus trap, `Escape` to dismiss, restore focus to trigger
- Title uses Fraunces 500 24px; description Inter Tight 14px

---

## 9. Interaction & Accessibility

### 9.1 Touch Targets

- Minimum 44×44px for every interactive element
- Primary buttons: 48px min-height
- Bottom nav items: full 60px height is the touch zone
- Icon-only buttons: expand via padding to meet 44×44px
- Set-row checkmarks: full row (at least 56px tall) is the touch target
- Stamps are decorative — not interactive — so size is unconstrained

### 9.2 Focus States

- Visible focus ring: `outline: 2px solid var(--oxide); outline-offset: 3px`
- Never remove focus rings; only use `:focus:not(:focus-visible)` to suppress mouse-focus
- Focus order follows reading order — top-to-bottom, LTR or RTL
- Skip-link at top: "Skip to main content" / "דלג לתוכן הראשי"
- Focus returns to the trigger after modal/drawer close

### 9.3 Color Accessibility

- All body text meets WCAG AA (4.5:1); large text meets 3:1
- Oxide (`#A24A1E`) on kraft = 4.8:1 ✅ AA — safe for body text
- Sage on kraft = 3.2:1 — decorative and large-text only, never body
- The rust/sage combination used on stamps and compass rules satisfies AA because oxide carries semantic weight; sage is decorative
- Error/success/warning states always pair color with an icon and text — never color alone
- Charts include text labels on each series; contours use dash pattern as a second channel
- Color-blind safety: moss vs oxide is distinguishable in deuteranopia and protanopia (warm-vs-cool distinction); sage and moss are differentiable by luminance

### 9.4 Screen Readers

- Decorative contours have `aria-hidden="true"` on the SVG
- Compass glyphs: `aria-label="Section compass marker"` or `aria-hidden` if purely decorative
- Coordinate marginalia: `aria-label="Training location: 34.021 degrees north, 35.248 degrees east, elevation 247 meters"`
- Ink stamps on cards: stamp text is real text with `aria-label="Entry recorded Wednesday April 23 2026 at 6:12 AM"`
- PR stamp: `aria-label="Personal record logged: 90 kilograms"`
- Hero numbers: `aria-label` with spoken form ("ninety kilograms, six repetitions, RPE 9")
- Dynamic updates use `aria-live="polite"`; errors use `aria-live="assertive"`
- Elevation progress: `role="progressbar"` with `aria-valuenow`, `aria-valuemin`, `aria-valuemax`, `aria-label="Skill progress toward summit"`

### 9.5 Keyboard Navigation

- Full keyboard support across all interactive elements
- `Enter` / `Space` activate buttons and checkboxes
- `Escape` closes modals, drawers, dropdowns
- `Tab` / `Shift+Tab` cycle focusable elements
- Focus trap in modals with sentinel elements
- Arrow keys for set-list navigation (up/down through sets)
- No keyboard shortcuts that conflict with screen-reader commands

---

## 10. Voice & Copy

Observational. Naturalist. Earned. Second person for actions, third person for reports. The user is the surveyor; the workouts are entries; the PRs are summits.

**Good:**
- EN: `ENTRY 047 · Wed 23.04 · Pushed. Logged four sets at 90 kg. Elevation +4.1% vs last week.`
- HE: `רישום 047 · ד׳ 23.04 · דחיפה. ארבעה סטים ב-90 ק"ג. עלייה של +4.1% מהשבוע הקודם.`
- EN: `SURVEY COMPLETE · RETURN TO BASE`
- EN: `Summit logged. 90 kg, six repetitions.`

**Avoid:**
- `Awesome session! Way to crush it!`
- `Level up!` / `Achievement unlocked!`
- `You earned a badge!` / `Streak: 12 days!`
- Any exclamation-heavy enthusiasm

### 10.1 Micro-copy Table

| Context | English | Hebrew |
|---|---|---|
| Start workout | `Begin survey` | `התחל סקר` |
| Log a set | `Log entry` | `תעד רישום` |
| Mark a PR | `Mark summit` | `סמן פסגה` |
| Finish workout | `Close chapter` | `סגור פרק` |
| Exit / cancel | `Leave trail` | `עזוב שביל` |
| Skip a set | `Skip entry` | `דלג רישום` |
| Save changes | `Commit to log` | `שמור ביומן` |
| Empty state | `No entries yet. Begin the first survey to open the log.` | `אין רישומים עדיין. התחל סקר ראשון כדי לפתוח את היומן.` |
| Rest timer | `Pause · 01:30` | `הפסקה · 01:30` |
| PR logged | `Summit logged` | `פסגה תועדה` |
| Offline | `Working off-map. Entries will sync on return.` | `עובד מחוץ למפה. הרישומים יסתנכרנו בחזרה.` |
| Error | `Entry not saved. Retry.` | `הרישום לא נשמר. נסה שוב.` |
| Delete confirm | `Remove this entry from the log?` | `להסיר רישום זה מהיומן?` |
| Week label | `Week 17` | `שבוע 17` |
| Today | `Today · Wed 23.04` | `היום · ד׳ 23.04` |
| Next up | `Next on the trail` | `הבא בשביל` |

Caveat hand-annotation micro-copy is used **max 2 per screen** — never for critical info. Examples: a `"felt strong"` note beside a set, a `"rest longer"` pencil mark in the margin. Never for errors, never for primary actions.

---

## 11. Wireframes

### 11.1 Dashboard

```
╔═══════════════════════════════════╗
║  FIELD GUIDE · ENTRY LOG          ║ ← masthead, ash-ink label
║                                   ║
║  Wednesday                        ║ ← Fraunces 500
║  23 April 2026                    ║
║  34.021° N · 35.248° E · 247m    ║ ← marginalia coords
║                                   ║
║   ◎ ──────────────────── ◎        ║ ← compass rule
║                                   ║
║  § 01 · THIS WEEK                 ║ ← mono label
║                                   ║
║   ≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈              ║
║    ≈≈≈≈≈≈≈≈≈≈≈≈≈≈                 ║ ← contour overlay
║     ≈≈≈≈≈≈≈≈≈≈                    ║
║                                   ║
║        04                         ║ ← 72px Fraunces
║   ENTRIES · OF SIX                ║ ← mono label
║   ┌─────┐                         ║
║   │+4.1%│ vs last week            ║ ← oxide chip
║   └─────┘                         ║
║                                   ║
║  ┌──────────────┬──────────────┐  ║
║  │   46,200     │    4h 12m    │  ║
║  │ KG · VOLUME  │ TIME ON TRAIL│  ║ ← data strip
║  └──────────────┴──────────────┘  ║
║                                   ║
║   ◎ ──────────────────── ◎        ║
║                                   ║
║  § 02 · SKILL TREE / SUMMITS      ║
║                                   ║
║  MUSCLE-UP                        ║
║   ▲ 67%                           ║
║   ≈≈≈≈≈≈≈≈≈≈                      ║ ← filled contours
║   ≈≈≈≈≈≈≈                         ║
║   ≈≈≈≈                            ║
║   ╌╌╌╌╌╌╌╌╌╌╌╌                    ║ ← unfilled
║                                   ║
║  BENCH · 2× BODY WEIGHT           ║
║   ▲ 22%                           ║
║   ≈≈≈                             ║
║   ╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌                ║
║                                   ║
║  HANDSTAND · 30s HOLD             ║
║   ▲ 40%                           ║
║   ≈≈≈≈≈≈                          ║
║   ╌╌╌╌╌╌╌╌╌╌╌╌╌                   ║
║                                   ║
║  ┌─────────────────────────────┐  ║
║  │       Begin survey          │  ║ ← primary moss button
║  └─────────────────────────────┘  ║
║                                   ║
║  [Dashboard] [Log] [Food] [Me]    ║ ← bottom nav, 4 tabs
╚═══════════════════════════════════╝
```

### 11.2 Active Workout

```
╔═══════════════════════════════════╗
║  § ENTRY 047 · BENCH PRESS        ║ ← masthead
║  Set 03 of 05             ▣ WED / ║ ← ink stamp,
║                             23.04.│    top-right,
║                             06:12▣│    rotated -3°
║                                   ║
║   ≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈                ║
║    ≈≈≈≈≈≈≈≈≈≈≈                    ║ ← contour bed
║     ≈≈≈≈≈≈                        ║    for hero num
║                                   ║
║         90                        ║ ← 96px Fraunces
║   KG · × 6 REPS                   ║ ← mono, ash-ink
║   RPE 9                           ║
║                                   ║
║   ┌─ SUMMIT · 90 KG ─┐            ║ ← oxide stamp chip
║   └──────────────────┘            ║
║                                   ║
║   ◎ ──────────────────── ◎        ║
║                                   ║
║   SETS RECORDED                   ║ ← mono label
║   ─────────────────────────       ║
║                                   ║
║   01   80 × 8 · RPE 7       ✓    ║ ← moss check
║   02   85 × 8 · RPE 8       ✓    ║
║   ┌───────────────────────────┐   ║
║   │ 03   90 × 6 · RPE 9   ▸  │   ║ ← active, moss bg
║   └───────────────────────────┘   ║   vellum text
║   04   90 × 6 · —                ║ ← dashed future
║   05   90 × ? · —                ║
║                                   ║
║         felt strong ╱             ║ ← Caveat hand-note
║                                   ║    (max 2/screen)
║   ┌──────────────┬─────────────┐  ║
║   │  Log entry   │    Skip     │  ║
║   └──────────────┴─────────────┘  ║
║                                   ║
║   34.021° N · 35.248° E · 247m   ║ ← marginalia
╚═══════════════════════════════════╝
```

### 11.3 History / Entry Log

```
╔═══════════════════════════════════╗
║  FIELD LOG                        ║ ← masthead
║  All entries                      ║
║                                   ║
║   ◎ ──────────────────── ◎        ║
║                                   ║
║  § THIS WEEK                      ║
║                                   ║
║  ┌─────────────────────── ▣ WED ┐ ║ ← card w/ stamp
║  │▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬   19.04 │ ║ ← oxide binding
║  │                           ▣  │ ║
║  │ PUSH DAY · ENTRY 046          │ ║ ← Fraunces 22px
║  │                               │ ║
║  │  46,200 kg   ·   6 sets      │ ║
║  │  52 min      ·   4 exercises │ ║
║  │                               │ ║
║  │  ┌─ SUMMIT · 90 KG ─┐         │ ║
║  │  └──────────────────┘         │ ║
║  └───────────────────────────────┘ ║
║                                   ║
║  ┌─────────────────────── ▣ THU ┐ ║
║  │▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬   17.04 │ ║
║  │                           ▣  │ ║
║  │ PULL DAY · ENTRY 045          │ ║
║  │                               │ ║
║  │  38,400 kg   ·   5 sets      │ ║
║  │  45 min      ·   5 exercises │ ║
║  └───────────────────────────────┘ ║
║                                   ║
║   ◎ ──────────────────── ◎        ║
║                                   ║
║  § PREVIOUS WEEK                  ║
║                                   ║
║  ┌─────────────────────── ▣ MON ┐ ║
║  │▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬   14.04 │ ║
║  │                           ▣  │ ║
║  │ LEG DAY · ENTRY 044           │ ║
║  │  41,800 kg   ·   7 sets      │ ║
║  │  58 min      ·   5 exercises │ ║
║  └───────────────────────────────┘ ║
║                                   ║
║   34.021° N · 35.248° E · 247m   ║
╚═══════════════════════════════════╝
```

### 11.4 Settings

```
╔═══════════════════════════════════╗
║  SETTINGS                         ║ ← masthead
║  Expedition preferences           ║
║                                   ║
║   ◎ ──────────────────── ◎        ║
║                                   ║
║  § PROFILE                        ║
║                                   ║
║  SURVEYOR NAME                    ║ ← mono label
║  ──────────────────────           ║ ← underline input
║  ישראל ישראלי                     ║
║                                   ║
║  BODY WEIGHT                      ║
║  ──────────────────────           ║
║  82 kg                            ║
║                                   ║
║   ◎ ──────────────────── ◎        ║
║                                   ║
║  § TRAINING                       ║
║                                   ║
║  WEEKLY TARGET                    ║
║  ──────────────────────           ║
║  4 entries per week               ║
║                                   ║
║  DEFAULT REST                     ║
║  ──────────────────────           ║
║  90 seconds                       ║
║                                   ║
║  TRAINING COORDINATES             ║
║  ──────────────────────           ║
║  34.021° N · 35.248° E            ║
║       keep it poetic ╱            ║ ← Caveat hand-note
║                                   ║
║   ◎ ──────────────────── ◎        ║
║                                   ║
║  § APP                            ║
║                                   ║
║  LANGUAGE                         ║
║  ──────────────────────           ║
║  עברית                        ▸  ║
║                                   ║
║  HAPTICS                     [●]  ║ ← toggle
║  REDUCE MOTION               [ ]  ║
║                                   ║
║  ┌─────────────────────────────┐  ║
║  │      Commit to log          │  ║ ← primary
║  └─────────────────────────────┘  ║
║                                   ║
║   34.021° N · 35.248° E · 247m   ║
╚═══════════════════════════════════╝
```

---

## 12. Dark Mode Variant

A dark "night survey" mode is **optional for v1**. The signature of the Field Guide is the warm kraft palette — this is deliberate and defining. If a night variant is built, it should feel like reading a field notebook by headlamp — not a dark-mode UI.

| Light Token | Night Token | Value |
|---|---|---|
| `--kraft` | `--night-kraft` | `#1A1812` (warm charcoal, never pure black) |
| `--kraft-deep` | `--night-deep` | `#24211A` |
| `--vellum` | `--night-vellum` | `#2E2A21` |
| `--bone-ink` | `--night-ink` | `#E8DFC7` (the light kraft becomes ink) |
| `--ash-ink` | `--night-ash` | `#A59A87` |
| `--moss` | `--moss` | `#7E9468` (shift lighter for contrast) |
| `--oxide` | `--oxide-night` | `#C8632D` (slightly brighter for visibility) |
| `--sage` | `--sage-night` | `#6B7D5E` |

Contours remain sage-faint; stamps remain oxide. Grain texture increases to 6% opacity to reinforce paper. Not v1.

---

## 13. RTL (Hebrew) Considerations

- Root direction: `dir="rtl"` on the `<html>` element for Hebrew locale
- **Compass marks stay centered** — the compass rule is directionally neutral and should not flip; N/E/S/W tick labels remain in their geographic positions
- **Ink stamps move** from top-right to **top-left** in RTL (the stamp follows the reading-end corner)
- Card binding edge stays on top (unchanged — it's a horizontal top border)
- Marginalia coordinates: flip alignment to the opposite margin; remain LTR for numeric/degree notation
- Elevation progress: arcs stay visually ascending bottom→top (no flip); the summit marker `▲` stays centered
- Set list: set number on right, value center, checkmark on left (reversed)
- Chevrons and "next" arrows reverse (`▸` becomes `◂`)
- Inputs: underline label stays above; text-align flips to right
- Bottom nav: item order reverses (Me / Food / Log / Dashboard)
- Caveat hand-annotations: use a Hebrew handwriting fallback — `'Segoe Script'` or the user's OS handwriting font; never force Caveat on Hebrew
- All numeric data (weights, percentages, coordinates) remains LTR — wrap in `<span dir="ltr">` or `unicode-bidi: isolate`
- `text-align: right` default for Hebrew paragraphs; labels use start/end logical properties

---

## 14. Trade-offs vs Other Templates

**Gains:**
- Warmth and tactility no other fitness app carries — the kraft + contour combination is immediately ownable
- Narrative framing: every workout is an entry, every PR is a quiet summit — rewards persistence without gamification
- Naturalist voice lowers ego and invites return — the app feels like a tool, not a coach shouting at you
- Topographic contours do double duty as decoration *and* progress visualization
- Hand-drawn accents (used sparingly) add humanity that geometric systems cannot reach
- Light, warm palette is easy on morning and evening eyes — a training app people actually want to open at 6 AM
- Oxide-rust semantic accent is memorable and distinctive; feels "earned" rather than alerting

**Loses:**
- Less loud and "sports-brand" than the Annual — won't screen-grab as aggressively in a pitch deck
- Warm palette may read as "indie" or "niche" to users expecting clinical fitness UI — some will bounce
- Caveat hand-font is fragile — overuse kills the effect, and localization in non-Latin scripts is imperfect
- Contour overlays require careful SVG work per-screen; more design-debt than flat fills
- Grain textures and paper effects can look cheap if rendered at low DPI or over-compressed
- Sage + oxide combination is beautiful but close to color-blind edge cases — requires the icon+text pairing discipline to stay safe
- Not cool in the Gen-Z-neon-gradient sense — will feel slow or "old" to some users at first glance

## Best for
Someone who keeps a paper notebook, takes photos of mountains more than mirrors, trains consistently without needing applause, and wants an app that reflects the work back as a record — not a trophy case. Surveyors, alpinists, long-distance patient lifters, people who prefer "logged" to "leveled up."

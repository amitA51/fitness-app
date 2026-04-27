# VISION — Concrete Lab (alternative 05)

> Concept: training as concrete instrument. Preview: `design-preview-brutalist.html`.

## Soul
A training app built like a concrete bunker. A raw architectural instrument — exposed structure, exposed grid, monospace typography that reads like a thermal receipt printout. Every block is labeled like scaffolding. The app's body is the building; the numbers are engraved, not printed. Barbican Centre. Herzog & de Meuron. Vercel docs. Linear's denser cousin. Cold. Honest. Structural. No ornament.

## DNA — 5 words
**Raw · Structural · Monospaced · Exposed · Honest**

---

## 1. Color System

### 1.1 Primary Palette

| Token | Hex | Role | Contrast on `--concrete` |
|---|---|---|---|
| `--concrete` | `#E5E3DE` | off-concrete page background, warm cool gray (NOT white) | — |
| `--concrete-mid` | `#CFCCC4` | card backgrounds, pressed surfaces, inset panels | — |
| `--concrete-deep` | `#9A978E` | borders, 1px rule lines, dividers, scaffolding grid | 2.7:1 (large/decorative only) |
| `--ash` | `#5A5954` | secondary text, meta, captions, timestamps | 5.9:1 ✅ AA |
| `--slate` | `#2B2A27` | primary inverted surfaces — dark blocks, buttons, bottom nav | 12.4:1 ✅ AAA (as text on concrete) |
| `--graphite` | `#141412` | primary text ink (warm graphite, NOT pure black) | 15.8:1 ✅ AAA |
| `--hazard` | `#C8FF2E` | single hot accent — LIVE state, active set, PR marker, progress fill | 1.5:1 (decorative only; on `--slate` = 13.2:1 ✅ AAA) |

Secondary palette:

| Token | Hex | Role | Contrast |
|---|---|---|---|
| `--rust` | `#8A3B1F` | destructive confirmations only (rare) | 5.4:1 ✅ AA on concrete |
| `--steel` | `#7A8A8F` | muted informational states, sync meta | 3.4:1 (large text + icons only) |

Two strong poles — warm concrete vs warm graphite — with a single radioactive interruption (`--hazard`). The palette is intentionally quiet so that the hazard reads as a warning, not a celebration.

### 1.2 Semantic Tokens

| Token | Maps to | Use |
|---|---|---|
| `--color-primary` | `var(--slate)` | primary action surfaces, button fills |
| `--color-primary-hover` | `var(--graphite)` | hover/pressed slate |
| `--color-accent` | `var(--hazard)` | live state, active set, focus top-rule, PR marker |
| `--color-success` | `#3F7A2E` | commit confirmation (on concrete: 4.8:1 ✅ AA) |
| `--color-warning` | `#9E6A12` | caution banner (on concrete: 4.6:1 ✅ AA) |
| `--color-error` | `var(--rust)` | destructive (on concrete: 5.4:1 ✅ AA) |
| `--color-text` | `var(--graphite)` | primary text |
| `--color-text-secondary` | `var(--ash)` | secondary text, labels |
| `--color-text-muted` | `var(--concrete-deep)` | placeholders, future sets, disabled |
| `--color-background` | `var(--concrete)` | page background |
| `--color-surface` | `var(--concrete-mid)` | cards, elevated surfaces |
| `--color-surface-inverted` | `var(--slate)` | dark blocks, mastheads |
| `--color-border` | `var(--concrete-deep)` | default 1px rule lines |
| `--color-border-strong` | `var(--graphite)` | emphasized borders, data strip edges |

### 1.3 Hazard Contrast Rules

`--hazard` (`#C8FF2E`) is industrial-hazard yellow-green. It fails AA on concrete and on white — it is **decorative only**, not a text color on light surfaces.

- **Never** use hazard for body text on `--concrete` or `--concrete-mid`
- **OK** as text on `--slate` or `--graphite` (13.2:1 / 15.0:1 ✅ AAA) — used sparingly on inverted surfaces
- **OK** as a 4px vertical bar on the left edge of active/live elements
- **OK** as a 4px top rule on focused inputs
- **OK** as a progress fill on `--concrete-deep` track
- **OK** as a 6px square PR marker next to a set row
- **Never** fill a large area with hazard — it is warning tape, not a surface
- **Never** combine hazard with any other accent color — it is the only one

---

## 2. Typography

### 2.1 Font Stack

| Role | Family | Fallback | Source |
|---|---|---|---|
| Display / body / labels (dominant) | `JetBrains Mono` | ui-monospace, Menlo, Consolas, monospace | Google Fonts, weights 400/500/600/700/800 |
| Hero display numbers only | `Space Grotesk` | Inter, system-ui, sans-serif | Google Fonts, weight 700 |
| Hebrew display | `Miriam Libre` | `Heebo`, system-ui, sans-serif | Google Fonts, weights 400/700 |
| Hebrew body | `IBM Plex Sans Hebrew` | `Assistant`, system-ui, sans-serif | Google Fonts, weights 400/500/600/700 |

```css
@import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600;700;800&family=Space+Grotesk:wght@700&family=Miriam+Libre:wght@400;700&family=IBM+Plex+Sans+Hebrew:wght@400;500;600;700&display=swap');
```

Mono is the dominant voice. Nearly every text element is monospace. The only escape from mono is the hero display numbers (48px and up), which use Space Grotesk 700 to create a structural contrast — the way a cast-concrete number plate contrasts with a stenciled label.

### 2.2 Type Scale

| Token | Size | Weight | Font | Line-height | Letter-spacing | Use |
|---|---|---|---|---|---|---|
| `--text-display-hero` | 120–220px | 700 | Space Grotesk | 0.86 | -0.03em | hero engraved numbers, active set weight |
| `--text-display-xl` | 88px | 700 | Space Grotesk | 0.9 | -0.02em | block numbers, session counter |
| `--text-display-lg` | 48px | 700 | Space Grotesk | 0.95 | -0.01em | data strip primary values |
| `--text-display` | 36px | 800 | JetBrains Mono | 1.0 | 0 | card titles, heavy mono display |
| `--text-display-sm` | 24px | 700 | JetBrains Mono | 1.1 | 0 | set numbers inline, totals |
| `--text-title` | 18px | 700 | JetBrains Mono | 1.25 | 0 | exercise names, screen titles |
| `--text-headline` | 16px | 600 | JetBrains Mono | 1.3 | 0 | card headlines, field labels |
| `--text-body` | 14px | 500 | JetBrains Mono | 1.55 | 0 | default body, set rows |
| `--text-body-sm` | 13px | 500 | JetBrains Mono | 1.5 | 0.01em | small body, meta, row data |
| `--text-label` | 11px | 600 | JetBrains Mono | 1.3 | 0.08em | uppercase labels, field captions |
| `--text-scaffold` | 10px | 600 | JetBrains Mono | 1.2 | 0.12em | scaffolding callouts `[BLOCK/02]`, timestamps |
| `--text-button` | 13px | 700 | JetBrains Mono | 1.0 | 0.12em | button copy, uppercase |

All labels are uppercase. All scaffolding callouts are uppercase. Body is mixed-case mono. Buttons are uppercase mono at 0.12em tracking — system-action verbs, not invitations.

### 2.3 Hebrew Typography

Hebrew has no true monospace. The closest structural match is `Miriam Libre` (display) + `IBM Plex Sans Hebrew` (body). Hebrew numbers remain in `Space Grotesk`/`JetBrains Mono` (LTR numeric runs inside RTL blocks).

- `letter-spacing: 0` on Hebrew body (tracking adjustments break Hebrew letterforms)
- Labels: `IBM Plex Sans Hebrew` 600, uppercase suppressed (Hebrew has no case) — instead use weight 700 for emphasis
- `line-height` increased by 0.1 over the Latin scale for better readability
- Bold weight (`700`) substitutes for italic emphasis (Hebrew has no true italic)
- Scaffolding callouts in Hebrew use `Miriam Libre` 700 at 10px with square-bracket framing preserved: `[אימון/17]`

### 2.4 Number Formatting

- All data numbers use `JetBrains Mono` or `Space Grotesk` with `font-variant-numeric: tabular-nums lining-nums`
- Thousands separator: comma (`46,200`)
- Decimal separator: period (`+4.1%`)
- Full values only — no abbreviation in display contexts (no `46.2k`)
- Zero-padded where it communicates structure: set indices `01/05`, session index `[SESSION/17]`, timestamp `04.23 · 18:42`
- Hebrew contexts keep numbers LTR (`direction: ltr` on numeric runs inside RTL)
- Engraved numbers apply `text-shadow: inset 0 1px 0 rgba(20,20,18,0.08)` (simulated via layered shadows on a wrapper span, since `inset` is invalid on text-shadow — see section 4.3)

---

## 3. Spacing & Layout

### 3.1 Spacing Scale (4/8pt Grid)

| Token | Value | Use |
|---|---|---|
| `--space-0` | 0 | — |
| `--space-1` | 4px | inline icon gaps, hazard-bar width |
| `--space-2` | 8px | tight element gaps, baseline grid unit |
| `--space-3` | 12px | compact padding, row internal gaps |
| `--space-4` | 16px | standard padding, related-item gap |
| `--space-5` | 20px | page horizontal padding, card padding |
| `--space-6` | 24px | section internal gaps |
| `--space-8` | 32px | block separation, major gaps |
| `--space-10` | 40px | large section gaps |
| `--space-12` | 48px | chapter-level separation |
| `--space-16` | 64px | page-level separation |
| `--space-20` | 80px | hero-level separation |

Everything snaps to the 8px baseline grid. The grid is not hidden — it is visible at 3% opacity behind every screen (see section 7.1).

### 3.2 Content Width & Padding

| Property | Mobile (<768px) | Tablet (768–1024px) | Desktop (>1024px) |
|---|---|---|---|
| Content max-width | 100% | 560px | 480px (phone-like) |
| Horizontal padding | 20px | 32px | auto-centered |
| Card padding | 20px | 20px | 20px |
| Vertical block gap | 32px | 32px | 32px |

Desktop is a phone in a concrete frame. No sprawling layouts.

### 3.3 Responsive Breakpoints

| Name | Width | Description |
|---|---|---|
| `sm` | 375px | Small phone baseline |
| `md` | 768px | Tablet |
| `lg` | 1024px | Desktop / wide tablet |
| `xl` | 1440px | Wide desktop |

Mobile-first. Everything else is a constrained re-pour of the mobile mold.

---

## 4. Borders, Radius, Shadows

### 4.1 Border Radius

| Token | Value | Use |
|---|---|---|
| `--radius-none` | 0 | **default for everything** — buttons, cards, inputs, modals, chips |
| `--radius-hair` | 1px | effectively none; reserved for future use |
| `--radius-full` | 9999px | never used in v1 |

**Note:** The Concrete Lab design uses **zero border-radius** across the entire system. Architecture has edges, not curves. Every element is a poured-slab rectangle. There are no pills, no rounded cards, no rounded buttons. This is non-negotiable.

### 4.2 Borders

The border language is half-borders — cards get top + left only, never four-sided — to feel like poured-slab panels butting against each other rather than floating objects.

| Style | Spec | Use |
|---|---|---|
| Rule | `1px solid var(--concrete-deep)` | dividers, list separators, section rules |
| Rule-strong | `1px solid var(--graphite)` | data strip edges, emphasized separators |
| Half-frame | `border-top: 1px solid var(--concrete-deep); border-left: 1px solid var(--concrete-deep)` | cards, panels, data blocks |
| Hazard-bar left | `border-left: 4px solid var(--hazard)` | active/live elements only |
| Hazard-rule top | `border-top: 4px solid var(--hazard)` | focused inputs only |
| Input default | `border-bottom: 1px solid var(--concrete-deep)` | inputs in resting state |

### 4.3 Shadows

Minimal. The Concrete Lab uses rule lines and half-frames for structure, not elevation. Shadows exist only to suggest engraving.

| Token | Value | Use |
|---|---|---|
| `--shadow-engraved` | `inset 0 1px 0 rgba(20,20,18,0.08), inset 0 -1px 0 rgba(255,255,255,0.12)` | applied to hero number wrappers — simulates embossing into concrete |
| `--shadow-modal` | `0 8px 32px rgba(20,20,18,0.18)` | modal panels only |
| `--shadow-sticky` | `0 1px 0 rgba(20,20,18,0.08)` | sticky header bottom edge only |

No drop shadows on cards. No hover lifts. No glowing focus halos. Focus is indicated with a 4px hazard top-rule and a 2px hazard outline, nothing else.

---

## 5. Motion & Animation

### 5.1 Duration Scale

| Token | Value | Use |
|---|---|---|
| `--duration-instant` | 75ms | color change, opacity flicker |
| `--duration-fast` | 120ms | button press feedback, toggle |
| `--duration-base` | 180ms | panel slide, tab switch, standard transitions |
| `--duration-slow` | 280ms | page transition, modal enter |
| `--duration-block` | 400ms | scaffolding grid fade-in, number count-up |

### 5.2 Easing

| Token | Value | Use |
|---|---|---|
| `--ease-linear` | `linear` | progress fills, count-up — mechanical, no ornament |
| `--ease-out` | `cubic-bezier(0.2, 0, 0, 1)` | elements entering view |
| `--ease-in` | `cubic-bezier(0.4, 0, 1, 1)` | elements leaving view |
| `--ease-step` | `steps(8, end)` | hazard-bar pulse — stepped, not smooth |

No spring easing. No bounce. Nothing overshoots. The Concrete Lab is mechanical.

### 5.3 Animation Patterns

| Pattern | Animation | Duration | Easing |
|---|---|---|---|
| Page enter | opacity 0→1 | 180ms | ease-out |
| Scaffolding grid fade-in | opacity 0→0.03 | 400ms | ease-out (once per page load) |
| Hero number count-up | `Int` count 0→N | 400ms | linear |
| Hazard-bar appear | scale-y 0→1 from top | 120ms | ease-out |
| Hazard-bar pulse (live state) | opacity 1→0.5→1 | 1200ms | step(8, end), infinite |
| Progress fill | width 0→N% | 400ms | linear |
| Button press | background `--slate`→`--graphite` | 75ms | linear |
| Row commit (set logged) | background flash `--hazard` at 18% alpha → transparent | 280ms | ease-out |
| Modal enter | opacity 0→1 + translateY(4px→0) | 280ms | ease-out |
| Modal exit | opacity 1→0 | 150ms | ease-in |
| Toast enter | slide-up from bottom + opacity | 200ms | ease-out |

Row commit is the closest thing to celebration the system allows — a single hazard flash that decays in 280ms. No confetti. No sound.

### 5.4 Reduced Motion

All animations respect `prefers-reduced-motion: reduce`:

- **Scaffolding grid fade-in:** disabled — grid renders at final 3% opacity instantly
- **Hazard-bar pulse:** disabled — hazard bar is static at full opacity
- **Hero number count-up:** disabled — final value renders instantly
- **Progress fills:** disabled — fill width set to final value instantly
- **Row commit flash:** disabled — no flash, row simply updates to committed state
- **Modal/toast slides:** replaced with 150ms opacity fade only
- Keep functional button press feedback at ≤75ms (needed for tactile confirmation)

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
  .scaffold-grid { opacity: 0.03 !important; animation: none !important; }
  .hazard-bar { animation: none !important; opacity: 1 !important; }
}
```

---

## 6. Z-Index Scale

| Token | Value | Use |
|---|---|---|
| `--z-grid` | -1 | scaffolding grid (behind content) |
| `--z-base` | 0 | default content |
| `--z-sticky` | 20 | sticky header, sticky bottom action bar |
| `--z-nav` | 40 | bottom navigation |
| `--z-dropdown` | 60 | dropdowns, select menus |
| `--z-overlay` | 80 | modal backdrop |
| `--z-modal` | 90 | modal content |
| `--z-toast` | 100 | toast notifications |
| `--z-tooltip` | 110 | tooltips |

---

## 7. Five Signature Elements

1. **Exposed grid scaffolding.** Every screen has two grid overlays rendered at `--z-grid`:
   - 4-column vertical grid (20px gutter) at 3% opacity, `var(--concrete-deep)` lines
   - 8px horizontal baseline grid at 2% opacity
   The UI lives **on** the grid, not hidden by it. The grid is a construction reference — every element's top and left edge snaps visibly to a line. Toggleable in developer mode; always visible at 3% in the shipped product.

2. **Scaffolding labels.** Every significant block is prefixed with a corner callout in mono uppercase at 10px, `--concrete-deep`, 0.12em tracking, positioned **outside** the block in the top-left margin: `[BLOCK/02]`, `[FIG/04.A]`, `[SECTION/SKILLS]`, `[REC/2026.04.23]`. They read like engineering drawings or construction signage. Every screen has between 3 and 8 of these.

3. **Engraved numbers.** Hero display numbers (48px+) sit on a `--concrete-mid` slab with a layered shadow that simulates being pressed into concrete:
   ```css
   .engraved-number {
     color: var(--graphite);
     background: var(--concrete-mid);
     box-shadow: inset 0 1px 0 rgba(20,20,18,0.08),
                 inset 0 -1px 0 rgba(255,255,255,0.14);
     padding: var(--space-4) var(--space-5);
   }
   ```
   The effect is subtle — the number looks embedded, not floating. Only the hero number itself (not its label) uses the engraved treatment.

4. **Hazard accent bars.** `--hazard` appears only as:
   - A 4px-wide vertical bar on the left edge of the currently active row/card
   - A 4px-high horizontal rule on the top of a focused input
   - A 6×6px square PR marker next to a set row
   - A fill on progress bars (4px–8px height)
   Never fills large areas. Never colors large text on light surfaces. Treated as industrial warning tape — its scarcity is the point.

5. **Raw rule lines.** Horizontal `1px solid var(--concrete-deep)` dividers everywhere — between list rows, between sections, above sticky footers. No radii. No shadows. No gradients. Architecture has edges, not curves. A screen is a stack of rectangles separated by rules.

---

## 8. Component Specifications

### 8.1 Buttons

| Variant | Background | Text | Border | Radius | Padding | Min-height |
|---|---|---|---|---|---|---|
| Primary | `var(--slate)` | `var(--concrete)` | none | 0 | 16px 20px | 52px |
| Primary live | `var(--slate)` | `var(--concrete)` | `border-left: 4px solid var(--hazard)` | 0 | 16px 20px (left pad 16px+4px) | 52px |
| Secondary | `var(--concrete)` | `var(--graphite)` | `1px solid var(--graphite)` | 0 | 15px 19px (subtract border) | 52px |
| Ghost | transparent | `var(--graphite)` | none | 0 | 12px 16px | 44px |
| Destructive | `var(--rust)` | `var(--concrete)` | none | 0 | 16px 20px | 52px |
| Small | `var(--slate)` | `var(--concrete)` | none | 0 | 10px 14px | 36px |

All buttons: `JetBrains Mono` 700, uppercase, `letter-spacing: 0.12em`, zero border-radius, no gradient, no shadow. Copy is always a system-action verb: `LOG`, `EXEC`, `COMMIT`, `ABORT`, `NEXT`, `START`, `END`.

**States:**
- Hover: `background: var(--graphite)` (primary), 75ms linear
- Active/pressed: `transform: translateY(1px)` at 75ms linear (slight mechanical press, no scale)
- Disabled: `opacity: 0.4`, `cursor: not-allowed`, no hover feedback
- Focus: `outline: 2px solid var(--hazard); outline-offset: 0` (inset-feeling)

### 8.2 Cards

Cards are flat `--concrete-mid` slabs with a half-frame (top + left only) to feel like poured panels butting against each other. No shadows. No radius.

| Type | Background | Border | Padding | Radius |
|---|---|---|---|---|
| Default panel | `var(--concrete-mid)` | `1px solid var(--concrete-deep)` on top+left only | 20px | 0 |
| Active panel | `var(--concrete-mid)` | `1px solid var(--concrete-deep)` top+left, `4px solid var(--hazard)` left (overrides) | 20px | 0 |
| Inverted block | `var(--slate)` | none | 20px | 0 |
| Data strip | `var(--concrete)` | `1px solid var(--graphite)` on top+bottom only | 16px 20px | 0 |

Every card carries a scaffolding label in its top-left margin: `[BLOCK/01]`, `[BLOCK/02]`, etc.

### 8.3 Inputs

Inputs are bottom-ruled fields. There is no box around them; the label and value stack above a rule line. The rule becomes a hazard-bar on focus.

| Property | Value |
|---|---|
| Background | transparent (inherits `--concrete`) |
| Border | `border-bottom: 1px solid var(--concrete-deep)` default |
| Focused border | `border-top: 4px solid var(--hazard); border-bottom: 1px solid var(--graphite); padding-top: adjusted to compensate` |
| Text | `JetBrains Mono` 500, 15px, `var(--graphite)` |
| Label | `JetBrains Mono` 600, 10px, uppercase, `--ash`, above field |
| Height | 48px minimum (touch target) |
| Padding | 10px 0 8px 0 (no horizontal padding — flush to grid) |
| Radius | 0 |
| Placeholder | `var(--concrete-deep)`, same typography as value |

### 8.4 Data Strip

Two or three-column horizontal strip, no internal radii. Values use engraved-number treatment.

- Strip background: `var(--concrete)`
- Top rule: `1px solid var(--graphite)`
- Bottom rule: `1px solid var(--graphite)`
- Vertical dividers between columns: `1px solid var(--concrete-deep)`
- Value: `Space Grotesk` 700, 48px, `var(--graphite)`, engraved
- Label: `JetBrains Mono` 600, 10px, `--ash`, uppercase, 0.12em tracking, above value
- Accent values (PR, delta positive): `--graphite` with a 6px hazard square to the right of the value
- Meta below value: `JetBrains Mono` 500, 11px, `--ash`

### 8.5 Progress Bars

Progress bars are 8px tall rectangles. The track is `--concrete-deep`, the fill is `--hazard`. No radii. No gradient.

- Label row: flex between exercise/skill name (`JetBrains Mono` 700, 14px, `--graphite`) and percentage (`Space Grotesk` 700, 14px, `--graphite`)
- Track: 8px height, `var(--concrete-deep)` background
- Fill: `var(--hazard)`, left-aligned, width animates 0→N% at 400ms linear, stagger 60ms between adjacent bars
- A 6×6px hazard square sits at the right edge of the completed fill (marks the current head position)
- Below the bar: `[FIG/04.A]`-style scaffold caption with last-session delta: `[DELTA] +2% · 7 DAYS`

### 8.6 Bottom Navigation

- Height: 64px + safe-area-bottom
- Background: `var(--slate)`
- Top border: `1px solid var(--graphite)`
- Active tab: `JetBrains Mono` 600, 10px, `var(--hazard)`, uppercase, 0.12em tracking, with a 4px `--hazard` top bar spanning the tab width
- Inactive tab: same type, `rgba(229,227,222,0.5)` (concrete at 50%), no top bar
- Icon size: 20px, same color as label
- Max 4 items: `DASH`, `LOG`, `HIST`, `SET`
- Tap target: full 64px height × tab-width, no visual hover on touch

### 8.7 Scaffolding Label (signature component)

The small `[BLOCK/02]`-style callout that tags every block in the app.

```css
.scaffold {
  font-family: 'JetBrains Mono', ui-monospace, monospace;
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--concrete-deep);
  display: inline-block;
  padding: 0;
  margin: 0;
  /* positioned in the top-left margin of a block via CSS grid,
     OR absolute-positioned at top: -18px; left: 0 on a relative parent */
}
```

Format vocabulary:
- `[BLOCK/NN]` — numbered block reference on dashboard
- `[SECTION/NAME]` — section label (SKILLS, VOLUME, HISTORY)
- `[FIG/NN.X]` — figure reference for progress bars and charts
- `[REC/YYYY.MM.DD]` — record/log entry reference
- `[SESSION/NNN]` — global session index
- `[SET/NN/NN]` — set index within exercise
- `[LIVE]` — live state marker (always paired with hazard bar)

### 8.8 Toast

- Slide-up from bottom, `--duration-slow`, ease-out
- Background: `var(--slate)`, text: `var(--concrete)`
- Left border: `4px solid var(--hazard)` (for success/live) or `4px solid var(--rust)` (for error)
- Max width: 360px, centered horizontally, 16px above bottom nav
- Padding: 14px 18px
- Typography: `JetBrains Mono` 500, 13px
- Prefixed with scaffolding tag: `[REC/COMMIT]` / `[REC/ERROR]`
- Auto-dismiss: 3s (success), 5s (error), manual (destructive actions)
- `role="alert"` + `aria-live="polite"` / `assertive` for errors

### 8.9 Modal

- Backdrop: `rgba(20, 20, 18, 0.68)` with `backdrop-filter: blur(4px)`
- Panel: `var(--concrete-mid)` background, `1px solid var(--graphite)` on top+left only (half-frame), zero border-radius
- Panel shadow: `0 8px 32px rgba(20,20,18,0.18)`
- Enters with opacity 0→1 + translateY(4px→0) at 280ms ease-out
- Must include a visible close control at top-right: `[X]` in mono, `--graphite`, 44×44px hit target
- Every modal has a scaffolding title: `[DIALOG/CONFIRM-ABORT]`
- Must trap focus, restore focus on close

---

## 9. Interaction & Accessibility

### 9.1 Touch Targets

- Minimum 44×44px for all interactive elements
- Primary buttons: 52px min-height
- Ghost buttons: 44px min-height
- Icon-only controls: padding expanded to meet 44×44px
- Bottom nav items: full 64px height × tab width
- Set rows in active workout: 56px min-height for easy tap

### 9.2 Focus States

- Visible focus ring: `outline: 2px solid var(--hazard); outline-offset: 0`
- For inputs, focus replaces the default bottom rule with a 4px `--hazard` top rule
- Never remove focus rings — only scope them with `:focus-visible`
- Focus order follows visual/reading order (top-to-bottom, left-to-right in LTR; right-to-left in RTL)
- Skip-link at top: `[NAV/SKIP] SKIP TO MAIN` / `[ניווט/דלג] דלג לתוכן הראשי`

### 9.3 Color Accessibility

- All body text meets WCAG AA (4.5:1)
- Large text (18px+ regular, 14px+ bold) meets 3:1
- `--hazard` is decorative/accent only on light surfaces — never a body text color on `--concrete` or `--concrete-mid`
- On `--slate` or `--graphite` surfaces, `--hazard` is 13.2:1 / 15.0:1 and is safe for text
- Error/success/warning states include icon + scaffolding label + text — never color alone
- Charts and progress bars pair hazard fill with a percent label and scaffolding tag — color is never the sole channel

### 9.4 Screen Readers

- Scaffolding labels are marked `aria-hidden="true"` by default — they are visual scaffolding, not content. Their information is duplicated in the accessible name of the block they label.
- Hero numbers include `aria-label` with spoken form: `<span aria-hidden="true">90</span><span class="sr-only">ninety kilograms</span>`
- `[LIVE]` state is announced via `aria-live="polite"` on the active set row
- Progress bars use `role="progressbar"` with `aria-valuenow`, `aria-valuemin`, `aria-valuemax`, `aria-label`
- Bottom nav is `<nav aria-label="primary">`
- Dynamic toasts use `aria-live="polite"` (success) or `aria-live="assertive"` (error)
- Exposed grid is `aria-hidden="true"` on its container

### 9.5 Keyboard Navigation

- Full keyboard support for all interactive elements
- `Enter` / `Space` activates buttons
- `Escape` closes modals, dismisses toasts, cancels edits
- `Tab` / `Shift+Tab` cycles through focusable elements
- Arrow keys navigate set rows within an exercise block
- Focus trap in modals, restored on close
- All keyboard shortcuts documented in Settings `[SECTION/KEYBOARD]`

---

## 10. Voice & Copy

System log tone. Terse. No adjectives. No encouragement. No celebration. The app reports; it does not cheerlead. Hebrew holds the same register — terse, structural.

- EN: `[SESSION/17] · 04.23 · PUSH · COMPLETE`
- HE: `[אימון/17] · 23.04 · דחיפה · הסתיים`
- EN: `SET 03/05 · 90KG × 6 · RPE 9`
- HE: `סט 03/05 · 90 ק"ג × 6 · RPE 9`
- EN: `COMMIT SET`
- HE: `תעד סט`
- NO: `Great work!` / `Awesome!` / `Keep it up!` / `You crushed it!`
- NO: `כל הכבוד!` / `עבודה מצוינת!`

Button copy uses system-action verbs only: `LOG`, `EXEC`, `COMMIT`, `ABORT`, `NEXT`, `END`, `START`, `SAVE`. Never `Go!`, `Let's train!`, `Submit`.

### Micro-copy Rules

| Context | English | Hebrew |
|---|---|---|
| Start workout | `START SESSION` | `התחל אימון` |
| Commit a logged set | `COMMIT SET` | `תעד סט` |
| Skip a set | `SKIP` | `דלג` |
| Abort session | `ABORT SESSION` | `בטל אימון` |
| End session | `END SESSION` | `סיים אימון` |
| Session complete banner | `[SESSION/17] · COMPLETE · 52 MIN` | `[אימון/17] · הסתיים · 52 דק׳` |
| Weekly tag | `[WEEK/16]` | `[שבוע/16]` |
| PR marker | `[PR]` | `[שיא]` |
| Live/active set | `[LIVE]` | `[פעיל]` |
| Empty state | `NO DATA. LOG FIRST SESSION TO BEGIN RECORD.` | `אין נתונים. תעד אימון ראשון לפתיחת הרישום.` |
| Error toast | `[REC/ERROR] COMMIT FAILED · RETRY` | `[רישום/שגיאה] התיעוד נכשל · נסה שוב` |
| Success toast | `[REC/COMMIT] SET LOGGED` | `[רישום/תיעוד] סט נשמר` |
| Sync meta | `LAST SYNC · 04.23 · 18:42` | `סנכרון אחרון · 23.04 · 18:42` |
| Rest timer | `REST · 00:90` | `מנוחה · 00:90` |
| RPE prompt | `RPE?` | `?RPE` |
| Settings save | `SAVE` | `שמור` |

---

## 11. Wireframes

Scaffolding labels are shown in the left margin. `░` = concrete background grid, `▓` = `--concrete-mid` card surface, `█` = `--slate` inverted block, `│` = vertical scaffolding rule, `═` = strong rule (`--graphite`), `─` = soft rule (`--concrete-deep`), `▮` = hazard-bar (4px).

### 11.1 Dashboard

```
[BLOCK/00]  ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░
            ░┌─────────────────────────────────┐░
            ░│ █ [SESSION/17] · 04.23 · THU  █ │░  ← slate masthead
            ░│ █                              █ │░
            ░│ █  PUSH                        █ │░  ← title, mono 18
            ░│ █  [LIVE]                      █ │░  ← hazard, 10px
            ░└─────────────────────────────────┘░
            ░                                   ░
[BLOCK/01]  ░┌── [FIG/01.A] WEEK VOLUME ──────┐░
            ░│                                │░
            ░│          46,200                │░  ← engraved, 88px, Space Grotesk
            ░│     ─────────                  │░
            ░│     KG · WEEK 16               │░  ← label, 10px mono
            ░│     +4.1% VS PRIOR             │░  ← ash meta
            ░└────────────────────────────────┘░
            ░                                   ░
[BLOCK/02]  ░┌── [FIG/02] SESSIONS ───────────┐░
            ░│                                │░
            ░│  04  │  06  │  67%             │░  ← data strip, 3 col
            ░│  ────┼──────┼─────             │░
            ░│  DONE│ GOAL │ RATIO            │░
            ░└────────────────────────────────┘░
            ░                                   ░
[SECTION/   ░─────────────────────────────────── ░
 SKILLS]    ░                                   ░
            ░ [FIG/03.A]  MUSCLE-UP       67%   ░
            ░ ██████████████████▮░░░░░░░░░░░░   ░  ← hazard fill + marker
            ░ [DELTA] +3% · 14 DAYS             ░
            ░ ─────────────────────────────── ─ ░
            ░ [FIG/03.B]  BENCH 2×BW      22%   ░
            ░ █████▮░░░░░░░░░░░░░░░░░░░░░░░░   ░
            ░ [DELTA] +1% · 14 DAYS             ░
            ░ ─────────────────────────────── ─ ░
            ░ [FIG/03.C]  HANDSTAND 30s   40%   ░
            ░ ██████████▮░░░░░░░░░░░░░░░░░░░    ░
            ░ [DELTA] +0% · 14 DAYS             ░
            ░                                   ░
            ░┌─────────────────────────────────┐░
            ░│  START SESSION    │    LOG      │░  ← slate / ghost
            ░└─────────────────────────────────┘░
            ░                                   ░
            ░─┬──────┬──────┬──────┬──────────  ░  ← bottom nav, slate
            ░ │ DASH │ LOG  │ HIST │ SET       ░
            ░ │ ▮    │      │      │           ░  ← hazard top bar on active
```

### 11.2 Active Workout

```
[BLOCK/00]  ░┌─────────────────────────────────┐░
            ░│ █ [SESSION/17] · BENCH · [LIVE] █│░  ← slate + hazard tag
            ░│ █ SET 03/05                   ▮ █│░  ← hazard bar right edge
            ░└─────────────────────────────────┘░
            ░                                   ░
[BLOCK/01]  ░┌── [FIG/01] CURRENT LOAD ───────┐░
            ░│                                │░
            ░│                                │░
            ░│              90                │░  ← engraved, 220px
            ░│        ───────────             │░
            ░│          KG · × 6              │░  ← mono 14, ash
            ░│          RPE 9  [PR]▮          │░  ← hazard square
            ░│                                │░
            ░└────────────────────────────────┘░
            ░                                   ░
[BLOCK/02]  ░─── [SECTION/SET-LOG] ─────────── ░
            ░                                   ░
            ░  01  80 × 8  · RPE 7  · COMMIT   ░  ← committed, ash
            ░  ────────────────────────────── ─ ░
            ░  02  85 × 8  · RPE 8  · COMMIT   ░
            ░  ────────────────────────────── ─ ░
            ░▮ 03  90 × 6  · RPE 9  · [LIVE]   ░  ← active row, hazard bar
            ░  ────────────────────────────── ─ ░
            ░  04  90 × ?  · —   · PENDING     ░  ← future, concrete-deep
            ░  ────────────────────────────── ─ ░
            ░  05  90 × ?  · —   · PENDING     ░
            ░                                   ░
[BLOCK/03]  ░┌─────────────────────────────────┐░
            ░│  COMMIT SET     │    SKIP       │░  ← slate + hazard-bar / ghost
            ░│▮                │               │░
            ░└─────────────────────────────────┘░
            ░                                   ░
            ░ REST · 00:90                      ░  ← timer, mono 24
            ░                                   ░
            ░─┬──────┬──────┬──────┬──────────  ░
            ░ │ DASH │ LOG  │ HIST │ SET       ░
            ░ │      │ ▮    │      │           ░  ← LOG active
```

### 11.3 History

```
[BLOCK/00]  ░┌─────────────────────────────────┐░
            ░│ █ HISTORY                      █│░  ← slate masthead
            ░│ █ [SECTION/LOG]                █│░
            ░└─────────────────────────────────┘░
            ░                                   ░
[SECTION/   ░─── [WEEK/16] CURRENT ──────────── ░
 W16]       ░                                   ░
            ░ [REC/2026.04.23] PUSH             ░
[BLOCK/01]  ░┌────────────────────────────────┐░
            ░│  THU · 04.23 · 18:42           │░  ← meta
            ░│                                │░
            ░│  46,200 KG  │  06 SETS  │ 52M  │░  ← data strip
            ░│  ───────────┼───────────┼────  │░
            ░│  VOLUME     │  SETS     │ DUR  │░
            ░└────────────────────────────────┘░
            ░                                   ░
            ░ [REC/2026.04.21] PULL             ░
[BLOCK/02]  ░┌────────────────────────────────┐░
            ░│  TUE · 04.21 · 17:10           │░
            ░│  38,400 KG  │  05 SETS  │ 45M  │░
            ░└────────────────────────────────┘░
            ░                                   ░
[SECTION/   ░─── [WEEK/15] PRIOR ────────────── ░
 W15]       ░                                   ░
            ░ [REC/2026.04.14] LEGS             ░
[BLOCK/03]  ░┌────────────────────────────────┐░
            ░│  MON · 04.14 · 18:00           │░
            ░│  41,800 KG  │  07 SETS  │ 58M  │░
            ░└────────────────────────────────┘░
            ░                                   ░
            ░ [REC/2026.04.12] PUSH             ░
[BLOCK/04]  ░┌────────────────────────────────┐░
            ░│  SAT · 04.12 · 10:20           │░
            ░│  44,100 KG  │  06 SETS  │ 49M  │░
            ░│▮ [PR] BENCH 92.5 × 5           │░  ← hazard bar (PR present)
            ░└────────────────────────────────┘░
            ░                                   ░
            ░─┬──────┬──────┬──────┬──────────  ░
            ░ │ DASH │ LOG  │ HIST │ SET       ░
            ░ │      │      │ ▮    │           ░  ← HIST active
```

### 11.4 Settings

```
[BLOCK/00]  ░┌─────────────────────────────────┐░
            ░│ █ SETTINGS                     █│░
            ░│ █ [SECTION/CONFIG]             █│░
            ░└─────────────────────────────────┘░
            ░                                   ░
[SECTION/   ░─── [BLOCK/01] PROFILE ──────────  ░
 PROFILE]   ░                                   ░
            ░  NAME                             ░  ← label, 10px mono
            ░  ישראל ישראלי                     ░  ← value, 15px
            ░  ▮─────────────────────────────   ░  ← hazard top-rule (focused)
            ░                                   ░
            ░  BODY WEIGHT · KG                 ░
            ░  82                               ░
            ░  ─────────────────────────────    ░  ← default rule
            ░                                   ░
[SECTION/   ░─── [BLOCK/02] TRAINING ────────── ░
 TRAINING]  ░                                   ░
            ░  WEEKLY GOAL · SESSIONS           ░
            ░  04                               ░
            ░  ─────────────────────────────    ░
            ░                                   ░
            ░  DEFAULT REST · SEC               ░
            ░  90                               ░
            ░  ─────────────────────────────    ░
            ░                                   ░
            ░  UNIT                             ░
            ░  KG                      [ KG ▸ ] ░
            ░  ─────────────────────────────    ░
            ░                                   ░
[SECTION/   ░─── [BLOCK/03] APP ─────────────── ░
 APP]       ░                                   ░
            ░  LANGUAGE                         ░
            ░  HEBREW                  [ HE ▸ ] ░
            ░  ─────────────────────────────    ░
            ░                                   ░
            ░  HAPTICS               [  OFF  ]  ░  ← square toggle
            ░  ─────────────────────────────    ░
            ░                                   ░
            ░  REDUCE MOTION         [   ON  ]  ░
            ░  ─────────────────────────────    ░
            ░                                   ░
            ░┌─────────────────────────────────┐░
            ░│           SAVE                  │░  ← primary
            ░└─────────────────────────────────┘░
            ░                                   ░
            ░─┬──────┬──────┬──────┬──────────  ░
            ░ │ DASH │ LOG  │ HIST │ SET       ░
            ░ │      │      │      │ ▮         ░  ← SET active
```

---

## 12. Dark Mode Variant

The brutalist palette is already a **neutralized-dark** — warm concrete against warm graphite, with a single hazard accent. True dark mode is optional for v1; the light Concrete Lab is the signature.

If implemented, dark mode inverts the concrete-stack — the app becomes a night pour — while `--hazard` and the secondary palette stay exactly the same.

| Light Token | Dark Token | Dark Value |
|---|---|---|
| `--concrete` | `--concrete-dk` | `#1F1E1B` |
| `--concrete-mid` | `--concrete-mid-dk` | `#2B2A27` |
| `--concrete-deep` | `--concrete-deep-dk` | `#45433E` |
| `--ash` | `--ash-dk` | `#8E8C85` |
| `--slate` | `--slate-dk` | `#E5E3DE` (inverted) |
| `--graphite` | `--graphite-dk` | `#F1EFEA` (inverted) |
| `--hazard` | `--hazard` | `#C8FF2E` (unchanged) |
| `--rust` | `--rust` | `#C26A48` (slightly lifted) |
| `--steel` | `--steel` | `#9AAAAF` (slightly lifted) |

Rule lines remain `1px solid var(--concrete-deep-dk)`. Cards become `--concrete-mid-dk` with a half-frame in `--concrete-deep-dk`. Inverted blocks flip to `--slate-dk` (which now reads near-concrete). Hazard retains its role as the only bright signal. Exposed grid opacity raised from 3% to 4% on dark background.

Not shipped in v1.

---

## 13. RTL (Hebrew) Considerations

- Layout direction: `dir="rtl"` on root
- Scaffolding labels mirror position: `[BLOCK/02]` sits in the top-right margin (outside) instead of top-left
- Scaffolding bracket content itself remains LTR (English vocab) OR uses Hebrew equivalents with LTR numerics: `[אימון/17]`, `[שבוע/16]`, `[סט/03/05]`
- Hazard-bar moves from left edge to right edge of active rows/cards (it is always on the "leading" edge in the reading direction)
- Input label stacks above field — no change, only text alignment flips to `right`
- Data strip columns reverse order (read right-to-left)
- Bottom nav items reverse order
- Set row layout: set number on right, value in center, commit state on left
- Chevron arrows flip: `▸` becomes `◂`
- `text-align: right` default on Hebrew blocks, `text-align: left` on blocks that are pure numeric/Latin (like `[REC/2026.04.23]`)
- Numbers and timestamps remain LTR via `direction: ltr; unicode-bidi: isolate` on numeric runs
- Exposed grid is direction-agnostic (symmetrical vertical lines) — no mirroring needed
- Modal close `[X]` moves from top-right to top-left in RTL

---

## 14. Trade-offs vs other templates

**Gains:** a single radical voice — the app feels engineered, not designed. Information density is extreme without feeling cluttered because the scaffolding earns every pixel. Mono-dominant typography is rare in fitness apps; it communicates seriousness and respect for data. The hazard accent is scarce enough to actually signal — the active set genuinely reads as "live." The half-frame card language is unusual and memorable. Accessibility is strong by default (high contrast, honest focus rings, quiet motion). Reduced motion is a first-class citizen, not an afterthought.

**Loses:** cold. Genuinely cold. Users who want warmth, color, or encouragement will bounce. The visual register is closer to an industrial control panel than a fitness app, which is the point but also the risk. Mono typography at body sizes is less readable than a well-tuned humanist sans for long-form content — fine here because there is little long-form content. Hebrew loses some of the monospaced identity (no true Hebrew monospace exists), so RTL screens feel slightly less consistent than LTR. The absence of color segmentation means every screen looks similar at first glance — users must learn the scaffolding vocabulary to parse the app quickly. Zero-radius everything amplifies any mis-aligned pixel — the grid must be perfect or the whole system collapses.

## Best for
Someone who wants their training app to feel like a lab instrument, a thermal printer log, or an architect's site drawing. Someone who reads their sets, not celebrates them. Someone who wants the numbers engraved, the grid exposed, and the encouragement removed. Someone who would rather see `[SESSION/17] · COMPLETE` than a trophy.

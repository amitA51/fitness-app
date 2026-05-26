# SparkOS Fitness — Fresh Steel Design System

## Vision

Fresh Steel is a **precision gym OS** — every screen feels like instrumentation on a high-end training machine. Calibration lines, weight-plate motifs, data-rail accents, and sharp asymmetric panels. The aesthetic is unique among fitness apps: not the generic dark-card look of Strong/Hevy, not the clean minimal of Apple Health. It is **equipment as interface**.

## Design Principles

1. **Instrument, not decoration** — every visual element communicates data or supports action. Ambient mesh gradients encode state; accent rails mark active context; plate-ring badges show set progress.
2. **One clear action per moment** — the CTA hierarchy is strict. During a workout, the set input and slide-to-complete own the screen. Everything else recedes.
3. **Dark mode is a first-class citizen** — the app should look premium and deliberate in both modes. Surfaces differentiate by luminance steps, not by dropped contrast.
4. **RTL-native** — Hebrew is the primary language. All layouts use logical properties. Numbers stay LTR. Mixed content is tested.
5. **60fps always** — only animate `transform` and `opacity`. Use `will-change` sparingly. Respect `prefers-reduced-motion`.

---

## Architecture — 5 Layers

```
Layer 5: React Components (TSX)
    Tailwind classes + CSS utility classes + inline styles
Layer 4: Component Classes (components.css, global.css, motion.css, typography.css)
    .masthead, .glass-surface, .card-interactive, .btn-primary, .slide-complete
Layer 3: Tailwind Config (tailwind.config.js)
    Maps CSS variables to utilities: bg-fs-accent, text-fs-ink, font-display
Layer 2: CSS Custom Properties (tokens.css)
    ~140 variables — single source of truth for both light and dark modes
Layer 1: Google Fonts
    Bricolage Grotesque (display), IBM Plex Sans (body), IBM Plex Mono (data), Assistant (Hebrew)
```

---

## Color Palette

### Core Tokens

| Token | Light | Dark | Role |
|-------|-------|------|------|
| `--fs-bg` | `#EEF3F1` | `#0C1311` | Canvas background |
| `--fs-surface` | `#FFFFFF` | `#141D1B` | Card / panel surface |
| `--fs-surface-2` | `#DBE6E3` | `#1E2B29` | Secondary surface, dividers |
| `--fs-ink` | `#132327` | `#F1F8F5` | Primary text |
| `--fs-muted` | `#60706F` | `#8A9E9A` | Secondary text, labels |
| `--fs-primary` | `#16292D` | `#1E3330` | Masthead backgrounds, navy panels |
| `--fs-accent` | `#43C7A5` | `#43C7A5` | Anchor color, CTAs, active states |
| `--fs-accent-2` | `#2C7F91` | `#2C7F91` | Gradient endpoint, secondary accent |
| `--fs-signal` | `#E2FB70` | `#E2FB70` | PR celebrations, positive deltas |
| `--fs-warn` | `#E26E3F` | `#E26E3F` | Errors, timer critical state |
| `--fs-steel` | `#B9C8C6` | `#3D524E` | Borders, plate rings, separators |
| `--fs-plate` | `#D7E0DE` | `#1E2B29` | Muted background areas |
| `--fs-rubber` | `#0D1516` | `#07100F` | Deep darks, cockpit fill |

### Key Dark Mode Rules

- **`--fs-primary` MUST lighten in dark mode** (`#16292D` -> `#1E3330`) so mastheads and chapter-breaks don't disappear into the background
- **`--fs-bg` goes deeper** (`#0C1311`) to create enough contrast between bg -> surface -> surface-2
- **`--fs-muted` brightens** to maintain WCAG AA (4.5:1+) on dark surfaces
- **Accent colors stay constant** — `--fs-accent` `#43C7A5` never changes. It's the anchor.
- **Body gradient adapts** — white overlay in light, transparent overlay in dark. Grid lines use `var(--fs-ink)` opacity.

### Contrast Requirements (WCAG AA)

| Pair | Light | Dark | Target |
|------|-------|------|--------|
| ink on bg | 15.8:1 | 16.2:1 | 4.5:1 |
| ink on surface | 19.1:1 | 14.8:1 | 4.5:1 |
| muted on surface | 4.8:1 | 4.6:1 | 4.5:1 |
| accent on primary | 4.2:1 | 4.5:1 | 3:1 (large) |

---

## Typography

| Variable | Font | Weights | Use |
|----------|------|---------|-----|
| `--font-display` | Bricolage Grotesque | 600-800 | Page titles, hero numbers, set values, section headers |
| `--font-body` | IBM Plex Sans | 400-800 | Body text, descriptions, form labels |
| `--font-mono` | IBM Plex Mono | 500-700 | Data labels, kickers, timer, unit suffixes, badge text |
| `--font-hebrew` | Assistant | 400-800 | Hebrew text, RTL support |

### Type Scale

| Name | Size | Weight | Tracking | Use |
|------|------|--------|----------|-----|
| Display Hero | 120px | 800 | -0.03em | PR celebration number |
| Display XL | 88px | 800 | -0.02em | Block hero stat |
| Display LG | 48px | 800 | -0.02em | Summary headline, workout title |
| Display | 36px | 800 | -0.02em | Page masthead title |
| Display SM | 24px | 800 | -0.01em | Card headlines, CTA text |
| Title | 20px | 800 | 0 | Section headings |
| Headline | 18px | 700 | 0 | Exercise names |
| Body LG | 17px | 400-600 | 0 | Primary body copy |
| Body | 15px | 400-600 | 0 | Standard text |
| Body SM | 13px | 600 | 0 | Card descriptions |
| Label | 11px | 700 | 0.08-0.14em | Mono labels, kickers |
| Caption | 10px | 700 | 0.12-0.22em | Kicker slugs, timestamps |

### Workout Numbers Rule

Weight and reps are the **hero** during an active workout:
- Font: `var(--font-display)`, weight 800
- Size: 42-48px (SetInputCard), 56-96px (NumpadOverlay)
- Color: `var(--fs-ink)` (full contrast)
- Direction: always `ltr` (numbers don't reverse in RTL)
- Feature: `font-variant-numeric: tabular-nums` (prevents layout jitter)

---

## Spacing

8pt grid system:
```
--space-1: 4px    --space-6: 24px
--space-2: 8px    --space-8: 32px
--space-3: 12px   --space-10: 40px
--space-4: 16px   --space-12: 48px
--space-5: 20px   --space-16: 64px
```

Content padding: 20px. Max width: 480px. Nav height: 64px.

---

## Signature Shape — Asymmetric Radius

The distinctive Fresh Steel shape:
```css
border-radius: 22px 16px 22px 16px;  /* TL TR BR BL */
```
Used on: cards, panels, exercise hero, CTA buttons, input cards, template cards.

Variation for smaller elements:
```css
border-radius: 14px 10px 14px 10px;
```

Pill shapes (chips, badges, slide-to-complete, bottom nav items):
```css
border-radius: 999px;
```

---

## Surface System

### Cards

| Class | Use | Treatment |
|-------|-----|-----------|
| `.glass-surface` | Standard card | `color-mix` translucent bg + backdrop blur + `--shadow-glass` |
| `.glass-surface-dark` | Dark card (exercise hero) | Primary-tinted glass + deep shadow |
| `.premium-dark-surface` | Masthead / hero cards | Gradient mesh (accent + accent-2 radials) + grid overlay |
| `.card-interactive` | Tappable cards | Hover lift + active scale(0.98) |
| `.magnetic-card` | Hover-aware cards | translateY(-2px) + `--shadow-lift` on hover |

### Glass Effects

All glass classes use `color-mix()` with CSS variables so they automatically adapt to dark mode:
```css
.glass-surface {
  background: color-mix(in srgb, var(--fs-surface) 76%, transparent);
  backdrop-filter: blur(18px) saturate(140%);
}
```

### Accent Rail

A 4px `var(--fs-accent)` stripe on the inline-start edge of data panels:
```css
.fs-accent-rail::before {
  content: '';
  position: absolute;
  inset: 9px auto 9px 0;
  width: 4px;
  background: var(--fs-accent);
  border-radius: 999px;
}
```

---

## Ambient Mesh

Premium gradient overlay behind content, creating subtle depth:
```css
.ambient-mesh::before {
  background:
    radial-gradient(at 18% 12%, accent 28%, transparent 42%),
    radial-gradient(at 82% 18%, accent-2 24%, transparent 46%),
    radial-gradient(at 60% 92%, signal 18%, transparent 38%);
}
```
Three intensity levels: `.ambient-mesh-soft` (0.55), default (0.85), `.ambient-mesh-strong` (1.0).

---

## Body Background

Adapted for both modes via CSS variables:
- **Light**: white overlay + dark grid lines + accent/signal radials
- **Dark**: no white overlay + very faint grid lines + accent radials at lower opacity

```css
body {
  background:
    linear-gradient(135deg, var(--fs-body-overlay), transparent 44%),
    repeating-linear-gradient(90deg, var(--fs-grid-line) 0 1px, transparent 1px 28px),
    repeating-linear-gradient(0deg, var(--fs-grid-line) 0 1px, transparent 1px 28px),
    radial-gradient(circle at 86% 10%, var(--fs-mesh-accent), transparent 34%),
    radial-gradient(circle at 12% 18%, var(--fs-mesh-signal), transparent 30%),
    var(--fs-bg);
}
```

---

## Motion

### Easings
| Name | Curve | Use |
|------|-------|-----|
| Premium | `cubic-bezier(0.16, 1, 0.3, 1)` | Page transitions, card reveals |
| Spring Bounce | `cubic-bezier(0.34, 1.56, 0.64, 1)` | Button press, set completion |
| Spring Soft | `cubic-bezier(0.32, 0.72, 0, 1)` | Subtle movements |

### Durations
| Name | Duration | Use |
|------|----------|-----|
| Instant | 75ms | Button press feedback |
| Fast | 150ms | Hover states, toggles |
| Base | 200ms | Standard transitions |
| Slow | 300ms | Panel open/close |
| Chapter | 500ms | Page-level transitions |
| Premium | 480ms | Hero card reveals |

### Key Animations
- **Set completion**: quick scale-up (1 -> 1.04 -> 1) + accent flash overlay (0.4 -> 0 opacity)
- **PR celebration**: confetti burst + scale pop + signal glow
- **Rest timer**: circular progress ring + breathing dot in final 5s + pulse at zero
- **Card hover**: translateY(-2px) + shadow-lift
- **Skeleton loading**: shimmer sweep left-to-right

### Reduced Motion

All animations respect `prefers-reduced-motion: reduce`:
```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}
```

---

## Component Patterns

### Masthead
Full-width premium-dark-surface header with accent mesh:
- Kicker: mono, 10px, 0.22em tracking, accent color, uppercase
- Title: display font, 900 weight, cream/bg color, 0.9 line-height, uppercase

### Chapter Break
Horizontal divider strip between sections:
- Left: mono kicker with section number (e.g., "§02 · WORKOUT")
- Right: display font Hebrew section name

### SetInputCard
Asymmetric-radius card for weight/reps input:
- Ghost value badge (top-start): "קודם 95" in accent tint
- Hero number: display font 46px, ink color, LTR direction
- Unit label: mono 9px, accent color, uppercase
- +/- buttons: grid 2-col, minus=surface-2, plus=accent

### SlideToComplete
Pill-shaped track with draggable accent thumb:
- Track: primary bg + repeating grid pattern
- Thumb: 48px circle, accent bg, direction arrow
- Label: mono uppercase, accent color, fades on drag

### InlineRestTimer
Compact bar between exercise and slide-to-complete:
- Progress ring: 52px SVG with accent stroke
- Time: display font 28px, switches to warn color at 3s
- Add buttons: +15s, +30s, +60s row
- Skip: accent pill button

---

## Dark Mode Implementation

Dark mode is toggled via `html.dark` class (managed by SettingsContext). All theming flows through CSS custom properties in `tokens.css`.

### What Changes
- Background surfaces darken (3-step: bg -> surface -> surface-2)
- Text colors lighten (ink, muted, stone)
- Shadows deepen (more opacity, wider spread)
- Glass effects use darker mix values
- Body gradient adapts (no white overlay)
- `--fs-primary` lightens slightly so mastheads separate from bg

### What Stays
- Accent colors (`--fs-accent`, `--fs-accent-2`) are constant
- Signal and warn colors are constant
- Typography scale is constant
- Border-radius values are constant
- Animation timings are constant

---

## File Map

| File | Purpose |
|------|---------|
| `src/styles/tokens.css` | All CSS custom properties — colors, spacing, fonts, shadows, motion, z-index. Light + dark mode. |
| `src/styles/global.css` | Base reset, body background, scrollbar, accessibility, editorial patterns |
| `src/styles/components.css` | Card, button, badge, glass, skeleton, toggle, progress, nav classes |
| `src/styles/motion.css` | All @keyframes + animation utility classes |
| `src/styles/typography.css` | Type scale, heading styles, color utilities |
| `tailwind.config.js` | Maps CSS vars to Tailwind utilities |
| `src/contexts/SettingsContext.tsx` | Toggles `html.dark` class based on user preference |

---

*Updated: 2026-05-26*

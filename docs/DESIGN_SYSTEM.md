# SparkOS Fitness — Design System Architecture

## Overview

The app uses a custom **editorial design system** called "Sport Annual" with a navy/mustard/bone palette, zero-radius blocks, uppercase display typography, and a magazine-like layout. It is **not** a standard UI framework (Material, iOS, etc.) — it is entirely bespoke.

---

## How It Works — The 5 Layers

```
Layer 5: React Components (TSX)
    Uses Tailwind classes + CSS classes + inline styles
Layer 4: CSS Component Classes (global.css, components.css, motion.css, typography.css)
    Reusable patterns like .masthead, .block-hero, .card, .btn-primary
Layer 3: Tailwind Config (tailwind.config.js)
    Maps CSS variables to Tailwind utilities (bg-navy, text-mustard, font-display)
Layer 2: CSS Custom Properties (tokens.css)
    ~120+ variables — single source of truth for all colors, spacing, fonts, etc.
Layer 1: Browser + Google Fonts
    Big Shoulders Display (headlines), IBM Plex Sans (body), IBM Plex Mono (labels)
```

**Data flow example:**
```
tokens.css:   --navy: #14293d
    → tailwind.config.js:  colors: { navy: 'var(--navy)' }
        → Tailwind generates: .bg-navy { background: var(--navy) }
            → Component: <div className="bg-navy" />
            → Or: .btn-primary { background: var(--navy) } in global.css
```

---

## Design Tokens (tokens.css)

The file defines ~120 CSS custom properties organized into groups:

### Colors (Core Identity)

| Token | Light Mode | Dark Mode | Purpose |
|---|---|---|---|
| `--bone` | `#F5F1EB` | `#0B1A2B` | Page background (warm off-white) |
| `--bone-deep` | `#EAE4DA` | `#14293D` | Card surfaces, dividers |
| `--bone-faint` | `#F9F7F3` | `#1E3A54` | Hover states |
| `--navy` | `#14293D` | `#F5F1EB` | Primary action color |
| `--navy-deep` | `#0B1A2B` | `#FFFFFF` | Hover/pressed navy |
| `--navy-light` | `#1E3A54` | `#EAE4DA` | Lighter variant |
| `--mustard` | `#E8B82D` | `#E8B82D` | Accent — **anchor color, never flips** |
| `--mustard-dark` | `#C49A1A` | `#F2C951` | Pressed mustard |
| `--ink` | `#1A1A1A` | `#F5F1EB` | Primary text |
| `--stone` | `#7E7D78` | `rgba(245,241,235,0.65)` | Secondary text |
| `--stone-light` | `#A5A49F` | `rgba(245,241,235,0.42)` | Muted text |

**Key insight:** Dark mode works by **inverting bone and navy**. They swap places. Mustard stays mustard in both modes.

### Semantic Colors

| Token | Value | Purpose |
|---|---|---|
| `--color-primary` | `var(--navy)` | Primary actions |
| `--color-secondary` | `var(--mustard)` | Accent actions |
| `--color-success` | `#2D8B4E` | Positive states |
| `--color-warning` | `#C48A1A` | Warning states |
| `--color-error` | `#C42B2B` | Error states |
| `--color-background` | `var(--bone)` | Page background |
| `--color-surface` | `#FFFFFF` | Card surface |
| `--color-text` | `var(--ink)` | Primary text |

### Typography

| Token | Value | Purpose |
|---|---|---|
| `--font-display` | `'Big Shoulders Display', ...` | Headlines (800/900 weight) |
| `--font-body` | `'IBM Plex Sans', ...` | Body text |
| `--font-mono` | `'IBM Plex Mono', ...` | Labels, data, kickers |
| `--font-hebrew` | `'Assistant', ...` | Hebrew text fallback |

### Layout

| Token | Value | Purpose |
|---|---|---|
| `--max-width` | `480px` | Content max width (mobile-first) |
| `--content-padding` | `20px` | Standard side padding |
| `--nav-height` | `64px` | Bottom navigation height |

### Per-Page Accent System

`tokens.css` defines `--accent-current` etc. as navy, but the **PageThemeContext overrides these at runtime** with page-specific colors:

| Page | Accent Color | Mood |
|---|---|---|
| Dashboard | `#3B82F6` (Blue) | Energetic |
| Workout | `#8B5CF6` (Purple) | Focused |
| Nutrition | `#22C55E` (Green) | Calm |
| History | `#06B6D4` (Cyan) | Calm |
| Progress | `#F59E0B` (Amber) | Energetic |
| Templates | `#A855F7` (Purple) | Focused |
| Settings | `#71717A` (Gray) | Calm |

When you navigate to a page, the context sets `--accent-current`, `--accent-current-hover`, `--accent-current-glow` on the `<html>` element. Components can use `var(--accent-current)` to pick up the page color automatically.

---

## Editorial Design Patterns (global.css)

The app uses magazine/newspaper-inspired UI patterns. All defined in `global.css @layer components`:

### 1. Masthead (`.masthead`)
Full-width navy header block with bone text. Contains:
- `.kicker` — mustard, mono uppercase, small text (e.g., "MONDAY · WEEK 16")
- `h1` — Big Shoulders Display 900, large (40-64px), bone color
```html
<header class="masthead">
  <div class="kicker">§01 · NUTRITION · 2024-01-15</div>
  <h1>תזונה</h1>
</header>
```

### 2. Chapter Break (`.chapter-break`)
Horizontal navy strip dividing sections. Contains:
- `.left` — mustard mono text (e.g., "§02 · RECOMMENDATIONS")
- `.right` — display font Hebrew text (e.g., "המלצות")

### 3. Block Hero (`.block-hero`)
Mustard-background hero stat block. Contains:
- `.ribbon` — absolute-positioned navy badge top-right
- `.label` — mono uppercase description
- `.number` — display font 900, huge (120px), the main stat
- `.sub` — display font 600, secondary info

### 4. Data Strip (`.data-strip`)
Two-column grid with 2px navy border. Each cell has:
- `.val` — display font 44px (e.g., "12,450")
- `.lbl` — mono uppercase (e.g., "KG VOLUME")

### 5. Skill Row (`.skill-row`)
Progress bar with label and percentage:
- `.skill-name` — exercise/section name
- `.skill-pct` — percentage text
- `.skill-bar` / `.skill-fill` — mustard progress bar

### 6. Workout Patterns (`.aw-*`, `.set-row-annual`)
Active workout specific patterns with states:
- `.done` — completed sets, muted
- `.active` — current set, mustard highlight
- `.future` — upcoming sets, gray

---

## Role of Each CSS File

| File | Purpose | Key Content |
|---|---|---|
| `tokens.css` | **Single source of truth** — all CSS custom properties | ~120 vars: colors, spacing, fonts, radius, shadows, motion, z-index |
| `global.css` | Base reset + editorial component classes | `.masthead`, `.block-hero`, `.chapter-break`, `.data-strip`, `.skill-row`, `.btn-primary`, `.card`, `.aw-*` patterns |
| `components.css` | **Parallel component system** (SparkOS design) | `.card` (rounded), `.btn-*` variants, `.badge-*`, `.glass`, `.skeleton`, `.toggle-switch` |
| `motion.css` | All animations and transitions | 17 keyframe animations, stagger delays, hover effects, reduced motion |
| `typography.css` | Text scale and heading styles | Display/body/label scales, color utilities, heading classes, RTL support |

---

## How Hard Is It to Change Things?

### Change the Primary Color (navy → something else)
**Difficulty: MEDIUM**

1. Change 3 navy tokens in `tokens.css` `:root` AND `html.dark` (6 edits)
2. Change `--color-primary`, `--color-primary-hover`, `--color-primary-glow` (3 edits)
3. Update `index.html` `<meta name="theme-color">` (1 edit)
4. Update `tailwind.config.js` if not using CSS var references
5. **Find and replace ~15 hardcoded `#14293d` instances** in TSX files that bypass the design system
6. **Find and replace `var(--navy)` in ~30 CSS class definitions** in global.css and components.css

### Change the Accent Color (mustard → something else)
**Difficulty: MEDIUM**

1. Change 3 mustard tokens in `tokens.css` (3 edits)
2. Change `--color-on-mustard` to ensure text contrast (1 edit)
3. Update `global.css` — mustard referenced in `.kicker`, `.chapter-break .left`, `.block-hero` background, `.skill-fill`, `.tab-item.active`, `.set-row-annual.active`
4. Update `tailwind.config.js` mustard definitions
5. Update `PRCelebration.tsx` confetti colors
6. **Find and replace ~20 hardcoded `#E8B82D` or mustard instances** in TSX files

### Change the Background (bone → something else)
**Difficulty: EASY — best abstracted**

1. Change `--bone`, `--bone-deep`, `--bone-faint` in `tokens.css` `:root`
2. Done — almost everything uses `var(--bone)` or `bg-bone`

### Change Fonts
**Difficulty: EASY**

1. Update Google Fonts `<link>` in `index.html`
2. Update `--font-display`, `--font-body`, `--font-mono`, `--font-hebrew` in `tokens.css`
3. Update `fontFamily` in `tailwind.config.js`
4. Done — fonts are well-abstracted through CSS variables

### Switch to a Completely Different Design Language (Material, iOS)
**Difficulty: HARD — essentially a rewrite**

You would need to:
1. Rewrite all 5 CSS files from scratch
2. Rewrite `tailwind.config.js` entirely
3. Rewrite every component using editorial classes (`.masthead`, `.chapter-break`, `.block-hero`, `.data-strip`, all `.aw-*` patterns)
4. Replace the zero-radius editorial style with rounded corners everywhere
5. Replace Big Shoulders Display with appropriate fonts
6. Remove all `border-radius: 0` overrides (editorial uses zero radius deliberately)
7. Rethink the entire layout system (max-width 480px mobile-first)

**Estimated effort: 2-4 weeks for an experienced developer.**

### Add Proper Dark Mode
**Difficulty: MEDIUM — partially done**

Dark mode tokens already exist in `tokens.css` `html.dark {}` block (~90 lines). What's missing:
1. **~40 hardcoded hex colors in TSX files** that don't use CSS vars
2. **~20 hardcoded `rgba(255,255,255,...)` in components.css** (glass effects assume dark background)
3. **No dark overrides in components.css, motion.css, typography.css** — only tokens.css has them
4. **PageThemeContext hardcodes `isDark: true`**
5. **global.css scrollbar uses hardcoded rgba** that doesn't flip

---

## Architectural Issues

### 1. Two Conflicting Component Systems

`global.css` (editorial "Sport Annual") and `components.css` (SparkOS) define **the same class names with different styles**:

| Class | global.css (Editorial) | components.css (SparkOS) |
|---|---|---|
| `.card` | `border-radius: 0`, `background: var(--bone-deep)` | `border-radius: var(--radius-2xl)`, `background: var(--color-surface)` |
| `.btn-primary` | `border-radius: 0`, `font-family: var(--font-display)`, uppercase | `border-radius: var(--radius-lg)`, `font-family: var(--font-sans)` |
| `.input` | `border-radius: 0` | `border-radius: var(--radius-md)` |
| `.badge` | `border-radius: 0`, mono font | `border-radius: var(--radius-full)` |
| `.glass` | Light-mode rgba | Dark-mode rgba |

Since `components.css` is NOT in `@layer`, it has **higher specificity** and overrides `global.css` for shared classes.

### 2. Hardcoded Colors Bypassing the System

~40+ instances of hardcoded hex colors in TSX files:
- `'#ef4444'`, `'#22c55e'`, `'#3b82f6'`, `'#f97316'` in analytics, workout, and settings components
- `'#fff'`, `rgba(255,255,255,0.4)` for text on dark surfaces
- Muscle group colors in charts are all hardcoded

These should use `var(--color-error)`, `var(--color-success)`, etc.

### 3. Excessive Inline Styles

Dashboard and workout components heavily use `style={{...}}` instead of CSS classes or Tailwind utilities. This bypasses the design system, makes dark mode harder, and reduces consistency.

### 4. Dead Legacy Code

- **`--cosmos-*` tokens** (~12 vars): Remnants of a previous theme, now aliased to current vars
- **`selectedTheme: 'deepCosmos'`** in SettingsContext: Theme picker was removed but the setting remains
- **Page accent tokens in tokens.css** (`--accent-dashboard: var(--navy)`): All set to navy but PageThemeContext overrides them at runtime — the tokens.css values are dead
- **Legacy alias tokens** (~20 vars): `--bg-primary`, `--gray-*`, `--surface-base` etc. add noise

### 5. Vision vs Reality Gap

`VISION.md` describes a different design ("Athletic Index") with different fonts (Fraunces, Geist), different colors (Tangerine `#FF5B1F`), and different patterns (passport stamps, perforated edges). This is **entirely unimplemented** — the current codebase is the earlier "Sport Annual" design.

---

## File Reference

| What | Where |
|---|---|
| Color/spacing/font tokens | `src/styles/tokens.css` |
| Editorial component classes | `src/styles/global.css` |
| SparkOS component classes | `src/styles/components.css` |
| Animation/transition classes | `src/styles/motion.css` |
| Typography scale classes | `src/styles/typography.css` |
| Tailwind custom extensions | `tailwind.config.js` |
| Per-page accent colors | `src/contexts/PageThemeContext.tsx` |
| Dark mode toggle logic | `src/contexts/SettingsContext.tsx` |
| Font loading | `index.html` (Google Fonts preload) |
| Design vision docs | `VISION.md`, `VISION-brutalist.md`, `VISION-field.md` |

---

*Generated: 2024-04-23*

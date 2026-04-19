# VISION — Sport Annual (alternative 04)

> Concept: training as yearbook. Preview: `design-preview-annual.html`.

## Soul
A training app designed as a **sports annual report** — the kind Pentagram would design for Nike or the Olympic committee. Bold condensed typography. Editorial chapter breaks. Color-block sections. Oversized numbers as pull-quotes. Every week of training is a chapter, every PR is a headline. Built like it will be printed and bound.

## DNA — 5 words
**Bold · Editorial · Confident · Narrative · Printed**

---

## 1. Color System

### 1.1 Primary Palette

| Token | Hex | Role | Contrast on white |
|---|---|---|---|
| `--bone` | `#F5F1EB` | off-white warm paper background | — |
| `--bone-deep` | `#EAE4DA` | section backgrounds, card fills, deep bone | — |
| `--bone-faint` | `#F9F7F3` | subtle surface tint, alternating rows | — |
| `--stone` | `#7E7D78` | secondary text, captions | 4.6:1 ✅ AA |
| `--stone-light` | `#A5A49F` | disabled text, future sets | 2.9:1 (large text only) |
| `--navy` | `#14293D` | **primary color** — mastheads, buttons, big blocks | 13.8:1 ✅ AAA |
| `--navy-deep` | `#0B1A2B` | hover/pressed navy, darkest accent | 17.1:1 ✅ AAA |
| `--navy-light` | `#1E3A54` | navy surfaces, secondary navy blocks | 10.5:1 ✅ AAA |
| `--mustard` | `#E8B82D` | **secondary color** — ribbons, highlights, PR markers, progress fills | 2.3:1 (decorative + large text) |
| `--ink` | `#1A1A1A` | primary body text | 16.2:1 ✅ AAA |

Two strong colors that fight each other (navy vs mustard) — the contrast is the personality.

### 1.2 Semantic Tokens

| Token | Maps to | Use |
|---|---|---|
| `--color-primary` | `var(--navy)` | primary actions, links, focus rings |
| `--color-primary-hover` | `var(--navy-deep)` | hover state |
| `--color-secondary` | `var(--mustard)` | accent highlights, badges, progress |
| `--color-success` | `#2D8B4E` | positive feedback (on bone: 4.8:1 ✅) |
| `--color-warning` | `#C48A1A` | caution (on bone: 4.5:1 ✅) |
| `--color-error` | `#C42B2B` | destructive actions (on bone: 5.1:1 ✅) |
| `--color-text` | `var(--ink)` | primary text |
| `--color-text-secondary` | `var(--stone)` | secondary text, labels |
| `--color-text-muted` | `var(--stone-light)` | hint text, placeholders |
| `--color-background` | `var(--bone)` | page background |
| `--color-surface` | `#FFFFFF` | cards, elevated surfaces |
| `--color-surface-elevated` | `var(--bone-deep)` | pressed/inset surfaces |
| `--color-border` | `rgba(20, 41, 61, 0.12)` | default borders |
| `--color-border-strong` | `var(--navy)` | emphasized borders, data strips |

### 1.3 Mustard Contrast Rules

Mustard (`#E8B82D`) fails 4.5:1 on bone/white at small text sizes. Follow these rules:
- **Never** use mustard for body text below 18px
- **OK** for large display numbers (48px+), icons, decorative fills, progress bars
- **OK** for text on navy background (7.2:1 ✅)
- For small accent text on light bg, use `--navy` with a mustard underline/bg chip instead
- Mustard background blocks must use `--navy` text inside (7.2:1 ✅)

---

## 2. Typography

### 2.1 Font Stack

| Role | Family | Fallback | Source |
|---|---|---|---|
| Display | `Big Shoulders Display` | Impact, Haettenschweiler, condensed sans-serif | Google Fonts, weights 400/600/800/900 |
| Body | `IBM Plex Sans` | system-ui, -apple-system, sans-serif | Google Fonts, weights 400/500/600/700 |
| Mono / Data | `IBM Plex Mono` | ui-monospace, Menlo, monospace | Google Fonts, weights 400/500/600 |
| Hebrew | `Assistant` | system-ui, sans-serif | Google Fonts, weights 400/600/700/800 |

```css
@import url('https://fonts.googleapis.com/css2?family=Big+Shoulders+Display:wght@400;600;800;900&family=IBM+Plex+Sans:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500;600&family=Assistant:wght@400;600;700;800&display=swap');
```

### 2.2 Type Scale

| Token | Size | Weight | Font | Line-height | Letter-spacing | Tracking var | Use |
|---|---|---|---|---|---|---|---|
| `--text-display-hero` | 120–220px | 900 | Big Shoulders | 0.82 | -0.04em | tighter | hero numbers, active set weight |
| `--text-display-xl` | 88px | 900 | Big Shoulders | 0.85 | -0.02em | tight | chapter numbers |
| `--text-display-lg` | 48px | 900 | Big Shoulders | 0.9 | -0.02em | tight | masthead titles, section heads |
| `--text-display` | 36px | 800 | Big Shoulders | 0.95 | -0.01em | tight | card titles, skill names |
| `--text-display-sm` | 24px | 800 | Big Shoulders | 1 | 0 | normal | set numbers, inline display |
| `--text-title` | 20px | 800 | Big Shoulders | 1.1 | 0.01em | normal | skill names, exercise names |
| `--text-headline` | 18px | 700 | IBM Plex Sans | 1.2 | 0 | normal | card headlines, form labels |
| `--text-body-lg` | 17px | 500 | IBM Plex Sans | 1.55 | 0 | normal | large body, descriptions |
| `--text-body` | 15px | 400 | IBM Plex Sans | 1.55 | 0 | normal | default body |
| `--text-body-sm` | 13px | 500 | IBM Plex Sans | 1.5 | 0.02em | normal | small body, metadata |
| `--text-label` | 11px | 600 | IBM Plex Mono | 1.4 | 0.18em | wider | uppercase labels, kickers, section markers |
| `--text-caption` | 10px | 500 | IBM Plex Mono | 1.4 | 0.22em | wider | tiny labels, ribbons, timestamps |

### 2.3 Hebrew Typography

Hebrew text uses `Assistant` for all roles. Display numbers remain in Big Shoulders (LTR). Hebrew body follows the same scale but with:
- `letter-spacing: 0` (no tracking adjustment for Hebrew)
- `line-height` increased by 0.1 for better readability
- Bold weight (`700`/`800`) for emphasis instead of italic (Hebrew has no true italic)

### 2.4 Number Formatting

- All data numbers use `IBM Plex Mono` with `font-variant-numeric: tabular-nums` for alignment
- Thousands separator: comma (`46,200`)
- Decimal separator: period (`+4.1%`)
- Large numbers: show full value, no abbreviation in display context
- Hebrew uses same number formatting (LTR for numbers even in RTL context)

---

## 3. Spacing & Layout

### 3.1 Spacing Scale (4/8pt Grid)

| Token | Value | Use |
|---|---|---|
| `--space-0` | 0 | — |
| `--space-1` | 4px | inline icon gaps |
| `--space-2` | 8px | tight element gaps |
| `--space-3` | 12px | component internal padding (compact) |
| `--space-4` | 16px | standard padding, gap between related items |
| `--space-5` | 20px | page horizontal padding, card padding |
| `--space-6` | 24px | section internal gaps |
| `--space-8` | 32px | section separation, major gaps |
| `--space-10` | 40px | large section gaps |
| `--space-12` | 48px | chapter-level separation |
| `--space-16` | 64px | page-level separation |
| `--space-20` | 80px | hero-level separation |

### 3.2 Content Width & Padding

| Property | Mobile (<768px) | Tablet (768–1024px) | Desktop (>1024px) |
|---|---|---|---|
| Content max-width | 100% | 680px | 480px (phone-like) |
| Horizontal padding | 20px | 32px | auto-centered |
| Card padding | 20px | 24px | 24px |

### 3.3 Responsive Breakpoints

| Name | Width | Description |
|---|---|---|
| `sm` | 375px | Small phone baseline |
| `md` | 768px | Tablet |
| `lg` | 1024px | Desktop / wide tablet |
| `xl` | 1440px | Wide desktop |

The app is mobile-first. On desktop, content is centered in a max-width container with the same phone-like proportions.

---

## 4. Borders, Radius, Shadows

### 4.1 Border Radius

| Token | Value | Use |
|---|---|---|
| `--radius-none` | 0 | data strips, chapter breaks, editorial blocks |
| `--radius-sm` | 4px | small chips, inline badges |
| `--radius-md` | 8px | inputs, small cards |
| `--radius-lg` | 12px | standard cards |
| `--radius-xl` | 16px | hero cards, prominent surfaces |
| `--radius-full` | 9999px | pills, circular elements |

**Note:** The Annual design favors **sharp corners** (radius-none) for mastheads, data strips, chapter breaks, and hero blocks. Rounded corners are reserved for cards, inputs, and buttons.

### 4.2 Borders

| Style | Spec | Use |
|---|---|---|
| Editorial border | `2px solid var(--navy)` | data strip dividers, card outlines, chip outlines |
| Subtle border | `1px solid var(--bone-deep)` | skill rows, list items, section dividers |
| Chapter border | `3px solid var(--navy)` | chapter head underline |

### 4.3 Shadows

Minimal — the Annual design uses **color blocks and borders** for elevation, not shadows.

| Token | Value | Use |
|---|---|---|
| `--shadow-card` | `0 1px 3px rgba(20,41,61,0.08)` | elevated cards on bone background |
| `--shadow-elevated` | `0 4px 12px rgba(20,41,61,0.12)` | modals, overlays |
| `--shadow-navy` | `0 8px 24px rgba(11,26,43,0.25)` | navy blocks casting depth |

---

## 5. Motion & Animation

### 5.1 Duration Scale

| Token | Value | Use |
|---|---|---|
| `--duration-instant` | 75ms | color change, opacity flicker |
| `--duration-fast` | 150ms | button press, toggle, small transitions |
| `--duration-base` | 200ms | card hover, navigation, standard transitions |
| `--duration-slow` | 300ms | page transitions, chapter break animation |
| `--duration-chapter` | 500ms | chapter number entrance, hero number count-up |

### 5.2 Easing

| Token | Value | Use |
|---|---|---|
| `--ease-out` | `cubic-bezier(0.25, 0.46, 0.45, 0.94)` | elements entering view |
| `--ease-in` | `cubic-bezier(0.55, 0.06, 0.68, 0.19)` | elements leaving view |
| `--ease-spring` | `cubic-bezier(0.34, 1.56, 0.64, 1)` | bouncy feedback (number count, badge pop) |
| `--ease-editorial` | `cubic-bezier(0.16, 1, 0.3, 1)` | page transitions, chapter reveals |

### 5.3 Animation Patterns

| Pattern | Animation | Duration | Easing |
|---|---|---|---|
| Page enter | fade-in + translateY(8px→0) | 300ms | ease-out |
| Chapter number reveal | clip-path from left | 500ms | ease-editorial |
| Hero number | count-up from 0 | 600ms | ease-out |
| Mustard block fill | width: 0→N% | 400ms | ease-editorial |
| Skill bar | width: 0→N% | 500ms | ease-out, stagger 80ms |
| Card press | scale(1→0.98) | 100ms | ease-out |
| Card release | scale(0.98→1) | 150ms | ease-spring |
| Ribbon pop | scale(0.8→1) + opacity | 200ms | ease-spring |
| Toast / notification | slide-up from bottom | 250ms | ease-editorial |
| Exit animations | 60–70% of enter duration | — | ease-in |

### 5.4 Reduced Motion

All animations must respect `prefers-reduced-motion: reduce`:
- Disable count-up animations → show final value instantly
- Disable slide/clip reveals → fade-in at 150ms max
- Disable spring bounces → use linear opacity
- Keep functional transitions (button press feedback) at ≤100ms

---

## 6. Z-Index Scale

| Token | Value | Use |
|---|---|---|
| `--z-base` | 0 | default content |
| `--z-sticky` | 20 | sticky headers, chapter breaks |
| `--z-nav` | 40 | bottom navigation |
| `--z-dropdown` | 60 | dropdowns, select menus |
| `--z-overlay` | 80 | modal backdrop |
| `--z-modal` | 90 | modal content |
| `--z-toast` | 100 | toast notifications |
| `--z-tooltip` | 110 | tooltips |

---

## 7. Five Signature Elements

1. **Chapter numbers** — huge `01`, `02`, `03` at 88px introducing each section like chapters of a book. Color: navy. Font: Big Shoulders 900. Paired with a chapter title and a `3px solid navy` underline.

2. **Navy + mustard masthead blocks** — full-bleed rectangles with inverted type. Navy background with bone text + mustard accent. Used for page tops, section breaks, and hero stats. No border-radius.

3. **Mustard ribbons** — positioned `absolute; top:0; right:0` on hero cards. Navy background, mustard text, IBM Plex Mono 10px, uppercase, `letter-spacing: 0.2em`. Labels: `THIS WEEK` / `PR` / `PUSH` / `NEW`.

4. **Oversized condensed numbers as pull-quotes** — the stats themselves are the headlines (`04` sessions, `+4.1%` delta, `90 × 6`), in Big Shoulders at 120–220px. These are the visual center of every section.

5. **Chapter break strips** — thin horizontal navy bars that separate sections. Navy background, flex between left label (IBM Plex Mono, mustard) and right title (Big Shoulders, bone). Height: ~48px. Padding: 16px 20px.

---

## 8. Component Specifications

### 8.1 Buttons

| Variant | Background | Text | Border | Radius | Padding | Min-height |
|---|---|---|---|---|---|---|
| Primary | `var(--navy)` | `var(--mustard)` | none | 0 | 22px 24px | 52px |
| Secondary | `var(--bone)` | `var(--navy)` | `2px solid var(--navy)` | 0 | 22px 24px | 52px |
| Ghost | transparent | `var(--navy)` | none | 0 | 12px 16px | 44px |
| Destructive | `var(--color-error)` | `#fff` | none | 0 | 22px 24px | 52px |
| Small | `var(--navy)` | `var(--mustard)` | none | 0 | 10px 16px | 36px |

All buttons use Big Shoulders Display 800, uppercase, `letter-spacing: 0.08em`, no border-radius (editorial sharp).

**States:**
- Hover: darken bg by 10% (`--navy-deep` for primary)
- Active/pressed: `scale(0.98)` at 100ms
- Disabled: `opacity: 0.4`, `cursor: not-allowed`
- Focus: `outline: 2px solid var(--mustard); outline-offset: 2px`

### 8.2 Cards

| Type | Background | Border | Padding | Radius |
|---|---|---|---|---|
| Default card | `var(--bone-deep)` | `1px solid var(--bone-deep)` | 20px | 0 |
| Outlined card | `var(--bone)` | `2px solid var(--navy)` | 20px | 0 |
| Surface card | `#FFFFFF` | `1px solid var(--bone-deep)` | 20px | 0 |
| Mustard block | `var(--mustard)` | none | 28px 22px | 0 |

Cards in Annual design are **sharp-cornered** (no border-radius) with strong borders instead of shadows.

### 8.3 Inputs

| Property | Value |
|---|---|
| Background | `#FFFFFF` |
| Border | `2px solid var(--navy)` on focus, `1px solid var(--bone-deep)` default |
| Text | IBM Plex Sans 400, 15px, `var(--ink)` |
| Height | 48px minimum (touch target) |
| Padding | 12px 16px |
| Radius | 0 (sharp) |
| Focus ring | `box-shadow: 0 0 0 3px var(--mustard)` |

### 8.4 Data Strip

Two-column grid with `2px solid var(--navy)` border and divider:
- Value: Big Shoulders 800, 44px, `var(--ink)`, navy for emphasis
- Label: IBM Plex Mono 500, 10px, `var(--stone)`, uppercase, `letter-spacing: 0.22em`
- Accent values: mustard color (`--mustard`) for highlights like `+4.1%`

### 8.5 Skill / Progress Bars

- Label row: flex between skill name (Big Shoulders 800, 20px) and percentage (IBM Plex Mono 500, 14px, navy)
- Bar: 8px height, `var(--bone-deep)` track, `var(--mustard)` fill
- Fill animation: width 0→target%, 500ms, ease-out, staggered 80ms per bar
- Separated by `1px solid var(--bone-deep)` dividers

### 8.6 Bottom Navigation

- Height: 64px + safe-area-bottom
- Background: `var(--navy)`
- Active tab: `var(--mustard)` icon + label
- Inactive tab: `rgba(245,241,235,0.4)` icon, no label
- Icon size: 22px, label: IBM Plex Mono 10px, uppercase
- Max 5 items
- Sharp top border: `1px solid var(--navy-deep)`

### 8.7 Chapter Break Strip

```css
.chapter-break {
  background: var(--navy);
  color: var(--bone);
  padding: 16px 20px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  /* .left → IBM Plex Mono 10px, mustard, uppercase, tracking 0.28em */
  /* .right → Big Shoulders 800, 20px, bone, uppercase, tracking 0.04em */
}
```

### 8.8 Toast / Notification

- Slide up from bottom
- Navy background, bone text, mustard accent
- Max width: 360px, centered
- Auto-dismiss: 3s (success), 5s (error), manual (destructive actions)
- Uses `role="alert"` + `aria-live="polite"`

### 8.9 Modal / Overlay

- Backdrop: `rgba(11, 26, 43, 0.6)` with `backdrop-filter: blur(8px)`
- Content: bone background, 2px navy border, no border-radius
- Enters with scale(0.95→1) + opacity(0→1) at 250ms, ease-editorial
- Must include visible close button (X in navy)
- Must trap focus, restore on close

---

## 9. Interaction & Accessibility

### 9.1 Touch Targets

- Minimum 44×44px for all interactive elements
- Buttons: min-height 52px (primary), 44px (ghost)
- Icon-only buttons: expand hit area with padding to meet 44×44px
- Bottom nav items: full 64px height as touch target

### 9.2 Focus States

- Visible focus ring: `2px solid var(--mustard); outline-offset: 2px`
- Never remove focus rings (`outline: none` only with `:focus:not(:focus-visible)` reset)
- Focus order matches visual/reading order
- Skip-link at top: "Skip to main content" / "דלג לתוכן הראשי"

### 9.3 Color Accessibility

- All text meets WCAG AA (4.5:1 for normal text, 3:1 for large text)
- Mustard is decorative/accent only at small sizes
- Error/Success/Warning states include icon + text, not color alone
- Charts: supplement color with patterns or text labels

### 9.4 Screen Readers

- All images/icons have `aria-label` or `aria-hidden="true"` (decorative)
- Hero numbers include `aria-label` with spoken form ("4 sessions")
- Chapter breaks are semantic `<section>` with `aria-labelledby`
- Navigation uses `<nav>` with `aria-label`
- Live regions for dynamic content (`aria-live="polite"`)

### 9.5 Keyboard Navigation

- Full keyboard support for all interactive elements
- `Enter` / `Space` activate buttons
- `Escape` closes modals, overlays, dropdowns
- `Tab` / `Shift+Tab` cycle through focusable elements
- Focus trap in modals

---

## 10. Voice & Copy

Editorial. Confident. Third-person when reporting, second-person when commanding.
- ✅ `Week 16 · four sessions · +4.1% vs prior. Chapter complete.`
- ✅ `BENCH PRESS · SET 03 / 05 · 90 kg × 6 · RPE 9`
- ✅ `§01 · skill tree — muscle-up progress: 67%.`
- ❌ `You did awesome this week, champ!`
- ❌ `Great job! Keep it up! 💪`

Hebrew: `שבוע 16 · ארבעה אימונים · +4.1% מהשבוע הקודם. פרק סגור.`

### Micro-copy Rules

| Context | English | Hebrew |
|---|---|---|
| Start workout | `START SESSION` | `התחל אימון` |
| Log set | `LOG SET` | `תעד סט` |
| Skip | `SKIP` | `דלג` |
| Week label | `WEEK 16` | `שבוע 16` |
| Chapter closed | `Chapter complete.` | `פרק סגור.` |
| Empty state | `No data yet. Start training to generate your first chapter.` | `אין נתונים עדיין. התחל להתאמן כדי ליצור את הפרק הראשון.` |

---

## 11. Wireframes

### 11.1 Dashboard

```
╔═══════════════════════════════════╗
║  SUN · 19.04.26 · PUSH           ║ ← navy masthead
║  WEEK                            ║
║  16.                             ║ ← huge display
╠═══════════════════════════════════╣
║                                   ║
║  ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓  [THIS   ║ ← mustard block
║  ▓ SESSIONS                WEEK]  ║
║  ▓ 04                             ║ ← 120px display
║  ▓ of six · 67% target            ║
║  ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓         ║
║                                   ║
║  ┌──────────────┬───────────────┐ ║
║  │ 46,200       │ +4.1%         │ ║ ← dual data strip
║  │ KG VOLUME    │ VS LAST WEEK  │ ║
║  └──────────────┴───────────────┘ ║
║                                   ║
║ ▐ §02 · SKILL TREE    NEXT UP  ▌  ║ ← chapter break
║                                   ║
║  MUSCLE-UP              67%       ║
║  ███████████████░░░░░░░░         ║ ← mustard fill
║                                   ║
║  BENCH 2×BW             22%       ║
║  █████░░░░░░░░░░░░░░░░░░         ║
║                                   ║
║  HANDSTAND 30s          40%       ║
║  █████████░░░░░░░░░░░░░░         ║
║                                   ║
║  ┌─────────────────┬──────────┐   ║
║  │ START SESSION   │   LOG    │   ║ ← navy / bone
║  └─────────────────┴──────────┘   ║
╚═══════════════════════════════════╝
```

### 11.2 Active Workout

```
╔═══════════════════════════════════╗
║  §01 · BENCH PRESS    SET 03/05  ║ ← navy masthead
╠═══════════════════════════════════╣
║  [RPE 9]                          ║ ← mustard badge, top-right
║                                   ║
║           90                      ║ ← 220px display
║     KG · × 6 REPS                ║ ← mono label
║                                   ║
╠═══════════════════════════════════╣
║  — SETS RECORDED —                ║ ← mono caption
║                                   ║
║  01  80 × 8 · RPE 7          ✓   ║ ← done (stone)
║  02  85 × 8 · RPE 8          ✓   ║ ← done (stone)
║  ┌─────────────────────────────┐  ║
║  │ 03  90 × 6 · RPE 9 · PR  ▸ │  ║ ← active (mustard bg, navy text)
║  └─────────────────────────────┘  ║
║  04  90 × 6 · —                  ║ ← future (bone-deep)
║  05  90 × ? · —                  ║ ← future (bone-deep)
║                                   ║
║  ┌─────────────────┬──────────┐   ║
║  │ LOG SET         │   SKIP   │   ║ ← navy / bone
║  └─────────────────┴──────────┘   ║
╚═══════════════════════════════════╝
```

### 11.3 History / Workout Log

```
╔═══════════════════════════════════╗
║  HISTORY                          ║ ← navy masthead
║  ALL SESSIONS                     ║ ← bone text
╠═══════════════════════════════════╣
║                                   ║
║ ▐ §01 · THIS WEEK                ▌║ ← chapter break
║                                   ║
║  ┌───────────────────────────┐    ║
║  │ PUSH DAY                  │    ║ ← outlined card
║  │ SUN · 19.04.26            │    ║ ← mono caption
║  │                           │    ║
║  │ 46,200 kg    ·    6 sets  │    ║ ← data inline
║  │ 52 min      ·    4 exer.  │    ║
║  └───────────────────────────┘    ║
║                                   ║
║  ┌───────────────────────────┐    ║
║  │ PULL DAY                  │    ║
║  │ THU · 17.04.26            │    ║
║  │                           │    ║
║  │ 38,400 kg    ·    5 sets  │    ║
║  │ 45 min      ·    5 exer.  │    ║
║  └───────────────────────────┘    ║
║                                   ║
║ ▐ §02 · PREVIOUS WEEK           ▌ ║
║                                   ║
║  ┌───────────────────────────┐    ║
║  │ LEG DAY                   │    ║
║  │ MON · 14.04.26            │    ║
║  │ 41,800 kg    ·    7 sets  │    ║
║  │ 58 min      ·    5 exer.  │    ║
║  └───────────────────────────┘    ║
║                                   ║
╚═══════════════════════════════════╝
```

### 11.4 Settings

```
╔═══════════════════════════════════╗
║  SETTINGS                         ║ ← navy masthead
║  PREFERENCES                      ║ ← bone text
╠═══════════════════════════════════╣
║                                   ║
║ ▐ §01 · PROFILE                  ▌║ ← chapter break
║                                   ║
║  NAME                             ║ ← mono label
║  [ישראל ישראלי            ]     ║ ← input
║                                   ║
║  BODY WEIGHT                      ║
║  [82 kg                         ] ║
║                                   ║
║ ▐ §02 · TRAINING                 ▌║
║                                   ║
║  WEEKLY GOAL                      ║
║  [ 4 ] SESSIONS PER WEEK          ║
║                                   ║
║  DEFAULT REST                     ║
║  [ 90s ]                          ║
║                                   ║
║ ▐ §03 · APP                      ▌║
║                                   ║
║  LANGUAGE                         ║
║  [ Hebrew          ▸ ]            ║
║                                   ║
║  HAPTICS                    [●]   ║ ← toggle
║                                   ║
║  ┌─────────────────────────────┐  ║
║  │         SAVE CHANGES        │  ║ ← primary button
║  └─────────────────────────────┘  ║
╚═══════════════════════════════════╝
```

---

## 12. Dark Mode Variant

The Annual design's soul is the light bone + navy + mustard combination. A dark mode should feel like the **inverse print** — dark navy paper with bone ink.

| Light Token | Dark Token | Value |
|---|---|---|
| `--bone` | `--navy-deep` | `#0B1A2B` |
| `--bone-deep` | `--navy` | `#14293D` |
| `--navy` | `--bone` | `#F5F1EB` |
| `--ink` | `--bone` | `#F5F1EB` |
| `--stone` | `rgba(245,241,235,0.6)` | bone at 60% |
| `--mustard` | `--mustard` | stays `#E8B82D` |
| cards | `--navy` | `#14293D` |
| data strips | `var(--navy)` | inverted borders |

Dark mode is optional for v1 — the light Annual is the signature.

---

## 13. RTL (Hebrew) Considerations

- Layout direction: `dir="rtl"` on root
- Mustard ribbon: moves to `top:0; left:0` (instead of right)
- Chapter break: label on right, title on left (reversed)
- Data strip: no change (numbers are LTR even in RTL)
- Bottom nav: items order reversed
- Set list: number on right, value in center, checkmark on left
- Chevron arrows: reversed (`<` becomes `>`)
- `text-align: right` as default for Hebrew blocks
- Numbers remain LTR (`direction: ltr` on numeric elements)

---

## 14. Trade-offs vs Athletic Index

**Gains:** much louder presence, more "sports", way more magazine-like narrative. The app *tells a story* about your training instead of cataloging it. Editorial hierarchy makes data scannable. Big type is accessible by default.

**Loses:** less subtle, less literary. More "sports brand", less "personal journal". The mustard may tire over time. Readability requires careful balancing — bold everywhere kills hierarchy. Sharp corners feel harsher than rounded alternatives. Light theme is less common in fitness apps (stands out, but may surprise).

## Best for
Someone who wants their app to feel like Sports Illustrated or Nike Business Report. Someone who likes big type. Someone who wants weekly progress reports that feel momentous.

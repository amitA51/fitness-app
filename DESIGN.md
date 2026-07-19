# DESIGN.md — Sparkos Fitness

> Machine-readable design contract for AI agents and contributors.
> **Single source of truth:** `src/styles/tokens.css` (light + dark). This file
> mirrors it for fast reference — if they ever disagree, `tokens.css` wins.
> Human narrative & rationale: `docs/DESIGN_SYSTEM.md`.
> Aesthetic guardrails (what NOT to do): `.claude/rules/common/design-aesthetics.md`.

---

## Identity

**Apple Fitness+ × Fresh Steel.** Premium · Quiet · Cinematic · Singular action green · Hebrew-first.

- **Platform:** mobile-first PWA. Hard width cap `--max-width: 480px`.
- **Direction:** RTL-first (Hebrew UI). Numbers and stat values render LTR — via `.kinetic-number` or explicit `dir="ltr"`.
- **Character:** vast neutral canvas, continuous corners, pill CTAs, glass chrome, restrained type (no forced uppercase on product chrome). Lineage: Apple Fitness+, Apple.com product UI — not brutalist editorial, not generic SaaS teal.

## Aesthetic family

Cinematic Minimalism × Consumer Fitness. One chromatic accent (system green) in a sea of neutrals. Personality comes from spacing, type optical sizing, and glass — not mesh grids or industrial plate textures.

## Color — Light

| Token | Value | Role |
|-------|-------|------|
| `--fs-bg` | `#f5f5f7` | page canvas (Apple light gray) |
| `--fs-surface` | `#ffffff` | card / sheet surface |
| `--fs-surface-2` | `#e8e8ed` | inset / secondary fill |
| `--fs-ink` | `#1d1d1f` | primary text (Apple near-black) |
| `--fs-muted` | `#6e6e73` | secondary text |
| `--fs-primary` | `#1d1d1f` | dark primary fills |
| `--fs-accent` | `#30d158` | **action** system green — CTAs, focus, progress |
| `--fs-accent-2` | `#34c759` | green variant |
| `--fs-link` | `#248a3d` | inline links (AA on light surfaces) |
| `--fs-signal` | `#e2fb70` | **signal** lime — PRs / celebration only |
| `--fs-warn` | `#ff9f0a` | warnings (Apple orange) |

Semantic: success `#30d158` · error `#ff3b30` · `--color-ink-on-accent #003d12` · `--color-ink-on-dark #ffffff`.
Light primary button: dark fill + white ink. Accent RGB: `--fs-accent-rgb: 48, 209, 88`.

### Zone-color scale

| Zone | Token | Meaning |
|------|-------|---------|
| `good` | `var(--fs-accent)` | on track |
| `neutral` | `var(--fs-muted)` | mid |
| `attention` | `var(--fs-warn)` | needs attention |

Lime (`--fs-signal`) is **not** in this scale — PR celebration only.

## Color — Dark (Obsidian) — `html.dark`

| Token | Value |
|-------|-------|
| `--fs-bg` | `#000000` |
| `--fs-surface` | `#1c1c1e` |
| `--fs-surface-2` | `#2c2c2e` |
| `--fs-ink` | `#f5f5f7` |
| `--fs-muted` | `#98989d` |
| `--fs-accent` | `#30d158` |
| `--fs-link` | `var(--fs-accent)` |

Dark primary button **inverts**: `--btn-primary-bg: var(--fs-accent)`, text `#003d12`.

## Typography

Loaded in `src/styles/typography.css` via Google Fonts (Hebrew-capable substitutes for SF Pro).

- `--font-display` = **Bricolage Grotesque** (600/700) — display headlines. **No forced uppercase.**
- `--font-body` = **Assistant** (400/600/700) — body & Hebrew. Tracking slightly tight (`-0.01em`).
- `--font-mono` = **IBM Plex Mono** — micro labels only (kickers), not body captions.
- Numbers use `.kinetic-number` (tabular + bidi isolate).

Scale: hero 120 · xl 88 · lg 48 · display 36 · sm 24 · title 20 · headline 18 · body-lg 17 · body 15 · body-sm 13 · label 11 · caption 10.

## Spacing · Radius · Shadow · Motion

- **Spacing:** 4/8pt grid — `--space-1..24`.
- **Radius:** continuous — `sm 6 / md 10 / lg 14 / xl 18 / 2xl 22`. `--radius-asymmetric` is now continuous `20px` (token name kept). CTAs use `--radius-full` / `--radius-pill`.
- **Shadow:** soft diffused Apple product-card lift (`0 2px 8px / 0 8px 24px`). Prefer color steps over heavy borders.
- **Motion:** `--ease-out: cubic-bezier(.16,1,.3,1)`. Always honor `prefers-reduced-motion`.

## Component primitives

- `.start-workout-btn` `.primary-btn` `.icon-btn` — **pill** buttons; solid green CTA, no industrial dash decorations.
- `.glass-surface` — elevated white/gray card (not true glass).
- `.glass-nav` — true glass: `saturate(180%) blur(20px)`.
- `.hero-card` — cinematic dark gradient block (no steel-plate texture).
- `.kinetic-number` · `.focus-ring` · ambient mesh utilities (prefer clean solid bg).

## Layout

`--max-width: 480px` · `--content-padding: 20px` · `--nav-height: 64px`. Sticky glass header + pinned glass bottom nav with `env(safe-area-inset-bottom)`.

## Voice

Hebrew-first, concise, confident. Sentence case in product chrome. Concrete action language ("התחל אימון", "בחרו תבנית"). No emoji in chrome. Numbers are heroes.

## Anti-slop guardrails (summary)

1. Green accent is intentional system green — **never hardcode** `#30d158`; use `var(--fs-accent)`.
2. **No unowned third accent.** No decorative accent rails on every card.
3. **Containers nest ≤ 2 levels.**
4. Display font with explicit weight + tracking — never default to Inter/Roboto "by vibe".
5. Lucide only for icons.
6. No mesh/grid body noise in light mode — solid `#f5f5f7` canvas.
7. No forced ALL-CAPS product chrome; mono kickers stay sparse.
8. Reserve motion for meaningful moments.

Full ruleset: `.claude/rules/common/design-aesthetics.md`.

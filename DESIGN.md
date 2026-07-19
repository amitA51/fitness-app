# DESIGN.md — Sparkos Fitness

> Machine-readable design contract for AI agents and contributors.
> **Single source of truth:** `src/styles/tokens.css` (light + dark). This file
> mirrors it for fast reference — if they ever disagree, `tokens.css` wins.
> Human narrative & rationale: `docs/DESIGN_SYSTEM.md`.
> Aesthetic guardrails (what NOT to do): `.claude/rules/common/design-aesthetics.md`.

---

## Identity

**Fresh Steel** (light) / **Obsidian** (dark). Disciplined · Athletic · Data-driven · Direct · Energetic.
Shape language borrows Apple Fitness+ craft (glass chrome, continuous pill CTAs, quiet type) — **colors stay brand mint/teal**, not Apple system green.

- **Platform:** mobile-first PWA. Hard width cap `--max-width: 480px`.
- **Direction:** RTL-first (Hebrew UI). Numbers and stat values render LTR — via `.kinetic-number` or explicit `dir="ltr"`.
- **Character:** mint action accent + navy primary, continuous corners, pill CTAs, glass nav, restrained type (no forced uppercase on product chrome).

## Aesthetic family

Editorial athletic × consumer fitness. The **mint/teal accent is a deliberate, tokenized brand decision**, not an AI default — declared once in `--fs-accent` and never hardcoded.

## Color — Light (Fresh Steel)

| Token | Value | Role |
|-------|-------|------|
| `--fs-bg` | `#eef3f1` | page background (mint-tinted bone) |
| `--fs-surface` | `#ffffff` | card / sheet surface |
| `--fs-surface-2` | `#dbe6e3` | inset / secondary surface |
| `--fs-ink` | `#132327` | primary text |
| `--fs-muted` | `#4d5c5a` | secondary text (≥4.5:1 on bg) |
| `--fs-primary` | `#16292d` | navy primary button bg, headings |
| `--fs-accent` | `#43c7a5` | **action** mint — CTAs, focus, progress |
| `--fs-accent-2` | `#2c7f91` | deep teal — secondary accents |
| `--fs-link` | `#1d6575` | inline text links (AA on light surfaces) |
| `--fs-signal` | `#e2fb70` | **signal** lime — PRs, celebration only |
| `--fs-warn` | `#e26e3f` | warnings |
| `--fs-steel` `--fs-plate` `--fs-rubber` | `#b9c8c6` `#d7e0de` `#0d1516` | equipment neutrals |

Semantic: `--color-success #2f8f58` · `--color-error #b83228` · `--color-ink-on-accent #071412` · `--color-ink-on-dark #ffffff`.
Light primary button: navy fill + mint ink. Accent RGB: `--fs-accent-rgb: 67, 199, 165`.

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
| `--fs-surface` | `#111111` |
| `--fs-surface-2` | `#1a1a1a` |
| `--fs-ink` | `#f0f0f0` |
| `--fs-muted` | `#8c8c8c` |
| `--fs-primary` | `#0a0a0a` |
| `--fs-accent` | `#4ddcbb` (bright mint on black) |
| `--fs-link` | `var(--fs-accent)` |
| `--fs-signal` | `#e2fb70` |

Dark primary button **inverts**: `--btn-primary-bg: var(--fs-accent)`, text `#071412`.

## Typography

Loaded in `src/styles/typography.css` via Google Fonts.

- `--font-display` = **Bricolage Grotesque** (600/700) — display headlines. **No forced uppercase on product chrome.**
- `--font-body` = **Assistant** (400/600/700) — body & Hebrew.
- `--font-mono` = **IBM Plex Mono** — sparse micro labels only.
- Numbers use `.kinetic-number` (tabular + bidi isolate).

Scale: hero 120 · xl 88 · lg 48 · display 36 · sm 24 · title 20 · headline 18 · body-lg 17 · body 15 · body-sm 13 · label 11 · caption 10.

## Spacing · Radius · Shadow · Motion

- **Spacing:** 4/8pt grid — `--space-1..24`.
- **Radius:** continuous — `sm 6 / md 10 / lg 14 / xl 18 / 2xl 22`. `--radius-asymmetric` is continuous `20px` (token name kept for call sites). CTAs use `--radius-full`.
- **Shadow:** soft diffused card lift. Prefer color steps over heavy borders.
- **Motion:** `--ease-out: cubic-bezier(.16,1,.3,1)`. Always honor `prefers-reduced-motion`.

## Component primitives

- `.start-workout-btn` `.primary-btn` `.icon-btn` — **pill** buttons; solid mint CTA.
- `.glass-surface` — elevated card (not true glass).
- `.glass-nav` — true glass: `saturate(180%) blur(20px)`.
- `.hero-card` — cinematic dark block.
- `.kinetic-number` · `.focus-ring`.

## Layout

`--max-width: 480px` · `--content-padding: 20px` · `--nav-height: 64px`. Sticky glass header + pinned glass bottom nav with `env(safe-area-inset-bottom)`.

## Voice

Hebrew-first, concise, confident. Sentence case in product chrome. Concrete action language. No emoji in chrome. Numbers are heroes.

## Anti-slop guardrails (summary)

1. The mint accent is intentional — **never hardcode** `#43c7a5`/`#4ddcbb`; use `var(--fs-accent)`.
2. **No unowned third accent.** No decorative accent rails on every card.
3. **Containers nest ≤ 2 levels.**
4. Display font with explicit weight + tracking — never default to Inter/Roboto.
5. Lucide only for icons.
6. Clean solid body canvas (no mesh/grid noise).
7. No forced ALL-CAPS product chrome; mono kickers stay sparse.
8. Reserve motion for meaningful moments.

Full ruleset: `.claude/rules/common/design-aesthetics.md`.

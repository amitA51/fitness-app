# DESIGN.md — Sparkos Fitness

> Machine-readable design contract for AI agents and contributors.
> **Single source of truth:** `src/styles/tokens.css` (light + dark). This file
> mirrors it for fast reference — if they ever disagree, `tokens.css` wins.
> Human narrative & rationale: `docs/DESIGN_SYSTEM.md`.
> Aesthetic guardrails (what NOT to do): `.claude/rules/common/design-aesthetics.md`.

---

## Identity

**Fresh Steel** (light) / **Obsidian** (dark). Disciplined · Athletic · Data-driven · Direct · Energetic. Lineage: Apple Fitness+, Nike Training Club, Spotify — not a generic SaaS look.

- **Platform:** mobile-first PWA. Hard width cap `--max-width: 480px`.
- **Direction:** RTL-first (Hebrew UI). Numbers and stat values render LTR (`dir="ltr"`).
- **Character:** editorial masthead (solid primary block) + oversized display numerals + uppercase mono micro-labels. A two-accent system (mint action + lime signal), sharp asymmetric corners, generous negative space.

## Aesthetic family

Editorial Minimalism × Data-Dense Pro, with a brutalist-editorial masthead. The **mint/teal accent is a deliberate, tokenized brand decision**, not an AI default — it is declared once in `--fs-accent` and never hardcoded. (See the teal-fingerprint note in the anti-slop rule.)

## Color — Light (Fresh Steel)

| Token | Value | Role |
|-------|-------|------|
| `--fs-bg` | `#eef3f1` | page background (mint-tinted bone) |
| `--fs-surface` | `#ffffff` | card / sheet surface |
| `--fs-surface-2` | `#dbe6e3` | inset / secondary surface, minus-button |
| `--fs-ink` | `#132327` | primary text |
| `--fs-muted` | `#4d5c5a` | secondary text (≥4.5:1 on bg) |
| `--fs-primary` | `#16292d` | masthead block, primary button bg, headings |
| `--fs-accent` | `#43c7a5` | **action** mint — CTAs, focus, +button, progress |
| `--fs-accent-2` | `#2c7f91` | deep teal — secondary accents |
| `--fs-signal` | `#e2fb70` | **signal** lime — PRs, highlights, celebration only |
| `--fs-warn` | `#e26e3f` | warnings |
| `--fs-steel` `--fs-plate` `--fs-rubber` | `#b9c8c6` `#d7e0de` `#0d1516` | equipment-metaphor neutrals |

Semantic: `--color-success #2f8f58` · `--color-error #b83228` · `--color-ink-on-accent #071412` · `--color-ink-on-dark #ffffff` · `--color-ink-on-error` (`#ffffff` light / `#071412` dark — error red is dark in light mode and bright in dark mode). Accent as channels: `--fs-accent-rgb: 67,199,165` for `rgba()` tints.

## Color — Dark (Obsidian) — `html.dark`

Philosophy: near-black, **zero color tint on surfaces** — all personality from the accent.

| Token | Value |
|-------|-------|
| `--fs-bg` | `#000000` |
| `--fs-surface` | `#111111` |
| `--fs-surface-2` | `#1a1a1a` |
| `--fs-ink` | `#f0f0f0` |
| `--fs-muted` | `#8c8c8c` |
| `--fs-primary` | `#0a0a0a` |
| `--fs-accent` | `#4ddcbb` (bright mint pops on black) |
| `--fs-signal` | `#e2fb70` |

In dark mode the primary button **inverts**: `--btn-primary-bg: var(--fs-accent)`, text `#071412`. OLED screens may force pure `#000000`.

## Typography

Loaded in `src/styles/typography.css` via Google Fonts.

- `--font-display` = **"Bricolage Grotesque"** (600/700/800) — headings & numbers. Headings are `text-transform: uppercase`, `letter-spacing: -0.02em`.
- `--font-body` = **"Assistant"** (400/600/700/800) — body & Hebrew.
- `--font-mono` = **"IBM Plex Mono"** (500/600/700) — micro-labels, captions, kickers; uppercase, wide tracking (`0.12em`–`0.28em`).
- Numbers use `.kinetic-number` (`tabular-nums`, `lnum`) so digits don't jitter.

Scale (`--text-*`): hero 120 · xl 88 · lg 48 · display 36 · sm 24 · title 20 · headline 18 · body-lg 17 · body 15 · body-sm 13 · label 11 · caption 10.

## Spacing · Radius · Shadow · Motion

- **Spacing:** 4/8pt grid — `--space-1..24` (4px → 96px).
- **Radius:** `--radius-asymmetric: 22px 16px 22px 16px` is the signature card shape; also `sm 4 / md 8 / lg 12 / xl 16 / 2xl 24 / full`. Mastheads & some primitives use **sharp corners (0)** deliberately.
- **Shadow:** 3-level elevation `--elevation-0..3` (+ `--shadow-glow-accent`, `--shadow-glow-signal` for mint/lime halos).
- **Motion:** `--ease-out: cubic-bezier(.16,1,.3,1)` (default), spring `cubic-bezier(.34,1.56,.64,1)`. Durations: instant 75 · fast 150 · base 200 · slow 300 · chapter 500. Always honor `prefers-reduced-motion`.

## Component primitives (CSS classes — see `src/styles/components.css`, `global.css`)

- `.start-workout-btn` `.primary-btn` `.icon-btn` — buttons.
- `.stepper-card` / `.step-btn.plus` / `.ghost-value` — set inputs (active workout).
- `.template-card` `.quick-card` `.magnetic-card` `.glass-surface` — cards.
- `.fs-accent-rail` — RTL-aware 4px accent bar. **Reserve for one semantic role; do not apply decoratively.** (Currently over-applied — see audit.)
- `.kinetic-number(.large)` · `.chapter-break` (masthead kicker row) · `.ambient-mesh(-soft/-strong)` (background) · `.accent-glow` / `.signal-glow` · `.scrim-noise` · `.focus-ring`.

## Layout

`--max-width: 480px` · `--content-padding: 20px` · `--nav-height: 64px` · `--masthead-padding: 20px 24px`. Surfaces: navy masthead (pinned) → bone body (scroll) → pinned footer CTA, with `env(safe-area-inset-bottom)`.

## Voice

Hebrew-first, concise, confident. Mono micro-labels are uppercase kickers ("תכנון מראש"). No emoji in product chrome. Numbers are heroes.

## Anti-slop guardrails (summary)

1. The mint accent is intentional — but **never hardcode `#43c7a5`/`#4ddcbb`**; use `var(--fs-accent)`.
2. **One accent-rail role**, never decoration on every card.
3. **Containers nest ≤ 2 levels.** No pill-wrapping-card-wrapping-card.
4. Display font = Bricolage with explicit weight+tracking — never fall back to Inter/Roboto/system "by vibe".
5. Lucide is the single icon family — don't mix sets.
6. Reserve extra animation passes for hero / empty / celebration moments.

Full ruleset: `.claude/rules/common/design-aesthetics.md`.

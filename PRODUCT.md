# Product

## Register

product

## Users

Hebrew-speaking gym trainees and their coach, on a phone, mid-workout or while logging food. RTL-first UI; one hand, sweaty fingers, gym lighting (often dark rooms → dark mode matters). The job: log sets/reps/weight fast, track nutrition macros, see progress without friction.

## Product Purpose

Sparkos Fitness is a mobile-first PWA for workout tracking (templates, active sessions, history), nutrition logging (macros, water), and progress/coaching insights, with offline-first storage (IndexedDB) and Supabase sync. Success: a set is logged in under 3 seconds, and the data the user sees is always trustworthy.

## Brand Personality

Disciplined · Athletic · Data-driven. Direct, confident, energetic Hebrew voice. Numbers are heroes (oversized display numerals); chrome stays quiet. Lineage: Apple Fitness+, Nike Training Club, Spotify — not generic SaaS.

## Anti-references

- Generic AI/SaaS dashboards: purple-indigo gradients, Inter-by-default, identical card grids, accent rails on every card.
- Unowned teal-everywhere slop: our mint accent is tokenized (`--fs-accent`), declared once, never hardcoded.
- Over-decorated fitness apps with confetti-everything; celebration (lime `--fs-signal`) is reserved for PRs only.

## Design Principles

1. **Log first, admire later** — the active-workout flow is optimized for speed and thumb reach; nothing may slow set entry.
2. **Numbers are heroes** — data renders big, tabular, LTR inside RTL; chrome recedes.
3. **Two accents, strict roles** — mint = action/focus, lime = celebration. A third accent is a bug.
4. **Both modes always** — every surface must read correctly in Fresh Steel (light) and Obsidian (dark); personality in dark comes from the accent, never tinted surfaces.
5. **Earned familiarity** — standard affordances, consistent component vocabulary across screens; delight only at moments (PR, finish).

## Accessibility & Inclusion

WCAG 2.2 AA: text ≥4.5:1, large text ≥3:1, visible focus, 44px touch targets. Hebrew `aria-label` on icon-only buttons. `prefers-reduced-motion` honored everywhere. `html.large-text` scaling supported. Numbers `dir="ltr"`.

# Anti-Slop Audit — 2026-06-02

Audit of the live UI against the catalogued "AI-generated design" fingerprints,
mapped to this app's **Fresh Steel / Obsidian** system. Source of fingerprints:
Anthropic frontend-aesthetics cookbook + awesome-claude-design anti-slop kit.
Token SSOT: `src/styles/tokens.css`. Guardrail: `.claude/rules/common/design-aesthetics.md`.

Severity: 🔴 fix soon · 🟠 should fix · 🟡 consider · 🟢 note / already-good.

---

## 🟢 RESOLVED — `.fs-accent-rail` decorative bar (already removed app-wide)

**Status: not an issue.** On closer reading of `src/styles/components.css:991-999`,
the colored 4px side-stripe was **already removed app-wide** — the comment there
explicitly notes side-stripes "read as a generic 'callout' tell" and that the
accent is now carried by eyebrows, numbers, and progress fills instead. The
`.fs-accent-rail` class is retained **only** as a containment helper
(`position: relative; overflow: hidden`) that existing layouts depend on.

So the "accent bar on every card" fingerprint does **not** apply, and the class
must **not** be stripped from those ~14 components — removing it would break their
positioning/overflow containment. No action. (The earlier draft of this audit
flagged this as HIGH before the CSS was read; corrected here.)

## 🟠 HIGH — Documentation drift: component headers name the wrong system

Several component header comments describe a **"Sport Annual Editorial"** system
with **"Navy · Mustard · Bone · Big Shoulders Display + IBM Plex Mono"**
(e.g. `states/PreWorkoutScreen.tsx`). The **real** system is **Fresh Steel /
Obsidian**: teal `--fs-accent #43c7a5`, **Bricolage Grotesque** display, Assistant
body, IBM Plex Mono. "Big Shoulders Display" and "Mustard" are not in `tokens.css`.

**Why it matters:** future contributors (and AI agents) read these headers and
reproduce a system that no longer exists → drift compounds.

**Fix:** find/replace the stale "Sport Annual / Big Shoulders / Navy·Mustard·Bone"
headers with the real names. Cheap and high-leverage. (The new
`WorkoutPlanScreen.tsx` header was corrected in this pass.)

## 🟡 MEDIUM — Hardcoded `#FFFFFF` / `#000000` on mastheads

`PreWorkoutScreen`, `ExerciseSelector`, and the new `WorkoutPlanScreen` use literal
`#FFFFFF` for masthead title text and `#000000` for OLED backgrounds. There are
tokens for this: `--color-ink-on-dark` and the dark palette. Low risk (the navy
masthead is fixed), but prefer tokens so a future theme can't break contrast.

**Fix (optional, low priority):** swap masthead `#FFFFFF` → `var(--color-ink-on-dark)`.

## 🟡 MEDIUM — Two-accent system needs guarding

`--fs-accent` (mint, action) and `--fs-signal` (lime, signal) are a deliberate
two-accent system. Risk: lime leaking into non-signal contexts, or a third accent
appearing ad-hoc. Keep `--fs-signal` for PRs / celebration only. Tracked in the
rule file.

## 🟢 GOOD — Things already done right

- **Accent is tokenized, not hardcoded.** The teal that would be slop-by-default
  is an owned brand decision via `--fs-accent` — correct.
- **Display font is Bricolage Grotesque** with explicit weight/tracking, uppercase
  headings — not a default serif/Inter.
- **Single icon family (Lucide)** throughout.
- **3-column grids are real data** (StatsGrid, PreWorkout stats), not a filler hero.
- **Dark mode is genuinely neutral** (Obsidian: zero surface tint, accent-only
  personality) — a strong, non-generic choice.
- **`prefers-reduced-motion`** is honored in motion-bearing components.

## New `WorkoutPlanScreen` / `PlanSetRow` (this session) — verified clean

- All colors via `var(--fs-*)`; `--fs-accent-2` uses a safe fallback.
- Numbers `dir="ltr"`; every icon-only button has `aria-label`; `Start` disabled
  when empty; focus-ring present.
- No accent-rail decoration; container nesting ≤ 2.
- Header comment corrected to name **Fresh Steel** (was "Sport Annual").

---

## Suggested order of remediation

1. **Doc-drift sweep** (cheap, prevents future drift) — fix stale headers across
   ~25 workout components. Comments only → zero runtime risk, but invisible to
   end users. (Active-area files PreWorkoutScreen, ExerciseSelector, and the new
   WorkoutPlanScreen corrected in this pass.)
2. **Masthead color tokens** (optional polish) — `#FFFFFF` → `--color-ink-on-dark`.

Neither blocks shipping, and neither is end-user-visible. **Genuinely visible
"big" improvements require running the app and iterating against the screen** —
the strongest anti-slop item (the accent rail) was already handled in CSS.

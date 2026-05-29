# VISION — Athletic Index

> **Working name:** Athletic Index *(placeholder — see §13)*
> **Owner:** pgishonim (personal use first, public later)
> **Status:** draft v2 — ready to execute on approval

---

## 1. The one-line soul

**A training journal designed like a type specimen catalog crossed with a passport and an engineering notebook.**

Not a fitness tracker. Not a commercial gym app. A **catalog of your training** — designed with the care of a printed annual report, the precision of a scientific journal, and the street-energy of a well-made zine.

It's gym-first (80%) with calisthenics/street as a meaningful second layer (20%). But the *design language* is unified: clean, literary, precise, and quietly confident. Every detail is intentional. Nothing is "fun" for its own sake.

## 2. Brand DNA — five words

**Printed. Precise. Unhurried. Confident. Authored.**

Every design decision answers to these. If a screen feels generic or templated, it fails "authored". If a detail is decorative without purpose, it fails "printed" (every ink mark on a real page was decided). If an animation rushes, it fails "unhurried".

## 3. Voice & tone

**Respectful. International. Factual. Literary.**

The app doesn't cheer. It doesn't greet. It doesn't use emoji. It states facts, shows numbers, and trusts the user. Its language is closer to a publisher's catalog than a trainer's motivation.

**Language rule:** mixed Hebrew/English is the native dialect. "Push day · יום דחיפה" on the same line is not a bug — that's how lifters speak. No forced Israeli slang.

### Voice examples

| Where | ❌ Generic fitness app | ✅ This app |
|---|---|---|
| App open, morning | "בוקר טוב! איזה אימון מחכה לך 💪" | `Sun · 19.04.26 — Push.` |
| Set complete | "כל הכבוד! עוד סט!" | *(silent — row receives an index stamp)* |
| Workout complete | "סיימת! אלוף 🎉" | `Done. 12,400 kg. +4% vs last week.` |
| Missed day | "אופס, דילגת על אימון" | `Missed Tuesday. Wed → pull.` |
| PR hit | "🏆🏆🏆 שיא אישי!!!" | *passport stamp: `★ PR · 19.04.26`* |
| Failed set | "אל תתייאש!" | *(number typeset slightly smaller, silent; next set auto-adjusts)* |
| Rest timer done | "בוא נחזור!" | *one haptic tick, number returns to black* |
| Empty state | "התחל אימון ראשון!" | `No sessions yet.` |

## 4. Color — one off-white, one ink, one orange

```
--paper:    #FAFAF7   /* off-white, warm, like a printed book page */
--rule:     #E8E6DF   /* hairlines, dividers, faint grid */
--ash:      #6B6962   /* secondary text, margin notes, index numbers */
--ink:      #0D0D0D   /* primary text, hero numbers */
--tangerine:#FF5B1F   /* the one accent — PR stamps, active state, highlights */
```

**Rationale:**
- **No pure white.** `#FFFFFF` is clinical, hospital, corporate. Off-white `#FAFAF7` reads like premium paper stock — warm, crafted, inviting.
- **No gray text on gray.** Ash is used only in margins, index numbers, and secondary labels — never in hero positions.
- **Ink, not pure black.** `#0D0D0D` is slightly softer than `#000`, reads as "printed ink", not "LCD pixels".
- **Tangerine is the only color.** Not red (alarm), not green (approval-cliché), not blue (corporate). Tangerine is *authored* — the accent of annual reports, old airline tickets, good magazine covers. Used sparingly: PR stamps, active tab, progress bars, hand-drawn highlight marks.
- **All 5 theme variants in the current codebase are deleted.** One palette. Opinionated.

## 5. Typography — serif + mono + sans

### Latin
- **Display (numbers, hero headlines):** **Fraunces** (700–900, display optical size) — variable serif with real character. Numbers at 180–240px fill the page and *are* the decoration.
- **Data / specs (weights, reps, timers, dates, index numbers):** **Geist Mono** (400/500) — clean, modern monospace. Every number that isn't hero-sized lives here.
- **Body (labels, copy, buttons):** **Geist Sans** (400/500/600) — neutral, readable, lets Fraunces and Geist Mono do the expressive work.

### Hebrew
- **Display:** **Noto Serif Hebrew** (700/900) — the closest Hebrew partner to Fraunces, with matching weight and optical warmth.
- **Body & UI:** **Heebo** (400/500/700) — clean sans, matches Geist's feel.
- Mixed-language lines are OK and encouraged: `Push · יום דחיפה`.

### Scale
```
display-xxl:  240px   (the hero number — weight, volume, streak)
display-xl:   120px   (second-tier numbers, page titles)
display-l:     56px   (section openers)
title:         24px
body:          15px
label:         11px   uppercase, tracking 0.12em, ash
index:         10px   Geist Mono, tracking 0.08em, ash
```

### Typographic rules
1. **Numbers are enormous. Labels are tiny.** The contrast is the design.
2. **Labels uppercase, wide tracking, ash.** Never bold, never ink-black.
3. **Tabular monospaced figures for all data columns.** No layout shift when numbers change.
4. **Asymmetry.** A 180px number next to a 10px `kg` is the pattern — not center-aligned blocks.
5. **No sentence case hero headlines.** Short, declarative, often one word: `Push.` `Monday.` `Done.`

## 6. The seven signature elements

These are what make the design *unforgettable*. No other fitness app has any of these, let alone all seven.

### 6.1 Registration marks
Printer's registration marks — small crosshairs `⊕` and L-shaped corner brackets — in the corners of hero cards. Tiny, 12px, ash-colored. Signal instantly that this screen was designed with the care of a printed object.

```
⊕                                    ⊕
┌                                     ┐

   BENCH PRESS
   
   90 × 6
   
└                                     ┘
⊕                                    ⊕
```

### 6.2 Passport stamps for PRs
When you hit a personal record, a rotated ink-stamp SVG is *stamped* onto the set row. Slight rotation (5–8°), slight ink imperfection (SVG filter: turbulence), tangerine fill. Reads `★ PR · DD.MM.YY`. Looks like a real border-control stamp.

Rare, so it hits. Maybe 1–3 per workout at most. Screenshot-worthy every time.

### 6.3 Oversized numbers as ornament
Forget dumbbell icons. The weight itself is the decoration. `90` in Fraunces Black at 180–240px, filling half the screen, with its beautiful serifs and contrast — *that's* the visual identity. Your body weight, your 1RM, your streak, your volume — each gets its turn as the hero.

### 6.4 Index numbers in margins
Every exercise, every section, every list item gets a monospace index in the left margin: `01`, `02`, `03`. Ash color, 10px, tracked wide. Like footnotes in a scholarly text or line numbers in an engineering blueprint. Turns the app into a *document*, not a dashboard.

### 6.5 Perforated edges on receipts
The workout summary (the "Receipt" from §9.3) has a dashed-SVG perforation at the bottom — just like a torn ticket stub or a cashier receipt. Two millimeters of implied physicality make the digital artifact feel real. Shareable PNG export keeps the perforation.

### 6.6 Ticker tape
A thin horizontal strip at the very top of the screen (16px, Geist Mono, ash on paper), scrolling slowly leftward with your week's highlights: `★ BENCH 92.5 · ★ PULL-UP ×12 · ★ SQUAT 120kg · 04 sessions · +4.1% vol`. Like a NASDAQ ticker, but for your body. Runs on all main screens. Pauses on tap so you can read.

### 6.7 Hand-drawn marks in tangerine
The *only* place tangerine appears freely is through SVG primitives that look drawn by pen: a circle around a PR number, an underline beneath a section title, a small arrow pointing to a callout. Imperfect, slightly wobbly paths. Like a coach marking your chart in orange ink. Rule: **max 3 per screen**. Rarity makes them pop.

## 7. Supporting visual details

- **Paper grain**: very subtle SVG noise overlay, 2% opacity, across the entire app. Takes `#FAFAF7` from "flat color" to "real paper".
- **Ruled lines** (optional, faint): barely-visible horizontal rules at 24px intervals on certain screens (the workout log especially), 3% opacity rule color. Hint of notebook.
- **Hairline borders**: 1px `--rule` for all dividers. Full-bleed across the screen, not contained to cards.
- **Corner radius cap: 4px.** Most things 0 or 2px. No rounded cards, no pill buttons.
- **No shadows.** Elevation expressed through hairlines, whitespace, and registration marks — not drop shadows.
- **No gradients, no glass, no blur.** Flat, printed, honest.
- **Button style**: rectangular. Primary = ink fill, paper text, wide-tracked mono. Secondary = paper fill, ink border, same typography.

## 8. Content architecture — three modes

Same core UI, different defaults per mode.

| Mode | Content | Default rest | Rep range | Surfaces |
|---|---|---|---|---|
| **Lift** | Barbell / dumbbell / machines | 120s | 5–12 | Plate calculator, 1RM progressions |
| **Bar** | Pull-up bar, dip station, park | 90s | 5–15 or AMRAP | Skill tree (muscle-up, levers) |
| **Floor** | Pure bodyweight, anywhere | 60s | 8–20 | Time-under-tension, skills |

Selecting a mode at session start is two taps: `New session → Lift / Bar / Floor`.

## 9. Three signature features

### 9.1 The Skill Tree
Full-screen visual dependency graph of strength milestones and calisthenics skills. The hero feature.

- **Strength nodes**: Bench 1×BW → 1.25×BW → 1.5×BW → 2×BW. Squat, Deadlift, OHP, Pull-up count.
- **Skill nodes**: Push-up → Diamond → Archer → One-arm. Handstand → HSPU → Planche. Pull-up → Muscle-up → Front Lever.
- **Hybrid unlocks**: Muscle-up requires `pull-up 3×8 ✓` AND `dip 3×10 ✓`. Real prereqs based on your logged data.
- **States**: locked (rule color), in-progress (ash with tangerine fill bar), unlocked (ink outline), mastered (tangerine stamp overlay).
- **Tap a locked node** → modal shows prereqs, % completed on each, estimated sessions to unlock.

**Why this is the hook:** every set has a *narrative* — "this bench is getting me to 2×BW, 3 weeks away" / "these dips are 40% of the way to muscle-up." Turns grind into a map. No other fitness app does this as its core loop.

### 9.2 The Rack — plate calculator with gym memory
When you enter a target weight, the screen renders an actual barbell with plates in the typical color convention. Tap the bar to cycle bar weight (20 / 15 / 7 kg). Tap a plate to remove.

**Memory:** learns your gym's inventory. No 1.25 kg plates in your gym? The app never suggests 102.5 kg — rounds to achievable loads and shows why. Every lifter needs this, no app handles it well.

### 9.3 Receipts, not dashboards
Every completed workout generates a **receipt** — long, narrow, monospaced, looks like a specimen printout or a supplement-shop receipt. Date · exercises · sets · volume totals · PRs flagged with `★` stamps · skill-tree delta since last session · perforated bottom edge.

Shareable as PNG. Screenshot-worthy. People post dashboards once; people post receipts weekly.

```
⊕                                    ⊕
     ATHLETIC INDEX
     Sunday · 19.04.26
     PUSH · 01:12:33
─────────────────────────────────────
  01   BENCH PRESS
         8 × 80kg    RPE 7
         8 × 85kg    RPE 8
         6 × 90kg    RPE 9   [★ PR · 19.04.26]
  02   INCLINE DB PRESS
        10 × 28kg    RPE 7
        10 × 28kg    RPE 8
         8 × 28kg    RPE 9
  03   CABLE FLYES
        12 × 15kg    RPE 7
        12 × 15kg    RPE 8
        10 × 15kg    RPE 9
─────────────────────────────────────
     TOTAL        12,420 kg
     WEEK PRIOR   +4.1 %
     TREE ▸ muscle-up  +3 %
─────────────────────────────────────
⊕                                    ⊕
 ╌ ╌ ╌ ╌ ╌ ╌ ╌ ╌ ╌ ╌ ╌ ╌ ╌ ╌ ╌ ╌ ╌  ← perforation
```

## 10. Level support

One app, both beginner and advanced — gated through the **Skill Tree**.

- **Onboarding (30s):** 5 yes/no questions — clean pull-up, push-up, dip, bench-your-bodyweight, squat-1.5×BW. Answers determine which nodes are already unlocked. No "beginner mode" toggle.
- **Beginners:** tree shows the next 2–3 achievable nodes prominently, grays advanced branches.
- **Advanced:** tree mostly unlocked, end-game nodes remain as targets.

The tree *is* the level system.

## 11. Signature interactions — the moments that define the feel

| Moment | What happens |
|---|---|
| **App open** | No splash. Content appears, ticker tape starts scrolling. The app trusts you. |
| **Start session** | Page turns — a subtle white-to-white fade with the Fraunces title sliding up 8px and settling. One haptic tick. |
| **Set complete** | The set row receives a small `✓` stamp in ash on the left margin, the number subtly fades from ink to ash-80%. One sharp haptic. No animation fanfare. |
| **PR hit** | The passport stamp drops from above, rotates into place at ~7°, settles with a deep haptic thump. Stays on the row forever after — it's a historical mark, not a notification. |
| **Rest timer** | Takes over the top 40% of the screen. `01:58` in Geist Mono at 140px, ink on paper, hairline rule beneath, `rest` label in ash below. Last 10 seconds: tiny tick per second. Final second: deep thump, timer collapses. |
| **Failed set** (below target) | Number typesets slightly smaller (down one step in scale), silent. Next set's suggested weight auto-adjusts down. No warning, no sad face. |
| **Session complete** | Screen fades to paper. Receipt rolls up from the bottom of the viewport — not a modal, a full-page scroll. PR stamps animate in one at a time, 200ms stagger. One long haptic at the end. |
| **Skill unlock** | Rare. Full-screen takeover: the skill name in display-xxl Fraunces, ink on paper, with a tangerine hand-drawn circle around the word. The word `UNLOCKED` in tiny uppercase Geist Mono below. 2 seconds. Deep thump. |

## 12. Wireframes — text sketches

### Dashboard

```
┌─────────────────────────────────────────────┐
│  ★ BENCH 92.5 · ★ PULL-UP ×12 · 04 sessions │ ← ticker, 16px mono ash
├─────────────────────────────────────────────┤
│                                             │
│  Sun · 19.04.26          ← mono ash 11px    │
│                                             │
│  Push.                   ← Fraunces 72px ink│
│                                             │
│  ─────────────────────────────── (hairline) │
│                                             │
│  ⊕                                        ⊕ │
│  ┌                                        ┐ │
│                                              │
│     THIS WEEK            ← label ash 11px   │
│                                              │
│     04                   ← Fraunces 180px    │
│     sessions             ← serif body ash    │
│                                              │
│     ╱────────╲                               │
│    │ 46,200 kg│          ← ink number       │
│     ╲────────╱           ← tangerine hand-  │
│                            drawn circle     │
│     +4.1 % vs last       ← mono ash 11px    │
│                                              │
│  └                                        ┘ │
│  ⊕                                        ⊕ │
│                                             │
│  ─────────────────────────────              │
│                                             │
│  01  SKILL TREE          ← index + title    │
│      Next ▸ Muscle-up                       │
│      ████████████░░░░░░  67%                │ ← tangerine bar
│                                             │
│  02  Bench 2×BW                             │
│      ██████░░░░░░░░░░░░  22%                │
│                                             │
│  ─────────────────────────────              │
│                                             │
│   ┌─────────────────────────────────────┐   │
│   │         START SESSION               │   │ ← ink fill, paper text,
│   └─────────────────────────────────────┘   │   mono wide-tracked, 56px
│                                             │
└─────────────────────────────────────────────┘
         ↓ fixed bottom nav — 4 icons, no labels, hairline border-top
    [ ◻ tree ]   [ ≡ log ]   [ ▶ start ]   [ ⚙ ]
```

### Active Workout

```
┌─────────────────────────────────────────────┐
│  00:47:12                 ← session clock,  │
│                             mono ash 11px   │
│                                             │
│  01 · BENCH PRESS           3 / 5           │ ← index · label · counter
│                                             │
│  ─────────────────────────────              │
│                                             │
│                                             │
│      90                      ← Fraunces     │
│      kg                        240px ink    │
│                              ← ash 24px     │
│      × 6                     ← Fraunces 120 │
│                              ← reps ash 24px│
│                                             │
│      RPE 8                   ← mono tanger. │
│                                20px         │
│                                             │
│  ─────────────────────────────              │
│                                             │
│   01  80 × 8   RPE 7   ✓                    │ ← completed: ash + ✓ stamp
│   02  85 × 8   RPE 8   ✓                    │
│   03  90 × 6   RPE 9   ▸ [★ PR · 19.04.26]  │ ← active: ink + stamp if PR
│   04  90 × 6                                │ ← future: rule color
│   05  90 × ?                                │
│                                             │
│  ─────────────────────────────              │
│                                             │
│     THE RACK                                │
│                                             │
│     ▓▓▓▒▒▒▒ ═══════════════ ▒▒▒▒▓▓▓        │ ← live plate render
│     20 + 2×(20+10+2.5) = 90 kg              │ ← mono ash
│                                             │
│  ─────────────────────────────              │
│                                             │
│  [ LOG SET ]              [ SKIP ]          │ ← ink fill / paper+border
│                                             │
└─────────────────────────────────────────────┘
```

When rest timer kicks in:

```
  ┌────────────────────────────────┐
  │                                │
  │                                │
  │           01:58                │ ← Geist Mono 140px ink
  │                                │
  │           REST                 │ ← label 11px ash uppercase
  │                                │
  │  ─────────────────             │ ← hairline
  │                                │
  │    [ skip ]   [ +30s ]         │
  │                                │
  └────────────────────────────────┘
```

## 13. Execution roadmap

### Phase 1 — Identity (visible shift, ~1 day)
1. Rewrite `src/styles/tokens.css`: paper/rule/ash/ink/tangerine palette. Delete all theme variants (deepCosmos, fireEnergy, etc.).
2. Swap Outfit for **Fraunces** (display), **Geist Sans**, **Geist Mono**, **Noto Serif Hebrew**, **Heebo**. Update Tailwind `fontFamily`.
3. Paper-grain overlay component, mounted at app root.
4. Create primitive components: `<RegistrationMarks />`, `<Hairline />`, `<IndexNumber />`, `<Ticker />`, `<PerforatedEdge />`.
5. Rewrite `.card`, `.btn-primary`, `.btn-secondary` utilities: 4px radius cap, 1px rule borders, no shadows, ink-on-paper.
6. Kill emoji from every string. Kill `"בוקר טוב"` greeting and all cheerleading copy. Kill 5 theme variants from Settings.

### Phase 2 — Dashboard rewrite (~1 day)
7. Dashboard redesign per §12 wireframe — voice, typography scale, registration marks, ticker tape, hand-drawn circle primitive.

### Phase 3 — Active Workout rewrite (~1–2 days)
8. Active Workout redesign per §12 wireframe — hero number at 240px, tabular mono specs.
9. Rest timer — full-takeover style, mono 140px.
10. PR passport-stamp component — SVG with rotation + ink-turbulence filter + haptic.
11. Set completion — margin `✓` stamp, number fades to ash.

### Phase 4 — Signature features (~4–7 days)
12. **Receipt** component — new `/session/:id/receipt` route. Perforated SVG bottom edge. html2canvas PNG export.
13. **The Rack** — live plate calculator with gym-memory.
14. **Skill Tree** — new route `/tree`. Zoomable dependency graph. The biggest feature.
15. **Mode switcher** (Lift / Bar / Floor) on session start.

### Phase 5 — Polish (non-blocking)
16. Custom SVG icon set replacing lucide where it matters (hero surfaces first).
17. Hand-drawn underline/arrow/circle SVG pack — used sparingly.
18. Ticker tape pause-on-tap, auto-populate from recent PRs.
19. Skill-unlock full-page takeover with hand-drawn circle animation.

### Kept as-is (do not touch)
- `workoutDb.ts`, `analyticsService.ts`, `prService.ts` — solid, invisible.
- Supabase sync — keep.
- `useFitnessInsights` and data hooks — reuse.
- Settings page → simplify (remove 5 themes, keep cloud sync + export).

### Explicitly killed
- All 5 theme variants (deepCosmos, fireEnergy, neonPulse, oceanWave, forestGrove).
- AICoach in current form — comes back later as a typed note inside the receipt, not a chat UI.
- Every emoji in user-facing strings.
- Every "כל הכבוד" / "בוקר טוב" / cheerleading copy.
- Lucide `Dumbbell` as hero icon — replaced with typography (the number *is* the icon).
- Drop shadows, gradients, glass-blur, rounded pills.

## 14. Open calls — veto anything

1. **Name: "Athletic Index"** (placeholder). Alternatives: *Index*, *Specimen*, *Catalog*, or keep *SparkOS*. Doesn't block Phase 1.
2. **Tangerine `#FF5B1F` as the only accent.** Used rarely and intentionally. If it feels too loud in practice, we tune saturation down to `#E85518`.
3. **Fraunces** as the display face. If unavailable via Google Fonts for Hebrew sessions, we serve Latin-only where needed.
4. **No emoji anywhere.** Confirmed.
5. **No voice / no TTS / no music / no sound effects.** Haptics only.
6. **Off-white paper (`#FAFAF7`) only — no dark mode for v1.** Dark mode can come later as a "night" theme, but light-first is the identity.
7. **Hebrew + English mixed freely** in UI copy (`Push · יום דחיפה`). Not forced — but allowed.

---

**Status:** waiting for `go` to execute Phase 1 (tokens, typography, primitives, kill themes/emojis).

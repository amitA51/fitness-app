# VISION — Muji Studio (alternative 03)

> Concept: training as craft. Preview: `design-preview-muji.html`.

## Soul
A training app as warm and quiet as a **potter's workshop at dawn**. Cream paper, clay-colored marks, hemp cord dividers. Slow serif typography. Space between reps to breathe. A zen counterweight to the noise of every other fitness app.

## DNA — 5 words
**Warm · Patient · Handmade · Quiet · Crafted**

## Palette
| Token | Hex | Role |
|---|---|---|
| `--cream` | `#F2EDE4` | warm paper background |
| `--cord` | `#D4CAB5` | hemp-colored dividers, borders |
| `--ash` | `#8B8680` | secondary text, dots |
| `--ink` | `#2B2B2B` | primary text (softer than pure black) |
| `--clay` | `#B85A2C` | terracotta accent — PRs, active state |
| `--sage` | `#8A9C72` | secondary accent — completion, rest-complete |

Two accents, both muted earth tones. Nothing saturated. The palette feels like a still-life painting.

## Typography
- **Display:** `Instrument Serif` 400 roman + italic — delicate, Japanese-influenced classical serif
- **Body:** `Work Sans` 300 — light, friendly, breathable
- **Data / mono:** `JetBrains Mono` 400 — slightly quirky mono for character
- **Hebrew:** `Heebo` 300 — matches the lightness of Work Sans

## Five signature elements

1. **Ensō circles** — brush-stroke zen circles drawn with SVG (slight imperfection, pen-stroke feel) around hero numbers. Clay-colored. Each one slightly different.
2. **Dot progress indicators** — 7–10 small circles, filled clay-colored for achieved, cord-colored for remaining. No rectangular bars.
3. **Cord dividers with marks** — thin hemp-tone horizontal lines with a small centered circle (`○`) where a page break might have a typographic ornament
4. **Italic serif accents** — words like *day*, *push*, *complete* set in italic clay color to pull eyes gently — never bold shouting
5. **Generous breath space** — large vertical padding, `line-height 1.7`, small text so the user never feels rushed. The whitespace is the feature.

## Voice
Calm. Observational. Gentle but not condescending.
- ✅ `Set three complete. Pause. Then begin again.`
- ❌ `Crushed it! Keep going!`

Hebrew: `סט שלוש הושלם. נשום. ואז — שוב.`

## Wireframe (dashboard, text)

```
  ──── · ────
  Sunday · 19 April 2026

         Push day.
       — week sixteen —

         ╭─────╮
        /       \
        |   04   |   ← ensō circle
        \       /
         ╰─────╯
        sessions · this week

  ──── ○ ────

      46,200 kg       +4.1 %
    volume total   vs last week

  ──── ○ ────

  — next skills —

  Muscle-up  · 67%   ● ● ● ● ● ● ● ○ ○ ○
  Bench 2×BW · 22%   ● ● ○ ○ ○ ○ ○ ○ ○ ○
  Handstand  · 40%   ● ● ● ● ○ ○ ○ ○ ○ ○

  [ Begin session ]   ← ink fill, cream text, rounded 4px
```

## Trade-offs vs Athletic Index
**Gains:** warmer, softer, more "wellness", much calmer. Unique in fitness space — nobody does this.
**Loses:** less "performance", less "athletic". Might feel slow if you're a high-intensity trainer. The zen aesthetic can read as "too chill" for heavy lifting.

## Best for
Someone who values the ritual of training over the numbers. Someone burned out on Strava-style metrics anxiety. Someone who wants their fitness app to feel like Muji, not like a stopwatch.

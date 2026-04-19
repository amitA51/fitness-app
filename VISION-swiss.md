# VISION — Swiss Lab (alternative 02)

> Concept: training as science. Preview: `design-preview-swiss.html`.

## Soul
A training app designed as a **scientific laboratory notebook**. Your body is the experiment. Every rep is a sample. Every session is a recorded observation. The app is the chart recorder.

## DNA — 5 words
**Precise · Measured · Quiet · Clinical · Gridded**

## Palette
| Token | Hex | Role |
|---|---|---|
| `--white` | `#FFFFFF` | true white, clinical background |
| `--grid` | `#EAEAEA` | visible gridlines, borders |
| `--ash` | `#737373` | secondary text |
| `--ink` | `#0A0A0A` | primary text, data |
| `--live` | `#DC1F27` | **critical only** — active session, recording, alerts |

One accent, used rarely. Red is never "celebration" — it's "live" or "warning". Treat like a lab safety lamp.

## Typography
- **Display:** `Instrument Sans` 700 — Swiss grotesque, free, uncommon
- **Body:** `Inter` 400/500
- **Data / specs:** `IBM Plex Mono` 400/500 — everywhere numbers appear
- **Hebrew:** `Assistant` 400/700

## Five signature elements

1. **Visible 12-column grid** — faint (4% opacity) gridlines on all main screens, treating layout as a visible infrastructure, not hidden scaffolding
2. **Sample ID references** — every section gets `§01.A`, `§01.B`, `§02.C` labels, like references in a scientific paper
3. **Tick-mark gauges** — progress bars as instrument readouts with labeled tick marks (every 2 units a taller tick)
4. **Pulsing red "live" dot** — tiny 8px red circle with soft pulse for active/recording states
5. **SMALL-CAPS metadata strips** — `SAMPLE · 003 · PUSH · REC 00:47:12` across tops of screens

## Voice
Scientific. Timestamped. No emotion.
- ✅ `Set 03 recorded. Next target: 90 kg × 6.`
- ❌ `Great job! Keep it up!`

Hebrew: `דגימה 03 הוקלטה. יעד הבא: 90 ק״ג × 6.`

## Wireframe (dashboard, text)

```
┌─────────────────────────────────────┐
│ SAMPLE 003 · SUN 19.04    • ACTIVE │ ← meta + live dot
│ Push.                              │ ← big display
│ WEEK 16 · SPLIT A                  │
│ ─────────────────────────────────── │
│ §01.A · SESSIONS THIS WEEK         │
│ ┌─────────────────────────────────┐│
│ │    04  / 06 target              ││ ← mono value
│ │    │ ┃ │ ┃ │ │ ┃ ╴ ╴ ┃ ╴ ╴ ┃   ││ ← tick gauge
│ │    0  2  4  6                   ││
│ └─────────────────────────────────┘│
│ §01.B · VOLUME DELTA               │
│ ┌─────────────────────────────────┐│
│ │    +4.1 %                       ││
│ │    46,200 kg · vs 44,380 prior  ││
│ └─────────────────────────────────┘│
│ §02 · SKILL PROGRESSION            │
│ 002.A  Muscle-up         67 %     │
│ 002.B  Bench 2×BW        22 %     │
│ 002.C  Free handstand    40 %     │
│                                    │
│ [ • RECORD NEXT SAMPLE ]           │ ← ink fill, red dot
└─────────────────────────────────────┘
```

## Trade-offs vs Athletic Index
**Gains:** more clinical, more data-forward, less "literary". Feels like a measurement tool.
**Loses:** less warmth, less personality in the voice. More sterile — which is the point but may feel cold.

## Best for
Someone who trusts data over vibes. Someone who likes spreadsheets. Someone who wants the app to disappear into the task.

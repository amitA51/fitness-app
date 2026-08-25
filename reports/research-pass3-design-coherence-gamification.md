# Research Pass #3 — design / coherence / convenience / gamification (You.com, Aug 2026)

Scope per Amit: "עזוב את התזונה — עיצוב, קוהרנטיות, נוחות, גימיפקציה מעניינת, יפה לעין. סגנון Apple, בלי פשרות."

## Queries run (api.you.com/v1/search)
1. Hevy Strong Fitbod visual design breakdown why UI feels premium
2. what makes Apple Fitness design feel premium (motion/depth/materials/type)
3. fitness app home dashboard patterns progress rings activity cards
4. mobile app design consistency spacing rhythm iconography tokens
5. fitness gamification delight micro-interactions XP levels badges what works
6. workout app convenience quick-log friction-reduction UX
7. Hevy app review 2025 design UX
8. Strong workout tracker design review

## Findings that mapped to ACTION
- **Apple rings / dashboards**: progression must be ALWAYS visible — "simple enough to read
  at a glance, specific enough to feel earned once closed" (madappgang/designyourway).
- **7 tiny UI fixes (Muz.li)**: premium = discipline — spacing scale ≤5 steps,
  ≤5 font sizes, ONE accent color, uniform radii, fewer borders, alignment grid.
- **Gamification inverted-U (Frontiers 2025 via razfit/yukaichou)**: MODERATE feature
  count wins; over-loading points+badges+boards+streaks reduces activity.
- **Strong/Hevy verdicts (sensai.fit, DesignRush)**: precise logging + rest timer +
  PRs = the core loop; "removes all friction from the core loop".

## Gaps found in repo → SHIPPED (commit d6dd85c)
- XP existed only inside WorkoutSummary → **LevelCard** on Progress/Overview +
  ambient ⚡level chip on DashboardHeader (both hidden until first XP).
- Three local muscle maps drifting from SSOT → unified into constants/muscleNames.ts
  (ליבה→בטן, ירך קדמית→ארבע ראשי, שוקיים→תאומים); built-in template double-tag fixed.
- Mono font on Hebrew labels (ForecastNudge, QuickExerciseForm) → body font.

## Already covered (audit-before-build confirmed, do NOT rebuild)
Rest timer auto-start, ghost values, plate calculator, RPE, SlideToComplete,
streak milestones, perfect-week fill, session XP formula, XP persistence+ladder,
FirstRunHero, recommended-path demotion, overload nudge pill.

## Verification
tsc clean · biome clean · vitest 1320/1320 · build OK · vision QA light+dark PASS
(e2e/level-qa.spec.ts: seeds gamification_xp_total=1240 → level 5, plus one completed
IndexedDB session so populated Progress renders). Pushed master `d6dd85c`.

## Open candidates (next pass, unranked)
- Weekly volume chart could gain an Apple-style summary arc (research signal only).
- Convenience pass never ran as its own sweep (one-hand reach audit of workout screen).

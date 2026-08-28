# HOME SCREEN AUDIT — read-only fact base for the redesign

Scope: `src/pages/Dashboard.tsx` and everything it renders. Read-only audit, no
production code touched. Every claim below is traced to `file:line` in the tree
as of this audit. Nothing here was verified in a browser — no dev server, no
Playwright (another worker owns port 4173). Findings are from reading the code
and the data path, not from a running app.

**Headline: 9 PLACEHOLDER findings.** The single most misleading element on the
screen is the מוכנות (readiness) hero number in `CoachBriefCard`. For a user with
no recovery log and no logged RPE — the default state of this app — the score is
the constant `100 − 8 = 92`, and it is printed next to the badge **"העלו עומס"**.
A first-time lifter with one workout and a four-year veteran training 4×/week both
see `92/100`.

---

## 1. Card inventory, in render order

Two mutually exclusive bodies hang off one gate: `hasAnySession`
(`Dashboard.tsx:146` — at least one session with `status === 'completed'`).

### Always in the tree

| # | Card | File | What the user sees | Renders when |
|---|------|------|--------------------|--------------|
| 1 | Pull-to-refresh ring | `Dashboard.tsx:358-403` | Spinner arc that fills as you drag | `pullDistance > 0` |
| 2 | `DashboardHeader` | `src/components/dashboard/DashboardHeader.tsx` | Date + "פעיל היום" chip, greeting + name, one-line instruction, XP level chip, settings gear | **Always.** Level chip only when `getTotalXp() > 0` (`DashboardHeader.tsx:38-42`) |
| 3 | Primary start CTA | `Dashboard.tsx:412-467` | Big mint button "התחל אימון" / "אימון נוסף" + play glyph | `!showFirstRunHero` (`Dashboard.tsx:151`) |
| 4 | `CoachMark` hint | `Dashboard.tsx:471-474` | Dismissible tip explaining the CTA | `hasAnySession` and hint not yet dismissed |
| 5 | `TodaysWorkoutCard` | `src/components/dashboard/TodaysWorkoutCard.tsx` | "האימון של היום" + coach-scheduled rows with התחל/דילוג | Signed in **and** ≥1 row scheduled today; `null` for guests, on error, and when empty (`TodaysWorkoutCard.tsx:257-261`) |
| 6 | `StartWorkoutSheet` | `src/components/dashboard/StartWorkoutSheet.tsx` | Bottom sheet: continue last / pick template / empty | `isStartSheetOpen`. **Auto-opens 600 ms after landing for a zero-session user** (`Dashboard.tsx:155-161`) |

### Branch A — zero completed sessions

| # | Card | File | What the user sees | Renders when |
|---|------|------|--------------------|--------------|
| 7 | `DashboardSkeleton` | `Dashboard.tsx` (local) | Rings-shaped shimmer + streak bar + 3 rows | First mount-load only (`Dashboard.tsx:149`) |
| 8 | `InsightErrorChip` | `Dashboard.tsx` (local) | Warning row + "נסו שוב" | `insightsError && !hasAnySession` |
| 9 | `FirstRunHero` | `Dashboard.tsx` (local) | "מה עושים עכשיו?" + 3 numbered steps + 2 buttons + coach-code link | `!hasAnySession` |

### Branch B — `renderPopulatedBody()` (`Dashboard.tsx:504-624`)

| # | Card | File | What the user sees | Renders when |
|---|------|------|--------------------|--------------|
| 10 | Weekly rings + bento legend | `Dashboard.tsx:510-571` + `charts/ActivityRings.tsx` | 3 concentric rings (אימונים / נפח / דקות) + 3 count-up legend rows + WoW chip | `weekData.workoutsThisWeek > 0 \|\| weekData.volume > 0` (`Dashboard.tsx:510`) |
| 11 | `CoachBriefCard` (compact, weekly-review) | `Dashboard.tsx:569` | One verdict sentence + "חישוב מתמטי · ביטחון…" caption, nested inside card 10 | Inside card 10; `sessions.length > 0` (`CoachBriefCard.tsx:118`) |
| 12 | `CoachBriefCard` (daily-readiness) | `Dashboard.tsx:576` | **"מוכנות NN/100"** hero + recommendation badge + verdict + source caption | `sessions.length > 0` |
| 13 | `ProgramCard` | `src/components/dashboard/ProgramCard.tsx` | 12-week program: not-started invite / active week+day+% / completed line | **Always** in this branch (has a loading skeleton, `ProgramCard.tsx:130-152`) |
| 14 | `WorkoutStreak` | `src/components/dashboard/WorkoutStreak.tsx` | Big accent number + "ימים ברצף" + "היום" chip + "שיא N" | `streak.current > 0` (`WorkoutStreak.tsx:57`) |
| 15 | `StreakMilestone` | `src/components/dashboard/StreakMilestone.tsx` | One-shot flame celebration at 7/30/100 days | Crossed an uncelebrated milestone **and** `activeToday` **and** not reduced-motion; self-dismisses after 4200 ms (`StreakMilestone.tsx:79`) |
| 16 | Templates strip | `Dashboard.tsx:584-594` + `TemplateQuickStart.tsx` | "תבניות" heading + horizontal chips (max 5 + `+N`) | `sortedTemplates.length > 0`; error variant when `templatesError` |
| 17 | `WeeklyGrid` | `src/components/dashboard/WeeklyGrid.tsx` | "יומן אימונים": week nav, **weekProgress % ring**, 7 day cells, rest-day hint | Always in this branch |
| 18 | `InsightCard` | `src/components/dashboard/InsightCard.tsx` | One "תובנה" line (progression / neglected / consistency / balanced) | `dashboardInsight !== null` (`insightPicker.ts:76`) |
| 19 | `FindCoachCard` | `Dashboard.tsx` (local) | "התחברות למאמן" row | Confirmed signed-in non-coach with zero active coaches |

### Named in the brief but NOT on this screen

`Greeting.tsx`, `ForecastNudge.tsx`, `RecentPRBanner.tsx` are defined but imported
by nothing. Verified by search across `src/**/*.tsx`. They are dead code, not
home-screen surfaces. Treat them as deleted for redesign purposes.

---

## 2. Data provenance, per card

Legend: **REAL** = computed from the user's logged workouts/sets ·
**DERIVED** = real data through a heuristic/threshold · **PLACEHOLDER** = a
constant, mock, or default that still shows with little or no history.

### The upstream constraint that colours everything below

`DataContext` loads **only the 20 most recent sessions**
(`src/contexts/DataContext.tsx:25,65` → `services/sessionDb.ts:72`, reverse cursor
on `startTime`). `Dashboard.tsx:81,90` feeds that array into every calculation on
the screen. Consequences:

- The 28-day chronic baseline in `trainingLoadService` can be silently truncated
  for a 5-6×/week lifter (~24 sessions/month), understating chronic load and
  inflating the acute:chronic ratio → a **false load spike** on the readiness card.
- `WorkoutStreak`'s "שיא N" is labelled as an all-time best but is the best within
  the last 20 sessions only.
- Paging `WeeklyGrid` back past those 20 sessions shows empty days that read as
  "you didn't train", not "not loaded".

### Card 2 — `DashboardHeader`

| Element | Class | Source |
|---|---|---|
| Date `todayFull` | REAL | `new Date().toLocaleDateString('he-IL', …)`, `DashboardHeader.tsx:24-32` |
| Greeting text | DERIVED | `utils/dateUtils.ts:57-64` — hour cuts at 5 / 12 / 17 / 21 |
| User name | REAL | `localStorage['user_profile']` via `parseUserProfile`, `DashboardHeader.tsx:19-22` |
| "פעיל היום" chip | **DERIVED — and wrong** | `hasSessionToday`, `Dashboard.tsx:267-279`. Iterates `workoutSessions`, **not** `completedSessions`. An abandoned/in-progress session today flips the chip on and relabels the CTA to "אימון נוסף" |
| Level chip `N` | DERIVED | `getTotalXp()` (`utils/xpStore.ts:22-24`, localStorage only, never cloud-synced) → `levelFromXp` with the ladder `T(n) = 50·n·(n−1)` (`utils/workoutLevels.ts:17-19`). Read once in a mount `useMemo`, so it does not update within a session |

### Card 10 — weekly rings + bento legend

| Element | Class | Source |
|---|---|---|
| אימונים value | REAL | `weekSessions.length` over the calendar week, `Dashboard.tsx:209-253` |
| נפח value | REAL | `Σ session.totalVolume`, `Dashboard.tsx:230` |
| דקות value | REAL | `Σ session.duration / 60`, `Dashboard.tsx:239-241` |
| Ring goal (אימונים) | DERIVED → **PLACEHOLDER** below threshold | `deriveRingGoals`, `components/dashboard/ringGoals.ts:43-81`. Trailing `BASELINE_WEEKS = 4` (`ringGoals.ts:11`), needs `MIN_BASELINE_WEEKS = 2` active weeks (`:13`), clamped `WORKOUT_GOAL_MIN 3 … MAX 6` (`:15-16`) |
| Ring goals when history is thin | **PLACEHOLDER** | `ringGoals.ts:67-72` returns `DEFAULT_WEEKLY_WORKOUT_GOAL = 4`, `DEFAULT_WEEKLY_VOLUME_GOAL = 8000`, `DEFAULT_WEEKLY_MINUTES_GOAL = 240` (`:7-9`). Nobody set these. They are presented as "your goal" |
| נפח / דקות ring **arc** | **PLACEHOLDER** | `Dashboard.tsx:316,322` — `max: Math.max(actual, goal)`. Once the user is above baseline, `value === max`, so the arc is definitionally 100% full (`ActivityRings.tsx:40-45`). The ring cannot convey anything |
| WoW chip | DERIVED | `volDeltaChip`, `Dashboard.tsx:286-301`; flat band `FLAT_DELTA_PCT = 0.5` (`:60`). Three honest states — this one is well built. (Code/comment drift: the comment at `:283` promises "שבוע ראשון", the code emits "אין השוואה" at `:290`.) |

### Cards 11 & 12 — `CoachBriefCard` (see §3 for the full readiness path)

| Element | Class | Source |
|---|---|---|
| מוכנות NN/100 | **DERIVED with a PLACEHOLDER core** | `facts.readinessScore` ← `buildCoachFacts` (`services/ai/coachBrief.ts:110-113`) → `buildContext` (`services/ai/contextBuilder.ts`) → `calculateTrainingLoad` (`services/trainingLoadService.ts:349`) |
| Recommendation badge | DERIVED | `recommendationFromFatigue`, `services/intelligence/scoringThresholds.ts:41-46`; bands `REST 75 / DELOAD 55 / MAINTAIN 35` (`:33-39`); Hebrew labels `CoachBriefCard.tsx:43-51` |
| נפח שבועי (weekly card) | REAL | `trainingLoad.weeklyVolume` from completed working sets, `trainingLoadService.ts:315` |
| Volume Δ% | DERIVED | `trainingLoadService.ts:320-326`. **No prior week ⇒ hardcoded `100`** (`:325`), so a first-ever week reads "+100%" |
| Verdict prose | DERIVED, or AI-phrased | `deterministicProse` (`coachBrief.ts:119-166`) is the pre-resolve and failure path; an LLM may replace the text only, never the numbers (`coachBrief.ts:186-238`) |
| "ביטחון נמוך/בינוני" | DERIVED | `deriveConfidence`, `coachBrief.ts:79-85`. Reaching `high` needs RPE **and** a recovery log **and** a 3-week baseline **and** `profileCompleteness ≥ 0.5`. For a normal user this caption is effectively pinned at נמוך |
| שרירים חלשים | DERIVED | `contextBuilder.ts` weak-muscle pass, threshold `WEAK_MUSCLE_THRESHOLD = 0.75` (`services/ai/constants.ts:12`), over the last **10** sessions only |
| מוזנחים | DERIVED | `status === 'neglected'` ⇔ `daysSinceLastTrained >= 7`, `trainingLoadService.ts:250-256` |

### Card 13 — `ProgramCard`

| Element | Class | Source |
|---|---|---|
| Week / day / block | REAL | `getProgress()` from `localStorage['bbt_program_progress_v1']`, `services/programProgressService.ts:60-69` |
| `completedCount / totalDays`, `pct` | REAL | `ProgramCard.tsx:72-85`; `totalDays = 12 × 5 = 60` from `BBT_PROGRAM_METADATA.totalWeeks` and `TRAINING_DAYS` (`data/bbtProgramMetadata.ts:15,46`) |
| `exerciseCount`, `dayHe`, `blockHe` | DERIVED (static catalog) | `data/bbtProgramMetadata.ts:48-61` — fixed metadata, not user data |
| **"12 שבועות · 5 אימונים בשבוע"** | **PLACEHOLDER** | `ProgramCard.tsx:251` — the `5` is a hardcoded literal in the copy while `TRAINING_DAYS.length` is available in the same file |

### Card 14 — `WorkoutStreak`

| Element | Class | Source |
|---|---|---|
| current / best / activeToday | REAL | `useWorkoutStreak` (`src/hooks/useWorkoutStreak.ts:52-84`) → `computeStreakWithRests` (`src/utils/restDays.ts:117-198`). Completed sessions only; declared rest days bridge gaps without incrementing |
| "שיא N" label | DERIVED, mislabelled | Same math, but only over the ≤20 loaded sessions (see the DataContext note) |

Divergence worth naming: `insightsAggregator.computeStreak`
(`src/hooks/fitness/insightsAggregator.ts:238-306`) builds its date set from **all**
sessions regardless of status and ignores rest days, so the `currentStreak` inside
`useFitnessInsights` is a *different number* from the one `WorkoutStreak` displays.
It happens to be harmless today only because `insightPicker` never reads it.

### Card 15 — `StreakMilestone`

| Element | Class | Source |
|---|---|---|
| Milestone trigger | DERIVED | `STREAK_MILESTONES = [7, 30, 100]`, `StreakMilestone.tsx:27`; one-shot ledger in `localStorage['streak_milestones_seen']` (`:24`) |
| Celebration copy | Static | `milestoneLabel`, `StreakMilestone.tsx:~200` |
| Day count shown | REAL | Same `useWorkoutStreak` as card 14 |

### Card 16 — templates strip

| Element | Class | Source |
|---|---|---|
| Template names | REAL (but seeded) | `getWorkoutTemplates()` (`services/templateDb.ts:29-35`). Note `initializeBuiltInWorkoutTemplates` seeds **5 built-in templates** on first run (`services/dataService.ts:34-70`), so these are not necessarily "the user's" templates |
| Ordering | DERIVED | favourites first, `Dashboard.tsx:178-180` |
| "המשך · X" in the sheet | REAL | newest `lastUsed`, `Dashboard.tsx:182-192` |

### Card 17 — `WeeklyGrid`

| Element | Class | Source |
|---|---|---|
| Day dots (`active`) | REAL | completed session dates, `WeeklyGrid.tsx:36-40` |
| Rest days | REAL (user-declared) | `localStorage['workout_rest_days']` via `isRestDay`, `utils/restDays.ts:82-84` |
| **weekProgress %** | **PLACEHOLDER denominator** | `WeeklyGrid.tsx:80` — `Math.round(activeCount / 7 * 100)`. A hardcoded train-every-day goal. It contradicts `ringGoals.workouts` (3-6, default 4) sitting a few hundred pixels above |
| perfectWeek | DERIVED | `activeCount === 7`, `WeeklyGrid.tsx:82` — unreachable for anyone following a sane program, and rest days do not count |

### Card 18 — `InsightCard` / `insightPicker`

| Tier | Class | Source |
|---|---|---|
| 1 progression | REAL + threshold | `MIN_PROGRESSION_PCT = 10` (`insightPicker.ts:19`), requires volume in both weeks (`:52`). Deltas from `insightsAggregator.ts:~200-230` |
| 2 neglected muscle | DERIVED | `NEGLECT_MIN_DAYS = 7`, `NEGLECT_MAX_DAYS = 30` (`insightPicker.ts:23,25`) |
| 3 consistency | **PLACEHOLDER** | `insightPicker.ts:79-81` — an always-fillable affirmation labelled "תובנה" |
| 4 balanced | DERIVED | `BALANCED_SPLIT_MIN_MUSCLES = 3` (`:27`) |
| Final fallback | **PLACEHOLDER** | `insightPicker.ts:94` — returns `consistency` with `workoutsThisMonth` even when that number is `0`, printing "0 אימונים החודש" as an insight |
| `currentStreak` input / `MIN_STREAK_DAYS = 3` | Dead | Passed in at `Dashboard.tsx:96-104`, never read in the picker body. The constant is only referenced by its own test |

Hebrew plural bug: `InsightCard.tsx:~63` renders `{n} אימונים החודש`. With `n = 1`
this prints "1 אימונים החודש" — wrong agreement. `WorkoutStreak.tsx` handles the
same case correctly ("יום ברצף" vs "ימים ברצף").

### Cards 5, 19 — coach surfaces

`TodaysWorkoutCard` rows are REAL (`services/coach/scheduleService.getTodaysScheduledWorkouts`);
`FindCoachCard` visibility is REAL (`listMyCoaches('active')`). Both fail closed to
`null`, which is the right call.

---

## 3. The readiness / מוכנות score, precisely

Path: `CoachBriefCard.tsx:88-91` → `buildCoachFacts` (`coachBrief.ts:110-113`) →
`buildContext` (`contextBuilder.ts`) → `calculateTrainingLoad`
(`trainingLoadService.ts:283-383`).

The score is one line: `readinessScore = clamp(100 − fatigueScore, 0, 100)`
(`trainingLoadService.ts:349`). And `fatigueScore` is a sum of five penalties
(`trainingLoadService.ts:337-348`):

```
recoveryPenalty   = recoveryScore !== null ? (100 - recoveryScore) * 0.45 : 8   // :337
loadSpikePenalty  = max(0, acuteChronicRatio - 1) * 35                          // :338
rpePenalty        = avgRPE !== null && avgRPE > 8 ? (avgRPE - 8) * 12 : 0        // :339
frequencyPenalty  = weeklySessions.length >= 6 ? 10 : 0                          // :340
noVolumePenalty   = weeklyVolume === 0 ? 25 : 0                                  // :341
fatigueScore      = clamp(round(sum), 0, 100)                                    // :342-348
```

### Inputs it consumes

1. Completed sessions in the trailing 7 days — volume from completed working sets
   (`trainingLoadService.ts:105-119`).
2. Sessions in `[-28d, -7d)` as the chronic baseline (`:307-311`).
3. Logged RPE per set, if any (`:121-134`).
4. The latest `RecoveryLog` (`:136-139`) — created **only** from Progress →
   Add-recovery modal (`src/pages/progress/modals/AddRecoveryModal.tsx`,
   `src/pages/Progress.tsx:158`). Never prompted from home.
5. `tightAreas` from that same recovery log, for the per-muscle view only.

### What it does with little or no history

- **No recovery log** → `recoveryPenalty` is the bare constant **`8`**
  (`:337`). Undocumented magic number, no comment justifying 8.
- **No RPE anywhere** → every session's load is multiplied by
  `DEFAULT_RPE_FACTOR = 0.7`, i.e. "assume RPE 7" (`:17`, applied at `:169-173`).
  It cancels out of the ratio, so the assumption is invisible but total.
- **No chronic baseline** → `acuteChronicRatio` is forced to **`1.0`** when
  `chronicLoad === 0 && acuteLoad > 0` (`:334`). A user in week one is declared
  perfectly load-balanced.
- **A muscle never trained** → its `recoveryScore` defaults to **`100`**
  (`:237`).
- `dataSufficiency` records all of this honestly (`contextBuilder.ts`
  `hasRpe/hasRecovery/hasChronicBaseline`), and the card does hedge the *prose*:
  `isSparse` swaps in a partial-data sentence when `confidence === 'low'`
  (`CoachBriefCard.tsx:126,138-141`). **But the comment at `CoachBriefCard.tsx:135`
  states the policy outright: "The hero score itself stays (it's a computed fact)."**
  The hedge never reaches the number.

### Can it return the same value for very different users?

**Yes. Plainly, and for most users.** Take the default state: no recovery log, no
logged RPE, fewer than 6 sessions this week, some volume this week, ratio ≤ 1.
Then every penalty except `recoveryPenalty` is zero:

```
fatigue   = 8 + 0 + 0 + 0 + 0 = 8
readiness = 100 - 8           = 92
band      = readinessBandFromFatigue(8)   -> 'high'    (scoringThresholds.ts:64-69)
rec       = recommendationFromFatigue(8)  -> 'push'    (scoringThresholds.ts:41-46)
badge     = REC_LABEL.push -> "העלו עומס"              (CoachBriefCard.tsx:44)
```

Two users who hit that identical `92 / "העלו עומס"`:

- **Beginner, one workout ever, logged today.** `baselineSessions = []` →
  `chronicLoad = 0`, `acuteLoad > 0` → ratio forced to `1.0` (`:334`) →
  `loadSpikePenalty = max(0, 1.0−1)×35 = 0`. Result: **92, "העלו עומס"** after a
  single session.
- **Veteran, 4×/week for years, steady volume.** `acute ≈ chronic` → ratio ≈ 1.0 →
  `loadSpikePenalty ≈ 0`. Result: **92, "העלו עומס"**.

The reachable range without a recovery log and without RPE is narrow:

| Situation | fatigue | מוכנות | badge |
|---|---|---|---|
| Trained this week, no spike | 8 | **92** | העלו עומס |
| No volume this week (`noVolumePenalty = 25`, `:341`) | 33 | **67** | העלו עומס (33 < `MAINTAIN` 35) |
| 6+ sessions this week | 18 | 82 | העלו עומס |
| Genuine ACWR spike, ratio 1.5 | 25.5 | 75 | העלו עומס |

Two things fall out of that table:

1. Without a recovery log the score can never exceed **92** and, for anyone who
   trained at all, never drops below **92**. It is effectively a two-valued
   function: 92 if you trained this week, 67 if you did not.
2. Reaching `deload` needs `fatigue ≥ 55`, which without RPE or recovery data
   requires `acuteChronicRatio ≥ 2.34`. **`rest` is unreachable.** So the
   recommendation is "העלו עומס" in every ordinary case — including for a user who
   has not trained in three weeks, who is shown **67/100 · העלו עומס** with the
   reason "אין נפח אימון השבוע. אפשר להעלות עומס בהדרגה"
   (`primaryConstraint = 'low_volume'`, `trainingLoadService.ts:186-195`;
   `CONSTRAINT_REASON`, `coachBrief.ts:71-77`).

The number is not fake — it is a real function of real inputs. It is that the
inputs the user actually has (workout volume) barely move it, while the inputs
that would move it (recovery log, RPE) are optional and unprompted. The score
displays the app's defaults, dressed as a personal reading.

---

## 4. Zero-state behaviour — brand-new user, zero completed workouts

`hasAnySession = false` (`Dashboard.tsx:146`) routes to `FirstRunHero` and skips
`renderPopulatedBody()` entirely. What renders:

| Card | What it shows with zero data |
|---|---|
| `DashboardHeader` | Real date, greeting, name if onboarding stored one. No level chip (`getTotalXp() === 0`). **"פעיל היום" can appear** if an abandoned session exists today (`Dashboard.tsx:272` reads all sessions) |
| Primary CTA | **Suppressed** — `showFirstRunHero` hides it (`Dashboard.tsx:412`). Correct: the hero owns the start action |
| `CoachMark` | Hidden (`hasAnySession` gate) |
| `TodaysWorkoutCard` | `null` for a self-guided user. **Renders for a coached trainee with zero history** — real coach data, so acceptable |
| `FirstRunHero` | 3 numbered steps, "בחרו תבנית מוכנה", "התחילו בלי תבנית", coach-code link. No numbers at all |
| `StartWorkoutSheet` | **Auto-opens after 600 ms** (`Dashboard.tsx:155-161`) — a modal over a screen the user has not read yet, and it covers the hero's own explanation |

**Instances of a confident number shown to a user with no data: zero on the true
zero-state.** This is the part of the screen that is honest. Every card capable of
printing a fabricated figure is gated behind `hasAnySession`.

The failure mode has moved one step later — to the **one-workout state**, which is
where every placeholder fires at once:

| Card | What one workout produces |
|---|---|
| `CoachBriefCard` daily | **"מוכנות 92/100 · העלו עומס"** — from `recoveryPenalty = 8` and a fabricated `ratio = 1.0`. Prose hedges, number does not |
| `CoachBriefCard` weekly | volume Δ **"+100%"** from the `previousWeeklyVolume === 0` branch (`trainingLoadService.ts:325`) |
| Rings | Volume measured against **8000 kg**, minutes against **240** — defaults nobody chose (`ringGoals.ts:67-72`) |
| `WeeklyGrid` | **14%** weekly progress, denominator 7 (`WeeklyGrid.tsx:80`) |
| `InsightCard` | **"1 אימונים החודש"** — placeholder tier plus a Hebrew plural error |
| `ProgramCard` | not-started invite claiming **"5 אימונים בשבוע"** (hardcoded, `ProgramCard.tsx:251`) |

One more zero-ish case: a user whose only sessions have `endTime` set but
`status !== 'completed'`. `insightsAggregator.ts:~113` counts those as workouts
while `Dashboard.tsx:139-146` does not — so `totalWorkouts > 0` while the
FirstRunHero shows.

---

## 5. Redundancy — the same fact, more than once

1. **Streak, twice, adjacent.** `WorkoutStreak` (`Dashboard.tsx:580`) prints the
   number; `StreakMilestone` (`:582`) prints the same number in a celebration
   card directly below it. Same `useWorkoutStreak` call, duplicated.
2. **"Did I train this week", three encodings, two goals.** Ring 1 + bento row
   say `N / ringGoals.workouts` (default 4); `WeeklyGrid` says `weekProgress%`
   over a denominator of 7; the day cells say it a third time as dots. The two
   denominators are irreconcilable — hitting a 4-workout goal shows a full ring
   and 57% in the grid.
3. **Weekly volume, twice in one card.** Ring 2 arc + the "נפח" bento row
   (`Dashboard.tsx:314-320`, `:546-557`). Defensible as a legend, but the arc is
   pinned at 100% (§2), so the ring adds nothing the row does not.
4. **"Today", three markers.** Header "פעיל היום" (`DashboardHeader.tsx:88-100`),
   `WorkoutStreak`'s "היום" chip (`WorkoutStreak.tsx:~160`), `WeeklyGrid`'s "היום"
   badge (`WeeklyGrid.tsx:~150`).
5. **"Your next workout", three competing sources that can disagree.**
   `TodaysWorkoutCard` "האימון של היום" (coach schedule), `ProgramCard` kicker
   "האימון הבא שלך" (BBT pointer), `StartWorkoutSheet` "המשך · X" (last-used
   template). Nothing reconciles them.
6. **Volume change %, twice.** The rings' WoW chip (`Dashboard.tsx:286-301`,
   calendar-week, `session.totalVolume`) and `CoachBriefFacts.volumeChangePercent`
   (`trainingLoadService.ts:320`, rolling 7-day, working-sets-only). **Different
   windows and different volume definitions — these two can legitimately disagree
   in sign.** The weekly card only shows it in non-compact mode, which the
   dashboard does not use, so today the collision is latent rather than visible.
7. **Templates, two paths in one block.** The strip caps at 5 with a `+N` chip and
   also carries a "כל התבניות" header action — two affordances for the same route.

---

## 6. Path to starting a workout

Set completion is **not a tap** — it is `SlideToComplete`
(`components/workout/active/WorkoutBottomBar.tsx:171-173` →
`components/workout/components/SlideToComplete.tsx:40`), a slide gesture with a
tap-and-hold shortcut. Counts below say "interaction".

| Path | Interactions to a logged set | Route |
|---|---|---|
| Templates strip chip | **2** | chip → `/workout/:id` → slide (`TemplateQuickStart.tsx:~95`). Fastest, but the strip is below the rings, readiness card, program card, streak and milestone — it needs scrolling |
| `TodaysWorkoutCard` "התחל אימון" | **2** | `TodaysWorkoutCard.tsx:~215` → `/workout/:templateId` → slide |
| Primary CTA → "המשך · X" | **3** | CTA (`Dashboard.tsx:413`) → sheet option (`StartWorkoutSheet.tsx:~150`) → slide |
| Primary CTA → "בחרו תבנית מוכנה" | **4** | CTA → sheet → `/templates` → pick → slide |
| `ProgramCard` active "המשך לתוכנית" | **3+** | button → `/program` → start day → slide |
| Primary CTA → "אימון ריק" | **≥5** | CTA → sheet → `/workout` with `startEmpty` (`Dashboard.tsx:203-207`) → `ExerciseSelector` opens (`ActiveWorkoutNew.tsx:~640`) → pick → close/confirm → slide. Exact count not traced — the selector's multi-select and the optional plan screen (`ActiveWorkoutNew.tsx:559-585`) change it |
| First-run (sheet auto-opens) | **3** | sheet already open → "בחרו תבנית מוכנה" → `/templates` → pick → slide |

A goal/warmup modal can add one or two more interactions, but it is gated on
`preWorkoutScreenShown && exercises.length > 0`
(`components/workout/active/useWorkoutEffects.ts:166-177`), which is the
empty-start path — a template launched straight from home should not hit it. Not
verified in a browser.

### Every element on the home screen that can start a workout

1. Primary CTA — `Dashboard.tsx:413`
2. `StartWorkoutSheet` "המשך · X" — `StartWorkoutSheet.tsx:~148`
3. `StartWorkoutSheet` "בחרו תבנית מוכנה" — `:~160`
4. `StartWorkoutSheet` "אימון ריק" — `:~176`
5. `TodaysWorkoutCard` per-row "התחל אימון" — `TodaysWorkoutCard.tsx:~215` (one per scheduled row)
6. Template chips ×5 — `TemplateQuickStart.tsx:~95`
7. Template strip `+N` chip → `/templates` — `TemplateQuickStart.tsx:~140`
8. "כל התבניות" header action → `/templates` — `Dashboard.tsx:586,591`
9. `ProgramCard` not-started button → `/program` — `ProgramCard.tsx:~232`
10. `ProgramCard` active "המשך לתוכנית" → `/program` — `ProgramCard.tsx:~320`
11. `ProgramCard` completed "פתח" → `/program` — `ProgramCard.tsx:~190`
12. `FirstRunHero` "בחרו תבנית מוכנה" — `Dashboard.tsx:~760`
13. `FirstRunHero` "התחילו בלי תבנית" — `Dashboard.tsx:~772`

**Up to 13 distinct start affordances on one screen**, three of which land on
different destinations (`/workout/:id`, `/templates`, `/program`) with no shared
notion of what "the next workout" is.

---

## Recommend keeping / merging / removing

Ranked by impact on the owner's stated doubt — "are these numbers real". Advice,
not decisions.

### Remove

1. **The מוכנות number, as currently computed.** It is a two-valued function of
   `recoveryPenalty = 8` for any user who has not opted into recovery logging, and
   it recommends "העלו עומס" to someone who has not trained in three weeks.
   Either gate it behind a same-day recovery check-in or drop the /100 score and
   keep only the qualitative verdict.
2. **`WeeklyGrid`'s `weekProgress` % ring.** Its denominator of 7 contradicts the
   ring goal directly above it, and no user set a 7-day target.
3. **`StreakMilestone`.** It reprints the number `WorkoutStreak` shows one row
   above, and only for 4.2 seconds. Fold the celebration into `WorkoutStreak`.
4. **`Greeting.tsx`, `ForecastNudge.tsx`, `RecentPRBanner.tsx`.** Dead files —
   imported by nothing. They will otherwise be redesigned by mistake.
5. **The 600 ms `StartWorkoutSheet` auto-open.** It covers the very explanation
   `FirstRunHero` exists to give.

### Merge

6. **`TodaysWorkoutCard` + `ProgramCard` + the sheet's "המשך" into one "next
   workout" card.** Three sources currently claim the next session and can
   disagree; one card with a clear precedence (coach schedule → program pointer →
   last template) removes the ambiguity and cuts the start paths from 13 to a few.
7. **The rings' WoW chip and the weekly `CoachBriefCard` into one weekly summary.**
   They compute volume change over different windows with different volume
   definitions; one of them has to be authoritative.
8. **The three "today" markers into one.** Header chip, streak chip, grid badge —
   keep the one closest to the action.
9. **The volume + minutes ring arcs into plain numbers,** or give them a real
   ceiling. `max: Math.max(actual, goal)` makes the arc a decoration.

### Keep

10. **`WorkoutStreak`.** The only headline number on the screen whose math is
    fully real, rest-day-aware, and consistent with the Progress tab
    (`useWorkoutStreak` + `computeStreakWithRests`).
11. **`FirstRunHero`.** The true zero-state is the best-behaved part of this
    screen: no fabricated numbers, a clear mental model, one recommended path.
12. **`WeeklyGrid`'s day cells and rest-day toggle.** Honest per-day facts plus a
    user-controlled input that feeds the streak — genuine, and the aria labels
    already voice the colour-only states.
13. **The primary CTA + `StartWorkoutSheet` pair.** The right shape for the entry
    point; it just needs to stop competing with the other 11 affordances.
14. **`InsightCard`'s tiers 1 and 2 (progression, neglected muscle).** Real,
    non-duplicative facts. Cut tiers 3 and 4 — an always-fillable affirmation is
    not an insight, and the final fallback can print "0 אימונים החודש".
15. **`DataContext`'s 20-session limit — keep the perf intent, raise the window
    for the analytics path.** As it stands, a 5×/week lifter's chronic baseline is
    truncated, which manufactures the load spike that lowers their readiness.

### Fix regardless of the redesign

16. `hasSessionToday` (`Dashboard.tsx:267-279`) must filter on
    `status === 'completed'`. Today an abandoned session flips "פעיל היום" on and
    relabels the CTA.
17. `InsightCard.tsx:~63` Hebrew plural: "1 אימונים החודש".
18. `StreakMilestone.tsx:~110` aria-label reads "איזו יש!" while the visible text
    reads "איזה רצף!" — screen-reader users get a different, garbled string.
19. `Dashboard.tsx:283` comment promises "שבוע ראשון"; `:290` emits "אין השוואה".
20. Dead inputs: `currentStreak` passed to `pickDashboardInsight`
    (`Dashboard.tsx:100`) is never read; `MIN_STREAK_DAYS`
    (`insightPicker.ts:21`) is referenced only by its own test;
    `dismissedRef` (`StreakMilestone.tsx:66`) is written and never read.

---

## Not covered

- **No browser verification.** No dev server, no Playwright (port 4173 owned by
  another worker this batch). Nothing here is a rendered-pixel claim: no RTL
  overflow check at 390 px, no dark/light contrast check, no console-error sweep,
  no axe run. Every finding is static-read.
- **No gates run** (`npm run verify`, `test:run`, `db:test`) — this task was a
  read-only audit with a single-file write budget.
- The exact interaction count for the "אימון ריק" path inside `ExerciseSelector`
  and the optional plan screen was not traced to the end.
- Whether the goal/warmup modal can fire on a template launched from home was
  reasoned from `useWorkoutEffects.ts:166-177`, not observed.
- `HeroStat`, `VerdictLine` and `useCountUp` were treated as presentation only;
  their internals were not audited.

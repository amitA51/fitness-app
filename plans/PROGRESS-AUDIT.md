# PROGRESS screen — read-only fact base

Static audit of `src/pages/Progress.tsx` + all 30 files under `src/pages/progress/**`,
plus every component and service they render or read. **No code was changed.** No build,
no test run, no browser.

Purpose: establish which numbers on this screen are true before anyone rearranges them.
The redesign is a separate task.

Classification used throughout:

- **REAL** — computed from data the user actually logged.
- **DERIVED** — real formula over real data, but an estimate or heuristic. The assumption
  it rests on is named.
- **PLACEHOLDER** — hardcoded, a default nobody chose, or mathematically unable to vary
  in the way the UI implies.

---

## 0. Headline findings

Five things are wrong at the level the owner is worried about. Everything else on this
screen is honest arithmetic, sometimes over too little data.

1. **The four recovery sub-score bars are pinned.** `RecoveryTab.tsx:127-153` passes
   0–100 sub-scores into `RecoveryBar` with `max={25}`. `RecoveryBar.tsx:13` computes
   `pct = value/max*100`, so any component ≥ 25 renders at ≥ 100% inside an
   `overflow: hidden` track — the bar is full and cannot move. The numeric label reads
   literally `75/25`. This is the same failure class as the `max(actual, goal)` rings.
2. **BMI and its category are computed against a height the user may never have given.**
   `Progress.tsx:103-112` falls back to `175` cm. Height is **optional** in onboarding
   (`src/pages/onboarding/useOnboardingWizard.ts:75-77`, default `''`). The badge still
   reads `BMI 24.5` and a confident Hebrew category (`משקל תקין` / `עודף משקל`), with no
   hedge. PLACEHOLDER.
3. **Nothing anywhere consumes logged recovery data.** Full trace in §5. The one
   production path into `calculateTrainingLoad` passes an empty array.
4. **Nothing on the trainee side consumes measurements** either — only sync and the
   coach-side read (§5).
5. **"שיאים אחרונים" on Overview can show the same lift twice with identical numbers.**
   `prService.ts:201-273` writes up to three PR rows per set (`weight`, `volume`, `reps`)
   sharing one `date`; `recentPRs(prs, 2)` (`progressMetrics.ts:149`) does not dedupe.

Two more that matter for a beginner:

6. **Trend charts are min–max normalized with no y-axis.** `GlowAreaChart.tsx:63-66`:
   `range = max - min || 1`. `TrendChartCard` never passes `yAxis`. So 80.0 → 80.2 kg
   draws the same full-height climb as 80 → 95 kg.
7. **`ChapterBreak` renders `null`** (`ChapterBreak.tsx:11-13`, marked deprecated) and is
   still called six times — `OverviewTab.tsx:213`, `WorkoutsTab.tsx:110` and `:146`,
   `BodyTab.tsx:397` and `:427`, `RecoveryTab.tsx:61`. Dead markup, no visual effect.

---

## 1. Inventory, tab by tab

Shell: `PageHeader` title `התקדמות` + today's date eyebrow (`Progress.tsx:181-183`).
Four tabs — `סקירה · אימונים · גוף · התאוששות` (`Progress.tsx:36-41`).
Data comes from one hook, `useProgressData.ts`: 365-day window (`:38`), 400 most recent
sessions (`:44`), except recovery history which is **7 days only** (`:91`, `:107`).

### 1a. סקירה (Overview) — `tabs/OverviewTab.tsx`

| # | What the user sees | Claim | Source | Class |
|---|---|---|---|---|
| O1 | Verdict line, kicker `סיכום השבוע`, e.g. `השלמת 4 אימונים השבוע, והנפח עלה מול השבוע הקודם — שבוע חזק.` | This week's takeaway | `OverviewTab.tsx:216`, `progressMetrics.ts:561` (`weekVerdict`) | **REAL** — counts and volume from completed sessions; the adjective is a threshold rule (≥5% vol → "strong", ≤−10% → "shift up", ≥3 sessions → "steady") |
| O2 | `רמה N` chip | XP level | `LevelCard.tsx:19-22`, `workoutLevels.ts:22` | **DERIVED** — assumes an invented ladder (`T(n)=50·n·(n−1)`) is meaningful, and that a **localStorage-only** XP pool (`xpStore.ts:11`) is the user's history. Not cloud-synced: a reinstall or second device silently shows a different level |
| O3 | `intoLevel / levelSpan XP` + progress bar | Progress to next level | `LevelCard.tsx:22-23` | **DERIVED** — same assumption as O2 |
| O4 | `הגדולות · 1RM משוער` — up to 3 tiles (squat/bench/deadlift), each a big e1RM number | Current 1RM on the big three | `BigThreeCard.tsx:90`, `:140` | **DERIVED** — Epley over one set (see §2). Self-hides when the lift was never trained (`:76`), but shows a full-size number after **one** session with **no hedge** |
| O5 | Per-tile delta `+7 kg` / `−4 kg` / `—` | e1RM change | `BigThreeCard.tsx:149`, `progressMetrics.ts:304` | **DERIVED** — first→last inside an 8-session window; `—` for a single session |
| O6 | Weekly-review headline (`שבוע חזק` / `קצב יציב` / `כדאי להעלות הילוך` / `עוד אימון אחד` / `בחזרה למסלול`) | This week, in one word | `OverviewTab.tsx:258`, `progressMetrics.ts:561` | **REAL** |
| O7 | `אימונים` count + `vs last week` delta chip | Completed sessions, trailing 7d | `OverviewTab.tsx:263`, `progressMetrics.ts:94` | **REAL** |
| O8 | `נפח (ק"ג)` + delta chip | Trailing-7d volume | `OverviewTab.tsx:269` | **REAL** — sums `session.totalVolume`; formatted `12.5k` above 1000 (`dateUtils.ts:150`) |
| O9 | `רצף ימים` | Current streak | `OverviewTab.tsx:277`, `useWorkoutStreak.ts:57` | **REAL** — consecutive days, rest days honoured via the rest-day ledger |
| O10 | `שיאים אחרונים` — 2 rows: exercise, `{weight} ק"ג × {reps}` | Latest personal records | `OverviewTab.tsx:285-297`, `progressMetrics.ts:149` | **REAL** values, **duplicated presentation** — see headline #5 |
| O11 | Lime dot on a fresh PR | PR earned in the last 7 days | `progressMetrics.ts:609` | **REAL** |
| O12 | `1RM ~{n}` chip inside each PR row | Best e1RM for that lift | `OverviewTab.tsx:394`, `progressMetrics.ts:130` | **DERIVED** — third place 1RM appears on this screen |
| O13 | `עקביות 4 שבועות` percentage | 4-week consistency | `ConsistencyScore.tsx:47` | **DERIVED, and coarser than it looks** — it is `weeksActive/4`, so the only possible values are 0/25/50/75/100%. One workout a week for four weeks = 100% |
| O14 | Four week bars with session counts, `סה"כ אימונים (4 שבועות)` | Per-week counts | `ConsistencyScore.tsx:33-51` | **REAL** |
| O15 | `חלוקת נפח · השבוע` — lead muscle sentence, body map, top-5 bars with set counts | This week's muscle split | `MuscleDistribution.tsx:22`, `:28-49` | **REAL** — counts completed sets per primary muscle, current calendar week |
| O16 | `איזון שרירים` — weakest muscle % + nudge | Smallest share of recent volume | `MuscleBalanceInsight.tsx:24-40` | **DERIVED** — needs ≥6 completed sessions and looks back 12 weeks; "weak" means `< 80%` of the mean group volume (`volumeMetrics.ts:232`). The % shown is that group's share of total volume, which reads like a score but is not one |

### 1b. אימונים (Workouts) — `tabs/WorkoutsTab.tsx`

Sub-segmented: `היסטוריה | כוח` (`:75-78`).

**היסטוריה**

| # | Item | Claim | Source | Class |
|---|---|---|---|---|
| W1 | Range control `W M 3M 6M Y` | Time window | `WorkoutsTab.tsx:36-42` | control, no claim |
| W2 | `מגמת נפח · {range} · N אימונים` + sentence + `±N%` | Volume trend over the window | `WorkoutsTab.tsx:52`, `:171-190` | **DERIVED, weak** — the % is **first session vs last session** in the window, not a regression. With the minimum of 3 sessions it is two data points and pure noise |
| W3 | `מגמת נפח` area chart | Volume per session | `TrendChartCard.tsx`, `progressMetrics.ts:157` | **REAL** data, **misleading axis** — see headline #6 |
| W4 | `לוח אימונים` month calendar heatmap | Which days you trained | `WorkoutsTab.tsx:213`, `WorkoutCalendar.tsx` | **REAL** |
| W5 | Five stat cards: `סה״כ אימונים`, `נפח ממוצע`, `זמן ממוצע`, `השבוע`, `החודש` | All-time summary | `WorkoutHistory.tsx:859-865`, `:81-110` | **REAL** — note `סה״כ` is capped by the 400-session load limit, not truly all-time |
| W6 | Search box + month-grouped session list | Workout log | `WorkoutsTab.tsx:215` | **REAL** |

**כוח** — `tabs/StrengthSection.tsx`

| # | Item | Claim | Source | Class |
|---|---|---|---|---|
| S1 | `כוח · סיכום` verdict, e.g. `מתוך 12 תרגילים במעקב, 5 במגמת שיפור.` | Overall strength picture | `StrengthSection.tsx:60-84`, `:214` | **REAL** counts over a **DERIVED** classification |
| S2 | Filter chips `הכל / משתפרים / תקועים / זנוחים` with live counts | Status buckets | `StrengthSection.tsx:219`, `progressMetrics.ts:304` | **DERIVED** — see §2 for the thresholds |
| S3 | Sort chips `אחרון / שיפור / הכי כבד / א־ב` | — | `StrengthSection.tsx:249` | control |
| S4 | One row per exercise: name, big e1RM, status pill, `formatDaysAgo`, signed delta, sparkline | Am I getting stronger on this lift | `ExerciseProgressRow.tsx`, `StrengthSection.tsx:268` | **DERIVED** — Epley; the `חדש` pill **is** an honest hedge below 3 training days |
| S5 | Sparkline | Shape of the e1RM series | `Sparkline.tsx` | **REAL**, `aria-hidden`, min–max normalized; under 2 points it draws a dashed flat line |
| S6 | `שיאים אישיים · PR` collapsible board: rank, name, e1RM, `weight×reps` | Best lifts | `StrengthSection.tsx:320`, `progressMetrics.ts:130` | **DERIVED** — prefers the stored `pr.oneRepMax`, else recomputes Epley (`:83`) |
| S7 | `PRHistoryTab` collapsible — every PR row, grouped by exercise, typed `משקל / נפח / חזרות / 1RM` | Full PR log | `StrengthSection.tsx:481`, `PRHistoryTab.tsx:22-27` | **REAL**, and the place where the 3-rows-per-set writer becomes visible as apparent duplicates |

**Exercise detail** — `components/ExerciseDetail.tsx` (opens on row tap)

| # | Item | Claim | Source | Class |
|---|---|---|---|---|
| D1 | Hero `{e1RM} KG · 1RM` + status pill | Current strength | `ExerciseDetail.tsx:195` | **DERIVED** |
| D2 | Delta chip `+8 KG (+6.2%)` | Change over the trend window | `ExerciseDetail.tsx:218-230` | **DERIVED** — only shown for `improving`/`declining` |
| D3 | `הכי כבד לאחרונה: 90×5 · תורגל לפני יומיים` | Best working set + recency | `ExerciseDetail.tsx:234`, `strengthFormat.ts:11` | **REAL** |
| D4 | `המספר מחושב לפי הסט החזק ביותר בכל אימון — משקל וחזרות יחד (1RM משוער), בלי סטים של חימום.` | How the number is derived | `ExerciseDetail.tsx:257` | **honest disclosure** — the only one on the screen |
| D5 | `עקומת כוח · 1RM משוער` chart with `PR` markers | e1RM over time | `ExerciseDetail.tsx:263-278` | **DERIVED**; has `yAxis` (unlike the other trend charts) and hedges below 2 points |
| D6 | `תחזית נפח שבועי` chart + `תחזית לשבוע הבא: N ק״ג` | Next week's volume | `ExerciseDetail.tsx:283`, `forecastSeries.ts`, `volumeMetrics.ts:247` | **DERIVED** — least-squares linear regression on weekly volume buckets, extrapolated one week. Needs ≥3 sessions with the exercise (`forecastSeries.ts:16`) and ≥2 weekly buckets |
| D7 | `↑ בעלייה` / `→ יציב` + `N% ביטחון` | Confidence in the forecast | `ForecastChart.tsx:170-186`, `volumeMetrics.ts:319` | **DERIVED** — "confidence" is **R²**, a goodness-of-fit of the line, not a probability the prediction is right. Presenting R² as `ביטחון` overstates it |
| D8 | `היסטוריית אימונים` — per-session rows: date, diff, e1RM, `הכי כבד W×R · N סטים · נפח V` | Session-by-session detail | `ExerciseDetail.tsx:291` | **REAL** (e1RM DERIVED) |

### 1c. גוף (Body) — `tabs/BodyTab.tsx`

Sub-segmented: `משקל | מידות | תמונות` (`:41-45`).

**משקל** — `tabs/WeightSection.tsx`

| # | Item | Claim | Source | Class |
|---|---|---|---|---|
| B1 | `BMI 24.5` badge | Your BMI | `WeightSection.tsx:88`, `Progress.tsx:117`, `bodyStatsService.ts:201` | **PLACEHOLDER when height was never entered** — 175 cm default (`Progress.tsx:106`). REAL only if the user filled height in onboarding or Settings |
| B2 | Category label `משקל תקין` / `עודף משקל` / `השמנה` / `תת משקל` | Your BMI band | `WeightSection.tsx:185`, `bodyStatsService.ts:208` | **PLACEHOLDER, same cause** — and worse than B1, because a wrong height flips the *label*, not just a digit |
| B3 | Hero weight `82.4` + `KG` | Latest logged weight | `WeightSection.tsx:125` | **REAL** |
| B4 | `+0.6` / `שינוי · עלייה` | Change | `WeightSection.tsx:153`, `bodyStatsService.ts:182` | **REAL but mislabelled** — `calculateWeightTrend` compares the **earliest and latest entry in the loaded 365-day window**, not "this week". The section comment calls it "change this week"; the label just says `שינוי` |
| B5 | `ממוצע שבועי` + a KG value | Weekly average | `WeightSection.tsx:217-224` | **PLACEHOLDER label over real arithmetic** — `weeklyAvg` is the **mean of every entry in the whole window** (`bodyStatsService.ts:196`). Nothing about it is weekly |
| B6 | Range control + `מגמת משקל · {range} · N מדידות` + sentence | Weight trend | `WeightSection.tsx:233-256` | **REAL** direction from B4's window (note: the sentence uses window-wide direction even when the chart shows a narrower range) |
| B7 | `מגמת משקל` chart | Weight over time | `TrendChartCard` | **REAL** data, **misleading axis** (headline #6). Most damaging here: normal daily fluctuation fills the card |
| B8 | `הוסף משקל` button | — | `WeightSection.tsx:280` | action |

**מידות** — `tabs/MeasurementsSection.tsx`

| # | Item | Claim | Source | Class |
|---|---|---|---|---|
| B9 | Six rows `חזה / מותניים / אגן / זרועות / ירכיים / צוואר`, value + `CM`, `—` when unset | Latest measurements | `MeasurementsSection.tsx:14-21`, `:66-120` | **REAL** |
| B10 | Diff chip `+1.5` next to a row | Change vs previous measurement | `MeasurementsSection.tsx:30-37`, `:55-59` | **REAL** — deliberately ungraded (a waist drop and a biceps drop are not the same news). Only shown when both entries have that field |
| B11 | `הוסף מדידה` | — | `MeasurementsSection.tsx:180` | action |

**תמונות** — `PhotoSection` inside `BodyTab.tsx:108-330`

| # | Item | Claim | Source | Class |
|---|---|---|---|---|
| B12 | Horizontal thumbnail timeline + count | Your progress photos | `BodyTab.tsx:280-300` | **REAL** — reads `check_ins.photos` via `coach/checkInService` |
| B13 | `אז והיום · THEN & NOW` two-up | Earliest vs latest | `BodyTab.tsx:66-104` | **REAL** |
| B14 | `הוסיפו תמונה` | — | `BodyTab.tsx:186-210` | action; requires an account (`:213`) |

### 1d. התאוששות (Recovery) — `tabs/RecoveryTab.tsx`

| # | Item | Claim | Source | Class |
|---|---|---|---|---|
| R1 | Verdict `ציון ההתאוששות שלך עומד על 46 — אפשר להתאמן, אך כדאי לשמור על עומס מתון.` | Today's readiness + advice | `RecoveryTab.tsx:64-70` | **DERIVED**, and the advice is generated from the score alone. See R8 |
| R2 | Ring gauge + count-up score 0–100 + label (`גרועה/חלשה/בינונית/טובה`) | Recovery score | `RecoveryTab.tsx:108-124`, `bodyStatsService.ts:440-465` | **DERIVED** — weighted sum: sleep 30%, soreness 25%, energy 25%, stress 20%. Assumes those weights and that a 1–5 Likert maps linearly to 0–100 |
| R3 | Four bars `שינה / כאב / אנרגיה / לחץ` reading `NN/25` | Sub-score out of 25 | `RecoveryTab.tsx:127-153`, `RecoveryBar.tsx:13` | **PLACEHOLDER — broken.** Values are 0–100, `max` is 25. Any component ≥ 25 (i.e. any Likert answer above the worst) pins the bar and prints a label like `75/25`. Only `sorenessLevel = 1` (score 0) or `= 2` (score 25) can render below full |
| R4 | `אזורים תפוסים` chips | Tight areas you reported | `RecoveryTab.tsx:158-176` | **REAL** — but nothing consumes them (§5) |
| R5 | `ממוצע שבועי` 2×2: `SLEEP N H`, `ENERGY N/5`, `SORENESS N/5`, `STRESS N/5` | 7-day averages | `RecoveryTab.tsx:182-259`, `bodyStatsService.ts:494` | **REAL** — mean over logs in the last 7 days. With one log it is that log |
| R6 | `היסטוריית התאוששות` — up to 7 rows: date, label, score circle | Recent reports | `RecoveryTab.tsx:262-311` | **REAL** — window is 7 days (`useProgressData.ts:91`), so this is never more than a week regardless of history |
| R7 | `עדכן` / `התחל דיווח` | — | `RecoveryTab.tsx:74-88` | action |
| R8 | *(implicit)* the score you get from tapping save without touching anything | — | `AddRecoveryModal.tsx:28-32` | **PLACEHOLDER.** Defaults are `sleepHours 7`, all four Likerts `3`. Saving untouched yields sleep 36, soreness 50, energy 50, stress 50 → **overall 46**, label `חלשה`, and R1 tells the user to keep the load moderate. A number nobody chose, presented as a diagnosis |

Also worth naming: the sleep sub-score is `hours-curve × (quality/5)` (`bodyStatsService.ts:450`). A
solid 7 hours at "בסדר" quality scores **36/100**. The multiplier caps a mid-quality night at
60% of its hours value — an undeclared and fairly harsh assumption.

---

## 2. The 1RM question

**Formula: Epley.** One implementation, `src/utils/workoutMath.ts:79-83`:

```ts
if (reps === 1) return weight;
return Math.round(weight * (1 + reps / 30) * 10) / 10;
```

`prService.calculateEst1RM` (`prService.ts:406`) delegates to it, so stored PRs and displayed
strength cannot disagree. No Brzycki, no bespoke variant, no RPE adjustment anywhere.

**Where a 1RM or strength estimate is shown — six places, three of them on Overview or one tap in:**

| Where | Line | Hedged? |
|---|---|---|
| `הגדולות · 1RM משוער` tiles on **Overview** | `BigThreeCard.tsx:90`, `:140` | **No** — full-size number from one session |
| `1RM ~{n}` chip in Overview's recent-PR rows | `OverviewTab.tsx:394` | No (the `~` is the only signal) |
| Strength list row, big number + `1RM` unit | `ExerciseProgressRow.tsx:87` | **Yes** — `חדש` status pill below 3 training days |
| PR board `{e1RM} 1RM` | `StrengthSection.tsx:~430` (board rows) | No |
| Exercise detail hero `{n} KG · 1RM` | `ExerciseDetail.tsx:195` | **Yes** — status pill + the derivation sentence at `:257` |
| `עקומת כוח · 1RM משוער` chart | `ExerciseDetail.tsx:263` | **Yes** — refuses to draw under 2 points |

**How the per-session number is picked.** `bestWorkingSet` (`progressMetrics.ts:286`) takes the
completed, non-warmup set with the highest Epley e1RM, handling drop-set legs. That is a
defensible choice and better than "most volume". `buildExerciseProgress` (`:334`) then keeps
one point per **training day** (higher e1RM wins if a day has two sessions).

**How many sets before it means anything.**

- **The e1RM number itself: 1 completed working set.** There is no minimum. One set of
  60 kg × 12 produces `60 × (1 + 12/30) = 84 kg` and the UI prints `84`.
- **A trend/status: 3 distinct training days** (`STRENGTH_MIN_POINTS = 3`,
  `progressMetrics.ts:250`). Below that, status is `new` → pill reads `חדש`.
- **Trend window: last 8 points** (`STRENGTH_TREND_WINDOW = 8`, `:246`); grading thresholds
  ±2% and a 1 kg absolute floor (`:252-254`); `dormant` after 21 days (`:248`).

**Is the number honest at 3 workouts? Split answer.**

- **Inside the strength list and detail — yes, adequately.** The `חדש` pill fires, the
  derivation sentence is present, and the curve refuses to draw. A user who drills in is told
  the number is young.
- **On Overview — no.** `BigThreeCard` renders a 26-px e1RM after a single logged set, with no
  status pill, no session count, and no minimum. Epley at 12+ reps is a known over-estimate;
  a beginner's first high-rep set produces the *largest* inflation, and that inflated number
  is the most prominent figure on the screen after the weekly stats. The delta shows `—`,
  which reads as "no change" rather than "not enough data".

**Against the Hevy reference the owner named.** Hevy puts 1RM at the individual-exercise level
and a strength percentile only for the big three, at the bottom of a summary — never on the
overview. This app currently shows 1RM in **three** places on or one tap from Overview (O4,
O12, plus the PR board), and shows it *sooner* than any sane threshold. There is no percentile
or population comparison anywhere in the codebase — nothing claims "stronger than X% of
lifters", so there is no fake benchmark to remove. The problem is placement and prominence,
not invention.

---

## 3. Beginner vs veteran walk-through

### Beginner — 3 completed workouts, no body data, no recovery data

| Tab | What renders |
|---|---|
| **סקירה** | Verdict line reads `השלמת 3 אימונים השבוע — קצב יציב ששומר על ההתקדמות.` **`LevelCard` shows a level** (3 sessions → roughly 150–400 XP → level 2). **`BigThreeCard` shows full-size e1RM numbers** for any of the three lifts trained, each with `—` as its delta. Weekly stats are correct; **both delta chips are hidden** (`DeltaChip` returns null without a prior week — good). **`שיאים אחרונים` is populated and probably shows the same exercise twice** with identical `weight × reps`, both with a lime "new PR" dot. `עקביות 4 שבועות` reads **25%** — three workouts in one week scores a quarter, because the metric counts *weeks touched*, not effort. `חלוקת נפח` renders. `איזון שרירים` correctly self-hides (needs 6 sessions). |
| **אימונים** | Range defaults to `M`. With exactly 3 sessions the chart draws and `מגמת נפח` prints a **±N% from session 1 to session 3** — a percentage off two data points, dressed as a trend, with a directive attached (`שווה לחזק את העומס`). Calendar and 5 stat cards are honest. `זמן ממוצע` is a mean of three. |
| **אימונים › כוח** | Best-behaved surface on the screen. Verdict says `N תרגילים במעקב. עוד כמה אימונים ותהיה תמונת מגמה ברורה.` Every row shows `חדש`. Sparklines are dashed flat lines for single-point exercises. Detail view shows the derivation note, refuses the curve under 2 points, and the forecast card says `התחזית נבנית מ־3 אימונים לפחות עם התרגיל הזה` with a countdown. |
| **גוף** | Composed empty state, single CTA `הוסף משקל` (`BodyTab.tsx:390-410`). Log one weight and it becomes: hero number, **`BMI` badge and a category label computed against 175 cm**, no trend (needs 2 entries), no chart (needs 2 loaded + 3 in range). |
| **התאוששות** | Empty state `עדיין לא דיווחת על ההתאוששות שלך` + CTA. Log once, accepting the defaults, and the screen asserts a score of **46**, label `חלשה`, four bars reading `36/25`, `50/25`, `50/25`, `50/25`, and a recommendation to keep the load moderate — from a form the user never actually filled in. `ממוצע שבועי` then shows "averages" of that one entry. |

**Empty, absurd or misleading for the beginner, ranked:**

1. Four recovery bars showing `50/25` — visibly nonsense arithmetic (R3).
2. A recovery score and a training recommendation from untouched defaults (R8).
3. A confident BMI category from an assumed height (B2).
4. A 26-px 1RM from one high-rep set, unhedged, on the landing tab (O4).
5. The same PR shown twice (O10).
6. A `±%` volume trend from two sessions with a coaching directive attached (W2).
7. `25%` consistency for someone who trained three times this week (O13).
8. A weight chart where 0.2 kg of noise fills the card (B7).

### Veteran — 200 workouts, full history

| Tab | What renders |
|---|---|
| **סקירה** | Everything populates and the deltas become meaningful. Eight stacked cards: verdict, level, big three, weekly stats, PRs, consistency, muscle distribution, muscle balance. Long scroll on a phone. `עקביות` is likely pinned at 100% and stops carrying information. |
| **אימונים** | `Y` range slices up to 365 days of the 400-session load. `מגמת נפח` first-vs-last over a year is a coin flip on which two sessions land at the edges. `סה״כ אימונים` silently truncates at 400 sessions (`useProgressData.ts:44`). Calendar and history list work well. |
| **כוח** | The screen's real payoff. Filters (`תקועים`, `זנוחים`) become genuinely useful. The PR board and PR history get long; the board collapses at 5 with a `הצג הכל` expander, PR history is a separate collapsible. |
| **גוף** | Full trend chart, meaningful measurement diffs, photo timeline with a `אז והיום` compare that actually earns its place. B4/B5 get *more* wrong with more history: `שינוי` becomes "change over the last year" and `ממוצע שבועי` becomes "mean of a year of entries" while still saying weekly. |
| **התאוששות** | Still only ever shows **7 days** of history and a 7-day average, no matter how long the user has been logging. A year of diligent recovery reports yields the same one-week view as week one. R3 is still broken. |

---

## 4. Zero state — brand-new user, nothing logged

| Surface | What appears | Verdict |
|---|---|---|
| Page shell | Header + 4 tabs always render | fine |
| Load in flight | `ProgressSkeleton` | fine |
| Load failed | Dedicated card `טעינת נתוני ההתקדמות נכשלה` + `נסו שוב` (`Progress.tsx:230-256`) | good — explicitly added so users with data don't see the first-run state |
| **סקירה** | Full composed empty state: trophy, `עדיין אין נתונים`, an explanatory line, a numbered 3-step list, primary CTA `בחרו תבנית והתחילו`, ghost CTA `או אימון ריק` (`OverviewTab.tsx:108-206`) | **best empty state in the app** |
| **אימונים** | Composed: dumbbell, `עדיין אין אימונים`, `האימון הראשון יופיע כאן עם נפח, משך ותרגילים.`, CTA (`WorkoutsTab.tsx:108-146`) | good |
| **אימונים › כוח** | Composed: `אין נתוני כוח עדיין` + explanation (`StrengthSection.tsx:165-183`). No CTA | good, slightly weaker (no action) |
| **גוף** (weight/measurements) | Composed: scale, `עדיין אין נתוני גוף — תיעוד המשקל הראשון יתחיל את המעקב.`, CTA (`BodyTab.tsx:390-410`) | good |
| **גוף › תמונות** | Five distinct states — signed-out, loading skeleton, error+retry, composed empty, populated (`BodyTab.tsx:212-278`) | **most thorough state handling on the screen** |
| **גוף › משקל** with 1 entry | Hero + BMI + category, **no** trend strip, **no** chart | correct gating, except the BMI placeholder |
| **גוף › מידות** alone | `עדיין לא תועדו מידות` + `הוסף מידות ראשונות` | good |
| **התאוששות** | Composed: heart, `עדיין לא דיווחת על ההתאוששות שלך`, CTA `התחל דיווח`. Weekly-average card and history card both self-hide (`RecoveryTab.tsx:181`, `:261`) | good |
| Trend charts below threshold | `אין מספיק אימונים בטווח הזה — בחרו טווח רחב יותר` (`WorkoutsTab.tsx:205`), same for weight (`WeightSection.tsx:250`) | good — actionable, not a bare "no data" |

**No tab renders a bare heading, and no tab renders a chart of nothing.** Zero state is the
strongest part of this screen. Every self-hide is a real self-hide, not a card of dashes.

---

## 5. Body and Recovery — how you get there, and whether anything reads them

### How a user reaches them

Both are top-level tabs, always visible in the tab bar (`Progress.tsx:38-39`). No gating, no
deep link required. Body has a further three-way segmented control; the default is `משקל`, so
`מידות` and `תמונות` each need one extra tap (`BodyTab.tsx:363`).

### Writes: fully wired

`Progress.tsx` owns all three sheets and all three save handlers:
`addBodyWeight` (`:134-142`), `addBodyMeasurement` (`:146-153`), `addRecoveryLog` (`:155-166`).
Each writes to IndexedDB, cloud-syncs when signed in, and calls `reload()`.

### Reads: the answer is **no consumer**

**Recovery — traced end to end.**

`getRecoveryLogsByDateRange` / `getTodayRecoveryLog` / `getWeeklyRecoveryAverage` are imported
in exactly one production file: `useProgressData.ts:17-20`, which feeds `RecoveryTab` and
nothing else.

There *is* a consumer-shaped path, and it is dead:

- `trainingLoadService.ts:272-274` — `calculateTrainingLoad(sessions, recoveryLogs = [], ...)`.
- `:127-130` — `latestRecoveryScore()` returns `null` for an empty array.
- `:158-165` — `getPrimaryConstraint()` skips the `'recovery'` constraint entirely when the
  score is `null`. Muscle-level `isTight` flags come from `tightAreas` and likewise never fire.
- The only production caller is `ai/contextBuilder.ts:240-246` → `buildContext(sessions, recoveryLogs = [], ...)`.
- `buildContext`'s only production caller is `aiWorkoutInsightService.ts:14-19`, which calls
  **`buildContext(sessions)`** — no recovery argument.
- That is reached from `hooks/fitness/useFitnessInsights.ts:150`, `generateAIWorkoutInsight(sessions)`.

So the `ציון מוכנות מתמטי` injected into the AI prompt (`contextBuilder.ts:86`,
`aiWorkoutInsightService.ts:30`) is computed with **zero recovery input** — it is session
volume and RPE only. The two functions that *would* accept recovery logs have no live caller:
`ai/features.ts:24` `getWorkoutAdvice(sessions, recoveryLogs?, ...)` is only re-exported
(`services/ai.ts:21`) and never invoked; `ai/coachBrief.ts:111` and `:193` are called only from
`ai/__tests__/coachBrief.test.ts`. No `.tsx` file anywhere passes a `recoveryLogs` argument
(verified by grep across `src/**/*.tsx`).

> **If a user logs recovery, the only thing that changes anywhere in the app is the Recovery
> tab's own three cards.** No recommendation, no readiness figure, no warning, no load
> adjustment, no effect on the AI coach. Confirmed by tracing every import of every recovery
> read and every parameter that accepts a `RecoveryLog[]`.

**Measurements — traced.**

`getLatestMeasurement` / `getBodyMeasurementsByDateRange` are imported only by
`useProgressData.ts:13-15`, consumed only by `MeasurementsSection`. The remaining references to
the `body_measurements` store are infrastructure (`indexedDBCore`, `cloudMerge`,
`supabaseSync*`, `settingsService` backup, `idNormalization`) plus **one real reader outside
Progress**: `services/coach/coachApi.ts:241`, where a **coach** views a client's measurements.
Nothing on the trainee's own side reads them.

**Weight — the one that does have consumers.** `addBodyWeight` dispatches a
`BODY_WEIGHT_UPDATED` event (`bodyStatsService.ts:118-127`) for TDEE-aware surfaces, and
`intelligence/profile.ts:97` reads the profile's weight. Weight is genuinely plumbed in.

### Verdict on the owner's question

**Recovery has a PAYOFF problem, not a placement problem.** It is easy to reach — a top-level
tab. The problem is that logging it changes nothing, and one of its three cards is arithmetically
broken. Moving it will not help; either wire it into something (the readiness score it was
clearly designed for is sitting there taking an empty array) or stop asking for the data.

**Measurements has a mild placement problem and no payoff problem to speak of** — a measurement
log is inherently a log, and the diff column is the payoff. Its issue is that it sits behind a
sub-tab of a tab. Photos, in the same place, are more valuable to a trainee than any number on
this screen and are buried one level deeper still.

---

## 6. Proposed split — a verdict for every inventory item

`KEEP` = basic view · `DEMOTE` = behind an advanced surface · `DELETE` = remove.

### Overview

| # | Item | Verdict | Reasoning |
|---|---|---|---|
| O1 | Weekly verdict line | **KEEP** | One honest sentence that answers "how am I doing" before any number. The strongest thing on the screen |
| O2/O3 | Level chip + XP bar | **DELETE** | An invented ladder that measures nothing about fitness, stored only in this device's localStorage so it silently resets on reinstall. If gamification is wanted, it belongs on the post-workout summary where it is earned — not on the analysis screen |
| O4 | Big three e1RM tiles | **KEEP, with a minimum** | Genuinely the most-wanted widget, and the deep link to detail is good. But it must not render a lift with fewer than 3 training days, or must show the session count. As built it is the screen's most prominent unhedged estimate |
| O5 | Per-tile delta | **KEEP** | Only meaningful once O4's minimum exists; `—` at one session should read "not enough data" |
| O6 | Weekly headline | **DELETE** | Says the same thing as O1 in fewer words, 15 px below it. Two verdicts about one week is one too many |
| O7 | `אימונים` + delta | **KEEP** | The primary number a trainee checks |
| O8 | `נפח` + delta | **KEEP** | Ditto |
| O9 | `רצף ימים` | **KEEP** | Cheap, honest, motivating |
| O10 | Recent PRs | **KEEP, after de-duplication** | Real celebration. Must collapse the three per-set PR types to one row per lift per date |
| O11 | Fresh-PR dot | **KEEP** | |
| O12 | `1RM ~n` chip in PR rows | **DELETE** | Third appearance of 1RM on one screen, in the smallest type, next to the actual lifted weight it is derived from. Adds a number, not information |
| O13 | `עקביות 4 שבועות` % | **DELETE** | Five possible values, and it rewards presence rather than effort — 4 lazy weeks score 100%, 3 hard sessions in one week score 25%. Actively misinforms |
| O14 | Four week-count bars | **DEMOTE** | The counts are true and readable, and they are what O13's percentage should have been. Put them inside the workouts history surface next to the calendar, which tells the same story better |
| O15 | `חלוקת נפח · השבוע` | **DEMOTE** — expandable inside the workouts tab | Real and useful, but it is analysis, not a status check. Body map plus five bars is the single tallest card on Overview |
| O16 | `איזון שרירים` | **DEMOTE** — same expandable as O15 | Same subject as O15; showing both separately says one thing twice. Its `%` also reads like a score and is a volume share — needs relabelling wherever it lands |

### Workouts

| # | Item | Verdict | Reasoning |
|---|---|---|---|
| W1 | Range control | **DEMOTE** with W3 | Five ranges is a power-user control on a screen the owner wants calmer |
| W2 | `מגמת נפח` summary + `±%` | **DELETE the percentage, KEEP the sentence** | First-vs-last over N sessions is not a trend, and it carries a coaching directive. Either compute the same regression the forecast already has (`volumeMetrics.ts:247`) or say only the direction |
| W3 | Volume trend chart | **KEEP** | The one chart that earns Overview-adjacent placement. Needs a y-axis or a zero baseline (headline #6) |
| W4 | Calendar heatmap | **KEEP** | Fastest honest read of "did I show up". Better than O13 at the job O13 claims |
| W5 | Five stat cards | **KEEP three, DELETE two** | `סה״כ אימונים`, `נפח ממוצע`, `השבוע` earn their place. `זמן ממוצע` and `החודש` duplicate information already on the calendar and in the weekly card |
| W6 | Search + session list | **KEEP** | The log is the product |
| S1 | Strength verdict | **KEEP** | |
| S2 | Filter chips | **KEEP** | `תקועים` and `זנוחים` are the two most actionable affordances on the whole screen |
| S3 | Sort chips | **DEMOTE** — collapse to a single sort control | Four sort chips plus four filter chips is two rows of pills before any content |
| S4 | Exercise rows | **KEEP** | The honest core of the screen |
| S5 | Sparkline | **KEEP** | Cheap, decorative, correctly `aria-hidden` |
| S6 | PR board | **DEMOTE** — keep as the existing collapsible | Correct as built; it is already collapsed by default |
| S7 | `PRHistoryTab` | **DELETE** | Superset of S6 with worse presentation, and it re-fetches PRs independently (`PRHistoryTab.tsx:89`) after the parent already loaded them. Two PR surfaces stacked in one section is the densest point on the screen |
| D1–D5 | Detail hero, delta, top set, derivation note, curve | **KEEP** (advanced by construction — one tap in) | This is what a well-built drill-down looks like. D4 is the only place the app explains its own math; it should be the model for everything else |
| D6 | Volume forecast chart | **DEMOTE** — expandable within the detail view | A one-week linear extrapolation of a noisy series. Defensible, not load-bearing, and it is a whole card |
| D7 | `N% ביטחון` | **DELETE** | It is R², relabelled as confidence. Either say `התאמה לקו המגמה` or drop it — a percentage called "confidence" will be read as "chance of being right" |
| D8 | Per-session history | **KEEP** | Already inside the detail view; it is the receipt for D1 |

### Body

| # | Item | Verdict | Reasoning |
|---|---|---|---|
| B1 | BMI badge | **DELETE unless height is known** | A number derived from an assumed 175 cm is exactly the class of lie this audit exists to find. If kept, gate on a real height and offer to collect it |
| B2 | BMI category label | **DELETE** | Strictly worse than B1: a wrong height flips `משקל תקין` to `עודף משקל`. Also BMI tells a lifter nothing useful |
| B3 | Hero weight | **KEEP** | |
| B4 | `שינוי` + direction | **KEEP, relabelled** | The arithmetic is right; the label implies a period it does not measure. Say which window |
| B5 | `ממוצע שבועי` | **DELETE** | It is the mean of the entire loaded window. Nothing weekly about it, and a window-wide mean of body weight is not a fact anyone acts on |
| B6 | Range + trend summary | **DEMOTE** with B7 | |
| B7 | Weight trend chart | **KEEP** | Weight over time is the reason this tab exists. Needs a sane y-range so daily noise stops looking like a transformation |
| B8 | `הוסף משקל` | **KEEP** | |
| B9 | Measurement rows | **KEEP** (inside its sub-tab) | Honest log, `—` for unset fields |
| B10 | Diff chips | **KEEP** | The payoff of measuring. Correctly ungraded |
| B11 | `הוסף מדידה` | **KEEP** | |
| B12–B14 | Photo timeline, `אז והיום`, add | **KEEP, and promote** | The best evidence of change a trainee can have, currently three taps deep behind a sub-tab of a tab. `אז והיום` is the single most convincing thing on this screen |

### Recovery

| # | Item | Verdict | Reasoning |
|---|---|---|---|
| R1 | Verdict + advice | **DEMOTE** — belongs wherever the readiness figure actually drives a decision, i.e. before a workout, not on an analysis tab | It is advice, and advice next to a broken gauge is worse than no advice |
| R2 | Ring gauge + score | **KEEP** (within Recovery) | The weights are arbitrary but stated, and the score does vary with real input. It should say what it is made of, the way D4 does |
| R3 | Four sub-score bars | **DELETE as built** | Broken (`max=25` against 0–100). Either fix `max` to 100 or delete — but a bar that prints `50/25` must not ship either way |
| R4 | `אזורים תפוסים` chips | **DEMOTE** — or DELETE until something reads them | `trainingLoadService` has an `isTight` branch waiting for exactly this data and never receives it. Right now the user tags sore areas into a void |
| R5 | Weekly-average 2×2 | **DEMOTE** — advanced section | Four averages of a Likert scale is the definition of "more data than helps" |
| R6 | 7-day history list | **DEMOTE** — advanced section | Also raise the window: a week is not a history |
| R7 | Add/update action | **KEEP** | |
| R8 | The defaults themselves | **fix, not a display item** | A save that produces a 46/`חלשה` verdict from an untouched form must either require input or not compute a score |
| — | `ChapterBreak` call sites ×4 | **DELETE** | Renders `null`; already marked deprecated |

### Shape the advanced surface should take

Three different shapes, deliberately:

- **An expandable inside the relevant tab** for O14, O15, O16 (workouts analysis) and D6
  (per-exercise forecast). These are *about* the content next to them; a separate destination
  would orphan them. Collapsed by default, one tap, no navigation.
- **A collapsible section** for R5, R6 and R1 within Recovery, and for S6 within Strength —
  the pattern the PR board already uses successfully (`StrengthSection.tsx:305-320`).
- **Promotion, not demotion, for photos** (B12–B14). Everything else here competes for the same
  screen; photos compete with nothing and prove more.

No new top-level destination is warranted. The screen already has 4 tabs and 5 sub-tabs;
adding a sixth surface would move the density problem rather than solve it.

---

## 7. What I could not verify

- **Nothing was run.** No `npm run verify`, no `test:run`, no build, no dev server, no
  Playwright — per instruction, other workers are on this tree. Every claim here is static
  reading. I did not execute the RecoveryBar arithmetic in a browser; the `50/25` figure is
  computed by hand from `bodyStatsService.ts:440-465` and `RecoveryBar.tsx:13`.
- **Nothing was rendered.** No screenshots at 390 px or desktop, no light/dark check, no RTL
  overflow check, no console-error check, no axe pass. Statements about "the tallest card" or
  "long scroll" are inferred from markup and inline sizes, not measured.
- **`recentPRs` duplicate ordering** depends on `Array.prototype.sort` stability across three
  records with an identical `date` string. V8's sort is stable, so the two rows shown should be
  the `weight` and `volume` PRs of the same set — but I did not observe it live. That the
  duplicate rows *exist* in the store is certain from `prService.ts:201-273`; which two the UI
  picks is inference.
- **Actual XP totals for a 3-workout user** (§3) are estimated from `workoutXp.ts:17-24` with
  assumed volumes. The level shown could be 1 or 2 depending on real numbers.
- **Migration/legacy data.** Whether users in the wild have PR rows written by an older code
  path with a different `oneRepMax`, or recovery logs from before the `levelToScore` fix
  referenced at `bodyStatsService.ts:441-445`, is not knowable from source. `buildPRBoard`
  prefers a stored `pr.oneRepMax` (`progressMetrics.ts:83`), so a legacy row with a
  differently-computed value would display unchanged.
- **`WorkoutCalendar` and `WorkoutHistory` internals** were read only for the numbers they
  display (`WorkoutHistory.tsx:81-110`, `:859-865`). Their virtualization, search behaviour and
  the calendar's click-through were not audited — they are outside `src/pages/progress/**`.
- **Coach-side surfaces** that read the same tables (`coachApi.ts:177`, `:241`) were confirmed
  to exist as readers but not audited for what they display.
- **`getWorkoutAdvice` having no caller** rests on a grep for `WorkoutAdvice` across `src`,
  which found only the definition (`ai/features.ts:24`) and the re-export
  (`services/ai.ts:21`). A dynamic or string-built invocation would not appear in that grep.

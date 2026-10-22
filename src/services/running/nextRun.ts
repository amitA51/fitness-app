// ============================================================================
// The next run — one concrete suggestion, with the reasons behind it.
// ============================================================================
// Rules a good coach applies before anything clever:
//   1. No running yet → run-walk. Back after 2+ months off → run-walk again;
//      after 2+ weeks off → a short easy return.
//   2. Already ran today (calendar day) → rest; tomorrow is planned below.
//   3. Hard run in the last 48 h → easy (hard/easy spacing). A week far above
//      an established month (≥3 active weeks, +50%) → easy too.
//   4. The long run — only for a runner with a base (about 3 runs a week for
//      3+ weeks) and none in 6+ days: never more than 10% past the longest run
//      of the last month (the single-run spike is the injury signal with the
//      best evidence, Frandsen 2025), capped by the goal and by 150 minutes.
//   5. Room for quality — an established runner, nothing hard in 3+ days and
//      no long run yesterday, a phase that wants it → tempo or intervals.
//   6. Otherwise an easy run, with strides when nothing fast happened this week.
// A goal adjusts it while its date is ahead: taper shortens, race week keeps it
// light. A goal whose date has passed no longer steers anything.

import { type GoalPhase, type RunningGoal, daysUntil, goalPhase, longRunTargetKm } from './goals';
import { type PaceBand, paceBand } from './paceBands';
import { type RunningLoad, longRunThresholdKm } from './trainingLoad';

export type NextRunKind =
  | 'run_walk'
  | 'rest'
  | 'easy'
  | 'easy_strides'
  | 'long'
  | 'tempo'
  | 'intervals'
  | 'race_week';

export interface NextRun {
  kind: NextRunKind;
  /** Short headline, e.g. "ריצה קלה 35 דקות". */
  title: string;
  /** How to run it. */
  detail: string;
  /** Pace guide, sec/km [fast, slow]; null without trusted personal bands. */
  pace: { fastSec: number; slowSec: number } | null;
  /** Heart-rate guide, bpm [low, high]; null without HRmax. */
  hr: { low: number; high: number } | null;
  /** Why this run, in one or two plain lines. */
  reasons: string[];
}

/**
 * Easy-run heart-rate guide: up to 78% of HRmax — a little under the 80% line
 * the load classifier uses, so following the guide always reads as easy.
 */
const EASY_HR = [0.65, 0.78] as const;
/** Daniels' threshold: 88–92% of HRmax. */
const TEMPO_HR = [0.87, 0.92] as const;

/** A week this much bigger than an established month is worth calming down. */
export const RAMP_SPIKE = 0.5;
/** Weeks with running, out of the four before the last 7 days, for a baseline. */
const ESTABLISHED_WEEKS = 3;
/** Longest long run, minutes (Daniels' cap is 150). */
const LONG_RUN_MAX_MIN = 150;
/** Runs in 28 days that make an established runner (about 3 a week for 3 weeks). */
const ESTABLISHED_RUNS_28D = 9;
/** Easy runs of about this long make a base for quality work. */
const ESTABLISHED_RUN_MIN = 25;
/** Back after this many days off: ease in. */
const RETURN_AFTER_DAYS = 14;
const RESTART_AFTER_DAYS = 60;

const hrRange = (hrMax: number | null, [lo, hi]: readonly [number, number]) =>
  hrMax ? { low: Math.round(hrMax * lo), high: Math.round(hrMax * hi) } : null;

const paceOf = (bands: readonly PaceBand[] | null, id: Parameters<typeof paceBand>[1]) => {
  const b = bands ? paceBand(bands, id) : null;
  return b ? { fastSec: b.fastSec, slowSec: b.slowSec } : null;
};

/** Prescribed easy-run length: the usual run, 25–60 min, in 5-minute steps. */
const easyMinutes = (load: RunningLoad): number =>
  Math.round(Math.min(60, Math.max(25, load.medianRunMin ?? 30)) / 5) * 5;

/** Round down to half a kilometre — a cap is never rounded up past itself. */
const floorHalfKm = (km: number) => Math.floor(km * 2) / 2;
const kmText = (km: number) => (Number.isInteger(km) ? String(km) : km.toFixed(1));

const RUN_WALK: Omit<NextRun, 'hr' | 'reasons'> = {
  kind: 'run_walk',
  title: 'ריצה-הליכה כ-25 דקות',
  detail:
    '5 דקות הליכה מהירה לחימום, 6 סבבים של דקה ריצה קלה ושתי דקות הליכה, ו-2 דקות הליכה בסוף. כשזה מרגיש קל — מאריכים את הריצה ומקצרים את ההליכה.',
  pace: null,
};

export interface NextRunInput {
  load: RunningLoad;
  bands: readonly PaceBand[] | null;
  hrMax: number | null;
  goal: RunningGoal | null;
  now?: Date;
}

export function nextRun({ load, bands, hrMax, goal, now = new Date() }: NextRunInput): NextRun {
  const goalPhaseNow: GoalPhase | null = goal ? goalPhase(goal, now) : null;
  // A goal whose date has passed no longer steers the plan.
  const activeGoal = goal && goalPhaseNow !== 'past' ? goal : null;
  const phase = activeGoal ? goalPhaseNow : null;
  const easyPace = paceOf(bands, 'easy');
  const easyHr = hrRange(hrMax, EASY_HR);
  const minutes = easyMinutes(load);

  const easy = (reasons: string[], strides = false, mins = minutes): NextRun => ({
    kind: strides ? 'easy_strides' : 'easy',
    title: `ריצה קלה ${mins} דקות${strides ? ' + האצות' : ''}`,
    detail: strides
      ? 'קצב שאפשר לדבר בו במשפטים מלאים. בסוף: 4 עד 6 האצות של 20 שניות, מהירות ורגועות, עם הליכה של דקה ביניהן.'
      : 'קצב שאפשר לדבר בו במשפטים מלאים. אם הדופק או הנשימה עולים — האטו, גם אם זה מרגיש איטי.',
    pace: easyPace,
    hr: easyHr,
    reasons,
  });

  // 1. Nothing to go on yet, or a long break.
  if (load.daysSinceLastRun === null) {
    return {
      ...RUN_WALK,
      hr: easyHr,
      reasons: ['עוד אין ריצות ביומן — מתחילים בעדינות, והגוף מתרגל לעומס.'],
    };
  }
  if (load.daysSinceLastRun >= RESTART_AFTER_DAYS) {
    return {
      ...RUN_WALK,
      hr: easyHr,
      reasons: [
        `עברו ${load.daysSinceLastRun} ימים מהריצה האחרונה. אחרי הפסקה ארוכה חוזרים כמו בהתחלה — הכושר חוזר מהר יותר משנדמה.`,
      ],
    };
  }
  if (load.daysSinceLastRun >= RETURN_AFTER_DAYS) {
    return easy(
      [
        `עברו ${load.daysSinceLastRun} ימים מהריצה האחרונה. השבוע חוזרים בריצות קצרות וקלות, ורק אחר כך מאריכים.`,
      ],
      false,
      20
    );
  }

  // 2. Already ran today.
  if (load.daysSinceLastRun === 0) {
    return {
      kind: 'rest',
      title: 'היום: מנוחה',
      detail: 'כבר רצתם היום. הליכה קלה או מתיחות עדינות זה מספיק. מחר — ריצה קלה.',
      pace: null,
      hr: null,
      reasons: ['ההתאוששות היא חלק מהאימון: שם הגוף בונה את מה שהאימון דרש.'],
    };
  }

  // Race week overrides everything after the basic rest rules.
  if (phase === 'race_week' && activeGoal?.raceDate) {
    const days = daysUntil(activeGoal.raceDate, now);
    return {
      kind: 'race_week',
      title: days === 0 ? 'היום המרוץ' : 'שבוע המרוץ: קצר וקל',
      detail:
        days === 0
          ? 'חימום של 10 דקות קלות עם 2 או 3 האצות. את הקילומטרים הראשונים רצים לאט מקצב המטרה, ומאיצים רק בחצי השני. בהצלחה!'
          : '20 עד 30 דקות קלות עם 4 האצות קצרות. לא מוסיפים כושר בשבוע הזה — רק שומרים על רעננות. יום לפני המרוץ: מנוחה או 15 דקות קלות.',
      pace: easyPace,
      hr: easyHr,
      reasons: [
        days === 0
          ? `${activeGoal.label} — היום.`
          : `${activeGoal.label} בעוד ${days === 1 ? 'יום אחד' : `${days} ימים`}.`,
      ],
    };
  }

  // 3. Recover from a hard run or a volume spike.
  if (load.daysSinceHardRun !== null && load.daysSinceHardRun < 2) {
    return easy(['ריצה קשה בפחות מ-48 שעות. אחרי יום קשה בא יום קל, כדי שהגוף יספוג את העבודה.']);
  }
  if (
    load.activePriorWeeks >= ESTABLISHED_WEEKS &&
    load.rampFraction !== null &&
    load.rampFraction > RAMP_SPIKE
  ) {
    const pct = Math.round(load.rampFraction * 100);
    return easy([
      `ב-7 הימים האחרונים רצתם ${pct}% יותר מהממוצע של החודש. אחרי קפיצה כזאת נותנים לגוף להתרגל — היום ריצה קלה.`,
    ]);
  }

  const taper = phase === 'taper';
  const established =
    load.recentRuns.length >= ESTABLISHED_RUNS_28D &&
    (load.medianRunMin ?? 0) >= ESTABLISHED_RUN_MIN;

  // 4. The long run — only on a base, and never a jump past +10%.
  const longest = load.longestLast28Km ?? 0;
  if (
    established &&
    longest > 0 &&
    (load.daysSinceLongRun === null || load.daysSinceLongRun >= 6)
  ) {
    const goalCap = activeGoal ? longRunTargetKm(activeGoal.distanceKm) : null;
    let km = longest * 1.1;
    if (goalCap) km = Math.min(km, Math.max(goalCap, longest));
    if (taper) km = longest * 0.6;
    // 150 minutes at an easy pace: the trusted easy band, else the usual pace.
    const easyBand = bands ? paceBand(bands, 'easy') : null;
    const pace = easyBand ? (easyBand.fastSec + easyBand.slowSec) / 2 : load.medianPaceSecPerKm;
    if (pace) km = Math.min(km, (LONG_RUN_MAX_MIN * 60) / pace);
    km = floorHalfKm(km);
    // Only a run the load count will also call long (trainingLoad shares the rule).
    if (km >= longRunThresholdKm(load.medianRunKm)) {
      return {
        kind: 'long',
        title: `ריצה ארוכה ${kmText(km)} ק״מ`,
        detail:
          'הכי איטי בשבוע: קצב שיחה מההתחלה ועד הסוף. בריצה של יותר משעה קחו מים ושתו לפי צמא; ביום חם — בבוקר המוקדם.',
        pace: easyPace,
        hr: easyHr,
        reasons: [
          load.daysSinceLongRun === null || load.daysSinceLongRun > 28
            ? 'ריצה ארוכה אחת בשבוע היא הבסיס לסיבולת.'
            : `הריצה הארוכה האחרונה הייתה לפני ${load.daysSinceLongRun} ימים.`,
          ...(taper
            ? ['בהורדת העומס מקצרים את הארוכה ושומרים על הקצב.']
            : goalCap && activeGoal
              ? [`לקראת ${activeGoal.label}: בונים בהדרגה עד ריצה ארוכה של כ-${goalCap} ק״מ.`]
              : ['לא יותר מ-10% מעל הארוכה של החודש האחרון — כך הגוף מתחזק בלי להיפצע.']),
        ],
      };
    }
  }

  // 5. Quality — only once the base is there, and not the day after the long run.
  const wantsQuality =
    !taper &&
    established &&
    load.runsLast7Days >= 2 &&
    (load.daysSinceHardRun === null || load.daysSinceHardRun >= 3) &&
    (load.daysSinceLongRun === null || load.daysSinceLongRun >= 2) &&
    phase !== 'base';
  if (wantsQuality) {
    const lastHard = [...load.recentRuns]
      .reverse()
      .find((r) => r.intensity === 'threshold' || r.intensity === 'hard');
    if (lastHard?.intensity === 'threshold') {
      return {
        kind: 'intervals',
        title: 'אינטרוולים: 5 חזרות של 3 דקות',
        detail:
          '10 עד 15 דקות קלות לחימום, ואז 5 חזרות של 3 דקות מהירות עם 2 דקות ריצה קלה מאוד ביניהן. 10 דקות קלות לשחרור.',
        pace: paceOf(bands, 'interval'),
        hr: null,
        reasons: ['האימון הקשה הקודם היה טמפו. אינטרוולים מפתחים את היכולת האירובית המקסימלית.'],
      };
    }
    return {
      kind: 'tempo',
      title: 'טמפו: 20 דקות בקצב סף',
      detail:
        '10 עד 15 דקות קלות, ואז 20 דקות "קשה ונוח": אפשר לומר כמה מילים, לא משפטים. 10 דקות קלות בסוף. אפשר גם פעמיים 10 דקות, עם 2 דקות קלות ביניהן.',
      pace: paceOf(bands, 'threshold'),
      hr: hrRange(hrMax, TEMPO_HR),
      reasons: ['אין ריצה קשה כבר כמה ימים. טמפו מעלה את הקצב שאפשר להחזיק לאורך זמן.'],
    };
  }

  // 6. Easy, with strides when nothing fast happened this week.
  const weekAgo = now.getTime() - 7 * 24 * 60 * 60 * 1000;
  const ranFastThisWeek = load.recentRuns.some(
    (r) => r.at >= weekAgo && r.intensity !== null && r.intensity !== 'easy'
  );
  return easy(
    [
      taper
        ? 'בהורדת העומס הריצות קצרות יותר, והקצב נשאר.'
        : established
          ? 'רוב זמן הריצה צריך להיות קל. ככה בונים סיבולת בלי להישחק.'
          : 'בשבועות הראשונים בונים בסיס: ריצות קלות בלבד, עד שחצי שעה רצופה שלוש פעמים בשבוע מרגישה טבעית.',
    ],
    established && !ranFastThisWeek && !taper
  );
}

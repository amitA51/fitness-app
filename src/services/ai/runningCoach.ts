// ============================================================================
// The AI running coach — the runner's numbers plus the coaching rules, sent
// with each question or run review.
// ============================================================================
// The deterministic coach (services/running) already decided the paces, the
// load picture and the next run; the model's job is to explain, answer and
// adapt — not to invent numbers. Everything rides in one context message that
// ai-chat caps at 4,000 characters (config.withPersona), so the brief is
// compact and checked against that cap.

import {
  type CardioEffort,
  RUN_TYPE_LABELS,
  formatClock,
  formatKm,
  formatPace,
} from '../../utils/cardio';
import {
  GOAL_PHASE_LABELS,
  type GoalProgress,
  type NextRun,
  PACE_EFFORT_LABELS,
  type PaceBand,
  type PaceReference,
  type RunInsight,
  type RunningGoal,
  type RunningLoad,
  calendarDaysAgo,
} from '../running';
import { type ChatMessage, getAIProvider } from './core';

/** Context budget for one ai-chat message, with room for the header. */
const CONTEXT_CHAR_BUDGET = 3900;
/** Chat turns kept with a new question. */
const HISTORY_TURNS = 8;
const QUESTION_MAX_CHARS = 600;

/** The coaching rules every answer follows — short, evidence-weighted. */
const COACH_RULES = [
  'אתה מאמן הריצה של המשתמש. ענה בעברית, בגוף שני רבים, קצר ומעשי (עד 8 שורות), בלי הקדמות.',
  'עקרונות: רוב זמן הריצה קל (מבחן הדיבור, עד ~80% מהדופק המקסימלי); אימון קשה אחד-שניים בשבוע, 48 שעות ביניהם;',
  'הריצה הארוכה לא יותר מ-10% מעל הארוכה של החודש האחרון ועד שעתיים וחצי; טמפו ≈ קצב 5 ק״מ ועוד 16 שניות לק״מ;',
  'לפני מרוץ מורידים 40 עד 60% מהנפח ושומרים עצימות; בחום רצים לפי תחושה ודופק ושותים לפי צמא; אין צורך לשנות סוג נחיתה;',
  'קצב צעדים: אין 180 אוניברסלי — תוספת של 5 עד 10% רק למי שפוסע רחוק מדי. מתחילים: ריצה-הליכה, בלי אימונים מהירים עד חצי שעה רצופה 3 פעמים בשבוע.',
  'בטיחות: אל תאבחן. כאב נקודתי בעצם, כאב במנוחה או בלילה, צליעה, כאב בחזה או סחרחורת — הורה לעצור ולפנות לאיש מקצוע.',
  'השתמש רק במספרים שבנתונים. כשאין נתון — אמור זאת ותן כלל אצבע. אל תסתור את ההמלצה לריצה הבאה בלי להסביר למה.',
  'כתוב טווחים במילים ("6:30 עד 7:10", "3 עד 5 דקות") ולא עם מקף, כדי שיוצגו נכון בעברית.',
].join('\n');

export interface RunningBriefInput {
  goal: RunningGoal | null;
  progress: GoalProgress | null;
  reference: PaceReference | null;
  bands: readonly PaceBand[] | null;
  hrMax: { hrMax: number; measured: boolean } | null;
  load: RunningLoad;
  next: NextRun;
  weeklyGoalKm: number | null;
  now?: Date;
}

const pct = (x: number) => `${Math.round(x * 100)}%`;
const paceRange = (fast: number, slow: number) => `${formatPace(fast)} עד ${formatPace(slow)}`;

function goalLine(goal: RunningGoal, progress: GoalProgress | null): string {
  const parts = [`מטרה: ${goal.label}`];
  if (goal.raceDate) {
    const days = progress?.daysLeft;
    const when =
      days === null || days === undefined
        ? ''
        : days < 0
          ? ' (התאריך כבר עבר)'
          : days === 0
            ? ' (היום)'
            : ` (עוד ${days} ימים)`;
    parts.push(`בתאריך ${goal.raceDate}${when}`);
  } else parts.push('בלי תאריך');
  if (progress) parts.push(`שלב: ${GOAL_PHASE_LABELS[progress.phase]}`);
  if (goal.targetSec) {
    parts.push(
      `זמן יעד ${formatClock(goal.targetSec)} (קצב ${formatPace(goal.targetSec / goal.distanceKm)})`
    );
  }
  let line = parts.join(', ');
  if (progress?.predictedSec) {
    const verdict =
      progress.verdict === 'on_track'
        ? 'בהישג יד'
        : progress.verdict === 'close'
          ? 'קרוב'
          : progress.verdict === 'stretch'
            ? 'עוד רחוק'
            : '';
    line += `. תחזית היום: ${formatClock(progress.predictedSec)}${verdict ? ` — ${verdict}` : ''}`;
  }
  if (progress) {
    line += `. ריצה ארוכה: הכי ארוכה ב-28 יום ${formatKm(progress.longRun.longestKm ?? 0)} ק״מ מתוך ${progress.longRun.targetKm} שצריך. נפח שבועי מקובל למטרה: ${progress.weekly.lowKm} עד ${progress.weekly.highKm} ק״מ.`;
  }
  return line;
}

function recentRunsLines(load: RunningLoad, now: Date): string[] {
  return [...load.recentRuns]
    .reverse()
    .slice(0, 6)
    .map((r) => {
      const days = calendarDaysAgo(r.at, now);
      const when = days === 0 ? 'היום' : days === 1 ? 'אתמול' : `לפני ${days} ימים`;
      const parts = [`${when}: ${formatKm(r.distanceKm)} ק״מ ב-${formatClock(r.durationSec)}`];
      if (r.secPerKm) parts.push(`קצב ${formatPace(r.secPerKm)}`);
      if (r.avgHr) parts.push(`דופק ${r.avgHr}`);
      if (r.intensity) parts.push(PACE_EFFORT_LABELS[r.intensity]);
      return `  - ${parts.join(' | ')}`;
    });
}

/** The runner's numbers, compact, for the model. */
export function runningBrief(input: RunningBriefInput): string {
  const now = input.now ?? new Date();
  const { load } = input;
  const lines = ['--- נתוני הרץ (חישוב של האפליקציה) ---'];

  if (input.goal) lines.push(goalLine(input.goal, input.progress));
  else lines.push('מטרה: לא הוגדרה.');

  if (input.reference) {
    const r = input.reference;
    const estimate = r.confidence === 'low';
    lines.push(
      `כושר נוכחי: שווה ערך ל-5 ק״מ ב-${formatClock(r.fiveKSec)} (מריצה של ${formatKm(r.distanceKm)} ק״מ ב-${formatClock(r.durationSec)}, ${r.date})${
        estimate
          ? ' — זו הייתה ריצה רגילה ולא מאמץ מלא, אז זו הערכה שמרנית; אל תסיק ממנה שהריצות הרגילות מהירות מדי.'
          : '.'
      }`
    );
  } else lines.push('כושר נוכחי: אין עדיין ריצה של 3 ק״מ ומעלה ב-90 הימים האחרונים.');

  if (input.bands) {
    lines.push(
      `קצבים אישיים${input.reference?.confidence === 'low' ? ' (הערכה ראשונית)' : ''} (דק׳ לק״מ): ${input.bands.map((b) => `${b.label} ${paceRange(b.fastSec, b.slowSec)}`).join(' · ')}`
    );
  }

  if (input.hrMax) {
    lines.push(
      `דופק מקסימלי ${input.hrMax.hrMax} (${input.hrMax.measured ? 'נמדד' : 'משוער לפי גיל, עלול לטעות ב-10 פעימות'}); ריצה קלה עד בערך ${Math.round(input.hrMax.hrMax * 0.78)}.`
    );
  }

  const loadParts = [
    `7 ימים: ${formatKm(load.kmLast7Days)} ק״מ ב-${load.runsLast7Days} ריצות`,
    load.priorFourWeekAvgKm !== null
      ? `ממוצע 4 השבועות שלפני: ${formatKm(load.priorFourWeekAvgKm)} ק״מ`
      : 'אין בסיס של חודש קודם',
  ];
  if (load.easyShare !== null) loadParts.push(`זמן קל: ${pct(load.easyShare)}`);
  if (load.longestLast28Km)
    loadParts.push(`הארוכה ב-28 יום: ${formatKm(load.longestLast28Km)} ק״מ`);
  if (input.weeklyGoalKm) loadParts.push(`יעד שבועי: ${input.weeklyGoalKm} ק״מ`);
  lines.push(`עומס: ${loadParts.join(' | ')}.`);
  lines.push(
    `ימים מאז: ריצה ${load.daysSinceLastRun ?? '—'}, ריצה קשה ${load.daysSinceHardRun ?? '—'}, ריצה ארוכה ${load.daysSinceLongRun ?? '—'}.`
  );

  const runs = recentRunsLines(load, now);
  if (runs.length) lines.push('ריצות אחרונות (מהחדשה):', ...runs);

  lines.push(
    `ההמלצה של האפליקציה לריצה הבאה: ${input.next.title}. ${input.next.reasons.join(' ')}`
  );

  return lines.join('\n');
}

/** One run in detail, for a review. */
export function runForReview(
  effort: CardioEffort,
  when: string,
  insights: readonly RunInsight[]
): string {
  const lines = [`--- הריצה לניתוח (${when}) ---`];
  const pace = effort.distanceKm > 0 ? effort.durationSec / effort.distanceKm : null;
  const head = [`${formatKm(effort.distanceKm)} ק״מ ב-${formatClock(effort.durationSec)}`];
  if (pace) head.push(`קצב ממוצע ${formatPace(pace)}`);
  if (effort.avgHr)
    head.push(`דופק ממוצע ${effort.avgHr}${effort.maxHr ? `, שיא ${effort.maxHr}` : ''}`);
  if (effort.elevationGainM >= 10) head.push(`טיפוס ${Math.round(effort.elevationGainM)} מ׳`);
  if (effort.runType) head.push(`סוג: ${RUN_TYPE_LABELS[effort.runType]}`);
  lines.push(head.join(' | '));
  const kms = effort.splits.filter((s) => Math.abs(s.distanceKm - 1) < 0.02);
  if (kms.length >= 2) {
    lines.push(
      `קצב לכל ק״מ: ${kms
        .slice(0, 30)
        .map((s) => `${formatPace(s.seconds)}${s.avgHr ? `/${s.avgHr}` : ''}`)
        .join(' ')}`
    );
  }
  if (insights.length) {
    lines.push(`מה האפליקציה זיהתה: ${insights.map((i) => i.title).join('; ')}.`);
  }
  return lines.join('\n');
}

/** Fit the context into one ai-chat message: drop the oldest run lines first. */
export function fitContext(text: string, budget = CONTEXT_CHAR_BUDGET): string {
  if (text.length <= budget) return text;
  const lines = text.split('\n');
  while (lines.join('\n').length > budget) {
    const lastRun = lines.map((l) => l.startsWith('  - ')).lastIndexOf(true);
    if (lastRun === -1) break;
    lines.splice(lastRun, 1);
  }
  const joined = lines.join('\n');
  return joined.length <= budget ? joined : joined.slice(0, budget);
}

const cleanQuestion = (q: string) =>
  q
    // biome-ignore lint/suspicious/noControlCharactersInRegex: strip control characters from user text
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, QUESTION_MAX_CHARS);

export interface CoachTurn {
  role: 'user' | 'assistant';
  content: string;
}

/** Ask the running coach a question, with the runner's brief and the recent chat. */
export async function askRunningCoach(
  question: string,
  brief: string,
  history: readonly CoachTurn[] = []
): Promise<string> {
  const q = cleanQuestion(question);
  if (!q) throw new Error('empty question');
  const messages: ChatMessage[] = [
    { role: 'system', content: fitContext(`${COACH_RULES}\n\n${brief}`) },
    ...history
      .slice(-HISTORY_TURNS)
      .map((t) => ({ role: t.role, content: t.content.slice(0, 3000) })),
    { role: 'user', content: q },
  ];
  return getAIProvider().chat(messages);
}

/** A coach's review of one run: what went well, what to change, what next. */
export async function reviewRun(runText: string, brief: string): Promise<string> {
  const messages: ChatMessage[] = [
    {
      role: 'system',
      content: fitContext(`${COACH_RULES}\n\n${runText}\n\n${brief}`),
    },
    {
      role: 'user',
      content:
        'נתחו את הריצה הזאת בשלושה חלקים קצרים: מה היה טוב, מה כדאי לשפר בפעם הבאה, ומה הריצה הבאה. עד 6 שורות, בלי לחזור על המספרים שכבר מוצגים לי.',
    },
  ];
  return getAIProvider().chat(messages);
}

/** Questions a runner tends to ask — shown as one-tap chips. */
export const SUGGESTED_QUESTIONS: readonly string[] = [
  'מה לעשות השבוע?',
  'איך משתפרים ב-5 ק״מ?',
  'למה הדופק שלי עולה בריצות ארוכות?',
  'איך רצים בחום?',
  'כמה לרוץ בשבוע לקראת המטרה?',
];

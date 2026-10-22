// ============================================================================
// One run, read like a coach would — a few short notes, most important first.
// ============================================================================
// Deterministic and offline: pacing (did they start too fast?), evenness of
// the kilometres, heart-rate drift on a steady run, whether an "easy" run was
// really easy, the long-run jump, and a heat note in the Israeli summer.

import type { CardioEffort } from '../../utils/cardio';
import { type PaceBand, paceEffort } from './paceBands';

export type InsightTone = 'good' | 'note' | 'warn';

export interface RunInsight {
  id: string;
  tone: InsightTone;
  title: string;
  body: string;
}

/** Second half this much slower (per km) than the first = faded. */
const POSITIVE_SPLIT = 0.04;
/** Second half this much faster = a negative split. */
const NEGATIVE_SPLIT = 0.02;
/** Coefficient of variation of km times above this = uneven. */
const UNEVEN_CV = 0.08;
/** Heart-rate rise first → second half, as a fraction, on a steady run. */
const DRIFT_NOTE = 0.05;

const wholeKm = (effort: CardioEffort) =>
  effort.splits.filter((s) => Math.abs(s.distanceKm - 1) < 0.02 && s.seconds > 0);

function halves<T>(items: readonly T[]): [T[], T[]] {
  const mid = Math.floor(items.length / 2);
  return [items.slice(0, mid), items.slice(items.length - mid)];
}

const mean = (xs: readonly number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;

export interface RunInsightInput {
  effort: CardioEffort;
  bands: readonly PaceBand[] | null;
  hrMax: number | null;
  /** Longest run in the 30 days before this one, km. */
  longestPrior30Km: number | null;
  /** When the run happened. */
  at: Date;
}

export function runInsights({
  effort,
  bands,
  hrMax,
  longestPrior30Km,
  at,
}: RunInsightInput): RunInsight[] {
  if (effort.discipline !== 'running') return [];
  const out: RunInsight[] = [];
  const kms = wholeKm(effort);

  // Pacing: first half vs second half of the whole kilometres.
  if (kms.length >= 4) {
    const [first, second] = halves(kms.map((k) => k.seconds));
    const change = mean(second) / mean(first) - 1;
    if (change > POSITIVE_SPLIT) {
      out.push({
        id: 'faded',
        tone: 'note',
        title: 'החצי השני היה איטי יותר',
        body: `הקילומטרים האחרונים היו איטיים בכ-${Math.round(change * 100)}% מהראשונים. בפעם הבאה התחילו לאט יותר — רוב הרצים מסיימים חזק יותר כשהם מתאפקים בהתחלה.`,
      });
    } else if (change < -NEGATIVE_SPLIT) {
      out.push({
        id: 'negative_split',
        tone: 'good',
        title: 'סיום חזק',
        body: 'החצי השני היה מהיר מהראשון. זו בדיוק החלוקה הנכונה של מאמץ.',
      });
    }

    const secs = kms.map((k) => k.seconds);
    const avg = mean(secs);
    const cv = Math.sqrt(mean(secs.map((s) => (s - avg) ** 2))) / avg;
    if (cv > UNEVEN_CV && effort.runType !== 'intervals') {
      out.push({
        id: 'uneven',
        tone: 'note',
        title: 'קצב לא אחיד',
        body: 'הפער בין הקילומטר המהיר לאיטי גדול. בריצה רציפה נסו להחזיק קצב יציב — זה חוסך אנרגיה. עליות וירידות יכולות להסביר חלק מזה.',
      });
    }
  }

  // Heart-rate drift (aerobic decoupling) — meaningful only on a steady run of
  // 40+ minutes; under 5% is normal (Friel's practitioner rule, unvalidated).
  const hrKms = kms.filter((k) => (k.avgHr ?? 0) > 0);
  if (
    hrKms.length >= 4 &&
    effort.durationSec >= 40 * 60 &&
    effort.runType !== 'intervals' &&
    effort.runType !== 'tempo'
  ) {
    const [first, second] = halves(hrKms);
    const drift =
      mean(second.map((k) => k.avgHr as number)) / mean(first.map((k) => k.avgHr as number)) - 1;
    if (drift > DRIFT_NOTE) {
      const summer = [5, 6, 7, 8, 9].includes(at.getMonth() + 1);
      out.push({
        id: 'drift',
        tone: 'note',
        title: 'הדופק טיפס לאורך הריצה',
        body: summer
          ? `הדופק עלה בכ-${Math.round(drift * 100)}% במחצית השנייה. בחום זה צפוי — הגוף מאבד נוזלים והלב עובד קשה יותר. שתו לפי צמא, ובימים חמים רוצו לפי תחושה ודופק, לא לפי הקצב הרגיל.`
          : `הדופק עלה בכ-${Math.round(drift * 100)}% במחצית השנייה בלי שהקצב עלה. זה סימן שהבסיס האירובי עוד נבנה, או שהקצב היה קצת גבוה לריצה ארוכה — עוד ריצות קלות וארוכות יעזרו.`,
      });
    }
  }

  // Was the "easy" run really easy?
  const secPerKm = effort.distanceKm > 0 ? effort.durationSec / effort.distanceKm : 0;
  const wantedEasy =
    effort.runType === 'easy' || effort.runType === 'recovery' || effort.runType === 'long';
  if (wantedEasy) {
    const byHr = effort.avgHr && hrMax ? effort.avgHr / hrMax : null;
    const tooHard =
      (byHr !== null && byHr >= 0.82) ||
      (byHr === null && bands && secPerKm > 0 && paceEffort(secPerKm, bands) !== 'easy');
    if (tooHard) {
      out.push({
        id: 'easy_too_fast',
        tone: 'warn',
        title: 'הריצה הקלה לא הייתה קלה',
        body: 'הקצב או הדופק היו גבוהים לריצה קלה. ריצות קלות מהירות מדי מעייפות בלי לבנות יותר כושר, ופוגעות באימונים הקשים. כלל אצבע: אם אי אפשר לדבר במשפטים — האטו.',
      });
    }
  }

  // Long-run jump. Against the longest run of the prior 30 days, more than
  // +10% raised injury risk ~1.5–1.6× and more than doubling ~2.3× (Frandsen
  // 2025, 5,205 runners) — a stronger signal than week-to-week mileage.
  if (longestPrior30Km && effort.distanceKm > longestPrior30Km * 1.1) {
    const pct = Math.round((effort.distanceKm / longestPrior30Km - 1) * 100);
    const big = pct > 30;
    out.push({
      id: 'long_jump',
      tone: big ? 'warn' : 'note',
      title: 'קפיצה במרחק',
      body: `ארוכה ב-${pct}% מהריצה הארוכה ביותר בחודש שלפני. ${
        big
          ? 'קפיצה גדולה מגדילה את הסיכון לפציעה. תנו לגוף יומיים קלים, ושימו לב לכאב בשוק, בברך או בכף הרגל.'
          : 'מעל 10% בבת אחת כבר מעלה את הסיכון לפציעה — את הארוכה הבאה הגדילו בהדרגה.'
      }`,
    });
  }

  // Heat, when nothing above already spoke about it.
  const month = at.getMonth() + 1;
  if (
    [6, 7, 8, 9].includes(month) &&
    effort.durationSec >= 45 * 60 &&
    !out.some((i) => i.id === 'drift')
  ) {
    out.push({
      id: 'heat',
      tone: 'note',
      title: 'ריצה בעונה החמה',
      body: 'בקיץ הישראלי רצים מוקדם בבוקר או אחרי השקיעה, ומודדים את המאמץ לפי תחושה ודופק — לא לפי הקצב של החורף. בריצה של יותר משעה קחו מים ושתו לפי צמא.',
    });
  }

  // Only claim "steady" when the splits were there to show it.
  if (out.length === 0 && kms.length >= 4) {
    out.push({
      id: 'steady',
      tone: 'good',
      title: 'ריצה מסודרת',
      body:
        hrKms.length >= 4
          ? 'קצב יציב ודופק יציב לאורך כל הדרך. כך נראית ריצה שבונה כושר.'
          : 'קצב יציב לאורך כל הדרך. כך נראית ריצה שבונה כושר.',
    });
  }

  const order: Record<InsightTone, number> = { warn: 0, note: 1, good: 2 };
  return out.sort((a, b) => order[a.tone] - order[b.tone]);
}

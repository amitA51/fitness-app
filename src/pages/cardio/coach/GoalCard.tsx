// "המטרה" — what the runner trains for and where they stand: the date and the
// phase, the target against today's prediction, the long run and the weekly
// volume the distance asks for.

import { Pencil, Target } from 'lucide-react';
import {
  GOAL_PHASE_LABELS,
  type GoalProgress,
  type RunningGoal,
  targetPaceSecPerKm,
} from '../../../services/running';
import { UNIT_KM, UNIT_PACE_KM, formatClock, formatKm, formatPace } from '../../../utils/cardio';
import { Meter } from './Meter';
import { VERDICT_LABELS, VERDICT_TONE, daysLeftText, hebrewDayMonth } from './coachFormat';

/** Riegel is trusted up to the half (goalProgress.PREDICT_MAX_KM). */
const PREDICT_MAX_KM = 21.1;

interface GoalCardProps {
  goal: RunningGoal | null;
  progress: GoalProgress | null;
  hasReference: boolean;
  /** The prediction comes from an ordinary run, not a full effort. */
  estimateOnly?: boolean;
  now: Date;
  /** Open the goal sheet; `fresh` starts a new goal instead of editing this one. */
  onEdit: (fresh: boolean) => void;
  /** Remove the goal (offered once its date has passed). */
  onClear: () => void;
}

export function GoalCard({
  goal,
  progress,
  hasReference,
  estimateOnly = false,
  now,
  onEdit,
  onClear,
}: GoalCardProps) {
  if (!goal || !progress) {
    return (
      <section className="rc-card" aria-labelledby="rc-goal-h">
        <h2 id="rc-goal-h" className="rc-title">
          המטרה שלכם
        </h2>
        <p className="rc-body">
          5 ק״מ ראשונים, 10 ק״מ בזמן מסוים או חצי מרתון — עם מטרה, המאמן בונה את הריצות סביבה.
        </p>
        <button type="button" className="cta-secondary focus-ring" onClick={() => onEdit(true)}>
          <Target size={18} aria-hidden="true" />
          הגדירו מטרה
        </button>
      </section>
    );
  }

  if (progress.phase === 'past') {
    return (
      <section className="rc-card" aria-labelledby="rc-goal-h">
        <h2 id="rc-goal-h" className="rc-title">
          המרוץ עבר — מה הלאה?
        </h2>
        <p className="rc-body">
          המטרה ({goal.label}
          {goal.raceDate ? `, ${hebrewDayMonth(goal.raceDate, now)}` : ''}) כבר מאחוריכם. הגדירו
          מטרה חדשה, והמאמן יבנה סביבה את הריצות הבאות.
        </p>
        <button type="button" className="cta-secondary focus-ring" onClick={() => onEdit(true)}>
          <Target size={18} aria-hidden="true" />
          מטרה חדשה
        </button>
        <button
          type="button"
          className="cta-ghost focus-ring"
          style={{ justifySelf: 'center' }}
          onClick={onClear}
        >
          בלי מטרה כרגע
        </button>
      </section>
    );
  }

  const targetPace = targetPaceSecPerKm(goal);
  const { longRun, weekly } = progress;

  return (
    <section className="rc-card" aria-labelledby="rc-goal-h">
      <div className="rc-card-head">
        <h2 id="rc-goal-h" className="rc-title">
          המטרה
        </h2>
        <button
          type="button"
          className="cta-ghost focus-ring rc-edit"
          onClick={() => onEdit(false)}
        >
          <Pencil size={14} aria-hidden="true" />
          עריכה
        </button>
      </div>

      <div style={{ display: 'grid', gap: 8 }}>
        <p className="rc-big">
          <span className="rc-big-value">{goal.label}</span>
          {goal.targetSec && (
            <span className="rc-big-sub">
              ב-
              <span className="kinetic-number" dir="ltr">
                {formatClock(goal.targetSec)}
              </span>
            </span>
          )}
        </p>
        <div className="rc-tags">
          <span className="rc-chip">{GOAL_PHASE_LABELS[progress.phase]}</span>
          {goal.raceDate && progress.daysLeft !== null && (
            <span className="rc-muted" style={{ fontSize: 14 }}>
              {hebrewDayMonth(goal.raceDate, now)} · {daysLeftText(progress.daysLeft)}
            </span>
          )}
        </div>
        {targetPace && (
          <p className="rc-muted" style={{ fontSize: 14 }}>
            קצב יעד{' '}
            <span className="kinetic-number" dir="ltr">
              {formatPace(targetPace)}
            </span>{' '}
            {UNIT_PACE_KM}
          </p>
        )}
      </div>

      <Prediction
        goal={goal}
        progress={progress}
        hasReference={hasReference}
        estimateOnly={estimateOnly}
      />

      <Meter
        label="הריצה הארוכה"
        value={
          <>
            <span className="kinetic-number">{formatKm(longRun.longestKm ?? 0)}</span> מתוך{' '}
            <span className="kinetic-number">{longRun.targetKm}</span> {UNIT_KM}
          </>
        }
        share={longRun.share}
        caption={
          longRun.share >= 1
            ? 'הגעתם לאורך שהמטרה צריכה. עכשיו שומרים עליו.'
            : 'הארוכה ביותר ב-4 השבועות האחרונים. מאריכים בהדרגה, עד 10% בכל פעם.'
        }
      />

      {weekly.recentAvgKm !== null ? (
        <Meter
          label="נפח שבועי"
          value={
            <>
              <span className="kinetic-number">{formatKm(weekly.recentAvgKm)}</span> {UNIT_KM}{' '}
              בממוצע
            </>
          }
          share={weekly.recentAvgKm / (weekly.highKm * 1.15)}
          band={{ from: weekly.lowKm / (weekly.highKm * 1.15), to: 1 / 1.15 }}
          caption={
            <>
              מקובל למטרה הזאת:{' '}
              <span className="kinetic-number" dir="ltr">
                {weekly.lowKm}–{weekly.highKm}
              </span>{' '}
              {UNIT_KM} בשבוע (הטווח המסומן בפס). בונים לשם לאט.
            </>
          }
        />
      ) : (
        <p className="rc-muted">
          אחרי כמה שבועות של ריצה תראו כאן את הנפח השבועי מול מה שהמטרה צריכה (
          <span className="kinetic-number" dir="ltr">
            {weekly.lowKm}–{weekly.highKm}
          </span>{' '}
          {UNIT_KM} בשבוע).
        </p>
      )}
    </section>
  );
}

function Prediction({
  goal,
  progress,
  hasReference,
  estimateOnly,
}: {
  goal: RunningGoal;
  progress: GoalProgress;
  hasReference: boolean;
  /** The prediction comes from an ordinary run, not a full effort. */
  estimateOnly?: boolean;
}) {
  if (progress.predictedSec === null) {
    return (
      <p className="rc-muted">
        {hasReference && goal.distanceKm > PREDICT_MAX_KM
          ? 'למרחק כזה אין תחזית אמינה מריצה קצרה. הריצות הארוכות הן המדד.'
          : 'תחזית לזמן הסיום תופיע אחרי ריצה של 3 ק״מ ומעלה.'}
      </p>
    );
  }
  return (
    <div className="rc-row" style={{ borderBottom: 0, paddingBlock: 0 }}>
      <span className="rc-row-label">
        <span style={{ fontWeight: 600 }}>תחזית היום</span>
        <span className="rc-row-hint">
          {estimateOnly ? 'הערכה מריצה רגילה, כנראה שמרנית' : 'לפי הריצה הטובה האחרונה'}
        </span>
      </span>
      <span className="rc-tags">
        <span
          className="kinetic-number rc-row-value"
          dir="ltr"
          style={{ fontFamily: 'var(--font-display)', fontSize: 22 }}
        >
          {formatClock(progress.predictedSec)}
        </span>
        {progress.verdict && (
          <span className="rc-chip" data-tone={VERDICT_TONE[progress.verdict]}>
            {VERDICT_LABELS[progress.verdict]}
          </span>
        )}
      </span>
    </div>
  );
}

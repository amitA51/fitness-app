// "השבוע" — kilometres against the weekly goal, how many runs, how much of the
// running was easy, and how long since the last long run.

import { Pencil } from 'lucide-react';
import { useState } from 'react';
import { type RunningLoad, longRunThresholdKm } from '../../../services/running';
import { UNIT_KM, formatKm } from '../../../utils/cardio';
import { getWeekStart } from '../../../utils/dateUtils';
import { Meter } from './Meter';
import { WeeklyGoalSheet } from './WeeklyGoalSheet';
import { EASY_SHARE_GUIDE, daysAgoText } from './coachFormat';

interface WeekCardProps {
  load: RunningLoad;
  weeklyGoalKm: number | null;
  hasRuns: boolean;
  now: Date;
  /** The goal's usual weekly range, as a hint in the sheet. */
  goalRange: { lowKm: number; highKm: number } | null;
}

function easyShareNote(share: number): string {
  if (share >= EASY_SHARE_GUIDE.low) return 'מצוין: רוב הריצה קלה, כמו שצריך.';
  if (share >= 0.6) return 'כדאי יותר ריצה קלה: האטו חלק מהריצות.';
  return 'רוב הריצות מהירות מדי. האטו את הריצות הקלות — ככה בונים סיבולת בלי להישחק.';
}

export function WeekCard({ load, weeklyGoalKm, hasRuns, now, goalRange }: WeekCardProps) {
  const [editing, setEditing] = useState(false);
  const weekStart = getWeekStart(now).getTime();
  const runsThisWeek = load.recentRuns.filter((r) => r.at >= weekStart).length;
  const weekKm = load.thisWeekKm;
  const left = weeklyGoalKm ? weeklyGoalKm - weekKm : null;
  // The same "last four weeks" average the goal card shows (goalProgress).
  const pastWeeks = load.weeklyKm.slice(0, -1);
  const pastTotal = pastWeeks.reduce((a, b) => a + b, 0);
  const recentAvgKm = pastTotal > 0 ? pastTotal / pastWeeks.length : null;

  // Before the first run there is nothing to count — no big zero, just what will appear.
  if (!hasRuns) {
    return (
      <section className="rc-card" aria-labelledby="rc-week-h">
        <h2 id="rc-week-h" className="rc-title">
          השבוע
        </h2>
        <p className="rc-muted">
          אחרי הריצה הראשונה תראו כאן כמה רצתם, כמה מהריצה הייתה קלה ומתי הייתה הארוכה האחרונה.
        </p>
      </section>
    );
  }

  return (
    <section className="rc-card" aria-labelledby="rc-week-h">
      <div className="rc-card-head">
        <h2 id="rc-week-h" className="rc-title">
          השבוע
        </h2>
        <button
          type="button"
          className="cta-ghost focus-ring rc-edit"
          onClick={() => setEditing(true)}
        >
          <Pencil size={14} aria-hidden="true" />
          {weeklyGoalKm ? 'שינוי יעד' : 'הגדרת יעד'}
        </button>
      </div>

      <p className="rc-big">
        <span className="rc-big-value kinetic-number">{formatKm(weekKm)}</span>
        {weeklyGoalKm && (
          <span className="rc-big-sub kinetic-number">/ {formatKm(weeklyGoalKm)}</span>
        )}
        <span className="rc-big-unit">{UNIT_KM}</span>
      </p>

      {weeklyGoalKm ? (
        <Meter
          label="היעד השבועי"
          value={
            left !== null && left > 0 ? (
              <>
                נשארו <span className="kinetic-number">{formatKm(left)}</span> {UNIT_KM}
              </>
            ) : (
              'עמדתם ביעד'
            )
          }
          share={weekKm / weeklyGoalKm}
        />
      ) : (
        <p className="rc-muted">יעד שבועי עוזר להתמיד. הגדירו אותו, והגדילו בהדרגה.</p>
      )}

      <ul className="rc-rows">
        <li className="rc-row">
          <span>ריצות השבוע</span>
          <span className="rc-row-value kinetic-number">{runsThisWeek}</span>
        </li>
        {load.easyShare !== null && (
          <li className="rc-row" style={{ display: 'block' }}>
            <Meter
              label="ריצה קלה (4 שבועות)"
              value={
                <>
                  <span className="kinetic-number" dir="ltr">
                    {Math.round(load.easyShare * 100)}%
                  </span>{' '}
                  מהזמן
                </>
              }
              share={load.easyShare}
              band={{ from: EASY_SHARE_GUIDE.low, to: EASY_SHARE_GUIDE.high }}
              caption={
                <>
                  המומלץ:{' '}
                  <span className="kinetic-number" dir="ltr">
                    75–80%
                  </span>{' '}
                  (המסומן בפס). {easyShareNote(load.easyShare)}
                </>
              }
            />
          </li>
        )}
        <li className="rc-row">
          <span className="rc-row-label">
            <span>ריצה ארוכה אחרונה</span>
            {/* The same rule the coach counts by (trainingLoad.longRunThresholdKm). */}
            <span className="rc-row-hint">
              שעה ורבע ומעלה, או{' '}
              <span className="kinetic-number">
                {formatKm(longRunThresholdKm(load.medianRunKm))}
              </span>{' '}
              {UNIT_KM} ומעלה
            </span>
          </span>
          <span className="rc-row-value">
            {load.daysSinceLongRun === null ? 'עוד לא הייתה' : daysAgoText(load.daysSinceLongRun)}
          </span>
        </li>
      </ul>

      <WeeklyGoalSheet
        key={editing ? 'open' : 'closed'}
        isOpen={editing}
        onClose={() => setEditing(false)}
        currentKm={weeklyGoalKm}
        recentAvgKm={recentAvgKm}
        goalRange={goalRange}
      />
    </section>
  );
}

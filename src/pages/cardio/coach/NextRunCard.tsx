// "הריצה הבאה" — the one thing to do next, how to run it, and why.

import { Play } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import type { NextRun } from '../../../services/running';
import { UNIT_PACE_KM } from '../../../utils/cardio';
import { paceRangeText } from './coachFormat';

interface NextRunCardProps {
  next: NextRun;
  hasRuns: boolean;
}

export function NextRunCard({ next, hasRuns }: NextRunCardProps) {
  const navigate = useNavigate();
  const isRest = next.kind === 'rest';

  return (
    <section className="rc-card rc-hero" aria-labelledby="rc-next-h">
      <div style={{ display: 'grid', gap: 6 }}>
        <h2 id="rc-next-h" className="rc-kicker">
          {hasRuns ? 'הריצה הבאה' : 'הריצה הראשונה'}
        </h2>
        <p className="rc-hero-title">{next.title}</p>
      </div>

      {!hasRuns && (
        <p className="rc-body" style={{ fontWeight: 600 }}>
          מתחילים בקטן. אחרי כמה ריצות המאמן יתאים לכם קצבים, דופק ועומס.
        </p>
      )}

      <p className="rc-body">{next.detail}</p>

      {(next.pace || next.hr) && (
        <div className="rc-guides">
          {next.pace && (
            <div className="rc-guide">
              <span className="rc-guide-label">קצב</span>
              <span className="rc-guide-value kinetic-number" dir="ltr">
                {paceRangeText(next.pace.fastSec, next.pace.slowSec)}
              </span>
              <span className="rc-guide-unit">{UNIT_PACE_KM}</span>
            </div>
          )}
          {next.hr && (
            <div className="rc-guide">
              <span className="rc-guide-label">דופק</span>
              <span className="rc-guide-value kinetic-number" dir="ltr">
                {next.hr.low}–{next.hr.high}
              </span>
              <span className="rc-guide-unit">פעימות בדקה</span>
            </div>
          )}
        </div>
      )}

      {/* A new runner already read why above; the reasons start with the first run. */}
      {hasRuns && next.reasons.length > 0 && (
        <div style={{ display: 'grid', gap: 4 }}>
          {next.reasons.slice(0, 2).map((reason) => (
            <p key={reason} className="rc-muted">
              {reason}
            </p>
          ))}
        </div>
      )}

      <div className="rc-actions">
        {isRest ? (
          <button
            type="button"
            className="cta-secondary focus-ring"
            onClick={() => navigate('/cardio/log?activity=run')}
          >
            רשמו ריצה
          </button>
        ) : (
          <>
            <button
              type="button"
              className="start-workout-btn focus-ring"
              onClick={() => navigate('/cardio/live?activity=run')}
            >
              <Play size={20} aria-hidden="true" />
              התחילו ריצה
            </button>
            <button
              type="button"
              className="cta-ghost focus-ring"
              onClick={() => navigate('/cardio/log?activity=run')}
            >
              רצתם כבר? רשמו ריצה
            </button>
          </>
        )}
      </div>
    </section>
  );
}

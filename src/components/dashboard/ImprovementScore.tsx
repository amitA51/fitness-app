import { memo, useMemo } from 'react';
import type { WorkoutSession } from '../../types';

interface ImprovementScoreProps {
  sessions: WorkoutSession[];
}

export const ImprovementScore = memo(function ImprovementScore({
  sessions,
}: ImprovementScoreProps) {
  const score = useMemo(() => {
    if (sessions.length < 2) return null;

    const now = Date.now();
    const fourWeeksAgo = now - 28 * 86400000;
    const recentSessions = sessions.filter(
      (s) => s.status === 'completed' && new Date(s.startTime).getTime() >= fourWeeksAgo
    );

    if (recentSessions.length < 2) return null;

    const weekSize = 7 * 86400000;
    const lastWeek = recentSessions.filter((s) => {
      const d = new Date(s.startTime).getTime();
      return d >= now - weekSize;
    });
    const prevWeek = recentSessions.filter((s) => {
      const d = new Date(s.startTime).getTime();
      return d >= now - 2 * weekSize && d < now - weekSize;
    });

    const lastVol = lastWeek.reduce((sum, s) => sum + (s.totalVolume || 0), 0);
    const prevVol = prevWeek.reduce((sum, s) => sum + (s.totalVolume || 0), 0);
    const volChange = prevVol > 0 ? ((lastVol - prevVol) / prevVol) * 100 : 0;

    const freqChange =
      prevWeek.length > 0
        ? ((lastWeek.length - prevWeek.length) / prevWeek.length) * 100
        : lastWeek.length > 0
          ? 100
          : 0;

    const lastDur = lastWeek.reduce((sum, s) => sum + s.duration, 0);
    const prevDur = prevWeek.reduce((sum, s) => sum + s.duration, 0);
    const durChange = prevDur > 0 ? ((lastDur - prevDur) / prevDur) * 100 : 0;

    const improvement = volChange * 0.4 + freqChange * 0.3 + durChange * 0.3;

    return {
      value: Math.round(improvement),
      volChange: Math.round(volChange),
      freqChange: Math.round(freqChange),
      durChange: Math.round(durChange),
    };
  }, [sessions]);

  if (!score) {
    return (
      <div
        style={{
          background: 'var(--fs-surface)',
          border: '1px solid var(--fs-surface-2)',
          borderRadius: '22px 16px 22px 16px',
          boxShadow: 'var(--shadow-card)',
          padding: 16,
        }}
      >
        <div className="eyebrow" style={{ marginBottom: 8 }}>
          §&nbsp;Improvement
        </div>
        <p
          style={{
            fontFamily: 'var(--font-display)',
            fontWeight: 800,
            fontSize: 28,
            lineHeight: 1,
            color: 'var(--fs-primary)',
            textTransform: 'uppercase',
            letterSpacing: '-0.01em',
          }}
        >
          צבור נתונים
        </p>
        <p
          className="mt-2"
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 11,
            color: 'var(--fs-muted)',
            letterSpacing: '0.1em',
          }}
        >
          אימון שבועיים לפחות
        </p>
      </div>
    );
  }

  const isPositive = score.value >= 0;
  const arrow = isPositive ? '+' : '−';

  return (
    <div
      className="magnetic-card glass-surface fs-accent-rail section-spotlight"
      style={{
        border: '1px solid var(--fs-surface-2)',
        borderRadius: '22px 16px 22px 16px',
        boxShadow: 'var(--shadow-card)',
        padding: 16,
      }}
    >
      <div className="flex items-baseline justify-between mb-3">
        <span className="eyebrow">§&nbsp;Improvement · 7d</span>
        <span
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 11,
            color: 'var(--fs-muted)',
            letterSpacing: '0.16em',
            textTransform: 'uppercase',
          }}
        >
          {isPositive ? 'שיפור' : 'ירידה'}
        </span>
      </div>

      <div
        style={{
          fontFamily: 'var(--font-display)',
          fontWeight: 900,
          fontSize: 48,
          lineHeight: 0.9,
          color: 'var(--fs-ink)',
          letterSpacing: '-0.02em',
        }}
      >
        <span className="kinetic-number large" style={{ fontSize: 48 }}>
          {arrow}
          {Math.abs(score.value)}%
        </span>
      </div>

      <div
        className="mt-3 grid grid-cols-3 gap-2 pt-3"
        style={{ borderTop: '1px solid var(--fs-surface-2)' }}
      >
        <div>
          <div
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 10,
              color: 'var(--fs-muted)',
              letterSpacing: '0.22em',
              textTransform: 'uppercase',
            }}
          >
            ווליום
          </div>
          <div
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 13,
              color: 'var(--fs-primary)',
              fontWeight: 500,
            }}
          >
            <span className="kinetic-number">
              {score.volChange > 0 ? '+' : ''}
              {score.volChange}%
            </span>
          </div>
        </div>
        <div>
          <div
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 10,
              color: 'var(--fs-muted)',
              letterSpacing: '0.22em',
              textTransform: 'uppercase',
            }}
          >
            תדירות
          </div>
          <div
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 13,
              color: 'var(--fs-primary)',
              fontWeight: 500,
            }}
          >
            <span className="kinetic-number">
              {score.freqChange > 0 ? '+' : ''}
              {score.freqChange}%
            </span>
          </div>
        </div>
        <div>
          <div
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 10,
              color: 'var(--fs-muted)',
              letterSpacing: '0.22em',
              textTransform: 'uppercase',
            }}
          >
            משך
          </div>
          <div
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 13,
              color: 'var(--fs-primary)',
              fontWeight: 500,
            }}
          >
            <span className="kinetic-number">
              {score.durChange > 0 ? '+' : ''}
              {score.durChange}%
            </span>
          </div>
        </div>
      </div>
    </div>
  );
});

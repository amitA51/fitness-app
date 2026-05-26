import type { WorkoutTemplate } from '../../types';

interface WeeklyStatsBlockProps {
  workoutsThisWeek: number;
  weeklyGoal: number;
  pct: number;
  volume: number;
  volDeltaPct: number;
  lastUsedTemplate: WorkoutTemplate | null;
  onQuickStart: () => void;
}

export function WeeklyStatsBlock({
  workoutsThisWeek,
  weeklyGoal,
  pct,
  volume,
  volDeltaPct,
  lastUsedTemplate,
  onQuickStart,
}: WeeklyStatsBlockProps) {
  const volumeFormatted =
    Math.round(volume) >= 1000
      ? Math.round(volume).toLocaleString('en-US')
      : String(Math.round(volume));

  const volDeltaFormatted = (() => {
    if (!Number.isFinite(volDeltaPct) || volDeltaPct === 0) return '—';
    const sign = volDeltaPct > 0 ? '+' : '';
    return `${sign}${volDeltaPct.toFixed(1)}%`;
  })();

  const goalHit = pct >= 100;
  return (
    <div
      className="magnetic-card glass-surface fs-accent-rail"
      style={{
        borderRadius: '22px 16px 22px 16px',
        border: '1px solid var(--fs-surface-2)',
        padding: 20,
        boxShadow: 'var(--shadow-card)',
      }}
    >
      {/* Primary CTA */}
      <button
        type="button"
        onClick={onQuickStart}
        className="accent-glow"
        aria-label={
          lastUsedTemplate ? `התחל מחדש אימון ${lastUsedTemplate.name}` : 'התחל אימון חדש'
        }
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          width: '100%',
          padding: '16px 20px',
          background: 'linear-gradient(135deg, var(--fs-accent), var(--fs-accent-2))',
          border: '2px solid var(--fs-accent)',
          borderRadius: '22px 16px 22px 16px',
          cursor: 'pointer',
          color: '#071412',
          fontFamily: 'var(--font-display)',
          fontWeight: 900,
          fontSize: 22,
          textAlign: 'right',
          lineHeight: 1,
          letterSpacing: '-0.01em',
        }}
      >
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 36,
            height: 36,
            borderRadius: '50%',
            background: 'var(--fs-accent)',
            color: 'var(--fs-heading)',
            fontFamily: 'var(--font-mono)',
            fontSize: 18,
            fontWeight: 600,
            flexShrink: 0,
          }}
        >
          →
        </span>
        <span>התחל אימון חדש</span>
      </button>

      {/* Stats row */}
      <div
        style={{
          marginTop: 16,
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: 10,
        }}
      >
        <div style={{ textAlign: 'center' }}>
          <div
            style={{
              fontFamily: 'var(--font-mono)',
              fontWeight: 600,
              fontSize: 20,
              lineHeight: 1,
              color: 'var(--fs-ink)',
            }}
          >
            <span className="kinetic-number">{String(workoutsThisWeek).padStart(2, '0')}</span>
          </div>
          <div
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 9,
              color: 'var(--fs-muted)',
              marginTop: 4,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
            }}
          >
            אימונים
          </div>
          <div
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 9,
              color: 'var(--fs-muted)',
              letterSpacing: '0.06em',
            }}
          >
            מתוך {weeklyGoal} · {pct}% יעד
          </div>
        </div>
        <div style={{ textAlign: 'center' }}>
          <div
            style={{
              fontFamily: 'var(--font-mono)',
              fontWeight: 600,
              fontSize: 20,
              lineHeight: 1,
              color: 'var(--fs-ink)',
            }}
          >
            <span className="kinetic-number">{volumeFormatted || '—'}</span>
          </div>
          <div
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 9,
              color: 'var(--fs-muted)',
              marginTop: 4,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
            }}
          >
            kg volume
          </div>
          <div
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 9,
              color: 'var(--fs-accent)',
              letterSpacing: '0.06em',
            }}
          >
            {volDeltaFormatted}
          </div>
        </div>
      </div>

      {/* Weekly goal progress */}
      <div
        className={`fs-progress-track${goalHit ? ' accent-glow' : ''}`}
        style={{ marginTop: 12 }}
      >
        <div
          className="fs-progress-fill"
          style={{ width: `${Math.min(Math.max(pct, 0), 100)}%` }}
        />
      </div>
    </div>
  );
}

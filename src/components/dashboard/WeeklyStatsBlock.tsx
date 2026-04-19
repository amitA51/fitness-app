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

  return (
    <>
      <button
        type="button"
        onClick={onQuickStart}
        aria-label={
          lastUsedTemplate ? `התחל מחדש אימון ${lastUsedTemplate.name}` : 'התחל אימון חדש'
        }
        className="block-hero focus-ring"
        style={{
          display: 'block',
          width: '100%',
          textAlign: 'right',
          border: 'none',
          cursor: 'pointer',
          marginBottom: 0,
        }}
      >
        <div className="ribbon">THIS WEEK</div>
        <div className="label">אימונים</div>
        <div className="number">{String(workoutsThisWeek).padStart(2, '0')}</div>
        <div className="sub">
          מתוך {weeklyGoal} · {pct}% יעד
        </div>
      </button>

      <div className="data-strip" style={{ marginTop: 2 }}>
        <div>
          <div className="val">{volumeFormatted || '—'}</div>
          <div className="lbl">kg volume</div>
        </div>
        <div>
          <div className="val">{volDeltaFormatted}</div>
          <div className="lbl">vs last week</div>
        </div>
      </div>
    </>
  );
}

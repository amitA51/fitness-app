import { useMemo } from 'react';
import { forecastProgress, getMuscleGroupDaysSince } from '../../services/analyticsService';
import type { WorkoutSession } from '../../types';

interface ForecastNudgeProps {
  sessions: WorkoutSession[];
}

const MAJOR_MUSCLES: ReadonlyArray<'Chest' | 'Back' | 'Legs'> = ['Chest', 'Back', 'Legs'];

export function ForecastNudge({ sessions }: ForecastNudgeProps) {
  const nudge = useMemo(() => {
    // Check for overdue major muscle (preferred when both fire)
    const muscleDays = getMuscleGroupDaysSince(sessions);
    const overdue = muscleDays
      .filter((m) => MAJOR_MUSCLES.includes(m.muscle as (typeof MAJOR_MUSCLES)[number]))
      .filter((m) => m.daysSince >= 5)
      .sort((a, b) => b.daysSince - a.daysSince)[0];

    if (overdue) {
      return {
        label: `${overdue.muscle} overdue · ${overdue.daysSince} days`,
        sub: 'next session ▸',
      };
    }

    // Check for declining volume trend
    const forecast = forecastProgress(sessions);
    if (forecast.trend === 'decreasing' && forecast.confidence > 0.7) {
      const points = forecast.dataPoints;
      const weeksAnalyzed = points.length;
      const first = points[0]?.actual ?? 0;
      const last = points[points.length - 1]?.actual ?? 0;
      const weeklyDropPct = first > 0 ? Math.round(((first - last) / first) * 100) : 0;
      return {
        label: `Volume slipping · ${weeklyDropPct}%`,
        sub: `last ${weeksAnalyzed} weeks`,
      };
    }

    return null;
  }, [sessions]);

  if (!nudge) return null;

  return (
    <div
      role="note"
      style={{
        margin: '16px 0',
        padding: '10px 14px',
        borderTop: '1px solid var(--navy)',
        borderBottom: '1px solid var(--navy)',
        background: 'transparent',
        fontFamily: 'var(--font-mono)',
        fontSize: 11,
        letterSpacing: '0.16em',
        textTransform: 'uppercase',
        color: 'var(--ink)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: 12,
      }}
    >
      <span>{nudge.label}</span>
      <span style={{ color: 'var(--stone)', fontSize: 10 }}>{nudge.sub}</span>
    </div>
  );
}

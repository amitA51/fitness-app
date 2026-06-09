import { TrendingDown, Zap } from 'lucide-react';
import { memo, useMemo } from 'react';
import { forecastProgress, getMuscleGroupDaysSince } from '../../services/analyticsService';
import type { WorkoutSession } from '../../types';
import { FadeIn } from '../motion/FadeIn';

interface ForecastNudgeProps {
  sessions: WorkoutSession[];
}

const MAJOR_MUSCLES: ReadonlyArray<'Chest' | 'Back' | 'Legs'> = ['Chest', 'Back', 'Legs'];

const MUSCLE_HE: Record<string, string> = {
  Chest: 'חזה',
  Back: 'גב',
  Legs: 'רגליים',
  Shoulders: 'כתפיים',
  Arms: 'ידיים',
  Core: 'בטן',
};

export const ForecastNudge = memo(function ForecastNudge({ sessions }: ForecastNudgeProps) {
  const nudge = useMemo(() => {
    // Check for overdue major muscle (preferred when both fire)
    const muscleDays = getMuscleGroupDaysSince(sessions);
    const overdue = muscleDays
      .filter((m) => MAJOR_MUSCLES.includes(m.muscle as (typeof MAJOR_MUSCLES)[number]))
      .filter((m) => m.daysSince >= 5)
      .sort((a, b) => b.daysSince - a.daysSince)[0];

    if (overdue) {
      const muscleHe = MUSCLE_HE[overdue.muscle] ?? overdue.muscle;
      return {
        // Plain note copy — this surface is a non-interactive note, so it must
        // not imply a tap target (a forward "▸" glyph also points the wrong way
        // in RTL).
        label: `${muscleHe} ממתין · ${overdue.daysSince} ימים`,
        sub: 'מומלץ לאימון',
        // Action-prompt tone — a muscle is ready to train again.
        tone: 'action' as const,
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
        label: `נפח יורד · ${weeklyDropPct}%`,
        sub: `ב-${weeksAnalyzed} שבועות אחרונים`,
        // Decline tone — volume trending down.
        tone: 'decline' as const,
      };
    }

    return null;
  }, [sessions]);

  if (!nudge) return null;

  const isDecline = nudge.tone === 'decline';
  // Action → accent (mint); decline → warn. Never lime (PR-only).
  const iconColor = isDecline ? 'var(--fs-warn)' : 'var(--fs-accent)';
  const Icon = isDecline ? TrendingDown : Zap;

  return (
    // Gentle fade + rise entrance (opacity/y only — RTL-safe, no x offset).
    // FadeIn snaps in under prefers-reduced-motion.
    <FadeIn style={{ margin: '16px 0' }}>
      <div
        role="note"
        className="magnetic-card glass-surface fs-accent-rail scrim-noise"
        style={{
          padding: '10px 14px',
          border: '1px solid var(--fs-surface-2)',
          borderRadius: '22px 16px 22px 16px',
          fontFamily: 'var(--font-mono)',
          fontSize: 11,
          letterSpacing: '0.16em',
          textTransform: 'uppercase',
          color: 'var(--fs-ink)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 12,
        }}
      >
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
          <Icon size={15} aria-hidden="true" style={{ color: iconColor, flexShrink: 0 }} />
          {nudge.label}
        </span>
        <span style={{ color: 'var(--fs-muted)', fontSize: 10, flexShrink: 0 }}>{nudge.sub}</span>
      </div>
    </FadeIn>
  );
});

// ============================================================================
// MuscleDistribution — weekly muscle-group distribution view.
// ============================================================================
// Extracted (logic-preserving) from the inline Dashboard block. Shows the top-5
// muscle groups by completed sets for the current week, each as a labelled
// colored progress bar scaled to the busiest group. Built on the canonical
// `Card`, token colors only, RTL-correct via logical properties.

import { memo, useMemo } from 'react';
import { muscleLabel } from '../../constants/muscleNames';
import type { WorkoutSession } from '../../types';
import { getWeekStart } from '../../utils/dateUtils';
import { MuscleMap } from '../fitness/MuscleMap';
import { Card } from '../ui/Card';

export interface MuscleDistributionProps {
  /** Source sessions; filtered to completed + this-week internally. */
  sessions: WorkoutSession[];
}

const TOP_N = 5;

interface MuscleDatum {
  muscle: string;
  sets: number;
}

const computeWeeklyMuscles = (sessions: WorkoutSession[]): MuscleDatum[] => {
  const weekStart = getWeekStart(new Date());
  const completed = sessions.filter(
    (s) => s.status === 'completed' && new Date(s.startTime) >= weekStart
  );

  const muscleMap = new Map<string, number>();
  for (const s of completed) {
    for (const ex of s.exercises) {
      // Canonical Hebrew label (English keys translated, Core/בטן unified) so the
      // distribution groups by muscle consistently and never shows raw English.
      const muscle = muscleLabel(ex);
      const sets = ex.sets.filter((set) => set.isCompleted).length;
      muscleMap.set(muscle, (muscleMap.get(muscle) || 0) + sets);
    }
  }

  return [...muscleMap.entries()]
    .map(([muscle, sets]) => ({ muscle, sets }))
    .filter((d) => d.sets > 0)
    .sort((a, b) => b.sets - a.sets);
};

// Rank fade: lead = accent, runner-up = accent-2, rest = muted. Never lime
// (--fs-signal is reserved for PR celebration — using it to rank bars is a slop tell).
const barColor = (i: number): string =>
  i === 0 ? 'var(--fs-accent)' : i === 1 ? 'var(--fs-accent-2)' : 'var(--fs-muted)';

export const MuscleDistribution = memo(function MuscleDistribution({
  sessions,
}: MuscleDistributionProps) {
  const data = useMemo(() => computeWeeklyMuscles(sessions), [sessions]);

  if (data.length === 0) return null;

  const top = data.slice(0, TOP_N);
  const workedMuscles = data.map((d) => d.muscle);
  const maxSets = data[0]?.sets || 1;
  const lead = data[0];
  const totalSets = data.reduce((sum, d) => sum + d.sets, 0);

  return (
    <Card
      variant="elevated"
      asymmetric
      noPadding
      className="magnetic-card glass-surface fs-accent-rail"
      style={{ padding: '16px 18px' }}
    >
      {/* Identity strip — accent-2 (teal) sets this card apart from
          ConsistencyScore (accent) and MuscleBalanceInsight (warn). */}
      <div
        aria-hidden="true"
        style={{
          position: 'absolute',
          insetInline: 0,
          top: 0,
          height: 3,
          borderRadius: 0,
          background: 'var(--fs-accent-2)',
        }}
      />

      {/* Summary-first: mono kicker + one-line takeaway so the chart leads with
          meaning rather than raw bars. Gender-safe phrasing (noun, no verb). */}
      <span
        style={{
          display: 'block',
          fontFamily: 'var(--font-mono)',
          fontSize: 10,
          letterSpacing: '0.16em',
          textTransform: 'uppercase',
          color: 'var(--fs-muted)',
          marginBottom: 4,
        }}
      >
        חלוקת נפח · השבוע
      </span>
      {lead && (
        <p
          style={{
            fontSize: 13,
            lineHeight: 1.5,
            color: 'var(--fs-ink)',
            margin: '0 0 12px',
          }}
        >
          <strong style={{ fontWeight: 700 }}>{lead.muscle}</strong> מוביל עם{' '}
          <span className="kinetic-number" dir="ltr" style={{ fontWeight: 700 }}>
            {lead.sets}
          </span>{' '}
          מתוך{' '}
          <span className="kinetic-number" dir="ltr" style={{ fontWeight: 700 }}>
            {totalSets}
          </span>{' '}
          סטים השבוע.
        </p>
      )}

      <div style={{ marginBottom: 14 }}>
        <MuscleMap primary={workedMuscles} />
      </div>

      <div style={{ display: 'grid', gap: 8 }}>
        {top.map((item, i) => {
          const pct = Math.round((item.sets / maxSets) * 100);
          return (
            <div key={item.muscle}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: 4,
                }}
              >
                <span
                  style={{
                    fontFamily: 'var(--font-body)',
                    fontSize: 13,
                    fontWeight: 600,
                    color: 'var(--fs-ink)',
                  }}
                >
                  {item.muscle}
                </span>
                <span
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: 11,
                    fontWeight: 800,
                    color: 'var(--fs-muted)',
                  }}
                >
                  {item.sets} סטים
                </span>
              </div>
              <div
                style={{
                  height: 6,
                  background: 'var(--fs-surface-2)',
                  borderRadius: 999,
                  overflow: 'hidden',
                }}
              >
                <div
                  style={{
                    height: '100%',
                    width: '100%',
                    // scaleX instead of width: compositor-only animation.
                    // Origin = right, the RTL leading edge of the fill.
                    transform: `scaleX(${pct / 100})`,
                    transformOrigin: '100% 50%',
                    borderRadius: 999,
                    background: barColor(i),
                    transition: 'transform 0.5s ease',
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
});

export default MuscleDistribution;

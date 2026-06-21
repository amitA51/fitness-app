/**
 * MuscleBreakdown — per-muscle volume bar chart for a completed session.
 * Per-muscle volume uses the canonical completedSetsVolume helper.
 */

import { m } from 'framer-motion';
import { Activity } from 'lucide-react';
import type { WorkoutExercise } from '../../types';
import { formatVolume } from '../../utils/dateUtils';
import { completedSetsVolume } from '../../utils/workoutMath';
import { SectionCard } from '../progress/components/SectionCard';

interface MuscleBreakdownProps {
  exercises: WorkoutExercise[];
  reduceMotion: boolean;
}

const BAR_COLORS = [
  'var(--fs-accent)',
  'var(--fs-accent-2)',
  'var(--fs-signal)',
  'var(--fs-accent)',
  'var(--fs-accent-2)',
  'var(--fs-signal)',
  'var(--fs-primary)',
  'var(--fs-muted)',
] as const;

export function MuscleBreakdown({ exercises, reduceMotion }: MuscleBreakdownProps) {
  const muscleStats = exercises.reduce(
    (acc, ex) => {
      const muscle = ex.targetMuscle || ex.muscleGroup || 'Other';
      const sets = ex.sets.filter((s) => s.isCompleted).length;
      const volume = completedSetsVolume(ex.sets);

      if (!acc[muscle]) {
        acc[muscle] = { sets: 0, volume: 0 };
      }
      acc[muscle].sets += sets;
      acc[muscle].volume += volume;
      return acc;
    },
    {} as Record<string, { sets: number; volume: number }>
  );

  const totalVolume = Object.values(muscleStats).reduce((sum, m) => sum + m.volume, 0);
  const sortedMuscles = Object.entries(muscleStats).sort((a, b) => b[1].volume - a[1].volume);

  const getColor = (index: number): string =>
    BAR_COLORS[index % BAR_COLORS.length] ?? 'var(--fs-muted)';

  return (
    <m.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.2 }}
      style={{ marginBottom: 24 }}
    >
      <SectionCard style={{ border: '1px solid var(--color-border)' }}>
        <h3
          style={{
            fontFamily: 'var(--font-display)',
            fontWeight: 800,
            fontSize: 14,
            color: 'var(--fs-ink)',
            marginBottom: 16,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <Activity size={14} style={{ color: 'var(--fs-accent)' }} />
          פילוח שרירים
        </h3>

        {/* Volume bar chart */}
        <div className="space-y-3">
          {sortedMuscles.slice(0, 6).map(([muscle, stats], index) => {
            const percentage = totalVolume > 0 ? (stats.volume / totalVolume) * 100 : 0;
            return (
              <div key={muscle}>
                <div className="flex items-center justify-between mb-1">
                  <span
                    style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--fs-ink)' }}
                  >
                    {muscle}
                  </span>
                  <span
                    style={{
                      fontSize: 10,
                      fontFamily: 'var(--font-mono)',
                      color: 'var(--fs-muted)',
                    }}
                  >
                    {stats.sets} סטים | {formatVolume(stats.volume)} ק"ג
                  </span>
                </div>
                <div
                  style={{
                    height: 6,
                    background: 'var(--fs-surface-2)',
                    borderRadius: 9999,
                    overflow: 'hidden',
                  }}
                >
                  <m.div
                    initial={{ width: 0 }}
                    animate={{ width: `${percentage}%` }}
                    transition={
                      reduceMotion ? { duration: 0 } : { delay: 0.3 + index * 0.05, duration: 0.5 }
                    }
                    style={{ height: '100%', borderRadius: 9999, backgroundColor: getColor(index) }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </SectionCard>
    </m.div>
  );
}

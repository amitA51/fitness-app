/**
 * MuscleBreakdown — per-muscle volume bar chart for a completed session.
 * Per-muscle volume uses the canonical completedSetsVolume helper.
 */

import { m } from 'framer-motion';
import { Activity } from 'lucide-react';
import { MuscleMap } from '../../components/fitness/MuscleMap';
import { translateMuscle } from '../../constants/muscleNames';
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

  // Muscles this session worked — drives the body map (primary only; logged
  // exercises don't carry secondary muscles).
  const workedMuscles = exercises
    .map((ex) => ex.targetMuscle || ex.muscleGroup)
    .filter((value): value is string => Boolean(value));

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
            fontWeight: 600,
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

        {workedMuscles.length > 0 && (
          <div style={{ marginBottom: 18 }}>
            <MuscleMap primary={workedMuscles} />
          </div>
        )}

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
                    {translateMuscle(muscle)}
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
                    // A full-width fill scaled from inline-start keeps the bar's perceived
                    // width while avoiding a layout pass for every animation frame.
                    initial={reduceMotion ? false : { scaleX: 0 }}
                    animate={{ scaleX: percentage / 100 }}
                    transition={
                      reduceMotion ? { duration: 0 } : { delay: 0.3 + index * 0.05, duration: 0.5 }
                    }
                    style={{
                      width: '100%',
                      height: '100%',
                      borderRadius: 9999,
                      backgroundColor: getColor(index),
                      transformOrigin: 'var(--progress-fill-origin-inline-start)',
                    }}
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

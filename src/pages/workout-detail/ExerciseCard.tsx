/**
 * ExerciseCard — one completed exercise: header, best set, and per-set grid.
 * Volume and best-set come from the canonical workoutMath helpers so the
 * numbers match every other screen.
 */

import { m } from 'framer-motion';
import { Trophy } from 'lucide-react';
import type { WorkoutExercise } from '../../types';
import { formatVolume } from '../../utils/dateUtils';
import { completedSetsVolume, computeSessionStats, setVolume } from '../../utils/workoutMath';
import { MUSCLE_COLOR } from './helpers';

interface ExerciseCardProps {
  exercise: WorkoutExercise;
  index: number;
  reduceMotion: boolean;
}

export function ExerciseCard({ exercise, index, reduceMotion }: ExerciseCardProps) {
  const completedSets = exercise.sets.filter((s) => s.isCompleted);
  const totalVolume = completedSetsVolume(exercise.sets);
  // Best working set (warmups excluded by setVolume) via the canonical SSOT.
  const bestSet = computeSessionStats({ exercises: [exercise] }).exerciseStats[0]?.bestSet ?? null;

  return (
    <m.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={reduceMotion ? { duration: 0 } : { delay: index * 0.08, duration: 0.3 }}
      style={{
        background: 'var(--fs-surface)',
        borderRadius: '22px 16px 22px 16px',
        border: '1px solid var(--color-border)',
        boxShadow: 'var(--shadow-card)',
        overflow: 'hidden',
        position: 'relative',
      }}
    >
      {/* Exercise Header */}
      <div style={{ padding: '14px 16px' }}>
        <div className="flex items-start justify-between mb-3">
          <div className="flex-1 min-w-0">
            <h3
              style={{
                fontFamily: 'var(--font-display)',
                fontWeight: 800,
                fontSize: 16,
                color: 'var(--fs-ink)',
                letterSpacing: '0.02em',
                lineHeight: 1.2,
              }}
            >
              {exercise.exerciseName || exercise.name || 'תרגיל ללא שם'}
            </h3>
            <div className="flex items-center gap-2 mt-1">
              <span
                style={{
                  fontSize: 10,
                  fontFamily: 'var(--font-mono)',
                  padding: '2px 8px',
                  borderRadius: 9999,
                  background: MUSCLE_COLOR.bg,
                  color: MUSCLE_COLOR.text,
                }}
              >
                {exercise.targetMuscle || exercise.muscleGroup || 'שריר'}
              </span>
              {exercise.tempo && (
                <span
                  style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--fs-muted)' }}
                >
                  טמפו: {exercise.tempo}
                </span>
              )}
            </div>
          </div>

          {/* Volume badge */}
          <div style={{ background: 'var(--fs-bg)', borderRadius: 8, padding: '4px 10px' }}>
            <span
              style={{
                fontSize: 12,
                fontWeight: 700,
                fontFamily: 'var(--font-mono)',
                color: 'var(--fs-ink)',
              }}
            >
              {formatVolume(totalVolume)} ק"ג
            </span>
          </div>
        </div>

        {/* Best Set Highlight */}
        {bestSet && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '8px 12px',
              borderRadius: 12,
              background: MUSCLE_COLOR.bg,
              marginBottom: 12,
            }}
          >
            <Trophy size={14} style={{ color: MUSCLE_COLOR.text }} />
            <span
              style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: MUSCLE_COLOR.text }}
            >
              הסט הטוב ביותר:
            </span>
            <span
              style={{
                fontSize: 12,
                fontWeight: 700,
                fontFamily: 'var(--font-mono)',
                color: 'var(--fs-ink)',
                marginInlineEnd: 'auto',
              }}
            >
              {bestSet.weight} ק"ג × {bestSet.reps} חזרות
            </span>
          </div>
        )}

        {/* Sets Grid */}
        <div className="space-y-2">
          <div
            className="flex items-center"
            style={{
              fontSize: 10,
              fontFamily: 'var(--font-mono)',
              color: 'var(--fs-muted)',
              padding: '0 4px',
            }}
          >
            <span className="flex-1">סט</span>
            <span style={{ flex: 1, textAlign: 'center', minWidth: 0 }}>משקל</span>
            <span style={{ flex: 1, textAlign: 'center', minWidth: 0 }}>חזרות</span>
            <span style={{ flex: 1, textAlign: 'center', minWidth: 0 }}>נפח</span>
          </div>

          {completedSets.map((set, setIndex) => (
            <div
              key={set.id || setIndex}
              className="flex items-center"
              style={{
                fontSize: 12,
                fontFamily: 'var(--font-mono)',
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              <span className="flex-1" style={{ color: 'var(--fs-muted)' }}>
                {set.setNumber || setIndex + 1}
              </span>
              <span
                style={{
                  flex: 1,
                  textAlign: 'center',
                  minWidth: 0,
                  color: 'var(--fs-ink)',
                  fontWeight: 500,
                }}
              >
                {set.weight || 0} ק"ג
              </span>
              <span
                style={{
                  flex: 1,
                  textAlign: 'center',
                  minWidth: 0,
                  color: 'var(--fs-ink)',
                  fontWeight: 500,
                }}
              >
                {set.reps || 0}
              </span>
              <span style={{ flex: 1, textAlign: 'center', minWidth: 0, color: 'var(--fs-muted)' }}>
                {setVolume(set).toLocaleString()}
              </span>
            </div>
          ))}
        </div>
      </div>
    </m.div>
  );
}

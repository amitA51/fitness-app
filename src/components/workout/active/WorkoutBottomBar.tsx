import React from 'react';
import type { Exercise } from '../../../types';
import { ExerciseNav } from '../components';
import SlideToComplete from '../components/SlideToComplete';

interface WorkoutBottomBarProps {
  exercises: Exercise[];
  currentExerciseIndex: number;
  onChangeExercise: (idx: number) => void;
  onOpenDrawer: () => void;
  onAddExercise: () => void;
  onCompleteSet: () => void;
}

const WorkoutBottomBar: React.FC<WorkoutBottomBarProps> = ({
  exercises,
  currentExerciseIndex,
  onChangeExercise,
  onOpenDrawer,
  onAddExercise,
  onCompleteSet,
}) => {
  const nextEx =
    currentExerciseIndex < exercises.length - 1 ? exercises[currentExerciseIndex + 1] : null;

  return (
    <div
      className="w-full flex-shrink-0"
      style={{
        background: 'var(--fs-bg)',
        borderTop: '1px solid var(--fs-surface-2)',
        padding: '0 14px 16px',
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
      }}
    >
      {/* 6A: Slide to complete */}
      <div style={{ paddingTop: 8 }}>
        <SlideToComplete label="החלק לסימון סט כבוצע" onComplete={onCompleteSet} disabled={false} />
      </div>

      {/* 6B: Nav row */}
      <ExerciseNav
        exercises={exercises}
        currentIndex={currentExerciseIndex}
        onChangeExercise={onChangeExercise}
        onOpenDrawer={onOpenDrawer}
        onAddExercise={onAddExercise}
      />

      {/* 6C: Next up strip */}
      {nextEx && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '6px 12px',
            background: 'color-mix(in srgb, var(--fs-accent) 6%, var(--fs-surface))',
            border: '1px solid color-mix(in srgb, var(--fs-accent) 14%, transparent)',
            borderRadius: 10,
          }}
        >
          <span
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 9,
              fontWeight: 700,
              color: 'var(--fs-accent)',
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              flexShrink: 0,
            }}
          >
            הבא:
          </span>
          <span
            style={{
              fontFamily: 'var(--font-body)',
              fontSize: 12,
              fontWeight: 700,
              color: 'var(--fs-ink)',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              flex: 1,
              direction: 'ltr',
            }}
          >
            {nextEx?.name || '—'}
          </span>
          <span
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 10,
              color: 'var(--fs-muted)',
              flexShrink: 0,
            }}
          >
            {nextEx?.sets?.length || 0} sets
          </span>
        </div>
      )}
    </div>
  );
};

export default React.memo(WorkoutBottomBar);

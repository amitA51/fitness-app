import React from 'react';
import type { Exercise } from '../../../types';
import ExerciseNav from '../components/ExerciseNav';
import SlideToComplete from '../components/SlideToComplete';
import type { SupersetGroup } from '../core/workoutTypes';

interface WorkoutBottomBarProps {
  exercises: Exercise[];
  currentExerciseIndex: number;
  onChangeExercise: (idx: number) => void;
  onOpenDrawer: () => void;
  onAddExercise: () => void;
  onCompleteSet: () => void;
  supersetGroups?: SupersetGroup[];
}

const WorkoutBottomBar: React.FC<WorkoutBottomBarProps> = ({
  exercises,
  currentExerciseIndex,
  onChangeExercise,
  onOpenDrawer,
  onAddExercise,
  onCompleteSet,
  supersetGroups,
}) => {
  const nextEx =
    currentExerciseIndex < exercises.length - 1 ? exercises[currentExerciseIndex + 1] : null;

  // Disable the slide-to-complete once every set of the current exercise is
  // done. Without this, a slide on a finished exercise would try to "complete"
  // a non-existent set; the reducer now no-ops, but disabling makes it clear
  // there's nothing left to mark (use "הוסף סט" to train more).
  const currentEx = exercises[currentExerciseIndex];
  const curTotalSets = currentEx?.sets?.length ?? 0;
  const curCompletedSets = currentEx?.sets?.filter((s) => s.completedAt).length ?? 0;
  const isExerciseComplete = curTotalSets > 0 && curCompletedSets >= curTotalSets;
  const activeSetNumber = Math.min(curCompletedSets + 1, Math.max(curTotalSets, 1));
  const completeLabel = isExerciseComplete
    ? 'התרגיל הושלם'
    : `החלק לסימון סט ${activeSetNumber} מתוך ${curTotalSets || 1} כבוצע`;

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
        <SlideToComplete
          label={completeLabel}
          onComplete={onCompleteSet}
          disabled={isExerciseComplete}
        />
      </div>

      {/* 6B: Nav row */}
      <ExerciseNav
        exercises={exercises}
        currentIndex={currentExerciseIndex}
        onChangeExercise={onChangeExercise}
        onOpenDrawer={onOpenDrawer}
        onAddExercise={onAddExercise}
        supersetGroups={supersetGroups}
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
            {nextEx?.sets?.length || 0} סטים
          </span>
        </div>
      )}
    </div>
  );
};

export default React.memo(WorkoutBottomBar);

import React from 'react';
import type { Exercise } from '../../../types';
import { HE_NOUNS, pluralizeHe } from '../../../utils/pluralizeHe';
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
  // "הבא:" must point at the next INCOMPLETE exercise AFTER the current one,
  // not merely the positionally-next one — otherwise it can suggest an exercise
  // that's already fully done (or, on a 2/2 layout, nothing). When every later
  // exercise is complete the strip is hidden entirely.
  const isExerciseDone = (ex: Exercise | undefined): boolean => {
    const total = ex?.sets?.length ?? 0;
    const done = ex?.sets?.filter((s) => s.completedAt).length ?? 0;
    return total > 0 && done >= total;
  };
  const nextEx =
    exercises.slice(currentExerciseIndex + 1).find((ex) => !isExerciseDone(ex)) ?? null;

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
    : // Short form ("סט 1/3") — the long "סט X מתוך Y כבוצע" wrapped the
      // slider label to two lines on narrow screens.
      `החלק לסימון סט ${activeSetNumber}/${curTotalSets || 1}`;

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
            {pluralizeHe(nextEx?.sets?.length || 0, HE_NOUNS.set)}
          </span>
        </div>
      )}
    </div>
  );
};

export default React.memo(WorkoutBottomBar);

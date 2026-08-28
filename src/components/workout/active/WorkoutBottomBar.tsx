import React, { useCallback } from 'react';
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

const isExerciseDone = (ex: Exercise | undefined): boolean => {
  const total = ex?.sets?.length ?? 0;
  const done = ex?.sets?.filter((s) => s.completedAt).length ?? 0;
  return total > 0 && done >= total;
};

const fmtCount = (pos: number, total: number) => `⁦${pos}/${total || 1}⁩`;

const WorkoutBottomBar: React.FC<WorkoutBottomBarProps> = ({
  exercises,
  currentExerciseIndex,
  onChangeExercise,
  onOpenDrawer,
  onAddExercise,
  onCompleteSet,
  supersetGroups,
}) => {
  const nextIncompleteAfter = exercises
    .slice(currentExerciseIndex + 1)
    .find((ex) => !isExerciseDone(ex));
  const nextIncompleteAny =
    nextIncompleteAfter ??
    exercises.find((ex, idx) => idx !== currentExerciseIndex && !isExerciseDone(ex)) ??
    null;
  const nextExIndex = nextIncompleteAny
    ? exercises.findIndex((ex) => ex === nextIncompleteAny)
    : -1;

  const currentEx = exercises[currentExerciseIndex];
  const curSets = currentEx?.sets ?? [];
  let curWorkingTotal = 0;
  let curWorkingCompleted = 0;
  let curWarmupTotal = 0;
  let curWarmupCompleted = 0;
  for (const s of curSets) {
    if (s.isWarmup) {
      curWarmupTotal++;
      if (s.completedAt) curWarmupCompleted++;
    } else {
      curWorkingTotal++;
      if (s.completedAt) curWorkingCompleted++;
    }
  }
  const curTotalSets = curSets.length;
  const curCompletedSets = curSets.filter((s) => s.completedAt).length;
  const isExerciseComplete = curTotalSets > 0 && curCompletedSets >= curTotalSets;
  const activeIsWarmup = curSets.find((s) => !s.completedAt)?.isWarmup ?? false;
  let completeLabel: string;
  if (isExerciseComplete) {
    completeLabel = 'התרגיל הושלם';
  } else if (activeIsWarmup) {
    const pos = Math.min(curWarmupCompleted + 1, Math.max(curWarmupTotal, 1));
    completeLabel = `החלק לסיום חימום ${fmtCount(pos, curWarmupTotal)}`;
  } else {
    const pos = Math.min(curWorkingCompleted + 1, Math.max(curWorkingTotal, 1));
    completeLabel = `החלק לסיום סט ${fmtCount(pos, curWorkingTotal)}`;
  }

  const goToNextExercise = useCallback(() => {
    if (nextExIndex >= 0) onChangeExercise(nextExIndex);
  }, [nextExIndex, onChangeExercise]);

  return (
    <div
      className="w-full flex-shrink-0"
      style={{
        // This footer can remain visible behind a sheet. An opaque surface keeps
        // its hierarchy while avoiding a second backdrop sample on the same pixels.
        background: 'var(--fs-bg)',
        borderTop: '0.5px solid var(--color-separator)',
        padding: '10px 16px calc(14px + env(safe-area-inset-bottom, 0px))',
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
      }}
    >
      <div>
        {isExerciseComplete && nextIncompleteAny && nextExIndex >= 0 ? (
          <button
            type="button"
            onClick={goToNextExercise}
            className="start-workout-btn focus-ring"
            style={{ minHeight: 60 }}
            aria-label={`המשך לתרגיל הבא: ${nextIncompleteAny.name}`}
          >
            <span style={{ display: 'grid', gap: 2, textAlign: 'center' }}>
              <span
                style={{
                  fontFamily: 'var(--font-body)',
                  fontSize: 12,
                  fontWeight: 600,
                  letterSpacing: '-0.01em',
                  opacity: 0.9,
                }}
              >
                התרגיל הבא
              </span>
              <span
                style={{
                  fontFamily: 'var(--font-body)',
                  fontWeight: 700,
                  fontSize: 17,
                  letterSpacing: '-0.015em',
                  lineHeight: 1.15,
                  maxWidth: '100%',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {nextIncompleteAny.name}
              </span>
            </span>
          </button>
        ) : isExerciseComplete && !nextIncompleteAny ? (
          <div
            role="status"
            className="fs-surface-card"
            style={{
              width: '100%',
              minHeight: 60,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 4,
              padding: '12px 16px',
              borderRadius: 'var(--radius-full)',
            }}
          >
            <span
              style={{
                fontFamily: 'var(--font-body)',
                fontWeight: 600,
                fontSize: 16,
                letterSpacing: '-0.01em',
                color: 'var(--fs-ink)',
              }}
            >
              כל התרגילים הושלמו
            </span>
            <span
              style={{
                fontFamily: 'var(--font-body)',
                fontSize: 13,
                color: 'var(--fs-muted)',
                letterSpacing: '-0.01em',
              }}
            >
              הקישו ✓ למעלה כדי לשמור את האימון
            </span>
          </div>
        ) : (
          <SlideToComplete
            label={completeLabel}
            onComplete={onCompleteSet}
            disabled={isExerciseComplete}
          />
        )}
      </div>

      <ExerciseNav
        exercises={exercises}
        currentIndex={currentExerciseIndex}
        onChangeExercise={onChangeExercise}
        onOpenDrawer={onOpenDrawer}
        onAddExercise={onAddExercise}
        supersetGroups={supersetGroups}
      />

      {!isExerciseComplete && nextIncompleteAfter && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '10px 14px',
            background: 'color-mix(in srgb, var(--fs-accent) 8%, var(--fs-surface))',
            border: '1px solid color-mix(in srgb, var(--fs-accent) 18%, transparent)',
            borderRadius: 'var(--radius-full)',
          }}
        >
          <span
            style={{
              fontFamily: 'var(--font-body)',
              fontSize: 12,
              fontWeight: 600,
              color: 'var(--fs-accent-2)',
              letterSpacing: '-0.01em',
              flexShrink: 0,
            }}
          >
            הבא
          </span>
          <span
            style={{
              fontFamily: 'var(--font-body)',
              fontSize: 14,
              fontWeight: 600,
              color: 'var(--fs-ink)',
              letterSpacing: '-0.01em',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              flex: 1,
            }}
          >
            {nextIncompleteAfter.name || '—'}
          </span>
          <span
            style={{
              fontFamily: 'var(--font-body)',
              fontSize: 12,
              color: 'var(--fs-muted)',
              flexShrink: 0,
            }}
          >
            {pluralizeHe(nextIncompleteAfter.sets?.length || 0, HE_NOUNS.set)}
          </span>
        </div>
      )}
    </div>
  );
};

export default React.memo(WorkoutBottomBar);

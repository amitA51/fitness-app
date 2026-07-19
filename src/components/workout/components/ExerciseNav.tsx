// ExerciseNav — compact polished nav for active workout
// Prev/Next pills + center status + list + add

import {
  ChevronLeft as ChevronLeftIcon,
  ChevronRight as ChevronRightIcon,
  Link2,
  List,
  Plus,
} from 'lucide-react';
import { type CSSProperties, memo, useCallback, useEffect } from 'react';
import type { Exercise } from '../../../types';
import type { SupersetGroup } from '../core/workoutTypes';

interface ExerciseNavProps {
  exercises: Exercise[];
  currentIndex: number;
  onChangeExercise: (index: number) => void;
  onOpenDrawer: () => void;
  onAddExercise?: () => void;
  supersetGroups?: SupersetGroup[];
}

const iconBtnBase: CSSProperties = {
  width: 44,
  height: 44,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  borderRadius: 9999,
  border: 'none',
  flexShrink: 0,
  transition: 'transform 150ms cubic-bezier(0.4, 0, 0.2, 1), opacity 150ms, background 150ms',
};

const ExerciseNav = memo<ExerciseNavProps>(
  ({ exercises, currentIndex, onChangeExercise, onOpenDrawer, onAddExercise, supersetGroups }) => {
    const canGoPrev = currentIndex > 0;
    const canGoNext = currentIndex < exercises.length - 1;
    const currentExercise = exercises[currentIndex];
    const totalSets = currentExercise?.sets?.length || 0;
    const completedSets = currentExercise?.sets?.filter((s) => s.completedAt).length || 0;

    const supersetGroup = currentExercise?.id
      ? supersetGroups?.find((g) => g.exercises.includes(currentExercise.id))
      : undefined;
    const supersetPosition = supersetGroup
      ? supersetGroup.exercises.indexOf(currentExercise!.id) + 1
      : 0;

    const handlePrev = useCallback(() => {
      if (canGoPrev) onChangeExercise(currentIndex - 1);
    }, [canGoPrev, currentIndex, onChangeExercise]);

    const handleNext = useCallback(() => {
      if (canGoNext) onChangeExercise(currentIndex + 1);
    }, [canGoNext, currentIndex, onChangeExercise]);

    const handleKeyDown = useCallback(
      (e: KeyboardEvent) => {
        if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
        if (document.querySelector('[role="dialog"],[aria-modal="true"]')) return;
        if (e.key === 'ArrowRight' && canGoPrev) {
          onChangeExercise(currentIndex - 1);
        } else if (e.key === 'ArrowLeft' && canGoNext) {
          onChangeExercise(currentIndex + 1);
        }
      },
      [canGoPrev, canGoNext, currentIndex, onChangeExercise]
    );

    useEffect(() => {
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }, [handleKeyDown]);

    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <button
          type="button"
          onClick={(e) => {
            if (canGoPrev) {
              e.stopPropagation();
              handlePrev();
            }
          }}
          disabled={!canGoPrev}
          aria-label="תרגיל קודם"
          className="active:scale-[0.93] focus-ring"
          style={{
            ...iconBtnBase,
            background: canGoPrev ? 'var(--fs-surface)' : 'var(--fs-surface-2)',
            boxShadow: canGoPrev ? 'var(--elevation-1)' : 'none',
            color: canGoPrev ? 'var(--fs-ink)' : 'var(--fs-muted)',
            cursor: canGoPrev ? 'pointer' : 'not-allowed',
            opacity: canGoPrev ? 1 : 0.35,
          }}
        >
          <ChevronRightIcon size={18} strokeWidth={2.25} />
        </button>

        <div
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: 44,
            padding: '8px 12px',
            background: 'var(--fs-surface)',
            borderRadius: 9999,
            gap: 10,
            boxShadow: 'var(--elevation-1)',
            border: '1px solid color-mix(in srgb, var(--color-border) 80%, transparent)',
          }}
        >
          {supersetGroup && (
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
                fontFamily: 'var(--font-body)',
                fontSize: 12,
                letterSpacing: '-0.01em',
                color: 'var(--fs-accent-2)',
                fontWeight: 600,
              }}
              aria-label={`סופרסט, תרגיל ${supersetPosition} מתוך ${supersetGroup.exercises.length}`}
            >
              <Link2 size={12} strokeWidth={2.5} />
              {supersetPosition}/{supersetGroup.exercises.length}
            </span>
          )}
          {totalSets > 0 && (
            <span
              style={{
                fontFamily: 'var(--font-body)',
                fontSize: 13,
                letterSpacing: '-0.01em',
                color: 'var(--fs-ink)',
                fontWeight: 600,
              }}
            >
              סט {completedSets}/{totalSets}
            </span>
          )}
          <span style={{ color: 'var(--fs-muted)', fontSize: 13 }}>·</span>
          <span
            style={{
              fontFamily: 'var(--font-body)',
              fontSize: 12,
              fontWeight: 500,
              letterSpacing: '-0.01em',
              color: 'var(--fs-muted)',
              direction: 'ltr',
            }}
          >
            {currentIndex + 1}/{exercises.length}
          </span>
        </div>

        <button
          type="button"
          onClick={(e) => {
            if (canGoNext) {
              e.stopPropagation();
              handleNext();
            }
          }}
          disabled={!canGoNext}
          aria-label="תרגיל הבא"
          className="active:scale-[0.93] focus-ring"
          style={{
            ...iconBtnBase,
            background: canGoNext ? 'var(--fs-surface)' : 'var(--fs-surface-2)',
            boxShadow: canGoNext ? 'var(--elevation-1)' : 'none',
            color: canGoNext ? 'var(--fs-ink)' : 'var(--fs-muted)',
            cursor: canGoNext ? 'pointer' : 'not-allowed',
            opacity: canGoNext ? 1 : 0.35,
          }}
        >
          <ChevronLeftIcon size={18} strokeWidth={2.25} />
        </button>

        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onOpenDrawer();
          }}
          aria-label="רשימת תרגילים"
          className="active:scale-[0.93] focus-ring"
          style={{
            ...iconBtnBase,
            background: 'var(--fs-surface-2)',
            color: 'var(--fs-ink)',
            cursor: 'pointer',
          }}
        >
          <List size={17} strokeWidth={2.25} />
        </button>

        {onAddExercise && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onAddExercise();
            }}
            aria-label="הוסף תרגיל"
            className="active:scale-[0.93] focus-ring"
            style={{
              ...iconBtnBase,
              background: 'var(--fs-accent)',
              color: 'var(--color-ink-on-accent)',
              cursor: 'pointer',
              boxShadow: '0 6px 16px color-mix(in srgb, var(--fs-accent) 28%, transparent)',
            }}
          >
            <Plus size={18} strokeWidth={2.5} />
          </button>
        )}
      </div>
    );
  },
  (prev, next) => {
    if (prev.currentIndex !== next.currentIndex) return false;
    if (prev.supersetGroups !== next.supersetGroups) return false;
    if (prev.exercises.length !== next.exercises.length) return false;
    for (let i = 0; i < prev.exercises.length; i++) {
      if (prev.exercises[i]?.id !== next.exercises[i]?.id) return false;
      const prevCompleted = prev.exercises[i]?.sets?.filter((s) => s.completedAt).length || 0;
      const nextCompleted = next.exercises[i]?.sets?.filter((s) => s.completedAt).length || 0;
      if (prevCompleted !== nextCompleted) return false;
    }
    return true;
  }
);

ExerciseNav.displayName = 'ExerciseNav';

export default ExerciseNav;

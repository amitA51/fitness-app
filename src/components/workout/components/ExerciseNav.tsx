// ExerciseNav - Fresh Steel v2 Compact Nav Row
// Prev/Next arrows + center panel (set info · position) + list button + add exercise button

import { ChevronLeft as ChevronLeftIcon, List, Plus } from 'lucide-react';
import { memo, useCallback, useEffect } from 'react';
import type { Exercise } from '../../../types';

interface ExerciseNavProps {
  exercises: Exercise[];
  currentIndex: number;
  onChangeExercise: (index: number) => void;
  onOpenDrawer: () => void;
  onAddExercise?: () => void;
}

const ExerciseNav = memo<ExerciseNavProps>(
  ({ exercises, currentIndex, onChangeExercise, onOpenDrawer, onAddExercise }) => {
    const canGoPrev = currentIndex > 0;
    const canGoNext = currentIndex < exercises.length - 1;
    const currentExercise = exercises[currentIndex];
    const totalSets = currentExercise?.sets?.length || 0;
    const completedSets = currentExercise?.sets?.filter((s) => s.completedAt).length || 0;

    const handlePrev = useCallback(() => {
      if (canGoPrev) onChangeExercise(currentIndex - 1);
    }, [canGoPrev, currentIndex, onChangeExercise]);

    const handleNext = useCallback(() => {
      if (canGoNext) onChangeExercise(currentIndex + 1);
    }, [canGoNext, currentIndex, onChangeExercise]);

    const handleKeyDown = useCallback(
      (e: KeyboardEvent) => {
        if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
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
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
        }}
      >
        {/* Prev arrow */}
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
          style={{
            width: 42,
            height: 42,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: '12px 8px 12px 8px',
            background: canGoPrev ? 'var(--fs-surface)' : 'var(--fs-surface-2)',
            border: '1px solid var(--fs-steel)',
            color: canGoPrev ? 'var(--fs-ink)' : 'var(--fs-muted)',
            cursor: canGoPrev ? 'pointer' : 'not-allowed',
            opacity: canGoPrev ? 1 : 0.3,
            transition: 'background-color 150ms, color 150ms',
            flexShrink: 0,
          }}
        >
          <ChevronLeftIcon size={16} strokeWidth={2.5} style={{ transform: 'rotate(180deg)' }} />
        </button>

        {/* Center panel */}
        <div
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            height: 42,
            padding: '0 10px',
            background: 'var(--fs-primary)',
            borderRadius: '12px 8px 12px 8px',
            gap: 10,
          }}
        >
          {totalSets > 0 && (
            <span
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 12,
                letterSpacing: '0.06em',
                color: 'rgba(255,255,255,0.85)',
                fontWeight: 700,
              }}
            >
              סט {completedSets}/{totalSets}
            </span>
          )}
          <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: 14 }}>·</span>
          <span
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: '0.06em',
              color: 'rgba(255,255,255,0.45)',
              direction: 'ltr',
            }}
          >
            {currentIndex + 1}/{exercises.length}
          </span>
        </div>

        {/* Next arrow */}
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
          style={{
            width: 42,
            height: 42,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: '12px 8px 12px 8px',
            background: canGoNext ? 'var(--fs-surface)' : 'var(--fs-surface-2)',
            border: '1px solid var(--fs-steel)',
            color: canGoNext ? 'var(--fs-ink)' : 'var(--fs-muted)',
            cursor: canGoNext ? 'pointer' : 'not-allowed',
            opacity: canGoNext ? 1 : 0.3,
            transition: 'background-color 150ms, color 150ms',
            flexShrink: 0,
          }}
        >
          <ChevronLeftIcon size={16} strokeWidth={2.5} />
        </button>

        {/* List button */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onOpenDrawer();
          }}
          aria-label="רשימת תרגילים"
          style={{
            width: 42,
            height: 42,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: '12px 8px 12px 8px',
            background: 'var(--fs-surface-2)',
            border: '1px solid var(--fs-steel)',
            color: 'var(--fs-ink)',
            cursor: 'pointer',
            flexShrink: 0,
          }}
        >
          <List size={16} strokeWidth={2.5} />
        </button>

        {/* Add exercise button */}
        {onAddExercise && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onAddExercise();
            }}
            aria-label="הוסף תרגיל"
            style={{
              width: 42,
              height: 42,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: '12px 8px 12px 8px',
              background: 'var(--fs-accent)',
              border: '1px solid color-mix(in srgb, var(--fs-primary) 20%, var(--fs-steel))',
              color: '#FFFFFF',
              cursor: 'pointer',
              flexShrink: 0,
              transition: 'transform 100ms ease',
            }}
            onPointerDown={(e) => {
              (e.currentTarget as HTMLElement).style.transform = 'scale(0.93)';
            }}
            onPointerUp={(e) => {
              (e.currentTarget as HTMLElement).style.transform = 'scale(1)';
            }}
            onPointerLeave={(e) => {
              (e.currentTarget as HTMLElement).style.transform = 'scale(1)';
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

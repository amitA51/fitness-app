// ExerciseNav - Sport Annual Editorial Design
// Bone background · Navy buttons · Mustard active dot
// VISION: Bold · Editorial · Confident · Narrative · Printed

import { motion } from 'framer-motion';
import { List, Plus } from 'lucide-react';
import { memo, useCallback, useEffect, useMemo } from 'react';
import type { Exercise } from '../../../types';
import { cn } from '../../../utils/styles';
import { ChevronLeftIcon } from '../../icons';

type DotStatus = 'empty' | 'warmup-only' | 'partial' | 'complete';

interface ExerciseNavProps {
  exercises: Exercise[];
  currentIndex: number;
  onChangeExercise: (index: number) => void;
  onOpenDrawer: () => void;
  onAddExercise: () => void;
}

function getDotStatus(exercise: Exercise): DotStatus {
  const sets = exercise.sets || [];
  if (sets.length === 0) return 'empty';
  const completedSets = sets.filter((s) => s.completedAt);
  if (completedSets.length === 0) return 'empty';
  const allWarmup = completedSets.every((s) => s.isWarmup);
  if (allWarmup) return 'warmup-only';
  const workingSets = sets.filter((s) => !s.isWarmup);
  const completedWorking = workingSets.filter((s) => s.completedAt);
  if (completedWorking.length >= workingSets.length) return 'complete';
  return 'partial';
}

const ExerciseNav = memo<ExerciseNavProps>(
  ({ exercises, currentIndex, onChangeExercise, onOpenDrawer, onAddExercise }) => {
    const canGoPrev = currentIndex > 0;
    const canGoNext = currentIndex < exercises.length - 1;
    const dotStatuses = useMemo(() => exercises.map(getDotStatus), [exercises]);

    const handlePrev = useCallback(() => {
      if (canGoPrev) onChangeExercise(currentIndex - 1);
    }, [canGoPrev, currentIndex, onChangeExercise]);

    const handleNext = useCallback(() => {
      if (canGoNext) onChangeExercise(currentIndex + 1);
    }, [canGoNext, currentIndex, onChangeExercise]);

    const handleKeyDown = useCallback(
      (e: KeyboardEvent) => {
        if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
        if (e.key === 'ArrowLeft' && canGoPrev) {
          onChangeExercise(currentIndex - 1);
        } else if (e.key === 'ArrowRight' && canGoNext) {
          onChangeExercise(currentIndex + 1);
        }
      },
      [canGoPrev, canGoNext, currentIndex, onChangeExercise]
    );

    useEffect(() => {
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }, [handleKeyDown]);

    const NAV_BTN: React.CSSProperties = {
      width: 44,
      height: 44,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 0,
      border: '2px solid var(--navy)',
      cursor: 'pointer',
      transition: 'all 150ms',
      minWidth: 44,
      minHeight: 44,
    };

    const DOT_BASE: React.CSSProperties = {
      borderRadius: '50%',
      transition: 'all 150ms',
    };

    return (
      <nav
        aria-label="ניווט בין תרגילים"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 8,
          padding: '16px 20px',
          background: 'var(--bone)',
          borderTop: '1px solid var(--bone-deep)',
        }}
      >
        {/* Prev/Next + Dots */}
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {/* Prev */}
          <button
            type="button"
            onPointerDown={(e) => {
              if (canGoPrev) {
                e.preventDefault();
                e.stopPropagation();
                handleNext();
              }
            }}
            disabled={!canGoPrev}
            aria-label="תרגיל קודם"
            style={{
              ...NAV_BTN,
              background: canGoNext ? 'var(--bone)' : 'var(--bone-faint)',
              color: canGoNext ? 'var(--navy)' : 'var(--stone-light)',
              cursor: canGoNext ? 'pointer' : 'not-allowed',
            }}
          >
            <ChevronLeftIcon className="rotate-180" />
          </button>

          {/* Next */}
          <button
            type="button"
            onPointerDown={(e) => {
              if (canGoPrev) {
                e.preventDefault();
                e.stopPropagation();
                handlePrev();
              }
            }}
            disabled={!canGoPrev}
            aria-label="תרגיל הבא"
            style={{
              ...NAV_BTN,
              background: canGoPrev ? 'var(--bone)' : 'var(--bone-faint)',
              color: canGoPrev ? 'var(--navy)' : 'var(--stone-light)',
              cursor: canGoPrev ? 'pointer' : 'not-allowed',
            }}
          >
            <ChevronLeftIcon />
          </button>

          {/* Progress Dots */}
          {exercises.length > 1 && exercises.length <= 8 && (
            <div
              style={{ display: 'flex', alignItems: 'center', gap: 6, paddingLeft: 8 }}
              role="tablist"
              aria-label="התקדמות תרגילים"
            >
              {exercises.map((exercise, i) => {
                const isCurrent = i === currentIndex;
                const status = dotStatuses[i] ?? 'empty';

                let dotColor: string;
                if (status === 'complete') dotColor = 'var(--color-success)';
                else if (status === 'partial') dotColor = 'var(--mustard)';
                else if (status === 'warmup-only') dotColor = 'var(--color-warning)';
                else dotColor = 'var(--bone-deep)';

                return (
                  <motion.button
                    key={exercise.id}
                    role="tab"
                    aria-selected={isCurrent}
                    aria-label={`תרגיל ${i + 1}${status === 'complete' ? ' - הושלם' : status === 'partial' ? ' - חלקי' : ''}`}
                    onPointerDown={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      onChangeExercise(i);
                    }}
                    style={{
                      ...DOT_BASE,
                      width: isCurrent ? 12 : 8,
                      height: isCurrent ? 12 : 8,
                      background: isCurrent ? 'var(--mustard)' : dotColor,
                      border: `2px solid ${isCurrent ? 'var(--navy)' : 'var(--bone-deep)'}`,
                      cursor: 'pointer',
                    }}
                    whileHover={{ scale: 1.3 }}
                    whileTap={{ scale: 0.9 }}
                  />
                );
              })}
            </div>
          )}
        </div>

        {/* Right: Add + List */}
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {/* Add */}
          <button
            type="button"
            onPointerDown={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onAddExercise();
            }}
            aria-label="הוסף תרגיל"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
              height: 44,
              padding: '0 16px',
              background: 'var(--mustard)',
              color: 'var(--navy)',
              border: '2px solid var(--navy)',
              borderRadius: 0,
              cursor: 'pointer',
              fontFamily: 'var(--font-display)',
              fontWeight: 800,
              fontSize: 13,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              transition: 'all 150ms',
            }}
          >
            <Plus size={16} strokeWidth={2.5} />
            <span>הוסף</span>
          </button>

          {/* List */}
          <button
            type="button"
            onPointerDown={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onOpenDrawer();
            }}
            aria-label="רשימת תרגילים"
            style={{
              width: 44,
              height: 44,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
              background: 'var(--bone-deep)',
              color: 'var(--navy)',
              border: '2px solid var(--navy)',
              borderRadius: 0,
              cursor: 'pointer',
              transition: 'all 150ms',
              minWidth: 44,
              minHeight: 44,
            }}
          >
            <List size={18} strokeWidth={2} />
          </button>
        </div>
      </nav>
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

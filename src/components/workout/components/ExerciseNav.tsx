// ExerciseNav - Fresh Steel Compact Design
// Primary bg (#16292D) panel with white text · arrow buttons in surface bg · set progress as chips

import { List } from 'lucide-react';
import { memo, useCallback, useEffect } from 'react';
import type { Exercise } from '../../../types';
import { ChevronLeftIcon } from '../../icons';

interface ExerciseNavProps {
  exercises: Exercise[];
  currentIndex: number;
  onChangeExercise: (index: number) => void;
  onOpenDrawer: () => void;
}

const ExerciseNav = memo<ExerciseNavProps>(
  ({ exercises, currentIndex, onChangeExercise, onOpenDrawer }) => {
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

    return (
      <nav
        aria-label="ניווט בין תרגילים"
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
          padding: '10px 14px',
          background: 'var(--fs-bg)',
          borderTop: '1px solid var(--fs-surface-2)',
        }}
      >
        {/* Exercise rail — horizontally scrolling per-exercise tabs */}
        {exercises.length > 1 && (
          <div
            style={{
              display: 'grid',
              gridAutoFlow: 'column',
              gridAutoColumns: 'minmax(98px,1fr)',
              gap: 8,
              overflowX: 'auto',
              paddingBottom: 4,
              scrollbarWidth: 'none',
            }}
          >
            {exercises.map((ex, i) => (
              <button
                key={ex.id}
                type="button"
                onClick={() => onChangeExercise(i)}
                className={`magnetic-card${i === currentIndex ? ' accent-glow' : ''}`}
                style={{
                  minHeight: 58,
                  padding: 9,
                  border: '1px solid var(--fs-surface-2)',
                  borderRadius: 16,
                  background: i === currentIndex ? 'var(--fs-primary)' : 'var(--fs-surface)',
                  color: i === currentIndex ? '#fff' : 'var(--fs-muted)',
                  fontFamily: 'var(--font-body)',
                  fontWeight: 900,
                  display: 'grid',
                  alignContent: 'center',
                  gap: 3,
                  cursor: 'pointer',
                }}
              >
                <span
                  style={{
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    fontSize: 12,
                  }}
                >
                  {ex.name}
                </span>
                <small style={{ fontFamily: 'var(--font-mono)', fontSize: 10, opacity: 0.72 }}>
                  {ex.sets?.length ?? 0} סטים
                </small>
              </button>
            ))}
          </div>
        )}

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 8,
          }}
        >
          {/* Left: Prev + Center Panel */}
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flex: 1 }}>
            {/* Prev */}
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
              aria-label="תרגיל קודם"
              style={{
                width: 44,
                height: 44,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: '12px 8px 12px 8px',
                background: canGoPrev ? 'var(--fs-surface)' : 'var(--fs-surface-2)',
                border: '1px solid var(--fs-steel)',
                color: canGoPrev ? 'var(--fs-ink)' : 'var(--fs-muted)',
                cursor: canGoPrev ? 'pointer' : 'not-allowed',
                transition: 'all 150ms',
                minWidth: 44,
                minHeight: 44,
              }}
            >
              <ChevronLeftIcon style={{ transform: 'rotate(180deg)' }} />
            </button>

            {/* Center: Exercise name + set progress */}
            <div
              className="glass-surface"
              style={{
                flex: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                minHeight: 58,
                padding: '0 14px',
                background: 'var(--fs-primary)',
                borderRadius: 16,
                gap: 8,
              }}
            >
              <div style={{ minWidth: 0, flex: 1 }}>
                <span
                  style={{
                    fontFamily: 'var(--font-display)',
                    fontWeight: 800,
                    fontSize: 15,
                    color: '#FFFFFF',
                    lineHeight: 1.2,
                    display: 'block',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {currentExercise?.name || 'תרגיל'}
                </span>
                {/* Set progress chip */}
                {totalSets > 0 && (
                  <span
                    style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: 9,
                      letterSpacing: '0.08em',
                      color: 'rgba(255,255,255,0.6)',
                      fontWeight: 600,
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 4,
                      marginTop: 2,
                      padding: '1px 8px',
                      background: 'rgba(255,255,255,0.1)',
                      borderRadius: '8px 6px 8px 6px',
                    }}
                  >
                    סט {completedSets}/{totalSets}
                  </span>
                )}
              </div>
              {/* Current/Total position */}
              <span
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: 11,
                  fontWeight: 700,
                  letterSpacing: '0.06em',
                  color: 'rgba(255,255,255,0.5)',
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                {currentIndex + 1}/{exercises.length}
              </span>
            </div>

            {/* Next */}
            <button
              type="button"
              onPointerDown={(e) => {
                if (canGoNext) {
                  e.preventDefault();
                  e.stopPropagation();
                  handleNext();
                }
              }}
              disabled={!canGoNext}
              aria-label="תרגיל הבא"
              style={{
                width: 44,
                height: 44,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: '12px 8px 12px 8px',
                background: canGoNext ? 'var(--fs-surface)' : 'var(--fs-surface-2)',
                border: '1px solid var(--fs-steel)',
                color: canGoNext ? 'var(--fs-ink)' : 'var(--fs-muted)',
                cursor: canGoNext ? 'pointer' : 'not-allowed',
                transition: 'all 150ms',
                minWidth: 44,
                minHeight: 44,
              }}
            >
              <ChevronLeftIcon />
            </button>
          </div>

          {/* Right: List */}
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
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
                borderRadius: '12px 8px 12px 8px',
                background: 'var(--fs-surface-2)',
                border: '1px solid var(--fs-steel)',
                color: 'var(--fs-ink)',
                cursor: 'pointer',
                transition: 'all 150ms',
                minWidth: 44,
                minHeight: 44,
              }}
            >
              <List size={18} strokeWidth={2} />
            </button>
          </div>
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

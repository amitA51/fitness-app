// ExerciseList - Sport Annual Editorial Design
// VISION: Bold · Editorial · Confident · Narrative · Printed

import { useVirtualizer } from '@tanstack/react-virtual';
import type React from 'react';
import { memo, useCallback, useLayoutEffect, useRef, useState } from 'react';
import type { PersonalExercise } from '../../../types';
import { CustomDumbbellIcon as DumbbellIcon } from '../../icons/CustomDumbbellIcon';
import { ExerciseCard } from './ExerciseCard';

const VIRTUALIZE_THRESHOLD = 15;
const ESTIMATED_CARD_HEIGHT = 96;

interface ExerciseListProps {
  exercises: PersonalExercise[];
  isSelectionMode?: boolean;
  selectedIds?: Set<string>;
  onExerciseClick?: (exercise: PersonalExercise) => void;
  onDeleteExercise?: (exercise: PersonalExercise, e: React.MouseEvent) => void;
}

const ExerciseList: React.FC<ExerciseListProps> = memo(
  ({ exercises, isSelectionMode = false, selectedIds, onExerciseClick, onDeleteExercise }) => {
    if (exercises.length === 0) {
      return (
        <div
          style={{
            textAlign: 'center',
            paddingTop: 48,
            paddingBottom: 48,
            direction: 'rtl',
          }}
        >
          <DumbbellIcon
            className="w-12 h-12"
            style={{ margin: '0 auto 16px', color: 'var(--fs-surface-2)' }}
          />
          <div
            style={{
              fontFamily: 'var(--font-display)',
              fontWeight: 800,
              fontSize: 18,
              color: 'var(--fs-heading)',
              marginBottom: 8,
            }}
          >
            לא נמצאו תרגילים
          </div>
          <div
            style={{
              fontFamily: 'var(--font-body)',
              fontSize: 14,
              color: 'var(--fs-muted)',
            }}
          >
            נסה לשנות את הסינון או צור תרגיל חדש
          </div>
        </div>
      );
    }

    if (exercises.length >= VIRTUALIZE_THRESHOLD) {
      return (
        <VirtualizedExerciseList
          exercises={exercises}
          isSelectionMode={isSelectionMode}
          selectedIds={selectedIds}
          onExerciseClick={onExerciseClick}
          onDeleteExercise={onDeleteExercise}
        />
      );
    }

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {exercises.map((exercise) => (
          <ExerciseCard
            key={exercise.id}
            exercise={exercise}
            isSelectionMode={isSelectionMode}
            selectedIds={selectedIds}
            onClick={onExerciseClick}
            onDelete={onDeleteExercise}
          />
        ))}
      </div>
    );
  }
);

const VirtualizedExerciseList: React.FC<ExerciseListProps> = memo(
  ({ exercises, isSelectionMode = false, selectedIds, onExerciseClick, onDeleteExercise }) => {
    const parentRef = useRef<HTMLDivElement>(null);
    const [scrollMargin, setScrollMargin] = useState(0);

    // Resolve the nearest scrollable ancestor (the app's scrolling <main>).
    const getScrollElement = useCallback((): HTMLElement | null => {
      let el: HTMLElement | null = parentRef.current?.parentElement ?? null;
      while (el) {
        const style = window.getComputedStyle(el);
        if (/(auto|scroll)/.test(style.overflowY)) return el;
        el = el.parentElement;
      }
      return null;
    }, []);

    // The list can start far below other content inside the shared scroll
    // container, so tell the virtualizer how far down it begins. Measure the
    // offset of parentRef relative to the scroll element and keep it fresh.
    useLayoutEffect(() => {
      const measure = () => {
        const parent = parentRef.current;
        const scrollEl = getScrollElement();
        if (!parent || !scrollEl) return;
        const offset =
          parent.getBoundingClientRect().top -
          scrollEl.getBoundingClientRect().top +
          scrollEl.scrollTop;
        setScrollMargin(offset);
      };
      measure();
      window.addEventListener('resize', measure);
      return () => window.removeEventListener('resize', measure);
    }, [getScrollElement]);

    const virtualizer = useVirtualizer({
      count: exercises.length,
      getScrollElement,
      estimateSize: () => ESTIMATED_CARD_HEIGHT,
      overscan: 5,
      gap: 8,
      scrollMargin,
    });

    return (
      <div ref={parentRef}>
        <div
          style={{
            height: `${virtualizer.getTotalSize()}px`,
            position: 'relative',
            width: '100%',
          }}
        >
          {virtualizer.getVirtualItems().map((virtualRow) => {
            const exercise = exercises[virtualRow.index];
            if (!exercise) return null;
            return (
              <div
                key={exercise.id}
                data-index={virtualRow.index}
                ref={virtualizer.measureElement}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  transform: `translateY(${virtualRow.start - scrollMargin}px)`,
                }}
              >
                <ExerciseCard
                  exercise={exercise}
                  isSelectionMode={isSelectionMode}
                  selectedIds={selectedIds}
                  onClick={onExerciseClick}
                  onDelete={onDeleteExercise}
                />
              </div>
            );
          })}
        </div>
      </div>
    );
  }
);

VirtualizedExerciseList.displayName = 'VirtualizedExerciseList';

ExerciseList.displayName = 'ExerciseList';

export { ExerciseList };

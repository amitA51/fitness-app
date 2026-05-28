// ExerciseList - Sport Annual Editorial Design
// VISION: Bold · Editorial · Confident · Narrative · Printed

import { useVirtualizer } from '@tanstack/react-virtual';
import type React from 'react';
import { memo, useRef } from 'react';
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

    const virtualizer = useVirtualizer({
      count: exercises.length,
      getScrollElement: () => {
        // Walk up to find the nearest scrollable ancestor.
        let el: HTMLElement | null = parentRef.current?.parentElement ?? null;
        while (el) {
          const style = window.getComputedStyle(el);
          if (/(auto|scroll)/.test(style.overflowY)) return el;
          el = el.parentElement;
        }
        return null;
      },
      estimateSize: () => ESTIMATED_CARD_HEIGHT,
      overscan: 5,
      gap: 8,
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
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  transform: `translateY(${virtualRow.start}px)`,
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

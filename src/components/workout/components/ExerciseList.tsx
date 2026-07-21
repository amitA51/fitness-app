// ExerciseList - complete DOM order keeps every exercise keyboard and screen-reader reachable.

import { SearchX } from 'lucide-react';
import type React from 'react';
import { memo } from 'react';
import type { PersonalExercise } from '../../../types';
import { ExerciseCard } from './ExerciseCard';

interface ExerciseListProps {
  exercises: PersonalExercise[];
  isSelectionMode?: boolean;
  selectedIds?: Set<string>;
  onExerciseClick?: (exercise: PersonalExercise) => void;
  onDeleteExercise?: (exercise: PersonalExercise, e: React.MouseEvent) => void;
  emptyTitle?: string;
  emptyDescription?: string;
}

const ExerciseList: React.FC<ExerciseListProps> = memo(
  ({
    exercises,
    isSelectionMode = false,
    selectedIds,
    onExerciseClick,
    onDeleteExercise,
    emptyTitle = 'עדיין אין תרגילים',
    emptyDescription = 'צרו תרגיל חדש כדי להתחיל לבנות את הספרייה.',
  }) => {
    if (exercises.length === 0) {
      return (
        <div className="exercise-library-empty">
          <div className="exercise-library-empty__icon">
            <SearchX aria-hidden="true" />
          </div>
          <h2>{emptyTitle}</h2>
          <p>{emptyDescription}</p>
        </div>
      );
    }

    return (
      <div className="exercise-list" role="list" aria-label="תרגילים">
        {exercises.map((exercise) => (
          <div role="listitem" key={exercise.id}>
            <ExerciseCard
              exercise={exercise}
              isSelectionMode={isSelectionMode}
              isSelected={selectedIds?.has(exercise.id) ?? false}
              onClick={onExerciseClick}
              onDelete={onDeleteExercise}
            />
          </div>
        ))}
      </div>
    );
  }
);

ExerciseList.displayName = 'ExerciseList';

export { ExerciseList };

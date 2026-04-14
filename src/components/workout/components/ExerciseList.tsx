import React, { memo } from 'react';
import { ExerciseCard } from './ExerciseCard';
import { PersonalExercise } from '../../../types';

const DumbbellIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M19 11a7.5 7.5 0 01-3.5 13M19 11h-5m5 0a7.5 7.5 0 00-7.5-7.5m7.5 7.5V5.5a2.5 2.5 0 00-5 0V11m-9.5 7h4.5m-4.5 0a7.5 7.5 0 017-5.5m0 0H9m2.5 0V5.5a2.5 2.5 0 00-5 0V11m2.5 0h-2.5m2.5 0a7.5 7.5 0 017 5.5"
    />
  </svg>
);

interface ExerciseListProps {
  exercises: PersonalExercise[];
  isSelectionMode?: boolean;
  selectedIds?: Set<string>;
  onExerciseClick?: (exercise: PersonalExercise) => void;
  onDeleteExercise?: (exercise: PersonalExercise, e: React.MouseEvent) => void;
}

const ExerciseList: React.FC<ExerciseListProps> = memo(({
  exercises,
  isSelectionMode = false,
  selectedIds,
  onExerciseClick,
  onDeleteExercise,
}) => {
  if (exercises.length === 0) {
    return (
      <div className="text-center py-20 opacity-30 flex flex-col items-center">
        <DumbbellIcon className="w-16 h-16 mb-4" />
        <div className="text-lg font-bold">לא נמצאו תרגילים</div>
        <div className="text-sm">נסה לשנות את הסינון או הוסף תרגיל חדש</div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-2">
      {exercises.map(exercise => (
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
});

ExerciseList.displayName = 'ExerciseList';

export { ExerciseList };

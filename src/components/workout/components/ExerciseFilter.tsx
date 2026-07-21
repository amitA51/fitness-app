// ExerciseFilter - direct search, progressive filters, and quick picks.

import { Search, SlidersHorizontal, X } from 'lucide-react';
import type React from 'react';
import { useMemo, useRef, useState } from 'react';
import { MUSCLE_GROUPS } from '../../../constants';
import { EQUIPMENT_KEYS, translateEquipment } from '../../../constants/equipmentNames';
import type { PersonalExercise } from '../../../types';

const MUSCLE_LABELS: Record<string, string> = {
  all: 'הכל',
  Chest: 'חזה',
  Back: 'גב',
  Legs: 'רגליים',
  Shoulders: 'כתפיים',
  Arms: 'ידיים',
  Core: 'ליבה',
  Cardio: 'אירובי',
  Abs: 'בטן',
  Other: 'אחר',
};

interface ExerciseFilterProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  selectedMuscleGroup: string;
  onMuscleGroupChange: (group: string) => void;
  selectedEquipment?: string;
  onEquipmentChange?: (equipment: string) => void;
  exercises?: PersonalExercise[];
  onSuggestionSelect?: (exercise: PersonalExercise) => void;
}

const ExerciseFilter: React.FC<ExerciseFilterProps> = ({
  searchQuery,
  onSearchChange,
  selectedMuscleGroup,
  onMuscleGroupChange,
  selectedEquipment = 'all',
  onEquipmentChange,
  exercises = [],
  onSuggestionSelect,
}) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [showEquipment, setShowEquipment] = useState(selectedEquipment !== 'all');
  const muscleGroups = Object.values(MUSCLE_GROUPS);

  const quickExercises = useMemo(
    () =>
      [...exercises]
        .filter((exercise) => exercise.isFavorite || (exercise.useCount ?? 0) > 0)
        .sort((a, b) => {
          if (Boolean(a.isFavorite) !== Boolean(b.isFavorite)) return a.isFavorite ? -1 : 1;
          const recentDelta =
            new Date(b.lastUsed ?? 0).getTime() - new Date(a.lastUsed ?? 0).getTime();
          if (recentDelta !== 0) return recentDelta;
          return (b.useCount ?? 0) - (a.useCount ?? 0);
        })
        .slice(0, 4),
    [exercises]
  );

  const showQuickPicks =
    quickExercises.length > 0 &&
    !searchQuery.trim() &&
    selectedMuscleGroup === 'all' &&
    selectedEquipment === 'all';

  const handleQuickPick = (exercise: PersonalExercise) => {
    if (onSuggestionSelect) {
      onSuggestionSelect(exercise);
      return;
    }
    onSearchChange(exercise.name ?? '');
    inputRef.current?.focus();
  };

  const activeEquipmentCount = selectedEquipment === 'all' ? 0 : 1;

  return (
    <section className="exercise-filters" aria-label="חיפוש וסינון תרגילים">
      <div className="exercise-search">
        <Search className="exercise-search__icon" aria-hidden="true" />
        <input
          ref={inputRef}
          className="exercise-search__input"
          type="search"
          inputMode="search"
          enterKeyHint="search"
          aria-label="חיפוש לפי שם, שריר או ציוד"
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          dir="auto"
          value={searchQuery}
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder="חיפוש לפי שם, שריר או ציוד"
        />
        {searchQuery && (
          <button
            type="button"
            className="exercise-search__clear"
            onClick={() => {
              onSearchChange('');
              inputRef.current?.focus();
            }}
            aria-label="נקה את החיפוש"
          >
            <X aria-hidden="true" />
          </button>
        )}
      </div>

      {showQuickPicks && (
        <div className="exercise-quick-picks">
          <span className="exercise-quick-picks__label">בחירה מהירה</span>
          <div className="exercise-quick-picks__scroller">
            {quickExercises.map((exercise) => (
              <button
                type="button"
                className="exercise-quick-pick"
                key={exercise.id}
                onClick={() => handleQuickPick(exercise)}
                aria-label={`${onSuggestionSelect ? 'בחרו' : 'חפשו'} ${exercise.name ?? 'תרגיל'}`}
              >
                <bdi dir="auto">{exercise.name}</bdi>
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="exercise-filter-row__topline">
        <span className="exercise-filter-row__label">קבוצת שריר</span>
        {onEquipmentChange && (
          <button
            type="button"
            className="exercise-filter-toggle"
            data-active={activeEquipmentCount > 0}
            aria-expanded={showEquipment}
            aria-controls="exercise-equipment-filters"
            onClick={() => setShowEquipment((current) => !current)}
          >
            <SlidersHorizontal aria-hidden="true" />
            ציוד{activeEquipmentCount > 0 ? ` · ${activeEquipmentCount}` : ''}
          </button>
        )}
      </div>

      <div className="exercise-filter-row">
        <div className="exercise-filter-chips" role="group" aria-label="סינון לפי קבוצת שריר">
          {muscleGroups.map((group) => (
            <button
              type="button"
              className="exercise-filter-chip"
              key={group}
              aria-pressed={selectedMuscleGroup === group}
              onClick={() => onMuscleGroupChange(group)}
            >
              {MUSCLE_LABELS[group] ?? group}
            </button>
          ))}
        </div>
      </div>

      {onEquipmentChange && showEquipment && (
        <div className="exercise-equipment-panel" id="exercise-equipment-filters">
          <div className="exercise-filter-row__label">סוג ציוד</div>
          <div className="exercise-filter-chips" role="group" aria-label="סינון לפי ציוד">
            {['all', ...EQUIPMENT_KEYS].map((equipment) => (
              <button
                type="button"
                className="exercise-filter-chip"
                key={equipment}
                aria-pressed={selectedEquipment === equipment}
                onClick={() => onEquipmentChange(equipment)}
              >
                {equipment === 'all' ? 'כל הציוד' : translateEquipment(equipment)}
              </button>
            ))}
          </div>
        </div>
      )}
    </section>
  );
};

export { ExerciseFilter };
export default ExerciseFilter;

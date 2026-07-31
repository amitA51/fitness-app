// ExerciseFilter - direct search, progressive filters, and quick picks.

import { AnimatePresence, m } from 'framer-motion';
import { Search, SlidersHorizontal, X } from 'lucide-react';
import type React from 'react';
import { useMemo, useRef, useState } from 'react';
import { EQUIPMENT_KEYS, translateEquipment } from '../../../constants/equipmentNames';
import {
  FORCE_KEYS,
  LEVEL_KEYS,
  MECHANIC_KEYS,
  mechanicHint,
  translateForce,
  translateLevel,
  translateMechanic,
} from '../../../constants/exerciseClassification';
import { MUSCLE_FILTER_KEYS, translateMuscle } from '../../../constants/muscleNames';
import { useReducedMotion } from '../../../hooks/useReducedMotion';
import type { PersonalExercise } from '../../../types';

// Chip labels come from translateMuscle, not a local table. The local copy used to
// say "ליבה" for Core while the exercise cards said "בטן" for the same exercise,
// so the two surfaces disagreed about what the muscle is called.
const ALL_LABEL = 'הכל';

interface ExerciseFilterProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  selectedMuscleGroup: string;
  onMuscleGroupChange: (group: string) => void;
  selectedEquipment?: string;
  onEquipmentChange?: (equipment: string) => void;
  /** `compound` / `isolation` / `all` — filters by movement pattern. */
  selectedMechanic?: string;
  onMechanicChange?: (mechanic: string) => void;
  /** `push` / `pull` / `static` / `all` — drives push-pull split programming. */
  selectedForce?: string;
  onForceChange?: (force: string) => void;
  /** `beginner` / `intermediate` / `expert` / `all` — filters by required skill. */
  selectedLevel?: string;
  onLevelChange?: (level: string) => void;
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
  selectedMechanic = 'all',
  onMechanicChange,
  selectedForce = 'all',
  onForceChange,
  selectedLevel = 'all',
  onLevelChange,
  exercises = [],
  onSuggestionSelect,
}) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const hasAdvancedFilters = Boolean(
    onEquipmentChange || onMechanicChange || onForceChange || onLevelChange
  );
  const [showAdvanced, setShowAdvanced] = useState(
    selectedEquipment !== 'all' ||
      selectedMechanic !== 'all' ||
      selectedForce !== 'all' ||
      selectedLevel !== 'all'
  );
  const shouldReduceMotion = useReducedMotion();

  // Reduced motion keeps the state change legible but drops the vestibular part:
  // a plain cross-fade instead of the slide-and-scale. bounce 0 because opening a
  // panel carries no momentum — overshoot is only earned by a gesture.
  const panelMotion = useMemo(
    () =>
      shouldReduceMotion
        ? {
            hidden: { opacity: 0 },
            visible: { opacity: 1 },
            transition: { duration: 0.15, ease: 'linear' as const },
          }
        : {
            hidden: { opacity: 0, y: -4, scale: 0.99 },
            visible: { opacity: 1, y: 0, scale: 1 },
            transition: { type: 'spring' as const, bounce: 0, duration: 0.3 },
          },
    [shouldReduceMotion]
  );

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

  // Quick picks ignore the filters by design (they are shortcuts to your own
  // frequent movements), so they must hide as soon as ANY filter is narrowing the
  // list — otherwise they offer exercises the user just filtered out.
  const showQuickPicks =
    quickExercises.length > 0 &&
    !searchQuery.trim() &&
    selectedMuscleGroup === 'all' &&
    selectedEquipment === 'all' &&
    selectedMechanic === 'all' &&
    selectedForce === 'all' &&
    selectedLevel === 'all';

  const handleQuickPick = (exercise: PersonalExercise) => {
    if (onSuggestionSelect) {
      onSuggestionSelect(exercise);
      return;
    }
    onSearchChange(exercise.name ?? '');
    inputRef.current?.focus();
  };

  const activeAdvancedCount =
    (selectedEquipment === 'all' ? 0 : 1) +
    (selectedMechanic === 'all' ? 0 : 1) +
    (selectedForce === 'all' ? 0 : 1) +
    (selectedLevel === 'all' ? 0 : 1);

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
        {hasAdvancedFilters && (
          <button
            type="button"
            className="exercise-filter-toggle"
            data-active={activeAdvancedCount > 0}
            aria-expanded={showAdvanced}
            aria-controls="exercise-advanced-filters"
            onClick={() => setShowAdvanced((current) => !current)}
          >
            <SlidersHorizontal aria-hidden="true" />
            סינון{activeAdvancedCount > 0 ? ` · ${activeAdvancedCount}` : ''}
          </button>
        )}
      </div>

      <div className="exercise-filter-row">
        <div className="exercise-filter-chips" role="group" aria-label="סינון לפי קבוצת שריר">
          <button
            type="button"
            className="exercise-filter-chip"
            aria-pressed={selectedMuscleGroup === 'all'}
            onClick={() => onMuscleGroupChange('all')}
          >
            {ALL_LABEL}
          </button>
          {MUSCLE_FILTER_KEYS.map((group) => (
            <button
              type="button"
              className="exercise-filter-chip"
              key={group}
              aria-pressed={selectedMuscleGroup === group}
              onClick={() => onMuscleGroupChange(group)}
            >
              {translateMuscle(group)}
            </button>
          ))}
        </div>
      </div>

      <AnimatePresence initial={false}>
        {hasAdvancedFilters && showAdvanced && (
          <m.div
            className="exercise-equipment-panel"
            id="exercise-advanced-filters"
            // Enter and exit trace the same path, anchored under the toggle that
            // opened it. Previously the panel animated in via a CSS keyframe and
            // then vanished on close, which read as two unrelated events. A spring
            // also stays grabbable mid-flight, which a keyframe never is.
            initial={panelMotion.hidden}
            animate={panelMotion.visible}
            exit={panelMotion.hidden}
            transition={panelMotion.transition}
          >
            {onEquipmentChange && (
              <>
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
              </>
            )}

            {onMechanicChange && (
              <>
                <div className="exercise-filter-row__label">סוג תרגיל</div>
                <div
                  className="exercise-filter-chips"
                  role="group"
                  aria-label="סינון לפי סוג תרגיל"
                >
                  <button
                    type="button"
                    className="exercise-filter-chip"
                    aria-pressed={selectedMechanic === 'all'}
                    onClick={() => onMechanicChange('all')}
                  >
                    {ALL_LABEL}
                  </button>
                  {MECHANIC_KEYS.map((mechanic) => (
                    <button
                      type="button"
                      className="exercise-filter-chip"
                      key={mechanic}
                      aria-pressed={selectedMechanic === mechanic}
                      onClick={() => onMechanicChange(mechanic)}
                    >
                      {translateMechanic(mechanic)}
                    </button>
                  ))}
                </div>
                {/* Visible instead of a `title` tooltip: this is a touch-first PWA
                    where a hover tooltip is unreachable, and screen readers treat
                    `title` inconsistently. The term teaches itself in place. */}
                <p className="exercise-filter-hint">
                  {selectedMechanic === 'all'
                    ? `${translateMechanic('compound')} — ${mechanicHint('compound')}`
                    : mechanicHint(selectedMechanic)}
                </p>
              </>
            )}

            {onForceChange && (
              <>
                <div className="exercise-filter-row__label">כיוון התנגדות</div>
                <div
                  className="exercise-filter-chips"
                  role="group"
                  aria-label="סינון לפי כיוון התנגדות"
                >
                  <button
                    type="button"
                    className="exercise-filter-chip"
                    aria-pressed={selectedForce === 'all'}
                    onClick={() => onForceChange('all')}
                  >
                    {ALL_LABEL}
                  </button>
                  {FORCE_KEYS.map((force) => (
                    <button
                      type="button"
                      className="exercise-filter-chip"
                      key={force}
                      aria-pressed={selectedForce === force}
                      onClick={() => onForceChange(force)}
                    >
                      {translateForce(force)}
                    </button>
                  ))}
                </div>
              </>
            )}

            {onLevelChange && (
              <>
                <div className="exercise-filter-row__label">רמת קושי</div>
                <div className="exercise-filter-chips" role="group" aria-label="סינון לפי רמת קושי">
                  <button
                    type="button"
                    className="exercise-filter-chip"
                    aria-pressed={selectedLevel === 'all'}
                    onClick={() => onLevelChange('all')}
                  >
                    {ALL_LABEL}
                  </button>
                  {LEVEL_KEYS.map((level) => (
                    <button
                      type="button"
                      className="exercise-filter-chip"
                      key={level}
                      aria-pressed={selectedLevel === level}
                      onClick={() => onLevelChange(level)}
                    >
                      {translateLevel(level)}
                    </button>
                  ))}
                </div>
              </>
            )}
          </m.div>
        )}
      </AnimatePresence>
    </section>
  );
};

export { ExerciseFilter };
export default ExerciseFilter;

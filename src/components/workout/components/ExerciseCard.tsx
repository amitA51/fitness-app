// ExerciseCard - fast-scanning row with quiet metadata and explicit selection.

import { m } from 'framer-motion';
import { Check, Clock3, Trash2 } from 'lucide-react';
import type React from 'react';
import { memo } from 'react';
import { translateEquipment } from '../../../constants/equipmentNames';
import {
  preciseMuscleLabel,
  translateLevel,
  translateMechanic,
} from '../../../constants/exerciseClassification';
import { useReducedMotion } from '../../../hooks/useReducedMotion';
import type { PersonalExercise } from '../../../types';
import { CustomDumbbellIcon as DumbbellIcon } from '../../icons/CustomDumbbellIcon';

const hasHebrew = (text: string) => /[\u0590-\u05FF]/.test(text);

interface ExerciseCardProps {
  exercise: PersonalExercise;
  isSelectionMode?: boolean;
  isSelected?: boolean;
  onClick?: (exercise: PersonalExercise) => void;
  onDelete?: (exercise: PersonalExercise, e: React.MouseEvent) => void;
}

function ExerciseName({ name }: { name: string }) {
  if (!name.includes('|')) {
    return (
      <bdi className="exercise-card__name" dir="auto">
        {name}
      </bdi>
    );
  }

  const [first = '', second = ''] = name.split('|').map((part) => part.trim());
  const firstIsHebrew = hasHebrew(first);
  const secondIsHebrew = hasHebrew(second);
  const isHebrewEnglishPair = firstIsHebrew !== secondIsHebrew;
  const primary = isHebrewEnglishPair ? (firstIsHebrew ? first : second) : first;
  const secondary = isHebrewEnglishPair ? (firstIsHebrew ? second : first) : second;
  const secondaryIsEnglish = isHebrewEnglishPair && !hasHebrew(secondary);

  // Both halves share ONE row (see .exercise-card__name--pair). Stacking them
  // was what made a row ~96px tall and cost the list a third of its rows.
  return (
    <span className="exercise-card__name exercise-card__name--pair">
      <bdi className="exercise-card__name-primary" dir="auto">
        {primary}
      </bdi>
      {secondary && (
        <bdi
          className="exercise-card__name-secondary"
          // Explicit `ltr`, not `auto`: a Latin name that opens with a digit or a
          // bracket ("45° Incline", "(Barbell) Row") has no strong LTR character
          // to sniff at that position, so inside this RTL row `auto` can flip the
          // punctuation to the wrong end. `bdi` keeps it isolated either way.
          dir={secondaryIsEnglish ? 'ltr' : 'auto'}
          lang={secondaryIsEnglish ? 'en' : undefined}
        >
          {secondary}
        </bdi>
      )}
    </span>
  );
}

const ExerciseCard: React.FC<ExerciseCardProps> = memo(
  ({ exercise, isSelectionMode = false, isSelected = false, onClick, onDelete }) => {
    const shouldReduceMotion = useReducedMotion();
    const name = exercise.name?.trim() || 'תרגיל ללא שם';
    // The precise prime mover, not the filing category: "גב רחב" tells you what
    // the exercise trains, "גב" only tells you which tab it lives in.
    const muscleText = preciseMuscleLabel(exercise);
    const equipmentText = translateEquipment(exercise.equipment);
    const mechanicText = translateMechanic(exercise.mechanic);
    // Beginner is the default for two thirds of the catalog, so labelling it adds
    // noise. Only a level that should give you pause earns a badge.
    const levelText =
      exercise.level && exercise.level !== 'beginner' ? translateLevel(exercise.level) : '';
    const restSeconds = exercise.defaultRestTime || 90;
    const isInteractive = Boolean(onClick);
    const selectionText = isSelectionMode ? (isSelected ? 'נבחר' : 'לא נבחר') : '';
    const accessibleMeta = [
      muscleText,
      mechanicText,
      levelText,
      equipmentText,
      `${restSeconds} שניות`,
      selectionText,
    ]
      .filter(Boolean)
      .join(', ');

    return (
      <m.div
        className="exercise-card"
        data-selected={isSelected}
        data-interactive={isInteractive}
        role={isInteractive ? 'button' : undefined}
        tabIndex={isInteractive ? 0 : undefined}
        aria-pressed={isSelectionMode && isInteractive ? isSelected : undefined}
        aria-label={isInteractive ? `${name}, ${accessibleMeta}` : undefined}
        onClick={isInteractive ? () => onClick?.(exercise) : undefined}
        onKeyDown={
          isInteractive
            ? (event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  onClick?.(exercise);
                }
              }
            : undefined
        }
        whileTap={isInteractive && !shouldReduceMotion ? { scale: 0.985 } : undefined}
        transition={{ type: 'spring', bounce: 0, duration: 0.22 }}
      >
        <div className="exercise-card__content">
          <div className="exercise-card__visual" aria-hidden="true">
            <DumbbellIcon />
          </div>

          <div className="exercise-card__details">
            <div className="exercise-card__title-row">
              <ExerciseName name={name} />
              {levelText && (
                <span className="exercise-card__level" data-level={exercise.level}>
                  {levelText}
                </span>
              )}
              {exercise.isCustom && <span className="exercise-card__personal">אישי</span>}
            </div>

            <div className="exercise-card__meta">
              <span>{muscleText}</span>
              {mechanicText && (
                <>
                  <span className="exercise-card__meta-separator" aria-hidden="true">
                    ·
                  </span>
                  <span>{mechanicText}</span>
                </>
              )}
              {equipmentText && (
                <>
                  <span className="exercise-card__meta-separator" aria-hidden="true">
                    ·
                  </span>
                  <span>{equipmentText}</span>
                </>
              )}
              <span className="exercise-card__meta-separator" aria-hidden="true">
                ·
              </span>
              <span className="exercise-card__rest">
                <Clock3 aria-hidden="true" />
                <span>
                  <bdi dir="ltr">{restSeconds}</bdi> שנ׳
                </span>
              </span>
            </div>

            {exercise.notes && <p className="exercise-card__notes">{exercise.notes}</p>}
          </div>

          {isSelectionMode ? (
            <span className="exercise-card__action exercise-card__selection" aria-hidden="true">
              {isSelected ? <Check /> : <span className="exercise-card__selection-placeholder" />}
            </span>
          ) : (
            onDelete && (
              <button
                type="button"
                className="exercise-card__action exercise-card__delete"
                onClick={(event) => {
                  event.stopPropagation();
                  onDelete(exercise, event);
                }}
                aria-label={`מחקו את ${name}`}
              >
                <Trash2 aria-hidden="true" />
              </button>
            )
          )}
        </div>
      </m.div>
    );
  }
);

ExerciseCard.displayName = 'ExerciseCard';

export { ExerciseCard };

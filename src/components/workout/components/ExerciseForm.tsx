// ExerciseForm - focused essentials with optional details on demand.

import { Plus, Save, X } from 'lucide-react';
import type React from 'react';
import { useId } from 'react';
import { EXERCISE_CATEGORIES, MUSCLE_GROUPS, WORKOUT } from '../../../constants';
import { EQUIPMENT_KEYS, translateEquipment } from '../../../constants/equipmentNames';
import { translateMuscle } from '../../../constants/muscleNames';

interface ExerciseFormData {
  name: string;
  muscleGroup: string;
  category: string;
  equipment: string;
  tempo: string;
  tutorialText: string;
  defaultRestTime: number;
  defaultSets: number;
  notes: string;
}

interface ExerciseFormProps {
  formData: ExerciseFormData;
  onChange: (data: ExerciseFormData) => void;
  onSubmit: (e: React.FormEvent) => void;
  onCancel: () => void;
  isSubmitting?: boolean;
}

const muscleGroupOptions = Object.entries(MUSCLE_GROUPS)
  .filter(([key]) => key !== 'ALL')
  .map(([, value]) => value);

const categoryOptions = Object.entries(EXERCISE_CATEGORIES)
  .filter(([key]) => key !== 'ALL')
  .map(([, value]) => value);

const CATEGORY_LABELS: Record<string, string> = {
  strength: 'כוח',
  cardio: 'אירובי',
  flexibility: 'גמישות',
  warmup: 'חימום',
  cooldown: 'שחרור',
};

export const ExerciseForm: React.FC<ExerciseFormProps> = ({
  formData,
  onChange,
  onSubmit,
  onCancel,
  isSubmitting = false,
}) => {
  const nameId = useId();
  const muscleGroupId = useId();
  const categoryId = useId();
  const equipmentId = useId();
  const setsId = useId();
  const restTimeId = useId();
  const tempoId = useId();
  const tutorialId = useId();
  const notesId = useId();

  const updateField = <K extends keyof ExerciseFormData>(field: K, value: ExerciseFormData[K]) => {
    onChange({ ...formData, [field]: value });
  };

  return (
    <form className="exercise-form" onSubmit={onSubmit} aria-busy={isSubmitting}>
      <div className="exercise-form__header">
        <div>
          <h2>תרגיל חדש</h2>
          <p>הגדירו את הפרטים שתרצו לראות בזמן האימון.</p>
        </div>
        <button
          type="button"
          className="exercise-form__close"
          onClick={onCancel}
          disabled={isSubmitting}
          aria-label="סגרו את טופס יצירת התרגיל"
        >
          <X aria-hidden="true" />
        </button>
      </div>

      <div className="exercise-form__field">
        <label className="exercise-form__label" htmlFor={nameId}>
          <span>שם התרגיל</span>
          <span className="exercise-form__required">חובה</span>
        </label>
        <input
          id={nameId}
          className="exercise-form__control"
          disabled={isSubmitting}
          type="text"
          dir="auto"
          value={formData.name}
          onChange={(event) => updateField('name', event.target.value)}
          placeholder="לדוגמה: לחיצת חזה"
          autoComplete="off"
          autoFocus
          required
        />
      </div>

      <div className="exercise-form__grid">
        <div className="exercise-form__field">
          <label className="exercise-form__label" htmlFor={muscleGroupId}>
            שריר ראשי
          </label>
          <select
            id={muscleGroupId}
            className="exercise-form__control"
            disabled={isSubmitting}
            value={formData.muscleGroup}
            onChange={(event) => updateField('muscleGroup', event.target.value)}
          >
            <option value="">בחרו שריר</option>
            {muscleGroupOptions.map((group) => (
              <option key={group} value={group}>
                {translateMuscle(group)}
              </option>
            ))}
          </select>
        </div>

        <div className="exercise-form__field">
          <label className="exercise-form__label" htmlFor={categoryId}>
            סוג אימון
          </label>
          <select
            id={categoryId}
            className="exercise-form__control"
            disabled={isSubmitting}
            value={formData.category}
            onChange={(event) => updateField('category', event.target.value)}
          >
            <option value="">בחרו סוג</option>
            {categoryOptions.map((category) => (
              <option key={category} value={category}>
                {CATEGORY_LABELS[category] ?? category}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="exercise-form__field">
        <label className="exercise-form__label" htmlFor={equipmentId}>
          ציוד
        </label>
        <select
          id={equipmentId}
          className="exercise-form__control"
          disabled={isSubmitting}
          value={formData.equipment}
          onChange={(event) => updateField('equipment', event.target.value)}
        >
          <option value="">ללא ציוד מוגדר</option>
          {EQUIPMENT_KEYS.map((equipment) => (
            <option key={equipment} value={equipment}>
              {translateEquipment(equipment)}
            </option>
          ))}
        </select>
      </div>

      <div className="exercise-form__grid exercise-form__grid--three">
        <div className="exercise-form__field">
          <label className="exercise-form__label" htmlFor={setsId}>
            סטים
          </label>
          <input
            id={setsId}
            className="exercise-form__control"
            disabled={isSubmitting}
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            dir="ltr"
            value={formData.defaultSets}
            onChange={(event) =>
              updateField(
                'defaultSets',
                Number.parseInt(event.target.value) || WORKOUT.DEFAULT_SETS
              )
            }
            aria-label="מספר סטים ברירת מחדל"
          />
        </div>

        <div className="exercise-form__field">
          <label className="exercise-form__label" htmlFor={restTimeId}>
            מנוחה
          </label>
          <input
            id={restTimeId}
            className="exercise-form__control"
            disabled={isSubmitting}
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            dir="ltr"
            value={formData.defaultRestTime}
            onChange={(event) =>
              updateField(
                'defaultRestTime',
                Number.parseInt(event.target.value) || WORKOUT.DEFAULT_REST_TIME
              )
            }
            aria-label="זמן מנוחה בשניות"
          />
        </div>

        <div className="exercise-form__field">
          <label className="exercise-form__label" htmlFor={tempoId}>
            טמפו
          </label>
          <input
            id={tempoId}
            className="exercise-form__control"
            disabled={isSubmitting}
            type="text"
            inputMode="numeric"
            dir="ltr"
            value={formData.tempo}
            onChange={(event) => updateField('tempo', event.target.value)}
            placeholder="3-1-1"
          />
        </div>
      </div>

      <details className="exercise-form__advanced">
        <summary>פרטים נוספים</summary>
        <div className="exercise-form__advanced-fields">
          <div className="exercise-form__field">
            <label className="exercise-form__label" htmlFor={tutorialId}>
              הנחיות ביצוע
            </label>
            <textarea
              id={tutorialId}
              className="exercise-form__control"
              disabled={isSubmitting}
              dir="auto"
              value={formData.tutorialText}
              onChange={(event) => updateField('tutorialText', event.target.value)}
              placeholder="דגשים קצרים לטכניקה"
            />
          </div>
          <div className="exercise-form__field">
            <label className="exercise-form__label" htmlFor={notesId}>
              הערה אישית
            </label>
            <textarea
              id={notesId}
              className="exercise-form__control"
              disabled={isSubmitting}
              dir="auto"
              value={formData.notes}
              onChange={(event) => updateField('notes', event.target.value)}
              placeholder="כל מה שכדאי לזכור באימון הבא"
            />
          </div>
        </div>
      </details>

      <button
        type="submit"
        className="exercise-form__submit"
        disabled={isSubmitting || !formData.name.trim()}
      >
        <Save aria-hidden="true" />
        {isSubmitting ? 'שומר…' : 'שמרו תרגיל'}
      </button>
    </form>
  );
};

interface AddExerciseButtonProps {
  onClick: () => void;
}

/** Kept for callers that use the shared components barrel. */
export const AddExerciseButton: React.FC<AddExerciseButtonProps> = ({ onClick }) => (
  <button type="button" className="exercise-library__create-button" onClick={onClick}>
    <Plus aria-hidden="true" />
    צרו תרגיל חדש
  </button>
);

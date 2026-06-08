// ExerciseForm - Fresh Steel / Obsidian
// Sharp corners · surface background · steel border
// VISION: Bold · Editorial · Confident · Narrative · Printed

import { Plus as AddIcon } from 'lucide-react';
import type React from 'react';
import { useId } from 'react';
import { EXERCISE_CATEGORIES, MUSCLE_GROUPS, WORKOUT } from '../../../constants';
import type { PersonalExercise } from '../../../types';

interface ExerciseFormData {
  name: string;
  muscleGroup: string;
  category: string;
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
}

const muscleGroupOptions = Object.entries(MUSCLE_GROUPS)
  .filter(([key]) => key !== 'ALL')
  .map(([, value]) => value);

const categoryOptions = Object.entries(EXERCISE_CATEGORIES)
  .filter(([key]) => key !== 'ALL')
  .map(([, value]) => value);

export const ExerciseForm: React.FC<ExerciseFormProps> = ({
  formData,
  onChange,
  onSubmit,
  onCancel,
}) => {
  const nameId = useId();
  const muscleGroupId = useId();
  const categoryId = useId();
  const setsId = useId();
  const restTimeId = useId();
  const tempoId = useId();
  const updateField = <K extends keyof ExerciseFormData>(field: K, value: ExerciseFormData[K]) => {
    onChange({ ...formData, [field]: value });
  };

  const inputStyle: React.CSSProperties = {
    width: '100%',
    background: 'var(--fs-surface)',
    border: '2px solid var(--fs-primary)',
    borderRadius: 0,
    padding: '10px 14px',
    fontFamily: 'var(--font-body)',
    fontSize: 15,
    color: 'var(--fs-ink)',
    outline: 'none',
    direction: 'rtl',
    textAlign: 'right',
  };

  const labelStyle: React.CSSProperties = {
    display: 'block',
    fontFamily: 'var(--font-mono)',
    fontSize: 10,
    letterSpacing: '0.18em',
    textTransform: 'uppercase',
    color: 'var(--fs-muted)',
    marginBottom: 6,
    fontWeight: 600,
  };

  return (
    <form
      onSubmit={onSubmit}
      style={{
        background: 'var(--fs-surface)',
        border: '2px solid var(--fs-primary)',
        padding: 16,
        display: 'flex',
        flexDirection: 'column',
        gap: 14,
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          borderBottom: '1px solid var(--fs-surface-2)',
          paddingBottom: 10,
        }}
      >
        <span
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 10,
            letterSpacing: '0.18em',
            textTransform: 'uppercase',
            color: 'var(--fs-accent)',
            fontWeight: 600,
          }}
        >
          צור תרגיל
        </span>
        <button
          type="button"
          onClick={onCancel}
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 10,
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
            color: 'var(--fs-muted)',
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
          }}
        >
          ביטול
        </button>
      </div>

      {/* Name */}
      <div>
        <label htmlFor={nameId} style={labelStyle}>
          שם התרגיל
        </label>
        <input
          id={nameId}
          type="text"
          value={formData.name}
          onChange={(e) => updateField('name', e.target.value)}
          placeholder="לדוגמה: לחיצת חזה | Bench Press"
          style={inputStyle}
          autoFocus
          required
        />
      </div>

      {/* Muscle Group + Category */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <div>
          <label htmlFor={muscleGroupId} style={labelStyle}>
            שריר ראשי
          </label>
          <select
            id={muscleGroupId}
            value={formData.muscleGroup}
            onChange={(e) => updateField('muscleGroup', e.target.value)}
            style={{ ...inputStyle, appearance: 'none' }}
          >
            <option value="">בחר...</option>
            {muscleGroupOptions.map((g) => (
              <option key={g} value={g}>
                {g}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor={categoryId} style={labelStyle}>
            קטגוריה
          </label>
          <select
            id={categoryId}
            value={formData.category}
            onChange={(e) =>
              updateField('category', (e.target.value as PersonalExercise['category']) ?? '')
            }
            style={{ ...inputStyle, appearance: 'none' }}
          >
            <option value="">בחר...</option>
            {categoryOptions.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Sets + Rest + Tempo */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
        <div>
          <label htmlFor={setsId} style={labelStyle}>
            סטים
          </label>
          <input
            id={setsId}
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            value={formData.defaultSets}
            onChange={(e) =>
              updateField('defaultSets', Number.parseInt(e.target.value) || WORKOUT.DEFAULT_SETS)
            }
            style={{ ...inputStyle, textAlign: 'center' }}
          />
        </div>
        <div>
          <label htmlFor={restTimeId} style={labelStyle}>
            מנוחה (שניות)
          </label>
          <input
            id={restTimeId}
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            value={formData.defaultRestTime}
            onChange={(e) =>
              updateField(
                'defaultRestTime',
                Number.parseInt(e.target.value) || WORKOUT.DEFAULT_REST_TIME
              )
            }
            style={{ ...inputStyle, textAlign: 'center' }}
          />
        </div>
        <div>
          <label htmlFor={tempoId} style={labelStyle}>
            טמפו
          </label>
          <input
            id={tempoId}
            type="text"
            value={formData.tempo}
            onChange={(e) => updateField('tempo', e.target.value)}
            placeholder="3-1-1"
            style={{ ...inputStyle, textAlign: 'center' }}
          />
        </div>
      </div>

      {/* Submit */}
      <button
        type="submit"
        style={{
          width: '100%',
          padding: '14px 20px',
          background: 'var(--fs-primary)',
          color: 'var(--fs-accent)',
          border: 'none',
          borderRadius: 0,
          fontFamily: 'var(--font-display)',
          fontWeight: 800,
          fontSize: 13,
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          cursor: 'pointer',
          minHeight: 48,
        }}
      >
        שמור והוסף
      </button>
    </form>
  );
};

interface AddExerciseButtonProps {
  onClick: () => void;
}

export const AddExerciseButton: React.FC<AddExerciseButtonProps> = ({ onClick }) => (
  <button
    onClick={onClick}
    type="button"
    style={{
      width: '100%',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      padding: '14px 20px',
      background: 'transparent',
      border: '2px dashed var(--color-border-strong)',
      borderRadius: 0,
      cursor: 'pointer',
      fontFamily: 'var(--font-display)',
      fontWeight: 800,
      fontSize: 13,
      letterSpacing: '0.06em',
      textTransform: 'uppercase',
      color: 'var(--fs-muted)',
      transition: 'all 150ms',
    }}
  >
    <div
      style={{
        width: 24,
        height: 24,
        background: 'var(--fs-primary)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
      }}
    >
      <AddIcon className="w-3.5 h-3.5" style={{ color: 'var(--fs-accent)' }} />
    </div>
    צור תרגיל מותאם אישית
  </button>
);

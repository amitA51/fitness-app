// QuickExerciseForm - Fresh Steel / Obsidian
// Sharp corners · Navy border · Bone background
// VISION: Bold · Editorial · Confident · Narrative · Printed

import { X as CloseIcon } from 'lucide-react';
import type React from 'react';
import { memo, useId, useRef, useState } from 'react';
import { useFocusTrap } from '../../hooks/useFocusTrap';
import * as dataService from '../../services/dataService';
import { type CreatePersonalExerciseInput, type Exercise, createWorkoutSet } from '../../types';
import { logger } from '../../utils/logger';

interface QuickExerciseFormProps {
  onAdd: (exercise: Exercise) => void;
  onClose: () => void;
}

const QuickExerciseForm: React.FC<QuickExerciseFormProps> = memo(({ onAdd, onClose }) => {
  const [formData, setFormData] = useState({
    name: '',
    muscleGroup: '',
    targetRestTime: 90,
    defaultSets: 4,
    saveToLibrary: true,
  });
  const [nameError, setNameError] = useState<string | null>(null);
  const nameId = useId();
  const muscleGroupId = useId();
  const restTimeId = useId();
  const setsId = useId();
  // Real focus trap + Esc-to-close + scroll lock (the backdrop comment used to
  // promise Escape, but nothing implemented it; this makes it true and traps Tab).
  const dialogRef = useRef<HTMLDivElement>(null);
  useFocusTrap(dialogRef, { isOpen: true, onClose, closeOnEscape: true, lockScroll: true });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = formData.name.trim();
    if (!trimmedName) {
      setNameError('יש להזין שם לתרגיל');
      return;
    }

    const exercise: Exercise = {
      id: `ex-${Date.now()}`,
      name: trimmedName,
      muscleGroup: formData.muscleGroup || undefined,
      targetRestTime: formData.targetRestTime,
      sets: Array(formData.defaultSets)
        .fill(null)
        .map(() => createWorkoutSet({ reps: 0, weight: 0 })),
    };

    onAdd(exercise);
    onClose();

    if (formData.saveToLibrary) {
      try {
        await dataService.createPersonalExercise({
          name: trimmedName,
          muscleGroup: formData.muscleGroup || undefined,
          defaultRestTime: formData.targetRestTime,
          defaultSets: formData.defaultSets,
          targetMuscle: formData.muscleGroup || '',
          secondaryMuscles: [],
          equipment: '',
          instructions: '',
          videoUrl: null,
          imageUrl: null,
          isCustom: true,
          isTimed: false,
          createdAt: new Date().toISOString(),
          userId: '',
          lastWeight: null,
          lastReps: null,
          personalRecords: [],
        } as unknown as CreatePersonalExerciseInput);
      } catch (error) {
        logger.workout.error('Failed to save exercise to library', error);
      }
    }
  };

  // Stored values stay English (unchanged data shape); only the visible label is
  // Hebrew so the dropdown isn't stray English in the otherwise-RTL form.
  const muscleGroups: { value: string; label: string }[] = [
    { value: 'Chest', label: 'חזה' },
    { value: 'Back', label: 'גב' },
    { value: 'Legs', label: 'רגליים' },
    { value: 'Shoulders', label: 'כתפיים' },
    { value: 'Arms', label: 'ידיים' },
    { value: 'Core', label: 'ליבה' },
    { value: 'Cardio', label: 'אירובי' },
    { value: 'Other', label: 'אחר' },
  ];

  const labelStyle: React.CSSProperties = {
    display: 'block',
    fontFamily: 'var(--font-mono)',
    fontSize: 10,
    letterSpacing: '-0.01em',
    color: 'var(--fs-muted)',
    marginBottom: 6,
    fontWeight: 600,
  };

  const inputStyle: React.CSSProperties = {
    width: '100%',
    background: 'var(--fs-surface)',
    border: '2px solid var(--fs-primary)',
    borderRadius: 12,
    padding: '12px 14px',
    fontFamily: 'var(--font-body)',
    fontSize: 15,
    color: 'var(--fs-ink)',
    outline: 'none',
    direction: 'rtl',
    textAlign: 'right',
  };

  return (
    // biome-ignore lint/a11y/useKeyWithClickEvents: modal backdrop dismiss; keyboard users use Close button or Escape
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(11,26,43,0.6)',
        backdropFilter: 'blur(8px)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'center',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label="תרגיל חדש"
        style={{
          width: '100%',
          maxWidth: 480,
          background: 'var(--fs-surface)',
          borderTop: '2px solid var(--fs-primary)',
          padding: '20px 20px 0',
        }}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 20,
            paddingBottom: 16,
            borderBottom: '2px solid var(--fs-primary)',
          }}
        >
          <h2
            style={{
              fontFamily: 'var(--font-display)',
              fontWeight: 600,
              fontSize: 22,
              color: 'var(--fs-heading)',
              letterSpacing: '-0.01em',
            }}
          >
            תרגיל חדש
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="סגור"
            style={{
              width: 36,
              height: 36,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'var(--fs-surface-2)',
              border: '2px solid var(--fs-primary)',
              borderRadius: 12,
              cursor: 'pointer',
            }}
          >
            <CloseIcon style={{ width: 18, height: 18, color: 'var(--fs-heading)' }} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* Name */}
          <div>
            <label htmlFor={nameId} style={labelStyle}>
              שם התרגיל *
            </label>
            <input
              id={nameId}
              type="text"
              value={formData.name}
              onChange={(e) => {
                setFormData({ ...formData, name: e.target.value });
                if (nameError) setNameError(null);
              }}
              placeholder="לדוגמה: לחיצת חזה"
              style={{
                ...inputStyle,
                borderColor: nameError ? 'var(--fs-warn)' : 'var(--fs-primary)',
              }}
              autoFocus
              required
            />
            {nameError && (
              <p
                style={{
                  fontFamily: 'var(--font-body)',
                  fontSize: 12,
                  color: 'var(--fs-warn)',
                  marginTop: 4,
                }}
              >
                {nameError}
              </p>
            )}
          </div>

          {/* Muscle Group */}
          <div>
            <label htmlFor={muscleGroupId} style={labelStyle}>
              קבוצת שרירים
            </label>
            <select
              id={muscleGroupId}
              value={formData.muscleGroup}
              onChange={(e) => setFormData({ ...formData, muscleGroup: e.target.value })}
              style={{ ...inputStyle, appearance: 'none' }}
            >
              <option value="">בחר (אופציונלי)</option>
              {muscleGroups.map((group) => (
                <option key={group.value} value={group.value}>
                  {group.label}
                </option>
              ))}
            </select>
          </div>

          {/* Sets + Rest */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label htmlFor={restTimeId} style={labelStyle}>
                מנוחה (שניות)
              </label>
              <input
                id={restTimeId}
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                value={formData.targetRestTime}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    targetRestTime: Number.parseInt(e.target.value) || 90,
                  })
                }
                style={{ ...inputStyle, textAlign: 'center' }}
              />
            </div>
            <div>
              <label htmlFor={setsId} style={labelStyle}>
                מספר סטים
              </label>
              <input
                id={setsId}
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                value={formData.defaultSets}
                onChange={(e) =>
                  setFormData({ ...formData, defaultSets: Number.parseInt(e.target.value) || 4 })
                }
                style={{ ...inputStyle, textAlign: 'center' }}
              />
            </div>
          </div>

          {/* Save to Library */}
          <label
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              padding: '12px 14px',
              background: 'var(--fs-surface-2)',
              cursor: 'pointer',
              direction: 'rtl',
            }}
          >
            <input
              type="checkbox"
              checked={formData.saveToLibrary}
              onChange={(e) => setFormData({ ...formData, saveToLibrary: e.target.checked })}
              style={{
                width: 20,
                height: 20,
                accentColor: 'var(--fs-primary)',
              }}
            />
            <span
              style={{
                fontFamily: 'var(--font-body)',
                fontSize: 14,
                color: 'var(--fs-ink)',
              }}
            >
              שמור לרשימה שלי
            </span>
          </label>

          {/* Buttons */}
          <div style={{ display: 'flex', gap: 8, paddingTop: 8, paddingBottom: 20 }}>
            <button
              type="submit"
              disabled={!formData.name.trim()}
              style={{
                flex: 1,
                padding: '14px 20px',
                background: formData.name.trim() ? 'var(--fs-primary)' : 'var(--fs-surface-2)',
                color: formData.name.trim() ? 'var(--fs-accent)' : 'var(--fs-muted)',
                border: '2px solid var(--fs-primary)',
                borderRadius: 12,
                cursor: formData.name.trim() ? 'pointer' : 'not-allowed',
                fontFamily: 'var(--font-display)',
                fontWeight: 600,
                fontSize: 13,
                letterSpacing: '-0.01em',
                minHeight: 48,
              }}
            >
              הוסף תרגיל
            </button>
            <button
              type="button"
              onClick={onClose}
              style={{
                padding: '14px 20px',
                background: 'transparent',
                color: 'var(--fs-muted)',
                border: '2px solid var(--fs-surface-2)',
                borderRadius: 12,
                cursor: 'pointer',
                fontFamily: 'var(--font-display)',
                fontWeight: 600,
                fontSize: 13,
                letterSpacing: '-0.01em',
                minHeight: 48,
              }}
            >
              ביטול
            </button>
          </div>
        </form>

        <div
          style={{ height: 'env(safe-area-inset-bottom, 8px)', background: 'var(--fs-surface)' }}
        />
      </div>
    </div>
  );
});

QuickExerciseForm.displayName = 'QuickExerciseForm';

// Already wrapped in memo() at its definition above — export directly.
export default QuickExerciseForm;

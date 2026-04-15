import React, { useState, memo } from 'react';
import { Exercise, createWorkoutSet } from '../../types';
import * as dataService from '../../services/dataService';
import { CloseIcon } from '../icons';

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate name - prevent empty exercises
    const trimmedName = formData.name.trim();
    if (!trimmedName) {
      setNameError('יש להזין שם לתרגיל');
      return;
    }

    // Create exercise for workout
    const exercise: Exercise = {
      id: `ex-${Date.now()}`,
      name: trimmedName,
      muscleGroup: formData.muscleGroup || undefined,
      targetRestTime: formData.targetRestTime,
      sets: Array(formData.defaultSets)
        .fill(null)
        .map(() => createWorkoutSet({ reps: 0, weight: 0 })),
    };

    // 🎯 OPTIMISTIC: Add exercise and close immediately
    onAdd(exercise);
    onClose();

    // Save to personal library in background if checked
    if (formData.saveToLibrary) {
      try {
        await dataService.createPersonalExercise({
          id: `pe-${Date.now()}`,
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
        } as any);
      } catch (error) {
        console.error('Failed to save exercise to library:', error);
      }
    }
  };

  const muscleGroups = ['Chest', 'Back', 'Legs', 'Shoulders', 'Arms', 'Core', 'Cardio', 'Other'];

  return (
    <div className="aw-modal-overlay open">
      <div className="aw-modal-card">
        {/* Header */}
        <div className="flex justify-between items-center mb-6 border-b border-white/10 pb-4">
          <h2 className="text-xl font-bold text-white">תרגיל חדש</h2>
          <button
            onClick={onClose}
            onPointerDown={(e) => { e.preventDefault(); onClose(); }}
            className="p-2 text-white/60 hover:text-white hover:bg-white/10 rounded-full transition-colors"
          >
            <CloseIcon className="w-6 h-6" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="aw-label">שם התרגיל *</label>
            <input
              type="text"
              value={formData.name}
              onChange={e => {
                setFormData({ ...formData, name: e.target.value });
                if (nameError) setNameError(null);
              }}
              placeholder="לדוגמה: Bench Press"
              required
              autoFocus
              className={`aw-input ${nameError ? 'border-red-500 focus:border-red-500' : ''}`}
            />
            {nameError && (
              <p className="mt-2 text-sm text-red-400 flex items-center gap-1">
                <span>⚠️</span> {nameError}
              </p>
            )}
          </div>

          <div>
            <label className="aw-label">קבוצת שרירים</label>
            <select
              value={formData.muscleGroup}
              onChange={e => setFormData({ ...formData, muscleGroup: e.target.value })}
              className="aw-input appearance-none"
            >
              <option value="">בחר (אופציונלי)</option>
              {muscleGroups.map(group => (
                <option key={group} value={group} className="text-black">
                  {group}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="aw-label">מנוחה (שניות)</label>
              <input
                type="number"
                value={formData.targetRestTime}
                onChange={e =>
                  setFormData({ ...formData, targetRestTime: parseInt(e.target.value) || 90 })
                }
                className="aw-input text-center"
              />
            </div>
            <div>
              <label className="aw-label">מספר סטים</label>
              <input
                type="number"
                value={formData.defaultSets}
                onChange={e =>
                  setFormData({ ...formData, defaultSets: parseInt(e.target.value) || 4 })
                }
                min="1"
                max="10"
                className="aw-input text-center"
              />
            </div>
          </div>

          {/* Save to Library Checkbox */}
          <label className="flex items-center gap-3 p-3 bg-white/5 rounded-xl cursor-pointer hover:bg-white/10 transition-colors border border-white/5">
            <input
              type="checkbox"
              checked={formData.saveToLibrary}
              onChange={e => setFormData({ ...formData, saveToLibrary: e.target.checked })}
              className="w-5 h-5 rounded border-2 border-[var(--aw-accent)] text-[var(--aw-accent)] bg-transparent"
            />
            <span className="text-sm text-white/90 font-medium">שמור לרשימה שלי</span>
          </label>

          {/* Buttons */}
          <div className="flex gap-3 pt-4">
            <button
              type="submit"
              disabled={!formData.name.trim()}
              className={`aw-btn-primary min-h-[48px] ${!formData.name.trim() ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              הוסף תרגיל
            </button>
            <button
              type="button"
              onPointerDown={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onClose();
              }}
              className="aw-btn-secondary min-h-[48px]"
            >
              ביטול
            </button>
          </div>
        </form>
      </div>
    </div>
  );
});

QuickExerciseForm.displayName = 'QuickExerciseForm';

export default React.memo(QuickExerciseForm);

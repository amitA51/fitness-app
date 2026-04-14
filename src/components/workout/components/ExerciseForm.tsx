import React from 'react';
import { SparklesIcon, AddIcon } from '../../icons';
import { PersonalExercise } from '../../../types';
import { WORKOUT, MUSCLE_GROUPS, EXERCISE_CATEGORIES } from '../../../constants';

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
  .map(([_, value]) => value);

const categoryOptions = Object.entries(EXERCISE_CATEGORIES)
  .filter(([key]) => key !== 'ALL')
  .map(([_, value]) => value);

export const ExerciseForm: React.FC<ExerciseFormProps> = ({
  formData,
  onChange,
  onSubmit,
  onCancel,
}) => {
  const updateField = <K extends keyof ExerciseFormData>(
    field: K,
    value: ExerciseFormData[K]
  ) => {
    onChange({ ...formData, [field]: value });
  };

  return (
    <form
      onSubmit={onSubmit}
      className="bg-[var(--bg-secondary)] p-5 rounded-2xl border border-white/10 space-y-4 shadow-2xl relative overflow-hidden"
    >
      <div className="absolute top-0 right-0 w-full h-1 bg-gradient-to-r from-[var(--cosmos-accent-primary)] to-transparent opacity-50" />

      <div className="flex justify-between items-center mb-2">
        <h3 className="text-base font-bold text-white flex items-center gap-2">
          <SparklesIcon className="w-4 h-4 text-[var(--cosmos-accent-primary)]" />
          יצירת תרגיל חדש
        </h3>
        <button
          type="button"
          onClick={onCancel}
          className="text-xs text-white/40 hover:text-white px-2 py-1 bg-white/5 rounded-lg transition-colors"
        >
          ביטול
        </button>
      </div>

      <div className="space-y-4">
        <div>
          <label className="text-[10px] uppercase tracking-wider text-white/40 font-bold mb-1 block">
            שם התרגיל
          </label>
          <input
            type="text"
            value={formData.name}
            onChange={e => updateField('name', e.target.value)}
            placeholder="לדוגמה: לחיצת חזה | Bench Press"
            className="w-full bg-black/30 border border-white/10 rounded-lg py-2 px-3 text-sm text-white focus:border-[var(--cosmos-accent-primary)] outline-none"
            autoFocus
            required
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-[10px] uppercase tracking-wider text-white/40 font-bold mb-1 block">
              שריר ראשי
            </label>
            <select
              value={formData.muscleGroup}
              onChange={e => updateField('muscleGroup', e.target.value)}
              className="w-full bg-black/30 border border-white/10 rounded-lg py-2 px-3 text-sm text-white focus:border-[var(--cosmos-accent-primary)] outline-none appearance-none"
            >
              <option value="">בחר...</option>
              {muscleGroupOptions.map(g => (
                <option key={g} value={g} className="bg-gray-900 text-white">
                  {g}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-[10px] uppercase tracking-wider text-white/40 font-bold mb-1 block">
              קטגוריה
            </label>
            <select
              value={formData.category}
              onChange={e =>
                updateField('category', e.target.value as PersonalExercise['category'] ?? '')
              }
              className="w-full bg-black/30 border border-white/10 rounded-lg py-2 px-3 text-sm text-white focus:border-[var(--cosmos-accent-primary)] outline-none appearance-none"
            >
              <option value="">בחר...</option>
              {categoryOptions.map(c => (
                <option key={c} value={c} className="bg-gray-900 text-white capitalize">
                  {c}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="text-[10px] uppercase tracking-wider text-white/40 font-bold mb-1 block">
              סטים
            </label>
            <input
              type="number"
              value={formData.defaultSets}
              onChange={e =>
                updateField('defaultSets', parseInt(e.target.value) || WORKOUT.DEFAULT_SETS)
              }
              min={WORKOUT.MIN_REPS}
              max={WORKOUT.MAX_SETS}
              className="w-full bg-black/30 border border-white/10 rounded-lg py-2 px-3 text-sm text-center text-white focus:border-[var(--cosmos-accent-primary)] outline-none"
            />
          </div>
          <div>
            <label className="text-[10px] uppercase tracking-wider text-white/40 font-bold mb-1 block">
              מנוחה (שנ׳)
            </label>
            <input
              type="number"
              value={formData.defaultRestTime}
              onChange={e =>
                updateField('defaultRestTime', parseInt(e.target.value) || WORKOUT.DEFAULT_REST_TIME)
              }
              min={0}
              max={WORKOUT.MAX_REST_TIME}
              className="w-full bg-black/30 border border-white/10 rounded-lg py-2 px-3 text-sm text-center text-white focus:border-[var(--cosmos-accent-primary)] outline-none"
            />
          </div>
          <div>
            <label className="text-[10px] uppercase tracking-wider text-white/40 font-bold mb-1 block">
              טמפו
            </label>
            <input
              type="text"
              value={formData.tempo}
              onChange={e => updateField('tempo', e.target.value)}
              placeholder="3-0-1"
              className="w-full bg-black/30 border border-white/10 rounded-lg py-2 px-3 text-sm text-center text-white focus:border-[var(--cosmos-accent-primary)] outline-none"
            />
          </div>
        </div>

        <button
          type="submit"
          className="w-full py-3 bg-[var(--cosmos-accent-primary)] text-black font-bold rounded-xl shadow-lg hover:brightness-110 active:scale-98 transition-all"
        >
          שמור והוסף
        </button>
      </div>
    </form>
  );
};

interface AddExerciseButtonProps {
  onClick: () => void;
}

export const AddExerciseButton: React.FC<AddExerciseButtonProps> = ({ onClick }) => (
  <button
    onClick={onClick}
    className="shrink-0 w-full py-3 mb-4 border border-dashed border-white/20 hover:border-[var(--cosmos-accent-primary)] hover:bg-[var(--cosmos-accent-primary)]/5 rounded-xl text-white/60 hover:text-[var(--cosmos-accent-primary)] transition-all flex items-center justify-center gap-2 font-bold text-sm group"
  >
    <div className="w-6 h-6 rounded-full bg-white/10 group-hover:bg-[var(--cosmos-accent-primary)] group-hover:text-black flex items-center justify-center transition-colors">
      <AddIcon className="w-3.5 h-3.5" />
    </div>
    יצירת תרגיל מותאם אישית
  </button>
);

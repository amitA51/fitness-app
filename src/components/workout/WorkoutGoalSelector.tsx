import type { WorkoutGoal } from '../../types';

interface WorkoutGoalSelectorProps {
  onSelect: (goal: WorkoutGoal) => void;
  onClose: () => void;
}

const GOALS: Array<{ id: WorkoutGoal; label: string; description: string }> = [
  { id: 'strength', label: 'כוח', description: 'משקלים כבדים ומנוחות ארוכות יותר' },
  { id: 'hypertrophy', label: 'היפרטרופיה', description: 'פוקוס על בניית שריר ונפח' },
  { id: 'endurance', label: 'סיבולת', description: 'יותר חזרות וקצב עבודה גבוה' },
  { id: 'maintenance', label: 'שימור', description: 'אימון מאוזן לשמירה על הכושר' },
  { id: 'general', label: 'כללי', description: 'אימון חופשי שמתאים לרוב המשתמשים' },
];

export default function WorkoutGoalSelector({ onSelect, onClose }: WorkoutGoalSelectorProps) {
  return (
    <div className="fixed inset-0 z-[100] bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center p-4">
      <div className="w-full max-w-md rounded-3xl border border-white/10 bg-[var(--color-surface)] p-5 shadow-2xl">
        <div className="flex items-center justify-between gap-3 mb-4">
          <div>
            <h2 className="text-xl font-bold text-white">מה מטרת האימון?</h2>
            <p className="text-sm text-white/60">בחירה מהירה שתתאים את הזרימה הראשונית.</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="min-h-[44px] min-w-[44px] rounded-2xl bg-white/5 text-white"
          >
            סגור
          </button>
        </div>

        <div className="space-y-3">
          {GOALS.map((goal) => (
            <button
              key={goal.id}
              type="button"
              onClick={() => onSelect(goal.id)}
              className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-4 text-right transition hover:bg-white/10"
            >
              <div className="text-base font-semibold text-white">{goal.label}</div>
              <div className="text-sm text-white/60">{goal.description}</div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

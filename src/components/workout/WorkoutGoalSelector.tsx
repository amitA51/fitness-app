import { useEffect } from 'react';
import type { WorkoutGoal } from '../../types';

interface WorkoutGoalSelectorProps {
  onSelect: (goal: WorkoutGoal) => void;
  onClose: () => void;
}

const GOALS: Array<{ id: WorkoutGoal; label: string; description: string }> = [
  { id: 'strength', label: 'כוח', description: 'משקלים כבדים ומנוחות ארוכות יותר' },
  { id: 'hypertrophy', label: 'היפרטרופיה', description: 'פוקוס על בניית שריר ונפח' },
  { id: 'endurance', label: 'סיבולת', description: 'יותר חזרות וקצב עבודה גבוה' },
  { id: 'maintenance', label: 'שימור', description: 'אימון מאוזן לשמירה על הכוח' },
  { id: 'general', label: 'כללי', description: 'אימון חופשי שמתאים לרוב המשתמשים' },
];

export default function WorkoutGoalSelector({ onSelect, onClose }: WorkoutGoalSelectorProps) {
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[100] bg-[rgba(11,26,43,0.6)] backdrop-blur-[8px] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="goal-selector-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-md overflow-hidden" style={{ background: 'var(--fs-surface)', border: '2px solid var(--fs-primary)', boxShadow: '0 4px 12px rgba(22,41,45,0.3)' }}>
        {/* Masthead */}
        <div className="masthead">
          <div className="flex items-start justify-between gap-4">
            <div>
              <span className="kicker">§01 · בחר מטרה</span>
              <h2
                id="goal-selector-title"
                className="mt-2 text-3xl font-black uppercase tracking-tight leading-none"
              >
                מה מטרת האימון?
              </h2>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-5">
          <p className="text-sm mb-5" style={{ fontFamily: 'var(--font-body)', color: 'var(--fs-muted)' }}>
            הבחירה תתאים את הזרימה ותעזור לך לעקוב אחר ההתקדמות.
          </p>

          <div className="space-y-2">
            {GOALS.map((goal, index) => (
              <button
                key={goal.id}
                type="button"
                onClick={() => onSelect(goal.id)}
                aria-label={`${goal.label}: ${goal.description}`}
                className="w-full group text-right transition-all duration-150 ease-out"
                style={{
                  background: 'var(--fs-surface)',
                  border: '2px solid var(--fs-primary)',
                  padding: '16px 20px',
                  minHeight: 56,
                  cursor: 'pointer',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'var(--fs-surface-2)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'var(--fs-surface)';
                }}
              >
                <div className="flex items-center gap-4">
                  {/* Chapter number style index */}
                  <span
                    className="text-2xl font-black leading-none"
                    style={{ fontFamily: 'var(--font-display)', letterSpacing: '-0.02em', color: 'var(--fs-primary)' }}
                  >
                    {String(index + 1).padStart(2, '0')}
                  </span>
                  <div className="flex-1">
                    <div
                      className="text-lg font-bold uppercase"
                      style={{
                        fontFamily: 'var(--font-display)',
                        color: 'var(--fs-ink)',
                        letterSpacing: '0.02em',
                      }}
                    >
                      {goal.label}
                    </div>
                    <div
                      className="text-xs mt-0.5"
                      style={{
                        fontFamily: 'var(--font-mono)',
                        color: 'var(--fs-muted)',
                        letterSpacing: '0.05em',
                      }}
                    >
                      {goal.description}
                    </div>
                  </div>
                  {/* Arrow */}
                  <span className="opacity-0 group-hover:opacity-100 transition-opacity" style={{ color: 'var(--fs-primary)' }}>
                    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                      <path
                        d="M8 4L14 10L8 16"
                        stroke="currentColor"
                        strokeWidth="2.5"
                        strokeLinecap="square"
                      />
                    </svg>
                  </span>
                </div>
              </button>
            ))}
          </div>

          {/* Close button - editorial style */}
          <button
            type="button"
            onClick={onClose}
            className="mt-5 w-full text-center transition-colors duration-150"
            style={{
              background: 'transparent',
              border: 'none',
              padding: '12px',
              cursor: 'pointer',
              fontFamily: 'var(--font-mono)',
              fontSize: '11px',
              fontWeight: 600,
              letterSpacing: '0.18em',
              textTransform: 'uppercase',
              color: 'var(--fs-muted)',
            }}
          >
            סגור
          </button>
        </div>
      </div>
    </div>
  );
}

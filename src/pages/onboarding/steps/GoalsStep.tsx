import { m } from 'framer-motion';
import { Check, Dumbbell, Flame, Target, TrendingUp, Zap } from 'lucide-react';
import { StepHeader } from '../components/ProgressDots';
import type { OnboardingData } from '../types';

interface GoalsStepProps {
  data: OnboardingData;
  onChange: (updates: Partial<OnboardingData>) => void;
}

export function GoalsStep({ data, onChange }: GoalsStepProps) {
  const goals = [
    {
      value: 'strength' as const,
      title: 'בניית כוח',
      description: 'הגדלת הכוח והיכולות הפיזיות',
      icon: <Zap size={24} />,
    },
    {
      value: 'muscle' as const,
      title: 'בניית שריר',
      description: 'הגדלת מסת השריר והנפח',
      icon: <Dumbbell size={24} />,
    },
    {
      value: 'endurance' as const,
      title: 'סיבולת',
      description: 'שיפור הסיבולת והכושר הגופני',
      icon: <TrendingUp size={24} />,
    },
    {
      value: 'weight_loss' as const,
      title: 'ירידה במשקל',
      description: 'הורדת אחוזי השומן בגוף',
      icon: <Flame size={24} />,
    },
    {
      value: 'general' as const,
      title: 'כושר כללי',
      description: 'שמירה על אורח חיים בריא',
      icon: <Target size={24} />,
    },
  ];

  return (
    <m.div
      // RTL-forward: the next step arrives from the inline-start (left) since
      // ChevronLeft is "forward" — enter from negative x, exit to positive x.
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 20 }}
      className="flex flex-col h-full"
    >
      <StepHeader
        title="מה המטרה שלך?"
        subtitle="בחרו את המטרה העיקרית"
        icon={<Target size={24} />}
      />

      <div className="flex-1 px-4 space-y-3 overflow-y-auto pb-4">
        {goals.map((goal) => (
          <m.button
            key={goal.value}
            type="button"
            whileTap={{ scale: 0.98 }}
            onClick={() => onChange({ primaryGoal: goal.value })}
            className={`w-full p-4 transition-all flex items-center gap-4 text-right template-card magnetic-card ${
              data.primaryGoal === goal.value ? 'accent-glow' : ''
            }`}
            style={{
              background:
                data.primaryGoal === goal.value ? 'var(--fs-accent)' : 'var(--fs-surface)',
              border:
                data.primaryGoal === goal.value
                  ? '2px solid var(--fs-accent)'
                  : '1px solid var(--fs-surface-2)',
              borderRadius: '22px 16px 22px 16px',
            }}
          >
            <div
              className="w-12 h-12 flex items-center justify-center shrink-0"
              style={{
                background:
                  data.primaryGoal === goal.value ? 'var(--fs-primary)' : 'var(--fs-surface-2)',
                borderRadius: 0,
              }}
            >
              <span
                style={{
                  color: data.primaryGoal === goal.value ? 'var(--fs-accent)' : 'var(--fs-muted)',
                }}
              >
                {goal.icon}
              </span>
            </div>
            <div className="flex-1">
              <p
                style={{
                  fontFamily: 'var(--font-body)',
                  fontWeight: 600,
                  fontSize: '16px',
                  // Selected card fills with --fs-accent; in dark mode --fs-ink is
                  // near-white and fails AA on mint. Use the on-accent ink token
                  // when selected (matches the description below).
                  color:
                    data.primaryGoal === goal.value
                      ? 'var(--color-ink-on-accent)'
                      : 'var(--fs-ink)',
                }}
              >
                {goal.title}
              </p>
              <p
                style={{
                  fontFamily: 'var(--font-body)',
                  fontSize: '14px',
                  color: data.primaryGoal === goal.value ? 'var(--fs-primary)' : 'var(--fs-muted)',
                  marginTop: '2px',
                }}
              >
                {goal.description}
              </p>
            </div>
            {data.primaryGoal === goal.value && (
              <m.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                className="w-7 h-7 flex items-center justify-center shrink-0"
                style={{
                  background: 'var(--fs-primary)',
                  color: 'var(--fs-accent)',
                  borderRadius: 0,
                }}
              >
                <Check size={16} strokeWidth={3} />
              </m.div>
            )}
          </m.button>
        ))}
      </div>
    </m.div>
  );
}

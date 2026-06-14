import { m } from 'framer-motion';
import { Award, Check, Dumbbell, TrendingUp, User } from 'lucide-react';
import { StepHeader } from '../components/ProgressDots';
import type { OnboardingData } from '../types';

interface ExperienceStepProps {
  data: OnboardingData;
  onChange: (updates: Partial<OnboardingData>) => void;
}

export function ExperienceStep({ data, onChange }: ExperienceStepProps) {
  const levels = [
    {
      value: 'beginner' as const,
      title: 'מתחיל',
      description: 'פחות משנה של אימונים סדירים',
      icon: <User size={24} />,
    },
    {
      value: 'intermediate' as const,
      title: 'בינוני',
      description: '1-3 שנות אימון סדיר',
      icon: <TrendingUp size={24} />,
    },
    {
      value: 'advanced' as const,
      title: 'מתקדם',
      description: 'מעל 3 שנות אימון',
      icon: <Award size={24} />,
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
        title="רמת הניסיון"
        subtitle="זה יעזור לנו להתאים את התוכנית"
        icon={<Dumbbell size={24} />}
      />

      <div className="flex-1 px-4 space-y-4 overflow-y-auto pb-4">
        {levels.map((level) => (
          <m.button
            key={level.value}
            type="button"
            whileTap={{ scale: 0.98 }}
            onClick={() => onChange({ experienceLevel: level.value })}
            className={`w-full p-4 transition-all flex items-center gap-4 text-right template-card magnetic-card ${
              data.experienceLevel === level.value ? 'accent-glow' : ''
            }`}
            style={{
              background:
                data.experienceLevel === level.value ? 'var(--fs-accent)' : 'var(--fs-surface)',
              border:
                data.experienceLevel === level.value
                  ? '2px solid var(--fs-accent)'
                  : '1px solid var(--fs-surface-2)',
              borderRadius: '22px 16px 22px 16px',
            }}
          >
            <div
              className="w-12 h-12 flex items-center justify-center shrink-0"
              style={{
                background:
                  data.experienceLevel === level.value
                    ? 'var(--fs-primary)'
                    : 'var(--fs-surface-2)',
                borderRadius: 0,
              }}
            >
              <span
                style={{
                  color:
                    data.experienceLevel === level.value ? 'var(--fs-accent)' : 'var(--fs-muted)',
                }}
              >
                {level.icon}
              </span>
            </div>
            <div className="flex-1">
              <p
                style={{
                  fontFamily: 'var(--font-body)',
                  fontWeight: 600,
                  fontSize: '16px',
                  color: 'var(--fs-ink)',
                }}
              >
                {level.title}
              </p>
              <p
                style={{
                  fontFamily: 'var(--font-body)',
                  fontSize: '14px',
                  color:
                    data.experienceLevel === level.value ? 'var(--fs-primary)' : 'var(--fs-muted)',
                  marginTop: '2px',
                }}
              >
                {level.description}
              </p>
            </div>
            {data.experienceLevel === level.value && (
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

        {/* Workout Days Selection */}
        <div className="mt-6">
          <span
            className="block mb-4 px-1"
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '11px',
              letterSpacing: '0.18em',
              textTransform: 'uppercase',
              color: 'var(--fs-muted)',
            }}
          >
            ימי אימון בשבוע
          </span>
          <div className="flex gap-2 overflow-x-auto pb-2 -mx-4 px-4 snap-x snap-mandatory">
            {[1, 2, 3, 4, 5, 6, 7].map((day) => (
              <button
                key={day}
                type="button"
                onClick={() => onChange({ preferredWorkoutDays: day })}
                className="min-w-[52px] h-14 snap-center transition-all flex-shrink-0"
                style={{
                  fontFamily: '"Bricolage Grotesque", var(--font-display)',
                  fontWeight: 800,
                  fontSize: '20px',
                  background:
                    data.preferredWorkoutDays === day ? 'var(--fs-accent)' : 'var(--fs-surface)',
                  color:
                    data.preferredWorkoutDays === day ? 'var(--fs-primary)' : 'var(--fs-muted)',
                  border:
                    data.preferredWorkoutDays === day
                      ? '2px solid var(--fs-accent)'
                      : '1px solid var(--fs-surface-2)',
                  borderRadius: 0,
                }}
              >
                {day}
              </button>
            ))}
          </div>
          <p
            className="mt-3 px-1 text-center"
            style={{ fontFamily: 'var(--font-body)', fontSize: '14px', color: 'var(--fs-muted)' }}
          >
            {data.preferredWorkoutDays === 1
              ? 'יום אימון אחד בשבוע'
              : data.preferredWorkoutDays === 7
                ? 'כל יום! (ללא מנוחה)'
                : `${data.preferredWorkoutDays} ימי אימון בשבוע`}
          </p>
        </div>
      </div>
    </m.div>
  );
}

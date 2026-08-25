import { m } from 'framer-motion';
import { Check, Dumbbell, UserCog, Users } from 'lucide-react';
import { StepHeader } from '../components/ProgressDots';
import type { OnboardingData, OnboardingRole } from '../types';

interface RoleStepProps {
  data: OnboardingData;
  onChange: (updates: Partial<OnboardingData>) => void;
  direction?: number;
}

interface RoleOption {
  value: Exclude<OnboardingRole, ''>;
  title: string;
  description: string;
  icon: React.ReactNode;
}

const ROLE_OPTIONS: RoleOption[] = [
  {
    value: 'trainee',
    title: 'מתאמן',
    description: 'בנו תוכניות, עקבו אחר אימונים והתקדמות',
    icon: <Dumbbell size={24} />,
  },
  {
    value: 'coach',
    title: 'מאמן',
    description: 'נהלו מתאמנים, שלחו תוכניות ויעדים ועקבו אחריהם',
    icon: <UserCog size={24} />,
  },
];

export function RoleStep({ data, onChange, direction = 1 }: RoleStepProps) {
  return (
    <m.div
      // RTL-forward: the next step arrives from the inline-start (left) since
      // ChevronLeft is "forward" — enter from negative x, exit to positive x.
      // "back" (direction < 0) reverses it so the previous step slides in from
      // the inline-end instead of the forward side.
      initial={{ opacity: 0, x: direction >= 0 ? -20 : 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: direction >= 0 ? 20 : -20 }}
      className="flex flex-col h-full"
    >
      <StepHeader title="מי אתם?" subtitle="מאמנים או מתאמנים?" icon={<Users size={24} />} />

      <div className="flex-1 px-4 space-y-4 overflow-y-auto pb-4">
        {ROLE_OPTIONS.map((option) => {
          const isSelected = data.role === option.value;
          return (
            <m.button
              key={option.value}
              type="button"
              whileTap={{ scale: 0.98 }}
              onClick={() => onChange({ role: option.value })}
              aria-pressed={isSelected}
              className={`w-full p-4 transition-ui flex items-center gap-4 text-right template-card magnetic-card ${
                isSelected ? 'accent-glow' : ''
              }`}
              style={{
                background: isSelected ? 'var(--fs-accent)' : 'var(--fs-surface)',
                border: isSelected ? '2px solid var(--fs-accent)' : '1px solid var(--fs-surface-2)',
                borderRadius: 'var(--radius-card)',
              }}
            >
              <div
                className="w-12 h-12 flex items-center justify-center shrink-0"
                style={{
                  background: isSelected ? 'var(--fs-primary)' : 'var(--fs-surface-2)',
                  borderRadius: 12,
                }}
              >
                <span style={{ color: isSelected ? 'var(--fs-accent)' : 'var(--fs-muted)' }}>
                  {option.icon}
                </span>
              </div>
              <div className="flex-1">
                <p
                  style={{
                    fontFamily: 'var(--font-body)',
                    fontWeight: 600,
                    fontSize: '16px',
                    // On the mint selected card --fs-ink is near-white in dark
                    // mode and fails AA — use the near-black on-accent ink (the
                    // same token Goals/Equipment already use for selected text).
                    color: isSelected ? 'var(--color-ink-on-accent)' : 'var(--fs-ink)',
                  }}
                >
                  {option.title}
                </p>
                <p
                  style={{
                    fontFamily: 'var(--font-body)',
                    fontSize: '14px',
                    color: isSelected ? 'var(--fs-primary)' : 'var(--fs-muted)',
                    marginTop: '2px',
                  }}
                >
                  {option.description}
                </p>
              </div>
              {isSelected && (
                <m.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  className="w-7 h-7 flex items-center justify-center shrink-0"
                  style={{
                    background: 'var(--fs-primary)',
                    color: 'var(--fs-accent)',
                    borderRadius: 12,
                  }}
                >
                  <Check size={16} strokeWidth={3} />
                </m.div>
              )}
            </m.button>
          );
        })}

        <p
          className="mt-2 px-1 text-center"
          style={{ fontFamily: 'var(--font-body)', fontSize: '13px', color: 'var(--fs-muted)' }}
        >
          אפשר לעבור לחשבון מאמן בהגדרות בהמשך, וגם לחזור לחשבון מתאמן משם
        </p>
      </div>
    </m.div>
  );
}

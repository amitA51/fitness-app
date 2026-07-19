import { m } from 'framer-motion';
import { User } from 'lucide-react';
import { MobileInput } from '../components/MobileInput';
import { StepHeader } from '../components/ProgressDots';
import type { OnboardingData } from '../types';

interface ProfileStepProps {
  data: OnboardingData;
  onChange: (updates: Partial<OnboardingData>) => void;
  direction?: number;
}

export function ProfileStep({ data, onChange, direction = 1 }: ProfileStepProps) {
  // Inline range errors mirror the wizard's advance-gate (useOnboardingWizard),
  // so a bad value shows a message under the offending field instead of passing
  // silently. Only shown once a value has been entered.
  const ageError =
    data.age !== '' && (data.age < 10 || data.age > 100) ? 'גיל לא תקין (10–100)' : undefined;
  const heightError =
    data.height !== '' && (data.height < 100 || data.height > 250)
      ? 'גובה לא תקין (100–250)'
      : undefined;
  const weightError =
    data.weight !== '' && (data.weight < 30 || data.weight > 300)
      ? 'משקל לא תקין (30–300)'
      : undefined;

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
      <StepHeader
        title="קצת עליך"
        subtitle="נזדקק למידע הבסיסי כדי להתאים את המערכת אליך"
        icon={<User size={24} />}
      />

      <div className="flex-1 px-4 space-y-5 overflow-y-auto pb-4">
        <MobileInput
          type="text"
          value={data.name}
          onChange={(val) => onChange({ name: val as string })}
          placeholder="השם שלך"
          label="שם"
        />

        {/* Gender */}
        <div>
          <span
            className="block mb-3 px-1"
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '11px',
              color: 'var(--fs-muted)',
              letterSpacing: '0.18em',
              textTransform: 'uppercase',
            }}
          >
            מגדר
          </span>
          <div className="flex gap-3">
            {(
              [
                { value: 'male', label: 'זכר' },
                { value: 'female', label: 'נקבה' },
                { value: 'other', label: 'אחר' },
              ] as const
            ).map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => onChange({ gender: opt.value })}
                className="flex-1 min-h-[56px] transition-all flex items-center justify-center"
                style={{
                  background: data.gender === opt.value ? 'var(--fs-accent)' : 'var(--fs-surface)',
                  border:
                    data.gender === opt.value
                      ? '2px solid var(--fs-accent)'
                      : '1px solid var(--fs-surface-2)',
                  borderRadius: '22px 16px 22px 16px',
                  // Selected-text-on-accent unified to the on-accent ink token
                  // (was --fs-primary) to match the card selectors across the flow.
                  color:
                    data.gender === opt.value ? 'var(--color-ink-on-accent)' : 'var(--fs-muted)',
                  fontFamily: 'var(--font-body)',
                  fontWeight: data.gender === opt.value ? 700 : 500,
                  fontSize: '16px',
                }}
              >
                <span>{opt.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Age & Height */}
        <div className="grid grid-cols-2 gap-4">
          <MobileInput
            type="number"
            value={data.age}
            onChange={(val) => onChange({ age: val as number })}
            placeholder="—"
            label="גיל"
            unit="שנה"
            min={10}
            max={100}
            error={ageError}
          />
          <MobileInput
            type="number"
            value={data.height}
            onChange={(val) => onChange({ height: val as number })}
            placeholder="—"
            label="גובה"
            unit="ס״מ"
            min={100}
            max={250}
            error={heightError}
          />
        </div>

        {/* Weight */}
        <MobileInput
          type="number"
          value={data.weight}
          onChange={(val) => onChange({ weight: val as number })}
          placeholder="—"
          label="משקל נוכחי"
          unit="ק״ג"
          min={30}
          max={300}
          inputMode="decimal"
          step="0.1"
          error={weightError}
        />
      </div>
    </m.div>
  );
}

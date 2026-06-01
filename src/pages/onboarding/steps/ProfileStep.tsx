import { m } from 'framer-motion';
import { User } from 'lucide-react';
import { MobileInput } from '../components/MobileInput';
import { StepHeader } from '../components/ProgressDots';
import type { OnboardingData } from '../types';

interface ProfileStepProps {
  data: OnboardingData;
  onChange: (updates: Partial<OnboardingData>) => void;
}

export function ProfileStep({ data, onChange }: ProfileStepProps) {
  return (
    <m.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
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
          placeholder="הכנס את שמך"
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
                { value: 'male', label: 'זכר', icon: '' },
                { value: 'female', label: 'נקבה', icon: '' },
                { value: 'other', label: 'אחר', icon: '' },
              ] as const
            ).map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => onChange({ gender: opt.value })}
                className="flex-1 min-h-[56px] transition-all flex flex-col items-center justify-center gap-1"
                style={{
                  background: data.gender === opt.value ? 'var(--fs-accent)' : 'var(--fs-surface)',
                  border:
                    data.gender === opt.value
                      ? '2px solid var(--fs-accent)'
                      : '1px solid var(--fs-surface-2)',
                  borderRadius: '22px 16px 22px 16px',
                  color: data.gender === opt.value ? 'var(--fs-primary)' : 'var(--fs-muted)',
                  fontFamily: 'var(--font-body)',
                  fontWeight: data.gender === opt.value ? 700 : 500,
                  fontSize: '16px',
                }}
              >
                <span className="text-2xl">{opt.icon}</span>
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
        />
      </div>
    </m.div>
  );
}

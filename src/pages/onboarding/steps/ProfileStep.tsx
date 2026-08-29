import { m } from 'framer-motion';
import { User } from 'lucide-react';
import { useId } from 'react';
import { MobileInput } from '../components/MobileInput';
import { StepHeader } from '../components/ProgressDots';
import type { OnboardingData } from '../types';

interface ProfileStepProps {
  data: OnboardingData;
  onChange: (updates: Partial<OnboardingData>) => void;
  direction?: number;
}

const EXPERIENCE_OPTIONS = [
  { value: 'beginner', label: 'מתחיל' },
  { value: 'intermediate', label: 'בינוני' },
  { value: 'advanced', label: 'מנוסה' },
] as const;

export function ProfileStep({ data, onChange, direction = 1 }: ProfileStepProps) {
  // Associates the experience buttons with their heading. They previously sat
  // under a bare <span> with no group association and no aria-pressed, so a
  // screen-reader user heard "מתחיל / בינוני / מנוסה" with no context and no
  // selected state — unlike the goal cards, which already do this correctly.
  const experienceLabelId = useId();

  // Inline range errors mirror the wizard's advance-gate (useOnboardingWizard),
  // so a bad value shows a message under the offending field instead of passing
  // silently. Only shown once a value has been entered.
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
      <StepHeader title="בואו נכיר" subtitle="שני פרטים, ואפשר להתחיל." icon={<User size={24} />} />

      <div className="flex-1 px-4 space-y-5 overflow-y-auto pb-4">
        <MobileInput
          type="text"
          value={data.name}
          onChange={(val) => onChange({ name: val as string })}
          placeholder="איך לקרוא לכם?"
          label="שם"
        />

        {/* Weight — the strongest consumer in the app: every workout save reads
            it for the calorie estimate. Ungated; the estimate accepts null. */}
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
        <p
          className="px-1"
          style={{
            fontFamily: 'var(--font-body)',
            fontSize: 12,
            lineHeight: 1.5,
            color: 'var(--fs-muted)',
            margin: 0,
          }}
        >
          לפי המשקל נחשב את הקלוריות בכל אימון.
        </p>

        {/* Experience level — optional, and never turned into an activity level.
            It feeds the AI's "ניסיון" line only. */}
        <div>
          <h3
            id={experienceLabelId}
            className="block mb-3 px-1"
            style={{
              fontFamily: 'var(--font-body)',
              fontSize: '11px',
              fontWeight: 500,
              letterSpacing: '-0.01em',
              color: 'var(--fs-muted)',
            }}
          >
            רמת ניסיון
          </h3>
          <div className="grid grid-cols-3 gap-2" role="group" aria-labelledby={experienceLabelId}>
            {EXPERIENCE_OPTIONS.map((lvl) => {
              const selected = data.experienceLevel === lvl.value;
              return (
                <button
                  key={lvl.value}
                  type="button"
                  onClick={() => onChange({ experienceLevel: lvl.value })}
                  aria-pressed={selected}
                  className="min-h-[48px] transition-ui flex items-center justify-center focus-ring"
                  style={{
                    fontFamily: 'var(--font-body)',
                    fontWeight: 600,
                    fontSize: 14,
                    background: selected ? 'var(--fs-accent)' : 'var(--fs-surface)',
                    color: selected ? 'var(--color-ink-on-accent)' : 'var(--fs-muted)',
                    border: selected
                      ? '2px solid var(--fs-accent)'
                      : '1px solid var(--fs-surface-2)',
                    borderRadius: 12,
                  }}
                >
                  {lvl.label}
                </button>
              );
            })}
          </div>
          <p
            className="mt-2 px-1"
            style={{
              fontFamily: 'var(--font-body)',
              fontSize: 12,
              color: 'var(--fs-muted)',
              margin: 0,
            }}
          >
            לא חובה — משפיע על ההמלצות בלבד.
          </p>
        </div>

        {/* Health disclaimer at the point of body-data collection (D28). The
            app computes training loads from these numbers; it does not diagnose
            or replace professional guidance. */}
        <p
          style={{
            fontFamily: 'var(--font-body)',
            fontSize: 12,
            lineHeight: 1.5,
            color: 'var(--fs-muted)',
            margin: 0,
            padding: '0 4px',
          }}
        >
          הנתונים משמשים לחישוב עומסי אימון ותזונה — האפליקציה אינה מהווה ייעוץ רפואי. עם מצב רפואי,
          היוועצו ברופא לפני פעילות גופנית.
        </p>
      </div>
    </m.div>
  );
}

import { motion } from 'framer-motion';
import { Dumbbell } from 'lucide-react';
import { MobileToggle } from '../components/MobileToggle';
import { StepHeader } from '../components/ProgressDots';
import type { OnboardingData } from '../types';

interface PreferencesStepProps {
  data: OnboardingData;
  onChange: (updates: Partial<OnboardingData>) => void;
}

export function PreferencesStep({ data, onChange }: PreferencesStepProps) {
  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="flex flex-col h-full"
    >
      <StepHeader
        title="העדפות אימון"
        subtitle="התאם אישית את חווית האימון"
        icon={<Dumbbell size={24} />}
      />

      <div className="flex-1 px-4 space-y-5 overflow-y-auto pb-4">
        {/* Workout Duration Slider */}
        <div
          className="p-4"
          style={{
            background: 'var(--fs-surface)',
            border: '1px solid var(--fs-surface-2)',
            borderRadius: '22px 16px 22px 16px',
          }}
        >
          <div className="flex items-center justify-between mb-3">
            <label
              htmlFor="onboarding-duration"
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '11px',
                letterSpacing: '0.18em',
                textTransform: 'uppercase',
                color: 'var(--fs-muted)',
              }}
            >
              משך אימון
            </label>
            <span
              style={{
                fontFamily: '"Bricolage Grotesque", var(--font-display)',
                fontWeight: 800,
                fontSize: '24px',
                color: 'var(--fs-accent)',
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              {data.workoutDuration} דק׳
            </span>
          </div>
          <input
            id="onboarding-duration"
            type="range"
            min={30}
            max={120}
            step={15}
            value={data.workoutDuration}
            onChange={(e) => onChange({ workoutDuration: Number(e.target.value) })}
            className="w-full h-2 appearance-none cursor-pointer rounded-full"
            style={{ accentColor: 'var(--fs-accent)', background: 'var(--fs-surface-2)' }}
          />
          <div className="flex justify-between mt-2">
            <span
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '10px',
                color: 'var(--fs-muted)',
              }}
            >
              30 דק׳
            </span>
            <span
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '10px',
                color: 'var(--fs-muted)',
              }}
            >
              120 דק׳
            </span>
          </div>
        </div>

        {/* Preferred Time */}
        <div>
          <span
            className="block mb-3 px-1"
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '11px',
              letterSpacing: '0.18em',
              textTransform: 'uppercase',
              color: 'var(--fs-muted)',
            }}
          >
            שעת אימון מועדפת
          </span>
          <div className="flex gap-3">
            {(
              [
                { value: 'morning', label: 'בוקר', icon: '' },
                { value: 'afternoon', label: 'צהריים', icon: '' },
                { value: 'evening', label: 'ערב', icon: '' },
              ] as const
            ).map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => onChange({ preferredTime: opt.value })}
                className="flex-1 min-h-[56px] transition-all flex flex-col items-center justify-center gap-1"
                style={{
                  fontFamily: 'var(--font-body)',
                  fontWeight: data.preferredTime === opt.value ? 700 : 500,
                  fontSize: '14px',
                  background:
                    data.preferredTime === opt.value ? 'var(--fs-accent)' : 'var(--fs-surface)',
                  border:
                    data.preferredTime === opt.value
                      ? '2px solid var(--fs-accent)'
                      : '1px solid var(--fs-surface-2)',
                  borderRadius: '22px 16px 22px 16px',
                  color: data.preferredTime === opt.value ? 'var(--fs-primary)' : 'var(--fs-muted)',
                }}
              >
                <span className="text-2xl">{opt.icon}</span>
                <span>{opt.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Rest Between Sets - FS Stepper Style */}
        <div>
          <div className="flex items-center justify-between mb-3 px-1">
            <span
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '11px',
                letterSpacing: '0.18em',
                textTransform: 'uppercase',
                color: 'var(--fs-muted)',
              }}
            >
              מנוחה בין סטים
            </span>
            <span
              style={{
                fontFamily: '"Bricolage Grotesque", var(--font-display)',
                fontWeight: 800,
                fontSize: '24px',
                color: 'var(--fs-accent)',
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              {data.restBetweenSets} שנ׳
            </span>
          </div>
          <div className="flex gap-2">
            {[60, 90, 120, 180].map((sec) => (
              <button
                key={sec}
                type="button"
                onClick={() => onChange({ restBetweenSets: sec })}
                className="flex-1 min-h-[48px] transition-all"
                style={{
                  fontFamily: 'var(--font-body)',
                  fontWeight: data.restBetweenSets === sec ? 700 : 500,
                  fontSize: '14px',
                  background:
                    data.restBetweenSets === sec ? 'var(--fs-accent)' : 'var(--fs-surface)',
                  color: data.restBetweenSets === sec ? 'var(--fs-primary)' : 'var(--fs-muted)',
                  border:
                    data.restBetweenSets === sec
                      ? '2px solid var(--fs-accent)'
                      : '1px solid var(--fs-surface-2)',
                  borderRadius: 0,
                }}
              >
                {sec}ש
              </button>
            ))}
          </div>
        </div>

        {/* Toggles */}
        <div className="space-y-3 pt-2">
          <MobileToggle
            checked={data.preferCompound}
            onChange={(val) => onChange({ preferCompound: val })}
            label="תרגילים מורכבים"
            description="סקוואט, דדליפט, לחיצת חזה"
          />
          <MobileToggle
            checked={data.includeCardio}
            onChange={(val) => onChange({ includeCardio: val })}
            label="כולל אירובי"
            description="ריצה, אופניים, קרוספיט"
          />
          <MobileToggle
            checked={data.trackNutrition}
            onChange={(val) => onChange({ trackNutrition: val })}
            label="מעקב תזונה"
            description="קלוריות ומאקרואים"
          />
        </div>
      </div>
    </motion.div>
  );
}

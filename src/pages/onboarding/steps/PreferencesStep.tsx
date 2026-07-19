import { m } from 'framer-motion';
import { Dumbbell, Moon, Sun, Sunrise } from 'lucide-react';
import { MobileToggle } from '../components/MobileToggle';
import { StepHeader } from '../components/ProgressDots';
import type { OnboardingData } from '../types';

interface PreferencesStepProps {
  data: OnboardingData;
  onChange: (updates: Partial<OnboardingData>) => void;
  direction?: number;
}

export function PreferencesStep({ data, onChange, direction = 1 }: PreferencesStepProps) {
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
                letterSpacing: '-0.01em',
                color: 'var(--fs-muted)',
              }}
            >
              משך אימון
            </label>
            <span
              style={{
                fontFamily: '"Bricolage Grotesque", var(--font-display)',
                fontWeight: 600,
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
              letterSpacing: '-0.01em',
              color: 'var(--fs-muted)',
            }}
          >
            שעת אימון מועדפת
          </span>
          <div className="flex gap-3">
            {(
              [
                { value: 'morning', label: 'בוקר', icon: Sunrise },
                { value: 'afternoon', label: 'צהריים', icon: Sun },
                { value: 'evening', label: 'ערב', icon: Moon },
              ] as const
            ).map((opt) => {
              const isSelected = data.preferredTime === opt.value;
              const Icon = opt.icon;
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => onChange({ preferredTime: opt.value })}
                  className="flex-1 min-h-[56px] transition-all flex flex-col items-center justify-center gap-1"
                  style={{
                    fontFamily: 'var(--font-body)',
                    fontWeight: isSelected ? 700 : 500,
                    fontSize: '14px',
                    background: isSelected ? 'var(--fs-accent)' : 'var(--fs-surface)',
                    border: isSelected
                      ? '2px solid var(--fs-accent)'
                      : '1px solid var(--fs-surface-2)',
                    borderRadius: '22px 16px 22px 16px',
                    // Unified selected-text-on-accent token across the flow.
                    color: isSelected ? 'var(--color-ink-on-accent)' : 'var(--fs-muted)',
                  }}
                >
                  <Icon size={20} aria-hidden="true" />
                  <span>{opt.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Rest Between Sets - FS Stepper Style */}
        <div>
          <div className="flex items-center justify-between mb-3 px-1">
            <span
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '11px',
                letterSpacing: '-0.01em',
                color: 'var(--fs-muted)',
              }}
            >
              מנוחה בין סטים
            </span>
            <span
              style={{
                fontFamily: '"Bricolage Grotesque", var(--font-display)',
                fontWeight: 600,
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
                  color:
                    data.restBetweenSets === sec ? 'var(--color-ink-on-accent)' : 'var(--fs-muted)',
                  border:
                    data.restBetweenSets === sec
                      ? '2px solid var(--fs-accent)'
                      : '1px solid var(--fs-surface-2)',
                  borderRadius: 12,
                }}
              >
                {sec} שנ׳
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
    </m.div>
  );
}

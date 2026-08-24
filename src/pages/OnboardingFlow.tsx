/**
 * Onboarding Flow - Mobile-optimized multi-step wizard for new users
 * Collects user profile, fitness goals, and preferences
 *
 * Mobile-First Design Principles Applied:
 * - Minimum touch targets: 48px (iOS) / 48dp (Android)
 * - Thumb zone: Primary CTAs at bottom
 * - Safe area handling for notched devices
 * - No horizontal scrolling
 * - Optimized typography for readability
 * - Smooth animations with reduced-motion support
 */

import { AnimatePresence, MotionConfig, m } from 'framer-motion';
import { Check, ChevronLeft, ChevronRight, Dumbbell, Home, MapPin, Sparkles } from 'lucide-react';
// RTL direction note: in Hebrew, "forward/next" points LEFT and "back" points
// RIGHT. Back button uses ChevronRight; the next/finish CTA uses ChevronLeft.
import { type ReactNode, useCallback, useId, useState } from 'react';

import { postOnboardingDestination, setPostOnboardingPath } from '../appOnboarding';
import { Button } from '../components/ui/Button';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { useMotionConfigMode } from '../hooks/useReducedMotion';
import { ProgressDots, StepHeader } from './onboarding/components/ProgressDots';
import { CompleteStep } from './onboarding/steps/CompleteStep';
import { GoalsStep } from './onboarding/steps/GoalsStep';
import { ProfileStep } from './onboarding/steps/ProfileStep';
import { RoleStep } from './onboarding/steps/RoleStep';
import { WelcomeStep } from './onboarding/steps/WelcomeStep';
import type { EquipmentAccess, OnboardingData, OnboardingProps } from './onboarding/types';
import { useOnboardingWizard } from './onboarding/useOnboardingWizard';

// Re-export types for consumers
export type {
  EquipmentAccess,
  OnboardingData,
  OnboardingProps,
  UnitSystem,
} from './onboarding/types';

export default function OnboardingFlow({ onComplete, onSkip }: OnboardingProps) {
  const {
    currentStep,
    stepId,
    activeSteps,
    data,
    direction,
    updateData,
    goNext,
    goBack,
    canProceed,
    validationHint,
  } = useOnboardingWizard(onComplete);
  const [showSkipConfirm, setShowSkipConfirm] = useState(false);
  const hintId = useId();
  // Onboarding mounts its own MotionConfig, so it needs the combined
  // OS + in-app reduced-motion signal explicitly.
  const motionConfigMode = useMotionConfigMode();

  const hint = validationHint();
  const isLastInteractiveStep = currentStep === activeSteps.length - 2;
  const isCompleteStep = stepId === 'complete';

  // Finish from the completion screen. `toFirstAction` pre-seeds the deep-link
  // route so the app mounts straight into the user's highest-intent next step
  // (workout / invite flow); the quiet "go home" path skips that and lands on
  // the default home. Both then run the wizard finish (onComplete → onboardingDone).
  const handleFinish = useCallback(
    (toFirstAction: boolean) => {
      if (toFirstAction) setPostOnboardingPath(postOnboardingDestination(data));
      goNext();
    },
    [data, goNext]
  );

  // Steps render by id — the list itself is role-derived (coaches skip the
  // trainee-only goals/experience/preferences steps).
  const renderStep = () => {
    switch (stepId) {
      case 'welcome':
        return <WelcomeStep onNext={goNext} />;
      case 'role':
        return <RoleStep data={data} onChange={updateData} direction={direction} />;
      case 'profile':
        return <ProfileStep data={data} onChange={updateData} direction={direction} />;
      case 'goals':
        return <GoalsStep data={data} onChange={updateData} direction={direction} />;
      case 'equipment':
        return <EquipmentStep data={data} onChange={updateData} direction={direction} />;
      case 'complete':
        return <CompleteStep data={data} onFinish={handleFinish} />;
      default:
        return null;
    }
  };

  return (
    <MotionConfig reducedMotion={motionConfigMode}>
      <div
        className="fixed inset-0 z-overlay flex flex-col"
        style={{
          background: 'var(--fs-bg)',
        }}
        dir="rtl"
      >
        {/* Progress is shown once — the labeled step dots at the bottom (which
            carry the role=progressbar a11y + a clearer "step N of M" read). A
            redundant top fill-bar used to duplicate the same value here. */}

        {/* Skip Button - safe area aware */}
        {currentStep > 0 && currentStep < activeSteps.length - 1 && (
          <div className="absolute top-0 left-0 right-0 p-4 z-10 pt-[calc(1rem+env(safe-area-inset-top))]">
            <button
              type="button"
              onClick={() => setShowSkipConfirm(true)}
              className="focus-ring"
              style={{
                fontFamily: 'var(--font-body)',
                fontSize: 14,
                fontWeight: 600,
                letterSpacing: '-0.01em',
                color: 'var(--fs-muted)',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                minHeight: '44px',
                minWidth: '44px',
                paddingInline: 8,
              }}
            >
              דלגו
            </button>
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-hidden pt-8">
          <AnimatePresence mode="sync">{renderStep()}</AnimatePresence>
        </div>

        {/* Compact dots at bottom */}
        {currentStep > 0 && currentStep < activeSteps.length - 1 && (
          <ProgressDots currentStep={currentStep - 1} totalSteps={activeSteps.length - 2} />
        )}

        {/* Navigation - thumb zone optimized. Hidden on the completion step,
            which owns its own first-action CTA (no dead-end "next"). */}
        {currentStep > 0 && !isCompleteStep && (
          <div
            className="px-4 pb-4 pt-2"
            style={{ paddingBottom: 'calc(1rem + env(safe-area-inset-bottom))' }}
          >
            {/* Validation hint — explains why "הבא" is disabled. Polite live
                region so screen readers announce the requirement when it changes. */}
            <div aria-live="polite" className="min-h-[20px] mb-2 px-1">
              {currentStep < activeSteps.length - 1 && hint && (
                <m.p
                  id={hintId}
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  style={{
                    fontFamily: 'var(--font-body)',
                    fontSize: 13,
                    letterSpacing: '-0.01em',
                    color: 'var(--fs-muted)',
                    textAlign: 'center',
                    margin: 0,
                  }}
                >
                  {hint}
                </m.p>
              )}
            </div>
            <div className="flex gap-3">
              {currentStep < activeSteps.length - 1 && (
                <Button
                  variant="secondary"
                  onClick={goBack}
                  aria-label="חזרה לשלב הקודם"
                  className="shrink-0 !px-0"
                  style={{
                    width: 64,
                    height: 64,
                    minHeight: 64,
                    borderRadius: 'var(--radius-asymmetric)',
                  }}
                >
                  <ChevronRight size={28} aria-hidden="true" />
                </Button>
              )}
              <Button
                variant="editorial"
                onClick={goNext}
                disabled={!canProceed()}
                aria-describedby={hint ? hintId : undefined}
                fullWidth
                className="flex-1"
                style={{ minHeight: '56px' }}
              >
                {isLastInteractiveStep ? 'סיום' : 'הבא'}
                <ChevronLeft size={24} aria-hidden="true" />
              </Button>
            </div>
          </div>
        )}
      </div>

      <ConfirmDialog
        isOpen={showSkipConfirm}
        variant="warning"
        title="לדלג על ההגדרה?"
        description="בטוחים שתרצו לדלג? אפשר להשלים זאת בהגדרות מאוחר יותר."
        confirmLabel="דלגו"
        cancelLabel="המשך הגדרה"
        onConfirm={() => {
          setShowSkipConfirm(false);
          // Thread the partial wizard data through so whatever the user already
          // typed is preserved (the dialog promises they can finish later).
          onSkip(data);
        }}
        onCancel={() => setShowSkipConfirm(false)}
      />
    </MotionConfig>
  );
}

// ============================================================================
// EquipmentStep — captures OnboardingData.equipment (consumed downstream by the
// intelligence profile in services/intelligence/profile.ts). Mirrors RoleStep's
// 4-card selection pattern. Trainee-only (coaches skip personal steps).
// ============================================================================

interface EquipmentOption {
  value: EquipmentAccess;
  title: string;
  description: string;
  icon: ReactNode;
}

const EQUIPMENT_OPTIONS: EquipmentOption[] = [
  {
    value: 'gym',
    title: 'חדר כושר',
    description: 'גישה מלאה למשקולות, מכונות וכבלים',
    icon: <Dumbbell size={24} />,
  },
  {
    value: 'home_full',
    title: 'בית מאובזר',
    description: 'משקולות, מוט ומתקן ביתי',
    icon: <Home size={24} />,
  },
  {
    value: 'home_minimal',
    title: 'ציוד בסיסי',
    description: 'דאמבלים, גומיות או קטלבל בודד',
    icon: <Sparkles size={24} />,
  },
  {
    value: 'bodyweight',
    title: 'משקל גוף',
    description: 'ללא ציוד — תרגילי משקל גוף בלבד',
    icon: <MapPin size={24} />,
  },
];

function EquipmentStep({
  data,
  onChange,
  direction = 1,
}: {
  data: OnboardingData;
  onChange: (updates: Partial<OnboardingData>) => void;
  direction?: number;
}) {
  return (
    <m.div
      // RTL-forward: in Hebrew the next step arrives from the inline-start (left).
      // Forward (direction >= 0) enters from negative x / exits to positive x;
      // "back" reverses it so the previous step slides in from the inline-end.
      initial={{ opacity: 0, x: direction >= 0 ? -20 : 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: direction >= 0 ? 20 : -20 }}
      className="flex flex-col h-full"
    >
      <StepHeader
        title="האימון שלכם"
        subtitle="ניסיון, ציוד ותדירות — הכל במסך אחד"
        icon={<Dumbbell size={24} />}
      />

      <div className="flex-1 px-4 space-y-4 overflow-y-auto pb-4">
        {/* ── Experience level (merged from ExperienceStep) ── */}
        <div>
          <span
            className="block mb-3 px-1"
            style={{
              fontFamily: 'var(--font-body)',
              fontSize: '11px',
              letterSpacing: '-0.01em',
              color: 'var(--fs-muted)',
            }}
          >
            רמת ניסיון
          </span>
          <div className="grid grid-cols-3 gap-2">
            {(
              [
                { value: 'beginner', label: 'מתחיל' },
                { value: 'intermediate', label: 'בינוני' },
                { value: 'advanced', label: 'מנוסה' },
              ] as const
            ).map((lvl) => {
              const selected = data.experienceLevel === lvl.value;
              return (
                <button
                  key={lvl.value}
                  type="button"
                  onClick={() => onChange({ experienceLevel: lvl.value })}
                  className="min-h-[48px] transition-ui flex items-center justify-center"
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
        </div>

        {/* ── Equipment ── */}
        <div>
          <span
            className="block mb-3 px-1"
            style={{
              fontFamily: 'var(--font-body)',
              fontSize: '11px',
              letterSpacing: '-0.01em',
              color: 'var(--fs-muted)',
            }}
          >
            איפה מתאמנים?
          </span>
          {EQUIPMENT_OPTIONS.map((option) => {
            const isSelected = data.equipment === option.value;
            return (
              <m.button
                key={option.value}
                type="button"
                whileTap={{ scale: 0.98 }}
                onClick={() => onChange({ equipment: option.value })}
                aria-pressed={isSelected}
                className={`w-full p-4 transition-ui flex items-center gap-4 text-right template-card magnetic-card ${
                  isSelected ? 'accent-glow' : ''
                }`}
                style={{
                  background: isSelected ? 'var(--fs-accent)' : 'var(--fs-surface)',
                  border: isSelected
                    ? '1px solid color-mix(in srgb, var(--fs-accent) 50%, transparent)'
                    : '1px solid color-mix(in srgb, var(--color-border) 90%, transparent)',
                  borderRadius: 'var(--radius-2xl)',
                  boxShadow: isSelected
                    ? '0 8px 24px color-mix(in srgb, var(--fs-accent) 22%, transparent)'
                    : 'var(--elevation-1)',
                }}
              >
                <div
                  className="w-12 h-12 flex items-center justify-center shrink-0"
                  style={{
                    background: isSelected
                      ? 'color-mix(in srgb, var(--color-ink-on-accent) 12%, transparent)'
                      : 'var(--fs-surface-2)',
                    borderRadius: 9999,
                  }}
                >
                  <span
                    style={{ color: isSelected ? 'var(--color-ink-on-accent)' : 'var(--fs-muted)' }}
                  >
                    {option.icon}
                  </span>
                </div>
                <div className="flex-1">
                  <p
                    style={{
                      fontFamily: 'var(--font-body)',
                      fontWeight: 600,
                      fontSize: '16px',
                      letterSpacing: '-0.01em',
                      color: isSelected ? 'var(--color-ink-on-accent)' : 'var(--fs-ink)',
                    }}
                  >
                    {option.title}
                  </p>
                  <p
                    style={{
                      fontFamily: 'var(--font-body)',
                      fontSize: '14px',
                      letterSpacing: '-0.01em',
                      color: isSelected
                        ? 'color-mix(in srgb, var(--color-ink-on-accent) 78%, transparent)'
                        : 'var(--fs-muted)',
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
                      borderRadius: 9999,
                    }}
                  >
                    <Check size={16} strokeWidth={3} />
                  </m.div>
                )}
              </m.button>
            );
          })}
        </div>

        {/* ── Weekly training days (from ExperienceStep) ── */}
        <div className="mt-2">
          <span
            className="block mb-4 px-1"
            style={{
              fontFamily: 'var(--font-body)',
              fontSize: '11px',
              letterSpacing: '-0.01em',
              color: 'var(--fs-muted)',
            }}
          >
            כמה ימי אימון בשבוע?
          </span>
          <div className="flex gap-2 overflow-x-auto pb-2 -mx-4 px-4 snap-x snap-mandatory">
            {[1, 2, 3, 4, 5, 6, 7].map((day) => (
              <button
                key={day}
                type="button"
                onClick={() => onChange({ preferredWorkoutDays: day })}
                className="min-w-[52px] h-14 snap-center transition-ui flex-shrink-0"
                style={{
                  fontFamily: '"Bricolage Grotesque", var(--font-display)',
                  fontWeight: 600,
                  fontSize: '20px',
                  background:
                    data.preferredWorkoutDays === day ? 'var(--fs-accent)' : 'var(--fs-surface)',
                  color:
                    data.preferredWorkoutDays === day
                      ? 'var(--color-ink-on-accent)'
                      : 'var(--fs-muted)',
                  border:
                    data.preferredWorkoutDays === day
                      ? '2px solid var(--fs-accent)'
                      : '1px solid var(--fs-surface-2)',
                  borderRadius: 12,
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

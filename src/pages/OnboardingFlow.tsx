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
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useId, useState } from 'react';

import { Button } from '../components/ui/Button';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { ProgressDots } from './onboarding/components/ProgressDots';
import { CompleteStep } from './onboarding/steps/CompleteStep';
import { ExperienceStep } from './onboarding/steps/ExperienceStep';
import { GoalsStep } from './onboarding/steps/GoalsStep';
import { PreferencesStep } from './onboarding/steps/PreferencesStep';
import { ProfileStep } from './onboarding/steps/ProfileStep';
import { RoleStep } from './onboarding/steps/RoleStep';
import { WelcomeStep } from './onboarding/steps/WelcomeStep';
import { type OnboardingProps, STEPS } from './onboarding/types';
import { useOnboardingWizard } from './onboarding/useOnboardingWizard';

// Re-export types for consumers
export type {
  EquipmentAccess,
  OnboardingData,
  OnboardingProps,
  UnitSystem,
} from './onboarding/types';

export default function OnboardingFlow({ onComplete, onSkip }: OnboardingProps) {
  const { currentStep, data, updateData, goNext, goBack, canProceed, validationHint } =
    useOnboardingWizard(onComplete);
  const [showSkipConfirm, setShowSkipConfirm] = useState(false);
  const hintId = useId();

  const hint = validationHint();
  const isLastInteractiveStep = currentStep === STEPS.length - 2;

  const renderStep = () => {
    switch (currentStep) {
      case 0:
        return <WelcomeStep onNext={goNext} />;
      case 1:
        return <RoleStep data={data} onChange={updateData} />;
      case 2:
        return <ProfileStep data={data} onChange={updateData} />;
      case 3:
        return <GoalsStep data={data} onChange={updateData} />;
      case 4:
        return <ExperienceStep data={data} onChange={updateData} />;
      case 5:
        return <PreferencesStep data={data} onChange={updateData} />;
      case 6:
        return <CompleteStep data={data} />;
      default:
        return null;
    }
  };

  return (
    <MotionConfig reducedMotion="user">
      <div
        className="fixed inset-0 z-overlay flex flex-col ambient-mesh ambient-mesh-soft"
        style={{
          background: 'var(--fs-bg)',
          backgroundImage:
            'linear-gradient(rgba(19,35,39,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(19,35,39,0.03) 1px, transparent 1px)',
          backgroundSize: '24px 24px',
        }}
        dir="rtl"
      >
        {/* Progress bar at top — premium track */}
        {currentStep > 0 && currentStep < STEPS.length - 1 && (
          <div className="w-full fs-progress-track" style={{ height: '4px' }}>
            <m.div
              className="h-full fs-progress-fill"
              initial={{ width: 0 }}
              animate={{
                width: `${((currentStep - 1) / (STEPS.length - 2)) * 100}%`,
              }}
              transition={{ duration: 0.3, ease: 'easeInOut' }}
            />
          </div>
        )}

        {/* Skip Button - safe area aware */}
        {currentStep > 0 && currentStep < STEPS.length - 1 && (
          <div className="absolute top-0 left-0 right-0 p-4 z-10 pt-[calc(1rem+env(safe-area-inset-top))]">
            <button
              type="button"
              onClick={() => setShowSkipConfirm(true)}
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '12px',
                letterSpacing: '0.12em',
                textTransform: 'uppercase',
                color: 'var(--fs-muted)',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                minHeight: '44px',
                minWidth: '44px',
              }}
            >
              דלג
            </button>
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-hidden pt-8">
          <AnimatePresence mode="sync">{renderStep()}</AnimatePresence>
        </div>

        {/* Compact dots at bottom */}
        {currentStep > 0 && currentStep < STEPS.length - 1 && (
          <ProgressDots currentStep={currentStep - 1} totalSteps={STEPS.length - 2} />
        )}

        {/* Navigation - thumb zone optimized */}
        {currentStep > 0 && (
          <div
            className="px-4 pb-4 pt-2"
            style={{ paddingBottom: 'calc(1rem + env(safe-area-inset-bottom))' }}
          >
            {/* Validation hint — explains why "הבא" is disabled. Polite live
                region so screen readers announce the requirement when it changes. */}
            <div aria-live="polite" className="min-h-[20px] mb-2 px-1">
              {currentStep < STEPS.length - 1 && hint && (
                <m.p
                  id={hintId}
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: '11px',
                    letterSpacing: '0.08em',
                    color: 'var(--fs-muted)',
                    textAlign: 'center',
                  }}
                >
                  {hint}
                </m.p>
              )}
            </div>
            <div className="flex gap-3">
              {currentStep < STEPS.length - 1 && (
                <Button
                  variant="secondary"
                  onClick={goBack}
                  aria-label="חזרה לשלב הקודם"
                  className="shrink-0 !px-0"
                  style={{
                    width: 64,
                    height: 64,
                    minHeight: 64,
                    borderRadius: '22px 16px 22px 16px',
                  }}
                >
                  <ChevronLeft size={28} aria-hidden="true" />
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
                <ChevronRight size={24} aria-hidden="true" />
              </Button>
            </div>
          </div>
        )}
      </div>

      <ConfirmDialog
        isOpen={showSkipConfirm}
        variant="warning"
        title="לדלג על ההגדרה?"
        description="בטוח שברצונך לדלג? תוכל להשלים זאת בהגדרות מאוחר יותר."
        confirmLabel="דלג"
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

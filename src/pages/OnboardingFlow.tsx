/**
 * Onboarding Flow - Mobile-optimized multi-step wizard for new users
 *
 * Three screens: a welcome that collects nothing, one screen that asks for a
 * name plus an optional bodyweight and experience level, and the goal picker,
 * which finishes the wizard on a single tap.
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
// RTL direction note: in Hebrew, "forward/next" points LEFT and "back" points
// RIGHT. Back button uses ChevronRight; the next/finish CTA uses ChevronLeft.
import { useId, useState } from 'react';

import { postOnboardingDestination, setPostOnboardingPath } from '../appOnboarding';
import { Button } from '../components/ui/Button';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { useMotionConfigMode } from '../hooks/useReducedMotion';
import { ProgressDots } from './onboarding/components/ProgressDots';
import { GoalsStep } from './onboarding/steps/GoalsStep';
import { ProfileStep } from './onboarding/steps/ProfileStep';
import { WelcomeStep } from './onboarding/steps/WelcomeStep';
import type { OnboardingData, OnboardingProps } from './onboarding/types';
import { useOnboardingWizard } from './onboarding/useOnboardingWizard';

// Re-export types for consumers
export type { OnboardingData, OnboardingProps } from './onboarding/types';

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
  // Goals answers and advances on a single card tap, so it shows a back chevron
  // but no forward CTA. Every other collecting step gets the normal nav row.
  const autoAdvances = stepId === 'goals';
  const isCollectingStep = currentStep > 0;

  // The goal tap is the end of the wizard. Pre-seed the landing route exactly as
  // the removed completion screen's primary CTA did (it resolved to the constant
  // '/', the home FirstRunHero) so finishing behaviour is unchanged.
  const handleGoalSelected = (primaryGoal: OnboardingData['primaryGoal']) => {
    setPostOnboardingPath(postOnboardingDestination({ ...data, primaryGoal }));
    goNext({ primaryGoal });
  };

  // Steps render by id — one flat list, identical for every user.
  const renderStep = () => {
    switch (stepId) {
      case 'welcome':
        return <WelcomeStep onNext={goNext} />;
      case 'profile':
        return <ProfileStep data={data} onChange={updateData} direction={direction} />;
      case 'goals':
        return <GoalsStep data={data} onSelect={handleGoalSelected} direction={direction} />;
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
        {isCollectingStep && (
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

        {/* Compact dots at bottom — welcome collects nothing, so it is excluded
            from both the numerator and the denominator. */}
        {isCollectingStep && (
          <ProgressDots currentStep={currentStep - 1} totalSteps={activeSteps.length - 1} />
        )}

        {/* Navigation - thumb zone optimized. */}
        {isCollectingStep && (
          <div
            className="px-4 pb-4 pt-2"
            style={{ paddingBottom: 'calc(1rem + env(safe-area-inset-bottom))' }}
          >
            {/* Validation hint — explains why "הבא" is disabled. Polite live
                region so screen readers announce the requirement when it changes. */}
            <div aria-live="polite" className="min-h-[20px] mb-2 px-1">
              {hint && (
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
              <Button
                variant="secondary"
                onClick={goBack}
                aria-label="חזרה לשלב הקודם"
                className={autoAdvances ? '!px-0' : 'shrink-0 !px-0'}
                style={{
                  width: 64,
                  height: 64,
                  minHeight: 64,
                  borderRadius: 'var(--radius-asymmetric)',
                }}
              >
                <ChevronRight size={28} aria-hidden="true" />
              </Button>
              {!autoAdvances && (
                <Button
                  variant="editorial"
                  onClick={() => goNext()}
                  disabled={!canProceed()}
                  aria-describedby={hint ? hintId : undefined}
                  fullWidth
                  className="flex-1"
                  style={{ minHeight: '56px' }}
                >
                  הבא
                  <ChevronLeft size={24} aria-hidden="true" />
                </Button>
              )}
            </div>
          </div>
        )}
      </div>

      <ConfirmDialog
        isOpen={showSkipConfirm}
        variant="warning"
        title="לדלג בינתיים?"
        description='אפשר להשלים את הפרטים בכל רגע בהגדרות, במקטע "פרטים אישיים".'
        confirmLabel="דלגו"
        cancelLabel="נמשיך"
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

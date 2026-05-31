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

import { AnimatePresence, MotionConfig, motion } from 'framer-motion';
import { ChevronLeft, ChevronRight } from 'lucide-react';

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
  const { currentStep, data, updateData, goNext, goBack, canProceed } =
    useOnboardingWizard(onComplete);

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
            <motion.div
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
              onClick={onSkip}
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
            <div className="flex gap-3">
              {currentStep < STEPS.length - 1 && (
                <button
                  type="button"
                  onClick={goBack}
                  className="w-16 h-16 flex items-center justify-center active:scale-95 transition-transform focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--fs-accent)]"
                  style={{
                    background: 'var(--fs-surface)',
                    border: '1px solid var(--fs-surface-2)',
                    borderRadius: '22px 16px 22px 16px',
                  }}
                >
                  <ChevronLeft size={28} style={{ color: 'var(--fs-ink)' }} />
                </button>
              )}
              <button
                type="button"
                onClick={goNext}
                disabled={!canProceed()}
                className={`flex-1 flex items-center justify-center gap-3 transition-all active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed disabled:active:scale-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--fs-accent)] ${
                  canProceed() ? 'start-workout-btn accent-glow' : ''
                }`}
                style={{
                  background: canProceed() ? 'var(--fs-primary)' : 'var(--fs-surface-2)',
                  color: canProceed() ? 'var(--fs-accent)' : 'var(--fs-muted)',
                  borderRadius: '22px 16px 22px 16px',
                  minHeight: '56px',
                  fontFamily: 'var(--font-display)',
                  fontWeight: 800,
                  textTransform: 'uppercase',
                  border: 'none',
                }}
              >
                {currentStep === STEPS.length - 2 ? 'סיום' : 'הבא'}
                <ChevronRight size={24} />
              </button>
            </div>
          </div>
        )}
      </div>
    </MotionConfig>
  );
}

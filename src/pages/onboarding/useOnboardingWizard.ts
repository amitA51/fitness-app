import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  DEFAULT_ONBOARDING,
  type OnboardingData,
  type OnboardingStep,
  stepsForRole,
} from './types';

export function useOnboardingWizard(onComplete: (data: OnboardingData) => void) {
  const [currentStep, setCurrentStep] = useState(() => {
    try {
      const saved = sessionStorage.getItem('onboarding_step');
      return saved ? Number(saved) || 0 : 0;
    } catch {
      return 0;
    }
  });
  // Nav direction for the step transition: +1 = forward (next), -1 = back.
  // Steps read this so a "back" tap reverses the slide instead of always
  // sliding in from the forward (inline-start) side.
  const [direction, setDirection] = useState(1);
  const [data, setData] = useState<OnboardingData>(() => {
    try {
      const saved = sessionStorage.getItem('onboarding_draft');
      return saved ? { ...DEFAULT_ONBOARDING, ...JSON.parse(saved) } : DEFAULT_ONBOARDING;
    } catch {
      return DEFAULT_ONBOARDING;
    }
  });

  // The step list is role-derived: coaches skip the trainee-only steps
  // (goals/experience/preferences). All indexing below runs against this list.
  const activeSteps: OnboardingStep[] = useMemo(() => stepsForRole(data.role), [data.role]);

  // Switching role at the role step shrinks/grows the list; clamp a persisted
  // index so it can never point past the end of the new list.
  const safeStep = Math.min(currentStep, activeSteps.length - 1);
  const stepId = activeSteps[safeStep]?.id ?? 'welcome';

  useEffect(() => {
    try {
      sessionStorage.setItem('onboarding_step', String(currentStep));
      sessionStorage.setItem('onboarding_draft', JSON.stringify(data));
    } catch {
      /* ignore */
    }
  }, [currentStep, data]);

  const updateData = useCallback((updates: Partial<OnboardingData>) => {
    setData((prev) => ({ ...prev, ...updates }));
  }, []);

  const goNext = useCallback(() => {
    setDirection(1);
    if (safeStep < activeSteps.length - 1) {
      setCurrentStep(safeStep + 1);
    } else {
      onComplete(data);
    }
  }, [safeStep, activeSteps.length, data, onComplete]);

  const goBack = useCallback(() => {
    setDirection(-1);
    if (safeStep > 0) {
      setCurrentStep(safeStep - 1);
    }
  }, [safeStep]);

  // Per-step reason the user cannot advance yet — null when the step is valid.
  // Surfaced near the disabled "הבא" button so the block is explained, not silent.
  // Keyed by step id (not index) so the role-derived list stays correct.
  const validationHint = useCallback((): string | null => {
    switch (stepId) {
      case 'role':
        return data.role === undefined || data.role === '' ? 'בחרו תפקיד כדי להמשיך' : null;
      case 'profile':
        if (data.name.trim().length === 0) return 'הזינו את שמכם כדי להמשיך';
        if (data.gender === '') return 'בחרו מגדר כדי להמשיך';
        if (data.age === '') return 'הזינו את גילכם כדי להמשיך';
        // Range gates: min/max on the inputs were decorative, so age 5 or weight
        // 999 passed silently and poisoned every downstream AI/program calc.
        // Height & weight stay optional but, when entered, must be sane.
        if (data.age < 10 || data.age > 100) return 'הזינו גיל בין 10 ל-100';
        if (data.height !== '' && (data.height < 100 || data.height > 250))
          return 'הזינו גובה בין 100 ל-250 ס״מ';
        if (data.weight !== '' && (data.weight < 30 || data.weight > 300))
          return 'הזינו משקל בין 30 ל-300 ק״ג';
        return null;
      case 'goals':
        return data.primaryGoal === '' ? 'בחרו מטרה עיקרית כדי להמשיך' : null;
      case 'experience':
        return data.experienceLevel === '' ? 'בחרו רמת ניסיון כדי להמשיך' : null;
      case 'equipment':
        return data.equipment === undefined || data.equipment === ''
          ? 'בחרו את הציוד הזמין כדי להמשיך'
          : null;
      default:
        return null;
    }
  }, [stepId, data]);

  const canProceed = useCallback(() => validationHint() === null, [validationHint]);

  return {
    currentStep: safeStep,
    stepId,
    activeSteps,
    data,
    direction,
    updateData,
    goNext,
    goBack,
    canProceed,
    validationHint,
  };
}

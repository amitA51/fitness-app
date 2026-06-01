import { useCallback, useEffect, useState } from 'react';
import { DEFAULT_ONBOARDING, type OnboardingData, STEPS } from './types';

export function useOnboardingWizard(onComplete: (data: OnboardingData) => void) {
  const [currentStep, setCurrentStep] = useState(() => {
    try {
      const saved = sessionStorage.getItem('onboarding_step');
      return saved ? Number(saved) || 0 : 0;
    } catch {
      return 0;
    }
  });
  const [data, setData] = useState<OnboardingData>(() => {
    try {
      const saved = sessionStorage.getItem('onboarding_draft');
      return saved ? { ...DEFAULT_ONBOARDING, ...JSON.parse(saved) } : DEFAULT_ONBOARDING;
    } catch {
      return DEFAULT_ONBOARDING;
    }
  });

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
    if (currentStep < STEPS.length - 1) {
      setCurrentStep((prev) => prev + 1);
    } else {
      onComplete(data);
    }
  }, [currentStep, data, onComplete]);

  const goBack = useCallback(() => {
    if (currentStep > 0) {
      setCurrentStep((prev) => prev - 1);
    }
  }, [currentStep]);

  // Per-step reason the user cannot advance yet — null when the step is valid.
  // Surfaced near the disabled "הבא" button so the block is explained, not silent.
  const validationHint = useCallback((): string | null => {
    switch (currentStep) {
      case 1:
        return data.role === undefined || data.role === '' ? 'בחר תפקיד כדי להמשיך' : null;
      case 2:
        if (data.name.trim().length === 0) return 'הזן את שמך כדי להמשיך';
        if (data.gender === '') return 'בחר מגדר כדי להמשיך';
        if (data.age === '') return 'הזן את גילך כדי להמשיך';
        return null;
      case 3:
        return data.primaryGoal === '' ? 'בחר מטרה עיקרית כדי להמשיך' : null;
      case 4:
        return data.experienceLevel === '' ? 'בחר רמת ניסיון כדי להמשיך' : null;
      case 5:
        return data.preferredTime === '' ? 'בחר שעת אימון מועדפת כדי להמשיך' : null;
      default:
        return null;
    }
  }, [currentStep, data]);

  const canProceed = useCallback(() => validationHint() === null, [validationHint]);

  return { currentStep, data, updateData, goNext, goBack, canProceed, validationHint };
}

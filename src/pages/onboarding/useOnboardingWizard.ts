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

  const canProceed = useCallback(() => {
    switch (currentStep) {
      case 1:
        return data.role !== undefined && data.role !== '';
      case 2:
        return data.name.trim().length > 0 && data.gender !== '' && data.age !== '';
      case 3:
        return data.primaryGoal !== '';
      case 4:
        return data.experienceLevel !== '';
      case 5:
        return data.preferredTime !== '';
      default:
        return true;
    }
  }, [currentStep, data]);

  return { currentStep, data, updateData, goNext, goBack, canProceed };
}

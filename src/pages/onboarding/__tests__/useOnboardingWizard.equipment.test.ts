import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_ONBOARDING, stepsForRole } from '../types';
import { useOnboardingWizard } from '../useOnboardingWizard';

// Covers the equipment-step validation gate added when the orphaned
// OnboardingData.equipment field was wired into a real selection step.

// The equipment step index in the full trainee flow.
const EQUIPMENT_INDEX = stepsForRole('trainee').findIndex((s) => s.id === 'equipment');

function seedAtEquipmentStep(equipment: '' | 'gym'): void {
  sessionStorage.setItem('onboarding_step', String(EQUIPMENT_INDEX));
  sessionStorage.setItem(
    'onboarding_draft',
    JSON.stringify({ ...DEFAULT_ONBOARDING, role: 'trainee', equipment })
  );
}

describe('useOnboardingWizard — equipment gate', () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  it('lands on the equipment step from a seeded draft', () => {
    seedAtEquipmentStep('');
    const { result } = renderHook(() => useOnboardingWizard(vi.fn()));
    expect(result.current.stepId).toBe('equipment');
  });

  it('blocks advancing until equipment is chosen', () => {
    seedAtEquipmentStep('');
    const { result } = renderHook(() => useOnboardingWizard(vi.fn()));
    expect(result.current.canProceed()).toBe(false);
    expect(result.current.validationHint()).toBe('בחר את הציוד הזמין כדי להמשיך');
  });

  it('clears the gate once a value is selected', () => {
    seedAtEquipmentStep('');
    const { result } = renderHook(() => useOnboardingWizard(vi.fn()));
    act(() => result.current.updateData({ equipment: 'gym' }));
    expect(result.current.canProceed()).toBe(true);
    expect(result.current.validationHint()).toBeNull();
  });
});

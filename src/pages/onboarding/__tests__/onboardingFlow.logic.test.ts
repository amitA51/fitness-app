import { describe, expect, it } from 'vitest';
import { postOnboardingDestination } from '../../../appOnboarding';
import type { OnboardingData } from '../types';
import { DEFAULT_ONBOARDING, STEPS } from '../types';

// These cover the onboarding logic touched by the "first-action CTA" and the
// "equipment step" tasks: where a finished wizard should deep-link, and the one
// flat step list every user sees (there is no role branch — coach status is
// server-assigned).

const base = (overrides: Partial<OnboardingData>): OnboardingData => ({
  ...DEFAULT_ONBOARDING,
  ...overrides,
});

describe('postOnboardingDestination', () => {
  it('always lands on home FirstRunHero (guided next step)', () => {
    expect(postOnboardingDestination(base({}))).toBe('/');
    expect(postOnboardingDestination(base({ role: 'trainee' }))).toBe('/');
    expect(postOnboardingDestination(base({ role: '' }))).toBe('/');
    expect(postOnboardingDestination(base({ role: undefined }))).toBe('/');
  });
});

describe('STEPS — equipment step', () => {
  it('includes the equipment step as the last interactive step', () => {
    const ids = STEPS.map((s) => s.id);
    expect(ids).toContain('equipment');
    // ordered after goals, last interactive step before complete
    expect(ids.indexOf('equipment')).toBeGreaterThan(ids.indexOf('goals'));
    expect(ids[ids.length - 2]).toBe('equipment');
  });

  it('offers no role step — nobody can pick coach here', () => {
    expect(STEPS.map((s) => s.id)).toEqual([
      'welcome',
      'profile',
      'goals',
      'equipment',
      'complete',
    ]);
  });
});

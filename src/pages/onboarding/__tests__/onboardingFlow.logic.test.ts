import { describe, expect, it } from 'vitest';
import { postOnboardingDestination } from '../../../appOnboarding';
import type { OnboardingData } from '../types';
import { DEFAULT_ONBOARDING, STEPS } from '../types';

// These cover the onboarding logic touched by the "first-action CTA" and the
// flow-shortening task: where a finished wizard should deep-link, and the one
// flat step list every user sees (there is no role branch — coach status is
// server-assigned).

const base = (overrides: Partial<OnboardingData>): OnboardingData => ({
  ...DEFAULT_ONBOARDING,
  ...overrides,
});

describe('postOnboardingDestination', () => {
  it('always lands on home FirstRunHero (guided next step)', () => {
    expect(postOnboardingDestination(base({}))).toBe('/');
    expect(postOnboardingDestination(base({ primaryGoal: 'strength' }))).toBe('/');
    expect(postOnboardingDestination(base({ primaryGoal: '' }))).toBe('/');
  });
});

describe('STEPS', () => {
  it('is three steps: a welcome that collects nothing, then two questions', () => {
    expect(STEPS.map((s) => s.id)).toEqual(['welcome', 'profile', 'goals']);
  });

  it('ends on goals, which finishes the wizard on a single card tap', () => {
    const ids = STEPS.map((s) => s.id);
    expect(ids[ids.length - 1]).toBe('goals');
  });

  it('offers no equipment step — nothing in the app filters on the answer', () => {
    expect(STEPS.map((s) => s.id)).not.toContain('equipment');
  });

  it('offers no completion recap step — it displayed values nobody chose', () => {
    expect(STEPS.map((s) => s.id)).not.toContain('complete');
  });

  it('offers no role step — nobody can pick coach here', () => {
    expect(STEPS.map((s) => s.id)).not.toContain('role');
  });
});

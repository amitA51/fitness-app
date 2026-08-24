import { describe, expect, it } from 'vitest';
import { postOnboardingDestination } from '../../../appOnboarding';
import type { OnboardingData } from '../types';
import { DEFAULT_ONBOARDING, STEPS, stepsForRole } from '../types';

// These cover the onboarding logic touched by the "first-action CTA" and the
// "equipment step" tasks: where a finished wizard should deep-link, and which
// steps each role actually sees.

const base = (overrides: Partial<OnboardingData>): OnboardingData => ({
  ...DEFAULT_ONBOARDING,
  ...overrides,
});

describe('postOnboardingDestination', () => {
  it('routes a coach to the invite flow (their first real action)', () => {
    expect(postOnboardingDestination(base({ role: 'coach' }))).toBe('/coach/invites');
  });

  it('routes a trainee to home FirstRunHero (guided next step)', () => {
    expect(postOnboardingDestination(base({ role: 'trainee' }))).toBe('/');
  });

  it('defaults a role-less user (back-compat) to home FirstRunHero', () => {
    expect(postOnboardingDestination(base({ role: '' }))).toBe('/');
    expect(postOnboardingDestination(base({ role: undefined }))).toBe('/');
  });
});

describe('stepsForRole — equipment step', () => {
  it('includes the equipment step in the full trainee flow', () => {
    const ids = stepsForRole('trainee').map((s) => s.id);
    expect(ids).toContain('equipment');
    // ordered after experience, last interactive step before complete
    expect(ids.indexOf('equipment')).toBeGreaterThan(ids.indexOf('experience'));
    expect(ids[ids.length - 2]).toBe('equipment');
  });

  it('omits equipment (a personal step) from the coach flow', () => {
    const ids = stepsForRole('coach').map((s) => s.id);
    expect(ids).not.toContain('equipment');
    expect(ids).toEqual(['welcome', 'role', 'profile', 'complete']);
  });

  it('keeps equipment present in the canonical STEPS list', () => {
    expect(STEPS.map((s) => s.id)).toContain('equipment');
  });
});

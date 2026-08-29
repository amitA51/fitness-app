import { beforeEach, describe, expect, it } from 'vitest';
import { saveOnboardingData, savePartialOnboardingData } from '../../../appOnboarding';
import { computeMacrosFromProfile } from '../../../services/settingsService';
import { calculateTDEE } from '../../../utils/tdee';
import { DEFAULT_PROFILE } from '../../settings/types';
import type { OnboardingData } from '../types';
import { DEFAULT_ONBOARDING } from '../types';

// Regression cover for the fabricated activity level.
//
// Onboarding never asks how active the user is. It used to derive an
// ACTIVITY-VOLUME multiplier from an EXPERIENCE self-report, and its default
// branch returned 'פעיל מתון' (1.55) when nothing was answered — so a user who
// said nothing about activity was recorded as moderately active and every
// calorie target was built on it (~300 kcal/day off for a typical profile).
//
// These tests pin the whole chain, because closing any single site alone left
// the fabrication alive somewhere else: the wizard write path, the skip path,
// the settings default, and the TDEE consumer's own `?? 1.55`.

const readProfile = (): Record<string, unknown> =>
  JSON.parse(localStorage.getItem('user_profile') ?? '{}');

const answered = (overrides: Partial<OnboardingData> = {}): OnboardingData => ({
  ...DEFAULT_ONBOARDING,
  name: 'דנה',
  gender: 'female',
  age: 30,
  height: 170,
  weight: 62,
  primaryGoal: 'general',
  ...overrides,
});

describe('onboarding never records an activity level the user did not give', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('writes no activityLevel on the complete path when experience is unanswered', () => {
    saveOnboardingData(answered({ experienceLevel: '' }));

    expect(readProfile()).not.toHaveProperty('activityLevel');
  });

  it('writes no activityLevel on the complete path even when experience IS answered', () => {
    // Experience is not activity: an experienced lifter can be sedentary. The
    // derivation was a category error, so answering it must not create one.
    saveOnboardingData(answered({ experienceLevel: 'advanced' }));

    expect(readProfile()).not.toHaveProperty('activityLevel');
  });

  it('still records what the user DID answer', () => {
    saveOnboardingData(answered());
    const profile = readProfile();

    expect(profile.name).toBe('דנה');
    expect(profile.weight).toBe(62);
    expect(profile.gender).toBe('female');
    expect(profile.weightGoal).toBe('שמירה על משקל');
  });

  it('writes no activityLevel on the skip path', () => {
    savePartialOnboardingData(answered({ experienceLevel: 'intermediate' }));

    expect(readProfile()).not.toHaveProperty('activityLevel');
  });

  it('never leaves a stale fabricated activityLevel behind on a re-run', () => {
    // The write is a spread-merge, so a value already on the device survives.
    // That is deliberate (see the "already-fabricated cohort" note) — what must
    // not happen is onboarding ADDING one.
    localStorage.setItem('user_profile', JSON.stringify({ name: 'old' }));
    saveOnboardingData(answered({ experienceLevel: '' }));

    expect(readProfile()).not.toHaveProperty('activityLevel');
  });
});

describe('an unknown activity level yields no calorie target', () => {
  it('DEFAULT_PROFILE does not pre-answer activity or sex', () => {
    expect(DEFAULT_PROFILE.activityLevel).toBe('');
    expect(DEFAULT_PROFILE.gender).toBe('');
  });

  it('calculateTDEE refuses to invent the 1.55 multiplier', () => {
    // The old consumer did `ACTIVITY_MAP[activityLevel] ?? 1.55`, so deleting
    // the stored field alone would only have moved the lie downstream.
    const unknown = calculateTDEE(70, 175, 30, 'male', '');
    expect(unknown.tdee).toBe(0);
    expect(unknown.maintain).toBe(0);

    // A real answer still computes: BMR 1649 × 1.55 = 2556.
    expect(calculateTDEE(70, 175, 30, 'male', 'פעיל מתון').tdee).toBe(2556);
  });

  it('calculateTDEE refuses to read an unknown sex as male (±166 kcal)', () => {
    expect(calculateTDEE(70, 175, 30, '', 'פעיל מתון').bmr).toBe(0);
  });

  it('computeMacrosFromProfile returns zeros rather than a plausible body', () => {
    const noProfile = computeMacrosFromProfile({
      weightKg: null,
      heightCm: null,
      age: null,
      gender: '',
      activityLevel: '',
      weightGoal: 'שמירה על משקל',
    });

    expect(noProfile).toEqual({ calories: 0, protein: 0, carbs: 0, fat: 0 });
  });

  it('computeMacrosFromProfile withholds a target when ONLY activity is missing', () => {
    // The case the app actually produced: full body metrics, no activity answer.
    const macros = computeMacrosFromProfile({
      weightKg: 80,
      heightCm: 175,
      age: 30,
      gender: 'male',
      activityLevel: '',
      weightGoal: 'ירידה במשקל',
    });

    expect(macros.calories).toBe(0);
  });
});

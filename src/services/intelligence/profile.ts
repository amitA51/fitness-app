// ============================================================================
// Athlete Profile — normalized, math-ready view of the user's static profile
// ============================================================================
//
// The profile fields (age, bodyweight, height, experience, goal, equipment)
// already exist in onboarding ('onboarding_data') and settings ('user_profile')
// but were never fed into the AI context, so advice could not be personalized
// (a 20yo beginner got the same guidance as a 45yo advanced lifter). This module
// reads both stores, normalizes them into one typed shape with English enums,
// and reports which fields are actually present so downstream consumers can hedge
// when the profile is incomplete.
// ============================================================================

import type { OnboardingData } from '../../pages/onboarding/types';
import type { UserProfile } from '../../pages/settings/types';
import { safeJsonParse } from '../../utils/safeJson';

export type ExperienceLevel = 'beginner' | 'intermediate' | 'advanced';
export type PrimaryGoal = 'strength' | 'muscle' | 'endurance' | 'weight_loss' | 'general';
export type WeightDirection = 'lose' | 'maintain' | 'gain';
export type EquipmentAccess = 'gym' | 'home_full' | 'home_minimal' | 'bodyweight';

export interface AthleteProfile {
  age: number | null;
  weightKg: number | null;
  heightCm: number | null;
  gender: 'male' | 'female' | 'other' | null;
  experienceLevel: ExperienceLevel | null;
  primaryGoal: PrimaryGoal | null;
  /** Direction of the bodyweight goal (drives goal-aware nutrition adherence). */
  weightDirection: WeightDirection | null;
  /**
   * Read from a legacy stored `onboarding_data` only — onboarding no longer asks
   * where the user trains, because nothing filtered on the answer. Kept so
   * existing users do not lose it and so re-introducing the question is a UI
   * change rather than a re-design.
   */
  equipment: EquipmentAccess | null;
  /** Fraction of the six tracked fields that are populated (0..1). */
  completeness: number;
}

/**
 * Keys that a persisted `onboarding_data` payload written by an older build may
 * still carry, but which are no longer part of `OnboardingData`. Declared rather
 * than cast so the back-compat read stays type-checked.
 */
export interface LegacyOnboardingKeys {
  equipment?: EquipmentAccess | '';
}

const WEIGHT_GOAL_TO_DIRECTION: Record<string, WeightDirection> = {
  'ירידה במשקל': 'lose',
  'שמירה על משקל': 'maintain',
  'עלייה במסה': 'gain',
};

const toNumberOrNull = (v: unknown): number | null =>
  typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : null;

/**
 * Pure normalization so it can be unit-tested without touching localStorage.
 * Settings ('user_profile') wins for the current body metrics (age/weight/
 * height/gender/weightGoal); onboarding contributes experience/goal/equipment
 * which settings does not track.
 */
export function normalizeProfile(
  userProfile: Partial<UserProfile> | null,
  onboarding: (Partial<OnboardingData> & LegacyOnboardingKeys) | null
): AthleteProfile {
  const age = toNumberOrNull(userProfile?.age) ?? toNumberOrNull(onboarding?.age);
  const weightKg = toNumberOrNull(userProfile?.weight) ?? toNumberOrNull(onboarding?.weight);
  const heightCm = toNumberOrNull(userProfile?.height) ?? toNumberOrNull(onboarding?.height);
  // `||` not `??`: both stores use '' as their "not answered" sentinel, and `??`
  // would let that empty string through as a populated gender — counting it in
  // `completeness` and typing wrong against the union below.
  const gender = userProfile?.gender || onboarding?.gender || null;

  const experienceLevel = onboarding?.experienceLevel || null;

  // onboarding primaryGoal uses 'muscle'; normalize to our union as-is.
  const primaryGoal = (onboarding?.primaryGoal || null) as PrimaryGoal | null;

  const weightDirection = userProfile?.weightGoal
    ? (WEIGHT_GOAL_TO_DIRECTION[userProfile.weightGoal] ?? null)
    : onboarding?.primaryGoal === 'weight_loss'
      ? 'lose'
      : onboarding?.primaryGoal === 'muscle'
        ? 'gain'
        : null;

  const equipment = (onboarding?.equipment || null) as EquipmentAccess | null;

  // `equipment` is deliberately NOT counted. It is no longer collected, so
  // leaving it in the denominator would cap every new user at 5/6 and quietly
  // redefine what "complete" means. It is still read above for the users who
  // already have one stored.
  const fields = [age, weightKg, heightCm, gender, experienceLevel, primaryGoal];
  const present = fields.filter((f) => f !== null).length;

  return {
    age,
    weightKg,
    heightCm,
    gender,
    experienceLevel,
    primaryGoal,
    weightDirection,
    equipment,
    completeness: Math.round((present / fields.length) * 100) / 100,
  };
}

/** Read + normalize the profile from localStorage. Safe in non-browser/test envs. */
export function readAthleteProfile(): AthleteProfile {
  if (typeof localStorage === 'undefined') {
    return normalizeProfile(null, null);
  }
  const userProfile = safeJsonParse<Partial<UserProfile>>(localStorage.getItem('user_profile'));
  const onboarding = safeJsonParse<Partial<OnboardingData> & LegacyOnboardingKeys>(
    localStorage.getItem('onboarding_data')
  );
  return normalizeProfile(userProfile ?? null, onboarding ?? null);
}

/** Hebrew one-liners for prompts/UI, omitting unknown fields. */
export function describeProfile(p: AthleteProfile): string {
  const parts: string[] = [];
  if (p.age) parts.push(`גיל ${p.age}`);
  if (p.weightKg) parts.push(`משקל ${p.weightKg} ק"ג`);
  if (p.experienceLevel) {
    const exp = { beginner: 'מתחיל', intermediate: 'מתקדם', advanced: 'מנוסה' }[p.experienceLevel];
    parts.push(`ניסיון: ${exp}`);
  }
  if (p.primaryGoal) {
    const goal = {
      strength: 'כוח',
      muscle: 'מסת שריר',
      endurance: 'סיבולת',
      weight_loss: 'ירידה במשקל',
      general: 'כושר כללי',
    }[p.primaryGoal];
    parts.push(`מטרה: ${goal}`);
  }
  return parts.length > 0 ? parts.join(' · ') : 'לא ידוע';
}

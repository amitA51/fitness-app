/**
 * The four things onboarding asks, plus the three it still carries for the
 * screens that already own them (Settings › פרטים אישיים, Nutrition).
 *
 * Eleven fields were removed here: equipment, preferredWorkoutDays,
 * restBetweenSets, role, workoutDuration, preferredTime, preferCompound,
 * includeCardio, trackNutrition, dailyCalorieGoal, unitSystem. Seven of those
 * were never asked and never read; two were asked with the flow's largest
 * controls and read by nothing but a recap card that is also gone; one wrote to
 * a key the rest timer does not read; and `unitSystem` shadowed the real
 * setting on `appSettings`. Removing a field nothing reads is dead-code
 * removal, not a product decision.
 *
 * Re-introducing equipment later is a UI change plus one field: the
 * `EquipmentAccess` union still lives at services/intelligence/profile.ts, and
 * `normalizeProfile` still READS a legacy stored `equipment` for back-compat.
 */
export interface OnboardingData {
  name: string;
  gender: 'male' | 'female' | 'other' | '';
  age: number | '';
  height: number | '';
  weight: number | '';
  primaryGoal: 'strength' | 'muscle' | 'endurance' | 'weight_loss' | 'general' | '';
  experienceLevel: 'beginner' | 'intermediate' | 'advanced' | '';
}

export const DEFAULT_ONBOARDING: OnboardingData = {
  name: '',
  gender: '',
  age: '',
  height: '',
  weight: '',
  primaryGoal: '',
  experienceLevel: '',
};

export interface OnboardingProps {
  onComplete: (data: OnboardingData) => void;
  /**
   * Called when the user skips onboarding. Receives the partial wizard data so
   * any fields already typed (name, weight, …) can still be persisted —
   * honoring the skip dialog's promise that it can be completed later.
   */
  onSkip: (data: OnboardingData) => void;
}

/**
 * A wizard step is just its id. `title`/`subtitle` used to live here too and
 * were never rendered — only `.id` is ever read, and each step component
 * hardcodes its own header — so they were dead strings carrying the wrong
 * (singular) register for the next author to copy.
 */
export interface OnboardingStep {
  id: string;
}

/**
 * The wizard steps, in order. One flat list — every user onboards as a trainee
 * (coach status is granted server-side, never chosen here).
 *
 * `equipment` is gone with the fields it collected. `complete` is gone because
 * its two CTAs both routed to `'/'` while promising different things, and two of
 * its three recap cards displayed values nobody chose (workoutDuration 60,
 * preferredWorkoutDays 3). The greeting and the "what to do next" surface it
 * duplicated already exist on the home screen it landed on.
 */
export const STEPS: OnboardingStep[] = [{ id: 'welcome' }, { id: 'profile' }, { id: 'goals' }];

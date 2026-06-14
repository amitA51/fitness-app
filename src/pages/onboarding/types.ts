export type EquipmentAccess = 'gym' | 'home_full' | 'home_minimal' | 'bodyweight' | '';
export type UnitSystem = 'metric' | 'imperial';
/** Role chosen at onboarding. 'coach' routes to the coach experience (command
 * center home, coach nav) and is persisted server-side via become_coach();
 * 'trainee' (or empty) is the default trainee path. */
export type OnboardingRole = 'coach' | 'trainee' | '';

export interface OnboardingData {
  name: string;
  gender: 'male' | 'female' | 'other' | '';
  age: number | '';
  height: number | '';
  weight: number | '';
  primaryGoal: 'strength' | 'muscle' | 'endurance' | 'weight_loss' | 'general' | '';
  experienceLevel: 'beginner' | 'intermediate' | 'advanced' | '';
  preferredWorkoutDays: number;
  workoutDuration: number;
  preferredTime: 'morning' | 'afternoon' | 'evening' | '';
  restBetweenSets: number;
  preferCompound: boolean;
  includeCardio: boolean;
  trackNutrition: boolean;
  dailyCalorieGoal: number | '';
  // Added 2026-05-18: equipment access + unit system. Optional for back-compat
  // with any persisted onboarding_data; readers should default to metric/gym.
  equipment?: EquipmentAccess;
  unitSystem?: UnitSystem;
  // Added 2026-05-31: role split (coach/trainee). Optional for back-compat with
  // any persisted onboarding_data; readers should default to trainee.
  role?: OnboardingRole;
}

export const DEFAULT_ONBOARDING: OnboardingData = {
  name: '',
  gender: '',
  age: '',
  height: '',
  weight: '',
  primaryGoal: '',
  experienceLevel: '',
  preferredWorkoutDays: 3,
  workoutDuration: 60,
  preferredTime: '',
  restBetweenSets: 90,
  preferCompound: true,
  includeCardio: false,
  trackNutrition: false,
  dailyCalorieGoal: '',
  equipment: '',
  unitSystem: 'metric',
  role: '',
};

export interface OnboardingProps {
  onComplete: (data: OnboardingData) => void;
  /**
   * Called when the user skips onboarding. Receives the partial wizard data so
   * any fields already typed (name, age, goals, …) can still be persisted —
   * honoring the skip dialog's promise that it can be completed later.
   */
  onSkip: (data: OnboardingData) => void;
}

export interface OnboardingStep {
  id: string;
  title: string;
  subtitle: string;
}

export const STEPS: OnboardingStep[] = [
  { id: 'welcome', title: 'ברוך הבא', subtitle: 'הכר את עצמך' },
  { id: 'role', title: 'מי אתה?', subtitle: 'מאמן או מתאמן' },
  { id: 'profile', title: 'פרופיל אישי', subtitle: 'ספר לנו על עצמך' },
  { id: 'goals', title: 'מטרות כושר', subtitle: 'מה המטרות שלך?' },
  { id: 'experience', title: 'ניסיון', subtitle: 'רמת האימון שלך' },
  { id: 'equipment', title: 'ציוד', subtitle: 'איפה אתה מתאמן?' },
  { id: 'preferences', title: 'העדפות', subtitle: 'התאם אישית' },
  { id: 'complete', title: 'מוכן!', subtitle: 'בואו נתחיל' },
];

/** Step ids that only make sense for a trainee's personal training profile. */
const TRAINEE_ONLY_STEP_IDS = new Set(['goals', 'experience', 'equipment', 'preferences']);

/**
 * The wizard steps for a given role. Coaches get a short flow (welcome → role
 * → profile → complete) — their primary surface is managing trainees, so the
 * personal goals/experience/preferences steps are skipped.
 */
export const stepsForRole = (role: OnboardingRole | undefined): OnboardingStep[] =>
  role === 'coach' ? STEPS.filter((s) => !TRAINEE_ONLY_STEP_IDS.has(s.id)) : STEPS;

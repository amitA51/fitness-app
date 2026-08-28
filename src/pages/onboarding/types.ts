export type EquipmentAccess = 'gym' | 'home_full' | 'home_minimal' | 'bodyweight' | '';
export type UnitSystem = 'metric' | 'imperial';
/** Role carried on a persisted onboarding draft. Onboarding can no longer set
 * this — coach status is assigned server-side (profiles.role) — so a new wizard
 * run always leaves it empty and every user onboards as a trainee. */
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

/** The wizard steps, in order. One flat list — every user onboards as a trainee
 * (coach status is granted server-side, never chosen here). */
export const STEPS: OnboardingStep[] = [
  { id: 'welcome', title: 'ברוך הבא', subtitle: 'הכר את עצמך' },
  { id: 'profile', title: 'פרופיל אישי', subtitle: 'ספר לנו על עצמך' },
  { id: 'goals', title: 'מטרות כושר', subtitle: 'מה המטרות שלך?' },
  { id: 'equipment', title: 'האימון שלכם', subtitle: 'ניסיון, ציוד ותדירות' },
  { id: 'complete', title: 'מוכן!', subtitle: 'בואו נתחיל' },
];

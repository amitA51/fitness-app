export type EquipmentAccess = 'gym' | 'home_full' | 'home_minimal' | 'bodyweight' | '';
export type UnitSystem = 'metric' | 'imperial';

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
};

export interface OnboardingProps {
  onComplete: (data: OnboardingData) => void;
  onSkip: () => void;
}

export const STEPS = [
  { id: 'welcome', title: 'ברוך הבא', subtitle: 'הכר את עצמך' },
  { id: 'profile', title: 'פרופיל אישי', subtitle: 'ספר לנו על עצמך' },
  { id: 'goals', title: 'מטרות כושר', subtitle: 'מה המטרות שלך?' },
  { id: 'experience', title: 'ניסיון', subtitle: 'רמת האימון שלך' },
  { id: 'preferences', title: 'העדפות', subtitle: 'התאם אישית' },
  { id: 'complete', title: 'מוכן!', subtitle: 'בוא נתחיל' },
];

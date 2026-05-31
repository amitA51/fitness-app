import { safeJsonParseOr } from '../../utils/safeJson';

// ─── Types ──────────────────────────────────────────────────────────────────

export type WeightGoal = 'ירידה במשקל' | 'שמירה על משקל' | 'עלייה במסה';
export type ActivityLevel = 'לא פעיל' | 'פעיל מעט' | 'פעיל מתון' | 'פעיל מאוד' | 'ספורטאי';
export type Gender = 'male' | 'female' | 'other';

export interface UserProfile {
  name: string;
  age: number | '';
  height: number | '';
  weight: number | '';
  gender: Gender;
  weightGoal: WeightGoal;
  activityLevel: ActivityLevel;
}

export interface NutritionGoals {
  calories: number | '';
  protein: number | '';
  carbs: number | '';
  fat: number | '';
}

// Only real, app-wide workout preferences live here. Accessibility/display
// toggles (reducedAnimations/largeText/highContrast) and dark mode are owned
// by SettingsContext and surfaced in the "תצוגה ונגישות" section instead.
export interface WorkoutPrefs {
  defaultRestTime: number;
  autoStartRest: boolean;
  hapticsEnabled: boolean;
}

// Gender option labels for the profile form (value -> Hebrew label).
export const GENDER_OPTIONS: ReadonlyArray<{ value: Gender; label: string }> = [
  { value: 'male', label: 'זכר' },
  { value: 'female', label: 'נקבה' },
  { value: 'other', label: 'אחר' },
] as const;

// ─── Defaults ───────────────────────────────────────────────────────────────

export const DEFAULT_PROFILE: UserProfile = {
  name: '',
  age: '',
  height: '',
  weight: '',
  gender: 'male',
  weightGoal: 'שמירה על משקל',
  activityLevel: 'פעיל מתון',
};

export const DEFAULT_NUTRITION: NutritionGoals = {
  calories: '',
  protein: '',
  carbs: '',
  fat: '',
};

export const DEFAULT_WORKOUT_PREFS: WorkoutPrefs = {
  defaultRestTime: 90,
  autoStartRest: true,
  hapticsEnabled: true,
};

export const REST_TIME_OPTIONS = [
  { value: 30, label: '30 שנ' },
  { value: 60, label: '60 שנ' },
  { value: 90, label: '90 שנ' },
  { value: 120, label: '2 דק' },
  { value: 180, label: '3 דק' },
] as const;

// ─── Static styles ──────────────────────────────────────────────────────────

export const HEADER_SUBTITLE_STYLE = {
  fontFamily: 'var(--font-body)',
  fontSize: 13,
  fontWeight: 500,
  color: 'var(--fs-muted)',
  margin: 0,
  lineHeight: 1.4,
} as const;

export const HEADER_TITLE_STYLE = {
  fontFamily: 'var(--font-display)',
  fontWeight: 800,
  fontSize: 26,
  lineHeight: 1.15,
  letterSpacing: '-0.01em',
  color: 'var(--fs-ink)',
  margin: '4px 0 0',
} as const;

export const DIVIDER_STYLE = {
  height: '1px',
  background: 'var(--fs-surface-2)',
  margin: '0 16px',
} as const;

// ─── Storage helpers ────────────────────────────────────────────────────────

export function loadFromStorage<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return { ...fallback, ...safeJsonParseOr<Partial<T>>(raw, {} as Partial<T>) } as T;
  } catch {
    return fallback;
  }
}

export function saveToStorage<T>(key: string, value: T): void {
  localStorage.setItem(key, JSON.stringify(value));
}

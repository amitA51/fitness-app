import { safeJsonParseOr } from '../../utils/safeJson';

// ─── Types ──────────────────────────────────────────────────────────────────

export type WeightGoal = 'ירידה במשקל' | 'שמירה על משקל' | 'עלייה במסה';
export type ActivityLevel = 'לא פעיל' | 'פעיל מעט' | 'פעיל מתון' | 'פעיל מאוד' | 'ספורטאי';

export interface UserProfile {
  name: string;
  age: number | '';
  height: number | '';
  weightGoal: WeightGoal;
  activityLevel: ActivityLevel;
}

export interface NutritionGoals {
  calories: number | '';
  protein: number | '';
  carbs: number | '';
  fat: number | '';
}

export interface WorkoutPrefs {
  defaultRestTime: number;
  autoStartRest: boolean;
  hapticsEnabled: boolean;
  reducedAnimations: boolean;
  largeText: boolean;
  highContrast: boolean;
}

export interface NotificationSettings {
  workoutReminderEnabled: boolean;
  workoutReminderTime: string;
  missedWorkoutAlertDays: number;
  nutritionReminderEnabled: boolean;
  prNotificationEnabled: boolean;
}

// ─── Defaults ───────────────────────────────────────────────────────────────

export const DEFAULT_PROFILE: UserProfile = {
  name: '',
  age: '',
  height: '',
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
  reducedAnimations: false,
  largeText: false,
  highContrast: false,
};

export const DEFAULT_NOTIFICATION_SETTINGS: NotificationSettings = {
  workoutReminderEnabled: false,
  workoutReminderTime: '08:00',
  missedWorkoutAlertDays: 3,
  nutritionReminderEnabled: false,
  prNotificationEnabled: true,
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

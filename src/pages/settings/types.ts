import { showToast } from '../../components/ui/GlobalToast';
import { logger } from '../../utils/logger';
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

// Weight-goal options. value === label here (the union is Hebrew), but the
// {value,label} shape keeps SettingsSelect generic across all three dropdowns.
export const WEIGHT_GOAL_OPTIONS: ReadonlyArray<{ value: WeightGoal; label: string }> = [
  { value: 'ירידה במשקל', label: 'ירידה במשקל' },
  { value: 'שמירה על משקל', label: 'שמירה על משקל' },
  { value: 'עלייה במסה', label: 'עלייה במסה' },
] as const;

// Activity-level options (feeds the TDEE multiplier in the Nutrition screen).
export const ACTIVITY_LEVEL_OPTIONS: ReadonlyArray<{ value: ActivityLevel; label: string }> = [
  { value: 'לא פעיל', label: 'לא פעיל' },
  { value: 'פעיל מעט', label: 'פעיל מעט' },
  { value: 'פעיל מתון', label: 'פעיל מתון' },
  { value: 'פעיל מאוד', label: 'פעיל מאוד' },
  { value: 'ספורטאי', label: 'ספורטאי' },
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

// ─── Autosave tuning ──────────────────────────────────────────────────────────

/**
 * Debounce window for text/number autosaves. Long enough to coalesce typing
 * into one localStorage write, short enough that the "נשמר" flash still feels
 * responsive once the field settles. Toggles/selects bypass this and save
 * immediately.
 */
export const AUTOSAVE_DEBOUNCE_MS = 500;

/** How long the subtle "נשמר" saved-indicator stays visible after a write. */
export const SAVED_FLASH_MS = 1500;

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

/**
 * Persist a value to localStorage.
 *
 * Returns `true` on success, `false` on failure (quota exceeded, storage
 * disabled, serialization error). On failure it surfaces a Hebrew error toast
 * and logs the cause, so callers never silently claim a save succeeded — they
 * can branch on the return value to decide whether to show "saved" feedback.
 */
export function saveToStorage<T>(key: string, value: T): boolean {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (err) {
    logger.app.error(`saveToStorage failed for "${key}"`, err);
    showToast('שמירה נכשלה', { variant: 'error' });
    return false;
  }
}

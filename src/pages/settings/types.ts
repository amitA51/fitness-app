import { showToast } from '../../components/ui/GlobalToast';
import { logger } from '../../utils/logger';
import { safeJsonParseOr } from '../../utils/safeJson';

// ─── Types ──────────────────────────────────────────────────────────────────

export type WeightGoal = 'ירידה במשקל' | 'שמירה על משקל' | 'עלייה במסה';
/**
 * `''` is the "not answered" state, matching the `| ''` sentinel age/height/
 * weight already use. It exists because the TDEE activity multiplier used to be
 * fabricated (`'פעיל מתון'` = 1.55) for users who never answered, which moved a
 * ~300 kcal/day error into every calorie target.
 */
export type ActivityLevel = '' | 'לא פעיל' | 'פעיל מעט' | 'פעיל מתון' | 'פעיל מאוד' | 'ספורטאי';
/** `''` = not answered. The BMR sex term is worth ±166 kcal, so it is not guessable. */
export type Gender = '' | 'male' | 'female' | 'other';

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

// Gender option labels for the profile form (value -> Hebrew label). The
// leading not-answered entry keeps SettingsSelect honest: its display label
// falls back to options[0] when no option matches, so without an explicit
// "לא נבחר" row an unanswered profile would render "זכר" as if chosen.
export const GENDER_OPTIONS: ReadonlyArray<{ value: Gender; label: string }> = [
  { value: '', label: 'לא נבחר' },
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
// "לא נבחר" is a real state, not a placeholder: it is what a profile looks like
// before the user picks, and the calorie target stays unavailable until then.
export const ACTIVITY_LEVEL_OPTIONS: ReadonlyArray<{ value: ActivityLevel; label: string }> = [
  { value: '', label: 'לא נבחר' },
  { value: 'לא פעיל', label: 'לא פעיל' },
  { value: 'פעיל מעט', label: 'פעיל מעט' },
  { value: 'פעיל מתון', label: 'פעיל מתון' },
  { value: 'פעיל מאוד', label: 'פעיל מאוד' },
  { value: 'ספורטאי', label: 'ספורטאי' },
] as const;

// ─── Defaults ───────────────────────────────────────────────────────────────

// Every field defaults to the empty "not answered" sentinel. gender and
// activityLevel used to default to 'male' / 'פעיל מתון', which the Settings
// screen then displayed as the user's own selection and the TDEE calc consumed
// as fact. A default is not an answer.
export const DEFAULT_PROFILE: UserProfile = {
  name: '',
  age: '',
  height: '',
  weight: '',
  gender: '',
  weightGoal: 'שמירה על משקל',
  activityLevel: '',
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

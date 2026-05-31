// ============================================================================
// WORKOUT CONSTANTS
// ============================================================================
// Centralized constants to replace magic numbers throughout the app

export const WORKOUT = {
  // Default values
  DEFAULT_SETS: 4,
  DEFAULT_REPS: 10,
  DEFAULT_REST_TIME: 90, // seconds
  DEFAULT_WEIGHT: 0,

  // Limits
  MAX_SETS: 20,
  MAX_REPS: 100,
  MIN_REPS: 1,
  MAX_WEIGHT: 1000,
  MAX_REST_TIME: 600, // 10 minutes

  // Timer thresholds
  TIMER_WARNING_THRESHOLD: 300, // 5 minutes - show warning
  TIMER_CRITICAL_THRESHOLD: 60, // 1 minute - show critical
  TIMER_LONG_REST: 180, // 3 minutes

  // Volume calculations
  RPE_SCALE_MAX: 10,
  WARMUP_SET_MULTIPLIER: 0.5,
} as const;

export const MUSCLE_GROUPS = {
  ALL: 'all',
  CHEST: 'Chest',
  BACK: 'Back',
  LEGS: 'Legs',
  SHOULDERS: 'Shoulders',
  ARMS: 'Arms',
  CORE: 'Core',
  CARDIO: 'Cardio',
  ABS: 'Abs',
  OTHER: 'Other',
} as const;

export const EXERCISE_CATEGORIES = {
  ALL: 'all',
  STRENGTH: 'strength',
  CARDIO: 'cardio',
  FLEXIBILITY: 'flexibility',
  WARMUP: 'warmup',
  COOLDOWN: 'cooldown',
} as const;

export const MEAL_TYPES = {
  BREAKFAST: 'breakfast',
  LUNCH: 'lunch',
  DINNER: 'dinner',
  SNACK: 'snack',
  PRE_WORKOUT: 'pre-workout',
  POST_WORKOUT: 'post-workout',
} as const;

export const WORKOUT_STATUS = {
  ACTIVE: 'active',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
} as const;

export const PR_TYPES = {
  WEIGHT: 'weight',
  ONE_RM: '1rm',
  REPS: 'reps',
  VOLUME: 'volume',
} as const;

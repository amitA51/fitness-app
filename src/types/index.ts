// ============================================================================
// SPARKOS FITNESS APP - TYPES
// ============================================================================
// טיפוסים מ-SparkOS עבור אפליקציית כושר

// ============================================================================
// WORKOUT TYPES
// ============================================================================

export interface WorkoutSet {
  id: string;
  setNumber: number;
  reps: number;
  weight: number;
  rpe: number | null;
  isWarmup: boolean;
  isCompleted: boolean;
  notes: string;
  completedAt: string | null;
  duration?: number; // for timed exercises (e.g., plank)
}

export interface WorkoutExercise {
  id: string;
  exerciseId: string;
  exerciseName: string;
  targetMuscle: string;
  sets: WorkoutSet[];
  notes: string;
  restSeconds: number;
  isCompleted: boolean;
  order: number;
  // Extended fields used by components
  name?: string; // Alias for exerciseName (backward compatibility)
  muscleGroup?: string;
  tempo?: string;
  targetRestTime?: number;
  tutorialText?: string;
  programExtras?: ProgramExtras;
}

export interface WorkoutSession {
  id: string;
  date: string; // YYYY-MM-DD
  startTime: string; // ISO timestamp
  endTime: string | null;
  exercises: WorkoutExercise[];
  duration: number; // in seconds
  status: 'active' | 'completed' | 'cancelled';
  templateId: string | null;
  notes: string;
  rating: number | null; // 1-5
  totalVolume: number; // total weight × reps
  caloriesBurned: number | null;
  userId?: string;
  workoutItemId?: string;
  goalType?: string;
  createdAt: string;
  updatedAt: string;
  lastUsed?: string | null;
  timesUsed?: number;
  isFavorite?: boolean;
  muscleGroups?: string[];
  isBuiltin?: boolean;
}

export interface WorkoutTemplate {
  id: string;
  name: string;
  description: string;
  exercises: WorkoutTemplateExercise[];
  createdAt: string;
  updatedAt: string;
  lastUsed: string | null;
  timesUsed: number;
  isFavorite: boolean;
  // Additional fields
  muscleGroups?: string[];
  isBuiltin?: boolean;
}

export interface WorkoutTemplateExercise {
  id: string;
  exerciseId: string;
  exerciseName: string;
  targetMuscle: string;
  targetSets: number;
  targetReps: number;
  targetWeight: number | null;
  restSeconds: number;
  order: number;
  notes: string;
  // Extended fields used by components (backward compatibility)
  name?: string; // Alias for exerciseName
  muscleGroup?: string;
  targetRestTime?: number;
  tempo?: string;
  sets?: { reps: number; weight: number }[];
}

// ============================================================================
// EXERCISE TYPES
// ============================================================================

export interface ProgramExtras {
  rpeTarget?: number;
  restTime?: number;
  intensityTechnique?: string;
  alternatives?: string[];
  notes?: string;
  [key: string]: unknown;
}

export interface Exercise {
  id: string;
  name?: string;
  targetMuscle?: string;
  secondaryMuscles?: string[];
  equipment?: string;
  instructions?: string;
  videoUrl?: string | null;
  imageUrl?: string | null;
  isCustom?: boolean;
  isTimed?: boolean; // e.g., plank - uses duration instead of reps
  createdAt?: string;
  // Extended fields used by workout components
  sets?: WorkoutSet[];
  muscleGroup?: string;
  tempo?: string;
  defaultRestTime?: number;
  targetRestTime?: number;
  tutorialText?: string;
  programExtras?: ProgramExtras;
  // Additional fields from template/personal exercise context
  targetSets?: number;
  targetReps?: number;
  targetWeight?: number;
  restSeconds?: number;
  order?: number;
  notes?: string;
  exerciseId?: string;
  exerciseName?: string;
  isCompleted?: boolean;
}

// Personal exercise with workout-specific fields
export interface PersonalExercise extends Exercise {
  userId?: string;
  lastWeight?: number | null;
  lastReps?: number | null;
  personalRecords?: ExercisePR[];
  // Workout-specific fields
  muscleGroup?: string;
  tempo?: string;
  defaultRestTime?: number;
  defaultSets?: number; // NEW: number of sets for this exercise
  tutorialText?: string;
  category?: string;
  useCount?: number;
  lastUsed?: string;
  isFavorite?: boolean;
  notes?: string;
}

// Type for creating a new personal exercise (excludes auto-generated fields)
// Made partial to allow creating exercises with minimal data
export type CreatePersonalExerciseInput = Partial<Omit<PersonalExercise, 'id' | 'createdAt'>> & {
  name: string;
  targetMuscle?: string;
};

export interface ExercisePR {
  id: string;
  exerciseId: string;
  date: string;
  type: 'weight' | 'reps' | 'volume';
  value: number;
  reps: number;
  weight: number;
}

// ============================================================================
// WORKOUT CONTEXT
// ============================================================================

// ============================================================================
// NUTRITION TYPES (NEW)
// ============================================================================

export interface MealEntry {
  id: string;
  date: string; // YYYY-MM-DD
  name: string;
  meals: Meal[];
  totalMacros: MacroNutrients;
  notes: string;
  createdAt: string;
}

export interface Meal {
  id: string;
  name: MealType;
  foods: FoodItem[];
  time: string; // HH:MM
  totalMacros: MacroNutrients;
}

export type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack' | 'pre-workout' | 'post-workout';

export interface FoodItem {
  id: string;
  name: string;
  brand?: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
  servingSize: string;
  servings: number;
  barcode?: string;
}

export interface MacroNutrients {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

// ============================================================================
// USER GOALS
// ============================================================================

export interface UserGoals {
  id: string;
  fitness: FitnessGoals;
  nutrition: NutritionGoals;
  currentWeight: number;
  targetWeight: number;
  height: number;
  age: number;
  gender: 'male' | 'female' | 'other';
  activityLevel: 'sedentary' | 'light' | 'moderate' | 'active' | 'very_active';
}

export interface FitnessGoals {
  weeklyWorkouts: number;
  workoutDuration: number; // minutes
  targetMuscles: string[];
  preferredWorkoutTime: 'morning' | 'afternoon' | 'evening';
}

export interface NutritionGoals {
  dailyCalories: number;
  dailyProtein: number;
  dailyCarbs: number;
  dailyFat: number;
  mealTiming: MealTiming[];
}

export interface MealTiming {
  meal: MealType;
  targetTime: string; // HH:MM
  caloriesTarget: number;
}

// ============================================================================
// ANALYTICS TYPES
// ============================================================================

export interface WorkoutAnalytics {
  totalWorkouts: number;
  totalVolume: number;
  totalDuration: number;
  averageWorkoutDuration: number;
  mostTrainedMuscles: string[];
  workoutFrequency: { date: string; count: number }[];
  personalRecords: ExercisePR[];
  streakDays: number;
}

export interface NutritionAnalytics {
  averageCalories: number;
  averageProtein: number;
  averageCarbs: number;
  averageFat: number;
  adherenceScore: number; // 0-100
  mealTimingAdherence: number; // 0-100
}

// ============================================================================
// UI TYPES
// ============================================================================

export type WorkoutTheme = 'deepCosmos' | 'fireEnergy' | 'neonPulse' | 'oceanWave' | 'forestGrove';

export interface ThemeColors {
  primary: string;
  secondary: string;
  accent: string;
  background: string;
  surface: string;
  text: string;
  success: string;
  warning: string;
  error: string;
}

// ============================================================================
// ADDITIONAL MISSING TYPES
// ============================================================================

export interface PersonalItem {
  id: string;
  title?: string;
  exercises?: Exercise[];
  workoutDuration?: number;
  isActiveWorkout?: boolean;
  workoutStartTime?: string;
  workoutTemplateId?: string;
  content?: string;
  type?: string;
  name?: string;
  createdAt?: string;
  updatedAt?: string;
  [key: string]: unknown;
}

// Body weight entry
export interface BodyWeightEntry {
  id: string;
  date: string;
  weight: number;
  notes?: string;
  createdAt: string;
}

// Workout goals (type alias)
export type WorkoutGoal = 'strength' | 'hypertrophy' | 'endurance' | 'maintenance' | 'general';
export type WarmupPreference = 'skip' | 'optional' | 'required';
export type WarmupMode = 'skip' | 'optional' | 'required' | 'ask' | 'always' | 'never';

// Helper to create a properly typed WorkoutSet
export const createWorkoutSet = (
  overrides: Partial<WorkoutSet> & { reps: number; weight: number }
): WorkoutSet => ({
  id: crypto.randomUUID?.() || Math.random().toString(36).slice(2),
  setNumber: 0,
  rpe: null,
  isWarmup: false,
  isCompleted: false,
  notes: '',
  completedAt: null,
  ...overrides,
});

// ============================================================================
// APP SETTINGS
// ============================================================================

export interface WorkoutSettings {
  // Display
  oledMode: boolean;
  selectedTheme: WorkoutTheme;

  // Workout defaults
  defaultWorkoutGoal: 'strength' | 'hypertrophy' | 'endurance' | 'maintenance' | 'general';
  defaultRestTime: number;
  defaultSets: number;
  autoStartRest: boolean;
  warmupPreference: 'skip' | 'optional' | 'required' | 'ask' | 'always' | 'never';
  cooldownPreference: 'always' | 'ask' | 'never';
  enableWarmup?: boolean;
  enableCooldown?: boolean;

  // Behavior
  keepAwake: boolean;
  hapticsEnabled: boolean;
  autoIncrementWeight: boolean;
  weightIncrementAmount: number;

  // Display options
  showGhostValues: boolean;
  showVolumePreview: boolean;
  showIntensityMeter: boolean;
  showPerformanceStats: boolean;
  showSetHistory?: boolean;
  compactMode: boolean;

  // Audio
  soundEnabled: boolean;
  voiceCountdownEnabled: boolean;
  voiceLanguage: 'he-IL' | 'en-US';
  voiceVolume: number;
  countdownBeepEnabled: boolean;
  restTimerVibrate: boolean;
  restTimerSound: boolean;

  // Reminders
  waterReminderEnabled: boolean;
  waterReminderInterval: number;
  workoutRemindersEnabled: boolean;
  workoutReminderTime?: string;
  reminderDays?: number[];
  trackBodyWeight?: boolean;

  // Accessibility
  reducedAnimations: boolean;
  largeText: boolean;
  highContrast: boolean;

  // Progressive Overload
  enableProgressiveOverload: boolean;
  progressiveOverloadPercent: number;
  enableOneRepMaxTracking: boolean;
  showExerciseNotes: boolean;

  // Smart Rest Timer
  smartRestEnabled: boolean;
  shortRestTime: number;
  mediumRestTime: number;
  longRestTime: number;
  extendRestAfterFailure: boolean;

  // Workout Flow
  autoAdvanceExercise: boolean;
  confirmExerciseComplete: boolean;
  enableSupersets: boolean;
  showRestBetweenExercises: boolean;

  // Personal Records
  enablePRAlerts: boolean;
  prCelebrationIntensity: 'off' | 'subtle' | 'full';
  trackVolumeRecords: boolean;

  // Timer Display
  timerDisplayMode: 'countdown' | 'countup' | 'both';
  showTimerInHeader: boolean;

  // Quick Actions
  enableQuickWeightButtons: boolean;
  quickWeightIncrement: number;
  enableQuickRepsButtons: boolean;

  // Gym Mode
  gymModeEnabled: boolean;
  gymModeAutoLock: boolean;

  // Body Weight Prompts
  promptWeightBeforeWorkout: boolean;
  promptWeightAfterWorkout: boolean;

  // Analytics
  enableWorkoutAnalytics: boolean;
  showMuscleGroupBalance: boolean;
  enableExportToCSV: boolean;
}

export interface AppSettings {
  workoutSettings: WorkoutSettings;
  theme: WorkoutTheme;
  soundEnabled: boolean;
  keepAwake: boolean;
  darkMode: boolean;
}

export interface PersonalRecord {
  id: string;
  exerciseId: string;
  exerciseName: string;
  date: string;
  weight: number;
  reps: number;
  type: 'weight' | 'reps' | 'volume';
  value?: number; // volume = weight × reps (for volume PRs)
  maxWeight?: number; // optional max weight for volume PRs
  maxWeightReps?: number; // reps at max weight
  maxReps?: number; // for reps PRs
  oneRepMax?: number; // calculated 1RM
}

export type Screen =
  | 'dashboard'
  | 'workout'
  | 'history'
  | 'templates'
  | 'settings'
  | 'today'
  | 'feed'
  | 'calendar'
  | 'assistant'
  | 'library'
  | 'fitness'
  | 'search'
  | 'passwords'
  | 'add'
  | 'investments'
  | 'views'
  | 'login'
  | 'signup'
  | 'logos'
  | 'insights';

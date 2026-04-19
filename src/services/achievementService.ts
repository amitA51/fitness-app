// ============================================================================
// SPARKOS FITNESS - Achievement Service
// ============================================================================

import type { WorkoutSession } from '../types';
import { safeJsonParse } from '../utils/safeJson';
import { STORES, dbGetAll } from './indexedDBCore';

// ============================================================================
// Types
// ============================================================================

export interface Achievement {
  id: string;
  name: string;
  description: string;
  icon: string;
  category: 'workout_count' | 'volume' | 'consistency' | 'pr' | 'nutrition';
  unlockedAt: string | null;
  progress: number;
  target: number;
}

export interface StreakInfo {
  currentStreak: number;
  longestStreak: number;
  lastWorkoutDate: string | null;
  workoutsThisWeek: number;
}

interface AchievementDefinition {
  id: string;
  name: string;
  description: string;
  icon: string;
  category: 'workout_count' | 'volume' | 'consistency' | 'pr' | 'nutrition';
  target: number;
  evaluate: (data: AchievementEvaluationData) => number;
}

interface AchievementEvaluationData {
  totalWorkouts: number;
  totalVolume: number;
  currentStreak: number;
  longestStreak: number;
  totalPRs: number;
  uniqueExercisePRCount: number;
  nutritionDaysLogged: number;
  nutritionConsecutiveDays: number;
  nutritionGoalDays: number;
  workoutsThisWeek: number;
  totalSets: number;
  totalDurationHours: number;
  uniqueMuscleGroups: number;
  hasFridayWorkout: boolean;
  hasSaturdayWorkout: boolean;
}

// ============================================================================
// Constants
// ============================================================================

const STORAGE_KEY = 'sparkos_achievements_unlocked';

// ============================================================================
// Achievement Definitions
// ============================================================================

const ACHIEVEMENT_DEFINITIONS: AchievementDefinition[] = [
  // Workout Count
  {
    id: 'first_workout',
    name: 'אימון ראשון',
    description: 'השלמת אימון ראשון',
    icon: '🏆',
    category: 'workout_count',
    target: 1,
    evaluate: (d) => d.totalWorkouts,
  },
  {
    id: 'ten_workouts',
    name: '10 אימונים',
    description: 'השלמת 10 אימונים',
    icon: '🏅',
    category: 'workout_count',
    target: 10,
    evaluate: (d) => d.totalWorkouts,
  },
  {
    id: 'fifty_workouts',
    name: '50 אימונים',
    description: 'השלמת 50 אימונים',
    icon: '🥇',
    category: 'workout_count',
    target: 50,
    evaluate: (d) => d.totalWorkouts,
  },
  {
    id: 'hundred_workouts',
    name: '100 אימונים',
    description: 'השלמת 100 אימונים',
    icon: '👑',
    category: 'workout_count',
    target: 100,
    evaluate: (d) => d.totalWorkouts,
  },

  // Weekly Frequency
  {
    id: 'three_per_week',
    name: '3 אימונים בשבוע',
    description: 'השלמת 3 אימונים בשבוע אחד',
    icon: '📅',
    category: 'consistency',
    target: 3,
    evaluate: (d) => d.workoutsThisWeek,
  },
  {
    id: 'five_per_week',
    name: '5 אימונים בשבוע',
    description: 'השלמת 5 אימונים בשבוע אחד',
    icon: '🔥',
    category: 'consistency',
    target: 5,
    evaluate: (d) => d.workoutsThisWeek,
  },

  // Volume
  {
    id: 'volume_10k',
    name: 'נפח 10,000 ק"ג',
    description: 'סה"כ נפח אימון של 10,000 ק"ג',
    icon: '🏋️',
    category: 'volume',
    target: 10000,
    evaluate: (d) => d.totalVolume,
  },
  {
    id: 'volume_100k',
    name: 'נפח 100,000 ק"ג',
    description: 'סה"כ נפח אימון של 100,000 ק"ג',
    icon: '💪',
    category: 'volume',
    target: 100000,
    evaluate: (d) => d.totalVolume,
  },
  {
    id: 'volume_1m',
    name: 'נפח 1,000,000 ק"ג',
    description: 'סה"כ נפח אימון של 1,000,000 ק"ג',
    icon: '⚡',
    category: 'volume',
    target: 1000000,
    evaluate: (d) => d.totalVolume,
  },

  // Streak / Consistency
  {
    id: 'streak_3',
    name: 'רצף 3 ימים',
    description: 'רצף של 3 ימים רצופים של אימון',
    icon: '🔥',
    category: 'consistency',
    target: 3,
    evaluate: (d) => Math.max(d.currentStreak, d.longestStreak),
  },
  {
    id: 'streak_7',
    name: 'רצף 7 ימים',
    description: 'רצף של 7 ימים רצופים של אימון',
    icon: '🌟',
    category: 'consistency',
    target: 7,
    evaluate: (d) => Math.max(d.currentStreak, d.longestStreak),
  },
  {
    id: 'streak_30',
    name: 'רצף 30 ימים',
    description: 'רצף של 30 ימים רצופים של אימון',
    icon: '🔥',
    category: 'consistency',
    target: 30,
    evaluate: (d) => Math.max(d.currentStreak, d.longestStreak),
  },
  {
    id: 'streak_100',
    name: 'רצף 100 ימים',
    description: 'רצף של 100 ימים רצופים של אימון',
    icon: '💎',
    category: 'consistency',
    target: 100,
    evaluate: (d) => Math.max(d.currentStreak, d.longestStreak),
  },

  // Personal Records
  {
    id: 'first_pr',
    name: 'שיא אישי ראשון',
    description: 'קבעת שיא אישי ראשון',
    icon: '🎯',
    category: 'pr',
    target: 1,
    evaluate: (d) => d.totalPRs,
  },
  {
    id: 'ten_prs',
    name: '10 שיאים אישיים',
    description: 'קבעת 10 שיאים אישיים',
    icon: '🎖️',
    category: 'pr',
    target: 10,
    evaluate: (d) => d.totalPRs,
  },
  {
    id: 'fifty_prs',
    name: '50 שיאים אישיים',
    description: 'קבעת 50 שיאים אישיים',
    icon: '🏅',
    category: 'pr',
    target: 50,
    evaluate: (d) => d.totalPRs,
  },
  {
    id: 'pr_five_exercises',
    name: '5 תרגילים עם שיא',
    description: 'קבעת שיא ב-5 תרגילים שונים',
    icon: '🌟',
    category: 'pr',
    target: 5,
    evaluate: (d) => d.uniqueExercisePRCount,
  },

  // Nutrition
  {
    id: 'nutrition_7_days',
    name: 'תזונה 7 ימים רצופים',
    description: 'רשמת תזונה ב-7 ימים רצופים',
    icon: '🥗',
    category: 'nutrition',
    target: 7,
    evaluate: (d) => d.nutritionConsecutiveDays,
  },
  {
    id: 'nutrition_30_days',
    name: 'תזונה 30 ימים רצופים',
    description: 'רשמת תזונה ב-30 ימים רצופים',
    icon: '🥦',
    category: 'nutrition',
    target: 30,
    evaluate: (d) => d.nutritionConsecutiveDays,
  },
  {
    id: 'protein_goal_week',
    name: 'עמידה ביעד חלבון שבוע',
    description: 'עמדת ביעד חלבון ב-5 מתוך 7 ימים בשבוע',
    icon: '🥛',
    category: 'nutrition',
    target: 5,
    evaluate: (d) => d.nutritionGoalDays,
  },

  // Hypertrophy
  {
    id: 'hypertrophy_1000_sets',
    name: 'היפרטרופיה מסטים',
    description: 'השלמת 1000 סטים בסה"כ',
    icon: '🏋️',
    category: 'volume',
    target: 1000,
    evaluate: (d) => d.totalSets,
  },

  // Duration
  {
    id: 'training_24_hours',
    name: 'זמן אימון 24 שעות',
    description: 'סה"כ זמן אימון של 24 שעות',
    icon: '⏱️',
    category: 'workout_count',
    target: 24,
    evaluate: (d) => d.totalDurationHours,
  },

  // Muscle Group Diversity
  {
    id: 'muscle_diversity_6',
    name: 'מגוון שרירים',
    description: 'אימנת 6 קבוצות שרירים שונות',
    icon: '🧩',
    category: 'volume',
    target: 6,
    evaluate: (d) => d.uniqueMuscleGroups,
  },

  // Weekend Warrior
  {
    id: 'friday_workout',
    name: 'אימון ביום שישי',
    description: 'השלמת אימון ביום שישי',
    icon: '🙏',
    category: 'consistency',
    target: 1,
    evaluate: (d) => (d.hasFridayWorkout ? 1 : 0),
  },
  {
    id: 'saturday_workout',
    name: 'שבת אימון',
    description: 'השלמת אימון ביום שבת',
    icon: '✡️',
    category: 'consistency',
    target: 1,
    evaluate: (d) => (d.hasSaturdayWorkout ? 1 : 0),
  },
];

// ============================================================================
// localStorage Helpers
// ============================================================================

function getUnlockedIds(): Set<string> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return new Set();
    const parsed = safeJsonParse<unknown>(raw);
    if (Array.isArray(parsed)) {
      return new Set(parsed.filter((v): v is string => typeof v === 'string'));
    }
    return new Set();
  } catch {
    return new Set();
  }
}

function getUnlockedTimestamps(): Map<string, string> {
  try {
    const raw = localStorage.getItem(`${STORAGE_KEY}_timestamps`);
    if (!raw) return new Map();
    const parsed = safeJsonParse<unknown>(raw);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return new Map(Object.entries(parsed as Record<string, string>));
    }
    return new Map();
  } catch {
    return new Map();
  }
}

function persistUnlockedIds(unlockedIds: Set<string>, timestamps: Map<string, string>): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify([...unlockedIds]));
  localStorage.setItem(`${STORAGE_KEY}_timestamps`, JSON.stringify(Object.fromEntries(timestamps)));
}

// ============================================================================
// Data Aggregation
// ============================================================================

function countMaxConsecutiveDays(dates: string[]): number {
  if (dates.length === 0) return 0;

  const uniqueDates = [...new Set(dates)].sort();
  let longestStreak = 1;
  let currentStreak = 1;

  for (let i = 1; i < uniqueDates.length; i++) {
    const prevStr = uniqueDates[i - 1];
    const currStr = uniqueDates[i];
    if (!prevStr || !currStr) continue;
    const prev = new Date(prevStr);
    const curr = new Date(currStr);
    const diffMs = curr.getTime() - prev.getTime();
    const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 1) {
      currentStreak++;
      longestStreak = Math.max(longestStreak, currentStreak);
    } else {
      currentStreak = 1;
    }
  }

  return longestStreak;
}

async function buildEvaluationData(
  sessions: WorkoutSession[],
  streak: StreakInfo
): Promise<AchievementEvaluationData> {
  // Totals from workout sessions
  const totalWorkouts = sessions.length;
  const totalVolume = sessions.reduce((sum, s) => sum + (s.totalVolume ?? 0), 0);
  const totalSets = sessions.reduce(
    (sum, s) =>
      sum + (s.exercises ?? []).reduce((exerciseSum, e) => exerciseSum + (e.sets ?? []).length, 0),
    0
  );
  const totalDurationSeconds = sessions.reduce((sum, s) => sum + (s.duration ?? 0), 0);
  const totalDurationHours = Math.round(totalDurationSeconds / 3600);

  // Unique muscle groups
  const muscleGroupSet = new Set<string>();
  sessions.forEach((s) => {
    (s.exercises ?? []).forEach((e) => {
      if (e.targetMuscle) {
        muscleGroupSet.add(e.targetMuscle);
      }
    });
  });
  const uniqueMuscleGroups = muscleGroupSet.size;

  // Friday / Saturday workout checks
  const dayOfWeekSet = new Set<number>();
  sessions.forEach((s) => {
    const date = new Date(s.startTime);
    dayOfWeekSet.add(date.getDay()); // 0=Sunday, 5=Friday, 6=Saturday
  });
  const hasFridayWorkout = dayOfWeekSet.has(5);
  const hasSaturdayWorkout = dayOfWeekSet.has(6);

  // Personal records
  let totalPRs = 0;
  const prExerciseSet = new Set<string>();
  try {
    const prs = await dbGetAll<Record<string, unknown>>(STORES.PERSONAL_RECORDS);
    totalPRs = prs.length;
    prs.forEach((pr) => {
      const exerciseId = pr.exerciseId as string | undefined;
      if (exerciseId) {
        prExerciseSet.add(exerciseId);
      }
    });
  } catch {
    // Store may not have data yet
  }
  const uniqueExercisePRCount = prExerciseSet.size;

  // Nutrition data
  let nutritionDaysLogged = 0;
  let nutritionConsecutiveDays = 0;
  let nutritionGoalDays = 0;

  try {
    const mealEntries = await dbGetAll<Record<string, unknown>>(STORES.NUTRITION_LOGS);
    const nutritionDates = mealEntries
      .map((e) => e.date as string | undefined)
      .filter((d): d is string => typeof d === 'string' && d.length > 0);

    const uniqueNutritionDates = [...new Set(nutritionDates)].sort();
    nutritionDaysLogged = uniqueNutritionDates.length;
    nutritionConsecutiveDays = countMaxConsecutiveDays(uniqueNutritionDates);

    // Count days where protein goal was met in the last 7 days
    const today = new Date();
    const sevenDaysAgo = new Date(today);
    sevenDaysAgo.setDate(today.getDate() - 6);
    const sevenDaysAgoStr = sevenDaysAgo.toISOString().split('T')[0] ?? '';

    const recentEntries = mealEntries.filter((e) => {
      const date = e.date as string | undefined;
      return typeof date === 'string' && date >= sevenDaysAgoStr;
    });

    // Aggregate protein per date
    const proteinByDate = new Map<string, number>();
    recentEntries.forEach((e) => {
      const date = e.date as string;
      const macros = e.totalMacros as Record<string, number> | undefined;
      const protein = macros?.protein ?? 0;
      proteinByDate.set(date, (proteinByDate.get(date) ?? 0) + protein);
    });

    // Assume a protein goal of 150g per day (common baseline)
    const proteinGoal = 150;
    proteinByDate.forEach((protein) => {
      if (protein >= proteinGoal) {
        nutritionGoalDays++;
      }
    });
  } catch {
    // Store may not have data yet
  }

  return {
    totalWorkouts,
    totalVolume,
    currentStreak: streak.currentStreak,
    longestStreak: streak.longestStreak,
    totalPRs,
    uniqueExercisePRCount,
    nutritionDaysLogged,
    nutritionConsecutiveDays,
    nutritionGoalDays,
    workoutsThisWeek: streak.workoutsThisWeek,
    totalSets,
    totalDurationHours,
    uniqueMuscleGroups,
    hasFridayWorkout,
    hasSaturdayWorkout,
  };
}

// ============================================================================
// Achievement Functions
// ============================================================================

export const getAchievements = async (
  sessions: WorkoutSession[] = [],
  streak?: StreakInfo
): Promise<Achievement[]> => {
  // If no streak provided, compute it from sessions
  const effectiveStreak = streak ?? calculateStreak(sessions);

  const evalData = await buildEvaluationData(sessions, effectiveStreak);
  const unlockedIds = getUnlockedIds();
  const timestamps = getUnlockedTimestamps();

  return ACHIEVEMENT_DEFINITIONS.map((def) => {
    const progress = def.evaluate(evalData);
    const isUnlocked = unlockedIds.has(def.id);

    return {
      id: def.id,
      name: def.name,
      description: def.description,
      icon: def.icon,
      category: def.category,
      unlockedAt: isUnlocked ? (timestamps.get(def.id) ?? null) : null,
      progress: Math.min(progress, def.target),
      target: def.target,
    };
  });
};

export const checkAchievements = async (
  sessions: WorkoutSession[] = [],
  streak?: StreakInfo
): Promise<Achievement[]> => {
  const effectiveStreak = streak ?? calculateStreak(sessions);

  const evalData = await buildEvaluationData(sessions, effectiveStreak);
  const unlockedIds = getUnlockedIds();
  const timestamps = getUnlockedTimestamps();
  const now = new Date().toISOString();

  const newlyUnlocked: Achievement[] = [];
  const newTimestamps = new Map(timestamps);
  let idsChanged = false;

  ACHIEVEMENT_DEFINITIONS.forEach((def) => {
    if (unlockedIds.has(def.id)) return;

    const progress = def.evaluate(evalData);
    if (progress >= def.target) {
      unlockedIds.add(def.id);
      newTimestamps.set(def.id, now);
      idsChanged = true;

      newlyUnlocked.push({
        id: def.id,
        name: def.name,
        description: def.description,
        icon: def.icon,
        category: def.category,
        unlockedAt: now,
        progress: def.target,
        target: def.target,
      });
    }
  });

  if (idsChanged) {
    persistUnlockedIds(unlockedIds, newTimestamps);
  }

  return newlyUnlocked;
};

export const unlockAchievement = async (achievementId: string): Promise<void> => {
  const unlockedIds = getUnlockedIds();
  if (unlockedIds.has(achievementId)) return;

  unlockedIds.add(achievementId);
  const timestamps = getUnlockedTimestamps();
  timestamps.set(achievementId, new Date().toISOString());

  persistUnlockedIds(unlockedIds, timestamps);
};

// ============================================================================
// Streak Calculation
// ============================================================================

export const calculateStreak = (sessions: WorkoutSession[]): StreakInfo => {
  if (sessions.length === 0) {
    return {
      currentStreak: 0,
      longestStreak: 0,
      lastWorkoutDate: null,
      workoutsThisWeek: 0,
    };
  }

  // Sort sessions by date (newest first)
  const sortedSessions = [...sessions].sort(
    (a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime()
  );

  const lastWorkoutDate = sortedSessions[0]?.startTime ?? null;

  // Count workouts this week
  const now = new Date();
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - now.getDay());
  weekStart.setHours(0, 0, 0, 0);

  const workoutsThisWeek = sortedSessions.filter((s) => new Date(s.startTime) >= weekStart).length;

  // Calculate current streak
  let currentStreak = 0;
  let longestStreak = 0;
  let tempStreak = 0;

  // Get unique workout dates
  const workoutDates = sortedSessions.map((s) => {
    const d = new Date(s.startTime);
    return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
  });
  const uniqueDates = [...new Set(workoutDates)].sort().reverse();

  // Calculate streak
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  for (let i = 0; i < uniqueDates.length; i++) {
    const dateStr = uniqueDates[i];
    if (!dateStr) continue;
    const date = new Date(dateStr);
    const expectedDate = new Date(today);
    expectedDate.setDate(today.getDate() - i);

    if (date.toDateString() === expectedDate.toDateString()) {
      tempStreak++;
      if (i === 0) currentStreak = tempStreak;
    } else {
      longestStreak = Math.max(longestStreak, tempStreak);
      tempStreak = 1;
    }
  }

  longestStreak = Math.max(longestStreak, tempStreak, currentStreak);

  return {
    currentStreak,
    longestStreak,
    lastWorkoutDate,
    workoutsThisWeek,
  };
};

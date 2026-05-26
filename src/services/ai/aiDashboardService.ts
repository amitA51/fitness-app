// ============================================================================
// AI Dashboard Service - Automatic, comprehensive fitness analysis
// ============================================================================
// Collects data from ALL app modules (workouts, nutrition, recovery, weight,
// water) and sends it to the AI for a personalized dashboard insight.
// Called once on dashboard load and on pull-to-refresh.
// ============================================================================

import type { WorkoutSession } from '../../types';
import { safeJsonParse } from '../../utils/safeJson';
import { type ChatMessage, getAIProvider } from './core';

// ----------------------------------------------------------------------------
// TYPES
// ----------------------------------------------------------------------------

export interface AIDashboardInput {
  // Workouts
  totalWorkouts: number;
  workoutsThisWeek: number;
  weeklyVolume: number;
  volumeTrend: 'increasing' | 'decreasing' | 'stable';
  streakDays: number;
  avgWorkoutDurationMin: number;
  topExercises: Array<{ name: string; count: number }>;
  weakMuscles: string[];
  muscleCoverage: string[];

  // Recovery
  recoveryScore: number | null;
  avgSleepHours: number | null;
  avgEnergy: number | null;
  avgStress: number | null;
  soreAreas: string[];

  // Nutrition
  avgDailyCalories: number | null;
  avgDailyProtein: number | null;
  proteinGoal: number | null;
  calorieGoal: number | null;
  nutritionAdherence: number | null; // 0-100%

  // Body
  latestWeight: number | null;
  weightTrend: 'עלייה' | 'ירידה' | 'יציב' | null;
  weightChange: number | null;

  // Water
  avgDailyWaterMl: number | null;
  waterGoalMl: number | null;

  // Progression
  exercisesReadyToIncrease: number;
  exercisesNeedingDeload: number;
}

export interface AIDashboardInsight {
  fitnessScore: number; // 0-100
  fitnessLabel: string; // e.g., "מתקדם", "בינוני", "מתחיל"
  mainRecommendation: string; // 1-2 sentences
  tips: string[]; // 2-3 short tips
  focusArea: string; // what to focus on next
}

// ----------------------------------------------------------------------------
// DATA COLLECTION
// ----------------------------------------------------------------------------

export async function collectDashboardData(sessions: WorkoutSession[]): Promise<AIDashboardInput> {
  const now = Date.now();
  const oneWeekAgo = new Date(now - 7 * 86400000);
  const twoWeeksAgo = new Date(now - 14 * 86400000);
  const thirtyDaysAgo = new Date(now - 30 * 86400000);

  const completed = sessions.filter((s) => s.status === 'completed');

  // Workouts
  const thisWeekSessions = completed.filter((s) => new Date(s.startTime) >= oneWeekAgo);
  const prevWeekSessions = completed.filter((s) => {
    const d = new Date(s.startTime);
    return d >= twoWeeksAgo && d < oneWeekAgo;
  });

  const weeklyVolume = thisWeekSessions.reduce((sum, s) => sum + (s.totalVolume || 0), 0);
  const prevVolume = prevWeekSessions.reduce((sum, s) => sum + (s.totalVolume || 0), 0);

  let volumeTrend: AIDashboardInput['volumeTrend'] = 'stable';
  if (prevVolume > 0) {
    const change = (weeklyVolume - prevVolume) / prevVolume;
    if (change > 0.05) volumeTrend = 'increasing';
    else if (change < -0.05) volumeTrend = 'decreasing';
  }

  // Top exercises
  const exerciseCounts = new Map<string, { name: string; count: number }>();
  completed.slice(0, 30).forEach((s) =>
    (s.exercises || []).forEach((ex) => {
      const name = ex.exerciseName || ex.name || '';
      if (!name) return;
      const key = ex.exerciseId || name;
      const entry = exerciseCounts.get(key) || { name, count: 0 };
      entry.count += 1;
      exerciseCounts.set(key, entry);
    })
  );
  const topExercises = Array.from(exerciseCounts.values())
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  // Muscle coverage & weak muscles
  const muscleVolumes = new Map<string, number>();
  completed.slice(0, 20).forEach((s) =>
    (s.exercises || []).forEach((ex) => {
      const muscle = ex.muscleGroup || ex.targetMuscle;
      if (!muscle) return;
      const vol = (ex.sets || []).reduce(
        (sum, set) => sum + (set.weight || 0) * (set.reps || 0),
        0
      );
      muscleVolumes.set(muscle, (muscleVolumes.get(muscle) || 0) + vol);
    })
  );

  const muscleCoverage = Array.from(muscleVolumes.keys());
  const volumes = Array.from(muscleVolumes.values());
  const avgVol = volumes.length > 0 ? volumes.reduce((a, b) => a + b, 0) / volumes.length : 0;
  const weakMuscles = Array.from(muscleVolumes.entries())
    .filter(([, v]) => v < avgVol * 0.7)
    .map(([m]) => m);

  // Streak
  const uniqueDates = [...new Set(completed.map((s) => s.date))].filter(Boolean).sort().reverse();
  let streakDays = 0;
  if (uniqueDates.length > 0) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    for (let i = 0; i < uniqueDates.length; i++) {
      const d = new Date(uniqueDates[i]!);
      const expected = new Date(today);
      expected.setDate(today.getDate() - i);
      if (d.toDateString() === expected.toDateString()) streakDays++;
      else break;
    }
  }

  // Avg duration
  const recent30 = completed.filter(
    (s) => new Date(s.startTime).getTime() >= thirtyDaysAgo.getTime()
  );
  const avgWorkoutDurationMin =
    recent30.length > 0
      ? Math.round(recent30.reduce((sum, s) => sum + (s.duration || 0), 0) / recent30.length / 60)
      : 0;

  // Progression summary
  let exercisesReadyToIncrease = 0;
  let exercisesNeedingDeload = 0;
  recent30.slice(0, 10).forEach((s) => {
    (s.exercises || []).forEach((ex) => {
      const sets = (ex.sets || []).filter((set) => !set.isWarmup && set.isCompleted);
      if (sets.length === 0) return;
      const lastSets = sets.slice(-3);
      const avgReps = lastSets.reduce((s, set) => s + set.reps, 0) / lastSets.length;
      const allEasy = lastSets.every((set) => set.reps >= avgReps && (set.rpe || 7) <= 7);
      const allHard = lastSets.every((set) => (set.rpe || 5) >= 9 || set.reps < avgReps * 0.8);
      if (allEasy) exercisesReadyToIncrease++;
      if (allHard) exercisesNeedingDeload++;
    });
  });

  // Recovery (from bodyStatsService)
  let recoveryScore: number | null = null;
  let avgSleepHours: number | null = null;
  let avgEnergy: number | null = null;
  let avgStress: number | null = null;
  let soreAreas: string[] = [];

  try {
    const { getRecoveryLogsByDateRange, calculateRecoveryScore } = await import(
      '../bodyStatsService'
    );
    const recLogs = await getRecoveryLogsByDateRange(
      oneWeekAgo.toISOString().split('T')[0] || '',
      new Date().toISOString().split('T')[0] || ''
    );
    if (recLogs.length > 0) {
      recoveryScore = Math.round(
        recLogs.reduce((s, l) => s + calculateRecoveryScore(l).overall, 0) / recLogs.length
      );
      avgSleepHours =
        Math.round((recLogs.reduce((s, l) => s + l.sleepHours, 0) / recLogs.length) * 10) / 10;
      avgEnergy =
        Math.round((recLogs.reduce((s, l) => s + l.energyLevel, 0) / recLogs.length) * 10) / 10;
      avgStress =
        Math.round((recLogs.reduce((s, l) => s + l.stressLevel, 0) / recLogs.length) * 10) / 10;
      const areaCounts = new Map<string, number>();
      recLogs.forEach((l) =>
        (l.tightAreas || []).forEach((a) => areaCounts.set(a, (areaCounts.get(a) || 0) + 1))
      );
      soreAreas = Array.from(areaCounts.entries())
        .filter(([, c]) => c >= 2)
        .map(([a]) => a);
    }
  } catch {
    // Recovery module not available
  }

  // Nutrition
  let avgDailyCalories: number | null = null;
  let avgDailyProtein: number | null = null;
  let proteinGoal: number | null = null;
  let calorieGoal: number | null = null;
  let nutritionAdherence: number | null = null;

  try {
    const { getWeeklyNutritionSummary, DEFAULT_MACRO_GOALS } = await import('../nutritionService');
    calorieGoal = DEFAULT_MACRO_GOALS.calories;
    proteinGoal = DEFAULT_MACRO_GOALS.protein;
    const summary = await getWeeklyNutritionSummary();
    const daysWithMeals = summary.filter((d) => d.mealCount > 0);
    if (daysWithMeals.length > 0) {
      avgDailyCalories = Math.round(
        daysWithMeals.reduce((s, d) => s + d.macros.calories, 0) / daysWithMeals.length
      );
      avgDailyProtein = Math.round(
        daysWithMeals.reduce((s, d) => s + d.macros.protein, 0) / daysWithMeals.length
      );
      if (calorieGoal > 0) {
        nutritionAdherence = Math.round(
          daysWithMeals.reduce((s, d) => {
            const pct = Math.min(100, (d.macros.calories / calorieGoal!) * 100);
            return s + pct;
          }, 0) / daysWithMeals.length
        );
      }
    }
  } catch {
    // Nutrition module not available
  }

  // Body weight
  let latestWeight: number | null = null;
  let weightTrend: AIDashboardInput['weightTrend'] = null;
  let weightChange: number | null = null;

  try {
    const { getBodyWeightsByDateRange, calculateWeightTrend } = await import('../bodyStatsService');
    const weekAgoStr = oneWeekAgo.toISOString().split('T')[0] || '';
    const todayStr = new Date().toISOString().split('T')[0] || '';
    const weights = await getBodyWeightsByDateRange(weekAgoStr, todayStr);
    if (weights.length > 0) {
      const trend = calculateWeightTrend(weights);
      latestWeight = weights[weights.length - 1]?.weight ?? null;
      weightTrend = trend.direction;
      weightChange = trend.change;
    }
  } catch {
    // Body stats module not available
  }

  // Water
  let avgDailyWaterMl: number | null = null;
  let waterGoalMl: number | null = null;

  try {
    const { getWaterByDateRange, getWaterGoal } = await import('../waterService');
    waterGoalMl = getWaterGoal();
    const weekAgoStr = oneWeekAgo.toISOString().split('T')[0] || '';
    const todayStr = new Date().toISOString().split('T')[0] || '';
    const waterEntries = await getWaterByDateRange(weekAgoStr, todayStr);
    const waterByDay = new Map<string, number>();
    waterEntries.forEach((e) => waterByDay.set(e.date, (waterByDay.get(e.date) || 0) + e.amountMl));
    const waterDays = Array.from(waterByDay.values());
    if (waterDays.length > 0) {
      avgDailyWaterMl = Math.round(waterDays.reduce((a, b) => a + b, 0) / waterDays.length);
    }
  } catch {
    // Water module not available
  }

  return {
    totalWorkouts: completed.length,
    workoutsThisWeek: thisWeekSessions.length,
    weeklyVolume,
    volumeTrend,
    streakDays,
    avgWorkoutDurationMin,
    topExercises,
    weakMuscles,
    muscleCoverage,
    recoveryScore,
    avgSleepHours,
    avgEnergy,
    avgStress,
    soreAreas,
    avgDailyCalories,
    avgDailyProtein,
    proteinGoal,
    calorieGoal,
    nutritionAdherence,
    latestWeight,
    weightTrend,
    weightChange,
    avgDailyWaterMl,
    waterGoalMl,
    exercisesReadyToIncrease,
    exercisesNeedingDeload,
  };
}

// ----------------------------------------------------------------------------
// AI ANALYSIS
// ----------------------------------------------------------------------------

function buildDashboardPrompt(data: AIDashboardInput): string {
  const lines: string[] = [];

  lines.push('נתוני המתאמן המלאים:');

  // Workouts
  lines.push('\n[אימונים]');
  lines.push(`- סה"כ אימונים: ${data.totalWorkouts}`);
  lines.push(`- אימונים השבוע: ${data.workoutsThisWeek}`);
  lines.push(`- נפח שבועי: ${data.weeklyVolume} ק"ג`);
  lines.push(`- מגמת נפח: ${data.volumeTrend}`);
  lines.push(`- רצף: ${data.streakDays} ימים`);
  lines.push(`- ממוצע אורך אימון: ${data.avgWorkoutDurationMin} דקות`);
  if (data.topExercises.length > 0) {
    lines.push(
      `- תרגילים מובילים: ${data.topExercises.map((e) => `${e.name}(${e.count}x)`).join(', ')}`
    );
  }
  if (data.weakMuscles.length > 0) {
    lines.push(`- שרירים חלשים: ${data.weakMuscles.join(', ')}`);
  }
  if (data.exercisesReadyToIncrease > 0) {
    lines.push(`- תרגילים מוכנים לעלייה במשקל: ${data.exercisesReadyToIncrease}`);
  }
  if (data.exercisesNeedingDeload > 0) {
    lines.push(`- תרגילים שצריכים דלוד: ${data.exercisesNeedingDeload}`);
  }

  // Recovery
  lines.push('\n[התאוששות]');
  if (data.recoveryScore !== null) lines.push(`- ציון התאוששות: ${data.recoveryScore}/100`);
  if (data.avgSleepHours !== null) lines.push(`- שינה ממוצעת: ${data.avgSleepHours} שעות`);
  if (data.avgEnergy !== null) lines.push(`- אנרגיה ממוצעת: ${data.avgEnergy}/5`);
  if (data.avgStress !== null) lines.push(`- סטרס ממוצע: ${data.avgStress}/5`);
  if (data.soreAreas.length > 0) lines.push(`- אזורים כואבים: ${data.soreAreas.join(', ')}`);

  // Nutrition
  lines.push('\n[תזונה]');
  if (data.avgDailyCalories !== null)
    lines.push(`- קלוריות יומיות ממוצעות: ${data.avgDailyCalories}`);
  if (data.calorieGoal !== null) lines.push(`- יעד קלוריות: ${data.calorieGoal}`);
  if (data.avgDailyProtein !== null) lines.push(`- חלבון יומי ממוצע: ${data.avgDailyProtein}ג`);
  if (data.proteinGoal !== null) lines.push(`- יעד חלבון: ${data.proteinGoal}ג`);
  if (data.nutritionAdherence !== null) lines.push(`- עמידה בתזונה: ${data.nutritionAdherence}%`);

  // Body
  lines.push('\n[גוף]');
  if (data.latestWeight !== null) lines.push(`- משקל נוכחי: ${data.latestWeight} ק"ג`);
  if (data.weightTrend !== null) lines.push(`- מגמת משקל: ${data.weightTrend}`);
  if (data.weightChange !== null) lines.push(`- שינוי משקל: ${data.weightChange} ק"ג`);

  // Water
  lines.push('\n[מים]');
  if (data.avgDailyWaterMl !== null) lines.push(`- מים יומיים ממוצע: ${data.avgDailyWaterMl} מ"ל`);
  if (data.waterGoalMl !== null) lines.push(`- יעד מים: ${data.waterGoalMl} מ"ל`);

  return lines.join('\n');
}

// ----------------------------------------------------------------------------
// CACHE + RATE LIMIT (cost protection)
// ----------------------------------------------------------------------------

const CACHE_KEY = 'ai_dashboard_insight_cache';
const MIN_INTERVAL_MS = 60_000; // 60 s between live calls
const CACHE_TTL_MS = 30 * 60_000; // 30 min freshness

interface CachedInsight {
  insight: AIDashboardInsight;
  fingerprint: string;
  fetchedAt: number;
}

function fingerprintInput(data: AIDashboardInput): string {
  return JSON.stringify({
    tw: data.totalWorkouts,
    ww: data.workoutsThisWeek,
    wv: Math.round(data.weeklyVolume),
    vt: data.volumeTrend,
    sd: data.streakDays,
    rs: data.recoveryScore,
    ad: data.avgDailyCalories,
    ap: data.avgDailyProtein,
    lw: data.latestWeight,
    et: data.exercisesReadyToIncrease,
    ed: data.exercisesNeedingDeload,
  });
}

function readCache(): CachedInsight | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    const parsed = safeJsonParse<CachedInsight>(raw);
    if (!parsed || typeof parsed.fetchedAt !== 'number') return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeCache(entry: CachedInsight): void {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(entry));
  } catch {
    // quota — fail open
  }
}

let lastCallAt = 0;

export async function getAIDashboardInsight(data: AIDashboardInput): Promise<AIDashboardInsight> {
  const fp = fingerprintInput(data);
  const now = Date.now();
  const cached = readCache();

  if (cached && cached.fingerprint === fp && now - cached.fetchedAt < CACHE_TTL_MS) {
    return cached.insight;
  }

  if (now - lastCallAt < MIN_INTERVAL_MS) {
    if (cached) return cached.insight;
    return generateFallbackInsight(data);
  }

  lastCallAt = now;
  const provider = getAIProvider();

  const messages: ChatMessage[] = [
    {
      role: 'system',
      content: `אתה מאמן כושר AI שמנתח את כל הנתונים של המתאמן ונותן תובנות מדויקות.

עליך להחזיר תשובה בפורמט הבא בדיוק (בעברית):

SCORE: [מספר בין 0-100]
LABEL: [מילה אחת: מתחיל / בינוני / מתקדם / מקצוען]
RECOMMENDATION: [1-2 משפטים עם ההמלצה הכי חשובה לאימון הבא]
TIP: [טיפ קצר אחד]
TIP: [טיפ קצר נוסף]
TIP: [טיפ קצר נוסף]
FOCUS: [תחום אחד להתמקד בו: כוח / היפרטרופיה / התאוששות / תזונה / עקביות / טכניקה / גמישות]

כללים:
- תן ציון כושר ריאלי (לא מחמיא, לא מקטר)
- ההמלצה צריכה להיות הדבר הכי קריטי שהמתאמן צריך לעשות
- הטיפים צריכים להיות שונים זה מזה (לא 3 טיפים על אותו נושא)
- אם יש פער בין שרירים חלשים לחזקים - התייחס לזה
- אם ההתאוששות נמוכה - זה צריך להיות הפוקוס
- אם התזונה לא מספיקה - תזכיר
- ענה רק בפורמט המבוקש, בלי טקסט נוסף`,
    },
    {
      role: 'user',
      content: buildDashboardPrompt(data),
    },
  ];

  try {
    const response = await provider.chat(messages);
    const insight = parseDashboardResponse(response);
    writeCache({ insight, fingerprint: fp, fetchedAt: Date.now() });
    return insight;
  } catch (_error) {
    return generateFallbackInsight(data);
  }
}

// ----------------------------------------------------------------------------
// RESPONSE PARSING
// ----------------------------------------------------------------------------

function parseDashboardResponse(response: string): AIDashboardInsight {
  const getLine = (prefix: string): string | null => {
    const match = response.match(new RegExp(`${prefix}\\s*:?\\s*(.+)`, 'i'));
    return match?.[1]?.trim() || null;
  };

  const getAllLines = (prefix: string): string[] => {
    const regex = new RegExp(`${prefix}\\s*:?\\s*(.+)`, 'gi');
    const results: string[] = [];
    let match: RegExpExecArray | null = regex.exec(response);
    while (match !== null) {
      if (match[1]) results.push(match[1].trim());
      match = regex.exec(response);
    }
    return results;
  };

  const score = Number.parseInt(getLine('SCORE') || '50', 10);
  const label = getLine('LABEL') || 'בינוני';
  const recommendation = getLine('RECOMMENDATION') || 'המשך להתאמן בעקביות.';
  const tips = getAllLines('TIP').slice(0, 3);
  const focus = getLine('FOCUS') || 'עקביות';

  return {
    fitnessScore: Math.max(0, Math.min(100, Number.isNaN(score) ? 50 : score)),
    fitnessLabel: label,
    mainRecommendation: recommendation,
    tips: tips.length > 0 ? tips : ['שמור על עקביות באימונים'],
    focusArea: focus,
  };
}

// ----------------------------------------------------------------------------
// FALLBACK (rule-based, no AI needed)
// ----------------------------------------------------------------------------

function generateFallbackInsight(data: AIDashboardInput): AIDashboardInsight {
  let score = 50;
  const tips: string[] = [];
  let recommendation = 'המשך להתאמן בעקביות.';
  let focus = 'עקביות';

  // Score based on streak
  if (data.streakDays >= 7) score += 15;
  else if (data.streakDays >= 3) score += 8;

  // Score based on weekly workouts
  if (data.workoutsThisWeek >= 4) score += 15;
  else if (data.workoutsThisWeek >= 3) score += 10;
  else if (data.workoutsThisWeek >= 2) score += 5;

  // Volume trend
  if (data.volumeTrend === 'increasing') score += 10;
  else if (data.volumeTrend === 'decreasing') score -= 5;

  // Recovery
  if (data.recoveryScore !== null) {
    if (data.recoveryScore >= 75) score += 10;
    else if (data.recoveryScore < 40) {
      score -= 10;
      tips.push('ציון התאוששות נמוך - שקול יום מנוחה');
      focus = 'התאוששות';
    }
  }

  // Nutrition
  if (data.nutritionAdherence !== null) {
    if (data.nutritionAdherence >= 80) score += 5;
    else if (data.nutritionAdherence < 50) {
      tips.push('התזונה לא מספיק עקבית - נסה לתכנן ארוחות מראש');
    }
  }

  if (data.avgDailyProtein !== null && data.proteinGoal !== null) {
    if (data.avgDailyProtein < data.proteinGoal * 0.8) {
      tips.push('חלבון נמוך - כדאי להוסיף מקור חלבון לכל ארוחה');
    }
  }

  // Weak muscles
  if (data.weakMuscles.length > 0) {
    tips.push(`שרירים חלשים: ${data.weakMuscles.slice(0, 2).join(', ')} - כדאי לתת להם עדיפות`);
  }

  // Volume recommendation
  if (data.exercisesReadyToIncrease > 0) {
    recommendation = `${data.exercisesReadyToIncrease} תרגילים מוכנים לעלייה במשקל. זה הזמן להתקדם.`;
    focus = 'כוח';
  } else if (data.exercisesNeedingDeload > 0) {
    recommendation = `${data.exercisesNeedingDeload} תרגילים מראים סימני עייפות. שקול שבוע קל יותר.`;
    focus = 'התאוששות';
  }

  // Water
  if (data.avgDailyWaterMl !== null && data.waterGoalMl !== null) {
    if (data.avgDailyWaterMl < data.waterGoalMl * 0.6) {
      tips.push('שתייה לא מספיקה - כוון ל-3 ליטר ביום');
    }
  }

  score = Math.max(0, Math.min(100, score));

  let label = 'מתחיל';
  if (score >= 80) label = 'מקצוען';
  else if (score >= 60) label = 'מתקדם';
  else if (score >= 40) label = 'בינוני';

  return {
    fitnessScore: score,
    fitnessLabel: label,
    mainRecommendation: recommendation,
    tips:
      tips.length > 0
        ? tips.slice(0, 3)
        : ['שמור על עקביות באימונים', 'שתה מספיק מים', 'שן 7-8 שעות'],
    focusArea: focus,
  };
}

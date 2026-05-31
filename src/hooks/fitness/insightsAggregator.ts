/**
 * insightsAggregator - Pure single-pass aggregation for useFitnessInsights
 * Replaces multiple independent passes (streak, last-workout, muscle-days,
 * exercise-names, week-over-week, PRs) with a consolidated traversal.
 */

import type { WorkoutSession } from '../../types';
import { completedSetsVolume, setVolume } from '../../utils/workoutMath';

// Re-export types used by the hook (mirrors analyticsService shapes)
export interface LastWorkoutSummary {
  date: string;
  duration: number;
  exerciseCount: number;
  totalVolume: number;
  muscleGroups: string[];
}

export interface MuscleGroupLastTrained {
  muscle: string;
  lastDate: string | null;
  daysSince: number;
}

export interface ProgressDelta {
  exerciseName: string;
  exerciseId: string;
  currentVolume: number;
  previousVolume: number;
  change: number;
}

export interface PersonalRecordEntry {
  id: string;
  exerciseId: string;
  exerciseName: string;
  date: string;
  weight: number;
  reps: number;
  type: 'weight' | 'volume';
  maxWeight?: number;
  value?: number;
}

export interface AggregatedInsights {
  readonly currentStreak: number;
  readonly longestStreak: number;
  readonly totalWorkouts: number;
  readonly workoutsThisMonth: number;
  readonly workoutsThisWeek: number;
  readonly lastWorkout: LastWorkoutSummary | null;
  readonly muscleGroups: MuscleGroupLastTrained[];
  readonly neglectedMuscles: readonly string[];
  readonly allPRs: readonly PersonalRecordEntry[];
  readonly recentPRs: readonly PersonalRecordEntry[];
  readonly exerciseNames: readonly string[];
  /** Pre-computed week-over-week deltas for ALL exercises, keyed by exerciseName */
  readonly weekOverWeekMap: ReadonlyMap<string, readonly ProgressDelta[]>;
  /** Flat array of all deltas (for backward compat) */
  readonly allDeltas: readonly ProgressDelta[];
}

const EMPTY: AggregatedInsights = {
  currentStreak: 0,
  longestStreak: 0,
  totalWorkouts: 0,
  workoutsThisMonth: 0,
  workoutsThisWeek: 0,
  lastWorkout: null,
  muscleGroups: [],
  neglectedMuscles: [],
  allPRs: [],
  recentPRs: [],
  exerciseNames: [],
  weekOverWeekMap: new Map(),
  allDeltas: [],
};

/**
 * Single-pass (plus one sort for streak) aggregation over sessions.
 * Computes everything the hook needs from the session list.
 */
export function aggregateInsights(
  sessions: readonly WorkoutSession[],
  now: Date = new Date()
): AggregatedInsights {
  if (sessions.length === 0) return EMPTY;

  const nowMs = now.getTime();
  const weekAgoMs = nowMs - 7 * 24 * 60 * 60 * 1000;
  const monthAgoMs = nowMs - 30 * 24 * 60 * 60 * 1000;

  // Week-over-week boundaries
  const thisWeekStart = new Date(nowMs - 7 * 24 * 60 * 60 * 1000);
  const lastWeekStart = new Date(nowMs - 14 * 24 * 60 * 60 * 1000);
  const thisWeekStartStr = thisWeekStart.toISOString().split('T')[0] ?? '';
  const lastWeekStartStr = lastWeekStart.toISOString().split('T')[0] ?? '';

  // Accumulators
  const exerciseNameSet = new Set<string>();
  const muscleLastDate = new Map<string, string>();
  const prMap = new Map<string, PersonalRecordEntry>();
  const thisWeekVolumes = new Map<string, { name: string; volume: number }>();
  const lastWeekVolumes = new Map<string, { name: string; volume: number }>();

  let totalWorkouts = 0;
  let workoutsThisWeek = 0;
  let workoutsThisMonth = 0;
  let latestSession: WorkoutSession | null = null;
  let latestStartMs = 0;

  // Streak dates (unique YYYY-MM-DD from startTime)
  const streakDateSet = new Set<string>();

  // --- SINGLE PASS ---
  for (const session of sessions) {
    const isCompleted = session.status === 'completed' || Boolean(session.endTime);

    if (isCompleted) {
      totalWorkouts++;
      const startMs = new Date(session.startTime).getTime();
      if (startMs >= weekAgoMs) workoutsThisWeek++;
      if (startMs >= monthAgoMs) workoutsThisMonth++;

      if (startMs > latestStartMs) {
        latestStartMs = startMs;
        latestSession = session;
      }

      // Week-over-week volume
      const inThisWeek = session.date >= thisWeekStartStr;
      const inLastWeek = session.date >= lastWeekStartStr && session.date < thisWeekStartStr;

      for (const exercise of session.exercises) {
        exerciseNameSet.add(exercise.exerciseName);

        // Muscle last-trained
        const muscle = exercise.muscleGroup || exercise.targetMuscle;
        if (muscle) {
          const existing = muscleLastDate.get(muscle);
          if (!existing || session.date > existing) {
            muscleLastDate.set(muscle, session.date);
          }
        }

        // PRs (weight + volume)
        for (const set of exercise.sets) {
          if (!set.completedAt || set.isWarmup) continue;
          const key = exercise.exerciseId || exercise.id;

          if (set.weight > 0) {
            const wKey = `${key}-weight`;
            const existing = prMap.get(wKey);
            if (!existing || set.weight > existing.weight) {
              prMap.set(wKey, {
                id: crypto.randomUUID(),
                exerciseId: key,
                exerciseName: exercise.exerciseName || 'Unknown',
                date: session.date || session.startTime,
                weight: set.weight,
                reps: set.reps,
                type: 'weight',
                maxWeight: set.weight,
              });
            }
          }

          const vol = setVolume(set);
          if (vol > 0) {
            const vKey = `${key}-volume`;
            const existing = prMap.get(vKey);
            if (!existing || vol > (existing.value ?? 0)) {
              prMap.set(vKey, {
                id: crypto.randomUUID(),
                exerciseId: key,
                exerciseName: exercise.exerciseName || 'Unknown',
                date: session.date || session.startTime,
                weight: set.weight,
                reps: set.reps,
                type: 'volume',
                value: vol,
                maxWeight: set.weight,
              });
            }
          }
        }

        // Week-over-week exercise volumes
        if (inThisWeek || inLastWeek) {
          const exVol = completedSetsVolume(exercise.sets);
          const target = inThisWeek ? thisWeekVolumes : lastWeekVolumes;
          const existing = target.get(exercise.exerciseId);
          target.set(exercise.exerciseId, {
            name: exercise.exerciseName,
            volume: (existing?.volume || 0) + exVol,
          });
        }
      }
    }

    // Streak: collect unique dates from ALL sessions (matches achievementService)
    const d = new Date(session.startTime);
    const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    streakDateSet.add(dateStr);
  }

  // --- POST-PASS: streak computation (requires sorted unique dates) ---
  const { currentStreak, longestStreak } = computeStreak(streakDateSet, now);

  // --- POST-PASS: last workout summary ---
  let lastWorkout: LastWorkoutSummary | null = null;
  if (latestSession) {
    const muscles = new Set<string>();
    latestSession.exercises.forEach((e) => {
      const m = e.muscleGroup || e.targetMuscle;
      if (m) muscles.add(m);
    });
    let totalVolume = 0;
    for (const exercise of latestSession.exercises) {
      totalVolume += completedSetsVolume(exercise.sets);
    }
    lastWorkout = {
      date: latestSession.date,
      duration: latestSession.duration,
      exerciseCount: latestSession.exercises.length,
      totalVolume,
      muscleGroups: Array.from(muscles),
    };
  }

  // --- POST-PASS: muscle groups days-since ---
  const todayStr = now.toISOString().split('T')[0] ?? '';
  const todayMs = new Date(todayStr).getTime();
  const muscleGroups: MuscleGroupLastTrained[] = Array.from(muscleLastDate.entries()).map(
    ([muscle, date]) => ({
      muscle,
      lastDate: date,
      daysSince: Math.floor((todayMs - new Date(date).getTime()) / (1000 * 60 * 60 * 24)),
    })
  );
  const neglectedMuscles = muscleGroups.filter((mg) => mg.daysSince >= 7).map((mg) => mg.muscle);

  // --- POST-PASS: PRs ---
  const allPRs = Array.from(prMap.values());
  const weekAgoDate = new Date(weekAgoMs);
  const recentPRs = allPRs.filter((pr) => new Date(pr.date) >= weekAgoDate);

  // --- POST-PASS: week-over-week deltas ---
  const allExerciseIds = new Set([...thisWeekVolumes.keys(), ...lastWeekVolumes.keys()]);
  const allDeltas: ProgressDelta[] = [];
  const weekOverWeekMap = new Map<string, ProgressDelta[]>();

  for (const id of allExerciseIds) {
    const current = thisWeekVolumes.get(id);
    const previous = lastWeekVolumes.get(id);
    const currentVolume = current?.volume || 0;
    const previousVolume = previous?.volume || 0;
    const delta: ProgressDelta = {
      exerciseName: current?.name || previous?.name || 'Unknown',
      exerciseId: id,
      currentVolume,
      previousVolume,
      change:
        previousVolume > 0
          ? Math.round(((currentVolume - previousVolume) / previousVolume) * 100)
          : 0,
    };
    allDeltas.push(delta);
    const existing = weekOverWeekMap.get(delta.exerciseName) || [];
    existing.push(delta);
    weekOverWeekMap.set(delta.exerciseName, existing);
  }

  // --- Exercise names sorted ---
  const exerciseNames = Array.from(exerciseNameSet).sort();

  return {
    currentStreak,
    longestStreak,
    totalWorkouts,
    workoutsThisMonth,
    workoutsThisWeek,
    lastWorkout,
    muscleGroups,
    neglectedMuscles,
    allPRs,
    recentPRs,
    exerciseNames,
    weekOverWeekMap,
    allDeltas,
  };
}

/**
 * Streak computation from a set of unique date strings.
 * Mirrors achievementService.calculateStreak logic.
 */
export function computeStreak(
  dateSet: ReadonlySet<string>,
  now: Date
): { currentStreak: number; longestStreak: number } {
  if (dateSet.size === 0) return { currentStreak: 0, longestStreak: 0 };

  const uniqueDates = Array.from(dateSet).sort().reverse();

  const today = new Date(now);
  today.setHours(0, 0, 0, 0);

  let anchor = new Date(today);
  if (uniqueDates.length > 0) {
    const parts = (uniqueDates[0] as string).split('-').map(Number) as [number, number, number];
    const latestLocal = new Date(parts[0], parts[1] - 1, parts[2]);
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);
    if (latestLocal.getTime() === yesterday.getTime()) {
      anchor = yesterday;
    }
  }

  // currentStreak: consecutive days ending at anchor
  let currentStreak = 0;
  for (let i = 0; i < uniqueDates.length; i++) {
    const dateStr = uniqueDates[i];
    if (!dateStr) continue;
    const [y, m, d] = dateStr.split('-').map(Number) as [number, number, number];
    const date = new Date(y, m - 1, d);
    const expectedDate = new Date(anchor);
    expectedDate.setDate(anchor.getDate() - i);
    if (date.getTime() === expectedDate.getTime()) {
      currentStreak++;
    } else {
      break;
    }
  }

  // longestStreak: longest run of consecutive calendar days in sorted dates
  const sorted = Array.from(dateSet).sort(); // ascending
  let longestStreak = sorted.length > 0 ? 1 : 0;
  let run = 1;
  for (let i = 1; i < sorted.length; i++) {
    const [py, pm, pd] = (sorted[i - 1] as string).split('-').map(Number) as [
      number,
      number,
      number,
    ];
    const [cy, cm, cd] = (sorted[i] as string).split('-').map(Number) as [number, number, number];
    const prev = new Date(py, pm - 1, pd);
    const curr = new Date(cy, cm - 1, cd);
    const diff = curr.getTime() - prev.getTime();
    if (diff === 86400000) {
      run++;
    } else {
      run = 1;
    }
    longestStreak = Math.max(longestStreak, run);
  }

  return { currentStreak, longestStreak };
}

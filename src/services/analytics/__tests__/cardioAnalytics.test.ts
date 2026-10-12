import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { WorkoutExercise, WorkoutSession } from '../../../types';
import { buildCardioSession } from '../../../utils/cardio';
import { toLocalDateStr } from '../../../utils/dateUtils';
import { getLastWorkoutSummary, getMuscleGroupDaysSince } from '../insights';
import { countsTowardMuscleWork, isCardioMuscle } from '../shared';
import {
  calculateMuscleBalance,
  calculateWeeklyVolumes,
  forecastProgress,
  getExerciseProgress,
} from '../volumeMetrics';

const DAY = 24 * 60 * 60 * 1000;
const NOW = new Date(2026, 9, 14, 12, 0);

const run = (daysAgo: number, km = 8): WorkoutSession =>
  buildCardioSession(
    {
      activity: 'run',
      startTime: new Date(NOW.getTime() - daysAgo * DAY).toISOString(),
      durationSec: km * 330,
      distanceKm: km,
    },
    NOW.getTime()
  );

const liftExercise = (
  id: string,
  muscle: string,
  weight: number,
  iso: string,
  name = `${muscle} Lift`
): WorkoutExercise => ({
  id,
  exerciseId: `${name}-id`,
  exerciseName: name,
  targetMuscle: muscle,
  muscleGroup: muscle,
  notes: '',
  restSeconds: 90,
  isCompleted: true,
  order: 0,
  sets: [1, 2, 3].map((n) => ({
    id: `${id}-s${n}`,
    setNumber: n,
    reps: 10,
    weight,
    rpe: null,
    isWarmup: false,
    isCompleted: true,
    notes: '',
    completedAt: iso,
  })),
});

const lift = (id: string, daysAgo: number, extra: WorkoutExercise[] = []): WorkoutSession => {
  const start = new Date(NOW.getTime() - daysAgo * DAY);
  const iso = start.toISOString();
  return {
    id,
    date: toLocalDateStr(start),
    startTime: iso,
    endTime: iso,
    duration: 3600,
    status: 'completed',
    templateId: null,
    notes: '',
    rating: null,
    totalVolume: 6000,
    caloriesBurned: null,
    createdAt: iso,
    updatedAt: iso,
    exercises: [
      liftExercise(`${id}-chest`, 'Chest', 100, iso),
      liftExercise(`${id}-back`, 'Back', 100, iso),
      ...extra,
    ],
  };
};

/** A strength session that opens with a treadmill warm-up. */
const liftWithWarmUp = (id: string, daysAgo: number): WorkoutSession => {
  const base = lift(id, daysAgo);
  const treadmill = buildCardioSession({
    activity: 'treadmill',
    startTime: base.startTime,
    durationSec: 600,
    distanceKm: 1.6,
  }).exercises;
  return { ...base, exercises: [...treadmill, ...base.exercises] };
};

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
});

afterEach(() => {
  vi.useRealTimers();
});

describe('cardio is not a muscle', () => {
  it('recognises the Cardio bucket in English and Hebrew', () => {
    expect(isCardioMuscle('Cardio')).toBe(true);
    expect(isCardioMuscle('קרדיו')).toBe(true);
    expect(isCardioMuscle('Chest')).toBe(false);
    expect(isCardioMuscle(undefined)).toBe(false);
  });

  it('keeps lifts, drops cardio efforts and Cardio-group moves', () => {
    const iso = NOW.toISOString();
    expect(countsTowardMuscleWork(liftExercise('a', 'Legs', 100, iso))).toBe(true);
    expect(countsTowardMuscleWork(run(1).exercises[0]!)).toBe(false);
    expect(countsTowardMuscleWork(liftExercise('b', 'Cardio', 0, iso, 'Burpee'))).toBe(false);
  });
});

describe('calculateMuscleBalance with cardio', () => {
  it('a run or a warm-up never creates a weak "Cardio" finding', () => {
    const sessions = [liftWithWarmUp('a', 2), run(4), lift('b', 6), run(8)];
    const balance = calculateMuscleBalance(sessions);
    expect(balance.map((m) => m.muscle).sort()).toEqual(['Back', 'Chest']);
    expect(balance.some((m) => m.isWeak)).toBe(false);
  });

  it('a burpee filed under Cardio is not flagged weak either', () => {
    const iso = new Date(NOW.getTime() - DAY).toISOString();
    const sessions = [lift('a', 1, [liftExercise('burpee', 'Cardio', 0, iso, 'Burpee')])];
    expect(calculateMuscleBalance(sessions).map((m) => m.muscle)).not.toContain('Cardio');
  });

  it('cardio-only sessions do not dilute the trend into a false "down"', () => {
    // Equal lifting every time; runs only in the newer half of the window.
    const sessions = [lift('a', 12), lift('b', 9), lift('c', 5), run(4), run(3), lift('d', 2)];
    const balance = calculateMuscleBalance(sessions);
    expect(balance.every((m) => m.trend === 'stable')).toBe(true);
  });
});

describe('weekly volume and forecast with cardio', () => {
  it('counts a run as a session but adds no 0 kg muscle or exercise entry', () => {
    const weeks = calculateWeeklyVolumes([lift('a', 1), run(1), liftWithWarmUp('b', 2)]);
    const week = weeks.find((w) => w.sessionCount === 3);
    expect(week).toBeDefined();
    expect(Object.keys(week!.byMuscle).sort()).toEqual(['Back', 'Chest']);
    expect(Object.keys(week!.byExercise).sort()).toEqual(['Back Lift', 'Chest Lift']);
  });

  it('a cardio-only week is not a zero point in the volume forecast', () => {
    // Three lifting weeks, then a week of only runs.
    const sessions = [lift('a', 22), lift('b', 15), lift('c', 8), run(2), run(1)];
    const forecast = forecastProgress(sessions);
    expect(forecast.dataPoints.length).toBe(3);
    expect(forecast.dataPoints.every((p) => p.actual > 0)).toBe(true);
  });

  it('exercise progress for a cardio exercise yields no 0 kg points', () => {
    const r = run(1);
    const progress = getExerciseProgress([r, run(5)], r.exercises[0]!.exerciseId);
    expect(progress.dataPoints).toEqual([]);
  });
});

describe('insights helpers with cardio', () => {
  it('days-since never lists Cardio as a muscle to train', () => {
    const muscles = getMuscleGroupDaysSince([run(10), liftWithWarmUp('a', 1)]);
    expect(muscles.map((m) => m.muscle).sort()).toEqual(['Back', 'Chest']);
  });

  it('the last-workout summary of a warm-up session names only real muscles', () => {
    const summary = getLastWorkoutSummary([liftWithWarmUp('a', 1)]);
    expect(summary?.muscleGroups).toEqual(['Chest', 'Back']);
    expect(summary?.exerciseCount).toBe(3);
  });
});

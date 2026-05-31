import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { WorkoutExercise, WorkoutSession, WorkoutSet } from '../../types';
import { completedSetsVolume } from '../../utils/workoutMath';
import {
  calculateFrequency,
  calculateMuscleBalance,
  calculateStrengthProgression,
  calculateVolumeHistory,
  calculateWeeklyVolumes,
  forecastProgress,
  getLastWorkoutSummary,
  getMuscleGroupDaysSince,
} from '../analyticsService';

const set = (id: string, weight: number, reps: number): WorkoutSet => ({
  id,
  setNumber: 1,
  reps,
  weight,
  rpe: 8,
  isWarmup: false,
  isCompleted: true,
  notes: '',
  completedAt: '2026-01-01T10:00:00.000Z',
});

const mkSession = (id: string, date: string, sets: WorkoutSet[]): WorkoutSession => {
  const exercise: WorkoutExercise = {
    id: `w-${id}`,
    exerciseId: 'bench',
    exerciseName: 'Bench Press',
    targetMuscle: 'Chest',
    sets,
    notes: '',
    restSeconds: 120,
    isCompleted: true,
    order: 0,
  };
  return {
    id,
    date,
    startTime: `${date}T10:00:00.000Z`,
    endTime: `${date}T11:00:00.000Z`,
    exercises: [exercise],
    duration: 3600,
    status: 'completed',
    templateId: null,
    notes: '',
    rating: null,
    totalVolume: 0,
    caloriesBurned: null,
    createdAt: `${date}T10:00:00.000Z`,
    updatedAt: `${date}T11:00:00.000Z`,
  };
};

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-05-15T12:00:00Z'));
});

afterEach(() => {
  vi.useRealTimers();
});

describe('calculateStrengthProgression', () => {
  it('estimates 1RM per set, not from a mismatched max-weight / max-reps pair', () => {
    // Sets 100x3 and 60x12 in one session. Epley per set: max(110, 84) = 110.
    // The previous bug paired max weight (100) with max reps (12) => 140.
    const points = calculateStrengthProgression(
      [mkSession('s1', '2026-01-05', [set('a', 100, 3), set('b', 60, 12)])],
      'bench'
    );
    expect(points).toHaveLength(1);
    expect(points[0]?.estimated1RM).toBe(110);
    expect(points[0]?.volume).toBe(1020); // 100*3 + 60*12
  });
});

describe('forecastProgress', () => {
  it('clamps a steep downward trend to a non-negative prediction', () => {
    const sessions = [
      mkSession('s1', '2026-01-05', [set('a', 100, 10)]), // weekly volume 1000
      mkSession('s2', '2026-01-12', [set('b', 100, 3)]), // 300
      mkSession('s3', '2026-01-19', [set('c', 50, 1)]), // 50
    ];
    const result = forecastProgress(sessions, 'bench');
    expect(result.trend).toBe('decreasing');
    // Raw linear extrapolation here is negative (~ -500); must be clamped to 0.
    expect(result.predicted).toBe(0);
  });
});

describe('calculateStrengthProgression - completedSetsVolume equivalence', () => {
  it('volume equals completedSetsVolume for a known session', () => {
    const sets: WorkoutSet[] = [
      set('a', 80, 5),
      set('b', 80, 5),
      { ...set('c', 40, 10), isWarmup: true }, // warmup contributes 0
    ];
    const points = calculateStrengthProgression([mkSession('s1', '2026-02-01', sets)], 'bench');
    expect(points).toHaveLength(1);
    expect(points[0]?.volume).toBe(completedSetsVolume(sets));
    // 80*5 + 80*5 + 0 (warmup) = 800
    expect(points[0]?.volume).toBe(800);
  });
});

describe('calculateStrengthProgression - no data point for all-warmup/incomplete', () => {
  it('does not emit a data point when exercise has no completed working sets', () => {
    const warmupOnly: WorkoutSet[] = [
      { ...set('a', 40, 10), isWarmup: true },
      { ...set('b', 50, 5), isWarmup: true },
    ];
    const incomplete: WorkoutSet[] = [{ ...set('c', 80, 5), isCompleted: false }];
    const points = calculateStrengthProgression(
      [mkSession('s1', '2026-03-01', warmupOnly), mkSession('s2', '2026-03-02', incomplete)],
      'bench'
    );
    expect(points).toHaveLength(0);
  });
});

describe('calculateMuscleBalance - session-count normalization', () => {
  it('reports stable trend for equal-volume sessions with an odd split', () => {
    // Previous half: 2 sessions, each 80kg x 5 reps = 400 per session, total 800
    // Current half: 3 sessions, each 80kg x 5 reps = 400 per session, total 1200
    // Raw sum comparison: 1200 vs 800 = 50% up (false positive)
    // Per-session average: 400 vs 400 = 0% change => stable
    const makeSession = (id: string, date: string): WorkoutSession => {
      const exercise: WorkoutExercise = {
        id: `w-${id}`,
        exerciseId: 'squat',
        exerciseName: 'Squat',
        targetMuscle: 'Legs',
        sets: [set(`${id}-a`, 80, 5)],
        notes: '',
        restSeconds: 120,
        isCompleted: true,
        order: 0,
      };
      return {
        id,
        date,
        startTime: `${date}T10:00:00.000Z`,
        endTime: `${date}T11:00:00.000Z`,
        exercises: [exercise],
        duration: 3600,
        status: 'completed',
        templateId: null,
        notes: '',
        rating: null,
        totalVolume: 0,
        caloriesBurned: null,
        createdAt: `${date}T10:00:00.000Z`,
        updatedAt: `${date}T11:00:00.000Z`,
      };
    };

    // 5 sessions total: first 2 = previous half, last 3 = current half
    const sessions = [
      makeSession('p1', '2026-01-01'),
      makeSession('p2', '2026-01-03'),
      makeSession('c1', '2026-01-08'),
      makeSession('c2', '2026-01-10'),
      makeSession('c3', '2026-01-12'),
    ];

    const result = calculateMuscleBalance(sessions);
    const legs = result.find((m) => m.muscle === 'Legs');
    expect(legs).toBeDefined();
    expect(legs?.trend).toBe('stable');
  });
});

describe('forecastProgress - rSquared never negative', () => {
  it('returns non-negative confidence for a worse-than-mean fit', () => {
    // Alternating high/low volumes produce a poor linear fit
    const sessions = [
      mkSession('s1', '2026-01-05', [set('a', 100, 10)]), // 1000
      mkSession('s2', '2026-01-12', [set('b', 20, 1)]), // 20
      mkSession('s3', '2026-01-19', [set('c', 100, 10)]), // 1000
      mkSession('s4', '2026-01-26', [set('d', 20, 1)]), // 20
    ];
    const result = forecastProgress(sessions, 'bench');
    expect(result.confidence).toBeGreaterThanOrEqual(0);
  });
});

describe('getLastWorkoutSummary', () => {
  it('returns the latest session by startTime', () => {
    const sessions: WorkoutSession[] = [
      mkSession('s1', '2026-01-10', [set('a', 80, 5)]),
      mkSession('s2', '2026-01-15', [set('b', 90, 5)]),
      mkSession('s3', '2026-01-12', [set('c', 70, 5)]),
    ];
    // s2 has the latest date/startTime
    const result = getLastWorkoutSummary(sessions);
    expect(result).not.toBeNull();
    expect(result!.date).toBe('2026-01-15');
  });

  it('does not reorder the input array', () => {
    const sessions: WorkoutSession[] = [
      mkSession('s1', '2026-01-10', [set('a', 80, 5)]),
      mkSession('s2', '2026-01-15', [set('b', 90, 5)]),
      mkSession('s3', '2026-01-12', [set('c', 70, 5)]),
    ];
    const originalOrder = sessions.map((s) => s.id);
    getLastWorkoutSummary(sessions);
    expect(sessions.map((s) => s.id)).toEqual(originalOrder);
  });
});

describe('calculateWeeklyVolumes - output stability', () => {
  it('produces correct output for a known multi-week input', () => {
    const sessions: WorkoutSession[] = [
      mkSession('s1', '2026-01-06', [set('a', 100, 10)]), // Week 2: vol 1000
      mkSession('s2', '2026-01-07', [set('b', 50, 10)]), // Week 2: vol 500
      mkSession('s3', '2026-01-13', [set('c', 80, 5)]), // Week 3: vol 400
    ];
    const result = calculateWeeklyVolumes(sessions);
    expect(result).toHaveLength(2);
    // First week has 2 sessions
    expect(result[0]!.sessionCount).toBe(2);
    expect(result[0]!.totalVolume).toBe(1500);
    // Second week has 1 session
    expect(result[1]!.sessionCount).toBe(1);
    expect(result[1]!.totalVolume).toBe(400);
    // Change from previous
    expect(result[0]!.changeFromPrevious).toBeNull();
    expect(result[1]!.changeFromPrevious).toBe(-73); // (400-1500)/1500*100 = -73.33 => -73
  });
});

// ============================================================================
// Timezone fix tests: parseLocalDate prevents UTC-shift corruption
// ============================================================================

describe('calculateFrequency - local date parsing (timezone fix)', () => {
  it('counts a Sunday session (2026-01-04) on day index 0 (Sunday)', () => {
    // 2026-01-04 is a Sunday. Before the fix, `new Date('2026-01-04')` parses
    // as UTC midnight; in UTC+2/+3 timezones getDay() would return 6 (Saturday).
    const sessions: WorkoutSession[] = [mkSession('s1', '2026-01-04', [set('a', 80, 5)])];
    const freq = calculateFrequency(sessions);
    // HEBREW_DAYS[0] = 'א' (Sunday)
    const sunday = freq[0];
    expect(sunday?.count).toBe(1);
    // Saturday should be 0
    const saturday = freq[6];
    expect(saturday?.count).toBe(0);
  });

  it('counts a Monday session (2026-01-05) on day index 1 (Monday)', () => {
    // 2026-01-05 is a Monday.
    const sessions: WorkoutSession[] = [mkSession('s1', '2026-01-05', [set('a', 80, 5)])];
    const freq = calculateFrequency(sessions);
    const monday = freq[1];
    expect(monday?.count).toBe(1);
    const sunday = freq[0];
    expect(sunday?.count).toBe(0);
  });
});

describe('calculateVolumeHistory - week bucketing (timezone fix)', () => {
  it('buckets sessions near a week boundary into the correct ISO week', () => {
    // 2026-01-05 (Monday) is in ISO week 2026-W02.
    // 2026-01-04 (Sunday) is in ISO week 2026-W01.
    // Before the fix, UTC-shift could move Sunday into Saturday's week.
    const sessions: WorkoutSession[] = [
      mkSession('s1', '2026-01-04', [set('a', 60, 10)]), // Sunday -> W01
      mkSession('s2', '2026-01-05', [set('b', 80, 10)]), // Monday -> W02
    ];
    const result = calculateVolumeHistory(sessions, 52);
    expect(result).toHaveLength(2);
    expect(result[0]!.date).toBe('2026-W01');
    expect(result[1]!.date).toBe('2026-W02');
  });
});

describe('getMuscleGroupDaysSince - local today (timezone fix)', () => {
  it('returns 0 daysSince for a session dated today', () => {
    // Use the faked system time (2026-05-15T12:00:00Z)
    const now = new Date();
    const todayLocal = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const sessions: WorkoutSession[] = [mkSession('s1', todayLocal, [set('a', 80, 5)])];
    const result = getMuscleGroupDaysSince(sessions);
    expect(result).toHaveLength(1);
    expect(result[0]!.daysSince).toBe(0);
  });
});

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { PersonalRecord, WorkoutExercise, WorkoutSession, WorkoutSet } from '../../../types';
import {
  DEFAULT_RANGE,
  RANGE_DAYS,
  buildPRBoard,
  buildStrengthCurves,
  buildVolumeTrend,
  isRecentPR,
  onlyCompleted,
  recentPRs,
  sliceByRangeDays,
  summarizeWeeklyVolume,
  weekVerdict,
  weeklyCountDelta,
  weeklyVolumeDelta,
} from '../progressMetrics';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const mkSet = (id: string, weight: number, reps: number): WorkoutSet => ({
  id,
  setNumber: 1,
  reps,
  weight,
  rpe: 8,
  isWarmup: false,
  isCompleted: true,
  notes: '',
  completedAt: '2026-05-15T10:00:00.000Z',
});

const mkSession = (
  id: string,
  startTime: string,
  totalVolume: number,
  opts: {
    status?: WorkoutSession['status'];
    duration?: number;
    sets?: WorkoutSet[];
    exerciseName?: string;
  } = {}
): WorkoutSession => {
  const date = startTime.slice(0, 10);
  const exercise: WorkoutExercise = {
    id: `w-${id}`,
    exerciseId: 'bench',
    exerciseName: opts.exerciseName ?? 'Bench Press',
    targetMuscle: 'Chest',
    sets: opts.sets ?? [mkSet(`${id}-1`, 100, 5)],
    notes: '',
    restSeconds: 120,
    isCompleted: true,
    order: 0,
  };
  return {
    id,
    date,
    startTime,
    endTime: startTime,
    exercises: [exercise],
    duration: opts.duration ?? 3600,
    status: opts.status ?? 'completed',
    templateId: null,
    notes: '',
    rating: null,
    totalVolume,
    caloriesBurned: null,
    createdAt: startTime,
    updatedAt: startTime,
  };
};

const mkPR = (
  exerciseName: string,
  weight: number,
  reps: number,
  date: string,
  oneRepMax?: number
): PersonalRecord => ({
  id: `${exerciseName}-${weight}-${date}`,
  exerciseId: exerciseName.toLowerCase(),
  exerciseName,
  date,
  weight,
  reps,
  type: 'weight',
  oneRepMax,
});

const NOW = new Date('2026-05-15T12:00:00.000Z').getTime();

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(NOW));
});

afterEach(() => {
  vi.useRealTimers();
});

// ---------------------------------------------------------------------------

describe('onlyCompleted', () => {
  it('keeps only completed sessions', () => {
    // Arrange
    const sessions = [
      mkSession('a', '2026-05-14T10:00:00.000Z', 100),
      mkSession('b', '2026-05-14T10:00:00.000Z', 100, { status: 'active' }),
    ];

    // Act
    const result = onlyCompleted(sessions);

    // Assert
    expect(result).toHaveLength(1);
    expect(result[0]?.id).toBe('a');
  });
});

describe('summarizeWeeklyVolume', () => {
  it('sums volume, count and time within the trailing 7 days', () => {
    // Arrange — two sessions in the last week, one older
    const sessions = [
      mkSession('a', '2026-05-14T10:00:00.000Z', 5000, { duration: 1800 }),
      mkSession('b', '2026-05-12T10:00:00.000Z', 3000, { duration: 1800 }),
      mkSession('old', '2026-05-01T10:00:00.000Z', 9000, { duration: 3600 }),
    ];

    // Act
    const summary = summarizeWeeklyVolume(sessions, NOW);

    // Assert
    expect(summary.volume).toBe(8000);
    expect(summary.count).toBe(2);
    expect(summary.timeMin).toBe(60);
  });

  it('computes week-over-week change against the prior 7-day window', () => {
    // Arrange — this week 8000, previous week (days 7..14 ago) 4000 => +100%
    const sessions = [
      mkSession('this', '2026-05-13T10:00:00.000Z', 8000),
      mkSession('prev', '2026-05-06T10:00:00.000Z', 4000),
    ];

    // Act
    const summary = summarizeWeeklyVolume(sessions, NOW);

    // Assert
    expect(summary.prevVolume).toBe(4000);
    expect(summary.changePct).toBe(100);
  });

  it('returns null change when there is no prior-week data', () => {
    // Arrange
    const sessions = [mkSession('this', '2026-05-13T10:00:00.000Z', 8000)];

    // Act
    const summary = summarizeWeeklyVolume(sessions, NOW);

    // Assert
    expect(summary.changePct).toBeNull();
  });
});

describe('buildPRBoard', () => {
  it('keeps the single best e1RM per exercise and sorts descending', () => {
    // Arrange — Bench has two records; Squat one. Higher e1RM wins per exercise.
    const prs = [
      mkPR('Bench Press', 100, 1, '2026-05-01', 100),
      mkPR('Bench Press', 90, 5, '2026-05-10', 105),
      mkPR('Squat', 140, 1, '2026-05-09', 140),
    ];

    // Act
    const board = buildPRBoard(prs);

    // Assert
    expect(board).toHaveLength(2);
    expect(board[0]?.exerciseName).toBe('Squat');
    expect(board[0]?.e1RM).toBe(140);
    expect(board[1]?.exerciseName).toBe('Bench Press');
    expect(board[1]?.e1RM).toBe(105);
  });

  it('derives e1RM from weight x reps when no stored oneRepMax', () => {
    // Arrange — 100kg x 5 reps, Epley => 100 * (1 + 5/30) ≈ 117
    const prs = [mkPR('Deadlift', 100, 5, '2026-05-01')];

    // Act
    const board = buildPRBoard(prs);

    // Assert
    expect(board[0]?.e1RM).toBe(117);
  });

  it('ignores records with non-positive weight', () => {
    // Arrange
    const prs = [mkPR('Ghost', 0, 5, '2026-05-01')];

    // Act
    const board = buildPRBoard(prs);

    // Assert
    expect(board).toHaveLength(0);
  });
});

describe('recentPRs', () => {
  it('returns the newest records first up to the limit', () => {
    // Arrange
    const prs = [
      mkPR('A', 100, 1, '2026-05-01'),
      mkPR('B', 100, 1, '2026-05-10'),
      mkPR('C', 100, 1, '2026-05-05'),
    ];

    // Act
    const result = recentPRs(prs, 2);

    // Assert
    expect(result.map((p) => p.exerciseName)).toEqual(['B', 'C']);
  });
});

describe('buildVolumeTrend', () => {
  it('orders points chronologically and labels them', () => {
    // Arrange
    const sessions = [
      mkSession('b', '2026-05-10T10:00:00.000Z', 3000),
      mkSession('a', '2026-05-08T10:00:00.000Z', 2000),
    ];

    // Act
    const points = buildVolumeTrend(onlyCompleted(sessions));

    // Assert — sorted ascending by start time
    expect(points.map((p) => p.y)).toEqual([2000, 3000]);
    expect(points).toHaveLength(2);
  });
});

describe('buildStrengthCurves', () => {
  it('builds a curve per exercise with change and dedupes per date', () => {
    // Arrange — same exercise across two dates, top weight rising 80 -> 100
    const sessions = [
      mkSession('s1', '2026-05-08T10:00:00.000Z', 0, {
        exerciseName: 'Bench Press',
        sets: [mkSet('s1a', 80, 5)],
      }),
      mkSession('s2', '2026-05-12T10:00:00.000Z', 0, {
        exerciseName: 'Bench Press',
        sets: [mkSet('s2a', 100, 5)],
      }),
    ];

    // Act
    const curves = buildStrengthCurves(onlyCompleted(sessions));

    // Assert
    expect(curves).toHaveLength(1);
    expect(curves[0]?.latestWeight).toBe(100);
    expect(curves[0]?.change).toBe(20);
    expect(curves[0]?.data).toHaveLength(2);
  });

  it('drops exercises with fewer than two data points', () => {
    // Arrange
    const sessions = [
      mkSession('s1', '2026-05-08T10:00:00.000Z', 0, {
        exerciseName: 'Bench Press',
        sets: [mkSet('s1a', 80, 5)],
      }),
    ];

    // Act
    const curves = buildStrengthCurves(onlyCompleted(sessions));

    // Assert
    expect(curves).toHaveLength(0);
  });
});

describe('summarizeWeeklyVolume — prevCount', () => {
  it('counts sessions in the prior 7-day window', () => {
    // Arrange — one this week, two in the prior window
    const sessions = [
      mkSession('this', '2026-05-13T10:00:00.000Z', 8000),
      mkSession('p1', '2026-05-06T10:00:00.000Z', 2000),
      mkSession('p2', '2026-05-05T10:00:00.000Z', 2000),
    ];

    // Act
    const summary = summarizeWeeklyVolume(sessions, NOW);

    // Assert
    expect(summary.count).toBe(1);
    expect(summary.prevCount).toBe(2);
  });
});

describe('weeklyCountDelta / weeklyVolumeDelta', () => {
  it('grades an increase as good and a decrease as attention', () => {
    // Arrange — this week 3 sessions / 8000kg, prev 1 session / 4000kg
    const sessions = [
      mkSession('t1', '2026-05-14T10:00:00.000Z', 3000),
      mkSession('t2', '2026-05-13T10:00:00.000Z', 3000),
      mkSession('t3', '2026-05-12T10:00:00.000Z', 2000),
      mkSession('p1', '2026-05-06T10:00:00.000Z', 4000),
    ];
    const summary = summarizeWeeklyVolume(sessions, NOW);

    // Act
    const countDelta = weeklyCountDelta(summary);
    const volDelta = weeklyVolumeDelta(summary);

    // Assert
    expect(countDelta.diff).toBe(2);
    expect(countDelta.zone).toBe('good');
    expect(volDelta.diff).toBe(4000);
    expect(volDelta.zone).toBe('good');
  });

  it('is neutral when there is no prior window', () => {
    // Arrange
    const summary = summarizeWeeklyVolume([mkSession('t1', '2026-05-14T10:00:00.000Z', 3000)], NOW);

    // Act + Assert
    expect(weeklyCountDelta(summary).hasPrev).toBe(false);
    expect(weeklyCountDelta(summary).zone).toBe('neutral');
  });
});

describe('weekVerdict', () => {
  it('flags an empty week as attention', () => {
    // Arrange
    const summary = summarizeWeeklyVolume([], NOW);

    // Act
    const verdict = weekVerdict(summary, 0);

    // Assert
    expect(verdict.count).toBe(0);
    expect(verdict.zone).toBe('attention');
  });

  it('reads a rising-volume week as good and mentions an active streak', () => {
    // Arrange — this week 8000 vs prev 4000 (+100%), 3 sessions
    const sessions = [
      mkSession('t1', '2026-05-14T10:00:00.000Z', 3000),
      mkSession('t2', '2026-05-13T10:00:00.000Z', 3000),
      mkSession('t3', '2026-05-12T10:00:00.000Z', 2000),
      mkSession('p1', '2026-05-06T10:00:00.000Z', 4000),
    ];
    const summary = summarizeWeeklyVolume(sessions, NOW);

    // Act
    const verdict = weekVerdict(summary, 4);

    // Assert
    expect(verdict.zone).toBe('good');
    expect(verdict.sentence).toContain('4');
  });
});

describe('isRecentPR', () => {
  it('returns true within the window and false outside it', () => {
    // Arrange + Act + Assert
    expect(isRecentPR(mkPR('Bench Press', 100, 5, '2026-05-13'), 7, NOW)).toBe(true);
    expect(isRecentPR(mkPR('Bench Press', 100, 5, '2026-05-01'), 7, NOW)).toBe(false);
  });
});

describe('sliceByRangeDays', () => {
  const items = [
    { date: '2026-05-14', v: 1 }, // 1 day ago
    { date: '2026-05-10', v: 2 }, // 5 days ago
    { date: '2026-04-20', v: 3 }, // ~25 days ago (within 30)
    { date: '2026-03-10', v: 4 }, // ~66 days ago (within 90, outside 30)
  ];

  it('keeps only items within the trailing window', () => {
    // Act — a 7-day window keeps the two most recent
    const week = sliceByRangeDays(items, RANGE_DAYS.W, (i) => i.date, NOW);

    // Assert
    expect(week.map((i) => i.v)).toEqual([1, 2]);
  });

  it('widens with the range key', () => {
    // Act
    const month = sliceByRangeDays(items, RANGE_DAYS.M, (i) => i.date, NOW);
    const quarter = sliceByRangeDays(items, RANGE_DAYS['3M'], (i) => i.date, NOW);

    // Assert — 30 days picks up the 25-day-old item, 90 days picks up all
    expect(month.map((i) => i.v)).toEqual([1, 2, 3]);
    expect(quarter.map((i) => i.v)).toEqual([1, 2, 3, 4]);
  });

  it('drops items with unparseable dates', () => {
    // Arrange
    const withBad = [...items, { date: 'not-a-date', v: 99 }];

    // Act
    const week = sliceByRangeDays(withBad, RANGE_DAYS.W, (i) => i.date, NOW);

    // Assert
    expect(week.some((i) => i.v === 99)).toBe(false);
  });

  it('exposes a sensible default range that is a known key', () => {
    expect(RANGE_DAYS[DEFAULT_RANGE]).toBeGreaterThan(0);
  });
});

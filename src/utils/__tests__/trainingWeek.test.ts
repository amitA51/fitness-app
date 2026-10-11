// ============================================================================
// trainingWeek — the app's ONE definition of "this week", pinned.
// ============================================================================
// The defect this module exists to close: Home counted the SUNDAY-based calendar
// week and summed COMPLETED SETS, while the Progress overview counted a TRAILING
// 7-day window and summed the stored `totalVolume` field. Under the same word
// "השבוע" one trainee read two different numbers on two screens.
//
// The load-bearing assertions below are the ones that fail against either of the
// old definitions:
//   • a Saturday session is LAST week, not "within 7 days"
//   • volume comes from completed sets even when `totalVolume` is absent or wrong
//   • weeks before the first session are omitted from the series, not zero-filled
//   • the week in progress is flagged, never counted as a finished result

import { describe, expect, it } from 'vitest';
import type { WorkoutExercise, WorkoutSession, WorkoutSet } from '../../types';
import {
  completeTrainingWeeks,
  sessionsPerWeekSeries,
  sessionsThisWeek,
  summarizeTrainingWeek,
  trainingWeekTotals,
  weekStartAt,
  weeklyTarget,
} from '../trainingWeek';

/** Wednesday 2026-05-13 09:00 local — the Sunday-based week runs 05-10 → 05-16. */
const WED = new Date(2026, 4, 13, 9, 0, 0, 0);

const set = (weight: number, reps: number, isCompleted = true): WorkoutSet => ({
  id: `set-${weight}-${reps}`,
  setNumber: 1,
  reps,
  weight,
  rpe: null,
  isWarmup: false,
  isCompleted,
  notes: '',
  completedAt: isCompleted ? '2026-05-13T09:00:00.000Z' : null,
});

/**
 * A completed session at `dayOffset` days from WED. `storedVolume` is written to
 * the row's `totalVolume` field deliberately WRONG in some cases: nothing may
 * read it.
 */
const session = (
  id: string,
  dayOffset: number,
  sets: WorkoutSet[],
  opts: { storedVolume?: number; durationSec?: number; status?: WorkoutSession['status'] } = {}
): WorkoutSession => {
  const start = new Date(WED);
  start.setDate(start.getDate() + dayOffset);
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
    date: `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}-${String(start.getDate()).padStart(2, '0')}`,
    startTime: start.toISOString(),
    endTime: start.toISOString(),
    exercises: [exercise],
    duration: opts.durationSec ?? 1800,
    status: opts.status ?? 'completed',
    templateId: null,
    notes: '',
    rating: null,
    totalVolume: opts.storedVolume ?? 0,
    caloriesBurned: null,
    createdAt: start.toISOString(),
    updatedAt: start.toISOString(),
  };
};

describe('weekStartAt', () => {
  it('lands on Sunday 00:00 local', () => {
    // Act
    const start = weekStartAt(WED);

    // Assert
    expect(start.getDay()).toBe(0);
    expect(start.getDate()).toBe(10);
    expect(start.getHours()).toBe(0);
  });

  it('steps whole weeks with the offset', () => {
    expect(weekStartAt(WED, -1).getDate()).toBe(3);
  });
});

describe('summarizeTrainingWeek', () => {
  it('sums volume from COMPLETED SETS, ignoring the stored totalVolume', () => {
    // Arrange — 80kg x 5 = 400kg of real work, with a lying 9999 on the row
    const sessions = [session('a', 0, [set(80, 5)], { storedVolume: 9999 })];

    // Act
    const summary = summarizeTrainingWeek(sessions, WED);

    // Assert
    expect(summary.volume).toBe(400);
    expect(summary.count).toBe(1);
  });

  it('excludes an uncompleted set from the volume', () => {
    // Arrange
    const sessions = [session('a', 0, [set(80, 5), set(100, 5, false)])];

    // Act / Assert
    expect(summarizeTrainingWeek(sessions, WED).volume).toBe(400);
  });

  it('puts a SATURDAY session in the previous week, not "within 7 days"', () => {
    // Arrange — Saturday 05-09 is 4 days before WED but closed the prior week.
    const sessions = [session('sat', -4, [set(50, 10)])];

    // Act
    const summary = summarizeTrainingWeek(sessions, WED);

    // Assert — this is the exact drift the old trailing window produced
    expect(summary.count).toBe(0);
    const lastWeek = trainingWeekTotals(sessions, weekStartAt(WED, -1));
    expect(lastWeek.count).toBe(1);
    expect(lastWeek.volume).toBe(500);
    // Saturday is AFTER "the same point last week" (last Wednesday 09:00), so
    // the mid-week comparison does not count it yet.
    expect(summary.prevCount).toBe(0);
  });

  it('ignores sessions that were never completed', () => {
    // Arrange
    const sessions = [session('a', 0, [set(80, 5)], { status: 'active' })];

    // Act / Assert
    expect(summarizeTrainingWeek(sessions, WED).count).toBe(0);
  });

  it('reports null change when the previous week logged no volume', () => {
    expect(summarizeTrainingWeek([session('a', 0, [set(80, 5)])], WED).changePct).toBeNull();
  });

  it('reports the signed week-over-week percent', () => {
    // Arrange — this week 400kg, last week 200kg by the same point (last Tuesday)
    const sessions = [session('a', 0, [set(80, 5)]), session('b', -8, [set(40, 5)])];

    // Act / Assert
    expect(summarizeTrainingWeek(sessions, WED).changePct).toBe(100);
  });

  it('counts training minutes for each week separately', () => {
    // Arrange — 30 min this week, 60 min last week
    const sessions = [
      session('a', 0, [set(80, 5)], { durationSec: 1800 }),
      session('b', -8, [set(80, 5)], { durationSec: 3600 }),
    ];

    // Act
    const summary = summarizeTrainingWeek(sessions, WED);

    // Assert
    expect(summary.timeMin).toBe(30);
    expect(summary.prevTimeMin).toBe(60);
  });

  it('compares against the SAME point of last week, not the whole finished week', () => {
    // Arrange — a regular trainee: Mon/Thu/Fri last week, and on this Wednesday
    // morning the Monday session done. By Wednesday 09:00 last week they had
    // done ONE session too, so nothing has dropped.
    const sessions = [
      session('mon', -2, [set(80, 5)]),
      session('lastMon', -9, [set(80, 5)]),
      session('lastThu', -6, [set(80, 5)]),
      session('lastFri', -5, [set(80, 5)]),
    ];

    // Act
    const summary = summarizeTrainingWeek(sessions, WED);

    // Assert — the old whole-week comparison read 1 vs 3 sessions, -67%
    expect(summary.count).toBe(1);
    expect(summary.prevCount).toBe(1);
    expect(summary.changePct).toBe(0);
  });
});

describe('the overview count and the home count are the same number', () => {
  it('summarizeTrainingWeek().count === sessionsThisWeek()', () => {
    // Arrange
    const sessions = [
      session('sat', -4, [set(50, 10)]),
      session('mon', -2, [set(50, 10)]),
      session('wed', 0, [set(50, 10)]),
    ];

    // Act / Assert
    expect(summarizeTrainingWeek(sessions, WED).count).toBe(sessionsThisWeek(sessions, WED));
    expect(sessionsThisWeek(sessions, WED)).toBe(2);
  });
});

describe('weeklyTarget', () => {
  it('prefers a declared program over the inferred median', () => {
    // Arrange — three weeks of one session/week would infer 1
    const sessions = [
      session('a', -7, [set(50, 5)]),
      session('b', -14, [set(50, 5)]),
      session('c', -21, [set(50, 5)]),
    ];

    // Act / Assert
    expect(weeklyTarget(sessions, 4, WED)).toBe(4);
  });

  it('falls back to the median when no program is running', () => {
    // Arrange — two sessions in each of the two previous complete weeks
    const sessions = [
      session('a', -5, [set(50, 5)]),
      session('b', -6, [set(50, 5)]),
      session('c', -12, [set(50, 5)]),
      session('d', -13, [set(50, 5)]),
    ];

    // Act / Assert
    expect(weeklyTarget(sessions, null, WED)).toBe(2);
  });

  it('is null with too little history to infer anything', () => {
    expect(weeklyTarget([session('a', 0, [set(50, 5)])], null, WED)).toBeNull();
  });
});

describe('sessionsPerWeekSeries', () => {
  it('omits weeks before the first session instead of zero-filling them', () => {
    // Arrange — first session 2 weeks ago => 3 weeks of history at most
    const sessions = [session('a', -14, [set(50, 5)]), session('b', 0, [set(50, 5)])];

    // Act
    const series = sessionsPerWeekSeries(sessions, 8, WED);

    // Assert — a week the trainee had not started is not a week they skipped
    expect(series).toHaveLength(3);
    expect(series.map((w) => w.count)).toEqual([1, 0, 1]);
  });

  it('runs oldest → newest and flags only the week in progress', () => {
    // Arrange
    const sessions = [session('a', -7, [set(50, 5)]), session('b', 0, [set(50, 5)])];

    // Act
    const series = sessionsPerWeekSeries(sessions, 8, WED);

    // Assert — same time direction as Sparkline / GlowAreaChart
    expect(series.map((w) => w.isCurrent)).toEqual([false, true]);
    expect(series[0]?.weekStart).toBe('2026-05-03');
    expect(series[1]?.weekStart).toBe('2026-05-10');
  });

  it('is empty with no completed sessions', () => {
    expect(sessionsPerWeekSeries([], 8, WED)).toEqual([]);
  });
});

describe('completeTrainingWeeks', () => {
  it('counts only fully elapsed weeks since the first session', () => {
    // Arrange — first session two weeks back; this week is still running
    const sessions = [session('a', -14, [set(50, 5)])];

    // Act / Assert
    expect(completeTrainingWeeks(sessions, WED)).toBe(2);
  });

  it('is 0 in the trainee\u2019s very first week', () => {
    expect(completeTrainingWeeks([session('a', 0, [set(50, 5)])], WED)).toBe(0);
  });
});

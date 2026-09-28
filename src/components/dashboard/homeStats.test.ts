// ============================================================================
// homeStats — the home screen must never print a number the data cannot carry.
// ============================================================================
// These tests pin the four places that could lie: the week boundary (Sunday,
// shared with WeeklyGrid), the inferred weekly target, the %-delta guard, and
// the Hebrew relative-date labels. Plus the bilingual-name rule, because the
// last-workout title is the only place a raw catalog name reaches the screen.

import { describe, expect, it } from 'vitest';
import type { WorkoutExercise, WorkoutSession, WorkoutSet } from '../../types';
import {
  computeHomeStats,
  displayExerciseName,
  headerSubtitle,
  medianSessionsPerWeek,
  relativeDayLabel,
  sessionsThisWeek,
  weekStartAt,
  weeklyVolumeDeltaPct,
} from './homeStats';

/** Local `YYYY-MM-DD` — never the UTC slice, which shifts for Israel. */
const dayKey = (d: Date): string =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

const at = (base: Date, dayOffset: number, hour = 9): Date => {
  const d = new Date(base);
  d.setDate(d.getDate() + dayOffset);
  d.setHours(hour, 0, 0, 0);
  return d;
};

const set = (weight: number, reps: number): WorkoutSet => ({
  id: `set-${weight}-${reps}`,
  setNumber: 1,
  reps,
  weight,
  rpe: null,
  isWarmup: false,
  isCompleted: true,
  notes: '',
  completedAt: '2026-01-01T00:00:00.000Z',
});

const exercise = (name: string, sets: WorkoutSet[]): WorkoutExercise => ({
  id: `ex-${name}`,
  exerciseId: `ex-${name}`,
  exerciseName: name,
  targetMuscle: 'chest',
  sets,
  notes: '',
  restSeconds: 90,
  isCompleted: true,
  order: 0,
});

const session = (
  id: string,
  start: Date,
  overrides: Partial<WorkoutSession> = {}
): WorkoutSession => ({
  id,
  date: dayKey(start),
  startTime: start.toISOString(),
  endTime: new Date(start.getTime() + 3_600_000).toISOString(),
  exercises: [exercise('לחיצת חזה | Bench Press', [set(50, 10)])],
  duration: 2880,
  status: 'completed',
  templateId: null,
  notes: '',
  rating: null,
  totalVolume: 500,
  caloriesBurned: null,
  createdAt: start.toISOString(),
  updatedAt: start.toISOString(),
  ...overrides,
});

// A fixed Wednesday so "this week" always has Sunday..Tuesday behind it.
const WED = new Date(2026, 8, 30, 12, 0, 0, 0); // 2026-09-30, a Wednesday
const SUNDAY_OF_WED = new Date(2026, 8, 27, 0, 0, 0, 0);

describe('week boundaries match WeeklyGrid (Sunday start, local midnight)', () => {
  it('snaps to Sunday 00:00 of the containing week', () => {
    const start = weekStartAt(WED);

    expect(start.getDay()).toBe(0);
    expect(start.getTime()).toBe(SUNDAY_OF_WED.getTime());
  });

  it('shifts whole weeks for a negative offset', () => {
    expect(weekStartAt(WED, -1).getTime()).toBe(SUNDAY_OF_WED.getTime() - 7 * 86_400_000);
  });

  it('counts a Sunday session in the new week, not the previous one', () => {
    const sunday = session('s-sun', at(SUNDAY_OF_WED, 0, 8));
    const saturdayBefore = session('s-sat', at(SUNDAY_OF_WED, -1, 20));

    expect(sessionsThisWeek([sunday, saturdayBefore], WED)).toBe(1);
  });

  it('ignores sessions that were not completed', () => {
    const active = session('s-active', at(SUNDAY_OF_WED, 1), { status: 'active' });
    const cancelled = session('s-cancel', at(SUNDAY_OF_WED, 2), { status: 'cancelled' });
    const done = session('s-done', at(SUNDAY_OF_WED, 2), { status: 'completed' });

    expect(sessionsThisWeek([active, cancelled, done], WED)).toBe(1);
  });
});

describe('weekly target is inferred, never invented', () => {
  it('returns null with less than two complete weeks of history', () => {
    // Only last week exists → one complete week, not a pattern.
    const sessions = [session('a', at(SUNDAY_OF_WED, -7)), session('b', at(SUNDAY_OF_WED, -5))];

    expect(medianSessionsPerWeek(sessions, WED)).toBeNull();
  });

  it('takes the median of the last four complete weeks', () => {
    // week -1: 3 · week -2: 2 · week -3: 4 · week -4: 3  → median 3
    const sessions = [
      session('a1', at(SUNDAY_OF_WED, -7)),
      session('a2', at(SUNDAY_OF_WED, -6)),
      session('a3', at(SUNDAY_OF_WED, -5)),
      session('b1', at(SUNDAY_OF_WED, -14)),
      session('b2', at(SUNDAY_OF_WED, -13)),
      session('c1', at(SUNDAY_OF_WED, -21)),
      session('c2', at(SUNDAY_OF_WED, -20)),
      session('c3', at(SUNDAY_OF_WED, -19)),
      session('c4', at(SUNDAY_OF_WED, -18)),
      session('d1', at(SUNDAY_OF_WED, -28)),
      session('d2', at(SUNDAY_OF_WED, -27)),
      session('d3', at(SUNDAY_OF_WED, -26)),
    ];

    expect(medianSessionsPerWeek(sessions, WED)).toBe(3);
  });

  it('does not let weeks before the first session drag the target down', () => {
    // History starts three weeks back: weeks -1,-2,-3 = 2 each, week -4 is
    // pre-history and must not be sampled as a zero.
    const sessions = [
      session('a1', at(SUNDAY_OF_WED, -7)),
      session('a2', at(SUNDAY_OF_WED, -6)),
      session('b1', at(SUNDAY_OF_WED, -14)),
      session('b2', at(SUNDAY_OF_WED, -13)),
      session('c1', at(SUNDAY_OF_WED, -21)),
      session('c2', at(SUNDAY_OF_WED, -20)),
    ];

    expect(medianSessionsPerWeek(sessions, WED)).toBe(2);
  });

  it('returns null rather than an unreachable target of 0', () => {
    // One session four weeks ago: the three weeks since are all zero → median 0.
    const sessions = [session('old', at(SUNDAY_OF_WED, -28))];

    expect(medianSessionsPerWeek(sessions, WED)).toBeNull();
  });

  it('lets an active program declare the target instead of the median', () => {
    // Median here would be 2; the running program says 5.
    const sessions = [
      session('a1', at(SUNDAY_OF_WED, -7)),
      session('a2', at(SUNDAY_OF_WED, -6)),
      session('b1', at(SUNDAY_OF_WED, -14)),
      session('b2', at(SUNDAY_OF_WED, -13)),
    ];

    expect(computeHomeStats({ sessions, programSessionsPerWeek: 5, now: WED }).target).toBe(5);
    expect(computeHomeStats({ sessions, now: WED }).target).toBe(2);
  });

  it('ignores a non-positive program target', () => {
    expect(
      computeHomeStats({ sessions: [], programSessionsPerWeek: 0, now: WED }).target
    ).toBeNull();
  });
});

describe('volume delta is only printed when last week is comparable', () => {
  const heavy = (id: string, start: Date, weight: number) =>
    session(id, start, {
      exercises: [exercise('סקוואט | Squat', [set(weight, 10)])],
    });

  it('compares this week so far against the same point last week', () => {
    // This week: 100×10 = 1000 · same point last week: 80×10 = 800 → +25%
    const sessions = [
      heavy('now', at(SUNDAY_OF_WED, 1), 100),
      heavy('prev', at(SUNDAY_OF_WED, -6), 80),
    ];

    expect(weeklyVolumeDeltaPct(sessions, WED)).toBe(25);
  });

  it('is signed — a lighter week reads negative', () => {
    const sessions = [
      heavy('now', at(SUNDAY_OF_WED, 1), 80),
      heavy('prev', at(SUNDAY_OF_WED, -6), 100),
    ];

    expect(weeklyVolumeDeltaPct(sessions, WED)).toBe(-20);
  });

  it('returns null when last week has nothing at that point', () => {
    // Last week's only session happened on its FRIDAY — after Wednesday, so it
    // is outside the elapsed window and must not be compared against.
    const sessions = [
      heavy('now', at(SUNDAY_OF_WED, 1), 100),
      heavy('late', at(SUNDAY_OF_WED, -2), 100),
    ];

    expect(weeklyVolumeDeltaPct(sessions, WED)).toBeNull();
  });

  it('returns null before anything is logged this week', () => {
    const sessions = [heavy('prev', at(SUNDAY_OF_WED, -6), 80)];

    expect(weeklyVolumeDeltaPct(sessions, WED)).toBeNull();
  });
});

describe('relative day labels read like Hebrew', () => {
  it('names the three days Hebrew has words for', () => {
    expect(relativeDayLabel(dayKey(at(WED, 0)), WED)).toBe('היום');
    expect(relativeDayLabel(dayKey(at(WED, -1)), WED)).toBe('אתמול');
    expect(relativeDayLabel(dayKey(at(WED, -2)), WED)).toBe('שלשום');
  });

  it('counts days up to a week', () => {
    expect(relativeDayLabel(dayKey(at(WED, -4)), WED)).toBe('לפני 4 ימים');
  });

  it('falls back to an absolute date at a week and beyond', () => {
    expect(relativeDayLabel(dayKey(at(WED, -9)), WED)).not.toMatch(/לפני/);
  });

  it('does not print a negative count for a future date', () => {
    expect(relativeDayLabel(dayKey(at(WED, 3)), WED)).not.toMatch(/לפני/);
  });

  it('reads a bare day key as a LOCAL day, not UTC midnight', () => {
    // Late-evening "now": a UTC-parsed key would slip a day and say אתמול.
    const lateWed = new Date(2026, 8, 30, 23, 30, 0, 0);

    expect(relativeDayLabel('2026-09-30', lateWed)).toBe('היום');
  });
});

describe('bilingual exercise names show the Hebrew side', () => {
  it('drops the English half', () => {
    expect(displayExerciseName('לחיצת חזה | Bench Press')).toBe('לחיצת חזה');
  });

  it('leaves a single-language name alone', () => {
    expect(displayExerciseName('מתח')).toBe('מתח');
    expect(displayExerciseName('Deadlift')).toBe('Deadlift');
  });
});

describe('last-workout recap', () => {
  it('prefers the template name and links by session id', () => {
    const last = session('sess-9', at(SUNDAY_OF_WED, 1), { templateId: 'tpl-1' });

    const stats = computeHomeStats({
      sessions: [last],
      templates: [{ id: 'tpl-1', name: 'דחיפה A' }],
      now: WED,
    });

    expect(stats.lastWorkout?.id).toBe('sess-9');
    expect(stats.lastWorkout?.name).toBe('דחיפה A');
    expect(stats.lastWorkout?.volume).toBe(500);
  });

  it('falls back to the first exercise in Hebrew when there is no template', () => {
    const stats = computeHomeStats({ sessions: [session('s1', at(SUNDAY_OF_WED, 1))], now: WED });

    expect(stats.lastWorkout?.name).toBe('לחיצת חזה');
  });

  it('counts each PR exercise once, and only for that session day', () => {
    const last = session('s1', at(SUNDAY_OF_WED, 1));
    const stats = computeHomeStats({
      sessions: [last],
      records: [
        { exerciseId: 'ex-a', date: last.date },
        { exerciseId: 'ex-a', date: last.date },
        { exerciseId: 'ex-b', date: last.date },
        { exerciseId: 'ex-c', date: dayKey(at(SUNDAY_OF_WED, -9)) },
      ],
      now: WED,
    });

    expect(stats.lastWorkout?.prCount).toBe(2);
  });

  it('is null with no completed history', () => {
    const stats = computeHomeStats({ sessions: [], now: WED });

    expect(stats.lastWorkout).toBeNull();
    expect(stats.thisWeek).toBe(0);
    expect(stats.target).toBeNull();
    expect(stats.volumeDeltaPct).toBeNull();
  });
});

describe('header subtitle states a fact', () => {
  it('pairs the last workout with this week', () => {
    const stats = computeHomeStats({ sessions: [session('s1', at(WED, -1))], now: WED });

    expect(headerSubtitle(stats)).toBe('אימון אחרון אתמול · אימון אחד השבוע');
  });

  it('says so plainly when the week is still empty', () => {
    const stats = computeHomeStats({ sessions: [session('s1', at(SUNDAY_OF_WED, -9))], now: WED });

    expect(headerSubtitle(stats)).toMatch('עוד לא התאמנתם השבוע');
  });
});

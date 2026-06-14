import { describe, expect, it } from 'vitest';
import type { NutritionLog, PersonalRecordRow } from '../../../../services/supabaseSyncMappers';
import type { BodyWeightEntry, WorkoutSession } from '../../../../types';
import type { Assignment } from '../../../../types/coach';
import {
  buildReportRange,
  buildShareSummary,
  computeNutritionSummary,
  computeTrainingSummary,
  computeWeightTrend,
  filterPRsInRange,
  findCalorieTarget,
  isInRange,
  sparklinePoints,
} from '../reportMetrics';

// ---- helpers ----------------------------------------------------------------

const RANGE = { from: '2026-05-12', to: '2026-06-10' };

const session = (date: string, totalVolume: number): WorkoutSession =>
  ({ id: `s-${date}`, date, startTime: `${date}T08:00:00.000Z`, totalVolume }) as WorkoutSession;

const weight = (date: string, w: number): BodyWeightEntry => ({
  id: `w-${date}`,
  date,
  weight: w,
  createdAt: `${date}T00:00:00.000Z`,
});

const log = (date: string, calories?: number): NutritionLog => ({
  id: `n-${date}`,
  date,
  calories,
  meals: [],
});

const pr = (date: string): PersonalRecordRow => ({
  id: `pr-${date}`,
  exerciseId: 'ex1',
  exerciseName: 'סקוואט',
  weight: 100,
  reps: 5,
  date,
  recordType: 'weight',
});

// ---- tests --------------------------------------------------------------------

describe('buildReportRange / isInRange', () => {
  it('builds an inclusive trailing 30-day window in local time', () => {
    const range = buildReportRange(30, new Date(2026, 5, 10)); // 2026-06-10
    expect(range).toEqual({ from: '2026-05-12', to: '2026-06-10' });
  });

  it('treats both window ends as inclusive and ignores ISO time parts', () => {
    expect(isInRange('2026-05-12', RANGE)).toBe(true);
    expect(isInRange('2026-06-10T23:59:00.000Z', RANGE)).toBe(true);
    expect(isInRange('2026-05-11', RANGE)).toBe(false);
    expect(isInRange(null, RANGE)).toBe(false);
  });
});

describe('computeTrainingSummary', () => {
  it('counts only in-range sessions and sums their volume', () => {
    const result = computeTrainingSummary(
      [session('2026-06-01', 1200), session('2026-05-20', 800), session('2026-04-01', 9999)],
      RANGE
    );
    expect(result).toEqual({ sessionCount: 2, totalVolume: 2000 });
  });

  it('returns zeros when no sessions fall in range', () => {
    expect(computeTrainingSummary([session('2026-01-01', 500)], RANGE)).toEqual({
      sessionCount: 0,
      totalVolume: 0,
    });
  });
});

describe('computeWeightTrend', () => {
  it('orders weigh-ins chronologically and computes start/end/delta', () => {
    // API order is newest-first; the trend must re-sort oldest-first.
    const trend = computeWeightTrend(
      [weight('2026-06-08', 81.5), weight('2026-05-15', 84), weight('2026-06-01', 82.2)],
      RANGE
    );
    expect(trend).toEqual({
      startWeight: 84,
      endWeight: 81.5,
      delta: -2.5,
      values: [84, 82.2, 81.5],
    });
  });

  it('returns null when nothing is in range', () => {
    expect(computeWeightTrend([weight('2026-01-01', 90)], RANGE)).toBeNull();
  });
});

describe('filterPRsInRange', () => {
  it('keeps only in-range PRs, preserving order', () => {
    const rows = [pr('2026-06-05'), pr('2026-05-20'), pr('2026-03-01')];
    expect(filterPRsInRange(rows, RANGE).map((r) => r.date)).toEqual(['2026-06-05', '2026-05-20']);
  });
});

describe('computeNutritionSummary', () => {
  it('averages calories over logged days only', () => {
    const result = computeNutritionSummary(
      [log('2026-06-01', 2000), log('2026-06-02', 2200), log('2026-06-03'), log('2026-01-01', 1)],
      RANGE,
      2100
    );
    expect(result).toEqual({ daysLogged: 3, avgCalories: 2100, targetCalories: 2100 });
  });

  it('returns null average when no calories were logged in range', () => {
    expect(computeNutritionSummary([log('2026-06-03')], RANGE, null)).toEqual({
      daysLogged: 1,
      avgCalories: null,
      targetCalories: null,
    });
  });
});

describe('findCalorieTarget', () => {
  const assignment = (overrides: Partial<Assignment>): Assignment =>
    ({
      id: 'a1',
      coachId: 'c1',
      clientId: 'u1',
      groupId: null,
      kind: 'nutrition_target',
      title: null,
      payload: {},
      templateId: null,
      schedule: null,
      status: 'active',
      ...overrides,
    }) as Assignment;

  it('returns the first active nutrition_target with numeric calories', () => {
    const assignments = [
      assignment({ status: 'archived', payload: { calories: 1800 } }),
      assignment({ payload: { calories: 2200 } }),
    ];
    expect(findCalorieTarget(assignments)).toBe(2200);
  });

  it('returns null when no valid target exists', () => {
    expect(findCalorieTarget([assignment({ payload: { calories: 'lots' } })])).toBeNull();
  });
});

describe('sparklinePoints', () => {
  it('maps min to the bottom and max to the top of the padded box', () => {
    // width 104, height 48, pad 4 → inner 96×40
    expect(sparklinePoints([80, 90], 104, 48)).toBe('4,44 100,4');
  });

  it('renders a flat mid-height line for a zero-span series', () => {
    expect(sparklinePoints([82], 104, 48)).toBe('4,24 100,24');
  });

  it('returns an empty string for an empty series', () => {
    expect(sparklinePoints([], 104, 48)).toBe('');
  });
});

describe('buildShareSummary', () => {
  it('includes only the meaningful lines and leads with name + window', () => {
    const text = buildShareSummary({
      clientName: 'דנה',
      days: 30,
      training: { sessionCount: 12, totalVolume: 48000 },
      weightTrend: { startWeight: 70, endWeight: 68, delta: -2, values: [70, 68] },
      prCount: 3,
      nutrition: { daysLogged: 20, avgCalories: 2100, targetCalories: 2000 },
    });

    const lines = text.split('\n');
    expect(lines[0]).toBe('סיכום 30 ימים — דנה');
    expect(text).toContain('אימונים: 12');
    expect(text).toContain('שיאים אישיים: 3');
    // Negative delta keeps its sign (no leading +).
    expect(text).toContain('שינוי משקל: -2');
  });

  it('omits empty sections (no weight trend, no PRs, no nutrition)', () => {
    const text = buildShareSummary({
      clientName: 'יואב',
      days: 30,
      training: { sessionCount: 0, totalVolume: 0 },
      weightTrend: null,
      prCount: 0,
      nutrition: { daysLogged: 0, avgCalories: null, targetCalories: null },
    });

    expect(text).toContain('אימונים: 0');
    expect(text).not.toContain('שינוי משקל');
    expect(text).not.toContain('שיאים אישיים');
    expect(text).not.toContain('תיעוד תזונה');
    expect(text).not.toContain('נפח כולל');
  });

  it('prefixes a positive weight delta with +', () => {
    const text = buildShareSummary({
      clientName: 'נועה',
      days: 30,
      training: { sessionCount: 5, totalVolume: 1000 },
      weightTrend: { startWeight: 60, endWeight: 62, delta: 2, values: [60, 62] },
      prCount: 0,
      nutrition: { daysLogged: 0, avgCalories: null, targetCalories: null },
    });
    expect(text).toContain('שינוי משקל: +2');
  });
});

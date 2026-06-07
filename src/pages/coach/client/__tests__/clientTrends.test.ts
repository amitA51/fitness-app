import { describe, expect, it } from 'vitest';
import type { DayAdherence } from '../../../../services/coach/coachAnalytics';
import type { BodyMeasurement } from '../../../../services/supabaseSyncMappers';
import type { BodyWeightEntry } from '../../../../types';
import {
  computeStreaks,
  isImprovement,
  measurementDeltas,
  volumeTrendPoints,
  weightTrendPoints,
} from '../clientTrends';

// ---- helpers ----------------------------------------------------------------

const weight = (date: string, w: number): BodyWeightEntry => ({
  id: `w-${date}-${w}`,
  date,
  weight: w,
  createdAt: `${date}T00:00:00.000Z`,
});

const measurement = (date: string, fields: Record<string, number>): BodyMeasurement => ({
  id: `m-${date}`,
  date,
  measurements: fields,
});

const day = (overrides: Partial<DayAdherence>): DayAdherence => ({
  date: '2026-01-01',
  weekday: 4,
  sessions: 0,
  calories: null,
  targetCalories: null,
  scheduled: 0,
  completedScheduled: 0,
  ...overrides,
});

// ---- weightTrendPoints ------------------------------------------------------

describe('weightTrendPoints', () => {
  it('sorts ascending by date and maps to DD/MM labels', () => {
    const points = weightTrendPoints([
      weight('2026-01-03', 82),
      weight('2026-01-01', 80),
      weight('2026-01-02', 81),
    ]);
    expect(points).toEqual([
      { x: '01/01', y: 80 },
      { x: '02/01', y: 81 },
      { x: '03/01', y: 82 },
    ]);
  });

  it('keeps only the most recent 30 entries', () => {
    const entries = Array.from({ length: 40 }, (_, i) => {
      const dd = String((i % 28) + 1).padStart(2, '0');
      const mm = String(Math.floor(i / 28) + 1).padStart(2, '0');
      return weight(`2026-${mm}-${dd}`, 70 + i);
    });
    const points = weightTrendPoints(entries);
    expect(points).toHaveLength(30);
    // Last point is the newest (largest weight, since dates ascend with index).
    expect(points[points.length - 1]?.y).toBe(70 + 39);
  });

  it('drops non-finite weights and returns empty for no data', () => {
    expect(weightTrendPoints([])).toEqual([]);
    const points = weightTrendPoints([weight('2026-01-01', Number.NaN), weight('2026-01-02', 81)]);
    expect(points).toEqual([{ x: '02/01', y: 81 }]);
  });
});

// ---- measurementDeltas ------------------------------------------------------

describe('measurementDeltas', () => {
  it('compares the latest reading against the previous and builds history', () => {
    const result = measurementDeltas([
      measurement('2026-01-01', { waist: 90, chest: 100 }),
      measurement('2026-01-15', { waist: 88, chest: 102 }),
    ]);
    const waist = result.find((f) => f.key === 'waist');
    const chest = result.find((f) => f.key === 'chest');
    expect(waist).toMatchObject({
      current: 88,
      previous: 90,
      delta: -2,
      history: [90, 88],
    });
    expect(chest).toMatchObject({
      current: 102,
      previous: 100,
      delta: 2,
      history: [100, 102],
    });
  });

  it('orders known fields (chest before waist) and assigns Hebrew labels', () => {
    const result = measurementDeltas([measurement('2026-02-01', { waist: 85, chest: 99 })]);
    expect(result.map((f) => f.key)).toEqual(['chest', 'waist']);
    expect(result[0]?.labelHe).toBe('חזה');
    expect(result.find((f) => f.key === 'waist')?.labelHe).toBe('מותניים');
  });

  it('yields a null delta when a field has only one reading', () => {
    const result = measurementDeltas([measurement('2026-02-01', { chest: 100 })]);
    expect(result[0]).toMatchObject({ current: 100, previous: null, delta: null, history: [100] });
  });

  it('returns empty for no measurements', () => {
    expect(measurementDeltas([])).toEqual([]);
  });

  it('skips fields missing or non-numeric in the latest reading', () => {
    const result = measurementDeltas([
      measurement('2026-01-01', { chest: 100, waist: 90 }),
      // latest reading lacks waist → only chest is reported
      measurement('2026-01-15', { chest: 101 }),
    ]);
    expect(result.map((f) => f.key)).toEqual(['chest']);
  });
});

describe('isImprovement', () => {
  it('treats a drop in waist/hips as an improvement', () => {
    expect(isImprovement('waist', -2)).toBe(true);
    expect(isImprovement('hips', -1)).toBe(true);
    expect(isImprovement('waist', 2)).toBe(false);
  });

  it('treats a rise in other fields as an improvement', () => {
    expect(isImprovement('chest', 2)).toBe(true);
    expect(isImprovement('biceps', -1)).toBe(false);
  });
});

// ---- volumeTrendPoints ------------------------------------------------------

describe('volumeTrendPoints', () => {
  it('labels the canonical 4-week series oldest → newest', () => {
    const points = volumeTrendPoints([1000, 2000, 3000, 4000]);
    expect(points).toEqual([
      { x: 'לפני 3ש׳', y: 1000 },
      { x: 'לפני 2ש׳', y: 2000 },
      { x: 'שבוע שעבר', y: 3000 },
      { x: 'השבוע', y: 4000 },
    ]);
  });

  it('rounds volume values', () => {
    const points = volumeTrendPoints([1000.7, 2000.2, 3000, 4000]);
    expect(points[0]?.y).toBe(1001);
    expect(points[1]?.y).toBe(2000);
  });

  it('falls back to generic ordinal labels for non-4 lengths', () => {
    const points = volumeTrendPoints([10, 20, 30]);
    expect(points.map((p) => p.x)).toEqual(['לפני 2ש׳', 'לפני 1ש׳', 'השבוע']);
  });

  it('returns empty for no data', () => {
    expect(volumeTrendPoints([])).toEqual([]);
  });
});

// ---- computeStreaks ---------------------------------------------------------

describe('computeStreaks', () => {
  it('counts the current workout streak from the newest day backwards', () => {
    const days: DayAdherence[] = [
      day({ sessions: 0 }),
      day({ sessions: 1 }),
      day({ sessions: 0 }),
      day({ sessions: 1 }),
      day({ sessions: 1 }),
      day({ sessions: 1 }),
      day({ sessions: 0 }),
    ];
    // newest day (index 6) has no session → current streak is 0
    expect(computeStreaks(days).currentWorkout).toBe(0);
  });

  it('counts a current workout streak ending today', () => {
    const days: DayAdherence[] = [
      day({ sessions: 0 }),
      day({ sessions: 0 }),
      day({ sessions: 1 }),
      day({ sessions: 1 }),
      day({ sessions: 1 }),
    ];
    expect(computeStreaks(days).currentWorkout).toBe(3);
  });

  it('finds the longest workout streak anywhere in the window', () => {
    const days: DayAdherence[] = [
      day({ sessions: 1 }),
      day({ sessions: 1 }),
      day({ sessions: 1 }),
      day({ sessions: 0 }),
      day({ sessions: 1 }),
      day({ sessions: 1 }),
      day({ sessions: 0 }),
    ];
    expect(computeStreaks(days).longestWorkout).toBe(3);
  });

  it('counts the current on-target streak (calories within target)', () => {
    const days: DayAdherence[] = [
      day({ calories: 2200, targetCalories: 2000 }), // over → breaks
      day({ calories: 1900, targetCalories: 2000 }),
      day({ calories: 2000, targetCalories: 2000 }),
      day({ calories: 1800, targetCalories: 2000 }),
    ];
    expect(computeStreaks(days).currentOnTarget).toBe(3);
  });

  it('does not count days without calories or target as on-target', () => {
    const days: DayAdherence[] = [
      day({ calories: 1800, targetCalories: 2000 }),
      day({ calories: null, targetCalories: 2000 }), // no log → breaks
      day({ calories: 1900, targetCalories: 2000 }),
    ];
    expect(computeStreaks(days).currentOnTarget).toBe(1);
  });

  it('returns all-zero for an empty window', () => {
    expect(computeStreaks([])).toEqual({
      currentWorkout: 0,
      longestWorkout: 0,
      currentOnTarget: 0,
    });
  });
});

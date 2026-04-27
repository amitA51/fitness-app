import { describe, expect, it } from 'vitest';
import { calculateBarbellPlateLoad, formatPlateLoad, isBarbellExercise } from '../plateCalculator';

describe('calculateBarbellPlateLoad', () => {
  it('returns exact plates per side for a standard metric barbell', () => {
    expect(calculateBarbellPlateLoad(80)).toEqual({
      barWeight: 20,
      isExact: true,
      loadedWeight: 80,
      platesPerSide: [20, 10],
      remainderKg: 0,
      targetWeight: 80,
    });
  });

  it('uses the requested available plates in descending order', () => {
    expect(
      calculateBarbellPlateLoad(75, {
        availablePlates: [10, 5, 2.5],
      })?.platesPerSide
    ).toEqual([10, 10, 5, 2.5]);
  });

  it('reports the nearest loadable weight when exact loading is not possible', () => {
    expect(
      calculateBarbellPlateLoad(53, {
        availablePlates: [15, 10, 5, 2.5, 1.25],
      })
    ).toMatchObject({
      isExact: false,
      loadedWeight: 52.5,
      platesPerSide: [15, 1.25],
      remainderKg: 0.5,
    });
  });

  it('returns null when the target is not above bar weight', () => {
    expect(calculateBarbellPlateLoad(20)).toBeNull();
    expect(calculateBarbellPlateLoad(12.5)).toBeNull();
  });
});

describe('formatPlateLoad', () => {
  it('formats exact loads compactly', () => {
    const load = calculateBarbellPlateLoad(80);
    expect(formatPlateLoad(load)).toBe('20 + 10 כל צד');
  });

  it('includes loaded weight for rounded loads', () => {
    const load = calculateBarbellPlateLoad(53, {
      availablePlates: [15, 10, 5, 2.5, 1.25],
    });
    expect(formatPlateLoad(load)).toBe('15 + 1.25 כל צד · בפועל 52.5 ק״ג');
  });
});

describe('isBarbellExercise', () => {
  it('detects barbell exercises by equipment', () => {
    expect(isBarbellExercise({ equipment: 'barbell' })).toBe(true);
  });

  it('detects common barbell wording in exercise names', () => {
    expect(isBarbellExercise({ name: 'Bench Press' })).toBe(true);
    expect(isBarbellExercise({ name: 'סקוואט עם מוט' })).toBe(true);
  });

  it('does not mark dumbbell exercises as barbell work', () => {
    expect(isBarbellExercise({ equipment: 'dumbbell', name: 'Dumbbell Press' })).toBe(false);
  });
});

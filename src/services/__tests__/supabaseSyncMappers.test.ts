import { describe, expect, it } from 'vitest';

import {
  type BodyMeasurement,
  type BodyWeightEntry,
  type NutritionLog,
  type PersonalExercise,
  type WorkoutSession,
  type WorkoutTemplate,
  toCanonicalBodyMeasurement,
  toCanonicalBodyWeight,
  toCanonicalNutritionLog,
  toCanonicalPersonalExercise,
  toCanonicalSession,
  toCanonicalTemplate,
} from '../supabaseSyncMappers';

const isIsoString = (value: unknown): boolean =>
  typeof value === 'string' && !Number.isNaN(Date.parse(value));

// ============================================================================
// toCanonicalTemplate
// ============================================================================

describe('toCanonicalTemplate', () => {
  const base: WorkoutTemplate = { id: 't1', name: 'Push Day', exercises: [] };

  it('fills required canonical fields with safe defaults', () => {
    const result = toCanonicalTemplate(base);
    expect(result.description).toBe('');
    expect(result.timesUsed).toBe(0);
    expect(result.isFavorite).toBe(false);
    expect(result.lastUsed).toBeNull();
    expect(isIsoString(result.createdAt)).toBe(true);
    expect(isIsoString(result.updatedAt)).toBe(true);
  });

  it('preserves provided values over defaults', () => {
    const result = toCanonicalTemplate({
      ...base,
      description: 'Heavy',
      timesUsed: 7,
      isFavorite: true,
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-02-01T00:00:00Z',
    });
    expect(result.description).toBe('Heavy');
    expect(result.timesUsed).toBe(7);
    expect(result.isFavorite).toBe(true);
    expect(result.createdAt).toBe('2026-01-01T00:00:00Z');
    expect(result.updatedAt).toBe('2026-02-01T00:00:00Z');
  });

  it('falls back updatedAt to createdAt when updatedAt is missing', () => {
    const result = toCanonicalTemplate({ ...base, createdAt: '2026-01-01T00:00:00Z' });
    expect(result.updatedAt).toBe('2026-01-01T00:00:00Z');
  });

  it('omits optional fields (deletedAt/muscleGroups/isBuiltin) when undefined', () => {
    const result = toCanonicalTemplate(base);
    expect('deletedAt' in result).toBe(false);
    expect('muscleGroups' in result).toBe(false);
    expect('isBuiltin' in result).toBe(false);
  });

  it('includes optional fields when explicitly provided (including null deletedAt)', () => {
    const result = toCanonicalTemplate({
      ...base,
      deletedAt: null,
      muscleGroups: ['chest'],
      isBuiltin: true,
    });
    expect('deletedAt' in result).toBe(true);
    expect((result as { deletedAt?: string | null }).deletedAt).toBeNull();
    expect(result.muscleGroups).toEqual(['chest']);
    expect(result.isBuiltin).toBe(true);
  });
});

// ============================================================================
// toCanonicalSession — date/status derivation + defaults
// ============================================================================

describe('toCanonicalSession', () => {
  const base: WorkoutSession = {
    id: 's1',
    startTime: '2026-03-15T08:30:00Z',
    exercises: [],
  };

  it('derives date from startTime when date is missing', () => {
    const result = toCanonicalSession(base);
    expect(result.date).toBe('2026-03-15');
  });

  it('prefers an explicit date over startTime', () => {
    const result = toCanonicalSession({ ...base, date: '2026-01-01' });
    expect(result.date).toBe('2026-01-01');
  });

  it("derives status 'completed' when endTime is present", () => {
    const result = toCanonicalSession({ ...base, endTime: '2026-03-15T09:30:00Z' });
    expect(result.status).toBe('completed');
  });

  it("derives status 'active' when endTime is absent", () => {
    const result = toCanonicalSession(base);
    expect(result.status).toBe('active');
  });

  it('honors an explicit status over the endTime-derived one', () => {
    const result = toCanonicalSession({
      ...base,
      endTime: '2026-03-15T09:30:00Z',
      status: 'cancelled',
    });
    expect(result.status).toBe('cancelled');
  });

  it('applies numeric/text defaults', () => {
    const result = toCanonicalSession(base);
    expect(result.duration).toBe(0);
    expect(result.totalVolume).toBe(0);
    expect(result.notes).toBe('');
    expect(result.endTime).toBeNull();
    expect(result.templateId).toBeNull();
    expect(result.rating).toBeNull();
    expect(result.caloriesBurned).toBeNull();
  });

  it('omits deletedAt unless explicitly provided', () => {
    expect('deletedAt' in toCanonicalSession(base)).toBe(false);
    expect('deletedAt' in toCanonicalSession({ ...base, deletedAt: null })).toBe(true);
  });
});

// ============================================================================
// sanitizeExercises (exercised through the public mappers)
// ============================================================================

describe('exercise/set sanitization', () => {
  const base: WorkoutSession = {
    id: 's1',
    startTime: '2026-03-15T08:30:00Z',
    exercises: [],
  };

  it('coerces non-array exercises to an empty array', () => {
    const result = toCanonicalSession({
      ...base,
      exercises: 'garbage' as unknown as unknown[],
    });
    expect(result.exercises).toEqual([]);
  });

  it('drops non-object exercise entries but keeps valid ones', () => {
    const result = toCanonicalSession({
      ...base,
      exercises: [null, 42, { name: 'Squat', sets: [] }] as unknown[],
    });
    expect(result.exercises).toHaveLength(1);
  });

  it('coerces non-finite set weight/reps to 0 and preserves extra fields', () => {
    const result = toCanonicalSession({
      ...base,
      exercises: [
        {
          name: 'Bench',
          sets: [{ weight: Number.NaN, reps: 'x', rpe: 8 }],
        },
      ] as unknown[],
    });
    const sets = (result.exercises[0] as unknown as { sets: Record<string, unknown>[] }).sets;
    expect(sets[0]!.weight).toBe(0);
    expect(sets[0]!.reps).toBe(0);
    expect(sets[0]!.rpe).toBe(8);
  });

  it('keeps valid numeric set values intact', () => {
    const result = toCanonicalSession({
      ...base,
      exercises: [{ name: 'Bench', sets: [{ weight: 100, reps: 5 }] }] as unknown[],
    });
    const sets = (result.exercises[0] as unknown as { sets: Record<string, unknown>[] }).sets;
    expect(sets[0]!.weight).toBe(100);
    expect(sets[0]!.reps).toBe(5);
  });

  it('defaults a non-array sets field to an empty array', () => {
    const result = toCanonicalSession({
      ...base,
      exercises: [{ name: 'Bench', sets: 'nope' }] as unknown[],
    });
    expect((result.exercises[0] as { sets: unknown[] }).sets).toEqual([]);
  });
});

// ============================================================================
// toCanonicalPersonalExercise
// ============================================================================

describe('toCanonicalPersonalExercise', () => {
  it('preserves id/name and passes through provided fields', () => {
    const input: PersonalExercise = {
      id: 'e1',
      name: 'Romanian Deadlift',
      muscleGroup: 'hamstrings',
      useCount: 3,
    };
    const result = toCanonicalPersonalExercise(input);
    expect(result.id).toBe('e1');
    expect(result.name).toBe('Romanian Deadlift');
    expect((result as unknown as { muscleGroup?: string }).muscleGroup).toBe('hamstrings');
  });

  it('omits deletedAt unless explicitly provided', () => {
    expect('deletedAt' in toCanonicalPersonalExercise({ id: 'e1', name: 'X' })).toBe(false);
    expect(
      'deletedAt' in toCanonicalPersonalExercise({ id: 'e1', name: 'X', deletedAt: null })
    ).toBe(true);
  });
});

// ============================================================================
// toCanonicalBodyWeight
// ============================================================================

describe('toCanonicalBodyWeight', () => {
  const base: BodyWeightEntry = { id: 'b1', weight: 82.5, date: '2026-04-01' };

  it('maps core fields and defaults createdAt to a valid ISO string', () => {
    const result = toCanonicalBodyWeight(base);
    expect(result.id).toBe('b1');
    expect(result.weight).toBe(82.5);
    expect(result.date).toBe('2026-04-01');
    expect(isIsoString(result.createdAt)).toBe(true);
  });

  it('preserves a provided createdAt and notes', () => {
    const result = toCanonicalBodyWeight({
      ...base,
      createdAt: '2026-04-01T06:00:00Z',
      notes: 'morning',
    });
    expect(result.createdAt).toBe('2026-04-01T06:00:00Z');
    expect(result.notes).toBe('morning');
  });

  it('omits deletedAt unless explicitly provided', () => {
    expect('deletedAt' in toCanonicalBodyWeight(base)).toBe(false);
    expect('deletedAt' in toCanonicalBodyWeight({ ...base, deletedAt: null })).toBe(true);
  });
});

// ============================================================================
// toCanonicalNutritionLog — rebuilds totalMacros dropped by the cloud round-trip
// (regression for the crash on getDailyMacros after a cross-device pull)
// ============================================================================

describe('toCanonicalNutritionLog', () => {
  const base: NutritionLog = {
    id: 'n1',
    date: '2026-05-01',
    calories: 600,
    protein: 40,
    carbs: 60,
    fat: 20,
    meals: [{ id: 'm1', name: 'breakfast', calories: 600, protein: 40, carbs: 60, fat: 20 }],
  };

  it('reconstructs entry-level totalMacros from the flat columns', () => {
    const result = toCanonicalNutritionLog(base);
    expect(result.totalMacros).toEqual({ calories: 600, protein: 40, carbs: 60, fat: 20 });
  });

  it('reconstructs each meal totalMacros and restores an empty foods array', () => {
    const result = toCanonicalNutritionLog(base);
    expect(result.meals).toHaveLength(1);
    expect(result.meals[0]!.totalMacros).toEqual({
      calories: 600,
      protein: 40,
      carbs: 60,
      fat: 20,
    });
    expect(result.meals[0]!.foods).toEqual([]);
  });

  it('defaults missing flat macro columns to 0 (never undefined)', () => {
    const result = toCanonicalNutritionLog({ id: 'n2', date: '2026-05-02', meals: [] });
    expect(result.totalMacros).toEqual({ calories: 0, protein: 0, carbs: 0, fat: 0 });
    expect(result.meals).toEqual([]);
  });

  it('preserves timestamps and tolerates a missing meals array', () => {
    const result = toCanonicalNutritionLog({
      ...base,
      meals: undefined as unknown as NutritionLog['meals'],
      createdAt: '2026-05-01T07:00:00Z',
      updatedAt: '2026-05-01T08:00:00Z',
    });
    expect(result.meals).toEqual([]);
    expect(result.createdAt).toBe('2026-05-01T07:00:00Z');
    expect(result.updatedAt).toBe('2026-05-01T08:00:00Z');
  });
});

// ============================================================================
// toCanonicalBodyMeasurement — flattens the nested `measurements` object back
// to top-level keys (regression for blank measurements on a second device)
// ============================================================================

describe('toCanonicalBodyMeasurement', () => {
  const base: BodyMeasurement = {
    id: 'bm1',
    date: '2026-04-10',
    measurements: { chest: 100, waist: 80, arms: 38, neck: 40, bodyFat: 18 },
  };

  it('spreads nested measurement values back to flat top-level keys', () => {
    const result = toCanonicalBodyMeasurement(base) as unknown as Record<string, unknown>;
    expect(result.chest).toBe(100);
    expect(result.waist).toBe(80);
    expect(result.arms).toBe(38);
    expect(result.neck).toBe(40);
    expect(result.bodyFat).toBe(18);
  });

  it('keeps the row id/date even if the nested object carried stray ones', () => {
    const result = toCanonicalBodyMeasurement({
      ...base,
      measurements: {
        ...base.measurements,
        id: 'WRONG' as unknown as number,
        date: 'WRONG' as unknown as number,
      },
    });
    expect(result.id).toBe('bm1');
    expect(result.date).toBe('2026-04-10');
  });

  it('omits deletedAt unless explicitly provided', () => {
    expect('deletedAt' in toCanonicalBodyMeasurement(base)).toBe(false);
    expect('deletedAt' in toCanonicalBodyMeasurement({ ...base, deletedAt: null })).toBe(true);
  });
});

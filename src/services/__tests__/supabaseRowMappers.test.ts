/**
 * Regression tests for the local -> cloud row mappers.
 *
 * The bugs below were all live, all silent, and all caused by the bulk push in
 * supabaseSyncOrchestrator keeping its own copy of a mapping that had drifted
 * away from the canonical IndexedDB record shape. Each test feeds the mapper the
 * shape the app ACTUALLY stores locally and asserts the cloud row is correct.
 */

import { describe, expect, it } from 'vitest';
import {
  measurementPayload,
  prRecordType,
  toBodyWeightRow,
  toMeasurementRow,
  toNutritionRow,
  toPersonalRecordRow,
  toSessionRow,
  toSettingRow,
  toTemplateRow,
} from '../supabaseRowMappers';

const USER = 'c363a4e2-f0b8-4693-b07f-a70d48b68f63';

describe('personal_records — record_type must never be undefined', () => {
  // `record_type` is `text NOT NULL`. The bulk mapper read `recordType`, but
  // `savePR` stores the canonical `type`, so the column was omitted entirely and
  // Postgres answered 23502 — killing the whole 50-row chunk, not just this row.
  it('reads the canonical `type` field that savePR actually writes', () => {
    const row = toPersonalRecordRow(USER, {
      id: 'pr-1',
      exerciseId: 'bench press',
      exerciseName: 'Bench Press',
      weight: 100,
      reps: 5,
      date: '2026-07-20',
      type: 'volume',
    });

    expect(row.record_type).toBe('volume');
  });

  it('still reads `recordType` from an already-queued offline payload', () => {
    // Queue entries persist the mapper shape, so both spellings must work or an
    // upgrade would poison every pending PR mutation.
    expect(prRecordType({ recordType: 'reps' } as never)).toBe('reps');
  });

  it('falls back to a valid value rather than omitting the NOT NULL column', () => {
    expect(prRecordType({} as never)).toBe('weight');
  });

  it('nulls a non-uuid exerciseId instead of 22P02-ing the batch', () => {
    // Local PR identity is the normalised exercise NAME; the column is uuid.
    const row = toPersonalRecordRow(USER, {
      id: 'pr-2',
      exerciseId: 'lying leg curl',
      exerciseName: 'Lying Leg Curl',
      weight: 40,
      reps: 7,
      date: '2026-07-20',
      type: 'weight',
    });
    expect(row.exercise_id).toBeNull();
    expect(row.exercise_name).toBe('Lying Leg Curl');
  });
});

describe('body_measurements — flat local row must become the nested column', () => {
  // The local record is flat (chest/waist/...). The bulk mapper read
  // `.measurements` off it, got undefined, and wrote NULL — so every measurement
  // came back blank on another device.
  it('gathers a flat record into the nested payload', () => {
    const row = toMeasurementRow(USER, {
      id: 'm-1',
      date: '2026-07-20',
      chest: 104,
      waist: 82,
      bodyFat: 14.5,
      createdAt: '2026-07-20T10:00:00.000Z',
    });

    expect(row.measurements).toEqual({ chest: 104, waist: 82, bodyFat: 14.5 });
  });

  it('passes an already-nested queue payload through unchanged', () => {
    expect(
      measurementPayload({
        id: 'm-2',
        date: '2026-07-20',
        measurements: { chest: 100, waist: 80 },
      })
    ).toEqual({ chest: 100, waist: 80 });
  });

  it('omits absent fields rather than writing nulls into the json', () => {
    expect(measurementPayload({ id: 'm-3', date: '2026-07-20', waist: 80 })).toEqual({ waist: 80 });
  });
});

describe('nutrition_logs — macros come from totalMacros, and 0 is data', () => {
  // The bulk mapper read flat `l.calories`, but the canonical entry keeps
  // `totalMacros`. That did not merely omit the values: `|| null` turned them
  // into NULL, so a full upload OVERWROTE correct cloud macros with nothing.
  it('reads macros out of totalMacros', () => {
    const row = toNutritionRow(USER, {
      id: 'n-1',
      date: '2026-07-20',
      totalMacros: { calories: 2150, protein: 165, carbs: 200, fat: 62 },
      meals: [],
    });

    expect(row).toMatchObject({ calories: 2150, protein: 165, carbs: 200, fat: 62 });
  });

  it('preserves a genuine zero instead of collapsing it to null', () => {
    // `0 || null` is null. There is a production row whose carbs became NULL
    // exactly this way, so a zero-carb day read as "no data logged".
    const row = toNutritionRow(USER, {
      id: 'n-2',
      date: '2026-07-20',
      totalMacros: { calories: 165, protein: 31, carbs: 0, fat: 4 },
      meals: [],
    });

    expect(row.carbs).toBe(0);
  });

  it('keeps each meal’s foods so they survive a round-trip', () => {
    // Flattening meals to bare macros meant a restored meal had no food names,
    // brands, serving sizes or barcodes.
    const row = toNutritionRow(USER, {
      id: 'n-3',
      date: '2026-07-20',
      totalMacros: { calories: 295, protein: 34, carbs: 28, fat: 4 },
      meals: [
        {
          id: 'meal-1',
          name: 'lunch',
          time: '13:32',
          totalMacros: { calories: 295, protein: 34, carbs: 28, fat: 4 },
          foods: [{ id: 'f1', name: 'עוף', servings: 1, servingSize: '100g' }],
        },
      ],
    });

    const meals = row.meals as Array<Record<string, unknown>>;
    expect(meals[0]?.foods).toHaveLength(1);
    // Flat fields stay too, so rows written before this change still read.
    expect(meals[0]).toMatchObject({ calories: 295, protein: 34 });
  });
});

describe('fields that had a cloud column but were never sent', () => {
  it('sends body-weight notes', () => {
    const row = toBodyWeightRow(USER, {
      id: 'bw-1',
      weight: 80.5,
      date: '2026-07-20',
      notes: 'אחרי אימון',
    });
    expect(row.notes).toBe('אחרי אימון');
  });

  it('sends the session rating the summary screen collects', () => {
    const row = toSessionRow(USER, {
      id: 's-1',
      startTime: '2026-07-20T13:14:10.847Z',
      exercises: [],
      rating: 4,
      status: 'completed',
      templateId: '__bbt_program_day__',
    });
    expect(row).toMatchObject({
      rating: 4,
      status: 'completed',
      template_id: '__bbt_program_day__',
    });
  });

  it('sends the template metadata that prevented built-in duplication', () => {
    const row = toTemplateRow(USER, {
      id: 't-1',
      name: 'Upper',
      exercises: [],
      isBuiltin: true,
      isFavorite: true,
      timesUsed: 7,
    });
    expect(row).toMatchObject({ is_builtin: true, is_favorite: true, times_used: 7 });
  });
});

describe('tombstone and identity rules shared by both push paths', () => {
  it('omits deleted_at on a live save so a remote tombstone is not cleared', () => {
    const row = toSessionRow(USER, {
      id: 's-2',
      startTime: '2026-07-20T13:14:10.847Z',
      exercises: [],
    });
    expect('deleted_at' in row).toBe(false);
  });

  it('writes deleted_at when actually deleting', () => {
    const row = toSessionRow(USER, {
      id: 's-3',
      startTime: '2026-07-20T13:14:10.847Z',
      exercises: [],
      deletedAt: '2026-07-21T00:00:00.000Z',
    });
    expect(row.deleted_at).toBe('2026-07-21T00:00:00.000Z');
  });

  it('never sends a composite id for user_settings', () => {
    // `${userId}:${key}` is not a uuid and 22P02-rejected every settings write.
    const row = toSettingRow(USER, { key: 'bbt_program_progress_v1', value: { currentWeek: 6 } });
    expect('id' in row).toBe(false);
    expect(row).toMatchObject({ user_id: USER, key: 'bbt_program_progress_v1' });
  });

  it('always produces an updated_at, since the server drops stale writes silently', () => {
    const row = toBodyWeightRow(USER, { id: 'bw-2', weight: 80, date: '2026-07-20' });
    expect(typeof row.updated_at).toBe('string');
  });
});

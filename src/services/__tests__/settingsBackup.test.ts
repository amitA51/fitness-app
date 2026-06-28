import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { STORES, clearDatabase, dbGetAll, dbPut } from '../indexedDBCore';
import { buildFullBackup, importFullBackup } from '../settingsService';

beforeEach(async () => {
  await clearDatabase();
  localStorage.clear();
});
afterEach(async () => {
  await clearDatabase();
  localStorage.clear();
});

describe('importFullBackup (restore)', () => {
  it('restores records and localStorage settings from the export format', async () => {
    const backup = {
      version: '1.0.0',
      exportDate: '2026-06-28T00:00:00Z',
      data: {
        sessions: [{ id: 'w1', startTime: '2026-06-01T10:00:00Z' }],
        templates: [{ id: 't1', name: 'Push' }],
        personalExercises: [],
        personalRecords: [{ id: 'pr1', exerciseId: 'e1' }],
      },
      settings: {
        userProfile: '{"name":"דנה"}',
        workoutPrefs: null, // null settings are skipped
        nutritionGoals: '{"calories":2500}',
        programProgress: '{"week":1}',
      },
    };

    const result = await importFullBackup(JSON.stringify(backup));
    expect(result.records).toBe(3); // 1 session + 1 template + 1 PR (0 exercises)
    expect(result.settings).toBe(3); // userProfile, nutritionGoals, programProgress

    expect(await dbGetAll(STORES.WORKOUT_SESSIONS)).toHaveLength(1);
    expect(await dbGetAll(STORES.WORKOUT_TEMPLATES)).toHaveLength(1);
    expect(await dbGetAll(STORES.PERSONAL_RECORDS)).toHaveLength(1);
    expect(localStorage.getItem('user_profile')).toBe('{"name":"דנה"}');
    expect(localStorage.getItem('bbt_program_progress_v1')).toBe('{"week":1}');
    expect(localStorage.getItem('workout_prefs')).toBeNull();
  });

  it('rejects malformed JSON and foreign (non-SparkOS) files', async () => {
    await expect(importFullBackup('{bad json')).rejects.toThrow();
    await expect(importFullBackup(JSON.stringify({ foo: 1 }))).rejects.toThrow();
  });

  it('merges without wiping existing records', async () => {
    await dbPut(STORES.WORKOUT_SESSIONS, { id: 'old', startTime: '2026-05-01T10:00:00Z' });
    await importFullBackup(
      JSON.stringify({
        version: '1.0.0',
        data: { sessions: [{ id: 'new', startTime: '2026-06-01T10:00:00Z' }] },
      })
    );
    const ids = (await dbGetAll<{ id: string }>(STORES.WORKOUT_SESSIONS)).map((r) => r.id).sort();
    expect(ids).toEqual(['new', 'old']);
  });
});


describe('buildFullBackup ↔ importFullBackup full round-trip', () => {
  it('captures every user-data store (incl. body/nutrition/water) and restores after a wipe', async () => {
    await dbPut(STORES.WORKOUT_SESSIONS, { id: 'w1', startTime: '2026-06-01T10:00:00Z' });
    await dbPut(STORES.BODY_WEIGHT, { id: 'bw1', date: '2026-06-01', weight: 70 });
    await dbPut(STORES.BODY_MEASUREMENTS, {
      id: 'm1',
      date: '2026-06-01',
      measurements: { waist: 80 },
    });
    await dbPut(STORES.NUTRITION_LOGS, { id: 'n1', date: '2026-06-01' });
    await dbPut(STORES.WATER_LOGS, { id: 'wl1', date: '2026-06-01', ml: 500 });
    localStorage.setItem('user_profile', '{"name":"דנה"}');

    const backup = await buildFullBackup();
    // The export now captures the stores the old 4-store backup dropped.
    expect(backup.data.bodyWeight).toHaveLength(1);
    expect(backup.data.bodyMeasurements).toHaveLength(1);
    expect(backup.data.nutritionLogs).toHaveLength(1);
    expect(backup.data.waterLogs).toHaveLength(1);

    await clearDatabase();
    localStorage.clear();

    const result = await importFullBackup(JSON.stringify(backup));
    expect(result.records).toBeGreaterThanOrEqual(5);

    expect(await dbGetAll(STORES.BODY_WEIGHT)).toHaveLength(1);
    expect(await dbGetAll(STORES.BODY_MEASUREMENTS)).toHaveLength(1);
    expect(await dbGetAll(STORES.NUTRITION_LOGS)).toHaveLength(1);
    expect(await dbGetAll(STORES.WATER_LOGS)).toHaveLength(1);
    expect(localStorage.getItem('user_profile')).toBe('{"name":"דנה"}');
  });
});

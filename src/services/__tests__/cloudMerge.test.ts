import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../supabaseAuth', () => ({ getCurrentUser: vi.fn(async () => null) }));
vi.mock('../supabaseSync', () => ({
  deleteCloudWorkoutSession: vi.fn(),
  deleteCloudWorkoutTemplate: vi.fn(),
  syncWorkoutSession: vi.fn(),
  syncWorkoutTemplate: vi.fn(),
}));

import { mergeGenericRecords, safeTimestamp } from '../cloudMerge';
import { STORES, clearDatabase, dbGetAll, dbPut } from '../indexedDBCore';
import { mergeWorkoutSessionsFromCloud } from '../sessionDb';
import { mergeWorkoutTemplatesFromCloud } from '../templateDb';

beforeEach(async () => {
  await clearDatabase();
});
afterEach(async () => {
  await clearDatabase();
});

// --- safeTimestamp unit tests ---

describe('safeTimestamp', () => {
  it('returns 0 for undefined', () => {
    expect(safeTimestamp(undefined)).toBe(0);
  });
  it('returns 0 for empty string', () => {
    expect(safeTimestamp('')).toBe(0);
  });
  it('returns 0 for invalid date', () => {
    expect(safeTimestamp('not-a-date')).toBe(0);
  });
  it('returns epoch ms for valid ISO', () => {
    expect(safeTimestamp('2026-01-01T00:00:00Z')).toBe(1767225600000);
  });
});

// --- mergeGenericRecords tests ---

describe('mergeGenericRecords', () => {
  const store = STORES.USER_SETTINGS; // simple store with 'key' field

  it('cloud wins when local has no timestamps', async () => {
    await dbPut(store, { key: '1' });
    const result = await mergeGenericRecords(
      store,
      [{ key: '1', updatedAt: '2026-01-01T00:00:00Z' }],
      'key'
    );
    expect(result.updated).toBe(1);
    const records = (await dbGetAll(store)) as Array<Record<string, unknown>>;
    expect(records.find((r) => r.key === '1')?.updatedAt).toBe('2026-01-01T00:00:00Z');
  });

  it('cloud wins when strictly newer', async () => {
    await dbPut(store, { key: '1', updatedAt: '2025-01-01T00:00:00Z' });
    const result = await mergeGenericRecords(
      store,
      [{ key: '1', updatedAt: '2026-01-01T00:00:00Z' }],
      'key'
    );
    expect(result.updated).toBe(1);
  });

  it('local kept when same timestamp', async () => {
    await dbPut(store, { key: '1', updatedAt: '2026-01-01T00:00:00Z' });
    const result = await mergeGenericRecords(
      store,
      [{ key: '1', updatedAt: '2026-01-01T00:00:00Z' }],
      'key'
    );
    expect(result.kept).toBe(1);
  });

  it('local kept when newer', async () => {
    await dbPut(store, { key: '1', updatedAt: '2027-01-01T00:00:00Z' });
    const result = await mergeGenericRecords(
      store,
      [{ key: '1', updatedAt: '2026-01-01T00:00:00Z' }],
      'key'
    );
    expect(result.kept).toBe(1);
  });

  it('both timestamps missing → local kept (tie at 0)', async () => {
    await dbPut(store, { key: '1' });
    const result = await mergeGenericRecords(store, [{ key: '1' }], 'key');
    expect(result.kept).toBe(1);
  });

  it('new cloud record added', async () => {
    const result = await mergeGenericRecords(
      store,
      [{ key: 'new1', updatedAt: '2026-01-01T00:00:00Z' }],
      'key'
    );
    expect(result.added).toBe(1);
  });
});

// --- sessionDb merge integration ---

describe('mergeWorkoutSessionsFromCloud', () => {
  it('cloud record with timestamps beats local with undefined timestamps', async () => {
    // Simulate legacy local record with missing timestamps at runtime
    const legacy: any = {
      id: 's1',
      date: '2025-01-01',
      startTime: '',
      endTime: null,
      exercises: [],
      duration: 0,
      status: 'completed',
      templateId: null,
      notes: '',
      rating: null,
      totalVolume: 0,
      caloriesBurned: null,
    };
    await dbPut(STORES.WORKOUT_SESSIONS, legacy);

    const cloud: any = {
      ...legacy,
      updatedAt: '2026-06-01T00:00:00Z',
      createdAt: '2026-01-01T00:00:00Z',
    };
    const result = await mergeWorkoutSessionsFromCloud([cloud]);
    expect(result.updated).toBe(1);

    const stored = await dbGetAll(STORES.WORKOUT_SESSIONS);
    expect((stored[0] as any).updatedAt).toBe('2026-06-01T00:00:00Z');
  });
});

// --- templateDb merge integration ---

describe('mergeWorkoutTemplatesFromCloud', () => {
  it('cloud record with timestamps beats local with undefined timestamps', async () => {
    const legacy: any = {
      id: 't1',
      name: 'Test',
      description: '',
      exercises: [],
      lastUsed: null,
      timesUsed: 0,
      isFavorite: false,
    };
    await dbPut(STORES.WORKOUT_TEMPLATES, legacy);

    const cloud: any = {
      ...legacy,
      updatedAt: '2026-06-01T00:00:00Z',
      createdAt: '2026-01-01T00:00:00Z',
    };
    const result = await mergeWorkoutTemplatesFromCloud([cloud]);
    expect(result.updated).toBe(1);

    const stored = await dbGetAll(STORES.WORKOUT_TEMPLATES);
    expect((stored[0] as any).updatedAt).toBe('2026-06-01T00:00:00Z');
  });
});

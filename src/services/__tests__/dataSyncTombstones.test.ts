import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Prevent cloud/auth side effects from running when the CRUD modules load.
vi.mock('../supabaseAuth', () => ({
  getCurrentUser: vi.fn(async () => null),
}));
vi.mock('../supabaseSync', () => ({
  syncWorkoutSession: vi.fn(),
  syncWorkoutTemplate: vi.fn(),
}));

import { unionMessagesById } from '../cloudMerge';
import { STORES, clearDatabase, dbGetAll, dbPut } from '../indexedDBCore';
import {
  getAllWorkoutSessions,
  getWorkoutSessions,
  mergeWorkoutSessionsFromCloud,
} from '../sessionDb';
import { getWorkoutTemplates, mergeWorkoutTemplatesFromCloud } from '../templateDb';
import { mergeWaterLogsFromCloud } from '../waterService';

beforeEach(async () => {
  await clearDatabase();
});
afterEach(async () => {
  await clearDatabase();
});

const baseTime = '2026-05-20T10:00:00.000Z';
const newerTime = '2026-05-22T10:00:00.000Z';

const makeSession = (id: string, overrides: Record<string, unknown> = {}) => ({
  id,
  date: '2026-05-20',
  startTime: baseTime,
  endTime: null,
  exercises: [],
  duration: 0,
  status: 'completed',
  templateId: null,
  notes: '',
  rating: null,
  totalVolume: 0,
  caloriesBurned: null,
  createdAt: baseTime,
  updatedAt: baseTime,
  ...overrides,
});

const makeTemplate = (id: string, overrides: Record<string, unknown> = {}) => ({
  id,
  name: `Template ${id}`,
  description: '',
  exercises: [],
  createdAt: baseTime,
  updatedAt: baseTime,
  lastUsed: null,
  timesUsed: 0,
  isFavorite: false,
  ...overrides,
});

// ── Fix #1: session tombstone propagation ────────────────────────────────────

describe('mergeWorkoutSessionsFromCloud — tombstone propagation', () => {
  it('deletes the local session when the cloud row carries deletedAt', async () => {
    // Arrange: a session exists locally (e.g. created on this device)
    await dbPut(STORES.WORKOUT_SESSIONS, makeSession('s1'));

    // Act: cloud reports the same id as tombstoned (deleted on another device)
    const result = await mergeWorkoutSessionsFromCloud([
      makeSession('s1', { deletedAt: newerTime, updatedAt: newerTime }) as never,
    ]);

    // Assert: local row removed, not resurrected
    expect(result.deleted).toBe(1);
    const stored = await dbGetAll(STORES.WORKOUT_SESSIONS);
    expect(stored).toHaveLength(0);
  });

  it('does not resurrect: tombstone for a missing local row is a no-op', async () => {
    const result = await mergeWorkoutSessionsFromCloud([
      makeSession('ghost', { deletedAt: newerTime, updatedAt: newerTime }) as never,
    ]);

    expect(result.deleted).toBe(0);
    expect(result.added).toBe(0);
    const stored = await dbGetAll(STORES.WORKOUT_SESSIONS);
    expect(stored).toHaveLength(0);
  });

  it('still merges live rows by LWW alongside a tombstone', async () => {
    await dbPut(STORES.WORKOUT_SESSIONS, makeSession('s1'));

    const result = await mergeWorkoutSessionsFromCloud([
      makeSession('s1', { deletedAt: newerTime, updatedAt: newerTime }) as never,
      makeSession('s2') as never,
    ]);

    expect(result.deleted).toBe(1);
    expect(result.added).toBe(1);
    const stored = await dbGetAll<{ id: string }>(STORES.WORKOUT_SESSIONS);
    expect(stored.map((s) => s.id)).toEqual(['s2']);
  });
});

describe('session reads exclude tombstoned rows', () => {
  it('getWorkoutSessions and getAllWorkoutSessions skip rows with deletedAt', async () => {
    // Arrange: one live, one tombstoned (a stale tombstone could linger locally)
    await dbPut(STORES.WORKOUT_SESSIONS, makeSession('live'));
    await dbPut(STORES.WORKOUT_SESSIONS, makeSession('dead', { deletedAt: newerTime }));

    // Act
    const limited = await getWorkoutSessions(20);
    const all = await getAllWorkoutSessions();

    // Assert: analytics/PR scans never see the tombstoned session
    expect(limited.map((s) => s.id)).toEqual(['live']);
    expect(all.map((s) => s.id)).toEqual(['live']);
  });
});

// ── Fix #1: template tombstone propagation ───────────────────────────────────

describe('mergeWorkoutTemplatesFromCloud — tombstone propagation', () => {
  it('deletes the local template when the cloud row carries deletedAt', async () => {
    await dbPut(STORES.WORKOUT_TEMPLATES, makeTemplate('t1'));

    const result = await mergeWorkoutTemplatesFromCloud([
      makeTemplate('t1', { deletedAt: newerTime, updatedAt: newerTime }) as never,
    ]);

    expect(result.deleted).toBe(1);
    const stored = await dbGetAll(STORES.WORKOUT_TEMPLATES);
    expect(stored).toHaveLength(0);
  });

  it('getWorkoutTemplates excludes tombstoned templates', async () => {
    await dbPut(STORES.WORKOUT_TEMPLATES, makeTemplate('t1'));
    await dbPut(STORES.WORKOUT_TEMPLATES, makeTemplate('t2', { deletedAt: newerTime }));

    const visible = await getWorkoutTemplates();
    expect(visible.map((t) => t.id)).toEqual(['t1']);
  });
});

// ── Fix #4: water soft-delete propagation ────────────────────────────────────

describe('mergeWaterLogsFromCloud — tombstone propagation', () => {
  it('removes the local water entry when the cloud row is tombstoned', async () => {
    await dbPut(STORES.WATER_LOGS, {
      id: 'w1',
      date: '2026-05-20',
      amountMl: 250,
      createdAt: baseTime,
    });

    await mergeWaterLogsFromCloud([
      { id: 'w1', date: '2026-05-20', amountMl: 250, createdAt: baseTime, deletedAt: newerTime },
    ]);

    const stored = await dbGetAll(STORES.WATER_LOGS);
    expect(stored).toHaveLength(0);
  });

  it('inserts new cloud entries and ignores tombstones for missing rows', async () => {
    await mergeWaterLogsFromCloud([
      { id: 'w2', date: '2026-05-21', amountMl: 500, createdAt: baseTime },
      { id: 'gone', date: '2026-05-21', amountMl: 0, createdAt: baseTime, deletedAt: newerTime },
    ]);

    const stored = await dbGetAll<{ id: string }>(STORES.WATER_LOGS);
    expect(stored.map((e) => e.id)).toEqual(['w2']);
  });
});

// ── Fix #5: AI conversation message union ────────────────────────────────────

describe('unionMessagesById', () => {
  it('keeps messages from both sides, sorted by timestamp', () => {
    // Arrange: two devices appended different messages to the same conversation
    const local = [
      { id: 'm1', role: 'user', content: 'hi', timestamp: '2026-05-20T10:00:00.000Z' },
      { id: 'm2', role: 'assistant', content: 'hello', timestamp: '2026-05-20T10:01:00.000Z' },
    ];
    const cloud = [
      { id: 'm1', role: 'user', content: 'hi', timestamp: '2026-05-20T10:00:00.000Z' },
      { id: 'm3', role: 'user', content: 'bye', timestamp: '2026-05-20T10:02:00.000Z' },
    ];

    // Act
    const merged = unionMessagesById(local, cloud);

    // Assert: no message lost, deduped by id, chronological
    expect(merged.map((m) => m.id)).toEqual(['m1', 'm2', 'm3']);
  });

  it('prefers the newer copy when the same id differs', () => {
    const local = [{ id: 'm1', content: 'old', timestamp: '2026-05-20T10:00:00.000Z' }];
    const cloud = [{ id: 'm1', content: 'new', timestamp: '2026-05-20T11:00:00.000Z' }];

    const merged = unionMessagesById(local, cloud);

    expect(merged).toHaveLength(1);
    expect(merged[0]?.content).toBe('new');
  });

  it('handles empty/undefined inputs without throwing', () => {
    expect(unionMessagesById(undefined, undefined)).toEqual([]);
    expect(unionMessagesById([], [{ id: 'x', timestamp: baseTime }])).toHaveLength(1);
  });
});

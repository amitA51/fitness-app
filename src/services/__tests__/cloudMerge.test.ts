import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../supabaseAuth', () => ({ getCurrentUser: vi.fn(async () => null) }));
vi.mock('../supabaseSync', () => ({
  deleteCloudWorkoutSession: vi.fn(),
  deleteCloudWorkoutTemplate: vi.fn(),
  syncWorkoutSession: vi.fn(),
  syncWorkoutTemplate: vi.fn(),
}));

import type { WorkoutSession, WorkoutTemplate } from '../../types';
import {
  mergeAIConversationsFromCloud,
  mergeGenericRecords,
  safeTimestamp,
  unionMessagesById,
} from '../cloudMerge';
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
    const legacy: Omit<WorkoutSession, 'createdAt' | 'updatedAt'> = {
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

    const cloud: WorkoutSession = {
      ...legacy,
      updatedAt: '2026-06-01T00:00:00Z',
      createdAt: '2026-01-01T00:00:00Z',
    };
    const result = await mergeWorkoutSessionsFromCloud([cloud]);
    expect(result.updated).toBe(1);

    const stored = await dbGetAll(STORES.WORKOUT_SESSIONS);
    expect((stored[0] as WorkoutSession).updatedAt).toBe('2026-06-01T00:00:00Z');
  });
});

// --- templateDb merge integration ---

describe('mergeWorkoutTemplatesFromCloud', () => {
  it('cloud record with timestamps beats local with undefined timestamps', async () => {
    const legacy: Omit<WorkoutTemplate, 'createdAt' | 'updatedAt'> = {
      id: 't1',
      name: 'Test',
      description: '',
      exercises: [],
      lastUsed: null,
      timesUsed: 0,
      isFavorite: false,
    };
    await dbPut(STORES.WORKOUT_TEMPLATES, legacy);

    const cloud: WorkoutTemplate = {
      ...legacy,
      updatedAt: '2026-06-01T00:00:00Z',
      createdAt: '2026-01-01T00:00:00Z',
    };
    const result = await mergeWorkoutTemplatesFromCloud([cloud]);
    expect(result.updated).toBe(1);

    const stored = await dbGetAll(STORES.WORKOUT_TEMPLATES);
    expect((stored[0] as WorkoutTemplate).updatedAt).toBe('2026-06-01T00:00:00Z');
  });
});

// --- unionMessagesById unit tests (pure) ---

describe('unionMessagesById', () => {
  it('returns empty array for empty/undefined inputs', () => {
    expect(unionMessagesById()).toEqual([]);
    expect(unionMessagesById([], [])).toEqual([]);
  });

  it('keeps every unique message from both sides', () => {
    const local = [{ id: 'a', timestamp: '2026-01-01T00:00:00Z' }];
    const cloud = [{ id: 'b', timestamp: '2026-01-02T00:00:00Z' }];
    const merged = unionMessagesById(local, cloud);
    expect(merged.map((m) => m.id)).toEqual(['a', 'b']);
  });

  it('sorts merged messages chronologically by timestamp', () => {
    const local = [{ id: 'late', timestamp: '2026-03-01T00:00:00Z' }];
    const cloud = [{ id: 'early', timestamp: '2026-01-01T00:00:00Z' }];
    const merged = unionMessagesById(local, cloud);
    expect(merged.map((m) => m.id)).toEqual(['early', 'late']);
  });

  it('on duplicate id, keeps the copy with the newer timestamp', () => {
    const local = [{ id: 'a', content: 'old', timestamp: '2026-01-01T00:00:00Z' }];
    const cloud = [{ id: 'a', content: 'new', timestamp: '2026-02-01T00:00:00Z' }];
    const merged = unionMessagesById(local, cloud);
    expect(merged).toHaveLength(1);
    expect(merged[0]!.content).toBe('new');
  });

  it('skips messages without an id', () => {
    const local = [{ id: '', content: 'no-id' } as { id: string; content: string }];
    const cloud = [{ id: 'valid', content: 'ok' }];
    const merged = unionMessagesById(local, cloud);
    expect(merged.map((m) => m.id)).toEqual(['valid']);
  });
});

// --- mergeAIConversationsFromCloud integration tests ---

describe('mergeAIConversationsFromCloud', () => {
  it('adds a new cloud conversation that does not exist locally', async () => {
    const result = await mergeAIConversationsFromCloud([
      {
        id: 'c1',
        title: 'Chat',
        messages: [{ id: 'm1', timestamp: '2026-01-01T00:00:00Z' }],
        updatedAt: '2026-01-01T00:00:00Z',
      },
    ]);
    expect(result.added).toBe(1);

    const stored = await dbGetAll<{ id: string; messages: unknown[] }>(STORES.AI_CONVERSATIONS);
    expect(stored).toHaveLength(1);
    expect(stored[0]!.messages).toHaveLength(1);
  });

  it('unions messages from parallel device appends without losing either side', async () => {
    // Local device appended m-local; cloud device appended m-cloud to the same chat.
    await dbPut(STORES.AI_CONVERSATIONS, {
      id: 'c1',
      title: 'Chat',
      messages: [
        { id: 'm-shared', timestamp: '2026-01-01T00:00:00Z' },
        { id: 'm-local', timestamp: '2026-01-02T00:00:00Z' },
      ],
      updatedAt: '2026-01-02T00:00:00Z',
    });

    await mergeAIConversationsFromCloud([
      {
        id: 'c1',
        title: 'Chat',
        messages: [
          { id: 'm-shared', timestamp: '2026-01-01T00:00:00Z' },
          { id: 'm-cloud', timestamp: '2026-01-03T00:00:00Z' },
        ],
        updatedAt: '2026-01-03T00:00:00Z',
      },
    ]);

    const stored = await dbGetAll<{ id: string; messages: { id: string }[] }>(
      STORES.AI_CONVERSATIONS
    );
    const ids = stored[0]!.messages.map((m) => m.id);
    expect(ids).toContain('m-local');
    expect(ids).toContain('m-cloud');
    expect(ids).toContain('m-shared');
    expect(ids).toHaveLength(3);
  });

  it('resolves conversation metadata by last-write-wins (cloud newer)', async () => {
    await dbPut(STORES.AI_CONVERSATIONS, {
      id: 'c1',
      title: 'Old title',
      messages: [{ id: 'm1', timestamp: '2026-01-01T00:00:00Z' }],
      updatedAt: '2026-01-01T00:00:00Z',
    });

    await mergeAIConversationsFromCloud([
      {
        id: 'c1',
        title: 'New title',
        messages: [{ id: 'm1', timestamp: '2026-01-01T00:00:00Z' }],
        updatedAt: '2026-02-01T00:00:00Z',
      },
    ]);

    const stored = await dbGetAll<{ id: string; title: string }>(STORES.AI_CONVERSATIONS);
    expect(stored[0]!.title).toBe('New title');
  });

  it('removes a local conversation when the cloud copy is tombstoned', async () => {
    await dbPut(STORES.AI_CONVERSATIONS, {
      id: 'c1',
      title: 'Chat',
      messages: [{ id: 'm1', timestamp: '2026-01-01T00:00:00Z' }],
      updatedAt: '2026-01-01T00:00:00Z',
    });

    const result = await mergeAIConversationsFromCloud([
      { id: 'c1', deletedAt: '2026-02-01T00:00:00Z' },
    ]);
    expect(result.deleted).toBe(1);

    const stored = await dbGetAll(STORES.AI_CONVERSATIONS);
    expect(stored).toHaveLength(0);
  });

  it('keeps local untouched when cloud is older and has no new messages', async () => {
    await dbPut(STORES.AI_CONVERSATIONS, {
      id: 'c1',
      title: 'Local title',
      messages: [{ id: 'm1', timestamp: '2026-01-01T00:00:00Z' }],
      updatedAt: '2026-03-01T00:00:00Z',
    });

    const result = await mergeAIConversationsFromCloud([
      {
        id: 'c1',
        title: 'Stale cloud title',
        messages: [{ id: 'm1', timestamp: '2026-01-01T00:00:00Z' }],
        updatedAt: '2026-01-01T00:00:00Z',
      },
    ]);
    expect(result.kept).toBe(1);

    const stored = await dbGetAll<{ id: string; title: string }>(STORES.AI_CONVERSATIONS);
    expect(stored[0]!.title).toBe('Local title');
  });
});

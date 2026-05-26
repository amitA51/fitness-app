import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Prevent cloud/auth side effects from running in tests.
vi.mock('../supabaseAuth', () => ({
  getCurrentUser: vi.fn(async () => null),
}));
vi.mock('../supabaseSync', () => ({
  deleteCloudBodyWeight: vi.fn(),
  deleteCloudPersonalExercise: vi.fn(),
  deleteCloudWorkoutSession: vi.fn(),
  deleteCloudWorkoutTemplate: vi.fn(),
  syncBodyWeight: vi.fn(),
  syncPersonalExercise: vi.fn(),
  syncWorkoutSession: vi.fn(),
  syncWorkoutTemplate: vi.fn(),
}));

import { STORES, clearDatabase, dbGetAll, dbPut } from '../indexedDBCore';
import {
  mergePersonalRecordsFromCloud,
  replacePersonalRecordsFromCloud,
  replaceRecoveryLogsFromCloud,
} from '../workoutDb';

interface PRRow {
  id: string;
  exerciseName: string;
  weight: number;
  reps: number;
  date: string;
  createdAt?: string;
  updatedAt?: string;
}

interface RecoveryRow {
  id: string;
  date: string;
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
}

beforeEach(async () => {
  await clearDatabase();
});

afterEach(async () => {
  await clearDatabase();
});

const baseTime = '2026-05-20T10:00:00.000Z';
const newerTime = '2026-05-22T10:00:00.000Z';

const makePR = (id: string, overrides: Partial<PRRow> = {}): PRRow => ({
  id,
  exerciseName: 'Bench Press',
  weight: 100,
  reps: 5,
  date: baseTime,
  createdAt: baseTime,
  updatedAt: baseTime,
  ...overrides,
});

describe('mergePersonalRecordsFromCloud', () => {
  it('keeps local-only rows when cloud does not include them', async () => {
    // Arrange: two local rows
    await dbPut(STORES.PERSONAL_RECORDS, makePR('local-A', { weight: 110 }));
    await dbPut(STORES.PERSONAL_RECORDS, makePR('local-B', { weight: 120 }));

    // Cloud knows about B (updated) and a new C, but not A
    const cloud: PRRow[] = [
      makePR('local-B', { weight: 125, updatedAt: newerTime }),
      makePR('cloud-C', { weight: 90 }),
    ];

    // Act
    await mergePersonalRecordsFromCloud(cloud);

    // Assert: A survives, B reflects newer cloud, C added
    const stored = await dbGetAll<PRRow>(STORES.PERSONAL_RECORDS);
    const byId = new Map(stored.map((r) => [r.id, r]));

    expect(stored).toHaveLength(3);
    expect(byId.get('local-A')?.weight).toBe(110); // untouched
    expect(byId.get('local-B')?.weight).toBe(125); // updated from cloud
    expect(byId.get('cloud-C')?.weight).toBe(90); // newly added
  });

  it('keeps newer local row when cloud row is older', async () => {
    await dbPut(STORES.PERSONAL_RECORDS, makePR('row-X', { weight: 200, updatedAt: newerTime }));

    const olderCloud: PRRow[] = [makePR('row-X', { weight: 150, updatedAt: baseTime })];

    await mergePersonalRecordsFromCloud(olderCloud);

    const [row] = await dbGetAll<PRRow>(STORES.PERSONAL_RECORDS);
    expect(row?.weight).toBe(200);
  });
});

describe('replacePersonalRecordsFromCloud (now non-destructive)', () => {
  it('no longer wipes local-only rows', async () => {
    await dbPut(STORES.PERSONAL_RECORDS, makePR('local-only', { weight: 999 }));

    // Cloud has unrelated rows
    await replacePersonalRecordsFromCloud([
      makePR('cloud-1', { weight: 50 }),
      makePR('cloud-2', { weight: 60 }),
    ]);

    const stored = await dbGetAll<PRRow>(STORES.PERSONAL_RECORDS);
    const ids = stored.map((r) => r.id).sort();
    expect(ids).toEqual(['cloud-1', 'cloud-2', 'local-only']);
  });
});

describe('replaceRecoveryLogsFromCloud (now non-destructive)', () => {
  it('preserves local recovery rows absent from cloud payload', async () => {
    const localOnly: RecoveryRow = {
      id: 'r-local',
      date: '2026-05-21',
      notes: 'felt good',
      createdAt: baseTime,
      updatedAt: baseTime,
    };
    await dbPut(STORES.RECOVERY_LOGS, localOnly);

    await replaceRecoveryLogsFromCloud([
      {
        id: 'r-cloud',
        date: '2026-05-23',
        notes: 'cloud',
        createdAt: newerTime,
        updatedAt: newerTime,
      } as RecoveryRow,
    ]);

    const stored = await dbGetAll<RecoveryRow>(STORES.RECOVERY_LOGS);
    const ids = stored.map((r) => r.id).sort();
    expect(ids).toEqual(['r-cloud', 'r-local']);
  });
});

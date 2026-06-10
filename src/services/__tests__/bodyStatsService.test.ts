import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../supabaseAuth', () => ({
  getCurrentUser: vi.fn(async () => null),
}));

vi.mock('../supabaseSync', () => ({
  deleteCloudBodyWeight: vi.fn(),
  deleteCloudRecoveryLog: vi.fn(),
  syncBodyMeasurement: vi.fn(),
  syncBodyWeight: vi.fn(),
  syncRecoveryLog: vi.fn(),
}));

// Stub the retry engine so sync wiring (tags + offline-queue descriptors) can
// be asserted without real backoff timers or a configured Supabase.
vi.mock('../syncEngine', () => ({ syncWithRetry: vi.fn(() => Promise.resolve(true)) }));

import {
  type RecoveryLog,
  addRecoveryLog,
  calculateRecoveryScore,
  deleteBodyWeight,
  deleteRecoveryLog,
  getRecoveryLogsByDateRange,
  getTodayRecoveryLog,
} from '../bodyStatsService';
import { STORES, clearDatabase, dbPut } from '../indexedDBCore';
import { getCurrentUser } from '../supabaseAuth';
import { deleteCloudBodyWeight, deleteCloudRecoveryLog } from '../supabaseSync';
import { syncWithRetry } from '../syncEngine';

const mockGetCurrentUser = vi.mocked(getCurrentUser);
const mockSyncWithRetry = vi.mocked(syncWithRetry);

const recoveryInput = (
  date: string,
  overrides: Partial<Omit<RecoveryLog, 'id' | 'createdAt'>> = {}
): Omit<RecoveryLog, 'id' | 'createdAt'> => ({
  date,
  sleepHours: 8,
  sleepQuality: 4,
  sorenessLevel: 4,
  energyLevel: 4,
  stressLevel: 4,
  tightAreas: [],
  notes: '',
  ...overrides,
});

beforeEach(async () => {
  await clearDatabase();
});

afterEach(async () => {
  await clearDatabase();
});

describe('bodyStatsService recovery logs', () => {
  it('stores the computed recovery score when adding a recovery log', async () => {
    const input = recoveryInput('2026-04-26');
    const saved = await addRecoveryLog(input);

    expect(saved.overallScore).toBe(calculateRecoveryScore(saved).overall);
  });

  it('mints a UUID id for new recovery logs (cloud recovery_logs.id is uuid)', async () => {
    const saved = await addRecoveryLog(recoveryInput('2026-04-27'));

    expect(saved.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
  });

  it('updates the canonical log instead of duplicating the same date', async () => {
    const first = await addRecoveryLog(recoveryInput('2026-04-26', { energyLevel: 2 }));
    const second = await addRecoveryLog(recoveryInput('2026-04-26', { energyLevel: 5 }));

    const logs = await getRecoveryLogsByDateRange('2026-04-26', '2026-04-26');

    expect(second.id).toBe(first.id);
    expect(logs).toHaveLength(1);
    expect(logs[0]?.energyLevel).toBe(5);
    expect(logs[0]?.overallScore).toBe(calculateRecoveryScore(logs[0]!).overall);
  });

  it('returns the newest same-day recovery log when old duplicates exist', async () => {
    await dbPut<RecoveryLog>(STORES.RECOVERY_LOGS, {
      ...recoveryInput('2026-04-26', { energyLevel: 1 }),
      id: 'rec-old',
      createdAt: '2026-04-26T06:00:00.000Z',
    });
    await dbPut<RecoveryLog>(STORES.RECOVERY_LOGS, {
      ...recoveryInput('2026-04-26', { energyLevel: 5 }),
      id: 'rec-new',
      createdAt: '2026-04-26T18:00:00.000Z',
    });

    const today = await getTodayRecoveryLog(new Date('2026-04-26T20:00:00.000Z'));

    expect(today?.id).toBe('rec-new');
  });
});

describe('bodyStatsService cloud-delete wiring (tombstones + offline queue)', () => {
  const signIn = () => mockGetCurrentUser.mockResolvedValue({ id: 'user-1' } as never);
  const signOutMock = () => mockGetCurrentUser.mockResolvedValue(null);

  afterEach(() => {
    signOutMock();
    mockSyncWithRetry.mockClear();
  });

  it('deleteBodyWeight soft-deletes via deleteCloudBodyWeight with a bodyweight:delete descriptor', async () => {
    signIn();

    await deleteBodyWeight('bw-1');

    const call = mockSyncWithRetry.mock.calls.find((c) => c[1] === 'deleteBodyWeight:bw-1');
    expect(call).toBeDefined();
    expect(call![2]).toBe(3);
    expect(call![3]).toEqual({ type: 'bodyweight:delete', payload: 'bw-1' });
    // The sync fn must be the targeted UPDATE helper, not an empty-date upsert.
    await (call![0] as () => Promise<void>)();
    expect(vi.mocked(deleteCloudBodyWeight)).toHaveBeenCalledWith('user-1', 'bw-1');
  });

  it('deleteRecoveryLog soft-deletes via deleteCloudRecoveryLog with a recovery:delete descriptor', async () => {
    signIn();

    await deleteRecoveryLog('rec-1');

    const call = mockSyncWithRetry.mock.calls.find((c) => c[1] === 'deleteRecoveryLog:rec-1');
    expect(call).toBeDefined();
    expect(call![3]).toEqual({ type: 'recovery:delete', payload: 'rec-1' });
    await (call![0] as () => Promise<void>)();
    expect(vi.mocked(deleteCloudRecoveryLog)).toHaveBeenCalledWith('user-1', 'rec-1');
  });

  it('addRecoveryLog passes a recovery:create descriptor so offline failures are queued', async () => {
    signIn();

    const saved = await addRecoveryLog(recoveryInput('2026-04-27'));

    const call = mockSyncWithRetry.mock.calls.find((c) => c[1] === `addRecoveryLog:${saved.id}`);
    expect(call).toBeDefined();
    expect(call![3]).toMatchObject({
      type: 'recovery:create',
      payload: expect.objectContaining({ id: saved.id, date: '2026-04-27' }),
    });
  });

  it('addRecoveryLog queues recovery:delete descriptors for same-day duplicate cleanup', async () => {
    await dbPut<RecoveryLog>(STORES.RECOVERY_LOGS, {
      ...recoveryInput('2026-04-28'),
      id: 'rec-dup-old',
      createdAt: '2026-04-28T06:00:00.000Z',
    });
    await dbPut<RecoveryLog>(STORES.RECOVERY_LOGS, {
      ...recoveryInput('2026-04-28'),
      id: 'rec-dup-new',
      createdAt: '2026-04-28T18:00:00.000Z',
    });
    signIn();

    await addRecoveryLog(recoveryInput('2026-04-28', { energyLevel: 5 }));

    const call = mockSyncWithRetry.mock.calls.find((c) => c[1] === 'deleteRecoveryLog:rec-dup-old');
    expect(call).toBeDefined();
    expect(call![3]).toEqual({ type: 'recovery:delete', payload: 'rec-dup-old' });
    await (call![0] as () => Promise<void>)();
    expect(vi.mocked(deleteCloudRecoveryLog)).toHaveBeenCalledWith('user-1', 'rec-dup-old');
  });
});

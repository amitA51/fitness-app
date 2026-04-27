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

import {
  type RecoveryLog,
  addRecoveryLog,
  calculateRecoveryScore,
  getRecoveryLogsByDateRange,
  getTodayRecoveryLog,
} from '../bodyStatsService';
import { STORES, clearDatabase, dbPut } from '../indexedDBCore';

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

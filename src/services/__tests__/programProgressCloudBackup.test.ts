/**
 * Regression tests for the two defects that let a trainee's 12-week program
 * progress be destroyed, reported as "I was on week 6 and it showed week 1".
 *
 * 1. `bbt_program_progress_v1` lived ONLY in localStorage while also being listed
 *    in USER_SCOPED_STORAGE_REGISTRY, so `clearUserScopedLocalData()` — which runs
 *    on sign-out AND on any transient "invalid JWT" — erased it permanently.
 * 2. Every `user_settings` upsert sent `id: `${userId}:${key}``, which is not a
 *    uuid, so the cloud rejected it with 22P02 and the table stayed empty. Even
 *    once progress was mirrored, it could never have reached the cloud.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

const PROGRESS_KEY = 'bbt_program_progress_v1';

describe('program progress survives a user-scoped local wipe', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.resetModules();
  });

  it('restores a week-6 pointer from the cloud after localStorage is cleared', async () => {
    const cloudProgress = {
      programId: 'bbt-intermediate-advanced',
      startedAt: '2026-06-15T14:04:28.230Z',
      currentWeek: 6,
      currentDayIndex: 2,
      completed: [],
      pending: null,
      status: 'active',
      updatedAt: '2026-07-20T13:14:10.847Z',
    };

    vi.doMock('../indexedDBCore', () => ({
      STORES: { USER_SETTINGS: 'user_settings', WORKOUT_TEMPLATES: 'workout_templates' },
      dbPut: vi.fn().mockResolvedValue(undefined),
      dbGetAll: vi
        .fn()
        .mockResolvedValue([
          { key: PROGRESS_KEY, value: cloudProgress, updatedAt: '2026-07-20T13:14:10.847Z' },
        ]),
    }));

    const { getProgress, restoreProgramProgressFromCloud } = await import(
      '../programProgressService'
    );

    // The wipe already happened: nothing local to fall back on.
    expect(getProgress()).toBeNull();

    expect(await restoreProgramProgressFromCloud()).toBe(true);
    expect(getProgress()).toMatchObject({ currentWeek: 6, currentDayIndex: 2 });
  });

  it('does not let an older cloud copy roll back newer local progress', async () => {
    const localProgress = {
      programId: 'bbt-intermediate-advanced',
      startedAt: '2026-06-15T14:04:28.230Z',
      currentWeek: 7,
      currentDayIndex: 0,
      completed: [],
      pending: null,
      status: 'active',
      updatedAt: '2026-07-26T10:00:00.000Z',
    };
    localStorage.setItem(PROGRESS_KEY, JSON.stringify(localProgress));

    vi.doMock('../indexedDBCore', () => ({
      STORES: { USER_SETTINGS: 'user_settings', WORKOUT_TEMPLATES: 'workout_templates' },
      dbPut: vi.fn().mockResolvedValue(undefined),
      dbGetAll: vi.fn().mockResolvedValue([
        {
          key: PROGRESS_KEY,
          value: { ...localProgress, currentWeek: 5 },
          updatedAt: '2026-07-20T13:14:10.847Z',
        },
      ]),
    }));

    const { getProgress, restoreProgramProgressFromCloud } = await import(
      '../programProgressService'
    );

    expect(await restoreProgramProgressFromCloud()).toBe(false);
    expect(getProgress()?.currentWeek).toBe(7);
  });

  it('mirrors progress into the cloud-synced settings store on save', async () => {
    const dbPut = vi.fn().mockResolvedValue(undefined);
    const queueMutation = vi.fn().mockResolvedValue(undefined);

    vi.doMock('../indexedDBCore', () => ({
      STORES: { USER_SETTINGS: 'user_settings', WORKOUT_TEMPLATES: 'workout_templates' },
      dbPut,
      dbGetAll: vi.fn().mockResolvedValue([]),
    }));
    vi.doMock('../offlineQueue', () => ({ queueMutation }));

    const { startProgram } = await import('../programProgressService');
    startProgram();

    // mirrorToCloud is fire-and-forget; let its microtasks drain.
    await vi.waitFor(() => {
      expect(dbPut).toHaveBeenCalledWith(
        'user_settings',
        expect.objectContaining({
          key: PROGRESS_KEY,
        })
      );
      expect(queueMutation).toHaveBeenCalledWith(
        'setting:update',
        expect.objectContaining({
          key: PROGRESS_KEY,
        })
      );
    });
  });
});

describe('user_settings cloud upsert', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('omits the surrogate id so the uuid column is not sent a composite string', async () => {
    const upsert = vi.fn().mockResolvedValue({ error: null });

    vi.doMock('../../lib/supabase', () => ({
      isSupabaseConfigured: () => true,
      supabase: { from: () => ({ upsert }) },
    }));

    const { syncUserSetting } = await import('../supabaseMiscSync');
    await syncUserSetting('c363a4e2-f0b8-4693-b07f-a70d48b68f63', {
      key: PROGRESS_KEY,
      value: { currentWeek: 6 },
    });

    const [payload, options] = upsert.mock.calls[0] ?? [];
    // The regression: `id` used to be `${userId}:${key}`, which 22P02'd every write.
    expect(payload).not.toHaveProperty('id');
    expect(payload).toMatchObject({
      user_id: 'c363a4e2-f0b8-4693-b07f-a70d48b68f63',
      key: PROGRESS_KEY,
    });
    // Identity has to come from the composite unique constraint instead.
    expect(options).toEqual({ onConflict: 'user_id,key' });
  });
});

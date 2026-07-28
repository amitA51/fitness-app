/**
 * Regression tests for the localStorage -> cloud mirror.
 *
 * The defect: body profile, workout preferences, nutrition goals and app settings
 * lived ONLY in localStorage while also being listed in
 * USER_SCOPED_STORAGE_REGISTRY, so an account switch destroyed them permanently.
 * This is the same shape as the bug that erased a user's 12-week program progress.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

const PROFILE_KEY = 'user_profile';

describe('localStateMirror', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.resetModules();
  });

  it('mirrors a local key into the cloud-synced settings store and queues it', async () => {
    const dbPut = vi.fn().mockResolvedValue(undefined);
    const queueMutation = vi.fn().mockResolvedValue(undefined);
    vi.doMock('../indexedDBCore', () => ({
      STORES: { USER_SETTINGS: 'user_settings' },
      dbPut,
      dbGetAll: vi.fn().mockResolvedValue([]),
    }));
    vi.doMock('../offlineQueue', () => ({ queueMutation }));

    localStorage.setItem(PROFILE_KEY, JSON.stringify({ heightCm: 180, weightKg: 80 }));

    const { mirrorLocalKey } = await import('../localStateMirror');
    mirrorLocalKey(PROFILE_KEY);

    await vi.waitFor(() => {
      expect(dbPut).toHaveBeenCalledWith(
        'user_settings',
        expect.objectContaining({ key: `mirror:${PROFILE_KEY}` })
      );
      expect(queueMutation).toHaveBeenCalledWith(
        'setting:update',
        expect.objectContaining({ key: `mirror:${PROFILE_KEY}` })
      );
    });
  });

  it('restores a key the account-switch wipe destroyed', async () => {
    const raw = JSON.stringify({ heightCm: 180, weightKg: 80, age: 30 });
    vi.doMock('../indexedDBCore', () => ({
      STORES: { USER_SETTINGS: 'user_settings' },
      dbPut: vi.fn().mockResolvedValue(undefined),
      dbGetAll: vi.fn().mockResolvedValue([
        {
          key: `mirror:${PROFILE_KEY}`,
          value: { __mirroredAt: '2026-07-20T10:00:00.000Z', raw },
        },
      ]),
    }));

    const { restoreMirroredLocalKeys } = await import('../localStateMirror');

    // The wipe already happened.
    expect(localStorage.getItem(PROFILE_KEY)).toBeNull();

    const restored = await restoreMirroredLocalKeys();

    expect(restored).toContain(PROFILE_KEY);
    expect(localStorage.getItem(PROFILE_KEY)).toBe(raw);
  });

  it('does not clobber a local value that is newer than the cloud copy', async () => {
    const localRaw = JSON.stringify({ weightKg: 82 });
    const cloudRaw = JSON.stringify({ weightKg: 75 });
    localStorage.setItem(PROFILE_KEY, localRaw);

    vi.doMock('../indexedDBCore', () => ({
      STORES: { USER_SETTINGS: 'user_settings' },
      dbPut: vi.fn().mockResolvedValue(undefined),
      // The stored stamp belongs to the CURRENT local value, so the older cloud
      // copy must lose.
      dbGetAll: vi.fn().mockResolvedValue([
        {
          key: `mirror:${PROFILE_KEY}`,
          value: { __mirroredAt: '2026-07-26T10:00:00.000Z', raw: localRaw },
        },
      ]),
    }));

    const { restoreMirroredLocalKeys } = await import('../localStateMirror');
    const restored = await restoreMirroredLocalKeys();

    expect(restored).not.toContain(PROFILE_KEY);
    expect(localStorage.getItem(PROFILE_KEY)).toBe(localRaw);
    expect(localStorage.getItem(PROFILE_KEY)).not.toBe(cloudRaw);
  });

  it('refuses to overwrite a working local value with an unparseable cloud one', async () => {
    const localRaw = JSON.stringify({ weightKg: 82 });
    localStorage.setItem(PROFILE_KEY, localRaw);

    vi.doMock('../indexedDBCore', () => ({
      STORES: { USER_SETTINGS: 'user_settings' },
      dbPut: vi.fn().mockResolvedValue(undefined),
      dbGetAll: vi.fn().mockResolvedValue([
        {
          key: `mirror:${PROFILE_KEY}`,
          value: { __mirroredAt: '2099-01-01T00:00:00.000Z', raw: '{corrupt' },
        },
      ]),
    }));

    const { restoreMirroredLocalKeys } = await import('../localStateMirror');
    await restoreMirroredLocalKeys();

    expect(localStorage.getItem(PROFILE_KEY)).toBe(localRaw);
  });

  it('ignores rows that are not mirror envelopes', async () => {
    vi.doMock('../indexedDBCore', () => ({
      STORES: { USER_SETTINGS: 'user_settings' },
      dbPut: vi.fn().mockResolvedValue(undefined),
      // A plain setting row, not a mirror envelope, must not be written to
      // localStorage as if it were one.
      dbGetAll: vi
        .fn()
        .mockResolvedValue([{ key: `mirror:${PROFILE_KEY}`, value: { weightKg: 80 } }]),
    }));

    const { restoreMirroredLocalKeys } = await import('../localStateMirror');
    const restored = await restoreMirroredLocalKeys();

    expect(restored).toHaveLength(0);
    expect(localStorage.getItem(PROFILE_KEY)).toBeNull();
  });
});

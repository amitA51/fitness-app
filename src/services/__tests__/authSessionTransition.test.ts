// ============================================================================
// Auth session transition — cross-account local data isolation (security P0-01)
// ============================================================================
// Before this logic existed, local cleanup ran only inside the explicit
// signOut() path. A token expiry, a sign-out from another tab, or signing in as
// user B without user A pressing "log out" left A's IndexedDB rows on the
// device, and pullAllData() then MERGED B's cloud data into them.
//
// These tests lock the three behaviours that make that impossible:
//   1. switching identity wipes local stores (before any pull can run)
//   2. sign-out / expiry wipes local stores even with no known previous user
//   3. the SAME user re-authenticating does NOT wipe anything (no data loss)
// ============================================================================

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { STORES, clearDatabase, dbGetAll, dbPut } from '../indexedDBCore';
import {
  LAST_SIGNED_IN_USER_ID_KEY,
  PENDING_AUTH_REDIRECT_KEY,
  PENDING_INVITE_CODE_KEY,
} from '../userScopedLocalData';

// The queue owns its own IndexedDB lifecycle; the transition only needs to know
// that it was asked to drop pending mutations for the outgoing account.
const clearMutationQueue = vi.hoisted(() => vi.fn(async () => {}));
vi.mock('../offlineQueue', () => ({ clearMutationQueue }));

async function seedLocalUserData() {
  await dbPut(STORES.WORKOUT_SESSIONS, {
    id: 'session-a',
    date: '2026-07-01',
    exercises: [],
  } as unknown as Record<string, unknown>);
  localStorage.setItem('user_profile', JSON.stringify({ name: 'משתמש א' }));
  localStorage.setItem('bbt_program_progress_v1', JSON.stringify({ week: 3 }));
  localStorage.setItem('appSettings', JSON.stringify({ theme: 'dark' }));
  sessionStorage.setItem('onboarding_step', '2');
}

beforeEach(async () => {
  clearMutationQueue.mockClear();
  localStorage.clear();
  sessionStorage.clear();
  await clearDatabase();
});

afterEach(async () => {
  await clearDatabase();
});

describe('transitionAuthSession — identity change', () => {
  it('clears the previous account IndexedDB rows and user-scoped keys', async () => {
    const { transitionAuthSession } = await import('../authSessionTransition');
    localStorage.setItem(LAST_SIGNED_IN_USER_ID_KEY, 'user-a');
    await seedLocalUserData();

    const result = await transitionAuthSession('user-b');

    expect(result).toMatchObject({
      previousUserId: 'user-a',
      nextUserId: 'user-b',
      localDataCleared: true,
    });
    expect(await dbGetAll(STORES.WORKOUT_SESSIONS)).toHaveLength(0);
    expect(localStorage.getItem('user_profile')).toBeNull();
    expect(localStorage.getItem('bbt_program_progress_v1')).toBeNull();
    expect(localStorage.getItem('appSettings')).toBeNull();
    expect(sessionStorage.getItem('onboarding_step')).toBeNull();
    expect(clearMutationQueue).toHaveBeenCalledTimes(1);
  });

  it('records the new identity so the next transition can compare against it', async () => {
    const { getLastSignedInUserId, transitionAuthSession } = await import(
      '../authSessionTransition'
    );

    await transitionAuthSession('user-b');

    expect(getLastSignedInUserId()).toBe('user-b');
  });

  it('clears local data on sign-out even when no previous user is recorded', async () => {
    const { transitionAuthSession } = await import('../authSessionTransition');
    await seedLocalUserData();

    const result = await transitionAuthSession(null, { forceCleanup: true });

    expect(result.localDataCleared).toBe(true);
    expect(await dbGetAll(STORES.WORKOUT_SESSIONS)).toHaveLength(0);
    expect(localStorage.getItem(LAST_SIGNED_IN_USER_ID_KEY)).toBeNull();
  });
});

describe('transitionAuthSession — same identity', () => {
  it('keeps local data when the same user re-authenticates', async () => {
    const { transitionAuthSession } = await import('../authSessionTransition');
    localStorage.setItem(LAST_SIGNED_IN_USER_ID_KEY, 'user-a');
    await seedLocalUserData();

    const result = await transitionAuthSession('user-a');

    expect(result.localDataCleared).toBe(false);
    expect(await dbGetAll(STORES.WORKOUT_SESSIONS)).toHaveLength(1);
    expect(localStorage.getItem('user_profile')).not.toBeNull();
    expect(clearMutationQueue).not.toHaveBeenCalled();
  });
});

describe('transitionAuthSession — invite continuation', () => {
  it('preserves only the invite keys that the post-login join flow consumes', async () => {
    const { transitionAuthSession } = await import('../authSessionTransition');
    localStorage.setItem(LAST_SIGNED_IN_USER_ID_KEY, 'user-a');
    await seedLocalUserData();
    localStorage.setItem(PENDING_INVITE_CODE_KEY, 'ABC123');
    localStorage.setItem(PENDING_AUTH_REDIRECT_KEY, '/join?code=ABC123');

    await transitionAuthSession('user-b', {
      preserveLocalStorageKeys: [PENDING_INVITE_CODE_KEY, PENDING_AUTH_REDIRECT_KEY],
    });

    expect(localStorage.getItem(PENDING_INVITE_CODE_KEY)).toBe('ABC123');
    expect(localStorage.getItem(PENDING_AUTH_REDIRECT_KEY)).toBe('/join?code=ABC123');
    // Everything else still had to go.
    expect(localStorage.getItem('user_profile')).toBeNull();
    expect(await dbGetAll(STORES.WORKOUT_SESSIONS)).toHaveLength(0);
  });
});

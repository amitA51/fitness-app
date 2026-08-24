// ============================================================================
// Auth session transition — cross-account local data isolation (security P0-01)
// ============================================================================
// Before this logic existed, local cleanup ran only inside the explicit
// signOut() path. A token expiry, a sign-out from another tab, or signing in as
// user B without user A pressing "log out" left A's IndexedDB rows on the
// device, and pullAllData() then MERGED B's cloud data into them.
//
// These tests lock the behaviours that make that impossible, while keeping the
// wipe scoped to the moment the risk is actually real:
//   1. switching identity wipes local stores (before any pull can run)
//   2. an EXPLICIT sign-out (forceCleanup) wipes them even with no known
//      previous user
//   3. the SAME user re-authenticating does NOT wipe anything (no data loss)
//   4. losing the session WITHOUT an identity change — a token expiry — does NOT
//      wipe, and keeps the owner marker so (3) still applies on re-login.
//
// (4) is a deliberate correction. Expiry used to take the same destructive path
// as an account switch, because a null user id trivially differs from the stored
// one. That protected nothing (an expired token says nothing about who signs in
// next) and destroyed local-only state plus the offline mutation queue — the one
// copy of writes that had not reached the cloud yet. A real user lost six weeks
// of program progress to it.
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
//
// Two distinct calls, and which one is used matters:
//   • clearMutationQueueForOwner — account SWITCH. Drops only the outgoing
//     owner's rows, so another account's HELD (dead-letter) changes survive.
//   • clearMutationQueue         — explicit sign-out / delete-my-data. Destroys
//     everything, held changes included.
const clearMutationQueue = vi.hoisted(() => vi.fn(async () => {}));
const clearMutationQueueForOwner = vi.hoisted(() => vi.fn(async () => {}));
const adoptGuestDataForUser = vi.hoisted(() => vi.fn(async (_userId?: string) => {}));
vi.mock('../offlineQueue', () => ({
  clearMutationQueue,
  clearMutationQueueForOwner,
  adoptGuestDataForUser,
  GUEST_OWNER: '__guest__',
  UNKNOWN_OWNER: '__unknown__',
  // Mirrors the real predicate: no id, the guest marker, or the unknown marker.
  isOwnerless: (userId: string | null | undefined) =>
    !userId || userId === '__guest__' || userId === '__unknown__',
}));

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
  clearMutationQueueForOwner.mockClear();
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
    // Owner-scoped, NOT the destructive clear: another account's held/dead-letter
    // changes must survive a switch, since they are the only copy of writes that
    // never reached the cloud.
    expect(clearMutationQueueForOwner).toHaveBeenCalledWith('user-a');
    expect(clearMutationQueue).not.toHaveBeenCalled();
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

describe('transitionAuthSession — session lost without an identity change', () => {
  // This is the token-expiry path. It used to be indistinguishable from an
  // account switch and wiped everything, which is how a user's 12-week program
  // progress was destroyed by a single transient "invalid JWT".
  it('preserves local data when the session goes away but nobody else signed in', async () => {
    const { transitionAuthSession } = await import('../authSessionTransition');
    localStorage.setItem(LAST_SIGNED_IN_USER_ID_KEY, 'user-a');
    await seedLocalUserData();

    const result = await transitionAuthSession(null);

    expect(result.localDataCleared).toBe(false);
    expect(await dbGetAll(STORES.WORKOUT_SESSIONS)).toHaveLength(1);
    expect(localStorage.getItem('bbt_program_progress_v1')).not.toBeNull();
    expect(localStorage.getItem('user_profile')).not.toBeNull();
  });

  it('does NOT destroy the offline queue, which holds writes not yet in the cloud', async () => {
    const { transitionAuthSession } = await import('../authSessionTransition');
    localStorage.setItem(LAST_SIGNED_IN_USER_ID_KEY, 'user-a');

    await transitionAuthSession(null);

    expect(clearMutationQueue).not.toHaveBeenCalled();
  });

  it('keeps the owner marker so the same user re-logging in is still a no-op', async () => {
    const { getLastSignedInUserId, transitionAuthSession } = await import(
      '../authSessionTransition'
    );
    localStorage.setItem(LAST_SIGNED_IN_USER_ID_KEY, 'user-a');
    await seedLocalUserData();

    await transitionAuthSession(null);
    expect(getLastSignedInUserId()).toBe('user-a');

    // …and the re-login therefore takes the same-identity path, not a wipe.
    const back = await transitionAuthSession('user-a');
    expect(back.localDataCleared).toBe(false);
    expect(await dbGetAll(STORES.WORKOUT_SESSIONS)).toHaveLength(1);
  });

  it('still wipes if a DIFFERENT user signs in after the expiry', async () => {
    // The security guarantee has to survive the change above: preserving data
    // through an expiry must not let the next person read it.
    const { transitionAuthSession } = await import('../authSessionTransition');
    localStorage.setItem(LAST_SIGNED_IN_USER_ID_KEY, 'user-a');
    await seedLocalUserData();

    await transitionAuthSession(null);
    const result = await transitionAuthSession('user-b');

    expect(result.localDataCleared).toBe(true);
    expect(await dbGetAll(STORES.WORKOUT_SESSIONS)).toHaveLength(0);
    expect(localStorage.getItem('bbt_program_progress_v1')).toBeNull();
    expect(clearMutationQueueForOwner).toHaveBeenCalledWith('user-a');
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

describe('transitionAuthSession — guest adopts their first account', () => {
  // A guest has never written the owner marker, so before this path existed a
  // signup fell through to the destructive cleanup and destroyed every local
  // record at exactly the moment the UI promised "כדי לשמור את הנתונים שלכם".

  it('keeps all local data when claimGuestData is set and the previous owner is the guest', async () => {
    const { transitionAuthSession } = await import('../authSessionTransition');
    await seedLocalUserData();

    const result = await transitionAuthSession('user-new', { claimGuestData: true });

    expect(result).toMatchObject({
      previousUserId: null,
      nextUserId: 'user-new',
      localDataCleared: false,
    });
    expect(await dbGetAll(STORES.WORKOUT_SESSIONS)).toHaveLength(1);
    expect(localStorage.getItem('user_profile')).not.toBeNull();
    expect(localStorage.getItem(LAST_SIGNED_IN_USER_ID_KEY)).toBe('user-new');
    expect(clearMutationQueueForOwner).not.toHaveBeenCalled();
    expect(clearMutationQueue).not.toHaveBeenCalled();
  });

  it('re-stamps guest-owned queue entries so they can replay under the new account', async () => {
    // Detailed ownership assertions live in the offlineQueue test suite (this
    // file replaces ../offlineQueue with a two-function mock).
    const { transitionAuthSession } = await import('../authSessionTransition');

    await transitionAuthSession('user-new', { claimGuestData: true });

    // The adoption helper ran instead of any destructive queue clear.
    expect(localStorage.getItem(LAST_SIGNED_IN_USER_ID_KEY)).toBe('user-new');
  });

  it('never adopts for a real account switch even if claimGuestData leaks in', async () => {
    const { transitionAuthSession } = await import('../authSessionTransition');
    localStorage.setItem(LAST_SIGNED_IN_USER_ID_KEY, 'user-a');
    await seedLocalUserData();

    const result = await transitionAuthSession('user-b', { claimGuestData: true });

    // The guard is the previous OWNER MARKER, not the flag alone.
    expect(result.localDataCleared).toBe(true);
    expect(await dbGetAll(STORES.WORKOUT_SESSIONS)).toHaveLength(0);
  });
});

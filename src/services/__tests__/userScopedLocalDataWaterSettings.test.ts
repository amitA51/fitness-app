// ============================================================================
// Sign-out cleanup — the hydration goal must not survive to the next account
// ============================================================================
// `water_settings` holds the user's daily water goal and glass size
// (constants/nutrition.ts, read/written by waterService). It was defined and
// used without ever being added to a key registry, so the sign-out wipe walked
// right past it: on a shared phone the next person to sign in inherited the
// previous account's hydration goal, with nothing in the UI to explain where a
// 4-litre target came from.
//
// The fix is registry-level, not a special case in the sign-out path, because
// every other wipe (token expiry, account switch, delete-my-data) reads the same
// list — so registering the key once closes all of them at the same time.
// ============================================================================

import { beforeEach, describe, expect, it } from 'vitest';
import { WATER_SETTINGS_KEY } from '../../constants/nutrition';
import { USER_SCOPED_STORAGE_REGISTRY, clearUserScopedLocalData } from '../userScopedLocalData';

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
});

describe('clearUserScopedLocalData — hydration goal', () => {
  it('removes the previous account’s water settings', async () => {
    localStorage.setItem(WATER_SETTINGS_KEY, JSON.stringify({ goalMl: 4000, glassMl: 500 }));
    // A key that was already registered, so a failure here means the wipe
    // itself broke rather than this one key being unregistered.
    localStorage.setItem('user_profile', JSON.stringify({ name: 'משתמש א' }));

    await clearUserScopedLocalData();

    expect(localStorage.getItem(WATER_SETTINGS_KEY)).toBeNull();
    expect(localStorage.getItem('user_profile')).toBeNull();
  });

  it('registers the key, so expiry / account switch / delete-my-data clear it too', () => {
    expect(USER_SCOPED_STORAGE_REGISTRY.localStorageKeys).toContain(WATER_SETTINGS_KEY);
  });
});

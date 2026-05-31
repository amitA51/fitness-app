import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getNotificationConfig } from '../../../../services/notificationService';
import { useSettingsState } from '../useSettingsState';

// useSettingsState pulls workout knobs from SettingsContext — stub it so the
// hook can run without a provider tree.
vi.mock('../../../../contexts/SettingsContext', () => ({
  useSettings: () => ({
    settings: {
      darkMode: false,
      unitSystem: 'metric',
      workoutSettings: { defaultRestTime: 90, autoStartRest: true, hapticsEnabled: true },
    },
    updateSettings: vi.fn(),
    updateWorkoutSettings: vi.fn(),
  }),
}));

// Avoid hitting Supabase during the email-load effect.
vi.mock('../../../../services/supabaseAuth', () => ({
  getCurrentUser: vi.fn().mockResolvedValue(null),
}));

const UNIFIED_KEY = 'sparkos_notification_config';
const LEGACY_KEY = 'notification_settings';

describe('useSettingsState · toggleNotification (bug #1 wiring)', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('persists toggles to the unified notificationService key, not the legacy key', async () => {
    // Arrange
    const { result } = renderHook(() => useSettingsState());
    expect(result.current.notificationConfig.prNotificationEnabled).toBe(true);

    // Act — turn the PR toggle off
    await act(async () => {
      await result.current.toggleNotification('prNotificationEnabled');
    });

    // Assert — state, unified storage key, and the service all agree
    expect(result.current.notificationConfig.prNotificationEnabled).toBe(false);
    expect(getNotificationConfig().prNotificationEnabled).toBe(false);
    expect(localStorage.getItem(UNIFIED_KEY)).toContain('"prNotificationEnabled":false');
    // The dead legacy key must no longer be written.
    expect(localStorage.getItem(LEGACY_KEY)).toBeNull();
  });

  it('enabling a reminder requests notification permission', async () => {
    // Arrange
    const requestPermission = vi.fn().mockResolvedValue('granted');
    vi.stubGlobal('Notification', {
      permission: 'default',
      requestPermission,
    });
    const { result } = renderHook(() => useSettingsState());

    // Act — turn the workout reminder on (default is off)
    await act(async () => {
      await result.current.toggleNotification('workoutReminderEnabled');
    });

    // Assert
    expect(requestPermission).toHaveBeenCalledTimes(1);
    expect(result.current.notificationConfig.workoutReminderEnabled).toBe(true);
    vi.unstubAllGlobals();
  });

  it('loads the saved profile from the user_profile localStorage key', async () => {
    // Arrange
    localStorage.setItem(
      'user_profile',
      JSON.stringify({ name: 'דנה', weight: 62, gender: 'female' })
    );

    // Act
    const { result } = renderHook(() => useSettingsState());

    // Assert — the new weight/gender fields hydrate from storage
    await waitFor(() => expect(result.current.profile.name).toBe('דנה'));
    expect(result.current.profile.weight).toBe(62);
    expect(result.current.profile.gender).toBe('female');
  });
});

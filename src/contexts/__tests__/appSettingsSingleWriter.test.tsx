// `appSettings` has exactly ONE writer — regression tests
//
// SettingsProvider and WorkoutProvider both persist to the localStorage key
// `appSettings`. Each used to read it once at mount and then write its own whole
// snapshot over the other's, so a preference set in one store was silently
// destroyed by the next write from the other. services/localStateMirror lists
// `appSettings` in MIRRORED_LOCAL_KEYS and mirrors the raw string to the cloud,
// rehydrating it after a pull on every sign-in — so the destroyed value was
// uploaded and restored onto every device. The loss was durable, not session-local.
//
// These tests drive BOTH stores against one real localStorage and assert the
// round trip: set A via one store, set B via the other, A must survive.
// ============================================================================

import { act, render } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { useWorkoutDispatch, useWorkoutState } from '../../components/workout/core/WorkoutContext';
import { WorkoutProvider } from '../../components/workout/core/WorkoutProvider';
import type { AppSettings, WorkoutSettings } from '../../types';
import { SettingsProvider, useSettings } from '../SettingsContext';

// ── Harness ────────────────────────────────────────────────────────────────

interface Handles {
  /** The Settings-screen store (SettingsProvider). */
  settings: AppSettings;
  updateSettings: (updates: Partial<AppSettings>) => void;
  updateWorkoutSettings: (updates: Partial<WorkoutSettings>) => void;
  /** The in-workout store (WorkoutProvider), as the workout overlay drives it. */
  workoutSettings: Partial<WorkoutSettings>;
  dispatchWorkoutSetting: (updates: Partial<WorkoutSettings>) => void;
}

let handles: Handles = {} as Handles;

/** Captures the workout store — safe to mount without a SettingsProvider. */
function WorkoutProbe() {
  const state = useWorkoutState();
  const dispatch = useWorkoutDispatch();

  handles = {
    ...handles,
    workoutSettings: state.appSettings?.workoutSettings ?? {},
    dispatchWorkoutSetting: (updates) => dispatch({ type: 'UPDATE_SETTINGS', payload: updates }),
  };

  return null;
}

/** Captures the Settings-screen store. */
function SettingsProbe() {
  const { settings, updateSettings, updateWorkoutSettings } = useSettings();

  handles = { ...handles, settings, updateSettings, updateWorkoutSettings };

  return null;
}

const renderBothStores = () =>
  render(
    <SettingsProvider>
      <WorkoutProvider item={{ id: 'w1', exercises: [] }} onUpdate={() => {}} onExit={() => {}}>
        <SettingsProbe />
        <WorkoutProbe />
      </WorkoutProvider>
    </SettingsProvider>
  );

/** The value the cloud mirror would upload. */
const storedSettings = (): Partial<AppSettings> =>
  JSON.parse(localStorage.getItem('appSettings') ?? '{}');

const storedWorkoutSettings = (): Partial<WorkoutSettings> =>
  storedSettings().workoutSettings ?? {};

beforeEach(() => {
  localStorage.clear();
});

describe('appSettings: one writer, both stores in step', () => {
  it('keeps a workout-store preference when the Settings screen writes next', () => {
    renderBothStores();

    // In-workout: turn on ניגודיות גבוהה (high contrast).
    act(() => {
      handles.dispatchWorkoutSetting({ highContrast: true });
    });

    // Settings screen: toggle מצב כהה (dark mode). Before the fix this wrote a
    // snapshot that predated the high-contrast toggle and destroyed it.
    act(() => {
      handles.updateSettings({ darkMode: true });
    });

    expect(storedSettings().darkMode).toBe(true);
    expect(storedWorkoutSettings().highContrast).toBe(true);
  });

  it('keeps a Settings-screen preference when the workout store writes next', () => {
    renderBothStores();

    act(() => {
      handles.updateWorkoutSettings({ defaultRestTime: 150 });
    });

    act(() => {
      handles.dispatchWorkoutSetting({ autoStartRest: false });
    });

    expect(storedWorkoutSettings().autoStartRest).toBe(false);
    expect(storedWorkoutSettings().defaultRestTime).toBe(150);
  });

  it('shows an in-workout change on the Settings screen without a remount', () => {
    renderBothStores();

    act(() => {
      handles.dispatchWorkoutSetting({ highContrast: true });
    });

    // The reported symptom: Settings still read OFF while the app rendered
    // high-contrast, because the two stores never observed each other.
    expect(handles.settings.workoutSettings.highContrast).toBe(true);
  });

  it('shows a Settings-screen change in an already-mounted workout store', () => {
    renderBothStores();

    act(() => {
      handles.updateWorkoutSettings({ hapticsEnabled: false });
    });

    expect(handles.workoutSettings.hapticsEnabled).toBe(false);
  });

  it('still persists workout settings when no SettingsProvider is mounted', () => {
    render(
      <WorkoutProvider item={{ id: 'w1', exercises: [] }} onUpdate={() => {}} onExit={() => {}}>
        <WorkoutProbe />
      </WorkoutProvider>
    );

    act(() => {
      handles.dispatchWorkoutSetting({ highContrast: true });
    });

    expect(storedWorkoutSettings().highContrast).toBe(true);
  });
});

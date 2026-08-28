/**
 * Regression: the pre-workout intent must not outlive the visit.
 *
 * The back bug. The intent that tells the safety-net effect to open the exercise
 * picker is persisted in sessionStorage so it can survive a provider remount.
 * It used to be spent ONLY by an in-place showExerciseSelector true→false edge,
 * so pressing Back while the sheet was open tore WorkoutContent down before that
 * edge could fire and left the flag at '1'. Returning to /workout read it back,
 * found zero exercises, and re-opened the sheet the user had just backed out of.
 *
 * Measured in Chromium before the fix:
 *   picker-open      url=/workout sheetOpen=true  flag="1"
 *   after-back       url=/        sheetOpen=false flag="1"   <- leaked
 *   revisit-workout  url=/workout sheetOpen=true  flag="1"   <- resurrected
 */
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { PREWO_STARTED_KEY, isOnWorkoutRoute, usePreWorkoutIntent } from '../usePreWorkoutIntent';

vi.mock('../../../../utils/logger', () => ({
  logger: { workout: { warn: vi.fn(), error: vi.fn() } },
}));

/** Point window.location.pathname at a route without navigating jsdom. */
const setPathname = (pathname: string) => {
  window.history.replaceState({}, '', pathname);
};

const readFlag = () => sessionStorage.getItem(PREWO_STARTED_KEY);

describe('usePreWorkoutIntent', () => {
  beforeEach(() => {
    sessionStorage.clear();
    setPathname('/workout');
  });

  afterEach(() => {
    sessionStorage.clear();
  });

  it('recovers a persisted intent so a provider remount can restore the sheet', () => {
    sessionStorage.setItem(PREWO_STARTED_KEY, '1');

    const { result } = renderHook(() => usePreWorkoutIntent());

    expect(result.current[0]).toBe(true);
  });

  it('starts false when no intent was ever set', () => {
    const { result } = renderHook(() => usePreWorkoutIntent());

    expect(result.current[0]).toBe(false);
  });

  it('persists the intent when the trainee starts a fresh workout', () => {
    const { result } = renderHook(() => usePreWorkoutIntent());

    act(() => result.current[1](true));

    expect(result.current[0]).toBe(true);
    expect(readFlag()).toBe('1');
  });

  // THE REGRESSION. Fails before the fix: the intent survived the navigation and
  // the next arrival at /workout re-opened the picker.
  it('spends the intent when Back leaves the workout route with the sheet open', () => {
    const { unmount } = renderHook(() => usePreWorkoutIntent());
    act(() => {
      sessionStorage.setItem(PREWO_STARTED_KEY, '1');
    });

    // Back: the browser URL is already the destination by the time React tears
    // the keyed route subtree down.
    setPathname('/');
    unmount();

    expect(readFlag()).toBeNull();
  });

  it('re-reads as false after such a navigation, so the picker stays closed', () => {
    const first = renderHook(() => usePreWorkoutIntent());
    act(() => first.result.current[1](true));

    setPathname('/');
    first.unmount();

    // The trainee comes back to the workout surface.
    setPathname('/workout');
    const second = renderHook(() => usePreWorkoutIntent());

    expect(second.result.current[0]).toBe(false);
  });

  it('KEEPS the intent across an in-place remount of the workout route', () => {
    const first = renderHook(() => usePreWorkoutIntent());
    act(() => first.result.current[1](true));

    // Provider hydration / a route bounce that lands back on /workout — the sheet
    // must still be restorable, which is the reason the flag is persisted at all.
    first.unmount();

    expect(readFlag()).toBe('1');
    const second = renderHook(() => usePreWorkoutIntent());
    expect(second.result.current[0]).toBe(true);
  });

  it('spends the intent on a templated workout route too', () => {
    setPathname('/workout/template-7');
    const { unmount } = renderHook(() => usePreWorkoutIntent());
    act(() => {
      sessionStorage.setItem(PREWO_STARTED_KEY, '1');
    });

    setPathname('/');
    unmount();

    expect(readFlag()).toBeNull();
  });

  describe('isOnWorkoutRoute', () => {
    it('accepts the workout surface and its templated form', () => {
      expect(isOnWorkoutRoute('/workout')).toBe(true);
      expect(isOnWorkoutRoute('/workout/template-7')).toBe(true);
    });

    it('rejects every other route, including a prefix lookalike', () => {
      expect(isOnWorkoutRoute('/')).toBe(false);
      expect(isOnWorkoutRoute('/templates')).toBe(false);
      expect(isOnWorkoutRoute('/workouts')).toBe(false);
    });
  });
});

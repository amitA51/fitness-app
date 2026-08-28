// Pre-workout intent — "the trainee started a fresh workout and wants the
// exercise picker". Extracted from ActiveWorkoutNew so the one rule that was
// impossible to test in place — the intent must not outlive the visit — has a
// seam of its own.
//
// The intent is persisted in sessionStorage rather than kept in component state
// because it has to survive remounts of BOTH WorkoutContent and WorkoutProvider
// (the reducer sanitizes showExerciseSelector back to false on init), which is
// what lets the safety-net effect in useWorkoutEffects restore the sheet after a
// provider hydration.
//
// That persistence is also what caused the back bug. The intent used to be spent
// only by an in-place showExerciseSelector true→false edge, so pressing Back
// while the sheet was open unmounted WorkoutContent before that edge could ever
// fire and left the flag at '1'. The next arrival at /workout read it straight
// back out, found zero exercises, and the safety net re-opened the very sheet the
// user had just backed out of — measured: Back landed on '/' with flag='1', and
// returning to /workout came up with the picker open again.

import { useCallback, useEffect, useState } from 'react';
import { logger } from '../../../utils/logger';

/** Namespaced so it cannot collide with other session-scoped flags. */
export const PREWO_STARTED_KEY = 'sparkos_prewo_started';

/**
 * Whether the given path is still the workout surface.
 *
 * This is the discriminator between the two unmounts that look identical from
 * inside the component: an in-place remount (provider hydration, a route bounce
 * that lands back on /workout) must KEEP the intent so the sheet can be restored,
 * while a real navigation away must SPEND it. AppRouter keys the route subtree on
 * location.pathname, so by the time this cleanup runs the browser URL is already
 * the destination — reading it tells the two apart.
 */
export const isOnWorkoutRoute = (pathname: string): boolean =>
  pathname === '/workout' || pathname.startsWith('/workout/');

const readIntent = (): boolean => {
  try {
    return sessionStorage.getItem(PREWO_STARTED_KEY) === '1';
  } catch {
    return false;
  }
};

const writeIntent = (value: boolean): void => {
  try {
    if (value) sessionStorage.setItem(PREWO_STARTED_KEY, '1');
    else sessionStorage.removeItem(PREWO_STARTED_KEY);
  } catch (err) {
    logger.workout?.warn?.('prewo flag persist failed', err);
  }
};

/**
 * Owns the pre-workout intent: its persisted value, its setter, and the rule that
 * it is spent when the trainee leaves the workout route.
 */
export function usePreWorkoutIntent(): readonly [boolean, (value: boolean) => void] {
  const [preWorkoutScreenShown, setPreWorkoutScreenShownState] = useState(readIntent);

  const setPreWorkoutScreenShown = useCallback((value: boolean) => {
    writeIntent(value);
    setPreWorkoutScreenShownState(value);
  }, []);

  // Spend the intent when this unmount is a navigation AWAY from the workout
  // surface. Storage is cleared directly rather than through the setter: the
  // component is going away, so there is no state left to update.
  useEffect(
    () => () => {
      if (!isOnWorkoutRoute(window.location.pathname)) writeIntent(false);
    },
    []
  );

  return [preWorkoutScreenShown, setPreWorkoutScreenShown] as const;
}

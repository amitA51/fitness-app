/**
 * Data-layer UI events
 *
 * Typed wrappers around the cross-cutting DOM events the data layer emits to
 * tell the UI to refresh. Keeping the `window` event plumbing here means data
 * services emit a domain event instead of touching the DOM directly, and
 * listeners subscribe through a single typed API.
 */

const WORKOUT_SAVED = 'WORKOUT_SAVED';

/**
 * Notify the UI that a workout session was saved or deleted.
 */
export const emitWorkoutSaved = (): void => {
  window.dispatchEvent(new Event(WORKOUT_SAVED));
};

/**
 * Subscribe to workout-saved notifications.
 *
 * @param handler  Called whenever a workout session is saved or deleted.
 * @returns A cleanup function that removes the listener.
 */
export const onWorkoutSaved = (handler: () => void): (() => void) => {
  window.addEventListener(WORKOUT_SAVED, handler);
  return () => window.removeEventListener(WORKOUT_SAVED, handler);
};

import { useCallback, useEffect, useRef, useState } from 'react';
import { SAVED_FLASH_MS } from '../types';

/**
 * Tracks a brief "נשמר" (saved) flash. `saved` flips true for {@link
 * SAVED_FLASH_MS} each time {@link flash} is called, then auto-clears. Used by
 * sections that persist immediately (Theme, Notifications) and, via
 * {@link useAutosave}, by the debounced ones (Profile, Workout) — so every
 * section gives the same subtle confirmation now that the Save buttons are gone.
 */
export function useSavedFlash(): { saved: boolean; flash: () => void } {
  const [saved, setSaved] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const flash = useCallback(() => {
    setSaved(true);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setSaved(false), SAVED_FLASH_MS);
  }, []);

  useEffect(
    () => () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    },
    []
  );

  return { saved, flash };
}

/**
 * Autosave engine shared by the settings sections that dropped their Save
 * button. Wraps a `persist` function (which returns `true` on a successful
 * write — see {@link saveToStorage}) and exposes two entry points:
 *
 *  - {@link saveNow} — flush immediately. Use for discrete choices (toggles,
 *    selects, rest-time pills) where a debounce would feel laggy.
 *  - {@link saveDebounced} — coalesce rapid edits into one write after
 *    `debounceMs`. Use for free-text and number fields so each keystroke does
 *    not hit localStorage.
 *
 * Both pass the caller-computed next value straight to `persist`, sidestepping
 * the stale-closure trap of reading React state right after `setState`. A
 * successful persist triggers the shared saved flash; a failure does not (so we
 * never claim success — `persist`/`saveToStorage` surfaces its own error toast).
 *
 * `persist` is read through a ref, so callers may pass a fresh closure each
 * render (e.g. one that also calls a context updater) without resetting timers.
 */
export function useAutosave<T>(
  persist: (value: T) => boolean,
  debounceMs: number
): { saveNow: (value: T) => void; saveDebounced: (value: T) => void; saved: boolean } {
  const { saved, flash } = useSavedFlash();
  const persistRef = useRef(persist);
  persistRef.current = persist;
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const runSave = useCallback(
    (value: T) => {
      if (persistRef.current(value)) flash();
    },
    [flash]
  );

  const saveNow = useCallback(
    (value: T) => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
      runSave(value);
    },
    [runSave]
  );

  const saveDebounced = useCallback(
    (value: T) => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = setTimeout(() => runSave(value), debounceMs);
    },
    [runSave, debounceMs]
  );

  useEffect(
    () => () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    },
    []
  );

  return { saveNow, saveDebounced, saved };
}

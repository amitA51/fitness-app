import { useRef, useEffect, useCallback } from 'react';

export interface UseWorkoutPersistenceOptions {
  key: string;
  debounceMs?: number; // default: 1000ms
  maxAge?: number; // default: 4 hours in ms
}

export interface UseWorkoutPersistenceReturn<T> {
  loadState: () => T | null;
  saveState: (state: T) => void;
  clearState: () => void;
}

/**
 * Custom hook for persisting workout state to localStorage with debounce.
 * CRITICAL: Uses debounce to prevent blocking main thread on every state change.
 */
export const useWorkoutPersistence = <T>(
  options: UseWorkoutPersistenceOptions
): UseWorkoutPersistenceReturn<T> => {
  const { key, debounceMs = 1000, maxAge = 4 * 60 * 60 * 1000 } = options;
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
      }
    };
  }, []);

  /**
   * Load state from localStorage with expiration check
   */
  const loadState = useCallback((): T | null => {
    try {
      const saved = localStorage.getItem(key);
      if (!saved) return null;

      const { state, timestamp } = JSON.parse(saved);

      // Check if session has expired
      if (Date.now() - timestamp > maxAge) {
        localStorage.removeItem(key);
        return null;
      }

      return state as T;
    } catch (error) {
      console.error(`Failed to load state from ${key}:`, error);
      return null;
    }
  }, [key, maxAge]);

  /**
   * Save state to localStorage with debounce
   * CRITICAL: Debounced to prevent main thread blocking
   */
  const saveState = useCallback(
    (state: T) => {
      // Clear existing timer
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
      }

      // Set new timer - save only after debounceMs of inactivity
      saveTimerRef.current = setTimeout(() => {
        try {
          const snapshot = {
            state,
            timestamp: Date.now(),
          };
          localStorage.setItem(key, JSON.stringify(snapshot));
        } catch (error) {
          console.error(`Failed to save state to ${key}:`, error);
        }
      }, debounceMs);
    },
    [key, debounceMs]
  );

  /**
   * Clear state from localStorage
   */
  const clearState = useCallback(() => {
    try {
      localStorage.removeItem(key);
    } catch (error) {
      console.error(`Failed to clear state from ${key}:`, error);
    }
  }, [key]);

  return {
    loadState,
    saveState,
    clearState,
  };
};

export default useWorkoutPersistence;

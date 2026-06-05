// useWorkoutTimer - Isolated timer hook that updates locally without parent re-renders
// This is CRITICAL for fixing the button responsiveness issue

import { useEffect, useRef, useState } from 'react';
import { playDing } from '../../../utils/audio';
import { useWorkoutDispatch, useWorkoutSettingsRaw } from '../core/WorkoutContext';

/**
 * Format seconds to time string (MM:SS or H:MM:SS)
 */
export const formatTime = (totalSeconds: number): string => {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = Math.floor(totalSeconds % 60);
  if (h > 0) {
    return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  }
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
};

interface UseWorkoutTimerOptions {
  startTimestamp: number;
  totalPausedTime: number;
  isPaused: boolean;
}

/**
 * Isolated timer hook - updates locally every second WITHOUT triggering parent re-renders
 *
 * PERFORMANCE FIX: This replaces the previous SYNC_TIMER action that caused full-tree re-renders.
 * Now only the timer display component re-renders every second.
 */
export function useWorkoutTimer({
  startTimestamp,
  totalPausedTime,
  isPaused,
}: UseWorkoutTimerOptions): {
  seconds: number;
  formatted: string;
} {
  const [seconds, setSeconds] = useState(() => {
    return Math.max(0, Math.floor((Date.now() - startTimestamp - totalPausedTime) / 1000));
  });

  useEffect(() => {
    if (isPaused) return;

    // Calculate elapsed using only the reducer's totalPausedTime (no local tracking)
    const calculateElapsed = () => {
      const now = Date.now();
      const elapsed = now - startTimestamp - totalPausedTime;
      return Math.max(0, Math.floor(elapsed / 1000));
    };

    // Initial set
    setSeconds(calculateElapsed());

    // Update every second
    const intervalId = setInterval(() => {
      setSeconds(calculateElapsed());
    }, 1000);

    return () => clearInterval(intervalId);
  }, [startTimestamp, totalPausedTime, isPaused]);

  return {
    seconds,
    formatted: formatTime(seconds),
  };
}

/**
 * Hook for rest timer countdown
 */
export function useRestTimer(
  endTime: number | null,
  active: boolean,
  // When true the countdown is frozen: the last computed timeLeft is held and
  // no ding / SYNC_REST_TIMER fires. Pause is also encoded upstream as a
  // negative endTime; this param lets callers freeze without re-encoding.
  isPaused = false
): {
  timeLeft: number;
  formatted: string;
  progress: number;
  totalTime: number;
} {
  const [timeLeft, setTimeLeft] = useState(0);
  const totalTimeRef = useRef<number>(0);
  const soundPlayedRef = useRef<boolean>(false);
  const lastTickRef = useRef<number>(0);
  const speakTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dispatch = useWorkoutDispatch();
  const workoutSettings = useWorkoutSettingsRaw();
  // Rest-end ding honors the rest-timer sound toggle, matching the REST_END
  // gate in WorkoutProvider (restTimerSound). The global soundEnabled flag is
  // already enforced inside playDing()/playBeep(); this adds the rest-specific
  // opt-out so a user who silenced only the rest timer doesn't hear the ding.
  const restTimerSoundEnabled = workoutSettings.restTimerSound !== false;

  useEffect(() => {
    if (!active || !endTime) {
      setTimeLeft(0);
      return;
    }

    // Explicitly paused: hold whatever is currently displayed and run no
    // interval, so the countdown neither advances nor fires the rest-end ding.
    if (isPaused) {
      return;
    }

    // Frozen (paused) timer: TOGGLE_PAUSE encodes the remaining time as a
    // NEGATIVE endTime (-remainingMs). Hold the displayed time at the frozen
    // remaining instead of running the countdown — otherwise `(endTime - now)`
    // is always negative, snapping the display to 00:00 and firing a spurious
    // rest-end ding/dispatch the moment the timer is paused.
    if (endTime <= 0) {
      const frozenLeft = -endTime / 1000;
      totalTimeRef.current = Math.max(totalTimeRef.current, frozenLeft);
      setTimeLeft(frozenLeft);
      return;
    }

    // Reset sound flag on new timer
    soundPlayedRef.current = false;
    lastTickRef.current = 0;

    // Calculate initial total time
    const initialLeft = Math.max(0, (endTime - Date.now()) / 1000);
    totalTimeRef.current = initialLeft;
    setTimeLeft(initialLeft);

    const interval = setInterval(() => {
      const now = Date.now();
      const left = Math.max(0, (endTime - now) / 1000);

      setTimeLeft(left);

      // Trigger when reaching 0. The local ding plays immediately; we also
      // dispatch SYNC_REST_TIMER so the reducer clears restTimer.active and
      // sets pendingHaptic='REST_END' (honoring vibrate/sound settings) even
      // when the timer ends in the FOREGROUND — previously this only happened
      // on visibilitychange, leaving the timer stuck active. soundPlayedRef
      // guards against re-dispatching on subsequent ticks.
      if (left <= 0 && !soundPlayedRef.current) {
        soundPlayedRef.current = true;
        if (restTimerSoundEnabled) playDing();
        dispatch({ type: 'SYNC_REST_TIMER' });
      }
    }, 100);

    return () => {
      clearInterval(interval);
      if (speakTimeoutRef.current) {
        clearTimeout(speakTimeoutRef.current);
        speakTimeoutRef.current = null;
      }
    };
  }, [endTime, active, isPaused, dispatch, restTimerSoundEnabled]);

  const progress =
    totalTimeRef.current > 0 ? ((totalTimeRef.current - timeLeft) / totalTimeRef.current) * 100 : 0;

  return {
    timeLeft,
    formatted: formatTime(Math.ceil(timeLeft)),
    progress,
    totalTime: totalTimeRef.current,
  };
}

export default { useWorkoutTimer, useRestTimer, formatTime };

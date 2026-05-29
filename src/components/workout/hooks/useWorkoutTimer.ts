// useWorkoutTimer - Isolated timer hook that updates locally without parent re-renders
// This is CRITICAL for fixing the button responsiveness issue

import { useEffect, useRef, useState } from 'react';
import { playDing } from '../../../utils/audio';

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
  active: boolean
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

  useEffect(() => {
    if (!active || !endTime) {
      setTimeLeft(0);
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

      // Trigger when reaching 0 — only play ding (settings-aware feedback
      // is handled by useWorkoutSettings.playRestEndSound via the reducer's
      // REST_END haptic signal)
      if (left <= 0 && !soundPlayedRef.current) {
        soundPlayedRef.current = true;
        playDing();
      }
    }, 100);

    return () => {
      clearInterval(interval);
      if (speakTimeoutRef.current) {
        clearTimeout(speakTimeoutRef.current);
        speakTimeoutRef.current = null;
      }
    };
  }, [endTime, active]);

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

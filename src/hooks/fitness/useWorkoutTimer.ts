/**
 * Enhanced Workout Timer Hook
 * Full-featured timer for workouts with intervals, laps, and rest periods
 * Features: Countdown/countup, intervals, rest timer, lap times, audio cues
 */

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';

// Types
export type TimerMode = 'stopwatch' | 'countdown' | 'interval';
export type TimerState = 'idle' | 'running' | 'paused' | 'rest' | 'finished';

export interface Lap {
  /** Lap number */
  number: number;
  /** Lap duration in seconds */
  duration: number;
  /** Total elapsed time at lap end */
  totalTime: number;
  /** Timestamp when lap was recorded */
  timestamp: Date;
}

export interface IntervalConfig {
  /** Work period duration in seconds */
  workDuration: number;
  /** Rest period duration in seconds */
  restDuration: number;
  /** Number of intervals (0 = infinite) */
  rounds: number;
  /** Countdown before start (seconds) */
  prepareTime?: number;
}

export interface UseWorkoutTimerOptions {
  /** Initial time in seconds */
  initialTime?: number;
  /** Timer mode */
  mode?: TimerMode;
  /** Auto-start on mount */
  autoStart?: boolean;
  /** Interval configuration (for interval mode) */
  intervalConfig?: IntervalConfig;
  /** Callback when timer reaches zero (countdown mode) */
  onComplete?: () => void;
  /** Callback when a lap is recorded */
  onLap?: (lap: Lap) => void;
  /** Callback when interval changes (work/rest) */
  onIntervalChange?: (isRest: boolean, round: number) => void;
  /** Callback every second */
  onTick?: (time: number) => void;
  /** Callback when countdown reaches certain seconds */
  onCountdownWarning?: (secondsLeft: number) => void;
  /** Warning thresholds (e.g., [10, 5, 3, 2, 1]) */
  warningThresholds?: number[];
}

export interface UseWorkoutTimerReturn {
  // Time values
  /** Current time in seconds */
  time: number;
  /** Formatted time string (HH:MM:SS or MM:SS) */
  formattedTime: string;
  /** Time remaining (countdown) or elapsed (stopwatch) */
  displayTime: number;

  // State
  /** Current timer state */
  state: TimerState;
  /** Whether timer is running */
  isRunning: boolean;
  /** Whether timer is paused */
  isPaused: boolean;
  /** Whether in rest period (interval mode) */
  isRest: boolean;
  /** Whether timer has finished */
  isFinished: boolean;

  // Interval mode
  /** Current round number */
  currentRound: number;
  /** Total rounds configured */
  totalRounds: number;
  /** Time remaining in current interval */
  intervalTimeRemaining: number;
  /** Progress of current interval (0-1) */
  intervalProgress: number;

  // Laps
  /** Recorded laps */
  laps: Lap[];
  /** Best lap time */
  bestLap: Lap | null;
  /** Average lap time */
  averageLapTime: number;

  // Controls
  /** Start the timer */
  start: () => void;
  /** Pause the timer */
  pause: () => void;
  /** Resume from pause */
  resume: () => void;
  /** Toggle pause/resume */
  toggle: () => void;
  /** Stop and reset */
  stop: () => void;
  /** Reset to initial state */
  reset: () => void;
  /** Add time (positive or negative) */
  addTime: (seconds: number) => void;
  /** Set time directly */
  setTime: (seconds: number) => void;
  /** Record a lap */
  recordLap: () => void;
  /** Clear all laps */
  clearLaps: () => void;
  /** Skip to next interval (interval mode) */
  skipInterval: () => void;
}

/**
 * Format seconds to time string
 */
const formatTime = (totalSeconds: number, showHours: boolean = false): string => {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = Math.floor(totalSeconds % 60);

  if (showHours || hours > 0) {
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  }
  return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
};

/**
 * Enhanced workout timer hook
 */
export const useWorkoutTimer = (
  options: UseWorkoutTimerOptions = {}
): UseWorkoutTimerReturn => {
  const {
    initialTime = 0,
    mode = 'stopwatch',
    autoStart = false,
    intervalConfig,
    onComplete,
    onLap,
    onIntervalChange,
    onTick,
    onCountdownWarning,
    warningThresholds = [10, 5, 3, 2, 1],
  } = options;

  // State
  const [time, setTime] = useState(initialTime);
  const [state, setState] = useState<TimerState>(autoStart ? 'running' : 'idle');
  const [isRest, setIsRest] = useState(false);
  const [currentRound, setCurrentRound] = useState(1);
  const [laps, setLaps] = useState<Lap[]>([]);
  const [intervalTimeRemaining, setIntervalTimeRemaining] = useState(
    intervalConfig?.workDuration || 0
  );

  // Refs for accurate timing
  const lastTickRef = useRef<number | null>(null);
  const accumulatedTimeRef = useRef(initialTime);
  const lastLapTimeRef = useRef(0);
  const firedWarningsRef = useRef<Set<number>>(new Set());

  // Derived state
  const isRunning = state === 'running' || state === 'rest';
  const isPaused = state === 'paused';
  const isFinished = state === 'finished';
  const totalRounds = intervalConfig?.rounds || 0;

  const formattedTime = useMemo(() => formatTime(time), [time]);
  const displayTime = mode === 'countdown' ? Math.max(0, initialTime - time) : time;

  const intervalProgress = useMemo(() => {
    if (!intervalConfig) return 0;
    const currentDuration = isRest ? intervalConfig.restDuration : intervalConfig.workDuration;
    return 1 - (intervalTimeRemaining / currentDuration);
  }, [intervalConfig, isRest, intervalTimeRemaining]);

  const bestLap = useMemo(() => {
    if (laps.length === 0) return null;
    return laps.reduce((best, lap) =>
      lap.duration < best.duration ? lap : best
    );
  }, [laps]);

  const averageLapTime = useMemo(() => {
    if (laps.length === 0) return 0;
    const total = laps.reduce((sum, lap) => sum + lap.duration, 0);
    return total / laps.length;
  }, [laps]);

  /**
   * Main timer effect
   */
  useEffect(() => {
    if (!isRunning) {
      lastTickRef.current = null;
      return;
    }

    let frameId: number;

    const tick = (timestamp: number) => {
      if (!lastTickRef.current) {
        lastTickRef.current = timestamp;
      }

      const delta = (timestamp - lastTickRef.current) / 1000;

      if (delta >= 0.1) { // Update 10 times per second for smoother display
        accumulatedTimeRef.current += delta;
        const newTime = Math.floor(accumulatedTimeRef.current);

        if (newTime !== time) {
          setTime(newTime);
          onTick?.(newTime);

          // Countdown warnings
          if (mode === 'countdown') {
            const remaining = initialTime - newTime;
            if (remaining >= 0 && warningThresholds.includes(remaining)) {
              if (!firedWarningsRef.current.has(remaining)) {
                firedWarningsRef.current.add(remaining);
                onCountdownWarning?.(remaining);
              }
            }

            // Countdown complete
            if (remaining <= 0) {
              setState('finished');
              onComplete?.();
            }
          }

          // Interval mode logic
          if (mode === 'interval' && intervalConfig) {
            setIntervalTimeRemaining(prev => {
              const newRemaining = prev - 1;

              if (newRemaining <= 0) {
                // Switch between work and rest
                if (isRest) {
                  // Rest finished, start new work period or finish
                  if (totalRounds > 0 && currentRound >= totalRounds) {
                    setState('finished');
                    onComplete?.();
                    return 0;
                  }
                  setCurrentRound(r => r + 1);
                  setIsRest(false);
                  onIntervalChange?.(false, currentRound + 1);
                  return intervalConfig.workDuration;
                } else {
                  // Work finished, start rest
                  setIsRest(true);
                  onIntervalChange?.(true, currentRound);
                  return intervalConfig.restDuration;
                }
              }

              return newRemaining;
            });
          }
        }

        lastTickRef.current = timestamp;
      }

      frameId = requestAnimationFrame(tick);
    };

    frameId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frameId);
  }, [isRunning, time, mode, initialTime, intervalConfig, isRest, currentRound, totalRounds, onTick, onCountdownWarning, onComplete, onIntervalChange, warningThresholds]);

  // Controls
  const start = useCallback(() => {
    setState('running');
    firedWarningsRef.current.clear();
  }, []);

  const pause = useCallback(() => {
    setState('paused');
  }, []);

  const resume = useCallback(() => {
    setState(isRest ? 'rest' : 'running');
  }, [isRest]);

  const toggle = useCallback(() => {
    if (isRunning) {
      pause();
    } else {
      resume();
    }
  }, [isRunning, pause, resume]);

  const stop = useCallback(() => {
    setState('idle');
    setTime(initialTime);
    accumulatedTimeRef.current = initialTime;
    lastTickRef.current = null;
    setIsRest(false);
    setCurrentRound(1);
    setIntervalTimeRemaining(intervalConfig?.workDuration || 0);
  }, [initialTime, intervalConfig]);

  const reset = useCallback(() => {
    stop();
    setLaps([]);
    lastLapTimeRef.current = 0;
    firedWarningsRef.current.clear();
  }, [stop]);

  const addTime = useCallback((seconds: number) => {
    accumulatedTimeRef.current += seconds;
    setTime(Math.floor(accumulatedTimeRef.current));
  }, []);

  const setTimeDirectly = useCallback((seconds: number) => {
    accumulatedTimeRef.current = seconds;
    setTime(seconds);
  }, []);

  const recordLap = useCallback(() => {
    const lapDuration = time - lastLapTimeRef.current;
    const newLap: Lap = {
      number: laps.length + 1,
      duration: lapDuration,
      totalTime: time,
      timestamp: new Date(),
    };

    setLaps(prev => [...prev, newLap]);
    lastLapTimeRef.current = time;
    onLap?.(newLap);
  }, [time, laps.length, onLap]);

  const clearLaps = useCallback(() => {
    setLaps([]);
    lastLapTimeRef.current = 0;
  }, []);

  const skipInterval = useCallback(() => {
    if (!intervalConfig) return;

    if (isRest) {
      // Skip rest, start new work
      if (totalRounds > 0 && currentRound >= totalRounds) {
        setState('finished');
        onComplete?.();
        return;
      }
      setCurrentRound(r => r + 1);
      setIsRest(false);
      setIntervalTimeRemaining(intervalConfig.workDuration);
      onIntervalChange?.(false, currentRound + 1);
    } else {
      // Skip work, start rest
      setIsRest(true);
      setIntervalTimeRemaining(intervalConfig.restDuration);
      onIntervalChange?.(true, currentRound);
    }
  }, [intervalConfig, isRest, currentRound, totalRounds, onComplete, onIntervalChange]);

  return {
    // Time
    time,
    formattedTime,
    displayTime,

    // State
    state,
    isRunning,
    isPaused,
    isRest,
    isFinished,

    // Intervals
    currentRound,
    totalRounds,
    intervalTimeRemaining,
    intervalProgress,

    // Laps
    laps,
    bestLap,
    averageLapTime,

    // Controls
    start,
    pause,
    resume,
    toggle,
    stop,
    reset,
    addTime,
    setTime: setTimeDirectly,
    recordLap,
    clearLaps,
    skipInterval,
  };
};

export default useWorkoutTimer;

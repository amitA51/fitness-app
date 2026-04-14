// useWorkoutTimer - Isolated timer hook that updates locally without parent re-renders
// This is CRITICAL for fixing the button responsiveness issue

import { useState, useEffect, useRef } from 'react';
import { triggerHaptic } from '../../../utils/haptics';
import { playDing, speak, playHeartbeat } from '../../../utils/audio';

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
    isPaused
}: UseWorkoutTimerOptions): {
    seconds: number;
    formatted: string;
} {
    const [seconds, setSeconds] = useState(() => {
        return Math.max(0, Math.floor((Date.now() - startTimestamp - totalPausedTime) / 1000));
    });

    const pauseStartRef = useRef<number | null>(null);
    const extraPausedRef = useRef<number>(0);

    useEffect(() => {
        // Track pause time locally
        if (isPaused) {
            pauseStartRef.current = Date.now();
            return;
        }

        // Calculate extra paused time since last update
        if (pauseStartRef.current) {
            extraPausedRef.current += Date.now() - pauseStartRef.current;
            pauseStartRef.current = null;
        }

        // Calculate elapsed (uses local pause tracking too)
        const calculateElapsed = () => {
            const now = Date.now();
            const elapsed = now - startTimestamp - totalPausedTime - extraPausedRef.current;
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
            const currentTick = Math.ceil(left);

            setTimeLeft(left);

            // Heartbeat Logic (Last 5 seconds)
            if (currentTick <= 5 && currentTick > 0 && currentTick !== lastTickRef.current) {
                lastTickRef.current = currentTick;
                playHeartbeat();
                if (navigator.vibrate) {
                    // "Lub-dub" vibration pattern
                    navigator.vibrate([30, 50, 30]);
                }
            }

            // Trigger Audio/Haptic when reaching 0
            if (left <= 0 && !soundPlayedRef.current) {
                soundPlayedRef.current = true;
                triggerHaptic('heavy');
                playDing();

                // Speak after a short delay to let the ding resonate
                // Using improved text
                setTimeout(() => speak("Rest time complete. Let's crush it."), 800);
            }
        }, 100); // Update more frequently for smooth countdown

        return () => clearInterval(interval);
    }, [endTime, active]);

    const progress = totalTimeRef.current > 0
        ? ((totalTimeRef.current - timeLeft) / totalTimeRef.current) * 100
        : 0;

    return {
        timeLeft,
        formatted: formatTime(Math.ceil(timeLeft)),
        progress,
        totalTime: totalTimeRef.current,
    };
}

export default { useWorkoutTimer, useRestTimer, formatTime };

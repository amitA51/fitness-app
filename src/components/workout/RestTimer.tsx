import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion } from 'framer-motion';

interface RestTimerProps {
  targetSeconds: number;
  onComplete: () => void;
  onSkip: () => void;
  exerciseName?: string;
}

/**
 * RestTimer - Mobile-first redesigned rest timer
 * Features: 
 * - Timestamp-based timing (survives background)
 * - Hebrew UI
 * - Pause/resume with accurate time tracking
 * - Flexible time adjustments
 * - Haptic feedback
 */
const RestTimer: React.FC<RestTimerProps> = ({
  targetSeconds,
  onComplete,
  onSkip,
  exerciseName
}) => {
  // Use timestamp-based approach for accuracy
  const [endTime, setEndTime] = useState(() => Date.now() + targetSeconds * 1000);
  const [isPaused, setIsPaused] = useState(false);
  const [pausedTimeRemaining, setPausedTimeRemaining] = useState(0);
  const [secondsLeft, setSecondsLeft] = useState(targetSeconds);
  const [initialTarget] = useState(targetSeconds);
  const completedRef = useRef(false);

  // Update display based on endTime (survives background)
  useEffect(() => {
    if (isPaused || completedRef.current) return;

    const updateTimer = () => {
      const now = Date.now();
      const remaining = Math.max(0, Math.ceil((endTime - now) / 1000));
      setSecondsLeft(remaining);

      if (remaining <= 0 && !completedRef.current) {
        completedRef.current = true;
        // Vibrate on completion
        if ('vibrate' in navigator) {
          navigator.vibrate([200, 100, 200, 100, 200]);
        }
        onComplete();
      }
    };

    // Initial update
    updateTimer();

    // Update frequently for smooth display
    const interval = setInterval(updateTimer, 100);

    return () => clearInterval(interval);
  }, [endTime, isPaused, onComplete]);

  // Handle visibility change - recalculate on return from background
  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === 'visible' && !isPaused && !completedRef.current) {
        const now = Date.now();
        const remaining = Math.max(0, Math.ceil((endTime - now) / 1000));
        setSecondsLeft(remaining);

        // Check if timer completed while in background
        if (remaining <= 0 && !completedRef.current) {
          completedRef.current = true;
          if ('vibrate' in navigator) {
            navigator.vibrate([200, 100, 200, 100, 200]);
          }
          onComplete();
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [endTime, isPaused, onComplete]);

  // Warning vibration at 3 seconds
  useEffect(() => {
    if (secondsLeft === 3 && !isPaused && !completedRef.current) {
      if ('vibrate' in navigator) {
        navigator.vibrate([50]);
      }
    }
  }, [secondsLeft, isPaused]);

  const formatTime = useCallback((seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }, []);

  const adjustTime = useCallback((delta: number) => {
    if (isPaused) {
      setPausedTimeRemaining(prev => Math.max(0, prev + delta));
      setSecondsLeft(prev => Math.max(0, prev + delta));
    } else {
      setEndTime(prev => prev + delta * 1000);
      setSecondsLeft(prev => Math.max(0, prev + delta));
    }
    if ('vibrate' in navigator) {
      navigator.vibrate(30);
    }
  }, [isPaused]);

  const togglePause = useCallback(() => {
    if (isPaused) {
      // Resuming - set new end time based on remaining time
      setEndTime(Date.now() + pausedTimeRemaining * 1000);
      setIsPaused(false);
    } else {
      // Pausing - save remaining time
      const remaining = Math.max(0, Math.ceil((endTime - Date.now()) / 1000));
      setPausedTimeRemaining(remaining);
      setIsPaused(true);
    }
    if ('vibrate' in navigator) {
      navigator.vibrate(50);
    }
  }, [isPaused, endTime, pausedTimeRemaining]);

  const progress = ((initialTarget - secondsLeft) / initialTarget) * 100;
  const isWarning = secondsLeft <= 5 && secondsLeft > 0;
  const isComplete = secondsLeft === 0;

  return (
    <motion.div
      className="fixed inset-0 bg-black/95 backdrop-blur-xl z-[11000] flex items-center justify-center p-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <motion.div
        className="w-full max-w-md text-center"
        initial={{ scale: 0.9, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
      >
        {/* Header */}
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-white mb-2">⏱️ זמן מנוחה</h2>
          {exerciseName && (
            <p className="text-white/50 text-sm">לפני הסט הבא של {exerciseName}</p>
          )}
        </div>

        {/* Circular Progress */}
        <div className="relative w-64 h-64 mx-auto mb-8">
          {/* Background Circle */}
          <svg className="w-full h-full -rotate-90" viewBox="0 0 256 256">
            <circle
              cx="128"
              cy="128"
              r="110"
              stroke="rgba(255,255,255,0.1)"
              strokeWidth="12"
              fill="none"
            />
            {/* Progress Circle */}
            <motion.circle
              cx="128"
              cy="128"
              r="110"
              stroke={isWarning ? '#ef4444' : isComplete ? '#22c55e' : 'var(--cosmos-accent-primary)'}
              strokeWidth="12"
              fill="none"
              strokeLinecap="round"
              strokeDasharray={2 * Math.PI * 110}
              strokeDashoffset={2 * Math.PI * 110 * (1 - progress / 100)}
              style={{
                filter: isWarning
                  ? 'drop-shadow(0 0 20px rgba(239,68,68,0.6))'
                  : 'drop-shadow(0 0 15px var(--cosmos-accent-primary))'
              }}
              transition={{ type: 'spring', damping: 30 }}
            />
          </svg>

          {/* Time Display */}
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <motion.span
              key={secondsLeft}
              initial={{ scale: 1.1 }}
              animate={{ scale: 1 }}
              className={`text-6xl font-black tabular-nums ${isWarning
                ? 'text-red-500'
                : isComplete
                  ? 'text-green-500'
                  : 'text-white'
                }`}
              style={{
                textShadow: isWarning
                  ? '0 0 30px rgba(239,68,68,0.5)'
                  : '0 0 20px rgba(255,255,255,0.2)'
              }}
            >
              {formatTime(secondsLeft)}
            </motion.span>

            {isPaused && (
              <motion.span
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-yellow-400 text-sm font-semibold mt-2"
              >
                ⏸️ מושהה
              </motion.span>
            )}
          </div>
        </div>

        {/* Quick Adjust Buttons */}
        <div className="flex justify-center gap-2 mb-6">
          <button
            type="button"
            onClick={() => adjustTime(-15)}
            className="px-4 py-2 min-h-[44px] rounded-xl bg-red-500/20 border border-red-500/30 text-red-400 font-semibold text-sm transition-transform duration-150 hover:scale-105 active:scale-95"
          >
            -15s
          </button>
          <button
            type="button"
            onClick={() => adjustTime(15)}
            className="px-4 py-2 min-h-[44px] rounded-xl bg-[var(--cosmos-accent-secondary)]/10 border border-[var(--cosmos-accent-secondary)]/20 text-[var(--cosmos-accent-secondary)] font-semibold text-sm transition-transform duration-150 hover:scale-105 active:scale-95"
          >
            +15s
          </button>
          <button
            type="button"
            onClick={() => adjustTime(30)}
            className="px-4 py-2 min-h-[44px] rounded-xl bg-[var(--cosmos-accent-secondary)]/10 border border-[var(--cosmos-accent-secondary)]/20 text-[var(--cosmos-accent-secondary)] font-semibold text-sm transition-transform duration-150 hover:scale-105 active:scale-95"
          >
            +30s
          </button>
          <button
            type="button"
            onClick={() => adjustTime(60)}
            className="px-4 py-2 min-h-[44px] rounded-xl bg-[var(--cosmos-accent-secondary)]/10 border border-[var(--cosmos-accent-secondary)]/20 text-[var(--cosmos-accent-secondary)] font-semibold text-sm transition-transform duration-150 hover:scale-105 active:scale-95"
          >
            +60s
          </button>
        </div>

        {/* Main Action Buttons */}
        <div className="flex gap-3">
          {/* Skip Button */}
          <button
            type="button"
            onClick={onSkip}
            className="flex-1 h-14 min-h-[56px] rounded-2xl bg-white/5 border border-white/20 text-white/80 font-bold text-base hover:bg-white/10 transition-transform duration-150 hover:scale-[1.02] active:scale-[0.98]"
          >
            דלג ⏭️
          </button>

          {/* Pause/Resume Button */}
          <button
            type="button"
            onClick={togglePause}
            className={`flex-1 h-14 min-h-[56px] rounded-2xl font-bold text-base transition-transform duration-150 hover:scale-[1.02] active:scale-[0.98] ${isPaused
              ? 'bg-green-500 text-white shadow-[0_0_25px_rgba(34,197,94,0.4)]'
              : 'bg-yellow-500/20 border border-yellow-500/40 text-yellow-400'
              }`}
          >
            {isPaused ? '▶️ המשך' : '⏸️ השהה'}
          </button>

          {/* Complete Now Button */}
          <button
            type="button"
            onClick={onComplete}
            className="flex-1 h-14 min-h-[56px] rounded-2xl bg-[var(--cosmos-accent-primary)] text-white font-bold text-base shadow-[0_0_25px_var(--cosmos-accent-primary)] hover:brightness-110 transition-transform duration-150 hover:scale-[1.02] active:scale-[0.98]"
          >
            סיים ✓
          </button>
        </div>

        {/* Hint */}
        <p className="text-white/30 text-xs mt-4">
          טיפ: הטיימר ימשיך גם ברקע
        </p>
      </motion.div>
    </motion.div>
  );
};

export default React.memo(RestTimer);

import { motion } from 'framer-motion';
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { haptics } from '../../utils/haptics';

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
 * - Fresh Steel design
 */
const RestTimer: React.FC<RestTimerProps> = ({
  targetSeconds,
  onComplete,
  onSkip,
  exerciseName,
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
        haptics.thump();
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
          haptics.thump();
          onComplete();
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [endTime, isPaused, onComplete]);

  // Final-3 escalation: haptics.escalation self-gates per-second
  useEffect(() => {
    if (isPaused || completedRef.current) return;
    if (secondsLeft === 3 || secondsLeft === 2 || secondsLeft === 1) {
      haptics.escalation(secondsLeft);
    }
  }, [secondsLeft, isPaused]);

  const formatTime = useCallback((seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }, []);

  const adjustTime = useCallback(
    (delta: number) => {
      if (isPaused) {
        setPausedTimeRemaining((prev) => Math.max(0, prev + delta));
        setSecondsLeft((prev) => Math.max(0, prev + delta));
      } else {
        setEndTime((prev) => prev + delta * 1000);
        setSecondsLeft((prev) => Math.max(0, prev + delta));
      }
      haptics.soft();
    },
    [isPaused]
  );

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
    haptics.medium();
  }, [isPaused, endTime, pausedTimeRemaining]);

  const progress = ((initialTarget - secondsLeft) / initialTarget) * 100;
  const isWarning = secondsLeft <= 5 && secondsLeft > 0;
  const isComplete = secondsLeft === 0;

  return (
    <motion.div
      className="fixed inset-0 z-[11000] flex items-center justify-center p-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      style={{ backgroundColor: 'var(--fs-rubber)' }}
    >
      <motion.div
        className="w-full max-w-md text-center"
        initial={{ scale: 0.9, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
      >
        {/* Header */}
        <div className="mb-8">
          <h2
            style={{
              fontFamily: 'var(--font-display)',
              fontWeight: 800,
              fontSize: '28px',
              textTransform: 'uppercase',
              color: 'var(--fs-surface)',
              marginBottom: 8,
            }}
          >
            זמן מנוחה
          </h2>
          {exerciseName && (
            <p style={{ color: 'var(--fs-muted)', fontSize: '14px' }}>
              לפני הסט הבא של {exerciseName}
            </p>
          )}
        </div>

        {/* Circular Progress */}
        <div className="relative w-64 h-64 mx-auto mb-8">
          {/* Background Circle */}
          <svg className="w-full h-full -rotate-90" viewBox="0 0 256 256" aria-hidden="true">
            <circle
              cx="128"
              cy="128"
              r="110"
              stroke="var(--fs-surface-2)"
              strokeWidth="12"
              fill="none"
            />
            {/* Progress Circle */}
            <motion.circle
              cx="128"
              cy="128"
              r="110"
              stroke={
                isWarning ? 'var(--fs-warn)' : isComplete ? 'var(--fs-accent)' : 'var(--fs-accent)'
              }
              strokeWidth="12"
              fill="none"
              strokeLinecap="butt"
              strokeDasharray={2 * Math.PI * 110}
              strokeDashoffset={2 * Math.PI * 110 * (1 - progress / 100)}
              style={{
                filter: isWarning
                  ? 'drop-shadow(0 0 20px var(--fs-warn))'
                  : 'drop-shadow(0 0 15px var(--fs-accent))',
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
              style={{
                fontFamily: 'var(--font-mono)',
                fontWeight: 700,
                fontSize: '60px',
                color: isWarning ? 'var(--fs-warn)' : isComplete ? 'var(--fs-accent)' : 'var(--fs-surface)',
                textShadow: isWarning
                  ? '0 0 30px rgba(226, 110, 63, 0.5)'
                  : '0 0 20px rgba(67, 199, 165, 0.3)',
              }}
              aria-live="polite"
              aria-atomic="true"
            >
              {formatTime(secondsLeft)}
            </motion.span>

            {isPaused && (
              <motion.span
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                style={{
                  color: 'var(--fs-signal)',
                  fontFamily: 'var(--font-mono)',
                  fontSize: '14px',
                  fontWeight: 600,
                  marginTop: 8,
                  textTransform: 'uppercase',
                }}
              >
                מושהה
              </motion.span>
            )}
          </div>
        </div>

        {/* Quick Adjust Buttons */}
        <div className="flex justify-center gap-2 mb-6">
          <button
            type="button"
            onClick={() => adjustTime(-15)}
            aria-label="הפחת 15 שניות"
            style={{
              padding: '8px 16px',
              minHeight: 44,
              borderRadius: 0,
              border: '1px solid var(--fs-surface-2)',
              background: 'var(--fs-surface-2)',
              color: 'var(--fs-muted)',
              fontFamily: 'var(--font-mono)',
              fontWeight: 600,
              fontSize: '14px',
              cursor: 'pointer',
            }}
          >
            -15s
          </button>
          <button
            type="button"
            onClick={() => adjustTime(15)}
            aria-label="הוסף 15 שניות"
            style={{
              padding: '8px 16px',
              minHeight: 44,
              borderRadius: 0,
              border: '1px solid var(--fs-surface-2)',
              background: 'transparent',
              color: 'var(--fs-accent)',
              fontFamily: 'var(--font-mono)',
              fontWeight: 600,
              fontSize: '14px',
              cursor: 'pointer',
            }}
          >
            +15s
          </button>
          <button
            type="button"
            onClick={() => adjustTime(30)}
            aria-label="הוסף 30 שניות"
            style={{
              padding: '8px 16px',
              minHeight: 44,
              borderRadius: 0,
              border: '1px solid var(--fs-surface-2)',
              background: 'transparent',
              color: 'var(--fs-accent)',
              fontFamily: 'var(--font-mono)',
              fontWeight: 600,
              fontSize: '14px',
              cursor: 'pointer',
            }}
          >
            +30s
          </button>
          <button
            type="button"
            onClick={() => adjustTime(60)}
            aria-label="הוסף 60 שניות"
            style={{
              padding: '8px 16px',
              minHeight: 44,
              borderRadius: 0,
              border: '1px solid var(--fs-surface-2)',
              background: 'transparent',
              color: 'var(--fs-accent)',
              fontFamily: 'var(--font-mono)',
              fontWeight: 600,
              fontSize: '14px',
              cursor: 'pointer',
            }}
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
            aria-label="דלג על המנוחה"
            style={{
              flex: 1,
              height: 56,
              minHeight: 56,
              borderRadius: 0,
              border: '1px solid var(--fs-surface-2)',
              background: 'transparent',
              color: 'var(--fs-muted)',
              fontFamily: 'var(--font-display)',
              fontWeight: 800,
              fontSize: '16px',
              textTransform: 'uppercase',
              cursor: 'pointer',
            }}
          >
            דלג
          </button>

          {/* Pause/Resume Button */}
          <button
            type="button"
            onClick={togglePause}
            aria-label={isPaused ? 'המשך טיימר' : 'השהה טיימר'}
            style={{
              flex: 1,
              height: 56,
              minHeight: 56,
              borderRadius: 0,
              border: isPaused ? 'none' : '1px solid var(--fs-signal)',
              background: isPaused ? 'var(--fs-accent)' : 'transparent',
              color: isPaused ? 'var(--fs-rubber)' : 'var(--fs-signal)',
              fontFamily: 'var(--font-display)',
              fontWeight: 800,
              fontSize: '16px',
              textTransform: 'uppercase',
              cursor: 'pointer',
              boxShadow: isPaused ? '0 0 25px rgba(67, 199, 165, 0.4)' : 'none',
            }}
          >
            {isPaused ? 'המשך' : 'השהה'}
          </button>

          {/* Complete Now Button */}
          <button
            type="button"
            onClick={onComplete}
            aria-label="סיים טיימר"
            style={{
              flex: 1,
              height: 56,
              minHeight: 56,
              borderRadius: 0,
              border: 'none',
              background: 'var(--fs-accent)',
              color: 'var(--fs-rubber)',
              fontFamily: 'var(--font-display)',
              fontWeight: 800,
              fontSize: '16px',
              textTransform: 'uppercase',
              cursor: 'pointer',
              boxShadow: '0 0 25px var(--fs-accent)',
            }}
          >
            סיים
          </button>
        </div>

        {/* Hint */}
        <p
          style={{
            color: 'var(--fs-muted)',
            fontSize: '12px',
            marginTop: 16,
            opacity: 0.6,
          }}
        >
          טיפ: הטיימר ימשיך גם ברקע
        </p>
      </motion.div>
    </motion.div>
  );
};

export default React.memo(RestTimer);

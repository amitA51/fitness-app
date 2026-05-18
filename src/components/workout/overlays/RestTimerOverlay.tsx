// RestTimerOverlay - Premium Rest Timer with Mini/Full Modes
// Features: Minimizable timer, strong finish notifications, voice countdown, next exercise preview
// Connected to settings via useRestTimerSettings hook
// Uses Portal rendering via ModalOverlay for proper z-index stacking and focus management

import { AnimatePresence, type PanInfo, motion } from 'framer-motion';
import { memo, useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Z_INDEX } from '../../../constants/zIndex';
import { useFocusTrap } from '../../../hooks/useFocusTrap';
import { triggerHaptic, vibratePattern } from '../../../utils/haptics';
import {
  useLargeText,
  useReducedAnimations,
  useRestTimerSettings,
} from '../hooks/useWorkoutSettings';
import { useRestTimer } from '../hooks/useWorkoutTimer';

// ============================================================
// ANIMATION CONSTANTS
// ============================================================

const ANIMATION = {
  miniTimer: {
    initial: { y: 100, opacity: 0 },
    animate: { y: 0, opacity: 1 },
    exit: { y: 100, opacity: 0 },
    transition: { type: 'spring' as const, damping: 25, stiffness: 300 },
  },
  pulsing: {
    animate: { scale: [1, 1.2, 1] as number[] },
    transition: { duration: 0.5, repeat: Number.POSITIVE_INFINITY },
  },
  lastFivePulse: {
    animate: { scale: [1, 1.15, 1] as number[], opacity: [0.3, 0.1, 0.3] as number[] },
    transition: { duration: 1, repeat: Number.POSITIVE_INFINITY },
  },
  fullTimer: {
    initial: { opacity: 0 },
    animate: { opacity: 1 },
    exit: { opacity: 0 },
  },
  nextExercise: {
    initial: { opacity: 0, y: 20 },
    animate: { opacity: 1, y: 0 },
  },
} as const;

// ============================================================
// TYPES
// ============================================================

export interface NextExerciseInfo {
  name: string;
  sets: number;
  targetReps?: number;
  targetWeight?: number;
}

interface RestTimerOverlayProps {
  active: boolean;
  endTime: number | null;
  oledMode?: boolean;
  nextExercise?: NextExerciseInfo | null;
  onSkip: () => void;
  onAddTime: (seconds: number) => void;
  onUndo?: () => void;
}

// Strong vibration pattern for timer end - gets attention!
const STRONG_VIBRATION_PATTERN = [
  200,
  100,
  200,
  100,
  200, // First burst
  200, // Pause
  300,
  100,
  300,
  100,
  300, // Second burst (stronger)
  200, // Pause
  500, // Final long vibration
];

// ============================================================
// MINI TIMER PILL (Floating at bottom - no portal needed)
// ============================================================

interface MiniTimerProps {
  formatted: string;
  progress: number;
  timeLeft: number;
  onExpand: () => void;
  onSkip: () => void;
  onAddTime: (seconds: number) => void;
  reducedAnimations?: boolean;
  largeText?: boolean;
}

const MiniTimer = memo<MiniTimerProps>(
  ({
    formatted,
    progress,
    timeLeft,
    onExpand,
    onSkip,
    onAddTime,
    reducedAnimations = false,
    largeText = false,
  }) => {
    const isLastFive = timeLeft <= 5 && timeLeft > 0;
    const isRTL = typeof document !== 'undefined' && document.dir === 'rtl';

    // Apply reduced animations if enabled
    const animationConfig = reducedAnimations ? { duration: 0 } : ANIMATION.miniTimer.transition;

    // Mini timer uses portal for proper z-index
    const content = (
      <motion.div
        initial={reducedAnimations ? ANIMATION.miniTimer.animate : ANIMATION.miniTimer.initial}
        animate={ANIMATION.miniTimer.animate}
        exit={ANIMATION.miniTimer.exit}
        transition={animationConfig}
        className={`fixed bottom-6 inset-x-4 pointer-events-auto pb-safe-bottom ${largeText ? 'text-lg' : ''}`}
        style={{
          zIndex: Z_INDEX.modal,
          paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 24px)',
        }}
      >
        <motion.div
          className="relative mx-auto max-w-md overflow-hidden"
          style={{
            backgroundColor: isLastFive ? 'var(--fs-accent)' : 'var(--fs-surface)',
            border: '2px solid var(--fs-primary)',
            borderRadius: '22px 16px 22px 16px',
            /* Static shadow — animating box-shadow forces full repaint
               every frame on mobile. Pulse moved to opacity overlay below. */
            boxShadow: '0 12px 28px rgba(11,26,43,0.25)',
          }}
        >
          {/* Progress bar at top — mustard on navy */}
          <div
            className="absolute top-0 inset-x-0 h-1"
            style={{ backgroundColor: 'var(--fs-surface-2)' }}
          >
            <motion.div
              className="h-full"
              style={{ width: `${progress}%`, backgroundColor: 'var(--fs-accent)' }}
              transition={{ duration: 0.3 }}
            />
          </div>

          <div className="flex items-center gap-3 p-4 pt-5">
            {/* Timer display - tap to expand */}
            <button
              type="button"
              onClick={onExpand}
              className="flex-1 flex items-center gap-3 active:opacity-70 transition-opacity"
              aria-label="הרחב את טיימר המנוחה"
            >
              {/* Circular mini progress */}
              <div className="relative w-12 h-12 flex-shrink-0">
                <svg className="w-12 h-12 -rotate-90">
                  <circle
                    cx="24"
                    cy="24"
                    r="20"
                    fill="none"
                    stroke="var(--fs-surface-2)"
                    strokeWidth="4"
                  />
                  <circle
                    cx="24"
                    cy="24"
                    r="20"
                    fill="none"
                    stroke={isLastFive ? 'var(--fs-primary)' : 'var(--fs-accent)'}
                    strokeWidth="4"
                    strokeLinecap="round"
                    strokeDasharray={125.6}
                    strokeDashoffset={125.6 * (1 - progress / 100)}
                  />
                </svg>
                {/* Pulsing dot for last 5 seconds */}
                {isLastFive && !reducedAnimations && (
                  <motion.div
                    className="absolute inset-0 flex items-center justify-center"
                    animate={ANIMATION.pulsing.animate}
                    transition={ANIMATION.pulsing.transition}
                  >
                    <div style={{ width: 8, height: 8, backgroundColor: 'var(--fs-primary)' }} />
                  </motion.div>
                )}
              </div>

              {/* Time and label — display font + mono eyebrow */}
              <div className="text-start flex-1">
                <span className="sr-only" aria-live="polite" aria-atomic="true">
                  {timeLeft === 0
                    ? 'מנוחה הסתיימה'
                    : timeLeft <= 10 || timeLeft % 10 === 0
                      ? `${timeLeft} שניות`
                      : ''}
                </span>
                <motion.div
                  className={`${largeText ? 'text-4xl' : 'text-3xl'} tabular-nums`}
                  aria-hidden="true"
                  style={{
                    fontFamily: 'var(--font-display)',
                    fontWeight: 900,
                    color: 'var(--fs-primary)',
                    letterSpacing: '-0.02em',
                    lineHeight: 1,
                  }}
                  animate={isLastFive && !reducedAnimations ? { scale: [1, 1.05, 1] } : {}}
                  transition={ANIMATION.pulsing.transition}
                >
                  {formatted}
                </motion.div>
                <div
                  className="uppercase mt-1"
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: '10px',
                    letterSpacing: '0.22em',
                    color: isLastFive ? 'var(--fs-primary)' : 'var(--fs-muted)',
                    fontWeight: 600,
                  }}
                >
                  {isLastFive ? 'התכונן!' : 'מנוחה · הקש להגדלה'}
                </div>
              </div>
            </button>

            {/* Quick actions */}
            <div className="flex gap-2">
              <button
                onClick={() => onAddTime(30)}
                onPointerDown={(e) => {
                  e.preventDefault();
                  onAddTime(30);
                }}
                className="w-11 h-11 flex items-center justify-center transition-colors uppercase"
                style={{
                  backgroundColor: 'var(--fs-surface)',
                  border: '2px solid var(--fs-primary)',
                  color: 'var(--fs-primary)',
                  fontFamily: 'var(--font-mono)',
                  fontSize: '11px',
                  fontWeight: 700,
                  letterSpacing: '0.04em',
                  borderRadius: 0,
                }}
                aria-label="הוסף 30 שניות"
              >
                +30
              </button>
              <button
                onClick={onSkip}
                onPointerDown={(e) => {
                  e.preventDefault();
                  onSkip();
                }}
                className="w-11 h-11 flex items-center justify-center active:brightness-90 transition-all"
                style={{
                  backgroundColor: 'var(--fs-primary)',
                  color: 'var(--fs-accent)',
                  borderRadius: 0,
                }}
                aria-label="דלג על המנוחה"
              >
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  style={isRTL ? { transform: 'scaleX(-1)' } : undefined}
                >
                  <polygon points="5 4 15 12 5 20 5 4" fill="currentColor" />
                  <line x1="19" y1="5" x2="19" y2="19" />
                </svg>
              </button>
            </div>
          </div>
        </motion.div>
      </motion.div>
    );

    // Render via portal
    if (typeof document !== 'undefined') {
      return createPortal(content, document.body);
    }
    return content;
  }
);

MiniTimer.displayName = 'MiniTimer';

// ============================================================
// FULL TIMER (Centered overlay with Portal)
// ============================================================

interface FullTimerProps {
  formatted: string;
  progress: number;
  timeLeft: number;
  nextExercise?: NextExerciseInfo | null;
  oledMode: boolean;
  onMinimize: () => void;
  onSkip: () => void;
  onAddTime: (seconds: number) => void;
  onUndo?: () => void;
  reducedAnimations?: boolean;
  largeText?: boolean;
}

const RingProgress = memo<{
  progress: number;
  size?: number;
  strokeWidth?: number;
  reducedAnimations?: boolean;
  isCritical?: boolean;
}>(({ progress, size = 240, strokeWidth = 8, reducedAnimations = false, isCritical = false }) => {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - progress / 100);

  return (
    <svg
      width="100%"
      height="100%"
      viewBox={`0 0 ${size} ${size}`}
      className="absolute inset-0"
      style={{ transform: 'rotate(-90deg)' }}
    >
      <circle
        className="ring-track"
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        strokeWidth={strokeWidth}
      />
      <motion.circle
        className={`ring-progress${isCritical ? ' signal' : ''}`}
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        strokeWidth={strokeWidth}
        strokeLinecap="butt"
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        transition={reducedAnimations ? { duration: 0 } : { duration: 0.3, ease: 'easeOut' }}
      />
    </svg>
  );
});
RingProgress.displayName = 'RingProgress';

const FullTimer = memo<FullTimerProps>(
  ({
    formatted,
    progress,
    timeLeft,
    nextExercise,
    oledMode,
    onMinimize,
    onSkip,
    onAddTime,
    onUndo,
    reducedAnimations = false,
    largeText = false,
  }) => {
    const isLastFive = timeLeft <= 5 && timeLeft > 0;
    const containerRef = useRef<HTMLDivElement>(null);

    // Focus trap for full timer
    useFocusTrap(containerRef, {
      isOpen: true,
      lockScroll: true,
      autoFocus: false, // Don't auto-focus, user might be mid-workout
      restoreFocus: false,
    });

    const handleDragEnd = (_: unknown, info: PanInfo) => {
      if (info.offset.y > 80) {
        onMinimize();
      }
    };

    // Animation configuration based on accessibility
    const animationConfig = reducedAnimations ? { duration: 0 } : undefined;
    const isRTL = typeof document !== 'undefined' && document.dir === 'rtl';

    const content = (
      <motion.div
        ref={containerRef}
        initial={reducedAnimations ? ANIMATION.fullTimer.animate : ANIMATION.fullTimer.initial}
        animate={ANIMATION.fullTimer.animate}
        exit={ANIMATION.fullTimer.exit}
        transition={animationConfig}
        className={`fixed inset-0 flex items-center justify-center premium-dark-surface ambient-mesh scrim-noise ${largeText ? 'text-lg' : ''}`}
        style={{
          zIndex: Z_INDEX.modal,
          /* Solid scrim instead of backdrop-filter blur — blur on a fixed
             full-screen layer is the most expensive composite property on
             mobile. Solid alpha gives the same visual weight at zero cost. */
          background: oledMode ? 'rgba(11,26,43,0.98)' : 'rgba(11,26,43,0.96)',
          paddingTop: 'env(safe-area-inset-top, 16px)',
          paddingBottom: 'env(safe-area-inset-bottom, 16px)',
          paddingLeft: 'env(safe-area-inset-left, 16px)',
          paddingRight: 'env(safe-area-inset-right, 16px)',
          cursor: 'pointer',
        }}
        role="dialog"
        aria-modal="true"
        aria-label="טיימר מנוחה"
        onClick={onMinimize}
      >
        <motion.div
          drag="y"
          dragConstraints={{ top: 0, bottom: 0 }}
          dragElastic={{ top: 0, bottom: 0.5 }}
          onDragEnd={handleDragEnd}
          className="relative flex flex-col items-center w-full max-w-md px-6"
          onClick={(e) => e.stopPropagation()}
          style={{ cursor: 'default' }}
        >
          {/* Minimize hint - hide when reduced animations */}
          {!reducedAnimations && (
            <motion.div
              className="flex flex-col items-center mb-8"
              animate={{ y: [0, 5, 0] }}
              transition={{ duration: 2, repeat: Number.POSITIVE_INFINITY }}
            >
              <div
                style={{
                  width: 48,
                  height: 3,
                  backgroundColor: 'var(--fs-accent)',
                  marginBottom: 8,
                }}
              />
              <span
                className="uppercase"
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: '10px',
                  letterSpacing: '0.28em',
                  color: 'var(--fs-accent)',
                  fontWeight: 600,
                }}
              >
                גרור למטה למזער
              </span>
            </motion.div>
          )}

          {/* Timer Circle */}
          <motion.div
            className={`relative ${largeText ? 'w-[300px] h-[300px]' : 'w-[240px] h-[240px]'} flex items-center justify-center mb-8`}
            initial={reducedAnimations ? { opacity: 1 } : { scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
          >
            <RingProgress
              progress={progress}
              size={largeText ? 300 : 240}
              reducedAnimations={reducedAnimations}
              isCritical={isLastFive}
            />

            {/* Pulse effect for last 5 seconds — mustard glow */}
            {isLastFive && !reducedAnimations && (
              <motion.div
                className="absolute inset-0 rounded-full"
                animate={ANIMATION.lastFivePulse.animate}
                transition={ANIMATION.lastFivePulse.transition}
                style={{
                  background: 'radial-gradient(circle, rgba(232,184,45,0.6) 0%, transparent 70%)',
                  opacity: 0.45,
                }}
              />
            )}

            {/* Time Display — big display font on bone */}
            <div className="relative flex flex-col items-center">
              {isLastFive && (
                <span
                  className={`breathing-dot${timeLeft <= 3 ? ' signal' : ''} signal-glow`}
                  aria-hidden="true"
                  style={{ marginBottom: 6 }}
                />
              )}
              <motion.span
                className={`${largeText ? 'text-6xl sm:text-9xl' : 'text-5xl sm:text-7xl'} tabular-nums kinetic-number large${isLastFive ? ' signal-glow' : ''}`}
                style={{
                  fontFamily: 'var(--font-display)',
                  fontWeight: 900,
                  letterSpacing: '-0.04em',
                  lineHeight: 0.85,
                  color: isLastFive ? 'var(--fs-accent)' : 'var(--fs-surface)',
                  textShadow: isLastFive ? '0 0 32px rgba(232,184,45,0.65)' : 'none',
                }}
                animate={isLastFive && !reducedAnimations ? { scale: [1, 1.08, 1] } : {}}
                transition={ANIMATION.pulsing.transition}
              >
                {formatted}
              </motion.span>
              <span
                className="uppercase mt-3"
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: '11px',
                  letterSpacing: '0.28em',
                  color: isLastFive ? 'var(--fs-accent)' : 'rgba(var(--text-on-navy-rgb),0.55)',
                  fontWeight: 600,
                }}
              >
                {isLastFive ? 'התכונן!' : 'מנוחה'}
              </span>
            </div>
          </motion.div>

          {/* Controls — sharp-cornered editorial */}
          <div className="flex items-center gap-3 mb-6">
            <button
              onClick={(e) => {
                e.stopPropagation();
                onAddTime(-10);
              }}
              onPointerDown={(e) => {
                e.preventDefault();
                onAddTime(-10);
              }}
              className="w-14 h-14 flex items-center justify-center uppercase transition-colors"
              style={{
                backgroundColor: 'var(--fs-surface)',
                color: 'var(--fs-primary)',
                border: '2px solid var(--fs-surface)',
                fontFamily: 'var(--font-mono)',
                fontWeight: 700,
                fontSize: '13px',
                letterSpacing: '0.04em',
                borderRadius: 0,
              }}
              aria-label="הפחת 10 שניות"
            >
              -10
            </button>

            <button
              onClick={(e) => {
                e.stopPropagation();
                onSkip();
              }}
              onPointerDown={(e) => {
                e.preventDefault();
                onSkip();
              }}
              className="px-8 h-14 flex items-center gap-2 uppercase transition-opacity active:opacity-80"
              style={{
                backgroundColor: 'var(--fs-accent)',
                color: 'var(--fs-primary)',
                fontFamily: 'var(--font-display)',
                fontWeight: 800,
                fontSize: '16px',
                letterSpacing: '0.08em',
                borderRadius: 0,
              }}
              aria-label="דלג על המנוחה"
            >
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="currentColor"
                style={isRTL ? { transform: 'scaleX(-1)' } : undefined}
              >
                <polygon points="5 4 15 12 5 20 5 4" />
                <rect x="17" y="5" width="2" height="14" />
              </svg>
              דלג
            </button>

            <button
              onClick={(e) => {
                e.stopPropagation();
                onAddTime(30);
              }}
              onPointerDown={(e) => {
                e.preventDefault();
                onAddTime(30);
              }}
              className="w-14 h-14 flex items-center justify-center uppercase transition-colors"
              style={{
                backgroundColor: 'var(--fs-surface)',
                color: 'var(--fs-primary)',
                border: '2px solid var(--fs-surface)',
                fontFamily: 'var(--font-mono)',
                fontWeight: 700,
                fontSize: '13px',
                letterSpacing: '0.04em',
                borderRadius: 0,
              }}
              aria-label="הוסף 30 שניות"
            >
              +30
            </button>
          </div>

          {/* Undo button */}
          {onUndo && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onUndo();
              }}
              onPointerDown={(e) => {
                e.preventDefault();
                onUndo();
              }}
              className="mb-6 px-4 py-2 uppercase flex items-center gap-2 transition-colors"
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '11px',
                letterSpacing: '0.12em',
                color: 'var(--fs-warn)',
                fontWeight: 600,
                backgroundColor: 'transparent',
                borderRadius: 0,
              }}
              aria-label="בטל סיום סט"
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M3 7v6h6" />
                <path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13" />
              </svg>
              ביטול סיום סט
            </button>
          )}

          {/* Next Exercise — bone card with navy border */}
          {nextExercise && (
            <motion.div
              initial={
                reducedAnimations ? ANIMATION.nextExercise.animate : ANIMATION.nextExercise.initial
              }
              animate={ANIMATION.nextExercise.animate}
              transition={{ delay: reducedAnimations ? 0 : 0.2 }}
              className="w-full p-4 text-center"
              style={{
                backgroundColor: 'var(--fs-surface)',
                border: '2px solid var(--fs-accent)',
                borderRadius: 0,
              }}
            >
              <div
                className="mb-1 uppercase"
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: '10px',
                  letterSpacing: '0.28em',
                  color: 'var(--fs-muted)',
                  fontWeight: 600,
                }}
              >
                התרגיל הבא
              </div>
              <div
                className={`mb-2 uppercase ${largeText ? 'text-2xl' : 'text-lg'}`}
                style={{
                  fontFamily: 'var(--font-display)',
                  fontWeight: 800,
                  color: 'var(--fs-primary)',
                  letterSpacing: '-0.01em',
                  lineHeight: 1,
                }}
              >
                {nextExercise.name}
              </div>
              <div
                className="flex items-center justify-center gap-2"
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: '12px',
                  color: 'var(--fs-primary)',
                }}
              >
                <span className="chip">{nextExercise.sets} סטים</span>
                {nextExercise.targetReps && (
                  <span className="chip">{nextExercise.targetReps} חזרות</span>
                )}
              </div>
            </motion.div>
          )}

          {/* Minimize button */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              onMinimize();
            }}
            onPointerDown={(e) => {
              e.preventDefault();
              onMinimize();
            }}
            className="mt-6 px-6 py-3 flex items-center gap-2 uppercase transition-colors"
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '11px',
              letterSpacing: '0.18em',
              color: 'rgba(var(--text-on-navy-rgb),0.55)',
              fontWeight: 600,
              borderRadius: 0,
              backgroundColor: 'transparent',
            }}
            aria-label="מזער את טיימר המנוחה"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <polyline points="4 14 10 14 10 20" />
              <polyline points="20 10 14 10 14 4" />
              <line x1="14" y1="10" x2="21" y2="3" />
              <line x1="3" y1="21" x2="10" y2="14" />
            </svg>
            מזער ותכין את התרגיל הבא
          </button>
        </motion.div>
      </motion.div>
    );

    // Render via portal
    if (typeof document !== 'undefined') {
      return createPortal(content, document.body);
    }
    return content;
  }
);

FullTimer.displayName = 'FullTimer';

// ============================================================
// MAIN COMPONENT
// ============================================================

const RestTimerOverlay = memo<RestTimerOverlayProps>(
  ({ active, endTime, oledMode = false, nextExercise, onSkip, onAddTime, onUndo }) => {
    const { formatted, progress, timeLeft } = useRestTimer(endTime, active);
    const prevTimeLeft = useRef(timeLeft);
    const totalTimeRef = useRef<number>(0);
    const hasAnnouncedReadyRef = useRef(false);

    // Mini/Full mode state
    const [isMinimized, setIsMinimized] = useState(false);

    // Get settings from hook
    const { vibrate, voiceEnabled, announceCountdown, announceReady, playRestEndSound } =
      useRestTimerSettings();

    // Accessibility settings
    const reducedAnimations = useReducedAnimations();
    const largeText = useLargeText();

    // Reset to full mode when timer starts
    useEffect(() => {
      if (active && endTime) {
        const total = Math.round((endTime - Date.now()) / 1000);
        if (total > 0) {
          totalTimeRef.current = total;
        }
        hasAnnouncedReadyRef.current = false;
        // Start in full mode for first few seconds, then user can minimize
      }
    }, [active, endTime]);

    // Voice countdown and haptic feedback
    useEffect(() => {
      if (!active || timeLeft === prevTimeLeft.current) return;

      const prevTime = prevTimeLeft.current;
      prevTimeLeft.current = timeLeft;

      // Last 5 seconds - haptic feedback (medium)
      if (timeLeft <= 5 && timeLeft > 0) {
        if (vibrate) {
          vibratePattern([50 + (5 - timeLeft) * 20]); // Gets stronger as time decreases
        }
      }

      // Voice/beep countdown at specific intervals
      const announcePoints = [30, 10, 5, 4, 3, 2, 1];
      if (announcePoints.includes(timeLeft)) {
        announceCountdown(timeLeft, totalTimeRef.current);
      }

      // Timer finished - STRONG notification!
      if (timeLeft === 0 && prevTime > 0) {
        if (!hasAnnouncedReadyRef.current) {
          // Strong vibration pattern
          if (vibrate) {
            vibratePattern(STRONG_VIBRATION_PATTERN);
          }

          // Play sound and announce
          playRestEndSound();
          announceReady();

          // Expand to full mode when timer ends
          setIsMinimized(false);

          hasAnnouncedReadyRef.current = true;
        }
      }
    }, [
      active,
      timeLeft,
      vibrate,
      voiceEnabled,
      announceCountdown,
      announceReady,
      playRestEndSound,
    ]);

    // Handlers
    const handleSkip = useCallback(() => {
      triggerHaptic('light');
      onSkip();
    }, [onSkip]);

    const handleAddTime = useCallback(
      (seconds: number) => {
        triggerHaptic('light');
        onAddTime(seconds);
      },
      [onAddTime]
    );

    const handleUndo = useCallback(() => {
      triggerHaptic('light');
      onUndo?.();
    }, [onUndo]);

    const handleMinimize = useCallback(() => {
      triggerHaptic('light');
      setIsMinimized(true);
    }, []);

    const handleExpand = useCallback(() => {
      triggerHaptic('light');
      setIsMinimized(false);
    }, []);

    return (
      <AnimatePresence mode="sync">
        {active &&
          (isMinimized ? (
            <MiniTimer
              key="mini"
              formatted={formatted}
              progress={progress}
              timeLeft={timeLeft}
              onExpand={handleExpand}
              onSkip={handleSkip}
              onAddTime={handleAddTime}
              reducedAnimations={reducedAnimations}
              largeText={largeText}
            />
          ) : (
            <FullTimer
              key="full"
              formatted={formatted}
              progress={progress}
              timeLeft={timeLeft}
              nextExercise={nextExercise}
              oledMode={oledMode}
              onMinimize={handleMinimize}
              onSkip={handleSkip}
              onAddTime={handleAddTime}
              onUndo={handleUndo}
              reducedAnimations={reducedAnimations}
              largeText={largeText}
            />
          ))}
      </AnimatePresence>
    );
  }
);

RestTimerOverlay.displayName = 'RestTimerOverlay';

export default RestTimerOverlay;

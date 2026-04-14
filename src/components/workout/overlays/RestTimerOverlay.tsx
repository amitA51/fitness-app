// RestTimerOverlay - Premium Rest Timer with Mini/Full Modes
// Features: Minimizable timer, strong finish notifications, voice countdown, next exercise preview
// Connected to settings via useRestTimerSettings hook
// Uses Portal rendering via ModalOverlay for proper z-index stacking and focus management

import { memo, useCallback, useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence, PanInfo } from 'framer-motion';
import { createPortal } from 'react-dom';
import { useRestTimer } from '../hooks/useWorkoutTimer';
import { useRestTimerSettings, useReducedAnimations, useLargeText } from '../hooks/useWorkoutSettings';
import { useFocusTrap } from '../../../hooks/useFocusTrap';
import { triggerHaptic, vibratePattern } from '../../../utils/haptics';
import { Z_INDEX } from '../../../constants/zIndex';

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
        transition: { duration: 0.5, repeat: Infinity },
    },
    lastFivePulse: {
        animate: { scale: [1, 1.15, 1] as number[], opacity: [0.3, 0.1, 0.3] as number[] },
        transition: { duration: 1, repeat: Infinity },
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
    200, 100, 200, 100, 200, // First burst
    200, // Pause
    300, 100, 300, 100, 300, // Second burst (stronger)
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

const MiniTimer = memo<MiniTimerProps>(({
    formatted,
    progress,
    timeLeft,
    onExpand,
    onSkip,
    onAddTime,
    reducedAnimations = false,
    largeText = false
}) => {
    const isLastFive = timeLeft <= 5 && timeLeft > 0;

    // Apply reduced animations if enabled
    const animationConfig = reducedAnimations
        ? { duration: 0 }
        : ANIMATION.miniTimer.transition;

    // Mini timer uses portal for proper z-index
    const content = (
        <motion.div
            initial={reducedAnimations ? ANIMATION.miniTimer.animate : ANIMATION.miniTimer.initial}
            animate={ANIMATION.miniTimer.animate}
            exit={ANIMATION.miniTimer.exit}
            transition={animationConfig}
            className={`fixed bottom-6 inset-x-4 pointer-events-auto ${largeText ? 'text-lg' : ''}`}
            style={{ zIndex: Z_INDEX.modal }}
        >
            <motion.div
                className={`
                    relative mx-auto max-w-md rounded-2xl overflow-hidden
                    backdrop-blur-xl border
                    ${isLastFive
                        ? 'bg-[var(--cosmos-accent-primary)]/20 border-[var(--cosmos-accent-primary)]/40'
                        : 'bg-[var(--bg-card)]/95 border-white/10'
                    }
                `}
                animate={isLastFive && !reducedAnimations ? { 
                    boxShadow: [
                        '0 0 20px rgba(10, 132, 255, 0.6)',
                        '0 0 40px rgba(10, 132, 255, 0.8)',
                        '0 0 20px rgba(10, 132, 255, 0.6)',
                    ]
                } : {}}
                transition={{ duration: 0.5, repeat: Infinity }}
            >
                {/* Progress bar at top */}
                <div className="absolute top-0 inset-x-0 h-1 bg-white/10">
                    <motion.div
                        className="h-full bg-gradient-to-r from-[var(--cosmos-accent-primary)] to-[var(--cosmos-accent-secondary)]"
                        style={{ width: `${progress}%` }}
                        transition={{ duration: 0.3 }}
                    />
                </div>

                <div className="flex items-center gap-3 p-4 pt-5">
                    {/* Timer display - tap to expand */}
                    <button
                        onClick={onExpand}
                        className="flex-1 flex items-center gap-3 active:opacity-70 transition-opacity"
                    >
                        {/* Circular mini progress */}
                        <div className="relative w-12 h-12 flex-shrink-0">
                            <svg className="w-12 h-12 -rotate-90">
                                <circle
                                    cx="24" cy="24" r="20"
                                    fill="none"
                                    stroke="rgba(255,255,255,0.1)"
                                    strokeWidth="4"
                                />
                                <circle
                                    cx="24" cy="24" r="20"
                                    fill="none"
                                    stroke={isLastFive ? 'var(--cosmos-accent-primary)' : 'var(--cosmos-accent-secondary)'}
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
                                    <div className="w-2 h-2 rounded-full bg-[var(--cosmos-accent-primary)]" />
                                </motion.div>
                            )}
                        </div>

                        {/* Time and label */}
                        <div className="text-start flex-1">
                            <motion.div
                                className={`${largeText ? 'text-4xl' : 'text-3xl'} font-bold tabular-nums ${isLastFive ? 'text-[var(--cosmos-accent-primary)]' : 'text-white'
                                    }`}
                                animate={isLastFive && !reducedAnimations ? { scale: [1, 1.05, 1] } : {}}
                                transition={ANIMATION.pulsing.transition}
                            >
                                {formatted}
                            </motion.div>
                            <div className={`text-xs font-medium ${isLastFive ? 'text-[var(--cosmos-accent-primary)]/70' : 'text-white/50'
                                }`}>
                                {isLastFive ? 'התכונן!' : 'מנוחה • הקש להגדלה'}
                            </div>
                        </div>
                    </button>

                    {/* Quick actions */}
                    <div className="flex gap-2">
                        <button
                            onClick={() => onAddTime(30)}
                            onPointerDown={(e) => { e.preventDefault(); onAddTime(30); }}
                            className="w-11 h-11 rounded-xl bg-[var(--cosmos-accent-secondary)]/10 flex items-center justify-center text-[var(--cosmos-accent-secondary)] font-bold text-sm active:bg-[var(--cosmos-accent-secondary)]/20 transition-colors"
                        >
                            +30
                        </button>
                        <button
                            onClick={onSkip}
                            onPointerDown={(e) => { e.preventDefault(); onSkip(); }}
                            className="w-11 h-11 rounded-xl bg-[var(--cosmos-accent-primary)] flex items-center justify-center active:brightness-90 transition-all"
                        >
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="black" strokeWidth="2.5">
                                <polygon points="5 4 15 12 5 20 5 4" fill="black" />
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
});

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

const RingProgress = memo<{ progress: number; size?: number; strokeWidth?: number; reducedAnimations?: boolean }>(
    ({ progress, size = 240, strokeWidth = 8, reducedAnimations = false }) => {
        const radius = (size - strokeWidth) / 2;
        const circumference = 2 * Math.PI * radius;
        const offset = circumference * (1 - progress / 100);

        return (
            <svg width={size} height={size} className="absolute inset-0" style={{ transform: 'rotate(-90deg)' }}>
                <circle
                    cx={size / 2} cy={size / 2} r={radius}
                    fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth={strokeWidth}
                />
                <motion.circle
                    cx={size / 2} cy={size / 2} r={radius}
                    fill="none" stroke="url(#timerGradient)" strokeWidth={strokeWidth}
                    strokeLinecap="round"
                    strokeDasharray={circumference}
                    strokeDashoffset={offset}
                    transition={reducedAnimations ? { duration: 0 } : { duration: 0.3, ease: 'easeOut' }}
                />
                <defs>
                    <linearGradient id="timerGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                        <stop offset="0%" stopColor="var(--cosmos-accent-primary)" />
                        <stop offset="100%" stopColor="var(--cosmos-accent-secondary)" />
                    </linearGradient>
                </defs>
            </svg>
        );
    }
);
RingProgress.displayName = 'RingProgress';

const FullTimer = memo<FullTimerProps>(({
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

    const content = (
        <motion.div
            ref={containerRef}
            initial={reducedAnimations ? ANIMATION.fullTimer.animate : ANIMATION.fullTimer.initial}
            animate={ANIMATION.fullTimer.animate}
            exit={ANIMATION.fullTimer.exit}
            transition={animationConfig}
            className={`fixed inset-0 flex items-center justify-center ${largeText ? 'text-lg' : ''}`}
            style={{
                zIndex: Z_INDEX.overlay,
                background: oledMode
                    ? 'rgba(0,0,0,0.98)'
                    : 'linear-gradient(180deg, rgba(0,0,0,0.95) 0%, rgba(10,10,10,0.98) 100%)',
                backdropFilter: 'blur(30px)',
            }}
            role="dialog"
            aria-modal="true"
            aria-label="טיימר מנוחה"
        >
            <motion.div
                drag="y"
                dragConstraints={{ top: 0, bottom: 0 }}
                dragElastic={{ top: 0, bottom: 0.5 }}
                onDragEnd={handleDragEnd}
                className="relative flex flex-col items-center w-full max-w-md px-6"
            >
                {/* Minimize hint - hide when reduced animations */}
                {!reducedAnimations && (
                    <motion.div
                        className="flex flex-col items-center mb-8"
                        animate={{ y: [0, 5, 0] }}
                        transition={{ duration: 2, repeat: Infinity }}
                    >
                        <div className="w-12 h-1 rounded-full bg-white/30 mb-2" />
                        <span className="text-[10px] text-white/30 uppercase tracking-widest">
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
                    <RingProgress progress={progress} size={largeText ? 300 : 240} reducedAnimations={reducedAnimations} />

                    {/* Pulse effect for last 5 seconds */}
                    {isLastFive && !reducedAnimations && (
                        <motion.div
                            className="absolute inset-0 rounded-full"
                            animate={ANIMATION.lastFivePulse.animate}
                            transition={ANIMATION.lastFivePulse.transition}
                            style={{ background: 'radial-gradient(circle, rgba(10, 132, 255, 0.8) 0%, transparent 70%)', opacity: 0.4 }}
                        />
                    )}

                    {/* Time Display */}
                    <div className="relative flex flex-col items-center">
                        <motion.span
                            className={`${largeText ? 'text-9xl' : 'text-7xl'} font-[800] tabular-nums tracking-tighter ${isLastFive ? 'text-[var(--cosmos-accent-primary)]' : 'text-white'
                                }`}
                            animate={isLastFive && !reducedAnimations ? { scale: [1, 1.1, 1] } : {}}
                            transition={ANIMATION.pulsing.transition}
                            style={{ textShadow: isLastFive ? '0 0 40px rgba(10, 132, 255, 0.8)' : 'none' }}
                        >
                            {formatted}
                        </motion.span>
                        <span className={`text-sm font-bold uppercase tracking-[0.2em] mt-2 ${isLastFive ? 'text-[var(--cosmos-accent-primary)]' : 'text-white/50'
                            }`}>
                            {isLastFive ? 'התכונן!' : 'מנוחה'}
                        </span>
                    </div>
                </motion.div>

                {/* Controls */}
                <div className="flex items-center gap-4 mb-6">
                    <button
                        onClick={() => onAddTime(-10)}
                        onPointerDown={(e) => { e.preventDefault(); onAddTime(-10); }}
                        className="w-14 h-14 rounded-2xl bg-[var(--cosmos-accent-secondary)]/10 flex items-center justify-center text-[var(--cosmos-accent-secondary)] font-bold border border-[var(--cosmos-accent-secondary)]/10 active:bg-[var(--cosmos-accent-secondary)]/20 transition-colors"
                    >
                        -10
                    </button>

                    <button
                        onClick={onSkip}
                        onPointerDown={(e) => { e.preventDefault(); onSkip(); }}
                        className="px-8 h-14 rounded-2xl bg-gradient-to-br from-[var(--cosmos-accent-primary)] to-[var(--cosmos-accent-secondary)] text-white font-bold text-lg flex items-center gap-2 shadow-lg shadow-[var(--cosmos-accent-primary)]/30 active:opacity-80 transition-opacity"
                    >
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="white">
                            <polygon points="5 4 15 12 5 20 5 4" />
                            <rect x="17" y="5" width="2" height="14" />
                        </svg>
                        דלג
                    </button>

                    <button
                        onClick={() => onAddTime(30)}
                        onPointerDown={(e) => { e.preventDefault(); onAddTime(30); }}
                        className="w-14 h-14 rounded-2xl bg-[var(--cosmos-accent-secondary)]/10 flex items-center justify-center text-[var(--cosmos-accent-secondary)] font-bold border border-[var(--cosmos-accent-secondary)]/10 active:bg-[var(--cosmos-accent-secondary)]/20 transition-colors"
                    >
                        +30
                    </button>
                </div>

                {/* Undo button */}
                {onUndo && (
                    <button
                        onClick={onUndo}
                        onPointerDown={(e) => { e.preventDefault(); onUndo(); }}
                        className="mb-6 px-4 py-2 rounded-xl text-red-400 font-medium text-sm flex items-center gap-2 active:bg-red-500/10 transition-colors"
                    >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M3 7v6h6" />
                            <path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13" />
                        </svg>
                        ביטול סיום סט
                    </button>
                )}

                {/* Next Exercise */}
                {nextExercise && (
                    <motion.div
                        initial={reducedAnimations ? ANIMATION.nextExercise.animate : ANIMATION.nextExercise.initial}
                        animate={ANIMATION.nextExercise.animate}
                        transition={{ delay: reducedAnimations ? 0 : 0.2 }}
                        className={`w-full rounded-2xl p-4 text-center bg-white/5 border border-white/10 ${largeText ? 'text-lg' : ''}`}
                    >
                        <div className="text-[10px] uppercase tracking-[0.2em] text-white/40 mb-1 font-bold">
                            התרגיל הבא
                        </div>
                        <div className={`font-bold text-white mb-2 ${largeText ? 'text-2xl' : 'text-lg'}`}>
                            {nextExercise.name}
                        </div>
                        <div className="flex items-center justify-center gap-2 text-sm text-white/60">
                            <span className="px-2 py-1 rounded-lg bg-white/10">{nextExercise.sets} סטים</span>
                            {nextExercise.targetReps && (
                                <span className="px-2 py-1 rounded-lg bg-white/10">{nextExercise.targetReps} חזרות</span>
                            )}
                        </div>
                    </motion.div>
                )}

                {/* Minimize button */}
                <button
                    onClick={onMinimize}
                    onPointerDown={(e) => { e.preventDefault(); onMinimize(); }}
                    className="mt-6 px-6 py-3 rounded-xl text-white/50 font-medium text-sm flex items-center gap-2 active:bg-white/5 transition-colors"
                >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
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
});

FullTimer.displayName = 'FullTimer';

// ============================================================
// MAIN COMPONENT
// ============================================================

const RestTimerOverlay = memo<RestTimerOverlayProps>(({
    active,
    endTime,
    oledMode = false,
    nextExercise,
    onSkip,
    onAddTime,
    onUndo,
}) => {
    const { formatted, progress, timeLeft } = useRestTimer(endTime, active);
    const prevTimeLeft = useRef(timeLeft);
    const totalTimeRef = useRef<number>(0);
    const hasAnnouncedReadyRef = useRef(false);

    // Mini/Full mode state
    const [isMinimized, setIsMinimized] = useState(false);

    // Get settings from hook
    const {
        vibrate,
        voiceEnabled,
        announceCountdown,
        announceReady,
        playRestEndSound
    } = useRestTimerSettings();

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
    }, [active, timeLeft, vibrate, voiceEnabled, announceCountdown, announceReady, playRestEndSound]);

    // Handlers
    const handleSkip = useCallback(() => {
        triggerHaptic('light');
        onSkip();
    }, [onSkip]);

    const handleAddTime = useCallback((seconds: number) => {
        triggerHaptic('light');
        onAddTime(seconds);
    }, [onAddTime]);

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
        <AnimatePresence mode="wait">
            {active && (
                isMinimized ? (
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
                )
            )}
        </AnimatePresence>
    );
});

RestTimerOverlay.displayName = 'RestTimerOverlay';

export default RestTimerOverlay;

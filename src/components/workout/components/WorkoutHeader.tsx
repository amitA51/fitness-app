// WorkoutHeader - Ultra Premium Dynamic Island Style Header
// Features: Floating pill timer, live activity animations, contextual states

import { memo, useState, useCallback, forwardRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { SettingsIcon, CheckCircleIcon, TrashIcon } from '../../icons';
import { useWorkoutTimer } from '../hooks/useWorkoutTimer';
import { triggerHaptic } from '../../../utils/haptics';

// ============================================================
// TYPES
// ============================================================

interface WorkoutHeaderProps {
    startTimestamp: number;
    totalPausedTime: number;
    isPaused: boolean;
    currentExerciseName: string;
    onFinish: () => void;
    onDiscard: () => void;
    onOpenSettings: () => void;
    onOpenTutorial: () => void;
    onOpenAICoach: () => void;
}



// ============================================================
// ANIMATED DURATION DISPLAY
// ============================================================

interface DurationDigitProps {
    value: string | null | undefined;
    delay?: number;
}

const DurationDigit = memo(forwardRef<HTMLSpanElement, DurationDigitProps>(({ value, delay = 0 }, ref) => (
    <motion.span
        ref={ref}
        key={value ?? `empty-${Math.random()}`}
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 20, opacity: 0 }}
        transition={{
            type: 'spring',
            stiffness: 400,
            damping: 25,
            delay
        }}
        className="inline-block"
    >
        {value ?? '00'}
    </motion.span>
)));

DurationDigit.displayName = 'DurationDigit';

// ============================================================
// DYNAMIC ISLAND TIMER
// ============================================================

interface DynamicIslandTimerProps {
    startTimestamp: number;
    totalPausedTime: number;
    isPaused: boolean;
    currentExerciseName: string;
}

const DynamicIslandTimer = memo<DynamicIslandTimerProps>((props) => {
    const {
        startTimestamp,
        totalPausedTime,
        isPaused,
        currentExerciseName,
    } = props;

    const { formatted } = useWorkoutTimer({ startTimestamp, totalPausedTime, isPaused });
    const [isExpanded, setIsExpanded] = useState(false);

    // Parse formatted time
    const timeParts = formatted.split(':');
    const displayTime = timeParts.length === 3
        ? { hours: timeParts[0], minutes: timeParts[1], seconds: timeParts[2] }
        : { hours: null, minutes: timeParts[0] || '00', seconds: timeParts[1] || '00' };

    return (
        <motion.div
            layout
            className="relative"
            onTap={() => setIsExpanded(!isExpanded)}
            dir="ltr"
        >
            {/* Dynamic Island Pill */}
            <motion.div
                layout
                className={`
                    relative flex items-center gap-3 
                    rounded-[32px] transition-all duration-300
                    cursor-pointer spark-glass-heavy border-glass shadow-apple-action
                    ${isExpanded ? 'px-6 py-4' : 'px-5 py-2.5'}
                `}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
            >
                {/* Status Indicator */}
                <div className="relative flex items-center justify-center">
                        {isPaused ? (
                        <motion.div
                            className="w-3 h-3 rounded-sm bg-[var(--warning)]"
                            animate={{ opacity: [1, 0.5, 1] }}
                            transition={{ duration: 1, repeat: Infinity }}
                        />
                    ) : (
                        <div className="relative">
                            {/* Pulse ring */}
                            <motion.div
                                className="absolute inset-0 rounded-full"
                                style={{ backgroundColor: '#a3e635' }}
                                animate={{
                                    scale: [1, 1.8, 1.8],
                                    opacity: [0.6, 0, 0]
                                }}
                                transition={{
                                    duration: 2,
                                    repeat: Infinity,
                                    ease: 'easeOut'
                                }}
                            />
                            {/* Core dot */}
                            <motion.div
                                className="relative w-3 h-3 rounded-full"
                                animate={{ scale: [1, 1.15, 1] }}
                                transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
                                style={{
                                    backgroundColor: '#a3e635',
                                    boxShadow: '0 0 12px rgba(163, 230, 53, 0.6)',
                                }}
                            />
                        </div>
                    )}
                </div>

                {/* Time Content */}
                <div className="flex flex-col items-center leading-none">
                    {/* Label */}
                    <motion.span
                        layout
                        className={`
                            text-[9px] uppercase font-bold tracking-[0.2em] mb-1
                            ${isPaused ? 'text-[var(--warning)]' : 'text-white/40'}
                        `}
                    >
                        {isPaused ? 'PAUSED' : 'ACTIVE'}
                    </motion.span>

                    {/* Timer Value */}
                    <motion.div
                        layout
                        className={`
                            font-mono font-bold tracking-tight
                            ${isExpanded ? 'text-2xl' : 'text-xl'}
                            ${isPaused ? 'text-[var(--warning)]' : 'text-white'}
                        `}
                        style={{
                            fontFamily: 'var(--cosmos-font)',
                            fontVariantNumeric: 'tabular-nums',
                        }}
                    >
                        <AnimatePresence mode="popLayout">
                            {displayTime.hours && (
                                <>
                                    <DurationDigit value={displayTime.hours} />
                                    <span className="opacity-40 mx-0.5">:</span>
                                </>
                            )}
                            <DurationDigit value={displayTime.minutes} />
                            <span className="opacity-40 mx-0.5">:</span>
                            <DurationDigit value={displayTime.seconds} delay={0.02} />
                        </AnimatePresence>
                    </motion.div>
                </div>

                {/* Live indicator bars */}
                <div className="flex items-end gap-[2px] h-4 ms-1">
                    {[0.4, 0.7, 1, 0.6, 0.8].map((height, i) => (
                        <motion.div
                            key={i}
                            className={`w-[3px] rounded-full ${isPaused ? 'bg-[var(--warning)]/50' : 'bg-[var(--cosmos-accent-primary)]'
                                }`}
                            animate={isPaused ? {} : {
                                height: [`${height * 100}%`, `${(1 - height + 0.3) * 100}%`, `${height * 100}%`],
                            }}
                            transition={{
                                duration: 0.8 + i * 0.1,
                                repeat: Infinity,
                                ease: 'easeInOut',
                            }}
                            style={{ height: `${height * 100}%` }}
                        />
                    ))}
                </div>
            </motion.div>

            {/* Exercise Name (below pill when expanded) */}
            <AnimatePresence>
                {isExpanded && currentExerciseName && (
                    <motion.div
                        initial={{ opacity: 0, y: -5, height: 0 }}
                        animate={{ opacity: 1, y: 0, height: 'auto' }}
                        exit={{ opacity: 0, y: -5, height: 0 }}
                        className="text-center mt-2 text-[10px] text-white/30 font-medium tracking-wider uppercase"
                    >
                        {currentExerciseName}
                    </motion.div>
                )}
            </AnimatePresence>
        </motion.div>
    );
});

DynamicIslandTimer.displayName = 'DynamicIslandTimer';

// ============================================================
// ACTION BUTTON COMPONENT
// ============================================================

interface ActionButtonProps {
    icon: React.ReactNode;
    onClick: () => void;
    variant?: 'default' | 'primary' | 'danger' | 'success';
    isPending?: boolean;
    size?: 'sm' | 'md';
    label?: string;
}

const ActionButton = memo<ActionButtonProps>(({
    icon,
    onClick,
    variant = 'default',
    isPending = false,
    size = 'md',
    label
}) => {
    const variants = {
        default: 'spark-glass-light hover:bg-white/10 text-white border-glass shadow-apple-action',
        primary: 'bg-[var(--cosmos-accent-primary)] text-black shadow-apple-action',
        danger: 'bg-[var(--cosmos-error)] text-white shadow-apple-action',
        success: 'bg-[var(--cosmos-success)] text-white shadow-apple-action',
    };

    const sizes = {
        sm: 'w-10 h-10',
        md: 'w-11 h-11',
    };

    const handleClick = useCallback((e: React.MouseEvent) => {
        e.stopPropagation();
        onClick();
    }, [onClick, label]);

    return (
        <motion.button
            onClick={handleClick}
            whileHover={{ scale: 1.08 }}
            whileTap={{ scale: 0.92 }}
            animate={isPending ? {
                scale: [1, 1.1, 1],
                boxShadow: ['0 0 0 0 rgba(255,69,58,0)', '0 0 0 10px rgba(255,69,58,0.3)', '0 0 0 0 rgba(255,69,58,0)']
            } : {}}
            transition={isPending ? { duration: 0.6, repeat: Infinity } : { type: 'spring', stiffness: 400, damping: 20 }}
            className={`
                ${sizes[size]} rounded-full flex items-center justify-center
                border transition-all duration-200
                ${variants[isPending ? 'danger' : variant]}
            `}
            title={label}
        >
            {icon}
        </motion.button>
    );
});

ActionButton.displayName = 'ActionButton';

// ============================================================
// MAIN COMPONENT
// ============================================================

import { useTimerDisplaySettings } from '../hooks/useWorkoutSettings';

const WorkoutHeader = memo<WorkoutHeaderProps>(({
    startTimestamp,
    totalPausedTime,
    isPaused,
    currentExerciseName,
    onFinish,
    onDiscard,
    onOpenSettings,
    onOpenTutorial,
}) => {
    // Get settings
    const { showInHeader } = useTimerDisplaySettings();

    // Handle finish button tap - single tap, confirmation is in overlay
    const handleFinishTap = useCallback(() => {
        triggerHaptic('light');
        onFinish();
    }, [onFinish]);

    // Handle discard button tap - single tap, confirmation is in overlay
    const handleDiscardTap = useCallback(() => {
        triggerHaptic('light');
        onDiscard();
    }, [onDiscard]);

    return (
        <header className="flex justify-between items-start mb-6 pt-[env(safe-area-inset-top,20px)] w-full px-2">
            {/* Left Side: Action Buttons */}
            <motion.div
                className="flex items-center gap-2"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.1 }}
            >
                {/* Finish Button */}
                <div className="relative">
                    <ActionButton
                        icon={<CheckCircleIcon className="w-6 h-6" />}
                        onClick={handleFinishTap}
                        variant="success"
                        label="סיים אימון"
                    />
                </div>

                {/* Discard Button */}
                <div className="relative">
                    <ActionButton
                        icon={<TrashIcon className="w-5 h-5" />}
                        onClick={handleDiscardTap}
                        variant="default"
                        size="sm"
                        label="מחק אימון"
                    />
                </div>
            </motion.div>

            {/* Center: Dynamic Island Timer */}
            <motion.div
                className="flex-1 flex justify-center"
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15, type: 'spring', stiffness: 300 }}
            >
                {showInHeader && (
                    <DynamicIslandTimer
                        startTimestamp={startTimestamp}
                        totalPausedTime={totalPausedTime}
                        isPaused={isPaused}
                        currentExerciseName={currentExerciseName}
                    />
                )}
            </motion.div>

            {/* Right Side: Utility Buttons */}
            <motion.div
                className="flex gap-2"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.1 }}
            >
                {/* Tutorial Button */}
                <ActionButton
                    icon={
                        <span className="text-sm font-serif italic font-bold">i</span>
                    }
                    onClick={onOpenTutorial}
                    size="sm"
                    label="הדרכה"
                />

                {/* Settings Button */}
                <ActionButton
                    icon={<SettingsIcon className="w-5 h-5" />}
                    onClick={onOpenSettings}
                    size="sm"
                    label="הגדרות"
                />
            </motion.div>
        </header>
    );
});

WorkoutHeader.displayName = 'WorkoutHeader';

export default WorkoutHeader;

// NumpadOverlay - Premium number input for weight/reps
// Apple Calculator-inspired design with smart presets
// Uses Portal rendering via ModalOverlay for proper z-index stacking and focus management
import { memo, useCallback, useMemo, useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ModalOverlay } from '../../ui/ModalOverlay';
import { triggerHaptic } from '../../../utils/haptics';

// ============================================================
// TYPES
// ============================================================

interface NumpadOverlayProps {
    isOpen: boolean;
    target: 'weight' | 'reps' | null;
    value: string;
    onInput: (digit: string) => void;
    onDelete: () => void;
    onSubmit: () => void;
    onClose: () => void;
    /** Previous value for this set (ghost value) */
    previousValue?: number;
    /** Recent values used for this exercise */
    recentValues?: number[];
    /** Exercise name for context */
    exerciseName?: string;
    /** Last workout's value for comparison */
    lastWorkoutValue?: number;
}

// ============================================================
// CONSTANTS
// ============================================================

const WEIGHT_PRESETS = [20, 40, 60, 80, 100, 120];
const REPS_PRESETS = [6, 8, 10, 12, 15, 20];
const WEIGHT_INCREMENTS = [1.25, 2.5, 5, 10];
const REPS_INCREMENTS = [1, 2, 3, 5];



// ============================================================
// SUB-COMPONENTS
// ============================================================

/** Animated digit display with spring physics */
const AnimatedValue = memo<{ value: string; target: 'weight' | 'reps' | null }>(({ value, target }) => {
    const displayValue = value || '0';
    const prevValueRef = useRef(displayValue);
    const [isChanging, setIsChanging] = useState(false);

    useEffect(() => {
        if (prevValueRef.current !== displayValue) {
            setIsChanging(true);
            prevValueRef.current = displayValue;
            const timer = setTimeout(() => setIsChanging(false), 150);
            return () => clearTimeout(timer);
        }
        return undefined;
    }, [displayValue]);

    return (
        <div className="relative overflow-hidden">
            <motion.div
                className="text-[72px] font-[800] text-white tabular-nums leading-none tracking-tight"
                animate={{
                    scale: isChanging ? [1, 1.05, 1] : 1,
                    color: isChanging ? ['#FFFFFF', 'var(--cosmos-accent-primary)', '#FFFFFF'] : '#FFFFFF'
                }}
                transition={{ duration: 0.15 }}
            >
                {displayValue.split('').map((char, i) => (
                    <motion.span
                        key={`${i}-${char}`}
                        initial={{ opacity: 0, y: -20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="inline-block"
                        transition={{
                            type: 'spring',
                            stiffness: 500,
                            damping: 30,
                            delay: i * 0.02
                        }}
                    >
                        {char}
                    </motion.span>
                ))}
            </motion.div>

            {/* Unit suffix */}
            <motion.span
                className="absolute -end-8 bottom-2 text-xl text-white/50 font-medium"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
            >
                {target === 'weight' ? 'ק״ג' : 'x'}
            </motion.span>
        </div>
    );
});

AnimatedValue.displayName = 'AnimatedValue';

/** Premium numpad button with ripple effect */
const NumpadButton = memo<{
    value: string | number | null;
    onPress: () => void;
    variant?: 'number' | 'action' | 'delete' | 'submit';
    disabled?: boolean;
}>(({ value, onPress, variant = 'number', disabled = false }) => {
    const [ripples, setRipples] = useState<{ id: number; x: number; y: number }[]>([]);

    const handleClick = useCallback((e: React.MouseEvent<HTMLButtonElement>) => {
        if (disabled) return;

        // Add ripple
        const rect = e.currentTarget.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        const id = Date.now();
        setRipples(prev => [...prev.slice(-4), { id, x, y }]);
        setTimeout(() => setRipples(prev => prev.filter(r => r.id !== id)), 600);

        triggerHaptic();
        onPress();
    }, [onPress, disabled]);

    if (value === null) {
        return <div className="w-20 h-20" />;
    }

    const baseClasses = "relative w-20 h-20 rounded-full flex items-center justify-center overflow-hidden transition-all duration-200";
    const variantClasses = {
        number: "bg-[var(--gray-800)] text-white text-3xl font-medium hover:bg-[var(--gray-700)] active:bg-[var(--gray-900)]",
        action: "bg-[var(--gray-700)] text-white text-xl font-medium hover:bg-[var(--gray-600)]",
        delete: "bg-[var(--gray-800)] text-[var(--cosmos-accent-orange)] text-2xl hover:bg-[var(--gray-700)]",
        submit: "bg-[var(--cosmos-accent-primary)] text-black text-xl font-bold hover:brightness-110"
    };

    return (
        <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={handleClick}
            onPointerDown={(e) => { e.preventDefault(); handleClick(e as unknown as React.MouseEvent<HTMLButtonElement>); }}
            disabled={disabled}
            className={`${baseClasses} ${variantClasses[variant]} ${disabled ? 'opacity-30 cursor-not-allowed' : ''}`}
        >
            {/* Ripple effects */}
            <AnimatePresence>
                {ripples.map(ripple => (
                    <motion.span
                        key={ripple.id}
                        initial={{ scale: 0, opacity: 0.5 }}
                        animate={{ scale: 4, opacity: 0 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.6 }}
                        className="absolute w-20 h-20 rounded-full bg-white/30 pointer-events-none"
                        style={{ left: ripple.x - 40, top: ripple.y - 40 }}
                    />
                ))}
            </AnimatePresence>

            {value}
        </motion.button>
    );
});

NumpadButton.displayName = 'NumpadButton';

/** Quick preset button */
const PresetButton = memo<{
    value: number;
    isSelected: boolean;
    onSelect: (value: number) => void;
    isPrevious?: boolean;
}>(({ value, isSelected, onSelect, isPrevious }) => (
    <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => {
            triggerHaptic();
            onSelect(value);
        }}
        onPointerDown={(e) => {
            e.preventDefault();
            triggerHaptic();
            onSelect(value);
        }}
        className={`
            relative px-4 py-2 rounded-xl text-sm font-bold transition-all
            ${isSelected
                ? 'bg-[var(--cosmos-accent-primary)] text-black shadow-lg'
                : 'bg-[var(--bg-tertiary)] text-white/90 hover:bg-[var(--gray-600)]'
            }
        `}
    >
        {value}
        {isPrevious && (
            <motion.div
                className="absolute -top-1 -end-1 w-2 h-2 rounded-full bg-[#30D158]"
                animate={{ scale: [1, 1.2, 1] }}
                transition={{ duration: 1.5, repeat: Infinity }}
            />
        )}
    </motion.button>
));

PresetButton.displayName = 'PresetButton';

/** Increment/Decrement stepper */
const ValueStepper = memo<{
    currentValue: number;
    increments: number[];
    onAdjust: (delta: number) => void;
}>(({ currentValue, increments, onAdjust }) => (
    <div className="flex items-center gap-2">
        {/* Decrease buttons */}
        <div className="flex gap-1">
            {increments.slice().reverse().map(inc => (
                <motion.button
                    key={`dec-${inc}`}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.9 }}
                    onClick={() => {
                        triggerHaptic();
                        onAdjust(-inc);
                    }}
                    onPointerDown={(e) => {
                        e.preventDefault();
                        triggerHaptic();
                        onAdjust(-inc);
                    }}
                    className="w-10 h-10 rounded-full bg-[#FF453A]/20 text-[#FF453A] text-xs font-bold hover:bg-[#FF453A]/30 transition-all flex items-center justify-center"
                >
                    -{inc}
                </motion.button>
            ))}
        </div>

        {/* Current value */}
        <div className="px-4 py-2 bg-white/5 rounded-xl min-w-[60px] text-center">
            <span className="text-white font-bold tabular-nums">{currentValue}</span>
        </div>

        {/* Increase buttons */}
        <div className="flex gap-1">
            {increments.map(inc => (
                <motion.button
                    key={`inc-${inc}`}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.9 }}
                    onClick={() => {
                        triggerHaptic();
                        onAdjust(inc);
                    }}
                    onPointerDown={(e) => {
                        e.preventDefault();
                        triggerHaptic();
                        onAdjust(inc);
                    }}
                    className="w-10 h-10 rounded-full bg-[#30D158]/20 text-[#30D158] text-xs font-bold hover:bg-[#30D158]/30 transition-all flex items-center justify-center"
                >
                    +{inc}
                </motion.button>
            ))}
        </div>
    </div>
));

ValueStepper.displayName = 'ValueStepper';

/** Previous value ghost indicator */
const GhostValue = memo<{ value: number; label: string }>(({ value, label }) => (
    <motion.div
        className="flex items-center gap-2 px-3 py-1.5 bg-white/5 rounded-full"
        initial={{ opacity: 0, x: -10 }}
        animate={{ opacity: 1, x: 0 }}
    >
        <span className="text-xs text-white/40">{label}</span>
        <span className="text-sm text-white/60 font-medium tabular-nums">{value}</span>
    </motion.div>
));

GhostValue.displayName = 'GhostValue';

// ============================================================
// MAIN COMPONENT
// ============================================================

/**
 * NumpadOverlay - Premium full numpad for precise input
 * 
 * Features:
 * - Smart presets based on exercise history
 * - Increment/decrement steppers
 * - Previous value ghost indicator
 * - Animated digit display
 * - Haptic feedback on every interaction
 * - Spring-based animations
 * - Portal rendering for proper z-index stacking
 * - Focus trap and scroll lock
 */
const NumpadOverlay = memo<NumpadOverlayProps>(({
    isOpen,
    target,
    value,
    onInput,
    onDelete,
    onSubmit,
    onClose,
    previousValue,
    recentValues = [],
    exerciseName,
    lastWorkoutValue
}) => {
    const [mode, setMode] = useState<'numpad' | 'stepper'>('numpad');

    // Calculate numeric value for stepper
    const numericValue = useMemo(() => parseFloat(value) || 0, [value]);

    // Smart presets - combine defaults with recent values
    const presets = useMemo(() => {
        const defaults = target === 'weight' ? WEIGHT_PRESETS : REPS_PRESETS;
        const unique = [...new Set([...recentValues, ...defaults])].sort((a, b) => a - b);
        return unique.slice(0, 6);
    }, [target, recentValues]);

    const increments = target === 'weight' ? WEIGHT_INCREMENTS : REPS_INCREMENTS;

    // Handle preset selection
    const handlePresetSelect = useCallback((preset: number) => {
        // Clear and set new value
        onInput(String(preset));
    }, [onInput]);

    // Handle stepper adjustment
    const handleAdjust = useCallback((delta: number) => {
        const newValue = Math.max(0, numericValue + delta);
        // Format appropriately
        const formatted = target === 'weight'
            ? newValue.toFixed(newValue % 1 === 0 ? 0 : 2)
            : String(Math.round(newValue));
        onInput(formatted);
    }, [numericValue, target, onInput]);

    const handleInput = useCallback((digit: string) => {
        triggerHaptic();
        onInput(digit);
    }, [onInput]);

    const handleDelete = useCallback(() => {
        triggerHaptic('light');
        onDelete();
    }, [onDelete]);

    const handleSubmit = useCallback(() => {
        triggerHaptic('success');
        onSubmit();
    }, [onSubmit]);

    // Number pad keys - weight allows decimal, reps doesn't
    const keys: (number | string | null)[][] = target === 'weight'
        ? [[1, 2, 3], [4, 5, 6], [7, 8, 9], ['.', 0, '⌫']]
        : [[1, 2, 3], [4, 5, 6], [7, 8, 9], [null, 0, '⌫']];

    const label = target === 'weight' ? 'משקל' : 'חזרות';

    return (
        <ModalOverlay
            isOpen={isOpen}
            onClose={onClose}
            variant="none"
            zLevel="ultra"
            backdropOpacity={90}
            blur="xl"
            trapFocus
            lockScroll
            closeOnBackdropClick
            closeOnEscape
            ariaLabel={label}
        >
            <motion.div
                initial={{ y: '100%' }}
                animate={{ y: 0 }}
                exit={{ y: '100%' }}
                transition={{ type: 'spring', damping: 28, stiffness: 350 }}
                className="w-full bg-gradient-to-b from-[var(--bg-secondary)] to-[var(--bg-primary)] rounded-t-[32px] pb-safe-bottom overflow-hidden shadow-2xl border-t border-white/10 fixed bottom-0 left-0 right-0"
                onClick={e => e.stopPropagation()}
            >
                {/* Drag Handle */}
                <div className="flex justify-center pt-3 pb-2">
                    <motion.div
                        className="w-10 h-1 bg-white/20 rounded-full"
                        whileHover={{ width: 60, backgroundColor: 'rgba(255,255,255,0.4)' }}
                    />
                </div>

                {/* Header with ghost values */}
                <div className="px-6 pb-4">
                    {/* Exercise context */}
                    {exerciseName && (
                        <motion.div
                            className="text-center mb-2"
                            initial={{ opacity: 0, y: -10 }}
                            animate={{ opacity: 1, y: 0 }}
                        >
                            <span className="text-xs text-white/40 uppercase tracking-wider">
                                {exerciseName}
                            </span>
                        </motion.div>
                    )}

                    {/* Label */}
                    <div className="text-center mb-1">
                        <span className="text-sm text-[var(--cosmos-accent-primary)] uppercase tracking-widest font-bold">
                            {label}
                        </span>
                    </div>

                    {/* Value Display */}
                    <div className="flex justify-center mb-4">
                        <AnimatedValue value={value} target={target} />
                    </div>

                    {/* Ghost values row */}
                    <div className="flex justify-center gap-3 flex-wrap">
                        {previousValue !== undefined && (
                            <GhostValue value={previousValue} label="קודם" />
                        )}
                        {lastWorkoutValue !== undefined && (
                            <GhostValue value={lastWorkoutValue} label="אימון קודם" />
                        )}
                    </div>
                </div>

                {/* Mode Toggle */}
                <div className="flex justify-center mb-4 px-6">
                    <div className="flex bg-[var(--bg-tertiary)] rounded-xl p-1">
                        <motion.button
                            onClick={() => setMode('numpad')}
                            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${mode === 'numpad'
                                ? 'bg-white/10 text-white'
                                : 'text-white/50 hover:text-white/80'
                                }`}
                            whileTap={{ scale: 0.95 }}
                        >
                            מקלדת
                        </motion.button>
                        <motion.button
                            onClick={() => setMode('stepper')}
                            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${mode === 'stepper'
                                ? 'bg-white/10 text-white'
                                : 'text-white/50 hover:text-white/80'
                                }`}
                            whileTap={{ scale: 0.95 }}
                        >
                            כפתורי +/-
                        </motion.button>
                    </div>
                </div>

                {/* Quick Presets */}
                <div className="px-6 mb-4">
                    <div className="flex gap-2 justify-center flex-wrap">
                        {presets.map((preset) => (
                            <PresetButton
                                key={preset}
                                value={preset}
                                isSelected={numericValue === preset}
                                onSelect={handlePresetSelect}
                                isPrevious={preset === previousValue}
                            />
                        ))}
                    </div>
                </div>

                <AnimatePresence mode="sync">
                    {mode === 'numpad' ? (
                        /* Number Grid */
                        <motion.div
                            key="numpad"
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -20 }}
                            className="px-6 pb-4"
                        >
                            <div className="flex flex-col items-center gap-3">
                                {keys.map((row, rowIndex) => (
                                    <div key={rowIndex} className="flex gap-3">
                                        {row.map((key, keyIndex) => (
                                            <NumpadButton
                                                key={`${rowIndex}-${keyIndex}`}
                                                value={key}
                                                onPress={() => {
                                                    if (key === '⌫') {
                                                        handleDelete();
                                                    } else if (key !== null) {
                                                        handleInput(String(key));
                                                    }
                                                }}
                                                variant={key === '⌫' ? 'delete' : 'number'}
                                            />
                                        ))}
                                    </div>
                                ))}
                            </div>
                        </motion.div>
                    ) : (
                        /* Stepper Mode */
                        <motion.div
                            key="stepper"
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: 20 }}
                            className="px-6 pb-4 flex justify-center"
                        >
                            <ValueStepper
                                currentValue={numericValue}
                                increments={increments}
                                onAdjust={handleAdjust}
                            />
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Confirm Button */}
                <div className="px-6 pb-8">
                    <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={handleSubmit}
                        onPointerDown={(e) => {
                            if (!(!value && numericValue === 0)) {
                                e.preventDefault();
                                handleSubmit();
                            }
                        }}
                        disabled={!value && numericValue === 0}
                        className={`
                            w-full h-14 rounded-2xl font-bold text-lg tracking-wide
                            transition-all duration-200 relative overflow-hidden
                            ${(!value && numericValue === 0)
                                ? 'bg-white/10 text-white/30 cursor-not-allowed'
                                : 'bg-[var(--cosmos-accent-primary)] text-black shadow-lg hover:shadow-xl'
                            }
                        `}
                    >
                        {/* Shimmer effect */}
                        <motion.div
                            className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent"
                            initial={{ x: '-100%' }}
                            animate={{ x: '100%' }}
                            transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
                        />
                        <span className="relative z-10">אישור</span>
                    </motion.button>
                </div>
            </motion.div>

            <style>{`
                .pb-safe-bottom { padding-bottom: env(safe-area-inset-bottom, 24px); }
            `}</style>
        </ModalOverlay>
    );
});

NumpadOverlay.displayName = 'NumpadOverlay';

export default NumpadOverlay;

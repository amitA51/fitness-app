// SetInputCard - Ultra Premium Input Card with Apple Fitness+ aesthetics
// Features: Fluid animations, haptic visual feedback, ghost values, 3D press effects

import React, { useCallback, memo, useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { PremiumButton } from './ui/PremiumButton';
import { AnimatedNumber } from './ui/AnimatedNumber';
import { triggerHaptic } from '../../../utils/haptics';

// ============================================================
// ANIMATION CONSTANTS (stable references to prevent re-renders)
// ============================================================

// ANIMATION CONSTANTS (stable references to prevent re-renders)
// ============================================================

const ICON_BADGE_HOVER = { scale: 1.1, rotate: 5 };

const LABEL_INITIAL = { opacity: 0, y: -5 };
const LABEL_ANIMATE = { opacity: 1, y: 0 };

const STEP_INITIAL = { opacity: 0 };
const STEP_ANIMATE = { opacity: 1 };
const STEP_TRANSITION = { delay: 0.3 };

const FLASH_INITIAL = { opacity: 0.4 };
const FLASH_ANIMATE = { opacity: 0 };
const FLASH_EXIT = { opacity: 0 };
const FLASH_TRANSITION = { duration: 0.4 };

// ============================================================
// TYPES
// ============================================================

interface SetInputCardProps {
    label: string;
    value: number;
    ghostValue?: number;
    showGhost: boolean;
    icon?: React.ReactNode;
    incrementAmount?: number;
    unit?: string;
    accentColor?: string;
    onTap: () => void;
    onIncrement: () => void;
    onDecrement: () => void;
    showButtons?: boolean;
}



// ============================================================
// GHOST VALUE INDICATOR
// ============================================================

const GhostIndicator = memo(() => (
    <motion.div
        initial={{ opacity: 0, scale: 0.8, y: -5 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="absolute top-3 right-3 flex items-center gap-1.5 px-2 py-1 rounded-lg spark-glass-light border-glass"
    >
        <div
            className="w-1.5 h-1.5 rounded-full bg-[var(--cosmos-accent-cyan)] opacity-50"
        />
        <span className="text-[9px] uppercase font-bold tracking-wider text-white/40">
            Previous
        </span>
    </motion.div>
));

GhostIndicator.displayName = 'GhostIndicator';

// ============================================================
// MAIN COMPONENT
// ============================================================

const SetInputCard = memo<SetInputCardProps>(({
    label,
    value,
    ghostValue,
    showGhost,
    icon,
    incrementAmount = 1,
    unit,
    accentColor,
    onTap,
    onIncrement,
    onDecrement,
    showButtons = true,
}) => {
    const displayValue = value || (showGhost ? ghostValue : 0) || 0;
    const isGhostValue = !value && showGhost && ghostValue;


    // 3D tilt effect removed for performance

    // Track value changes for flash effect
    const [shouldFlash, setShouldFlash] = useState(false);
    const prevValueRef = useRef(value);

    useEffect(() => {
        if (value !== prevValueRef.current && value !== 0) {
            setShouldFlash(true);
            const timer = setTimeout(() => setShouldFlash(false), 400);
            prevValueRef.current = value;
            return () => clearTimeout(timer);
        }
        prevValueRef.current = value;
        return undefined;
    }, [value]);

    const handleTap = useCallback(() => {
        triggerHaptic('medium');
        onTap();
    }, [onTap]);

    const handleIncrement = useCallback(() => {
        onIncrement();
    }, [onIncrement]);

    const handleDecrement = useCallback(() => {
        onDecrement();
    }, [onDecrement]);

    // Accent color with fallback
    const accent = accentColor || 'var(--cosmos-accent-primary)';

    return (
        <div
            className={`
                relative rounded-[28px] p-5
                flex flex-col items-center
                overflow-hidden cursor-pointer
                spark-glass-heavy border-glass
                transition-shadow duration-300
                ${shouldFlash ? 'shadow-[0_0_30px_var(--cosmos-success)]' : 'shadow-apple-action'}
                active:scale-[0.98] transition-transform
            `}
            onClick={(e) => {
                e.stopPropagation();
                handleTap();
            }}
        >
            {/* Gradient overlay for depth */}
            <div
                className="absolute inset-0 pointer-events-none"
                style={{
                    background: `linear-gradient(165deg,
                        rgba(255,255,255,0.08) 0%,
                        transparent 30%,
                        transparent 70%,
                        rgba(0,0,0,0.2) 100%)`,
                }}
            />

            {/* Top shine line */}
            <div
                className="absolute top-0 left-0 right-0 h-[1px] pointer-events-none"
                style={{
                    background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.2), transparent)',
                }}
            />

            {/* Icon Badge */}
            <motion.div
                className="absolute top-4 left-4 w-9 h-9 rounded-xl flex items-center justify-center"
                style={{
                    background: `linear-gradient(135deg, ${accent}20 0%, ${accent}10 100%)`,
                    border: `1px solid ${accent}30`,
                }}
                whileHover={ICON_BADGE_HOVER}
            >
                {icon || (
                    <svg
                        width="18"
                        height="18"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke={accent}
                        strokeWidth="2.5"
                        strokeLinecap="round"
                    >
                        <path d="M12 2v20M2 12h20" />
                    </svg>
                )}
            </motion.div>

            {/* Ghost Indicator */}
            <AnimatePresence>
                {isGhostValue && <GhostIndicator />}
            </AnimatePresence>

            {/* Label */}
            <motion.span
                className="text-[11px] uppercase tracking-[0.15em] text-white/50 mb-2 font-bold mt-1"
                initial={LABEL_INITIAL}
                animate={LABEL_ANIMATE}
            >
                {label}
            </motion.span>

            {/* Value Display */}
            <div className="relative my-3">
                <AnimatedNumber
                    value={displayValue}
                    isGhost={!!isGhostValue}
                    className={`text-[72px] font-[800] leading-none tracking-tight ${isGhostValue ? '' : 'workout-hero-number'
                        }`}
                />

                {/* Unit text */}
                {unit && (
                    <span className="absolute -bottom-1 right-0 translate-x-full ml-1 text-sm text-white/30 font-medium">
                        {unit}
                    </span>
                )}
            </div>

            {/* Change indicator removed as per user request */}

            {/* Increment/Decrement Buttons */}
            {showButtons && (
                <div
                    className="flex justify-between w-full mt-5 gap-3"
                    onPointerDown={e => e.stopPropagation()}
                    onClick={e => e.stopPropagation()}
                >
                    <PremiumButton variant="decrement" onPress={handleDecrement}>
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                            <path d="M5 12h14" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
                        </svg>
                    </PremiumButton>
                    <PremiumButton variant="increment" onPress={handleIncrement}>
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                            <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
                        </svg>
                    </PremiumButton>
                </div>
            )}

            {/* Step Amount Hint */}
            <motion.div
                className="absolute bottom-2.5 left-1/2 -translate-x-1/2 flex items-center gap-1 text-[9px] text-white/10 font-mono font-medium"
                initial={STEP_INITIAL}
                animate={STEP_ANIMATE}
                transition={STEP_TRANSITION}
            >
                <span>STEP</span>
                <span className="text-white/20">{incrementAmount}</span>
            </motion.div>

            {/* Flash overlay */}
            <AnimatePresence>
                {shouldFlash && (
                    <motion.div
                        initial={FLASH_INITIAL}
                        animate={FLASH_ANIMATE}
                        exit={FLASH_EXIT}
                        transition={FLASH_TRANSITION}
                        className="absolute inset-0 pointer-events-none rounded-[28px]"
                        style={{
                            background: `radial-gradient(circle at center, ${accent}40 0%, transparent 70%)`,
                        }}
                    />
                )}
            </AnimatePresence>
        </div>
    );
});

SetInputCard.displayName = 'SetInputCard';

export default SetInputCard;

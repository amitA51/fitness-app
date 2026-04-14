import React, { memo, useCallback, useState, useTransition } from 'react';
import { motion, AnimatePresence, useSpring } from 'framer-motion';
import { triggerHaptic } from '../../../../utils/haptics';



// ============================================================
// ANIMATION CONSTANTS
// ============================================================

const PRESSED_SCALE = { scale: 0.85 };
const NORMAL_SCALE = { scale: 1 };
const ICON_TRANSITION = { type: 'spring' as const, stiffness: 600, damping: 25 };

const RIPPLE_INITIAL = { scale: 0, opacity: 0.5 };
const RIPPLE_ANIMATE = { scale: 2.5, opacity: 0 };
const RIPPLE_EXIT = { opacity: 0 };
const RIPPLE_TRANSITION = { duration: 0.4, ease: 'easeOut' as const };

const SHINE_ANIMATE = { left: ['calc(-100%)', 'calc(200%)'] };
const SHINE_TRANSITION = {
    duration: 2.5,
    repeat: Infinity,
    repeatDelay: 1,
    ease: 'easeInOut' as const,
};

// ============================================================
// COMPONENT
// ============================================================

export interface PremiumButtonProps {
    onPress: () => void;
    variant: 'increment' | 'decrement';
    children: React.ReactNode;
    disabled?: boolean;
}

export const PremiumButton = memo<PremiumButtonProps>(({ onPress, variant, children, disabled = false }) => {
    const [, startTransition] = useTransition();
    const [isPressed, setIsPressed] = useState(false);
    const scale = useSpring(1, { stiffness: 400, damping: 20 });
    const brightness = useSpring(1, { stiffness: 400, damping: 20 });

    const handlePointerDown = useCallback((e: React.PointerEvent) => {
        if (disabled) return;
        e.stopPropagation();
        e.preventDefault();

        setIsPressed(true);
        scale.set(0.9);
        brightness.set(variant === 'increment' ? 1.15 : 0.85);

        // Instant haptic feedback
        triggerHaptic('light');

        // Non-blocking state update
        startTransition(() => {
            onPress();
        });
    }, [disabled, onPress, scale, brightness, variant]);

    const handlePointerUp = useCallback(() => {
        setIsPressed(false);
        scale.set(1);
        brightness.set(1);
    }, [scale, brightness]);

    const handlePointerLeave = useCallback(() => {
        if (isPressed) {
            setIsPressed(false);
            scale.set(1);
            brightness.set(1);
        }
    }, [isPressed, scale, brightness]);

    const isIncrement = variant === 'increment';

    return (
        <motion.button
            type="button"
            disabled={disabled}
            className={`
                relative flex-1 h-14 rounded-2xl overflow-hidden
                flex items-center justify-center
                text-2xl font-bold select-none
                transition-shadow duration-150
                touch-manipulation
                ${disabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}
                ${isIncrement
                    ? 'bg-[var(--cosmos-accent-primary)] text-black shadow-lg shadow-[var(--cosmos-accent-primary)]/25'
                    : 'bg-[var(--bg-elevated)] text-white border border-white/5'
                }
            `}
            style={{
                scale,
                filter: `brightness(${brightness.get()})`,
                touchAction: 'manipulation',
                WebkitTapHighlightColor: 'transparent',
            }}
            onPointerDown={handlePointerDown}
            onPointerUp={handlePointerUp}
            onPointerLeave={handlePointerLeave}
            onPointerCancel={handlePointerUp}
        >
            {/* Shine effect for increment button */}
            {isIncrement && (
                <div className="absolute inset-0 overflow-hidden pointer-events-none">
                    <motion.div
                        className="absolute top-0 -left-full w-full h-full"
                        style={{
                            background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.3), transparent)',
                        }}
                        animate={SHINE_ANIMATE}
                        transition={SHINE_TRANSITION}
                    />
                </div>
            )}

            {/* Icon with subtle animation */}
            <motion.span
                animate={isPressed ? PRESSED_SCALE : NORMAL_SCALE}
                transition={ICON_TRANSITION}
            >
                {children}
            </motion.span>

            {/* Ripple effect on press */}
            <AnimatePresence>
                {isPressed && (
                    <motion.div
                        initial={RIPPLE_INITIAL}
                        animate={RIPPLE_ANIMATE}
                        exit={RIPPLE_EXIT}
                        transition={RIPPLE_TRANSITION}
                        className="absolute inset-0 rounded-full bg-white/20"
                        style={{ transformOrigin: 'center' }}
                    />
                )}
            </AnimatePresence>
        </motion.button>
    );
});

PremiumButton.displayName = 'PremiumButton';

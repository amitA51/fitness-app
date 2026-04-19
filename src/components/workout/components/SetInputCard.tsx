// SetInputCard - Premium Input Card using CSS Variables
// Minimal palette - primary color only

import { AnimatePresence, motion } from 'framer-motion';
import type React from 'react';
import { memo, useCallback, useEffect, useRef, useState } from 'react';
import { triggerHaptic } from '../../../utils/haptics';
import { cn } from '../../../utils/styles';
import { AnimatedNumber } from './ui/AnimatedNumber';

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
// GHOST INDICATOR
// ============================================================

const GhostIndicator = memo(() => (
  <div className="absolute top-2 right-2 flex items-center gap-1">
    <div className="size-1.5 rounded-full bg-white/20" />
    <span className="text-[8px] uppercase font-medium text-white/20">Prev</span>
  </div>
));

GhostIndicator.displayName = 'GhostIndicator';

// ============================================================
// MAIN COMPONENT
// ============================================================

const SetInputCard = memo<SetInputCardProps>(
  ({
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

    const handleIncrement = useCallback(
      (e: React.MouseEvent) => {
        e.stopPropagation();
        triggerHaptic('light');
        onIncrement();
      },
      [onIncrement]
    );

    const handleDecrement = useCallback(
      (e: React.MouseEvent) => {
        e.stopPropagation();
        triggerHaptic('light');
        onDecrement();
      },
      [onDecrement]
    );

    const accent = accentColor || 'var(--cosmos-accent-primary)';
    const glowIntensity = isGhostValue ? '0' : '25';

    return (
      <div
        className={cn(
          'relative flex flex-col rounded-3xl overflow-hidden cursor-pointer',
          'bg-white/[0.03] backdrop-blur-xl',
          'active:scale-[0.98] transition-transform duration-150'
        )}
        onClick={(e) => {
          e.stopPropagation();
          handleTap();
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            e.stopPropagation();
            handleTap();
          }
        }}
        role="button"
        tabIndex={0}
        style={{
          boxShadow: `0 0 ${glowIntensity}px ${accent}20, inset 0 1px 0 rgba(255,255,255,0.06)`,
        }}
      >
        {/* Gradient Background */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: `radial-gradient(ellipse at 50% 0%, ${accent}15 0%, transparent 70%)`,
          }}
        />

        {/* Icon */}
        <div className="relative flex justify-end p-3">
          {icon && (
            <div
              className="size-10 rounded-2xl flex items-center justify-center"
              style={{
                background: `${accent}10`,
              }}
            >
              {icon}
            </div>
          )}
          {isGhostValue && <GhostIndicator />}
        </div>

        {/* Content */}
        <div className="relative flex-1 flex flex-col items-center px-4 pb-5">
          {/* Label */}
          <span
            className="text-[10px] uppercase tracking-[0.25em] font-semibold mb-3"
            style={{ color: accent }}
          >
            {label}
          </span>

          {/* Value with Glow */}
          <div className="relative">
            <AnimatedNumber
              value={displayValue}
              isGhost={!!isGhostValue}
              className={cn(
                'text-[70px] sm:text-[80px] font-black leading-none tracking-tight',
                !isGhostValue && 'workout-hero-number'
              )}
              style={
                {
                  filter: !isGhostValue ? `drop-shadow(0 0 12px ${accent}40)` : 'none',
                } as React.CSSProperties
              }
            />
            {unit && (
              <span className="absolute -bottom-2 right-0 translate-x-full ml-2 text-sm text-white/40 font-medium">
                {unit}
              </span>
            )}
          </div>

          {/* Quick Buttons */}
          {showButtons && (
            <div
              className="flex justify-between w-full mt-5 gap-2"
              onPointerDown={(e) => e.stopPropagation()}
            >
              <button
                type="button"
                onClick={handleDecrement}
                className={cn(
                  'flex-1 py-4 rounded-2xl font-bold text-2xl transition-all active:scale-95',
                  'bg-white/[0.05] hover:bg-white/[0.08] text-white/60'
                )}
                aria-label="הפחת ערך"
              >
                <span style={{ color: accent }}>-</span>
              </button>
              <button
                type="button"
                onClick={handleIncrement}
                className={cn(
                  'flex-1 py-4 rounded-2xl font-bold text-2xl transition-all active:scale-95',
                  'bg-white/[0.05] hover:bg-white/[0.08] text-white/60'
                )}
                aria-label="הגדל ערך"
              >
                <span style={{ color: accent }}>+</span>
              </button>
            </div>
          )}

          {/* Step Hint */}
          <span className="mt-4 text-[9px] text-white/15 font-mono uppercase tracking-widest">
            Step {incrementAmount}
          </span>
        </div>

        {/* Flash Effect */}
        <AnimatePresence>
          {shouldFlash && (
            <motion.div
              initial={{ opacity: 0.5 }}
              animate={{ opacity: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.4 }}
              className="absolute inset-0 pointer-events-none rounded-3xl"
              style={{
                background: `radial-gradient(circle at center, ${accent}30 0%, transparent 70%)`,
              }}
            />
          )}
        </AnimatePresence>
      </div>
    );
  }
);

SetInputCard.displayName = 'SetInputCard';

export default SetInputCard;

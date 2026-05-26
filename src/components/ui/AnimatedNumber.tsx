import { animate, motion, useMotionValue } from 'framer-motion';
import type React from 'react';
import { useEffect, useRef, useState } from 'react';

interface AnimatedNumberProps {
  /** The target number to animate to */
  value: number;
  /** Duration in seconds (default: 0.6) */
  duration?: number;
  /** Format function for display (e.g., adding commas, decimal places) */
  format?: (value: number) => string;
  /** Additional className */
  className?: string;
  /** Whether to show a direction indicator arrow */
  showDirection?: boolean;
  /** Color when value increases */
  increaseColor?: string;
  /** Color when value decreases */
  decreaseColor?: string;
}

/**
 * AnimatedNumber - Smooth number counter animation
 *
 * Animates between number values with spring physics.
 * Displays a brief color flash when the value changes.
 *
 * Usage:
 *   <AnimatedNumber value={streak} />
 *   <AnimatedNumber value={score} format={v => `${v}%`} />
 *   <AnimatedNumber value={count} showDirection />
 */
export const AnimatedNumber: React.FC<AnimatedNumberProps> = ({
  value,
  duration = 0.6,
  format = (v) => Math.round(v).toString(),
  className = '',
  showDirection = false,
  increaseColor = 'var(--dynamic-accent-start)',
  decreaseColor = '#f87171',
}) => {
  const motionValue = useMotionValue(value);
  const [displayValue, setDisplayValue] = useState(format(value));
  const prevValueRef = useRef(value);
  const [direction, setDirection] = useState<'up' | 'down' | null>(null);

  useEffect(() => {
    const prev = prevValueRef.current;
    if (prev !== value) {
      setDirection(value > prev ? 'up' : 'down');
      // Clear direction indicator after animation
      const timer = setTimeout(() => setDirection(null), 800);

      const controls = animate(motionValue, value, {
        duration,
        ease: [0.22, 1, 0.36, 1],
        onUpdate: (latest) => {
          setDisplayValue(format(latest));
        },
      });

      prevValueRef.current = value;
      return () => {
        controls.stop();
        clearTimeout(timer);
      };
    }
    return undefined;
  }, [value, duration, format, motionValue]);

  return (
    <span className={`relative inline-flex items-center gap-1 ${className}`}>
      <motion.span
        key={value}
        initial={direction ? { y: direction === 'up' ? 8 : -8, opacity: 0.5 } : false}
        animate={{ y: 0, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 400, damping: 25 }}
        style={{
          color:
            direction === 'up' ? increaseColor : direction === 'down' ? decreaseColor : undefined,
          transition: 'color 0.5s ease',
        }}
      >
        {displayValue}
      </motion.span>

      {showDirection && direction && (
        <motion.span
          initial={{ opacity: 0, y: direction === 'up' ? 4 : -4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          className="text-[0.7em]"
          style={{ color: direction === 'up' ? increaseColor : decreaseColor }}
        >
          {direction === 'up' ? '\u2191' : '\u2193'}
        </motion.span>
      )}
    </span>
  );
};

/**
 * AnimatedProgress - Smooth progress bar with animated fill
 */
export const AnimatedProgress: React.FC<{
  value: number; // 0-100
  className?: string;
  barClassName?: string;
  height?: number;
  color?: string;
  showLabel?: boolean;
}> = ({
  value,
  className = '',
  barClassName = '',
  height = 4,
  color = 'var(--dynamic-accent-start)',
  showLabel = false,
}) => {
  const clampedValue = Math.min(100, Math.max(0, value));

  return (
    <div className={`relative w-full overflow-hidden rounded-full ${className}`}>
      <div
        className="w-full rounded-full"
        style={{ height: `${height}px`, background: 'var(--color-border)' }}
      >
        <motion.div
          className={`h-full rounded-full ${barClassName}`}
          initial={{ width: 0 }}
          animate={{ width: `${clampedValue}%` }}
          transition={{
            type: 'spring',
            stiffness: 100,
            damping: 20,
            mass: 0.8,
          }}
          style={{
            background: color,
            boxShadow: clampedValue > 0 ? `0 0 8px ${color}40` : undefined,
          }}
        />
      </div>
      {showLabel && (
        <AnimatedNumber
          value={clampedValue}
          format={(v) => `${Math.round(v)}%`}
          className="absolute right-0 top-1/2 -translate-y-1/2 text-xs font-mono text-[var(--fs-muted)]"
        />
      )}
    </div>
  );
};

export default AnimatedNumber;

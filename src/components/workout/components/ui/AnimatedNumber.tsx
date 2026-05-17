import { AnimatePresence, motion } from 'framer-motion';
import type { CSSProperties } from 'react';
import { memo, useEffect, useRef, useState } from 'react';

// ============================================================
// ANIMATION CONSTANTS
// ============================================================

const SPRING_TRANSITION = {
  type: 'spring' as const,
  stiffness: 500,
  damping: 30,
  mass: 0.8,
};

// ============================================================
// COMPONENT
// ============================================================

export interface AnimatedNumberProps {
  value: number;
  isGhost?: boolean;
  className?: string;
  style?: CSSProperties;
}

export const AnimatedNumber = memo<AnimatedNumberProps>(
  ({ value, isGhost = false, className = '', style }) => {
    const [displayValue, setDisplayValue] = useState(value);
    const [direction, setDirection] = useState<'up' | 'down' | null>(null);
    const prevValue = useRef(value);

    useEffect(() => {
      if (value !== prevValue.current) {
        setDirection(value > prevValue.current ? 'up' : 'down');
        setDisplayValue(value);
        prevValue.current = value;
      }
    }, [value]);

    return (
      <div className="relative overflow-hidden">
        <AnimatePresence mode="popLayout">
          <motion.span
            key={value}
            initial={{
              y: direction === 'up' ? 30 : -30,
              opacity: 0,
              scale: 0.8,
            }}
            animate={{
              y: 0,
              opacity: 1,
              scale: 1,
            }}
            exit={{
              y: direction === 'up' ? -30 : 30,
              opacity: 0,
              scale: 0.8,
              position: 'absolute',
            }}
            transition={SPRING_TRANSITION}
            className={`
                        inline-block workout-hero-number
                        ${isGhost ? 'text-white/15' : 'text-white'}
                        ${className}
                    `}
            style={{
              fontFamily: 'var(--font-display)',
              fontVariantNumeric: 'tabular-nums',
              ...style,
            }}
          >
            {displayValue}
          </motion.span>
        </AnimatePresence>
      </div>
    );
  }
);

AnimatedNumber.displayName = 'AnimatedNumber';

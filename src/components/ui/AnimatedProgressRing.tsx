import { AnimatePresence, m } from 'framer-motion';
import type React from 'react';
import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { useReducedMotion } from '../../hooks/useReducedMotion';

interface AnimatedProgressRingProps {
  percentage: number;
  size?: number;
  strokeWidth?: number;
  showConfetti?: boolean;
  label?: string;
  subLabel?: string;
}

// Confetti particle component
const ConfettiParticle: React.FC<{
  delay: number;
  color: string | undefined;
  x: number;
  rotation: number;
  yOffset: number;
}> = ({ delay, color, x, rotation, yOffset }) => {
  return (
    <m.div
      className="absolute w-2 h-2 rounded-sm"
      style={{
        backgroundColor: color,
        left: '50%',
        top: '50%',
      }}
      initial={{
        x: 0,
        y: 0,
        scale: 0,
        rotate: 0,
        opacity: 1,
      }}
      animate={{
        x,
        y: -80 - yOffset,
        scale: [0, 1, 0],
        rotate: rotation,
        opacity: [1, 1, 0],
      }}
      transition={{
        duration: 1.2,
        delay: delay,
        ease: [0.22, 1, 0.36, 1],
      }}
    />
  );
};

const AnimatedProgressRing: React.FC<AnimatedProgressRingProps> = ({
  percentage,
  size = 140,
  strokeWidth = 12,
  showConfetti = true,
  label,
  subLabel,
}) => {
  const shouldReduceMotion = useReducedMotion();
  const [showCelebration, setShowCelebration] = useState(false);
  // Previous value tracked in a ref, not state: it only gates the rising-edge
  // detection below and must never trigger its own re-render or sit in deps.
  const prevPercentageRef = useRef(percentage);

  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (percentage / 100) * circumference;

  // Detect the moment we cross into 100% (rising edge only)
  useEffect(() => {
    const prev = prevPercentageRef.current;
    prevPercentageRef.current = percentage;
    if (percentage >= 100 && prev < 100 && showConfetti && !shouldReduceMotion) {
      setShowCelebration(true);
      const timer = setTimeout(() => setShowCelebration(false), 2000);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [percentage, showConfetti, shouldReduceMotion]);

  // Confetti colors sourced from the design-token palette
  const confettiColors = useMemo(
    () => [
      'var(--fs-accent)',
      'var(--fs-accent-2)',
      'var(--fs-signal)',
      'var(--fs-warn)',
      'var(--fs-steel)',
      'var(--fs-primary)',
    ],
    []
  );

  const confettiParticles = useMemo(() => {
    // Deterministic pseudo-random using index-based seed
    const seed = (i: number) => Math.sin(i * 9301 + 49297) * 0.5 + 0.5;
    return Array.from({ length: 20 }).map((_, i) => ({
      id: i,
      color: confettiColors[i % confettiColors.length],
      delay: i * 0.03,
      x: (seed(i) - 0.5) * 100,
      rotation: seed(i + 20) * 720,
      yOffset: seed(i + 40) * 40,
    }));
  }, [confettiColors]);

  // Gradient colors based on percentage. Memoized so the SVG `stop` elements
  // and the radial-gradient background do not get a new prop reference on
  // every parent render.
  const gradientColors = useMemo(() => {
    if (percentage >= 100) return { start: 'var(--fs-accent)', end: 'var(--fs-accent-2)' };
    if (percentage >= 75) return { start: 'var(--fs-accent-2)', end: 'var(--fs-accent)' };
    if (percentage >= 50) return { start: 'var(--fs-signal)', end: 'var(--fs-accent)' };
    if (percentage >= 25) return { start: 'var(--fs-warn)', end: 'var(--fs-signal)' };
    return { start: 'var(--fs-steel)', end: 'var(--fs-muted)' };
  }, [percentage]);

  const reactId = useId();
  const gradientId = `progress-gradient-${reactId}`;
  const glowFilterId = `progress-glow-${reactId}`;

  return (
    <div
      className={`relative inline-flex items-center justify-center celebration-container ${
        percentage >= 100 ? 'progress-ring-complete' : ''
      }`}
      style={{ width: size, height: size }}
      role="progressbar"
      tabIndex={-1}
      aria-valuenow={Math.round(percentage)}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label || 'התקדמות'}
    >
      {/* Confetti */}
      <AnimatePresence>
        {showCelebration && (
          <div className="absolute inset-0 pointer-events-none overflow-visible">
            {confettiParticles.map((particle) => (
              <ConfettiParticle
                key={particle.id}
                delay={particle.delay}
                color={particle.color}
                x={particle.x}
                rotation={particle.rotation}
                yOffset={particle.yOffset}
              />
            ))}
          </div>
        )}
      </AnimatePresence>

      {/* Background glow */}
      <m.div
        className="absolute rounded-full"
        style={{
          width: size,
          height: size,
          background: `radial-gradient(circle, color-mix(in srgb, ${gradientColors.start} 13%, transparent) 0%, transparent 70%)`,
        }}
        animate={
          shouldReduceMotion
            ? { scale: 1, opacity: 0.5 }
            : {
                scale: percentage >= 100 ? [1, 1.1, 1] : 1,
                opacity: percentage >= 100 ? [0.5, 1, 0.5] : 0.5,
              }
        }
        transition={{
          duration: 2,
          repeat: !shouldReduceMotion && percentage >= 100 ? Number.POSITIVE_INFINITY : 0,
          ease: 'easeInOut',
        }}
      />

      {/* SVG Ring */}
      <svg
        className="progress-ring-container -rotate-90"
        width={size}
        height={size}
        aria-hidden="true"
      >
        <defs>
          <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={gradientColors.start} />
            <stop offset="100%" stopColor={gradientColors.end} />
          </linearGradient>

          {/* Glow filter */}
          <filter id={glowFilterId} x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="3" result="coloredBlur" />
            <feMerge>
              <feMergeNode in="coloredBlur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Background track */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--color-border)"
          strokeWidth={strokeWidth}
        />

        {/* Progress arc */}
        <m.circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={`url(#${gradientId})`}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset }}
          transition={{
            duration: shouldReduceMotion ? 0 : 1,
            ease: [0.22, 1, 0.36, 1],
          }}
          filter={`url(#${glowFilterId})`}
        />
      </svg>

      {/* Center content */}
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <m.span
          key={Math.round(percentage)}
          initial={shouldReduceMotion ? false : { scale: 1.2, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className={`font-bold text-[var(--fs-ink)] font-heading tabular-nums ${size < 50 ? 'text-[10px]' : size < 100 ? 'text-xl' : 'text-3xl'}`}
        >
          {Math.round(percentage)}%
        </m.span>

        {label && <span className="text-xs text-theme-secondary mt-0.5">{label}</span>}

        {subLabel && <span className="text-[10px] text-theme-muted">{subLabel}</span>}

        {/* Completion badge */}
        <AnimatePresence>
          {percentage >= 100 && (
            <m.div
              initial={{ scale: 0, y: 10 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0, y: 10 }}
              className="absolute -bottom-2"
            >
              <svg viewBox="0 0 24 24" width="24" height="24" aria-label="הושלם" role="img">
                <path
                  d="M5 13l4 4L19 7"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </m.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default AnimatedProgressRing;

import { m, useReducedMotion } from 'framer-motion';
import React, { useId } from 'react';

type SpinnerVariant = 'default' | 'dots' | 'pulse' | 'orbit' | 'gradient' | 'wave';
type SpinnerSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

interface LoadingSpinnerProps {
  /** Size of the spinner */
  size?: SpinnerSize;
  /** Visual variant - if not provided, reads from settings */
  variant?: SpinnerVariant;
  /** Custom class name */
  className?: string;
  /** Optional loading text */
  text?: string;
  /** Whether to show the text */
  showText?: boolean;
  /** Ignore settings and use prop directly */
  ignoreSettings?: boolean;
}

const sizeMap: Record<SpinnerSize, { container: string; text: string }> = {
  xs: { container: 'w-4 h-4', text: 'text-xs' },
  sm: { container: 'w-5 h-5', text: 'text-xs' },
  md: { container: 'w-8 h-8', text: 'text-sm' },
  lg: { container: 'w-12 h-12', text: 'text-base' },
  xl: { container: 'w-16 h-16', text: 'text-lg' },
};

// Default circular spinner — navy ring on bone-deep track
const DefaultSpinner: React.FC<{ size: SpinnerSize }> = ({ size }) => (
  <m.div
    className={`${sizeMap[size].container} rounded-full border-2`}
    style={{
      borderColor: 'var(--fs-surface-2)',
      borderTopColor: 'var(--fs-primary)',
      borderRightColor: 'var(--fs-primary)',
    }}
    animate={{ rotate: 360 }}
    transition={{
      duration: 0.8,
      repeat: Number.POSITIVE_INFINITY,
      ease: 'linear',
    }}
  />
);

// Three bouncing dots
const DotsSpinner: React.FC<{ size: SpinnerSize }> = ({ size }) => {
  const dotSize =
    size === 'xs'
      ? 'w-1 h-1'
      : size === 'sm'
        ? 'w-1.5 h-1.5'
        : size === 'md'
          ? 'w-2 h-2'
          : size === 'lg'
            ? 'w-3 h-3'
            : 'w-4 h-4';

  return (
    <div className="flex items-center gap-1">
      {[0, 1, 2].map((i) => (
        <m.div
          key={i}
          className={`${dotSize} rounded-full`}
          style={{ backgroundColor: 'var(--fs-primary)' }}
          animate={{
            y: [-2, 2, -2],
            opacity: [0.5, 1, 0.5],
          }}
          transition={{
            duration: 0.6,
            repeat: Number.POSITIVE_INFINITY,
            delay: i * 0.15,
            ease: 'easeInOut',
          }}
        />
      ))}
    </div>
  );
};

// Pulsing circle — primary inner + accent outer
const PulseSpinner: React.FC<{ size: SpinnerSize }> = ({ size }) => (
  <div className="relative">
    <m.div
      className={`${sizeMap[size].container} rounded-full`}
      style={{ backgroundColor: 'var(--fs-primary)' }}
      animate={{
        scale: [1, 1.2, 1],
        opacity: [0.7, 0.3, 0.7],
      }}
      transition={{
        duration: 1.2,
        repeat: Number.POSITIVE_INFINITY,
        ease: 'easeInOut',
      }}
    />
    <m.div
      className={`absolute inset-0 ${sizeMap[size].container} rounded-full`}
      style={{ backgroundColor: 'var(--fs-accent)' }}
      animate={{
        scale: [1.2, 1, 1.2],
        opacity: [0.3, 0.7, 0.3],
      }}
      transition={{
        duration: 1.2,
        repeat: Number.POSITIVE_INFINITY,
        ease: 'easeInOut',
      }}
    />
  </div>
);

// Orbiting dots
const OrbitSpinner: React.FC<{ size: SpinnerSize }> = ({ size }) => {
  const containerSize = sizeMap[size].container;
  const dotSize = size === 'xs' || size === 'sm' ? 'w-1 h-1' : 'w-1.5 h-1.5';

  return (
    <m.div
      className={`${containerSize} relative`}
      animate={{ rotate: 360 }}
      transition={{
        duration: 1.5,
        repeat: Number.POSITIVE_INFINITY,
        ease: 'linear',
      }}
    >
      {[0, 1, 2, 3].map((i) => (
        <m.div
          key={i}
          className={`absolute ${dotSize} rounded-full`}
          style={{
            backgroundColor: 'var(--fs-primary)',
            top: '50%',
            left: '50%',
            transform: `rotate(${i * 90}deg) translateY(-150%)`,
            transformOrigin: 'center center',
          }}
          animate={{
            opacity: [0.3, 1, 0.3],
            scale: [0.8, 1.2, 0.8],
          }}
          transition={{
            duration: 1,
            repeat: Number.POSITIVE_INFINITY,
            delay: i * 0.2,
          }}
        />
      ))}
    </m.div>
  );
};

// Premium gradient rotating ring with glow
const GradientSpinner: React.FC<{ size: SpinnerSize; instanceId?: string }> = ({
  size,
  instanceId,
}) => {
  const fallbackId = useId();
  const gradientId = `gradient-spinner-${instanceId || fallbackId}`;
  const sizeValue =
    size === 'xs' ? 16 : size === 'sm' ? 20 : size === 'md' ? 32 : size === 'lg' ? 48 : 64;
  const strokeWidth = size === 'xs' || size === 'sm' ? 2 : 3;
  const radius = (sizeValue - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;

  return (
    <div className="relative" style={{ width: sizeValue, height: sizeValue }}>
      {/* Glow effect — primary to accent */}
      <m.div
        className="absolute inset-0 rounded-full blur-md"
        style={{
          background: 'linear-gradient(135deg, var(--fs-primary), var(--fs-accent))',
          opacity: 0.3,
        }}
        animate={{
          opacity: [0.3, 0.6, 0.3],
          scale: [0.9, 1.1, 0.9],
        }}
        transition={{
          duration: 1.5,
          repeat: Number.POSITIVE_INFINITY,
          ease: 'easeInOut',
        }}
      />
      {/* Spinning gradient arc */}
      <m.svg
        className="relative z-10"
        width={sizeValue}
        height={sizeValue}
        viewBox={`0 0 ${sizeValue} ${sizeValue}`}
        role="img"
        aria-label="טוען"
        animate={{ rotate: 360 }}
        transition={{
          duration: 1,
          repeat: Number.POSITIVE_INFINITY,
          ease: 'linear',
        }}
      >
        <defs>
          <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="var(--fs-primary)" />
            <stop offset="100%" stopColor="var(--fs-accent)" />
          </linearGradient>
        </defs>
        <circle
          cx={sizeValue / 2}
          cy={sizeValue / 2}
          r={radius}
          stroke={`url(#${gradientId})`}
          strokeWidth={strokeWidth}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * 0.7}
        />
      </m.svg>
    </div>
  );
};

// Wave/ripple effect spinner
const WaveSpinner: React.FC<{ size: SpinnerSize }> = ({ size }) => {
  const sizeValue =
    size === 'xs' ? 16 : size === 'sm' ? 20 : size === 'md' ? 32 : size === 'lg' ? 48 : 64;

  return (
    <div
      className="relative flex items-center justify-center"
      style={{ width: sizeValue, height: sizeValue }}
    >
      {[0, 1, 2].map((i) => (
        <m.div
          key={i}
          className="absolute rounded-full"
          style={{
            border: '2px solid var(--fs-primary)',
            width: '100%',
            height: '100%',
          }}
          animate={{
            scale: [0.3, 1.2],
            opacity: [0.8, 0],
          }}
          transition={{
            duration: 1.5,
            repeat: Number.POSITIVE_INFINITY,
            delay: i * 0.4,
            ease: 'easeOut',
          }}
        />
      ))}
      {/* Center dot */}
      <m.div
        className="absolute rounded-full"
        style={{
          width: sizeValue * 0.25,
          height: sizeValue * 0.25,
          backgroundColor: 'var(--fs-accent)',
        }}
        animate={{
          scale: [0.8, 1.1, 0.8],
        }}
        transition={{
          duration: 0.8,
          repeat: Number.POSITIVE_INFINITY,
          ease: 'easeInOut',
        }}
      />
    </div>
  );
};

const variantMap: Record<SpinnerVariant, React.FC<{ size: SpinnerSize }>> = {
  default: DefaultSpinner,
  dots: DotsSpinner,
  pulse: PulseSpinner,
  orbit: OrbitSpinner,
  gradient: GradientSpinner,
  wave: WaveSpinner,
};

const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({
  size = 'md',
  variant = 'default',
  className = '',
  text = 'טוען...',
  showText = false,
  ignoreSettings = false,
}) => {
  const prefersReducedMotion = useReducedMotion();
  // Determine effective variant:
  // 1. If ignoreSettings is true, use the prop (or default)
  // 2. Otherwise, use the prop directly
  const effectiveVariant = ignoreSettings || variant !== 'default' ? variant : 'default';

  const SpinnerComponent = variantMap[effectiveVariant];

  return (
    <div
      role="status"
      aria-live="polite"
      aria-busy="true"
      className={`flex flex-col items-center justify-center gap-3 ${className}`}
    >
      {prefersReducedMotion ? (
        <div
          className={`${sizeMap[size].container} rounded-full border-2`}
          style={{
            borderColor: 'var(--fs-surface-2)',
            borderTopColor: 'var(--fs-primary)',
            borderRightColor: 'var(--fs-primary)',
            opacity: 0.6,
          }}
        />
      ) : (
        <SpinnerComponent size={size} />
      )}

      {showText && (
        <m.span
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className={`${sizeMap[size].text} font-medium uppercase`}
          style={{
            fontFamily: 'var(--font-mono)',
            letterSpacing: '0.18em',
            color: 'var(--fs-muted)',
          }}
        >
          {text}
        </m.span>
      )}

      <span className="sr-only">{text}</span>
    </div>
  );
};

export default React.memo(LoadingSpinner);

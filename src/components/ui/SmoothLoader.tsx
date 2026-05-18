import { AnimatePresence, motion } from 'framer-motion';
import type React from 'react';
import { useEffect, useRef, useState } from 'react';

interface SmoothLoaderProps {
  /** Whether content is still loading */
  isLoading: boolean;
  /** Skeleton/placeholder to show while loading */
  skeleton: React.ReactNode;
  /** The actual content to show once loaded */
  children: React.ReactNode;
  /** Minimum display time for skeleton (prevents flash) in ms */
  minSkeletonTime?: number;
  /** Transition duration in seconds */
  duration?: number;
  /** Optional className for the wrapper */
  className?: string;
}

/**
 * SmoothLoader - Crossfade from skeleton to content
 *
 * Prevents layout shifts by ensuring:
 * 1. Skeleton shows for at least `minSkeletonTime` ms (prevents flash)
 * 2. Smooth crossfade transition from skeleton to content
 * 3. No jarring pop-in when content arrives
 *
 * Usage:
 *   <SmoothLoader isLoading={isLoading} skeleton={<MyScreenSkeleton />}>
 *     <MyScreenContent />
 *   </SmoothLoader>
 */
// Premium ease (CSS var(--ease-premium) equivalent) for framer transitions
const PREMIUM_EASE: [number, number, number, number] = [0.16, 1, 0.3, 1];
// Premium duration in seconds (mirrors CSS var(--duration-premium) = 480ms)
const PREMIUM_DURATION_S = 0.48;

export const SmoothLoader: React.FC<SmoothLoaderProps> = ({
  isLoading,
  skeleton,
  children,
  minSkeletonTime = 400,
  duration = PREMIUM_DURATION_S,
  className = '',
}) => {
  const [showContent, setShowContent] = useState(!isLoading);
  const mountTimeRef = useRef(Date.now());

  useEffect(() => {
    if (!isLoading) {
      const elapsed = Date.now() - mountTimeRef.current;
      const remaining = Math.max(0, minSkeletonTime - elapsed);

      if (remaining > 0) {
        const timer = setTimeout(() => setShowContent(true), remaining);
        return () => clearTimeout(timer);
      } else {
        setShowContent(true);
      }
    } else {
      setShowContent(false);
      mountTimeRef.current = Date.now();
    }
    return undefined;
  }, [isLoading, minSkeletonTime]);

  return (
    <div className={`relative ${className}`}>
      <AnimatePresence mode="sync">
        {!showContent ? (
          <motion.div
            key="skeleton"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: duration * 0.5 }}
          >
            {skeleton}
          </motion.div>
        ) : (
          <motion.div
            key="content"
            className="fade-rise-in"
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{
              duration,
              ease: PREMIUM_EASE,
            }}
          >
            {children}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

/**
 * InlineLoader - For inline async operations (buttons, form submissions)
 *
 * Shows a spinner overlay on the element during async operations,
 * with smooth enter/exit animations.
 */
export const InlineLoader: React.FC<{
  isLoading: boolean;
  children: React.ReactNode;
  className?: string;
  spinnerSize?: number;
}> = ({ isLoading, children, className = '', spinnerSize = 20 }) => {
  return (
    <div className={`relative ${className}`}>
      <div className="transition-opacity duration-200" style={{ opacity: isLoading ? 0.4 : 1 }}>
        {children}
      </div>

      <AnimatePresence>
        {isLoading && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 flex items-center justify-center"
          >
            <motion.div
              className="border-2"
              style={{
                width: spinnerSize,
                height: spinnerSize,
                borderColor: 'var(--fs-surface-2)',
                borderTopColor: 'var(--fs-accent)',
              }}
              animate={{ rotate: 360 }}
              transition={{
                duration: 0.8,
                repeat: Number.POSITIVE_INFINITY,
                ease: 'linear',
              }}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

/**
 * ErrorWithRetry - Inline error state with retry action
 *
 * Replaces blank error states with a clear message and retry button.
 * Can be used inline within any component.
 */
export const ErrorWithRetry: React.FC<{
  message?: string;
  onRetry: () => void;
  className?: string;
  compact?: boolean;
}> = ({
  message = '\u05DE\u05E9\u05D4\u05D5 \u05D4\u05E9\u05EA\u05D1\u05E9',
  onRetry,
  className = '',
  compact = false,
}) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={`flex ${compact ? 'flex-row items-center gap-3' : 'flex-col items-center gap-4'} ${className}`}
      dir="rtl"
    >
      {!compact && (
        <div
          className="w-12 h-12 flex items-center justify-center"
          style={{ backgroundColor: 'color-mix(in srgb, var(--fs-warn) 10%, transparent)' }}
        >
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            style={{ color: 'var(--fs-warn)' }}
          >
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
        </div>
      )}

      <p
        className="text-center"
        style={{ color: 'var(--fs-muted)', fontSize: compact ? '0.875rem' : undefined }}
      >
        {message}
      </p>

      <button
        onClick={onRetry}
        className={`
          ${compact ? 'px-3 py-1.5 text-xs' : 'px-5 py-2.5 text-sm'}
          transition-all duration-200
          active:scale-[0.97]
          flex items-center gap-2
        `}
        style={{
          background: 'var(--fs-primary)',
          color: 'var(--fs-accent)',
          fontFamily: 'var(--font-display)',
          fontWeight: 800,
          textTransform: 'uppercase',
          borderRadius: 0,
          border: 'none',
          cursor: 'pointer',
        }}
      >
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          style={{ color: 'var(--fs-accent)' }}
        >
          <polyline points="23 4 23 10 17 10" />
          <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
        </svg>
        {'\u05E0\u05E1\u05D4 \u05E9\u05D5\u05D1'}
      </button>
    </motion.div>
  );
};

export default SmoothLoader;

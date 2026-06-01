import { m } from 'framer-motion';
import type React from 'react';
import { usePullToRefresh } from '../../hooks/usePullToRefresh';

interface PullToRefreshProps {
  onRefresh: () => Promise<void>;
  children?: React.ReactNode;
}

// Ring geometry — radius 18, circumference = 2π * 18 ≈ 113.097
const RING_RADIUS = 18;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

export const PullToRefresh: React.FC<PullToRefreshProps> = ({ onRefresh, children }) => {
  const { pullDistance, isRefreshing, threshold } = usePullToRefresh({
    onRefresh,
  });

  // Pull progress 0..1 — clamped
  const pullProgress = Math.min(pullDistance / threshold, 1);
  const opacity = Math.min(pullDistance / (threshold * 0.5), 1);
  const scale = Math.min(pullDistance / (threshold * 0.8), 1);

  // Derive state for visual cues
  const state: 'idle' | 'pulling' | 'releasing' | 'refreshing' = isRefreshing
    ? 'refreshing'
    : pullDistance >= threshold
      ? 'releasing'
      : pullDistance > 0
        ? 'pulling'
        : 'idle';

  const isReleasing = state === 'releasing';
  const dashOffset = RING_CIRCUMFERENCE * (1 - (isRefreshing ? 1 : pullProgress));

  if (pullDistance <= 0 && !isRefreshing) {
    return <>{children}</>;
  }

  return (
    <>
      <div
        className="fixed top-0 left-0 right-0 z-50 flex justify-center pointer-events-none"
        style={{ top: 'calc(env(safe-area-inset-top) + 10px)' }}
      >
        <div
          className={`glass-surface relative flex items-center justify-center ${
            isReleasing ? 'accent-glow' : ''
          }`}
          style={{
            width: 44,
            height: 44,
            borderRadius: 999,
            transform: `translateY(${pullDistance * 0.5}px) scale(${isRefreshing ? 1 : scale})`,
            opacity: isRefreshing ? 1 : opacity,
            transition: isRefreshing ? 'transform 0.2s cubic-bezier(0.2, 0.8, 0.2, 1)' : 'none',
          }}
        >
          <m.svg
            width={44}
            height={44}
            viewBox="0 0 44 44"
            aria-hidden="true"
            animate={isRefreshing ? { rotate: 360 } : { rotate: 0 }}
            transition={
              isRefreshing
                ? { duration: 1.2, repeat: Number.POSITIVE_INFINITY, ease: 'linear' }
                : { duration: 0 }
            }
          >
            <circle
              className="ring-track"
              cx={22}
              cy={22}
              r={RING_RADIUS}
              fill="none"
              strokeWidth={4}
            />
            <circle
              className="ring-progress"
              cx={22}
              cy={22}
              r={RING_RADIUS}
              fill="none"
              strokeWidth={4}
              strokeDasharray={RING_CIRCUMFERENCE}
              strokeDashoffset={dashOffset}
              transform="rotate(-90 22 22)"
              style={{ transition: isRefreshing ? 'none' : 'stroke-dashoffset 0.1s linear' }}
            />
          </m.svg>
          {isReleasing && (
            <span
              className="breathing-dot absolute"
              style={{ top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }}
              aria-hidden="true"
            />
          )}
        </div>
      </div>
      {children}
    </>
  );
};

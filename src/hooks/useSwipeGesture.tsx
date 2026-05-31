// ============================================================================
// SPARKOS FITNESS - Swipe Gesture Hook
// Touch gesture handling for mobile interactions
// ============================================================================

import { useCallback, useRef, useState } from 'react';

export type SwipeDirection = 'left' | 'right' | 'up' | 'down' | null;

export interface SwipeState {
  direction: SwipeDirection;
  distance: number;
  progress: number;
  isSwiping: boolean;
  startX: number;
  startY: number;
}

export interface UseSwipeGestureOptions {
  threshold?: number;
  maxDistance?: number;
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
  onSwipeUp?: () => void;
  onSwipeDown?: () => void;
  onSwipeStart?: () => void;
  onSwipeEnd?: () => void;
  enabled?: boolean;
  direction?: 'horizontal' | 'vertical' | 'both';
  /** Flip left/right semantics in RTL layouts (default: true) */
  rtlAware?: boolean;
}

const DEFAULT_THRESHOLD = 60;
const DEFAULT_MAX_DISTANCE = 150;

export function useSwipeGesture(options: UseSwipeGestureOptions = {}) {
  const {
    threshold = DEFAULT_THRESHOLD,
    maxDistance = DEFAULT_MAX_DISTANCE,
    onSwipeLeft,
    onSwipeRight,
    onSwipeUp,
    onSwipeDown,
    onSwipeStart,
    onSwipeEnd,
    enabled = true,
    direction = 'horizontal',
    rtlAware = true,
  } = options;

  const isRTL = rtlAware && typeof document !== 'undefined' && document.dir === 'rtl';

  const [state, setState] = useState<SwipeState>({
    direction: null,
    distance: 0,
    progress: 0,
    isSwiping: false,
    startX: 0,
    startY: 0,
  });

  const startXRef = useRef(0);
  const startYRef = useRef(0);
  const isSwipingRef = useRef(false);

  const handleTouchStart = useCallback(
    (e: TouchEvent | React.TouchEvent) => {
      if (!enabled) return;

      const touch = e.touches?.[0] || e.changedTouches?.[0];
      if (!touch) return;

      startXRef.current = touch.clientX;
      startYRef.current = touch.clientY;
      isSwipingRef.current = true;

      setState((prev) => ({
        ...prev,
        isSwiping: true,
        startX: touch.clientX,
        startY: touch.clientY,
        direction: null,
        distance: 0,
        progress: 0,
      }));

      onSwipeStart?.();
    },
    [enabled, onSwipeStart]
  );

  const handleTouchMove = useCallback(
    (e: TouchEvent | React.TouchEvent) => {
      if (!enabled || !isSwipingRef.current) return;

      const touch = e.touches?.[0] || e.changedTouches?.[0];
      if (!touch) return;

      const deltaX = touch.clientX - startXRef.current;
      const deltaY = touch.clientY - startYRef.current;
      const absX = Math.abs(deltaX);
      const absY = Math.abs(deltaY);

      // Determine primary direction
      let dir: SwipeDirection = null;
      let dist = 0;

      if (direction === 'horizontal' || direction === 'both') {
        if (absX > absY) {
          dir = deltaX > 0 ? 'right' : 'left';
          dist = absX;
        }
      }

      if (direction === 'vertical' || direction === 'both') {
        if (absY > absX) {
          dir = deltaY > 0 ? 'down' : 'up';
          dist = absY;
        }
      }

      // Cap distance
      const cappedDist = Math.min(dist, maxDistance);
      const cappedProgress = Math.min(dist / threshold, 1);

      setState((prev) => ({
        ...prev,
        direction: dir,
        distance: cappedDist,
        progress: cappedProgress,
      }));
    },
    [enabled, direction, threshold, maxDistance]
  );

  const handleTouchEnd = useCallback(
    (e: TouchEvent | React.TouchEvent) => {
      if (!enabled || !isSwipingRef.current) return;

      const touch = e.touches?.[0] || e.changedTouches?.[0];
      if (!touch) return;

      const deltaX = touch.clientX - startXRef.current;
      const deltaY = touch.clientY - startYRef.current;
      const absX = Math.abs(deltaX);
      const absY = Math.abs(deltaY);

      // Check if threshold was met
      const horizontalSwipe = absX > absY && absX >= threshold;
      const verticalSwipe = absY > absX && absY >= threshold;

      if (horizontalSwipe || verticalSwipe) {
        if (absX > absY) {
          // Horizontal swipe — flip meaning in RTL
          if (deltaX > 0) {
            (isRTL ? onSwipeLeft : onSwipeRight)?.();
          } else {
            (isRTL ? onSwipeRight : onSwipeLeft)?.();
          }
        } else {
          // Vertical swipe
          if (deltaY > 0) {
            onSwipeDown?.();
          } else {
            onSwipeUp?.();
          }
        }
      }

      isSwipingRef.current = false;
      setState((prev) => ({
        ...prev,
        isSwiping: false,
        direction: null,
        distance: 0,
        progress: 0,
      }));

      onSwipeEnd?.();
    },
    [enabled, threshold, onSwipeLeft, onSwipeRight, onSwipeUp, onSwipeDown, onSwipeEnd, isRTL]
  );

  const handlers = {
    onTouchStart: handleTouchStart,
    onTouchMove: handleTouchMove,
    onTouchEnd: handleTouchEnd,
    onTouchCancel: handleTouchEnd,
  };

  return {
    ...state,
    handlers,
  };
}

// ============================================================================
// Swipeable Component - Wrapper for swipeable items
// ============================================================================

import type { CSSProperties, ReactNode } from 'react';

export interface SwipeableItemProps {
  children: ReactNode;
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
  leftAction?: ReactNode;
  rightAction?: ReactNode;
  actionWidth?: number;
  threshold?: number;
  enabled?: boolean;
  className?: string;
  style?: CSSProperties;
}

export function SwipeableItem({
  children,
  onSwipeLeft,
  onSwipeRight,
  leftAction,
  rightAction,
  actionWidth = 80,
  threshold = DEFAULT_THRESHOLD,
  enabled = true,
  className = '',
  style,
}: SwipeableItemProps) {
  const isRTL = typeof document !== 'undefined' && document.dir === 'rtl';
  // In RTL, swap the action sides visually
  const startAction = isRTL ? rightAction : leftAction;
  const endAction = isRTL ? leftAction : rightAction;

  const { direction, distance, progress, handlers } = useSwipeGesture({
    threshold,
    onSwipeLeft,
    onSwipeRight,
    enabled,
  });

  const getTranslateX = () => {
    if (direction === 'left' && onSwipeLeft) {
      return Math.min(distance, actionWidth);
    }
    if (direction === 'right' && onSwipeRight) {
      return -Math.min(distance, actionWidth);
    }
    return 0;
  };

  return (
    <div
      className={`swipeable-item ${className}`}
      style={{
        position: 'relative',
        overflow: 'hidden',
        ...style,
      }}
      data-swipe={direction}
      {...handlers}
    >
      {/* Start action (revealed on swipe toward start) */}
      {startAction && (
        <div
          className="swipeable-actions swipeable-actions-left"
          style={{
            position: 'absolute',
            left: isRTL ? undefined : 0,
            right: isRTL ? 0 : undefined,
            top: 0,
            bottom: 0,
            width: actionWidth,
            display: 'flex',
            alignItems: 'center',
            justifyContent: isRTL ? 'flex-end' : 'flex-start',
            paddingLeft: isRTL ? undefined : 12,
            paddingRight: isRTL ? 12 : undefined,
            opacity: direction === 'left' ? Math.min(progress * 2, 1) : 0,
            transform: `translateX(${-actionWidth + (direction === 'left' ? distance : 0)}px)`,
            transition: direction === null ? 'opacity 200ms ease' : 'none',
          }}
        >
          {startAction}
        </div>
      )}

      {/* End action (revealed on swipe toward end) */}
      {endAction && (
        <div
          className="swipeable-actions swipeable-actions-right"
          style={{
            position: 'absolute',
            right: isRTL ? undefined : 0,
            left: isRTL ? 0 : undefined,
            top: 0,
            bottom: 0,
            width: actionWidth,
            display: 'flex',
            alignItems: 'center',
            justifyContent: isRTL ? 'flex-start' : 'flex-end',
            paddingRight: isRTL ? undefined : 12,
            paddingLeft: isRTL ? 12 : undefined,
            opacity: direction === 'right' ? Math.min(progress * 2, 1) : 0,
            transform: `translateX(${actionWidth - (direction === 'right' ? distance : 0)}px)`,
            transition: direction === null ? 'opacity 200ms ease' : 'none',
          }}
        >
          {endAction}
        </div>
      )}

      {/* Main content */}
      <div
        className="swipeable-content"
        style={{
          transform: `translateX(${getTranslateX()}px)`,
          transition: direction === null ? 'transform 200ms cubic-bezier(0.4, 0, 0.2, 1)' : 'none',
          willChange: 'transform',
          background: 'var(--fs-bg)',
        }}
      >
        {children}
      </div>
    </div>
  );
}

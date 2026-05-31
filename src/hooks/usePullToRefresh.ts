// ============================================================================
// SPARKOS FITNESS - usePullToRefresh Hook
// ============================================================================

import { type TouchEvent as ReactTouchEvent, useCallback, useRef, useState } from 'react';

interface UsePullToRefreshOptions {
  onRefresh: () => Promise<void>;
  threshold?: number;
}

export const usePullToRefresh = ({ onRefresh, threshold = 80 }: UsePullToRefreshOptions) => {
  const isPullingRef = useRef(false);
  const startYRef = useRef(0);
  const pullDistanceRef = useRef(0);
  const [pullDistance, setPullDistance] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleTouchStart = useCallback((e: ReactTouchEvent<HTMLElement>) => {
    if (window.scrollY === 0) {
      startYRef.current = e.touches[0]?.clientY ?? 0;
      isPullingRef.current = true;
    }
  }, []);

  const handleTouchMove = useCallback((e: ReactTouchEvent<HTMLElement>) => {
    if (!isPullingRef.current) return;
    const currentY = e.touches[0]?.clientY ?? 0;
    const distance = currentY - startYRef.current;
    const clamped = distance > 0 ? distance : 0;
    pullDistanceRef.current = clamped;
    setPullDistance(clamped);
  }, []);

  const handleTouchEnd = useCallback(async () => {
    if (!isPullingRef.current) return;
    isPullingRef.current = false;

    const distance = pullDistanceRef.current;
    pullDistanceRef.current = 0;
    setPullDistance(0);

    if (distance > threshold && !isRefreshing) {
      setIsRefreshing(true);
      try {
        await onRefresh();
      } finally {
        setIsRefreshing(false);
      }
    }
  }, [onRefresh, threshold, isRefreshing]);

  return {
    isPulling: pullDistance > 0,
    isRefreshing,
    pullDistance,
    threshold,
    handlers: {
      onTouchStart: handleTouchStart,
      onTouchMove: handleTouchMove,
      onTouchEnd: handleTouchEnd,
    },
  };
};

export default usePullToRefresh;

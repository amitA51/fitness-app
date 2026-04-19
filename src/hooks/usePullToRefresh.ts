// ============================================================================
// SPARKOS FITNESS - usePullToRefresh Hook
// ============================================================================

import { useCallback, useRef, useState } from 'react';

interface UsePullToRefreshOptions {
  onRefresh: () => Promise<void>;
  threshold?: number;
}

export const usePullToRefresh = ({ onRefresh, threshold = 80 }: UsePullToRefreshOptions) => {
  const [isPulling, setIsPulling] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const startY = useRef(0);
  const currentY = useRef(0);
  const pullDistanceRef = useRef(0);

  const handleTouchStart = useCallback((e: TouchEvent) => {
    if (window.scrollY === 0) {
      startY.current = e.touches[0]?.clientY ?? 0;
      setIsPulling(true);
    }
  }, []);

  const handleTouchMove = useCallback(
    (e: TouchEvent) => {
      if (!isPulling) return;
      currentY.current = e.touches[0]?.clientY ?? 0;
      const pullDistance = currentY.current - startY.current;
      pullDistanceRef.current = pullDistance;
      if (pullDistance > 0) {
        e.preventDefault();
      }
    },
    [isPulling]
  );

  const handleTouchEnd = useCallback(async () => {
    if (!isPulling) return;
    const pullDistance = currentY.current - startY.current;

    if (pullDistance > threshold) {
      setIsRefreshing(true);
      await onRefresh();
      setIsRefreshing(false);
    }
    setIsPulling(false);
    pullDistanceRef.current = 0;
  }, [isPulling, onRefresh, threshold]);

  return {
    isPulling,
    isRefreshing,
    pullDistance: pullDistanceRef.current,
    threshold,
    handlers: {
      onTouchStart: handleTouchStart,
      onTouchMove: handleTouchMove,
      onTouchEnd: handleTouchEnd,
    },
  };
};

export default usePullToRefresh;

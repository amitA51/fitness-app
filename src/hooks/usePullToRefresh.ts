// ============================================================================
// SPARKOS FITNESS - usePullToRefresh Hook
// ============================================================================

import { useCallback, useRef } from 'react';

interface UsePullToRefreshOptions {
  onRefresh: () => Promise<void>;
  threshold?: number;
}

export const usePullToRefresh = ({ onRefresh, threshold = 80 }: UsePullToRefreshOptions) => {
  // Use refs to avoid stale closure issues
  const isPullingRef = useRef(false);
  const isRefreshingRef = useRef(false);
  const startYRef = useRef(0);
  const currentYRef = useRef(0);

  const handleTouchStart = useCallback((e: TouchEvent) => {
    // Only start pulling if at the top of the page
    if (window.scrollY === 0) {
      startYRef.current = e.touches[0]?.clientY ?? 0;
      isPullingRef.current = true;
    }
  }, []);

  const handleTouchMove = useCallback(
    (e: TouchEvent) => {
      // Use ref to get current value (avoids stale closure)
      if (!isPullingRef.current) return;
      
      currentYRef.current = e.touches[0]?.clientY ?? 0;
      const pullDistance = currentYRef.current - startYRef.current;
      
      // Only prevent default for downward pull (positive distance)
      // This allows the browser to handle upward scrolling naturally
      if (pullDistance > 0) {
        e.preventDefault();
      }
    },
    [] // No dependencies - uses refs
  );

  const handleTouchEnd = useCallback(async () => {
    if (!isPullingRef.current) return;
    
    const pullDistance = currentYRef.current - startYRef.current;

    if (pullDistance > threshold) {
      isRefreshingRef.current = true;
      await onRefresh();
      isRefreshingRef.current = false;
    }
    
    isPullingRef.current = false;
  }, [onRefresh, threshold]);

  // Return current values for UI updates (these won't cause re-renders from touch events)
  return {
    // These are only for initial render - actual state is in refs
    isPulling: isPullingRef.current,
    isRefreshing: isRefreshingRef.current,
    pullDistance: currentYRef.current - startYRef.current,
    threshold,
    handlers: {
      onTouchStart: handleTouchStart,
      onTouchMove: handleTouchMove,
      onTouchEnd: handleTouchEnd,
    },
  };
};

export default usePullToRefresh;

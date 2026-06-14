// ============================================================================
// SPARKOS FITNESS - usePullToRefresh Hook
// ============================================================================

import { type TouchEvent as ReactTouchEvent, useCallback, useRef, useState } from 'react';
import { triggerHapticEffect } from '../utils/haptics';

interface UsePullToRefreshOptions {
  onRefresh: () => Promise<void>;
  threshold?: number;
}

export const usePullToRefresh = ({ onRefresh, threshold = 80 }: UsePullToRefreshOptions) => {
  const isPullingRef = useRef(false);
  const startYRef = useRef(0);
  const pullDistanceRef = useRef(0);
  // One-shot guard so the "armed" haptic fires only on the FIRST crossing of the
  // threshold during a given pull, not on every touchmove frame past it.
  const crossedThresholdRef = useRef(false);
  const [pullDistance, setPullDistance] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleTouchStart = useCallback((e: ReactTouchEvent<HTMLElement>) => {
    if (window.scrollY === 0) {
      startYRef.current = e.touches[0]?.clientY ?? 0;
      isPullingRef.current = true;
      crossedThresholdRef.current = false;
    }
  }, []);

  const handleTouchMove = useCallback(
    (e: ReactTouchEvent<HTMLElement>) => {
      if (!isPullingRef.current) return;
      const currentY = e.touches[0]?.clientY ?? 0;
      const distance = currentY - startYRef.current;
      const clamped = distance > 0 ? distance : 0;
      pullDistanceRef.current = clamped;
      setPullDistance(clamped);

      // Tactile "release to refresh is armed" tick — once per pull. Routed through
      // the Settings-gated haptics vocabulary; no-ops when haptics are off/iOS.
      if (clamped > threshold && !crossedThresholdRef.current) {
        crossedThresholdRef.current = true;
        triggerHapticEffect('tap');
      } else if (clamped <= threshold) {
        // Re-arm if the user eases back below the line before releasing.
        crossedThresholdRef.current = false;
      }
    },
    [threshold]
  );

  const handleTouchEnd = useCallback(async () => {
    if (!isPullingRef.current) return;
    isPullingRef.current = false;
    crossedThresholdRef.current = false;

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

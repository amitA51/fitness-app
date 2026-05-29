// ============================================================================
// SPARKOS FITNESS - Celebration Hook
// ============================================================================

import { useCallback, useEffect, useRef, useState } from 'react';
import type { PersonalRecord } from '../types';
import { vibratePattern } from '../utils/haptics';

interface CelebrationOptions {
  onCelebrate?: () => void;
}

interface CelebrationResult {
  celebrate: (type?: 'pr' | 'milestone' | 'streak') => void;
  triggerConfetti: () => void;
  currentPR: PersonalRecord | null;
  hidePRCelebration: () => void;
  showCelebration: boolean;
}

export const useCelebration = (options: CelebrationOptions = {}): CelebrationResult => {
  const { onCelebrate } = options;
  const [currentPR, setCurrentPR] = useState<PersonalRecord | null>(null);
  const [showCelebration, setShowCelebration] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const celebrate = useCallback(
    (_type: 'pr' | 'milestone' | 'streak' = 'pr') => {
      // Trigger haptic feedback through gated utility
      vibratePattern([100, 50, 100, 50, 200]);

      // Call optional callback
      onCelebrate?.();
    },
    [onCelebrate]
  );

  const triggerConfetti = useCallback(() => {
    setShowCelebration(true);
    // Clear any existing timer to prevent orphaned callbacks
    if (timerRef.current) clearTimeout(timerRef.current);
    // Auto-hide after 4 seconds
    timerRef.current = setTimeout(() => setShowCelebration(false), 4000);
  }, []);

  const hidePRCelebration = useCallback(() => {
    setShowCelebration(false);
    setCurrentPR(null);
  }, []);

  return {
    celebrate,
    triggerConfetti,
    currentPR,
    hidePRCelebration,
    showCelebration,
  };
};

export default useCelebration;

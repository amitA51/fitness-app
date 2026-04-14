// ============================================================================
// SPARKOS FITNESS - Celebration Hook
// ============================================================================

import { useState, useCallback } from 'react';
import { PersonalRecord } from '../types';

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

  const celebrate = useCallback((_type: 'pr' | 'milestone' | 'streak' = 'pr') => {
    // Trigger haptic feedback
    if ('vibrate' in navigator) {
      navigator.vibrate([100, 50, 100, 50, 200]);
    }

    // Call optional callback
    onCelebrate?.();
  }, [onCelebrate]);

  const triggerConfetti = useCallback(() => {
    setShowCelebration(true);
    // Auto-hide after 4 seconds
    setTimeout(() => setShowCelebration(false), 4000);
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

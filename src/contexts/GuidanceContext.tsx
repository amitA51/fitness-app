// GuidanceContext — owns the open/closed state of the first-use welcome sheet
// and exposes the re-launch entry. Mirrors SettingsContext's shape
// (createContext + provider + a `useGuidance` hook that throws when used outside
// the provider). Persistence lives in `guidanceService`; this context is only
// the React-facing state on top of it.

import type React from 'react';
import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { hasSeenWelcome, markWelcomeSeen, resetGuidance } from '../services/guidanceService';

interface GuidanceContextValue {
  /** Whether the welcome sheet is currently open. */
  isWelcomeOpen: boolean;
  /** Open the welcome sheet (without touching the "seen" flag). */
  openWelcome: () => void;
  /** Close the welcome sheet and persist that it has been seen. */
  closeWelcomeAndMark: () => void;
  /** Settings entry: clear all guidance flags and re-open the welcome sheet. */
  relaunchGuidance: () => void;
}

const GuidanceContext = createContext<GuidanceContextValue | null>(null);

export const GuidanceProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Auto-open once for users who have not seen the welcome sheet yet. Lazy
  // initializer so the localStorage read runs a single time on mount.
  const [isWelcomeOpen, setIsWelcomeOpen] = useState<boolean>(() => !hasSeenWelcome());

  const openWelcome = useCallback(() => {
    setIsWelcomeOpen(true);
  }, []);

  const closeWelcomeAndMark = useCallback(() => {
    markWelcomeSeen();
    setIsWelcomeOpen(false);
  }, []);

  const relaunchGuidance = useCallback(() => {
    resetGuidance();
    setIsWelcomeOpen(true);
  }, []);

  const value = useMemo(
    () => ({ isWelcomeOpen, openWelcome, closeWelcomeAndMark, relaunchGuidance }),
    [isWelcomeOpen, openWelcome, closeWelcomeAndMark, relaunchGuidance]
  );

  return <GuidanceContext.Provider value={value}>{children}</GuidanceContext.Provider>;
};

export const useGuidance = (): GuidanceContextValue => {
  const context = useContext(GuidanceContext);
  if (!context) {
    throw new Error('useGuidance must be used within a GuidanceProvider');
  }
  return context;
};

export default GuidanceContext;

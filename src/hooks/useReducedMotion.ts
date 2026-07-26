// ============================================================================
// useReducedMotion — the single motion-suppression signal for the whole app
// ============================================================================
// There are TWO independent sources of "please calm down":
//   1. the OS/browser preference (prefers-reduced-motion), read by Framer Motion
//   2. the in-app Settings toggle "הפחתת אנימציות", which SettingsContext
//      reflects onto <html class="reduce-motion">
//
// This hook used to return only (1). The in-app toggle therefore stopped CSS
// animations (motion.css keys off the class) while every Framer `m.*` component,
// route transition and toggle kept animating — the setting looked broken.
//
// We deliberately read source (2) from the DOM class rather than from
// SettingsContext: components such as the login screen, AgeGate and error
// boundaries render OUTSIDE SettingsProvider, and a context read there would
// throw. The class is already the app-wide source of truth.
// ============================================================================

import { useReducedMotion as useFramerReducedMotion } from 'framer-motion';
import { useEffect, useState } from 'react';

const REDUCE_MOTION_CLASS = 'reduce-motion';

const readAppPreference = (): boolean => {
  if (typeof document === 'undefined') return false;
  return document.documentElement.classList.contains(REDUCE_MOTION_CLASS);
};

/**
 * True when motion should be suppressed, honouring the OS preference OR the
 * in-app Settings toggle. Prefer this over Framer's `useReducedMotion`.
 */
export const useReducedMotion = (): boolean => {
  const osPreference = useFramerReducedMotion() ?? false;
  const [appPreference, setAppPreference] = useState<boolean>(readAppPreference);

  useEffect(() => {
    if (typeof document === 'undefined' || typeof MutationObserver === 'undefined') return;

    // Re-read on every class mutation. SettingsContext toggles the class after
    // hydration and on every change, so polling or a one-shot read would miss it.
    const target = document.documentElement;
    const sync = () => {
      setAppPreference(target.classList.contains(REDUCE_MOTION_CLASS));
    };
    sync();

    const observer = new MutationObserver(sync);
    observer.observe(target, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);

  return osPreference || appPreference;
};

/** Framer's `reducedMotion` prop value derived from the same combined signal. */
export const useMotionConfigMode = (): 'always' | 'user' =>
  useReducedMotion() ? 'always' : 'user';

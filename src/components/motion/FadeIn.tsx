// ============================================================================
// FadeIn — single-element fade + rise entrance (C7).
// ============================================================================
// For one-off entrances (a hero card, a section). Relies on the existing
// LazyMotion ancestor in main.tsx (`m` namespace). prefers-reduced-motion
// renders instantly with no transform.

import { m } from 'framer-motion';
import type { CSSProperties, ReactNode } from 'react';
import { useReducedMotion } from '../../hooks/useReducedMotion';
import { EASE_OUT } from './easings';

interface FadeInProps {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
  /** Seconds before the entrance starts. */
  delay?: number;
  /** Entrance duration in seconds. */
  duration?: number;
}

export function FadeIn({ children, className, style, delay = 0, duration = 0.4 }: FadeInProps) {
  const reduced = useReducedMotion();

  if (reduced) {
    return (
      <div className={className} style={style}>
        {children}
      </div>
    );
  }

  return (
    <m.div
      className={className}
      style={style}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration, delay, ease: EASE_OUT }}
    >
      {children}
    </m.div>
  );
}

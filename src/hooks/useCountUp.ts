// ============================================================================
// useCountUp - animated number count-up driven by GSAP.
// ----------------------------------------------------------------------------
// Writes the rolling value straight to the node's textContent via onUpdate, so
// React never re-renders during the count (buttery 60fps, frame-accurate).
// Respects prefers-reduced-motion: when reduced, snaps to the final value.
//
// Usage:
//   const ref = useRef<HTMLSpanElement>(null);
//   useCountUp(ref, calories, { format: formatThousands });
//   return <span ref={ref}>{calories}</span>; // JSX shows final value (SSR/SR)
// ============================================================================

import type { RefObject } from 'react';
import { DUR, EASE, formatInt, gsap, useGSAP } from '../lib/gsap';
import { useReducedMotion } from './useReducedMotion';

interface CountUpOptions {
  /** Tween duration in seconds. Default DUR.count (0.9s). */
  duration?: number;
  /** Per-frame formatter (e.g. thousands separator). Default String(round). */
  format?: (value: number) => string;
  /** GSAP ease. Default EASE.out. */
  ease?: string;
  /** Value to count FROM. Default 0. Pass the previous value to re-tween. */
  from?: number;
  /** Start delay in seconds. */
  delay?: number;
  /** Set false to skip animating (snaps to final value). Default true. */
  enabled?: boolean;
  /** Add a small back.out scale pop on settle. Default false. */
  pop?: boolean;
}

/**
 * Animate a numeric value into `ref`'s textContent. Guards reduced motion.
 * Re-runs whenever `value` changes.
 */
export function useCountUp(
  ref: RefObject<HTMLElement>,
  value: number,
  options: CountUpOptions = {}
): void {
  const reduced = useReducedMotion();
  const {
    duration = DUR.count,
    format = formatInt,
    ease = EASE.out,
    from = 0,
    delay = 0,
    enabled = true,
    pop = false,
  } = options;

  useGSAP(
    () => {
      const el = ref.current;
      if (!el) return;

      if (reduced || !enabled) {
        el.textContent = format(value);
        return;
      }

      const proxy = { v: from };
      el.textContent = format(from);
      gsap.to(proxy, {
        v: value,
        duration,
        delay,
        ease,
        snap: { v: 1 },
        onUpdate: () => {
          el.textContent = format(proxy.v);
        },
      });

      if (pop) {
        gsap.fromTo(
          el,
          { scale: 1 },
          {
            scale: 1.18,
            duration: DUR.micro,
            delay: delay + duration,
            ease: EASE.popHard,
            yoyo: true,
            repeat: 1,
            transformOrigin: 'center',
          }
        );
      }
    },
    { dependencies: [value, reduced, enabled], scope: ref }
  );
}

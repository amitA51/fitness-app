// useNumberSnap — reusable "snap" micro-interaction for committed numbers.
// ----------------------------------------------------------------------------
// When a number changes (an increment/commit moment — set count, weight, reps),
// the element holding it gives a quick tactile pop: scale 1 → 1.08 → 1 on a
// back.out curve over ~DUR.micro. This reads as "the value just locked in"
// without being noisy.
//
// Usage (ergonomic ref-returning form):
//   const ref = useNumberSnap(reps);
//   return <span ref={ref} className="kinetic-number">{reps}</span>;
//
// Behavior:
//   - Fires ONLY on change, never on initial mount.
//   - Guards prefers-reduced-motion via useReducedMotion(): when reduced, the
//     hook is a no-op (no scale, no transform written).
//   - Scoped + auto-cleaned via useGSAP (React 19 safe).

import { useRef } from 'react';
import type { RefObject } from 'react';
import { DUR, EASE, gsap, useGSAP } from '../lib/gsap';
import { useReducedMotion } from './useReducedMotion';

/**
 * Returns a ref to attach to the element wrapping the number. Plays a brief
 * scale pop whenever `value` changes (not on mount). Respects reduced motion.
 *
 * @param value The number to watch. A pop fires each time it changes.
 * @returns A ref to spread onto the target element (`<span ref={ref}>…</span>`).
 */
export function useNumberSnap(value: number): RefObject<HTMLElement | null> {
  const ref = useRef<HTMLElement>(null);
  const prefersReducedMotion = useReducedMotion();
  // Tracks whether we've seen the first render, so mount doesn't trigger a pop.
  const hasMountedRef = useRef(false);

  useGSAP(
    () => {
      if (!hasMountedRef.current) {
        hasMountedRef.current = true;
        return;
      }
      if (prefersReducedMotion) return;
      const el = ref.current;
      if (!el) return;

      gsap
        .timeline()
        .fromTo(
          el,
          { scale: 1 },
          { scale: 1.08, duration: DUR.micro / 2, ease: EASE.out }
        )
        .to(el, { scale: 1, duration: DUR.micro, ease: EASE.pop });
    },
    { dependencies: [value], scope: ref }
  );

  return ref;
}

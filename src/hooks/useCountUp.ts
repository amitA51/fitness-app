// ============================================================================
// useCountUp - animated number count-up driven by requestAnimationFrame.
// ----------------------------------------------------------------------------
// Writes the rolling value straight to the node's textContent, so React never
// re-renders during the count. This intentionally avoids lib/gsap: Dashboard
// has several count-up call sites, and that static edge was pulling ~72 kB GSAP
// into its cold route even though Framer Motion is already available there.
// Respects prefers-reduced-motion by snapping to the final value.
// ============================================================================

import { useEffect } from 'react';
import type { RefObject } from 'react';
import { DUR, EASE, FRAMER_EASE } from '../lib/motionTokens';
import { formatInt } from '../utils/formatThousands';
import { useReducedMotion } from './useReducedMotion';

interface CountUpOptions {
  /** Tween duration in seconds. Default DUR.count (0.9s). */
  duration?: number;
  /** Per-frame formatter (e.g. thousands separator). Default String(round). */
  format?: (value: number) => string;
  /** Shared GSAP-compatible ease token. Default EASE.out. */
  ease?: string;
  /** Value to count FROM. Default 0. Pass the previous value to re-tween. */
  from?: number;
  /** Start delay in seconds. */
  delay?: number;
  /** Set false to skip animating (snaps to final value). Default true. */
  enabled?: boolean;
  /** Add the existing small back.out scale pop on settle. Default false. */
  pop?: boolean;
}

type EasingFunction = (progress: number) => number;

const powerOut =
  (power: number): EasingFunction =>
  (progress) =>
    1 - (1 - progress) ** (power + 1);

const powerIn =
  (power: number): EasingFunction =>
  (progress) =>
    progress ** (power + 1);

const backOut =
  (overshoot: number): EasingFunction =>
  (progress) => {
    const shifted = progress - 1;
    return shifted * shifted * ((overshoot + 1) * shifted + overshoot) + 1;
  };

/** Map the app's existing GSAP tokens to their matching per-frame curves. */
const easingFor = (ease: string): EasingFunction => {
  switch (ease) {
    case EASE.reveal:
      return powerOut(3);
    case EASE.in:
      return powerIn(2);
    case EASE.pop:
      return backOut(2);
    case EASE.popHard:
      return backOut(3);
    case EASE.slide:
      return (progress) => (progress < 0.5 ? 8 * progress ** 4 : 1 - (-2 * progress + 2) ** 4 / 2);
    default:
      return powerOut(2);
  }
};

/**
 * Animate a numeric value into `ref`'s textContent. The rAF loop is cancelled
 * on every dependency change/unmount, so a new value interrupts cleanly just
 * like the former scoped GSAP tween.
 */
export function useCountUp(
  ref: RefObject<HTMLElement | null>,
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

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    const finalValue = Math.round(value);
    if (reduced || !enabled || duration <= 0) {
      element.textContent = format(finalValue);
      return;
    }

    const easing = easingFor(ease);
    const durationMs = duration * 1000;
    const startAt = performance.now() + delay * 1000;
    let frameId: number | null = null;
    let popAnimation: Animation | null = null;

    element.textContent = format(Math.round(from));

    const popOnSettle = () => {
      if (!pop || typeof element.animate !== 'function') return;

      // The previous tween used back.out(3), yoyo, and two DUR.micro halves.
      // WAAPI keeps that same quick settle without putting a GSAP import behind
      // every Dashboard number. `fill: none` restores any authored transform.
      popAnimation = element.animate(
        [
          { transform: 'scale(1)', offset: 0 },
          { transform: 'scale(1.18)', offset: 0.5 },
          { transform: 'scale(1)', offset: 1 },
        ],
        {
          duration: DUR.micro * 2 * 1000,
          easing: `cubic-bezier(${FRAMER_EASE.popHard.join(', ')})`,
          fill: 'none',
        }
      );
    };

    const tick = (now: number) => {
      if (now < startAt) {
        frameId = requestAnimationFrame(tick);
        return;
      }

      const progress = Math.min(1, (now - startAt) / durationMs);
      const current = from + (value - from) * easing(progress);
      element.textContent = format(Math.round(current));

      if (progress < 1) {
        frameId = requestAnimationFrame(tick);
        return;
      }

      element.textContent = format(finalValue);
      popOnSettle();
    };

    frameId = requestAnimationFrame(tick);
    return () => {
      if (frameId !== null) cancelAnimationFrame(frameId);
      popAnimation?.cancel();
    };
  }, [delay, duration, ease, enabled, format, from, pop, reduced, ref, value]);
}

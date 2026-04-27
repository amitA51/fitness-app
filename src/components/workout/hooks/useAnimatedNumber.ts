// useAnimatedNumber - rAF-driven integer count-up with ease-spring easing
// Respects prefers-reduced-motion; cancels on re-invocation

import { useEffect, useRef, useState } from 'react';

interface UseAnimatedNumberOptions {
  duration?: number;
}

// ease-spring from VISION §5.2: cubic-bezier(0.34, 1.56, 0.64, 1)
// Approximated via parametric cubic Bezier evaluation
const easeSpring = (t: number): number => {
  // Cubic Bezier for y-axis with control points (0.34, 1.56) and (0.64, 1)
  // Newton-Raphson on t→x to find the parameter then compute y
  const cx = 3 * 0.34;
  const bx = 3 * (0.64 - 0.34) - cx;
  const ax = 1 - cx - bx;
  const cy = 3 * 1.56;
  const by = 3 * (1 - 1.56) - cy;
  const ay = 1 - cy - by;

  const sampleX = (u: number) => ((ax * u + bx) * u + cx) * u;
  const sampleY = (u: number) => ((ay * u + by) * u + cy) * u;
  const sampleDerivX = (u: number) => (3 * ax * u + 2 * bx) * u + cx;

  let u = t;
  for (let i = 0; i < 6; i++) {
    const x = sampleX(u) - t;
    const d = sampleDerivX(u);
    if (Math.abs(d) < 1e-6) break;
    u -= x / d;
    if (u < 0) u = 0;
    if (u > 1) u = 1;
  }
  return sampleY(u);
};

const prefersReducedMotion = (): boolean => {
  if (typeof window === 'undefined' || !window.matchMedia) return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
};

export function useAnimatedNumber(value: number, opts: UseAnimatedNumberOptions = {}): number {
  const { duration = 200 } = opts;
  const [display, setDisplay] = useState<number>(value);
  const rafRef = useRef<number | null>(null);
  const fromRef = useRef<number>(value);

  useEffect(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }

    if (prefersReducedMotion() || duration <= 0) {
      fromRef.current = value;
      setDisplay(value);
      return;
    }

    const from = fromRef.current;
    const to = value;
    if (from === to) {
      setDisplay(to);
      return;
    }

    const start = performance.now();
    const step = (now: number) => {
      const elapsed = now - start;
      const t = Math.min(1, elapsed / duration);
      const eased = easeSpring(t);
      const current = from + (to - from) * eased;
      setDisplay(Math.round(current));
      if (t < 1) {
        rafRef.current = requestAnimationFrame(step);
      } else {
        fromRef.current = to;
        setDisplay(to);
        rafRef.current = null;
      }
    };

    rafRef.current = requestAnimationFrame(step);

    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      fromRef.current = to;
    };
  }, [value, duration]);

  return Math.round(display);
}

export default useAnimatedNumber;

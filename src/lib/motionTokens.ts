/**
 * Shared motion primitives with no animation-library dependency.
 *
 * Dashboard replacements import these scalars instead of lib/gsap so they keep
 * the established timing/easing character without pulling the measured ~72 kB
 * GSAP vendor chunk into the cold Dashboard route.
 */

/** GSAP-compatible easing names retained for existing GSAP consumers. */
export const EASE = {
  /** Default reveal / settle — confident deceleration. */
  reveal: 'power3.out',
  /** Generic out. */
  out: 'power2.out',
  /** Generic in (exits). */
  in: 'power2.in',
  /** Playful overshoot for rewards / pops. */
  pop: 'back.out(2)',
  /** Stronger overshoot for tiny digit/icon pops. */
  popHard: 'back.out(3)',
  /** Smooth bidirectional slide (nav puck, route slides). */
  slide: 'power3.inOut',
} as const;

/** Shared durations in seconds. */
export const DUR = {
  micro: 0.16,
  fast: 0.3,
  base: 0.6,
  count: 0.9,
  slow: 1.1,
} as const;

/**
 * Cubic-bezier counterparts for Framer Motion / Web Animations replacements.
 * `reveal` and `out` track the existing GSAP Power3/Power2 deceleration;
 * `pop` preserves the short Back.Out reward character without a GSAP runtime.
 */
export const FRAMER_EASE = {
  reveal: [0.215, 0.61, 0.355, 1] as [number, number, number, number],
  out: [0.165, 0.84, 0.44, 1] as [number, number, number, number],
  in: [0.55, 0.085, 0.68, 0.53] as [number, number, number, number],
  pop: [0.175, 0.885, 0.32, 1.275] as [number, number, number, number],
  popHard: [0.175, 0.885, 0.32, 1.4] as [number, number, number, number],
} as const;

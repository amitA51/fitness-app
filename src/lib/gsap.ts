// ============================================================================
// SPARKOS FITNESS - Central GSAP setup
// ----------------------------------------------------------------------------
// Single source of truth for GSAP. Import { gsap } from here (never directly
// from 'gsap') so plugins are registered exactly once and tree-shaking keeps
// the dedicated 'gsap' vite chunk stable.
//
// IMPORTANT: GSAP does NOT respect prefers-reduced-motion automatically.
// Every animation MUST guard with useReducedMotion() and snap to the final
// state when reduced. Use the EASE / DUR tokens below for a coherent feel.
// ============================================================================

import { useGSAP } from '@gsap/react';
import gsap from 'gsap';
import { Physics2DPlugin } from 'gsap/Physics2DPlugin';

// Register once at module scope (safe to call repeatedly, but this module is
// imported, so it only runs once).
gsap.registerPlugin(useGSAP, Physics2DPlugin);

export { gsap, useGSAP };

/**
 * Shared easing tokens. Keep the whole app's GSAP motion on these curves so
 * every surface feels like one product rather than a grab-bag of animations.
 */
export const EASE = {
  /** Default reveal / settle — confident decel. */
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

/** Shared durations (seconds). */
export const DUR = {
  micro: 0.16,
  fast: 0.3,
  base: 0.6,
  count: 0.9,
  slow: 1.1,
} as const;

/**
 * Number formatters live in utils/formatThousands now (pure, GSAP-free) so the
 * landing chunk doesn't pull GSAP just to format a number. Re-exported here for
 * backwards compatibility with existing importers that also use the GSAP tokens.
 */
export { formatInt, formatThousands } from '../utils/formatThousands';

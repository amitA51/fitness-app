// Shared framer-motion easing tuples. framer-motion v12 types a cubic-bezier
// easing as a 4-number tuple (Easing), not a general number[], so these are
// declared as tuples to stay well-typed wherever a transition uses them.

/** Smooth decelerate (entrances). Mirrors the login flow's house ease. */
export const EASE_OUT: [number, number, number, number] = [0.16, 1, 0.3, 1];

/** Accelerate (exits). */
export const EASE_IN: [number, number, number, number] = [0.55, 0.06, 0.68, 0.19];

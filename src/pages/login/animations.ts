/**
 * SPARKOS FITNESS — Login Page animation variants
 * Reduced-motion: collapses transforms/duration to near-instant opacity-only.
 */

const prefersReducedMotion =
  typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// framer-motion v12 types a cubic-bezier easing as a 4-number tuple (Easing),
// not a general number[]. Declaring these as tuples keeps the variants well-typed.
const EASE_OUT: [number, number, number, number] = [0.16, 1, 0.3, 1];
const EASE_IN: [number, number, number, number] = [0.55, 0.06, 0.68, 0.19];

export const pageVariants = prefersReducedMotion
  ? { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 } }
  : {
      initial: { opacity: 0 },
      animate: { opacity: 1, transition: { duration: 0.3, ease: EASE_OUT } },
      exit: { opacity: 0, transition: { duration: 0.2, ease: EASE_IN } },
    };

export const slideFromRight = prefersReducedMotion
  ? { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 } }
  : {
      initial: { opacity: 0, x: 40 },
      animate: { opacity: 1, x: 0, transition: { duration: 0.4, ease: EASE_OUT } },
      exit: { opacity: 0, x: -40, transition: { duration: 0.25, ease: EASE_IN } },
    };

export const slideFromLeft = prefersReducedMotion
  ? { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 } }
  : {
      initial: { opacity: 0, x: -40 },
      animate: { opacity: 1, x: 0, transition: { duration: 0.4, ease: EASE_OUT } },
      exit: { opacity: 0, x: 40, transition: { duration: 0.25, ease: EASE_IN } },
    };

export const staggerContainer = {
  animate: {
    transition: {
      staggerChildren: prefersReducedMotion ? 0 : 0.08,
    },
  },
};

export const staggerItem = prefersReducedMotion
  ? { initial: { opacity: 0 }, animate: { opacity: 1 } }
  : {
      initial: { opacity: 0, y: 16 },
      animate: {
        opacity: 1,
        y: 0,
        transition: { duration: 0.4, ease: EASE_OUT },
      },
    };

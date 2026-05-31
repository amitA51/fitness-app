// ============================================================================
// SPARKOS FITNESS - Animation Presets
// ============================================================================

export const ANIMATION_PRESETS = {
  fadeIn: {
    initial: { opacity: 0 },
    animate: { opacity: 1 },
    exit: { opacity: 0 },
  },
  slideUp: {
    initial: { opacity: 0, y: 20 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: -20 },
  },
  slideDown: {
    initial: { opacity: 0, y: -20 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: 20 },
  },
  scale: {
    initial: { opacity: 0, scale: 0.9 },
    animate: { opacity: 1, scale: 1 },
    exit: { opacity: 0, scale: 0.9 },
  },
  bounce: {
    initial: { opacity: 0, y: 50 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: 50 },
  },
  enableAnimations: true,
} as const;

export const SPRING_PRESETS = {
  gentle: { type: 'spring', stiffness: 120, damping: 14 },
  snappy: { type: 'spring', stiffness: 300, damping: 30 },
  bouncy: { type: 'spring', stiffness: 400, damping: 10 },
} as const;

/**
 * Semantic motion curves — single source of truth.
 * - settle: feedback, menus, toggles (critically-damped)
 * - reveal: page/list transitions (expo ease-out)
 * - playful: celebrations only (underdamped bounce)
 */
export const MOTION_CURVES = {
  settle: { type: 'spring' as const, stiffness: 300, damping: 28 },
  reveal: { duration: 0.35, ease: [0.16, 1, 0.3, 1] as const },
  playful: { type: 'spring' as const, stiffness: 400, damping: 12 },
} as const;

/** @deprecated Use MOTION_CURVES.playful for celebrations or MOTION_CURVES.settle for menus */
export const SPRING_BOUNCY = { type: 'spring' as const, stiffness: 400, damping: 10 };

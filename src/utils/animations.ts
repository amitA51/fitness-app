// ============================================================================
// SPARKOS FITNESS - Animations Config
// ============================================================================

export const ANIMATIONS = {
  duration: {
    fast: 150,
    normal: 300,
    slow: 500,
  },
  easing: {
    easeIn: 'cubic-bezier(0.4, 0, 1, 1)',
    easeOut: 'cubic-bezier(0, 0, 0.2, 1)',
    easeInOut: 'cubic-bezier(0.4, 0, 0.2, 1)',
    /** @deprecated Use --ease-premium / MOTION_CURVES.reveal instead */
    spring: 'cubic-bezier(0.16, 1, 0.3, 1)',
  },
} as const;

export const TRANSITIONS = {
  default: 'all 0.3s ease-out',
  fast: 'all 0.15s ease-out',
  slow: 'all 0.5s ease-out',
} as const;

export const KEYFRAMES = {
  fadeIn: {
    from: { opacity: 0 },
    to: { opacity: 1 },
  },
  fadeOut: {
    from: { opacity: 1 },
    to: { opacity: 0 },
  },
  slideUp: {
    from: { opacity: 0, transform: 'translateY(20px)' },
    to: { opacity: 1, transform: 'translateY(0)' },
  },
  slideDown: {
    from: { opacity: 0, transform: 'translateY(-20px)' },
    to: { opacity: 1, transform: 'translateY(0)' },
  },
  scale: {
    from: { opacity: 0, transform: 'scale(0.9)' },
    to: { opacity: 1, transform: 'scale(1)' },
  },
} as const;

// Animation variants for framer-motion
export const fadeVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1 },
};

export const popInVariants = {
  hidden: { opacity: 0, scale: 0.8 },
  visible: { opacity: 1, scale: 1 },
};

export const DURATION = {
  fast: 150,
  normal: 300,
  slow: 500,
} as const;

// Animation config export
export const ANIMATION_CONFIG = {
  duration: 0.3,
  ease: 'easeOut',
};

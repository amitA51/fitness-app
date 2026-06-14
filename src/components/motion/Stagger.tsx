// ============================================================================
// Stagger — reusable staggered-entrance motion layer (C7).
// ============================================================================
// One source of truth for the app's list/row/stat entrance so motion is
// consistent instead of re-invented per screen. Children fade + rise in
// sequence. Relies on the existing LazyMotion (features=domMax) ancestor in
// main.tsx — uses the `m` namespace, adds no new provider.
//
// prefers-reduced-motion: renders children instantly with NO transform and NO
// stagger (a plain wrapper), honoring the user's motion preference.

import { type Variants, m } from 'framer-motion';
import { type CSSProperties, type ReactNode, useEffect, useRef } from 'react';
import { useReducedMotion } from '../../hooks/useReducedMotion';
import { EASE_OUT } from './easings';

interface StaggerProps {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
  /** Seconds between each child's entrance. */
  stagger?: number;
  /** Seconds before the first child enters. */
  delay?: number;
  /**
   * When true (default), the cascade plays only on the FIRST mount — subsequent
   * re-renders render the children already-revealed, so list updates don't
   * re-stagger (the "uniform reflex pop" we're avoiding is a first-mount effect,
   * not a per-update one). Set false for the rare case you want it to replay.
   */
  firstMountOnly?: boolean;
}

const container = (stagger: number, delay: number): Variants => ({
  hidden: {},
  visible: { transition: { staggerChildren: stagger, delayChildren: delay } },
});

const item: Variants = {
  hidden: { opacity: 0, y: 8 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: EASE_OUT } },
};

export function Stagger({
  children,
  className,
  style,
  stagger = 0.05,
  delay = 0,
  firstMountOnly = true,
}: StaggerProps) {
  const reduced = useReducedMotion();
  // Latch the entrance to the first mount so re-renders don't replay the cascade.
  // Read the ref's value during render (still false on a genuine first mount, even
  // under StrictMode's dev double-render) and set it in an effect — never during
  // render — so the entrance always plays once on real mount.
  const hasAnimatedRef = useRef(false);
  const skipEntrance = firstMountOnly && hasAnimatedRef.current;
  useEffect(() => {
    hasAnimatedRef.current = true;
  }, []);

  if (reduced || skipEntrance) {
    return (
      <div className={className} style={style}>
        {children}
      </div>
    );
  }

  return (
    <m.div
      className={className}
      style={style}
      variants={container(stagger, delay)}
      initial="hidden"
      animate="visible"
    >
      {children}
    </m.div>
  );
}

interface StaggerItemProps {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
}

/** Child of <Stagger>. Consumes the parent's stagger timing. */
export function StaggerItem({ children, className, style }: StaggerItemProps) {
  const reduced = useReducedMotion();
  if (reduced) {
    return (
      <div className={className} style={style}>
        {children}
      </div>
    );
  }
  return (
    <m.div className={className} style={style} variants={item}>
      {children}
    </m.div>
  );
}

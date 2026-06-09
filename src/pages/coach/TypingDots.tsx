// ============================================================================
// TypingDots — three staggered, softly-pulsing dots used as a "delivering"
// indicator on an in-flight chat message. Shared by MessageThread and
// GroupThread so the motion is defined once.
// ============================================================================
// prefers-reduced-motion: the dots render static (no pulse) — the indicator
// still communicates "in progress" via its presence, just without animation.

import { m } from 'framer-motion';
import { useReducedMotion } from '../../hooks/useReducedMotion';

export function TypingDots({ label = 'שולח…' }: { label?: string }) {
  const reduced = useReducedMotion();

  return (
    <span
      role="status"
      aria-label={label}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        padding: '8px 12px',
        background: 'var(--fs-surface)',
        border: '1px solid var(--fs-surface-2)',
        borderRadius: 999,
      }}
    >
      {[0, 1, 2].map((i) =>
        reduced ? (
          <span
            key={i}
            aria-hidden="true"
            style={{ width: 6, height: 6, borderRadius: 999, background: 'var(--fs-muted)' }}
          />
        ) : (
          <m.span
            key={i}
            aria-hidden="true"
            style={{ width: 6, height: 6, borderRadius: 999, background: 'var(--fs-muted)' }}
            animate={{ opacity: [0.35, 1, 0.35], y: [0, -2, 0] }}
            transition={{
              duration: 0.9,
              repeat: Number.POSITIVE_INFINITY,
              ease: 'easeInOut',
              delay: i * 0.15,
            }}
          />
        )
      )}
    </span>
  );
}

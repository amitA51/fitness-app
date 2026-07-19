import { AnimatePresence, m, useReducedMotion } from 'framer-motion';
import { Check } from 'lucide-react';

/**
 * Subtle "נשמר" (saved) confirmation. Replaces the old full-width Save buttons:
 * sections now autosave and flash this badge next to their heading instead.
 * Shared by every autosaving section so the feedback is identical everywhere.
 *
 * Motion is suppressed under `prefers-reduced-motion` (instant show/hide), and
 * the badge is `aria-live="polite"` so screen readers announce the save without
 * stealing focus.
 */
export function SavedIndicator({ saved }: { saved: boolean }) {
  const prefersReduced = useReducedMotion() ?? false;

  return (
    <div aria-live="polite" className="flex items-center" style={{ minHeight: 20 }}>
      <AnimatePresence>
        {saved && (
          <m.span
            key="saved"
            initial={prefersReduced ? { opacity: 0 } : { opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={prefersReduced ? { opacity: 0 } : { opacity: 0, y: -4 }}
            transition={{ duration: prefersReduced ? 0 : 0.18 }}
            className="inline-flex items-center gap-1"
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '11px',
              fontWeight: 600,
              letterSpacing: '-0.01em',
              color: 'var(--fs-accent)',
            }}
          >
            <Check size={13} aria-hidden="true" strokeWidth={3} />
            נשמר
          </m.span>
        )}
      </AnimatePresence>
    </div>
  );
}

export default SavedIndicator;

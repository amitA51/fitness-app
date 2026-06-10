// PRCelebrationBanner — Fresh Steel / Obsidian
// Compact, non-blocking toast-style banner for a just-broken personal record.
// Lime (--fs-signal) is RESERVED for the PR moment app-wide — this is the one
// earned use. No full-screen takeover: the set flow is never interrupted.
//
// Purely visual: WorkoutAriaLive already announces the PR to screen readers,
// so this banner is aria-hidden and pointer-events-none. Auto-dismisses after
// AUTO_HIDE_MS via the parent's HIDE_PR_CELEBRATION dispatch. Under
// prefers-reduced-motion it appears/disappears as a static badge.

import { AnimatePresence, m } from 'framer-motion';
import { Trophy } from 'lucide-react';
import React, { useEffect } from 'react';
import { useReducedMotion } from '../../../hooks/useReducedMotion';
import { type PersonalRecord, getPRDisplayText } from '../../../services/prService';

const AUTO_HIDE_MS = 2500;

const PR_TYPE_LABEL: Record<string, string> = {
  weight: 'שיא משקל',
  volume: 'שיא נפח',
  reps: 'שיא חזרות',
  '1rm': 'שיא 1RM',
};

interface PRCelebrationBannerProps {
  pr: PersonalRecord | null;
  onDismiss: () => void;
}

const PRCelebrationBanner: React.FC<PRCelebrationBannerProps> = ({ pr, onDismiss }) => {
  const reduced = useReducedMotion();

  // Auto-hide. A new PR payload (new id) while visible resets the timer.
  useEffect(() => {
    if (!pr) return undefined;
    const timeout = setTimeout(onDismiss, AUTO_HIDE_MS);
    return () => clearTimeout(timeout);
  }, [pr, onDismiss]);

  return (
    <AnimatePresence>
      {pr && (
        <m.div
          key={pr.id}
          initial={reduced ? { opacity: 1 } : { opacity: 0, y: -16, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={reduced ? { opacity: 0, transition: { duration: 0 } } : { opacity: 0, y: -12 }}
          transition={reduced ? { duration: 0 } : { type: 'spring', stiffness: 320, damping: 26 }}
          aria-hidden="true"
          className="fixed top-16 inset-x-0 z-50 flex justify-center pointer-events-none px-4"
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              maxWidth: 360,
              padding: '10px 16px',
              background: 'var(--fs-primary)',
              border: '2px solid var(--fs-signal)',
              boxShadow: 'var(--shadow-deep)',
            }}
          >
            <span
              style={{
                width: 34,
                height: 34,
                display: 'grid',
                placeItems: 'center',
                background: 'var(--fs-signal)',
                color: 'var(--fs-primary)',
                flexShrink: 0,
              }}
            >
              <Trophy size={18} strokeWidth={2.5} />
            </span>
            <div style={{ minWidth: 0 }}>
              <div
                className="uppercase"
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: 9,
                  fontWeight: 700,
                  letterSpacing: '0.22em',
                  color: 'var(--fs-signal)',
                }}
              >
                {PR_TYPE_LABEL[pr.type] ?? 'שיא אישי'}
              </div>
              <div
                style={{
                  fontFamily: 'var(--font-display)',
                  fontWeight: 900,
                  fontSize: 15,
                  lineHeight: 1.15,
                  color: 'var(--color-ink-on-dark)',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {pr.exerciseName}
              </div>
              <div
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: 11,
                  color: 'rgba(var(--text-on-navy-rgb), 0.75)',
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                {getPRDisplayText(pr)}
              </div>
            </div>
          </div>
        </m.div>
      )}
    </AnimatePresence>
  );
};

export default React.memo(PRCelebrationBanner);

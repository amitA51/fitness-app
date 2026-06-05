// CoachMark — a single, dismissible contextual hint chip shown on a screen's
// first visit. NON-modal by design: it does not trap focus or lock scroll, it
// just teaches inline and gets out of the way. Tracked per-screen by a
// guidanceService hint flag, so once dismissed it never returns (until a
// Settings re-launch clears the flags).
//
// A11y: lives on Z_INDEX.overlay so it never covers the welcome sheet; uses an
// aria-live="polite" region so screen readers announce it; the visible
// "הבנתי" dismiss button doubles as the keyboard/Esc affordance.

import { Lightbulb, X } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Z_INDEX } from '../../constants/zIndex';
import { useReducedMotion } from '../../hooks/useReducedMotion';
import { type GuidanceHintKey, dismissHint, isHintDismissed } from '../../services/guidanceService';

interface CoachMarkProps {
  /** Which contextual hint flag this chip is tracked by. */
  hintKey: GuidanceHintKey;
  /** The Hebrew hint text. */
  children: string;
  /**
   * Optional visible Hebrew text on the dismiss button (e.g. "הבנתי"). When
   * omitted the chip uses a compact icon-only ✕ dismiss instead.
   */
  dismissLabel?: string;
  /** Accessible label for the dismiss button; defaults to a sensible Hebrew label. */
  dismissAriaLabel?: string;
}

export function CoachMark({
  hintKey,
  children,
  dismissLabel,
  dismissAriaLabel = 'הבנתי, סגירה',
}: CoachMarkProps) {
  const reduceMotion = useReducedMotion();
  // Lazy init: don't render at all if already dismissed (or storage unavailable
  // returns "not dismissed" → we show it, which is the safe default).
  const [visible, setVisible] = useState<boolean>(() => !isHintDismissed(hintKey));
  const rootRef = useRef<HTMLDivElement>(null);

  const handleDismiss = useCallback(() => {
    dismissHint(hintKey);
    setVisible(false);
  }, [hintKey]);

  // Esc dismisses while focus is inside the chip (non-modal — only when focused).
  useEffect(() => {
    if (!visible) return;
    const node = rootRef.current;
    if (!node) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleDismiss();
    };
    node.addEventListener('keydown', onKeyDown);
    return () => node.removeEventListener('keydown', onKeyDown);
  }, [visible, handleDismiss]);

  if (!visible) return null;

  return (
    <div
      ref={rootRef}
      role="status"
      aria-live="polite"
      className={reduceMotion ? undefined : 'fade-rise-in'}
      style={{
        position: 'relative',
        zIndex: Z_INDEX.overlay,
        display: 'flex',
        alignItems: 'flex-start',
        gap: 'var(--space-3)',
        padding: 'var(--space-3) var(--space-4)',
        background: 'var(--fs-surface)',
        border: '1px solid var(--fs-accent)',
        borderRadius: 'var(--radius-asymmetric)',
        boxShadow: 'var(--shadow-card)',
      }}
    >
      <span
        aria-hidden="true"
        className="shrink-0 inline-flex items-center justify-center"
        style={{ width: 22, height: 22, color: 'var(--fs-accent)', marginTop: 2 }}
      >
        <Lightbulb size={18} strokeWidth={2.2} aria-hidden="true" />
      </span>

      <p
        className="flex-1"
        style={{
          fontFamily: 'var(--font-body)',
          fontSize: 14,
          lineHeight: 1.5,
          color: 'var(--fs-ink)',
          margin: 0,
          textAlign: 'start',
        }}
      >
        {children}
      </p>

      {dismissLabel ? (
        <button
          type="button"
          onClick={handleDismiss}
          aria-label={dismissAriaLabel}
          className="shrink-0 inline-flex items-center justify-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--fs-accent)] focus-visible:ring-offset-2 active:scale-[0.96]"
          style={{
            minHeight: 44,
            padding: '0 var(--space-3)',
            borderRadius: 'var(--radius-md)',
            background: 'var(--fs-accent)',
            color: 'var(--color-ink-on-accent)',
            fontFamily: 'var(--font-body)',
            fontSize: 13,
            fontWeight: 700,
            whiteSpace: 'nowrap',
          }}
        >
          {dismissLabel}
        </button>
      ) : (
        <button
          type="button"
          onClick={handleDismiss}
          aria-label={dismissAriaLabel}
          className="shrink-0 inline-flex items-center justify-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--fs-accent)] focus-visible:ring-offset-2 active:scale-[0.96]"
          style={{
            width: 44,
            height: 44,
            marginInlineStart: 'calc(var(--space-2) * -1)',
            marginBlock: 'calc(var(--space-2) * -1)',
            borderRadius: 'var(--radius-md)',
            background: 'transparent',
            color: 'var(--fs-muted)',
          }}
        >
          <X size={18} aria-hidden="true" />
        </button>
      )}
    </div>
  );
}

export default CoachMark;

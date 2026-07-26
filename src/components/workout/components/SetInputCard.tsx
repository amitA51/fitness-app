// SetInputCard - Fresh Steel v2 Stepper Design
// Layout: label (top) → value → ghost commit button → stepper row → step hint
// border-radius via --radius-asymmetric · radial gradient bg · accent plus / surface-2 minus
//
// A11y: the value area is a real <button> (opens the numpad), and the +/-
// steppers are sibling <button>s — no nested-interactive markup. The "previous
// value" ghost is its OWN <button> rendered as a sibling (NOT nested inside the
// value <button>), so committing the previous value is one tap with valid
// markup. RTL-aware via useIsRTL(): the stepper mirrors (− right / + left) so
// increment stays on the leading edge. Honors prefers-reduced-motion for the
// value-change flash and the kinetic number snap (useNumberSnap is a no-op when
// reduced).

import { AnimatePresence, m } from 'framer-motion';
import { ChevronUp } from 'lucide-react';
import type React from 'react';
import { memo, useCallback } from 'react';
import { useHapticFeedback } from '../../../hooks/useHapticFeedback';
import { useIsRTL } from '../../../hooks/useIsRTL';
import { useNumberSnap } from '../../../hooks/useNumberSnap';
import { useReducedMotion } from '../../../hooks/useReducedMotion';

// ============================================================
// TYPES
// ============================================================

interface SetInputCardProps {
  label: string;
  value: number;
  ghostValue?: number;
  showGhost: boolean;
  icon?: React.ReactNode;
  incrementAmount?: number;
  unit?: string;
  accentColor?: string;
  onTap: () => void;
  onIncrement: () => void;
  onDecrement: () => void;
  /** Commit the previous (ghost) value into this field — wired to the tappable ghost. */
  onCommitGhost?: (value: number) => void;
  showButtons?: boolean;
}

// ============================================================
// MAIN COMPONENT
// ============================================================

const SetInputCard = memo<SetInputCardProps>(
  ({
    label,
    value,
    ghostValue,
    showGhost,
    incrementAmount = 1,
    unit,
    onTap,
    onIncrement,
    onDecrement,
    onCommitGhost,
    showButtons = true,
  }) => {
    const displayValue = value || (showGhost ? ghostValue : 0) || 0;
    const isGhostValue = !value && showGhost && !!ghostValue;
    const isRTL = useIsRTL();
    const haptics = useHapticFeedback();
    const prefersReduced = useReducedMotion() ?? false;
    // Kinetic snap: the value display pops (scale 1→1.08→1) on every +/- change.
    // The hook fires only on change (never on mount) and is a no-op under
    // prefers-reduced-motion, so no extra guard is needed here.
    const valueSnapRef = useNumberSnap(displayValue);

    const flashKey = value > 0 ? value : null;

    const handleTap = useCallback(() => {
      haptics.impact('medium');
      onTap();
    }, [onTap, haptics]);

    // Commit the previous value into the active field — a light tick (the value
    // is provisional until the set is completed, so this is a tap, not success).
    const handleCommitGhost = useCallback(() => {
      if (ghostValue === undefined) return;
      haptics.tap();
      onCommitGhost?.(ghostValue);
    }, [ghostValue, onCommitGhost, haptics]);

    const handleIncrement = useCallback(() => {
      haptics.tap();
      onIncrement();
    }, [onIncrement, haptics]);

    const handleDecrement = useCallback(() => {
      haptics.tap();
      onDecrement();
    }, [onDecrement, haptics]);

    const decrementButton = (
      <button
        type="button"
        onClick={handleDecrement}
        disabled={value <= 0}
        className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--fs-accent)] focus-visible:ring-offset-1 disabled:cursor-not-allowed"
        style={{
          height: 48,
          minHeight: 48,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: 9999,
          background: 'var(--fs-surface-2)',
          border: 'none',
          fontFamily: 'var(--font-body)',
          fontWeight: 600,
          fontSize: 22,
          color: 'var(--fs-ink)',
          cursor: value <= 0 ? 'not-allowed' : 'pointer',
          opacity: value <= 0 ? 0.45 : 1,
          transition: prefersReduced ? 'none' : 'transform 100ms ease, opacity 150ms ease',
        }}
        onPointerDown={(e) => {
          if (prefersReduced || value <= 0) return;
          (e.currentTarget as HTMLElement).style.transform = 'scale(0.93)';
        }}
        onPointerUp={(e) => {
          (e.currentTarget as HTMLElement).style.transform = 'scale(1)';
        }}
        onPointerLeave={(e) => {
          (e.currentTarget as HTMLElement).style.transform = 'scale(1)';
        }}
        aria-label={`הפחת ${label}`}
      >
        −
      </button>
    );

    const incrementButton = (
      <button
        type="button"
        onClick={handleIncrement}
        className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--fs-accent)] focus-visible:ring-offset-1"
        style={{
          height: 48,
          minHeight: 48,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: 9999,
          background: 'var(--fs-accent)',
          border: 'none',
          fontFamily: 'var(--font-body)',
          fontWeight: 600,
          fontSize: 22,
          color: 'var(--color-ink-on-accent)',
          cursor: 'pointer',
          transition: prefersReduced ? 'none' : 'transform 100ms ease',
          boxShadow: '0 4px 14px color-mix(in srgb, var(--fs-accent) 24%, transparent)',
        }}
        onPointerDown={(e) => {
          if (prefersReduced) return;
          (e.currentTarget as HTMLElement).style.transform = 'scale(0.93)';
        }}
        onPointerUp={(e) => {
          (e.currentTarget as HTMLElement).style.transform = 'scale(1)';
        }}
        onPointerLeave={(e) => {
          (e.currentTarget as HTMLElement).style.transform = 'scale(1)';
        }}
        aria-label={`הגדל ${label}`}
      >
        +
      </button>
    );

    // Stepper order (swapped per user preference): in RTL the minus sits on the
    // right (leading edge) and plus on the left; mirrored for LTR. Computed inline
    // because incrementButton/decrementButton are fresh JSX every render.
    const stepperButtons = isRTL ? (
      <>
        {decrementButton}
        {incrementButton}
      </>
    ) : (
      <>
        {incrementButton}
        {decrementButton}
      </>
    );

    return (
      <div
        style={{
          position: 'relative',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          background: 'var(--fs-surface)',
          border: '1px solid color-mix(in srgb, var(--color-border) 85%, transparent)',
          borderRadius: 'var(--radius-2xl)',
          boxShadow: 'var(--elevation-1)',
          padding: '18px 14px 14px',
          overflow: 'hidden',
          gap: 6,
        }}
      >
        {/* Tap target — opens the numpad for this field. Real <button> so it's
            keyboard- and screen-reader-operable; the steppers are siblings, not
            nested, to keep the markup valid. */}
        <button
          type="button"
          onClick={handleTap}
          aria-label={`${label}: ${displayValue}${unit ? ` ${unit}` : ''} — הקש לעריכה`}
          className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--fs-accent)] focus-visible:ring-offset-1"
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 4,
            width: '100%',
            background: 'transparent',
            border: 'none',
            padding: 0,
            cursor: 'pointer',
            transition: prefersReduced ? 'none' : 'transform 150ms ease',
          }}
          onPointerDown={(e) => {
            if (prefersReduced) return;
            (e.currentTarget as HTMLElement).style.transform = 'scale(0.97)';
          }}
          onPointerUp={(e) => {
            (e.currentTarget as HTMLElement).style.transform = 'scale(1)';
          }}
          onPointerLeave={(e) => {
            (e.currentTarget as HTMLElement).style.transform = 'scale(1)';
          }}
        >
          {/* 1. Label (top) */}
          <span
            style={{
              fontFamily: 'var(--font-body)',
              fontSize: 13,
              letterSpacing: '-0.01em',
              fontWeight: 600,
              color: 'var(--fs-muted)',
            }}
          >
            {label}
          </span>

          {/* 2. Value */}
          <div
            style={{
              position: 'relative',
              display: 'flex',
              alignItems: 'baseline',
              direction: 'ltr',
            }}
          >
            <span
              ref={valueSnapRef as React.RefObject<HTMLSpanElement>}
              className="kinetic-number"
              style={{
                fontFamily: 'var(--font-display)',
                fontWeight: 700,
                fontSize: 'clamp(34px, 10vw, 42px)',
                lineHeight: 1,
                letterSpacing: '-0.03em',
                display: 'inline-block',
                color: isGhostValue
                  ? 'color-mix(in srgb, var(--fs-muted) 56%, transparent)'
                  : 'var(--fs-ink)',
              }}
            >
              {displayValue}
            </span>
            {unit && (
              <span
                style={{
                  marginInlineStart: 4,
                  fontSize: 13,
                  fontFamily: 'var(--font-body)',
                  color: 'var(--fs-muted)',
                  fontWeight: 500,
                  letterSpacing: '-0.01em',
                }}
              >
                {unit}
              </span>
            )}
          </div>
        </button>

        {/* 3. Ghost commit */}
        {showGhost && ghostValue && !value && (
          <button
            type="button"
            onClick={handleCommitGhost}
            aria-label={`השתמש בערך הקודם ${ghostValue}`}
            className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--fs-accent)] focus-visible:ring-offset-1"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
              marginTop: 2,
              padding: '6px 12px',
              fontFamily: 'var(--font-body)',
              fontSize: 12,
              fontWeight: 600,
              letterSpacing: '-0.01em',
              color: 'var(--fs-accent-2)',
              background: 'color-mix(in srgb, var(--fs-accent) 12%, transparent)',
              border: '1px solid color-mix(in srgb, var(--fs-accent) 24%, transparent)',
              borderRadius: 9999,
              cursor: 'pointer',
              transition: prefersReduced ? 'none' : 'transform 100ms ease',
            }}
            onPointerDown={(e) => {
              if (prefersReduced) return;
              (e.currentTarget as HTMLElement).style.transform = 'scale(0.95)';
            }}
            onPointerUp={(e) => {
              (e.currentTarget as HTMLElement).style.transform = 'scale(1)';
            }}
            onPointerLeave={(e) => {
              (e.currentTarget as HTMLElement).style.transform = 'scale(1)';
            }}
          >
            <ChevronUp size={12} strokeWidth={2.5} aria-hidden />
            <span dir="ltr">קודם {ghostValue}</span>
          </button>
        )}

        {/* 4. Stepper row */}
        {showButtons && (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: 8,
              width: '100%',
              marginTop: 10,
            }}
          >
            {stepperButtons}
          </div>
        )}

        {/* 5. Step hint */}
        {showButtons && (
          <span
            style={{
              marginTop: 4,
              fontFamily: 'var(--font-body)',
              fontSize: 12,
              letterSpacing: '-0.01em',
              color: 'var(--fs-muted)',
              fontWeight: 500,
            }}
          >
            קפיצה {incrementAmount}
          </span>
        )}

        {/* Brief accent-2 color flash on value change (suppressed when
            reduced-motion) — pairs with the kinetic number snap above. */}
        <AnimatePresence>
          {flashKey !== null && !prefersReduced && (
            <m.div
              key={flashKey}
              initial={{ opacity: 0.18 }}
              animate={{ opacity: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.4 }}
              style={{
                position: 'absolute',
                inset: 0,
                background: 'var(--fs-accent-2)',
                pointerEvents: 'none',
              }}
            />
          )}
        </AnimatePresence>
      </div>
    );
  }
);

SetInputCard.displayName = 'SetInputCard';

export default SetInputCard;

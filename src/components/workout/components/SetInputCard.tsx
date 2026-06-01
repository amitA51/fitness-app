// SetInputCard - Fresh Steel v2 Stepper Design
// Layout: label (top) → value → ghost badge → stepper row → step hint
// border-radius via --radius-asymmetric · radial gradient bg · accent plus / surface-2 minus
//
// A11y: the value area is a real <button> (opens the numpad), and the +/-
// steppers are sibling <button>s — no nested-interactive markup. RTL-aware via
// useIsRTL(): the stepper mirrors (− right / + left) so increment stays on the
// leading edge. Honors prefers-reduced-motion for the value-change flash.

import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import type React from 'react';
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useHapticFeedback } from '../../../hooks/useHapticFeedback';
import { useIsRTL } from '../../../hooks/useIsRTL';

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
    showButtons = true,
  }) => {
    const displayValue = value || (showGhost ? ghostValue : 0) || 0;
    const isGhostValue = !value && showGhost && !!ghostValue;
    const isRTL = useIsRTL();
    const haptics = useHapticFeedback();
    const prefersReduced = useReducedMotion() ?? false;

    const [shouldFlash, setShouldFlash] = useState(false);
    const prevValueRef = useRef(value);

    useEffect(() => {
      if (value !== prevValueRef.current && value !== 0) {
        setShouldFlash(true);
        const timer = setTimeout(() => setShouldFlash(false), 400);
        prevValueRef.current = value;
        return () => clearTimeout(timer);
      }
      prevValueRef.current = value;
      return undefined;
    }, [value]);

    const handleTap = useCallback(() => {
      haptics.impact('medium');
      onTap();
    }, [onTap, haptics]);

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
        style={{
          height: 48,
          minHeight: 48,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: 14,
          background: 'var(--fs-surface-2)',
          border: '1px solid color-mix(in srgb, var(--fs-primary) 16%, var(--fs-steel))',
          fontFamily: 'var(--font-display)',
          fontWeight: 800,
          fontSize: 20,
          color: 'var(--fs-ink)',
          cursor: 'pointer',
          transition: 'transform 100ms ease',
        }}
        onPointerDown={(e) => {
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
        style={{
          height: 48,
          minHeight: 48,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: 14,
          background: 'var(--fs-accent)',
          border: '1px solid color-mix(in srgb, var(--fs-primary) 16%, var(--fs-steel))',
          fontFamily: 'var(--font-display)',
          fontWeight: 800,
          fontSize: 20,
          color: 'var(--color-ink-on-accent)',
          cursor: 'pointer',
          transition: 'transform 100ms ease',
        }}
        onPointerDown={(e) => {
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

    // Mirror the stepper in RTL so increment stays on the leading (right) edge.
    const stepperButtons = useMemo(
      () =>
        isRTL ? (
          <>
            {incrementButton}
            {decrementButton}
          </>
        ) : (
          <>
            {decrementButton}
            {incrementButton}
          </>
        ),
      [isRTL, incrementButton, decrementButton]
    );

    return (
      <div
        style={{
          position: 'relative',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          background: `
            radial-gradient(circle at 20px 20px, color-mix(in srgb, var(--fs-accent) 12%, transparent), transparent 30px),
            linear-gradient(135deg, var(--fs-surface-shine-strong), transparent 54%),
            var(--fs-surface)
          `,
          border: '1px solid var(--fs-steel)',
          borderRadius: 'var(--radius-asymmetric)',
          padding: '16px 12px 12px',
          overflow: 'hidden',
          gap: 4,
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
            transition: 'transform 150ms ease',
          }}
          onPointerDown={(e) => {
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
              fontFamily: 'var(--font-mono)',
              fontSize: 9,
              textTransform: 'uppercase',
              letterSpacing: '0.18em',
              fontWeight: 700,
              color: 'var(--fs-accent)',
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
              className="kinetic-number"
              style={{
                fontFamily: 'var(--font-display)',
                fontWeight: 800,
                fontSize: 'clamp(34px, 10vw, 42px)',
                lineHeight: 1,
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
                  marginInlineStart: 3,
                  fontSize: 11,
                  fontFamily: 'var(--font-mono)',
                  color: 'var(--fs-muted)',
                  fontWeight: 600,
                }}
              >
                {unit}
              </span>
            )}
          </div>

          {/* 3. Ghost badge (when value=0 and previous exists) */}
          {showGhost && ghostValue && !value && (
            <span
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 10,
                color: 'color-mix(in srgb, var(--fs-accent) 70%, var(--fs-muted))',
                background: 'color-mix(in srgb, var(--fs-accent) 10%, transparent)',
                padding: '2px 7px',
                borderRadius: 5,
                direction: 'ltr',
              }}
            >
              קודם {ghostValue}
            </span>
          )}
        </button>

        {/* 4. Stepper row */}
        {showButtons && (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: 6,
              width: '100%',
              marginTop: 8,
            }}
          >
            {stepperButtons}
          </div>
        )}

        {/* 5. Step hint (weight card only — shows when incrementAmount > 1) */}
        {incrementAmount > 1 && (
          <span
            style={{
              marginTop: 4,
              fontFamily: 'var(--font-mono)',
              fontSize: 8,
              textTransform: 'uppercase',
              letterSpacing: '0.12em',
              color: 'var(--fs-muted)',
            }}
          >
            קפיצה {incrementAmount}
          </span>
        )}

        {/* Flash effect on value change (suppressed when reduced-motion) */}
        <AnimatePresence>
          {shouldFlash && !prefersReduced && (
            <motion.div
              initial={{ opacity: 0.15 }}
              animate={{ opacity: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.4 }}
              style={{
                position: 'absolute',
                inset: 0,
                background: 'var(--fs-accent)',
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

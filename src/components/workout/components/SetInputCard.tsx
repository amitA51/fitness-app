// SetInputCard - Fresh Steel Stepper Design
// border-radius: 24px 16px 24px 16px · gradient bg · accent plus / surface-2 minus
// Previous values ghosted with color-mix

import { AnimatePresence, motion } from 'framer-motion';
import type React from 'react';
import { memo, useCallback, useEffect, useRef, useState } from 'react';
import { triggerHaptic } from '../../../utils/haptics';

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
// GHOST VALUE DISPLAY
// ============================================================

const GhostValue = memo<{ value: number; unit?: string }>(({ value, unit }) => (
  <span
    style={{
      position: 'absolute',
      top: 8,
      insetInlineStart: 10,
      fontFamily: 'var(--font-mono)',
      fontSize: 10,
      letterSpacing: '0.06em',
      color: 'color-mix(in srgb, var(--fs-accent) 70%, var(--fs-muted))',
      lineHeight: 1,
      direction: 'ltr',
      background: 'color-mix(in srgb, var(--fs-accent) 10%, transparent)',
      padding: '3px 7px',
      borderRadius: 6,
    }}
  >
    קודם {value}
    {unit || ''}
  </span>
));

GhostValue.displayName = 'GhostValue';

// ============================================================
// MAIN COMPONENT
// ============================================================

const SetInputCard = memo<SetInputCardProps>(
  ({
    label,
    value,
    ghostValue,
    showGhost,
    icon,
    incrementAmount = 1,
    unit,
    accentColor,
    onTap,
    onIncrement,
    onDecrement,
    showButtons = true,
  }) => {
    const displayValue = value || (showGhost ? ghostValue : 0) || 0;
    const isGhostValue = !value && showGhost && !!ghostValue;

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
      triggerHaptic('medium');
      onTap();
    }, [onTap]);

    const handleIncrement = useCallback(
      (e: React.MouseEvent) => {
        e.stopPropagation();
        triggerHaptic('light');
        onIncrement();
      },
      [onIncrement]
    );

    const handleDecrement = useCallback(
      (e: React.MouseEvent) => {
        e.stopPropagation();
        triggerHaptic('light');
        onDecrement();
      },
      [onDecrement]
    );

    const accent = accentColor || 'var(--fs-accent)';

    return (
      <div
        className="magnetic-card scrim-noise"
        style={{
          position: 'relative',
          display: 'flex',
          flexDirection: 'column',
          background: `
            radial-gradient(circle at 22px 22px, color-mix(in srgb, var(--fs-accent) 17%, transparent), transparent 28px),
            linear-gradient(135deg, var(--fs-surface-shine-strong), transparent 54%),
            var(--fs-surface)
          `,
          border: '1px solid var(--fs-steel)',
          borderRadius: '24px 16px 24px 16px',
          overflow: 'hidden',
          cursor: 'pointer',
          transition: 'transform 150ms ease',
        }}
        onClick={(e) => {
          e.stopPropagation();
          handleTap();
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            e.stopPropagation();
            handleTap();
          }
        }}
        onPointerDown={(e) => {
          (e.currentTarget as HTMLElement).style.transform = 'scale(0.98)';
        }}
        onPointerUp={(e) => {
          (e.currentTarget as HTMLElement).style.transform = 'scale(1)';
        }}
        onPointerLeave={(e) => {
          (e.currentTarget as HTMLElement).style.transform = 'scale(1)';
        }}
        role="button"
        tabIndex={0}
      >
        {/* Repeating line pattern */}
        <div
          style={{
            position: 'absolute',
            inset: 'auto 11px 68px 11px',
            height: 1,
            background: `repeating-linear-gradient(90deg, var(--fs-surface-2) 0 1px, transparent 1px 12px)`,
            pointerEvents: 'none',
          }}
        />

        {/* Header Row - Icon and Ghost */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'flex-end',
            padding: '10px 12px 0',
            position: 'relative',
            zIndex: 1,
          }}
        >
          {icon && (
            <div
              style={{
                width: 32,
                height: 32,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'var(--fs-accent)',
                borderRadius: '8px 6px 8px 6px',
              }}
            >
              {icon}
            </div>
          )}
        </div>

        {/* Content */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            flex: 1,
            padding: '0 14px 14px',
            position: 'relative',
            zIndex: 1,
          }}
        >
          {/* Ghost previous value */}
          {showGhost && ghostValue && !value && <GhostValue value={ghostValue} unit={unit} />}

          {/* Value */}
          <div
            style={{ position: 'relative', display: 'flex', alignItems: 'baseline', minHeight: 56 }}
          >
            <span
              className="kinetic-number large"
              style={{
                fontFamily: 'var(--font-display)',
                fontWeight: 800,
                fontSize: 46,
                lineHeight: 1,
                letterSpacing: '-0.03em',
                color: isGhostValue
                  ? 'color-mix(in srgb, var(--fs-muted) 56%, transparent)'
                  : 'var(--fs-ink)',
                direction: 'ltr',
              }}
            >
              {displayValue}
            </span>
            {unit && (
              <span
                style={{
                  marginInlineStart: 4,
                  fontSize: 12,
                  fontFamily: 'var(--font-mono)',
                  color: 'var(--fs-muted)',
                  fontWeight: 600,
                }}
              >
                {unit}
              </span>
            )}
          </div>

          {/* Label */}
          <span
            style={{
              fontSize: 9,
              textTransform: 'uppercase',
              letterSpacing: '0.2em',
              fontWeight: 700,
              color: accent,
              fontFamily: 'var(--font-mono)',
              marginTop: 4,
            }}
          >
            {label}
          </span>

          {/* Quick Buttons */}
          {showButtons && (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                width: '100%',
                marginTop: 10,
                gap: 7,
              }}
              onPointerDown={(e) => e.stopPropagation()}
            >
              <button
                type="button"
                onClick={handleDecrement}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  minHeight: 44,
                  minWidth: 44,
                  background: 'var(--fs-surface-2)',
                  border: `1px solid color-mix(in srgb, var(--fs-primary) 16%, var(--fs-steel))`,
                  borderRadius: 15,
                  fontFamily: 'var(--font-display)',
                  fontWeight: 800,
                  fontSize: 20,
                  color: 'var(--fs-ink)',
                  cursor: 'pointer',
                  transition: 'background-color 100ms ease, transform 100ms ease',
                }}
                onPointerDown={(e) => {
                  (e.currentTarget as HTMLElement).style.transform = 'scale(0.95)';
                }}
                onPointerUp={(e) => {
                  (e.currentTarget as HTMLElement).style.transform = 'scale(1)';
                }}
                onPointerLeave={(e) => {
                  (e.currentTarget as HTMLElement).style.transform = 'scale(1)';
                }}
                aria-label="הפחת ערך"
              >
                −
              </button>
              <button
                type="button"
                onClick={handleIncrement}
                className="accent-glow"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  minHeight: 44,
                  minWidth: 44,
                  background: 'var(--fs-accent)',
                  border: `1px solid color-mix(in srgb, var(--fs-primary) 16%, var(--fs-steel))`,
                  borderRadius: 15,
                  fontFamily: 'var(--font-display)',
                  fontWeight: 800,
                  fontSize: 20,
                  color: '#FFFFFF',
                  cursor: 'pointer',
                  transition: 'background-color 100ms ease, transform 100ms ease',
                }}
                onPointerDown={(e) => {
                  (e.currentTarget as HTMLElement).style.transform = 'scale(0.95)';
                }}
                onPointerUp={(e) => {
                  (e.currentTarget as HTMLElement).style.transform = 'scale(1)';
                }}
                onPointerLeave={(e) => {
                  (e.currentTarget as HTMLElement).style.transform = 'scale(1)';
                }}
                aria-label="הגדל ערך"
              >
                +
              </button>
            </div>
          )}

          {/* Step Hint */}
          {incrementAmount > 1 && (
            <span
              style={{
                marginTop: 8,
                fontSize: 8,
                fontFamily: 'var(--font-mono)',
                textTransform: 'uppercase',
                letterSpacing: '0.15em',
                color: 'var(--fs-muted)',
              }}
            >
              קפיצה {incrementAmount}
            </span>
          )}
        </div>

        {/* Flash Effect */}
        <AnimatePresence>
          {shouldFlash && (
            <motion.div
              initial={{ opacity: 0.4 }}
              animate={{ opacity: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.4 }}
              style={{
                position: 'absolute',
                inset: 0,
                background: 'var(--fs-accent)',
                opacity: 0.15,
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

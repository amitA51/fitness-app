// SetInputCard - VISION Sport Annual Design
// Navy · Mustard · Bone · Big Shoulders Display + IBM Plex Mono

import { AnimatePresence, motion } from 'framer-motion';
import type React from 'react';
import { memo, useCallback, useEffect, useRef, useState } from 'react';
import { triggerHaptic } from '../../../utils/haptics';
import { AnimatedNumber } from './ui/AnimatedNumber';

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
// GHOST INDICATOR
// ============================================================

const GhostIndicator = memo(() => (
  <div
    style={{
      position: 'absolute',
      top: 8,
      right: 8,
      display: 'flex',
      alignItems: 'center',
      gap: 4,
    }}
  >
    <div
      style={{
        width: 6,
        height: 6,
        borderRadius: '50%',
        backgroundColor: 'var(--stone-light)',
      }}
    />
    <span
      style={{
        fontSize: 8,
        textTransform: 'uppercase',
        letterSpacing: '0.15em',
        color: 'var(--stone-light)',
        fontFamily: 'var(--font-mono)',
      }}
    >
      Prev
    </span>
  </div>
));

GhostIndicator.displayName = 'GhostIndicator';

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
    const isGhostValue = !value && showGhost && ghostValue;

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

    const accent = accentColor || 'var(--navy)';

    return (
      <div
        style={{
          position: 'relative',
          display: 'flex',
          flexDirection: 'column',
          background: 'var(--bone)',
          border: '2px solid var(--navy)',
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
        {/* Header Row - Icon and Ghost */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'flex-end',
            padding: 12,
            position: 'relative',
          }}
        >
          {icon && (
            <div
              style={{
                width: 40,
                height: 40,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'var(--mustard)',
              }}
            >
              {icon}
            </div>
          )}
          {isGhostValue && <GhostIndicator />}
        </div>

        {/* Content */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            flex: 1,
            paddingLeft: 16,
            paddingRight: 16,
            paddingBottom: 20,
          }}
        >
          {/* Label */}
          <span
            style={{
              fontSize: 10,
              textTransform: 'uppercase',
              letterSpacing: '0.25em',
              fontWeight: 600,
              color: accent,
              fontFamily: 'var(--font-mono)',
              marginBottom: 8,
            }}
          >
            {label}
          </span>

          {/* Value */}
          <div style={{ position: 'relative' }}>
            <AnimatedNumber
              value={displayValue}
              isGhost={!!isGhostValue}
              className=""
              style={{
                fontFamily: 'var(--font-display)',
                fontWeight: 900,
                fontSize: 70,
                lineHeight: 1,
                letterSpacing: '-0.03em',
                color: isGhostValue ? 'var(--stone-light)' : 'var(--navy)',
                direction: 'ltr',
              }}
            />
            {unit && (
              <span
                style={{
                  position: 'absolute',
                  bottom: 4,
                  right: 0,
                  transform: 'translateX(100%)',
                  marginLeft: 8,
                  fontSize: 14,
                  fontFamily: 'var(--font-mono)',
                  color: 'var(--stone)',
                  fontWeight: 500,
                }}
              >
                {unit}
              </span>
            )}
          </div>

          {/* Quick Buttons */}
          {showButtons && (
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                width: '100%',
                marginTop: 20,
                gap: 8,
              }}
              onPointerDown={(e) => e.stopPropagation()}
            >
              <button
                type="button"
                onClick={handleDecrement}
                style={{
                  flex: 1,
                  padding: '16px 0',
                  background: 'var(--bone-deep)',
                  border: '2px solid var(--navy)',
                  fontFamily: 'var(--font-display)',
                  fontWeight: 800,
                  fontSize: 24,
                  color: 'var(--navy)',
                  cursor: 'pointer',
                  transition: 'all 100ms ease',
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
                style={{
                  flex: 1,
                  padding: '16px 0',
                  background: 'var(--mustard)',
                  border: '2px solid var(--navy)',
                  fontFamily: 'var(--font-display)',
                  fontWeight: 800,
                  fontSize: 24,
                  color: 'var(--navy)',
                  cursor: 'pointer',
                  transition: 'all 100ms ease',
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
          <span
            style={{
              marginTop: 16,
              fontSize: 9,
              fontFamily: 'var(--font-mono)',
              textTransform: 'uppercase',
              letterSpacing: '0.15em',
              color: 'var(--stone-light)',
            }}
          >
            Step {incrementAmount}
          </span>
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
                background: 'var(--mustard)',
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

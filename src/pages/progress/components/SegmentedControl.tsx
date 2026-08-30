// ============================================================================
// SegmentedControl — secondary in-tab navigation (Workouts: history/strength,
// Body: weight/measurements).
// ============================================================================
// Apple-alignment pass. What changed and why:
//   • Targets were 32px tall. HIG asks for 44px, and this control is used
//     mid-workout with sweaty hands — the hit area is now a real 44px, not a
//     44px comment above a 32px button.
//   • ArrowRight always advanced the index. In an RTL layout ArrowRight moves
//     visually toward the PREVIOUS segment, so keyboard navigation felt
//     inverted; direction now drives the delta.
//   • Selection was silent. A single 'selection' haptic now fires on an actual
//     change (never on re-selecting the current segment, and never on mere
//     focus movement).
//   • The active pill was a background swap. It now slides between segments as
//     one shared element with an iOS-like spring (400/30/1), which is what makes
//     the control read as a physical switch rather than two buttons.
// ============================================================================

import { m } from 'framer-motion';
import type React from 'react';
import { memo, useCallback, useId } from 'react';
import { useIsRTL } from '../../../hooks/useIsRTL';
import { useReducedMotion } from '../../../hooks/useReducedMotion';
import { triggerHapticEffect } from '../../../utils/haptics';

export interface SegmentOption<T extends string> {
  key: T;
  label: string;
}

interface SegmentedControlProps<T extends string> {
  options: readonly SegmentOption<T>[];
  value: T;
  onChange: (next: T) => void;
  /** Accessible label for the tablist. */
  ariaLabel: string;
  /** Stable prefix for the tab/panel ids. */
  idPrefix: string;
}

/** iOS-like settle: fast to arrive, no visible overshoot on a small control. */
const INDICATOR_SPRING = { type: 'spring', stiffness: 400, damping: 30, mass: 1 } as const;

/**
 * Where a horizontal arrow key should move a roving-tabindex tablist, resolved by
 * VISUAL direction: in RTL, ArrowLeft advances and ArrowRight goes back. Wraps at
 * both ends.
 *
 * Returns `null` when the key is not a horizontal arrow (or the list is empty) —
 * the caller must then leave the event alone rather than preventDefault it.
 *
 * Exported because the page-level tablists (Progress.tsx, Nutrition.tsx) draw a
 * different control but have to step identically. A second copy of this rule is
 * exactly how those two pages shipped LTR-inverted arrow keys.
 */
export function arrowKeyTargetIndex(
  key: string,
  isRTL: boolean,
  currentIndex: number,
  count: number
): number | null {
  if (key !== 'ArrowRight' && key !== 'ArrowLeft') return null;
  if (count <= 0) return null;
  const forward = isRTL ? key === 'ArrowLeft' : key === 'ArrowRight';
  return (currentIndex + (forward ? 1 : -1) + count) % count;
}

export const SegmentedControl = memo(function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  ariaLabel,
  idPrefix,
}: SegmentedControlProps<T>) {
  const isRTL = useIsRTL();
  const reduced = useReducedMotion();
  // Scopes the shared layout animation to this instance, so two segmented
  // controls on one screen do not animate their pills into each other.
  const layoutGroupId = useId();

  const select = useCallback(
    (next: T) => {
      if (next === value) return;
      triggerHapticEffect('selection', 'light');
      onChange(next);
    },
    [onChange, value]
  );

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent, idx: number) => {
      // Visual direction, not index direction: in RTL, ArrowRight goes back.
      const targetIdx = arrowKeyTargetIndex(e.key, isRTL, idx, options.length);
      if (targetIdx === null) return;
      e.preventDefault();
      const next = options[targetIdx];
      if (!next) return;
      select(next.key);
      document.getElementById(`${idPrefix}-tab-${next.key}`)?.focus();
    },
    [options, select, idPrefix, isRTL]
  );

  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      style={{
        display: 'flex',
        gap: 2,
        padding: 4,
        background: 'var(--fs-surface-2)',
        borderRadius: 12,
      }}
    >
      {options.map((opt, idx) => {
        const active = opt.key === value;
        return (
          <button
            type="button"
            key={opt.key}
            role="tab"
            id={`${idPrefix}-tab-${opt.key}`}
            aria-selected={active}
            aria-controls={`${idPrefix}-panel-${opt.key}`}
            tabIndex={active ? 0 : -1}
            onClick={() => select(opt.key)}
            onKeyDown={(e) => onKeyDown(e, idx)}
            className="active:scale-[0.97] motion-reduce:active:scale-100"
            style={{
              position: 'relative',
              flex: 1,
              minHeight: 44,
              border: 'none',
              cursor: 'pointer',
              borderRadius: 10,
              background: 'transparent',
              color: active ? 'var(--fs-ink)' : 'var(--fs-muted)',
              fontFamily: 'var(--font-hebrew)',
              fontSize: 13,
              fontWeight: active ? 600 : 500,
              // Explicit properties only: `transition: all` would also chase
              // layout values the spring below already owns.
              transition: 'color 150ms ease, transform 100ms ease',
            }}
          >
            {active && (
              <m.span
                layoutId={`${layoutGroupId}-segmented-indicator`}
                transition={reduced ? { duration: 0 } : INDICATOR_SPRING}
                aria-hidden="true"
                style={{
                  position: 'absolute',
                  inset: 0,
                  borderRadius: 10,
                  background: 'var(--fs-surface)',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.08), 0 1px 1px rgba(0,0,0,0.04)',
                }}
              />
            )}
            <span style={{ position: 'relative', zIndex: 1 }}>{opt.label}</span>
          </button>
        );
      })}
    </div>
  );
}) as <T extends string>(props: SegmentedControlProps<T>) => React.ReactElement;

export default SegmentedControl;

// ActionChip — compact tool button used across the active-workout exercise
// surface (RPE, plates, notes, undo, edit sets, alternatives, superset).
// Extracted from ExerciseDisplay so every workout surface shares one chip
// vocabulary instead of redefining it inline.
//
// Behavior is identical to the previous inline definition: stops click
// propagation (so taps don't bubble to the card), 44px min target, optional
// label and notification dot, accent fill when active. RTL-correct via logical
// properties (`insetInlineEnd` for the dot).

import type React from 'react';
import { memo } from 'react';

export interface ActionChipProps {
  /** Leading icon (14×14 recommended). */
  icon: React.ReactNode;
  /** Optional text label (Hebrew). Omit for icon-only chips. */
  label?: string;
  /** Press handler. Click propagation is stopped before this runs. */
  onClick: () => void;
  /** Accent-filled active state. */
  active?: boolean;
  /** Accessible label (always required — covers the icon-only case). */
  ariaLabel: string;
  /** Small accent notification dot (e.g. "has notes"). */
  dot?: boolean;
}

/**
 * Compact action chip.
 *
 * @example
 * <ActionChip icon={<Star size={14} />} label="RPE 8" active ariaLabel="בחר RPE" onClick={open} />
 */
const ActionChip = memo<ActionChipProps>(({ icon, label, onClick, active, ariaLabel, dot }) => (
  <button
    type="button"
    onClick={(e) => {
      e.stopPropagation();
      onClick();
    }}
    aria-label={ariaLabel}
    aria-pressed={active}
    className="transition-all active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--fs-accent)] focus-visible:ring-offset-1"
    style={{
      display: 'flex',
      alignItems: 'center',
      gap: 5,
      padding: label ? '7px 12px' : '7px 10px',
      background: active ? 'var(--fs-accent)' : 'var(--fs-surface)',
      border: '1px solid var(--fs-steel)',
      borderRadius: '12px 8px 12px 8px',
      fontFamily: 'var(--font-mono)',
      fontSize: 11,
      fontWeight: 700,
      color: active ? 'var(--fs-primary)' : 'var(--fs-ink)',
      cursor: 'pointer',
      minHeight: 44,
      whiteSpace: 'nowrap',
      position: 'relative',
    }}
  >
    <span style={{ display: 'inline-flex', width: 14, height: 14, flexShrink: 0 }}>{icon}</span>
    {label && <span>{label}</span>}
    {dot && (
      <span
        aria-hidden
        style={{
          position: 'absolute',
          top: 4,
          insetInlineEnd: 4,
          width: 6,
          height: 6,
          background: 'var(--fs-accent)',
          borderRadius: '50%',
        }}
      />
    )}
  </button>
));

ActionChip.displayName = 'ActionChip';

export default ActionChip;

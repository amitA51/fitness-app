// ActionChip — compact tool button used across the active-workout exercise surface.

import type React from 'react';
import { memo } from 'react';

export interface ActionChipProps {
  icon: React.ReactNode;
  label?: string;
  onClick: () => void;
  active?: boolean;
  ariaLabel: string;
  dot?: boolean;
}

const ActionChip = memo<ActionChipProps>(({ icon, label, onClick, active, ariaLabel, dot }) => (
  <button
    type="button"
    onClick={(e) => {
      e.stopPropagation();
      onClick();
    }}
    aria-label={ariaLabel}
    aria-pressed={active}
    className="transition-ui active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--fs-accent)] focus-visible:ring-offset-1"
    style={{
      display: 'flex',
      alignItems: 'center',
      // Centres the glyph in an icon-only chip once minWidth pads it out to 44px;
      // a no-op on labelled chips, whose content already fills the box.
      justifyContent: 'center',
      gap: 6,
      padding: label ? '8px 14px' : '8px 12px',
      background: active ? 'var(--fs-accent)' : 'var(--fs-surface)',
      border: active
        ? 'none'
        : '1px solid color-mix(in srgb, var(--color-border) 90%, transparent)',
      borderRadius: 9999,
      fontFamily: 'var(--font-body)',
      fontSize: 13,
      fontWeight: 600,
      letterSpacing: '-0.01em',
      color: active ? 'var(--color-ink-on-accent)' : 'var(--fs-ink)',
      cursor: 'pointer',
      minHeight: 44,
      // An icon-only chip is 12 + 14 + 12 + 2px of border = 40px wide, i.e. under
      // the 44px touch floor the rest of this surface holds to. Pad it out.
      minWidth: label ? undefined : 44,
      // The chip row is a horizontal scroller. Without this the chips inherit
      // flex-shrink: 1, so an overflowing row takes the deficit out of their
      // padding boxes while `nowrap` keeps the label at full width — the text
      // then paints outside its own box and the scroller clips it, which is what
      // sliced the final ם off "כלים" (measured 2.97px past the row's end edge).
      // Chips must keep their intrinsic width and let the row scroll instead.
      flexShrink: 0,
      // Resting scroll offsets land on a chip's start edge, so a chip is never
      // parked half-off the leading edge of the row.
      scrollSnapAlign: 'start',
      whiteSpace: 'nowrap',
      position: 'relative',
      boxShadow: active
        ? '0 4px 12px color-mix(in srgb, var(--fs-accent) 24%, transparent)'
        : 'var(--elevation-1)',
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
          background: active ? 'var(--color-ink-on-accent)' : 'var(--fs-accent)',
          borderRadius: '50%',
        }}
      />
    )}
  </button>
));

ActionChip.displayName = 'ActionChip';

export default ActionChip;

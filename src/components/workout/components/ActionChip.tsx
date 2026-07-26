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

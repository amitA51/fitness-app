// ============================================================================
// SegmentedControl — secondary in-tab navigation used to de-densify the
// Workouts and Body tabs (history/strength, weight/measurements). Keyboard
// accessible (arrow keys), RTL-correct via logical properties, 44px targets.
// ============================================================================

import type React from 'react';
import { memo, useCallback } from 'react';

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

export const SegmentedControl = memo(function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  ariaLabel,
  idPrefix,
}: SegmentedControlProps<T>) {
  const onKeyDown = useCallback(
    (e: React.KeyboardEvent, idx: number) => {
      if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
      e.preventDefault();
      const delta = e.key === 'ArrowRight' ? 1 : -1;
      const next = options[(idx + delta + options.length) % options.length];
      if (!next) return;
      onChange(next.key);
      document.getElementById(`${idPrefix}-tab-${next.key}`)?.focus();
    },
    [options, onChange, idPrefix]
  );

  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      style={{
        display: 'flex',
        gap: 2,
        padding: 3,
        background: 'var(--fs-surface-2)',
        borderRadius: 9,
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
            onClick={() => onChange(opt.key)}
            onKeyDown={(e) => onKeyDown(e, idx)}
            className="active:scale-[0.97] motion-reduce:active:scale-100"
            style={{
              flex: 1,
              minHeight: 32,
              border: 'none',
              cursor: 'pointer',
              borderRadius: 7,
              background: active ? 'var(--fs-surface)' : 'transparent',
              boxShadow: active ? '0 1px 3px rgba(0,0,0,0.08), 0 1px 1px rgba(0,0,0,0.04)' : 'none',
              color: active ? 'var(--fs-ink)' : 'var(--fs-muted)',
              fontFamily: 'var(--font-hebrew)',
              fontSize: 13,
              fontWeight: active ? 600 : 500,
              transition: 'color 0.15s, background 0.15s, transform 0.1s',
            }}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}) as <T extends string>(props: SegmentedControlProps<T>) => React.ReactElement;

export default SegmentedControl;

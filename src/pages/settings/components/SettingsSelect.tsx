import { ChevronLeft, ChevronRight } from 'lucide-react';
import type React from 'react';
import { useId } from 'react';
import { useIsRTL } from '../../../hooks/useIsRTL';
import { Divider } from './Divider';
import { IconBox } from './IconBox';

/**
 * A settings row whose control is a single-select dropdown. Replaces the three
 * hand-rolled "transparent overlay `<select>` + chevron + display label"
 * blocks ProfileSection used to repeat for gender / weight-goal / activity.
 *
 * Accessibility: the native `<select>` stays in the DOM (just visually hidden
 * over the row) so keyboard and screen-reader users get the real control; the
 * visible label/chevron are `aria-hidden`. The row min-height (52px) plus the
 * full-bleed `<select>` overlay give a touch target well over 44px.
 *
 * RTL: the chevron mirrors via {@link useIsRTL} (ChevronLeft in RTL, the
 * Hebrew-first default; ChevronRight in LTR) so it always points "forward".
 *
 * Generic over the option value so callers keep their string-literal unions
 * (Gender / WeightGoal / ActivityLevel) instead of widening to `string`.
 */
interface SettingsSelectProps<T extends string> {
  value: T;
  options: ReadonlyArray<{ value: T; label: string }>;
  onChange: (value: T) => void;
  label: string;
  icon: React.ReactNode;
  /** Render a hairline divider beneath the row. Defaults to true. */
  divider?: boolean;
}

export function SettingsSelect<T extends string>({
  value,
  options,
  onChange,
  label,
  icon,
  divider = true,
}: SettingsSelectProps<T>) {
  const isRTL = useIsRTL();
  const selectId = useId();
  const Chevron = isRTL ? ChevronLeft : ChevronRight;

  const displayLabel = options.find((o) => o.value === value)?.label ?? options[0]?.label ?? '';

  return (
    <div className="flex flex-col">
      <div className="flex items-center gap-3 ps-4 pe-4 py-3.5 min-h-[52px]">
        <IconBox>{icon}</IconBox>
        <label
          htmlFor={selectId}
          className="flex-1"
          style={{
            fontFamily: 'var(--font-hebrew)',
            fontSize: '15px',
            fontWeight: 500,
            color: 'var(--fs-ink)',
            cursor: 'pointer',
          }}
        >
          {label}
        </label>
        <div className="relative flex items-center gap-1">
          <span
            aria-hidden="true"
            style={{
              fontFamily: 'var(--font-hebrew)',
              fontSize: '14px',
              color: 'var(--fs-heading)',
              fontWeight: 600,
            }}
          >
            {displayLabel}
          </span>
          <Chevron size={14} aria-hidden="true" style={{ color: 'var(--fs-muted)' }} />
          <select
            id={selectId}
            value={value}
            onChange={(e) => onChange(e.target.value as T)}
            aria-label={label}
            className="absolute inset-0 opacity-0 w-full h-full cursor-pointer"
          >
            {options.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      </div>
      {divider && <Divider />}
    </div>
  );
}

export default SettingsSelect;

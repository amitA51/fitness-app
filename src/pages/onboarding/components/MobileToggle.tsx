import { memo, useId } from 'react';
import ToggleSwitch from '../../../components/ui/ToggleSwitch';

export interface MobileToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  description?: string;
}

/**
 * Onboarding preference row: a title + optional description on the inline-start,
 * a real accessible {@link ToggleSwitch} (role="switch", keyboard, RTL-aware) on
 * the inline-end. Replaces the former color-changing `<button>` that had no
 * switch semantics. The title is a `<label htmlFor>` bound to the switch, so the
 * whole text region toggles on click and gives the control its accessible name.
 */
export const MobileToggle = memo(function MobileToggle({
  checked,
  onChange,
  label,
  description,
}: MobileToggleProps) {
  const switchId = useId();

  return (
    <div
      className="w-full flex items-center justify-between gap-4 p-4"
      style={{
        background: checked ? 'var(--fs-surface-2)' : 'var(--fs-surface)',
        border: checked ? '2px solid var(--fs-accent)' : '1px solid var(--fs-surface-2)',
        borderRadius: 'var(--radius-card)',
        minHeight: '72px',
        transition: 'background 0.2s, border-color 0.2s',
      }}
    >
      <label
        htmlFor={switchId}
        className="flex-1 min-w-0 cursor-pointer"
        style={{ textAlign: 'start' }}
      >
        <span
          className="block"
          style={{
            fontFamily: 'var(--font-body)',
            fontWeight: 600,
            fontSize: '16px',
            color: 'var(--fs-ink)',
          }}
        >
          {label}
        </span>
        {description && (
          <span
            className="block"
            style={{
              fontFamily: 'var(--font-body)',
              fontSize: '14px',
              color: 'var(--fs-muted)',
              marginTop: '2px',
            }}
          >
            {description}
          </span>
        )}
      </label>

      <ToggleSwitch id={switchId} checked={checked} onChange={onChange} size="lg" />
    </div>
  );
});

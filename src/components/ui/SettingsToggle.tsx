/** iOS-style toggle switch — 32px visual track centered in a ≥44px tap area */
import { triggerHaptic } from '../../utils/haptics';

interface SettingsToggleProps {
  checked: boolean;
  onChange: () => void;
  label: string;
  /** Renders the toggle in a visually dimmed, non-interactive state */
  disabled?: boolean;
}

export function SettingsToggle({
  checked,
  onChange,
  label,
  disabled = false,
}: SettingsToggleProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-label={label}
      aria-checked={checked}
      aria-disabled={disabled || undefined}
      onClick={
        disabled
          ? undefined
          : () => {
              triggerHaptic('light'); // meaningful snap on the deliberate toggle
              onChange();
            }
      }
      className="focus-visible:ring-2 focus-visible:ring-[var(--fs-accent)] focus-visible:outline-none"
      style={{
        // Tap target ≥44×44 (a11y); the visual track inside stays ~32px tall.
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        minWidth: '44px',
        minHeight: '44px',
        flexShrink: 0,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.4 : 1,
        background: 'transparent',
        border: 'none',
        padding: 0,
      }}
    >
      <span
        aria-hidden="true"
        style={{ position: 'relative', display: 'inline-block', width: '52px', height: '32px' }}
      >
        <span
          style={{
            position: 'absolute',
            inset: 0,
            background: checked ? 'var(--fs-accent)' : 'var(--fs-surface-2)',
            border: '2px solid var(--fs-primary)',
            borderRadius: 0,
            transition: 'background 150ms ease',
          }}
        />
        <span
          style={{
            position: 'absolute',
            top: '4px',
            insetInlineStart: checked ? '24px' : '4px',
            width: '24px',
            height: '24px',
            background: checked ? 'var(--fs-surface)' : 'var(--fs-primary)',
            borderRadius: '50%',
            transition: 'inset-inline-start 200ms cubic-bezier(0.25, 0.46, 0.45, 0.94)',
            pointerEvents: 'none',
          }}
        />
      </span>
      <style>{`@media (prefers-reduced-motion: reduce) { button[role="switch"] span { transition: none !important; } }`}</style>
    </button>
  );
}

export default SettingsToggle;

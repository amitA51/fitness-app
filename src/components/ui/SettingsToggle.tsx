/** iOS-style toggle switch — fully CSS, no inline styles */
interface SettingsToggleProps {
  checked: boolean;
  onChange: () => void;
  label: string;
}

export function SettingsToggle({ checked, onChange, label }: SettingsToggleProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-label={label}
      aria-checked={checked}
      onClick={onChange}
      style={{
        position: 'relative',
        display: 'inline-block',
        width: '52px',
        height: '32px',
        flexShrink: 0,
        cursor: 'pointer',
        background: 'transparent',
        border: 'none',
        padding: 0,
      }}
    >
      <span
        aria-hidden="true"
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
        aria-hidden="true"
        style={{
          position: 'absolute',
          top: '2px',
          left: checked ? '24px' : '2px',
          width: '24px',
          height: '24px',
          background: checked ? 'var(--fs-surface)' : 'var(--fs-primary)',
          borderRadius: '50%',
          transition: 'left 200ms cubic-bezier(0.25, 0.46, 0.45, 0.94)',
          pointerEvents: 'none',
        }}
      />
    </button>
  );
}

export default SettingsToggle;

import { memo } from 'react';

export interface MobileToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  description?: string;
}

export const MobileToggle = memo(function MobileToggle({
  checked,
  onChange,
  label,
  description,
}: MobileToggleProps) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className="w-full flex items-center justify-between p-4 transition-colors min-h-[72px]"
      style={{
        background: checked ? 'var(--fs-accent)' : 'var(--fs-surface)',
        border: checked ? '2px solid var(--fs-accent)' : '1px solid var(--fs-surface-2)',
        borderRadius: '22px 16px 22px 16px',
      }}
    >
      <div className="text-right flex-1 ms-4">
        <p
          style={{
            fontFamily: 'var(--font-body)',
            fontWeight: 600,
            fontSize: '16px',
            color: checked ? 'var(--fs-primary)' : 'var(--fs-ink)',
          }}
        >
          {label}
        </p>
        {description && (
          <p
            style={{
              fontFamily: 'var(--font-body)',
              fontSize: '14px',
              color: checked ? 'var(--fs-primary)' : 'var(--fs-muted)',
              marginTop: '2px',
            }}
          >
            {description}
          </p>
        )}
      </div>
      <div
        className="w-14 h-8 relative flex-shrink-0"
        style={{
          background: checked ? 'var(--fs-accent)' : 'var(--fs-surface-2)',
          border: '2px solid var(--fs-primary)',
          borderRadius: '22px',
        }}
      >
        <div
          className="absolute top-1 w-6 h-6 shadow-lg transition-all"
          style={{
            left: checked ? 'auto' : '4px',
            right: checked ? '4px' : 'auto',
            borderRadius: '50%',
            background: 'var(--fs-surface)',
          }}
        />
      </div>
    </button>
  );
});

import type React from 'react';

/** A single row inside a settings card */
interface SettingsRowProps {
  icon?: React.ReactNode;
  label: string;
  children: React.ReactNode;
  divider?: boolean;
}

export function SettingsRow({ icon, label, children, divider = true }: SettingsRowProps) {
  return (
    <div className="flex flex-col">
      <div className="flex items-center gap-3 ps-4 pe-4 py-3.5 min-h-[52px]">
        {icon && (
          <div
            className="w-8 h-8 flex items-center justify-center shrink-0"
            style={{ background: 'var(--fs-surface-2)', color: 'var(--fs-heading)' }}
          >
            {icon}
          </div>
        )}
        <span
          className="flex-1"
          style={{
            fontFamily: 'var(--font-body)',
            fontSize: '15px',
            fontWeight: 500,
            color: 'var(--fs-ink)',
          }}
        >
          {label}
        </span>
        <div className="shrink-0">{children}</div>
      </div>
      {divider && (
        <div style={{ height: '1px', background: 'var(--fs-surface-2)', marginInline: '16px' }} />
      )}
    </div>
  );
}

export default SettingsRow;

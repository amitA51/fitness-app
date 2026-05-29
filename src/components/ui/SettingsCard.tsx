import type React from 'react';

/** Editorial settings card wrapper */
export function SettingsCard({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="overflow-hidden magnetic-card glass-surface fs-accent-rail"
      style={{
        background: 'var(--fs-surface)',
        border: '1px solid var(--fs-surface-2)',
        borderRadius: '22px 16px 22px 16px',
        boxShadow: 'var(--shadow-card)',
      }}
    >
      {children}
    </div>
  );
}

export default SettingsCard;

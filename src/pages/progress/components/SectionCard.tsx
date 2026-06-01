// ============================================================================
// SectionCard — the asymmetric, accent-railed surface every Progress section
// repeats. One definition replaces the inline `cardStyle` + rail `<div>` that
// was copy-pasted across the weight/measurements/recovery/strength tabs.
// ============================================================================

import type React from 'react';
import { memo } from 'react';

interface SectionCardProps {
  children: React.ReactNode;
  /** Render the accent rail on the inline-start edge (default true). */
  rail?: boolean;
  className?: string;
  style?: React.CSSProperties;
}

export const SectionCard = memo(function SectionCard({
  children,
  rail = true,
  className,
  style,
}: SectionCardProps) {
  return (
    <div
      className={className}
      style={{
        background: 'var(--fs-surface)',
        borderRadius: 'var(--radius-asymmetric)',
        border: '1px solid var(--fs-surface-2)',
        boxShadow: 'var(--shadow-card)',
        padding: 16,
        position: 'relative',
        overflow: 'hidden',
        ...style,
      }}
    >
      {rail && (
        <div
          aria-hidden="true"
          style={{
            position: 'absolute',
            insetInlineStart: 0,
            top: 0,
            bottom: 0,
            width: 4,
            background: 'var(--fs-accent)',
            borderStartStartRadius: 'var(--radius-asymmetric)',
            borderEndStartRadius: 'var(--radius-asymmetric)',
          }}
        />
      )}
      {children}
    </div>
  );
});

export default SectionCard;

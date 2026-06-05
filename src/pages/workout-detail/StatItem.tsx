/**
 * StatItem — single stat tile in the WorkoutDetail stats grid.
 */

import { TrendingDown, TrendingUp } from 'lucide-react';

interface StatItemProps {
  icon: React.ReactNode;
  label: string;
  value: string;
  subValue?: string;
  trend?: 'up' | 'down' | 'neutral';
}

export function StatItem({ icon, label, value, subValue, trend }: StatItemProps) {
  return (
    <div
      style={{
        flex: 1,
        background: 'var(--fs-surface)',
        borderRadius: '22px 16px 22px 16px',
        border: '1px solid var(--color-border)',
        boxShadow: 'var(--shadow-card)',
        padding: 12,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        textAlign: 'center',
        minWidth: 0,
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          position: 'absolute',
          insetInlineStart: 0,
          top: 0,
          bottom: 0,
          width: 3,
          background: 'var(--fs-accent)',
          borderStartStartRadius: '22px',
          borderEndStartRadius: '16px',
        }}
      />
      <div
        style={{
          width: 28,
          height: 28,
          borderRadius: '50%',
          background: 'var(--fs-bg)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: 8,
        }}
      >
        {icon}
      </div>
      <p
        dir="ltr"
        style={{
          fontSize: 18,
          fontWeight: 700,
          fontFamily: 'var(--font-mono)',
          color: 'var(--fs-ink)',
          lineHeight: 1,
          fontVariantNumeric: 'tabular-nums',
          display: 'flex',
          alignItems: 'center',
          gap: 4,
        }}
      >
        {value}
        {trend === 'up' && <TrendingUp size={12} style={{ color: 'var(--color-success-fg)' }} />}
        {trend === 'down' && <TrendingDown size={12} style={{ color: 'var(--color-error-fg)' }} />}
      </p>
      <p
        style={{
          fontSize: 9,
          fontFamily: 'var(--font-mono)',
          color: 'var(--fs-muted)',
          marginTop: 4,
          lineHeight: 1,
        }}
      >
        {label}
      </p>
      {subValue && (
        <p
          style={{
            fontSize: 9,
            fontFamily: 'var(--font-mono)',
            color: 'var(--fs-muted)',
            marginTop: 2,
          }}
        >
          {subValue}
        </p>
      )}
    </div>
  );
}

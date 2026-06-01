import { m } from 'framer-motion';
import { memo, useMemo } from 'react';

export const RecoveryBar = memo(function RecoveryBar({
  label,
  value,
  max,
  color,
}: { label: string; value: number; max: number; color: string }) {
  const pct = useMemo(() => Math.round((value / max) * 100), [value, max]);
  return (
    <div>
      <div className="flex items-center justify-between text-xs mb-1.5">
        <span className="font-semibold" style={{ color: 'var(--fs-muted)' }}>
          {label}
        </span>
        <span className="font-semibold" style={{ color }}>
          {value}/{max}
        </span>
      </div>
      <div
        style={{
          height: 6,
          background: 'var(--fs-surface-2)',
          borderRadius: '9999px',
          overflow: 'hidden',
        }}
      >
        <m.div
          style={{ height: '100%', borderRadius: '9999px', backgroundColor: color }}
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.6 }}
        />
      </div>
    </div>
  );
});

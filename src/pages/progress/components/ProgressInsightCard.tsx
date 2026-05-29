import { Sparkles } from 'lucide-react';
import { memo, useMemo } from 'react';
import type { WorkoutSession } from '../../../types';
import { formatVolume } from '../../../utils/dateUtils';

export const ProgressInsightCard = memo(function ProgressInsightCard({
  sessions,
}: { sessions: WorkoutSession[] }) {
  const { completedCount, totalVolume, totalPRs } = useMemo(() => {
    let cc = 0;
    let tv = 0;
    let tp = 0;
    for (const s of sessions) {
      if (s.status === 'completed') cc += 1;
      tv += s.totalVolume || 0;
      if (s.rating && s.rating >= 4) tp += 1;
    }
    return { completedCount: cc, totalVolume: tv, totalPRs: tp };
  }, [sessions]);

  if (completedCount === 0) return null;

  return (
    <div
      style={{
        background: 'var(--fs-surface)',
        borderRadius: '22px 16px 22px 16px',
        border: '1px solid var(--fs-surface-2)',
        boxShadow: 'var(--shadow-card)',
        padding: '16px',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        <Sparkles size={14} style={{ color: 'var(--fs-signal)' }} />
        <span
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 9,
            letterSpacing: '0.2em',
            textTransform: 'uppercase',
            color: 'var(--fs-muted)',
          }}
        >
          תובנה אוטומטית
        </span>
      </div>

      <div
        style={{
          fontFamily: 'var(--font-body)',
          fontSize: 13,
          lineHeight: 1.6,
          color: 'var(--fs-ink)',
        }}
      >
        {completedCount === 1
          ? 'התחלת את המסע! כל אימון מקרב אותך למטרה.'
          : `ביצעת ${completedCount} אימונים עם נפח כולל של ${formatVolume(totalVolume)} ק"ג. ${totalPRs > 0 ? `יש לך ${totalPRs} אימונים מצטיינים! ` : ''}המשך כך!`}
      </div>
    </div>
  );
});

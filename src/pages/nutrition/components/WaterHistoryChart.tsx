import { motion } from 'framer-motion';
import { Droplets } from 'lucide-react';
import { memo } from 'react';

interface WaterHistoryChartProps {
  waterHistory: { date: string; total: number }[];
}

export const WaterHistoryChart = memo(function WaterHistoryChart({
  waterHistory,
}: WaterHistoryChartProps) {
  if (waterHistory.length === 0) return null;

  return (
    <div className="px-5 mt-6">
      <div
        style={{
          border: '2px solid var(--fs-primary)',
          background: 'var(--fs-surface)',
          borderRadius: '22px 16px 22px 16px',
          padding: '18px 16px',
        }}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="section-title flex items-center gap-2">
            <Droplets size={14} />
            היסטוריית מים
          </h3>
        </div>
        <div className="h-28 flex items-end gap-2" role="img" aria-label="היסטוריית שתייה - 7 ימים">
          {waterHistory.map((entry, i) => {
            const maxMl = 2500;
            const heightPct = Math.max(4, (entry.total / maxMl) * 100);
            const isLast = i === waterHistory.length - 1;
            return (
              <div key={entry.date} className="flex-1 flex flex-col items-center gap-1.5">
                <span
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: '9px',
                    color: 'var(--fs-muted)',
                  }}
                >
                  {entry.total > 0 ? `${Math.round(entry.total / 250)}` : ''}
                </span>
                <motion.div
                  className="w-full"
                  style={{
                    backgroundColor: isLast ? 'var(--fs-accent)' : 'var(--fs-surface-2)',
                    border: isLast ? '2px solid var(--fs-primary)' : 'none',
                    minHeight: 4,
                    height: `${heightPct}%`,
                    transformOrigin: 'bottom center',
                  }}
                  initial={{ scaleY: 0 }}
                  animate={{ scaleY: 1 }}
                  transition={{ delay: i * 0.06, duration: 0.5, ease: 'easeOut' }}
                />
                <span
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: '9px',
                    color: 'var(--fs-muted)',
                  }}
                >
                  {new Date(entry.date).toLocaleDateString('he-IL', { day: 'numeric' })}
                </span>
              </div>
            );
          })}
        </div>
        <div className="flex items-center justify-center gap-4 mt-3">
          <span className="eyebrow" style={{ color: 'var(--fs-muted)', fontSize: '10px' }}>
            כוסות · 250 מ״ל · יעד 2500 מ״ל
          </span>
        </div>
      </div>
    </div>
  );
});

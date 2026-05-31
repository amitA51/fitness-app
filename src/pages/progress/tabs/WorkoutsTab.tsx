import { BarChart3 } from 'lucide-react';
import { memo, useMemo } from 'react';
import { GlowAreaChart } from '../../../components/charts';
import type { WorkoutSession } from '../../../types';
import { WorkoutHistoryList } from '../components/WorkoutHistoryList';
import { buildVolumeTrend } from '../progressMetrics';

export const WorkoutsTab = memo(function WorkoutsTab({
  sessions,
}: {
  sessions: WorkoutSession[];
}) {
  const volumeData = useMemo(() => buildVolumeTrend(sessions), [sessions]);

  return (
    <div className="space-y-4">
      {/* Chapter break */}
      <div className="chapter-break" style={{ marginInline: 'calc(-1 * var(--space-5))' }}>
        <span className="left" />
        <span
          className="right"
          style={{
            fontFamily: 'var(--font-display)',
            fontWeight: 700,
            fontSize: 16,
            color: 'var(--fs-ink)',
          }}
        >
          אימונים
        </span>
      </div>

      {/* Volume trajectory — glow area chart */}
      {volumeData.length >= 3 && (
        <div
          className="magnetic-card glass-surface scrim-noise fs-accent-rail"
          style={{
            padding: 16,
            borderRadius: '22px 16px 22px 16px',
          }}
        >
          <div
            className="flex items-center gap-2"
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: 14,
              fontWeight: 700,
              color: 'var(--fs-ink)',
              marginBottom: 10,
            }}
          >
            <BarChart3 size={14} style={{ color: 'var(--fs-accent)' }} />
            מגמת נפח
          </div>
          <GlowAreaChart data={volumeData} height={160} xAxis />
        </div>
      )}

      {/* Workout history */}
      <div>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            marginBottom: 12,
          }}
        >
          <div style={{ flex: 1, height: 1, background: 'var(--fs-surface-2)' }} />
          <span
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 9,
              letterSpacing: '0.2em',
              textTransform: 'uppercase',
              color: 'var(--fs-muted)',
            }}
          >
            היסטוריית אימונים
          </span>
          <div style={{ flex: 1, height: 1, background: 'var(--fs-surface-2)' }} />
        </div>
        <WorkoutHistoryList sessions={sessions} />
      </div>
    </div>
  );
});

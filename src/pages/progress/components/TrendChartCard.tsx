// ============================================================================
// TrendChartCard — the ONE trend-chart surface for Progress.
// ============================================================================
// Progress previously mixed three chart styles: GlowAreaChart (workouts volume),
// a hand-rolled SVG line chart (strength curve), and a CSS bar chart (weight).
// We converge on GlowAreaChart everywhere. This card wraps it with the standard
// titled header (icon + title + optional meta) so every trend reads identically.

import { BarChart3 } from 'lucide-react';
import type React from 'react';
import { memo } from 'react';
import { GlowAreaChart, type GlowAreaPoint } from '../../../components/charts/GlowAreaChart';

interface TrendChartCardProps {
  title: string;
  data: GlowAreaPoint[];
  /** Optional right-aligned meta line (e.g. "12 נקודות מידע"). */
  meta?: string;
  icon?: React.ReactNode;
  height?: number;
  ariaLabel?: string;
  /** Unit suffix shown in the scrub callout (e.g. "kg"). */
  valueUnit?: string;
}

export const TrendChartCard = memo(function TrendChartCard({
  title,
  data,
  meta,
  icon,
  height = 170,
  ariaLabel,
  valueUnit,
}: TrendChartCardProps) {
  return (
    <div
      className="magnetic-card glass-surface scrim-noise fs-accent-rail"
      style={{ padding: 16, borderRadius: 'var(--radius-asymmetric)' }}
    >
      <div className="flex items-center justify-between" style={{ marginBottom: 10, gap: 8 }}>
        <div
          className="flex items-center gap-2"
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: 14,
            fontWeight: 700,
            color: 'var(--fs-ink)',
          }}
        >
          {icon ?? <BarChart3 size={14} style={{ color: 'var(--fs-accent)' }} />}
          {title}
        </div>
        {meta && (
          <span
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 10,
              letterSpacing: '-0.01em',
              color: 'var(--fs-muted)',
            }}
          >
            {meta}
          </span>
        )}
      </div>
      <GlowAreaChart
        data={data}
        height={height}
        xAxis
        interactive
        valueUnit={valueUnit}
        ariaLabel={ariaLabel ?? title}
      />
    </div>
  );
});

export default TrendChartCard;

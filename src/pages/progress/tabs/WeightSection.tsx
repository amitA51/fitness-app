// ============================================================================
// WeightSection — weight sub-area of the Body tab (was WeightTab).
// ============================================================================
// The bespoke CSS bar chart is replaced with the converged GlowAreaChart, so
// the weight trend reads identically to every other Progress trend. Hero stat,
// BMI badge, and the trailing-window strip are preserved.

import { Minus, Plus, Scale, TrendingDown, TrendingUp } from 'lucide-react';
import { memo, useMemo } from 'react';
import type { GlowAreaPoint } from '../../../components/charts';
import type { BodyWeightEntry, WeightTrend } from '../../../services/bodyStatsService';
import { zoneColor } from '../../../utils/zoneColor';
import { SectionCard } from '../components/SectionCard';
import { TrendChartCard } from '../components/TrendChartCard';

export const WeightSection = memo(function WeightSection({
  latestWeight,
  weightTrend,
  bmi,
  bmiCategory,
  weightEntries,
  onAdd,
}: {
  latestWeight: BodyWeightEntry | null;
  weightTrend: WeightTrend | null;
  bmi: number | null;
  bmiCategory: { label: string; color: string } | null;
  weightEntries: BodyWeightEntry[];
  onAdd: () => void;
}) {
  const trendPoints = useMemo<GlowAreaPoint[]>(
    () =>
      [...weightEntries]
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
        .slice(-14)
        .map((entry) => ({
          x: new Date(entry.date).toLocaleDateString('he-IL', {
            day: 'numeric',
            month: 'numeric',
          }),
          y: entry.weight,
        })),
    [weightEntries]
  );

  return (
    <div className="space-y-4">
      {/* Hero stat block */}
      {latestWeight ? (
        <SectionCard style={{ padding: 20 }}>
          <span
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 9,
              letterSpacing: '0.18em',
              textTransform: 'uppercase',
              // Neutral data label — graded via the zone vocabulary, not lime.
              // (--fs-signal is reserved for PR celebration.)
              background: zoneColor('neutral'),
              color: 'var(--color-ink-on-dark)',
              padding: '3px 8px',
            }}
          >
            BMI {bmi ?? '—'}
          </span>
          <div
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 9,
              letterSpacing: '0.18em',
              color: 'var(--fs-muted)',
              marginTop: 12,
              textTransform: 'uppercase',
            }}
          >
            משקל נוכחי · CURRENT
          </div>
          <div
            style={{
              fontFamily: 'var(--font-display)',
              fontWeight: 800,
              fontSize: 48,
              color: 'var(--fs-ink)',
              lineHeight: 0.9,
              marginTop: 4,
              direction: 'ltr',
              textAlign: 'start',
            }}
          >
            {latestWeight.weight}
          </div>
          <div
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 10,
              color: 'var(--fs-muted)',
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
            }}
          >
            KG
          </div>
          {bmiCategory && (
            <div
              className="mt-3 inline-block"
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 11,
                letterSpacing: '0.18em',
                textTransform: 'uppercase',
                // Use the category's own semantic color (set in getBMICategory),
                // not lime — --fs-signal is reserved for PR celebration.
                background: 'var(--fs-primary)',
                color: bmiCategory.color,
                padding: '4px 10px',
              }}
            >
              {bmiCategory.label}
            </div>
          )}
        </SectionCard>
      ) : (
        <SectionCard rail={false} style={{ padding: 20 }}>
          <div className="flex flex-col items-center py-8 text-center gap-3">
            <Scale size={32} style={{ color: 'var(--fs-muted)' }} aria-hidden="true" />
            <p
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: 18,
                fontWeight: 800,
                color: 'var(--fs-ink)',
                textTransform: 'uppercase',
              }}
            >
              עדיין לא תועד משקל
            </p>
            <button type="button" onClick={onAdd} className="btn-primary" style={{ minHeight: 44 }}>
              הוסף משקל
            </button>
          </div>
        </SectionCard>
      )}

      {/* Trend data strip */}
      {weightTrend && (
        <div className="data-strip">
          <div>
            <div
              className="val"
              style={{
                color: weightTrend.direction === 'ירידה' ? 'var(--fs-primary)' : 'var(--fs-ink)',
              }}
            >
              {weightTrend.change > 0 ? '+' : ''}
              {weightTrend.change}
              <em>KG</em>
            </div>
            <div className="lbl flex items-center gap-1.5">
              {weightTrend.direction === 'עלייה' && <TrendingUp size={11} aria-hidden="true" />}
              {weightTrend.direction === 'ירידה' && <TrendingDown size={11} aria-hidden="true" />}
              {weightTrend.direction === 'יציב' && <Minus size={11} aria-hidden="true" />}
              {weightTrend.direction}
            </div>
          </div>
          <div>
            <div className="val">
              30<em>D</em>
            </div>
            <div className="lbl">TRAILING WINDOW</div>
          </div>
        </div>
      )}

      {/* Converged trend chart */}
      {trendPoints.length >= 3 && (
        <TrendChartCard title="מגמת משקל" data={trendPoints} ariaLabel="מגמת משקל הגוף לאורך זמן" />
      )}

      {/* Add weight action */}
      {latestWeight && (
        <button
          type="button"
          onClick={onAdd}
          className="btn-primary w-full flex items-center justify-center gap-2"
          style={{ minHeight: 44 }}
        >
          <Plus size={18} aria-hidden="true" />
          הוסף משקל
        </button>
      )}
    </div>
  );
});

export default WeightSection;

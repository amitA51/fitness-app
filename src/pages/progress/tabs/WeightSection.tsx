// ============================================================================
// WeightSection — weight sub-area of the Body tab (was WeightTab).
// ============================================================================
// The bespoke CSS bar chart is replaced with the converged GlowAreaChart, so
// the weight trend reads identically to every other Progress trend. Hero stat,
// BMI badge, and the trailing-window strip are preserved.

import { Minus, Plus, Scale, TrendingDown, TrendingUp } from 'lucide-react';
import { memo, useMemo, useState } from 'react';
import type { GlowAreaPoint } from '../../../components/charts';
import type { BodyWeightEntry, WeightTrend } from '../../../services/bodyStatsService';
import { zoneColor } from '../../../utils/zoneColor';
import { ChartSummary } from '../components/ChartSummary';
import { SectionCard } from '../components/SectionCard';
import { type SegmentOption, SegmentedControl } from '../components/SegmentedControl';
import { TrendChartCard } from '../components/TrendChartCard';
import { DEFAULT_RANGE, RANGE_DAYS, type RangeKey, sliceByRangeDays } from '../progressMetrics';

// Range options for the trend control. Labels are mono kickers (W/M/3M/6M/Y),
// rendered LTR so the Latin shorthand reads correctly inside the RTL layout.
const RANGE_OPTIONS: readonly SegmentOption<RangeKey>[] = [
  { key: 'W', label: 'W' },
  { key: 'M', label: 'M' },
  { key: '3M', label: '3M' },
  { key: '6M', label: '6M' },
  { key: 'Y', label: 'Y' },
];

// Hebrew window names for the trend kicker, one per range.
const RANGE_LABEL_HE: Record<RangeKey, string> = {
  W: 'שבוע',
  M: 'חודש',
  '3M': '3 חודשים',
  '6M': '6 חודשים',
  Y: 'שנה',
};

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
  const [range, setRange] = useState<RangeKey>(DEFAULT_RANGE);

  // Slice the already-loaded entries by the selected date window (no re-fetch),
  // then sort + map to chart points. Replaces the fixed slice(-14) count.
  const trendPoints = useMemo<GlowAreaPoint[]>(
    () =>
      sliceByRangeDays(weightEntries, RANGE_DAYS[range], (e) => e.date)
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
        .map((entry) => ({
          x: new Date(entry.date).toLocaleDateString('he-IL', {
            day: 'numeric',
            month: 'numeric',
          }),
          y: entry.weight,
        })),
    [weightEntries, range]
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
          {/* Hero weight paired with a secondary "change this week" stat so the
              number reads in context rather than alone. */}
          <div
            style={{
              display: 'flex',
              alignItems: 'flex-end',
              justifyContent: 'space-between',
              gap: 16,
              marginTop: 4,
            }}
          >
            <div>
              <div
                style={{
                  fontFamily: 'var(--font-display)',
                  fontWeight: 800,
                  fontSize: 48,
                  color: 'var(--fs-ink)',
                  lineHeight: 0.9,
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
            </div>
            {weightTrend && (
              <div style={{ textAlign: 'end' }}>
                <div
                  className="kinetic-number"
                  dir="ltr"
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontWeight: 800,
                    fontSize: 18,
                    lineHeight: 1,
                    // Weight change is directional, not "good/bad" — keep it neutral
                    // ink (a goal can be either way). Lime stays reserved for PRs.
                    color: 'var(--fs-ink)',
                  }}
                >
                  {weightTrend.change > 0 ? '+' : ''}
                  {weightTrend.change}
                </div>
                <div
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: 9,
                    color: 'var(--fs-muted)',
                    letterSpacing: '0.12em',
                    textTransform: 'uppercase',
                    marginTop: 4,
                  }}
                >
                  {`שינוי · ${weightTrend.direction}`}
                </div>
              </div>
            )}
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

      {/* Trend data strip — the change-this-week stat now lives in the hero
          (item: pair the big number with a secondary stat), so this strip shows
          the complementary context: weekly average + the trailing window. */}
      {weightTrend && (
        <div className="data-strip">
          <div>
            <div className="val" style={{ direction: 'ltr', textAlign: 'start' }}>
              {weightTrend.weeklyAvg}
              <em>KG</em>
            </div>
            <div className="lbl flex items-center gap-1.5">
              {weightTrend.direction === 'עלייה' && <TrendingUp size={11} aria-hidden="true" />}
              {weightTrend.direction === 'ירידה' && <TrendingDown size={11} aria-hidden="true" />}
              {weightTrend.direction === 'יציב' && <Minus size={11} aria-hidden="true" />}
              ממוצע שבועי
            </div>
          </div>
          <div>
            <div className="val" style={{ direction: 'ltr', textAlign: 'start' }}>
              {RANGE_DAYS[range]}
              <em>D</em>
            </div>
            <div className="lbl">חלון מעקב</div>
          </div>
        </div>
      )}

      {/* Converged trend chart — range control + summary-first so the trend
          leads with meaning. The control slices the already-loaded entries by
          date; the chart needs ≥3 points in the chosen window. */}
      {weightEntries.length >= 2 && (
        <div className="space-y-3">
          <SegmentedControl
            options={RANGE_OPTIONS}
            value={range}
            onChange={setRange}
            ariaLabel="טווח זמן למגמת המשקל"
            idPrefix="weight-range"
          />
          {trendPoints.length >= 3 ? (
            <div>
              <ChartSummary
                kicker={`מגמת משקל · ${RANGE_LABEL_HE[range]} · ${trendPoints.length} מדידות`}
              >
                {weightTrend
                  ? weightTrend.direction === 'יציב'
                    ? 'המשקל יציב לאורך התקופה האחרונה.'
                    : `המשקל במגמת ${weightTrend.direction} לאורך התקופה האחרונה.`
                  : 'מעקב אחר מגמת המשקל לאורך זמן.'}
              </ChartSummary>
              <TrendChartCard
                title="מגמת משקל"
                data={trendPoints}
                valueUnit="kg"
                ariaLabel="מגמת משקל הגוף לאורך זמן"
              />
            </div>
          ) : (
            <SectionCard rail={false} style={{ padding: 20 }}>
              <p
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: 11,
                  letterSpacing: '0.1em',
                  textTransform: 'uppercase',
                  color: 'var(--fs-muted)',
                  textAlign: 'center',
                  margin: 0,
                }}
              >
                אין מספיק מדידות בטווח הזה — בחרו טווח רחב יותר
              </p>
            </SectionCard>
          )}
        </div>
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

// ============================================================================
// MeasurementsSection — measurements sub-area of the Body tab (was
// MeasurementsTab). The former duplicate "update" affordance (a header chip
// AND a bottom button, both calling onAdd) is collapsed to a single bottom
// action, parallel to WeightSection.
// ============================================================================

import { Plus, Ruler } from 'lucide-react';
import { memo, useMemo } from 'react';
import type { BodyMeasurement } from '../../../services/bodyStatsService';
import { SectionCard } from '../components/SectionCard';

const MEASUREMENT_LABELS: Record<string, string> = {
  chest: 'חזה',
  waist: 'מותניים',
  hips: 'אגן',
  arms: 'זרועות',
  thighs: 'ירכיים',
  neck: 'צוואר',
};

export const MeasurementsSection = memo(function MeasurementsSection({
  latestMeasurement,
  measurements,
  onAdd,
}: {
  latestMeasurement: BodyMeasurement | null;
  measurements: BodyMeasurement[];
  onAdd: () => void;
}) {
  const prev = useMemo(() => {
    if (measurements.length <= 1) return null;
    const sorted = [...measurements].sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
    );
    return sorted[sorted.length - 2] ?? null;
  }, [measurements]);

  return (
    <div className="space-y-4">
      <SectionCard style={{ padding: 20 }}>
        <h2
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 10,
            letterSpacing: '0.15em',
            color: 'var(--fs-muted)',
            marginBottom: 16,
          }}
        >
          עדכון אחרון · מידות
        </h2>

        {latestMeasurement ? (
          <div>
            {Object.entries(MEASUREMENT_LABELS).map(([key, label]) => {
              const curr = latestMeasurement[key as keyof BodyMeasurement] as number | undefined;
              const prevVal = prev?.[key as keyof BodyMeasurement] as number | undefined;
              const diff = curr && prevVal ? +(curr - prevVal).toFixed(1) : null;
              return (
                <div
                  key={key}
                  className="flex items-center justify-between"
                  style={{ padding: '14px 0', borderBottom: '1px solid var(--fs-surface-2)' }}
                >
                  <span
                    style={{
                      fontFamily: 'var(--font-hebrew)',
                      fontSize: 16,
                      fontWeight: 700,
                      color: 'var(--fs-ink)',
                    }}
                  >
                    {label}
                  </span>
                  <div className="flex items-center gap-3">
                    {diff !== null && diff !== 0 && (
                      // A measurement change is directional, not "good/bad" — a
                      // waist drop is good, a biceps drop is not, so we never
                      // grade it. Neutral ink on the inset surface (matching
                      // WeightSection's deliberate neutral change). Lime stays
                      // reserved for PR celebration.
                      <span
                        style={{
                          fontFamily: 'var(--font-mono)',
                          fontSize: 11,
                          letterSpacing: '-0.01em',
                          color: 'var(--fs-muted)',
                          background: 'var(--fs-surface-2)',
                          padding: '2px 8px',
                          direction: 'ltr',
                        }}
                      >
                        {diff > 0 ? '+' : ''}
                        {diff}
                      </span>
                    )}
                    <span
                      style={{
                        fontFamily: 'var(--font-display)',
                        fontWeight: 600,
                        fontSize: 20,
                        color: 'var(--fs-ink)',
                        direction: 'ltr',
                      }}
                    >
                      {curr ? `${curr}` : '—'}
                    </span>
                    <span className="eyebrow" style={{ color: 'var(--fs-muted)' }}>
                      CM
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="flex flex-col items-center py-10 text-center">
            <Ruler
              size={36}
              style={{ color: 'var(--fs-muted)' }}
              className="mb-3"
              aria-hidden="true"
            />
            <p
              className="mb-5"
              style={{ fontFamily: 'var(--font-hebrew)', fontSize: 16, color: 'var(--fs-ink)' }}
            >
              עדיין לא תועדו מידות
            </p>
            <button type="button" onClick={onAdd} className="btn-primary" style={{ minHeight: 44 }}>
              הוסף מידות ראשונות
            </button>
          </div>
        )}
      </SectionCard>

      {/* Single add action (parallel to WeightSection) */}
      {latestMeasurement && (
        <button
          type="button"
          onClick={onAdd}
          className="btn-primary w-full flex items-center justify-center gap-2"
          style={{ minHeight: 44 }}
        >
          <Plus size={16} aria-hidden="true" />
          הוסף מדידה
        </button>
      )}
    </div>
  );
});

export default MeasurementsSection;

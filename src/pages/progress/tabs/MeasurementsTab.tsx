import { Plus, Ruler } from 'lucide-react';
import { memo, useMemo } from 'react';
import type { BodyMeasurement } from '../../../services/bodyStatsService';

const MEASUREMENT_LABELS: Record<string, string> = {
  chest: 'חזה',
  waist: 'מותניים',
  hips: 'אגן',
  arms: 'זרועות',
  thighs: 'ירכיים',
  neck: 'צוואר',
};

export const MeasurementsTab = memo(function MeasurementsTab({
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
      {/* Chapter break */}
      <div className="chapter-break" style={{ marginInline: 'calc(-1 * var(--space-5))' }}>
        <span className="left">§02 · MEASUREMENTS</span>
        <span className="right">מידות</span>
      </div>

      <div
        style={{
          background: 'var(--fs-surface)',
          borderRadius: '22px 16px 22px 16px',
          border: '1px solid var(--fs-surface-2)',
          boxShadow: 'var(--shadow-card)',
          padding: '20px',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            bottom: 0,
            width: 4,
            background: 'var(--fs-accent)',
            borderTopLeftRadius: '22px',
            borderBottomLeftRadius: '16px',
          }}
        />
        <div className="flex items-center justify-between mb-4">
          <h2
            className="section-title"
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 10,
              letterSpacing: '0.15em',
              color: 'var(--fs-muted)',
              textTransform: 'uppercase',
            }}
          >
            § LATEST UPDATE · עדכון אחרון
          </h2>
          <button
            type="button"
            onClick={onAdd}
            className="chip"
            style={{ background: 'var(--fs-signal)', color: 'var(--fs-heading)' }}
          >
            <Plus size={12} />
            עדכן
          </button>
        </div>

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
                  style={{
                    padding: '14px 0',
                    borderBottom: '1px solid var(--fs-surface-2)',
                  }}
                >
                  <span
                    style={{
                      fontFamily: 'var(--font-hebrew)',
                      fontSize: '16px',
                      fontWeight: 700,
                      color: 'var(--fs-ink)',
                    }}
                  >
                    {label}
                  </span>
                  <div className="flex items-center gap-3">
                    {diff !== null && diff !== 0 && (
                      <span
                        style={{
                          fontFamily: 'var(--font-mono)',
                          fontSize: '11px',
                          letterSpacing: '0.12em',
                          color: diff < 0 ? 'var(--fs-primary)' : 'var(--fs-signal)',
                          background: diff < 0 ? 'var(--fs-signal)' : 'var(--fs-primary)',
                          padding: '2px 8px',
                        }}
                      >
                        {diff > 0 ? '+' : ''}
                        {diff}
                      </span>
                    )}
                    <span
                      style={{
                        fontFamily: 'var(--font-display)',
                        fontWeight: 800,
                        fontSize: '20px',
                        color: 'var(--fs-ink)',
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
            <Ruler size={36} style={{ color: 'var(--fs-muted)' }} className="mb-3" />
            <p
              className="mb-5"
              style={{
                fontFamily: 'var(--font-hebrew)',
                fontSize: '16px',
                color: 'var(--fs-ink)',
              }}
            >
              עדיין לא תיעדת מידות
            </p>
            <button type="button" onClick={onAdd} className="btn-primary">
              הוסף מידות ראשונות
            </button>
          </div>
        )}
      </div>

      {latestMeasurement && (
        <button
          type="button"
          onClick={onAdd}
          className="btn-primary w-full flex items-center justify-center gap-2"
        >
          <Plus size={16} />
          הוסף מדידה
        </button>
      )}
    </div>
  );
});

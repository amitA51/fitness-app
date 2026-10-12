// ============================================================================
// Cardio charts — weekly distance bars and the run-pace trend.
// ============================================================================
// Both are single-series (no legend; the title names the series), draw time
// oldest → newest left-to-right like every other chart in the app, and are
// tappable: each bar / dot is a real button that surfaces its value, so the
// numbers are reachable without hover and by a screen reader.

import { memo, useId, useMemo, useState } from 'react';
import {
  type CardioWeekPoint,
  type PacePoint,
  UNIT_KM,
  formatKm,
  formatPace,
} from '../../../utils/cardio';
import { formatHebrewDate } from '../../../utils/dateUtils';

// ---------------------------------------------------------------------------
// Weekly bars
// ---------------------------------------------------------------------------

interface WeeklyBarsProps {
  weeks: readonly CardioWeekPoint[];
  /** What a bar measures: kilometres, or minutes when no distance exists. */
  measure: 'km' | 'min';
  /** Weekly goal, drawn as a dashed line (km only). */
  goalKm?: number | null;
  title: string;
}

const BAR_AREA = 120;

const weekValue = (w: CardioWeekPoint, measure: 'km' | 'min') =>
  measure === 'km' ? w.distanceKm : Math.round(w.durationSec / 60);

const formatValue = (v: number, measure: 'km' | 'min') =>
  measure === 'km' ? `${formatKm(v)} ${UNIT_KM}` : `${v} דקות`;

export const WeeklyBars = memo(function WeeklyBars({
  weeks,
  measure,
  goalKm,
  title,
}: WeeklyBarsProps) {
  const uid = useId();
  // Selection is by week, not index: a refresh that adds or trims weeks must not
  // leave the label pointing at a different bar.
  const [selectedWeek, setSelectedWeek] = useState<string | null>(null);
  const found = weeks.findIndex((w) => w.weekStart === selectedWeek);
  const selected = found >= 0 ? found : weeks.length - 1;
  const setSelected = (i: number) => setSelectedWeek(weeks[i]?.weekStart ?? null);
  const max = Math.max(
    1,
    ...weeks.map((w) => weekValue(w, measure)),
    measure === 'km' && goalKm ? goalKm : 0
  );
  const sel = weeks[selected];

  return (
    <figure style={{ margin: 0, display: 'grid', gap: 10 }} aria-labelledby={`${uid}-t`}>
      <figcaption
        id={`${uid}-t`}
        style={{
          fontFamily: 'var(--font-display)',
          fontSize: 16,
          fontWeight: 600,
          color: 'var(--fs-heading)',
        }}
      >
        {title}
      </figcaption>
      {sel && (
        <p
          aria-live="polite"
          style={{
            margin: 0,
            fontFamily: 'var(--font-body)',
            fontSize: 14,
            color: 'var(--fs-ink)',
          }}
        >
          {sel.isCurrent ? 'השבוע' : `שבוע של ${formatHebrewDate(sel.weekStart)}`}:{' '}
          {/* Only the number is LTR-isolated; the unit follows it in Hebrew order. */}
          <strong className="kinetic-number">
            {measure === 'km' ? formatKm(weekValue(sel, measure)) : weekValue(sel, measure)}
          </strong>{' '}
          {measure === 'km' ? UNIT_KM : 'דקות'}
          {sel.count > 0 && (
            <span style={{ color: 'var(--fs-muted)' }}>
              {' '}
              · <span className="kinetic-number">{sel.count}</span>{' '}
              {sel.count === 1 ? 'פעילות' : 'פעילויות'}
            </span>
          )}
        </p>
      )}
      <div style={{ position: 'relative', height: BAR_AREA, direction: 'ltr' }}>
        {measure === 'km' && goalKm ? (
          <div
            aria-hidden="true"
            style={{
              position: 'absolute',
              insetInline: 0,
              bottom: (goalKm / max) * BAR_AREA,
              borderTop: '2px dashed var(--fs-muted)',
              opacity: 0.6,
            }}
          />
        ) : null}
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height: '100%' }}>
          {weeks.map((w, i) => {
            const v = weekValue(w, measure);
            const h = v > 0 ? Math.max(4, (v / max) * BAR_AREA) : 2;
            return (
              <button
                key={w.weekStart}
                type="button"
                className="focus-ring"
                aria-label={`${w.isCurrent ? 'השבוע' : `שבוע של ${formatHebrewDate(w.weekStart)}`}: ${formatValue(v, measure)}`}
                aria-pressed={i === selected}
                onClick={() => setSelected(i)}
                style={{
                  flex: 1,
                  height: '100%',
                  minWidth: 0,
                  padding: 0,
                  border: 0,
                  background: 'transparent',
                  display: 'flex',
                  alignItems: 'flex-end',
                  cursor: 'pointer',
                }}
              >
                <span
                  style={{
                    display: 'block',
                    width: '100%',
                    height: h,
                    borderRadius: '4px 4px 0 0',
                    background: w.isCurrent ? 'var(--fs-accent)' : 'var(--fs-accent-2)',
                    opacity: i === selected ? 1 : v > 0 ? 0.75 : 0.35,
                    outline: i === selected ? '2px solid var(--fs-ink)' : 'none',
                    outlineOffset: 1,
                  }}
                />
              </button>
            );
          })}
        </div>
      </div>
      <div
        aria-hidden="true"
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          direction: 'ltr',
          fontFamily: 'var(--font-body)',
          fontSize: 12,
          color: 'var(--fs-muted)',
        }}
      >
        <span dir="rtl">{weeks.length} שבועות</span>
        <span>השבוע</span>
      </div>
    </figure>
  );
});

// ---------------------------------------------------------------------------
// Pace trend
// ---------------------------------------------------------------------------

interface PaceTrendProps {
  points: readonly PacePoint[];
}

const W = 320;
const H = 140;
const PAD = 14;

/** Pace per run, faster = higher, so "up" reads as improvement. */
export const PaceTrend = memo(function PaceTrend({ points }: PaceTrendProps) {
  const uid = useId();
  const [selectedAt, setSelectedAt] = useState<number | null>(null);
  const foundRun = points.findIndex((p) => p.at === selectedAt);
  const selected = foundRun >= 0 ? foundRun : points.length - 1;
  const setSelected = (i: number) => setSelectedAt(points[i]?.at ?? null);
  const geo = useMemo(() => {
    const paces = points.map((p) => p.secPerKm);
    const fastest = Math.min(...paces);
    const slowest = Math.max(...paces);
    // Floor the span at 30 s/km so near-identical runs read as flat.
    const span = Math.max(30, slowest - fastest);
    const mid = (fastest + slowest) / 2;
    const top = mid - span / 2;
    const xy = points.map((p, i) => ({
      x: points.length === 1 ? W / 2 : PAD + (i * (W - 2 * PAD)) / (points.length - 1),
      // faster (smaller) pace → smaller y → higher on screen
      y: PAD + ((p.secPerKm - top) / span) * (H - 2 * PAD),
    }));
    return { xy, fastest, slowest };
  }, [points]);

  const sel = points[selected];

  return (
    <figure style={{ margin: 0, display: 'grid', gap: 10 }} aria-labelledby={`${uid}-t`}>
      <figcaption
        id={`${uid}-t`}
        style={{
          fontFamily: 'var(--font-display)',
          fontSize: 16,
          fontWeight: 600,
          color: 'var(--fs-heading)',
        }}
      >
        קצב בריצות
        <span
          style={{
            display: 'block',
            fontFamily: 'var(--font-body)',
            fontSize: 13,
            fontWeight: 500,
            color: 'var(--fs-muted)',
          }}
        >
          גבוה יותר = מהיר יותר
        </span>
      </figcaption>
      {sel && (
        <p
          aria-live="polite"
          style={{
            margin: 0,
            fontFamily: 'var(--font-body)',
            fontSize: 14,
            color: 'var(--fs-ink)',
          }}
        >
          {formatHebrewDate(sel.date)}:{' '}
          <strong className="kinetic-number">{formatPace(sel.secPerKm)}</strong> דק׳/ק״מ ·{' '}
          <span className="kinetic-number">{formatKm(sel.distanceKm)}</span> {UNIT_KM}
        </p>
      )}
      <div style={{ position: 'relative', height: H }}>
        <svg
          viewBox={`0 0 ${W} ${H}`}
          width="100%"
          height={H}
          preserveAspectRatio="none"
          style={{ position: 'absolute', inset: 0, direction: 'ltr', overflow: 'visible' }}
          aria-hidden="true"
        >
          <line
            x1={PAD}
            x2={W - PAD}
            y1={H - PAD}
            y2={H - PAD}
            stroke="var(--fs-surface-2)"
            strokeWidth={1}
          />
          <path
            d={geo.xy
              .map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
              .join(' ')}
            fill="none"
            stroke="var(--fs-accent-2)"
            strokeWidth={2}
            strokeLinejoin="round"
          />
          {geo.xy.map((p, i) => (
            <circle
              key={points[i]?.at ?? i}
              cx={p.x}
              cy={p.y}
              r={i === selected ? 6 : 4.5}
              fill={i === selected ? 'var(--fs-accent)' : 'var(--fs-accent-2)'}
              stroke="var(--fs-surface)"
              strokeWidth={2}
            />
          ))}
        </svg>
        {/* Tap targets: one invisible button per run, wider than the dot. */}
        <div style={{ position: 'absolute', inset: 0, display: 'flex', direction: 'ltr' }}>
          {points.map((p, i) => (
            <button
              key={p.at}
              type="button"
              className="focus-ring"
              aria-label={`${formatHebrewDate(p.date)}: קצב ${formatPace(p.secPerKm)} דקות לקילומטר, ${formatKm(p.distanceKm)} ${UNIT_KM}`}
              aria-pressed={i === selected}
              onClick={() => setSelected(i)}
              style={{
                flex: 1,
                border: 0,
                padding: 0,
                background: 'transparent',
                cursor: 'pointer',
              }}
            />
          ))}
        </div>
      </div>
      <div
        aria-hidden="true"
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          fontFamily: 'var(--font-body)',
          fontSize: 12,
          color: 'var(--fs-muted)',
        }}
      >
        <span>
          הכי מהיר <span className="kinetic-number">{formatPace(geo.fastest)}</span>
        </span>
        <span>
          הכי איטי <span className="kinetic-number">{formatPace(geo.slowest)}</span>
        </span>
      </div>
    </figure>
  );
});

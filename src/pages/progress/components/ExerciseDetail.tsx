// ============================================================================
// ExerciseDetail — the drill-down for a single exercise (opened from the list).
// ============================================================================
// Everything that used to be stacked on the screen at once lives here now,
// revealed on demand: the honest e1RM hero, a plain-language note on HOW the
// number is derived (the user's core "which set?" question), the converged
// trend curve, the weekly-volume forecast, and a per-session history that spells
// out the top set, working-set count and volume behind each point.

import { ArrowRight, TrendingDown, TrendingUp } from 'lucide-react';
import type React from 'react';
import { memo, useMemo } from 'react';
import {
  GlowAreaChart,
  type GlowAreaMarker,
  type GlowAreaPoint,
} from '../../../components/charts/GlowAreaChart';
import ForecastChart from '../../../components/workout/ForecastChart';
import type { WorkoutSession } from '../../../types';
import { zoneColor } from '../../../utils/zoneColor';
import { STRENGTH_STATUS_LABEL, STRENGTH_STATUS_ZONE } from '../progressMetrics';
import { exerciseLabel, formatDaysAgo } from '../strengthFormat';
import type { ExerciseProgress, StrengthSessionPoint } from '../types';
import { AdvancedSection, SectionCard } from './SectionCard';

/** Most-recent history rows to spell out under the chart. */
const HISTORY_ROWS = 12;
/** Trailing points to plot (keeps the curve legible on a phone). */
const CHART_POINTS = 20;

const kicker: React.CSSProperties = {
  fontFamily: 'var(--font-mono)',
  fontSize: 10,
  letterSpacing: '-0.01em',
  color: 'var(--fs-muted)',
};

interface HistoryRow {
  point: StrengthSessionPoint;
  /** e1RM change vs the chronologically previous point, or null for the first. */
  diff: number | null;
}
interface HistoryMonth {
  label: string;
  rows: HistoryRow[];
}

/** Group the most-recent points into month buckets (newest first). */
function groupByMonth(points: StrengthSessionPoint[], limit: number): HistoryMonth[] {
  const newestFirst = [...points].reverse().slice(0, limit);
  const months: HistoryMonth[] = [];
  for (let i = 0; i < newestFirst.length; i++) {
    const point = newestFirst[i]!;
    const olderIdx = points.length - 1 - i - 1;
    const older = points[olderIdx];
    const diff = older ? point.e1RM - older.e1RM : null;
    const d = new Date(point.date);
    const label = Number.isNaN(d.getTime())
      ? '—'
      : d.toLocaleDateString('he-IL', { month: 'long', year: 'numeric' });
    const bucket = months[months.length - 1];
    if (bucket && bucket.label === label) bucket.rows.push({ point, diff });
    else months.push({ label, rows: [{ point, diff }] });
  }
  return months;
}

export const ExerciseDetail = memo(function ExerciseDetail({
  progress,
  sessions,
  onBack,
}: {
  progress: ExerciseProgress;
  sessions: WorkoutSession[];
  onBack: () => void;
}) {
  const label = exerciseLabel(progress.exerciseName);
  const statusColor = zoneColor(STRENGTH_STATUS_ZONE[progress.status]);
  const showDelta =
    (progress.status === 'improving' || progress.status === 'declining') &&
    progress.deltaE1RM !== 0;
  const up = progress.deltaE1RM > 0;

  const curvePoints = useMemo<GlowAreaPoint[]>(
    () =>
      progress.points.slice(-CHART_POINTS).map((p) => ({
        x: new Date(p.date).toLocaleDateString('he-IL', { day: 'numeric', month: 'numeric' }),
        y: p.e1RM,
      })),
    [progress.points]
  );

  // PR markers: every point whose e1RM is a new running maximum (the record
  // sessions, visible ON the curve — the FitNotes/Strong pattern from the
  // design research). The final point only gets marked when it IS a record,
  // so the marker never collides with the chart's own tail pulse.
  const prMarkers = useMemo(() => {
    const pts = progress.points.slice(-CHART_POINTS);
    const markers: GlowAreaMarker[] = [];
    let runningMax = Number.NEGATIVE_INFINITY;
    for (let i = 0; i < pts.length; i++) {
      const e = pts[i]!.e1RM;
      if (e > runningMax) {
        // Skip index 0 (the first session isn't an "achievement") and skip
        // the last index when it's also the chart tail.
        if (i > 0 && i < pts.length - 1) markers.push({ index: i, label: 'PR' });
        runningMax = e;
      }
    }
    return markers;
  }, [progress.points]);

  const historyMonths = useMemo(
    () => groupByMonth(progress.points, HISTORY_ROWS),
    [progress.points]
  );

  return (
    <div className="space-y-4">
      {/* Back to the master list — arrow points inline-start (right in RTL). */}
      <button
        type="button"
        onClick={onBack}
        aria-label="חזרה לרשימת התרגילים"
        className="active:scale-[0.98] motion-reduce:active:scale-100"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          minHeight: 44,
          paddingInline: 4,
          background: 'transparent',
          border: 'none',
          cursor: 'pointer',
          color: 'var(--fs-accent)',
          fontFamily: 'var(--font-hebrew)',
          fontSize: 13,
          fontWeight: 600,
        }}
      >
        <ArrowRight size={16} aria-hidden="true" />
        כל התרגילים
      </button>

      {/* Hero — the honest current strength number + how it moved */}
      <SectionCard rail={false} style={{ padding: '16px 20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <h2
            style={{
              fontFamily: 'var(--font-display)',
              fontWeight: 600,
              fontSize: 20,
              letterSpacing: '-0.01em',
              color: 'var(--fs-ink)',
              margin: 0,
            }}
          >
            {label}
          </h2>
          <span
            style={{
              fontFamily: 'var(--font-hebrew)',
              fontSize: 11,
              fontWeight: 600,
              color: statusColor,
              background: `color-mix(in srgb, ${statusColor} 14%, var(--fs-surface))`,
              padding: '2px 8px',
              borderRadius: 999,
            }}
          >
            {STRENGTH_STATUS_LABEL[progress.status]}
          </span>
        </div>

        <div
          style={{
            display: 'flex',
            alignItems: 'baseline',
            gap: 10,
            flexWrap: 'wrap',
            marginTop: 12,
          }}
        >
          <div
            className="kinetic-number"
            dir="ltr"
            style={{
              fontFamily: 'var(--font-display)',
              fontWeight: 600,
              fontSize: 44,
              lineHeight: 0.9,
              color: 'var(--fs-ink)',
            }}
          >
            {progress.currentE1RM}
            <span
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 12,
                color: 'var(--fs-muted)',
                marginInlineStart: 6,
              }}
            >
              KG · 1RM
            </span>
          </div>
          {showDelta && (
            <div
              className="inline-flex items-center gap-1.5"
              dir="ltr"
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 12,
                fontWeight: 700,
                background: `color-mix(in srgb, ${statusColor} 16%, var(--fs-surface))`,
                color: statusColor,
                padding: '4px 10px',
                borderRadius: 8,
              }}
            >
              {up ? (
                <TrendingUp size={12} aria-hidden="true" />
              ) : (
                <TrendingDown size={12} aria-hidden="true" />
              )}
              {up ? '+' : '−'}
              {Math.abs(progress.deltaE1RM)} KG ({progress.deltaPct > 0 ? '+' : ''}
              {progress.deltaPct}%)
            </div>
          )}
        </div>

        <p style={{ ...kicker, margin: '10px 0 0' }}>
          הכי כבד לאחרונה:{' '}
          <span
            className="kinetic-number"
            dir="ltr"
            style={{ color: 'var(--fs-ink)', fontWeight: 700 }}
          >
            {progress.latestTopWeight}×{progress.latestTopReps}
          </span>{' '}
          · תורגל {formatDaysAgo(progress.daysSinceLast)}
        </p>

        {/* The user's core question, answered in plain Hebrew. */}
        <p
          style={{
            fontFamily: 'var(--font-hebrew)',
            fontSize: 12,
            lineHeight: 1.5,
            color: 'var(--fs-muted)',
            margin: '12px 0 0',
            paddingTop: 12,
            borderTop: '1px solid var(--fs-surface-2)',
          }}
        >
          המספר מחושב לפי הסט החזק ביותר בכל אימון — משקל וחזרות יחד (1RM משוער), בלי סטים של חימום.
        </p>
      </SectionCard>

      {/* Trend curve */}
      <SectionCard rail={false} style={{ padding: '16px 20px' }}>
        <h3 style={{ ...kicker, marginBottom: 12 }}>עקומת כוח · 1RM משוער</h3>
        {curvePoints.length >= 2 ? (
          <GlowAreaChart
            data={curvePoints}
            height={170}
            xAxis
            yAxis
            interactive
            valueUnit="kg"
            markers={prMarkers}
            ariaLabel={`עקומת 1RM משוער ל${label}`}
          />
        ) : (
          <p style={{ ...kicker, textAlign: 'center', padding: '20px 0' }}>
            צריך לפחות שני אימונים עם התרגיל כדי להראות עקומה
          </p>
        )}
      </SectionCard>

      {/* מתקדם — a one-week linear extrapolation of a noisy weekly series.
          Defensible, not load-bearing, and a whole card; the same expander the
          two tabs use keeps it one tap away instead of always on screen. */}
      <AdvancedSection id={`exercise-forecast-${progress.exerciseName}`}>
        <ForecastChart
          sessions={sessions}
          exerciseName={progress.exerciseName}
          exerciseLabel={label}
        />
      </AdvancedSection>

      {/* Per-session history — the full detail, on demand */}
      <SectionCard rail={false} style={{ padding: '16px 20px' }}>
        <h3 style={{ ...kicker, marginBottom: 12 }}>היסטוריית אימונים</h3>
        <div className="space-y-4">
          {historyMonths.map((month) => (
            <div key={month.label}>
              <div style={{ ...kicker, fontSize: 9, marginBottom: 6 }}>{month.label}</div>
              <div style={{ display: 'grid', gap: 4 }}>
                {month.rows.map(({ point, diff }) => (
                  <div
                    key={point.date}
                    style={{
                      background: 'var(--fs-surface-2)',
                      borderRadius: 10,
                      padding: '10px 12px',
                    }}
                  >
                    <div className="flex items-baseline justify-between gap-3">
                      <span
                        style={{
                          fontFamily: 'var(--font-mono)',
                          fontSize: 11,
                          color: 'var(--fs-muted)',
                        }}
                      >
                        {new Date(point.date).toLocaleDateString('he-IL', {
                          day: 'numeric',
                          month: 'short',
                        })}
                      </span>
                      <span
                        style={{
                          display: 'inline-flex',
                          alignItems: 'baseline',
                          gap: 6,
                          flexShrink: 0,
                        }}
                      >
                        {diff !== null && diff !== 0 && (
                          <span
                            dir="ltr"
                            style={{
                              fontFamily: 'var(--font-mono)',
                              fontSize: 11,
                              fontWeight: 700,
                              color: zoneColor(diff > 0 ? 'good' : 'attention'),
                            }}
                          >
                            {diff > 0 ? '+' : '−'}
                            {Math.abs(diff)}
                          </span>
                        )}
                        <span
                          className="kinetic-number"
                          dir="ltr"
                          style={{
                            fontFamily: 'var(--font-display)',
                            fontWeight: 600,
                            fontSize: 18,
                            color: 'var(--fs-ink)',
                          }}
                        >
                          {point.e1RM}
                        </span>
                        <span
                          style={{
                            fontFamily: 'var(--font-mono)',
                            fontSize: 9,
                            fontWeight: 700,
                            color: 'var(--fs-muted)',
                          }}
                        >
                          1RM
                        </span>
                      </span>
                    </div>
                    <div style={{ ...kicker, fontSize: 10, marginTop: 4 }} dir="rtl">
                      הכי כבד{' '}
                      <span className="kinetic-number" dir="ltr" style={{ color: 'var(--fs-ink)' }}>
                        {point.topWeight}×{point.topReps}
                      </span>{' '}
                      ·{' '}
                      <span className="kinetic-number" dir="ltr" style={{ color: 'var(--fs-ink)' }}>
                        {point.workingSets}
                      </span>{' '}
                      {point.workingSets === 1 ? 'סט' : 'סטים'} · נפח{' '}
                      <span className="kinetic-number" dir="ltr" style={{ color: 'var(--fs-ink)' }}>
                        {point.volume.toLocaleString('en-US')}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </SectionCard>
    </div>
  );
});

export default ExerciseDetail;

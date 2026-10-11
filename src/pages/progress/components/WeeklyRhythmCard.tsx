// ============================================================================
// WeeklyRhythmCard — "am I keeping the rhythm?" over the last 8 weeks.
// ============================================================================
// The overview stated ONE week and nothing else, so a trainee could not tell a
// good week from a normal one. Eight Sunday-based weeks of session counts, drawn
// as bars against the weekly target, answer that in one glance.
//
// Honesty rules, in order of importance:
//   • Weeks before the first logged session are omitted, not drawn as zeros —
//     a week you had not started is not a week you skipped.
//   • The week in progress is drawn muted and excluded from the "ביעד" count:
//     it is not a finished result yet.
//   • Below two COMPLETE weeks of history the whole card is hidden. There is no
//     rhythm to show and a two-bar chart would invent one.
//   • With no known target there is no reference line and the caption states the
//     range instead of a hit rate.
//
// Time runs OLDEST → NEWEST left-to-right (`dir="ltr"` on the plot), which is the
// convention `Sparkline` and `GlowAreaChart` already use app-wide; only the
// Hebrew prose around it is RTL.

import { memo, useMemo } from 'react';
import type { WorkoutSession } from '../../../types';
import { completeTrainingWeeks, sessionsPerWeekSeries } from '../../../utils/trainingWeek';
import { ChartSummary, ChartSummaryNumber } from './ChartSummary';
import { SectionCard } from './SectionCard';

/** Weeks the card charts. */
const WEEKS = 8;
/** Complete weeks of history required before the card renders at all. */
const MIN_COMPLETE_WEEKS = 2;
/** Plot height in px — tall enough to read a difference, short enough to scan. */
const PLOT_H = 72;

/** Hebrew week-count with the dual form Israelis actually say. */
export function weeksLabel(n: number): string {
  if (n === 1) return 'שבוע';
  if (n === 2) return 'שבועיים';
  return `${n} שבועות`;
}

export const WeeklyRhythmCard = memo(function WeeklyRhythmCard({
  sessions,
  target,
}: {
  /** Already filtered to completed sessions by the page. */
  sessions: WorkoutSession[];
  /** Sessions/week the weeks are judged against, or null when unknown. */
  target: number | null;
}) {
  const series = useMemo(() => sessionsPerWeekSeries(sessions, WEEKS), [sessions]);
  const complete = useMemo(() => completeTrainingWeeks(sessions), [sessions]);

  if (complete < MIN_COMPLETE_WEEKS || series.length < MIN_COMPLETE_WEEKS) return null;

  const finished = series.filter((w) => !w.isCurrent);
  const max = Math.max(...series.map((w) => w.count), target ?? 0, 1);
  const onTarget = target ? finished.filter((w) => w.count >= target).length : 0;
  const counts = finished.map((w) => w.count);
  const low = Math.min(...counts);
  const high = Math.max(...counts);

  // Text summary of the whole plot for screen readers — the bars are aria-hidden.
  const spoken = target
    ? `${onTarget} מתוך ${finished.length} השבועות האחרונים ביעד ${target} אימונים בשבוע`
    : `בין ${low} ל־${high} אימונים בשבוע ${finished.length > 2 ? 'ב־' : 'ב'}${weeksLabel(finished.length)} האחרונים`;

  return (
    <SectionCard>
      {target ? (
        <ChartSummary kicker={`קצב שבועי · ${weeksLabel(finished.length)}`}>
          <ChartSummaryNumber
            value={onTarget}
            zone={onTarget >= Math.ceil(finished.length / 2) ? 'good' : 'attention'}
          />{' '}
          מתוך {finished.length} השבועות האחרונים ביעד.
        </ChartSummary>
      ) : (
        <ChartSummary kicker={`קצב שבועי · ${weeksLabel(finished.length)}`}>
          {low === high ? (
            <>
              <ChartSummaryNumber value={low} /> אימונים בשבוע, בקצב אחיד.
            </>
          ) : (
            <>
              בין <ChartSummaryNumber value={low} /> ל־
              <ChartSummaryNumber value={high} /> אימונים בשבוע.
            </>
          )}
        </ChartSummary>
      )}

      {/* The plot. LTR so the oldest week sits at the reading start of the
          chart, matching every other time axis in the app. */}
      <div
        dir="ltr"
        role="img"
        aria-label={spoken}
        style={{
          position: 'relative',
          display: 'flex',
          alignItems: 'flex-end',
          gap: 6,
          height: PLOT_H,
          marginTop: 12,
        }}
      >
        {/* Target reference line — a hairline, not a second chart. */}
        {target !== null && (
          <div
            aria-hidden="true"
            style={{
              position: 'absolute',
              insetInlineStart: 0,
              insetInlineEnd: 0,
              bottom: `${(target / max) * PLOT_H}px`,
              borderTop: '1px dashed color-mix(in srgb, var(--fs-accent) 55%, transparent)',
            }}
          />
        )}
        {series.map((w) => {
          const hit = target !== null && w.count >= target;
          const height = Math.max(3, Math.round((w.count / max) * PLOT_H));
          return (
            <div
              key={w.weekStart}
              aria-hidden="true"
              style={{
                flex: 1,
                height,
                borderRadius: 4,
                background: w.isCurrent
                  ? 'color-mix(in srgb, var(--fs-accent) 28%, transparent)'
                  : hit
                    ? 'var(--fs-accent)'
                    : 'var(--fs-surface-2)',
                border: w.isCurrent
                  ? '1px dashed color-mix(in srgb, var(--fs-accent) 60%, transparent)'
                  : 'none',
              }}
            />
          );
        })}
      </div>

      {/* Axis ends only — eight date labels would be noise at 390px. */}
      <div
        dir="ltr"
        aria-hidden="true"
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          marginTop: 6,
          fontFamily: 'var(--font-mono)',
          fontSize: 9,
          letterSpacing: '-0.01em',
          color: 'var(--fs-muted)',
        }}
      >
        <span>לפני {weeksLabel(series.length)}</span>
        <span>השבוע</span>
      </div>
    </SectionCard>
  );
});

export default WeeklyRhythmCard;

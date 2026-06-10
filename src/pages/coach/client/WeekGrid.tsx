// ============================================================================
// WeekGrid — 7-day adherence grid for the coach's client detail screen
// Fresh Steel / Obsidian design system
// ============================================================================

import { SkeletonBox } from '../../../components/ui/SkeletonLoader';
import type { DayAdherence } from '../../../services/coach/coachAnalytics';
import { InlineEmpty, SectionError } from '../_shared';

// 0 = Sunday … 6 = Saturday
const WEEKDAY_LETTER: Record<number, string> = {
  0: 'א',
  1: 'ב',
  2: 'ג',
  3: 'ד',
  4: 'ה',
  5: 'ו',
  6: 'ש',
};

// ---- helpers ----------------------------------------------------------------

function calBarHeight(day: DayAdherence): number {
  if (day.calories == null) return 0;
  if (day.targetCalories == null || day.targetCalories <= 0) return 40; // fixed height when no target
  return Math.round(Math.min(day.calories / day.targetCalories, 1.2) * 48);
}

function calBarColor(day: DayAdherence): string {
  if (day.targetCalories == null || day.calories == null) return 'var(--fs-primary)';
  return day.calories > day.targetCalories ? 'var(--fs-warn)' : 'var(--fs-primary)';
}

function buildAriaLabel(days: DayAdherence[]): string {
  const workoutDays = days.filter((d) => d.sessions > 0).length;
  const hasTarget = days.some((d) => d.targetCalories != null);
  const onTargetDays = hasTarget
    ? days.filter(
        (d) => d.calories != null && d.targetCalories != null && d.calories <= d.targetCalories
      ).length
    : null;
  const scheduledTotal = days.reduce((sum, d) => sum + d.scheduled, 0);
  const completedScheduled = days.reduce((sum, d) => sum + d.completedScheduled, 0);
  let label = `גריד 7 ימים: ${workoutDays} ימי אימון`;
  if (onTargetDays !== null) label += `, עמידה ביעד קלורי ${onTargetDays} ימים`;
  if (scheduledTotal > 0)
    label += `, ${completedScheduled} מתוך ${scheduledTotal} אימונים מתוכננים בוצעו`;
  return label;
}

function buildSummaryLine(days: DayAdherence[]): string | null {
  const hasTarget = days.some((d) => d.targetCalories != null);
  const scheduledTotal = days.reduce((sum, d) => sum + d.scheduled, 0);
  if (!hasTarget && scheduledTotal === 0) return null;
  const parts: string[] = [];
  const workouts = days.filter((d) => d.sessions > 0).length;
  parts.push(`${workouts} אימונים`);
  if (scheduledTotal > 0) {
    const done = days.reduce((sum, d) => sum + d.completedScheduled, 0);
    parts.push(`מתוכנן ${done}/${scheduledTotal}`);
  }
  if (hasTarget) {
    const onTarget = days.filter(
      (d) => d.calories != null && d.targetCalories != null && d.calories <= d.targetCalories
    ).length;
    parts.push(`עמידה ביעד ${onTarget}/7 ימים`);
  }
  return parts.join(' · ');
}

// ---- skeleton ---------------------------------------------------------------

function GridSkeleton() {
  return (
    <div role="status" aria-busy="true" aria-label="טוען גריד שבועי" className="flex gap-1.5">
      {Array.from({ length: 7 }).map((_, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: fixed 7 placeholder columns
        <div key={i} className="flex-1">
          <SkeletonBox height={96} width="100%" />
        </div>
      ))}
    </div>
  );
}

// ---- main component ---------------------------------------------------------

export interface WeekGridProps {
  /** Week-adherence data fetched ONCE by the parent (shared with StreakStrip). */
  days: DayAdherence[];
  loading: boolean;
  error: string | null;
  onRetry: () => void;
}

export function WeekGrid({ days, loading, error, onRetry }: WeekGridProps) {
  if (loading) return <GridSkeleton />;
  if (error) return <SectionError onRetry={onRetry} />;
  if (days.length === 0) return <InlineEmpty>אין נתוני שבוע.</InlineEmpty>;

  const summaryLine = buildSummaryLine(days);

  return (
    <div>
      {/* Visual grid — aria-hidden; the wrapper role="img" carries the summary */}
      <div
        role="img"
        aria-label={buildAriaLabel(days)}
        className="flex gap-1.5"
        style={{ direction: 'rtl' }}
      >
        {days.map((day) => {
          const hasWorkout = day.sessions > 0;
          const barH = calBarHeight(day);
          const barColor = calBarColor(day);
          const hasScheduled = day.scheduled > 0;
          const scheduledDone = hasScheduled && day.completedScheduled >= day.scheduled;

          return (
            <div
              key={day.date}
              aria-hidden="true"
              className="flex-1 flex flex-col items-center gap-1"
              style={{ minWidth: 0 }}
            >
              {/* Day letter */}
              <span
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: 10,
                  letterSpacing: '0.06em',
                  color: 'var(--fs-muted)',
                  lineHeight: 1,
                }}
              >
                {WEEKDAY_LETTER[day.weekday] ?? '?'}
              </span>

              {/* Workout indicator square */}
              <div
                style={{
                  width: '100%',
                  aspectRatio: '1 / 1',
                  background: hasWorkout ? 'var(--fs-accent)' : 'transparent',
                  border: hasWorkout
                    ? '1px solid var(--fs-accent)'
                    : '1px solid var(--fs-surface-2)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {hasWorkout && day.sessions > 1 && (
                  <span
                    dir="ltr"
                    style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: 10,
                      fontWeight: 700,
                      color: 'var(--fs-primary)',
                      lineHeight: 1,
                    }}
                  >
                    {day.sessions}
                  </span>
                )}
              </div>

              {/* Scheduled indicator — a ring when planned, filled when all done.
                  Reserves a fixed-height row so the calories bars stay aligned. */}
              <div
                style={{
                  height: 8,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {hasScheduled && (
                  <span
                    style={{
                      width: 6,
                      height: 6,
                      borderRadius: 999,
                      background: scheduledDone ? 'var(--fs-accent)' : 'transparent',
                      border: '1px solid var(--fs-accent)',
                    }}
                  />
                )}
              </div>

              {/* Calories mini-bar + label */}
              {day.calories != null && (
                <div className="flex flex-col items-center gap-0.5" style={{ width: '100%' }}>
                  {/* Bar track */}
                  <div
                    style={{
                      width: '100%',
                      height: 48,
                      background: 'var(--fs-surface-2)',
                      position: 'relative',
                      overflow: 'hidden',
                    }}
                  >
                    {/* Fill */}
                    <div
                      style={{
                        position: 'absolute',
                        bottom: 0,
                        insetInlineStart: 0,
                        width: '100%',
                        height: barH,
                        background: barColor,
                        transition: 'height 300ms ease',
                      }}
                    />
                  </div>
                  {/* kcal number */}
                  <span
                    dir="ltr"
                    style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: 9,
                      color: 'var(--fs-muted)',
                      lineHeight: 1,
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {day.calories}
                  </span>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Summary line below the grid */}
      {summaryLine && (
        <p
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 11,
            color: 'var(--fs-muted)',
            marginTop: 10,
            textAlign: 'center',
          }}
        >
          <bdi>{summaryLine}</bdi>
        </p>
      )}
    </div>
  );
}

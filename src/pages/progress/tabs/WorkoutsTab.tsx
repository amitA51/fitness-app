// ============================================================================
// WorkoutsTab — grouped "אימונים" section (history + volume trend + strength).
// ============================================================================
// Merges the former standalone Workouts and Strength tabs behind a secondary
// segmented control so the surface is no longer one long undifferentiated
// scroll:
//   • היסטוריה — the calendar heatmap + the unified <WorkoutHistory mode="full" />
//                surface (search, summary stats, month grouping, virtualization).
//                The range control and the volume-trend chart live behind the
//                shared `מתקדם` expander: the calendar answers "did I show up"
//                honestly and instantly, while the trend is range-scoped
//                analysis nobody needs to read the log.
//   • כוח      — the big-three tiles (relocated off Overview) above the
//                de-densified <StrengthSection /> (PR board, exercise analysis
//                curve, per-exercise history).

import { Dumbbell } from 'lucide-react';
import { memo, useCallback, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import WorkoutCalendar from '../../../components/workout/WorkoutCalendar';
import { WorkoutHistory } from '../../../components/workout/history/WorkoutHistory';
import type { PersonalRecord, WorkoutSession } from '../../../types';
import { BigThreeCard } from '../components/BigThreeCard';
import { ChartSummary } from '../components/ChartSummary';
import { AdvancedSection, SectionCard } from '../components/SectionCard';
import { type SegmentOption, SegmentedControl } from '../components/SegmentedControl';
import { TrendChartCard } from '../components/TrendChartCard';
import {
  DEFAULT_RANGE,
  RANGE_DAYS,
  type RangeKey,
  buildVolumeTrend,
  sliceByRangeDays,
} from '../progressMetrics';
import type { WorkoutsSubTab } from '../types';
import { StrengthSection } from './StrengthSection';

// Range options for the volume-trend control (W/M/3M/6M/Y), mono LTR labels.
const RANGE_OPTIONS: readonly SegmentOption<RangeKey>[] = [
  { key: 'W', label: 'W' },
  { key: 'M', label: 'M' },
  { key: '3M', label: '3M' },
  { key: '6M', label: '6M' },
  { key: 'Y', label: 'Y' },
];

const RANGE_LABEL_HE: Record<RangeKey, string> = {
  W: 'שבוע',
  M: 'חודש',
  '3M': '3 חודשים',
  '6M': '6 חודשים',
  Y: 'שנה',
};

// Direction of the volume trend across the window — direction ONLY.
// The signed `±N%` this used to print was first-session-vs-last-session, which
// at the 3-session minimum is two data points; presenting that as a percentage
// (and attaching "שווה לחזק את העומס" to it) asserted far more than the data
// supports. Until there is a real regression here, the sentence states which
// way the window went and nothing else.
function volumeTrendSummary(data: { y: number }[]): string {
  const first = data[0]?.y ?? 0;
  const last = data[data.length - 1]?.y ?? 0;
  const pct = first > 0 ? Math.round(((last - first) / first) * 100) : 0;
  if (pct >= 5) return 'נפח האימונים גבוה בסוף התקופה מאשר בתחילתה.';
  if (pct <= -5) return 'נפח האימונים נמוך בסוף התקופה מאשר בתחילתה.';
  return 'נפח האימונים דומה בתחילת התקופה ובסופה.';
}

const SUB_TABS: readonly SegmentOption<WorkoutsSubTab>[] = [
  { key: 'history', label: 'היסטוריה' },
  { key: 'strength', label: 'כוח' },
];

export const WorkoutsTab = memo(function WorkoutsTab({
  sessions,
  prs,
  isLoading,
  initialSub,
  initialStrengthSelection,
}: {
  sessions: WorkoutSession[];
  prs: PersonalRecord[];
  isLoading?: boolean;
  /** Deep-link entry (e.g. the big-three widget) opens a specific sub-tab. */
  initialSub?: WorkoutsSubTab;
  /** Exercise name pre-selected inside the strength sub-tab (big-three deep link). */
  initialStrengthSelection?: string | null;
}) {
  const navigate = useNavigate();
  const [sub, setSub] = useState<WorkoutsSubTab>(initialSub ?? 'history');
  const [range, setRange] = useState<RangeKey>(DEFAULT_RANGE);

  // Strength drill-down pick. The big-three tiles now live INSIDE the strength
  // panel, so a tap arrives while <StrengthSection /> is already mounted — and
  // it seeds its own selection from `initialSelected` in a useState initializer
  // that never re-runs. The bumped token is the remount key, so every tap opens
  // its exercise (including the same tile twice after backing out to the list).
  const [pick, setPick] = useState<{ exercise: string | null; token: number }>({
    exercise: initialStrengthSelection ?? null,
    token: 0,
  });
  const openExercise = useCallback((exerciseName: string) => {
    setPick((p) => ({ exercise: exerciseName, token: p.token + 1 }));
  }, []);

  // Slice the already-loaded sessions by the selected date window (no re-fetch),
  // then build the trend over the full slice (length as limit, so a long range
  // isn't re-capped by buildVolumeTrend's default count).
  const volumeData = useMemo(() => {
    const ranged = sliceByRangeDays(sessions, RANGE_DAYS[range], (s) => s.startTime);
    return buildVolumeTrend(ranged, ranged.length || 1);
  }, [sessions, range]);
  const volumeSentence = useMemo(() => volumeTrendSummary(volumeData), [volumeData]);

  // Composed empty state (parity with Overview/Recovery) — only once data has
  // loaded and there is genuinely nothing to show, not a bare "אין נתונים".
  if (!isLoading && sessions.length === 0) {
    return (
      <div className="space-y-4">
        <SectionCard rail={false}>
          <div className="flex flex-col items-center py-10 text-center gap-3">
            <Dumbbell size={36} style={{ color: 'var(--fs-accent)' }} aria-hidden="true" />
            <div style={{ display: 'grid', gap: 8, maxWidth: 280 }}>
              <p
                style={{
                  fontFamily: 'var(--font-display)',
                  fontWeight: 600,
                  fontSize: 18,
                  color: 'var(--fs-ink)',
                  margin: 0,
                }}
              >
                עדיין אין אימונים
              </p>
              <p style={{ fontSize: 14, color: 'var(--fs-muted)', margin: 0, lineHeight: 1.5 }}>
                האימון הראשון יופיע כאן עם נפח, משך ותרגילים.
              </p>
            </div>
            <button
              type="button"
              onClick={() => navigate('/templates')}
              className="btn-primary"
              style={{ minHeight: 48, paddingInline: 20 }}
            >
              בחרו תבנית והתחילו
            </button>
          </div>
        </SectionCard>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <SegmentedControl
        options={SUB_TABS}
        value={sub}
        onChange={setSub}
        ariaLabel="תצוגת אימונים"
        idPrefix="workouts-sub"
      />

      {sub === 'history' ? (
        <div
          id="workouts-sub-panel-history"
          role="tabpanel"
          aria-labelledby="workouts-sub-tab-history"
          className="space-y-4"
        >
          {/* Month calendar heatmap of training days — the wger-style workout
              log. The fastest honest read of "did I show up", and it needs no
              range control to be true. Each day click-throughs to its session. */}
          <WorkoutCalendar sessions={sessions} />

          <WorkoutHistory mode="full" sessions={sessions} isLoading={isLoading} />

          {/* מתקדם — the range-scoped volume trend. Range-picking plus a
              min–max chart is analysis; the calendar and the log above answer
              the tab's actual question without it. */}
          <AdvancedSection id="workouts-history-advanced">
            <div className="space-y-3">
              <SegmentedControl
                options={RANGE_OPTIONS}
                value={range}
                onChange={setRange}
                ariaLabel="טווח זמן למגמת הנפח"
                idPrefix="volume-range"
              />
              {volumeData.length >= 3 ? (
                <div>
                  <ChartSummary
                    kicker={`מגמת נפח · ${RANGE_LABEL_HE[range]} · ${volumeData.length} אימונים`}
                  >
                    {volumeSentence}
                  </ChartSummary>
                  <TrendChartCard
                    title="מגמת נפח"
                    data={volumeData}
                    ariaLabel="מגמת נפח האימונים לאורך זמן"
                  />
                </div>
              ) : (
                <p
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: 11,
                    letterSpacing: '-0.01em',
                    color: 'var(--fs-muted)',
                    textAlign: 'center',
                    padding: '12px 0',
                    margin: 0,
                  }}
                >
                  אין מספיק אימונים בטווח הזה — בחרו טווח רחב יותר
                </p>
              )}
            </div>
          </AdvancedSection>
        </div>
      ) : (
        <div
          id="workouts-sub-panel-strength"
          role="tabpanel"
          aria-labelledby="workouts-sub-tab-strength"
          className="space-y-4"
        >
          {/* The big three — squat/bench/deadlift e1RM, at the strength surface
              instead of on Overview. Self-hides until one is trained. */}
          <BigThreeCard sessions={sessions} onSelect={openExercise} />

          <StrengthSection
            key={pick.token}
            sessions={sessions}
            prs={prs}
            initialSelected={pick.exercise}
          />
        </div>
      )}
    </div>
  );
});

export default WorkoutsTab;

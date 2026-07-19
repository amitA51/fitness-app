// ============================================================================
// WorkoutsTab — grouped "אימונים" section (history + volume trend + strength).
// ============================================================================
// Merges the former standalone Workouts and Strength tabs behind a secondary
// segmented control so the surface is no longer one long undifferentiated
// scroll:
//   • היסטוריה — volume trend (converged GlowAreaChart) + the unified
//                <WorkoutHistory mode="full" /> surface (search, summary stats,
//                month grouping, virtualization).
//   • כוח      — the de-densified <StrengthSection /> (PR board, exercise
//                analysis curve, per-exercise history).

import { Dumbbell } from 'lucide-react';
import { memo, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import PRHistoryTab from '../../../components/workout/PRHistoryTab';
import WorkoutCalendar from '../../../components/workout/WorkoutCalendar';
import { WorkoutHistory } from '../../../components/workout/history/WorkoutHistory';
import type { PersonalRecord, WorkoutSession } from '../../../types';
import { ChapterBreak } from '../components/ChapterBreak';
import { ChartSummary, ChartSummaryNumber } from '../components/ChartSummary';
import { SectionCard } from '../components/SectionCard';
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

// First→last volume change across the trend window, as a graded takeaway.
function volumeTrendSummary(data: { y: number }[]): {
  pct: number;
  zone: 'good' | 'neutral' | 'attention';
  sentence: string;
} {
  const first = data[0]?.y ?? 0;
  const last = data[data.length - 1]?.y ?? 0;
  const pct = first > 0 ? Math.round(((last - first) / first) * 100) : 0;
  if (pct >= 5) {
    return { pct, zone: 'good', sentence: 'נפח האימונים במגמת עלייה לאורך התקופה.' };
  }
  if (pct <= -5) {
    return {
      pct,
      zone: 'attention',
      sentence: 'נפח האימונים ירד לאורך התקופה — שווה לחזק את העומס.',
    };
  }
  return { pct, zone: 'neutral', sentence: 'נפח האימונים יציב לאורך התקופה.' };
}

const SUB_TABS: readonly SegmentOption<WorkoutsSubTab>[] = [
  { key: 'history', label: 'היסטוריה' },
  { key: 'strength', label: 'כוח' },
];

export const WorkoutsTab = memo(function WorkoutsTab({
  sessions,
  prs,
  isLoading,
}: {
  sessions: WorkoutSession[];
  prs: PersonalRecord[];
  isLoading?: boolean;
}) {
  const navigate = useNavigate();
  const [sub, setSub] = useState<WorkoutsSubTab>('history');
  const [range, setRange] = useState<RangeKey>(DEFAULT_RANGE);
  // Slice the already-loaded sessions by the selected date window (no re-fetch),
  // then build the trend over the full slice (length as limit, so a long range
  // isn't re-capped by buildVolumeTrend's default count).
  const volumeData = useMemo(() => {
    const ranged = sliceByRangeDays(sessions, RANGE_DAYS[range], (s) => s.startTime);
    return buildVolumeTrend(ranged, ranged.length || 1);
  }, [sessions, range]);
  const volumeSummary = useMemo(() => volumeTrendSummary(volumeData), [volumeData]);

  // Composed empty state (parity with Overview/Recovery) — only once data has
  // loaded and there is genuinely nothing to show, not a bare "אין נתונים".
  if (!isLoading && sessions.length === 0) {
    return (
      <div className="space-y-4">
        <ChapterBreak title="אימונים" />
        <SectionCard rail={false}>
          <div className="flex flex-col items-center py-10 text-center gap-3">
            <Dumbbell size={36} style={{ color: 'var(--fs-accent)' }} aria-hidden="true" />
            <div style={{ display: 'grid', gap: 8, maxWidth: 280 }}>
              <p style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 18, color: 'var(--fs-ink)', margin: 0 }}>
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
      <ChapterBreak title="אימונים" />

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
                  {volumeSummary.sentence}
                  {volumeSummary.pct !== 0 && (
                    <>
                      {' '}
                      <ChartSummaryNumber
                        value={`${volumeSummary.pct > 0 ? '+' : ''}${volumeSummary.pct}%`}
                        zone={volumeSummary.zone}
                      />
                    </>
                  )}
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
                  letterSpacing: '0.1em',
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

          {/* Month calendar heatmap of training days — the wger-style workout
              log, complementing the volume trend above and the detailed list
              below. Each day click-throughs to that session's detail. */}
          <WorkoutCalendar sessions={sessions} />

          <WorkoutHistory mode="full" sessions={sessions} isLoading={isLoading} />
        </div>
      ) : (
        <div
          id="workouts-sub-panel-strength"
          role="tabpanel"
          aria-labelledby="workouts-sub-tab-strength"
          className="space-y-4"
        >
          <StrengthSection sessions={sessions} prs={prs} />
          {/* Full per-exercise PR history (grouped, latest-first) — complements
              the PR board above with the complete record list. */}
          <PRHistoryTab />
        </div>
      )}
    </div>
  );
});

export default WorkoutsTab;

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
import { WorkoutHistory } from '../../../components/workout/history/WorkoutHistory';
import type { PersonalRecord, WorkoutSession } from '../../../types';
import { ChartSummary, ChartSummaryNumber } from '../components/ChartSummary';
import { ChapterBreak } from '../components/ChapterBreak';
import { emptyStateCardStyle } from '../components/emptyStateCard';
import { type SegmentOption, SegmentedControl } from '../components/SegmentedControl';
import { TrendChartCard } from '../components/TrendChartCard';
import { buildVolumeTrend } from '../progressMetrics';
import type { WorkoutsSubTab } from '../types';
import { StrengthSection } from './StrengthSection';

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
    return { pct, zone: 'attention', sentence: 'נפח האימונים ירד לאורך התקופה — שווה לחזק את העומס.' };
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
  const volumeData = useMemo(() => buildVolumeTrend(sessions), [sessions]);
  const volumeSummary = useMemo(() => volumeTrendSummary(volumeData), [volumeData]);

  // Composed empty state (parity with Overview/Recovery) — only once data has
  // loaded and there is genuinely nothing to show, not a bare "אין נתונים".
  if (!isLoading && sessions.length === 0) {
    return (
      <div className="space-y-4">
        <ChapterBreak title="אימונים" />
        <div style={emptyStateCardStyle}>
          <div className="flex flex-col items-center py-10 text-center gap-3">
            <Dumbbell size={32} style={{ color: 'var(--fs-muted)' }} aria-hidden="true" />
            <p style={{ fontSize: 14, color: 'var(--fs-muted)' }}>
              עדיין אין אימונים — האימון הראשון שלך יופיע כאן.
            </p>
            <button
              type="button"
              onClick={() => navigate('/workout')}
              className="btn-primary"
              style={{ minHeight: 44 }}
            >
              התחל אימון
            </button>
          </div>
        </div>
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
          {volumeData.length >= 3 && (
            <div>
              <ChartSummary kicker={`מגמת נפח · ${volumeData.length} אימונים`}>
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
          )}
          <WorkoutHistory mode="full" sessions={sessions} isLoading={isLoading} />
        </div>
      ) : (
        <div
          id="workouts-sub-panel-strength"
          role="tabpanel"
          aria-labelledby="workouts-sub-tab-strength"
        >
          <StrengthSection sessions={sessions} prs={prs} />
        </div>
      )}
    </div>
  );
});

export default WorkoutsTab;

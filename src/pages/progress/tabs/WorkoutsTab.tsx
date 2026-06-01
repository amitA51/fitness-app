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

import { memo, useMemo, useState } from 'react';
import { WorkoutHistory } from '../../../components/workout/history/WorkoutHistory';
import type { PersonalRecord, WorkoutSession } from '../../../types';
import { ChapterBreak } from '../components/ChapterBreak';
import { type SegmentOption, SegmentedControl } from '../components/SegmentedControl';
import { TrendChartCard } from '../components/TrendChartCard';
import { buildVolumeTrend } from '../progressMetrics';
import type { WorkoutsSubTab } from '../types';
import { StrengthSection } from './StrengthSection';

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
  const [sub, setSub] = useState<WorkoutsSubTab>('history');
  const volumeData = useMemo(() => buildVolumeTrend(sessions), [sessions]);

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
            <TrendChartCard
              title="מגמת נפח"
              data={volumeData}
              ariaLabel="מגמת נפח האימונים לאורך זמן"
            />
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

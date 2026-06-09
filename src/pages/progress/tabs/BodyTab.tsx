// ============================================================================
// BodyTab — grouped "גוף" section (weight + measurements).
// ============================================================================
// Merges the former Weight and Measurements tabs behind a secondary segmented
// control. Each sub-area keeps all of its original functionality (weight hero +
// BMI + trend, measurements table + diffs) — only regrouped.

import { Scale } from 'lucide-react';
import { memo, useState } from 'react';
import type {
  BodyMeasurement,
  BodyWeightEntry,
  WeightTrend,
} from '../../../services/bodyStatsService';
import { ChapterBreak } from '../components/ChapterBreak';
import { emptyStateCardStyle } from '../components/emptyStateCard';
import { type SegmentOption, SegmentedControl } from '../components/SegmentedControl';
import type { BodySubTab } from '../types';
import { MeasurementsSection } from './MeasurementsSection';
import { WeightSection } from './WeightSection';

const SUB_TABS: readonly SegmentOption<BodySubTab>[] = [
  { key: 'weight', label: 'משקל' },
  { key: 'measurements', label: 'מידות' },
];

export const BodyTab = memo(function BodyTab({
  latestWeight,
  weightTrend,
  bmi,
  bmiCategory,
  weightEntries,
  latestMeasurement,
  measurements,
  onAddWeight,
  onAddMeasurement,
}: {
  latestWeight: BodyWeightEntry | null;
  weightTrend: WeightTrend | null;
  bmi: number | null;
  bmiCategory: { label: string; color: string } | null;
  weightEntries: BodyWeightEntry[];
  latestMeasurement: BodyMeasurement | null;
  measurements: BodyMeasurement[];
  onAddWeight: () => void;
  onAddMeasurement: () => void;
}) {
  const [sub, setSub] = useState<BodySubTab>('weight');

  // Composed empty state (parity with Overview/Recovery) when there is no body
  // data at all — weight nor measurements — rather than two bare sub-sections.
  const hasNoBodyData =
    !latestWeight &&
    weightEntries.length === 0 &&
    !latestMeasurement &&
    measurements.length === 0;

  if (hasNoBodyData) {
    return (
      <div className="space-y-4">
        <ChapterBreak title="גוף" />
        <div style={emptyStateCardStyle}>
          <div className="flex flex-col items-center py-10 text-center gap-3">
            <Scale size={32} style={{ color: 'var(--fs-muted)' }} aria-hidden="true" />
            <p style={{ fontSize: 14, color: 'var(--fs-muted)' }}>
              עדיין אין נתוני גוף — תיעוד המשקל הראשון יתחיל את המעקב.
            </p>
            <button
              type="button"
              onClick={onAddWeight}
              className="btn-primary"
              style={{ minHeight: 44 }}
            >
              הוסף משקל
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <ChapterBreak title="גוף" />

      <SegmentedControl
        options={SUB_TABS}
        value={sub}
        onChange={setSub}
        ariaLabel="תצוגת גוף"
        idPrefix="body-sub"
      />

      {sub === 'weight' ? (
        <div id="body-sub-panel-weight" role="tabpanel" aria-labelledby="body-sub-tab-weight">
          <WeightSection
            latestWeight={latestWeight}
            weightTrend={weightTrend}
            bmi={bmi}
            bmiCategory={bmiCategory}
            weightEntries={weightEntries}
            onAdd={onAddWeight}
          />
        </div>
      ) : (
        <div
          id="body-sub-panel-measurements"
          role="tabpanel"
          aria-labelledby="body-sub-tab-measurements"
        >
          <MeasurementsSection
            latestMeasurement={latestMeasurement}
            measurements={measurements}
            onAdd={onAddMeasurement}
          />
        </div>
      )}
    </div>
  );
});

export default BodyTab;

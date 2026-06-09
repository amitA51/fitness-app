// ============================================================================
// CLIENT 360 — Metrics tab (מדדים)
// ============================================================================
// Weight trend chart, per-field measurement deltas with sparklines, a body-weight
// add + per-entry edit, the personal-records list, and the progress-photo timeline.

import { Pencil, Plus, Scale } from 'lucide-react';
import { useState } from 'react';
import { GradientSparkline } from '../../../../components/charts';
import { Button } from '../../../../components/ui/Button';
import type { BodyMeasurement, PersonalRecordRow } from '../../../../services/supabaseSyncMappers';
import type { BodyWeightEntry } from '../../../../types';
import { TrendChartCard } from '../../../progress/components/TrendChartCard';
import { InlineEmpty, ListRow, ListSkeleton, Section, SectionError, formatDate } from '../../_shared';
import { RowIconBtn } from '../../rosterPrimitives';
import { type EditBodyWeightInitial, EditBodyWeightSheet } from '../EditBodyWeightSheet';
import { PhotoTimeline } from '../PhotoTimeline';
import {
  type MeasurementDelta,
  isImprovement,
  measurementDeltas,
  weightTrendPoints,
} from '../clientTrends';

interface MetricsTabProps {
  clientId: string;
  weights: BodyWeightEntry[];
  measurements: BodyMeasurement[];
  prs: PersonalRecordRow[];
  measurementsLoading: boolean;
  measurementsError: string | null;
  onReloadMeasurements: () => void;
  prsLoading: boolean;
  prsError: string | null;
  onReloadPrs: () => void;
  onWeightSaved: () => void;
}

/** Signed delta chip — green when the change is an improvement for that field. */
function DeltaChip({ field }: { field: MeasurementDelta }) {
  if (field.delta == null || field.delta === 0) {
    return (
      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--fs-muted)' }}>
        ללא שינוי
      </span>
    );
  }
  const good = isImprovement(field.key, field.delta);
  const color = good ? 'var(--fs-accent)' : 'var(--fs-warn)';
  return (
    <span
      dir="ltr"
      style={{
        fontFamily: 'var(--font-mono)',
        fontSize: 11,
        fontWeight: 700,
        color,
        whiteSpace: 'nowrap',
      }}
    >
      {field.delta > 0 ? `+${field.delta}` : field.delta}
    </span>
  );
}

function MeasurementRow({ field }: { field: MeasurementDelta }) {
  return (
    <div
      className="flex items-center gap-3 px-4 py-3"
      style={{
        background: 'var(--fs-surface)',
        border: '1px solid var(--fs-surface-2)',
        marginBottom: 8,
      }}
    >
      <div className="min-w-0" style={{ width: 64 }}>
        <div
          style={{
            fontFamily: 'var(--font-body)',
            fontSize: 14,
            fontWeight: 600,
            color: 'var(--fs-ink)',
          }}
        >
          {field.labelHe}
        </div>
        <span
          dir="ltr"
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 11,
            color: 'var(--fs-muted)',
          }}
        >
          {field.current} ס"מ
        </span>
      </div>
      <div className="flex-1 min-w-0 flex items-center justify-center">
        {field.history.length > 1 ? (
          <GradientSparkline
            data={field.history}
            width={120}
            height={36}
            ariaLabel={`מגמת ${field.labelHe}`}
          />
        ) : null}
      </div>
      <DeltaChip field={field} />
    </div>
  );
}

const toWeightInitial = (w: BodyWeightEntry): EditBodyWeightInitial => ({
  id: w.id,
  date: w.date,
  weight: w.weight,
  notes: w.notes ?? '',
});

export function MetricsTab({
  clientId,
  weights,
  measurements,
  prs,
  measurementsLoading,
  measurementsError,
  onReloadMeasurements,
  prsLoading,
  prsError,
  onReloadPrs,
  onWeightSaved,
}: MetricsTabProps) {
  const [editing, setEditing] = useState<EditBodyWeightInitial | undefined>(undefined);
  const [sheetOpen, setSheetOpen] = useState(false);

  const weightPoints = weightTrendPoints(weights);
  const deltas = measurementDeltas(measurements);

  const openAdd = () => {
    setEditing(undefined);
    setSheetOpen(true);
  };
  const openEdit = (w: BodyWeightEntry) => {
    setEditing(toWeightInitial(w));
    setSheetOpen(true);
  };

  return (
    <>
      <Section title="מגמת משקל">
        {weightPoints.length > 1 ? (
          <TrendChartCard
            title="משקל גוף"
            data={weightPoints}
            meta={`${weightPoints.length} מדידות`}
            icon={<Scale size={14} style={{ color: 'var(--fs-accent)' }} aria-hidden="true" />}
            ariaLabel="מגמת משקל גוף"
          />
        ) : (
          <InlineEmpty>צריך לפחות שתי מדידות כדי להציג מגמה.</InlineEmpty>
        )}
        <Button variant="secondary" fullWidth onClick={openAdd} className="mt-2">
          <Plus size={16} aria-hidden="true" /> הוספת משקל
        </Button>
      </Section>

      <Section title="מדידות גוף">
        {weights.length > 0 && (
          <ListRow
            label={`משקל אחרון · ${weights[0]?.weight ?? '—'} ק"ג`}
            meta={formatDate(weights[0]?.date)}
            trailing={
              weights[0] ? (
                <RowIconBtn
                  onClick={() => openEdit(weights[0] as BodyWeightEntry)}
                  label="עריכת המשקל האחרון"
                >
                  <Pencil size={16} aria-hidden="true" />
                </RowIconBtn>
              ) : undefined
            }
          />
        )}
        {measurementsLoading ? (
          <ListSkeleton rows={3} />
        ) : measurementsError ? (
          <SectionError onRetry={onReloadMeasurements} />
        ) : deltas.length === 0 ? (
          <InlineEmpty>אין מדידות גוף.</InlineEmpty>
        ) : (
          deltas.map((field) => <MeasurementRow key={field.key} field={field} />)
        )}
      </Section>

      <Section title="שיאים אישיים">
        {prsLoading ? (
          <ListSkeleton rows={3} />
        ) : prsError ? (
          <SectionError onRetry={onReloadPrs} />
        ) : prs.length === 0 ? (
          <InlineEmpty>אין שיאים.</InlineEmpty>
        ) : (
          prs
            .slice(0, 8)
            .map((pr) => (
              <ListRow
                key={pr.id}
                label={pr.exerciseName}
                meta={`${pr.weight} ק"ג × ${pr.reps} · ${formatDate(pr.date)}`}
              />
            ))
        )}
      </Section>

      <PhotoTimeline clientId={clientId} />

      <EditBodyWeightSheet
        clientId={clientId}
        isOpen={sheetOpen}
        onClose={() => setSheetOpen(false)}
        onSaved={onWeightSaved}
        initial={editing}
      />
    </>
  );
}

export default MetricsTab;

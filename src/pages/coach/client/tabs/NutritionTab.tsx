// ============================================================================
// CLIENT 360 — Nutrition tab (תזונה)
// ============================================================================
// 7-day nutrition rows with per-row edit + an add action, plus the active coach
// calorie-target indicator (derived from the client's assignments) when present.

import { Pencil, Plus } from 'lucide-react';
import { useState } from 'react';
import { Button } from '../../../../components/ui/Button';
import type { NutritionLog } from '../../../../services/supabaseSyncMappers';
import type { Assignment } from '../../../../types/coach';
import {
  InlineEmpty,
  ListRow,
  ListSkeleton,
  Section,
  SectionError,
  formatDate,
} from '../../_shared';
import { RowIconBtn } from '../../rosterPrimitives';
import { type EditNutritionInitial, EditNutritionSheet } from '../EditNutritionSheet';

interface NutritionTabProps {
  clientId: string;
  nutrition: NutritionLog[];
  assignments: Assignment[];
  loading: boolean;
  error: string | null;
  onReload: () => void;
  onNutritionSaved: () => void;
}

/** Newest active nutrition_target calorie value, or null. */
function activeCalorieTarget(assignments: Assignment[]): number | null {
  for (const a of assignments) {
    if (a.kind === 'nutrition_target' && a.status === 'active') {
      const cal = a.payload?.calories;
      if (typeof cal === 'number' && cal > 0) return cal;
    }
  }
  return null;
}

const toInitial = (n: NutritionLog): EditNutritionInitial => ({
  id: n.id,
  date: n.date,
  calories: n.calories ?? null,
  protein: n.protein ?? null,
  carbs: n.carbs ?? null,
  fat: n.fat ?? null,
  notes: n.notes ?? '',
});

export function NutritionTab({
  clientId,
  nutrition,
  assignments,
  loading,
  error,
  onReload,
  onNutritionSaved,
}: NutritionTabProps) {
  const [editing, setEditing] = useState<EditNutritionInitial | undefined>(undefined);
  const [sheetOpen, setSheetOpen] = useState(false);
  const target = activeCalorieTarget(assignments);

  const openAdd = () => {
    setEditing(undefined);
    setSheetOpen(true);
  };
  const openEdit = (n: NutritionLog) => {
    setEditing(toInitial(n));
    setSheetOpen(true);
  };

  return (
    <Section title="תזונה (7 ימים)">
      {target != null && (
        <div
          className="flex items-center justify-between px-4 py-3 mb-2"
          style={{ background: 'var(--fs-surface)', border: '1px solid var(--fs-surface-2)' }}
        >
          <span
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 11,
              letterSpacing: '-0.01em',
              color: 'var(--fs-muted)',
            }}
          >
            יעד קלוריות פעיל
          </span>
          <span
            dir="ltr"
            style={{
              fontFamily: 'var(--font-body)',
              fontSize: 16,
              fontWeight: 700,
              fontVariantNumeric: 'tabular-nums',
              color: 'var(--fs-accent)',
            }}
          >
            {target} קק"ל
          </span>
        </div>
      )}

      {loading ? (
        <ListSkeleton rows={4} />
      ) : error ? (
        <SectionError onRetry={onReload} />
      ) : nutrition.length === 0 ? (
        <InlineEmpty>אין יומני תזונה. אפשר להוסיף יומן ידנית למתאמן.</InlineEmpty>
      ) : (
        nutrition.map((n) => (
          <ListRow
            key={n.id}
            label={formatDate(n.date)}
            metaNode={
              <div
                style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--fs-muted)' }}
              >
                <bdi dir="ltr">{n.calories ?? 0}</bdi> קק"ל · חלבון{' '}
                <bdi dir="ltr">{n.protein ?? 0}</bdi> ג׳ · פחמ׳ <bdi dir="ltr">{n.carbs ?? 0}</bdi>{' '}
                ג׳ · שומן <bdi dir="ltr">{n.fat ?? 0}</bdi> ג׳
              </div>
            }
            trailing={
              <RowIconBtn
                onClick={() => openEdit(n)}
                label={`עריכת יומן תזונה מ-${formatDate(n.date)}`}
              >
                <Pencil size={16} aria-hidden="true" />
              </RowIconBtn>
            }
          />
        ))
      )}

      <Button variant="secondary" fullWidth onClick={openAdd} className="mt-2">
        <Plus size={16} aria-hidden="true" /> הוספת יומן תזונה
      </Button>

      <EditNutritionSheet
        clientId={clientId}
        isOpen={sheetOpen}
        onClose={() => setSheetOpen(false)}
        onSaved={onNutritionSaved}
        initial={editing}
      />
    </Section>
  );
}

export default NutritionTab;

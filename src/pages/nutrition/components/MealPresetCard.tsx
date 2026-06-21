import { Sparkles } from 'lucide-react';
import { memo, useMemo, useState } from 'react';
import { Card } from '../../../components/ui/Card';
import { getFoodLibrary } from '../../../services/nutritionService';
import type { MealPreset } from '../../../services/nutritionService';
import type { MealType } from '../../../types';
import { MealTypeSelector } from './shared/MealTypeSelector';

interface MealPresetCardProps {
  preset: MealPreset;
  onSelect: (m: MealType) => void;
}

export const MealPresetCard = memo(function MealPresetCard({
  preset,
  onSelect,
}: MealPresetCardProps) {
  const [showMealSelect, setShowMealSelect] = useState(false);
  const totalCal = useMemo(
    () =>
      preset.meals.reduce((s, m) => {
        const f = getFoodLibrary().find((fd) => fd.id === m.foodId);
        return s + (f ? f.calories * m.servings : 0);
      }, 0),
    [preset.meals]
  );
  return (
    <Card variant="elevated" asymmetric className="magnetic-card" style={{ padding: 20 }}>
      <div className="flex items-start justify-between mb-3">
        <div>
          <h4
            style={{
              fontFamily: 'var(--font-display)',
              fontWeight: 800,
              fontSize: '14px',
              color: 'var(--fs-ink)',
              textTransform: 'uppercase',
            }}
          >
            {preset.name}
          </h4>
          <p
            style={{
              fontFamily: 'var(--font-body)',
              fontSize: '11px',
              color: 'var(--fs-muted)',
              marginTop: '2px',
            }}
          >
            {preset.description}
          </p>
        </div>
        <span
          style={{
            fontFamily: 'var(--font-display)',
            fontWeight: 700,
            fontSize: '14px',
            // Neutral ink — a preset's calorie total is informational, not a
            // warning. --fs-warn is reserved for the over-goal/attention state.
            color: 'var(--fs-ink)',
          }}
        >
          {totalCal} קל׳
        </span>
      </div>
      <div className="flex flex-wrap gap-1.5 mb-3">
        {preset.meals.map((m) => {
          const f = getFoodLibrary().find((fd) => fd.id === m.foodId);
          return f ? (
            <span
              key={m.foodId}
              style={{
                padding: '2px 8px',
                borderRadius: '6px',
                fontSize: '11px',
                color: 'var(--fs-muted)',
                backgroundColor: 'var(--fs-surface-2)',
              }}
            >
              {f.name} ×{m.servings}
            </span>
          ) : null;
        })}
      </div>
      {showMealSelect ? (
        <MealTypeSelector
          layout="wrap"
          onSelect={(m) => {
            onSelect(m);
            setShowMealSelect(false);
          }}
        />
      ) : (
        <button
          type="button"
          onClick={() => setShowMealSelect(true)}
          style={{
            width: '100%',
            padding: '10px',
            borderRadius: 0,
            backgroundColor: 'var(--fs-primary)',
            color: 'var(--fs-accent)',
            fontFamily: 'var(--font-display)',
            fontSize: '13px',
            fontWeight: 800,
            textTransform: 'uppercase',
            border: 'none',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '4px',
          }}
        >
          <Sparkles size={13} />
          הוסף מהיר
        </button>
      )}
    </Card>
  );
});

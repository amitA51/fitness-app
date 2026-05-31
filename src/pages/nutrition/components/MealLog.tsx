import { Flame, Plus, Trash2 } from 'lucide-react';
import { memo } from 'react';
import { MEAL_TYPE_LABELS } from '../../../services/nutritionService';
import type { MealEntry } from '../../../types';

export const EmptyMealState = memo(function EmptyMealState({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div
        className="w-16 h-16 flex items-center justify-center mb-4"
        style={{ background: 'var(--fs-surface-2)', color: 'var(--fs-accent)' }}
      >
        <Flame size={26} />
      </div>
      <h3
        className="mb-2"
        style={{
          fontFamily: 'var(--font-display)',
          fontSize: '22px',
          fontWeight: 800,
          color: 'var(--fs-ink)',
          textTransform: 'uppercase',
        }}
      >
        עדיין לא תיעדת ארוחות
      </h3>
      <p
        className="mb-5"
        style={{
          color: 'var(--fs-muted)',
          fontFamily: 'var(--font-body)',
          fontSize: '13px',
          lineHeight: 1.5,
          maxWidth: '28ch',
        }}
      >
        הוסיפו את הארוחה הראשונה של היום כדי לעקוב אחר הקלוריות והמאקרו
      </p>
      <button
        type="button"
        onClick={onAdd}
        className="btn-primary start-workout-btn accent-glow flex items-center gap-2"
      >
        <Plus size={15} />
        הוסף ארוחה
      </button>
    </div>
  );
});

export const MealEntryCard = memo(function MealEntryCard({
  entry,
  onDelete,
}: { entry: MealEntry; onDelete: (id: string) => void }) {
  const mealLabel = entry.meals.map((m) => MEAL_TYPE_LABELS[m.name]).join(', ');
  return (
    <div
      className="magnetic-card glass-surface"
      style={{
        background: 'var(--fs-surface)',
        border: '1px solid var(--fs-surface-2)',
        borderRadius: '22px 16px 22px 16px',
        padding: '20px',
        position: 'relative',
        overflow: 'hidden',
        boxShadow: 'var(--shadow-card)',
      }}
    >
      <div className="flex items-start justify-between mb-2">
        <span className="eyebrow" style={{ color: 'var(--fs-accent)' }}>
          {mealLabel}
        </span>
        <button
          type="button"
          onClick={() => onDelete(entry.id)}
          className="w-12 h-12 flex items-center justify-center transition-colors"
          style={{ color: 'var(--fs-muted)' }}
          aria-label="מחק ארוחה"
        >
          <Trash2 size={14} />
        </button>
      </div>

      <h4
        style={{
          fontFamily: 'var(--font-display)',
          fontWeight: 800,
          fontSize: '22px',
          lineHeight: 1,
          color: 'var(--fs-ink)',
          marginBottom: '6px',
          textTransform: 'uppercase',
        }}
      >
        {entry.name}
      </h4>

      <div className="flex items-baseline gap-2 mb-3">
        <span
          style={{
            fontFamily: 'var(--font-display)',
            fontWeight: 900,
            fontSize: '36px',
            lineHeight: 0.9,
            color: 'var(--fs-ink)',
            letterSpacing: '-0.02em',
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {entry.totalMacros.calories}
        </span>
        <span className="eyebrow" style={{ color: 'var(--fs-muted)' }}>
          KCAL
        </span>
      </div>

      <div className="flex gap-2 flex-wrap mb-3">
        {entry.meals
          .flatMap((m) => m.foods)
          .slice(0, 4)
          .map((f) => (
            <span key={f.id} className="chip">
              {f.name} ×{f.servings}
            </span>
          ))}
        {entry.meals.flatMap((m) => m.foods).length > 4 && (
          <span className="chip">+{entry.meals.flatMap((m) => m.foods).length - 4}</span>
        )}
      </div>

      <div
        className="flex gap-3 pt-3"
        style={{
          borderTop: '1px solid var(--fs-surface-2)',
          fontFamily: 'var(--font-mono)',
          fontSize: '11px',
          letterSpacing: '0.12em',
          color: 'var(--fs-heading)',
          textTransform: 'uppercase',
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        <span className="flex items-center gap-1">
          <Flame size={11} />
          {entry.totalMacros.calories}
        </span>
        <span style={{ color: 'var(--fs-muted)' }}>·</span>
        <span>P {entry.totalMacros.protein}G</span>
        <span style={{ color: 'var(--fs-muted)' }}>·</span>
        <span>C {entry.totalMacros.carbs}G</span>
        <span style={{ color: 'var(--fs-muted)' }}>·</span>
        <span>F {entry.totalMacros.fat}G</span>
        {(entry.totalMacros.fiber ?? 0) > 0 && (
          <>
            <span style={{ color: 'var(--fs-muted)' }}>·</span>
            <span>Fb {Math.round(entry.totalMacros.fiber ?? 0)}G</span>
          </>
        )}
      </div>
    </div>
  );
});

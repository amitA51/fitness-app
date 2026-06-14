import { CopyPlus, Flame, Plus, Trash2 } from 'lucide-react';
import { memo, useMemo } from 'react';
import { SkeletonBox } from '../../../components/ui/SkeletonLoader';
import { MEAL_TYPE_ORDER, normalizeMealType } from '../../../constants/nutrition';
import {
  MEAL_TYPE_ICONS,
  MEAL_TYPE_LABELS,
  sumEntryMacros,
} from '../../../services/nutritionService';
import type { MealEntry, MealType } from '../../../types';

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
        עדיין לא תועדו ארוחות
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
        className="accent-glow flex items-center justify-center gap-2"
        style={{
          minHeight: 48,
          padding: '12px 24px',
          background: 'var(--fs-primary)',
          color: 'var(--fs-accent)',
          border: 'none',
          borderRadius: 0,
          cursor: 'pointer',
          fontFamily: 'var(--font-display)',
          fontWeight: 800,
          fontSize: 14,
          textTransform: 'uppercase',
        }}
      >
        <Plus size={15} aria-hidden="true" />
        הוסף ארוחה
      </button>
    </div>
  );
});

export const MealEntryCard = memo(function MealEntryCard({
  entry,
  onDelete,
  onRepeat,
}: {
  entry: MealEntry;
  onDelete: (id: string) => void;
  /** Optional one-tap re-log of this entry onto the open day. Renders the
   *  re-log control only when wired by the parent (backward compatible). */
  onRepeat?: (id: string) => void;
}) {
  // Eyebrow shows the logging time; the meal-type label lives on the group
  // header in GroupedMealLog, so repeating it here would be redundant.
  const time = entry.meals[0]?.time ?? '';
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
          {time}
        </span>
        <div className="flex items-center" style={{ marginInlineEnd: -8 }}>
          {onRepeat && (
            <button
              type="button"
              onClick={() => onRepeat(entry.id)}
              className="w-12 h-12 flex items-center justify-center transition-colors active:scale-[0.92]"
              style={{ color: 'var(--fs-muted)' }}
              aria-label="רשמו שוב"
            >
              <CopyPlus size={14} />
            </button>
          )}
          <button
            type="button"
            onClick={() => onDelete(entry.id)}
            className="w-12 h-12 flex items-center justify-center transition-colors active:scale-[0.92]"
            style={{ color: 'var(--fs-muted)' }}
            aria-label="מחק ארוחה"
          >
            <Trash2 size={14} />
          </button>
        </div>
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

/**
 * Journal grouped by meal type. Each group shows a header with the meal-type
 * label, its icon, and a per-group calorie/macro summary, then the entries.
 * Replaces the flat list so the day reads as breakfast/lunch/dinner sections.
 *
 * Grouping key: each entry's meal TYPE, read from `entry.meals[0].name` (the
 * `Meal.name` field is typed `MealType`). The value is run through
 * `normalizeMealType` because entries pulled from the cloud are rebuilt from
 * unvalidated JSON — an entry whose stored type is missing or a foreign string
 * would otherwise land in a bucket the ordered render drops, silently removing
 * it (and its calories) from the day. Normalizing to `snack` guarantees every
 * entry is shown and counted exactly once.
 */
export const GroupedMealLog = memo(function GroupedMealLog({
  entries,
  onDelete,
  onRepeat,
}: {
  entries: MealEntry[];
  onDelete: (id: string) => void;
  /** Optional re-log handler, forwarded to each entry card. */
  onRepeat?: (id: string) => void;
}) {
  const groups = useMemo(() => {
    const byType = new Map<MealType, MealEntry[]>();
    for (const entry of entries) {
      const type = normalizeMealType(entry.meals[0]?.name);
      const list = byType.get(type) ?? [];
      list.push(entry);
      byType.set(type, list);
    }
    return MEAL_TYPE_ORDER.filter((t) => byType.has(t)).map((type) => {
      const groupEntries = byType.get(type) ?? [];
      return { type, entries: groupEntries, macros: sumEntryMacros(groupEntries) };
    });
  }, [entries]);

  return (
    <div className="space-y-5">
      {groups.map((group) => {
        const Icon = MEAL_TYPE_ICONS[group.type];
        return (
          <section key={group.type} className="space-y-3" aria-label={MEAL_TYPE_LABELS[group.type]}>
            <div
              className="flex items-center justify-between"
              style={{ borderBottom: '1px solid var(--fs-surface-2)', paddingBottom: 8 }}
            >
              <span
                className="flex items-center gap-2"
                style={{
                  fontFamily: 'var(--font-display)',
                  fontWeight: 800,
                  fontSize: 15,
                  color: 'var(--fs-ink)',
                  textTransform: 'uppercase',
                }}
              >
                <Icon size={15} style={{ color: 'var(--fs-accent)' }} aria-hidden="true" />
                {MEAL_TYPE_LABELS[group.type]}
              </span>
              <span
                dir="ltr"
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: 11,
                  letterSpacing: '0.1em',
                  color: 'var(--fs-muted)',
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                {group.macros.calories} KCAL · P{group.macros.protein} · C{group.macros.carbs} · F
                {group.macros.fat}
              </span>
            </div>
            {group.entries.map((entry) => (
              <MealEntryCard key={entry.id} entry={entry} onDelete={onDelete} onRepeat={onRepeat} />
            ))}
          </section>
        );
      })}
    </div>
  );
});

/**
 * Placeholder shown while the day's entries load, matching the grouped journal
 * shape (a header row plus two entry cards) so the layout doesn't jump when
 * real data arrives.
 */
export const MealLogSkeleton = memo(function MealLogSkeleton() {
  return (
    <div className="space-y-5" role="status" aria-busy="true" aria-label="טוען ארוחות">
      {[0, 1].map((group) => (
        <div key={group} className="space-y-3">
          <div
            className="flex items-center justify-between"
            style={{ borderBottom: '1px solid var(--fs-surface-2)', paddingBottom: 8 }}
          >
            <SkeletonBox width={120} height={15} borderRadius="sm" />
            <SkeletonBox width={90} height={11} borderRadius="sm" />
          </div>
          <div
            className="magnetic-card"
            style={{
              background: 'var(--fs-surface)',
              border: '1px solid var(--fs-surface-2)',
              borderRadius: '22px 16px 22px 16px',
              padding: 20,
            }}
          >
            <SkeletonBox width="40%" height={14} borderRadius="sm" className="mb-3" />
            <SkeletonBox width="55%" height={32} borderRadius="sm" className="mb-3" />
            <SkeletonBox width="80%" height={12} borderRadius="sm" />
          </div>
        </div>
      ))}
    </div>
  );
});

import { memo } from 'react';
import { MEAL_TYPE_ICONS, MEAL_TYPE_LABELS } from '../../../../services/nutritionService';
import type { MealType } from '../../../../types';

interface MealTypeSelectorProps {
  /** Currently selected type; when set the matching chip is highlighted. */
  selected?: MealType;
  onSelect: (m: MealType) => void;
  /** 'scroll' = single horizontal scrolling row (Add sheet); 'wrap' = flow-wrap
   *  (preset card quick-pick). */
  layout?: 'scroll' | 'wrap';
}

/**
 * Meal-type chip selector shared by AddMealModal and MealPresetCard, which each
 * previously inlined the same Object.entries(MEAL_TYPE_LABELS) chip loop. Chips
 * are 44px tall for touch; the selected chip uses the accent fill.
 */
export const MealTypeSelector = memo(function MealTypeSelector({
  selected,
  onSelect,
  layout = 'scroll',
}: MealTypeSelectorProps) {
  const isScroll = layout === 'scroll';
  return (
    <div
      className={
        isScroll ? 'flex gap-2 overflow-x-auto pb-0.5 no-scrollbar' : 'flex gap-2 flex-wrap'
      }
      role="group"
      aria-label="סוג ארוחה"
    >
      {(Object.entries(MEAL_TYPE_LABELS) as [MealType, string][]).map(([key, label]) => {
        const Icon = MEAL_TYPE_ICONS[key];
        const isActive = selected === key;
        return (
          <button
            type="button"
            key={key}
            onClick={() => onSelect(key)}
            aria-pressed={selected !== undefined ? isActive : undefined}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              flexShrink: 0,
              minHeight: 44,
              padding: '7px 14px',
              borderRadius: 12,
              fontSize: 12,
              fontWeight: 600,
              border: 'none',
              cursor: 'pointer',
              fontFamily: 'var(--font-hebrew)',
              transition: 'background-color 0.15s ease, color 0.15s ease',
              backgroundColor: isActive ? 'var(--fs-accent)' : 'var(--fs-surface-2)',
              // On the mint accent fill the ink must be the dark on-accent token
              // (dark in both themes); --fs-heading is near-white in dark mode and
              // would fail contrast on bright mint.
              color: isActive ? 'var(--color-ink-on-accent)' : 'var(--fs-muted)',
            }}
          >
            <Icon size={13} aria-hidden="true" />
            {label}
          </button>
        );
      })}
    </div>
  );
});

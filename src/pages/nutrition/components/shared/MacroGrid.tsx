import { memo } from 'react';
import { MACRO_COLORS } from '../../../../constants/nutrition';
import type { MacroNutrients } from '../../../../types';

interface MacroGridProps {
  macros: Pick<MacroNutrients, 'calories' | 'protein' | 'carbs' | 'fat'>;
  /** 'inline' = flat justify-around row used for the selected-foods total in
   *  the Add sheet; 'boxed' = 4-up grid of surface tiles used in the library
   *  expand panel. */
  variant?: 'inline' | 'boxed';
}

/**
 * Four-up macro readout (calories/protein/carbs/fat) shared by AddMealModal and
 * FoodLibrary, which previously inlined the same colored value+label grid.
 * Colors come from the shared MACRO_COLORS token map.
 */
export const MacroGrid = memo(function MacroGrid({ macros, variant = 'inline' }: MacroGridProps) {
  const isBoxed = variant === 'boxed';
  const items = [
    {
      key: 'calories',
      val: isBoxed ? `${macros.calories}` : macros.calories,
      label: isBoxed ? 'קל' : 'קלוריות',
      color: MACRO_COLORS.calories,
    },
    { key: 'protein', val: `${macros.protein}ג`, label: 'חלבון', color: MACRO_COLORS.protein },
    { key: 'carbs', val: `${macros.carbs}ג`, label: 'פחמימות', color: MACRO_COLORS.carbs },
    { key: 'fat', val: `${macros.fat}ג`, label: 'שומן', color: MACRO_COLORS.fat },
  ];

  return (
    <div
      className={isBoxed ? 'grid grid-cols-4 gap-2 text-center' : 'flex justify-around text-center'}
    >
      {items.map((m) => (
        <div
          key={m.key}
          style={
            isBoxed
              ? { borderRadius: 12, padding: '8px 4px', backgroundColor: 'var(--fs-surface-2)' }
              : undefined
          }
        >
          <div
            style={{
              fontFamily: 'var(--font-display)',
              fontWeight: isBoxed ? 700 : 900,
              fontSize: isBoxed ? 14 : 16,
              color: m.color,
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {m.val}
          </div>
          <div
            style={{
              fontFamily: 'var(--font-body)',
              fontSize: 12,
              color: 'var(--fs-muted)',
              marginTop: 2,
            }}
          >
            {m.label}
          </div>
        </div>
      ))}
    </div>
  );
});

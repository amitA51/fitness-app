import { m } from 'framer-motion';
import { memo } from 'react';
import { Sheet } from '../../../components/ui/Sheet';
import { MACRO_COLORS } from '../../../constants/nutrition';
import { calcFoodMacros } from '../../../services/nutritionService';
import type { FoodItem, MealType } from '../../../types';
import { useSearchFoods } from '../hooks/useSearchFoods';
import { FoodSearchInput } from './shared/FoodSearchInput';
import { MacroGrid } from './shared/MacroGrid';
import { MealTypeSelector } from './shared/MealTypeSelector';

interface AddMealModalProps {
  /** Whether the sheet is open. */
  isOpen: boolean;
  selectedMealType: MealType;
  onMealTypeChange: (m: MealType) => void;
  selectedFoods: (FoodItem & { servings: number })[];
  onAddFood: (f: FoodItem) => void;
  onRemoveFood: (id: string) => void;
  onServingsChange: (id: string, delta: number) => void;
  onSave: () => void;
  onClose: () => void;
  searchQuery: string;
  onSearchChange: (q: string) => void;
}

export const AddMealModal = memo(function AddMealModal({
  isOpen,
  selectedMealType,
  onMealTypeChange,
  selectedFoods,
  onAddFood,
  onRemoveFood,
  onServingsChange,
  onSave,
  onClose,
  searchQuery,
  onSearchChange,
}: AddMealModalProps) {
  const foods = useSearchFoods(searchQuery);
  const totalMacros = selectedFoods.reduce(
    (acc, f) => {
      const m = calcFoodMacros(f);
      return {
        calories: acc.calories + m.calories,
        protein: acc.protein + m.protein,
        carbs: acc.carbs + m.carbs,
        fat: acc.fat + m.fat,
      };
    },
    { calories: 0, protein: 0, carbs: 0, fat: 0 }
  );

  const hasFoods = selectedFoods.length > 0;

  return (
    <Sheet
      isOpen={isOpen}
      onClose={onClose}
      title="הוסף ארוחה"
      footer={
        <m.button
          onClick={onSave}
          disabled={!hasFoods}
          style={{
            width: '100%',
            minHeight: 52,
            padding: '16px',
            borderRadius: 0,
            backgroundColor: hasFoods ? 'var(--fs-primary)' : 'var(--fs-surface-2)',
            color: hasFoods ? 'var(--fs-accent)' : 'var(--fs-muted)',
            fontFamily: 'var(--font-display)',
            fontWeight: 800,
            fontSize: '16px',
            textTransform: 'uppercase',
            border: 'none',
            cursor: hasFoods ? 'pointer' : 'not-allowed',
            opacity: hasFoods ? 1 : 0.4,
          }}
          whileTap={{ scale: hasFoods ? 0.98 : 1 }}
        >
          שמור ארוחה {hasFoods && `(${totalMacros.calories} קל׳)`}
        </m.button>
      }
    >
      <div className="space-y-4">
        <MealTypeSelector selected={selectedMealType} onSelect={onMealTypeChange} layout="scroll" />

        {hasFoods && (
          <div className="space-y-2">
            <h3
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: '14px',
                fontWeight: 800,
                color: 'var(--fs-ink)',
                textTransform: 'uppercase',
              }}
            >
              מזונות שנבחרו
            </h3>
            {selectedFoods.map((food) => (
              <div
                key={food.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  backgroundColor: 'var(--fs-surface-2)',
                  borderRadius: '14px',
                  padding: '14px',
                }}
              >
                <div>
                  <span
                    style={{
                      fontFamily: 'var(--font-hebrew)',
                      fontSize: '14px',
                      fontWeight: 500,
                      color: 'var(--fs-ink)',
                    }}
                  >
                    {food.name}
                  </span>
                  <div className="flex items-center gap-2 mt-1.5">
                    <button
                      type="button"
                      onClick={() => onServingsChange(food.id, -0.5)}
                      style={{
                        width: '44px',
                        height: '44px',
                        borderRadius: '10px',
                        backgroundColor: 'var(--fs-surface)',
                        color: 'var(--fs-ink)',
                        border: '1px solid var(--fs-surface-2)',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontWeight: 700,
                        fontSize: '18px',
                      }}
                      aria-label="הפחת חצי מנה"
                    >
                      −
                    </button>
                    <span
                      style={{
                        fontFamily: 'var(--font-mono)',
                        fontSize: '14px',
                        color: 'var(--fs-ink)',
                        width: '32px',
                        textAlign: 'center',
                        fontWeight: 500,
                        fontVariantNumeric: 'tabular-nums',
                      }}
                    >
                      {food.servings}
                    </span>
                    <button
                      type="button"
                      onClick={() => onServingsChange(food.id, 0.5)}
                      style={{
                        width: '44px',
                        height: '44px',
                        borderRadius: '10px',
                        backgroundColor: 'var(--fs-surface)',
                        color: 'var(--fs-ink)',
                        border: '1px solid var(--fs-surface-2)',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontWeight: 700,
                        fontSize: '18px',
                      }}
                      aria-label="הוסף חצי מנה"
                    >
                      +
                    </button>
                  </div>
                </div>
                <div className="text-end">
                  <span
                    style={{
                      fontFamily: 'var(--font-display)',
                      fontWeight: 700,
                      fontSize: '14px',
                      color: MACRO_COLORS.calories,
                    }}
                  >
                    {calcFoodMacros(food).calories} קל׳
                  </span>
                  <button
                    type="button"
                    onClick={() => onRemoveFood(food.id)}
                    style={{
                      // Destructive action → error token, never --fs-warn.
                      fontSize: '12px',
                      color: 'var(--color-error)',
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      marginTop: '4px',
                      // Pad to a comfortable tap target for the destructive control.
                      minHeight: '36px',
                      paddingInline: '8px',
                    }}
                  >
                    הסר
                  </button>
                </div>
              </div>
            ))}
            <div
              style={{
                backgroundColor: 'var(--fs-surface-2)',
                borderRadius: '14px',
                padding: '14px',
                border: '1px solid var(--fs-surface-2)',
              }}
            >
              <MacroGrid macros={totalMacros} variant="inline" />
            </div>
          </div>
        )}

        <FoodSearchInput value={searchQuery} onChange={onSearchChange} variant="sheet" />

        {searchQuery.trim() && foods.length === 0 ? (
          <div
            className="flex flex-col items-center justify-center py-10 text-center"
            style={{ fontFamily: 'var(--font-body)' }}
          >
            <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--fs-muted)' }}>
              לא נמצא מזון מתאים
            </span>
            <span style={{ fontSize: '12px', color: 'var(--fs-muted)', marginTop: '4px' }}>
              נסו שם אחר או קיצור
            </span>
          </div>
        ) : (
          <div className="space-y-1.5 max-h-56 overflow-y-auto">
            {foods.slice(0, 20).map((food) => (
              <button
                type="button"
                key={food.id}
                onClick={() => onAddFood(food)}
                style={{
                  width: '100%',
                  minHeight: 44,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '14px',
                  borderRadius: '14px',
                  backgroundColor: 'var(--fs-surface-2)',
                  border: 'none',
                  cursor: 'pointer',
                  textAlign: 'start',
                  transition: 'background-color 0.15s ease',
                }}
              >
                <div>
                  <span
                    style={{
                      fontFamily: 'var(--font-hebrew)',
                      fontSize: '14px',
                      color: 'var(--fs-ink)',
                    }}
                  >
                    {food.name}
                  </span>
                  <span
                    style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: '11px',
                      color: 'var(--fs-muted)',
                      marginInlineStart: '8px',
                    }}
                  >
                    {/* Leading middot keeps the accessible name from reading
                        as one word ("חזה עוף100ג") — margin alone is visual. */}
                    · {food.servingSize}
                  </span>
                </div>
                <span
                  style={{
                    fontFamily: 'var(--font-display)',
                    fontWeight: 700,
                    fontSize: '14px',
                    color: MACRO_COLORS.calories,
                  }}
                >
                  {food.calories} קל׳
                </span>
              </button>
            ))}
          </div>
        )}
      </div>
    </Sheet>
  );
});

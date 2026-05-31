import { motion } from 'framer-motion';
import { Search, X } from 'lucide-react';
import { memo, useMemo } from 'react';
import {
  MEAL_TYPE_ICONS,
  MEAL_TYPE_LABELS,
  calcFoodMacros,
  searchFoods,
} from '../../../services/nutritionService';
import type { FoodItem, MealType } from '../../../types';

const MACRO_COLORS = {
  calories: 'var(--fs-warn)',
  protein: 'var(--fs-accent)',
  carbs: 'var(--fs-accent-2)',
  fat: 'var(--fs-signal)',
};

interface AddMealModalProps {
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
  const foods = useMemo(() => searchFoods(searchQuery), [searchQuery]);
  const totalMacros = useMemo(
    () =>
      selectedFoods.reduce(
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
      ),
    [selectedFoods]
  );

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 28, stiffness: 300 }}
        className="w-full max-w-lg rounded-t-[28px] max-h-[88vh] overflow-y-auto"
        style={{
          background: 'var(--fs-surface)',
          paddingBottom: 'max(16px, env(safe-area-inset-bottom, 16px))',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full" style={{ background: 'var(--fs-surface-2)' }} />
        </div>

        <div
          className="sticky top-0 z-10 px-5 pt-[max(env(safe-area-inset-top,0px),8px)] pb-4"
          style={{
            background: 'var(--fs-surface)',
            borderBottom: '1px solid var(--fs-surface-2)',
          }}
        >
          <div className="flex items-center justify-between mb-4">
            <h2
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: '18px',
                fontWeight: 800,
                color: 'var(--fs-ink)',
                textTransform: 'uppercase',
              }}
            >
              הוסף ארוחה
            </h2>
            <button
              type="button"
              onClick={onClose}
              className="w-12 h-12 flex items-center justify-center"
              style={{
                borderRadius: '50%',
                background: 'var(--fs-surface-2)',
                color: 'var(--fs-muted)',
                border: 'none',
                cursor: 'pointer',
              }}
              aria-label="סגור"
            >
              <X size={17} />
            </button>
          </div>
          <div className="flex gap-2 overflow-x-auto pb-0.5 no-scrollbar">
            {Object.entries(MEAL_TYPE_LABELS).map(([key, label]) => {
              const Icon = MEAL_TYPE_ICONS[key as MealType];
              return (
                <button
                  type="button"
                  key={key}
                  onClick={() => onMealTypeChange(key as MealType)}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    flexShrink: 0,
                    padding: '7px 14px',
                    borderRadius: '12px',
                    fontSize: '12px',
                    fontWeight: 600,
                    border: 'none',
                    cursor: 'pointer',
                    fontFamily: 'var(--font-hebrew)',
                    transition: 'all 0.15s ease',
                    ...(selectedMealType === key
                      ? { backgroundColor: 'var(--fs-accent)', color: 'var(--fs-heading)' }
                      : { backgroundColor: 'var(--fs-surface-2)', color: 'var(--fs-muted)' }),
                  }}
                >
                  <Icon size={13} />
                  {label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="p-5 space-y-4">
          {selectedFoods.length > 0 && (
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
                        display: 'block',
                        fontSize: '12px',
                        color: 'var(--fs-warn)',
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        marginTop: '4px',
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
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-around',
                    textAlign: 'center',
                  }}
                >
                  {[
                    { val: totalMacros.calories, label: 'קלוריות', color: MACRO_COLORS.calories },
                    { val: `${totalMacros.protein}ג`, label: 'חלבון', color: MACRO_COLORS.protein },
                    { val: `${totalMacros.carbs}ג`, label: 'פחמימות', color: MACRO_COLORS.carbs },
                    { val: `${totalMacros.fat}ג`, label: 'שומן', color: MACRO_COLORS.fat },
                  ].map((m) => (
                    <div key={m.label}>
                      <div
                        style={{
                          fontFamily: 'var(--font-display)',
                          fontWeight: 900,
                          fontSize: '16px',
                          color: m.color,
                        }}
                      >
                        {m.val}
                      </div>
                      <div
                        style={{
                          fontFamily: 'var(--font-mono)',
                          fontSize: '10px',
                          color: 'var(--fs-muted)',
                          marginTop: '2px',
                        }}
                      >
                        {m.label}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          <div className="relative">
            <Search
              size={16}
              className="absolute top-1/2 -translate-y-1/2 right-4"
              style={{ color: 'var(--fs-muted)' }}
            />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="חפש מזון..."
              style={{
                width: '100%',
                backgroundColor: 'var(--fs-surface-2)',
                border: '1px solid var(--fs-surface-2)',
                borderRadius: '14px',
                padding: '12px 40px 12px 16px',
                color: 'var(--fs-ink)',
                fontFamily: 'var(--font-hebrew)',
                fontSize: '14px',
                minHeight: '48px',
              }}
            />
          </div>

          <div className="space-y-1.5 max-h-56 overflow-y-auto">
            {foods.slice(0, 20).map((food) => (
              <button
                type="button"
                key={food.id}
                onClick={() => onAddFood(food)}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '14px',
                  borderRadius: '14px',
                  backgroundColor: 'var(--fs-surface-2)',
                  border: 'none',
                  cursor: 'pointer',
                  textAlign: 'start',
                  transition: 'all 0.15s ease',
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
                    {food.servingSize}
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

          <motion.button
            onClick={onSave}
            disabled={selectedFoods.length === 0}
            style={{
              width: '100%',
              padding: '16px',
              borderRadius: 0,
              backgroundColor:
                selectedFoods.length > 0 ? 'var(--fs-primary)' : 'var(--fs-surface-2)',
              color: selectedFoods.length > 0 ? 'var(--fs-accent)' : 'var(--fs-muted)',
              fontFamily: 'var(--font-display)',
              fontWeight: 800,
              fontSize: '16px',
              textTransform: 'uppercase',
              border: 'none',
              cursor: selectedFoods.length > 0 ? 'pointer' : 'not-allowed',
              opacity: selectedFoods.length > 0 ? 1 : 0.4,
            }}
            whileTap={{ scale: selectedFoods.length > 0 ? 0.98 : 1 }}
          >
            שמור ארוחה {selectedFoods.length > 0 && `(${totalMacros.calories} קל׳)`}
          </motion.button>
        </div>
      </motion.div>
    </motion.div>
  );
});

import { AnimatePresence, motion } from 'framer-motion';
import { ChevronDown, ChevronUp, Plus } from 'lucide-react';
import { memo, useState } from 'react';
import { MACRO_COLORS } from '../../../constants/nutrition';
import type { FoodItem } from '../../../types';
import { FoodSearchInput } from './shared/FoodSearchInput';
import { MacroGrid } from './shared/MacroGrid';

interface FoodLibraryProps {
  foods: FoodItem[];
  onAddFood: (f: FoodItem) => void;
  searchQuery: string;
  onSearchChange: (q: string) => void;
}

export const FoodLibrary = memo(function FoodLibrary({
  foods,
  onAddFood,
  searchQuery,
  onSearchChange,
}: FoodLibraryProps) {
  const [expanded, setExpanded] = useState<string | null>(null);
  return (
    <div>
      <div className="mb-4">
        <FoodSearchInput value={searchQuery} onChange={onSearchChange} variant="panel" />
      </div>
      <div className="space-y-2">
        {foods.map((food) => (
          <div
            key={food.id}
            className="magnetic-card glass-surface"
            style={{
              background: 'var(--fs-surface)',
              border: '1px solid var(--fs-surface-2)',
              borderRadius: '22px 16px 22px 16px',
              overflow: 'hidden',
              boxShadow: 'var(--shadow-card)',
            }}
          >
            <button
              type="button"
              onClick={() => setExpanded(expanded === food.id ? null : food.id)}
              className="w-full flex items-center justify-between p-3 text-start"
            >
              <div>
                <span
                  style={{
                    fontFamily: 'var(--font-body)',
                    fontWeight: 600,
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
              <div className="flex items-center gap-2">
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
                {expanded === food.id ? (
                  <ChevronUp size={15} style={{ color: 'var(--fs-muted)' }} />
                ) : (
                  <ChevronDown size={15} style={{ color: 'var(--fs-muted)' }} />
                )}
              </div>
            </button>
            <AnimatePresence>
              {expanded === food.id && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden"
                >
                  <div
                    className="px-4 pb-4 pt-2"
                    style={{ borderTop: '1px solid var(--fs-surface-2)' }}
                  >
                    <div className="mb-4">
                      <MacroGrid
                        macros={{
                          calories: food.calories,
                          protein: food.protein,
                          carbs: food.carbs,
                          fat: food.fat,
                        }}
                        variant="boxed"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => onAddFood(food)}
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
                      <Plus size={14} />
                      הוסף
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        ))}
      </div>
    </div>
  );
});

import { AnimatePresence, motion } from 'framer-motion';
import { ChevronDown, ChevronUp, Plus, Search } from 'lucide-react';
import { memo, useState } from 'react';
import type { FoodItem } from '../../../types';

const MACRO_COLORS = {
  calories: 'var(--fs-warn)',
  protein: 'var(--fs-accent)',
  carbs: 'var(--fs-accent-2)',
  fat: 'var(--fs-signal)',
};

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
      <div className="relative mb-4">
        <Search
          size={16}
          className="absolute top-1/2 -translate-y-1/2 end-4"
          style={{ color: 'var(--fs-muted)' }}
        />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="חפש מזון..."
          className="w-full py-3 pe-11 ps-5 text-sm"
          style={{
            backgroundColor: 'var(--fs-surface)',
            border: '1px solid var(--fs-surface-2)',
            borderRadius: 0,
            color: 'var(--fs-ink)',
            fontFamily: 'var(--font-body)',
            minHeight: '48px',
          }}
        />
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
                    <div className="grid grid-cols-4 gap-2 text-center text-xs mb-4">
                      {[
                        { val: food.calories, label: 'קל', color: MACRO_COLORS.calories },
                        { val: `${food.protein}ג`, label: 'חלבון', color: MACRO_COLORS.protein },
                        { val: `${food.carbs}ג`, label: 'פחמימות', color: MACRO_COLORS.carbs },
                        { val: `${food.fat}ג`, label: 'שומן', color: MACRO_COLORS.fat },
                      ].map((m) => (
                        <div
                          key={m.label}
                          style={{
                            borderRadius: '12px',
                            padding: '8px 4px',
                            backgroundColor: 'var(--fs-surface-2)',
                          }}
                        >
                          <div
                            style={{
                              fontFamily: 'var(--font-display)',
                              fontWeight: 700,
                              fontSize: '14px',
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

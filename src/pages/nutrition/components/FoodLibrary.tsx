import { Stagger, StaggerItem } from '@/components/motion/Stagger';
import { SkeletonBox } from '@/components/ui/SkeletonLoader';
import { AnimatePresence, m } from 'framer-motion';
import { ChevronDown, ChevronUp, Plus, SearchX, UtensilsCrossed } from 'lucide-react';
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
  /** True while the food library is still resolving (initial day-load). */
  isLoading?: boolean;
}

/**
 * Loading placeholder matching the accordion-card layout (a row of name +
 * calorie chips) so the list doesn't jump when results arrive — a skeleton, not
 * a spinner.
 */
const FoodLibrarySkeleton = memo(function FoodLibrarySkeleton() {
  return (
    <div className="space-y-2" role="status" aria-busy="true" aria-label="טוען מזון">
      {[0, 1, 2, 3].map((row) => (
        <div
          key={row}
          style={{
            background: 'var(--fs-surface)',
            border: '1px solid var(--fs-surface-2)',
            borderRadius: '22px 16px 22px 16px',
            padding: 12,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
          }}
        >
          <SkeletonBox width="45%" height={16} borderRadius="sm" />
          <SkeletonBox width={56} height={16} borderRadius="sm" />
        </div>
      ))}
    </div>
  );
});

/** Empty results when a search returned nothing — explicit, with a recovery hint. */
const NoSearchResults = memo(function NoSearchResults() {
  return (
    <div
      className="flex flex-col items-center justify-center py-12 text-center"
      style={{ fontFamily: 'var(--font-body)' }}
    >
      <div
        className="flex items-center justify-center mb-3"
        style={{
          width: 52,
          height: 52,
          background: 'var(--fs-surface-2)',
          color: 'var(--fs-muted)',
        }}
      >
        <SearchX size={24} aria-hidden="true" />
      </div>
      <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--fs-ink)' }}>
        לא נמצא מזון מתאים
      </span>
      <span style={{ fontSize: '12px', color: 'var(--fs-muted)', marginTop: '4px' }}>
        נסו שם אחר או קיצור
      </span>
    </div>
  );
});

/** Initial state before any search — shows the user HOW to populate the list. */
const SearchPrompt = memo(function SearchPrompt() {
  return (
    <div
      className="flex flex-col items-center justify-center py-12 text-center"
      style={{ fontFamily: 'var(--font-body)' }}
    >
      <div
        className="flex items-center justify-center mb-3"
        style={{
          width: 52,
          height: 52,
          background: 'var(--fs-surface-2)',
          color: 'var(--fs-accent)',
        }}
      >
        <UtensilsCrossed size={24} aria-hidden="true" />
      </div>
      <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--fs-ink)' }}>
        חפשו מזון להוספה
      </span>
      <span
        style={{ fontSize: '12px', color: 'var(--fs-muted)', marginTop: '4px', maxWidth: '26ch' }}
      >
        הקלידו שם מאכל בתיבת החיפוש כדי לראות ערכים תזונתיים ולהוסיף ליומן
      </span>
    </div>
  );
});

export const FoodLibrary = memo(function FoodLibrary({
  foods,
  onAddFood,
  searchQuery,
  onSearchChange,
  isLoading = false,
}: FoodLibraryProps) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const hasQuery = searchQuery.trim().length > 0;

  // State cycle: loading → search-prompt (no query) → no-results → success list.
  let body: React.ReactNode;
  if (isLoading) {
    body = <FoodLibrarySkeleton />;
  } else if (!hasQuery && foods.length === 0) {
    body = <SearchPrompt />;
  } else if (hasQuery && foods.length === 0) {
    body = <NoSearchResults />;
  } else {
    body = (
      <Stagger className="space-y-2" stagger={0.05}>
        {foods.map((food) => (
          <StaggerItem
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
              aria-expanded={expanded === food.id}
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
                  {/* Leading middot keeps the accessible name from reading
                      as one word ("חזה עוף100ג") — margin alone is visual. */}
                  · {food.servingSize}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span
                  dir="ltr"
                  style={{
                    fontFamily: 'var(--font-display)',
                    fontWeight: 700,
                    fontSize: '14px',
                    color: MACRO_COLORS.calories,
                    fontVariantNumeric: 'tabular-nums',
                  }}
                >
                  {food.calories} קל׳
                </span>
                {expanded === food.id ? (
                  <ChevronUp size={15} style={{ color: 'var(--fs-muted)' }} aria-hidden="true" />
                ) : (
                  <ChevronDown size={15} style={{ color: 'var(--fs-muted)' }} aria-hidden="true" />
                )}
              </div>
            </button>
            <AnimatePresence>
              {expanded === food.id && (
                <m.div
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
                        borderRadius: 12,
                        backgroundColor: 'var(--fs-primary)',
                        color: 'var(--fs-accent)',
                        fontFamily: 'var(--font-display)',
                        fontSize: '13px',
                        fontWeight: 600,
                        border: 'none',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '4px',
                      }}
                    >
                      <Plus size={14} aria-hidden="true" />
                      הוסף
                    </button>
                  </div>
                </m.div>
              )}
            </AnimatePresence>
          </StaggerItem>
        ))}
      </Stagger>
    );
  }

  return (
    <div>
      <div className="mb-4">
        <FoodSearchInput value={searchQuery} onChange={onSearchChange} variant="panel" />
      </div>
      {body}
    </div>
  );
});

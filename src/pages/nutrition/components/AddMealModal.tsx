import { useCountUp } from '@/hooks/useCountUp';
import { m } from 'framer-motion';
import { Barcode, Check } from 'lucide-react';
import { type CSSProperties, memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Sheet } from '../../../components/ui/Sheet';
import { MACRO_COLORS } from '../../../constants/nutrition';
import { isBarcodeScanSupported } from '../../../services/barcodeFood';
import { calcFoodMacros } from '../../../services/nutritionService';
import type { FoodItem, MealType } from '../../../types';
import { useSearchFoods } from '../hooks/useSearchFoods';
import { getRecentFoods } from '../recentFoods';
import { BarcodeScanner } from './BarcodeScanner';
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
  // Last-logged foods (most-recent-first) — re-read each time the sheet opens
  // so a meal saved a moment ago already shows on the shelf.
  const recentFoods = useMemo(() => (isOpen ? getRecentFoods() : []), [isOpen]);

  // Barcode flow — the button always opens the scanner sheet; camera support
  // (BarcodeDetector, Chrome/Android) only decides whether the sheet shows a
  // live viewfinder or manual barcode entry alone (iOS Safari).
  const [showScanner, setShowScanner] = useState(false);
  const [cameraSupported, setCameraSupported] = useState(false);
  useEffect(() => {
    let active = true;
    isBarcodeScanSupported().then((supported) => {
      if (active) setCameraSupported(supported);
    });
    return () => {
      active = false;
    };
  }, []);

  // A scanned product enters through the SAME path as a picked food. The
  // serving amount chosen in the scanner is applied as a delta on top of the
  // single serving handleAddFood registers.
  const handleBarcodeAdd = useCallback(
    (food: FoodItem, servings: number) => {
      onAddFood(food);
      if (servings !== 1) onServingsChange(food.id, servings - 1);
    },
    [onAddFood, onServingsChange]
  );
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

  // Count-up the running calorie total in the save CTA, re-tweening from the
  // previous total each time a food/serving changes. Reduced-motion snaps.
  const totalRef = useRef<HTMLSpanElement>(null);
  const prevTotalRef = useRef(0);
  useCountUp(totalRef, totalMacros.calories, { from: prevTotalRef.current, pop: true });
  prevTotalRef.current = totalMacros.calories;

  return (
    <>
      <Sheet
        isOpen={isOpen}
        // While the scanner sheet is stacked above, both focus traps hear Esc —
        // route this sheet's close to the scanner so one Esc doesn't close both.
        onClose={showScanner ? () => setShowScanner(false) : onClose}
        title="הוסף ארוחה"
        footer={
          <m.button
            onClick={onSave}
            disabled={!hasFoods}
            style={{
              width: '100%',
              minHeight: 52,
              padding: '16px',
              borderRadius: 12,
              backgroundColor: hasFoods ? 'var(--fs-primary)' : 'var(--fs-surface-2)',
              color: hasFoods ? 'var(--fs-accent)' : 'var(--fs-muted)',
              fontFamily: 'var(--font-display)',
              fontWeight: 600,
              fontSize: '16px',
                            border: 'none',
              cursor: hasFoods ? 'pointer' : 'not-allowed',
              opacity: hasFoods ? 1 : 0.4,
            }}
            whileTap={{ scale: hasFoods ? 0.98 : 1 }}
          >
            שמור ארוחה{' '}
            {hasFoods && (
              <>
                (
                <span ref={totalRef} dir="ltr" style={{ fontVariantNumeric: 'tabular-nums' }}>
                  {totalMacros.calories}
                </span>{' '}
                קל׳)
              </>
            )}
          </m.button>
        }
      >
        <div className="space-y-4">
          <MealTypeSelector
            selected={selectedMealType}
            onSelect={onMealTypeChange}
            layout="scroll"
          />

          {hasFoods && (
            <div className="space-y-2">
              <h3
                style={{
                  fontFamily: 'var(--font-display)',
                  fontSize: '14px',
                  fontWeight: 600,
                  color: 'var(--fs-ink)',
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
                      <m.button
                        type="button"
                        onClick={() => onServingsChange(food.id, -0.5)}
                        whileTap={{ scale: 0.94 }}
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
                      </m.button>
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
                      <m.button
                        type="button"
                        onClick={() => onServingsChange(food.id, 0.5)}
                        whileTap={{ scale: 0.94 }}
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
                      </m.button>
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

          <div className="flex gap-2">
            <div style={{ flex: 1, minWidth: 0 }}>
              <FoodSearchInput value={searchQuery} onChange={onSearchChange} variant="sheet" />
            </div>
            <m.button
              type="button"
              onClick={() => setShowScanner(true)}
              whileTap={{ scale: 0.98 }}
              aria-label={cameraSupported ? 'סריקת ברקוד' : 'הזנת ברקוד'}
              style={{
                width: 48,
                minHeight: 48,
                flexShrink: 0,
                borderRadius: 14,
                backgroundColor: 'var(--fs-surface-2)',
                border: '1px solid var(--fs-surface-2)',
                color: 'var(--fs-accent-2)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Barcode size={20} aria-hidden="true" />
            </m.button>
          </div>

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
              {/* Recents shelf — repeat meals first, no search needed. Only when
                browsing (a search query replaces the shelf with results). */}
              {!searchQuery.trim() && recentFoods.length > 0 && (
                <>
                  <h4 style={LIST_KICKER_STYLE}>אחרונים</h4>
                  {recentFoods.map((food) => (
                    <FoodRow
                      key={`recent-${food.id}`}
                      food={food}
                      selected={selectedFoods.find((f) => f.id === food.id)}
                      onAddFood={onAddFood}
                    />
                  ))}
                  <h4 style={LIST_KICKER_STYLE}>כל המזונות</h4>
                </>
              )}
              {foods.slice(0, 20).map((food) => (
                <FoodRow
                  key={food.id}
                  food={food}
                  selected={selectedFoods.find((f) => f.id === food.id)}
                  onAddFood={onAddFood}
                />
              ))}
              {/* Truncation footer — without it a hidden 21st+ match reads as
                  "food not in library". Honesty fix; numbers render dir="ltr". */}
              {foods.length > 20 && (
                <p style={{ ...LIST_KICKER_STYLE, textAlign: 'center', margin: '8px 2px 2px' }}>
                  מציג{' '}
                  <span dir="ltr" style={{ fontVariantNumeric: 'tabular-nums' }}>
                    20
                  </span>{' '}
                  מתוך{' '}
                  <span dir="ltr" style={{ fontVariantNumeric: 'tabular-nums' }}>
                    {foods.length}
                  </span>{' '}
                  — חדדו את החיפוש
                </p>
              )}
            </div>
          )}
        </div>
      </Sheet>

      {/* Barcode scanner — separate sheet layered above the add sheet. */}
      <BarcodeScanner
        isOpen={isOpen && showScanner}
        onClose={() => setShowScanner(false)}
        cameraSupported={cameraSupported}
        onAdd={handleBarcodeAdd}
      />
    </>
  );
});

// Mono kicker separating the "אחרונים" shelf from the full list.
const LIST_KICKER_STYLE: CSSProperties = {
  fontFamily: 'var(--font-mono)',
  fontSize: '10px',
  letterSpacing: '0.16em',
    color: 'var(--fs-muted)',
  margin: '4px 2px 2px',
};

// Single tappable result row, shared by the recents shelf and the main list.
function FoodRow({
  food,
  selected,
  onAddFood,
}: {
  food: FoodItem;
  selected: (FoodItem & { servings: number }) | undefined;
  onAddFood: (f: FoodItem) => void;
}) {
  // Already-added foods get an in-place Check + serving count so the
  // tap is confirmed even when the selected list is scrolled off-screen
  // above the results. Tapping again adds another serving.
  return (
    <m.button
      type="button"
      onClick={() => onAddFood(food)}
      whileTap={{ scale: 0.98 }}
      aria-label={
        selected
          ? `${food.name}, נבחר, ${selected.servings} מנות. הקש להוספת מנה`
          : `הוסף ${food.name}`
      }
      style={{
        width: '100%',
        minHeight: 44,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '14px',
        borderRadius: '14px',
        backgroundColor: selected
          ? 'color-mix(in srgb, var(--fs-accent) 14%, var(--fs-surface-2))'
          : 'var(--fs-surface-2)',
        border: selected
          ? '1px solid color-mix(in srgb, var(--fs-accent) 45%, transparent)'
          : '1px solid transparent',
        cursor: 'pointer',
        textAlign: 'start',
        transition: 'background-color 0.15s ease, border-color 0.15s ease',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
        {selected && (
          <span
            aria-hidden="true"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 20,
              height: 20,
              flexShrink: 0,
              borderRadius: '50%',
              background: 'var(--fs-accent)',
              color: 'var(--color-ink-on-accent)',
            }}
          >
            <Check size={13} strokeWidth={3} />
          </span>
        )}
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
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
        {selected && (
          <span
            dir="ltr"
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '11px',
              fontWeight: 700,
              color: 'var(--fs-accent-2)',
            }}
          >
            ×{selected.servings}
          </span>
        )}
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
      </div>
    </m.button>
  );
}

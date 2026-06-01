import { Search } from 'lucide-react';
import { memo } from 'react';

interface FoodSearchInputProps {
  value: string;
  onChange: (q: string) => void;
  /** Visual treatment: 'sheet' (rounded, surface-2 fill for the Add sheet) or
   *  'panel' (sharp, surface fill for the library list). */
  variant?: 'sheet' | 'panel';
  placeholder?: string;
}

/**
 * Single search input shared by AddMealModal and FoodLibrary (each previously
 * inlined its own near-identical version). RTL-correct: the icon is anchored at
 * the logical `end` and text aligns to `start`. 48px min height for touch.
 */
export const FoodSearchInput = memo(function FoodSearchInput({
  value,
  onChange,
  variant = 'sheet',
  placeholder = 'חפש מזון...',
}: FoodSearchInputProps) {
  const isSheet = variant === 'sheet';
  return (
    <div className="relative">
      <Search
        size={16}
        className="absolute top-1/2 -translate-y-1/2 end-4"
        style={{ color: 'var(--fs-muted)' }}
        aria-hidden="true"
      />
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
        className="w-full pe-11 ps-4"
        style={{
          backgroundColor: isSheet ? 'var(--fs-surface-2)' : 'var(--fs-surface)',
          border: '1px solid var(--fs-surface-2)',
          borderRadius: isSheet ? 14 : 0,
          padding: '12px 16px',
          color: 'var(--fs-ink)',
          fontFamily: 'var(--font-hebrew)',
          fontSize: 14,
          minHeight: 48,
          textAlign: 'start',
        }}
      />
    </div>
  );
});

import { useMemo } from 'react';
import { searchFoods } from '../../../services/nutritionService';
import type { FoodItem } from '../../../types';

/**
 * Single source for food-search results. Wraps the pure `searchFoods` service
 * function (which owns the one filtering implementation against FOOD_LIBRARY)
 * in a memoized hook, so AddMealModal and useNutritionData no longer each
 * inline their own `useMemo(() => searchFoods(query), [query])`.
 */
export function useSearchFoods(query: string): FoodItem[] {
  return useMemo(() => searchFoods(query), [query]);
}

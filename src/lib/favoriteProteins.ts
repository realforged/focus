export interface FavoriteProteinItem {
  id: string;
  name: string;
  protein: number;
  calories?: number;
  carbs?: number;
  fats?: number;
  fiber?: number;
  emoji?: string;
}

export const DEFAULT_POPULAR_PROTEINS: FavoriteProteinItem[] = [
  { id: 'fav_whey', name: 'Whey Protein Shake', protein: 25, calories: 120, carbs: 2, fats: 1, fiber: 0, emoji: '🥤' },
  { id: 'fav_chicken', name: 'Chicken Breast (150g)', protein: 46, calories: 240, carbs: 0, fats: 5, fiber: 0, emoji: '🍗' },
  { id: 'fav_eggs', name: '3 Whole Eggs', protein: 18, calories: 215, carbs: 1, fats: 15, fiber: 0, emoji: '🥚' },
  { id: 'fav_yogurt', name: 'Greek Yogurt (1 cup)', protein: 18, calories: 130, carbs: 6, fats: 2, fiber: 0, emoji: '🥣' },
  { id: 'fav_paneer', name: 'Paneer / Cottage Cheese (100g)', protein: 18, calories: 260, carbs: 4, fats: 20, fiber: 0, emoji: '🧀' },
  { id: 'fav_tofu', name: 'Tofu (150g)', protein: 15, calories: 120, carbs: 3, fats: 6, fiber: 1, emoji: '🌱' },
  { id: 'fav_tuna', name: 'Canned Tuna (1 can)', protein: 30, calories: 130, carbs: 0, fats: 1, fiber: 0, emoji: '🐟' },
  { id: 'fav_eggwhites', name: 'Egg Whites (4 large)', protein: 14, calories: 68, carbs: 1, fats: 0, fiber: 0, emoji: '🍳' },
  { id: 'fav_salmon', name: 'Salmon Fillet (150g)', protein: 34, calories: 310, carbs: 0, fats: 18, fiber: 0, emoji: '🍣' },
  { id: 'fav_pb', name: 'Peanut Butter (2 tbsp)', protein: 8, calories: 190, carbs: 7, fats: 16, fiber: 2, emoji: '🥜' },
];

export const FAVORITES_STORAGE_KEYS = [
  'focus_now_favorite_proteins_v1',
  '90day_favorite_foods',
];

export function getStoredFavoriteProteins(): FavoriteProteinItem[] {
  for (const key of FAVORITES_STORAGE_KEYS) {
    try {
      const raw = localStorage.getItem(key);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      }
    } catch {}
  }
  return DEFAULT_POPULAR_PROTEINS;
}

export function saveStoredFavoriteProteins(items: FavoriteProteinItem[]): void {
  for (const key of FAVORITES_STORAGE_KEYS) {
    try {
      localStorage.setItem(key, JSON.stringify(items));
    } catch {}
  }
  // Dispatch custom storage event for live tab/component synchronization
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('focus_now_favorites_updated', { detail: items }));
  }
}

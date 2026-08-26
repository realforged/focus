import type { NutritionTargets } from '../types';

export type TimeBlock = 'Morning' | 'Afternoon' | 'Evening' | 'Night';

export const TIME_BLOCKS: TimeBlock[] = ['Morning', 'Afternoon', 'Evening', 'Night'];

export const BLOCK_META: Record<TimeBlock, { label: string; short: string; icon: string }> = {
  Morning: { label: 'Morning', short: 'AM', icon: '☀️' },
  Afternoon: { label: 'Afternoon', short: 'PM', icon: '🌤️' },
  Evening: { label: 'Evening', short: 'Eve', icon: '🌆' },
  Night: { label: 'Night', short: 'Night', icon: '🌙' },
};

export const BLOCK_PROTEIN_KEYS: Record<TimeBlock, keyof NutritionTargets> = {
  Morning: 'morningProtein',
  Afternoon: 'afternoonProtein',
  Evening: 'eveningProtein',
  Night: 'nightProtein',
};

/** Unified time-block boundaries (matches Daily Scheduler) */
export const getCurrentTimeBlock = (): TimeBlock => {
  const h = new Date().getHours();
  if (h >= 6 && h < 12) return 'Morning';
  if (h >= 12 && h < 17) return 'Afternoon';
  if (h >= 17 && h < 21) return 'Evening';
  return 'Night';
};

export const getDefaultBlockGoals = (totalProtein: number): Record<TimeBlock, number> => ({
  Morning: Math.round(totalProtein * 0.25),
  Afternoon: Math.round(totalProtein * 0.35),
  Evening: Math.round(totalProtein * 0.3),
  Night: Math.round(totalProtein * 0.1),
});

export const getBlockProteinGoal = (block: TimeBlock, targets: NutritionTargets): number => {
  const total = targets.protein || 150;
  const defaults = getDefaultBlockGoals(total);
  const key = BLOCK_PROTEIN_KEYS[block];
  const custom = targets[key];
  return typeof custom === 'number' ? custom : defaults[block];
};

export const normalizeMealTypeToBlock = (mealType?: string): TimeBlock => {
  if (!mealType) return 'Morning';
  const m = mealType.trim().toLowerCase();
  if (m === 'morning' || m === 'breakfast') return 'Morning';
  if (m === 'afternoon' || m === 'lunch') return 'Afternoon';
  if (m === 'evening' || m === 'dinner') return 'Evening';
  if (m === 'night' || m === 'snack') return 'Night';
  return 'Morning';
};

export const getBlockProteinConsumed = (
  foods: Array<{ protein: number; mealType?: string }>,
  block: TimeBlock
): number =>
  foods.reduce((sum, f) => (normalizeMealTypeToBlock(f.mealType) === block ? sum + (f.protein || 0) : sum), 0);

export const getProteinProgress = (consumed: number, goal: number): number =>
  Math.min(100, goal > 0 ? Math.round((consumed / goal) * 100) : 0);

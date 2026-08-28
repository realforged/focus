import React from 'react';
import DailyScheduler from './DailyScheduler';
import { NutritionTargets } from '../types';

interface SchedulerScreenProps {
  loggedFoods?: any[];
  nutritionTargets?: NutritionTargets;
  onUpdateNutritionTargets?: (targets: NutritionTargets) => void;
  onOpenLogFoodForBlock?: (block: 'Morning' | 'Afternoon' | 'Evening' | 'Night') => void;
  onRemoveFood?: (id: string) => void;
  userPoints?: number;
  currentUser?: any;
}

/**
 * SchedulerScreen is the locked, full-fidelity Daily Scheduler screen.
 * It renders DailyScheduler directly with all its existing layouts, time blocks,
 * protein tracking, routines, saved groups, and interactions preserved 100%.
 */
export default function SchedulerScreen({
  loggedFoods = [],
  nutritionTargets,
  onUpdateNutritionTargets,
  onOpenLogFoodForBlock,
  onRemoveFood,
  userPoints,
  currentUser,
}: SchedulerScreenProps) {
  return (
    <div className="w-full">
      <DailyScheduler
        loggedFoods={loggedFoods}
        nutritionTargets={nutritionTargets}
        onUpdateNutritionTargets={onUpdateNutritionTargets}
        onOpenLogFoodForBlock={onOpenLogFoodForBlock}
        onRemoveFood={onRemoveFood}
        userPoints={userPoints}
        currentUser={currentUser}
      />
    </div>
  );
}

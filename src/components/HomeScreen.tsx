import DailyScheduler from './DailyScheduler';
import React, { useState } from 'react';
import { 
  Flame, 
  Trophy, 
  Zap, 
  Bell, 
  Check, 
  ChevronRight, 
  Sparkles, 
  Clock, 
  Dumbbell, 
  Compass, 
  BookOpen, 
  Briefcase, 
  Moon, 
  Heart, 
  Apple,
  Activity,
  CheckCircle,
  GripVertical,
  Plus,
  Sun,
  Sunset,
  CloudSun,
  Target,
  Brain,
  Star,
  X,
  RotateCcw,
  Droplet,
  ArrowUpRight,
} from 'lucide-react';
import { Habit, Routine, Category, PillarGoal } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import RoutineDetailsModal from './RoutineDetailsModal';
import InlinePillarView from './InlinePillarView';
import type { LoggedFood } from './DietScreen';
import { PILLAR_META } from '../lib/pillars';
import { getDietPreferences, saveDietPreferences, getWaterIntakeForDate, addWaterIntakeForDate } from '../lib/dietPreferences';

interface HomeScreenProps {
  habits: Habit[];
  routines: Routine[];
  userPoints: number;
  dateToday: string;
  onLogHabit: (id: string, value: number) => Promise<void>;
  onBatchLogHabits?: (updates: { id: string; value: number }[]) => Promise<void>;
  setTab: (tab: string) => void;
  onNavigateToRoutine: (routineId: string) => void;
  currentUser: any;
  nutritionToday: {
    protein: number;
    carbs: number;
    fats: number;
    fiber: number;
    calories: number;
  };
  nutritionTargets?: {
    protein: number;
    carbs: number;
    fats: number;
    fiber: number;
    calories: number;
    morningProtein?: number;
    afternoonProtein?: number;
    eveningProtein?: number;
    nightProtein?: number;
  };
  onUpdateNutritionTargets?: (targets: {
    protein: number;
    carbs: number;
    fats: number;
    fiber: number;
    calories: number;
    morningProtein?: number;
    afternoonProtein?: number;
    eveningProtein?: number;
    nightProtein?: number;
  }) => void;
  // NEW: today's actual food entries + remove handler, so the diet card can act as a real log
  todaysFoodLog?: LoggedFood[];
  onRemoveFood?: (id: string) => void;
  onOpenLogFood: () => void;
  onOpenLogFoodForBlock?: (block: 'Morning' | 'Afternoon' | 'Evening' | 'Night') => void;
  onOpenCreateModal: () => void;
  onRefresh?: () => Promise<void>;
  pillarGoals?: PillarGoal[];
  focusedHabitIds?: string[];
  onToggleFocusHabit?: (habitId: string) => void;
  onResetDietProgress?: () => void;
}

export default function HomeScreen({
  habits,
  routines,
  userPoints,
  dateToday,
  onLogHabit,
  onBatchLogHabits,
  setTab,
  onNavigateToRoutine,
  currentUser,
  nutritionToday,
  nutritionTargets,
  todaysFoodLog = [],
  onRemoveFood,
  onOpenLogFood,
  onOpenCreateModal,
  onRefresh,
  pillarGoals = [],
  focusedHabitIds = [],
  onToggleFocusHabit,
  onUpdateNutritionTargets,
  onResetDietProgress,
  onOpenLogFoodForBlock,
}: HomeScreenProps) {
  const [editingTargetKey, setEditingTargetKey] = useState<'protein' | 'calories' | 'water' | null>(null);
  const [targetInputValue, setTargetInputValue] = useState<string>('');
  const [waterMlState, setWaterMlState] = useState<number>(() => getWaterIntakeForDate(dateToday));

  // Block-specific protein goal editing from HomeScreen
  const [editingHomeBlock, setEditingHomeBlock] = useState<'Morning' | 'Afternoon' | 'Evening' | 'Night' | null>(null);
  const [homeBlockGoalInput, setHomeBlockGoalInput] = useState('');

  const handleSaveHomeBlockGoal = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingHomeBlock || !onUpdateNutritionTargets) return;
    const val = Math.max(0, parseFloat(homeBlockGoalInput) || 0);
    const keyMap: Record<string, string> = {
      Morning: 'morningProtein',
      Afternoon: 'afternoonProtein',
      Evening: 'eveningProtein',
      Night: 'nightProtein',
    };
    onUpdateNutritionTargets({
      ...targets,
      [keyMap[editingHomeBlock]]: val,
    });
    setEditingHomeBlock(null);
  };

  const handleQuickWaterAddHome = (amountMl: number) => {
    const updated = addWaterIntakeForDate(dateToday, amountMl);
    setWaterMlState(updated);
  };

  const computeHabitStreak = (habit: Habit): number => {
    let streak = 0;
    const d = new Date(dateToday);
    const valToday = habit.history[dateToday] || 0;
    if (valToday >= habit.target) {
      streak++;
    }
    d.setDate(d.getDate() - 1);

    for (let i = 0; i < 30; i++) {
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      const dateStr = `${yyyy}-${mm}-${dd}`;
      const val = habit.history[dateStr] || 0;
      if (val >= habit.target) {
        streak++;
        d.setDate(d.getDate() - 1);
      } else {
        break;
      }
    }
    return streak;
  };

  const handleSaveTargetFromHome = (e: React.FormEvent) => {
    e.preventDefault();
    const val = Math.max(0, parseFloat(targetInputValue) || 0);
    if (editingTargetKey === 'protein' || editingTargetKey === 'calories') {
      if (onUpdateNutritionTargets) {
        onUpdateNutritionTargets({
          ...targets,
          [editingTargetKey]: val,
        });
      }
    } else if (editingTargetKey === 'water') {
      const prefs = getDietPreferences();
      saveDietPreferences({
        ...prefs,
        waterGoalMl: Math.round(val * 1000),
      });
    }
    setEditingTargetKey(null);
  };

  const targets = nutritionTargets || {
    protein: 150,
    carbs: 200,
    fats: 70,
    fiber: 25,
    calories: 2000,
  };

  // Map standard categories to 5 Core Pillars
  const mapCategoryToPillar = (category: string): 'Fitness' | 'Nutrition' | 'Career' | 'Recovery' | 'Mind' => {
    const cat = (category || '').toLowerCase();
    if (cat === 'fitness') return 'Fitness';
    if (cat === 'nutrition' || cat.includes('diet')) return 'Nutrition';
    if (cat === 'career') return 'Career';
    if (cat === 'recovery') return 'Recovery';
    if (cat === 'mind') return 'Mind';

    if (cat.includes('fit') || cat.includes('gym') || cat.includes('workout') || cat.includes('run')) return 'Fitness';
    if (cat.includes('nutri') || cat.includes('diet') || cat.includes('food') || cat.includes('protein')) return 'Nutrition';
    if (cat.includes('career') || cat.includes('study') || cat.includes('productiv') || cat.includes('work') || cat.includes('coding')) return 'Career';
    if (cat.includes('recov') || cat.includes('sleep') || cat.includes('health') || cat.includes('rest') || cat.includes('social')) return 'Recovery';
    return 'Mind';
  };

  const getPillarIcon = (pillar: Category) => {
    if (pillar === 'Fitness') return Dumbbell;
    if (pillar === 'Nutrition') return Apple;
    if (pillar === 'Career') return Briefcase;
    if (pillar === 'Recovery') return Moon;
    return Brain;
  };

  const getPillarGoalCount = (pillar: Category) => pillarGoals.filter(goal => goal.pillar === pillar).length;

  const routineHabitIds = new Set(routines.flatMap(r => r.habitIds));
  const standaloneHabits = habits.filter(h => !routineHabitIds.has(h.id));

  // Calculate day completion stats
  const doneTodayCount = standaloneHabits.filter((h) => (h.history[dateToday] || 0) >= h.target).length;
  const totalTodayCount = standaloneHabits.length;

  // Calculate routine completion stats
  const completedRoutines = routines.filter(r => {
    const rHabits = habits.filter(h => r.habitIds.includes(h.id));
    return rHabits.length > 0 && rHabits.every(h => (h.history[dateToday] || 0) >= h.target);
  }).length;
  const totalRoutines = routines.length;

  // Today's Score calculation
  const todayScore = totalTodayCount + totalRoutines > 0 
    ? Math.round(((doneTodayCount + completedRoutines) / (totalTodayCount + totalRoutines)) * 100)
    : 0;

  // Day streak calculation
  const dayStreak = currentUser?.consecutive_locked_in_streak !== undefined ? currentUser.consecutive_locked_in_streak : 0;

  // Journey details (90 Days Lock-In)
  const journeyStart = currentUser?.journey_start_date ? new Date(currentUser.journey_start_date) : null;
  let currentDay = 1;
  if (journeyStart) {
    const diffTime = Math.abs(new Date().getTime() - journeyStart.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    currentDay = Math.max(1, Math.min(90, diffDays));
  }
  const missionProgressPercent = Math.round((currentDay / 90) * 100);

  // FIX #2: Determine a routine's "focus category" from the habits it actually contains
  // (majority category wins), so routines can be attributed to a pillar too.
  const getRoutineCategory = (routine: Routine): string => {
    const rHabits = habits.filter(h => routine.habitIds.includes(h.id));
    if (rHabits.length === 0) return 'Mind';
    const counts: Record<string, number> = {};
    rHabits.forEach(h => {
      counts[h.category] = (counts[h.category] || 0) + 1;
    });
    return Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0];
  };

  // Completion fraction (0-1) for a routine today, based on its constituent habits
  const routineProgressCount = (routine: Routine) => {
    const rHabits = habits.filter(h => routine.habitIds.includes(h.id));
    const completed = rHabits.filter(h => (h.history[dateToday] || 0) >= h.target).length;
    return { completed, total: rHabits.length };
  };

  // FIX #2: Pillar completion now blends BOTH standalone habits and routines whose
  // majority-category maps into that pillar — no more fake baseline numbers when empty.
  const getPillarStats = (pillarName: 'Fitness' | 'Nutrition' | 'Career' | 'Recovery' | 'Mind') => {
    const pillarStandaloneHabits = standaloneHabits.filter(h => mapCategoryToPillar(h.category) === pillarName);
    const pillarRoutines = routines.filter(r => mapCategoryToPillar(getRoutineCategory(r)) === pillarName);

    const habitRatios = pillarStandaloneHabits.map(h => {
      const val = h.history[dateToday] || 0;
      return h.target > 0 ? Math.min(1, val / h.target) : 0;
    });

    const routineRatios = pillarRoutines.map(r => {
      const { completed, total } = routineProgressCount(r);
      return total > 0 ? completed / total : 0;
    });

    const allRatios = [...habitRatios, ...routineRatios];
    if (allRatios.length === 0) return 0;
    return Math.round((allRatios.reduce((a, b) => a + b, 0) / allRatios.length) * 100);
  };

  const getPillarItemCount = (pillarName: 'Fitness' | 'Nutrition' | 'Career' | 'Recovery' | 'Mind') => {
    const h = standaloneHabits.filter(hh => mapCategoryToPillar(hh.category) === pillarName).length;
    const r = routines.filter(rt => mapCategoryToPillar(getRoutineCategory(rt)) === pillarName).length;
    return h + r;
  };

  const pillarDetails = (['Fitness', 'Nutrition', 'Career', 'Recovery', 'Mind'] as Category[]).map((name) => ({
    name,
    value: getPillarStats(name),
    items: getPillarItemCount(name),
    goals: getPillarGoalCount(name),
    meta: PILLAR_META[name],
    icon: getPillarIcon(name),
  }));

  // NEW: State for Quick Habit Logger Active Filter (All, Morning, Afternoon, Evening, Night)
  const [activeFilter, setActiveFilter] = useState<'All' | 'Morning' | 'Afternoon' | 'Evening' | 'Night'>('All');

  // State for active routine details popup on HomeScreen
  const [activeRoutineDetails, setActiveRoutineDetails] = useState<Routine | null>(null);
  
  // State for active Pillar Details modal popup on HomeScreen
  const [selectedPillar, setSelectedPillar] = useState<Category | null>(null);

  // Toast notification state for celebrations
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  // Helper: check off all habits in a routine instantly from HomeScreen
  const handleMarkRoutineDone = async (routine: Routine) => {
    try {
      const updates: { id: string; value: number }[] = [];
      for (const hId of routine.habitIds) {
        const h = habits.find(habit => habit.id === hId);
        if (h) {
          const val = h.history[dateToday] || 0;
          if (val < h.target) {
            updates.push({ id: h.id, value: h.target - val });
          }
        }
      }
      if (updates.length > 0) {
        if (onBatchLogHabits) {
          await onBatchLogHabits(updates);
        } else {
          for (const u of updates) {
            onLogHabit(u.id, u.value);
          }
        }
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Date helpers to compute yesterday's date & yesterday's / today's completion rates
  const formatDateString = (date: Date) => {
    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const dd = String(date.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  };

  const getYesterdayDate = (todayStr: string) => {
    try {
      const d = new Date(todayStr);
      d.setDate(d.getDate() - 1);
      return formatDateString(d);
    } catch (e) {
      return '';
    }
  };
  const yesterdayDate = getYesterdayDate(dateToday);

  const getCompletionRateForDate = (dateStr: string) => {
    if (!dateStr || habits.length === 0) return 0;
    const completed = habits.filter(h => (h.history[dateStr] || 0) >= h.target).length;
    return Math.round((completed / habits.length) * 100);
  };

  const todayCompletionRate = getCompletionRateForDate(dateToday);
  const yesterdayCompletionRate = getCompletionRateForDate(yesterdayDate);
  const isAhead = todayCompletionRate >= yesterdayCompletionRate;

  // Helper for Weekly Overview Mon-Sun bar
  const getWeekDaysData = () => {
    try {
      const d = new Date(dateToday);
      const currentDayOfWeek = d.getDay();
      const distanceToMon = currentDayOfWeek === 0 ? -6 : 1 - currentDayOfWeek;
      const monday = new Date(d);
      monday.setDate(d.getDate() + distanceToMon);

      const daysLabels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
      
      return daysLabels.map((shortLabel, i) => {
        const dayDate = new Date(monday);
        dayDate.setDate(monday.getDate() + i);
        const yyyy = dayDate.getFullYear();
        const mm = String(dayDate.getMonth() + 1).padStart(2, '0');
        const dd = String(dayDate.getDate()).padStart(2, '0');
        const dateStr = `${yyyy}-${mm}-${dd}`;
        const dayNum = dayDate.getDate();

        let completionPct = 0;
        if (habits.length > 0) {
          const done = habits.filter(h => (h.history[dateStr] || 0) >= h.target).length;
          completionPct = Math.round((done / habits.length) * 100);
        }

        return {
          shortLabel,
          dayNum,
          dateStr,
          completionPct,
          isToday: dateStr === dateToday,
        };
      });
    } catch (e) {
      return [];
    }
  };

  const weekDaysList = getWeekDaysData();
  const weeklyAverage = weekDaysList.length > 0 
    ? Math.round(weekDaysList.reduce((acc, d) => acc + d.completionPct, 0) / 7) 
    : 0;

  // Dynamic motivational tagline based on day, streak & score
  const getDynamicTagline = (): string => {
    if (currentDay === 1) return '🚀 Day 1. The journey of 90 starts now.';
    if (currentDay <= 7) return `⚡ Week 1 — build the foundation. ${7 - currentDay + 1} days left this week.`;
    if (currentDay === 45) return '🔥 Halfway through. 45 days in. Don\'t blink now.';
    if (currentDay >= 85) return `🏁 ${90 - currentDay} days to go. Finish like a champion.`;
    if (currentDay === 90) return '🏆 Day 90. You did it. Lock-in complete.';
    if (dayStreak >= 7 && todayScore >= 80) return `🔥 ${dayStreak}-day streak & ${todayScore}% today — you\'re locked in.`;
    if (todayScore === 100) return '✅ Perfect day. Every habit crushed. Stay the course.';
    if (todayScore === 0) return '💪 Nothing done yet. Start with one habit — build momentum.';
    if (dayStreak === 0) return '⚠️ Streak broken. Reset starts today. Go.';
    if (currentDay <= 30) return `📅 Day ${currentDay} — early days shape the whole 90. Stay consistent.`;
    if (currentDay <= 60) return `🧱 Day ${currentDay} — you\'re in the grind phase. Don\'t let up.`;
    return `💡 Day ${currentDay} — every rep today compounds into who you become.`;
  };

  // Dynamic badges — only show pillars scoring ≥ 80% today
  const PILLAR_BADGE_CONFIG = [
    { pillar: 'Fitness' as const,   emoji: '🏋️', label: 'Titan',     color: 'emerald' },
    { pillar: 'Nutrition' as const, emoji: '🥗', label: 'Clean Fuel', color: 'amber'   },
    { pillar: 'Career' as const,    emoji: '💼', label: 'Focus Ninja',color: 'blue'    },
    { pillar: 'Recovery' as const,  emoji: '🌙', label: 'Zen Rest',   color: 'purple'  },
    { pillar: 'Mind' as const,      emoji: '🧘', label: 'Mind Sharp', color: 'rose'    },
  ] as const;

  const earnedBadges = PILLAR_BADGE_CONFIG.filter(b => getPillarStats(b.pillar) >= 80);

  const BADGE_COLORS: Record<string, string> = {
    emerald: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    amber:   'bg-amber-500/10 text-amber-400 border-amber-500/20',
    blue:    'bg-blue-500/10 text-blue-400 border-blue-500/20',
    purple:  'bg-purple-500/10 text-purple-400 border-purple-500/20',
    rose:    'bg-rose-500/10 text-rose-400 border-rose-500/20',
  };

  // Helper to count standalone habits dynamically in each filter
  const getBlockHabitsCount = (blockId: string) => {
    if (blockId === 'All') {
      return standaloneHabits.length;
    }
    return standaloneHabits.filter(h => h.timeBlock === blockId).length;
  };

  // Remaining count for the main header badge
  const remainingCount = habits.filter(h => (h.history[dateToday] || 0) < h.target).length;

  // Filter configuration with beautiful icons and color styles matching the screenshot
  const timeFilters = [
    { id: 'All' as const, label: 'All', icon: CheckCircle, selectedClass: 'bg-[#102a24] text-[#14b8a6] border-[#14b8a6]/40 shadow-lg shadow-emerald-500/10', count: getBlockHabitsCount('All') },
    { id: 'Morning' as const, label: 'Morning', icon: Sun, selectedClass: 'bg-amber-950/40 text-amber-400 border-amber-500/30 shadow-lg shadow-amber-500/10', count: getBlockHabitsCount('Morning') },
    { id: 'Afternoon' as const, label: 'Afternoon', icon: CloudSun, selectedClass: 'bg-blue-950/40 text-blue-400 border-blue-500/30 shadow-lg shadow-blue-500/10', count: getBlockHabitsCount('Afternoon') },
    { id: 'Evening' as const, label: 'Evening', icon: Sunset, selectedClass: 'bg-orange-950/40 text-orange-400 border-orange-500/30 shadow-lg shadow-orange-500/10', count: getBlockHabitsCount('Evening') },
    { id: 'Night' as const, label: 'Night', icon: Moon, selectedClass: 'bg-purple-950/40 text-purple-400 border-purple-500/30 shadow-lg shadow-purple-500/10', count: getBlockHabitsCount('Night') },
  ];

  // Filter habits based on selected block
  const filteredHabits = standaloneHabits.filter(h => {
    if (activeFilter === 'All') return true;
    return h.timeBlock === activeFilter;
  });

  // Filter routines based on selected block
  const filteredRoutines = routines.filter(r => {
    if (activeFilter === 'All') return r.timeBlock === 'Morning' || r.timeBlock === 'Evening'; // default showcase routines if 'All'
    return r.timeBlock === activeFilter;
  });

  const getCategoryMetaForLogger = (category: string) => {
    const pillar = mapCategoryToPillar(category);
    const meta = PILLAR_META[pillar];
    return {
      lucideIcon: getPillarIcon(pillar),
      accentColor: meta.accent,
      bgColor: `${meta.accent}18`,
      borderColor: `${meta.accent}36`,
      label: meta.label,
      pillar,
    };
  };

  const getRoutineMetaForLogger = (routine: Routine) => {
    const pillar = mapCategoryToPillar(getRoutineCategory(routine));
    const meta = PILLAR_META[pillar];
    return {
      lucideIcon: getPillarIcon(pillar),
      accentColor: meta.accent,
      label: meta.label,
      pillar,
    };
  };

  // FIX #1: One-tap complete. A single tap on the check circle marks the habit
  // FULLY done regardless of target (target - current, in one shot). Tapping an
  // already-completed habit undoes it back to 0. No more incremental +1 taps.
  const handleQuickLog = async (habitId: string) => {
    const targetHabit = habits.find((h) => h.id === habitId);
    if (!targetHabit) return;
    const curToday = targetHabit.history[dateToday] || 0;
    const isCompleted = curToday >= targetHabit.target;
    if (isCompleted) {
      await onLogHabit(habitId, -curToday); // undo
    } else {
      await onLogHabit(habitId, targetHabit.target - curToday); // complete in one tap
      showToast(`🔥 Mastered "${targetHabit.name}"! +${targetHabit.points} pts`);
    }
  };

  const importantHabits = standaloneHabits
    .map((habit) => {
      const progress = habit.history[dateToday] || 0;
      const isCompleted = progress >= habit.target;
      const priority =
        (isCompleted ? -100 : 0) +
        (habit.enableFocusTimer ? 30 : 0) +
        (habit.repeat === 'Today Only' ? 25 : 0) +
        Math.min(30, habit.points || 0) +
        (habit.timeBlock && habit.timeBlock !== 'Anytime' ? 8 : 0);
      return { habit, priority };
    })
    .sort((a, b) => b.priority - a.priority)
    .slice(0, 5)
    .map(item => item.habit);

  // Only show a routine in Today's Focus if the user has explicitly pinned
  // at least one of its habits via the star/focus toggle in the Today tab.
  const focusRoutines = routines
    .filter((routine) => {
      const hasPinnedHabit = routine.habitIds.some(id => focusedHabitIds.includes(id));
      if (!hasPinnedHabit) return false;
      const { completed, total } = routineProgressCount(routine);
      return total > 0 && completed < total;
    })
    .sort((a, b) => b.points - a.points)
    .slice(0, 2);

  // Habits pinned by user as "Today's Focus" (starred in Today screen)
  const userPinnedHabits = standaloneHabits.filter(h => focusedHabitIds.includes(h.id));

  // focusList = pinned first, then auto-priority if no pinned
  const focusList: typeof standaloneHabits = userPinnedHabits.length > 0
    ? userPinnedHabits
    : importantHabits.slice(0, 5);  const userName = currentUser?.name || currentUser?.email?.split('@')[0] || 'Charan';

  return (
    <div className="w-full bg-[#F8F9FC] text-[#1E293B] flex flex-col font-sans pb-12 relative">
      
      {/* Header Bar */}
      <div className="px-6 pt-6 pb-4 flex items-center justify-between select-none max-w-6xl mx-auto w-full">
        <div>
          <p className="text-gray-400 text-xs font-semibold tracking-wide">Good morning, {userName} 👋</p>
          <h1 className="text-2xl md:text-3xl font-extrabold text-[#0F172A] tracking-tight mt-0.5">Let's win today.</h1>
        </div>
        <div className="relative cursor-pointer active:scale-95 transition-transform">
          <div className="bg-white p-2.5 rounded-full border border-gray-150 shadow-sm">
            <Bell className="w-5 h-5 text-gray-600" />
          </div>
          <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-rose-500 rounded-full ring-2 ring-white animate-pulse" />
        </div>
      </div>

      {/* Daily Scheduler Dashboard View */}
      <div className="flex-1 px-4 sm:px-6 max-w-6xl mx-auto w-full space-y-6">
        <DailyScheduler
          loggedFoods={todaysFoodLog}
          nutritionTargets={nutritionTargets}
          onUpdateNutritionTargets={onUpdateNutritionTargets}
          onOpenLogFoodForBlock={onOpenLogFoodForBlock}
          onRemoveFood={onRemoveFood}
          userPoints={userPoints}
          currentUser={currentUser}
        />
      </div>

      {/* Interactive Routine Details Modal */}
      <AnimatePresence>
        {activeRoutineDetails && (() => {
          const freshRoutine = routines.find(r => r.id === activeRoutineDetails.id) || activeRoutineDetails;
          return (
            <RoutineDetailsModal
              isOpen={!!activeRoutineDetails}
              onClose={() => setActiveRoutineDetails(null)}
              routine={freshRoutine}
              habits={habits}
              selectedDate={dateToday}
              onLogHabit={onLogHabit}
              onMarkRoutineDone={handleMarkRoutineDone}
              onEditRoutine={onNavigateToRoutine}
              onRefresh={onRefresh}
            />
          );
        })()}
      </AnimatePresence>
    </div>
  );
}
import React, { Suspense, lazy, useState, useEffect } from 'react';
import AuthPage from './components/AuthPage';
import { CreateHabitModal, CreateRoutineModal } from './components/Modals';
import { Habit, Category, Routine, PillarGoal, NutritionTargets } from './types';
import { getInitialState, calculateMomentum, dateToday, dateYesterday } from './data';
import { api } from './api';
import { 
  Home as HomeIcon, 
  Calendar as CalendarIcon, 
  Plus as PlusIcon, 
  BarChart3 as BarChartIcon, 
  User as UserIcon,
  Flame,
  Zap,
  Bell,
  Layers as LayersIcon,
  BookOpen,
  Sun,
  Compass,
} from 'lucide-react';
import PillarsScreen from './components/PillarsScreen';

// NOTE: DietScreen is no longer rendered as its own tab (see fix #4) — the diet
// experience now lives inline on HomeScreen as the "Diet Log" card. We keep the
// LoggedFood type + LogFoodModal import since logging food is still needed.
import type { LoggedFood } from './components/DietScreen';
import { resetWaterIntakeForDate } from './lib/dietPreferences';
import HomeScreen from './components/HomeScreen';

const TodayScreen = lazy(() => import('./components/TodayScreen'));
const SchedulerScreen = lazy(() => import('./components/SchedulerScreen'));
const JournalScreen = lazy(() => import('./components/JournalScreen'));
const ProgressScreen = lazy(() => import('./components/ProgressScreen'));
const ProfileScreen = lazy(() => import('./components/ProfileScreen'));
const CreateModal = lazy(() => import('./components/CreateModal'));
const LogFoodModal = lazy(() => import('./components/LogFoodModal'));


const APP_CACHE_KEY = 'focus_now_app_cache_v1';

type AppCache = {
  profile: any | null;
  habits: Habit[];
  routines: Routine[];
  userPoints: number;
};

const readAppCache = (): AppCache | null => {
  try {
    const raw = localStorage.getItem(APP_CACHE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (err) {
    console.error('Failed to read app cache:', err);
    return null;
  }
};

const writeAppCache = (cache: AppCache) => {
  try {
    localStorage.setItem(APP_CACHE_KEY, JSON.stringify(cache));
  } catch (err) {
    console.error('Failed to save app cache:', err);
  }
};

const SectionFallback = () => (
  <div className="p-4 sm:p-6 space-y-4 animate-pulse">
    <div className="h-28 rounded-3xl bg-slate-200/70" />
    <div className="grid grid-cols-2 gap-3">
      <div className="h-24 rounded-2xl bg-slate-200/60" />
      <div className="h-24 rounded-2xl bg-slate-200/60" />
    </div>
    <div className="h-44 rounded-3xl bg-slate-200/60" />
  </div>
);

export default function App() {
  const [token, setToken] = useState<string | null>(localStorage.getItem('habit_mountain_token'));
  const [cachedAppState] = useState<AppCache | null>(() => readAppCache());
  const [currentUser, setCurrentUser] = useState<any | null>(() => cachedAppState?.profile ?? null);

  const [currentTab, setTabState] = useState<string>(() => {
    try {
      const saved = localStorage.getItem('focus_now_active_tab');
      if (saved) return saved;
    } catch (e) {
      console.error(e);
    }
    return 'today';
  });

  const setTab = (tab: string) => {
    setTabState(tab);
    try {
      localStorage.setItem('focus_now_active_tab', tab);
    } catch (e) {
      console.error(e);
    }
  };
  const [habits, setHabits] = useState<Habit[]>(() => cachedAppState?.habits ?? []);
  const [routines, setRoutines] = useState<Routine[]>(() => cachedAppState?.routines ?? []);
  const [userPoints, setUserPoints] = useState<number>(() => cachedAppState?.userPoints ?? 0);
  const [appLoading, setAppLoading] = useState<boolean>(() => Boolean(token && !cachedAppState));

  // Focused / Pinned Habits state for "Today's Focus"
  const [focusedHabitIds, setFocusedHabitIds] = useState<string[]>(() => {
    const cached = localStorage.getItem('90day_focused_habit_ids');
    if (cached) {
      try {
        return JSON.parse(cached);
      } catch (e) {
        console.error(e);
      }
    }
    return [];
  });

  const handleToggleFocusHabit = (habitId: string) => {
    setFocusedHabitIds(prev => {
      const isFocused = prev.includes(habitId);
      const next = isFocused ? prev.filter(id => id !== habitId) : [...prev, habitId];
      localStorage.setItem('90day_focused_habit_ids', JSON.stringify(next));
      return next;
    });
  };

  // Nutrition goals state
  const [nutritionTargets, setNutritionTargets] = useState<NutritionTargets>(() => {
    const cached = localStorage.getItem('90day_nutrition_targets');
    if (cached) {
      try {
        return JSON.parse(cached);
      } catch (e) {
        console.error(e);
      }
    }
    return {
      protein: 150,
      carbs: 200,
      fats: 70,
      fiber: 25,
      calories: 2000,
    };
  });

  // Food log state
  const [loggedFoods, setLoggedFoods] = useState<LoggedFood[]>(() => {
    const cached = localStorage.getItem('90day_logged_foods');
    if (cached) {
      try {
        return JSON.parse(cached);
      } catch (e) {
        console.error(e);
      }
    }
    return [];
  });

  // Dynamically derive nutritionToday based on loggedFoods FOR TODAY ONLY
  const todaysFoodLog = loggedFoods.filter(item => !item.date || item.date === dateToday);
  const nutritionToday = todaysFoodLog.reduce(
    (acc, item) => {
      acc.protein += item.protein;
      acc.carbs += item.carbs;
      acc.fats += item.fats;
      acc.fiber += item.fiber;
      acc.calories += item.calories;
      return acc;
    },
    { protein: 0, carbs: 0, fats: 0, fiber: 0, calories: 0 }
  );

  const handleAddFood = (food: Omit<LoggedFood, 'id' | 'timestamp'>) => {
    const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const newFood: LoggedFood = {
      ...food,
      id: Math.random().toString(36).substring(2, 9),
      timestamp: timeStr,
      date: dateToday,
    };
    setLoggedFoods(prev => {
      const next = [...prev, newFood];
      localStorage.setItem('90day_logged_foods', JSON.stringify(next));
      return next;
    });
    // Reward points for tracking
    handleAddPoints(15);
  };

  const handleRemoveFood = (id: string) => {
    setLoggedFoods(prev => {
      const next = prev.filter(f => f.id !== id);
      localStorage.setItem('90day_logged_foods', JSON.stringify(next));
      return next;
    });
  };

  const handleClearTodayLogs = () => {
    setLoggedFoods(prev => {
      const next = prev.filter(f => f.date && f.date !== dateToday);
      localStorage.setItem('90day_logged_foods', JSON.stringify(next));
      return next;
    });
    resetWaterIntakeForDate(dateToday);
  };

  const handleUpdateNutritionTargets = (targets: NutritionTargets) => {
    setNutritionTargets(targets);
    localStorage.setItem('90day_nutrition_targets', JSON.stringify(targets));
  };

  // Backwards-compatible handleAddNutrition (used by CreateModal's quick-add flow)
  const handleAddNutrition = (macros: { protein: number; carbs: number; fats: number; fiber: number; calories: number }) => {
    handleAddFood({
      name: 'Custom Logged Meal',
      protein: macros.protein,
      carbs: macros.carbs,
      fats: macros.fats,
      fiber: macros.fiber,
      calories: macros.calories,
    });
  };

  const handleAddPoints = async (points: number) => {
    try {
      const nextPoints = userPoints + points;
      setUserPoints(nextPoints);
      writeAppCache({ profile: currentUser, habits, routines, userPoints: nextPoints });
      await api.syncJourney({ total_points: nextPoints });
    } catch (err: any) {
      console.error('Failed to sync points:', err);
      if (err.message && (
        err.message.includes('401') || 
        err.message.includes('403') || 
        err.message.includes('404') || 
        err.message.includes('expired') || 
        err.message.includes('not found') ||
        err.message.includes('profile') ||
        err.message.includes('session')
      )) {
        handleLogout();
      }
    }
  };

  const [customGoals, setCustomGoals] = useState<PillarGoal[]>(() => {
    const cached = localStorage.getItem('90day_pillar_goals');
    if (cached) {
      try {
        return JSON.parse(cached);
      } catch (e) {
        console.error(e);
      }
    }
    return [
      { id: 'goal-fitness-base', title: 'Train 5 days a week', pillar: 'Fitness', desc: 'Strength and conditioning stay visible every week.', target: '5 sessions/week', createdAt: dateToday },
      { id: 'goal-nutrition-base', title: 'Hit protein and calories', pillar: 'Nutrition', desc: 'Diet targets guide each food log.', target: '150g protein daily', createdAt: dateToday },
      { id: 'goal-career-base', title: 'Daily skill block', pillar: 'Career', desc: 'Protect one serious study or build block.', target: '90 focused minutes', createdAt: dateToday },
    ];
  });

  const handleAddCustomGoal = (goal: Omit<PillarGoal, 'id' | 'createdAt'>) => {
    setCustomGoals(prev => {
      const next = [
        ...prev,
        {
          ...goal,
          id: Math.random().toString(36).substring(2, 9),
          createdAt: dateToday,
        },
      ];
      localStorage.setItem('90day_pillar_goals', JSON.stringify(next));
      return next;
    });
  };

  // States for routine timeline details
  const [selectedRoutineId, setSelectedRoutineId] = useState<string | null>(null);
  const [selectedCategoryId, setSelectedCategoryId] = useState<Category | null>(null);

  // State for Create dialogue modals
  const [isHabitModalOpen, setIsHabitModalOpen] = useState(false);
  const [isRoutineModalOpen, setIsRoutineModalOpen] = useState(false);
  const [isPlusModalOpen, setIsPlusModalOpen] = useState(false);
  const [isLogFoodModalOpen, setIsLogFoodModalOpen] = useState(false);
  const [logFoodInitialBlock, setLogFoodInitialBlock] = useState<'Morning' | 'Afternoon' | 'Evening' | 'Night' | undefined>();

  const openLogFood = () => {
    setLogFoodInitialBlock(undefined);
    setIsLogFoodModalOpen(true);
  };

  const openLogFoodForBlock = (block: 'Morning' | 'Afternoon' | 'Evening' | 'Night') => {
    setLogFoodInitialBlock(block);
    setIsLogFoodModalOpen(true);
  };

  const closeLogFood = () => {
    setIsLogFoodModalOpen(false);
    setLogFoodInitialBlock(undefined);
  };

  // Fetch all user details, habits, routines on mounting/authentication
  const loadAllData = async (options: { forceBlocking?: boolean } = {}) => {
    if (!token) {
      setAppLoading(false);
      return;
    }

    const hasDataToRender = Boolean(currentUser || cachedAppState || habits.length > 0 || routines.length > 0);
    if (options.forceBlocking || !hasDataToRender) {
      setAppLoading(true);
    }

    try {
      const [profile, hData, rData] = await Promise.all([
        api.getProfile(),
        api.getHabits(),
        api.getRoutines(),
      ]);

      setCurrentUser(profile);
      setUserPoints(profile.total_points || 0);
      setHabits(hData);
      setRoutines(rData);
      writeAppCache({
        profile,
        habits: hData,
        routines: rData,
        userPoints: profile.total_points || 0,
      });

    } catch (err: any) {
      console.error('Error loading full-stack assets:', err);
      if (err.message && (
        err.message.includes('401') || 
        err.message.includes('403') || 
        err.message.includes('404') || 
        err.message.includes('expired') || 
        err.message.includes('not found') ||
        err.message.includes('profile') ||
        err.message.includes('session')
      )) {
        handleLogout();
      }
    } finally {
      setAppLoading(false);
    }
  };

  useEffect(() => {
    loadAllData();
  }, [token]);

  const handleAuthSuccess = (newToken: string, user: any) => {
    localStorage.setItem('habit_mountain_token', newToken);
    setToken(newToken);
    setCurrentUser(user);
    setUserPoints(user.total_points || 0);
    writeAppCache({ profile: user, habits: [], routines: [], userPoints: user.total_points || 0 });
  };

  const handleLogout = () => {
    localStorage.removeItem('habit_mountain_token');
    localStorage.removeItem(APP_CACHE_KEY);
    setToken(null);
    setCurrentUser(null);
    setHabits([]);
    setRoutines([]);
    setUserPoints(0);
  };  // Automated Routine Completion Handler Check
  useEffect(() => {
    if (!token || habits.length === 0 || routines.length === 0) return;

    let pointsBonus = 0;
    let routinesToUpdate: { id: string; completed: boolean }[] = [];

    routines.forEach((rt) => {
      const routineHabits = habits.filter((h) => rt.habitIds.includes(h.id));
      const allDoneToday =
        routineHabits.length > 0 &&
        routineHabits.every((h) => (h.history[dateToday] || 0) >= h.target);
      const wasDoneEarlierToday = rt.completedHistory[dateToday] || false;

      if (allDoneToday && !wasDoneEarlierToday) {
        pointsBonus += rt.points;
        routinesToUpdate.push({ id: rt.id, completed: true });
      }
    });

    if (routinesToUpdate.length > 0) {
      // 1. Instant optimistic update for routine completion state & points
      const updatedRoutines = routines.map((rt) => {
        if (routinesToUpdate.some((u) => u.id === rt.id)) {
          return {
            ...rt,
            completedHistory: {
              ...rt.completedHistory,
              [dateToday]: true,
            },
          };
        }
        return rt;
      });

      const nextPoints = userPoints + pointsBonus;
      setUserPoints(nextPoints);
      setRoutines(updatedRoutines);
      writeAppCache({ profile: currentUser, habits, routines: updatedRoutines, userPoints: nextPoints });

      // 2. Asynchronous background network sync
      (async () => {
        try {
          await api.syncJourney({ total_points: nextPoints });
          for (const item of routinesToUpdate) {
            await api.setRoutineStatus(item.id, dateToday, true);
          }
        } catch (err) {
          console.error('Error synchronizing routine chains:', err);
        }
      })();
    }
  }, [habits, routines, token]);

  // Handler: Log count/timer progress against a specific habit (Instant Optimistic UI)
  const handleLogHabit = async (id: string, value: number) => {
    const targetHabit = habits.find((h) => h.id === id);
    if (!targetHabit) return;

    const curToday = targetHabit.history[dateToday] || 0;
    const newToday = Math.max(0, curToday + value);

    const wasCompleted = curToday >= targetHabit.target;
    const nowCompleted = newToday >= targetHabit.target;

    const isRoutineHabit = routines.some((r) => r.habitIds.includes(id));
    let ptsAdd = 0;
    if (!isRoutineHabit) {
      if (nowCompleted && !wasCompleted) {
        ptsAdd = targetHabit.points + 5;
      } else if (!nowCompleted && value > 0) {
        ptsAdd = Math.min(targetHabit.points, 2);
      }
    }

    const nextPoints = userPoints + ptsAdd;

    // 1. Immediate optimistic UI state update (0ms delay)
    const updatedHabits = habits.map((h) => {
      if (h.id === id) {
        return {
          ...h,
          history: {
            ...h.history,
            [dateToday]: newToday,
          },
        };
      }
      return h;
    });

    setHabits(updatedHabits);
    if (ptsAdd > 0) {
      setUserPoints(nextPoints);
    }
    writeAppCache({ profile: currentUser, habits: updatedHabits, routines, userPoints: nextPoints });

    // 2. Fire-and-forget background server sync
    try {
      await api.logHabit(id, dateToday, value);
      if (ptsAdd > 0) {
        await api.syncJourney({ total_points: nextPoints });
      }
    } catch (err: any) {
      console.error('Failed to sync logged progression in background:', err);
      if (err.message && (
        err.message.includes('401') || 
        err.message.includes('403') || 
        err.message.includes('expired')
      )) {
        handleLogout();
      }
    }
  };

  // Handler: Batch log multiple habit updates atomically (Instant 0ms UI update)
  const handleBatchLogHabits = async (updates: { id: string; value: number }[]) => {
    if (!updates || updates.length === 0) return;

    let ptsAddTotal = 0;
    const updatedHabits = habits.map((h) => {
      const up = updates.find((u) => u.id === h.id);
      if (!up) return h;

      const curToday = h.history[dateToday] || 0;
      const newToday = Math.max(0, curToday + up.value);

      const wasCompleted = curToday >= h.target;
      const nowCompleted = newToday >= h.target;

      const isRoutineHabit = routines.some((r) => r.habitIds.includes(h.id));
      if (!isRoutineHabit) {
        if (nowCompleted && !wasCompleted) {
          ptsAddTotal += h.points + 5;
        } else if (!nowCompleted && up.value > 0) {
          ptsAddTotal += Math.min(h.points, 2);
        }
      }

      return {
        ...h,
        history: {
          ...h.history,
          [dateToday]: newToday,
        },
      };
    });

    const nextPoints = userPoints + ptsAddTotal;

    // 1. Single instant optimistic UI update across all habits
    setHabits(updatedHabits);
    if (ptsAddTotal > 0) {
      setUserPoints(nextPoints);
    }
    writeAppCache({ profile: currentUser, habits: updatedHabits, routines, userPoints: nextPoints });

    // 2. Async background sync in parallel
    try {
      await Promise.all(updates.map((u) => api.logHabit(u.id, dateToday, u.value)));
      if (ptsAddTotal > 0) {
        await api.syncJourney({ total_points: nextPoints });
      }
    } catch (err: any) {
      console.error('Background batch sync failed:', err);
      if (err.message && (err.message.includes('401') || err.message.includes('403') || err.message.includes('expired'))) {
        handleLogout();
      }
    }
  };

  // Handler: Save newly created habit
  const handleCreateHabitSubmit = async (habitData: Partial<Habit>) => {
    try {
      const payload: Partial<Habit> = {
        name: habitData.name || 'Untitled Habit',
        category: habitData.category || 'Fitness',
        points: habitData.points || 10,
        type: habitData.type || 'Count',
        target: habitData.target || 1,
        unit: habitData.type === 'Timer' ? 'min' : habitData.unit || 'reps',
        repeat: habitData.repeat || 'Daily',
        timeOfDay: habitData.timeOfDay,
        timeBlock: habitData.timeBlock || 'Anytime',
        enableFocusTimer: habitData.enableFocusTimer || false,
        routineId: habitData.routineId
      };

      await api.createHabit(payload);
      
      const nextHabits = await api.getHabits();
      setHabits(nextHabits);

      if (habitData.routineId) {
        const nextRoutines = await api.getRoutines();
        setRoutines(nextRoutines);
      }

      setIsHabitModalOpen(false);
      setTab('today');
    } catch (err: any) {
      alert('Error creating habit index: ' + err.message);
    }
  };

  // Handler: Save newly created routine and auto-create corresponding template habits
  const handleCreateRoutineSubmit = async (rtData: {
    name: string;
    points: number;
    timeBlock: 'Morning' | 'Afternoon' | 'Evening' | 'Night' | 'Constant';
    repeat: 'Daily' | 'Custom Days' | 'Today Only';
    category?: Category;
    habitNames: string[];
  }) => {
    try {
      const generatedHabitIds: string[] = [];

      for (let i = 0; i < rtData.habitNames.length; i++) {
        const name = rtData.habitNames[i];
        const hRes = await api.createHabit({
          name,
          category: rtData.category || 'Fitness',
          points: 10,
          type: 'Count',
          target: 10,
          unit: 'reps',
          repeat: rtData.repeat
        });
        generatedHabitIds.push(hRes.id);
      }

      await api.createRoutine({
        name: rtData.name,
        points: rtData.points,
        timeBlock: rtData.timeBlock,
        repeat: rtData.repeat,
        habitIds: generatedHabitIds
      });

      const nextHabits = await api.getHabits();
      const nextRoutines = await api.getRoutines();
      setHabits(nextHabits);
      setRoutines(nextRoutines);

      setIsRoutineModalOpen(false);
      setTab('today');
    } catch (err: any) {
      alert('Error building full routine chain: ' + err.message);
    }
  };

  const handleNavigateToRoutine = (routineId: string) => {
    setSelectedRoutineId(routineId);
    setTab('habits');
  };

  const handleRefreshData = async () => {
    try {
      const [hData, rData, profile] = await Promise.all([
        api.getHabits(),
        api.getRoutines(),
        api.getProfile(),
      ]);
      setHabits(hData);
      setRoutines(rData);
      setCurrentUser(profile);
      setUserPoints(profile.total_points || 0);
      writeAppCache({
        profile,
        habits: hData,
        routines: rData,
        userPoints: profile.total_points || 0,
      });
    } catch (err: any) {
      console.error('Error refreshing applet data:', err);
      if (err.message && (
        err.message.includes('401') || 
        err.message.includes('403') || 
        err.message.includes('404') || 
        err.message.includes('expired') || 
        err.message.includes('not found') ||
        err.message.includes('profile') ||
        err.message.includes('session')
      )) {
        handleLogout();
      }
    }
  };

  const handleDeleteHabit = async (id: string) => {
    try {
      await api.deleteHabit(id);
      const nextHabits = await api.getHabits();
      setHabits(nextHabits);
      const nextRoutines = await api.getRoutines();
      setRoutines(nextRoutines);
    } catch (err: any) {
      alert('Failed to delete habit: ' + err.message);
    }
  };

  const handleEditHabit = async (id: string, data: Partial<any>) => {
    try {
      await api.updateHabit(id, data);
      const nextHabits = await api.getHabits();
      setHabits(nextHabits);
    } catch (err: any) {
      alert('Failed to update habit: ' + err.message);
    }
  };

  const handleDeleteRoutine = async (id: string) => {
    try {
      await api.deleteRoutine(id);
      const nextRoutines = await api.getRoutines();
      setRoutines(nextRoutines);
    } catch (err: any) {
      alert('Failed to delete routine: ' + err.message);
    }
  };

  const handleEditRoutine = async (id: string, data: { name: string; points: number; timeBlock: 'Morning' | 'Afternoon' | 'Evening' | 'Night' | 'Constant'; repeat: 'Daily' | 'Custom Days' | 'Today Only' }) => {
    try {
      await api.updateRoutine(id, data);
      const nextRoutines = await api.getRoutines();
      setRoutines(nextRoutines);
    } catch (err: any) {
      alert('Failed to update routine: ' + err.message);
    }
  };

  const handleResetMissionDay1 = async () => {
    setAppLoading(true);
    try {
      await api.syncJourney({
        journey_start_date: dateToday,
        locked_in_days: 0,
        consecutive_locked_in_streak: 0,
      });
      await loadAllData({ forceBlocking: true });
      setTab('today');
      alert('⚡ 90-DAY MISSION RESET TO DAY 1!\nYour 90-day lock-in challenge has been restarted from today.');
    } catch (err: any) {
      alert('Failure resetting mission start date: ' + err.message);
    } finally {
      setAppLoading(false);
    }
  };

  const handleResetApp = async () => {
    if (confirm('Are you sure you want to reset all tracked points and database logs to start fresh? This drops your sqlite metrics safely.')) {
      setAppLoading(true);
      try {
        await api.resetAllData();
        await loadAllData({ forceBlocking: true });
        setTab('home');
        alert('All database tables successfully wiped & re-seeded to baseline values!');
      } catch (err: any) {
        alert('Failure processing reset: ' + err.message);
      } finally {
        setAppLoading(false);
      }
    }
  };

  if (!token) {
    return <AuthPage onAuthSuccess={handleAuthSuccess} />;
  }

  if (appLoading) {
    return (
      <div className="flex flex-col font-sans items-center justify-center min-h-screen bg-[#06070a] text-white">
        <div className="relative flex items-center justify-center mb-4">
          <div className="w-12 h-12 border-4 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin" />
          <Zap className="w-5 h-5 text-indigo-400 absolute animate-pulse" />
        </div>
        <p className="text-xs uppercase tracking-widest text-gray-500 font-mono">
          Assembling Summit Environment...
        </p>
      </div>
    );
  }

  const { score: currentLiveMomentumScore } = calculateMomentum(habits);

  // Nav items — Today, Scheduler, Journal, Progress, Profile
  const navItems = [
    { id: 'today', label: 'Today', icon: Sun },
    { id: 'scheduler', label: 'Scheduler', icon: CalendarIcon },
    { id: 'journal', label: 'Journal', icon: BookOpen },
    { id: 'progress', label: 'Progress', icon: BarChartIcon },
    { id: 'profile', label: 'Profile', icon: UserIcon },
  ];

  return (
    <div className="min-h-screen bg-[#F8F9FC] text-[#1E293B] flex flex-col md:flex-row font-sans">
      
      {/* LEFT SIDEBAR NAVIGATION: Desktop Only */}
      <aside className="hidden md:flex flex-col w-64 bg-slate-900 text-white shrink-0 h-screen sticky top-0 p-6 z-40 select-none shadow-xl border-r border-slate-800">
        <div className="flex items-center gap-3 mb-8">
          <div className="bg-[#12B886] p-2.5 rounded-2xl text-white shadow-md shadow-emerald-500/20">
            <Zap className="w-6 h-6 fill-white animate-pulse" />
          </div>
          <div>
            <h1 className="text-sm font-black tracking-tight text-white leading-none">Focus Now</h1>
            <span className="text-[10px] font-bold text-emerald-400 tracking-wider uppercase mt-1 block">DAILY SYSTEM</span>
          </div>
        </div>

        <nav className="flex-1 space-y-2">
          {navItems.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer ${
                currentTab === id 
                  ? 'bg-[#12B886] text-white shadow-lg shadow-emerald-500/20' 
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
              }`}
            >
              <Icon className="w-4.5 h-4.5 stroke-[2.5px]" />
              <span>{label}</span>
            </button>
          ))}
        </nav>

        {/* Desktop Quick Add Button at bottom of Sidebar */}
        <div className="pt-4 border-t border-slate-800">
          <button
            onClick={() => setIsPlusModalOpen(true)}
            className="w-full bg-[#12B886] hover:bg-[#12B886]/90 text-white py-3 px-4 rounded-2xl font-black text-xs uppercase tracking-wider shadow-lg shadow-emerald-500/20 transition-all cursor-pointer flex items-center justify-center gap-2"
          >
            <PlusIcon className="w-4.5 h-4.5 stroke-[3px]" />
            <span>New Logger</span>
          </button>
        </div>
      </aside>

      {/* MAIN VIEWPORT: Scrollable content container */}
      <div className="flex-1 flex flex-col min-h-screen bg-[#F8F9FC] relative">
        
        <main className="flex-1 overflow-y-auto pb-24 md:pb-8">
          <div className="w-full max-w-6xl mx-auto py-2 md:py-6">
            <Suspense fallback={<SectionFallback />}>
            {(currentTab === 'today' || currentTab === 'home') && (
              <TodayScreen
                dateToday={dateToday}
                currentUser={currentUser}
                userPoints={userPoints}
                onNavigateToTab={setTab}
              />
            )}

            {currentTab === 'scheduler' && (
              <SchedulerScreen
                loggedFoods={loggedFoods.length > 0 ? loggedFoods : todaysFoodLog}
                nutritionTargets={nutritionTargets}
                onUpdateNutritionTargets={handleUpdateNutritionTargets}
                onOpenLogFoodForBlock={openLogFoodForBlock}
                onRemoveFood={handleRemoveFood}
                userPoints={userPoints}
                currentUser={currentUser}
              />
            )}

            {currentTab === 'journal' && (
              <JournalScreen
                currentUser={currentUser}
                userPoints={userPoints}
              />
            )}

            {currentTab === 'pillars' && (
              <PillarsScreen
                habits={habits}
                routines={routines}
                pillarGoals={customGoals}
                dateToday={dateToday}
                onLogHabit={handleLogHabit}
                onBatchLogHabits={handleBatchLogHabits}
                onOpenCreateModal={() => setIsPlusModalOpen(true)}
              />
            )}

            {currentTab === 'progress' && (
              <ProgressScreen
                habits={habits}
                routines={routines}
                dateToday={dateToday}
                currentUser={currentUser}
              />
            )}

            {currentTab === 'profile' && (
              <ProfileScreen
                currentUser={currentUser}
                userPoints={userPoints}
                habits={habits}
                routines={routines}
                onLogout={handleLogout}
                onReset={handleResetApp}
                onResetDay1={handleResetMissionDay1}
              />
            )}
            </Suspense>
          </div>
        </main>

        {/* Floating Bottom Navigation Bar: Mobile Only */}
        <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-150 py-2.5 px-3 flex justify-between items-center z-40 shadow-[0_-8px_24px_rgba(0,0,0,0.04)] select-none animate-fade-in">
          <button
            onClick={() => setTab('today')}
            className={`flex flex-col items-center justify-center flex-1 py-1 transition cursor-pointer ${
              currentTab === 'today' ? 'text-[#12B886] scale-105' : 'text-gray-400 hover:text-gray-600'
            }`}
          >
            <Sun className="w-5 h-5 stroke-[2.5px]" />
            <span className="text-[9px] font-black mt-1 uppercase tracking-wider">Today</span>
          </button>

          <button
            onClick={() => setTab('scheduler')}
            className={`flex flex-col items-center justify-center flex-1 py-1 transition cursor-pointer ${
              currentTab === 'scheduler' ? 'text-[#12B886] scale-105' : 'text-gray-400 hover:text-gray-600'
            }`}
          >
            <CalendarIcon className="w-5 h-5 stroke-[2.5px]" />
            <span className="text-[9px] font-black mt-1 uppercase tracking-wider">Scheduler</span>
          </button>

          <button
            onClick={() => setTab('journal')}
            className={`flex flex-col items-center justify-center flex-1 py-1 transition cursor-pointer ${
              currentTab === 'journal' ? 'text-[#12B886] scale-105' : 'text-gray-400 hover:text-gray-600'
            }`}
          >
            <BookOpen className="w-5 h-5 stroke-[2.5px]" />
            <span className="text-[9px] font-black mt-1 uppercase tracking-wider">Journal</span>
          </button>

          <button
            onClick={() => setTab('progress')}
            className={`flex flex-col items-center justify-center flex-1 py-1 transition cursor-pointer ${
              currentTab === 'progress' ? 'text-[#12B886] scale-105' : 'text-gray-400 hover:text-gray-600'
            }`}
          >
            <BarChartIcon className="w-5 h-5 stroke-[2.5px]" />
            <span className="text-[9px] font-black mt-1 uppercase tracking-wider">Progress</span>
          </button>

          <button
            onClick={() => setTab('profile')}
            className={`flex flex-col items-center justify-center flex-1 py-1 transition cursor-pointer ${
              currentTab === 'profile' ? 'text-[#12B886] scale-105' : 'text-gray-400 hover:text-gray-600'
            }`}
          >
            <UserIcon className="w-5 h-5 stroke-[2.5px]" />
            <span className="text-[9px] font-black mt-1 uppercase tracking-wider">Profile</span>
          </button>
        </div>


      </div>

      {/* Global Action Modal Sheet
          TODO (fix #5): CreateModal.tsx wasn't provided, so I couldn't edit what's
          inside the "+" sheet itself. The props below already give it everything
          it needs (habit creation, routine creation, food logging, points, custom
          goals) — paste CreateModal.tsx and I'll make sure each option routes to
          the right flow with the right pre-filled fields. */}
      <Suspense fallback={null}>
        <CreateModal
          isOpen={isPlusModalOpen}
          onClose={() => setIsPlusModalOpen(false)}
          openCreateHabit={() => setIsHabitModalOpen(true)}
          openCreateRoutine={() => setIsRoutineModalOpen(true)}
          onAddNutrition={handleAddNutrition}
          onAddPoints={handleAddPoints}
          onAddCustomGoal={handleAddCustomGoal}
          nutritionTargets={nutritionTargets}
          onUpdateNutritionTargets={handleUpdateNutritionTargets}
          onOpenLogFood={openLogFood}
        />

        <LogFoodModal
          isOpen={isLogFoodModalOpen}
          onClose={closeLogFood}
          onAddFood={handleAddFood}
          loggedFoodsHistory={loggedFoods}
          initialBlock={logFoodInitialBlock}
        />
      </Suspense>

      <CreateHabitModal
        isOpen={isHabitModalOpen}
        onClose={() => setIsHabitModalOpen(false)}
        routines={routines}
        onCreate={handleCreateHabitSubmit}
      />

      <CreateRoutineModal
        isOpen={isRoutineModalOpen}
        onClose={() => setIsRoutineModalOpen(false)}
        onCreate={handleCreateRoutineSubmit}
      />
    </div>
  );
}


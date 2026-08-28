import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Check,
  Plus,
  Trash2,
  Pencil,
  ArrowRight,
  Clock,
  Sparkles,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  X,
  BookOpen,
  Target,
  Zap,
  Flame,
  Droplets,
  RotateCcw,
} from 'lucide-react';
import { formatDateString, dateToday } from '../data';
import { getDailyPriority, saveDailyPriority, getTomorrowDateStr, getYesterdayDateStr } from '../lib/journal';
import type { TimeBlock } from '../lib/nutritionBlocks';
import { getBlockProteinConsumed, getBlockProteinGoal, normalizeMealTypeToBlock, getCurrentTimeBlock } from '../lib/nutritionBlocks';
import { getStoredFavoriteProteins, type FavoriteProteinItem } from '../lib/favoriteProteins';

// Shared Scheduler tasks storage key to stay 100% unified with DailyScheduler
const SCHEDULER_STORAGE_KEY = 'focus_now_daily_scheduler_tasks_v10';
const NUTRITION_TARGETS_KEY = 'focus_now_scheduler_protein_targets_v1';
const LOGGED_FOODS_KEY = '90day_logged_foods';
const VITALS_STORAGE_KEY = 'focus_now_quick_vitals_v1';

export interface SubTask {
  id: string;
  title: string;
  completed: boolean;
}

export interface TodayTask {
  id: string;
  date: string;
  timeBlock: TimeBlock;
  title: string;
  completed: boolean;
  scheduledTime?: string;
  type?: 'standard' | 'choice' | 'group';
  options?: string[];
  selectedOption?: string;
  subtasks?: SubTask[];
  createdAt: string;
  isRecurrenceTemplate?: boolean;
}

interface TodayScreenProps {
  dateToday: string;
  currentUser?: any;
  userPoints?: number;
  onNavigateToTab?: (tab: string) => void;
  // Props kept for backwards compatibility with any parent invocations
  habits?: any[];
  routines?: any[];
  onLogHabit?: any;
  onBatchLogHabits?: any;
  nutritionToday?: any;
  nutritionTargets?: any;
  todaysFoodLog?: any;
  loggedFoods?: any;
  onUpdateNutritionTargets?: any;
  onOpenLogFoodForBlock?: any;
  onRefresh?: any;
  pillarGoals?: any;
  focusedHabitIds?: any;
  onToggleFocusHabit?: any;
  onDeleteHabit?: any;
  onEditHabit?: any;
  onDeleteRoutine?: any;
  onEditRoutine?: any;
}

export default function TodayScreen({
  dateToday: initialDateToday = dateToday,
  currentUser,
  onNavigateToTab,
}: TodayScreenProps) {
  const [selectedDate, setSelectedDate] = useState<string>(initialDateToday);

  // Time-aware greeting
  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour >= 5 && hour < 12) return 'Good morning.';
    if (hour >= 12 && hour < 17) return 'Good afternoon.';
    if (hour >= 17 && hour < 22) return 'Good evening.';
    return 'Good night.';
  }, []);

  const formattedDate = useMemo(() => {
    const d = new Date(selectedDate + 'T00:00:00');
    return d.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
    });
  }, [selectedDate]);

  // Current active time block
  const currentActiveBlock = useMemo<TimeBlock>(() => {
    return getCurrentTimeBlock();
  }, []);

  // ── ONE THING (Today's #1 Priority) & Streak ─────────────────────────────
  const [oneThing, setOneThing] = useState<string>(() => getDailyPriority(initialDateToday));
  const [isEditingOneThing, setIsEditingOneThing] = useState(false);
  const [oneThingDraft, setOneThingDraft] = useState('');

  useEffect(() => {
    const val = getDailyPriority(selectedDate);
    setOneThing(val);
  }, [selectedDate]);

  // Calculate One Thing Streak
  const priorityStreak = useMemo(() => {
    try {
      const raw = localStorage.getItem('focus_now_daily_priorities_v1');
      if (!raw) return 0;
      const map = JSON.parse(raw);
      let streak = 0;
      let curr = selectedDate;
      if (!map[curr]?.trim()) {
        curr = getYesterdayDateStr(curr);
      }
      while (map[curr] && map[curr].trim().length > 0) {
        streak++;
        curr = getYesterdayDateStr(curr);
        if (streak > 365) break;
      }
      return streak;
    } catch {
      return 0;
    }
  }, [selectedDate, oneThing]);

  // Sync priority updates
  useEffect(() => {
    const handlePrioritySync = (e: any) => {
      if (e.detail?.date === selectedDate) {
        setOneThing(e.detail.priority);
      } else {
        setOneThing(getDailyPriority(selectedDate));
      }
    };
    window.addEventListener('focus_now_priority_updated', handlePrioritySync);
    window.addEventListener('storage', handlePrioritySync);
    return () => {
      window.removeEventListener('focus_now_priority_updated', handlePrioritySync);
      window.removeEventListener('storage', handlePrioritySync);
    };
  }, [selectedDate]);

  const handleSaveOneThing = () => {
    saveDailyPriority(selectedDate, oneThingDraft.trim());
    setOneThing(oneThingDraft.trim());
    setIsEditingOneThing(false);
  };

  // ── Quick Vitals (Water & Energy) ────────────────────────────────────────
  const [vitals, setVitals] = useState<{ water: number; energy: number }>(() => {
    try {
      const raw = localStorage.getItem(VITALS_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed[initialDateToday]) return parsed[initialDateToday];
      }
    } catch {}
    return { water: 0, energy: 0 };
  });

  useEffect(() => {
    try {
      const raw = localStorage.getItem(VITALS_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        setVitals(parsed[selectedDate] || { water: 0, energy: 0 });
      } else {
        setVitals({ water: 0, energy: 0 });
      }
    } catch {}
  }, [selectedDate]);

  const updateVitals = (next: Partial<{ water: number; energy: number }>) => {
    const updated = { ...vitals, ...next };
    setVitals(updated);
    try {
      const raw = localStorage.getItem(VITALS_STORAGE_KEY);
      const parsed = raw ? JSON.parse(raw) : {};
      parsed[selectedDate] = updated;
      localStorage.setItem(VITALS_STORAGE_KEY, JSON.stringify(parsed));
    } catch {}
  };

  // ── Unified Scheduler Tasks ──────────────────────────────────────────────
  const [allTasks, setAllTasks] = useState<TodayTask[]>(() => {
    try {
      const saved = localStorage.getItem(SCHEDULER_STORAGE_KEY);
      if (saved) return JSON.parse(saved);
    } catch {}
    return [];
  });

  const reloadTasks = () => {
    try {
      const saved = localStorage.getItem(SCHEDULER_STORAGE_KEY);
      if (saved) setAllTasks(JSON.parse(saved));
    } catch {}
  };

  useEffect(() => {
    window.addEventListener('storage', reloadTasks);
    window.addEventListener('focus_now_tasks_updated', reloadTasks);
    return () => {
      window.removeEventListener('storage', reloadTasks);
      window.removeEventListener('focus_now_tasks_updated', reloadTasks);
    };
  }, []);

  const saveTasksToStorage = (updatedTasks: TodayTask[]) => {
    setAllTasks(updatedTasks);
    try {
      localStorage.setItem(SCHEDULER_STORAGE_KEY, JSON.stringify(updatedTasks));
      window.dispatchEvent(new CustomEvent('focus_now_tasks_updated', { detail: updatedTasks }));
    } catch {}
  };

  // Filter tasks for selected date (excluding recurrence templates)
  const todayTasks = useMemo(() => {
    return allTasks.filter(t => !t.isRecurrenceTemplate && t.date === selectedDate);
  }, [allTasks, selectedDate]);

  const completedTasksCount = todayTasks.filter(t => t.completed).length;
  const totalTasksCount = todayTasks.length;

  // ── Step-wise Time Blocks & Limit Options ─────────────────────────────────
  const [selectedBlockFilter, setSelectedBlockFilter] = useState<'All' | TimeBlock>('All');
  const [showAllTasks, setShowAllTasks] = useState<boolean>(false);
  const MAX_PREVIEW_TASKS = 6;

  // ── Yesterday's Carry-Over Tasks ──────────────────────────────────────────
  const [dismissedRollover, setDismissedRollover] = useState<boolean>(false);
  const yesterdayDate = useMemo(() => getYesterdayDateStr(selectedDate), [selectedDate]);
  const yesterdayPendingTasks = useMemo(() => {
    return allTasks.filter(
      t => !t.isRecurrenceTemplate && t.date === yesterdayDate && !t.completed
    );
  }, [allTasks, yesterdayDate]);

  const handleRolloverTasks = () => {
    if (yesterdayPendingTasks.length === 0) return;
    const updated = allTasks.map(t => {
      if (!t.isRecurrenceTemplate && t.date === yesterdayDate && !t.completed) {
        return { ...t, date: selectedDate };
      }
      return t;
    });
    saveTasksToStorage(updated);
    setDismissedRollover(true);
  };

  // ── Protein Tracking (shared with Scheduler) ──────────────────────────────
  const [nutritionTargets, setNutritionTargets] = useState<any>(() => {
    try {
      const t = localStorage.getItem(NUTRITION_TARGETS_KEY);
      return t ? JSON.parse(t) : { protein: 150 };
    } catch { return { protein: 150 }; }
  });
  const [loggedFoods, setLoggedFoods] = useState<any[]>(() => {
    try {
      const f = localStorage.getItem(LOGGED_FOODS_KEY);
      return f ? JSON.parse(f) : [];
    } catch { return []; }
  });
  const [editingProteinBlock, setEditingProteinBlock] = useState<TimeBlock | null>(null);
  const [proteinDraft, setProteinDraft] = useState('');

  useEffect(() => {
    const reload = () => {
      try {
        const t = localStorage.getItem(NUTRITION_TARGETS_KEY);
        if (t) setNutritionTargets(JSON.parse(t));
        const f = localStorage.getItem(LOGGED_FOODS_KEY);
        if (f) setLoggedFoods(JSON.parse(f));
      } catch {}
    };
    window.addEventListener('storage', reload);
    return () => window.removeEventListener('storage', reload);
  }, []);

  const todaysFoods = useMemo(() => {
    return loggedFoods.filter((f: any) => f.date === selectedDate || !f.date);
  }, [loggedFoods, selectedDate]);

  const totalProteinConsumed = useMemo(() => {
    return todaysFoods.reduce((acc: number, f: any) => acc + (f.protein || 0), 0);
  }, [todaysFoods]);

  const totalProteinGoal = nutritionTargets?.protein || 150;

  const getBlockProtein = (block: TimeBlock) => ({
    consumed: Math.round(getBlockProteinConsumed(todaysFoods, block)),
    goal: getBlockProteinGoal(block, nutritionTargets),
  });

  const saveProteinGoal = (block: TimeBlock, value: string) => {
    const num = parseInt(value, 10);
    if (isNaN(num) || num < 0) return;
    const keyMap: Record<TimeBlock, string> = {
      Morning: 'morningProtein',
      Afternoon: 'afternoonProtein',
      Evening: 'eveningProtein',
      Night: 'nightProtein',
    };
    const updated = { ...nutritionTargets, [keyMap[block]]: num };
    setNutritionTargets(updated);
    try {
      localStorage.setItem(NUTRITION_TARGETS_KEY, JSON.stringify(updated));
    } catch {}
    setEditingProteinBlock(null);
  };

  // ── Favorite Proteins Quick Logging ──────────────────────────────────────
  const [isProteinQuickLogOpen, setIsProteinQuickLogOpen] = useState(false);
  const [favoriteProteins, setFavoriteProteins] = useState<FavoriteProteinItem[]>(() => getStoredFavoriteProteins());
  const [customProteinAmount, setCustomProteinAmount] = useState('');
  const [customProteinName, setCustomProteinName] = useState('');
  const [selectedProteinBlock, setSelectedProteinBlock] = useState<TimeBlock>(currentActiveBlock);

  useEffect(() => {
    const handleFavs = () => setFavoriteProteins(getStoredFavoriteProteins());
    window.addEventListener('focus_now_favorites_updated', handleFavs);
    window.addEventListener('storage', handleFavs);
    return () => {
      window.removeEventListener('focus_now_favorites_updated', handleFavs);
      window.removeEventListener('storage', handleFavs);
    };
  }, []);

  const handleQuickLogProtein = (item: { name: string; protein: number; emoji?: string }, blockOverride?: TimeBlock) => {
    const block = blockOverride || selectedProteinBlock || currentActiveBlock;
    const newEntry = {
      id: 'plog_' + Math.random().toString(36).substring(2, 9),
      name: item.name,
      protein: Math.round(item.protein * 10) / 10,
      calories: 0,
      mealType: block,
      date: selectedDate,
    };
    const updated = [...loggedFoods, newEntry];
    setLoggedFoods(updated);
    try {
      localStorage.setItem(LOGGED_FOODS_KEY, JSON.stringify(updated));
      window.dispatchEvent(new CustomEvent('storage'));
    } catch {}
    setIsProteinQuickLogOpen(false);
    setCustomProteinAmount('');
    setCustomProteinName('');
  };

  // ── Daily Completion Score & Momentum ────────────────────────────────────
  const dailyScore = useMemo(() => {
    let score = 0;
    let weights = 0;

    // Tasks (50% weight if tasks exist)
    if (totalTasksCount > 0) {
      score += (completedTasksCount / totalTasksCount) * 50;
      weights += 50;
    }
    // Protein (30% weight)
    if (totalProteinGoal > 0) {
      const protRatio = Math.min(1, totalProteinConsumed / totalProteinGoal);
      score += protRatio * (totalTasksCount > 0 ? 30 : 60);
      weights += (totalTasksCount > 0 ? 30 : 60);
    }
    // One Thing (20% weight)
    if (oneThing && oneThing.trim().length > 0) {
      score += (totalTasksCount > 0 ? 20 : 40);
      weights += (totalTasksCount > 0 ? 20 : 40);
    }

    if (weights === 0) return 0;
    return Math.min(100, Math.round(score));
  }, [totalTasksCount, completedTasksCount, totalProteinConsumed, totalProteinGoal, oneThing]);

  const dailyStatusMessage = useMemo(() => {
    if (dailyScore === 0) return 'Ready to start';
    if (dailyScore < 35) return 'Building momentum';
    if (dailyScore < 70) return 'In the flow';
    if (dailyScore < 100) return 'Solid day';
    return 'Mastered today 🎯';
  }, [dailyScore]);


  // Filtered tasks based on block filter
  const filteredTasks = useMemo(() => {
    if (selectedBlockFilter === 'All') return todayTasks;
    return todayTasks.filter(t => t.timeBlock === selectedBlockFilter);
  }, [todayTasks, selectedBlockFilter]);

  // Sliced tasks if limiting to top 6-8 tasks
  const displayedTasks = useMemo(() => {
    if (showAllTasks || selectedBlockFilter !== 'All' || filteredTasks.length <= MAX_PREVIEW_TASKS) {
      return filteredTasks;
    }
    return filteredTasks.slice(0, MAX_PREVIEW_TASKS);
  }, [filteredTasks, showAllTasks, selectedBlockFilter]);

  // ── UP NEXT Item ─────────────────────────────────────────────────────────
  // Find the earliest upcoming scheduled item for today that has not been completed
  const upNextTask = useMemo(() => {
    if (selectedDate !== dateToday) return null;
    const pendingWithTime = todayTasks.filter(t => !t.completed && t.scheduledTime);
    if (pendingWithTime.length > 0) {
      return pendingWithTime[0];
    }
    const pending = todayTasks.filter(t => !t.completed);
    return pending[0] || null;
  }, [todayTasks, selectedDate, dateToday]);

  // ── Task Actions & Routine Groups ────────────────────────────────────────
  const [isAddingTask, setIsAddingTask] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskTime, setNewTaskTime] = useState('');
  const [newTaskBlock, setNewTaskBlock] = useState<TimeBlock>('Morning');
  const [newTaskType, setNewTaskType] = useState<'standard' | 'group'>('standard');
  const [newTaskSteps, setNewTaskSteps] = useState<string[]>(['', '']);

  const [expandedGroupIds, setExpandedGroupIds] = useState<Record<string, boolean>>({});
  const [inlineNewStepText, setInlineNewStepText] = useState<{ [taskId: string]: string }>({});

  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [editTaskTitle, setEditTaskTitle] = useState('');
  const [editTaskTime, setEditTaskTime] = useState('');
  const [editTaskBlock, setEditTaskBlock] = useState<TimeBlock>('Morning');

  const toggleExpandGroup = (taskId: string) => {
    setExpandedGroupIds(prev => ({
      ...prev,
      [taskId]: !prev[taskId],
    }));
  };

  const handleToggleTask = (taskId: string) => {
    const updated = allTasks.map(t => (t.id === taskId ? { ...t, completed: !t.completed } : t));
    saveTasksToStorage(updated);
  };

  const handleToggleSubtask = (taskId: string, subtaskId: string) => {
    const updated = allTasks.map(t => {
      if (t.id !== taskId || !t.subtasks) return t;
      const nextSubs = t.subtasks.map(s => (s.id === subtaskId ? { ...s, completed: !s.completed } : s));
      const allDone = nextSubs.length > 0 && nextSubs.every(s => s.completed);
      return {
        ...t,
        subtasks: nextSubs,
        completed: allDone,
      };
    });
    saveTasksToStorage(updated);
  };

  const handleToggleGroup = (taskId: string) => {
    const target = allTasks.find(t => t.id === taskId);
    if (!target) return;
    const hasSubs = (target.subtasks || []).length > 0;
    const isCurrentlyDone = target.completed || (hasSubs && target.subtasks!.every(s => s.completed));
    const nextCompleted = !isCurrentlyDone;

    const updated = allTasks.map(t => {
      if (t.id !== taskId) return t;
      return {
        ...t,
        completed: nextCompleted,
        subtasks: t.subtasks ? t.subtasks.map(s => ({ ...s, completed: nextCompleted })) : undefined,
      };
    });
    saveTasksToStorage(updated);
  };

  const handleAddSubtaskToGroup = (taskId: string) => {
    const title = (inlineNewStepText[taskId] || '').trim();
    if (!title) return;

    const newSub: SubTask = {
      id: 'sub_' + Math.random().toString(36).substring(2, 9),
      title,
      completed: false,
    };

    const updated = allTasks.map(t => {
      if (t.id !== taskId) return t;
      const nextSubs = [...(t.subtasks || []), newSub];
      return {
        ...t,
        type: 'group' as const,
        subtasks: nextSubs,
        completed: false,
      };
    });

    saveTasksToStorage(updated);
    setInlineNewStepText(prev => ({ ...prev, [taskId]: '' }));
    setExpandedGroupIds(prev => ({ ...prev, [taskId]: true }));
  };

  const handleDeleteSubtask = (taskId: string, subtaskId: string) => {
    const updated = allTasks.map(t => {
      if (t.id !== taskId || !t.subtasks) return t;
      const nextSubs = t.subtasks.filter(s => s.id !== subtaskId);
      const allDone = nextSubs.length > 0 && nextSubs.every(s => s.completed);
      return {
        ...t,
        subtasks: nextSubs,
        completed: allDone,
      };
    });
    saveTasksToStorage(updated);
  };

  const handleAddTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskTitle.trim()) return;

    // Use user-selected block or fallback based on current hour
    let timeBlock: TimeBlock = newTaskBlock;
    if (!newTaskBlock) {
      const hour = new Date().getHours();
      if (hour >= 12 && hour < 17) timeBlock = 'Afternoon';
      else if (hour >= 17 && hour < 21) timeBlock = 'Evening';
      else if (hour >= 21) timeBlock = 'Night';
      else timeBlock = 'Morning';
    }

    const subtasks: SubTask[] = newTaskType === 'group'
      ? newTaskSteps
          .filter(s => s.trim().length > 0)
          .map(s => ({
            id: 'sub_' + Math.random().toString(36).substring(2, 9),
            title: s.trim(),
            completed: false,
          }))
      : [];

    const newTask: TodayTask = {
      id: 'task_' + Math.random().toString(36).substring(2, 9),
      date: selectedDate,
      timeBlock,
      title: newTaskTitle.trim(),
      type: newTaskType,
      subtasks: subtasks.length > 0 ? subtasks : undefined,
      scheduledTime: newTaskTime.trim() || undefined,
      completed: false,
      createdAt: new Date().toISOString(),
    };

    saveTasksToStorage([...allTasks, newTask]);
    setNewTaskTitle('');
    setNewTaskTime('');
    setNewTaskType('standard');
    setNewTaskSteps(['', '']);
    setIsAddingTask(false);
  };

  const handleSaveEditTask = (taskId: string) => {
    if (!editTaskTitle.trim()) return;
    const updated = allTasks.map(t =>
      t.id === taskId
        ? {
            ...t,
            title: editTaskTitle.trim(),
            timeBlock: editTaskBlock,
            scheduledTime: editTaskTime.trim() || undefined,
          }
        : t
    );
    saveTasksToStorage(updated);
    setEditingTaskId(null);
  };

  const handleDeleteTask = (taskId: string) => {
    const updated = allTasks.filter(t => t.id !== taskId);
    saveTasksToStorage(updated);
  };

  const handleMoveTask = (taskId: string, direction: 'up' | 'down') => {
    const currentDayTaskIds = todayTasks.map(t => t.id);
    const indexInDay = currentDayTaskIds.indexOf(taskId);
    if (indexInDay === -1) return;

    const targetIndexInDay = direction === 'up' ? indexInDay - 1 : indexInDay + 1;
    if (targetIndexInDay < 0 || targetIndexInDay >= currentDayTaskIds.length) return;

    const targetTaskId = currentDayTaskIds[targetIndexInDay];

    // Swap positions in allTasks
    const globalIdx1 = allTasks.findIndex(t => t.id === taskId);
    const globalIdx2 = allTasks.findIndex(t => t.id === targetTaskId);

    if (globalIdx1 !== -1 && globalIdx2 !== -1) {
      const next = [...allTasks];
      const temp = next[globalIdx1];
      next[globalIdx1] = next[globalIdx2];
      next[globalIdx2] = temp;
      saveTasksToStorage(next);
    }
  };

  const handleNavigateDay = (delta: number) => {
    const d = new Date(selectedDate + 'T00:00:00');
    d.setDate(d.getDate() + delta);
    setSelectedDate(formatDateString(d));
  };

  return (
    <div className="w-full max-w-2xl mx-auto px-4 sm:px-6 py-8 pb-28 font-sans text-slate-900 select-none">
      
      {/* ── HEADER / GREETING & DAILY SCORE ─────────────────────────────── */}
      <div className="mb-8 space-y-3">
        <div className="flex items-center justify-between">
          <div className="text-[11px] font-black uppercase tracking-widest text-emerald-600">
            Today
          </div>

          <div className="flex items-center gap-1.5 text-xs text-slate-400 font-bold">
            <button
              onClick={() => handleNavigateDay(-1)}
              className="p-1 hover:text-slate-700 transition cursor-pointer"
              title="Previous Day"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span>{formattedDate}</span>
            <button
              onClick={() => handleNavigateDay(1)}
              className="p-1 hover:text-slate-700 transition cursor-pointer"
              title="Next Day"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight">
              {greeting}
            </h1>
            <p className="text-xs text-slate-400 font-medium pt-0.5">
              Focus on what matters today.
            </p>
          </div>

          {/* 1. Daily Score / Completion Ring */}
          <div className="bg-white px-3.5 py-2.5 rounded-2xl border border-slate-200/80 shadow-xs flex items-center gap-3 shrink-0">
            <div className="relative w-10 h-10 flex items-center justify-center">
              <svg className="w-10 h-10 -rotate-90" viewBox="0 0 36 36">
                <path
                  className="text-slate-100"
                  strokeWidth="3.5"
                  stroke="currentColor"
                  fill="none"
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                />
                <path
                  className="text-emerald-500 transition-all duration-500"
                  strokeDasharray={`${dailyScore}, 100`}
                  strokeLinecap="round"
                  strokeWidth="3.5"
                  stroke="currentColor"
                  fill="none"
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                />
              </svg>
              <span className="absolute text-[11px] font-black font-mono text-slate-800">
                {dailyScore}%
              </span>
            </div>
            <div className="hidden sm:block">
              <div className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-wider">
                Daily Score
              </div>
              <div className="text-xs font-bold text-slate-800">
                {dailyStatusMessage}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── ONE THING (#1 PRIORITY) & STREAK ─────────────────────────────── */}
      <div className="mb-6 space-y-2.5">
        <div className="flex items-center justify-between">
          <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">
            One Thing
          </div>
          {/* 3. Streak Indicator */}
          {priorityStreak > 0 && (
            <div className="flex items-center gap-1 text-[11px] font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200/60 shadow-xs">
              <Flame className="w-3.5 h-3.5 fill-amber-500 text-amber-500" />
              <span>{priorityStreak}d streak</span>
            </div>
          )}
        </div>

        {isEditingOneThing ? (
          <div className="space-y-2">
            <input
              type="text"
              value={oneThingDraft}
              onChange={e => setOneThingDraft(e.target.value)}
              placeholder="What is the one thing you really want to accomplish today?"
              className="w-full px-4 py-3 text-sm font-bold bg-white border border-emerald-500 rounded-2xl focus:outline-none focus:ring-2 focus:ring-emerald-500 shadow-xs"
              autoFocus
              onKeyDown={e => {
                if (e.key === 'Enter') handleSaveOneThing();
                if (e.key === 'Escape') setIsEditingOneThing(false);
              }}
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setIsEditingOneThing(false)}
                className="px-3 py-1.5 text-xs text-slate-500 hover:text-slate-800 cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveOneThing}
                className="px-4 py-1.5 text-xs font-black bg-slate-900 text-white rounded-xl hover:bg-slate-800 cursor-pointer"
              >
                Save
              </button>
            </div>
          </div>
        ) : (
          <div
            onClick={() => {
              setOneThingDraft(oneThing);
              setIsEditingOneThing(true);
            }}
            className="group p-5 bg-white rounded-2xl border border-slate-200/80 hover:border-slate-300 transition-all cursor-pointer shadow-xs relative flex items-center justify-between"
          >
            {oneThing ? (
              <p className="text-base sm:text-lg font-bold text-slate-900 leading-snug">
                {oneThing}
              </p>
            ) : (
              <p className="text-sm font-medium text-slate-400 italic">
                Set today's #1 priority...
              </p>
            )}

            <Pencil className="w-4 h-4 text-slate-300 group-hover:text-slate-600 transition shrink-0 ml-3" />
          </div>
        )}
      </div>

      {/* ── 4. QUICK VITALS ROW (WATER & ENERGY) ─────────────────────────── */}
      <div className="mb-8 grid grid-cols-2 gap-2.5">
        {/* Water tracker */}
        <div className="bg-white p-3.5 rounded-2xl border border-slate-200/70 shadow-xs flex items-center justify-between gap-2">
          <div className="min-w-0">
            <div className="text-[10px] font-black uppercase tracking-wider text-slate-400 flex items-center gap-1">
              <Droplets className="w-3 h-3 text-cyan-500" />
              <span>Water</span>
            </div>
            <div className="text-xs sm:text-sm font-bold text-slate-800 truncate pt-0.5">
              {vitals.water} <span className="text-xs text-slate-400 font-normal">({(vitals.water * 0.25).toFixed(1)}L)</span>
            </div>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            <button
              type="button"
              onClick={() => updateVitals({ water: Math.max(0, vitals.water - 1) })}
              className="w-6 h-6 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 font-black text-xs flex items-center justify-center transition cursor-pointer"
              title="Minus 1 glass"
            >
              -
            </button>
            <button
              type="button"
              onClick={() => updateVitals({ water: vitals.water + 1 })}
              className="w-6 h-6 rounded-lg bg-cyan-50 hover:bg-cyan-100 text-cyan-700 font-black text-xs flex items-center justify-center transition cursor-pointer"
              title="Add 1 glass (250ml)"
            >
              +
            </button>
          </div>
        </div>

        {/* Protein Quick Log from Favorites */}
        <div className="bg-white p-3.5 rounded-2xl border border-slate-200/70 shadow-xs flex items-center justify-between gap-2">
          <div className="min-w-0">
            <div className="text-[10px] font-black uppercase tracking-wider text-slate-400 flex items-center gap-1">
              <Zap className="w-3 h-3 text-amber-500" />
              <span>Protein</span>
            </div>
            <div className="text-xs sm:text-sm font-bold text-slate-800 truncate pt-0.5">
              {totalProteinConsumed}g <span className="text-xs text-slate-400 font-normal">/ {totalProteinGoal}g</span>
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              setSelectedProteinBlock(currentActiveBlock);
              setIsProteinQuickLogOpen(true);
            }}
            className="px-2.5 py-1.5 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-900 text-xs font-black transition cursor-pointer flex items-center gap-1 shrink-0 border border-amber-200/60 shadow-xs active:scale-95"
            title="Log protein from favorites"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Log</span>
          </button>
        </div>
      </div>

      {/* ── 5. YESTERDAY'S CARRY-OVER BANNER ──────────────────────────────── */}
      {yesterdayPendingTasks.length > 0 && !dismissedRollover && (
        <div className="mb-6 px-4 py-3 bg-amber-50/70 border border-amber-200/80 rounded-2xl flex items-center justify-between gap-3 shadow-xs">
          <div className="flex items-center gap-2 min-w-0">
            <RotateCcw className="w-4 h-4 text-amber-600 shrink-0" />
            <p className="text-xs font-bold text-amber-900 truncate">
              {yesterdayPendingTasks.length} open task{yesterdayPendingTasks.length > 1 ? 's' : ''} from yesterday
            </p>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={handleRolloverTasks}
              className="px-3 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold transition cursor-pointer shadow-xs"
            >
              Rollover to Today
            </button>
            <button
              type="button"
              onClick={() => setDismissedRollover(true)}
              className="p-1 text-amber-500 hover:text-amber-800 transition cursor-pointer"
              title="Dismiss"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* ── TASKS SECTION ────────────────────────────────────────────────── */}
      <div className="mb-10 space-y-3">
        <div className="flex items-center justify-between">
          <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">
            Tasks · Steps by Time
          </div>
          {totalTasksCount > 0 && (
            <span className="text-[11px] font-bold text-slate-400 font-mono">
              {completedTasksCount} of {totalTasksCount} completed
            </span>
          )}
        </div>

        {/* Time Block Step-wise Filter Bar with 2. Active Block Focus */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 select-none">
          <button
            onClick={() => setSelectedBlockFilter('All')}
            className={`px-3 py-1.5 rounded-xl text-xs font-black transition cursor-pointer border shrink-0 ${
              selectedBlockFilter === 'All'
                ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
                : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
            }`}
          >
            All ({totalTasksCount})
          </button>
          {[
            { block: 'Morning' as TimeBlock, emoji: '☀️', label: 'Morning' },
            { block: 'Afternoon' as TimeBlock, emoji: '🌤️', label: 'Afternoon' },
            { block: 'Evening' as TimeBlock, emoji: '🌇', label: 'Evening' },
            { block: 'Night' as TimeBlock, emoji: '🌙', label: 'Night' },
          ].map(({ block, emoji, label }) => {
            const count = todayTasks.filter(t => t.timeBlock === block).length;
            const isActive = selectedBlockFilter === block;
            const isCurrentTimeBlock = block === currentActiveBlock && selectedDate === dateToday;

            return (
              <button
                key={block}
                onClick={() => setSelectedBlockFilter(block)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer border flex items-center gap-1.5 shrink-0 ${
                  isActive
                    ? 'bg-slate-900 text-white border-slate-900 shadow-xs font-black'
                    : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                }`}
              >
                <span>{emoji}</span>
                <span>{label}</span>
                {isCurrentTimeBlock && (
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" title="Active block now" />
                )}
                {count > 0 && <span className="text-[10px] opacity-70">({count})</span>}
              </button>
            );
          })}
        </div>

        {/* Task List */}
        <div className="space-y-4">
          {displayedTasks.length === 0 && !isAddingTask ? (
            <div className="p-6 text-center bg-white rounded-2xl border border-dashed border-slate-200">
              <p className="text-xs text-slate-400 font-medium">
                {selectedBlockFilter === 'All'
                  ? 'No tasks added for today yet.'
                  : `No tasks in ${selectedBlockFilter} block.`}
              </p>
            </div>
          ) : (
            // Group step-wise by time block if in 'All' view, otherwise flat for selected block
            (selectedBlockFilter === 'All'
              ? ['Morning', 'Afternoon', 'Evening', 'Night'] as TimeBlock[]
              : [selectedBlockFilter]
            ).map(block => {
              const blockTasks = displayedTasks.filter(t => t.timeBlock === block);
              if (blockTasks.length === 0) return null;

              const emojiMap: Record<string, string> = {
                Morning: '☀️',
                Afternoon: '🌤️',
                Evening: '🌇',
                Night: '🌙',
              };

              const { consumed, goal } = getBlockProtein(block);
              const proteinPct = goal > 0 ? Math.min(100, Math.round((consumed / goal) * 100)) : 0;
              const proteinDone = consumed >= goal;
              const isCurrentBlock = block === currentActiveBlock && selectedDate === dateToday;

              return (
                <div key={block} className="space-y-2">
                  {selectedBlockFilter === 'All' && (
                    <div className="flex items-center justify-between px-1 pt-1 gap-3">
                      {/* Block label + task count + Active Now badge */}
                      <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 flex items-center gap-1.5 shrink-0">
                        <span>{emojiMap[block]}</span>
                        <span>{block}</span>
                        {isCurrentBlock && (
                          <span className="text-[9px] font-extrabold bg-emerald-100 text-emerald-700 px-1.5 py-0.2 rounded-md tracking-normal">
                            NOW
                          </span>
                        )}
                        <span className="font-mono font-bold text-slate-300">
                          {blockTasks.filter(t => t.completed).length}/{blockTasks.length}
                        </span>
                      </span>

                      {/* Protein mini bar */}
                      <div className="flex items-center gap-2 flex-1 justify-end">
                        {editingProteinBlock === block ? (
                          <div className="flex items-center gap-1">
                            <input
                              type="number"
                              autoFocus
                              value={proteinDraft}
                              onChange={e => setProteinDraft(e.target.value)}
                              onKeyDown={e => {
                                if (e.key === 'Enter') saveProteinGoal(block, proteinDraft);
                                if (e.key === 'Escape') setEditingProteinBlock(null);
                              }}
                              onBlur={() => saveProteinGoal(block, proteinDraft)}
                              className="w-12 px-1.5 py-0.5 text-[11px] font-mono font-bold border border-slate-300 rounded-lg text-center focus:outline-none"
                              placeholder={String(goal)}
                            />
                            <span className="text-[10px] text-slate-400">g</span>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => { setEditingProteinBlock(block); setProteinDraft(String(goal)); }}
                            className="flex items-center gap-1.5 group/prot cursor-pointer"
                            title={`Protein: ${consumed}g / ${goal}g — tap to edit goal`}
                          >
                            <Zap className="w-3 h-3 text-slate-300 group-hover/prot:text-amber-500 transition" />
                            <div className="flex items-center gap-1">
                              <div className="w-14 h-1 bg-slate-100 rounded-full overflow-hidden">
                                <div
                                  className={`h-full rounded-full transition-all ${proteinDone ? 'bg-emerald-400' : 'bg-amber-400'}`}
                                  style={{ width: `${proteinPct}%` }}
                                />
                              </div>
                              <span className={`text-[10px] font-mono font-bold ${proteinDone ? 'text-emerald-500' : 'text-slate-400'}`}>
                                {consumed}<span className="text-slate-300 font-normal">/{goal}g</span>
                              </span>
                            </div>
                          </button>
                        )}
                      </div>
                    </div>
                  )}

                  <div className="space-y-2.5">
                    {blockTasks.map(task => {
                      const isEditing = editingTaskId === task.id;
                      const isGroup = task.type === 'group' || (task.subtasks && task.subtasks.length > 0);
                      const subtasks = task.subtasks || [];
                      const completedSubsCount = subtasks.filter(s => s.completed).length;
                      const isGroupAllDone = subtasks.length > 0 ? completedSubsCount === subtasks.length : task.completed;
                      const groupPct = subtasks.length > 0 ? Math.round((completedSubsCount / subtasks.length) * 100) : (task.completed ? 100 : 0);
                      const isExpanded = Boolean(expandedGroupIds[task.id]); // default closed on initial load

                      if (isEditing) {
                        return (
                          <div
                            key={task.id}
                            className="p-3.5 bg-white rounded-2xl border-2 border-emerald-500 space-y-2"
                          >
                            <input
                              type="text"
                              value={editTaskTitle}
                              onChange={e => setEditTaskTitle(e.target.value)}
                              className="w-full px-3 py-1.5 text-xs font-bold border border-slate-200 rounded-xl focus:outline-none"
                              autoFocus
                            />
                            <div className="flex flex-wrap items-center gap-2">
                              <select
                                value={editTaskBlock}
                                onChange={e => setEditTaskBlock(e.target.value as TimeBlock)}
                                className="px-2.5 py-1.5 text-xs border border-slate-200 rounded-xl bg-white font-bold"
                              >
                                <option value="Morning">☀️ Morning</option>
                                <option value="Afternoon">🌤️ Afternoon</option>
                                <option value="Evening">🌇 Evening</option>
                                <option value="Night">🌙 Night</option>
                              </select>
                              <input
                                type="text"
                                placeholder="Time (e.g. 7:00 PM)"
                                value={editTaskTime}
                                onChange={e => setEditTaskTime(e.target.value)}
                                className="px-3 py-1.5 text-xs border border-slate-200 rounded-xl w-32"
                              />
                              <div className="flex-1" />
                              <button
                                onClick={() => setEditingTaskId(null)}
                                className="px-3 py-1 text-xs text-slate-500"
                              >
                                Cancel
                              </button>
                              <button
                                onClick={() => handleSaveEditTask(task.id)}
                                className="px-3.5 py-1 text-xs font-black bg-slate-900 text-white rounded-xl"
                              >
                                Save
                              </button>
                            </div>
                          </div>
                        );
                      }

                      {/* ── ROUTINE GROUP CARD ── */}
                      if (isGroup) {
                        return (
                          <div
                            key={task.id}
                            className="bg-white rounded-2xl border border-slate-200/70 hover:border-slate-300 transition overflow-hidden shadow-xs"
                          >
                            {/* Header: same compact size as standard task */}
                            <div className="px-4 py-3 flex items-center justify-between gap-3 select-none">
                              <div className="flex items-center gap-3 min-w-0 flex-1">
                                {/* Circle Checkbox */}
                                <div
                                  onClick={() => handleToggleGroup(task.id)}
                                  className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition shrink-0 cursor-pointer ${
                                    isGroupAllDone
                                      ? 'bg-emerald-500 border-emerald-500 text-white'
                                      : 'border-slate-300 hover:border-emerald-400 bg-white'
                                  }`}
                                >
                                  {isGroupAllDone && <Check className="w-3 h-3 stroke-[3px]" />}
                                </div>

                                <div
                                  onClick={() => toggleExpandGroup(task.id)}
                                  className="min-w-0 flex-1 flex items-center gap-2 cursor-pointer"
                                >
                                  <span
                                    className={`text-xs sm:text-sm font-bold block truncate ${
                                      isGroupAllDone ? 'line-through text-slate-400 font-medium' : 'text-slate-800'
                                    }`}
                                  >
                                    {task.title}
                                  </span>
                                  {/* Minimalistic step badge: "· 2/4" */}
                                  <span className="text-[10px] font-mono text-slate-400 shrink-0">
                                    · {completedSubsCount}/{subtasks.length}
                                  </span>
                                </div>

                                {task.scheduledTime && (
                                  <span className="text-[10px] font-mono font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-md shrink-0">
                                    {task.scheduledTime}
                                  </span>
                                )}
                              </div>

                              {/* Actions & Chevron toggle */}
                              <div className="flex items-center gap-1 shrink-0">
                                <button
                                  type="button"
                                  onClick={() => toggleExpandGroup(task.id)}
                                  className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition cursor-pointer"
                                  title={isExpanded ? 'Collapse steps' : 'Expand steps'}
                                >
                                  {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                                </button>
                                <button
                                  onClick={() => {
                                    setEditingTaskId(task.id);
                                    setEditTaskTitle(task.title);
                                    setEditTaskTime(task.scheduledTime || '');
                                    setEditTaskBlock(task.timeBlock || 'Morning');
                                  }}
                                  className="p-1 text-slate-400 hover:text-slate-700 opacity-0 group-hover:opacity-100 transition"
                                  title="Edit"
                                >
                                  <Pencil className="w-3 h-3" />
                                </button>
                                <button
                                  onClick={() => handleDeleteTask(task.id)}
                                  className="p-1 text-slate-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition"
                                  title="Delete"
                                >
                                  <Trash2 className="w-3 h-3" />
                                </button>
                              </div>
                            </div>

                            {/* Subtask Steps List */}
                            {isExpanded && subtasks.length > 0 && (
                              <div className="px-4 pb-2.5 pt-1 border-t border-slate-100/80 bg-slate-50/40 space-y-1">
                                {subtasks.map(sub => (
                                  <div
                                    key={sub.id}
                                    className="flex items-center justify-between gap-2.5 py-1 px-2 rounded-lg hover:bg-white transition group/sub"
                                  >
                                    <div
                                      onClick={() => handleToggleSubtask(task.id, sub.id)}
                                      className="flex items-center gap-2.5 min-w-0 flex-1 cursor-pointer"
                                    >
                                      <div
                                        className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center transition shrink-0 ${
                                          sub.completed
                                            ? 'bg-emerald-500 border-emerald-500 text-white'
                                            : 'border-slate-300 bg-white hover:border-emerald-400'
                                        }`}
                                      >
                                        {sub.completed && <Check className="w-2 h-2 stroke-[3px]" />}
                                      </div>
                                      <span
                                        className={`text-xs truncate ${
                                          sub.completed ? 'line-through text-slate-400' : 'text-slate-700 font-medium'
                                        }`}
                                      >
                                        {sub.title}
                                      </span>
                                    </div>

                                    <button
                                      type="button"
                                      onClick={() => handleDeleteSubtask(task.id, sub.id)}
                                      className="p-0.5 text-slate-300 hover:text-red-500 opacity-0 group-hover/sub:opacity-100 transition"
                                      title="Remove step"
                                    >
                                      <X className="w-3 h-3" />
                                    </button>
                                  </div>
                                ))}

                                {/* Quick inline add step */}
                                <div className="pt-1 flex items-center gap-1.5">
                                  <input
                                    type="text"
                                    placeholder="+ Add step..."
                                    value={inlineNewStepText[task.id] || ''}
                                    onChange={e =>
                                      setInlineNewStepText(prev => ({ ...prev, [task.id]: e.target.value }))
                                    }
                                    onKeyDown={e => {
                                      if (e.key === 'Enter') handleAddSubtaskToGroup(task.id);
                                    }}
                                    className="w-full px-2.5 py-1 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-slate-800"
                                  />
                                  <button
                                    type="button"
                                    onClick={() => handleAddSubtaskToGroup(task.id)}
                                    className="px-2.5 py-1 rounded-lg bg-slate-900 text-white text-[11px] font-bold hover:bg-slate-800 shrink-0"
                                  >
                                    Add
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      }

                      {/* ── STANDARD TASK CARD ── */}
                      return (
                        <div
                          key={task.id}
                          className="group px-4 py-3 bg-white rounded-2xl border border-slate-200/70 hover:border-slate-300 transition flex items-center justify-between gap-3 shadow-xs"
                        >
                          <div
                            onClick={() => handleToggleTask(task.id)}
                            className="flex items-center gap-3 min-w-0 flex-1 cursor-pointer"
                          >
                            {/* Circle Checkbox */}
                            <div
                              className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition shrink-0 ${
                                task.completed
                                  ? 'bg-emerald-500 border-emerald-500 text-white'
                                  : 'border-slate-300 hover:border-emerald-400 bg-white'
                              }`}
                            >
                              {task.completed && <Check className="w-3 h-3 stroke-[3px]" />}
                            </div>

                            <div className="min-w-0 flex-1">
                              <span
                                className={`text-xs sm:text-sm font-bold block truncate ${
                                  task.completed
                                    ? 'line-through text-slate-400 font-medium'
                                    : 'text-slate-800'
                                }`}
                              >
                                {task.title}
                              </span>
                            </div>

                            {task.scheduledTime && (
                              <span className="text-[10px] font-mono font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-md shrink-0">
                                {task.scheduledTime}
                              </span>
                            )}
                          </div>

                          {/* Quick actions (visible on hover) */}
                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition shrink-0">
                            <button
                              onClick={() => {
                                setEditingTaskId(task.id);
                                setEditTaskTitle(task.title);
                                setEditTaskTime(task.scheduledTime || '');
                                setEditTaskBlock(task.timeBlock || 'Morning');
                              }}
                              className="p-1 text-slate-400 hover:text-slate-700"
                              title="Edit"
                            >
                              <Pencil className="w-3 h-3" />
                            </button>
                            <button
                              onClick={() => handleDeleteTask(task.id)}
                              className="p-1 text-slate-400 hover:text-red-500"
                              title="Delete"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Show More / Show Less Toggle Button (when in All view & > 6 tasks) */}
        {selectedBlockFilter === 'All' && totalTasksCount > MAX_PREVIEW_TASKS && (
          <div className="text-center pt-1">
            <button
              type="button"
              onClick={() => setShowAllTasks(prev => !prev)}
              className="text-xs font-bold text-slate-500 hover:text-slate-900 bg-slate-100/70 hover:bg-slate-100 px-4 py-2 rounded-xl transition cursor-pointer inline-flex items-center gap-1.5"
            >
              <span>{showAllTasks ? `Show top focus (${MAX_PREVIEW_TASKS})` : `Show all ${totalTasksCount} tasks`}</span>
              <span className="text-[10px]">{showAllTasks ? '▴' : '▾'}</span>
            </button>
          </div>
        )}

        {/* Add Task Form or Button */}
        {isAddingTask ? (
          <form onSubmit={handleAddTask} className="p-4 bg-white rounded-2xl border border-slate-200 space-y-3 mt-2 shadow-xs">
            {/* Task Type Switcher */}
            <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
              <button
                type="button"
                onClick={() => setNewTaskType('standard')}
                className={`px-3 py-1 rounded-xl text-xs font-bold transition cursor-pointer ${
                  newTaskType === 'standard'
                    ? 'bg-slate-900 text-white font-black'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                Single Task
              </button>
              <button
                type="button"
                onClick={() => setNewTaskType('group')}
                className={`px-3 py-1 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
                  newTaskType === 'group'
                    ? 'bg-slate-900 text-white font-black'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                <span>📁</span>
                <span>Routine Group</span>
              </button>
            </div>

            <input
              type="text"
              placeholder={newTaskType === 'group' ? 'Routine Name (e.g. Morning Rituals)' : 'Task name (e.g. Finish assignment)'}
              value={newTaskTitle}
              onChange={e => setNewTaskTitle(e.target.value)}
              className="w-full px-3.5 py-2 text-xs font-bold border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500"
              autoFocus
            />

            {/* Routine Steps input if group */}
            {newTaskType === 'group' && (
              <div className="space-y-2 p-3 bg-slate-50 rounded-xl border border-slate-200">
                <div className="text-[11px] font-black uppercase tracking-wider text-slate-500">
                  Routine Steps
                </div>
                {newTaskSteps.map((step, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <span className="text-[10px] font-mono font-bold text-slate-400 w-4">{idx + 1}.</span>
                    <input
                      type="text"
                      placeholder={`Step ${idx + 1} (e.g. ${idx === 0 ? '50 Pushups' : idx === 1 ? 'Cold shower' : 'Meditation'})`}
                      value={step}
                      onChange={e => {
                        const next = [...newTaskSteps];
                        next[idx] = e.target.value;
                        setNewTaskSteps(next);
                      }}
                      className="flex-1 px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-slate-800"
                    />
                    {newTaskSteps.length > 1 && (
                      <button
                        type="button"
                        onClick={() => setNewTaskSteps(newTaskSteps.filter((_, i) => i !== idx))}
                        className="p-1 text-slate-400 hover:text-red-500"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() => setNewTaskSteps([...newTaskSteps, ''])}
                  className="text-xs font-bold text-slate-600 hover:text-slate-900 flex items-center gap-1 pt-1 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add another step</span>
                </button>
              </div>
            )}

            <div className="flex flex-wrap items-center gap-2">
              <select
                value={newTaskBlock}
                onChange={e => setNewTaskBlock(e.target.value as TimeBlock)}
                className="px-2.5 py-1.5 text-xs border border-slate-200 rounded-xl bg-white font-bold"
              >
                <option value="Morning">☀️ Morning</option>
                <option value="Afternoon">🌤️ Afternoon</option>
                <option value="Evening">🌇 Evening</option>
                <option value="Night">🌙 Night</option>
              </select>
              <input
                type="text"
                placeholder="Time (optional, e.g. 7:00 PM)"
                value={newTaskTime}
                onChange={e => setNewTaskTime(e.target.value)}
                className="px-3 py-1.5 text-xs border border-slate-200 rounded-xl w-40"
              />
              <div className="flex-1" />
              <button
                type="button"
                onClick={() => setIsAddingTask(false)}
                className="px-3 py-1.5 text-xs text-slate-500 hover:text-slate-800"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-1.5 text-xs font-black bg-slate-900 text-white rounded-xl hover:bg-slate-800"
              >
                {newTaskType === 'group' ? 'Create Routine' : 'Add Task'}
              </button>
            </div>
          </form>
        ) : (
          <button
            onClick={() => setIsAddingTask(true)}
            className="w-full py-3 rounded-2xl border border-dashed border-slate-300 text-xs font-bold text-slate-500 hover:text-slate-900 hover:border-slate-400 transition flex items-center justify-center gap-1.5 cursor-pointer bg-white mt-2"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add task or routine</span>
          </button>
        )}
      </div>



      {/* ── UP NEXT ──────────────────────────────────────────────────────── */}
      {upNextTask && (
        <div className="mb-10 space-y-2">
          <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">
            Up Next
          </div>
          <div
            onClick={() => onNavigateToTab?.('scheduler')}
            className="p-4 bg-white rounded-2xl border border-slate-200/80 hover:border-slate-300 transition flex items-center justify-between cursor-pointer shadow-xs group"
          >
            <div>
              {upNextTask.scheduledTime && (
                <span className="text-[10px] font-mono font-bold text-emerald-600 block">
                  {upNextTask.scheduledTime}
                </span>
              )}
              <h4 className="text-sm font-bold text-slate-900 mt-0.5">
                {upNextTask.title}
              </h4>
            </div>
            <div className="flex items-center gap-1 text-xs font-bold text-slate-400 group-hover:text-slate-700 transition">
              <span>Scheduler</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </div>
          </div>
        </div>
      )}

      {/* ── TONIGHT / NIGHT REFLECTION ──────────────────────────────────── */}
      <div className="space-y-2">
        <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">
          Tonight
        </div>
        <div
          onClick={() => onNavigateToTab?.('journal')}
          className="p-6 bg-white rounded-3xl border border-slate-200/80 hover:border-slate-300 transition cursor-pointer shadow-xs group relative overflow-hidden"
        >
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <div className="text-xs font-black uppercase tracking-wider text-emerald-600">
                Night Reflection
              </div>
              <h3 className="text-base font-black text-slate-900">
                Reflect on your day
              </h3>
              <p className="text-xs text-slate-400 font-medium">
                Answer your daily life questions and set tomorrow's priority.
              </p>
            </div>

            <div className="w-10 h-10 rounded-2xl bg-slate-900 group-hover:bg-slate-800 text-white flex items-center justify-center shrink-0 transition group-hover:scale-105 shadow-md shadow-slate-900/10">
              <ArrowRight className="w-4 h-4 stroke-[2.5px]" />
            </div>
          </div>
        </div>
      </div>

      {/* ── FAVORITE PROTEINS QUICK LOG MODAL ────────────────────────────── */}
      <AnimatePresence>
        {isProteinQuickLogOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/40 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="w-full max-w-md bg-white rounded-3xl p-5 shadow-2xl border border-slate-200/80 space-y-4 max-h-[90vh] overflow-y-auto"
            >
              {/* Header */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-amber-100 flex items-center justify-center text-amber-600">
                    <Zap className="w-4 h-4 fill-amber-500 text-amber-500" />
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-slate-900">Quick Log Protein</h3>
                    <p className="text-[11px] text-slate-400">Select a favorite or enter grams</p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setIsProteinQuickLogOpen(false)}
                  className="p-1.5 text-slate-400 hover:text-slate-700 rounded-xl hover:bg-slate-100 transition cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Time Block Selector */}
              <div>
                <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 block mb-1.5">
                  Meal / Time Block
                </label>
                <div className="grid grid-cols-4 gap-1.5">
                  {(['Morning', 'Afternoon', 'Evening', 'Night'] as TimeBlock[]).map(b => {
                    const icons: Record<TimeBlock, string> = { Morning: '☀️', Afternoon: '🌤️', Evening: '🌇', Night: '🌙' };
                    const isSelected = selectedProteinBlock === b;
                    return (
                      <button
                        key={b}
                        type="button"
                        onClick={() => setSelectedProteinBlock(b)}
                        className={`py-2 px-1 rounded-xl text-xs font-bold transition cursor-pointer border flex flex-col items-center gap-0.5 ${
                          isSelected
                            ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
                            : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        <span className="text-xs">{icons[b]}</span>
                        <span className="text-[10px]">{b}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Favorite Proteins Grid */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">
                  Favorite Proteins
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-56 overflow-y-auto pr-1">
                  {favoriteProteins.map(fav => (
                    <button
                      key={fav.id}
                      type="button"
                      onClick={() => handleQuickLogProtein(fav, selectedProteinBlock)}
                      className="p-2.5 rounded-2xl bg-white hover:bg-amber-50/50 border border-slate-200/80 hover:border-amber-300 transition text-left flex items-center justify-between gap-2 shadow-xs group cursor-pointer active:scale-98"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-base shrink-0">{fav.emoji || '⚡'}</span>
                        <span className="text-xs font-bold text-slate-800 truncate group-hover:text-amber-950">
                          {fav.name}
                        </span>
                      </div>
                      <span className="text-xs font-black font-mono text-amber-600 bg-amber-50 px-2 py-0.5 rounded-lg shrink-0 border border-amber-200/50">
                        +{fav.protein}g
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Quick Gram Pills */}
              <div className="space-y-1.5 pt-1 border-t border-slate-100">
                <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">
                  Quick Amount
                </label>
                <div className="flex items-center gap-1.5 flex-wrap">
                  {[20, 25, 30, 40, 50].map(grams => (
                    <button
                      key={grams}
                      type="button"
                      onClick={() => handleQuickLogProtein({ name: `Quick Protein (${grams}g)`, protein: grams }, selectedProteinBlock)}
                      className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-900 hover:text-white text-slate-700 text-xs font-mono font-bold transition cursor-pointer"
                    >
                      +{grams}g
                    </button>
                  ))}
                </div>
              </div>

              {/* Custom Entry */}
              <div className="pt-2 border-t border-slate-100 space-y-2">
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    placeholder="Custom name (e.g. Salmon)"
                    value={customProteinName}
                    onChange={e => setCustomProteinName(e.target.value)}
                    className="flex-1 px-3 py-1.5 text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-slate-800"
                  />
                  <input
                    type="number"
                    placeholder="Grams (e.g. 35)"
                    value={customProteinAmount}
                    onChange={e => setCustomProteinAmount(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter' && customProteinAmount) {
                        handleQuickLogProtein({
                          name: customProteinName.trim() || 'Custom Protein',
                          protein: Number(customProteinAmount) || 0,
                        }, selectedProteinBlock);
                      }
                    }}
                    className="w-24 px-3 py-1.5 text-xs border border-slate-200 rounded-xl font-mono text-center focus:outline-none focus:ring-1 focus:ring-slate-800"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      if (!customProteinAmount) return;
                      handleQuickLogProtein({
                        name: customProteinName.trim() || 'Custom Protein',
                        protein: Number(customProteinAmount) || 0,
                      }, selectedProteinBlock);
                    }}
                    className="px-3.5 py-1.5 bg-slate-900 text-white rounded-xl text-xs font-bold hover:bg-slate-800 transition cursor-pointer"
                  >
                    Log
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
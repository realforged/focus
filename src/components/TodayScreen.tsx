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
  GripVertical,
  X,
  BookOpen,
  Target,
} from 'lucide-react';
import { formatDateString, dateToday } from '../data';
import { getDailyPriority, saveDailyPriority, getTomorrowDateStr } from '../lib/journal';
import type { TimeBlock } from '../lib/nutritionBlocks';

// Shared Scheduler tasks storage key to stay 100% unified with DailyScheduler
const SCHEDULER_STORAGE_KEY = 'focus_now_daily_scheduler_tasks_v10';

interface TodayTask {
  id: string;
  date: string;
  timeBlock: TimeBlock;
  title: string;
  completed: boolean;
  scheduledTime?: string;
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

  // ── ONE THING (Today's #1 Priority) ──────────────────────────────────────
  const [oneThing, setOneThing] = useState<string>(() => getDailyPriority(initialDateToday));
  const [isEditingOneThing, setIsEditingOneThing] = useState(false);
  const [oneThingDraft, setOneThingDraft] = useState('');

  useEffect(() => {
    const val = getDailyPriority(selectedDate);
    setOneThing(val);
  }, [selectedDate]);

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

  // ── Unified Scheduler Tasks ──────────────────────────────────────────────
  const [allTasks, setAllTasks] = useState<TodayTask[]>(() => {
    try {
      const saved = localStorage.getItem(SCHEDULER_STORAGE_KEY);
      if (saved) return JSON.parse(saved);
    } catch {}
    return [];
  });

  // Reload tasks from storage on storage event or custom event
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

  // ── Task Actions ─────────────────────────────────────────────────────────
  const [isAddingTask, setIsAddingTask] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskTime, setNewTaskTime] = useState('');

  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [editTaskTitle, setEditTaskTitle] = useState('');
  const [editTaskTime, setEditTaskTime] = useState('');

  const handleToggleTask = (taskId: string) => {
    const updated = allTasks.map(t => (t.id === taskId ? { ...t, completed: !t.completed } : t));
    saveTasksToStorage(updated);
  };

  const handleAddTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskTitle.trim()) return;

    // Determine default timeBlock based on time or current hour
    let timeBlock: TimeBlock = 'Morning';
    const hour = new Date().getHours();
    if (hour >= 12 && hour < 17) timeBlock = 'Afternoon';
    else if (hour >= 17 && hour < 21) timeBlock = 'Evening';
    else if (hour >= 21) timeBlock = 'Night';

    const newTask: TodayTask = {
      id: 'task_' + Math.random().toString(36).substring(2, 9),
      date: selectedDate,
      timeBlock,
      title: newTaskTitle.trim(),
      scheduledTime: newTaskTime.trim() || undefined,
      completed: false,
      createdAt: new Date().toISOString(),
    };

    saveTasksToStorage([...allTasks, newTask]);
    setNewTaskTitle('');
    setNewTaskTime('');
    setIsAddingTask(false);
  };

  const handleSaveEditTask = (taskId: string) => {
    if (!editTaskTitle.trim()) return;
    const updated = allTasks.map(t =>
      t.id === taskId
        ? {
            ...t,
            title: editTaskTitle.trim(),
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
      
      {/* ── HEADER / GREETING ───────────────────────────────────────────── */}
      <div className="mb-10 space-y-1">
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

        <h1 className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight pt-1">
          {greeting}
        </h1>
        <p className="text-xs text-slate-400 font-medium">
          Focus on what matters today.
        </p>
      </div>

      {/* ── ONE THING (#1 PRIORITY) ─────────────────────────────────────── */}
      <div className="mb-10 space-y-2.5">
        <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">
          One Thing
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

      {/* ── TASKS ────────────────────────────────────────────────────────── */}
      <div className="mb-10 space-y-3">
        <div className="flex items-center justify-between">
          <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">
            Tasks
          </div>
          {totalTasksCount > 0 && (
            <span className="text-[11px] font-bold text-slate-400 font-mono">
              {completedTasksCount} of {totalTasksCount} completed
            </span>
          )}
        </div>

        {/* Task List */}
        <div className="space-y-2">
          {todayTasks.length === 0 && !isAddingTask ? (
            <div className="p-6 text-center bg-white rounded-2xl border border-dashed border-slate-200">
              <p className="text-xs text-slate-400 font-medium">No tasks added for today yet.</p>
            </div>
          ) : (
            todayTasks.map(task => {
              const isEditing = editingTaskId === task.id;

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
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        placeholder="Time (e.g. 7:00 PM)"
                        value={editTaskTime}
                        onChange={e => setEditTaskTime(e.target.value)}
                        className="px-3 py-1.5 text-xs border border-slate-200 rounded-xl w-36"
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

              return (
                <div
                  key={task.id}
                  className="group px-4 py-3 bg-white rounded-2xl border border-slate-200/70 hover:border-slate-300 transition flex items-center justify-between gap-3"
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
            })
          )}
        </div>

        {/* Add Task Form or Button */}
        {isAddingTask ? (
          <form onSubmit={handleAddTask} className="p-4 bg-white rounded-2xl border border-slate-200 space-y-3">
            <input
              type="text"
              placeholder="Task name (e.g. Finish assignment)"
              value={newTaskTitle}
              onChange={e => setNewTaskTitle(e.target.value)}
              className="w-full px-3.5 py-2 text-xs font-bold border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500"
              autoFocus
            />
            <div className="flex items-center gap-2">
              <input
                type="text"
                placeholder="Time (optional, e.g. 7:00 PM)"
                value={newTaskTime}
                onChange={e => setNewTaskTime(e.target.value)}
                className="px-3 py-1.5 text-xs border border-slate-200 rounded-xl w-44"
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
                Add
              </button>
            </div>
          </form>
        ) : (
          <button
            onClick={() => setIsAddingTask(true)}
            className="w-full py-3 rounded-2xl border border-dashed border-slate-300 text-xs font-bold text-slate-500 hover:text-slate-900 hover:border-slate-400 transition flex items-center justify-center gap-1.5 cursor-pointer bg-white"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add task</span>
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

    </div>
  );
}
import React, { useState, useRef, useEffect } from 'react';
import {
  Flame,
  ChevronDown,
  ChevronUp,
  Check,
  ChevronRight,
  Dumbbell,
  Apple,
  Briefcase,
  Moon,
  Brain,
  Zap,
  Star,
  MoreVertical,
  Pencil,
  Trash2,
  Trophy,
  ChevronLeft,
  Lock,
  RotateCcw,
} from 'lucide-react';
import { Habit, Routine, Category, PillarGoal, LoggedFood, NutritionTargets } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import RoutineDetailsModal from './RoutineDetailsModal';
import { EditHabitModal, EditRoutineModal } from './Modals';
import { PILLAR_META, mapCategoryToPillar as mapToSharedPillar } from '../lib/pillars';
import DailyScheduler from './DailyScheduler';

// ─── HELPERS ────────────────────────────────────────────────────────────────

const getCategoryMeta = (category: string) => {
  const pillar = mapToSharedPillar(category || 'Mind');
  const meta = PILLAR_META[pillar];
  const lucideIcon =
    pillar === 'Fitness' ? Dumbbell :
    pillar === 'Nutrition' ? Apple :
    pillar === 'Career' ? Briefcase :
    pillar === 'Recovery' ? Moon : Brain;
  return {
    icon: pillar, lucideIcon,
    bg: `${meta.accent}12`, border: `${meta.accent}28`,
    text: meta.text, accentBg: meta.soft,
    accentColor: meta.accent, ring: meta.ring, label: pillar,
  };
};

/** Returns which block is active right now based on local clock */
const getCurrentBlock = (): string => {
  const h = new Date().getHours();
  if (h >= 6 && h < 12) return 'Morning';
  if (h >= 12 && h < 17) return 'Afternoon';
  if (h >= 17 && h < 21) return 'Evening';
  if (h >= 21) return 'Night';
  return 'Morning'; // before 6am → show morning so there's always something open
};

// SVG arc helper for completion rings
function DayRing({ pct, size = 40, stroke = 3, color, today }: { pct: number; size?: number; stroke?: number; color: string; today?: boolean }) {
  const r = (size - stroke * 2) / 2;
  const circ = 2 * Math.PI * r;
  const dash = circ * Math.min(pct / 100, 1);
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ transform: 'rotate(-90deg)' }} aria-hidden="true">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={today ? '#e2e8f0' : '#f1f5f9'} strokeWidth={stroke} />
      {pct > 0 && (
        <circle
          cx={size / 2} cy={size / 2} r={r} fill="none"
          stroke={pct >= 100 ? '#10b981' : pct >= 50 ? '#f59e0b' : color}
          strokeWidth={stroke}
          strokeDasharray={`${dash} ${circ}`}
          strokeLinecap="round"
        />
      )}
    </svg>
  );
}

// ─── SHARED ROW MENU (dedupes the dropdown that used to live in both rows) ──

interface MenuAction {
  label: string;
  icon: React.ElementType;
  onClick: () => void;
  danger?: boolean;
}

function RowMenu({ actions, ariaLabel }: { actions: MenuAction[]; ariaLabel: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const escHandler = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', handler);
    document.addEventListener('keydown', escHandler);
    return () => {
      document.removeEventListener('mousedown', handler);
      document.removeEventListener('keydown', escHandler);
    };
  }, [open]);

  if (actions.length === 0) return null;

  return (
    <div className="relative shrink-0" ref={ref}>
      <button
        type="button"
        aria-label={ariaLabel}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={e => { e.stopPropagation(); setOpen(p => !p); }}
        className="w-6 h-6 flex items-center justify-center text-slate-300 hover:text-slate-600 hover:bg-slate-100 rounded-full transition cursor-pointer"
      >
        <MoreVertical className="w-3.5 h-3.5" />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            role="menu"
            initial={{ opacity: 0, scale: 0.88, y: -4 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.88, y: -4 }}
            transition={{ duration: 0.15 }}
            className="absolute right-0 top-7 z-50 bg-white border border-slate-200 rounded-2xl shadow-xl shadow-slate-200/60 overflow-hidden min-w-[140px]"
          >
            {actions.map((a, i) => {
              const Icon = a.icon;
              return (
                <button
                  key={a.label}
                  type="button"
                  role="menuitem"
                  onClick={e => { e.stopPropagation(); setOpen(false); a.onClick(); }}
                  className={`w-full flex items-center gap-2 px-3.5 py-2.5 text-xs font-bold transition cursor-pointer ${i > 0 ? 'border-t border-slate-100' : ''} ${
                    a.danger ? 'text-slate-700 hover:bg-red-50 hover:text-red-500' : 'text-slate-700 hover:bg-blue-50 hover:text-blue-600'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />{a.label}
                </button>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── TOAST (replaces blocking alert()) ──────────────────────────────────────

function Toast({ message, type, onDismiss }: { key?: React.Key; message: string; type: 'success' | 'error'; onDismiss: () => void }) {
  useEffect(() => {
    const t = setTimeout(onDismiss, 3000);
    return () => clearTimeout(t);
  }, [onDismiss]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 16 }}
      role="status"
      className={`fixed bottom-24 md:bottom-8 left-1/2 -translate-x-1/2 z-[65] px-4 py-2.5 rounded-2xl shadow-xl text-xs font-bold text-white ${
        type === 'error' ? 'bg-red-500' : 'bg-[#0F172A]'
      }`}
    >
      {message}
    </motion.div>
  );
}

// ─── CELEBRATION MODAL (replaces alert() on "Lock In Day") ──────────────────

function CelebrationModal({ day, onClose }: { day: number; onClose: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 backdrop-blur-sm px-6"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={`Day ${day} locked in`}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.85, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.9, y: 10 }}
        transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
        onClick={e => e.stopPropagation()}
        className="bg-white rounded-3xl shadow-2xl shadow-emerald-300/30 border border-slate-100 w-full max-w-sm overflow-hidden text-center"
      >
        <div className="h-1.5 w-full bg-gradient-to-r from-[#12B886] to-emerald-400" />
        <div className="p-7">
          <div className="w-16 h-16 rounded-full bg-emerald-50 border border-emerald-100 flex items-center justify-center mx-auto mb-4">
            <Trophy className="w-8 h-8 text-[#12B886] fill-[#12B886]" />
          </div>
          <h3 className="text-lg font-black text-[#0F172A]">Day {day} Locked In! 🎉</h3>
          <p className="text-xs text-slate-500 mt-2 leading-relaxed">
            Nice work — that's real momentum. Come back tomorrow to keep the streak alive.
          </p>
          <button
            type="button"
            onClick={onClose}
            className="mt-6 w-full py-2.5 rounded-2xl bg-[#12B886] hover:bg-emerald-500 text-white text-xs font-extrabold transition cursor-pointer shadow-md shadow-emerald-500/20"
          >
            Keep Going
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ─── HABIT ROW ───────────────────────────────────────────────────────────────

interface HabitRowProps {
  key?: React.Key;
  habit: Habit;
  selectedDate: string;
  onLogHabit: (id: string, value: number) => Promise<void>;
  isFocused?: boolean;
  onToggleFocus?: (id: string) => void;
  onEdit?: (habit: Habit) => void;
  onDelete?: (id: string) => void;
  onError?: (message: string) => void;
}

function HabitRow({ habit, selectedDate, onLogHabit, isFocused, onToggleFocus, onEdit, onDelete, onError }: HabitRowProps) {
  const [pending, setPending] = useState(false);

  const val = habit.history[selectedDate] || 0;
  const isDone = val >= habit.target;
  const pct = habit.target > 0 ? Math.min(100, Math.round((val / habit.target) * 100)) : 0;
  const hMeta = getCategoryMeta(habit.category);
  const IconComponent = hMeta.lucideIcon;

  const handleTap = async () => {
    if (pending) return; // guard against double-fire from rapid taps / keyboard + click
    setPending(true);
    try {
      await onLogHabit(habit.id, isDone ? -habit.target : habit.target - val);
    } catch (e) {
      console.error('Failed to log habit:', e);
      onError?.(`Couldn't update "${habit.name}". Try again.`);
    } finally {
      setPending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleTap();
    }
  };

  return (
    <div
      onClick={handleTap}
      onKeyDown={handleKeyDown}
      role="button"
      tabIndex={0}
      aria-pressed={isDone}
      aria-label={`${habit.name}, ${val} of ${habit.target} ${habit.unit || 'reps'}${isDone ? ', completed' : ''}`}
      className={`group bg-white rounded-2xl p-2.5 border border-slate-200/60 hover:border-slate-300 transition-all duration-200 flex items-center gap-2.5 relative select-none cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[#12B886] focus-visible:ring-offset-1 ${
        pending ? 'opacity-70 pointer-events-none' : ''
      }`}
    >
      {/* Left accent bar */}
      <div className="absolute left-0 top-0 bottom-0 w-1 rounded-l-2xl transition-all duration-300" style={{ backgroundColor: isDone ? '#10b981' : hMeta.accentColor }} />

      {/* Icon */}
      <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0 border ml-1.5 transition-all duration-300"
        style={{ backgroundColor: isDone ? '#10b98110' : hMeta.bg, borderColor: isDone ? '#10b98125' : hMeta.border, color: isDone ? '#10b981' : hMeta.accentColor }}>
        <IconComponent className="w-4 h-4" />
      </div>

      {/* Content */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <h4 className={`text-xs font-bold truncate leading-tight ${isDone ? 'line-through text-gray-400' : 'text-[#0F172A]'}`}>{habit.name}</h4>
          {onToggleFocus && (
            <button type="button" aria-label={isFocused ? `Remove ${habit.name} from focus` : `Add ${habit.name} to focus`}
              onClick={e => { e.stopPropagation(); onToggleFocus(habit.id); }}
              className={`p-0.5 rounded-full transition-transform active:scale-90 shrink-0 ${isFocused ? 'text-amber-500' : 'text-slate-300 hover:text-amber-400'}`}>
              <Star className={`w-3 h-3 ${isFocused ? 'fill-amber-400' : ''}`} />
            </button>
          )}
        </div>
        <div className="flex items-center gap-2 mt-1">
          <div className="flex-1 bg-slate-100 h-1 rounded-full overflow-hidden">
            <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, backgroundColor: isDone ? '#10b981' : hMeta.accentColor }} />
          </div>
          <span className="text-[10px] font-black font-mono shrink-0" style={{ color: isDone ? '#10b981' : hMeta.accentColor }}>{val}/{habit.target} {habit.unit || 'reps'}</span>
        </div>
      </div>

      {/* Check button */}
      <button
        type="button"
        aria-label={isDone ? `Mark ${habit.name} as not done` : `Mark ${habit.name} as done`}
        onClick={e => { e.stopPropagation(); handleTap(); }}
        className={`w-7 h-7 rounded-full flex items-center justify-center border-2 transition-all duration-200 shrink-0 cursor-pointer ${isDone ? 'bg-emerald-500 border-emerald-500 text-white' : 'border-slate-200 hover:border-emerald-400 bg-white'}`}
      >
        {pending
          ? <span className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin opacity-60" />
          : isDone ? <Check className="w-3.5 h-3.5 stroke-[3px]" /> : null}
      </button>

      {/* 3-dot menu */}
      <RowMenu
        ariaLabel={`More options for ${habit.name}`}
        actions={[
          ...(onEdit ? [{ label: 'Edit Habit', icon: Pencil, onClick: () => onEdit(habit) }] : []),
          ...(onDelete ? [{ label: 'Delete', icon: Trash2, onClick: () => onDelete(habit.id), danger: true }] : []),
        ]}
      />
    </div>
  );
}

// ─── ROUTINE ROW ─────────────────────────────────────────────────────────────

interface RoutineRowProps {
  key?: React.Key;
  routine: Routine;
  habits: Habit[];
  selectedDate: string;
  badgeLabel: string;
  onOpen: () => void;
  onEdit?: (routine: Routine) => void;
  onDelete?: (id: string) => void;
}

function RoutineRow({ routine, habits, selectedDate, badgeLabel, onOpen, onEdit, onDelete }: RoutineRowProps) {
  const routineHabits = habits.filter(h => routine.habitIds.includes(h.id));
  const done = routineHabits.filter(h => (h.history[selectedDate] || 0) >= h.target).length;
  const total = routineHabits.length;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  const isAllDone = total > 0 && done === total;
  const rMeta = routineHabits[0] ? getCategoryMeta(routineHabits[0].category) : getCategoryMeta('Fitness');
  const IconComp = rMeta.lucideIcon;

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onOpen();
    }
  };

  return (
    <div
      onClick={onOpen}
      onKeyDown={handleKeyDown}
      role="button"
      tabIndex={0}
      aria-label={`${routine.name} routine, ${done} of ${total} habits complete`}
      className={`group bg-white rounded-2xl p-2.5 border transition-all duration-200 flex items-center gap-2.5 cursor-pointer border-l-4 relative focus:outline-none focus-visible:ring-2 focus-visible:ring-[#12B886] focus-visible:ring-offset-1 ${isAllDone ? 'border-emerald-200 bg-emerald-50/20' : 'border-slate-100 hover:border-slate-200'}`}
      style={{ borderLeftColor: isAllDone ? '#10b981' : rMeta.accentColor }}>

      <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0 border transition-all duration-300"
        style={{ backgroundColor: isAllDone ? '#10b98110' : `${rMeta.accentColor}12`, borderColor: isAllDone ? '#10b98125' : `${rMeta.accentColor}28`, color: isAllDone ? '#10b981' : rMeta.accentColor }}>
        <IconComp className="w-4 h-4" />
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <h4 className={`text-xs font-bold truncate leading-tight ${isAllDone ? 'line-through text-gray-400' : 'text-[#0F172A]'}`}>{routine.name}</h4>
          <span className="text-[9px] font-extrabold tracking-widest bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded uppercase shrink-0" title={badgeLabel}>Routine</span>
        </div>
        <div className="flex items-center gap-2 mt-1">
          <div className="flex-1 bg-slate-100 h-1 rounded-full overflow-hidden">
            <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, backgroundColor: isAllDone ? '#10b981' : rMeta.accentColor }} />
          </div>
          <span className="text-[10px] font-black font-mono shrink-0" style={{ color: isAllDone ? '#10b981' : rMeta.accentColor }}>{done}/{total}</span>
        </div>
      </div>

      <div className="flex items-center gap-1.5 shrink-0">
        <div className="bg-amber-50 border border-amber-200/80 text-amber-700 px-1.5 py-0.5 rounded-lg text-[9px] font-black flex items-center gap-1">
          <Zap className="w-2.5 h-2.5 fill-amber-500 stroke-none" />
          <span>+{routine.points}</span>
        </div>
        <ChevronRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-slate-600 transition-all" />
        <RowMenu
          ariaLabel={`More options for ${routine.name}`}
          actions={[
            ...(onEdit ? [{ label: 'Edit Routine', icon: Pencil, onClick: () => onEdit(routine) }] : []),
            ...(onDelete ? [{ label: 'Delete', icon: Trash2, onClick: () => onDelete(routine.id), danger: true }] : []),
          ]}
        />
      </div>
    </div>
  );
}

// ─── PROPS ───────────────────────────────────────────────────────────────────

interface TodayScreenProps {
  habits: Habit[];
  routines: Routine[];
  dateToday: string;
  onLogHabit: (id: string, value: number) => Promise<void>;
  onBatchLogHabits?: (updates: { id: string; value: number }[]) => Promise<void>;
  onCompleteRoutine?: (routineId: string) => Promise<void>;
  userPoints: number;
  currentUser: any;
  nutritionToday: { protein: number; carbs: number; fats: number; fiber: number; calories: number };
  nutritionTargets?: NutritionTargets;
  todaysFoodLog?: LoggedFood[];
  loggedFoods?: LoggedFood[];
  onUpdateNutritionTargets?: (targets: NutritionTargets) => void;
  onOpenLogFoodForBlock?: (block: 'Morning' | 'Afternoon' | 'Evening' | 'Night') => void;
  onRemoveFood?: (id: string) => void;
  onRefresh?: () => Promise<void>;
  pillarGoals?: PillarGoal[];
  focusedHabitIds?: string[];
  onToggleFocusHabit?: (id: string) => void;
  onDeleteHabit?: (id: string) => Promise<void>;
  onEditHabit?: (id: string, data: Partial<Habit>) => Promise<void>;
  onDeleteRoutine?: (id: string) => Promise<void>;
  onEditRoutine?: (id: string, data: { name: string; points: number; timeBlock: 'Morning' | 'Afternoon' | 'Evening' | 'Night' | 'Constant'; repeat: 'Daily' | 'Custom Days' | 'Today Only' }) => Promise<void>;
  /** Optional hook to persist "day locked in" server-side. If omitted, the lock-in is celebratory/local only. */
  onFinishDay?: () => Promise<void>;
}

// ─── MAIN COMPONENT ──────────────────────────────────────────────────────────

export default function TodayScreen({
  habits, routines, dateToday, onLogHabit, onBatchLogHabits, userPoints, currentUser,
  nutritionTargets, onUpdateNutritionTargets, todaysFoodLog = [], loggedFoods = [], onOpenLogFoodForBlock, onRemoveFood,
  onRefresh,
  focusedHabitIds = [], onToggleFocusHabit,
  onDeleteHabit, onEditHabit, onDeleteRoutine, onEditRoutine, onFinishDay,
}: TodayScreenProps) {

  const [selectedDate, setSelectedDate] = useState<string>(dateToday);
  const [modeTab, setModeTabState] = useState<'scheduler' | 'habits'>(() => {
    try {
      const saved = localStorage.getItem('focus_now_today_mode_tab');
      if (saved === 'scheduler' || saved === 'habits') return saved;
    } catch (e) {
      console.error(e);
    }
    return 'scheduler';
  });

  const setModeTab = (val: 'scheduler' | 'habits') => {
    setModeTabState(val);
    try {
      localStorage.setItem('focus_now_today_mode_tab', val);
    } catch (e) {
      console.error(e);
    }
  };

  // Auto-expand current time block; collapse others
  const currentBlock = getCurrentBlock();
  const [expandedBlocks, setExpandedBlocks] = useState<{ [key: string]: boolean }>({
    Morning: currentBlock === 'Morning',
    Afternoon: currentBlock === 'Afternoon',
    Evening: currentBlock === 'Evening',
    Night: currentBlock === 'Night',
    Anytime: false,
  });

  const [activeRoutineDetails, setActiveRoutineDetails] = useState<Routine | null>(null);
  const [editingHabit, setEditingHabit] = useState<Habit | null>(null);
  const [editingRoutine, setEditingRoutine] = useState<Routine | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{ type: 'habit' | 'routine'; id: string; name: string } | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [finishedLoading, setFinishedLoading] = useState(false);
  const [showCelebration, setShowCelebration] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const notifyError = (message: string) => setToast({ message, type: 'error' });

  const [weekOffset, setWeekOffset] = useState<number>(0);

  // ── Calendar dates (dynamic week navigation & future date locking) ────────
  const weekDates = (() => {
    const dates = [];
    const todayObj = new Date();
    todayObj.setHours(0, 0, 0, 0);

    // Compute base center date shifted by weekOffset * 7
    const base = new Date();
    base.setDate(base.getDate() + (weekOffset * 7));

    for (let i = -3; i <= 3; i++) {
      const d = new Date(base);
      d.setDate(base.getDate() + i);
      const dMidnight = new Date(d);
      dMidnight.setHours(0, 0, 0, 0);

      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      const dateStr = `${yyyy}-${mm}-${dd}`;

      const isToday = dateStr === dateToday;
      const isFuture = dMidnight.getTime() > todayObj.getTime();
      const isPast = dMidnight.getTime() < todayObj.getTime();

      dates.push({
        dateStr,
        dayName: d.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase(),
        dayNum: d.getDate(),
        isToday,
        isFuture,
        isPast,
      });
    }
    return dates;
  })();

  const currentMonthLabel = (() => {
    if (weekDates.length === 0) return '';
    const centerDate = new Date(weekDates[3].dateStr);
    return centerDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  })();

  // ── Per-day completion % for calendar rings ───────────────────────────────
  const getDayPct = (dateStr: string) => {
    if (habits.length === 0) return 0;
    const done = habits.filter(h => (h.history[dateStr] || 0) >= h.target).length;
    return Math.round((done / habits.length) * 100);
  };

  // ── Stats ─────────────────────────────────────────────────────────────────
  const routineHabitIds = new Set(routines.flatMap(r => r.habitIds));
  const standaloneHabits = habits.filter(h => !routineHabitIds.has(h.id));
  const totalTasks = habits.length;
  const completedTasks = habits.filter(h => (h.history[selectedDate] || 0) >= h.target).length;
  const tasksLeft = Math.max(0, totalTasks - completedTasks);
  const todayScore = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
  const dayStreak = currentUser?.consecutive_locked_in_streak ?? 0;

  const journeyStart = currentUser?.journey_start_date ? new Date(currentUser.journey_start_date) : null;
  let currentDay = 1;
  if (journeyStart) {
    // No Math.abs here: a journey start date in the future should clamp to
    // day 1, not count days backwards as if the challenge were already underway.
    const diffDays = Math.floor((new Date().getTime() - journeyStart.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    currentDay = Math.max(1, Math.min(90, diffDays));
  }
  const missionProgressPercent = Math.round((currentDay / 90) * 100);

  // ── Handlers ──────────────────────────────────────────────────────────────
  const toggleBlock = (block: string) => setExpandedBlocks(prev => ({ ...prev, [block]: !prev[block] }));

  const handleMarkRoutineDone = async (routine: Routine) => {
    try {
      const updates: { id: string; value: number }[] = [];
      for (const hId of routine.habitIds) {
        const habit = habits.find(h => h.id === hId);
        if (habit) {
          const cur = habit.history[selectedDate] || 0;
          if (cur < habit.target) updates.push({ id: habit.id, value: habit.target - cur });
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
    } catch (e) {
      console.error(e);
      notifyError('Could not complete the routine. Try again.');
    }
  };

  const handleEditHabitSave = async (habitId: string, data: Partial<Habit>) => {
    if (onEditHabit) {
      try {
        await onEditHabit(habitId, data);
      } catch (e) {
        notifyError('Could not save habit changes.');
        return;
      }
    }
    setEditingHabit(null);
  };

  const handleEditRoutineSave = async (routineId: string, data: any) => {
    if (onEditRoutine) {
      try {
        await onEditRoutine(routineId, data);
      } catch (e) {
        notifyError('Could not save routine changes.');
        return;
      }
    }
    setEditingRoutine(null);
  };

  const handleConfirmDelete = async () => {
    if (!deleteConfirm) return;
    setDeleteLoading(true);
    try {
      if (deleteConfirm.type === 'habit' && onDeleteHabit) await onDeleteHabit(deleteConfirm.id);
      else if (deleteConfirm.type === 'routine' && onDeleteRoutine) await onDeleteRoutine(deleteConfirm.id);
    } catch (e) {
      notifyError(`Could not delete ${deleteConfirm.type}. Try again.`);
    } finally {
      setDeleteLoading(false);
      setDeleteConfirm(null);
    }
  };

  const handleFinishDay = async () => {
    setFinishedLoading(true);
    try {
      if (onFinishDay) await onFinishDay();
      setShowCelebration(true);
    } catch (e) {
      console.error(e);
      notifyError("Couldn't lock in the day. Try again.");
    } finally {
      setFinishedLoading(false);
    }
  };

  // ── Block config ──────────────────────────────────────────────────────────
  const TIME_BLOCKS = [
    { id: 'Morning', emoji: '☀️', label: 'Morning', range: '6:00 – 11:00 AM', gradient: 'from-amber-50 to-orange-50', accent: '#f59e0b', border: 'border-amber-200/60' },
    { id: 'Afternoon', emoji: '🌤️', label: 'Afternoon', range: '11:00 AM – 5:00 PM', gradient: 'from-sky-50 to-cyan-50', accent: '#0ea5e9', border: 'border-sky-200/60' },
    { id: 'Evening', emoji: '🌇', label: 'Evening', range: '5:00 – 9:00 PM', gradient: 'from-orange-50 to-rose-50', accent: '#f97316', border: 'border-orange-200/60' },
    { id: 'Night', emoji: '🌙', label: 'Night', range: '9:00 – 11:00 PM', gradient: 'from-indigo-50 to-violet-50', accent: '#6366f1', border: 'border-indigo-200/60' },
    { id: 'Anytime', emoji: '🔄', label: 'Anytime', range: 'Flexible', gradient: 'from-slate-50 to-gray-50', accent: '#64748b', border: 'border-slate-200/60' },
  ];

  // Circular ring params
  const ringR = 44;
  const ringCirc = 2 * Math.PI * ringR;

  return (
    <div className="w-full bg-[#F4F6FA] text-[#1E293B] flex flex-col font-sans min-h-screen">

      {/* ── TOP HEADER ─────────────────────────────────────────────────── */}
      <div className="px-5 pt-6 pb-3 flex items-center justify-between select-none">
        <div>
          <h1 className="text-2xl font-black text-[#0F172A] tracking-tight leading-none">Today</h1>
          <p className="text-[11px] text-slate-400 font-semibold mt-1">Day {currentDay} of 90 · Daily Scheduler</p>
        </div>
      </div>

      <div className="px-4 py-3">
        <DailyScheduler
          loggedFoods={loggedFoods.length > 0 ? loggedFoods : todaysFoodLog}
          nutritionTargets={nutritionTargets}
          onUpdateNutritionTargets={onUpdateNutritionTargets}
          onOpenLogFoodForBlock={onOpenLogFoodForBlock}
          onRemoveFood={onRemoveFood}
          userPoints={userPoints}
          currentUser={currentUser}
        />
      </div>

      {/* Celebration on locking in the day */}
      <AnimatePresence>
        {showCelebration && (
          <CelebrationModal day={currentDay} onClose={() => setShowCelebration(false)} />
        )}
      </AnimatePresence>

      {/* Toast for errors / quick confirmations */}
      <AnimatePresence>
        {toast && <Toast key="toast" message={toast.message} type={toast.type} onDismiss={() => setToast(null)} />}
      </AnimatePresence>

      {/* Premium Delete Confirm Dialog */}
      <AnimatePresence>
        {deleteConfirm && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm px-6"
            onClick={() => !deleteLoading && setDeleteConfirm(null)}
            role="dialog"
            aria-modal="true"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.88, y: 16 }} animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.92, y: 8 }} transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
              onClick={e => e.stopPropagation()}
              className="bg-white rounded-3xl shadow-2xl shadow-slate-300/40 border border-slate-100 w-full max-w-sm overflow-hidden"
            >
              <div className="h-1.5 w-full bg-gradient-to-r from-red-500 to-rose-400" />
              <div className="p-6">
                <div className="w-12 h-12 rounded-2xl bg-red-50 border border-red-100 flex items-center justify-center mb-4 mx-auto">
                  <Trash2 className="w-6 h-6 text-red-500" />
                </div>
                <h3 className="text-base font-black text-[#0F172A] text-center">
                  Delete {deleteConfirm.type === 'habit' ? 'Habit' : 'Routine'}?
                </h3>
                <p className="text-xs text-slate-500 text-center mt-2 leading-relaxed">
                  <span className="font-bold text-slate-700">"{deleteConfirm.name}"</span> will be permanently removed
                  {deleteConfirm.type === 'habit' ? ' from your dashboard and all routines' : ' along with its completion history'}.
                </p>
                <div className="flex gap-3 mt-6">
                  <button type="button" onClick={() => setDeleteConfirm(null)} disabled={deleteLoading}
                    className="flex-1 py-2.5 rounded-2xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50 transition cursor-pointer disabled:opacity-50">
                    Cancel
                  </button>
                  <button type="button" onClick={handleConfirmDelete} disabled={deleteLoading}
                    className="flex-1 py-2.5 rounded-2xl bg-red-500 hover:bg-red-600 text-xs font-extrabold text-white transition cursor-pointer shadow-md shadow-red-500/20 disabled:opacity-60 flex items-center justify-center gap-1.5">
                    {deleteLoading
                      ? <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      : <><Trash2 className="w-3.5 h-3.5" />Delete</>
                    }
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
}
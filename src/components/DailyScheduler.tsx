import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
  Plus,
  Check,
  ChevronDown,
  ChevronUp,
  Copy,
  Calendar as CalendarIcon,
  Sun,
  Sunset,
  Moon,
  Sparkles,
  Trash2,
  Dumbbell,
  RotateCcw,
  CheckCircle2,
  FolderPlus,
  ListTree,
  Clock,
  X,
  Pencil,
  GripVertical,
  Bell,
  BellOff,
  Repeat2,
  Star,
  FileText,
  ClipboardList,
  MoreVertical,
  Target,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { formatDateString, dateToday } from '../data';
import type { NutritionTargets } from '../types';
import {
  getBlockProteinGoal,
  BLOCK_PROTEIN_KEYS,
  type TimeBlock,
  normalizeMealTypeToBlock,
} from '../lib/nutritionBlocks';
import ProteinBlockBar from './ProteinBlockBar';
import {
  type FavoriteProteinItem,
  getStoredFavoriteProteins,
  saveStoredFavoriteProteins,
} from '../lib/favoriteProteins';

// ─── Types ─────────────────────────────────────────────────────────────────

export interface SubTask {
  id: string;
  title: string;
  completed: boolean;
}

export type RecurrenceType = 'none' | 'daily' | 'weekdays' | 'weekly';

export interface SchedulerTask {
  id: string;
  date: string; // YYYY-MM-DD
  timeBlock: TimeBlock;
  title: string;
  completed: boolean;
  scheduledTime?: string; // e.g. "07:30 AM"
  type?: 'standard' | 'choice' | 'group';
  options?: string[];
  selectedOption?: string;
  subtasks?: SubTask[];
  createdAt: string;
  /** Recurrence settings — only on template tasks */
  recurrence?: {
    type: RecurrenceType;
    reminderTime?: string; // "HH:MM" 24-h for push notification
    notificationId?: string;
  };
  /** Dates ("YYYY-MM-DD") of materialized instances that were deleted by user */
  deletedDates?: string[];
  /** True if this is the source template for a recurring series */
  isRecurrenceTemplate?: boolean;
  /** Links a materialized instance back to its template */
  recurrenceTemplateId?: string;
}

export interface PlanningNote {
  id: string;
  text: string;
  completed: boolean;
  scheduledDate?: string;
  scheduledBlock?: TimeBlock;
  scheduledTaskId?: string;
  createdAt: string;
}

/** Reusable named group template — subtasks only, no completion state */
export interface TaskGroupTemplate {
  id: string;
  name: string;
  subtaskTitles: string[];
  defaultTimeBlock?: TimeBlock;
  defaultScheduledTime?: string;
  createdAt: string;
}

/** Reusable standard task template — single task with metadata */
export interface StandardTaskTemplate {
  id: string;
  name: string;
  defaultTimeBlock: TimeBlock;
  defaultScheduledTime?: string;
  createdAt: string;
}

// ─── Constants ─────────────────────────────────────────────────────────────

const STORAGE_KEY = 'focus_now_daily_scheduler_tasks_v10';
const TASK_GROUP_TEMPLATES_KEY = 'focus_now_task_group_templates_v1';
const STANDARD_TASK_TEMPLATES_KEY = 'focus_now_standard_task_templates_v1';
const LOCAL_NUTRITION_TARGETS_KEY = 'focus_now_scheduler_protein_targets_v1';
const APP_NUTRITION_TARGETS_KEY = '90day_nutrition_targets';
const APP_LOGGED_FOODS_KEY = '90day_logged_foods';
const FAVORITE_PROTEINS_KEY = 'focus_now_favorite_proteins_v1';
const NOTIF_BANNER_KEY   = 'focus_now_notif_banner_dismissed';
const DAILY_NOTES_KEY    = 'focus_now_daily_notes_v2';

const DAY_BRIEFING_HOUR  = 6; // 6:00 AM every day
const DAY_BRIEFING_MIN   = 0;

const DEFAULT_NUTRITION_TARGETS: NutritionTargets = {
  protein: 150,
  carbs: 200,
  fats: 70,
  fiber: 25,
  calories: 2000,
};

export const DEFAULT_SPORTS_OPTIONS = [
  'Gym', 'Badminton', 'Tennis', 'Football', 'Basketball',
  'Swimming', 'Running', 'Yoga', 'Cycling', 'Cricket',
];

export const SPORTS_ICONS_MAP: Record<string, string> = {
  'Gym': '🏋️', 'Badminton': '🏸', 'Tennis': '🎾', 'Football': '⚽',
  'Basketball': '🏀', 'Swimming': '🏊', 'Running': '🏃', 'Yoga': '🧘',
  'Cycling': '🚴', 'Cricket': '🏏', 'Boxing': '🥊', 'Padel': '🎾',
  'Table Tennis': '🏓', 'Workout': '💪',
};

const BLOCK_TIME_PRESETS: Record<TimeBlock, string[]> = {
  Morning:   ['06:30 AM', '07:30 AM', '08:30 AM', '10:00 AM'],
  Afternoon: ['12:30 PM', '02:00 PM', '03:30 PM', '04:30 PM'],
  Evening:   ['05:30 PM', '06:30 PM', '07:45 PM', '08:30 PM'],
  Night:     ['09:15 PM', '10:00 PM', '11:00 PM', '11:30 PM'],
};

const MOTIVATIONAL_MESSAGES = [
  'Champions do it anyway — this is your moment! 🔥',
  'Discipline beats motivation every single time. Let\'s go! 💪',
  'Your future self is watching. Make them proud! 🏆',
  'One task at a time. You\'ve got this! ⚡',
  'Success is just consistent action. Start now! 🚀',
  'You chose this goal. Honor that choice! 🎯',
  'Hard days build strong habits. Push through! 💎',
  'The best time to start was yesterday. Second best? NOW! ⏰',
  'Every rep, every task — it compounds. Trust the process! 📈',
  'Locked in. Dialed in. Let\'s execute! 🔒',
  'Pain is temporary. Regret is forever. Move! 🦾',
  'Not motivated? Good. Discipline doesn\'t need motivation. 🧱',
  'The goal doesn\'t care how you feel today. Show up anyway! 🎯',
  'Identity is built in the moments you least want to try. 💥',
  'Outwork yesterday. Every. Single. Day. 🌅',
];

// ── Time-block reminder schedule ─────────────────────────────────────────────
const TIME_BLOCK_NOTIFS: { hour: number; min: number; block: TimeBlock; emoji: string; title: string; body: string }[] = [
  {
    hour: 6, min: 0, block: 'Morning', emoji: '🌅',
    title: '🌅 Morning Block — Rise & Dominate',
    body: 'Your Morning window is LIVE. Hydrate, move, and conquer the first block. Champions start before the world wakes up.'
  },
  {
    hour: 12, min: 0, block: 'Afternoon', emoji: '🔥',
    title: '🔥 Afternoon Block — Peak Performance',
    body: 'Midday is your power hour. Your Afternoon tasks are waiting. No excuses — lock in and execute.'
  },
  {
    hour: 17, min: 0, block: 'Evening', emoji: '💪',
    title: '💪 Evening Block — Move Your Body',
    body: 'Time to train, recover, and decompress. Your Evening block is live. Finish strong.'
  },
  {
    hour: 21, min: 0, block: 'Night', emoji: '🌙',
    title: '🌙 Night Protocol — Wind Down & Reflect',
    body: 'Check your Night tasks. Plan tomorrow. The last hour of your day shapes who you become next.'
  },
];

// ── Daily motivational quote blasts (3× per day) ─────────────────────────────
const DAILY_MOTIVATIONAL_SCHEDULE: { hour: number; min: number; title: string; body: string }[] = [
  {
    hour: 7, min: 0,
    title: '⚡ Morning Fuel — Day starts NOW',
    body: MOTIVATIONAL_MESSAGES[Math.floor(Math.random() * MOTIVATIONAL_MESSAGES.length)],
  },
  {
    hour: 13, min: 0,
    title: '🔥 Midday Charge — Don\'t slow down',
    body: MOTIVATIONAL_MESSAGES[Math.floor(Math.random() * MOTIVATIONAL_MESSAGES.length)],
  },
  {
    hour: 20, min: 0,
    title: '💎 Evening Reflection — Finish the day right',
    body: MOTIVATIONAL_MESSAGES[Math.floor(Math.random() * MOTIVATIONAL_MESSAGES.length)],
  },
];

const RECURRENCE_OPTIONS: { type: RecurrenceType; label: string; short: string }[] = [
  { type: 'none',     label: 'None',     short: 'None' },
  { type: 'daily',    label: 'Daily',    short: '∞ Daily' },
  { type: 'weekdays', label: 'Weekdays', short: 'Mon–Fri' },
  { type: 'weekly',   label: 'Weekly',   short: 'Weekly' },
];

const DEFAULT_TASKS_SEED: SchedulerTask[] = [
  {
    id: 'seed-1', date: dateToday, timeBlock: 'Morning',
    title: 'Hydrate & Morning Stretch', scheduledTime: '06:30 AM',
    completed: false, type: 'standard', createdAt: new Date().toISOString(),
  },
  {
    id: 'seed-2', date: dateToday, timeBlock: 'Morning',
    title: 'Morning Rituals Group', scheduledTime: '07:30 AM',
    completed: false, type: 'group',
    subtasks: [
      { id: 'sub-1', title: '50 Pushups & Plank', completed: true },
      { id: 'sub-2', title: 'Cold Shower', completed: false },
      { id: 'sub-3', title: '10 min Meditation', completed: false },
    ],
    createdAt: new Date().toISOString(),
  },
  {
    id: 'seed-3', date: dateToday, timeBlock: 'Afternoon',
    title: 'Play Sports Choice', scheduledTime: '04:00 PM',
    completed: false, type: 'choice',
    options: ['Gym', 'Badminton', 'Basketball', 'Tennis', 'Running', 'Swimming'],
    selectedOption: 'Badminton',
    createdAt: new Date().toISOString(),
  },
  {
    id: 'seed-4', date: dateToday, timeBlock: 'Evening',
    title: 'Review today\'s goal block', scheduledTime: '06:30 PM',
    completed: false, type: 'standard', createdAt: new Date().toISOString(),
  },
  {
    id: 'seed-5', date: dateToday, timeBlock: 'Night',
    title: 'Wind down & read 15 pages', scheduledTime: '10:00 PM',
    completed: false, type: 'standard', createdAt: new Date().toISOString(),
  },
];

const TIME_BLOCK_META: Record<TimeBlock, { label: string; timeRange: string; icon: React.ElementType; desc: string }> = {
  Morning:   { label: 'Morning',   timeRange: '06:00 AM – 12:00 PM', icon: Sun,      desc: 'Set the tone for the day' },
  Afternoon: { label: 'Afternoon', timeRange: '12:00 PM – 05:00 PM', icon: Sparkles, desc: 'Peak execution & output' },
  Evening:   { label: 'Evening',   timeRange: '05:00 PM – 09:00 PM', icon: Sunset,   desc: 'Movement & recovery' },
  Night:     { label: 'Night',     timeRange: '09:00 PM – 12:00 AM', icon: Moon,     desc: 'Wind down & reflect' },
};

const BLOCK_PROTEIN_TARGET_KEYS: Record<TimeBlock, 'morningProtein' | 'afternoonProtein' | 'eveningProtein' | 'nightProtein'> = {
  Morning:   'morningProtein',
  Afternoon: 'afternoonProtein',
  Evening:   'eveningProtein',
  Night:     'nightProtein',
};

// ─── Helpers ───────────────────────────────────────────────────────────────

const generateDateStrip = (centerDateStr: string) => {
  const dates: { dateStr: string; dayName: string; dayNumber: number; isToday: boolean; isSelected: boolean }[] = [];
  const baseDate = new Date(centerDateStr + 'T00:00:00');
  for (let i = -3; i <= 7; i++) {
    const d = new Date(baseDate);
    d.setDate(baseDate.getDate() + i);
    const dateStr = formatDateString(d);
    dates.push({
      dateStr,
      dayName:   d.toLocaleDateString('en-US', { weekday: 'short' }),
      dayNumber: d.getDate(),
      isToday:    dateStr === dateToday,
      isSelected: dateStr === centerDateStr,
    });
  }
  return dates;
};

const getCurrentTimeBlock = (): TimeBlock => {
  const h = new Date().getHours();
  if (h >= 6  && h < 12) return 'Morning';
  if (h >= 12 && h < 17) return 'Afternoon';
  if (h >= 17 && h < 21) return 'Evening';
  return 'Night';
};

const getNextTimeBlock = (block: TimeBlock): TimeBlock => {
  const order: TimeBlock[] = ['Morning', 'Afternoon', 'Evening', 'Night'];
  return order[(order.indexOf(block) + 1) % order.length];
};

const readStoredNutritionTargets = (): NutritionTargets => {
  try {
    const raw = localStorage.getItem(LOCAL_NUTRITION_TARGETS_KEY) || localStorage.getItem(APP_NUTRITION_TARGETS_KEY);
    return raw ? { ...DEFAULT_NUTRITION_TARGETS, ...JSON.parse(raw) } : DEFAULT_NUTRITION_TARGETS;
  } catch {
    return DEFAULT_NUTRITION_TARGETS;
  }
};

const readStoredLoggedFoods = () => {
  try {
    const raw = localStorage.getItem(APP_LOGGED_FOODS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
};

const mergeTargets = (base: NutritionTargets, incoming?: NutritionTargets): NutritionTargets => {
  if (!incoming) return base;
  return {
    ...base, ...incoming,
    morningProtein:   incoming.morningProtein   ?? base.morningProtein,
    afternoonProtein: incoming.afternoonProtein ?? base.afternoonProtein,
    eveningProtein:   incoming.eveningProtein   ?? base.eveningProtein,
    nightProtein:     incoming.nightProtein     ?? base.nightProtein,
  };
};

/** Pure fn – returns new task instances that should be created for `forDate` */
const materializeRecurringTasks = (tasks: SchedulerTask[], forDate: string): SchedulerTask[] => {
  const templates = tasks.filter(t => t.isRecurrenceTemplate);
  if (templates.length === 0) return [];

  const newInstances: SchedulerTask[] = [];
  const dateObj = new Date(forDate + 'T00:00:00');
  const dow = dateObj.getDay(); // 0 = Sun

  for (const tpl of templates) {
    if (!tpl.recurrence || tpl.recurrence.type === 'none') continue;
    if (forDate < tpl.date) continue;
    if (tpl.deletedDates?.includes(forDate)) continue;

    const tplDateObj = new Date(tpl.date + 'T00:00:00');
    let shouldCreate = false;
    switch (tpl.recurrence.type) {
      case 'daily':    shouldCreate = true; break;
      case 'weekdays': shouldCreate = dow >= 1 && dow <= 5; break;
      case 'weekly':   shouldCreate = dateObj.getDay() === tplDateObj.getDay(); break;
    }
    if (!shouldCreate) continue;

    const exists = tasks.some(t => t.recurrenceTemplateId === tpl.id && t.date === forDate);
    if (exists) continue;

    newInstances.push({
      ...tpl,
      id: 'task_' + Math.random().toString(36).substring(2, 9),
      date: forDate,
      completed: false,
      selectedOption: undefined,
      subtasks: tpl.subtasks?.map(s => ({ ...s, completed: false })),
      createdAt: new Date().toISOString(),
      isRecurrenceTemplate: false,
      recurrenceTemplateId: tpl.id,
    });
  }
  return newInstances;
};

// ─── Props ─────────────────────────────────────────────────────────────────

interface DailySchedulerProps {
  loggedFoods?: Array<{ id: string; name: string; protein: number; calories: number; mealType?: string; date?: string }>;
  nutritionTargets?: NutritionTargets;
  onUpdateNutritionTargets?: (targets: NutritionTargets) => void;
  onOpenLogFoodForBlock?: (block: 'Morning' | 'Afternoon' | 'Evening' | 'Night') => void;
  onRemoveFood?: (id: string) => void;
  userPoints?: number;
  currentUser?: any;
}

// ─── Component ─────────────────────────────────────────────────────────────

export default function DailyScheduler({
  loggedFoods = [],
  nutritionTargets,
  onUpdateNutritionTargets,
  onOpenLogFoodForBlock,
  onRemoveFood,
  userPoints,
  currentUser,
}: DailySchedulerProps = {}) {

  // ── Core state ────────────────────────────────────────────────────────────
  const [selectedDate, setSelectedDate] = useState<string>(dateToday);

  const [tasks, setTasks] = useState<SchedulerTask[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) return JSON.parse(saved);
    } catch {}
    return DEFAULT_TASKS_SEED;
  });

  const [expandedBlocks, setExpandedBlocks] = useState<Record<TimeBlock, boolean>>({
    Morning: true, Afternoon: true, Evening: true, Night: true,
  });
  const [currentTimeBlock, setCurrentTimeBlock] = useState<TimeBlock>(() => getCurrentTimeBlock());
  const [visibleBlock, setVisibleBlock] = useState<TimeBlock>(() => getCurrentTimeBlock());
  const [blockSortOrder, setBlockSortOrder] = useState<'liveFirst' | 'chronological'>('liveFirst');
  const [manualBlockNavigation, setManualBlockNavigation] = useState(false);

  const [expandedTaskIds, setExpandedTaskIds] = useState<Record<string, boolean>>({
    'seed-2': false, 'seed-3': false,
  });

  const [localNutritionTargets, setLocalNutritionTargets] = useState<NutritionTargets>(() =>
    mergeTargets(readStoredNutritionTargets(), nutritionTargets)
  );
  const [localLoggedFoods, setLocalLoggedFoods] = useState<DailySchedulerProps['loggedFoods']>(readStoredLoggedFoods);
  const [editingProteinGoal, setEditingProteinGoal] = useState<{ block: TimeBlock; value: string } | null>(null);
  const [editingTotalProteinGoal, setEditingTotalProteinGoal] = useState<string | null>(null);
  const [showProteinMenu, setShowProteinMenu] = useState(false);
  const [showTargetModal, setShowTargetModal] = useState(false);
  const [targetModalDraft, setTargetModalDraft] = useState({
    totalProtein: '150',
    morningProtein: '38',
    afternoonProtein: '53',
    eveningProtein: '45',
    nightProtein: '15',
  });
  const [showInlineProteinLog, setShowInlineProteinLog] = useState(false);
  const [inlineProteinEntry, setInlineProteinEntry] = useState({ name: '', protein: '', mealType: 'Morning' as 'Morning' | 'Afternoon' | 'Evening' | 'Night' });
  const [favoriteProteins, setFavoriteProteins] = useState<FavoriteProteinItem[]>(() => getStoredFavoriteProteins());
  const [showAddFavoriteProteinModal, setShowAddFavoriteProteinModal] = useState(false);
  const [customFavDraft, setCustomFavDraft] = useState({ name: '', protein: '25', emoji: '🥩' });
  const [sleepLogs, setSleepLogs] = useState<Record<string, { hours: number; quality: number; goal: number }>>(() => {
    try {
      const saved = localStorage.getItem('focus_now_scheduler_sleep_logs_v1');
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });
  const [isEditingSleep, setIsEditingSleep] = useState(false);
  const [editSleepHours, setEditSleepHours] = useState('7.5');
  const [editSleepQuality, setEditSleepQuality] = useState(4);
  const [editSleepGoal, setEditSleepGoal] = useState('8');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // ── Saved task group templates ────────────────────────────────────────────
  const [groupTemplates, setGroupTemplates] = useState<TaskGroupTemplate[]>(() => {
    try {
      const saved = localStorage.getItem(TASK_GROUP_TEMPLATES_KEY);
      if (saved) return JSON.parse(saved);
    } catch {}
    return [];
  });
  const [showGroupTemplatesModal, setShowGroupTemplatesModal] = useState(false);
  const [savedGroupPickerBlock, setSavedGroupPickerBlock] = useState<TimeBlock | null>(null);
  const [editingGroupTemplate, setEditingGroupTemplate] = useState<TaskGroupTemplate | null>(null);
  const [groupTemplateDraft, setGroupTemplateDraft] = useState<{
    name: string;
    subtaskTitles: string[];
    defaultTimeBlock: TimeBlock;
    defaultScheduledTime: string;
  }>({
    name: '',
    subtaskTitles: [''],
    defaultTimeBlock: 'Morning',
    defaultScheduledTime: '',
  });

  // ── Saved standard task templates ─────────────────────────────────────────
  const [standardTaskTemplates, setStandardTaskTemplates] = useState<StandardTaskTemplate[]>(() => {
    try {
      const saved = localStorage.getItem(STANDARD_TASK_TEMPLATES_KEY);
      if (saved) return JSON.parse(saved);
    } catch {}
    return [];
  });
  const [showStandardTaskTemplatesModal, setShowStandardTaskTemplatesModal] = useState(false);
  const [savedStandardTaskPickerBlock, setSavedStandardTaskPickerBlock] = useState<TimeBlock | null>(null);
  const [editingStandardTaskTemplate, setEditingStandardTaskTemplate] = useState<StandardTaskTemplate | null>(null);
  const [standardTaskTemplateDraft, setStandardTaskTemplateDraft] = useState<{
    name: string;
    defaultTimeBlock: TimeBlock;
    defaultScheduledTime: string;
  }>({
    name: '',
    defaultTimeBlock: 'Morning',
    defaultScheduledTime: '',
  });

  // ── Weekly Planning Notes State ───────────────────────────────────────────
  const [planningNotes, setPlanningNotes] = useState<PlanningNote[]>(() => {
    try {
      const saved = localStorage.getItem('focus_now_weekly_planning_notes_v1');
      if (saved) return JSON.parse(saved);
    } catch {}
    return [];
  });
  const [newNoteText, setNewNoteText] = useState('');
  const [schedulingNoteId, setSchedulingNoteId] = useState<string | null>(null);
  const [noteScheduleDate, setNoteScheduleDate] = useState<string>('');
  const [noteScheduleBlock, setNoteScheduleBlock] = useState<TimeBlock>('Morning');
  const [notesFilter, setNotesFilter] = useState<'all' | 'scheduled' | 'unscheduled'>('all');

  // ── Daily Notes State ─────────────────────────────────────────────────────
  // Single shared note — same text shown for every date
  const [dailyNote, setDailyNote] = useState<string>(() => {
    try {
      const saved = localStorage.getItem(DAILY_NOTES_KEY);
      if (saved) {
        // Migration: if old format was an object, pick any non-empty value
        const parsed = JSON.parse(saved);
        if (typeof parsed === 'string') return parsed;
        if (typeof parsed === 'object' && parsed !== null) {
          const values = Object.values(parsed as Record<string, string>);
          return values.find((v) => (v as string).trim().length > 0) as string ?? '';
        }
      }
    } catch {}
    return '';
  });
  // Draft text (before save)
  const [dailyNoteDraft, setDailyNoteDraft] = useState<string | null>(null);


  // ── Inline task creator ───────────────────────────────────────────────────
  const [inlineTaskInput, setInlineTaskInput] = useState<{
    block: TimeBlock | null;
    text: string;
    scheduledTime: string;
    taskType: 'standard' | 'choice' | 'group';
    initialSubtasks: string[];
    customChoices: string[];
    newChoiceInput: string;
    recurrenceType: RecurrenceType;
    reminderTime: string;
  }>({
    block: null, text: '', scheduledTime: '',
    taskType: 'standard', initialSubtasks: [''],
    customChoices: DEFAULT_SPORTS_OPTIONS, newChoiceInput: '',
    recurrenceType: 'none', reminderTime: '',
  });

  const [newSubtaskInput, setNewSubtaskInput] = useState<{ taskId: string | null; text: string }>({ taskId: null, text: '' });
  const [newChoiceTaskOptionInput, setNewChoiceTaskOptionInput] = useState<{ taskId: string | null; text: string }>({ taskId: null, text: '' });

  // ── Drag-and-drop state ───────────────────────────────────────────────────
  const [dragState, setDragState] = useState<{
    draggingId: string | null;
    dragOverId: string | null;
    dragOverBlock: TimeBlock | null;
  }>({ draggingId: null, dragOverId: null, dragOverBlock: null });

  // ── Notification state ────────────────────────────────────────────────────
  const [notifPermission, setNotifPermission] = useState<NotificationPermission>(() =>
    typeof Notification !== 'undefined' ? Notification.permission : 'denied'
  );
  const [notifBannerDismissed, setNotifBannerDismissed] = useState<boolean>(() =>
    localStorage.getItem(NOTIF_BANNER_KEY) === '1'
  );
  const notifTimersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const swRegRef       = useRef<ServiceWorkerRegistration | null>(null);
  const deferredPrompt = useRef<any>(null);
  const timeBlockViewportRef = useRef<HTMLDivElement | null>(null);
  const [pwaInstallable, setPwaInstallable] = useState(false);
  const [swReady, setSwReady]               = useState(false);

  // ── Effects ───────────────────────────────────────────────────────────────

  // Note: draft is NOT cleared on date change because the note is shared across all dates

  // Persist tasks
  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks)); } catch {}
  }, [tasks]);

  // Persist weekly planning notes
  useEffect(() => {
    try {
      localStorage.setItem('focus_now_weekly_planning_notes_v1', JSON.stringify(planningNotes));
    } catch {}
  }, [planningNotes]);

  // Persist saved group templates
  useEffect(() => {
    try {
      localStorage.setItem(TASK_GROUP_TEMPLATES_KEY, JSON.stringify(groupTemplates));
    } catch {}
  }, [groupTemplates]);

  // Persist saved standard task templates
  useEffect(() => {
    try {
      localStorage.setItem(STANDARD_TASK_TEMPLATES_KEY, JSON.stringify(standardTaskTemplates));
    } catch {}
  }, [standardTaskTemplates]);

  // Sync favorite proteins across components and tabs
  useEffect(() => {
    const handleSync = (e: any) => {
      if (e.detail) {
        setFavoriteProteins(e.detail);
      } else {
        setFavoriteProteins(getStoredFavoriteProteins());
      }
    };
    window.addEventListener('focus_now_favorites_updated', handleSync as EventListener);
    window.addEventListener('storage', handleSync);
    return () => {
      window.removeEventListener('focus_now_favorites_updated', handleSync as EventListener);
      window.removeEventListener('storage', handleSync);
    };
  }, []);

  // Sync planning notes completion & deletion with main tasks
  useEffect(() => {
    setPlanningNotes(prev => {
      let changed = false;
      const next = prev.map(note => {
        if (!note.scheduledTaskId) return note;
        const linkedTask = tasks.find(t => t.id === note.scheduledTaskId);
        if (linkedTask) {
          if (note.completed !== linkedTask.completed) {
            changed = true;
            return { ...note, completed: linkedTask.completed };
          }
        } else {
          // If the task was deleted in the main scheduler, remove link in note
          changed = true;
          return {
            ...note,
            scheduledTaskId: undefined,
            scheduledDate: undefined,
            scheduledBlock: undefined,
          };
        }
        return note;
      });
      return changed ? next : prev;
    });
  }, [tasks]);

  // Sync nutrition targets from parent
  useEffect(() => {
    if (nutritionTargets) setLocalNutritionTargets(prev => mergeTargets(prev, nutritionTargets));
  }, [nutritionTargets]);

  // Keep today's scheduler focused on the live block as the clock changes.
  useEffect(() => {
    const syncBlockToClock = () => {
      const nextCurrentBlock = getCurrentTimeBlock();
      setCurrentTimeBlock(nextCurrentBlock);
      if (selectedDate === dateToday && !manualBlockNavigation) {
        setVisibleBlock(nextCurrentBlock);
        setExpandedBlocks(prev => ({ ...prev, [nextCurrentBlock]: true }));
      }
    };

    syncBlockToClock();
    const intervalId = window.setInterval(syncBlockToClock, 60_000);
    return () => window.clearInterval(intervalId);
  }, [manualBlockNavigation, selectedDate]);

  useEffect(() => {
    const nextVisibleBlock = selectedDate === dateToday ? getCurrentTimeBlock() : 'Morning';
    setManualBlockNavigation(false);
    setVisibleBlock(nextVisibleBlock);
    setExpandedBlocks(prev => ({ ...prev, [nextVisibleBlock]: true }));
  }, [selectedDate]);

  // Refresh food logs on window focus / storage event
  useEffect(() => {
    const refresh = () => setLocalLoggedFoods(readStoredLoggedFoods());
    window.addEventListener('focus', refresh);
    window.addEventListener('storage', refresh);
    return () => { window.removeEventListener('focus', refresh); window.removeEventListener('storage', refresh); };
  }, []);

  // Register Service Worker for background notifications
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;

    navigator.serviceWorker.register('/sw.js')
      .then(reg => {
        swRegRef.current = reg;
        setSwReady(true);
      })
      .catch(err => console.warn('[FocusNow] SW registration failed:', err));

    // PWA install prompt
    const onPrompt = (e: Event) => {
      e.preventDefault();
      deferredPrompt.current = e;
      setPwaInstallable(true);
    };
    window.addEventListener('beforeinstallprompt', onPrompt);
    return () => window.removeEventListener('beforeinstallprompt', onPrompt);
  }, []);

  // Helper: post a message to the active SW
  const postToSW = useCallback((msg: object) => {
    const sw = swRegRef.current?.active;
    if (sw) sw.postMessage(msg);
  }, []);

  // Materialize recurring tasks whenever selectedDate changes (±7 day buffer)
  useEffect(() => {
    const datesToCheck: string[] = [];
    for (let i = -3; i <= 7; i++) {
      const d = new Date(selectedDate + 'T00:00:00');
      d.setDate(d.getDate() + i);
      datesToCheck.push(formatDateString(d));
    }
    setTasks(prev => {
      const fresh: SchedulerTask[] = [];
      for (const date of datesToCheck) {
        fresh.push(...materializeRecurringTasks(prev, date));
      }
      if (fresh.length === 0) return prev;
      return [...prev, ...fresh];
    });
  }, [selectedDate]);



  // Schedule task-specific reminders (prefer SW; fall back to setTimeout)
  useEffect(() => {
    // Clear old fallback timers
    notifTimersRef.current.forEach(t => clearTimeout(t));
    notifTimersRef.current.clear();

    if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return;

    const now = new Date();
    const taskBatch: object[] = [];

    tasks
      .filter(t => !t.isRecurrenceTemplate && t.date === dateToday && !t.completed && t.recurrence?.reminderTime)
      .forEach(task => {
        const [h, m] = (task.recurrence!.reminderTime!).split(':').map(Number);
        const fireAt = new Date();
        fireAt.setHours(h, m, 0, 0);
        const msUntil = fireAt.getTime() - now.getTime();
        if (msUntil <= 0) return;

        const msg = MOTIVATIONAL_MESSAGES[Math.floor(Math.random() * MOTIVATIONAL_MESSAGES.length)];

        if (swReady && swRegRef.current?.active) {
          // Route through Service Worker (survives tab close)
          taskBatch.push({
            id: `task-${task.id}`,
            title: `⏰ Time for: ${task.title}`,
            body: msg,
            msUntil,
            requireInteraction: true,
          });
        } else {
          // Fallback: in-page setTimeout
          const timer = setTimeout(() => {
            try {
              new Notification(`⏰ Time for: ${task.title}`, { body: msg, icon: '/favicon.ico' });
            } catch {}
          }, msUntil);
          notifTimersRef.current.set(task.id, timer);
        }
      });

    if (taskBatch.length > 0) postToSW({ type: 'SCHEDULE_BATCH', payload: taskBatch });

    return () => { notifTimersRef.current.forEach(t => clearTimeout(t)); };
  }, [tasks, notifPermission, swReady, postToSW]);

  // ── Derived values ────────────────────────────────────────────────────────
  const activeNutritionTargets = mergeTargets(localNutritionTargets, nutritionTargets);
  const schedulerLoggedFoods = useMemo(() => {
    const map = new Map<string, any>();
    (loggedFoods || []).forEach(f => map.set(f.id, f));
    (localLoggedFoods || []).forEach(f => map.set(f.id, f));
    return Array.from(map.values());
  }, [loggedFoods, localLoggedFoods]);

  const totalProteinConsumed = useMemo(() => {
    const targetFoods = schedulerLoggedFoods.filter(f => f.date === selectedDate || (!f.date && selectedDate === dateToday));
    return targetFoods.reduce((sum, f) => sum + (f.protein || 0), 0);
  }, [schedulerLoggedFoods, selectedDate]);

  const totalProteinGoal = useMemo(() => {
    const blocks: TimeBlock[] = ['Morning', 'Afternoon', 'Evening', 'Night'];
    return blocks.reduce((sum, b) => sum + getBlockProteinGoal(b, activeNutritionTargets), 0);
  }, [activeNutritionTargets]);

  const proteinCompletionPercentage = useMemo(() => {
    return totalProteinGoal > 0 ? Math.min(100, Math.round((totalProteinConsumed / totalProteinGoal) * 100)) : 0;
  }, [totalProteinConsumed, totalProteinGoal]);

  // Schedule daily time-block reminders + motivational quotes + Day Briefing via SW
  useEffect(() => {
    if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
    if (!swReady) return;

    const now = new Date();
    const batch: object[] = [];

    // ── Day Briefing (6 AM) — includes 90-day mission day ─────────────────
    (() => {
      const briefingFire = new Date();
      briefingFire.setHours(DAY_BRIEFING_HOUR, DAY_BRIEFING_MIN, 0, 0);
      const msUntil = briefingFire.getTime() - now.getTime();
      if (msUntil > 0) {
        // ── Calculate current 90-day mission day ──
        let missionDay = 1;
        const journeyStart = currentUser?.journey_start_date
          ? new Date(currentUser.journey_start_date)
          : null;
        if (journeyStart) {
          const diffDays = Math.floor((now.getTime() - journeyStart.getTime()) / (1000 * 60 * 60 * 24)) + 1;
          missionDay = Math.max(1, Math.min(90, diffDays));
        }
        const daysLeft = 90 - missionDay;

        // ── Phase-aware motivational opener ──
        const phaseMsg =
          missionDay <= 7   ? `First week warrior! Every habit you build now is compounding. Don't stop.` :
          missionDay <= 14  ? `Two weeks in — the identity shift is happening. Keep showing up!` :
          missionDay <= 30  ? `One month locked in. You're proving something to yourself every single day.` :
          missionDay <= 60  ? `Halfway warrior. Most people quit here. You're not most people.` :
          missionDay <= 80  ? `The final stretch. ${daysLeft} days left. This is where legends are made.` :
                              `FINAL 10 DAYS. You came this far — finish it. No surrender. 🏆`;

        // ── Task breakdown ──
        const todayTasks = tasks.filter(t => !t.isRecurrenceTemplate && t.date === dateToday);
        const total = todayTasks.length;
        const morningCount   = todayTasks.filter(t => t.timeBlock === 'Morning').length;
        const afternoonCount = todayTasks.filter(t => t.timeBlock === 'Afternoon').length;
        const eveningCount   = todayTasks.filter(t => t.timeBlock === 'Evening').length;
        const nightCount     = todayTasks.filter(t => t.timeBlock === 'Night').length;

        const blockLines: string[] = [];
        if (morningCount   > 0) blockLines.push(`🌅 Morning ×${morningCount}`);
        if (afternoonCount > 0) blockLines.push(`🔥 Afternoon ×${afternoonCount}`);
        if (eveningCount   > 0) blockLines.push(`💪 Evening ×${eveningCount}`);
        if (nightCount     > 0) blockLines.push(`🌙 Night ×${nightCount}`);

        const taskLine = total > 0
          ? `${blockLines.join('  ')} — ${total} tasks today.`
          : 'No tasks scheduled yet — plan your blocks for max output! 📅';

        // ── Daily Protein Goal brief ──
        const todayFoods = schedulerLoggedFoods.filter(f => f.date === dateToday || (!f.date));
        const totalP = todayFoods.reduce((sum, f) => sum + (f.protein || 0), 0);
        const totalPGoal = ['Morning', 'Afternoon', 'Evening', 'Night'].reduce(
          (sum, b) => sum + getBlockProteinGoal(b as TimeBlock, activeNutritionTargets),
          0
        );
        const proteinBrief = totalPGoal > 0
          ? `Daily Protein: ${totalP}g / ${totalPGoal}g.`
          : '';

        batch.push({
          id: 'day-briefing',
          title: `🏆 Day ${missionDay} of 90 — ${now.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}`,
          body: `${phaseMsg}\n\n${taskLine}${proteinBrief ? `\n\n🍗 ${proteinBrief}` : ''}`,
          msUntil,
          requireInteraction: true,
        });
      }
    })();

    // ── Time-block reminders ───────────────────────────────────────────────
    TIME_BLOCK_NOTIFS.forEach(n => {
      const fireAt = new Date();
      fireAt.setHours(n.hour, n.min, 0, 0);
      const msUntil = fireAt.getTime() - now.getTime();
      if (msUntil <= 0) return;

      // Calculate dynamic stats for this block
      const todayFoods = schedulerLoggedFoods.filter(f => f.date === dateToday || (!f.date));
      const blockP = todayFoods.reduce((s, f) => f.mealType === n.block ? s + (f.protein || 0) : s, 0);
      const blockGoal = getBlockProteinGoal(n.block, activeNutritionTargets);

      const blockTasks = tasks.filter(t => !t.isRecurrenceTemplate && t.date === dateToday && t.timeBlock === n.block);
      const pendingTasksCount = blockTasks.filter(t => !t.completed).length;

      const proteinStatus = blockGoal > 0
        ? `Protein: ${blockP}g/${blockGoal}g logged.`
        : '';
      const taskStatus = blockTasks.length > 0
        ? `${pendingTasksCount}/${blockTasks.length} tasks remaining.`
        : 'No tasks scheduled.';

      const dynamicBody = `${n.body}\n\n📊 Status: ${taskStatus}${proteinStatus ? `\n🍗 ${proteinStatus}` : ''}`;

      batch.push({
        id: `block-${n.block}`,
        title: n.title,
        body: dynamicBody,
        msUntil,
        requireInteraction: true,
      });
    });

    // ── Motivational quote blasts ───────────────────────────────────────────
    DAILY_MOTIVATIONAL_SCHEDULE.forEach((n, i) => {
      const fireAt = new Date();
      fireAt.setHours(n.hour, n.min, 0, 0);
      const msUntil = fireAt.getTime() - now.getTime();
      if (msUntil <= 0) return;
      batch.push({
        id: `motivational-${i}`,
        title: n.title,
        body: MOTIVATIONAL_MESSAGES[Math.floor(Math.random() * MOTIVATIONAL_MESSAGES.length)],
        msUntil,
      });
    });

    if (batch.length > 0) postToSW({ type: 'SCHEDULE_BATCH', payload: batch });
  }, [notifPermission, swReady, postToSW, tasks, schedulerLoggedFoods, activeNutritionTargets]);

  const currentSleepLog = sleepLogs[selectedDate];
  const sleepCompletionPercentage = useMemo(() => {
    if (!currentSleepLog) return 0;
    const goal = currentSleepLog.goal || 8;
    return goal > 0 ? Math.min(100, Math.round((currentSleepLog.hours / goal) * 100)) : 0;
  }, [currentSleepLog]);

  const tasksForSelectedDate = useMemo(
    () => tasks.filter(t => !t.isRecurrenceTemplate && t.date === selectedDate),
    [tasks, selectedDate]
  );

  const completionByDate = useMemo(() => {
    const result: Record<string, { done: number; total: number }> = {};
    tasks.filter(t => !t.isRecurrenceTemplate).forEach(t => {
      if (!result[t.date]) result[t.date] = { done: 0, total: 0 };
      result[t.date].total++;
      if (t.completed) result[t.date].done++;
    });
    return result;
  }, [tasks]);

  const datesStrip      = generateDateStrip(selectedDate);
  const timeBlocks: TimeBlock[] = ['Morning', 'Afternoon', 'Evening', 'Night'];
  const visibleTimeBlocks = useMemo(() => {
    if (selectedDate === dateToday && blockSortOrder === 'liveFirst') {
      const current = getCurrentTimeBlock();
      const currentIndex = timeBlocks.indexOf(current);
      return [
        ...timeBlocks.slice(currentIndex),
        ...timeBlocks.slice(0, currentIndex)
      ];
    }
    return timeBlocks;
  }, [selectedDate, currentTimeBlock, blockSortOrder]);

  const visibleBlockIndex = timeBlocks.indexOf(visibleBlock);
  const nextVisibleBlock = getNextTimeBlock(visibleBlock);

  const totalTasksCount     = tasksForSelectedDate.length;
  const completedTasksCount = tasksForSelectedDate.filter(t => t.completed).length;
  const completionPercentage = totalTasksCount > 0 ? Math.round((completedTasksCount / totalTasksCount) * 100) : 0;

  // ── Handlers ──────────────────────────────────────────────────────────────

  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  }, []);

  const toggleExpandBlock = (block: TimeBlock) =>
    setExpandedBlocks(prev => ({ ...prev, [block]: !prev[block] }));

  const toggleExpandTask = (taskId: string) =>
    setExpandedTaskIds(prev => ({ ...prev, [taskId]: !prev[taskId] }));

  const handleShowBlock = (block: TimeBlock, manual = true) => {
    setManualBlockNavigation(manual);
    setVisibleBlock(block);
    setExpandedBlocks(prev => ({ ...prev, [block]: true }));
    window.setTimeout(() => {
      const el = document.getElementById(`time-block-${block}`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      } else {
        timeBlockViewportRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 50);
  };

  const handleShowNextBlock = () => handleShowBlock(getNextTimeBlock(visibleBlock));

  const handleShowCurrentTimeBlock = () => {
    if (selectedDate !== dateToday) setSelectedDate(dateToday);
    handleShowBlock(getCurrentTimeBlock(), false);
  };

  const startEditingProteinGoal = (block: TimeBlock, currentGoal: number) =>
    setEditingProteinGoal({ block, value: String(currentGoal) });

  const handleSaveProteinGoal = () => {
    if (!editingProteinGoal) return;
    const parsed  = Number.parseFloat(editingProteinGoal.value);
    const nextGoal = Number.isFinite(parsed) ? Math.max(0, Math.round(parsed)) : 0;
    const targetKey = BLOCK_PROTEIN_TARGET_KEYS[editingProteinGoal.block];
    const nextTargets = { ...activeNutritionTargets, [targetKey]: nextGoal };
    setLocalNutritionTargets(nextTargets);
    try {
      localStorage.setItem(LOCAL_NUTRITION_TARGETS_KEY, JSON.stringify(nextTargets));
      localStorage.setItem(APP_NUTRITION_TARGETS_KEY,   JSON.stringify(nextTargets));
    } catch {}
    onUpdateNutritionTargets?.(nextTargets);
    showToast(`${editingProteinGoal.block} protein goal → ${nextGoal}g`);
    setEditingProteinGoal(null);
  };

  const handleSaveTotalProteinGoal = () => {
    if (editingTotalProteinGoal === null) return;
    const parsed = Number.parseFloat(editingTotalProteinGoal);
    const nextGoal = Number.isFinite(parsed) ? Math.max(0, Math.round(parsed)) : 150;
    const nextTargets = { ...activeNutritionTargets, protein: nextGoal };
    setLocalNutritionTargets(nextTargets);
    try {
      localStorage.setItem(LOCAL_NUTRITION_TARGETS_KEY, JSON.stringify(nextTargets));
      localStorage.setItem(APP_NUTRITION_TARGETS_KEY,   JSON.stringify(nextTargets));
    } catch {}
    onUpdateNutritionTargets?.(nextTargets);
    showToast(`Daily protein goal → ${nextGoal}g`);
    setEditingTotalProteinGoal(null);
  };

  const handleQuickLogFavoriteProtein = (item: FavoriteProteinItem) => {
    const mealType = inlineProteinEntry.mealType || (selectedDate === dateToday ? getCurrentTimeBlock() : 'Morning');
    const newEntry = {
      id: 'plog_' + Math.random().toString(36).substring(2, 9),
      name: item.name,
      protein: item.protein,
      calories: 0,
      mealType,
      date: selectedDate,
    };
    const updated = [...(localLoggedFoods || []), newEntry];
    setLocalLoggedFoods(updated);
    try {
      localStorage.setItem(APP_LOGGED_FOODS_KEY, JSON.stringify(updated));
    } catch {}
    showToast(`Quick logged ${item.name} (${item.protein}g) to ${mealType}!`);
  };

  const handleAddFavoriteProtein = (customItem?: { name: string; protein: number; emoji?: string }) => {
    const name = (customItem ? customItem.name : inlineProteinEntry.name).trim();
    const protein = customItem ? customItem.protein : Number.parseFloat(inlineProteinEntry.protein);
    if (!name || !Number.isFinite(protein) || protein <= 0) {
      showToast('Enter food name & protein grams to save as favorite');
      return;
    }
    const newItem: FavoriteProteinItem = {
      id: 'fav_' + Math.random().toString(36).substring(2, 9),
      name,
      protein: Math.round(protein * 10) / 10,
      emoji: customItem?.emoji || '⭐',
    };
    const updated = [newItem, ...favoriteProteins.filter(f => f.name.toLowerCase() !== name.toLowerCase())];
    setFavoriteProteins(updated);
    saveStoredFavoriteProteins(updated);
    showToast(`Saved "${name}" (${newItem.protein}g) to Favorites! ⭐`);
    setShowAddFavoriteProteinModal(false);
  };

  const handleRemoveFavoriteProtein = (id: string, name: string) => {
    const updated = favoriteProteins.filter(f => f.id !== id);
    setFavoriteProteins(updated);
    saveStoredFavoriteProteins(updated);
    showToast(`Removed "${name}" from favorites`);
  };

  const handleRemoveLoggedFood = (id: string, foodName: string) => {
    const updated = (localLoggedFoods || []).filter(f => f.id !== id);
    setLocalLoggedFoods(updated);
    try {
      localStorage.setItem(APP_LOGGED_FOODS_KEY, JSON.stringify(updated));
    } catch {}
    onRemoveFood?.(id);
    showToast(`Removed "${foodName}" from food log`);
  };

  const handleResetProtein = () => {
    if (window.confirm(`Reset protein intake to 0g for ${selectedDate === dateToday ? 'today' : selectedDate}?`)) {
      const updated = (localLoggedFoods || []).filter(f => f.date && f.date !== selectedDate);
      setLocalLoggedFoods(updated);
      try {
        localStorage.setItem(APP_LOGGED_FOODS_KEY, JSON.stringify(updated));
      } catch {}
      showToast('Protein intake reset to 0g');
      setShowProteinMenu(false);
    }
  };

  const handleResetTimeBlocksProgress = () => {
    if (window.confirm(`Reset all time block tasks to uncompleted (0%) for ${selectedDate === dateToday ? 'today' : selectedDate}?`)) {
      setTasks(prev => prev.map(t => {
        if (t.date === selectedDate) {
          return {
            ...t,
            completed: false,
            subtasks: t.subtasks?.map(s => ({ ...s, completed: false }))
          };
        }
        return t;
      }));
      showToast('All time block tasks reset to 0%');
      setShowProteinMenu(false);
    }
  };

  const autoSplitTargetModalDraft = (totalGrams: number) => {
    setTargetModalDraft({
      totalProtein: String(totalGrams),
      morningProtein: String(Math.round(totalGrams * 0.25)),
      afternoonProtein: String(Math.round(totalGrams * 0.35)),
      eveningProtein: String(Math.round(totalGrams * 0.3)),
      nightProtein: String(Math.round(totalGrams * 0.1)),
    });
  };

  const openTargetModal = () => {
    const mGoal = getBlockProteinGoal('Morning', activeNutritionTargets);
    const aGoal = getBlockProteinGoal('Afternoon', activeNutritionTargets);
    const eGoal = getBlockProteinGoal('Evening', activeNutritionTargets);
    const nGoal = getBlockProteinGoal('Night', activeNutritionTargets);
    setTargetModalDraft({
      totalProtein: String(totalProteinGoal || 150),
      morningProtein: String(mGoal),
      afternoonProtein: String(aGoal),
      eveningProtein: String(eGoal),
      nightProtein: String(nGoal),
    });
    setShowTargetModal(true);
    setShowProteinMenu(false);
  };

  const handleSaveTargetModal = () => {
    const total = Math.max(1, Math.round(Number.parseFloat(targetModalDraft.totalProtein) || 150));
    const m = Math.max(0, Math.round(Number.parseFloat(targetModalDraft.morningProtein) || 0));
    const a = Math.max(0, Math.round(Number.parseFloat(targetModalDraft.afternoonProtein) || 0));
    const e = Math.max(0, Math.round(Number.parseFloat(targetModalDraft.eveningProtein) || 0));
    const n = Math.max(0, Math.round(Number.parseFloat(targetModalDraft.nightProtein) || 0));

    const nextTargets: NutritionTargets = {
      ...activeNutritionTargets,
      protein: total,
      morningProtein: m,
      afternoonProtein: a,
      eveningProtein: e,
      nightProtein: n,
    };

    setLocalNutritionTargets(nextTargets);
    try {
      localStorage.setItem(LOCAL_NUTRITION_TARGETS_KEY, JSON.stringify(nextTargets));
      localStorage.setItem(APP_NUTRITION_TARGETS_KEY, JSON.stringify(nextTargets));
    } catch {}
    onUpdateNutritionTargets?.(nextTargets);
    showToast(`Protein target updated: ${total}g daily goal`);
    setShowTargetModal(false);
  };

  const handleSaveInlineProteinLog = () => {
    const protein = Number.parseFloat(inlineProteinEntry.protein);
    if (!Number.isFinite(protein) || protein <= 0) {
      showToast('Enter a valid protein amount');
      return;
    }
    const name = inlineProteinEntry.name.trim() || 'Quick Log';
    const newEntry = {
      id: 'plog_' + Math.random().toString(36).substring(2, 9),
      name,
      protein: Math.round(protein * 10) / 10,
      calories: 0,
      mealType: inlineProteinEntry.mealType,
      date: selectedDate,
    };
    const updated = [...(localLoggedFoods || []), newEntry];
    setLocalLoggedFoods(updated);
    try {
      localStorage.setItem(APP_LOGGED_FOODS_KEY, JSON.stringify(updated));
    } catch {}
    setInlineProteinEntry({ name: '', protein: '', mealType: getCurrentTimeBlock() as 'Morning' | 'Afternoon' | 'Evening' | 'Night' });
    setShowInlineProteinLog(false);
    showToast(`Logged ${protein}g protein to ${inlineProteinEntry.mealType}`);
  };

  const handleSaveSleepLog = () => {
    const hours = Number.parseFloat(editSleepHours);
    const goal = Number.parseFloat(editSleepGoal);
    const validatedHours = Number.isFinite(hours) ? Math.max(0, Math.min(24, hours)) : 7.5;
    const validatedGoal = Number.isFinite(goal) ? Math.max(1, Math.min(24, goal)) : 8;
    const validatedQuality = Math.max(1, Math.min(5, editSleepQuality));

    const nextLogs = {
      ...sleepLogs,
      [selectedDate]: {
        hours: validatedHours,
        quality: validatedQuality,
        goal: validatedGoal,
      },
    };
    setSleepLogs(nextLogs);
    try {
      localStorage.setItem('focus_now_scheduler_sleep_logs_v1', JSON.stringify(nextLogs));
    } catch {}
    showToast(`Sleep logged for ${selectedDate}: ${validatedHours}h (${'★'.repeat(validatedQuality)})`);
    setIsEditingSleep(false);
  };

  const handleDeleteSleepLog = () => {
    const nextLogs = { ...sleepLogs };
    delete nextLogs[selectedDate];
    setSleepLogs(nextLogs);
    try {
      localStorage.setItem('focus_now_scheduler_sleep_logs_v1', JSON.stringify(nextLogs));
    } catch {}
    showToast('Sleep log removed.');
    setIsEditingSleep(false);
  };

  const handleSaveDailyNote = () => {
    const text = (dailyNoteDraft ?? dailyNote).trim();
    setDailyNote(text);
    setDailyNoteDraft(null);
    try {
      localStorage.setItem(DAILY_NOTES_KEY, JSON.stringify(text));
    } catch {}
    showToast('Daily note saved ✓');
  };

  const handleClearDailyNote = () => {
    setDailyNote('');
    setDailyNoteDraft(null);
    try {
      localStorage.setItem(DAILY_NOTES_KEY, JSON.stringify(''));
    } catch {}
    showToast('Note cleared.');
  };

  const startEditingSleep = () => {
    if (currentSleepLog) {
      setEditSleepHours(String(currentSleepLog.hours));
      setEditSleepQuality(currentSleepLog.quality);
      setEditSleepGoal(String(currentSleepLog.goal || 8));
    } else {
      setEditSleepHours('7.5');
      setEditSleepQuality(4);
      setEditSleepGoal('8');
    }
    setIsEditingSleep(true);
  };

  // Toggle task completion
  const handleToggleTask = (taskId: string) => {
    setTasks(prev => prev.map(t => {
      if (t.id !== taskId) return t;
      const nextCompleted = !t.completed;
      return {
        ...t, completed: nextCompleted,
        subtasks: t.subtasks?.map(s => ({ ...s, completed: nextCompleted })),
      };
    }));
  };

  // Toggle subtask
  const handleToggleSubtask = (taskId: string, subtaskId: string) => {
    setTasks(prev => prev.map(t => {
      if (t.id !== taskId || !t.subtasks) return t;
      const updated = t.subtasks.map(st => st.id === subtaskId ? { ...st, completed: !st.completed } : st);
      return { ...t, subtasks: updated, completed: updated.length > 0 && updated.every(st => st.completed) };
    }));
  };

  // Add subtask to group
  const handleAddSubtaskToGroup = (taskId: string) => {
    const text = newSubtaskInput.text.trim();
    if (!text) return;
    setTasks(prev => prev.map(t => {
      if (t.id !== taskId) return t;
      const newSub: SubTask = { id: 'sub_' + Math.random().toString(36).substring(2, 9), title: text, completed: false };
      return { ...t, subtasks: [...(t.subtasks || []), newSub], completed: false };
    }));
    setNewSubtaskInput({ taskId: null, text: '' });
  };

  // Add option to choice task
  const handleAddOptionToChoiceTask = (taskId: string) => {
    const text = newChoiceTaskOptionInput.text.trim();
    if (!text) return;
    setTasks(prev => prev.map(t => {
      if (t.id !== taskId) return t;
      const existing = t.options || [];
      if (existing.includes(text)) return t;
      return { ...t, options: [...existing, text] };
    }));
    setNewChoiceTaskOptionInput({ taskId: null, text: '' });
  };

  // Delete subtask
  const handleDeleteSubtask = (taskId: string, subtaskId: string) => {
    setTasks(prev => prev.map(t => {
      if (t.id !== taskId || !t.subtasks) return t;
      const updated = t.subtasks.filter(s => s.id !== subtaskId);
      return { ...t, subtasks: updated, completed: updated.length > 0 && updated.every(st => st.completed) };
    }));
  };

  // Select sport / choice option
  const handleSelectOption = (taskId: string, option: string) => {
    setTasks(prev => prev.map(t => {
      if (t.id !== taskId) return t;
      const isSame = t.selectedOption === option;
      return { ...t, selectedOption: isSame ? undefined : option, completed: !isSame };
    }));
  };

  // Add new task
  const handleAddTask = (block: TimeBlock) => {
    const title = inlineTaskInput.text.trim() ||
      (inlineTaskInput.taskType === 'group' ? 'New Group' : inlineTaskInput.taskType === 'choice' ? 'Sports Choice' : 'New Task');

    const subtasksList = inlineTaskInput.taskType === 'group'
      ? inlineTaskInput.initialSubtasks
          .filter(st => st.trim().length > 0)
          .map(st => ({ id: 'sub_' + Math.random().toString(36).substring(2, 9), title: st.trim(), completed: false }))
      : undefined;

    const recurrence = inlineTaskInput.recurrenceType !== 'none' ? {
      type: inlineTaskInput.recurrenceType,
      reminderTime: inlineTaskInput.reminderTime || undefined,
    } : undefined;

    const isTemplate = inlineTaskInput.recurrenceType !== 'none';

    // Build the task (or template)
    const baseTask: SchedulerTask = {
      id: 'task_' + Math.random().toString(36).substring(2, 9),
      date: selectedDate,
      timeBlock: block,
      title,
      scheduledTime: inlineTaskInput.scheduledTime.trim() || undefined,
      completed: false,
      type: inlineTaskInput.taskType,
      options: inlineTaskInput.taskType === 'choice' ? [...inlineTaskInput.customChoices] : undefined,
      subtasks: subtasksList,
      createdAt: new Date().toISOString(),
      recurrence,
      isRecurrenceTemplate: isTemplate || undefined,
    };

    if (isTemplate) {
      // Add template + immediately materialize for today's viewing date
      setTasks(prev => {
        const withTemplate = [...prev, baseTask];
        const instances = materializeRecurringTasks(withTemplate, selectedDate);
        return [...withTemplate, ...instances];
      });
      showToast(`🔁 Recurring task added (${inlineTaskInput.recurrenceType})`);
    } else {
      setTasks(prev => [...prev, baseTask]);
      if (inlineTaskInput.taskType !== 'standard') setExpandedTaskIds(prev => ({ ...prev, [baseTask.id]: true }));
      showToast(`Added to ${block}`);
    }

    setInlineTaskInput({
      block: null, text: '', scheduledTime: '',
      taskType: 'standard', initialSubtasks: [''],
      customChoices: DEFAULT_SPORTS_OPTIONS, newChoiceInput: '',
      recurrenceType: 'none', reminderTime: '',
    });
  };

  // Delete task (or entire series if template-linked)
  const handleDeleteTask = (taskId: string, deleteSeries = false) => {
    setTasks(prev => {
      const task = prev.find(t => t.id === taskId);
      if (!task) return prev;

      if (deleteSeries || (task.isRecurrenceTemplate && deleteSeries)) {
        const templateId = task.isRecurrenceTemplate ? task.id : task.recurrenceTemplateId;
        return prev.filter(t => t.id !== templateId && t.recurrenceTemplateId !== templateId);
      }

      if (task.recurrenceTemplateId) {
        return prev
          .filter(t => t.id !== taskId)
          .map(t => {
            if (t.id === task.recurrenceTemplateId) {
              const currentDeleted = t.deletedDates || [];
              if (!currentDeleted.includes(task.date)) {
                return { ...t, deletedDates: [...currentDeleted, task.date] };
              }
            }
            return t;
          });
      }

      return prev.filter(t => t.id !== taskId);
    });
    showToast(deleteSeries ? '🗑 Series deleted' : 'Task removed');
  };

  // Move task within / across blocks with arrow buttons
  const TIME_BLOCK_LIST: TimeBlock[] = ['Morning', 'Afternoon', 'Evening', 'Night'];
  const handleMoveTask = (taskId: string, direction: 'up' | 'down') => {
    setTasks(prev => {
      const target = prev.find(t => t.id === taskId);
      if (!target) return prev;
      const sameBlock = prev.filter(t => t.date === target.date && t.timeBlock === target.timeBlock && !t.isRecurrenceTemplate);
      const idx = sameBlock.findIndex(t => t.id === taskId);

      if (direction === 'up') {
        if (idx > 0) {
          const swap = sameBlock[idx - 1];
          const arr = [...prev];
          const a = arr.findIndex(t => t.id === target.id);
          const b = arr.findIndex(t => t.id === swap.id);
          if (a !== -1 && b !== -1) { [arr[a], arr[b]] = [arr[b], arr[a]]; }
          return arr;
        } else {
          const ci = TIME_BLOCK_LIST.indexOf(target.timeBlock);
          if (ci <= 0) return prev;
          return prev.map(t => t.id === taskId ? { ...t, timeBlock: TIME_BLOCK_LIST[ci - 1] } : t);
        }
      } else {
        if (idx < sameBlock.length - 1) {
          const swap = sameBlock[idx + 1];
          const arr = [...prev];
          const a = arr.findIndex(t => t.id === target.id);
          const b = arr.findIndex(t => t.id === swap.id);
          if (a !== -1 && b !== -1) { [arr[a], arr[b]] = [arr[b], arr[a]]; }
          return arr;
        } else {
          const ci = TIME_BLOCK_LIST.indexOf(target.timeBlock);
          if (ci < 0 || ci >= TIME_BLOCK_LIST.length - 1) return prev;
          return prev.map(t => t.id === taskId ? { ...t, timeBlock: TIME_BLOCK_LIST[ci + 1] } : t);
        }
      }
    });
  };

  // Move subtask
  const handleMoveSubtask = (taskId: string, subtaskId: string, direction: 'up' | 'down') => {
    setTasks(prev => prev.map(t => {
      if (t.id !== taskId || !t.subtasks) return t;
      const subs = [...t.subtasks];
      const idx = subs.findIndex(s => s.id === subtaskId);
      if (idx === -1) return t;
      if (direction === 'up' && idx <= 0) return t;
      if (direction === 'down' && idx >= subs.length - 1) return t;
      const ti = direction === 'up' ? idx - 1 : idx + 1;
      [subs[idx], subs[ti]] = [subs[ti], subs[idx]];
      return { ...t, subtasks: subs };
    }));
  };

  // Move initial subtask (while creating)
  const handleMoveInitialSubtask = (index: number, direction: 'up' | 'down') => {
    setInlineTaskInput(prev => {
      const updated = [...prev.initialSubtasks];
      if (direction === 'up' && index <= 0) return prev;
      if (direction === 'down' && index >= updated.length - 1) return prev;
      const ti = direction === 'up' ? index - 1 : index + 1;
      [updated[index], updated[ti]] = [updated[ti], updated[index]];
      return { ...prev, initialSubtasks: updated };
    });
  };

  // Replicate to tomorrow
  const handleReplicateToTomorrow = () => {
    const cur = new Date(selectedDate + 'T00:00:00');
    cur.setDate(cur.getDate() + 1);
    const tomorrowStr = formatDateString(cur);
    const currentTasks = tasksForSelectedDate;
    if (currentTasks.length === 0) { showToast('No tasks to replicate'); return; }
    const newTasks: SchedulerTask[] = currentTasks.map(t => ({
      ...t, id: 'task_' + Math.random().toString(36).substring(2, 9),
      date: tomorrowStr, completed: false, selectedOption: undefined,
      subtasks: t.subtasks?.map(s => ({ ...s, completed: false })),
      createdAt: new Date().toISOString(),
      isRecurrenceTemplate: undefined, recurrenceTemplateId: undefined,
    }));
    setTasks(prev => {
      const others = prev.filter(t => t.date !== tomorrowStr || t.isRecurrenceTemplate);
      return [...others, ...newTasks];
    });
    setSelectedDate(tomorrowStr);
    showToast(`Replicated ${currentTasks.length} tasks to tomorrow!`);
  };

  const resetGroupTemplateDraft = (block: TimeBlock = 'Morning') => {
    setGroupTemplateDraft({
      name: '',
      subtaskTitles: [''],
      defaultTimeBlock: block,
      defaultScheduledTime: '',
    });
    setEditingGroupTemplate(null);
  };

  const openGroupTemplatesModal = (defaultBlock?: TimeBlock) => {
    resetGroupTemplateDraft(defaultBlock ?? visibleBlock);
    setShowGroupTemplatesModal(true);
  };

  const insertGroupFromTemplate = (template: TaskGroupTemplate, block: TimeBlock) => {
    const titles = template.subtaskTitles.filter(t => t.trim().length > 0);
    if (titles.length === 0) {
      showToast('Template has no sub-tasks');
      return;
    }

    const newTask: SchedulerTask = {
      id: 'task_' + Math.random().toString(36).substring(2, 9),
      date: selectedDate,
      timeBlock: block,
      title: template.name.trim() || 'Group',
      scheduledTime: template.defaultScheduledTime?.trim() || undefined,
      completed: false,
      type: 'group',
      subtasks: titles.map(title => ({
        id: 'sub_' + Math.random().toString(36).substring(2, 9),
        title: title.trim(),
        completed: false,
      })),
      createdAt: new Date().toISOString(),
    };

    setTasks(prev => [...prev, newTask]);
    setExpandedTaskIds(prev => ({ ...prev, [newTask.id]: true }));
    setExpandedBlocks(prev => ({ ...prev, [block]: true }));
    setSavedGroupPickerBlock(null);
    showToast(`Added "${newTask.title}" to ${block}`);
  };

  const saveGroupAsTemplate = (task: SchedulerTask) => {
    const titles = (task.subtasks || []).map(s => s.title.trim()).filter(Boolean);
    if (task.type !== 'group' || titles.length === 0) {
      showToast('Group needs at least one sub-task');
      return;
    }

    const template: TaskGroupTemplate = {
      id: 'tpl_' + Math.random().toString(36).substring(2, 9),
      name: task.title.trim() || 'Untitled Group',
      subtaskTitles: titles,
      defaultTimeBlock: task.timeBlock,
      defaultScheduledTime: task.scheduledTime,
      createdAt: new Date().toISOString(),
    };

    setGroupTemplates(prev => [...prev, template]);
    showToast(`Saved "${template.name}" for reuse`);
  };

  const saveInlineGroupAsTemplate = () => {
    const titles = inlineTaskInput.initialSubtasks.map(s => s.trim()).filter(Boolean);
    const name = inlineTaskInput.text.trim() || 'Untitled Group';
    if (titles.length === 0) {
      showToast('Add at least one sub-task first');
      return;
    }

    const template: TaskGroupTemplate = {
      id: 'tpl_' + Math.random().toString(36).substring(2, 9),
      name,
      subtaskTitles: titles,
      defaultTimeBlock: inlineTaskInput.block ?? visibleBlock,
      defaultScheduledTime: inlineTaskInput.scheduledTime.trim() || undefined,
      createdAt: new Date().toISOString(),
    };

    setGroupTemplates(prev => [...prev, template]);
    showToast(`Saved "${template.name}" for reuse`);
  };

  const handleSaveGroupTemplateDraft = () => {
    const name = groupTemplateDraft.name.trim();
    const titles = groupTemplateDraft.subtaskTitles.map(s => s.trim()).filter(Boolean);
    if (!name) {
      showToast('Enter a group name');
      return;
    }
    if (titles.length === 0) {
      showToast('Add at least one sub-task');
      return;
    }

    const payload = {
      name,
      subtaskTitles: titles,
      defaultTimeBlock: groupTemplateDraft.defaultTimeBlock,
      defaultScheduledTime: groupTemplateDraft.defaultScheduledTime.trim() || undefined,
    };

    if (editingGroupTemplate) {
      setGroupTemplates(prev =>
        prev.map(t => (t.id === editingGroupTemplate.id ? { ...t, ...payload } : t))
      );
      showToast(`Updated "${name}"`);
    } else {
      setGroupTemplates(prev => [
        ...prev,
        {
          id: 'tpl_' + Math.random().toString(36).substring(2, 9),
          ...payload,
          createdAt: new Date().toISOString(),
        },
      ]);
      showToast(`Saved "${name}"`);
    }

    resetGroupTemplateDraft(groupTemplateDraft.defaultTimeBlock);
  };

  const handleEditGroupTemplate = (template: TaskGroupTemplate) => {
    setEditingGroupTemplate(template);
    setGroupTemplateDraft({
      name: template.name,
      subtaskTitles: template.subtaskTitles.length > 0 ? [...template.subtaskTitles] : [''],
      defaultTimeBlock: template.defaultTimeBlock ?? 'Morning',
      defaultScheduledTime: template.defaultScheduledTime ?? '',
    });
  };

  const handleDeleteGroupTemplate = (templateId: string) => {
    setGroupTemplates(prev => prev.filter(t => t.id !== templateId));
    showToast('Template deleted');
  };

  // ── Standard Task Template Handlers ───────────────────────────────────────
  const saveStandardTaskAsTemplate = (task: SchedulerTask) => {
    if (task.type !== 'standard') {
      showToast('Only standard tasks can be saved as templates');
      return;
    }

    const template: StandardTaskTemplate = {
      id: 'std_tpl_' + Math.random().toString(36).substring(2, 9),
      name: task.title.trim() || 'Untitled Task',
      defaultTimeBlock: task.timeBlock,
      defaultScheduledTime: task.scheduledTime,
      createdAt: new Date().toISOString(),
    };

    setStandardTaskTemplates(prev => [...prev, template]);
    showToast(`Saved "${template.name}" for reuse`);
  };

  const insertStandardTaskFromTemplate = (template: StandardTaskTemplate, block: TimeBlock) => {
    const newTask: SchedulerTask = {
      id: 'task_' + Math.random().toString(36).substring(2, 9),
      date: selectedDate,
      timeBlock: block,
      title: template.name.trim() || 'Task',
      scheduledTime: template.defaultScheduledTime?.trim() || undefined,
      completed: false,
      type: 'standard',
      createdAt: new Date().toISOString(),
    };

    setTasks(prev => [...prev, newTask]);
    setExpandedBlocks(prev => ({ ...prev, [block]: true }));
    setSavedStandardTaskPickerBlock(null);
    setShowStandardTaskTemplatesModal(false);
    showToast(`Added "${newTask.title}" to ${block}`);
  };

  const handleDeleteStandardTaskTemplate = (templateId: string) => {
    setStandardTaskTemplates(prev => prev.filter(t => t.id !== templateId));
    showToast('Standard task template deleted');
  };

  const resetStandardTaskTemplateDraft = (block: TimeBlock = 'Morning') => {
    setStandardTaskTemplateDraft({
      name: '',
      defaultTimeBlock: block,
      defaultScheduledTime: '',
    });
    setEditingStandardTaskTemplate(null);
  };

  const handleEditStandardTaskTemplate = (template: StandardTaskTemplate) => {
    setEditingStandardTaskTemplate(template);
    setStandardTaskTemplateDraft({
      name: template.name,
      defaultTimeBlock: template.defaultTimeBlock,
      defaultScheduledTime: template.defaultScheduledTime ?? '',
    });
  };

  const handleSaveStandardTaskTemplateDraft = () => {
    if (!standardTaskTemplateDraft.name.trim()) {
      showToast('Task name is required');
      return;
    }

    if (editingStandardTaskTemplate) {
      setStandardTaskTemplates(prev =>
        prev.map(t =>
          t.id === editingStandardTaskTemplate.id
            ? {
                ...t,
                name: standardTaskTemplateDraft.name.trim(),
                defaultTimeBlock: standardTaskTemplateDraft.defaultTimeBlock,
                defaultScheduledTime: standardTaskTemplateDraft.defaultScheduledTime.trim() || undefined,
              }
            : t
        )
      );
      showToast('Standard task template updated');
    } else {
      const newTemplate: StandardTaskTemplate = {
        id: 'std_tpl_' + Math.random().toString(36).substring(2, 9),
        name: standardTaskTemplateDraft.name.trim(),
        defaultTimeBlock: standardTaskTemplateDraft.defaultTimeBlock,
        defaultScheduledTime: standardTaskTemplateDraft.defaultScheduledTime.trim() || undefined,
        createdAt: new Date().toISOString(),
      };
      setStandardTaskTemplates(prev => [...prev, newTemplate]);
      showToast(`Saved "${newTemplate.name}"`);
    }

    resetStandardTaskTemplateDraft(standardTaskTemplateDraft.defaultTimeBlock);
  };

  // ── Drag-and-Drop Handlers ────────────────────────────────────────────────

  const handleDragStart = (e: React.DragEvent, taskId: string) => {
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('taskId', taskId);
    setDragState(prev => ({ ...prev, draggingId: taskId }));
  };

  const handleDragEnd = () => {
    setDragState({ draggingId: null, dragOverId: null, dragOverBlock: null });
  };

  const handleDragOverTask = (e: React.DragEvent, taskId: string, block: TimeBlock) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragState(prev => ({ ...prev, dragOverId: taskId, dragOverBlock: block }));
  };

  const handleDragOverBlock = (e: React.DragEvent, block: TimeBlock) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragState(prev => ({ ...prev, dragOverBlock: block }));
  };

  const handleDropOnTask = (e: React.DragEvent, dropOnTaskId: string, dropBlock: TimeBlock) => {
    e.preventDefault();
    const draggingId = e.dataTransfer.getData('taskId') || dragState.draggingId;
    if (!draggingId || draggingId === dropOnTaskId) {
      setDragState({ draggingId: null, dragOverId: null, dragOverBlock: null });
      return;
    }
    setTasks(prev => {
      const dragging = prev.find(t => t.id === draggingId);
      const dropOn   = prev.find(t => t.id === dropOnTaskId);
      if (!dragging || !dropOn) return prev;

      // Remove dragging task from list
      let newArr = prev.filter(t => t.id !== draggingId);
      // Update its block
      const updatedDragging = { ...dragging, timeBlock: dropBlock };
      // Find the drop position
      const dropIdx = newArr.findIndex(t => t.id === dropOnTaskId);
      newArr.splice(dropIdx, 0, updatedDragging);
      return newArr;
    });
    setDragState({ draggingId: null, dragOverId: null, dragOverBlock: null });
  };

  const handleDropOnBlock = (e: React.DragEvent, block: TimeBlock) => {
    e.preventDefault();
    const draggingId = e.dataTransfer.getData('taskId') || dragState.draggingId;
    if (!draggingId) { setDragState({ draggingId: null, dragOverId: null, dragOverBlock: null }); return; }
    setTasks(prev => prev.map(t => t.id === draggingId ? { ...t, timeBlock: block } : t));
    setDragState({ draggingId: null, dragOverId: null, dragOverBlock: null });
  };

  // ── Weekly Planning Notes Handlers ────────────────────────────────────────
  const getWeekDates = useCallback((centerDateStr: string) => {
    const d = new Date((centerDateStr || dateToday) + 'T00:00:00');
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    const monday = new Date(d.setDate(diff));

    const week: { dateStr: string; label: string; dayShort: string; isToday: boolean }[] = [];
    for (let i = 0; i < 7; i++) {
      const curr = new Date(monday);
      curr.setDate(monday.getDate() + i);
      const dateStr = formatDateString(curr);
      const dayShort = curr.toLocaleDateString('en-US', { weekday: 'short' });
      const monthShort = curr.toLocaleDateString('en-US', { month: 'short' });
      const dayNum = curr.getDate();
      const isToday = dateStr === dateToday;
      week.push({
        dateStr,
        label: `${dayShort}, ${monthShort} ${dayNum}${isToday ? ' (Today)' : ''}`,
        dayShort,
        isToday,
      });
    }
    return week;
  }, []);

  const handleAddNote = (text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    const newNote: PlanningNote = {
      id: 'note_' + Math.random().toString(36).substring(2, 9),
      text: trimmed,
      completed: false,
      createdAt: new Date().toISOString(),
    };
    setPlanningNotes(prev => [newNote, ...prev]);
    setNewNoteText('');
    showToast('Note added to Weekly Notepad');
  };

  const handleToggleNoteCompleted = (noteId: string) => {
    setPlanningNotes(prev => prev.map(n => {
      if (n.id !== noteId) return n;
      const nextCompleted = !n.completed;
      if (n.scheduledTaskId) {
        setTasks(tPrev => tPrev.map(t => t.id === n.scheduledTaskId ? { ...t, completed: nextCompleted } : t));
      }
      return { ...n, completed: nextCompleted };
    }));
  };

  const handleDeleteNote = (noteId: string) => {
    const target = planningNotes.find(n => n.id === noteId);
    if (target?.scheduledTaskId) {
      setTasks(prev => prev.filter(t => t.id !== target.scheduledTaskId));
    }
    setPlanningNotes(prev => prev.filter(n => n.id !== noteId));
    if (schedulingNoteId === noteId) setSchedulingNoteId(null);
    showToast('Note deleted');
  };

  const handleScheduleNote = (noteId: string, dateStr: string, timeBlock: TimeBlock) => {
    const note = planningNotes.find(n => n.id === noteId);
    if (!note) return;

    let taskId = note.scheduledTaskId;
    if (taskId) {
      setTasks(prev => prev.map(t => {
        if (t.id !== taskId) return t;
        return {
          ...t,
          date: dateStr,
          timeBlock: timeBlock,
          title: note.text,
        };
      }));
    } else {
      taskId = 'task_note_' + Math.random().toString(36).substring(2, 9);
      const newTask: SchedulerTask = {
        id: taskId,
        date: dateStr,
        timeBlock: timeBlock,
        title: note.text,
        completed: note.completed,
        type: 'standard',
        createdAt: new Date().toISOString(),
      };
      setTasks(prev => [...prev, newTask]);
    }

    setPlanningNotes(prev => prev.map(n => {
      if (n.id !== noteId) return n;
      return {
        ...n,
        scheduledDate: dateStr,
        scheduledBlock: timeBlock,
        scheduledTaskId: taskId,
      };
    }));

    setSchedulingNoteId(null);
    const dateObj = new Date(dateStr + 'T00:00:00');
    const dayLabel = dateObj.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
    showToast(`Scheduled note for ${dayLabel} (${timeBlock})`);
  };

  const handleUnscheduleNote = (noteId: string) => {
    const note = planningNotes.find(n => n.id === noteId);
    if (note?.scheduledTaskId) {
      setTasks(prev => prev.filter(t => t.id !== note.scheduledTaskId));
    }
    setPlanningNotes(prev => prev.map(n => {
      if (n.id !== noteId) return n;
      return {
        ...n,
        scheduledDate: undefined,
        scheduledBlock: undefined,
        scheduledTaskId: undefined,
      };
    }));
    setSchedulingNoteId(null);
    showToast('Unscheduled task');
  };

  const handleJumpToScheduledNote = (dateStr?: string, block?: TimeBlock) => {
    if (!dateStr || !block) return;
    setSelectedDate(dateStr);
    handleShowBlock(block, true);
    showToast(`Jumped to ${dateStr} • ${block}`);
  };

  // ── Notification handlers ─────────────────────────────────────────────────

  const handleRequestNotifPermission = async () => {
    if (typeof Notification === 'undefined') return;
    const permission = await Notification.requestPermission();
    setNotifPermission(permission);
    if (permission === 'granted') showToast('🔔 Reminders enabled! You\'re locked in.');
    else if (permission === 'denied') showToast('Notifications blocked. Enable in browser settings.');
  };

  const dismissNotifBanner = () => {
    setNotifBannerDismissed(true);
    localStorage.setItem(NOTIF_BANNER_KEY, '1');
  };

  const handleInstallPWA = async () => {
    if (!deferredPrompt.current) return;
    deferredPrompt.current.prompt();
    const { outcome } = await deferredPrompt.current.userChoice;
    if (outcome === 'accepted') {
      setPwaInstallable(false);
      showToast('🚀 App installed! Notifications will work even when closed.');
    }
    deferredPrompt.current = null;
  };

  // ── Render ────────────────────────────────────────────────────────────────

  const showNotifBanner =
    typeof Notification !== 'undefined' &&
    Notification.permission === 'default' &&
    !notifBannerDismissed;

  return (
    <div className="max-w-7xl mx-auto space-y-6 select-none pb-20 font-sans px-2 sm:px-4">

      {/* ── Toast ─────────────────────────────────────────────────────────── */}
      <AnimatePresence>
        {toastMessage && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed top-6 left-1/2 -translate-x-1/2 z-50 bg-black text-white px-5 py-2.5 rounded-full text-xs font-bold shadow-2xl flex items-center gap-2 border border-neutral-700"
          >
            <Sparkles className="w-4 h-4 text-white animate-pulse" />
            <span>{toastMessage}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Notification Permission Banner ────────────────────────────────── */}
      <AnimatePresence>
        {showNotifBanner && (
          <motion.div
            initial={{ opacity: 0, y: -12, scale: 0.98 }}
            animate={{ opacity: 1, y: 0,   scale: 1 }}
            exit={{ opacity: 0, y: -12, scale: 0.98 }}
            className="relative flex items-center gap-3 px-4 py-3.5 rounded-2xl border border-amber-200 bg-gradient-to-r from-amber-50 to-orange-50 shadow-sm overflow-hidden"
          >
            <div className="absolute inset-0 bg-gradient-to-r from-amber-400/10 to-orange-400/10 pointer-events-none rounded-2xl" />
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shrink-0 shadow-sm">
              <Bell className="w-4.5 h-4.5 text-white animate-pulse" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-black text-amber-900 leading-tight">Enable smart reminders 🔔</p>
              <p className="text-[11px] text-amber-700 font-medium mt-0.5">
                Get block alerts at 6 AM, 12 PM, 5 PM, 9 PM + 3× daily motivation blasts.
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={handleRequestNotifPermission}
                className="px-3 py-1.5 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white text-xs font-black rounded-xl shadow-sm transition-all active:scale-95 cursor-pointer"
              >
                Enable
              </button>
              <button
                type="button"
                onClick={dismissNotifBanner}
                className="w-7 h-7 rounded-lg text-amber-600 hover:text-amber-900 hover:bg-amber-100 flex items-center justify-center transition cursor-pointer"
                title="Dismiss"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── PWA Install Banner ────────────────────────────────────────────── */}
      <AnimatePresence>
        {pwaInstallable && (
          <motion.div
            initial={{ opacity: 0, y: -10, scale: 0.98 }}
            animate={{ opacity: 1, y: 0,   scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.98 }}
            className="relative flex items-center gap-3 px-4 py-3.5 rounded-2xl border border-emerald-200 bg-gradient-to-r from-emerald-50 to-teal-50 shadow-sm overflow-hidden"
          >
            <div className="absolute inset-0 bg-gradient-to-r from-emerald-400/10 to-teal-400/10 pointer-events-none rounded-2xl" />
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shrink-0 shadow-sm">
              <span className="text-base">📲</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-black text-emerald-900 leading-tight">Install as App — Get Background Alerts</p>
              <p className="text-[11px] text-emerald-700 font-medium mt-0.5">
                Install Focus Now on your device so notifications fire even when the tab is closed.
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={handleInstallPWA}
                className="px-3 py-1.5 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white text-xs font-black rounded-xl shadow-sm transition-all active:scale-95 cursor-pointer"
              >
                Install
              </button>
              <button
                type="button"
                onClick={() => setPwaInstallable(false)}
                className="w-7 h-7 rounded-lg text-emerald-600 hover:text-emerald-900 hover:bg-emerald-100 flex items-center justify-center transition cursor-pointer"
                title="Dismiss"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Saved Group Templates Modal ───────────────────────────────────── */}
      <AnimatePresence>
        {showGroupTemplatesModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/40 backdrop-blur-[2px]"
            onClick={() => setShowGroupTemplatesModal(false)}
          >
            <motion.div
              initial={{ opacity: 0, y: 24, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 24, scale: 0.98 }}
              onClick={e => e.stopPropagation()}
              className="w-full sm:max-w-lg max-h-[88vh] overflow-hidden bg-white rounded-t-3xl sm:rounded-2xl border border-neutral-200 shadow-2xl flex flex-col"
            >
              <div className="flex items-center justify-between gap-3 px-4 sm:px-5 py-4 border-b border-neutral-100">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-9 h-9 rounded-xl bg-black text-white flex items-center justify-center shrink-0">
                    <ListTree className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <h2 className="text-sm font-black text-black tracking-tight">Saved Task Groups</h2>
                    <p className="text-[10px] font-medium text-neutral-400 truncate">
                      Save once · add to any day in one tap
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowGroupTemplatesModal(false)}
                  className="w-8 h-8 rounded-xl text-neutral-400 hover:text-black hover:bg-neutral-100 flex items-center justify-center transition cursor-pointer shrink-0"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="overflow-y-auto flex-1 px-4 sm:px-5 py-4 space-y-4">
                {/* Create / edit form */}
                <div className="bg-neutral-50 border border-neutral-200 rounded-2xl p-3.5 space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[11px] font-extrabold text-neutral-600 uppercase tracking-wider">
                      {editingGroupTemplate ? 'Edit Group' : 'New Saved Group'}
                    </span>
                    {editingGroupTemplate && (
                      <button
                        type="button"
                        onClick={() => resetGroupTemplateDraft(groupTemplateDraft.defaultTimeBlock)}
                        className="text-[10px] font-bold text-neutral-500 hover:text-black cursor-pointer"
                      >
                        Cancel edit
                      </button>
                    )}
                  </div>
                  <input
                    type="text"
                    placeholder="Group name (e.g. Morning Rituals)"
                    value={groupTemplateDraft.name}
                    onChange={e => setGroupTemplateDraft(prev => ({ ...prev, name: e.target.value }))}
                    className="w-full bg-white border border-neutral-300 rounded-xl px-3 py-2 text-xs font-bold text-black placeholder:text-neutral-400 focus:outline-none focus:border-black"
                  />
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider">Default block:</span>
                    {(['Morning', 'Afternoon', 'Evening', 'Night'] as TimeBlock[]).map(block => (
                      <button
                        key={block}
                        type="button"
                        onClick={() => setGroupTemplateDraft(prev => ({ ...prev, defaultTimeBlock: block }))}
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-lg border transition cursor-pointer ${
                          groupTemplateDraft.defaultTimeBlock === block
                            ? 'bg-black text-white border-black'
                            : 'bg-white text-neutral-700 border-neutral-200 hover:border-black'
                        }`}
                      >
                        {block}
                      </button>
                    ))}
                  </div>
                  <div className="space-y-2">
                    <span className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider block">Sub-tasks:</span>
                    <div className="flex flex-wrap gap-1.5">
                      {groupTemplateDraft.subtaskTitles.map((stText, idx) => (
                        <div key={idx} className="flex items-center gap-1 bg-white border border-neutral-200 rounded-lg px-2 py-0.5">
                          <input
                            type="text"
                            placeholder={`Sub-task ${idx + 1}`}
                            value={stText}
                            onChange={e => {
                              const val = e.target.value;
                              setGroupTemplateDraft(prev => {
                                const updated = [...prev.subtaskTitles];
                                updated[idx] = val;
                                return { ...prev, subtaskTitles: updated };
                              });
                            }}
                            className="w-28 bg-transparent text-xs text-black placeholder:text-neutral-400 focus:outline-none font-bold"
                          />
                          {groupTemplateDraft.subtaskTitles.length > 1 && (
                            <button
                              type="button"
                              onClick={() =>
                                setGroupTemplateDraft(prev => ({
                                  ...prev,
                                  subtaskTitles: prev.subtaskTitles.filter((_, i) => i !== idx),
                                }))
                              }
                              className="text-neutral-400 hover:text-red-500 p-0.5 cursor-pointer"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                      ))}
                      <button
                        type="button"
                        onClick={() =>
                          setGroupTemplateDraft(prev => ({ ...prev, subtaskTitles: [...prev.subtaskTitles, ''] }))
                        }
                        className="text-xs font-bold text-black bg-neutral-100 border border-neutral-300 hover:bg-neutral-200 px-2 py-0.5 rounded-lg transition cursor-pointer"
                      >
                        + Sub-task
                      </button>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handleSaveGroupTemplateDraft}
                    className="w-full h-9 bg-black hover:bg-neutral-800 text-white text-xs font-black rounded-xl transition cursor-pointer active:scale-[0.98]"
                  >
                    {editingGroupTemplate ? 'Update Saved Group' : 'Save Group Template'}
                  </button>
                </div>

                {/* Saved list */}
                <div className="space-y-2">
                  <span className="text-[11px] font-extrabold text-neutral-600 uppercase tracking-wider block">
                    Your Groups ({groupTemplates.length})
                  </span>
                  {groupTemplates.length === 0 ? (
                    <p className="text-xs text-neutral-400 font-medium py-4 text-center border border-dashed border-neutral-200 rounded-2xl">
                      No saved groups yet. Create one above or save from an existing group task.
                    </p>
                  ) : (
                    groupTemplates.map(template => (
                      <div
                        key={template.id}
                        className="bg-white border border-neutral-200 rounded-2xl p-3 space-y-2.5 hover:border-neutral-300 transition"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="text-sm font-black text-black truncate">{template.name}</p>
                            <p className="text-[10px] font-medium text-neutral-500 mt-0.5">
                              {template.subtaskTitles.length} sub-tasks
                              {template.defaultTimeBlock ? ` · default ${template.defaultTimeBlock}` : ''}
                            </p>
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              type="button"
                              onClick={() => handleEditGroupTemplate(template)}
                              className="w-7 h-7 rounded-lg text-neutral-400 hover:text-black hover:bg-neutral-100 flex items-center justify-center cursor-pointer"
                              title="Edit"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteGroupTemplate(template.id)}
                              className="w-7 h-7 rounded-lg text-neutral-300 hover:text-red-500 hover:bg-red-50 flex items-center justify-center cursor-pointer"
                              title="Delete"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-1">
                          {template.subtaskTitles.slice(0, 4).map((st, i) => (
                            <span key={i} className="text-[10px] font-bold text-neutral-600 bg-neutral-100 px-2 py-0.5 rounded-md">
                              {st}
                            </span>
                          ))}
                          {template.subtaskTitles.length > 4 && (
                            <span className="text-[10px] font-bold text-neutral-400 px-1 py-0.5">
                              +{template.subtaskTitles.length - 4} more
                            </span>
                          )}
                        </div>
                        <div className="flex flex-wrap gap-1.5 pt-1 border-t border-neutral-100">
                          <button
                            type="button"
                            onClick={() =>
                              insertGroupFromTemplate(template, template.defaultTimeBlock ?? visibleBlock)
                            }
                            className="flex-1 min-w-[120px] h-8 bg-black hover:bg-neutral-800 text-white text-[10px] font-black rounded-xl transition cursor-pointer active:scale-[0.98]"
                          >
                            Add to {template.defaultTimeBlock ?? visibleBlock}
                          </button>
                          {(['Morning', 'Afternoon', 'Evening', 'Night'] as TimeBlock[])
                            .filter(b => b !== (template.defaultTimeBlock ?? visibleBlock))
                            .map(block => (
                              <button
                                key={block}
                                type="button"
                                onClick={() => insertGroupFromTemplate(template, block)}
                                className="text-[10px] font-bold px-2.5 py-1 rounded-lg border border-neutral-200 bg-white text-neutral-700 hover:border-black transition cursor-pointer"
                              >
                                {block}
                              </button>
                            ))}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Saved Standard Task Templates Modal ───────────────────────────── */}
      <AnimatePresence>
        {showStandardTaskTemplatesModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/40 backdrop-blur-[2px]"
            onClick={() => setShowStandardTaskTemplatesModal(false)}
          >
            <motion.div
              initial={{ opacity: 0, y: 24, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 24, scale: 0.98 }}
              onClick={e => e.stopPropagation()}
              className="w-full sm:max-w-lg max-h-[88vh] overflow-hidden bg-white rounded-t-3xl sm:rounded-2xl border border-neutral-200 shadow-2xl flex flex-col"
            >
              <div className="flex items-center justify-between gap-3 px-4 sm:px-5 py-4 border-b border-neutral-100">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-9 h-9 rounded-xl bg-black text-white flex items-center justify-center shrink-0">
                    <Star className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <h2 className="text-sm font-black text-black tracking-tight">Saved Standard Tasks</h2>
                    <p className="text-[10px] font-medium text-neutral-400 truncate">
                      Quick-add your recurring tasks
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowStandardTaskTemplatesModal(false)}
                  className="w-8 h-8 rounded-xl text-neutral-400 hover:text-black hover:bg-neutral-100 flex items-center justify-center transition cursor-pointer shrink-0"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="overflow-y-auto flex-1 px-4 sm:px-5 py-4 space-y-4">
                {/* Create / edit form */}
                <div className="bg-neutral-50 border border-neutral-200 rounded-2xl p-3.5 space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[11px] font-extrabold text-neutral-600 uppercase tracking-wider">
                      {editingStandardTaskTemplate ? 'Edit Saved Task' : 'New Saved Task'}
                    </span>
                    {editingStandardTaskTemplate && (
                      <button
                        type="button"
                        onClick={() => resetStandardTaskTemplateDraft(standardTaskTemplateDraft.defaultTimeBlock)}
                        className="text-[10px] font-bold text-neutral-500 hover:text-black cursor-pointer"
                      >
                        Cancel edit
                      </button>
                    )}
                  </div>
                  <input
                    type="text"
                    placeholder="Task name (e.g. Meditate)"
                    value={standardTaskTemplateDraft.name}
                    onChange={e => setStandardTaskTemplateDraft(prev => ({ ...prev, name: e.target.value }))}
                    className="w-full bg-white border border-neutral-300 rounded-xl px-3 py-2 text-xs font-bold text-black placeholder:text-neutral-400 focus:outline-none focus:border-black"
                  />
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider">Default block:</span>
                    {(['Morning', 'Afternoon', 'Evening', 'Night'] as TimeBlock[]).map(block => (
                      <button
                        key={block}
                        type="button"
                        onClick={() => setStandardTaskTemplateDraft(prev => ({ ...prev, defaultTimeBlock: block }))}
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-lg border transition cursor-pointer ${
                          standardTaskTemplateDraft.defaultTimeBlock === block
                            ? 'bg-black text-white border-black'
                            : 'bg-white text-neutral-700 border-neutral-200 hover:border-black'
                        }`}
                      >
                        {block}
                      </button>
                    ))}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider shrink-0">Time (optional):</span>
                    <input
                      type="text"
                      placeholder="e.g. 08:30 AM"
                      value={standardTaskTemplateDraft.defaultScheduledTime}
                      onChange={e => setStandardTaskTemplateDraft(prev => ({ ...prev, defaultScheduledTime: e.target.value }))}
                      className="bg-white border border-neutral-300 rounded-lg px-2 py-1 text-[11px] font-bold text-black focus:outline-none focus:border-black w-24"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={handleSaveStandardTaskTemplateDraft}
                    className="w-full h-9 bg-black hover:bg-neutral-800 text-white text-xs font-black rounded-xl transition cursor-pointer active:scale-[0.98]"
                  >
                    {editingStandardTaskTemplate ? 'Update Saved Task' : 'Save Task Template'}
                  </button>
                </div>

                {/* Saved list */}
                <div className="space-y-2">
                  <span className="text-[11px] font-extrabold text-neutral-600 uppercase tracking-wider block">
                    Your Tasks ({standardTaskTemplates.length})
                  </span>
                  {standardTaskTemplates.length === 0 ? (
                    <p className="text-xs text-neutral-400 font-medium py-4 text-center border border-dashed border-neutral-200 rounded-2xl">
                      No saved standard tasks yet. Create one above or save from an existing task.
                    </p>
                  ) : (
                    standardTaskTemplates.map(template => (
                      <div
                        key={template.id}
                        className="bg-white border border-neutral-200 rounded-2xl p-3 space-y-2.5 hover:border-neutral-300 transition"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="text-sm font-black text-black truncate">{template.name}</p>
                            <p className="text-[10px] font-medium text-neutral-500 mt-0.5">
                              Default {template.defaultTimeBlock}
                              {template.defaultScheduledTime ? ` · ${template.defaultScheduledTime}` : ''}
                            </p>
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              type="button"
                              onClick={() => handleEditStandardTaskTemplate(template)}
                              className="w-7 h-7 rounded-lg text-neutral-400 hover:text-black hover:bg-neutral-100 flex items-center justify-center cursor-pointer"
                              title="Edit"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteStandardTaskTemplate(template.id)}
                              className="w-7 h-7 rounded-lg text-neutral-300 hover:text-red-500 hover:bg-red-50 flex items-center justify-center cursor-pointer"
                              title="Delete"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-1.5 pt-1 border-t border-neutral-100">
                          <button
                            type="button"
                            onClick={() =>
                              insertStandardTaskFromTemplate(template, template.defaultTimeBlock)
                            }
                            className="flex-1 min-w-[120px] h-8 bg-black hover:bg-neutral-800 text-white text-[10px] font-black rounded-xl transition cursor-pointer active:scale-[0.98]"
                          >
                            Add to {template.defaultTimeBlock}
                          </button>
                          {(['Morning', 'Afternoon', 'Evening', 'Night'] as TimeBlock[])
                            .filter(b => b !== template.defaultTimeBlock)
                            .map(block => (
                              <button
                                key={block}
                                type="button"
                                onClick={() => insertStandardTaskFromTemplate(template, block)}
                                className="text-[10px] font-bold px-2.5 py-1 rounded-lg border border-neutral-200 bg-white text-neutral-700 hover:border-black transition cursor-pointer"
                              >
                                {block}
                              </button>
                            ))}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Grid Container ─────────────────────────────────────────────────── */}
      <div className="lg:grid lg:grid-cols-12 lg:gap-6 items-start space-y-6 lg:space-y-0">
        {/* ── Left Column: Scheduler & Trackers ────────────────────────────── */}
        <div className="lg:col-span-7 xl:col-span-8 space-y-6">
          {/* ── Header ───────────────────────────────────────────────────────────── */}
      <div className="bg-white border border-neutral-200 rounded-2xl p-4 sm:p-5 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="bg-black text-white text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full tracking-wider">
                Lock-In Mode
              </span>
              {userPoints !== undefined && (
                <span className="bg-amber-100 text-amber-900 border border-amber-200 text-[10px] font-black px-2.5 py-0.5 rounded-full flex items-center gap-1">
                  ⚡ {userPoints} Points
                </span>
              )}
              {selectedDate === dateToday && (
                <span className="bg-emerald-100 text-emerald-800 border border-emerald-200 text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full tracking-wider">
                  Today
                </span>
              )}
              {notifPermission === 'granted' && (
                <span className="bg-amber-100 text-amber-800 border border-amber-200 text-[10px] font-bold px-2.5 py-0.5 rounded-full flex items-center gap-1">
                  <Bell className="w-3 h-3" /> Reminders On
                </span>
              )}
            </div>
            <h1 className="text-xl sm:text-2xl font-black text-black tracking-tight mt-1">Daily Scheduler</h1>
            <p className="text-xs text-neutral-500 font-medium">
              Time-anchored daily schedule · drag to reorder · recurring tasks
            </p>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto flex-wrap">
            {selectedDate !== dateToday && (
              <button
                type="button"
                onClick={() => setSelectedDate(dateToday)}
                className="h-9 flex items-center gap-1.5 px-3 bg-neutral-100 hover:bg-black hover:text-white text-black text-xs font-bold rounded-xl transition cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Today</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => openGroupTemplatesModal()}
              title="Manage saved task groups"
              className="h-9 flex items-center gap-2 px-3 bg-white hover:bg-neutral-50 text-black border border-neutral-200 text-xs font-bold rounded-xl transition shadow-xs active:scale-95 cursor-pointer"
            >
              <ListTree className="w-3.5 h-3.5 text-neutral-500" />
              <span>Saved Groups{groupTemplates.length > 0 ? ` (${groupTemplates.length})` : ''}</span>
            </button>
            <button
              type="button"
              onClick={() => {
                resetStandardTaskTemplateDraft();
                setShowStandardTaskTemplatesModal(true);
              }}
              title="Manage saved standard tasks"
              className="h-9 flex items-center gap-2 px-3 bg-white hover:bg-neutral-50 text-black border border-neutral-200 text-xs font-bold rounded-xl transition shadow-xs active:scale-95 cursor-pointer"
            >
              <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-500/20" />
              <span>Saved Tasks{standardTaskTemplates.length > 0 ? ` (${standardTaskTemplates.length})` : ''}</span>
            </button>
            <button
              type="button"
              onClick={handleReplicateToTomorrow}
              title="Copy current schedule to tomorrow"
              className="h-9 flex items-center gap-2 px-3 bg-black hover:bg-neutral-800 text-white text-xs font-bold rounded-xl transition shadow-xs active:scale-95 cursor-pointer"
            >
              <Copy className="w-3.5 h-3.5 text-neutral-300" />
              <span>Replicate to Tomorrow</span>
            </button>
            <a
              href="#weekly-planning-notes-section"
              className="h-9 lg:hidden flex items-center gap-1.5 px-3 bg-neutral-900 hover:bg-black text-white text-xs font-bold rounded-xl transition shadow-xs cursor-pointer"
            >
              <ClipboardList className="w-3.5 h-3.5 text-amber-400" />
              <span>Notes ({planningNotes.length})</span>
            </a>
          </div>
        </div>

        <div className="mt-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold text-neutral-500 uppercase tracking-wider flex items-center gap-1.5">
              <CalendarIcon className="w-3.5 h-3.5 text-black" />
              Select Date
            </span>
            <span className="text-xs font-bold text-black">
              {new Date(selectedDate + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
            </span>
          </div>

          <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
            {datesStrip.map((item) => {
              const stats = completionByDate[item.dateStr];
              const total = stats?.total || 0;
              const done = stats?.done || 0;
              const pct = total > 0 ? Math.round((done / total) * 100) : -1;
              const isFull = pct === 100;

              const tooltip = total > 0
                ? `${item.dayName} ${item.dayNumber} — ${done}/${total} done (${pct}%)`
                : `${item.dayName} ${item.dayNumber} — No tasks`;

              return (
                <button
                  key={item.dateStr}
                  type="button"
                  onClick={() => setSelectedDate(item.dateStr)}
                  title={tooltip}
                  className={`flex-shrink-0 flex flex-col items-center justify-center w-12 h-15 py-1.5 px-1 rounded-xl border transition-all cursor-pointer ${
                    item.isSelected
                      ? 'bg-black text-white border-black shadow-sm scale-105'
                      : isFull
                      ? 'bg-neutral-900 text-white border-neutral-900 shadow-2xs'
                      : item.isToday
                      ? 'bg-neutral-100 text-black border-neutral-300 font-bold'
                      : 'bg-white text-neutral-600 border-neutral-200 hover:border-neutral-400'
                  }`}
                >
                  <span className={`text-[9px] font-bold tracking-wider uppercase ${
                    item.isSelected || isFull ? 'text-neutral-400' : 'text-neutral-400'
                  }`}>
                    {item.dayName}
                  </span>

                  <span className={`text-sm font-black mt-0.5 ${
                    item.isSelected || isFull ? 'text-white' : 'text-black'
                  }`}>
                    {item.dayNumber}
                  </span>

                  {/* Minimalist status indicator dot/bar */}
                  {isFull ? (
                    <span className="text-[9px] font-black text-emerald-400 mt-0.5">✓</span>
                  ) : pct > 0 ? (
                    <span className="w-3.5 h-1 rounded-full bg-emerald-500 mt-1" />
                  ) : item.isToday && !item.isSelected ? (
                    <span className="w-1.5 h-1.5 rounded-full bg-black mt-1" />
                  ) : (
                    <span className="h-1 mt-1" />
                  )}
                </button>
              );
            })}
          </div>

          <div className="hidden sm:flex items-center gap-4 mt-2 pl-1">
            <span className="text-[10px] font-bold text-neutral-500 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" /> Completed
            </span>
            <span className="text-[10px] font-semibold text-neutral-400 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-neutral-300 inline-block" /> Planned
            </span>
          </div>
        </div>

        <div className="mt-3 pt-3 border-t border-neutral-100">
          <div className="flex flex-col gap-3">
            {/* Header controls for timeline layout */}
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-black uppercase tracking-wider text-neutral-400">Daily Timeline</span>
                {selectedDate === dateToday && (
                  <span className="inline-flex items-center gap-1.5 text-[9px] font-black uppercase tracking-wider bg-emerald-500 text-white px-2.5 py-0.5 rounded-full animate-pulse shadow-2xs">
                    <span className="w-1 h-1 rounded-full bg-white" />
                    Live: {currentTimeBlock}
                  </span>
                )}
              </div>

              {selectedDate === dateToday && (
                <div className="flex items-center gap-1 bg-neutral-100 p-0.5 rounded-xl border border-neutral-200">
                  <button
                    type="button"
                    onClick={() => setBlockSortOrder('liveFirst')}
                    className={`px-3 py-1.2 rounded-lg text-[10px] font-black tracking-tight transition-all cursor-pointer ${
                      blockSortOrder === 'liveFirst'
                        ? 'bg-white text-black shadow-2xs font-extrabold'
                        : 'text-neutral-400 hover:text-neutral-600'
                    }`}
                    title="Bring the current live block to the top of the timeline"
                  >
                    ⚡ Live First
                  </button>
                  <button
                    type="button"
                    onClick={() => setBlockSortOrder('chronological')}
                    className={`px-3 py-1.2 rounded-lg text-[10px] font-black tracking-tight transition-all cursor-pointer ${
                      blockSortOrder === 'chronological'
                        ? 'bg-white text-black shadow-2xs font-extrabold'
                        : 'text-neutral-400 hover:text-neutral-600'
                    }`}
                    title="Order blocks in chronological order from Morning to Night"
                  >
                    🕒 Chronological
                  </button>
                </div>
              )}
            </div>

            {/* Quick Scroll Jumps */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              {timeBlocks.map((block) => {
                const meta = TIME_BLOCK_META[block];
                const BlockIcon = meta.icon;
                const isLive = selectedDate === dateToday && block === currentTimeBlock;
                
                return (
                  <button
                    key={block}
                    type="button"
                    onClick={() => handleShowBlock(block)}
                    className={`p-3 rounded-xl border text-left transition-all hover:scale-[1.02] active:scale-95 cursor-pointer flex flex-col justify-between h-[68px] ${
                      isLive
                        ? 'border-black bg-neutral-50/50 shadow-2xs ring-1 ring-black/5'
                        : 'border-neutral-200 bg-white hover:border-neutral-300 hover:shadow-2xs'
                    }`}
                  >
                    <div className="flex items-center justify-between w-full">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <BlockIcon className={`w-3.5 h-3.5 ${isLive ? 'text-black font-black' : 'text-neutral-400'}`} />
                        <span className="text-[11px] font-black text-black truncate">${meta.label}</span>
                      </div>
                      {isLive && (
                        <span className="relative flex h-2 w-2">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                        </span>
                      )}
                    </div>
                    <span className="text-[9px] font-bold text-neutral-400 truncate">${meta.timeRange}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="mt-4 pt-3.5 border-t border-neutral-100 space-y-3.5">
            {/* Task Completion */}
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5 text-[11px] font-black text-black shrink-0 w-28">
                <CheckCircle2 className="w-3.5 h-3.5 text-black" />
                <span>Task Progress</span>
              </div>
              <div className="flex-1 bg-neutral-100 rounded-full h-2 overflow-hidden border border-neutral-200">
                <div
                  className="bg-emerald-500 h-full transition-all duration-500 rounded-full"
                  style={{ width: `${completionPercentage}%` }}
                />
              </div>
              <div className="text-[11px] font-black text-black w-20 text-right shrink-0">
                {completedTasksCount}/{totalTasksCount} ({completionPercentage}%)
              </div>
            </div>

            {/* ── Protein Tracker Card ─────────────────────────── */}
            {(() => {
              const blocks: ('Morning' | 'Afternoon' | 'Evening' | 'Night')[] = ['Morning', 'Afternoon', 'Evening', 'Night'];
              const dateFoods = schedulerLoggedFoods.filter(f => f.date === selectedDate || (!f.date && selectedDate === dateToday));
              const blockData = blocks.map(b => {
                const goal = getBlockProteinGoal(b, activeNutritionTargets);
                const consumed = dateFoods.reduce((s, f) => normalizeMealTypeToBlock(f.mealType) === b ? s + (f.protein || 0) : s, 0);
                const pct = goal > 0 ? Math.min(100, Math.round((consumed / goal) * 100)) : 0;
                return { block: b, goal, consumed, pct };
              });
              const isGoalMet = proteinCompletionPercentage >= 100;

              return (
                <div className="rounded-2xl border border-neutral-200 bg-white relative z-10 shadow-2xs">
                  {/* Header row */}
                  <div className="px-4 py-3 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="text-base leading-none">🥩</span>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-[11px] font-black text-black uppercase tracking-wide">Protein</span>
                          {isGoalMet && (
                            <span className="text-[9px] font-black uppercase tracking-wider bg-emerald-500 text-white px-2 py-0.5 rounded-full">
                              ✓ Goal Hit!
                            </span>
                          )}
                        </div>
                        <div className="text-[10px] text-neutral-400 font-semibold mt-0.5">
                          {totalProteinConsumed}g of {totalProteinGoal}g daily goal
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {/* Log Protein button */}
                      <button
                        type="button"
                        onClick={() => {
                          setShowInlineProteinLog(prev => !prev);
                          setInlineProteinEntry(prev => ({
                            ...prev,
                            mealType: (selectedDate === dateToday ? getCurrentTimeBlock() : 'Morning') as 'Morning' | 'Afternoon' | 'Evening' | 'Night'
                          }));
                        }}
                        className="shrink-0 w-8 h-8 rounded-lg bg-black text-white flex items-center justify-center hover:bg-neutral-800 transition cursor-pointer active:scale-95"
                        title={showInlineProteinLog ? "Close protein log" : "Log protein intake"}
                      >
                        {showInlineProteinLog ? (
                          <X className="w-4 h-4 stroke-[3]" />
                        ) : (
                          <Plus className="w-4 h-4 stroke-[3]" />
                        )}
                      </button>

                      {/* Goal Percentage Pill */}
                      <button
                        type="button"
                        onClick={openTargetModal}
                        disabled={!onUpdateNutritionTargets}
                        title="Click to change protein target"
                        className="h-8 px-2.5 rounded-lg border border-neutral-200 bg-white text-[11px] font-black text-black hover:border-black transition cursor-pointer disabled:opacity-40 flex items-center gap-1"
                      >
                        <span>{proteinCompletionPercentage}%</span>
                      </button>

                      {/* Three-dots options menu */}
                      <div className="relative z-50">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setShowProteinMenu(prev => !prev);
                          }}
                          className="w-8 h-8 rounded-lg border border-neutral-200 bg-white hover:bg-neutral-50 hover:border-black text-black flex items-center justify-center transition cursor-pointer active:scale-95"
                          title="Protein options"
                        >
                          <MoreVertical className="w-4 h-4 text-black" />
                        </button>

                        {showProteinMenu && (
                          <>
                            <div
                              className="fixed inset-0 z-40"
                              onClick={() => setShowProteinMenu(false)}
                            />
                            <div
                              className="absolute right-0 top-full mt-1.5 z-50 w-60 bg-white border border-neutral-200 rounded-2xl shadow-xl py-1.5 overflow-hidden animate-in fade-in zoom-in-95 duration-150"
                              onClick={e => e.stopPropagation()}
                            >
                              <div className="px-3 py-1.5 border-b border-neutral-100">
                                <p className="text-[10px] font-black uppercase tracking-wider text-neutral-400">Protein & Block Actions</p>
                              </div>

                              <button
                                type="button"
                                onClick={openTargetModal}
                                className="w-full px-3.5 py-2.5 text-left text-xs font-bold text-neutral-800 hover:bg-neutral-100 flex items-center gap-2.5 transition cursor-pointer"
                              >
                                <Target className="w-4 h-4 text-violet-600 shrink-0" />
                                <div className="flex flex-col">
                                  <span>Change Target</span>
                                  <span className="text-[10px] text-neutral-400 font-normal">Edit daily & per-block goals</span>
                                </div>
                              </button>

                              <button
                                type="button"
                                onClick={() => {
                                  setShowInlineProteinLog(prev => !prev);
                                  setShowProteinMenu(false);
                                }}
                                className="w-full px-3.5 py-2.5 text-left text-xs font-bold text-neutral-800 hover:bg-neutral-100 flex items-center gap-2.5 transition cursor-pointer"
                              >
                                <Plus className="w-4 h-4 text-emerald-600 shrink-0" />
                                <div className="flex flex-col">
                                  <span>Log Protein Food</span>
                                  <span className="text-[10px] text-neutral-400 font-normal">Add custom or favorite food</span>
                                </div>
                              </button>

                              <div className="my-1 border-t border-neutral-100" />

                              <button
                                type="button"
                                onClick={handleResetProtein}
                                className="w-full px-3.5 py-2.5 text-left text-xs font-bold text-red-600 hover:bg-red-50 flex items-center gap-2.5 transition cursor-pointer"
                              >
                                <RotateCcw className="w-4 h-4 text-red-500 shrink-0" />
                                <div className="flex flex-col">
                                  <span>Reset Protein Intake (0g)</span>
                                  <span className="text-[10px] text-red-400 font-normal">Clear logged protein for today</span>
                                </div>
                              </button>

                              <button
                                type="button"
                                onClick={handleResetTimeBlocksProgress}
                                className="w-full px-3.5 py-2.5 text-left text-xs font-bold text-amber-700 hover:bg-amber-50 flex items-center gap-2.5 transition cursor-pointer"
                              >
                                <RotateCcw className="w-4 h-4 text-amber-600 shrink-0" />
                                <div className="flex flex-col">
                                  <span>Reset Time Blocks Progress</span>
                                  <span className="text-[10px] text-amber-600/70 font-normal">Uncheck all tasks for today</span>
                                </div>
                              </button>
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Master progress bar */}
                  <div className="px-4 pb-3">
                    <div className="flex h-2.5 w-full rounded-full overflow-hidden bg-neutral-100 border border-neutral-200">
                      {blockData.map(({ block, pct, goal }) => {
                        const share = totalProteinGoal > 0 ? (goal / totalProteinGoal) * 100 : 25;
                        const fill = share * (pct / 100);
                        const blockColors: Record<string, string> = {
                          Morning: 'bg-amber-400',
                          Afternoon: 'bg-blue-400',
                          Evening: 'bg-violet-500',
                          Night: 'bg-slate-600',
                        };
                        return (
                          <div key={block} style={{ width: `${share}%` }} className="relative h-full overflow-hidden">
                            <div
                              className={`h-full transition-all duration-700 ${blockColors[block]}`}
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        );
                      })}
                    </div>

                    {/* Per-block breakdown */}
                    <div className="mt-2.5 grid grid-cols-4 gap-1.5">
                      {blockData.map(({ block, consumed, goal, pct }) => {
                        const blockColors: Record<string, string> = {
                          Morning: 'text-amber-600 bg-amber-50 border-amber-200',
                          Afternoon: 'text-blue-600 bg-blue-50 border-blue-200',
                          Evening: 'text-violet-600 bg-violet-50 border-violet-200',
                          Night: 'text-slate-600 bg-slate-50 border-slate-200',
                        };
                        const dotColors: Record<string, string> = {
                          Morning: 'bg-amber-400',
                          Afternoon: 'bg-blue-400',
                          Evening: 'bg-violet-500',
                          Night: 'bg-slate-600',
                        };
                        return (
                          <div key={block} className={`rounded-xl border p-2 text-center ${blockColors[block]}`}>
                            <div className="flex items-center justify-center gap-1 mb-0.5">
                              <span className={`w-1.5 h-1.5 rounded-full ${dotColors[block]}`} />
                              <span className="text-[9px] font-black uppercase tracking-wide">{block.substring(0, 3)}</span>
                            </div>
                            <div className="text-[10px] font-black">{consumed}g</div>
                            <div className="text-[9px] font-bold opacity-60">/{goal}g</div>
                            <div className="mt-1 h-1 w-full rounded-full bg-black/10 overflow-hidden">
                              <div className={`h-full rounded-full ${dotColors[block]} transition-all duration-500`} style={{ width: `${pct}%` }} />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Inline protein log form with Quick Favourites */}
                  {showInlineProteinLog && (
                    <div className="px-4 pb-4 border-t border-neutral-100 pt-3 space-y-3">
                      {/* Target Time Block selector */}
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <div className="text-[10px] font-black uppercase tracking-wider text-neutral-400">Target Time Block:</div>
                        <div className="flex items-center gap-1">
                          {(['Morning', 'Afternoon', 'Evening', 'Night'] as const).map(b => (
                            <button
                              key={b}
                              type="button"
                              onClick={() => setInlineProteinEntry(prev => ({ ...prev, mealType: b }))}
                              className={`px-2.5 py-1 rounded-lg text-[10px] font-black transition-all cursor-pointer ${
                                inlineProteinEntry.mealType === b
                                  ? 'bg-black text-white shadow-2xs'
                                  : 'border border-neutral-200 bg-white text-neutral-600 hover:border-neutral-400'
                              }`}
                            >
                              {b}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* ⭐ Quick Favourites Section */}
                      <div className="space-y-2 bg-neutral-50/80 p-3 rounded-2xl border border-neutral-200">
                        <div className="flex items-center justify-between gap-2 flex-wrap text-[10px] font-black uppercase tracking-wider text-neutral-500">
                          <span className="flex items-center gap-1">
                            <Star className="w-3 h-3 fill-amber-400 text-amber-400 inline" />
                            Quick Favorites (1-Tap Log to <strong className="text-black">{inlineProteinEntry.mealType}</strong>):
                          </span>
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => setShowAddFavoriteProteinModal(prev => !prev)}
                              className="h-6 px-2.5 rounded-lg bg-amber-100 hover:bg-amber-200 text-amber-900 text-[10px] font-black transition cursor-pointer flex items-center gap-1 active:scale-95 shadow-2xs"
                              title="Add a new custom favorite protein item"
                            >
                              <Plus className="w-3 h-3 text-amber-800 stroke-[3]" />
                              <span>+ Add Favorite</span>
                            </button>
                            {onOpenLogFoodForBlock && (
                              <button
                                type="button"
                                onClick={() => onOpenLogFoodForBlock(inlineProteinEntry.mealType)}
                                className="h-6 px-2 rounded-lg bg-white border border-neutral-200 hover:border-black text-[10px] font-black text-black transition cursor-pointer"
                                title="Open full protein database modal"
                              >
                                View All ↗
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Add Favorite Inline Modal/Drawer */}
                        {showAddFavoriteProteinModal && (
                          <form
                            onSubmit={(e) => {
                              e.preventDefault();
                              const proteinVal = parseFloat(customFavDraft.protein);
                              if (!customFavDraft.name.trim() || !proteinVal) return;
                              handleAddFavoriteProtein({
                                name: customFavDraft.name.trim(),
                                protein: proteinVal,
                                emoji: customFavDraft.emoji || '⭐',
                              });
                              setCustomFavDraft({ name: '', protein: '25', emoji: '🥩' });
                            }}
                            className="bg-white p-3 rounded-xl border border-amber-300 shadow-sm space-y-2.5 animate-in fade-in zoom-in-95 duration-150"
                          >
                            <div className="flex items-center justify-between text-xs font-black text-amber-900">
                              <span className="flex items-center gap-1">⭐ Add Favorite Protein</span>
                              <button
                                type="button"
                                onClick={() => setShowAddFavoriteProteinModal(false)}
                                className="text-neutral-400 hover:text-black font-bold text-xs cursor-pointer"
                              >
                                ✕
                              </button>
                            </div>

                            <div className="flex items-center gap-2 flex-wrap">
                              <input
                                type="text"
                                placeholder="Food name (e.g. 4 Boiled Eggs, Salmon)"
                                value={customFavDraft.name}
                                onChange={(e) => setCustomFavDraft(prev => ({ ...prev, name: e.target.value }))}
                                className="flex-1 min-w-36 h-8 rounded-lg border border-neutral-300 px-2.5 text-xs font-semibold focus:outline-none focus:border-black"
                                required
                                autoFocus
                              />
                              <input
                                type="number"
                                placeholder="Protein (g)"
                                min="1"
                                step="0.5"
                                value={customFavDraft.protein}
                                onChange={(e) => setCustomFavDraft(prev => ({ ...prev, protein: e.target.value }))}
                                className="w-20 h-8 rounded-lg border border-neutral-300 px-2 text-xs font-bold text-center focus:outline-none focus:border-black"
                                required
                              />
                              <div className="flex items-center gap-1">
                                {['🥩', '🍗', '🥚', '🥤', '🥣', '🧀', '🐟', '🌱'].map(em => (
                                  <button
                                    key={em}
                                    type="button"
                                    onClick={() => setCustomFavDraft(prev => ({ ...prev, emoji: em }))}
                                    className={`w-6 h-6 rounded text-xs flex items-center justify-center transition cursor-pointer ${
                                      customFavDraft.emoji === em ? 'bg-amber-200 ring-2 ring-amber-400 scale-110' : 'hover:bg-neutral-100'
                                    }`}
                                  >
                                    {em}
                                  </button>
                                ))}
                              </div>
                              <button
                                type="submit"
                                className="h-8 px-3 rounded-lg bg-amber-500 hover:bg-amber-600 text-white text-xs font-black transition cursor-pointer flex items-center gap-1 shadow-xs"
                              >
                                <Star className="w-3.5 h-3.5 fill-white" />
                                Save
                              </button>
                            </div>
                          </form>
                        )}

                        {/* Favorite Protein Chips */}
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {favoriteProteins.length === 0 ? (
                            <p className="text-[11px] text-neutral-400 py-1">No favorite proteins yet. Click "+ Add Favorite" above!</p>
                          ) : (
                            favoriteProteins.map(fav => (
                              <div
                                key={fav.id}
                                className="group relative inline-flex items-center"
                              >
                                <button
                                  type="button"
                                  onClick={() => handleQuickLogFavoriteProtein(fav)}
                                  className="h-7 px-2.5 rounded-lg border border-neutral-200 bg-white hover:border-black hover:bg-black hover:text-white text-[10px] font-black text-black transition-all cursor-pointer flex items-center gap-1 active:scale-95 shadow-2xs"
                                  title={`1-Tap log ${fav.name} (${fav.protein}g) to ${inlineProteinEntry.mealType}`}
                                >
                                  <span>{fav.emoji || '🥩'}</span>
                                  <span>{fav.name}</span>
                                  <span className="text-[9px] opacity-75 font-bold">({fav.protein}g)</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleRemoveFavoriteProtein(fav.id, fav.name);
                                  }}
                                  className="ml-1 w-4 h-4 rounded-full bg-neutral-200 hover:bg-red-500 hover:text-white text-neutral-500 text-[9px] font-black flex items-center justify-center cursor-pointer transition shrink-0 opacity-40 hover:opacity-100"
                                  title="Remove favorite"
                                >
                                  ✕
                                </button>
                              </div>
                            ))
                          )}
                        </div>
                      </div>

                      {/* Custom log input */}
                      <div className="flex items-center gap-2 flex-wrap">
                        <input
                          type="text"
                          placeholder="Food name (e.g. Protein Shake)"
                          value={inlineProteinEntry.name}
                          onChange={e => setInlineProteinEntry(prev => ({ ...prev, name: e.target.value }))}
                          className="flex-1 min-w-28 h-8 rounded-xl border border-neutral-300 bg-white px-3 text-[11px] font-semibold text-black focus:outline-none focus:border-black transition"
                        />
                        <input
                          type="number"
                          placeholder="0g"
                          min="0"
                          step="0.5"
                          value={inlineProteinEntry.protein}
                          onChange={e => setInlineProteinEntry(prev => ({ ...prev, protein: e.target.value }))}
                          onKeyDown={e => { if (e.key === 'Enter') handleSaveInlineProteinLog(); }}
                          className="w-20 h-8 rounded-xl border border-neutral-300 bg-white px-3 text-[11px] font-black text-black text-center focus:outline-none focus:border-black transition"
                        />
                        <button
                          type="button"
                          onClick={() => handleAddFavoriteProtein()}
                          className="h-8 px-2.5 rounded-xl border border-amber-300 bg-amber-50 text-amber-800 hover:bg-amber-100 text-[10px] font-black transition cursor-pointer flex items-center gap-1"
                          title="Save typed food & grams to Quick Favorites"
                        >
                          <Star className="w-3 h-3 fill-amber-500 text-amber-500" />
                          ⭐ Save Fav
                        </button>
                        <button
                          type="button"
                          onClick={handleSaveInlineProteinLog}
                          className="h-8 px-3.5 rounded-xl bg-black text-white text-[11px] font-black hover:bg-neutral-800 active:scale-95 transition cursor-pointer flex items-center gap-1"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                          Log
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })()}

                        {/* Sleep & Recovery Progress */}
            <div className="space-y-2">
              <div className="flex items-center gap-3 min-h-[24px]">
                <div className="flex items-center gap-1.5 text-[11px] font-black text-violet-700 shrink-0 w-28">
                  <span className="text-xs">🛌</span>
                  <span>Sleep & Rest</span>
                </div>
                {currentSleepLog ? (
                  <>
                    <div className="flex-1 bg-neutral-100 rounded-full h-2 overflow-hidden border border-neutral-200">
                      <div
                        className="bg-violet-600 h-full transition-all duration-500 rounded-full"
                        style={{ width: `${sleepCompletionPercentage}%` }}
                      />
                    </div>
                    {!isEditingSleep && (
                      <button
                        type="button"
                        onClick={startEditingSleep}
                        title="Click to edit sleep log"
                        className="text-[11px] font-black text-violet-700 w-20 text-right shrink-0 hover:text-violet-950 flex items-center justify-end gap-1 group transition-colors cursor-pointer"
                      >
                        <span>{currentSleepLog.hours}h/{currentSleepLog.goal || 8}h</span>
                        <span className="text-[10px] text-neutral-400 group-hover:text-black opacity-0 group-hover:opacity-100 transition-opacity">
                          <Pencil className="w-2.5 h-2.5" />
                        </span>
                        <span>({sleepCompletionPercentage}%)</span>
                      </button>
                    )}
                  </>
                ) : (
                  <>
                    <div className="flex-1 text-[11px] font-semibold text-neutral-400 italic">
                      No sleep logged for this day
                    </div>
                    {!isEditingSleep && (
                      <button
                        type="button"
                        onClick={startEditingSleep}
                        className="h-6 px-2.5 rounded-lg border border-violet-200 bg-violet-50 text-violet-700 hover:bg-violet-100 hover:border-violet-300 text-[10px] font-black flex items-center gap-1 transition cursor-pointer active:scale-95 shrink-0"
                      >
                        <Moon className="w-3 h-3 text-violet-600" />
                        <span>Log Sleep</span>
                      </button>
                    )}
                  </>
                )}
              </div>

              {/* Inline Sleep Editor Form */}
              {isEditingSleep && (
                <div
                  className="p-3.5 rounded-2xl border border-violet-200 bg-violet-50/50 space-y-3 select-text"
                  onClick={e => e.stopPropagation()}
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-4">
                      <div>
                        <label className="text-[9px] font-black uppercase text-violet-500 block mb-0.5">Hours Slept</label>
                        <input
                          type="number"
                          step="0.5"
                          min="0"
                          max="24"
                          value={editSleepHours}
                          onChange={e => setEditSleepHours(e.target.value)}
                          className="w-16 h-7 rounded-lg border border-neutral-300 bg-white px-2 text-xs font-black text-black focus:border-violet-500 focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="text-[9px] font-black uppercase text-violet-500 block mb-0.5">Goal Target</label>
                        <input
                          type="number"
                          step="0.5"
                          min="1"
                          max="24"
                          value={editSleepGoal}
                          onChange={e => setEditSleepGoal(e.target.value)}
                          className="w-16 h-7 rounded-lg border border-neutral-300 bg-white px-2 text-xs font-black text-black focus:border-violet-500 focus:outline-none"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="text-[9px] font-black uppercase text-violet-500 block mb-1">Quality Rating</label>
                      <div className="flex items-center gap-1 bg-white p-1 rounded-lg border border-neutral-200">
                        {[1, 2, 3, 4, 5].map(star => (
                          <button
                            key={star}
                            type="button"
                            onClick={() => setEditSleepQuality(star)}
                            className="p-0.5 hover:scale-110 active:scale-90 transition cursor-pointer"
                            title={`Rate ${star} star${star > 1 ? 's' : ''}`}
                          >
                            <Star
                              className={`w-4 h-4 ${
                                star <= editSleepQuality
                                  ? 'fill-amber-400 text-amber-400'
                                  : 'text-neutral-300'
                              }`}
                            />
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-1 border-t border-violet-100">
                    <button
                      type="button"
                      onClick={() => setIsEditingSleep(false)}
                      className="px-3 py-1.5 rounded-lg border border-neutral-300 text-neutral-600 hover:text-black bg-white text-[10px] font-black cursor-pointer active:scale-95 transition"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleSaveSleepLog}
                      className="px-3 py-1.5 rounded-lg bg-violet-600 hover:bg-violet-700 text-white text-[10px] font-black cursor-pointer active:scale-95 transition flex items-center gap-1"
                    >
                      <Check className="w-3.5 h-3.5 stroke-[3]" />
                      <span>Save Log</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Recovery Status Card */}
              {currentSleepLog && !isEditingSleep && (() => {
                const ratingInfo = [
                  { badge: '🔴 Poor Recovery', msg: 'Sleep quality was low. Keep tasks light, focus on slow pacing, hydration, and wind down early tonight. 🛌', color: 'border-rose-200 bg-rose-50 text-rose-700' },
                  { badge: '🟡 Low Recovery', msg: 'Rest was subpar. Avoid heavy stress, watch caffeine timing, and schedule a 15-minute rest block. 🧘', color: 'border-amber-200 bg-amber-50 text-amber-800' },
                  { badge: '🔵 Fair Recovery', msg: 'Decent rest. Keep hydrated, stay active in blocks, and aim for a structured wind-down tonight. ☕', color: 'border-blue-200 bg-blue-50/70 text-blue-700' },
                  { badge: '🟢 Great Recovery', msg: 'Good sleep! Energy systems are stable. Ready to execute your time blocks effectively. 💪', color: 'border-emerald-200 bg-emerald-50/70 text-emerald-800' },
                  { badge: '🔥 Peak Recovery', msg: 'Superb sleep quality! Recovery is optimal. Lock-in mode is active. Crush your hardest tasks today! 🚀', color: 'border-violet-200 bg-violet-50 text-violet-800' }
                ][currentSleepLog.quality - 1] || { badge: 'Sleep Logged', msg: 'Sleep log saved successfully.', color: 'border-neutral-200 bg-neutral-50 text-neutral-800' };

                return (
                  <div className={`p-3 rounded-2xl border ${ratingInfo.color} flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 transition`}>
                    <div className="flex items-start gap-2.5 min-w-0">
                      <span className="text-base shrink-0 mt-0.5">💤</span>
                      <div className="min-w-0">
                        <span className="inline-block text-[9px] font-black uppercase px-2 py-0.5 rounded-full border border-current tracking-wider mb-1">
                          {ratingInfo.badge}
                        </span>
                        <p className="text-[11px] font-semibold leading-relaxed">
                          {ratingInfo.msg}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <Star
                          key={i}
                          className={`w-3.5 h-3.5 ${
                            i < currentSleepLog.quality ? 'fill-amber-400 text-amber-400' : 'text-neutral-300'
                          }`}
                        />
                      ))}
                      <button
                        type="button"
                        onClick={handleDeleteSleepLog}
                        title="Remove sleep log"
                        className="ml-1 w-6 h-6 rounded-lg bg-white/60 hover:bg-white border border-current/30 flex items-center justify-center opacity-60 hover:opacity-100 transition cursor-pointer"
                      >
                        <X className="w-3.5 h-3.5 stroke-[3]" />
                      </button>
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>
        </div>
      </div>
      {/* ── Time Block Sections ────────────────────────────────────────────────── */}
      <div ref={timeBlockViewportRef} className="space-y-4 scroll-mt-6">
        {visibleTimeBlocks.map(block => {
          const meta           = TIME_BLOCK_META[block];
          const BlockIcon      = meta.icon;
          const blockTasks     = tasksForSelectedDate.filter(t => t.timeBlock === block);
          const isExpanded     = expandedBlocks[block];
          const completedCount = blockTasks.filter(t => t.completed).length;
          const timePresets    = BLOCK_TIME_PRESETS[block];
          const isCurrent      = selectedDate === dateToday && block === getCurrentTimeBlock();
          const isAllDone      = blockTasks.length > 0 && completedCount === blockTasks.length;
          const isDragTarget   = dragState.draggingId !== null && dragState.dragOverBlock === block;

          return (
            <div
              key={block}
              id={`time-block-${block}`}
              onDragOver={e => handleDragOverBlock(e, block)}
              onDrop={e => handleDropOnBlock(e, block)}
              className={`bg-white border rounded-2xl overflow-hidden transition-all duration-300 ${
                isDragTarget
                  ? 'border-black ring-2 ring-black/20 shadow-md scale-[1.01]'
                  : isCurrent
                  ? 'border-black ring-2 ring-black/15 shadow-md shadow-emerald-500/5'
                  : isAllDone
                  ? 'border-neutral-200 bg-neutral-50/40 opacity-90'
                  : 'border-neutral-200 hover:border-neutral-300 shadow-2xs hover:shadow-xs'
              }`}
            >
              {/* Section Header */}
              <div
                onClick={() => toggleExpandBlock(block)}
                className="p-3.5 sm:p-4 flex items-center justify-between cursor-pointer hover:bg-neutral-50/80 transition select-none bg-white"
              >
                <div className="flex items-center gap-3">
                  <div className={`w-8.5 h-8.5 rounded-xl flex items-center justify-center shrink-0 transition-colors ${
                    isCurrent ? 'bg-black text-white' : 'bg-neutral-100 text-black border border-neutral-200'
                  }`}>
                    <BlockIcon className="w-4 h-4 stroke-[2px]" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h2 className="text-sm sm:text-base font-black tracking-tight text-black">{meta.label}</h2>
                      <span className="text-[10px] font-bold text-neutral-500 bg-neutral-100 px-2 py-0.5 rounded-full border border-neutral-200">
                        {meta.timeRange}
                      </span>
                      {isCurrent && (
                        <span className="inline-flex items-center gap-1.5 text-[9px] font-black uppercase tracking-wider bg-emerald-500 text-white px-2.5 py-0.5 rounded-full shadow-2xs animate-pulse">
                          <span className="w-1 h-1 rounded-full bg-white animate-pulse" />
                          Live Now
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-neutral-400 font-medium">{meta.desc}</p>
                  </div>
                </div>

                <div className="flex items-center gap-2 sm:gap-3">
                  {/* Protein pill — shows for all dates */}
                  {(() => {
                    const dateFoods = schedulerLoggedFoods.filter(f => f.date === selectedDate || (!f.date && selectedDate === dateToday));
                    const blockP     = dateFoods.reduce((s, f) => normalizeMealTypeToBlock(f.mealType) === block ? s + (f.protein || 0) : s, 0);
                    const blockGoal  = getBlockProteinGoal(block, activeNutritionTargets);
                    const pct        = Math.min(100, blockGoal > 0 ? Math.round((blockP / blockGoal) * 100) : 0);
                    return (
                      <button
                        type="button"
                        onClick={e => { e.stopPropagation(); startEditingProteinGoal(block, blockGoal); }}
                        disabled={!onUpdateNutritionTargets}
                        className="hidden sm:flex flex-col items-end gap-1 min-w-28 rounded-xl border border-neutral-200 bg-white px-3 py-1.5 text-left hover:border-black transition"
                        title={`Edit ${meta.label} protein goal`}
                      >
                        <span className="text-[9px] font-black uppercase tracking-wider text-neutral-500">Protein</span>
                        <span className="text-xs font-black text-black">{blockP}g / {blockGoal}g</span>
                        <span className="h-1 w-full rounded-full bg-neutral-100 overflow-hidden">
                          <span className="block h-full rounded-full bg-black transition-all duration-500" style={{ width: `${pct}%` }} />
                        </span>
                      </button>
                    );
                  })()}

                  {/* Completed counter */}
                  {isAllDone ? (
                    <span className="text-xs font-black text-white bg-black px-2.5 py-1 rounded-full flex items-center gap-1 shadow-2xs">
                      <Check className="w-3.5 h-3.5 stroke-[3px]" />
                      <span>{completedCount}/{blockTasks.length}</span>
                    </span>
                  ) : (
                    <span className="text-xs font-bold text-neutral-700 bg-neutral-100 border border-neutral-200 px-2.5 py-1 rounded-full">
                      {completedCount}/{blockTasks.length}
                    </span>
                  )}

                  {/* Insert saved standard task */}
                  <div className="relative">
                    <button
                      type="button"
                      onClick={e => {
                        e.stopPropagation();
                        if (!isExpanded) setExpandedBlocks(prev => ({ ...prev, [block]: true }));
                        if (standardTaskTemplates.length === 0) {
                          resetStandardTaskTemplateDraft(block);
                          setShowStandardTaskTemplatesModal(true);
                          return;
                        }
                        setSavedStandardTaskPickerBlock(prev => (prev === block ? null : block));
                        setSavedGroupPickerBlock(null);
                      }}
                      title="Add saved task to this block"
                      className="w-8 h-8 rounded-xl bg-white text-amber-500 border border-neutral-300 flex items-center justify-center hover:border-black active:scale-95 transition cursor-pointer"
                    >
                      <Star className="w-4 h-4 fill-amber-400 stroke-[2px]" />
                    </button>
                    {savedStandardTaskPickerBlock === block && standardTaskTemplates.length > 0 && (
                      <div
                        className="absolute right-0 top-full mt-1.5 z-30 w-56 max-h-64 overflow-y-auto bg-white border border-neutral-200 rounded-xl shadow-xl py-1"
                        onClick={e => e.stopPropagation()}
                      >
                        <p className="px-3 py-1.5 text-[9px] font-black text-neutral-400 uppercase tracking-wider border-b border-neutral-100">
                          Add to {meta.label}
                        </p>
                        {(() => {
                          const blockTemplates = standardTaskTemplates.filter(t => t.defaultTimeBlock === block);
                          if (blockTemplates.length === 0) {
                            return (
                              <p className="px-3 py-3 text-xs text-neutral-400 font-medium text-center">
                                No saved tasks for {block}.
                              </p>
                            );
                          }
                          return blockTemplates.map(template => (
                            <button
                              key={template.id}
                              type="button"
                              onClick={() => insertStandardTaskFromTemplate(template, block)}
                              className="w-full text-left px-3 py-2 hover:bg-neutral-50 transition cursor-pointer"
                            >
                              <p className="text-xs font-black text-black truncate">{template.name}</p>
                              {template.defaultScheduledTime && (
                                <p className="text-[10px] text-neutral-500 font-medium">
                                  Time: {template.defaultScheduledTime}
                                </p>
                              )}
                            </button>
                          ));
                        })()}
                        <button
                          type="button"
                          onClick={() => {
                            setSavedStandardTaskPickerBlock(null);
                            resetStandardTaskTemplateDraft(block);
                            setShowStandardTaskTemplatesModal(true);
                          }}
                          className="w-full text-left px-3 py-2 text-[10px] font-bold text-black border-t border-neutral-100 hover:bg-neutral-50 cursor-pointer"
                        >
                          + Manage saved tasks
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Insert saved group */}
                  <div className="relative">
                    <button
                      type="button"
                      onClick={e => {
                        e.stopPropagation();
                        if (!isExpanded) setExpandedBlocks(prev => ({ ...prev, [block]: true }));
                        if (groupTemplates.length === 0) {
                          openGroupTemplatesModal(block);
                          return;
                        }
                        setSavedGroupPickerBlock(prev => (prev === block ? null : block));
                        setSavedStandardTaskPickerBlock(null);
                      }}
                      title={groupTemplates.length > 0 ? 'Add saved group to this block' : 'Create a saved group'}
                      className="w-8 h-8 rounded-xl bg-white text-black border border-neutral-300 flex items-center justify-center hover:border-black active:scale-95 transition cursor-pointer"
                    >
                      <ListTree className="w-4 h-4 stroke-[2.5px]" />
                    </button>
                    {savedGroupPickerBlock === block && groupTemplates.length > 0 && (
                      <div
                        className="absolute right-0 top-full mt-1.5 z-30 w-56 max-h-64 overflow-y-auto bg-white border border-neutral-200 rounded-xl shadow-xl py-1"
                        onClick={e => e.stopPropagation()}
                      >
                        <p className="px-3 py-1.5 text-[9px] font-black text-neutral-400 uppercase tracking-wider border-b border-neutral-100">
                          Add to {meta.label}
                        </p>
                        {groupTemplates.map(template => (
                          <button
                            key={template.id}
                            type="button"
                            onClick={() => insertGroupFromTemplate(template, block)}
                            className="w-full text-left px-3 py-2 hover:bg-neutral-50 transition cursor-pointer"
                          >
                            <p className="text-xs font-black text-black truncate">{template.name}</p>
                            <p className="text-[10px] text-neutral-500 font-medium">
                              {template.subtaskTitles.length} sub-tasks
                            </p>
                          </button>
                        ))}
                        <button
                          type="button"
                          onClick={() => {
                            setSavedGroupPickerBlock(null);
                            openGroupTemplatesModal(block);
                          }}
                          className="w-full text-left px-3 py-2 text-[10px] font-bold text-black border-t border-neutral-100 hover:bg-neutral-50 cursor-pointer"
                        >
                          + Manage saved groups
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Add task button */}
                  <button
                    type="button"
                    onClick={e => {
                      e.stopPropagation();
                      if (!isExpanded) setExpandedBlocks(prev => ({ ...prev, [block]: true }));
                      setInlineTaskInput(prev =>
                        prev.block === block
                          ? { block: null, text: '', scheduledTime: '', taskType: 'standard', initialSubtasks: [''], customChoices: DEFAULT_SPORTS_OPTIONS, newChoiceInput: '', recurrenceType: 'none', reminderTime: '' }
                          : { block, text: '', scheduledTime: '', taskType: 'standard', initialSubtasks: [''], customChoices: DEFAULT_SPORTS_OPTIONS, newChoiceInput: '', recurrenceType: 'none', reminderTime: '' }
                      );
                    }}
                    title="Add task to this section"
                    className="w-8 h-8 rounded-full bg-black text-white flex items-center justify-center hover:scale-110 active:scale-95 transition shadow-xs cursor-pointer"
                  >
                    <FolderPlus className="w-4 h-4 stroke-[2.5px]" />
                  </button>

                  {/* Expand/Collapse */}
                  <button type="button" className="w-8 h-8 rounded-full flex items-center justify-center text-neutral-400 hover:text-black hover:bg-neutral-100 transition cursor-pointer">
                    {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Accordion Body */}
              <AnimatePresence initial={false}>
                {isExpanded && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2, ease: 'easeInOut' }}
                    className="border-t border-neutral-100 bg-white"
                  >
                    <div className="p-4 space-y-2.5">

                      {/* Protein strip — all dates */}
                      {(() => {
                        const dateFoods = schedulerLoggedFoods.filter(f => f.date === selectedDate || (!f.date && selectedDate === dateToday));
                        const blockP     = dateFoods.reduce((s, f) => f.mealType === block ? s + (f.protein || 0) : s, 0);
                        const blockGoal  = getBlockProteinGoal(block, activeNutritionTargets);
                        const pct        = Math.min(100, blockGoal > 0 ? Math.round((blockP / blockGoal) * 100) : 0);
                        const isEditing  = editingProteinGoal?.block === block;
                        const isToday    = selectedDate === dateToday;

                        return (
                          <div className="rounded-xl border border-neutral-200 bg-white px-3 py-2 shadow-xs mb-1">
                            <div className="flex items-center gap-3">
                              <div className="w-7 h-7 rounded-lg border border-neutral-300 bg-neutral-50 text-black flex items-center justify-center shrink-0">
                                <span className="text-[10px] font-black">P</span>
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between gap-2 mb-1.5">
                                  <div className="min-w-0">
                                    <div className="text-[10px] font-black uppercase tracking-wide text-black">Protein Goal</div>
                                    <div className="text-[10px] font-bold text-neutral-500">{blockP}g logged in {meta.label}{!isToday && <span className="ml-1 text-neutral-400">(past)</span>}</div>
                                  </div>
                                  {isEditing ? (
                                    <form onSubmit={e => { e.preventDefault(); handleSaveProteinGoal(); }} className="flex items-center gap-1.5 shrink-0">
                                      <input
                                        type="number" min="0" value={editingProteinGoal.value}
                                        onChange={e => setEditingProteinGoal({ block, value: e.target.value })}
                                        onKeyDown={e => { if (e.key === 'Escape') setEditingProteinGoal(null); }}
                                        className="w-14 h-7 rounded-lg border border-black bg-white px-2 text-xs font-black text-black text-center focus:outline-none"
                                        autoFocus
                                      />
                                      <button type="submit" className="w-7 h-7 rounded-lg bg-black text-white flex items-center justify-center cursor-pointer active:scale-95" title="Save">
                                        <Check className="w-3.5 h-3.5 stroke-[3]" />
                                      </button>
                                      <button type="button" onClick={() => setEditingProteinGoal(null)} className="w-7 h-7 rounded-lg border border-neutral-300 text-neutral-500 hover:text-black flex items-center justify-center cursor-pointer active:scale-95" title="Cancel">
                                        <X className="w-3.5 h-3.5 stroke-[3]" />
                                      </button>
                                    </form>
                                  ) : (
                                    <button
                                      type="button"
                                      onClick={() => startEditingProteinGoal(block, blockGoal)}
                                      disabled={!onUpdateNutritionTargets}
                                      className="h-7 rounded-lg border border-neutral-300 bg-white hover:border-black px-2 flex items-center gap-1.5 text-[10px] font-black text-black transition cursor-pointer shrink-0"
                                    >
                                      <span>{blockGoal}g</span>
                                      <Pencil className="w-3 h-3" />
                                    </button>
                                  )}
                                </div>
                                <div className="flex items-center gap-2">
                                  <div className="flex-1 h-1.5 rounded-full bg-neutral-100 overflow-hidden">
                                    <div className="h-full rounded-full bg-black transition-all duration-500" style={{ width: `${pct}%` }} />
                                  </div>
                                  <span className="w-8 text-right text-[10px] font-black text-black">{pct}%</span>
                                </div>
                              </div>
                              {isToday && onOpenLogFoodForBlock && (
                                <button
                                  type="button"
                                  onClick={() => onOpenLogFoodForBlock(block)}
                                  className="shrink-0 w-8 h-8 rounded-lg bg-black text-white flex items-center justify-center hover:bg-neutral-800 transition cursor-pointer active:scale-95"
                                >
                                  <Plus className="w-4 h-4 stroke-[3]" />
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })()}

                      {/* ── Inline Task Creator ─────────────────────────────────────── */}
                      {inlineTaskInput.block === block && (
                        <motion.div
                          initial={{ opacity: 0, y: -6 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="bg-neutral-50 border border-black rounded-2xl p-3.5 space-y-3 shadow-md"
                        >
                          {/* Task Type */}
                          <div className="flex items-center justify-between pb-2 border-b border-neutral-200 flex-wrap gap-2">
                            <span className="text-[11px] font-extrabold text-neutral-600 uppercase tracking-wider">Type:</span>
                            <div className="flex items-center gap-1.5">
                              {(['standard', 'group', 'choice'] as const).map(type => (
                                <button
                                  key={type}
                                  type="button"
                                  onClick={() => setInlineTaskInput(prev => ({
                                    ...prev, taskType: type,
                                    text: type === 'group' ? (prev.text || 'Morning Rituals') : type === 'choice' ? (prev.text || 'Play Sports') : prev.text,
                                  }))}
                                  className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition flex items-center gap-1 cursor-pointer ${
                                    inlineTaskInput.taskType === type ? 'bg-black text-white' : 'bg-white text-neutral-700 border border-neutral-200 hover:border-black'
                                  }`}
                                >
                                  {type === 'group' && <ListTree className="w-3.5 h-3.5 opacity-60" />}
                                  {type === 'choice' && <Dumbbell className="w-3.5 h-3.5 opacity-60" />}
                                  {type === 'standard' ? 'Standard' : type === 'group' ? 'Group' : 'Sports/Choice'}
                                </button>
                              ))}
                            </div>
                          </div>

                          {/* Time Presets */}
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider flex items-center gap-1">
                              <Clock className="w-3 h-3 text-black" /> Time:
                            </span>
                            <button
                              type="button"
                              onClick={() => setInlineTaskInput(prev => ({ ...prev, scheduledTime: '' }))}
                              className={`text-[10px] font-bold px-2 py-0.5 rounded border transition cursor-pointer ${!inlineTaskInput.scheduledTime.trim() ? 'bg-black text-white border-black' : 'bg-white text-neutral-700 border-neutral-200 hover:border-black'}`}
                            >
                              No Time
                            </button>
                            {timePresets.map(preset => (
                              <button
                                key={preset}
                                type="button"
                                onClick={() => setInlineTaskInput(prev => ({ ...prev, scheduledTime: prev.scheduledTime === preset ? '' : preset }))}
                                className={`text-[10px] font-bold px-2 py-0.5 rounded border transition cursor-pointer ${inlineTaskInput.scheduledTime === preset ? 'bg-black text-white border-black' : 'bg-white text-neutral-700 border-neutral-200 hover:border-black'}`}
                              >
                                {preset}
                              </button>
                            ))}
                          </div>

                          {/* ── Recurrence Row ──────────────────────────────────────────── */}
                          <div className="flex items-center gap-1.5 flex-wrap pt-1 border-t border-neutral-200">
                            <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider flex items-center gap-1">
                              <Repeat2 className="w-3 h-3 text-black" /> Repeat:
                            </span>
                            {RECURRENCE_OPTIONS.map(opt => (
                              <button
                                key={opt.type}
                                type="button"
                                onClick={() => setInlineTaskInput(prev => ({ ...prev, recurrenceType: opt.type }))}
                                className={`text-[10px] font-bold px-2.5 py-0.5 rounded-lg border transition cursor-pointer flex items-center gap-1 ${
                                  inlineTaskInput.recurrenceType === opt.type ? 'bg-black text-white border-black' : 'bg-white text-neutral-700 border-neutral-200 hover:border-black'
                                }`}
                              >
                                {opt.type !== 'none' && <Repeat2 className="w-2.5 h-2.5 opacity-70" />}
                                {opt.short}
                              </button>
                            ))}
                          </div>

                          {/* Reminder time (only if recurring) */}
                          {inlineTaskInput.recurrenceType !== 'none' && (
                            <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
                              <Bell className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                              <span className="text-[10px] font-black text-amber-800 uppercase tracking-wider">Reminder:</span>
                              <input
                                type="time"
                                value={inlineTaskInput.reminderTime}
                                onChange={e => setInlineTaskInput(prev => ({ ...prev, reminderTime: e.target.value }))}
                                className="flex-1 bg-transparent text-xs font-bold text-amber-900 focus:outline-none"
                              />
                              {inlineTaskInput.reminderTime && (
                                <button
                                  type="button"
                                  onClick={() => setInlineTaskInput(prev => ({ ...prev, reminderTime: '' }))}
                                  className="text-amber-500 hover:text-amber-800 cursor-pointer"
                                >
                                  <X className="w-3 h-3" />
                                </button>
                              )}
                              {notifPermission !== 'granted' && (
                                <span className="text-[9px] text-amber-600 font-bold">Enable notifs first ↑</span>
                              )}
                            </div>
                          )}

                          {/* Task Name & Time Input */}
                          <div className="flex flex-col sm:flex-row items-center gap-2">
                            <input
                              type="text"
                              autoFocus
                              placeholder={
                                inlineTaskInput.taskType === 'group' ? 'Group Name...' :
                                inlineTaskInput.taskType === 'choice' ? 'Choice Title...' :
                                'Task title...'
                              }
                              value={inlineTaskInput.text}
                              onChange={e => setInlineTaskInput(prev => ({ ...prev, text: e.target.value }))}
                              onKeyDown={e => { if (e.key === 'Enter') handleAddTask(block); }}
                              className="flex-1 bg-white border border-neutral-300 rounded-xl px-3 py-1.5 text-xs font-bold text-black placeholder:text-neutral-400 focus:outline-none focus:border-black w-full"
                            />
                            <div className="flex items-center gap-1 bg-white border border-neutral-300 rounded-xl px-2.5 py-1.5 shrink-0 w-full sm:w-auto">
                              <Clock className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
                              <input
                                type="text"
                                placeholder="Time (Optional)"
                                value={inlineTaskInput.scheduledTime}
                                onChange={e => setInlineTaskInput(prev => ({ ...prev, scheduledTime: e.target.value }))}
                                className="w-28 bg-transparent text-xs font-bold text-black placeholder:text-neutral-400 focus:outline-none"
                              />
                              {inlineTaskInput.scheduledTime && (
                                <button type="button" onClick={() => setInlineTaskInput(prev => ({ ...prev, scheduledTime: '' }))} className="text-neutral-400 hover:text-black p-0.5 cursor-pointer">
                                  <X className="w-3 h-3" />
                                </button>
                              )}
                            </div>
                            <button
                              type="button"
                              onClick={() => handleAddTask(block)}
                              className="bg-black hover:bg-neutral-800 text-white text-xs font-bold px-4 py-1.5 rounded-xl transition shadow-xs cursor-pointer shrink-0 w-full sm:w-auto"
                            >
                              {inlineTaskInput.recurrenceType !== 'none' ? '+ Recurring' : 'Add'}
                            </button>
                          </div>

                          {/* Choice options config */}
                          {inlineTaskInput.taskType === 'choice' && (
                            <div className="space-y-2 pt-2 border-t border-neutral-200">
                              <span className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider block">Choice Options:</span>
                              <div className="flex flex-wrap items-center gap-1.5">
                                {inlineTaskInput.customChoices.map(opt => (
                                  <span key={opt} className="bg-neutral-100 border border-neutral-300 text-black text-xs font-bold px-2 py-0.5 rounded-lg flex items-center gap-1">
                                    <span>{SPORTS_ICONS_MAP[opt] || '🏆'} {opt}</span>
                                    <button type="button" onClick={() => setInlineTaskInput(prev => ({ ...prev, customChoices: prev.customChoices.filter(o => o !== opt) }))} className="text-neutral-400 hover:text-red-500 cursor-pointer p-0.5">
                                      <X className="w-3 h-3" />
                                    </button>
                                  </span>
                                ))}
                              </div>
                              <div className="flex items-center gap-2">
                                <input
                                  type="text" placeholder="Add custom option..."
                                  value={inlineTaskInput.newChoiceInput}
                                  onChange={e => setInlineTaskInput(prev => ({ ...prev, newChoiceInput: e.target.value }))}
                                  onKeyDown={e => {
                                    if (e.key === 'Enter' && inlineTaskInput.newChoiceInput.trim()) {
                                      e.preventDefault();
                                      const val = inlineTaskInput.newChoiceInput.trim();
                                      if (!inlineTaskInput.customChoices.includes(val))
                                        setInlineTaskInput(prev => ({ ...prev, customChoices: [...prev.customChoices, val], newChoiceInput: '' }));
                                    }
                                  }}
                                  className="flex-1 bg-white border border-neutral-300 rounded-lg px-2.5 py-1 text-xs text-black focus:outline-none focus:border-black font-semibold"
                                />
                                <button
                                  type="button"
                                  onClick={() => {
                                    const val = inlineTaskInput.newChoiceInput.trim();
                                    if (val && !inlineTaskInput.customChoices.includes(val))
                                      setInlineTaskInput(prev => ({ ...prev, customChoices: [...prev.customChoices, val], newChoiceInput: '' }));
                                  }}
                                  className="bg-black text-white text-xs font-bold px-3 py-1 rounded-lg cursor-pointer hover:bg-neutral-800"
                                >
                                  + Option
                                </button>
                              </div>
                            </div>
                          )}

                          {/* Group subtasks config */}
                          {inlineTaskInput.taskType === 'group' && (
                            <div className="space-y-2 pt-2 border-t border-neutral-200">
                              <div className="flex items-center justify-between gap-2 flex-wrap">
                                <span className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider">Sub-tasks:</span>
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  {groupTemplates.length > 0 && (
                                    <select
                                      defaultValue=""
                                      onChange={e => {
                                        const tpl = groupTemplates.find(t => t.id === e.target.value);
                                        if (!tpl) return;
                                        setInlineTaskInput(prev => ({
                                          ...prev,
                                          text: tpl.name,
                                          scheduledTime: tpl.defaultScheduledTime ?? prev.scheduledTime,
                                          initialSubtasks: tpl.subtaskTitles.length > 0 ? [...tpl.subtaskTitles] : [''],
                                        }));
                                        e.target.value = '';
                                      }}
                                      className="text-[10px] font-bold bg-white border border-neutral-300 rounded-lg px-2 py-1 text-black cursor-pointer focus:outline-none focus:border-black"
                                    >
                                      <option value="">Load saved group…</option>
                                      {groupTemplates.map(t => (
                                        <option key={t.id} value={t.id}>{t.name}</option>
                                      ))}
                                    </select>
                                  )}
                                  <button
                                    type="button"
                                    onClick={saveInlineGroupAsTemplate}
                                    className="text-[10px] font-bold text-black bg-amber-50 border border-amber-200 hover:bg-amber-100 px-2 py-1 rounded-lg transition cursor-pointer flex items-center gap-1"
                                  >
                                    <Star className="w-3 h-3" />
                                    Save as template
                                  </button>
                                </div>
                              </div>
                              <div className="flex flex-wrap items-center gap-1.5">
                                {inlineTaskInput.initialSubtasks.map((stText, idx) => (
                                  <div key={idx} className="flex items-center gap-1 bg-white border border-neutral-200 rounded-lg px-2 py-0.5 shadow-2xs">
                                    <input
                                      type="text"
                                      placeholder={`Sub-task ${idx + 1}...`}
                                      value={stText}
                                      onChange={e => {
                                        const val = e.target.value;
                                        setInlineTaskInput(prev => {
                                          const updated = [...prev.initialSubtasks];
                                          updated[idx] = val;
                                          return { ...prev, initialSubtasks: updated };
                                        });
                                      }}
                                      className="w-28 bg-transparent text-xs text-black placeholder:text-neutral-400 focus:outline-none font-bold"
                                    />
                                    <div className="flex items-center gap-0 border-l border-neutral-200 pl-1">
                                      <button type="button" disabled={idx === 0} onClick={() => handleMoveInitialSubtask(idx, 'up')} className="text-neutral-500 hover:text-black disabled:opacity-20 p-0.5 active:scale-90 transition-all cursor-pointer touch-manipulation">
                                        <ChevronUp className="w-3.5 h-3.5" />
                                      </button>
                                      <button type="button" disabled={idx === inlineTaskInput.initialSubtasks.length - 1} onClick={() => handleMoveInitialSubtask(idx, 'down')} className="text-neutral-500 hover:text-black disabled:opacity-20 p-0.5 active:scale-90 transition-all cursor-pointer touch-manipulation">
                                        <ChevronDown className="w-3.5 h-3.5" />
                                      </button>
                                    </div>
                                    {inlineTaskInput.initialSubtasks.length > 1 && (
                                      <button type="button" onClick={() => setInlineTaskInput(prev => ({ ...prev, initialSubtasks: prev.initialSubtasks.filter((_, i) => i !== idx) }))} className="text-neutral-400 hover:text-red-500 p-0.5 cursor-pointer">
                                        <X className="w-3 h-3" />
                                      </button>
                                    )}
                                  </div>
                                ))}
                                <button type="button" onClick={() => setInlineTaskInput(prev => ({ ...prev, initialSubtasks: [...prev.initialSubtasks, ''] }))} className="text-xs font-bold text-black bg-neutral-100 border border-neutral-300 hover:bg-neutral-200 px-2 py-0.5 rounded-lg transition cursor-pointer">
                                  + Sub-task
                                </button>
                              </div>
                            </div>
                          )}
                        </motion.div>
                      )}

                      {/* ── Task List ───────────────────────────────────────────────── */}
                      {blockTasks.length === 0 ? (
                        <div
                          className={`text-center py-5 border border-dashed rounded-2xl transition-colors ${isDragTarget ? 'border-black bg-neutral-50' : 'border-neutral-200 bg-neutral-50/50'}`}
                          onDragOver={e => handleDragOverBlock(e, block)}
                          onDrop={e => handleDropOnBlock(e, block)}
                        >
                          <p className="text-xs font-medium text-neutral-400">
                            {isDragTarget ? 'Drop task here →' : `No tasks scheduled for ${meta.label.toLowerCase()}.`}
                          </p>
                          {!isDragTarget && (
                            <button
                              type="button"
                              onClick={() => setInlineTaskInput({ block, text: '', scheduledTime: '', taskType: 'standard', initialSubtasks: [''], customChoices: DEFAULT_SPORTS_OPTIONS, newChoiceInput: '', recurrenceType: 'none', reminderTime: '' })}
                              className="mt-1.5 text-xs font-bold text-black underline underline-offset-4 hover:opacity-75 cursor-pointer"
                            >
                              + Add a task
                            </button>
                          )}
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {blockTasks.map((task) => {
                            const isExpandable     = task.type === 'group' || task.type === 'choice';
                            const isTaskExpanded   = expandedTaskIds[task.id];
                            const subtasks         = task.subtasks || [];
                            const completedSubsCount = subtasks.filter(s => s.completed).length;
                            const isDragging       = dragState.draggingId === task.id;
                            const isDraggedOver    = dragState.dragOverId === task.id;
                            const isRecurring      = !!task.recurrenceTemplateId || task.isRecurrenceTemplate;

                            return (
                              <div
                                key={task.id}
                                draggable
                                onDragStart={e => handleDragStart(e, task.id)}
                                onDragEnd={handleDragEnd}
                                onDragOver={e => handleDragOverTask(e, task.id, block)}
                                onDrop={e => handleDropOnTask(e, task.id, block)}
                                className={`group relative rounded-xl border transition-all duration-150 overflow-hidden ${
                                  isDragging
                                    ? 'opacity-40 scale-[0.98] border-black shadow-none'
                                    : isDraggedOver
                                    ? 'border-black ring-2 ring-black/20 shadow-md -translate-y-0.5'
                                    : task.completed
                                    ? 'bg-neutral-50/80 border-neutral-200'
                                    : 'bg-white border-neutral-200 hover:border-black/30 shadow-xs'
                                }`}
                              >
                                {/* Drag insertion indicator */}
                                {isDraggedOver && (
                                  <div className="absolute top-0 left-0 right-0 h-0.5 bg-black rounded-full" />
                                )}

                                {/* Task Row */}
                                <div
                                  onClick={() => { if (isExpandable) toggleExpandTask(task.id); }}
                                  className={`px-3 py-2.5 flex items-center justify-between gap-2.5 select-none ${isExpandable ? 'cursor-pointer hover:bg-neutral-50/60' : ''}`}
                                >
                                  {/* Drag Handle */}
                                  <div
                                    className="opacity-0 group-hover:opacity-60 hover:!opacity-100 transition-opacity shrink-0 cursor-grab active:cursor-grabbing touch-manipulation"
                                    title="Drag to reorder"
                                    onClick={e => e.stopPropagation()}
                                  >
                                    <GripVertical className="w-4 h-4 text-neutral-400" />
                                  </div>

                                  {/* Left: Chevron + Time + Title */}
                                  <div className="flex items-center gap-2 flex-1 min-w-0">
                                    {isExpandable && (
                                      <span className="w-5 h-5 rounded bg-neutral-100 text-black flex items-center justify-center shrink-0">
                                        {isTaskExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                                      </span>
                                    )}

                                    {task.scheduledTime && (
                                      <span className="bg-black text-white text-[10px] font-mono font-bold px-2 py-0.5 rounded-md flex items-center gap-1 shrink-0 shadow-2xs">
                                        <Clock className="w-3 h-3 text-amber-400" />
                                        {task.scheduledTime}
                                      </span>
                                    )}

                                    <div className="flex items-center gap-1.5 flex-1 min-w-0">
                                      {task.type === 'group' && <span className="text-xs shrink-0">📁</span>}
                                      {task.type === 'choice' && (
                                        <span className="text-xs shrink-0">
                                          {task.selectedOption ? (SPORTS_ICONS_MAP[task.selectedOption] || '🏸') : '🏆'}
                                        </span>
                                      )}

                                      <span
                                        title={task.title}
                                        className={`text-xs sm:text-sm font-bold tracking-tight min-w-0 truncate ${task.completed ? 'line-through text-neutral-400 opacity-60' : 'text-neutral-900'}`}
                                      >
                                        {task.title}
                                      </span>

                                      {task.type === 'group' && (
                                        <span className="text-[10px] font-extrabold text-black bg-neutral-100 border border-neutral-300 px-1.5 py-0.5 rounded shrink-0">
                                          ({completedSubsCount}/{subtasks.length})
                                        </span>
                                      )}

                                      {task.type === 'choice' && task.selectedOption && (
                                        <span className="text-[10px] font-extrabold text-black bg-neutral-100 border border-neutral-300 px-1.5 py-0.5 rounded shrink-0">
                                          • {task.selectedOption}
                                        </span>
                                      )}

                                      {/* Recurring badge */}
                                      {isRecurring && (
                                        <span
                                          className="text-[9px] font-black text-amber-700 bg-amber-100 border border-amber-200 px-1.5 py-0.5 rounded-full flex items-center gap-0.5 shrink-0 cursor-pointer hover:bg-amber-200 transition"
                                          title="Recurring task – click to delete series"
                                          onClick={e => {
                                            e.stopPropagation();
                                            if (window.confirm('Delete this entire recurring series?')) handleDeleteTask(task.id, true);
                                          }}
                                        >
                                          <Repeat2 className="w-2.5 h-2.5" />
                                          {task.recurrence?.type || 'Recurring'}
                                        </span>
                                      )}

                                      {/* Reminder badge */}
                                      {task.recurrence?.reminderTime && (
                                        <span className="text-[9px] font-bold text-amber-600 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded-full flex items-center gap-0.5 shrink-0">
                                          <Bell className="w-2.5 h-2.5" />
                                          {task.recurrence.reminderTime}
                                        </span>
                                      )}
                                    </div>
                                  </div>

                                  {/* Right: quick select, arrows, delete, checkbox */}
                                  <div className="flex items-center gap-1.5 shrink-0 ml-auto" onClick={e => e.stopPropagation()}>
                                    {task.type === 'choice' && !task.selectedOption && (
                                      <button
                                        type="button"
                                        onClick={() => toggleExpandTask(task.id)}
                                        className="text-[10px] font-extrabold text-black bg-neutral-100 hover:bg-black hover:text-white border border-neutral-300 px-2 py-0.5 rounded-md transition cursor-pointer shrink-0"
                                      >
                                        Select Sport ▾
                                      </button>
                                    )}

                                    {/* Arrow reorder buttons */}
                                    <div className="opacity-80 sm:opacity-0 group-hover:opacity-100 transition-opacity duration-150 flex items-center gap-0 bg-neutral-100/80 border border-neutral-200/80 rounded-lg p-0.5 shrink-0">
                                      <button type="button" onClick={() => handleMoveTask(task.id, 'up')} className="text-neutral-500 hover:text-black active:scale-90 active:bg-neutral-200 p-0.5 rounded-md hover:bg-neutral-200 transition-all cursor-pointer touch-manipulation" title="Move up">
                                        <ChevronUp className="w-3.5 h-3.5" />
                                      </button>
                                      <button type="button" onClick={() => handleMoveTask(task.id, 'down')} className="text-neutral-500 hover:text-black active:scale-90 active:bg-neutral-200 p-0.5 rounded-md hover:bg-neutral-200 transition-all cursor-pointer touch-manipulation" title="Move down">
                                        <ChevronDown className="w-3.5 h-3.5" />
                                      </button>
                                    </div>

                                    {task.type === 'group' && (
                                      <button
                                        type="button"
                                        onClick={() => saveGroupAsTemplate(task)}
                                        className="text-neutral-300 hover:text-amber-600 p-1 sm:p-0.5 hover:bg-amber-50 rounded transition cursor-pointer touch-manipulation"
                                        title="Save as reusable group"
                                      >
                                        <Star className="w-3.5 h-3.5" />
                                      </button>
                                    )}

                                    {task.type === 'standard' && (
                                      <button
                                        type="button"
                                        onClick={() => saveStandardTaskAsTemplate(task)}
                                        className="text-neutral-300 hover:text-amber-600 p-1 sm:p-0.5 hover:bg-amber-50 rounded transition cursor-pointer touch-manipulation"
                                        title="Save as reusable task"
                                      >
                                        <Star className="w-3.5 h-3.5" />
                                      </button>
                                    )}

                                    <button
                                      type="button"
                                      onClick={() => handleDeleteTask(task.id, false)}
                                      className="text-neutral-300 hover:text-red-500 p-1 sm:p-0.5 hover:bg-neutral-100 rounded transition cursor-pointer touch-manipulation"
                                      title="Delete task"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>

                                    <div
                                      onClick={() => handleToggleTask(task.id)}
                                      className={`w-5.5 h-5.5 rounded-md border-2 flex items-center justify-center cursor-pointer transition-all duration-200 ${
                                        task.completed ? 'bg-black border-black text-white scale-105 shadow-2xs' : 'border-neutral-300 bg-white hover:border-black'
                                      }`}
                                      title={task.completed ? 'Mark incomplete' : 'Mark complete'}
                                    >
                                      {task.completed && <Check className="w-3.5 h-3.5 stroke-[3px]" />}
                                    </div>
                                  </div>
                                </div>

                                {/* Group progress bar */}
                                {task.type === 'group' && subtasks.length > 0 && (
                                  <div className="w-full bg-neutral-100 h-0.5 overflow-hidden">
                                    <div className="bg-black h-full transition-all duration-300" style={{ width: `${Math.round((completedSubsCount / subtasks.length) * 100)}%` }} />
                                  </div>
                                )}

                                {/* Expandable body */}
                                <AnimatePresence>
                                  {isExpandable && isTaskExpanded && (
                                    <motion.div
                                      initial={{ height: 0, opacity: 0 }}
                                      animate={{ height: 'auto', opacity: 1 }}
                                      exit={{ height: 0, opacity: 0 }}
                                      transition={{ duration: 0.15, ease: 'easeInOut' }}
                                      className="border-t border-neutral-100 bg-neutral-50/70 p-3 space-y-2.5"
                                    >
                                      {/* Group Sub-tasks */}
                                      {task.type === 'group' && (
                                        <div className="space-y-2">
                                          <div className="flex items-center justify-between">
                                            <span className="text-[10px] font-extrabold text-neutral-500 uppercase tracking-wider">
                                              Sub-tasks ({completedSubsCount}/{subtasks.length} done):
                                            </span>
                                          </div>
                                          <div className="space-y-1.5">
                                            {subtasks.map((st, sIdx) => (
                                              <div
                                                key={st.id}
                                                onClick={() => handleToggleSubtask(task.id, st.id)}
                                                className="group/sub flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-white border border-neutral-200 hover:border-black/40 transition cursor-pointer"
                                              >
                                                <span className={`text-xs font-bold ${st.completed ? 'line-through text-neutral-400 opacity-60' : 'text-black'}`}>
                                                  {st.title}
                                                </span>
                                                <div className="flex items-center gap-1.5 shrink-0">
                                                  <div className="opacity-80 sm:opacity-0 group-hover/sub:opacity-100 flex items-center gap-0 bg-neutral-100/80 border border-neutral-200/80 rounded-md p-0.5 transition-opacity shrink-0">
                                                    <button type="button" disabled={sIdx === 0} onClick={e => { e.stopPropagation(); handleMoveSubtask(task.id, st.id, 'up'); }} className="text-neutral-500 hover:text-black disabled:opacity-20 p-0.5 cursor-pointer rounded hover:bg-neutral-200 active:scale-90 transition-all touch-manipulation" title="Move Up">
                                                      <ChevronUp className="w-3.5 h-3.5" />
                                                    </button>
                                                    <button type="button" disabled={sIdx === subtasks.length - 1} onClick={e => { e.stopPropagation(); handleMoveSubtask(task.id, st.id, 'down'); }} className="text-neutral-500 hover:text-black disabled:opacity-20 p-0.5 cursor-pointer rounded hover:bg-neutral-200 active:scale-90 transition-all touch-manipulation" title="Move Down">
                                                      <ChevronDown className="w-3.5 h-3.5" />
                                                    </button>
                                                  </div>
                                                  <button type="button" onClick={e => { e.stopPropagation(); handleDeleteSubtask(task.id, st.id); }} className="text-neutral-300 hover:text-red-500 p-0.5 hover:bg-neutral-100 rounded transition cursor-pointer" title="Delete subtask">
                                                    <Trash2 className="w-3 h-3" />
                                                  </button>
                                                  <div className={`w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 transition-all ${st.completed ? 'bg-black border-black text-white' : 'border-neutral-300 bg-white'}`}>
                                                    {st.completed && <Check className="w-3 h-3 stroke-[3px]" />}
                                                  </div>
                                                </div>
                                              </div>
                                            ))}
                                          </div>
                                          {newSubtaskInput.taskId === task.id ? (
                                            <div className="flex items-center gap-2 pt-1">
                                              <input
                                                type="text" autoFocus placeholder="New sub-task..."
                                                value={newSubtaskInput.text}
                                                onChange={e => setNewSubtaskInput({ taskId: task.id, text: e.target.value })}
                                                onKeyDown={e => { if (e.key === 'Enter') handleAddSubtaskToGroup(task.id); if (e.key === 'Escape') setNewSubtaskInput({ taskId: null, text: '' }); }}
                                                className="flex-1 bg-white border border-neutral-300 rounded-lg px-2.5 py-1 text-xs font-bold text-black focus:outline-none focus:border-black"
                                              />
                                              <button type="button" onClick={() => handleAddSubtaskToGroup(task.id)} className="bg-black text-white text-xs font-bold px-3 py-1 rounded-lg cursor-pointer">Add</button>
                                            </div>
                                          ) : (
                                            <button type="button" onClick={() => setNewSubtaskInput({ taskId: task.id, text: '' })} className="text-[11px] font-bold text-black hover:opacity-75 underline underline-offset-4 cursor-pointer block pt-0.5">
                                              + Add sub-task
                                            </button>
                                          )}
                                        </div>
                                      )}

                                      {/* Choice Selector */}
                                      {task.type === 'choice' && (
                                        <div className="space-y-2">
                                          <span className="text-[10px] font-extrabold text-neutral-500 uppercase tracking-wider block">Select Option:</span>
                                          <div className="flex flex-wrap items-center gap-1.5">
                                            {(task.options || DEFAULT_SPORTS_OPTIONS).map(opt => {
                                              const isSelected = task.selectedOption === opt;
                                              return (
                                                <button
                                                  key={opt} type="button"
                                                  onClick={() => handleSelectOption(task.id, opt)}
                                                  className={`text-[11px] font-bold px-2.5 py-1 rounded-lg border transition-all cursor-pointer flex items-center gap-1 ${isSelected ? 'bg-black text-white border-black shadow-2xs' : 'bg-white text-neutral-700 border-neutral-200 hover:border-black hover:bg-neutral-50'}`}
                                                >
                                                  <span>{SPORTS_ICONS_MAP[opt] || '🏆'}</span>
                                                  <span>{opt}</span>
                                                  {isSelected && <Check className="w-3 h-3 stroke-[3px] ml-0.5 text-white" />}
                                                </button>
                                              );
                                            })}
                                          </div>
                                          {newChoiceTaskOptionInput.taskId === task.id ? (
                                            <div className="flex items-center gap-2 pt-1 border-t border-neutral-200">
                                              <input
                                                type="text" autoFocus placeholder="New option..."
                                                value={newChoiceTaskOptionInput.text}
                                                onChange={e => setNewChoiceTaskOptionInput({ taskId: task.id, text: e.target.value })}
                                                onKeyDown={e => { if (e.key === 'Enter') handleAddOptionToChoiceTask(task.id); if (e.key === 'Escape') setNewChoiceTaskOptionInput({ taskId: null, text: '' }); }}
                                                className="flex-1 bg-white border border-neutral-300 rounded-lg px-2.5 py-1 text-xs font-bold text-black focus:outline-none focus:border-black"
                                              />
                                              <button type="button" onClick={() => handleAddOptionToChoiceTask(task.id)} className="bg-black hover:bg-neutral-800 text-white text-xs font-bold px-3 py-1 rounded-lg cursor-pointer">Add</button>
                                            </div>
                                          ) : (
                                            <button type="button" onClick={() => setNewChoiceTaskOptionInput({ taskId: task.id, text: '' })} className="text-[11px] font-bold text-black hover:opacity-75 underline underline-offset-4 cursor-pointer block pt-0.5">
                                              + Add custom option
                                            </button>
                                          )}
                                        </div>
                                      )}
                                    </motion.div>
                                  )}
                                </AnimatePresence>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
        </div>
        </div>

        {/* ── Right Column: Daily Notes Panel ──────────────────────── */}
        <div id="weekly-planning-notes-section" className="lg:col-span-5 xl:col-span-4 sticky top-6 space-y-4">
          <div className="bg-white border border-neutral-200 rounded-2xl overflow-hidden shadow-xs font-sans">

            {/* Panel Header */}
            <div className="flex items-center justify-between gap-2 px-4 py-3.5 border-b border-neutral-100">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-black text-white flex items-center justify-center shrink-0">
                  <FileText className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="text-sm font-black text-black tracking-tight">Daily Notes</h2>
                  <p className="text-[10px] font-medium text-neutral-400">
                    Shared across all days
                  </p>
                </div>
              </div>
              {(dailyNote || '').trim().length > 0 && (
                <span className="text-[10px] font-black bg-emerald-50 text-emerald-700 px-2.5 py-1 rounded-full border border-emerald-200 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" />
                  Saved
                </span>
              )}
            </div>

            {/* Single unified daily note */}
            {(() => {
              const savedText = dailyNote;
              const draftText = dailyNoteDraft ?? savedText;
              const isDirty = draftText !== savedText;
              const hasContent = savedText.trim().length > 0;
              return (
                <div className="px-4 py-4 space-y-3">
                  {/* Helper tip */}
                  <p className="text-[11px] font-medium text-neutral-400 leading-relaxed">
                    Jot down anything important — goals, reminders, reflections, or focus points. This note is shared across all days.
                  </p>

                  {/* Textarea */}
                  <textarea
                    rows={10}
                    placeholder={`Write your notes here...\n\n• Goals\n• Things to remember\n• Reflections\n• Ideas`}
                    value={draftText}
                    onChange={e => setDailyNoteDraft(e.target.value)}
                    className="w-full bg-neutral-50 border border-neutral-200 focus:border-black focus:bg-white rounded-xl px-3.5 py-3 text-xs font-medium text-black placeholder:text-neutral-400 focus:outline-none transition resize-none leading-relaxed"
                  />

                  {/* Action Row */}
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleSaveDailyNote}
                      disabled={!isDirty && !hasContent}
                      className={`flex-1 h-9 rounded-xl text-[11px] font-black flex items-center justify-center gap-1.5 transition cursor-pointer disabled:opacity-40 disabled:cursor-default active:scale-95 ${
                        isDirty ? 'bg-black hover:bg-neutral-800 text-white shadow-xs' : 'bg-neutral-100 text-neutral-500 hover:bg-neutral-200'
                      }`}
                    >
                      <Check className="w-3.5 h-3.5 stroke-[3]" />
                      {isDirty ? 'Save Note' : 'Saved'}
                    </button>
                    {hasContent && (
                      <button
                        type="button"
                        onClick={handleClearDailyNote}
                        className="h-9 w-9 rounded-xl border border-neutral-200 text-neutral-400 hover:text-rose-600 hover:border-rose-200 flex items-center justify-center transition cursor-pointer"
                        title="Clear note"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })()}

          </div>
        </div>
      </div>

      {/* ── Protein Target Change Modal ────────────────────────────────────── */}
      <AnimatePresence>
        {showTargetModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white border border-neutral-200 rounded-3xl shadow-2xl max-w-md w-full p-5 space-y-4"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-center justify-between border-b border-neutral-100 pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-10 h-10 rounded-2xl bg-black text-white flex items-center justify-center text-lg font-black shrink-0">
                    🥩
                  </div>
                  <div>
                    <h3 className="text-base font-black text-black">Change Protein Target</h3>
                    <p className="text-[11px] text-neutral-400 font-medium">Adjust total daily goal & per-block targets</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowTargetModal(false)}
                  className="w-8 h-8 rounded-xl bg-neutral-100 hover:bg-neutral-200 text-neutral-600 flex items-center justify-center transition cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Quick Target Presets */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase tracking-wider text-neutral-400">Quick Daily Presets:</label>
                <div className="flex items-center gap-1.5 flex-wrap">
                  {[100, 120, 140, 150, 180, 200, 220].map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => autoSplitTargetModalDraft(preset)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-black transition cursor-pointer ${
                        Number(targetModalDraft.totalProtein) === preset
                          ? 'bg-black text-white shadow-xs'
                          : 'bg-neutral-100 hover:bg-neutral-200 text-neutral-800'
                      }`}
                    >
                      {preset}g
                    </button>
                  ))}
                </div>
              </div>

              {/* Total Daily Target Input */}
              <div className="space-y-1">
                <label className="text-[11px] font-black text-black">Total Daily Protein Target (g):</label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="1"
                    max="1000"
                    value={targetModalDraft.totalProtein}
                    onChange={e => {
                      const val = e.target.value;
                      setTargetModalDraft(prev => ({ ...prev, totalProtein: val }));
                      const num = Number(val);
                      if (Number.isFinite(num) && num > 0) {
                        autoSplitTargetModalDraft(num);
                      }
                    }}
                    className="flex-1 h-10 rounded-2xl border border-neutral-300 px-3 text-sm font-black text-black focus:outline-none focus:border-black"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const num = Number(targetModalDraft.totalProtein) || 150;
                      autoSplitTargetModalDraft(num);
                    }}
                    className="h-10 px-3 rounded-2xl bg-neutral-100 hover:bg-black hover:text-white text-xs font-bold transition cursor-pointer"
                    title="Auto split 25% AM / 35% PM / 30% Eve / 10% Night"
                  >
                    Auto Split ⚡
                  </button>
                </div>
              </div>

              {/* Custom Per-Block Targets */}
              <div className="space-y-2 pt-2 border-t border-neutral-100">
                <label className="text-[10px] font-black uppercase tracking-wider text-neutral-400">Custom Per-Block Targets:</label>
                <div className="grid grid-cols-2 gap-2.5">
                  {(['Morning', 'Afternoon', 'Evening', 'Night'] as TimeBlock[]).map(b => {
                    const keyMap: Record<TimeBlock, keyof typeof targetModalDraft> = {
                      Morning: 'morningProtein',
                      Afternoon: 'afternoonProtein',
                      Evening: 'eveningProtein',
                      Night: 'nightProtein',
                    };
                    const key = keyMap[b];
                    return (
                      <div key={b} className="p-2.5 rounded-2xl border border-neutral-200 bg-neutral-50 space-y-1">
                        <div className="text-[10px] font-black text-neutral-600 uppercase">{b}</div>
                        <div className="flex items-center gap-1">
                          <input
                            type="number"
                            min="0"
                            value={targetModalDraft[key]}
                            onChange={e => setTargetModalDraft(prev => ({ ...prev, [key]: e.target.value }))}
                            className="w-full h-8 rounded-xl border border-neutral-300 bg-white px-2 text-xs font-black text-center focus:outline-none focus:border-black"
                          />
                          <span className="text-[10px] font-bold text-neutral-400">g</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center justify-end gap-2 pt-2 border-t border-neutral-100">
                <button
                  type="button"
                  onClick={() => setShowTargetModal(false)}
                  className="h-10 px-4 rounded-2xl border border-neutral-300 text-xs font-bold text-neutral-600 hover:bg-neutral-100 transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveTargetModal}
                  className="h-10 px-5 rounded-2xl bg-black text-white text-xs font-black hover:bg-neutral-800 transition cursor-pointer shadow-xs active:scale-95 flex items-center gap-1.5"
                >
                  <Check className="w-4 h-4 stroke-[3]" />
                  <span>Save Target</span>
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

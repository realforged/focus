export type Category = 'Fitness' | 'Nutrition' | 'Career' | 'Recovery' | 'Mind';

export interface NutritionTargets {
  protein: number;
  carbs: number;
  fats: number;
  fiber: number;
  calories: number;
  morningProtein?: number;
  afternoonProtein?: number;
  eveningProtein?: number;
  nightProtein?: number;
}

export interface PillarGoal {
  id: string;
  title: string;
  pillar: Category;
  desc: string;
  target?: string;
  createdAt: string;
}

export interface PillarNote {
  id: string;
  pillar: Category;
  title?: string;
  content: string;
  date: string;
  createdAt: string;
}

export interface LoggedFood {
  id: string;
  name: string;
  protein: number;
  carbs: number;
  fats: number;
  fiber: number;
  calories: number;
  timestamp: string;
  date?: string;
  mealType?: 'Breakfast' | 'Lunch' | 'Dinner' | 'Snack' | 'Morning' | 'Afternoon' | 'Evening' | 'Night';
}

export type HabitType = 'Count' | 'Timer';

export interface HabitLogEntry {
  date: string; // YYYY-MM-DD
  value: number; // amount logged
  pointsEarned: number;
}

export interface Habit {
  id: string;
  name: string;
  category: Category;
  points: number; // points per completion / increment
  type: HabitType;
  target: number; // e.g. 300 count, 30 min
  unit: string; // "reps", "min", "km", etc.
  repeat: 'Daily' | 'Custom Days' | 'Today Only';
  repeatDays?: number[]; // 0 for Sunday, 1 for Monday, etc.
  timeOfDay?: string; // "HH:MM" format
  timeBlock?: 'Anytime' | 'Morning' | 'Afternoon' | 'Evening' | 'Night';
  enableFocusTimer: boolean;
  routineId?: string; // links to parent routine if created via routine builder
  createdAt: string;
  // History tracking
  history: {
    [dateStr: string]: number; // date string -> amount logged on that day
  };
}

export interface Routine {
  id: string;
  name: string;
  points: number; // points awarded upon completing the entire routine list
  timeBlock: 'Morning' | 'Afternoon' | 'Evening' | 'Night' | 'Constant';
  repeat: 'Daily' | 'Custom Days' | 'Today Only';
  repeatDays?: number[];
  habitIds: string[]; // sequence of habit IDs inside this routine
  completedHistory: {
    [dateStr: string]: boolean; // tracks if the entire routine was fully completed on a specific day
  };
}

export type MomentumStateName = 'INERTIA' | 'IGNITE' | 'FLOW' | 'LOCKED';

export interface DailySummary {
  date: string; // YYYY-MM-DD
  progressPercent: number; // overall habits completion % (0-100)
  momentumScore: number; // computed rolling momentum index
  signalValue: number; // progressive '1% better' signal index
  habitsDone: number;
  habitsTotal: number;
  pointsEarned: number;
}

export interface UserStats {
  totalPoints: number;
  momentumScore: number; // current live score
  lockedInDays: number; // progress toward lock in (e.g. 0-4 days)
  consecutiveLockedInStreak: number; // overall streak of locked-in days
  dailySummaries: {
    [dateStr: string]: {
      habitsDone: number;
      habitsTotal: number;
      pointsEarned: number;
      progressPercent: number;
    };
  };
}

// ─── JOURNAL DOMAIN TYPES ──────────────────────────────────────────────────

export type JournalQuestionType = 'yes_no' | 'rating' | 'number' | 'short_text' | 'long_text';

export interface JournalQuestion {
  id: string;
  pillarId: string;
  text: string;
  type: JournalQuestionType;
  unit?: string;
  enabled: boolean;
  order: number;
}

export interface JournalPillar {
  id: string;
  name: string;
  icon?: string;
  color?: string;
  order: number;
  questions: JournalQuestion[];
}

export interface JournalFinalReflection {
  learned?: string;
  created?: string;
  doBetter?: string;
  doDifferentlyTomorrow?: string;
  futureMeThanks?: string;
  score?: number; // 1 to 10
  tomorrowPriority?: string;
}

export interface JournalEntry {
  id: string;
  date: string; // YYYY-MM-DD
  answers: Record<string, any>; // questionId -> answer
  pillarSnapshot: JournalPillar[]; // questions & pillars snapshot at time of completion
  finalReflection: JournalFinalReflection;
  score: number; // 1 to 10
  tomorrowPriority: string;
  isCompleted: boolean;
  createdAt: string;
  updatedAt: string;
}


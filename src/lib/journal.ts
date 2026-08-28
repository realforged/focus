import { JournalPillar, JournalQuestion, JournalEntry } from '../types';

export const JOURNAL_PILLARS_STORAGE_KEY = 'focus_now_journal_pillars_config_v1';
export const JOURNAL_ENTRIES_STORAGE_KEY = 'focus_now_journal_entries_v1';
export const DAILY_PRIORITIES_STORAGE_KEY = 'focus_now_daily_priorities_v1';

export const DEFAULT_JOURNAL_PILLARS: JournalPillar[] = [
  {
    id: 'pillar_body',
    name: 'BODY',
    icon: '🧍',
    color: '#10B981', // emerald
    order: 0,
    questions: [
      {
        id: 'q_body_1',
        pillarId: 'pillar_body',
        text: 'Did I move my body today?',
        type: 'yes_no',
        enabled: true,
        order: 0,
      },
      {
        id: 'q_body_2',
        pillarId: 'pillar_body',
        text: 'Did I hit my protein goal?',
        type: 'yes_no',
        enabled: true,
        order: 1,
      },
      {
        id: 'q_body_3',
        pillarId: 'pillar_body',
        text: 'Did I protect my sleep and recovery?',
        type: 'yes_no',
        enabled: true,
        order: 2,
      },
    ],
  },
  {
    id: 'pillar_mind',
    name: 'MIND',
    icon: '🧠',
    color: '#6366F1', // indigo
    order: 1,
    questions: [
      {
        id: 'q_mind_1',
        pillarId: 'pillar_mind',
        text: 'Did I learn something today?',
        type: 'short_text',
        enabled: true,
        order: 0,
      },
      {
        id: 'q_mind_2',
        pillarId: 'pillar_mind',
        text: 'Did I get meaningful distraction-free focus time?',
        type: 'yes_no',
        enabled: true,
        order: 1,
      },
      {
        id: 'q_mind_3',
        pillarId: 'pillar_mind',
        text: 'Did I read today?',
        type: 'yes_no',
        enabled: true,
        order: 2,
      },
    ],
  },
  {
    id: 'pillar_build',
    name: 'BUILD',
    icon: '💻',
    color: '#0EA5E9', // sky
    order: 2,
    questions: [
      {
        id: 'q_build_1',
        pillarId: 'pillar_build',
        text: 'Did I create something today?',
        type: 'yes_no',
        enabled: true,
        order: 0,
      },
      {
        id: 'q_build_2',
        pillarId: 'pillar_build',
        text: 'What did I create or make progress on?',
        type: 'short_text',
        enabled: true,
        order: 1,
      },
      {
        id: 'q_build_3',
        pillarId: 'pillar_build',
        text: 'What technical skill or idea did I improve today?',
        type: 'short_text',
        enabled: true,
        order: 2,
      },
    ],
  },
  {
    id: 'pillar_relationships',
    name: 'RELATIONSHIPS',
    icon: '🤝',
    color: '#EC4899', // pink
    order: 3,
    questions: [
      {
        id: 'q_rel_1',
        pillarId: 'pillar_relationships',
        text: 'Did I genuinely connect with someone today?',
        type: 'yes_no',
        enabled: true,
        order: 0,
      },
      {
        id: 'q_rel_2',
        pillarId: 'pillar_relationships',
        text: "Did I make someone's day a little better?",
        type: 'yes_no',
        enabled: true,
        order: 1,
      },
    ],
  },
  {
    id: 'pillar_character',
    name: 'CHARACTER',
    icon: '🧭',
    color: '#F59E0B', // amber
    order: 4,
    questions: [
      {
        id: 'q_char_1',
        pillarId: 'pillar_character',
        text: 'Did I keep the promises I made to myself today?',
        type: 'yes_no',
        enabled: true,
        order: 0,
      },
      {
        id: 'q_char_2',
        pillarId: 'pillar_character',
        text: 'Did I control my distractions, or did they control me?',
        type: 'yes_no',
        enabled: true,
        order: 1,
      },
      {
        id: 'q_char_3',
        pillarId: 'pillar_character',
        text: "Did I do something difficult even when I didn't feel like doing it?",
        type: 'yes_no',
        enabled: true,
        order: 2,
      },
    ],
  },
  {
    id: 'pillar_life',
    name: 'LIFE',
    icon: '❤️',
    color: '#EF4444', // red/rose
    order: 5,
    questions: [
      {
        id: 'q_life_1',
        pillarId: 'pillar_life',
        text: 'What was the best moment of today?',
        type: 'short_text',
        enabled: true,
        order: 0,
      },
      {
        id: 'q_life_2',
        pillarId: 'pillar_life',
        text: 'What am I grateful for?',
        type: 'short_text',
        enabled: true,
        order: 1,
      },
      {
        id: 'q_life_3',
        pillarId: 'pillar_life',
        text: 'Did I enjoy something simply for the sake of enjoying it?',
        type: 'yes_no',
        enabled: true,
        order: 2,
      },
    ],
  },
];

// ─── Persistence Functions ─────────────────────────────────────────────────

export function getStoredJournalPillars(): JournalPillar[] {
  try {
    const raw = localStorage.getItem(JOURNAL_PILLARS_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch (e) {
    console.error('Failed to load journal pillars:', e);
  }
  return DEFAULT_JOURNAL_PILLARS;
}

export function saveStoredJournalPillars(pillars: JournalPillar[]): void {
  try {
    localStorage.setItem(JOURNAL_PILLARS_STORAGE_KEY, JSON.stringify(pillars));
    window.dispatchEvent(new CustomEvent('focus_now_journal_pillars_updated', { detail: pillars }));
  } catch (e) {
    console.error('Failed to save journal pillars:', e);
  }
}

export function getStoredJournalEntries(): Record<string, JournalEntry> {
  try {
    const raw = localStorage.getItem(JOURNAL_ENTRIES_STORAGE_KEY);
    if (raw) {
      return JSON.parse(raw);
    }
  } catch (e) {
    console.error('Failed to load journal entries:', e);
  }
  return {};
}

export function getJournalEntryForDate(dateStr: string): JournalEntry | null {
  const all = getStoredJournalEntries();
  return all[dateStr] || null;
}

export function saveJournalEntry(entry: JournalEntry): void {
  try {
    const all = getStoredJournalEntries();
    all[entry.date] = entry;
    localStorage.setItem(JOURNAL_ENTRIES_STORAGE_KEY, JSON.stringify(all));
    
    // Also sync tomorrow's priority if defined
    if (entry.tomorrowPriority && entry.tomorrowPriority.trim()) {
      const tomorrowDate = getTomorrowDateStr(entry.date);
      saveDailyPriority(tomorrowDate, entry.tomorrowPriority.trim());
    }

    window.dispatchEvent(new CustomEvent('focus_now_journal_updated', { detail: { date: entry.date, entry } }));
  } catch (e) {
    console.error('Failed to save journal entry:', e);
  }
}

export function getDailyPriority(dateStr: string): string {
  try {
    const raw = localStorage.getItem(DAILY_PRIORITIES_STORAGE_KEY);
    if (raw) {
      const map = JSON.parse(raw);
      if (map[dateStr]) return map[dateStr];
    }
  } catch (e) {
    console.error('Failed to read daily priority:', e);
  }
  return '';
}

export function saveDailyPriority(dateStr: string, priority: string): void {
  try {
    const raw = localStorage.getItem(DAILY_PRIORITIES_STORAGE_KEY);
    const map = raw ? JSON.parse(raw) : {};
    map[dateStr] = priority;
    localStorage.setItem(DAILY_PRIORITIES_STORAGE_KEY, JSON.stringify(map));
    window.dispatchEvent(new CustomEvent('focus_now_priority_updated', { detail: { date: dateStr, priority } }));
  } catch (e) {
    console.error('Failed to save daily priority:', e);
  }
}

export function getTomorrowDateStr(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  d.setDate(d.getDate() + 1);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

export function getYesterdayDateStr(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  d.setDate(d.getDate() - 1);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

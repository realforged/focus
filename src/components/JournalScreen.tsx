import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  BookOpen,
  Calendar as CalendarIcon,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Sliders,
  Sparkles,
  ArrowLeft,
  Check,
  RotateCcw,
  Pencil,
  Plus,
  Save,
  Star,
  Flame,
  Zap,
} from 'lucide-react';
import {
  JournalEntry,
  JournalPillar,
  JournalQuestion,
  JournalFinalReflection,
} from '../types';
import {
  getStoredJournalPillars,
  saveStoredJournalPillars,
  getStoredJournalEntries,
  getJournalEntryForDate,
  saveJournalEntry,
  getDailyPriority,
  getTomorrowDateStr,
} from '../lib/journal';
import JournalSettingsModal from './JournalSettingsModal';
import { formatDateString, dateToday } from '../data';

interface JournalScreenProps {
  currentUser?: any;
  userPoints?: number;
  initialDate?: string;
}

export default function JournalScreen({
  currentUser,
  userPoints,
  initialDate,
}: JournalScreenProps) {
  const [selectedDate, setSelectedDate] = useState<string>(initialDate || dateToday);
  const [activeView, setActiveView] = useState<'home' | 'entry'>('home');
  const [isReadOnly, setIsReadOnly] = useState<boolean>(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);

  // Pillars template state
  const [pillars, setPillars] = useState<JournalPillar[]>(() => getStoredJournalPillars());

  // All entries map: date -> JournalEntry
  const [entries, setEntries] = useState<Record<string, JournalEntry>>(() => getStoredJournalEntries());

  // Active form state for the selected date
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [finalReflection, setFinalReflection] = useState<JournalFinalReflection>({
    learned: '',
    created: '',
    doBetter: '',
    doDifferentlyTomorrow: '',
    futureMeThanks: '',
    score: 8,
    tomorrowPriority: '',
  });
  const [saveFeedback, setSaveFeedback] = useState<boolean>(false);

  // Sync listener for entries & pillars updates from other events
  useEffect(() => {
    const handleEntriesSync = () => {
      setEntries(getStoredJournalEntries());
    };
    const handlePillarsSync = (e: any) => {
      if (e.detail) {
        setPillars(e.detail);
      } else {
        setPillars(getStoredJournalPillars());
      }
    };

    window.addEventListener('focus_now_journal_updated', handleEntriesSync);
    window.addEventListener('focus_now_journal_pillars_updated', handlePillarsSync);
    window.addEventListener('storage', handleEntriesSync);

    return () => {
      window.removeEventListener('focus_now_journal_updated', handleEntriesSync);
      window.removeEventListener('focus_now_journal_pillars_updated', handlePillarsSync);
      window.removeEventListener('storage', handleEntriesSync);
    };
  }, []);

  // When selectedDate changes, load existing entry or set defaults
  useEffect(() => {
    const existing = entries[selectedDate];
    if (existing) {
      setAnswers(existing.answers || {});
      setFinalReflection(existing.finalReflection || {
        learned: '',
        created: '',
        doBetter: '',
        doDifferentlyTomorrow: '',
        futureMeThanks: '',
        score: existing.score || 8,
        tomorrowPriority: existing.tomorrowPriority || '',
      });
      // If it's a completed past entry and we just navigated to it from home, open in read-only by default
      if (selectedDate !== dateToday && existing.isCompleted) {
        setIsReadOnly(true);
      } else {
        setIsReadOnly(false);
      }
    } else {
      setAnswers({});
      // Auto-load tomorrow priority if already stored
      const tomorrowDate = getTomorrowDateStr(selectedDate);
      const existingTomorrowPriority = getDailyPriority(tomorrowDate);
      setFinalReflection({
        learned: '',
        created: '',
        doBetter: '',
        doDifferentlyTomorrow: '',
        futureMeThanks: '',
        score: 8,
        tomorrowPriority: existingTomorrowPriority || '',
      });
      setIsReadOnly(false);
    }
  }, [selectedDate, entries]);

  // Which pillars to display: If viewing an existing entry that has a pillarSnapshot, use that! Otherwise use current pillars.
  const activePillars: JournalPillar[] = useMemo(() => {
    const existing = entries[selectedDate];
    if (existing && existing.pillarSnapshot && existing.pillarSnapshot.length > 0) {
      return existing.pillarSnapshot;
    }
    return pillars;
  }, [entries, selectedDate, pillars]);

  // ── Date Helpers ─────────────────────────────────────────────────────────

  const formatHeaderDate = (dateStr: string) => {
    const d = new Date(dateStr + 'T00:00:00');
    return d.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const formatShortDate = (dateStr: string) => {
    const d = new Date(dateStr + 'T00:00:00');
    return {
      dayNum: d.getDate(),
      weekday: d.toLocaleDateString('en-US', { weekday: 'short' }),
      monthName: d.toLocaleDateString('en-US', { month: 'short' }),
      monthYear: d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
    };
  };

  // Generate a list of recent dates (e.g. past 14 days)
  const recentHistoryDates = useMemo(() => {
    const list: string[] = [];
    const base = new Date(dateToday + 'T00:00:00');
    for (let i = 1; i <= 30; i++) {
      const d = new Date(base);
      d.setDate(d.getDate() - i);
      list.push(formatDateString(d));
    }
    return list;
  }, []);

  const isToday = selectedDate === dateToday;
  const todayEntry = entries[dateToday];
  const currentEntry = entries[selectedDate];

  // ── Form Handlers ────────────────────────────────────────────────────────

  const handleAnswerChange = (questionId: string, val: any) => {
    if (isReadOnly) return;
    setAnswers(prev => ({
      ...prev,
      [questionId]: val,
    }));
  };

  const handleSaveJournal = () => {
    const now = new Date().toISOString();
    const entry: JournalEntry = {
      id: currentEntry?.id || 'journal_' + selectedDate,
      date: selectedDate,
      answers,
      // IMPORTANT: Freeze the active pillar configuration snapshot
      pillarSnapshot: activePillars,
      finalReflection,
      score: finalReflection.score || 8,
      tomorrowPriority: (finalReflection.tomorrowPriority || '').trim(),
      isCompleted: true,
      createdAt: currentEntry?.createdAt || now,
      updatedAt: now,
    };

    saveJournalEntry(entry);
    setEntries(prev => ({ ...prev, [selectedDate]: entry }));

    setSaveFeedback(true);
    setTimeout(() => {
      setSaveFeedback(false);
    }, 4000);
  };

  const handleOpenDate = (dateStr: string, readOnly = false) => {
    setSelectedDate(dateStr);
    setIsReadOnly(readOnly);
    setActiveView('entry');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleNavigateDay = (delta: number) => {
    const d = new Date(selectedDate + 'T00:00:00');
    d.setDate(d.getDate() + delta);
    const nextDate = formatDateString(d);
    setSelectedDate(nextDate);
  };

  return (
    <div className="w-full max-w-4xl mx-auto px-4 sm:px-6 py-6 pb-24 font-sans text-slate-800">
      
      {/* ── HEADER / NAVIGATION BAR ─────────────────────────────────────── */}
      <div className="flex items-center justify-between mb-8 pb-4 border-b border-slate-200/60">
        <div className="flex items-center gap-3">
          {activeView === 'entry' && (
            <button
              onClick={() => setActiveView('home')}
              className="p-2 rounded-2xl bg-white border border-slate-200 text-slate-500 hover:text-slate-900 hover:bg-slate-50 transition cursor-pointer shadow-xs"
              title="Back to Journal Home"
            >
              <ArrowLeft className="w-4 h-4 stroke-[2.5px]" />
            </button>
          )}
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-black text-slate-900 tracking-tight">Journal</h1>
              <span className="text-[10px] font-bold uppercase tracking-wider bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-full">
                Daily Reflection
              </span>
            </div>
            <p className="text-xs text-slate-400 font-medium mt-0.5">
              Reflect on your day · Audit your alignment · Prepare for tomorrow
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Settings Button */}
          <button
            onClick={() => setIsSettingsOpen(true)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-2xl bg-white border border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-50 transition cursor-pointer text-xs font-bold shadow-xs"
            title="Customize Pillars & Questions"
          >
            <Sliders className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Customize</span>
          </button>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* VIEW 1: JOURNAL HOME / TIMELINE                                        */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      {activeView === 'home' && (
        <div className="space-y-8 animate-fade-in">
          
          {/* TODAY'S PROMINENT HERO CARD */}
          <div className="relative overflow-hidden bg-white rounded-3xl border border-slate-200/80 p-6 sm:p-8 shadow-sm transition-all hover:shadow-md">
            <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-bl from-emerald-100/50 via-teal-50/20 to-transparent rounded-bl-full pointer-events-none" />

            <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-6">
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-xs font-black text-emerald-600 uppercase tracking-widest">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span>Today · {formatHeaderDate(dateToday)}</span>
                </div>
                <h2 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
                  How did you show up today?
                </h2>
                <p className="text-xs sm:text-sm text-slate-500 max-w-md leading-relaxed">
                  Take 5 minutes to complete your end-of-day reflection, score your alignment, and set tomorrow's #1 priority.
                </p>
                {todayEntry?.isCompleted && (
                  <div className="inline-flex items-center gap-1.5 text-xs font-black text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-1 rounded-full mt-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Completed for today · Score: {todayEntry.score}/10</span>
                  </div>
                )}
              </div>

              <div className="shrink-0 flex flex-col sm:items-end gap-2">
                <button
                  onClick={() => handleOpenDate(dateToday, false)}
                  className="w-full sm:w-auto px-6 py-3.5 rounded-2xl bg-slate-900 hover:bg-slate-800 text-white font-black text-xs uppercase tracking-wider transition-all shadow-lg shadow-slate-900/10 cursor-pointer flex items-center justify-center gap-2 group"
                >
                  <BookOpen className="w-4 h-4 text-emerald-400 group-hover:scale-110 transition" />
                  <span>{todayEntry?.isCompleted ? 'View / Edit Today’s Entry' : 'Continue Today’s Journal →'}</span>
                </button>
              </div>
            </div>
          </div>

          {/* PREVIOUS ENTRIES HISTORY */}
          <div className="space-y-4">
            <div className="flex items-center justify-between px-1">
              <h3 className="text-xs font-black uppercase tracking-widest text-slate-400">
                Journal History
              </h3>
              <span className="text-[11px] font-bold text-slate-400">
                {(Object.values(entries) as JournalEntry[]).filter(e => e?.isCompleted).length} Completed Reflections
              </span>
            </div>

            <div className="grid grid-cols-1 gap-2.5">
              {recentHistoryDates.map(dateStr => {
                const entry = entries[dateStr];
                const { dayNum, weekday, monthName, monthYear } = formatShortDate(dateStr);
                const isCompleted = entry?.isCompleted;

                return (
                  <div
                    key={dateStr}
                    onClick={() => handleOpenDate(dateStr, isCompleted ? true : false)}
                    className={`group px-5 py-4 rounded-2xl border transition-all flex items-center justify-between cursor-pointer select-none ${
                      isCompleted
                        ? 'bg-white border-slate-200/70 hover:border-slate-300 hover:shadow-xs'
                        : 'bg-slate-50/60 border-slate-200/50 hover:bg-white hover:border-slate-200'
                    }`}
                  >
                    <div className="flex items-center gap-4">
                      <div className="text-center w-12 shrink-0 py-1 bg-slate-100/80 rounded-xl group-hover:bg-slate-200/60 transition">
                        <div className="text-[10px] font-bold text-slate-400 uppercase leading-none">{weekday}</div>
                        <div className="text-base font-black text-slate-800 leading-tight mt-0.5">{dayNum}</div>
                        <div className="text-[9px] font-bold text-slate-400 uppercase leading-none">{monthName}</div>
                      </div>

                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="text-xs sm:text-sm font-bold text-slate-800">
                            {formatHeaderDate(dateStr).split(',')[0]}, {monthName} {dayNum}
                          </h4>
                          {isCompleted && (
                            <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-100 flex items-center gap-1">
                              <Check className="w-2.5 h-2.5 stroke-[3px]" /> Complete
                            </span>
                          )}
                        </div>
                        {entry?.tomorrowPriority ? (
                          <p className="text-xs text-slate-400 font-medium truncate max-w-xs sm:max-w-md mt-0.5">
                            Priority: <span className="text-slate-600 font-bold">{entry.tomorrowPriority}</span>
                          </p>
                        ) : (
                          <p className="text-[11px] text-slate-400 mt-0.5">
                            {isCompleted ? `Alignment Score: ${entry.score}/10` : 'No entry recorded'}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      {isCompleted && (
                        <span className="text-xs font-mono font-black text-slate-600 bg-slate-100 px-2.5 py-1 rounded-xl">
                          {entry.score}/10
                        </span>
                      )}
                      <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-slate-600 group-hover:translate-x-0.5 transition" />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* VIEW 2: DAILY GUIDED REFLECTION FORM                                    */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      {activeView === 'entry' && (
        <div className="space-y-8 animate-fade-in">
          
          {/* Top Date Navigator */}
          <div className="bg-white rounded-3xl p-5 sm:p-6 border border-slate-200/80 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <button
                onClick={() => handleNavigateDay(-1)}
                className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition cursor-pointer"
                title="Previous Day"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-lg sm:text-xl font-black text-slate-900 tracking-tight">
                    {formatHeaderDate(selectedDate)}
                  </h2>
                  {isToday && (
                    <span className="text-[10px] font-black uppercase tracking-wider bg-emerald-500 text-white px-2 py-0.5 rounded-full">
                      Today
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-400 font-medium">
                  {isReadOnly ? 'Viewing saved historical entry (Read-only)' : 'Take a few minutes to reflect on your day.'}
                </p>
              </div>

              <button
                onClick={() => handleNavigateDay(1)}
                className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition cursor-pointer"
                title="Next Day"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            <div className="flex items-center gap-2">
              {!isToday && (
                <button
                  onClick={() => setSelectedDate(dateToday)}
                  className="px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50 transition cursor-pointer"
                >
                  Go to Today
                </button>
              )}
              {isReadOnly && (
                <button
                  onClick={() => setIsReadOnly(false)}
                  className="px-3.5 py-1.5 rounded-xl bg-slate-900 text-white text-xs font-bold hover:bg-slate-800 transition cursor-pointer flex items-center gap-1.5"
                >
                  <Pencil className="w-3 h-3" />
                  <span>Edit Entry</span>
                </button>
              )}
            </div>
          </div>

          {/* Success Save Banner */}
          <AnimatePresence>
            {saveFeedback && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 flex items-center justify-between"
              >
                <div className="flex items-center gap-2 text-xs font-black">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>Journal complete ✓ Your reflection has been saved.</span>
                </div>
                <button
                  onClick={() => setActiveView('home')}
                  className="text-xs font-bold underline hover:text-emerald-900 cursor-pointer"
                >
                  Back to Overview
                </button>
              </motion.div>
            )}
          </AnimatePresence>

          {/* ── PILLARS & QUESTIONS SECTION ─────────────────────────────────── */}
          <div className="space-y-6">
            {activePillars.map(pillar => {
              const enabledQuestions = (pillar.questions || []).filter(q => q.enabled);
              if (enabledQuestions.length === 0) return null;

              return (
                <div
                  key={pillar.id}
                  className="bg-white rounded-3xl border border-slate-200/80 p-5 sm:p-6 shadow-xs space-y-4"
                >
                  {/* Pillar Header */}
                  <div className="flex items-center gap-2.5 pb-3 border-b border-slate-100">
                    <span className="text-lg">{pillar.icon || '✨'}</span>
                    <h3 className="text-sm font-black text-slate-900 tracking-wider uppercase">
                      {pillar.name}
                    </h3>
                  </div>

                  {/* Pillar Questions */}
                  <div className="space-y-4">
                    {enabledQuestions.map(q => {
                      const val = answers[q.id];

                      return (
                        <div key={q.id} className="space-y-2">
                          <label className="block text-xs font-bold text-slate-700">
                            {q.text}
                          </label>

                          {/* Render based on question type */}
                          {q.type === 'yes_no' && (
                            <div className="flex gap-2">
                              <button
                                type="button"
                                disabled={isReadOnly}
                                onClick={() => handleAnswerChange(q.id, true)}
                                className={`px-4 py-2 rounded-xl text-xs font-black transition cursor-pointer border ${
                                  val === true
                                    ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                                    : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                                } ${isReadOnly ? 'cursor-default opacity-80' : ''}`}
                              >
                                ✓ Yes
                              </button>
                              <button
                                type="button"
                                disabled={isReadOnly}
                                onClick={() => handleAnswerChange(q.id, false)}
                                className={`px-4 py-2 rounded-xl text-xs font-black transition cursor-pointer border ${
                                  val === false
                                    ? 'bg-slate-800 text-white border-slate-800 shadow-xs'
                                    : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                                } ${isReadOnly ? 'cursor-default opacity-80' : ''}`}
                              >
                                No
                              </button>
                            </div>
                          )}

                          {q.type === 'rating' && (
                            <div className="flex gap-1.5 sm:gap-2">
                              {[1, 2, 3, 4, 5].map(starVal => (
                                <button
                                  key={starVal}
                                  type="button"
                                  disabled={isReadOnly}
                                  onClick={() => handleAnswerChange(q.id, starVal)}
                                  className={`w-9 h-9 sm:w-10 sm:h-10 rounded-xl text-xs font-black transition cursor-pointer border flex items-center justify-center ${
                                    val === starVal
                                      ? 'bg-amber-400 text-slate-900 border-amber-400 shadow-xs'
                                      : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                                  } ${isReadOnly ? 'cursor-default' : ''}`}
                                >
                                  {starVal}
                                </button>
                              ))}
                            </div>
                          )}

                          {q.type === 'number' && (
                            <div className="flex items-center gap-2 max-w-xs">
                              <input
                                type="number"
                                disabled={isReadOnly}
                                value={val ?? ''}
                                onChange={e => handleAnswerChange(q.id, e.target.value)}
                                placeholder="0"
                                className="w-28 px-3.5 py-2 text-xs font-mono font-bold bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:bg-slate-100"
                              />
                              {q.unit && (
                                <span className="text-xs font-bold text-slate-400">{q.unit}</span>
                              )}
                            </div>
                          )}

                          {q.type === 'short_text' && (
                            <input
                              type="text"
                              disabled={isReadOnly}
                              value={val ?? ''}
                              onChange={e => handleAnswerChange(q.id, e.target.value)}
                              placeholder="Write something..."
                              className="w-full px-3.5 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:bg-slate-100"
                            />
                          )}

                          {q.type === 'long_text' && (
                            <textarea
                              rows={3}
                              disabled={isReadOnly}
                              value={val ?? ''}
                              onChange={e => handleAnswerChange(q.id, e.target.value)}
                              placeholder="Write your thoughts..."
                              className="w-full px-3.5 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:bg-slate-100 resize-none"
                            />
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>

          {/* ── FINAL REFLECTION / END OF DAY SECTION ─────────────────────── */}
          <div className="bg-white rounded-3xl border border-slate-200/80 p-5 sm:p-7 shadow-xs space-y-6">
            <div className="pb-3 border-b border-slate-100">
              <h3 className="text-base font-black text-slate-900 uppercase tracking-tight flex items-center gap-2">
                <span>End of Day Reflection</span>
              </h3>
              <p className="text-xs text-slate-400 font-medium mt-0.5">
                Look back on what made today meaningful.
              </p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-black uppercase tracking-wider text-slate-600 mb-1.5">
                  What did I learn today?
                </label>
                <textarea
                  rows={2}
                  disabled={isReadOnly}
                  value={finalReflection.learned || ''}
                  onChange={e =>
                    setFinalReflection(prev => ({ ...prev, learned: e.target.value }))
                  }
                  placeholder="Key insights, study takeaways, or technical concepts..."
                  className="w-full px-3.5 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:bg-slate-100 resize-none"
                />
              </div>

              <div>
                <label className="block text-xs font-black uppercase tracking-wider text-slate-600 mb-1.5">
                  What did I create today?
                </label>
                <textarea
                  rows={2}
                  disabled={isReadOnly}
                  value={finalReflection.created || ''}
                  onChange={e =>
                    setFinalReflection(prev => ({ ...prev, created: e.target.value }))
                  }
                  placeholder="Projects built, code committed, writing produced..."
                  className="w-full px-3.5 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:bg-slate-100 resize-none"
                />
              </div>

              <div>
                <label className="block text-xs font-black uppercase tracking-wider text-slate-600 mb-1.5">
                  What could I have done better?
                </label>
                <textarea
                  rows={2}
                  disabled={isReadOnly}
                  value={finalReflection.doBetter || ''}
                  onChange={e =>
                    setFinalReflection(prev => ({ ...prev, doBetter: e.target.value }))
                  }
                  placeholder="Honest assessment of friction points or distractions..."
                  className="w-full px-3.5 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:bg-slate-100 resize-none"
                />
              </div>

              <div>
                <label className="block text-xs font-black uppercase tracking-wider text-slate-600 mb-1.5">
                  What will I do differently tomorrow?
                </label>
                <textarea
                  rows={2}
                  disabled={isReadOnly}
                  value={finalReflection.doDifferentlyTomorrow || ''}
                  onChange={e =>
                    setFinalReflection(prev => ({
                      ...prev,
                      doDifferentlyTomorrow: e.target.value,
                    }))
                  }
                  placeholder="Adjustments to your routine or mindset..."
                  className="w-full px-3.5 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:bg-slate-100 resize-none"
                />
              </div>

              <div>
                <label className="block text-xs font-black uppercase tracking-wider text-slate-600 mb-1.5">
                  Did I do something today that future me will thank me for?
                </label>
                <textarea
                  rows={2}
                  disabled={isReadOnly}
                  value={finalReflection.futureMeThanks || ''}
                  onChange={e =>
                    setFinalReflection(prev => ({
                      ...prev,
                      futureMeThanks: e.target.value,
                    }))
                  }
                  placeholder="Long-term investments in health, skills, or character..."
                  className="w-full px-3.5 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:bg-slate-100 resize-none"
                />
              </div>
            </div>

            {/* ── TODAY'S VALUE ALIGNMENT SCORE (1-10) ─────────────────────── */}
            <div className="pt-4 border-t border-slate-100 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                <div>
                  <h4 className="text-xs font-black uppercase tracking-wider text-slate-800">
                    How well did I live according to the person I want to become?
                  </h4>
                  <p className="text-[11px] text-slate-400">
                    This represents alignment with your values and character, not a raw productivity tally.
                  </p>
                </div>
                <span className="text-base font-black font-mono text-emerald-600">
                  {finalReflection.score || 8} / 10
                </span>
              </div>

              <div className="flex flex-wrap gap-1.5 sm:gap-2">
                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(s => (
                  <button
                    key={s}
                    type="button"
                    disabled={isReadOnly}
                    onClick={() =>
                      setFinalReflection(prev => ({ ...prev, score: s }))
                    }
                    className={`w-8 h-8 sm:w-9 sm:h-9 rounded-xl text-xs font-mono font-black transition cursor-pointer border flex items-center justify-center ${
                      finalReflection.score === s
                        ? 'bg-emerald-600 text-white border-emerald-600 shadow-md shadow-emerald-500/20 scale-105'
                        : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                    } ${isReadOnly ? 'cursor-default' : ''}`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>

            {/* ── TOMORROW'S #1 PRIORITY ────────────────────────────────────── */}
            <div className="pt-4 border-t border-slate-100 space-y-2">
              <label className="block text-xs font-black uppercase tracking-wider text-slate-800">
                Tomorrow's #1 Priority
              </label>
              <p className="text-[11px] text-slate-400">
                The single most important milestone to conquer tomorrow. This will appear on your Today screen.
              </p>
              <input
                type="text"
                disabled={isReadOnly}
                value={finalReflection.tomorrowPriority || ''}
                onChange={e =>
                  setFinalReflection(prev => ({
                    ...prev,
                    tomorrowPriority: e.target.value,
                  }))
                }
                placeholder="e.g. Build and deploy the new core feature"
                className="w-full px-4 py-3 text-xs sm:text-sm font-bold bg-slate-50 border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:bg-slate-100"
              />
            </div>

            {/* SAVE BUTTON */}
            {!isReadOnly && (
              <div className="pt-6 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="text-xs text-slate-400 font-medium">
                  {currentEntry?.isCompleted ? 'Previously saved · Tap to update' : 'Unsaved reflection'}
                </div>

                <button
                  type="button"
                  onClick={handleSaveJournal}
                  className="w-full sm:w-auto px-8 py-3.5 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black uppercase tracking-wider shadow-lg shadow-emerald-500/20 hover:scale-[1.02] active:scale-[0.98] transition-all cursor-pointer flex items-center justify-center gap-2"
                >
                  <Save className="w-4 h-4 stroke-[2.5px]" />
                  <span>Save Journal Entry</span>
                </button>
              </div>
            )}
          </div>

        </div>
      )}

      {/* ── SETTINGS MODAL ─────────────────────────────────────────────────── */}
      <JournalSettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        pillars={pillars}
        onSavePillars={nextPillars => {
          setPillars(nextPillars);
          saveStoredJournalPillars(nextPillars);
        }}
      />

    </div>
  );
}

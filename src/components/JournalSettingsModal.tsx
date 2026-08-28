import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  X, 
  Plus, 
  Trash2, 
  Pencil, 
  Check, 
  MoveUp, 
  MoveDown, 
  RotateCcw,
  Sparkles,
  HelpCircle,
  Eye,
  EyeOff
} from 'lucide-react';
import { JournalPillar, JournalQuestion, JournalQuestionType } from '../types';
import { DEFAULT_JOURNAL_PILLARS } from '../lib/journal';

interface JournalSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  pillars: JournalPillar[];
  onSavePillars: (pillars: JournalPillar[]) => void;
}

const QUESTION_TYPES: { type: JournalQuestionType; label: string; desc: string }[] = [
  { type: 'yes_no', label: 'Yes / No', desc: 'Binary habit checks' },
  { type: 'rating', label: 'Rating (1–5)', desc: 'Subjective scores' },
  { type: 'short_text', label: 'Short Text', desc: 'Brief reflection answer' },
  { type: 'long_text', label: 'Long Text', desc: 'Detailed notes or paragraph' },
  { type: 'number', label: 'Number', desc: 'Measurable quantity (e.g. grams)' },
];

export default function JournalSettingsModal({
  isOpen,
  onClose,
  pillars,
  onSavePillars,
}: JournalSettingsModalProps) {
  const [localPillars, setLocalPillars] = useState<JournalPillar[]>(pillars);
  const [activePillarId, setActivePillarId] = useState<string>(pillars[0]?.id || 'pillar_body');
  
  // Pillar Add/Edit state
  const [isAddingPillar, setIsAddingPillar] = useState(false);
  const [newPillarName, setNewPillarName] = useState('');
  const [newPillarIcon, setNewPillarIcon] = useState('✨');
  const [newPillarColor, setNewPillarColor] = useState('#10B981');
  const [editingPillarId, setEditingPillarId] = useState<string | null>(null);
  const [editPillarName, setEditPillarName] = useState('');

  // Question Add/Edit state
  const [isAddingQuestion, setIsAddingQuestion] = useState(false);
  const [newQuestionText, setNewQuestionText] = useState('');
  const [newQuestionType, setNewQuestionType] = useState<JournalQuestionType>('yes_no');
  const [newQuestionUnit, setNewQuestionUnit] = useState('');
  const [editingQuestionId, setEditingQuestionId] = useState<string | null>(null);
  const [editQuestionText, setEditQuestionText] = useState('');
  const [editQuestionType, setEditQuestionType] = useState<JournalQuestionType>('yes_no');
  const [editQuestionUnit, setEditQuestionUnit] = useState('');

  // Sync when opened
  React.useEffect(() => {
    if (isOpen) {
      setLocalPillars(pillars);
      if (pillars.length > 0 && (!activePillarId || !pillars.some(p => p.id === activePillarId))) {
        setActivePillarId(pillars[0].id);
      }
    }
  }, [isOpen, pillars]);

  if (!isOpen) return null;

  const currentPillar = localPillars.find(p => p.id === activePillarId) || localPillars[0];

  const handleSaveAndClose = () => {
    onSavePillars(localPillars);
    onClose();
  };

  const handleResetDefaults = () => {
    if (confirm('Reset all journal pillars and questions to default configuration? Your past answers will not be deleted.')) {
      setLocalPillars(DEFAULT_JOURNAL_PILLARS);
      setActivePillarId(DEFAULT_JOURNAL_PILLARS[0].id);
      onSavePillars(DEFAULT_JOURNAL_PILLARS);
    }
  };

  // ── Pillar Operations ───────────────────────────────────────────────────

  const handleAddPillar = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPillarName.trim()) return;

    const newPillar: JournalPillar = {
      id: 'pillar_' + Math.random().toString(36).substring(2, 9),
      name: newPillarName.trim().toUpperCase(),
      icon: newPillarIcon || '✨',
      color: newPillarColor || '#10B981',
      order: localPillars.length,
      questions: [],
    };

    const next = [...localPillars, newPillar];
    setLocalPillars(next);
    setActivePillarId(newPillar.id);
    setNewPillarName('');
    setIsAddingPillar(false);
  };

  const handleSavePillarRename = (pillarId: string) => {
    if (!editPillarName.trim()) return;
    setLocalPillars(prev =>
      prev.map(p => (p.id === pillarId ? { ...p, name: editPillarName.trim().toUpperCase() } : p))
    );
    setEditingPillarId(null);
  };

  const handleDeletePillar = (pillarId: string) => {
    if (localPillars.length <= 1) {
      alert('You must have at least one pillar in your journal.');
      return;
    }
    if (confirm('Delete this pillar and its questions?')) {
      const next = localPillars.filter(p => p.id !== pillarId);
      setLocalPillars(next);
      if (activePillarId === pillarId) {
        setActivePillarId(next[0].id);
      }
    }
  };

  const handleMovePillar = (pillarId: string, direction: 'up' | 'down') => {
    const idx = localPillars.findIndex(p => p.id === pillarId);
    if (idx === -1) return;
    const targetIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (targetIdx < 0 || targetIdx >= localPillars.length) return;

    const next = [...localPillars];
    const [removed] = next.splice(idx, 1);
    next.splice(targetIdx, 0, removed);
    const reordered = next.map((p, i) => ({ ...p, order: i }));
    setLocalPillars(reordered);
  };

  // ── Question Operations ─────────────────────────────────────────────────

  const handleAddQuestion = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newQuestionText.trim() || !currentPillar) return;

    const newQuestion: JournalQuestion = {
      id: 'q_' + Math.random().toString(36).substring(2, 9),
      pillarId: currentPillar.id,
      text: newQuestionText.trim(),
      type: newQuestionType,
      unit: newQuestionType === 'number' ? newQuestionUnit.trim() : undefined,
      enabled: true,
      order: (currentPillar.questions || []).length,
    };

    setLocalPillars(prev =>
      prev.map(p => {
        if (p.id === currentPillar.id) {
          return {
            ...p,
            questions: [...(p.questions || []), newQuestion],
          };
        }
        return p;
      })
    );

    setNewQuestionText('');
    setNewQuestionType('yes_no');
    setNewQuestionUnit('');
    setIsAddingQuestion(false);
  };

  const handleSaveEditQuestion = (questionId: string) => {
    if (!editQuestionText.trim() || !currentPillar) return;

    setLocalPillars(prev =>
      prev.map(p => {
        if (p.id === currentPillar.id) {
          return {
            ...p,
            questions: p.questions.map(q => {
              if (q.id === questionId) {
                return {
                  ...q,
                  text: editQuestionText.trim(),
                  type: editQuestionType,
                  unit: editQuestionType === 'number' ? editQuestionUnit.trim() : undefined,
                };
              }
              return q;
            }),
          };
        }
        return p;
      })
    );
    setEditingQuestionId(null);
  };

  const handleDeleteQuestion = (questionId: string) => {
    if (!currentPillar) return;
    setLocalPillars(prev =>
      prev.map(p => {
        if (p.id === currentPillar.id) {
          return {
            ...p,
            questions: p.questions.filter(q => q.id !== questionId),
          };
        }
        return p;
      })
    );
  };

  const handleToggleQuestionEnabled = (questionId: string) => {
    if (!currentPillar) return;
    setLocalPillars(prev =>
      prev.map(p => {
        if (p.id === currentPillar.id) {
          return {
            ...p,
            questions: p.questions.map(q => (q.id === questionId ? { ...q, enabled: !q.enabled } : q)),
          };
        }
        return p;
      })
    );
  };

  const handleMoveQuestion = (questionId: string, direction: 'up' | 'down') => {
    if (!currentPillar) return;
    const questions = [...currentPillar.questions];
    const idx = questions.findIndex(q => q.id === questionId);
    if (idx === -1) return;
    const targetIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (targetIdx < 0 || targetIdx >= questions.length) return;

    const [removed] = questions.splice(idx, 1);
    questions.splice(targetIdx, 0, removed);
    const reordered = questions.map((q, i) => ({ ...q, order: i }));

    setLocalPillars(prev =>
      prev.map(p => (p.id === currentPillar.id ? { ...p, questions: reordered } : p))
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 overflow-y-auto">
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 10 }}
        className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl border border-slate-200/80 overflow-hidden flex flex-col max-h-[90vh]"
      >
        {/* Modal Header */}
        <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div>
            <h2 className="text-lg font-black text-slate-900 tracking-tight">Journal Settings & Questions</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Customize your daily life pillars, questions, and input types.
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          
          {/* Pillar Selector & Tabs */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Life Pillars ({localPillars.length})
              </label>
              <button
                type="button"
                onClick={() => setIsAddingPillar(true)}
                className="text-xs font-bold text-emerald-600 hover:text-emerald-700 flex items-center gap-1 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                Add Pillar
              </button>
            </div>

            {/* Pillar Pills */}
            <div className="flex flex-wrap gap-2">
              {localPillars.map((p, idx) => {
                const isActive = p.id === activePillarId;
                return (
                  <button
                    key={p.id}
                    onClick={() => {
                      setActivePillarId(p.id);
                      setEditingQuestionId(null);
                    }}
                    className={`px-3.5 py-2 rounded-2xl text-xs font-black transition cursor-pointer flex items-center gap-2 border ${
                      isActive
                        ? 'bg-slate-900 text-white border-slate-900 shadow-md'
                        : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                    }`}
                  >
                    <span>{p.icon || '✨'}</span>
                    <span>{p.name}</span>
                    <span className="text-[10px] opacity-70">({p.questions?.length || 0})</span>
                  </button>
                );
              })}
            </div>

            {/* Add Pillar Form */}
            {isAddingPillar && (
              <form onSubmit={handleAddPillar} className="mt-3 p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-3">
                <div className="text-xs font-bold text-slate-700">Add New Pillar</div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <input
                    type="text"
                    placeholder="Pillar Name (e.g. CRAFT)"
                    value={newPillarName}
                    onChange={e => setNewPillarName(e.target.value)}
                    className="sm:col-span-2 px-3 py-2 text-xs bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    autoFocus
                  />
                  <input
                    type="text"
                    placeholder="Emoji (e.g. 🎨)"
                    value={newPillarIcon}
                    onChange={e => setNewPillarIcon(e.target.value)}
                    className="px-3 py-2 text-xs bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setIsAddingPillar(false)}
                    className="px-3 py-1.5 text-xs text-slate-500 hover:text-slate-800"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-1.5 text-xs font-bold bg-emerald-600 text-white rounded-xl hover:bg-emerald-700"
                  >
                    Create Pillar
                  </button>
                </div>
              </form>
            )}
          </div>

          {/* Current Pillar Controls */}
          {currentPillar && (
            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200/80 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-lg">{currentPillar.icon || '✨'}</span>
                  {editingPillarId === currentPillar.id ? (
                    <div className="flex items-center gap-1.5">
                      <input
                        type="text"
                        value={editPillarName}
                        onChange={e => setEditPillarName(e.target.value)}
                        className="px-2.5 py-1 text-xs font-black bg-white border border-slate-300 rounded-lg uppercase"
                        autoFocus
                      />
                      <button
                        type="button"
                        onClick={() => handleSavePillarRename(currentPillar.id)}
                        className="p-1 text-emerald-600 hover:text-emerald-800"
                      >
                        <Check className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-black text-slate-900 uppercase tracking-wide">
                        {currentPillar.name} Questions
                      </h3>
                      <button
                        type="button"
                        onClick={() => {
                          setEditingPillarId(currentPillar.id);
                          setEditPillarName(currentPillar.name);
                        }}
                        className="text-slate-400 hover:text-slate-600 p-1"
                        title="Rename pillar"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => handleMovePillar(currentPillar.id, 'up')}
                    className="p-1 text-slate-400 hover:text-slate-700"
                    title="Move pillar up"
                  >
                    <MoveUp className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleMovePillar(currentPillar.id, 'down')}
                    className="p-1 text-slate-400 hover:text-slate-700"
                    title="Move pillar down"
                  >
                    <MoveDown className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeletePillar(currentPillar.id)}
                    className="p-1 text-red-400 hover:text-red-600 ml-1"
                    title="Delete pillar"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Questions List for Active Pillar */}
              <div className="space-y-2">
                {(currentPillar.questions || []).length === 0 ? (
                  <div className="text-xs text-slate-400 text-center py-4 bg-white rounded-xl border border-dashed border-slate-200">
                    No questions in this pillar yet. Add one below!
                  </div>
                ) : (
                  currentPillar.questions.map((q, qIdx) => {
                    const isEditing = editingQuestionId === q.id;

                    if (isEditing) {
                      return (
                        <div key={q.id} className="p-3 bg-white rounded-xl border-2 border-emerald-500 space-y-2">
                          <input
                            type="text"
                            value={editQuestionText}
                            onChange={e => setEditQuestionText(e.target.value)}
                            className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                          />
                          <div className="flex flex-wrap gap-2 items-center">
                            <select
                              value={editQuestionType}
                              onChange={e => setEditQuestionType(e.target.value as JournalQuestionType)}
                              className="px-2.5 py-1 text-xs border border-slate-200 rounded-lg bg-white"
                            >
                              {QUESTION_TYPES.map(t => (
                                <option key={t.type} value={t.type}>
                                  {t.label}
                                </option>
                              ))}
                            </select>
                            {editQuestionType === 'number' && (
                              <input
                                type="text"
                                placeholder="Unit (e.g. grams, min)"
                                value={editQuestionUnit}
                                onChange={e => setEditQuestionUnit(e.target.value)}
                                className="px-2.5 py-1 text-xs border border-slate-200 rounded-lg w-28"
                              />
                            )}
                            <div className="flex-1" />
                            <button
                              type="button"
                              onClick={() => setEditingQuestionId(null)}
                              className="px-3 py-1 text-xs text-slate-500"
                            >
                              Cancel
                            </button>
                            <button
                              type="button"
                              onClick={() => handleSaveEditQuestion(q.id)}
                              className="px-3 py-1 text-xs font-bold bg-emerald-600 text-white rounded-lg"
                            >
                              Save
                            </button>
                          </div>
                        </div>
                      );
                    }

                    return (
                      <div
                        key={q.id}
                        className={`p-3 rounded-xl border flex items-center gap-3 transition ${
                          q.enabled ? 'bg-white border-slate-200' : 'bg-slate-100/60 border-slate-200 opacity-60'
                        }`}
                      >
                        <div className="flex-1 min-w-0">
                          <div className="text-xs font-bold text-slate-800 truncate">{q.text}</div>
                          <div className="text-[10px] font-mono text-slate-400 mt-0.5">
                            Type: {QUESTION_TYPES.find(t => t.type === q.type)?.label || q.type}
                            {q.unit ? ` (${q.unit})` : ''}
                          </div>
                        </div>

                        <div className="flex items-center gap-1 shrink-0">
                          {/* Toggle Enabled */}
                          <button
                            type="button"
                            onClick={() => handleToggleQuestionEnabled(q.id)}
                            className={`p-1 rounded transition ${q.enabled ? 'text-slate-400 hover:text-slate-700' : 'text-amber-500'}`}
                            title={q.enabled ? 'Disable question' : 'Enable question'}
                          >
                            {q.enabled ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                          </button>

                          {/* Move up / down */}
                          <button
                            type="button"
                            onClick={() => handleMoveQuestion(q.id, 'up')}
                            className="p-1 text-slate-400 hover:text-slate-700"
                            title="Move up"
                          >
                            <MoveUp className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleMoveQuestion(q.id, 'down')}
                            className="p-1 text-slate-400 hover:text-slate-700"
                            title="Move down"
                          >
                            <MoveDown className="w-3.5 h-3.5" />
                          </button>

                          {/* Edit */}
                          <button
                            type="button"
                            onClick={() => {
                              setEditingQuestionId(q.id);
                              setEditQuestionText(q.text);
                              setEditQuestionType(q.type);
                              setEditQuestionUnit(q.unit || '');
                            }}
                            className="p-1 text-slate-400 hover:text-slate-700"
                            title="Edit question"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>

                          {/* Delete */}
                          <button
                            type="button"
                            onClick={() => handleDeleteQuestion(q.id)}
                            className="p-1 text-red-400 hover:text-red-600"
                            title="Delete question"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Add Question Button or Form */}
              {isAddingQuestion ? (
                <form onSubmit={handleAddQuestion} className="p-3.5 bg-white rounded-xl border border-emerald-300 space-y-3">
                  <div className="text-xs font-bold text-slate-800">Add New Question</div>
                  <input
                    type="text"
                    placeholder="e.g. Did I stretch or do mobility work?"
                    value={newQuestionText}
                    onChange={e => setNewQuestionText(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    autoFocus
                  />
                  <div className="flex flex-wrap gap-2 items-center">
                    <select
                      value={newQuestionType}
                      onChange={e => setNewQuestionType(e.target.value as JournalQuestionType)}
                      className="px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg bg-white"
                    >
                      {QUESTION_TYPES.map(t => (
                        <option key={t.type} value={t.type}>
                          {t.label}
                        </option>
                      ))}
                    </select>
                    {newQuestionType === 'number' && (
                      <input
                        type="text"
                        placeholder="Unit (e.g. grams)"
                        value={newQuestionUnit}
                        onChange={e => setNewQuestionUnit(e.target.value)}
                        className="px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg w-28"
                      />
                    )}
                    <div className="flex-1" />
                    <button
                      type="button"
                      onClick={() => setIsAddingQuestion(false)}
                      className="px-3 py-1.5 text-xs text-slate-500 hover:text-slate-800"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="px-4 py-1.5 text-xs font-bold bg-emerald-600 text-white rounded-lg hover:bg-emerald-700"
                    >
                      Add Question
                    </button>
                  </div>
                </form>
              ) : (
                <button
                  type="button"
                  onClick={() => setIsAddingQuestion(true)}
                  className="w-full py-2.5 rounded-xl border border-dashed border-slate-300 text-xs font-bold text-slate-600 hover:border-emerald-500 hover:text-emerald-600 transition flex items-center justify-center gap-1.5 cursor-pointer bg-white"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Add Question to {currentPillar.name}
                </button>
              )}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 flex items-center justify-between">
          <button
            type="button"
            onClick={handleResetDefaults}
            className="text-xs font-bold text-slate-500 hover:text-slate-800 flex items-center gap-1.5 cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Reset to Defaults
          </button>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-200/60 transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSaveAndClose}
              className="px-5 py-2 rounded-xl text-xs font-extrabold bg-emerald-600 hover:bg-emerald-700 text-white shadow-md shadow-emerald-500/20 transition cursor-pointer"
            >
              Save Changes
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

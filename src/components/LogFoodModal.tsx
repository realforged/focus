import React, { useState, useEffect, useMemo } from 'react';
import { X, Plus, Search, Check, Trash2 } from 'lucide-react';
import type { LoggedFood } from '../types';
import {
  TIME_BLOCKS,
  BLOCK_META,
  getCurrentTimeBlock,
  type TimeBlock,
} from '../lib/nutritionBlocks';

interface LogFoodModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddFood: (food: {
    name: string;
    protein: number;
    carbs: number;
    fats: number;
    fiber: number;
    calories: number;
    mealType?: TimeBlock;
  }) => void;
  loggedFoodsHistory?: LoggedFood[];
  initialBlock?: TimeBlock;
}

const DEFAULT_FAVORITES: any[] = [];

export default function LogFoodModal({
  isOpen,
  onClose,
  onAddFood,
  loggedFoodsHistory = [],
  initialBlock,
}: LogFoodModalProps) {
  const [selectedBlock, setSelectedBlock] = useState<TimeBlock>(() => initialBlock || getCurrentTimeBlock());
  const [searchQuery, setSearchQuery] = useState('');
  const [showCustom, setShowCustom] = useState(false);
  const [name, setName] = useState('');
  const [protein, setProtein] = useState('25');
  const [loggedFlash, setLoggedFlash] = useState<string | null>(null);

  const [favorites, setFavorites] = useState(() => {
    try {
      const saved = localStorage.getItem('90day_favorite_foods');
      if (saved) {
        const parsed = JSON.parse(saved);
        return Array.isArray(parsed) ? parsed : DEFAULT_FAVORITES;
      }
    } catch {
      /* use defaults */
    }
    return DEFAULT_FAVORITES;
  });

  useEffect(() => {
    if (!isOpen) return;
    setSelectedBlock(initialBlock || getCurrentTimeBlock());
    setSearchQuery('');
    setShowCustom(false);
    setLoggedFlash(null);
  }, [initialBlock, isOpen]);

  const todayStr = new Date().toISOString().split('T')[0];
  const todayCount = loggedFoodsHistory.filter((f) => !f.date || f.date === todayStr).length;

  const filteredFavorites = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return favorites
      .filter((f: { name: string }) => !q || f.name.toLowerCase().includes(q))
      .sort((a: { protein: number }, b: { protein: number }) => b.protein - a.protein);
  }, [favorites, searchQuery]);

  if (!isOpen) return null;

  const flashLog = (foodName: string) => {
    setLoggedFlash(foodName);
    setTimeout(() => setLoggedFlash(null), 1500);
  };

  const logFood = (food: { name: string; protein: number; calories?: number; carbs?: number; fats?: number; fiber?: number }) => {
    const p = Math.max(0, food.protein);
    onAddFood({
      name: food.name,
      protein: p,
      carbs: food.carbs ?? 0,
      fats: food.fats ?? 0,
      fiber: food.fiber ?? 0,
      calories: food.calories ?? Math.round(p * 4 + 50),
      mealType: selectedBlock,
    });
    flashLog(food.name);
  };

  const handleCustomSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    logFood({ name: name.trim(), protein: parseFloat(protein) || 0 });
    setName('');
    setProtein('25');
    setShowCustom(false);
  };

  const handleDeleteFavorite = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = favorites.filter((f: { id: string }) => f.id !== id);
    setFavorites(updated);
    localStorage.setItem('90day_favorite_foods', JSON.stringify(updated));
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-[2px] flex items-end sm:items-center justify-center z-50 p-0 sm:p-4 select-none animate-fade-in">
      <div className="bg-white rounded-t-3xl sm:rounded-2xl w-full max-w-md shadow-2xl border border-neutral-100 flex flex-col max-h-[90vh] overflow-hidden">
        <div className="px-5 pt-4 pb-3 border-b border-neutral-100 shrink-0">
          <div className="w-10 h-1 bg-neutral-200 rounded-full mx-auto mb-4 sm:hidden" />
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-black text-black tracking-tight">Log Protein</h2>
              <p className="text-[11px] text-neutral-400 font-medium mt-0.5">
                {todayCount} logged today · {selectedBlock}
              </p>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-neutral-100 hover:bg-neutral-200 flex items-center justify-center cursor-pointer transition"
            >
              <X className="w-4 h-4 text-neutral-500" />
            </button>
          </div>

          <div className="grid grid-cols-4 gap-1.5 mt-4">
            {TIME_BLOCKS.map((block) => {
              const active = selectedBlock === block;
              const meta = BLOCK_META[block];
              return (
                <button
                  key={block}
                  type="button"
                  onClick={() => setSelectedBlock(block)}
                  className={`py-2 rounded-xl text-[10px] font-bold transition cursor-pointer border ${
                    active
                      ? 'bg-black text-white border-black'
                      : 'bg-white text-neutral-600 border-neutral-200 hover:border-neutral-400'
                  }`}
                >
                  <span className="block text-sm mb-0.5">{meta.icon}</span>
                  {meta.short}
                </button>
              );
            })}
          </div>
        </div>

        {loggedFlash && (
          <div className="mx-5 mt-3 px-3 py-2 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold flex items-center gap-2 shrink-0">
            <Check className="w-3.5 h-3.5 stroke-[3]" />
            +{loggedFlash} → {selectedBlock}
          </div>
        )}

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
          {!showCustom ? (
            <>
              <div className="relative">
                <Search className="w-4 h-4 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search favorites..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-neutral-50 border border-neutral-200 pl-9 pr-3 py-2.5 rounded-xl text-sm font-medium focus:outline-none focus:border-black text-black"
                />
              </div>

              <div className="space-y-1.5">
                {filteredFavorites.length === 0 ? (
                  <p className="text-xs text-neutral-400 text-center py-6">No matches. Add a custom entry below.</p>
                ) : (
                  filteredFavorites.map((food: { id: string; name: string; protein: number; calories?: number; emoji?: string }) => (
                    <button
                      key={food.id}
                      type="button"
                      onClick={() => logFood(food)}
                      className="w-full flex items-center gap-3 p-3 rounded-xl border border-neutral-100 hover:border-black hover:bg-neutral-50 transition cursor-pointer text-left group"
                    >
                      <span className="text-lg shrink-0">{food.emoji || '🍽️'}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-black truncate">{food.name}</p>
                        <p className="text-[11px] text-neutral-400 font-medium">{food.protein}g protein</p>
                      </div>
                      <span className="text-[10px] font-black text-black bg-neutral-100 group-hover:bg-black group-hover:text-white px-2.5 py-1 rounded-lg transition shrink-0">
                        + LOG
                      </span>
                      <button
                        type="button"
                        onClick={(e) => handleDeleteFavorite(food.id, e)}
                        className="w-7 h-7 rounded-lg text-neutral-300 hover:text-red-500 hover:bg-red-50 flex items-center justify-center cursor-pointer shrink-0 opacity-0 group-hover:opacity-100 transition"
                        title="Remove favorite"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </button>
                  ))
                )}
              </div>

              <button
                type="button"
                onClick={() => setShowCustom(true)}
                className="w-full py-2.5 rounded-xl border border-dashed border-neutral-300 text-xs font-bold text-neutral-500 hover:border-black hover:text-black transition cursor-pointer flex items-center justify-center gap-1.5"
              >
                <Plus className="w-3.5 h-3.5" />
                Custom entry
              </button>
            </>
          ) : (
            <form onSubmit={handleCustomSubmit} className="space-y-3">
              <div>
                <label className="text-[10px] font-bold text-neutral-400 uppercase tracking-wide block mb-1">Food name</label>
                <input
                  type="text"
                  placeholder="e.g. Chicken breast"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-neutral-50 border border-neutral-200 px-3 py-2.5 rounded-xl text-sm font-medium focus:outline-none focus:border-black"
                  required
                  autoFocus
                />
              </div>
              <div>
                <label className="text-[10px] font-bold text-neutral-400 uppercase tracking-wide block mb-1">Protein (g)</label>
                <input
                  type="number"
                  min="0"
                  step="any"
                  value={protein}
                  onChange={(e) => setProtein(e.target.value)}
                  className="w-full bg-neutral-50 border border-neutral-200 px-3 py-2.5 rounded-xl text-sm font-bold focus:outline-none focus:border-black"
                  required
                />
              </div>
              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setShowCustom(false)}
                  className="flex-1 py-2.5 rounded-xl border border-neutral-200 text-xs font-bold text-neutral-500 hover:bg-neutral-50 cursor-pointer"
                >
                  Back
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-xl bg-black text-white text-xs font-black hover:bg-neutral-800 cursor-pointer"
                >
                  Log to {selectedBlock}
                </button>
              </div>
            </form>
          )}
        </div>

        <div className="px-5 py-3 border-t border-neutral-100 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="w-full py-2.5 rounded-xl bg-neutral-100 hover:bg-neutral-200 text-xs font-black text-black transition cursor-pointer"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}

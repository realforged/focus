import React, { useState, useEffect, useMemo } from 'react';
import { X, Plus, Search, Check, Trash2, Star, Sparkles } from 'lucide-react';
import type { LoggedFood } from '../types';
import {
  TIME_BLOCKS,
  BLOCK_META,
  getCurrentTimeBlock,
  type TimeBlock,
} from '../lib/nutritionBlocks';
import {
  type FavoriteProteinItem,
  getStoredFavoriteProteins,
  saveStoredFavoriteProteins,
} from '../lib/favoriteProteins';

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
  const [showAddFavoriteModal, setShowAddFavoriteModal] = useState(false);
  const [name, setName] = useState('');
  const [protein, setProtein] = useState('25');
  const [saveAsFav, setSaveAsFav] = useState(true);
  const [favName, setFavName] = useState('');
  const [favProtein, setFavProtein] = useState('25');
  const [favEmoji, setFavEmoji] = useState('🥩');
  const [loggedFlash, setLoggedFlash] = useState<string | null>(null);

  const [favorites, setFavorites] = useState<FavoriteProteinItem[]>(() => getStoredFavoriteProteins());

  useEffect(() => {
    if (!isOpen) return;
    setSelectedBlock(initialBlock || getCurrentTimeBlock());
    setSearchQuery('');
    setShowCustom(false);
    setShowAddFavoriteModal(false);
    setLoggedFlash(null);
    setFavorites(getStoredFavoriteProteins());
  }, [initialBlock, isOpen]);

  // Listen for storage / custom event sync
  useEffect(() => {
    const handleSync = (e: any) => {
      if (e.detail) {
        setFavorites(e.detail);
      } else {
        setFavorites(getStoredFavoriteProteins());
      }
    };
    window.addEventListener('focus_now_favorites_updated', handleSync as EventListener);
    window.addEventListener('storage', handleSync);
    return () => {
      window.removeEventListener('focus_now_favorites_updated', handleSync as EventListener);
      window.removeEventListener('storage', handleSync);
    };
  }, []);

  const todayStr = new Date().toISOString().split('T')[0];
  const todayCount = loggedFoodsHistory.filter((f) => !f.date || f.date === todayStr).length;

  const filteredFavorites = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return favorites
      .filter((f) => !q || f.name.toLowerCase().includes(q))
      .sort((a, b) => b.protein - a.protein);
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
    const cleanName = name.trim();
    const cleanProtein = parseFloat(protein) || 0;
    if (!cleanName) return;

    logFood({ name: cleanName, protein: cleanProtein });

    if (saveAsFav) {
      const exists = favorites.some((f) => f.name.toLowerCase() === cleanName.toLowerCase());
      if (!exists) {
        const newFav: FavoriteProteinItem = {
          id: 'fav_' + Math.random().toString(36).substring(2, 9),
          name: cleanName,
          protein: cleanProtein,
          emoji: '⭐',
        };
        const updated = [newFav, ...favorites];
        setFavorites(updated);
        saveStoredFavoriteProteins(updated);
      }
    }

    setName('');
    setProtein('25');
    setShowCustom(false);
  };

  const handleCreateFavorite = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = favName.trim();
    const cleanProtein = parseFloat(favProtein) || 0;
    if (!cleanName || cleanProtein <= 0) return;

    const newFav: FavoriteProteinItem = {
      id: 'fav_' + Math.random().toString(36).substring(2, 9),
      name: cleanName,
      protein: cleanProtein,
      emoji: favEmoji || '⭐',
    };
    const updated = [newFav, ...favorites];
    setFavorites(updated);
    saveStoredFavoriteProteins(updated);
    setFavName('');
    setFavProtein('25');
    setShowAddFavoriteModal(false);
  };

  const handleDeleteFavorite = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = favorites.filter((f) => f.id !== id);
    setFavorites(updated);
    saveStoredFavoriteProteins(updated);
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-[3px] flex items-end sm:items-center justify-center z-50 p-0 sm:p-4 select-none animate-fade-in">
      <div className="bg-white rounded-t-3xl sm:rounded-3xl w-full max-w-md shadow-2xl border border-neutral-100 flex flex-col max-h-[90vh] overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="px-5 pt-4 pb-3 border-b border-neutral-100 shrink-0">
          <div className="w-10 h-1 bg-neutral-200 rounded-full mx-auto mb-4 sm:hidden" />
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-base">🥩</span>
                <h2 className="text-lg font-black text-black tracking-tight">Log Protein</h2>
              </div>
              <p className="text-[11px] text-neutral-400 font-semibold mt-0.5">
                {todayCount} logged today · Target block: <span className="text-black font-bold">{selectedBlock}</span>
              </p>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-neutral-100 hover:bg-neutral-200 flex items-center justify-center cursor-pointer transition"
            >
              <X className="w-4 h-4 text-neutral-500" />
            </button>
          </div>

          {/* Time Block Selector */}
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
                      ? 'bg-black text-white border-black shadow-xs scale-[1.02]'
                      : 'bg-neutral-50 text-neutral-600 border-neutral-200 hover:border-neutral-400'
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
          <div className="mx-5 mt-3 px-3 py-2 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold flex items-center gap-2 shrink-0 animate-in fade-in slide-in-from-top-1">
            <Check className="w-4 h-4 stroke-[3] text-emerald-600" />
            <span>Logged <strong>+{loggedFlash}</strong> to {selectedBlock}!</span>
          </div>
        )}

        {/* Body content */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
          {showAddFavoriteModal ? (
            /* Add New Favorite Form */
            <form onSubmit={handleCreateFavorite} className="space-y-3 bg-amber-50/60 p-4 rounded-2xl border border-amber-200">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black text-amber-900 flex items-center gap-1.5">
                  <Star className="w-3.5 h-3.5 fill-amber-500 text-amber-500" />
                  Add New Favorite Protein
                </span>
                <button
                  type="button"
                  onClick={() => setShowAddFavoriteModal(false)}
                  className="text-neutral-400 hover:text-neutral-700 text-xs font-bold"
                >
                  Cancel
                </button>
              </div>

              <div>
                <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-wide block mb-1">
                  Food Name
                </label>
                <input
                  type="text"
                  placeholder="e.g. Double Scoop Whey, 4 Boiled Eggs..."
                  value={favName}
                  onChange={(e) => setFavName(e.target.value)}
                  className="w-full bg-white border border-neutral-200 px-3 py-2 rounded-xl text-sm font-semibold focus:outline-none focus:border-black"
                  required
                  autoFocus
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-wide block mb-1">
                    Protein (g)
                  </label>
                  <input
                    type="number"
                    min="1"
                    step="0.5"
                    value={favProtein}
                    onChange={(e) => setFavProtein(e.target.value)}
                    className="w-full bg-white border border-neutral-200 px-3 py-2 rounded-xl text-sm font-bold focus:outline-none focus:border-black"
                    required
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-wide block mb-1">
                    Emoji Icon
                  </label>
                  <div className="flex items-center gap-1">
                    {['🥩', '🍗', '🥚', '🥤', '🥣', '🧀', '🐟', '🌱'].map((em) => (
                      <button
                        key={em}
                        type="button"
                        onClick={() => setFavEmoji(em)}
                        className={`w-7 h-7 rounded-lg text-sm flex items-center justify-center transition cursor-pointer ${
                          favEmoji === em ? 'bg-amber-200 ring-2 ring-amber-500' : 'bg-white hover:bg-neutral-100'
                        }`}
                      >
                        {em}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <button
                type="submit"
                className="w-full py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-xs font-black shadow-xs transition cursor-pointer flex items-center justify-center gap-1.5"
              >
                <Star className="w-3.5 h-3.5 fill-white" />
                Save to Favorites
              </button>
            </form>
          ) : !showCustom ? (
            <>
              {/* Search & Add favorite toolbar */}
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Search favorite proteins..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full bg-neutral-50 border border-neutral-200 pl-9 pr-3 py-2 rounded-xl text-xs font-semibold focus:outline-none focus:border-black text-black"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => setShowAddFavoriteModal(true)}
                  className="px-3 py-2 rounded-xl bg-amber-50 border border-amber-300 text-amber-900 text-xs font-black hover:bg-amber-100 transition cursor-pointer flex items-center gap-1 shrink-0"
                  title="Add a new custom favorite protein item"
                >
                  <Plus className="w-3.5 h-3.5 text-amber-700" />
                  <span>+ Favorite</span>
                </button>
              </div>

              {/* Favorites 1-Tap List */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-wider text-neutral-400 px-1 pt-1">
                  <span>⭐ Favorite Proteins (1-Tap Log):</span>
                  <span>{filteredFavorites.length} available</span>
                </div>

                {filteredFavorites.length === 0 ? (
                  <div className="text-center py-6 border border-dashed border-neutral-200 rounded-2xl bg-neutral-50 p-4">
                    <p className="text-xs text-neutral-500 font-semibold mb-2">No favorites found</p>
                    <button
                      type="button"
                      onClick={() => setShowAddFavoriteModal(true)}
                      className="px-3 py-1.5 rounded-xl bg-black text-white text-xs font-black"
                    >
                      + Add Favorite Protein
                    </button>
                  </div>
                ) : (
                  filteredFavorites.map((food) => (
                    <div
                      key={food.id}
                      className="w-full flex items-center gap-3 p-2.5 rounded-2xl border border-neutral-200 hover:border-black hover:bg-neutral-50 transition cursor-pointer text-left group bg-white shadow-2xs"
                      onClick={() => logFood(food)}
                    >
                      <span className="text-xl shrink-0 p-1 bg-neutral-100 rounded-xl group-hover:scale-110 transition-transform">
                        {food.emoji || '🥩'}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold text-black truncate">{food.name}</p>
                        <p className="text-[11px] text-neutral-500 font-black">
                          <span className="text-emerald-700 font-extrabold">{food.protein}g</span> protein
                          {food.calories ? ` · ${food.calories} kcal` : ''}
                        </p>
                      </div>
                      <span className="text-[10px] font-black text-black bg-neutral-100 group-hover:bg-black group-hover:text-white px-2.5 py-1.5 rounded-xl transition shrink-0 flex items-center gap-1">
                        <Plus className="w-3 h-3 stroke-[3]" />
                        LOG
                      </span>
                      <button
                        type="button"
                        onClick={(e) => handleDeleteFavorite(food.id, e)}
                        className="w-7 h-7 rounded-xl text-neutral-300 hover:text-red-500 hover:bg-red-50 flex items-center justify-center cursor-pointer shrink-0 opacity-0 group-hover:opacity-100 transition"
                        title="Remove from favorites"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))
                )}
              </div>

              {/* Custom entry button */}
              <button
                type="button"
                onClick={() => setShowCustom(true)}
                className="w-full py-2.5 rounded-xl border border-dashed border-neutral-300 text-xs font-bold text-neutral-600 hover:border-black hover:text-black transition cursor-pointer flex items-center justify-center gap-1.5"
              >
                <Plus className="w-3.5 h-3.5" />
                Custom quick entry
              </button>
            </>
          ) : (
            /* Custom Log Form */
            <form onSubmit={handleCustomSubmit} className="space-y-3">
              <div>
                <label className="text-[10px] font-bold text-neutral-400 uppercase tracking-wide block mb-1">
                  Food name
                </label>
                <input
                  type="text"
                  placeholder="e.g. Chicken breast, Protein shake..."
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-neutral-50 border border-neutral-200 px-3 py-2.5 rounded-xl text-sm font-semibold focus:outline-none focus:border-black"
                  required
                  autoFocus
                />
              </div>

              <div>
                <label className="text-[10px] font-bold text-neutral-400 uppercase tracking-wide block mb-1">
                  Protein (g)
                </label>
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

              <div className="flex items-center gap-2 p-2.5 rounded-xl bg-amber-50/70 border border-amber-200/80 cursor-pointer select-none">
                <input
                  type="checkbox"
                  id="saveFavCheck"
                  checked={saveAsFav}
                  onChange={(e) => setSaveAsFav(e.target.checked)}
                  className="w-4 h-4 rounded text-black accent-black cursor-pointer"
                />
                <label htmlFor="saveFavCheck" className="text-xs font-bold text-amber-900 cursor-pointer flex items-center gap-1">
                  <Star className="w-3.5 h-3.5 fill-amber-500 text-amber-500 inline" />
                  Save to Favorite Proteins for fast 1-tap logging
                </label>
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
                  className="flex-1 py-2.5 rounded-xl bg-black text-white text-xs font-black hover:bg-neutral-800 cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <Plus className="w-3.5 h-3.5 stroke-[3]" />
                  Log to {selectedBlock}
                </button>
              </div>
            </form>
          )}
        </div>

        {/* Footer */}
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

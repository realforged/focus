import React, { useState, useEffect } from 'react';
import { 
  Apple, 
  Trash2, 
  Edit3, 
  Scale, 
  Utensils, 
  RotateCcw,
  PlusCircle,
  AlertCircle,
  ArrowLeft,
  Sliders,
  Droplet,
  Star,
  Check,
  Plus,
  Flame,
  X
} from 'lucide-react';
import {
  DietPreferences,
  getDietPreferences,
  saveDietPreferences,
  getWaterIntakeForDate,
  addWaterIntakeForDate,
} from '../lib/dietPreferences';
import {
  type FavoriteProteinItem,
  getStoredFavoriteProteins,
  saveStoredFavoriteProteins,
} from '../lib/favoriteProteins';

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

export interface DietScreenProps {
  nutritionToday: {
    protein: number;
    carbs: number;
    fats: number;
    fiber: number;
    calories: number;
  };
  nutritionTargets: {
    protein: number;
    carbs: number;
    fats: number;
    fiber: number;
    calories: number;
    morningProtein?: number;
    afternoonProtein?: number;
    eveningProtein?: number;
    nightProtein?: number;
  };
  loggedFoods: LoggedFood[];
  onAddFood: (food: Omit<LoggedFood, 'id' | 'timestamp'>) => void;
  onRemoveFood: (id: string) => void;
  onUpdateTargets: (targets: { protein: number; carbs: number; fats: number; fiber: number; calories: number; morningProtein?: number; afternoonProtein?: number; eveningProtein?: number; nightProtein?: number }) => void;
  onClearLogs: () => void;
  onBack?: () => void;
  dateToday?: string;
  onOpenLogFoodForBlock?: (block: 'Morning' | 'Afternoon' | 'Evening' | 'Night') => void;
}

interface FavoriteFoodItem {
  id: string;
  name: string;
  protein: number;
  carbs: number;
  fats: number;
  fiber: number;
  calories: number;
  emoji?: string;
}

export default function DietScreen({
  nutritionToday,
  nutritionTargets,
  loggedFoods,
  onAddFood,
  onRemoveFood,
  onUpdateTargets,
  onClearLogs,
  onBack,
  dateToday = new Date().toISOString().split('T')[0],
  onOpenLogFoodForBlock,
}: DietScreenProps) {
  // Diet Preferences state (controls visible metrics on dashboard and diet screen)
  const [prefs, setPrefs] = useState<DietPreferences>(() => getDietPreferences());
  const [showEditViewModal, setShowEditViewModal] = useState(false);

  // Water tracking state
  const [waterMl, setWaterMl] = useState<number>(() => getWaterIntakeForDate(dateToday));

  // Goal editing state
  const [isEditingGoals, setIsEditingGoals] = useState(false);
  const [editProtein, setEditProtein] = useState(String(nutritionTargets.protein));
  const [editCarbs, setEditCarbs] = useState(String(nutritionTargets.carbs));
  const [editFats, setEditFats] = useState(String(nutritionTargets.fats));
  const [editFiber, setEditFiber] = useState(String(nutritionTargets.fiber));
  const [editCalories, setEditCalories] = useState(String(nutritionTargets.calories));

  // Block-specific protein goal editing
  const [editingBlockGoal, setEditingBlockGoal] = useState<'Morning' | 'Afternoon' | 'Evening' | 'Night' | null>(null);
  const [blockGoalInput, setBlockGoalInput] = useState('');

  // Block-specific protein goals (with defaults proportional to total)
  const totalProtein = nutritionTargets.protein || 150;
  const blockGoals = {
    Morning: nutritionTargets.morningProtein ?? Math.round(totalProtein * 0.25),
    Afternoon: nutritionTargets.afternoonProtein ?? Math.round(totalProtein * 0.35),
    Evening: nutritionTargets.eveningProtein ?? Math.round(totalProtein * 0.30),
    Night: nutritionTargets.nightProtein ?? Math.round(totalProtein * 0.10),
  };

  // Favorites state
  const [favorites, setFavorites] = useState<FavoriteFoodItem[]>(() => getStoredFavoriteProteins() as FavoriteFoodItem[]);

  useEffect(() => {
    const handleSync = (e: any) => {
      if (e.detail) {
        setFavorites(e.detail);
      } else {
        setFavorites(getStoredFavoriteProteins() as FavoriteFoodItem[]);
      }
    };
    window.addEventListener('focus_now_favorites_updated', handleSync as EventListener);
    window.addEventListener('storage', handleSync);
    return () => {
      window.removeEventListener('focus_now_favorites_updated', handleSync as EventListener);
      window.removeEventListener('storage', handleSync);
    };
  }, []);

  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Custom food log state
  const [customName, setCustomName] = useState('');
  const [customProtein, setCustomProtein] = useState('20');
  const [customCarbs, setCustomCarbs] = useState('15');
  const [customFats, setCustomFats] = useState('5');
  const [customFiber, setCustomFiber] = useState('2');
  const [customCalories, setCustomCalories] = useState('180');
  const [saveAsFav, setSaveAsFav] = useState(false);

  useEffect(() => {
    saveDietPreferences(prefs);
  }, [prefs]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 2500);
  };

  const handleWaterAdd = (amountMl: number) => {
    const updated = addWaterIntakeForDate(dateToday, amountMl);
    setWaterMl(updated);
    showToast(`+${amountMl}ml Water logged! 💧`);
  };

  const handleSaveGoals = (e: React.FormEvent) => {
    e.preventDefault();
    onUpdateTargets({
      protein: Math.max(0, parseFloat(editProtein) || 0),
      carbs: Math.max(0, parseFloat(editCarbs) || 0),
      fats: Math.max(0, parseFloat(editFats) || 0),
      fiber: Math.max(0, parseFloat(editFiber) || 0),
      calories: Math.max(0, parseFloat(editCalories) || 0),
      morningProtein: nutritionTargets.morningProtein,
      afternoonProtein: nutritionTargets.afternoonProtein,
      eveningProtein: nutritionTargets.eveningProtein,
      nightProtein: nutritionTargets.nightProtein,
    });
    setIsEditingGoals(false);
    showToast('Nutrient goals updated! 🎯');
  };

  const handleSaveBlockGoal = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingBlockGoal) return;
    const val = Math.max(0, parseFloat(blockGoalInput) || 0);
    const keyMap: Record<string, string> = {
      Morning: 'morningProtein',
      Afternoon: 'afternoonProtein',
      Evening: 'eveningProtein',
      Night: 'nightProtein',
    };
    onUpdateTargets({
      ...nutritionTargets,
      [keyMap[editingBlockGoal]]: val,
    });
    setEditingBlockGoal(null);
    showToast(`${editingBlockGoal} protein goal set to ${val}g! 🎯`);
  };

  const handleLogCustom = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customName.trim()) return;

    const item = {
      name: customName.trim(),
      protein: Math.max(0, parseFloat(customProtein) || 0),
      carbs: 0,
      fats: 0,
      fiber: 0,
      calories: Math.max(0, parseFloat(customCalories) || 0),
    };

    onAddFood(item);

    if (saveAsFav) {
      const newFav: FavoriteFoodItem = {
        id: 'fav_' + Math.random().toString(36).substring(2, 9),
        ...item,
        emoji: '⭐'
      };
      const updatedFavs = [newFav, ...favorites.filter(f => f.name.toLowerCase() !== item.name.toLowerCase())];
      setFavorites(updatedFavs);
      saveStoredFavoriteProteins(updatedFavs as any);
    }

    setCustomName('');
    showToast(`Logged "${item.name}"! 🥗`);
  };

  const handleQuickLogFav = (fav: FavoriteFoodItem) => {
    onAddFood({
      name: fav.name,
      protein: fav.protein,
      carbs: fav.carbs,
      fats: fav.fats,
      fiber: fav.fiber,
      calories: fav.calories,
    });
    showToast(`Logged "${fav.name}"! ⚡`);
  };

  const handleDeleteFav = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = favorites.filter(f => f.id !== id);
    setFavorites(updated);
    saveStoredFavoriteProteins(updated as any);
    showToast('Removed from favorites.');
  };

  const togglePref = (key: keyof DietPreferences) => {
    setPrefs(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  const totalMealsCount = loggedFoods.length;

  return (
    <div className="space-y-6 select-none pb-12 relative">

      {/* Toast popup */}
      {toastMessage && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-[80] bg-[#0F172A] text-white text-xs font-bold px-4 py-2.5 rounded-2xl shadow-xl animate-fade-in border border-slate-700">
          {toastMessage}
        </div>
      )}

      {/* Back Button and Header */}
      <div className="flex items-center justify-between">
        {onBack && (
          <button 
            onClick={onBack}
            className="group flex items-center gap-2 bg-[#1c2237] hover:bg-[#252c48] text-slate-300 hover:text-white px-3.5 py-2 rounded-xl text-xs font-bold transition cursor-pointer border border-[#2b3352]"
          >
            <ArrowLeft className="w-4 h-4 transition-transform group-hover:-translate-x-0.5" />
            <span>BACK TO HOME</span>
          </button>
        )}
      </div>

      {/* Page Header Card */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white rounded-3xl p-6 border border-gray-100 shadow-sm">
        <div className="flex items-center gap-4">
          <div className="bg-emerald-500/10 p-3.5 rounded-2xl text-emerald-600 border border-emerald-500/20">
            <Apple className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-black text-slate-900 tracking-tight">Diet & Nutrition Tracker</h2>
            <p className="text-xs text-gray-500 font-medium">Log food, track water & meal count, and customize dashboard metrics.</p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <button 
            onClick={() => setShowEditViewModal(true)}
            className="bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-700 text-xs font-black px-3.5 py-2.5 rounded-xl transition flex items-center gap-1.5 cursor-pointer shadow-2xs"
          >
            <Sliders className="w-4 h-4 text-emerald-600" />
            <span>DIET EDIT OPTIONS</span>
          </button>

          <button 
            onClick={() => {
              setEditProtein(String(nutritionTargets.protein));
              setEditCarbs(String(nutritionTargets.carbs));
              setEditFats(String(nutritionTargets.fats));
              setEditFiber(String(nutritionTargets.fiber));
              setEditCalories(String(nutritionTargets.calories));
              setIsEditingGoals(true);
            }}
            className="bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 text-xs font-black px-3.5 py-2.5 rounded-xl transition flex items-center gap-1.5 cursor-pointer"
          >
            <Edit3 className="w-4 h-4 text-slate-500" />
            <span>GOALS</span>
          </button>

          <button 
            onClick={() => {
              if (confirm('Clear today\'s food log and macros?')) {
                onClearLogs();
                setWaterMl(0);
                showToast('Cleared today\'s diet log.');
              }
            }}
            className="bg-red-50 hover:bg-red-100 border border-red-100 text-red-600 text-[10px] font-bold px-3 py-2.5 rounded-xl transition flex items-center gap-1 cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>RESET</span>
          </button>
        </div>
      </div>

      {/* DIET DISPLAY EDIT MODAL (Customizing Dashboard & Diet Log Metrics) */}
      {showEditViewModal && (
        <div className="fixed inset-0 z-[80] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-2xl max-w-md w-full space-y-4">
            <div className="flex justify-between items-center pb-2 border-b border-slate-100">
              <div className="flex items-center gap-2 text-slate-900">
                <Sliders className="w-5 h-5 text-emerald-600" />
                <h3 className="font-black text-base">Diet Display & Dashboard Options</h3>
              </div>
              <button 
                onClick={() => setShowEditViewModal(false)}
                className="p-1 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-500 font-medium">
              Select which metrics will be visible on your **Dashboard** and **Diet Log**:
            </p>

            <div className="space-y-2.5">
              {[
                { key: 'showCalories' as keyof DietPreferences, label: 'Calories (kcal)', icon: '🔥', desc: 'Total energy intake target' },
                { key: 'showProtein' as keyof DietPreferences, label: 'Protein (g)', icon: '🍗', desc: 'Daily muscle protein goal' },
                { key: 'showWater' as keyof DietPreferences, label: 'Water (ml / L)', icon: '💧', desc: 'Hydration tracker & quick logging' },
                { key: 'showMeals' as keyof DietPreferences, label: 'Number of Meals', icon: '🍽️', desc: 'Daily meal count tracker' },
                { key: 'showCarbs' as keyof DietPreferences, label: 'Carbohydrates (g)', icon: '🌾', desc: 'Carb intake' },
                { key: 'showFats' as keyof DietPreferences, label: 'Fats (g)', icon: '🥑', desc: 'Healthy fats' },
                { key: 'showFiber' as keyof DietPreferences, label: 'Fiber (g)', icon: '🥦', desc: 'Dietary fiber' },
              ].map(item => {
                const isChecked = prefs[item.key] as boolean;
                return (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => togglePref(item.key)}
                    className={`w-full flex items-center justify-between p-3 rounded-2xl border transition text-left cursor-pointer ${
                      isChecked ? 'bg-emerald-50/70 border-emerald-200 text-slate-900' : 'bg-slate-50 border-slate-200 text-slate-500'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-lg">{item.icon}</span>
                      <div>
                        <p className="text-xs font-black">{item.label}</p>
                        <p className="text-[10px] text-slate-400 font-normal">{item.desc}</p>
                      </div>
                    </div>
                    <div className={`w-5 h-5 rounded-lg flex items-center justify-center border transition ${
                      isChecked ? 'bg-emerald-600 border-emerald-600 text-white' : 'border-slate-300 bg-white'
                    }`}>
                      {isChecked && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                    </div>
                  </button>
                );
              })}
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={() => setShowEditViewModal(false)}
                className="w-full bg-[#0F172A] hover:bg-slate-800 text-white font-extrabold text-xs py-3 rounded-xl transition cursor-pointer"
              >
                Apply Preferences
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Goal Editing Form */}
      {isEditingGoals && (
        <div className="bg-emerald-50/50 border-2 border-emerald-500/30 rounded-3xl p-6 animate-fade-in space-y-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-2 text-emerald-700">
              <Scale className="w-5 h-5" />
              <h3 className="font-extrabold text-sm uppercase tracking-wider">Configure Nutrient Goals</h3>
            </div>
            <button 
              onClick={() => setIsEditingGoals(false)}
              className="text-xs font-bold text-gray-400 hover:text-gray-600"
            >
              Cancel
            </button>
          </div>

          <form onSubmit={handleSaveGoals} className="grid grid-cols-2 sm:grid-cols-5 gap-4">
            <div>
              <label className="text-[10px] font-black text-slate-500 uppercase block mb-1">Protein Goal (g)</label>
              <input 
                type="number" 
                value={editProtein} 
                onChange={e => setEditProtein(e.target.value)} 
                className="w-full bg-white border border-slate-200 p-2.5 rounded-xl text-sm font-bold focus:outline-none focus:border-emerald-500" 
                required 
              />
            </div>
            <div>
              <label className="text-[10px] font-black text-slate-500 uppercase block mb-1">Carbs Goal (g)</label>
              <input 
                type="number" 
                value={editCarbs} 
                onChange={e => setEditCarbs(e.target.value)} 
                className="w-full bg-white border border-slate-200 p-2.5 rounded-xl text-sm font-bold focus:outline-none focus:border-emerald-500" 
                required 
              />
            </div>
            <div>
              <label className="text-[10px] font-black text-slate-500 uppercase block mb-1">Fats Goal (g)</label>
              <input 
                type="number" 
                value={editFats} 
                onChange={e => setEditFats(e.target.value)} 
                className="w-full bg-white border border-slate-200 p-2.5 rounded-xl text-sm font-bold focus:outline-none focus:border-emerald-500" 
                required 
              />
            </div>
            <div>
              <label className="text-[10px] font-black text-slate-500 uppercase block mb-1">Fiber Goal (g)</label>
              <input 
                type="number" 
                value={editFiber} 
                onChange={e => setEditFiber(e.target.value)} 
                className="w-full bg-white border border-slate-200 p-2.5 rounded-xl text-sm font-bold focus:outline-none focus:border-emerald-500" 
                required 
              />
            </div>
            <div className="col-span-2 sm:col-span-1">
              <label className="text-[10px] font-black text-slate-500 uppercase block mb-1">Calories Goal (kcal)</label>
              <input 
                type="number" 
                value={editCalories} 
                onChange={e => setEditCalories(e.target.value)} 
                className="w-full bg-white border border-slate-200 p-2.5 rounded-xl text-sm font-bold focus:outline-none focus:border-emerald-500" 
                required 
              />
            </div>
            <div className="col-span-2 sm:col-span-5 flex justify-end">
              <button 
                type="submit" 
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs px-6 py-2.5 rounded-xl transition shadow-md shadow-emerald-600/10 cursor-pointer"
              >
                Apply Custom Targets
              </button>
            </div>
          </form>
        </div>
      )}

      {/* === TOTAL DIET PROTEIN PROGRESS BAR === */}
      {(() => {
        const totalP = nutritionToday.protein;
        const goalP = nutritionTargets.protein || 150;
        const totalCal = nutritionToday.calories;
        const goalCal = nutritionTargets.calories || 2000;
        const pct = Math.min(100, Math.round((totalP / goalP) * 100));
        const remaining = Math.max(0, goalP - totalP);
        const proteinMet = totalP >= goalP;
        const calMet = totalCal >= goalCal;
        const perfectDay = proteinMet && calMet;

        // Time block data
        const blockDefs: Array<{ key: 'Morning' | 'Afternoon' | 'Evening' | 'Night'; label: string; icon: string; color: string; bar: string; border: string; bg: string; textColor: string }> = [
          { key: 'Morning', label: 'Morning', icon: '🌅', color: 'text-amber-700', bar: 'bg-gradient-to-r from-amber-400 to-orange-400', border: 'border-amber-200', bg: 'bg-amber-50', textColor: 'text-amber-800' },
          { key: 'Afternoon', label: 'Afternoon', icon: '☀️', color: 'text-sky-700', bar: 'bg-gradient-to-r from-sky-400 to-blue-400', border: 'border-sky-200', bg: 'bg-sky-50', textColor: 'text-sky-800' },
          { key: 'Evening', label: 'Evening', icon: '🌆', color: 'text-orange-700', bar: 'bg-gradient-to-r from-orange-400 to-rose-400', border: 'border-orange-200', bg: 'bg-orange-50', textColor: 'text-orange-800' },
          { key: 'Night', label: 'Night', icon: '🌙', color: 'text-indigo-700', bar: 'bg-gradient-to-r from-indigo-500 to-violet-500', border: 'border-indigo-200', bg: 'bg-indigo-50', textColor: 'text-indigo-800' },
        ];

        const blockProtein = (block: 'Morning' | 'Afternoon' | 'Evening' | 'Night') =>
          loggedFoods.reduce((sum, f) => (f.mealType === block ? sum + f.protein : sum), 0);

        const blockItems = (block: 'Morning' | 'Afternoon' | 'Evening' | 'Night') =>
          loggedFoods.filter(f => f.mealType === block);

        return (
          <>
            {/* Total Protein Bar */}
            <div className="bg-white rounded-3xl p-5 border border-emerald-100 shadow-sm relative overflow-hidden" style={{ boxShadow: '0 4px 24px -4px rgba(16,185,129,0.13)' }}>
              <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-400/5 rounded-full blur-3xl pointer-events-none" />
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
                    <span className="text-lg">🥩</span>
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-slate-900 tracking-tight">Total Diet Protein</h3>
                    <p className="text-[9px] font-bold text-emerald-600 uppercase tracking-wider">DAILY PROTEIN PROGRESS</p>
                  </div>
                </div>
                {perfectDay && (
                  <div className="flex items-center gap-1.5 bg-gradient-to-r from-emerald-500 to-teal-500 text-white text-[10px] font-black px-3 py-1.5 rounded-full shadow-md shadow-emerald-500/30 animate-pulse">
                    🎉 Perfect Diet Day!
                  </div>
                )}
              </div>

              <div className="flex items-end justify-between mb-2">
                <div className="flex items-baseline gap-1.5">
                  <span className="text-3xl font-black text-emerald-700">{totalP}</span>
                  <span className="text-sm font-bold text-slate-400">g / {goalP}g</span>
                  <span className="text-xs font-black text-emerald-600 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full ml-1">{pct}%</span>
                </div>
                <div className="text-right">
                  {remaining > 0 ? (
                    <span className="text-xs font-black text-slate-500">{remaining}g remaining</span>
                  ) : (
                    <span className="text-xs font-black text-emerald-600">✅ Goal Reached!</span>
                  )}
                </div>
              </div>

              <div className="w-full bg-slate-100 h-3 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-emerald-400 via-teal-400 to-emerald-500 transition-all duration-700 relative"
                  style={{ width: `${pct}%` }}
                >
                  {pct > 15 && (
                    <div className="absolute right-1 top-0.5 bottom-0.5 w-1 bg-white/40 rounded-full" />
                  )}
                </div>
              </div>
            </div>

            {/* Block Goal Edit Modal */}
            {editingBlockGoal && (
              <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-fade-in select-none">
                <div className="bg-white rounded-3xl p-5 max-w-xs w-full shadow-2xl border border-slate-100 space-y-4">
                  <div className="flex justify-between items-center">
                    <h3 className="text-sm font-black text-slate-900">
                      {editingBlockGoal} Protein Goal
                    </h3>
                    <button onClick={() => setEditingBlockGoal(null)} className="p-1 text-slate-400 hover:text-slate-600 rounded-full cursor-pointer">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  <form onSubmit={handleSaveBlockGoal} className="space-y-3">
                    <div>
                      <label className="text-[10px] font-black text-slate-400 uppercase block mb-1">Protein Target (g)</label>
                      <input
                        type="number"
                        min="0"
                        value={blockGoalInput}
                        onChange={e => setBlockGoalInput(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 px-3.5 py-2.5 rounded-xl text-sm font-bold text-slate-900 focus:outline-none focus:border-emerald-500"
                        required
                        autoFocus
                      />
                    </div>
                    <div className="flex gap-2">
                      <button type="button" onClick={() => setEditingBlockGoal(null)} className="flex-1 px-3 py-2 rounded-xl text-xs font-bold text-slate-500 hover:bg-slate-100 cursor-pointer">Cancel</button>
                      <button type="submit" className="flex-1 px-4 py-2 rounded-xl text-xs font-black bg-emerald-600 hover:bg-emerald-700 text-white shadow-md cursor-pointer">Save Goal</button>
                    </div>
                  </form>
                </div>
              </div>
            )}

            {/* 4 Time-Block Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {blockDefs.map(({ key, label, icon, bar, border, bg, textColor }) => {
                const blockP = blockProtein(key);
                const blockGoal = blockGoals[key];
                const blockPct = Math.min(100, Math.round((blockP / Math.max(1, blockGoal)) * 100));
                const items = blockItems(key);

                return (
                  <div key={key} className={`${bg} ${border} border rounded-2xl p-3.5 flex flex-col gap-2 relative overflow-hidden`}>
                    {/* Block Header */}
                    <div className="flex items-center justify-between">
                      <div
                        className="flex items-center gap-1.5 cursor-pointer group"
                        onClick={() => {
                          setEditingBlockGoal(key);
                          setBlockGoalInput(String(blockGoal));
                        }}
                        title={`Edit ${label} protein goal`}
                      >
                        <span className="text-base">{icon}</span>
                        <span className={`text-[10px] font-black uppercase tracking-wide ${textColor}`}>{label}</span>
                        <Edit3 className={`w-2.5 h-2.5 ${textColor} opacity-40 group-hover:opacity-100 transition`} />
                      </div>
                      {/* Plus button */}
                      <button
                        type="button"
                        onClick={() => onOpenLogFoodForBlock ? onOpenLogFoodForBlock(key) : undefined}
                        className={`w-7 h-7 rounded-xl flex items-center justify-center text-white font-black shadow-md transition active:scale-90 cursor-pointer ${
                          key === 'Morning' ? 'bg-amber-500 hover:bg-amber-600 shadow-amber-500/30' :
                          key === 'Afternoon' ? 'bg-sky-500 hover:bg-sky-600 shadow-sky-500/30' :
                          key === 'Evening' ? 'bg-orange-500 hover:bg-orange-600 shadow-orange-500/30' :
                          'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-600/30'
                        }`}
                        title={`Log food to ${label}`}
                      >
                        <Plus className="w-4 h-4 stroke-[3]" />
                      </button>
                    </div>

                    {/* Protein stats */}
                    <div>
                      <div className="flex items-baseline gap-1">
                        <span className={`text-lg font-black ${textColor}`}>{blockP}</span>
                        <span className="text-[10px] text-slate-400 font-semibold">g / {blockGoal}g</span>
                      </div>
                      <div className="w-full bg-white/70 h-1.5 rounded-full overflow-hidden mt-1">
                        <div className={`${bar} h-full rounded-full transition-all duration-500`} style={{ width: `${blockPct}%` }} />
                      </div>
                    </div>

                    {/* Items list */}
                    {items.length > 0 && (
                      <div className="space-y-1 max-h-24 overflow-y-auto">
                        {items.map(item => (
                          <div key={item.id} className="flex items-center justify-between bg-white/60 rounded-lg px-2 py-1">
                            <span className="text-[9px] font-bold text-slate-700 truncate flex-1">{item.name}</span>
                            <div className="flex items-center gap-1 shrink-0 ml-1">
                              <span className={`text-[9px] font-black ${textColor}`}>{item.protein}g</span>
                              <button
                                onClick={() => { onRemoveFood(item.id); showToast('Removed item.'); }}
                                className="p-0.5 rounded hover:bg-red-100 text-slate-300 hover:text-red-500 transition cursor-pointer"
                              >
                                <Trash2 className="w-2.5 h-2.5" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {items.length === 0 && (
                      <p className="text-[9px] text-slate-400 font-medium text-center py-1">No food logged yet</p>
                    )}

                    {blockPct >= 100 && (
                      <div className="text-[9px] font-black text-center text-white bg-emerald-500 rounded-lg py-0.5">✅ Goal Met!</div>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        );
      })()}

      {/* Active Visible Metric Cards Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {prefs.showCalories && (
          <div className="bg-white rounded-2xl p-4 border border-slate-100 shadow-xs flex flex-col justify-between" style={{ boxShadow: '0 4px 20px -2px rgba(245,158,11,0.12)' }}>
            <div className="flex justify-between items-start mb-1">
              <span className="text-[9px] font-extrabold text-slate-400 uppercase tracking-widest">Calories</span>
              <span className="text-base">🔥</span>
            </div>
            <div className="my-2">
              <div className="flex items-baseline gap-1">
                <span className="text-2xl font-black text-amber-600">{nutritionToday.calories}</span>
                <span className="text-xs text-slate-400 font-semibold">kcal</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] font-mono text-slate-400">Goal: {nutritionTargets.calories} kcal</span>
                <button
                  type="button"
                  onClick={() => {
                    setEditCalories(String(nutritionTargets.calories));
                    setIsEditingGoals(true);
                  }}
                  className="p-0.5 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-md transition cursor-pointer"
                  title="Edit Calories Goal"
                >
                  <Plus className="w-3 h-3 stroke-[3]" />
                </button>
              </div>
            </div>
            <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
              <div className="h-full rounded-full bg-amber-500 transition-all duration-500" style={{ width: `${Math.min(100, Math.round((nutritionToday.calories / nutritionTargets.calories) * 100))}%` }} />
            </div>
          </div>
        )}

        {prefs.showProtein && (
          <div className="bg-white rounded-2xl p-4 border border-slate-100 shadow-xs flex flex-col justify-between" style={{ boxShadow: '0 4px 20px -2px rgba(16,185,129,0.12)' }}>
            <div className="flex justify-between items-start mb-1">
              <span className="text-[9px] font-extrabold text-slate-400 uppercase tracking-widest">Protein</span>
              <span className="text-base">🍗</span>
            </div>
            <div className="my-2">
              <div className="flex items-baseline gap-1">
                <span className="text-2xl font-black text-emerald-600">{nutritionToday.protein}</span>
                <span className="text-xs text-slate-400 font-semibold">g</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] font-mono text-slate-400">Goal: {nutritionTargets.protein} g</span>
                <button
                  type="button"
                  onClick={() => {
                    setEditProtein(String(nutritionTargets.protein));
                    setIsEditingGoals(true);
                  }}
                  className="p-0.5 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-md transition cursor-pointer"
                  title="Edit Protein Goal"
                >
                  <Plus className="w-3 h-3 stroke-[3]" />
                </button>
              </div>
            </div>
            <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
              <div className="h-full rounded-full bg-emerald-500 transition-all duration-500" style={{ width: `${Math.min(100, Math.round((nutritionToday.protein / nutritionTargets.protein) * 100))}%` }} />
            </div>
          </div>
        )}

        {prefs.showWater && (
          <div className="bg-white rounded-2xl p-4 border border-slate-100 shadow-xs flex flex-col justify-between" style={{ boxShadow: '0 4px 20px -2px rgba(14,165,233,0.12)' }}>
            <div className="flex justify-between items-start mb-1">
              <span className="text-[9px] font-extrabold text-slate-400 uppercase tracking-widest">Water Intake</span>
              <span className="text-base">💧</span>
            </div>
            <div className="my-2">
              <div className="flex items-baseline gap-1">
                <span className="text-2xl font-black text-sky-600">{(waterMl / 1000).toFixed(1)}</span>
                <span className="text-xs text-slate-400 font-semibold">L ({waterMl} ml)</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] font-mono text-slate-400">Goal: {(prefs.waterGoalMl / 1000).toFixed(1)} L</span>
                <button
                  type="button"
                  onClick={() => {
                    const input = prompt('Enter daily water goal in Liters (e.g. 3):', String(prefs.waterGoalMl / 1000));
                    if (input !== null) {
                      const val = parseFloat(input);
                      if (!isNaN(val) && val > 0) {
                        setPrefs(prev => ({ ...prev, waterGoalMl: Math.round(val * 1000) }));
                        showToast('Water target updated! 💧');
                      }
                    }
                  }}
                  className="p-0.5 text-slate-400 hover:text-sky-600 hover:bg-sky-50 rounded-md transition cursor-pointer"
                  title="Edit Water Goal"
                >
                  <Plus className="w-3 h-3 stroke-[3]" />
                </button>
              </div>
            </div>
            <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden mb-2">
              <div className="h-full rounded-full bg-sky-500 transition-all duration-500" style={{ width: `${Math.min(100, Math.round((waterMl / prefs.waterGoalMl) * 100))}%` }} />
            </div>
            {/* Quick Water Logging Buttons */}
            <div className="flex gap-1.5 pt-1">
              <button
                type="button"
                onClick={() => handleWaterAdd(250)}
                className="flex-1 bg-sky-50 hover:bg-sky-100 text-sky-700 font-black text-[10px] py-1 rounded-lg transition border border-sky-100 cursor-pointer"
              >
                +250ml
              </button>
              <button
                type="button"
                onClick={() => handleWaterAdd(500)}
                className="flex-1 bg-sky-50 hover:bg-sky-100 text-sky-700 font-black text-[10px] py-1 rounded-lg transition border border-sky-100 cursor-pointer"
              >
                +500ml
              </button>
            </div>
          </div>
        )}

        {prefs.showMeals && (
          <div className="bg-white rounded-2xl p-4 border border-slate-100 shadow-xs flex flex-col justify-between" style={{ boxShadow: '0 4px 20px -2px rgba(168,85,247,0.12)' }}>
            <div className="flex justify-between items-start mb-1">
              <span className="text-[9px] font-extrabold text-slate-400 uppercase tracking-widest">Meals Logged</span>
              <span className="text-base">🍽️</span>
            </div>
            <div className="my-2">
              <div className="flex items-baseline gap-1">
                <span className="text-2xl font-black text-purple-600">{totalMealsCount}</span>
                <span className="text-xs text-slate-400 font-semibold">meals</span>
              </div>
              <span className="text-[10px] font-mono text-slate-400">Target: {prefs.mealsGoal} meals</span>
            </div>
            <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
              <div className="h-full rounded-full bg-purple-500 transition-all duration-500" style={{ width: `${Math.min(100, Math.round((totalMealsCount / prefs.mealsGoal) * 100))}%` }} />
            </div>
          </div>
        )}

        {prefs.showCarbs && (
          <div className="bg-white rounded-2xl p-4 border border-slate-100 shadow-xs flex flex-col justify-between">
            <div className="flex justify-between items-start mb-1">
              <span className="text-[9px] font-extrabold text-slate-400 uppercase tracking-widest">Carbs</span>
              <span className="text-base">🌾</span>
            </div>
            <div className="my-2">
              <div className="flex items-baseline gap-1">
                <span className="text-2xl font-black text-blue-500">{nutritionToday.carbs}</span>
                <span className="text-xs text-slate-400 font-semibold">g</span>
              </div>
            </div>
          </div>
        )}

        {prefs.showFats && (
          <div className="bg-white rounded-2xl p-4 border border-slate-100 shadow-xs flex flex-col justify-between">
            <div className="flex justify-between items-start mb-1">
              <span className="text-[9px] font-extrabold text-slate-400 uppercase tracking-widest">Fats</span>
              <span className="text-base">🥑</span>
            </div>
            <div className="my-2">
              <div className="flex items-baseline gap-1">
                <span className="text-2xl font-black text-orange-500">{nutritionToday.fats}</span>
                <span className="text-xs text-slate-400 font-semibold">g</span>
              </div>
            </div>
          </div>
        )}

        {prefs.showFiber && (
          <div className="bg-white rounded-2xl p-4 border border-slate-100 shadow-xs flex flex-col justify-between">
            <div className="flex justify-between items-start mb-1">
              <span className="text-[9px] font-extrabold text-slate-400 uppercase tracking-widest">Fiber</span>
              <span className="text-base">🥦</span>
            </div>
            <div className="my-2">
              <div className="flex items-baseline gap-1">
                <span className="text-2xl font-black text-purple-500">{nutritionToday.fiber}</span>
                <span className="text-xs text-slate-400 font-semibold">g</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* QUICK FAVORITES LOG STRIP */}
      {favorites.length > 0 && (
        <div className="bg-white rounded-3xl p-5 border border-gray-100 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Star className="w-4 h-4 text-amber-500 fill-amber-400" />
              <h3 className="font-extrabold text-xs text-slate-900 uppercase tracking-wide">Favorite Logs (1-Tap Log)</h3>
            </div>
            <span className="text-[10px] text-slate-400 font-medium">Click to log instantly</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {favorites.map(fav => (
              <div
                key={fav.id}
                onClick={() => handleQuickLogFav(fav)}
                className="group bg-slate-50 hover:bg-emerald-50/70 border border-slate-200/80 hover:border-emerald-300 p-3 rounded-2xl transition cursor-pointer flex items-center justify-between"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span>{fav.emoji || '⭐'}</span>
                    <p className="text-xs font-black text-slate-800 truncate">{fav.name}</p>
                  </div>
                  <div className="flex items-center gap-2 text-[10px] font-mono font-bold text-slate-400 mt-1">
                    <span className="text-emerald-600">P:{fav.protein}g</span>
                    <span>•</span>
                    <span className="text-amber-600">{fav.calories}kcal</span>
                  </div>
                </div>

                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={(e) => handleDeleteFav(fav.id, e)}
                    className="p-1 rounded-lg hover:bg-red-100 text-slate-300 hover:text-red-500 transition"
                    title="Remove favorite"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                  <div className="w-6 h-6 rounded-full bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                    <Plus className="w-3.5 h-3.5 stroke-[3]" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Main Two-Column Section: Manual Custom Entry Form + Today's Log */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
        
        {/* Manual Custom Entry Form (5 columns) */}
        <div className="md:col-span-5 bg-white rounded-3xl p-6 border border-gray-100 shadow-sm flex flex-col">
          <div className="flex items-center gap-2 mb-4">
            <PlusCircle className="w-4.5 h-4.5 text-emerald-500" />
            <h3 className="font-extrabold text-sm text-slate-900 uppercase tracking-wide">Log Custom Food / Entry</h3>
          </div>

          <form onSubmit={handleLogCustom} className="space-y-4 flex-1 flex flex-col justify-between">
            <div className="space-y-3.5">
              <div>
                <label className="text-[10px] font-black text-slate-500 uppercase block mb-1">Food / Drink Name</label>
                <input 
                  type="text" 
                  placeholder="e.g. Protein Shake, Water 500ml, Chicken Salad" 
                  value={customName}
                  onChange={e => setCustomName(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 px-3.5 py-2.5 rounded-xl text-xs font-bold focus:outline-none focus:border-emerald-500"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-black text-slate-500 uppercase block mb-1">Protein (g)</label>
                  <input 
                    type="number" 
                    value={customProtein}
                    onChange={e => setCustomProtein(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 p-2.5 rounded-xl text-xs font-bold focus:outline-none focus:border-emerald-500"
                    required
                  />
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-500 uppercase block mb-1">Calories (kcal)</label>
                  <input 
                    type="number" 
                    value={customCalories}
                    onChange={e => setCustomCalories(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 p-2.5 rounded-xl text-xs font-bold focus:outline-none focus:border-emerald-500"
                    required
                  />
                </div>
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="saveFavCheck"
                  checked={saveAsFav}
                  onChange={e => setSaveAsFav(e.target.checked)}
                  className="rounded text-emerald-600 focus:ring-emerald-500"
                />
                <label htmlFor="saveFavCheck" className="text-xs font-bold text-slate-700 cursor-pointer">
                  Save to Favorite Logs ⭐
                </label>
              </div>
            </div>

            <button 
              type="submit"
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs py-3 rounded-xl transition shadow-md shadow-emerald-600/15 mt-5 cursor-pointer"
            >
              🥗 Log Food Item
            </button>
          </form>
        </div>

        {/* Food Log List (7 columns) */}
        <div className="md:col-span-7 bg-white rounded-3xl p-6 border border-gray-100 shadow-sm flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Utensils className="w-5 h-5 text-emerald-500" />
              <h3 className="font-extrabold text-sm text-slate-900 uppercase tracking-wide">Today's Consumption Log ({loggedFoods.length})</h3>
            </div>
            <span className="text-[10px] font-mono text-gray-400 font-bold uppercase">Chronological</span>
          </div>

          <div className="flex-1 max-h-[420px] overflow-y-auto pr-1">
            {loggedFoods.length > 0 ? (
              <div className="divide-y divide-slate-100">
                {loggedFoods.map((item) => (
                  <div key={item.id} className="py-3 flex items-center justify-between gap-4 group">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-xs font-black text-slate-800 truncate">{item.name}</p>
                        {item.mealType && (
                          <span className="text-[9px] font-black px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
                            {item.mealType === 'Breakfast' ? '🌅' : item.mealType === 'Lunch' ? '☀️' : item.mealType === 'Dinner' ? '🌙' : '🥨'} {item.mealType}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 text-[10px] font-mono font-semibold text-slate-400 mt-1 flex-wrap">
                        {prefs.showProtein && <span className="text-emerald-600">P: {item.protein}g</span>}
                        {prefs.showProtein && <span>•</span>}
                        <span className="text-blue-500">C: {item.carbs}g</span>
                        <span>•</span>
                        <span className="text-orange-500">F: {item.fats}g</span>
                        {item.fiber > 0 && (
                          <>
                            <span>•</span>
                            <span className="text-purple-500">Fi: {item.fiber}g</span>
                          </>
                        )}
                        {prefs.showCalories && (
                          <>
                            <span>•</span>
                            <span className="text-amber-600 font-bold">{item.calories} kcal</span>
                          </>
                        )}
                        <span>•</span>
                        <span className="text-slate-400 font-normal">{item.timestamp}</span>
                      </div>
                    </div>

                    <button
                      onClick={() => {
                        onRemoveFood(item.id);
                        showToast('Removed item.');
                      }}
                      className="p-1.5 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-500 transition cursor-pointer shrink-0 border border-transparent hover:border-red-100"
                      title="Remove food item"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-16 border border-dashed border-slate-200 rounded-2xl">
                <AlertCircle className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider">No food items logged today</h4>
                <p className="text-xs text-slate-400 mt-1 max-w-xs mx-auto">Use quick favorites or custom food entry to log your meals and hit your targets.</p>
              </div>
            )}
          </div>
        </div>
        
      </div>
    </div>
  );
}

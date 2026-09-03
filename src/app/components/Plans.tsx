import { useState, useMemo, useEffect, useRef } from 'react';
import {
  Plus,
  Trash2,
  Edit2,
  Check,
  X,
  Target,
  Clock,
  Calendar,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  AlignLeft,
  CheckCircle2,
  Circle,
  Sparkles,
  Search,
  Filter,
  ArrowRight,
  ListTodo,
  Layers,
  Flag,
} from 'lucide-react';
import ConfirmDialog from './ConfirmDialog';
import { useSupabasePersistedState } from '../hooks/useSupabasePersistedState';

export type PlanType = 'short_term' | 'long_term';

export interface PlanItem {
  id: string;
  title: string;
  description?: string;
  completed: boolean;
  createdAt: string;
}

export interface PlanCard {
  id: string;
  title: string;
  icon: string;
  type: PlanType;
  items: PlanItem[];
  createdAt: string;
  updatedAt?: string;
}

export interface PlansData {
  plans: PlanCard[];
}

const DEFAULT_PLANS: PlansData = {
  plans: [],
};

const PLAN_EMOJI_CATEGORIES = [
  {
    name: 'Goals & Focus',
    icon: '🎯',
    emojis: ['🎯', '🚀', '⭐', '💡', '🏆', '🔥', '✨', '💎', '🏅', '🥇', '⚡', '🌟', '🎖️', '🪄'],
  },
  {
    name: 'Life & Habit',
    icon: '🏃',
    emojis: ['🏃', '🧘', '🥗', '💧', '🚴', '🏋️', '🍎', '😴', '🚶', '🌱', '🌿', '🏊', '🍵', '⛺'],
  },
  {
    name: 'Career & Study',
    icon: '📚',
    emojis: ['📚', '💻', '🎓', '📝', '💼', '📈', '📊', '🧠', '🔬', '🎨', '📐', '🗣️', '📖', '🛠️'],
  },
  {
    name: 'Home & Family',
    icon: '🏡',
    emojis: ['🏡', '🛋️', '🪴', '🛒', '🍳', '👶', '🐾', '📦', '🧹', '🔑', '🏠', '🛏️', '🍽️', '🕯️'],
  },
  {
    name: 'Travel & Asset',
    icon: '🚗',
    emojis: ['🚗', '✈️', '🏖️', '🌍', '🏕️', '🚂', '🛳️', '🏔️', '🏍️', '🏨', '🎒', '🗺️', '🏝️', '🌄'],
  },
  {
    name: 'Finance & Saving',
    icon: '💰',
    emojis: ['💰', '💳', '🏦', '🪙', '💵', '📊', '🤝', '🔐', '🏷️', '🧾', '💍', '🎁', '🛍️', '📦'],
  },
];

interface PlansProps {
  onUnsavedChanges?: (hasChanges: boolean) => void;
  isReadOnly?: boolean;
}

export default function Plans({ onUnsavedChanges, isReadOnly = false }: PlansProps) {
  // Main Persisted Plans Data
  const [plansData, setPlansData] = useSupabasePersistedState<PlansData>('plans_data', DEFAULT_PLANS);

  // Filter out any legacy default sample plans so the user has a completely clean slate
  useEffect(() => {
    if (plansData.plans.some((p) => ['plan-1', 'plan-2', 'plan-3', 'plan-4'].includes(p.id))) {
      setPlansData((prev) => ({
        ...prev,
        plans: prev.plans.filter((p) => !['plan-1', 'plan-2', 'plan-3', 'plan-4'].includes(p.id)),
      }));
    }
  }, []);

  // Active Filter: 'all' | 'short_term' | 'long_term'
  const [activeTabFilter, setActiveTabFilter] = useState<'all' | PlanType>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Add / Edit Plan Card Modal State
  const [showAddPlanModal, setShowAddPlanModal] = useState<boolean>(false);
  const [planModalType, setPlanModalType] = useState<PlanType>('short_term');
  const [planModalTitle, setPlanModalTitle] = useState<string>('');
  const [planModalIcon, setPlanModalIcon] = useState<string>('🎯');
  const [activeEmojiTab, setActiveEmojiTab] = useState<number>(0);
  const [editingPlanId, setEditingPlanId] = useState<string | null>(null);

  // Active Opened Plan Card (Detail Modal)
  const [activeDetailPlanId, setActiveDetailPlanId] = useState<string | null>(null);

  // Add Entry Draft State inside Plan Detail Modal
  const [showAddEntryLine, setShowAddEntryLine] = useState<boolean>(false);
  const [newEntryTitle, setNewEntryTitle] = useState<string>('');
  const [newEntryDescription, setNewEntryDescription] = useState<string>('');
  const [isNewEntryDescExpanded, setIsNewEntryDescExpanded] = useState<boolean>(false);

  // Expanded Descriptions in Entries List: Record<itemId, boolean>
  const [expandedItemDescriptions, setExpandedItemDescriptions] = useState<Record<string, boolean>>({});

  // Editing Item inside Detail Modal: { itemId, title, description }
  const [editingItem, setEditingItem] = useState<{ id: string; title: string; description: string } | null>(null);

  // Delete Confirmation Dialog
  const [confirmDelete, setConfirmDelete] = useState<{
    type: 'plan' | 'item';
    planId: string;
    itemId?: string;
    title: string;
  } | null>(null);

  // Active Plan Card object
  const activeDetailPlan = useMemo(() => {
    if (!activeDetailPlanId) return null;
    return plansData.plans.find((p) => p.id === activeDetailPlanId) || null;
  }, [activeDetailPlanId, plansData.plans]);

  // Duplicate Plan Title Validation
  const isDuplicatePlanTitle = useMemo(() => {
    const trimmed = planModalTitle.trim().toLowerCase();
    if (!trimmed) return false;
    return plansData.plans.some(
      (p) => p.id !== editingPlanId && p.title.trim().toLowerCase() === trimmed
    );
  }, [planModalTitle, editingPlanId, plansData.plans]);

  // Filtered Plans by Tab and Search
  const filteredPlans = useMemo(() => {
    return plansData.plans.filter((plan) => {
      const matchesTab = activeTabFilter === 'all' || plan.type === activeTabFilter;
      const matchesSearch =
        !searchQuery.trim() ||
        plan.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        plan.items.some(
          (item) =>
            item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
            (item.description && item.description.toLowerCase().includes(searchQuery.toLowerCase()))
        );
      return matchesTab && matchesSearch;
    });
  }, [plansData.plans, activeTabFilter, searchQuery]);

  const shortTermPlans = useMemo(
    () => filteredPlans.filter((p) => p.type === 'short_term'),
    [filteredPlans]
  );
  const longTermPlans = useMemo(
    () => filteredPlans.filter((p) => p.type === 'long_term'),
    [filteredPlans]
  );

  // Open Add Plan Modal for specific type
  const handleOpenAddPlan = (type: PlanType) => {
    setEditingPlanId(null);
    setPlanModalType(type);
    setPlanModalTitle('');
    setPlanModalIcon(type === 'short_term' ? '⚡' : '🚀');
    setShowAddPlanModal(true);
  };

  // Open Edit Plan Modal
  const handleOpenEditPlan = (plan: PlanCard, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingPlanId(plan.id);
    setPlanModalType(plan.type);
    setPlanModalTitle(plan.title);
    setPlanModalIcon(plan.icon);
    setShowAddPlanModal(true);
  };

  // Save Plan Card (Create or Update)
  const handleSavePlanCard = () => {
    const title = planModalTitle.trim();
    if (!title || isDuplicatePlanTitle) return;

    if (editingPlanId) {
      setPlansData((prev) => ({
        ...prev,
        plans: prev.plans.map((p) =>
          p.id === editingPlanId
            ? { ...p, title, icon: planModalIcon, type: planModalType, updatedAt: new Date().toISOString() }
            : p
        ),
      }));
    } else {
      const newPlan: PlanCard = {
        id: `plan-${Date.now()}`,
        title,
        icon: planModalIcon,
        type: planModalType,
        items: [],
        createdAt: new Date().toISOString(),
      };
      setPlansData((prev) => ({
        ...prev,
        plans: [newPlan, ...prev.plans],
      }));
      // Immediately open newly created card
      setActiveDetailPlanId(newPlan.id);
      setShowAddEntryLine(true);
    }

    setShowAddPlanModal(false);
  };

  // Delete Plan Card
  const handleDeletePlanCard = (planId: string) => {
    setPlansData((prev) => ({
      ...prev,
      plans: prev.plans.filter((p) => p.id !== planId),
    }));
    if (activeDetailPlanId === planId) {
      setActiveDetailPlanId(null);
    }
  };

  // Add Item to Plan
  const handleSaveNewEntry = () => {
    if (!activeDetailPlanId) return;
    const title = newEntryTitle.trim();
    if (!title) return;

    const newItem: PlanItem = {
      id: `item-${Date.now()}`,
      title,
      description: newEntryDescription.trim() || undefined,
      completed: false,
      createdAt: new Date().toISOString(),
    };

    setPlansData((prev) => ({
      ...prev,
      plans: prev.plans.map((p) =>
        p.id === activeDetailPlanId
          ? { ...p, items: [...p.items, newItem], updatedAt: new Date().toISOString() }
          : p
      ),
    }));

    setNewEntryTitle('');
    setNewEntryDescription('');
    setIsNewEntryDescExpanded(false);
    setShowAddEntryLine(false);
  };

  // Toggle Item Completed
  const handleToggleItem = (planId: string, itemId: string) => {
    setPlansData((prev) => ({
      ...prev,
      plans: prev.plans.map((p) =>
        p.id === planId
          ? {
              ...p,
              items: p.items.map((it) =>
                it.id === itemId ? { ...it, completed: !it.completed } : it
              ),
              updatedAt: new Date().toISOString(),
            }
          : p
      ),
    }));
  };

  // Save Edited Item
  const handleSaveEditItem = () => {
    if (!activeDetailPlanId || !editingItem) return;
    const title = editingItem.title.trim();
    if (!title) return;

    setPlansData((prev) => ({
      ...prev,
      plans: prev.plans.map((p) =>
        p.id === activeDetailPlanId
          ? {
              ...p,
              items: p.items.map((it) =>
                it.id === editingItem.id
                  ? {
                      ...it,
                      title,
                      description: editingItem.description.trim() || undefined,
                    }
                  : it
              ),
              updatedAt: new Date().toISOString(),
            }
          : p
      ),
    }));

    setEditingItem(null);
  };

  // Delete Item
  const handleDeleteItem = (planId: string, itemId: string) => {
    setPlansData((prev) => ({
      ...prev,
      plans: prev.plans.map((p) =>
        p.id === planId
          ? {
              ...p,
              items: p.items.filter((it) => it.id !== itemId),
              updatedAt: new Date().toISOString(),
            }
          : p
      ),
    }));
  };

  // Toggle Description Expand/Collapse for existing item
  const toggleItemDescription = (itemId: string) => {
    setExpandedItemDescriptions((prev) => ({
      ...prev,
      [itemId]: !prev[itemId],
    }));
  };

  // Calculate Overall Stats
  const stats = useMemo(() => {
    let totalPlans = plansData.plans.length;
    let totalItems = 0;
    let completedItems = 0;
    let shortCount = 0;
    let longCount = 0;

    plansData.plans.forEach((p) => {
      if (p.type === 'short_term') shortCount++;
      if (p.type === 'long_term') longCount++;
      p.items.forEach((it) => {
        totalItems++;
        if (it.completed) completedItems++;
      });
    });

    const percent = totalItems > 0 ? Math.round((completedItems / totalItems) * 100) : 0;
    return { totalPlans, totalItems, completedItems, shortCount, longCount, percent };
  }, [plansData.plans]);

  return (
    <div className="space-y-6 animate-in fade-in duration-300 pb-12">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-gradient-to-r from-indigo-50/70 via-purple-50/60 to-pink-50/60 dark:from-gray-800 dark:via-gray-850 dark:to-gray-800 p-5 rounded-2xl border border-indigo-100 dark:border-gray-700 shadow-xs">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="w-8 h-8 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-xs">
              <Target className="w-4 h-4" />
            </div>
            <h1 className="text-xl font-black text-gray-900 dark:text-white tracking-tight">
              Plans & Goals
            </h1>
            <span className="text-xs bg-indigo-100 dark:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 font-semibold px-2 py-0.5 rounded-full">
              {stats.totalPlans} Total
            </span>
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Structure your short-term milestones and long-term life plans with clear checklists.
          </p>
        </div>

        {/* Quick Stats Pill */}
        <div className="flex items-center gap-3">
          <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-xs px-3 py-1.5 rounded-xl border border-indigo-100 dark:border-gray-700 flex items-center gap-2.5 shadow-2xs">
            <div className="text-right">
              <div className="text-xs font-bold text-gray-900 dark:text-gray-100">
                {stats.completedItems} / {stats.totalItems} done
              </div>
              <div className="text-[10px] text-gray-400 font-medium">
                {stats.percent}% overall progress
              </div>
            </div>
            <div className="w-9 h-9 rounded-full border-2 border-indigo-600 dark:border-indigo-400 flex items-center justify-center text-[11px] font-black text-indigo-600 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/50">
              {stats.percent}%
            </div>
          </div>
        </div>
      </div>

      {/* Filter Tabs & Search Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        {/* Filter Pills */}
        <div className="flex items-center gap-1.5 p-1 bg-gray-100 dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 text-xs self-start">
          <button
            type="button"
            onClick={() => setActiveTabFilter('all')}
            className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
              activeTabFilter === 'all'
                ? 'bg-white dark:bg-gray-900 text-indigo-600 dark:text-indigo-400 shadow-xs'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
            }`}
          >
            All Plans ({stats.totalPlans})
          </button>
          <button
            type="button"
            onClick={() => setActiveTabFilter('short_term')}
            className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTabFilter === 'short_term'
                ? 'bg-white dark:bg-gray-900 text-amber-600 dark:text-amber-400 shadow-xs'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
            }`}
          >
            <span>⚡ Short Term</span>
            <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-amber-100 dark:bg-amber-950/80 text-amber-700 dark:text-amber-300">
              {stats.shortCount}
            </span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTabFilter('long_term')}
            className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTabFilter === 'long_term'
                ? 'bg-white dark:bg-gray-900 text-purple-600 dark:text-purple-400 shadow-xs'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
            }`}
          >
            <span>🚀 Long Term</span>
            <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-purple-100 dark:bg-purple-950/80 text-purple-700 dark:text-purple-300">
              {stats.longCount}
            </span>
          </button>
        </div>

        {/* Search */}
        <div className="relative w-full sm:w-64">
          <Search className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search plans or tasks..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 text-xs bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-400"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </div>
      </div>

      {/* SECTION 1: Short Term Plans */}
      {(activeTabFilter === 'all' || activeTabFilter === 'short_term') && (
        <div className="space-y-3">
          <div className="flex items-center justify-between border-b border-amber-100 dark:border-amber-950/50 pb-2">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span>
              <h2 className="text-sm font-extrabold text-gray-800 dark:text-gray-200 uppercase tracking-wider flex items-center gap-1.5">
                <span>Short Term Plans</span>
                <span className="text-xs font-semibold text-gray-400 font-normal">
                  ({shortTermPlans.length})
                </span>
              </h2>
            </div>

            {!isReadOnly && (
              <button
                type="button"
                onClick={() => handleOpenAddPlan('short_term')}
                className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-bold text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/60 hover:bg-amber-100 dark:hover:bg-amber-900/60 border border-amber-200 dark:border-amber-800 rounded-lg transition-colors cursor-pointer shadow-2xs"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Short Term Plan</span>
              </button>
            )}
          </div>

          {/* Cards Grid: Small compact box type */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {/* Add Box Shortcut Card */}
            {!isReadOnly && (
              <button
                type="button"
                onClick={() => handleOpenAddPlan('short_term')}
                className="min-h-[110px] p-3.5 rounded-xl border-2 border-dashed border-amber-200 dark:border-amber-900/70 hover:border-amber-400 dark:hover:border-amber-600 bg-amber-50/40 dark:bg-amber-950/20 hover:bg-amber-50 dark:hover:bg-amber-950/40 transition-all flex flex-col items-center justify-center text-center group cursor-pointer"
              >
                <div className="w-8 h-8 rounded-full bg-amber-100 dark:bg-amber-900/60 text-amber-600 dark:text-amber-400 flex items-center justify-center group-hover:scale-110 transition-transform mb-1.5">
                  <Plus className="w-4 h-4" />
                </div>
                <span className="text-xs font-bold text-amber-900 dark:text-amber-200">
                  + Add Short Term Plan
                </span>
                <span className="text-[10px] text-amber-700/70 dark:text-amber-400/70">
                  Days or weeks goal
                </span>
              </button>
            )}

            {shortTermPlans.map((plan) => {
              const completedCount = plan.items.filter((it) => it.completed).length;
              const totalCount = plan.items.length;
              const percent = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;
              const isAllDone = totalCount > 0 && completedCount === totalCount;

              return (
                <div
                  key={plan.id}
                  onClick={() => setActiveDetailPlanId(plan.id)}
                  className="min-h-[110px] p-3.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-amber-300 dark:hover:border-amber-600 shadow-xs hover:shadow-md transition-all cursor-pointer flex flex-col justify-between group relative"
                >
                  {/* Top Row: Emoji & Title & Action Menu */}
                  <div>
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-xl p-1.5 bg-amber-50 dark:bg-amber-950/50 rounded-lg flex-shrink-0 border border-amber-100/80 dark:border-amber-900/60">
                          {plan.icon}
                        </span>
                        <div className="min-w-0">
                          <h3
                            className="text-xs font-bold text-gray-900 dark:text-gray-100 truncate group-hover:text-amber-600 dark:group-hover:text-amber-400 transition-colors"
                            title={plan.title}
                          >
                            {plan.title}
                          </h3>
                          <span className="text-[10px] text-gray-400 dark:text-gray-500 font-medium">
                            {totalCount === 0
                              ? 'No entries yet'
                              : `${completedCount} of ${totalCount} done`}
                          </span>
                        </div>
                      </div>

                      {/* Card Actions (Hover) */}
                      {!isReadOnly && (
                        <div
                          className="opacity-80 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity flex items-center gap-1"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <button
                            type="button"
                            onClick={(e) => handleOpenEditPlan(plan, e)}
                            className="p-1 text-gray-400 hover:text-amber-600 rounded hover:bg-gray-100 dark:hover:bg-gray-700"
                            title="Edit Plan Title/Icon"
                          >
                            <Edit2 className="w-3 h-3" />
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setConfirmDelete({
                                type: 'plan',
                                planId: plan.id,
                                title: plan.title,
                              });
                            }}
                            className="p-1 text-gray-400 hover:text-red-600 rounded hover:bg-red-50 dark:hover:bg-red-950/40"
                            title="Delete Plan"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Bottom Row: Progress Bar & Status */}
                  <div className="mt-2.5 pt-2 border-t border-gray-100 dark:border-gray-700/60">
                    <div className="flex items-center justify-between text-[10px] font-semibold text-gray-500 dark:text-gray-400 mb-1">
                      <span>{percent}% completed</span>
                      {isAllDone && (
                        <span className="text-emerald-600 dark:text-emerald-400 flex items-center gap-0.5">
                          <Check className="w-3 h-3" /> Done
                        </span>
                      )}
                    </div>
                    <div className="w-full bg-gray-100 dark:bg-gray-700 rounded-full h-1.5 overflow-hidden">
                      <div
                        className={`h-1.5 rounded-full transition-all duration-300 ${
                          isAllDone ? 'bg-emerald-500' : 'bg-amber-500'
                        }`}
                        style={{ width: `${percent}%` }}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* SECTION 2: Long Term Plans */}
      {(activeTabFilter === 'all' || activeTabFilter === 'long_term') && (
        <div className="space-y-3 pt-2">
          <div className="flex items-center justify-between border-b border-purple-100 dark:border-purple-950/50 pb-2">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-purple-500"></span>
              <h2 className="text-sm font-extrabold text-gray-800 dark:text-gray-200 uppercase tracking-wider flex items-center gap-1.5">
                <span>Long Term Plans</span>
                <span className="text-xs font-semibold text-gray-400 font-normal">
                  ({longTermPlans.length})
                </span>
              </h2>
            </div>

            {!isReadOnly && (
              <button
                type="button"
                onClick={() => handleOpenAddPlan('long_term')}
                className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-bold text-purple-700 dark:text-purple-300 bg-purple-50 dark:bg-purple-950/60 hover:bg-purple-100 dark:hover:bg-purple-900/60 border border-purple-200 dark:border-purple-800 rounded-lg transition-colors cursor-pointer shadow-2xs"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Long Term Plan</span>
              </button>
            )}
          </div>

          {/* Cards Grid: Small compact box type */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {/* Add Box Shortcut Card */}
            {!isReadOnly && (
              <button
                type="button"
                onClick={() => handleOpenAddPlan('long_term')}
                className="min-h-[110px] p-3.5 rounded-xl border-2 border-dashed border-purple-200 dark:border-purple-900/70 hover:border-purple-400 dark:hover:border-purple-600 bg-purple-50/40 dark:bg-purple-950/20 hover:bg-purple-50 dark:hover:bg-purple-950/40 transition-all flex flex-col items-center justify-center text-center group cursor-pointer"
              >
                <div className="w-8 h-8 rounded-full bg-purple-100 dark:bg-purple-900/60 text-purple-600 dark:text-purple-400 flex items-center justify-center group-hover:scale-110 transition-transform mb-1.5">
                  <Plus className="w-4 h-4" />
                </div>
                <span className="text-xs font-bold text-purple-900 dark:text-purple-200">
                  + Add Long Term Plan
                </span>
                <span className="text-[10px] text-purple-700/70 dark:text-purple-400/70">
                  Months or years vision
                </span>
              </button>
            )}

            {longTermPlans.map((plan) => {
              const completedCount = plan.items.filter((it) => it.completed).length;
              const totalCount = plan.items.length;
              const percent = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;
              const isAllDone = totalCount > 0 && completedCount === totalCount;

              return (
                <div
                  key={plan.id}
                  onClick={() => setActiveDetailPlanId(plan.id)}
                  className="min-h-[110px] p-3.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-purple-300 dark:hover:border-purple-600 shadow-xs hover:shadow-md transition-all cursor-pointer flex flex-col justify-between group relative"
                >
                  {/* Top Row: Emoji & Title & Action Menu */}
                  <div>
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-xl p-1.5 bg-purple-50 dark:bg-purple-950/50 rounded-lg flex-shrink-0 border border-purple-100/80 dark:border-purple-900/60">
                          {plan.icon}
                        </span>
                        <div className="min-w-0">
                          <h3
                            className="text-xs font-bold text-gray-900 dark:text-gray-100 truncate group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors"
                            title={plan.title}
                          >
                            {plan.title}
                          </h3>
                          <span className="text-[10px] text-gray-400 dark:text-gray-500 font-medium">
                            {totalCount === 0
                              ? 'No entries yet'
                              : `${completedCount} of ${totalCount} done`}
                          </span>
                        </div>
                      </div>

                      {/* Card Actions (Hover) */}
                      {!isReadOnly && (
                        <div
                          className="opacity-80 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity flex items-center gap-1"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <button
                            type="button"
                            onClick={(e) => handleOpenEditPlan(plan, e)}
                            className="p-1 text-gray-400 hover:text-purple-600 rounded hover:bg-gray-100 dark:hover:bg-gray-700"
                            title="Edit Plan Title/Icon"
                          >
                            <Edit2 className="w-3 h-3" />
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setConfirmDelete({
                                type: 'plan',
                                planId: plan.id,
                                title: plan.title,
                              });
                            }}
                            className="p-1 text-gray-400 hover:text-red-600 rounded hover:bg-red-50 dark:hover:bg-red-950/40"
                            title="Delete Plan"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Bottom Row: Progress Bar & Status */}
                  <div className="mt-2.5 pt-2 border-t border-gray-100 dark:border-gray-700/60">
                    <div className="flex items-center justify-between text-[10px] font-semibold text-gray-500 dark:text-gray-400 mb-1">
                      <span>{percent}% completed</span>
                      {isAllDone && (
                        <span className="text-emerald-600 dark:text-emerald-400 flex items-center gap-0.5">
                          <Check className="w-3 h-3" /> Done
                        </span>
                      )}
                    </div>
                    <div className="w-full bg-gray-100 dark:bg-gray-700 rounded-full h-1.5 overflow-hidden">
                      <div
                        className={`h-1.5 rounded-full transition-all duration-300 ${
                          isAllDone ? 'bg-emerald-500' : 'bg-purple-500'
                        }`}
                        style={{ width: `${percent}%` }}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── MODAL: Add / Edit Plan Card ────────────────────────────────────── */}
      {showAddPlanModal && (
        <div className="fixed inset-0 z-[9999] bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-gray-800 dark:to-gray-850">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-indigo-600 text-white flex items-center justify-center shadow-xs">
                  <Target className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-gray-900 dark:text-white">
                    {editingPlanId ? 'Edit Plan Card' : 'Add New Plan Card'}
                  </h3>
                  <p className="text-[11px] text-gray-500 dark:text-gray-400">
                    {planModalType === 'short_term' ? 'Short Term Plan' : 'Long Term Plan'}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowAddPlanModal(false)}
                className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Form */}
            <div className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
              {/* Plan Type Selector */}
              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                  Plan Category
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setPlanModalType('short_term')}
                    className={`py-2 px-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                      planModalType === 'short_term'
                        ? 'border-amber-500 bg-amber-50 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 shadow-2xs'
                        : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-750'
                    }`}
                  >
                    <span>⚡</span>
                    <span>Short Term</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setPlanModalType('long_term')}
                    className={`py-2 px-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                      planModalType === 'long_term'
                        ? 'border-purple-500 bg-purple-50 dark:bg-purple-950/60 text-purple-800 dark:text-purple-300 shadow-2xs'
                        : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-750'
                    }`}
                  >
                    <span>🚀</span>
                    <span>Long Term</span>
                  </button>
                </div>
              </div>

              {/* Title / Plan Name */}
              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                  Title / Plan Name
                </label>
                <input
                  type="text"
                  placeholder="e.g. Read 5 Books, Learn TypeScript, Buy Car..."
                  value={planModalTitle}
                  onChange={(e) => setPlanModalTitle(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && planModalTitle.trim() && !isDuplicatePlanTitle) {
                      handleSavePlanCard();
                    }
                  }}
                  autoFocus
                  className={`w-full px-3.5 py-2 text-xs border rounded-xl bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 transition-all ${
                    isDuplicatePlanTitle
                      ? 'border-red-400 dark:border-red-500 focus:ring-red-400'
                      : 'border-gray-300 dark:border-gray-600 focus:ring-indigo-500'
                  }`}
                />
                {isDuplicatePlanTitle ? (
                  <p className="text-xs text-red-500 dark:text-red-400 mt-1.5 flex items-center gap-1 font-medium">
                    <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                    A plan with this title already exists. Please choose a unique title.
                  </p>
                ) : (
                  <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-1">
                    Add a clear, action-oriented title for this plan.
                  </p>
                )}
              </div>

              {/* Emoji Icon Picker */}
              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1 flex items-center justify-between">
                  <span>Icon / Emoji</span>
                  <span className="text-gray-400 font-normal text-[11px]">
                    Selected: {planModalIcon}
                  </span>
                </label>

                {/* Category tabs */}
                <div className="flex items-center gap-1 border-b border-gray-200 dark:border-gray-700 mb-2 overflow-x-auto pb-1">
                  {PLAN_EMOJI_CATEGORIES.map((cat, idx) => (
                    <button
                      key={cat.name}
                      type="button"
                      onClick={() => setActiveEmojiTab(idx)}
                      className={`px-2 py-1 rounded-lg text-xs font-semibold flex items-center gap-1 whitespace-nowrap transition-all cursor-pointer ${
                        activeEmojiTab === idx
                          ? 'bg-indigo-600 text-white'
                          : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-650'
                      }`}
                    >
                      <span>{cat.icon}</span>
                      <span>{cat.name}</span>
                    </button>
                  ))}
                </div>

                {/* Emoji Grid */}
                <div className="grid grid-cols-7 gap-1.5 p-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl">
                  {PLAN_EMOJI_CATEGORIES[activeEmojiTab].emojis.map((emoji) => (
                    <button
                      key={emoji}
                      type="button"
                      onClick={() => setPlanModalIcon(emoji)}
                      className={`h-9 text-lg rounded-lg flex items-center justify-center transition-transform hover:scale-125 cursor-pointer ${
                        planModalIcon === emoji
                          ? 'bg-indigo-600 text-white shadow-md ring-2 ring-indigo-400'
                          : 'hover:bg-white dark:hover:bg-gray-800'
                      }`}
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="px-6 py-4 border-t border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-850 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowAddPlanModal(false)}
                className="px-4 py-2 text-xs font-semibold text-gray-600 dark:text-gray-300 hover:text-gray-800 dark:hover:text-white rounded-xl hover:bg-gray-200/60 dark:hover:bg-gray-700 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSavePlanCard}
                disabled={!planModalTitle.trim() || isDuplicatePlanTitle}
                className="px-5 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-md transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
              >
                {editingPlanId ? 'Save Changes' : 'Create Plan Card'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL: Plan Detail & Checklist (On Click of Box) ─────────────── */}
      {activeDetailPlan && (
        <div className="fixed inset-0 z-[9998] bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
          <div className="bg-white dark:bg-gray-850 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-700 bg-gradient-to-r from-indigo-50/80 via-purple-50/50 to-pink-50/40 dark:from-gray-800 dark:to-gray-850 flex items-center justify-between">
              <div className="flex items-center gap-3 min-w-0">
                <span className="text-2xl p-2 bg-white dark:bg-gray-800 rounded-xl shadow-xs border border-gray-100 dark:border-gray-700 flex-shrink-0">
                  {activeDetailPlan.icon}
                </span>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h2 className="text-base font-bold text-gray-900 dark:text-white truncate">
                      {activeDetailPlan.title}
                    </h2>
                    <span
                      className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full uppercase tracking-wider shrink-0 ${
                        activeDetailPlan.type === 'short_term'
                          ? 'bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300'
                          : 'bg-purple-100 dark:bg-purple-950/80 text-purple-800 dark:text-purple-300'
                      }`}
                    >
                      {activeDetailPlan.type === 'short_term' ? 'Short Term' : 'Long Term'}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                    {activeDetailPlan.items.filter((it) => it.completed).length} of{' '}
                    {activeDetailPlan.items.length} tasks completed
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-1">
                {!isReadOnly && (
                  <button
                    type="button"
                    onClick={(e) => handleOpenEditPlan(activeDetailPlan, e)}
                    className="p-1.5 text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 rounded-lg hover:bg-white dark:hover:bg-gray-750 transition-colors"
                    title="Rename or Change Emoji"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => {
                    setActiveDetailPlanId(null);
                    setShowAddEntryLine(false);
                    setEditingItem(null);
                  }}
                  className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded-lg hover:bg-white dark:hover:bg-gray-750 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Progress Bar Header Bar */}
            <div className="w-full bg-gray-100 dark:bg-gray-700 h-1.5">
              <div
                className={`h-1.5 transition-all duration-300 ${
                  activeDetailPlan.type === 'short_term' ? 'bg-amber-500' : 'bg-purple-500'
                }`}
                style={{
                  width: `${
                    activeDetailPlan.items.length > 0
                      ? Math.round(
                          (activeDetailPlan.items.filter((it) => it.completed).length /
                            activeDetailPlan.items.length) *
                            100
                        )
                      : 0
                  }%`,
                }}
              />
            </div>

            {/* Modal Body: Checklist Items & Add Entry */}
            <div className="p-6 space-y-4 overflow-y-auto flex-1">
              {/* Add Entry Action Button */}
              {!isReadOnly && !showAddEntryLine && (
                <button
                  type="button"
                  onClick={() => {
                    setShowAddEntryLine(true);
                    setNewEntryTitle('');
                    setNewEntryDescription('');
                    setIsNewEntryDescExpanded(false);
                  }}
                  className="w-full py-2.5 px-3 border border-dashed border-indigo-300 dark:border-indigo-700 hover:border-indigo-500 bg-indigo-50/50 hover:bg-indigo-50 dark:bg-indigo-950/20 dark:hover:bg-indigo-950/40 rounded-xl text-xs font-bold text-indigo-700 dark:text-indigo-300 transition-all flex items-center justify-center gap-1.5 shadow-2xs cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>Add Entry / Milestone</span>
                </button>
              )}

              {/* ── DRAFT: Add Entry Box (Checkbox + Empty Line + Expand Description + Tik Button) ── */}
              {showAddEntryLine && (
                <div className="p-3.5 border-2 border-indigo-400 dark:border-indigo-600 rounded-xl bg-indigo-50/30 dark:bg-indigo-950/30 space-y-2.5 shadow-sm animate-in fade-in duration-150">
                  {/* Title row with checkbox placeholder, input line, expand description button, and tik save button */}
                  <div className="flex items-center gap-2">
                    {/* Checkbox Placeholder */}
                    <div className="text-gray-300 dark:text-gray-600 p-0.5" title="New unchecked entry">
                      <Circle className="w-4 h-4" />
                    </div>

                    {/* Empty Line Input for Task Name */}
                    <input
                      type="text"
                      placeholder="Add an entry / milestone title..."
                      value={newEntryTitle}
                      onChange={(e) => setNewEntryTitle(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !isNewEntryDescExpanded && newEntryTitle.trim()) {
                          handleSaveNewEntry();
                        }
                      }}
                      autoFocus
                      className="flex-1 px-3 py-1.5 text-xs bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-400"
                    />

                    {/* Expand/Collapse Description Toggle */}
                    <button
                      type="button"
                      onClick={() => setIsNewEntryDescExpanded(!isNewEntryDescExpanded)}
                      className={`px-2 py-1.5 text-[11px] font-semibold rounded-lg border transition-colors flex items-center gap-1 cursor-pointer shrink-0 ${
                        isNewEntryDescExpanded || newEntryDescription
                          ? 'bg-indigo-100 dark:bg-indigo-900 text-indigo-700 dark:text-indigo-300 border-indigo-200'
                          : 'bg-white dark:bg-gray-800 text-gray-500 dark:text-gray-400 border-gray-200 dark:border-gray-700 hover:bg-gray-100'
                      }`}
                      title="Add detail description/notes"
                    >
                      <AlignLeft className="w-3 h-3" />
                      <span className="hidden sm:inline">Notes</span>
                      {isNewEntryDescExpanded ? (
                        <ChevronUp className="w-3 h-3" />
                      ) : (
                        <ChevronDown className="w-3 h-3" />
                      )}
                    </button>

                    {/* Green Tik Save Button */}
                    <button
                      type="button"
                      onClick={handleSaveNewEntry}
                      disabled={!newEntryTitle.trim()}
                      className="p-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-all disabled:opacity-40 disabled:cursor-not-allowed shadow-2xs cursor-pointer"
                      title="Save entry (Tik)"
                    >
                      <Check className="w-4 h-4" />
                    </button>

                    {/* Cancel Button */}
                    <button
                      type="button"
                      onClick={() => {
                        setShowAddEntryLine(false);
                        setNewEntryTitle('');
                        setNewEntryDescription('');
                      }}
                      className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-200/50 rounded-lg cursor-pointer"
                      title="Cancel"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Expandable Detail Description Textarea */}
                  {isNewEntryDescExpanded && (
                    <div className="pl-6 animate-in fade-in slide-in-from-top-1 duration-150">
                      <textarea
                        rows={2}
                        placeholder="Write detailed notes, steps, links, or requirements here..."
                        value={newEntryDescription}
                        onChange={(e) => setNewEntryDescription(e.target.value)}
                        className="w-full px-3 py-1.5 text-xs bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-400 resize-none"
                      />
                    </div>
                  )}
                </div>
              )}

              {/* Checklist Items List */}
              {activeDetailPlan.items.length === 0 && !showAddEntryLine ? (
                <div className="text-center py-10 px-4 border border-dashed border-gray-200 dark:border-gray-700 rounded-xl">
                  <ListTodo className="w-8 h-8 text-gray-300 dark:text-gray-600 mx-auto mb-2" />
                  <p className="text-xs font-semibold text-gray-500 dark:text-gray-400">
                    No entries added to this plan yet.
                  </p>
                  <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-0.5">
                    Click "+ Add Entry" above to add your first task or milestone.
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {activeDetailPlan.items.map((item) => {
                    const isDescExpanded = Boolean(expandedItemDescriptions[item.id]);
                    const isEditingThis = editingItem?.id === item.id;

                    if (isEditingThis) {
                      return (
                        <div
                          key={item.id}
                          className="p-3 border border-indigo-300 dark:border-indigo-700 rounded-xl bg-indigo-50/40 dark:bg-indigo-950/40 space-y-2"
                        >
                          <div className="flex items-center gap-2">
                            <input
                              type="text"
                              value={editingItem.title}
                              onChange={(e) =>
                                setEditingItem({ ...editingItem, title: e.target.value })
                              }
                              className="flex-1 px-3 py-1.5 text-xs bg-white dark:bg-gray-800 border border-indigo-200 dark:border-indigo-700 rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-400"
                            />
                            <button
                              type="button"
                              onClick={handleSaveEditItem}
                              disabled={!editingItem.title.trim()}
                              className="p-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-colors cursor-pointer"
                              title="Save edits"
                            >
                              <Check className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditingItem(null)}
                              className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg cursor-pointer"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                          <textarea
                            rows={2}
                            placeholder="Detail description / notes..."
                            value={editingItem.description}
                            onChange={(e) =>
                              setEditingItem({ ...editingItem, description: e.target.value })
                            }
                            className="w-full px-3 py-1.5 text-xs bg-white dark:bg-gray-800 border border-indigo-200 dark:border-indigo-700 rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-400 resize-none"
                          />
                        </div>
                      );
                    }

                    return (
                      <div
                        key={item.id}
                        className={`p-3 rounded-xl border transition-all ${
                          item.completed
                            ? 'bg-gray-50/70 dark:bg-gray-900/50 border-gray-200 dark:border-gray-800 opacity-80'
                            : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 shadow-2xs'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2.5">
                          {/* Left: Checkbox & Title */}
                          <div className="flex items-start gap-2.5 min-w-0 flex-1">
                            {/* Checkbox */}
                            <button
                              type="button"
                              onClick={() => handleToggleItem(activeDetailPlan.id, item.id)}
                              disabled={isReadOnly}
                              className={`mt-0.5 p-0.5 rounded transition-transform active:scale-95 cursor-pointer ${
                                isReadOnly ? 'cursor-default' : ''
                              }`}
                              title={item.completed ? 'Mark as incomplete' : 'Mark as completed'}
                            >
                              {item.completed ? (
                                <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                              ) : (
                                <Circle className="w-4 h-4 text-gray-300 dark:text-gray-500 hover:text-gray-400" />
                              )}
                            </button>

                            {/* Title & Notes Summary */}
                            <div className="min-w-0 flex-1">
                              <span
                                className={`text-xs font-semibold block break-words select-text ${
                                  item.completed
                                    ? 'line-through text-gray-400 dark:text-gray-500'
                                    : 'text-gray-900 dark:text-gray-100'
                                }`}
                              >
                                {item.title}
                              </span>

                              {/* Description Preview or Expandable Text */}
                              {item.description && (
                                <div className="mt-1">
                                  {isDescExpanded ? (
                                    <p className="text-xs text-gray-600 dark:text-gray-300 bg-gray-50 dark:bg-gray-900/80 p-2 rounded-lg border border-gray-100 dark:border-gray-750 whitespace-pre-wrap leading-relaxed">
                                      {item.description}
                                    </p>
                                  ) : (
                                    <p className="text-[11px] text-gray-400 dark:text-gray-500 truncate max-w-md">
                                      {item.description}
                                    </p>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Right: Expand Description toggle, Edit, Delete */}
                          <div className="flex items-center gap-1 shrink-0 pt-0.5">
                            {item.description && (
                              <button
                                type="button"
                                onClick={() => toggleItemDescription(item.id)}
                                className="p-1 text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 rounded hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                                title={isDescExpanded ? 'Collapse notes' : 'Expand notes'}
                              >
                                {isDescExpanded ? (
                                  <ChevronUp className="w-3.5 h-3.5" />
                                ) : (
                                  <ChevronDown className="w-3.5 h-3.5" />
                                )}
                              </button>
                            )}

                            {!isReadOnly && (
                              <>
                                <button
                                  type="button"
                                  onClick={() =>
                                    setEditingItem({
                                      id: item.id,
                                      title: item.title,
                                      description: item.description || '',
                                    })
                                  }
                                  className="p-1 text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 rounded hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                                  title="Edit entry"
                                >
                                  <Edit2 className="w-3 h-3" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() =>
                                    setConfirmDelete({
                                      type: 'item',
                                      planId: activeDetailPlan.id,
                                      itemId: item.id,
                                      title: item.title,
                                    })
                                  }
                                  className="p-1 text-gray-400 hover:text-red-600 dark:hover:text-red-400 rounded hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors"
                                  title="Delete entry"
                                >
                                  <Trash2 className="w-3 h-3" />
                                </button>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-3 border-t border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-850 flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
              <span>
                {activeDetailPlan.items.filter((it) => it.completed).length} /{' '}
                {activeDetailPlan.items.length} completed
              </span>
              <button
                type="button"
                onClick={() => setActiveDetailPlanId(null)}
                className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-xs transition-colors cursor-pointer"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Global Confirm Delete Dialog ─────────────────────────────────── */}
      {confirmDelete && (
        <ConfirmDialog
          title={
            confirmDelete.type === 'plan' ? 'Delete Plan Card?' : 'Delete Plan Entry?'
          }
          message={
            confirmDelete.type === 'plan'
              ? `Are you sure you want to delete the plan "${confirmDelete.title}" along with all its checklist entries?`
              : `Are you sure you want to delete "${confirmDelete.title}"?`
          }
          confirmText="Delete"
          cancelText="Cancel"
          onConfirm={() => {
            if (confirmDelete.type === 'plan') {
              handleDeletePlanCard(confirmDelete.planId);
            } else if (confirmDelete.itemId) {
              handleDeleteItem(confirmDelete.planId, confirmDelete.itemId);
            }
            setConfirmDelete(null);
          }}
          onCancel={() => setConfirmDelete(null)}
        />
      )}
    </div>
  );
}

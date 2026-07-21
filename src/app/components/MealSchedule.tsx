import { useState, useRef, useEffect, useCallback } from 'react';
import { useSupabasePersistedState } from '../hooks/useSupabasePersistedState';
import { createPortal } from 'react-dom';
import { Check, Pencil, UtensilsCrossed, Plus, X, ChevronDown, ChevronLeft, ChevronRight, List, Trash2, Save } from 'lucide-react';
import { format, startOfWeek, addDays, addWeeks, subWeeks, isToday } from 'date-fns';

type Person = 'partner1' | 'partner2' | 'both';
type MealStatus = 'planned' | 'cooked' | 'changed' | 'ate-out';
type MealType = 'morningDrink' | 'breakfast' | 'snacks' | 'lunch' | 'fruit' | 'dinner';

interface MealEntry { planned: string; status: MealStatus; actual?: string; }
interface Props { activePerson: Person; partner1Name: string; partner2Name: string; accessToken: string | null; onUnsavedChanges?: (hasChanges: boolean, save: () => void) => void; }

const MEAL_COLUMNS: { key: MealType; label: string; color: string }[] = [
  { key: 'morningDrink', label: 'Morning Drink', color: 'sky' },
  { key: 'breakfast',    label: 'Breakfast',     color: 'amber' },
  { key: 'snacks',       label: 'Snacks',        color: 'lime' },
  { key: 'lunch',        label: 'Lunch',         color: 'orange' },
  { key: 'fruit',        label: 'Fruit',         color: 'pink' },
  { key: 'dinner',       label: 'Dinner',        color: 'violet' },
];

const COL_STYLES: Record<string, { header: string; badge: string }> = {
  sky:    { header: 'bg-sky-50 text-sky-800 border-sky-200',         badge: 'bg-sky-100 text-sky-700 border-sky-300' },
  amber:  { header: 'bg-amber-50 text-amber-800 border-amber-200',   badge: 'bg-amber-100 text-amber-700 border-amber-300' },
  lime:   { header: 'bg-lime-50 text-lime-800 border-lime-200',      badge: 'bg-lime-100 text-lime-700 border-lime-300' },
  orange: { header: 'bg-orange-50 text-orange-800 border-orange-200',badge: 'bg-orange-100 text-orange-700 border-orange-300' },
  pink:   { header: 'bg-pink-50 text-pink-800 border-pink-200',      badge: 'bg-pink-100 text-pink-700 border-pink-300' },
  violet: { header: 'bg-violet-50 text-violet-800 border-violet-200',badge: 'bg-violet-100 text-violet-700 border-violet-300' },
};

type OptionsByMeal = Record<MealType, string[]>;
type WeekPlan = Record<string, Record<MealType, MealEntry>>;

const emptyEntry = (): MealEntry => ({ planned: '', status: 'planned' });
const emptyDay = (): Record<MealType, MealEntry> => ({
  morningDrink: emptyEntry(), breakfast: emptyEntry(), snacks: emptyEntry(),
  lunch: emptyEntry(), fruit: emptyEntry(), dinner: emptyEntry(),
});

// Computes fixed position for a portal panel anchored below a trigger element
function usePortalPosition(btnRef: React.RefObject<HTMLButtonElement | null>, open: boolean) {
  const [pos, setPos] = useState({ top: 0, left: 0, flipRight: false });

  const compute = useCallback(() => {
    if (!btnRef.current) return;
    const r = btnRef.current.getBoundingClientRect();
    const panelW = 220;
    const flipRight = r.left + panelW > window.innerWidth - 8;
    setPos({
      top: r.bottom + 6,
      left: flipRight ? Math.max(8, r.right - panelW) : r.left,
      flipRight,
    });
  }, [btnRef]);

  useEffect(() => {
    if (open) compute();
  }, [open, compute]);

  useEffect(() => {
    if (!open) return;
    window.addEventListener('scroll', compute, true);
    window.addEventListener('resize', compute);
    return () => {
      window.removeEventListener('scroll', compute, true);
      window.removeEventListener('resize', compute);
    };
  }, [open, compute]);

  return pos;
}

// ── Column header list manager (portal) ──────────────────────────────────────
function ColumnListManager({ label, color, options, onAdd, onDelete }: {
  label: string; color: string; options: string[];
  onAdd: (v: string) => void; onDelete: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const btnRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const pos = usePortalPosition(btnRef, open);
  const styles = COL_STYLES[color];

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as Node;
      if (btnRef.current?.contains(target) || panelRef.current?.contains(target)) return;
      setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const handleAdd = () => {
    const t = input.trim();
    if (t && !options.includes(t)) { onAdd(t); setInput(''); }
  };

  return (
    <>
      <button
        ref={btnRef}
        onClick={() => setOpen((o) => !o)}
        title={`Manage ${label} list`}
        className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-medium border transition-colors mt-1.5 ${styles.badge} hover:opacity-80`}
      >
        <List className="w-3 h-3 flex-shrink-0" />
        <span>Manage list</span>
        {options.length > 0 && (
          <span className="ml-0.5 bg-white/70 px-1 rounded-full">{options.length}</span>
        )}
      </button>

      {open && createPortal(
        <div
          ref={panelRef}
          style={{ position: 'fixed', top: pos.top, left: pos.left, width: 220, zIndex: 9999 }}
          className="bg-white border border-gray-200 rounded-xl shadow-2xl overflow-hidden"
        >
          {/* Header */}
          <div className={`px-3 py-2 border-b border-gray-100 flex items-center justify-between ${styles.header}`}>
            <p className="text-xs font-semibold">{label} options</p>
            <button onClick={() => setOpen(false)} className="p-0.5 hover:opacity-60 rounded">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Add input */}
          <div className="p-2 border-b border-gray-100 flex gap-1.5">
            <input
              type="text"
              placeholder="Add option…"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
              autoFocus
              className="flex-1 min-w-0 px-2.5 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-400"
            />
            <button
              onClick={handleAdd}
              disabled={!input.trim()}
              className="flex-shrink-0 px-2.5 py-1.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-40"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* List */}
          <div className="max-h-52 overflow-y-auto">
            {options.length === 0 && (
              <p className="px-3 py-4 text-xs text-gray-400 italic text-center">No items yet</p>
            )}
            {options.map((opt) => (
              <div key={opt} className="flex items-center justify-between px-3 py-2 hover:bg-gray-50 group">
                <span className="text-xs text-gray-700 flex-1 min-w-0 truncate" title={opt}>{opt}</span>
                <button
                  onClick={() => onDelete(opt)}
                  className="flex-shrink-0 ml-2 p-1 text-red-400 hover:text-red-600 hover:bg-red-50 rounded opacity-0 group-hover:opacity-100 transition-all"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        </div>,
        document.body
      )}
    </>
  );
}

// ── Cell meal dropdown (portal) ───────────────────────────────────────────────
function MealDropdown({ value, options, placeholder, onChange, onAddOption, onDeleteOption }: {
  value: string; options: string[]; placeholder?: string;
  onChange: (v: string) => void; onAddOption: (v: string) => void; onDeleteOption?: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [newItem, setNewItem] = useState('');
  const btnRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const pos = usePortalPosition(btnRef, open);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as Node;
      if (btnRef.current?.contains(target) || panelRef.current?.contains(target)) return;
      setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const handleAdd = () => {
    const t = newItem.trim();
    if (t && !options.includes(t)) { onAddOption(t); onChange(t); setNewItem(''); setOpen(false); }
  };

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={`w-full flex items-center justify-between gap-1 px-2.5 py-2 text-xs rounded-lg border transition-colors text-left ${
          value
            ? 'bg-white border-gray-300 text-gray-800 hover:border-indigo-400'
            : 'bg-gray-50 border-dashed border-gray-300 text-gray-400 hover:border-indigo-400'
        }`}
      >
        <span className="truncate">{value || placeholder || 'Select…'}</span>
        <ChevronDown className={`w-3 h-3 flex-shrink-0 text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && createPortal(
        <div
          ref={panelRef}
          style={{ position: 'fixed', top: pos.top, left: pos.left, width: 200, zIndex: 9999 }}
          className="bg-white border border-gray-200 rounded-xl shadow-xl overflow-hidden"
        >
          <div className="max-h-48 overflow-y-auto">
            {value && (
              <button
                onClick={() => { onChange(''); setOpen(false); }}
                className="w-full text-left px-3 py-2 text-xs text-red-500 hover:bg-red-50 border-b border-gray-100 flex items-center gap-1"
              >
                <X className="w-3 h-3" /> Clear
              </button>
            )}
            {options.length === 0 && (
              <p className="px-3 py-3 text-xs text-gray-400 italic text-center">No items — add below</p>
            )}
            {options.map((opt) => (
              <div
                key={opt}
                className={`w-full flex items-center justify-between px-3 py-1.5 text-xs transition-colors group ${
                  opt === value
                    ? 'bg-indigo-50 text-indigo-700 font-medium'
                    : 'text-gray-700 hover:bg-indigo-50 hover:text-indigo-700'
                }`}
              >
                <button
                  type="button"
                  onClick={() => { onChange(opt); setOpen(false); }}
                  className="flex-1 text-left truncate pr-2 py-0.5"
                >
                  {opt}
                </button>
                {onDeleteOption && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeleteOption(opt);
                    }}
                    className="flex-shrink-0 p-1 text-gray-400 hover:text-red-600 rounded hover:bg-gray-100 transition-colors opacity-0 group-hover:opacity-100"
                    title={`Delete ${opt}`}
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                )}
              </div>
            ))}
          </div>
          <div className="border-t border-gray-100 p-2 flex gap-1.5 bg-gray-50">
            <input
              type="text"
              placeholder="Add new item…"
              value={newItem}
              onChange={(e) => setNewItem(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
              className="flex-1 min-w-0 px-2.5 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-white"
            />
            <button
              onClick={handleAdd}
              disabled={!newItem.trim()}
              className="flex-shrink-0 px-2.5 py-1.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-40"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}

// ── Meal cell ─────────────────────────────────────────────────────────────────
function MealCell({ entry, options, onAddOption, onDeleteOption, onChange }: {
  entry: MealEntry; options: string[];
  onAddOption: (v: string) => void; onDeleteOption: (v: string) => void; onChange: (e: MealEntry) => void;
}) {
  const setStatus = (s: MealStatus) =>
    onChange({ ...entry, status: s === entry.status ? 'planned' : s, actual: s === 'changed' ? entry.actual : undefined });

  return (
    <div className="flex flex-col gap-1.5 p-2 min-w-[148px]">
      <MealDropdown
        value={entry.planned} options={options} placeholder="— none —"
        onChange={(v) => onChange({ ...entry, planned: v, status: 'planned', actual: undefined })}
        onAddOption={onAddOption}
        onDeleteOption={onDeleteOption}
      />

      {entry.planned && (
        <>
          <div className="flex items-center gap-1">
            <button title="Cooked as planned" onClick={() => setStatus('cooked')}
              className={`flex-1 flex items-center justify-center py-1 rounded-lg text-xs transition-colors ${
                entry.status === 'cooked' ? 'bg-green-500 text-white' : 'bg-gray-100 text-gray-500 hover:bg-green-100 hover:text-green-700'
              }`}>
              <Check className="w-3.5 h-3.5" />
            </button>
            <button title="Had something different" onClick={() => setStatus('changed')}
              className={`flex-1 flex items-center justify-center py-1 rounded-lg text-xs transition-colors ${
                entry.status === 'changed' ? 'bg-orange-500 text-white' : 'bg-gray-100 text-gray-500 hover:bg-orange-100 hover:text-orange-700'
              }`}>
              <Pencil className="w-3.5 h-3.5" />
            </button>
            <button title="Ate out / ordered" onClick={() => setStatus('ate-out')}
              className={`flex-1 flex items-center justify-center py-1 rounded-lg text-xs transition-colors ${
                entry.status === 'ate-out' ? 'bg-purple-500 text-white' : 'bg-gray-100 text-gray-500 hover:bg-purple-100 hover:text-purple-700'
              }`}>
              <UtensilsCrossed className="w-3.5 h-3.5" />
            </button>
          </div>

          {entry.status !== 'planned' && (
            <span className={`text-[10px] font-semibold text-center py-0.5 rounded-md ${
              entry.status === 'cooked'  ? 'bg-green-50 text-green-700' :
              entry.status === 'changed' ? 'bg-orange-50 text-orange-700' :
                                           'bg-purple-50 text-purple-700'
            }`}>
              {entry.status === 'cooked' ? 'Cooked ✓' : entry.status === 'changed' ? 'Changed' : 'Ate Out'}
            </span>
          )}

          {entry.status === 'changed' && (
            <MealDropdown
              value={entry.actual || ''} options={options} placeholder="What did you have?"
              onChange={(v) => onChange({ ...entry, actual: v })}
              onAddOption={onAddOption}
              onDeleteOption={onDeleteOption}
            />
          )}
        </>
      )}
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────
const EMPTY_OPTIONS: OptionsByMeal = { morningDrink: [], breakfast: [], snacks: [], lunch: [], fruit: [], dinner: [] };

export default function MealSchedule({ activePerson, partner1Name, partner2Name, accessToken, onUnsavedChanges }: Props) {
  const [weekStart, setWeekStart] = useState<Date>(() =>
    startOfWeek(new Date(), { weekStartsOn: 1 })
  );
  const [plan, setPlan, savePlan, hasUnsavedPlan] = useSupabasePersistedState<WeekPlan>('meals_plan', {}, {}, accessToken);
  const [optionsByMeal, setOptionsByMeal, saveOptions, hasUnsavedOptions] = useSupabasePersistedState<OptionsByMeal>('meals_options', EMPTY_OPTIONS, EMPTY_OPTIONS, accessToken);
  const [showSaved, setShowSaved] = useState(false);

  const hasUnsavedChanges = hasUnsavedPlan || hasUnsavedOptions;

  useEffect(() => {
    onUnsavedChanges?.(hasUnsavedChanges, () => { savePlan(); saveOptions(); });
  }, [hasUnsavedChanges]);

  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const weekLabel = `${format(weekStart, 'MMM d')} – ${format(addDays(weekStart, 6), 'MMM d, yyyy')}`;

  const handleSave = () => {
    savePlan();
    saveOptions();
    setShowSaved(true);
    setTimeout(() => setShowSaved(false), 2000);
  };

  const getEntry = (dateStr: string, meal: MealType) => plan[dateStr]?.[meal] ?? emptyEntry();
  const setEntry = (dateStr: string, meal: MealType, entry: MealEntry) =>
    setPlan((prev) => ({ ...prev, [dateStr]: { ...(prev[dateStr] ?? emptyDay()), [meal]: entry } }));

  const addOption = (meal: MealType, v: string) =>
    setOptionsByMeal((prev) => ({
      ...prev,
      [meal]: prev[meal].includes(v) ? prev[meal] : [...prev[meal], v].sort(),
    }));

  const deleteOption = (meal: MealType, v: string) =>
    setOptionsByMeal((prev) => ({ ...prev, [meal]: prev[meal].filter((o) => o !== v) }));

  return (
    <div className="space-y-4">
      {/* Header with Save */}
      <div className="flex items-center justify-between">
        <div />
        <button
          onClick={handleSave}
          disabled={!hasUnsavedChanges}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
            showSaved
              ? 'bg-green-100 text-green-700 border border-green-300'
              : hasUnsavedChanges
                ? 'bg-indigo-600 text-white hover:bg-indigo-700'
                : 'bg-gray-100 text-gray-400 cursor-not-allowed'
          }`}
        >
          <Save className="w-4 h-4" />
          {showSaved ? 'Saved!' : hasUnsavedChanges ? 'Save Meals' : 'All Saved'}
        </button>
      </div>

      {/* Week nav */}
      <div className="flex items-center gap-2 flex-wrap">
        <button onClick={() => setWeekStart(subWeeks(weekStart, 1))}
          className="p-2 hover:bg-gray-100 rounded-lg border border-gray-200 transition-colors">
          <ChevronLeft className="w-4 h-4 text-gray-600" />
        </button>
        <span className="text-sm font-semibold text-gray-800 min-w-[180px] text-center">{weekLabel}</span>
        <button onClick={() => setWeekStart(addWeeks(weekStart, 1))}
          className="p-2 hover:bg-gray-100 rounded-lg border border-gray-200 transition-colors">
          <ChevronRight className="w-4 h-4 text-gray-600" />
        </button>
        <button onClick={() => setWeekStart(startOfWeek(new Date(), { weekStartsOn: 1 }))}
          className="px-3 py-1.5 text-xs bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-lg hover:bg-indigo-100 transition-colors">
          This week
        </button>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-3 text-xs text-gray-500 bg-white border border-gray-100 rounded-xl px-4 py-2.5">
        <span className="font-semibold text-gray-600 mr-1">Status:</span>
        <span className="flex items-center gap-1.5"><span className="w-5 h-5 bg-green-500 rounded-md flex items-center justify-center"><Check className="w-3 h-3 text-white" /></span>Cooked</span>
        <span className="flex items-center gap-1.5"><span className="w-5 h-5 bg-orange-500 rounded-md flex items-center justify-center"><Pencil className="w-3 h-3 text-white" /></span>Changed</span>
        <span className="flex items-center gap-1.5"><span className="w-5 h-5 bg-purple-500 rounded-md flex items-center justify-center"><UtensilsCrossed className="w-3 h-3 text-white" /></span>Ate out</span>
      </div>

      {/* Table */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr>
                <th className="sticky left-0 z-20 bg-gray-50 border-r border-b border-gray-200 px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide min-w-[100px] align-top">
                  Day
                </th>
                {MEAL_COLUMNS.map((col) => {
                  const styles = COL_STYLES[col.color];
                  return (
                    <th key={col.key}
                      className={`border-b border-r border-gray-200 px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide min-w-[160px] align-top ${styles.header}`}>
                      <span>{col.label}</span>
                      <ColumnListManager
                        label={col.label} color={col.color}
                        options={optionsByMeal[col.key]}
                        onAdd={(v) => addOption(col.key, v)}
                        onDelete={(v) => deleteOption(col.key, v)}
                      />
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {weekDays.map((day, i) => {
                const dateStr = format(day, 'yyyy-MM-dd');
                const todayRow = isToday(day);
                const rowBg = todayRow ? 'bg-indigo-50/50' : i % 2 === 0 ? 'bg-white' : 'bg-gray-50/40';
                const stickyBg = todayRow ? 'bg-indigo-50' : i % 2 === 0 ? 'bg-white' : 'bg-gray-50';
                return (
                  <tr key={dateStr} className={`${rowBg} hover:bg-indigo-50/30 transition-colors`}>
                    <td className={`sticky left-0 z-10 border-r border-b border-gray-100 px-4 py-3 align-top ${stickyBg}`}>
                      <div className={`font-semibold text-sm ${todayRow ? 'text-indigo-700' : 'text-gray-800'}`}>
                        {format(day, 'EEEE')}
                      </div>
                      <div className={`text-xs mt-0.5 ${todayRow ? 'text-indigo-500' : 'text-gray-400'}`}>
                        {format(day, 'MMM d')}
                      </div>
                      {todayRow && (
                        <span className="mt-1 inline-block text-[10px] bg-indigo-600 text-white px-1.5 py-0.5 rounded-full font-medium">
                          Today
                        </span>
                      )}
                    </td>
                    {MEAL_COLUMNS.map((col) => (
                      <td key={col.key} className="border-r border-b border-gray-100 align-top">
                        <MealCell
                          entry={getEntry(dateStr, col.key)}
                          options={optionsByMeal[col.key]}
                          onAddOption={(v) => addOption(col.key, v)}
                          onDeleteOption={(v) => deleteOption(col.key, v)}
                          onChange={(e) => setEntry(dateStr, col.key, e)}
                        />
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

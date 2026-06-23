import { useState, useRef, useEffect } from 'react';
import { Plus, Check, Trash2, Pencil, Save, ChevronLeft, ChevronRight, X } from 'lucide-react';
import { useSupabasePersistedState } from '../hooks/useSupabasePersistedState';
import { format, startOfWeek, addDays, parseISO, isToday } from 'date-fns';
import type { TrackingReminder } from '../App';
import ConfirmDialog from './ConfirmDialog';

type Person = 'partner1' | 'partner2' | 'both';

interface Habit {
  id: string;
  name: string;
}

interface HabitLog {
  habitId: string;
  date: string; // yyyy-MM-dd
  completed: boolean;
}

interface HabitData {
  habits: Habit[];
  logs: HabitLog[];
}

interface Props {
  activePerson: Person;
  partner1Name: string;
  partner2Name: string;
  trackingReminders: TrackingReminder[];
  onUpdateTrackingReminders: (reminders: TrackingReminder[]) => void;
  accessToken: string | null;
  onUnsavedChanges?: (hasChanges: boolean, save: () => void) => void;
}

const DEFAULT_HABITS: Habit[] = [
  { id: 'h1', name: 'Wake up 6:30' },
  { id: 'h2', name: 'Drink 3L water' },
  { id: 'h3', name: '0 Junk food' },
  { id: 'h4', name: '0 Sugar' },
];

const DEFAULT_DATA: HabitData = { habits: DEFAULT_HABITS, logs: [] };

function getWeekDays(weekOffset: number): Date[] {
  const base = startOfWeek(new Date(), { weekStartsOn: 1 });
  const start = addDays(base, weekOffset * 7);
  return Array.from({ length: 7 }, (_, i) => addDays(start, i));
}

export default function DailyActivities({ activePerson, partner1Name, partner2Name, trackingReminders, onUpdateTrackingReminders, accessToken, onUnsavedChanges }: Props) {
  const key = `habit_data_${activePerson}`;
  const [data, setData, saveData, hasUnsavedChanges, isLoaded] = useSupabasePersistedState<HabitData>(key, DEFAULT_DATA, DEFAULT_DATA, accessToken);

  const [weekOffset, setWeekOffset] = useState(0);
  const [showSaved, setShowSaved] = useState(false);
  const [newHabitName, setNewHabitName] = useState('');
  const [editingHabitId, setEditingHabitId] = useState<string | null>(null);
  const [editingHabitName, setEditingHabitName] = useState('');
  const [confirmDeleteHabit, setConfirmDeleteHabit] = useState<{ id: string; name: string } | null>(null);
  const editInputRef = useRef<HTMLInputElement>(null);

  const weekDays = getWeekDays(weekOffset);

  useEffect(() => {
    onUnsavedChanges?.(hasUnsavedChanges, () => { saveData(); });
  }, [hasUnsavedChanges]);

  const handleSave = () => {
    saveData();
    setShowSaved(true);
    setTimeout(() => setShowSaved(false), 2000);
  };

  const isChecked = (habitId: string, date: Date) => {
    const dateStr = format(date, 'yyyy-MM-dd');
    return data.logs.some((l) => l.habitId === habitId && l.date === dateStr && l.completed);
  };

  const toggleCheck = (habitId: string, date: Date) => {
    const dateStr = format(date, 'yyyy-MM-dd');
    const existing = data.logs.find((l) => l.habitId === habitId && l.date === dateStr);
    let newLogs: HabitLog[];
    if (existing) {
      newLogs = data.logs.map((l) =>
        l.habitId === habitId && l.date === dateStr ? { ...l, completed: !l.completed } : l
      );
    } else {
      newLogs = [...data.logs, { habitId, date: dateStr, completed: true }];
    }
    setData((d) => ({ ...d, logs: newLogs }));
  };

  const addHabit = () => {
    if (!newHabitName.trim()) return;
    const newHabit: Habit = { id: Date.now().toString(), name: newHabitName.trim() };
    setData((d) => ({ ...d, habits: [...d.habits, newHabit] }));
    setNewHabitName('');
  };

  const startEditHabit = (habit: Habit) => {
    setEditingHabitId(habit.id);
    setEditingHabitName(habit.name);
    setTimeout(() => editInputRef.current?.focus(), 50);
  };

  const confirmEditHabit = () => {
    if (!editingHabitName.trim() || !editingHabitId) return;
    setData((d) => ({
      ...d,
      habits: d.habits.map((h) => h.id === editingHabitId ? { ...h, name: editingHabitName.trim() } : h),
    }));
    setEditingHabitId(null);
  };

  const deleteHabit = (id: string) => {
    setData((d) => ({
      habits: d.habits.filter((h) => h.id !== id),
      logs: d.logs.filter((l) => l.habitId !== id),
    }));
    setConfirmDeleteHabit(null);
  };

  // Today's progress
  const today = new Date();
  const todayStr = format(today, 'yyyy-MM-dd');
  const todayCompleted = data.habits.filter((h) =>
    data.logs.some((l) => l.habitId === h.id && l.date === todayStr && l.completed)
  ).length;
  const todayTotal = data.habits.length;
  const todayProgress = todayTotal > 0 ? Math.round((todayCompleted / todayTotal) * 100) : 0;

  const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  if (!isLoaded) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-gray-500">Loading habits...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
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
          {showSaved ? 'Saved!' : hasUnsavedChanges ? 'Save Habits' : 'All Saved'}
        </button>
      </div>

      {/* Overall Progress — based on today's checkboxes */}
      <div className="bg-white rounded-lg p-6 border border-gray-200">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Overall Progress</h3>
            <p className="text-sm text-gray-500 mt-0.5">Today — {format(today, 'EEEE, MMM d')}</p>
          </div>
          <span className="text-3xl font-bold text-indigo-600">{todayProgress}%</span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-3">
          <div
            className="h-3 rounded-full transition-all bg-indigo-500"
            style={{ width: `${todayProgress}%` }}
          />
        </div>
        <p className="mt-2 text-sm text-gray-600">
          {todayCompleted} of {todayTotal} habits completed today
        </p>
      </div>

      {/* Weekly Habit Grid */}
      <div className="bg-white rounded-lg border border-gray-200">
        {/* Week navigation */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">Weekly Habits</h3>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setWeekOffset((w) => w - 1)}
              className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <ChevronLeft className="w-4 h-4 text-gray-600" />
            </button>
            <button
              onClick={() => setWeekOffset(0)}
              className={`px-3 py-1 text-xs rounded-lg font-medium transition-colors ${
                weekOffset === 0
                  ? 'bg-indigo-600 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              This Week
            </button>
            <button
              onClick={() => setWeekOffset((w) => w + 1)}
              className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <ChevronRight className="w-4 h-4 text-gray-600" />
            </button>
          </div>
        </div>

        {/* Week range label */}
        <div className="px-5 py-2 bg-gray-50 border-b border-gray-200 text-xs text-gray-500">
          {format(weekDays[0], 'MMM d')} – {format(weekDays[6], 'MMM d, yyyy')}
        </div>

        {data.habits.length === 0 ? (
          <div className="p-8 text-center text-gray-400">
            No habits yet. Add one below to start tracking.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[600px] border-collapse">
              <thead>
                <tr className="border-b border-gray-200">
                  {/* Habit name column header */}
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide w-40 bg-gray-50 sticky left-0 z-10">
                    Habit
                  </th>
                  {weekDays.map((day, i) => {
                    const todayCol = isToday(day);
                    return (
                      <th
                        key={i}
                        className={`px-2 py-3 text-center min-w-[56px] ${todayCol ? 'bg-indigo-50' : 'bg-gray-50'}`}
                      >
                        <div className={`text-xs font-semibold uppercase tracking-wide ${todayCol ? 'text-indigo-600' : 'text-gray-500'}`}>
                          {DAY_LABELS[i]}
                        </div>
                        <div className={`text-sm font-bold mt-0.5 ${todayCol ? 'text-indigo-700' : 'text-gray-700'}`}>
                          {format(day, 'd')}
                        </div>
                        {todayCol && (
                          <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 mx-auto mt-1" />
                        )}
                      </th>
                    );
                  })}
                  {/* Actions column */}
                  <th className="w-16 bg-gray-50" />
                </tr>
              </thead>
              <tbody>
                {data.habits.map((habit, hIdx) => (
                  <tr
                    key={habit.id}
                    className={`border-b border-gray-100 last:border-0 ${hIdx % 2 === 0 ? 'bg-white' : 'bg-gray-50/40'}`}
                  >
                    {/* Habit name */}
                    <td className={`px-4 py-3 sticky left-0 z-10 ${hIdx % 2 === 0 ? 'bg-white' : 'bg-gray-50/40'}`}>
                      {editingHabitId === habit.id ? (
                        <div className="flex items-center gap-1">
                          <input
                            ref={editInputRef}
                            type="text"
                            value={editingHabitName}
                            onChange={(e) => setEditingHabitName(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') confirmEditHabit();
                              if (e.key === 'Escape') setEditingHabitId(null);
                            }}
                            className="flex-1 min-w-0 text-sm px-2 py-1 border border-indigo-300 rounded focus:outline-none focus:ring-2 focus:ring-indigo-500"
                          />
                          <button onClick={confirmEditHabit} className="p-1 text-green-600 hover:bg-green-50 rounded">
                            <Check className="w-3.5 h-3.5" />
                          </button>
                          <button onClick={() => setEditingHabitId(null)} className="p-1 text-gray-400 hover:bg-gray-100 rounded">
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ) : (
                        <span className="text-sm font-medium text-gray-800 truncate block max-w-[130px]" title={habit.name}>
                          {habit.name}
                        </span>
                      )}
                    </td>

                    {/* Checkbox cells */}
                    {weekDays.map((day, dIdx) => {
                      const checked = isChecked(habit.id, day);
                      const todayCol = isToday(day);
                      return (
                        <td
                          key={dIdx}
                          className={`px-2 py-3 text-center ${todayCol ? 'bg-indigo-50/60' : ''}`}
                        >
                          <button
                            onClick={() => toggleCheck(habit.id, day)}
                            className={`w-7 h-7 rounded-md border-2 flex items-center justify-center mx-auto transition-all ${
                              checked
                                ? todayCol
                                  ? 'bg-indigo-600 border-indigo-600 shadow-sm'
                                  : 'bg-green-500 border-green-500'
                                : todayCol
                                ? 'border-indigo-300 hover:border-indigo-500 hover:bg-indigo-50'
                                : 'border-gray-300 hover:border-gray-400 hover:bg-gray-50'
                            }`}
                          >
                            {checked && <Check className="w-4 h-4 text-white" strokeWidth={3} />}
                          </button>
                        </td>
                      );
                    })}

                    {/* Edit / Delete */}
                    <td className="px-2 py-3">
                      <div className="flex items-center gap-1 justify-center">
                        <button
                          onClick={() => startEditHabit(habit)}
                          className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded transition-colors"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => setConfirmDeleteHabit({ id: habit.id, name: habit.name })}
                          className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Weekly summary row */}
        {data.habits.length > 0 && (
          <div className="px-4 py-3 border-t border-gray-200 bg-gray-50 overflow-x-auto">
            <div className="flex items-center min-w-[600px]">
              <div className="w-40 flex-shrink-0 text-xs font-semibold text-gray-500 px-0">
                Daily total
              </div>
              {weekDays.map((day, i) => {
                const count = data.habits.filter((h) => isChecked(h.id, day)).length;
                const total = data.habits.length;
                const pct = total > 0 ? Math.round((count / total) * 100) : 0;
                const todayCol = isToday(day);
                return (
                  <div key={i} className="min-w-[56px] px-2 text-center">
                    <div className={`text-sm font-bold ${todayCol ? 'text-indigo-600' : count === total && total > 0 ? 'text-green-600' : 'text-gray-600'}`}>
                      {count}/{total}
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-1 mt-1">
                      <div
                        className={`h-1 rounded-full ${todayCol ? 'bg-indigo-500' : 'bg-green-500'}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
              <div className="w-16" />
            </div>
          </div>
        )}
      </div>

      {/* Add Habit */}
      <div className="bg-white rounded-lg p-5 border border-gray-200">
        <h3 className="text-sm font-semibold text-gray-700 mb-3">Add New Habit Column</h3>
        <div className="flex gap-2">
          <input
            type="text"
            placeholder="e.g. Exercise 30min, Read 20 pages…"
            value={newHabitName}
            onChange={(e) => setNewHabitName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addHabit()}
            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
          />
          <button
            onClick={addHabit}
            disabled={!newHabitName.trim()}
            className="px-5 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center gap-2 text-sm"
          >
            <Plus className="w-4 h-4" />
            Add
          </button>
        </div>
      </div>

      {/* Confirm delete habit */}
      {confirmDeleteHabit && (
        <ConfirmDialog
          title="Delete Habit"
          message={`Delete "${confirmDeleteHabit.name}"? All logged data for this habit will be removed.`}
          confirmText="Delete"
          cancelText="Cancel"
          onConfirm={() => deleteHabit(confirmDeleteHabit.id)}
          onCancel={() => setConfirmDeleteHabit(null)}
        />
      )}
    </div>
  );
}

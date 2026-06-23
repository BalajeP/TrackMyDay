import { useState, useMemo, useEffect } from 'react';
import { useSupabasePersistedState } from '../hooks/useSupabasePersistedState';
import { Plus, Trash2, ChevronDown, ChevronRight, Edit2, Check, X, Dumbbell, TrendingUp, Timer, Calendar, Save } from 'lucide-react';
import { format, startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth, parseISO, isWithinInterval } from 'date-fns';
import ConfirmDialog from './ConfirmDialog';

type Person = 'partner1' | 'partner2' | 'both';
type TimeFrame = 'daily' | 'weekly' | 'monthly';

interface WorkoutColumn {
  id: string;
  name: string;
  type: 'date' | 'text' | 'number';
}

interface WorkoutEntry {
  id: string;
  data: Record<string, string>;
  person: Person;
}

interface WorkoutCategory {
  id: string;
  name: string;
  columns: WorkoutColumn[];
  entries: WorkoutEntry[];
  expanded: boolean;
}

interface WeightEntry {
  id: string;
  date: string;
  weight: string;
  person: Person;
}

interface Props {
  activePerson: Person;
  partner1Name: string;
  partner2Name: string;
  accessToken: string | null;
}

const DEFAULT_WORKOUT_CATEGORIES: WorkoutCategory[] = [
  { id: '1', name: 'Walking', columns: [{ id: 'date', name: 'Date', type: 'date' }, { id: 'min', name: 'Min', type: 'number' }], entries: [], expanded: false },
  { id: '2', name: 'Upper Body Workout', columns: [{ id: 'date', name: 'Date', type: 'date' }, { id: 'min', name: 'Min', type: 'number' }], entries: [], expanded: false },
  { id: '3', name: 'Lower Body Workout', columns: [{ id: 'date', name: 'Date', type: 'date' }, { id: 'min', name: 'Min', type: 'number' }], entries: [], expanded: false },
  { id: '4', name: 'Cardio', columns: [{ id: 'date', name: 'Date', type: 'date' }, { id: 'min', name: 'Min', type: 'number' }], entries: [], expanded: false },
  { id: '5', name: 'Meditation', columns: [{ id: 'date', name: 'Date', type: 'date' }, { id: 'min', name: 'Min', type: 'number' }], entries: [], expanded: false },
  { id: '6', name: 'Running', columns: [{ id: 'date', name: 'Date', type: 'date' }, { id: 'min', name: 'Min', type: 'number' }], entries: [], expanded: false },
];

export default function WorkoutSchedule({ activePerson, accessToken, onUnsavedChanges }: Props) {
  const [timeFrame, setTimeFrame] = useState<TimeFrame>('daily');
  const [categories, setCategories, saveCategories, hasUnsavedCategories] = useSupabasePersistedState<WorkoutCategory[]>('workout_categories', DEFAULT_WORKOUT_CATEGORIES, DEFAULT_WORKOUT_CATEGORIES, accessToken);

  // Separate weight tracking
  const [weightEntries, setWeightEntries, saveWeights, hasUnsavedWeights] = useSupabasePersistedState<WeightEntry[]>('workout_weights', [], [], accessToken);
  const [newWeightDate, setNewWeightDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [newWeight, setNewWeight] = useState('');
  const [newCategoryName, setNewCategoryName] = useState('');
  const [editingColumn, setEditingColumn] = useState<{ categoryId: string; columnId: string } | null>(null);
  const [columnEditValue, setColumnEditValue] = useState('');
  const [showSaved, setShowSaved] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<{
    type: 'category' | 'entry' | 'column' | 'weight';
    categoryId?: string;
    categoryName?: string;
    entryId?: string;
    columnId?: string;
    columnName?: string;
    weightId?: string;
  } | null>(null);

  const hasUnsavedChanges = hasUnsavedCategories || hasUnsavedWeights;

  useEffect(() => {
    onUnsavedChanges?.(hasUnsavedChanges, () => { saveCategories(); saveWeights(); });
  }, [hasUnsavedChanges]);

  const handleSave = () => {
    saveCategories();
    saveWeights();
    setShowSaved(true);
    setTimeout(() => setShowSaved(false), 2000);
  };

  const addCategory = () => {
    if (!newCategoryName.trim()) return;
    const newCategory: WorkoutCategory = {
      id: Date.now().toString(),
      name: newCategoryName,
      columns: [
        { id: 'date', name: 'Date', type: 'date' },
        { id: 'min', name: 'Min', type: 'number' },
      ],
      entries: [],
      expanded: true,
    };
    setCategories([...categories, newCategory]);
    setNewCategoryName('');
  };

  const deleteCategory = (categoryId: string) => {
    if (confirmDelete?.type === 'category' && confirmDelete.categoryId === categoryId) {
      setCategories(categories.filter((c) => c.id !== categoryId));
      setConfirmDelete(null);
    }
  };

  const toggleExpanded = (categoryId: string) => {
    setCategories(
      categories.map((c) => (c.id === categoryId ? { ...c, expanded: !c.expanded } : c))
    );
  };

  const addEntry = (categoryId: string) => {
    setCategories(
      categories.map((c) => {
        if (c.id !== categoryId) return c;
        const newEntry: WorkoutEntry = {
          id: Date.now().toString(),
          data: c.columns.reduce((acc, col) => {
            acc[col.id] = col.type === 'date' ? format(new Date(), 'yyyy-MM-dd') : '';
            return acc;
          }, {} as Record<string, string>),
          person: activePerson,
        };
        return { ...c, entries: [...c.entries, newEntry] };
      })
    );
  };

  const deleteEntry = (categoryId: string, entryId: string) => {
    if (confirmDelete?.type === 'entry' && confirmDelete.categoryId === categoryId && confirmDelete.entryId === entryId) {
      setCategories(
        categories.map((c) => {
          if (c.id !== categoryId) return c;
          return { ...c, entries: c.entries.filter((e) => e.id !== entryId) };
        })
      );
      setConfirmDelete(null);
    }
  };

  const updateEntryData = (categoryId: string, entryId: string, columnId: string, value: string) => {
    setCategories(
      categories.map((c) => {
        if (c.id !== categoryId) return c;
        return {
          ...c,
          entries: c.entries.map((e) => {
            if (e.id !== entryId) return e;
            return { ...e, data: { ...e.data, [columnId]: value } };
          }),
        };
      })
    );
  };

  const addColumn = (categoryId: string) => {
    setCategories(
      categories.map((c) => {
        if (c.id !== categoryId) return c;
        const newColumn: WorkoutColumn = {
          id: Date.now().toString(),
          name: 'New Column',
          type: 'text',
        };
        return {
          ...c,
          columns: [...c.columns, newColumn],
          entries: c.entries.map((e) => ({
            ...e,
            data: { ...e.data, [newColumn.id]: '' },
          })),
        };
      })
    );
  };

  const deleteColumn = (categoryId: string, columnId: string) => {
    if (confirmDelete?.type === 'column' && confirmDelete.categoryId === categoryId && confirmDelete.columnId === columnId) {
      setCategories(
        categories.map((c) => {
          if (c.id !== categoryId) return c;
          return {
            ...c,
            columns: c.columns.filter((col) => col.id !== columnId),
            entries: c.entries.map((e) => {
              const newData = { ...e.data };
              delete newData[columnId];
              return { ...e, data: newData };
            }),
          };
        })
      );
      setConfirmDelete(null);
    }
  };

  const startEditingColumn = (categoryId: string, columnId: string, currentName: string) => {
    setEditingColumn({ categoryId, columnId });
    setColumnEditValue(currentName);
  };

  const saveColumnName = () => {
    if (!editingColumn || !columnEditValue.trim()) return;
    setCategories(
      categories.map((c) => {
        if (c.id !== editingColumn.categoryId) return c;
        return {
          ...c,
          columns: c.columns.map((col) => {
            if (col.id !== editingColumn.columnId) return col;
            return { ...col, name: columnEditValue };
          }),
        };
      })
    );
    setEditingColumn(null);
    setColumnEditValue('');
  };

  const cancelEditingColumn = () => {
    setEditingColumn(null);
    setColumnEditValue('');
  };

  // Weight entry functions
  const addWeightEntry = () => {
    if (!newWeight.trim() || !newWeightDate) return;
    const newEntry: WeightEntry = {
      id: Date.now().toString(),
      date: newWeightDate,
      weight: newWeight,
      person: activePerson,
    };
    setWeightEntries([...weightEntries, newEntry].sort((a, b) =>
      new Date(b.date).getTime() - new Date(a.date).getTime()
    ));
    setNewWeight('');
    setNewWeightDate(format(new Date(), 'yyyy-MM-dd'));
  };

  const deleteWeightEntry = (id: string) => {
    if (confirmDelete?.type === 'weight' && confirmDelete.weightId === id) {
      setWeightEntries(weightEntries.filter((e) => e.id !== id));
      setConfirmDelete(null);
    }
  };

  // Filter by active person
  const filteredCategories = categories.map((cat) => ({
    ...cat,
    entries: cat.entries.filter((entry) => entry.person === activePerson),
  }));

  // Calculate timeframe interval
  const getTimeInterval = () => {
    const today = new Date();
    switch (timeFrame) {
      case 'daily':
        return { start: startOfDay(today), end: endOfDay(today) };
      case 'weekly':
        return { start: startOfWeek(today, { weekStartsOn: 0 }), end: endOfWeek(today, { weekStartsOn: 0 }) };
      case 'monthly':
        return { start: startOfMonth(today), end: endOfMonth(today) };
    }
  };

  // Filter weight entries by active person
  const filteredWeightEntries = weightEntries.filter((entry) =>
    entry.person === activePerson
  );

  // Calculate statistics
  const stats = useMemo(() => {
    const interval = getTimeInterval();
    let totalMinutes = 0;
    let totalWorkouts = 0;
    const weightValues: number[] = [];

    filteredCategories.forEach((cat) => {
      cat.entries.forEach((entry) => {
        const entryDate = entry.data.date ? parseISO(entry.data.date) : null;
        if (!entryDate || !isWithinInterval(entryDate, interval)) return;

        const minutes = parseFloat(entry.data.min || '0');
        if (minutes > 0) {
          totalMinutes += minutes;
          totalWorkouts++;
        }
      });
    });

    // Process weight entries
    filteredWeightEntries.forEach((entry) => {
      const entryDate = parseISO(entry.date);
      if (isWithinInterval(entryDate, interval)) {
        const weight = parseFloat(entry.weight || '0');
        if (weight > 0) weightValues.push(weight);
      }
    });

    const avgWeight = weightValues.length > 0
      ? weightValues.reduce((a, b) => a + b, 0) / weightValues.length
      : 0;

    const latestWeight = filteredWeightEntries.length > 0
      ? parseFloat(filteredWeightEntries[0].weight || '0')
      : 0;

    return {
      totalMinutes,
      totalWorkouts,
      avgWeight: avgWeight.toFixed(1),
      latestWeight: latestWeight.toFixed(1),
      weightRecords: weightValues.length,
    };
  }, [filteredCategories, filteredWeightEntries, timeFrame]);

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
          {showSaved ? 'Saved!' : hasUnsavedChanges ? 'Save Workout' : 'All Saved'}
        </button>
      </div>

      {/* Time Frame Selector */}
      <div className="flex gap-2">
        <button
          onClick={() => setTimeFrame('daily')}
          className={`px-4 py-2 rounded-lg transition-colors text-sm font-medium ${
            timeFrame === 'daily'
              ? 'bg-indigo-600 text-white'
              : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-200'
          }`}
        >
          Daily
        </button>
        <button
          onClick={() => setTimeFrame('weekly')}
          className={`px-4 py-2 rounded-lg transition-colors text-sm font-medium ${
            timeFrame === 'weekly'
              ? 'bg-indigo-600 text-white'
              : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-200'
          }`}
        >
          Weekly
        </button>
        <button
          onClick={() => setTimeFrame('monthly')}
          className={`px-4 py-2 rounded-lg transition-colors text-sm font-medium ${
            timeFrame === 'monthly'
              ? 'bg-indigo-600 text-white'
              : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-200'
          }`}
        >
          Monthly
        </button>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
          <div className="flex items-center gap-2 mb-2">
            <Timer className="w-5 h-5 text-indigo-600" />
            <p className="text-sm text-gray-600">Total Time</p>
          </div>
          <p className="text-3xl font-bold text-indigo-600">{stats.totalMinutes}</p>
          <p className="text-xs text-gray-500 mt-1">minutes</p>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
          <div className="flex items-center gap-2 mb-2">
            <Dumbbell className="w-5 h-5 text-blue-600" />
            <p className="text-sm text-gray-600">Workouts</p>
          </div>
          <p className="text-3xl font-bold text-blue-600">{stats.totalWorkouts}</p>
          <p className="text-xs text-gray-500 mt-1">sessions</p>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="w-5 h-5 text-green-600" />
            <p className="text-sm text-gray-600">Latest Weight</p>
          </div>
          <p className="text-3xl font-bold text-green-600">{stats.latestWeight}</p>
          <p className="text-xs text-gray-500 mt-1">kg</p>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
          <div className="flex items-center gap-2 mb-2">
            <Calendar className="w-5 h-5 text-orange-600" />
            <p className="text-sm text-gray-600">Avg Weight</p>
          </div>
          <p className="text-3xl font-bold text-orange-600">{stats.avgWeight}</p>
          <p className="text-xs text-gray-500 mt-1">kg ({stats.weightRecords} records)</p>
        </div>
      </div>

      {/* Weight Tracking Section */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="px-5 py-4 bg-gradient-to-r from-green-50 to-emerald-50 border-b border-gray-200">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-green-600" />
            <h2 className="text-lg font-semibold text-gray-900">Weight Tracking</h2>
            <span className="text-xs text-gray-500 ml-2">({filteredWeightEntries.length} records)</span>
          </div>
        </div>

        <div className="p-5">
          {/* Quick Add Weight */}
          <div className="mb-5 p-4 bg-gray-50 rounded-lg border border-gray-200">
            <p className="text-sm font-medium text-gray-700 mb-3">Add Today's Weight</p>
            <div className="flex gap-3">
              <input
                type="date"
                value={newWeightDate}
                onChange={(e) => setNewWeightDate(e.target.value)}
                className="px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-400 text-sm"
              />
              <input
                type="number"
                step="0.1"
                value={newWeight}
                onChange={(e) => setNewWeight(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addWeightEntry()}
                placeholder="Weight (kg)"
                className="flex-1 px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-400 text-sm"
              />
              <button
                onClick={addWeightEntry}
                disabled={!newWeight.trim()}
                className="px-5 py-2.5 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center gap-2 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Plus className="w-4 h-4" />
                Add Weight
              </button>
            </div>
          </div>

          {/* Weight History */}
          {filteredWeightEntries.length > 0 && (
            <div>
              <p className="text-sm font-medium text-gray-700 mb-3">Weight History</p>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-600">Date</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-600">Weight (kg)</th>
                      <th className="px-3 py-2 w-12"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredWeightEntries.slice(0, 10).map((entry) => (
                      <tr key={entry.id} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="px-3 py-3 text-sm text-gray-700">
                          {format(parseISO(entry.date), 'MMM d, yyyy')}
                        </td>
                        <td className="px-3 py-3 text-sm font-medium text-gray-900">
                          {entry.weight} kg
                        </td>
                        <td className="px-3 py-3">
                          <button
                            onClick={() => setConfirmDelete({ type: 'weight', weightId: entry.id })}
                            className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {filteredWeightEntries.length > 10 && (
                  <p className="text-xs text-gray-400 text-center mt-3">
                    Showing latest 10 entries (total: {filteredWeightEntries.length})
                  </p>
                )}
              </div>
            </div>
          )}

          {filteredWeightEntries.length === 0 && (
            <div className="text-center py-8 text-gray-400">
              <p className="text-sm">No weight entries yet. Add your first entry above!</p>
            </div>
          )}
        </div>
      </div>

      {/* Add new workout category */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Add New Workout Type</h2>
        <div className="flex gap-3">
          <input
            type="text"
            value={newCategoryName}
            onChange={(e) => setNewCategoryName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addCategory()}
            placeholder="e.g., Cycling, Swimming, Stretching..."
            className="flex-1 px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-400 text-sm"
          />
          <button
            onClick={addCategory}
            className="px-5 py-2.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors flex items-center gap-2 text-sm font-medium"
          >
            <Plus className="w-4 h-4" />
            Add Workout Type
          </button>
        </div>
      </div>

      {/* Workout categories list */}
      <div className="space-y-4">
        {filteredCategories.map((category) => (
          <div key={category.id} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            {/* Category header */}
            <div className="flex items-center justify-between px-5 py-4 bg-gray-50 border-b border-gray-200">
              <button
                onClick={() => toggleExpanded(category.id)}
                className="flex items-center gap-2 text-gray-900 font-semibold hover:text-indigo-600 transition-colors"
              >
                {category.expanded ? (
                  <ChevronDown className="w-5 h-5 text-gray-500" />
                ) : (
                  <ChevronRight className="w-5 h-5 text-gray-500" />
                )}
                <Dumbbell className="w-4 h-4 text-indigo-600" />
                <span>{category.name}</span>
                <span className="text-xs text-gray-500 font-normal ml-1">
                  ({category.entries.length} {category.entries.length === 1 ? 'entry' : 'entries'})
                </span>
              </button>
              <div className="flex items-center gap-2">
                {category.expanded && (
                  <>
                    <button
                      onClick={() => addEntry(category.id)}
                      className="px-3 py-1.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors flex items-center gap-1.5 text-xs font-medium"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Add Entry
                    </button>
                    {!category.isWeight && (
                      <button
                        onClick={() => addColumn(category.id)}
                        className="px-3 py-1.5 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors flex items-center gap-1.5 text-xs font-medium"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        Add Column
                      </button>
                    )}
                  </>
                )}
                <button
                  onClick={() => setConfirmDelete({ type: 'category', categoryId: category.id, categoryName: category.name })}
                  className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Expanded content */}
            {category.expanded && (
              <div className="p-5">
                {category.entries.length === 0 ? (
                  <div className="text-center py-8 text-gray-400">
                    <p className="text-sm">No entries yet. Click "Add Entry" to start tracking.</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-gray-200">
                          {category.columns.map((col) => (
                            <th key={col.id} className="px-3 py-2 text-left">
                              {editingColumn?.categoryId === category.id && editingColumn?.columnId === col.id ? (
                                <div className="flex items-center gap-1">
                                  <input
                                    type="text"
                                    value={columnEditValue}
                                    onChange={(e) => setColumnEditValue(e.target.value)}
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter') saveColumnName();
                                      if (e.key === 'Escape') cancelEditingColumn();
                                    }}
                                    className="px-2 py-1 border border-indigo-400 rounded text-xs font-medium w-24 focus:outline-none focus:ring-2 focus:ring-indigo-400"
                                    autoFocus
                                  />
                                  <button
                                    onClick={saveColumnName}
                                    className="p-1 text-green-600 hover:bg-green-50 rounded"
                                  >
                                    <Check className="w-3 h-3" />
                                  </button>
                                  <button
                                    onClick={cancelEditingColumn}
                                    className="p-1 text-gray-500 hover:bg-gray-100 rounded"
                                  >
                                    <X className="w-3 h-3" />
                                  </button>
                                </div>
                              ) : (
                                <div className="flex items-center gap-2 group">
                                  <span className="text-xs font-medium text-gray-600">{col.name}</span>
                                  <button
                                    onClick={() => startEditingColumn(category.id, col.id, col.name)}
                                    className="opacity-0 group-hover:opacity-100 p-0.5 text-gray-400 hover:text-indigo-600 transition-opacity"
                                  >
                                    <Edit2 className="w-3 h-3" />
                                  </button>
                                  {category.columns.length > 2 && (
                                    <button
                                      onClick={() => setConfirmDelete({
                                        type: 'column',
                                        categoryId: category.id,
                                        categoryName: category.name,
                                        columnId: col.id,
                                        columnName: col.name
                                      })}
                                      className="opacity-0 group-hover:opacity-100 p-0.5 text-red-400 hover:text-red-600 transition-opacity"
                                    >
                                      <Trash2 className="w-3 h-3" />
                                    </button>
                                  )}
                                </div>
                              )}
                            </th>
                          ))}
                          <th className="px-3 py-2 w-12"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {category.entries.map((entry) => (
                          <tr key={entry.id} className="border-b border-gray-100 hover:bg-gray-50">
                            {category.columns.map((col) => (
                              <td key={col.id} className="px-3 py-3">
                                <input
                                  type={col.type}
                                  value={entry.data[col.id] || ''}
                                  onChange={(e) => updateEntryData(category.id, entry.id, col.id, e.target.value)}
                                  className="w-full px-2 py-1.5 border border-gray-200 rounded text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                                />
                              </td>
                            ))}
                            <td className="px-3 py-3">
                              <button
                                onClick={() => setConfirmDelete({
                                  type: 'entry',
                                  categoryId: category.id,
                                  categoryName: category.name,
                                  entryId: entry.id
                                })}
                                className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Confirm delete dialog */}
      {confirmDelete && (
        <ConfirmDialog
          title={
            confirmDelete.type === 'category'
              ? 'Delete Workout Type'
              : confirmDelete.type === 'entry'
              ? 'Delete Entry'
              : confirmDelete.type === 'weight'
              ? 'Delete Weight Entry'
              : 'Delete Column'
          }
          message={
            confirmDelete.type === 'category'
              ? `Do you want to delete the "${confirmDelete.categoryName}" workout type? All entries will be permanently deleted.`
              : confirmDelete.type === 'entry'
              ? `Do you want to delete this entry from "${confirmDelete.categoryName}"?`
              : confirmDelete.type === 'weight'
              ? 'Do you want to delete this weight entry?'
              : `Do you want to delete the "${confirmDelete.columnName}" column from "${confirmDelete.categoryName}"?`
          }
          confirmText="Delete"
          cancelText="Cancel"
          onConfirm={() => {
            if (confirmDelete.type === 'category') {
              deleteCategory(confirmDelete.categoryId!);
            } else if (confirmDelete.type === 'entry') {
              deleteEntry(confirmDelete.categoryId!, confirmDelete.entryId!);
            } else if (confirmDelete.type === 'weight') {
              deleteWeightEntry(confirmDelete.weightId!);
            } else if (confirmDelete.type === 'column') {
              deleteColumn(confirmDelete.categoryId!, confirmDelete.columnId!);
            }
          }}
          onCancel={() => setConfirmDelete(null)}
        />
      )}
    </div>
  );
}

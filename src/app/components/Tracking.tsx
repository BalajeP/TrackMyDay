import { useState, useRef, useEffect } from 'react';
import { useSupabasePersistedState } from '../hooks/useSupabasePersistedState';
import { Plus, Trash2, ChevronDown, ChevronRight, Edit2, Check, X, Bell, ChevronLeft, Save, Users, User, GripVertical } from 'lucide-react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, getDay, addMonths, subMonths, isSameDay } from 'date-fns';
import type { TrackingReminder } from '../App';
import ConfirmDialog from './ConfirmDialog';

type Person = 'partner1' | 'partner2' | 'both';

interface TrackingColumn {
  id: string;
  name: string;
  type: 'date' | 'text' | 'number';
}

interface TrackingEntry {
  id: string;
  data: Record<string, string>;
  person: Person;
}

interface TrackingCategory {
  id: string;
  name: string;
  columns: TrackingColumn[];
  entries: TrackingEntry[];
  expanded: boolean;
  person: Person;
}

interface Props {
  activePerson: Person;
  partner1Name: string;
  partner2Name: string;
  reminders: TrackingReminder[];
  onAddReminder: (reminder: Omit<TrackingReminder, 'id' | 'completed'>) => void;
  onUpdateReminders: (reminders: TrackingReminder[]) => void;
  accessToken: string | null;
  onUnsavedChanges?: (hasChanges: boolean, save: () => void) => void;
}

// ── Reminder modal ────────────────────────────────────────────────────────────
function ReminderModal({
  categoryName,
  onSave,
  onClose,
  activePerson,
  partner1Name,
  partner2Name,
}: {
  categoryName: string;
  onSave: (reminder: Omit<TrackingReminder, 'id' | 'completed'>) => void;
  onClose: () => void;
  activePerson: Person;
  partner1Name: string;
  partner2Name: string;
}) {
  const [title, setTitle] = useState('');
  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [time, setTime] = useState('12:00');
  const [person, setPerson] = useState<Person>(activePerson);
  const [viewMonth, setViewMonth] = useState(new Date());

  const monthStart = startOfMonth(viewMonth);
  const monthEnd = endOfMonth(viewMonth);
  const days = eachDayOfInterval({ start: monthStart, end: monthEnd });
  const startPadding = getDay(monthStart);

  const handleSave = () => {
    if (!title.trim()) return;
    onSave({ categoryName, title, date: selectedDate, time, person });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <Bell className="w-5 h-5 text-indigo-600" />
            <div>
              <h2 className="font-semibold text-gray-900">Set Reminder</h2>
              <p className="text-xs text-gray-500">for {categoryName}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors">
            <X className="w-4 h-4 text-gray-500" />
          </button>
        </div>

        <div className="p-5 space-y-5">
          {/* Title */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Reminder Title</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={`e.g., Next ${categoryName} due...`}
              className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-400 text-sm"
              autoFocus
            />
          </div>

          {/* Calendar */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Select Date</label>
            <div className="border border-gray-200 rounded-lg p-3 bg-white">
              <div className="flex items-center justify-between mb-2">
                <button
                  type="button"
                  onClick={() => setViewMonth(subMonths(viewMonth, 1))}
                  className="p-1 hover:bg-gray-100 rounded"
                >
                  <ChevronLeft className="w-4 h-4 text-gray-600" />
                </button>
                <span className="text-sm font-semibold text-gray-800">
                  {format(viewMonth, 'MMMM yyyy')}
                </span>
                <button
                  type="button"
                  onClick={() => setViewMonth(addMonths(viewMonth, 1))}
                  className="p-1 hover:bg-gray-100 rounded"
                >
                  <ChevronRight className="w-4 h-4 text-gray-600" />
                </button>
              </div>
              <div className="grid grid-cols-7 gap-1">
                {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map((d) => (
                  <div key={d} className="text-center text-xs font-medium text-gray-500 py-1">
                    {d}
                  </div>
                ))}
                {Array.from({ length: startPadding }).map((_, i) => (
                  <div key={`pad-${i}`} />
                ))}
                {days.map((day) => {
                  const dateStr = format(day, 'yyyy-MM-dd');
                  const isSelected = dateStr === selectedDate;
                  const isToday = isSameDay(day, new Date());

                  return (
                    <button
                      key={dateStr}
                      type="button"
                      onClick={() => setSelectedDate(dateStr)}
                      className={`
                        aspect-square rounded-lg text-sm font-medium transition-colors
                        ${isSelected ? 'bg-indigo-600 text-white' : ''}
                        ${!isSelected && isToday ? 'bg-indigo-50 text-indigo-600' : ''}
                        ${!isSelected && !isToday ? 'hover:bg-gray-100 text-gray-700' : ''}
                      `}
                    >
                      {format(day, 'd')}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Time */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Select Time</label>
            <input
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
              className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-400 text-sm"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 pb-5 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 bg-gray-100 text-gray-700 text-sm font-medium rounded-xl hover:bg-gray-200 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!title.trim()}
            className="flex-1 py-2.5 bg-indigo-600 text-white text-sm font-medium rounded-xl hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Save Reminder
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Visibility popover ────────────────────────────────────────────────────────
function VisibilityPopover({
  categoryId,
  currentPerson,
  partner1Name,
  partner2Name,
  onChange,
}: {
  categoryId: string;
  currentPerson: Person;
  partner1Name: string;
  partner2Name: string;
  onChange: (categoryId: string, person: Person) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const isBoth = currentPerson === 'both';

  const options: { value: Person; label: string }[] = [
    { value: 'partner1', label: partner1Name },
    { value: 'partner2', label: partner2Name },
    { value: 'both', label: `Both (${partner1Name} & ${partner2Name})` },
  ];

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        title={isBoth ? `Shared with both users` : `Visible to ${currentPerson === 'partner1' ? partner1Name : partner2Name} only`}
        className={`p-1.5 rounded-lg transition-colors ${
          isBoth
            ? 'text-indigo-600 bg-indigo-50 hover:bg-indigo-100'
            : 'text-gray-500 hover:bg-gray-100'
        }`}
      >
        {isBoth ? <Users className="w-4 h-4" /> : <User className="w-4 h-4" />}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1 z-30 bg-white rounded-xl shadow-lg border border-gray-200 py-1 min-w-[210px]">
          <p className="px-3 py-1.5 text-xs font-semibold text-gray-400 uppercase tracking-wide border-b border-gray-100 mb-1">
            Category visible to
          </p>
          {options.map((opt) => (
            <button
              key={opt.value}
              onClick={() => { onChange(categoryId, opt.value); setOpen(false); }}
              className={`w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-gray-50 transition-colors ${
                currentPerson === opt.value ? 'text-indigo-600 font-medium' : 'text-gray-700'
              }`}
            >
              {opt.value === 'both' ? (
                <Users className="w-3.5 h-3.5 flex-shrink-0" />
              ) : (
                <User className="w-3.5 h-3.5 flex-shrink-0" />
              )}
              <span className="truncate">{opt.label}</span>
              {currentPerson === opt.value && <Check className="w-3.5 h-3.5 ml-auto flex-shrink-0" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

const DEFAULT_TRACKING_CATEGORIES: TrackingCategory[] = [
  {
    id: '1',
    name: 'Petrol',
    columns: [
      { id: 'date', name: 'Date', type: 'date' },
      { id: 'reading', name: 'Reading', type: 'number' },
      { id: 'amount', name: 'Amount', type: 'number' },
    ],
    entries: [],
    expanded: false,
    person: 'partner1',
  },
];

export default function Tracking({ activePerson, partner1Name, partner2Name, onAddReminder, accessToken, onUnsavedChanges }: Props) {
  const [categories, setCategories, saveCategories, hasUnsavedChanges] = useSupabasePersistedState<TrackingCategory[]>('tracking_categories', DEFAULT_TRACKING_CATEGORIES, DEFAULT_TRACKING_CATEGORIES, accessToken);
  const [draggedCategoryId, setDraggedCategoryId] = useState<string | null>(null);
  const [canDragId, setCanDragId] = useState<string | null>(null);
  const [showSaved, setShowSaved] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [editingColumn, setEditingColumn] = useState<{ categoryId: string; columnId: string } | null>(null);
  const [columnEditValue, setColumnEditValue] = useState('');
  const [showReminderModal, setShowReminderModal] = useState<string | null>(null);
  // entry IDs currently in edit mode
  const [editingEntries, setEditingEntries] = useState<Set<string>>(new Set());
  const [confirmDelete, setConfirmDelete] = useState<{
    type: 'category' | 'entry' | 'column';
    categoryId: string;
    categoryName?: string;
    entryId?: string;
    columnId?: string;
    columnName?: string;
  } | null>(null);

  useEffect(() => {
    onUnsavedChanges?.(hasUnsavedChanges, () => { saveCategories(); });
  }, [hasUnsavedChanges]);

  const handleSave = () => {
    saveCategories();
    setShowSaved(true);
    setTimeout(() => setShowSaved(false), 2000);
  };

  const addCategory = () => {
    if (!newCategoryName.trim()) return;
    const newCategory: TrackingCategory = {
      id: Date.now().toString(),
      name: newCategoryName,
      columns: [
        { id: 'date', name: 'Date', type: 'date' },
        { id: 'amount', name: 'Amount/Reading', type: 'text' },
      ],
      entries: [],
      expanded: true,
      person: activePerson === 'both' ? 'both' : activePerson,
    };
    setCategories([...categories, newCategory]);
    setNewCategoryName('');
  };

  const setCategoryPerson = (categoryId: string, person: Person) => {
    setCategories(categories.map((c) => c.id === categoryId ? { ...c, person } : c));
  };

  const deleteCategory = (categoryId: string) => {
    if (confirmDelete?.type === 'category' && confirmDelete.categoryId === categoryId) {
      setCategories(categories.filter((c) => c.id !== categoryId));
      setConfirmDelete(null);
    }
  };

  const toggleExpanded = (categoryId: string) => {
    setCategories(categories.map((c) => (c.id === categoryId ? { ...c, expanded: !c.expanded } : c)));
  };

  // New entry inserted at top, immediately in edit mode
  const addEntry = (categoryId: string) => {
    const cat = categories.find((c) => c.id === categoryId);
    if (!cat) return;
    const newEntry: TrackingEntry = {
      id: Date.now().toString(),
      data: cat.columns.reduce((acc, col) => {
        acc[col.id] = col.type === 'date' ? format(new Date(), 'yyyy-MM-dd') : '';
        return acc;
      }, {} as Record<string, string>),
      person: activePerson,
    };
    setCategories(categories.map((c) => {
      if (c.id !== categoryId) return c;
      return { ...c, entries: [newEntry, ...c.entries] };
    }));
    setEditingEntries((prev) => new Set(prev).add(newEntry.id));
  };

  const saveEntry = (entryId: string) => {
    setEditingEntries((prev) => {
      const next = new Set(prev);
      next.delete(entryId);
      return next;
    });
  };

  const startEditEntry = (entryId: string) => {
    setEditingEntries((prev) => new Set(prev).add(entryId));
  };

  const deleteEntry = (categoryId: string, entryId: string) => {
    if (confirmDelete?.type === 'entry' && confirmDelete.categoryId === categoryId && confirmDelete.entryId === entryId) {
      setCategories(categories.map((c) => {
        if (c.id !== categoryId) return c;
        return { ...c, entries: c.entries.filter((e) => e.id !== entryId) };
      }));
      setEditingEntries((prev) => { const next = new Set(prev); next.delete(entryId); return next; });
      setConfirmDelete(null);
    }
  };

  const updateEntryData = (categoryId: string, entryId: string, columnId: string, value: string) => {
    setCategories(categories.map((c) => {
      if (c.id !== categoryId) return c;
      return {
        ...c,
        entries: c.entries.map((e) => {
          if (e.id !== entryId) return e;
          return { ...e, data: { ...e.data, [columnId]: value } };
        }),
      };
    }));
  };

  const addColumn = (categoryId: string) => {
    setCategories(categories.map((c) => {
      if (c.id !== categoryId) return c;
      const newColumn: TrackingColumn = { id: Date.now().toString(), name: 'New Column', type: 'text' };
      return {
        ...c,
        columns: [...c.columns, newColumn],
        entries: c.entries.map((e) => ({ ...e, data: { ...e.data, [newColumn.id]: '' } })),
      };
    }));
  };

  const deleteColumn = (categoryId: string, columnId: string) => {
    if (confirmDelete?.type === 'column' && confirmDelete.categoryId === categoryId && confirmDelete.columnId === columnId) {
      setCategories(categories.map((c) => {
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
      }));
      setConfirmDelete(null);
    }
  };

  const startEditingColumn = (categoryId: string, columnId: string, currentName: string) => {
    setEditingColumn({ categoryId, columnId });
    setColumnEditValue(currentName);
  };

  const saveColumnName = () => {
    if (!editingColumn || !columnEditValue.trim()) return;
    setCategories(categories.map((c) => {
      if (c.id !== editingColumn.categoryId) return c;
      return {
        ...c,
        columns: c.columns.map((col) =>
          col.id !== editingColumn.columnId ? col : { ...col, name: columnEditValue }
        ),
      };
    }));
    setEditingColumn(null);
    setColumnEditValue('');
  };

  const cancelEditingColumn = () => { setEditingColumn(null); setColumnEditValue(''); };

  const getPersonName = (person: Person) =>
    person === 'partner1' ? partner1Name : person === 'partner2' ? partner2Name : 'Both';

  // Entries visible per category: if category is shared, show all entries; otherwise show only owner's
  const filteredCategories = categories
    .filter((cat) => cat.person === activePerson || cat.person === 'both')
    .map((cat) => {
      let entries = cat.person === 'both'
        ? cat.entries  // show all entries from both partners
        : cat.entries.filter((e) => e.person === activePerson);

      const dateCol = cat.columns.find((c) => c.type === 'date');
      if (dateCol) {
        entries = [...entries].sort((a, b) => {
          const valA = a.data[dateCol.id] || '';
          const valB = b.data[dateCol.id] || '';
          return new Date(valB).getTime() - new Date(valA).getTime();
        });
      }

      return {
        ...cat,
        entries,
      };
    });

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
          {showSaved ? 'Saved!' : hasUnsavedChanges ? 'Save Tracking' : 'All Saved'}
        </button>
      </div>

      {/* Add new category */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Add New Tracking Category</h2>
        <div className="flex gap-3">
          <input
            type="text"
            value={newCategoryName}
            onChange={(e) => setNewCategoryName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addCategory()}
            placeholder="e.g., Cylinder, Haircut, Car Service..."
            className="flex-1 px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-400 text-sm"
          />
          <button
            onClick={addCategory}
            className="px-5 py-2.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors flex items-center gap-2 text-sm font-medium"
          >
            <Plus className="w-4 h-4" />
            Add Category
          </button>
        </div>
      </div>

      {/* Categories list */}
      <div className="space-y-4">
        {filteredCategories.map((category) => (
          <div
            key={category.id}
            draggable={canDragId === category.id}
            onDragStart={(e) => {
              e.dataTransfer.effectAllowed = 'move';
              setDraggedCategoryId(category.id);
            }}
            onDragOver={(e) => {
              e.preventDefault();
            }}
            onDrop={() => {
              if (draggedCategoryId && draggedCategoryId !== category.id) {
                const draggedIdx = categories.findIndex((c) => c.id === draggedCategoryId);
                const targetIdx = categories.findIndex((c) => c.id === category.id);
                if (draggedIdx !== -1 && targetIdx !== -1) {
                  const newCats = [...categories];
                  const [removed] = newCats.splice(draggedIdx, 1);
                  newCats.splice(targetIdx, 0, removed);
                  setCategories(newCats);
                }
              }
              setDraggedCategoryId(null);
              setCanDragId(null);
            }}
            onDragEnd={() => {
              setDraggedCategoryId(null);
              setCanDragId(null);
            }}
            className={`bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden transition-all duration-200 ${
              draggedCategoryId === category.id ? 'opacity-40 border-dashed border-indigo-400' : ''
            }`}
          >
            {/* Category header */}
            <div className="flex items-center justify-between px-5 py-4 bg-gray-50 border-b border-gray-200 group/header">
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <div
                  onMouseDown={() => setCanDragId(category.id)}
                  onMouseUp={() => setCanDragId(null)}
                  className="opacity-0 group-hover/header:opacity-100 transition-opacity cursor-grab flex-shrink-0 text-gray-400 hover:text-gray-600 p-1 rounded hover:bg-gray-200"
                  title="Drag to reorder"
                >
                  <GripVertical className="w-4 h-4" />
                </div>
                <button
                  onClick={() => toggleExpanded(category.id)}
                  className="flex items-center gap-2 text-gray-900 font-semibold hover:text-indigo-600 transition-colors min-w-0"
                >
                  {category.expanded ? (
                    <ChevronDown className="w-5 h-5 text-gray-500 flex-shrink-0" />
                  ) : (
                    <ChevronRight className="w-5 h-5 text-gray-500 flex-shrink-0" />
                  )}
                  <span className="truncate">{category.name}</span>
                  <span className="text-xs text-gray-500 font-normal ml-1">
                    ({category.entries.length} {category.entries.length === 1 ? 'entry' : 'entries'})
                  </span>
                </button>
              </div>
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
                    <button
                      onClick={() => addColumn(category.id)}
                      className="px-3 py-1.5 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors flex items-center gap-1.5 text-xs font-medium"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Add Column
                    </button>
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
                                  <button onClick={saveColumnName} className="p-1 text-green-600 hover:bg-green-50 rounded">
                                    <Check className="w-3 h-3" />
                                  </button>
                                  <button onClick={cancelEditingColumn} className="p-1 text-gray-500 hover:bg-gray-100 rounded">
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
                                        columnName: col.name,
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
                          {/* Actions column header */}
                          <th className="px-3 py-2 w-20 text-xs font-medium text-gray-500 text-center">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {category.entries.map((entry, entryIdx) => {
                          const isEditing = editingEntries.has(entry.id);
                          const isNew = entryIdx === 0 && isEditing;
                          const canEdit = entry.person === activePerson;

                          return (
                            <tr
                              key={entry.id}
                              className={`border-b border-gray-100 last:border-0 transition-colors ${
                                isEditing
                                  ? 'bg-indigo-50/60'
                                  : isNew
                                  ? 'bg-indigo-50'
                                  : 'hover:bg-gray-50'
                              }`}
                            >


                              {/* Data cells */}
                              {category.columns.map((col) => (
                                <td key={col.id} className="px-3 py-2.5">
                                  {isEditing && canEdit ? (
                                    <input
                                      type={col.type}
                                      value={entry.data[col.id] || ''}
                                      onChange={(e) => updateEntryData(category.id, entry.id, col.id, e.target.value)}
                                      className="w-full min-w-[100px] px-2 py-1.5 border border-indigo-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-white"
                                    />
                                  ) : (
                                    <span className="text-sm text-gray-800 block px-1 py-1">
                                      {entry.data[col.id]
                                        ? col.type === 'date' && entry.data[col.id]
                                          ? format(new Date(entry.data[col.id]), 'dd MMM yyyy')
                                          : entry.data[col.id]
                                        : <span className="text-gray-300 italic">—</span>}
                                    </span>
                                  )}
                                </td>
                              ))}

                              {/* Actions */}
                              <td className="px-3 py-2.5">
                                <div className="flex items-center justify-center gap-1">
                                  {isEditing && canEdit ? (
                                    <button
                                      onClick={() => saveEntry(entry.id)}
                                      title="Save entry"
                                      className="p-1.5 text-white bg-green-500 hover:bg-green-600 rounded-lg transition-colors"
                                    >
                                      <Check className="w-3.5 h-3.5" />
                                    </button>
                                  ) : canEdit ? (
                                    <button
                                      onClick={() => startEditEntry(entry.id)}
                                      title="Edit entry"
                                      className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                                    >
                                      <Edit2 className="w-3.5 h-3.5" />
                                    </button>
                                  ) : null}
                                  {canEdit && (
                                    <button
                                      onClick={() => setConfirmDelete({
                                        type: 'entry',
                                        categoryId: category.id,
                                        categoryName: category.name,
                                        entryId: entry.id,
                                      })}
                                      title="Delete entry"
                                      className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  )}
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </div>
        ))}

        {filteredCategories.length === 0 && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
            <p className="text-gray-400">No tracking categories yet. Add one above to get started!</p>
          </div>
        )}
      </div>

      {/* Reminder modal */}
      {showReminderModal && (
        <ReminderModal
          categoryName={showReminderModal}
          onSave={(reminder) => { onAddReminder(reminder); setShowReminderModal(null); }}
          onClose={() => setShowReminderModal(null)}
          activePerson={activePerson}
          partner1Name={partner1Name}
          partner2Name={partner2Name}
        />
      )}

      {/* Confirm delete dialog */}
      {confirmDelete && (
        <ConfirmDialog
          title={
            confirmDelete.type === 'category' ? 'Delete Category'
            : confirmDelete.type === 'entry' ? 'Delete Entry'
            : 'Delete Column'
          }
          message={
            confirmDelete.type === 'category'
              ? `Do you want to delete the "${confirmDelete.categoryName}" category? All entries will be permanently deleted.`
              : confirmDelete.type === 'entry'
              ? `Do you want to delete this entry from "${confirmDelete.categoryName}"?`
              : `Do you want to delete the "${confirmDelete.columnName}" column from "${confirmDelete.categoryName}"?`
          }
          confirmText="Delete"
          cancelText="Cancel"
          onConfirm={() => {
            if (confirmDelete.type === 'category') deleteCategory(confirmDelete.categoryId);
            else if (confirmDelete.type === 'entry') deleteEntry(confirmDelete.categoryId, confirmDelete.entryId!);
            else if (confirmDelete.type === 'column') deleteColumn(confirmDelete.categoryId, confirmDelete.columnId!);
          }}
          onCancel={() => setConfirmDelete(null)}
        />
      )}
    </div>
  );
}

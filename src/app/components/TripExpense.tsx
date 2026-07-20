import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { useSupabasePersistedState } from '../hooks/useSupabasePersistedState';
import { Plus, Trash2, ChevronDown, ChevronRight, Edit2, Check, X, FileText, Download, RotateCw, Calculator, Filter } from 'lucide-react';
import { format } from 'date-fns';
import ConfirmDialog from './ConfirmDialog';

type Person = 'partner1' | 'partner2' | 'both';

export interface TripColumn {
  id: string;
  name: string;
  type: 'date' | 'text' | 'number' | 'split';
}

export interface TripEntry {
  id: string;
  data: Record<string, string>; // Maps columnId -> cell value
  person: Person;
}

export interface Trip {
  id: string;
  title: string;
  expanded: boolean;
  columns: TripColumn[];
  entries: TripEntry[];
}

export interface TripExpenseState {
  trips: Trip[];
}

const DEFAULT_TRIP_COLUMNS: TripColumn[] = [
  { id: 'date', name: 'Date', type: 'date' },
  { id: 'expense_for', name: 'Expense for', type: 'text' },
  { id: 'total_amount', name: 'Total Amount', type: 'number' },
  { id: 'spender', name: 'Spender', type: 'text' }
];

const DEFAULT_TRIP_STATE: TripExpenseState = {
  trips: []
};

interface Props {
  activePerson: Person;
  partner1Name: string;
  partner2Name: string;
  accessToken: string | null;
  onChangeState?: (hasUnsavedChanges: boolean, saveFn: () => void) => void;
}

export default function TripExpense({ activePerson, partner1Name, partner2Name, accessToken, onChangeState }: Props) {
  // Persistence using useSupabasePersistedState
  const [state, setState, saveState, hasUnsavedChanges, isLoaded] = useSupabasePersistedState<TripExpenseState>(
    'trip_expenses',
    DEFAULT_TRIP_STATE,
    DEFAULT_TRIP_STATE,
    accessToken
  );

  const [showAddColMenu, setShowAddColMenu] = useState<string | null>(null); // tripId
  const [editingTitleId, setEditingTitleId] = useState<string | null>(null); // tripId
  const [titleEditValue, setTitleEditValue] = useState('');
  const [editingColumn, setEditingColumn] = useState<{ tripId: string; columnId: string } | null>(null);
  const [columnEditValue, setColumnEditValue] = useState('');
  
  // Row entry IDs in edit mode, mapped by tripId -> Set of entry IDs
  const [editingEntries, setEditingEntries] = useState<Record<string, Set<string>>>({});
  // Working inputs for currently editing entries: tripId -> entryId -> data
  const [editBuffers, setEditBuffers] = useState<Record<string, Record<string, Record<string, string>>>>({});
  // Tracking rotating/spinning state of refresh icons per trip: tripId -> boolean
  const [spinningTrip, setSpinningTrip] = useState<Record<string, boolean>>({});

  // Filter spender state
  const [spenderFilters, setSpenderFilters] = useState<Record<string, string>>({}); // tripId -> selectedSpender
  const [showFilterMenuId, setShowFilterMenuId] = useState<string | null>(null); // spender dropdown tripId

  const [confirmDelete, setConfirmDelete] = useState<{
    type: 'trip' | 'column' | 'entry';
    tripId: string;
    columnId?: string;
    columnName?: string;
    entryId?: string;
    entryDescription?: string;
  } | null>(null);

  const activeMenuRef = useRef<HTMLDivElement>(null);

  // Close dropdowns on outside click
  useEffect(() => {
    if (!showAddColMenu && !showFilterMenuId) return;
    const handler = (e: MouseEvent) => {
      if (activeMenuRef.current && !activeMenuRef.current.contains(e.target as Node)) {
        setShowAddColMenu(null);
        setShowFilterMenuId(null);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showAddColMenu, showFilterMenuId]);

  // Propagate state status upwards to the parent component (Expenditure.tsx)
  useEffect(() => {
    if (isLoaded) {
      onChangeState?.(hasUnsavedChanges, saveState);
    }
  }, [hasUnsavedChanges, isLoaded, saveState, onChangeState]);

  // Handle migration and guarantee type structure for loaded state
  const activeState = useMemo<TripExpenseState>(() => {
    if (!state) return DEFAULT_TRIP_STATE;

    if (typeof state !== 'object') return DEFAULT_TRIP_STATE;

    // 1. If structure has a trips array
    if ('trips' in state && Array.isArray((state as any).trips)) {
      return state as TripExpenseState;
    }

    // 2. If the root value is a raw array of trips
    if (Array.isArray(state)) {
      return { trips: state as Trip[] };
    }

    // 3. Legacy single trip fallback
    if ('title' in state && 'columns' in state) {
      const singleTrip = state as any;
      return {
        trips: [
          {
            id: singleTrip.id || 'legacy_trip',
            title: singleTrip.title || 'Trip Expense',
            expanded: singleTrip.expanded !== undefined ? singleTrip.expanded : true,
            columns: singleTrip.columns && singleTrip.columns.length > 0 ? singleTrip.columns : DEFAULT_TRIP_COLUMNS,
            entries: singleTrip.entries || []
          }
        ]
      };
    }

    return DEFAULT_TRIP_STATE;
  }, [state]);

  // Safe formatting function for Date column cells -> 20/07/26
  const formatDateSafe = (dateStr: string) => {
    if (!dateStr) return '';
    try {
      return format(new Date(dateStr.replace(/-/g, '/')), 'dd/MM/yy');
    } catch (e) {
      return dateStr;
    }
  };

  // Add Trip
  const handleAddTrip = () => {
    const newTripId = `trip_${Date.now()}`;
    const newTrip: Trip = {
      id: newTripId,
      title: 'New Trip',
      expanded: true,
      columns: [
        { id: 'date', name: 'Date', type: 'date' },
        { id: 'expense_for', name: 'Expense for', type: 'text' },
        { id: 'total_amount', name: 'Total Amount', type: 'number' },
        { id: 'spender', name: 'Spender', type: 'text' }
      ],
      entries: []
    };

    setState((prev) => ({
      ...prev,
      trips: [...activeState.trips, newTrip]
    }));
  };

  const handleDeleteTrip = (tripId: string) => {
    setState((prev) => ({
      ...prev,
      trips: activeState.trips.filter((t) => t.id !== tripId)
    }));
    setConfirmDelete(null);
  };

  const toggleTripExpanded = (tripId: string) => {
    setState((prev) => ({
      ...prev,
      trips: activeState.trips.map((t) =>
        t.id === tripId ? { ...t, expanded: !t.expanded } : t
      )
    }));
  };

  // Edit Trip Title
  const startEditingTitle = (tripId: string, currentTitle: string) => {
    setEditingTitleId(tripId);
    setTitleEditValue(currentTitle);
  };

  const saveTitle = (tripId: string) => {
    if (!titleEditValue.trim()) return;
    setState((prev) => ({
      ...prev,
      trips: activeState.trips.map((t) =>
        t.id === tripId ? { ...t, title: titleEditValue.trim() } : t
      )
    }));
    setEditingTitleId(null);
  };

  // Dynamic Column Addition/Deletion
  const handleAddNormalColumn = (tripId: string) => {
    setShowAddColMenu(null);
    const newColId = `col_${Date.now()}`;
    const newCol: TripColumn = {
      id: newColId,
      name: 'New Column',
      type: 'text'
    };

    setState((prev) => ({
      ...prev,
      trips: activeState.trips.map((t) => {
        if (t.id !== tripId) return t;
        const updatedColumns = [...t.columns, newCol];
        const updatedEntries = t.entries.map((entry) => ({
          ...entry,
          data: { ...entry.data, [newColId]: '' }
        }));
        return { ...t, columns: updatedColumns, entries: updatedEntries };
      })
    }));
  };

  const handleAddSplitColumn = (tripId: string) => {
    setShowAddColMenu(null);
    const targetTrip = activeState.trips.find((t) => t.id === tripId);
    if (!targetTrip) return;

    const splitCols = targetTrip.columns.filter((c) => c.type === 'split');

    setState((prev) => ({
      ...prev,
      trips: activeState.trips.map((t) => {
        if (t.id !== tripId) return t;

        let updatedColumns = [...t.columns];
        let updatedEntries = [...t.entries];

        if (splitCols.length === 0) {
          // Initialize with Split Mem 1 and Split Mem 2 on first click
          const col1: TripColumn = { id: `split_${Date.now()}_1`, name: 'Split Mem 1', type: 'split' };
          const col2: TripColumn = { id: `split_${Date.now()}_2`, name: 'Split Mem 2', type: 'split' };
          updatedColumns.push(col1, col2);
          updatedEntries = updatedEntries.map((e) => ({
            ...e,
            data: { ...e.data, [col1.id]: '', [col2.id]: '' }
          }));
        } else {
          // Incremental additions
          const nextIndex = splitCols.length + 1;
          const newCol: TripColumn = {
            id: `split_${Date.now()}`,
            name: `Split Mem ${nextIndex}`,
            type: 'split'
          };
          updatedColumns.push(newCol);
          updatedEntries = updatedEntries.map((e) => ({
            ...e,
            data: { ...e.data, [newCol.id]: '' }
          }));
        }

        return { ...t, columns: updatedColumns, entries: updatedEntries };
      })
    }));
  };

  const startEditingColumn = (tripId: string, columnId: string, name: string) => {
    setEditingColumn({ tripId, columnId });
    setColumnEditValue(name);
  };

  const saveColumnName = () => {
    if (!columnEditValue.trim() || !editingColumn) return;
    const { tripId, columnId } = editingColumn;

    setState((prev) => ({
      ...prev,
      trips: activeState.trips.map((t) => {
        if (t.id !== tripId) return t;
        return {
          ...t,
          columns: t.columns.map((col) =>
            col.id === columnId ? { ...col, name: columnEditValue.trim() } : col
          )
        };
      })
    }));
    setEditingColumn(null);
  };

  const deleteColumn = (tripId: string, columnId: string) => {
    setState((prev) => ({
      ...prev,
      trips: activeState.trips.map((t) => {
        if (t.id !== tripId) return t;
        const updatedColumns = t.columns.filter((col) => col.id !== columnId);
        const updatedEntries = t.entries.map((entry) => {
          const newData = { ...entry.data };
          delete newData[columnId];
          return { ...entry, data: newData };
        });
        return { ...t, columns: updatedColumns, entries: updatedEntries };
      })
    }));
    setConfirmDelete(null);
  };

  // Entry Actions
  const handleAddEntry = (tripId: string) => {
    const targetTrip = activeState.trips.find((t) => t.id === tripId);
    if (!targetTrip) return;

    const newId = `entry_${Date.now()}`;
    const defaultData: Record<string, string> = {};

    targetTrip.columns.forEach((col) => {
      if (col.type === 'date') {
        defaultData[col.id] = format(new Date(), 'yyyy-MM-dd');
      } else {
        defaultData[col.id] = '';
      }
    });

    const newEntry: TripEntry = {
      id: newId,
      data: defaultData,
      person: activePerson
    };

    setState((prev) => ({
      ...prev,
      trips: activeState.trips.map((t) =>
        t.id === tripId ? { ...t, entries: [newEntry, ...t.entries] } : t
      )
    }));

    // Start row in edit mode
    setEditBuffers((prev) => ({
      ...prev,
      [tripId]: {
        ...(prev[tripId] || {}),
        [newId]: defaultData
      }
    }));
    setEditingEntries((prev) => ({
      ...prev,
      [tripId]: new Set(prev[tripId] || []).add(newId)
    }));
  };

  const startEditEntry = (tripId: string, entryId: string, currentData: Record<string, string>) => {
    setEditBuffers((prev) => ({
      ...prev,
      [tripId]: {
        ...(prev[tripId] || {}),
        [entryId]: { ...currentData }
      }
    }));
    setEditingEntries((prev) => ({
      ...prev,
      [tripId]: new Set(prev[tripId] || []).add(entryId)
    }));
  };

  const updateBufferValue = (tripId: string, entryId: string, columnId: string, value: string) => {
    setEditBuffers((prev) => ({
      ...prev,
      [tripId]: {
        ...(prev[tripId] || {}),
        [entryId]: {
          ...(prev[tripId]?.[entryId] || {}),
          [columnId]: value
        }
      }
    }));
  };

  const handleSplitEqually = (tripId: string, entryId: string) => {
    const targetTrip = activeState.trips.find((t) => t.id === tripId);
    const buffer = editBuffers[tripId]?.[entryId];
    if (!targetTrip || !buffer) return;

    const amountCol = targetTrip.columns.find((col) => col.id === 'total_amount');
    const totalAmount = parseFloat(buffer[amountCol?.id || ''] || '0');
    if (isNaN(totalAmount) || totalAmount <= 0) return;

    const splitCols = targetTrip.columns.filter((col) => col.type === 'split');
    if (splitCols.length === 0) return;

    const splitAmount = (totalAmount / splitCols.length).toFixed(2);

    const updatedBuffer = { ...buffer };
    splitCols.forEach((col) => {
      updatedBuffer[col.id] = splitAmount;
    });

    setEditBuffers((prev) => ({
      ...prev,
      [tripId]: {
        ...(prev[tripId] || {}),
        [entryId]: updatedBuffer
      }
    }));
  };

  const saveEntry = (tripId: string, entryId: string) => {
    const buffer = editBuffers[tripId]?.[entryId];
    if (!buffer) return;

    setState((prev) => ({
      ...prev,
      trips: activeState.trips.map((t) => {
        if (t.id !== tripId) return t;
        return {
          ...t,
          entries: t.entries.map((e) => (e.id === entryId ? { ...e, data: buffer } : e))
        };
      })
    }));

    setEditingEntries((prev) => {
      const nextSet = new Set(prev[tripId] || []);
      nextSet.delete(entryId);
      return { ...prev, [tripId]: nextSet };
    });

    setEditBuffers((prev) => {
      const nextTripBuffers = { ...(prev[tripId] || {}) };
      delete nextTripBuffers[entryId];
      return { ...prev, [tripId]: nextTripBuffers };
    });
  };

  const cancelEditEntry = (tripId: string, entryId: string) => {
    const targetTrip = activeState.trips.find((t) => t.id === tripId);
    const originalEntry = targetTrip?.entries.find((e) => e.id === entryId);

    // If new and saved data was empty, remove row on cancel
    const isNewAndEmpty = originalEntry && Object.values(originalEntry.data).every(
      (val) => val === '' || val === format(new Date(), 'yyyy-MM-dd')
    );

    if (isNewAndEmpty) {
      setState((prev) => ({
        ...prev,
        trips: activeState.trips.map((t) => {
          if (t.id !== tripId) return t;
          return { ...t, entries: t.entries.filter((e) => e.id !== entryId) };
        })
      }));
    }

    setEditingEntries((prev) => {
      const nextSet = new Set(prev[tripId] || []);
      nextSet.delete(entryId);
      return { ...prev, [tripId]: nextSet };
    });

    setEditBuffers((prev) => {
      const nextTripBuffers = { ...(prev[tripId] || {}) };
      delete nextTripBuffers[entryId];
      return { ...prev, [tripId]: nextTripBuffers };
    });
  };

  const handleDeleteEntry = (tripId: string, entryId: string) => {
    setState((prev) => ({
      ...prev,
      trips: activeState.trips.map((t) => {
        if (t.id !== tripId) return t;
        return { ...t, entries: t.entries.filter((e) => e.id !== entryId) };
      })
    }));
    setConfirmDelete(null);
  };

  // Get unique spenders list for a trip
  const getSpendersForTrip = useCallback((trip: Trip) => {
    const spenderCol = trip.columns.find((c) => c.id === 'spender');
    if (!spenderCol) return [];
    const spenders = new Set<string>();
    trip.entries.forEach((e) => {
      const val = e.data[spenderCol.id]?.trim();
      if (val) spenders.add(val);
    });
    return Array.from(spenders);
  }, []);

  // Filter entries by spender
  const getFilteredEntries = useCallback((trip: Trip) => {
    const selectedSpender = spenderFilters[trip.id];
    if (!selectedSpender || selectedSpender === 'all') return trip.entries;
    const spenderCol = trip.columns.find((c) => c.id === 'spender');
    if (!spenderCol) return trip.entries;
    return trip.entries.filter((e) => e.data[spenderCol.id]?.trim() === selectedSpender);
  }, [spenderFilters]);

  // Calculations for dynamic totals (running on filtered entries)
  const calculateTotals = useCallback((trip: Trip, entriesToSum: TripEntry[]) => {
    const totals: Record<string, number> = {};
    
    trip.columns.forEach((col) => {
      if (col.type === 'number' || col.type === 'split') {
        totals[col.id] = 0;
      }
    });

    entriesToSum.forEach((entry) => {
      const isEditing = editingEntries[trip.id]?.has(entry.id);
      const data = isEditing && editBuffers[trip.id]?.[entry.id]
        ? editBuffers[trip.id][entry.id]
        : entry.data;

      trip.columns.forEach((col) => {
        if (col.type === 'number' || col.type === 'split') {
          const val = parseFloat(data[col.id] || '0');
          if (!isNaN(val)) {
            totals[col.id] += val;
          }
        }
      });
    });

    return totals;
  }, [editingEntries, editBuffers]);

  // Recalculate manually + trigger spin animation
  const handleManualRefresh = (tripId: string) => {
    setSpinningTrip((prev) => ({ ...prev, [tripId]: true }));
    setTimeout(() => {
      setSpinningTrip((prev) => ({ ...prev, [tripId]: false }));
    }, 600);
  };

  // Export functions (exporting filtered rows)
  const exportToCSV = (trip: Trip) => {
    const filteredEntries = getFilteredEntries(trip);
    const headers = trip.columns.map((col) => `"${col.name.replace(/"/g, '""')}"`).join(',');

    const rows = filteredEntries.map((entry) => {
      return trip.columns.map((col) => {
        let val = entry.data[col.id] || '';
        if (col.type === 'date' && val) {
          val = formatDateSafe(val);
        } else if (col.type === 'number' || col.type === 'split') {
          val = val ? parseFloat(val).toFixed(2) : '0.00';
        }
        return `"${val.replace(/"/g, '""')}"`;
      }).join(',');
    });

    const totals = calculateTotals(trip, filteredEntries);
    const totalRow = trip.columns.map((col, index) => {
      if (index === 0) return '"Total"';
      if (col.type === 'number' || col.type === 'split') {
        return `"${totals[col.id].toFixed(2)}"`;
      }
      return '""';
    }).join(',');

    const csvContent = '\ufeff' + [headers, ...rows, totalRow].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `${trip.title.replace(/\s+/g, '_')}_expenses.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const exportToPDF = (trip: Trip) => {
    const filteredEntries = getFilteredEntries(trip);
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const headers = trip.columns.map((col) => `<th>${col.name}</th>`).join('');
    const rows = filteredEntries.map((entry) => {
      return `<tr>${trip.columns.map((col) => {
        let val = entry.data[col.id] || '';
        if (col.type === 'date' && val) {
          val = formatDateSafe(val);
        } else if (col.type === 'number' || col.type === 'split') {
          val = val ? `$${parseFloat(val).toFixed(2)}` : '$0.00';
        }
        return `<td>${val}</td>`;
      }).join('')}</tr>`;
    }).join('');

    const totals = calculateTotals(trip, filteredEntries);
    const totalRow = `
      <tr class="total-row">
        ${trip.columns.map((col, idx) => {
          if (idx === 0) return `<td>Total</td>`;
          if (col.type === 'number' || col.type === 'split') {
            return `<td>$${totals[col.id].toFixed(2)}</td>`;
          }
          return `<td>-</td>`;
        }).join('')}
      </tr>
    `;

    printWindow.document.write(`
      <html>
        <head>
          <title>Trip Expense Report - ${trip.title}</title>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif; margin: 40px; color: #333; }
            .header { border-bottom: 2px solid #4f46e5; padding-bottom: 10px; margin-bottom: 25px; }
            h1 { color: #4f46e5; margin: 0; font-size: 24px; }
            .meta { font-size: 11px; color: #666; margin-top: 5px; }
            table { width: 100%; border-collapse: collapse; margin-top: 15px; }
            th { background-color: #f3f4f6; color: #374151; font-weight: 600; border: 1px solid #d1d5db; padding: 10px; text-align: left; font-size: 12px; text-transform: uppercase; }
            td { border: 1px solid #e5e7eb; padding: 10px; font-size: 13px; }
            tr:nth-child(even) { background-color: #f9fafb; }
            .total-row { font-weight: bold; background-color: #e0e7ff !important; color: #312e81; }
            .total-row td { border-top: 2px solid #4f46e5; }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>${trip.title}</h1>
            <div class="meta">Report Generated: ${format(new Date(), 'dd/MM/yyyy HH:mm')} | TrackMyDay</div>
          </div>
          <table>
            <thead>
              <tr>${headers}</tr>
            </thead>
            <tbody>
              ${rows}
              ${totalRow}
            </tbody>
          </table>
          <script>
            window.onload = function() {
              window.print();
              window.close();
            }
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  const isCoreColumn = (colId: string) => {
    return ['date', 'expense_for', 'total_amount', 'spender'].includes(colId);
  };

  return (
    <div className="space-y-6">
      {/* Global Card for Trip Expense Section */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
        <div className="flex items-center justify-between border-b border-gray-100 pb-4 mb-6">
          <div>
            <h1 className="text-xl font-bold text-gray-900">Trip Expense</h1>
            <p className="text-xs text-gray-500 mt-0.5">Manage and track splitting for multiple trips</p>
          </div>
          <button
            onClick={handleAddTrip}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-xl shadow-sm flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            Add New Trip
          </button>
        </div>

        {/* Trips List */}
        <div className="space-y-6">
          {activeState.trips.length === 0 ? (
            <div className="text-center py-12 text-gray-400 border border-dashed border-gray-200 rounded-xl">
              <p className="text-sm font-medium">No trips registered yet.</p>
              <button
                onClick={handleAddTrip}
                className="mt-3 text-xs text-indigo-600 font-semibold hover:underline"
              >
                Create your first trip tracker
              </button>
            </div>
          ) : (
            activeState.trips.map((trip) => {
              const filteredEntries = getFilteredEntries(trip);
              const tripTotals = calculateTotals(trip, filteredEntries);

              return (
                <div
                  key={trip.id}
                  className="border border-gray-200 rounded-2xl shadow-sm overflow-hidden bg-white transition-all duration-200"
                >
                  {/* Trip Card Header */}
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between px-5 py-4 bg-gray-50/70 border-b border-gray-200 gap-3">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <button
                        onClick={() => toggleTripExpanded(trip.id)}
                        className="p-1 hover:bg-gray-200 rounded-lg text-gray-500 transition-colors cursor-pointer"
                      >
                        {trip.expanded ? <ChevronDown className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}
                      </button>

                      {editingTitleId === trip.id ? (
                        <div className="flex items-center gap-1.5">
                          <input
                            type="text"
                            value={titleEditValue}
                            onChange={(e) => setTitleEditValue(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') saveTitle(trip.id);
                              if (e.key === 'Escape') setEditingTitleId(null);
                            }}
                            className="px-2.5 py-1 border border-indigo-400 rounded-xl text-sm font-semibold text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-white"
                            autoFocus
                          />
                          <button
                            onClick={() => saveTitle(trip.id)}
                            className="p-1.5 text-green-600 hover:bg-green-50 rounded-lg cursor-pointer"
                          >
                            <Check className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => setEditingTitleId(null)}
                            className="p-1.5 text-gray-400 hover:bg-gray-100 rounded-lg cursor-pointer"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 group min-w-0">
                          <h3
                            onClick={() => startEditingTitle(trip.id, trip.title)}
                            className="text-base font-bold text-gray-800 hover:text-indigo-600 transition-colors cursor-pointer truncate"
                          >
                            {trip.title}
                          </h3>
                          <button
                            onClick={() => startEditingTitle(trip.id, trip.title)}
                            className="opacity-0 group-hover:opacity-100 p-1 text-gray-400 hover:text-indigo-600 transition-opacity"
                            title="Edit Trip Title"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Header Controls */}
                    {trip.expanded && (
                      <div className="flex flex-wrap items-center gap-2">
                        {/* Exports */}
                        <div className="flex items-center border border-gray-200 bg-white rounded-lg p-0.5 shadow-sm">
                          <button
                            onClick={() => exportToPDF(trip)}
                            className="p-1.5 text-red-600 hover:bg-red-50 rounded-md transition-colors text-xs font-semibold flex items-center gap-1 cursor-pointer"
                            title="Export to PDF"
                          >
                            <FileText className="w-3.5 h-3.5" />
                            <span className="hidden md:inline">PDF</span>
                          </button>
                          <div className="h-4 w-px bg-gray-200" />
                          <button
                            onClick={() => exportToCSV(trip)}
                            className="p-1.5 text-green-600 hover:bg-green-50 rounded-md transition-colors text-xs font-semibold flex items-center gap-1 cursor-pointer"
                            title="Export to Excel"
                          >
                            <Download className="w-3.5 h-3.5" />
                            <span className="hidden md:inline">Excel</span>
                          </button>
                        </div>

                        {/* Add Row & Column */}
                        <button
                          onClick={() => handleAddEntry(trip.id)}
                          className="px-2.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-lg flex items-center gap-1 cursor-pointer shadow-sm animate-in fade-in"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          Add Row
                        </button>

                        <div ref={showAddColMenu === trip.id ? activeMenuRef : null} className="relative">
                          <button
                            onClick={() => setShowAddColMenu(showAddColMenu === trip.id ? null : trip.id)}
                            className="px-2.5 py-1.5 bg-gray-100 border border-gray-200 hover:bg-gray-200 text-gray-700 text-xs font-semibold rounded-lg flex items-center gap-1 cursor-pointer shadow-sm"
                          >
                            <Plus className="w-3.5 h-3.5" />
                            Add Column
                          </button>

                          {showAddColMenu === trip.id && (
                            <div className="absolute right-0 top-full mt-1.5 z-30 bg-white rounded-xl shadow-lg border border-gray-200 py-1.5 min-w-[160px] animate-in fade-in duration-100">
                              <button
                                onClick={() => handleAddNormalColumn(trip.id)}
                                className="w-full text-left px-3.5 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50 hover:text-indigo-600 transition-colors cursor-pointer"
                              >
                                Normal Column
                              </button>
                              <button
                                onClick={() => handleAddSplitColumn(trip.id)}
                                className="w-full text-left px-3.5 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50 hover:text-indigo-600 transition-colors border-t border-gray-100 cursor-pointer"
                              >
                                Split Member Column
                              </button>
                            </div>
                          )}
                        </div>

                        {/* Delete Trip */}
                        <button
                          onClick={() =>
                            setConfirmDelete({
                              type: 'trip',
                              tripId: trip.id,
                              entryDescription: trip.title
                            })
                          }
                          className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition-colors cursor-pointer border border-transparent hover:border-red-100"
                          title="Delete Entire Trip"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Trip Table Content */}
                  {trip.expanded && (
                    <div className="p-4">
                      {trip.entries.length === 0 ? (
                        <div className="text-center py-8 text-gray-400">
                          <p className="text-xs">No expenses entered for this trip. Click "Add Row" to start.</p>
                        </div>
                      ) : (
                        <div className="overflow-x-auto border border-gray-200 rounded-xl">
                          <table className="w-full border-collapse">
                            <thead>
                              <tr className="bg-gray-50/75 border-b border-gray-200">
                                {trip.columns.map((col) => (
                                  <th key={col.id} className="px-4 py-2.5 text-left min-w-[110px]">
                                    {editingColumn?.tripId === trip.id && editingColumn?.columnId === col.id ? (
                                      <div className="flex items-center gap-1">
                                        <input
                                          type="text"
                                          value={columnEditValue}
                                          onChange={(e) => setColumnEditValue(e.target.value)}
                                          onKeyDown={(e) => {
                                            if (e.key === 'Enter') saveColumnName();
                                            if (e.key === 'Escape') setEditingColumn(null);
                                          }}
                                          className="px-2 py-1 border border-indigo-400 rounded-lg text-xs font-semibold w-24 focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-white"
                                          autoFocus
                                        />
                                        <button
                                          onClick={saveColumnName}
                                          className="p-1 text-green-600 hover:bg-green-50 rounded"
                                        >
                                          <Check className="w-3 h-3" />
                                        </button>
                                        <button
                                          onClick={() => setEditingColumn(null)}
                                          className="p-1 text-gray-500 hover:bg-gray-100 rounded"
                                        >
                                          <X className="w-3 h-3" />
                                        </button>
                                      </div>
                                    ) : (
                                      <div className="flex items-center justify-between group relative">
                                        <div className="flex items-center gap-1.5 min-w-0">
                                          <span className="text-xs font-bold text-gray-500 uppercase tracking-wider truncate">
                                            {col.name}
                                          </span>
                                          
                                          {col.id === 'spender' && (
                                            <div ref={showFilterMenuId === trip.id ? activeMenuRef : null} className="relative inline-block">
                                              <button
                                                onClick={() => setShowFilterMenuId(showFilterMenuId === trip.id ? null : trip.id)}
                                                className={`p-1 rounded hover:bg-gray-200 transition-colors cursor-pointer ${
                                                  spenderFilters[trip.id] && spenderFilters[trip.id] !== 'all'
                                                    ? 'text-indigo-600 font-bold bg-indigo-50 hover:bg-indigo-100'
                                                    : 'text-gray-400'
                                                }`}
                                                title="Filter by Spender"
                                              >
                                                <Filter className="w-3.5 h-3.5" />
                                              </button>
                                              
                                              {showFilterMenuId === trip.id && (
                                                <div className="absolute left-0 mt-1.5 z-40 bg-white rounded-xl shadow-lg border border-gray-200 py-1.5 min-w-[145px] animate-in fade-in duration-100">
                                                  <p className="px-3.5 py-1 text-xxs font-bold text-gray-400 uppercase tracking-wider border-b border-gray-100 pb-1 mb-1 text-left">
                                                    Filter Spender
                                                  </p>
                                                  <button
                                                    onClick={() => {
                                                      setSpenderFilters((prev) => ({ ...prev, [trip.id]: 'all' }));
                                                      setShowFilterMenuId(null);
                                                    }}
                                                    className={`w-full text-left px-3.5 py-2 text-xs font-semibold transition-colors cursor-pointer ${
                                                      !spenderFilters[trip.id] || spenderFilters[trip.id] === 'all'
                                                        ? 'text-indigo-600 bg-indigo-50 font-bold'
                                                        : 'text-gray-700 hover:bg-gray-50'
                                                    }`}
                                                  >
                                                    All Spenders
                                                  </button>
                                                  {getSpendersForTrip(trip).map((spender) => (
                                                    <button
                                                      key={spender}
                                                      onClick={() => {
                                                        setSpenderFilters((prev) => ({ ...prev, [trip.id]: spender }));
                                                        setShowFilterMenuId(null);
                                                      }}
                                                      className={`w-full text-left px-3.5 py-2 text-xs font-medium transition-colors cursor-pointer truncate ${
                                                        spenderFilters[trip.id] === spender
                                                          ? 'text-indigo-600 bg-indigo-50 font-bold'
                                                          : 'text-gray-700 hover:bg-gray-50'
                                                      }`}
                                                      title={spender}
                                                    >
                                                      {spender}
                                                    </button>
                                                  ))}
                                                </div>
                                              )}
                                            </div>
                                          )}
                                        </div>

                                        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                          <button
                                            onClick={() => startEditingColumn(trip.id, col.id, col.name)}
                                            className="p-0.5 text-gray-400 hover:text-indigo-600"
                                            title="Rename column"
                                          >
                                            <Edit2 className="w-3.5 h-3.5" />
                                          </button>
                                          {!isCoreColumn(col.id) && (
                                            <button
                                              onClick={() =>
                                                setConfirmDelete({
                                                  type: 'column',
                                                  tripId: trip.id,
                                                  columnId: col.id,
                                                  columnName: col.name
                                                })
                                              }
                                              className="p-0.5 text-gray-400 hover:text-red-500"
                                              title="Delete column"
                                            >
                                              <Trash2 className="w-3.5 h-3.5" />
                                            </button>
                                          )}
                                        </div>
                                      </div>
                                    )}
                                  </th>
                                ))}
                                <th className="px-4 py-2.5 text-center w-24 text-xs font-bold text-gray-500 uppercase tracking-wider">
                                  Actions
                                </th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200">
                              {filteredEntries.map((entry) => {
                                const isEditing = editingEntries[trip.id]?.has(entry.id);
                                const buffer = editBuffers[trip.id]?.[entry.id];

                                return (
                                  <tr
                                    key={entry.id}
                                    className={`transition-colors ${
                                      isEditing ? 'bg-indigo-50/40' : 'hover:bg-gray-50/50'
                                    }`}
                                  >
                                    {trip.columns.map((col) => {
                                      const value = isEditing
                                        ? buffer?.[col.id] ?? ''
                                        : entry.data[col.id] ?? '';

                                      return (
                                        <td key={col.id} className="px-4 py-2.5">
                                          {isEditing ? (
                                            <div className="relative">
                                              {col.type === 'date' ? (
                                                <input
                                                  type="date"
                                                  value={value}
                                                  onChange={(e) =>
                                                    updateBufferValue(trip.id, entry.id, col.id, e.target.value)
                                                  }
                                                  className="w-full px-2 py-1.5 border border-indigo-200 rounded-lg text-xs bg-white focus:outline-none focus:ring-2 focus:ring-indigo-400"
                                                />
                                              ) : col.type === 'number' || col.type === 'split' ? (
                                                <div className="relative">
                                                  <span className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400 text-xxs">
                                                    $
                                                  </span>
                                                  <input
                                                    type="number"
                                                    placeholder="0.00"
                                                    step="0.01"
                                                    value={value}
                                                    onChange={(e) =>
                                                      updateBufferValue(trip.id, entry.id, col.id, e.target.value)
                                                    }
                                                    className="w-full pl-5 pr-1.5 py-1.5 border border-indigo-200 rounded-lg text-xs bg-white focus:outline-none focus:ring-2 focus:ring-indigo-400"
                                                  />
                                                </div>
                                              ) : (
                                                <input
                                                  type="text"
                                                  value={value}
                                                  onChange={(e) =>
                                                    updateBufferValue(trip.id, entry.id, col.id, e.target.value)
                                                  }
                                                  className="w-full px-2 py-1.5 border border-indigo-200 rounded-lg text-xs bg-white focus:outline-none focus:ring-2 focus:ring-indigo-400"
                                                />
                                              )}
                                            </div>
                                          ) : (
                                            <span className="text-xs text-gray-800">
                                              {col.type === 'date' && value ? (
                                                formatDateSafe(value)
                                              ) : col.type === 'number' || col.type === 'split' ? (
                                                value ? `$${parseFloat(value).toFixed(2)}` : '$0.00'
                                              ) : (
                                                value || <span className="text-gray-300 italic">—</span>
                                              )}
                                            </span>
                                          )}
                                        </td>
                                      );
                                    })}

                                    {/* Action items */}
                                    <td className="px-4 py-2.5 text-center">
                                      <div className="flex items-center justify-center gap-1.5">
                                        {isEditing ? (
                                          <>
                                            <button
                                              onClick={() => saveEntry(trip.id, entry.id)}
                                              className="p-1 text-white bg-green-500 hover:bg-green-600 rounded-lg transition-colors cursor-pointer"
                                              title="Save Row"
                                            >
                                              <Check className="w-3.5 h-3.5" />
                                            </button>

                                            {trip.columns.some((c) => c.type === 'split') && (
                                              <button
                                                onClick={() => handleSplitEqually(trip.id, entry.id)}
                                                className="p-1 text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-lg transition-colors cursor-pointer"
                                                title="Split amount equally"
                                              >
                                                <Calculator className="w-3.5 h-3.5" />
                                              </button>
                                            )}

                                            <button
                                              onClick={() => cancelEditEntry(trip.id, entry.id)}
                                              className="p-1 text-gray-500 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors cursor-pointer"
                                              title="Cancel"
                                            >
                                              <X className="w-3.5 h-3.5" />
                                            </button>
                                          </>
                                        ) : (
                                          <>
                                            <button
                                              onClick={() => startEditEntry(trip.id, entry.id, entry.data)}
                                              className="p-1 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors cursor-pointer"
                                              title="Edit Row"
                                            >
                                              <Edit2 className="w-3.5 h-3.5" />
                                            </button>
                                            <button
                                              onClick={() =>
                                                setConfirmDelete({
                                                  type: 'entry',
                                                  tripId: trip.id,
                                                  entryId: entry.id,
                                                  entryDescription: entry.data.expense_for || 'this expense'
                                                })
                                              }
                                              className="p-1 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                                              title="Delete Row"
                                            >
                                              <Trash2 className="w-3.5 h-3.5" />
                                            </button>
                                          </>
                                        )}
                                      </div>
                                    </td>
                                  </tr>
                                );
                              })}

                              {/* Total calculation row (Default last row) */}
                              <tr className="bg-indigo-50/50 font-bold border-t-2 border-indigo-100 text-indigo-900">
                                {trip.columns.map((col, index) => {
                                  if (index === 0) {
                                    return (
                                      <td key="total-label" className="px-4 py-3 flex items-center gap-1.5">
                                        <button
                                          onClick={() => handleManualRefresh(trip.id)}
                                          className="p-1 hover:bg-indigo-100 text-indigo-600 rounded transition-colors cursor-pointer flex items-center justify-center"
                                          title="Recalculate Totals"
                                        >
                                          <RotateCw
                                            className={`w-3.5 h-3.5 ${
                                              spinningTrip[trip.id] ? 'animate-spin' : ''
                                            }`}
                                          />
                                        </button>
                                        <span className="text-xs uppercase tracking-wider">Total</span>
                                      </td>
                                    );
                                  }

                                  if (col.type === 'number' || col.type === 'split') {
                                    return (
                                      <td key={`total-${col.id}`} className="px-4 py-3 text-xs">
                                        ${tripTotals[col.id]?.toFixed(2) || '0.00'}
                                      </td>
                                    );
                                  }

                                  return (
                                    <td key={`total-empty-${col.id}`} className="px-4 py-3 text-xs text-gray-400 font-normal italic">
                                      —
                                    </td>
                                  );
                                })}
                                <td key="total-actions-spacer" className="px-4 py-3"></td>
                              </tr>
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Confirm Dialogs */}
      {confirmDelete && (
        <ConfirmDialog
          title={
            confirmDelete.type === 'trip'
              ? 'Delete Trip'
              : confirmDelete.type === 'column'
              ? 'Delete Column'
              : 'Delete Row'
          }
          message={
            confirmDelete.type === 'trip'
              ? `Are you sure you want to permanently delete the entire trip "${confirmDelete.entryDescription}"? All columns, rows, and split details will be lost.`
              : confirmDelete.type === 'column'
              ? `Are you sure you want to delete the column "${confirmDelete.columnName}"? All values associated with this column will be deleted.`
              : `Are you sure you want to delete the expense entry for "${confirmDelete.entryDescription}"?`
          }
          confirmText="Delete"
          cancelText="Cancel"
          onConfirm={() => {
            if (confirmDelete.type === 'trip') {
              handleDeleteTrip(confirmDelete.tripId);
            } else if (confirmDelete.type === 'column') {
              deleteColumn(confirmDelete.tripId, confirmDelete.columnId!);
            } else {
              handleDeleteEntry(confirmDelete.tripId, confirmDelete.entryId!);
            }
          }}
          onCancel={() => setConfirmDelete(null)}
        />
      )}
    </div>
  );
}

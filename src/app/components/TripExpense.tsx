// Trip Expense Component with Timing Column support
import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { useSupabasePersistedState } from '../hooks/useSupabasePersistedState';
import { Plus, Trash2, ChevronDown, ChevronRight, Edit2, Check, X, FileText, Download, RotateCw, Calculator, Filter, GripVertical, Zap, UserX, UserCheck, Clock } from 'lucide-react';
import { format } from 'date-fns';
import ConfirmDialog from './ConfirmDialog';

type Person = 'partner1' | 'partner2' | 'both';

export interface TripColumn {
  id: string;
  name: string;
  type: 'date' | 'text' | 'number' | 'split' | 'time';
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
  updatedAt?: string;
}

function formatLastUpdated(isoString?: string): string {
  if (!isoString) return '';
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return isoString;
    return format(d, 'MMM d, yyyy @ h:mm a');
  } catch (e) {
    return isoString || '';
  }
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
  allowedTripIds?: string[];
  isReadOnly?: boolean;
  onChangeState?: (hasUnsavedChanges: boolean, saveFn: () => void) => void;
}

export default function TripExpense({ activePerson, partner1Name, partner2Name, accessToken, allowedTripIds, isReadOnly, onChangeState }: Props) {
  // Persistence using useSupabasePersistedState
  const [state, setState, saveState, hasUnsavedChanges, isLoaded] = useSupabasePersistedState<TripExpenseState>(
    'trip_expenses',
    DEFAULT_TRIP_STATE,
    DEFAULT_TRIP_STATE,
    accessToken
  );

  const [draggedTripId, setDraggedTripId] = useState<string | null>(null);
  const [canDragId, setCanDragId] = useState<string | null>(null);

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

  // Cell timing popover state
  const [cellTimePopover, setCellTimePopover] = useState<{
    tripId: string;
    entryId: string;
    colId: string;
    mode: 'range' | 'single';
    fromH: string; fromM: string; fromAP: 'AM' | 'PM';
    toH: string; toM: string; toAP: 'AM' | 'PM';
    singleH: string; singleM: string; singleAP: 'AM' | 'PM';
  } | null>(null);
  const cellTimePopoverRef = useRef<HTMLDivElement>(null);

  // Close cell time popover on outside click
  useEffect(() => {
    if (!cellTimePopover) return;
    const handler = (e: MouseEvent) => {
      if (cellTimePopoverRef.current && !cellTimePopoverRef.current.contains(e.target as Node)) {
        setCellTimePopover(null);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [cellTimePopover]);

  // Perform Split Equally across all split columns
  const applySplitEquallyAll = (tripId: string, entryId: string) => {
    const trip = activeState.trips.find((t) => t.id === tripId);
    if (!trip) return;

    const splitCols = trip.columns.filter((c) => c.type === 'split');
    if (splitCols.length === 0) return;

    const currentBuffer = editBuffers[tripId]?.[entryId] || {};
    const totalAmount = parseFloat(currentBuffer['total_amount'] || '0');

    const perPerson = totalAmount > 0 ? (totalAmount / splitCols.length).toFixed(2) : '0.00';

    setEditBuffers((prev) => {
      const tripBufs = { ...(prev[tripId] || {}) };
      const entryBuf = { ...(tripBufs[entryId] || {}) };

      splitCols.forEach((col) => {
        entryBuf[col.id] = perPerson;
      });

      tripBufs[entryId] = entryBuf;
      return { ...prev, [tripId]: tripBufs };
    });
  };

  // Perform Exclude / Include Split
  const applyCustomSplit = (
    tripId: string,
    entryId: string,
    mode: 'exclude' | 'include',
    selectedColIds: string[]
  ) => {
    const trip = activeState.trips.find((t) => t.id === tripId);
    if (!trip) return;

    const splitCols = trip.columns.filter((c) => c.type === 'split');
    if (splitCols.length === 0) return;

    const currentBuffer = editBuffers[tripId]?.[entryId] || {};
    const totalAmount = parseFloat(currentBuffer['total_amount'] || '0');

    let activeCols: TripColumn[] = [];
    let inactiveCols: TripColumn[] = [];

    if (mode === 'exclude') {
      // In Exclude mode, checked columns are EXCLUDED (inactive), non-checked are active
      activeCols = splitCols.filter((c) => !selectedColIds.includes(c.id));
      inactiveCols = splitCols.filter((c) => selectedColIds.includes(c.id));
    } else {
      // In Include mode, checked columns are INCLUDED (active), non-checked are inactive
      activeCols = splitCols.filter((c) => selectedColIds.includes(c.id));
      inactiveCols = splitCols.filter((c) => !selectedColIds.includes(c.id));
    }

    const perPerson =
      activeCols.length > 0 && totalAmount > 0
        ? (totalAmount / activeCols.length).toFixed(2)
        : '0.00';

    setEditBuffers((prev) => {
      const tripBufs = { ...(prev[tripId] || {}) };
      const entryBuf = { ...(tripBufs[entryId] || {}) };

      activeCols.forEach((col) => {
        entryBuf[col.id] = perPerson;
      });
      inactiveCols.forEach((col) => {
        entryBuf[col.id] = '0.00';
      });

      tripBufs[entryId] = entryBuf;
      return { ...prev, [tripId]: tripBufs };
    });
  };

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

  // Auto-save changes to Supabase database so Admin and Sub-Users stay in sync
  useEffect(() => {
    if (isLoaded && hasUnsavedChanges) {
      const timer = setTimeout(() => {
        saveState();
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [state, isLoaded, hasUnsavedChanges, saveState]);

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

  const [createdTripIds, setCreatedTripIds] = useState<string[]>([]);

  // Add Trip
  const handleAddTrip = () => {
    const newTripId = `trip_${Date.now()}`;
    setCreatedTripIds((prev) => [...prev, newTripId]);
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
      entries: [],
      updatedAt: new Date().toISOString(),
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

  const [collapsedTrips, setCollapsedTrips] = useState<Record<string, boolean>>({});

  const toggleTripExpanded = (tripId: string) => {
    setCollapsedTrips((prev) => ({
      ...prev,
      [tripId]: !prev[tripId],
    }));
  };

  const isTripExpanded = (trip: Trip) => {
    return collapsedTrips[trip.id] !== undefined ? !collapsedTrips[trip.id] : (trip.expanded !== false);
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
        t.id === tripId ? { ...t, title: titleEditValue.trim(), updatedAt: new Date().toISOString() } : t
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

    setState((prev) => {
      const currentTrips = (prev && Array.isArray(prev.trips)) ? prev.trips : activeState.trips;
      return {
        ...prev,
        trips: currentTrips.map((t) => {
          if (t.id !== tripId) return t;
          const updatedColumns = [...(t.columns || []), newCol];
          const updatedEntries = (t.entries || []).map((entry) => ({
            ...entry,
            data: { ...(entry.data || {}), [newColId]: '' }
          }));
          return { ...t, columns: updatedColumns, entries: updatedEntries, updatedAt: new Date().toISOString() };
        })
      };
    });
  };

  const handleAddTimingColumn = (tripId: string) => {
    setShowAddColMenu(null);
    const newColId = `time_${Date.now()}`;
    const newCol: TripColumn = {
      id: newColId,
      name: 'Timing',
      type: 'time'
    };

    setState((prev) => {
      const currentTrips = (prev && Array.isArray(prev.trips)) ? prev.trips : activeState.trips;
      return {
        ...prev,
        trips: currentTrips.map((t) => {
          if (t.id !== tripId) return t;
          const updatedColumns = [...(t.columns || []), newCol];
          const updatedEntries = (t.entries || []).map((entry) => ({
            ...entry,
            data: { ...(entry.data || {}), [newColId]: '' }
          }));
          return { ...t, columns: updatedColumns, entries: updatedEntries, updatedAt: new Date().toISOString() };
        })
      };
    });
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
          ),
          updatedAt: new Date().toISOString(),
        };
      })
    }));
    setEditingColumn(null);
  };

  const deleteColumn = (tripId: string, columnId: string) => {
    setState((prev) => {
      const currentTrips = (prev && Array.isArray(prev.trips)) ? prev.trips : activeState.trips;
      return {
        ...prev,
        trips: currentTrips.map((t) => {
          if (t.id !== tripId) return t;
          const updatedColumns = (t.columns || []).filter((col) => col.id !== columnId);
          const updatedEntries = (t.entries || []).map((entry) => {
            const newData = { ...(entry.data || {}) };
            delete newData[columnId];
            return { ...entry, data: newData };
          });
          return { ...t, columns: updatedColumns, entries: updatedEntries, updatedAt: new Date().toISOString() };
        })
      };
    });
    setConfirmDelete(null);
  };

  // Entry Actions
  const handleAddEntry = (tripId: string) => {
    const targetTrip = activeState.trips.find((t) => t.id === tripId);
    if (!targetTrip) return;

    const newId = `entry_${Date.now()}`;
    const defaultData: Record<string, string> = {};

    (targetTrip.columns || []).forEach((col) => {
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

    setState((prev) => {
      const currentTrips = (prev && Array.isArray(prev.trips)) ? prev.trips : activeState.trips;
      return {
        ...prev,
        trips: currentTrips.map((t) =>
          t.id === tripId ? { ...t, entries: [newEntry, ...(t.entries || [])], updatedAt: new Date().toISOString() } : t
        )
      };
    });

    // Start row in edit mode
    setEditBuffers((prev) => ({
      ...prev,
      [tripId]: {
        ...(prev[tripId] || {}),
        [newId]: defaultData
      }
    }));
    setEditingEntries((prev) => {
      const existing = prev[tripId] instanceof Set ? Array.from(prev[tripId]) : Array.isArray(prev[tripId]) ? prev[tripId] : [];
      return {
        ...prev,
        [tripId]: new Set([...existing, newId])
      };
    });
  };

  const startEditEntry = (tripId: string, entryId: string, currentData: Record<string, string>) => {
    setEditBuffers((prev) => ({
      ...prev,
      [tripId]: {
        ...(prev[tripId] || {}),
        [entryId]: { ...(currentData || {}) }
      }
    }));
    setEditingEntries((prev) => {
      const existing = prev[tripId] instanceof Set ? Array.from(prev[tripId]) : Array.isArray(prev[tripId]) ? prev[tripId] : [];
      return {
        ...prev,
        [tripId]: new Set([...existing, entryId])
      };
    });
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

    setState((prev) => {
      const currentTrips = (prev && Array.isArray(prev.trips)) ? prev.trips : activeState.trips;
      return {
        ...prev,
        trips: currentTrips.map((t) => {
          if (t.id !== tripId) return t;
          return {
            ...t,
            entries: (t.entries || []).map((e) => (e.id === entryId ? { ...e, data: buffer } : e)),
            updatedAt: new Date().toISOString(),
          };
        })
      };
    });

    setEditingEntries((prev) => {
      const existing = prev[tripId] instanceof Set ? new Set(prev[tripId]) : new Set<string>();
      existing.delete(entryId);
      return { ...prev, [tripId]: existing };
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
    const isNewAndEmpty = originalEntry && Object.values(originalEntry.data || {}).every(
      (val) => val === '' || val === format(new Date(), 'yyyy-MM-dd')
    );

    if (isNewAndEmpty) {
      setState((prev) => {
        const currentTrips = (prev && Array.isArray(prev.trips)) ? prev.trips : activeState.trips;
        return {
          ...prev,
          trips: currentTrips.map((t) => {
            if (t.id !== tripId) return t;
            return { ...t, entries: (t.entries || []).filter((e) => e.id !== entryId) };
          })
        };
      });
    }

    setEditingEntries((prev) => {
      const existing = prev[tripId] instanceof Set ? new Set(prev[tripId]) : new Set<string>();
      existing.delete(entryId);
      return { ...prev, [tripId]: existing };
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
        return { ...t, entries: t.entries.filter((e) => e.id !== entryId), updatedAt: new Date().toISOString() };
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
    let entries = trip.entries;
    if (selectedSpender && selectedSpender !== 'all') {
      const spenderCol = trip.columns.find((c) => c.id === 'spender');
      if (spenderCol) {
        entries = trip.entries.filter((e) => e.data[spenderCol.id]?.trim() === selectedSpender);
      }
    }

    const dateCol = trip.columns.find((c) => c.type === 'date');
    if (dateCol) {
      return [...entries].sort((a, b) => {
        const valA = a.data[dateCol.id] || '';
        const valB = b.data[dateCol.id] || '';
        return new Date(valB).getTime() - new Date(valA).getTime();
      });
    }
    return entries;
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
    return colId === 'date';
  };

  const visibleTrips = useMemo(() => {
    const rawTrips = activeState.trips || [];
    if (!allowedTripIds || allowedTripIds.includes('*')) {
      return rawTrips;
    }
    return rawTrips.filter(
      (t) =>
        allowedTripIds.includes(t.id) ||
        allowedTripIds.includes(t.title) ||
        createdTripIds.includes(t.id)
    );
  }, [activeState.trips, allowedTripIds, createdTripIds]);

  return (
    <div className="space-y-6">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-gray-800 p-4 rounded-xl shadow-xs border border-gray-100 dark:border-gray-700">
        <div>
          <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
            <span>Trip Expenses</span>
          </h2>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            Manage custom trips, columns, entries, and automatic calculations
          </p>
        </div>

        {!isReadOnly && (
          <button
            onClick={handleAddTrip}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-xl shadow-sm flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            Add New Trip
          </button>
        )}
      </div>

      {/* Trips List */}
      <div className="space-y-6">
        {visibleTrips.length === 0 ? (
          <div className="text-center py-12 text-gray-400 dark:text-gray-500 border border-dashed border-gray-200 dark:border-gray-700 rounded-xl">
            <p className="text-sm font-medium">No trip expenses assigned or available.</p>
            {!isReadOnly && (
              <button
                onClick={handleAddTrip}
                className="mt-3 text-xs text-indigo-600 dark:text-indigo-400 font-semibold hover:underline"
              >
                Create your first trip tracker
              </button>
            )}
          </div>
        ) : (
          visibleTrips.map((trip) => {
              const filteredEntries = getFilteredEntries(trip);
              const tripTotals = calculateTotals(trip, filteredEntries);

              return (
                <div
                  key={trip.id}
                  draggable={canDragId === trip.id}
                  onDragStart={(e) => {
                    e.dataTransfer.effectAllowed = 'move';
                    setDraggedTripId(trip.id);
                  }}
                  onDragOver={(e) => {
                    e.preventDefault();
                  }}
                  onDrop={() => {
                    if (draggedTripId && draggedTripId !== trip.id) {
                      const draggedIdx = activeState.trips.findIndex((t) => t.id === draggedTripId);
                      const targetIdx = activeState.trips.findIndex((t) => t.id === trip.id);
                      if (draggedIdx !== -1 && targetIdx !== -1) {
                        const newTrips = [...activeState.trips];
                        const [removed] = newTrips.splice(draggedIdx, 1);
                        newTrips.splice(targetIdx, 0, removed);
                        setState((prev) => ({ ...prev, trips: newTrips }));
                      }
                    }
                    setDraggedTripId(null);
                    setCanDragId(null);
                  }}
                  onDragEnd={() => {
                    setDraggedTripId(null);
                    setCanDragId(null);
                  }}
                  className={`border border-gray-200 dark:border-gray-700 rounded-2xl shadow-sm overflow-hidden bg-white dark:bg-gray-800 transition-all duration-200 ${
                    draggedTripId === trip.id ? 'opacity-40 border-dashed border-indigo-400' : ''
                  }`}
                >
                  {/* Trip Card Header */}
                  <div
                    onClick={() => toggleTripExpanded(trip.id)}
                    className="flex flex-col sm:flex-row sm:items-center sm:justify-between px-5 py-4 bg-gray-50/70 dark:bg-gray-900/80 border-b border-gray-200 dark:border-gray-700 gap-3 group/header cursor-pointer select-none"
                  >
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <div
                        onMouseDown={(e) => { e.stopPropagation(); setCanDragId(trip.id); }}
                        onMouseUp={(e) => { e.stopPropagation(); setCanDragId(null); }}
                        className="opacity-0 group-hover/header:opacity-100 transition-opacity cursor-grab flex-shrink-0 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700"
                        title="Drag to reorder"
                      >
                        <GripVertical className="w-4 h-4" />
                      </div>
                      <button
                        onClick={(e) => { e.stopPropagation(); toggleTripExpanded(trip.id); }}
                        className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg text-gray-500 dark:text-gray-400 transition-colors cursor-pointer"
                      >
                        {isTripExpanded(trip) ? <ChevronDown className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}
                      </button>

                      {editingTitleId === trip.id ? (
                        <div onClick={(e) => e.stopPropagation()} className="flex items-center gap-1.5">
                          <input
                            type="text"
                            value={titleEditValue}
                            onChange={(e) => setTitleEditValue(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') saveTitle(trip.id);
                              if (e.key === 'Escape') setEditingTitleId(null);
                            }}
                            className="px-2.5 py-1 border border-indigo-400 rounded-xl text-sm font-semibold text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-white dark:bg-gray-900"
                            autoFocus
                          />
                          <button
                            onClick={() => saveTitle(trip.id)}
                            className="p-1.5 text-green-600 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-950/40 rounded-lg cursor-pointer"
                          >
                            <Check className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => setEditingTitleId(null)}
                            className="p-1.5 text-gray-400 dark:text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg cursor-pointer"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ) : (
                        <div className="flex flex-col min-w-0">
                          <div className="flex items-center gap-2 group min-w-0">
                            <h3
                              onClick={(e) => { e.stopPropagation(); startEditingTitle(trip.id, trip.title); }}
                              className="text-base font-bold text-gray-800 dark:text-gray-100 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors cursor-pointer truncate"
                            >
                              {trip.title}
                            </h3>
                            <button
                              onClick={(e) => { e.stopPropagation(); startEditingTitle(trip.id, trip.title); }}
                              className="opacity-0 group-hover:opacity-100 p-1 text-gray-400 dark:text-gray-500 hover:text-indigo-600 dark:hover:text-indigo-400 transition-opacity"
                              title="Edit Trip Title"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                          {formatLastUpdated(trip.updatedAt) && (
                            <span className="text-[10px] text-gray-400 dark:text-gray-500 font-normal flex items-center gap-1 mt-0.5">
                              <Clock className="w-3 h-3 text-gray-400 dark:text-gray-500 flex-shrink-0" />
                              <span>Updated: {formatLastUpdated(trip.updatedAt)}</span>
                            </span>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Header Controls */}
                    {isTripExpanded(trip) && (
                      <div onClick={(e) => e.stopPropagation()} className="flex flex-wrap items-center gap-2">
                        {/* Exports */}
                        <div className="flex items-center border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 rounded-lg p-0.5 shadow-sm">
                          <button
                            onClick={() => exportToPDF(trip)}
                            className="p-1.5 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 rounded-md transition-colors text-xs font-semibold flex items-center gap-1 cursor-pointer"
                            title="Export to PDF"
                          >
                            <FileText className="w-3.5 h-3.5" />
                            <span className="hidden md:inline">PDF</span>
                          </button>
                          <div className="h-4 w-px bg-gray-200 dark:bg-gray-700" />
                          <button
                            onClick={() => exportToCSV(trip)}
                            className="p-1.5 text-green-600 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-950/40 rounded-md transition-colors text-xs font-semibold flex items-center gap-1 cursor-pointer"
                            title="Export to Excel"
                          >
                            <Download className="w-3.5 h-3.5" />
                            <span className="hidden md:inline">Excel</span>
                          </button>
                        </div>

                        {/* Add Row & Column & Add Timing */}
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
                            className="px-2.5 py-1.5 bg-gray-100 dark:bg-gray-700 border border-gray-200 dark:border-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 text-xs font-semibold rounded-lg flex items-center gap-1 cursor-pointer shadow-sm"
                          >
                            <Plus className="w-3.5 h-3.5" />
                            Add Column
                          </button>

                          {showAddColMenu === trip.id && (
                            <div className="absolute right-0 top-full mt-1.5 z-30 bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 py-1.5 min-w-[160px] animate-in fade-in duration-100">
                              <button
                                onClick={() => handleAddNormalColumn(trip.id)}
                                className="w-full text-left px-3.5 py-2 text-xs font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors cursor-pointer"
                              >
                                Normal Column
                              </button>
                              <button
                                disabled={!(trip.entries && trip.entries.length > 0)}
                                onClick={() => handleAddTimingColumn(trip.id)}
                                className="w-full text-left px-3.5 py-2 text-xs font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 hover:text-violet-600 dark:hover:text-violet-400 transition-colors border-t border-gray-100 dark:border-gray-700 cursor-pointer flex items-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed"
                                title={trip.entries && trip.entries.length > 0 ? "Add Timing Column" : "Add at least one row first to enable Time Planner"}
                              >
                                <Clock className="w-3.5 h-3.5 text-violet-500" />
                                Timing Column
                              </button>
                            </div>
                          )}
                        </div>

                        <button
                          disabled={!(trip.entries && trip.entries.length > 0)}
                          onClick={() => handleAddTimingColumn(trip.id)}
                          className="px-2.5 py-1.5 bg-violet-600 hover:bg-violet-700 text-white text-xs font-semibold rounded-lg flex items-center gap-1 cursor-pointer shadow-sm animate-in fade-in transition-colors disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-violet-600"
                          title={trip.entries && trip.entries.length > 0 ? "Add Timing Column" : "Add at least one row first to enable Time Planner"}
                        >
                          <Clock className="w-3.5 h-3.5" />
                          Add Timing
                        </button>

                        {/* Delete Trip */}
                        <button
                          onClick={() =>
                            setConfirmDelete({
                              type: 'trip',
                              tripId: trip.id,
                              entryDescription: trip.title
                            })
                          }
                          className="p-1.5 text-red-500 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 rounded-lg transition-colors cursor-pointer border border-transparent hover:border-red-100 dark:hover:border-red-900"
                          title="Delete Entire Trip"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Trip Table Content */}
                  {isTripExpanded(trip) && (
                    <div className="p-4">
                      {trip.entries.length === 0 ? (
                        <div className="text-center py-8 text-gray-400 dark:text-gray-500">
                          <p className="text-xs">No expenses entered for this trip. Click "Add Row" to start.</p>
                        </div>
                      ) : (
                        <div className="overflow-x-auto border border-gray-200 dark:border-gray-700 rounded-xl">
                          <table className="w-full border-collapse">
                            <thead>
                              <tr className="bg-gray-50/75 dark:bg-gray-900/80 border-b border-gray-200 dark:border-gray-700">
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
                                          className="px-2 py-1 border border-indigo-400 dark:border-indigo-500 rounded-lg text-xs font-semibold w-24 focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
                                          autoFocus
                                        />
                                        <button
                                          onClick={saveColumnName}
                                          className="p-1 text-green-600 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-950/40 rounded"
                                        >
                                          <Check className="w-3 h-3" />
                                        </button>
                                        <button
                                          onClick={() => setEditingColumn(null)}
                                          className="p-1 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
                                        >
                                          <X className="w-3 h-3" />
                                        </button>
                                      </div>
                                    ) : (
                                      <div className="flex items-center justify-between group relative">
                                        <div className="flex items-center gap-1.5 min-w-0">
                                          <span className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider truncate">
                                            {col.name}
                                          </span>
                                          
                                          {col.id === 'spender' && (
                                            <div ref={showFilterMenuId === trip.id ? activeMenuRef : null} className="relative inline-block">
                                              <button
                                                onClick={() => setShowFilterMenuId(showFilterMenuId === trip.id ? null : trip.id)}
                                                className={`p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors cursor-pointer ${
                                                  spenderFilters[trip.id] && spenderFilters[trip.id] !== 'all'
                                                    ? 'text-indigo-600 dark:text-indigo-400 font-bold bg-indigo-50 dark:bg-indigo-950/60 hover:bg-indigo-100 dark:hover:bg-indigo-900/60'
                                                    : 'text-gray-400 dark:text-gray-500'
                                                }`}
                                                title="Filter by Spender"
                                              >
                                                <Filter className="w-3.5 h-3.5" />
                                              </button>
                                              
                                              {showFilterMenuId === trip.id && (
                                                <div className="absolute left-0 mt-1.5 z-40 bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 py-1.5 min-w-[145px] animate-in fade-in duration-100">
                                                  <p className="px-3.5 py-1 text-xxs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider border-b border-gray-100 dark:border-gray-700 pb-1 mb-1 text-left">
                                                    Filter Spender
                                                  </p>
                                                  <button
                                                    onClick={() => {
                                                      setSpenderFilters((prev) => ({ ...prev, [trip.id]: 'all' }));
                                                      setShowFilterMenuId(null);
                                                    }}
                                                    className={`w-full text-left px-3.5 py-2 text-xs font-semibold transition-colors cursor-pointer ${
                                                      !spenderFilters[trip.id] || spenderFilters[trip.id] === 'all'
                                                        ? 'text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/60 font-bold'
                                                        : 'text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700'
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
                                                          ? 'text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/60 font-bold'
                                                          : 'text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700'
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
                                            className="p-0.5 text-gray-400 dark:text-gray-500 hover:text-indigo-600 dark:hover:text-indigo-400"
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
                                              className="p-0.5 text-gray-400 dark:text-gray-500 hover:text-red-500 dark:hover:text-red-400"
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
                                <th className="px-4 py-2.5 text-center w-24 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                  Actions
                                </th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                              {filteredEntries.map((entry) => {
                                const isEditing = editingEntries[trip.id]?.has(entry.id);
                                const buffer = editBuffers[trip.id]?.[entry.id];

                                return (
                                  <tr
                                    key={entry.id}
                                    className={`transition-colors ${
                                      isEditing ? 'bg-indigo-50/40 dark:bg-indigo-950/40' : 'hover:bg-gray-50/50 dark:hover:bg-gray-700/50'
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
                                                  className="w-full px-2 py-1.5 border border-indigo-200 dark:border-indigo-700 rounded-lg text-xs bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-400"
                                                />
                                              ) : col.type === 'number' || col.type === 'split' ? (
                                                <div className="relative">
                                                  <span className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500 text-xxs">
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
                                                    className="w-full pl-5 pr-1.5 py-1.5 border border-indigo-200 dark:border-indigo-700 rounded-lg text-xs bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-400"
                                                  />
                                                </div>
                                              ) : col.type === 'time' ? (
                                                <div className="relative min-w-[140px]">
                                                  <input
                                                    type="text"
                                                    placeholder="09:00 AM – 10:30 AM"
                                                    value={value}
                                                    onChange={(e) =>
                                                      updateBufferValue(trip.id, entry.id, col.id, e.target.value)
                                                    }
                                                    className="w-full pl-2 pr-7 py-1.5 border border-violet-300 dark:border-violet-700 rounded-lg text-xs bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-violet-400 font-mono"
                                                  />
                                                  <button
                                                    type="button"
                                                    onClick={(e) => {
                                                      e.stopPropagation();
                                                      setCellTimePopover(
                                                        cellTimePopover?.tripId === trip.id && cellTimePopover?.entryId === entry.id && cellTimePopover?.colId === col.id
                                                          ? null
                                                          : {
                                                              tripId: trip.id,
                                                              entryId: entry.id,
                                                              colId: col.id,
                                                              mode: 'range',
                                                              fromH: '09', fromM: '00', fromAP: 'AM',
                                                              toH: '10', toM: '00', toAP: 'AM',
                                                              singleH: '09', singleM: '00', singleAP: 'AM'
                                                            }
                                                      );
                                                    }}
                                                    className="absolute right-1 top-1/2 -translate-y-1/2 p-1 text-violet-500 hover:text-violet-700 dark:hover:text-violet-300 hover:bg-violet-50 dark:hover:bg-violet-950/50 rounded transition-colors"
                                                    title="Timing Picker (Range / Single)"
                                                  >
                                                    <Clock className="w-3.5 h-3.5" />
                                                  </button>

                                                  {cellTimePopover?.tripId === trip.id && cellTimePopover?.entryId === entry.id && cellTimePopover?.colId === col.id && (
                                                    <div
                                                      ref={cellTimePopoverRef}
                                                      onClick={(e) => e.stopPropagation()}
                                                      className="absolute left-0 top-full mt-1.5 z-50 bg-white dark:bg-gray-800 rounded-xl shadow-2xl border border-violet-200 dark:border-violet-700 p-3.5 w-72 text-left animate-in fade-in duration-100"
                                                    >
                                                      <div className="flex items-center justify-between border-b border-gray-100 dark:border-gray-700 pb-2 mb-2.5">
                                                        <div className="flex items-center gap-1.5 text-xs font-bold text-gray-900 dark:text-gray-100">
                                                          <Clock className="w-3.5 h-3.5 text-violet-600 dark:text-violet-400" />
                                                          <span>Select Timing</span>
                                                        </div>
                                                        <button
                                                          type="button"
                                                          onClick={() => setCellTimePopover(null)}
                                                          className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 p-0.5 rounded"
                                                        >
                                                          <X className="w-3.5 h-3.5" />
                                                        </button>
                                                      </div>

                                                      <div className="flex rounded-lg bg-gray-100 dark:bg-gray-700/60 p-0.5 mb-3 text-[10px] font-bold">
                                                        <button
                                                          type="button"
                                                          onClick={() => setCellTimePopover((p) => p ? { ...p, mode: 'range' } : null)}
                                                          className={`flex-1 py-1 rounded-md transition-colors text-center ${
                                                            cellTimePopover.mode === 'range'
                                                              ? 'bg-violet-600 text-white shadow-2xs font-bold'
                                                              : 'text-gray-500 dark:text-gray-400 hover:text-gray-700'
                                                          }`}
                                                        >
                                                          1. From – To AM/PM
                                                        </button>
                                                        <button
                                                          type="button"
                                                          onClick={() => setCellTimePopover((p) => p ? { ...p, mode: 'single' } : null)}
                                                          className={`flex-1 py-1 rounded-md transition-colors text-center ${
                                                            cellTimePopover.mode === 'single'
                                                              ? 'bg-violet-600 text-white shadow-2xs font-bold'
                                                              : 'text-gray-500 dark:text-gray-400 hover:text-gray-700'
                                                          }`}
                                                        >
                                                          2. Single Time
                                                        </button>
                                                      </div>

                                                      {cellTimePopover.mode === 'range' ? (
                                                        <div className="space-y-2">
                                                          <div className="flex items-center gap-1">
                                                            <span className="text-[10px] font-semibold text-gray-500 dark:text-gray-400 w-8">From</span>
                                                            <select
                                                              value={cellTimePopover.fromH}
                                                              onChange={(e) => setCellTimePopover((p) => p ? { ...p, fromH: e.target.value } : null)}
                                                              className="flex-1 px-1 py-1 text-xs border border-violet-200 dark:border-violet-700 rounded bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
                                                            >
                                                              {Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, '0')).map((h) => (
                                                                <option key={h} value={h}>{h}</option>
                                                              ))}
                                                            </select>
                                                            <span className="text-gray-400 text-xs">:</span>
                                                            <select
                                                              value={cellTimePopover.fromM}
                                                              onChange={(e) => setCellTimePopover((p) => p ? { ...p, fromM: e.target.value } : null)}
                                                              className="flex-1 px-1 py-1 text-xs border border-violet-200 dark:border-violet-700 rounded bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
                                                            >
                                                              {['00', '15', '30', '45'].map((m) => (
                                                                <option key={m} value={m}>{m}</option>
                                                              ))}
                                                            </select>
                                                            <div className="flex rounded border border-violet-200 dark:border-violet-700 overflow-hidden">
                                                              {(['AM', 'PM'] as const).map((ap) => (
                                                                <button
                                                                  key={ap}
                                                                  type="button"
                                                                  onClick={() => setCellTimePopover((p) => p ? { ...p, fromAP: ap } : null)}
                                                                  className={`px-1.5 py-1 text-[10px] font-bold ${
                                                                    cellTimePopover.fromAP === ap ? 'bg-violet-600 text-white' : 'bg-white dark:bg-gray-800 text-gray-500'
                                                                  }`}
                                                                >
                                                                  {ap}
                                                                </button>
                                                              ))}
                                                            </div>
                                                          </div>

                                                          <div className="flex items-center gap-1">
                                                            <span className="text-[10px] font-semibold text-gray-500 dark:text-gray-400 w-8">To</span>
                                                            <select
                                                              value={cellTimePopover.toH}
                                                              onChange={(e) => setCellTimePopover((p) => p ? { ...p, toH: e.target.value } : null)}
                                                              className="flex-1 px-1 py-1 text-xs border border-violet-200 dark:border-violet-700 rounded bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
                                                            >
                                                              {Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, '0')).map((h) => (
                                                                <option key={h} value={h}>{h}</option>
                                                              ))}
                                                            </select>
                                                            <span className="text-gray-400 text-xs">:</span>
                                                            <select
                                                              value={cellTimePopover.toM}
                                                              onChange={(e) => setCellTimePopover((p) => p ? { ...p, toM: e.target.value } : null)}
                                                              className="flex-1 px-1 py-1 text-xs border border-violet-200 dark:border-violet-700 rounded bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
                                                            >
                                                              {['00', '15', '30', '45'].map((m) => (
                                                                <option key={m} value={m}>{m}</option>
                                                              ))}
                                                            </select>
                                                            <div className="flex rounded border border-violet-200 dark:border-violet-700 overflow-hidden">
                                                              {(['AM', 'PM'] as const).map((ap) => (
                                                                <button
                                                                  key={ap}
                                                                  type="button"
                                                                  onClick={() => setCellTimePopover((p) => p ? { ...p, toAP: ap } : null)}
                                                                  className={`px-1.5 py-1 text-[10px] font-bold ${
                                                                    cellTimePopover.toAP === ap ? 'bg-violet-600 text-white' : 'bg-white dark:bg-gray-800 text-gray-500'
                                                                  }`}
                                                                >
                                                                  {ap}
                                                                </button>
                                                              ))}
                                                            </div>
                                                          </div>

                                                          <div className="text-[10px] font-mono text-center text-violet-600 dark:text-violet-400 py-1 font-semibold bg-violet-50 dark:bg-violet-950/40 rounded">
                                                            {cellTimePopover.fromH}:{cellTimePopover.fromM} {cellTimePopover.fromAP} – {cellTimePopover.toH}:{cellTimePopover.toM} {cellTimePopover.toAP}
                                                          </div>

                                                          <button
                                                            type="button"
                                                            onClick={() => {
                                                              const formattedTime = `${cellTimePopover.fromH}:${cellTimePopover.fromM} ${cellTimePopover.fromAP} – ${cellTimePopover.toH}:${cellTimePopover.toM} ${cellTimePopover.toAP}`;
                                                              updateBufferValue(trip.id, entry.id, col.id, formattedTime);
                                                              setCellTimePopover(null);
                                                            }}
                                                            className="w-full py-1.5 bg-violet-600 hover:bg-violet-700 text-white text-xs font-bold rounded-lg shadow-xs transition-colors flex items-center justify-center gap-1"
                                                          >
                                                            Set Timing Range
                                                          </button>
                                                        </div>
                                                      ) : (
                                                        <div className="space-y-2">
                                                          <div className="flex items-center gap-1">
                                                            <span className="text-[10px] font-semibold text-gray-500 dark:text-gray-400 w-8">Time</span>
                                                            <select
                                                              value={cellTimePopover.singleH}
                                                              onChange={(e) => setCellTimePopover((p) => p ? { ...p, singleH: e.target.value } : null)}
                                                              className="flex-1 px-1 py-1 text-xs border border-violet-200 dark:border-violet-700 rounded bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
                                                            >
                                                              {Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, '0')).map((h) => (
                                                                <option key={h} value={h}>{h}</option>
                                                              ))}
                                                            </select>
                                                            <span className="text-gray-400 text-xs">:</span>
                                                            <select
                                                              value={cellTimePopover.singleM}
                                                              onChange={(e) => setCellTimePopover((p) => p ? { ...p, singleM: e.target.value } : null)}
                                                              className="flex-1 px-1 py-1 text-xs border border-violet-200 dark:border-violet-700 rounded bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
                                                            >
                                                              {['00', '15', '30', '45'].map((m) => (
                                                                <option key={m} value={m}>{m}</option>
                                                              ))}
                                                            </select>
                                                            <div className="flex rounded border border-violet-200 dark:border-violet-700 overflow-hidden">
                                                              {(['AM', 'PM'] as const).map((ap) => (
                                                                <button
                                                                  key={ap}
                                                                  type="button"
                                                                  onClick={() => setCellTimePopover((p) => p ? { ...p, singleAP: ap } : null)}
                                                                  className={`px-1.5 py-1 text-[10px] font-bold ${
                                                                    cellTimePopover.singleAP === ap ? 'bg-violet-600 text-white' : 'bg-white dark:bg-gray-800 text-gray-500'
                                                                  }`}
                                                                >
                                                                  {ap}
                                                                </button>
                                                              ))}
                                                            </div>
                                                          </div>

                                                          <div className="text-[10px] font-mono text-center text-violet-600 dark:text-violet-400 py-1 font-semibold bg-violet-50 dark:bg-violet-950/40 rounded">
                                                            {cellTimePopover.singleH}:{cellTimePopover.singleM} {cellTimePopover.singleAP}
                                                          </div>

                                                          <button
                                                            type="button"
                                                            onClick={() => {
                                                              const formattedTime = `${cellTimePopover.singleH}:${cellTimePopover.singleM} ${cellTimePopover.singleAP}`;
                                                              updateBufferValue(trip.id, entry.id, col.id, formattedTime);
                                                              setCellTimePopover(null);
                                                            }}
                                                            className="w-full py-1.5 bg-violet-600 hover:bg-violet-700 text-white text-xs font-bold rounded-lg shadow-xs transition-colors flex items-center justify-center gap-1"
                                                          >
                                                            Set Single Timing
                                                          </button>
                                                        </div>
                                                      )}
                                                    </div>
                                                  )}
                                                </div>
                                              ) : (
                                                <input
                                                  type="text"
                                                  value={value}
                                                  onChange={(e) =>
                                                    updateBufferValue(trip.id, entry.id, col.id, e.target.value)
                                                  }
                                                  className="w-full px-2 py-1.5 border border-indigo-200 dark:border-indigo-700 rounded-lg text-xs bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-400"
                                                />
                                              )}
                                            </div>
                                          ) : (
                                            <span className="text-xs text-gray-800 dark:text-gray-200">
                                              {col.type === 'date' && value ? (
                                                formatDateSafe(value)
                                              ) : col.type === 'number' || col.type === 'split' ? (
                                                value ? `$${parseFloat(value).toFixed(2)}` : '$0.00'
                                              ) : col.type === 'time' ? (
                                                value ? (
                                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-violet-50 dark:bg-violet-950/50 text-violet-700 dark:text-violet-300 font-medium text-xs border border-violet-100 dark:border-violet-800/60 font-mono">
                                                    <Clock className="w-3 h-3 text-violet-500 dark:text-violet-400 flex-shrink-0" />
                                                    <span>{value}</span>
                                                  </span>
                                                ) : (
                                                  <span className="text-gray-300 dark:text-gray-600 italic">—</span>
                                                )
                                              ) : (
                                                value || <span className="text-gray-300 dark:text-gray-600 italic">—</span>
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
                                              <div className="relative">
                                                <button
                                                  type="button"
                                                  onClick={() => {
                                                    if (splitPopover?.tripId === trip.id && splitPopover?.entryId === entry.id) {
                                                      setSplitPopover(null);
                                                    } else {
                                                      setSplitPopover({
                                                        tripId: trip.id,
                                                        entryId: entry.id,
                                                        mode: 'all',
                                                        selectedCols: [],
                                                      });
                                                      applySplitEquallyAll(trip.id, entry.id);
                                                    }
                                                  }}
                                                  className="p-1 text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/60 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 rounded-lg transition-colors cursor-pointer flex items-center gap-1"
                                                  title="Split Amount Options (Equally / Exclude / Include)"
                                                >
                                                  <Calculator className="w-3.5 h-3.5" />
                                                </button>

                                                {/* Split Calculator Popover Menu */}
                                                {splitPopover?.tripId === trip.id && splitPopover?.entryId === entry.id && (
                                                  <div
                                                    ref={splitPopoverRef}
                                                    className="absolute right-0 top-full mt-1.5 z-40 bg-white dark:bg-gray-800 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700 p-3.5 w-64 text-left animate-in fade-in duration-100"
                                                  >
                                                    <div className="flex items-center justify-between border-b border-gray-100 dark:border-gray-700 pb-2 mb-2">
                                                      <div className="flex items-center gap-1.5 text-xs font-bold text-gray-900 dark:text-gray-100">
                                                        <Calculator className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                                                        <span>Split Options</span>
                                                      </div>
                                                      <button
                                                        type="button"
                                                        onClick={() => setSplitPopover(null)}
                                                        className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 p-0.5"
                                                      >
                                                        <X className="w-3.5 h-3.5" />
                                                      </button>
                                                    </div>

                                                    {/* 3 Categories / Modes */}
                                                    <div className="flex rounded-lg bg-gray-100 dark:bg-gray-700/60 p-0.5 mb-3 text-[10px] font-bold">
                                                      <button
                                                        type="button"
                                                        onClick={() => {
                                                          setSplitPopover((prev) => prev ? { ...prev, mode: 'all' } : null);
                                                          applySplitEquallyAll(trip.id, entry.id);
                                                        }}
                                                        className={`flex-1 py-1 px-1 rounded-md transition-colors text-center ${
                                                          splitPopover.mode === 'all'
                                                            ? 'bg-white dark:bg-gray-800 text-indigo-600 dark:text-indigo-400 shadow-2xs font-bold'
                                                            : 'text-gray-500 dark:text-gray-400 hover:text-gray-700'
                                                        }`}
                                                      >
                                                        Equally
                                                      </button>

                                                      <button
                                                        type="button"
                                                        onClick={() =>
                                                          setSplitPopover((prev) => prev ? { ...prev, mode: 'exclude', selectedCols: [] } : null)
                                                        }
                                                        className={`flex-1 py-1 px-1 rounded-md transition-colors text-center ${
                                                          splitPopover.mode === 'exclude'
                                                            ? 'bg-white dark:bg-gray-800 text-red-600 dark:text-red-400 shadow-2xs font-bold'
                                                            : 'text-gray-500 dark:text-gray-400 hover:text-gray-700'
                                                        }`}
                                                      >
                                                        Exclude
                                                      </button>

                                                      <button
                                                        type="button"
                                                        onClick={() =>
                                                          setSplitPopover((prev) => prev ? { ...prev, mode: 'include', selectedCols: [] } : null)
                                                        }
                                                        className={`flex-1 py-1 px-1 rounded-md transition-colors text-center ${
                                                          splitPopover.mode === 'include'
                                                            ? 'bg-white dark:bg-gray-800 text-emerald-600 dark:text-emerald-400 shadow-2xs font-bold'
                                                            : 'text-gray-500 dark:text-gray-400 hover:text-gray-700'
                                                        }`}
                                                      >
                                                        Include
                                                      </button>
                                                    </div>

                                                    {/* Tab 1: Equally to All */}
                                                    {splitPopover.mode === 'all' && (
                                                      <div className="space-y-2">
                                                        <p className="text-[10px] text-gray-500 dark:text-gray-400 leading-tight">
                                                          Splits total amount equally across all split members.
                                                        </p>
                                                        <button
                                                          type="button"
                                                          onClick={() => {
                                                            applySplitEquallyAll(trip.id, entry.id);
                                                            setSplitPopover(null);
                                                          }}
                                                          className="w-full py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-lg transition-colors flex items-center justify-center gap-1 shadow-xs"
                                                        >
                                                          <Zap className="w-3.5 h-3.5" />
                                                          Split Equally to All
                                                        </button>
                                                      </div>
                                                    )}

                                                    {/* Tab 2: Exclude Members */}
                                                    {splitPopover.mode === 'exclude' && (
                                                      <div className="space-y-2">
                                                        <p className="text-[10px] text-gray-500 dark:text-gray-400 leading-tight">
                                                          Check members to <strong className="text-red-600 dark:text-red-400">EXCLUDE</strong> ($0.00):
                                                        </p>
                                                        <div className="space-y-1 max-h-32 overflow-y-auto">
                                                          {trip.columns
                                                            .filter((c) => c.type === 'split')
                                                            .map((col) => {
                                                              const isChecked = splitPopover.selectedCols.includes(col.id);
                                                              return (
                                                                <button
                                                                  key={col.id}
                                                                  type="button"
                                                                  onClick={() => {
                                                                    const newSelected = isChecked
                                                                      ? splitPopover.selectedCols.filter((id) => id !== col.id)
                                                                      : [...splitPopover.selectedCols, col.id];
                                                                    setSplitPopover((prev) => prev ? { ...prev, selectedCols: newSelected } : null);
                                                                    applyCustomSplit(trip.id, entry.id, 'exclude', newSelected);
                                                                  }}
                                                                  className={`w-full flex items-center justify-between p-1.5 rounded-lg border text-xs transition-colors ${
                                                                    isChecked
                                                                      ? 'border-red-300 bg-red-50 dark:bg-red-950/60 text-red-700 dark:text-red-300 font-bold'
                                                                      : 'border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50'
                                                                  }`}
                                                                >
                                                                  <span className="truncate">{col.name}</span>
                                                                  {isChecked ? (
                                                                    <span className="text-[9px] bg-red-600 text-white px-1.5 py-0.2 rounded font-bold">Excluded</span>
                                                                  ) : (
                                                                    <span className="text-[9px] text-gray-400 font-normal">Included</span>
                                                                  )}
                                                                </button>
                                                              );
                                                            })}
                                                        </div>
                                                        <button
                                                          type="button"
                                                          onClick={() => setSplitPopover(null)}
                                                          className="w-full mt-1 py-1.5 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded-lg transition-colors flex items-center justify-center gap-1 shadow-xs"
                                                        >
                                                          <UserX className="w-3.5 h-3.5" />
                                                          Done Exclude Split
                                                        </button>
                                                      </div>
                                                    )}

                                                    {/* Tab 3: Include Only Members */}
                                                    {splitPopover.mode === 'include' && (
                                                      <div className="space-y-2">
                                                        <p className="text-[10px] text-gray-500 dark:text-gray-400 leading-tight">
                                                          Check members to <strong className="text-emerald-600 dark:text-emerald-400">INCLUDE ONLY</strong>:
                                                        </p>
                                                        <div className="space-y-1 max-h-32 overflow-y-auto">
                                                          {trip.columns
                                                            .filter((c) => c.type === 'split')
                                                            .map((col) => {
                                                              const isChecked = splitPopover.selectedCols.includes(col.id);
                                                              return (
                                                                <button
                                                                  key={col.id}
                                                                  type="button"
                                                                  onClick={() => {
                                                                    const newSelected = isChecked
                                                                      ? splitPopover.selectedCols.filter((id) => id !== col.id)
                                                                      : [...splitPopover.selectedCols, col.id];
                                                                    setSplitPopover((prev) => prev ? { ...prev, selectedCols: newSelected } : null);
                                                                    applyCustomSplit(trip.id, entry.id, 'include', newSelected);
                                                                  }}
                                                                  className={`w-full flex items-center justify-between p-1.5 rounded-lg border text-xs transition-colors ${
                                                                    isChecked
                                                                      ? 'border-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 font-bold'
                                                                      : 'border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50'
                                                                  }`}
                                                                >
                                                                  <span className="truncate">{col.name}</span>
                                                                  {isChecked ? (
                                                                    <span className="text-[9px] bg-emerald-600 text-white px-1.5 py-0.2 rounded font-bold">Included</span>
                                                                  ) : (
                                                                    <span className="text-[9px] text-gray-400 font-normal">Excluded</span>
                                                                  )}
                                                                </button>
                                                              );
                                                            })}
                                                        </div>
                                                        <button
                                                          type="button"
                                                          onClick={() => setSplitPopover(null)}
                                                          className="w-full mt-1 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg transition-colors flex items-center justify-center gap-1 shadow-xs"
                                                        >
                                                          <UserCheck className="w-3.5 h-3.5" />
                                                          Done Include Split
                                                        </button>
                                                      </div>
                                                    )}
                                                  </div>
                                                )}
                                              </div>
                                            )}

                                            <button
                                              onClick={() => cancelEditEntry(trip.id, entry.id)}
                                              className="p-1 text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors cursor-pointer"
                                              title="Cancel"
                                            >
                                              <X className="w-3.5 h-3.5" />
                                            </button>
                                          </>
                                        ) : (
                                          <>
                                            <button
                                              onClick={() => startEditEntry(trip.id, entry.id, entry.data)}
                                              className="p-1 text-gray-400 dark:text-gray-500 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-gray-700 rounded-lg transition-colors cursor-pointer"
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
                                              className="p-1 text-gray-400 dark:text-gray-500 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 rounded-lg transition-colors cursor-pointer"
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
                              <tr className="bg-indigo-50/50 dark:bg-indigo-950/60 font-bold border-t-2 border-indigo-100 dark:border-indigo-900 text-indigo-900 dark:text-indigo-200">
                                {trip.columns.map((col, index) => {
                                  if (index === 0) {
                                    return (
                                      <td key="total-label" className="px-4 py-3 flex items-center gap-1.5">
                                        <button
                                          onClick={() => handleManualRefresh(trip.id)}
                                          className="p-1 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 text-indigo-600 dark:text-indigo-400 rounded transition-colors cursor-pointer flex items-center justify-center"
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
                                    <td key={`total-empty-${col.id}`} className="px-4 py-3 text-xs text-gray-400 dark:text-gray-500 font-normal italic">
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

import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import {
  Plus,
  Trash2,
  Save,
  Receipt,
  Plane,
  Search,
  Edit2,
  Check,
  X,
  Calendar,
  Tag,
  Filter,
  ChevronDown,
  ChevronUp,
  PieChart,
  AlertTriangle,
  FileText,
  Printer,
  Download,
  GripVertical,
  Clock,
} from 'lucide-react';
import ConfirmDialog from './ConfirmDialog';
import { useSupabasePersistedState } from '../hooks/useSupabasePersistedState';
import TripExpense from './TripExpense';
import { format, startOfWeek, endOfWeek, isWithinInterval, parseISO } from 'date-fns';

type Person = 'partner1' | 'partner2' | 'both';
type ExpenseTab = 'daily' | 'trip';
type DateFilterType = 'today' | 'this_week' | 'this_month' | 'this_year' | 'custom';
type CardSortOption = 'custom' | 'a-z' | 'z-a' | 'amount-desc' | 'amount-asc';

export interface ExpenseItem {
  id: string;
  date: string;
  item: string;
  amount: number;
  customValues?: Record<string, string>;
}

export interface Expense {
  id: string;
  description: string;
  amount: number;
  category: string;
  person: Person;
  date: string;
  icon?: string;
  items?: ExpenseItem[];
  customColumns?: string[];
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

interface Props {
  activePerson: Person;
  partner1Name: string;
  partner2Name: string;
  accessToken: string | null;
  allowedTripIds?: string[];
  isReadOnly?: boolean;
  isMainAdmin?: boolean;
  onUnsavedChanges?: (hasChanges: boolean, save: () => void) => void;
}

const DEFAULT_CATEGORIES = [
  'Zomato',
  'Zepto',
  'Groceries',
  'Medicine',
  'Rapido',
  'Food',
  'Transport',
  'Shopping',
  'Utilities',
  'Healthcare',
  'Other',
];

const EMOJI_CATEGORIES = [
  {
    name: 'Food & Drinks',
    icon: '🍔',
    emojis: ['🍔', '🍕', '☕', '🍱', '🛒', '💊', '🥤', '🍰', '🍦', '🍎', '🍣', '🍩', '🥗', '🍲'],
  },
  {
    name: 'Vehicles & Travel',
    icon: '🚗',
    emojis: ['🚗', '🛵', '🚕', '✈️', '⛽', '🚆', '🚲', '🚖', '🚌', '🛴', '🚘', '🛺'],
  },
  {
    name: 'Buildings & Housing',
    icon: '🏢',
    emojis: ['🏢', '🏠', '🏬', '⚡', '🛋️', '🏨', '🏗️', '🚰', '🏡', '🔧', '🧹'],
  },
  {
    name: 'General & Letters',
    icon: '🔤',
    emojis: ['💵', '🛍️', '🎬', '🎁', '❤️', '⭐', '📱', '💻', '🎟️', '💳', '📦', '🎓', '📚', '🏋️'],
  },
];

const MONTHS = [
  { value: '01', label: 'January' },
  { value: '02', label: 'February' },
  { value: '03', label: 'March' },
  { value: '04', label: 'April' },
  { value: '05', label: 'May' },
  { value: '06', label: 'June' },
  { value: '07', label: 'July' },
  { value: '08', label: 'August' },
  { value: '09', label: 'September' },
  { value: '10', label: 'October' },
  { value: '11', label: 'November' },
  { value: '12', label: 'December' },
];

const CHART_COLORS = [
  '#6366F1', // Indigo
  '#10B981', // Emerald
  '#F59E0B', // Amber
  '#EF4444', // Rose
  '#06B6D4', // Cyan
  '#8B5CF6', // Purple
  '#F97316', // Orange
  '#14B8A6', // Teal
  '#EC4899', // Pink
  '#3B82F6', // Blue
];

const currentYearNum = new Date().getFullYear();
const YEARS = Array.from({ length: 7 }, (_, i) => (currentYearNum - 3 + i).toString());

const getEmojiForCategoryOrTitle = (text: string): string => {
  const t = text.toLowerCase();
  if (t.includes('zomato') || t.includes('food') || t.includes('dinner') || t.includes('lunch') || t.includes('pizza') || t.includes('burger') || t.includes('coffee')) return '🍔';
  if (t.includes('zepto') || t.includes('grocer') || t.includes('milk') || t.includes('market') || t.includes('blinkit') || t.includes('instamart')) return '🛒';
  if (t.includes('med') || t.includes('pharma') || t.includes('doctor') || t.includes('hospital') || t.includes('tablet')) return '💊';
  if (t.includes('rapido') || t.includes('uber') || t.includes('ola') || t.includes('taxi') || t.includes('transport') || t.includes('bike') || t.includes('auto')) return '🛵';
  if (t.includes('shop') || t.includes('dress') || t.includes('clothes') || t.includes('amazon') || t.includes('flipkart')) return '🛍️';
  if (t.includes('util') || t.includes('electric') || t.includes('water') || t.includes('gas') || t.includes('bill')) return '⚡';
  if (t.includes('movie') || t.includes('cinema') || t.includes('game') || t.includes('play')) return '🎬';
  return '💵';
};

export default function Expenditure({
  activePerson,
  partner1Name,
  partner2Name,
  accessToken,
  allowedTripIds,
  isReadOnly,
  isMainAdmin = true,
  onUnsavedChanges,
}: Props) {
  const [expenseTab, setExpenseTab] = useState<ExpenseTab>(() => {
    return isMainAdmin === false ? 'trip' : 'daily';
  });

  useEffect(() => {
    if (isMainAdmin === false) {
      setExpenseTab('trip');
    }
  }, [isMainAdmin]);
  
  // Outer Confirmation Dialog State (for outside actions)
  const [confirmDialog, setConfirmDialog] = useState<{
    title: string;
    message: string;
    onConfirm: () => void;
  } | null>(null);

  // Supabase State
  const [expenses, setExpenses, saveExpenses, hasUnsavedExpenses] = useSupabasePersistedState<
    Expense[]
  >('expenses', [], [], accessToken);
  const [categories, setCategories, saveCategories, hasUnsavedCategories] =
    useSupabasePersistedState<string[]>(
      'expenses_custom_categories',
      DEFAULT_CATEGORIES,
      DEFAULT_CATEGORIES,
      accessToken
    );

  const [showSaved, setShowSaved] = useState(false);

  // Date Navigation State
  const [dateFilterType, setDateFilterType] = useState<DateFilterType>('this_month');
  const [selectedMonth, setSelectedMonth] = useState<string>(format(new Date(), 'MM'));
  const [selectedYear, setSelectedYear] = useState<string>(format(new Date(), 'yyyy'));

  // Multi-Select Category Filter State
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [showCategoryDropdown, setShowCategoryDropdown] = useState<boolean>(false);
  const categoryDropdownRef = useRef<HTMLDivElement>(null);

  const [categorySearch, setCategorySearch] = useState<string>('');
  const [newCategoryInput, setNewCategoryInput] = useState<string>('');
  const [editingCategory, setEditingCategory] = useState<{ original: string; text: string } | null>(
    null
  );

  // Hover state for circular chart segments
  const [hoveredCategory, setHoveredCategory] = useState<string | null>(null);

  // Selected Expense Detail Card ID for Modal View
  const [selectedExpenseDetailId, setSelectedExpenseDetailId] = useState<string | null>(null);

  // In-Modal Confirmation State
  const [confirmCardDeleteInModal, setConfirmCardDeleteInModal] = useState<boolean>(false);
  const [confirmColumnDeleteInModal, setConfirmColumnDeleteInModal] = useState<string | null>(null);
  const [confirmItemDeleteInModal, setConfirmItemDeleteInModal] = useState<string | null>(null);

  // PDF Report Generation Modal Preview State
  const [showPdfPreviewModal, setShowPdfPreviewModal] = useState<boolean>(false);

  // Dynamic Column Addition State for Modal View
  const [showAddColumnModal, setShowAddColumnModal] = useState<boolean>(false);
  const [newColumnName, setNewColumnName] = useState<string>('');
  const [editingColumn, setEditingColumn] = useState<{ original: string; text: string } | null>(
    null
  );

  // Show Add Entry Form state for Modal View
  const [showAddEntryModal, setShowAddEntryModal] = useState<boolean>(false);

  // Inline line item form state per expense card
  const [itemForms, setItemForms] = useState<
    Record<
      string,
      { date: string; item: string; amount: string; customValues: Record<string, string> }
    >
  >({});

  // Editing existing item state
  const [editingItem, setEditingItem] = useState<{
    expenseId: string;
    itemId: string;
    date: string;
    item: string;
    amount: string;
    customValues: Record<string, string>;
  } | null>(null);

  // Drag & Drop Reordering State
  const [draggedExpenseId, setDraggedExpenseId] = useState<string | null>(null);
  const [canDragExpenseId, setCanDragExpenseId] = useState<string | null>(null);

  // Expense Card Sorting State (a-z, z-a, amount-desc, amount-asc, custom)
  const [cardSortOption, setCardSortOption] = useState<CardSortOption>('custom');

  // Expense Card Title & Icon Editing State
  const [editingExpense, setEditingExpense] = useState<{
    id: string;
    description: string;
    icon: string;
  } | null>(null);
  const [showEditIconPicker, setShowEditIconPicker] = useState<boolean>(false);
  const [editEmojiTab, setEditEmojiTab] = useState<number>(0);

  // Click Outside Listener for Category Dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        categoryDropdownRef.current &&
        !categoryDropdownRef.current.contains(event.target as Node)
      ) {
        setShowCategoryDropdown(false);
      }
    };

    if (showCategoryDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showCategoryDropdown]);

  // Add Expense Modal State
  const [showAddModal, setShowAddModal] = useState<boolean>(false);
  const [newDescription, setNewDescription] = useState<string>('Food');
  const [newPerson, setNewPerson] = useState<Person>(activePerson);
  const [selectedIcon, setSelectedIcon] = useState<string>('🍔');
  const [activeEmojiTab, setActiveEmojiTab] = useState<number>(0);

  // Trip Expense State
  const [hasUnsavedTrip, setHasUnsavedTrip] = useState(false);
  const saveTripRef = useRef<() => void>(() => {});

  const handleTripStateChange = useCallback((hasUnsaved: boolean, saveFn: () => void) => {
    setHasUnsavedTrip(hasUnsaved);
    saveTripRef.current = saveFn;
  }, []);

  const hasUnsavedChanges =
    hasUnsavedExpenses || hasUnsavedCategories || hasUnsavedTrip;

  useEffect(() => {
    onUnsavedChanges?.(hasUnsavedChanges, () => {
      saveExpenses();
      saveCategories();
      saveTripRef.current();
    });
  }, [hasUnsavedChanges]);

  const handleSave = () => {
    saveExpenses();
    saveCategories();
    saveTripRef.current();
    setShowSaved(true);
    setTimeout(() => setShowSaved(false), 2000);
  };

  // Partner Filter
  const partnerExpenses = useMemo(() => {
    return expenses.filter((e) => e.person === activePerson);
  }, [expenses, activePerson]);

  // Date Filter matching helper function
  const isDateMatchPeriod = useCallback(
    (dateStr: string) => {
      if (!dateStr) return true;
      const d = parseISO(dateStr);
      const now = new Date();
      const todayStr = format(now, 'yyyy-MM-dd');

      if (dateFilterType === 'today') {
        return dateStr === todayStr;
      }
      if (dateFilterType === 'this_week') {
        const start = startOfWeek(now, { weekStartsOn: 1 });
        const end = endOfWeek(now, { weekStartsOn: 1 });
        return isWithinInterval(d, { start, end });
      }
      if (dateFilterType === 'this_month') {
        return format(d, 'yyyy-MM') === format(now, 'yyyy-MM');
      }
      if (dateFilterType === 'this_year') {
        return format(d, 'yyyy') === format(now, 'yyyy');
      }
      if (dateFilterType === 'custom') {
        return format(d, 'yyyy-MM') === `${selectedYear}-${selectedMonth}`;
      }
      return true;
    },
    [dateFilterType, selectedMonth, selectedYear]
  );

  // State to toggle history view inside Expense Detail Modal
  const [showAllModalHistory, setShowAllModalHistory] = useState<boolean>(false);

  // Filtered Expenses (Shows all expense cards for active person, filtered by category selection if applied)
  const filteredExpenses = useMemo(() => {
    return partnerExpenses.filter((expense) => {
      // Multi-category filter check
      if (selectedCategories.length > 0) {
        if (!selectedCategories.includes(expense.category)) {
          return false;
        }
      }
      return true;
    });
  }, [partnerExpenses, selectedCategories]);

  // Helper to extract timestamp from item/expense id or date string
  const getItemOrExpenseTimestamp = useCallback((id: string, dateStr: string): number => {
    const num = Number(id);
    if (!isNaN(num) && num > 1000000000000) {
      return num;
    }
    if (dateStr) {
      const parsed = parseISO(dateStr).getTime();
      if (!isNaN(parsed)) return parsed;
    }
    return 0;
  }, []);

  // Format timestamp into clean date & time display string
  const formatLastUsedTimestamp = useCallback((maxTime: number): string => {
    if (!maxTime || maxTime <= 0) return 'Never used';
    const d = new Date(maxTime);
    if (isNaN(d.getTime())) return 'Never used';
    const hasTime = d.getHours() !== 0 || d.getMinutes() !== 0 || d.getSeconds() !== 0;
    return hasTime ? format(d, 'MMM d, yyyy · h:mm a') : format(d, 'MMM d, yyyy');
  }, []);

  // Last used time calculation for current active filter
  const lastUsedFilterTime = useMemo(() => {
    let maxTime = 0;
    filteredExpenses.forEach((exp) => {
      if (exp.items && exp.items.length > 0) {
        exp.items.forEach((item) => {
          if (isDateMatchPeriod(item.date)) {
            const ts = getItemOrExpenseTimestamp(item.id, item.date);
            if (ts > maxTime) maxTime = ts;
          }
        });
      } else if (isDateMatchPeriod(exp.date)) {
        const ts = getItemOrExpenseTimestamp(exp.id, exp.date);
        if (ts > maxTime) maxTime = ts;
      }
    });
    return formatLastUsedTimestamp(maxTime);
  }, [filteredExpenses, isDateMatchPeriod, getItemOrExpenseTimestamp, formatLastUsedTimestamp]);

  // Last used time calculation for specific category in filter dropdown
  const getCategoryLastUsed = useCallback(
    (catName: string): string => {
      let maxTime = 0;
      partnerExpenses.forEach((exp) => {
        if (exp.category.toLowerCase() === catName.toLowerCase()) {
          if (exp.items && exp.items.length > 0) {
            exp.items.forEach((item) => {
              const ts = getItemOrExpenseTimestamp(item.id, item.date);
              if (ts > maxTime) maxTime = ts;
            });
          } else {
            const ts = getItemOrExpenseTimestamp(exp.id, exp.date);
            if (ts > maxTime) maxTime = ts;
          }
        }
      });
      return formatLastUsedTimestamp(maxTime);
    },
    [partnerExpenses, getItemOrExpenseTimestamp, formatLastUsedTimestamp]
  );

  // Helper to compute expense total amount for the selected period
  const getExpenseTotal = useCallback(
    (expense: Expense): number => {
      if (expense.items && expense.items.length > 0) {
        return expense.items
          .filter((item) => isDateMatchPeriod(item.date))
          .reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
      }
      return isDateMatchPeriod(expense.date) ? Number(expense.amount) || 0 : 0;
    },
    [isDateMatchPeriod]
  );

  // Sorted Filtered Expenses Cards (A-Z, Z-A, High to Low spend, Low to High spend)
  const sortedFilteredExpenses = useMemo(() => {
    const list = [...filteredExpenses];
    if (cardSortOption === 'a-z') {
      return list.sort((a, b) => a.description.localeCompare(b.description));
    }
    if (cardSortOption === 'z-a') {
      return list.sort((a, b) => b.description.localeCompare(a.description));
    }
    if (cardSortOption === 'amount-desc') {
      return list.sort((a, b) => getExpenseTotal(b) - getExpenseTotal(a));
    }
    if (cardSortOption === 'amount-asc') {
      return list.sort((a, b) => getExpenseTotal(a) - getExpenseTotal(b));
    }
    return list;
  }, [filteredExpenses, cardSortOption, getExpenseTotal]);

  // Helper to get filtered items for an expense
  const getExpenseFilteredItems = useCallback(
    (expense: Expense): ExpenseItem[] => {
      if (!expense.items) return [];
      return expense.items.filter((item) => isDateMatchPeriod(item.date));
    },
    [isDateMatchPeriod]
  );

  // Calculate totals for Chart Dashboard
  const categoryTotals = useMemo(() => {
    const map: Record<string, number> = {};
    filteredExpenses.forEach((exp) => {
      const amt = getExpenseTotal(exp);
      if (amt > 0) {
        map[exp.category] = (map[exp.category] || 0) + amt;
      }
    });
    return map;
  }, [filteredExpenses, getExpenseTotal]);

  const totalSpentAll = useMemo(() => {
    return Object.values(categoryTotals).reduce((sum, amt) => sum + amt, 0);
  }, [categoryTotals]);

  // Donut SVG Segments
  const chartSegments = useMemo(() => {
    const entries = Object.entries(categoryTotals).filter(([_, amt]) => amt > 0);
    const radius = 65;
    const circumference = 2 * Math.PI * radius; // ~408.4
    let accumulatedOffset = 0;

    return entries.map(([category, amount], idx) => {
      const percentage = totalSpentAll > 0 ? (amount / totalSpentAll) * 100 : 0;
      const segmentLength = (percentage / 100) * circumference;
      const strokeDasharray = `${segmentLength} ${circumference - segmentLength}`;
      const strokeDashoffset = -accumulatedOffset;
      accumulatedOffset += segmentLength;

      return {
        category,
        amount,
        percentage,
        color: CHART_COLORS[idx % CHART_COLORS.length],
        strokeDasharray,
        strokeDashoffset,
      };
    });
  }, [categoryTotals, totalSpentAll]);

  // Toggle Category Filter (Multi-select)
  const toggleCategoryFilter = (cat: string) => {
    if (cat === 'all') {
      setSelectedCategories([]);
    } else {
      setSelectedCategories((prev) =>
        prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat]
      );
    }
  };

  // Category Filter items search
  const filteredCategoryList = useMemo(() => {
    if (!categorySearch.trim()) return categories;
    const q = categorySearch.toLowerCase();
    return categories.filter((cat) => cat.toLowerCase().includes(q));
  }, [categories, categorySearch]);

  // Handlers for Categories/Filters with Delete Confirmation Prompt
  const handleAddCategory = () => {
    const cat = newCategoryInput.trim();
    if (cat && !categories.includes(cat)) {
      setCategories([...categories, cat]);
      setNewCategoryInput('');
    }
  };

  const promptDeleteCategory = (cat: string) => {
    setConfirmDialog({
      title: 'Delete Category Menu Item',
      message: `Are you sure you want to delete the "${cat}" category menu item?`,
      onConfirm: () => {
        setCategories(categories.filter((c) => c !== cat));
        setSelectedCategories((prev) => prev.filter((c) => c !== cat));
        setConfirmDialog(null);
      },
    });
  };

  const handleStartEditCategory = (cat: string) => {
    setEditingCategory({ original: cat, text: cat });
  };

  const handleSaveEditCategory = () => {
    if (!editingCategory) return;
    const trimmed = editingCategory.text.trim();
    if (trimmed && trimmed !== editingCategory.original) {
      setCategories(categories.map((c) => (c === editingCategory.original ? trimmed : c)));
      setExpenses(
        expenses.map((e) =>
          e.category === editingCategory.original ? { ...e, category: trimmed } : e
        )
      );
      setSelectedCategories((prev) =>
        prev.map((c) => (c === editingCategory.original ? trimmed : c))
      );
    }
    setEditingCategory(null);
  };

  // Dynamic Custom Column Handlers
  const handleAddCustomColumn = (expenseId: string) => {
    const col = newColumnName.trim();
    if (!col) return;

    setExpenses(
      expenses.map((exp) => {
        if (exp.id === expenseId) {
          const currentCols = exp.customColumns || [];
          if (!currentCols.includes(col)) {
            return { ...exp, customColumns: [...currentCols, col], updatedAt: new Date().toISOString() };
          }
        }
        return exp;
      })
    );

    setNewColumnName('');
    setShowAddColumnModal(false);
  };

  const handleSaveEditColumn = (expenseId: string) => {
    if (!editingColumn) return;
    const trimmed = editingColumn.text.trim();
    if (trimmed && trimmed !== editingColumn.original) {
      setExpenses(
        expenses.map((exp) => {
          if (exp.id === expenseId) {
            const updatedCols = (exp.customColumns || []).map((c) =>
              c === editingColumn.original ? trimmed : c
            );
            const updatedItems = (exp.items || []).map((item) => {
              if (item.customValues && item.customValues[editingColumn.original]) {
                const newValues = { ...item.customValues };
                newValues[trimmed] = newValues[editingColumn.original];
                delete newValues[editingColumn.original];
                return { ...item, customValues: newValues };
              }
              return item;
            });
            return { ...exp, customColumns: updatedCols, items: updatedItems, updatedAt: new Date().toISOString() };
          }
          return exp;
        })
      );
    }
    setEditingColumn(null);
  };

  const executeRemoveCustomColumn = (expenseId: string, columnName: string) => {
    setExpenses(
      expenses.map((exp) => {
        if (exp.id === expenseId) {
          const updatedCols = (exp.customColumns || []).filter((c) => c !== columnName);
          const updatedItems = (exp.items || []).map((item) => {
            if (item.customValues) {
              const newValues = { ...item.customValues };
              delete newValues[columnName];
              return { ...item, customValues: newValues };
            }
            return item;
          });
          return { ...exp, customColumns: updatedCols, items: updatedItems, updatedAt: new Date().toISOString() };
        }
        return exp;
      })
    );
    setConfirmColumnDeleteInModal(null);
  };

  // Title Handler
  const handleTitleChange = (val: string) => {
    setNewDescription(val);
    const suggestedEmoji = getEmojiForCategoryOrTitle(val);
    if (suggestedEmoji !== '💵') {
      setSelectedIcon(suggestedEmoji);
    }
  };

  const handleOpenAddModal = () => {
    const initialCat = categories.length > 0 ? categories[0] : 'Food';
    setNewDescription(initialCat);
    setSelectedIcon(getEmojiForCategoryOrTitle(initialCat));
    setShowAddModal(true);
  };

  // Handlers for Add Expense Card
  const handleCreateExpense = () => {
    const title = newDescription.trim();
    if (!title) return;

    const matchedCat = categories.find((c) => c.toLowerCase() === title.toLowerCase());
    const finalCat = matchedCat || title;

    if (!categories.map((c) => c.toLowerCase()).includes(title.toLowerCase())) {
      setCategories([...categories, title]);
    }

    const created: Expense = {
      id: Date.now().toString(),
      description: title,
      amount: 0,
      category: finalCat,
      person: newPerson,
      date: format(new Date(), 'yyyy-MM-dd'),
      icon: selectedIcon,
      items: [],
      customColumns: [],
      updatedAt: new Date().toISOString(),
    };

    setExpenses([created, ...expenses]);
    setNewDescription('');
    setShowAddModal(false);
    // Open detail view for newly created card
    setSelectedExpenseDetailId(created.id);
    setShowAddEntryModal(true);
  };

  // Line Item Handlers inside Expense Card
  const handleAddLineItem = (expenseId: string) => {
    const form = itemForms[expenseId] || {
      date: format(new Date(), 'yyyy-MM-dd'),
      item: '',
      amount: '',
      customValues: {},
    };

    if (!form.item.trim() && Object.keys(form.customValues || {}).length === 0) return;

    const newItem: ExpenseItem = {
      id: Date.now().toString(),
      date: form.date || format(new Date(), 'yyyy-MM-dd'),
      item: form.item.trim() || 'Entry',
      amount: parseFloat(form.amount) || 0,
      customValues: form.customValues || {},
    };

    setExpenses(
      expenses.map((exp) => {
        if (exp.id === expenseId) {
          const updatedItems = [...(exp.items || []), newItem];
          const newTotal = updatedItems.reduce((sum, i) => sum + i.amount, 0);
          return {
            ...exp,
            amount: newTotal,
            items: updatedItems,
            updatedAt: new Date().toISOString(),
          };
        }
        return exp;
      })
    );

    // Reset item form
    setItemForms((prev) => ({
      ...prev,
      [expenseId]: {
        date: format(new Date(), 'yyyy-MM-dd'),
        item: '',
        amount: '',
        customValues: {},
      },
    }));

    setShowAddEntryModal(false);
  };

  const executeDeleteLineItem = (expenseId: string, itemId: string) => {
    setExpenses(
      expenses.map((exp) => {
        if (exp.id === expenseId) {
          const updatedItems = (exp.items || []).filter((i) => i.id !== itemId);
          const newTotal = updatedItems.reduce((sum, i) => sum + i.amount, 0);
          return {
            ...exp,
            amount: newTotal,
            items: updatedItems,
            updatedAt: new Date().toISOString(),
          };
        }
        return exp;
      })
    );
    setConfirmItemDeleteInModal(null);
  };

  const handleSaveEditItem = () => {
    if (!editingItem) return;

    setExpenses(
      expenses.map((exp) => {
        if (exp.id === editingItem.expenseId) {
          const updatedItems = (exp.items || []).map((i) =>
            i.id === editingItem.itemId
              ? {
                  ...i,
                  date: editingItem.date,
                  item: editingItem.item.trim(),
                  amount: parseFloat(editingItem.amount) || 0,
                  customValues: editingItem.customValues || {},
                }
              : i
          );
          const newTotal = updatedItems.reduce((sum, i) => sum + i.amount, 0);
          return { ...exp, amount: newTotal, items: updatedItems, updatedAt: new Date().toISOString() };
        }
        return exp;
      })
    );

    setEditingItem(null);
  };

  const promptOutsideDeleteExpense = (expense: Expense) => {
    setConfirmDialog({
      title: 'Delete Expense Card',
      message: `Are you sure you want to delete the "${expense.description}" expense card?`,
      onConfirm: () => {
        setExpenses(expenses.filter((e) => e.id !== expense.id));
        setConfirmDialog(null);
        if (selectedExpenseDetailId === expense.id) {
          setSelectedExpenseDetailId(null);
        }
      },
    });
  };

  // Expense Title & Icon Editing Handlers
  const handleStartEditExpense = (expense: Expense) => {
    setEditingExpense({
      id: expense.id,
      description: expense.description,
      icon: expense.icon || '🍔',
    });
    setShowEditIconPicker(false);
  };

  const handleSaveEditExpense = () => {
    if (!editingExpense) return;
    const trimmed = editingExpense.description.trim();
    if (!trimmed) return;

    setExpenses(
      expenses.map((e) =>
        e.id === editingExpense.id
          ? {
              ...e,
              description: trimmed,
              icon: editingExpense.icon || '🍔',
              updatedAt: new Date().toISOString(),
            }
          : e
      )
    );
    setEditingExpense(null);
    setShowEditIconPicker(false);
  };

  // Find currently active detail card object for Modal
  const activeDetailExpense = useMemo(() => {
    if (!selectedExpenseDetailId) return null;
    return expenses.find((e) => e.id === selectedExpenseDetailId) || null;
  }, [expenses, selectedExpenseDetailId]);

  // Handle PDF Export / Print Trigger
  const handlePrintPdf = () => {
    window.print();
  };

  const activePeriodLabel = useMemo(() => {
    if (dateFilterType === 'today') return `Today (${format(new Date(), 'dd MMM yyyy')})`;
    if (dateFilterType === 'this_week') return 'This Week';
    if (dateFilterType === 'this_month') return `This Month (${format(new Date(), 'MMMM yyyy')})`;
    if (dateFilterType === 'this_year') return `This Year (${format(new Date(), 'yyyy')})`;
    return `Custom Period (${MONTHS.find((m) => m.value === selectedMonth)?.label} ${selectedYear})`;
  }, [dateFilterType, selectedMonth, selectedYear]);

  return (
    <div className="space-y-6">
      {/* Top Sub-Tab Switcher Component */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-gray-200 dark:border-gray-700 pb-4">
        <div className="flex items-center p-1 bg-gray-100/80 dark:bg-gray-800 rounded-xl border border-gray-200/60 dark:border-gray-700">
          {isMainAdmin !== false && (
            <button
              onClick={() => setExpenseTab('daily')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                expenseTab === 'daily'
                  ? 'bg-white dark:bg-gray-700 text-indigo-600 dark:text-indigo-400 shadow-sm'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100'
              }`}
            >
              <Receipt className="w-4 h-4" />
              <span>Daily Expenses</span>
            </button>
          )}
          <button
            onClick={() => setExpenseTab('trip')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
              expenseTab === 'trip' || isMainAdmin === false
                ? 'bg-white dark:bg-gray-700 text-indigo-600 dark:text-indigo-400 shadow-sm'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100'
            }`}
          >
            <Plane className="w-4 h-4" />
            <span>Trip Expenses</span>
          </button>
        </div>

        {/* Save Button */}
        <button
          onClick={handleSave}
          disabled={!hasUnsavedChanges}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
            showSaved
              ? 'bg-green-100 dark:bg-green-950/60 text-green-700 dark:text-green-300 border border-green-300 dark:border-green-800'
              : hasUnsavedChanges
                ? 'bg-indigo-600 text-white hover:bg-indigo-700'
                : 'bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-500 cursor-not-allowed border border-transparent dark:border-gray-700'
          }`}
        >
          <Save className="w-4 h-4" />
          {showSaved ? 'Saved!' : hasUnsavedChanges ? 'Save Expenses' : 'All Saved'}
        </button>
      </div>

      {/* Daily Expenses View */}
      <div className={expenseTab === 'daily' && isMainAdmin !== false ? 'space-y-6' : 'hidden'}>
        {/* Date & Time Navigation Bar (Today, Weekly, Monthly, Yearly) */}
        <div className="bg-white dark:bg-gray-800 p-4 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 dark:border-gray-700 pb-3">
            <div className="flex items-center gap-2 flex-wrap">
              <button
                onClick={() => setDateFilterType('today')}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  dateFilterType === 'today'
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600'
                }`}
              >
                Today
              </button>
              <button
                onClick={() => setDateFilterType('this_week')}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  dateFilterType === 'this_week'
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600'
                }`}
              >
                This week
              </button>
              <button
                onClick={() => setDateFilterType('this_month')}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  dateFilterType === 'this_month'
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600'
                }`}
              >
                This month
              </button>
              <button
                onClick={() => setDateFilterType('this_year')}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  dateFilterType === 'this_year'
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600'
                }`}
              >
                This year
              </button>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              {/* Month & Year Selectors */}
              <div className="flex items-center gap-1.5 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg px-2.5 py-1.5 text-xs">
                <Calendar className="w-3.5 h-3.5 text-gray-500 dark:text-gray-400" />
                <select
                  value={selectedMonth}
                  onChange={(e) => {
                    setSelectedMonth(e.target.value);
                    setDateFilterType('custom');
                  }}
                  className="bg-transparent font-medium text-gray-800 dark:text-gray-200 focus:outline-none cursor-pointer"
                >
                  {MONTHS.map((m) => (
                    <option key={m.value} value={m.value} className="dark:bg-gray-900 dark:text-white">
                      {m.label}
                    </option>
                  ))}
                </select>
                <select
                  value={selectedYear}
                  onChange={(e) => {
                    setSelectedYear(e.target.value);
                    setDateFilterType('custom');
                  }}
                  className="bg-transparent font-medium text-gray-800 dark:text-gray-200 focus:outline-none cursor-pointer border-l border-gray-200 dark:border-gray-700 pl-1.5"
                >
                  {YEARS.map((y) => (
                    <option key={y} value={y} className="dark:bg-gray-900 dark:text-white">
                      {y}
                    </option>
                  ))}
                </select>
              </div>

              {/* Unified Category Dropdown Menu Button */}
              <div ref={categoryDropdownRef} className="relative">
                <button
                  onClick={() => setShowCategoryDropdown((v) => !v)}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 dark:bg-indigo-950/60 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 border border-indigo-200 dark:border-indigo-800 rounded-lg text-xs font-semibold text-indigo-700 dark:text-indigo-300 transition-colors"
                >
                  <Filter className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                  <span>Category Menu</span>
                  {selectedCategories.length > 0 && (
                    <span className="bg-indigo-600 dark:bg-indigo-500 text-white text-[10px] font-bold px-1.5 py-0.2 rounded-full">
                      {selectedCategories.length}
                    </span>
                  )}
                  <ChevronDown
                    className={`w-3.5 h-3.5 text-indigo-400 transition-transform ${
                      showCategoryDropdown ? 'rotate-180' : ''
                    }`}
                  />
                </button>

                {/* Category Menu Items Dropdown Panel */}
                {showCategoryDropdown && (
                  <div className="absolute right-0 mt-1.5 w-72 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-2xl z-30 overflow-hidden space-y-2">
                    {/* Header */}
                    <div className="p-2.5 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between bg-gray-50 dark:bg-gray-900/80">
                      <span className="text-xs font-bold text-gray-700 dark:text-gray-200">Category Menu Items</span>
                      <button
                        onClick={() => toggleCategoryFilter('all')}
                        className="text-[11px] text-indigo-600 dark:text-indigo-400 hover:underline font-semibold"
                      >
                        {selectedCategories.length === 0 ? 'All Selected' : 'Clear All'}
                      </button>
                    </div>

                    {/* Search Input Bar */}
                    <div className="px-2.5 pt-1">
                      <div className="relative">
                        <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500" />
                        <input
                          type="text"
                          placeholder="Search menu items..."
                          value={categorySearch}
                          onChange={(e) => setCategorySearch(e.target.value)}
                          className="w-full pl-8 pr-7 py-1.5 text-xs border border-gray-200 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-gray-50/50 dark:bg-gray-900 text-gray-900 dark:text-white"
                        />
                        {categorySearch && (
                          <button
                            onClick={() => setCategorySearch('')}
                            className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Add New Category Input Bar */}
                    <div className="px-2.5 flex gap-1.5">
                      <input
                        type="text"
                        placeholder="Add menu item (e.g. Zomato)..."
                        value={newCategoryInput}
                        onChange={(e) => setNewCategoryInput(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleAddCategory()}
                        className="flex-1 min-w-0 px-2.5 py-1 text-xs border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-400"
                      />
                      <button
                        onClick={handleAddCategory}
                        disabled={!newCategoryInput.trim()}
                        className="px-2.5 py-1 bg-indigo-600 text-white rounded-lg text-xs font-medium hover:bg-indigo-700 disabled:opacity-40 flex items-center gap-1 flex-shrink-0"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Add</span>
                      </button>
                    </div>

                    {/* Category Items List with Checkbox + Inline Edit Spelling + Delete Confirmation */}
                    <div className="max-h-56 overflow-y-auto px-1 divide-y divide-gray-50 dark:divide-gray-700/50">
                      {filteredCategoryList.length === 0 ? (
                        <p className="px-3 py-3 text-xs text-gray-400 dark:text-gray-500 italic text-center">
                          No matching menu items
                        </p>
                      ) : (
                        filteredCategoryList.map((cat) => {
                          const isChecked = selectedCategories.includes(cat);
                          const isEditing = editingCategory?.original === cat;

                          return (
                            <div
                              key={cat}
                              className="flex items-center justify-between px-2 py-1.5 hover:bg-indigo-50/60 dark:hover:bg-gray-700/60 rounded-lg group text-xs transition-colors"
                            >
                              {isEditing ? (
                                <div className="flex items-center gap-1 flex-1 py-0.5">
                                  <input
                                    type="text"
                                    value={editingCategory.text}
                                    onChange={(e) =>
                                      setEditingCategory({
                                        ...editingCategory,
                                        text: e.target.value,
                                      })
                                    }
                                    onKeyDown={(e) =>
                                      e.key === 'Enter' && handleSaveEditCategory()
                                    }
                                    autoFocus
                                    className="flex-1 px-2 py-1 text-xs border border-indigo-300 dark:border-indigo-600 rounded bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none"
                                  />
                                  <button
                                    onClick={handleSaveEditCategory}
                                    className="p-1 text-green-600 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-950/40 rounded"
                                    title="Save spelling"
                                  >
                                    <Check className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    onClick={() => setEditingCategory(null)}
                                    className="p-1 text-gray-400 dark:text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
                                    title="Cancel edit"
                                  >
                                    <X className="w-3 h-3" />
                                  </button>
                                </div>
                              ) : (
                                <>
                                  <label className="flex items-center gap-2 flex-1 min-w-0 cursor-pointer py-0.5">
                                    <input
                                      type="checkbox"
                                      checked={isChecked}
                                      onChange={() => toggleCategoryFilter(cat)}
                                      className="w-3.5 h-3.5 rounded border-gray-300 dark:border-gray-600 text-indigo-600 focus:ring-indigo-500 bg-white dark:bg-gray-900"
                                    />
                                    <span className="truncate text-gray-700 dark:text-gray-200 font-medium">{cat}</span>
                                  </label>

                                  <span className="text-[10px] text-gray-400 dark:text-gray-500 font-normal ml-auto mr-1.5 flex-shrink-0" title={`Last used: ${getCategoryLastUsed(cat)}`}>
                                    {getCategoryLastUsed(cat)}
                                  </span>

                                  <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100 transition-opacity">
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleStartEditCategory(cat);
                                      }}
                                      title="Edit spelling"
                                      className="p-1 text-gray-400 dark:text-gray-500 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-gray-700 rounded"
                                    >
                                      <Edit2 className="w-3 h-3" />
                                    </button>
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        promptDeleteCategory(cat);
                                      }}
                                      title="Remove category item"
                                      className="p-1 text-gray-400 dark:text-gray-500 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 rounded"
                                    >
                                      <Trash2 className="w-3 h-3" />
                                    </button>
                                  </div>
                                </>
                              )}
                            </div>
                          );
                        })
                      )}
                    </div>

                    {/* Footer */}
                    <div className="p-2 border-t border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/80 flex items-center justify-between">
                      <span className="text-[11px] text-gray-400 dark:text-gray-500">
                        {selectedCategories.length} selected
                      </span>
                      <button
                        onClick={() => setShowCategoryDropdown(false)}
                        className="text-xs px-3 py-1 bg-indigo-600 text-white font-semibold rounded-lg hover:bg-indigo-700 shadow-sm"
                      >
                        Done
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Active Filter Chips (Chipset) & Last Used Time Bar */}
          <div className="flex items-center justify-between flex-wrap gap-2 pt-2 border-t border-gray-100 dark:border-gray-700 mt-1">
            <div className="flex items-center gap-2 flex-wrap text-xs">
              <span className="font-semibold text-gray-500 dark:text-gray-400 flex items-center gap-1">
                <Tag className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                <span>Selected Chipset:</span>
              </span>

              {selectedCategories.length === 0 ? (
                <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-100 dark:border-indigo-900">
                  All Categories
                </span>
              ) : (
                <>
                  {selectedCategories.map((cat) => (
                    <span
                      key={cat}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-indigo-600 text-white shadow-xs"
                    >
                      <span>{cat}</span>
                      <button
                        onClick={() => toggleCategoryFilter(cat)}
                        className="hover:bg-indigo-700 rounded-full p-0.5 transition-colors"
                        title={`Remove ${cat} filter`}
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}

                  <button
                    onClick={() => toggleCategoryFilter('all')}
                    className="text-[11px] text-gray-500 dark:text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 underline font-medium ml-1"
                  >
                    Clear All
                  </button>
                </>
              )}
            </div>

            {/* Last Used Time Display under filter */}
            <div className="flex items-center gap-1.5 text-xs text-gray-600 dark:text-gray-300 bg-indigo-50/70 dark:bg-indigo-950/60 border border-indigo-100 dark:border-indigo-900 px-3 py-1 rounded-lg shadow-2xs">
              <Clock className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
              <span className="font-medium text-gray-500 dark:text-gray-400">Last used time:</span>
              <span className="font-bold text-indigo-950 dark:text-indigo-200">{lastUsedFilterTime}</span>
            </div>
          </div>
        </div>

        {/* SIDE-BY-SIDE ROW: Donut SVG Chart Dashboard on Left & Add Expense Card Button on Right */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 items-stretch">
          {/* Dashboard Circle Chart Panel (3 cols) with PDF Export Button in TOP RIGHT CORNER */}
          <div className="lg:col-span-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl p-5 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-6 relative">
            {/* PDF Export Button positioned cleanly in the Top Right Corner */}
            <button
              onClick={() => setShowPdfPreviewModal(true)}
              className="absolute top-3.5 right-3.5 z-10 p-1.5 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 border border-red-200 dark:border-red-800 rounded-lg transition-colors text-xs font-semibold flex items-center gap-1 cursor-pointer shadow-2xs"
              title="Generate PDF Report"
            >
              <FileText className="w-3.5 h-3.5 text-red-600 dark:text-red-400" />
              <span>PDF</span>
            </button>

            {/* Donut Chart SVG */}
            <div className="relative flex items-center justify-center flex-shrink-0">
              <svg width="170" height="170" viewBox="0 0 170 170" className="transform -rotate-90">
                <circle
                  cx="85"
                  cy="85"
                  r="65"
                  fill="transparent"
                  stroke="currentColor"
                  className="text-gray-100 dark:text-gray-700"
                  strokeWidth="20"
                />
                {chartSegments.map((segment) => (
                  <circle
                    key={segment.category}
                    cx="85"
                    cy="85"
                    r="65"
                    fill="transparent"
                    stroke={segment.color}
                    strokeWidth={hoveredCategory === segment.category ? '24' : '20'}
                    strokeDasharray={segment.strokeDasharray}
                    strokeDashoffset={segment.strokeDashoffset}
                    className="transition-all duration-300 cursor-pointer"
                    onMouseEnter={() => setHoveredCategory(segment.category)}
                    onMouseLeave={() => setHoveredCategory(null)}
                  />
                ))}
              </svg>

              {/* Center Text displaying overall total or hovered segment */}
              <div className="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none p-2">
                {hoveredCategory ? (
                  <>
                    <span className="text-[11px] font-bold text-gray-500 dark:text-gray-400 truncate max-w-[110px]">
                      {hoveredCategory}
                    </span>
                    <span className="text-sm font-extrabold text-indigo-600 dark:text-indigo-400">
                      ${(categoryTotals[hoveredCategory] || 0).toFixed(2)}
                    </span>
                    <span className="text-[10px] text-gray-400 dark:text-gray-500">
                      {((categoryTotals[hoveredCategory] / (totalSpentAll || 1)) * 100).toFixed(1)}%
                    </span>
                  </>
                ) : (
                  <>
                    <span className="text-[11px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider">
                      Total Spent
                    </span>
                    <span className="text-base font-extrabold text-gray-900 dark:text-gray-100">
                      ${totalSpentAll.toFixed(2)}
                    </span>
                  </>
                )}
              </div>
            </div>

            {/* Chart Legend with Hover Tooltips */}
            <div className="flex-1 w-full min-w-0 pr-12 sm:pr-14">
              <div className="flex items-center justify-between border-b border-gray-100 dark:border-gray-700 pb-2 mb-3">
                <h4 className="text-xs font-bold text-gray-800 dark:text-gray-200 uppercase tracking-wider flex items-center gap-1.5">
                  <PieChart className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                  <span>Category Expenses Breakdown</span>
                </h4>

                <span className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/60 px-2 py-0.5 rounded-full">
                  ${totalSpentAll.toFixed(2)}
                </span>
              </div>

              {chartSegments.length === 0 ? (
                <p className="text-xs text-gray-400 dark:text-gray-500 italic py-4 text-center">
                  No expense data available for this period.
                </p>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-36 overflow-y-auto pr-1">
                  {chartSegments.map((segment) => (
                    <div
                      key={segment.category}
                      onMouseEnter={() => setHoveredCategory(segment.category)}
                      onMouseLeave={() => setHoveredCategory(null)}
                      className={`p-2 rounded-xl border transition-all cursor-pointer flex items-center justify-between gap-2 ${
                        hoveredCategory === segment.category
                          ? 'bg-indigo-50 dark:bg-indigo-950/60 border-indigo-300 dark:border-indigo-700 shadow-sm scale-102'
                          : 'bg-gray-50/70 dark:bg-gray-900/60 border-gray-100 dark:border-gray-700/80 hover:bg-gray-100 dark:hover:bg-gray-700/60'
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span
                          className="w-3 h-3 rounded-full flex-shrink-0"
                          style={{ backgroundColor: segment.color }}
                        />
                        <span
                          className="text-xs font-semibold text-gray-800 dark:text-gray-200 truncate"
                          title={`${segment.category}: $${segment.amount.toFixed(2)}`}
                        >
                          {segment.category}
                        </span>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <span className="text-xs font-bold text-gray-900 dark:text-gray-100 block">
                          ${segment.amount.toFixed(2)}
                        </span>
                        <span className="text-[10px] text-gray-400 dark:text-gray-500 block">
                          {segment.percentage.toFixed(1)}%
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Add Expense Card Box (1 col) - Placed side-by-side with Dashboard */}
          <button
            onClick={handleOpenAddModal}
            className="lg:col-span-1 min-h-[170px] bg-gradient-to-br from-indigo-50/80 to-purple-50/80 dark:from-gray-800 dark:to-gray-800/80 hover:from-indigo-100 hover:to-purple-100 dark:hover:from-gray-750 dark:hover:to-gray-750 border-2 border-dashed border-indigo-300 dark:border-indigo-700 rounded-2xl p-5 shadow-sm hover:shadow-md transition-all flex flex-col items-center justify-center text-center group cursor-pointer"
          >
            <div className="w-12 h-12 rounded-full bg-indigo-600 text-white flex items-center justify-center shadow-md group-hover:scale-110 transition-transform mb-2">
              <Plus className="w-6 h-6" />
            </div>
            <span className="text-sm font-bold text-indigo-950 dark:text-indigo-200">Add Expense Card</span>
            <span className="text-[11px] text-indigo-600/80 dark:text-indigo-400/80 font-medium mt-0.5">
              Click to add new
            </span>
          </button>
        </div>

        {/* Overview Box Grid Section: Saved Expense Cards (4 in a row) */}
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h3 className="text-sm font-bold text-gray-800 dark:text-gray-200 uppercase tracking-wide flex items-center gap-2">
              <Receipt className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
              <span>Expense Cards ({sortedFilteredExpenses.length})</span>
            </h3>

            {/* Sorting Dropdown Control Bar */}
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-1.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-1.5 shadow-2xs">
                <span className="text-xs font-bold text-gray-600 dark:text-gray-300 flex items-center gap-1">
                  <Filter className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                  <span>Sort Cards:</span>
                </span>
                <select
                  value={cardSortOption}
                  onChange={(e) => setCardSortOption(e.target.value as CardSortOption)}
                  className="text-xs font-bold text-indigo-900 dark:text-indigo-300 bg-transparent focus:outline-none cursor-pointer"
                >
                  <option value="custom" className="dark:bg-gray-900 dark:text-white">Default / Custom Drag Order</option>
                  <option value="a-z" className="dark:bg-gray-900 dark:text-white">A to Z (Name)</option>
                  <option value="z-a" className="dark:bg-gray-900 dark:text-white">Z to A (Name)</option>
                  <option value="amount-desc" className="dark:bg-gray-900 dark:text-white">High Money Spent → Low Money Spent</option>
                  <option value="amount-asc" className="dark:bg-gray-900 dark:text-white">Low Money Spent → High Money Spent</option>
                </select>
              </div>

              {selectedCategories.length > 0 && (
                <span className="text-xs bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 px-2.5 py-1.5 rounded-xl font-semibold border border-indigo-100 dark:border-indigo-900">
                  Filtered: {selectedCategories.join(', ')}
                </span>
              )}
            </div>
          </div>

          {/* Grid Layout: 4 Cards per row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
            {/* Saved Expense Box Cards with Drag & Drop Reordering, Sorting, and Title/Icon Editing */}
            {sortedFilteredExpenses
              .map((expense) => {
                const totalSpent = getExpenseTotal(expense);
                const isDragging = draggedExpenseId === expense.id;
                const isEditingThisCard = editingExpense?.id === expense.id;

                return (
                  <div
                    key={expense.id}
                    draggable={canDragExpenseId === expense.id}
                    onDragStart={(e) => {
                      e.dataTransfer.effectAllowed = 'move';
                      setDraggedExpenseId(expense.id);
                    }}
                    onDragOver={(e) => {
                      e.preventDefault();
                    }}
                    onDrop={() => {
                      if (draggedExpenseId && draggedExpenseId !== expense.id) {
                        const draggedIdx = expenses.findIndex((e) => e.id === draggedExpenseId);
                        const targetIdx = expenses.findIndex((e) => e.id === expense.id);
                        if (draggedIdx !== -1 && targetIdx !== -1) {
                          const newExpenses = [...expenses];
                          const [removed] = newExpenses.splice(draggedIdx, 1);
                          newExpenses.splice(targetIdx, 0, removed);
                          setExpenses(newExpenses);
                        }
                      }
                      setDraggedExpenseId(null);
                      setCanDragExpenseId(null);
                    }}
                    onDragEnd={() => {
                      setDraggedExpenseId(null);
                      setCanDragExpenseId(null);
                    }}
                    onClick={() => {
                      if (!isEditingThisCard) {
                        setSelectedExpenseDetailId(expense.id);
                        setConfirmCardDeleteInModal(false);
                        setConfirmColumnDeleteInModal(null);
                        setConfirmItemDeleteInModal(null);
                      }
                    }}
                    className={`min-h-[176px] bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl p-4 shadow-sm hover:shadow-lg hover:border-indigo-400 dark:hover:border-indigo-500 transition-all flex flex-col items-center justify-between text-center relative group ${
                      isDragging ? 'opacity-40 border-dashed border-indigo-400' : ''
                    } ${isEditingThisCard ? 'ring-2 ring-indigo-500 border-indigo-500 z-20' : 'cursor-pointer'}`}
                  >
                    {/* Top Action Bar: Drag Grip (Left) & Edit / Delete Buttons (Right) */}
                    <div className="w-full flex items-center justify-between z-10 min-h-[24px]">
                      <div
                        onMouseDown={() => setCanDragExpenseId(expense.id)}
                        onMouseUp={() => setCanDragExpenseId(null)}
                        className="opacity-0 group-hover:opacity-100 transition-opacity cursor-grab text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700"
                        title="Drag to reorder"
                      >
                        <GripVertical className="w-4 h-4" />
                      </div>

                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleStartEditExpense(expense);
                          }}
                          className="p-1 text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-gray-700 rounded-lg transition-all"
                          title="Edit title & icon"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            promptOutsideDeleteExpense(expense);
                          }}
                          className="p-1 text-gray-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 rounded-lg transition-all"
                          title="Delete card"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Card Body: Edit Mode vs Normal View */}
                    {isEditingThisCard ? (
                      <div
                        className="w-full space-y-2 py-1 z-20"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {/* Icon selector button */}
                        <div className="relative flex justify-center">
                          <button
                            type="button"
                            onClick={() => setShowEditIconPicker((v) => !v)}
                            className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800 flex items-center justify-center text-xl hover:bg-indigo-100 dark:hover:bg-indigo-900/60 transition-colors shadow-xs"
                            title="Change icon"
                          >
                            {editingExpense.icon || '🍔'}
                          </button>

                          {/* Emoji Picker Popover */}
                          {showEditIconPicker && (
                            <div className="absolute top-12 left-1/2 -translate-x-1/2 z-50 w-64 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-2xl p-3 space-y-2 text-left">
                              <div className="flex items-center justify-between text-xs font-bold text-gray-700 dark:text-gray-200 border-b border-gray-100 dark:border-gray-700 pb-1.5">
                                <span>Choose Icon</span>
                                <button
                                  type="button"
                                  onClick={() => setShowEditIconPicker(false)}
                                  className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 p-0.5"
                                >
                                  <X className="w-3.5 h-3.5" />
                                </button>
                              </div>
                              <div className="flex items-center gap-1 border-b border-gray-100 dark:border-gray-700 pb-1.5 overflow-x-auto">
                                {EMOJI_CATEGORIES.map((cat, idx) => (
                                  <button
                                    key={cat.name}
                                    type="button"
                                    onClick={() => setEditEmojiTab(idx)}
                                    className={`px-2 py-0.5 rounded text-[10px] font-semibold whitespace-nowrap transition-colors ${
                                      editEmojiTab === idx
                                        ? 'bg-indigo-600 text-white'
                                        : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                                    }`}
                                  >
                                    {cat.icon}
                                  </button>
                                ))}
                              </div>
                              <div className="grid grid-cols-5 gap-1 max-h-36 overflow-y-auto p-1">
                                {EMOJI_CATEGORIES[editEmojiTab].emojis.map((emoji) => (
                                  <button
                                    key={emoji}
                                    type="button"
                                    onClick={() => {
                                      setEditingExpense({ ...editingExpense, icon: emoji });
                                      setShowEditIconPicker(false);
                                    }}
                                    className={`h-8 text-base rounded-lg flex items-center justify-center transition-transform hover:scale-110 ${
                                      editingExpense.icon === emoji
                                        ? 'bg-indigo-600 text-white shadow-xs'
                                        : 'hover:bg-indigo-50 dark:hover:bg-indigo-950/60'
                                    }`}
                                  >
                                    {emoji}
                                  </button>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Title input */}
                        <input
                          type="text"
                          value={editingExpense.description}
                          onChange={(e) =>
                            setEditingExpense({ ...editingExpense, description: e.target.value })
                          }
                          onKeyDown={(e) => e.key === 'Enter' && handleSaveEditExpense()}
                          autoFocus
                          className="w-full px-2 py-1 text-xs border border-indigo-300 dark:border-indigo-600 rounded-lg text-center font-bold text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white dark:bg-gray-900"
                        />

                        {/* Save & Cancel buttons */}
                        <div className="flex items-center justify-center gap-1.5 pt-0.5">
                          <button
                            type="button"
                            onClick={handleSaveEditExpense}
                            className="px-2.5 py-1 bg-green-600 hover:bg-green-700 text-white rounded-lg text-[11px] font-bold shadow-2xs flex items-center gap-1"
                          >
                            <Check className="w-3 h-3" />
                            <span>Save</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingExpense(null)}
                            className="px-2.5 py-1 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 rounded-lg text-[11px] font-semibold"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        {/* Icon */}
                        <div className="w-12 h-12 rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-100 dark:border-indigo-900 flex items-center justify-center text-2xl shadow-xs group-hover:scale-105 transition-transform my-1">
                          {expense.icon || '🍔'}
                        </div>

                        {/* Title & Amount alone */}
                        <div className="w-full px-1">
                          <h4
                            className="font-bold text-gray-900 dark:text-gray-100 text-sm truncate"
                            title={expense.description}
                          >
                            {expense.description}
                          </h4>
                          <span className="text-base font-extrabold text-indigo-600 dark:text-indigo-400 block mt-0.5">
                            ${totalSpent.toFixed(2)}
                          </span>
                        </div>

                        {/* Last Updated Date & Time */}
                        <div className="flex items-center justify-center gap-1 text-[10px] text-gray-400 dark:text-gray-500 my-0.5">
                          <Clock className="w-3 h-3 text-gray-400 dark:text-gray-500 flex-shrink-0" />
                          <span>Updated: {formatLastUpdated(expense.updatedAt || expense.date)}</span>
                        </div>

                        <span className="text-[10px] text-indigo-500 dark:text-indigo-400 font-semibold group-hover:underline opacity-80 mb-1">
                          Click for details →
                        </span>
                      </>
                    )}
                  </div>
                );
              })}
          </div>
        </div>
      </div>

      {/* Trip Expenses View (Untouched) */}
      <div className={expenseTab === 'trip' ? 'block' : 'hidden'}>
        <TripExpense
          activePerson={activePerson}
          partner1Name={partner1Name}
          partner2Name={partner2Name}
          accessToken={accessToken}
          allowedTripIds={allowedTripIds}
          isReadOnly={isReadOnly}
          onChangeState={handleTripStateChange}
        />
      </div>

      {/* Detail View Modal (Opens on card click; prompts deletions IN THE DETAILED VIEW ITSELF!) */}
      {activeDetailExpense && (
        <div className="fixed inset-0 z-[9999] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 w-full max-w-3xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            {/* Screenshot Header Bar: Chevron ∨ | Icon + Title + (X entries) | + Add Entry | + Add Column | Trash Icon | Close X */}
            <div className="p-4 bg-white dark:bg-gray-800 border-b border-gray-100 dark:border-gray-700 flex flex-wrap items-center justify-between gap-3">
              {/* Left Side: Chevron + Icon + Title + (X entries) + Edit Button */}
              <div className="flex items-center gap-2.5 flex-1 min-w-0">
                <ChevronDown className="w-4 h-4 text-gray-400 dark:text-gray-500 flex-shrink-0" />

                {editingExpense?.id === activeDetailExpense.id ? (
                  <div className="flex items-center gap-2 flex-1 min-w-0" onClick={(e) => e.stopPropagation()}>
                    <div className="relative flex-shrink-0">
                      <button
                        type="button"
                        onClick={() => setShowEditIconPicker((v) => !v)}
                        className="w-8 h-8 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800 flex items-center justify-center text-base hover:bg-indigo-100 dark:hover:bg-indigo-900/60 transition-colors shadow-2xs"
                        title="Change icon"
                      >
                        {editingExpense.icon || '🍔'}
                      </button>

                      {/* Emoji Picker Popover in Modal Header */}
                      {showEditIconPicker && (
                        <div className="absolute top-10 left-0 z-50 w-64 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-2xl p-3 space-y-2 text-left">
                          <div className="flex items-center justify-between text-xs font-bold text-gray-700 dark:text-gray-200 border-b border-gray-100 dark:border-gray-700 pb-1.5">
                            <span>Choose Icon</span>
                            <button
                              type="button"
                              onClick={() => setShowEditIconPicker(false)}
                              className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 p-0.5"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                          <div className="flex items-center gap-1 border-b border-gray-100 dark:border-gray-700 pb-1.5 overflow-x-auto">
                            {EMOJI_CATEGORIES.map((cat, idx) => (
                              <button
                                key={cat.name}
                                type="button"
                                onClick={() => setEditEmojiTab(idx)}
                                className={`px-2 py-0.5 rounded text-[10px] font-semibold whitespace-nowrap transition-colors ${
                                  editEmojiTab === idx
                                    ? 'bg-indigo-600 text-white'
                                    : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                                }`}
                              >
                                {cat.icon}
                              </button>
                            ))}
                          </div>
                          <div className="grid grid-cols-5 gap-1 max-h-36 overflow-y-auto p-1">
                            {EMOJI_CATEGORIES[editEmojiTab].emojis.map((emoji) => (
                              <button
                                key={emoji}
                                type="button"
                                onClick={() => {
                                  setEditingExpense({ ...editingExpense, icon: emoji });
                                  setShowEditIconPicker(false);
                                }}
                                className={`h-8 text-base rounded-lg flex items-center justify-center transition-transform hover:scale-110 ${
                                  editingExpense.icon === emoji
                                    ? 'bg-indigo-600 text-white shadow-xs'
                                    : 'hover:bg-indigo-50 dark:hover:bg-indigo-950/60'
                                }`}
                              >
                                {emoji}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                    <input
                      type="text"
                      value={editingExpense.description}
                      onChange={(e) =>
                        setEditingExpense({ ...editingExpense, description: e.target.value })
                      }
                      onKeyDown={(e) => e.key === 'Enter' && handleSaveEditExpense()}
                      autoFocus
                      className="flex-1 min-w-0 px-2.5 py-1 text-sm border border-indigo-300 dark:border-indigo-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 font-bold text-gray-900 dark:text-white bg-white dark:bg-gray-900"
                    />

                    <button
                      type="button"
                      onClick={handleSaveEditExpense}
                      className="p-1.5 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors flex-shrink-0"
                      title="Save title & icon"
                    >
                      <Check className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditingExpense(null)}
                      className="p-1.5 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 rounded-lg transition-colors flex-shrink-0"
                      title="Cancel"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <>
                    <div className="w-8 h-8 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-100 dark:border-indigo-900 flex items-center justify-center text-base shadow-2xs flex-shrink-0">
                      {activeDetailExpense.icon || '🍔'}
                    </div>
                    <h3 className="text-base font-bold text-gray-900 dark:text-gray-100 truncate">
                      {activeDetailExpense.description}
                    </h3>
                    <button
                      type="button"
                      onClick={() => handleStartEditExpense(activeDetailExpense)}
                      className="p-1 text-gray-400 dark:text-gray-500 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-gray-700 rounded-lg transition-colors flex-shrink-0"
                      title="Edit title & icon"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <span className="text-xs text-gray-400 dark:text-gray-500 font-medium flex-shrink-0">
                      ({(showAllModalHistory ? activeDetailExpense.items || [] : getExpenseFilteredItems(activeDetailExpense)).length} entries)
                    </span>
                    {formatLastUpdated(activeDetailExpense.updatedAt || activeDetailExpense.date) && (
                      <span className="text-[10px] text-gray-400 dark:text-gray-500 font-medium flex items-center gap-1 flex-shrink-0">
                        <Clock className="w-3 h-3 text-gray-400 dark:text-gray-500" />
                        <span>Updated: {formatLastUpdated(activeDetailExpense.updatedAt || activeDetailExpense.date)}</span>
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={() => setShowAllModalHistory((v) => !v)}
                      className={`text-[11px] px-2.5 py-0.5 rounded-full font-bold border transition-all ${
                        showAllModalHistory
                          ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                          : 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800 hover:bg-indigo-100 dark:hover:bg-indigo-900/60'
                      }`}
                      title="Toggle between current period entries and complete card history"
                    >
                      {showAllModalHistory ? 'All History' : 'Period Filter'}
                    </button>
                  </>
                )}
              </div>

              {/* Right Side: + Add Entry (Purple) | + Add Column (Gray) | Red Trash Icon | Close X */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddEntryModal((v) => !v)}
                  className="flex items-center gap-1 px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-lg shadow-xs transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Entry</span>
                </button>

                <button
                  type="button"
                  onClick={() => setShowAddColumnModal((v) => !v)}
                  className="flex items-center gap-1 px-3.5 py-1.5 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 font-bold text-xs rounded-lg transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Column</span>
                </button>

                <button
                  type="button"
                  onClick={() => setConfirmCardDeleteInModal((v) => !v)}
                  className={`p-1.5 rounded-lg transition-colors ${
                    confirmCardDeleteInModal
                      ? 'bg-red-600 text-white'
                      : 'text-red-500 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 hover:bg-red-50 dark:hover:bg-red-950/40'
                  }`}
                  title="Delete card"
                >
                  <Trash2 className="w-4 h-4" />
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setSelectedExpenseDetailId(null);
                    setShowAddColumnModal(false);
                    setShowAddEntryModal(false);
                    setConfirmCardDeleteInModal(false);
                  }}
                  className="p-1.5 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* In-Modal Card Deletion Prompt (Prompted INSIDE detailed view itself!) */}
            {confirmCardDeleteInModal && (
              <div className="p-3.5 bg-red-50 border-b border-red-200 flex flex-wrap items-center justify-between gap-3 animate-in slide-in-from-top-1 duration-150">
                <div className="flex items-center gap-2 text-red-800 font-semibold text-xs">
                  <AlertTriangle className="w-4 h-4 text-red-600 flex-shrink-0" />
                  <span>
                    Delete the entire "{activeDetailExpense.description}" expense card and all its entries?
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setExpenses(expenses.filter((e) => e.id !== activeDetailExpense.id));
                      setSelectedExpenseDetailId(null);
                      setConfirmCardDeleteInModal(false);
                    }}
                    className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white font-bold text-xs rounded-lg shadow-xs transition-colors"
                  >
                    Yes, Delete Card
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmCardDeleteInModal(false)}
                    className="px-3 py-1.5 bg-white border border-gray-300 text-gray-700 font-semibold text-xs rounded-lg hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {/* Add Custom Column Drawer */}
            {showAddColumnModal && (
              <div className="p-3 bg-indigo-50/80 dark:bg-gray-900 border-b border-indigo-100 dark:border-gray-700 flex items-center gap-2 animate-in slide-in-from-top-1 duration-150">
                <input
                  type="text"
                  placeholder="Column header name (e.g. Time, Reading, Location)..."
                  value={newColumnName}
                  onChange={(e) => setNewColumnName(e.target.value)}
                  onKeyDown={(e) =>
                    e.key === 'Enter' && handleAddCustomColumn(activeDetailExpense.id)
                  }
                  autoFocus
                  className="flex-1 px-3 py-1.5 text-xs border border-indigo-300 dark:border-indigo-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <button
                  type="button"
                  onClick={() => handleAddCustomColumn(activeDetailExpense.id)}
                  disabled={!newColumnName.trim()}
                  className="px-3.5 py-1.5 bg-indigo-600 text-white rounded-lg text-xs font-bold hover:bg-indigo-700 disabled:opacity-40"
                >
                  Add Column
                </button>
                <button
                  type="button"
                  onClick={() => setShowAddColumnModal(false)}
                  className="p-1.5 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}

            {/* Add New Entry Drawer */}
            {showAddEntryModal && (
              <div className="p-3 bg-indigo-50/80 dark:bg-gray-900 border-b border-indigo-100 dark:border-gray-700 space-y-2 animate-in slide-in-from-top-1 duration-150">
                <span className="text-xs font-bold text-indigo-900 dark:text-indigo-300 uppercase tracking-wider block">
                  + Add New Entry
                </span>
                <div className="flex flex-wrap gap-2">
                  <input
                    type="date"
                    value={
                      itemForms[activeDetailExpense.id]?.date || format(new Date(), 'yyyy-MM-dd')
                    }
                    onChange={(e) =>
                      setItemForms((prev) => ({
                        ...prev,
                        [activeDetailExpense.id]: {
                          ...(prev[activeDetailExpense.id] || {
                            date: format(new Date(), 'yyyy-MM-dd'),
                            item: '',
                            amount: '',
                            customValues: {},
                          }),
                          date: e.target.value,
                        },
                      }))
                    }
                    className="w-36 px-3 py-1.5 text-xs border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-400"
                  />
                  <input
                    type="text"
                    placeholder="Detail description..."
                    value={itemForms[activeDetailExpense.id]?.item || ''}
                    onChange={(e) =>
                      setItemForms((prev) => ({
                        ...prev,
                        [activeDetailExpense.id]: {
                          ...(prev[activeDetailExpense.id] || {
                            date: format(new Date(), 'yyyy-MM-dd'),
                            item: '',
                            amount: '',
                            customValues: {},
                          }),
                          item: e.target.value,
                        },
                      }))
                    }
                    onKeyDown={(e) =>
                      e.key === 'Enter' && handleAddLineItem(activeDetailExpense.id)
                    }
                    className="flex-1 min-w-[140px] px-3 py-1.5 text-xs border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-400"
                  />

                  {/* Custom Column Inputs in Form */}
                  {(activeDetailExpense.customColumns || []).map((col) => (
                    <input
                      key={col}
                      type="text"
                      placeholder={col}
                      value={itemForms[activeDetailExpense.id]?.customValues?.[col] || ''}
                      onChange={(e) =>
                        setItemForms((prev) => ({
                          ...prev,
                          [activeDetailExpense.id]: {
                            ...(prev[activeDetailExpense.id] || {
                              date: format(new Date(), 'yyyy-MM-dd'),
                              item: '',
                              amount: '',
                              customValues: {},
                            }),
                            customValues: {
                              ...(prev[activeDetailExpense.id]?.customValues || {}),
                              [col]: e.target.value,
                            },
                          },
                        }))
                      }
                      className="w-28 px-3 py-1.5 text-xs border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-400"
                    />
                  ))}

                  <input
                    type="number"
                    step="0.01"
                    placeholder="Amount ($)..."
                    value={itemForms[activeDetailExpense.id]?.amount || ''}
                    onChange={(e) =>
                      setItemForms((prev) => ({
                        ...prev,
                        [activeDetailExpense.id]: {
                          ...(prev[activeDetailExpense.id] || {
                            date: format(new Date(), 'yyyy-MM-dd'),
                            item: '',
                            amount: '',
                            customValues: {},
                          }),
                          amount: e.target.value,
                        },
                      }))
                    }
                    onKeyDown={(e) =>
                      e.key === 'Enter' && handleAddLineItem(activeDetailExpense.id)
                    }
                    className="w-28 px-3 py-1.5 text-xs border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-400 text-right"
                  />
                  <button
                    type="button"
                    onClick={() => handleAddLineItem(activeDetailExpense.id)}
                    className="px-3.5 py-1.5 bg-indigo-600 text-white rounded-lg text-xs font-bold hover:bg-indigo-700 shadow-sm"
                  >
                    Save Entry
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowAddEntryModal(false)}
                    className="p-1.5 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}

            {/* Modal Body: Screenshot Formatted Table */}
            <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-gray-100 dark:border-gray-700 text-gray-400 dark:text-gray-400 font-semibold">
                      <th className="py-2.5 px-3">Date</th>
                      <th className="py-2.5 px-3">Detail</th>

                      {/* Dynamic Custom Column Headers */}
                      {(activeDetailExpense.customColumns || []).map((col) => {
                        const isEditingCol = editingColumn?.original === col;
                        const isDeletingCol = confirmColumnDeleteInModal === col;

                        return (
                          <th key={col} className="py-2.5 px-3">
                            {isDeletingCol ? (
                              <div className="flex items-center gap-1 bg-red-50 dark:bg-red-950/60 p-1 rounded">
                                <span className="text-red-700 dark:text-red-300 font-bold text-[11px]">Delete {col}?</span>
                                <button
                                  onClick={() =>
                                    executeRemoveCustomColumn(activeDetailExpense.id, col)
                                  }
                                  className="px-1.5 py-0.5 bg-red-600 text-white rounded text-[10px] font-bold"
                                >
                                  Yes
                                </button>
                                <button
                                  onClick={() => setConfirmColumnDeleteInModal(null)}
                                  className="px-1.5 py-0.5 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200 rounded text-[10px]"
                                >
                                  No
                                </button>
                              </div>
                            ) : isEditingCol ? (
                              <div className="flex items-center gap-1">
                                <input
                                  type="text"
                                  value={editingColumn.text}
                                  onChange={(e) =>
                                    setEditingColumn({
                                      ...editingColumn,
                                      text: e.target.value,
                                    })
                                  }
                                  onKeyDown={(e) =>
                                    e.key === 'Enter' &&
                                    handleSaveEditColumn(activeDetailExpense.id)
                                  }
                                  autoFocus
                                  className="w-24 px-1.5 py-0.5 border border-indigo-300 dark:border-indigo-600 rounded text-xs bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none normal-case"
                                />
                                <button
                                  onClick={() => handleSaveEditColumn(activeDetailExpense.id)}
                                  className="p-0.5 text-green-600 dark:text-green-400 hover:bg-green-100 dark:hover:bg-green-950/40 rounded"
                                >
                                  <Check className="w-3 h-3" />
                                </button>
                                <button
                                  onClick={() => setEditingColumn(null)}
                                  className="p-0.5 text-gray-400 dark:text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
                                >
                                  <X className="w-3 h-3" />
                                </button>
                              </div>
                            ) : (
                              <div className="flex items-center gap-1 group/col">
                                <span>{col}</span>
                                <div className="flex items-center gap-0.5 opacity-0 group-hover/col:opacity-100 transition-opacity">
                                  <button
                                    onClick={() => setEditingColumn({ original: col, text: col })}
                                    className="p-0.5 text-gray-400 dark:text-gray-500 hover:text-indigo-600 dark:hover:text-indigo-400 rounded"
                                    title="Rename column"
                                  >
                                    <Edit2 className="w-3 h-3" />
                                  </button>
                                  <button
                                    onClick={() => setConfirmColumnDeleteInModal(col)}
                                    className="p-0.5 text-gray-400 dark:text-gray-500 hover:text-red-600 dark:hover:text-red-400 rounded"
                                    title="Remove column"
                                  >
                                    <Trash2 className="w-3 h-3" />
                                  </button>
                                </div>
                              </div>
                            )}
                          </th>
                        );
                      })}

                      <th className="py-2.5 px-3 text-right">Amount ($)</th>
                      <th className="py-2.5 px-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50 dark:divide-gray-700/60 text-gray-700 dark:text-gray-200 font-medium">
                    {(() => {
                      const modalItems = showAllModalHistory
                        ? activeDetailExpense.items || []
                        : getExpenseFilteredItems(activeDetailExpense);

                      if (modalItems.length === 0) {
                        return (
                          <tr>
                            <td
                              colSpan={4 + (activeDetailExpense.customColumns || []).length}
                              className="py-8 text-center text-gray-400 dark:text-gray-500 italic"
                            >
                              No entries found {showAllModalHistory ? 'in history' : 'for this period'}. Click "+ Add Entry" above to create an entry!
                            </td>
                          </tr>
                        );
                      }

                      return modalItems.map((item) => {
                        const isItemEditing =
                          editingItem?.expenseId === activeDetailExpense.id &&
                          editingItem?.itemId === item.id;
                        const isItemDeleting = confirmItemDeleteInModal === item.id;

                        if (isItemDeleting) {
                          return (
                            <tr key={item.id} className="bg-red-50/80 dark:bg-red-950/60">
                              <td
                                colSpan={4 + (activeDetailExpense.customColumns || []).length}
                                className="py-2.5 px-4"
                              >
                                <div className="flex items-center justify-between">
                                  <span className="text-red-800 dark:text-red-200 font-bold text-xs">
                                    Delete entry "{item.item || 'this entry'}"?
                                  </span>
                                  <div className="flex items-center gap-2">
                                    <button
                                      onClick={() =>
                                        executeDeleteLineItem(activeDetailExpense.id, item.id)
                                      }
                                      className="px-3 py-1 bg-red-600 text-white rounded-lg font-bold text-xs hover:bg-red-700"
                                    >
                                      Delete
                                    </button>
                                    <button
                                      onClick={() => setConfirmItemDeleteInModal(null)}
                                      className="px-3 py-1 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 rounded-lg text-xs font-semibold hover:bg-gray-100 dark:hover:bg-gray-700"
                                    >
                                      Cancel
                                    </button>
                                  </div>
                                </div>
                              </td>
                            </tr>
                          );
                        }

                        if (isItemEditing) {
                          return (
                            <tr key={item.id} className="bg-indigo-50/50 dark:bg-indigo-950/50">
                              <td className="py-2 px-3">
                                <input
                                  type="date"
                                  value={editingItem.date}
                                  onChange={(e) =>
                                    setEditingItem({
                                      ...editingItem,
                                      date: e.target.value,
                                    })
                                  }
                                  className="px-2 py-1 border border-indigo-300 dark:border-indigo-600 rounded-lg text-xs bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none"
                                />
                              </td>
                              <td className="py-2 px-3">
                                <input
                                  type="text"
                                  value={editingItem.item}
                                  onChange={(e) =>
                                    setEditingItem({
                                      ...editingItem,
                                      item: e.target.value,
                                    })
                                  }
                                  className="w-full px-2 py-1 border border-indigo-300 dark:border-indigo-600 rounded-lg text-xs bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none"
                                />
                              </td>

                              {/* Custom Column Editing Inputs */}
                              {(activeDetailExpense.customColumns || []).map((col) => (
                                <td key={col} className="py-2 px-3">
                                  <input
                                    type="text"
                                    placeholder={col}
                                    value={editingItem.customValues[col] || ''}
                                    onChange={(e) =>
                                      setEditingItem({
                                        ...editingItem,
                                        customValues: {
                                          ...editingItem.customValues,
                                          [col]: e.target.value,
                                        },
                                      })
                                    }
                                    className="w-full px-2 py-1 border border-indigo-300 dark:border-indigo-600 rounded-lg text-xs bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none"
                                  />
                                </td>
                              ))}

                              <td className="py-2 px-3 text-right">
                                <input
                                  type="number"
                                  step="0.01"
                                  value={editingItem.amount}
                                  onChange={(e) =>
                                    setEditingItem({
                                      ...editingItem,
                                      amount: e.target.value,
                                    })
                                  }
                                  className="w-24 px-2 py-1 border border-indigo-300 dark:border-indigo-600 rounded-lg text-xs bg-white dark:bg-gray-900 text-gray-900 dark:text-white text-right focus:outline-none"
                                />
                              </td>
                              <td className="py-2 px-3 text-right">
                                <div className="flex items-center justify-end gap-1">
                                  <button
                                    onClick={handleSaveEditItem}
                                    className="p-1 text-green-600 dark:text-green-400 hover:bg-green-100 dark:hover:bg-green-950/40 rounded-lg"
                                    title="Save detail"
                                  >
                                    <Check className="w-4 h-4" />
                                  </button>
                                  <button
                                    onClick={() => setEditingItem(null)}
                                    className="p-1 text-gray-400 dark:text-gray-500 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg"
                                    title="Cancel"
                                  >
                                    <X className="w-4 h-4" />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        }

                        return (
                          <tr key={item.id} className="hover:bg-gray-50/80 dark:hover:bg-gray-700/50 transition-colors">
                            <td className="py-3 px-3 text-gray-600 dark:text-gray-400 font-normal">
                              {item.date ? format(parseISO(item.date), 'dd MMM yyyy') : '-'}
                            </td>
                            <td className="py-3 px-3 font-semibold text-gray-800 dark:text-gray-200">
                              {item.item}
                            </td>

                            {/* Dynamic Custom Column Values */}
                            {(activeDetailExpense.customColumns || []).map((col) => (
                              <td key={col} className="py-3 px-3 text-gray-700 dark:text-gray-300">
                                {item.customValues?.[col] || '-'}
                              </td>
                            ))}

                            <td className="py-3 px-3 text-right font-bold text-gray-900 dark:text-gray-100">
                              ${item.amount.toFixed(2)}
                            </td>
                            <td className="py-3 px-3 text-right">
                              <div className="flex items-center justify-end gap-1.5 opacity-60 hover:opacity-100 transition-opacity">
                                <button
                                  onClick={() =>
                                    setEditingItem({
                                      expenseId: activeDetailExpense.id,
                                      itemId: item.id,
                                      date: item.date,
                                      item: item.item,
                                      amount: item.amount.toString(),
                                      customValues: item.customValues || {},
                                    })
                                  }
                                  className="p-1 text-gray-400 dark:text-gray-500 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-gray-700 rounded-md"
                                  title="Edit entry"
                                >
                                  <Edit2 className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={() => setConfirmItemDeleteInModal(item.id)}
                                  className="p-1 text-gray-400 dark:text-gray-500 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 rounded-md"
                                  title="Delete entry"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      });
                    })()}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Modal Footer: Total Spent */}
            <div className="px-6 py-4 border-t border-gray-100 bg-gray-50 flex items-center justify-between">
              <span className="text-xs font-semibold text-gray-600">
                {activeDetailExpense.description} Total Spent:
              </span>
              <span className="text-lg font-extrabold text-indigo-600">
                ${getExpenseTotal(activeDetailExpense).toFixed(2)}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Full PDF Report Document Preview & Print Modal */}
      {showPdfPreviewModal && (
        <div className="fixed inset-0 z-[10000] bg-black/60 backdrop-blur-md flex flex-col items-center justify-start p-4 overflow-y-auto print:p-0 print:bg-white print:static">
          {/* Action Control Bar (Hidden when printing) */}
          <div className="w-full max-w-4xl bg-gray-900 text-white rounded-2xl p-4 mb-4 flex items-center justify-between shadow-2xl print:hidden sticky top-2 z-50">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-sm">
                <FileText className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold">Expenditure PDF Report Preview</h3>
                <span className="text-xs text-gray-400">
                  {activePeriodLabel} • Overall Dashboard & Expanded Cards
                </span>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={handlePrintPdf}
                className="flex items-center gap-2 px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl shadow-md transition-all cursor-pointer"
              >
                <Printer className="w-4 h-4" />
                <span>Print / Save as PDF</span>
              </button>
              <button
                onClick={() => setShowPdfPreviewModal(false)}
                className="p-2 text-gray-400 hover:text-white rounded-xl hover:bg-gray-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Printable Report Document Container */}
          <div className="w-full max-w-4xl bg-white rounded-2xl border border-gray-200 p-8 shadow-2xl space-y-8 print:shadow-none print:border-none print:p-0 print:w-full text-gray-900">
            {/* Report Document Header */}
            <div className="border-b-2 border-indigo-600 pb-6 flex items-start justify-between">
              <div>
                <h1 className="text-2xl font-black tracking-tight text-indigo-950 uppercase">
                  TrackMyDay Expenditure Report
                </h1>
                <p className="text-xs text-gray-500 font-semibold mt-1">
                  Period: <span className="text-indigo-600 font-bold">{activePeriodLabel}</span>
                </p>
                <p className="text-xs text-gray-400 mt-0.5">
                  Partner Profile:{' '}
                  <span className="font-semibold text-gray-700 capitalize">{activePerson}</span>
                </p>
              </div>
              <div className="text-right">
                <span className="text-xs text-gray-400 block font-semibold">Report Date</span>
                <span className="text-sm font-bold text-gray-800">
                  {format(new Date(), 'dd MMMM yyyy')}
                </span>
                <span className="text-[10px] text-gray-400 block mt-1">
                  Generated from TrackMyDay App
                </span>
              </div>
            </div>

            {/* SECTION 1: Overall Dashboard & Breakdown Table */}
            <div className="space-y-4">
              <h2 className="text-sm font-extrabold text-gray-800 uppercase tracking-wider flex items-center gap-2 border-b border-gray-200 pb-2">
                <PieChart className="w-4 h-4 text-indigo-600" />
                <span>1. Overall Dashboard Summary</span>
              </h2>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-indigo-50/70 border border-indigo-100 p-4 rounded-xl text-center">
                  <span className="text-xs text-gray-500 font-bold uppercase block">Total Spent</span>
                  <span className="text-2xl font-black text-indigo-600 mt-1 block">
                    ${totalSpentAll.toFixed(2)}
                  </span>
                </div>
                <div className="bg-purple-50/70 border border-purple-100 p-4 rounded-xl text-center">
                  <span className="text-xs text-gray-500 font-bold uppercase block">Total Cards</span>
                  <span className="text-2xl font-black text-purple-600 mt-1 block">
                    {filteredExpenses.length}
                  </span>
                </div>
                <div className="bg-emerald-50/70 border border-emerald-100 p-4 rounded-xl text-center">
                  <span className="text-xs text-gray-500 font-bold uppercase block">Category Count</span>
                  <span className="text-2xl font-black text-emerald-600 mt-1 block">
                    {Object.keys(categoryTotals).length}
                  </span>
                </div>
              </div>

              {/* Category Breakdown Table */}
              <div className="overflow-x-auto border border-gray-200 rounded-xl">
                <table className="w-full text-left text-xs">
                  <thead className="bg-gray-100 text-gray-600 font-bold uppercase">
                    <tr>
                      <th className="py-2.5 px-4">Category</th>
                      <th className="py-2.5 px-4 text-right">Amount ($)</th>
                      <th className="py-2.5 px-4 text-right">% Breakdown</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {Object.entries(categoryTotals).map(([cat, amt]) => {
                      const pct = totalSpentAll > 0 ? (amt / totalSpentAll) * 100 : 0;
                      return (
                        <tr key={cat}>
                          <td className="py-2 px-4 font-semibold text-gray-800">{cat}</td>
                          <td className="py-2 px-4 text-right font-bold text-gray-900">
                            ${amt.toFixed(2)}
                          </td>
                          <td className="py-2 px-4 text-right text-gray-500">{pct.toFixed(1)}%</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* SECTION 2: Expanded Cards & Itemized Tables */}
            <div className="space-y-6">
              <h2 className="text-sm font-extrabold text-gray-800 uppercase tracking-wider flex items-center gap-2 border-b border-gray-200 pb-2">
                <Receipt className="w-4 h-4 text-indigo-600" />
                <span>2. Expanded Expense Cards & Detail Entries</span>
              </h2>

              {filteredExpenses.length === 0 ? (
                <p className="text-xs text-gray-400 italic text-center py-4">
                  No expense cards recorded for this period.
                </p>
              ) : (
                filteredExpenses.map((exp) => {
                  const items = getExpenseFilteredItems(exp);
                  const cardTotal = getExpenseTotal(exp);

                  return (
                    <div key={exp.id} className="border border-gray-200 rounded-xl overflow-hidden space-y-2 p-4 page-break-inside-avoid">
                      {/* Card Header */}
                      <div className="flex items-center justify-between border-b border-gray-100 pb-2">
                        <div className="flex items-center gap-2">
                          <span className="text-lg">{exp.icon || '🍔'}</span>
                          <h3 className="font-bold text-sm text-gray-900">{exp.description}</h3>
                          <span className="text-xs text-gray-400">({items.length} entries)</span>
                        </div>
                        <span className="text-sm font-extrabold text-indigo-600">
                          ${cardTotal.toFixed(2)}
                        </span>
                      </div>

                      {/* Itemized Table */}
                      <table className="w-full text-left text-xs border-collapse">
                        <thead>
                          <tr className="border-b border-gray-200 text-gray-400 font-semibold uppercase">
                            <th className="py-1.5 px-2">Date</th>
                            <th className="py-1.5 px-2">Detail</th>
                            {(exp.customColumns || []).map((col) => (
                              <th key={col} className="py-1.5 px-2">
                                {col}
                              </th>
                            ))}
                            <th className="py-1.5 px-2 text-right">Amount ($)</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {items.length === 0 ? (
                            <tr>
                              <td
                                colSpan={3 + (exp.customColumns || []).length}
                                className="py-3 text-center text-gray-400 italic"
                              >
                                No entries recorded
                              </td>
                            </tr>
                          ) : (
                            items.map((item) => (
                              <tr key={item.id}>
                                <td className="py-2 px-2 text-gray-500">
                                  {item.date ? format(parseISO(item.date), 'dd MMM yyyy') : '-'}
                                </td>
                                <td className="py-2 px-2 font-semibold text-gray-800">
                                  {item.item}
                                </td>
                                {(exp.customColumns || []).map((col) => (
                                  <td key={col} className="py-2 px-2 text-gray-600">
                                    {item.customValues?.[col] || '-'}
                                  </td>
                                ))}
                                <td className="py-2 px-2 text-right font-bold text-gray-900">
                                  ${item.amount.toFixed(2)}
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  );
                })
              )}
            </div>

            {/* Footer */}
            <div className="border-t border-gray-200 pt-4 text-center text-[11px] text-gray-400">
              End of TrackMyDay Expenditure Report • Generated on {format(new Date(), 'dd MMM yyyy HH:mm')}
            </div>
          </div>
        </div>
      )}

      {/* Modal: Add Expense Card with Title, Icon (Emoji Picker) */}
      {showAddModal && (
        <div className="fixed inset-0 z-[9999] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-gray-200 w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gradient-to-r from-indigo-50 to-purple-50">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-indigo-600 text-white flex items-center justify-center shadow-sm">
                  <Plus className="w-5 h-5" />
                </div>
                <h3 className="text-base font-bold text-gray-900">Add New Expense Card</h3>
              </div>
              <button
                onClick={() => setShowAddModal(false)}
                className="p-1 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-200/50"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Form Content */}
            <div className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
              {/* Title / Item Name */}
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  Title / Item Name
                </label>
                <input
                  type="text"
                  placeholder="e.g. Food, Zomato, EB Reading, Milk"
                  value={newDescription}
                  onChange={(e) => handleTitleChange(e.target.value)}
                  autoFocus
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              {/* Emoji Icon Picker */}
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1 flex items-center justify-between">
                  <span>Icon / Emoji</span>
                  <span className="text-gray-400 font-normal text-[11px]">Selected: {selectedIcon}</span>
                </label>

                {/* Category tabs */}
                <div className="flex items-center gap-1 border-b border-gray-200 mb-2 overflow-x-auto pb-1">
                  {EMOJI_CATEGORIES.map((cat, idx) => (
                    <button
                      key={cat.name}
                      type="button"
                      onClick={() => setActiveEmojiTab(idx)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-semibold flex items-center gap-1 whitespace-nowrap transition-all ${
                        activeEmojiTab === idx
                          ? 'bg-indigo-600 text-white'
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                    >
                      <span>{cat.icon}</span>
                      <span>{cat.name}</span>
                    </button>
                  ))}
                </div>

                {/* Emoji Grid */}
                <div className="grid grid-cols-7 gap-1.5 p-2 bg-gray-50 border border-gray-200 rounded-xl">
                  {EMOJI_CATEGORIES[activeEmojiTab].emojis.map((emoji) => (
                    <button
                      key={emoji}
                      type="button"
                      onClick={() => setSelectedIcon(emoji)}
                      className={`h-9 text-lg rounded-lg flex items-center justify-center transition-transform hover:scale-125 ${
                        selectedIcon === emoji
                          ? 'bg-indigo-600 text-white shadow-md ring-2 ring-indigo-400'
                          : 'hover:bg-white'
                      }`}
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="px-6 py-4 border-t border-gray-100 bg-gray-50 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="px-4 py-2 text-xs font-semibold text-gray-600 hover:text-gray-800 rounded-xl hover:bg-gray-200/60"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleCreateExpense}
                disabled={!newDescription.trim()}
                className="px-5 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-md transition-all disabled:opacity-40"
              >
                Save Expense Card
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Global Confirmation Dialog for Outer Deletions */}
      {confirmDialog && (
        <ConfirmDialog
          title={confirmDialog.title}
          message={confirmDialog.message}
          confirmText="Delete"
          cancelText="Cancel"
          onConfirm={confirmDialog.onConfirm}
          onCancel={() => setConfirmDialog(null)}
        />
      )}
    </div>
  );
}

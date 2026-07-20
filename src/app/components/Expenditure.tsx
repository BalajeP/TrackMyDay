import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { Plus, Trash2, TrendingUp, TrendingDown, DollarSign, PieChart, Save } from 'lucide-react';
import ConfirmDialog from './ConfirmDialog';
import { useSupabasePersistedState } from '../hooks/useSupabasePersistedState';
import TripExpense from './TripExpense';

type Person = 'partner1' | 'partner2' | 'both';
type Category =
  | 'food'
  | 'transport'
  | 'entertainment'
  | 'utilities'
  | 'healthcare'
  | 'shopping'
  | 'other';
type TimeFrame = 'daily' | 'weekly' | 'monthly' | 'yearly';

interface Expense {
  id: string;
  description: string;
  amount: number;
  category: Category;
  person: Person;
  date: string;
}

interface Props {
  activePerson: Person;
  partner1Name: string;
  partner2Name: string;
  accessToken: string | null;
  onUnsavedChanges?: (hasChanges: boolean, save: () => void) => void;
}

export default function Expenditure({ activePerson, partner1Name, partner2Name, accessToken, onUnsavedChanges }: Props) {
  const [timeFrame, setTimeFrame] = useState<TimeFrame>('monthly');
  const [confirmDelete, setConfirmDelete] = useState<{ id: string; description: string } | null>(null);
  const [expenses, setExpenses, saveExpenses, hasUnsavedExpenses] = useSupabasePersistedState<Expense[]>('expenses', [], [], accessToken);

  const [newDescription, setNewDescription] = useState('');
  const [newAmount, setNewAmount] = useState('');
  const [newCategory, setNewCategory] = useState<Category>('food');
  const [newPerson, setNewPerson] = useState<Person>(activePerson);
  const [monthlyBudget, setMonthlyBudget, saveBudget, hasUnsavedBudget] = useSupabasePersistedState<number>('expenses_budget', 2000, 2000, accessToken);
  const [showSaved, setShowSaved] = useState(false);

  const [hasUnsavedTrip, setHasUnsavedTrip] = useState(false);
  const saveTripRef = useRef<() => void>(() => {});

  const handleTripStateChange = useCallback((hasUnsaved: boolean, saveFn: () => void) => {
    setHasUnsavedTrip(hasUnsaved);
    saveTripRef.current = saveFn;
  }, []);

  const hasUnsavedChanges = hasUnsavedExpenses || hasUnsavedBudget || hasUnsavedTrip;

  useEffect(() => {
    onUnsavedChanges?.(hasUnsavedChanges, () => {
      saveExpenses();
      saveBudget();
      saveTripRef.current();
    });
  }, [hasUnsavedChanges]);

  const handleSave = () => {
    saveExpenses();
    saveBudget();
    saveTripRef.current();
    setShowSaved(true);
    setTimeout(() => setShowSaved(false), 2000);
  };

  // Each partner sees only their own expenses
  const filteredExpenses = expenses.filter((expense) => expense.person === activePerson);

  const addExpense = () => {
    if (newDescription.trim() && newAmount) {
      setExpenses([
        ...expenses,
        {
          id: Date.now().toString(),
          description: newDescription,
          amount: parseFloat(newAmount),
          category: newCategory,
          person: newPerson,
          date: new Date().toISOString().split('T')[0],
        },
      ]);
      setNewDescription('');
      setNewAmount('');
    }
  };

  const deleteExpense = (id: string) => {
    if (confirmDelete && confirmDelete.id === id) {
      setExpenses(expenses.filter((expense) => expense.id !== id));
      setConfirmDelete(null);
    }
  };

  const getPersonName = (person: Person) => {
    if (person === 'partner1') return partner1Name;
    return partner2Name;
  };

  const calculations = useMemo(() => {
    const total = filteredExpenses.reduce((sum, e) => sum + e.amount, 0);
    const byCategory = filteredExpenses.reduce(
      (acc, expense) => {
        acc[expense.category] = (acc[expense.category] || 0) + expense.amount;
        return acc;
      },
      {} as Record<Category, number>
    );

    const remaining = monthlyBudget - total;
    const percentUsed = (total / monthlyBudget) * 100;

    return { total, byCategory, remaining, percentUsed };
  }, [filteredExpenses, monthlyBudget]);

  const categoryColors: Record<Category, string> = {
    food: 'bg-green-100 text-green-700',
    transport: 'bg-blue-100 text-blue-700',
    entertainment: 'bg-purple-100 text-purple-700',
    utilities: 'bg-yellow-100 text-yellow-700',
    healthcare: 'bg-red-100 text-red-700',
    shopping: 'bg-pink-100 text-pink-700',
    other: 'bg-gray-100 text-gray-700',
  };

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
          {showSaved ? 'Saved!' : hasUnsavedChanges ? 'Save Expenses' : 'All Saved'}
        </button>
      </div>

      {/* Time Frame Selector */}
      <div className="flex gap-2">
        <button
          onClick={() => setTimeFrame('daily')}
          className={`px-4 py-2 rounded-lg transition-colors ${
            timeFrame === 'daily'
              ? 'bg-indigo-600 text-white'
              : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-200'
          }`}
        >
          Daily
        </button>
        <button
          onClick={() => setTimeFrame('weekly')}
          className={`px-4 py-2 rounded-lg transition-colors ${
            timeFrame === 'weekly'
              ? 'bg-indigo-600 text-white'
              : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-200'
          }`}
        >
          Weekly
        </button>
        <button
          onClick={() => setTimeFrame('monthly')}
          className={`px-4 py-2 rounded-lg transition-colors ${
            timeFrame === 'monthly'
              ? 'bg-indigo-600 text-white'
              : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-200'
          }`}
        >
          Monthly
        </button>
        <button
          onClick={() => setTimeFrame('yearly')}
          className={`px-4 py-2 rounded-lg transition-colors ${
            timeFrame === 'yearly'
              ? 'bg-indigo-600 text-white'
              : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-200'
          }`}
        >
          Yearly
        </button>
      </div>

      {/* Budget Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg p-6 border border-gray-200">
          <div className="flex items-center gap-2 mb-2">
            <DollarSign className="w-5 h-5 text-indigo-600" />
            <p className="text-sm text-gray-600">Total Spent</p>
          </div>
          <p className="text-3xl font-bold text-indigo-600">${calculations.total.toFixed(2)}</p>
          <p className="text-xs text-gray-500 mt-1">this month</p>
        </div>
        <div className="bg-white rounded-lg p-6 border border-gray-200">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="w-5 h-5 text-green-600" />
            <p className="text-sm text-gray-600">Budget</p>
          </div>
          <p className="text-3xl font-bold text-green-600">${monthlyBudget.toFixed(2)}</p>
          <input
            type="number"
            value={monthlyBudget}
            onChange={(e) => setMonthlyBudget(parseFloat(e.target.value) || 0)}
            className="mt-2 w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
        <div className="bg-white rounded-lg p-6 border border-gray-200">
          <div className="flex items-center gap-2 mb-2">
            {calculations.remaining >= 0 ? (
              <TrendingUp className="w-5 h-5 text-green-600" />
            ) : (
              <TrendingDown className="w-5 h-5 text-red-600" />
            )}
            <p className="text-sm text-gray-600">Remaining</p>
          </div>
          <p
            className={`text-3xl font-bold ${
              calculations.remaining >= 0 ? 'text-green-600' : 'text-red-600'
            }`}
          >
            ${Math.abs(calculations.remaining).toFixed(2)}
          </p>
          <p className="text-xs text-gray-500 mt-1">
            {calculations.remaining >= 0 ? 'left' : 'over budget'}
          </p>
        </div>
        <div className="bg-white rounded-lg p-6 border border-gray-200">
          <div className="flex items-center gap-2 mb-2">
            <PieChart className="w-5 h-5 text-orange-600" />
            <p className="text-sm text-gray-600">Budget Used</p>
          </div>
          <p className="text-3xl font-bold text-orange-600">
            {calculations.percentUsed.toFixed(1)}%
          </p>
          <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
            <div
              className={`h-2 rounded-full transition-all ${
                calculations.percentUsed > 100
                  ? 'bg-red-500'
                  : calculations.percentUsed > 80
                    ? 'bg-yellow-500'
                    : 'bg-green-500'
              }`}
              style={{ width: `${Math.min(calculations.percentUsed, 100)}%` }}
            />
          </div>
        </div>
      </div>

      {/* Category Breakdown */}
      <div className="bg-white rounded-lg p-6 border border-gray-200">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Spending by Category</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {Object.entries(calculations.byCategory).map(([category, amount]) => (
            <div key={category} className="flex items-center justify-between p-3 border border-gray-200 rounded-lg">
              <div>
                <span className={`px-2 py-1 text-xs rounded ${categoryColors[category as Category]}`}>
                  {category}
                </span>
                <p className="mt-2 text-lg font-bold text-gray-900">${amount.toFixed(2)}</p>
              </div>
              <p className="text-sm text-gray-600">
                {((amount / calculations.total) * 100).toFixed(0)}%
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Add New Expense */}
      <div className="bg-white rounded-lg p-6 border border-gray-200">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Add New Expense</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <input
            type="text"
            placeholder="Description"
            value={newDescription}
            onChange={(e) => setNewDescription(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          <input
            type="number"
            placeholder="Amount"
            value={newAmount}
            onChange={(e) => setNewAmount(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          <select
            value={newCategory}
            onChange={(e) => setNewCategory(e.target.value as Category)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="food">Food</option>
            <option value="transport">Transport</option>
            <option value="entertainment">Entertainment</option>
            <option value="utilities">Utilities</option>
            <option value="healthcare">Healthcare</option>
            <option value="shopping">Shopping</option>
            <option value="other">Other</option>
          </select>
          <select
            value={newPerson}
            onChange={(e) => setNewPerson(e.target.value as Person)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="partner1">{partner1Name}</option>
            <option value="partner2">{partner2Name}</option>
          </select>
        </div>
        <button
          onClick={addExpense}
          className="mt-3 px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors flex items-center gap-2"
        >
          <Plus className="w-5 h-5" />
          Add Expense
        </button>
      </div>

      {/* Expenses List */}
      <div className="bg-white rounded-lg border border-gray-200">
        <div className="p-6 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">Recent Expenses</h3>
        </div>
        <div className="divide-y divide-gray-200">
          {filteredExpenses.length === 0 ? (
            <div className="p-8 text-center text-gray-500">No expenses recorded yet.</div>
          ) : (
            filteredExpenses
              .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
              .map((expense) => (
                <div key={expense.id} className="p-4 hover:bg-gray-50 transition-colors">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3">
                        <h4 className="font-medium text-gray-900">{expense.description}</h4>
                        <span className={`px-2 py-1 text-xs rounded ${categoryColors[expense.category]}`}>
                          {expense.category}
                        </span>
                      </div>
                      <div className="flex items-center gap-4 mt-1">
                        <span className="text-sm text-gray-500">{expense.date}</span>
                        <span className="text-sm text-gray-500">
                          {getPersonName(expense.person)}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="text-xl font-bold text-gray-900">
                        ${expense.amount.toFixed(2)}
                      </span>
                      <button
                        onClick={() => setConfirmDelete({ id: expense.id, description: expense.description })}
                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                </div>
              ))
          )}
        </div>
      </div>

      {/* Trip Expense */}
      <TripExpense
        activePerson={activePerson}
        partner1Name={partner1Name}
        partner2Name={partner2Name}
        accessToken={accessToken}
        onChangeState={handleTripStateChange}
      />

      {/* Confirm delete dialog */}
      {confirmDelete && (
        <ConfirmDialog
          title="Delete Expense"
          message={`Do you want to delete the "${confirmDelete.description}" expense?`}
          confirmText="Delete"
          cancelText="Cancel"
          onConfirm={() => deleteExpense(confirmDelete.id)}
          onCancel={() => setConfirmDelete(null)}
        />
      )}
    </div>
  );
}

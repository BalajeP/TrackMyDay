import { useState, useEffect } from 'react';
import { Plus, Trash2, Target, TrendingUp, Calendar, DollarSign, Edit2, Check, X, Save } from 'lucide-react';
import ConfirmDialog from './ConfirmDialog';
import { useSupabasePersistedState } from '../hooks/useSupabasePersistedState';

type Person = 'partner1' | 'partner2' | 'both';

interface Goal {
  id: string;
  title: string;
  targetAmount: number;
  currentAmount: number;
  deadline: string;
  person: Person;
  category: string;
}

interface Props {
  activePerson: Person;
  partner1Name: string;
  partner2Name: string;
  accessToken: string | null;
  onUnsavedChanges?: (hasChanges: boolean, save: () => void) => void;
}

export default function SavingsGoals({ activePerson, partner1Name, partner2Name, accessToken, onUnsavedChanges }: Props) {
  const [confirmDelete, setConfirmDelete] = useState<{ id: string; title: string } | null>(null);
  const [goals, setGoals, saveGoals, hasUnsavedChanges] = useSupabasePersistedState<Goal[]>('savings_goals', [], [], accessToken);
  const [showSaved, setShowSaved] = useState(false);

  useEffect(() => {
    onUnsavedChanges?.(hasUnsavedChanges, () => { saveGoals(); });
  }, [hasUnsavedChanges]);

  const handleSave = () => {
    saveGoals();
    setShowSaved(true);
    setTimeout(() => setShowSaved(false), 2000);
  };

  const [newGoal, setNewGoal] = useState('');
  const [newTarget, setNewTarget] = useState('');
  const [newDeadline, setNewDeadline] = useState('');
  const [newCategory, setNewCategory] = useState('');
  const [newPerson, setNewPerson] = useState<Person>(activePerson);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [addAmount, setAddAmount] = useState<{ [key: string]: string }>({});

  // Each partner sees only their own goals
  const filteredGoals = goals.filter((goal) => goal.person === activePerson);

  const addGoal = () => {
    if (newGoal.trim() && newTarget && newDeadline) {
      setGoals([
        ...goals,
        {
          id: Date.now().toString(),
          title: newGoal,
          targetAmount: parseFloat(newTarget),
          currentAmount: 0,
          deadline: newDeadline,
          person: newPerson,
          category: newCategory || 'other',
        },
      ]);
      setNewGoal('');
      setNewTarget('');
      setNewDeadline('');
      setNewCategory('');
    }
  };

  const deleteGoal = (id: string) => {
    if (confirmDelete && confirmDelete.id === id) {
      setGoals(goals.filter((goal) => goal.id !== id));
      setConfirmDelete(null);
    }
  };

  const addToGoal = (id: string) => {
    const amount = parseFloat(addAmount[id] || '0');
    if (amount > 0) {
      setGoals(
        goals.map((goal) =>
          goal.id === id
            ? {
                ...goal,
                currentAmount: Math.min(goal.currentAmount + amount, goal.targetAmount),
              }
            : goal
        )
      );
      setAddAmount({ ...addAmount, [id]: '' });
    }
  };

  const getPersonName = (person: Person) => {
    if (person === 'partner1') return partner1Name;
    return partner2Name;
  };

  const getProgressPercentage = (goal: Goal) => {
    return Math.min((goal.currentAmount / goal.targetAmount) * 100, 100);
  };

  const getDaysRemaining = (deadline: string) => {
    const today = new Date();
    const deadlineDate = new Date(deadline);
    const diff = deadlineDate.getTime() - today.getTime();
    const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
    return days;
  };

  const totalSavings = filteredGoals.reduce((sum, goal) => sum + goal.currentAmount, 0);
  const totalTarget = filteredGoals.reduce((sum, goal) => sum + goal.targetAmount, 0);
  const overallProgress = totalTarget > 0 ? (totalSavings / totalTarget) * 100 : 0;
  const completedGoals = filteredGoals.filter((g) => g.currentAmount >= g.targetAmount).length;

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
          {showSaved ? 'Saved!' : hasUnsavedChanges ? 'Save Goals' : 'All Saved'}
        </button>
      </div>

      {/* Overview Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg p-6 border border-gray-200">
          <div className="flex items-center gap-2 mb-2">
            <DollarSign className="w-5 h-5 text-indigo-600" />
            <p className="text-sm text-gray-600">Total Saved</p>
          </div>
          <p className="text-3xl font-bold text-indigo-600">${totalSavings.toFixed(2)}</p>
          <p className="text-xs text-gray-500 mt-1">across all goals</p>
        </div>
        <div className="bg-white rounded-lg p-6 border border-gray-200">
          <div className="flex items-center gap-2 mb-2">
            <Target className="w-5 h-5 text-green-600" />
            <p className="text-sm text-gray-600">Total Target</p>
          </div>
          <p className="text-3xl font-bold text-green-600">${totalTarget.toFixed(2)}</p>
          <p className="text-xs text-gray-500 mt-1">to reach</p>
        </div>
        <div className="bg-white rounded-lg p-6 border border-gray-200">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="w-5 h-5 text-orange-600" />
            <p className="text-sm text-gray-600">Overall Progress</p>
          </div>
          <p className="text-3xl font-bold text-orange-600">{overallProgress.toFixed(1)}%</p>
          <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
            <div
              className="bg-orange-500 h-2 rounded-full transition-all"
              style={{ width: `${overallProgress}%` }}
            />
          </div>
        </div>
        <div className="bg-white rounded-lg p-6 border border-gray-200">
          <div className="flex items-center gap-2 mb-2">
            <Check className="w-5 h-5 text-green-600" />
            <p className="text-sm text-gray-600">Completed</p>
          </div>
          <p className="text-3xl font-bold text-green-600">{completedGoals}</p>
          <p className="text-xs text-gray-500 mt-1">of {filteredGoals.length} goals</p>
        </div>
      </div>

      {/* Add New Goal */}
      <div className="bg-white rounded-lg p-6 border border-gray-200">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Add New Goal</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          <input
            type="text"
            placeholder="Goal title"
            value={newGoal}
            onChange={(e) => setNewGoal(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          <input
            type="number"
            placeholder="Target amount"
            value={newTarget}
            onChange={(e) => setNewTarget(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          <input
            type="date"
            value={newDeadline}
            onChange={(e) => setNewDeadline(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          <input
            type="text"
            placeholder="Category"
            value={newCategory}
            onChange={(e) => setNewCategory(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
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
          onClick={addGoal}
          className="mt-3 px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors flex items-center gap-2"
        >
          <Plus className="w-5 h-5" />
          Add Goal
        </button>
      </div>

      {/* Goals List */}
      <div className="space-y-4">
        {filteredGoals.length === 0 ? (
          <div className="bg-white rounded-lg p-8 border border-gray-200 text-center text-gray-500">
            No goals set yet. Add one to get started!
          </div>
        ) : (
          filteredGoals.map((goal) => {
            const progress = getProgressPercentage(goal);
            const daysRemaining = getDaysRemaining(goal.deadline);
            const isComplete = goal.currentAmount >= goal.targetAmount;

            return (
              <div
                key={goal.id}
                className={`bg-white rounded-lg p-6 border-2 transition-all ${
                  isComplete
                    ? 'border-green-500 bg-green-50'
                    : 'border-gray-200 hover:border-indigo-300'
                }`}
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3">
                      <h3 className="text-xl font-bold text-gray-900">{goal.title}</h3>
                      {isComplete && (
                        <span className="px-3 py-1 bg-green-500 text-white text-sm rounded-full">
                          Completed!
                        </span>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-4 mt-2">
                      <span className="flex items-center gap-1 text-sm text-gray-600">
                        <Calendar className="w-4 h-4" />
                        {goal.deadline} ({daysRemaining} days)
                      </span>
                      <span className="text-sm text-gray-600">{goal.category}</span>
                      <span className="text-sm text-gray-600">{getPersonName(goal.person)}</span>
                    </div>
                  </div>
                  <button
                    onClick={() => setConfirmDelete({ id: goal.id, title: goal.title })}
                    className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                </div>

                {/* Progress Bar */}
                <div className="mb-4">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-2xl font-bold text-gray-900">
                      ${goal.currentAmount.toFixed(2)}
                    </span>
                    <span className="text-lg text-gray-600">
                      / ${goal.targetAmount.toFixed(2)}
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-4">
                    <div
                      className={`h-4 rounded-full transition-all ${
                        isComplete ? 'bg-green-500' : 'bg-indigo-600'
                      }`}
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                  <div className="flex justify-between items-center mt-1">
                    <span className="text-sm text-gray-600">{progress.toFixed(1)}% complete</span>
                    <span className="text-sm text-gray-600">
                      ${(goal.targetAmount - goal.currentAmount).toFixed(2)} remaining
                    </span>
                  </div>
                </div>

                {/* Add Money */}
                {!isComplete && (
                  <div className="flex gap-2">
                    <input
                      type="number"
                      placeholder="Add amount"
                      value={addAmount[goal.id] || ''}
                      onChange={(e) =>
                        setAddAmount({ ...addAmount, [goal.id]: e.target.value })
                      }
                      className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                    <button
                      onClick={() => addToGoal(goal.id)}
                      className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
                    >
                      Add Savings
                    </button>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Confirm delete dialog */}
      {confirmDelete && (
        <ConfirmDialog
          title="Delete Goal"
          message={`Do you want to delete the "${confirmDelete.title}" savings goal?`}
          confirmText="Delete"
          cancelText="Cancel"
          onConfirm={() => deleteGoal(confirmDelete.id)}
          onCancel={() => setConfirmDelete(null)}
        />
      )}
    </div>
  );
}

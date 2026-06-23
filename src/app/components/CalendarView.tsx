import { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, Plus, Save } from 'lucide-react';
import { useSupabasePersistedState } from '../hooks/useSupabasePersistedState';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths } from 'date-fns';

type Person = 'partner1' | 'partner2' | 'both';

interface Event {
  id: string;
  title: string;
  date: string;
  type: 'activity' | 'meal' | 'workout' | 'expense' | 'goal';
  person: Person;
  description?: string;
}

interface Props {
  activePerson: Person;
  partner1Name: string;
  partner2Name: string;
  accessToken: string | null;
  onUnsavedChanges?: (hasChanges: boolean, save: () => void) => void;
}

export default function CalendarView({ activePerson, partner1Name, partner2Name, accessToken, onUnsavedChanges }: Props) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [events, setEvents, saveEvents, hasUnsavedChanges] = useSupabasePersistedState<Event[]>('calendar_events', [], [], accessToken);
  const [showSaved, setShowSaved] = useState(false);

  useEffect(() => {
    onUnsavedChanges?.(hasUnsavedChanges, () => { saveEvents(); });
  }, [hasUnsavedChanges]);

  const handleSave = () => {
    saveEvents();
    setShowSaved(true);
    setTimeout(() => setShowSaved(false), 2000);
  };

  const [newEventTitle, setNewEventTitle] = useState('');
  const [newEventType, setNewEventType] = useState<Event['type']>('activity');
  const [newEventPerson, setNewEventPerson] = useState<Person>(activePerson);

  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });

  const firstDayOfMonth = monthStart.getDay();
  const emptyDays = Array(firstDayOfMonth).fill(null);

  // Each partner sees only their own events
  const filteredEvents = events.filter((event) => event.person === activePerson);

  const getEventsForDate = (date: Date) => {
    const dateStr = format(date, 'yyyy-MM-dd');
    return filteredEvents.filter((event) => event.date === dateStr);
  };

  const addEvent = () => {
    if (newEventTitle.trim() && selectedDate) {
      setEvents([
        ...events,
        {
          id: Date.now().toString(),
          title: newEventTitle,
          date: format(selectedDate, 'yyyy-MM-dd'),
          type: newEventType,
          person: newEventPerson,
        },
      ]);
      setNewEventTitle('');
    }
  };

  const getTypeColor = (type: Event['type']) => {
    switch (type) {
      case 'activity':
        return 'bg-blue-100 text-blue-700 border-blue-200';
      case 'meal':
        return 'bg-green-100 text-green-700 border-green-200';
      case 'workout':
        return 'bg-purple-100 text-purple-700 border-purple-200';
      case 'expense':
        return 'bg-red-100 text-red-700 border-red-200';
      case 'goal':
        return 'bg-yellow-100 text-yellow-700 border-yellow-200';
    }
  };

  const getPersonName = (person: Person) => {
    if (person === 'partner1') return partner1Name;
    return partner2Name;
  };

  const goToPreviousMonth = () => {
    setCurrentDate(subMonths(currentDate, 1));
  };

  const goToNextMonth = () => {
    setCurrentDate(addMonths(currentDate, 1));
  };

  const goToToday = () => {
    setCurrentDate(new Date());
    setSelectedDate(new Date());
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
          {showSaved ? 'Saved!' : hasUnsavedChanges ? 'Save Calendar' : 'All Saved'}
        </button>
      </div>

      {/* Calendar Header */}
      <div className="bg-white rounded-lg p-6 border border-gray-200">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-gray-900">
            {format(currentDate, 'MMMM yyyy')}
          </h2>
          <div className="flex gap-2">
            <button
              onClick={goToToday}
              className="px-4 py-2 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
            >
              Today
            </button>
            <button
              onClick={goToPreviousMonth}
              className="p-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <button
              onClick={goToNextMonth}
              className="p-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Calendar Grid */}
        <div className="grid grid-cols-7 gap-2">
          {/* Day Headers */}
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
            <div key={day} className="text-center font-semibold text-gray-700 py-2">
              {day}
            </div>
          ))}

          {/* Empty Days */}
          {emptyDays.map((_, index) => (
            <div key={`empty-${index}`} className="aspect-square" />
          ))}

          {/* Calendar Days */}
          {daysInMonth.map((day) => {
            const dayEvents = getEventsForDate(day);
            const isToday = isSameDay(day, new Date());
            const isSelected = selectedDate && isSameDay(day, selectedDate);

            return (
              <button
                key={day.toString()}
                onClick={() => setSelectedDate(day)}
                className={`aspect-square p-2 border rounded-lg transition-all ${
                  isSelected
                    ? 'border-indigo-500 bg-indigo-50'
                    : isToday
                      ? 'border-indigo-300 bg-indigo-50'
                      : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                }`}
              >
                <div className="flex flex-col h-full">
                  <span
                    className={`text-sm font-medium ${
                      isToday ? 'text-indigo-600' : 'text-gray-900'
                    }`}
                  >
                    {format(day, 'd')}
                  </span>
                  <div className="flex-1 mt-1 space-y-1 overflow-hidden">
                    {dayEvents.slice(0, 2).map((event) => (
                      <div
                        key={event.id}
                        className="w-2 h-2 rounded-full bg-indigo-500 mx-auto"
                        title={event.title}
                      />
                    ))}
                    {dayEvents.length > 2 && (
                      <div className="text-xs text-gray-500">+{dayEvents.length - 2}</div>
                    )}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Selected Date Details */}
      {selectedDate && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Events for Selected Date */}
          <div className="bg-white rounded-lg border border-gray-200">
            <div className="p-6 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">
                Events on {format(selectedDate, 'MMMM d, yyyy')}
              </h3>
            </div>
            <div className="p-6 space-y-3 max-h-96 overflow-y-auto">
              {getEventsForDate(selectedDate).length === 0 ? (
                <p className="text-center text-gray-500">No events scheduled for this day.</p>
              ) : (
                getEventsForDate(selectedDate).map((event) => (
                  <div
                    key={event.id}
                    className="p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h4 className="font-medium text-gray-900">{event.title}</h4>
                        <div className="flex items-center gap-2 mt-2">
                          <span className={`px-2 py-1 text-xs rounded border ${getTypeColor(event.type)}`}>
                            {event.type}
                          </span>
                          <span className="text-sm text-gray-500">
                            {getPersonName(event.person)}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Add New Event */}
          <div className="bg-white rounded-lg border border-gray-200">
            <div className="p-6 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">
                Add Event for {format(selectedDate, 'MMM d')}
              </h3>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Event Title
                </label>
                <input
                  type="text"
                  placeholder="Enter event title"
                  value={newEventTitle}
                  onChange={(e) => setNewEventTitle(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Type</label>
                <select
                  value={newEventType}
                  onChange={(e) => setNewEventType(e.target.value as Event['type'])}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="activity">Activity</option>
                  <option value="meal">Meal</option>
                  <option value="workout">Workout</option>
                  <option value="expense">Expense</option>
                  <option value="goal">Goal</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Person</label>
                <select
                  value={newEventPerson}
                  onChange={(e) => setNewEventPerson(e.target.value as Person)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="partner1">{partner1Name}</option>
                  <option value="partner2">{partner2Name}</option>
                </select>
              </div>
              <button
                onClick={addEvent}
                className="w-full px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors flex items-center justify-center gap-2"
              >
                <Plus className="w-5 h-5" />
                Add Event
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Upcoming Events */}
      <div className="bg-white rounded-lg border border-gray-200">
        <div className="p-6 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">Upcoming Events</h3>
        </div>
        <div className="divide-y divide-gray-200 max-h-96 overflow-y-auto">
          {filteredEvents
            .filter((event) => new Date(event.date) >= new Date())
            .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
            .slice(0, 10)
            .map((event) => (
              <div key={event.id} className="p-4 hover:bg-gray-50 transition-colors">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <h4 className="font-medium text-gray-900">{event.title}</h4>
                    <div className="flex items-center gap-3 mt-1">
                      <span className="flex items-center gap-1 text-sm text-gray-500">
                        <CalendarIcon className="w-4 h-4" />
                        {format(new Date(event.date), 'MMM d, yyyy')}
                      </span>
                      <span className={`px-2 py-1 text-xs rounded border ${getTypeColor(event.type)}`}>
                        {event.type}
                      </span>
                      <span className="text-sm text-gray-500">
                        {getPersonName(event.person)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
        </div>
      </div>
    </div>
  );
}

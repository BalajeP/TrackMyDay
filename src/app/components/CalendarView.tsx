import { useState, useEffect, useMemo } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Calendar as CalendarIcon,
  Plus,
  Save,
  Bell,
  BellOff,
  Edit2,
  Trash2,
  Check,
  X,
  ListFilter,
  CheckSquare,
  Clock,
  Repeat,
  Search,
  Sparkles,
  Tag,
} from 'lucide-react';
import { useSupabasePersistedState } from '../hooks/useSupabasePersistedState';
import {
  format,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  isSameDay,
  addMonths,
  subMonths,
  parseISO,
  isWithinInterval,
  startOfWeek,
  endOfWeek,
  subDays,
} from 'date-fns';
import {
  requestNotificationPermission,
  getNotificationPermissionStatus,
  sendPwaNotification,
} from '../utils/notifications';
import ConfirmDialog from './ConfirmDialog';

export type SnoozeOption = 'none' | '10min' | '1hr' | 'daily';

export interface CalendarEvent {
  id: string;
  title: string;
  date: string; // yyyy-MM-dd
  notificationDates?: string[]; // Multiple notification / reminder dates
  icon?: string;
  notificationTime?: string; // e.g. "09:30"
  snoozeOption?: SnoozeOption;
  todoText?: string;
  completed?: boolean;
}

interface Props {
  activePerson?: string;
  partner1Name?: string;
  partner2Name?: string;
  accessToken: string | null;
  onUnsavedChanges?: (hasChanges: boolean, save: () => void) => void;
}

const EVENT_ICONS = [
  // God & Temple & Spiritual
  '🕉️', '🔱', '🛕', '🪔', '🙏', '📿', '⛩️', '🕌', '⛪', '🕍', '✝️', '☪️', '☸️', '☯️', '🛐', '🕊️',
  // Money & Finance & Savings
  '💵', '💰', '🪙', '💳', '💸', '🏦', '📈', '💹', '💎', '🧾', '🤑',
  // General & Reminders
  '📌', '🔔', '📅', '📝', '💡', '⏰', '⭐', '❤️', '💼', '🎯',
  // Movie & Entertainment
  '🎬', '🍿', '🎥', '🎟️', '🎭', '📺',
  // Music & Songs & Microphone
  '🎵', '🎶', '🎧', '🎤', '🎙️', '🎸', '🎹',
  // Hospital & Medical
  '🏥', '🩺', '💊', '🚑', '💉',
  // Cake & Birthday & Celebrations
  '🎂', '🍰', '🧁', '🎁', '🎉', '🎈', '🥂',
  // Baby & Family
  '👶', '🍼', '🧸', '🚼', '👪',
  // Travel & Outings
  '✈️', '🧳', '🏨', '🌴', '🚗', '🚆', '🚕', '🚲', '🚢', '⛽', '🏖️',
  // Food & Shopping & Workout
  '🍔', '☕', '🛒', '🏋️'
];

const SNOOZE_LABELS: Record<SnoozeOption, string> = {
  none: 'None',
  '10min': 'Every 10 min',
  '1hr': 'Every 1 hour',
  daily: 'Daily for today',
};

export default function CalendarView({
  accessToken,
  onUnsavedChanges,
}: Props) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(new Date());
  const [events, setEvents, saveEvents, hasUnsavedChanges] = useSupabasePersistedState<CalendarEvent[]>(
    'calendar_events',
    [],
    [],
    accessToken
  );

  const [showSaved, setShowSaved] = useState(false);
  const [viewMode, setViewMode] = useState<'calendar' | 'events'>('calendar');

  // PWA Notification Permission state
  const [notifPermission, setNotifPermission] = useState<NotificationPermission>(getNotificationPermissionStatus());
  const [notifStatusMessage, setNotifStatusMessage] = useState<string>('');

  // New & Editing Event Form State
  const [editingEventId, setEditingEventId] = useState<string | null>(null);
  const [eventTitle, setEventTitle] = useState('');
  const [eventIcon, setEventIcon] = useState('📌');
  const [notificationTime, setNotificationTime] = useState('');
  const [snoozeOption, setSnoozeOption] = useState<SnoozeOption>('none');
  const [todoText, setTodoText] = useState('');
  const [showFormIconPicker, setShowFormIconPicker] = useState(false);

  // Multiple Notification Dates State
  const [notificationDates, setNotificationDates] = useState<string[]>([]);
  const [addDateInput, setAddDateInput] = useState<string>('');

  // Search & Filter state for Events View
  const [eventSearchQuery, setEventSearchQuery] = useState('');
  const [filterPeriod, setFilterPeriod] = useState<'all' | 'today' | 'week' | 'month'>('month');

  // Confirmation dialog for deletion
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  useEffect(() => {
    onUnsavedChanges?.(hasUnsavedChanges, () => {
      saveEvents();
    });
  }, [hasUnsavedChanges]);

  const handleSave = () => {
    saveEvents();
    setShowSaved(true);
    setTimeout(() => setShowSaved(false), 2000);
  };

  // Handle Notification Permission Toggle
  const handleEnableNotifications = async () => {
    const perm = await requestNotificationPermission();
    setNotifPermission(perm);
    if (perm === 'granted') {
      setNotifStatusMessage('Mobile Lock-Screen Notifications Enabled! 🎉');
      sendPwaNotification('TrackMyDay Notifications Enabled', {
        body: 'You will now receive lock-screen push reminders for your saved calendar events.',
      });
    } else {
      setNotifStatusMessage('Notification permission was denied in your browser settings.');
    }
    setTimeout(() => setNotifStatusMessage(''), 4000);
  };

  const handleSendTestNotification = () => {
    sendPwaNotification('🔔 TrackMyDay Calendar Reminder', {
      body: 'Test Lock-Screen Notification: Your calendar reminders are active!',
    });
  };

  // Calendar Math
  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });
  const firstDayOfMonth = monthStart.getDay();
  const emptyDays = Array(firstDayOfMonth).fill(null);

  const getEventsForDate = (date: Date) => {
    const dateStr = format(date, 'yyyy-MM-dd');
    return events.filter(
      (event) =>
        event.date === dateStr ||
        (event.notificationDates && event.notificationDates.includes(dateStr))
    );
  };

  const handleAddNotificationDate = (dateStr: string) => {
    if (!dateStr) return;
    if (!notificationDates.includes(dateStr)) {
      setNotificationDates([...notificationDates, dateStr].sort());
    }
    setAddDateInput('');
  };

  const handleRemoveNotificationDate = (dateStr: string) => {
    setNotificationDates(notificationDates.filter((d) => d !== dateStr));
  };

  const handleAddRelativePresetDate = (daysBefore: number) => {
    if (!selectedDate) return;
    const targetDate = subDays(selectedDate, daysBefore);
    const dateStr = format(targetDate, 'yyyy-MM-dd');
    handleAddNotificationDate(dateStr);
  };

  const handleStartEdit = (event: CalendarEvent) => {
    setEditingEventId(event.id);
    setEventTitle(event.title);
    setEventIcon(event.icon || '📌');
    setNotificationTime(event.notificationTime || '');
    setSnoozeOption(event.snoozeOption || 'none');
    setTodoText(event.todoText || '');
    setNotificationDates(event.notificationDates || [event.date]);
    setSelectedDate(parseISO(event.date));
  };

  const handleCancelEdit = () => {
    setEditingEventId(null);
    setEventTitle('');
    setEventIcon('📌');
    setNotificationTime('');
    setSnoozeOption('none');
    setTodoText('');
    setNotificationDates([]);
    setAddDateInput('');
  };

  const handleSaveEvent = () => {
    if (!eventTitle.trim() || !selectedDate) return;
    const targetDateStr = format(selectedDate, 'yyyy-MM-dd');

    // Combine primary selected date with all notification dates
    const finalDatesSet = new Set<string>([targetDateStr, ...notificationDates]);
    const finalDatesArray = Array.from(finalDatesSet).sort();

    if (editingEventId) {
      // Update existing event
      setEvents(
        events.map((e) =>
          e.id === editingEventId
            ? {
                ...e,
                title: eventTitle.trim(),
                date: targetDateStr,
                notificationDates: finalDatesArray,
                icon: eventIcon,
                notificationTime: notificationTime || undefined,
                snoozeOption,
                todoText: todoText.trim() || undefined,
              }
            : e
        )
      );
      setEditingEventId(null);
    } else {
      // Create new event
      const newEv: CalendarEvent = {
        id: Date.now().toString(),
        title: eventTitle.trim(),
        date: targetDateStr,
        notificationDates: finalDatesArray,
        icon: eventIcon,
        notificationTime: notificationTime || undefined,
        snoozeOption,
        todoText: todoText.trim() || undefined,
        completed: false,
      };
      setEvents([...events, newEv]);

      // If scheduled with notification, fire a push confirmation if permission granted
      if (notificationTime && notifPermission === 'granted') {
        sendPwaNotification(`Calendar Event Scheduled: ${newEv.title}`, {
          body: `Reminders set for ${finalDatesArray.length} date(s) at ${newEv.notificationTime} (${SNOOZE_LABELS[snoozeOption]})`,
        });
      }
    }

    setEventTitle('');
    setEventIcon('📌');
    setNotificationTime('');
    setSnoozeOption('none');
    setTodoText('');
    setNotificationDates([]);
    setAddDateInput('');
  };

  const handleDeleteEvent = (id: string) => {
    setEvents(events.filter((e) => e.id !== id));
    if (editingEventId === id) handleCancelEdit();
    setConfirmDeleteId(null);
  };

  const handleToggleCompleted = (id: string) => {
    setEvents(
      events.map((e) => (e.id === id ? { ...e, completed: !e.completed } : e))
    );
  };

  // Filtered Events for Events View
  const filteredEventsList = useMemo(() => {
    const now = new Date();
    const todayStr = format(now, 'yyyy-MM-dd');
    const weekStart = startOfWeek(now, { weekStartsOn: 1 });
    const weekEnd = endOfWeek(now, { weekStartsOn: 1 });

    return events
      .filter((ev) => {
        const allEventDates = Array.from(new Set([ev.date, ...(ev.notificationDates || [])]));

        // Search query filter
        if (eventSearchQuery.trim()) {
          const q = eventSearchQuery.toLowerCase();
          const matchTitle = ev.title.toLowerCase().includes(q);
          const matchTodo = ev.todoText?.toLowerCase().includes(q);
          if (!matchTitle && !matchTodo) return false;
        }

        // Time period filter
        if (filterPeriod === 'today') {
          return allEventDates.includes(todayStr);
        }
        if (filterPeriod === 'week') {
          return allEventDates.some((dStr) => {
            const d = parseISO(dStr);
            return isWithinInterval(d, { start: weekStart, end: weekEnd });
          });
        }
        if (filterPeriod === 'month') {
          return allEventDates.some(
            (dStr) => format(parseISO(dStr), 'yyyy-MM') === format(now, 'yyyy-MM')
          );
        }
        return true;
      })
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [events, eventSearchQuery, filterPeriod]);

  const goToPreviousMonth = () => setCurrentDate(subMonths(currentDate, 1));
  const goToNextMonth = () => setCurrentDate(addMonths(currentDate, 1));
  const goToToday = () => {
    setCurrentDate(new Date());
    setSelectedDate(new Date());
  };

  return (
    <div className="space-y-6">
      {/* Top Header Bar: View Toggle & Save Button */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-gray-200 pb-4">
        {/* Toggle Switcher: Calendar View vs Events View */}
        <div className="flex items-center p-1 bg-gray-100/90 rounded-xl border border-gray-200/80">
          <button
            onClick={() => setViewMode('calendar')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs sm:text-sm font-bold transition-all ${
              viewMode === 'calendar'
                ? 'bg-white text-indigo-600 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <CalendarIcon className="w-4 h-4 text-indigo-600" />
            <span>Calendar View</span>
          </button>
          <button
            onClick={() => setViewMode('events')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs sm:text-sm font-bold transition-all ${
              viewMode === 'events'
                ? 'bg-white text-indigo-600 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <ListFilter className="w-4 h-4 text-indigo-600" />
            <span>Events List View</span>
            <span className="bg-indigo-100 text-indigo-700 text-[10px] font-extrabold px-1.5 py-0.2 rounded-full">
              {events.length}
            </span>
          </button>
        </div>

        {/* Save & Notification Status */}
        <div className="flex items-center gap-3">
          <button
            onClick={handleSave}
            disabled={!hasUnsavedChanges}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all ${
              showSaved
                ? 'bg-green-100 text-green-700 border border-green-300'
                : hasUnsavedChanges
                  ? 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-sm'
                  : 'bg-gray-100 text-gray-400 cursor-not-allowed'
            }`}
          >
            <Save className="w-4 h-4" />
            {showSaved ? 'Saved!' : hasUnsavedChanges ? 'Save Calendar' : 'All Saved'}
          </button>
        </div>
      </div>

      {/* PWA Mobile Lock-Screen Notification Control Bar */}
      <div className="bg-gradient-to-r from-indigo-500/10 via-purple-500/10 to-pink-500/10 border border-indigo-200/80 rounded-2xl p-4 shadow-sm flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-md flex-shrink-0">
            {notifPermission === 'granted' ? <Bell className="w-5 h-5" /> : <BellOff className="w-5 h-5" />}
          </div>
          <div>
            <h4 className="text-xs sm:text-sm font-bold text-gray-900 flex items-center gap-2">
              <span>Mobile Lock-Screen Notifications</span>
              <span
                className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${
                  notifPermission === 'granted'
                    ? 'bg-green-100 text-green-700 border border-green-300'
                    : 'bg-amber-100 text-amber-700 border border-amber-300'
                }`}
              >
                {notifPermission === 'granted' ? 'Enabled' : 'Disabled'}
              </span>
            </h4>
            <p className="text-xs text-gray-500 mt-0.5">
              Receive native lock-screen push notifications & snooze alerts for saved calendar events.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          {notifPermission !== 'granted' ? (
            <button
              onClick={handleEnableNotifications}
              className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-xs transition-colors flex items-center gap-1.5"
            >
              <Bell className="w-3.5 h-3.5" />
              <span>Enable Notifications</span>
            </button>
          ) : (
            <button
              onClick={handleSendTestNotification}
              className="px-3 py-1.5 bg-white border border-indigo-200 text-indigo-700 hover:bg-indigo-50 text-xs font-bold rounded-xl transition-colors flex items-center gap-1.5 shadow-2xs"
            >
              <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
              <span>Send Test Notification</span>
            </button>
          )}
        </div>

        {notifStatusMessage && (
          <div className="w-full text-xs text-indigo-700 font-semibold bg-white/80 p-2 rounded-lg border border-indigo-200">
            {notifStatusMessage}
          </div>
        )}
      </div>

      {/* VIEW MODE 1: CALENDAR VIEW */}
      {viewMode === 'calendar' && (
        <div className="space-y-6">
          {/* Full-width Top Row: Events on [Selected Date] (ONLY shown if events exist for the selected date) */}
          {selectedDate && getEventsForDate(selectedDate).length > 0 && (
            <div className="w-full bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden animate-in fade-in duration-150">
              <div className="p-4 bg-gray-50 border-b border-gray-100 flex items-center justify-between">
                <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                  <CalendarIcon className="w-4.5 h-4.5 text-indigo-600" />
                  <span>Events on {format(selectedDate, 'MMMM d, yyyy')}</span>
                </h3>
                <span className="text-xs bg-indigo-100 text-indigo-700 px-2.5 py-0.5 rounded-full font-bold">
                  {getEventsForDate(selectedDate).length} events
                </span>
              </div>

              <div className="p-4 space-y-3 max-h-96 overflow-y-auto divide-y divide-gray-100">
                {getEventsForDate(selectedDate).map((ev) => (
                  <div
                    key={ev.id}
                    className={`pt-3 first:pt-0 flex items-start justify-between gap-3 group ${
                      ev.completed ? 'opacity-60' : ''
                    }`}
                  >
                    <div className="flex items-start gap-3 flex-1 min-w-0">
                      <button
                        onClick={() => handleToggleCompleted(ev.id)}
                        className={`w-6 h-6 rounded-full border-2 transition-colors mt-0.5 flex items-center justify-center flex-shrink-0 ${
                          ev.completed
                            ? 'bg-green-600 border-green-600 text-white'
                            : 'border-gray-300 hover:border-indigo-400'
                        }`}
                        title={ev.completed ? 'Mark incomplete' : 'Mark complete'}
                      >
                        {ev.completed && <Check className="w-3.5 h-3.5" />}
                      </button>

                      <div className="flex-1 min-w-0 space-y-1.5">
                        <div className="flex items-center gap-2">
                          <span className="text-lg flex-shrink-0">{ev.icon || '📌'}</span>
                          <h4
                            className={`text-sm font-bold text-gray-900 truncate ${
                              ev.completed ? 'line-through text-gray-400' : ''
                            }`}
                          >
                            {ev.title}
                          </h4>
                        </div>

                        {/* Event details badges */}
                        <div className="flex flex-wrap items-center gap-2 text-xs">
                          {ev.notificationTime && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md bg-indigo-50 text-indigo-700 font-bold border border-indigo-100">
                              <Clock className="w-3 h-3 text-indigo-600" />
                              <span>{ev.notificationTime}</span>
                            </span>
                          )}

                          {ev.snoozeOption && ev.snoozeOption !== 'none' && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md bg-purple-50 text-purple-700 font-bold border border-purple-100">
                              <Repeat className="w-3 h-3 text-purple-600" />
                              <span>{SNOOZE_LABELS[ev.snoozeOption]}</span>
                            </span>
                          )}
                        </div>

                        {/* Remind Dates Badges */}
                        {ev.notificationDates && ev.notificationDates.length > 0 && (
                          <div className="flex items-center gap-1.5 flex-wrap text-xs pt-0.5">
                            <span className="font-medium text-gray-500">Remind Dates:</span>
                            {ev.notificationDates.map((dStr) => (
                              <span
                                key={dStr}
                                className="px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 font-bold border border-indigo-100 text-[11px]"
                              >
                                {format(parseISO(dStr), 'MMM d')}
                              </span>
                            ))}
                          </div>
                        )}

                        {/* To-Do / Notes */}
                        {ev.todoText && (
                          <p className="text-xs text-gray-600 mt-1.5 bg-gray-50 p-2.5 rounded-xl border border-gray-100 font-medium whitespace-pre-wrap">
                            {ev.todoText}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Action buttons */}
                    <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100 transition-opacity flex-shrink-0">
                      <button
                        onClick={() => handleStartEdit(ev)}
                        className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                        title="Edit event"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => setConfirmDeleteId(ev.id)}
                        className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        title="Delete event"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Compact Grid & Add Event Form in SAME ROW */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Left Column (6 cols): Compact Month Calendar Grid */}
            <div className="lg:col-span-6 bg-white rounded-2xl p-4 sm:p-5 border border-gray-200 shadow-sm space-y-4">
              {/* Month Header Navigation */}
              <div className="flex items-center justify-between border-b border-gray-100 pb-3">
                <h2 className="text-base sm:text-lg font-black text-gray-900 flex items-center gap-2">
                  <CalendarIcon className="w-5 h-5 text-indigo-600" />
                  <span>{format(currentDate, 'MMMM yyyy')}</span>
                </h2>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={goToToday}
                    className="px-2.5 py-1 text-xs font-bold bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors shadow-2xs"
                  >
                    Today
                  </button>
                  <button
                    onClick={goToPreviousMonth}
                    className="p-1.5 border border-gray-200 rounded-lg hover:bg-gray-100 transition-colors"
                    title="Previous month"
                  >
                    <ChevronLeft className="w-4 h-4 text-gray-600" />
                  </button>
                  <button
                    onClick={goToNextMonth}
                    className="p-1.5 border border-gray-200 rounded-lg hover:bg-gray-100 transition-colors"
                    title="Next month"
                  >
                    <ChevronRight className="w-4 h-4 text-gray-600" />
                  </button>
                </div>
              </div>

              {/* Compact Calendar Month Grid */}
              <div className="grid grid-cols-7 gap-1.5">
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
                  <div key={day} className="text-center font-bold text-[11px] uppercase text-gray-400 py-0.5">
                    {day}
                  </div>
                ))}

                {emptyDays.map((_, idx) => (
                  <div key={`empty-${idx}`} className="aspect-square opacity-20 bg-gray-50/50 rounded-xl" />
                ))}

                {daysInMonth.map((day) => {
                  const dayEvents = getEventsForDate(day);
                  const isToday = isSameDay(day, new Date());
                  const isSelected = selectedDate && isSameDay(day, selectedDate);

                  return (
                    <button
                      key={day.toString()}
                      onClick={() => {
                        setSelectedDate(day);
                        // Pre-fill selected date in notification dates list if empty
                        const dateStr = format(day, 'yyyy-MM-dd');
                        if (!notificationDates.includes(dateStr)) {
                          setNotificationDates([dateStr]);
                        }
                      }}
                      className={`aspect-square p-1.5 border rounded-xl transition-all flex flex-col justify-between text-left relative group ${
                        isSelected
                          ? 'border-indigo-600 bg-indigo-50/90 ring-2 ring-indigo-400 shadow-xs'
                          : isToday
                            ? 'border-indigo-300 bg-indigo-50/40'
                            : 'border-gray-200 hover:border-indigo-300 hover:bg-gray-50'
                      }`}
                    >
                      <span
                        className={`text-xs font-extrabold leading-none ${
                          isToday ? 'text-indigo-600' : 'text-gray-800'
                        }`}
                      >
                        {format(day, 'd')}
                      </span>

                      {/* Event Icons indicator list on date cell */}
                      <div className="flex flex-wrap gap-0.5 mt-0.5 max-h-6 overflow-hidden">
                        {dayEvents.slice(0, 3).map((ev) => (
                          <span
                            key={ev.id}
                            className="text-[11px] leading-none inline-block transform hover:scale-125 transition-transform"
                            title={`${ev.icon || '📌'} ${ev.title}`}
                          >
                            {ev.icon || '📌'}
                          </span>
                        ))}
                        {dayEvents.length > 3 && (
                          <span className="text-[9px] font-bold bg-indigo-100 text-indigo-700 px-1 rounded-full leading-none">
                            +{dayEvents.length - 3}
                          </span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Right Column (6 cols): Add/Edit Event Form */}
            {selectedDate && (
              <div className="lg:col-span-6">
                <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4 sm:p-5 space-y-4">
                  <div className="flex items-center justify-between border-b border-gray-100 pb-3">
                    <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-indigo-600" />
                      <span>
                        {editingEventId ? 'Edit Event' : `Add Event for ${format(selectedDate, 'MMM d')}`}
                      </span>
                    </h3>
                    {editingEventId && (
                      <button
                        onClick={handleCancelEdit}
                        className="text-xs text-gray-400 hover:text-gray-600 font-semibold"
                      >
                        Cancel Edit
                      </button>
                    )}
                  </div>

                  <div className="space-y-3.5">
                    {/* Event Title & Icon (In Same Row with Expandable Popover) */}
                    <div>
                      <label className="block text-xs font-bold text-gray-700 mb-1 flex items-center justify-between">
                        <span>Event Title & Icon <span className="text-red-500">*</span></span>
                        <span className="text-[10px] text-gray-400 font-medium">Click icon to change</span>
                      </label>
                      <div className="flex items-center gap-2 relative">
                        {/* Icon Selector Button with Popover */}
                        <div className="relative flex-shrink-0">
                          <button
                            type="button"
                            onClick={() => setShowFormIconPicker((v) => !v)}
                            className="w-10 h-10 rounded-xl bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 flex items-center justify-center text-xl shadow-2xs transition-colors cursor-pointer"
                            title="Click to select icon menu"
                          >
                            {eventIcon || '📌'}
                          </button>

                          {/* Expandable Icon List Popover */}
                          {showFormIconPicker && (
                            <div className="absolute top-12 left-0 z-50 w-64 bg-white border border-gray-200 rounded-xl shadow-2xl p-3 space-y-2 text-left animate-in fade-in zoom-in-95 duration-150">
                              <div className="flex items-center justify-between text-xs font-bold text-gray-700 border-b border-gray-100 pb-1.5">
                                <span>Select Icon</span>
                                <button
                                  type="button"
                                  onClick={() => setShowFormIconPicker(false)}
                                  className="text-gray-400 hover:text-gray-600 p-0.5"
                                >
                                  <X className="w-3.5 h-3.5" />
                                </button>
                              </div>

                              <div className="grid grid-cols-6 gap-1 max-h-48 overflow-y-auto p-1">
                                {EVENT_ICONS.map((ic) => (
                                  <button
                                    key={ic}
                                    type="button"
                                    onClick={() => {
                                      setEventIcon(ic);
                                      setShowFormIconPicker(false);
                                    }}
                                    className={`h-8 text-base rounded-lg flex items-center justify-center transition-transform hover:scale-110 ${
                                      eventIcon === ic
                                        ? 'bg-indigo-600 text-white shadow-2xs ring-2 ring-indigo-400'
                                        : 'hover:bg-indigo-50'
                                    }`}
                                  >
                                    {ic}
                                  </button>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Title Input */}
                        <input
                          type="text"
                          placeholder="Enter event title (e.g. Doctor Appointment, Pay Gas Bill)"
                          value={eventTitle}
                          onChange={(e) => setEventTitle(e.target.value)}
                          onKeyDown={(e) => e.key === 'Enter' && handleSaveEvent()}
                          className="flex-1 min-w-0 px-3 py-2 text-xs sm:text-sm border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium bg-white"
                        />
                      </div>
                    </div>

                    {/* Multiple Notification / Reminder Dates Section */}
                    <div className="bg-indigo-50/50 p-3 rounded-xl border border-indigo-100 space-y-2">
                      <label className="block text-xs font-bold text-indigo-900 flex items-center justify-between">
                        <span className="flex items-center gap-1">
                          <Tag className="w-3.5 h-3.5 text-indigo-600" />
                          <span>Notification Dates (Select Multiple Dates)</span>
                        </span>
                        <span className="text-[11px] text-indigo-600 font-bold">
                          {notificationDates.length} date(s) selected
                        </span>
                      </label>

                      {/* Date Picker Input & Add Button */}
                      <div className="flex gap-2">
                        <input
                          type="date"
                          value={addDateInput}
                          onChange={(e) => setAddDateInput(e.target.value)}
                          className="flex-1 min-w-0 px-2.5 py-1.5 text-xs border border-indigo-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                        <button
                          type="button"
                          onClick={() => handleAddNotificationDate(addDateInput)}
                          disabled={!addDateInput}
                          className="px-3 py-1.5 bg-indigo-600 text-white font-bold text-xs rounded-lg hover:bg-indigo-700 disabled:opacity-40"
                        >
                          + Add Date
                        </button>
                      </div>

                      {/* Compact Preset Shortcuts */}
                      <div className="flex items-center gap-1 flex-wrap text-[10px] pt-1">
                        <span className="text-gray-500 font-bold uppercase tracking-wider text-[9px] mr-0.5">Shortcuts:</span>
                        <button
                          type="button"
                          onClick={() => handleAddNotificationDate(format(selectedDate, 'yyyy-MM-dd'))}
                          className="px-1.5 py-0.5 bg-white border border-indigo-200 hover:border-indigo-300 text-indigo-700 rounded-md font-bold text-[10px] leading-tight hover:bg-indigo-50 transition-colors shadow-2xs"
                        >
                          + Event Date
                        </button>
                        <button
                          type="button"
                          onClick={() => handleAddRelativePresetDate(1)}
                          className="px-1.5 py-0.5 bg-white border border-indigo-200 hover:border-indigo-300 text-indigo-700 rounded-md font-bold text-[10px] leading-tight hover:bg-indigo-50 transition-colors shadow-2xs"
                        >
                          -1 Day Before
                        </button>
                        <button
                          type="button"
                          onClick={() => handleAddRelativePresetDate(2)}
                          className="px-1.5 py-0.5 bg-white border border-indigo-200 hover:border-indigo-300 text-indigo-700 rounded-md font-bold text-[10px] leading-tight hover:bg-indigo-50 transition-colors shadow-2xs"
                        >
                          -2 Days Before
                        </button>
                        <button
                          type="button"
                          onClick={() => handleAddRelativePresetDate(7)}
                          className="px-1.5 py-0.5 bg-white border border-indigo-200 hover:border-indigo-300 text-indigo-700 rounded-md font-bold text-[10px] leading-tight hover:bg-indigo-50 transition-colors shadow-2xs"
                        >
                          -1 Week Before
                        </button>
                      </div>

                      {/* Active Selected Notification Dates Chips */}
                      <div className="flex flex-wrap gap-1.5 pt-1">
                        {notificationDates.length === 0 ? (
                          <span className="text-[11px] text-gray-400 italic">
                            No extra notification dates selected. Event date will be used.
                          </span>
                        ) : (
                          notificationDates.map((dStr) => (
                            <span
                              key={dStr}
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-xs font-bold bg-indigo-600 text-white shadow-2xs"
                            >
                              <span>{format(parseISO(dStr), 'MMM d, yyyy')}</span>
                              <button
                                type="button"
                                onClick={() => handleRemoveNotificationDate(dStr)}
                                className="hover:bg-indigo-700 rounded p-0.5"
                              >
                                <X className="w-3 h-3" />
                              </button>
                            </span>
                          ))
                        )}
                      </div>
                    </div>

                    {/* Schedule Time Notification (Optional) */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-bold text-gray-700 mb-1 flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5 text-indigo-600" />
                          <span>Notification Time (Optional)</span>
                        </label>
                        <input
                          type="time"
                          value={notificationTime}
                          onChange={(e) => setNotificationTime(e.target.value)}
                          className="w-full px-3 py-2 text-xs border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
                        />
                      </div>

                      {/* Snooze Option (Optional) */}
                      <div>
                        <label className="block text-xs font-bold text-gray-700 mb-1 flex items-center gap-1">
                          <Repeat className="w-3.5 h-3.5 text-indigo-600" />
                          <span>Snooze Option (Optional)</span>
                        </label>
                        <select
                          value={snoozeOption}
                          onChange={(e) => setSnoozeOption(e.target.value as SnoozeOption)}
                          className="w-full px-3 py-2 text-xs border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
                        >
                          <option value="none">None</option>
                          <option value="10min">Every 10 min</option>
                          <option value="1hr">Every 1 hour</option>
                          <option value="daily">Daily for today</option>
                        </select>
                      </div>
                    </div>

                    {/* To-Do / Notes (Optional) */}
                    <div>
                      <label className="block text-xs font-bold text-gray-700 mb-1 flex items-center gap-1">
                        <CheckSquare className="w-3.5 h-3.5 text-indigo-600" />
                        <span>To-Do / Notes (Optional)</span>
                      </label>
                      <textarea
                        rows={2}
                        placeholder="Add any checklist items, description, or notes..."
                        value={todoText}
                        onChange={(e) => setTodoText(e.target.value)}
                        className="w-full px-3 py-2 text-xs border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
                      />
                    </div>

                    {/* Form Action Button */}
                    <button
                      onClick={handleSaveEvent}
                      disabled={!eventTitle.trim()}
                      className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white rounded-xl text-xs sm:text-sm font-bold shadow-md transition-all flex items-center justify-center gap-2"
                    >
                      <Plus className="w-4 h-4" />
                      <span>{editingEventId ? 'Save Event Changes' : 'Add Event'}</span>
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* VIEW MODE 2: EVENTS LIST VIEW (Current Week / Month Upcoming Events at top) */}
      {viewMode === 'events' && (
        <div className="space-y-6">
          {/* Top Filter & Search Controls */}
          <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-sm flex flex-wrap items-center justify-between gap-3">
            {/* Search Input Bar */}
            <div className="relative flex-1 min-w-[200px]">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search events or to-do notes..."
                value={eventSearchQuery}
                onChange={(e) => setEventSearchQuery(e.target.value)}
                className="w-full pl-9 pr-8 py-2 text-xs sm:text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-gray-50/50"
              />
              {eventSearchQuery && (
                <button
                  onClick={() => setEventSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Time Period Filter Chips */}
            <div className="flex items-center gap-1.5 flex-wrap">
              <button
                onClick={() => setFilterPeriod('month')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                  filterPeriod === 'month'
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                This Month
              </button>
              <button
                onClick={() => setFilterPeriod('week')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                  filterPeriod === 'week'
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                This Week
              </button>
              <button
                onClick={() => setFilterPeriod('today')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                  filterPeriod === 'today'
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Today
              </button>
              <button
                onClick={() => setFilterPeriod('all')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                  filterPeriod === 'all'
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                All Events
              </button>
            </div>
          </div>

          {/* Full Events List View Cards */}
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="p-4 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
              <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                <ListFilter className="w-4 h-4 text-indigo-600" />
                <span>
                  Upcoming & Current Events ({filteredEventsList.length})
                </span>
              </h3>
            </div>

            <div className="divide-y divide-gray-100 max-h-[600px] overflow-y-auto">
              {filteredEventsList.length === 0 ? (
                <div className="p-8 text-center text-gray-400 space-y-2">
                  <CalendarIcon className="w-8 h-8 text-gray-300 mx-auto" />
                  <p className="text-xs italic">No matching events found for this filter period.</p>
                </div>
              ) : (
                filteredEventsList.map((ev) => {
                  const allDates = Array.from(new Set([ev.date, ...(ev.notificationDates || [])]));

                  return (
                    <div
                      key={ev.id}
                      className={`p-4 hover:bg-gray-50/80 transition-colors flex items-start justify-between gap-4 group ${
                        ev.completed ? 'opacity-60 bg-gray-50/40' : ''
                      }`}
                    >
                      <div className="flex items-start gap-3 flex-1 min-w-0">
                        <button
                          onClick={() => handleToggleCompleted(ev.id)}
                          className={`p-1.5 rounded-xl border transition-colors mt-0.5 flex-shrink-0 ${
                            ev.completed
                              ? 'bg-green-600 border-green-600 text-white'
                              : 'border-gray-300 text-transparent hover:border-indigo-400'
                          }`}
                          title={ev.completed ? 'Mark incomplete' : 'Mark complete'}
                        >
                          <Check className="w-4 h-4" />
                        </button>

                        <div className="flex-1 min-w-0 space-y-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xl flex-shrink-0">{ev.icon || '📌'}</span>
                            <h4
                              className={`text-sm font-bold text-gray-900 truncate ${
                                ev.completed ? 'line-through text-gray-400' : ''
                              }`}
                            >
                              {ev.title}
                            </h4>
                            <span className="text-xs bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-md font-bold border border-indigo-100 flex items-center gap-1">
                              <CalendarIcon className="w-3 h-3 text-indigo-600" />
                              Event: {format(parseISO(ev.date), 'dd MMM yyyy')}
                            </span>
                          </div>

                          {/* Multiple Notification Dates Badges */}
                          {allDates.length > 0 && (
                            <div className="flex items-center gap-1.5 flex-wrap text-xs pt-0.5">
                              <span className="font-semibold text-gray-500">Remind Dates ({allDates.length}):</span>
                              {allDates.map((dStr) => (
                                <span
                                  key={dStr}
                                  className="px-2 py-0.5 rounded-md bg-indigo-100 text-indigo-800 font-bold text-[11px]"
                                >
                                  {format(parseISO(dStr), 'MMM d, yyyy')}
                                </span>
                              ))}
                            </div>
                          )}

                          {/* Timing and Snooze Info */}
                          <div className="flex flex-wrap items-center gap-2 text-xs pt-0.5">
                            {ev.notificationTime && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 font-semibold border border-indigo-100">
                                <Clock className="w-3 h-3 text-indigo-600" />
                                <span>Time: {ev.notificationTime}</span>
                              </span>
                            )}

                            {ev.snoozeOption && ev.snoozeOption !== 'none' && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-purple-50 text-purple-700 font-semibold border border-purple-100">
                                <Repeat className="w-3 h-3 text-purple-600" />
                                <span>Snooze: {SNOOZE_LABELS[ev.snoozeOption]}</span>
                              </span>
                            )}
                          </div>

                          {/* To-Do details */}
                          {ev.todoText && (
                            <div className="text-xs text-gray-600 bg-gray-50/80 p-2.5 rounded-xl border border-gray-200/60 mt-1.5 space-y-1">
                              <span className="font-bold text-gray-700 block">To-Do Notes:</span>
                              <p className="whitespace-pre-wrap">{ev.todoText}</p>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Edit & Delete Action Buttons */}
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <button
                          onClick={() => {
                            setViewMode('calendar');
                            handleStartEdit(ev);
                          }}
                          className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-colors"
                          title="Edit event"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setConfirmDeleteId(ev.id)}
                          className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors"
                          title="Delete event"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Dialog for Deleting Calendar Event */}
      {confirmDeleteId && (
        <ConfirmDialog
          title="Delete Event"
          message="Are you sure you want to delete this event?"
          confirmText="Delete Event"
          cancelText="Cancel"
          onConfirm={() => handleDeleteEvent(confirmDeleteId)}
          onCancel={() => setConfirmDeleteId(null)}
        />
      )}
    </div>
  );
}

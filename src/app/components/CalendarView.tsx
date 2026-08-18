import { useState, useEffect, useMemo, useRef } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  ChevronDown,
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
import { syncEventsToServiceWorker } from '../utils/notificationScheduler';
import ConfirmDialog from './ConfirmDialog';
import {
  generate2026SacredCalendarEvents,
  SACRED_TITHI_TYPES,
  getSacredTithiName,
} from '../data/sacredEvents2026';
import { Language, t } from '../utils/translations';

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
  lang?: Language;
  onUnsavedChanges?: (hasChanges: boolean, save: () => void) => void;
}

const EVENT_ICONS = [
  // Sacred Tithi & Custom Event Icons
  '🌑', '🌕', '🐄', '⭐', '🟦', '🔺', '🦚', '🔱', '🕉️',
  // God & Temple & Spiritual
  '🛕', '🪔', '🙏', '📿', '⛩️', '🕌', '⛪', '🕍', '✝️', '☪️', '☸️', '☯️', '🛐', '🕊️',
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

const REMOVED_TITHI_KEYS = ['karthigai', 'ashtami', 'navami', 'sashti'];

export default function CalendarView({
  accessToken,
  lang = 'en',
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

  // Interactive Sacred Tithi Dates Popover State
  const [activeTithiMenu, setActiveTithiMenu] = useState<string | null>(null);
  const tithiMenuRef = useRef<HTMLDivElement>(null);

  // Close Tithi Menu on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (tithiMenuRef.current && !tithiMenuRef.current.contains(event.target as Node)) {
        setActiveTithiMenu(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Filter out any legacy or stored events matching removed tithis (Karthigai, Ashtami, Navami, Sashti)
  const cleanEvents = useMemo(() => {
    return events.filter((ev) => {
      const lowerTitle = ev.title.toLowerCase();
      const lowerId = ev.id.toLowerCase();
      return !REMOVED_TITHI_KEYS.some((key) => lowerTitle.includes(key) || lowerId.includes(key));
    });
  }, [events]);

  // Auto sync cleanEvents to localStorage & Service Worker for background notifications
  useEffect(() => {
    if (cleanEvents) {
      localStorage.setItem('tmd_calendar_events', JSON.stringify(cleanEvents));
      syncEventsToServiceWorker();
    }
  }, [cleanEvents]);

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

  // Expandable Event Detail Rows state (compressed single-line by default)
  const [expandedEventIds, setExpandedEventIds] = useState<Set<string>>(new Set());

  const toggleExpandEvent = (id: string) => {
    setExpandedEventIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  useEffect(() => {
    onUnsavedChanges?.(hasUnsavedChanges, () => {
      saveEvents();
    });
  }, [hasUnsavedChanges]);

  const handleSave = () => {
    // Save only clean events
    setEvents(cleanEvents);
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

  // Batch Import 2026 Sacred Tithi Events
  const handleImportSacredEvents = () => {
    const sacredEvents = generate2026SacredCalendarEvents();
    const existingIds = new Set(cleanEvents.map((e) => e.id));
    const newSacredEvents = sacredEvents.filter((e) => !existingIds.has(e.id));

    if (newSacredEvents.length === 0) {
      setEvents(cleanEvents);
      setNotifStatusMessage('All 2026 Sacred Tithi Events (Amavasai, Pournami, Pradosham, Sivarathri) are already in your calendar!');
    } else {
      setEvents([...cleanEvents, ...newSacredEvents]);
      setNotifStatusMessage(`Successfully imported ${newSacredEvents.length} Sacred 2026 Tithi Events! 🎉`);
    }
    setTimeout(() => setNotifStatusMessage(''), 4000);
  };

  // Apply Sacred Tithi Quick Preset to Event Form
  const handleApplySacredPreset = (presetKey: string, targetDateObj?: Date) => {
    const preset = SACRED_TITHI_TYPES.find((p) => p.key === presetKey);
    const dateToUse = targetDateObj || selectedDate;
    if (!preset || !dateToUse) return;
    const targetDateStr = format(dateToUse, 'yyyy-MM-dd');
    const dayMinusOneStr = format(subDays(dateToUse, 1), 'yyyy-MM-dd');

    setEventTitle(preset.name);
    setEventIcon(preset.icon);
    setNotificationTime('08:00');
    setNotificationDates([dayMinusOneStr, targetDateStr]);
    setTodoText(
      `${preset.description}. Reminder scheduled for Day -1 (${dayMinusOneStr}) and Event Day (${targetDateStr}) at 8:00 AM.`
    );
  };

  // Background interval checker for scheduled reminders (checks every 30s)
  useEffect(() => {
    const checkScheduledNotifications = () => {
      if (notifPermission !== 'granted' || cleanEvents.length === 0) return;
      const now = new Date();
      const currentHHMM = format(now, 'HH:mm'); // e.g. "08:00"
      const todayStr = format(now, 'yyyy-MM-dd');
      const firedKey = `tmd_notif_fired_${todayStr}_${currentHHMM}`;

      if (sessionStorage.getItem(firedKey)) return;

      let firedAny = false;
      cleanEvents.forEach((ev) => {
        const eventNotifTime = ev.notificationTime || '08:00';
        if (eventNotifTime === currentHHMM) {
          const allDates = ev.notificationDates || [ev.date];
          if (allDates.includes(todayStr)) {
            const isDayMinusOne = ev.date !== todayStr;
            const notifTitle = `${ev.icon || '📌'} ${ev.title} ${
              isDayMinusOne ? '(Tomorrow Reminder)' : '(Today Event)'
            }`;
            const notifBody =
              ev.todoText || `Reminder for ${ev.title} scheduled for ${ev.date} at 8:00 AM.`;

            sendPwaNotification(notifTitle, {
              body: notifBody,
              icon: ev.icon,
            });
            firedAny = true;
          }
        }
      });

      if (firedAny) {
        sessionStorage.setItem(firedKey, 'true');
      }
    };

    const interval = setInterval(checkScheduledNotifications, 30000);
    checkScheduledNotifications();
    return () => clearInterval(interval);
  }, [cleanEvents, notifPermission]);

  // Calendar Math
  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });
  const firstDayOfMonth = monthStart.getDay();
  const emptyDays = Array(firstDayOfMonth).fill(null);

  const getEventsForDate = (date: Date) => {
    const dateStr = format(date, 'yyyy-MM-dd');
    return cleanEvents.filter(
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
        cleanEvents.map((e) =>
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
      setEvents([...cleanEvents, newEv]);

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
    setEvents(cleanEvents.filter((e) => e.id !== id));
    if (editingEventId === id) handleCancelEdit();
    setConfirmDeleteId(null);
  };

  const handleToggleCompleted = (id: string) => {
    setEvents(
      cleanEvents.map((e) => (e.id === id ? { ...e, completed: !e.completed } : e))
    );
  };

  // Filtered Events for Events View
  const filteredEventsList = useMemo(() => {
    const now = new Date();
    const todayStr = format(now, 'yyyy-MM-dd');
    const weekStart = startOfWeek(now, { weekStartsOn: 1 });
    const weekEnd = endOfWeek(now, { weekStartsOn: 1 });

    return cleanEvents
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
  }, [cleanEvents, eventSearchQuery, filterPeriod]);

  const goToPreviousMonth = () => setCurrentDate(subMonths(currentDate, 1));
  const goToNextMonth = () => setCurrentDate(addMonths(currentDate, 1));
  const goToToday = () => {
    setCurrentDate(new Date());
    setSelectedDate(new Date());
  };

  return (
    <div className="space-y-6">
      {/* Top Header Bar: View Toggle & Save Button */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-gray-200 dark:border-gray-700 pb-4">
        {/* Toggle Switcher: Calendar View vs Events View */}
        <div className="flex items-center p-1 bg-gray-100/90 dark:bg-gray-800 rounded-xl border border-gray-200/80 dark:border-gray-700">
          <button
            onClick={() => setViewMode('calendar')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs sm:text-sm font-bold transition-all ${
              viewMode === 'calendar'
                ? 'bg-white dark:bg-gray-700 text-indigo-600 dark:text-indigo-400 shadow-sm'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
            }`}
          >
            <CalendarIcon className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
            <span>{t('calendarView', lang)}</span>
          </button>
          <button
            onClick={() => setViewMode('events')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs sm:text-sm font-bold transition-all ${
              viewMode === 'events'
                ? 'bg-white dark:bg-gray-700 text-indigo-600 dark:text-indigo-400 shadow-sm'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
            }`}
          >
            <ListFilter className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
            <span>{t('eventsListView', lang)}</span>
            <span className="bg-indigo-100 dark:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 text-[10px] font-extrabold px-1.5 py-0.2 rounded-full">
              {cleanEvents.length}
            </span>
          </button>
        </div>

        {/* Save, Import Sacred Events & Notification Status */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={handleImportSacredEvents}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white shadow-sm transition-all"
            title={t('importSacredEventsTooltip', lang)}
          >
            <Sparkles className="w-4 h-4 text-amber-300 animate-pulse" />
            <span>{t('importSacredEvents', lang)}</span>
          </button>

          <button
            onClick={handleSave}
            disabled={!hasUnsavedChanges}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all ${
              showSaved
                ? 'bg-green-100 text-green-700 border border-green-300 dark:bg-green-950/60 dark:text-green-300 dark:border-green-800'
                : hasUnsavedChanges
                  ? 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-sm'
                  : 'bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-500 cursor-not-allowed'
            }`}
          >
            <Save className="w-4 h-4" />
            {showSaved ? t('saved', lang) : hasUnsavedChanges ? t('saveCalendar', lang) : t('allSaved', lang)}
          </button>
        </div>
      </div>

      {/* PWA Mobile Lock-Screen Notification Control Bar */}
      <div className="bg-gradient-to-r from-indigo-500/10 via-purple-500/10 to-pink-500/10 border border-indigo-200/80 dark:border-indigo-900/50 rounded-2xl p-4 shadow-sm flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-md flex-shrink-0">
            {notifPermission === 'granted' ? <Bell className="w-5 h-5" /> : <BellOff className="w-5 h-5" />}
          </div>
          <div>
            <h4 className="text-xs sm:text-sm font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
              <span>{t('mobileNotifications', lang)}</span>
              <span
                className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${
                  notifPermission === 'granted'
                    ? 'bg-green-100 text-green-700 border border-green-300 dark:bg-green-950/60 dark:text-green-300 dark:border-green-800'
                    : 'bg-amber-100 text-amber-700 border border-amber-300 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800'
                }`}
              >
                {notifPermission === 'granted' ? t('enabled', lang) : t('disabled', lang)}
              </span>
            </h4>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              {t('mobileNotificationsDesc', lang)}
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
              <span>{t('enableNotifications', lang)}</span>
            </button>
          ) : (
            <button
              onClick={handleSendTestNotification}
              className="px-3 py-1.5 bg-white dark:bg-gray-800 border border-indigo-200 dark:border-gray-700 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-50 dark:hover:bg-gray-700 text-xs font-bold rounded-xl transition-colors flex items-center gap-1.5 shadow-2xs"
            >
              <Sparkles className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
              <span>{t('sendTestNotification', lang)}</span>
            </button>
          )}
        </div>

        {notifStatusMessage && (
          <div className="w-full text-xs text-indigo-700 dark:text-indigo-300 font-semibold bg-white/80 dark:bg-gray-800/80 p-2 rounded-lg border border-indigo-200 dark:border-indigo-800">
            {notifStatusMessage}
          </div>
        )}
      </div>

      {/* Sacred Tithi Calendar Event Icons Legend */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200/80 dark:border-gray-700 p-3.5 shadow-2xs space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-gray-800 dark:text-gray-200 flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
            <span>{t('sacredTithiTitle', lang)}</span>
          </span>
          <button
            onClick={handleImportSacredEvents}
            className="text-[11px] font-bold text-indigo-600 dark:text-indigo-300 hover:text-indigo-800 bg-indigo-50 dark:bg-indigo-950/60 hover:bg-indigo-100 dark:hover:bg-indigo-900/80 px-2.5 py-1 rounded-lg border border-indigo-200 dark:border-indigo-800 transition-colors"
          >
            {t('loadTithiEvents', lang)}
          </button>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {SACRED_TITHI_TYPES.map((tithi) => {
            const isOpen = activeTithiMenu === tithi.key;
            const localizedName = getSacredTithiName(tithi, lang);
            return (
              <div key={tithi.key} className="relative">
                <div
                  onClick={(e) => {
                    e.stopPropagation();
                    setActiveTithiMenu(isOpen ? null : tithi.key);
                  }}
                  className={`flex items-center gap-2 p-2.5 rounded-xl border transition-all cursor-pointer group ${
                    isOpen
                      ? 'bg-indigo-50 dark:bg-gray-700 border-indigo-400 ring-2 ring-indigo-300'
                      : 'bg-gray-50 dark:bg-gray-800/80 hover:bg-indigo-50/70 dark:hover:bg-gray-700/80 border-gray-200 dark:border-gray-700 hover:border-indigo-300 dark:hover:border-indigo-500'
                  }`}
                  title={`Click to view all ${tithi.dates.length} dates in 2026 for ${localizedName}`}
                >
                  <span className="text-xl group-hover:scale-110 transition-transform flex-shrink-0">{tithi.icon}</span>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-extrabold text-gray-900 dark:text-gray-100 truncate group-hover:text-indigo-600 dark:group-hover:text-indigo-400">
                      {localizedName}
                    </p>
                    <p className="text-[10px] text-gray-500 dark:text-gray-400 font-medium truncate flex items-center justify-between">
                      <span>{tithi.dates.length} {t('eventsCount', lang)}</span>
                      <ChevronDown className={`w-3 h-3 text-gray-400 transition-transform ${isOpen ? 'rotate-180 text-indigo-600 dark:text-indigo-400' : ''}`} />
                    </p>
                  </div>
                </div>

                {/* Popover Menu listing all 2026 dates */}
                {isOpen && (
                  <div
                    ref={tithiMenuRef}
                    onClick={(e) => e.stopPropagation()}
                    className="absolute top-full left-0 mt-2 z-50 w-72 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl shadow-2xl p-2.5 space-y-1 text-left animate-in fade-in zoom-in-95 duration-150 max-h-80 overflow-y-auto"
                  >
                    <div className="flex items-center justify-between px-2 py-1.5 border-b border-gray-100 dark:border-gray-700 sticky top-0 bg-white dark:bg-gray-800 z-10">
                      <span className="text-xs font-bold text-gray-900 dark:text-gray-100 flex items-center gap-1.5">
                        <span className="text-base">{tithi.icon}</span>
                        <span>{localizedName} (2026)</span>
                      </span>
                      <button
                        onClick={() => setActiveTithiMenu(null)}
                        className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 p-0.5 rounded-lg"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <div className="py-1 space-y-1">
                      {tithi.dates.map((dStr, idx) => {
                        const parsed = parseISO(dStr);
                        return (
                          <button
                            key={dStr}
                            onClick={() => {
                              const targetDate = parseISO(dStr);
                              setCurrentDate(targetDate);
                              setSelectedDate(targetDate);
                              handleApplySacredPreset(tithi.key, targetDate);
                              setActiveTithiMenu(null);
                            }}
                            className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium hover:bg-indigo-50 dark:hover:bg-gray-700 text-gray-800 dark:text-gray-200 transition-colors group"
                          >
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] font-bold text-indigo-600 dark:text-indigo-300 bg-indigo-100 dark:bg-indigo-900/60 w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0">
                                {idx + 1}
                              </span>
                              <span className="font-bold">{format(parsed, 'MMM d, yyyy')}</span>
                            </div>
                            <span className="text-[11px] text-gray-400 dark:text-gray-400 font-medium">
                              {format(parsed, 'EEEE')}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* VIEW MODE 1: CALENDAR VIEW */}
      {viewMode === 'calendar' && (
        <div className="space-y-6">
          {/* Full-width Top Row: Events on [Selected Date] (ONLY shown if events exist for the selected date) */}
          {selectedDate && getEventsForDate(selectedDate).length > 0 && (
            <div className="w-full bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden animate-in fade-in duration-150">
              <div className="p-4 bg-gray-50 dark:bg-gray-700/50 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
                <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                  <CalendarIcon className="w-4.5 h-4.5 text-indigo-600 dark:text-indigo-400" />
                  <span>Events on {format(selectedDate, 'MMMM d, yyyy')}</span>
                </h3>
                <span className="text-xs bg-indigo-100 dark:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 px-2.5 py-0.5 rounded-full font-bold">
                  {getEventsForDate(selectedDate).length} events
                </span>
              </div>

              <div className="p-3 space-y-1.5 max-h-96 overflow-y-auto divide-y divide-gray-100 dark:divide-gray-700">
                {getEventsForDate(selectedDate).map((ev) => {
                  const isExpanded = expandedEventIds.has(ev.id);
                  const selectedDateStr = selectedDate ? format(selectedDate, 'yyyy-MM-dd') : '';
                  const isMainEventDay = ev.date === selectedDateStr;

                  return (
                    <div
                      key={ev.id}
                      className={`pt-2 first:pt-0 pb-1 hover:bg-gray-50/80 dark:hover:bg-gray-700/50 rounded-xl px-2 transition-colors ${
                        ev.completed ? 'opacity-60' : ''
                      }`}
                    >
                      {/* Compressed Single Line Row */}
                      <div
                        onClick={() => toggleExpandEvent(ev.id)}
                        className="flex items-center justify-between gap-2.5 cursor-pointer py-1"
                      >
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleToggleCompleted(ev.id);
                            }}
                            className={`w-5 h-5 rounded-full border transition-colors flex items-center justify-center flex-shrink-0 ${
                              ev.completed
                                ? 'bg-green-600 border-green-600 text-white'
                                : 'border-gray-300 dark:border-gray-600 hover:border-indigo-400'
                            }`}
                            title={ev.completed ? 'Mark incomplete' : 'Mark complete'}
                          >
                            {ev.completed && <Check className="w-3 h-3" />}
                          </button>

                          <span className="text-base flex-shrink-0">{ev.icon || '📌'}</span>

                          <h4
                            className={`text-xs sm:text-sm font-bold text-gray-900 dark:text-gray-100 truncate ${
                              ev.completed ? 'line-through text-gray-400 dark:text-gray-500' : ''
                            }`}
                          >
                            {ev.title}
                          </h4>

                          {/* Compact Status Badge */}
                          {isMainEventDay ? (
                            <span className="px-1.5 py-0.5 rounded bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 font-extrabold text-[10px] flex-shrink-0">
                              🎯 Event Day
                            </span>
                          ) : (
                            <span className="px-1.5 py-0.5 rounded bg-amber-100 dark:bg-amber-950/60 text-amber-900 dark:text-amber-300 font-extrabold text-[10px] flex-shrink-0 flex items-center gap-0.5">
                              <Bell className="w-2.5 h-2.5 text-amber-600 dark:text-amber-400" />
                              <span>Reminder ({format(parseISO(ev.date), 'MMM d')})</span>
                            </span>
                          )}

                          {ev.notificationTime && (
                            <span className="hidden sm:inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-indigo-50 dark:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 font-bold text-[10px] flex-shrink-0">
                              <Clock className="w-2.5 h-2.5 text-indigo-600 dark:text-indigo-400" />
                              <span>{ev.notificationTime}</span>
                            </span>
                          )}
                        </div>

                        {/* Action buttons & Expand chevron */}
                        <div className="flex items-center gap-1 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                          <button
                            onClick={() => toggleExpandEvent(ev.id)}
                            className="p-1 text-gray-400 hover:text-indigo-600 rounded-lg transition-colors"
                            title={isExpanded ? 'Collapse details' : 'Expand details'}
                          >
                            <ChevronDown
                              className={`w-4 h-4 transform transition-transform ${
                                isExpanded ? 'rotate-180 text-indigo-600 dark:text-indigo-400' : ''
                              }`}
                            />
                          </button>
                          <button
                            onClick={() => handleStartEdit(ev)}
                            className="p-1 text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-gray-700 rounded-lg transition-colors"
                            title="Edit event"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => setConfirmDeleteId(ev.id)}
                            className="p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 rounded-lg transition-colors"
                            title="Delete event"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      {/* Expandable Details Content */}
                      {isExpanded && (
                        <div className="mt-1 pt-1.5 border-t border-gray-100 dark:border-gray-700 text-xs space-y-1.5 pl-7 animate-in fade-in duration-150">
                          {ev.notificationDates && ev.notificationDates.length > 0 && (
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="font-medium text-gray-500 dark:text-gray-400 text-[11px]">Remind Dates:</span>
                              {ev.notificationDates.map((dStr) => (
                                <span
                                  key={dStr}
                                  className="px-2 py-0.5 rounded bg-indigo-50 dark:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 font-bold border border-indigo-100 dark:border-indigo-800 text-[10px]"
                                >
                                  {format(parseISO(dStr), 'MMM d, yyyy')}
                                </span>
                              ))}
                            </div>
                          )}

                          {ev.snoozeOption && ev.snoozeOption !== 'none' && (
                            <div className="flex items-center gap-1 text-purple-700 dark:text-purple-300 font-semibold text-[11px]">
                              <Repeat className="w-3 h-3 text-purple-600 dark:text-purple-400" />
                              <span>Snooze: {SNOOZE_LABELS[ev.snoozeOption]}</span>
                            </div>
                          )}

                          {ev.todoText && (
                            <div className="text-xs text-gray-600 dark:text-gray-300 bg-gray-50 dark:bg-gray-700/60 p-2.5 rounded-xl border border-gray-200/70 dark:border-gray-700 font-medium whitespace-pre-wrap">
                              {ev.todoText}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Compact Grid & Add Event Form in SAME ROW */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Left Column (6 cols): Compact Month Calendar Grid */}
            <div className="lg:col-span-6 bg-white dark:bg-gray-800 rounded-2xl p-4 sm:p-5 border border-gray-200 dark:border-gray-700 shadow-sm space-y-4">
              {/* Month Header Navigation */}
              <div className="flex items-center justify-between border-b border-gray-100 dark:border-gray-700 pb-3">
                <h2 className="text-base sm:text-lg font-black text-gray-900 dark:text-gray-100 flex items-center gap-2">
                  <CalendarIcon className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                  <span>{format(currentDate, 'MMMM yyyy')}</span>
                </h2>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={goToToday}
                    className="px-2.5 py-1 text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors shadow-2xs"
                  >
                    Today
                  </button>
                  <button
                    onClick={goToPreviousMonth}
                    className="p-1.5 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                    title="Previous month"
                  >
                    <ChevronLeft className="w-4 h-4 text-gray-600 dark:text-gray-300" />
                  </button>
                  <button
                    onClick={goToNextMonth}
                    className="p-1.5 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                    title="Next month"
                  >
                    <ChevronRight className="w-4 h-4 text-gray-600 dark:text-gray-300" />
                  </button>
                </div>
              </div>

              {/* Compact Calendar Month Grid */}
              <div className="grid grid-cols-7 gap-1.5">
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
                  <div key={day} className="text-center font-bold text-[11px] uppercase text-gray-400 dark:text-gray-500 py-0.5">
                    {day}
                  </div>
                ))}

                {emptyDays.map((_, idx) => (
                  <div key={`empty-${idx}`} className="aspect-square opacity-20 bg-gray-50/50 dark:bg-gray-700/20 rounded-xl" />
                ))}

                {daysInMonth.map((day) => {
                  const dayEvents = getEventsForDate(day);
                  const isToday = isSameDay(day, new Date());
                  const isSelected = selectedDate && isSameDay(day, selectedDate);
                  const cellDateStr = format(day, 'yyyy-MM-dd');
                  const mainEventItems = dayEvents.filter((ev) => ev.date === cellDateStr);
                  const reminderItems = dayEvents.filter((ev) => ev.date !== cellDateStr);

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
                      className={`aspect-square p-1.5 border rounded-xl transition-all relative flex flex-col justify-between text-left group overflow-hidden ${
                        isSelected
                          ? 'border-indigo-600 dark:border-indigo-500 bg-indigo-50/90 dark:bg-indigo-950/80 ring-2 ring-indigo-400 shadow-xs'
                          : isToday
                            ? 'border-indigo-300 dark:border-indigo-700 bg-indigo-50/40 dark:bg-indigo-950/30'
                            : 'border-gray-200 dark:border-gray-700 hover:border-indigo-300 dark:hover:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700/50'
                      }`}
                    >
                      {/* Date Number Top Left */}
                      <span
                        className={`text-xs font-extrabold leading-none z-10 ${
                          isToday ? 'text-indigo-600 dark:text-indigo-400' : 'text-gray-800 dark:text-gray-200'
                        }`}
                      >
                        {format(day, 'd')}
                      </span>

                      {/* Main Event Day Icons - Larger, Centered in Date Cell */}
                      {mainEventItems.length > 0 && (
                        <div className="absolute inset-0 flex items-center justify-center gap-1 z-0 pt-2 pointer-events-none">
                          {mainEventItems.slice(0, 2).map((ev) => (
                            <span
                              key={ev.id}
                              className="text-base sm:text-xl font-bold leading-none transform hover:scale-125 transition-transform filter drop-shadow-2xs"
                              title={`🎯 ${ev.icon || '📌'} ${ev.title} (Main Event Day)`}
                            >
                              {ev.icon || '📌'}
                            </span>
                          ))}
                        </div>
                      )}

                      {/* Reminder Icons - Small, Bottom Right with Bell Icon & Fade Away */}
                      {reminderItems.length > 0 && (
                        <div className="absolute bottom-1 right-1 flex items-center gap-0.5 z-10 pointer-events-none">
                          {reminderItems.slice(0, 2).map((ev) => (
                            <span
                              key={ev.id}
                              className="inline-flex items-center text-[9px] leading-none bg-amber-50/90 dark:bg-amber-950/80 border border-amber-200/80 dark:border-amber-800 rounded px-1 py-0.5 text-amber-900 dark:text-amber-300 font-extrabold opacity-65 group-hover:opacity-100 transition-opacity shadow-2xs"
                              title={`🔔 Reminder: ${ev.title} (Event on ${format(parseISO(ev.date), 'MMM d')})`}
                            >
                              <span>🔔</span>
                              <span className="text-[8px] opacity-80 ml-0.5">{ev.icon || '📌'}</span>
                            </span>
                          ))}
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Right Column (6 cols): Add/Edit Event Form */}
            {selectedDate && (
              <div className="lg:col-span-6">
                <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm p-4 sm:p-5 space-y-4">
                  <div className="flex items-center justify-between border-b border-gray-100 dark:border-gray-700 pb-3">
                    <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                      <span>
                        {editingEventId ? 'Edit Event' : `Add Event for ${format(selectedDate, 'MMM d')}`}
                      </span>
                    </h3>
                    {editingEventId && (
                      <button
                        onClick={handleCancelEdit}
                        className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 font-semibold"
                      >
                        Cancel Edit
                      </button>
                    )}
                  </div>

                  <div className="space-y-3.5">
                    {/* Quick Sacred Tithi Presets Selector */}
                    <div className="bg-gradient-to-r from-purple-50 to-indigo-50 dark:from-purple-950/30 dark:to-indigo-950/30 p-2.5 rounded-xl border border-purple-100/80 dark:border-purple-900/50">
                      <label className="block text-[11px] font-bold text-purple-900 dark:text-purple-300 mb-1 flex items-center justify-between">
                        <span className="flex items-center gap-1">
                          <Sparkles className="w-3 h-3 text-purple-600 dark:text-purple-400" />
                          <span>Quick Sacred Event Preset</span>
                        </span>
                        <span className="text-[10px] text-purple-600 dark:text-purple-400 font-semibold">Auto-fills icon & 8 AM reminders</span>
                      </label>
                      <select
                        onChange={(e) => {
                          if (e.target.value) {
                            handleApplySacredPreset(e.target.value);
                            e.target.value = '';
                          }
                        }}
                        defaultValue=""
                        className="w-full px-2.5 py-1.5 text-xs border border-purple-200 dark:border-purple-800 rounded-lg bg-white dark:bg-gray-900 font-semibold text-purple-950 dark:text-purple-200 focus:outline-none focus:ring-2 focus:ring-purple-400 cursor-pointer"
                      >
                        <option value="" disabled>-- Select a Sacred Event Preset --</option>
                        {SACRED_TITHI_TYPES.map((tithi) => (
                          <option key={tithi.key} value={tithi.key}>
                            {tithi.icon} {tithi.name} (Day -1 & Event Day @ 8 AM)
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Event Title & Icon (In Same Row with Expandable Popover) */}
                    <div>
                      <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1 flex items-center justify-between">
                        <span>Event Title & Icon <span className="text-red-500">*</span></span>
                        <span className="text-[10px] text-gray-400 dark:text-gray-500 font-medium">Click icon to change</span>
                      </label>
                      <div className="flex items-center gap-2 relative">
                        {/* Icon Selector Button with Popover */}
                        <div className="relative flex-shrink-0">
                          <button
                            type="button"
                            onClick={() => setShowFormIconPicker((v) => !v)}
                            className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-gray-700 hover:bg-indigo-100 dark:hover:bg-gray-600 border border-indigo-200 dark:border-gray-600 flex items-center justify-center text-xl shadow-2xs transition-colors cursor-pointer"
                            title="Click to select icon menu"
                          >
                            {eventIcon || '📌'}
                          </button>

                          {/* Expandable Icon List Popover */}
                          {showFormIconPicker && (
                            <div className="absolute top-12 left-0 z-50 w-64 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-2xl p-3 space-y-2 text-left animate-in fade-in zoom-in-95 duration-150">
                              <div className="flex items-center justify-between text-xs font-bold text-gray-700 dark:text-gray-300 border-b border-gray-100 dark:border-gray-700 pb-1.5">
                                <span>Select Icon</span>
                                <button
                                  type="button"
                                  onClick={() => setShowFormIconPicker(false)}
                                  className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 p-0.5"
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
                                        : 'hover:bg-indigo-50 dark:hover:bg-gray-700'
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
                          className="flex-1 min-w-0 px-3 py-2 text-xs sm:text-sm border border-gray-300 dark:border-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium bg-white dark:bg-gray-900 dark:text-white"
                        />
                      </div>
                    </div>

                    {/* Multiple Notification / Reminder Dates Section */}
                    <div className="bg-indigo-50/50 dark:bg-indigo-950/30 p-3 rounded-xl border border-indigo-100 dark:border-indigo-900/50 space-y-2">
                      <label className="block text-xs font-bold text-indigo-900 dark:text-indigo-300 flex items-center justify-between">
                        <span className="flex items-center gap-1">
                          <Tag className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                          <span>Notification Dates (Select Multiple Dates)</span>
                        </span>
                        <span className="text-[11px] text-indigo-600 dark:text-indigo-400 font-bold">
                          {notificationDates.length} date(s) selected
                        </span>
                      </label>

                      {/* Date Picker Input & Add Button */}
                      <div className="flex gap-2">
                        <input
                          type="date"
                          value={addDateInput}
                          onChange={(e) => setAddDateInput(e.target.value)}
                          className="flex-1 min-w-0 px-2.5 py-1.5 text-xs border border-indigo-200 dark:border-indigo-800 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
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
                        <span className="text-gray-500 dark:text-gray-400 font-bold uppercase tracking-wider text-[9px] mr-0.5">Shortcuts:</span>
                        <button
                          type="button"
                          onClick={() => handleAddNotificationDate(format(selectedDate, 'yyyy-MM-dd'))}
                          className="px-1.5 py-0.5 bg-white dark:bg-gray-800 border border-indigo-200 dark:border-indigo-800 hover:border-indigo-300 text-indigo-700 dark:text-indigo-300 rounded-md font-bold text-[10px] leading-tight hover:bg-indigo-50 dark:hover:bg-gray-700 transition-colors shadow-2xs"
                        >
                          + Event Date
                        </button>
                        <button
                          type="button"
                          onClick={() => handleAddRelativePresetDate(1)}
                          className="px-1.5 py-0.5 bg-white dark:bg-gray-800 border border-indigo-200 dark:border-indigo-800 hover:border-indigo-300 text-indigo-700 dark:text-indigo-300 rounded-md font-bold text-[10px] leading-tight hover:bg-indigo-50 dark:hover:bg-gray-700 transition-colors shadow-2xs"
                        >
                          -1 Day Before
                        </button>
                        <button
                          type="button"
                          onClick={() => handleAddRelativePresetDate(2)}
                          className="px-1.5 py-0.5 bg-white dark:bg-gray-800 border border-indigo-200 dark:border-indigo-800 hover:border-indigo-300 text-indigo-700 dark:text-indigo-300 rounded-md font-bold text-[10px] leading-tight hover:bg-indigo-50 dark:hover:bg-gray-700 transition-colors shadow-2xs"
                        >
                          -2 Days Before
                        </button>
                        <button
                          type="button"
                          onClick={() => handleAddRelativePresetDate(7)}
                          className="px-1.5 py-0.5 bg-white dark:bg-gray-800 border border-indigo-200 dark:border-indigo-800 hover:border-indigo-300 text-indigo-700 dark:text-indigo-300 rounded-md font-bold text-[10px] leading-tight hover:bg-indigo-50 dark:hover:bg-gray-700 transition-colors shadow-2xs"
                        >
                          -1 Week Before
                        </button>
                      </div>

                      {/* Active Selected Notification Dates Chips */}
                      <div className="flex flex-wrap gap-1.5 pt-1">
                        {notificationDates.length === 0 ? (
                          <span className="text-[11px] text-gray-400 dark:text-gray-500 italic">
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
                        <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1 flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                          <span>Notification Time (Optional)</span>
                        </label>
                        <input
                          type="time"
                          value={notificationTime}
                          onChange={(e) => setNotificationTime(e.target.value)}
                          className="w-full px-3 py-2 text-xs border border-gray-300 dark:border-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
                        />
                      </div>

                      {/* Snooze Option (Optional) */}
                      <div>
                        <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1 flex items-center gap-1">
                          <Repeat className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                          <span>Snooze Option (Optional)</span>
                        </label>
                        <select
                          value={snoozeOption}
                          onChange={(e) => setSnoozeOption(e.target.value as SnoozeOption)}
                          className="w-full px-3 py-2 text-xs border border-gray-300 dark:border-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
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
                      <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1 flex items-center gap-1">
                        <CheckSquare className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                        <span>To-Do / Notes (Optional)</span>
                      </label>
                      <textarea
                        rows={2}
                        placeholder="Add any checklist items, description, or notes..."
                        value={todoText}
                        onChange={(e) => setTodoText(e.target.value)}
                        className="w-full px-3 py-2 text-xs border border-gray-300 dark:border-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
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
          <div className="bg-white dark:bg-gray-800 p-4 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm flex flex-wrap items-center justify-between gap-3">
            {/* Search Input Bar */}
            <div className="relative flex-1 min-w-[200px]">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search events or to-do notes..."
                value={eventSearchQuery}
                onChange={(e) => setEventSearchQuery(e.target.value)}
                className="w-full pl-9 pr-8 py-2 text-xs sm:text-sm border border-gray-200 dark:border-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-gray-50/50 dark:bg-gray-900 text-gray-900 dark:text-gray-100"
              />
              {eventSearchQuery && (
                <button
                  onClick={() => setEventSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
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
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                }`}
              >
                This Month
              </button>
              <button
                onClick={() => setFilterPeriod('week')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                  filterPeriod === 'week'
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                }`}
              >
                This Week
              </button>
              <button
                onClick={() => setFilterPeriod('today')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                  filterPeriod === 'today'
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                }`}
              >
                Today
              </button>
              <button
                onClick={() => setFilterPeriod('all')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                  filterPeriod === 'all'
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                }`}
              >
                All Events
              </button>
            </div>
          </div>

          {/* Full Events List View Cards */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
            <div className="p-4 bg-gray-50 dark:bg-gray-700/50 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
              <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                <ListFilter className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                <span>
                  Upcoming & Current Events ({filteredEventsList.length})
                </span>
              </h3>
            </div>

            <div className="divide-y divide-gray-100 dark:divide-gray-700 max-h-[600px] overflow-y-auto">
              {filteredEventsList.length === 0 ? (
                <div className="p-8 text-center text-gray-400 dark:text-gray-500 space-y-2">
                  <CalendarIcon className="w-8 h-8 text-gray-300 dark:text-gray-600 mx-auto" />
                  <p className="text-xs italic">No matching events found for this filter period.</p>
                </div>
              ) : (
                filteredEventsList.map((ev) => {
                  const isExpanded = expandedEventIds.has(ev.id);
                  const allDates = Array.from(new Set([ev.date, ...(ev.notificationDates || [])]));

                  return (
                    <div
                      key={ev.id}
                      className={`p-2.5 hover:bg-gray-50/80 dark:hover:bg-gray-700/50 transition-colors ${
                        ev.completed ? 'opacity-60 bg-gray-50/40 dark:bg-gray-800/40' : ''
                      }`}
                    >
                      {/* Compressed Single Line Row */}
                      <div
                        onClick={() => toggleExpandEvent(ev.id)}
                        className="flex items-center justify-between gap-3 cursor-pointer py-1"
                      >
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleToggleCompleted(ev.id);
                            }}
                            className={`w-5 h-5 rounded-full border transition-colors flex items-center justify-center flex-shrink-0 ${
                              ev.completed
                                ? 'bg-green-600 border-green-600 text-white'
                                : 'border-gray-300 dark:border-gray-600 hover:border-indigo-400'
                            }`}
                            title={ev.completed ? 'Mark incomplete' : 'Mark complete'}
                          >
                            {ev.completed && <Check className="w-3 h-3" />}
                          </button>

                          <span className="text-base flex-shrink-0">{ev.icon || '📌'}</span>

                          <h4
                            className={`text-xs sm:text-sm font-bold text-gray-900 dark:text-gray-100 truncate ${
                              ev.completed ? 'line-through text-gray-400 dark:text-gray-500' : ''
                            }`}
                          >
                            {ev.title}
                          </h4>

                          <span className="text-[11px] bg-indigo-50 dark:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 px-2 py-0.5 rounded font-bold border border-indigo-100 dark:border-indigo-800 flex-shrink-0 flex items-center gap-1">
                            <CalendarIcon className="w-3 h-3 text-indigo-600 dark:text-indigo-400" />
                            {format(parseISO(ev.date), 'dd MMM yyyy')}
                          </span>

                          {ev.notificationTime && (
                            <span className="hidden sm:inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-indigo-50 dark:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 font-bold text-[10px] flex-shrink-0">
                              <Clock className="w-2.5 h-2.5 text-indigo-600 dark:text-indigo-400" />
                              <span>{ev.notificationTime}</span>
                            </span>
                          )}
                        </div>

                        {/* Expand Chevron & Action Buttons */}
                        <div className="flex items-center gap-1 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                          <button
                            onClick={() => toggleExpandEvent(ev.id)}
                            className="p-1 text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 rounded-lg transition-colors"
                            title={isExpanded ? 'Collapse details' : 'Expand details'}
                          >
                            <ChevronDown
                              className={`w-4 h-4 transform transition-transform ${
                                isExpanded ? 'rotate-180 text-indigo-600 dark:text-indigo-400' : ''
                              }`}
                            />
                          </button>
                          <button
                            onClick={() => {
                              setViewMode('calendar');
                              handleStartEdit(ev);
                            }}
                            className="p-1 text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-gray-700 rounded-lg transition-colors"
                            title="Edit event"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => setConfirmDeleteId(ev.id)}
                            className="p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 rounded-lg transition-colors"
                            title="Delete event"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      {/* Expandable Details */}
                      {isExpanded && (
                        <div className="mt-1 pt-2 border-t border-gray-100 dark:border-gray-700 text-xs space-y-1.5 pl-7 animate-in fade-in duration-150">
                          {allDates.length > 0 && (
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="font-semibold text-gray-500 dark:text-gray-400 text-[11px]">
                                Remind Dates ({allDates.length}):
                              </span>
                              {allDates.map((dStr) => (
                                <span
                                  key={dStr}
                                  className="px-2 py-0.5 rounded bg-indigo-100 dark:bg-indigo-900/60 text-indigo-800 dark:text-indigo-300 font-bold text-[10px]"
                                >
                                  {format(parseISO(dStr), 'MMM d, yyyy')}
                                </span>
                              ))}
                            </div>
                          )}

                          {ev.snoozeOption && ev.snoozeOption !== 'none' && (
                            <div className="flex items-center gap-1 text-purple-700 dark:text-purple-300 font-semibold text-[11px]">
                              <Repeat className="w-3 h-3 text-purple-600 dark:text-purple-400" />
                              <span>Snooze: {SNOOZE_LABELS[ev.snoozeOption]}</span>
                            </div>
                          )}

                          {ev.todoText && (
                            <div className="text-xs text-gray-600 dark:text-gray-300 bg-gray-50/80 dark:bg-gray-700/60 p-2.5 rounded-xl border border-gray-200/60 dark:border-gray-700 font-medium whitespace-pre-wrap">
                              {ev.todoText}
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

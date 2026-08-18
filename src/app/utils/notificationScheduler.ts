import { sendPwaNotification, scheduleExactNotificationTrigger, getNotificationPermissionStatus } from './notifications';
import { format, parseISO } from 'date-fns';

interface StoredEvent {
  id: string;
  title: string;
  date: string;
  notificationDates?: string[];
  notificationTime?: string;
  icon?: string;
  todoText?: string;
  completed?: boolean;
}

const FIRED_NOTIFS_KEY = 'tmd_fired_notifications';

function getFiredNotifications(): Set<string> {
  try {
    const raw = localStorage.getItem(FIRED_NOTIFS_KEY);
    return raw ? new Set(JSON.parse(raw)) : new Set();
  } catch (e) {
    return new Set();
  }
}

function saveFiredNotification(key: string) {
  try {
    const set = getFiredNotifications();
    set.add(key);
    // Keep last 500 keys to avoid unlimited growth
    const arr = Array.from(set).slice(-500);
    localStorage.setItem(FIRED_NOTIFS_KEY, JSON.stringify(arr));
  } catch (e) {
    console.error('Failed to save fired notification key', e);
  }
}

export function checkAndTriggerDueEventNotifications(): number {
  if (getNotificationPermissionStatus() !== 'granted') {
    return 0;
  }

  const rawEvents = localStorage.getItem('tmd_calendar_events');
  if (!rawEvents) return 0;

  let events: StoredEvent[] = [];
  try {
    events = JSON.parse(rawEvents);
  } catch (e) {
    return 0;
  }

  const now = new Date();
  const currentDateStr = format(now, 'yyyy-MM-dd');
  const firedSet = getFiredNotifications();
  let triggeredCount = 0;

  events.forEach((ev) => {
    if (ev.completed) return;

    // Check all dates for this event (either main date or reminder dates)
    const targetDates = Array.from(new Set([ev.date, ...(ev.notificationDates || [])]));

    targetDates.forEach((dateStr) => {
      const scheduledTime = ev.notificationTime || '08:00';
      const notifUniqueKey = `${ev.id}_${dateStr}_${scheduledTime}`;
      const scheduledDateTime = new Date(`${dateStr}T${scheduledTime}:00`);
      const scheduledMs = scheduledDateTime.getTime();

      if (isNaN(scheduledMs)) return;

      const diffMs = now.getTime() - scheduledMs;

      // If scheduled time passed by more than 2 minutes before app was opened,
      // DO NOT show a notification late upon app entry! Mark silently.
      if (diffMs > 2 * 60 * 1000) {
        if (!firedSet.has(notifUniqueKey)) {
          saveFiredNotification(notifUniqueKey);
        }
        return;
      }

      // If current time is within 0 to 2 minutes of scheduled time while app is open
      if (diffMs >= 0 && diffMs <= 2 * 60 * 1000) {
        if (!firedSet.has(notifUniqueKey)) {
          const title = `${ev.icon || '📌'} ${ev.title}`;
          const isMainDay = ev.date === currentDateStr;
          const body = isMainDay
            ? `🎯 Today is Event Day! (${currentDateStr} @ ${scheduledTime})\n${ev.todoText || ''}`
            : `🔔 Reminder: Event scheduled for ${format(parseISO(ev.date), 'MMM d, yyyy')}\n${ev.todoText || ''}`;

          sendPwaNotification(title, {
            body,
            icon: '/icon.svg',
            tag: notifUniqueKey,
          });

          saveFiredNotification(notifUniqueKey);
          triggeredCount++;
        }
      }
    });
  });

  return triggeredCount;
}

export function syncEventsToServiceWorker() {
  if ('serviceWorker' in navigator) {
    const rawEvents = localStorage.getItem('tmd_calendar_events');
    let events: StoredEvent[] = [];
    if (rawEvents) {
      try {
        events = JSON.parse(rawEvents);
      } catch (e) {}
    }

    const sendMsg = (sw: ServiceWorker | null) => {
      if (sw) {
        sw.postMessage({
          type: 'SCHEDULE_EVENTS',
          events,
        });
      }
    };

    if (navigator.serviceWorker.controller) {
      sendMsg(navigator.serviceWorker.controller);
    } else {
      navigator.serviceWorker.ready.then((registration) => {
        sendMsg(registration.active);
      });
    }

    // Schedule exact Notification Triggers directly with OS Alarm Manager for all future events!
    const firedSet = getFiredNotifications();
    const nowMs = Date.now();

    events.forEach((ev) => {
      if (ev.completed) return;
      const targetDates = Array.from(new Set([ev.date, ...(ev.notificationDates || [])]));
      targetDates.forEach((dateStr) => {
        const scheduledTime = ev.notificationTime || '08:00';
        const notifUniqueKey = `${ev.id}_${dateStr}_${scheduledTime}`;
        const scheduledMs = new Date(`${dateStr}T${scheduledTime}:00`).getTime();

        if (!isNaN(scheduledMs) && scheduledMs > nowMs && !firedSet.has(notifUniqueKey)) {
          const title = `${ev.icon || '📌'} ${ev.title}`;
          const body = ev.date === dateStr
            ? `🎯 Today is Event Day! (${dateStr} @ ${scheduledTime})\n${ev.todoText || ''}`
            : `🔔 Reminder: Event scheduled for ${dateStr}\n${ev.todoText || ''}`;

          scheduleExactNotificationTrigger(title, {
            body,
            icon: '/icon.svg',
            tag: notifUniqueKey,
            scheduledTimeMs: scheduledMs,
          });
        }
      });
    });
  }
}

let schedulerTimerId: any = null;

export function startNotificationScheduler() {
  if (schedulerTimerId) return;

  // Run initial check
  checkAndTriggerDueEventNotifications();

  // Sync scheduled events to Service Worker for background notifications when app is closed/idle
  syncEventsToServiceWorker();

  // Register Periodic Background Sync if available
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.ready.then((registration: any) => {
      syncEventsToServiceWorker();
      if ('periodicSync' in registration) {
        try {
          registration.periodicSync.register('check-due-notifications', {
            minInterval: 15 * 60 * 1000,
          });
        } catch (error) {
          console.log('Periodic Background Sync error:', error);
        }
      }
    });
  }

  // Run check every 30 seconds
  schedulerTimerId = setInterval(() => {
    checkAndTriggerDueEventNotifications();
    syncEventsToServiceWorker();
  }, 30000);
}

export function stopNotificationScheduler() {
  if (schedulerTimerId) {
    clearInterval(schedulerTimerId);
    schedulerTimerId = null;
  }
}


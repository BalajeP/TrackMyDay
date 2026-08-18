import { precacheAndRoute } from 'workbox-precaching';

declare const self: ServiceWorkerGlobalScope & {
  __WB_MANIFEST: any;
};

// Precache static assets built by Vite
precacheAndRoute(self.__WB_MANIFEST || []);

interface ScheduledEvent {
  id: string;
  title: string;
  date: string; // 'yyyy-MM-dd'
  notificationDates?: string[];
  notificationTime?: string; // 'HH:mm'
  icon?: string;
  todoText?: string;
  completed?: boolean;
}

let storedEvents: ScheduledEvent[] = [];

// Load stored events from SW cache on activation
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.open('tmd-sw-events-v1').then(async (cache) => {
      const resp = await cache.match('/sw-scheduled-events.json');
      if (resp) {
        try {
          storedEvents = await resp.json();
        } catch (e) {
          console.error('[SW] Failed to parse cached events:', e);
        }
      }
    })
  );
});

// Helper to check and fire due notifications inside Service Worker
async function checkAndFireNotifications() {
  if (!storedEvents || storedEvents.length === 0) return;

  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const currentDateStr = `${year}-${month}-${day}`;

  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const currentTimeStr = `${hours}:${minutes}`;

  // Get fired notifications set from cache
  const cache = await caches.open('tmd-sw-events-v1');
  let firedKeys: string[] = [];
  const firedResp = await cache.match('/sw-fired-notifications.json');
  if (firedResp) {
    try {
      firedKeys = await firedResp.json();
    } catch (e) {}
  }
  const firedSet = new Set(firedKeys);

  for (const ev of storedEvents) {
    if (ev.completed) continue;

    const targetDates = Array.from(new Set([ev.date, ...(ev.notificationDates || [])]));
    if (!targetDates.includes(currentDateStr)) continue;

    const scheduledTime = ev.notificationTime || '08:00';
    if (currentTimeStr === scheduledTime) {
      const notifKey = `${ev.id}_${currentDateStr}_${scheduledTime}`;
      if (!firedSet.has(notifKey)) {
        const title = `${ev.icon || '📌'} ${ev.title}`;
        const isMainDay = ev.date === currentDateStr;
        const body = isMainDay
          ? `🎯 Today is Event Day! (${currentDateStr} @ ${scheduledTime})\n${ev.todoText || ''}`
          : `🔔 Reminder: Event scheduled for ${ev.date}\n${ev.todoText || ''}`;

        await self.registration.showNotification(title, {
          body,
          icon: '/icon.svg',
          badge: '/icon.svg',
          tag: notifKey,
          data: { url: '/' },
          vibrate: [200, 100, 200],
        } as NotificationOptions);

        firedSet.add(notifKey);
      }
    }
  }

  // Update fired keys in cache
  cache.put(
    '/sw-fired-notifications.json',
    new Response(JSON.stringify(Array.from(firedSet).slice(-500)), {
      headers: { 'content-type': 'application/json' },
    })
  );
}

// Receive updated events from main app thread
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SCHEDULE_EVENTS') {
    storedEvents = event.data.events || [];
    // Cache events in SW cache so they persist across SW restarts
    caches.open('tmd-sw-events-v1').then((cache) => {
      cache.put(
        '/sw-scheduled-events.json',
        new Response(JSON.stringify(storedEvents), {
          headers: { 'content-type': 'application/json' },
        })
      );
    });
    // Run an immediate check for due notifications
    event.waitUntil(checkAndFireNotifications());
  }
});

// Background Periodic Sync Handler (Periodic Background Sync API)
self.addEventListener('periodicsync' as any, (event: any) => {
  if (event.tag === 'check-due-notifications') {
    event.waitUntil(checkAndFireNotifications());
  }
});

// Push Notification Event Handler (Web Push API)
self.addEventListener('push', (event) => {
  event.waitUntil(checkAndFireNotifications());
});

// Notification Click Handler (opens/focuses the PWA app when notification is clicked)
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ('focus' in client) {
          return (client as WindowClient).focus();
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(event.notification.data?.url || '/');
      }
    })
  );
});

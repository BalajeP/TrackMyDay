// Simple service worker for PWA Lock-Screen & Push Notifications
self.addEventListener('install', (event) => {
  console.log('Service Worker installing.');
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  console.log('Service Worker activating.');
  event.waitUntil(clients.claim());
});

self.addEventListener('fetch', (event) => {
  // Let the browser handle all fetch requests
  // Workbox will handle caching via vite-plugin-pwa
});

// Handle Background Push Notifications (even when app is closed)
self.addEventListener('push', (event) => {
  let payload = { title: 'TrackMyDay Reminder 🔔', body: 'You have a scheduled event reminder!' };
  if (event.data) {
    try {
      payload = event.data.json();
    } catch (e) {
      payload.body = event.data.text();
    }
  }
  const options = {
    body: payload.body,
    icon: payload.icon || '/icon.svg',
    badge: payload.badge || '/icon.svg',
    vibrate: payload.vibrate || [200, 100, 200],
    data: payload.data || { url: '/' },
    tag: payload.tag || 'tmd-event-reminder',
    renotify: true,
  };
  event.waitUntil(self.registration.showNotification(payload.title, options));
});

// Handle Notification Click to focus or open app
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const urlToOpen = event.notification.data?.url || '/';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      for (let i = 0; i < windowClients.length; i++) {
        const client = windowClients[i];
        if (client.url === urlToOpen && 'focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(urlToOpen);
      }
    })
  );
});

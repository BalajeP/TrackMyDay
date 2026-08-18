// Utility helper for PWA Lock-Screen Notifications

export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (!('Notification' in window)) {
    console.warn('Notifications not supported in this browser.');
    return 'denied';
  }
  try {
    const permission = await Notification.requestPermission();
    return permission;
  } catch (err) {
    console.error('Error requesting notification permission:', err);
    return 'denied';
  }
}

export function getNotificationPermissionStatus(): NotificationPermission {
  if (!('Notification' in window)) return 'denied';
  return Notification.permission;
}

export async function sendPwaNotification(
  title: string,
  options?: {
    body?: string;
    icon?: string;
    badge?: string;
    tag?: string;
    data?: any;
    vibrate?: number[];
  }
): Promise<boolean> {
  if (!('Notification' in window)) return false;

  if (Notification.permission !== 'granted') {
    const permission = await requestNotificationPermission();
    if (permission !== 'granted') return false;
  }

  const notificationOptions: NotificationOptions = {
    body: options?.body || 'TrackMyDay Reminder',
    icon: options?.icon || '/icon.svg',
    badge: options?.badge || '/icon.svg',
    tag: options?.tag || 'tmd-calendar-event',
    data: options?.data || { url: window.location.href },
    vibrate: options?.vibrate || [200, 100, 200],
  };

  try {
    // Try via Service Worker Registration for native lock-screen notifications on mobile PWA
    if ('serviceWorker' in navigator) {
      const registration = await navigator.serviceWorker.ready;
      if (registration && registration.showNotification) {
        await registration.showNotification(title, notificationOptions);
        return true;
      }
    }
  } catch (e) {
    console.warn('Service Worker notification failed, falling back to Web Notification:', e);
  }

  try {
    // Fallback to standard Web Notification
    new Notification(title, notificationOptions);
    return true;
  } catch (err) {
    console.error('Failed to trigger notification:', err);
    return false;
  }
}

export async function scheduleExactNotificationTrigger(
  title: string,
  options: {
    body?: string;
    icon?: string;
    badge?: string;
    tag?: string;
    scheduledTimeMs: number;
    data?: any;
  }
): Promise<boolean> {
  if (options.scheduledTimeMs <= Date.now()) return false;
  if (!('serviceWorker' in navigator)) return false;

  try {
    const registration = await navigator.serviceWorker.ready;
    if (registration && registration.showNotification) {
      if ('showTrigger' in Notification.prototype && (window as any).TimestampTrigger) {
        const TimestampTrigger = (window as any).TimestampTrigger;
        await registration.showNotification(title, {
          body: options.body || 'TrackMyDay Reminder',
          icon: options.icon || '/icon.svg',
          badge: options.badge || '/icon.svg',
          tag: options.tag,
          data: options.data || { url: '/' },
          vibrate: [200, 100, 200],
          showTrigger: new TimestampTrigger(options.scheduledTimeMs),
        } as any);
        return true;
      }
    }
  } catch (err) {
    console.warn('TimestampTrigger scheduling error:', err);
  }
  return false;
}


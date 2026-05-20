// sw.js - Nile Emergency Service Worker
// Handles background push notifications for the Responder Dashboard

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(clients.claim());
});

// Listen for push events from the server
self.addEventListener('push', (event) => {
  const data = event.data ? event.data.json() : {};
  const title = data.title || '🚨 New Emergency Alert';
  const options = {
    body: data.body || 'A new SOS has been triggered on campus.',
    icon: '/favicon.ico',
    badge: '/favicon.ico',
    tag: data.tag || 'nile-emergency',
    requireInteraction: true, // Keep notification visible until user interacts
    vibrate: [200, 100, 200, 100, 200],
    data: { url: data.url || '/' },
    actions: [
      { action: 'accept', title: '✅ Open Dashboard' },
      { action: 'dismiss', title: '✖ Dismiss' },
    ],
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

// Handle notification click
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  if (event.action === 'dismiss') return;

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      if (clientList.length > 0) {
        return clientList[0].focus();
      }
      return clients.openWindow(event.notification.data.url || '/');
    })
  );
});

// Triggered programmatically from the app (no server push needed)
// The app calls registration.showNotification() directly via JS
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SHOW_NOTIFICATION') {
    const { title, body, severity } = event.data;
    const severityEmoji = { Critical: '🔴', High: '🟠', Medium: '🟡', Low: '🟢' };
    self.registration.showNotification(
      `${severityEmoji[severity] || '🚨'} ${title}`,
      {
        body,
        icon: '/favicon.ico',
        tag: 'nile-sos',
        requireInteraction: true,
        vibrate: [300, 100, 300],
      }
    );
  }
});

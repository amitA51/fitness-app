// ============================================================================
// Web Push handler — imported into the generated Workbox service worker via
// vite-plugin-pwa `workbox.importScripts`. Displays coach push notifications
// when the app is closed and focuses/opens the app on click.
// Payload (from the coach-push-send edge function): { title, body, url }
// ============================================================================
/* global self, clients */

self.addEventListener('push', (event) => {
  let data = { title: 'SparkOS', body: '', url: '/' };
  try {
    if (event.data) data = { ...data, ...event.data.json() };
  } catch {
    if (event.data) data.body = event.data.text();
  }
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: '/pwa-192x192.png',
      badge: '/favicon-64.png',
      dir: 'rtl',
      lang: 'he',
      data: { url: data.url || '/' },
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || '/';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      for (const client of list) {
        if ('focus' in client) {
          client.navigate(url);
          return client.focus();
        }
      }
      return clients.openWindow(url);
    })
  );
});

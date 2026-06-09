// ============================================================================
// Web Push handler — imported into the generated Workbox service worker via
// vite-plugin-pwa `workbox.importScripts`. Displays coach push notifications
// when the app is closed and focuses/opens the app on click.
// Payload (coach-push-send / reminders-dispatch): { title, body, url, tag? }
// `tag` lets a server push coalesce with a client-side local notification for
// the same logical event (e.g. a reminder) instead of showing twice.
// ============================================================================
/* global self, clients */

self.addEventListener('push', (event) => {
  let data = { title: 'SparkOS', body: '', url: '/', tag: undefined };
  try {
    if (event.data) data = { ...data, ...event.data.json() };
  } catch {
    if (event.data) data.body = event.data.text();
  }
  const options = {
    body: data.body,
    icon: '/pwa-192x192.png',
    badge: '/favicon-64.png',
    dir: 'rtl',
    lang: 'he',
    data: { url: data.url || '/' },
  };
  if (data.tag) options.tag = data.tag;
  event.waitUntil(self.registration.showNotification(data.title, options));
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

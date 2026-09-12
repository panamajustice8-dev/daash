// Daash service worker — caches the app shell so it opens instantly and
// works offline, and satisfies the "installable PWA" requirement.
const CACHE_NAME = 'daash-cache-v1';
const APP_SHELL = [
  './',
  './index.html',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))
    )
  );
  self.clients.claim();
});

// Network-first for everything so logged-in users always get fresh order/menu
// data from Supabase; falls back to the cached app shell when offline.
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        const copy = response.clone();
        caches.open(CACHE_NAME).then((cache) => {
          // Only cache same-origin app-shell files, not Supabase API calls.
          if (event.request.url.startsWith(self.location.origin)) {
            cache.put(event.request, copy);
          }
        });
        return response;
      })
      .catch(() => caches.match(event.request).then((cached) => cached || caches.match('./index.html')))
  );
});

// ===== Firebase Cloud Messaging (background push) =====
// This runs when the app is closed or backgrounded — it's what lets a
// notification show up even if nobody has Daash open.
importScripts('https://www.gstatic.com/firebasejs/10.14.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.14.1/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: "AIzaSyDTkFMjAq7FlYLDGR4-atGSej_Wvud3VsU",
  authDomain: "daash-be383.firebaseapp.com",
  projectId: "daash-be383",
  storageBucket: "daash-be383.firebasestorage.app",
  messagingSenderId: "424694465239",
  appId: "1:424694465239:web:3f66e6b3980cda3599a692"
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  const title = (payload.notification && payload.notification.title) || 'Daash';
  const options = {
    body: (payload.notification && payload.notification.body) || '',
    icon: './icons/icon-192.png',
    badge: './icons/icon-192.png'
  };
  self.registration.showNotification(title, options);
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      for (const client of windowClients) {
        if ('focus' in client) return client.focus();
      }
      if (clients.openWindow) return clients.openWindow('./index.html');
    })
  );
});

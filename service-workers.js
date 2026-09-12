// Daash service worker — caches the app shell so it opens instantly and
// works offline, and satisfies the "installable PWA" requirement.
const CACHE_NAME = 'daash-cache-v1';
const APP_SHELL = [
  './',
  './daash.html',
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
      .catch(() => caches.match(event.request).then((cached) => cached || caches.match('./daash.html')))
  );
});

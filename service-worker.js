const SCOPE_URL = new URL(self.registration.scope);
const CACHE_PREFIX = `age-notebook-${encodeURIComponent(SCOPE_URL.href)}-`;
const CACHE = `${CACHE_PREFIX}v4`;
const FILES = [
  './',
  './index.html',
  './styles.css',
  './app.js',
  './age-logic.js',
  './calendar-data.js',
  './profiles.js',
  './pwa-status.js',
  './manifest.webmanifest',
  './assets/icon.svg',
  './assets/icon-192.png',
  './assets/icon-512.png',
  './assets/apple-touch-icon.png'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE)
      .then(cache => cache.addAll(FILES))
      // The v3 page reloads on controllerchange, so activate v4 for that migration.
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(key => key.startsWith(CACHE_PREFIX) && key !== CACHE)
          .map(key => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('message', event => {
  if (event.data?.type === 'SKIP_WAITING') event.waitUntil(self.skipWaiting());
});

self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET' || url.origin !== SCOPE_URL.origin ||
      !url.pathname.startsWith(SCOPE_URL.pathname)) return;

  event.respondWith(
    caches.open(CACHE).then(async cache => {
      const hit = await cache.match(event.request);
      if (hit) return hit;
      try {
        return await fetch(event.request);
      } catch (error) {
        if (event.request.mode === 'navigate') {
          const page = await cache.match(new URL('./index.html', SCOPE_URL).href);
          if (page) return page;
        }
        throw error;
      }
    })
  );
});

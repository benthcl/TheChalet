/* The Chalet — minimal service worker for install + app-shell offline. */
const CACHE = 'chalet-shell-v1';

const SHELL = [
  './',
  './index.html',
  './style.css',
  './manifest.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './js/main.js',
  './js/config.js',
  './js/home.js',
  './js/calendar.js',
  './js/issues.js',
  './js/stock.js',
  './js/weather.js',
  './js/notify.js',
  './js/emailTemplate.js',
  './js/houseChecklist.js'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE)
      .then((cache) => cache.addAll(SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // Never cache Firebase / third-party APIs — always network.
  if (url.origin !== self.location.origin) return;

  // App shell: network first, fall back to cache (stale ok when offline).
  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response && response.ok) {
          const copy = response.clone();
          caches.open(CACHE).then((cache) => cache.put(request, copy));
        }
        return response;
      })
      .catch(() =>
        caches.match(request).then((cached) => {
          if (cached) return cached;
          if (request.mode === 'navigate') return caches.match('./index.html');
          return undefined;
        })
      )
  );
});

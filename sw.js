// Service Worker for PWA — basic offline cache
const CACHE_NAME = 'stock-treemap-v1';
const ASSETS = [
  './',
  './index.html',
  './style.css',
  './app.js',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS).catch(() => {}))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (e) => {
  const { request } = e;
  // API 요청은 절대 캐시하지 않음 (실시간 시세니까)
  if (request.url.includes('/price') || request.url.includes('/chart') || request.url.includes('/health')) {
    return;
  }
  // HTML/CSS/JS만 캐시 우선
  e.respondWith(
    caches.match(request).then((cached) => cached || fetch(request).catch(() => caches.match('./index.html')))
  );
});

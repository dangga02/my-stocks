// Service Worker — 캐시 비활성화 (강제 새로고침용)
// 이 파일을 GitHub에 올리면 브라우저가 캐시를 자동으로 비웁니다.

self.addEventListener('install', (e) => {
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  // 캐시 사용 안 함 - 항상 네트워크에서 가져옴
  e.respondWith(fetch(e.request).catch(() => new Response('offline')));
});

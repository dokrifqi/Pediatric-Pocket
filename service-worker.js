/**
 * SERVICE WORKER — Catatan Pediatri
 * Strategi: Cache-First (offline-first)
 * Versi: 2.1.0
 */

const CACHE_VERSION = 'catatan-pediatri-v2.1.0';
const OFFLINE_URL   = '/neonatal.html';

const PRECACHE_URLS = [
  '/neonatal.html',
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png',
  '/apple-touch-icon.png',
];

self.addEventListener('install', function(event) {
  event.waitUntil(
    caches.open(CACHE_VERSION).then(function(cache) {
      return Promise.allSettled(
        PRECACHE_URLS.map(url =>
          cache.add(url).catch(err => console.warn('Cache miss:', url, err))
        )
      );
    }).then(function() {
      return self.skipWaiting();
    })
  );
});

self.addEventListener('activate', function(event) {
  event.waitUntil(
    caches.keys().then(function(keys) {
      return Promise.all(
        keys.filter(key => key !== CACHE_VERSION)
            .map(key => caches.delete(key))
      );
    }).then(function() {
      return self.clients.claim();
    })
  );
});

self.addEventListener('fetch', function(event) {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    caches.match(event.request).then(function(cachedResponse) {
      if (cachedResponse) {
        event.waitUntil(
          fetch(event.request).then(function(fresh) {
            if (fresh && fresh.status === 200) {
              return caches.open(CACHE_VERSION).then(cache => {
                cache.put(event.request, fresh.clone());
              });
            }
          }).catch(() => {})
        );
        return cachedResponse;
      }
      return fetch(event.request).then(function(response) {
        if (!response || response.status !== 200) return response;
        var toCache = response.clone();
        caches.open(CACHE_VERSION).then(cache => cache.put(event.request, toCache));
        return response;
      }).catch(function() {
        if (event.request.destination === 'document') {
          return caches.match(OFFLINE_URL);
        }
        return new Response('Offline', { status: 503 });
      });
    })
  );
});

self.addEventListener('message', function(event) {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

/**
 * SERVICE WORKER — Catatan Pediatri
 * ════════════════════════════════════════════════════════════
 * Strategi: Cache-First (offline-first)
 * Versi: 2.0.0
 * ════════════════════════════════════════════════════════════
 */

const CACHE_VERSION = 'catatan-pediatri-v2.0.0';
const OFFLINE_URL   = './neonatal.html';

/** File yang di-cache saat install */
const PRECACHE_URLS = [
  './neonatal.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  './apple-touch-icon.png',
  // Google Fonts — cache bila tersedia
];

// ── INSTALL: cache semua file penting ─────────────────────
self.addEventListener('install', function(event) {
  event.waitUntil(
    caches.open(CACHE_VERSION).then(function(cache) {
      // Cache setiap URL satu per satu agar tidak gagal semua bila satu error
      return Promise.allSettled(
        PRECACHE_URLS.map(url =>
          cache.add(url).catch(err => console.warn('Cache miss:', url, err))
        )
      );
    }).then(function() {
      // Aktifkan segera tanpa menunggu tab lama tutup
      return self.skipWaiting();
    })
  );
});

// ── ACTIVATE: hapus cache lama ────────────────────────────
self.addEventListener('activate', function(event) {
  event.waitUntil(
    caches.keys().then(function(keys) {
      return Promise.all(
        keys.filter(key => key !== CACHE_VERSION)
            .map(key => {
              console.log('[SW] Deleting old cache:', key);
              return caches.delete(key);
            })
      );
    }).then(function() {
      return self.clients.claim();
    })
  );
});

// ── FETCH: cache-first, fallback ke network ───────────────
self.addEventListener('fetch', function(event) {
  // Hanya handle GET requests
  if (event.request.method !== 'GET') return;

  // Jangan intercept external requests (WHO, Google Fonts, dll)
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) {
    // External: network-first dengan timeout
    return;
  }

  event.respondWith(
    caches.match(event.request).then(function(cachedResponse) {
      if (cachedResponse) {
        // Serve dari cache
        // Background update: fetch fresh version untuk next time
        event.waitUntil(
          fetch(event.request).then(function(fresh) {
            if (fresh && fresh.status === 200) {
              return caches.open(CACHE_VERSION).then(cache => {
                cache.put(event.request, fresh.clone());
              });
            }
          }).catch(() => { /* ignore network errors */ })
        );
        return cachedResponse;
      }

      // Tidak ada di cache → fetch dari network
      return fetch(event.request).then(function(response) {
        if (!response || response.status !== 200) return response;
        // Cache response baru
        var toCache = response.clone();
        caches.open(CACHE_VERSION).then(cache => cache.put(event.request, toCache));
        return response;
      }).catch(function() {
        // Offline dan tidak ada cache → serve offline page
        if (event.request.destination === 'document') {
          return caches.match(OFFLINE_URL);
        }
        return new Response('Offline', { status: 503 });
      });
    })
  );
});

// ── MESSAGE: handle skip waiting dari app ─────────────────
self.addEventListener('message', function(event) {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

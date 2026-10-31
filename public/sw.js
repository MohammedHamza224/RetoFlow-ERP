/**
 * RestoFlow Production Service Worker (PWA)
 * - Versioned static shell caching
 * - Automatic cleanup of outdated caches
 * - Strict exclusion of all Supabase, Auth, RPC, Edge Functions, and non-GET requests
 * - Honest offline fallback for navigation requests when network is unavailable
 */

const CACHE_VERSION = 'restoflow-static-v1.3.0';
const OFFLINE_URL = '/offline.html';

const PRECACHE_ASSETS = [
  '/',
  '/index.html',
  '/offline.html',
  '/manifest.json',
  '/favicon.svg',
  '/icon-192.png',
  '/icon-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_VERSION)
      .then((cache) => cache.addAll(PRECACHE_ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== CACHE_VERSION)
            .map((oldKey) => caches.delete(oldKey))
        )
      )
      .then(() => self.clients.claim())
  );
});

/**
 * Determine whether a request must NEVER be cached (sensitive API, database, auth, or mutations).
 */
function isSensitiveOrApiRequest(url, request) {
  if (request.method !== 'GET') return true;
  const href = url.href.toLowerCase();
  if (
    href.includes('supabase.co') ||
    href.includes('/rest/v1') ||
    href.includes('/auth/v1') ||
    href.includes('/functions/v1') ||
    href.includes('/realtime/v1') ||
    href.includes('/storage/v1') ||
    url.pathname.startsWith('/api/')
  ) {
    return true;
  }
  return false;
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // 1. Strictly bypass non-GET, cross-origin APIs, and all Supabase endpoints
  if (isSensitiveOrApiRequest(url, request)) {
    return;
  }

  // 2. Only handle http/https requests
  if (!url.protocol.startsWith('http')) {
    return;
  }

  // 3. Navigation requests (HTML): Network-first, fallback to cached index.html or offline.html
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response && response.status === 200) {
            const copy = response.clone();
            caches.open(CACHE_VERSION).then((cache) => cache.put('/index.html', copy));
          }
          return response;
        })
        .catch(async () => {
          const cache = await caches.open(CACHE_VERSION);
          const cachedIndex = await cache.match('/index.html');
          if (cachedIndex) return cachedIndex;
          const cachedOffline = await cache.match(OFFLINE_URL);
          return cachedOffline || Response.error();
        })
    );
    return;
  }

  // 4. Same-origin static assets (JS, CSS, SVG, PNG, fonts): Stale-While-Revalidate
  if (url.origin === self.location.origin) {
    event.respondWith(
      caches.match(request).then((cachedResponse) => {
        const networkFetch = fetch(request)
          .then((networkResponse) => {
            if (
              networkResponse &&
              networkResponse.status === 200 &&
              networkResponse.type === 'basic'
            ) {
              const responseClone = networkResponse.clone();
              caches.open(CACHE_VERSION).then((cache) => {
                cache.put(request, responseClone);
              });
            }
            return networkResponse;
          })
          .catch(() => cachedResponse);

        return cachedResponse || networkFetch;
      })
    );
  }
});

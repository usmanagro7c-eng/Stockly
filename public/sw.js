// Stockly Service Worker — offline-first, app shell caching
const CACHE_NAME = 'stockly-v8';
const MAX_CACHED_ENTRIES = 60;
const PRECACHE_URLS = [
  '/',
  '/index.html',
  '/manifest.webmanifest',
  '/icons/icon-192.png',
  '/icons/apple-touch-icon.png',
];

// Install: precache app shell
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE_URLS).catch(() => undefined))
      .then(() => self.skipWaiting()),
  );
});

// Activate: drop caches from previous versions
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

/**
 * Cap what we keep.
 */
async function trimCache(cache) {
  try {
    const keys = await cache.keys();
    if (keys.length <= MAX_CACHED_ENTRIES) return;
    await Promise.all(keys.slice(0, keys.length - MAX_CACHED_ENTRIES).map((k) => cache.delete(k)));
  } catch {
    // ignore
  }
}

async function cachePut(request, response) {
  if (!response || !response.ok) return response;
  try {
    const cache = await caches.open(CACHE_NAME);
    await cache.put(request, response.clone());
    await trimCache(cache);
  } catch {
    // ignore
  }
  return response;
}

// Fetch: network-first for navigation, stale-while-revalidate for assets
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Only handle same-origin GET requests
  if (request.method !== 'GET' || url.origin !== location.origin) return;

  const isNavigation = request.mode === 'navigate';
  const isAsset = ['style', 'script', 'image', 'font', 'manifest'].includes(request.destination);

  if (isNavigation) {
    // Navigation: network-first, fallback to cached app shell or index.html
    event.respondWith(
      fetch(request)
        .then((response) => cachePut(request, response))
        .catch(async () => {
          const cached = (await caches.match('/')) || (await caches.match('/index.html'));
          if (cached) return cached;
          return new Response('<!DOCTYPE html><html><body><h1>Stockly Offline</h1><p>Please check your connection and reload.</p></body></html>', {
            status: 200,
            headers: { 'Content-Type': 'text/html; charset=utf-8' },
          });
        }),
    );
    return;
  }

  if (isAsset) {
    // Assets: serve from cache immediately, refresh in the background
    event.respondWith(
      (async () => {
        const cached = await caches.match(request);
        if (cached) {
          fetch(request)
            .then((res) => cachePut(request, res))
            .catch(() => undefined);
          return cached;
        }
        try {
          const networkRes = await fetch(request);
          return await cachePut(request, networkRes);
        } catch {
          return new Response('', { status: 408, statusText: 'Request Timeout' });
        }
      })(),
    );
    return;
  }

  // Other: network-first, cache fallback
  event.respondWith(
    fetch(request)
      .then((response) => cachePut(request, response))
      .catch(async () => {
        const cached = await caches.match(request);
        if (cached) return cached;
        return new Response('', { status: 408, statusText: 'Network error' });
      }),
  );
});
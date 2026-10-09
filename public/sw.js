// Stockly Service Worker — offline-first, app shell caching
const CACHE_NAME = 'stockly-v2';
const MAX_CACHED_ENTRIES = 60;
const PRECACHE_URLS = [
  '/',
  '/manifest.webmanifest',
  '/icons/icon-192.png',
  '/icons/apple-touch-icon.png',
];

// Install: precache app shell
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE_URLS))
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
 * Cap what we keep. The cache used to grow without bound, which bloated storage
 * inside the app's WebView and slowed every navigation down.
 */
async function trimCache(cache) {
  const keys = await cache.keys();
  if (keys.length <= MAX_CACHED_ENTRIES) return;
  await Promise.all(keys.slice(0, keys.length - MAX_CACHED_ENTRIES).map((k) => cache.delete(k)));
}

async function cachePut(request, response) {
  if (!response || !response.ok) return response;
  const cache = await caches.open(CACHE_NAME);
  await cache.put(request, response.clone());
  await trimCache(cache);
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
    // Navigation: network-first, fallback to cached app shell
    event.respondWith(
      fetch(request)
        .then((response) => cachePut(request, response))
        .catch(() => caches.match('/')),
    );
    return;
  }

  if (isAsset) {
    // Assets: serve from cache immediately, refresh in the background
    event.respondWith(
      caches.match(request).then((cached) => {
        const refreshed = fetch(request)
          .then((response) => cachePut(request, response))
          .catch(() => cached);
        return cached || refreshed;
      }),
    );
    return;
  }

  // Other: network-first, cache fallback
  event.respondWith(
    fetch(request)
      .then((response) => cachePut(request, response))
      .catch(() => caches.match(request)),
  );
});
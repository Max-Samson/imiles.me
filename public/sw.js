const CACHE_VERSION = 'v5';
const STATIC_CACHE = `static-${CACHE_VERSION}`;
const IMAGES_CACHE = `images-${CACHE_VERSION}`;
const ACTIVE_CACHES = new Set([STATIC_CACHE, IMAGES_CACHE]);
const OWNED_CACHE_PATTERN = /^(static|pages|images)-v\d+$/;

const storeSuccessfulResponse = (cache, request, response) => {
  if (!response.ok) return Promise.resolve();
  return cache.put(request, response.clone());
};

self.addEventListener('install', (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    Promise.all([
      caches.keys().then((keys) =>
        Promise.all(
          keys
            .filter((key) => OWNED_CACHE_PATTERN.test(key) && !ACTIVE_CACHES.has(key))
            .map((key) => caches.delete(key))
        )
      ),
      self.clients.claim(),
    ])
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  if (request.method !== 'GET' || url.origin !== self.location.origin) return;

  // Let the browser handle every document request, including trailing-slash redirects.
  // An offline fallback must never replace a valid site navigation.
  if (request.mode === 'navigate' || request.destination === 'document') return;

  // Hashed Astro assets are immutable and safe to serve cache-first.
  if (url.pathname.startsWith('/_astro/')) {
    event.respondWith(
      caches.open(STATIC_CACHE).then(async (cache) => {
        const cached = await cache.match(request);
        if (cached) return cached;

        const response = await fetch(request);
        await storeSuccessfulResponse(cache, request, response);
        return response;
      })
    );
    return;
  }

  // Images can render immediately from cache while a fresh copy is requested.
  if (request.destination === 'image') {
    const cachePromise = caches.open(IMAGES_CACHE);
    const fetchPromise = Promise.all([cachePromise, fetch(request)]).then(
      async ([cache, response]) => {
        await storeSuccessfulResponse(cache, request, response);
        return response;
      }
    );

    event.waitUntil(fetchPromise.then(() => undefined).catch(() => undefined));
    event.respondWith(
      cachePromise.then(async (cache) => {
        const cached = await cache.match(request);
        return cached ?? fetchPromise;
      })
    );
  }
});

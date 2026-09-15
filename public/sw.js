const CACHE_VERSION = 'v3';
const STATIC_CACHE = `static-${CACHE_VERSION}`;
const PAGES_CACHE = `pages-${CACHE_VERSION}`;
const IMAGES_CACHE = `images-${CACHE_VERSION}`;

const PRECACHE_URLS = ['/', '/offline'];

const storeSuccessfulResponse = (cache, request, response) => {
  if (!response.ok) return Promise.resolve();
  return cache.put(request, response.clone());
};

// Install: precache essential resources
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => cache.addAll(PRECACHE_URLS))
  );
  self.skipWaiting();
});

// Activate: clean old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== STATIC_CACHE && key !== PAGES_CACHE && key !== IMAGES_CACHE)
          .map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

// Fetch: apply caching strategies
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  if (request.method !== 'GET') return;

  // Hashed Astro assets: cache-first (immutable filenames)
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

  // Images: stale-while-revalidate
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
    return;
  }

  // HTML pages: network-first with cache fallback, then the offline page
  if (request.mode === 'navigate' || request.headers.get('accept')?.includes('text/html')) {
    const cachePromise = caches.open(PAGES_CACHE);
    const networkPromise = fetch(request).then(async (response) => {
      if (!response.ok) throw new Error(`Navigation returned ${response.status}`);

      // Buffer SSR output so a stream that fails after its 200 headers can use the fallback path.
      const body = await response.arrayBuffer();
      return new Response(body, {
        status: response.status,
        statusText: response.statusText,
        headers: response.headers,
      });
    });
    event.waitUntil(
      Promise.all([cachePromise, networkPromise])
        .then(([cache, response]) => storeSuccessfulResponse(cache, request, response))
        .catch(() => undefined)
    );
    event.respondWith(
      cachePromise.then(async (cache) => {
        try {
          return await networkPromise;
        } catch {
          return (
            (await cache.match(request)) ?? (await caches.match('/offline')) ?? Response.error()
          );
        }
      })
    );
    return;
  }
});

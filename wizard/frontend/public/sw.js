const CACHE_NAME = 'wizard-v3';
const STATIC_ASSETS = ['/'];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Skip non-http
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return;

  // Skip Supabase API calls - always network
  if (url.hostname.includes('supabase.co') || url.hostname.includes('supabase.in')) return;

  // For JS/CSS assets (hashed filenames) - cache first
  if (url.pathname.match(/\/assets\/.+\.(js|css)$/)) {
    event.respondWith(
      caches.match(event.request).then((cached) => {
        if (cached) return cached;
        return fetch(event.request).then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return response;
        });
      })
    );
    return;
  }

  // For HTML (index.html, /) - network first, fallback to cache
  // This ensures F5 always gets fresh HTML
  if (event.request.mode === 'navigate' || url.pathname === '/' || url.pathname.endsWith('.html')) {
    event.respondWith(
      fetch(event.request).then((response) => {
        if (response.ok) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        }
        return response;
      }).catch(() => caches.match('/') || caches.match('/index.html'))
    );
    return;
  }

  // Everything else - network first
  event.respondWith(
    fetch(event.request).catch(() => caches.match(event.request))
  );
});

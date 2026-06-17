const CACHE_NAME = 'wizard-v2';
const STATIC_ASSETS = ['/', '/index.html', '/manifest.json'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Only cache http/https requests - ignore chrome-extension, data, etc.
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return;

  // Network first for Supabase API calls
  if (url.hostname.includes('supabase.co') || url.hostname.includes('supabase.in')) return;

  // Cache first for static assets
  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request).then((response) => {
        if (response.ok && event.request.method === 'GET' &&
            (url.protocol === 'http:' || url.protocol === 'https:')) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            try { cache.put(event.request, clone); } catch (e) {}
          });
        }
        return response;
      }).catch(() => caches.match('/index.html'));
    })
  );
});

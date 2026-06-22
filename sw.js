// Voice Calculator — Service Worker
// Phase 2: PWA offline support
// Caches the app shell + CDN dependencies for offline use.

const CACHE_NAME = 'voice-calc-v3-2';
const CDN_URLS = [
  'https://unpkg.com/react@18/umd/react.development.js',
  'https://unpkg.com/react-dom@18/umd/react-dom.development.js',
  'https://unpkg.com/@babel/standalone/babel.min.js',
  'https://fonts.googleapis.com/css2?family=DM+Mono:wght@400;500&family=DM+Sans:wght@400;500;700&family=Share+Tech+Mono&family=Rajdhani:wght@500;700&display=swap',
];

// Install: cache the app shell and CDN dependencies
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(CDN_URLS);
    })
  );
  // Activate immediately — don't wait for old tabs to close
  self.skipWaiting();
});

// Activate: clean old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      );
    })
  );
  // Take control of all clients immediately
  self.clients.claim();
});

// Fetch: network-first for the HTML, cache-first for CDN assets
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Never cache speech recognition API calls or analytics
  if (url.pathname.includes('speech') || url.pathname.includes('google.com')) {
    return; // let browser handle normally
  }

  // CDN assets: cache-first (they rarely change)
  if (CDN_URLS.some((cdn) => url.href.startsWith(cdn.split('?')[0]))) {
    event.respondWith(
      caches.match(event.request).then((cached) => {
        return cached || fetch(event.request).then((response) => {
          return caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, response.clone());
            return response;
          });
        });
      })
    );
    return;
  }

  // HTML and everything else: network-first, fall back to cache
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // Cache successful responses
        const cloned = response.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(event.request, cloned);
        });
        return response;
      })
      .catch(() => {
        // Offline: serve from cache
        return caches.match(event.request).then((cached) => {
          return cached || new Response(
            '<html><body style="background:#0d0d0f;color:#f0f0f8;font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;text-align:center"><div><h1>📡 Offline</h1><p>Voice Calculator needs internet for speech recognition.</p><p style="color:#8b949e">Type your math or reconnect to use voice.</p></div></body></html>',
            { headers: { 'Content-Type': 'text/html' }, status: 503 }
          );
        });
      })
  );
});

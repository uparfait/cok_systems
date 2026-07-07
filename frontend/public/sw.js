const CACHE_NAME = 'cok-systems-v17';
const STATIC_CACHE = 'cok-systems-static-v17';
const DYNAMIC_CACHE = 'cok-systems-dynamic-v17';

// Resources to cache immediately
const STATIC_ASSETS = [
  '/',
  '/manifest.json',
  '/LOGO_COK.png',
  '/cok_hall.jpg',
  '/vite.svg',
  '/LOGO_COK_report.png'
];

// Install event - cache static assets
self.addEventListener('install', (event) => {
  console.log('[SW] Installing service worker...');
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then((cache) => {
        console.log('[SW] Caching static assets...');
        return cache.addAll(STATIC_ASSETS);
      })
      .then(() => {
        return self.skipWaiting();
      })
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating service worker...');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== STATIC_CACHE && cacheName !== DYNAMIC_CACHE) {
            console.log('[SW] Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      return self.clients.claim();
    })
  );
});

// Fetch event - serve cached content when offline
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip cross-origin requests
  if (url.origin !== location.origin) {
    return;
  }

  // Handle API requests differently
  if (url.pathname.startsWith('/cok/api/')) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          // Don't cache API responses
          return response;
        })
        .catch(() => {
          // Return offline response for API calls
          return new Response(JSON.stringify({
            success: false,
            message: 'You are currently offline. Please check your internet connection.',
            offline: true
          }), {
            status: 503,
            headers: { 'Content-Type': 'application/json' }
          });
        })
    );
    return;
  }

  // Handle static assets and pages
  event.respondWith(
    caches.match(request)
      .then((cachedResponse) => {
        if (cachedResponse) {
          return cachedResponse;
        }

        return fetch(request)
          .then((response) => {
            // Cache successful GET requests for static assets
            if (request.method === 'GET' &&
                response.status === 200 &&
                (request.destination === 'document' ||
                 request.destination === 'style' ||
                 request.destination === 'script' ||
                 request.destination === 'image' ||
                 request.destination === 'font')) {
              const responseClone = response.clone();
              caches.open(DYNAMIC_CACHE)
                .then((cache) => {
                  cache.put(request, responseClone);
                });
            }
            return response;
          })
          .catch(() => {
            // Return offline page for navigation requests
            if (request.mode === 'navigate') {
              return caches.match('/').then((cachedResponse) => {
                return cachedResponse || new Response('Offline - Please check your internet connection.', {
                  status: 503,
                  headers: { 'Content-Type': 'text/plain' }
                });
              });
            }
            return new Response('Offline - Content not available.', {
              status: 503,
              headers: { 'Content-Type': 'text/plain' }
            });
          });
      })
  );
});

// Message event - handle messages from the main thread
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
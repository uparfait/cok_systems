const APP_VERSION = '1.0.11';

const CACHE_NAME = `cok-systems-v${APP_VERSION}`;
const STATIC_CACHE = `cok-systems-static-v${APP_VERSION}`;
const DYNAMIC_CACHE = `cok-systems-dynamic-v${APP_VERSION}`;

const CURRENT_CACHE_NAMES = [STATIC_CACHE, DYNAMIC_CACHE];

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
  console.log(`[SW] Installing service worker version ${APP_VERSION}...`);
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then((cache) => {
        console.log(`[SW] Caching static assets for version ${APP_VERSION}...`);
        return cache.addAll(STATIC_ASSETS);
      })
      .then(() => {
        console.log(`[SW] Service worker v${APP_VERSION} installed, skipping waiting`);
        return self.skipWaiting();
      })
      .catch((err) => {
        console.error(`[SW] Failed to install service worker v${APP_VERSION}:`, err);
        throw err;
      })
  );
});

// Activate event - clean up ALL old version caches
self.addEventListener('activate', (event) => {
  console.log(`[SW] Activating service worker version ${APP_VERSION}...`);
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      const deletePromises = cacheNames.map((cacheName) => {
        if (!CURRENT_CACHE_NAMES.includes(cacheName)) {
          console.log(`[SW] Deleting old cache from previous version: ${cacheName}`);
          return caches.delete(cacheName);
        }
      });
      return Promise.all(deletePromises);
    }).then(() => {
      console.log(`[SW] Service worker v${APP_VERSION} activated, claiming clients`);
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
  if (url.pathname.includes('/cok/api/')) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          return response;
        })
        .catch(() => {
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
  const data = event.data;
  
  if (!data || typeof data !== 'object') return;

  switch (data.type) {
    case 'SKIP_WAITING':
      console.log(`[SW] Received SKIP_WAITING command for version ${APP_VERSION}`);
      self.skipWaiting();
      break;

    case 'CLEAR_CACHES':
      console.log(`[SW] Received CLEAR_CACHES command for version ${APP_VERSION}`);
      event.waitUntil(
        caches.keys().then((cacheNames) => {
          console.log(`[SW] Clearing all caches:`, cacheNames);
          return Promise.all(
            cacheNames.map((cacheName) => {
              console.log(`[SW] Deleting cache: ${cacheName}`);
              return caches.delete(cacheName);
            })
          );
        }).then(() => {
          console.log(`[SW] All caches cleared for version ${APP_VERSION}`);
          return self.clients.claim();
        })
      );
      break;

    case 'GET_VERSION':
      if (event.ports && event.ports[0]) {
        event.ports[0].postMessage({ version: APP_VERSION });
      }
      break;

    default:
      break;
  }
});

console.log(`[SW] Service worker loaded, version: ${APP_VERSION}`);

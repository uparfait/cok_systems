/*
 * =========================================================
 * IKAZE OFFLINE SERVICE WORKER  (v2.5.0)
 * =========================================================
 *
 * Strategy: Network First, single attempt, fast fallback.
 *
 * 1. Every request goes to the network exactly ONCE.
 *    No retries — retries multiply through the page's
 *    loading waterfall (HTML -> JS -> API -> images) and
 *    make the user wait.
 *
 * 2. Each network attempt times out after REQUEST_TIMEOUT
 *    (25 seconds). A hanging connection can never stall a
 *    request beyond that.
 *
 * 3. FAST OFFLINE PATH:
 *    When the browser reports offline
 *    (navigator.onLine === false), the network is skipped
 *    entirely and the cache answers immediately. Offline
 *    users never wait for a timeout.
 *
 * 4. ONLINE:
 *        incoming network response
 *            -> returned to the page immediately
 *            -> cache updated with the new result in the
 *               background (cache.put overwrites the old
 *               entry for that URL)
 *
 * 5. OFFLINE / network failed / timed out:
 *        -> return the saved cached response
 *        -> if nothing is cached, propagate the real
 *           network error (no artificial "Offline" page)
 *
 * 6. HTTP errors (404, 401, 403, 500...) are real server
 *    responses — returned as-is and never cached.
 *
 * 7. Caching scope:
 *        - same-origin GET: always
 *        - cross-origin GET: when CACHE_CROSS_ORIGIN is true
 *
 * 8. INSTALL precaches the app shell and every asset it
 *    references (JS, CSS, images, fonts, manifest, icons).
 *
 * 9. Offline routing:
 *
 *        Application route -> cached React application,
 *                             React Router resolves the URL
 *        API route         -> cached API response if any,
 *                             otherwise the real error
 *
 * 10. /sw.js is never cached by this service worker.
 * 11. Web Push notifications are supported.
 *
 * Cache:
 *
 *      IKAZE_OFFLINE_V2
 */


/*
 * =========================================================
 * CONFIGURATION
 * =========================================================
 */

const CACHE_NAME = "IKAZE_OFFLINE_V3";

/*
 * Maximum time a network request may take before it is
 * aborted and the cache takes over. 25 seconds.
 */
const REQUEST_TIMEOUT = 25000;

/*
 * Cache resources from other origins (CDNs, Google Fonts...).
 *
 * NOTE: opaque (no-cors) responses are stored with padded
 * quota in some browsers (~7 MB each in Chrome). If you load
 * many third-party resources, consider setting this to false.
 */
const CACHE_CROSS_ORIGIN = true;

/*
 * The React application shell.
 */
const APP_SHELL = "/";

/*
 * Extra URLs to always precache, even if index.html does not
 * reference them directly.
 */
const EXTRA_PRECACHE_URLS = [
    "/",
    "/favicon.png",
    "/LOGO_COK.png",
    "/manifest.json"
];


/*
 * =========================================================
 * OFFLINE DETECTION
 * =========================================================
 *
 * navigator.onLine === false is reliable: there is
 * definitely no connection, so the cache should answer at
 * once instead of making the user wait for a timeout.
 *
 * navigator.onLine === true only means "maybe online" —
 * that case is covered by REQUEST_TIMEOUT.
 */

function isBrowserOffline() {

    return (
        typeof navigator !== "undefined" &&
        navigator.onLine === false
    );

}


/*
 * =========================================================
 * SINGLE NETWORK REQUEST WITH TIMEOUT
 * =========================================================
 *
 * - Offline: fail immediately, no network attempt.
 * - Online: one attempt, aborted after REQUEST_TIMEOUT.
 * - Any HTTP response (including 404/500) resolves normally.
 */

function fetchWithTimeout(request) {

    if (isBrowserOffline()) {
        return Promise.reject(
            new TypeError("Browser is offline")
        );
    }

    if (
        typeof AbortSignal !== "undefined" &&
        typeof AbortSignal.timeout === "function"
    ) {

        return fetch(request, {
            signal: AbortSignal.timeout(REQUEST_TIMEOUT)
        });

    }

    /*
     * Fallback for older browsers without AbortSignal.timeout.
     */
    return new Promise((resolve, reject) => {

        const controller =
            typeof AbortController !== "undefined"
                ? new AbortController()
                : null;

        const timer = setTimeout(() => {

            if (controller) {
                controller.abort();
            }

            reject(new Error("Request timed out"));

        }, REQUEST_TIMEOUT);

        fetch(
            request,
            controller ? { signal: controller.signal } : undefined
        )
            .then(response => {
                clearTimeout(timer);
                resolve(response);
            })
            .catch(error => {
                clearTimeout(timer);
                reject(error);
            });

    });

}


/*
 * =========================================================
 * INSTALL — PRECACHE THE APP SHELL AND ALL ITS ASSETS
 * =========================================================
 *
 * 1. Fetch "/" (index.html) and cache it.
 * 2. Parse the HTML for every src/href attribute:
 *        <script src="/assets/app.js">
 *        <link href="/assets/app.css">
 *        <link rel="modulepreload" href="/assets/chunk.js">
 *        <img src="/images/logo.png">
 *        <link rel="icon" href="/favicon.png">
 * 3. Fetch and cache every discovered same-origin asset.
 * 4. Also cache EXTRA_PRECACHE_URLS.
 *
 * A single failed asset does NOT abort installation.
 */

async function precacheUrl(cache, url) {

    try {

        const response = await fetch(url, { cache: "no-cache" });

        if (response && response.ok) {
            await cache.put(url, response);
        }

    } catch (error) {

        /*
         * Never let one missing asset break installation.
         */
        console.warn("[IKAZE] Precache skipped:", url, error);

    }

}

async function discoverAndPrecacheShellAssets(cache) {

    let html = "";

    try {

        const response = await fetch(APP_SHELL, { cache: "no-cache" });

        if (!response || !response.ok) {
            return;
        }

        /*
         * Cache the shell document itself.
         * Clone BEFORE reading the body as text.
         */
        await cache.put(APP_SHELL, response.clone());

        html = await response.text();

    } catch (error) {

        console.warn("[IKAZE] Could not fetch app shell for precache:", error);
        return;

    }

    /*
     * Collect every src="..." / href="..." in the document.
     */
    const urls = new Set();

    const attributePattern = /(?:src|href)\s*=\s*["']([^"']+)["']/gi;

    let match;

    while ((match = attributePattern.exec(html)) !== null) {

        const raw = match[1];

        if (
            raw.startsWith("data:") ||
            raw.startsWith("blob:") ||
            raw.startsWith("mailto:") ||
            raw.startsWith("tel:") ||
            raw.startsWith("#")
        ) {
            continue;
        }

        let url;

        try {
            url = new URL(raw, self.location.origin);
        } catch {
            continue;
        }

        if (url.protocol !== "http:" && url.protocol !== "https:") {
            continue;
        }

        /*
         * Precache same-origin assets. Never the worker itself.
         */
        if (
            url.origin === self.location.origin &&
            url.pathname !== "/sw.js"
        ) {
            urls.add(url.href);
        }

    }

    await Promise.all(
        [...urls].map(url => precacheUrl(cache, url))
    );

}

self.addEventListener("install", event => {

    event.waitUntil(

        (async () => {

            const cache = await caches.open(CACHE_NAME);

            /*
             * Cache the shell + every asset it references.
             */
            await discoverAndPrecacheShellAssets(cache);

            /*
             * Cache the explicit extra URLs.
             */
            await Promise.all(
                EXTRA_PRECACHE_URLS.map(url => precacheUrl(cache, url))
            );

            /*
             * Activate this worker immediately.
             * This does not reload the page.
             */
            await self.skipWaiting();

        })()

    );

});


/*
 * =========================================================
 * ACTIVATE
 * =========================================================
 *
 * Keep the current cache; remove caches of older versions.
 */

self.addEventListener("activate", event => {

    event.waitUntil(

        (async () => {

            const cacheNames = await caches.keys();

            await Promise.all(
                cacheNames
                    .filter(cacheName => cacheName !== CACHE_NAME)
                    .map(cacheName => caches.delete(cacheName))
            );

            /*
             * Start controlling existing pages immediately.
             */
            await self.clients.claim();

        })()

    );

});


/*
 * =========================================================
 * CACHE A SUCCESSFUL RESPONSE
 * =========================================================
 *
 * cache.put(request, response) OVERWRITES any existing entry
 * stored under the same request URL — every successful
 * network response automatically REPLACES the old cached
 * copy with the new result.
 *
 * IMPORTANT: this function receives a response that was
 * ALREADY CLONED synchronously in the fetch handler, before
 * the original was returned to the page. It must never
 * receive the original response.
 */

async function updateCache(request, responseClone) {

    if (!responseClone) {
        return;
    }

    const isOpaque = responseClone.type === "opaque";

    /*
     * Opaque responses always report status 0, so they get
     * their own rule: cached only when cross-origin caching
     * is enabled.
     */
    if (isOpaque) {

        if (!CACHE_CROSS_ORIGIN) {
            return;
        }

    } else if (
        responseClone.status < 200 ||
        responseClone.status >= 300
    ) {

        /*
         * Only cache successful responses.
         */
        return;

    }

    /*
     * Never cache the service worker itself.
     */
    const requestUrl = new URL(request.url);

    if (
        requestUrl.origin === self.location.origin &&
        requestUrl.pathname === "/sw.js"
    ) {
        return;
    }

    try {

        const cache = await caches.open(CACHE_NAME);

        /*
         * Replaces the previous entry for this URL with the
         * new result.
         */
        await cache.put(request, responseClone);

    } catch (error) {

        /*
         * A cache failure must never replace a successful
         * network response with an error.
         */
        console.error("[IKAZE] Cache update failed:", error);

    }

}


/*
 * =========================================================
 * BACKGROUND CACHE UPDATE
 * =========================================================
 *
 * Cache writing never blocks the response to the page.
 */

function updateCacheInBackground(request, responseClone) {

    updateCache(request, responseClone).catch(error => {

        console.error("[IKAZE] Unexpected cache error:", error);

    });

}


/*
 * =========================================================
 * IS API REQUEST?
 * =========================================================
 */

function isApiRequest(request) {

    const url = new URL(request.url);

    return (
        url.origin === self.location.origin &&
        (
            url.pathname === "/api" ||
            url.pathname.startsWith("/api/")
        )
    );

}


/*
 * =========================================================
 * IS APPLICATION NAVIGATION?
 * =========================================================
 */

function isNavigationRequest(request) {

    return request.mode === "navigate";

}


/*
 * =========================================================
 * GET REACT APPLICATION SHELL  (offline only)
 * =========================================================
 */

async function getOfflineApplication(request) {

    /*
     * First check whether this exact route has already been
     * cached. ignoreSearch lets "/upcoming?tab=2" match a
     * cached "/upcoming".
     */
    const exactMatch = await caches.match(request, {
        ignoreSearch: true
    });

    if (exactMatch) {
        return exactMatch;
    }

    /*
     * Otherwise return the React application shell.
     * React Router resolves the URL on the client.
     */
    const appShell = await caches.match(APP_SHELL);

    if (appShell) {
        return appShell;
    }

    throw new Error("IKAZE application shell is not cached.");

}


/*
 * =========================================================
 * NORMAL RESOURCE REQUEST  (Network First)
 * =========================================================
 *
 * Online:
 *
 *      one fetch (max 25s)
 *          -> return the incoming network response
 *          -> cache clone replaces the old entry
 *
 * Offline:
 *
 *      no network attempt
 *          -> saved cached response IMMEDIATELY
 *
 * Failed / timed out:
 *
 *      -> saved cached response,
 *         or the real network error if nothing is cached
 */

async function networkFirstResource(request) {

    try {

        const response = await fetchWithTimeout(request);

        /*
         * Clone SYNCHRONOUSLY, before returning, then let
         * the cache update happen in the background.
         */
        updateCacheInBackground(request, response.clone());

        return response;

    } catch (networkError) {

        /*
         * Offline, failed, or timed out — ONLY NOW do we
         * look in the cache.
         */
        const cachedResponse = await caches.match(request);

        if (cachedResponse) {
            return cachedResponse;
        }

        /*
         * Nothing cached: propagate the REAL network error.
         */
        throw networkError;

    }

}


/*
 * =========================================================
 * NAVIGATION REQUEST  (Network First)
 * =========================================================
 */

async function navigationFirst(request) {

    try {

        const response = await fetchWithTimeout(request);

        /*
         * Newest HTML replaces the old cached copy.
         */
        updateCacheInBackground(request, response.clone());

        return response;

    } catch (networkError) {

        /*
         * Offline — ONLY NOW consult the cache.
         */
        try {

            return await getOfflineApplication(request);

        } catch (offlineError) {

            throw networkError;

        }

    }

}


/*
 * =========================================================
 * FETCH EVENT
 * =========================================================
 */

self.addEventListener("fetch", event => {

    const request = event.request;

    /*
     * Only GET requests.
     */
    if (request.method !== "GET") {
        return;
    }

    const requestUrl = new URL(request.url);

    /*
     * Only HTTP/HTTPS (skips chrome-extension:, etc.).
     */
    if (
        requestUrl.protocol !== "http:" &&
        requestUrl.protocol !== "https:"
    ) {
        return;
    }

    const isSameOrigin =
        requestUrl.origin === self.location.origin;

    /*
     * Cross-origin resources (CDN images, fonts, ...) are
     * handled when CACHE_CROSS_ORIGIN is enabled.
     */
    if (!isSameOrigin && !CACHE_CROSS_ORIGIN) {
        return;
    }

    /*
     * NEVER intercept sw.js — the browser must fetch the
     * real script to detect updates.
     */
    if (
        isSameOrigin &&
        requestUrl.pathname === "/sw.js"
    ) {
        return;
    }

    /*
     * NAVIGATION — React routes.
     */
    if (isNavigationRequest(request)) {

        event.respondWith(navigationFirst(request));

        return;
    }

    /*
     * API REQUESTS and ALL OTHER GET RESOURCES
     * (JS, CSS, images, fonts, ...) — Network First,
     * single attempt, cache fallback when offline or
     * failed. Every successful response replaces its old
     * cache entry.
     */
    event.respondWith(networkFirstResource(request));

});


/*
 * =========================================================
 * PUSH NOTIFICATIONS
 * =========================================================
 */

self.addEventListener("push", event => {

    let data = {
        title: "IKAZE Notification",
        body: "You have a new notification",
        icon: "/LOGO_COK.png",
        badge: "/favicon.png",
        tag: "default",
        url: "/"
    };

    if (event.data) {

        try {

            data = {
                ...data,
                ...event.data.json()
            };

        } catch (error) {

            try {

                data.body = event.data.text();

            } catch (textError) {

                /*
                 * Keep the default notification data.
                 */

            }

        }

    }

    const options = {

        body: data.body,

        icon: data.icon || "/LOGO_COK.png",

        badge: data.badge || "/favicon.png",

        tag: data.tag || "default",

        data: {
            url: data.url || "/"
        },

        requireInteraction: false,

        actions: [
            {
                action: "open",
                title: "Open IKAZE"
            },
            {
                action: "close",
                title: "Dismiss"
            }
        ]

    };

    event.waitUntil(

        self.registration.showNotification(
            data.title,
            options
        )

    );

});


/*
 * =========================================================
 * NOTIFICATION CLICK
 * =========================================================
 */

self.addEventListener("notificationclick", event => {

    event.notification.close();

    if (event.action === "close") {
        return;
    }

    const targetUrl =
        event.notification.data?.url || "/";

    event.waitUntil(

        self.clients
            .matchAll({
                type: "window",
                includeUncontrolled: true
            })
            .then(clientList => {

                /*
                 * Reuse an existing IKAZE window.
                 */
                for (const client of clientList) {

                    if (
                        client.url.startsWith(
                            self.location.origin
                        ) &&
                        "focus" in client
                    ) {

                        return client
                            .navigate(targetUrl)
                            .then(() => client.focus());

                    }

                }

                /*
                 * No existing window.
                 */
                if (self.clients.openWindow) {

                    return self.clients.openWindow(targetUrl);

                }

            })

    );

});


/*
 * =========================================================
 * MESSAGE HANDLING
 * =========================================================
 */

self.addEventListener("message", event => {

    if (!event.data) {
        return;
    }

    /*
     * GET VERSION
     */
    if (event.data.type === "GET_VERSION") {

        if (event.ports && event.ports[0]) {

            event.ports[0].postMessage({
                version: "2.5.0"
            });

        }

    }

    /*
     * CLEAR CACHES
     */
    if (event.data.type === "CLEAR_CACHES") {

        event.waitUntil(

            caches.keys()

                .then(cacheNames =>

                    Promise.all(
                        cacheNames.map(cacheName =>
                            caches.delete(cacheName)
                        )
                    )

                )

                .then(() => {

                    if (event.ports && event.ports[0]) {

                        event.ports[0].postMessage({
                            type: "CACHE_CLEARED"
                        });

                    }

                })

        );

    }

    /*
     * SKIP WAITING
     */
    if (event.data.type === "SKIP_WAITING") {

        self.skipWaiting();

    }

});
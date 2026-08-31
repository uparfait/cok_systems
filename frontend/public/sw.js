/*
 * =========================================================
 * IKAZE OFFLINE SERVICE WORKER  (v2.1.0)
 * =========================================================
 *
 * Main behavior:
 *
 * 1. Network First.
 * 2. Network is attempted up to MAX_NETWORK_ATTEMPTS times
 *    when the request fails at the network level.
 * 3. HTTP errors (404, 401, 403, 500...) are NOT retried.
 * 4. Every successful GET response is cached:
 *        - same-origin: always
 *        - cross-origin: when CACHE_CROSS_ORIGIN is true
 * 5. A successful network response is always returned first.
 * 6. The successful response replaces its previous cache entry.
 * 7. INSTALL now PRECACHES the app shell AND every asset it
 *    references (JS, CSS, images, fonts, manifest, icons),
 *    so all build files are captured immediately — not only
 *    after the user happens to request them.
 * 8. When offline:
 *
 *      Normal application route
 *          -> return cached React application
 *
 *      API route
 *          -> return cached API response if one exists
 *          -> otherwise let the real network error propagate
 *
 * 9. /sw.js is never cached by this service worker.
 * 10. Web Push notifications are supported.
 *
 * Cache:
 *
 *      IKAZE_OFFLINE_V2
 *
 * FIXES vs previous version:
 *
 *  A. response.clone() is now called SYNCHRONOUSLY before
 *     the response is returned to the page. Previously the
 *     clone happened after an `await`, so the browser had
 *     often already started consuming the body and clone()
 *     threw "body already used" — meaning many files were
 *     silently never cached. This was the main reason "not
 *     all files were captured".
 *
 *  B. Install-time asset discovery: index.html is parsed and
 *     every referenced asset is precached, plus everything in
 *     EXTRA_PRECACHE_URLS.
 *
 *  C. Cross-origin GET resources (CDN fonts, images, ...) can
 *     now be intercepted and cached, including opaque
 *     responses.
 */


/*
 * =========================================================
 * CONFIGURATION
 * =========================================================
 */

const CACHE_NAME = "IKAZE_OFFLINE_V2";

const MAX_NETWORK_ATTEMPTS = 3;

const RETRY_DELAY = 500;

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
 * WAIT
 * =========================================================
 */

function wait(milliseconds) {

    return new Promise(resolve => {
        setTimeout(resolve, milliseconds);
    });

}


/*
 * =========================================================
 * NETWORK REQUEST WITH RETRIES
 * =========================================================
 *
 * Only actual network failures are retried.
 * HTTP responses (including 404/500) are returned as-is.
 */

async function fetchWithRetries(request) {

    let lastError = null;

    for (
        let attempt = 1;
        attempt <= MAX_NETWORK_ATTEMPTS;
        attempt++
    ) {

        try {

            return await fetch(request);

        } catch (error) {

            lastError = error;

            if (attempt < MAX_NETWORK_ATTEMPTS) {
                await wait(RETRY_DELAY * attempt);
            }

        }

    }

    throw lastError;

}


/*
 * =========================================================
 * CACHE A SUCCESSFUL RESPONSE
 * =========================================================
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
 * GET REACT APPLICATION SHELL
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
 */

async function networkFirstResource(request) {

    try {

        const response = await fetchWithRetries(request);

        /*
         * FIX: clone SYNCHRONOUSLY, before returning.
         *
         * Once the page starts reading the body, clone()
         * throws and the file would never be cached — this
         * was why many JS/image files were not captured.
         */
        updateCacheInBackground(request, response.clone());

        return response;

    } catch (networkError) {

        /*
         * Network completely failed — try the cache.
         */
        const cachedResponse = await caches.match(request);

        if (cachedResponse) {
            return cachedResponse;
        }

        /*
         * Nothing cached: propagate the REAL network error.
         * No artificial "Offline" response is manufactured.
         */
        throw networkError;

    }

}


/*
 * =========================================================
 * NAVIGATION REQUEST
 * =========================================================
 */

async function navigationFirst(request) {

    try {

        const response = await fetchWithRetries(request);

        /*
         * FIX: clone synchronously here too.
         */
        updateCacheInBackground(request, response.clone());

        return response;

    } catch (networkError) {

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
     * now handled too when CACHE_CROSS_ORIGIN is enabled.
     * Previously they were skipped entirely, so they were
     * never captured.
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
     * (JS, CSS, images, fonts, ...) — Network First with
     * cache fallback. Every successful response is cached.
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
                version: "2.1.0"
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
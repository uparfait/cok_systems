
/*
 * IKAZE OFFLINE SERVICE WORKER
 *
 * Features:
 *
 * 1. Network First
 * 2. Up to 5 network attempts when the network itself fails
 * 3. Successful network responses replace cached responses
 * 4. Cached responses are used only after the network completely fails
 * 5. Supports offline navigation for the React application
 * 6. Supports Web Push notifications
 * 7. Does not intentionally reload pages
 * 8. Does not cache the service-worker script itself
 */

const CACHE_NAME = "IKAZE_OFFLINE";

const MAX_NETWORK_ATTEMPTS = 1;

/*
 * Delay between failed network attempts.
 *
 * Attempt 1 -> immediate
 * Attempt 2 -> 500ms
 * Attempt 3 -> 1000ms
 * Attempt 4 -> 1500ms
 * Attempt 5 -> 2000ms
 */
const RETRY_DELAY = 500;


/*
 * ---------------------------------------------------------
 * INSTALL
 * ---------------------------------------------------------
 *
 * Install the new service worker immediately.
 *
 * IMPORTANT:
 * skipWaiting() does NOT reload the page.
 */
self.addEventListener("install", event => {

    event.waitUntil(
        self.skipWaiting()
    );

});


/*
 * ---------------------------------------------------------
 * ACTIVATE
 * ---------------------------------------------------------
 *
 * The new service worker becomes active.
 *
 * We intentionally DO NOT delete IKAZE_OFFLINE.
 *
 * Keeping the same cache means previously cached offline
 * content remains available after a service-worker update.
 *
 * Old cache names are removed, but IKAZE_OFFLINE remains.
 */
self.addEventListener("activate", event => {

    event.waitUntil(

        (async () => {

            const cacheNames = await caches.keys();

            await Promise.all(

                cacheNames

                    .filter(name => name !== CACHE_NAME)

                    .map(name => caches.delete(name))

            );

            /*
             * Allow this service worker to control already-open
             * pages immediately.
             *
             * This does NOT reload the page.
             */
            await self.clients.claim();

        })()

    );

});


/*
 * ---------------------------------------------------------
 * WAIT
 * ---------------------------------------------------------
 *
 * Creates a delay before another network attempt.
 */
function wait(milliseconds) {

    return new Promise(resolve => {

        setTimeout(resolve, milliseconds);

    });

}


/*
 * ---------------------------------------------------------
 * NETWORK FETCH WITH RETRIES
 * ---------------------------------------------------------
 *
 * IMPORTANT:
 *
 * fetch() rejects only when the request itself fails at the
 * network level.
 *
 * HTTP responses such as:
 *
 * 404
 * 500
 * 403
 *
 * are still successful network communication.
 *
 * Therefore they are returned immediately and are NOT retried.
 */
async function fetchWithRetries(request) {

    let lastError = null;

    for (
        let attempt = 1;
        attempt <= MAX_NETWORK_ATTEMPTS;
        attempt++
    ) {

        try {

            const response = await fetch(request);

            /*
             * The network successfully responded.
             *
             * Return the response immediately.
             */
            return response;

        } catch (error) {

            lastError = error;

            /*
             * Do not wait after the final attempt.
             */
            if (attempt < MAX_NETWORK_ATTEMPTS) {

                await wait(RETRY_DELAY * attempt);

            }

        }

    }

    /*
     * Every network attempt failed.
     */
    throw lastError;

}


/*
 * ---------------------------------------------------------
 * CACHE SUCCESSFUL RESPONSE
 * ---------------------------------------------------------
 *
 * Cache errors are deliberately separated from network errors.
 *
 * This is important.
 *
 * If the network returns 200 but cache.put() fails, we still
 * want to return the successful network response.
 */
async function updateCache(request, response) {

    /*
     * Only cache normal successful responses.
     */
    if (!response || response.status !== 200) {
        return;
    }

    /*
     * Do not cache opaque responses.
     */
    if (response.type === "opaque") {
        return;
    }

    try {

        const cache = await caches.open(CACHE_NAME);

        await cache.put(
            request,
            response.clone()
        );

    } catch (error) {

        /*
         * Cache failure must NOT turn a successful network
         * request into an offline request.
         */
        console.error(
            "[IKAZE] Cache update failed:",
            request.url,
            error
        );

    }

}


/*
 * ---------------------------------------------------------
 * NETWORK FIRST
 * ---------------------------------------------------------
 *
 * Order:
 *
 * 1. Network
 * 2. Retry network failures
 * 3. Cache successful network response
 * 4. If network completely fails, use cache
 * 5. If cache does not exist, return 503
 */
async function networkFirst(request) {

    try {

        /*
         * NETWORK ALWAYS COMES FIRST.
         */
        const response = await fetchWithRetries(request);

        /*
         * Update the cache in the background.
         *
         * We do NOT wait for cache.put() before returning the
         * network response to the browser.
         */
        eventCacheUpdate(request, response);

        /*
         * Return the newest network response immediately.
         */
        return response;

    } catch (networkError) {

        /*
         * Network completely failed.
         *
         * ONLY NOW do we look in the cache.
         */
        try {

            const cachedResponse =
                await caches.match(request);

            if (cachedResponse) {

                return cachedResponse;

            }

        } catch (cacheError) {

            console.error(
                "[IKAZE] Cache lookup failed:",
                cacheError
            );

        }

        /*
         * Nothing exists in the cache.
         */
        return new Response(
            "Offline. The requested resource is not available.",
            {
                status: 503,
                statusText: "Service Unavailable",
                headers: {
                    "Content-Type":
                        "text/plain; charset=utf-8"
                }
            }
        );

    }

}


/*
 * ---------------------------------------------------------
 * CACHE UPDATE HELPER
 * ---------------------------------------------------------
 *
 * Updating the cache must never interfere with the response
 * being returned to the browser.
 */
function eventCacheUpdate(request, response) {

    updateCache(request, response).catch(error => {

        console.error(
            "[IKAZE] Unexpected cache update error:",
            error
        );

    });

}


/*
 * ---------------------------------------------------------
 * FETCH EVENT
 * ---------------------------------------------------------
 *
 * Only same-origin HTTP/HTTPS GET requests are handled.
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
     * Only HTTP and HTTPS.
     */
    if (
        requestUrl.protocol !== "http:" &&
        requestUrl.protocol !== "https:"
    ) {
        return;
    }

    /*
     * Only this website's origin.
     */
    if (requestUrl.origin !== self.location.origin) {
        return;
    }

    /*
     * NEVER intercept the service-worker script.
     *
     * This is important because the browser must always be
     * able to check the real /sw.js for updates.
     */
    if (requestUrl.pathname === "/sw.js") {
        return;
    }

    /*
     * Navigation requests are normal browser page navigations.
     *
     * For a React SPA, Network First is appropriate:
     *
     * Online  -> get the newest document
     * Offline -> use previously cached document
     */
    if (request.mode === "navigate") {

        event.respondWith(
            networkFirst(request)
        );

        return;
    }

    /*
     * Handle other same-origin GET resources:
     *
     * JavaScript
     * CSS
     * images
     * fonts
     * API GET requests
     *
     * They also use Network First.
     */
    event.respondWith(
        networkFirst(request)
    );

});


/*
 * ---------------------------------------------------------
 * PUSH NOTIFICATIONS
 * ---------------------------------------------------------
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
                 * Keep the default body.
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
 * ---------------------------------------------------------
 * NOTIFICATION CLICK
 * ---------------------------------------------------------
 */
self.addEventListener("notificationclick", event => {

    event.notification.close();


    if (event.action === "close") {
        return;
    }


    const targetUrl =
        event.notification.data?.url || "/";


    event.waitUntil(

        self.clients.matchAll({

            type: "window",

            includeUncontrolled: true

        }).then(clientList => {


            /*
             * Try to reuse an existing IKAZE window.
             */
            for (const client of clientList) {

                if (
                    client.url.startsWith(
                        self.location.origin
                    ) &&
                    "focus" in client
                ) {

                    /*
                     * Navigation here happens ONLY because
                     * the user clicked a notification.
                     */
                    return client
                        .navigate(targetUrl)
                        .then(() => client.focus());

                }

            }


            /*
             * No existing window.
             *
             * Open a new one.
             */
            if (self.clients.openWindow) {

                return self.clients.openWindow(
                    targetUrl
                );

            }

        })

    );

});


/*
 * ---------------------------------------------------------
 * MESSAGE HANDLING
 * ---------------------------------------------------------
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

                version: "2.0.0"

            });

        }

    }


    /*
     * CLEAR CACHES
     *
     * This is intentionally explicit.
     *
     * The application must request this operation.
     */
    if (event.data.type === "CLEAR_CACHES") {

        event.waitUntil(

            caches.keys()

                .then(cacheNames =>

                    Promise.all(

                        cacheNames.map(
                            cacheName =>
                                caches.delete(cacheName)
                        )

                    )

                )

                .then(() => {

                    if (
                        event.ports &&
                        event.ports[0]
                    ) {

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


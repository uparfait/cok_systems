/*
 * IKAZE OFFLINE SERVICE WORKER
 *
 * Main behavior:
 *
 * 1. Network First
 * 2. Try the network up to 5 times
 * 3. If network succeeds:
 *      - Return the new response
 *      - Replace the old cached response
 * 4. If network completely fails:
 *      - Return the cached response
 * 5. If there is no cached response:
 *      - Return a 503 Offline response
 *
 * Cache name:
 *      IKAZE_OFFLINE
 */

const CACHE_NAME = "IKAZE_OFFLINE";

/*
 * Maximum number of network attempts.
 */
const MAX_NETWORK_ATTEMPTS = 5;

/*
 * Delay between retry attempts.
 *
 * The delay increases slightly after every failure:
 *
 * Attempt 1 -> immediate
 * Attempt 2 -> 500ms
 * Attempt 3 -> 1000ms
 * Attempt 4 -> 1500ms
 * Attempt 5 -> 2000ms
 */
const RETRY_DELAY = 500;


/*
 * INSTALL
 *
 * This event happens when the browser installs this service worker.
 */
self.addEventListener("install", event => {

    /*
     * skipWaiting() tells the browser that this new service worker
     * should move toward activation immediately instead of waiting
     * for old controlled pages to close.
     */
    event.waitUntil(
        self.skipWaiting()
    );
});


/*
 * ACTIVATE
 *
 * This happens after installation.
 */
self.addEventListener("activate", event => {

    event.waitUntil(
        (async () => {

            /*
             * Get all Cache Storage cache names belonging to this origin.
             */
            const cacheNames = await caches.keys();

            /*
             * Delete every cache except IKAZE_OFFLINE.
             *
             * This is useful when migrating from an old service worker
             * that used another cache name.
             */
            await Promise.all(
                cacheNames
                    .filter(name => name !== CACHE_NAME)
                    .map(name => caches.delete(name))
            );

            /*
             * Tell existing pages that this service worker should
             * immediately start controlling them.
             */
            await self.clients.claim();

        })()
    );
});


/*
 * Wait before another network attempt.
 */
function wait(milliseconds) {

    return new Promise(resolve => {
        setTimeout(resolve, milliseconds);
    });

}


/*
 * NETWORK REQUEST WITH RETRIES
 *
 * This function attempts to contact the server several times.
 */
async function fetchWithRetries(request) {

    let lastError = null;

    for (
        let attempt = 1;
        attempt <= MAX_NETWORK_ATTEMPTS;
        attempt++
    ) {

        try {

            /*
             * Try to contact the server.
             */
            const response = await fetch(request);

            /*
             * IMPORTANT:
             *
             * A response such as 404 or 500 still means that the
             * network successfully reached the server.
             *
             * Therefore we return it instead of treating it as
             * an offline/network failure.
             */
            return response;

        } catch (error) {

            /*
             * Store the error in case all attempts fail.
             */
            lastError = error;

            /*
             * Do not wait after the final attempt.
             */
            if (attempt < MAX_NETWORK_ATTEMPTS) {

                /*
                 * Increase the delay after each failed attempt.
                 */
                await wait(RETRY_DELAY * attempt);
            }
        }
    }

    /*
     * All network attempts failed.
     */
    throw lastError;
}


/*
 * NETWORK FIRST
 *
 * This is the main caching strategy.
 */
async function networkFirst(request) {

    try {

        /*
         * First priority is ALWAYS the network.
         */
        const response = await fetchWithRetries(request);

        /*
         * Only cache successful responses (status 200).
         */
        if (response && response.status === 200) {

            /*
             * Open our single application cache.
             */
            const cache = await caches.open(CACHE_NAME);

            /*
             * Store the new response.
             *
             * response.clone() is necessary because a Response body can
             * normally only be consumed once.
             *
             * The original response is returned to the browser.
             * The clone is stored in the cache.
             */
            await cache.put(
                request,
                response.clone()
            );
        }

        /*
         * Return the newest network response.
         */
        return response;

    } catch (networkError) {

        /*
         * Network failed after all retry attempts.
         *
         * Now, and ONLY now, look in the cache.
         */
        const cachedResponse = await caches.match(request);

        /*
         * Cached response exists.
         */
        if (cachedResponse) {

            return cachedResponse;
        }

        /*
         * Network failed and there is no cached response.
         */
        return new Response(
            `
            Offline.

            The requested resource is not available in
            the IKAZE_OFFLINE cache.
            `,
            {
                status: 503,

                headers: {
                    "Content-Type": "text/plain; charset=utf-8"
                }
            }
        );
    }
}


/*
 * FETCH EVENT
 *
 * Every request made by a controlled page reaches this event.
 */
self.addEventListener("fetch", event => {

    const request = event.request;

    /*
     * Only handle GET requests.
     *
     * POST, PUT, DELETE, PATCH, etc. should normally be handled
     * directly by the server/application rather than cached this way.
     */
    if (request.method !== "GET") {
        return;
    }

    /*
     * Only handle requests from this origin.
     */
    const requestUrl = new URL(request.url);
    if (requestUrl.origin !== self.location.origin) {
        return;
    }

    /*
     * Skip chrome-extension and other non-http(s) requests.
     */
    if (!requestUrl.protocol.startsWith("http")) {
        return;
    }

    /*
     * Use our Network First strategy.
     */
    event.respondWith(
        networkFirst(request)
    );

});


/*
 * PUSH NOTIFICATIONS
 *
 * Handle push messages from the server.
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
            data = { ...data, ...event.data.json() };
        } catch (e) {
            data.body = event.data.text ? event.data.text() : data.body;
        }
    }

    const options = {
        body: data.body,
        icon: data.icon || "/LOGO_COK.png",
        badge: data.badge || "/favicon.png",
        tag: data.tag || "default",
        data: { url: data.url || "/" },
        requireInteraction: false,
        actions: [
            { action: "open", title: "Open IKAZE" },
            { action: "close", title: "Dismiss" }
        ]
    };

    event.waitUntil(
        self.registration.showNotification(data.title, options)
    );
});


/*
 * NOTIFICATION CLICK
 *
 * Handle when user clicks on a notification.
 */
self.addEventListener("notificationclick", event => {

    event.notification.close();

    if (event.action === "close") return;

    const targetUrl = event.notification.data?.url || "/";

    event.waitUntil(
        self.clients.matchAll({
            type: "window",
            includeUncontrolled: true
        }).then(clientList => {
            for (const client of clientList) {
                if (
                    client.url.includes(self.location.origin) &&
                    "focus" in client
                ) {
                    client.navigate(targetUrl);
                    return client.focus();
                }
            }
            if (self.clients.openWindow) {
                return self.clients.openWindow(targetUrl);
            }
        })
    );
});


/*
 * MESSAGE HANDLING
 *
 * Handle messages from the webpage.
 */
self.addEventListener("message", event => {

    if (event.data && event.data.type === "GET_VERSION") {
        event.ports[0].postMessage({ version: "2.0.0" });
    }

    if (event.data && event.data.type === "CLEAR_CACHES") {
        caches.keys()
            .then(keys => Promise.all(keys.map(key => caches.delete(key))))
            .then(() => {
                event.ports[0].postMessage({ type: "CACHE_CLEARED" });
            });
    }

    if (event.data && event.data.type === "SKIP_WAITING") {
        self.skipWaiting();
    }
});

/* AurisTitutum PRO — Service Worker for Web Push Notifications */

self.addEventListener("install", () => {
    self.skipWaiting();
});

self.addEventListener("activate", (event) => {
    event.waitUntil(self.clients.claim());
});

// ── Push event from server (VAPID) ──────────────────────────────────────────
self.addEventListener("push", (event) => {
    let data = { title: "AurisTitutum Reminder", body: "You have a due reminder!", url: "/app/reminders" };

    try {
        data = event.data.json();
    } catch {
        if (event.data) {
            data.body = event.data.text();
        }
    }

    const options = {
        body: data.body || "",
        icon: "/favicon.ico",
        badge: "/favicon.ico",
        vibrate: [200, 100, 200, 100, 200],
        tag: data.tag || "auris-reminder",
        renotify: true,
        requireInteraction: true,
        data: { url: data.url || "/app/reminders" },
    };

    event.waitUntil(
        self.registration.showNotification(data.title, options)
    );
});

// ── Notification click → open / focus app ───────────────────────────────────
self.addEventListener("notificationclick", (event) => {
    event.notification.close();

    const targetUrl = (event.notification.data && event.notification.data.url)
        ? event.notification.data.url
        : "/app/reminders";

    event.waitUntil(
        self.clients
            .matchAll({ type: "window", includeUncontrolled: true })
            .then((clients) => {
                // Focus an existing tab if possible
                for (const client of clients) {
                    if (client.url.includes(self.registration.scope) && "focus" in client) {
                        client.navigate(targetUrl);
                        return client.focus();
                    }
                }
                // Otherwise open a new tab
                if (self.clients.openWindow) {
                    return self.clients.openWindow(targetUrl);
                }
            })
    );
});

// ── Push subscription change (browser rotates keys) ─────────────────────────
self.addEventListener("pushsubscriptionchange", (event) => {
    event.waitUntil(
        self.registration.pushManager
            .subscribe({ userVisibleOnly: true, applicationServerKey: event.oldSubscription?.options?.applicationServerKey })
            .then((newSubscription) => {
                // Notify the app so it can re-register with the server
                return self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
                    clients.forEach((client) => {
                        client.postMessage({ type: "PUSH_SUBSCRIPTION_CHANGED", subscription: newSubscription.toJSON() });
                    });
                });
            })
            .catch(() => { }) // non-fatal
    );
});

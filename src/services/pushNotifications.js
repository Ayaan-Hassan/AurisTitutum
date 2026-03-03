/**
 * Push Notifications Service — Production VAPID Implementation
 *
 * Flow:
 *  1. requestNotificationPermission()       → asks browser for permission
 *  2. subscribeUserToPush(user)             → creates PushSubscription & registers with /api/push/register
 *  3. registerScheduledReminder(uid, r)     → writes to Firestore `scheduledReminders` for cron delivery
 *  4. scheduleAllReminders(reminders, user) → called on app load; syncs all reminders to Firestore
 *
 * True background delivery (browser fully closed) is handled by:
 *   Vercel cron /api/cron/send-reminders (every minute)
 *   → /api/push/send via web-push → service worker → OS notification
 *
 * In-browser setTimeout fallback is also active while the tab is open.
 */

import { auth } from "../firebase.config.js";
import { getFirestore, doc, setDoc, deleteDoc } from "firebase/firestore";

// ─── Helpers ─────────────────────────────────────────────────────────────────

const API_BASE = (import.meta.env.VITE_BACKEND_URL || "").replace(/\/$/, "");

function urlBase64ToUint8Array(base64String) {
    const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
    const rawData = atob(base64);
    return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)));
}

// ─── Permission ───────────────────────────────────────────────────────────────

export const requestNotificationPermission = async () => {
    if (!("Notification" in window)) return "unsupported";
    if (Notification.permission !== "default") return Notification.permission;
    try {
        return await Notification.requestPermission();
    } catch {
        return "denied";
    }
};

// ─── VAPID Subscribe + Register ──────────────────────────────────────────────

/**
 * Subscribe this browser to Web Push and POST the subscription to the backend.
 * Safe to call multiple times — backend deduplicates by endpoint.
 *
 * @param {object} user  Firebase user object with uid + getIdToken
 * @returns {PushSubscription|null}
 */
export const subscribeUserToPush = async (user) => {
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) return null;

    const vapidPublicKey = import.meta.env.VITE_VAPID_PUBLIC_KEY;
    if (!vapidPublicKey) {
        console.warn("[push] VITE_VAPID_PUBLIC_KEY not set — background push disabled.");
        return null;
    }

    try {
        const registration = await navigator.serviceWorker.ready;

        const subscription = await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
        });

        const idToken = await auth.currentUser?.getIdToken(true);
        if (!idToken) throw new Error("User not authenticated");

        const response = await fetch(`${API_BASE}/api/push/register`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${idToken}`,
            },
            body: JSON.stringify({ subscription: subscription.toJSON() }),
        });

        if (!response.ok) {
            const err = await response.json().catch(() => ({}));
            console.error("[push] register failed:", err.error);
        }

        return subscription;
    } catch (err) {
        console.error("[push] subscribeUserToPush:", err);
        return null;
    }
};

// ─── Firestore Scheduled Reminders ───────────────────────────────────────────

/**
 * Write a reminder to `scheduledReminders/{uid}_{reminderId}` so the cron
 * job can deliver it as a push notification.
 */
export const registerScheduledReminder = async (uid, reminder) => {
    if (!uid || !reminder?.date || !reminder?.time) return;

    const db = getFirestore();
    const reminderTime = new Date(`${reminder.date}T${reminder.time}`).toISOString();

    await setDoc(doc(db, "scheduledReminders", `${uid}_${reminder.id}`), {
        uid,
        reminderId: reminder.id,
        title: reminder.title || "",
        notes: reminder.notes || "",
        reminderTime,
        repeat: reminder.repeat || "none",
        sent: false,
        url: "/app/reminders",
        createdAt: new Date().toISOString(),
    });
};

/** Remove a reminder from Firestore (e.g. when deleted by user). */
export const unregisterScheduledReminder = async (uid, reminderId) => {
    if (!uid || !reminderId) return;
    const db = getFirestore();
    await deleteDoc(doc(db, "scheduledReminders", `${uid}_${reminderId}`));
};

/**
 * Sync all upcoming reminders to Firestore for cron delivery.
 * Call on app load once notification permission is granted.
 */
export const scheduleAllReminders = async (reminders, user) => {
    if (!user?.uid || !reminders?.length) return;

    const now = new Date();
    for (const r of reminders) {
        if (!r.date || !r.time) continue;
        if (r.repeat === "none" && new Date(`${r.date}T${r.time}`) <= now) continue;
        try {
            await registerScheduledReminder(user.uid, r);
        } catch (err) {
            console.warn("[push] scheduleAllReminders error:", r.id, err);
        }
    }
};

// ─── In-browser fallback (tab is open) ───────────────────────────────────────

export const showNotification = (title, options = {}) => {
    if (!("Notification" in window) || Notification.permission !== "granted") return;

    if ("serviceWorker" in navigator) {
        navigator.serviceWorker.ready
            .then((reg) =>
                reg.showNotification(title, {
                    icon: "/favicon.ico",
                    badge: "/favicon.ico",
                    vibrate: [200, 100, 200],
                    ...options,
                })
            )
            .catch(() => new Notification(title, { icon: "/favicon.ico", ...options }));
    } else {
        new Notification(title, { icon: "/favicon.ico", ...options });
    }
};

/**
 * Schedule in-browser setTimeout fallbacks for reminders due within 7 days.
 * This fires when the tab is open and complements the cron-based delivery.
 * Returns a cleanup function.
 */
export const scheduleInBrowserReminders = (reminders) => {
    const timerIds = [];
    const now = Date.now();

    for (const r of reminders) {
        if (!r.date || !r.time) continue;
        const delay = new Date(`${r.date}T${r.time}`).getTime() - now;
        if (delay <= 0 || delay > 7 * 24 * 60 * 60 * 1000) continue;

        timerIds.push(
            setTimeout(() => {
                showNotification(`⏰ ${r.title}`, {
                    body: r.notes || "Your reminder is due.",
                    tag: `reminder-${r.id}`,
                });
            }, delay)
        );
    }

    return () => timerIds.forEach(clearTimeout);
};

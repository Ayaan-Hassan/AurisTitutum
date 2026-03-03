/**
 * GET /api/cron/send-reminders
 *
 * Vercel Cron Job — runs every minute.
 * Queries Firestore for all reminders across all users where:
 *   - reminderTime <= now (ISO string comparison)
 *   - sent == false
 * For each due reminder:
 *   1. Sends a push notification via /api/push/send logic (inline)
 *   2. Marks the reminder as sent: true
 *
 * Triggered by cron entry in vercel.json:
 *   { "path": "/api/cron/send-reminders", "schedule": "* * * * *" }
 *
 * Protected by Authorization: Bearer <CRON_SECRET> set by Vercel automatically
 * for cron invocations (Vercel adds this header when CRON_SECRET env var is set).
 */

import webpush from "web-push";
import { getAdminApp } from "../_lib/firebaseAdmin.js";

webpush.setVapidDetails(
    process.env.VAPID_SUBJECT,
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY,
);

/**
 * Send a push notification to all subscriptions for a given uid.
 * Deletes stale subscriptions (HTTP 410 Gone) automatically.
 */
async function sendPushToUser(firestore, uid, title, body, url) {
    const subsSnap = await firestore
        .collection("users")
        .doc(uid)
        .collection("pushSubscriptions")
        .get();

    if (subsSnap.empty) return;

    const payload = JSON.stringify({ title, body, url: url || "/app/reminders" });

    await Promise.allSettled(
        subsSnap.docs.map(async (doc) => {
            const sub = doc.data();
            const pushSub = {
                endpoint: sub.endpoint,
                keys: { p256dh: sub.keys.p256dh, auth: sub.keys.auth },
            };
            try {
                await webpush.sendNotification(pushSub, payload);
            } catch (err) {
                if (err.statusCode === 410) {
                    await doc.ref.delete();
                }
            }
        })
    );
}

export default async function handler(req, res) {
    // Vercel adds Authorization: Bearer <CRON_SECRET> for cron invocations.
    // We also accept X-Cron-Secret for manual triggering.
    const cronSecret = process.env.CRON_SECRET;
    if (cronSecret) {
        const authHeader = req.headers.authorization || "";
        const xSecret = req.headers["x-cron-secret"] || "";
        const bearerToken = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";
        if (bearerToken !== cronSecret && xSecret !== cronSecret) {
            return res.status(401).json({ error: "Unauthorized" });
        }
    }

    if (req.method !== "GET" && req.method !== "POST") {
        return res.status(405).json({ error: "Method not allowed" });
    }

    try {
        const { firestore } = getAdminApp();
        const nowISO = new Date().toISOString();

        // Firestore doesn't support collectionGroup queries for sub-collections directly
        // without an index, so we use a top-level `scheduledReminders` collection.
        //
        // Schema: scheduledReminders/{reminderId}
        //   uid          string
        //   title        string
        //   notes        string
        //   reminderTime ISO string  (date + time combined)
        //   repeat       "none" | "daily" | "weekly"
        //   sent         boolean
        //   url          string (optional)
        //
        // NOTE: Reminders are written here by the frontend when they are created
        // (see pushNotifications.js — registerScheduledReminder function).

        const dueSnap = await firestore
            .collection("scheduledReminders")
            .where("sent", "==", false)
            .where("reminderTime", "<=", nowISO)
            .limit(50) // cap per run to avoid timeout
            .get();

        if (dueSnap.empty) {
            return res.status(200).json({ processed: 0 });
        }

        let processed = 0;
        await Promise.allSettled(
            dueSnap.docs.map(async (doc) => {
                const data = doc.data();
                const { uid, title, notes, url, repeat, reminderTime } = data;

                // Send push
                await sendPushToUser(
                    firestore,
                    uid,
                    `⏰ ${title}`,
                    notes || "Your reminder is due now.",
                    url || "/app/reminders"
                );

                // Mark sent or advance next occurrence for repeating reminders
                if (repeat === "none") {
                    await doc.ref.update({ sent: true });
                } else if (repeat === "daily") {
                    const next = new Date(reminderTime);
                    next.setDate(next.getDate() + 1);
                    await doc.ref.update({ reminderTime: next.toISOString(), sent: false });
                } else if (repeat === "weekly") {
                    const next = new Date(reminderTime);
                    next.setDate(next.getDate() + 7);
                    await doc.ref.update({ reminderTime: next.toISOString(), sent: false });
                }

                processed++;
            })
        );

        return res.status(200).json({ processed });
    } catch (err) {
        console.error("[cron/send-reminders] error:", err);
        return res.status(500).json({ error: err.message });
    }
}

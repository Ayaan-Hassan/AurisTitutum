/**
 * POST /api/push/send
 *
 * Sends a Web Push notification to all registered subscriptions for a user.
 *
 * Body: { uid, title, body, url }
 *
 * This endpoint is designed to be called from internal cron jobs or trusted
 * server-side code only. In production, protect it with a shared secret:
 *   header  X-Cron-Secret: <CRON_SECRET env var>
 */

import webpush from "web-push";
import { handleCors } from "../_lib/cors.js";
import { getAdminApp } from "../_lib/firebaseAdmin.js";

webpush.setVapidDetails(
    process.env.VAPID_SUBJECT,          // e.g. "mailto:you@yourdomain.com"
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY,
);

export default async function handler(req, res) {
    if (handleCors(req, res)) return;
    if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

    // Protect with shared secret when called from cron
    const cronSecret = process.env.CRON_SECRET;
    if (cronSecret) {
        const provided = req.headers["x-cron-secret"];
        if (provided !== cronSecret) {
            return res.status(403).json({ error: "Forbidden" });
        }
    }

    const { uid, title, body, url } = req.body || {};
    if (!uid || !title) {
        return res.status(400).json({ error: "uid and title are required" });
    }

    try {
        const { firestore } = getAdminApp();

        const subsSnap = await firestore
            .collection("users")
            .doc(uid)
            .collection("pushSubscriptions")
            .get();

        if (subsSnap.empty) {
            return res.status(200).json({ sent: 0, message: "No subscriptions registered" });
        }

        const payload = JSON.stringify({ title, body: body || "", url: url || "/" });
        const sendResults = await Promise.allSettled(
            subsSnap.docs.map(async (doc) => {
                const sub = doc.data();
                const pushSub = {
                    endpoint: sub.endpoint,
                    keys: { p256dh: sub.keys.p256dh, auth: sub.keys.auth },
                };

                try {
                    await webpush.sendNotification(pushSub, payload);
                } catch (err) {
                    // 410 Gone — subscription is expired/unsubscribed; remove it
                    if (err.statusCode === 410) {
                        await doc.ref.delete();
                    }
                    throw err;
                }
            })
        );

        const succeeded = sendResults.filter((r) => r.status === "fulfilled").length;
        const failed = sendResults.filter((r) => r.status === "rejected").length;

        return res.status(200).json({ sent: succeeded, failed });
    } catch (err) {
        console.error("[push/send] error:", err);
        return res.status(500).json({ error: err.message || "Internal server error" });
    }
}

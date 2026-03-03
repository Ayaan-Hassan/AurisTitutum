/**
 * api/push.js
 * 
 * Consolidated handler for Web Push operations:
 * - POST /api/push/register
 * - POST /api/push/send
 */

import webpush from "web-push";
import { handleCors } from "./_lib/cors.js";
import { getAdminApp } from "./_lib/firebaseAdmin.js";

webpush.setVapidDetails(
    process.env.VAPID_SUBJECT,
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
);

export default async function handler(req, res) {
    if (handleCors(req, res)) return;

    const { op } = req.query;

    // ─── POST /api/push/register ───────────────────────────────────────────────
    if (op === "register" || req.url.includes("register")) {
        if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
        const authHeader = req.headers.authorization || "";
        const idToken = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : null;
        if (!idToken) return res.status(401).json({ error: "Missing ID token" });

        try {
            const { auth, firestore } = getAdminApp();
            const decoded = await auth.verifyIdToken(idToken);
            const uid = decoded.uid;
            const { subscription } = req.body || {};

            const subsCol = firestore.collection("users").doc(uid).collection("pushSubscriptions");
            const existing = await subsCol.where("endpoint", "==", subscription.endpoint).get();
            if (existing.empty) {
                await subsCol.add({
                    endpoint: subscription.endpoint,
                    keys: subscription.keys,
                    createdAt: new Date().toISOString()
                });
            }
            return res.status(200).json({ success: true });
        } catch (err) {
            return res.status(500).json({ error: err.message });
        }
    }

    // ─── POST /api/push/send ───────────────────────────────────────────────────
    if (op === "send" || req.url.includes("send")) {
        if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
        const cronSecret = process.env.CRON_SECRET;
        if (cronSecret && req.headers["x-cron-secret"] !== cronSecret) {
            return res.status(403).json({ error: "Forbidden" });
        }

        const { uid, title, body, url } = req.body || {};
        try {
            const { firestore } = getAdminApp();
            const subs = await firestore.collection("users").doc(uid).collection("pushSubscriptions").get();
            if (subs.empty) return res.status(200).json({ sent: 0 });

            const payload = JSON.stringify({ title, body: body || "", url: url || "/" });
            const results = await Promise.allSettled(subs.docs.map(async (doc) => {
                try {
                    await webpush.sendNotification({ endpoint: doc.data().endpoint, keys: doc.data().keys }, payload);
                } catch (err) {
                    if (err.statusCode === 410) await doc.ref.delete();
                    throw err;
                }
            }));
            return res.status(200).json({ sent: results.filter(r => r.status === "fulfilled").length });
        } catch (err) {
            return res.status(500).json({ error: err.message });
        }
    }

    return res.status(404).json({ error: "Route not found" });
}

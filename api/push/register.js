/**
 * POST /api/push/register
 *
 * Registers a Web Push subscription for an authenticated user.
 * Verifies the Firebase ID token, then stores the PushSubscription
 * in Firestore at:  users/{uid}/pushSubscriptions/{autoId}
 *
 * Body: { subscription: PushSubscription }
 * Header: Authorization: Bearer <firebase-id-token>
 */

import { handleCors } from "../_lib/cors.js";
import { getAdminApp } from "../_lib/firebaseAdmin.js";

export default async function handler(req, res) {
    if (handleCors(req, res)) return;
    if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

    const authHeader = req.headers.authorization || "";
    const idToken = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : null;

    if (!idToken) {
        return res.status(401).json({ error: "Missing Authorization header" });
    }

    const { subscription } = req.body || {};
    if (!subscription?.endpoint || !subscription?.keys?.p256dh || !subscription?.keys?.auth) {
        return res.status(400).json({ error: "Invalid push subscription object" });
    }

    try {
        const { auth, firestore } = getAdminApp();

        // Verify Firebase ID token and extract uid
        const decoded = await auth.verifyIdToken(idToken);
        const uid = decoded.uid;

        // Store subscription in Firestore
        const subsColRef = firestore
            .collection("users")
            .doc(uid)
            .collection("pushSubscriptions");

        // Avoid duplicate endpoints
        const existing = await subsColRef
            .where("endpoint", "==", subscription.endpoint)
            .limit(1)
            .get();

        if (existing.empty) {
            await subsColRef.add({
                endpoint: subscription.endpoint,
                keys: {
                    p256dh: subscription.keys.p256dh,
                    auth: subscription.keys.auth,
                },
                createdAt: new Date().toISOString(),
            });
        }

        return res.status(200).json({ success: true });
    } catch (err) {
        console.error("[push/register] error:", err);
        const status = err.code === "auth/id-token-expired" ? 401 : 500;
        return res.status(status).json({ error: err.message || "Internal server error" });
    }
}

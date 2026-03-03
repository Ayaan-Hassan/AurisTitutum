/**
 * api/state.js
 * 
 * Consolidated handler for app state snapshot operations:
 * - GET  /api/state/get
 * - POST /api/state/set
 */

import { handleCors } from "./_lib/cors.js";
import { getUserState, setUserState } from "./_lib/store.js";

export default async function handler(req, res) {
    if (handleCors(req, res)) return;

    const { op } = req.query;

    // ─── GET /api/state/get ────────────────────────────────────────────────────
    if (op === "get" || (req.method === "GET" && req.url.includes("get"))) {
        const { userId } = req.query;
        if (!userId) return res.status(400).json({ error: "userId is required" });
        try {
            const state = await getUserState(userId);
            return res.status(200).json({ state: state ?? null });
        } catch (err) {
            return res.status(500).json({ error: err.message });
        }
    }

    // ─── POST /api/state/set ───────────────────────────────────────────────────
    if (op === "set" || (req.method === "POST" && req.url.includes("set"))) {
        const { userId, state } = req.body || {};
        if (!userId) return res.status(400).json({ error: "userId is required" });
        try {
            await setUserState(userId, state);
            return res.status(200).json({ success: true });
        } catch (err) {
            return res.status(500).json({ error: err.message });
        }
    }

    return res.status(404).json({ error: "Route not found" });
}

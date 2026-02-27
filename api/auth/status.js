/**
 * GET /api/auth/status
 *
 * Returns the current Google Sheets connection status for a given userId.
 * Called by the frontend Settings page on mount to determine whether to
 * show the "Connect" or "Disconnect" button.
 *
 * Query params:
 *   userId {string} required — Firebase UID or device ID
 *
 * Response (connected):
 *   { connected: true, sheetUrl, spreadsheetId, connectedAt }
 *
 * Response (not connected):
 *   { connected: false }
 */

import { handleCors } from "../_lib/cors.js";
import { getUser } from "../_lib/store.js";

export default async function handler(req, res) {
  // ── CORS / preflight ─────────────────────────────────────────────────────
  if (handleCors(req, res)) return;

  // ── Method guard ─────────────────────────────────────────────────────────
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  // ── Validate required param ──────────────────────────────────────────────
  const { userId } = req.query;

  if (!userId) {
    return res.status(400).json({ error: "userId is required" });
  }

  // ── Look up stored data ──────────────────────────────────────────────────
  let userData = null;
  try {
    userData = await getUser(userId);
  } catch (err) {
    console.error("[auth/status] Store read error:", err.message);
    // Treat a store error as "not connected" — the frontend will show the
    // Connect button and the user can re-authorise
    return res.status(200).json({ connected: false });
  }

  if (!userData) {
    return res.status(200).json({ connected: false });
  }

  // ── Return connection metadata (never return raw tokens to the client) ───
  return res.status(200).json({
    connected: true,
    sheetUrl: userData.sheetUrl ?? null,
    spreadsheetId: userData.spreadsheetId ?? null,
    connectedAt: userData.connectedAt ?? null,
  });
}

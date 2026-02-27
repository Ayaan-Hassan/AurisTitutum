/**
 * GET /api/auth/status
 *
 * Returns Google Sheets connection status for a Firebase UID.
 *
 * Query params:
 *   userId {string} required - Firebase UID
 */

import { handleCors } from "../_lib/cors.js";
import { getUser } from "../_lib/store.js";

export default async function handler(req, res) {
  // CORS / preflight
  if (handleCors(req, res)) return;

  // Method guard
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { userId } = req.query;

  if (!userId) {
    return res.status(400).json({ error: "userId is required" });
  }

  let userData = null;
  try {
    userData = await getUser(userId);
  } catch (err) {
    console.error("[auth/status] Store read error:", err.message);
    return res.status(200).json({ connected: false });
  }

  if (!userData) {
    return res.status(200).json({ connected: false });
  }

  return res.status(200).json({
    connected: true,
    sheetUrl: userData.sheetUrl ?? null,
    spreadsheetId: userData.spreadsheetId ?? null,
    connectedAt: userData.connectedAt ?? null,
  });
}

/**
 * POST /api/auth/disconnect
 *
 * Removes all stored OAuth tokens and spreadsheet metadata for a user.
 * Called when the user clicks "Disconnect Google Sheets" in Settings.
 *
 * After this call the user's data is fully wiped from the KV store.
 * They will need to go through the OAuth consent flow again if they
 * want to reconnect.
 *
 * Body (JSON):
 *   { userId: string }  — Firebase UID or device ID
 *
 * Response:
 *   200  { success: true }
 *   400  { error: "userId is required" }
 *   405  { error: "Method not allowed" }
 *   500  { error: string }
 */

import { handleCors } from "../_lib/cors.js";
import { deleteUser, hasUser } from "../_lib/store.js";

export default async function handler(req, res) {
  // ── CORS / preflight ─────────────────────────────────────────────────────
  if (handleCors(req, res)) return;

  // ── Method guard ─────────────────────────────────────────────────────────
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  // ── Parse body ───────────────────────────────────────────────────────────
  // Vercel automatically parses JSON bodies when Content-Type is
  // application/json, so req.body is already an object.
  const { userId } = req.body ?? {};

  if (!userId || typeof userId !== "string" || !userId.trim()) {
    return res.status(400).json({ error: "userId is required" });
  }

  // ── Delete from store ────────────────────────────────────────────────────
  try {
    const existed = await hasUser(userId);
    await deleteUser(userId);

    return res.status(200).json({
      success: true,
      // Let the caller know whether there was actually anything to remove
      wasConnected: existed,
    });
  } catch (err) {
    console.error("[disconnect] Failed to delete user data:", err.message);
    return res.status(500).json({
      error: "Failed to disconnect. Please try again.",
    });
  }
}

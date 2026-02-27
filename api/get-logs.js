/**
 * GET /api/get-logs
 *
 * Reads all log rows from the user's Google Spreadsheet and returns them
 * as a JSON array. Used for two-way sync: Google Sheet → web app.
 *
 * This lets users edit their habit log directly in Google Sheets and have
 * those edits reflected back in the app on next sync.
 *
 * Query params:
 *   userId {string} required — Firebase UID or device ID
 *
 * Response:
 *   200  { logs: Array<{ date, habit, type, status, value, timestamp }> }
 *   400  { error: "userId is required" }
 *   401  { error: "User not connected..." }
 *   405  { error: "Method not allowed" }
 *   500  { error: string }
 */

import { google } from "googleapis";
import { handleCors } from "./_lib/cors.js";
import { getAuthenticatedClient } from "./_lib/oauth.js";

export default async function handler(req, res) {
  // ── CORS / preflight ───────────────────────────────────────────────────────
  if (handleCors(req, res)) return;

  // ── Method guard ───────────────────────────────────────────────────────────
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  // ── Validate required param ────────────────────────────────────────────────
  const { userId } = req.query;

  if (!userId || typeof userId !== "string" || !userId.trim()) {
    return res.status(400).json({ error: "userId is required" });
  }

  // ── Resolve authenticated Sheets client ────────────────────────────────────
  let client;
  let spreadsheetId;

  try {
    ({ client, spreadsheetId } = await getAuthenticatedClient(userId));
  } catch (err) {
    // getAuthenticatedClient throws when:
    //  - User has no stored data (never connected)
    //  - Token refresh failed (re-auth required)
    const isAuthError =
      err.message.includes("not connected") ||
      err.message.includes("refresh failed") ||
      err.message.includes("reconnect");

    return res
      .status(isAuthError ? 401 : 500)
      .json({ error: err.message });
  }

  // ── Fetch rows from the spreadsheet ───────────────────────────────────────
  try {
    const sheets = google.sheets({ version: "v4", auth: client });

    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      // A2:F — skip row 1 (the formatted header row written on first connect)
      range: "Logs!A2:F",
    });

    const rows = response.data.values ?? [];

    // Map raw 2-D array to named objects; guard against short / empty rows
    const logs = rows
      .map((row) => ({
        date:      row[0] ?? "",
        habit:     row[1] ?? "",
        type:      row[2] ?? "",
        status:    row[3] ?? "",
        value:     row[4] ?? "",
        timestamp: row[5] ?? "",
      }))
      // Drop rows that are missing the two required fields
      .filter((log) => log.date.trim() !== "" && log.habit.trim() !== "");

    return res.status(200).json({ logs });
  } catch (err) {
    console.error("[get-logs] Sheets API error:", err.message);
    return res.status(500).json({
      error: `Failed to read from Google Sheets: ${err.message}`,
    });
  }
}

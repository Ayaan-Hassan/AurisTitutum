/**
 * POST /api/append-log
 *
 * Appends a single activity log entry as a new row to the user's
 * Google Spreadsheet. Called every time the user logs a habit action
 * (tap, count increment, or check-mark).
 *
 * Body (JSON):
 *   {
 *     userId    {string}  required — Firebase UID or device ID
 *     habit     {string}  required — habit name
 *     date      {string}  required — YYYY-MM-DD
 *     type      {string}  optional — "Good" | "Bad"
 *     status    {string}  optional — defaults to "logged"
 *     value     {string|number} optional — count / unit value if applicable
 *     timestamp {string}  optional — ISO timestamp; defaults to now
 *   }
 *
 * Response 200:
 *   { success: true }
 *
 * Response 400:
 *   { error: string }
 *
 * Response 500:
 *   { error: string }
 */

import { google } from "googleapis";
import { handleCors } from "./_lib/cors.js";
import { getAuthenticatedClient } from "./_lib/oauth.js";

// Vercel's Node.js serverless runtime automatically parses JSON request bodies
// when the client sends Content-Type: application/json — req.body is already
// a plain object by the time the handler runs. The `config.api.bodyParser`
// export is a Next.js-only convention and has no effect here; Vercel's default
// body-size limit (1 MB) is more than sufficient for a single log entry.

export default async function handler(req, res) {
  // ── CORS / preflight ───────────────────────────────────────────────────────
  if (handleCors(req, res)) return;

  // ── Method guard ───────────────────────────────────────────────────────────
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  // ── Parse + validate body ──────────────────────────────────────────────────
  const body = req.body ?? {};
  const { userId, habit, date, type, status, value, timestamp } = body;

  if (!userId || typeof userId !== "string" || !userId.trim()) {
    return res.status(400).json({ error: "userId is required" });
  }

  if (!habit || typeof habit !== "string" || !habit.trim()) {
    return res.status(400).json({ error: "habit name is required" });
  }

  if (!date || typeof date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return res
      .status(400)
      .json({ error: "date is required and must be in YYYY-MM-DD format" });
  }

  // ── Resolve authenticated Google client ────────────────────────────────────
  let client;
  let spreadsheetId;

  try {
    ({ client, spreadsheetId } = await getAuthenticatedClient(userId));
  } catch (err) {
    // getAuthenticatedClient throws with a user-friendly message when the
    // user is not connected or the token refresh failed
    return res.status(401).json({ error: err.message });
  }

  // ── Append the row to the spreadsheet ─────────────────────────────────────
  try {
    const sheets = google.sheets({ version: "v4", auth: client });

    const row = [
      date, // A — Date
      String(habit).trim(), // B — Habit
      type ? String(type) : "", // C — Type  (Good / Bad)
      status ? String(status) : "logged", // D — Status
      value != null ? String(value) : "", // E — Value (count / unit)
      timestamp ? String(timestamp) : new Date().toISOString(), // F — Synced At
    ];

    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: "Logs!A:F",
      valueInputOption: "RAW",
      // INSERT_ROWS ensures we never overwrite existing data; each append
      // adds a fresh row below the last populated cell in the range
      insertDataOption: "INSERT_ROWS",
      requestBody: { values: [row] },
    });

    return res.status(200).json({ success: true });
  } catch (err) {
    console.error("[append-log] Sheets API error:", err.message);
    return res.status(500).json({ error: err.message });
  }
}

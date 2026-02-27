/**
 * POST /api/sync-logs
 *
 * Bulk-syncs the entire habits log history to the user's Google Spreadsheet.
 * Clears all existing data rows (preserving the styled header in row 1),
 * then writes every log entry in a single append call.
 *
 * This is the "full sync" operation triggered by the user clicking
 * "Sync to Sheets" in Settings. It is idempotent — running it multiple
 * times produces the same result.
 *
 * Body (JSON):
 *   {
 *     userId: string,          — Firebase UID or device ID
 *     logs: Array<{
 *       date:      string,     — YYYY-MM-DD
 *       habit:     string,     — habit name
 *       type:      string,     — "Good" | "Bad"
 *       status:    string,     — "logged"
 *       value:     string,     — count / unit string, may be empty
 *       timestamp: string,     — ISO or "YYYY-MM-DD HH:MM:SS"
 *     }>
 *   }
 *
 * Response (success):
 *   200  { success: true, count: number }
 *
 * Response (error):
 *   400  { error: string }   — missing / invalid params
 *   405  { error: string }   — wrong HTTP method
 *   500  { error: string }   — Sheets API or token error
 */

import { google } from "googleapis";
import { handleCors } from "./_lib/cors.js";
import { getAuthenticatedClient } from "./_lib/oauth.js";

export default async function handler(req, res) {
  // ── CORS / preflight ───────────────────────────────────────────────────────
  if (handleCors(req, res)) return;

  // ── Method guard ───────────────────────────────────────────────────────────
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  // ── Parse and validate body ────────────────────────────────────────────────
  // Vercel automatically parses JSON bodies — req.body is already an object.
  const { userId, logs } = req.body ?? {};

  if (!userId || typeof userId !== "string" || !userId.trim()) {
    return res.status(400).json({ error: "userId is required" });
  }

  if (!Array.isArray(logs)) {
    return res.status(400).json({
      error: "logs must be an array",
    });
  }

  if (logs.length === 0) {
    return res.status(400).json({
      error: "logs array must not be empty — nothing to sync",
    });
  }

  // ── Resolve authenticated Sheets client ────────────────────────────────────
  let client, spreadsheetId;
  try {
    ({ client, spreadsheetId } = await getAuthenticatedClient(userId));
  } catch (err) {
    // getAuthenticatedClient throws descriptive messages the frontend can show
    return res.status(500).json({ error: err.message });
  }

  const sheets = google.sheets({ version: "v4", auth: client });

  try {
    // ── Step 1: Clear all existing data rows (keep header in row 1) ──────────
    await sheets.spreadsheets.values.clear({
      spreadsheetId,
      // A2:F clears from the second row downwards — row 1 (header) is untouched
      range: "Logs!A2:F",
    });

    // ── Step 2: Build the rows array ─────────────────────────────────────────
    const rows = logs.map((log) => [
      // Coerce all values to strings; empty string is the safe default
      typeof log.date === "string" ? log.date : "",
      typeof log.habit === "string" ? log.habit : "",
      typeof log.type === "string" ? log.type : "",
      typeof log.status === "string" ? log.status : "logged",
      // value can be a number (count) or a formatted string like "30 min"
      log.value !== undefined && log.value !== null ? String(log.value) : "",
      typeof log.timestamp === "string"
        ? log.timestamp
        : new Date().toISOString(),
    ]);

    // ── Step 3: Append all rows in a single API call ──────────────────────────
    // We use append (not update) so Google Sheets automatically expands the
    // sheet if the data is larger than the current grid.
    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: "Logs!A2:F",
      valueInputOption: "RAW",
      insertDataOption: "INSERT_ROWS",
      requestBody: { values: rows },
    });

    return res.status(200).json({ success: true, count: rows.length });
  } catch (err) {
    console.error("[sync-logs] Sheets API error:", err.message);
    return res.status(500).json({ error: err.message });
  }
}

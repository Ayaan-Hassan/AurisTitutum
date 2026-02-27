/**
 * POST /api/sync-logs
 *
 * Bulk-syncs the entire habits log history to the user's Google Spreadsheet.
 *
 * Body (JSON):
 *   {
 *     userId: string,  - Firebase UID
 *     logs: Array<...>
 *   }
 */

import { google } from "googleapis";
import { handleCors } from "./_lib/cors.js";
import { getAuthenticatedClient } from "./_lib/oauth.js";

export default async function handler(req, res) {
  // CORS / preflight
  if (handleCors(req, res)) return;

  // Method guard
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  // Vercel automatically parses JSON bodies
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
      error: "logs array must not be empty - nothing to sync",
    });
  }

  let client, spreadsheetId;
  try {
    ({ client, spreadsheetId } = await getAuthenticatedClient(userId));
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }

  const sheets = google.sheets({ version: "v4", auth: client });

  try {
    await sheets.spreadsheets.values.clear({
      spreadsheetId,
      range: "Logs!A2:F",
    });

    const rows = logs.map((log) => [
      typeof log.date === "string" ? log.date : "",
      typeof log.habit === "string" ? log.habit : "",
      typeof log.type === "string" ? log.type : "",
      typeof log.status === "string" ? log.status : "logged",
      log.value !== undefined && log.value !== null ? String(log.value) : "",
      typeof log.timestamp === "string"
        ? log.timestamp
        : new Date().toISOString(),
    ]);

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

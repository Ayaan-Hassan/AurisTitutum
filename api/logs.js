/**
 * api/logs.js
 * 
 * Consolidated handler for all habit logging operations:
 * - POST /api/append-log
 * - POST /api/get-logs
 * - POST /api/sync-logs
 */

import { google } from "googleapis";
import { handleCors } from "./_lib/cors.js";
import { getAuthenticatedClient } from "./_lib/oauth.js";

export default async function handler(req, res) {
    if (handleCors(req, res)) return;

    // Use a query param or part of the URL to route.
    // When using vercel.json rewrites, we can pass an 'op' param.
    const { op } = req.query;

    // ─── POST /api/append-log ──────────────────────────────────────────────────
    if (op === "append" || req.url.includes("append-log")) {
        if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
        const { userId, habit, date, type, status, value, timestamp, tokens, spreadsheetId: inputSpreadsheetId } = req.body || {};

        if (!userId || !habit || !date) return res.status(400).json({ error: "Missing required fields" });

        try {
            const { client, spreadsheetId } = await getAuthenticatedClient(userId, tokens, inputSpreadsheetId);
            const sheets = google.sheets({ version: "v4", auth: client });
            const row = [
                date,
                String(habit).trim(),
                type ? String(type) : "",
                status ? String(status) : "logged",
                value != null ? String(value) : "",
                timestamp ? String(timestamp) : new Date().toISOString(),
            ];

            await sheets.spreadsheets.values.append({
                spreadsheetId,
                range: "Logs!A:F",
                valueInputOption: "RAW",
                insertDataOption: "INSERT_ROWS",
                requestBody: { values: [row] },
            });
            return res.status(200).json({ success: true });
        } catch (err) {
            return res.status(err.message.includes("not connected") ? 401 : 500).json({ error: err.message });
        }
    }

    // ─── POST /api/get-logs ────────────────────────────────────────────────────
    if (op === "get" || req.url.includes("get-logs")) {
        if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
        const { userId, tokens, spreadsheetId: inputSpreadsheetId } = req.body || {};
        if (!userId) return res.status(400).json({ error: "userId is required" });

        try {
            const { client, spreadsheetId } = await getAuthenticatedClient(userId, tokens, inputSpreadsheetId);
            const sheets = google.sheets({ version: "v4", auth: client });
            const response = await sheets.spreadsheets.values.get({ spreadsheetId, range: "Logs!A2:F" });
            const rows = response.data.values ?? [];
            const logs = rows
                .map((row) => ({
                    date: row[0] ?? "",
                    habit: row[1] ?? "",
                    type: row[2] ?? "",
                    status: row[3] ?? "",
                    value: row[4] ?? "",
                    timestamp: row[5] ?? "",
                }))
                .filter((log) => log.date.trim() !== "" && log.habit.trim() !== "");
            return res.status(200).json({ logs });
        } catch (err) {
            return res.status(err.message.includes("not connected") ? 401 : 500).json({ error: err.message });
        }
    }

    // ─── POST /api/sync-logs ───────────────────────────────────────────────────
    if (op === "sync" || req.url.includes("sync-logs")) {
        if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
        const { userId, logs, tokens, spreadsheetId: inputSpreadsheetId } = req.body || {};
        if (!userId || !Array.isArray(logs) || logs.length === 0) {
            return res.status(400).json({ error: "Invalid logs payload" });
        }

        try {
            const { client, spreadsheetId } = await getAuthenticatedClient(userId, tokens, inputSpreadsheetId);
            const sheets = google.sheets({ version: "v4", auth: client });
            await sheets.spreadsheets.values.clear({ spreadsheetId, range: "Logs!A2:F" });
            const rows = logs.map((log) => [
                log.date || "",
                log.habit || "",
                log.type || "",
                log.status || "logged",
                log.value != null ? String(log.value) : "",
                log.timestamp || new Date().toISOString(),
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
            return res.status(err.message.includes("not connected") ? 401 : 500).json({ error: err.message });
        }
    }

    return res.status(404).json({ error: "Route not found" });
}

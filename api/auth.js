/**
 * api/auth.js
 * 
 * Consolidated Google Auth & Sheets Connection handlers:
 * - GET  /api/auth/status
 * - POST /api/auth/disconnect
 * - GET  /api/auth/google
 * - GET  /api/auth/google/callback
 */

import { google } from "googleapis";
import { handleCors } from "./_lib/cors.js";
import { createOAuthClient, SCOPES } from "./_lib/oauth.js";
import { getUser, setUser, deleteUser, hasUser } from "./_lib/store.js";

async function createSpreadsheet(sheets) {
    const { data } = await sheets.spreadsheets.create({
        requestBody: {
            properties: { title: "Auristitutum Habit Logs" },
            sheets: [{ properties: { title: "Logs", gridProperties: { frozenRowCount: 1 } } }],
        },
    });
    const spreadsheetId = data.spreadsheetId;
    const SheetId = data.sheets[0].properties.sheetId;
    const sheetUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`;

    await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: "Logs!A1:F1",
        valueInputOption: "RAW",
        requestBody: { values: [["Date", "Habit", "Type", "Status", "Value", "Synced At"]] },
    });

    await sheets.spreadsheets.batchUpdate({
        spreadsheetId,
        requestBody: {
            requests: [
                {
                    repeatCell: {
                        range: { sheetId: SheetId, startRowIndex: 0, endRowIndex: 1, startColumnIndex: 0, endColumnIndex: 6 },
                        cell: {
                            userEnteredFormat: {
                                backgroundColor: { red: 0.88, green: 0.88, blue: 0.88 },
                                textFormat: { bold: true, fontSize: 11 },
                                horizontalAlignment: "CENTER",
                            },
                        },
                        fields: "userEnteredFormat(backgroundColor,textFormat,horizontalAlignment)",
                    },
                },
            ],
        },
    });
    return { spreadsheetId, sheetUrl };
}

export default async function handler(req, res) {
    if (handleCors(req, res)) return;

    const protocol = req.headers["x-forwarded-proto"] || (String(req.headers.host || "").includes("localhost") ? "http" : "https");
    const FRONTEND = process.env.FRONTEND_URL || `${protocol}://${req.headers.host}`;
    const { op } = req.query;

    // ─── GET /api/auth/status ──────────────────────────────────────────────────
    if (op === "status" || req.url.includes("auth/status")) {
        if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });
        const { userId } = req.query;
        if (!userId) return res.status(400).json({ error: "userId is required" });
        try {
            const userData = await getUser(userId);
            if (!userData) return res.status(200).json({ connected: false });
            return res.status(200).json({
                connected: true,
                sheetUrl: userData.sheetUrl ?? null,
                spreadsheetId: userData.spreadsheetId ?? null,
                connectedAt: userData.connectedAt ?? null,
            });
        } catch (err) {
            return res.status(500).json({ error: err.message });
        }
    }

    // ─── POST /api/auth/disconnect ─────────────────────────────────────────────
    if (op === "disconnect" || req.url.includes("auth/disconnect")) {
        if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
        const { userId } = req.body || {};
        if (!userId) return res.status(400).json({ error: "userId is required" });
        try {
            const existed = await hasUser(userId);
            await deleteUser(userId);
            return res.status(200).json({ success: true, wasConnected: existed });
        } catch (err) {
            return res.status(500).json({ error: err.message });
        }
    }

    // ─── GET /api/auth/google (Initiate) ───────────────────────────────────────
    if (op === "google" || (req.url.includes("auth/google") && !req.url.includes("callback"))) {
        const { userId, userEmail } = req.query;
        if (!userId) return res.redirect(`${FRONTEND}/app/settings?sheets_error=Missing%20userId`);
        try {
            const client = createOAuthClient();
            const authUrl = client.generateAuthUrl({ access_type: "offline", scope: SCOPES, state: userId, ...(userEmail ? { login_hint: userEmail } : {}) });
            return res.redirect(authUrl);
        } catch (err) {
            return res.redirect(`${FRONTEND}/app/settings?sheets_error=${encodeURIComponent(err.message)}`);
        }
    }

    // ─── GET /api/auth/google/callback ─────────────────────────────────────────
    if (op === "callback" || req.url.includes("auth/google/callback")) {
        const { code, state: userId, error } = req.query;
        if (error) return res.redirect(`${FRONTEND}/app/settings?sheets_error=${encodeURIComponent(error)}`);
        if (!code || !userId) return res.redirect(`${FRONTEND}/app/settings?sheets_error=Missing%20auth%20data`);

        try {
            const client = createOAuthClient();
            const { tokens } = await client.getToken(code);
            client.setCredentials(tokens);

            let existingUser = await getUser(userId).catch(() => null);
            let spreadsheetId = existingUser?.spreadsheetId;
            let sheetUrl = existingUser?.sheetUrl;

            if (!spreadsheetId) {
                const sheets = google.sheets({ version: "v4", auth: client });
                ({ spreadsheetId, sheetUrl } = await createSpreadsheet(sheets));
            }

            const storedTokens = {
                access_token: tokens.access_token,
                refresh_token: tokens.refresh_token ?? existingUser?.tokens?.refresh_token ?? null,
                expiry_date: tokens.expiry_date ?? null,
            };

            const payload = JSON.stringify({ tokens: storedTokens, spreadsheetId, sheetUrl, connectedAt: new Date().toISOString() });
            return res.redirect(`${FRONTEND}/app/settings?sheets_connected=true&sheet_url=${encodeURIComponent(sheetUrl)}&sheets_payload=${encodeURIComponent(payload)}`);
        } catch (err) {
            return res.redirect(`${FRONTEND}/app/settings?sheets_error=${encodeURIComponent(err.message)}`);
        }
    }

    return res.status(404).json({ error: "Route not found" });
}

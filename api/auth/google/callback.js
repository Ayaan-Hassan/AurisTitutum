/**
 * GET /api/auth/google/callback
 *
 * OAuth 2.0 callback handler — Google redirects here after the user
 * grants (or denies) consent on the Google account picker screen.
 *
 * Flow:
 *  1. Read `code` and `state` (userId) from query params.
 *  2. Exchange the auth code for access + refresh tokens.
 *  3. If this user has never connected before → create a new Google
 *     Spreadsheet with formatted headers and a frozen first row.
 *     If they have connected before → reuse the existing spreadsheetId.
 *  4. Persist tokens + spreadsheet metadata to the KV store.
 *  5. Redirect the user back to the frontend Settings page with either
 *     a success query param or an error query param.
 *
 * No JSON is ever returned — this handler only ever issues 302 redirects
 * because the browser navigated here directly (it is not a fetch() call).
 *
 * Environment variables required:
 *   GOOGLE_CLIENT_ID      — OAuth client ID
 *   GOOGLE_CLIENT_SECRET  — OAuth client secret
 *   GOOGLE_REDIRECT_URI   — must match exactly what is registered in
 *                           Google Cloud Console, e.g.
 *                           https://your-app.vercel.app/api/auth/google/callback
 *   FRONTEND_URL          — optional; if omitted the handler derives the
 *                           frontend origin from the incoming request host
 */

import { google } from "googleapis";
import { createOAuthClient } from "../../_lib/oauth.js";
import { getUser, setUser } from "../../_lib/store.js";

// ─── Spreadsheet bootstrap helpers ───────────────────────────────────────────

/**
 * Create a brand-new spreadsheet titled "Auristitutum Habit Logs",
 * write a styled header row, freeze it, and return the spreadsheet ID
 * and public edit URL.
 *
 * @param {import('googleapis').sheets_v4.Sheets} sheets
 * @returns {Promise<{ spreadsheetId: string, sheetUrl: string }>}
 */
async function createSpreadsheet(sheets) {
  // 1. Create the workbook
  const { data } = await sheets.spreadsheets.create({
    requestBody: {
      properties: {
        title: "Auristitutum Habit Logs",
      },
      sheets: [
        {
          properties: {
            title: "Logs",
            gridProperties: { frozenRowCount: 1 },
          },
        },
      ],
    },
  });

  const spreadsheetId = data.spreadsheetId;
  const SheetId = data.sheets[0].properties.sheetId;
  const sheetUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`;

  // 2. Write header row
  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: "Logs!A1:F1",
    valueInputOption: "RAW",
    requestBody: {
      values: [["Date", "Habit", "Type", "Status", "Value", "Synced At"]],
    },
  });

  // 3. Style header: bold text, light-gray background, centred, frozen
  await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: {
      requests: [
        {
          // Bold + background colour + centre-align the header row
          repeatCell: {
            range: {
              sheetId: SheetId,
              startRowIndex: 0,
              endRowIndex: 1,
              startColumnIndex: 0,
              endColumnIndex: 6,
            },
            cell: {
              userEnteredFormat: {
                backgroundColor: { red: 0.88, green: 0.88, blue: 0.88 },
                textFormat: { bold: true, fontSize: 11 },
                horizontalAlignment: "CENTER",
              },
            },
            fields:
              "userEnteredFormat(backgroundColor,textFormat,horizontalAlignment)",
          },
        },
        {
          // Ensure row 1 stays frozen (belt-and-braces — also set on create above)
          updateSheetProperties: {
            properties: {
              sheetId: SheetId,
              gridProperties: { frozenRowCount: 1 },
            },
            fields: "gridProperties.frozenRowCount",
          },
        },
      ],
    },
  });

  return { spreadsheetId, sheetUrl };
}

// ─── Handler ─────────────────────────────────────────────────────────────────

export default async function handler(req, res) {
  // Only GET is valid here — Google never POSTs to a callback URI
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  // Derive the frontend origin so we can redirect back to it.
  // FRONTEND_URL is optional when frontend + api live on the same Vercel
  // deployment (same host). We fall back to the request host in that case.
  const protocol =
    req.headers["x-forwarded-proto"] ||
    (String(req.headers.host || "").includes("localhost") ? "http" : "https");
  const FRONTEND =
    process.env.FRONTEND_URL || `${protocol}://${req.headers.host}`;

  const { code, state: userId, error } = req.query;

  // ── 1. Handle user-denied consent ─────────────────────────────────────────
  if (error) {
    return res.redirect(
      `${FRONTEND}/app/settings?sheets_error=${encodeURIComponent(error)}`,
    );
  }

  // ── 2. Validate required params ───────────────────────────────────────────
  if (!code) {
    return res.redirect(
      `${FRONTEND}/app/settings?sheets_error=${encodeURIComponent(
        "No authorisation code received from Google.",
      )}`,
    );
  }

  if (!userId) {
    return res.redirect(
      `${FRONTEND}/app/settings?sheets_error=${encodeURIComponent(
        "Missing state parameter. Please try connecting again.",
      )}`,
    );
  }

  // ── 3. Exchange authorisation code for tokens ─────────────────────────────
  let client;
  try {
    client = createOAuthClient();
  } catch (err) {
    return res.redirect(
      `${FRONTEND}/app/settings?sheets_error=${encodeURIComponent(
        `Server misconfiguration: ${err.message}`,
      )}`,
    );
  }

  let tokens;
  try {
    const { tokens: exchanged } = await client.getToken(code);
    tokens = exchanged;
    client.setCredentials(tokens);
  } catch (err) {
    return res.redirect(
      `${FRONTEND}/app/settings?sheets_error=${encodeURIComponent(
        `Token exchange failed: ${err.message}`,
      )}`,
    );
  }

  // ── 4. Load any previously stored data for this user ─────────────────────
  let existingUser = null;
  try {
    existingUser = await getUser(userId);
  } catch {
    // Non-fatal — treat as a first-time connection
  }

  // ── 5. Create or reuse the Google Spreadsheet ─────────────────────────────
  let spreadsheetId = existingUser?.spreadsheetId ?? null;
  let sheetUrl = existingUser?.sheetUrl ?? null;

  const sheets = google.sheets({ version: "v4", auth: client });

  if (!spreadsheetId) {
    try {
      ({ spreadsheetId, sheetUrl } = await createSpreadsheet(sheets));
    } catch (err) {
      return res.redirect(
        `${FRONTEND}/app/settings?sheets_error=${encodeURIComponent(
          `Failed to create spreadsheet: ${err.message}`,
        )}`,
      );
    }
  }

  // ── 6. Persist tokens + spreadsheet metadata to KV ───────────────────────
  // Google only issues a refresh_token on the very first consent grant.
  // On subsequent re-authorisations (e.g. token refresh failure) Google
  // may omit it, so we always fall back to the previously stored one.
  const storedTokens = {
    access_token: tokens.access_token,
    refresh_token:
      tokens.refresh_token ?? existingUser?.tokens?.refresh_token ?? null,
    expiry_date: tokens.expiry_date ?? null,
  };

  try {
    await setUser(userId, {
      tokens: storedTokens,
      spreadsheetId,
      sheetUrl,
      // Preserve the original connection timestamp if reconnecting
      connectedAt: existingUser?.connectedAt ?? new Date().toISOString(),
    });
  } catch (err) {
    console.error("[callback] Failed to persist user data:", err.message);
    return res.redirect(
      `${FRONTEND}/app/settings?sheets_error=${encodeURIComponent(
        `Failed to persist Google Sheets connection: ${err.message}`,
      )}`,
    );
  }

  // ── 7. Redirect back to the frontend with success params ─────────────────
  return res.redirect(
    `${FRONTEND}/app/settings` +
      `?sheets_connected=true` +
      `&sheet_url=${encodeURIComponent(sheetUrl)}`,
  );
}

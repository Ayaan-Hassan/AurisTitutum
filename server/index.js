import dotenv from "dotenv";
dotenv.config();

import express from "express";
import cors from "cors";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { google } from "googleapis";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;

// ============================================
// Persistent Store (survives server restarts)
// ============================================

const STORE_FILE = path.join(__dirname, ".userstore.json");

const loadStore = () => {
  try {
    if (fs.existsSync(STORE_FILE)) {
      const data = JSON.parse(fs.readFileSync(STORE_FILE, "utf-8"));
      return new Map(Object.entries(data));
    }
  } catch {
    // If file is corrupt, start fresh
  }
  return new Map();
};

const saveStore = () => {
  try {
    const obj = {};
    userStore.forEach((v, k) => {
      obj[k] = v;
    });
    fs.writeFileSync(STORE_FILE, JSON.stringify(obj, null, 2));
  } catch {
    // Non-fatal: store will still work in-memory
  }
};

const userStore = loadStore();

// ============================================
// Middleware
// ============================================

app.use(
  cors({
    origin: process.env.FRONTEND_URL || "http://localhost:5173",
    credentials: true,
  }),
);

app.use(express.json());

// ============================================
// OAuth2 Client
// ============================================

const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_REDIRECT_URI ||
    `http://localhost:${PORT}/auth/google/callback`,
);

const SCOPES = [
  "https://www.googleapis.com/auth/spreadsheets",
  "https://www.googleapis.com/auth/drive.file",
];

// ============================================
// Health Check
// ============================================

app.get("/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// ============================================
// OAuth Routes
// ============================================

/**
 * GET /auth/google
 * Redirects user to Google OAuth consent screen.
 * Uses login_hint to pre-select the user's Google account.
 * Does NOT force consent prompt if tokens already granted.
 */
app.get("/auth/google", (req, res) => {
  const { userId, userEmail } = req.query;

  if (!userId) {
    return res.status(400).json({ error: "userId is required" });
  }

  const authParams = {
    access_type: "offline",
    scope: SCOPES,
    state: userId,
  };

  // Pre-fill the Google account picker using the user's sign-in email
  if (userEmail) {
    authParams.login_hint = userEmail;
  }

  const authUrl = oauth2Client.generateAuthUrl(authParams);
  res.redirect(authUrl);
});

/**
 * GET /auth/google/callback
 * Handles OAuth callback: exchanges code, creates spreadsheet,
 * adds formatted headers, stores everything persistently.
 */
app.get("/auth/google/callback", async (req, res) => {
  const { code, state: userId, error } = req.query;
  const FRONTEND = process.env.FRONTEND_URL || "http://localhost:5173";

  if (error) {
    return res.redirect(
      `${FRONTEND}/app/settings?sheets_error=${encodeURIComponent(error)}`,
    );
  }

  if (!code) {
    return res.redirect(`${FRONTEND}/app/settings?sheets_error=no_code`);
  }

  try {
    // Exchange code for tokens
    const { tokens } = await oauth2Client.getToken(code);
    oauth2Client.setCredentials(tokens);

    const sheets = google.sheets({ version: "v4", auth: oauth2Client });

    // Check if user already has a spreadsheet — reuse it if so
    const existingUser = userStore.get(userId);
    let spreadsheetId = existingUser?.spreadsheetId || null;
    let sheetUrl = existingUser?.sheetUrl || null;

    if (!spreadsheetId) {
      // Create a new spreadsheet
      const spreadsheet = await sheets.spreadsheets.create({
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

      spreadsheetId = spreadsheet.data.spreadsheetId;
      sheetUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`;

      // A) Add header row
      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: "Logs!A1:F1",
        valueInputOption: "RAW",
        requestBody: {
          values: [["Date", "Habit", "Type", "Status", "Value", "Synced At"]],
        },
      });

      // B) Format header: bold, light gray background, freeze first row
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId,
        requestBody: {
          requests: [
            {
              repeatCell: {
                range: {
                  sheetId: 0,
                  startRowIndex: 0,
                  endRowIndex: 1,
                  startColumnIndex: 0,
                  endColumnIndex: 6,
                },
                cell: {
                  userEnteredFormat: {
                    backgroundColor: { red: 0.88, green: 0.88, blue: 0.88 },
                    textFormat: {
                      bold: true,
                      fontSize: 11,
                    },
                    horizontalAlignment: "CENTER",
                  },
                },
                fields:
                  "userEnteredFormat(backgroundColor,textFormat,horizontalAlignment)",
              },
            },
            {
              updateSheetProperties: {
                properties: {
                  sheetId: 0,
                  gridProperties: { frozenRowCount: 1 },
                },
                fields: "gridProperties.frozenRowCount",
              },
            },
          ],
        },
      });
    }

    // Store user data persistently
    userStore.set(userId, {
      tokens: {
        access_token: tokens.access_token,
        refresh_token:
          tokens.refresh_token || existingUser?.tokens?.refresh_token || null,
        expiry_date: tokens.expiry_date,
      },
      spreadsheetId,
      sheetUrl,
      connectedAt: existingUser?.connectedAt || new Date().toISOString(),
    });

    saveStore();

    res.redirect(
      `${FRONTEND}/app/settings?sheets_connected=true&sheet_url=${encodeURIComponent(sheetUrl)}`,
    );
  } catch (err) {
    res.redirect(
      `${FRONTEND}/app/settings?sheets_error=${encodeURIComponent(err.message)}`,
    );
  }
});

/**
 * GET /auth/status
 * Returns connection status and sheet URL for a user.
 */
app.get("/auth/status", (req, res) => {
  const { userId } = req.query;

  if (!userId) {
    return res.status(400).json({ error: "userId is required" });
  }

  const userData = userStore.get(userId);

  if (!userData) {
    return res.json({ connected: false });
  }

  res.json({
    connected: true,
    sheetUrl: userData.sheetUrl,
    spreadsheetId: userData.spreadsheetId,
    connectedAt: userData.connectedAt,
  });
});

/**
 * POST /auth/disconnect
 * Removes user's stored tokens and sheet reference.
 */
app.post("/auth/disconnect", (req, res) => {
  const { userId } = req.body;

  if (!userId) {
    return res.status(400).json({ error: "userId is required" });
  }

  if (userStore.has(userId)) {
    userStore.delete(userId);
    saveStore();
  }

  res.json({ success: true });
});

// ============================================
// Auth Helper — auto-refreshes tokens
// ============================================

async function getAuthenticatedClient(userId) {
  const userData = userStore.get(userId);

  if (!userData) {
    throw new Error("User not connected to Google Sheets");
  }

  const { tokens } = userData;

  const client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI ||
      `http://localhost:${PORT}/auth/google/callback`,
  );

  client.setCredentials(tokens);

  // Auto-refresh if token is expired or about to expire (within 60s)
  if (tokens.expiry_date && Date.now() >= tokens.expiry_date - 60000) {
    try {
      const { credentials } = await client.refreshAccessToken();

      userData.tokens = {
        access_token: credentials.access_token,
        refresh_token: credentials.refresh_token || tokens.refresh_token,
        expiry_date: credentials.expiry_date,
      };

      userStore.set(userId, userData);
      saveStore();

      client.setCredentials(userData.tokens);
    } catch {
      throw new Error(
        "Token refresh failed. Please reconnect Google Sheets in Settings.",
      );
    }
  }

  return { client, spreadsheetId: userData.spreadsheetId };
}

// ============================================
// Sheets API Routes
// ============================================

/**
 * POST /append-log
 * Append a single log entry to the user's spreadsheet.
 */
app.post("/append-log", async (req, res) => {
  const { userId, habit, date, type, status, value, timestamp } = req.body;

  if (!userId) return res.status(400).json({ error: "userId is required" });
  if (!habit || !date)
    return res.status(400).json({ error: "habit and date are required" });

  try {
    const { client, spreadsheetId } = await getAuthenticatedClient(userId);
    const sheets = google.sheets({ version: "v4", auth: client });

    const row = [
      date,
      habit,
      type || "",
      status || "logged",
      value || "",
      timestamp || new Date().toISOString(),
    ];

    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: "Logs!A:F",
      valueInputOption: "RAW",
      insertDataOption: "INSERT_ROWS",
      requestBody: { values: [row] },
    });

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /sync-logs
 * Bulk-sync all logs to the user's spreadsheet (clears existing data first).
 */
app.post("/sync-logs", async (req, res) => {
  const { userId, logs } = req.body;

  if (!userId) return res.status(400).json({ error: "userId is required" });
  if (!Array.isArray(logs) || logs.length === 0) {
    return res
      .status(400)
      .json({ error: "logs array is required and must not be empty" });
  }

  try {
    const { client, spreadsheetId } = await getAuthenticatedClient(userId);
    const sheets = google.sheets({ version: "v4", auth: client });

    // Clear existing data rows (keep header)
    await sheets.spreadsheets.values.clear({
      spreadsheetId,
      range: "Logs!A2:F",
    });

    const rows = logs.map((log) => [
      log.date || "",
      log.habit || "",
      log.type || "",
      log.status || "logged",
      log.value || "",
      log.timestamp || new Date().toISOString(),
    ]);

    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: "Logs!A2:F",
      valueInputOption: "RAW",
      insertDataOption: "INSERT_ROWS",
      requestBody: { values: rows },
    });

    res.json({ success: true, count: logs.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /get-logs
 * Reads all log rows from the user's spreadsheet and returns them.
 * Used for live two-way sync: sheet → web app.
 */
app.get("/get-logs", async (req, res) => {
  const { userId } = req.query;

  if (!userId) return res.status(400).json({ error: "userId is required" });

  try {
    const { client, spreadsheetId } = await getAuthenticatedClient(userId);
    const sheets = google.sheets({ version: "v4", auth: client });

    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: "Logs!A2:F", // Skip header row
    });

    const rows = response.data.values || [];

    const logs = rows
      .map((row) => ({
        date: row[0] || "",
        habit: row[1] || "",
        type: row[2] || "",
        status: row[3] || "",
        value: row[4] || "",
        timestamp: row[5] || "",
      }))
      .filter((l) => l.date && l.habit);

    res.json({ logs });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================
// Start Server
// ============================================

app.listen(PORT, () => {
  console.log(`
  ╔══════════════════════════════════════════════════╗
  ║  Auristitutum Sheets Server                      ║
  ║  Running on http://localhost:${PORT}               ║
  ╠══════════════════════════════════════════════════╣
  ║  GET  /health              - Health check        ║
  ║  GET  /auth/google         - Start OAuth flow    ║
  ║  GET  /auth/google/callback - OAuth callback     ║
  ║  GET  /auth/status         - Check connection    ║
  ║  POST /auth/disconnect     - Disconnect sheets   ║
  ║  POST /append-log          - Add single log      ║
  ║  POST /sync-logs           - Bulk sync logs      ║
  ║  GET  /get-logs            - Fetch logs (sync)   ║
  ╚══════════════════════════════════════════════════╝
  `);
});

/**
 * Google Sheets Backend API Service
 *
 * All requests go to /api/* - the Vercel serverless functions that live
 * in the /api folder of this same project.
 */

import { getUserSetting, upsertUserSetting } from "./firestoreService";

const _base = (import.meta.env.VITE_BACKEND_URL ?? "").replace(/\/$/, "");
const API_BASE = _base ? `${_base}/api` : "/api";

const inMemorySheetsState = new Map();

const normalizeSheetsState = (raw = {}) => ({
  connected: !!raw?.connected,
  sheetUrl: raw?.sheetUrl || null,
  spreadsheetId: raw?.spreadsheetId || null,
  connectedAt: raw?.connectedAt || null,
  error: raw?.error || null,
  loading: !!raw?.loading,
});

/**
 * Get Firebase UID for API calls.
 */
const getUserId = (user) => {
  if (user?.uid) return user.uid;
  throw new Error("Firebase UID is required");
};

const persistSheetsState = async (userOrId, payload) => {
  const userId = typeof userOrId === "string" ? userOrId : userOrId?.uid;
  if (!userId) return;

  const normalized = normalizeSheetsState(payload);
  inMemorySheetsState.set(userId, normalized);
  await upsertUserSetting(userId, "sheets", normalized, true);
};

export const getCachedSheetInfo = (userOrId = null) => {
  const userId = typeof userOrId === "string" ? userOrId : userOrId?.uid;
  if (!userId) return null;
  return inMemorySheetsState.get(userId) || null;
};

export const clearSheetCache = async (userOrId = null) => {
  const userId = typeof userOrId === "string" ? userOrId : userOrId?.uid;
  if (!userId) return;
  const disconnected = normalizeSheetsState({ connected: false, error: null });
  inMemorySheetsState.set(userId, disconnected);
  await upsertUserSetting(userId, "sheets", disconnected, true);
};

/**
 * Start Google OAuth flow.
 */
export const connectGoogleSheets = (user) => {
  const userId = getUserId(user);
  const params = new URLSearchParams({ userId });

  if (user?.email) {
    params.set("userEmail", user.email);
  }

  window.location.href = `${API_BASE}/auth/google?${params.toString()}`;
};

/**
 * Check if user has connected Google Sheets.
 */
export const checkSheetsConnection = async (user) => {
  if (!user?.uid) {
    return { connected: false };
  }

  const userId = getUserId(user);

  const stored =
    getCachedSheetInfo(userId) ||
    normalizeSheetsState((await getUserSetting(userId, "sheets")) || {});

  if (stored.connected || stored.sheetUrl) {
    inMemorySheetsState.set(userId, stored);
  }

  // Without a persistent backend Redis store, the backend doesn't know the status.
  // We completely rely on Firebase Firestore state that we load!
  return stored.connected || stored.sheetUrl ? stored : { connected: false };
};

/**
 * Disconnect Google Sheets for the current user.
 */
export const disconnectGoogleSheets = async (user) => {
  const userId = getUserId(user);

  const res = await fetch(`${API_BASE}/auth/disconnect`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userId }),
  });
  if (!res.ok) throw new Error("Failed to disconnect");

  const result = await res.json();
  await persistSheetsState(userId, { connected: false, error: null });
  return result;
};

/**
 * Append a single log entry to the user's spreadsheet.
 */
export const appendLog = async (user, logData) => {
  const userId = getUserId(user);

  const sheetInfo = getCachedSheetInfo(userId);
  const res = await fetch(`${API_BASE}/append-log`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      userId,
      habit: logData.habit,
      date: logData.date,
      type: logData.type,
      status: logData.status || "logged",
      value: logData.value,
      timestamp: logData.timestamp || new Date().toISOString(),
      tokens: sheetInfo?.tokens,
      spreadsheetId: sheetInfo?.spreadsheetId,
    }),
  });

  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.error || "Failed to append log");
  }

  return await res.json();
};

/**
 * Sync all logs to the user's spreadsheet (bulk operation).
 */
export const syncAllLogs = async (user, habits) => {
  const userId = getUserId(user);

  const logs = [];

  for (const habit of habits) {
    if (!habit.logs || habit.logs.length === 0) continue;

    for (const log of habit.logs) {
      const entries = log.entries || [];

      if (entries.length === 0) {
        logs.push({
          date: log.date,
          habit: habit.name,
          type: habit.type,
          status: "logged",
          value: log.count,
          timestamp: new Date().toISOString(),
        });
      } else {
        for (const entry of entries) {
          const parts = entry.split("|");
          const time = parts[0];
          const value = parts[1] || "";
          const unit = parts[2] || "";

          logs.push({
            date: log.date,
            habit: habit.name,
            type: habit.type,
            status: "logged",
            value: value ? `${value} ${unit}`.trim() : "",
            timestamp: `${log.date} ${time}`,
          });
        }
      }
    }
  }

  if (logs.length === 0) {
    throw new Error("No logs to sync");
  }

  const sheetInfo = getCachedSheetInfo(userId);
  const res = await fetch(`${API_BASE}/sync-logs`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      userId,
      logs,
      tokens: sheetInfo?.tokens,
      spreadsheetId: sheetInfo?.spreadsheetId
    }),
  });

  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.error || "Failed to sync logs");
  }

  return await res.json();
};

/**
 * Fetch all log rows from the user's spreadsheet.
 */
export const getLogsFromSheets = async (user) => {
  const userId = getUserId(user);

  const sheetInfo = getCachedSheetInfo(userId);

  const res = await fetch(
    `${API_BASE}/get-logs`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      userId,
      tokens: sheetInfo?.tokens,
      spreadsheetId: sheetInfo?.spreadsheetId
    }),
  }
  );

  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.error || "Failed to fetch logs from sheet");
  }

  return await res.json();
};

/**
 * Parse URL params after OAuth callback.
 */
export const handleOAuthCallback = () => {
  const params = new URLSearchParams(window.location.search);

  const result = {
    connected: params.get("sheets_connected") === "true",
    error: params.get("sheets_error"),
    sheetUrl: params.get("sheet_url")
      ? decodeURIComponent(params.get("sheet_url"))
      : null,
    payload: params.get("sheets_payload")
      ? JSON.parse(decodeURIComponent(params.get("sheets_payload")))
      : null,
  };

  if (result.connected || result.error) {
    const url = new URL(window.location.href);
    url.searchParams.delete("sheets_connected");
    url.searchParams.delete("sheets_error");
    url.searchParams.delete("sheet_url");
    url.searchParams.delete("sheets_payload");
    window.history.replaceState({}, "", url.pathname);
  }

  return result;
};

/**
 * Google Sheets Backend API Service
 *
 * All requests go to /api/* - the Vercel serverless functions that live
 * in the /api folder of this same project.
 */

const _base = (import.meta.env.VITE_BACKEND_URL ?? "").replace(/\/$/, "");
const API_BASE = _base ? `${_base}/api` : "/api";

const SHEETS_CACHE_KEY = "auristitutum_sheets_cache";
const getSheetsCacheKey = (userOrId) => {
  const userId =
    typeof userOrId === "string" ? userOrId : (userOrId?.uid ?? null);
  return userId ? `${SHEETS_CACHE_KEY}_${userId}` : SHEETS_CACHE_KEY;
};

/**
 * Get Firebase UID for API calls.
 */
const getUserId = (user) => {
  if (user?.uid) return user.uid;
  throw new Error("Firebase UID is required");
};

/**
 * Cache sheets connection info locally so it survives page refreshes.
 */
export const cacheSheetInfo = (info, userOrId = null) => {
  try {
    localStorage.setItem(getSheetsCacheKey(userOrId), JSON.stringify(info));
  } catch {
    // Non-fatal
  }
};

export const getCachedSheetInfo = (userOrId = null) => {
  try {
    const raw = localStorage.getItem(getSheetsCacheKey(userOrId));
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

export const clearSheetCache = (userOrId = null) => {
  try {
    localStorage.removeItem(getSheetsCacheKey(userOrId));
  } catch {
    // Non-fatal
  }
};

/**
 * Start Google OAuth flow.
 */
export const connectGoogleSheets = (user) => {
  const userId = getUserId(user);
  const params = new URLSearchParams({ userId });

  // Pass email so the backend can set login_hint on the OAuth URL
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

  try {
    const res = await fetch(
      `${API_BASE}/auth/status?userId=${encodeURIComponent(userId)}`,
    );
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      clearSheetCache(userId);
      return {
        connected: false,
        error: data?.error || "Failed to check connection status",
      };
    }

    if (data.connected) {
      // Keep cache fresh
      cacheSheetInfo(
        {
          connected: true,
          sheetUrl: data.sheetUrl,
          spreadsheetId: data.spreadsheetId,
          connectedAt: data.connectedAt,
        },
        userId,
      );
    } else {
      clearSheetCache(userId);
    }

    return data;
  } catch {
    // Backend unreachable - serve from cache so the UI doesn't break
    const cached = getCachedSheetInfo(userId);
    if (cached) return cached;
    return { connected: false };
  }
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
  clearSheetCache(userId);
  return await res.json();
};

/**
 * Append a single log entry to the user's spreadsheet.
 */
export const appendLog = async (user, logData) => {
  const userId = getUserId(user);

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

  const res = await fetch(`${API_BASE}/sync-logs`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userId, logs }),
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

  const res = await fetch(
    `${API_BASE}/get-logs?userId=${encodeURIComponent(userId)}`,
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
  };

  // Clean up URL params so they don't persist on refresh
  if (result.connected || result.error) {
    const url = new URL(window.location.href);
    url.searchParams.delete("sheets_connected");
    url.searchParams.delete("sheets_error");
    url.searchParams.delete("sheet_url");
    window.history.replaceState({}, "", url.pathname);
  }

  return result;
};

/**
 * Google Sheets Backend API Service
 * All Google Sheets operations go through the secure backend server
 */

const API_BASE = import.meta.env.VITE_BACKEND_URL || "http://localhost:3001";

const SHEETS_CACHE_KEY = "auristitutum_sheets_cache";

/**
 * Get the current user's ID for API calls
 * Uses Firebase UID if logged in, otherwise a local device ID
 */
const getUserId = (user) => {
  if (user?.uid) return user.uid;

  let deviceId = localStorage.getItem("auristitutum_device_id");
  if (!deviceId) {
    deviceId = "device_" + Math.random().toString(36).substring(2, 15);
    localStorage.setItem("auristitutum_device_id", deviceId);
  }
  return deviceId;
};

/**
 * Cache sheets connection info locally so it survives page refreshes
 * and server restarts without losing the URL/state.
 */
export const cacheSheetInfo = (info) => {
  try {
    localStorage.setItem(SHEETS_CACHE_KEY, JSON.stringify(info));
  } catch {
    // Non-fatal
  }
};

export const getCachedSheetInfo = () => {
  try {
    const raw = localStorage.getItem(SHEETS_CACHE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

export const clearSheetCache = () => {
  try {
    localStorage.removeItem(SHEETS_CACHE_KEY);
  } catch {
    // Non-fatal
  }
};

/**
 * Start Google OAuth flow.
 * Passes the user's email as a login_hint so Google pre-selects
 * the correct account — no re-authentication prompt if already signed in.
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
 * Falls back to localStorage cache if the backend is unreachable,
 * so the UI stays consistent across page refreshes / server restarts.
 */
export const checkSheetsConnection = async (user) => {
  const userId = getUserId(user);

  try {
    const res = await fetch(
      `${API_BASE}/auth/status?userId=${encodeURIComponent(userId)}`,
    );
    if (!res.ok) throw new Error("Failed to check connection status");

    const data = await res.json();

    if (data.connected) {
      // Keep cache fresh
      cacheSheetInfo({
        connected: true,
        sheetUrl: data.sheetUrl,
        spreadsheetId: data.spreadsheetId,
        connectedAt: data.connectedAt,
      });
    } else {
      clearSheetCache();
    }

    return data;
  } catch {
    // Backend unreachable — serve from cache so the UI doesn't break
    const cached = getCachedSheetInfo();
    if (cached) return cached;
    return { connected: false };
  }
};

/**
 * Disconnect Google Sheets for the current user.
 */
export const disconnectGoogleSheets = async (user) => {
  const userId = getUserId(user);

  try {
    const res = await fetch(`${API_BASE}/auth/disconnect`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId }),
    });
    if (!res.ok) throw new Error("Failed to disconnect");
    clearSheetCache();
    return await res.json();
  } catch (err) {
    throw err;
  }
};

/**
 * Append a single log entry to the user's spreadsheet.
 */
export const appendLog = async (user, logData) => {
  const userId = getUserId(user);

  try {
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
  } catch (err) {
    throw err;
  }
};

/**
 * Sync all logs to the user's spreadsheet (bulk operation).
 * Clears existing rows (except header) and rewrites everything.
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

  try {
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
  } catch (err) {
    throw err;
  }
};

/**
 * Fetch all log rows from the user's spreadsheet.
 * Used for live two-way sync: Google Sheet → web app.
 */
export const getLogsFromSheets = async (user) => {
  const userId = getUserId(user);

  try {
    const res = await fetch(
      `${API_BASE}/get-logs?userId=${encodeURIComponent(userId)}`,
    );

    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.error || "Failed to fetch logs from sheet");
    }

    return await res.json(); // { logs: [...] }
  } catch (err) {
    throw err;
  }
};

/**
 * Parse URL params after OAuth callback.
 * Call this on Settings page load to detect and handle the OAuth result.
 * Also caches the sheet URL if connection was successful.
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

  // Cache on successful connection
  if (result.connected && result.sheetUrl) {
    cacheSheetInfo({
      connected: true,
      sheetUrl: result.sheetUrl,
      connectedAt: new Date().toISOString(),
    });
  }

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

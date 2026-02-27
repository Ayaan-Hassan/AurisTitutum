/**
 * Persistent user store — OAuth tokens + spreadsheet metadata.
 *
 * Production  → Upstash Redis (via @upstash/redis HTTP client).
 *               Set these two env vars in your Vercel project dashboard,
 *               or let the Vercel × Upstash Marketplace integration add
 *               them automatically:
 *                 UPSTASH_REDIS_REST_URL
 *                 UPSTASH_REDIS_REST_TOKEN
 *
 * Local dev   → In-memory Map fallback used automatically when the env
 *               vars above are absent.  Data is lost on process restart,
 *               which is fine for local testing — just re-authorise once.
 *
 * Key schema:   at_user:<userId>
 *
 * Value shape:
 * {
 *   tokens: {
 *     access_token:  string
 *     refresh_token: string | null
 *     expiry_date:   number | null   (Unix ms)
 *   }
 *   spreadsheetId: string
 *   sheetUrl:      string
 *   connectedAt:   string  (ISO 8601)
 * }
 */

const KEY_PREFIX = "at_user:";

// ─── In-memory fallback (local dev / missing env vars) ───────────────────────
const memStore = new Map();

// ─── Lazy Upstash Redis loader ───────────────────────────────────────────────
// Import lazily so the module doesn't crash when env vars are absent.
let _redis = null;

async function getRedis() {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!url || !token) {
    return null; // No Redis configured — use in-memory fallback
  }

  if (_redis) return _redis;

  try {
    const { Redis } = await import("@upstash/redis");
    _redis = new Redis({ url, token });
    return _redis;
  } catch (err) {
    console.warn(
      "[store] @upstash/redis not available — using in-memory fallback.\n" +
        "  Run `npm install` and set UPSTASH_REDIS_REST_URL / " +
        "UPSTASH_REDIS_REST_TOKEN for persistent storage.\n" +
        "  Error: " +
        err.message,
    );
    return null;
  }
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Retrieve stored data for a user.
 * Returns `null` if the user has never connected Google Sheets.
 *
 * @param   {string}        userId
 * @returns {Promise<object|null>}
 */
export async function getUser(userId) {
  const redis = await getRedis();

  if (redis) {
    try {
      // @upstash/redis automatically JSON-parses stored values
      return await redis.get(`${KEY_PREFIX}${userId}`);
    } catch (err) {
      console.error("[store] Redis GET error:", err.message);
      // Fall through to in-memory store so the request still works
    }
  }

  return memStore.get(userId) ?? null;
}

/**
 * Persist data for a user.
 * Overwrites any previously stored value.
 *
 * @param   {string} userId
 * @param   {object} data
 * @returns {Promise<void>}
 */
export async function setUser(userId, data) {
  const redis = await getRedis();

  if (redis) {
    try {
      // No TTL — tokens live indefinitely until the user disconnects.
      // The oauth.js helper refreshes access tokens automatically before
      // each Sheets API call, so expiry is handled in code, not via TTL.
      await redis.set(`${KEY_PREFIX}${userId}`, data);
      return;
    } catch (err) {
      console.error("[store] Redis SET error:", err.message);
      // Fall through — write to in-memory so the current request works
    }
  }

  memStore.set(userId, data);
}

/**
 * Delete all stored data for a user (called on disconnect).
 *
 * @param   {string} userId
 * @returns {Promise<void>}
 */
export async function deleteUser(userId) {
  const redis = await getRedis();

  if (redis) {
    try {
      await redis.del(`${KEY_PREFIX}${userId}`);
      return;
    } catch (err) {
      console.error("[store] Redis DEL error:", err.message);
    }
  }

  memStore.delete(userId);
}

/**
 * Check whether a user has stored data without fetching the full payload.
 * Used by disconnect.js to report whether anything was actually removed.
 *
 * @param   {string}           userId
 * @returns {Promise<boolean>}
 */
export async function hasUser(userId) {
  const redis = await getRedis();

  if (redis) {
    try {
      // EXISTS returns the count of matching keys (0 or 1 here)
      const count = await redis.exists(`${KEY_PREFIX}${userId}`);
      return count === 1;
    } catch {
      // Fall through to in-memory check
    }
  }

  return memStore.has(userId);
}

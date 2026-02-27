/**
 * Persistent user store - OAuth tokens + spreadsheet metadata.
 *
 * Redis-only storage for all environments.
 *
 * Key schema: at_user:<userId>
 */

const KEY_PREFIX = "at_user:";
const IS_PRODUCTION = process.env.NODE_ENV === "production";

// Lazy Upstash Redis loader
let _redis = null;

async function getRedis() {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!url || !token) {
    if (IS_PRODUCTION) throw new Error("Redis is required in production");
    throw new Error(
      "Redis is required. Missing UPSTASH_REDIS_REST_URL or UPSTASH_REDIS_REST_TOKEN.",
    );
  }

  if (_redis) return _redis;

  try {
    const { Redis } = await import("@upstash/redis");
    _redis = new Redis({ url, token });
    return _redis;
  } catch (err) {
    throw new Error(
      `[store] Failed to initialize Redis client: ${err.message}`,
    );
  }
}

/**
 * Retrieve stored data for a user.
 * Returns null if the user has never connected Google Sheets.
 *
 * @param   {string} userId
 * @returns {Promise<object|null>}
 */
export async function getUser(userId) {
  const redis = await getRedis();

  try {
    return await redis.get(`${KEY_PREFIX}${userId}`);
  } catch (err) {
    throw new Error(`[store] Redis GET error: ${err.message}`);
  }
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

  try {
    await redis.set(`${KEY_PREFIX}${userId}`, data);
  } catch (err) {
    throw new Error(`[store] Redis SET error: ${err.message}`);
  }
}

/**
 * Delete all stored data for a user.
 *
 * @param   {string} userId
 * @returns {Promise<void>}
 */
export async function deleteUser(userId) {
  const redis = await getRedis();

  try {
    await redis.del(`${KEY_PREFIX}${userId}`);
  } catch (err) {
    throw new Error(`[store] Redis DEL error: ${err.message}`);
  }
}

/**
 * Check whether a user has stored data.
 *
 * @param   {string} userId
 * @returns {Promise<boolean>}
 */
export async function hasUser(userId) {
  const redis = await getRedis();

  try {
    const count = await redis.exists(`${KEY_PREFIX}${userId}`);
    return count === 1;
  } catch (err) {
    throw new Error(`[store] Redis EXISTS error: ${err.message}`);
  }
}

/**
 * Persistent store for OAuth data + app state.
 *
 * Key schema:
 *   at_state:<userId>  -> Habit tracker app state snapshot
 */

const STATE_KEY_PREFIX = "at_state:";
const IS_PRODUCTION = process.env.NODE_ENV === "production";
const _memoryStore = new Map();

// Lazy Upstash Redis loader
let _redis = null;

async function getRedis() {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!url || !token) {
    if (IS_PRODUCTION) {
      throw new Error("Redis is required in production");
    }
    return null;
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
 * Retrieve app state snapshot for a user.
 *
 * @param   {string} userId
 * @returns {Promise<object|null>}
 */
export async function getUserState(userId) {
  const redis = await getRedis();
  const key = `${STATE_KEY_PREFIX}${userId}`;

  if (!redis) {
    return _memoryStore.get(key) ?? null;
  }

  try {
    return await redis.get(key);
  } catch (err) {
    throw new Error(`[store] Redis GET (state) error: ${err.message}`);
  }
}

/**
 * Persist app state snapshot for a user.
 *
 * @param   {string} userId
 * @param   {object} data
 * @returns {Promise<void>}
 */
export async function setUserState(userId, data) {
  const redis = await getRedis();
  const key = `${STATE_KEY_PREFIX}${userId}`;

  if (!redis) {
    _memoryStore.set(key, data);
    return;
  }

  try {
    await redis.set(key, data);
  } catch (err) {
    throw new Error(`[store] Redis SET (state) error: ${err.message}`);
  }
}

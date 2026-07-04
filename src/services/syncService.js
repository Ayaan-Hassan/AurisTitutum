/**
 * AurisTitutum Sync Service
 * ─────────────────────────────────────────────────────────────────
 * Architecture:
 *   User Action → Local Cache Update → Sync Queue → Firestore → Cache Confirmation
 *
 * Design principles:
 *  - Firestore is the ONLY source of truth.
 *  - Local cache is a performance layer: faster startup, offline viewing,
 *    reduced flicker. It is NEVER used as a source of truth for reads.
 *  - The sync queue persists pending writes to localStorage so they survive
 *    page refreshes and can be retried automatically on reconnect.
 *  - The service is device-agnostic. Future devices (Titum Band, NFC logger,
 *    mobile app, desktop app) can enqueue operations the same way.
 *
 * Usage:
 *   import { syncService } from './syncService';
 *
 *   // Enqueue a write (optimistic local cache + Firestore sync)
 *   syncService.enqueue({ type: 'upsert', uid, collection, id, payload });
 *   syncService.enqueue({ type: 'delete', uid, collection, id });
 *
 *   // Read from cache (for fast startup)
 *   const cached = syncService.readCache(uid, collection);
 *
 *   // Write a full collection snapshot to cache (called by realtime listeners)
 *   syncService.writeCache(uid, collection, docs);
 *
 *   // Clear cache for a user (called on logout)
 *   syncService.clearUserCache(uid);
 *
 *   // Force a flush of the pending queue (called on reconnect)
 *   await syncService.flushQueue();
 */

import {
  doc,
  setDoc,
  deleteDoc,
  getFirestore,
} from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { db } from '../firebase.config';

// ─── Constants ───────────────────────────────────────────────────

const CACHE_PREFIX = 'auris_cache_';
const QUEUE_KEY = 'auris_sync_queue';
const QUEUE_VERSION = 1;
const MAX_RETRY_ATTEMPTS = 5;
const RETRY_BACKOFF_BASE_MS = 2000;

// ─── Internal Helpers ─────────────────────────────────────────────

const safeJsonParse = (value, fallback) => {
  try {
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
};

const getUserCacheKey = (uid, collection) =>
  `${CACHE_PREFIX}${uid}_${collection}`;

// ─── Cache Layer ──────────────────────────────────────────────────

/**
 * Read all cached docs for a user's collection.
 * Returns an array of document objects, or an empty array if no cache.
 */
const readCache = (uid, collection) => {
  if (!uid || !collection) return [];
  try {
    const raw = localStorage.getItem(getUserCacheKey(uid, collection));
    const parsed = safeJsonParse(raw, null);
    if (!parsed || !Array.isArray(parsed.docs)) return [];
    return parsed.docs;
  } catch {
    return [];
  }
};

/**
 * Write a full collection snapshot to the cache.
 * Called by AuthContext realtime listeners after each Firestore update.
 */
const writeCache = (uid, collection, docs) => {
  if (!uid || !collection) return;
  try {
    localStorage.setItem(
      getUserCacheKey(uid, collection),
      JSON.stringify({ docs: Array.isArray(docs) ? docs : [], updatedAt: Date.now() }),
    );
  } catch (e) {
    // Storage quota exceeded — silently ignore, cache is non-critical
    console.warn('[SyncService] Cache write failed (quota?):', e?.message);
  }
};

/**
 * Upsert a single document in the cache without a full collection rewrite.
 * Used for optimistic updates so the UI reflects changes instantly.
 */
const upsertCacheDoc = (uid, collection, id, payload) => {
  if (!uid || !collection || !id) return;
  try {
    const existing = readCache(uid, collection);
    const idx = existing.findIndex((d) => d.id === id);
    const next = { ...payload, id };
    if (idx > -1) {
      existing[idx] = next;
    } else {
      existing.push(next);
    }
    writeCache(uid, collection, existing);
  } catch {
    // Non-critical
  }
};

/**
 * Remove a single document from the cache.
 * Used for optimistic deletes.
 */
const deleteCacheDoc = (uid, collection, id) => {
  if (!uid || !collection || !id) return;
  try {
    const existing = readCache(uid, collection);
    writeCache(uid, collection, existing.filter((d) => d.id !== id));
  } catch {
    // Non-critical
  }
};

/**
 * Remove all cached data for a user. Called on logout.
 */
const clearUserCache = (uid) => {
  if (!uid) return;
  try {
    const keysToRemove = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(`${CACHE_PREFIX}${uid}_`)) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach((key) => localStorage.removeItem(key));
  } catch {
    // Non-critical
  }
};

// ─── Sync Queue ───────────────────────────────────────────────────

/**
 * Read the persisted sync queue from localStorage.
 * @returns {Array<SyncOperation>}
 */
const readQueue = () => {
  try {
    const raw = localStorage.getItem(QUEUE_KEY);
    const parsed = safeJsonParse(raw, null);
    if (!parsed || parsed.version !== QUEUE_VERSION || !Array.isArray(parsed.ops)) {
      return [];
    }
    return parsed.ops;
  } catch {
    return [];
  }
};

/**
 * Persist the sync queue to localStorage.
 */
const writeQueue = (ops) => {
  try {
    localStorage.setItem(QUEUE_KEY, JSON.stringify({ version: QUEUE_VERSION, ops }));
  } catch {
    // Quota exceeded — cannot persist queue
    console.warn('[SyncService] Queue persistence failed.');
  }
};

/**
 * Add an operation to the persistent sync queue.
 * @param {SyncOperation} op
 */
const enqueueToStorage = (op) => {
  const queue = readQueue();
  // Deduplicate: if an identical upsert for the same (uid, collection, id) exists, replace it
  if (op.type === 'upsert') {
    const idx = queue.findIndex(
      (q) => q.type === 'upsert' && q.uid === op.uid && q.collection === op.collection && q.id === op.id,
    );
    if (idx > -1) {
      queue[idx] = op;
    } else {
      queue.push(op);
    }
  } else {
    queue.push(op);
  }
  writeQueue(queue);
};

/**
 * Remove an operation from the persistent queue by its opId.
 */
const dequeueFromStorage = (opId) => {
  const queue = readQueue().filter((q) => q.opId !== opId);
  writeQueue(queue);
};

// ─── Firestore Executor ───────────────────────────────────────────

/**
 * Execute a single sync operation against Firestore.
 * Returns true on success, false on failure.
 */
const executeOperation = async (op) => {
  try {
    if (!db) throw new Error('Firestore not initialized');

    const { type, uid, collection, id, payload } = op;
    const ref = doc(db, 'users', uid, collection, id);

    if (type === 'upsert') {
      const now = new Date().toISOString();
      await setDoc(ref, {
        id,
        ...payload,
        updatedAt: now,
        ...(payload?.createdAt ? {} : { createdAt: now }),
      }, { merge: true });
    } else if (type === 'delete') {
      await deleteDoc(ref);
    } else {
      console.warn('[SyncService] Unknown operation type:', type);
    }

    return true;
  } catch (err) {
    console.warn('[SyncService] Operation failed:', err?.message, op);
    return false;
  }
};

// ─── Flush State ──────────────────────────────────────────────────

let isFlushing = false;
let flushScheduled = false;

/**
 * Flush all pending operations in the sync queue.
 * Operations are retried up to MAX_RETRY_ATTEMPTS times with exponential backoff.
 * Failed operations remain in the queue for the next flush.
 */
const flushQueue = async () => {
  if (isFlushing) return;

  const auth = getAuth();
  if (!auth.currentUser) {
    // Not authenticated — don't flush
    return;
  }

  const queue = readQueue();
  if (queue.length === 0) return;

  isFlushing = true;

  const remaining = [];

  for (const op of queue) {
    const attempts = (op.attempts || 0) + 1;
    const success = await executeOperation(op);

    if (success) {
      // Operation succeeded — remove from queue
      dequeueFromStorage(op.opId);
    } else if (attempts >= MAX_RETRY_ATTEMPTS) {
      // Max retries exceeded — drop the operation and log
      console.error('[SyncService] Max retries exceeded, dropping operation:', op);
      dequeueFromStorage(op.opId);
    } else {
      // Retry later
      remaining.push({ ...op, attempts });
    }
  }

  if (remaining.length > 0) {
    writeQueue(remaining);
  }

  isFlushing = false;
};

/**
 * Schedule a flush in the next tick (debounced).
 */
const scheduleFlush = () => {
  if (flushScheduled) return;
  flushScheduled = true;
  setTimeout(async () => {
    flushScheduled = false;
    await flushQueue();
  }, 100);
};

// ─── Online/Offline Reconnect Handler ────────────────────────────

let onlineHandlerAttached = false;

const attachOnlineHandler = () => {
  if (onlineHandlerAttached || typeof window === 'undefined') return;
  onlineHandlerAttached = true;

  window.addEventListener('online', () => {
    console.log('[SyncService] Connection restored — flushing pending queue...');
    flushQueue();
  });
};

// ─── Public API ───────────────────────────────────────────────────

/**
 * Enqueue a write operation. This:
 * 1. Applies an optimistic update to the local cache
 * 2. Adds the operation to the persistent sync queue
 * 3. Immediately attempts a Firestore write in the background
 *
 * @param {Object} op
 * @param {string} op.type       - 'upsert' | 'delete'
 * @param {string} op.uid        - Authenticated user UID
 * @param {string} op.collection - Firestore subcollection name (e.g. 'habits')
 * @param {string} op.id         - Document ID
 * @param {Object} [op.payload]  - Document data (required for 'upsert')
 * @param {string} [op.source]   - Optional source tag (e.g. 'web', 'band', 'nfc')
 */
const enqueue = (op) => {
  if (!op.uid || !op.collection || !op.id) {
    console.warn('[SyncService] Invalid operation — missing uid/collection/id:', op);
    return;
  }

  const enrichedOp = {
    ...op,
    opId: `${op.uid}_${op.collection}_${op.id}_${op.type}_${Date.now()}`,
    enqueuedAt: new Date().toISOString(),
    attempts: 0,
    source: op.source || 'web',
  };

  // 1. Optimistic cache update
  if (op.type === 'upsert') {
    upsertCacheDoc(op.uid, op.collection, op.id, op.payload);
  } else if (op.type === 'delete') {
    deleteCacheDoc(op.uid, op.collection, op.id);
  }

  // 2. Persist to queue
  enqueueToStorage(enrichedOp);

  // 3. Attempt immediate write (scheduleFlush handles debouncing)
  scheduleFlush();
};

// ─── Initialize ───────────────────────────────────────────────────

const init = () => {
  attachOnlineHandler();

  // Flush any leftover queue from a previous session on startup
  // Wait 2s to let Firebase auth restore first
  setTimeout(() => {
    flushQueue();
  }, 2000);
};

// ─── Export ───────────────────────────────────────────────────────

export const syncService = {
  // Cache operations
  readCache,
  writeCache,
  upsertCacheDoc,
  deleteCacheDoc,
  clearUserCache,

  // Queue operations
  enqueue,
  flushQueue,

  // Lifecycle
  init,
};

export default syncService;

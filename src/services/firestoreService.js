import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  setDoc,
  updateDoc,
  increment,
  writeBatch,
  serverTimestamp,
} from "firebase/firestore";
import { db, isFirebaseConfigured } from "../firebase.config";

const USERS_COLLECTION = "users";
export const USER_SUBCOLLECTIONS = {
  habits: "habits",
  logs: "logs",
  notes: "notes",
  reminders: "reminders",
  settings: "settings",
};

const LEGACY_STORAGE_KEYS = {
  habits: "habitflow_pro_data",
  userConfig: "habitflow_pro_user",
  notes: "habitflow_pro_notes",
  reminders: "habitflow_pro_reminders",
};

const SCOPED_STATE_PREFIX = "habitflow_pro_state_";

const safeJsonParse = (value, fallback = null) => {
  try {
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
};

const assertFirestoreReady = () => {
  if (!isFirebaseConfigured || !db) {
    throw new Error("Firestore is not configured");
  }
};

export const getUserDocRef = (uid) => {
  assertFirestoreReady();
  return doc(db, USERS_COLLECTION, uid);
};

export const getUserSubcollectionRef = (uid, subcollection) => {
  assertFirestoreReady();
  return collection(getUserDocRef(uid), subcollection);
};

export const getUserSubDocRef = (uid, subcollection, docId) => {
  assertFirestoreReady();
  return doc(getUserSubcollectionRef(uid, subcollection), docId);
};

export const ensureUserDocument = async ({ uid, email, displayName }) => {
  if (!uid) throw new Error("Missing uid");
  const createdAt = new Date().toISOString();
  await setDoc(
    getUserDocRef(uid),
    {
      createdAt,
      email: email || "",
      displayName: displayName || "",
      updatedAt: createdAt,
    },
    { merge: true },
  );
};

export const updateUserPresence = async (uid, isOnline, addSeconds = 0) => {
  try {
    if (!uid) return;
    const updates = { isOnline, lastActive: new Date().toISOString() };
    if (addSeconds > 0) {
      updates.exactTimeSpent = increment(addSeconds);
    }
    await updateDoc(getUserDocRef(uid), updates);
  } catch(e) { /* ignore */ }
};

export const updateGuestPresence = async (sessionId, isOnline) => {
  try {
    if (!sessionId) return;
    const ref = doc(db, "guest_presence", sessionId);
    // Don't delete doc when "offline", just let the 90s threshold in AdminDashboard handle it
    // This ensures guests show up even if the visibility signal briefly drops
    if (isOnline) {
      await setDoc(ref, { 
        lastActive: new Date().toISOString(),
        isOnline: true 
      }, { merge: true });
    } else {
      await updateDoc(ref, { isOnline: false }).catch(() => {});
    }
  } catch(e) { /* ignore */ }
};

export const getUserSetting = async (uid, settingId) => {
  const settingRef = getUserSubDocRef(uid, USER_SUBCOLLECTIONS.settings, settingId);
  const snap = await getDoc(settingRef);
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
};

export const upsertUserSetting = async (uid, settingId, payload, merge = true) => {
  const now = new Date().toISOString();
  await setDoc(
    getUserSubDocRef(uid, USER_SUBCOLLECTIONS.settings, settingId),
    {
      id: settingId,
      ...payload,
      updatedAt: now,
      ...(payload?.createdAt ? {} : { createdAt: now }),
    },
    { merge },
  );
};

export const updateUserSetting = async (uid, settingId, payload) => {
  await updateDoc(getUserSubDocRef(uid, USER_SUBCOLLECTIONS.settings, settingId), {
    ...payload,
    updatedAt: new Date().toISOString(),
  });
};

export const subscribeToUserSubcollection = (
  uid,
  subcollection,
  onData,
  onError,
) => {
  return onSnapshot(
    getUserSubcollectionRef(uid, subcollection),
    (snapshot) => {
      const docs = snapshot.docs.map((item) => ({ id: item.id, ...item.data() }));
      onData(docs);
    },
    onError,
  );
};

export const getCollectionDocsOnce = async (uid, subcollection) => {
  const snapshot = await getDocs(getUserSubcollectionRef(uid, subcollection));
  return snapshot.docs.map((item) => ({ id: item.id, ...item.data() }));
};

const commitOperationsInChunks = async (operations) => {
  if (!operations.length) return;

  const CHUNK_SIZE = 400;

  for (let i = 0; i < operations.length; i += CHUNK_SIZE) {
    const chunk = operations.slice(i, i + CHUNK_SIZE);
    const batch = writeBatch(db);

    chunk.forEach((operation) => {
      if (operation.type === "set") {
        batch.set(operation.ref, operation.data, operation.options || {});
      } else if (operation.type === "delete") {
        batch.delete(operation.ref);
      } else {
        throw new Error(`Unsupported operation type: ${operation.type}`);
      }
    });

    await batch.commit();
  }
};

export const replaceCollectionById = async (uid, subcollection, docs = []) => {
  const incoming = Array.isArray(docs) ? docs : [];
  const incomingMap = new Map();

  incoming.forEach((item) => {
    const id = String(item?.id || "").trim();
    if (!id) return;
    incomingMap.set(id, { ...item, id });
  });

  const existingSnapshot = await getDocs(getUserSubcollectionRef(uid, subcollection));
  const operations = [];

  existingSnapshot.docs.forEach((item) => {
    if (!incomingMap.has(item.id)) {
      operations.push({ type: "delete", ref: item.ref });
    }
  });

  incomingMap.forEach((value, id) => {
    operations.push({
      type: "set",
      ref: getUserSubDocRef(uid, subcollection, id),
      data: value,
      options: { merge: false },
    });
  });

  await commitOperationsInChunks(operations);
};

export const clearCollection = async (uid, subcollection) => {
  const snapshot = await getDocs(getUserSubcollectionRef(uid, subcollection));
  const operations = snapshot.docs.map((item) => ({ type: "delete", ref: item.ref }));
  await commitOperationsInChunks(operations);
};

export const upsertCollectionDoc = async (uid, subcollection, id, payload, merge = true) => {
  const now = new Date().toISOString();
  await setDoc(
    getUserSubDocRef(uid, subcollection, id),
    {
      id,
      ...payload,
      updatedAt: now,
      ...(payload?.createdAt ? {} : { createdAt: now }),
    },
    { merge },
  );
};

export const updateCollectionDoc = async (uid, subcollection, id, payload) => {
  await updateDoc(getUserSubDocRef(uid, subcollection, id), {
    ...payload,
    updatedAt: new Date().toISOString(),
  });
};

export const deleteCollectionDoc = async (uid, subcollection, id) => {
  await deleteDoc(getUserSubDocRef(uid, subcollection, id));
};

export const hasAnyRemoteCoreData = async (uid) => {
  const targets = [
    USER_SUBCOLLECTIONS.habits,
    USER_SUBCOLLECTIONS.logs,
    USER_SUBCOLLECTIONS.notes,
    USER_SUBCOLLECTIONS.reminders,
    USER_SUBCOLLECTIONS.settings,
  ];

  for (const subcollection of targets) {
    const snapshot = await getDocs(getUserSubcollectionRef(uid, subcollection));
    if (!snapshot.empty) return true;
  }

  return false;
};

export const readLegacyLocalCoreData = (uid) => {
  if (typeof localStorage === "undefined") return null;

  const scopedUser = safeJsonParse(
    localStorage.getItem(`${SCOPED_STATE_PREFIX}user_${uid}`),
    null,
  );
  const scopedGuest = safeJsonParse(
    localStorage.getItem(`${SCOPED_STATE_PREFIX}guest`),
    null,
  );

  const legacy = {
    habits: safeJsonParse(localStorage.getItem(LEGACY_STORAGE_KEYS.habits), null),
    userConfig: safeJsonParse(localStorage.getItem(LEGACY_STORAGE_KEYS.userConfig), null),
    notes: safeJsonParse(localStorage.getItem(LEGACY_STORAGE_KEYS.notes), null),
    reminders: safeJsonParse(localStorage.getItem(LEGACY_STORAGE_KEYS.reminders), null),
  };

  const candidate = scopedUser || scopedGuest || legacy;

  const normalized = {
    habits: Array.isArray(candidate?.habits) ? candidate.habits : [],
    notes: Array.isArray(candidate?.notes) ? candidate.notes : [],
    reminders: Array.isArray(candidate?.reminders) ? candidate.reminders : [],
    userConfig:
      candidate?.userConfig && typeof candidate.userConfig === "object"
        ? candidate.userConfig
        : {},
  };

  const hasCoreData =
    normalized.habits.length > 0 ||
    normalized.notes.length > 0 ||
    normalized.reminders.length > 0 ||
    Object.keys(normalized.userConfig).length > 0;

  return hasCoreData ? normalized : null;
};

export const clearLegacyLocalCoreData = (uid) => {
  if (typeof localStorage === "undefined") return;

  Object.values(LEGACY_STORAGE_KEYS).forEach((key) => {
    localStorage.removeItem(key);
  });

  const scopedKeys = [];
  for (let i = 0; i < localStorage.length; i += 1) {
    const key = localStorage.key(i);
    if (key && key.startsWith(SCOPED_STATE_PREFIX)) {
      scopedKeys.push(key);
    }
  }
  scopedKeys.forEach((key) => localStorage.removeItem(key));

  localStorage.removeItem(`auristitutum_sheets_cache_${uid}`);
  localStorage.removeItem("auristitutum_sheets_cache");
};

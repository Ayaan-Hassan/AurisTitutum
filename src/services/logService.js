import {
  deleteCollectionDoc,
  replaceCollectionById,
  subscribeToUserSubcollection,
  upsertCollectionDoc,
  USER_SUBCOLLECTIONS,
} from "./firestoreService";

const LOGS_COLLECTION = USER_SUBCOLLECTIONS.logs;

const getEventTimestamp = (date, time) => {
  const safeDate = String(date || "").trim();
  const safeTime = String(time || "00:00:00").trim() || "00:00:00";
  return `${safeDate}T${safeTime}`;
};

const parseCountEntry = (entry = "", fallbackTime = "00:00:00") => {
  const [timeRaw, amountRaw, unitRaw] = String(entry || "").split("|");
  const parsedAmount = parseInt(amountRaw, 10);
  return {
    time: (timeRaw || fallbackTime || "00:00:00").trim() || "00:00:00",
    amount: Number.isFinite(parsedAmount) && parsedAmount > 0 ? parsedAmount : 1,
    unit: (unitRaw || "").trim(),
  };
};

export const serializeLogsFromHabits = (habits = []) => {
  const docs = [];

  (Array.isArray(habits) ? habits : []).forEach((habit) => {
    const habitId = String(habit?.id || "").trim();
    if (!habitId) return;

    const mode = habit?.mode || "quick";
    const type = habit?.type || "Good";

    (Array.isArray(habit?.logs) ? habit.logs : []).forEach((day, dayIndex) => {
      const date = String(day?.date || "").trim();
      if (!date) return;

      const entries = Array.isArray(day?.entries) ? day.entries : [];

      if (entries.length === 0) {
        const fallbackAmount = Math.max(1, Number(day?.count) || 1);
        const id = `${habitId}_${date}_fallback_${dayIndex}`;
        docs.push({
          id,
          habitId,
          date,
          time: "00:00:00",
          amount: fallbackAmount,
          unit: mode === "count" ? habit?.unit || "" : "",
          mode,
          type,
          createdAt: getEventTimestamp(date, "00:00:00"),
          updatedAt: new Date().toISOString(),
        });
        return;
      }

      entries.forEach((entry, entryIndex) => {
        const baseId = `${habitId}_${date}_${dayIndex}_${entryIndex}`;

        if (mode === "count") {
          const parsed = parseCountEntry(entry, "00:00:00");
          docs.push({
            id: baseId,
            habitId,
            date,
            time: parsed.time,
            amount: parsed.amount,
            unit: parsed.unit || habit?.unit || "",
            mode,
            type,
            createdAt: getEventTimestamp(date, parsed.time),
            updatedAt: new Date().toISOString(),
          });
        } else if (mode === "upload" && typeof entry === "string" && entry.startsWith("data:image")) {
          // Serialize photo logs with the photoData field for admin visibility
          docs.push({
            id: baseId,
            habitId,
            date,
            time: "00:00:00",
            photoData: entry,
            amount: 1,
            unit: "",
            mode,
            type,
            createdAt: getEventTimestamp(date, "00:00:00"),
            updatedAt: new Date().toISOString(),
          });
        } else {
          const time = String(entry || "00:00:00").trim() || "00:00:00";
          docs.push({
            id: baseId,
            habitId,
            date,
            time,
            amount: 1,
            unit: "",
            mode,
            type,
            createdAt: getEventTimestamp(date, time),
            updatedAt: new Date().toISOString(),
          });
        }
      });
    });
  });

  return docs;
};

export const subscribeLogs = (uid, onData, onError) =>
  subscribeToUserSubcollection(uid, LOGS_COLLECTION, onData, onError);

export const createLog = async (uid, payload) => {
  const id = String(payload?.id || `${payload?.habitId || "habit"}_${Date.now()}`);
  await upsertCollectionDoc(
    uid,
    LOGS_COLLECTION,
    id,
    {
      ...payload,
      id,
      createdAt: payload?.createdAt || new Date().toISOString(),
    },
    false,
  );
};

export const deleteLog = async (uid, logId) => {
  await deleteCollectionDoc(uid, LOGS_COLLECTION, logId);
};

export const replaceLogs = async (uid, logs = []) => {
  await replaceCollectionById(uid, LOGS_COLLECTION, logs);
};

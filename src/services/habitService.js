import {
  replaceCollectionById,
  subscribeToUserSubcollection,
  updateCollectionDoc,
  upsertCollectionDoc,
  deleteCollectionDoc,
  USER_SUBCOLLECTIONS,
} from "./firestoreService";

const HABITS_COLLECTION = USER_SUBCOLLECTIONS.habits;

const toHabitDoc = (habit = {}) => ({
  id: String(habit.id),
  name: habit.name || "",
  type: habit.type || "Good",
  mode: habit.mode || "quick",
  unit: habit.unit || "",
  emoji: habit.emoji || "",
  createdAt: habit.createdAt || new Date().toISOString(),
  updatedAt: new Date().toISOString(),
});

const toDateTimeSortValue = (date = "", time = "") => `${date}|${time}`;

export const aggregateHabitsFromDocs = (habitDocs = [], logDocs = []) => {
  const byId = new Map();

  habitDocs.forEach((doc) => {
    const id = String(doc?.id || "").trim();
    if (!id) return;
    byId.set(id, {
      id,
      name: doc?.name || "",
      type: doc?.type || "Good",
      mode: doc?.mode || "quick",
      unit: doc?.unit || "",
      emoji: doc?.emoji || "",
      createdAt: doc?.createdAt || new Date().toISOString(),
      updatedAt: doc?.updatedAt || new Date().toISOString(),
      totalLogs: 0,
      logs: [],
    });
  });

  const logsByHabitAndDate = new Map();

  logDocs.forEach((item) => {
    const habitId = String(item?.habitId || "").trim();
    if (!habitId || !byId.has(habitId)) return;

    const habit = byId.get(habitId);
    const date = String(item?.date || "").trim();
    if (!date) return;

    const time = String(item?.time || "00:00:00").trim() || "00:00:00";
    const amountRaw = Number(item?.amount);
    const amount = Number.isFinite(amountRaw) && amountRaw > 0 ? amountRaw : 1;
    const unit = item?.unit || habit.unit || "";

    const key = `${habitId}__${date}`;
    if (!logsByHabitAndDate.has(key)) {
      logsByHabitAndDate.set(key, {
        habitId,
        date,
        count: 0,
        entries: [],
      });
    }

    const day = logsByHabitAndDate.get(key);

    if (habit.mode === "count" || habit.mode === "rating" || habit.mode === "timer") {
      day.count += amount;
      day.entries.push(`${time}|${amount}|${unit}`);
    } else if (habit.mode === "upload" && item.photoData) {
      day.count += amount;
      day.entries.push(item.photoData);
    } else {
      day.count += amount;
      for (let i = 0; i < amount; i += 1) {
        day.entries.push(time);
      }
    }

    habit.totalLogs += amount;
  });

  logsByHabitAndDate.forEach((day) => {
    const habit = byId.get(day.habitId);
    if (!habit) return;
    if (habit.mode !== "upload") {
      day.entries.sort();
    }
    habit.logs.push({
      date: day.date,
      count: day.count,
      entries: day.entries,
    });
  });

  const sorted = Array.from(byId.values())
    .map((habit) => ({
      ...habit,
      logs: habit.logs.sort((a, b) =>
        toDateTimeSortValue(a.date).localeCompare(toDateTimeSortValue(b.date)),
      ),
    }))
    .sort((a, b) => {
      const left = String(a.createdAt || "");
      const right = String(b.createdAt || "");
      if (left === right) return a.name.localeCompare(b.name);
      return left.localeCompare(right);
    });

  return sorted;
};

export const subscribeHabits = (uid, onData, onError) =>
  subscribeToUserSubcollection(uid, HABITS_COLLECTION, onData, onError);

export const createHabit = async (uid, payload) => {
  const habit = toHabitDoc(payload);
  await upsertCollectionDoc(uid, HABITS_COLLECTION, habit.id, habit, false);
  return habit;
};

export const updateHabit = async (uid, habitId, payload) => {
  await updateCollectionDoc(uid, HABITS_COLLECTION, habitId, payload);
};

export const deleteHabit = async (uid, habitId) => {
  await deleteCollectionDoc(uid, HABITS_COLLECTION, habitId);
};

export const replaceHabits = async (uid, habits = []) => {
  const docs = (Array.isArray(habits) ? habits : []).map((habit) =>
    toHabitDoc(habit),
  );
  await replaceCollectionById(uid, HABITS_COLLECTION, docs);
};

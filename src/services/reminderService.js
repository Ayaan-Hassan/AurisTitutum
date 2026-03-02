import {
  deleteCollectionDoc,
  replaceCollectionById,
  subscribeToUserSubcollection,
  updateCollectionDoc,
  upsertCollectionDoc,
  USER_SUBCOLLECTIONS,
} from "./firestoreService";

const REMINDERS_COLLECTION = USER_SUBCOLLECTIONS.reminders;

const toReminderDoc = (reminder = {}) => {
  const now = new Date().toISOString();
  return {
    id: String(reminder.id),
    title: reminder.title || "",
    notes: reminder.notes || "",
    date: reminder.date || "",
    time: reminder.time || "09:00",
    repeat: reminder.repeat || "none",
    createdAt: reminder.createdAt || now,
    updatedAt: now,
  };
};

export const subscribeReminders = (uid, onData, onError) =>
  subscribeToUserSubcollection(uid, REMINDERS_COLLECTION, onData, onError);

export const createReminder = async (uid, payload) => {
  const reminder = toReminderDoc(payload);
  await upsertCollectionDoc(uid, REMINDERS_COLLECTION, reminder.id, reminder, false);
  return reminder;
};

export const updateReminder = async (uid, reminderId, payload) => {
  await updateCollectionDoc(uid, REMINDERS_COLLECTION, reminderId, payload);
};

export const deleteReminder = async (uid, reminderId) => {
  await deleteCollectionDoc(uid, REMINDERS_COLLECTION, reminderId);
};

export const replaceReminders = async (uid, reminders = []) => {
  const docs = (Array.isArray(reminders) ? reminders : []).map((item) =>
    toReminderDoc(item),
  );
  await replaceCollectionById(uid, REMINDERS_COLLECTION, docs);
};

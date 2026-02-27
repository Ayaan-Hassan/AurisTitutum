import { useEffect, useRef } from "react";

const FIRED_STORAGE_KEY = "habitflow_fired_reminders";
const CHECK_INTERVAL_MS = 15_000;

const getFiredIds = () => {
  try {
    const raw = localStorage.getItem(FIRED_STORAGE_KEY);
    return new Set(JSON.parse(raw || "[]"));
  } catch {
    return new Set();
  }
};

const markFired = (fireKey) => {
  try {
    const ids = getFiredIds();
    ids.add(fireKey);
    const arr = [...ids].slice(-500);
    localStorage.setItem(FIRED_STORAGE_KEY, JSON.stringify(arr));
  } catch {
    // Non-fatal
  }
};

const getDayOfWeek = (dateStr) => {
  try {
    return new Date(`${dateStr}T12:00:00`).getDay();
  } catch {
    return -1;
  }
};

const parseLocalDateTime = (dateStr, timeStr) => {
  if (!dateStr || !timeStr) return null;
  const safeTime = timeStr.length === 5 ? `${timeStr}:00` : timeStr;
  const dt = new Date(`${dateStr}T${safeTime}`);
  return Number.isNaN(dt.getTime()) ? null : dt;
};

/**
 * Checks reminders every 15 seconds (plus focus/visibility events) and fires:
 *  - browser notifications (if granted)
 *  - in-app toasts
 * exactly once per fire key.
 */
export const useReminderNotifications = (reminders) => {
  const remindersRef = useRef(reminders);

  useEffect(() => {
    remindersRef.current = reminders;
  }, [reminders]);

  useEffect(() => {
    const checkAndFire = () => {
      const current = remindersRef.current;
      if (!current || current.length === 0) return;

      const now = new Date();
      const todayStr = now.toISOString().split("T")[0];
      const firedIds = getFiredIds();
      const todayDOW = now.getDay();

      current.forEach((reminder) => {
        if (!reminder?.id || !reminder?.date || !reminder?.time) return;

        const repeat = reminder.repeat || "none";
        const startsTodayOrEarlier = reminder.date <= todayStr;
        const dueTodayAt = parseLocalDateTime(todayStr, reminder.time);
        const dueAt = parseLocalDateTime(reminder.date, reminder.time);

        let fireKey = reminder.id;
        let shouldFire = false;

        if (repeat === "none") {
          shouldFire = !!dueAt && now >= dueAt;
        } else if (repeat === "daily") {
          fireKey = `${reminder.id}_${todayStr}`;
          shouldFire =
            startsTodayOrEarlier && !!dueTodayAt && now >= dueTodayAt;
        } else if (repeat === "weekly") {
          fireKey = `${reminder.id}_${todayStr}`;
          const reminderDOW = getDayOfWeek(reminder.date);
          shouldFire =
            startsTodayOrEarlier &&
            reminderDOW === todayDOW &&
            !!dueTodayAt &&
            now >= dueTodayAt;
        }

        if (!shouldFire || firedIds.has(fireKey)) return;

        markFired(fireKey);

        const title = reminder.title || "Reminder";
        const bodyText = reminder.notes
          ? `${title} - ${reminder.notes}`
          : title;

        if (
          typeof Notification !== "undefined" &&
          Notification.permission === "granted"
        ) {
          try {
            new Notification("AurisTitutum PRO", {
              body: bodyText,
              icon: "/favicon.ico",
              tag: fireKey,
            });
          } catch {
            // Some browsers block notifications; fail silently.
          }
        }

        document.dispatchEvent(
          new CustomEvent("showToast", {
            detail: {
              message: `Reminder: ${bodyText}`,
              type: "reminder",
              id: Date.now() + Math.random(),
            },
          }),
        );
      });
    };

    checkAndFire();
    const interval = setInterval(checkAndFire, CHECK_INTERVAL_MS);
    const onFocus = () => checkAndFire();
    const onVisibility = () => {
      if (document.visibilityState === "visible") checkAndFire();
    };

    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      clearInterval(interval);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);
};

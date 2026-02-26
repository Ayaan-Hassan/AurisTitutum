import { useEffect, useRef } from "react";

const FIRED_STORAGE_KEY = "habitflow_fired_reminders";

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
    // Keep only the last 500 fired IDs to prevent unbounded growth
    const arr = [...ids].slice(-500);
    localStorage.setItem(FIRED_STORAGE_KEY, JSON.stringify(arr));
  } catch {
    // Non-fatal
  }
};

const getNowHHMM = () => {
  const now = new Date();
  const hh = String(now.getHours()).padStart(2, "0");
  const mm = String(now.getMinutes()).padStart(2, "0");
  return `${hh}:${mm}`;
};

const getTodayStr = () => new Date().toISOString().split("T")[0];

const getDayOfWeek = (dateStr) => {
  try {
    return new Date(dateStr + "T12:00:00").getDay();
  } catch {
    return -1;
  }
};

/**
 * useReminderNotifications
 *
 * Checks the reminders list every 60 seconds (and immediately on mount).
 * When a reminder is due:
 *  - Fires a browser Notification if permission is granted.
 *  - Dispatches a "showToast" CustomEvent so the in-app toast appears.
 *  - Marks the reminder as fired in localStorage so it doesn't re-fire.
 *
 * Repeat logic:
 *  - "none"   → fires once when date+time passes, keyed by reminder id
 *  - "daily"  → fires every day at the scheduled time, keyed by id+today
 *  - "weekly" → fires each week on the same weekday as the original date,
 *               keyed by id+today
 */
export const useReminderNotifications = (reminders) => {
  // Keep a stable ref so the interval always sees the latest reminders
  const remindersRef = useRef(reminders);
  useEffect(() => {
    remindersRef.current = reminders;
  }, [reminders]);

  useEffect(() => {
    const checkAndFire = () => {
      const current = remindersRef.current;
      if (!current || current.length === 0) return;

      const todayStr = getTodayStr();
      const nowHHMM = getNowHHMM();
      const firedIds = getFiredIds();
      const todayDOW = new Date().getDay();

      current.forEach((reminder) => {
        if (!reminder || !reminder.id || !reminder.date || !reminder.time) return;

        const repeat = reminder.repeat || "none";
        let fireKey;
        let shouldFire = false;

        if (repeat === "none") {
          fireKey = reminder.id;
          // Fire if today is on or after the reminder date AND time has passed
          if (reminder.date <= todayStr && reminder.time <= nowHHMM) {
            shouldFire = true;
          }
        } else if (repeat === "daily") {
          fireKey = `${reminder.id}_${todayStr}`;
          if (reminder.time <= nowHHMM) {
            shouldFire = true;
          }
        } else if (repeat === "weekly") {
          fireKey = `${reminder.id}_${todayStr}`;
          const reminderDOW = getDayOfWeek(reminder.date);
          if (reminderDOW === todayDOW && reminder.time <= nowHHMM) {
            shouldFire = true;
          }
        }

        if (!shouldFire || firedIds.has(fireKey)) return;

        // Mark as fired first to prevent double-fire
        markFired(fireKey);

        const title = reminder.title || "Reminder";
        const bodyText = reminder.notes
          ? `${title} — ${reminder.notes}`
          : title;

        // Browser notification
        if (
          typeof Notification !== "undefined" &&
          Notification.permission === "granted"
        ) {
          try {
            new Notification("⏰ AurisTitutum PRO", {
              body: bodyText,
              icon: "/favicon.ico",
              tag: fireKey,
            });
          } catch {
            // Some browsers block notifications; fail silently
          }
        }

        // In-app toast via CustomEvent
        document.dispatchEvent(
          new CustomEvent("showToast", {
            detail: {
              message: `⏰ ${bodyText}`,
              type: "reminder",
              id: Date.now() + Math.random(),
            },
          })
        );
      });
    };

    // Run immediately, then every 60 seconds
    checkAndFire();
    const interval = setInterval(checkAndFire, 60_000);

    // Also check when the browser tab regains focus
    const onFocus = () => checkAndFire();
    window.addEventListener("focus", onFocus);

    return () => {
      clearInterval(interval);
      window.removeEventListener("focus", onFocus);
    };
  }, []); // empty deps — reads from ref
};

import { useState, useEffect, useCallback, useRef } from "react";
import { getLocalDateKey } from "../utils/date";

const READ_KEYS_STORAGE = "auris_read_notification_keys";

/** Load persisted read keys from localStorage */
const loadReadKeys = () => {
  try {
    const raw = localStorage.getItem(READ_KEYS_STORAGE);
    if (raw) return new Set(JSON.parse(raw));
  } catch {}
  return new Set();
};

/** Save read keys to localStorage */
const saveReadKeys = (keys) => {
  try {
    localStorage.setItem(READ_KEYS_STORAGE, JSON.stringify([...keys]));
  } catch {}
};

/**
 * Hook to manage habit completion notifications.
 * Shows at most one in-app reminder per day to avoid overlapping toasts.
 * Read state is persisted to localStorage so page refreshes don't reset unread/read status.
 */
export const useHabitNotifications = (habits, config) => {
  const [toasts, setToasts] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const inactivityLevelRef = useRef(null); // '1h' | '6h' | '20h' | null
  const readKeysRef = useRef(loadReadKeys());

  const addToast = useCallback((message, type = "info") => {
    const id = Date.now();
    setToasts((prev) => [...prev, { id, message, type }]);

    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 5000);
  }, []);

  const removeToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const addNotification = useCallback((payload) => {
    const { key, title, body, level } = payload;
    setNotifications((prev) => {
      // Avoid duplicates by key
      if (key && prev.some((n) => n.key === key)) return prev;
      const id = Date.now() + Math.random();
      const notifKey = key || String(id);
      // Check if already read from persisted storage
      const isRead = readKeysRef.current.has(notifKey);
      return [
        {
          id,
          key: notifKey,
          title,
          body,
          level,
          createdAt: new Date().toISOString(),
          read: isRead,
        },
        ...prev,
      ].slice(0, 50);
    });
  }, []);

  const markAllRead = useCallback((notificationId = null, forceStatus = null) => {
    setNotifications((prev) => {
      let updated;
      // 1. Force state for all (header toggle)
      if (forceStatus !== null && notificationId === null) {
        updated = prev.map((n) => ({ ...n, read: forceStatus }));
      } else if (notificationId !== null) {
        // 2. Mark specific notification as read (individual click)
        updated = prev.map((n) => (n.id === notificationId ? { ...n, read: true } : n));
      } else {
        // 3. Fallback (bell icon click): mark everything as read
        updated = prev.map((n) => ({ ...n, read: true }));
      }

      // Persist the newly read keys
      const newReadKeys = new Set(readKeysRef.current);
      updated.filter((n) => n.read).forEach((n) => newReadKeys.add(n.key));
      readKeysRef.current = newReadKeys;
      saveReadKeys(newReadKeys);

      return updated;
    });
  }, []);

  // Helper: compute hours since last activity
  const getHoursSinceLastActivity = useCallback(() => {
    let last = null;
    habits.forEach((h) => {
      (h.logs || []).forEach((day) => {
        (day.entries || []).forEach((entry) => {
          const isCount = typeof entry === "string" && entry.includes("|");
          const [time] = isCount ? entry.split("|") : [entry];
          const dt = new Date(`${day.date}T${time || "00:00:00"}`);
          if (!Number.isNaN(dt.getTime())) {
            if (!last || dt > last) last = dt;
          }
        });
      });
    });
    if (!last) return null;
    const diffMs = Date.now() - last.getTime();
    return diffMs / (1000 * 60 * 60);
  }, [habits]);

  const checkHabits = useCallback(() => {
    if (!config?.notificationsEnabled || habits.length === 0) return;

    // Inactivity-based notifications (1h / 6h / 20h)
    const hoursSince = getHoursSinceLastActivity();
    if (hoursSince != null) {
      let targetLevel = null;
      if (hoursSince >= 20) targetLevel = "20h";
      else if (hoursSince >= 6) targetLevel = "6h";
      else if (hoursSince >= 1) targetLevel = "1h";

      if (targetLevel && inactivityLevelRef.current !== targetLevel) {
        inactivityLevelRef.current = targetLevel;
        const title =
          targetLevel === "1h"
            ? "Quick check-in"
            : targetLevel === "6h"
              ? "You are drifting"
              : "Long downtime detected";
        const body =
          targetLevel === "1h"
            ? "You have been inactive for about an hour. Log a small win to keep the chain alive."
            : targetLevel === "6h"
              ? "Roughly six hours without logs. Consider one intentional habit to reset momentum."
              : "It has been ~20 hours since your last log. A single action can restart the streak.";

        addNotification({
          key: `inactivity-${targetLevel}-${getLocalDateKey()}`,
          title,
          body,
          level: targetLevel,
        });

        if (
          typeof Notification !== "undefined" &&
          Notification.permission === "granted"
        ) {
          new Notification("AurisTitutum PRO", {
            body,
            icon: "/favicon.ico",
            requireInteraction: true,
          });
        }
      }
    } else {
      inactivityLevelRef.current = null;
    }
  }, [
    config?.notificationsEnabled,
    habits,
    addNotification,
    addToast,
    getHoursSinceLastActivity,
  ]);

  // Check on mount and periodically (every 60 min) and when window gains focus
  useEffect(() => {
    const run = () => setTimeout(checkHabits, 2000);
    run();
    const interval = setInterval(run, 60 * 60 * 1000);
    const onFocus = () => run();
    window.addEventListener("focus", onFocus);
    
    // Listen for custom system notifications (e.g., from Admin)
    const handleAddSystemNotification = (e) => {
        if (e.detail) {
            addNotification({
                ...e.detail,
                key: e.detail.key || Date.now().toString()
            });
            addToast(e.detail.body, e.detail.level || "info");
        }
    };
    document.addEventListener("addSystemNotification", handleAddSystemNotification);

    return () => {
      clearInterval(interval);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("addSystemNotification", handleAddSystemNotification);
    };
  }, [checkHabits, addNotification]);

  return { toasts, notifications, addToast, removeToast, markAllRead };
};

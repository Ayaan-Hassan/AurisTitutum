import { useState, useEffect, useCallback, useRef } from 'react';

const REMINDER_STORAGE_KEY = 'habitflow_reminder_shown_date';

/**
 * Hook to manage habit completion notifications.
 * Shows at most one in-app reminder per day to avoid overlapping toasts.
 */
export const useHabitNotifications = (habits, config) => {
    const [toasts, setToasts] = useState([]);
    const [notifications, setNotifications] = useState([]);
    const reminderShownRef = useRef(false);
    const inactivityLevelRef = useRef(null); // '1h' | '6h' | '20h' | null

    const addToast = useCallback((message, type = 'info') => {
        const id = Date.now();
        setToasts(prev => [...prev, { id, message, type }]);

        setTimeout(() => {
            setToasts(prev => prev.filter(t => t.id !== id));
        }, 5000);
    }, []);

    const removeToast = useCallback((id) => {
        setToasts(prev => prev.filter(t => t.id !== id));
    }, []);

    const addNotification = useCallback((payload) => {
        const { key, title, body, level } = payload;
        setNotifications(prev => {
            // Avoid duplicates by key
            if (key && prev.some(n => n.key === key)) return prev;
            const id = Date.now() + Math.random();
            return [
                { id, key: key || String(id), title, body, level, createdAt: new Date().toISOString(), read: false },
                ...prev
            ].slice(0, 50);
        });
    }, []);

    const markAllRead = useCallback(() => {
        setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    }, []);

    // Helper: compute hours since last activity
    const getHoursSinceLastActivity = useCallback(() => {
        let last = null;
        habits.forEach(h => {
            (h.logs || []).forEach(day => {
                (day.entries || []).forEach(entry => {
                    const isCount = typeof entry === 'string' && entry.includes('|');
                    const [time] = isCount ? entry.split('|') : [entry];
                    const dt = new Date(`${day.date}T${time || '00:00:00'}`);
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

    const checkHabits = useCallback(async () => {
        if (!config?.notificationsEnabled || habits.length === 0) return;

        // Inactivity-based notifications (1h / 6h / 20h)
        const hoursSince = getHoursSinceLastActivity();
        if (hoursSince != null) {
            let targetLevel = null;
            if (hoursSince >= 20) targetLevel = '20h';
            else if (hoursSince >= 6) targetLevel = '6h';
            else if (hoursSince >= 1) targetLevel = '1h';

            if (targetLevel && inactivityLevelRef.current !== targetLevel) {
                inactivityLevelRef.current = targetLevel;
                const title = targetLevel === '1h'
                    ? 'Quick check-in'
                    : targetLevel === '6h'
                        ? 'You are drifting'
                        : 'Long downtime detected';
                const body = targetLevel === '1h'
                    ? 'You have been inactive for about an hour. Log a small win to keep the chain alive.'
                    : targetLevel === '6h'
                        ? 'Roughly six hours without logs. Consider one intentional habit to reset momentum.'
                        : 'It has been ~20 hours since your last log. A single action can restart the streak.';

                addNotification({
                    key: `inactivity-${targetLevel}-${new Date().toISOString().split('T')[0]}`,
                    title,
                    body,
                    level: targetLevel
                });

                if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
                    new Notification('AurisTitutum PRO', { body, icon: '/favicon.ico' });
                }
            }
        } else {
            inactivityLevelRef.current = null;
        }

        const today = new Date().toISOString().split('T')[0];
        const unloggedGoodHabits = habits.filter(h =>
            h.type === 'Good' &&
            !h.logs.some(l => l.date === today)
        );

        if (unloggedGoodHabits.length > 0) {
            // Show in-app reminder only once per day (no stacking/overlap)
            const lastShown = typeof sessionStorage !== 'undefined' ? sessionStorage.getItem(REMINDER_STORAGE_KEY) : null;
            if (lastShown !== today && !reminderShownRef.current) {
                reminderShownRef.current = true;
                if (typeof sessionStorage !== 'undefined') sessionStorage.setItem(REMINDER_STORAGE_KEY, today);
                const names = unloggedGoodHabits.map(h => h.name).join(', ');
                const message = `Reminder: You haven't logged ${names} today. Keep the flow!`;
                addToast(message, 'reminder');
                addNotification({
                    key: `unlogged-${today}`,
                    title: 'Unlogged habits detected',
                    body: message,
                    level: 'daily-reminder'
                });
            }

            if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
                new Notification('AurisTitutum PRO', {
                    body: `Reminder: You haven't logged ${unloggedGoodHabits.map(h => h.name).join(', ')} today. Keep the flow!`,
                    icon: '/favicon.ico'
                });
            } else if (typeof Notification !== 'undefined' && Notification.permission !== 'denied') {
                const permission = await Notification.requestPermission();
                if (permission === 'granted') {
                    new Notification('AurisTitutum PRO', {
                        body: `Reminder: You haven't logged ${unloggedGoodHabits.map(h => h.name).join(', ')} today. Keep the flow!`,
                        icon: '/favicon.ico'
                    });
                }
            }
        }
    }, [config?.notificationsEnabled, habits, addNotification, addToast, getHoursSinceLastActivity]);

    // Request notification permission on mount so reminders work everywhere
    useEffect(() => {
        if (config?.notificationsEnabled && typeof Notification !== 'undefined' && Notification.permission === 'default') {
            Notification.requestPermission();
        }
    }, [config?.notificationsEnabled]);

    // Check on mount and periodically (every 60 min) and when window gains focus
    useEffect(() => {
        const run = () => setTimeout(checkHabits, 2000);
        run();
        const interval = setInterval(run, 60 * 60 * 1000);
        const onFocus = () => run();
        window.addEventListener('focus', onFocus);
        return () => {
            clearInterval(interval);
            window.removeEventListener('focus', onFocus);
        };
    }, [checkHabits]);

    return { toasts, notifications, addToast, removeToast, markAllRead };
};

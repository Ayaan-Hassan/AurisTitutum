import { useState, useEffect, useRef, memo, useCallback } from "react";
import { Routes, Route } from "react-router-dom";
import Layout from "./components/Layout";
import Icon from "./components/Icon";
import Dashboard from "./pages/Dashboard";
import Analytics from "./pages/Analytics";
import Habits from "./pages/Habits";
import Logs from "./pages/Logs";
import Settings from "./pages/Settings";
import Notes from "./pages/Notes";
import Reminders from "./pages/Reminders";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import Landing from "./pages/Landing";
import Contact from "./pages/Contact";
import AdminDashboard from "./pages/AdminDashboard";
import { trackEvent } from "./utils/telemetry";
import { ThemeProvider } from "./components/ThemeProvider";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import { useHabitNotifications } from "./hooks/useHabitNotifications";
import { useReminderNotifications } from "./hooks/useReminderNotifications";
import ToastContainer from "./components/Toast";
import TourGuide from "./components/TourGuide";
import { db } from "./firebase.config";
import { collection, addDoc } from "firebase/firestore";
import { Button } from "./components/ui/Button";

const DAILY_INSIGHTS = [
  {
    title: "Daily insight",
    body: "Log first, judge later. Consistency starts with clean data.",
  },
  {
    title: "Momentum check",
    body: "One small constructive log today keeps the system alive.",
  },
  {
    title: "Operator mode",
    body: "Protect your streak by making the next action frictionless.",
  },
  {
    title: "System design",
    body: "Make good habits obvious. Make bad habits invisible.",
  },
  {
    title: "Trend over day",
    body: "A single off-day is noise. The weekly trend is signal.",
  },
  {
    title: "Identity loop",
    body: "Each log is a vote for the person you're becoming.",
  },
  {
    title: "Minimum viable win",
    body: "If you can do 1%, you can do it daily.",
  },
  {
    title: "Review cadence",
    body: "Quick weekly reviews beat intense monthly overhauls every time.",
  },
  {
    title: "Compound effect",
    body: "1% better every day compounds into a 37x improvement over a year. The math is on your side.",
  },
  {
    title: "Environment first",
    body: "Willpower is unreliable. Design your environment so the default action is always the right one.",
  },
  {
    title: "Two-minute rule",
    body: "If starting a habit takes less than two minutes, begin it right now. Eliminate friction at the entry point.",
  },
  {
    title: "Never miss twice",
    body: "One miss is an accident. Two misses is the beginning of a new (worse) habit. Recover fast.",
  },
  {
    title: "Deep work node",
    body: "Your most critical habit deserves your peak energy hours. Guard that window like infrastructure.",
  },
  {
    title: "Anchor stacking",
    body: "Stack a new behavior onto an existing habit. The chain reaction is more durable than solo effort.",
  },
  {
    title: "Data integrity",
    body: "Your logs don't lie. If the 30-day pattern looks wrong, the behavior is wrong. Adjust the system.",
  },
  {
    title: "Recovery protocol",
    body: "A bad day is a data point, not a verdict. Analyze, adapt, and return to the system.",
  },
  {
    title: "Time block truth",
    body: "Habits without a scheduled time are just intentions. Put the behavior on the calendar.",
  },
  {
    title: "Energy audit",
    body: "Track which habits drain you and which build you. Invest your prime hours in the builders.",
  },
  {
    title: "Small wins compound",
    body: "Each completed log is a micro-confirmation of your identity. Stack enough of them and identity shifts.",
  },
  {
    title: "Context as cue",
    body: "Different locations trigger different behaviors. Use location deliberately as a habit activation cue.",
  },
  {
    title: "The plateau effect",
    body: "Progress feels invisible before it becomes undeniable. Stay in the system through the quiet periods.",
  },
  {
    title: "Habit architecture",
    body: "The quality of your system determines the quality of your results — not the intensity of your motivation.",
  },
  {
    title: "Friction principle",
    body: "Reduce steps between you and good habits. Every extra click, movement, and decision costs willpower.",
  },
  {
    title: "Node audit",
    body: "A habit you haven't reviewed in 30 days may no longer serve the system. Prune ruthlessly.",
  },
  {
    title: "Input tracking",
    body: "Track inputs, not just outcomes. Showing up is the core metric. Results follow consistent inputs.",
  },
  {
    title: "Cold streak reset",
    body: "Cold streaks happen to every operator. The system's job is to restart faster, not avoid them entirely.",
  },
  {
    title: "Foundation OS",
    body: "Sleep, hydration, and movement aren't optional habits — they are the operating system everything else runs on.",
  },
  {
    title: "Reward circuit",
    body: "Celebrate immediately after completing a habit. The brain wires fast when reward follows action closely.",
  },
  {
    title: "Long-game thinking",
    body: "You are not building habits for this week. You are engineering the person you will be in five years.",
  },
  {
    title: "Keystone habits",
    body: "Some habits trigger a cascade of other good behaviors. Find your keystone node and protect it above all others.",
  },
];

const INSIGHT_SEED = new Date().toISOString().slice(0, 10);
const getDailyInsight = () => {
  let hash = 0;
  for (let i = 0; i < INSIGHT_SEED.length; i++) {
    hash = (hash * 31 + INSIGHT_SEED.charCodeAt(i)) >>> 0;
  }
  return DAILY_INSIGHTS[hash % DAILY_INSIGHTS.length];
};

const LEGACY_STORAGE_KEYS = {
  habits: "habitflow_pro_data",
  userConfig: "habitflow_pro_user",
  notes: "habitflow_pro_notes",
  reminders: "habitflow_pro_reminders",
};

const SCOPED_STATE_PREFIX = "habitflow_pro_state_";
const _backendBase = (import.meta.env.VITE_BACKEND_URL ?? "").replace(
  /\/$/,
  "",
);
const CLOUD_SYNC_API_BASE = _backendBase ? `${_backendBase}/api` : "/api";
const CLOUD_SYNC_POLL_MS = 4000;

const DEFAULT_USER_CONFIG = {
  name: "",
  email: "",
  avatar: null,
  settings: {
    persistence: true,
    audit: true,
    devConsole: false,
    notificationsEnabled: true,
  },
};

const safeJsonParse = (value, fallback) => {
  try {
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
};

const normalizeUserConfig = (raw = {}) => ({
  ...DEFAULT_USER_CONFIG,
  ...(raw || {}),
  settings: {
    ...DEFAULT_USER_CONFIG.settings,
    ...((raw && raw.settings) || {}),
  },
});

const mergeUserIdentityIntoConfig = (config = {}, user = null) => {
  const normalized = normalizeUserConfig(config);
  if (!user) return normalized;

  const fallbackName = user?.email ? user.email.split("@")[0] : "";
  return {
    ...normalized,
    email: user?.email || normalized.email || "",
    name: normalized.name || user?.name || fallbackName,
    avatar: normalized.avatar || user?.photoURL || null,
  };
};

const normalizeAppState = (raw = {}) => ({
  habits: Array.isArray(raw.habits) ? raw.habits : [],
  userConfig: normalizeUserConfig(raw.userConfig),
  notes: Array.isArray(raw.notes) ? raw.notes : [],
  reminders: Array.isArray(raw.reminders) ? raw.reminders : [],
});

const areAppStatesEqual = (left, right) =>
  JSON.stringify(normalizeAppState(left)) ===
  JSON.stringify(normalizeAppState(right));

const getUserKey = (user) => user?.uid || user?.id || null;
const getStorageScope = (user) =>
  getUserKey(user) ? `user_${getUserKey(user)}` : "guest";

const getScopedStateKey = (scope) => `${SCOPED_STATE_PREFIX}${scope}`;

const readScopedState = (scope) => {
  if (typeof localStorage === "undefined") return null;
  const parsed = safeJsonParse(
    localStorage.getItem(getScopedStateKey(scope)),
    null,
  );
  return parsed ? normalizeAppState(parsed) : null;
};

const readLegacyState = () => {
  if (typeof localStorage === "undefined") return null;
  const habits = safeJsonParse(
    localStorage.getItem(LEGACY_STORAGE_KEYS.habits),
    null,
  );
  const userConfig = safeJsonParse(
    localStorage.getItem(LEGACY_STORAGE_KEYS.userConfig),
    null,
  );
  const notes = safeJsonParse(
    localStorage.getItem(LEGACY_STORAGE_KEYS.notes),
    null,
  );
  const reminders = safeJsonParse(
    localStorage.getItem(LEGACY_STORAGE_KEYS.reminders),
    null,
  );
  const hasAnyLegacy =
    habits !== null ||
    userConfig !== null ||
    notes !== null ||
    reminders !== null;
  if (!hasAnyLegacy) return null;
  return normalizeAppState({
    habits: habits || [],
    userConfig: userConfig || DEFAULT_USER_CONFIG,
    notes: notes || [],
    reminders: reminders || [],
  });
};

const writeScopedState = (scope, state) => {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(
    getScopedStateKey(scope),
    JSON.stringify({
      ...normalizeAppState(state),
      updatedAt: Date.now(),
    }),
  );
};

import { getLocalDateKey } from "./utils/date";

// eslint-disable-next-line
const _unused_date_key = true;

// Image compression utility
const compressImage = (base64Str) => {
  return new Promise((resolve) => {
    const img = new Image();
    img.src = base64Str;
    img.onload = () => {
      const canvas = document.createElement("canvas");
      const MAX_SIZE = 128;
      let width = img.width;
      let height = img.height;
      if (width > height) {
        if (width > MAX_SIZE) {
          height *= MAX_SIZE / width;
          width = MAX_SIZE;
        }
      } else {
        if (height > MAX_SIZE) {
          width *= MAX_SIZE / height;
          height = MAX_SIZE;
        }
      }
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0, width, height);
      resolve(canvas.toDataURL("image/jpeg", 0.7));
    };
  });
};

function AppContent() {
  const authContext = useAuth();
  const { user, replaceHabitsState, replaceNotesState, replaceRemindersState, updateUserConfig } = authContext;

  const userKey = getUserKey(user);
  const activeScope = getStorageScope(user);
  const initialState = normalizeAppState(
    readScopedState("guest") || readLegacyState() || {},
  );

  const [habits, setHabits] = useState(initialState.habits);
  const [userConfig, setUserConfig] = useState(initialState.userConfig);

  const [showAddModal, setShowAddModal] = useState(false);
  const [addHabitStep, setAddHabitStep] = useState(1);
  const [newHabit, setNewHabit] = useState({
    name: "",
    type: "Good",
    mode: "quick",
    unit: "",
    emoji: "",
  });
  const [selectedHabitId, setSelectedHabitId] = useState(null);
  const [notes, setNotes] = useState(initialState.notes);
  const [reminders, setReminders] = useState(initialState.reminders);
  const fileInputRef = useRef(null);
  const loadedScopeRef = useRef("guest");
  const pendingScopeInitRef = useRef(null);
  const cloudStateReadyRef = useRef(false);
  const cloudSaveTimerRef = useRef(null);
  const skipNextCloudSaveRef = useRef(false);
  const isSavingToCloudRef = useRef(false);

  // Track the state that is currently synced with the cloud
  const cloudStateRef = useRef(initialState);

  useEffect(() => {
    if (!user) return;
    setUserConfig((prev) => mergeUserIdentityIntoConfig(prev, user));
  }, [activeScope, userKey, user?.email, user?.name]);

  const authCtx = useAuth();
  useEffect(() => {
    if (authCtx.showBanModal) {
        setConfirmAction({
            type: "ban_notice",
            banned: authCtx.isBanned,
            reason: authCtx.banReason
        });
        authCtx.setShowBanModal(false);
    }
  }, [authCtx.showBanModal, authCtx.isBanned, authCtx.banReason]);

  const { toasts, removeToast, notifications, markAllRead, addToast } =
    useHabitNotifications(habits, {
      ...userConfig.settings,
      notificationsEnabled:
        !!user && userConfig.settings.notificationsEnabled !== false,
    });

  // Fire scheduled reminder notifications
  useReminderNotifications(reminders);

  const [featureLockOpen, setFeatureLockOpen] = useState(false);
  const [activeSystemMsg, setActiveSystemMsg] = useState(null);
  const [confirmAction, setConfirmAction] = useState(null);

  const handleAddHabitRequest = useCallback(() => {
    if (!user && habits.length >= 1) {
      setFeatureLockOpen(true);
      return;
    }
    setAddHabitStep(1);
    setShowAddModal(true);
  }, [user, habits.length]);

  // Listen for toast events from components
  useEffect(() => {
    const handleToast = (e) => {
      addToast(e.detail.message, e.detail.type);
    };
    const handleSystemPopup = (e) => {
      setActiveSystemMsg(e.detail.message);
    };
    document.addEventListener("showToast", handleToast);
    document.addEventListener("showSystemPopup", handleSystemPopup);
    return () => {
      document.removeEventListener("showToast", handleToast);
      document.removeEventListener("showSystemPopup", handleSystemPopup);
    };
  }, [addToast]);

  useEffect(() => {
    const showModalListener = () => handleAddHabitRequest();
    document.addEventListener("showModal", showModalListener);
    return () => {
      document.removeEventListener("showModal", showModalListener);
    };
  }, [handleAddHabitRequest]);



  useEffect(() => {
    if (loadedScopeRef.current === activeScope) return;

    const previousScope = loadedScopeRef.current;
    const existingScopedState = readScopedState(activeScope);
    const isUserScope = activeScope.startsWith("user_");
    const switchingBetweenUsers =
      previousScope.startsWith("user_") &&
      isUserScope &&
      previousScope !== activeScope;
    const legacyFallback = !isUserScope ? readLegacyState() : null;
    const nextState = normalizeAppState(
      switchingBetweenUsers ? {} : existingScopedState || legacyFallback || {},
    );

    if (!existingScopedState || switchingBetweenUsers) {
      writeScopedState(activeScope, nextState);
    }

    loadedScopeRef.current = activeScope;
    pendingScopeInitRef.current = activeScope;
    setHabits(nextState.habits);
    setUserConfig(mergeUserIdentityIntoConfig(nextState.userConfig, user));
    setNotes(nextState.notes);
    setReminders(nextState.reminders);
  }, [activeScope, user]);

  useEffect(() => {
    if (loadedScopeRef.current !== activeScope) return;
    if (pendingScopeInitRef.current === activeScope) {
      pendingScopeInitRef.current = null;
      return;
    }
    writeScopedState(activeScope, {
      habits,
      userConfig,
      notes,
      reminders,
    });
  }, [activeScope, habits, userConfig, notes, reminders]);

  useEffect(() => {
    cloudStateReadyRef.current = false;

    if (!userKey) {
      cloudStateReadyRef.current = true;
      return undefined;
    }

    const remoteState = normalizeAppState({
      habits: authContext.habits,
      userConfig: authContext.userConfig,
      notes: authContext.notes,
      reminders: authContext.reminders,
    });

    if (!areAppStatesEqual(remoteState, cloudStateRef.current)) {
      if (cloudSaveTimerRef.current || isSavingToCloudRef.current) {
        // Prevent overwriting local state if we have a pending push to Firebase
        return;
      }

      // Meaningful update from remote
      const hasContent = remoteState.habits.length > 0 || remoteState.notes.length > 0 || remoteState.reminders.length > 0;
      // Also prevent overwriting local state with completely empty state immediately after login
      if (hasContent || !authContext.dataLoading) {
        skipNextCloudSaveRef.current = true;
        setHabits(remoteState.habits);
        setUserConfig(mergeUserIdentityIntoConfig(remoteState.userConfig, user));
        setNotes(remoteState.notes);
        setReminders(remoteState.reminders);
        writeScopedState(activeScope, remoteState);
        cloudStateRef.current = remoteState;
      }
    }

    cloudStateReadyRef.current = true;
  }, [activeScope, user, userKey, authContext.habits, authContext.notes, authContext.reminders, authContext.userConfig, authContext.dataLoading]);

  // Push local state to remote
  useEffect(() => {
    if (!userKey || !cloudStateReadyRef.current || authContext.dataLoading) {
      return undefined;
    }

    if (skipNextCloudSaveRef.current) {
      skipNextCloudSaveRef.current = false;
      return undefined;
    }

    const currentState = normalizeAppState({
      habits,
      userConfig,
      notes,
      reminders,
    });

    // Don't push if nothing has functionally changed compared to the last cloud state
    if (areAppStatesEqual(currentState, cloudStateRef.current)) {
      return undefined;
    }

    if (cloudSaveTimerRef.current) {
      clearTimeout(cloudSaveTimerRef.current);
      cloudSaveTimerRef.current = null;
    }

    cloudSaveTimerRef.current = setTimeout(async () => {
      cloudSaveTimerRef.current = null;
      try {
        isSavingToCloudRef.current = true;
        // Sync in parallel for better performance and reliability
        await Promise.all([
          replaceHabitsState(habits),
          replaceNotesState(notes),
          replaceRemindersState(reminders),
          updateUserConfig(userConfig)
        ]);
        cloudStateRef.current = currentState;
      } catch (error) {
        console.error("[firebase-sync] Failed to persist cloud state:", error);
      } finally {
        isSavingToCloudRef.current = false;
      }
    }, 400);

    return () => {
      if (cloudSaveTimerRef.current) {
        clearTimeout(cloudSaveTimerRef.current);
        cloudSaveTimerRef.current = null;
      }
    };
  }, [habits, notes, reminders, userConfig, userKey, authContext.dataLoading]);

  const logInProgressRef = useRef(false);

  const logActivity = useCallback((id, increment = true, amount = 1, unit = "", photoData = null) => {
    if (id === "example-habit") {
        const toastEvent = new CustomEvent("showToast", {
            detail: { message: "Create your own habit to start tracking!", type: "info", id: Date.now() },
        });
        document.dispatchEvent(toastEvent);
        return;
    }
    // Guard against double-taps / concurrency
    if (logInProgressRef.current) return;
    logInProgressRef.current = true;
    setTimeout(() => { logInProgressRef.current = false; }, 300);

    const amt = Math.max(1, Math.floor(Number(amount) || 1));
    const now = new Date();
    const todayKey = getLocalDateKey(now);
    const timestamp = now.toLocaleTimeString([], { hour12: false });

    setHabits((prev) =>
      prev.map((h) => {
        if (h.id !== id) return h;

        const isValueMode = h.mode === "count" || h.mode === "timer" || h.mode === "rating";
        const isCheckMode = h.mode === "check";
        let updatedLogs = (h.logs || []).map((l) => ({
          ...l,
          entries: [...(l.entries || [])],
        }));
        let updatedTotal = h.totalLogs;

        if (increment) {
          const existingDateIdx = updatedLogs.findIndex(
            (l) => l.date === todayKey,
          );

          if (isCheckMode) {
            if (existingDateIdx > -1) return h;
            updatedTotal += 1;
            updatedLogs.push({
              date: todayKey,
              count: 1,
              entries: [timestamp],
            });
          } else if (isValueMode) {
            const value = amt;
            const entryStr = `${timestamp}|${value}|${unit || h.unit || ""}`;
            updatedTotal += value;
            if (existingDateIdx > -1) {
              updatedLogs[existingDateIdx] = {
                ...updatedLogs[existingDateIdx],
                count: updatedLogs[existingDateIdx].count + value,
                entries: [...updatedLogs[existingDateIdx].entries, entryStr],
              };
            } else {
              updatedLogs.push({
                date: todayKey,
                count: value,
                entries: [entryStr],
              });
            }
          } else if (h.mode === "upload") {
            // Store the photo data URL as the entry string
            const entryStr = photoData || timestamp;
            updatedTotal += 1;
            if (existingDateIdx > -1) {
              updatedLogs[existingDateIdx] = {
                ...updatedLogs[existingDateIdx],
                count: updatedLogs[existingDateIdx].count + 1,
                entries: [...updatedLogs[existingDateIdx].entries, entryStr],
              };
            } else {
              updatedLogs.push({
                date: todayKey,
                count: 1,
                entries: [entryStr],
              });
            }
          } else {
            updatedTotal += amt;
            const newEntries = Array(amt).fill(timestamp);
            if (existingDateIdx > -1) {
              updatedLogs[existingDateIdx] = {
                ...updatedLogs[existingDateIdx],
                count: updatedLogs[existingDateIdx].count + amt,
                entries: [
                  ...updatedLogs[existingDateIdx].entries,
                  ...newEntries,
                ],
              };
            } else {
              updatedLogs.push({
                date: todayKey,
                count: amt,
                entries: newEntries,
              });
            }
          }
        } else {
          const dateIdx = updatedLogs.findIndex((l) => l.date === todayKey);

          if (isCheckMode) {
            if (dateIdx > -1) {
              updatedTotal -= 1;
              updatedLogs.splice(dateIdx, 1);
            }
          } else if (
            isValueMode &&
            dateIdx > -1 &&
            updatedLogs[dateIdx].entries.length > 0
          ) {
            const newEntries = [...updatedLogs[dateIdx].entries];
            const lastEntry = newEntries.pop();
            const parts = lastEntry.split("|");
            const val = parseInt(parts[1], 10) || 1;
            const newCount = updatedLogs[dateIdx].count - val;
            updatedTotal -= val;
            if (newCount <= 0) {
              updatedLogs.splice(dateIdx, 1);
            } else {
              updatedLogs[dateIdx] = {
                ...updatedLogs[dateIdx],
                count: newCount,
                entries: newEntries,
              };
            }
          } else {
            const removeCount = Math.min(amt, updatedTotal);
            if (removeCount <= 0) return h;
            updatedTotal -= removeCount;
            if (dateIdx > -1 && updatedLogs[dateIdx].count > 0) {
              const toRemove = Math.min(
                removeCount,
                updatedLogs[dateIdx].count,
              );
              const newEntries = [...updatedLogs[dateIdx].entries];
              for (let i = 0; i < toRemove; i++) {
                if (newEntries.length > 0) newEntries.pop();
              }
              const newCount = updatedLogs[dateIdx].count - toRemove;
              if (newCount === 0) {
                updatedLogs.splice(dateIdx, 1);
              } else {
                updatedLogs[dateIdx] = {
                  ...updatedLogs[dateIdx],
                  count: newCount,
                  entries: newEntries,
                };
              }
            }
          }
        }
        return { ...h, logs: updatedLogs, totalLogs: updatedTotal };
      }),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleAvatarUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (event) => {
      const compressed = await compressImage(event.target.result);
      setUserConfig((prev) => ({ ...prev, avatar: compressed }));
    };
    reader.readAsDataURL(file);
    e.target.value = null;
  };

  const [dailyInsight] = useState(() => getDailyInsight());

  const displayHabits = habits;

  // Curated aesthetic emoji list — only proper emoji, grayscale-filtered to match dark/gray theme
  const THEMED_EMOJIS = [
    // Activity & Fitness
    "💪",
    "🏃",
    "🧘",
    "🏋️",
    "🚶",
    "🤸",
    "🧗",
    "🚴",
    // Mind & Focus
    "📖",
    "✍️",
    "💻",
    "🧠",
    "🎯",
    "🎓",
    "🔬",
    "📊",
    // Wellness & Nature
    "💤",
    "💧",
    "🌿",
    "🌱",
    "❄️",
    "🌙",
    "☁️",
    "🌊",
    // Energy & Creative
    "⚡",
    "🔥",
    "⭐",
    "⏰",
    "🎵",
    "🎨",
    "🚀",
    "🧬",
  ];

  return (
    <>
      <TourGuide />
      <Routes>
        {/* Public Landing */}
        <Route path="/" element={<Landing habits={displayHabits} user={user} />} />

        {/* Auth Pages */}
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />

        {/* App Shell */}
        <Route
          path="/app/*"
          element={
            <Layout
              userConfig={userConfig}
              onAddHabit={handleAddHabitRequest}
              habits={displayHabits}
              notifications={notifications}
              onNotificationsRead={markAllRead}
            >
              <ToastContainer toasts={toasts} onClose={removeToast} />
              <Routes>
                <Route
                  path=""
                  element={
                    <Dashboard
                      habits={displayHabits}
                      setHabits={setHabits}
                      logActivity={logActivity}
                      insights={dailyInsight}
                    />
                  }
                />
                <Route
                  path="analytics"
                  element={
                    <Analytics
                      habits={displayHabits}
                      selectedHabitId={selectedHabitId}
                      setSelectedHabitId={setSelectedHabitId}
                    />
                  }
                />
                <Route
                  path="habits"
                  element={
                    <Habits
                      habits={displayHabits}
                      setHabits={setHabits}
                      logActivity={logActivity}
                    />
                  }
                />
                <Route
                  path="logs"
                  element={<Logs habits={displayHabits} setHabits={setHabits} />}
                />
                <Route
                  path="notes"
                  element={<Notes notes={notes} setNotes={setNotes} />}
                />
                <Route
                  path="reminders"
                  element={
                    <Reminders
                      reminders={reminders}
                      setReminders={setReminders}
                    />
                  }
                />
                <Route
                  path="settings"
                  element={
                    <Settings
                      userConfig={userConfig}
                      setUserConfig={setUserConfig}
                      handleAvatarUpload={handleAvatarUpload}
                      fileInputRef={fileInputRef}
                      habits={habits}
                    />
                  }
                />
                <Route path="contact" element={<Contact />} />
                <Route path="admin" element={<AdminDashboard />} />
              </Routes>
            </Layout>
          }
        />
      </Routes>

      {showAddModal && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center z-[100] p-4 animate-in fade-in duration-300"
          onClick={(e) =>
            e.target === e.currentTarget && setShowAddModal(false)
          }
        >
          <div className="glass-card modal-enter w-full max-w-md rounded-[2rem] shadow-[0_32px_64px_-16px_rgba(0,0,0,0.5)] border-white/10 relative overflow-hidden flex flex-col transition-all duration-300">
            {/* Background Glow */}
            <div className="absolute -top-24 -right-24 w-48 h-48 bg-accent/5 rounded-full blur-[80px] pointer-events-none z-0" />

            {/* Scrollable inner content */}
            <div className="p-8 sm:p-10 relative z-10 w-full">
              <div className="flex justify-between items-center mb-10">
                <div>
                  <h3 className="text-2xl font-bold tracking-tighter text-text-primary uppercase">
                    Add Habit
                  </h3>
                  <div className="flex gap-1.5 mt-2">
                    {[1, 2, 3, 4].map(s => (
                      <div key={s} className={`h-1 rounded-full transition-all duration-300 ${addHabitStep === s ? "w-6 bg-accent" : addHabitStep > s ? "w-2 bg-accent/40" : "w-1 bg-white/10"}`} />
                    ))}
                  </div>
                </div>
                <button
                  onClick={() => setShowAddModal(false)}
                  className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-text-secondary hover:text-text-primary hover:border-text-secondary transition-all"
                >
                  <Icon name="x" size={18} />
                </button>
              </div>

              {addHabitStep === 1 && (
                <div className="animate-in slide-in-from-right fade-in duration-300 space-y-6">
                  <p className="text-center text-[10px] font-black uppercase tracking-[0.3em] text-text-secondary mb-8">What kind of habit?</p>
                  <div className="grid grid-cols-2 gap-4">
                    <button
                      onClick={() => { setNewHabit({ ...newHabit, type: "Good" }); setAddHabitStep(2); }}
                      className="group py-8 rounded-2xl border transition-all flex flex-col items-center gap-4 bg-bg-main/50 border-white/10 text-white hover:border-[#4ade80] hover:bg-[#4ade80]/5 shadow-sm hover:shadow-[0_0_24px_rgba(74,222,128,0.15)]"
                    >
                      <div className="w-14 h-14 rounded-full border border-inherit flex items-center justify-center group-hover:bg-[#4ade80]/10 transition-colors">
                        <Icon name="check" size={24} className="group-hover:text-[#4ade80] transition-colors" />
                      </div>
                      <span className="text-xs font-bold uppercase tracking-widest">Good Habit</span>
                    </button>
                    <button
                      onClick={() => { setNewHabit({ ...newHabit, type: "Bad" }); setAddHabitStep(2); }}
                      className="group py-8 rounded-2xl border transition-all flex flex-col items-center gap-4 bg-bg-main/50 border-white/10 text-white hover:border-[#ef4444] hover:bg-[#ef4444]/5 shadow-sm hover:shadow-[0_0_24px_rgba(239,68,68,0.15)]"
                    >
                      <div className="w-14 h-14 rounded-full border border-inherit flex items-center justify-center group-hover:bg-[#ef4444]/10 transition-colors">
                        <Icon name="x" size={24} className="group-hover:text-[#ef4444] transition-colors" />
                      </div>
                      <span className="text-xs font-bold uppercase tracking-widest">Bad Habit</span>
                    </button>
                  </div>
                </div>
              )}

              {addHabitStep === 2 && (
                <div className="animate-in slide-in-from-right fade-in duration-300 space-y-8">
                  <div className="flex items-center ml-1">
                    <label className="text-[10px] font-black text-text-secondary uppercase tracking-[0.3em]">
                        Habit Identifier
                    </label>
                    <div className="relative group inline-flex items-center ml-2">
                      <Icon name="info" size={14} className="text-text-secondary cursor-pointer hover:text-text-primary transition-colors" />
                      <div className="absolute left-full ml-3 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 pointer-events-none transition-[opacity,transform] duration-200 z-50 translate-x-[-10px] group-hover:translate-x-0">
                        <div className="bg-bg-sidebar border border-border-color text-text-primary text-[10px] p-3 rounded-lg shadow-2xl w-56 relative box-border">
                          <div className="absolute top-1/2 -left-1.5 -translate-y-1/2 w-3 h-3 bg-bg-sidebar border-l border-b border-border-color transform rotate-45" />
                          <span className="relative z-10 block font-mono text-text-secondary">Keep it actionable and clear.</span>
                          <span className="relative z-10 block font-mono font-bold mt-1 text-text-primary">Ex: Reading Books, Morning Run</span>
                        </div>
                      </div>
                    </div>
                  </div>
                  <input
                    className="w-full bg-bg-main/50 border border-white/10 p-5 rounded-2xl outline-none focus:border-accent text-sm text-text-primary transition-all placeholder:text-text-secondary/30 focus:bg-bg-main"
                    placeholder="e.g. Read 20 pages"
                    value={newHabit.name}
                    onChange={(e) => setNewHabit({ ...newHabit, name: e.target.value })}
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && newHabit.name.trim()) setAddHabitStep(3);
                    }}
                  />
                  <div className="flex justify-between mt-8 pt-4">
                    <button onClick={() => setAddHabitStep(1)} className="px-5 py-3 rounded-xl border border-border-color text-xs font-bold uppercase tracking-widest text-text-secondary hover:text-text-primary active:scale-95 transition-all">Back</button>
                    <button onClick={() => setAddHabitStep(3)} disabled={!newHabit.name.trim()} className="px-6 py-3 bg-accent text-bg-main rounded-xl border border-transparent text-xs font-bold uppercase tracking-widest disabled:opacity-30 active:scale-95 transition-all">Next</button>
                  </div>
                </div>
              )}

              {addHabitStep === 3 && (
                <div className="animate-in slide-in-from-right fade-in duration-300 space-y-6">
                  <div className="flex items-center ml-1 mb-4">
                    <label className="text-[10px] font-black text-text-secondary uppercase tracking-[0.3em]">
                        Tracking Mode
                    </label>

                  </div>
                  
                  <div className="grid grid-cols-2 gap-3">
                    {[
                      { id: "quick", label: "Tap", info: "Quick +/- counter for fast logging." },
                      { id: "count", label: "Count", info: "Log specific values with units (reps, kg, pages)." },
                      { id: "check", label: "Check", info: "Simple completion checkbox once per day." },
                      { id: "timer", label: "Timer", info: "Integrated stopwatch to track duration." },
                      { id: "rating", label: "Rating", info: "Evaluate performance on a 1-5 star scale." },
                      { id: "upload", label: "Upload", info: "Keep a visual progress log with photos." }
                    ].map((m) => (
                      <div key={m.id} className="relative group/mode">
                        <button
                          onClick={() => setNewHabit({ 
                            ...newHabit, 
                            mode: m.id, 
                            unit: m.id === "count" ? newHabit.unit : m.id === "timer" ? "min" : m.id === "upload" ? "IMG" : "" 
                          })}
                          className={`w-full py-4 rounded-2xl text-[10px] font-bold uppercase tracking-[0.2em] border transition-all ${newHabit.mode === m.id ? "bg-accent text-bg-main border-accent scale-[1.02]" : "bg-bg-main/30 border-white/10 text-text-secondary hover:border-white/20 hover:scale-[1.02]"}`}
                        >
                          {m.label}
                        </button>
                        <div className="absolute right-2 top-2 z-20">
                           <div className="relative group/info">
                              <Icon name="info" size={10} className={`${newHabit.mode === m.id ? "text-bg-main/60" : "text-text-secondary/50"} cursor-help hover:text-text-primary transition-colors`} />
                              <div className="absolute bottom-full right-0 mb-2 opacity-0 group-hover/info:opacity-100 pointer-events-none transition-all duration-200 z-[60] translate-y-1 group-hover/info:translate-y-0">
                                <div className="bg-bg-sidebar border border-border-color text-[9px] p-2 rounded-lg shadow-2xl w-32 text-center normal-case font-mono leading-tight">
                                  {m.info}
                                </div>
                              </div>
                           </div>
                        </div>
                      </div>
                    ))}
                  </div>
                  
                  {newHabit.mode === "count" && (
                    <div className="pt-2 animate-in fade-in zoom-in-95">
                      <input
                          type="text"
                          placeholder="Unit (e.g. reps, hrs)"
                          className="w-full bg-bg-main/50 border border-white/10 p-4 rounded-xl text-sm text-text-primary outline-none focus:border-accent"
                          value={newHabit.unit}
                          onChange={(e) => setNewHabit({ ...newHabit, unit: e.target.value })}
                      />
                    </div>
                  )}

                  <div className="flex justify-between mt-8 pt-4">
                    <button onClick={() => setAddHabitStep(2)} className="px-5 py-3 rounded-xl border border-border-color text-xs font-bold uppercase tracking-widest text-text-secondary hover:text-text-primary active:scale-95 transition-all">Back</button>
                    <button onClick={() => setAddHabitStep(4)} className="px-6 py-3 bg-accent text-bg-main rounded-xl border border-transparent text-xs font-bold uppercase tracking-widest disabled:opacity-30 active:scale-95 transition-all">Next</button>
                  </div>
                </div>
              )}

              {addHabitStep === 4 && (
                <div className="animate-in slide-in-from-right fade-in duration-300 space-y-6">
                  <div className="flex items-center justify-between ml-1">
                    <label className="text-[10px] font-black text-text-secondary uppercase tracking-[0.3em]">
                      Habit Symbol
                    </label>
                    {newHabit.emoji && (
                      <button
                        type="button"
                        onClick={() => setNewHabit({ ...newHabit, emoji: "" })}
                        className="text-[9px] text-text-secondary hover:text-text-primary uppercase tracking-wider transition-colors"
                      >
                        Clear
                      </button>
                    )}
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-bg-main/30 p-3 max-h-[30vh] overflow-y-auto custom-scrollbar">
                    <div className="grid grid-cols-6 sm:grid-cols-8 gap-2">
                        {THEMED_EMOJIS.map((em, idx) => (
                            <button
                              key={idx}
                              type="button"
                              onClick={() => setNewHabit({ ...newHabit, emoji: em === newHabit.emoji ? "" : em })}
                              className={`w-full aspect-square rounded-xl flex items-center justify-center text-base transition-all hover:scale-110 active:scale-95 ${newHabit.emoji === em ? "bg-accent/20 border-2 border-accent/60 scale-110 shadow-sm" : "hover:bg-white/5 border-2 border-transparent"}`}
                              title={em}
                            >
                              <span style={{filter: "grayscale(1) saturate(0) brightness(1.2)", fontSize: "1.05rem"}}>{em}</span>
                            </button>
                        ))}
                    </div>
                  </div>
                  
                  <div className="flex justify-between mt-8 pt-4">
                    <button onClick={() => setAddHabitStep(3)} className="px-5 py-3 rounded-xl border border-border-color text-xs font-bold uppercase tracking-widest text-text-secondary hover:text-text-primary active:scale-95 transition-all">Back</button>
                    <button
                        onClick={() => {
                          if (!newHabit.name.trim()) return;
                          setHabits([...habits, {
                            id: Date.now().toString(),
                            name: newHabit.name,
                            type: newHabit.type,
                            mode: newHabit.mode || "quick",
                            unit: newHabit.mode === "count" ? newHabit.unit || "" : newHabit.mode === "timer" ? "sec" : "",
                            emoji: newHabit.emoji || "",
                            totalLogs: 0,
                            logs: [],
                          }]);
                          setNewHabit({ name: "", type: "Good", mode: "quick", unit: "", emoji: "" });
                          trackEvent("habit_created", { type: newHabit.type, mode: newHabit.mode });
                          setShowAddModal(false);
                        }}
                        className="px-6 py-3 bg-accent text-bg-main rounded-xl border border-transparent text-xs font-bold uppercase tracking-widest hover:scale-[1.03] active:scale-[0.97] transition-all shadow-lg shadow-accent/20"
                    >
                        Create
                    </button>
                  </div>
                </div>
              )}

            </div>
          </div>
        </div>
      )}

      {featureLockOpen && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center z-[110] p-4"
          onClick={(e) =>
            e.target === e.currentTarget && setFeatureLockOpen(false)
          }
        >
          <div className="glass-card modal-enter w-full max-w-md p-8 rounded-[2rem] border-white/10 relative overflow-hidden">
            <div className="absolute -top-24 -right-24 w-40 h-40 bg-accent/10 rounded-full blur-[80px] pointer-events-none" />
            <div className="flex justify-between items-center mb-6 relative z-10">
              <div>
                <h3 className="text-lg font-bold tracking-tight text-text-primary">
                  Unlock full console
                </h3>
                <p className="text-[10px] text-text-secondary uppercase tracking-[0.25em] mt-1 font-mono">
                  Sign in for free to unlock this feature.
                </p>
              </div>
              <button
                onClick={() => setFeatureLockOpen(false)}
                className="w-8 h-8 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-text-secondary hover:text-text-primary hover:border-text-secondary transition-all"
              >
                <Icon name="x" size={14} />
              </button>
            </div>
            <p className="text-xs text-text-secondary mb-6">
              Create one local habit without an account. To add more streams,
              enable notifications, analytics, and external sync, sign in and
              we&apos;ll keep everything synced across devices.
            </p>
            <div className="flex flex-col sm:flex-row gap-3">
              <button
                onClick={() => {
                  setFeatureLockOpen(false);
                  window.location.href = "/login";
                }}
                className="flex-1 py-3 rounded-xl bg-accent text-bg-main text-[11px] font-black uppercase tracking-[0.3em]"
              >
                Sign in for free
              </button>
              <button
                onClick={() => setFeatureLockOpen(false)}
                className="flex-1 py-3 rounded-xl border border-border-color text-[11px] font-black uppercase tracking-[0.3em] text-text-secondary hover:text-text-primary hover:bg-bg-main"
              >
                Not now
              </button>
            </div>
          </div>
        </div>
      )}
      {confirmAction?.type === "ban_notice" && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-2xl flex items-center justify-center z-[200] p-4 text-center">
            <div className="glass-card w-full max-w-sm p-8 rounded-[3rem] border-white/10 relative overflow-hidden shadow-2xl">
                <div className={`absolute -top-24 -right-24 w-48 h-48 ${confirmAction.banned ? 'bg-danger/20' : 'bg-success/20'} rounded-full blur-[80px]`} />
                <div className={`w-24 h-24 mx-auto rounded-[2rem] ${confirmAction.banned ? 'bg-danger/10 text-danger' : 'bg-success/10 text-success'} flex items-center justify-center mb-8 border border-white/5`}>
                    <Icon name={confirmAction.banned ? "shield-alert" : "shield-check"} size={48} />
                </div>
                <h3 className="text-2xl font-bold tracking-tight text-text-primary mb-3">
                    {confirmAction.banned ? "Account Suspended" : "Access Restored"}
                </h3>
                <p className="text-sm text-text-secondary mb-10 leading-relaxed px-2">
                    {confirmAction.banned 
                        ? (confirmAction.reason || "Your account is temporarily banned due to violation of system protocols.") 
                        : "Your access has been restored. You can now continue using all features of the website."}
                </p>
                <div className="flex flex-col gap-3">
                    {confirmAction.banned ? (
                        <button
                            onClick={() => {
                                authContext.logout();
                                setConfirmAction(null);
                            }}
                            className="w-full py-4 rounded-2xl bg-white/5 text-text-secondary text-xs font-black uppercase tracking-[0.2em] transition-all hover:bg-white/10"
                        >
                            Leave
                        </button>
                    ) : (
                        <button
                            onClick={() => setConfirmAction(null)}
                            className="w-full py-4 rounded-2xl bg-accent text-bg-main text-xs font-black uppercase tracking-[0.2em] transition-all hover:scale-[1.02] active:scale-[0.98]"
                        >
                            Continue to App
                        </button>
                    )}
                </div>
            </div>
        </div>
      )}

      <AdminMessageModal 
        message={activeSystemMsg} 
        onClose={() => setActiveSystemMsg(null)} 
      />
    </>
  );
}

function App() {
  return (
    <AuthProvider>
      <ThemeProvider>
        <AppContent />
      </ThemeProvider>
    </AuthProvider>
  );
}

function AdminMessageModal({ message, onClose }) {
  const { user } = useAuth();
  const [reply, setReply] = useState("");
  const [isReplying, setIsReplying] = useState(false);
  const [isSending, setIsSending] = useState(false);

  const handleSendReply = async () => {
    if (!reply.trim()) return;
    setIsSending(true);
    try {
      await addDoc(collection(db, "inquiries"), {
        uid: user.uid,
        email: user.email,
        displayName: user.displayName || "User",
        type: "Message Reply",
        message: `RE: Admin Message\n\nOriginal: ${message}\n\nReply: ${reply}`,
        createdAt: new Date().toISOString(),
        status: "open"
      });
      setIsReplying(false);
      setReply("");
      onClose();
    } catch (e) {
      console.error(e);
    } finally {
      setIsSending(false);
    }
  };

  if (!message) return null;

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-xl flex items-center justify-center z-[200] p-4 text-center">
      <div className="glass-card w-full max-w-sm p-8 rounded-[3rem] border-white/10 relative overflow-hidden shadow-2xl">
        <div className="absolute -top-24 -right-24 w-48 h-48 bg-accent/20 rounded-full blur-[80px]" />
        
        <div className="w-16 h-16 mx-auto rounded-2xl bg-accent/10 text-accent flex items-center justify-center mb-6 border border-white/5">
          <Icon name="mail" size={32} />
        </div>

        <h3 className="text-xl font-bold tracking-tight text-text-primary mb-2">
          Admin sent you a message
        </h3>
        
        <div className="bg-white/5 border border-white/10 rounded-2xl p-5 mb-6 text-left relative group">
          <p className="text-sm text-text-secondary leading-relaxed whitespace-pre-wrap">
            {message}
          </p>
        </div>

        {isReplying ? (
          <div className="mb-6 animate-in slide-in-from-top-2">
            <textarea
              value={reply}
              onChange={(e) => setReply(e.target.value)}
              placeholder="Type your reply here..."
              className="w-full h-32 bg-bg-main border border-border-color rounded-2xl p-4 text-sm text-text-primary outline-none focus:border-accent transition-all resize-none mb-3"
              disabled={isSending}
            />
            <div className="flex gap-3">
              <Button 
                onClick={() => setIsReplying(false)} 
                variant="outline" 
                className="flex-1 rounded-xl py-3"
                disabled={isSending}
              >
                Cancel
              </Button>
              <Button 
                onClick={handleSendReply} 
                variant="primary" 
                className="flex-1 rounded-xl py-3 whitespace-nowrap"
                disabled={isSending || !reply.trim()}
              >
                {isSending ? "Sending..." : "Send"}
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex gap-3">
            <button
               onClick={() => setIsReplying(true)}
               className="flex-1 py-4 rounded-2xl bg-white/5 text-text-secondary text-[10px] font-black uppercase tracking-[0.2em] transition-all hover:bg-white/10 border border-white/10"
            >
              Reply
            </button>
            <button
              onClick={onClose}
              className="flex-1 py-4 rounded-2xl bg-accent text-bg-main text-[10px] font-black uppercase tracking-[0.2em] transition-all hover:scale-[1.02] active:scale-[0.98] shadow-lg shadow-accent/20"
            >
              Ok
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;

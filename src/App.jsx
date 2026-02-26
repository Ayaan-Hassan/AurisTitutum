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
import { ThemeProvider } from "./components/ThemeProvider";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import { useHabitNotifications } from "./hooks/useHabitNotifications";
import { useReminderNotifications } from "./hooks/useReminderNotifications";
import ToastContainer from "./components/Toast";

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

export const Preloader = memo(({ isLoading }) => {
  const [shouldRender, setShouldRender] = useState(true);

  useEffect(() => {
    if (!isLoading) {
      const timer = setTimeout(() => setShouldRender(false), 1000);
      return () => clearTimeout(timer);
    }
  }, [isLoading]);

  if (!shouldRender) return null;

  return (
    <div className={`preloader-container ${!isLoading ? "loaded" : ""}`}>
      <div className="logo-box">
        <div className="logo-inner"></div>
      </div>
      <p className="preloader-title">
        AurisTitutum <span>| PRO</span>
      </p>
    </div>
  );
});

function AppContent() {
  const [showPreloader, setShowPreloader] = useState(true);
  const [habits, setHabits] = useState(() => {
    const saved = localStorage.getItem("habitflow_pro_data");
    return saved ? JSON.parse(saved) : [];
  });

  const [userConfig, setUserConfig] = useState(() => {
    const saved = localStorage.getItem("habitflow_pro_user");
    const defaultUser = {
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
    const merged = saved
      ? { ...defaultUser, ...JSON.parse(saved) }
      : defaultUser;
    if (
      merged.name === "Ayaan Hassan" &&
      merged.email === "ayaan.h@habitflow.io"
    ) {
      return { ...merged, name: "", email: "" };
    }
    return merged;
  });

  const [showAddModal, setShowAddModal] = useState(false);
  const [newHabit, setNewHabit] = useState({
    name: "",
    type: "Good",
    mode: "quick",
    unit: "",
    emoji: "",
  });
  const [selectedHabitId, setSelectedHabitId] = useState(null);
  const [notes, setNotes] = useState(() => {
    const saved = localStorage.getItem("habitflow_pro_notes");
    return saved ? JSON.parse(saved) : [];
  });
  const [reminders, setReminders] = useState(() => {
    const saved = localStorage.getItem("habitflow_pro_reminders");
    return saved ? JSON.parse(saved) : [];
  });
  const fileInputRef = useRef(null);

  const { user } = useAuth();

  // Global preloader — runs once on app load
  useEffect(() => {
    const timer = setTimeout(() => {
      setShowPreloader(false);
    }, 2000);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (user?.email)
      setUserConfig((prev) => ({
        ...prev,
        email: user.email,
        name: user.name || prev.name,
      }));
  }, [user?.email, user?.name]);

  const { toasts, removeToast, notifications, markAllRead, addToast } =
    useHabitNotifications(habits, {
      ...userConfig.settings,
      notificationsEnabled:
        !!user && userConfig.settings.notificationsEnabled !== false,
    });

  // Fire scheduled reminder notifications
  useReminderNotifications(reminders);

  const [featureLockOpen, setFeatureLockOpen] = useState(false);

  const handleAddHabitRequest = useCallback(() => {
    if (!user && habits.length >= 1) {
      setFeatureLockOpen(true);
      return;
    }
    setShowAddModal(true);
  }, [user, habits.length]);

  // Listen for toast events from components
  useEffect(() => {
    const handleToast = (e) => {
      addToast(e.detail.message, e.detail.type);
    };
    document.addEventListener("showToast", handleToast);
    return () => document.removeEventListener("showToast", handleToast);
  }, [addToast]);

  useEffect(() => {
    const showModalListener = () => handleAddHabitRequest();
    document.addEventListener("showModal", showModalListener);
    return () => {
      document.removeEventListener("showModal", showModalListener);
    };
  }, [handleAddHabitRequest]);

  useEffect(() => {
    localStorage.setItem("habitflow_pro_data", JSON.stringify(habits));
  }, [habits]);
  useEffect(() => {
    localStorage.setItem("habitflow_pro_user", JSON.stringify(userConfig));
  }, [userConfig]);
  useEffect(() => {
    localStorage.setItem("habitflow_pro_notes", JSON.stringify(notes));
  }, [notes]);
  useEffect(() => {
    localStorage.setItem("habitflow_pro_reminders", JSON.stringify(reminders));
  }, [reminders]);

  const logActivity = (id, increment = true, amount = 1, unit = "") => {
    const amt = Math.max(1, Math.floor(Number(amount) || 1));
    const now = new Date();
    const todayKey = now.toISOString().split("T")[0];
    const timestamp = now.toLocaleTimeString([], { hour12: false });

    setHabits((prev) =>
      prev.map((h) => {
        if (h.id !== id) return h;

        const isCountMode = h.mode === "count";
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
          } else if (isCountMode) {
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
            isCountMode &&
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
  };

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

  // Block rendering until preloader finishes
  if (showPreloader) {
    return <Preloader isLoading={showPreloader} />;
  }

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

  // Keep isUnicodeSymbol for rendering existing habits that may have stored Unicode symbols
  const isUnicodeSymbol = (ch) =>
    /^[\u25A0-\u27FF\u2190-\u21FF\u221E\u2295\u2297\u25D0\u25D1⟳◆▲▼●◯□△★✦◈⬡∞✕✓⊕⊗◐◑◇]/.test(
      ch,
    );

  return (
    <>
      <Routes>
        {/* Public Landing */}
        <Route path="/" element={<Landing habits={habits} user={user} />} />

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
              habits={habits}
              notifications={notifications}
              onNotificationsRead={markAllRead}
            >
              <ToastContainer toasts={toasts} onClose={removeToast} />
              <Routes>
                <Route
                  path=""
                  element={
                    <Dashboard
                      habits={habits}
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
                      habits={habits}
                      selectedHabitId={selectedHabitId}
                      setSelectedHabitId={setSelectedHabitId}
                    />
                  }
                />
                <Route
                  path="habits"
                  element={
                    <Habits
                      habits={habits}
                      setHabits={setHabits}
                      logActivity={logActivity}
                    />
                  }
                />
                <Route
                  path="logs"
                  element={<Logs habits={habits} setHabits={setHabits} />}
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
          <div className="glass-card modal-enter w-full max-w-md rounded-[2rem] shadow-[0_32px_64px_-16px_rgba(0,0,0,0.5)] border-white/10 relative overflow-hidden max-h-[92vh] flex flex-col">
            {/* Background Glow */}
            <div className="absolute -top-24 -right-24 w-48 h-48 bg-accent/10 rounded-full blur-[80px] pointer-events-none z-0" />

            {/* Scrollable inner content */}
            <div className="overflow-y-auto custom-scrollbar p-10 flex-1 relative z-10">
              <div className="flex justify-between items-center mb-10">
                <div>
                  <h3 className="text-2xl font-bold tracking-tighter text-text-primary uppercase">
                    Add Habit
                  </h3>
                  <p className="text-[10px] text-text-secondary uppercase tracking-[0.2em] mt-1 font-mono">
                    Initialize behavioral protocol
                  </p>
                </div>
                <button
                  onClick={() => setShowAddModal(false)}
                  className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-text-secondary hover:text-text-primary hover:border-text-secondary transition-all"
                >
                  <Icon name="x" size={18} />
                </button>
              </div>

              <div className="space-y-10 relative z-10">
                <div className="space-y-3">
                  <label className="text-[10px] font-black text-text-secondary uppercase tracking-[0.3em] ml-1">
                    Habit Identifier
                  </label>
                  <input
                    className="w-full bg-bg-main/50 border border-white/10 p-5 rounded-2xl outline-none focus:border-accent text-sm text-text-primary transition-all placeholder:text-text-secondary/30 focus:bg-bg-main"
                    placeholder="Ex: Morning Meditation"
                    value={newHabit.name}
                    onChange={(e) =>
                      setNewHabit({ ...newHabit, name: e.target.value })
                    }
                    autoFocus
                  />
                </div>

                {/* Emoji Picker — only themed emoji, no Unicode symbols */}
                <div className="space-y-3">
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
                  <div className="rounded-2xl border border-white/10 bg-bg-main/30 p-3 max-h-40 overflow-y-auto custom-scrollbar">
                    <div className="grid grid-cols-8 gap-2">
                      {THEMED_EMOJIS.map((em, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() =>
                            setNewHabit({
                              ...newHabit,
                              emoji: em === newHabit.emoji ? "" : em,
                            })
                          }
                          className={`w-full aspect-square rounded-lg flex items-center justify-center text-base transition-all hover:scale-110 active:scale-95 ${
                            newHabit.emoji === em
                              ? "bg-accent/20 border-2 border-accent/60 scale-105"
                              : "hover:bg-white/10 border-2 border-transparent"
                          }`}
                          title={em}
                        >
                          <span
                            style={{
                              filter:
                                "grayscale(1) saturate(0) brightness(1.15)",
                              fontSize: "1rem",
                            }}
                          >
                            {em}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                  {newHabit.emoji && (
                    <p className="text-[10px] text-text-secondary ml-1">
                      Selected:{" "}
                      <span
                        style={
                          isUnicodeSymbol(newHabit.emoji)
                            ? { color: "var(--text-secondary)" }
                            : {
                                filter: "grayscale(1) saturate(0)",
                              }
                        }
                      >
                        {newHabit.emoji}
                      </span>{" "}
                      — will appear on your habit card.
                    </p>
                  )}
                </div>

                <div className="space-y-3">
                  <label className="text-[10px] font-black text-text-secondary uppercase tracking-[0.3em] ml-1">
                    Behavioral Logic
                  </label>
                  <div className="grid grid-cols-2 gap-4">
                    <button
                      onClick={() => setNewHabit({ ...newHabit, type: "Good" })}
                      className={`group py-5 rounded-2xl text-[10px] font-bold uppercase tracking-[0.2em] border transition-all flex flex-col items-center gap-2 ${
                        newHabit.type === "Good"
                          ? "bg-accent text-bg-main border-accent shadow-[0_0_20px_rgba(228,228,231,0.2)]"
                          : "bg-white/5 border-white/10 text-text-secondary hover:border-white/20 hover:bg-white/10"
                      }`}
                    >
                      <Icon
                        name="check-circle"
                        size={16}
                        className={
                          newHabit.type === "Good"
                            ? "text-bg-main"
                            : "text-text-secondary group-hover:text-text-primary"
                        }
                      />
                      Constructive
                    </button>
                    <button
                      onClick={() => setNewHabit({ ...newHabit, type: "Bad" })}
                      className={`group py-5 rounded-2xl text-[10px] font-bold uppercase tracking-[0.2em] border transition-all flex flex-col items-center gap-2 ${
                        newHabit.type === "Bad"
                          ? "bg-accent text-bg-main border-accent shadow-[0_0_20px_rgba(228,228,231,0.2)]"
                          : "bg-white/5 border-white/10 text-text-secondary hover:border-white/20 hover:bg-white/10"
                      }`}
                    >
                      <Icon
                        name="alert-circle"
                        size={16}
                        className={
                          newHabit.type === "Bad"
                            ? "text-bg-main"
                            : "text-text-secondary group-hover:text-text-primary"
                        }
                      />
                      Destructive
                    </button>
                  </div>
                </div>

                <div className="space-y-3">
                  <label className="text-[10px] font-black text-text-secondary uppercase tracking-[0.3em] ml-1">
                    Mode
                  </label>
                  <div className="grid grid-cols-3 gap-3">
                    <button
                      onClick={() =>
                        setNewHabit({ ...newHabit, mode: "quick" })
                      }
                      className={`py-4 rounded-2xl text-[10px] font-bold uppercase tracking-[0.2em] border transition-all ${newHabit.mode === "quick" ? "bg-accent text-bg-main border-accent" : "bg-white/5 border-white/10 text-text-secondary hover:border-white/20"}`}
                    >
                      Tap
                    </button>
                    <button
                      onClick={() =>
                        setNewHabit({ ...newHabit, mode: "count" })
                      }
                      className={`py-4 rounded-2xl text-[10px] font-bold uppercase tracking-[0.2em] border transition-all ${newHabit.mode === "count" ? "bg-accent text-bg-main border-accent" : "bg-white/5 border-white/10 text-text-secondary hover:border-white/20"}`}
                    >
                      Count
                    </button>
                    <button
                      onClick={() =>
                        setNewHabit({ ...newHabit, mode: "check" })
                      }
                      className={`py-4 rounded-2xl text-[10px] font-bold uppercase tracking-[0.2em] border transition-all ${newHabit.mode === "check" ? "bg-accent text-bg-main border-accent" : "bg-white/5 border-white/10 text-text-secondary hover:border-white/20"}`}
                    >
                      Check
                    </button>
                  </div>
                  {newHabit.mode === "count" && (
                    <input
                      type="text"
                      placeholder="Unit (e.g. reps, min)"
                      className="w-full bg-bg-main/50 border border-white/10 p-3 rounded-xl text-sm text-text-primary placeholder:text-text-secondary/50 outline-none focus:border-accent"
                      value={newHabit.unit}
                      onChange={(e) =>
                        setNewHabit({ ...newHabit, unit: e.target.value })
                      }
                    />
                  )}
                </div>

                <button
                  onClick={() => {
                    if (!newHabit.name.trim()) return;
                    setHabits([
                      ...habits,
                      {
                        id: Date.now().toString(),
                        name: newHabit.name,
                        type: newHabit.type,
                        mode: newHabit.mode || "quick",
                        unit:
                          newHabit.mode === "count" ? newHabit.unit || "" : "",
                        emoji: newHabit.emoji || "",
                        totalLogs: 0,
                        logs: [],
                      },
                    ]);
                    setNewHabit({
                      name: "",
                      type: "Good",
                      mode: "quick",
                      unit: "",
                      emoji: "",
                    });
                    setShowAddModal(false);
                  }}
                  disabled={!newHabit.name.trim()}
                  className="w-full py-5 bg-accent text-bg-main text-[11px] font-black uppercase tracking-[0.3em] rounded-2xl hover:scale-[1.02] active:scale-[0.98] transition-all shadow-lg disabled:opacity-30 disabled:hover:scale-100"
                >
                  Create Habit Node
                </button>
              </div>
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
                  window.location.href = '/login';
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

export default App;

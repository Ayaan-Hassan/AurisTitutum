import { useState, useEffect, useRef, memo, useCallback } from "react";
import { Routes, Route, useNavigate, Navigate } from "react-router-dom";
import Layout from "./components/Layout";
import Icon from "./components/Icon";
import Dashboard from "./pages/Dashboard";
import Analytics from "./pages/Analytics";
import Timetable from "./pages/Timetable";
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
import Onboarding from "./components/Onboarding";
import ProtectedRoute from "./components/ProtectedRoute";

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
  const { user, authLoading, updateUserConfig } = authContext;

  // ── All state is sourced from AuthContext (Firestore-backed) ──
  // No local guest state. Authentication is required before this component renders
  // (ProtectedRoute gates the /app/* tree). Landing/Login/Signup are public.
  const habits = authContext.habits;
  const notes = authContext.notes;
  const reminders = authContext.reminders;
  const userConfig = authContext.userConfig;
  const dataLoading = authContext.dataLoading;

  const [showAddModal, setShowAddModal] = useState(false);
  const [addHabitStep, setAddHabitStep] = useState(1);
  const [newHabit, setNewHabit] = useState({
    name: "",
    description: "",
    color: "indigo",
    category: "General",
    type: "Good",
    mode: "quick",
    unit: "",
    emoji: "",
  });
  const [selectedHabitId, setSelectedHabitId] = useState(null);
  const fileInputRef = useRef(null);
  const [activeUndo, setActiveUndo] = useState(null);
  const undoTimerRef = useRef(null);
  const undoVisibilityTimerRef = useRef(null);
  const [activeModeInfo, setActiveModeInfo] = useState(null);

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
      notificationsEnabled: !!user && userConfig.settings.notificationsEnabled !== false,
    });

  // Fire scheduled reminder notifications
  useReminderNotifications(reminders);

  const [featureLockConfig, setFeatureLockConfig] = useState(null);
  const [confirmAction, setConfirmAction] = useState(null);
  const [activeSystemMsg, setActiveSystemMsg] = useState(null);

  const handleAddHabitRequest = useCallback(() => {
    // All users are authenticated here (ProtectedRoute guards /app/*)
    setAddHabitStep(1);
    setShowAddModal(true);
    setActiveModeInfo(null);
  }, []);

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



  // Synchronize local state with localStorage — removed (auth-first; Firestore is source of truth)

  // Unified update function — always goes through AuthContext since user is always authenticated
  const unifiedUpdateUserConfig = useCallback(async (updater) => {
    return authContext.updateUserConfig(updater);
  }, [authContext.updateUserConfig]);

  const logActivity = useCallback(async (id, increment = true, amount = 1, unit = "", photoData = null, customDate = null, customTime = null) => {
    if (id === "example-habit") {
        const toastEvent = new CustomEvent("showToast", {
            detail: { message: "Create your own habit to start tracking!", type: "info", id: Date.now() },
        });
        document.dispatchEvent(toastEvent);
        return;
    }
    // Guard against double-taps / concurrency
    if (!user) return; // Auth required

    const amt = Math.max(1, Math.floor(Number(amount) || 1));
    const now = new Date();
    const todayKey = customDate || getLocalDateKey(now);
    const timestamp = customTime || now.toLocaleTimeString([], { hour12: false });

    // Detailed Temporal Metadata for Phase 1 Behavioral Upgrade
    const exactTimestamp = now.toISOString();
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const timezoneOffset = now.getTimezoneOffset();
    const localTimestamp = now.toString();
    const isOverride = !!(customDate || customTime);

    // --- Undo Pop-up Logic ---
    if (increment) {
        if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
        if (undoVisibilityTimerRef.current) clearTimeout(undoVisibilityTimerRef.current);
        
        undoTimerRef.current = setTimeout(() => {
            setActiveUndo({ id, amount: amt, unit: unit || "", photoData, todayKey, timestamp });
            
            undoVisibilityTimerRef.current = setTimeout(() => {
                setActiveUndo(null);
            }, 5000); 
        }, 500);
    } else {
        setActiveUndo(null);
    }

    const habitObj = authContext.habits.find(h => h.id === id);
    if (!habitObj) return;

    if (increment) {
      await authContext.addLog({
        habitId: id,
        date: todayKey,
        time: timestamp,
        amount: amt,
        unit: unit || habitObj.unit || "",
        mode: habitObj.mode,
        type: habitObj.type,
        photoData: photoData,
        exactTimestamp,
        timezone,
        timezoneOffset,
        localTimestamp,
        createdAt: exactTimestamp,
        updatedAt: exactTimestamp,
        isOverride,
        completionDelayMs: 0,
      });
    } else {
      const relevantLogs = (authContext.logDocs || [])
        .filter(l => l.habitId === id && l.date === todayKey)
        .sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));
      
      if (relevantLogs.length > 0) {
        await authContext.deleteLog(relevantLogs[0].id);
      }
    }
  }, [user, authContext]);

  const handleAvatarUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (event) => {
      const compressed = await compressImage(event.target.result);
      await authContext.updateUserConfig({ avatar: compressed });
    };
    reader.readAsDataURL(file);
    e.target.value = null;
  };

  const [dailyInsight] = useState(() => getDailyInsight());




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

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-bg-main">
        <div className="flex flex-col items-center gap-6">
          <div className="relative">
            <div className="w-14 h-14 bg-accent rounded-2xl flex items-center justify-center shadow-[0_0_40px_rgba(99,102,241,0.3)]">
              <div className="w-5 h-5 bg-bg-main rotate-45" />
            </div>
            <div className="absolute inset-0 rounded-2xl border-2 border-accent/30 animate-ping" style={{ animationDuration: '1.8s' }} />
          </div>
          <div className="flex flex-col items-center gap-2">
            <p className="text-text-primary text-sm font-bold tracking-tight">AurisTitutum <span className="text-text-secondary">PRO</span></p>
            <div className="text-text-secondary text-[10px] font-black uppercase tracking-[0.4em] animate-pulse">
              Initializing Console...
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <TourGuide 
        habits={habits}
        userConfig={userConfig}
        updateUserConfig={unifiedUpdateUserConfig}
        dataLoading={dataLoading}
      />
      <Onboarding 
        onAddHabit={handleAddHabitRequest} 
        habits={habits} 
        userConfig={userConfig}
        updateUserConfig={unifiedUpdateUserConfig}
        dataLoading={dataLoading}
      />
      <Routes>
        {/* Public Landing — redirects to /app if already authenticated */}
        <Route 
          path="/" 
          element={
            user
              ? <Navigate to="/app" replace />
              : <Landing user={user} />
          } 
        />

        {/* Auth Pages */}
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />

        {/* Protected App Shell — requires authentication */}
        <Route
          path="/app/*"
          element={
            <ProtectedRoute>
              <Layout
                userConfig={userConfig}
                onAddHabit={handleAddHabitRequest}
                habits={habits}
                notifications={notifications}
                onNotificationsRead={markAllRead}
                notes={notes}
                reminders={reminders}
              >
                <ToastContainer toasts={toasts} onClose={removeToast} />
                <Routes>
                  <Route
                    path=""
                    element={
                      <Dashboard
                        habits={habits}
                        notes={notes}
                        setHabits={authContext.replaceHabitsState}
                        logActivity={logActivity}
                        insights={dailyInsight}
                        dataLoading={dataLoading}
                        setFeatureLockConfig={setFeatureLockConfig}
                      />
                    }
                  />
                  <Route
                    path="dashboard"
                    element={
                      <Dashboard
                        habits={habits}
                        notes={notes}
                        setHabits={authContext.replaceHabitsState}
                        logActivity={logActivity}
                        insights={dailyInsight}
                        dataLoading={dataLoading}
                        setFeatureLockConfig={setFeatureLockConfig}
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
                    path="timetable"
                    element={<Timetable logActivity={logActivity} />}
                  />
                  <Route
                    path="habits"
                    element={
                      <Habits
                        habits={habits}
                        setHabits={authContext.replaceHabitsState}
                        logActivity={logActivity}
                        setFeatureLockConfig={setFeatureLockConfig}
                      />
                    }
                  />
                  <Route
                    path="logs"
                    element={<Logs habits={habits} setHabits={authContext.replaceHabitsState} setFeatureLockConfig={setFeatureLockConfig} />}
                  />
                  <Route
                    path="notes"
                    element={<Notes notes={notes} setNotes={authContext.replaceNotesState} setFeatureLockConfig={setFeatureLockConfig} />}
                  />
                  <Route
                    path="reminders"
                    element={
                      <Reminders
                        reminders={reminders}
                        setReminders={authContext.replaceRemindersState}
                        setFeatureLockConfig={setFeatureLockConfig}
                      />
                    }
                  />
                  <Route
                    path="settings"
                    element={
                      <Settings
                        userConfig={userConfig}
                        setUserConfig={authContext.updateUserConfig}
                        handleAvatarUpload={handleAvatarUpload}
                        fileInputRef={fileInputRef}
                        habits={habits}
                      />
                    }
                  />
                <Route path="contact" element={<Contact />} />
                <Route path="admin" element={<AdminDashboard />} />
                <Route path="*" element={<Navigate to="" replace />} />
              </Routes>
            </Layout>
            </ProtectedRoute>
          }
        />
      </Routes>

      {showAddModal && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center z-[100] p-4 animate-in fade-in duration-300"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowAddModal(false);
              setActiveModeInfo(null);
            }
          }}
        >
          <div className="glass-card modal-enter w-full max-w-md rounded-[2rem] shadow-[0_32px_64px_-16px_rgba(0,0,0,0.5)] border-white/10 relative overflow-hidden flex flex-col transition-all duration-300">
            {/* Background Glow */}
            <div className="absolute -top-24 -right-24 w-48 h-48 bg-accent/5 rounded-full blur-[80px] pointer-events-none z-0" />

            {/* Scrollable inner content */}
            <div className="p-8 sm:p-10 relative z-10 w-full bg-gradient-to-br from-white/[0.03] to-transparent">
              <div className="flex justify-between items-center mb-10">
                <div>
                  <h3 className="text-xl font-black tracking-widest text-text-primary uppercase flex items-center gap-2">
                    <div className="w-1.5 h-6 bg-accent rounded-full" />
                    Add Habit
                  </h3>
                  <div className="flex gap-2 mt-4">
                    {[1, 2, 3, 4].map(s => (
                      <div key={s} className={`h-1 rounded-full transition-all duration-500 ${addHabitStep === s ? "w-8 bg-accent" : addHabitStep > s ? "w-2 bg-accent/30" : "w-2 bg-white/5"}`} />
                    ))}
                  </div>
                </div>
                {(
                  <button
                    onClick={() => {
                      setShowAddModal(false);
                      setActiveModeInfo(null);
                    }}
                    className="w-10 h-10 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-text-secondary hover:text-text-primary hover:bg-white/10 transition-all group"
                  >
                    <Icon name="x" size={18} className="group-hover:rotate-90 transition-transform duration-300" />
                  </button>
                )}
              </div>

              {addHabitStep === 1 && (
                <div className="animate-in slide-in-from-right fade-in duration-300 space-y-6">
                  <p className="text-center text-[10px] font-black uppercase tracking-[0.3em] text-text-secondary mb-8">What kind of habit?</p>
                  <div className="grid grid-cols-2 gap-4">
                    <button
                      onClick={() => { setNewHabit({ ...newHabit, type: "Good" }); setAddHabitStep(2); }}
                      className="group p-8 rounded-[2.5rem] border transition-all flex flex-col items-center gap-5 bg-white/[0.02] border-white/5 text-white hover:border-[#4ade80]/40 hover:bg-[#4ade80]/5 shadow-sm relative overflow-hidden"
                    >
                      <div className="absolute inset-0 bg-gradient-to-br from-[#4ade80]/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                      <div className="w-16 h-16 rounded-[2rem] border border-white/10 flex items-center justify-center group-hover:bg-[#4ade80]/20 group-hover:border-[#4ade80]/30 transition-all relative z-10">
                        <Icon name="check" size={28} className="text-white/60 group-hover:text-[#4ade80] transition-colors" />
                      </div>
                      <span className="text-[10px] font-black uppercase tracking-[0.2em] relative z-10 opacity-60 group-hover:opacity-100 transition-opacity">Constructive</span>
                    </button>
                    <button
                      onClick={() => { setNewHabit({ ...newHabit, type: "Bad" }); setAddHabitStep(2); }}
                      className="group p-8 rounded-[2.5rem] border transition-all flex flex-col items-center gap-5 bg-white/[0.02] border-white/5 text-white hover:border-[#ef4444]/40 hover:bg-[#ef4444]/5 shadow-sm relative overflow-hidden"
                    >
                      <div className="absolute inset-0 bg-gradient-to-br from-[#ef4444]/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                      <div className="w-16 h-16 rounded-[2rem] border border-white/10 flex items-center justify-center group-hover:bg-[#ef4444]/20 group-hover:border-[#ef4444]/30 transition-all relative z-10">
                        <Icon name="x" size={28} className="text-white/60 group-hover:text-[#ef4444] transition-colors" />
                      </div>
                      <span className="text-[10px] font-black uppercase tracking-[0.2em] relative z-10 opacity-60 group-hover:opacity-100 transition-opacity">Destructive</span>
                    </button>
                  </div>
                </div>
              )}

              {addHabitStep === 2 && (
                <div className="animate-in slide-in-from-right fade-in duration-300 space-y-6">
                  <div className="flex items-center ml-1">
                    <label className="text-[10px] font-black text-text-secondary uppercase tracking-[0.3em]">
                        Habit Name
                    </label>
                  </div>
                  <input
                    className="w-full bg-white/[0.03] border border-white/10 p-5 rounded-3xl outline-none focus:border-accent/40 text-base text-text-primary transition-all placeholder:text-text-secondary/20 focus:bg-white/[0.05] shadow-inner"
                    placeholder={newHabit.type === "Good" ? "e.g. Read 20 pages" : "e.g. Smoking"}
                    value={newHabit.name}
                    onChange={(e) => setNewHabit({ ...newHabit, name: e.target.value })}
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && newHabit.name.trim()) setAddHabitStep(3);
                    }}
                  />

                  <div>
                    <label className="text-[10px] font-black text-text-secondary uppercase tracking-[0.3em] ml-1 mb-1 block">
                      Description <span className="font-normal normal-case opacity-60">(Optional)</span>
                    </label>
                    <input
                      className="w-full bg-white/[0.03] border border-white/10 p-4 rounded-2xl outline-none focus:border-accent/40 text-sm text-text-primary transition-all placeholder:text-text-secondary/30"
                      placeholder="e.g. Read 20 pages before bed every night"
                      value={newHabit.description}
                      onChange={(e) => setNewHabit({ ...newHabit, description: e.target.value })}
                    />
                  </div>

                  <div className="flex justify-between items-center mt-6">
                    <button onClick={() => setAddHabitStep(1)} className="px-6 py-3.5 rounded-2xl border border-white/5 bg-white/5 text-[10px] font-black uppercase tracking-[0.2em] text-text-secondary hover:text-text-primary hover:bg-white/10 active:scale-95 transition-all">Back</button>
                    <button onClick={() => setAddHabitStep(3)} disabled={!newHabit.name.trim()} className="px-8 py-3.5 bg-accent text-bg-main rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] disabled:opacity-20 active:scale-95 transition-all shadow-lg shadow-accent/20">Continue</button>
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
                      { id: "timer", label: "Timer", info: "Integrated stopwatch to track duration." },
                      { id: "rating", label: "Rating", info: "Evaluate performance on a 1-5 star scale." },
                      { id: "upload", label: "Upload", info: "Keep a visual progress log with photos." }
                    ].map((m) => (
                      <div key={m.id} className="relative group/mode">
                        <button
                          onClick={() => {
                            setNewHabit({ 
                              ...newHabit, 
                              mode: m.id, 
                              unit: m.id === "count" ? newHabit.unit : m.id === "timer" ? "min" : m.id === "upload" ? "IMG" : "" 
                            });
                            setActiveModeInfo(null);
                          }}
                          className={`w-full py-5 rounded-[1.5rem] text-[10px] font-black uppercase tracking-[0.2em] border transition-all ${newHabit.mode === m.id ? "bg-accent text-bg-main border-accent shadow-lg shadow-accent/10" : "bg-white/[0.02] border-white/5 text-text-secondary/60 hover:border-white/10 hover:bg-white/[0.04]"}`}
                        >
                          {m.label}
                        </button>
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

                  <div className="flex justify-between items-center mt-8">
                    <button onClick={() => { setAddHabitStep(2); setActiveModeInfo(null); }} className="px-6 py-3.5 rounded-2xl border border-white/5 bg-white/5 text-[10px] font-black uppercase tracking-[0.2em] text-text-secondary hover:text-text-primary hover:bg-white/10 active:scale-95 transition-all">Back</button>
                    <button onClick={() => { setAddHabitStep(4); setActiveModeInfo(null); }} className="px-8 py-3.5 bg-accent text-bg-main rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] active:scale-95 transition-all shadow-lg shadow-accent/20">Continue</button>
                  </div>
                </div>
              )}

              {addHabitStep === 4 && (
                <div className="animate-in slide-in-from-right fade-in duration-300 space-y-6">
                  {/* Color palette */}
                  <div>
                    <label className="text-[10px] font-black text-text-secondary uppercase tracking-[0.3em] block mb-3">
                      Card Color
                    </label>
                    <div className="flex gap-2 flex-wrap">
                      {[
                        { id: "default", colorClass: "var(--card-bg)" },
                        { id: "blue",    colorClass: "rgba(59, 130, 246, 0.5)" },
                        { id: "emerald", colorClass: "rgba(16, 185, 129, 0.5)" },
                        { id: "amber",   colorClass: "rgba(245, 158, 11, 0.5)" },
                        { id: "rose",    colorClass: "rgba(244, 63, 94, 0.5)" },
                        { id: "purple",  colorClass: "rgba(168, 85, 247, 0.5)" },
                        { id: "cyan",    colorClass: "rgba(6, 182, 212, 0.5)" },
                        { id: "orange",  colorClass: "rgba(249, 115, 22, 0.5)" },
                      ].map((c) => (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => setNewHabit({ ...newHabit, color: c.id })}
                          className={`w-6 h-6 rounded-full border-2 transition-all ${newHabit.color === c.id ? "border-accent scale-125 shadow-[0_0_8px_rgba(var(--accent-rgb),0.5)]" : "border-border-color hover:scale-110"}`}
                          style={{ backgroundColor: c.colorClass }}
                        />
                      ))}
                    </div>
                  </div>

                  <div className="flex items-center justify-between ml-1 pt-2">
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
                  <div className="rounded-2xl border border-white/10 bg-bg-main/30 p-3 max-h-[25vh] overflow-y-auto custom-scrollbar">
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
                  
                  <div className="flex justify-between items-center mt-8">
                    <button onClick={() => setAddHabitStep(3)} className="px-6 py-3.5 rounded-2xl border border-white/5 bg-white/5 text-[10px] font-black uppercase tracking-[0.2em] text-text-secondary hover:text-text-primary hover:bg-white/10 active:scale-95 transition-all">Back</button>
                    <button
                        onClick={async () => {
                          if (!newHabit.name.trim()) return;
                          
                          const habitPayload = {
                            id: Date.now().toString(),
                            name: newHabit.name.trim(),
                            description: newHabit.description.trim(),
                            color: newHabit.color || "indigo",
                            category: newHabit.category || "General",
                            createdBy: "user",
                            type: newHabit.type,
                            mode: newHabit.mode || "quick",
                            unit: newHabit.mode === "count" ? newHabit.unit || "" : newHabit.mode === "timer" ? "sec" : "",
                            emoji: newHabit.emoji || "",
                            totalLogs: 0,
                            logs: [],
                          };

                          const isFirstHabit = habits.length === 0;

                          await authContext.addHabit(habitPayload);

                          if (isFirstHabit) {
                            sessionStorage.setItem("auris_tour_permitted", "true");
                            unifiedUpdateUserConfig({ settings: { onboardingComplete: true } });
                          }

                          setNewHabit({ name: "", description: "", color: "indigo", category: "General", type: "Good", mode: "quick", unit: "", emoji: "" });
                          trackEvent("habit_created", { type: newHabit.type, mode: newHabit.mode });
                          setShowAddModal(false);
                          setActiveModeInfo(null);
                        }}
                        className="px-10 py-3.5 bg-accent text-bg-main rounded-2xl text-[10px] font-black uppercase tracking-[0.3em] hover:scale-[1.03] active:scale-[0.97] transition-all shadow-2xl shadow-accent/30 border-t border-white/20"
                    >
                        Create Habit
                    </button>
                  </div>
                </div>
              )}

            </div>
          </div>
        </div>
      )}

      {featureLockConfig && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center z-[110] p-4"
          onClick={(e) =>
            e.target === e.currentTarget && setFeatureLockConfig(null)
          }
        >
          <div className="glass-card modal-enter w-full max-w-md p-8 rounded-[2rem] border-white/10 relative overflow-hidden">
            <div className="absolute -top-24 -right-24 w-40 h-40 bg-accent/10 rounded-full blur-[80px] pointer-events-none" />
            <div className="flex justify-between items-center mb-6 relative z-10">
              <div>
                <h3 className="text-lg font-bold tracking-tight text-text-primary">
                  {featureLockConfig.title || "Unlock full console"}
                </h3>
                <p className="text-[10px] text-text-secondary uppercase tracking-[0.25em] mt-1 font-mono">
                  {featureLockConfig.subtitle || "Sign in for free to unlock this feature."}
                </p>
              </div>
              <button
                onClick={() => setFeatureLockConfig(null)}
                className="w-8 h-8 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-text-secondary hover:text-text-primary hover:border-text-secondary transition-all"
              >
                <Icon name="x" size={14} />
              </button>
            </div>
            <p className="text-xs text-text-secondary mb-6">
              {featureLockConfig.description || "Sign in and we'll keep everything synced across devices."}
            </p>
            <div className="flex flex-col sm:flex-row gap-3">
              <button
                onClick={() => {
                  setFeatureLockConfig(null);
                  window.location.href = "/login";
                }}
                className="flex-1 py-3 rounded-xl bg-accent text-bg-main text-[11px] font-black uppercase tracking-[0.3em]"
              >
                Sign in for free
              </button>
              <button
                onClick={() => setFeatureLockConfig(null)}
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
                        <Button onClick={() => window.location.reload()} variant="primary" className="w-full py-4 tracking-widest">Continue to Web</Button>
                    )}
                </div>
            </div>
        </div>
      )}

      {authContext.isBanned && (
        <BannedMessageModal />
      )}

      {authContext.isWiped && (
        <WipeMessageModal />
      )}

      {activeSystemMsg && (
        <AdminMessageModal 
          message={activeSystemMsg} 
          onClear={() => setActiveSystemMsg(null)} 
        />
      )}
      {activeUndo && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-[150] animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="glass-card bg-bg-sidebar/80 backdrop-blur-xl border border-white/10 px-5 py-3 rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.3)] flex items-center gap-5 border-t-white/20">
            <div className="flex flex-col">
               <span className="text-[10px] font-black uppercase tracking-[0.34em] text-text-secondary leading-none mb-1.5 flex items-center gap-1.5">
                 <div className="w-1 h-1 rounded-full bg-accent animate-pulse" />
                 Log Recorded
               </span>
               <span className="text-[9px] text-text-primary/40 font-mono tracking-tighter uppercase font-bold">
                Buffer status: active
               </span>
            </div>
            <div className="w-px h-8 bg-white/10 mx-1" />
            <button 
              onClick={() => {
                const { id, amount, unit, photoData, todayKey, timestamp } = activeUndo;
                logActivity(id, false, amount, unit, photoData, todayKey, timestamp);
                setActiveUndo(null);
              }}
              className="px-4 py-2 bg-accent/10 border border-accent/20 rounded-xl text-[10px] font-black text-accent uppercase tracking-widest hover:bg-accent hover:text-bg-main transition-all active:scale-95"
            >
              Undo Log
            </button>
            <button 
              onClick={() => setActiveUndo(null)} 
              className="w-8 h-8 rounded-lg flex items-center justify-center text-text-secondary hover:text-text-primary hover:bg-white/5 transition-colors"
            >
              <Icon name="x" size={14} />
            </button>
          </div>
        </div>
      )}
    </>
  );
}

const BannedMessageModal = () => {
    const { logout, banReason } = useAuth();
    
    const handleAcknowledge = async () => {
        await logout();
        // Hard redirect clears all React state and sends user to login
        window.location.href = '/';
    };

    return (
        <div className="fixed inset-0 z-[200] bg-black/95 backdrop-blur-2xl flex items-center justify-center p-4 text-center animate-in fade-in duration-500">
            <div className="glass-card w-full max-w-sm p-10 rounded-[3rem] border-white/10 relative overflow-hidden shadow-2xl">
                <div className="absolute -top-24 -right-24 w-48 h-48 bg-danger/20 rounded-full blur-[80px]" />
                <div className="w-24 h-24 mx-auto rounded-[2.5rem] bg-danger/10 text-danger flex items-center justify-center mb-8 border border-white/5 animate-pulse">
                    <Icon name="shield-alert" size={48} />
                </div>
                <h3 className="text-2xl font-bold tracking-tight text-text-primary mb-3 uppercase">Account Suspended</h3>
                <p className="text-sm text-text-secondary mb-10 leading-relaxed px-2">
                    {banReason || "Your account is temporarily suspended due to a violation of our community guidelines or security protocols."}
                </p>
                <button
                    onClick={handleAcknowledge}
                    className="w-full py-4 rounded-2xl bg-red-600 text-white text-[11px] font-black uppercase tracking-[0.2em] transition-all hover:bg-red-700 active:scale-95 shadow-lg shadow-red-900/30"
                >
                    Acknowledge & Leave
                </button>
            </div>
        </div>
    );
};

const AdminMessageModal = ({ message, onClear }) => {
    const [reply, setReply] = useState("");
    const [isReplying, setIsReplying] = useState(false);
    const [isSending, setIsSending] = useState(false);
    const { user } = useAuth();
    const { addToast } = useHabitNotifications([]);

    const handleSendReply = async () => {
        if (!reply.trim()) return;
        setIsSending(true);
        try {
            const { db } = await import("./firebase.config");
            const { collection, addDoc } = await import("firebase/firestore");
            await addDoc(collection(db, "inquiries"), {
                uid: user.uid,
                name: user.displayName || "User",
                email: user.email,
                topic: "Admin Reply",
                priority: "Normal",
                subject: "Reply to Admin Message",
                message: reply,
                createdAt: new Date().toISOString(),
                status: "pending"
            });
            addToast("Reply sent to admin", "success");
            onClear();
        } catch (e) {
            addToast("Failed to send reply", "error");
        } finally {
            setIsSending(false);
        }
    };

    if (!message) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-bg-main/90 backdrop-blur-xl animate-in fade-in duration-300">
            <div className="glass-card w-full max-w-sm p-8 rounded-[2.5rem] border-white/10 relative overflow-hidden shadow-2xl bg-gradient-to-b from-white/5 to-transparent">
                <div className="absolute top-0 left-0 w-full h-1 bg-accent/50" />
                <div className="relative z-10 flex flex-col items-center text-center">
                    <div className="w-16 h-16 rounded-3xl bg-accent/10 flex items-center justify-center text-accent mb-6">
                        <Icon name="mail" size={32} />
                    </div>
                    <p className="text-[10px] font-black uppercase tracking-[0.4em] text-accent mb-2">Transmission Received</p>
                    <h3 className="text-xl font-bold tracking-tight text-white mb-6 uppercase">Admin Message</h3>
                    
                    <div className="w-full bg-black/40 border border-white/5 rounded-2xl p-5 text-sm text-text-secondary leading-relaxed mb-6 text-left relative">
                        <div className="absolute -top-2 left-4 px-2 bg-bg-main text-[8px] font-bold uppercase tracking-widest text-text-secondary border border-white/5 rounded">Message Body</div>
                        {message}
                    </div>
                    
                    {isReplying ? (
                        <div className="w-full animate-in slide-in-from-top-2">
                            <textarea 
                                value={reply}
                                onChange={(e) => setReply(e.target.value)}
                                placeholder="Type your formal response..."
                                className="w-full bg-black/20 border border-white/10 rounded-xl p-4 text-xs text-text-primary outline-none focus:border-accent mb-4 resize-none transition-all placeholder:text-text-secondary/30"
                                rows={3}
                                disabled={isSending}
                            />
                            <div className="flex gap-3">
                                <button 
                                    onClick={() => setIsReplying(false)} 
                                    className="flex-1 py-3 px-6 bg-white/5 hover:bg-white/10 text-white text-[10px] font-black uppercase tracking-widest rounded-xl transition-all border border-white/10"
                                    disabled={isSending}
                                >
                                    Dismiss
                                </button>
                                <button 
                                    onClick={handleSendReply}
                                    disabled={isSending || !reply.trim()}
                                    className="flex-1 py-3 px-6 bg-accent text-bg-main text-[10px] font-black uppercase tracking-widest rounded-xl hover:opacity-90 active:scale-95 transition-all shadow-lg shadow-accent/20"
                                >
                                    {isSending ? "Processing..." : "Send Reply"}
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div className="flex gap-3 w-full">
                            <button 
                                onClick={() => setIsReplying(true)} 
                                className="flex-1 py-4 rounded-2xl bg-white/5 text-text-secondary text-[10px] font-black uppercase tracking-[0.2em] transition-all hover:bg-white/10 border border-white/10"
                            >
                                Reply
                            </button>
                            <button 
                                onClick={onClear} 
                                className="flex-1 py-4 rounded-2xl bg-accent text-bg-main text-[10px] font-black uppercase tracking-[0.2em] transition-all hover:opacity-90 active:scale-[0.98] shadow-lg shadow-accent/20"
                            >
                                OK
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

const WipeMessageModal = () => {
    const { user } = useAuth();

    const handleAcknowledge = async () => {
        // Store acknowledgment in localStorage so it never shows again after refresh
        if (user?.uid) {
            localStorage.setItem(`auris_wipe_ack_${user.uid}`, 'true');
        }
        // Clear the isWiped flag in Firestore so the modal doesn't re-appear
        try {
            const { db } = await import('./firebase.config');
            const { doc: fsDoc, updateDoc } = await import('firebase/firestore');
            if (user?.uid) {
                await updateDoc(fsDoc(db, 'users', user.uid), { isWiped: false });
            }
        } catch (e) {
            // Non-fatal if Firestore write fails, localStorage already set
        }
        window.location.reload();
    };

    // Don't re-show if already acknowledged this session
    if (user?.uid && localStorage.getItem(`auris_wipe_ack_${user.uid}`)) {
        return null;
    }

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-bg-main/95 backdrop-blur-2xl animate-in fade-in duration-500">
            <div className="w-full max-w-md bg-card-bg border border-border-color rounded-[2.5rem] p-10 shadow-2xl text-center relative overflow-hidden">
                <div className="absolute -top-10 -right-10 w-40 h-40 bg-red-600/10 blur-3xl rounded-full" />
                <div className="relative z-10 flex flex-col items-center">
                    <div className="w-20 h-20 rounded-[2rem] bg-red-600/10 flex items-center justify-center text-red-400 mb-8 border border-red-600/20">
                        <Icon name="refresh-cw" size={40} />
                    </div>
                    <h3 className="text-2xl font-bold tracking-tighter text-text-primary mb-4 uppercase">Data Environment Reset</h3>
                    <p className="text-sm text-text-secondary leading-relaxed mb-8 opacity-80">
                        The administrator has performed a complete system wipe on your workspace. All habits, logs, and stored configurations have been permanently erased.
                    </p>
                    <button 
                        onClick={handleAcknowledge}
                        className="w-full py-4 bg-red-600 text-white text-[10px] font-black uppercase tracking-[0.2em] rounded-2xl hover:bg-red-700 active:scale-95 transition-all shadow-2xl shadow-red-900/20"
                    >
                        Acknowledge & Refresh
                    </button>
                </div>
            </div>
        </div>
    );
};

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

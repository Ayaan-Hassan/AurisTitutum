import React, { useMemo, useState, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import Icon from "../components/Icon";
import { Card } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import HabitPerformanceModal from "../components/HabitPerformanceModal";
import { getLocalDateKey } from "../utils/date";

const isUnicodeSymbol = (ch) =>
  /^[\u25A0-\u27FF\u2190-\u21FF\u221E\u2295\u2297\u25D0\u25D1⟳◆▲▼●◯□△★✦◈⬡∞✕✓⊕⊗◐◑◇]/.test(ch);

// ─── Inline Stopwatch (Timer) for Dashboard ────────────────────────────────
const DashboardTimerControl = ({ habitId, logActivity }) => {
  const [running, setRunning] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const intervalRef = useRef(null);
  const startRef = useRef(null);

  useEffect(() => {
    if (running) {
      startRef.current = Date.now() - elapsed * 1000;
      intervalRef.current = setInterval(() => {
        setElapsed(Math.floor((Date.now() - startRef.current) / 1000));
      }, 500);
    } else {
      clearInterval(intervalRef.current);
    }
    return () => clearInterval(intervalRef.current);
  }, [running]);

  const fmt = (s) => {
    const m = Math.floor(s / 60), sec = s % 60;
    return `${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
  };

  const stop = () => {
    setRunning(false);
    if (elapsed > 0) {
      logActivity(habitId, true, elapsed, "sec");
      setElapsed(0);
    }
  };

  return (
    <div className="flex items-center gap-1.5">
      <div className={`font-mono text-sm font-bold px-2 py-1 rounded-lg border transition-all ${running ? "border-accent/60 bg-accent/10 text-accent" : "border-border-color bg-bg-main text-text-primary"}`}>
        {fmt(elapsed)}
      </div>
      <button
        onClick={() => running ? stop() : setRunning(true)}
        className={`w-8 h-8 rounded-lg flex items-center justify-center border-2 transition-all ${running ? "bg-emerald-500/20 border-emerald-500/70 text-emerald-400" : "bg-accent text-bg-main border-accent hover:opacity-90"}`}
        title={running ? "Stop & Log" : "Start"}
      >
        <Icon name={running ? "square" : "play"} size={12} />
      </button>
      {elapsed > 0 && !running && (
        <button onClick={() => setElapsed(0)} className="w-8 h-8 rounded-lg border border-border-color text-text-secondary hover:text-text-primary flex items-center justify-center transition-all" title="Reset">
          <Icon name="rotate-ccw" size={12} />
        </button>
      )}
    </div>
  );
};

// ─── Inline Upload Control for Dashboard ───────────────────────────────────
const DashboardUploadControl = ({ habit, logActivity }) => {
  const fileInputRef = useRef(null);
  const cameraRef = useRef(null);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [stream, setStream] = useState(null);
  const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

  const openCamera = async () => {
    if (isMobile) {
      // On mobile, just trigger the file picker with camera capture
      fileInputRef.current.setAttribute("capture", "environment");
      fileInputRef.current.click();
      return;
    }
    try {
      const s = await navigator.mediaDevices.getUserMedia({ video: true });
      setStream(s);
      setCameraOpen(true);
    } catch {
      fileInputRef.current?.click();
    }
  };

  useEffect(() => {
    if (cameraOpen && stream && cameraRef.current) {
      cameraRef.current.srcObject = stream;
    }
  }, [cameraOpen, stream]);

  const stopCamera = () => {
    stream?.getTracks().forEach((t) => t.stop());
    setStream(null);
    setCameraOpen(false);
  };

  const capturePhoto = () => {
    if (!cameraRef.current) return;
    const canvas = document.createElement("canvas");
    canvas.width = cameraRef.current.videoWidth;
    canvas.height = cameraRef.current.videoHeight;
    canvas.getContext("2d").drawImage(cameraRef.current, 0, 0);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.75);
    stopCamera();
    logActivity(habit.id, true, 1, "photo", dataUrl);
  };

  const handleFile = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => logActivity(habit.id, true, 1, "photo", ev.target.result);
    reader.readAsDataURL(file);
    e.target.value = null;
  };

  const photoCount = (habit.logs || []).reduce((s, l) =>
    s + (l.entries || []).filter(e => typeof e === "string" && e.startsWith("data:image")).length, 0);

  return (
    <>
      {cameraOpen && (
        <div className="fixed inset-0 z-[200] bg-black flex flex-col items-center justify-center">
          <video ref={cameraRef} autoPlay playsInline className="w-full max-h-[70vh] object-contain" />
          <div className="flex gap-4 mt-6">
            <button onClick={capturePhoto} className="w-16 h-16 rounded-full bg-white flex items-center justify-center shadow-2xl">
              <div className="w-12 h-12 rounded-full border-4 border-gray-300" />
            </button>
            <button onClick={stopCamera} className="px-6 py-3 rounded-xl bg-white/20 text-white font-bold">Cancel</button>
          </div>
        </div>
      )}
      <div className="flex items-center gap-1.5">
        <button
          onClick={openCamera}
          className="flex items-center gap-1 px-2 py-1.5 rounded-lg border border-border-color bg-bg-main text-text-secondary hover:text-accent hover:border-accent text-[11px] font-bold transition-all"
        >
          <Icon name="camera" size={12} />
          Cam
        </button>
        <button
          onClick={() => { fileInputRef.current.removeAttribute("capture"); fileInputRef.current.click(); }}
          className="flex items-center gap-1 px-2 py-1.5 rounded-lg border border-border-color bg-bg-main text-text-secondary hover:text-accent hover:border-accent text-[11px] font-bold transition-all"
        >
          <Icon name="image" size={12} />
          {photoCount > 0 ? `Photo (${photoCount})` : "Upload"}
        </button>
        <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />
      </div>
    </>
  );
};

// ─── Inline Rating Stars for Dashboard (once per day) ──────────────────────
const DashboardRatingControl = ({ habit, logActivity }) => {
  const [hovered, setHovered] = useState(0);
  const todayKey = getLocalDateKey();
  const todayLog = (habit.logs || []).find(l => l.date === todayKey);
  const todayEntries = todayLog?.entries || [];
  const lastEntry = todayEntries[todayEntries.length - 1];
  const rated = lastEntry && typeof lastEntry === "string" && lastEntry.includes("|")
    ? Math.round(Number(lastEntry.split("|")[1]) || 0)
    : (todayLog?.count ? Math.min(5, Math.round(todayLog.count)) : 0);

  if (rated > 0) {
    return (
      <div className="flex items-center gap-1.5">
        <span className="text-amber-400 text-xs font-bold">{rated}★</span>
        <span className="text-[9px] text-text-secondary font-mono">Today</span>
      </div>
    );
  }

  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map(v => (
        <button
          key={v}
          onClick={() => logActivity(habit.id, true, v, "stars")}
          onMouseEnter={() => setHovered(v)}
          onMouseLeave={() => setHovered(0)}
          className="w-6 h-6 flex items-center justify-center transition-all hover:scale-110"
        >
          <svg viewBox="0 0 24 24" className="w-4 h-4" fill={v <= (hovered || rated) ? "currentColor" : "none"} stroke="currentColor" strokeWidth={1.5}>
            <polygon points="12,2 15.09,8.26 22,9.27 17,14.14 18.18,21.02 12,17.77 5.82,21.02 7,14.14 2,9.27 8.91,8.26"
              className={v <= (hovered || rated) ? "text-amber-400" : "text-border-color"} />
          </svg>
        </button>
      ))}
    </div>
  );
};

// ─── Day Detail Popup ──────────────────────────────────────────────────────
const DayDetailPopup = ({ dateStr, habits, onClose }) => {
  const formatted = dateStr ? new Date(dateStr + "T12:00:00").toLocaleDateString("en-US", {
    weekday: "long", year: "numeric", month: "long", day: "numeric"
  }) : "";

  const entries = useMemo(() => {
    if (!dateStr) return [];
    const all = [];
    (habits || []).forEach(h => {
      const dayLog = (h.logs || []).find(l => l.date === dateStr);
      if (!dayLog) return;
      (dayLog.entries || []).forEach(entry => {
        const isPhoto = typeof entry === "string" && entry.startsWith("data:image");
        const isCount = typeof entry === "string" && entry.includes("|") && !isPhoto;
        if (isPhoto) {
          all.push({ habit: h.name, emoji: h.emoji, type: h.type, mode: h.mode, display: "📷 Photo", time: null, isPhoto: true, photoUrl: entry });
        } else if (isCount) {
          const [time, value, unit] = entry.split("|");
          all.push({ habit: h.name, emoji: h.emoji, type: h.type, mode: h.mode, display: `${value} ${unit || ""}`.trim(), time });
        } else {
          all.push({ habit: h.name, emoji: h.emoji, type: h.type, mode: h.mode, display: "Logged", time: entry });
        }
      });
    });
    return all;
  }, [dateStr, habits]);

  useEffect(() => {
    const esc = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", esc);
    return () => document.removeEventListener("keydown", esc);
  }, [onClose]);

  if (!dateStr) return null;

  return (
    <>
      <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-[120]" onClick={onClose} />
      <div className="fixed inset-0 z-[121] flex items-center justify-center p-4">
        <div
          className="w-full max-w-md bg-bg-main border border-border-color rounded-3xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95"
          onClick={e => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-border-color">
            <div>
              <p className="text-[9px] font-black uppercase tracking-[0.3em] text-text-secondary mb-0.5">Activity Log</p>
              <h3 className="text-base font-bold text-text-primary">{formatted}</h3>
            </div>
            <button onClick={onClose} className="w-8 h-8 rounded-xl border border-border-color flex items-center justify-center text-text-secondary hover:text-text-primary transition-all">
              <Icon name="x" size={15} />
            </button>
          </div>

          {/* Entries */}
          <div className="overflow-y-auto custom-scrollbar max-h-[55vh] p-4 space-y-2">
            {entries.length === 0 ? (
              <div className="py-12 text-center text-sm text-text-secondary">No activity logged on this day.</div>
            ) : entries.map((e, i) => (
              <div key={i} className={`flex items-center gap-3 p-3 rounded-xl border ${e.type === "Good" ? "border-success/20 bg-success/5" : "border-danger/20 bg-danger/5"}`}>
                <div className={`w-7 h-7 rounded-lg border flex items-center justify-center shrink-0 text-xs font-bold ${e.type === "Good" ? "border-success/30 bg-success/10 text-success" : "border-danger/30 bg-danger/10 text-danger"}`}>
                  {e.emoji && !isUnicodeSymbol(e.emoji) ? (
                    <span style={{ filter: "grayscale(1) brightness(1.2)", fontSize: "0.75rem" }}>{e.emoji}</span>
                  ) : (e.type === "Good" ? "+" : "−")}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold text-text-primary truncate">{e.habit}</p>
                  <p className="text-[10px] font-mono text-text-secondary">{e.time ? `${e.time} · ` : ""}{e.display}</p>
                </div>
                {e.isPhoto && e.photoUrl && (
                  <img src={e.photoUrl} alt="photo" className="w-10 h-10 rounded-lg object-cover border border-border-color shrink-0" />
                )}
              </div>
            ))}
          </div>

          {/* Summary */}
          {entries.length > 0 && (
            <div className="px-6 py-4 border-t border-border-color">
              <p className="text-[10px] text-text-secondary font-mono uppercase tracking-wider">
                {entries.length} {entries.length === 1 ? "entry" : "entries"} · {[...new Set(entries.map(e => e.habit))].length} habit{[...new Set(entries.map(e => e.habit))].length !== 1 ? "s" : ""}
              </p>
            </div>
          )}
        </div>
      </div>
    </>
  );
};

// ─── Main Dashboard ──────────────────────────────────────────────────────────
const Dashboard = ({ habits, logActivity, insights }) => {
  const [calendarMonth, setCalendarMonth] = useState(() => new Date());
  const [performanceTarget, setPerformanceTarget] = useState(null);
  const [selectedDay, setSelectedDay] = useState(null);
  const [countInputs, setCountInputs] = useState({});

  const performanceHabit = habits.find((h) => h.id === performanceTarget) || null;

  const flattenedLogs = useMemo(() => {
    const parseTs = (dateStr, timeStr) => {
      const iso = `${dateStr}T${timeStr || "00:00:00"}`;
      const dt = new Date(iso);
      if (!Number.isNaN(dt.getTime())) return dt;
      return new Date(`${dateStr}T12:00:00`);
    };
    const all = [];
    (habits || []).forEach((h) => {
      (h.logs || []).forEach((day) => {
        (day.entries || []).forEach((entry) => {
          // Skip base64 photo entries in recent logs
          if (typeof entry === "string" && entry.startsWith("data:image")) return;
          const isCount = typeof entry === "string" && entry.includes("|");
          const [time, value, unit] = isCount ? entry.split("|") : [entry, null, null];
          const formattedDate = new Date(day.date + "T12:00:00")
            .toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })
            .toUpperCase();
          all.push({ habit: h.name, emoji: h.emoji || "", type: h.type, date: day.date, formattedDate, time, value, unit });
        });
      });
    });
    return all.sort((a, b) => parseTs(b.date, b.time) - parseTs(a.date, a.time));
  }, [habits]);

  const totalLogEvents = (list) =>
    (list || []).reduce((sum, h) => sum + (h.logs || []).reduce((s, d) => s + (d.entries || []).length, 0), 0);
  const totalActivity = totalLogEvents(habits);
  const constructiveLogs = totalLogEvents((habits || []).filter((h) => h.type === "Good"));
  const destructiveLogs = totalLogEvents((habits || []).filter((h) => h.type === "Bad"));

  const habitListHeight = Math.min(Math.max(habits.length, 2) * 52 + 24, 400);

  const loggedDates = useMemo(() => {
    const set = new Set();
    (habits || []).filter((h) => h.type === "Good").forEach((h) => (h.logs || []).forEach((d) => set.add(d.date)));
    return set;
  }, [habits]);

  // Dates that have ANY log (good or bad)
  const anyActivityDates = useMemo(() => {
    const set = new Set();
    (habits || []).forEach((h) => (h.logs || []).forEach((d) => { if ((d.entries || []).length > 0) set.add(d.date); }));
    return set;
  }, [habits]);

  const calendarDays = useMemo(() => {
    const y = calendarMonth.getFullYear();
    const m = calendarMonth.getMonth();
    const first = new Date(y, m, 1);
    const last = new Date(y, m + 1, 0);
    const startPad = first.getDay();
    const days = [];
    for (let i = 0; i < startPad; i++) days.push(null);
    for (let d = 1; d <= last.getDate(); d++)
      days.push(getLocalDateKey(new Date(y, m, d)));
    return days;
  }, [calendarMonth]);

  const todayKey = getLocalDateKey();

  return (
    <div className="page-fade space-y-6 pb-20">
      {/* Daily Insight */}
      <Card className="ai-glow flex items-center gap-6 overflow-hidden relative hover:translate-y-0 hover:shadow-none hover:border-border-color border-l-4 border-l-accent">
        <div className="w-12 h-12 rounded-xl bg-accent-dim flex items-center justify-center border border-border-color shrink-0">
          <Icon name="brain" className="text-text-primary" size={20} />
        </div>
        <div className="min-w-0 flex-1">
          <h4 className="text-[10px] font-black uppercase tracking-[0.3em] text-text-secondary mb-1">Daily insight</h4>
          <h3 className="text-sm font-bold text-text-primary mb-0.5">{insights?.title || "Daily insight"}</h3>
          <p className="text-xs text-text-secondary max-w-2xl">
            {insights?.body || "Log first, judge later. Consistency starts with clean data."}
          </p>
        </div>
      </Card>

      {/* Stats Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="flex flex-row items-center gap-3 hover:translate-y-0">
          <div className="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center shrink-0">
            <Icon name="activity" size={18} className="text-accent" />
          </div>
          <div className="min-w-0">
            <p className="text-text-secondary text-[10px] font-black uppercase tracking-widest">All logs</p>
            <h3 className="text-xl font-mono font-bold text-text-primary">{totalActivity}</h3>
          </div>
        </Card>
        <Card className="flex flex-row items-center gap-3 hover:translate-y-0">
          <div className="w-10 h-10 rounded-lg bg-success/10 flex items-center justify-center shrink-0">
            <Icon name="zap" size={18} className="text-success" />
          </div>
          <div className="min-w-0">
            <p className="text-text-secondary text-[10px] font-black uppercase tracking-widest">Active habits</p>
            <h3 className="text-xl font-mono font-bold text-text-primary">{habits.length}</h3>
          </div>
        </Card>
        <Card className="hidden lg:flex flex-row items-center gap-3 hover:translate-y-0">
          <div className="w-10 h-10 rounded-lg bg-success/10 flex items-center justify-center shrink-0">
            <span className="text-base font-bold text-success">+</span>
          </div>
          <div className="min-w-0">
            <p className="text-text-secondary text-[10px] font-black uppercase tracking-widest">Constructive logs</p>
            <h3 className="text-xl font-mono font-bold text-success">{constructiveLogs}</h3>
          </div>
        </Card>
        <Card className="hidden lg:flex flex-row items-center gap-3 hover:translate-y-0">
          <div className="w-10 h-10 rounded-lg bg-danger/10 flex items-center justify-center shrink-0">
            <span className="text-base font-bold text-danger">−</span>
          </div>
          <div className="min-w-0">
            <p className="text-text-secondary text-[10px] font-black uppercase tracking-widest">Destructive logs</p>
            <h3 className="text-xl font-mono font-bold text-danger">{destructiveLogs}</h3>
          </div>
        </Card>
      </div>

      {/* Habit Registry + Recent Logs */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-stretch">
        <Card className="lg:col-span-2 flex flex-col hover:translate-y-0 hover:shadow-none hover:border-border-color">
          <div className="flex justify-between items-center mb-3 shrink-0">
            <h4 className="text-xs font-bold uppercase tracking-[0.2em] text-text-secondary">Habit Registry</h4>
            <Link to="/app/habits" className="text-[10px] font-bold uppercase tracking-widest text-text-secondary hover:text-text-primary">
              Manage →
            </Link>
          </div>
          <div className="space-y-2 overflow-y-auto custom-scrollbar pr-2 flex-1 min-h-0" style={{ maxHeight: habitListHeight }}>
            {habits.map((h) => {
              const checkedToday = (h.logs || []).some((l) => l.date === todayKey && l.count > 0);
              const isGood = h.type === "Good";
              return (
                <div key={h.id} className="flex items-center justify-between p-3 bg-accent-dim border border-border-color rounded-xl group transition-all hover:border-text-secondary">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`w-7 h-7 rounded-lg shrink-0 flex items-center justify-center border ${isGood ? "bg-accent/10 border-accent/30" : "bg-bg-main border-border-color"}`}>
                      {h.emoji ? (
                        <span className="leading-none" style={isUnicodeSymbol(h.emoji) ? { color: isGood ? "var(--accent)" : "var(--text-secondary)", fontSize: "0.75rem" } : { filter: "grayscale(1) saturate(0) brightness(1.2)", fontSize: "0.8rem" }}>
                          {h.emoji}
                        </span>
                      ) : (
                        <Icon name={isGood ? "check-circle" : "alert-circle"} size={13} className={isGood ? "text-accent" : "text-text-secondary"} />
                      )}
                    </div>
                    <div className="min-w-0">
                      <div className="text-sm font-bold text-text-primary truncate">{h.name}</div>
                      <div className="text-[10px] text-text-secondary uppercase font-mono truncate">
                        {h.mode === "check" ? `${h.totalLogs} day(s) checked` : h.mode === "quick" ? `${h.totalLogs} log(s)` : `${(h.logs || []).reduce((s, d) => s + (d.entries || []).length, 0)} log(s) · ${h.totalLogs} ${h.unit || ""}`}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0 ml-2">
                    <Button onClick={() => setPerformanceTarget(h.id)} size="sm" variant="outline" icon="bar-chart-2" className="bg-bg-main rounded-lg w-8 h-8 p-0" title="Habit performance" />

                    {h.mode === "timer" ? (
                      <DashboardTimerControl habitId={h.id} logActivity={logActivity} />
                    ) : h.mode === "upload" ? (
                      <DashboardUploadControl habit={h} logActivity={logActivity} />
                    ) : h.mode === "rating" ? (
                      <DashboardRatingControl habit={h} logActivity={logActivity} />
                    ) : h.mode === "check" ? (
                      <button
                        onClick={() => logActivity(h.id, !checkedToday)}
                        className={`w-8 h-8 rounded-lg border-2 flex items-center justify-center transition-all ${checkedToday
                          ? isGood ? "bg-emerald-500/20 border-emerald-500/70 shadow-[0_0_10px_rgba(52,211,153,0.2)]"
                            : "bg-red-500/20 border-red-500/70 shadow-[0_0_10px_rgba(239,68,68,0.2)]"
                          : "border-border-color text-text-secondary hover:border-text-secondary"}`}
                      >
                        {checkedToday ? (
                          isGood ? <svg viewBox="0 0 12 12" width="12" height="12" fill="none"><path d="M1.5 6.5L4.5 9.5L10.5 2.5" stroke="#4ade80" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
                            : <svg viewBox="0 0 12 12" width="12" height="12" fill="none"><path d="M2 2L10 10M10 2L2 10" stroke="#f87171" strokeWidth="1.8" strokeLinecap="round" /></svg>
                        ) : <div className="w-2.5 h-2.5 rounded border border-border-color" />}
                      </button>
                    ) : h.mode === "count" ? (
                      <div className="flex items-center gap-1.5 ml-1 mr-1">
                        <input
                          type="number"
                          min="1"
                          placeholder="0"
                          className="w-12 h-8 rounded-lg bg-bg-main border border-border-color text-center text-[11px] font-mono text-text-primary px-1"
                          value={countInputs[h.id] ?? ""}
                          onChange={(e) =>
                            setCountInputs((prev) => ({
                              ...prev,
                              [h.id]: e.target.value,
                            }))
                          }
                        />
                        {h.unit && (
                          <span className="text-[10px] text-text-secondary mr-1">{h.unit}</span>
                        )}
                        <Button
                          onClick={() => {
                            const n = countInputs[h.id];
                            logActivity(h.id, false, n ? Number(n) : 1, h.unit || "");
                            setCountInputs((prev) => ({ ...prev, [h.id]: "" }));
                          }}
                          size="sm" variant="outline" icon="minus" className="bg-bg-main rounded-[6px] w-7 h-7 p-0"
                        />
                        <Button
                          onClick={() => {
                            const n = countInputs[h.id];
                            logActivity(h.id, true, n ? Number(n) : 1, h.unit || "");
                            setCountInputs((prev) => ({ ...prev, [h.id]: "" }));
                          }}
                          size="sm" variant="primary" icon="plus" className="rounded-[6px] w-7 h-7 p-0"
                        />
                      </div>
                    ) : (
                      <>
                        <Button onClick={() => logActivity(h.id, false)} size="sm" variant="outline" icon="minus" className="bg-bg-main rounded-lg w-8 h-8 p-0" />
                        <Button onClick={() => logActivity(h.id, true)} size="sm" variant="primary" icon="plus" className="rounded-lg w-8 h-8 p-0" />
                      </>
                    )}
                  </div>
                </div>
              );
            })}
            {habits.length === 0 && (
              <div className="flex flex-col items-center justify-center text-text-secondary text-xs italic py-12">
                No habits yet. Click &ldquo;Add Habit&rdquo; to begin.
              </div>
            )}
          </div>
        </Card>

        {/* Recent Logs */}
        <Card className="flex flex-col hover:translate-y-0 hover:shadow-none hover:border-border-color">
          <div className="flex justify-between items-center mb-3 shrink-0">
            <h4 className="text-xs font-bold uppercase tracking-[0.2em] text-text-secondary">Recent Logs</h4>
            <Link to="/app/logs" className="text-[10px] font-bold uppercase tracking-widest text-text-secondary hover:text-text-primary">
              All logs →
            </Link>
          </div>
          <div className="space-y-2 overflow-y-auto custom-scrollbar pr-2 flex-1 min-h-0" style={{ maxHeight: habitListHeight }}>
            {flattenedLogs.slice(0, 50).map((log, i) => (
              <div key={i} className={`flex gap-3 items-start border-l-2 pl-3 py-1.5 transition-colors ${log.type === "Good" ? "border-success/60 hover:border-success" : "border-danger/60 hover:border-danger"}`}>
                <div className={`mt-0.5 w-7 h-7 rounded-lg border flex items-center justify-center shrink-0 ${log.type === "Good" ? "border-success/30 bg-success/10 text-success" : "border-danger/30 bg-danger/10 text-danger"}`}>
                  <span className="text-xs font-bold">{log.type === "Good" ? "+" : "−"}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[11px] font-bold text-text-primary truncate flex items-center gap-1.5">
                    {log.emoji && (
                      <span className="leading-none shrink-0" style={isUnicodeSymbol(log.emoji) ? { color: "var(--text-secondary)", fontSize: "0.7rem" } : { filter: "grayscale(1) saturate(0) brightness(1.2)", fontSize: "0.75rem" }}>
                        {log.emoji}
                      </span>
                    )}
                    {log.habit}
                  </div>
                  <div className="text-[9px] font-mono text-text-secondary">
                    {log.time} · {log.formattedDate}
                    {log.value != null ? ` · ${log.value} ${log.unit || ""}` : ""}
                  </div>
                </div>
              </div>
            ))}
            {flattenedLogs.length === 0 && (
              <div className="flex flex-col items-center justify-center text-center py-12 text-[10px] uppercase text-text-secondary tracking-widest">
                No logs yet. Log activity above.
              </div>
            )}
          </div>
        </Card>
      </div>

      {/* Activity Calendar */}
      <Card className="p-4 sm:p-6 overflow-hidden hover:translate-y-0 hover:shadow-none hover:border-border-color">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
          <h4 className="text-[10px] sm:text-xs font-bold uppercase tracking-[0.2em] text-text-secondary">Activity Calendar</h4>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setCalendarMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1))}
              className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg border border-border-color flex items-center justify-center text-text-secondary hover:text-text-primary text-sm font-bold shrink-0"
            >
              {"<"}
            </button>
            <span className="text-xs sm:text-sm font-bold text-text-primary text-center min-w-[120px] sm:min-w-[140px] whitespace-nowrap">
              {calendarMonth.toLocaleDateString("en-US", { month: "long", year: "numeric" })}
            </span>
            <button
              type="button"
              onClick={() => setCalendarMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1))}
              className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg border border-border-color flex items-center justify-center text-text-secondary hover:text-text-primary text-sm font-bold shrink-0"
            >
              {">"}
            </button>
          </div>
        </div>

        {/* Weekday headers */}
        <div className="grid grid-cols-7 gap-1 mb-1">
          {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
            <div key={d} className="text-[8px] sm:text-[9px] font-bold text-text-secondary uppercase text-center py-1">{d}</div>
          ))}
        </div>

        {/* Day cells */}
        <div className="grid grid-cols-7 gap-1">
          {calendarDays.map((dateStr, i) => {
            const hasGood = dateStr && loggedDates.has(dateStr);
            const hasAny = dateStr && anyActivityDates.has(dateStr);
            const isToday = dateStr === todayKey;
            const dayNum = dateStr ? new Date(dateStr + "T12:00:00").getDate() : "";

            const cellClass = [
              "aspect-square rounded-lg flex items-center justify-center text-[10px] sm:text-[11px] font-mono transition-all",
              !dateStr
                ? "invisible"
                : isToday && hasGood
                  ? "bg-accent text-bg-main border border-accent shadow-sm cursor-pointer hover:opacity-90"
                  : isToday
                    ? "bg-bg-main/80 border-2 border-accent/60 text-accent"
                    : hasGood
                      ? "bg-black dark:bg-white text-white dark:text-bg-main border border-black dark:border-white shadow-sm cursor-pointer hover:opacity-80"
                      : hasAny
                        ? "bg-bg-main/50 border border-border-color text-text-secondary cursor-pointer hover:border-text-secondary"
                        : "bg-bg-main/50 border border-border-color text-text-secondary",
            ].join(" ");

            return (
              <div
                key={i}
                className={cellClass}
                onClick={() => dateStr && hasAny && setSelectedDay(dateStr)}
                title={dateStr && hasAny ? "Click to see logs" : undefined}
              >
                {dayNum}
              </div>
            );
          })}
        </div>
      </Card>

      {/* Day Detail Popup */}
      {selectedDay && (
        <DayDetailPopup
          dateStr={selectedDay}
          habits={habits}
          onClose={() => setSelectedDay(null)}
        />
      )}

      <HabitPerformanceModal
        open={!!performanceTarget}
        habit={performanceHabit}
        onClose={() => setPerformanceTarget(null)}
      />
    </div>
  );
};

export default Dashboard;

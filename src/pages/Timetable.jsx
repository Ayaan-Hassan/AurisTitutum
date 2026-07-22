import React, { useState, useEffect, useMemo, useRef } from "react";
import Icon from "../components/Icon";
import { Card } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { ConfirmModal } from "../components/Modals";
import { useAuth } from "../contexts/AuthContext";
import { getLocalDateKey } from "../utils/date";

const DAYS = [
  { id: 1, label: "Mon", full: "Monday" },
  { id: 2, label: "Tue", full: "Tuesday" },
  { id: 3, label: "Wed", full: "Wednesday" },
  { id: 4, label: "Thu", full: "Thursday" },
  { id: 5, label: "Fri", full: "Friday" },
  { id: 6, label: "Sat", full: "Saturday" },
  { id: 0, label: "Sun", full: "Sunday" },
];

const CATEGORIES = ["Health", "Work", "Study", "Fitness", "Personal", "Mindset", "Leisure"];

const COLOR_PALETTE = [
  { id: "slate", border: "border-slate-500/50", bg: "bg-slate-500/10", text: "text-slate-400", hex: "#64748b" },
  { id: "indigo", border: "border-indigo-500/50", bg: "bg-indigo-500/10", text: "text-indigo-400", hex: "#6366f1" },
  { id: "emerald", border: "border-emerald-500/50", bg: "bg-emerald-500/10", text: "text-emerald-400", hex: "#10b981" },
  { id: "amber", border: "border-amber-500/50", bg: "bg-amber-500/10", text: "text-amber-400", hex: "#f59e0b" },
  { id: "rose", border: "border-rose-500/50", bg: "bg-rose-500/10", text: "text-rose-400", hex: "#f43f5e" },
  { id: "purple", border: "border-purple-500/50", bg: "bg-purple-500/10", text: "text-purple-400", hex: "#a855f7" },
  { id: "cyan", border: "border-cyan-500/50", bg: "bg-cyan-500/10", text: "text-cyan-400", hex: "#06b6d4" },
  { id: "orange", border: "border-orange-500/50", bg: "bg-orange-500/10", text: "text-orange-400", hex: "#f97316" },
];

const DEFAULT_SLOTS = [
  { title: "Sleeping Time", startTime: "22:00", endTime: "06:00", category: "Health", color: "indigo", notes: "Rest and physical recovery" },
  { title: "Morning Routine", startTime: "06:00", endTime: "07:30", category: "Personal", color: "emerald", notes: "Hydration, stretch, preparation" },
  { title: "Exercise & Fitness", startTime: "07:30", endTime: "09:00", category: "Fitness", color: "rose", notes: "Workout / Football / Cardio" },
  { title: "Deep Work / Study", startTime: "09:00", endTime: "13:00", category: "Work", color: "amber", notes: "Focus hours for key objectives" },
  { title: "Lunch Break", startTime: "13:00", endTime: "14:00", category: "Health", color: "cyan", notes: "Recharge & meal" },
  { title: "Skill Building & Project", startTime: "14:00", endTime: "18:00", category: "Study", color: "purple", notes: "Learning & practical tasks" },
  { title: "Evening Relaxation", startTime: "18:00", endTime: "22:00", category: "Leisure", color: "orange", notes: "Wind down & leisure" },
];

const TEMPLATES = [
  {
    id: "workday",
    name: "Standard Workday",
    desc: "Balanced routine optimized for high productivity and health.",
    slots: DEFAULT_SLOTS,
  },
  {
    id: "weekend",
    name: "Weekend Balance",
    desc: "Relaxed schedule focusing on leisure, family, and active recovery.",
    slots: [
      { title: "Sleep & Rest", startTime: "23:00", endTime: "07:30", category: "Health", color: "indigo", notes: "Deep sleep" },
      { title: "Morning Walk / Stretch", startTime: "08:00", endTime: "09:30", category: "Fitness", color: "emerald", notes: "Outdoor fresh air" },
      { title: "Personal Projects & Reading", startTime: "10:00", endTime: "13:00", category: "Personal", color: "purple", notes: "Creative work" },
      { title: "Family & Social Time", startTime: "14:00", endTime: "18:00", category: "Leisure", color: "orange", notes: "Quality connection" },
      { title: "Weekly Review & Planning", startTime: "19:00", endTime: "20:30", category: "Mindset", color: "amber", notes: "Plan ahead" },
    ],
  },
  {
    id: "intensive",
    name: "Intensive Study/Project",
    desc: "High-focus routine tailored for exam preparation or sprint deadlines.",
    slots: [
      { title: "Sleep Protocol", startTime: "23:00", endTime: "06:30", category: "Health", color: "indigo", notes: "Rest" },
      { title: "Sprint Session 1", startTime: "08:00", endTime: "12:00", category: "Study", color: "purple", notes: "Deep focus non-distracted" },
      { title: "Lunch & Reset", startTime: "12:00", endTime: "13:00", category: "Health", color: "cyan", notes: "Mind reset" },
      { title: "Sprint Session 2", startTime: "13:00", endTime: "17:00", category: "Work", color: "amber", notes: "Execution phase" },
      { title: "Cardio & Sweat", startTime: "17:30", endTime: "18:30", category: "Fitness", color: "rose", notes: "High energy burst" },
      { title: "Review & Knowledge Check", startTime: "19:30", endTime: "21:30", category: "Study", color: "cyan", notes: "Self testing" },
    ],
  },
];

export default function Timetable({ logActivity }) {
  const { user, timetable, updateTimetable, habits } = useAuth();
  
  // Current real-world day index (0 = Sun, 1 = Mon, ..., 6 = Sat)
  const realTodayDay = new Date().getDay();
  const [selectedDay, setSelectedDay] = useState(realTodayDay);
  
  const [editingSlot, setEditingSlot] = useState(null);
  const [showCopyModal, setShowCopyModal] = useState(false);
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [targetCopyDays, setTargetCopyDays] = useState([1, 2, 3, 4, 5]);
  const [deleteSlotId, setDeleteSlotId] = useState(null);
  const [currentTime, setCurrentTime] = useState(new Date());

  // Clock tick every 10 seconds for current activity tracker
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 10000);
    return () => clearInterval(timer);
  }, []);

  // Timetable map state by day: { [dayOfWeek]: Slot[] }
  const weeklyTimetable = useMemo(() => {
    const map = { 0: [], 1: [], 2: [], 3: [], 4: [], 5: [], 6: [] };
    if (timetable && Array.isArray(timetable)) {
      timetable.forEach((slot) => {
        const d = slot.dayOfWeek ?? 1;
        if (!map[d]) map[d] = [];
        map[d].push(slot);
      });
    }
    // Sort slots by startTime for each day
    Object.keys(map).forEach((d) => {
      map[d].sort((a, b) => (a.startTime || "").localeCompare(b.startTime || ""));
    });
    return map;
  }, [timetable]);

  const currentDaySlots = weeklyTimetable[selectedDay] || [];

  // ── Calculate Active Activity Node Right Now ──
  const activeActivity = useMemo(() => {
    const todaySlots = weeklyTimetable[realTodayDay] || [];
    if (todaySlots.length === 0) return null;

    const nowMinutes = currentTime.getHours() * 60 + currentTime.getMinutes();

    for (const slot of todaySlots) {
      if (!slot.startTime || !slot.endTime) continue;
      const [sh, sm] = slot.startTime.split(":").map(Number);
      const [eh, em] = slot.endTime.split(":").map(Number);
      let startM = sh * 60 + sm;
      let endM = eh * 60 + em;

      // Handle overnight routines (e.g. 22:00 to 06:00)
      if (endM <= startM) {
        if (nowMinutes >= startM || nowMinutes < endM) {
          const totalDuration = (24 * 60 - startM) + endM;
          const elapsed = nowMinutes >= startM ? (nowMinutes - startM) : (24 * 60 - startM + nowMinutes);
          const remaining = Math.max(0, totalDuration - elapsed);
          return { slot, elapsed, totalDuration, remaining };
        }
      } else {
        if (nowMinutes >= startM && nowMinutes < endM) {
          const totalDuration = endM - startM;
          const elapsed = nowMinutes - startM;
          const remaining = Math.max(0, totalDuration - elapsed);
          return { slot, elapsed, totalDuration, remaining };
        }
      }
    }
    return null;
  }, [weeklyTimetable, realTodayDay, currentTime]);

  // ── Handlers ──
  const handleSaveSlot = async (slotData) => {
    const newSlot = {
      ...slotData,
      id: slotData.id || `slot_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
      dayOfWeek: selectedDay,
      createdBy: slotData.createdBy || "user",
    };

    let updatedList = [...(timetable || [])];
    const existingIndex = updatedList.findIndex((s) => s.id === newSlot.id);
    if (existingIndex >= 0) {
      updatedList[existingIndex] = newSlot;
    } else {
      updatedList.push(newSlot);
    }

    await updateTimetable(updatedList);
    setEditingSlot(null);
  };

  const handleDeleteSlot = async (slotId) => {
    const updatedList = (timetable || []).filter((s) => s.id !== slotId);
    await updateTimetable(updatedList);
    setDeleteSlotId(null);
  };

  const handleCopyDaySchedule = async () => {
    const sourceSlots = weeklyTimetable[selectedDay] || [];
    if (sourceSlots.length === 0) return;

    // Filter out target days slots, then append copied slots for target days
    let updatedList = (timetable || []).filter((s) => !targetCopyDays.includes(s.dayOfWeek));
    targetCopyDays.forEach((tDay) => {
      sourceSlots.forEach((slot) => {
        updatedList.push({
          ...slot,
          id: `slot_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
          dayOfWeek: tDay,
        });
      });
    });

    await updateTimetable(updatedList);
    setShowCopyModal(false);
  };

  const handleApplyTemplate = async (templateSlots, applyToAll = false) => {
    let updatedList = [...(timetable || [])];
    if (applyToAll) {
      updatedList = [];
      DAYS.forEach((d) => {
        templateSlots.forEach((s) => {
          updatedList.push({
            ...s,
            id: `slot_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
            dayOfWeek: d.id,
            createdBy: "user",
          });
        });
      });
    } else {
      updatedList = updatedList.filter((s) => s.dayOfWeek !== selectedDay);
      templateSlots.forEach((s) => {
        updatedList.push({
          ...s,
          id: `slot_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
          dayOfWeek: selectedDay,
          createdBy: "user",
        });
      });
    }

    await updateTimetable(updatedList);
    setShowTemplateModal(false);
  };

  const handleInitializeDefaultSlots = async () => {
    const newSlots = DEFAULT_SLOTS.map((s, idx) => ({
      ...s,
      id: `slot_default_${selectedDay}_${idx}`,
      dayOfWeek: selectedDay,
      createdBy: "user",
    }));
    const updated = [...(timetable || []).filter((s) => s.dayOfWeek !== selectedDay), ...newSlots];
    await updateTimetable(updated);
  };

  return (
    <div className="page-fade space-y-8 pb-20">
      {/* Header Title & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tighter text-text-primary flex items-center gap-3">
            <Icon name="clock" size={28} className="text-accent" /> Timetable Routine
          </h2>
          <p className="text-text-secondary text-sm mt-1">
            Engineered full-day schedule & live execution protocol.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowTemplateModal(true)}
            className="rounded-xl text-xs uppercase tracking-widest font-bold border-border-color hover:border-accent"
          >
            <Icon name="layout" size={14} className="mr-1.5" /> Routine Templates
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowCopyModal(true)}
            disabled={currentDaySlots.length === 0}
            className="rounded-xl text-xs uppercase tracking-widest font-bold border-border-color hover:border-accent disabled:opacity-40"
          >
            <Icon name="copy" size={14} className="mr-1.5" /> Copy Day
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={() => setEditingSlot({ title: "", startTime: "09:00", endTime: "10:00", category: "Personal", color: "indigo" })}
            className="rounded-xl text-xs uppercase tracking-widest font-bold shadow-lg shadow-accent/20"
          >
            <Icon name="plus" size={14} className="mr-1.5" /> Add Time Slot
          </Button>
        </div>
      </div>

      {/* ── Active Routine Banner (Live Header) ── */}
      {activeActivity ? (
        <Card className="relative overflow-hidden border-2 border-accent/40 bg-gradient-to-r from-accent/15 via-bg-main to-bg-sidebar shadow-2xl p-6">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 relative z-10">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-accent text-bg-main flex items-center justify-center font-black shadow-lg shadow-accent/30 animate-pulse">
                <Icon name="play" size={24} />
              </div>
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[9px] font-black uppercase tracking-[0.3em] px-2 py-0.5 rounded bg-accent/20 text-accent border border-accent/30">
                    Active Routine Block
                  </span>
                  <span className="text-xs font-mono font-bold text-text-secondary">
                    {activeActivity.slot.startTime} – {activeActivity.slot.endTime}
                  </span>
                </div>
                <h3 className="text-2xl font-black text-text-primary tracking-tight">
                  {activeActivity.slot.title}
                </h3>
                {activeActivity.slot.notes && (
                  <p className="text-xs text-text-secondary mt-0.5 font-medium">{activeActivity.slot.notes}</p>
                )}
              </div>
            </div>

            <div className="flex items-center gap-6 w-full md:w-auto justify-between md:justify-end">
              <div className="text-right">
                <p className="text-[10px] font-black uppercase tracking-widest text-text-secondary">Remaining</p>
                <p className="text-2xl font-mono font-bold text-accent">
                  {Math.floor(activeActivity.remaining / 60)}h {activeActivity.remaining % 60}m
                </p>
              </div>

              {activeActivity.slot.linkedHabitId && (
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => logActivity?.(activeActivity.slot.linkedHabitId, true)}
                  className="rounded-xl text-xs uppercase tracking-widest font-black shadow-lg shadow-accent/30 whitespace-nowrap"
                >
                  <Icon name="check-circle" size={14} className="mr-1.5" /> Log Habit Node
                </Button>
              )}
            </div>
          </div>

          {/* Dynamic Progress Bar */}
          <div className="w-full bg-border-color/30 h-1.5 rounded-full mt-5 overflow-hidden">
            <div
              className="bg-accent h-full transition-all duration-500"
              style={{ width: `${Math.min(100, (activeActivity.elapsed / activeActivity.totalDuration) * 100)}%` }}
            />
          </div>
        </Card>
      ) : (
        <Card className="border border-border-color bg-bg-sidebar/50 p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-accent-dim flex items-center justify-center text-text-secondary">
              <Icon name="moon" size={18} />
            </div>
            <div>
              <p className="text-xs font-bold text-text-primary">No Active Scheduled Routine Right Now</p>
              <p className="text-[10px] font-mono text-text-secondary">System standby mode. Next routine block will trigger automatically.</p>
            </div>
          </div>
        </Card>
      )}

      {/* ── Day Selector Tabs ── */}
      <div className="flex items-center gap-2 overflow-x-auto custom-scrollbar pb-2">
        {DAYS.map((d) => {
          const isToday = d.id === realTodayDay;
          const isSelected = d.id === selectedDay;
          const count = (weeklyTimetable[d.id] || []).length;
          return (
            <button
              key={d.id}
              onClick={() => setSelectedDay(d.id)}
              className={`flex items-center gap-2 px-5 py-3 rounded-2xl text-xs font-black uppercase tracking-widest transition-all whitespace-nowrap border ${
                isSelected
                  ? "bg-accent text-bg-main border-accent shadow-lg shadow-accent/20 scale-105"
                  : "bg-bg-sidebar border-border-color text-text-secondary hover:text-text-primary hover:border-text-secondary"
              }`}
            >
              <span>{d.label}</span>
              {count > 0 && (
                <span className={`px-1.5 py-0.5 rounded-full text-[9px] font-mono ${isSelected ? "bg-bg-main/20 text-bg-main" : "bg-accent-dim text-text-secondary"}`}>
                  {count}
                </span>
              )}
              {isToday && (
                <span className={`w-2 h-2 rounded-full ${isSelected ? "bg-bg-main" : "bg-accent animate-pulse"}`} title="Today" />
              )}
            </button>
          );
        })}

        <button
          onClick={() => setSelectedDay(realTodayDay)}
          className="ml-auto px-4 py-2.5 rounded-xl border border-accent/40 bg-accent/10 text-accent text-[10px] font-black uppercase tracking-widest hover:bg-accent/20 transition-all shrink-0"
        >
          Jump to Today
        </button>
      </div>

      {/* ── Routine Slot List ── */}
      <div className="space-y-4">
        {currentDaySlots.length === 0 ? (
          <Card className="p-12 text-center flex flex-col items-center justify-center border-dashed border-2 border-border-color">
            <Icon name="clock-off" size={40} className="text-text-secondary/40 mb-3" />
            <h4 className="text-base font-bold text-text-primary">No Routine Slots Configured for {DAYS.find((d) => d.id === selectedDay)?.full}</h4>
            <p className="text-xs text-text-secondary max-w-md mt-1 mb-6">
              Start adding your daily routine bars, or generate default continuous time blocks below.
            </p>
            <div className="flex items-center gap-3">
              <Button
                variant="primary"
                onClick={handleInitializeDefaultSlots}
                className="rounded-xl text-xs uppercase tracking-widest font-bold shadow-lg"
              >
                <Icon name="wand" size={14} className="mr-1.5" /> Load Default 7 Routine Bars
              </Button>
            </div>
          </Card>
        ) : (
          currentDaySlots.map((slot) => {
            const colorObj = COLOR_PALETTE.find((c) => c.id === slot.color) || COLOR_PALETTE[0];
            const linkedHabit = habits?.find((h) => h.id === slot.linkedHabitId);
            return (
              <Card
                key={slot.id}
                className={`group relative overflow-hidden transition-all border-2 ${colorObj.border} hover:shadow-xl bg-card-bg`}
              >
                <div className={`absolute left-0 top-0 bottom-0 w-2 ${colorObj.bg}`} />

                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pl-4 pr-2 py-1">
                  <div className="flex items-start sm:items-center gap-4 min-w-0 flex-1">
                    {/* Time Badge */}
                    <div className="flex flex-col items-center justify-center px-4 py-2 rounded-xl bg-bg-main border border-border-color shrink-0 min-w-[100px]">
                      <span className="text-xs font-mono font-bold text-text-primary">{slot.startTime}</span>
                      <span className="text-[9px] font-mono text-text-secondary">to</span>
                      <span className="text-xs font-mono font-bold text-text-primary">{slot.endTime}</span>
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <h4 className="text-lg font-bold text-text-primary tracking-tight truncate">
                          {slot.title}
                        </h4>
                        <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded border ${colorObj.bg} ${colorObj.text} ${colorObj.border}`}>
                          {slot.category || "General"}
                        </span>
                        {linkedHabit && (
                          <span className="text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
                            <Icon name="link" size={10} /> {linkedHabit.name}
                          </span>
                        )}
                      </div>
                      {slot.notes && (
                        <p className="text-xs text-text-secondary truncate">{slot.notes}</p>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                    {linkedHabit && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => logActivity?.(linkedHabit.id, true)}
                        className="rounded-xl text-[10px] font-black uppercase tracking-widest border-emerald-500/40 text-emerald-400 hover:bg-emerald-500/10"
                        title={`Quick Log ${linkedHabit.name}`}
                      >
                        <Icon name="plus" size={12} className="mr-1" /> Log Node
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setEditingSlot(slot)}
                      className="w-9 h-9 p-0 rounded-xl hover:bg-bg-sidebar text-text-secondary hover:text-text-primary"
                    >
                      <Icon name="edit-3" size={14} />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setDeleteSlotId(slot.id)}
                      className="w-9 h-9 p-0 rounded-xl hover:bg-red-500/10 text-text-secondary hover:text-red-400"
                    >
                      <Icon name="trash" size={14} />
                    </Button>
                  </div>
                </div>
              </Card>
            );
          })
        )}
      </div>

      {/* ── Slot Add / Edit Modal ── */}
      {editingSlot && (
        <SlotEditorModal
          slot={editingSlot}
          habits={habits}
          onSave={handleSaveSlot}
          onClose={() => setEditingSlot(null)}
        />
      )}

      {/* ── Copy Day Modal ── */}
      {showCopyModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-md flex items-center justify-center z-[150] p-4 animate-in fade-in">
          <div className="glass-card w-full max-w-md p-6 rounded-[2rem] border-white/10 relative">
            <h3 className="text-xl font-bold text-text-primary flex items-center gap-2 mb-2">
              <Icon name="copy" size={20} className="text-accent" /> Copy Schedule
            </h3>
            <p className="text-xs text-text-secondary mb-6">
              Duplicate routine slots from <strong className="text-text-primary">{DAYS.find((d) => d.id === selectedDay)?.full}</strong> to target days:
            </p>

            <div className="grid grid-cols-2 gap-2 mb-6">
              {DAYS.filter((d) => d.id !== selectedDay).map((d) => {
                const checked = targetCopyDays.includes(d.id);
                return (
                  <button
                    key={d.id}
                    onClick={() => {
                      if (checked) setTargetCopyDays(targetCopyDays.filter((id) => id !== d.id));
                      else setTargetCopyDays([...targetCopyDays, d.id]);
                    }}
                    className={`p-3 rounded-xl border text-xs font-bold uppercase tracking-wider flex items-center justify-between transition-all ${
                      checked ? "bg-accent/15 border-accent text-accent" : "bg-bg-main border-border-color text-text-secondary"
                    }`}
                  >
                    <span>{d.full}</span>
                    <Icon name={checked ? "check-square" : "square"} size={16} />
                  </button>
                );
              })}
            </div>

            <div className="flex gap-3">
              <Button variant="ghost" onClick={() => setShowCopyModal(false)} className="flex-1 rounded-xl">
                Cancel
              </Button>
              <Button variant="primary" onClick={handleCopyDaySchedule} className="flex-1 rounded-xl shadow-lg">
                Apply Copy
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ── Template Picker Modal ── */}
      {showTemplateModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-md flex items-center justify-center z-[150] p-4 animate-in fade-in">
          <div className="glass-card w-full max-w-lg p-6 rounded-[2rem] border-white/10 relative">
            <h3 className="text-xl font-bold text-text-primary flex items-center gap-2 mb-2">
              <Icon name="layout" size={20} className="text-accent" /> Routine Templates
            </h3>
            <p className="text-xs text-text-secondary mb-6">Select a pre-designed routine schedule to inject:</p>

            <div className="space-y-3 mb-6 max-h-[50vh] overflow-y-auto custom-scrollbar">
              {TEMPLATES.map((tmpl) => (
                <div key={tmpl.id} className="p-4 rounded-2xl border border-border-color bg-bg-main/50 space-y-3">
                  <div>
                    <h4 className="text-base font-bold text-text-primary">{tmpl.name}</h4>
                    <p className="text-xs text-text-secondary">{tmpl.desc}</p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleApplyTemplate(tmpl.slots, false)}
                      className="flex-1 rounded-xl text-[10px] uppercase font-black"
                    >
                      Apply to {DAYS.find((d) => d.id === selectedDay)?.label} Only
                    </Button>
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => handleApplyTemplate(tmpl.slots, true)}
                      className="flex-1 rounded-xl text-[10px] uppercase font-black"
                    >
                      Apply to Entire Week
                    </Button>
                  </div>
                </div>
              ))}
            </div>

            <Button variant="ghost" onClick={() => setShowTemplateModal(false)} className="w-full rounded-xl">
              Close
            </Button>
          </div>
        </div>
      )}

      {/* Confirm Delete */}
      <ConfirmModal
        open={!!deleteSlotId}
        title="Delete Routine Slot"
        message="Are you sure you want to remove this time block from your schedule?"
        confirmLabel="Delete"
        variant="danger"
        onConfirm={() => handleDeleteSlot(deleteSlotId)}
        onCancel={() => setDeleteSlotId(null)}
      />
    </div>
  );
}

// ── Slot Modal Editor Component ──
function SlotEditorModal({ slot, habits, onSave, onClose }) {
  const [title, setTitle] = useState(slot.title || "");
  const [startTime, setStartTime] = useState(slot.startTime || "09:00");
  const [endTime, setEndTime] = useState(slot.endTime || "10:00");
  const [category, setCategory] = useState(slot.category || "Personal");
  const [color, setColor] = useState(slot.color || "indigo");
  const [linkedHabitId, setLinkedHabitId] = useState(slot.linkedHabitId || "");
  const [notes, setNotes] = useState(slot.notes || "");

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!title.trim()) return;
    onSave({
      ...slot,
      title: title.trim(),
      startTime,
      endTime,
      category,
      color,
      linkedHabitId: linkedHabitId || null,
      notes: notes.trim(),
    });
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-md flex items-center justify-center z-[150] p-4 animate-in fade-in">
      <div className="glass-card w-full max-w-md p-6 rounded-[2rem] border-white/10 relative">
        <h3 className="text-xl font-bold text-text-primary flex items-center gap-2 mb-6">
          <Icon name="edit-3" size={20} className="text-accent" />
          {slot.id ? "Edit Time Slot" : "Add Time Slot"}
        </h3>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-[10px] font-black uppercase tracking-widest text-text-secondary block mb-1">
              Routine Title
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Football Practice, Deep Work, Reading"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full bg-bg-main border border-border-color p-3 rounded-xl text-sm outline-none focus:border-accent text-text-primary"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] font-black uppercase tracking-widest text-text-secondary block mb-1">Start Time</label>
              <input
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="w-full bg-bg-main border border-border-color p-3 rounded-xl text-sm outline-none focus:border-accent text-text-primary font-mono"
              />
            </div>
            <div>
              <label className="text-[10px] font-black uppercase tracking-widest text-text-secondary block mb-1">End Time</label>
              <input
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className="w-full bg-bg-main border border-border-color p-3 rounded-xl text-sm outline-none focus:border-accent text-text-primary font-mono"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] font-black uppercase tracking-widest text-text-secondary block mb-1">Category</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full bg-bg-main border border-border-color p-3 rounded-xl text-sm outline-none focus:border-accent text-text-primary"
              >
                {CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-[10px] font-black uppercase tracking-widest text-text-secondary block mb-1">Linked Habit Node</label>
              <select
                value={linkedHabitId}
                onChange={(e) => setLinkedHabitId(e.target.value)}
                className="w-full bg-bg-main border border-border-color p-3 rounded-xl text-sm outline-none focus:border-accent text-text-primary"
              >
                <option value="">(None)</option>
                {(habits || []).map((h) => (
                  <option key={h.id} value={h.id}>{h.emoji ? `${h.emoji} ` : ""}{h.name}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Color Palette */}
          <div>
            <label className="text-[10px] font-black uppercase tracking-widest text-text-secondary block mb-2">Color Theme</label>
            <div className="flex gap-2 flex-wrap">
              {COLOR_PALETTE.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setColor(c.id)}
                  style={{ backgroundColor: c.hex }}
                  className={`w-7 h-7 rounded-xl transition-all ${color === c.id ? "scale-125 border-2 border-white shadow-lg" : "opacity-60 hover:opacity-100"}`}
                />
              ))}
            </div>
          </div>

          <div>
            <label className="text-[10px] font-black uppercase tracking-widest text-text-secondary block mb-1">Notes / Objectives</label>
            <textarea
              rows={2}
              placeholder="Optional notes or goals for this slot..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full bg-bg-main border border-border-color p-3 rounded-xl text-sm outline-none focus:border-accent text-text-primary resize-none"
            />
          </div>

          <div className="flex gap-3 pt-4">
            <Button variant="ghost" type="button" onClick={onClose} className="flex-1 rounded-xl">
              Cancel
            </Button>
            <Button variant="primary" type="submit" className="flex-1 rounded-xl shadow-lg">
              Save Slot
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

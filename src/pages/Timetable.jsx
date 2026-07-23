import React, { useState, useMemo, useEffect } from "react";
import Icon from "../components/Icon";
import { Card } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { ConfirmModal } from "../components/Modals";
import { useAuth } from "../contexts/AuthContext";

// ── Days ─────────────────────────────────────────────────────────────────────
const DAYS = [
  { id: 1, label: "Mon", full: "Monday" },
  { id: 2, label: "Tue", full: "Tuesday" },
  { id: 3, label: "Wed", full: "Wednesday" },
  { id: 4, label: "Thu", full: "Thursday" },
  { id: 5, label: "Fri", full: "Friday" },
  { id: 6, label: "Sat", full: "Saturday" },
  { id: 0, label: "Sun", full: "Sunday" },
];

// ── Colors — exact same system and number of colors as Notes page ─────────────
const SLOT_COLORS = [
  { id: "default",     colorClass: "var(--card-bg)" },
  { id: "blue",        colorClass: "rgba(59, 130, 246, 0.2)" },
  { id: "emerald",     colorClass: "rgba(16, 185, 129, 0.2)" },
  { id: "amber",       colorClass: "rgba(245, 158, 11, 0.2)" },
  { id: "rose",        colorClass: "rgba(244, 63, 94, 0.2)" },
  { id: "purple",      colorClass: "rgba(168, 85, 247, 0.2)" },
];

const colorStyle = (colorId) => {
  const c = SLOT_COLORS.find((x) => x.id === colorId);
  return c ? c.colorClass : "var(--card-bg)";
};

// ── SlotRow — the visual timetable bar with direct inputs ────────────────────
function SlotRow({ slot, onUpdate, onDelete }) {
  const [showColorPicker, setShowColorPicker] = useState(false);

  const update = (patch) => onUpdate({ ...slot, ...patch });
  return (
    <div
      className={`group relative rounded-2xl border border-border-color/60 transition-all hover:border-text-secondary`}
      style={{ backgroundColor: colorStyle(slot.color) }}
    >
      {/* Main content row */}
      <div className="flex items-center gap-3 px-4 py-3 flex-wrap sm:flex-nowrap">
        {/* Color picker circle */}
        <div className="relative shrink-0">
          <button
            onClick={() => setShowColorPicker((v) => !v)}
            title="Change color"
            className={`w-6 h-6 rounded-full border border-border-color transition-all hover:scale-110`}
            style={{ backgroundColor: colorStyle(slot.color) === "var(--card-bg)" ? "var(--border-color)" : colorStyle(slot.color) }}
          />
          {showColorPicker && (
            <div
              className="absolute left-0 top-7 z-30 bg-bg-sidebar border border-border-color rounded-2xl p-2.5 flex gap-1.5 shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              {SLOT_COLORS.map((c) => (
                <button
                  key={c.id}
                  onClick={() => { update({ color: c.id }); setShowColorPicker(false); }}
                  className={`w-5 h-5 rounded-full border-2 transition-all hover:scale-110 ${slot.color === c.id ? "border-accent scale-125" : "border-border-color"}`}
                  style={{ backgroundColor: c.colorClass === "var(--card-bg)" ? "var(--border-color)" : c.colorClass }}
                />
              ))}
            </div>
          )}
        </div>

        {/* Inputs directly accessible */}
        <div className="flex-1 min-w-0 space-y-1">
          <input
            type="text"
            value={slot.title || ""}
            onChange={(e) => update({ title: e.target.value })}
            placeholder="Activity Name (e.g. Study, Sleep)"
            className={`w-full bg-transparent border-none text-sm font-bold placeholder:text-text-secondary/30 outline-none ${isWhite ? "text-black" : "text-text-primary"}`}
          />
          <input
            type="text"
            value={slot.notes || ""}
            onChange={(e) => update({ notes: e.target.value })}
            placeholder="Add description / details…"
            className={`w-full bg-transparent border-none text-[10px] placeholder:text-text-secondary/20 outline-none ${isWhite ? "text-black/60" : "text-text-secondary"}`}
          />
        </div>

        {/* Direct native time inputs */}
        <div className="flex items-center gap-1.5 shrink-0">
          <input
            type="time"
            value={slot.startTime || "09:00"}
            onChange={(e) => update({ startTime: e.target.value })}
            className={`bg-bg-main border border-border-color/60 rounded-lg px-2 py-1 text-[10px] font-mono outline-none focus:border-accent text-center cursor-pointer ${isWhite ? "text-black" : "text-text-primary"}`}
          />
          <span className="text-text-secondary text-[9px]">–</span>
          <input
            type="time"
            value={slot.endTime || "10:00"}
            onChange={(e) => update({ endTime: e.target.value })}
            className={`bg-bg-main border border-border-color/60 rounded-lg px-2 py-1 text-[10px] font-mono outline-none focus:border-accent text-center cursor-pointer ${isWhite ? "text-black" : "text-text-primary"}`}
          />
        </div>

        {/* Delete button */}
        <button
          onClick={() => onDelete(slot.id)}
          className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all opacity-0 group-hover:opacity-100 shrink-0 ${isWhite ? "text-black/60 hover:text-red-500 hover:bg-black/5" : "text-text-secondary hover:text-danger hover:bg-danger/10"}`}
        >
          <Icon name="trash" size={13} />
        </button>
      </div>

      {/* Backdrop to close picker */}
      {showColorPicker && (
        <div className="fixed inset-0 z-20" onClick={() => setShowColorPicker(false)} />
      )}
    </div>
  );
}

// ── Main Timetable Page ───────────────────────────────────────────────────────
export default function Timetable() {
  const { timetable, updateTimetable } = useAuth();

  const realTodayDay = new Date().getDay();
  const [selectedDay, setSelectedDay] = useState(realTodayDay);
  const [deleteSlotId, setDeleteSlotId] = useState(null);
  const [currentTime, setCurrentTime] = useState(new Date());

  // Copy Day state
  const [showCopyDialog, setShowCopyDialog] = useState(false);
  const [copyTargetDays, setCopyTargetDays] = useState([]);

  useEffect(() => {
    const t = setInterval(() => setCurrentTime(new Date()), 10000);
    return () => clearInterval(t);
  }, []);

  // Build weekly map from flat array
  const weeklyMap = useMemo(() => {
    const map = { 0: [], 1: [], 2: [], 3: [], 4: [], 5: [], 6: [] };
    (timetable || []).forEach((s) => {
      const d = s.dayOfWeek ?? 1;
      if (map[d]) map[d].push(s);
    });
    // Sort each day by start time
    Object.keys(map).forEach((d) => {
      map[d].sort((a, b) => (a.startTime || "").localeCompare(b.startTime || ""));
    });
    return map;
  }, [timetable]);

  const todaySlots = weeklyMap[selectedDay] || [];

  // Find currently active slot
  const nowM = currentTime.getHours() * 60 + currentTime.getMinutes();
  const activeSlot = selectedDay === realTodayDay
    ? todaySlots.find((s) => {
        if (!s.startTime || !s.endTime) return false;
        const [sh, sm] = s.startTime.split(":").map(Number);
        const [eh, em] = s.endTime.split(":").map(Number);
        const start = sh * 60 + sm, end = eh * 60 + em;
        return end <= start ? (nowM >= start || nowM < end) : (nowM >= start && nowM < end);
      })
    : null;

  // Flat array writer helpers
  const saveAll = (allSlots) => updateTimetable(allSlots);

  const updateSlot = (updatedSlot) => {
    const all = (timetable || []).map((s) => s.id === updatedSlot.id ? updatedSlot : s);
    saveAll(all);
  };

  const deleteSlot = async (slotId) => {
    await saveAll((timetable || []).filter((s) => s.id !== slotId));
    setDeleteSlotId(null);
  };

  const addSlot = () => {
    const newSlot = {
      id: `slot_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
      dayOfWeek: selectedDay,
      title: "",
      startTime: "09:00",
      endTime: "10:00",
      color: "default",
      notes: "",
      category: "General",
      createdBy: "user",
    };
    saveAll([...(timetable || []), newSlot]);
  };

  const handleCopyDay = () => {
    if (copyTargetDays.length === 0) return;
    const sourceSlots = (timetable || []).filter(s => (s.dayOfWeek ?? 1) === selectedDay);
    // remove existing slots on selected target days
    let updated = (timetable || []).filter(s => !copyTargetDays.includes(s.dayOfWeek ?? 1));
    // add copies to target days
    copyTargetDays.forEach(dayId => {
      sourceSlots.forEach(s => {
        updated.push({
          ...s,
          id: `slot_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
          dayOfWeek: dayId,
        });
      });
    });
    saveAll(updated);
    setShowCopyDialog(false);
    setCopyTargetDays([]);
  };

  return (
    <div className="page-fade space-y-6 pb-20">
      {/* Page header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tighter text-text-primary">Timetable</h2>
          <p className="text-text-secondary text-xs mt-1">Your weekly schedule planner. Direct inline inputs.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowCopyDialog(true)}
            disabled={todaySlots.length === 0}
            className="rounded-xl font-bold text-xs uppercase tracking-widest"
          >
            <Icon name="copy" size={13} className="mr-1.5" /> Copy Day
          </Button>
        </div>
      </div>

      {/* Active routine banner — ALWAYS present at top as requested */}
      <Card className="flex items-center gap-4 border-accent/40 bg-gradient-to-r from-accent/10 to-transparent hover:translate-y-0 hover:shadow-none min-h-[64px]">
        {activeSlot && selectedDay === realTodayDay ? (
          <>
            <div className="w-2 h-10 rounded-full bg-accent animate-pulse shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="text-[9px] font-black uppercase tracking-[0.3em] text-accent mb-0.5">Currently Active</p>
              <p className="text-base font-bold text-text-primary truncate">{activeSlot.title || "Untitled Activity"}</p>
            </div>
            <div className="text-right shrink-0">
              <p className="text-xs font-mono font-bold text-text-primary">{activeSlot.startTime} – {activeSlot.endTime}</p>
            </div>
          </>
        ) : (
          <div className="min-w-0 flex-1 py-1 flex items-center justify-between">
            <div>
              <p className="text-[9px] font-black uppercase tracking-[0.3em] text-text-secondary mb-0.5">Current Activity</p>
              <p className="text-sm font-semibold text-text-secondary italic">No activity scheduled at this hour</p>
            </div>
            <Icon name="clock" size={16} className="text-text-secondary opacity-30" />
          </div>
        )}
      </Card>

      {/* Day selector tabs */}
      <div className="flex items-center gap-1 overflow-x-auto custom-scrollbar pb-1">
        {DAYS.map((day) => {
          const isActive = selectedDay === day.id;
          const isToday  = realTodayDay === day.id;
          const count    = weeklyMap[day.id]?.length || 0;
          return (
            <button
              key={day.id}
              onClick={() => setSelectedDay(day.id)}
              className={`flex flex-col items-center px-4 py-2.5 rounded-xl border transition-all whitespace-nowrap ${
                isActive
                  ? "bg-accent text-bg-main border-accent shadow-sm"
                  : "bg-bg-main border-border-color text-text-secondary hover:text-text-primary hover:border-text-secondary"
              }`}
            >
              <span className="text-[10px] font-black uppercase tracking-widest">{day.label}</span>
              <div className="flex items-center gap-1 mt-0.5">
                {isToday && <div className={`w-1 h-1 rounded-full ${isActive ? "bg-bg-main/70" : "bg-accent"}`} />}
                {count > 0 && (
                  <span className={`text-[8px] font-mono ${isActive ? "text-bg-main/70" : "text-text-secondary"}`}>
                    {count}
                  </span>
                )}
              </div>
            </button>
          );
        })}
      </div>

      {/* Timetable blocks for selected day */}
      <div className="space-y-2">
        {todaySlots.length === 0 ? (
          <div className="py-16 text-center border border-dashed border-border-color rounded-2xl">
            <Icon name="clock" size={28} className="text-text-secondary/30 mx-auto mb-3" />
            <p className="text-xs font-bold text-text-secondary">No routine blocks for {DAYS.find((d) => d.id === selectedDay)?.full}.</p>
            <p className="text-[10px] text-text-secondary/60 mt-1">Add a time block below to construct your routine.</p>
          </div>
        ) : (
          todaySlots.map((slot) => (
            <SlotRow
              key={slot.id}
              slot={slot}
              onUpdate={updateSlot}
              onDelete={(id) => setDeleteSlotId(id)}
            />
          ))
        )}
      </div>

      {/* Add block button */}
      <button
        onClick={addSlot}
        className="w-full py-3 rounded-2xl border border-dashed border-border-color bg-bg-main text-[10px] font-bold uppercase tracking-widest text-text-secondary hover:text-text-primary hover:border-text-secondary transition-all flex items-center justify-center gap-2"
      >
        <Icon name="plus" size={14} />
        Add time block
      </button>

      {/* Copy Day Modal Dialog */}
      {showCopyDialog && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center z-[150] p-4 animate-in fade-in">
          <Card className="w-full max-w-sm p-6 space-y-4">
            <div>
              <h3 className="text-base font-bold text-text-primary uppercase tracking-wider">Copy Schedule</h3>
              <p className="text-[10px] text-text-secondary uppercase tracking-[0.2em] font-mono mt-0.5">
                Copy {DAYS.find(d => d.id === selectedDay)?.full}'s schedule to:
              </p>
            </div>
            <div className="grid grid-cols-2 gap-2 py-2">
              {DAYS.filter(d => d.id !== selectedDay).map((day) => {
                const isSelected = copyTargetDays.includes(day.id);
                return (
                  <button
                    key={day.id}
                    onClick={() => {
                      setCopyTargetDays(prev =>
                        isSelected ? prev.filter(x => x !== day.id) : [...prev, day.id]
                      );
                    }}
                    className={`py-2 px-3 border rounded-xl text-left text-xs font-bold transition-all flex items-center justify-between ${
                      isSelected
                        ? "bg-accent border-accent text-bg-main shadow-sm"
                        : "bg-bg-main border-border-color text-text-secondary hover:border-text-secondary"
                    }`}
                  >
                    <span>{day.full}</span>
                    {isSelected && <Icon name="check" size={12} />}
                  </button>
                );
              })}
            </div>
            <div className="flex gap-2 pt-2 border-t border-border-color/50">
              <Button
                variant="outline"
                size="sm"
                onClick={() => { setShowCopyDialog(false); setCopyTargetDays([]); }}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={handleCopyDay}
                disabled={copyTargetDays.length === 0}
                className="flex-1"
              >
                Confirm Copy
              </Button>
            </div>
          </Card>
        </div>
      )}

      <ConfirmModal
        open={!!deleteSlotId}
        title="Remove Block"
        message="Remove this time block from your routine?"
        confirmLabel="Remove"
        variant="danger"
        onConfirm={() => deleteSlot(deleteSlotId)}
        onCancel={() => setDeleteSlotId(null)}
      />
    </div>
  );
}

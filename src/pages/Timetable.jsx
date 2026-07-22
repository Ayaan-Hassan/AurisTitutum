import React, { useState, useMemo, useEffect, useRef } from "react";
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

// ── Colors — same system as Notes page ───────────────────────────────────────
const SLOT_COLORS = [
  { id: "default", colorClass: "var(--card-bg)",              rgba: "rgba(255,255,255,0.05)" },
  { id: "blue",    colorClass: "rgba(59,  130, 246, 0.18)",   rgba: "rgba(59,130,246,0.18)" },
  { id: "emerald", colorClass: "rgba(16,  185, 129, 0.18)",   rgba: "rgba(16,185,129,0.18)" },
  { id: "amber",   colorClass: "rgba(245, 158, 11,  0.18)",   rgba: "rgba(245,158,11,0.18)" },
  { id: "rose",    colorClass: "rgba(244, 63,  94,  0.18)",   rgba: "rgba(244,63,94,0.18)" },
  { id: "purple",  colorClass: "rgba(168, 85,  247, 0.18)",   rgba: "rgba(168,85,247,0.18)" },
  { id: "cyan",    colorClass: "rgba(6,   182, 212, 0.18)",   rgba: "rgba(6,182,212,0.18)" },
  { id: "orange",  colorClass: "rgba(249, 115, 22,  0.18)",   rgba: "rgba(249,115,22,0.18)" },
];

const colorStyle = (colorId) =>
  SLOT_COLORS.find((c) => c.id === colorId)?.colorClass || SLOT_COLORS[0].colorClass;

// ── Inline editable time field ────────────────────────────────────────────────
function InlineTimeInput({ value, onChange }) {
  const [editing, setEditing] = useState(false);
  const inputRef = useRef(null);

  useEffect(() => {
    if (editing && inputRef.current) inputRef.current.focus();
  }, [editing]);

  const fmt = (t) => {
    if (!t) return "--:--";
    try {
      const [h, m] = t.split(":");
      const d = new Date();
      d.setHours(Number(h), Number(m));
      return d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true });
    } catch { return t; }
  };

  if (editing) {
    return (
      <input
        ref={inputRef}
        type="time"
        value={value || ""}
        onChange={(e) => onChange(e.target.value)}
        onBlur={() => setEditing(false)}
        className="w-20 bg-bg-main border border-accent/60 rounded-lg px-2 py-0.5 text-[10px] font-mono text-text-primary outline-none focus:border-accent text-center"
      />
    );
  }

  return (
    <button
      onClick={() => setEditing(true)}
      title="Click to change time"
      className="text-[10px] font-mono font-bold text-text-secondary hover:text-text-primary hover:underline transition-colors cursor-pointer"
    >
      {fmt(value)}
    </button>
  );
}

// ── Inline editable text field ────────────────────────────────────────────────
function InlineTextInput({ value, onChange, placeholder = "Untitled", className = "" }) {
  const [editing, setEditing] = useState(false);
  const [draft,   setDraft]   = useState(value || "");
  const inputRef = useRef(null);

  useEffect(() => {
    if (editing) {
      setDraft(value || "");
      if (inputRef.current) inputRef.current.focus();
    }
  }, [editing, value]);

  const commit = () => {
    setEditing(false);
    if (draft.trim() !== value) onChange(draft.trim() || placeholder);
  };

  if (editing) {
    return (
      <input
        ref={inputRef}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === "Escape") commit(); }}
        className={`bg-bg-main/60 border border-accent/60 rounded-lg px-2 py-0.5 text-sm font-bold text-text-primary outline-none focus:border-accent w-full ${className}`}
      />
    );
  }

  return (
    <button
      onClick={() => setEditing(true)}
      title="Click to edit"
      className={`text-left font-bold text-text-primary hover:text-accent transition-colors cursor-pointer truncate max-w-full ${className}`}
    >
      {value || <span className="text-text-secondary italic font-normal">{placeholder}</span>}
    </button>
  );
}

// ── SlotRow — the visual timetable bar ────────────────────────────────────────
function SlotRow({ slot, onUpdate, onDelete }) {
  const [showColorPicker, setShowColorPicker] = useState(false);

  const update = (patch) => onUpdate({ ...slot, ...patch });

  return (
    <div
      className="group relative rounded-2xl border border-border-color/60 overflow-hidden transition-all hover:border-border-color"
      style={{ backgroundColor: colorStyle(slot.color) }}
    >
      {/* Main content row */}
      <div className="flex items-center gap-3 px-4 py-3">
        {/* Colored left accent + color picker trigger */}
        <div className="relative shrink-0">
          <button
            onClick={() => setShowColorPicker((v) => !v)}
            title="Change color"
            className="w-3 h-3 rounded-full border-2 border-border-color/60 hover:scale-125 transition-all"
            style={{ backgroundColor: colorStyle(slot.color) === "var(--card-bg)" ? "var(--border-color)" : colorStyle(slot.color) }}
          />
          {showColorPicker && (
            <div
              className="absolute left-0 top-5 z-20 bg-bg-sidebar border border-border-color rounded-2xl p-2.5 flex gap-1.5 shadow-xl"
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

        {/* Title — inline editable */}
        <div className="flex-1 min-w-0">
          <InlineTextInput
            value={slot.title}
            onChange={(v) => update({ title: v })}
            placeholder="Activity name"
            className="text-sm"
          />
          {slot.notes && (
            <p className="text-[10px] text-text-secondary mt-0.5 truncate">{slot.notes}</p>
          )}
        </div>

        {/* Time range — inline editable */}
        <div className="flex items-center gap-1.5 shrink-0">
          <InlineTimeInput value={slot.startTime} onChange={(v) => update({ startTime: v })} />
          <span className="text-text-secondary text-[9px]">–</span>
          <InlineTimeInput value={slot.endTime} onChange={(v) => update({ endTime: v })} />
        </div>

        {/* Delete (hover) */}
        <button
          onClick={() => onDelete(slot.id)}
          className="w-7 h-7 rounded-lg flex items-center justify-center text-text-secondary hover:text-danger hover:bg-danger/10 transition-all opacity-0 group-hover:opacity-100 shrink-0"
        >
          <Icon name="trash" size={13} />
        </button>
      </div>

      {/* Close picker on outside click */}
      {showColorPicker && (
        <div className="fixed inset-0 z-10" onClick={() => setShowColorPicker(false)} />
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

  return (
    <div className="page-fade space-y-6 pb-20">
      {/* Page header */}
      <div>
        <h2 className="text-2xl font-bold tracking-tighter text-text-primary">Timetable</h2>
        <p className="text-text-secondary text-xs mt-1">Your weekly routine — click any field to edit it directly.</p>
      </div>

      {/* Active routine banner (today only) */}
      {activeSlot && selectedDay === realTodayDay && (
        <Card className="flex items-center gap-4 border-accent/40 bg-gradient-to-r from-accent/10 to-transparent hover:translate-y-0 hover:shadow-none">
          <div className="w-2 h-10 rounded-full bg-accent animate-pulse shrink-0" />
          <div className="min-w-0 flex-1">
            <p className="text-[9px] font-black uppercase tracking-[0.3em] text-accent mb-0.5">Currently Active</p>
            <p className="text-base font-bold text-text-primary truncate">{activeSlot.title}</p>
          </div>
          <div className="text-right shrink-0">
            <p className="text-xs font-mono font-bold text-text-primary">{activeSlot.startTime} – {activeSlot.endTime}</p>
          </div>
        </Card>
      )}

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
            <p className="text-[10px] text-text-secondary/60 mt-1">Click the button below to start building your day.</p>
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

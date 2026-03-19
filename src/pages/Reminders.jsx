import { useState, useEffect } from "react";
import Icon from "../components/Icon";
import { Card } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { ConfirmModal } from "../components/Modals";
import { useAuth } from "../contexts/AuthContext";
import {
  requestNotificationPermission,
  subscribeUserToPush,
  scheduleAllReminders,
  scheduleInBrowserReminders,
  registerScheduledReminder,
  unregisterScheduledReminder,
} from "../services/pushNotifications";
import { trackEvent } from "../utils/telemetry";

const getTodayStr = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
};

const getNowHHMM = () => {
  const now = new Date();
  return `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
};

const formatDateTime = (date, time) => {
  try {
    const d = new Date(`${date}T${time}`);
    return d.toLocaleString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: true });
  } catch { return `${date} ${time}`; }
};

const formatTimeOnly = (time) => {
  try {
    const [hh, mm] = time.split(":");
    const d = new Date(); d.setHours(Number(hh), Number(mm));
    return d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true });
  } catch { return time; }
};

const REPEAT_LABELS = { none: "One-time", daily: "Daily", weekly: "Weekly" };

const isReminderPast = (r) => {
  if (r.repeat !== "none") return false;
  if (r.done) return true;
  const today = getTodayStr(), now = getNowHHMM();
  if (r.date < today) return true;
  if (r.date === today && r.time <= now) return true; // Changed to <= for instant completion
  return false;
};

// ─── Reminder Form (shared for Add and Edit) ─────────────────────────────────
const ReminderForm = ({ initial = {}, onSave, onCancel, title: formTitle }) => {
  const [title, setTitle] = useState(initial.title || "");
  const [notes, setNotes] = useState(initial.notes || "");
  const [date, setDate] = useState(initial.date || getTodayStr());
  const [time, setTime] = useState(initial.time || "09:00");
  const [repeat, setRepeat] = useState(initial.repeat || "none");

  const canSave = title.trim().length > 0;

  return (
    <Card className="relative overflow-hidden">
      <div className="absolute -top-16 -right-16 w-36 h-36 bg-accent/5 rounded-full blur-[70px] pointer-events-none" />
      <div className="relative z-10">
        <div className="mb-5">
          <h3 className="text-base font-bold tracking-tight text-text-primary uppercase">{formTitle}</h3>
          <p className="text-[10px] text-text-secondary uppercase tracking-[0.2em] mt-0.5 font-mono">Configure alert parameters</p>
        </div>

        <div className="space-y-4">
          {/* Title */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-black text-text-secondary uppercase tracking-[0.3em] ml-0.5">Reminder Title</label>
            <input
              type="text"
              placeholder="e.g. Take medication, Call mom…"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && canSave && onSave({ title, notes, date, time, repeat })}
              autoFocus
              className="w-full bg-bg-main border border-border-color p-3.5 rounded-xl outline-none focus:border-accent text-sm text-text-primary transition-all placeholder:text-text-secondary/40"
            />
          </div>

          {/* Notes */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-black text-text-secondary uppercase tracking-[0.3em] ml-0.5">
              Notes <span className="font-normal normal-case tracking-normal opacity-60">(optional)</span>
            </label>
            <input
              type="text"
              placeholder="Additional context…"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full bg-bg-main border border-border-color p-3.5 rounded-xl outline-none focus:border-accent text-sm text-text-primary transition-all placeholder:text-text-secondary/40"
            />
          </div>

          {/* Date + Time */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-text-secondary uppercase tracking-[0.3em] ml-0.5">Date</label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full bg-bg-main border border-border-color p-3.5 rounded-xl outline-none focus:border-accent text-sm text-text-primary transition-all cursor-pointer"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-text-secondary uppercase tracking-[0.3em] ml-0.5">Time</label>
              <input
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                className="w-full bg-bg-main border border-border-color p-3.5 rounded-xl outline-none focus:border-accent text-sm text-text-primary transition-all cursor-pointer"
              />
            </div>
          </div>

          {/* Repeat */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-black text-text-secondary uppercase tracking-[0.3em] ml-0.5">Repeat</label>
            <div className="grid grid-cols-3 gap-2">
              {Object.entries(REPEAT_LABELS).map(([val, label]) => (
                <button
                  key={val} type="button" onClick={() => setRepeat(val)}
                  className={`py-2.5 rounded-xl text-[10px] font-bold uppercase tracking-[0.2em] border transition-all ${repeat === val ? "bg-accent text-bg-main border-accent" : "bg-bg-main border-border-color text-text-secondary hover:border-text-secondary hover:bg-accent-dim"}`}
                >{label}</button>
              ))}
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3">
            <button
              onClick={onCancel}
              className="flex-1 py-3 rounded-xl border border-border-color text-text-secondary text-[11px] font-black uppercase tracking-[0.25em] hover:text-text-primary hover:border-text-secondary transition-all"
            >
              Cancel
            </button>
            <button
              onClick={() => onSave({ title: title.trim(), notes: notes.trim(), date, time, repeat })}
              disabled={!canSave}
              className="flex-1 py-3 bg-accent text-bg-main text-[11px] font-black uppercase tracking-[0.25em] rounded-xl hover:opacity-90 active:scale-[0.99] transition-all shadow-lg disabled:opacity-30"
            >
              {formTitle === "Edit Reminder" ? "Save Changes" : "Set Reminder"}
            </button>
          </div>
        </div>
      </div>
    </Card>
  );
};

// ─── Single Reminder Card ─────────────────────────────────────────────────────
const ReminderCard = ({ reminder, onDelete, onEdit, onMarkDone }) => {
  const past = isReminderPast(reminder);
  const repeat = reminder.repeat || "none";
  const isWhite = !!reminder.adminCreated;

  return (
    <div className={`flex items-start justify-between gap-3 p-4 rounded-2xl border transition-all group ${past ? "bg-bg-main/40 border-border-color opacity-60" : isWhite ? "bg-white border-white shadow-[0_0_15px_rgba(255,255,255,0.3)] scale-[1.01]" : "bg-card-bg border-border-color hover:border-text-secondary"}`}>
      <div className="flex items-start gap-3 min-w-0 flex-1">
        <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 mt-0.5 border ${past ? "bg-bg-main border-border-color" : isWhite ? "bg-black/5 border-black/10" : "bg-accent-dim border-border-color"}`}>
          <Icon name={past ? "check-circle" : "bell"} size={15} className={past ? "text-text-secondary" : isWhite ? "text-black" : "text-text-primary"} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap mb-0.5">
            <p className={`text-sm font-bold ${past ? "text-text-secondary line-through" : isWhite ? "text-black" : "text-text-primary"}`}>{reminder.title}</p>
            {repeat !== "none" && (
              <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded border ${isWhite ? "bg-black text-white border-black" : "bg-accent-dim text-text-secondary border-border-color"}`}>{REPEAT_LABELS[repeat]}</span>
            )}
            {past && !reminder.done && (
              <span className="text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded bg-bg-sidebar text-text-secondary border border-border-color">Past</span>
            )}
            {reminder.done && (
              <span className="text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded bg-success/10 text-success border border-success/30">Done</span>
            )}
            {reminder.adminCreated && (
                <span className="text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded bg-black text-white border-black">Admin Alert</span>
            )}
          </div>
          {reminder.notes && <p className={`text-xs truncate mb-0.5 ${isWhite ? "text-black/70 font-medium" : "text-text-secondary"}`}>{reminder.notes}</p>}
          <p className={`text-[10px] font-mono uppercase tracking-wider ${isWhite ? "text-black/50" : "text-text-secondary"}`}>
            {repeat === "daily" ? `Every day at ${formatTimeOnly(reminder.time)}`
              : repeat === "weekly" ? `Every week (${new Date(reminder.date + "T12:00:00").toLocaleDateString("en-US", { weekday: "long" })}) at ${formatTimeOnly(reminder.time)}`
                : formatDateTime(reminder.date, reminder.time)}
          </p>
        </div>
      </div>

      {/* Action buttons (visible on hover) */}
      <div className="flex items-center gap-1.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
        {past && !reminder.done && onMarkDone && (
          <button
            onClick={() => onMarkDone(reminder.id)}
            className="w-8 h-8 rounded-lg border border-success/40 bg-success/10 flex items-center justify-center text-success hover:bg-success/20 transition-all"
            title="Mark as done"
          >
            <Icon name="check" size={13} />
          </button>
        )}
        {!past && onEdit && (
          <button
            onClick={() => onEdit(reminder)}
            className="w-8 h-8 rounded-lg border border-border-color bg-bg-main flex items-center justify-center text-text-secondary hover:text-text-primary hover:border-text-secondary transition-all"
            title="Edit reminder"
          >
            <Icon name="pencil" size={12} />
          </button>
        )}
        <button
          onClick={() => onDelete(reminder.id)}
          className="w-8 h-8 rounded-lg border border-border-color bg-bg-main flex items-center justify-center text-text-secondary hover:text-red-400 hover:border-red-400/50 transition-all"
          title="Delete reminder"
        >
          <Icon name="trash" size={13} />
        </button>
      </div>
    </div>
  );
};

// ─── Main Reminders Page ──────────────────────────────────────────────────────
const Reminders = ({ reminders, setReminders, setFeatureLockConfig }) => {
  const { user, upsertReminder, deleteReminder: remoteDeleteReminder } = useAuth();
  const [showAdd, setShowAdd] = useState(false);
  const [editTarget, setEditTarget] = useState(null); // reminder object being edited
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [notifPermission, setNotifPermission] = useState("default");

  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (typeof Notification !== "undefined") setNotifPermission(Notification.permission);
    // Periodically force re-render to sync 'past' status instantly when time matches
    const timer = setInterval(() => setTick(t => t + 1), 10000); 
    return () => clearInterval(timer);
  }, []);

  // Request notification permission in background (non-blocking)
  const requestPermissionInBackground = async () => {
    if (typeof Notification === "undefined" || Notification.permission !== "default") return;
    try {
      const result = await requestNotificationPermission();
      setNotifPermission(result);
      if (result === "granted" && user) await subscribeUserToPush(user);
    } catch { /* ignore */ }
  };

  // Sync all reminders to Firestore
  useEffect(() => {
    if (notifPermission !== "granted" || !user) return;
    scheduleAllReminders(reminders, user);
  }, [reminders, notifPermission, user]);

  // In-browser fallbacks
  useEffect(() => {
    if (notifPermission !== "granted" || !user) return;
    const cleanup = scheduleInBrowserReminders(reminders);
    return cleanup;
  }, [reminders, notifPermission, user]);


  const handleAdd = async (data) => {
    const reminder = {
      id: Date.now().toString(),
      ...data,
      done: false,
      createdAt: new Date().toISOString(),
    };
    
    if (user) {
      await upsertReminder(reminder);
      try { await registerScheduledReminder(user.uid, reminder); } catch (err) { console.error(err); }
    } else {
      setReminders((prev) => [...prev, reminder]);
    }

    trackEvent("reminder_created", { repeat: data.repeat });
    requestPermissionInBackground();
    setShowAdd(false); // Close form instantly to prevent duplicate submissions
  };

  const handleEdit = async (data) => {
    if (!editTarget) return;
    const updated = { ...editTarget, ...data, updatedAt: new Date().toISOString() };
    
    if (user) {
      await upsertReminder(updated);
      try {
        await unregisterScheduledReminder(user.uid, editTarget.id);
        await registerScheduledReminder(user.uid, updated);
      } catch (err) { console.error(err); }
    } else {
      setReminders((prev) => prev.map((r) => r.id === editTarget.id ? updated : r));
    }
    setEditTarget(null);
  };

  const handleDelete = (id) => setDeleteTarget(id);
  const confirmDelete = async () => {
    if (!deleteTarget) return;
    if (user) { 
      await remoteDeleteReminder(deleteTarget);
      try { await unregisterScheduledReminder(user.uid, deleteTarget); } catch (err) { console.error(err); } 
    } else {
      setReminders((prev) => prev.filter((r) => r.id !== deleteTarget));
    }
    trackEvent("reminder_deleted");
    setDeleteTarget(null);
  };

  const handleMarkDone = async (id) => {
    const reminder = reminders.find(r => r.id === id);
    if (!reminder) return;
    const updated = { ...reminder, done: true };
    if (user) {
      await upsertReminder(updated);
    } else {
      setReminders((prev) => prev.map((r) => r.id === id ? updated : r));
    }
  };

  // Sort: upcoming (not past) sorted by date/time, then past (most recent first)
  const upcoming = [...reminders]
    .filter((r) => !isReminderPast(r))
    .sort((a, b) => `${a.date}${a.time}`.localeCompare(`${b.date}${b.time}`));

  const past = [...reminders]
    .filter((r) => isReminderPast(r))
    .sort((a, b) => `${b.date}${b.time}`.localeCompare(`${a.date}${a.time}`));

  return (
    <div className="page-fade space-y-8 pb-20">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tighter text-text-primary">Set Reminders</h2>
          <p className="text-text-secondary text-sm mt-1">Schedule time-based alerts and receive notifications when it matters.</p>
        </div>
        <button
          onClick={() => {
             if (showAdd) {
                 setShowAdd(false); setEditTarget(null);
             } else if (!user && reminders.length >= 2) {
                 setFeatureLockConfig({
                    title: "Unlock full console",
                    subtitle: "Sign in for free to unlock this feature.",
                    description: "You've reached the guest limit of 2 reminders. Sign in for free to create unlimited alerts, enable push notifications, and sync across all your devices."
                 });
             } else {
                 setShowAdd(true); setEditTarget(null);
             }
          }}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-accent text-bg-main text-[11px] font-black uppercase tracking-[0.25em] hover:opacity-90 hover:scale-105 active:scale-95 transition-all h-10"
        >
          <Icon name={showAdd ? "x" : "plus"} size={14} />
          {showAdd ? "Cancel" : "New Reminder"}
        </button>
      </div>

      {/* Notification permission banner */}
      {notifPermission !== "granted" && (
        <div className="flex items-center gap-3 p-3.5 rounded-xl bg-accent-dim border border-border-color">
          <Icon name="bell" size={15} className="text-text-secondary shrink-0" />
          <p className="text-[11px] text-text-secondary leading-relaxed flex-1">
            {notifPermission === "denied"
              ? "Browser notifications are blocked. Enable them in your browser settings to receive alerts."
              : "Enable browser notifications to get alerted at the right time."}
          </p>
          {notifPermission === "default" && (
            <button
              onClick={requestPermissionInBackground}
              className="px-3 py-1.5 rounded-lg bg-accent text-bg-main text-[10px] font-bold uppercase tracking-widest shrink-0"
            >
              Enable
            </button>
          )}
        </div>
      )}

      {/* Add form */}
      {showAdd && !editTarget && (
        <ReminderForm
          title="New Reminder"
          onSave={handleAdd}
          onCancel={() => setShowAdd(false)}
        />
      )}

      {/* Edit form */}
      {editTarget && (
        <ReminderForm
          title="Edit Reminder"
          initial={editTarget}
          onSave={handleEdit}
          onCancel={() => setEditTarget(null)}
        />
      )}

      {/* Upcoming */}
      {upcoming.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <p className="text-[10px] font-black text-text-secondary uppercase tracking-[0.3em]">Upcoming</p>
            <div className="flex-1 h-[1px] bg-border-color" />
            <span className="text-[9px] font-mono text-text-secondary bg-bg-sidebar border border-border-color px-2 py-0.5 rounded-full">{upcoming.length}</span>
          </div>
          <div className="space-y-2">
            {upcoming.map((r) => (
              <ReminderCard key={r.id} reminder={r} onDelete={handleDelete} onEdit={(rem) => { setEditTarget(rem); setShowAdd(false); }} />
            ))}
          </div>
        </div>
      )}

      {/* Past */}
      {past.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <p className="text-[10px] font-black text-text-secondary uppercase tracking-[0.3em]">Past / Done</p>
            <div className="flex-1 h-[1px] bg-border-color" />
            <span className="text-[9px] font-mono text-text-secondary bg-bg-sidebar border border-border-color px-2 py-0.5 rounded-full">{past.length}</span>
          </div>
          <div className="space-y-2">
            {past.map((r) => (
              <ReminderCard key={r.id} reminder={r} onDelete={handleDelete} onMarkDone={handleMarkDone} />
            ))}
          </div>
        </div>
      )}

      {/* Empty State */}
      {reminders.length === 0 && !showAdd && (
        <Card className="flex flex-col items-center justify-center py-20 text-center border-dashed">
          <div className="w-14 h-14 rounded-2xl bg-bg-sidebar border border-border-color flex items-center justify-center mb-5">
            <Icon name="bell" size={22} className="text-text-secondary" />
          </div>
          <p className="text-sm font-bold text-text-primary mb-1">No reminders set</p>
          <p className="text-xs text-text-secondary max-w-xs mb-6">
            Create a reminder and get notified at exactly the right time — inside the app and via your browser.
          </p>
          <button
            onClick={() => {
               if (!user && reminders.length >= 2) {
                   setFeatureLockConfig({
                       title: "Unlock full console",
                       subtitle: "Sign in for free to unlock this feature.",
                       description: "You've reached the guest limit of 2 reminders. Sign in for free to create unlimited alerts, enable push notifications, and sync across all your devices."
                   });
               } else {
                   setShowAdd(true);
               }
            }}
            className="px-6 py-2.5 rounded-xl bg-accent text-bg-main text-[10px] font-black uppercase tracking-[0.25em] hover:opacity-90 hover:scale-105 active:scale-95 transition-all"
          >
            Create First Reminder
          </button>
        </Card>
      )}

      {/* Delete Confirmation */}
      <ConfirmModal
        open={!!deleteTarget}
        title="Delete reminder"
        message="Are you sure you want to delete this reminder? This cannot be undone."
        confirmLabel="Delete"
        variant="danger"
        onConfirm={confirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />

    </div>
  );
};

export default Reminders;

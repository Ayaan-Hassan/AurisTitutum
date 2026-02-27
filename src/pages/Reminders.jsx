import { useState, useEffect } from "react";
import Icon from "../components/Icon";
import { Card } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { ConfirmModal } from "../components/Modals";

const getTodayStr = () => new Date().toISOString().split("T")[0];

const getNowHHMM = () => {
  const now = new Date();
  return `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
};

const formatDateTime = (date, time) => {
  try {
    const d = new Date(`${date}T${time}`);
    return d.toLocaleString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });
  } catch {
    return `${date} ${time}`;
  }
};

const formatTimeOnly = (time) => {
  try {
    const [hh, mm] = time.split(":");
    const d = new Date();
    d.setHours(Number(hh), Number(mm));
    return d.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });
  } catch {
    return time;
  }
};

const REPEAT_LABELS = {
  none: "One-time",
  daily: "Daily",
  weekly: "Weekly",
};

const isReminderPast = (reminder) => {
  if (reminder.repeat !== "none") return false;
  const todayStr = getTodayStr();
  const nowHHMM = getNowHHMM();
  if (reminder.date < todayStr) return true;
  if (reminder.date === todayStr && reminder.time < nowHHMM) return true;
  return false;
};

const ReminderCard = ({ reminder, onDelete }) => {
  const past = isReminderPast(reminder);
  const repeat = reminder.repeat || "none";

  return (
    <div
      className={`flex items-start justify-between gap-4 p-4 rounded-2xl border transition-all group ${
        past
          ? "bg-bg-main/40 border-border-color opacity-60"
          : "bg-card-bg border-border-color hover:border-text-secondary"
      }`}
    >
      <div className="flex items-start gap-3 min-w-0 flex-1">
        <div
          className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 mt-0.5 border ${
            past
              ? "bg-bg-main border-border-color"
              : "bg-accent-dim border-border-color"
          }`}
        >
          <Icon
            name={past ? "check-circle" : "bell"}
            size={15}
            className={past ? "text-text-secondary" : "text-text-primary"}
          />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <p
              className={`text-sm font-bold truncate ${
                past ? "text-text-secondary line-through" : "text-text-primary"
              }`}
            >
              {reminder.title}
            </p>
            {repeat !== "none" && (
              <span className="text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded bg-accent-dim text-text-secondary border border-border-color">
                {REPEAT_LABELS[repeat]}
              </span>
            )}
            {past && (
              <span className="text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded bg-bg-sidebar text-text-secondary border border-border-color">
                Past
              </span>
            )}
          </div>
          {reminder.notes && (
            <p className="text-xs text-text-secondary truncate mb-1">
              {reminder.notes}
            </p>
          )}
          <p className="text-[10px] font-mono text-text-secondary uppercase tracking-wider">
            {repeat === "daily"
              ? `Every day at ${formatTimeOnly(reminder.time)}`
              : repeat === "weekly"
                ? `Every week (${new Date(reminder.date + "T12:00:00").toLocaleDateString("en-US", { weekday: "long" })}) at ${formatTimeOnly(reminder.time)}`
                : formatDateTime(reminder.date, reminder.time)}
          </p>
        </div>
      </div>
      <button
        onClick={() => onDelete(reminder.id)}
        className="w-8 h-8 rounded-lg border border-border-color bg-bg-main flex items-center justify-center text-text-secondary hover:text-red-400 hover:border-red-400/50 transition-all opacity-0 group-hover:opacity-100 shrink-0"
        title="Delete reminder"
      >
        <Icon name="trash" size={13} />
      </button>
    </div>
  );
};

const Reminders = ({ reminders, setReminders }) => {
  const [showAdd, setShowAdd] = useState(false);
  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");
  const [date, setDate] = useState(getTodayStr);
  const [time, setTime] = useState("09:00");
  const [repeat, setRepeat] = useState("none");
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [notifPermission, setNotifPermission] = useState("default");
  const [permissionRequesting, setPermissionRequesting] = useState(false);

  // Read the actual browser permission on mount and whenever it may change
  useEffect(() => {
    if (typeof Notification !== "undefined") {
      setNotifPermission(Notification.permission);
    }
  }, []);

  const ensureNotificationPermissionForReminder = async () => {
    if (typeof Notification === "undefined") return "unsupported";
    if (Notification.permission !== "default") {
      setNotifPermission(Notification.permission);
      return Notification.permission;
    }
    setPermissionRequesting(true);
    try {
      const result = await Notification.requestPermission();
      setNotifPermission(result);
      return result;
    } catch {
      setNotifPermission("denied");
      return "denied";
    } finally {
      setPermissionRequesting(false);
    }
  };

  const handleAdd = async () => {
    if (!title.trim()) return;
    await ensureNotificationPermissionForReminder();
    const reminder = {
      id: Date.now().toString(),
      title: title.trim(),
      notes: notes.trim(),
      date,
      time,
      repeat,
      createdAt: new Date().toISOString(),
    };
    setReminders((prev) => [...prev, reminder]);
    setTitle("");
    setNotes("");
    setDate(getTodayStr());
    setTime("09:00");
    setRepeat("none");
    setShowAdd(false);
  };

  const handleDelete = (id) => setDeleteTarget(id);
  const confirmDelete = () => {
    if (deleteTarget) {
      setReminders((prev) => prev.filter((r) => r.id !== deleteTarget));
      setDeleteTarget(null);
    }
  };

  // Sort: upcoming first (by date+time), then past (most recent first)
  const upcoming = [...reminders]
    .filter((r) => !isReminderPast(r))
    .sort((a, b) => `${a.date}${a.time}`.localeCompare(`${b.date}${b.time}`));

  const past = [...reminders]
    .filter((r) => isReminderPast(r))
    .sort((a, b) => `${b.date}${b.time}`.localeCompare(`${a.date}${a.time}`));

  const minDate = getTodayStr();
  const canAdd = title.trim().length > 0;

  return (
    <div className="page-fade space-y-8 pb-20">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tighter text-text-primary">
            Set Reminders
          </h2>
          <p className="text-text-secondary text-sm mt-1">
            Schedule time-based alerts and receive notifications when it
            matters.
          </p>
        </div>
        <button
          onClick={() => setShowAdd((v) => !v)}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-accent text-bg-main text-[11px] font-black uppercase tracking-[0.25em] hover:opacity-90 hover:scale-105 active:scale-95 transition-all h-10"
        >
          <Icon name={showAdd ? "x" : "plus"} size={14} />
          {showAdd ? "Cancel" : "New Reminder"}
        </button>
      </div>

      {/* ── Add Reminder Form ── */}
      {showAdd && (
        <Card className="relative overflow-hidden">
          <div className="absolute -top-16 -right-16 w-36 h-36 bg-accent/5 rounded-full blur-[70px] pointer-events-none" />
          <div className="relative z-10">
            <div className="mb-6">
              <h3 className="text-base font-bold tracking-tight text-text-primary uppercase">
                New Reminder
              </h3>
              <p className="text-[10px] text-text-secondary uppercase tracking-[0.2em] mt-0.5 font-mono">
                Configure alert parameters
              </p>
            </div>

            <div className="space-y-5">
              {/* Title */}
              <div className="space-y-2">
                <label className="text-[10px] font-black text-text-secondary uppercase tracking-[0.3em] ml-0.5">
                  Reminder Title
                </label>
                <input
                  type="text"
                  placeholder="e.g. Take medication, Call mom, Review goals…"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && canAdd && handleAdd()}
                  autoFocus
                  className="w-full bg-bg-main border border-border-color p-4 rounded-xl outline-none focus:border-accent text-sm text-text-primary transition-all placeholder:text-text-secondary/40"
                />
              </div>

              {/* Notes (optional) */}
              <div className="space-y-2">
                <label className="text-[10px] font-black text-text-secondary uppercase tracking-[0.3em] ml-0.5">
                  Notes{" "}
                  <span className="font-normal normal-case tracking-normal opacity-60">
                    (optional)
                  </span>
                </label>
                <input
                  type="text"
                  placeholder="Additional context or instructions…"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full bg-bg-main border border-border-color p-4 rounded-xl outline-none focus:border-accent text-sm text-text-primary transition-all placeholder:text-text-secondary/40"
                />
              </div>

              {/* Date + Time */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-text-secondary uppercase tracking-[0.3em] ml-0.5">
                    Date
                  </label>
                  <input
                    type="date"
                    min={minDate}
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="w-full bg-bg-main border border-border-color p-4 rounded-xl outline-none focus:border-accent text-sm text-text-primary transition-all cursor-pointer"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-text-secondary uppercase tracking-[0.3em] ml-0.5">
                    Time
                  </label>
                  <input
                    type="time"
                    value={time}
                    onChange={(e) => setTime(e.target.value)}
                    className="w-full bg-bg-main border border-border-color p-4 rounded-xl outline-none focus:border-accent text-sm text-text-primary transition-all cursor-pointer"
                  />
                </div>
              </div>

              {/* Repeat */}
              <div className="space-y-2">
                <label className="text-[10px] font-black text-text-secondary uppercase tracking-[0.3em] ml-0.5">
                  Repeat
                </label>
                <div className="grid grid-cols-3 gap-3">
                  {Object.entries(REPEAT_LABELS).map(([val, label]) => (
                    <button
                      key={val}
                      type="button"
                      onClick={() => setRepeat(val)}
                      className={`py-3 rounded-xl text-[10px] font-bold uppercase tracking-[0.2em] border transition-all ${
                        repeat === val
                          ? "bg-accent text-bg-main border-accent"
                          : "bg-bg-main border-border-color text-text-secondary hover:border-text-secondary hover:bg-accent-dim"
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Notification notice */}
              {notifPermission !== "granted" && (
                <div className="flex items-start gap-2.5 p-3 rounded-xl bg-accent-dim border border-border-color">
                  <Icon
                    name="info"
                    size={13}
                    className="text-text-secondary mt-0.5 shrink-0"
                  />
                  <p className="text-[10px] text-text-secondary leading-relaxed">
                    {permissionRequesting
                      ? "Requesting browser notification permission..."
                      : notifPermission === "denied"
                        ? "Browser notifications are blocked. Enable them in your browser settings to receive alerts outside the app."
                        : "Notification permission will be requested when you press Set Reminder."}
                  </p>
                </div>
              )}

              {/* Submit */}
              <button
                onClick={handleAdd}
                disabled={!canAdd || permissionRequesting}
                className="w-full py-4 bg-accent text-bg-main text-[11px] font-black uppercase tracking-[0.3em] rounded-xl hover:scale-[1.01] active:scale-[0.99] transition-all shadow-lg disabled:opacity-30 disabled:hover:scale-100"
              >
                {permissionRequesting ? "Requesting..." : "Set Reminder"}
              </button>
            </div>
          </div>
        </Card>
      )}

      {/* ── Upcoming Reminders ── */}
      {upcoming.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <p className="text-[10px] font-black text-text-secondary uppercase tracking-[0.3em]">
              Upcoming
            </p>
            <div className="flex-1 h-[1px] bg-border-color" />
            <span className="text-[9px] font-mono text-text-secondary bg-bg-sidebar border border-border-color px-2 py-0.5 rounded-full">
              {upcoming.length}
            </span>
          </div>
          <div className="space-y-2">
            {upcoming.map((r) => (
              <ReminderCard key={r.id} reminder={r} onDelete={handleDelete} />
            ))}
          </div>
        </div>
      )}

      {/* ── Past Reminders ── */}
      {past.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <p className="text-[10px] font-black text-text-secondary uppercase tracking-[0.3em]">
              Past
            </p>
            <div className="flex-1 h-[1px] bg-border-color" />
            <span className="text-[9px] font-mono text-text-secondary bg-bg-sidebar border border-border-color px-2 py-0.5 rounded-full">
              {past.length}
            </span>
          </div>
          <div className="space-y-2">
            {past.map((r) => (
              <ReminderCard key={r.id} reminder={r} onDelete={handleDelete} />
            ))}
          </div>
        </div>
      )}

      {/* ── Empty State ── */}
      {reminders.length === 0 && !showAdd && (
        <Card className="flex flex-col items-center justify-center py-20 text-center border-dashed">
          <div className="w-14 h-14 rounded-2xl bg-bg-sidebar border border-border-color flex items-center justify-center mb-5">
            <Icon name="bell" size={22} className="text-text-secondary" />
          </div>
          <p className="text-sm font-bold text-text-primary mb-1">
            No reminders set
          </p>
          <p className="text-xs text-text-secondary max-w-xs mb-6">
            Create a reminder and get notified at exactly the right time —
            inside the app and via your browser.
          </p>
          <button
            onClick={() => setShowAdd(true)}
            className="px-6 py-2.5 rounded-xl bg-accent text-bg-main text-[10px] font-black uppercase tracking-[0.25em] hover:opacity-90 hover:scale-105 active:scale-95 transition-all"
          >
            Create First Reminder
          </button>
        </Card>
      )}

      {/* ── Delete Confirmation ── */}
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

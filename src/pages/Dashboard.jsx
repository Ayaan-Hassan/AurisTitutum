import React, { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import Icon from "../components/Icon";
import { Card } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import HabitPerformanceModal from "../components/HabitPerformanceModal";

// Detect plain Unicode symbols vs coloured emoji (same helper as Habits.jsx)
const isUnicodeSymbol = (ch) =>
  /^[\u25A0-\u27FF\u2190-\u21FF\u221E\u2295\u2297\u25D0\u25D1⟳◆▲▼●◯□△★✦◈⬡∞✕✓⊕⊗◐◑◇]/.test(
    ch,
  );

const Dashboard = ({ habits, logActivity, insights }) => {
  const [countInputs, setCountInputs] = useState({});
  const [calendarMonth, setCalendarMonth] = useState(() => new Date());
  const [performanceTarget, setPerformanceTarget] = useState(null);
  const performanceHabit =
    habits.find((h) => h.id === performanceTarget) || null;
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
          const isCount = typeof entry === "string" && entry.includes("|");
          const [time, value, unit] = isCount
            ? entry.split("|")
            : [entry, null, null];
          const formattedDate = new Date(day.date + "T12:00:00")
            .toLocaleDateString("en-GB", {
              day: "2-digit",
              month: "short",
              year: "numeric",
            })
            .toUpperCase();
          all.push({
            habit: h.name,
            emoji: h.emoji || "",
            type: h.type,
            date: day.date,
            formattedDate,
            time,
            value,
            unit,
          });
        });
      });
    });
    return all.sort(
      (a, b) => parseTs(b.date, b.time) - parseTs(a.date, a.time),
    );
  }, [habits]);

  const totalLogEvents = (list) =>
    (list || []).reduce(
      (sum, h) =>
        sum + (h.logs || []).reduce((s, d) => s + (d.entries || []).length, 0),
      0,
    );
  const totalActivity = totalLogEvents(habits);
  const constructiveLogs = totalLogEvents(
    (habits || []).filter((h) => h.type === "Good"),
  );
  const destructiveLogs = totalLogEvents(
    (habits || []).filter((h) => h.type === "Bad"),
  );

  const habitListHeight = Math.min(Math.max(habits.length, 2) * 52 + 24, 400);

  const loggedDates = useMemo(() => {
    const set = new Set();
    (habits || [])
      .filter((h) => h.type === "Good")
      .forEach((h) => (h.logs || []).forEach((d) => set.add(d.date)));
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
      days.push(new Date(y, m, d).toISOString().split("T")[0]);
    return days;
  }, [calendarMonth]);

  return (
    <div className="page-fade space-y-6 pb-20">
      <Card className="ai-glow flex items-center gap-6 overflow-hidden relative hover:translate-y-0 hover:shadow-none hover:border-border-color border-l-4 border-l-accent">
        <div className="w-12 h-12 rounded-xl bg-accent-dim flex items-center justify-center border border-border-color shrink-0">
          <Icon name="brain" className="text-text-primary" size={20} />
        </div>
        <div className="min-w-0 flex-1">
          <h4 className="text-[10px] font-black uppercase tracking-[0.3em] text-text-secondary mb-1">
            Daily insight
          </h4>
          <h3 className="text-sm font-bold text-text-primary mb-0.5">
            {insights?.title || "Daily insight"}
          </h3>
          <p className="text-xs text-text-secondary max-w-2xl">
            {insights?.body ||
              "Log first, judge later. Consistency starts with clean data."}
          </p>
        </div>
      </Card>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="flex flex-row items-center gap-3 hover:translate-y-0">
          <div className="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center shrink-0">
            <Icon name="activity" size={18} className="text-accent" />
          </div>
          <div className="min-w-0">
            <p className="text-text-secondary text-[10px] font-black uppercase tracking-widest">
              All logs
            </p>
            <h3 className="text-xl font-mono font-bold text-text-primary">
              {totalActivity}
            </h3>
          </div>
        </Card>
        <Card className="flex flex-row items-center gap-3 hover:translate-y-0">
          <div className="w-10 h-10 rounded-lg bg-success/10 flex items-center justify-center shrink-0">
            <Icon name="zap" size={18} className="text-success" />
          </div>
          <div className="min-w-0">
            <p className="text-text-secondary text-[10px] font-black uppercase tracking-widest">
              Active habits
            </p>
            <h3 className="text-xl font-mono font-bold text-text-primary">
              {habits.length}
            </h3>
          </div>
        </Card>
        <Card className="hidden lg:flex flex-row items-center gap-3 hover:translate-y-0">
          <div className="w-10 h-10 rounded-lg bg-success/10 flex items-center justify-center shrink-0">
            <span className="text-base font-bold text-success">+</span>
          </div>
          <div className="min-w-0">
            <p className="text-text-secondary text-[10px] font-black uppercase tracking-widest">
              Constructive logs
            </p>
            <h3 className="text-xl font-mono font-bold text-success">
              {constructiveLogs}
            </h3>
          </div>
        </Card>
        <Card className="hidden lg:flex flex-row items-center gap-3 hover:translate-y-0">
          <div className="w-10 h-10 rounded-lg bg-danger/10 flex items-center justify-center shrink-0">
            <span className="text-base font-bold text-danger">−</span>
          </div>
          <div className="min-w-0">
            <p className="text-text-secondary text-[10px] font-black uppercase tracking-widest">
              Destructive logs
            </p>
            <h3 className="text-xl font-mono font-bold text-danger">
              {destructiveLogs}
            </h3>
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-stretch">
        <Card className="lg:col-span-2 flex flex-col hover:translate-y-0 hover:shadow-none hover:border-border-color">
          <div className="flex justify-between items-center mb-3 shrink-0">
            <h4 className="text-xs font-bold uppercase tracking-[0.2em] text-text-secondary">
              Habit Registry
            </h4>
            <Link
              to="/app/habits"
              className="text-[10px] font-bold uppercase tracking-widest text-text-secondary hover:text-text-primary"
            >
              Manage →
            </Link>
          </div>
          <div
            className="space-y-2 overflow-y-auto custom-scrollbar pr-2 flex-1 min-h-0"
            style={{ maxHeight: habitListHeight }}
          >
            {habits.map((h) => {
              const todayKey = new Date().toISOString().split("T")[0];
              const checkedToday = (h.logs || []).some(
                (l) => l.date === todayKey && l.count > 0,
              );
              const isGood = h.type === "Good";
              return (
                <div
                  key={h.id}
                  className="flex items-center justify-between p-3 bg-accent-dim border border-border-color rounded-xl group transition-all hover:border-text-secondary"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    {/* Emoji / icon badge */}
                    <div
                      className={`w-7 h-7 rounded-lg shrink-0 flex items-center justify-center border ${isGood ? "bg-accent/10 border-accent/30" : "bg-bg-main border-border-color"}`}
                    >
                      {h.emoji ? (
                        <span
                          className="leading-none"
                          style={
                            isUnicodeSymbol(h.emoji)
                              ? {
                                  color: isGood
                                    ? "var(--accent)"
                                    : "var(--text-secondary)",
                                  fontSize: "0.75rem",
                                }
                              : {
                                  filter:
                                    "grayscale(1) saturate(0) brightness(1.2)",
                                  fontSize: "0.8rem",
                                }
                          }
                        >
                          {h.emoji}
                        </span>
                      ) : (
                        <Icon
                          name={isGood ? "check-circle" : "alert-circle"}
                          size={13}
                          className={
                            isGood ? "text-accent" : "text-text-secondary"
                          }
                        />
                      )}
                    </div>
                    <div className="min-w-0">
                      <div className="text-sm font-bold text-text-primary truncate">
                        {h.name}
                      </div>
                      <div className="text-[10px] text-text-secondary uppercase font-mono truncate">
                        {h.mode === "count"
                          ? `${(h.logs || []).reduce((s, d) => s + (d.entries || []).length, 0)} log(s) · ${h.totalLogs} ${h.unit || "total"}`
                          : h.mode === "check"
                            ? `${h.totalLogs} day(s) checked`
                            : `${h.totalLogs} logs`}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0 ml-2">
                    <Button
                      onClick={() => setPerformanceTarget(h.id)}
                      size="sm"
                      variant="outline"
                      icon="bar-chart-2"
                      className="bg-bg-main rounded-lg w-8 h-8 p-0"
                      title="Habit performance"
                    />
                    {h.mode === "count" ? (
                      <>
                        <input
                          type="number"
                          min="1"
                          placeholder="0"
                          className="w-12 h-8 rounded-lg bg-bg-main border border-border-color text-center text-xs font-mono text-text-primary px-1"
                          value={countInputs[h.id] ?? ""}
                          onChange={(e) =>
                            setCountInputs((prev) => ({
                              ...prev,
                              [h.id]: e.target.value,
                            }))
                          }
                        />
                        <Button
                          onClick={() => logActivity(h.id, false)}
                          size="sm"
                          variant="outline"
                          icon="minus"
                          className="bg-bg-main rounded-lg w-8 h-8 p-0"
                        />
                        <Button
                          onClick={() => {
                            const n = countInputs[h.id];
                            if (n) {
                              logActivity(h.id, true, n, h.unit || "");
                              setCountInputs((prev) => ({
                                ...prev,
                                [h.id]: "",
                              }));
                            }
                          }}
                          size="sm"
                          variant="primary"
                          icon="plus"
                          className="rounded-lg w-8 h-8 p-0"
                        />
                      </>
                    ) : h.mode === "check" ? (
                      /* Green tick for Good, Red cross for Bad — consistent with Habit Registry */
                      <button
                        onClick={() => logActivity(h.id, !checkedToday)}
                        className={`w-8 h-8 rounded-lg border-2 flex items-center justify-center transition-all ${
                          checkedToday
                            ? isGood
                              ? "bg-emerald-500/20 border-emerald-500/70 shadow-[0_0_10px_rgba(52,211,153,0.2)]"
                              : "bg-red-500/20 border-red-500/70 shadow-[0_0_10px_rgba(239,68,68,0.2)]"
                            : "border-border-color text-text-secondary hover:border-text-secondary"
                        }`}
                        title={
                          checkedToday ? "Uncheck today" : "Check for today"
                        }
                      >
                        {checkedToday ? (
                          isGood ? (
                            <svg
                              viewBox="0 0 12 12"
                              width="12"
                              height="12"
                              fill="none"
                            >
                              <path
                                d="M1.5 6.5L4.5 9.5L10.5 2.5"
                                stroke="#4ade80"
                                strokeWidth="1.8"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              />
                            </svg>
                          ) : (
                            <svg
                              viewBox="0 0 12 12"
                              width="12"
                              height="12"
                              fill="none"
                            >
                              <path
                                d="M2 2L10 10M10 2L2 10"
                                stroke="#f87171"
                                strokeWidth="1.8"
                                strokeLinecap="round"
                              />
                            </svg>
                          )
                        ) : (
                          <div className="w-2.5 h-2.5 rounded border border-border-color" />
                        )}
                      </button>
                    ) : (
                      <>
                        <Button
                          onClick={() => logActivity(h.id, false)}
                          size="sm"
                          variant="outline"
                          icon="minus"
                          className="bg-bg-main rounded-lg w-8 h-8 p-0"
                        />
                        <Button
                          onClick={() => logActivity(h.id, true)}
                          size="sm"
                          variant="primary"
                          icon="plus"
                          className="rounded-lg w-8 h-8 p-0"
                        />
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

        <Card className="flex flex-col hover:translate-y-0 hover:shadow-none hover:border-border-color">
          <div className="flex justify-between items-center mb-3 shrink-0">
            <h4 className="text-xs font-bold uppercase tracking-[0.2em] text-text-secondary">
              Recent Logs
            </h4>
            <Link
              to="/app/logs"
              className="text-[10px] font-bold uppercase tracking-widest text-text-secondary hover:text-text-primary"
            >
              All logs →
            </Link>
          </div>
          <div
            className="space-y-2 overflow-y-auto custom-scrollbar pr-2 flex-1 min-h-0"
            style={{ maxHeight: habitListHeight }}
          >
            {flattenedLogs.slice(0, 50).map((log, i) => (
              <div
                key={i}
                className={`flex gap-3 items-start border-l-2 pl-3 py-1.5 transition-colors ${
                  log.type === "Good"
                    ? "border-success/60 hover:border-success"
                    : "border-danger/60 hover:border-danger"
                }`}
              >
                <div
                  className={`mt-0.5 w-7 h-7 rounded-lg border flex items-center justify-center shrink-0 ${log.type === "Good" ? "border-success/30 bg-success/10 text-success" : "border-danger/30 bg-danger/10 text-danger"}`}
                >
                  <span className="text-xs font-bold">
                    {log.type === "Good" ? "+" : "−"}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[11px] font-bold text-text-primary truncate flex items-center gap-1.5">
                    {log.emoji && (
                      <span
                        className="leading-none shrink-0"
                        style={
                          isUnicodeSymbol(log.emoji)
                            ? {
                                color: "var(--text-secondary)",
                                fontSize: "0.7rem",
                              }
                            : {
                                filter:
                                  "grayscale(1) saturate(0) brightness(1.2)",
                                fontSize: "0.75rem",
                              }
                        }
                      >
                        {log.emoji}
                      </span>
                    )}
                    {log.habit}
                  </div>
                  <div className="text-[9px] font-mono text-text-secondary">
                    {log.time} · {log.formattedDate}
                    {log.value != null
                      ? ` · ${log.value} ${log.unit || ""}`
                      : ""}
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

      <Card className="p-6 hover:translate-y-0 hover:shadow-none hover:border-border-color">
        <div className="flex items-center justify-between mb-4">
          <h4 className="text-xs font-bold uppercase tracking-[0.2em] text-text-secondary">
            Activity calendar
          </h4>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() =>
                setCalendarMonth(
                  (prev) => new Date(prev.getFullYear(), prev.getMonth() - 1),
                )
              }
              className="w-8 h-8 rounded-lg border border-border-color flex items-center justify-center text-text-secondary hover:text-text-primary text-sm font-bold"
            >
              ←
            </button>
            <span className="text-sm font-bold text-text-primary min-w-[140px] text-center">
              {calendarMonth.toLocaleDateString("en-US", {
                month: "long",
                year: "numeric",
              })}
            </span>
            <button
              type="button"
              onClick={() =>
                setCalendarMonth(
                  (prev) => new Date(prev.getFullYear(), prev.getMonth() + 1),
                )
              }
              className="w-8 h-8 rounded-lg border border-border-color flex items-center justify-center text-text-secondary hover:text-text-primary text-sm font-bold"
            >
              →
            </button>
          </div>
        </div>
        <div className="grid grid-cols-7 gap-1">
          {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
            <div
              key={d}
              className="text-[9px] font-bold text-text-secondary uppercase text-center py-1"
            >
              {d}
            </div>
          ))}
          {calendarDays.map((dateStr, i) => (
            <div
              key={i}
              className={`aspect-square rounded-lg flex items-center justify-center text-[11px] font-mono ${
                dateStr
                  ? loggedDates.has(dateStr)
                    ? "bg-black dark:bg-white text-white dark:text-bg-main border border-black dark:border-white shadow-sm"
                    : "bg-bg-main/50 border border-border-color text-text-secondary"
                  : "invisible"
              }`}
            >
              {dateStr ? new Date(dateStr + "T12:00:00").getDate() : ""}
            </div>
          ))}
        </div>
      </Card>

      <HabitPerformanceModal
        open={!!performanceTarget}
        habit={performanceHabit}
        onClose={() => setPerformanceTarget(null)}
      />
    </div>
  );
};

export default Dashboard;

import { useEffect, useMemo, useState, useRef } from "react";
import Icon from "./Icon";
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { getLocalDateKey as getDateKey } from "../utils/date";

const startOfDay = (dateStr) => new Date(`${dateStr}T12:00:00`);

const dayDiff = (a, b) => {
  const ONE_DAY_MS = 24 * 60 * 60 * 1000;
  return Math.round((startOfDay(b) - startOfDay(a)) / ONE_DAY_MS);
};

const getCurrentStreak = (activeDates) => {
  if (!activeDates.size) return 0;
  let streak = 0;
  for (let i = 0; ; i++) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = getDateKey(d);
    if (activeDates.has(key)) {
      streak += 1;
    } else {
      break;
    }
  }
  return streak;
};

const getLongestStreak = (sortedDates) => {
  if (!sortedDates.length) return 0;
  let longest = 1;
  let current = 1;
  for (let i = 1; i < sortedDates.length; i++) {
    if (dayDiff(sortedDates[i - 1], sortedDates[i]) === 1) {
      current += 1;
      longest = Math.max(longest, current);
    } else {
      current = 1;
    }
  }
  return longest;
};

const getCalendarDays = (monthDate) => {
  const year = monthDate.getFullYear();
  const month = monthDate.getMonth();
  const first = new Date(year, month, 1);
  const last = new Date(year, month + 1, 0);
  const pad = first.getDay();
  const days = [];
  for (let i = 0; i < pad; i++) days.push(null);
  for (let d = 1; d <= last.getDate(); d++) {
    days.push(getDateKey(new Date(year, month, d)));
  }
  return days;
};

const AnimatedNumber = ({ value }) => {
  const [display, setDisplay] = useState(0);
  useEffect(() => {
    let start = 0;
    const duration = 1000;
    const increment = value === 0 ? 0 : value / (duration / 16);
    if (value === 0) {
      setDisplay(0);
      return;
    }
    const timer = setInterval(() => {
      start += increment;
      if ((increment > 0 && start >= value) || (increment < 0 && start <= value)) {
        start = value;
        clearInterval(timer);
      }
      setDisplay(Math.round(start));
    }, 16);
    return () => clearInterval(timer);
  }, [value]);
  return <>{display}</>;
};

const HabitPerformanceModal = ({ open, habit, onClose }) => {
  const [calendarMonth, setCalendarMonth] = useState(() => new Date());
  const [chartType, setChartType] = useState("bar");

  useEffect(() => {
    if (!open) return undefined;
    const onEsc = (e) => {
      if (e.key === "Escape") onClose?.();
    };
    document.addEventListener("keydown", onEsc);
    return () => document.removeEventListener("keydown", onEsc);
  }, [open, onClose]);

  useEffect(() => {
    if (open) setCalendarMonth(new Date());
  }, [open, habit?.id]);

  const metrics = useMemo(() => {
    if (!habit) return null;
    const logs = (habit.logs || []); // Include all logs, even if count is 0 if it exists
    const sortedDates = logs.filter(d => (d.count || 0) > 0).map((d) => d.date).sort();
    const activeDateSet = new Set(sortedDates);
    const currentStreak = getCurrentStreak(activeDateSet);
    const longestStreak = getLongestStreak(sortedDates);
    const totalEvents = logs.reduce((sum, d) => sum + (d.entries || []).length, 0);
    const activeDays = logs.length;
    const lastDate = sortedDates[sortedDates.length - 1] || null;

    let activeIn30 = 0;
    for (let i = 0; i < 30; i++) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      if (activeDateSet.has(getDateKey(d))) activeIn30 += 1;
    }

    return {
      activeDateSet,
      currentStreak,
      signedCurrentStreak: habit.type === "Bad" ? -currentStreak : currentStreak,
      longestStreak,
      totalEvents,
      activeDays,
      lastDate,
      consistency30: Math.round((activeIn30 / 30) * 100)
    };
  }, [habit]);

  // Chart data: last 30 days
  const chartData = useMemo(() => {
    if (!habit) return [];
    return Array.from({ length: 30 }).map((_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - (29 - i));
      const dateStr = getDateKey(d);
      const log = (habit.logs || []).find((l) => l.date === dateStr);
      return {
        name: d.getDate().toString(),
        value: log ? log.count : 0,
      };
    });
  }, [habit]);

  if (!open || !habit || !metrics) return null;

  const isBad = habit.type === "Bad";
  const calendarDays = getCalendarDays(calendarMonth);
  const todayKey = getDateKey(new Date());
  const chartColor = isBad ? "#f87171" : "#4ade80";
  const hasAnyData = chartData.some((d) => d.value > 0);

  return (
    <>
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[120]"
        onClick={onClose}
        aria-hidden="true"
      />
      <div className="fixed inset-0 z-[121] p-4 flex items-center justify-center">
        <div
          className="w-full max-w-5xl max-h-[92vh] overflow-y-auto custom-scrollbar rounded-3xl border border-border-color bg-bg-main shadow-2xl p-6 sm:p-8"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-start justify-between gap-4 mb-6">
            <div className="min-w-0">
              <p className="text-[10px] font-black uppercase tracking-[0.3em] text-text-secondary mb-1">
                Habit Performance
              </p>
              <h3 className="text-xl sm:text-2xl font-bold text-text-primary truncate">
                {habit.name}
              </h3>
              <p className="text-xs text-text-secondary mt-1">
                {isBad
                  ? "Destructive habit performance with negative streak tracking."
                  : "Constructive habit performance with dedicated streak tracking."}
              </p>
            </div>
            <button
              onClick={onClose}
              className="w-9 h-9 rounded-xl border border-border-color flex items-center justify-center text-text-secondary hover:text-text-primary shrink-0"
            >
              <Icon name="x" size={16} />
            </button>
          </div>

          {/* Stat Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
            <div className="rounded-xl border border-border-color bg-accent-dim p-3">
              <p className="text-[10px] font-black uppercase tracking-widest text-text-secondary">
                {isBad ? "Negative streak" : "Current streak"}
              </p>
              <p className={`text-xl font-mono font-bold mt-1 ${isBad ? "text-danger" : "text-success"}`}>
                <AnimatedNumber value={metrics.signedCurrentStreak} />
              </p>
            </div>
            <div className="rounded-xl border border-border-color bg-accent-dim p-3">
              <p className="text-[10px] font-black uppercase tracking-widest text-text-secondary">
                Longest streak
              </p>
              <p className="text-xl font-mono font-bold text-text-primary mt-1">
                <AnimatedNumber value={metrics.longestStreak} />
              </p>
            </div>
            <div className="rounded-xl border border-border-color bg-accent-dim p-3">
              <p className="text-[10px] font-black uppercase tracking-widest text-text-secondary">
                Active days
              </p>
              <p className="text-xl font-mono font-bold text-text-primary mt-1">
                <AnimatedNumber value={metrics.activeDays} />
              </p>
            </div>
            <div className="rounded-xl border border-border-color bg-accent-dim p-3">
              <p className="text-[10px] font-black uppercase tracking-widest text-text-secondary">
                30d consistency
              </p>
              <p className="text-xl font-mono font-bold text-text-primary mt-1">
                <AnimatedNumber value={metrics.consistency30} />%
              </p>
            </div>
          </div>



          {/* Analytics Chart */}
          <div className="rounded-2xl border border-border-color p-4 mb-6">
            <div className="flex items-center justify-between mb-4">
              <p className="text-[10px] font-black uppercase tracking-[0.25em] text-text-secondary">
                30-Day Activity
              </p>
              <div className="flex bg-accent-dim border border-border-color p-0.5 rounded-lg">
                <button
                  onClick={() => setChartType("bar")}
                  className={`px-2.5 py-1 rounded-md text-[9px] font-bold uppercase transition-all ${chartType === "bar" ? "bg-accent text-bg-main" : "text-text-secondary hover:text-text-primary"}`}
                >
                  Bar
                </button>
                <button
                  onClick={() => setChartType("line")}
                  className={`px-2.5 py-1 rounded-md text-[9px] font-bold uppercase transition-all ${chartType === "line" ? "bg-accent text-bg-main" : "text-text-secondary hover:text-text-primary"}`}
                >
                  Line
                </button>
              </div>
            </div>
            {hasAnyData ? (
              <ResponsiveContainer width="100%" height={180}>
                {chartType === "bar" ? (
                  <BarChart data={chartData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
                    <XAxis dataKey="name" tick={{ fill: "var(--text-secondary)", fontSize: 9 }} interval={4} />
                    <YAxis tick={{ fill: "var(--text-secondary)", fontSize: 9 }} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "var(--bg-main)",
                        border: "1px solid var(--border-color)",
                        borderRadius: "10px",
                        fontSize: "11px",
                        color: "var(--text-primary)",
                      }}
                    />
                    <Bar dataKey="value" fill={chartColor} radius={[3, 3, 0, 0]} fillOpacity={0.9} />
                  </BarChart>
                ) : (
                  <LineChart data={chartData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
                    <XAxis dataKey="name" tick={{ fill: "var(--text-secondary)", fontSize: 9 }} interval={4} />
                    <YAxis tick={{ fill: "var(--text-secondary)", fontSize: 9 }} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "var(--bg-main)",
                        border: "1px solid var(--border-color)",
                        borderRadius: "10px",
                        fontSize: "11px",
                        color: "var(--text-primary)",
                      }}
                    />
                    <Line
                      type="monotone"
                      dataKey="value"
                      stroke={chartColor}
                      strokeWidth={2.5}
                      dot={{ fill: chartColor, r: 3 }}
                      activeDot={{ r: 5, fill: chartColor }}
                    />
                  </LineChart>
                )}
              </ResponsiveContainer>
            ) : (
              <div className="h-[180px] flex items-center justify-center">
                <p className="text-xs text-text-secondary uppercase tracking-widest">No activity in the last 30 days</p>
              </div>
            )}
          </div>

          {/* Calendar + Snapshot */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 rounded-2xl border border-border-color p-3 sm:p-4">
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 sm:gap-4 mb-4">
                <p className="text-[10px] font-black uppercase tracking-[0.25em] text-text-secondary text-center sm:text-left self-start sm:self-auto w-full sm:w-auto">
                  Calendar streak
                </p>
                <div className="flex items-center gap-1 sm:gap-2 w-full justify-between sm:w-auto sm:justify-end">
                  <button
                    type="button"
                    onClick={() =>
                      setCalendarMonth(
                        (prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1),
                      )
                    }
                    className="w-8 h-8 rounded-lg border border-border-color text-text-secondary hover:text-text-primary"
                  >
                    {"<"}
                  </button>
                  <p className="text-xs sm:text-sm font-bold text-text-primary min-w-[120px] sm:min-w-[140px] text-center shrink-0">
                    {calendarMonth.toLocaleDateString("en-US", {
                      month: "long",
                      year: "numeric",
                    })}
                  </p>
                  <button
                    type="button"
                    onClick={() =>
                      setCalendarMonth(
                        (prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1),
                      )
                    }
                    className="w-8 h-8 rounded-lg border border-border-color text-text-secondary hover:text-text-primary"
                  >
                    {">"}
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-7 gap-0.5 sm:gap-1">
                {["S", "M", "T", "W", "T", "F", "S"].map((day, idx) => (
                  <div
                    key={`${day}-${idx}`}
                    className="text-[9px] font-bold text-text-secondary text-center py-1"
                  >
                    {day}
                  </div>
                ))}
                {calendarDays.map((dateStr, idx) => {
                  const hasActivity = !!dateStr && metrics.activeDateSet.has(dateStr);
                  const isToday = dateStr === todayKey;

                  let themeClass = "bg-bg-sidebar/50 border-border-color/50 text-text-secondary opacity-40";
                  if (dateStr) {
                    if (hasActivity) {
                      themeClass = isBad
                        ? "bg-[#ef4444] text-white border-[#ef4444] shadow-[0_0_12px_rgba(239,68,68,0.25)] opacity-100"
                        : "bg-[#4ade80] text-black border-[#4ade80] shadow-[0_0_12px_rgba(74,222,128,0.25)] opacity-100";
                    } else {
                      themeClass = isToday
                        ? "bg-bg-main border-accent/60 text-accent opacity-100 ring-1 ring-accent/30"
                        : "bg-bg-main border-border-color text-text-secondary opacity-60";
                    }
                  }

                  return (
                    <div
                      key={`${dateStr || "pad"}-${idx}`}
                      className={`aspect-square rounded-lg border text-[11px] font-mono flex items-center justify-center transition-all ${dateStr ? themeClass : "invisible"} ${isToday && !hasActivity ? "scale-105" : ""}`}
                    >
                      {dateStr ? new Date(`${dateStr}T12:00:00`).getDate() : ""}
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="rounded-2xl border border-border-color p-4 space-y-4">
              <p className="text-[10px] font-black uppercase tracking-[0.25em] text-text-secondary">
                Snapshot
              </p>
              <div className="space-y-2 text-xs">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-text-secondary">Total logged value</span>
                  <span className="font-bold text-text-primary">
                    {habit.totalLogs || 0} {habit.unit || ""}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-text-secondary">Total log events</span>
                  <span className="font-bold text-text-primary">
                    {metrics.totalEvents}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-text-secondary">Mode</span>
                  <span className="font-bold text-text-primary uppercase">
                    {habit.mode || "quick"}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-text-secondary">Last active</span>
                  <span className="font-bold text-text-primary">
                    {metrics.lastDate
                      ? new Date(`${metrics.lastDate}T12:00:00`).toLocaleDateString(
                        "en-US",
                        {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        },
                      )
                      : "Never"}
                  </span>
                </div>
              </div>

              <div className="pt-2 border-t border-border-color">
                <p className="text-[11px] text-text-secondary leading-relaxed">
                  {isBad
                    ? "Negative streak shows consecutive days this destructive habit was logged."
                    : "Current streak shows consecutive days this constructive habit was logged."}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default HabitPerformanceModal;

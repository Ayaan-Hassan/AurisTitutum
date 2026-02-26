import React, { useMemo, useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import Icon from "../components/Icon";
import { Card } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { ConfirmModal } from "../components/Modals";
import { useAuth } from "../contexts/AuthContext";
import {
  syncAllLogs,
  checkSheetsConnection,
  getLogsFromSheets,
  getCachedSheetInfo,
} from "../services/sheetsApi";

const Logs = ({ habits, setHabits }) => {
  const navigate = useNavigate();
  const [clearConfirmOpen, setClearConfirmOpen] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [featureLockOpen, setFeatureLockOpen] = useState(false);
  const [filter, setFilter] = useState("all"); // all | good | bad
  const [sheetsStatus, setSheetsStatus] = useState({
    connected: false,
    sheetUrl: null,
  });
  const [syncMessage, setSyncMessage] = useState(null); // { type: 'success'|'error'|'info', text: string }
  const [livePolling, setLivePolling] = useState(false);
  const { user } = useAuth();

  // ── Check sheets connection on mount ──────────────────────────────────────
  useEffect(() => {
    const checkConnection = async () => {
      if (user) {
        // First, try the localStorage cache for instant UI feedback
        const cached = getCachedSheetInfo();
        if (cached?.connected) {
          setSheetsStatus({
            connected: true,
            sheetUrl: cached.sheetUrl || null,
          });
        }
        // Then verify with the server
        const status = await checkSheetsConnection(user);
        setSheetsStatus({
          connected: status.connected,
          sheetUrl: status.sheetUrl || cached?.sheetUrl || null,
        });
      }
    };
    checkConnection();
  }, [user]);

  // ── Auto-dismiss sync messages after 5 s ─────────────────────────────────
  useEffect(() => {
    if (!syncMessage) return;
    const t = setTimeout(() => setSyncMessage(null), 5000);
    return () => clearTimeout(t);
  }, [syncMessage]);

  // ── Import logs from Google Sheets into local habit state ─────────────────
  const importLogsFromSheets = useCallback(
    (sheetLogs) => {
      if (!sheetLogs || sheetLogs.length === 0) return false;

      let didUpdate = false;

      setHabits((prev) => {
        const updated = prev.map((habit) => {
          // Find sheet rows that belong to this habit
          const relevantRows = sheetLogs.filter(
            (r) =>
              r.habit?.trim().toLowerCase() === habit.name.trim().toLowerCase(),
          );
          if (relevantRows.length === 0) return habit;

          // Group rows by date
          const byDate = {};
          relevantRows.forEach((row) => {
            if (!row.date) return;
            if (!byDate[row.date]) byDate[row.date] = [];
            byDate[row.date].push(row);
          });

          let updatedLogs = [...(habit.logs || [])];
          let updatedTotal = habit.totalLogs;

          Object.entries(byDate).forEach(([date, rows]) => {
            const existingIdx = updatedLogs.findIndex((l) => l.date === date);
            if (existingIdx === -1) {
              // This date doesn't exist locally — import it
              const newLog = {
                date,
                count: rows.length,
                entries: rows.map((r) => r.timestamp || date),
              };
              updatedLogs.push(newLog);
              updatedTotal += rows.length;
              didUpdate = true;
            }
            // If date already exists locally, local data takes precedence
          });

          if (!didUpdate) return habit;
          return { ...habit, logs: updatedLogs, totalLogs: updatedTotal };
        });
        return updated;
      });

      return didUpdate;
    },
    [setHabits],
  );

  // ── Live polling: pull sheet → web every 30 s when connected ─────────────
  useEffect(() => {
    if (!user || !sheetsStatus.connected) {
      setLivePolling(false);
      return;
    }

    setLivePolling(true);

    const poll = async () => {
      try {
        const response = await getLogsFromSheets(user);
        if (response?.logs?.length > 0) {
          const updated = importLogsFromSheets(response.logs);
          if (updated) {
            setSyncMessage({
              type: "info",
              text: "Live update: new entries imported from Google Sheets.",
            });
          }
        }
      } catch {
        // Silent fail — polling should not disrupt the UI
      }
    };

    // Initial pull on connect
    poll();

    const interval = setInterval(poll, 30000);
    return () => {
      clearInterval(interval);
      setLivePolling(false);
    };
  }, [user, sheetsStatus.connected, importLogsFromSheets]);

  // ── Flatten all habit logs into a sorted list ─────────────────────────────
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
          all.push({
            habit: h.name,
            habitId: h.id,
            emoji: h.emoji || "",
            type: h.type,
            mode: h.mode,
            date: day.date,
            time,
            value: value != null ? value : null,
            unit: unit || null,
          });
        });
      });
    });
    return all.sort(
      (a, b) => parseTs(b.date, b.time) - parseTs(a.date, a.time),
    );
  }, [habits]);

  const counts = useMemo(() => {
    const good = flattenedLogs.filter((l) => l.type === "Good").length;
    const bad = flattenedLogs.length - good;
    return { all: flattenedLogs.length, good, bad };
  }, [flattenedLogs]);

  const filteredLogs = useMemo(() => {
    if (filter === "good")
      return flattenedLogs.filter((l) => l.type === "Good");
    if (filter === "bad") return flattenedLogs.filter((l) => l.type === "Bad");
    return flattenedLogs;
  }, [flattenedLogs, filter]);

  // ── CSV export ────────────────────────────────────────────────────────────
  const exportToCSV = () => {
    if (!user) {
      setFeatureLockOpen(true);
      return;
    }
    const headers = ["Habit Name", "Date", "Time", "Type", "Value", "Unit"];
    const rows = flattenedLogs.map((log) => [
      log.habit,
      log.date,
      log.time,
      log.type,
      log.value ?? "",
      log.unit ?? "",
    ]);
    const csvContent = [
      headers.join(","),
      ...rows.map((r) => r.join(",")),
    ].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `auristitutum_logs_${new Date().toISOString().split("T")[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // ── Sync to Sheets ────────────────────────────────────────────────────────
  const handleSyncToSheets = async () => {
    if (!user) {
      setFeatureLockOpen(true);
      return;
    }

    // If not connected, send user to Settings to connect first
    if (!sheetsStatus.connected) {
      const toastEvent = new CustomEvent("showToast", {
        detail: {
          message: "Connect Google Sheets in Settings first.",
          type: "info",
          id: Date.now(),
        },
      });
      document.dispatchEvent(toastEvent);
      navigate("/app/settings");
      return;
    }

    if (habits.length === 0) return;

    try {
      setSyncing(true);
      setSyncMessage(null);
      const result = await syncAllLogs(user, habits);
      setSyncMessage({
        type: "success",
        text: `✓ ${result.count} logs synced to Google Sheets.`,
      });
    } catch (e) {
      setSyncMessage({
        type: "error",
        text: e.message || "Failed to sync to Google Sheets.",
      });
    } finally {
      setSyncing(false);
    }
  };

  // ── Connect button (from Logs page) ───────────────────────────────────────
  const handleConnectFromLogs = () => {
    if (!user) {
      setFeatureLockOpen(true);
      return;
    }
    const toastEvent = new CustomEvent("showToast", {
      detail: {
        message: "Redirecting to Settings to connect Google Sheets…",
        type: "info",
        id: Date.now(),
      },
    });
    document.dispatchEvent(toastEvent);
    navigate("/app/settings");
  };

  // ── Helpers ───────────────────────────────────────────────────────────────
  const formatDate = (dateStr) => {
    try {
      return new Date(dateStr + "T12:00:00")
        .toLocaleDateString("en-GB", {
          day: "2-digit",
          month: "short",
          year: "numeric",
        })
        .toUpperCase();
    } catch {
      return dateStr;
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="page-fade space-y-8 pb-20">
      {/* ── Page Header ── */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tighter text-text-primary">
            Logs
          </h2>
          <p className="text-text-secondary text-xs mt-1">
            All activity entries across habits with full details.
          </p>

          {/* Filter tabs */}
          <div className="mt-3 inline-flex rounded-xl border border-border-color bg-accent-dim p-1 flex-wrap">
            {[
              { key: "all", label: `All (${counts.all})` },
              { key: "good", label: `Constructive (${counts.good})` },
              { key: "bad", label: `Destructive (${counts.bad})` },
            ].map((f) => (
              <button
                key={f.key}
                type="button"
                onClick={() => setFilter(f.key)}
                className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-widest whitespace-nowrap ${
                  filter === f.key
                    ? "bg-accent text-bg-main"
                    : "text-text-secondary hover:text-text-primary"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex flex-wrap gap-2">
          <Button
            onClick={exportToCSV}
            variant="outline"
            icon="download"
            className="bg-bg-main shrink-0"
          >
            Export CSV
          </Button>

          {sheetsStatus.connected ? (
            <Button
              onClick={handleSyncToSheets}
              variant="outline"
              icon="cloud-sync"
              className="bg-bg-main shrink-0"
              disabled={syncing || flattenedLogs.length === 0}
            >
              {syncing ? "Syncing…" : "Sync to Sheets"}
            </Button>
          ) : (
            <Button
              onClick={handleConnectFromLogs}
              variant="outline"
              icon="file-spreadsheet"
              className="bg-bg-main shrink-0"
            >
              Connect Sheets
            </Button>
          )}

          <Button
            onClick={() => setClearConfirmOpen(true)}
            variant="outline"
            className="bg-bg-main shrink-0 border-danger/50 text-danger hover:bg-danger/10"
          >
            Clear logs
          </Button>
        </div>
      </div>

      {/* ── Sheets status banner ── */}
      {user && sheetsStatus.connected && (
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 rounded-xl border border-border-color bg-card-bg/60 px-4 py-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="flex items-center gap-1.5 shrink-0">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-[10px] font-bold uppercase tracking-widest text-emerald-400">
                Google Sheets Connected
              </span>
            </div>
            {livePolling && (
              <span className="text-[9px] text-text-secondary uppercase tracking-wider hidden sm:inline">
                · Live sync active
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {syncMessage && (
              <span
                className={`text-[10px] font-medium ${
                  syncMessage.type === "success"
                    ? "text-emerald-400"
                    : syncMessage.type === "error"
                      ? "text-red-400"
                      : "text-text-secondary"
                }`}
              >
                {syncMessage.text}
              </span>
            )}
            {sheetsStatus.sheetUrl && (
              <a
                href={sheetsStatus.sheetUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border-color bg-bg-main text-[10px] font-bold uppercase tracking-widest text-text-secondary hover:text-text-primary hover:border-text-secondary transition-all shrink-0"
              >
                <Icon name="external-link" size={11} />
                Open My Google Sheet
              </a>
            )}
          </div>
        </div>
      )}

      {/* Sync error outside banner */}
      {syncMessage &&
        syncMessage.type === "error" &&
        !sheetsStatus.connected && (
          <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-xs text-red-400">
            {syncMessage.text}
          </div>
        )}

      {/* ── Logs table ── */}
      <Card className="overflow-hidden hover:translate-y-0 hover:shadow-none hover:border-border-color">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[540px]">
            <thead>
              <tr className="border-b border-border-color">
                <th className="text-[10px] font-black uppercase tracking-widest text-text-secondary py-4 px-4 whitespace-nowrap">
                  Habit
                </th>
                <th className="text-[10px] font-black uppercase tracking-widest text-text-secondary py-4 px-4 whitespace-nowrap">
                  Type
                </th>
                <th className="text-[10px] font-black uppercase tracking-widest text-text-secondary py-4 px-4 whitespace-nowrap">
                  Date
                </th>
                <th className="text-[10px] font-black uppercase tracking-widest text-text-secondary py-4 px-4 whitespace-nowrap">
                  Time
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredLogs.map((log, i) => (
                <tr
                  key={i}
                  className="border-b border-border-color/50 hover:bg-accent-dim/50 transition-colors"
                >
                  <td className="py-3 px-4 text-sm font-medium text-text-primary whitespace-nowrap">
                    <span className="flex items-center gap-2">
                      {log.emoji && (
                        <span
                          className="text-sm leading-none"
                          style={{ filter: "grayscale(1) brightness(1.1)" }}
                        >
                          {log.emoji}
                        </span>
                      )}
                      {log.habit}
                    </span>
                  </td>
                  <td className="py-3 px-4 whitespace-nowrap">
                    <span
                      className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded ${
                        log.type === "Good"
                          ? "bg-success/20 text-success"
                          : "bg-danger/20 text-danger"
                      }`}
                    >
                      {log.type === "Good" ? "Constructive" : "Destructive"}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-xs font-mono text-text-secondary whitespace-nowrap">
                    {formatDate(log.date)}
                  </td>
                  <td className="py-3 px-4 text-xs font-mono text-text-secondary whitespace-nowrap">
                    {log.time}
                    {log.value != null
                      ? ` · ${log.value} ${log.unit || ""}`
                      : ""}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {filteredLogs.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <Icon
              name="file-text"
              size={40}
              className="text-text-secondary opacity-50 mb-4"
            />
            <p className="text-sm text-text-secondary uppercase tracking-widest">
              No logs
            </p>
            <p className="text-xs text-text-secondary mt-1">
              Try switching filters or log activity from the dashboard.
            </p>
          </div>
        )}
      </Card>

      {/* ── Modals ── */}
      <ConfirmModal
        open={clearConfirmOpen}
        title="Clear all logs"
        message="Clear all logs from all habits? This cannot be undone."
        confirmLabel="Clear all"
        variant="danger"
        onConfirm={() => {
          setHabits((prev) =>
            prev.map((h) => ({ ...h, logs: [], totalLogs: 0 })),
          );
          setClearConfirmOpen(false);
        }}
        onCancel={() => setClearConfirmOpen(false)}
      />
      <ConfirmModal
        open={featureLockOpen}
        title="Sign in required"
        message="Sign in for free to unlock exports, Google Sheets sync, and analytics."
        confirmLabel="Sign in"
        variant="primary"
        onConfirm={() => {
          setFeatureLockOpen(false);
          window.location.href = "/login";
        }}
        onCancel={() => setFeatureLockOpen(false)}
      />
    </div>
  );
};

export default Logs;

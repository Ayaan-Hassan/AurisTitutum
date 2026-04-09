import React, { useMemo, useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import Icon from "../components/Icon";
import { Card } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { ConfirmModal } from "../components/Modals";
import { useAuth } from "../contexts/AuthContext";
import { getLocalDateKey } from "../utils/date";

const Logs = ({ habits, setHabits, setFeatureLockConfig }) => {
  const navigate = useNavigate();
  const authContext = useAuth();
  const { user, logDocs, deleteLog } = authContext;
  const [clearConfirmOpen, setClearConfirmOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState([]);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [filter, setFilter] = useState("all"); // all | good | bad
  const [visibleCount, setVisibleCount] = useState(15);

  // ── Flatten all habit logs into a sorted list ─────────────────────────────
  const flattenedLogs = useMemo(() => {
    const parseTs = (dateStr, timeStr) => {
      const iso = `${dateStr}T${timeStr || "00:00:00"}`;
      const dt = new Date(iso);
      if (!Number.isNaN(dt.getTime())) return dt;
      return new Date(`${dateStr}T12:00:00`);
    };

    let all = [];

    if (user && logDocs && logDocs.length > 0) {
      // Use logDocs directly for synced users to get real IDs
      all = logDocs.map(doc => {
        const h = habits.find(h => h.id === doc.habitId);
        return {
          id: doc.id,
          habit: h?.name || 'Deleted Habit',
          habitId: doc.habitId,
          emoji: h?.emoji || "",
          type: doc.type || h?.type || "Good",
          mode: doc.mode || h?.mode || "quick",
          date: doc.date,
          time: doc.time,
          photoData: doc.photoData,
          value: doc.amount,
          unit: doc.unit || "",
          isPhoto: !!doc.photoData
        };
      });
    } else {
      // Fallback for guest mode or if logDocs empty
      (habits || []).forEach((h) => {
        (h.logs || []).forEach((day) => {
          (day.entries || []).forEach((entry, idx) => {
            const isString = typeof entry === 'string';
            const isObjectWithPhoto = !isString && entry && typeof entry === 'object' && 'photoData' in entry;
            const isPhotoEntry = (isString && entry.startsWith('data:image')) || isObjectWithPhoto;
            const photoData = isString ? (isPhotoEntry ? entry : null) : (isObjectWithPhoto ? entry.photoData : null);
            
            const isCount = isString && entry.includes("|") && !isPhotoEntry;
            const [time, value, unit] = isCount
              ? entry.split("|")
              : [(isString ? entry : "Logged"), null, null];

            all.push({
              // For guest mode, use a composite ID
              id: `guest_${h.id}_${day.date}_${idx}`,
              habit: h.name,
              habitId: h.id,
              emoji: h.emoji || "",
              type: h.type,
              mode: h.mode,
              date: day.date,
              time: isPhotoEntry ? '__photo__' : time,
              photoData: photoData,
              value: value != null ? value : null,
              unit: unit || null,
              isPhoto: isPhotoEntry,
              entryIndex: idx // Store original index for deletion
            });
          });
        });
      });
    }

    return all.sort((a, b) => parseTs(b.date, b.time) - parseTs(a.date, a.time));
  }, [habits, logDocs, user]);

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

  const paginatedLogs = useMemo(() => {
    return filteredLogs.slice(0, visibleCount);
  }, [filteredLogs, visibleCount]);

  // Reset pagination when filter changes
  useEffect(() => {
    setVisibleCount(15);
    setSelectedIds([]); // Clear selection on filter change
  }, [filter]);

  // ── Handlers ─────────────────────────────────────────────────────────────

  const toggleSelectAll = () => {
    if (selectedIds.length === paginatedLogs.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(paginatedLogs.map(l => l.id));
    }
  };

  const toggleSelect = (id) => {
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const handleDeleteSelected = async () => {
    if (user) {
      // Synced mode: delete each by ID
      for (const id of selectedIds) {
        await deleteLog(id);
      }
    } else {
      // Guest mode: update habits state
      const nextHabits = habits.map(h => {
        let hTotalReduction = 0;
        const nextLogs = (h.logs || []).map(day => {
          const entryIndexesToDelete = selectedIds
            .filter(sid => sid.startsWith(`guest_${h.id}_${day.date}_`))
            .map(sid => parseInt(sid.split('_').pop()));
          
          if (entryIndexesToDelete.length === 0) return day;

          const nextEntries = day.entries.filter((_, idx) => !entryIndexesToDelete.includes(idx));
          
          // Calculate reduction for h.totalLogs
          entryIndexesToDelete.forEach(idx => {
            const entry = day.entries[idx];
            if (h.mode === "count" || h.mode === "timer" || h.mode === "rating") {
              const val = parseInt(String(entry).split('|')[1]) || 1;
              hTotalReduction += val;
            } else {
              hTotalReduction += 1;
            }
          });

          return {
            ...day,
            entries: nextEntries,
            count: Math.max(0, day.count - entryIndexesToDelete.length) // This count is usually entries length for non-count modes
          };
        }).filter(day => day.entries.length > 0);

        return {
          ...h,
          logs: nextLogs,
          totalLogs: Math.max(0, h.totalLogs - hTotalReduction)
        };
      });
      setHabits(nextHabits);
    }
    setSelectedIds([]);
    setDeleteConfirmOpen(false);
  };

  const exportToCSV = () => {
    if (!user) {
      setFeatureLockConfig({
          title: "Unlock full console",
          subtitle: "Sign in for free to unlock this feature.",
          description: "Sign in for free to unlock CSV exports and advanced analytics for your habits."
      });
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
    link.download = `auristitutum_logs_${getLocalDateKey()}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

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

  return (
    <div className="page-fade space-y-8 pb-20">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tighter text-text-primary">
            Logs
          </h2>
          <p className="text-text-secondary text-xs mt-1">
            All activity entries across habits with full details.
          </p>

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
                className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-widest whitespace-nowrap ${filter === f.key
                  ? "bg-accent text-bg-main"
                  : "text-text-secondary hover:text-text-primary"
                  }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap gap-2 w-full sm:w-auto">
          {selectedIds.length > 0 && (
            <Button
              onClick={() => setDeleteConfirmOpen(true)}
              variant="danger"
              className="grow sm:grow-0 text-[10px] uppercase font-bold tracking-widest px-4"
              icon="trash"
            >
              Delete {selectedIds.length}
            </Button>
          )}

          <Button
            onClick={exportToCSV}
            variant="outline"
            icon="download"
            className="bg-bg-main shrink-0 text-[9px] sm:text-[10px]"
          >
            <span className="hidden sm:inline">Export CSV</span>
            <span className="sm:hidden">CSV</span>
          </Button>

          <Button
            onClick={() => setClearConfirmOpen(true)}
            variant="outline"
            className="bg-bg-main shrink-0 border-danger/50 text-danger hover:bg-danger/10 text-[9px] sm:text-[10px]"
          >
            <span className="hidden sm:inline">Clear logs</span>
            <span className="sm:hidden">Clear</span>
          </Button>
        </div>
      </div>

      <Card className="overflow-hidden hover:translate-y-0 hover:shadow-none hover:border-border-color">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[600px]">
            <thead>
              <tr className="border-b border-border-color bg-bg-sidebar/30">
                <th className="py-4 px-4 w-10">
                   <button 
                    onClick={toggleSelectAll}
                    className={`w-5 h-5 rounded border-2 transition-all flex items-center justify-center ${selectedIds.length === paginatedLogs.length && paginatedLogs.length > 0 ? 'bg-accent border-accent text-bg-main' : 'border-border-color hover:border-text-secondary'}`}
                  >
                    {selectedIds.length === paginatedLogs.length && paginatedLogs.length > 0 && <Icon name="check" size={12} />}
                   </button>
                </th>
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
                  Details
                </th>
              </tr>
            </thead>
            <tbody>
              {paginatedLogs.map((log) => (
                <tr
                  key={log.id}
                  onClick={() => toggleSelect(log.id)}
                  className={`border-b border-border-color/50 transition-colors cursor-pointer ${selectedIds.includes(log.id) ? 'bg-accent/5' : 'hover:bg-accent-dim/50'}`}
                >
                  <td className="py-3 px-4" onClick={(e) => e.stopPropagation()}>
                    <button 
                      onClick={() => toggleSelect(log.id)}
                      className={`w-5 h-5 rounded border-2 transition-all flex items-center justify-center ${selectedIds.includes(log.id) ? 'bg-accent border-accent text-bg-main' : 'border-border-color hover:border-text-secondary'}`}
                    >
                      {selectedIds.includes(log.id) && <Icon name="check" size={12} />}
                    </button>
                  </td>
                  <td className="py-3 px-4 text-sm font-medium text-text-primary whitespace-nowrap">
                    <span className="flex items-center gap-2">
                      {log.emoji && (
                        <span className="text-sm leading-none" style={{ filter: "grayscale(1) brightness(1.1)" }}>{log.emoji}</span>
                      )}
                      {log.habit}
                    </span>
                  </td>
                  <td className="py-3 px-4 whitespace-nowrap">
                    <span className={`text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded ${log.type === "Good" ? "bg-success/20 text-success" : "bg-danger/20 text-danger"}`}>
                      {log.type === "Good" ? "Constructive" : "Destructive"}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-xs font-mono text-text-secondary whitespace-nowrap">
                    {formatDate(log.date)}
                  </td>
                  <td className="py-3 px-4 text-xs font-mono text-text-secondary whitespace-nowrap">
                    {log.isPhoto ? (
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg overflow-hidden border border-border-color bg-bg-sidebar shrink-0 shadow-sm transition-transform hover:scale-110">
                          <img src={log.photoData} alt="Log" className="w-full h-full object-cover" />
                        </div>
                        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-lg bg-accent/10 border border-accent/20 text-[9px] font-bold text-accent/80 uppercase tracking-[0.2em] leading-none">
                          Image Data
                        </span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                         <span className="opacity-60">{log.time}</span>
                         {log.value != null && (
                            <>
                              <div className="w-1 h-1 rounded-full bg-border-color" />
                              <span className="font-bold text-text-primary">{log.value} {log.unit || ""}</span>
                            </>
                         )}
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {filteredLogs.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <Icon name="file-text" size={40} className="text-text-secondary opacity-50 mb-4" />
            <p className="text-sm text-text-secondary uppercase tracking-widest font-bold">No logs matched filter</p>
            <p className="text-xs text-text-secondary mt-1">Try switching filters or log activity from the dashboard.</p>
          </div>
        )}
      </Card>

      {filteredLogs.length > visibleCount && (
        <div className="flex flex-col items-center gap-4 pt-4 border-t border-white/5">
          <button
            onClick={() => setVisibleCount(prev => prev + 15)}
            className="flex items-center gap-2 px-8 py-4 rounded-xl border border-border-color bg-bg-main text-[10px] font-bold uppercase tracking-[0.2em] text-text-secondary hover:text-text-primary hover:border-text-secondary transition-all active:scale-[0.98]"
          >
            <Icon name="plus" size={12} />
            Load Older Activities
          </button>
          
          <p className="text-[9px] font-mono text-text-secondary opacity-40 uppercase tracking-widest">
            Displaying {Math.min(visibleCount, filteredLogs.length)} of {filteredLogs.length} entries
          </p>
        </div>
      )}

      <ConfirmModal
        open={clearConfirmOpen}
        title="Clear all logs"
        message="Clear all logs from all habits? This cannot be undone."
        confirmLabel="Clear all"
        variant="danger"
        onConfirm={() => {
          if (user && authContext.clearAllSyncedLogs) {
            authContext.clearAllSyncedLogs();
          } else {
            setHabits((prev) =>
              prev.map((h) => ({ ...h, logs: [], totalLogs: 0 })),
            );
          }
          setClearConfirmOpen(false);
        }}
        onCancel={() => setClearConfirmOpen(false)}
      />

      <ConfirmModal
        open={deleteConfirmOpen}
        title="Delete selected logs"
        message={`Are you sure you want to delete ${selectedIds.length} selected record${selectedIds.length > 1 ? 's' : ''}? This action is irreversible.`}
        confirmLabel="Delete permanently"
        variant="danger"
        onConfirm={handleDeleteSelected}
        onCancel={() => setDeleteConfirmOpen(false)}
      />

    </div>
  );
};

export default Logs;

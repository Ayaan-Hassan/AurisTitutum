import React, { useState, useMemo } from "react";
import Icon from "./Icon";
import { Card } from "./ui/Card";
import { Button } from "./ui/Button";
import { ConfirmModal } from "./Modals";
import { useAuth } from "../contexts/AuthContext";
import { getLocalDateKey } from "../utils/date";

const RECURRENCE_OPTS = [
  { id: "daily",    label: "Daily" },
  { id: "weekly",   label: "Weekly" },
  { id: "monthly",  label: "Monthly" },
  { id: "one-time", label: "One-Time" },
];

const PRIORITY_MAP = {
  high:   { border: "border-danger/60",       text: "text-danger",     badge: "bg-danger/10 text-danger border-danger/30",       weight: 3, bg: "rgba(239, 68, 68, 0.12)" },
  medium: { border: "border-amber-400/60",    text: "text-amber-400",  badge: "bg-amber-400/10 text-amber-400 border-amber-400/30", weight: 2, bg: "rgba(245, 158, 11, 0.12)" },
  low:    { border: "border-success/60",      text: "text-success",    badge: "bg-success/10 text-success border-success/30",    weight: 1, bg: "rgba(16, 185, 129, 0.12)" },
};

// ── Inline task form ──────────────────────────────────────────────────────────
function TaskForm({ task, activeTab, onSave, onCancel }) {
  const [name,           setName]           = useState(task.name || "");
  const [description,    setDescription]    = useState(task.description || "");
  const [priority,       setPriority]       = useState(task.priority || "medium");
  const [recurrence,     setRecurrence]     = useState(task.recurrence || activeTab || "daily");
  const [dueDate,        setDueDate]        = useState(task.dueDate || "");
  const [hasProgress,    setHasProgress]    = useState(!!task.hasProgress);
  const [targetProgress, setTargetProgress] = useState(task.targetProgress || 10);
  const [progressUnit,   setProgressUnit]   = useState(task.progressUnit || "units");

  const handleSave = () => {
    if (!name.trim()) return;
    onSave({
      ...task,
      id: task.id || `task_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
      name: name.trim(),
      description: description.trim(),
      priority,
      recurrence,
      dueDate: recurrence === "one-time" ? dueDate : "",
      hasProgress,
      targetProgress: hasProgress ? Number(targetProgress) : 0,
      currentProgress: task.currentProgress || 0,
      progressUnit: hasProgress ? progressUnit : "",
      createdBy: task.createdBy || "user",
      createdAt: task.createdAt || new Date().toISOString(),
      category: task.category || "General",
    });
  };

  return (
    <Card className="hover:translate-y-0 hover:shadow-none hover:border-border-color space-y-4 animate-in fade-in duration-200">
      <div className="flex items-center justify-between">
        <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-text-secondary">
          {task.id ? "Edit Task" : "Create Task"}
        </h4>
        <button onClick={onCancel} className="text-text-secondary hover:text-text-primary transition-colors">
          <Icon name="x" size={15} />
        </button>
      </div>

      {/* Name */}
      <input
        type="text"
        autoFocus
        placeholder="Task name…"
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && handleSave()}
        className="w-full bg-bg-main/50 backdrop-blur-sm border border-border-color p-3.5 rounded-xl text-sm font-bold text-text-primary placeholder:text-text-secondary/50 outline-none focus:border-accent transition-all"
      />

      {/* Description */}
      <input
        type="text"
        placeholder="Description (optional)"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        className="w-full bg-bg-main/30 border border-border-color p-3 rounded-xl text-xs text-text-primary placeholder:text-text-secondary/40 outline-none focus:border-accent transition-all"
      />

      {/* Recurrence + Priority dropdowns */}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <label className="text-[9px] font-black uppercase tracking-widest text-text-secondary block ml-0.5">Recurrence</label>
          <div className="relative">
            <select
              value={recurrence}
              onChange={(e) => setRecurrence(e.target.value)}
              className="w-full appearance-none bg-bg-sidebar border border-border-color py-2.5 pl-3 pr-8 rounded-xl text-xs font-bold text-text-primary outline-none focus:border-accent transition-all cursor-pointer"
            >
              {RECURRENCE_OPTS.map((r) => (
                <option key={r.id} value={r.id}>{r.label}</option>
              ))}
            </select>
            <Icon name="chevron-down" size={11} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-text-secondary pointer-events-none" />
          </div>
        </div>
        <div className="space-y-1.5">
          <label className="text-[9px] font-black uppercase tracking-widest text-text-secondary block ml-0.5">Priority</label>
          <div className="relative">
            <select
              value={priority}
              onChange={(e) => setPriority(e.target.value)}
              className="w-full appearance-none bg-bg-sidebar border border-border-color py-2.5 pl-3 pr-8 rounded-xl text-xs font-bold text-text-primary outline-none focus:border-accent transition-all cursor-pointer"
            >
              <option value="high">🔴 High</option>
              <option value="medium">🟡 Medium</option>
              <option value="low">🟢 Low</option>
            </select>
            <Icon name="chevron-down" size={11} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-text-secondary pointer-events-none" />
          </div>
        </div>
      </div>

      {/* Due date (one-time only) labeled clearly */}
      {recurrence === "one-time" && (
        <div className="space-y-1.5 animate-in fade-in duration-200">
          <label className="text-[9px] font-black uppercase tracking-widest text-text-secondary block ml-0.5">Due Date</label>
          <div className="relative">
            <Icon name="calendar" size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary opacity-50" />
            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="w-full bg-bg-main border border-border-color pl-9 pr-3 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest text-text-primary outline-none focus:border-accent"
            />
          </div>
        </div>
      )}

      {/* Progress toggle */}
      <div className="border-t border-border-color/50 pt-3 space-y-3">
        <label className="flex items-center gap-3 cursor-pointer group">
          <div
            onClick={() => setHasProgress((v) => !v)}
            className={`w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 transition-all ${hasProgress ? "bg-accent border-accent text-bg-main" : "border-border-color group-hover:border-accent"}`}
          >
            {hasProgress && <Icon name="check" size={12} />}
          </div>
          <span className="text-xs font-bold text-text-secondary group-hover:text-text-primary transition-colors">Enable progress counter</span>
        </label>
        {hasProgress && (
          <div className="grid grid-cols-2 gap-3 animate-in fade-in duration-200">
            <div className="space-y-1">
              <label className="text-[9px] font-black uppercase tracking-widest text-text-secondary block ml-0.5">Target</label>
              <input
                type="number" min="1" value={targetProgress}
                onChange={(e) => setTargetProgress(e.target.value)}
                className="w-full bg-bg-main border border-border-color p-2.5 rounded-xl text-sm font-mono text-text-primary outline-none focus:border-accent"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[9px] font-black uppercase tracking-widest text-text-secondary block ml-0.5">Unit</label>
              <input
                type="text" placeholder="pages, reps…" value={progressUnit}
                onChange={(e) => setProgressUnit(e.target.value)}
                className="w-full bg-bg-main border border-border-color p-2.5 rounded-xl text-sm text-text-primary outline-none focus:border-accent placeholder:text-text-secondary/40"
              />
            </div>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center justify-end gap-2 border-t border-border-color/50 pt-3">
        <Button onClick={onCancel} variant="outline" size="sm">Cancel</Button>
        <Button onClick={handleSave} variant="primary" size="sm" disabled={!name.trim()}>
          {task.id ? "Save Changes" : "Add Task"}
        </Button>
      </div>
    </Card>
  );
}

// ── Main ChecklistSection ─────────────────────────────────────────────────────
export default function ChecklistSection() {
  const { tasks, updateTasks, addLog, deleteLog, logDocs } = useAuth();
  const [activeTab,    setActiveTab]    = useState("daily");
  const [editingTask,  setEditingTask]  = useState(null);
  const [showAdd,      setShowAdd]      = useState(false);
  const [deleteTaskId, setDeleteTaskId] = useState(null);

  const todayKey = getLocalDateKey();
  const allTasks = Array.isArray(tasks) ? tasks : [];

  const filteredTasks = useMemo(() => {
    return allTasks
      .filter((t) => t.recurrence === activeTab)
      .sort((a, b) => {
        const wA = PRIORITY_MAP[a.priority]?.weight || 1;
        const wB = PRIORITY_MAP[b.priority]?.weight || 1;
        if (wA !== wB) return wB - wA;
        return (a.createdAt || "").localeCompare(b.createdAt || "");
      });
  }, [allTasks, activeTab]);

  const handleToggle = async (task) => {
    const updated = [...allTasks];
    const idx = updated.findIndex((t) => t.id === task.id);
    if (idx === -1) return;
    const t = { ...updated[idx] };
    let nowChecking = false;
    if (t.recurrence === "one-time") {
      t.completed = !t.completed;
      nowChecking = t.completed;
    } else {
      const c = { ...(t.completions || {}) };
      c[todayKey] = !c[todayKey];
      t.completions = c;
      nowChecking = c[todayKey];
    }
    updated[idx] = t;
    await updateTasks(updated);

    // Logs Integration
    if (nowChecking) {
      await addLog({
        habitId: "task_" + task.id,
        habitName: `[Task] ${task.name}`,
        date: todayKey,
        time: new Date().toLocaleTimeString([], { hour: "2-digit", hour12: false }).slice(0, 5),
        amount: 1,
        unit: "task",
        mode: "task_completion",
        type: "Good",
        note: task.description ? task.description : `Completed task: ${task.name}`,
      });
    } else {
      const relevantLogs = (logDocs || [])
        .filter(l => l.habitId === "task_" + task.id && l.date === todayKey)
        .sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));
      if (relevantLogs.length > 0) {
        await deleteLog(relevantLogs[0].id);
      }
    }
  };

  const handleProgressChange = async (task, delta) => {
    const updated = [...allTasks];
    const idx = updated.findIndex((t) => t.id === task.id);
    if (idx === -1) return;
    const t = { ...updated[idx] };
    const max = t.targetProgress || 100;
    const next = Math.max(0, Math.min(max, (t.currentProgress || 0) + delta));
    t.currentProgress = next;
    if (next >= max) {
      if (t.recurrence === "one-time") t.completed = true;
      else t.completions = { ...(t.completions || {}), [todayKey]: true };
    }
    updated[idx] = t;
    await updateTasks(updated);
  };

  const handleSaveTask = async (taskData) => {
    const updated = [...allTasks];
    const idx = updated.findIndex((t) => t.id === taskData.id);
    if (idx >= 0) updated[idx] = taskData;
    else updated.push(taskData);
    await updateTasks(updated);
    setEditingTask(null);
    setShowAdd(false);
  };

  const handleDelete = async (id) => {
    await updateTasks(allTasks.filter((t) => t.id !== id));
    setDeleteTaskId(null);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tighter text-text-primary">Checklist</h2>
          <p className="text-text-secondary text-xs mt-1">Priority tasks and recurring action items.</p>
        </div>
        <Button
          variant="primary"
          icon="plus"
          onClick={() => { setShowAdd(true); setEditingTask(null); }}
        >
          New Task
        </Button>
      </div>

      {/* Add Form */}
      {showAdd && !editingTask && (
        <TaskForm
          task={{ name: "", priority: "medium", recurrence: activeTab, category: "General" }}
          activeTab={activeTab}
          onSave={handleSaveTask}
          onCancel={() => setShowAdd(false)}
        />
      )}

      {/* Recurrence Tabs */}
      <div className="flex items-center gap-1 overflow-x-auto custom-scrollbar pb-1">
        {RECURRENCE_OPTS.map((tab) => {
          const count = allTasks.filter((t) => t.recurrence === tab.id).length;
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest whitespace-nowrap border transition-all ${
                active
                  ? "bg-accent text-bg-main border-accent shadow-sm"
                  : "bg-bg-main border-border-color text-text-secondary hover:text-text-primary hover:border-text-secondary"
              }`}
            >
              {tab.label}
              {count > 0 && (
                <span className={`text-[8px] font-mono px-1.5 py-0.5 rounded-full ${active ? "bg-bg-main/20 text-bg-main" : "bg-accent-dim text-text-secondary"}`}>
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Task List */}
      <div className="space-y-2">
        {filteredTasks.length === 0 && !showAdd ? (
          <div className="py-12 text-center border border-dashed border-border-color rounded-2xl">
            <Icon name="check-circle-2" size={28} className="text-text-secondary/30 mx-auto mb-2" />
            <p className="text-xs font-bold text-text-secondary">No {RECURRENCE_OPTS.find((t) => t.id === activeTab)?.label} tasks yet.</p>
            <button
              onClick={() => setShowAdd(true)}
              className="text-[10px] font-bold uppercase tracking-widest text-accent mt-2 hover:underline"
            >
              Add one →
            </button>
          </div>
        ) : (
          filteredTasks.map((task) => {
            const isDone = task.recurrence === "one-time" ? !!task.completed : !!task.completions?.[todayKey];
            const prio = PRIORITY_MAP[task.priority] || PRIORITY_MAP.medium;

            if (editingTask?.id === task.id) {
              return (
                <TaskForm
                  key={task.id}
                  task={task}
                  activeTab={activeTab}
                  onSave={handleSaveTask}
                  onCancel={() => setEditingTask(null)}
                />
              );
            }

            return (
              <div
                key={task.id}
                className={`flex items-start gap-3 border-l-2 pl-3 py-2.5 pr-2 group transition-all rounded-r-xl ${
                  isDone ? "border-border-color opacity-50" : prio.border
                }`}
                style={{ backgroundColor: isDone ? "transparent" : prio.bg }}
              >
                {/* Checkbox */}
                <button
                  onClick={() => handleToggle(task)}
                  className={`mt-0.5 w-5 h-5 rounded-md border-2 shrink-0 flex items-center justify-center transition-all ${
                    isDone ? "bg-success/20 border-success/50" : `border-border-color hover:border-accent`
                  }`}
                >
                  {isDone && <Icon name="check" size={11} className="text-success" />}
                </button>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className={`text-sm font-bold truncate ${isDone ? "line-through text-text-secondary" : "text-text-primary"}`}>
                      {task.name}
                    </p>
                    <span className={`text-[8px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded border shrink-0 ${prio.badge}`}>
                      {task.priority}
                    </span>
                    {task.dueDate && task.recurrence === "one-time" && (
                      <span className="text-[9px] font-mono text-text-secondary bg-bg-main px-2 py-0.5 rounded-lg border border-border-color flex items-center gap-1 shrink-0">
                        <Icon name="calendar" size={9} />Due: {task.dueDate}
                      </span>
                    )}
                  </div>
                  {task.description && (
                    <p className="text-[10px] text-text-secondary mt-0.5 truncate">{task.description}</p>
                  )}
                  {/* Progress bar */}
                  {task.hasProgress && task.targetProgress > 0 && (
                    <div className="mt-2 flex items-center gap-2 max-w-xs">
                      <div className="flex-1 h-1.5 bg-bg-main rounded-full overflow-hidden border border-border-color">
                        <div
                          className="h-full bg-accent transition-all duration-500"
                          style={{ width: `${Math.min(100, ((task.currentProgress || 0) / task.targetProgress) * 100)}%` }}
                        />
                      </div>
                      <span className="text-[9px] font-mono text-text-secondary shrink-0">
                        {task.currentProgress || 0}/{task.targetProgress} {task.progressUnit || ""}
                      </span>
                      <button
                        onClick={() => handleProgressChange(task, -1)}
                        className="w-4 h-4 rounded flex items-center justify-center border border-border-color text-text-secondary hover:text-text-primary text-[10px] font-bold"
                      >−</button>
                      <button
                        onClick={() => handleProgressChange(task, 1)}
                        className="w-4 h-4 rounded flex items-center justify-center border border-border-color text-text-secondary hover:text-text-primary text-[10px] font-bold"
                      >+</button>
                    </div>
                  )}
                </div>

                {/* Edit / Delete */}
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0 bg-bg-main/60 backdrop-blur-md rounded-lg p-0.5 border border-border-color/50">
                  <button
                    onClick={() => { setEditingTask(task); setShowAdd(false); }}
                    className="w-7 h-7 rounded-md flex items-center justify-center text-text-secondary hover:text-accent hover:bg-accent/10 transition-colors"
                  >
                    <Icon name="pencil" size={12} />
                  </button>
                  <button
                    onClick={() => setDeleteTaskId(task.id)}
                    className="w-7 h-7 rounded-md flex items-center justify-center text-text-secondary hover:text-danger hover:bg-danger/10 transition-colors"
                  >
                    <Icon name="trash" size={12} />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      <ConfirmModal
        open={!!deleteTaskId}
        title="Delete Task"
        message="Remove this task from your checklist permanently?"
        confirmLabel="Delete"
        variant="danger"
        onConfirm={() => handleDelete(deleteTaskId)}
        onCancel={() => setDeleteTaskId(null)}
      />
    </div>
  );
}

// Re-export TaskFormModal for any external usage
export function TaskFormModal({ task, onSave, onClose }) {
  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center z-[150] p-4 animate-in fade-in">
      <div className="w-full max-w-md">
        <TaskForm task={task} onSave={onSave} onCancel={onClose} />
      </div>
    </div>
  );
}

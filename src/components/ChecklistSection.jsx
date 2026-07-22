import React, { useState, useMemo } from "react";
import Icon from "./Icon";
import { Card } from "./ui/Card";
import { Button } from "./ui/Button";
import { ConfirmModal } from "./Modals";
import { useAuth } from "../contexts/AuthContext";
import { getLocalDateKey } from "../utils/date";

const RECURRENCE_TABS = [
  { id: "daily", label: "Daily Tasks" },
  { id: "weekly", label: "Weekly Tasks" },
  { id: "monthly", label: "Monthly Tasks" },
  { id: "one-time", label: "One-Time Tasks" },
];

const PRIORITY_THEMES = {
  high: {
    label: "High Priority",
    border: "border-red-500/60",
    bg: "bg-red-500/10",
    badge: "bg-red-500/20 text-red-400 border-red-500/40",
    bar: "bg-red-500",
    weight: 3,
  },
  medium: {
    label: "Medium Priority",
    border: "border-amber-500/60",
    bg: "bg-amber-500/10",
    badge: "bg-amber-500/20 text-amber-400 border-amber-500/40",
    bar: "bg-amber-500",
    weight: 2,
  },
  low: {
    label: "Low Priority",
    border: "border-emerald-500/60",
    bg: "bg-emerald-500/10",
    badge: "bg-emerald-500/20 text-emerald-400 border-emerald-500/40",
    bar: "bg-emerald-500",
    weight: 1,
  },
};

const CATEGORIES = ["General", "Health", "Work", "Study", "Fitness", "Personal", "Mindset"];

export default function ChecklistSection({ onOpenTaskForm }) {
  const { tasks, updateTasks } = useAuth();
  const [activeTab, setActiveTab] = useState("daily");
  const [editingTask, setEditingTask] = useState(null);
  const [deleteTaskId, setDeleteTaskId] = useState(null);

  const todayKey = getLocalDateKey();

  // Filter & sort tasks for active tab
  const filteredTasks = useMemo(() => {
    if (!tasks || !Array.isArray(tasks)) return [];
    return tasks
      .filter((t) => t.recurrence === activeTab)
      .sort((a, b) => {
        // High priority first
        const pA = PRIORITY_THEMES[a.priority]?.weight || 1;
        const pB = PRIORITY_THEMES[b.priority]?.weight || 1;
        if (pA !== pB) return pB - pA;
        return (a.createdAt || "").localeCompare(b.createdAt || "");
      });
  }, [tasks, activeTab]);

  // Task Completion handler
  const handleToggleTask = async (task) => {
    let updatedTasks = [...(tasks || [])];
    const index = updatedTasks.findIndex((t) => t.id === task.id);
    if (index === -1) return;

    const target = { ...updatedTasks[index] };
    if (target.recurrence === "one-time") {
      target.completed = !target.completed;
    } else {
      const completions = { ...(target.completions || {}) };
      completions[todayKey] = !completions[todayKey];
      target.completions = completions;
    }

    updatedTasks[index] = target;
    await updateTasks(updatedTasks);
  };

  // Numeric Progress Handler
  const handleProgressChange = async (task, delta) => {
    let updatedTasks = [...(tasks || [])];
    const index = updatedTasks.findIndex((t) => t.id === task.id);
    if (index === -1) return;

    const target = { ...updatedTasks[index] };
    const maxTarget = target.targetProgress || 100;
    const current = target.currentProgress || 0;
    const nextVal = Math.max(0, Math.min(maxTarget, current + delta));

    target.currentProgress = nextVal;
    if (nextVal >= maxTarget) {
      if (target.recurrence === "one-time") target.completed = true;
      else {
        target.completions = { ...(target.completions || {}), [todayKey]: true };
      }
    }

    updatedTasks[index] = target;
    await updateTasks(updatedTasks);
  };

  const handleDeleteTask = async (taskId) => {
    const updated = (tasks || []).filter((t) => t.id !== taskId);
    await updateTasks(updated);
    setDeleteTaskId(null);
  };

  const handleSaveTask = async (taskData) => {
    let updated = [...(tasks || [])];
    const idx = updated.findIndex((t) => t.id === taskData.id);
    if (idx >= 0) {
      updated[idx] = taskData;
    } else {
      updated.push(taskData);
    }
    await updateTasks(updated);
    setEditingTask(null);
  };

  return (
    <div className="space-y-6">
      {/* Title & Section Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h3 className="text-2xl font-bold tracking-tight text-text-primary flex items-center gap-2.5">
            <Icon name="check-square" size={24} className="text-accent" /> Checklist & Tasks
          </h3>
          <p className="text-xs text-text-secondary mt-0.5">
            Organized priority action items & recurring tasks protocol.
          </p>
        </div>

        <Button
          variant="primary"
          size="sm"
          onClick={() => onOpenTaskForm?.() || setEditingTask({ name: "", priority: "medium", recurrence: activeTab, category: "General" })}
          className="rounded-xl text-xs uppercase font-black tracking-widest shadow-lg shadow-accent/20"
        >
          <Icon name="plus" size={14} className="mr-1.5" /> Create Task
        </Button>
      </div>

      {/* Recurrence Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto custom-scrollbar pb-1 border-b border-border-color">
        {RECURRENCE_TABS.map((tab) => {
          const count = (tasks || []).filter((t) => t.recurrence === tab.id).length;
          const isSelected = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all flex items-center gap-2 whitespace-nowrap border ${
                isSelected
                  ? "bg-accent text-bg-main border-accent shadow-md"
                  : "bg-bg-sidebar text-text-secondary border-border-color hover:text-text-primary"
              }`}
            >
              <span>{tab.label}</span>
              {count > 0 && (
                <span className={`px-1.5 py-0.5 rounded-full text-[9px] font-mono ${isSelected ? "bg-bg-main/20 text-bg-main" : "bg-accent-dim text-text-secondary"}`}>
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Task List */}
      <div className="space-y-3">
        {filteredTasks.length === 0 ? (
          <Card className="p-8 text-center flex flex-col items-center justify-center border-dashed border-2 border-border-color">
            <Icon name="check-circle-2" size={36} className="text-text-secondary/40 mb-2" />
            <h4 className="text-sm font-bold text-text-primary">No {RECURRENCE_TABS.find((t) => t.id === activeTab)?.label} Found</h4>
            <p className="text-xs text-text-secondary mt-0.5 mb-4">Add your priority tasks to stay on track.</p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setEditingTask({ name: "", priority: "medium", recurrence: activeTab, category: "General" })}
              className="rounded-xl text-xs uppercase font-bold"
            >
              <Icon name="plus" size={14} className="mr-1.5" /> Add Task
            </Button>
          </Card>
        ) : (
          filteredTasks.map((task) => {
            const priorityObj = PRIORITY_THEMES[task.priority] || PRIORITY_THEMES.medium;
            const isDone = task.recurrence === "one-time" ? !!task.completed : !!task.completions?.[todayKey];

            return (
              <Card
                key={task.id}
                className={`group relative overflow-hidden transition-all border-2 ${priorityObj.border} ${priorityObj.bg} hover:shadow-lg ${isDone ? "opacity-60" : ""}`}
              >
                <div className={`absolute left-0 top-0 bottom-0 w-1.5 ${priorityObj.bar}`} />

                <div className="flex items-center justify-between gap-4 pl-3 pr-2 py-1">
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    {/* Checkbox Button */}
                    <button
                      onClick={() => handleToggleTask(task)}
                      className={`w-7 h-7 rounded-xl border-2 flex items-center justify-center transition-all shrink-0 ${
                        isDone
                          ? "bg-emerald-500 border-emerald-500 text-bg-main shadow-md"
                          : "border-border-color bg-bg-main hover:border-accent"
                      }`}
                    >
                      {isDone && <Icon name="check" size={16} />}
                    </button>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        {task.emoji && <span className="text-base">{task.emoji}</span>}
                        <h4 className={`text-base font-bold text-text-primary tracking-tight truncate ${isDone ? "line-through text-text-secondary" : ""}`}>
                          {task.name}
                        </h4>
                        <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded border ${priorityObj.badge}`}>
                          {priorityObj.label}
                        </span>
                        {task.dueDate && (
                          <span className="text-[9px] font-mono text-text-secondary bg-bg-sidebar px-2 py-0.5 rounded border border-border-color flex items-center gap-1">
                            <Icon name="calendar" size={10} /> {task.dueDate}
                          </span>
                        )}
                      </div>

                      {task.description && (
                        <p className="text-xs text-text-secondary mt-0.5 truncate">{task.description}</p>
                      )}

                      {/* Numeric Progress Bar if enabled */}
                      {task.hasProgress && task.targetProgress > 0 && (
                        <div className="mt-2 flex items-center gap-3 max-w-xs">
                          <div className="flex-1 bg-bg-main/60 h-2 rounded-full overflow-hidden border border-border-color">
                            <div
                              className="bg-accent h-full transition-all duration-300"
                              style={{ width: `${Math.min(100, ((task.currentProgress || 0) / task.targetProgress) * 100)}%` }}
                            />
                          </div>
                          <span className="text-[10px] font-mono font-bold text-text-secondary shrink-0">
                            {task.currentProgress || 0}/{task.targetProgress} {task.progressUnit || ""}
                          </span>
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => handleProgressChange(task, -1)}
                              className="w-5 h-5 rounded bg-bg-main border border-border-color flex items-center justify-center text-text-secondary hover:text-text-primary"
                            >
                              -
                            </button>
                            <button
                              onClick={() => handleProgressChange(task, 1)}
                              className="w-5 h-5 rounded bg-bg-main border border-border-color flex items-center justify-center text-text-secondary hover:text-text-primary"
                            >
                              +
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Options */}
                  <div className="flex items-center gap-1 shrink-0">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setEditingTask(task)}
                      className="w-8 h-8 p-0 rounded-xl hover:bg-bg-sidebar text-text-secondary hover:text-text-primary"
                    >
                      <Icon name="edit-3" size={13} />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setDeleteTaskId(task.id)}
                      className="w-8 h-8 p-0 rounded-xl hover:bg-red-500/10 text-text-secondary hover:text-red-400"
                    >
                      <Icon name="trash" size={13} />
                    </Button>
                  </div>
                </div>
              </Card>
            );
          })
        )}
      </div>

      {/* Task Edit/Create Modal */}
      {editingTask && (
        <TaskFormModal
          task={editingTask}
          onSave={handleSaveTask}
          onClose={() => setEditingTask(null)}
        />
      )}

      {/* Confirm Delete Modal */}
      <ConfirmModal
        open={!!deleteTaskId}
        title="Delete Task"
        message="Are you sure you want to remove this task from your checklist?"
        confirmLabel="Delete"
        variant="danger"
        onConfirm={() => handleDeleteTask(deleteTaskId)}
        onCancel={() => setDeleteTaskId(null)}
      />
    </div>
  );
}

// ── Task Form Modal ──
export function TaskFormModal({ task, onSave, onClose }) {
  const [name, setName] = useState(task.name || "");
  const [description, setDescription] = useState(task.description || "");
  const [emoji, setEmoji] = useState(task.emoji || "📋");
  const [priority, setPriority] = useState(task.priority || "medium");
  const [recurrence, setRecurrence] = useState(task.recurrence || "daily");
  const [dueDate, setDueDate] = useState(task.dueDate || getLocalDateKey());
  const [category, setCategory] = useState(task.category || "General");
  const [hasProgress, setHasProgress] = useState(!!task.hasProgress);
  const [targetProgress, setTargetProgress] = useState(task.targetProgress || 10);
  const [progressUnit, setProgressUnit] = useState(task.progressUnit || "units");

  const EMOJI_OPTIONS = ["📋", "🎯", "⚽", "📚", "💻", "🧘", "🥗", "💊", "🏃", "⚡", "🔥", "🎨"];

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    onSave({
      ...task,
      id: task.id || `task_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
      name: name.trim(),
      description: description.trim(),
      emoji,
      priority,
      recurrence,
      dueDate,
      category,
      hasProgress,
      targetProgress: hasProgress ? Number(targetProgress) : 0,
      currentProgress: task.currentProgress || 0,
      createdBy: task.createdBy || "user",
      createdAt: task.createdAt || new Date().toISOString(),
    });
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-md flex items-center justify-center z-[150] p-4 animate-in fade-in">
      <div className="glass-card w-full max-w-md p-6 rounded-[2rem] border-white/10 relative">
        <h3 className="text-xl font-bold text-text-primary flex items-center gap-2 mb-6">
          <Icon name="check-square" size={20} className="text-accent" />
          {task.id ? "Edit Task" : "Create New Task"}
        </h3>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-[10px] font-black uppercase tracking-widest text-text-secondary block mb-1">Task Name</label>
            <input
              type="text"
              required
              placeholder="e.g. Complete math chapter, 50 football passes"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-bg-main border border-border-color p-3 rounded-xl text-sm outline-none focus:border-accent text-text-primary"
            />
          </div>

          <div>
            <label className="text-[10px] font-black uppercase tracking-widest text-text-secondary block mb-1">Description (Optional)</label>
            <input
              type="text"
              placeholder="Additional details..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full bg-bg-main border border-border-color p-3 rounded-xl text-sm outline-none focus:border-accent text-text-primary"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] font-black uppercase tracking-widest text-text-secondary block mb-1">Recurrence</label>
              <select
                value={recurrence}
                onChange={(e) => setRecurrence(e.target.value)}
                className="w-full bg-bg-main border border-border-color p-3 rounded-xl text-sm outline-none focus:border-accent text-text-primary"
              >
                <option value="daily">Daily Task</option>
                <option value="weekly">Weekly Task</option>
                <option value="monthly">Monthly Task</option>
                <option value="one-time">One-Time Task</option>
              </select>
            </div>

            <div>
              <label className="text-[10px] font-black uppercase tracking-widest text-text-secondary block mb-1">Priority</label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value)}
                className="w-full bg-bg-main border border-border-color p-3 rounded-xl text-sm outline-none focus:border-accent text-text-primary font-bold"
              >
                <option value="high">🔴 High Priority</option>
                <option value="medium">🟡 Medium Priority</option>
                <option value="low">🟢 Low Priority</option>
              </select>
            </div>
          </div>

          {recurrence === "one-time" && (
            <div>
              <label className="text-[10px] font-black uppercase tracking-widest text-text-secondary block mb-1">Due Date</label>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full bg-bg-main border border-border-color p-3 rounded-xl text-sm outline-none focus:border-accent text-text-primary"
              />
            </div>
          )}

          {/* Emoji Selection */}
          <div>
            <label className="text-[10px] font-black uppercase tracking-widest text-text-secondary block mb-1">Emoji Icon</label>
            <div className="flex gap-2 flex-wrap">
              {EMOJI_OPTIONS.map((e) => (
                <button
                  key={e}
                  type="button"
                  onClick={() => setEmoji(e)}
                  className={`w-9 h-9 rounded-xl flex items-center justify-center text-lg transition-all ${
                    emoji === e ? "bg-accent/20 border-2 border-accent scale-110" : "bg-bg-main border border-border-color"
                  }`}
                >
                  {e}
                </button>
              ))}
            </div>
          </div>

          {/* Numeric Progress Checkbox */}
          <div className="pt-2">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={hasProgress}
                onChange={(e) => setHasProgress(e.target.checked)}
                className="w-4 h-4 rounded text-accent"
              />
              <span className="text-xs font-bold text-text-primary">Enable Progress Counter (e.g. 0/50 questions)</span>
            </label>

            {hasProgress && (
              <div className="grid grid-cols-2 gap-3 mt-3 animate-in fade-in">
                <div>
                  <label className="text-[9px] font-black uppercase tracking-widest text-text-secondary block mb-1">Target Amount</label>
                  <input
                    type="number"
                    min="1"
                    value={targetProgress}
                    onChange={(e) => setTargetProgress(e.target.value)}
                    className="w-full bg-bg-main border border-border-color p-2.5 rounded-xl text-sm outline-none font-mono"
                  />
                </div>
                <div>
                  <label className="text-[9px] font-black uppercase tracking-widest text-text-secondary block mb-1">Unit Label</label>
                  <input
                    type="text"
                    placeholder="questions, pages"
                    value={progressUnit}
                    onChange={(e) => setProgressUnit(e.target.value)}
                    className="w-full bg-bg-main border border-border-color p-2.5 rounded-xl text-sm outline-none"
                  />
                </div>
              </div>
            )}
          </div>

          <div className="flex gap-3 pt-4">
            <Button variant="ghost" type="button" onClick={onClose} className="flex-1 rounded-xl">
              Cancel
            </Button>
            <Button variant="primary" type="submit" className="flex-1 rounded-xl shadow-lg">
              Save Task
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

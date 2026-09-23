"use client";

import { useState, useTransition } from "react";
import {
  CheckSquare,
  Square,
  Clock,
  Calendar,
  AlertTriangle,
  Building,
  Target,
  User,
  Trash2,
  Edit2,
  Search,
  Filter,
} from "lucide-react";
import { toggleTaskStatusAction, deleteTaskAction } from "@/actions/tasks";
import { TaskItem, TaskPriority } from "@/lib/validations/tasks";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface TaskListProps {
  tasks: TaskItem[];
  summary: {
    total: number;
    dueToday: number;
    overdue: number;
    upcoming: number;
    completed: number;
  };
  onEditTask: (task: TaskItem) => void;
  onRefresh: () => void;
}

export function TaskList({
  tasks,
  summary,
  onEditTask,
  onRefresh,
}: TaskListProps) {
  const [activeTab, setActiveTab] = useState<
    "all" | "today" | "overdue" | "upcoming" | "completed"
  >("all");
  const [search, setSearch] = useState("");
  const [selectedPriority, setSelectedPriority] = useState<string>("ALL");
  const [isPending, startTransition] = useTransition();

  const todayStr = new Date().toISOString().split("T")[0];

  // Client-side filtering across tabs, priority & search
  const filteredTasks = tasks.filter((t) => {
    // Tab filter
    if (activeTab === "today") {
      if (t.dueAt !== todayStr || t.status === "COMPLETED") return false;
    } else if (activeTab === "overdue") {
      if (t.dueAt >= todayStr || t.status === "COMPLETED" || t.status === "CANCELLED") {
        return false;
      }
    } else if (activeTab === "upcoming") {
      if (t.dueAt <= todayStr || t.status === "COMPLETED") return false;
    } else if (activeTab === "completed") {
      if (t.status !== "COMPLETED") return false;
    }

    // Priority filter
    if (selectedPriority !== "ALL" && t.priority !== selectedPriority) {
      return false;
    }

    // Search query
    if (search.trim()) {
      const q = search.toLowerCase();
      const matchesTitle = t.title.toLowerCase().includes(q);
      const matchesDesc = t.description?.toLowerCase().includes(q);
      const matchesLead = t.leadName?.toLowerCase().includes(q);
      const matchesCompany = t.companyName?.toLowerCase().includes(q);
      const matchesOpp = t.opportunityName?.toLowerCase().includes(q);
      if (!matchesTitle && !matchesDesc && !matchesLead && !matchesCompany && !matchesOpp) {
        return false;
      }
    }

    return true;
  });

  const handleToggle = (task: TaskItem) => {
    const willBeCompleted = task.status !== "COMPLETED";
    startTransition(async () => {
      await toggleTaskStatusAction(task.id, willBeCompleted);
      onRefresh();
    });
  };

  const handleDelete = (id: string) => {
    if (!confirm("Are you sure you want to delete this task?")) return;
    startTransition(async () => {
      await deleteTaskAction(id);
      onRefresh();
    });
  };

  const getPriorityBadge = (p: TaskPriority) => {
    switch (p) {
      case "URGENT":
        return "bg-rose-50 text-rose-700 border-rose-200";
      case "HIGH":
        return "bg-amber-50 text-amber-700 border-amber-200";
      case "MEDIUM":
        return "bg-blue-50 text-blue-700 border-blue-200";
      case "LOW":
        return "bg-slate-100 text-slate-600 border-slate-200";
    }
  };

  return (
    <div className="space-y-4">
      {/* Top Filter and Tab Bar */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs space-y-3">
        {/* Navigation Tabs */}
        <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 pb-3">
          <button
            type="button"
            onClick={() => setActiveTab("all")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              activeTab === "all"
                ? "bg-slate-900 text-white"
                : "text-slate-600 hover:bg-slate-100"
            }`}
          >
            All Tasks ({summary.total})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("today")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              activeTab === "today"
                ? "bg-amber-600 text-white"
                : "text-slate-600 hover:bg-slate-100"
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            <span>Due Today ({summary.dueToday})</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("overdue")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              activeTab === "overdue"
                ? "bg-red-600 text-white"
                : "text-slate-600 hover:bg-slate-100"
            }`}
          >
            <AlertTriangle className="w-3.5 h-3.5" />
            <span>Overdue ({summary.overdue})</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("upcoming")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              activeTab === "upcoming"
                ? "bg-blue-600 text-white"
                : "text-slate-600 hover:bg-slate-100"
            }`}
          >
            <Calendar className="w-3.5 h-3.5" />
            <span>Upcoming ({summary.upcoming})</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("completed")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              activeTab === "completed"
                ? "bg-emerald-600 text-white"
                : "text-slate-600 hover:bg-slate-100"
            }`}
          >
            <CheckSquare className="w-3.5 h-3.5" />
            <span>Completed ({summary.completed})</span>
          </button>
        </div>

        {/* Search & Priority Controls */}
        <div className="flex flex-col sm:flex-row items-center gap-3">
          <div className="relative flex-1 w-full">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search tasks, descriptions, companies, or deals..."
              className="pl-9 h-9 text-xs"
            />
          </div>
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <Filter className="w-4 h-4 text-slate-400 shrink-0" />
            <select
              value={selectedPriority}
              onChange={(e) => setSelectedPriority(e.target.value)}
              className="h-9 px-2.5 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="ALL">All Priorities</option>
              <option value="URGENT">Urgent Only</option>
              <option value="HIGH">High Priority</option>
              <option value="MEDIUM">Medium Priority</option>
              <option value="LOW">Low Priority</option>
            </select>
          </div>
        </div>
      </div>

      {/* Task List Items */}
      {filteredTasks.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center shadow-xs">
          <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-3">
            <CheckSquare className="w-6 h-6" />
          </div>
          <h4 className="text-sm font-semibold text-slate-800">No tasks found</h4>
          <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
            {search.trim()
              ? "No tasks match your search criteria. Try a different query."
              : "You're all caught up! Create a new task or check a different tab."}
          </p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {filteredTasks.map((task) => {
            const isCompleted = task.status === "COMPLETED";
            const isOverdue = task.dueAt < todayStr && !isCompleted;
            const isToday = task.dueAt === todayStr && !isCompleted;

            return (
              <div
                key={task.id}
                className={`group relative bg-white rounded-xl border transition-all hover:shadow-xs p-4 flex items-start gap-3.5 ${
                  isCompleted
                    ? "border-slate-200/80 bg-slate-50/50 opacity-75"
                    : isOverdue
                    ? "border-red-200 bg-red-50/20"
                    : isToday
                    ? "border-amber-200 bg-amber-50/20"
                    : "border-slate-200"
                }`}
              >
                {/* Completion Checkbox */}
                <button
                  type="button"
                  onClick={() => handleToggle(task)}
                  disabled={isPending}
                  className={`mt-0.5 shrink-0 rounded text-slate-400 hover:text-blue-600 transition-colors ${
                    isCompleted ? "text-emerald-600" : ""
                  }`}
                  aria-label={isCompleted ? "Mark incomplete" : "Mark complete"}
                >
                  {isCompleted ? (
                    <CheckSquare className="w-5 h-5 text-emerald-600 fill-emerald-50" />
                  ) : (
                    <Square className="w-5 h-5" />
                  )}
                </button>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <span
                      className={`text-sm font-semibold truncate ${
                        isCompleted
                          ? "line-through text-slate-400"
                          : "text-slate-900 group-hover:text-blue-600 cursor-pointer"
                      }`}
                      onClick={() => onEditTask(task)}
                    >
                      {task.title}
                    </span>

                    {/* Priority Badge */}
                    <span
                      className={`text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full border ${getPriorityBadge(
                        task.priority
                      )}`}
                    >
                      {task.priority}
                    </span>

                    {/* Due Date Indicator */}
                    <span
                      className={`inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded border ${
                        isCompleted
                          ? "bg-slate-100 text-slate-500 border-slate-200"
                          : isOverdue
                          ? "bg-red-50 text-red-700 border-red-200 font-semibold"
                          : isToday
                          ? "bg-amber-50 text-amber-700 border-amber-200 font-semibold"
                          : "bg-slate-50 text-slate-600 border-slate-200"
                      }`}
                    >
                      <Clock className="w-3 h-3" />
                      {isToday
                        ? "Today"
                        : isOverdue
                        ? `Overdue (${task.dueAt})`
                        : `Due ${task.dueAt}`}
                    </span>
                  </div>

                  {task.description && (
                    <p
                      className={`text-xs mt-1 line-clamp-2 ${
                        isCompleted ? "text-slate-400" : "text-slate-600"
                      }`}
                    >
                      {task.description}
                    </p>
                  )}

                  {/* Association metadata tags */}
                  <div className="flex flex-wrap items-center gap-3 mt-2 text-[11px] text-slate-500">
                    {task.companyName && (
                      <span className="inline-flex items-center gap-1 bg-slate-100 px-2 py-0.5 rounded text-slate-700">
                        <Building className="w-3 h-3 text-slate-400" />
                        <span>{task.companyName}</span>
                      </span>
                    )}

                    {task.opportunityName && (
                      <span className="inline-flex items-center gap-1 bg-blue-50 px-2 py-0.5 rounded text-blue-700 font-medium">
                        <Target className="w-3 h-3 text-blue-500" />
                        <span>{task.opportunityName}</span>
                      </span>
                    )}

                    {task.leadName && (
                      <span className="inline-flex items-center gap-1 bg-amber-50 px-2 py-0.5 rounded text-amber-700">
                        <User className="w-3 h-3 text-amber-500" />
                        <span>Lead: {task.leadName}</span>
                      </span>
                    )}

                    <span className="text-slate-400">
                      Assigned: <strong className="text-slate-600 font-medium">{task.assignedToName}</strong>
                    </span>
                  </div>
                </div>

                {/* Right Action Icons */}
                <div className="shrink-0 flex items-center gap-1 opacity-80 group-hover:opacity-100 transition-opacity">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0 text-slate-400 hover:text-slate-700"
                    onClick={() => onEditTask(task)}
                    title="Edit Task"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0 text-slate-400 hover:text-red-600"
                    onClick={() => handleDelete(task.id)}
                    title="Delete Task"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

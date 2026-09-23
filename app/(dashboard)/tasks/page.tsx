"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Clock,
  AlertTriangle,
  Calendar,
  CheckCircle2,
  Plus,
} from "lucide-react";
import { getTasksAction } from "@/actions/tasks";
import { Button } from "@/components/ui/button";
import { TaskList } from "@/features/tasks/components/task-list";
import { TaskModal } from "@/features/tasks/components/task-modal";
import { TaskItem } from "@/lib/validations/tasks";

export default function TasksPage() {
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [summary, setSummary] = useState({
    total: 0,
    dueToday: 0,
    overdue: 0,
    upcoming: 0,
    completed: 0,
  });
  const [isLoading, setIsLoading] = useState(true);

  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [taskToEdit, setTaskToEdit] = useState<TaskItem | null>(null);

  const loadTasks = useCallback(async () => {
    setIsLoading(true);
    const res = await getTasksAction();
    if (res.success && res.data) {
      setTasks(res.data.items);
      setSummary(res.data.summary);
    }
    setIsLoading(false);
  }, []);

  useEffect(() => {
    loadTasks();
  }, [loadTasks]);

  const handleOpenCreate = () => {
    setTaskToEdit(null);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (task: TaskItem) => {
    setTaskToEdit(task);
    setIsModalOpen(true);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Tasks &amp; Follow-ups
          </h1>
          <p className="text-sm text-slate-500">
            Keep pipeline deals progressing. Track due today, overdue reminders, and completed action items.
          </p>
        </div>
        <Button
          onClick={handleOpenCreate}
          className="gap-2 shrink-0 bg-blue-600 hover:bg-blue-700 text-white"
        >
          <Plus className="w-4 h-4" />
          <span>New Task</span>
        </Button>
      </div>

      {/* KPI Metric Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-xs font-medium">Due Today</span>
            <div className="p-1.5 rounded-lg bg-amber-50 text-amber-600">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-slate-900">
            {isLoading ? "..." : summary.dueToday}
          </div>
          <p className="text-[11px] text-amber-600 font-medium mt-1">
            Action required before day end
          </p>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-xs font-medium">Overdue</span>
            <div className="p-1.5 rounded-lg bg-red-50 text-red-600">
              <AlertTriangle className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-slate-900">
            {isLoading ? "..." : summary.overdue}
          </div>
          <p className="text-[11px] text-red-600 font-medium mt-1">
            Missed deadlines needing attention
          </p>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-xs font-medium">Upcoming</span>
            <div className="p-1.5 rounded-lg bg-blue-50 text-blue-600">
              <Calendar className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-slate-900">
            {isLoading ? "..." : summary.upcoming}
          </div>
          <p className="text-[11px] text-slate-500 mt-1">
            Scheduled for coming days &amp; weeks
          </p>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-xs font-medium">Completed</span>
            <div className="p-1.5 rounded-lg bg-emerald-50 text-emerald-600">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-slate-900">
            {isLoading ? "..." : summary.completed}
          </div>
          <p className="text-[11px] text-emerald-600 font-medium mt-1">
            Tasks completed
          </p>
        </div>
      </div>

      {/* Task List */}
      <TaskList
        tasks={tasks}
        summary={summary}
        onEditTask={handleOpenEdit}
        onRefresh={loadTasks}
      />

      {/* Task Create / Edit Modal */}
      <TaskModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSuccess={loadTasks}
        taskToEdit={taskToEdit}
      />
    </div>
  );
}

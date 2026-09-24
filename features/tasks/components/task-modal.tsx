"use client";

import { useState, useEffect, useTransition } from "react";
import { CheckSquare, AlertCircle } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { createTaskAction, updateTaskAction } from "@/actions/tasks";
import { getCompaniesAction } from "@/actions/companies";
import type { CompanyItem } from "@/lib/validations/companies";
import { getOpportunitiesAction } from "@/actions/opportunities";
import type { OpportunityItem } from "@/lib/validations/opportunities";
import { getLeadsAction } from "@/actions/leads";
import type { LeadItem } from "@/lib/validations/leads";
import {
  TASK_PRIORITIES,
  TASK_STATUSES,
  TaskItem,
  TaskPriority,
  TaskStatus,
} from "@/lib/validations/tasks";

interface TaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  taskToEdit?: TaskItem | null;
  defaultLeadId?: string;
  defaultCompanyId?: string;
  defaultOpportunityId?: string;
}

export function TaskModal({
  isOpen,
  onClose,
  onSuccess,
  taskToEdit,
  defaultLeadId,
  defaultCompanyId,
  defaultOpportunityId,
}: TaskModalProps) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [companies, setCompanies] = useState<CompanyItem[]>([]);
  const [opportunities, setOpportunities] = useState<OpportunityItem[]>([]);
  const [leads, setLeads] = useState<LeadItem[]>([]);
  const [isLoadingRelated, setIsLoadingRelated] = useState(false);

  const [title, setTitle] = useState("");
  const [dueAt, setDueAt] = useState("");
  const [priority, setPriority] = useState<TaskPriority>("MEDIUM");
  const [status, setStatus] = useState<TaskStatus>("PENDING");
  const [description, setDescription] = useState("");
  const [companyId, setCompanyId] = useState("");
  const [opportunityId, setOpportunityId] = useState("");
  const [leadId, setLeadId] = useState("");

  useEffect(() => {
    if (!isOpen) return;

    setError(null);
    if (taskToEdit) {
      setTitle(taskToEdit.title);
      setDueAt(taskToEdit.dueAt);
      setPriority(taskToEdit.priority);
      setStatus(taskToEdit.status);
      setDescription(taskToEdit.description || "");
      setCompanyId(taskToEdit.companyId || "");
      setOpportunityId(taskToEdit.opportunityId || "");
      setLeadId(taskToEdit.leadId || "");
    } else {
      setTitle("");
      setDueAt(new Date().toISOString().split("T")[0]);
      setPriority("MEDIUM");
      setStatus("PENDING");
      setDescription("");
      setCompanyId(defaultCompanyId || "");
      setOpportunityId(defaultOpportunityId || "");
      setLeadId(defaultLeadId || "");
    }

    setIsLoadingRelated(true);
    Promise.all([
      getCompaniesAction({ limit: 100 }),
      getOpportunitiesAction(),
      getLeadsAction({ limit: 100 }),
    ])
      .then(([compRes, oppRes, leadRes]) => {
        if (compRes.success && compRes.data) {
          setCompanies(compRes.data.items);
        }
        if (oppRes.success && oppRes.data) {
          setOpportunities(oppRes.data.items);
        }
        if (leadRes.success && leadRes.data) {
          setLeads(leadRes.data.items);
        }
      })
      .catch((err) => console.error("Error loading task relations:", err))
      .finally(() => setIsLoadingRelated(false));
  }, [isOpen, taskToEdit, defaultCompanyId, defaultOpportunityId, defaultLeadId]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setError("Task title is required");
      return;
    }
    if (!dueAt) {
      setError("Due date is required");
      return;
    }

    setError(null);
    startTransition(async () => {
      try {
        if (taskToEdit) {
          const res = await updateTaskAction(taskToEdit.id, {
            title: title.trim(),
            dueAt,
            priority,
            status,
            description: description.trim() || undefined,
          });

          if (!res.success) {
            setError(res.error || "Failed to update task");
            return;
          }
        } else {
          const res = await createTaskAction({
            title: title.trim(),
            dueAt,
            priority,
            status,
            description: description.trim() || undefined,
            companyId: companyId || undefined,
            opportunityId: opportunityId || undefined,
            leadId: leadId || undefined,
          });

          if (!res.success) {
            setError(res.error || "Failed to create task");
            return;
          }
        }

        onSuccess();
        onClose();
      } catch (err: any) {
        setError(err.message || "An unexpected error occurred");
      }
    });
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={taskToEdit ? "Edit Task" : "Create New Task"}
      description="Schedule follow-ups, calls, or deadlines to keep deals moving."
      maxWidth="lg"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="flex items-center gap-2 p-3 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div>
          <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
            Task Title *
          </label>
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Send revised contract to client"
            required
            autoFocus
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
              Due Date *
            </label>
            <Input
              type="date"
              value={dueAt}
              onChange={(e) => setDueAt(e.target.value)}
              required
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
              Priority
            </label>
            <select
              value={priority}
              onChange={(e) => setPriority(e.target.value as TaskPriority)}
              className="w-full h-10 px-3 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent transition-colors"
            >
              {TASK_PRIORITIES.map((p) => (
                <option key={p} value={p}>
                  {p} Priority
                </option>
              ))}
            </select>
          </div>
        </div>

        {taskToEdit && (
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
              Status
            </label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as TaskStatus)}
              className="w-full h-10 px-3 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent transition-colors"
            >
              {TASK_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s.replace("_", " ")}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Association pickers (when creating) */}
        {!taskToEdit && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                Relate to Lead
              </label>
              <select
                value={leadId}
                onChange={(e) => setLeadId(e.target.value)}
                disabled={isLoadingRelated}
                className="w-full h-9 px-2 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 transition-colors"
              >
                <option value="">None (General)</option>
                {leads.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.fullName} {l.companyName ? `(${l.companyName})` : ""}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                Relate to Opportunity
              </label>
              <select
                value={opportunityId}
                onChange={(e) => setOpportunityId(e.target.value)}
                disabled={isLoadingRelated}
                className="w-full h-9 px-2 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 transition-colors"
              >
                <option value="">None</option>
                {opportunities.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                Relate to Company
              </label>
              <select
                value={companyId}
                onChange={(e) => setCompanyId(e.target.value)}
                disabled={isLoadingRelated}
                className="w-full h-9 px-2 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 transition-colors"
              >
                <option value="">None</option>
                {companies.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}

        <div>
          <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
            Notes / Checklist Details
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            placeholder="Add relevant meeting context, action items, or phone notes..."
            className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent transition-colors resize-none"
          />
        </div>

        <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
          <Button type="button" variant="outline" onClick={onClose} disabled={isPending}>
            Cancel
          </Button>
          <Button type="submit" disabled={isPending}>
            {isPending
              ? taskToEdit
                ? "Saving..."
                : "Creating..."
              : taskToEdit
              ? "Save Changes"
              : "Create Task"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

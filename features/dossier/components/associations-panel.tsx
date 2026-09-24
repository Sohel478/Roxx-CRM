"use client";

import { useTransition } from "react";
import Link from "next/link";
import {
  Building2,
  User,
  CheckSquare,
  Globe,
  Mail,
  Phone,
  ExternalLink,
  CheckCircle2,
  Clock,
  Calendar,
  AlertCircle,
} from "lucide-react";
import { toggleTaskStatusAction } from "@/actions/tasks";
import { TaskItem } from "@/lib/validations/tasks";

interface AssociatedCompany {
  id: string;
  name: string;
  industry?: string | null;
  website?: string | null;
  email?: string | null;
  phone?: string | null;
}

interface AssociatedContact {
  id: string;
  fullName: string;
  email?: string | null;
  phone?: string | null;
  jobTitle?: string | null;
}

interface AssociationsPanelProps {
  company?: AssociatedCompany | null;
  contacts?: AssociatedContact[];
  tasks?: TaskItem[];
  onTasksUpdated?: () => void;
}

export function AssociationsPanel({
  company,
  contacts = [],
  tasks = [],
  onTasksUpdated,
}: AssociationsPanelProps) {
  const [isPending, startTransition] = useTransition();

  const handleToggleTask = (taskId: string, currentStatus: string) => {
    const nextCompleted = currentStatus !== "COMPLETED";
    startTransition(async () => {
      await toggleTaskStatusAction(taskId, nextCompleted);
      if (onTasksUpdated) {
        onTasksUpdated();
      }
    });
  };

  const openTasks = tasks.filter((t) => t.status !== "COMPLETED" && t.status !== "CANCELLED");

  return (
    <div className="space-y-4">
      {/* Associated Company Card */}
      {company && (
        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs space-y-3">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
            <div className="flex items-center gap-2">
              <Building2 className="w-4 h-4 text-blue-600" />
              <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                Associated Company
              </h3>
            </div>
            <Link
              href={`/companies/${company.id}`}
              className="text-[11px] font-semibold text-blue-600 hover:underline flex items-center gap-0.5"
            >
              <span>View</span>
              <ExternalLink className="w-3 h-3" />
            </Link>
          </div>

          <div>
            <Link
              href={`/companies/${company.id}`}
              className="font-bold text-sm text-slate-900 hover:text-blue-600 transition-colors"
            >
              {company.name}
            </Link>
            {company.industry && (
              <p className="text-[11px] text-slate-500 font-medium mt-0.5">
                {company.industry}
              </p>
            )}
          </div>

          <div className="space-y-1.5 text-xs text-slate-600 border-t border-slate-50 pt-2">
            {company.website && (
              <div className="flex items-center gap-1.5 truncate">
                <Globe className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                <a
                  href={company.website.startsWith("http") ? company.website : `https://${company.website}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:underline truncate"
                >
                  {company.website.replace(/^https?:\/\//, "")}
                </a>
              </div>
            )}
            {company.email && (
              <div className="flex items-center gap-1.5 truncate">
                <Mail className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                <span className="truncate">{company.email}</span>
              </div>
            )}
            {company.phone && (
              <div className="flex items-center gap-1.5">
                <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                <span>{company.phone}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Associated Contacts Card */}
      {contacts.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs space-y-3">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
            <div className="flex items-center gap-2">
              <User className="w-4 h-4 text-emerald-600" />
              <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                Contacts ({contacts.length})
              </h3>
            </div>
          </div>

          <div className="space-y-3">
            {contacts.map((c) => (
              <div
                key={c.id}
                className="flex items-start justify-between gap-3 p-2.5 rounded-xl bg-slate-50/70 border border-slate-100"
              >
                <div className="flex items-start gap-2.5">
                  <div className="w-7 h-7 rounded-full bg-emerald-100 text-emerald-800 font-bold text-xs flex items-center justify-center shrink-0">
                    {c.fullName.charAt(0)}
                  </div>
                  <div>
                    <Link
                      href={`/contacts/${c.id}`}
                      className="font-bold text-xs text-slate-900 hover:text-blue-600"
                    >
                      {c.fullName}
                    </Link>
                    {c.jobTitle && (
                      <p className="text-[10px] text-slate-500 font-medium">
                        {c.jobTitle}
                      </p>
                    )}
                    {c.email && (
                      <a
                        href={`mailto:${c.email}`}
                        className="text-[10px] text-blue-600 hover:underline block truncate mt-0.5"
                      >
                        {c.email}
                      </a>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Open Tasks Checklist */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs space-y-3">
        <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
          <div className="flex items-center gap-2">
            <CheckSquare className="w-4 h-4 text-blue-600" />
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
              Open Tasks ({openTasks.length})
            </h3>
          </div>
        </div>

        {openTasks.length === 0 ? (
          <div className="py-6 text-center text-slate-400">
            <CheckCircle2 className="w-7 h-7 text-emerald-500 mx-auto mb-1.5 opacity-60" />
            <p className="text-xs font-semibold text-slate-700">All caught up!</p>
            <p className="text-[11px] text-slate-400">No pending follow-ups for this account.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {openTasks.map((t) => {
              const isOverdue =
                t.dueAt && new Date(t.dueAt).getTime() < Date.now();

              return (
                <div
                  key={t.id}
                  className="flex items-start gap-2.5 p-2 rounded-xl border border-slate-100 hover:bg-slate-50 transition-colors"
                >
                  <input
                    type="checkbox"
                    checked={t.status === "COMPLETED"}
                    onChange={() => handleToggleTask(t.id, t.status)}
                    disabled={isPending}
                    className="mt-1 h-3.5 w-3.5 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                  />
                  <div className="flex-1 min-w-0">
                    <span className="text-xs font-semibold text-slate-900 block truncate">
                      {t.title}
                    </span>
                    <div className="flex items-center gap-2 text-[10px] text-slate-400 mt-0.5">
                      {t.dueAt && (
                        <span
                          className={`flex items-center gap-0.5 ${
                            isOverdue ? "text-rose-600 font-bold" : ""
                          }`}
                        >
                          <Calendar className="w-3 h-3" />
                          <span>{t.dueAt.split("T")[0]}</span>
                        </span>
                      )}
                      <span className="capitalize">{t.priority.toLowerCase()} priority</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

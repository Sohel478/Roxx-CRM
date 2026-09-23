"use client";

import { useState, useTransition } from "react";
import {
  Phone,
  Mail,
  Calendar,
  MessageSquare,
  FileText,
  Clock,
  Building,
  Target,
  User,
  Trash2,
  Activity,
  Plus,
  Search,
} from "lucide-react";
import { deleteActivityAction } from "@/actions/activities";
import { ActivityItem, ActivityType } from "@/lib/validations/activities";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface ActivityTimelineProps {
  activities: ActivityItem[];
  onOpenLogModal?: (type?: ActivityType) => void;
  onRefresh: () => void;
  showFilters?: boolean;
}

export function ActivityTimeline({
  activities,
  onOpenLogModal,
  onRefresh,
  showFilters = true,
}: ActivityTimelineProps) {
  const [selectedType, setSelectedType] = useState<string>("ALL");
  const [search, setSearch] = useState("");
  const [isPending, startTransition] = useTransition();

  const filteredActivities = activities.filter((act) => {
    if (selectedType !== "ALL" && act.type !== selectedType) {
      return false;
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      const matchesSubject = act.subject.toLowerCase().includes(q);
      const matchesDesc = act.description?.toLowerCase().includes(q);
      const matchesLead = act.leadName?.toLowerCase().includes(q);
      const matchesCompany = act.companyName?.toLowerCase().includes(q);
      const matchesOpp = act.opportunityName?.toLowerCase().includes(q);
      if (!matchesSubject && !matchesDesc && !matchesLead && !matchesCompany && !matchesOpp) {
        return false;
      }
    }
    return true;
  });

  const handleDelete = (id: string) => {
    if (!confirm("Are you sure you want to remove this activity log?")) return;
    startTransition(async () => {
      await deleteActivityAction(id);
      onRefresh();
    });
  };

  const getActivityVisuals = (t: ActivityType) => {
    switch (t) {
      case "CALL":
        return {
          icon: <Phone className="w-4 h-4 text-emerald-600" />,
          bgColor: "bg-emerald-50 border-emerald-200",
          badgeColor: "bg-emerald-100 text-emerald-800",
        };
      case "MEETING":
        return {
          icon: <Calendar className="w-4 h-4 text-blue-600" />,
          bgColor: "bg-blue-50 border-blue-200",
          badgeColor: "bg-blue-100 text-blue-800",
        };
      case "EMAIL":
        return {
          icon: <Mail className="w-4 h-4 text-indigo-600" />,
          bgColor: "bg-indigo-50 border-indigo-200",
          badgeColor: "bg-indigo-100 text-indigo-800",
        };
      case "WHATSAPP":
        return {
          icon: <MessageSquare className="w-4 h-4 text-emerald-600" />,
          bgColor: "bg-emerald-50 border-emerald-200",
          badgeColor: "bg-emerald-100 text-emerald-800",
        };
      case "NOTE":
        return {
          icon: <FileText className="w-4 h-4 text-amber-600" />,
          bgColor: "bg-amber-50 border-amber-200",
          badgeColor: "bg-amber-100 text-amber-800",
        };
      default:
        return {
          icon: <Activity className="w-4 h-4 text-slate-600" />,
          bgColor: "bg-slate-50 border-slate-200",
          badgeColor: "bg-slate-100 text-slate-800",
        };
    }
  };

  const formatActivityTime = (isoString: string) => {
    try {
      const d = new Date(isoString);
      return d.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
      });
    } catch {
      return isoString;
    }
  };

  return (
    <div className="space-y-4">
      {/* Optional Filters and Search Bar */}
      {showFilters && (
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-1.5">
              {[
                { label: "All Activities", value: "ALL" },
                { label: "Calls", value: "CALL" },
                { label: "Meetings", value: "MEETING" },
                { label: "Emails", value: "EMAIL" },
                { label: "Notes", value: "NOTE" },
              ].map((btn) => (
                <button
                  key={btn.value}
                  type="button"
                  onClick={() => setSelectedType(btn.value)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                    selectedType === btn.value
                      ? "bg-slate-900 text-white"
                      : "text-slate-600 hover:bg-slate-100"
                  }`}
                >
                  {btn.label}
                </button>
              ))}
            </div>

            {onOpenLogModal && (
              <Button
                type="button"
                size="sm"
                className="gap-1.5 text-xs h-8"
                onClick={() => onOpenLogModal()}
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Log Activity</span>
              </Button>
            )}
          </div>

          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search activity notes, subjects, or related entities..."
              className="pl-9 h-9 text-xs"
            />
          </div>
        </div>
      )}

      {/* Timeline Stream */}
      {filteredActivities.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center shadow-xs">
          <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-3">
            <Activity className="w-6 h-6" />
          </div>
          <h4 className="text-sm font-semibold text-slate-800">No activities logged</h4>
          <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
            {search.trim()
              ? "No activities match your search. Try a different keyword."
              : "Keep a full record of client interactions. Log a call, email, or meeting note."}
          </p>
          {onOpenLogModal && (
            <div className="mt-4">
              <Button size="sm" onClick={() => onOpenLogModal()}>
                <Plus className="w-4 h-4 mr-1.5" />
                Log First Activity
              </Button>
            </div>
          )}
        </div>
      ) : (
        <div className="relative pl-6 space-y-6 before:absolute before:bottom-0 before:top-2 before:left-[17px] before:w-0.5 before:bg-slate-200">
          {filteredActivities.map((act) => {
            const visual = getActivityVisuals(act.type);

            return (
              <div key={act.id} className="relative group">
                {/* Timeline Icon Node */}
                <div
                  className={`absolute -left-[25px] top-1 w-8 h-8 rounded-full border flex items-center justify-center shadow-xs ${visual.bgColor}`}
                >
                  {visual.icon}
                </div>

                {/* Card Container */}
                <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs hover:border-slate-300 transition-all">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-slate-100 pb-2.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`text-[10px] font-bold tracking-wider px-2 py-0.5 rounded-full ${visual.badgeColor}`}
                      >
                        {act.type}
                      </span>
                      <h4 className="text-sm font-semibold text-slate-900">
                        {act.subject}
                      </h4>
                    </div>

                    <div className="flex items-center gap-2 text-xs text-slate-500 shrink-0">
                      <span className="inline-flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5 text-slate-400" />
                        {formatActivityTime(act.activityAt)}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleDelete(act.id)}
                        disabled={isPending}
                        className="text-slate-400 hover:text-red-600 transition-colors p-1"
                        title="Delete log"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Body / Description */}
                  {act.description && (
                    <p className="text-xs text-slate-600 mt-2.5 leading-relaxed whitespace-pre-wrap">
                      {act.description}
                    </p>
                  )}

                  {/* Outcome and duration pills */}
                  {(act.outcome || act.durationMinutes) && (
                    <div className="flex flex-wrap items-center gap-2 mt-3 pt-2 border-t border-slate-50">
                      {act.durationMinutes ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-medium bg-slate-100 text-slate-700 px-2 py-0.5 rounded">
                          <Clock className="w-3 h-3 text-slate-400" />
                          {act.durationMinutes} mins
                        </span>
                      ) : null}

                      {act.outcome && (
                        <span className="inline-flex items-center text-[11px] font-medium bg-blue-50 text-blue-700 px-2 py-0.5 rounded border border-blue-100">
                          Outcome: {act.outcome}
                        </span>
                      )}
                    </div>
                  )}

                  {/* Associations & User footer */}
                  <div className="flex flex-wrap items-center gap-3 mt-3 pt-2.5 border-t border-slate-100 text-[11px] text-slate-500">
                    <span className="text-slate-500">
                      Logged by <strong className="font-semibold text-slate-700">{act.userName}</strong>
                    </span>

                    {act.leadName && (
                      <span className="inline-flex items-center gap-1 bg-amber-50 text-amber-700 px-2 py-0.5 rounded">
                        <User className="w-3 h-3 text-amber-500" />
                        <span>Lead: {act.leadName}</span>
                      </span>
                    )}

                    {act.companyName && (
                      <span className="inline-flex items-center gap-1 bg-slate-100 text-slate-700 px-2 py-0.5 rounded">
                        <Building className="w-3 h-3 text-slate-400" />
                        <span>{act.companyName}</span>
                      </span>
                    )}

                    {act.opportunityName && (
                      <span className="inline-flex items-center gap-1 bg-blue-50 text-blue-700 px-2 py-0.5 rounded font-medium">
                        <Target className="w-3 h-3 text-blue-500" />
                        <span>{act.opportunityName}</span>
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

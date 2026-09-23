"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Activity,
  Phone,
  Calendar,
  Mail,
  Plus,
} from "lucide-react";
import { getActivitiesAction } from "@/actions/activities";
import { Button } from "@/components/ui/button";
import { ActivityTimeline } from "@/features/activities/components/activity-timeline";
import { ActivityModal } from "@/features/activities/components/activity-modal";
import { ActivityItem, ActivityType } from "@/lib/validations/activities";

export default function ActivitiesPage() {
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [summary, setSummary] = useState({
    total: 0,
    callsCount: 0,
    meetingsCount: 0,
    emailsCount: 0,
    notesCount: 0,
  });
  const [isLoading, setIsLoading] = useState(true);

  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalDefaultType, setModalDefaultType] = useState<ActivityType>("CALL");

  const loadActivities = useCallback(async () => {
    setIsLoading(true);
    const res = await getActivitiesAction();
    if (res.success && res.data) {
      setActivities(res.data.items);
      setSummary(res.data.summary);
    }
    setIsLoading(false);
  }, []);

  useEffect(() => {
    loadActivities();
  }, [loadActivities]);

  const handleOpenLogModal = (type: ActivityType = "CALL") => {
    setModalDefaultType(type);
    setIsModalOpen(true);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Activity History &amp; Timeline
          </h1>
          <p className="text-sm text-slate-500">
            Unified chronological audit trail of all client calls, meetings, emails, and internal deal notes.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            onClick={() => handleOpenLogModal("CALL")}
            variant="outline"
            size="sm"
            className="gap-1.5"
          >
            <Phone className="w-3.5 h-3.5 text-emerald-600" />
            <span>Log Call</span>
          </Button>
          <Button
            onClick={() => handleOpenLogModal("MEETING")}
            variant="outline"
            size="sm"
            className="gap-1.5"
          >
            <Calendar className="w-3.5 h-3.5 text-blue-600" />
            <span>Log Meeting</span>
          </Button>
          <Button
            onClick={() => handleOpenLogModal("CALL")}
            className="gap-1.5 bg-blue-600 hover:bg-blue-700 text-white"
          >
            <Plus className="w-4 h-4" />
            <span>Log Activity</span>
          </Button>
        </div>
      </div>

      {/* KPI Metric Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-xs font-medium">Total Touchpoints</span>
            <div className="p-1.5 rounded-lg bg-blue-50 text-blue-600">
              <Activity className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-slate-900">
            {isLoading ? "..." : summary.total}
          </div>
          <p className="text-[11px] text-slate-500 mt-1">
            Logged across all pipeline accounts
          </p>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-xs font-medium">Calls Completed</span>
            <div className="p-1.5 rounded-lg bg-emerald-50 text-emerald-600">
              <Phone className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-slate-900">
            {isLoading ? "..." : summary.callsCount}
          </div>
          <p className="text-[11px] text-emerald-600 font-medium mt-1">
            Phone &amp; outbound discovery touches
          </p>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-xs font-medium">Demos &amp; Meetings</span>
            <div className="p-1.5 rounded-lg bg-indigo-50 text-indigo-600">
              <Calendar className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-slate-900">
            {isLoading ? "..." : summary.meetingsCount}
          </div>
          <p className="text-[11px] text-indigo-600 font-medium mt-1">
            Product demonstrations and reviews
          </p>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-xs font-medium">Emails Sent</span>
            <div className="p-1.5 rounded-lg bg-purple-50 text-purple-600">
              <Mail className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-slate-900">
            {isLoading ? "..." : summary.emailsCount}
          </div>
          <p className="text-[11px] text-purple-600 font-medium mt-1">
            Proposals and follow-up threads
          </p>
        </div>
      </div>

      {/* Activity Timeline Stream */}
      <ActivityTimeline
        activities={activities}
        onOpenLogModal={handleOpenLogModal}
        onRefresh={loadActivities}
      />

      {/* Modal */}
      <ActivityModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSuccess={loadActivities}
        defaultType={modalDefaultType}
      />
    </div>
  );
}

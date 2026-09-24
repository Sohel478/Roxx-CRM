"use client";

import { useEffect, useState, useCallback, useTransition } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  User,
  CheckCircle2,
  AlertTriangle,
  Edit2,
  Trash2,
  Clock,
  DollarSign,
  Calendar,
} from "lucide-react";
import {
  getOpportunityByIdAction,
  updateOpportunityStageAction,
  deleteOpportunityAction,
} from "@/actions/opportunities";
import { getActivitiesAction } from "@/actions/activities";
import { getTasksAction } from "@/actions/tasks";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CloseDealModal } from "@/features/opportunities/components/close-deal-modal";
import { OpportunityModal } from "@/features/opportunities/components/opportunity-modal";
import { ActivityTimeline } from "@/features/activities/components/activity-timeline";
import { ActivityModal } from "@/features/activities/components/activity-modal";
import { PropertySidebar } from "@/features/dossier/components/property-sidebar";
import { InlineComposer } from "@/features/dossier/components/inline-composer";
import { AssociationsPanel } from "@/features/dossier/components/associations-panel";
import { triggerConfetti } from "@/lib/utils/confetti";
import { ActivityItem, ActivityType } from "@/lib/validations/activities";
import { TaskItem } from "@/lib/validations/tasks";
import {
  PIPELINE_STAGES,
  OpportunityItem,
} from "@/lib/validations/opportunities";

export default function OpportunityDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params?.id as string;

  const [opp, setOpp] = useState<OpportunityItem | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isPending, startTransition] = useTransition();

  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isCloseModalOpen, setIsCloseModalOpen] = useState(false);
  const [closeStatus, setCloseStatus] = useState<"WON" | "LOST">("WON");
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [isActivityModalOpen, setIsActivityModalOpen] = useState(false);
  const [activityDefaultType] = useState<ActivityType>("CALL");
  const [activityFilter, setActivityFilter] = useState<string>("ALL");

  const loadOpportunity = useCallback(async () => {
    if (!id) return;
    const [res, actRes, taskRes] = await Promise.all([
      getOpportunityByIdAction(id),
      getActivitiesAction({ opportunityId: id }),
      getTasksAction({ opportunityId: id }),
    ]);

    if (res.success && res.data) {
      setOpp(res.data as unknown as OpportunityItem);
    }
    if (actRes.success && actRes.data) {
      setActivities(actRes.data.items);
    }
    if (taskRes.success && taskRes.data) {
      setTasks(taskRes.data.items);
    }
    setIsLoading(false);
  }, [id]);

  useEffect(() => {
    loadOpportunity();
  }, [loadOpportunity]);

  const handleStageChange = (targetStageName: string) => {
    const stage = PIPELINE_STAGES.find(
      (s) => s.name.toLowerCase() === targetStageName.toLowerCase()
    );

    if (stage?.isWon) {
      triggerConfetti();
      setCloseStatus("WON");
      setIsCloseModalOpen(true);
      return;
    }
    if (stage?.isLost) {
      setCloseStatus("LOST");
      setIsCloseModalOpen(true);
      return;
    }

    startTransition(async () => {
      await updateOpportunityStageAction(id, targetStageName);
      await loadOpportunity();
    });
  };

  const handleDelete = () => {
    if (!confirm("Are you sure you want to delete this opportunity?")) return;
    startTransition(async () => {
      await deleteOpportunityAction(id);
      router.push("/opportunities");
    });
  };

  if (isLoading) {
    return (
      <div className="py-20 text-center text-slate-400">
        <p className="text-sm font-semibold">Loading 360° customer dossier...</p>
      </div>
    );
  }

  if (!opp) {
    return (
      <div className="py-20 text-center space-y-3">
        <p className="text-base font-bold text-slate-800">Opportunity Not Found</p>
        <Button variant="outline" onClick={() => router.push("/opportunities")}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Opportunities
        </Button>
      </div>
    );
  }

  const daysInactive = opp.createdAt
    ? Math.max(0, Math.floor((Date.now() - new Date(opp.createdAt).getTime()) / (1000 * 60 * 60 * 24)))
    : 0;

  const filteredActivities = activities.filter((act) => {
    if (activityFilter === "ALL") return true;
    return act.type === activityFilter;
  });

  return (
    <div className="space-y-6">
      {/* Top Breadcrumb & Action Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <Link
            href="/opportunities"
            className="inline-flex items-center text-xs font-semibold text-slate-500 hover:text-slate-800 transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5 mr-1" />
            Back to pipeline
          </Link>
          <div className="flex items-center gap-3 mt-1.5 flex-wrap">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">{opp.name}</h1>
            <Badge
              variant={
                opp.status === "WON"
                  ? "success"
                  : opp.status === "LOST"
                  ? "destructive"
                  : "info"
              }
            >
              {opp.stageName}
            </Badge>
            <span className="text-sm font-extrabold text-blue-600 bg-blue-50 px-2.5 py-0.5 rounded-lg border border-blue-100">
              ${opp.amount.toLocaleString()} {opp.currency}
            </span>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2">
          {opp.status === "OPEN" && (
            <>
              <Button
                type="button"
                className="bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm flex items-center gap-1.5"
                onClick={() => {
                  triggerConfetti();
                  setCloseStatus("WON");
                  setIsCloseModalOpen(true);
                }}
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>Mark Won</span>
              </Button>
              <Button
                type="button"
                variant="outline"
                className="text-red-600 hover:bg-red-50 hover:border-red-200 flex items-center gap-1.5"
                onClick={() => {
                  setCloseStatus("LOST");
                  setIsCloseModalOpen(true);
                }}
              >
                <AlertTriangle className="w-4 h-4" />
                <span>Mark Lost</span>
              </Button>
            </>
          )}

          <Button
            type="button"
            variant="outline"
            onClick={() => setIsEditModalOpen(true)}
            className="flex items-center gap-1.5"
          >
            <Edit2 className="w-4 h-4" />
            <span>Edit</span>
          </Button>

          <Button
            type="button"
            variant="outline"
            onClick={handleDelete}
            className="text-red-500 hover:text-red-700 hover:bg-red-50"
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Won Outcome Banner */}
      {opp.status === "WON" && (
        <div className="bg-emerald-50/80 border border-emerald-200 rounded-2xl p-4 flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-emerald-950">Closed Won Deal 🎉</h3>
            <p className="text-xs text-emerald-700">
              This deal was won and recognized as{" "}
              <strong>${opp.amount.toLocaleString()} USD</strong> in revenue.
            </p>
          </div>
        </div>
      )}

      {/* Lost Outcome Banner */}
      {opp.status === "LOST" && (
        <div className="bg-red-50/80 border border-red-200 rounded-2xl p-4 flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-red-600 text-white flex items-center justify-center shrink-0">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-red-950">Closed Lost Deal</h3>
            <p className="text-xs text-red-700">
              Reason recorded: <strong>{opp.lossReason || "Unspecified"}</strong>.
            </p>
          </div>
        </div>
      )}

      {/* 3-Column Dossier Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column (Key Properties & Record Overview) */}
        <div className="lg:col-span-3 space-y-4">
          <PropertySidebar
            title={opp.name}
            subtitle={opp.companyName}
            badge={opp.stageName}
            badgeVariant={
              opp.status === "WON"
                ? "success"
                : opp.status === "LOST"
                ? "danger"
                : "neutral"
            }
            daysInactive={daysInactive}
            isOpen={opp.status === "OPEN"}
            properties={[
              {
                label: "Deal Value",
                value: `$${opp.amount.toLocaleString()} ${opp.currency}`,
                icon: <DollarSign className="w-3.5 h-3.5 text-blue-600" />,
              },
              {
                label: "Win Probability",
                value: `${opp.probability}%`,
              },
              {
                label: "Pipeline Stage",
                value: opp.stageName,
              },
              {
                label: "Target Close Date",
                value: opp.expectedCloseDate || "Not set",
                icon: <Calendar className="w-3.5 h-3.5 text-slate-400" />,
              },
              {
                label: "Deal Owner",
                value: opp.ownerName,
                icon: <User className="w-3.5 h-3.5 text-slate-400" />,
              },
              {
                label: "Created Date",
                value: new Date(opp.createdAt).toLocaleDateString(),
                icon: <Clock className="w-3.5 h-3.5 text-slate-400" />,
              },
            ]}
          />

          {/* Strategy Notes Card */}
          <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs space-y-2">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
              Strategy &amp; Deal Brief
            </h3>
            <p className="text-xs text-slate-600 leading-relaxed bg-slate-50 p-3 rounded-xl border border-slate-100 whitespace-pre-wrap">
              {opp.description || "No strategy notes recorded yet."}
            </p>
          </div>
        </div>

        {/* Center Column (Stage Stepper, Inline Composer & Activity Timeline) */}
        <div className="lg:col-span-6 space-y-6">
          {/* Pipeline Stage Progression Stepper */}
          <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold text-slate-900 tracking-tight">
                Pipeline Progression
              </span>
              <span className="text-[11px] text-slate-400">
                Click any milestone to advance stage
              </span>
            </div>

            <div className="grid grid-cols-4 sm:grid-cols-7 gap-1.5">
              {PIPELINE_STAGES.map((s) => {
                const isCurrent =
                  s.name.toLowerCase() === opp.stageName.toLowerCase();
                return (
                  <button
                    key={s.id}
                    type="button"
                    disabled={isPending || isCurrent}
                    onClick={() => handleStageChange(s.name)}
                    className={`py-2 px-1 text-center rounded-xl text-[11px] font-bold transition-all cursor-pointer ${
                      isCurrent
                        ? "bg-blue-600 text-white shadow-xs"
                        : "bg-slate-50 text-slate-600 hover:bg-blue-50 hover:text-blue-700 border border-slate-200"
                    }`}
                  >
                    <div className="truncate">{s.name}</div>
                    <div
                      className={`text-[9px] mt-0.5 ${
                        isCurrent ? "text-blue-100" : "text-slate-400"
                      }`}
                    >
                      {s.probability}%
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Inline Activity & Email Composer */}
          <InlineComposer
            entityId={opp.id}
            entityType="opportunity"
            mergeContext={{
              firstName: opp.primaryContactName?.split(" ")[0] || "",
              lastName: opp.primaryContactName?.split(" ")[1] || "",
              companyName: opp.companyName,
              dealName: opp.name,
              dealAmount: opp.amount,
              repName: opp.ownerName,
              email: opp.primaryContactEmail || "",
            }}
            onActivityCreated={loadOpportunity}
          />

          {/* Unified Activity Stream */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-blue-600" />
                <h2 className="text-sm font-bold text-slate-900">
                  Activity Timeline ({activities.length})
                </h2>
              </div>

              {/* Feed Filter Tabs */}
              <div className="flex gap-1 overflow-x-auto">
                {["ALL", "NOTE", "EMAIL", "CALL", "MEETING"].map((f) => (
                  <button
                    key={f}
                    type="button"
                    onClick={() => setActivityFilter(f)}
                    className={`px-2.5 py-1 text-[11px] font-bold rounded-lg transition-colors ${
                      activityFilter === f
                        ? "bg-slate-900 text-white"
                        : "text-slate-500 hover:bg-slate-100"
                    }`}
                  >
                    {f === "ALL" ? "All" : f.charAt(0) + f.slice(1).toLowerCase() + "s"}
                  </button>
                ))}
              </div>
            </div>

            <ActivityTimeline
              activities={filteredActivities}
              onRefresh={loadOpportunity}
            />
          </div>
        </div>

        {/* Right Column (Associated Company, Contacts & Open Tasks Checklist) */}
        <div className="lg:col-span-3 space-y-4">
          <AssociationsPanel
            company={{
              id: opp.companyId,
              name: opp.companyName,
            }}
            contacts={
              opp.primaryContactName
                ? [
                    {
                      id: opp.primaryContactId || "contact_default",
                      fullName: opp.primaryContactName,
                      jobTitle: "Key Decision Maker",
                    },
                  ]
                : []
            }
            tasks={tasks}
            onTasksUpdated={loadOpportunity}
          />
        </div>
      </div>

      {/* Edit Opportunity Modal */}
      <OpportunityModal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        onSuccess={() => loadOpportunity()}
        opportunityToEdit={opp}
      />

      {/* Close Deal (Won/Lost) Modal */}
      <CloseDealModal
        isOpen={isCloseModalOpen}
        onClose={() => setIsCloseModalOpen(false)}
        onSuccess={() => loadOpportunity()}
        opportunity={opp}
        initialStatus={closeStatus}
      />

      {/* Quick Activity Modal (fallback / alternative) */}
      <ActivityModal
        isOpen={isActivityModalOpen}
        onClose={() => setIsActivityModalOpen(false)}
        onSuccess={() => loadOpportunity()}
        defaultType={activityDefaultType}
        defaultOpportunityId={opp.id}
      />
    </div>
  );
}

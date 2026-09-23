"use client";

import { useEffect, useState, useCallback, useTransition } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Building2,
  User,
  CheckCircle2,
  AlertTriangle,
  Kanban,
  Edit2,
  Trash2,
} from "lucide-react";
import {
  getOpportunityByIdAction,
  updateOpportunityStageAction,
  deleteOpportunityAction,
} from "@/actions/opportunities";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CloseDealModal } from "@/features/opportunities/components/close-deal-modal";
import { OpportunityModal } from "@/features/opportunities/components/opportunity-modal";
import { getActivitiesAction } from "@/actions/activities";
import { ActivityTimeline } from "@/features/activities/components/activity-timeline";
import { ActivityModal } from "@/features/activities/components/activity-modal";
import { ActivityItem, ActivityType } from "@/lib/validations/activities";
import { Clock } from "lucide-react";
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
  const [isActivityModalOpen, setIsActivityModalOpen] = useState(false);
  const [activityDefaultType, setActivityDefaultType] = useState<ActivityType>("CALL");

  const loadOpportunity = useCallback(async () => {
    if (!id) return;
    const [res, actRes] = await Promise.all([
      getOpportunityByIdAction(id),
      getActivitiesAction({ opportunityId: id }),
    ]);

    if (res.success && res.data) {
      setOpp(res.data as unknown as OpportunityItem);
    }
    if (actRes.success && actRes.data) {
      setActivities(actRes.data.items);
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
        <p className="text-sm font-semibold">Loading deal details...</p>
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

  return (
    <div className="space-y-6">
      {/* Back button */}
      <div>
        <Link
          href="/opportunities"
          className="inline-flex items-center text-xs font-semibold text-slate-500 hover:text-slate-800 transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5 mr-1" />
          Back to pipeline
        </Link>
      </div>

      {/* Header Profile */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex items-start gap-4">
          <div className="w-14 h-14 rounded-2xl bg-blue-600 text-white flex items-center justify-center text-xl font-bold shadow-md shadow-blue-500/20 shrink-0">
            <Kanban className="w-7 h-7" />
          </div>
          <div className="space-y-1">
            <div className="flex items-center gap-2.5 flex-wrap">
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
              <span className="text-xs font-mono font-semibold bg-slate-100 text-slate-700 px-2 py-0.5 rounded">
                {opp.probability}% Win Probability
              </span>
            </div>
            <p className="text-xs text-slate-500 font-medium">
              Account:{" "}
              <Link
                href={`/companies/${opp.companyId}`}
                className="font-semibold text-blue-600 hover:underline"
              >
                {opp.companyName}
              </Link>
              {opp.primaryContactName && (
                <>
                  {" "}
                  &bull; Contact:{" "}
                  <span className="font-semibold text-slate-700">{opp.primaryContactName}</span>
                </>
              )}
            </p>
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
            <h3 className="text-sm font-bold text-emerald-950">Closed Won Deal</h3>
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

      {/* Pipeline Stage Progression Bar */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs">
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2.5">
          Pipeline Stage Progression
        </p>
        <div className="flex flex-wrap items-center gap-2">
          {PIPELINE_STAGES.map((s) => {
            const isCurrent = opp.stageName.toLowerCase() === s.name.toLowerCase();
            return (
              <button
                key={s.id}
                type="button"
                disabled={isPending || isCurrent}
                onClick={() => handleStageChange(s.name)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  isCurrent
                    ? "bg-blue-600 text-white shadow-xs cursor-default"
                    : "bg-slate-50 text-slate-600 hover:bg-blue-50 hover:text-blue-700 border border-slate-200"
                }`}
              >
                {s.name} ({s.probability}%)
              </button>
            );
          })}
        </div>
      </div>

      {/* Details Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Financials Card */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs space-y-4">
          <div>
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">
              Deal Value
            </span>
            <div className="mt-1 flex items-baseline gap-1">
              <span className="text-3xl font-extrabold text-slate-900 tracking-tight">
                ${opp.amount.toLocaleString()}
              </span>
              <span className="text-xs text-slate-400 font-semibold">{opp.currency}</span>
            </div>
          </div>

          <div className="border-t border-slate-100 pt-3 space-y-2 text-xs">
            <div className="flex justify-between">
              <span className="text-slate-400">Target Close Date</span>
              <span className="font-semibold text-slate-800">
                {opp.expectedCloseDate || "Not set"}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Deal Owner</span>
              <span className="font-semibold text-slate-800">{opp.ownerName}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Created On</span>
              <span className="font-semibold text-slate-800">
                {new Date(opp.createdAt).toLocaleDateString()}
              </span>
            </div>
          </div>
        </div>

        {/* Company & Contact Linkage */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs space-y-3">
          <h2 className="text-sm font-bold text-slate-900 border-b border-slate-100 pb-2">
            Related Account &amp; Contacts
          </h2>

          <div className="space-y-3 text-xs">
            <div>
              <span className="text-slate-400 block font-medium">Customer Company</span>
              <Link
                href={`/companies/${opp.companyId}`}
                className="text-blue-600 font-bold hover:underline flex items-center gap-1.5 mt-0.5"
              >
                <Building2 className="w-4 h-4 text-slate-400" />
                <span>{opp.companyName}</span>
              </Link>
            </div>

            <div>
              <span className="text-slate-400 block font-medium">Primary Contact</span>
              {opp.primaryContactName ? (
                <div className="flex items-center gap-1.5 font-semibold text-slate-800 mt-0.5">
                  <User className="w-4 h-4 text-slate-400" />
                  <span>{opp.primaryContactName}</span>
                </div>
              ) : (
                <span className="text-slate-400 italic">No contact assigned</span>
              )}
            </div>
          </div>
        </div>

        {/* Context & Notes */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs space-y-3">
          <h2 className="text-sm font-bold text-slate-900 border-b border-slate-100 pb-2">
            Deal Strategy &amp; Notes
          </h2>
          <div className="text-xs text-slate-600 leading-relaxed bg-slate-50 p-3.5 rounded-lg border border-slate-100 whitespace-pre-wrap">
            {opp.description || "No strategy notes recorded yet for this opportunity."}
          </div>
        </div>
      </div>

      {/* Activity & Touchpoint History */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-blue-600" />
            <h2 className="text-sm font-bold text-slate-900">Opportunity Touchpoints &amp; Activities</h2>
          </div>
          <Button
            size="sm"
            variant="outline"
            className="text-xs h-7 gap-1"
            onClick={() => {
              setActivityDefaultType("CALL");
              setIsActivityModalOpen(true);
            }}
          >
            <span>+ Log Activity</span>
          </Button>
        </div>

        <ActivityTimeline
          activities={activities}
          onOpenLogModal={(type) => {
            if (type) setActivityDefaultType(type);
            setIsActivityModalOpen(true);
          }}
          onRefresh={loadOpportunity}
          showFilters={false}
        />
      </div>

      {/* Activity Log Modal */}
      <ActivityModal
        isOpen={isActivityModalOpen}
        onClose={() => setIsActivityModalOpen(false)}
        onSuccess={loadOpportunity}
        defaultType={activityDefaultType}
        defaultOpportunityId={opp.id}
        defaultCompanyId={opp.companyId}
      />

      {/* Edit Modal */}
      <OpportunityModal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        onSuccess={loadOpportunity}
        opportunityToEdit={opp}
      />

      {/* Close Deal Modal */}
      <CloseDealModal
        isOpen={isCloseModalOpen}
        onClose={() => setIsCloseModalOpen(false)}
        onSuccess={loadOpportunity}
        opportunity={opp}
        initialStatus={closeStatus}
      />
    </div>
  );
}

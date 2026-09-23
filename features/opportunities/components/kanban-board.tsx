"use client";

import { useTransition } from "react";
import Link from "next/link";
import {
  Building2,
  User,
  Calendar,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  XCircle,
  Clock,
  Sparkles,
  AlertTriangle,
} from "lucide-react";
import { updateOpportunityStageAction } from "@/actions/opportunities";
import {
  PIPELINE_STAGES,
  OpportunityItem,
} from "@/lib/validations/opportunities";

interface KanbanBoardProps {
  opportunities: OpportunityItem[];
  onRefresh: () => void;
  onEdit: (opp: OpportunityItem) => void;
  onCloseDeal: (opp: OpportunityItem, status: "WON" | "LOST") => void;
}

export function KanbanBoard({
  opportunities,
  onRefresh,
  onEdit,
  onCloseDeal,
}: KanbanBoardProps) {
  const [isPending, startTransition] = useTransition();

  const handleMoveStage = (opp: OpportunityItem, direction: "prev" | "next") => {
    const currentIdx = PIPELINE_STAGES.findIndex(
      (s) => s.name.toLowerCase() === opp.stageName.toLowerCase()
    );
    if (currentIdx === -1) return;

    const targetIdx = direction === "next" ? currentIdx + 1 : currentIdx - 1;
    if (targetIdx < 0 || targetIdx >= PIPELINE_STAGES.length) return;

    const targetStage = PIPELINE_STAGES[targetIdx];

    // If target stage is Lost or Won, trigger modal for structured tracking
    if (targetStage.isLost) {
      onCloseDeal(opp, "LOST");
      return;
    }
    if (targetStage.isWon) {
      onCloseDeal(opp, "WON");
      return;
    }

    startTransition(async () => {
      await updateOpportunityStageAction(opp.id, targetStage.name);
      onRefresh();
    });
  };

  return (
    <div className="overflow-x-auto pb-6">
      <div className="flex gap-4 min-w-[1280px] items-start">
        {PIPELINE_STAGES.map((stage, stageIndex) => {
          const stageOpps = opportunities.filter(
            (o) => o.stageName.toLowerCase() === stage.name.toLowerCase()
          );
          const stageTotal = stageOpps.reduce((acc, curr) => acc + curr.amount, 0);

          return (
            <div
              key={stage.id}
              className="flex-1 min-w-[230px] max-w-[270px] bg-slate-50/75 rounded-2xl border border-slate-200/90 flex flex-col max-h-[82vh]"
            >
              {/* Stage Header */}
              <div className="p-3.5 border-b border-slate-200/80 bg-white rounded-t-2xl shadow-2xs">
                <div className="flex items-center justify-between gap-1 mb-1">
                  <div className="flex items-center gap-2">
                    <span
                      className="w-2.5 h-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: stage.color }}
                    />
                    <h3 className="text-xs font-bold text-slate-900 tracking-tight">
                      {stage.name}
                    </h3>
                  </div>
                  <span className="text-[11px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
                    {stage.probability}%
                  </span>
                </div>

                <div className="flex items-center justify-between text-xs text-slate-500 mt-2">
                  <span className="font-semibold text-slate-700">
                    {stageOpps.length} {stageOpps.length === 1 ? "deal" : "deals"}
                  </span>
                  <span className="font-extrabold text-slate-900">
                    ${stageTotal.toLocaleString()}
                  </span>
                </div>
              </div>

              {/* Cards Container */}
              <div className="p-2.5 space-y-2.5 overflow-y-auto flex-1">
                {stageOpps.length === 0 ? (
                  <div className="py-8 text-center border-2 border-dashed border-slate-200 rounded-xl">
                    <p className="text-[11px] text-slate-400 font-medium">No deals in {stage.name}</p>
                  </div>
                ) : (
                  stageOpps.map((opp) => (
                    <div
                      key={opp.id}
                      className="bg-white rounded-xl border border-slate-200 p-3 shadow-2xs hover:shadow-xs hover:border-slate-300 transition-all space-y-2.5 group"
                    >
                      {/* Deal Title & Amount */}
                      <div>
                        <div className="flex items-start justify-between gap-2">
                          <Link
                            href={`/opportunities/${opp.id}`}
                            className="text-xs font-bold text-slate-900 hover:text-blue-600 line-clamp-2 leading-tight"
                          >
                            {opp.name}
                          </Link>
                        </div>
                        <div className="mt-1 flex items-baseline gap-1">
                          <span className="text-sm font-extrabold text-slate-900 tracking-tight">
                            ${opp.amount.toLocaleString()}
                          </span>
                          <span className="text-[10px] text-slate-400 uppercase font-semibold">
                            USD
                          </span>
                        </div>
                      </div>

                      {/* Company & Contact Details */}
                      <div className="space-y-1 text-[11px] text-slate-600 border-t border-slate-100 pt-2">
                        <Link
                          href={`/companies/${opp.companyId}`}
                          className="flex items-center gap-1.5 hover:text-blue-600 font-medium truncate"
                        >
                          <Building2 className="w-3 h-3 text-slate-400 shrink-0" />
                          <span className="truncate">{opp.companyName}</span>
                        </Link>
                        {opp.primaryContactName && (
                          <div className="flex items-center gap-1.5 text-slate-500 truncate">
                            <User className="w-3 h-3 text-slate-400 shrink-0" />
                            <span className="truncate">{opp.primaryContactName}</span>
                          </div>
                        )}
                      </div>

                      {/* Loss Reason or Outcome Badge */}
                      {opp.status === "LOST" && opp.lossReason && (
                        <div className="p-1.5 bg-red-50 border border-red-200 rounded-lg text-[10px] text-red-700 flex items-start gap-1">
                          <AlertTriangle className="w-3 h-3 text-red-500 shrink-0 mt-0.5" />
                          <span className="font-semibold truncate">{opp.lossReason}</span>
                        </div>
                      )}

                      {opp.status === "WON" && (
                        <div className="p-1.5 bg-emerald-50 border border-emerald-200 rounded-lg text-[10px] text-emerald-700 flex items-center gap-1 font-semibold">
                          <CheckCircle2 className="w-3 h-3 text-emerald-600 shrink-0" />
                          <span>Revenue Closed</span>
                        </div>
                      )}

                      {/* Card Footer: Date & Quick Actions */}
                      <div className="flex items-center justify-between pt-1 text-[10px] text-slate-400 border-t border-slate-100">
                        <div className="flex items-center gap-1 font-medium">
                          <Calendar className="w-3 h-3" />
                          <span>{opp.expectedCloseDate || "No date"}</span>
                        </div>

                        {/* Progression Controls */}
                        <div className="flex items-center gap-0.5">
                          <button
                            type="button"
                            disabled={isPending || stageIndex === 0}
                            onClick={() => handleMoveStage(opp, "prev")}
                            title="Move back"
                            className="p-1 rounded hover:bg-slate-100 text-slate-500 disabled:opacity-30 disabled:pointer-events-none"
                          >
                            <ChevronLeft className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            disabled={isPending || stageIndex === PIPELINE_STAGES.length - 1}
                            onClick={() => handleMoveStage(opp, "next")}
                            title="Move forward"
                            className="p-1 rounded hover:bg-slate-100 text-slate-500 disabled:opacity-30 disabled:pointer-events-none"
                          >
                            <ChevronRight className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

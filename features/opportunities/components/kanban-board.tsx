"use client";

import { useState, useTransition } from "react";
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
  Flame,
} from "lucide-react";
import { updateOpportunityStageAction } from "@/actions/opportunities";
import {
  PIPELINE_STAGES,
  OpportunityItem,
} from "@/lib/validations/opportunities";
import { triggerConfetti } from "@/lib/utils/confetti";

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
  const [filterStaleOnly, setFilterStaleOnly] = useState(false);

  const getDaysInactive = (opp: OpportunityItem): number => {
    const date = opp.createdAt ? new Date(opp.createdAt) : new Date();
    const diffMs = Date.now() - date.getTime();
    return Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
  };

  const staleDealsCount = opportunities.filter(
    (o) => o.status === "OPEN" && getDaysInactive(o) >= 7
  ).length;

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
      triggerConfetti();
      onCloseDeal(opp, "WON");
      return;
    }

    startTransition(async () => {
      await updateOpportunityStageAction(opp.id, targetStage.name);
      onRefresh();
    });
  };

  return (
    <div className="space-y-3 pb-6">
      {/* Board Controls & Stale Deals Warning Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-3 rounded-xl border border-slate-200 shadow-2xs">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setFilterStaleOnly(!filterStaleOnly)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
              filterStaleOnly
                ? "bg-amber-100 text-amber-900 border border-amber-300 shadow-2xs"
                : "bg-slate-50 text-slate-700 border border-slate-200 hover:bg-slate-100"
            }`}
          >
            <AlertTriangle className={`w-3.5 h-3.5 ${filterStaleOnly ? "text-amber-600" : "text-amber-500"}`} />
            <span>Highlight Stale / Inactive Deals</span>
            <span
              className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                filterStaleOnly
                  ? "bg-amber-200 text-amber-900"
                  : "bg-slate-200 text-slate-700"
              }`}
            >
              {staleDealsCount}
            </span>
          </button>
          {staleDealsCount > 0 && !filterStaleOnly && (
            <span className="text-[11px] text-slate-500 hidden sm:inline">
              HubSpot alert: {staleDealsCount} open deals have no recent touchpoint (&gt;7 days)
            </span>
          )}
        </div>
        <div className="text-[11px] text-slate-400 font-medium">
          Drag or click arrows to advance stages • Won deals celebrate with confetti
        </div>
      </div>

      <div className="overflow-x-auto pb-4">
        <div className="flex gap-4 min-w-[1280px] items-start">
          {PIPELINE_STAGES.map((stage, stageIndex) => {
            const stageOpps = opportunities
              .filter(
                (o) => o.stageName.toLowerCase() === stage.name.toLowerCase()
              )
              .filter(
                (o) =>
                  !filterStaleOnly ||
                  (o.status === "OPEN" && getDaysInactive(o) >= 7)
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
                      <p className="text-[11px] text-slate-400 font-medium">
                        {filterStaleOnly ? "No stale deals" : `No deals in ${stage.name}`}
                      </p>
                    </div>
                  ) : (
                    stageOpps.map((opp) => {
                      const daysInactive = getDaysInactive(opp);
                      const isRotten = opp.status === "OPEN" && daysInactive >= 14;
                      const isStale = opp.status === "OPEN" && daysInactive >= 7 && !isRotten;

                      return (
                        <div
                          key={opp.id}
                          className={`rounded-xl border p-3 shadow-2xs hover:shadow-xs transition-all space-y-2.5 group ${
                            isRotten
                              ? "bg-rose-50/30 border-rose-300 ring-1 ring-rose-200/70"
                              : isStale
                              ? "bg-amber-50/20 border-amber-300 ring-1 ring-amber-200/60"
                              : "bg-white border-slate-200 hover:border-slate-300"
                          }`}
                        >
                          {/* Rotting & Velocity Status Flag */}
                          {isRotten && (
                            <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-rose-50 border border-rose-200 text-[10px] font-bold text-rose-700">
                              <Clock className="w-3 h-3 text-rose-600 animate-pulse shrink-0" />
                              <span>Rotten ({daysInactive}d inactive)</span>
                            </div>
                          )}
                          {isStale && (
                            <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-amber-50 border border-amber-200 text-[10px] font-semibold text-amber-800">
                              <AlertTriangle className="w-3 h-3 text-amber-600 shrink-0" />
                              <span>Stale ({daysInactive}d inactive)</span>
                            </div>
                          )}
                          {!isRotten && !isStale && opp.status === "OPEN" && (
                            <div className="flex items-center gap-1 text-[10px] font-semibold text-emerald-600">
                              <Flame className="w-3 h-3 text-emerald-500" />
                              <span>Active velocity</span>
                            </div>
                          )}
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
                  );
                })
              )}
            </div>
          </div>
        );
      })}
        </div>
      </div>
    </div>
  );
}

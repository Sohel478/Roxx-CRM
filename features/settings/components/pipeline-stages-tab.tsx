"use client";

import { useState, useTransition } from "react";
import {
  Kanban,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Loader2,
  Save,
  Percent,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PipelineStageItem } from "@/lib/validations/settings";
import { updatePipelineStagesAction } from "@/actions/settings";

interface PipelineStagesTabProps {
  initialStages: PipelineStageItem[];
  onRefresh: () => void;
}

export function PipelineStagesTab({
  initialStages,
  onRefresh,
}: PipelineStagesTabProps) {
  const [stages, setStages] = useState<PipelineStageItem[]>(initialStages);
  const [isPending, startTransition] = useTransition();
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleProbabilityChange = (index: number, val: number) => {
    const updated = [...stages];
    updated[index] = { ...updated[index], probability: Math.max(0, Math.min(100, val)) };
    setStages(updated);
  };

  const handleNameChange = (index: number, val: string) => {
    const updated = [...stages];
    updated[index] = { ...updated[index], name: val };
    setStages(updated);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setSuccessMsg(null);
    setErrorMsg(null);

    startTransition(async () => {
      const res = await updatePipelineStagesAction(stages);
      if (!res.success) {
        setErrorMsg(res.error || "Failed to update pipeline stages");
      } else {
        setSuccessMsg("Pipeline stages configuration updated successfully.");
        onRefresh();
      }
    });
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden max-w-4xl">
      <div className="p-6 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold text-slate-900">
            Opportunity Pipeline Stages &amp; Win Probabilities
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Configure stage sequence, progression probabilities for weighted revenue forecasting, and milestone flags.
          </p>
        </div>
      </div>

      <form onSubmit={handleSave} className="p-6 space-y-6">
        {successMsg && (
          <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-lg flex items-center gap-2 text-emerald-800 text-xs">
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
            <span>{successMsg}</span>
          </div>
        )}

        {errorMsg && (
          <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-lg flex items-center gap-2 text-rose-800 text-xs">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
            <span>{errorMsg}</span>
          </div>
        )}

        <div className="space-y-3">
          {stages.map((stage, idx) => (
            <div
              key={stage.id}
              className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-xl border border-slate-200 bg-slate-50/50 hover:bg-slate-50 transition-colors"
            >
              <div className="flex items-center gap-3">
                <span className="w-6 h-6 rounded-full bg-slate-200 text-slate-700 font-bold text-xs flex items-center justify-center shrink-0">
                  {stage.order}
                </span>
                <span
                  className="w-3.5 h-3.5 rounded-full shrink-0"
                  style={{ backgroundColor: stage.color }}
                />
                <div className="flex-1 min-w-[200px]">
                  <Input
                    type="text"
                    value={stage.name}
                    onChange={(e) => handleNameChange(idx, e.target.value)}
                    className="text-xs font-semibold bg-white"
                  />
                </div>
              </div>

              <div className="flex items-center gap-4">
                <div className="flex items-center gap-1.5 w-32">
                  <span className="text-xs text-slate-500">Win Prob:</span>
                  <div className="relative flex-1">
                    <Input
                      type="number"
                      min={0}
                      max={100}
                      value={stage.probability}
                      onChange={(e) =>
                        handleProbabilityChange(idx, parseInt(e.target.value) || 0)
                      }
                      className="text-xs pr-6 bg-white font-mono"
                    />
                    <Percent className="w-3 h-3 absolute right-2 top-2.5 text-slate-400 pointer-events-none" />
                  </div>
                </div>

                <div className="w-28 text-right">
                  {stage.isWon ? (
                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                      <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                      Won Stage
                    </span>
                  ) : stage.isLost ? (
                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-rose-700 bg-rose-50 px-2 py-0.5 rounded-md border border-rose-200">
                      <XCircle className="w-3 h-3 text-rose-600" />
                      Lost Stage
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-md border border-blue-200">
                      Active Funnel
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="flex justify-end pt-4 border-t border-slate-100">
          <Button
            type="submit"
            disabled={isPending}
            className="bg-blue-600 hover:bg-blue-700 gap-2"
          >
            {isPending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            <span>Save Pipeline Stages</span>
          </Button>
        </div>
      </form>
    </div>
  );
}

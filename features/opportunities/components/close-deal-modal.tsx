"use client";

import { useState, useTransition } from "react";
import { CheckCircle2, XCircle, AlertTriangle } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { closeOpportunityAction } from "@/actions/opportunities";
import { LOSS_REASONS, OpportunityItem } from "@/lib/validations/opportunities";
import { triggerConfetti } from "@/lib/utils/confetti";

interface CloseDealModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  opportunity: OpportunityItem;
  initialStatus: "WON" | "LOST";
}

export function CloseDealModal({
  isOpen,
  onClose,
  onSuccess,
  opportunity,
  initialStatus,
}: CloseDealModalProps) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<"WON" | "LOST">(initialStatus);
  const [lossReason, setLossReason] = useState<string>(LOSS_REASONS[0]);
  const [lossNotes, setLossNotes] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    startTransition(async () => {
      try {
        const res = await closeOpportunityAction(opportunity.id, {
          status,
          lossReason: status === "LOST" ? lossReason : undefined,
          lossNotes: status === "LOST" ? lossNotes : undefined,
        });

        if (res.success) {
          if (status === "WON") {
            triggerConfetti();
          }
          onSuccess();
          onClose();
        } else {
          setError(res.error || "Failed to update deal status");
        }
      } catch (err: any) {
        setError(err?.message || "An unexpected error occurred while updating deal status");
      }
    });
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={status === "WON" ? "Close Deal as Won" : "Mark Deal as Lost"}
      description={`Record the final outcome for "${opportunity.name}" (${opportunity.companyName}).`}
      maxWidth="md"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700">
            {error}
          </div>
        )}

        {/* Status Toggle */}
        <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 rounded-xl">
          <button
            type="button"
            onClick={() => setStatus("WON")}
            className={`flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-bold transition-all ${
              status === "WON"
                ? "bg-emerald-600 text-white shadow-xs"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>Closed Won</span>
          </button>
          <button
            type="button"
            onClick={() => setStatus("LOST")}
            className={`flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-bold transition-all ${
              status === "LOST"
                ? "bg-red-600 text-white shadow-xs"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <XCircle className="w-4 h-4" />
            <span>Closed Lost</span>
          </button>
        </div>

        {status === "WON" ? (
          <div className="p-4 bg-emerald-50/75 border border-emerald-200 rounded-xl space-y-2 text-xs text-emerald-800">
            <p className="font-bold text-sm text-emerald-900">
              Celebrate Won Revenue!
            </p>
            <p>
              Closing as Won marks this deal with 100% win probability and records{" "}
              <strong>${opportunity.amount.toLocaleString()}</strong> as recognized revenue for{" "}
              <strong>{opportunity.companyName}</strong>.
            </p>
          </div>
        ) : (
          <div className="space-y-3 pt-1">
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-2 text-xs text-amber-800">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <span>
                Sales leadership uses loss reasons to analyze pricing, competition, and product gaps.
              </span>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Primary Reason for Loss <span className="text-red-500">*</span>
              </label>
              <select
                value={lossReason}
                onChange={(e) => setLossReason(e.target.value)}
                className="w-full h-9 rounded-lg border border-slate-300 bg-white px-3 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600"
                required
              >
                {LOSS_REASONS.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Additional Notes &amp; Feedback
              </label>
              <textarea
                value={lossNotes}
                onChange={(e) => setLossNotes(e.target.value)}
                placeholder="What feedback did the client give? Any future re-engagement date?"
                rows={3}
                className="w-full rounded-lg border border-slate-300 bg-white p-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600"
              />
            </div>
          </div>
        )}

        <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
          <Button type="button" variant="outline" onClick={onClose} disabled={isPending}>
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={isPending}
            className={
              status === "WON"
                ? "bg-emerald-600 hover:bg-emerald-700 text-white"
                : "bg-red-600 hover:bg-red-700 text-white"
            }
          >
            {isPending ? "Updating..." : status === "WON" ? "Confirm Closed Won" : "Confirm Closed Lost"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

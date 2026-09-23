"use client";

import Link from "next/link";
import {
  Building2,
  User,
  Calendar,
  MoreVertical,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { OpportunityItem } from "@/lib/validations/opportunities";

interface OpportunityTableProps {
  opportunities: OpportunityItem[];
  onEdit: (opp: OpportunityItem) => void;
  onCloseDeal: (opp: OpportunityItem, status: "WON" | "LOST") => void;
}

export function OpportunityTable({
  opportunities,
  onEdit,
  onCloseDeal,
}: OpportunityTableProps) {
  if (opportunities.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center">
        <p className="text-sm font-semibold text-slate-700">No opportunities found</p>
        <p className="text-xs text-slate-400 mt-1">
          Adjust your filters or create a new deal to populate the pipeline.
        </p>
      </div>
    );
  }

  const getStageBadgeVariant = (stageName: string, status: string) => {
    if (status === "WON") return "success";
    if (status === "LOST") return "destructive";
    if (stageName === "Proposal" || stageName === "Negotiation") return "warning";
    return "info";
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50/75 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              <th className="px-5 py-3">Deal Name</th>
              <th className="px-5 py-3">Company &amp; Contact</th>
              <th className="px-5 py-3">Stage</th>
              <th className="px-5 py-3">Probability</th>
              <th className="px-5 py-3">Amount</th>
              <th className="px-5 py-3">Target Close Date</th>
              <th className="px-5 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-xs">
            {opportunities.map((opp) => (
              <tr key={opp.id} className="hover:bg-slate-50/60 transition-colors group">
                <td className="px-5 py-3.5">
                  <Link
                    href={`/opportunities/${opp.id}`}
                    className="font-bold text-slate-900 hover:text-blue-600 block"
                  >
                    {opp.name}
                  </Link>
                  <span className="text-[11px] text-slate-400 font-medium">
                    Owner: {opp.ownerName}
                  </span>
                </td>

                <td className="px-5 py-3.5 space-y-0.5">
                  <Link
                    href={`/companies/${opp.companyId}`}
                    className="font-semibold text-slate-800 hover:text-blue-600 flex items-center gap-1.5"
                  >
                    <Building2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span>{opp.companyName}</span>
                  </Link>
                  {opp.primaryContactName && (
                    <div className="text-[11px] text-slate-500 flex items-center gap-1.5">
                      <User className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span>{opp.primaryContactName}</span>
                    </div>
                  )}
                </td>

                <td className="px-5 py-3.5">
                  <Badge variant={getStageBadgeVariant(opp.stageName, opp.status)}>
                    {opp.stageName}
                  </Badge>
                  {opp.status === "LOST" && opp.lossReason && (
                    <span className="block text-[10px] text-red-600 font-medium mt-0.5 truncate max-w-[150px]">
                      {opp.lossReason}
                    </span>
                  )}
                </td>

                <td className="px-5 py-3.5">
                  <div className="flex items-center gap-2">
                    <div className="w-16 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${
                          opp.status === "WON"
                            ? "bg-emerald-500"
                            : opp.status === "LOST"
                            ? "bg-red-400"
                            : "bg-blue-600"
                        }`}
                        style={{ width: `${opp.probability}%` }}
                      />
                    </div>
                    <span className="font-mono text-slate-600 font-semibold text-[11px]">
                      {opp.probability}%
                    </span>
                  </div>
                </td>

                <td className="px-5 py-3.5">
                  <span className="font-extrabold text-slate-900">
                    ${opp.amount.toLocaleString()}
                  </span>
                  <span className="text-[10px] text-slate-400 uppercase font-semibold ml-1">
                    USD
                  </span>
                </td>

                <td className="px-5 py-3.5 text-slate-600 font-medium">
                  {opp.expectedCloseDate ? (
                    <span className="flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5 text-slate-400" />
                      {opp.expectedCloseDate}
                    </span>
                  ) : (
                    <span className="text-slate-400 italic">Not set</span>
                  )}
                </td>

                <td className="px-5 py-3.5 text-right">
                  <div className="flex items-center justify-end gap-1.5">
                    {opp.status === "OPEN" && (
                      <>
                        <button
                          type="button"
                          onClick={() => onCloseDeal(opp, "WON")}
                          title="Mark as Won"
                          className="p-1.5 rounded-lg text-emerald-600 hover:bg-emerald-50 transition-colors"
                        >
                          <CheckCircle2 className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => onCloseDeal(opp, "LOST")}
                          title="Mark as Lost"
                          className="p-1.5 rounded-lg text-red-600 hover:bg-red-50 transition-colors"
                        >
                          <XCircle className="w-4 h-4" />
                        </button>
                      </>
                    )}
                    <button
                      type="button"
                      onClick={() => onEdit(opp)}
                      className="px-2 py-1 text-xs font-semibold text-slate-600 hover:text-slate-900 rounded hover:bg-slate-100"
                    >
                      Edit
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

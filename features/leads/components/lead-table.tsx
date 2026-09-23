"use client";

import Link from "next/link";
import {
  Users2,
  Mail,
  Phone,
  Search,
  ExternalLink,
  Edit2,
  Trash2,
  Flame,
  Zap,
  Snowflake,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { LeadItem } from "@/actions/leads";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface LeadTableProps {
  leads: LeadItem[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  selectedStatus: string;
  selectedRating: string;
  onPageChange: (page: number) => void;
  onSearchChange: (search: string) => void;
  onStatusChange: (status: string) => void;
  onRatingChange: (rating: string) => void;
  onEdit: (lead: LeadItem) => void;
  onDelete: (id: string) => void;
}

export function LeadTable({
  leads,
  meta,
  selectedStatus,
  selectedRating,
  onPageChange,
  onSearchChange,
  onStatusChange,
  onRatingChange,
  onEdit,
  onDelete,
}: LeadTableProps) {
  const getStatusBadge = (status: string) => {
    switch (status) {
      case "New":
        return <Badge variant="info">New</Badge>;
      case "Contacted":
        return <Badge variant="purple">Contacted</Badge>;
      case "Qualified":
        return <Badge variant="success">Qualified</Badge>;
      case "Unqualified":
        return <Badge variant="destructive">Unqualified</Badge>;
      case "Nurture":
        return <Badge variant="warning">Nurture</Badge>;
      case "Converted":
        return <Badge variant="default">Converted</Badge>;
      case "Lost":
        return <Badge variant="secondary">Lost</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const getRatingPill = (rating: string) => {
    switch (rating) {
      case "Hot":
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-red-600 bg-red-50 px-2 py-0.5 rounded-full border border-red-200">
            <Flame className="w-3 h-3 text-red-500 fill-red-500" /> Hot
          </span>
        );
      case "Warm":
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
            <Zap className="w-3 h-3 text-amber-500 fill-amber-500" /> Warm
          </span>
        );
      case "Cold":
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-200">
            <Snowflake className="w-3 h-3 text-blue-500" /> Cold
          </span>
        );
      default:
        return <span className="text-xs text-slate-400">{rating}</span>;
    }
  };

  const statusTabs = ["ALL", "New", "Contacted", "Qualified", "Nurture", "Lost"];

  return (
    <div className="space-y-4">
      {/* Status Filter Tabs & Search Bar */}
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-1.5 border-b border-slate-200 pb-2">
          {statusTabs.map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => onStatusChange(tab)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                selectedStatus === tab
                  ? "bg-blue-600 text-white shadow-xs"
                  : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
              }`}
            >
              {tab === "ALL" ? "All Leads" : tab}
            </button>
          ))}
        </div>

        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search leads by name, email, company, number..."
              onChange={(e) => onSearchChange(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all"
            />
          </div>

          <div className="flex items-center gap-2">
            <select
              value={selectedRating}
              onChange={(e) => onRatingChange(e.target.value)}
              className="text-xs font-medium text-slate-700 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="ALL">All Ratings</option>
              <option value="Hot">🔥 Hot</option>
              <option value="Warm">⚡ Warm</option>
              <option value="Cold">❄️ Cold</option>
            </select>
          </div>
        </div>
      </div>

      {/* Table Container */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/75 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                <th className="py-3 px-4">Lead</th>
                <th className="py-3 px-4">Company &amp; Title</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Rating</th>
                <th className="py-3 px-4 text-right">Estimated Value</th>
                <th className="py-3 px-4">Owner</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {leads.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    <Users2 className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                    <p className="font-semibold text-slate-700">No leads found</p>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Capture a new lead or adjust your search filters.
                    </p>
                  </td>
                </tr>
              ) : (
                leads.map((lead) => (
                  <tr key={lead.id} className="hover:bg-slate-50/80 transition-colors">
                    {/* Lead Name & Number */}
                    <td className="py-3.5 px-4">
                      <Link
                        href={`/leads/${lead.id}`}
                        className="group flex flex-col font-semibold text-slate-900 hover:text-blue-600"
                      >
                        <span className="group-hover:underline">{lead.fullName}</span>
                        <span className="text-[11px] text-slate-400 font-mono font-normal">
                          {lead.leadNumber} &bull; {lead.source}
                        </span>
                      </Link>
                    </td>

                    {/* Company & Title */}
                    <td className="py-3.5 px-4 text-xs text-slate-600">
                      <p className="font-medium text-slate-800">{lead.companyName || "Independent"}</p>
                      {lead.jobTitle && <p className="text-[11px] text-slate-400">{lead.jobTitle}</p>}
                    </td>

                    {/* Status */}
                    <td className="py-3.5 px-4">{getStatusBadge(lead.status)}</td>

                    {/* Rating */}
                    <td className="py-3.5 px-4">{getRatingPill(lead.rating)}</td>

                    {/* Estimated Value */}
                    <td className="py-3.5 px-4 text-right font-semibold text-slate-900 text-xs">
                      {lead.estimatedValue > 0
                        ? `$${lead.estimatedValue.toLocaleString()}`
                        : "—"}
                    </td>

                    {/* Owner */}
                    <td className="py-3.5 px-4 text-xs text-slate-600">
                      {lead.ownerName || "Unassigned"}
                    </td>

                    {/* Actions */}
                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Link
                          href={`/leads/${lead.id}`}
                          className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
                          title="View Lead Details"
                        >
                          <ExternalLink className="w-4 h-4" />
                        </Link>
                        <button
                          type="button"
                          onClick={() => onEdit(lead)}
                          className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          title="Edit"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            if (confirm(`Are you sure you want to delete lead ${lead.fullName}?`)) {
                              onDelete(lead.id);
                            }
                          }}
                          className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          title="Delete"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        <div className="px-4 py-3 border-t border-slate-200 bg-slate-50/50 flex items-center justify-between text-xs text-slate-500">
          <div>
            Showing <span className="font-semibold text-slate-800">{leads.length}</span> of{" "}
            <span className="font-semibold text-slate-800">{meta.total}</span> leads
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={meta.page <= 1}
              onClick={() => onPageChange(meta.page - 1)}
            >
              <ChevronLeft className="w-3.5 h-3.5 mr-1" />
              Previous
            </Button>
            <span className="text-slate-600 font-medium px-1">
              Page {meta.page} of {meta.totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={meta.page >= meta.totalPages}
              onClick={() => onPageChange(meta.page + 1)}
            >
              Next
              <ChevronRight className="w-3.5 h-3.5 ml-1" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

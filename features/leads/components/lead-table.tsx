"use client";

import { useState, useRef, useEffect } from "react";
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
  Play,
  UserCheck,
  X,
  AlertTriangle,
  Loader2,
} from "lucide-react";
import type { LeadItem } from "@/lib/validations/leads";
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
  isTechfluxOrg?: boolean;
  selectedLeadIds?: string[];
  isAdminOrManager?: boolean;
  teamMembers?: { id: string; name: string; email: string; role: string }[];
  isBulkAssigning?: boolean;
  isBulkDeleting?: boolean;
  onPageChange: (page: number) => void;
  onSearchChange: (search: string) => void;
  onStatusChange: (status: string) => void;
  onRatingChange: (rating: string) => void;
  onEdit: (lead: LeadItem) => void;
  onDelete: (id: string) => void;
  onPickLead?: (id: string) => void;
  onToggleSelectLead?: (id: string) => void;
  onToggleSelectAll?: () => void;
  onBulkAssign?: (ownerId: string) => void;
  onBulkDelete?: () => void;
  onClearSelection?: () => void;
}

export function LeadTable({
  leads,
  meta,
  selectedStatus,
  selectedRating,
  isTechfluxOrg = false,
  selectedLeadIds = [],
  isAdminOrManager = false,
  teamMembers = [],
  isBulkAssigning = false,
  isBulkDeleting = false,
  onPageChange,
  onSearchChange,
  onStatusChange,
  onRatingChange,
  onEdit,
  onDelete,
  onPickLead,
  onToggleSelectLead,
  onToggleSelectAll,
  onBulkAssign,
  onBulkDelete,
  onClearSelection,
}: LeadTableProps) {
  const [bulkTargetOwner, setBulkTargetOwner] = useState("");
  const [isConfirmDeleteOpen, setIsConfirmDeleteOpen] = useState(false);
  const selectAllRef = useRef<HTMLInputElement>(null);

  const pageIds = leads.map((l) => l.id);
  const isAllSelected =
    pageIds.length > 0 && pageIds.every((id) => selectedLeadIds.includes(id));
  const isSomeSelected =
    pageIds.some((id) => selectedLeadIds.includes(id)) && !isAllSelected;

  useEffect(() => {
    if (selectAllRef.current) {
      selectAllRef.current.indeterminate = isSomeSelected;
    }
  }, [isSomeSelected]);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "Scraped":
        return (
          <Badge variant="secondary" className="bg-indigo-50 text-indigo-700 border-indigo-200">
            Scraped
          </Badge>
        );
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

  const statusTabs = isTechfluxOrg
    ? ["ALL", "Scraped", "New", "Contacted", "Qualified", "Nurture", "Lost"]
    : ["ALL", "New", "Contacted", "Qualified", "Nurture", "Lost"];

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
                <th className="py-3 px-3.5 w-10 text-center">
                  <input
                    ref={selectAllRef}
                    type="checkbox"
                    checked={isAllSelected}
                    onChange={onToggleSelectAll}
                    className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer accent-blue-600 align-middle"
                    title="Select all on this page"
                  />
                </th>
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
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    <Users2 className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                    <p className="font-semibold text-slate-700">No leads found</p>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Capture a new lead or adjust your search filters.
                    </p>
                  </td>
                </tr>
              ) : (
                leads.map((lead) => {
                  const isSelected = selectedLeadIds.includes(lead.id);
                  return (
                    <tr
                      key={lead.id}
                      className={`hover:bg-slate-50/80 transition-colors ${
                        isSelected ? "bg-blue-50/50" : ""
                      }`}
                    >
                      {/* Selection Checkbox */}
                      <td className="py-3.5 px-3.5 w-10 text-center">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => onToggleSelectLead?.(lead.id)}
                          className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer accent-blue-600 align-middle"
                          title={`Select ${lead.fullName}`}
                        />
                      </td>

                      {/* Lead Name & Number */}
                      <td className="py-3.5 px-4">
                      <div className="flex items-center gap-1.5">
                        <div className="flex flex-col font-semibold text-slate-900 min-w-0">
                          <Link
                            href={`/leads/${lead.id}`}
                            className="group hover:text-blue-600 truncate"
                          >
                            <span className="group-hover:underline">{lead.fullName}</span>
                          </Link>
                          <span className="text-[11px] text-slate-400 font-mono font-normal">
                            {lead.leadNumber} &bull; {lead.source}
                          </span>
                          {(lead.email || lead.supportEmail) && (
                            <div className="flex items-center gap-2 mt-1 text-[11px] text-slate-500 flex-wrap">
                              {lead.email && (
                                <span className="inline-flex items-center gap-1 text-slate-600 truncate max-w-[190px]" title={`Customer Email: ${lead.email}`}>
                                  <Mail className="w-3 h-3 text-slate-400 shrink-0" />
                                  <span className="truncate">{lead.email}</span>
                                </span>
                              )}
                              {lead.supportEmail && (
                                <span className="inline-flex items-center gap-1 text-indigo-600 font-medium truncate max-w-[190px]" title={`Support Email: ${lead.supportEmail}`}>
                                  <span className="text-[10px] bg-indigo-50 border border-indigo-200 px-1 rounded text-indigo-700 font-semibold">Support</span>
                                  <span className="truncate">{lead.supportEmail}</span>
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                        {lead.customerLinkedin && (
                          <a
                            href={lead.customerLinkedin}
                            target="_blank"
                            rel="noreferrer"
                            className="p-1 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors shrink-0 self-start mt-0.5"
                            title={`Customer LinkedIn: ${lead.customerLinkedin}`}
                          >
                            <span className="sr-only">Customer LinkedIn</span>
                            <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24">
                              <path d="M19 3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14m-.5 15.5v-5.3a3.26 3.26 0 0 0-3.26-3.26c-.85 0-1.84.52-2.28 1.3v-1.11h-2.79v8.37h2.79v-4.93c0-.77.62-1.4 1.39-1.4a1.4 1.4 0 0 1 1.4 1.4v4.93h2.75M6.46 10.9v7.6H9.2v-7.6H6.46M7.83 6.25c-.9 0-1.63.73-1.63 1.63s.73 1.63 1.63 1.63 1.63-.73 1.63-1.63-.73-1.63-1.63-1.63" />
                            </svg>
                          </a>
                        )}
                      </div>
                    </td>

                    {/* Company & Title */}
                    <td className="py-3.5 px-4 text-xs text-slate-600">
                      <div className="flex items-center gap-1.5">
                        <p className="font-medium text-slate-800 truncate">{lead.companyName || "Independent"}</p>
                        {lead.companyLinkedin && (
                          <a
                            href={lead.companyLinkedin}
                            target="_blank"
                            rel="noreferrer"
                            className="p-1 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors shrink-0"
                            title={`Company LinkedIn: ${lead.companyLinkedin}`}
                          >
                            <span className="sr-only">Company LinkedIn</span>
                            <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24">
                              <path d="M19 3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14m-.5 15.5v-5.3a3.26 3.26 0 0 0-3.26-3.26c-.85 0-1.84.52-2.28 1.3v-1.11h-2.79v8.37h2.79v-4.93c0-.77.62-1.4 1.39-1.4a1.4 1.4 0 0 1 1.4 1.4v4.93h2.75M6.46 10.9v7.6H9.2v-7.6H6.46M7.83 6.25c-.9 0-1.63.73-1.63 1.63s.73 1.63 1.63 1.63 1.63-.73 1.63-1.63-.73-1.63-1.63-1.63" />
                            </svg>
                          </a>
                        )}
                      </div>
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
                        {lead.status === "Scraped" && onPickLead && (
                          <button
                            type="button"
                            onClick={() => onPickLead(lead.id)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-lg transition-colors shadow-2xs mr-1"
                            title="Pick Lead & Activate to New"
                          >
                            <Play className="w-3 h-3 fill-indigo-600 text-indigo-600" />
                            <span>Pick</span>
                          </button>
                        )}
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
                );
              })
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

      {/* Floating Bulk Actions Bar */}
      {selectedLeadIds.length > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 bg-slate-900 text-white rounded-2xl shadow-2xl border border-slate-700/80 px-4 py-2.5 flex items-center gap-3 sm:gap-4 animate-in fade-in slide-in-from-bottom-4 duration-200">
          <div className="flex items-center gap-2 pr-3 border-r border-slate-700">
            <span className="flex items-center justify-center bg-blue-600 text-white text-xs font-bold px-2 py-0.5 rounded-full">
              {selectedLeadIds.length}
            </span>
            <span className="text-xs font-semibold text-slate-200 hidden sm:inline">
              {selectedLeadIds.length === 1 ? "lead selected" : "leads selected"}
            </span>
          </div>

          {isAdminOrManager && teamMembers && teamMembers.length > 0 && (
            <div className="flex items-center gap-1.5">
              <select
                value={bulkTargetOwner}
                onChange={(e) => setBulkTargetOwner(e.target.value)}
                className="text-xs bg-slate-800 text-slate-100 border border-slate-700 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Assign To...</option>
                {teamMembers.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name} ({m.role.replace("_", " ")})
                  </option>
                ))}
              </select>
              <Button
                type="button"
                size="sm"
                disabled={!bulkTargetOwner || isBulkAssigning}
                onClick={() => {
                  if (bulkTargetOwner && onBulkAssign) {
                    onBulkAssign(bulkTargetOwner);
                  }
                }}
                className="bg-blue-600 hover:bg-blue-500 text-white text-xs px-3 h-8 shadow-xs"
              >
                {isBulkAssigning ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" />
                ) : (
                  <UserCheck className="w-3.5 h-3.5 mr-1" />
                )}
                <span>Assign</span>
              </Button>
            </div>
          )}

          {onBulkDelete && (
            <Button
              type="button"
              size="sm"
              variant="destructive"
              disabled={isBulkDeleting}
              onClick={() => setIsConfirmDeleteOpen(true)}
              className="text-xs px-3 h-8 shadow-xs bg-red-600 hover:bg-red-700 text-white"
            >
              {isBulkDeleting ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" />
              ) : (
                <Trash2 className="w-3.5 h-3.5 mr-1" />
              )}
              <span>Delete ({selectedLeadIds.length})</span>
            </Button>
          )}

          {onClearSelection && (
            <button
              type="button"
              onClick={onClearSelection}
              className="p-1 text-slate-400 hover:text-white rounded-md hover:bg-slate-800 transition-colors ml-1"
              title="Clear selection"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      )}

      {/* Confirmation Modal for Bulk Delete */}
      {isConfirmDeleteOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-100 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center text-red-600 shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  Delete {selectedLeadIds.length} {selectedLeadIds.length === 1 ? "Lead" : "Leads"}?
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  This will soft-delete the selected leads from active lists.
                </p>
              </div>
            </div>
            <p className="text-xs text-slate-600 mb-6 bg-slate-50 p-3 rounded-lg border border-slate-200">
              Are you sure you want to proceed? This will remove <strong>{selectedLeadIds.length}</strong> leads from active pipelines and tables.
            </p>
            <div className="flex items-center justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={isBulkDeleting}
                onClick={() => setIsConfirmDeleteOpen(false)}
              >
                Cancel
              </Button>
              <Button
                type="button"
                variant="destructive"
                size="sm"
                disabled={isBulkDeleting}
                onClick={async () => {
                  if (onBulkDelete) {
                    await onBulkDelete();
                  }
                  setIsConfirmDeleteOpen(false);
                }}
                className="bg-red-600 hover:bg-red-700"
              >
                {isBulkDeleting ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" />
                ) : (
                  <Trash2 className="w-3.5 h-3.5 mr-1" />
                )}
                <span>Confirm Delete</span>
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

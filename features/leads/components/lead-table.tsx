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
  Megaphone,
  SlidersHorizontal,
  FileText,
  Check,
  RotateCcw,
  Calendar,
  Tag,
  Copy,
  Send,
  Clock,
  Minus,
} from "lucide-react";
import type { LeadItem } from "@/lib/validations/leads";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export type ColumnId =
  | "lead"
  | "emailStatus"
  | "notes"
  | "company"
  | "status"
  | "rating"
  | "value"
  | "owner"
  | "contact"
  | "source"
  | "createdAt"
  | "actions";

export interface ColumnDef {
  id: ColumnId;
  label: string;
  description: string;
  isLocked?: boolean;
  align?: "left" | "right";
}

export const ALL_COLUMNS: ColumnDef[] = [
  { id: "lead", label: "Lead", description: "Name, ID, & Primary details", isLocked: true },
  { id: "emailStatus", label: "Email Status", description: "Outreach state (Sent / Follow up / NA)" },
  { id: "notes", label: "Notes", description: "Discovery notes, context & summary" },
  { id: "company", label: "Company & Title", description: "Account name and job title" },
  { id: "status", label: "Status", description: "Qualification pipeline status" },
  { id: "rating", label: "Rating", description: "Priority rating (Hot, Warm, Cold)" },
  { id: "value", label: "Estimated Value", description: "Projected deal value amount", align: "right" },
  { id: "owner", label: "Owner", description: "Assigned sales representative" },
  { id: "contact", label: "Contact Info", description: "Direct customer phone & email" },
  { id: "source", label: "Source", description: "Lead acquisition channel" },
  { id: "createdAt", label: "Created Date", description: "Date lead was added to CRM" },
  { id: "actions", label: "Actions", description: "Quick action buttons", align: "right" },
];

export const DEFAULT_VISIBLE_COLUMNS: ColumnId[] = [
  "lead",
  "emailStatus",
  "notes",
  "company",
  "status",
  "rating",
  "value",
  "owner",
  "actions",
];

const LOCAL_STORAGE_KEY = "roxx_leads_table_columns_v2";

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
  selectedOwner?: string;
  selectedEmailStatus?: string;
  searchQuery?: string;
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
  onOwnerChange?: (owner: string) => void;
  onEmailStatusChange?: (emailStatus: string) => void;
  onResetAllFilters?: () => void;
  onEdit: (lead: LeadItem) => void;
  onDelete: (id: string) => void;
  onPickLead?: (id: string) => void;
  onToggleSelectLead?: (id: string) => void;
  onToggleSelectAll?: () => void;
  onBulkAssign?: (ownerId: string) => void;
  onBulkDelete?: () => void;
  onClearSelection?: () => void;
  onCreateMarketingBatch?: () => void;
  onUpdateEmailStatus?: (leadId: string, status: "Sent" | "Follow up" | "NA") => void;
}

export function LeadTable({
  leads,
  meta,
  selectedStatus,
  selectedRating,
  selectedOwner = "ALL",
  selectedEmailStatus = "ALL",
  searchQuery = "",
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
  onOwnerChange,
  onEmailStatusChange,
  onResetAllFilters,
  onEdit,
  onDelete,
  onPickLead,
  onToggleSelectLead,
  onToggleSelectAll,
  onBulkAssign,
  onBulkDelete,
  onClearSelection,
  onCreateMarketingBatch,
  onUpdateEmailStatus,
}: LeadTableProps) {
  const [bulkTargetOwner, setBulkTargetOwner] = useState("");
  const [isConfirmDeleteOpen, setIsConfirmDeleteOpen] = useState(false);
  const selectAllRef = useRef<HTMLInputElement>(null);

  // Column Customization State
  const [visibleColumns, setVisibleColumns] = useState<ColumnId[]>(DEFAULT_VISIBLE_COLUMNS);
  const [isColumnPickerOpen, setIsColumnPickerOpen] = useState(false);
  const [previewNoteLead, setPreviewNoteLead] = useState<LeadItem | null>(null);
  const [isCopiedNote, setIsCopiedNote] = useState(false);
  const columnPickerRef = useRef<HTMLDivElement>(null);

  // Restore column preferences from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem(LOCAL_STORAGE_KEY) || localStorage.getItem("roxx_leads_table_columns_v1");
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          // Guarantee new columns emailStatus and notes are visible by default
          const combined = Array.from(new Set([...parsed, "emailStatus", "notes"]));
          const valid = ALL_COLUMNS.filter(
            (c) => c.isLocked || combined.includes(c.id)
          ).map((c) => c.id);
          setVisibleColumns(valid);
        }
      }
    } catch {
      // Ignore localStorage read errors
    }
  }, []);

  // Close column picker on click outside or Escape
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        columnPickerRef.current &&
        !columnPickerRef.current.contains(event.target as Node)
      ) {
        setIsColumnPickerOpen(false);
      }
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsColumnPickerOpen(false);
        setPreviewNoteLead(null);
      }
    }
    if (isColumnPickerOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isColumnPickerOpen]);

  const handleToggleColumn = (colId: ColumnId) => {
    const col = ALL_COLUMNS.find((c) => c.id === colId);
    if (col?.isLocked) return;

    const next = visibleColumns.includes(colId)
      ? visibleColumns.filter((id) => id !== colId)
      : [...visibleColumns, colId];

    setVisibleColumns(next);
    try {
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(next));
    } catch {}
  };

  const handleResetColumns = () => {
    setVisibleColumns(DEFAULT_VISIBLE_COLUMNS);
    try {
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(DEFAULT_VISIBLE_COLUMNS));
    } catch {}
  };

  const handleSelectAllColumns = () => {
    const all = ALL_COLUMNS.map((c) => c.id);
    setVisibleColumns(all);
    try {
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(all));
    } catch {}
  };

  const isVisible = (id: ColumnId) => visibleColumns.includes(id);
  const totalVisibleColumnCount = 1 + visibleColumns.length; // 1 for selection checkbox

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

  const renderEmailStatusBadge = (status?: string | null, size: "xs" | "sm" = "sm") => {
    const isSmall = size === "xs";
    const baseClasses = isSmall
      ? "text-[10px] px-1.5 py-0.5"
      : "text-xs px-2.5 py-1 font-semibold";

    switch (status) {
      case "Sent":
        return (
          <span
            className={`inline-flex items-center gap-1 font-bold text-blue-700 bg-blue-50 border border-blue-200 rounded-full shadow-2xs ${baseClasses}`}
            title="Outreach email sent"
          >
            <Send className={isSmall ? "w-2.5 h-2.5 text-blue-600" : "w-3 h-3 text-blue-600"} />
            <span>Sent</span>
          </span>
        );
      case "Follow up":
        return (
          <span
            className={`inline-flex items-center gap-1 font-bold text-amber-700 bg-amber-50 border border-amber-200 rounded-full shadow-2xs ${baseClasses}`}
            title="Follow-up email required or scheduled"
          >
            <Clock className={isSmall ? "w-2.5 h-2.5 text-amber-600" : "w-3 h-3 text-amber-600"} />
            <span>Follow up</span>
          </span>
        );
      case "NA":
      default:
        return (
          <span
            className={`inline-flex items-center gap-1 font-medium text-slate-500 bg-slate-100 border border-slate-200 rounded-full ${baseClasses}`}
            title="No outreach email sent / Not applicable"
          >
            <Minus className={isSmall ? "w-2.5 h-2.5 text-slate-400" : "w-3 h-3 text-slate-400"} />
            <span>NA</span>
          </span>
        );
    }
  };

  const statusTabs = isTechfluxOrg
    ? ["ALL", "Scraped", "New", "Contacted", "Qualified", "Nurture", "Lost"]
    : ["ALL", "New", "Contacted", "Qualified", "Nurture", "Lost"];

  const hasActiveFilters = Boolean(
    (searchQuery && searchQuery.trim() !== "") ||
    (selectedStatus && selectedStatus !== "ALL") ||
    (selectedRating && selectedRating !== "ALL") ||
    (selectedOwner && selectedOwner !== "ALL") ||
    (selectedEmailStatus && selectedEmailStatus !== "ALL")
  );

  return (
    <div className="space-y-4">
      {/* Status Filter Tabs & Scope Quick Switcher */}
      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-2">
          {/* Status Pipeline Tabs */}
          <div className="flex flex-wrap items-center gap-1.5">
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
                {tab === "ALL" ? "All Statuses" : tab}
              </button>
            ))}
          </div>

          {/* Quick Scope Switcher: All vs My Leads */}
          <div className="flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-200/90 text-xs font-semibold shrink-0">
            <button
              type="button"
              onClick={() => onOwnerChange?.("ALL")}
              className={`px-2.5 py-1 rounded-md transition-all ${
                selectedOwner === "ALL"
                  ? "bg-white text-slate-900 shadow-2xs font-bold"
                  : "text-slate-500 hover:text-slate-800"
              }`}
            >
              All Leads
            </button>
            <button
              type="button"
              onClick={() => onOwnerChange?.("ME")}
              className={`px-2.5 py-1 rounded-md transition-all flex items-center gap-1 ${
                selectedOwner === "ME"
                  ? "bg-blue-600 text-white shadow-2xs font-bold"
                  : "text-slate-500 hover:text-slate-800"
              }`}
            >
              <span>👤 My Leads</span>
            </button>
          </div>
        </div>

        {/* Filter Toolbar: Search, Owner, Email Status, Rating, Columns, Clear */}
        <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-xs flex flex-col xl:flex-row xl:items-center justify-between gap-2.5">
          {/* Search Box */}
          <div className="relative flex-1 min-w-[220px] max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              placeholder="Search leads by name, email, company, number..."
              onChange={(e) => onSearchChange(e.target.value)}
              className="w-full pl-9 pr-8 py-1.5 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => onSearchChange("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5"
                title="Clear search"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Filter Dropdowns & Display Options */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Owner Filter Dropdown */}
            <select
              value={selectedOwner}
              onChange={(e) => onOwnerChange?.(e.target.value)}
              className={`text-xs font-semibold rounded-lg px-2.5 py-2 border transition-all cursor-pointer shadow-2xs ${
                selectedOwner !== "ALL"
                  ? "bg-blue-50/80 border-blue-300 text-blue-900"
                  : "bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-700"
              }`}
              title="Filter by Lead Owner"
            >
              <option value="ALL">👤 All Owners</option>
              <option value="ME">⭐ My Leads</option>
              <option value="UNASSIGNED">⚪ Unassigned</option>
              {teamMembers && teamMembers.length > 0 && (
                <optgroup label="Sales Reps">
                  {teamMembers.map((member) => (
                    <option key={member.id} value={member.id}>
                      {member.name}
                    </option>
                  ))}
                </optgroup>
              )}
            </select>

            {/* Email Status Filter Dropdown */}
            <select
              value={selectedEmailStatus}
              onChange={(e) => onEmailStatusChange?.(e.target.value)}
              className={`text-xs font-semibold rounded-lg px-2.5 py-2 border transition-all cursor-pointer shadow-2xs ${
                selectedEmailStatus !== "ALL"
                  ? "bg-blue-50/80 border-blue-300 text-blue-900"
                  : "bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-700"
              }`}
              title="Filter by Email Outreach Status"
            >
              <option value="ALL">✉️ All Email Status</option>
              <option value="Sent">Sent</option>
              <option value="Follow up">Follow up</option>
              <option value="NA">NA (Not Sent)</option>
            </select>

            {/* Rating Filter Dropdown */}
            <select
              value={selectedRating}
              onChange={(e) => onRatingChange(e.target.value)}
              className={`text-xs font-semibold rounded-lg px-2.5 py-2 border transition-all cursor-pointer shadow-2xs ${
                selectedRating !== "ALL"
                  ? "bg-blue-50/80 border-blue-300 text-blue-900"
                  : "bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-700"
              }`}
              title="Filter by Priority Rating"
            >
              <option value="ALL">All Ratings</option>
              <option value="Hot">🔥 Hot</option>
              <option value="Warm">⚡ Warm</option>
              <option value="Cold">❄️ Cold</option>
            </select>

            {/* Column Customization Picker */}
            <div className="relative" ref={columnPickerRef}>
              <button
                type="button"
                onClick={() => setIsColumnPickerOpen((prev) => !prev)}
                className={`inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg border transition-all shadow-2xs ${
                  isColumnPickerOpen
                    ? "bg-blue-50 border-blue-300 text-blue-700 ring-2 ring-blue-100"
                    : "bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-700"
                }`}
                title="Customize table columns"
              >
                <SlidersHorizontal className="w-3.5 h-3.5 text-slate-500" />
                <span>Columns</span>
                <span className="bg-blue-100 text-blue-700 text-[10px] font-bold px-1.5 py-0.2 rounded-full">
                  {visibleColumns.length}
                </span>
              </button>

              {isColumnPickerOpen && (
                <div className="absolute right-0 mt-2 w-64 bg-white rounded-xl shadow-xl border border-slate-200 py-2.5 z-30 animate-in fade-in zoom-in-95 duration-150">
                  <div className="px-3 pb-2 border-b border-slate-100 flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                      Customize Columns
                    </span>
                    <button
                      type="button"
                      onClick={handleResetColumns}
                      className="text-[11px] text-blue-600 hover:text-blue-800 font-semibold inline-flex items-center gap-1"
                      title="Reset to default columns"
                    >
                      <RotateCcw className="w-3 h-3" />
                      Reset
                    </button>
                  </div>

                  <div className="py-1.5 max-h-72 overflow-y-auto px-1 divide-y divide-slate-50">
                    {ALL_COLUMNS.map((col) => {
                      const isChecked = visibleColumns.includes(col.id);
                      return (
                        <label
                          key={col.id}
                          className={`flex items-start gap-2.5 px-2.5 py-2 rounded-lg cursor-pointer transition-colors ${
                            col.isLocked
                              ? "opacity-60 cursor-not-allowed bg-slate-50/50"
                              : "hover:bg-slate-50"
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={isChecked}
                            disabled={col.isLocked}
                            onChange={() => handleToggleColumn(col.id)}
                            className="mt-0.5 w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer accent-blue-600"
                          />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-1">
                              <span className="text-xs font-semibold text-slate-800 truncate">
                                {col.label}
                              </span>
                              {col.isLocked && (
                                <span className="text-[10px] text-slate-400 font-medium">Required</span>
                              )}
                              {col.id === "notes" && (
                                <span className="text-[10px] bg-blue-50 text-blue-600 font-bold px-1 rounded">New</span>
                              )}
                            </div>
                            <p className="text-[11px] text-slate-400 leading-tight truncate">
                              {col.description}
                            </p>
                          </div>
                        </label>
                      );
                    })}
                  </div>

                  <div className="px-3 pt-2 border-t border-slate-100 flex items-center justify-between text-[11px]">
                    <button
                      type="button"
                      onClick={handleSelectAllColumns}
                      className="text-slate-600 hover:text-slate-900 font-medium hover:underline"
                    >
                      Select All
                    </button>
                    <span className="text-slate-400">
                      {visibleColumns.length} of {ALL_COLUMNS.length} visible
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Clear / Reset All Filters button */}
            {hasActiveFilters && onResetAllFilters && (
              <button
                type="button"
                onClick={onResetAllFilters}
                className="inline-flex items-center gap-1 px-2.5 py-2 text-xs font-semibold text-rose-600 hover:text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-lg transition-colors shadow-2xs"
                title="Clear all active search and filter criteria"
              >
                <X className="w-3.5 h-3.5" />
                <span>Reset Filters</span>
              </button>
            )}
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
                {isVisible("lead") && <th className="py-3 px-4">Lead</th>}
                {isVisible("emailStatus") && <th className="py-3 px-4">Email Status</th>}
                {isVisible("notes") && <th className="py-3 px-4">Notes</th>}
                {isVisible("company") && <th className="py-3 px-4">Company &amp; Title</th>}
                {isVisible("status") && <th className="py-3 px-4">Status</th>}
                {isVisible("rating") && <th className="py-3 px-4">Rating</th>}
                {isVisible("value") && <th className="py-3 px-4 text-right">Estimated Value</th>}
                {isVisible("owner") && <th className="py-3 px-4">Owner</th>}
                {isVisible("contact") && <th className="py-3 px-4">Contact Info</th>}
                {isVisible("source") && <th className="py-3 px-4">Source</th>}
                {isVisible("createdAt") && <th className="py-3 px-4">Created Date</th>}
                {isVisible("actions") && <th className="py-3 px-4 text-right">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {leads.length === 0 ? (
                <tr>
                  <td colSpan={totalVisibleColumnCount} className="py-12 text-center text-slate-400">
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
                      {isVisible("lead") && (
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
                              {/* Email Status & Notes sub-row in Lead Column */}
                              <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                                <span className="text-[10px] text-slate-400 font-medium">Email:</span>
                                {renderEmailStatusBadge(lead.emailStatus || "NA", "xs")}
                              </div>
                              {lead.description ? (
                                <button
                                  type="button"
                                  onClick={() => setPreviewNoteLead(lead)}
                                  className="flex items-start gap-1 text-[11px] text-slate-500 mt-1 cursor-pointer hover:text-blue-600 group/note text-left max-w-[240px]"
                                  title={`Notes for ${lead.fullName}:\n${lead.description}`}
                                >
                                  <FileText className="w-3 h-3 text-slate-400 shrink-0 mt-0.5 group-hover/note:text-blue-500" />
                                  <span className="line-clamp-1 group-hover/note:underline">
                                    {lead.description.replace(/\n+/g, " • ").trim()}
                                  </span>
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => onEdit(lead)}
                                  className="inline-flex items-center gap-1 text-[10px] text-slate-400 hover:text-blue-500 mt-0.5"
                                  title="Add note for this lead"
                                >
                                  <FileText className="w-2.5 h-2.5 text-slate-300" />
                                  <span className="text-slate-400 italic">No notes</span>
                                  <span className="text-blue-500 underline ml-0.5">+ Add</span>
                                </button>
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
                      )}

                      {/* Email Status Column */}
                      {isVisible("emailStatus") && (
                        <td className="py-3.5 px-4 text-xs whitespace-nowrap">
                          <div className="flex items-center gap-1.5">
                            {renderEmailStatusBadge(lead.emailStatus || "NA", "sm")}
                            {onUpdateEmailStatus && (
                              <select
                                value={lead.emailStatus || "NA"}
                                onChange={(e) =>
                                  onUpdateEmailStatus(
                                    lead.id,
                                    e.target.value as "Sent" | "Follow up" | "NA"
                                  )
                                }
                                className="text-[10px] text-slate-500 bg-slate-50 border border-slate-200 rounded px-1.5 py-0.5 cursor-pointer hover:border-slate-300 focus:outline-none focus:ring-1 focus:ring-blue-500"
                                title="Change email status"
                              >
                                <option value="Sent">Sent</option>
                                <option value="Follow up">Follow up</option>
                                <option value="NA">NA</option>
                              </select>
                            )}
                          </div>
                        </td>
                      )}

                      {/* Notes & Discovery Context */}
                      {isVisible("notes") && (
                        <td className="py-3.5 px-4 text-xs text-slate-600 max-w-[240px]">
                          {lead.description ? (
                            <button
                              type="button"
                              onClick={() => setPreviewNoteLead(lead)}
                              className="text-left group w-full flex items-start gap-1.5 p-1 -m-1 rounded-md hover:bg-slate-100 transition-colors"
                              title="Click to view full notes & context"
                            >
                              <FileText className="w-3.5 h-3.5 text-blue-500 shrink-0 mt-0.5 group-hover:text-blue-600" />
                              <span className="line-clamp-2 text-[12px] text-slate-700 leading-tight group-hover:text-blue-700">
                                {lead.description.replace(/\n+/g, " • ").trim()}
                              </span>
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => onEdit(lead)}
                              className="inline-flex items-center gap-1 text-[11px] text-slate-400 hover:text-blue-600 py-1 transition-colors"
                              title="Add notes for this lead"
                            >
                              <span className="text-slate-300 italic">—</span>
                              <span className="text-[10px] text-blue-500 hover:underline ml-0.5">
                                + Add
                              </span>
                            </button>
                          )}
                        </td>
                      )}

                      {/* Company & Title */}
                      {isVisible("company") && (
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
                      )}

                      {/* Status */}
                      {isVisible("status") && (
                        <td className="py-3.5 px-4">{getStatusBadge(lead.status)}</td>
                      )}

                      {/* Rating */}
                      {isVisible("rating") && (
                        <td className="py-3.5 px-4">{getRatingPill(lead.rating)}</td>
                      )}

                      {/* Estimated Value */}
                      {isVisible("value") && (
                        <td className="py-3.5 px-4 text-right font-semibold text-slate-900 text-xs">
                          {lead.estimatedValue > 0
                            ? `$${lead.estimatedValue.toLocaleString()}`
                            : "—"}
                        </td>
                      )}

                      {/* Owner */}
                      {isVisible("owner") && (
                        <td className="py-3.5 px-4 text-xs text-slate-600">
                          {lead.ownerName || "Unassigned"}
                        </td>
                      )}

                      {/* Contact Info (Phone & Email) */}
                      {isVisible("contact") && (
                        <td className="py-3.5 px-4 text-xs text-slate-600 whitespace-nowrap">
                          <div className="flex flex-col gap-1">
                            {lead.phone ? (
                              <a
                                href={`tel:${lead.phone}`}
                                className="inline-flex items-center gap-1.5 text-slate-700 hover:text-blue-600 font-medium text-[11px]"
                                title={`Call ${lead.phone}`}
                              >
                                <Phone className="w-3 h-3 text-emerald-500 shrink-0" />
                                <span>{lead.phone}</span>
                              </a>
                            ) : null}
                            {(lead.email || lead.supportEmail) ? (
                              <a
                                href={`mailto:${lead.email || lead.supportEmail}`}
                                className="inline-flex items-center gap-1.5 text-slate-600 hover:text-blue-600 text-[11px] truncate max-w-[170px]"
                                title={lead.email || lead.supportEmail || ""}
                              >
                                <Mail className="w-3 h-3 text-slate-400 shrink-0" />
                                <span className="truncate">{lead.email || lead.supportEmail}</span>
                              </a>
                            ) : null}
                            {!lead.phone && !lead.email && !lead.supportEmail && (
                              <span className="text-slate-300 italic text-xs">—</span>
                            )}
                          </div>
                        </td>
                      )}

                      {/* Source */}
                      {isVisible("source") && (
                        <td className="py-3.5 px-4 text-xs text-slate-600 whitespace-nowrap">
                          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-700 bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200">
                            <Tag className="w-3 h-3 text-slate-400" />
                            {lead.source || "Website"}
                          </span>
                        </td>
                      )}

                      {/* Created Date */}
                      {isVisible("createdAt") && (
                        <td className="py-3.5 px-4 text-xs text-slate-600 whitespace-nowrap">
                          <div className="flex items-center gap-1.5 text-slate-600 text-[11px]">
                            <Calendar className="w-3 h-3 text-slate-400 shrink-0" />
                            <span>
                              {new Date(lead.createdAt).toLocaleDateString(undefined, {
                                month: "short",
                                day: "numeric",
                                year: "numeric",
                              })}
                            </span>
                          </div>
                        </td>
                      )}

                      {/* Actions */}
                      {isVisible("actions") && (
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
                      )}
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

          {onCreateMarketingBatch && (
            <Button
              type="button"
              size="sm"
              onClick={onCreateMarketingBatch}
              className="text-xs px-3 h-8 shadow-xs bg-indigo-600 hover:bg-indigo-500 text-white font-medium"
            >
              <Megaphone className="w-3.5 h-3.5 mr-1" />
              <span>Create Batch ({selectedLeadIds.length})</span>
            </Button>
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

      {/* Quick Note Preview Modal */}
      {previewNoteLead && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-lg w-full overflow-hidden animate-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-600">
                  <FileText className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                    <span>{previewNoteLead.fullName}</span>
                    <span className="text-[10px] font-mono font-normal text-slate-500 bg-slate-100 border border-slate-200 px-1.5 py-0.5 rounded">
                      {previewNoteLead.leadNumber}
                    </span>
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    {previewNoteLead.companyName || "Independent"} &bull; {previewNoteLead.status}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setPreviewNoteLead(null)}
                className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
                title="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Lead Notes &amp; Context
                </span>
                <button
                  type="button"
                  onClick={() => {
                    if (previewNoteLead.description) {
                      navigator.clipboard.writeText(previewNoteLead.description);
                      setIsCopiedNote(true);
                      setTimeout(() => setIsCopiedNote(false), 2000);
                    }
                  }}
                  className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-800 transition-colors"
                >
                  {isCopiedNote ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                      <span className="text-emerald-600 font-semibold">Copied!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Copy</span>
                    </>
                  )}
                </button>
              </div>

              <div className="bg-slate-50 rounded-xl p-3.5 border border-slate-200 text-xs text-slate-700 leading-relaxed max-h-72 overflow-y-auto whitespace-pre-wrap">
                {previewNoteLead.description ? (
                  previewNoteLead.description.split("\n").map((line, lIdx) => {
                    const urlMatch = line.match(/(https?:\/\/[^\s]+)/i);
                    if (urlMatch) {
                      const prefix = line.substring(0, urlMatch.index);
                      const url = urlMatch[0];
                      const suffix = line.substring((urlMatch.index || 0) + url.length);
                      return (
                        <div key={lIdx} className="break-all py-0.5">
                          {prefix}
                          <a
                            href={url}
                            target="_blank"
                            rel="noreferrer"
                            className="text-blue-600 hover:underline inline-flex items-center gap-1 font-medium"
                          >
                            {url}
                            <ExternalLink className="w-2.5 h-2.5 inline" />
                          </a>
                          {suffix}
                        </div>
                      );
                    }
                    return (
                      <div key={lIdx} className="py-0.5">
                        {line}
                      </div>
                    );
                  })
                ) : (
                  <p className="text-slate-400 italic">No notes recorded for this lead.</p>
                )}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-5 py-3 border-t border-slate-100 bg-slate-50/50 flex items-center justify-between">
              <Link
                href={`/leads/${previewNoteLead.id}`}
                className="text-xs font-semibold text-blue-600 hover:text-blue-800 hover:underline inline-flex items-center gap-1"
              >
                <span>Open Full Lead Details</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </Link>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setPreviewNoteLead(null)}
                >
                  Close
                </Button>
                <Button
                  type="button"
                  size="sm"
                  onClick={() => {
                    const target = previewNoteLead;
                    setPreviewNoteLead(null);
                    onEdit(target);
                  }}
                >
                  <Edit2 className="w-3.5 h-3.5 mr-1" />
                  Edit Lead
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

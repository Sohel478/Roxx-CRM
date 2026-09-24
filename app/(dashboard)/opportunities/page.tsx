"use client";

import { useEffect, useState, useCallback, useTransition } from "react";
import {
  Kanban,
  Table as TableIcon,
  Plus,
  Search,
  DollarSign,
  TrendingUp,
  CheckCircle2,
} from "lucide-react";
import { getOpportunitiesAction, deleteOpportunityAction } from "@/actions/opportunities";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { KanbanBoard } from "@/features/opportunities/components/kanban-board";
import { OpportunityTable } from "@/features/opportunities/components/opportunity-table";
import { OpportunityModal } from "@/features/opportunities/components/opportunity-modal";
import { CloseDealModal } from "@/features/opportunities/components/close-deal-modal";
import {
  OpportunityItem,
  PIPELINE_STAGES,
} from "@/lib/validations/opportunities";

export default function OpportunitiesPage() {
  const [opportunities, setOpportunities] = useState<OpportunityItem[]>([]);
  const [summary, setSummary] = useState({
    totalCount: 0,
    totalValue: 0,
    wonCount: 0,
    wonValue: 0,
    openCount: 0,
    openValue: 0,
  });
  const [isLoading, setIsLoading] = useState(true);

  const [viewMode, setViewMode] = useState<"KANBAN" | "TABLE">("KANBAN");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"ALL" | "OPEN" | "WON" | "LOST">("ALL");
  const [stageFilter, setStageFilter] = useState<string>("ALL");

  // Modals state
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [opportunityToEdit, setOpportunityToEdit] = useState<OpportunityItem | null>(null);

  const [closeDealTarget, setCloseDealTarget] = useState<OpportunityItem | null>(null);
  const [closeDealInitialStatus, setCloseDealInitialStatus] = useState<"WON" | "LOST">("WON");

  const loadOpportunities = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await getOpportunitiesAction({
        search: search.trim() || undefined,
        status: statusFilter,
        stageName: stageFilter !== "ALL" ? stageFilter : undefined,
      });

      if (res.success && res.data) {
        setOpportunities(res.data.items);
        setSummary(res.data.summary);
      }
    } catch (err) {
      console.error("[OpportunitiesPage] load error:", err);
    } finally {
      setIsLoading(false);
    }
  }, [search, statusFilter, stageFilter]);

  useEffect(() => {
    loadOpportunities();
  }, [loadOpportunities]);

  const [, startTransition] = useTransition();

  const handleOpenCloseDeal = (opp: OpportunityItem, status: "WON" | "LOST") => {
    setCloseDealTarget(opp);
    setCloseDealInitialStatus(status);
  };

  const handleEdit = (opp: OpportunityItem) => {
    setOpportunityToEdit(opp);
    setIsCreateModalOpen(true);
  };

  const handleDelete = (id: string) => {
    startTransition(async () => {
      try {
        await deleteOpportunityAction(id);
        loadOpportunities();
      } catch (err) {
        console.error("[OpportunitiesPage] delete error:", err);
      }
    });
  };

  const avgDealSize =
    summary.totalCount > 0 ? Math.round(summary.totalValue / summary.totalCount) : 0;

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Pipeline &amp; Deals
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Manage opportunities across the sales cycle from Discovery to Won/Lost.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* View Mode Toggle */}
          <div className="inline-flex rounded-xl border border-slate-200 bg-white p-0.5 text-xs font-semibold shadow-2xs">
            <button
              type="button"
              onClick={() => setViewMode("KANBAN")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-colors ${
                viewMode === "KANBAN"
                  ? "bg-blue-600 text-white shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <Kanban className="w-3.5 h-3.5" />
              <span>Kanban</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode("TABLE")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-colors ${
                viewMode === "TABLE"
                  ? "bg-blue-600 text-white shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <TableIcon className="w-3.5 h-3.5" />
              <span>List</span>
            </button>
          </div>

          <Button
            type="button"
            className="bg-blue-600 hover:bg-blue-700 text-white shadow-sm flex items-center gap-1.5"
            onClick={() => {
              setOpportunityToEdit(null);
              setIsCreateModalOpen(true);
            }}
          >
            <Plus className="w-4 h-4" />
            <span>New Opportunity</span>
          </Button>
        </div>
      </div>

      {/* KPI Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Pipeline */}
        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
              Active Pipeline
            </span>
            <div className="mt-1 flex items-baseline gap-1">
              <span className="text-2xl font-extrabold text-slate-900 tracking-tight">
                ${summary.openValue.toLocaleString()}
              </span>
              <span className="text-xs text-slate-400 font-semibold">USD</span>
            </div>
            <p className="text-[11px] text-slate-500 mt-0.5">
              {summary.openCount} deals in progress
            </p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
            <DollarSign className="w-5 h-5" />
          </div>
        </div>

        {/* Won Revenue */}
        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-emerald-600 uppercase tracking-wider block">
              Closed Won Revenue
            </span>
            <div className="mt-1 flex items-baseline gap-1">
              <span className="text-2xl font-extrabold text-emerald-600 tracking-tight">
                ${summary.wonValue.toLocaleString()}
              </span>
              <span className="text-xs text-emerald-600/70 font-semibold">USD</span>
            </div>
            <p className="text-[11px] text-slate-500 mt-0.5">
              {summary.wonCount} won contracts
            </p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
            <CheckCircle2 className="w-5 h-5" />
          </div>
        </div>

        {/* Average Deal Size */}
        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
              Average Deal Size
            </span>
            <div className="mt-1 flex items-baseline gap-1">
              <span className="text-2xl font-extrabold text-slate-900 tracking-tight">
                ${avgDealSize.toLocaleString()}
              </span>
              <span className="text-xs text-slate-400 font-semibold">USD</span>
            </div>
            <p className="text-[11px] text-slate-500 mt-0.5">Across all pipeline stages</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
            <TrendingUp className="w-5 h-5" />
          </div>
        </div>

        {/* Total Deals */}
        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
              Total Opportunities
            </span>
            <div className="mt-1 flex items-baseline gap-1">
              <span className="text-2xl font-extrabold text-slate-900 tracking-tight">
                {summary.totalCount}
              </span>
            </div>
            <p className="text-[11px] text-slate-500 mt-0.5">
              ${summary.totalValue.toLocaleString()} cumulative value
            </p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
            <Kanban className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Search & Filter Bar */}
      <div className="bg-white rounded-2xl border border-slate-200 p-3.5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search deals, company, or contact name..."
            className="pl-9 h-9 text-xs"
          />
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Status filter tabs */}
          <div className="inline-flex rounded-lg border border-slate-200 bg-slate-50 p-0.5 text-xs font-semibold">
            {(["ALL", "OPEN", "WON", "LOST"] as const).map((st) => (
              <button
                key={st}
                type="button"
                onClick={() => setStatusFilter(st)}
                className={`px-2.5 py-1 rounded-md transition-colors ${
                  statusFilter === st
                    ? "bg-white text-slate-900 shadow-2xs font-bold"
                    : "text-slate-500 hover:text-slate-900"
                }`}
              >
                {st === "ALL" ? "All Statuses" : st.charAt(0) + st.slice(1).toLowerCase()}
              </button>
            ))}
          </div>

          {/* Stage Dropdown */}
          <select
            value={stageFilter}
            onChange={(e) => setStageFilter(e.target.value)}
            className="h-8 rounded-lg border border-slate-300 bg-white px-2.5 text-xs font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
          >
            <option value="ALL">All Stages</option>
            {PIPELINE_STAGES.map((s) => (
              <option key={s.id} value={s.name}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Main View: Kanban or Table */}
      {isLoading ? (
        <div className="py-20 text-center text-slate-400">
          <p className="text-sm font-semibold">Loading pipeline deals...</p>
        </div>
      ) : viewMode === "KANBAN" ? (
        <KanbanBoard
          opportunities={opportunities}
          onRefresh={loadOpportunities}
          onEdit={handleEdit}
          onCloseDeal={handleOpenCloseDeal}
          onDelete={handleDelete}
        />
      ) : (
        <OpportunityTable
          opportunities={opportunities}
          onEdit={handleEdit}
          onCloseDeal={handleOpenCloseDeal}
          onDelete={handleDelete}
        />
      )}

      {/* Create / Edit Opportunity Modal */}
      <OpportunityModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onSuccess={loadOpportunities}
        opportunityToEdit={opportunityToEdit}
      />

      {/* Close Deal Modal (Won / Lost) */}
      {closeDealTarget && (
        <CloseDealModal
          isOpen={Boolean(closeDealTarget)}
          onClose={() => setCloseDealTarget(null)}
          onSuccess={loadOpportunities}
          opportunity={closeDealTarget}
          initialStatus={closeDealInitialStatus}
        />
      )}
    </div>
  );
}

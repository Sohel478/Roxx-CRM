"use client";

import { useState, useEffect, useCallback, useTransition } from "react";
import {
  Trash2,
  AlertTriangle,
  UserCheck,
  Building2,
  Users,
  TrendingUp,
  RefreshCw,
  ShieldAlert,
  Flame,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { DataResetModal } from "./data-reset-modal";
import { getDataCountsAction } from "@/actions/data-management";
import type { CrmDataCounts, CrmResetEntity } from "@/lib/validations/data-management";

export function DataManagementTab() {
  const [counts, setCounts] = useState<CrmDataCounts | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, startTransition] = useTransition();

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedEntity, setSelectedEntity] = useState<CrmResetEntity>("leads");

  const loadCounts = useCallback(() => {
    startTransition(async () => {
      setIsLoading(true);
      try {
        const res = await getDataCountsAction();
        if (res.success && res.data) {
          setCounts(res.data);
        }
      } catch (err) {
        console.error("Failed to load CRM data counts:", err);
      } finally {
        setIsLoading(false);
      }
    });
  }, []);

  useEffect(() => {
    loadCounts();
  }, [loadCounts]);

  const handleOpenReset = (entity: CrmResetEntity) => {
    setSelectedEntity(entity);
    setIsModalOpen(true);
  };

  const getEntityCount = (entity: CrmResetEntity): number => {
    if (!counts) return 0;
    switch (entity) {
      case "leads":
        return counts.leadsCount;
      case "companies":
        return counts.companiesCount;
      case "contacts":
        return counts.contactsCount;
      case "all":
        return (
          counts.leadsCount +
          counts.companiesCount +
          counts.contactsCount +
          counts.opportunitiesCount
        );
      default:
        return 0;
    }
  };

  return (
    <div className="space-y-6">
      {/* Tab Overview Banner */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-red-100 text-red-600 rounded-lg">
                <Trash2 className="w-5 h-5" />
              </div>
              <h2 className="text-lg font-bold text-slate-900">
                Data Reset &amp; Management
              </h2>
            </div>
            <p className="text-xs text-slate-500 max-w-2xl">
              Clean up test records, wipe scraped batches, or restore your CRM pipeline to a clean slate.
              All reset operations are permanently logged in the Security Audit Trail and restricted strictly to Organization Administrators.
            </p>
          </div>

          <Button
            type="button"
            variant="outline"
            onClick={loadCounts}
            disabled={isRefreshing || isLoading}
            className="gap-1.5 text-xs h-9 shrink-0"
          >
            <RefreshCw
              className={`w-3.5 h-3.5 ${isRefreshing || isLoading ? "animate-spin" : ""}`}
            />
            <span>Refresh Counts</span>
          </Button>
        </div>

        {/* Live Counters Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6 pt-6 border-t border-slate-100">
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-3.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500">Active Leads</span>
              <UserCheck className="w-4 h-4 text-blue-500" />
            </div>
            <p className="text-2xl font-extrabold text-slate-900 mt-1">
              {isLoading ? "..." : counts?.leadsCount ?? 0}
            </p>
          </div>

          <div className="bg-slate-50 border border-slate-200 rounded-lg p-3.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500">Companies</span>
              <Building2 className="w-4 h-4 text-indigo-500" />
            </div>
            <p className="text-2xl font-extrabold text-slate-900 mt-1">
              {isLoading ? "..." : counts?.companiesCount ?? 0}
            </p>
          </div>

          <div className="bg-slate-50 border border-slate-200 rounded-lg p-3.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500">Contacts</span>
              <Users className="w-4 h-4 text-emerald-500" />
            </div>
            <p className="text-2xl font-extrabold text-slate-900 mt-1">
              {isLoading ? "..." : counts?.contactsCount ?? 0}
            </p>
          </div>

          <div className="bg-slate-50 border border-slate-200 rounded-lg p-3.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500">Opportunities</span>
              <TrendingUp className="w-4 h-4 text-amber-500" />
            </div>
            <p className="text-2xl font-extrabold text-slate-900 mt-1">
              {isLoading ? "..." : counts?.opportunitiesCount ?? 0}
            </p>
          </div>
        </div>
      </div>

      {/* Individual Entity Reset Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Leads Reset */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs flex flex-col justify-between">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <UserCheck className="w-4 h-4 text-blue-600" />
                <h3 className="text-sm font-bold text-slate-900">Leads</h3>
              </div>
              <span className="text-[11px] font-bold text-slate-600 bg-slate-100 px-2 py-0.5 rounded">
                {counts?.leadsCount ?? 0} records
              </span>
            </div>
            <p className="text-xs text-slate-500">
              Permanently delete all inbound, imported, and scraped leads in your organization.
            </p>
          </div>
          <div className="pt-4 mt-4 border-t border-slate-100">
            <Button
              type="button"
              variant="outline"
              onClick={() => handleOpenReset("leads")}
              disabled={(counts?.leadsCount ?? 0) === 0}
              className="w-full text-xs text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700 hover:border-red-300 gap-1.5"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Reset All Leads</span>
            </Button>
          </div>
        </div>

        {/* Companies Reset */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs flex flex-col justify-between">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Building2 className="w-4 h-4 text-indigo-600" />
                <h3 className="text-sm font-bold text-slate-900">Companies</h3>
              </div>
              <span className="text-[11px] font-bold text-slate-600 bg-slate-100 px-2 py-0.5 rounded">
                {counts?.companiesCount ?? 0} records
              </span>
            </div>
            <p className="text-xs text-slate-500">
              Permanently delete all business accounts and deals. Contacts will be unlinked.
            </p>
          </div>
          <div className="pt-4 mt-4 border-t border-slate-100">
            <Button
              type="button"
              variant="outline"
              onClick={() => handleOpenReset("companies")}
              disabled={(counts?.companiesCount ?? 0) === 0}
              className="w-full text-xs text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700 hover:border-red-300 gap-1.5"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Reset All Companies</span>
            </Button>
          </div>
        </div>

        {/* Contacts Reset */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs flex flex-col justify-between">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-emerald-600" />
                <h3 className="text-sm font-bold text-slate-900">Contacts</h3>
              </div>
              <span className="text-[11px] font-bold text-slate-600 bg-slate-100 px-2 py-0.5 rounded">
                {counts?.contactsCount ?? 0} records
              </span>
            </div>
            <p className="text-xs text-slate-500">
              Permanently delete all contact persons, phone numbers, and communication channels.
            </p>
          </div>
          <div className="pt-4 mt-4 border-t border-slate-100">
            <Button
              type="button"
              variant="outline"
              onClick={() => handleOpenReset("contacts")}
              disabled={(counts?.contactsCount ?? 0) === 0}
              className="w-full text-xs text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700 hover:border-red-300 gap-1.5"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Reset All Contacts</span>
            </Button>
          </div>
        </div>
      </div>

      {/* Danger Zone: Master CRM Wipe */}
      <div className="bg-red-50/60 border-2 border-red-200 rounded-xl p-6 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-red-700">
              <ShieldAlert className="w-5 h-5 text-red-600" />
              <h3 className="text-sm font-bold uppercase tracking-wider">
                Danger Zone: Master CRM Data Wipe
              </h3>
            </div>
            <p className="text-xs text-red-800 leading-relaxed max-w-2xl">
              Permanently wipe <strong>all customer data</strong> across your entire organization — including Leads, Contacts, Companies, and Opportunities.
              This restores your workspace to a clean initial state. Your user accounts, custom roles, pipeline configurations, and billing subscription will be preserved.
            </p>
            <div className="flex items-center gap-2 pt-1 text-[11px] font-semibold text-red-600">
              <AlertTriangle className="w-3.5 h-3.5" />
              <span>Requires confirmation phrase &ldquo;RESET&rdquo; before execution.</span>
            </div>
          </div>

          <Button
            type="button"
            onClick={() => handleOpenReset("all")}
            disabled={
              !counts ||
              counts.leadsCount +
                counts.companiesCount +
                counts.contactsCount +
                counts.opportunitiesCount ===
                0
            }
            className="bg-red-600 hover:bg-red-700 text-white font-bold text-xs h-10 px-5 gap-2 shrink-0 cursor-pointer shadow-sm hover:shadow"
          >
            <Flame className="w-4 h-4 text-red-200" />
            <span>Reset All CRM Data</span>
          </Button>
        </div>
      </div>

      {/* Confirmation Modal */}
      <DataResetModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        entity={selectedEntity}
        count={getEntityCount(selectedEntity)}
        onSuccess={loadCounts}
      />
    </div>
  );
}

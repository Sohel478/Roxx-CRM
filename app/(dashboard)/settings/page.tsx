"use client";

import { useState, useEffect, useCallback, useTransition } from "react";
import {
  Users2,
  Shield,
  Building2,
  Kanban,
  RefreshCw,
  CreditCard,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { TeamMembersTab } from "@/features/settings/components/team-members-tab";
import { AuditTrailTab } from "@/features/settings/components/audit-trail-tab";
import { OrganizationProfileTab } from "@/features/settings/components/organization-profile-tab";
import { PipelineStagesTab } from "@/features/settings/components/pipeline-stages-tab";
import { BillingTab } from "@/features/settings/components/billing-tab";
import { getUsersAction, getTenantSeatUsageAction, UserItem, TenantSeatUsage } from "@/actions/users";
import { getAuditLogsAction, AuditLogItem } from "@/actions/audit";
import {
  getOrganizationSettingsAction,
  getPipelineStagesAction,
  OrganizationSettings,
  PipelineStageItem,
} from "@/actions/settings";

type TabType = "team" | "audit" | "organization" | "stages" | "billing";

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<TabType>("team");
  const [users, setUsers] = useState<UserItem[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLogItem[]>([]);
  const [orgSettings, setOrgSettings] = useState<OrganizationSettings | null>(null);
  const [pipelineStages, setPipelineStages] = useState<PipelineStageItem[]>([]);
  const [seatUsage, setSeatUsage] = useState<TenantSeatUsage | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, startTransition] = useTransition();

  const loadData = useCallback(() => {
    startTransition(async () => {
      setIsLoading(true);
      try {
        const [usersRes, auditRes, orgRes, stagesRes, seatRes] = await Promise.all([
          getUsersAction(),
          getAuditLogsAction(),
          getOrganizationSettingsAction(),
          getPipelineStagesAction(),
          getTenantSeatUsageAction(),
        ]);

        if (usersRes.success && usersRes.data) {
          setUsers(usersRes.data);
        }
        if (auditRes.success && auditRes.data) {
          setAuditLogs(auditRes.data);
        }
        if (orgRes.success && orgRes.data) {
          setOrgSettings(orgRes.data);
        }
        if (stagesRes.success && stagesRes.data) {
          setPipelineStages(stagesRes.data);
        }
        if (seatRes.success && seatRes.data) {
          setSeatUsage(seatRes.data);
        }
      } finally {
        setIsLoading(false);
      }
    });
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const tab = params.get("tab") as TabType;
      if (tab && ["team", "audit", "organization", "stages", "billing"].includes(tab)) {
        setActiveTab(tab);
      }
    }
  }, []);

  const handleAuditFilterChange = async (filters: {
    entityType?: string;
    action?: string;
    search?: string;
  }) => {
    const res = await getAuditLogsAction(filters);
    if (res.success && res.data) {
      setAuditLogs(res.data);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            System Settings &amp; Administration
          </h1>
          <p className="text-sm text-slate-500">
            Configure team accounts, security audit trail, currency standards, and pipeline parameters.
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          onClick={loadData}
          disabled={isRefreshing}
          className="gap-1.5 text-xs h-9"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? "animate-spin" : ""}`} />
          <span>Refresh</span>
        </Button>
      </div>

      {/* Settings Navigation Tabs */}
      <div className="flex border-b border-slate-200 bg-white px-4 rounded-t-xl overflow-x-auto">
        <button
          type="button"
          onClick={() => setActiveTab("team")}
          className={`py-3.5 px-4 text-xs font-bold border-b-2 flex items-center gap-2 whitespace-nowrap transition-all ${
            activeTab === "team"
              ? "border-blue-600 text-blue-600"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          <Users2 className="w-4 h-4" />
          <span>Team Members &amp; RBAC</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("audit")}
          className={`py-3.5 px-4 text-xs font-bold border-b-2 flex items-center gap-2 whitespace-nowrap transition-all ${
            activeTab === "audit"
              ? "border-blue-600 text-blue-600"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          <Shield className="w-4 h-4" />
          <span>Security Audit Trail</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("organization")}
          className={`py-3.5 px-4 text-xs font-bold border-b-2 flex items-center gap-2 whitespace-nowrap transition-all ${
            activeTab === "organization"
              ? "border-blue-600 text-blue-600"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          <Building2 className="w-4 h-4" />
          <span>Organization Profile</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("stages")}
          className={`py-3.5 px-4 text-xs font-bold border-b-2 flex items-center gap-2 whitespace-nowrap transition-all ${
            activeTab === "stages"
              ? "border-blue-600 text-blue-600"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          <Kanban className="w-4 h-4" />
          <span>Pipeline &amp; Stages</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("billing")}
          className={`py-3.5 px-4 text-xs font-bold border-b-2 flex items-center gap-2 whitespace-nowrap transition-all ${
            activeTab === "billing"
              ? "border-blue-600 text-blue-600"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          <CreditCard className="w-4 h-4" />
          <span>Plan &amp; Billing</span>
          {seatUsage?.status === "TRIAL" && (
            <span className="ml-1 px-1.5 py-0.2 bg-blue-100 text-blue-700 rounded-full text-[10px] font-extrabold">
              Trial
            </span>
          )}
        </button>
      </div>

      {/* Tab Panels */}
      <div>
        {activeTab === "team" && (
          <TeamMembersTab
            users={users}
            onRefresh={loadData}
            maxSeats={seatUsage?.maxSeats || 20}
          />
        )}

        {activeTab === "audit" && (
          <AuditTrailTab
            logs={auditLogs}
            isLoading={isLoading}
            onFilterChange={handleAuditFilterChange}
          />
        )}

        {activeTab === "organization" && orgSettings && (
          <OrganizationProfileTab
            initialSettings={orgSettings}
            onRefresh={loadData}
          />
        )}

        {activeTab === "stages" && (
          <PipelineStagesTab
            initialStages={pipelineStages}
            onRefresh={loadData}
          />
        )}

        {activeTab === "billing" && (
          <BillingTab seatUsage={seatUsage} onRefresh={loadData} />
        )}
      </div>
    </div>
  );
}

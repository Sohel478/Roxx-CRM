"use client";

import { useState, useEffect, useCallback, useTransition } from "react";
import {
  Users2,
  Shield,
  Building2,
  Kanban,
  RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { TeamMembersTab } from "@/features/settings/components/team-members-tab";
import { AuditTrailTab } from "@/features/settings/components/audit-trail-tab";
import { OrganizationProfileTab } from "@/features/settings/components/organization-profile-tab";
import { PipelineStagesTab } from "@/features/settings/components/pipeline-stages-tab";
import { getUsersAction, UserItem } from "@/actions/users";
import { getAuditLogsAction, AuditLogItem } from "@/actions/audit";
import {
  getOrganizationSettingsAction,
  getPipelineStagesAction,
  OrganizationSettings,
  PipelineStageItem,
} from "@/actions/settings";

type TabType = "team" | "audit" | "organization" | "stages";

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<TabType>("team");
  const [users, setUsers] = useState<UserItem[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLogItem[]>([]);
  const [orgSettings, setOrgSettings] = useState<OrganizationSettings | null>(null);
  const [pipelineStages, setPipelineStages] = useState<PipelineStageItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, startTransition] = useTransition();

  const loadData = useCallback(() => {
    startTransition(async () => {
      setIsLoading(true);
      try {
        const [usersRes, auditRes, orgRes, stagesRes] = await Promise.all([
          getUsersAction(),
          getAuditLogsAction(),
          getOrganizationSettingsAction(),
          getPipelineStagesAction(),
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
      } finally {
        setIsLoading(false);
      }
    });
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

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
      </div>

      {/* Tab Panels */}
      <div>
        {activeTab === "team" && (
          <TeamMembersTab users={users} onRefresh={loadData} />
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
      </div>
    </div>
  );
}

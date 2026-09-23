"use client";

import { useState, useMemo } from "react";
import {
  FileText,
  Search,
  Filter,
  Eye,
  CheckCircle,
  AlertCircle,
  Clock,
  ArrowRight,
  ShieldAlert,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { AuditLogItem } from "@/lib/validations/audit";

interface AuditTrailTabProps {
  logs: AuditLogItem[];
  isLoading: boolean;
  onFilterChange: (filters: { entityType?: string; action?: string; search?: string }) => void;
}

export function AuditTrailTab({
  logs,
  isLoading,
  onFilterChange,
}: AuditTrailTabProps) {
  const [search, setSearch] = useState("");
  const [selectedEntity, setSelectedEntity] = useState("ALL");
  const [selectedAction, setSelectedAction] = useState("ALL");
  const [activeDiffLog, setActiveDiffLog] = useState<AuditLogItem | null>(null);

  const handleSearchChange = (val: string) => {
    setSearch(val);
    onFilterChange({ entityType: selectedEntity, action: selectedAction, search: val });
  };

  const handleEntityChange = (val: string) => {
    setSelectedEntity(val);
    onFilterChange({ entityType: val, action: selectedAction, search });
  };

  const handleActionChange = (val: string) => {
    setSelectedAction(val);
    onFilterChange({ entityType: selectedEntity, action: val, search });
  };

  const getActionBadge = (action: string) => {
    let colorClasses = "bg-slate-100 text-slate-700 border-slate-200";

    if (action.includes("INVITED") || action.includes("CREATED") || action.includes("WON")) {
      colorClasses = "bg-emerald-50 text-emerald-700 border-emerald-200";
    } else if (action.includes("UPDATE") || action.includes("CHANGED") || action.includes("EDIT")) {
      colorClasses = "bg-blue-50 text-blue-700 border-blue-200";
    } else if (action.includes("DELETED") || action.includes("LOST") || action.includes("DEACTIVATE")) {
      colorClasses = "bg-rose-50 text-rose-700 border-rose-200";
    } else if (action.includes("IMPORT") || action.includes("EXPORT")) {
      colorClasses = "bg-purple-50 text-purple-700 border-purple-200";
    } else if (action.includes("LOGIN")) {
      colorClasses = "bg-amber-50 text-amber-700 border-amber-200";
    }

    return (
      <span
        className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold border ${colorClasses}`}
      >
        {action}
      </span>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header & Filters */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-4">
        <div>
          <h2 className="text-base font-semibold text-slate-900">
            Security &amp; Operational Audit Trail
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Immutable log of all user activities, data conversions, permission updates, and administrative modifications.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
            <Input
              type="text"
              value={search}
              onChange={(e) => handleSearchChange(e.target.value)}
              placeholder="Search by user, action, or entity..."
              className="pl-9 text-xs"
            />
          </div>

          <div className="flex gap-2">
            <select
              value={selectedEntity}
              onChange={(e) => handleEntityChange(e.target.value)}
              className="text-xs rounded-lg border border-slate-200 bg-white px-3 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="ALL">All Entities</option>
              <option value="User">User</option>
              <option value="Lead">Lead</option>
              <option value="Opportunity">Opportunity</option>
              <option value="Company">Company</option>
              <option value="Contact">Contact</option>
              <option value="Task">Task</option>
              <option value="Organization">Organization</option>
            </select>

            <select
              value={selectedAction}
              onChange={(e) => handleActionChange(e.target.value)}
              className="text-xs rounded-lg border border-slate-200 bg-white px-3 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="ALL">All Actions</option>
              <option value="USER_LOGIN">USER_LOGIN</option>
              <option value="USER_INVITED">USER_INVITED</option>
              <option value="USER_UPDATED">USER_UPDATED</option>
              <option value="USER_ACTIVATED">USER_ACTIVATED</option>
              <option value="USER_DEACTIVATED">USER_DEACTIVATED</option>
              <option value="SETTINGS_UPDATED">SETTINGS_UPDATED</option>
              <option value="LEAD_CONVERTED">LEAD_CONVERTED</option>
              <option value="OPPORTUNITY_STAGE_CHANGED">OPPORTUNITY_STAGE_CHANGED</option>
              <option value="BULK_IMPORT">BULK_IMPORT</option>
            </select>
          </div>
        </div>
      </div>

      {/* Audit Log Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/75 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                <th className="py-3 px-4">Timestamp</th>
                <th className="py-3 px-4">Actor</th>
                <th className="py-3 px-4">Action</th>
                <th className="py-3 px-4">Target Entity</th>
                <th className="py-3 px-4">IP Address</th>
                <th className="py-3 px-4 text-right">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {logs.map((log) => {
                const dateObj = new Date(log.createdAt);
                const formattedDate = dateObj.toLocaleDateString(undefined, {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                });
                const formattedTime = dateObj.toLocaleTimeString(undefined, {
                  hour: "2-digit",
                  minute: "2-digit",
                  second: "2-digit",
                });

                const hasDiff = log.oldValues !== null || log.newValues !== null;

                return (
                  <tr key={log.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="py-3 px-4 text-slate-600 whitespace-nowrap">
                      <div className="font-medium text-slate-900">{formattedDate}</div>
                      <div className="text-[11px] text-slate-400">{formattedTime}</div>
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-semibold text-slate-900">{log.userName}</div>
                      <div className="text-[11px] text-slate-400 font-mono">
                        {log.userId || "System"}
                      </div>
                    </td>
                    <td className="py-3 px-4">{getActionBadge(log.action)}</td>
                    <td className="py-3 px-4">
                      <div className="font-medium text-slate-900">{log.entityType}</div>
                      <div className="text-[11px] text-slate-400 font-mono">
                        ID: {log.entityId}
                      </div>
                    </td>
                    <td className="py-3 px-4 text-slate-500 font-mono text-[11px]">
                      {log.ipAddress || "—"}
                    </td>
                    <td className="py-3 px-4 text-right">
                      {hasDiff ? (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-7 text-xs px-2.5 gap-1 text-blue-600 border-blue-200 hover:bg-blue-50"
                          onClick={() => setActiveDiffLog(log)}
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>View Diff</span>
                        </Button>
                      ) : (
                        <span className="text-[11px] text-slate-400">None</span>
                      )}
                    </td>
                  </tr>
                );
              })}
              {logs.length === 0 && !isLoading && (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-500">
                    No audit records matching your filter criteria.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* JSON Diff Viewer Modal */}
      <Modal
        isOpen={!!activeDiffLog}
        onClose={() => setActiveDiffLog(null)}
        title={`Audit Record: ${activeDiffLog?.action}`}
        description={`Detailed state comparison for ${activeDiffLog?.entityType} [${activeDiffLog?.entityId}]`}
        maxWidth="xl"
      >
        {activeDiffLog && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 text-xs bg-slate-50 p-3 rounded-lg border border-slate-200">
              <div>
                <span className="text-slate-500 block">Actor:</span>
                <span className="font-semibold text-slate-900">{activeDiffLog.userName}</span>
              </div>
              <div>
                <span className="text-slate-500 block">Logged At:</span>
                <span className="font-semibold text-slate-900">
                  {new Date(activeDiffLog.createdAt).toLocaleString()}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Old Values */}
              <div className="space-y-1.5">
                <div className="text-xs font-bold text-rose-700 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-rose-500" />
                  Prior State (Old Values)
                </div>
                <div className="bg-slate-900 text-slate-200 p-3.5 rounded-lg text-xs font-mono overflow-x-auto max-h-60 border border-slate-800">
                  {activeDiffLog.oldValues ? (
                    <pre>{JSON.stringify(activeDiffLog.oldValues, null, 2)}</pre>
                  ) : (
                    <span className="text-slate-500 italic">None (Created initial record)</span>
                  )}
                </div>
              </div>

              {/* New Values */}
              <div className="space-y-1.5">
                <div className="text-xs font-bold text-emerald-700 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-500" />
                  Resulting State (New Values)
                </div>
                <div className="bg-slate-900 text-slate-200 p-3.5 rounded-lg text-xs font-mono overflow-x-auto max-h-60 border border-slate-800">
                  {activeDiffLog.newValues ? (
                    <pre>{JSON.stringify(activeDiffLog.newValues, null, 2)}</pre>
                  ) : (
                    <span className="text-slate-500 italic">None (Deleted record)</span>
                  )}
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-3 border-t border-slate-100">
              <Button
                type="button"
                variant="outline"
                onClick={() => setActiveDiffLog(null)}
              >
                Close
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

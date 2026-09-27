import Link from "next/link";
import { ShieldAlert, User } from "lucide-react";
import { getSuperAdminAuditLogsAction } from "@/actions/admin";

export const metadata = {
  title: "Platform Audit Logs | Roxx CRM Super Admin",
};

export default async function SuperAdminAuditLogsPage() {
  const res = await getSuperAdminAuditLogsAction();
  const logs = res.data || [];

  return (
    <div className="space-y-6">
      {/* Page Title */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
          <ShieldAlert className="w-6 h-6 text-indigo-600" />
          <span>Platform Audit Trail & Security Ledger</span>
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          Complete, chronological record of administrative actions, user authentication, and data modifications across all tenants.
        </p>
      </div>

      {/* Audit Logs Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-5 border-b border-slate-200">
          <h2 className="text-base font-bold text-slate-900">
            Recorded Events ({logs.length})
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Immutable platform audit entries
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase tracking-wider font-semibold">
              <tr>
                <th className="py-3.5 px-4">Timestamp</th>
                <th className="py-3.5 px-4">Organization</th>
                <th className="py-3.5 px-4">User</th>
                <th className="py-3.5 px-4">Action</th>
                <th className="py-3.5 px-4">Entity</th>
                <th className="py-3.5 px-4">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {logs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-500">
                    No audit logs found.
                  </td>
                </tr>
              ) : (
                logs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50/70">
                    <td className="py-3.5 px-4 font-mono text-[11px] text-slate-500 whitespace-nowrap">
                      {new Date(log.createdAt).toLocaleString()}
                    </td>
                    <td className="py-3.5 px-4 font-semibold text-slate-900">
                      {log.organizationId ? (
                        <Link
                          href={`/super-admin/organizations/${log.organizationId}`}
                          className="hover:text-indigo-600 hover:underline"
                        >
                          {log.organizationName}
                        </Link>
                      ) : (
                        <span className="text-slate-500">System</span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-slate-700">
                      <div className="flex items-center gap-1.5">
                        <User className="w-3 h-3 text-slate-400" />
                        <span>{log.userName || "System"}</span>
                      </div>
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-slate-100 text-slate-800 border border-slate-200">
                        {log.action}
                      </span>
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="text-slate-700 font-medium">{log.entityType}</div>
                      {log.entityId && (
                        <div className="text-[10px] font-mono text-slate-400 truncate max-w-[120px]">
                          {log.entityId}
                        </div>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-slate-600 max-w-xs truncate">
                      {log.details ? (
                        <code className="bg-slate-50 px-1.5 py-0.5 rounded text-[11px] font-mono text-slate-700">
                          {log.details}
                        </code>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

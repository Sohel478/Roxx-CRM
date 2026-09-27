import Link from "next/link";
import { BarChart3, ChevronRight } from "lucide-react";
import { getSuperAdminUsageAction } from "@/actions/admin";

export const metadata = {
  title: "Resource Usage & Analytics | Roxx CRM Super Admin",
};

export default async function SuperAdminUsagePage() {
  const res = await getSuperAdminUsageAction();
  const items = res.data?.items || [];
  const summary = res.data?.summary;

  return (
    <div className="space-y-6">
      {/* Page Title */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
          <BarChart3 className="w-6 h-6 text-indigo-600" />
          <span>Tenant Resource Usage & Storage Footprint</span>
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          Real-time resource utilization, database records, and quota consumption across all organizations.
        </p>
      </div>

      {/* Aggregate KPIs */}
      {summary && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Active Tenants Analyzed
            </span>
            <div className="text-3xl font-extrabold text-slate-900 mt-2">
              {summary.totalOrganizations}
            </div>
            <p className="text-xs text-slate-500 mt-1">Customer workspaces</p>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Total Users Count
            </span>
            <div className="text-3xl font-extrabold text-slate-900 mt-2">
              {summary.totalUsers}
            </div>
            <p className="text-xs text-slate-500 mt-1">Allocated seats active</p>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Total CRM Records
            </span>
            <div className="text-3xl font-extrabold text-slate-900 mt-2">
              {(summary.totalLeads + summary.totalOpportunities).toLocaleString()}
            </div>
            <p className="text-xs text-slate-500 mt-1">
              {summary.totalLeads} leads + {summary.totalOpportunities} opportunities
            </p>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Estimated Storage
            </span>
            <div className="text-3xl font-extrabold text-slate-900 mt-2">
              {summary.totalStorageEstimateMb} MB
            </div>
            <p className="text-xs text-slate-500 mt-1">Data & relational storage</p>
          </div>
        </div>
      )}

      {/* Per Organization Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-5 border-b border-slate-200">
          <h2 className="text-base font-bold text-slate-900">
            Tenant Quota Consumption
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Breakdown of capacity limits and current usage per organization
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase tracking-wider font-semibold">
              <tr>
                <th className="py-3.5 px-4">Organization</th>
                <th className="py-3.5 px-4">Plan</th>
                <th className="py-3.5 px-4">Users Quota</th>
                <th className="py-3.5 px-4">Leads Quota</th>
                <th className="py-3.5 px-4">Deals Quota</th>
                <th className="py-3.5 px-4">Companies & Contacts</th>
                <th className="py-3.5 px-4">Storage (Est.)</th>
                <th className="py-3.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {items.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-500">
                    No usage records found.
                  </td>
                </tr>
              ) : (
                items.map((item) => {
                  const userPct = item.usersLimit >= 99999 ? 0 : Math.round((item.usersCount / item.usersLimit) * 100);
                  const leadPct = item.leadsLimit >= 999999 ? 0 : Math.round((item.leadsCount / item.leadsLimit) * 100);
                  const dealPct = item.opportunitiesLimit >= 999999 ? 0 : Math.round((item.opportunitiesCount / item.opportunitiesLimit) * 100);

                  return (
                    <tr key={item.organizationId} className="hover:bg-slate-50/70">
                      <td className="py-3.5 px-4 font-semibold text-slate-900">
                        <Link
                          href={`/super-admin/organizations/${item.organizationId}`}
                          className="hover:text-indigo-600 hover:underline"
                        >
                          {item.organizationName}
                        </Link>
                      </td>
                      <td className="py-3.5 px-4 capitalize font-medium text-slate-700">
                        {item.planName.toLowerCase().replace("_", " ")}
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="flex items-center justify-between text-[11px] mb-1">
                          <span>
                            <strong>{item.usersCount}</strong> / {item.usersLimit >= 99999 ? "∞" : item.usersLimit}
                          </span>
                          <span className="text-slate-400">{userPct}%</span>
                        </div>
                        <div className="w-24 bg-slate-200 rounded-full h-1.5 overflow-hidden">
                          <div
                            className="bg-indigo-600 h-1.5 rounded-full"
                            style={{ width: `${Math.max(5, userPct)}%` }}
                          />
                        </div>
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="flex items-center justify-between text-[11px] mb-1">
                          <span>
                            <strong>{item.leadsCount}</strong> / {item.leadsLimit >= 999999 ? "∞" : item.leadsLimit.toLocaleString()}
                          </span>
                          <span className="text-slate-400">{leadPct}%</span>
                        </div>
                        <div className="w-24 bg-slate-200 rounded-full h-1.5 overflow-hidden">
                          <div
                            className="bg-indigo-600 h-1.5 rounded-full"
                            style={{ width: `${Math.max(5, leadPct)}%` }}
                          />
                        </div>
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="flex items-center justify-between text-[11px] mb-1">
                          <span>
                            <strong>{item.opportunitiesCount}</strong> / {item.opportunitiesLimit >= 999999 ? "∞" : item.opportunitiesLimit.toLocaleString()}
                          </span>
                          <span className="text-slate-400">{dealPct}%</span>
                        </div>
                        <div className="w-24 bg-slate-200 rounded-full h-1.5 overflow-hidden">
                          <div
                            className="bg-indigo-600 h-1.5 rounded-full"
                            style={{ width: `${Math.max(5, dealPct)}%` }}
                          />
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-slate-600 font-medium">
                        {item.companiesCount} companies • {item.contactsCount} contacts
                      </td>
                      <td className="py-3.5 px-4 font-mono text-[11px] text-slate-600">
                        {item.storageEstimateMb} MB
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <Link
                          href={`/super-admin/organizations/${item.organizationId}`}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold transition-colors"
                        >
                          <span>Dossier</span>
                          <ChevronRight className="w-3.5 h-3.5 text-slate-500" />
                        </Link>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

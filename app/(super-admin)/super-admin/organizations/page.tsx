import { getTenantsAction } from "@/actions/admin";
import { OrganizationsTable } from "@/components/admin/organizations-table";
import { Building2 } from "lucide-react";

export const metadata = {
  title: "Tenant Organizations | Roxx CRM Super Admin",
};

export default async function SuperAdminOrganizationsPage() {
  const res = await getTenantsAction();
  const tenants = res.data?.tenants || [];
  const stats = res.data?.stats;

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
            <Building2 className="w-6 h-6 text-indigo-600" />
            <span>Tenant Organizations</span>
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            View, search, suspend, reactivate, and manage subscription quotas across all customer accounts.
          </p>
        </div>

        {stats && (
          <div className="flex items-center gap-4 bg-white px-4 py-2 rounded-xl border border-slate-200 text-xs shadow-sm">
            <div>
              <span className="text-slate-400">Total:</span>{" "}
              <strong className="text-slate-900">{stats.totalOrganizations}</strong>
            </div>
            <span className="text-slate-200">|</span>
            <div>
              <span className="text-slate-400">Active:</span>{" "}
              <strong className="text-emerald-600">{stats.activeSubscriptions}</strong>
            </div>
            <span className="text-slate-200">|</span>
            <div>
              <span className="text-slate-400">Trial:</span>{" "}
              <strong className="text-amber-600">{stats.trialOrganizations}</strong>
            </div>
          </div>
        )}
      </div>

      <OrganizationsTable initialTenants={tenants} />
    </div>
  );
}

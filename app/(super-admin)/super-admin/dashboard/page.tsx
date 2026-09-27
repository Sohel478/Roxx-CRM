import Link from "next/link";
import {
  DollarSign,
  Building2,
  Users,
  TrendingUp,
  Layers,
  ChevronRight,
  ShieldCheck,
  Clock,
  AlertTriangle,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import { getSuperAdminDashboardMetricsAction } from "@/actions/admin";

export const metadata = {
  title: "Super Admin Dashboard | Roxx CRM SaaS",
};

export default async function SuperAdminDashboardPage() {
  const res = await getSuperAdminDashboardMetricsAction();
  const metrics = res.data;

  if (!res.success || !metrics) {
    return (
      <div className="p-8 bg-rose-50 border border-rose-200 rounded-xl text-rose-800">
        <h2 className="text-lg font-bold">Failed to load metrics</h2>
        <p className="text-sm mt-1">{res.error || "An unexpected error occurred."}</p>
      </div>
    );
  }

  const {
    totalOrganizations,
    activeOrganizations,
    trialOrganizations,
    expiredOrganizations,
    suspendedOrganizations,
    totalUsers,
    totalLeads,
    totalOpportunities,
    mrr,
    planDistribution,
    recentTenants,
  } = metrics;

  return (
    <div className="space-y-8">
      {/* Page Title & Intro */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Platform Command Center
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Global SaaS metrics, active tenants, recurring revenue, and subscription health.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/super-admin/organizations"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold shadow-sm transition-all"
          >
            <Building2 className="w-4 h-4" />
            <span>Manage Tenants</span>
          </Link>
          <Link
            href="/super-admin/plans"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 text-sm font-semibold shadow-sm transition-all"
          >
            <Layers className="w-4 h-4 text-slate-500" />
            <span>Configure Plans</span>
          </Link>
        </div>
      </div>

      {/* Top 4 KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {/* Card 1: MRR */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Monthly Recurring Revenue
            </span>
            <div className="p-2 rounded-lg bg-emerald-50 text-emerald-600 border border-emerald-100">
              <DollarSign className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold tracking-tight text-slate-900">
              ₹{mrr.toLocaleString()}
            </span>
            <span className="text-xs text-emerald-600 font-semibold">INR / mo</span>
          </div>
          <p className="text-xs text-slate-500 mt-2">
            Derived from {activeOrganizations} active paid tenants
          </p>
        </div>

        {/* Card 2: Total Organizations */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Total Organizations
            </span>
            <div className="p-2 rounded-lg bg-indigo-50 text-indigo-600 border border-indigo-100">
              <Building2 className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold tracking-tight text-slate-900">
              {totalOrganizations}
            </span>
            <span className="text-xs text-slate-500">Tenants</span>
          </div>
          <div className="flex items-center gap-2 mt-2 text-xs">
            <span className="inline-flex items-center gap-1 text-emerald-600 font-medium">
              <CheckCircle2 className="w-3 h-3" /> {activeOrganizations} active
            </span>
            <span className="text-slate-300">•</span>
            <span className="inline-flex items-center gap-1 text-amber-600 font-medium">
              <Clock className="w-3 h-3" /> {trialOrganizations} trial
            </span>
          </div>
        </div>

        {/* Card 3: Platform Users */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Platform Users
            </span>
            <div className="p-2 rounded-lg bg-blue-50 text-blue-600 border border-blue-100">
              <Users className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold tracking-tight text-slate-900">
              {totalUsers}
            </span>
            <span className="text-xs text-slate-500">Total Accounts</span>
          </div>
          <p className="text-xs text-slate-500 mt-2">
            Across all tenant workspaces
          </p>
        </div>

        {/* Card 4: CRM Volume (Leads & Deals) */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              CRM Pipeline Volume
            </span>
            <div className="p-2 rounded-lg bg-purple-50 text-purple-600 border border-purple-100">
              <TrendingUp className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold tracking-tight text-slate-900">
              {totalLeads}
            </span>
            <span className="text-xs text-slate-500">Leads</span>
          </div>
          <p className="text-xs text-slate-500 mt-2">
            {totalOpportunities} active opportunities in pipeline
          </p>
        </div>
      </div>

      {/* Grid: Plan Distribution & Tenant Health Status */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Plan Distribution */}
        <div className="lg:col-span-1 bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <Layers className="w-4 h-4 text-indigo-600" />
            <span>Plan Distribution</span>
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Breakdown of tenants across pricing tiers
          </p>

          <div className="mt-5 space-y-4">
            {planDistribution.map((item) => {
              const pct = totalOrganizations > 0 ? Math.round((item.count / totalOrganizations) * 100) : 0;
              return (
                <div key={item.plan}>
                  <div className="flex justify-between text-xs font-semibold text-slate-700 mb-1">
                    <span className="capitalize">{item.plan.toLowerCase()}</span>
                    <span>
                      {item.count} ({pct}%)
                    </span>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                    <div
                      className="bg-indigo-600 h-2 rounded-full transition-all duration-500"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-6 pt-5 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
            <span>Average seats/org:</span>
            <span className="font-semibold text-slate-800">
              {totalOrganizations > 0 ? Math.round(totalUsers / totalOrganizations) : 0} users
            </span>
          </div>
        </div>

        {/* Tenant Subscription Health Breakdown */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 p-6 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                <span>Tenant Subscription Status</span>
              </h2>
              <Link
                href="/super-admin/organizations"
                className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 flex items-center gap-1"
              >
                <span>View all tenants</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </Link>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Active lifecycle states of all organizations
            </p>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-5">
              <div className="p-4 rounded-xl bg-emerald-50/60 border border-emerald-100">
                <div className="text-xs font-medium text-emerald-700 flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Active</span>
                </div>
                <div className="text-2xl font-extrabold text-emerald-900 mt-2">
                  {activeOrganizations}
                </div>
                <div className="text-[11px] text-emerald-700/80 mt-1">Paid subscribers</div>
              </div>

              <div className="p-4 rounded-xl bg-amber-50/60 border border-amber-100">
                <div className="text-xs font-medium text-amber-700 flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-amber-600" />
                  <span>Free Trial</span>
                </div>
                <div className="text-2xl font-extrabold text-amber-900 mt-2">
                  {trialOrganizations}
                </div>
                <div className="text-[11px] text-amber-700/80 mt-1">30-day evaluations</div>
              </div>

              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
                <div className="text-xs font-medium text-slate-600 flex items-center gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5 text-slate-500" />
                  <span>Expired</span>
                </div>
                <div className="text-2xl font-extrabold text-slate-800 mt-2">
                  {expiredOrganizations}
                </div>
                <div className="text-[11px] text-slate-500 mt-1">Needs renewal</div>
              </div>

              <div className="p-4 rounded-xl bg-rose-50/60 border border-rose-100">
                <div className="text-xs font-medium text-rose-700 flex items-center gap-1.5">
                  <XCircle className="w-3.5 h-3.5 text-rose-600" />
                  <span>Suspended</span>
                </div>
                <div className="text-2xl font-extrabold text-rose-900 mt-2">
                  {suspendedOrganizations}
                </div>
                <div className="text-[11px] text-rose-700/80 mt-1">Locked by admin</div>
              </div>
            </div>
          </div>

          <div className="mt-6 pt-4 border-t border-slate-100 bg-slate-50/50 -mx-6 -mb-6 p-4 rounded-b-xl flex flex-wrap items-center justify-between gap-3 text-xs text-slate-600">
            <span>Looking for recent payments or subscriptions?</span>
            <div className="flex gap-2">
              <Link
                href="/super-admin/subscriptions"
                className="text-xs font-semibold text-indigo-600 hover:underline"
              >
                Subscriptions &rarr;
              </Link>
              <span className="text-slate-300">|</span>
              <Link
                href="/super-admin/payments"
                className="text-xs font-semibold text-indigo-600 hover:underline"
              >
                Payments Ledger &rarr;
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Organizations Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-200 flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-slate-900">Recent Tenant Registrations</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Organizations onboarded onto the Roxx CRM SaaS platform
            </p>
          </div>
          <Link
            href="/super-admin/organizations"
            className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 flex items-center gap-1"
          >
            <span>View All ({totalOrganizations})</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase tracking-wider font-semibold">
              <tr>
                <th className="py-3 px-4">Organization</th>
                <th className="py-3 px-4">Plan</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Users</th>
                <th className="py-3 px-4">Leads</th>
                <th className="py-3 px-4">Deals</th>
                <th className="py-3 px-4">Created</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {recentTenants.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-slate-500">
                    No organizations registered yet.
                  </td>
                </tr>
              ) : (
                recentTenants.map((org) => {
                  const statusColors: Record<string, string> = {
                    ACTIVE: "bg-emerald-50 text-emerald-700 border-emerald-200",
                    TRIAL: "bg-amber-50 text-amber-700 border-amber-200",
                    EXPIRED: "bg-slate-100 text-slate-700 border-slate-200",
                    SUSPENDED: "bg-rose-50 text-rose-700 border-rose-200",
                  };

                  return (
                    <tr key={org.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 px-4 font-semibold text-slate-900">
                        <div className="flex items-center gap-2">
                          <Link
                            href={`/super-admin/organizations/${org.id}`}
                            className="hover:text-indigo-600 hover:underline"
                          >
                            {org.name}
                          </Link>
                          {org.isDemo && (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-purple-100 text-purple-700">
                              DEMO
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-slate-400 font-normal">
                          slug: {org.slug}
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <span className="font-medium text-slate-700 capitalize">
                          {org.subscriptionPlan.toLowerCase().replace("_", " ")}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold border ${
                            statusColors[org.subscriptionStatus] || "bg-slate-100 text-slate-700"
                          }`}
                        >
                          {org.subscriptionStatus}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-slate-600">{org.usersCount}</td>
                      <td className="py-3 px-4 text-slate-600">{org.leadsCount}</td>
                      <td className="py-3 px-4 text-slate-600">{org.dealsCount}</td>
                      <td className="py-3 px-4 text-slate-500">
                        {new Date(org.createdAt).toLocaleDateString()}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <Link
                          href={`/super-admin/organizations/${org.id}`}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium transition-colors"
                        >
                          <span>Dossier</span>
                          <ChevronRight className="w-3 h-3 text-slate-500" />
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

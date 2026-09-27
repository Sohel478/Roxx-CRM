import Link from "next/link";
import { CreditCard, Activity, ChevronRight } from "lucide-react";
import { getSuperAdminSubscriptionsAction } from "@/actions/admin";

export const metadata = {
  title: "Subscriptions & Events | Roxx CRM Super Admin",
};

export default async function SuperAdminSubscriptionsPage() {
  const res = await getSuperAdminSubscriptionsAction();
  const subscriptions = res.data?.subscriptions || [];
  const events = res.data?.events || [];

  const statusColors: Record<string, string> = {
    ACTIVE: "bg-emerald-50 text-emerald-700 border-emerald-200",
    TRIAL: "bg-amber-50 text-amber-700 border-amber-200",
    EXPIRED: "bg-slate-100 text-slate-700 border-slate-200",
    SUSPENDED: "bg-rose-50 text-rose-700 border-rose-200",
  };

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
          <CreditCard className="w-6 h-6 text-indigo-600" />
          <span>Tenant Subscriptions & Lifecycle</span>
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          Active subscriptions ledger and real-time subscription lifecycle transition events.
        </p>
      </div>

      {/* Subscriptions Ledger Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-5 border-b border-slate-200">
          <h2 className="text-base font-bold text-slate-900">
            Active Subscriptions ({subscriptions.length})
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Overview of customer subscription status and billing periods
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase tracking-wider font-semibold">
              <tr>
                <th className="py-3.5 px-4">Organization</th>
                <th className="py-3.5 px-4">Plan</th>
                <th className="py-3.5 px-4">Status</th>
                <th className="py-3.5 px-4">Billing Interval</th>
                <th className="py-3.5 px-4">Start Date</th>
                <th className="py-3.5 px-4">Trial / Renewal</th>
                <th className="py-3.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {subscriptions.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-500">
                    No subscriptions found.
                  </td>
                </tr>
              ) : (
                subscriptions.map((sub) => (
                  <tr key={sub.id} className="hover:bg-slate-50/70">
                    <td className="py-3.5 px-4 font-semibold text-slate-900">
                      <Link
                        href={`/super-admin/organizations/${sub.organizationId}`}
                        className="hover:text-indigo-600 hover:underline"
                      >
                        {sub.organizationName}
                      </Link>
                    </td>
                    <td className="py-3.5 px-4 font-medium text-slate-800 capitalize">
                      {sub.planName}
                    </td>
                    <td className="py-3.5 px-4">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold border ${
                          statusColors[sub.status] || "bg-slate-100 text-slate-700"
                        }`}
                      >
                        {sub.status}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-slate-600 font-medium">
                      {sub.billingInterval}
                    </td>
                    <td className="py-3.5 px-4 text-slate-500">
                      {new Date(sub.startDate).toLocaleDateString()}
                    </td>
                    <td className="py-3.5 px-4 text-slate-600">
                      {sub.status === "TRIAL" && sub.trialEndDate ? (
                        <span className="text-amber-700 font-medium">
                          Trial ends {new Date(sub.trialEndDate).toLocaleDateString()}
                        </span>
                      ) : sub.renewalDate ? (
                        <span>Renews {new Date(sub.renewalDate).toLocaleDateString()}</span>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <Link
                        href={`/super-admin/organizations/${sub.organizationId}`}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold transition-colors"
                      >
                        <span>Dossier</span>
                        <ChevronRight className="w-3.5 h-3.5 text-slate-500" />
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Subscription Lifecycle Events Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-5 border-b border-slate-200">
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <Activity className="w-4 h-4 text-indigo-600" />
            <span>Platform Subscription Events Log</span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Audit trail of upgrades, renewals, suspensions, and trial operations
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase tracking-wider font-semibold">
              <tr>
                <th className="py-3 px-4">Event Type</th>
                <th className="py-3 px-4">Organization</th>
                <th className="py-3 px-4">Notes</th>
                <th className="py-3 px-4">Timestamp</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {events.length === 0 ? (
                <tr>
                  <td colSpan={4} className="py-8 text-center text-slate-500">
                    No subscription events recorded.
                  </td>
                </tr>
              ) : (
                events.map((evt) => (
                  <tr key={evt.id} className="hover:bg-slate-50/70">
                    <td className="py-3 px-4">
                      <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-slate-100 text-slate-800 border border-slate-200">
                        {evt.eventType}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-semibold text-slate-900">
                      <Link
                        href={`/super-admin/organizations/${evt.organizationId}`}
                        className="hover:text-indigo-600 hover:underline"
                      >
                        {evt.organizationName}
                      </Link>
                    </td>
                    <td className="py-3 px-4 text-slate-600">{evt.notes || "—"}</td>
                    <td className="py-3 px-4 text-slate-400 font-mono text-[11px]">
                      {new Date(evt.createdAt).toLocaleString()}
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

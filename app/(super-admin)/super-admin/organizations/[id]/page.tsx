import Link from "next/link";
import {
  Users,
  CreditCard,
  ChevronLeft,
  Mail,
  Phone,
  Globe,
  Calendar,
  Layers,
  Activity,
  ShieldAlert,
} from "lucide-react";
import { getTenantDetailAction } from "@/actions/admin";
import { TenantDetailActions } from "@/components/admin/tenant-detail-actions";

interface TenantDossierPageProps {
  params: Promise<{ id: string }>;
}

export const metadata = {
  title: "Tenant Dossier | Roxx CRM Super Admin",
};

export default async function TenantDossierPage({ params }: TenantDossierPageProps) {
  const { id } = await params;
  const res = await getTenantDetailAction(id);

  if (!res.success || !res.data) {
    return (
      <div className="p-8 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 space-y-4">
        <h2 className="text-lg font-bold">Organization Not Found</h2>
        <p className="text-sm">The requested organization ({id}) could not be located.</p>
        <Link
          href="/super-admin/organizations"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-100 hover:bg-rose-200 text-rose-900 text-xs font-semibold"
        >
          <ChevronLeft className="w-4 h-4" />
          <span>Back to Organizations</span>
        </Link>
      </div>
    );
  }

  const { organization, users, usage, events, auditLogs } = res.data;

  const statusColors: Record<string, string> = {
    ACTIVE: "bg-emerald-50 text-emerald-700 border-emerald-200",
    TRIAL: "bg-amber-50 text-amber-700 border-amber-200",
    EXPIRED: "bg-slate-100 text-slate-700 border-slate-200",
    SUSPENDED: "bg-rose-50 text-rose-700 border-rose-200",
  };

  const usageCards = [
    { label: "User Seats", current: usage.users.current, limit: usage.users.limit },
    { label: "Leads", current: usage.leads.current, limit: usage.leads.limit },
    { label: "Companies", current: usage.companies.current, limit: usage.companies.limit },
    { label: "Contacts", current: usage.contacts.current, limit: usage.contacts.limit },
    { label: "Deals / Pipeline", current: usage.opportunities.current, limit: usage.opportunities.limit },
  ];

  return (
    <div className="space-y-8">
      {/* Breadcrumb & Top bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <Link
            href="/super-admin/organizations"
            className="inline-flex items-center gap-1 text-xs font-semibold text-slate-500 hover:text-slate-900 transition-colors mb-2"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
            <span>Back to All Organizations</span>
          </Link>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              {organization.name}
            </h1>
            {organization.isDemo && (
              <span className="px-2 py-0.5 rounded text-xs font-bold bg-purple-100 text-purple-700 border border-purple-200">
                SANDBOX DEMO
              </span>
            )}
            <span
              className={`inline-flex items-center px-2.5 py-0.5 rounded text-xs font-bold border ${
                statusColors[organization.subscriptionStatus] || "bg-slate-100 text-slate-700"
              }`}
            >
              {organization.subscriptionStatus}
            </span>
          </div>
          <div className="text-xs text-slate-500 font-mono mt-1">ID: {organization.id}</div>
        </div>

        {/* Action buttons (Suspend, Extend Trial, Change Plan) */}
        <TenantDetailActions organization={organization} />
      </div>

      {/* Grid: Overview & Plan Info */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Organization Profile Card */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm space-y-4">
          <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider text-slate-500">
            Tenant Profile
          </h2>
          <div className="space-y-2.5 text-xs">
            <div className="flex items-center justify-between py-1 border-b border-slate-100">
              <span className="text-slate-500">Slug</span>
              <span className="font-mono font-medium text-slate-800">{organization.slug}</span>
            </div>
            <div className="flex items-center justify-between py-1 border-b border-slate-100">
              <span className="text-slate-500 flex items-center gap-1.5">
                <Mail className="w-3.5 h-3.5 text-slate-400" /> Billing Email
              </span>
              <span className="font-medium text-slate-800">
                {organization.billingEmail || "—"}
              </span>
            </div>
            <div className="flex items-center justify-between py-1 border-b border-slate-100">
              <span className="text-slate-500 flex items-center gap-1.5">
                <Phone className="w-3.5 h-3.5 text-slate-400" /> Phone
              </span>
              <span className="font-medium text-slate-800">
                {organization.billingPhone || "—"}
              </span>
            </div>
            <div className="flex items-center justify-between py-1 border-b border-slate-100">
              <span className="text-slate-500 flex items-center gap-1.5">
                <Globe className="w-3.5 h-3.5 text-slate-400" /> Website
              </span>
              <span className="font-medium text-slate-800">
                {organization.website ? (
                  <a
                    href={organization.website}
                    target="_blank"
                    rel="noreferrer"
                    className="text-indigo-600 hover:underline"
                  >
                    {organization.website}
                  </a>
                ) : (
                  "—"
                )}
              </span>
            </div>
            <div className="flex items-center justify-between py-1">
              <span className="text-slate-500 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-slate-400" /> Registered On
              </span>
              <span className="font-medium text-slate-800">
                {new Date(organization.createdAt).toLocaleDateString()}
              </span>
            </div>
          </div>
        </div>

        {/* Subscription Plan & Renewal Details */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm space-y-4">
          <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider text-slate-500 flex items-center gap-2">
            <CreditCard className="w-4 h-4 text-indigo-600" />
            <span>Subscription Status</span>
          </h2>
          <div className="space-y-2.5 text-xs">
            <div className="flex items-center justify-between py-1 border-b border-slate-100">
              <span className="text-slate-500">Tier Plan</span>
              <span className="font-bold text-slate-900 capitalize">
                {organization.subscriptionPlan.toLowerCase().replace("_", " ")}
              </span>
            </div>
            <div className="flex items-center justify-between py-1 border-b border-slate-100">
              <span className="text-slate-500">Allocated Seats</span>
              <span className="font-bold text-slate-900">{organization.maxSeats} user seats</span>
            </div>
            <div className="flex items-center justify-between py-1 border-b border-slate-100">
              <span className="text-slate-500">Trial Expiration</span>
              <span className="font-medium text-amber-700">
                {organization.trialEndsAt
                  ? new Date(organization.trialEndsAt).toLocaleDateString()
                  : "N/A"}
              </span>
            </div>
            <div className="flex items-center justify-between py-1 border-b border-slate-100">
              <span className="text-slate-500">Subscription Renewal</span>
              <span className="font-medium text-slate-800">
                {organization.subscriptionEndsAt
                  ? new Date(organization.subscriptionEndsAt).toLocaleDateString()
                  : "N/A (Standard Trial)"}
              </span>
            </div>
            <div className="py-1">
              <span className="text-slate-500 block mb-1">Super Admin Notes</span>
              <p className="text-slate-700 italic bg-slate-50 p-2 rounded border border-slate-100">
                {organization.subscriptionNotes || "No custom administrator notes entered."}
              </p>
            </div>
          </div>
        </div>

        {/* Rapid Stats summary */}
        <div className="bg-gradient-to-br from-indigo-900 to-slate-900 text-white rounded-xl p-6 shadow-sm flex flex-col justify-between">
          <div>
            <div className="text-indigo-300 text-xs font-semibold uppercase tracking-wider">
              Tenant Summary
            </div>
            <div className="text-2xl font-bold mt-1">{organization.name}</div>
            <p className="text-xs text-indigo-200/70 mt-2">
              Isolated workspace containing complete multi-tenant boundaries and RBAC memberships.
            </p>
          </div>

          <div className="grid grid-cols-3 gap-2 pt-6 border-t border-indigo-800/60 mt-6 text-center">
            <div>
              <div className="text-xl font-extrabold text-white">{organization.usersCount}</div>
              <div className="text-[10px] text-indigo-200/80 uppercase tracking-wider">Users</div>
            </div>
            <div>
              <div className="text-xl font-extrabold text-white">{organization.leadsCount}</div>
              <div className="text-[10px] text-indigo-200/80 uppercase tracking-wider">Leads</div>
            </div>
            <div>
              <div className="text-xl font-extrabold text-white">{organization.dealsCount}</div>
              <div className="text-[10px] text-indigo-200/80 uppercase tracking-wider">Deals</div>
            </div>
          </div>
        </div>
      </div>

      {/* Resource Quotas & Limits Progress Bars */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
        <h2 className="text-base font-bold text-slate-900 flex items-center gap-2 mb-1">
          <Layers className="w-5 h-5 text-indigo-600" />
          <span>Real-Time Resource Limits & Consumption</span>
        </h2>
        <p className="text-xs text-slate-500 mb-6">
          Enforced server-side by the Roxx CRM Subscription Engine (`SubscriptionService`).
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-5">
          {usageCards.map((item) => {
            const isUnlimited = item.limit >= 999999;
            const pct = isUnlimited
              ? 0
              : Math.min(100, Math.round((item.current / item.limit) * 100));

            return (
              <div key={item.label} className="p-4 rounded-xl bg-slate-50 border border-slate-200">
                <div className="flex justify-between items-center text-xs font-semibold text-slate-700 mb-1">
                  <span>{item.label}</span>
                  <span className={pct > 90 ? "text-rose-600 font-bold" : "text-slate-500"}>
                    {pct}%
                  </span>
                </div>
                <div className="text-lg font-extrabold text-slate-900">
                  {item.current.toLocaleString()}{" "}
                  <span className="text-xs font-medium text-slate-400">
                    / {isUnlimited ? "∞" : item.limit.toLocaleString()}
                  </span>
                </div>
                <div className="w-full bg-slate-200 rounded-full h-2 mt-3 overflow-hidden">
                  <div
                    className={`h-2 rounded-full transition-all duration-500 ${
                      pct > 90 ? "bg-rose-500" : pct > 75 ? "bg-amber-500" : "bg-indigo-600"
                    }`}
                    style={{ width: `${Math.max(5, pct)}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Users in Organization Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-5 border-b border-slate-200">
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <Users className="w-4 h-4 text-indigo-600" />
            <span>Organization Members ({users.length})</span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Registered accounts associated with this tenant workspace
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase tracking-wider font-semibold">
              <tr>
                <th className="py-3 px-4">Name</th>
                <th className="py-3 px-4">Email</th>
                <th className="py-3 px-4">Role</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Joined</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {users.map((u) => (
                <tr key={u.id} className="hover:bg-slate-50/70">
                  <td className="py-3 px-4 font-semibold text-slate-900">{u.name}</td>
                  <td className="py-3 px-4 text-slate-600 font-mono text-[11px]">{u.email}</td>
                  <td className="py-3 px-4">
                    <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-slate-100 text-slate-700">
                      {u.role}
                    </span>
                  </td>
                  <td className="py-3 px-4">
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold ${
                        u.isActive
                          ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                          : "bg-rose-50 text-rose-700 border border-rose-200"
                      }`}
                    >
                      {u.isActive ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-slate-500">
                    {new Date(u.createdAt).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Grid: Subscription Events & Audit Logs */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Subscription Events History */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-5 border-b border-slate-200">
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Activity className="w-4 h-4 text-indigo-600" />
              <span>Subscription Lifecycle Events</span>
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Historical ledger of plan changes, trial extensions, and status transitions
            </p>
          </div>

          <div className="divide-y divide-slate-100 max-h-80 overflow-y-auto">
            {events.length === 0 ? (
              <div className="p-6 text-center text-xs text-slate-500">
                No subscription events recorded yet.
              </div>
            ) : (
              events.map((e) => (
                <div key={e.id} className="p-4 text-xs hover:bg-slate-50/80 transition-colors">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-900 bg-slate-100 px-2 py-0.5 rounded border border-slate-200 text-[11px]">
                      {e.eventType}
                    </span>
                    <span className="text-slate-400 text-[11px]">
                      {new Date(e.createdAt).toLocaleString()}
                    </span>
                  </div>
                  {e.notes && <p className="text-slate-600 mt-1.5">{e.notes}</p>}
                </div>
              ))
            )}
          </div>
        </div>

        {/* Tenant Audit Trail */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-5 border-b border-slate-200">
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-indigo-600" />
              <span>Tenant Audit Trail</span>
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Recent tenant mutations and security events
            </p>
          </div>

          <div className="divide-y divide-slate-100 max-h-80 overflow-y-auto">
            {auditLogs.length === 0 ? (
              <div className="p-6 text-center text-xs text-slate-500">
                No recent audit log entries found.
              </div>
            ) : (
              auditLogs.map((log) => (
                <div key={log.id} className="p-4 text-xs hover:bg-slate-50/80 transition-colors">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-slate-800">{log.action}</span>
                    <span className="text-slate-400 text-[11px]">
                      {new Date(log.createdAt).toLocaleString()}
                    </span>
                  </div>
                  <div className="text-slate-500 text-[11px] mt-1">
                    Entity: <span className="font-mono text-slate-700">{log.entityType}</span> (ID:{" "}
                    <span className="font-mono text-slate-700">{log.entityId}</span>)
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

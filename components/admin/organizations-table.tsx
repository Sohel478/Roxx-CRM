"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Search,
  Users,
  PlayCircle,
  PauseCircle,
  CalendarPlus,
  Sliders,
  ChevronRight,
  X,
} from "lucide-react";
import type { TenantItem } from "@/lib/validations/admin";
import {
  suspendOrganizationAction,
  activateOrganizationAction,
  extendTrialAction,
  updateTenantSubscriptionAction,
} from "@/actions/admin";

interface OrganizationsTableProps {
  initialTenants: TenantItem[];
}

export function OrganizationsTable({ initialTenants }: OrganizationsTableProps) {
  const [tenants, setTenants] = useState<TenantItem[]>(initialTenants);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [loadingId, setLoadingId] = useState<string | null>(null);

  // Modal states
  const [extendModalTenant, setExtendModalTenant] = useState<TenantItem | null>(null);
  const [extendDays, setExtendDays] = useState<number>(14);

  const [editModalTenant, setEditModalTenant] = useState<TenantItem | null>(null);
  const [editPlan, setEditPlan] = useState<string>("professional");
  const [editSeats, setEditSeats] = useState<number>(10);
  const [editStatus, setEditStatus] = useState<string>("ACTIVE");
  const [editNotes, setEditNotes] = useState<string>("");

  // Filter tenants
  const filteredTenants = tenants.filter((t) => {
    const matchesSearch =
      t.name.toLowerCase().includes(search.toLowerCase()) ||
      t.slug.toLowerCase().includes(search.toLowerCase()) ||
      (t.billingEmail && t.billingEmail.toLowerCase().includes(search.toLowerCase()));

    const matchesStatus =
      statusFilter === "ALL" ? true : t.subscriptionStatus === statusFilter;

    return matchesSearch && matchesStatus;
  });

  const handleSuspend = async (orgId: string) => {
    if (!confirm("Are you sure you want to suspend this organization? Write access will be locked.")) {
      return;
    }
    setLoadingId(orgId);
    try {
      const res = await suspendOrganizationAction(orgId);
      if (res.success) {
        setTenants((prev) =>
          prev.map((t) => (t.id === orgId ? { ...t, subscriptionStatus: "SUSPENDED" } : t))
        );
      } else {
        alert(res.error || "Failed to suspend organization");
      }
    } finally {
      setLoadingId(null);
    }
  };

  const handleActivate = async (orgId: string) => {
    setLoadingId(orgId);
    try {
      const res = await activateOrganizationAction(orgId);
      if (res.success) {
        setTenants((prev) =>
          prev.map((t) => (t.id === orgId ? { ...t, subscriptionStatus: "ACTIVE" } : t))
        );
      } else {
        alert(res.error || "Failed to activate organization");
      }
    } finally {
      setLoadingId(null);
    }
  };

  const submitExtendTrial = async () => {
    if (!extendModalTenant) return;
    setLoadingId(extendModalTenant.id);
    try {
      const res = await extendTrialAction(extendModalTenant.id, extendDays);
      if (res.success) {
        const newExpiry = new Date();
        newExpiry.setDate(newExpiry.getDate() + extendDays);
        setTenants((prev) =>
          prev.map((t) =>
            t.id === extendModalTenant.id
              ? {
                  ...t,
                  subscriptionStatus: "TRIAL",
                  trialEndsAt: newExpiry.toISOString(),
                }
              : t
          )
        );
        setExtendModalTenant(null);
      } else {
        alert(res.error || "Failed to extend trial");
      }
    } finally {
      setLoadingId(null);
    }
  };

  const submitEditSubscription = async () => {
    if (!editModalTenant) return;
    setLoadingId(editModalTenant.id);
    try {
      const res = await updateTenantSubscriptionAction({
        organizationId: editModalTenant.id,
        subscriptionPlan: editPlan,
        subscriptionStatus: editStatus as TenantItem["subscriptionStatus"],
        maxSeats: Number(editSeats),
        subscriptionNotes: editNotes,
      });

      if (res.success) {
        setTenants((prev) =>
          prev.map((t) =>
            t.id === editModalTenant.id
              ? {
                  ...t,
                  subscriptionPlan: editPlan,
                  subscriptionStatus: editStatus as TenantItem["subscriptionStatus"],
                  maxSeats: Number(editSeats),
                  subscriptionNotes: editNotes,
                }
              : t
          )
        );
        setEditModalTenant(null);
      } else {
        alert(res.error || "Failed to update subscription");
      }
    } finally {
      setLoadingId(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Controls: Search & Status Filters */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
        {/* Search Input */}
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search organizations by name, slug, or email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-sm"
          />
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
          {["ALL", "ACTIVE", "TRIAL", "EXPIRED", "SUSPENDED"].map((status) => (
            <button
              key={status}
              onClick={() => setStatusFilter(status)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
                statusFilter === status
                  ? "bg-slate-900 text-white"
                  : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200"
              }`}
            >
              {status}
            </button>
          ))}
        </div>
      </div>

      {/* Tenants Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase tracking-wider font-semibold">
              <tr>
                <th className="py-3.5 px-4">Organization</th>
                <th className="py-3.5 px-4">Plan & Status</th>
                <th className="py-3.5 px-4">Users / Seats</th>
                <th className="py-3.5 px-4">CRM Volume</th>
                <th className="py-3.5 px-4">Expiry / Renewal</th>
                <th className="py-3.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredTenants.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-500">
                    No organizations match your query.
                  </td>
                </tr>
              ) : (
                filteredTenants.map((org) => {
                  const statusColors: Record<string, string> = {
                    ACTIVE: "bg-emerald-50 text-emerald-700 border-emerald-200",
                    TRIAL: "bg-amber-50 text-amber-700 border-amber-200",
                    EXPIRED: "bg-slate-100 text-slate-700 border-slate-200",
                    SUSPENDED: "bg-rose-50 text-rose-700 border-rose-200",
                  };

                  const isLoading = loadingId === org.id;

                  return (
                    <tr key={org.id} className="hover:bg-slate-50/70 transition-colors">
                      {/* Name & Slug */}
                      <td className="py-3.5 px-4 font-semibold text-slate-900">
                        <div className="flex items-center gap-2">
                          <Link
                            href={`/super-admin/organizations/${org.id}`}
                            className="text-sm font-bold text-slate-900 hover:text-indigo-600 hover:underline"
                          >
                            {org.name}
                          </Link>
                          {org.isDemo && (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-purple-100 text-purple-700 border border-purple-200">
                              DEMO
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-slate-500 font-normal mt-0.5">
                          slug: <span className="font-mono text-slate-600">{org.slug}</span>
                          {org.billingEmail && ` • ${org.billingEmail}`}
                        </div>
                      </td>

                      {/* Plan & Status */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-slate-800 capitalize">
                            {org.subscriptionPlan.toLowerCase().replace("_", " ")}
                          </span>
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold border ${
                              statusColors[org.subscriptionStatus] || "bg-slate-100 text-slate-700"
                            }`}
                          >
                            {org.subscriptionStatus}
                          </span>
                        </div>
                      </td>

                      {/* Seats & Users */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-1.5 text-slate-700">
                          <Users className="w-3.5 h-3.5 text-slate-400" />
                          <span>
                            <strong>{org.usersCount}</strong> / {org.maxSeats} seats
                          </span>
                        </div>
                      </td>

                      {/* CRM Volume */}
                      <td className="py-3.5 px-4 text-slate-600">
                        <div>{org.leadsCount} leads</div>
                        <div className="text-[11px] text-slate-400">{org.dealsCount} deals</div>
                      </td>

                      {/* Expiry */}
                      <td className="py-3.5 px-4 text-slate-600">
                        {org.subscriptionStatus === "TRIAL" && org.trialEndsAt ? (
                          <div className="text-amber-700 font-medium">
                            Trial: {new Date(org.trialEndsAt).toLocaleDateString()}
                          </div>
                        ) : org.subscriptionEndsAt ? (
                          <div className="text-slate-700">
                            Renew: {new Date(org.subscriptionEndsAt).toLocaleDateString()}
                          </div>
                        ) : (
                          <div className="text-slate-400">Continuous</div>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Dossier */}
                          <Link
                            href={`/super-admin/organizations/${org.id}`}
                            className="px-2.5 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold transition-colors inline-flex items-center gap-1"
                          >
                            <span>Dossier</span>
                            <ChevronRight className="w-3 h-3 text-slate-500" />
                          </Link>

                          {/* Extend Trial */}
                          {org.subscriptionStatus === "TRIAL" && (
                            <button
                              onClick={() => setExtendModalTenant(org)}
                              disabled={isLoading}
                              className="px-2.5 py-1 rounded bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200 font-semibold transition-colors inline-flex items-center gap-1"
                              title="Extend Free Trial"
                            >
                              <CalendarPlus className="w-3 h-3" />
                              <span>Extend</span>
                            </button>
                          )}

                          {/* Edit / Change Plan */}
                          <button
                            onClick={() => {
                              const p = (org.subscriptionPlan || "").toLowerCase();
                              let norm = "free_trial";
                              if (p.includes("trial") || p === "free_trial") norm = "free_trial";
                              else if (p.includes("starter") || p === "starter_20") norm = "starter";
                              else if (p.includes("growth") || p === "growth_50") norm = "growth";
                              else if (p.includes("enterprise")) norm = "enterprise";

                              setEditModalTenant(org);
                              setEditPlan(norm);
                              setEditSeats(org.maxSeats);
                              setEditStatus(org.subscriptionStatus);
                              setEditNotes(org.subscriptionNotes || "");
                            }}
                            disabled={isLoading}
                            className="px-2.5 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold transition-colors inline-flex items-center gap-1"
                            title="Edit Subscription & Limits"
                          >
                            <Sliders className="w-3 h-3 text-slate-500" />
                            <span>Plan</span>
                          </button>

                          {/* Suspend or Activate */}
                          {org.subscriptionStatus === "SUSPENDED" ? (
                            <button
                              onClick={() => handleActivate(org.id)}
                              disabled={isLoading}
                              className="px-2.5 py-1 rounded bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 font-semibold transition-colors inline-flex items-center gap-1"
                              title="Reactivate Organization"
                            >
                              <PlayCircle className="w-3 h-3 text-emerald-600" />
                              <span>Activate</span>
                            </button>
                          ) : (
                            <button
                              onClick={() => handleSuspend(org.id)}
                              disabled={isLoading}
                              className="px-2.5 py-1 rounded bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 font-semibold transition-colors inline-flex items-center gap-1"
                              title="Suspend Organization"
                            >
                              <PauseCircle className="w-3 h-3 text-rose-600" />
                              <span>Suspend</span>
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal: Extend Trial */}
      {extendModalTenant && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 border border-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <CalendarPlus className="w-4 h-4 text-amber-600" />
                <span>Extend Free Trial</span>
              </h3>
              <button
                onClick={() => setExtendModalTenant(null)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="mt-4 space-y-4">
              <p className="text-xs text-slate-600">
                Grant extra evaluation time for{" "}
                <strong className="text-slate-900">{extendModalTenant.name}</strong>.
              </p>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Extension Duration
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {[7, 14, 30].map((days) => (
                    <button
                      key={days}
                      type="button"
                      onClick={() => setExtendDays(days)}
                      className={`py-2 text-xs font-bold rounded-lg border transition-all ${
                        extendDays === days
                          ? "bg-indigo-600 text-white border-indigo-600"
                          : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100"
                      }`}
                    >
                      +{days} Days
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setExtendModalTenant(null)}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={submitExtendTrial}
                  className="px-4 py-1.5 rounded-lg text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 shadow-sm"
                >
                  Confirm Extension
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Edit Subscription & Plan */}
      {editModalTenant && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full p-6 border border-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Sliders className="w-4 h-4 text-indigo-600" />
                <span>Update Subscription: {editModalTenant.name}</span>
              </h3>
              <button
                onClick={() => setEditModalTenant(null)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="mt-4 space-y-4">
              {/* Plan selector */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Pricing Tier Plan
                </label>
                <select
                  value={editPlan}
                  onChange={(e) => {
                    const plan = e.target.value;
                    setEditPlan(plan);
                    if (plan === "free_trial") {
                      setEditSeats(20);
                      setEditStatus("TRIAL");
                    } else if (plan === "starter") {
                      setEditSeats(20);
                      setEditStatus("ACTIVE");
                    } else if (plan === "growth") {
                      setEditSeats(50);
                      setEditStatus("ACTIVE");
                    } else if (plan === "enterprise") {
                      setEditSeats(100);
                      setEditStatus("ACTIVE");
                    }
                  }}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="free_trial">Free Trial: 30 days, up to 20 seats (₹0)</option>
                  <option value="starter">Tier 1 (Starter): Up to 20 seats at ₹250 / month</option>
                  <option value="growth">Tier 2 (Growth): 21 to 50 seats at ₹450 / month</option>
                  <option value="enterprise">Tier 3 (Enterprise): 50+ seats — Custom pricing (&quot;Contact Us&quot;)</option>
                </select>
              </div>

              {/* Status & Seats */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Subscription Status
                  </label>
                  <select
                    value={editStatus}
                    onChange={(e) => setEditStatus(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="ACTIVE">ACTIVE</option>
                    <option value="TRIAL">TRIAL</option>
                    <option value="EXPIRED">EXPIRED</option>
                    <option value="SUSPENDED">SUSPENDED</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Max Seat Allocation
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={editSeats}
                    onChange={(e) => setEditSeats(parseInt(e.target.value, 10) || 1)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              {/* Internal Notes */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Super Admin Notes
                </label>
                <textarea
                  rows={2}
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                  placeholder="Reason for change, custom enterprise agreement notes, etc..."
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditModalTenant(null)}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={submitEditSubscription}
                  className="px-4 py-1.5 rounded-lg text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 shadow-sm"
                >
                  Save Changes
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

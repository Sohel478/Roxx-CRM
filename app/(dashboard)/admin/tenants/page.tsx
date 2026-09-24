"use client";

import { useEffect, useState, useTransition, useCallback } from "react";
import {
  Building2,
  Users,
  ShieldCheck,
  Clock,
  Search,
  RefreshCw,
  CheckCircle2,
  Edit,
  AlertCircle,
  Crown,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import {
  getTenantsAction,
  updateTenantSubscriptionAction,
  TenantItem,
} from "@/actions/admin";

export default function SuperAdminTenantsPage() {
  const [tenants, setTenants] = useState<TenantItem[]>([]);
  const [stats, setStats] = useState({
    totalOrganizations: 0,
    activeSubscriptions: 0,
    trialOrganizations: 0,
    totalSeatsAllocated: 0,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [planFilter, setPlanFilter] = useState<string>("ALL");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [selectedTenant, setSelectedTenant] = useState<TenantItem | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  // Edit Subscription Form State
  const [editPlan, setEditPlan] = useState<TenantItem["subscriptionPlan"]>("STARTER_20");
  const [editStatus, setEditStatus] = useState<TenantItem["subscriptionStatus"]>("ACTIVE");
  const [editMaxSeats, setEditMaxSeats] = useState<number>(20);
  const [extendMonths, setExtendMonths] = useState<number>(1);
  const [editNotes, setEditNotes] = useState<string>("");
  const [modalError, setModalError] = useState<string | null>(null);
  const [modalSuccess, setModalSuccess] = useState<string | null>(null);

  const loadTenants = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await getTenantsAction();
      if (res.success && res.data) {
        setTenants(res.data.tenants);
        setStats(res.data.stats);
      }
    } catch (err) {
      console.error("[SuperAdminTenantsPage] load error:", err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTenants();
  }, [loadTenants]);

  const handleOpenEdit = (tenant: TenantItem) => {
    setSelectedTenant(tenant);
    setEditPlan(tenant.subscriptionPlan);
    setEditStatus(tenant.subscriptionStatus);
    setEditMaxSeats(tenant.maxSeats);
    setExtendMonths(1);
    setEditNotes(tenant.subscriptionNotes || "");
    setModalError(null);
    setModalSuccess(null);
    setIsEditModalOpen(true);
  };

  const handleSaveSubscription = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTenant) return;

    setModalError(null);
    setModalSuccess(null);

    startTransition(async () => {
      try {
        const res = await updateTenantSubscriptionAction({
          organizationId: selectedTenant.id,
          subscriptionPlan: editPlan,
          subscriptionStatus: editStatus,
          maxSeats: Number(editMaxSeats) || 20,
          extendMonths: Number(extendMonths) || 0,
          subscriptionNotes: editNotes.trim() || undefined,
        });

        if (res.success) {
          setModalSuccess("Subscription updated successfully!");
          setTimeout(() => {
            setIsEditModalOpen(false);
            loadTenants();
          }, 800);
        } else {
          setModalError(res.error || "Failed to update subscription");
        }
      } catch (err: unknown) {
        setModalError(err instanceof Error ? err.message : "An unexpected error occurred");
      }
    });
  };

  const filteredTenants = tenants.filter((t) => {
    if (planFilter !== "ALL" && t.subscriptionPlan !== planFilter) return false;
    if (statusFilter !== "ALL" && t.subscriptionStatus !== statusFilter) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      const matchName = t.name.toLowerCase().includes(q);
      const matchSlug = t.slug.toLowerCase().includes(q);
      const matchEmail = t.billingEmail?.toLowerCase().includes(q);
      if (!matchName && !matchSlug && !matchEmail) return false;
    }
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Super Admin Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-gradient-to-r from-purple-900 to-indigo-900 text-white p-6 rounded-2xl shadow-sm">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-purple-400/20 text-purple-200 border border-purple-300/30">
              <Crown className="w-3 h-3 text-amber-300" />
              Platform Super Admin
            </span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight">Tenant Organizations &amp; Subscriptions</h1>
          <p className="text-xs text-purple-200 mt-1 max-w-xl">
            Manual billing administration: activate customer subscriptions, grant team seat extensions, and view tenant workspace analytics.
          </p>
        </div>

        <Button
          type="button"
          onClick={loadTenants}
          variant="outline"
          className="bg-white/10 hover:bg-white/20 border-white/20 text-white text-xs gap-1.5 self-start sm:self-auto cursor-pointer"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin" : ""}`} />
          <span>Refresh Directory</span>
        </Button>
      </div>

      {/* KPI Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-xs font-semibold">Total Organizations</span>
            <div className="p-1.5 rounded-lg bg-blue-50 text-blue-600">
              <Building2 className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-slate-900">{stats.totalOrganizations}</div>
          <p className="text-[11px] text-slate-400 mt-0.5">Registered CRM tenants</p>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-xs font-semibold">Active Subscriptions</span>
            <div className="p-1.5 rounded-lg bg-emerald-50 text-emerald-600">
              <ShieldCheck className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-emerald-600">{stats.activeSubscriptions}</div>
          <p className="text-[11px] text-emerald-600/80 font-medium mt-0.5">Verified offline accounts</p>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-xs font-semibold">Trial Organizations</span>
            <div className="p-1.5 rounded-lg bg-indigo-50 text-indigo-600">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-indigo-600">{stats.trialOrganizations}</div>
          <p className="text-[11px] text-indigo-600/80 font-medium mt-0.5">30-day Free Trials running</p>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-xs font-semibold">Total Seats Allocated</span>
            <div className="p-1.5 rounded-lg bg-purple-50 text-purple-600">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-slate-900">{stats.totalSeatsAllocated}</div>
          <p className="text-[11px] text-slate-400 mt-0.5">Licensed user seats</p>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-col md:flex-row items-center justify-between gap-3">
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search tenant name, slug, or email..."
            className="pl-9 text-xs h-9"
          />
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto overflow-x-auto">
          <select
            value={planFilter}
            onChange={(e) => setPlanFilter(e.target.value)}
            className="text-xs h-9 px-3 rounded-lg border border-slate-200 bg-white text-slate-700 font-medium focus:outline-none focus:ring-2 focus:ring-purple-500"
          >
            <option value="ALL">All Plans</option>
            <option value="FREE_TRIAL">Free Trial (20 Seats)</option>
            <option value="STARTER_20">Starter (20 Seats - ₹250/mo)</option>
            <option value="GROWTH_50">Growth (50 Seats - ₹450/mo)</option>
            <option value="ENTERPRISE">Enterprise (50+ Seats)</option>
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="text-xs h-9 px-3 rounded-lg border border-slate-200 bg-white text-slate-700 font-medium focus:outline-none focus:ring-2 focus:ring-purple-500"
          >
            <option value="ALL">All Statuses</option>
            <option value="TRIAL">Trial</option>
            <option value="ACTIVE">Active</option>
            <option value="EXPIRED">Expired</option>
            <option value="SUSPENDED">Suspended</option>
          </select>
        </div>
      </div>

      {/* Tenants Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/75 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                <th className="py-3 px-4">Organization</th>
                <th className="py-3 px-4">Admin Contact</th>
                <th className="py-3 px-4">Plan &amp; Tier</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Seats (Used / Max)</th>
                <th className="py-3 px-4">Expires / Renews</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {filteredTenants.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-400">
                    No organizations matching the filter criteria.
                  </td>
                </tr>
              ) : (
                filteredTenants.map((t) => (
                  <tr key={t.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="py-3.5 px-4 font-semibold text-slate-900">
                      <div>
                        <span>{t.name}</span>
                        <span className="block text-[11px] text-slate-400 font-mono">
                          /{t.slug}
                        </span>
                      </div>
                    </td>

                    <td className="py-3.5 px-4 text-slate-600">
                      <div>
                        <span className="block">{t.billingEmail || "—"}</span>
                        {t.billingPhone && (
                          <span className="text-[11px] text-slate-400">{t.billingPhone}</span>
                        )}
                      </div>
                    </td>

                    <td className="py-3.5 px-4">
                      {t.subscriptionPlan === "FREE_TRIAL" && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                          Free Trial
                        </span>
                      )}
                      {t.subscriptionPlan === "STARTER_20" && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          Starter (₹250/m)
                        </span>
                      )}
                      {t.subscriptionPlan === "GROWTH_50" && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-purple-50 text-purple-700 border border-purple-200">
                          Growth (₹450/m)
                        </span>
                      )}
                      {t.subscriptionPlan === "ENTERPRISE" && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                          Enterprise
                        </span>
                      )}
                    </td>

                    <td className="py-3.5 px-4">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider ${
                          t.subscriptionStatus === "ACTIVE"
                            ? "bg-emerald-100 text-emerald-800"
                            : t.subscriptionStatus === "TRIAL"
                            ? "bg-indigo-100 text-indigo-800"
                            : "bg-red-100 text-red-800"
                        }`}
                      >
                        {t.subscriptionStatus}
                      </span>
                    </td>

                    <td className="py-3.5 px-4">
                      <span className="font-semibold text-slate-800">
                        {t.usersCount} / {t.maxSeats}
                      </span>
                      <span className="text-[11px] text-slate-400 block">
                        {t.leadsCount} leads &bull; {t.dealsCount} deals
                      </span>
                    </td>

                    <td className="py-3.5 px-4 text-slate-600">
                      {t.subscriptionStatus === "TRIAL"
                        ? t.trialEndsAt
                          ? new Date(t.trialEndsAt).toLocaleDateString()
                          : "30 days"
                        : t.subscriptionEndsAt
                        ? new Date(t.subscriptionEndsAt).toLocaleDateString()
                        : "Active"}
                    </td>

                    <td className="py-3.5 px-4 text-right">
                      <Button
                        type="button"
                        onClick={() => handleOpenEdit(t)}
                        variant="outline"
                        className="text-xs h-8 px-2.5 gap-1.5 cursor-pointer text-purple-700 hover:bg-purple-50 border-purple-200"
                      >
                        <Edit className="w-3.5 h-3.5" />
                        <span>Manage</span>
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Super Admin Edit Subscription Modal */}
      <Modal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        title={`Manage Subscription: ${selectedTenant?.name}`}
        description="Manually activate, extend, or update seat capacity and subscription status."
        maxWidth="lg"
      >
        <form onSubmit={handleSaveSubscription} className="space-y-4 pt-2">
          {modalError && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
              <span>{modalError}</span>
            </div>
          )}

          {modalSuccess && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{modalSuccess}</span>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Subscription Plan
              </label>
              <select
                value={editPlan}
                onChange={(e) => setEditPlan(e.target.value as TenantItem["subscriptionPlan"])}
                className="w-full text-xs h-9 px-3 rounded-lg border border-slate-200 bg-white text-slate-700 font-medium focus:outline-none focus:ring-2 focus:ring-purple-500"
              >
                <option value="FREE_TRIAL">Free Trial (20 Seats)</option>
                <option value="STARTER_20">Starter Plan (Up to 20 Seats - ₹250/mo)</option>
                <option value="GROWTH_50">Growth Plan (21 to 50 Seats - ₹450/mo)</option>
                <option value="ENTERPRISE">Enterprise (50+ Seats - Custom)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Subscription Status
              </label>
              <select
                value={editStatus}
                onChange={(e) => setEditStatus(e.target.value as TenantItem["subscriptionStatus"])}
                className="w-full text-xs h-9 px-3 rounded-lg border border-slate-200 bg-white text-slate-700 font-medium focus:outline-none focus:ring-2 focus:ring-purple-500"
              >
                <option value="ACTIVE">ACTIVE (Paid &amp; Live)</option>
                <option value="TRIAL">TRIAL (Evaluation)</option>
                <option value="EXPIRED">EXPIRED (Payment Due)</option>
                <option value="SUSPENDED">SUSPENDED (Locked)</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Max Allowed Seats
              </label>
              <Input
                type="number"
                min={1}
                max={500}
                value={editMaxSeats}
                onChange={(e) => setEditMaxSeats(Number(e.target.value))}
                className="text-xs h-9"
              />
              <span className="text-[11px] text-slate-400 mt-0.5 block">
                Current active users in org: <strong>{selectedTenant?.usersCount || 1}</strong>
              </span>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Extend Validity By
              </label>
              <select
                value={extendMonths}
                onChange={(e) => setExtendMonths(Number(e.target.value))}
                className="w-full text-xs h-9 px-3 rounded-lg border border-slate-200 bg-white text-slate-700 font-medium focus:outline-none focus:ring-2 focus:ring-purple-500"
              >
                <option value={0}>Keep Existing Expiry Date</option>
                <option value={1}>+1 Month (30 Days)</option>
                <option value={3}>+3 Months (Quarterly)</option>
                <option value={6}>+6 Months (Half-Yearly)</option>
                <option value={12}>+12 Months (1 Year)</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Internal Admin Notes / Payment Reference
            </label>
            <textarea
              rows={2}
              value={editNotes}
              onChange={(e) => setEditNotes(e.target.value)}
              placeholder="e.g. Received ₹250 via UPI on 24 Sep for 1 month Starter activation."
              className="w-full p-2.5 border border-slate-200 rounded-lg text-xs placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsEditModalOpen(false)}
              className="text-xs"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isPending}
              className="bg-purple-600 hover:bg-purple-700 text-white text-xs font-semibold cursor-pointer"
            >
              {isPending ? "Updating..." : "Save & Activate Subscription"}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

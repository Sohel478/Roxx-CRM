"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  CalendarPlus,
  Sliders,
  PauseCircle,
  PlayCircle,
  X,
} from "lucide-react";
import type { TenantItem } from "@/lib/validations/admin";
import {
  suspendOrganizationAction,
  activateOrganizationAction,
  extendTrialAction,
  updateTenantSubscriptionAction,
} from "@/actions/admin";

interface TenantDetailActionsProps {
  organization: TenantItem;
}

export function TenantDetailActions({ organization }: TenantDetailActionsProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const [extendModalOpen, setExtendModalOpen] = useState(false);
  const [extendDays, setExtendDays] = useState(14);

  const normalizedInitialPlan = (() => {
    const p = (organization.subscriptionPlan || "").toLowerCase();
    if (p.includes("trial") || p === "free_trial") return "free_trial";
    if (p.includes("starter") || p === "starter_20") return "starter";
    if (p.includes("growth") || p === "growth_50") return "growth";
    if (p.includes("enterprise")) return "enterprise";
    return "free_trial";
  })();

  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editPlan, setEditPlan] = useState(normalizedInitialPlan);
  const [editSeats, setEditSeats] = useState(organization.maxSeats);
  const [editStatus, setEditStatus] = useState(organization.subscriptionStatus);
  const [editNotes, setEditNotes] = useState(organization.subscriptionNotes || "");

  const handleSuspend = async () => {
    if (!confirm("Are you sure you want to suspend this organization? Users will lose write access.")) {
      return;
    }
    setLoading(true);
    try {
      const res = await suspendOrganizationAction(organization.id);
      if (res.success) {
        router.refresh();
      } else {
        alert(res.error || "Failed to suspend organization");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleActivate = async () => {
    setLoading(true);
    try {
      const res = await activateOrganizationAction(organization.id);
      if (res.success) {
        router.refresh();
      } else {
        alert(res.error || "Failed to activate organization");
      }
    } finally {
      setLoading(false);
    }
  };

  const submitExtendTrial = async () => {
    setLoading(true);
    try {
      const res = await extendTrialAction(organization.id, extendDays);
      if (res.success) {
        setExtendModalOpen(false);
        router.refresh();
      } else {
        alert(res.error || "Failed to extend trial");
      }
    } finally {
      setLoading(false);
    }
  };

  const submitEditSubscription = async () => {
    setLoading(true);
    try {
      const res = await updateTenantSubscriptionAction({
        organizationId: organization.id,
        subscriptionPlan: editPlan,
        subscriptionStatus: editStatus as TenantItem["subscriptionStatus"],
        maxSeats: Number(editSeats),
        subscriptionNotes: editNotes,
      });

      if (res.success) {
        setEditModalOpen(false);
        router.refresh();
      } else {
        alert(res.error || "Failed to update subscription");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <div className="flex items-center gap-2">
        {/* Extend Trial */}
        {organization.subscriptionStatus === "TRIAL" && (
          <button
            onClick={() => setExtendModalOpen(true)}
            disabled={loading}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200 text-xs font-bold transition-colors shadow-sm"
          >
            <CalendarPlus className="w-3.5 h-3.5 text-amber-600" />
            <span>Extend Trial</span>
          </button>
        )}

        {/* Change Plan & Limits */}
        <button
          onClick={() => setEditModalOpen(true)}
          disabled={loading}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 text-xs font-bold transition-colors shadow-sm"
        >
          <Sliders className="w-3.5 h-3.5 text-slate-500" />
          <span>Change Plan</span>
        </button>

        {/* Suspend or Reactivate */}
        {organization.subscriptionStatus === "SUSPENDED" ? (
          <button
            onClick={handleActivate}
            disabled={loading}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-colors shadow-sm"
          >
            <PlayCircle className="w-3.5 h-3.5" />
            <span>Reactivate</span>
          </button>
        ) : (
          <button
            onClick={handleSuspend}
            disabled={loading}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-bold transition-colors shadow-sm"
          >
            <PauseCircle className="w-3.5 h-3.5 text-rose-600" />
            <span>Suspend</span>
          </button>
        )}
      </div>

      {/* Modal: Extend Trial */}
      {extendModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 border border-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <CalendarPlus className="w-4 h-4 text-amber-600" />
                <span>Extend Free Trial</span>
              </h3>
              <button
                onClick={() => setExtendModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="mt-4 space-y-4">
              <p className="text-xs text-slate-600">
                Grant extra evaluation time for{" "}
                <strong className="text-slate-900">{organization.name}</strong>.
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
                  onClick={() => setExtendModalOpen(false)}
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

      {/* Modal: Change Plan */}
      {editModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full p-6 border border-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Sliders className="w-4 h-4 text-indigo-600" />
                <span>Update Subscription: {organization.name}</span>
              </h3>
              <button
                onClick={() => setEditModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="mt-4 space-y-4">
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

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Subscription Status
                  </label>
                  <select
                    value={editStatus}
                    onChange={(e) => setEditStatus(e.target.value as TenantItem["subscriptionStatus"])}
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

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Super Admin Notes
                </label>
                <textarea
                  rows={2}
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                  placeholder="Reason for changes, custom tier allowances..."
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditModalOpen(false)}
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
    </>
  );
}

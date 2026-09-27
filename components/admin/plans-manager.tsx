"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { SuperAdminPlanItem, CreatePlanInput, UpdatePlanInput } from "@/lib/validations/admin";
import {
  createSuperAdminPlanAction,
  updateSuperAdminPlanAction,
  deleteSuperAdminPlanAction,
} from "@/actions/admin";
import {
  Layers,
  Plus,
  Pencil,
  Trash2,
  Users,
  Database,
  Download,
  KeyRound,
  Sparkles,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Loader2,
  X,
} from "lucide-react";

interface PlansManagerProps {
  initialPlans: SuperAdminPlanItem[];
}

const DEFAULT_CREATE_FORM: CreatePlanInput = {
  name: "",
  slug: "",
  description: "",
  price: 49,
  currency: "USD",
  billingInterval: "MONTHLY",
  isActive: true,
  isPublic: true,
  features: {
    users_limit: 5,
    leads_limit: 5000,
    companies_limit: 2500,
    contacts_limit: 5000,
    opportunities_limit: 2500,
    pipelines_limit: 3,
    advanced_reports: true,
    export: true,
    api_access: false,
    ai_features: false,
  },
};

export function PlansManager({ initialPlans }: PlansManagerProps) {
  const router = useRouter();
  const [plans, setPlans] = useState<SuperAdminPlanItem[]>(initialPlans);
  const [isPending, startTransition] = useTransition();

  // Modal States
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState<SuperAdminPlanItem | null>(null);
  const [deletingPlan, setDeletingPlan] = useState<SuperAdminPlanItem | null>(null);

  // Form State for Create
  const [createForm, setCreateForm] = useState<CreatePlanInput>(DEFAULT_CREATE_FORM);

  // Form State for Edit
  const [editForm, setEditForm] = useState<UpdatePlanInput>({});

  // Messages
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  function clearFeedback() {
    setErrorMsg(null);
    setSuccessMsg(null);
  }

  function handleOpenCreate() {
    clearFeedback();
    setCreateForm(DEFAULT_CREATE_FORM);
    setIsCreateOpen(true);
  }

  function handleOpenEdit(plan: SuperAdminPlanItem) {
    clearFeedback();
    setEditingPlan(plan);
    setEditForm({
      name: plan.name,
      slug: plan.slug,
      description: plan.description,
      price: plan.price,
      currency: plan.currency,
      billingInterval: plan.billingInterval as "MONTHLY" | "YEARLY",
      isActive: plan.isActive,
      isPublic: plan.isPublic,
      features: { ...plan.features },
    });
  }

  function handleOpenDelete(plan: SuperAdminPlanItem) {
    clearFeedback();
    setDeletingPlan(plan);
  }

  // Submit Create
  function handleCreateSubmit(e: React.FormEvent) {
    e.preventDefault();
    clearFeedback();

    startTransition(async () => {
      const res = await createSuperAdminPlanAction(createForm);
      if (!res.success) {
        setErrorMsg(res.error || "Failed to create plan");
        return;
      }

      if (res.data) {
        setPlans((prev) => [...prev, res.data!]);
      }
      setSuccessMsg(`Plan "${createForm.name}" created successfully.`);
      setIsCreateOpen(false);
      router.refresh();
    });
  }

  // Submit Edit
  function handleEditSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!editingPlan) return;
    clearFeedback();

    startTransition(async () => {
      const res = await updateSuperAdminPlanAction(editingPlan.id, editForm);
      if (!res.success) {
        setErrorMsg(res.error || "Failed to update plan");
        return;
      }

      if (res.data) {
        setPlans((prev) =>
          prev.map((p) => (p.id === editingPlan.id ? res.data! : p))
        );
      }
      setSuccessMsg(`Plan "${editingPlan.name}" updated successfully.`);
      setEditingPlan(null);
      router.refresh();
    });
  }

  // Submit Delete
  function handleDeleteConfirm() {
    if (!deletingPlan) return;
    clearFeedback();

    startTransition(async () => {
      const res = await deleteSuperAdminPlanAction(deletingPlan.id);
      if (!res.success) {
        setErrorMsg(res.error || "Failed to delete plan");
        return;
      }

      setPlans((prev) => prev.filter((p) => p.id !== deletingPlan.id));
      setSuccessMsg(`Plan "${deletingPlan.name}" deleted.`);
      setDeletingPlan(null);
      router.refresh();
    });
  }

  return (
    <div className="space-y-6">
      {/* Feedback Messages */}
      {errorMsg && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl flex items-center justify-between text-red-800 text-sm">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-red-600 shrink-0" />
            <span>{errorMsg}</span>
          </div>
          <button
            type="button"
            onClick={() => setErrorMsg(null)}
            className="text-red-500 hover:text-red-700"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {successMsg && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center justify-between text-emerald-800 text-sm">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            <span>{successMsg}</span>
          </div>
          <button
            type="button"
            onClick={() => setSuccessMsg(null)}
            className="text-emerald-500 hover:text-emerald-700"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Action Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
        <div>
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <Layers className="w-5 h-5 text-indigo-600" />
            <span>Active Tiers ({plans.length})</span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Create custom subscription tiers, configure user and lead quotas, and grant premium feature access.
          </p>
        </div>
        <button
          type="button"
          onClick={handleOpenCreate}
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-semibold shadow-xs hover:shadow transition-all cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>Create New Plan</span>
        </button>
      </div>

      {/* Plans Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {plans.map((plan) => {
          const isEnterprise = plan.slug === "enterprise";
          return (
            <div
              key={plan.id}
              className={`bg-white rounded-xl border flex flex-col justify-between shadow-xs hover:shadow-md transition-shadow overflow-hidden ${
                isEnterprise
                  ? "border-purple-300 ring-2 ring-purple-100"
                  : "border-slate-200"
              }`}
            >
              {/* Header */}
              <div className="p-6 border-b border-slate-100">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-bold text-slate-900">{plan.name}</h3>
                  <div className="flex items-center gap-1.5">
                    {plan.isPublic ? (
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                        PUBLIC
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-600 border border-slate-200">
                        CUSTOM
                      </span>
                    )}
                  </div>
                </div>
                <p className="text-xs text-slate-500 mt-1 min-h-[32px] line-clamp-2">
                  {plan.description || "No description provided."}
                </p>

                <div className="mt-4 flex items-baseline gap-1">
                  <span className="text-3xl font-extrabold text-slate-900">
                    ${plan.price}
                  </span>
                  <span className="text-xs text-slate-500 font-medium">
                    /{plan.billingInterval.toLowerCase()}
                  </span>
                </div>

                <div className="mt-3 text-xs text-slate-600 bg-slate-50 px-2.5 py-1.5 rounded-lg border border-slate-100 flex items-center justify-between">
                  <span>Subscribers:</span>
                  <strong className="text-indigo-600 font-bold">
                    {plan.activeSubscriptionsCount} org{plan.activeSubscriptionsCount === 1 ? "" : "s"}
                  </strong>
                </div>
              </div>

              {/* Resource Quotas */}
              <div className="p-6 space-y-4 flex-1">
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2">
                    Resource Capacities
                  </div>
                  <ul className="space-y-2 text-xs text-slate-700">
                    <li className="flex justify-between items-center py-0.5">
                      <span className="flex items-center gap-1.5 text-slate-500">
                        <Users className="w-3.5 h-3.5" /> Max Users
                      </span>
                      <strong className="text-slate-900">
                        {plan.features.users_limit >= 99999 ? "Unlimited" : plan.features.users_limit}
                      </strong>
                    </li>
                    <li className="flex justify-between items-center py-0.5">
                      <span className="text-slate-500">Lead Storage</span>
                      <strong className="text-slate-900">
                        {plan.features.leads_limit >= 999999 ? "Unlimited" : plan.features.leads_limit.toLocaleString()}
                      </strong>
                    </li>
                    <li className="flex justify-between items-center py-0.5">
                      <span className="text-slate-500">Deals Storage</span>
                      <strong className="text-slate-900">
                        {plan.features.opportunities_limit >= 999999 ? "Unlimited" : plan.features.opportunities_limit.toLocaleString()}
                      </strong>
                    </li>
                    <li className="flex justify-between items-center py-0.5">
                      <span className="text-slate-500">Sales Pipelines</span>
                      <strong className="text-slate-900">
                        {plan.features.pipelines_limit >= 99 ? "Unlimited" : plan.features.pipelines_limit}
                      </strong>
                    </li>
                  </ul>
                </div>

                {/* Feature Entitlements */}
                <div className="pt-3 border-t border-slate-100">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2">
                    Feature Capabilities
                  </div>
                  <ul className="space-y-1.5 text-xs">
                    <li className="flex items-center justify-between">
                      <span className="text-slate-600 flex items-center gap-1.5">
                        <Database className="w-3.5 h-3.5 text-slate-400" /> Advanced Reports
                      </span>
                      {plan.features.advanced_reports ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                      ) : (
                        <XCircle className="w-4 h-4 text-slate-300" />
                      )}
                    </li>
                    <li className="flex items-center justify-between">
                      <span className="text-slate-600 flex items-center gap-1.5">
                        <Download className="w-3.5 h-3.5 text-slate-400" /> CSV / Data Export
                      </span>
                      {plan.features.export ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                      ) : (
                        <XCircle className="w-4 h-4 text-slate-300" />
                      )}
                    </li>
                    <li className="flex items-center justify-between">
                      <span className="text-slate-600 flex items-center gap-1.5">
                        <KeyRound className="w-3.5 h-3.5 text-slate-400" /> REST API Access
                      </span>
                      {plan.features.api_access ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                      ) : (
                        <XCircle className="w-4 h-4 text-slate-300" />
                      )}
                    </li>
                    <li className="flex items-center justify-between">
                      <span className="text-slate-600 flex items-center gap-1.5">
                        <Sparkles className="w-3.5 h-3.5 text-purple-500" /> AI Insights Engine
                      </span>
                      {plan.features.ai_features ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                      ) : (
                        <XCircle className="w-4 h-4 text-slate-300" />
                      )}
                    </li>
                  </ul>
                </div>
              </div>

              {/* Actions Footer */}
              <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-xs">
                <span className="text-slate-500 font-mono text-[11px] truncate max-w-[90px]" title={plan.slug}>
                  {plan.slug}
                </span>

                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => handleOpenEdit(plan)}
                    className="inline-flex items-center gap-1 px-2.5 py-1 text-slate-700 hover:text-indigo-700 bg-white hover:bg-indigo-50 border border-slate-200 rounded-md font-medium text-xs transition-colors cursor-pointer"
                    title="Edit Plan"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                    <span>Edit</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleOpenDelete(plan)}
                    className="inline-flex items-center gap-1 px-2 py-1 text-slate-400 hover:text-red-600 hover:bg-red-50 border border-transparent hover:border-red-200 rounded-md text-xs transition-colors cursor-pointer"
                    title="Delete Plan"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* CREATE PLAN MODAL */}
      {isCreateOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto border border-slate-200">
            <div className="flex items-center justify-between p-6 border-b border-slate-100 sticky top-0 bg-white z-10">
              <div>
                <h3 className="text-lg font-bold text-slate-900">Create New Subscription Plan</h3>
                <p className="text-xs text-slate-500">Define plan parameters, resource quotas, and premium features.</p>
              </div>
              <button
                type="button"
                onClick={() => setIsCreateOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateSubmit} className="p-6 space-y-6">
              {/* Basic Info */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Plan Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={createForm.name}
                    onChange={(e) =>
                      setCreateForm({
                        ...createForm,
                        name: e.target.value,
                        slug: e.target.value.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
                      })
                    }
                    placeholder="e.g. Agency Pro"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Slug identifier <span className="text-slate-400 font-normal">(unique)</span>
                  </label>
                  <input
                    type="text"
                    value={createForm.slug}
                    onChange={(e) => setCreateForm({ ...createForm, slug: e.target.value })}
                    placeholder="e.g. agency-pro"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Description
                </label>
                <textarea
                  rows={2}
                  value={createForm.description}
                  onChange={(e) => setCreateForm({ ...createForm, description: e.target.value })}
                  placeholder="Target audience and value proposition..."
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              {/* Pricing & Interval */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Price (USD) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    required
                    value={createForm.price}
                    onChange={(e) => setCreateForm({ ...createForm, price: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Billing Interval
                  </label>
                  <select
                    value={createForm.billingInterval}
                    onChange={(e) =>
                      setCreateForm({
                        ...createForm,
                        billingInterval: e.target.value as "MONTHLY" | "YEARLY",
                      })
                    }
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="MONTHLY">Monthly</option>
                    <option value="YEARLY">Yearly</option>
                  </select>
                </div>

                <div className="flex flex-col justify-end gap-2 pt-2">
                  <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={createForm.isPublic}
                      onChange={(e) => setCreateForm({ ...createForm, isPublic: e.target.checked })}
                      className="rounded text-indigo-600 focus:ring-indigo-500"
                    />
                    <span>Show on Public Pricing</span>
                  </label>

                  <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={createForm.isActive}
                      onChange={(e) => setCreateForm({ ...createForm, isActive: e.target.checked })}
                      className="rounded text-indigo-600 focus:ring-indigo-500"
                    />
                    <span>Active for Signups</span>
                  </label>
                </div>
              </div>

              {/* Resource Quotas */}
              <div className="pt-4 border-t border-slate-100">
                <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-3">
                  Resource Capacities (Set 99999 for Unlimited)
                </h4>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div>
                    <label className="block text-[11px] font-medium text-slate-600 mb-1">Max Users</label>
                    <input
                      type="number"
                      min="1"
                      value={createForm.features.users_limit}
                      onChange={(e) =>
                        setCreateForm({
                          ...createForm,
                          features: { ...createForm.features, users_limit: parseInt(e.target.value, 10) || 1 },
                        })
                      }
                      className="w-full px-2.5 py-1.5 border border-slate-300 rounded-md text-xs"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-medium text-slate-600 mb-1">Leads Limit</label>
                    <input
                      type="number"
                      min="100"
                      value={createForm.features.leads_limit}
                      onChange={(e) =>
                        setCreateForm({
                          ...createForm,
                          features: { ...createForm.features, leads_limit: parseInt(e.target.value, 10) || 100 },
                        })
                      }
                      className="w-full px-2.5 py-1.5 border border-slate-300 rounded-md text-xs"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-medium text-slate-600 mb-1">Deals Limit</label>
                    <input
                      type="number"
                      min="100"
                      value={createForm.features.opportunities_limit}
                      onChange={(e) =>
                        setCreateForm({
                          ...createForm,
                          features: {
                            ...createForm.features,
                            opportunities_limit: parseInt(e.target.value, 10) || 100,
                          },
                        })
                      }
                      className="w-full px-2.5 py-1.5 border border-slate-300 rounded-md text-xs"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-medium text-slate-600 mb-1">Pipelines Limit</label>
                    <input
                      type="number"
                      min="1"
                      value={createForm.features.pipelines_limit}
                      onChange={(e) =>
                        setCreateForm({
                          ...createForm,
                          features: { ...createForm.features, pipelines_limit: parseInt(e.target.value, 10) || 1 },
                        })
                      }
                      className="w-full px-2.5 py-1.5 border border-slate-300 rounded-md text-xs"
                    />
                  </div>
                </div>
              </div>

              {/* Feature Flags */}
              <div className="pt-4 border-t border-slate-100">
                <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-3">
                  Premium Feature Flags
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <label className="flex items-center gap-2 p-2.5 rounded-lg border border-slate-200 hover:bg-slate-50 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={createForm.features.advanced_reports}
                      onChange={(e) =>
                        setCreateForm({
                          ...createForm,
                          features: { ...createForm.features, advanced_reports: e.target.checked },
                        })
                      }
                      className="rounded text-indigo-600"
                    />
                    <span className="text-xs font-medium text-slate-800">Advanced Analytics & Reports</span>
                  </label>

                  <label className="flex items-center gap-2 p-2.5 rounded-lg border border-slate-200 hover:bg-slate-50 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={createForm.features.export}
                      onChange={(e) =>
                        setCreateForm({
                          ...createForm,
                          features: { ...createForm.features, export: e.target.checked },
                        })
                      }
                      className="rounded text-indigo-600"
                    />
                    <span className="text-xs font-medium text-slate-800">CSV & Data Exporting</span>
                  </label>

                  <label className="flex items-center gap-2 p-2.5 rounded-lg border border-slate-200 hover:bg-slate-50 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={createForm.features.api_access}
                      onChange={(e) =>
                        setCreateForm({
                          ...createForm,
                          features: { ...createForm.features, api_access: e.target.checked },
                        })
                      }
                      className="rounded text-indigo-600"
                    />
                    <span className="text-xs font-medium text-slate-800">REST API & Webhooks Access</span>
                  </label>

                  <label className="flex items-center gap-2 p-2.5 rounded-lg border border-slate-200 hover:bg-slate-50 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={createForm.features.ai_features}
                      onChange={(e) =>
                        setCreateForm({
                          ...createForm,
                          features: { ...createForm.features, ai_features: e.target.checked },
                        })
                      }
                      className="rounded text-indigo-600"
                    />
                    <span className="text-xs font-medium text-slate-800">AI Deal Scoring & Intelligence</span>
                  </label>
                </div>
              </div>

              {/* Modal Actions */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsCreateOpen(false)}
                  disabled={isPending}
                  className="px-4 py-2 border border-slate-300 text-slate-700 hover:bg-slate-50 rounded-lg text-sm font-medium transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="inline-flex items-center gap-2 px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-semibold transition-colors disabled:opacity-50"
                >
                  {isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                  <span>Create Plan</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT PLAN MODAL */}
      {editingPlan && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto border border-slate-200">
            <div className="flex items-center justify-between p-6 border-b border-slate-100 sticky top-0 bg-white z-10">
              <div>
                <h3 className="text-lg font-bold text-slate-900">Edit Plan: {editingPlan.name}</h3>
                <p className="text-xs text-slate-500">Update pricing, limits, or toggle premium capabilities.</p>
              </div>
              <button
                type="button"
                onClick={() => setEditingPlan(null)}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleEditSubmit} className="p-6 space-y-6">
              {/* Basic Info */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Plan Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={editForm.name || ""}
                    onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Slug identifier
                  </label>
                  <input
                    type="text"
                    value={editForm.slug || ""}
                    onChange={(e) => setEditForm({ ...editForm, slug: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Description
                </label>
                <textarea
                  rows={2}
                  value={editForm.description || ""}
                  onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              {/* Pricing & Interval */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Price (USD) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    required
                    value={editForm.price ?? 0}
                    onChange={(e) => setEditForm({ ...editForm, price: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Billing Interval
                  </label>
                  <select
                    value={editForm.billingInterval || "MONTHLY"}
                    onChange={(e) =>
                      setEditForm({
                        ...editForm,
                        billingInterval: e.target.value as "MONTHLY" | "YEARLY",
                      })
                    }
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="MONTHLY">Monthly</option>
                    <option value="YEARLY">Yearly</option>
                  </select>
                </div>

                <div className="flex flex-col justify-end gap-2 pt-2">
                  <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={Boolean(editForm.isPublic)}
                      onChange={(e) => setEditForm({ ...editForm, isPublic: e.target.checked })}
                      className="rounded text-indigo-600 focus:ring-indigo-500"
                    />
                    <span>Show on Public Pricing</span>
                  </label>

                  <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={Boolean(editForm.isActive)}
                      onChange={(e) => setEditForm({ ...editForm, isActive: e.target.checked })}
                      className="rounded text-indigo-600 focus:ring-indigo-500"
                    />
                    <span>Active for Subscriptions</span>
                  </label>
                </div>
              </div>

              {/* Resource Quotas */}
              <div className="pt-4 border-t border-slate-100">
                <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-3">
                  Resource Capacities (Set 99999 for Unlimited)
                </h4>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div>
                    <label className="block text-[11px] font-medium text-slate-600 mb-1">Max Users</label>
                    <input
                      type="number"
                      min="1"
                      value={editForm.features?.users_limit ?? 3}
                      onChange={(e) =>
                        setEditForm({
                          ...editForm,
                          features: {
                            ...editForm.features,
                            users_limit: parseInt(e.target.value, 10) || 1,
                          },
                        })
                      }
                      className="w-full px-2.5 py-1.5 border border-slate-300 rounded-md text-xs"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-medium text-slate-600 mb-1">Leads Limit</label>
                    <input
                      type="number"
                      min="100"
                      value={editForm.features?.leads_limit ?? 1000}
                      onChange={(e) =>
                        setEditForm({
                          ...editForm,
                          features: {
                            ...editForm.features,
                            leads_limit: parseInt(e.target.value, 10) || 100,
                          },
                        })
                      }
                      className="w-full px-2.5 py-1.5 border border-slate-300 rounded-md text-xs"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-medium text-slate-600 mb-1">Deals Limit</label>
                    <input
                      type="number"
                      min="100"
                      value={editForm.features?.opportunities_limit ?? 500}
                      onChange={(e) =>
                        setEditForm({
                          ...editForm,
                          features: {
                            ...editForm.features,
                            opportunities_limit: parseInt(e.target.value, 10) || 100,
                          },
                        })
                      }
                      className="w-full px-2.5 py-1.5 border border-slate-300 rounded-md text-xs"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-medium text-slate-600 mb-1">Pipelines Limit</label>
                    <input
                      type="number"
                      min="1"
                      value={editForm.features?.pipelines_limit ?? 1}
                      onChange={(e) =>
                        setEditForm({
                          ...editForm,
                          features: {
                            ...editForm.features,
                            pipelines_limit: parseInt(e.target.value, 10) || 1,
                          },
                        })
                      }
                      className="w-full px-2.5 py-1.5 border border-slate-300 rounded-md text-xs"
                    />
                  </div>
                </div>
              </div>

              {/* Feature Flags */}
              <div className="pt-4 border-t border-slate-100">
                <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-3">
                  Premium Feature Flags
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <label className="flex items-center gap-2 p-2.5 rounded-lg border border-slate-200 hover:bg-slate-50 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={Boolean(editForm.features?.advanced_reports)}
                      onChange={(e) =>
                        setEditForm({
                          ...editForm,
                          features: {
                            ...editForm.features,
                            advanced_reports: e.target.checked,
                          },
                        })
                      }
                      className="rounded text-indigo-600"
                    />
                    <span className="text-xs font-medium text-slate-800">Advanced Analytics & Reports</span>
                  </label>

                  <label className="flex items-center gap-2 p-2.5 rounded-lg border border-slate-200 hover:bg-slate-50 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={Boolean(editForm.features?.export)}
                      onChange={(e) =>
                        setEditForm({
                          ...editForm,
                          features: {
                            ...editForm.features,
                            export: e.target.checked,
                          },
                        })
                      }
                      className="rounded text-indigo-600"
                    />
                    <span className="text-xs font-medium text-slate-800">CSV & Data Exporting</span>
                  </label>

                  <label className="flex items-center gap-2 p-2.5 rounded-lg border border-slate-200 hover:bg-slate-50 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={Boolean(editForm.features?.api_access)}
                      onChange={(e) =>
                        setEditForm({
                          ...editForm,
                          features: {
                            ...editForm.features,
                            api_access: e.target.checked,
                          },
                        })
                      }
                      className="rounded text-indigo-600"
                    />
                    <span className="text-xs font-medium text-slate-800">REST API & Webhooks Access</span>
                  </label>

                  <label className="flex items-center gap-2 p-2.5 rounded-lg border border-slate-200 hover:bg-slate-50 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={Boolean(editForm.features?.ai_features)}
                      onChange={(e) =>
                        setEditForm({
                          ...editForm,
                          features: {
                            ...editForm.features,
                            ai_features: e.target.checked,
                          },
                        })
                      }
                      className="rounded text-indigo-600"
                    />
                    <span className="text-xs font-medium text-slate-800">AI Deal Scoring & Intelligence</span>
                  </label>
                </div>
              </div>

              {/* Modal Actions */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditingPlan(null)}
                  disabled={isPending}
                  className="px-4 py-2 border border-slate-300 text-slate-700 hover:bg-slate-50 rounded-lg text-sm font-medium transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="inline-flex items-center gap-2 px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-semibold transition-colors disabled:opacity-50"
                >
                  {isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                  <span>Save Changes</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DELETE CONFIRMATION MODAL */}
      {deletingPlan && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full border border-slate-200 p-6 space-y-4">
            <div className="w-12 h-12 rounded-full bg-red-100 text-red-600 flex items-center justify-center mx-auto">
              <Trash2 className="w-6 h-6" />
            </div>

            <div className="text-center space-y-1">
              <h3 className="text-lg font-bold text-slate-900">Delete Subscription Plan?</h3>
              <p className="text-xs text-slate-500">
                Are you sure you want to permanently remove <strong>{deletingPlan.name}</strong>? This action cannot be reversed.
              </p>
            </div>

            {deletingPlan.activeSubscriptionsCount > 0 && (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                <span>
                  Notice: <strong>{deletingPlan.activeSubscriptionsCount} organization(s)</strong> are currently subscribed to this tier. Deletion will be rejected by the server if active subscriptions exist.
                </span>
              </div>
            )}

            <div className="flex items-center justify-end gap-3 pt-3">
              <button
                type="button"
                onClick={() => setDeletingPlan(null)}
                disabled={isPending}
                className="px-4 py-2 border border-slate-300 text-slate-700 hover:bg-slate-50 rounded-lg text-sm font-medium transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteConfirm}
                disabled={isPending}
                className="inline-flex items-center gap-2 px-5 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-semibold transition-colors disabled:opacity-50"
              >
                {isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                <span>Delete Plan</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

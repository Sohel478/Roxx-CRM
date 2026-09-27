import { Layers, CheckCircle2, XCircle, Users, Sparkles, Database, KeyRound, Download } from "lucide-react";
import { getSuperAdminPlansAction } from "@/actions/admin";

export const metadata = {
  title: "SaaS Plans & Pricing | Roxx CRM Super Admin",
};

export default async function SuperAdminPlansPage() {
  const res = await getSuperAdminPlansAction();
  const plans = res.data || [];

  return (
    <div className="space-y-6">
      {/* Title */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
          <Layers className="w-6 h-6 text-indigo-600" />
          <span>Subscription Plans & Feature Flags</span>
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          Defined SaaS pricing tiers, resource constraints, and premium feature entitlements.
        </p>
      </div>

      {/* Plans Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {plans.map((plan) => {
          const isEnterprise = plan.slug === "enterprise";
          return (
            <div
              key={plan.id}
              className={`bg-white rounded-xl border flex flex-col justify-between shadow-sm overflow-hidden ${
                isEnterprise
                  ? "border-purple-300 ring-2 ring-purple-100"
                  : "border-slate-200"
              }`}
            >
              {/* Header */}
              <div className="p-6 border-b border-slate-100">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-bold text-slate-900">{plan.name}</h2>
                  {plan.isPublic && (
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                      PUBLIC
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-500 mt-1 min-h-[32px]">{plan.description}</p>

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
                    {plan.activeSubscriptionsCount} orgs
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

              {/* Card Footer */}
              <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-xs">
                <span className="text-slate-500 font-mono text-[11px]">{plan.slug}</span>
                <span className="text-emerald-700 font-semibold flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span> Active
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

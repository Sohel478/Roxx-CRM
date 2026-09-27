import { Layers } from "lucide-react";
import { getSuperAdminPlansAction } from "@/actions/admin";
import { PlansManager } from "@/components/admin/plans-manager";

export const metadata = {
  title: "SaaS Plans & Pricing | Roxx CRM Super Admin",
  description: "Create, configure, and manage SaaS subscription plans, quotas, and feature flags.",
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
          <span>Subscription Plans & Feature Management</span>
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          Create, edit, or retire SaaS pricing tiers. Configure user seats, lead capacity, pipeline limits, and premium capabilities.
        </p>
      </div>

      {/* Interactive Plans Manager (Create, Edit, Delete) */}
      <PlansManager initialPlans={plans} />
    </div>
  );
}

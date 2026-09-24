"use client";

import { useState } from "react";
import {
  CreditCard,
  CheckCircle2,
  Sparkles,
  Clock,
  Users,
  MessageSquare,
  Mail,
  AlertTriangle,
  ArrowRight,
  ShieldCheck,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";

interface BillingTabProps {
  seatUsage?: {
    usedSeats: number;
    maxSeats: number;
    plan: string;
    status: string;
    trialEndsAt: string | null;
    subscriptionEndsAt: string | null;
    organizationName: string;
    isSuperAdmin: boolean;
  } | null;
  onRefresh?: () => void;
}

export function BillingTab({ seatUsage }: BillingTabProps) {
  const [isUpgradeModalOpen, setIsUpgradeModalOpen] = useState(false);
  const [selectedPlanForUpgrade, setSelectedPlanForUpgrade] = useState<string>("STARTER_20");

  const usedSeats = seatUsage?.usedSeats ?? 1;
  const maxSeats = seatUsage?.maxSeats ?? 20;
  const plan = seatUsage?.plan ?? "FREE_TRIAL";
  const status = seatUsage?.status ?? "TRIAL";
  const orgName = seatUsage?.organizationName ?? "Your Company";

  // Calculate days remaining
  const targetDateStr = status === "TRIAL" ? seatUsage?.trialEndsAt : seatUsage?.subscriptionEndsAt;
  let daysRemaining = 30;
  if (targetDateStr) {
    const diffMs = new Date(targetDateStr).getTime() - Date.now();
    daysRemaining = Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
  }

  const percentUsed = Math.min(100, Math.round((usedSeats / maxSeats) * 100));

  const planTitles: Record<string, string> = {
    FREE_TRIAL: "30-Day Free Trial",
    STARTER_20: "Starter Team Plan (Up to 20 Seats)",
    GROWTH_50: "Growth Team Plan (21-50 Seats)",
    ENTERPRISE: "Enterprise Custom Plan (50+ Seats)",
  };

  const currentPlanTitle = planTitles[plan] || "Free Trial";

  const handleOpenUpgrade = (planKey: string) => {
    setSelectedPlanForUpgrade(planKey);
    setIsUpgradeModalOpen(true);
  };

  const whatsappMessage = encodeURIComponent(
    `Hello Roxx CRM Support team, I would like to upgrade / renew our subscription.\n\nCompany: ${orgName}\nCurrent Plan: ${currentPlanTitle}\nSelected Plan: ${planTitles[selectedPlanForUpgrade] || selectedPlanForUpgrade}\nSeats Needed: ${maxSeats}`
  );

  return (
    <div className="space-y-6">
      {/* Current Subscription Card */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 pb-6 border-b border-slate-100">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Current Subscription
              </span>
              <span
                className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold ${
                  status === "ACTIVE"
                    ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                    : status === "TRIAL"
                    ? "bg-blue-50 text-blue-700 border border-blue-200"
                    : "bg-amber-50 text-amber-700 border border-amber-200"
                }`}
              >
                {status === "TRIAL" ? "Trial Active" : status === "ACTIVE" ? "Subscribed" : "Action Needed"}
              </span>
            </div>
            <h2 className="text-xl font-bold text-slate-900">{currentPlanTitle}</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Workspace registered for <strong className="text-slate-700">{orgName}</strong>
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Button
              type="button"
              onClick={() => handleOpenUpgrade("STARTER_20")}
              className="bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs h-9 px-4 gap-1.5 shadow-xs"
            >
              <Zap className="w-3.5 h-3.5 fill-white" />
              <span>Upgrade / Renew Plan</span>
            </Button>
          </div>
        </div>

        {/* Usage & Timeline Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-6">
          {/* Seat Quota Meter */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-slate-700 flex items-center gap-1.5">
                <Users className="w-4 h-4 text-slate-500" />
                <span>Team Seats Utilization</span>
              </span>
              <span className="font-bold text-slate-900">
                {usedSeats} / {maxSeats} Seats ({percentUsed}%)
              </span>
            </div>
            <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  percentUsed >= 90
                    ? "bg-red-500"
                    : percentUsed >= 75
                    ? "bg-amber-500"
                    : "bg-blue-600"
                }`}
                style={{ width: `${percentUsed}%` }}
              />
            </div>
            <p className="text-[11px] text-slate-400">
              {maxSeats - usedSeats > 0
                ? `${maxSeats - usedSeats} seats remaining before limit is reached.`
                : "Seat limit reached. Upgrade to invite additional sales reps."}
            </p>
          </div>

          {/* Trial / Renewal Countdown */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-slate-700 flex items-center gap-1.5">
                <Clock className="w-4 h-4 text-slate-500" />
                <span>{status === "TRIAL" ? "Trial Period Duration" : "Billing Cycle"}</span>
              </span>
              <span
                className={`font-bold ${
                  daysRemaining <= 5 ? "text-red-600 font-extrabold" : "text-slate-900"
                }`}
              >
                {daysRemaining} {daysRemaining === 1 ? "Day" : "Days"} Remaining
              </span>
            </div>
            <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200/60 text-xs flex items-center justify-between">
              <span className="text-slate-600 text-[11px]">
                {status === "TRIAL" ? "Full 30-day Free Trial included" : "Offline verified subscription"}
              </span>
              <span className="text-[11px] font-mono text-slate-500 font-medium">
                {targetDateStr ? new Date(targetDateStr).toLocaleDateString() : "Active"}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Pricing Tiers Comparison */}
      <div>
        <div className="mb-4">
          <h3 className="text-base font-bold text-slate-900">Available Subscription Plans</h3>
          <p className="text-xs text-slate-500">
            Simple, honest pricing with seat allotments designed for sales teams of all sizes.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {/* Tier 1: Starter */}
          <div
            className={`bg-white rounded-2xl border p-5 flex flex-col justify-between transition-all ${
              plan === "STARTER_20"
                ? "border-blue-500 shadow-md ring-2 ring-blue-500/20"
                : "border-slate-200 shadow-xs hover:border-slate-300"
            }`}
          >
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-blue-600 uppercase tracking-wider">
                  Starter Team
                </span>
                {plan === "STARTER_20" && (
                  <span className="text-[10px] font-bold bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">
                    Current Plan
                  </span>
                )}
              </div>
              <div className="mb-3">
                <span className="text-3xl font-extrabold text-slate-900">₹250</span>
                <span className="text-xs text-slate-500 font-medium ml-1">/ month</span>
              </div>
              <p className="text-xs text-slate-500 mb-4">
                Ideal for growing agencies and startups with up to 20 sales representatives.
              </p>

              <div className="space-y-2.5 text-xs text-slate-700 border-t border-slate-100 pt-4">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span><strong>Up to 20 Seats</strong> included</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>Unlimited Leads, Companies &amp; Contacts</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>Visual Pipeline &amp; Kanban Deal Board</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>Task Reminders &amp; Activity Logging</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>Standard CSV Imports &amp; Exports</span>
                </div>
              </div>
            </div>

            <div className="pt-6">
              <Button
                type="button"
                variant={plan === "STARTER_20" ? "outline" : "default"}
                onClick={() => handleOpenUpgrade("STARTER_20")}
                className="w-full text-xs font-semibold"
              >
                {plan === "STARTER_20" ? "Renew Starter Plan" : "Choose Starter (20 Seats)"}
              </Button>
            </div>
          </div>

          {/* Tier 2: Growth */}
          <div
            className={`bg-white rounded-2xl border p-5 flex flex-col justify-between transition-all relative ${
              plan === "GROWTH_50"
                ? "border-purple-500 shadow-md ring-2 ring-purple-500/20"
                : "border-purple-200 shadow-xs hover:border-purple-300"
            }`}
          >
            <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-purple-600 text-white text-[10px] font-bold px-3 py-0.5 rounded-full uppercase tracking-wider shadow-xs">
              Popular for Teams
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-purple-600 uppercase tracking-wider">
                  Growth Team
                </span>
                {plan === "GROWTH_50" && (
                  <span className="text-[10px] font-bold bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full">
                    Current Plan
                  </span>
                )}
              </div>
              <div className="mb-3">
                <span className="text-3xl font-extrabold text-slate-900">₹450</span>
                <span className="text-xs text-slate-500 font-medium ml-1">/ month</span>
              </div>
              <p className="text-xs text-slate-500 mb-4">
                Designed for scaling sales divisions needing 21 to 50 active team member accounts.
              </p>

              <div className="space-y-2.5 text-xs text-slate-700 border-t border-slate-100 pt-4">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-purple-600 shrink-0" />
                  <span><strong>Up to 50 Seats</strong> included</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-purple-600 shrink-0" />
                  <span>Everything in Starter Plan</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-purple-600 shrink-0" />
                  <span>Advanced Audit Trail &amp; Access History</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-purple-600 shrink-0" />
                  <span>Multi-stage Pipeline Customization</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-purple-600 shrink-0" />
                  <span>Priority WhatsApp Onboarding Support</span>
                </div>
              </div>
            </div>

            <div className="pt-6">
              <Button
                type="button"
                onClick={() => handleOpenUpgrade("GROWTH_50")}
                className="w-full bg-purple-600 hover:bg-purple-700 text-white text-xs font-semibold"
              >
                {plan === "GROWTH_50" ? "Renew Growth Plan" : "Choose Growth (50 Seats)"}
              </Button>
            </div>
          </div>

          {/* Tier 3: Enterprise */}
          <div
            className={`bg-white rounded-2xl border p-5 flex flex-col justify-between transition-all ${
              plan === "ENTERPRISE"
                ? "border-amber-500 shadow-md ring-2 ring-amber-500/20"
                : "border-slate-200 shadow-xs hover:border-slate-300"
            }`}
          >
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-amber-600 uppercase tracking-wider">
                  Enterprise
                </span>
                {plan === "ENTERPRISE" && (
                  <span className="text-[10px] font-bold bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">
                    Current Plan
                  </span>
                )}
              </div>
              <div className="mb-3">
                <span className="text-3xl font-extrabold text-slate-900">Custom</span>
              </div>
              <p className="text-xs text-slate-500 mb-4">
                For organizations with 50+ sales reps requiring customized SLA and tailored setups.
              </p>

              <div className="space-y-2.5 text-xs text-slate-700 border-t border-slate-100 pt-4">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-amber-600 shrink-0" />
                  <span><strong>50+ Unlimited Seats</strong></span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-amber-600 shrink-0" />
                  <span>Dedicated CRM Architecture Consultant</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-amber-600 shrink-0" />
                  <span>Custom Integration &amp; Webhooks</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-amber-600 shrink-0" />
                  <span>Guaranteed 99.9% Uptime SLA</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-amber-600 shrink-0" />
                  <span>Direct phone &amp; executive escalation</span>
                </div>
              </div>
            </div>

            <div className="pt-6">
              <Button
                type="button"
                variant="outline"
                onClick={() => handleOpenUpgrade("ENTERPRISE")}
                className="w-full text-xs font-semibold"
              >
                Contact Enterprise Sales
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Upgrade / Contact Sales Modal */}
      <Modal
        isOpen={isUpgradeModalOpen}
        onClose={() => setIsUpgradeModalOpen(false)}
        title="Upgrade or Renew Your Plan"
        description="Direct subscription activation via the Roxx CRM admin team."
        maxWidth="md"
      >
        <div className="space-y-4 pt-2">
          <div className="p-3.5 bg-blue-50 border border-blue-200 rounded-xl text-xs text-blue-800 space-y-1">
            <p className="font-bold flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-blue-600" />
              <span>Offline Direct Payment &amp; Instant Super Admin Activation</span>
            </p>
            <p className="text-[11px] text-blue-700 leading-relaxed">
              We process subscription payments directly without intermediary gateway charges. Once payment is received via UPI, Bank Transfer, or Card, your plan and seats will be updated immediately.
            </p>
          </div>

          <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 text-xs space-y-1.5">
            <div className="flex justify-between">
              <span className="text-slate-500">Organization:</span>
              <span className="font-semibold text-slate-800">{orgName}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Target Plan:</span>
              <span className="font-bold text-blue-600">
                {planTitles[selectedPlanForUpgrade] || selectedPlanForUpgrade}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Included Seats:</span>
              <span className="font-semibold text-slate-800">
                {selectedPlanForUpgrade === "GROWTH_50" ? "50 Seats" : selectedPlanForUpgrade === "ENTERPRISE" ? "50+ Seats" : "20 Seats"}
              </span>
            </div>
          </div>

          <div className="space-y-2.5 pt-2">
            <a
              href={`https://wa.me/?text=${whatsappMessage}`}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold shadow-xs transition-colors"
            >
              <MessageSquare className="w-4 h-4 fill-white" />
              <span>Connect on WhatsApp for Instant Activation</span>
            </a>

            <a
              href={`mailto:support@roxx-crm.com?subject=${encodeURIComponent(`Subscription Request for ${orgName}`)}&body=${whatsappMessage}`}
              className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 rounded-lg text-xs font-semibold transition-colors"
            >
              <Mail className="w-4 h-4 text-slate-500" />
              <span>Send Request via Email</span>
            </a>
          </div>
        </div>
      </Modal>
    </div>
  );
}

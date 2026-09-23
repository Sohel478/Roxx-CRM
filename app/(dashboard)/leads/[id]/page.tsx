"use client";

import { useEffect, useState, useCallback, useTransition } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  Mail,
  Phone,
  ArrowLeft,
  Flame,
  Zap,
  Snowflake,
  Clock,
  Building2,
  User,
  Kanban,
  CheckCircle2,
  Sparkles,
} from "lucide-react";
import { getLeadByIdAction, updateLeadStatusAction } from "@/actions/leads";
import { getActivitiesAction } from "@/actions/activities";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConvertLeadModal } from "@/features/leads/components/convert-lead-modal";
import { ActivityTimeline } from "@/features/activities/components/activity-timeline";
import { ActivityModal } from "@/features/activities/components/activity-modal";
import { ActivityItem, ActivityType } from "@/lib/validations/activities";

interface LeadDetailData {
  id: string;
  leadNumber: string;
  firstName: string;
  lastName?: string | null;
  fullName: string;
  email?: string | null;
  phone?: string | null;
  companyName?: string | null;
  jobTitle?: string | null;
  source: string;
  status: string;
  rating: string;
  estimatedValue: number;
  currency: string;
  description?: string | null;
  createdAt: string;
  owner?: { id: string; name: string } | null;
  ownerName?: string | null;
  convertedAt?: string | null;
  convertedCompanyId?: string | null;
  convertedContactId?: string | null;
  convertedOpportunityId?: string | null;
  convertedInfo?: {
    companyId?: string | null;
    companyName?: string | null;
    contactId?: string | null;
    contactName?: string | null;
    opportunityId?: string | null;
    opportunityName?: string | null;
    opportunityAmount?: number | null;
  } | null;
}

export default function LeadDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params?.id as string;
  const [lead, setLead] = useState<LeadDetailData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isPending, startTransition] = useTransition();
  const [isConvertModalOpen, setIsConvertModalOpen] = useState(false);
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [isActivityModalOpen, setIsActivityModalOpen] = useState(false);
  const [activityDefaultType, setActivityDefaultType] = useState<ActivityType>("CALL");

  const loadLead = useCallback(async () => {
    if (!id) return;
    const [res, actRes] = await Promise.all([
      getLeadByIdAction(id),
      getActivitiesAction({ leadId: id }),
    ]);

    if (res.success && res.data) {
      setLead(res.data as unknown as LeadDetailData);
    }
    if (actRes.success && actRes.data) {
      setActivities(actRes.data.items);
    }
    setIsLoading(false);
  }, [id]);

  useEffect(() => {
    loadLead();
  }, [loadLead]);

  const handleStatusChange = (newStatus: string) => {
    startTransition(async () => {
      await updateLeadStatusAction(id, newStatus);
      await loadLead();
    });
  };

  if (isLoading) {
    return (
      <div className="py-20 text-center text-slate-400">
        <p className="text-sm font-semibold">Loading lead details...</p>
      </div>
    );
  }

  if (!lead) {
    return (
      <div className="py-20 text-center space-y-3">
        <p className="text-base font-bold text-slate-800">Lead Not Found</p>
        <Button variant="outline" onClick={() => router.push("/leads")}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Leads
        </Button>
      </div>
    );
  }

  const isConverted = lead.status === "Converted" || Boolean(lead.convertedAt);

  const getRatingPill = (rating: string) => {
    switch (rating) {
      case "Hot":
        return (
          <span className="inline-flex items-center gap-1 text-xs font-bold text-red-600 bg-red-50 px-2.5 py-1 rounded-full border border-red-200">
            <Flame className="w-3.5 h-3.5 text-red-500 fill-red-500" /> Hot Lead
          </span>
        );
      case "Warm":
        return (
          <span className="inline-flex items-center gap-1 text-xs font-bold text-amber-600 bg-amber-50 px-2.5 py-1 rounded-full border border-amber-200">
            <Zap className="w-3.5 h-3.5 text-amber-500 fill-amber-500" /> Warm Lead
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 text-xs font-bold text-blue-600 bg-blue-50 px-2.5 py-1 rounded-full border border-blue-200">
            <Snowflake className="w-3.5 h-3.5 text-blue-500" /> Cold Lead
          </span>
        );
    }
  };

  const statuses = ["New", "Contacted", "Qualified", "Unqualified", "Nurture", "Lost"];

  return (
    <div className="space-y-6">
      {/* Back button */}
      <div>
        <Link
          href="/leads"
          className="inline-flex items-center text-xs font-semibold text-slate-500 hover:text-slate-800 transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5 mr-1" />
          Back to all leads
        </Link>
      </div>

      {/* Lead Profile Header */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex items-start gap-4">
          <div className="w-14 h-14 rounded-2xl bg-blue-600 text-white flex items-center justify-center text-xl font-bold shadow-md shadow-blue-500/20 shrink-0">
            {lead.firstName.slice(0, 1)}
            {lead.lastName ? lead.lastName.slice(0, 1) : ""}
          </div>
          <div className="space-y-1">
            <div className="flex items-center gap-2.5 flex-wrap">
              <h1 className="text-2xl font-bold tracking-tight text-slate-900">{lead.fullName}</h1>
              <span className="text-xs font-mono font-semibold bg-slate-100 text-slate-700 px-2 py-0.5 rounded">
                {lead.leadNumber}
              </span>
              <Badge
                variant={
                  isConverted ? "success" : lead.status === "Qualified" ? "success" : "info"
                }
              >
                {lead.status}
              </Badge>
              {getRatingPill(lead.rating)}
            </div>
            <p className="text-xs text-slate-500 font-medium">
              {lead.jobTitle ? `${lead.jobTitle} at ` : ""}
              <span className="font-semibold text-slate-700">{lead.companyName || "Independent"}</span> &bull;
              Source: <span className="font-semibold text-slate-700">{lead.source}</span>
            </p>
          </div>
        </div>

        {/* Action button */}
        <div className="flex items-center gap-2">
          {isConverted ? (
            <span className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 shadow-2xs">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span>Lead Converted</span>
            </span>
          ) : (
            <Button
              type="button"
              className="bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm flex items-center gap-1.5"
              onClick={() => setIsConvertModalOpen(true)}
            >
              <Sparkles className="w-4 h-4 mr-0.5 text-emerald-200" />
              <span>Convert Lead</span>
            </Button>
          )}
        </div>
      </div>

      {/* Prominent Lead Converted Banner */}
      {isConverted && (
        <div className="bg-emerald-50/80 border border-emerald-200 rounded-2xl p-5 shadow-xs animate-in fade-in duration-200 space-y-3">
          <div className="flex items-center justify-between flex-wrap gap-2 border-b border-emerald-200/60 pb-3">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-emerald-600 text-white flex items-center justify-center shadow-xs">
                <CheckCircle2 className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-emerald-950">
                  Lead Successfully Converted
                </h2>
                <p className="text-xs text-emerald-700">
                  {lead.convertedAt
                    ? `Converted into customer account on ${new Date(
                        lead.convertedAt
                      ).toLocaleDateString(undefined, {
                        month: "long",
                        day: "numeric",
                        year: "numeric",
                      })}`
                    : "Converted into permanent customer records"}
                </p>
              </div>
            </div>
            <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-800 bg-white px-2.5 py-1 rounded-full border border-emerald-200 shadow-2xs">
              Active Customer Account
            </span>
          </div>

          {/* Resulting Entity Links Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
            {lead.convertedCompanyId ? (
              <Link
                href={`/companies/${lead.convertedCompanyId}`}
                className="bg-white border border-emerald-200/80 hover:border-emerald-400 p-3 rounded-xl transition-all shadow-2xs group flex items-center gap-3"
              >
                <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center shrink-0 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                  <Building2 className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                    Company Account
                  </span>
                  <span className="text-xs font-bold text-slate-800 group-hover:text-blue-600 truncate block">
                    {lead.convertedInfo?.companyName || lead.companyName || "View Company"}
                  </span>
                </div>
              </Link>
            ) : null}

            {lead.convertedContactId ? (
              <Link
                href={`/contacts/${lead.convertedContactId}`}
                className="bg-white border border-emerald-200/80 hover:border-emerald-400 p-3 rounded-xl transition-all shadow-2xs group flex items-center gap-3"
              >
                <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0 group-hover:bg-emerald-600 group-hover:text-white transition-colors">
                  <User className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                    Primary Contact
                  </span>
                  <span className="text-xs font-bold text-slate-800 group-hover:text-emerald-600 truncate block">
                    {lead.convertedInfo?.contactName || lead.fullName || "View Contact"}
                  </span>
                </div>
              </Link>
            ) : null}

            {lead.convertedOpportunityId ? (
              <Link
                href="/opportunities"
                className="bg-white border border-emerald-200/80 hover:border-emerald-400 p-3 rounded-xl transition-all shadow-2xs group flex items-center gap-3"
              >
                <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center shrink-0 group-hover:bg-amber-600 group-hover:text-white transition-colors">
                  <Kanban className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                    Sales Opportunity
                  </span>
                  <span className="text-xs font-bold text-slate-800 group-hover:text-amber-600 truncate block">
                    {lead.convertedInfo?.opportunityName || "Active Deal"}{" "}
                    {lead.convertedInfo?.opportunityAmount
                      ? `($${lead.convertedInfo.opportunityAmount.toLocaleString()})`
                      : ""}
                  </span>
                </div>
              </Link>
            ) : null}
          </div>
        </div>
      )}

      {/* Stage Progression Bar */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs">
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2.5">
          Lifecycle Progression
        </p>
        <div className="flex flex-wrap items-center gap-2">
          {statuses.map((s) => {
            const isCurrent = lead.status === s;
            return (
              <button
                key={s}
                type="button"
                disabled={isPending || isCurrent || isConverted}
                onClick={() => handleStatusChange(s)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  isCurrent
                    ? "bg-blue-600 text-white shadow-xs cursor-default"
                    : isConverted
                    ? "bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed opacity-60"
                    : "bg-slate-50 text-slate-600 hover:bg-blue-50 hover:text-blue-700 border border-slate-200"
                }`}
              >
                {s}
              </button>
            );
          })}
          {isConverted && (
            <span className="px-3 py-1.5 rounded-lg text-xs font-bold bg-emerald-600 text-white shadow-xs">
              Converted
            </span>
          )}
        </div>
      </div>

      {/* Grid: Lead Details & Timeline */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Deal Value & Contact Info */}
        <div className="space-y-6">
          {/* Estimated Value Card */}
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">
              Estimated Deal Value
            </span>
            <div className="mt-2 flex items-baseline gap-1">
              <span className="text-3xl font-extrabold text-slate-900 tracking-tight">
                {lead.estimatedValue > 0 ? `$${lead.estimatedValue.toLocaleString()}` : "$0"}
              </span>
              <span className="text-xs text-slate-400 font-medium">USD</span>
            </div>
            <p className="text-[11px] text-slate-500 mt-1">
              Assigned to: <span className="font-semibold text-slate-700">{lead.owner?.name || lead.ownerName || "Unassigned"}</span>
            </p>
          </div>

          {/* Contact Details */}
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs space-y-3">
            <h2 className="text-sm font-bold text-slate-900 border-b border-slate-100 pb-2">
              Contact Channels
            </h2>
            <div className="space-y-2.5 text-xs">
              <div>
                <span className="text-slate-400 block font-medium">Email Address</span>
                {lead.email ? (
                  <a
                    href={`mailto:${lead.email}`}
                    className="text-blue-600 hover:underline font-semibold flex items-center gap-1.5 mt-0.5"
                  >
                    <Mail className="w-3.5 h-3.5 text-slate-400" />
                    <span>{lead.email}</span>
                  </a>
                ) : (
                  <span className="text-slate-400 italic">No email provided</span>
                )}
              </div>

              <div>
                <span className="text-slate-400 block font-medium">Phone Number</span>
                {lead.phone ? (
                  <a
                    href={`tel:${lead.phone}`}
                    className="text-slate-800 hover:text-blue-600 font-semibold flex items-center gap-1.5 mt-0.5"
                  >
                    <Phone className="w-3.5 h-3.5 text-slate-400" />
                    <span>{lead.phone}</span>
                  </a>
                ) : (
                  <span className="text-slate-400 italic">No phone provided</span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Context & Interaction History */}
        <div className="lg:col-span-2 space-y-6">
          {/* Notes & Description */}
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs space-y-3">
            <h2 className="text-sm font-bold text-slate-900 border-b border-slate-100 pb-2">
              Discovery Notes &amp; Context
            </h2>
            <div className="text-xs text-slate-600 leading-relaxed bg-slate-50/75 p-3.5 rounded-lg border border-slate-100">
              {lead.description || "No discovery notes recorded yet for this lead."}
            </div>
          </div>

          {/* Lead Activity Timeline */}
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-blue-600" />
                <h2 className="text-sm font-bold text-slate-900">Lead Interaction Timeline</h2>
              </div>
              <Button
                size="sm"
                variant="outline"
                className="text-xs h-7 gap-1"
                onClick={() => {
                  setActivityDefaultType("CALL");
                  setIsActivityModalOpen(true);
                }}
              >
                <span>+ Log Touchpoint</span>
              </Button>
            </div>

            <ActivityTimeline
              activities={activities}
              onOpenLogModal={(type) => {
                if (type) setActivityDefaultType(type);
                setIsActivityModalOpen(true);
              }}
              onRefresh={loadLead}
              showFilters={false}
            />
          </div>
        </div>
      </div>

      {/* Activity Log Modal */}
      <ActivityModal
        isOpen={isActivityModalOpen}
        onClose={() => setIsActivityModalOpen(false)}
        onSuccess={loadLead}
        defaultType={activityDefaultType}
        defaultLeadId={lead.id}
      />

      {/* Convert Lead Modal */}
      <ConvertLeadModal
        isOpen={isConvertModalOpen}
        onClose={() => setIsConvertModalOpen(false)}
        lead={lead}
        onSuccess={async () => {
          await loadLead();
        }}
      />
    </div>
  );
}

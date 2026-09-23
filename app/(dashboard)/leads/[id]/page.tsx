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
  ArrowRight,
} from "lucide-react";
import { getLeadByIdAction, updateLeadStatusAction } from "@/actions/leads";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

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
}

export default function LeadDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params?.id as string;
  const [lead, setLead] = useState<LeadDetailData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isPending, startTransition] = useTransition();

  const loadLead = useCallback(async () => {
    if (!id) return;
    const res = await getLeadByIdAction(id);
    if (res.success && res.data) {
      setLead(res.data as unknown as LeadDetailData);
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
              <Badge variant={lead.status === "Qualified" ? "success" : "info"}>{lead.status}</Badge>
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
          <Button
            type="button"
            className="bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm"
            onClick={() => {
              alert(
                `Phase 5 Preview: Lead Conversion for "${lead.fullName}" will create a Company, Contact, and Opportunity in a single atomic transaction.`
              );
            }}
          >
            <ArrowRight className="w-4 h-4 mr-1.5" />
            <span>Convert Lead</span>
          </Button>
        </div>
      </div>

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
                disabled={isPending || isCurrent}
                onClick={() => handleStatusChange(s)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  isCurrent
                    ? "bg-blue-600 text-white shadow-xs cursor-default"
                    : "bg-slate-50 text-slate-600 hover:bg-blue-50 hover:text-blue-700 border border-slate-200"
                }`}
              >
                {s}
              </button>
            );
          })}
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

          {/* Activity Timeline Placeholder */}
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-blue-600" />
                <h2 className="text-sm font-bold text-slate-900">Lead Interaction Timeline</h2>
              </div>
              <span className="text-xs text-slate-400">Activities active in Phase 7</span>
            </div>
            <div className="space-y-3 py-2">
              <div className="flex items-start gap-3 text-xs">
                <div className="w-2 h-2 rounded-full bg-blue-600 mt-1.5 shrink-0" />
                <div>
                  <p className="font-semibold text-slate-900">Lead created and entered as {lead.status}</p>
                  <p className="text-[11px] text-slate-400">{new Date(lead.createdAt).toLocaleString()}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

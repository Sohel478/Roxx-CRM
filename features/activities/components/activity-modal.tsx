"use client";

import { useState, useEffect, useTransition } from "react";
import {
  Phone,
  Mail,
  Calendar,
  MessageSquare,
  FileText,
  Clock,
  AlertCircle,
  Activity,
} from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { logActivityAction } from "@/actions/activities";
import { getCompaniesAction, CompanyItem } from "@/actions/companies";
import { getOpportunitiesAction, OpportunityItem } from "@/actions/opportunities";
import { getLeadsAction, LeadItem } from "@/actions/leads";
import {
  ACTIVITY_TYPES,
  ActivityType,
} from "@/lib/validations/activities";

interface ActivityModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  defaultType?: ActivityType;
  defaultLeadId?: string;
  defaultCompanyId?: string;
  defaultOpportunityId?: string;
}

const COMMON_OUTCOMES = [
  "Connected & Discussed",
  "Left Voicemail",
  "No Answer",
  "Demo Scheduled",
  "Proposal Sent",
  "Follow-up Required",
  "Gatekeeper Blocked",
];

export function ActivityModal({
  isOpen,
  onClose,
  onSuccess,
  defaultType = "CALL",
  defaultLeadId,
  defaultCompanyId,
  defaultOpportunityId,
}: ActivityModalProps) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [companies, setCompanies] = useState<CompanyItem[]>([]);
  const [opportunities, setOpportunities] = useState<OpportunityItem[]>([]);
  const [leads, setLeads] = useState<LeadItem[]>([]);
  const [isLoadingRelated, setIsLoadingRelated] = useState(false);

  const [type, setType] = useState<ActivityType>(defaultType);
  const [subject, setSubject] = useState("");
  const [activityAt, setActivityAt] = useState("");
  const [durationMinutes, setDurationMinutes] = useState<number>(15);
  const [outcome, setOutcome] = useState("Connected & Discussed");
  const [description, setDescription] = useState("");
  const [companyId, setCompanyId] = useState("");
  const [opportunityId, setOpportunityId] = useState("");
  const [leadId, setLeadId] = useState("");

  useEffect(() => {
    if (!isOpen) return;

    setError(null);
    setType(defaultType);
    setSubject("");
    setOutcome("Connected & Discussed");
    setDurationMinutes(defaultType === "NOTE" ? 0 : 15);
    setDescription("");
    setCompanyId(defaultCompanyId || "");
    setOpportunityId(defaultOpportunityId || "");
    setLeadId(defaultLeadId || "");

    const now = new Date();
    // Format YYYY-MM-DDTHH:mm
    const localIso = new Date(now.getTime() - now.getTimezoneOffset() * 60000)
      .toISOString()
      .slice(0, 16);
    setActivityAt(localIso);

    setIsLoadingRelated(true);
    Promise.all([
      getCompaniesAction({ limit: 100 }),
      getOpportunitiesAction(),
      getLeadsAction({ limit: 100 }),
    ])
      .then(([compRes, oppRes, leadRes]) => {
        if (compRes.success && compRes.data) {
          setCompanies(compRes.data.items);
        }
        if (oppRes.success && oppRes.data) {
          setOpportunities(oppRes.data.items);
        }
        if (leadRes.success && leadRes.data) {
          setLeads(leadRes.data.items);
        }
      })
      .catch((err) => console.error("Error loading activity relations:", err))
      .finally(() => setIsLoadingRelated(false));
  }, [isOpen, defaultType, defaultCompanyId, defaultOpportunityId, defaultLeadId]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!subject.trim()) {
      setError("Subject is required");
      return;
    }

    setError(null);
    startTransition(async () => {
      try {
        const res = await logActivityAction({
          type,
          subject: subject.trim(),
          activityAt: activityAt ? new Date(activityAt).toISOString() : new Date().toISOString(),
          durationMinutes: type === "NOTE" ? undefined : Number(durationMinutes) || 0,
          outcome: outcome.trim() || undefined,
          description: description.trim() || undefined,
          companyId: companyId || undefined,
          opportunityId: opportunityId || undefined,
          leadId: leadId || undefined,
        });

        if (!res.success) {
          setError(res.error || "Failed to log activity");
          return;
        }

        onSuccess();
        onClose();
      } catch (err: any) {
        setError(err.message || "An unexpected error occurred");
      }
    });
  };

  const getTypeIcon = (t: ActivityType) => {
    switch (t) {
      case "CALL":
        return <Phone className="w-4 h-4" />;
      case "EMAIL":
        return <Mail className="w-4 h-4" />;
      case "MEETING":
        return <Calendar className="w-4 h-4" />;
      case "WHATSAPP":
        return <MessageSquare className="w-4 h-4" />;
      case "NOTE":
        return <FileText className="w-4 h-4" />;
      default:
        return <Activity className="w-4 h-4" />;
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Log Sales Activity"
      description="Record client touches, calls, meetings, or internal deal notes."
      maxWidth="lg"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="flex items-center gap-2 p-3 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Activity Type Selection Buttons */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
            Interaction Type
          </label>
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
            {ACTIVITY_TYPES.map((t) => {
              const isSelected = type === t;
              return (
                <button
                  key={t}
                  type="button"
                  onClick={() => setType(t)}
                  className={`flex flex-col items-center justify-center p-2.5 rounded-lg border text-xs font-semibold gap-1.5 transition-all ${
                    isSelected
                      ? "bg-blue-600 border-blue-600 text-white shadow-xs"
                      : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50"
                  }`}
                >
                  {getTypeIcon(t)}
                  <span>{t}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Subject */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
            Subject / Headline *
          </label>
          <Input
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder={
              type === "CALL"
                ? "e.g. Discovery call on pipeline requirements"
                : type === "EMAIL"
                ? "e.g. Sent revised quote & SLA"
                : type === "MEETING"
                ? "e.g. In-person product demo with executive team"
                : "e.g. Client requested contract renewal terms"
            }
            required
            autoFocus
          />
        </div>

        {/* Date and Duration */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
              Date &amp; Time
            </label>
            <Input
              type="datetime-local"
              value={activityAt}
              onChange={(e) => setActivityAt(e.target.value)}
              required
            />
          </div>

          {type !== "NOTE" ? (
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                Duration (minutes)
              </label>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  min="0"
                  max="1440"
                  value={durationMinutes}
                  onChange={(e) => setDurationMinutes(Number(e.target.value))}
                  className="w-24"
                />
                <div className="flex items-center gap-1">
                  {[15, 30, 45, 60].map((mins) => (
                    <button
                      key={mins}
                      type="button"
                      onClick={() => setDurationMinutes(mins)}
                      className={`px-2 py-1 rounded text-xs border ${
                        durationMinutes === mins
                          ? "bg-slate-900 text-white border-slate-900"
                          : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                      }`}
                    >
                      {mins}m
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                Category
              </label>
              <span className="inline-flex items-center gap-1.5 h-10 px-3 text-xs bg-slate-100 text-slate-700 rounded-lg font-medium">
                <Clock className="w-3.5 h-3.5 text-slate-400" />
                Internal Team Note
              </span>
            </div>
          )}
        </div>

        {/* Outcome Preset & Custom */}
        {type !== "NOTE" && (
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
              Call / Meeting Outcome
            </label>
            <div className="space-y-2">
              <select
                value={outcome}
                onChange={(e) => setOutcome(e.target.value)}
                className="w-full h-10 px-3 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 transition-colors"
              >
                {COMMON_OUTCOMES.map((oc) => (
                  <option key={oc} value={oc}>
                    {oc}
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}

        {/* Association pickers */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">
              Relate to Lead
            </label>
            <select
              value={leadId}
              onChange={(e) => setLeadId(e.target.value)}
              disabled={isLoadingRelated}
              className="w-full h-9 px-2 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 transition-colors"
            >
              <option value="">None (General)</option>
              {leads.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.fullName} {l.companyName ? `(${l.companyName})` : ""}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">
              Relate to Opportunity
            </label>
            <select
              value={opportunityId}
              onChange={(e) => setOpportunityId(e.target.value)}
              disabled={isLoadingRelated}
              className="w-full h-9 px-2 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 transition-colors"
            >
              <option value="">None</option>
              {opportunities.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">
              Relate to Company
            </label>
            <select
              value={companyId}
              onChange={(e) => setCompanyId(e.target.value)}
              disabled={isLoadingRelated}
              className="w-full h-9 px-2 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 transition-colors"
            >
              <option value="">None</option>
              {companies.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Detailed Notes */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
            Notes &amp; Conversation Summary
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            placeholder="Record client responses, key discussion points, or next steps agreed upon..."
            className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent transition-colors resize-none"
          />
        </div>

        <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
          <Button type="button" variant="outline" onClick={onClose} disabled={isPending}>
            Cancel
          </Button>
          <Button type="submit" disabled={isPending}>
            {isPending ? "Logging..." : "Log Activity"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

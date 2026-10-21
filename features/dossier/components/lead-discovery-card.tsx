"use client";

import { useState, useTransition, useEffect } from "react";
import {
  Sparkles,
  RefreshCw,
  Copy,
  Check,
  ChevronDown,
  ChevronUp,
  Target,
  Lightbulb,
  Building2,
  HelpCircle,
  Quote,
  Key,
  Globe,
  Settings,
  CheckCircle2,
  AlertTriangle,
  Flame,
  Clock,
  ShieldAlert,
  MapPin,
  Calendar,
  Briefcase,
  Scale,
  CheckSquare,
  DollarSign,
  ExternalLink,
  ShieldCheck,
  Mail,
  Edit3,
  RotateCcw,
  Linkedin,
  Link2,
  AlertCircle,
  Edit2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  getLeadDiscoveryAction,
  generateLeadDiscoveryAction,
} from "@/actions/lead-discovery";
import { saveAiConfigAction, getAiConfigAction } from "@/actions/ai-email";
import { getCurrentUserAction } from "@/actions/auth";
import type { SessionUser } from "@/lib/auth/session";
import {
  type LeadDiscoveryData,
  type EvidenceStatus,
  type ConfidenceLevel,
  extractLeadResearchSources,
} from "@/lib/validations/lead-discovery";

interface LeadDiscoveryCardProps {
  leadId: string;
  leadName?: string;
  companyName?: string | null;
  website?: string | null;
  customerLinkedin?: string | null;
  companyLinkedin?: string | null;
  description?: string | null;
  onEditLead?: () => void;
  initialDiscovery?: LeadDiscoveryData | null;
  onDiscoveryGenerated?: (discovery: LeadDiscoveryData) => void;
  isAdmin?: boolean;
}

function EvidenceBadge({ status }: { status?: string | null }) {
  if (status === "Verified Fact") {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
        <CheckCircle2 className="w-3 h-3 text-emerald-600" />
        Verified Fact
      </span>
    );
  }
  if (status === "Reasonable Hypothesis") {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-sky-100 text-sky-800 border border-sky-300">
        <Lightbulb className="w-3 h-3 text-sky-600" />
        Reasonable Hypothesis
      </span>
    );
  }
  if (status === "Needs Client Confirmation") {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300">
        <HelpCircle className="w-3 h-3 text-amber-600" />
        Needs Confirmation
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-100 text-slate-700 border border-slate-300">
      Unverified
    </span>
  );
}

function ConfidenceBadge({ confidence }: { confidence?: string | null }) {
  const color =
    confidence === "High"
      ? "bg-emerald-50 text-emerald-700 border-emerald-200"
      : confidence === "Medium"
      ? "bg-blue-50 text-blue-700 border-blue-200"
      : "bg-slate-50 text-slate-600 border-slate-200";
  return (
    <span className={`px-1.5 py-0.5 rounded text-[9px] font-semibold border ${color}`}>
      {confidence || "Low"} Conf.
    </span>
  );
}

export function LeadDiscoveryCard({
  leadId,
  leadName,
  companyName,
  website,
  customerLinkedin,
  companyLinkedin,
  description: propsDescription,
  onEditLead,
  initialDiscovery,
  onDiscoveryGenerated,
  isAdmin: propsIsAdmin,
}: LeadDiscoveryCardProps) {
  const [currentUser, setCurrentUser] = useState<SessionUser | null>(null);

  useEffect(() => {
    getCurrentUserAction().then((u) => {
      if (u) setCurrentUser(u);
    });
  }, []);

  const roleUpper = currentUser?.role?.toUpperCase();
  const isCurrentUserAdmin =
    roleUpper === "ADMIN" ||
    roleUpper === "ADMINISTRATOR" ||
    Boolean(currentUser?.isSuperAdmin);

  const isAdmin = propsIsAdmin !== undefined ? propsIsAdmin : isCurrentUserAdmin;

  const [discovery, setDiscovery] = useState<LeadDiscoveryData | null>(
    initialDiscovery || null
  );
  const [isPending, startTransition] = useTransition();
  const [isExpanded, setIsExpanded] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Extract prospect research sources (Website, Personal LinkedIn, Company LinkedIn)
  const sources = extractLeadResearchSources({
    website,
    customerLinkedin,
    companyLinkedin,
    description: propsDescription,
  });
  const [isRubricExpanded, setIsRubricExpanded] = useState(false);
  const [isFollowUpsExpanded, setIsFollowUpsExpanded] = useState(false);
  const [isSourcesExpanded, setIsSourcesExpanded] = useState(false);
  const [copiedPitch, setCopiedPitch] = useState(false);
  const [copiedHook, setCopiedHook] = useState(false);
  const [copiedEmail, setCopiedEmail] = useState(false);
  const [copiedEmailSubject, setCopiedEmailSubject] = useState(false);
  const [copiedEmailBody, setCopiedEmailBody] = useState(false);
  const [isEditingDraft, setIsEditingDraft] = useState(false);
  const [draftSubject, setDraftSubject] = useState("");
  const [draftBody, setDraftBody] = useState("");
  const [hasLoaded, setHasLoaded] = useState(Boolean(initialDiscovery));
  const [isKeyModalOpen, setIsKeyModalOpen] = useState(false);
  const [openAiKeyInput, setOpenAiKeyInput] = useState("");
  const [isSavingKey, setIsSavingKey] = useState(false);
  const [keySaveMessage, setKeySaveMessage] = useState<string | null>(null);

  // Load discovery if not supplied via props
  useEffect(() => {
    if (!initialDiscovery && leadId) {
      getLeadDiscoveryAction(leadId).then((res) => {
        if (res.success && res.data) {
          setDiscovery(res.data);
        }
        setHasLoaded(true);
      });
    } else {
      setHasLoaded(true);
    }
  }, [leadId, initialDiscovery]);

  useEffect(() => {
    if (discovery?.outreachEmailDraft) {
      setDraftSubject(discovery.outreachEmailDraft.subject);
      setDraftBody(discovery.outreachEmailDraft.body);
    }
  }, [discovery]);

  const handleGenerateOrRefresh = (force = true) => {
    if (!sources.hasAnySource) {
      setErrorMessage(
        "Cannot generate discovery: Research source required. Please add a Website URL, Personal LinkedIn, or Company LinkedIn URL to this lead record."
      );
      return;
    }
    setErrorMessage(null);
    startTransition(async () => {
      const res = await generateLeadDiscoveryAction(leadId, {
        forceRefresh: force,
      });
      if (res.success && res.data) {
        setDiscovery(res.data);
        if (onDiscoveryGenerated) {
          onDiscoveryGenerated(res.data);
        }
      } else if (!res.success) {
        setErrorMessage(res.error || "Failed to generate client discovery.");
      }
    });
  };

  const handleSaveOpenAiKey = async () => {
    if (!isAdmin) {
      setKeySaveMessage("Forbidden: Only Administrators can configure AI keys.");
      return;
    }
    if (!openAiKeyInput.trim()) return;
    setIsSavingKey(true);
    setKeySaveMessage(null);
    try {
      const saveRes = await saveAiConfigAction({
        aiProvider: "openai",
        apiKey: openAiKeyInput.trim(),
        defaultFollowUpDays: 3,
        defaultPacingMinutes: 2,
      });
      if (saveRes.success) {
        setKeySaveMessage("OpenAI key saved successfully! Re-analyzing lead...");
        setTimeout(() => {
          setIsKeyModalOpen(false);
          setKeySaveMessage(null);
          handleGenerateOrRefresh(true);
        }, 1000);
      } else {
        setKeySaveMessage(saveRes.error || "Failed to save key");
      }
    } catch (err: any) {
      setKeySaveMessage(err?.message || "Error saving key");
    } finally {
      setIsSavingKey(false);
    }
  };

  const handleCopyPitch = () => {
    if (!discovery) return;
    const ov = discovery.companyOverviewDetails;
    const qs = discovery.qualificationSummary;
    const opps = discovery.discoveryOpportunities;
    const sr = discovery.strategicRecommendation;
    const dq = discovery.discoveryQuestions;
    const est = discovery.projectEstimate;
    const email = discovery.outreachEmailDraft;

    const text = [
      "=== TECHFLUX CRM LEAD DISCOVERY BRIEF ===",
      discovery.fitAssessment
        ? `Capabilities Matrix Fit: ${discovery.fitAssessment.fitLevel} (${discovery.fitAssessment.fitScore}%) — ${discovery.fitAssessment.timeInvestmentGuidance}`
        : null,
      qs
        ? `100-Point Qualification Rubric: ${qs.totalScore}/100 (${qs.category}) | Next Action: ${qs.recommendedNextAction}`
        : null,
      "",
      "1. Client & Business Overview:",
      ov?.companyName ? `• Company: ${ov.companyName}` : null,
      ov?.industry ? `• Industry: ${ov.industry}` : `• Industry: ${discovery.clientBusiness}`,
      ov?.location ? `• Location: ${ov.location}` : null,
      ov?.businessHistory ? `• History: ${ov.businessHistory}` : null,
      ov?.businessModel ? `• Business Model: ${ov.businessModel}` : null,
      ov?.digitalOperationsSummary ? `• Digital Operations: ${ov.digitalOperationsSummary}` : null,
      `• Summary: ${discovery.businessSummary}`,
      "",
      "2. Discovery Opportunities & Needs (Evidence-Tagged):",
      ...(opps && opps.length > 0
        ? opps.map(
            (o) =>
              `• [${o.evidenceStatus} | Confidence: ${o.confidence}] ${o.title}: ${o.observationOrHypothesis}\n  Validation Question: "${o.clientValidationQuestion}"`
          )
        : discovery.currentNeeds.map((n) => `• ${n}`)),
      "",
      "3. Strategic Pitch Recommendation:",
      sr
        ? `• Primary Service: ${sr.primaryService}\n• Relevance: ${sr.whyRelevant}\n• Expected Benefit: ${sr.expectedBenefit}\n• What Must Be Confirmed: ${sr.whatMustBeConfirmed.join("; ")}`
        : `• Focus Offering: ${discovery.targetOffering}\n${discovery.recommendations.map((r) => `• ${r}`).join("\n")}`,
      "",
      "4. Discovery Questions for Call:",
      ...(dq && dq.priorityQuestions && dq.priorityQuestions.length > 0
        ? dq.priorityQuestions.map((q, idx) => `Q${idx + 1}: "${q}"`)
        : discovery.talkingPoints.map((q, idx) => `Q${idx + 1}: "${q}"`)),
      "",
      discovery.openingPitchHook ? `5. Opening Pitch Hook:\n"${discovery.openingPitchHook}"` : null,
      "",
      email
        ? `6. Tailored Outreach Email (Quick Meeting Invite):\nSubject: ${draftSubject || email.subject}\n\n${draftBody || email.body}`
        : null,
      "",
      est
        ? `7. Commercial Project Estimate: ${est.status} (${est.reason})\n• Scope: ${est.scopeAssumptions.join(" ")}`
        : null,
    ]
      .filter((line) => line !== null && line !== undefined)
      .join("\n");

    navigator.clipboard.writeText(text);
    setCopiedPitch(true);
    setTimeout(() => setCopiedPitch(false), 2000);
  };

  const handleCopyFullEmail = () => {
    const subject = draftSubject || discovery?.outreachEmailDraft?.subject || "";
    const body = draftBody || discovery?.outreachEmailDraft?.body || "";
    if (!subject && !body) return;
    const text = `Subject: ${subject}\n\n${body}`;
    navigator.clipboard.writeText(text);
    setCopiedEmail(true);
    setTimeout(() => setCopiedEmail(false), 2000);
  };

  const handleCopyEmailSubject = () => {
    const subject = draftSubject || discovery?.outreachEmailDraft?.subject || "";
    if (!subject) return;
    navigator.clipboard.writeText(subject);
    setCopiedEmailSubject(true);
    setTimeout(() => setCopiedEmailSubject(false), 2000);
  };

  const handleCopyEmailBody = () => {
    const body = draftBody || discovery?.outreachEmailDraft?.body || "";
    if (!body) return;
    navigator.clipboard.writeText(body);
    setCopiedEmailBody(true);
    setTimeout(() => setCopiedEmailBody(false), 2000);
  };

  const handleResetDraft = () => {
    if (discovery?.outreachEmailDraft) {
      setDraftSubject(discovery.outreachEmailDraft.subject);
      setDraftBody(discovery.outreachEmailDraft.body);
      setIsEditingDraft(false);
    }
  };

  const handleCopyHook = () => {
    if (!discovery?.openingPitchHook) return;
    navigator.clipboard.writeText(discovery.openingPitchHook);
    setCopiedHook(true);
    setTimeout(() => setCopiedHook(false), 2000);
  };

  // 1. Initial Empty State (Not yet generated)
  if (hasLoaded && !discovery) {
    const isMissingResearchSources = !sources.hasAnySource;

    return (
      <div
        className={`rounded-2xl border shadow-xs overflow-hidden transition-all ${
          isMissingResearchSources
            ? "border-amber-200/90 bg-white"
            : "border-indigo-200/80 bg-white"
        }`}
      >
        {/* Header Bar */}
        <div
          className={`px-5 py-3.5 flex items-center justify-between gap-3 ${
            isMissingResearchSources
              ? "bg-gradient-to-r from-amber-50/80 via-orange-50/30 to-white"
              : "bg-gradient-to-r from-indigo-50/70 via-sky-50/30 to-white"
          } ${isExpanded ? (isMissingResearchSources ? "border-b border-amber-100" : "border-b border-indigo-100/70") : ""}`}
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <div
              className={`p-1.5 rounded-lg text-white shadow-xs shrink-0 ${
                isMissingResearchSources ? "bg-amber-600" : "bg-indigo-600"
              }`}
            >
              <Sparkles className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-sm font-bold text-slate-900">
                  AI Client Discovery &amp; Sales Pitch Intelligence
                </h3>
                {isMissingResearchSources ? (
                  <Badge
                    variant="outline"
                    className="bg-amber-50 text-amber-800 border-amber-300 text-[10px] font-bold shrink-0 flex items-center gap-1"
                  >
                    <AlertCircle className="w-3 h-3 text-amber-600" />
                    <span>Research Source Required</span>
                  </Badge>
                ) : (
                  <Badge
                    variant="outline"
                    className="bg-indigo-50 text-indigo-700 border-indigo-200 text-[10px] font-semibold shrink-0"
                  >
                    Discovery Phase
                  </Badge>
                )}
              </div>
              <p className="text-[11px] text-slate-500 mt-0.5">
                {isMissingResearchSources
                  ? "Website or LinkedIn URL needed to scrape & evaluate fit"
                  : "AI-driven prospect profiling & strategic pitch recommendations"}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {isAdmin && (
              <Button
                onClick={() => setIsKeyModalOpen(true)}
                variant="outline"
                size="sm"
                className="h-8 gap-1.5 text-xs text-slate-600 border-slate-200 hover:bg-slate-50"
              >
                <Key className="w-3.5 h-3.5 text-amber-500" />
                <span>AI Key</span>
              </Button>
            )}

            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setIsExpanded(!isExpanded)}
              className="h-8 px-2.5 text-xs font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-100 flex items-center gap-1.5 shrink-0"
              title={isExpanded ? "Collapse AI Client Discovery card" : "Expand AI Client Discovery card"}
            >
              <span>{isExpanded ? "Collapse" : "Expand"}</span>
              {isExpanded ? (
                <ChevronUp className="w-3.5 h-3.5 text-slate-500" />
              ) : (
                <ChevronDown className="w-3.5 h-3.5 text-slate-500" />
              )}
            </Button>
          </div>
        </div>

        {/* Quick OpenAI Key Modal (Admin Only) */}
        {isAdmin && isKeyModalOpen && (
          <div className="p-4 bg-slate-50 border-b border-indigo-100 space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Key className="w-4 h-4 text-amber-600" />
                <h4 className="text-xs font-bold text-slate-900">OpenAI API Key Configuration</h4>
              </div>
              <button
                type="button"
                onClick={() => setIsKeyModalOpen(false)}
                className="text-xs text-slate-400 hover:text-slate-600"
              >
                ✕ Cancel
              </button>
            </div>
            <p className="text-[11px] text-slate-500">
              Provide your OpenAI API key (`sk-proj-...`). It will be saved securely and used for deep LLM discovery synthesis across all lead records.
            </p>
            <div className="flex items-center gap-2">
              <Input
                type="password"
                placeholder="sk-proj-..."
                value={openAiKeyInput}
                onChange={(e) => setOpenAiKeyInput(e.target.value)}
                className="text-xs h-8"
              />
              <Button
                size="sm"
                onClick={handleSaveOpenAiKey}
                disabled={isSavingKey || !openAiKeyInput.trim()}
                className="h-8 text-xs bg-emerald-600 hover:bg-emerald-700 text-white shrink-0"
              >
                {isSavingKey ? "Saving..." : "Save Key & Analyze"}
              </Button>
            </div>
            {keySaveMessage && (
              <p className="text-[11px] text-emerald-600 font-medium">{keySaveMessage}</p>
            )}
          </div>
        )}

        {/* Error message alert banner if server action returns an error */}
        {isExpanded && errorMessage && (
          <div className="mx-5 mt-4 p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Expanded Content Body */}
        {isExpanded && (
          <>
            {isMissingResearchSources ? (
              /* State A: Missing Research URLs Banner (Prompt Sales Rep) */
              <div className="p-5 bg-gradient-to-br from-amber-50/40 via-white to-slate-50 space-y-4">
                <div className="flex items-start gap-3.5">
                  <div className="p-2.5 rounded-xl bg-amber-100 text-amber-800 border border-amber-200 shadow-2xs shrink-0 mt-0.5">
                    <Link2 className="w-5 h-5 text-amber-700" />
                  </div>
                  <div className="space-y-1.5 flex-1 min-w-0">
                    <h4 className="text-sm font-bold text-slate-900">
                      Cannot Generate Discovery: Digital Footprint Missing
                    </h4>
                    <p className="text-xs text-slate-600 leading-relaxed">
                      AI Client Discovery evaluates company capabilities, service fit, and personalized pitch recommendations by scraping live prospect data. All 3 research sources are currently missing for <span className="font-semibold text-slate-900">{companyName || leadName || "this lead"}</span>.
                    </p>
                  </div>
                </div>

                <div className="bg-amber-50/70 border border-amber-200/80 rounded-xl p-4 text-xs text-slate-800 space-y-2.5">
                  <p className="font-semibold text-amber-950 flex items-center gap-1.5">
                    <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                    <span>Sales Representative Action Needed: Please get any one of the following details to enable discovery:</span>
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1">
                    <div className="bg-white p-3 rounded-lg border border-amber-200/90 shadow-2xs flex flex-col justify-between gap-1">
                      <div className="flex items-center gap-2 font-semibold text-slate-800">
                        <Globe className="w-4 h-4 text-blue-500 shrink-0" />
                        <span>Company Website</span>
                      </div>
                      <span className="text-[11px] text-slate-500">e.g. https://company.com</span>
                    </div>

                    <div className="bg-white p-3 rounded-lg border border-amber-200/90 shadow-2xs flex flex-col justify-between gap-1">
                      <div className="flex items-center gap-2 font-semibold text-slate-800">
                        <Linkedin className="w-4 h-4 text-blue-600 shrink-0" />
                        <span>Personal LinkedIn</span>
                      </div>
                      <span className="text-[11px] text-slate-500">e.g. linkedin.com/in/...</span>
                    </div>

                    <div className="bg-white p-3 rounded-lg border border-amber-200/90 shadow-2xs flex flex-col justify-between gap-1">
                      <div className="flex items-center gap-2 font-semibold text-slate-800">
                        <Building2 className="w-4 h-4 text-indigo-600 shrink-0" />
                        <span>Company LinkedIn</span>
                      </div>
                      <span className="text-[11px] text-slate-500">e.g. linkedin.com/company/...</span>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1 border-t border-amber-100">
                  <p className="text-[11px] text-slate-500 italic">
                    Discovery generation is disabled until at least one research source URL is provided.
                  </p>

                  {onEditLead && (
                    <Button
                      type="button"
                      size="sm"
                      onClick={onEditLead}
                      className="gap-2 bg-amber-600 hover:bg-amber-700 text-white font-semibold text-xs shadow-xs shrink-0 h-9 px-4"
                      title="Edit lead to add website or LinkedIn URL"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                      <span>Add Details / Edit Lead</span>
                    </Button>
                  )}
                </div>
              </div>
            ) : (
              /* State B: Research URLs Present -> Enable AI Discovery Generation */
              <div className="p-5 bg-gradient-to-br from-indigo-50/30 via-white to-sky-50/20 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-2 max-w-xl">
                  <p className="text-xs text-slate-600 leading-relaxed">
                    Synthesize <span className="font-semibold text-slate-900">{companyName || leadName || "client"}</span>&apos;s specific business profile, diagnose their exact operational needs, and formulate tailored sales recommendations for your discovery call.
                  </p>

                  {/* Detected Research Sources Pills */}
                  <div className="flex items-center gap-2 flex-wrap pt-0.5">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      Scraping Sources:
                    </span>
                    {sources.website && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium bg-white border border-slate-200 text-slate-700 shadow-2xs">
                        <Globe className="w-3 h-3 text-blue-500 shrink-0" />
                        <span className="truncate max-w-[190px]">{sources.website.replace(/^https?:\/\//, "")}</span>
                      </span>
                    )}
                    {sources.customerLinkedin && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium bg-white border border-slate-200 text-slate-700 shadow-2xs">
                        <Linkedin className="w-3 h-3 text-blue-600 shrink-0" />
                        <span>Personal LinkedIn</span>
                      </span>
                    )}
                    {sources.companyLinkedin && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium bg-white border border-slate-200 text-slate-700 shadow-2xs">
                        <Building2 className="w-3 h-3 text-indigo-600 shrink-0" />
                        <span>Company LinkedIn</span>
                      </span>
                    )}
                  </div>
                </div>

                <Button
                  onClick={() => handleGenerateOrRefresh(true)}
                  disabled={isPending}
                  size="sm"
                  className="h-9 px-4 gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold shadow-xs shrink-0 self-start sm:self-auto"
                >
                  {isPending ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Analyzing Client...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>Generate Client Discovery</span>
                    </>
                  )}
                </Button>
              </div>
            )}
          </>
        )}
      </div>
    );
  }

  // 2. Loading Placeholder while initial analysis runs
  if (!hasLoaded) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs animate-pulse space-y-3">
        <div className="flex items-center justify-between">
          <div className="h-4 bg-slate-200 rounded w-1/3" />
          <div className="h-4 bg-slate-200 rounded w-1/6" />
        </div>
        <div className="h-16 bg-slate-100 rounded-xl" />
      </div>
    );
  }

  // 3. Rendered Full Discovery Card
  return (
    <div className="rounded-2xl border border-indigo-200/80 bg-white shadow-xs overflow-hidden transition-all">
      {/* Header Toolbar */}
      <div className="bg-gradient-to-r from-indigo-50/70 via-sky-50/40 to-white px-5 py-3.5 border-b border-indigo-100/80 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="p-1.5 rounded-lg bg-indigo-600 text-white shadow-xs">
            <Sparkles className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-sm font-bold text-slate-900">
                AI Client Discovery &amp; Sales Pitch
              </h3>
              {discovery?.provider === "openai" ? (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  OpenAI ({discovery.modelUsed})
                </span>
              ) : discovery?.provider === "gemini" ? (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-800 border border-blue-200">
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                  Gemini ({discovery?.modelUsed})
                </span>
              ) : isAdmin ? (
                <button
                  type="button"
                  onClick={() => setIsKeyModalOpen(true)}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200 hover:bg-amber-100 transition-colors"
                  title="Click to configure or paste your OpenAI API key"
                >
                  ⚡ Neural Heuristic Engine
                  <span className="underline ml-0.5 font-normal text-[9px]">(Add OpenAI Key)</span>
                </button>
              ) : (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-100 text-slate-700 border border-slate-200">
                  ⚡ Built-in Neural Engine
                </span>
              )}
            </div>
            <p className="text-[11px] text-slate-500">
              Discovery Phase Brief for Sales Representatives • Analyzed{" "}
              {discovery?.analyzedAt
                ? new Date(discovery.analyzedAt).toLocaleDateString([], {
                    month: "short",
                    day: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })
                : "recently"}
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 flex-wrap">
          <Button
            variant="outline"
            size="sm"
            onClick={handleCopyPitch}
            className="h-8 text-xs font-semibold gap-1.5 border-slate-200 text-slate-700 hover:bg-slate-100"
          >
            {copiedPitch ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-600" />
                <span className="text-emerald-700">Copied</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5 text-slate-500" />
                <span>Copy Summary</span>
              </>
            )}
          </Button>

          <Button
            variant="outline"
            size="sm"
            disabled={isPending}
            onClick={() => handleGenerateOrRefresh(true)}
            className="h-8 text-xs font-semibold gap-1.5 border-indigo-200 text-indigo-700 hover:bg-indigo-50"
          >
            <RefreshCw
              className={`w-3.5 h-3.5 ${isPending ? "animate-spin" : ""}`}
            />
            <span>{isPending ? "Analyzing..." : "Re-Analyze"}</span>
          </Button>

          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setIsExpanded(!isExpanded)}
            className="h-8 px-2.5 text-xs font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-100 flex items-center gap-1.5 shrink-0"
            title={isExpanded ? "Collapse AI Client Discovery card" : "Expand AI Client Discovery card"}
          >
            <span>{isExpanded ? "Collapse" : "Expand"}</span>
            {isExpanded ? (
              <ChevronUp className="w-3.5 h-3.5 text-slate-500" />
            ) : (
              <ChevronDown className="w-3.5 h-3.5 text-slate-500" />
            )}
          </Button>
        </div>
      </div>

      {/* Quick OpenAI Key Modal (Admin Only) */}
      {isAdmin && isKeyModalOpen && (
        <div className="p-4 bg-slate-50 border-b border-indigo-100 space-y-2.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <Key className="w-3.5 h-3.5 text-amber-600" />
              <h4 className="text-xs font-bold text-slate-900">Connect OpenAI API Key</h4>
            </div>
            <button
              type="button"
              onClick={() => setIsKeyModalOpen(false)}
              className="text-xs text-slate-400 hover:text-slate-600"
            >
              ✕ Close
            </button>
          </div>
          <p className="text-[11px] text-slate-500">
            Paste your OpenAI API key below. Once saved, every lead discovery will use OpenAI GPT-4o-mini to analyze the client&apos;s real website, products, and services.
          </p>
          <div className="flex items-center gap-2">
            <Input
              type="password"
              placeholder="sk-proj-..."
              value={openAiKeyInput}
              onChange={(e) => setOpenAiKeyInput(e.target.value)}
              className="text-xs h-8 bg-white"
            />
            <Button
              size="sm"
              onClick={handleSaveOpenAiKey}
              disabled={isSavingKey || !openAiKeyInput.trim()}
              className="h-8 text-xs bg-emerald-600 hover:bg-emerald-700 text-white shrink-0"
            >
              {isSavingKey ? "Saving..." : "Save Key & Re-Analyze"}
            </Button>
          </div>
          {keySaveMessage && (
            <p className="text-[11px] text-emerald-600 font-medium">{keySaveMessage}</p>
          )}
        </div>
      )}

      {/* Card Content */}
      {isExpanded && discovery && (
        <div className="p-5 space-y-4">
          {/* 0A. 100-Point Lead Qualification Rubric Banner */}
          {discovery.qualificationSummary && (
            <div className="rounded-xl border border-indigo-200/90 bg-gradient-to-br from-indigo-50/70 via-white to-sky-50/40 p-4 space-y-3.5 shadow-2xs">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-indigo-100 pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-lg bg-indigo-600 text-white shadow-xs shrink-0">
                    <Scale className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                        100-Point Qualification Rubric
                      </span>
                      <Badge
                        variant="outline"
                        className={`text-xs font-bold border ${
                          discovery.qualificationSummary.category === "High Priority"
                            ? "bg-emerald-100 text-emerald-800 border-emerald-300"
                            : discovery.qualificationSummary.category === "Medium Priority"
                            ? "bg-sky-100 text-sky-800 border-sky-300"
                            : discovery.qualificationSummary.category === "Low Priority"
                            ? "bg-amber-100 text-amber-800 border-amber-300"
                            : "bg-slate-100 text-slate-700 border-slate-300"
                        }`}
                      >
                        {discovery.qualificationSummary.category}
                      </Badge>
                      <span className="text-xs font-bold text-slate-900 bg-white px-2 py-0.5 rounded-md border border-slate-200 shadow-2xs">
                        Score: {discovery.qualificationSummary.totalScore} / 100
                      </span>
                    </div>
                    <p className="text-xs text-slate-700 font-medium mt-1">
                      <span className="font-bold text-slate-900">Recommended Next Step: </span>
                      {discovery.qualificationSummary.recommendedNextAction}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setIsRubricExpanded(!isRubricExpanded)}
                    className="text-xs font-semibold text-indigo-700 hover:text-indigo-900 inline-flex items-center gap-1 bg-white px-2.5 py-1.5 rounded-lg border border-indigo-200 shadow-2xs transition-colors"
                  >
                    <span>{isRubricExpanded ? "Hide Scoring Breakdown" : "View 7-Dimension Breakdown"}</span>
                    {isRubricExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              {/* Status Chips Row */}
              <div className="flex items-center gap-2 flex-wrap text-xs">
                <div className="bg-white px-2.5 py-1 rounded-md border border-slate-200 text-slate-700 text-[11px] font-medium flex items-center gap-1.5">
                  <span className="text-slate-400 font-semibold">Intent:</span>
                  <span className="font-bold text-slate-800">{discovery.qualificationSummary.buyingIntentStatus}</span>
                </div>
                <div className="bg-white px-2.5 py-1 rounded-md border border-slate-200 text-slate-700 text-[11px] font-medium flex items-center gap-1.5">
                  <span className="text-slate-400 font-semibold">Need Scope:</span>
                  <span className="font-bold text-slate-800">{discovery.qualificationSummary.requirementStatus}</span>
                </div>
                <div className="bg-white px-2.5 py-1 rounded-md border border-slate-200 text-slate-700 text-[11px] font-medium flex items-center gap-1.5">
                  <span className="text-slate-400 font-semibold">Decision-Maker:</span>
                  <span className="font-bold text-slate-800">{discovery.qualificationSummary.decisionMakerStatus}</span>
                </div>
                <div
                  className="bg-white px-2.5 py-1 rounded-md border border-slate-200 text-slate-700 text-[11px] font-medium flex items-center gap-1.5"
                  title="Unprovided timeline is treated as discovery agenda item, not negative penalty"
                >
                  <span className="text-slate-400 font-semibold">Timeline:</span>
                  <span className={discovery.qualificationSummary.timelineStatus === "Unknown" ? "text-slate-500 font-medium italic" : "font-bold text-slate-800"}>
                    {discovery.qualificationSummary.timelineStatus}
                  </span>
                </div>
                <div
                  className="bg-white px-2.5 py-1 rounded-md border border-slate-200 text-slate-700 text-[11px] font-medium flex items-center gap-1.5"
                  title="Unprovided budget is treated as discovery agenda item, not negative penalty"
                >
                  <span className="text-slate-400 font-semibold">Budget:</span>
                  <span className={discovery.qualificationSummary.budgetStatus === "Unknown" ? "text-slate-500 font-medium italic" : "font-bold text-slate-800"}>
                    {discovery.qualificationSummary.budgetStatus}
                  </span>
                </div>
              </div>

              {/* Expandable 7-Dimension Breakdown */}
              {isRubricExpanded && (
                <div className="pt-2 border-t border-indigo-100 space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
                    <div className="bg-white p-2 rounded-lg border border-slate-200">
                      <div className="flex justify-between text-[11px] font-semibold text-slate-600 mb-1">
                        <span>Service Fit</span>
                        <span className="font-bold text-indigo-700">{discovery.qualificationSummary.dimensionScores.fitWithServices} / 25</span>
                      </div>
                      <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                        <div className="bg-indigo-600 h-full rounded-full" style={{ width: `${(discovery.qualificationSummary.dimensionScores.fitWithServices / 25) * 100}%` }} />
                      </div>
                    </div>

                    <div className="bg-white p-2 rounded-lg border border-slate-200">
                      <div className="flex justify-between text-[11px] font-semibold text-slate-600 mb-1">
                        <span>Need Evidence</span>
                        <span className="font-bold text-indigo-700">{discovery.qualificationSummary.dimensionScores.evidenceOfNeed} / 20</span>
                      </div>
                      <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                        <div className="bg-indigo-600 h-full rounded-full" style={{ width: `${(discovery.qualificationSummary.dimensionScores.evidenceOfNeed / 20) * 100}%` }} />
                      </div>
                    </div>

                    <div className="bg-white p-2 rounded-lg border border-slate-200">
                      <div className="flex justify-between text-[11px] font-semibold text-slate-600 mb-1">
                        <span>Buying Intent</span>
                        <span className="font-bold text-indigo-700">{discovery.qualificationSummary.dimensionScores.buyingIntent} / 20</span>
                      </div>
                      <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                        <div className="bg-indigo-600 h-full rounded-full" style={{ width: `${(discovery.qualificationSummary.dimensionScores.buyingIntent / 20) * 100}%` }} />
                      </div>
                    </div>

                    <div className="bg-white p-2 rounded-lg border border-slate-200">
                      <div className="flex justify-between text-[11px] font-semibold text-slate-600 mb-1">
                        <span>Decision Maker</span>
                        <span className="font-bold text-indigo-700">{discovery.qualificationSummary.dimensionScores.decisionMakerAccess} / 10</span>
                      </div>
                      <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                        <div className="bg-indigo-600 h-full rounded-full" style={{ width: `${(discovery.qualificationSummary.dimensionScores.decisionMakerAccess / 10) * 100}%` }} />
                      </div>
                    </div>

                    <div className="bg-white p-2 rounded-lg border border-slate-200">
                      <div className="flex justify-between text-[11px] font-semibold text-slate-600 mb-1">
                        <span>Timeline Clarity</span>
                        <span className="font-bold text-indigo-700">{discovery.qualificationSummary.dimensionScores.timelineClarity} / 10</span>
                      </div>
                      <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                        <div className="bg-indigo-600 h-full rounded-full" style={{ width: `${(discovery.qualificationSummary.dimensionScores.timelineClarity / 10) * 100}%` }} />
                      </div>
                    </div>

                    <div className="bg-white p-2 rounded-lg border border-slate-200">
                      <div className="flex justify-between text-[11px] font-semibold text-slate-600 mb-1">
                        <span>Budget Clarity</span>
                        <span className="font-bold text-indigo-700">{discovery.qualificationSummary.dimensionScores.budgetClarity} / 10</span>
                      </div>
                      <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                        <div className="bg-indigo-600 h-full rounded-full" style={{ width: `${(discovery.qualificationSummary.dimensionScores.budgetClarity / 10) * 100}%` }} />
                      </div>
                    </div>

                    <div className="bg-white p-2 rounded-lg border border-slate-200 sm:col-span-2 lg:col-span-2">
                      <div className="flex justify-between text-[11px] font-semibold text-slate-600 mb-1">
                        <span>Research Completeness</span>
                        <span className="font-bold text-indigo-700">{discovery.qualificationSummary.dimensionScores.researchReliability} / 5</span>
                      </div>
                      <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                        <div className="bg-indigo-600 h-full rounded-full" style={{ width: `${(discovery.qualificationSummary.dimensionScores.researchReliability / 5) * 100}%` }} />
                      </div>
                    </div>
                  </div>

                  {/* Dimension Rationale List */}
                  <div className="bg-white p-3 rounded-lg border border-slate-200 space-y-1">
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                      Evidence-Based Rubric Rationales:
                    </span>
                    <ul className="space-y-1 mt-1 text-xs text-slate-700">
                      {discovery.qualificationSummary.rationale.map((r, rIdx) => (
                        <li key={rIdx} className="flex items-start gap-1.5">
                          <span className="text-indigo-500 font-bold">•</span>
                          <span>{r}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* 0B. Company Capabilities Matrix Fit Banner */}
          {discovery.fitAssessment && (
            <div
              className={`rounded-xl p-4 border transition-all ${
                discovery.fitAssessment.fitLevel === "EXCELLENT"
                  ? "bg-gradient-to-r from-emerald-50/90 via-emerald-50/40 to-white border-emerald-300 shadow-xs"
                  : discovery.fitAssessment.fitLevel === "GOOD"
                  ? "bg-gradient-to-r from-sky-50/90 via-indigo-50/30 to-white border-sky-300 shadow-xs"
                  : "bg-gradient-to-r from-rose-50/90 via-rose-50/40 to-white border-rose-300 shadow-xs"
              }`}
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b pb-3 mb-3 border-slate-200/70">
                <div className="flex items-center gap-2.5">
                  <div
                    className={`p-2 rounded-lg text-white shadow-xs shrink-0 ${
                      discovery.fitAssessment.fitLevel === "EXCELLENT"
                        ? "bg-emerald-600"
                        : discovery.fitAssessment.fitLevel === "GOOD"
                        ? "bg-sky-600"
                        : "bg-rose-600"
                    }`}
                  >
                    {discovery.fitAssessment.fitLevel === "EXCELLENT" ? (
                      <Flame className="w-4 h-4" />
                    ) : discovery.fitAssessment.fitLevel === "GOOD" ? (
                      <CheckCircle2 className="w-4 h-4" />
                    ) : (
                      <AlertTriangle className="w-4 h-4" />
                    )}
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                        Capabilities Matrix Fit Verdict
                      </span>
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold border ${
                          discovery.fitAssessment.fitLevel === "EXCELLENT"
                            ? "bg-emerald-100 text-emerald-800 border-emerald-300"
                            : discovery.fitAssessment.fitLevel === "GOOD"
                            ? "bg-sky-100 text-sky-800 border-sky-300"
                            : "bg-rose-100 text-rose-800 border-rose-300"
                        }`}
                      >
                        {discovery.fitAssessment.fitLevel === "EXCELLENT" && "🔥 EXCELLENT FIT"}
                        {discovery.fitAssessment.fitLevel === "GOOD" && "⚡ GOOD FIT"}
                        {discovery.fitAssessment.fitLevel === "POOR" && "⚠️ POOR FIT / LOW ALIGNMENT"}
                        <span className="opacity-75 font-medium ml-1">
                          ({discovery.fitAssessment.fitScore}%)
                        </span>
                      </span>
                    </div>
                    <p className="text-xs font-bold text-slate-900 mt-0.5">
                      {discovery.fitAssessment.timeInvestmentGuidance}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <span
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold shadow-xs ${
                      discovery.fitAssessment.isWorthTime
                        ? "bg-emerald-600 text-white"
                        : "bg-rose-600 text-white"
                    }`}
                  >
                    <Clock className="w-3.5 h-3.5" />
                    <span>
                      {discovery.fitAssessment.isWorthTime
                        ? "Worth Spending Time"
                        : "Not Worth Heavy Time"}
                    </span>
                  </span>
                </div>
              </div>

              {discovery.fitAssessment.exclusionAlert && (
                <div className="mb-2.5 px-3 py-1.5 rounded-lg bg-rose-100/90 border border-rose-200 text-rose-800 text-xs font-semibold flex items-center gap-2">
                  <ShieldAlert className="w-4 h-4 shrink-0 text-rose-600" />
                  <span>{discovery.fitAssessment.exclusionAlert}</span>
                </div>
              )}

              <div className="space-y-1">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                  Evaluation Rationale vs Company Capabilities Matrix:
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-1">
                  {discovery.fitAssessment.fitReasons.map((reason, idx) => (
                    <div
                      key={idx}
                      className="text-xs text-slate-700 bg-white/90 border border-slate-200/80 rounded-lg p-2 flex items-start gap-2 shadow-2xs font-medium"
                    >
                      <span
                        className={`text-sm leading-none mt-0.5 font-bold ${
                          discovery.fitAssessment?.fitLevel === "EXCELLENT"
                            ? "text-emerald-600"
                            : discovery.fitAssessment?.fitLevel === "GOOD"
                            ? "text-sky-600"
                            : "text-rose-600"
                        }`}
                      >
                        •
                      </span>
                      <span className="leading-tight">{reason}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* 1. Executive Client & Business Overview Dossier */}
          <div className="bg-slate-50/80 rounded-xl p-4 border border-slate-200/80 space-y-3">
            <div className="flex items-center justify-between flex-wrap gap-2 border-b border-slate-200/60 pb-2.5">
              <div className="flex items-center gap-2">
                <span className="p-1 rounded-md bg-indigo-100 text-indigo-700">
                  <Building2 className="w-3.5 h-3.5" />
                </span>
                <span className="text-xs font-bold text-slate-900 tracking-wide">
                  1. Client &amp; Business Overview
                </span>
              </div>
              <div className="flex items-center gap-2">
                {discovery.companyOverviewDetails?.industry ? (
                  <Badge
                    variant="secondary"
                    className="bg-indigo-50 text-indigo-700 border-indigo-200 font-semibold text-[10px]"
                  >
                    {discovery.companyOverviewDetails.industry}
                  </Badge>
                ) : (
                  <Badge
                    variant="secondary"
                    className="bg-indigo-50 text-indigo-700 border-indigo-200 font-semibold text-[10px]"
                  >
                    {discovery.clientBusiness}
                  </Badge>
                )}
              </div>
            </div>

            {/* Executive Dossier Attributes Grid */}
            {discovery.companyOverviewDetails && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                {discovery.companyOverviewDetails.companyName && (
                  <div className="bg-white p-2.5 rounded-lg border border-slate-200/70 text-xs shadow-2xs">
                    <div className="flex items-center gap-1.5 text-slate-500 font-semibold text-[10px] uppercase tracking-wider mb-0.5">
                      <Building2 className="w-3 h-3 text-indigo-500" />
                      <span>Company Name</span>
                    </div>
                    <span className="font-bold text-slate-800">
                      {discovery.companyOverviewDetails.companyName}
                    </span>
                  </div>
                )}

                {discovery.companyOverviewDetails.location && (
                  <div className="bg-white p-2.5 rounded-lg border border-slate-200/70 text-xs shadow-2xs">
                    <div className="flex items-center gap-1.5 text-slate-500 font-semibold text-[10px] uppercase tracking-wider mb-0.5">
                      <MapPin className="w-3 h-3 text-rose-500" />
                      <span>Location</span>
                    </div>
                    <span className="font-semibold text-slate-800">
                      {discovery.companyOverviewDetails.location}
                    </span>
                  </div>
                )}

                {discovery.companyOverviewDetails.businessModel && (
                  <div className="bg-white p-2.5 rounded-lg border border-slate-200/70 text-xs shadow-2xs">
                    <div className="flex items-center gap-1.5 text-slate-500 font-semibold text-[10px] uppercase tracking-wider mb-0.5">
                      <Briefcase className="w-3 h-3 text-sky-500" />
                      <span>Business Model</span>
                    </div>
                    <span className="font-semibold text-slate-800">
                      {discovery.companyOverviewDetails.businessModel}
                    </span>
                  </div>
                )}

                {discovery.companyOverviewDetails.businessHistory && (
                  <div className="bg-white p-2.5 rounded-lg border border-slate-200/70 text-xs shadow-2xs sm:col-span-2 lg:col-span-1">
                    <div className="flex items-center gap-1.5 text-slate-500 font-semibold text-[10px] uppercase tracking-wider mb-0.5">
                      <Calendar className="w-3 h-3 text-amber-500" />
                      <span>Operating History</span>
                    </div>
                    <span className="font-semibold text-slate-800">
                      {discovery.companyOverviewDetails.businessHistory}
                    </span>
                  </div>
                )}

                {discovery.companyOverviewDetails.digitalOperationsSummary && (
                  <div className="bg-white p-2.5 rounded-lg border border-slate-200/70 text-xs shadow-2xs sm:col-span-2">
                    <div className="flex items-center gap-1.5 text-slate-500 font-semibold text-[10px] uppercase tracking-wider mb-0.5">
                      <Globe className="w-3 h-3 text-emerald-500" />
                      <span>Digital &amp; Commercial Operations</span>
                    </div>
                    <span className="text-slate-700 leading-snug">
                      {discovery.companyOverviewDetails.digitalOperationsSummary}
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* Overall Business Summary Paragraph */}
            <div className="bg-white/70 p-3 rounded-lg border border-slate-200/60">
              <p className="text-xs text-slate-700 leading-relaxed font-medium">
                {discovery.businessSummary}
              </p>
            </div>
          </div>

          {/* Middle Row: Discovery Opportunities & Strategic Pitch Recommendations */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* 2. Current Needs & Opportunities with Evidence Badges */}
            <div className="bg-amber-50/40 rounded-xl p-4 border border-amber-200/70 space-y-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <span className="text-[11px] font-bold text-amber-900 uppercase tracking-wider flex items-center gap-1.5">
                  <Target className="w-3.5 h-3.5 text-amber-600" />
                  <span>2. Discovery Opportunities &amp; Pain Points</span>
                </span>
                <span className="text-[10px] text-amber-700 bg-amber-100/70 px-2 py-0.5 rounded font-medium">
                  Evidence-Labeled
                </span>
              </div>

              {discovery.discoveryOpportunities && discovery.discoveryOpportunities.length > 0 ? (
                <div className="space-y-2.5">
                  {discovery.discoveryOpportunities.map((opp, idx) => (
                    <div
                      key={idx}
                      className="bg-white p-3 rounded-lg border border-amber-200/80 shadow-2xs space-y-1.5"
                    >
                      <div className="flex items-center justify-between flex-wrap gap-2">
                        <span className="text-xs font-bold text-slate-900">
                          {opp.title}
                        </span>
                        <div className="flex items-center gap-1.5">
                          <EvidenceBadge status={opp.evidenceStatus} />
                          <ConfidenceBadge confidence={opp.confidence} />
                        </div>
                      </div>
                      <p className="text-xs text-slate-700 leading-relaxed font-medium">
                        {opp.observationOrHypothesis}
                      </p>
                      {opp.potentialBusinessImpact && (
                        <p className="text-[11px] text-slate-500">
                          <span className="font-semibold text-slate-700">Impact: </span>
                          {opp.potentialBusinessImpact}
                        </p>
                      )}
                      {opp.clientValidationQuestion && (
                        <div className="bg-amber-50/60 p-2 rounded-md border border-amber-200/60 text-[11px] text-amber-900 mt-1">
                          <span className="font-bold">Ask Prospect to Validate: </span>
                          <span className="italic">&ldquo;{opp.clientValidationQuestion}&rdquo;</span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <ul className="space-y-1.5">
                  {discovery.currentNeeds.map((need, idx) => (
                    <li
                      key={idx}
                      className="text-xs text-slate-700 flex items-start gap-2 bg-white p-2 rounded-lg border border-amber-100"
                    >
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-500 mt-1.5 shrink-0" />
                      <span>{need}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* 3. Strategic Pitch Recommendation */}
            <div className="bg-blue-50/70 rounded-xl p-4 border border-blue-200 space-y-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <span className="text-[11px] font-bold text-blue-900 uppercase tracking-wider flex items-center gap-1.5">
                  <Lightbulb className="w-4 h-4 text-blue-600" />
                  <span>3. Strategic Pitch Recommendation</span>
                </span>
                <span className="text-xs font-bold text-blue-700 bg-blue-100/80 px-2.5 py-0.5 rounded-lg border border-blue-200">
                  Focus: {discovery.strategicRecommendation?.primaryService || discovery.targetOffering}
                </span>
              </div>

              {discovery.strategicRecommendation ? (
                <div className="space-y-2.5 text-xs">
                  <div className="bg-white p-3 rounded-lg border border-blue-200/70 shadow-2xs space-y-1.5">
                    <p className="text-slate-800 font-semibold">
                      {discovery.strategicRecommendation.whyRelevant}
                    </p>
                    <p className="text-slate-600 text-[11px]">
                      <span className="font-bold text-slate-700">Expected Commercial Benefit: </span>
                      {discovery.strategicRecommendation.expectedBenefit}
                    </p>
                  </div>

                  {discovery.strategicRecommendation.whatMustBeConfirmed?.length > 0 && (
                    <div className="bg-white/90 p-2.5 rounded-lg border border-blue-100 text-[11px] space-y-1">
                      <span className="font-bold text-blue-900 flex items-center gap-1">
                        <CheckSquare className="w-3.5 h-3.5 text-blue-600" />
                        Must Confirm Before Formal Proposal:
                      </span>
                      <ul className="space-y-1 pl-4 list-disc text-slate-700">
                        {discovery.strategicRecommendation.whatMustBeConfirmed.map((item, idx) => (
                          <li key={idx}>{item}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {discovery.strategicRecommendation.alternatives?.length > 0 && (
                    <div className="text-[11px] text-slate-600 pt-0.5">
                      <span className="font-semibold text-slate-700">Alternatives Considered: </span>
                      {discovery.strategicRecommendation.alternatives.join(", ")}
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-1.5">
                  {discovery.recommendations.map((rec, rIdx) => (
                    <div
                      key={rIdx}
                      className="text-xs text-slate-800 font-medium flex items-start gap-2 bg-white p-2 rounded-lg border border-blue-100"
                    >
                      <span className="text-blue-600 font-bold text-sm leading-none mt-0.5">•</span>
                      <span>{rec}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Bottom Grid: Priority Discovery Questions & Opening Pitch Hook */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
            {/* 4. Priority Discovery Questions for First Call */}
            <div className="bg-white rounded-xl p-4 border border-slate-200 space-y-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <span className="text-[11px] font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                  <HelpCircle className="w-3.5 h-3.5 text-indigo-500" />
                  <span>4. Priority Discovery Questions (Call Agenda)</span>
                </span>
                {discovery.discoveryQuestions?.followUpQuestions && discovery.discoveryQuestions.followUpQuestions.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setIsFollowUpsExpanded(!isFollowUpsExpanded)}
                    className="text-[11px] text-indigo-600 hover:text-indigo-800 font-semibold inline-flex items-center gap-1"
                  >
                    <span>{isFollowUpsExpanded ? "Hide Contingency" : `+${discovery.discoveryQuestions.followUpQuestions.length} Follow-ups`}</span>
                    {isFollowUpsExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                  </button>
                )}
              </div>

              <div className="space-y-2">
                {(discovery.discoveryQuestions?.priorityQuestions || discovery.talkingPoints).map((tp, tIdx) => (
                  <div
                    key={tIdx}
                    className="text-xs text-slate-700 bg-slate-50 p-2.5 rounded-lg border border-slate-200/70 flex items-start gap-2"
                  >
                    <span className="font-bold text-indigo-600 shrink-0">Q{tIdx + 1}:</span>
                    <span className="italic leading-relaxed">&ldquo;{tp}&rdquo;</span>
                  </div>
                ))}
              </div>

              {isFollowUpsExpanded && discovery.discoveryQuestions?.followUpQuestions && (
                <div className="pt-2 border-t border-slate-100 space-y-1.5">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                    Contingency &amp; Follow-up Discovery Questions:
                  </span>
                  <div className="space-y-1.5">
                    {discovery.discoveryQuestions.followUpQuestions.map((fq, fIdx) => (
                      <div
                        key={fIdx}
                        className="text-[11px] text-slate-600 bg-white p-2 rounded-md border border-slate-200 flex items-start gap-1.5"
                      >
                        <span className="font-semibold text-slate-400">F{fIdx + 1}:</span>
                        <span className="italic">&ldquo;{fq}&rdquo;</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* 5. Ready-to-Use Natural Opening Hook */}
            {discovery.openingPitchHook && (
              <div className="bg-indigo-50/30 rounded-xl p-4 border border-indigo-100 flex flex-col justify-between space-y-3">
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-indigo-900 uppercase tracking-wider flex items-center gap-1.5">
                      <Quote className="w-3.5 h-3.5 text-indigo-600" />
                      <span>5. Ready-to-Use Opening Hook</span>
                    </span>
                    <button
                      type="button"
                      onClick={handleCopyHook}
                      className="text-[11px] text-indigo-600 hover:text-indigo-800 font-semibold inline-flex items-center gap-1"
                    >
                      {copiedHook ? (
                        <>
                          <Check className="w-3 h-3 text-emerald-600" />
                          <span className="text-emerald-700">Copied</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3 h-3" />
                          <span>Copy Hook</span>
                        </>
                      )}
                    </button>
                  </div>

                  <div className="mt-2 bg-white p-3 rounded-lg border border-indigo-100 shadow-2xs space-y-1.5">
                    <p className="text-xs text-slate-800 italic leading-relaxed">
                      &ldquo;{discovery.openingPitchHook}&rdquo;
                    </p>
                    {discovery.openingHookDetails?.avoidedAntipatterns && (
                      <div className="flex items-center gap-2 pt-1 border-t border-slate-100 text-[10px] text-slate-500">
                        <span className="font-semibold text-slate-600">Grounded:</span>
                        <span>Eliminated exaggerated praise; focused on observed workflow.</span>
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex items-center justify-between text-[10px] text-slate-400 pt-1">
                  <span>Speak this in opening 30 seconds of phone call or email intro</span>
                  <span>Channel: Phone &amp; Email</span>
                </div>
              </div>
            )}
          </div>

          {/* 6. Tailored Sales Outreach Email (Quick Meeting Invite) */}
          {discovery.outreachEmailDraft && (
            <div className="bg-gradient-to-br from-indigo-50/70 via-white to-sky-50/40 rounded-xl p-4 border border-indigo-200/90 shadow-2xs space-y-3.5">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[11px] font-bold text-indigo-950 uppercase tracking-wider flex items-center gap-1.5">
                    <Mail className="w-3.5 h-3.5 text-indigo-600" />
                    <span>6. Tailored Sales Outreach Email Draft</span>
                  </span>
                  <Badge
                    variant="outline"
                    className="text-[10px] font-semibold bg-indigo-50 text-indigo-700 border-indigo-200"
                  >
                    {discovery.outreachEmailDraft.suggestedMeetingCta || "10-15 Min Intro Meeting"}
                  </Badge>
                  <span className="hidden sm:inline-flex items-center gap-1 text-[10px] font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                    <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                    Ready to Review &amp; Send
                  </span>
                </div>

                <div className="flex items-center gap-1.5">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setIsEditingDraft(!isEditingDraft)}
                    className="h-7 px-2 text-[11px] font-medium text-slate-600 hover:text-indigo-700 hover:bg-indigo-50"
                  >
                    <Edit3 className="w-3 h-3 mr-1" />
                    <span>{isEditingDraft ? "Done Editing" : "Edit Email"}</span>
                  </Button>

                  {(draftSubject !== discovery.outreachEmailDraft.subject ||
                    draftBody !== discovery.outreachEmailDraft.body) && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={handleResetDraft}
                      className="h-7 px-2 text-[11px] font-medium text-slate-500 hover:text-slate-700"
                      title="Reset to original AI draft"
                    >
                      <RotateCcw className="w-3 h-3 mr-1" />
                      <span>Reset</span>
                    </Button>
                  )}

                  <Button
                    type="button"
                    size="sm"
                    onClick={handleCopyFullEmail}
                    className={`h-7 px-2.5 text-[11px] font-semibold transition-all ${
                      copiedEmail
                        ? "bg-emerald-600 hover:bg-emerald-700 text-white"
                        : "bg-indigo-600 hover:bg-indigo-700 text-white"
                    }`}
                  >
                    {copiedEmail ? (
                      <>
                        <Check className="w-3 h-3 mr-1" />
                        <span>Copied Email</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3 h-3 mr-1" />
                        <span>Copy Full Email</span>
                      </>
                    )}
                  </Button>
                </div>
              </div>

              <div className="space-y-2 bg-white p-3.5 rounded-lg border border-indigo-100 shadow-2xs">
                {/* Subject Line */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-slate-500">
                    <span>Subject:</span>
                    <button
                      type="button"
                      onClick={handleCopyEmailSubject}
                      className="text-indigo-600 hover:text-indigo-800 font-semibold inline-flex items-center gap-1 text-[10px]"
                    >
                      {copiedEmailSubject ? (
                        <>
                          <Check className="w-2.5 h-2.5 text-emerald-600" />
                          <span className="text-emerald-700">Copied</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-2.5 h-2.5" />
                          <span>Copy Subject</span>
                        </>
                      )}
                    </button>
                  </div>
                  {isEditingDraft ? (
                    <Input
                      value={draftSubject}
                      onChange={(e) => setDraftSubject(e.target.value)}
                      className="text-xs font-medium text-slate-800 h-8 border-indigo-200 focus-visible:ring-indigo-500"
                      placeholder="Enter email subject line..."
                    />
                  ) : (
                    <div className="text-xs font-semibold text-slate-900 bg-slate-50/70 px-2.5 py-1.5 rounded border border-slate-200/70">
                      {draftSubject || discovery.outreachEmailDraft.subject}
                    </div>
                  )}
                </div>

                {/* Email Body */}
                <div className="space-y-1 pt-1.5 border-t border-slate-100">
                  <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-slate-500">
                    <span>Email Body (Human 1-on-1 Peer Tone):</span>
                    <button
                      type="button"
                      onClick={handleCopyEmailBody}
                      className="text-indigo-600 hover:text-indigo-800 font-semibold inline-flex items-center gap-1 text-[10px]"
                    >
                      {copiedEmailBody ? (
                        <>
                          <Check className="w-2.5 h-2.5 text-emerald-600" />
                          <span className="text-emerald-700">Copied</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-2.5 h-2.5" />
                          <span>Copy Body</span>
                        </>
                      )}
                    </button>
                  </div>
                  {isEditingDraft ? (
                    <textarea
                      value={draftBody}
                      onChange={(e) => setDraftBody(e.target.value)}
                      rows={7}
                      className="w-full text-xs font-normal text-slate-800 p-2.5 rounded border border-indigo-200 focus:outline-hidden focus:ring-1 focus:ring-indigo-500 leading-relaxed font-sans"
                      placeholder="Enter customized email body..."
                    />
                  ) : (
                    <div className="text-xs text-slate-700 whitespace-pre-line leading-relaxed bg-slate-50/50 p-2.5 rounded border border-slate-200/60 font-sans">
                      {draftBody || discovery.outreachEmailDraft.body}
                    </div>
                  )}
                </div>
              </div>

              <div className="flex items-center justify-between text-[10px] text-slate-400 pt-0.5">
                <span>Purpose: {discovery.outreachEmailDraft.purpose}</span>
                <span>Low-friction CTA for quick meeting reply</span>
              </div>
            </div>
          )}

          {/* 7. Conservative Commercial Project Estimate Status */}
          {discovery.projectEstimate && (
            <div className="bg-slate-50/80 rounded-xl p-4 border border-slate-200/80 space-y-2">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <span className="text-[11px] font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                  <DollarSign className="w-3.5 h-3.5 text-emerald-600" />
                  <span>7. Commercial Project Estimate Status</span>
                </span>
                <Badge
                  variant="outline"
                  className="text-[10px] font-bold bg-amber-50 text-amber-800 border-amber-200"
                >
                  {discovery.projectEstimate.status}
                </Badge>
              </div>
              <p className="text-xs text-slate-700 font-medium">
                <span className="font-semibold text-slate-900">Reason: </span>
                {discovery.projectEstimate.reason}
              </p>
              {discovery.projectEstimate.scopeAssumptions?.length > 0 && (
                <div className="text-[11px] text-slate-500">
                  <span className="font-semibold text-slate-600">Guideline: </span>
                  {discovery.projectEstimate.scopeAssumptions.join(" ")}
                </div>
              )}
            </div>
          )}

          {/* 7. Research Sources & Verification Limitations */}
          {discovery.researchMetadata && (
            <div className="rounded-xl border border-slate-200 bg-white p-3.5 space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-slate-600 uppercase tracking-wider flex items-center gap-1.5">
                  <Globe className="w-3.5 h-3.5 text-slate-500" />
                  <span>Research Sources &amp; Audit Limitations</span>
                </span>
                <button
                  type="button"
                  onClick={() => setIsSourcesExpanded(!isSourcesExpanded)}
                  className="text-[11px] text-slate-500 hover:text-slate-700 font-medium inline-flex items-center gap-1"
                >
                  <span>{isSourcesExpanded ? "Hide Sources" : "View Sources & Disclaimers"}</span>
                  {isSourcesExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                </button>
              </div>

              {isSourcesExpanded && (
                <div className="pt-2 border-t border-slate-100 space-y-2.5 text-[11px]">
                  {discovery.researchMetadata.sources.length > 0 ? (
                    <div className="space-y-1">
                      <span className="font-semibold text-slate-700">Verified Sources:</span>
                      {discovery.researchMetadata.sources.map((s, idx) => (
                        <div key={idx} className="flex items-center justify-between bg-slate-50 p-2 rounded border border-slate-200">
                          <div className="flex items-center gap-2">
                            <ExternalLink className="w-3 h-3 text-slate-400" />
                            <span className="font-medium text-slate-800">{s.title || s.url}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <EvidenceBadge status={s.evidenceStatus} />
                            <span className="text-slate-400 text-[10px]">
                              Accessed: {new Date(s.dateAccessed).toLocaleDateString()}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-slate-500 italic">No external website source accessed; intelligence derived from CRM record.</p>
                  )}

                  {discovery.researchMetadata.limitations.length > 0 && (
                    <div className="space-y-1 pt-1">
                      <span className="font-semibold text-slate-700">Audit Limitations &amp; Disclaimers:</span>
                      <ul className="list-disc pl-4 text-slate-500 space-y-0.5">
                        {discovery.researchMetadata.limitations.map((lim, idx) => (
                          <li key={idx}>{lim}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

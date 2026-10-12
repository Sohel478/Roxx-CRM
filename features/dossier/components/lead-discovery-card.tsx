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
  MessageSquare,
  HelpCircle,
  Quote,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  getLeadDiscoveryAction,
  generateLeadDiscoveryAction,
} from "@/actions/lead-discovery";
import type { LeadDiscoveryData } from "@/lib/validations/lead-discovery";

interface LeadDiscoveryCardProps {
  leadId: string;
  leadName?: string;
  companyName?: string | null;
  initialDiscovery?: LeadDiscoveryData | null;
  onDiscoveryGenerated?: (discovery: LeadDiscoveryData) => void;
}

export function LeadDiscoveryCard({
  leadId,
  leadName,
  companyName,
  initialDiscovery,
  onDiscoveryGenerated,
}: LeadDiscoveryCardProps) {
  const [discovery, setDiscovery] = useState<LeadDiscoveryData | null>(
    initialDiscovery || null
  );
  const [isPending, startTransition] = useTransition();
  const [isExpanded, setIsExpanded] = useState(true);
  const [copiedPitch, setCopiedPitch] = useState(false);
  const [copiedHook, setCopiedHook] = useState(false);
  const [hasLoaded, setHasLoaded] = useState(Boolean(initialDiscovery));

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

  const handleGenerateOrRefresh = (force = true) => {
    startTransition(async () => {
      const res = await generateLeadDiscoveryAction(leadId, {
        forceRefresh: force,
      });
      if (res.success && res.data) {
        setDiscovery(res.data);
        if (onDiscoveryGenerated) {
          onDiscoveryGenerated(res.data);
        }
      }
    });
  };

  const handleCopyPitch = () => {
    if (!discovery) return;
    const text = [
      `Client Business: ${discovery.clientBusiness}`,
      `Current Needs: ${discovery.currentNeeds.join("; ")}`,
      `Recommendations: ${discovery.recommendations.join("; ")}`,
      `Target Focus Offering: ${discovery.targetOffering}`,
    ].join("\n");

    navigator.clipboard.writeText(text);
    setCopiedPitch(true);
    setTimeout(() => setCopiedPitch(false), 2000);
  };

  const handleCopyHook = () => {
    if (!discovery?.openingPitchHook) return;
    navigator.clipboard.writeText(discovery.openingPitchHook);
    setCopiedHook(true);
    setTimeout(() => setCopiedHook(false), 2000);
  };

  // 1. Initial Empty State (Not yet generated)
  if (hasLoaded && !discovery) {
    return (
      <div className="rounded-2xl border border-indigo-100 bg-gradient-to-br from-indigo-50/50 via-white to-sky-50/30 p-5 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="p-2.5 rounded-xl bg-indigo-600 text-white shadow-xs">
              <Sparkles className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-slate-900">
                  AI Client Discovery &amp; Sales Pitch Intelligence
                </h3>
                <Badge
                  variant="outline"
                  className="bg-indigo-50 text-indigo-700 border-indigo-200 text-[10px] font-semibold"
                >
                  Discovery Phase
                </Badge>
              </div>
              <p className="text-xs text-slate-500 mt-1 max-w-xl">
                Synthesize {companyName || leadName || "client"}&apos;s business profile,
                diagnose current needs, and match against our company focus to formulate
                the exact pitch recommendations for your discovery call.
              </p>
            </div>
          </div>

          <Button
            onClick={() => handleGenerateOrRefresh(true)}
            disabled={isPending}
            size="sm"
            className="gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold shadow-xs shrink-0"
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
            <div className="flex items-center gap-2">
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
              ) : (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
                  ⚡ Built-in AI Engine
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
        <div className="flex items-center gap-2">
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

          <button
            type="button"
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
            title={isExpanded ? "Collapse brief" : "Expand brief"}
          >
            {isExpanded ? (
              <ChevronUp className="w-4 h-4" />
            ) : (
              <ChevronDown className="w-4 h-4" />
            )}
          </button>
        </div>
      </div>

      {/* Card Content */}
      {isExpanded && discovery && (
        <div className="p-5 space-y-4">
          {/* Top Row: Business Overview & Current Discovery Needs */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* a) Client Business & Background */}
            <div className="bg-slate-50/80 rounded-xl p-4 border border-slate-200/80 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                  <Building2 className="w-3.5 h-3.5 text-indigo-600" />
                  <span>a) Client Business Profile</span>
                </span>
                <Badge
                  variant="secondary"
                  className="bg-indigo-50 text-indigo-700 border-indigo-200 font-semibold text-[10px]"
                >
                  {discovery.clientBusiness}
                </Badge>
              </div>
              <p className="text-xs text-slate-700 leading-relaxed font-medium">
                {discovery.businessSummary}
              </p>
            </div>

            {/* b) Current Needs & Pain Points */}
            <div className="bg-amber-50/40 rounded-xl p-4 border border-amber-200/70 space-y-2">
              <span className="text-[11px] font-bold text-amber-800 uppercase tracking-wider flex items-center gap-1.5">
                <Target className="w-3.5 h-3.5 text-amber-600" />
                <span>b) Current Discovery Needs &amp; Pain Points</span>
              </span>
              <ul className="space-y-1.5">
                {discovery.currentNeeds.map((need, idx) => (
                  <li
                    key={idx}
                    className="text-xs text-slate-700 flex items-start gap-2"
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500 mt-1.5 shrink-0" />
                    <span>{need}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* c) Strategic Pitch Recommendation (Highlighted Callout) */}
          <div className="bg-blue-50/70 rounded-xl p-4 border border-blue-200 space-y-2.5">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <span className="text-[11px] font-bold text-blue-900 uppercase tracking-wider flex items-center gap-1.5">
                <Lightbulb className="w-4 h-4 text-blue-600" />
                <span>Strategic Pitch Recommendation (Our Focus)</span>
              </span>
              <span className="text-xs font-bold text-blue-700 bg-blue-100/80 px-2.5 py-0.5 rounded-lg border border-blue-200">
                Focus Offering: {discovery.targetOffering}
              </span>
            </div>

            <div className="space-y-1.5">
              {discovery.recommendations.map((rec, rIdx) => (
                <div
                  key={rIdx}
                  className="text-xs text-slate-800 font-medium flex items-start gap-2"
                >
                  <span className="text-blue-600 font-bold text-sm leading-none mt-0.5">
                    •
                  </span>
                  <span>{rec}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Bottom Grid: Discovery Questions & Opening Pitch Hook */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
            {/* d) Discovery Talking Points / Questions */}
            <div className="bg-white rounded-xl p-3.5 border border-slate-200 space-y-2">
              <span className="text-[11px] font-bold text-slate-600 uppercase tracking-wider flex items-center gap-1.5">
                <HelpCircle className="w-3.5 h-3.5 text-indigo-500" />
                <span>Discovery Questions for Call / Meeting</span>
              </span>
              <ul className="space-y-1.5">
                {discovery.talkingPoints.map((tp, tIdx) => (
                  <li
                    key={tIdx}
                    className="text-xs text-slate-600 flex items-start gap-2 italic"
                  >
                    <span className="text-indigo-500 font-bold not-italic">Q{tIdx + 1}:</span>
                    <span>&ldquo;{tp}&rdquo;</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* e) Opening Pitch Hook */}
            {discovery.openingPitchHook && (
              <div className="bg-indigo-50/30 rounded-xl p-3.5 border border-indigo-100 flex flex-col justify-between space-y-2">
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-indigo-900 uppercase tracking-wider flex items-center gap-1.5">
                      <Quote className="w-3.5 h-3.5 text-indigo-600" />
                      <span>Ready-to-Use Opening Hook</span>
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
                  <p className="text-xs text-slate-700 italic mt-1.5 leading-relaxed bg-white/80 p-2.5 rounded-lg border border-indigo-50">
                    &ldquo;{discovery.openingPitchHook}&rdquo;
                  </p>
                </div>
                <div className="flex items-center justify-between text-[10px] text-slate-400 pt-1">
                  <span>Speak this in opening 30 seconds of phone call or email intro</span>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

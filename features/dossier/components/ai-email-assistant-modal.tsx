"use client";

import { useState } from "react";
import {
  Sparkles,
  X,
  Loader2,
  CheckCircle2,
  Globe,
  Briefcase,
  ShieldCheck,
  Send,
  ArrowRight,
  HelpCircle,
  Linkedin,
  Layers,
  Award,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { generateLeadAiEmailAction } from "@/actions/ai-email";
import type {
  AiEmailObjective,
  AiEmailTone,
  AiEmailSuggestion,
  LeadResearchBrief,
} from "@/lib/ai/lead-researcher";

interface AiEmailAssistantModalProps {
  leadId: string;
  leadName: string;
  companyName?: string | null;
  jobTitle?: string | null;
  customerLinkedin?: string | null;
  companyLinkedin?: string | null;
  website?: string | null;
  onApplyEmail: (subject: string, body: string) => void;
  onClose: () => void;
}

export function AiEmailAssistantModal({
  leadId,
  leadName,
  companyName,
  jobTitle,
  customerLinkedin,
  companyLinkedin,
  website,
  onApplyEmail,
  onClose,
}: AiEmailAssistantModalProps) {
  const [objective, setObjective] = useState<AiEmailObjective>("INITIAL_OUTREACH");
  const [tone, setTone] = useState<AiEmailTone>("PROFESSIONAL");
  const [customInstruction, setCustomInstruction] = useState("");
  const [valueProposition, setValueProposition] = useState("");

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{
    researchBrief: LeadResearchBrief;
    suggestion: AiEmailSuggestion;
    deliverability: { score: number; rating: string };
  } | null>(null);

  const handleGenerate = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await generateLeadAiEmailAction({
        leadId,
        objective,
        tone,
        customInstruction: customInstruction.trim() || undefined,
        valueProposition: valueProposition.trim() || undefined,
      });

      if (res.success && res.data) {
        setResult(res.data);
      } else {
        setError(res.error || "Failed to generate AI email");
      }
    } catch (err: unknown) {
      setError((err as Error)?.message || "Failed to connect to AI engine");
    } finally {
      setIsLoading(false);
    }
  };

  const handleApply = () => {
    if (!result) return;
    onApplyEmail(result.suggestion.subject, result.suggestion.body);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[92vh] flex flex-col shadow-2xl border border-slate-100 animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-gradient-to-r from-blue-50/50 via-indigo-50/30 to-purple-50/50">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-xs">
              <Sparkles className="w-5 h-5 text-blue-100" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <span>AI Lead Research &amp; Email Assistant</span>
                <Badge variant="secondary" className="bg-blue-100 text-blue-800 text-[10px]">
                  Bespoke Outreach
                </Badge>
              </h2>
              <p className="text-xs text-slate-500">
                Studies {leadName}&apos;s role, company, and web presence to suggest high-converting copy
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            type="button"
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* Lead Context Snapshot */}
          <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3.5 flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-700 font-bold flex items-center justify-center text-xs">
                {leadName.charAt(0)}
              </div>
              <div>
                <span className="font-bold text-slate-900 block">{leadName}</span>
                <span className="text-[11px] text-slate-500">
                  {jobTitle || "Stakeholder"} • {companyName || "Organization"}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2 text-[11px]">
              {(customerLinkedin || companyLinkedin) && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-100/70 text-blue-700 rounded-md font-medium">
                  <Linkedin className="w-3 h-3" />
                  <span>LinkedIn Linked</span>
                </span>
              )}
              {website && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-100/70 text-emerald-700 rounded-md font-medium">
                  <Globe className="w-3 h-3" />
                  <span>Website Active</span>
                </span>
              )}
            </div>
          </div>

          {error && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl">
              {error}
            </div>
          )}

          {/* Configuration Form */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Outreach Objective
              </label>
              <select
                value={objective}
                onChange={(e) => setObjective(e.target.value as AiEmailObjective)}
                className="w-full text-xs rounded-xl border border-slate-200 bg-white px-3 py-2 text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="INITIAL_OUTREACH">Initial Discovery &amp; Problem Fit</option>
                <option value="MEETING_INVITE">Product Demo / Meeting Invite</option>
                <option value="FOLLOW_UP">Follow-Up on Previous Touchpoint</option>
                <option value="VALUE_CASE_STUDY">Value Proposition &amp; Case Study</option>
                <option value="RE_ENGAGEMENT">Stale Lead Re-Engagement</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Email Tone
              </label>
              <select
                value={tone}
                onChange={(e) => setTone(e.target.value as AiEmailTone)}
                className="w-full text-xs rounded-xl border border-slate-200 bg-white px-3 py-2 text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="PROFESSIONAL">Professional &amp; Direct</option>
                <option value="WARM">Warm &amp; Conversational</option>
                <option value="EXECUTIVE">Concise Executive (C-Suite)</option>
                <option value="CONSULTATIVE">Consultative &amp; Analytical</option>
              </select>
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Special Note / Custom Focus <span className="text-slate-400 font-normal">(optional)</span>
              </label>
              <Input
                type="text"
                value={customInstruction}
                onChange={(e) => setCustomInstruction(e.target.value)}
                placeholder="e.g. Mention our new mobile app, or emphasize quick 1-week setup..."
                className="text-xs"
              />
            </div>
          </div>

          {/* Generate Button */}
          {!result && (
            <div className="pt-2">
              <Button
                type="button"
                onClick={handleGenerate}
                disabled={isLoading}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs h-10 gap-2 shadow-xs"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Researching Lead &amp; Synthesizing Email...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    <span>Study Lead &amp; Suggest Email</span>
                  </>
                )}
              </Button>
            </div>
          )}

          {/* Results Display */}
          {result && (
            <div className="space-y-4 pt-2 border-t border-slate-100 animate-in fade-in duration-200">
              {/* Research Insights Card */}
              <div className="bg-indigo-50/70 border border-indigo-100 rounded-xl p-3.5 space-y-2 text-xs text-indigo-950">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 font-bold text-indigo-900">
                    <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                    <span>AI Research Brief</span>
                  </div>
                  <span className="text-[10px] text-indigo-500 font-medium">
                    Synthesized from role, company &amp; web
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
                  <div className="bg-white/80 p-2.5 rounded-lg border border-indigo-100/60">
                    <span className="font-bold text-indigo-900 block mb-0.5">Persona Insight:</span>
                    <span className="text-slate-700">{result.researchBrief.personaInsights}</span>
                  </div>
                  <div className="bg-white/80 p-2.5 rounded-lg border border-indigo-100/60">
                    <span className="font-bold text-indigo-900 block mb-0.5">Company Focus:</span>
                    <span className="text-slate-700">{result.researchBrief.companyFocus}</span>
                  </div>
                </div>

                <div className="bg-white/80 p-2.5 rounded-lg border border-indigo-100/60 text-[11px]">
                  <span className="font-bold text-indigo-900 block mb-0.5">Personalized Hook:</span>
                  <span className="text-slate-700 italic">&ldquo;{result.researchBrief.personalizedHook}&rdquo;</span>
                </div>

                {result.researchBrief.matchedSkillset && (
                  <div className="bg-purple-50/80 p-2.5 rounded-lg border border-purple-200 text-[11px] space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-purple-900 flex items-center gap-1">
                        <Layers className="w-3.5 h-3.5 text-purple-600" />
                        Matched Capability: {result.researchBrief.matchedSkillset.primaryCapability}
                      </span>
                      <span className="text-[10px] text-purple-700 font-medium">
                        {result.researchBrief.matchedSkillset.peerToneGuidance}
                      </span>
                    </div>
                    {result.researchBrief.matchedSkillset.matchedCaseStudy && (
                      <div className="text-[10px] text-purple-800">
                        <span className="font-semibold">Relevant Proof Point: </span>
                        {result.researchBrief.matchedSkillset.matchedCaseStudy.metric && (
                          <span className="font-bold text-emerald-700 mr-1">
                            [{result.researchBrief.matchedSkillset.matchedCaseStudy.metric}]
                          </span>
                        )}
                        {result.researchBrief.matchedSkillset.matchedCaseStudy.summary}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Generated Subject & Body */}
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-800">
                    Suggested Personalized Email
                  </span>
                  <div className="flex items-center gap-1.5">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                    <span className="text-[11px] font-bold text-emerald-700">
                      Deliverability: {result.deliverability.score}/100
                    </span>
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-500 mb-1">Subject:</label>
                  <Input
                    type="text"
                    value={result.suggestion.subject}
                    readOnly
                    className="text-xs font-semibold bg-slate-50 text-slate-900"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-500 mb-1">Message Body:</label>
                  <textarea
                    rows={7}
                    value={result.suggestion.body}
                    readOnly
                    className="w-full text-xs p-3 rounded-xl border border-slate-200 bg-slate-50 text-slate-900 leading-relaxed font-normal resize-y"
                  />
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-between gap-3 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleGenerate}
                  disabled={isLoading}
                  className="text-xs h-9"
                >
                  <Sparkles className="w-3.5 h-3.5 mr-1 text-blue-600" />
                  Regenerate
                </Button>

                <Button
                  type="button"
                  size="sm"
                  onClick={handleApply}
                  className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs h-9 gap-1.5 shadow-xs"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Insert into Composer</span>
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

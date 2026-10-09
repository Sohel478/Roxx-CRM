"use client";

import { useState, useEffect } from "react";
import {
  Sparkles,
  X,
  Loader2,
  CheckCircle2,
  ShieldCheck,
  Send,
  Calendar,
  Clock,
  Edit2,
  ChevronRight,
  ArrowRight,
  ArrowLeft,
  Check,
  AlertTriangle,
  Users2,
  Eye,
  RefreshCw,
  UserCheck,
  Zap,
  SlidersHorizontal,
  Mail,
  Layers,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  studyMarketingBatchAiAction,
  scheduleAiBatchCampaignAction,
  getAiConfigAction,
} from "@/actions/ai-email";
import { assignMarketingBatchAction } from "@/actions/marketing";
import { getUsersAction, type UserItem } from "@/actions/users";
import type {
  StudiedLeadItem,
  BatchStudyResult,
} from "@/lib/ai/batch-study-engine";
import type {
  AiEmailObjective,
  AiEmailTone,
} from "@/lib/ai/lead-researcher";
import type { MarketingBatchItem } from "@/lib/validations/marketing";

interface AiBatchStudyModalProps {
  batch: MarketingBatchItem;
  onCampaignScheduled: () => void;
  onClose: () => void;
}

export function AiBatchStudyModal({
  batch,
  onCampaignScheduled,
  onClose,
}: AiBatchStudyModalProps) {
  // Steps: CONFIG -> STUDYING -> REVIEW_TEMPLATES -> SCHEDULE_TIMING -> CONFIRMED
  const [currentStep, setCurrentStep] = useState<
    "CONFIG" | "STUDYING" | "REVIEW_TEMPLATES" | "SCHEDULE_TIMING" | "CONFIRMED"
  >("CONFIG");

  // Mode: MANUAL (Review templates then schedule) vs AUTO (1-Click autonomous launch)
  const [executionMode, setExecutionMode] = useState<"MANUAL" | "AUTO">("MANUAL");

  // Representative Assignment State
  const [assignedRepId, setAssignedRepId] = useState<string | null>(
    batch.assignedToId || batch.ownerId || null
  );
  const [assignedRepName, setAssignedRepName] = useState<string | null>(
    batch.assignedToName || batch.ownerName || null
  );
  const [assignedRepEmail, setAssignedRepEmail] = useState<string | null>(
    batch.assignedToEmail || null
  );
  const [users, setUsers] = useState<UserItem[]>([]);
  const [isChangingAssignee, setIsChangingAssignee] = useState(false);
  const [selectedAssigneeId, setSelectedAssigneeId] = useState<string>("");
  const [isAssigning, setIsAssigning] = useState(false);

  // Configuration state
  const [campaignName, setCampaignName] = useState(`${batch.name} — AI Outreach`);
  const [objective, setObjective] = useState<AiEmailObjective>("INITIAL_OUTREACH");
  const [tone, setTone] = useState<AiEmailTone>("PROFESSIONAL");
  const [valueProposition, setValueProposition] = useState("");
  const [customInstruction, setCustomInstruction] = useState("");

  // Scheduling & Timing state
  const [scheduleMode, setScheduleMode] = useState<"now" | "later">("now");
  const [scheduledDateTime, setScheduledDateTime] = useState(
    new Date(Date.now() + 3600000).toISOString().slice(0, 16)
  );
  const [pacingMinutes, setPacingMinutes] = useState(2);
  const [enableFollowUp, setEnableFollowUp] = useState(true);
  const [followUpDays, setFollowUpDays] = useState(3);

  // Studying & Review state
  const [isStudying, setIsStudying] = useState(false);
  const [studyResult, setStudyResult] = useState<BatchStudyResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Edit individual lead draft in review
  const [editingLead, setEditingLead] = useState<StudiedLeadItem | null>(null);
  const [editSubject, setEditSubject] = useState("");
  const [editBody, setEditBody] = useState("");
  const [editFollowUpSubject, setEditFollowUpSubject] = useState("");
  const [editFollowUpBody, setEditFollowUpBody] = useState("");
  const [isScheduling, setIsScheduling] = useState(false);

  const [activeEngine, setActiveEngine] = useState<{
    provider: "builtin" | "openai" | "gemini";
    hasKey: boolean;
  }>({ provider: "builtin", hasKey: false });

  useEffect(() => {
    let isMounted = true;
    getAiConfigAction().then((res) => {
      if (isMounted && res.success && res.data) {
        setActiveEngine({
          provider: res.data.aiProvider || "builtin",
          hasKey: Boolean(res.data.apiKey && res.data.apiKey.trim().length > 0),
        });
      }
    });
    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    let isMounted = true;
    getUsersAction().then((res) => {
      if (isMounted && res.success && res.data) {
        setUsers(res.data);
        if (res.data.length > 0) {
          const currentId = batch.assignedToId || batch.ownerId;
          const found = res.data.find((u) => u.id === currentId);
          if (found) {
            setSelectedAssigneeId(found.id);
            if (!assignedRepName) setAssignedRepName(found.name);
            if (!assignedRepEmail) setAssignedRepEmail(found.email);
          } else {
            setSelectedAssigneeId(res.data[0].id);
          }
        }
      }
    });
    return () => {
      isMounted = false;
    };
  }, [batch.assignedToId, batch.ownerId, assignedRepName, assignedRepEmail]);

  const handleAssignRep = async () => {
    if (!selectedAssigneeId) return;
    setIsAssigning(true);
    setError(null);
    try {
      const res = await assignMarketingBatchAction({
        batchId: batch.id,
        assignedToId: selectedAssigneeId,
        assignLeadsToRep: true,
      });
      if (res.success) {
        const foundUser = users.find((u) => u.id === selectedAssigneeId);
        setAssignedRepId(selectedAssigneeId);
        setAssignedRepName(foundUser?.name || "Sales Rep");
        setAssignedRepEmail(foundUser?.email || null);
        setIsChangingAssignee(false);
      } else {
        setError(res.error || "Failed to assign representative.");
      }
    } catch (err: unknown) {
      setError((err as Error)?.message || "Failed to assign representative.");
    } finally {
      setIsAssigning(false);
    }
  };

  // Step 1 -> Step 2: Handle AI Study Action (Manual Mode)
  const handleStartStudy = async () => {
    if (!assignedRepId) {
      setError("Cannot study batch: Please assign a sales representative to do the job before AI can study or email leads.");
      return;
    }
    setIsStudying(true);
    setCurrentStep("STUDYING");
    setError(null);

    try {
      const res = await studyMarketingBatchAiAction({
        batchId: batch.id,
        objective,
        tone,
        valueProposition: valueProposition.trim() || undefined,
        customInstruction: customInstruction.trim() || undefined,
        enableFollowUp,
        followUpDays,
      });

      if (res.success && res.data) {
        setStudyResult(res.data);
        setCurrentStep("REVIEW_TEMPLATES");
      } else {
        setError(res.error || "Failed to study batch leads");
        setCurrentStep("CONFIG");
      }
    } catch (err: unknown) {
      setError((err as Error)?.message || "Failed to connect to AI study engine");
      setCurrentStep("CONFIG");
    } finally {
      setIsStudying(false);
    }
  };

  // Auto AI (1-Click Autonomous Launch)
  const handleAutoAiLaunch = async () => {
    if (!assignedRepId) {
      setError("Cannot launch outreach: Please assign a sales representative to take ownership of this batch first.");
      return;
    }
    setIsStudying(true);
    setCurrentStep("STUDYING");
    setError(null);

    try {
      // 1. Study all leads and generate bespoke human emails
      const studyRes = await studyMarketingBatchAiAction({
        batchId: batch.id,
        objective,
        tone,
        valueProposition: valueProposition.trim() || undefined,
        customInstruction: customInstruction.trim() || undefined,
        enableFollowUp: true,
        followUpDays: 3,
      });

      if (!studyRes.success || !studyRes.data) {
        setError(studyRes.error || "Autonomous AI failed to study batch leads");
        setCurrentStep("CONFIG");
        setIsStudying(false);
        return;
      }

      setStudyResult(studyRes.data);

      // 2. Automatically schedule queue starting immediately with optimal pacing
      const leadsPayload = studyRes.data.leads.map((l) => ({
        leadId: l.leadId,
        leadName: l.leadName,
        leadEmail: l.leadEmail,
        companyName: l.companyName,
        jobTitle: l.jobTitle,
        initialSubject: l.initialEmail.subject,
        initialBody: l.initialEmail.body,
        followUpSubject: l.followUpEmail?.subject || null,
        followUpBody: l.followUpEmail?.body || null,
      }));

      const schedRes = await scheduleAiBatchCampaignAction({
        batchId: batch.id,
        campaignName: campaignName.trim() || `${batch.name} — Autonomous AI Outreach`,
        objective,
        tone,
        startDate: "now",
        pacingMinutes: 2,
        enableFollowUp: true,
        followUpDays: 3,
        leads: leadsPayload,
      });

      if (schedRes.success) {
        setCurrentStep("CONFIRMED");
        onCampaignScheduled();
      } else {
        setError(schedRes.error || "Failed to commit autonomous AI campaign");
        setCurrentStep("REVIEW_TEMPLATES");
      }
    } catch (err: unknown) {
      setError((err as Error)?.message || "Autonomous launch encountered an unexpected error");
      setCurrentStep("CONFIG");
    } finally {
      setIsStudying(false);
    }
  };

  // Open Edit Modal for a specific lead
  const handleOpenEdit = (lead: StudiedLeadItem) => {
    setEditingLead(lead);
    setEditSubject(lead.initialEmail.subject);
    setEditBody(lead.initialEmail.body);
    setEditFollowUpSubject(lead.followUpEmail?.subject || "");
    setEditFollowUpBody(lead.followUpEmail?.body || "");
  };

  // Save changes to individual lead copy
  const handleSaveLeadEdit = () => {
    if (!editingLead || !studyResult) return;

    const updatedLeads = studyResult.leads.map((l) => {
      if (l.leadId === editingLead.leadId) {
        return {
          ...l,
          initialEmail: {
            ...l.initialEmail,
            subject: editSubject.trim() || l.initialEmail.subject,
            body: editBody.trim() || l.initialEmail.body,
          },
          followUpEmail: l.followUpEmail
            ? {
                ...l.followUpEmail,
                subject: editFollowUpSubject.trim() || l.followUpEmail.subject,
                body: editFollowUpBody.trim() || l.followUpEmail.body,
              }
            : undefined,
        };
      }
      return l;
    });

    setStudyResult({
      ...studyResult,
      leads: updatedLeads,
    });
    setEditingLead(null);
  };

  // Final Scheduling Action (from SCHEDULE_TIMING step)
  const handleConfirmAndSchedule = async () => {
    if (!studyResult) return;
    setIsScheduling(true);
    setError(null);

    try {
      const leadsPayload = studyResult.leads.map((l) => ({
        leadId: l.leadId,
        leadName: l.leadName,
        leadEmail: l.leadEmail,
        companyName: l.companyName,
        jobTitle: l.jobTitle,
        initialSubject: l.initialEmail.subject,
        initialBody: l.initialEmail.body,
        followUpSubject: l.followUpEmail?.subject || null,
        followUpBody: l.followUpEmail?.body || null,
      }));

      const res = await scheduleAiBatchCampaignAction({
        batchId: batch.id,
        campaignName: campaignName.trim() || `${batch.name} — AI Outreach`,
        objective,
        tone,
        startDate: scheduleMode === "now" ? "now" : new Date(scheduledDateTime).toISOString(),
        pacingMinutes,
        enableFollowUp,
        followUpDays,
        leads: leadsPayload,
      });

      if (res.success) {
        setCurrentStep("CONFIRMED");
        onCampaignScheduled();
      } else {
        setError(res.error || "Failed to schedule AI campaign");
      }
    } catch (err: unknown) {
      setError((err as Error)?.message || "Failed to commit scheduled AI campaign");
    } finally {
      setIsScheduling(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-3xl w-full max-h-[92vh] flex flex-col shadow-2xl border border-slate-100 animate-in fade-in zoom-in-95 duration-150">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-gradient-to-r from-blue-50/60 via-indigo-50/30 to-purple-50/60">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-xs">
              <Sparkles className="w-5 h-5 text-blue-100" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-base font-bold text-slate-900">
                  AI Batch Outreach &amp; Campaign Studio
                </h2>
                <Badge variant="secondary" className="bg-blue-100 text-blue-800 text-[10px]">
                  {batch.name} ({batch.leadCount} leads)
                </Badge>
                {activeEngine.provider === "openai" && activeEngine.hasKey ? (
                  <Badge className="bg-emerald-100 text-emerald-800 border-emerald-300 text-[10px] font-semibold">
                    ✨ OpenAI (GPT-4o-mini)
                  </Badge>
                ) : activeEngine.provider === "gemini" && activeEngine.hasKey ? (
                  <Badge className="bg-purple-100 text-purple-800 border-purple-300 text-[10px] font-semibold">
                    ✨ Google Gemini 1.5
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-slate-600 bg-slate-50 border-slate-200 text-[10px]">
                    ⚡ Built-in Neural Engine
                  </Badge>
                )}
              </div>
              <p className="text-xs text-slate-500">
                Studies each lead profile to write bespoke human-tone emails &amp; unique subject lines
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            type="button"
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Step Progression Breadcrumb Bar */}
        {currentStep !== "CONFIRMED" && (
          <div className="px-6 py-2.5 bg-slate-50/80 border-b border-slate-100 flex items-center justify-between text-xs text-slate-500">
            <div className="flex items-center gap-2">
              <span
                className={`flex items-center gap-1 font-semibold ${
                  currentStep === "CONFIG" ? "text-blue-600 font-bold" : "text-slate-600"
                }`}
              >
                <span className="w-4 h-4 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-[10px]">
                  1
                </span>
                Setup &amp; Rep
              </span>
              <ChevronRight className="w-3.5 h-3.5 text-slate-300" />

              <span
                className={`flex items-center gap-1 font-semibold ${
                  currentStep === "STUDYING"
                    ? "text-blue-600 font-bold"
                    : currentStep === "REVIEW_TEMPLATES" || currentStep === "SCHEDULE_TIMING"
                    ? "text-emerald-700 font-medium"
                    : "text-slate-400"
                }`}
              >
                <span className="w-4 h-4 rounded-full bg-slate-200 text-slate-700 flex items-center justify-center text-[10px]">
                  2
                </span>
                AI Lead Study
              </span>
              <ChevronRight className="w-3.5 h-3.5 text-slate-300" />

              {executionMode === "MANUAL" ? (
                <>
                  <span
                    className={`flex items-center gap-1 font-semibold ${
                      currentStep === "REVIEW_TEMPLATES"
                        ? "text-blue-600 font-bold"
                        : currentStep === "SCHEDULE_TIMING"
                        ? "text-emerald-700 font-medium"
                        : "text-slate-400"
                    }`}
                  >
                    <span className="w-4 h-4 rounded-full bg-slate-200 text-slate-700 flex items-center justify-center text-[10px]">
                      3
                    </span>
                    Review Templates
                  </span>
                  <ChevronRight className="w-3.5 h-3.5 text-slate-300" />

                  <span
                    className={`flex items-center gap-1 font-semibold ${
                      currentStep === "SCHEDULE_TIMING" ? "text-blue-600 font-bold" : "text-slate-400"
                    }`}
                  >
                    <span className="w-4 h-4 rounded-full bg-slate-200 text-slate-700 flex items-center justify-center text-[10px]">
                      4
                    </span>
                    Schedule &amp; Timing
                  </span>
                </>
              ) : (
                <span
                  className={`flex items-center gap-1 font-semibold ${
                    currentStep === "STUDYING" ? "text-blue-600 font-bold" : "text-slate-400"
                  }`}
                >
                  <span className="w-4 h-4 rounded-full bg-slate-200 text-slate-700 flex items-center justify-center text-[10px]">
                    3
                  </span>
                  Autonomous Launch
                </span>
              )}
            </div>

            <div className="text-[11px] font-medium text-slate-500">
              {executionMode === "MANUAL" ? "Manual Review Flow" : "1-Click Autonomous Flow"}
            </div>
          </div>
        )}

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* ================= STEP 1: CONFIGURATION ================= */}
          {currentStep === "CONFIG" && (
            <div className="space-y-4">
              {/* Mode Selection Tabs: Manual Review vs Auto AI */}
              <div className="bg-slate-100/80 p-1 rounded-xl flex items-center text-xs">
                <button
                  type="button"
                  onClick={() => setExecutionMode("MANUAL")}
                  className={`flex-1 py-2 px-3 rounded-lg font-bold flex items-center justify-center gap-2 transition-all cursor-pointer ${
                    executionMode === "MANUAL"
                      ? "bg-white text-blue-700 shadow-xs border border-slate-200/60"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  <Eye className="w-3.5 h-3.5 text-blue-600" />
                  <span>Manual Review (Review Templates &rarr; Set Schedule)</span>
                  <Badge variant="secondary" className="bg-blue-50 text-blue-700 text-[10px] py-0 px-1.5 font-normal">
                    Recommended
                  </Badge>
                </button>

                <button
                  type="button"
                  onClick={() => setExecutionMode("AUTO")}
                  className={`flex-1 py-2 px-3 rounded-lg font-bold flex items-center justify-center gap-2 transition-all cursor-pointer ${
                    executionMode === "AUTO"
                      ? "bg-white text-purple-700 shadow-xs border border-slate-200/60"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  <Zap className="w-3.5 h-3.5 text-purple-600" />
                  <span>Auto AI (1-Click Autonomous Launch)</span>
                </button>
              </div>

              {/* Mode Explanatory Notice */}
              {executionMode === "MANUAL" ? (
                <div className="bg-blue-50/60 border border-blue-100 rounded-xl p-3 text-xs text-blue-900 flex items-start gap-2">
                  <Eye className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                  <div className="space-y-0.5">
                    <p className="font-semibold text-blue-950">Manual Review Workflow:</p>
                    <p className="text-[11px] text-blue-800 leading-relaxed">
                      1. AI studies each lead individually and generates custom subject lines and bespoke human copy.<br />
                      2. You review and inspect every lead template before anything is scheduled.<br />
                      3. After reviewing, you pick your dispatch time and launch the sequence.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="bg-purple-50/60 border border-purple-100 rounded-xl p-3 text-xs text-purple-900 flex items-start gap-2">
                  <Zap className="w-4 h-4 text-purple-600 shrink-0 mt-0.5" />
                  <div className="space-y-0.5">
                    <p className="font-semibold text-purple-950">Autonomous AI Mode (Zero Manual Intervention):</p>
                    <p className="text-[11px] text-purple-800 leading-relaxed">
                      AI will analyze every lead, craft human-nature bespoke email templates &amp; unique subject lines, select an optimal dispatch time (staggered 2m spacing, 3-day follow-up cadence), and launch outreach automatically with 1 click.
                    </p>
                  </div>
                </div>
              )}

              {/* Assigned Sales Representative Safeguard */}
              {assignedRepId ? (
                <div className="bg-blue-50/70 border border-blue-200/80 rounded-xl p-3.5 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <UserCheck className="w-4 h-4 text-blue-600" />
                      <span className="text-xs font-bold text-slate-900">
                        Assigned Representative:{" "}
                        <span className="text-blue-700">{assignedRepName || "Sales Rep"}</span>
                      </span>
                      {assignedRepEmail && (
                        <span className="text-[11px] text-slate-500 font-normal">
                          ({assignedRepEmail})
                        </span>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => setIsChangingAssignee(!isChangingAssignee)}
                      className="text-[11px] font-semibold text-blue-600 hover:text-blue-800 hover:underline cursor-pointer"
                    >
                      {isChangingAssignee ? "Cancel" : "Change Rep"}
                    </button>
                  </div>

                  {!isChangingAssignee ? (
                    <p className="text-[11px] text-slate-600">
                      AI will research each lead individually and craft outreach emails on behalf of{" "}
                      <strong>{assignedRepName}</strong>. Replies and follow-up activities will be assigned directly to them.
                    </p>
                  ) : (
                    <div className="pt-2 border-t border-blue-200/60 flex items-center gap-2">
                      <select
                        value={selectedAssigneeId}
                        onChange={(e) => setSelectedAssigneeId(e.target.value)}
                        className="flex-1 text-xs rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-slate-800 font-medium"
                      >
                        {users.map((u) => (
                          <option key={u.id} value={u.id}>
                            {u.name} ({u.email})
                          </option>
                        ))}
                      </select>
                      <Button
                        type="button"
                        size="sm"
                        onClick={handleAssignRep}
                        disabled={isAssigning}
                        className="bg-blue-600 hover:bg-blue-700 text-white text-xs h-7 px-3 cursor-pointer"
                      >
                        {isAssigning ? <Loader2 className="w-3 h-3 animate-spin" /> : "Save"}
                      </Button>
                    </div>
                  )}
                </div>
              ) : (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-3.5 space-y-2.5">
                  <div className="flex items-start gap-2 text-amber-800">
                    <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                    <div>
                      <h4 className="text-xs font-bold text-amber-900">
                        Action Required: Batch Unassigned
                      </h4>
                      <p className="text-[11px] text-amber-800 mt-0.5 leading-relaxed">
                        AI is strictly safeguarded against working on or picking unassigned leads. Please assign a sales representative to take ownership of this batch before running AI research or sending emails.
                      </p>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-amber-200/80 flex items-center gap-2">
                    <select
                      value={selectedAssigneeId}
                      onChange={(e) => setSelectedAssigneeId(e.target.value)}
                      className="flex-1 text-xs rounded-lg border border-amber-300 bg-white px-2.5 py-1.5 text-slate-800 font-medium"
                    >
                      <option value="" disabled>Select representative to assign...</option>
                      {users.map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.name} ({u.email}) — {u.role}
                        </option>
                      ))}
                    </select>
                    <Button
                      type="button"
                      size="sm"
                      onClick={handleAssignRep}
                      disabled={isAssigning || !selectedAssigneeId}
                      className="bg-amber-600 hover:bg-amber-700 text-white text-xs h-7 px-3 font-semibold cursor-pointer"
                    >
                      {isAssigning ? <Loader2 className="w-3 h-3 animate-spin" /> : "Assign Rep & Enable AI"}
                    </Button>
                  </div>
                </div>
              )}

              {/* Campaign Basic Info */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Campaign Name
                  </label>
                  <Input
                    type="text"
                    value={campaignName}
                    onChange={(e) => setCampaignName(e.target.value)}
                    placeholder="e.g. Q4 Executive Outreach Campaign"
                    className="text-xs"
                    required
                  />
                </div>

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
                    Core Offering / Value Proposition <span className="text-slate-400 font-normal">(optional override)</span>
                  </label>
                  <Input
                    type="text"
                    value={valueProposition}
                    onChange={(e) => setValueProposition(e.target.value)}
                    placeholder="e.g. accelerating sales team closing velocity and automating follow-ups"
                    className="text-xs"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Custom Context / Specific Focus <span className="text-slate-400 font-normal">(optional)</span>
                  </label>
                  <Input
                    type="text"
                    value={customInstruction}
                    onChange={(e) => setCustomInstruction(e.target.value)}
                    placeholder="e.g. emphasize our recent e-commerce analytics integration"
                    className="text-xs"
                  />
                </div>
              </div>

              {/* Submit Buttons depending on mode */}
              <div className="pt-2">
                {executionMode === "MANUAL" ? (
                  <Button
                    type="button"
                    onClick={handleStartStudy}
                    disabled={isStudying || !assignedRepId}
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs h-10 gap-2 shadow-xs disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                  >
                    <Sparkles className="w-4 h-4" />
                    <span>
                      {!assignedRepId
                        ? "Assign Sales Representative Above to Enable AI Study"
                        : `✨ Study All ${batch.leadCount} Leads & Review Drafts →`}
                    </span>
                  </Button>
                ) : (
                  <Button
                    type="button"
                    onClick={handleAutoAiLaunch}
                    disabled={isStudying || !assignedRepId}
                    className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white font-bold text-xs h-10 gap-2 shadow-xs disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                  >
                    <Zap className="w-4 h-4" />
                    <span>
                      {!assignedRepId
                        ? "Assign Sales Representative Above to Enable AI Launch"
                        : `⚡ Launch Autonomous AI Outreach (1-Click) →`}
                    </span>
                  </Button>
                )}
              </div>
            </div>
          )}

          {/* ================= STEP 2: STUDYING IN PROGRESS ================= */}
          {currentStep === "STUDYING" && (
            <div className="p-12 text-center space-y-4">
              <div className="relative w-16 h-16 mx-auto">
                <div className="absolute inset-0 rounded-full border-4 border-blue-100 animate-ping opacity-30" />
                <div className="w-16 h-16 rounded-full bg-blue-50 border-2 border-blue-200 flex items-center justify-center text-blue-600 mx-auto">
                  <Sparkles className="w-8 h-8 animate-pulse text-blue-600" />
                </div>
              </div>
              <div className="space-y-1">
                <h3 className="text-sm font-bold text-slate-900">
                  {executionMode === "MANUAL"
                    ? "AI is Studying Your Batch Leads"
                    : "Autonomous AI is Studying & Preparing Outreach"}
                </h3>
                <p className="text-xs text-slate-500 max-w-sm mx-auto leading-relaxed">
                  Analyzing roles, company domains, verified capabilities, and generating bespoke 1-on-1 subject lines and human-nature email copy...
                </p>
              </div>
              <div className="flex items-center justify-center gap-1.5 text-xs text-blue-600 font-semibold">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Processing {batch.leadCount} profiles...</span>
              </div>
            </div>
          )}

          {/* ================= STEP 3: REVIEW TEMPLATES (Lead Study & Template Review) ================= */}
          {currentStep === "REVIEW_TEMPLATES" && studyResult && (
            <div className="space-y-4">
              {/* Study Highlights */}
              <div className="bg-indigo-50/70 border border-indigo-100 rounded-xl p-3.5 space-y-1.5 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-indigo-950 flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span>AI Studied {studyResult.totalStudied} Leads Successfully</span>
                  </span>
                  <Badge variant="secondary" className="bg-indigo-100 text-indigo-800 text-[10px]">
                    Bespoke Custom Drafts Ready
                  </Badge>
                </div>
                <p className="text-[11px] text-indigo-900">
                  Review each lead&apos;s tailored subject line and copy below before proceeding to schedule dispatch timing.
                </p>
                <div className="flex flex-wrap gap-2 pt-1 text-[11px] text-indigo-900">
                  {studyResult.commonThemes.map((theme, idx) => (
                    <span key={idx} className="bg-white/80 px-2 py-0.5 rounded-md border border-indigo-100/70">
                      • {theme}
                    </span>
                  ))}
                </div>
              </div>

              {/* Leads Table */}
              <div className="border border-slate-200 rounded-xl overflow-hidden max-h-72 overflow-y-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold sticky top-0 z-10">
                    <tr>
                      <th className="py-2.5 px-3">Lead &amp; Company</th>
                      <th className="py-2.5 px-3">AI Subject Line</th>
                      <th className="py-2.5 px-3">Inbox Score</th>
                      <th className="py-2.5 px-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {studyResult.leads.map((item) => (
                      <tr key={item.leadId} className="hover:bg-slate-50/60 transition-colors">
                        <td className="py-2.5 px-3">
                          <span className="font-bold text-slate-900 block">{item.leadName}</span>
                          <span className="text-[11px] text-slate-500">
                            {item.jobTitle || "Executive"} • <strong className="text-slate-700">{item.companyName}</strong>
                          </span>
                        </td>
                        <td className="py-2.5 px-3 max-w-[220px]">
                          <span className="font-semibold text-slate-800 block truncate" title={item.initialEmail.subject}>
                            {item.initialEmail.subject}
                          </span>
                          <span className="text-[10px] text-slate-400 block truncate" title={item.researchBrief.personalizedHook}>
                            Hook: {item.researchBrief.personalizedHook}
                          </span>
                        </td>
                        <td className="py-2.5 px-3">
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                            <ShieldCheck className="w-3 h-3 text-emerald-600" />
                            {item.initialEmail.deliverabilityScore}/100
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-right">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => handleOpenEdit(item)}
                            className="text-[11px] h-7 px-2.5 text-slate-700 hover:text-blue-600 cursor-pointer"
                          >
                            <Edit2 className="w-3 h-3 mr-1" />
                            Inspect / Edit
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Action Buttons for Review Step */}
              <div className="flex items-center justify-between gap-3 pt-2 border-t border-slate-100">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentStep("CONFIG")}
                  className="text-xs h-9 cursor-pointer"
                >
                  <ArrowLeft className="w-3.5 h-3.5 mr-1" />
                  Back to Setup
                </Button>

                <Button
                  type="button"
                  size="sm"
                  onClick={() => setCurrentStep("SCHEDULE_TIMING")}
                  className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs h-9 gap-1.5 shadow-xs cursor-pointer"
                >
                  <span>Proceed to Schedule &amp; Timing</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>
          )}

          {/* ================= STEP 4: SCHEDULE & TIMING (Requested by user) ================= */}
          {currentStep === "SCHEDULE_TIMING" && studyResult && (
            <div className="space-y-4">
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 flex items-center justify-between text-xs">
                <div>
                  <h4 className="font-bold text-slate-900">
                    Templates Verified &amp; Ready for Dispatch
                  </h4>
                  <p className="text-[11px] text-slate-600 mt-0.5">
                    {studyResult.totalStudied} bespoke lead emails created for representative{" "}
                    <strong>{assignedRepName}</strong>. Now choose when and how fast to dispatch them.
                  </p>
                </div>
                <Badge className="bg-blue-600 text-white text-[11px]">
                  Step 2 of 2
                </Badge>
              </div>

              {/* Dispatch Schedule & Interval Pacing Settings */}
              <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3.5 shadow-2xs">
                <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                  <span className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                    <Clock className="w-4 h-4 text-blue-600" />
                    <span>Dispatch Schedule &amp; Interval Pacing</span>
                  </span>
                  <span className="text-[11px] text-slate-500">Protects sender reputation &amp; inbox placement</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1.5">
                      Start Timing
                    </label>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setScheduleMode("now")}
                        className={`flex-1 py-2 px-3 rounded-lg border font-semibold text-xs transition-colors cursor-pointer ${
                          scheduleMode === "now"
                            ? "bg-blue-600 text-white border-blue-600 shadow-2xs"
                            : "bg-white text-slate-700 border-slate-200 hover:bg-slate-100"
                        }`}
                      >
                        Start Now
                      </button>
                      <button
                        type="button"
                        onClick={() => setScheduleMode("later")}
                        className={`flex-1 py-2 px-3 rounded-lg border font-semibold text-xs transition-colors cursor-pointer ${
                          scheduleMode === "later"
                            ? "bg-blue-600 text-white border-blue-600 shadow-2xs"
                            : "bg-white text-slate-700 border-slate-200 hover:bg-slate-100"
                        }`}
                      >
                        Schedule Date
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1.5">
                      Delay Between Emails (Pacing)
                    </label>
                    <select
                      value={pacingMinutes}
                      onChange={(e) => setPacingMinutes(Number(e.target.value))}
                      className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-xs text-slate-800"
                    >
                      <option value={1}>1 minute delay (Rapid)</option>
                      <option value={2}>2 minutes delay (Recommended)</option>
                      <option value={3}>3 minutes delay (High Deliverability)</option>
                      <option value={5}>5 minutes delay (Conservative)</option>
                    </select>
                  </div>

                  {scheduleMode === "later" && (
                    <div className="sm:col-span-2">
                      <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                        Select Start Date &amp; Time
                      </label>
                      <Input
                        type="datetime-local"
                        value={scheduledDateTime}
                        onChange={(e) => setScheduledDateTime(e.target.value)}
                        className="text-xs bg-white"
                      />
                    </div>
                  )}
                </div>
              </div>

              {/* Automated Follow-Up Cadence Box */}
              <div className="bg-emerald-50/70 border border-emerald-200/80 rounded-xl p-4 space-y-2.5">
                <div className="flex items-center justify-between">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={enableFollowUp}
                      onChange={(e) => setEnableFollowUp(e.target.checked)}
                      className="rounded text-emerald-600 focus:ring-emerald-500 w-4 h-4 cursor-pointer"
                    />
                    <span className="text-xs font-bold text-emerald-950">
                      Automated AI Follow-Up Cadence
                    </span>
                  </label>
                  <Badge variant="outline" className="border-emerald-300 text-emerald-700 text-[10px]">
                    Auto-Cancels on Reply
                  </Badge>
                </div>

                <p className="text-[11px] text-emerald-800 leading-relaxed">
                  If the recipient does not respond within the waiting window, AI will automatically trigger a contextual Step 2 follow-up. When a lead replies in the CRM inbox, all future follow-ups are halted instantly.
                </p>

                {enableFollowUp && (
                  <div className="flex items-center gap-2 pt-1 text-xs">
                    <span className="text-emerald-900 font-semibold">Wait period if no reply:</span>
                    <select
                      value={followUpDays}
                      onChange={(e) => setFollowUpDays(Number(e.target.value))}
                      className="rounded-lg border border-emerald-300 bg-white px-2.5 py-1 text-xs text-emerald-950 font-bold"
                    >
                      <option value={2}>2 days</option>
                      <option value={3}>3 days (Standard)</option>
                      <option value={5}>5 days</option>
                      <option value={7}>7 days (Weekly)</option>
                    </select>
                  </div>
                )}
              </div>

              {/* Action Buttons for Schedule Step */}
              <div className="flex items-center justify-between gap-3 pt-2 border-t border-slate-100">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentStep("REVIEW_TEMPLATES")}
                  className="text-xs h-9 cursor-pointer"
                >
                  <ArrowLeft className="w-3.5 h-3.5 mr-1" />
                  Back to Review Templates
                </Button>

                <Button
                  type="button"
                  size="sm"
                  onClick={handleConfirmAndSchedule}
                  disabled={isScheduling}
                  className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs h-9 gap-1.5 shadow-xs cursor-pointer"
                >
                  {isScheduling ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Scheduling Queue...</span>
                    </>
                  ) : (
                    <>
                      <Send className="w-3.5 h-3.5" />
                      <span>
                        {scheduleMode === "now"
                          ? "🚀 Start Now as per Schedule"
                          : "📅 Commit Scheduled Outreach"}
                      </span>
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}

          {/* ================= STEP 5: SUCCESS CONFIRMATION ================= */}
          {currentStep === "CONFIRMED" && (
            <div className="p-8 text-center space-y-4">
              <div className="w-14 h-14 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center mx-auto shadow-xs">
                <Check className="w-7 h-7" />
              </div>
              <div className="space-y-1.5">
                <h3 className="text-base font-bold text-slate-900">
                  AI Campaign Scheduled &amp; Live!
                </h3>
                <p className="text-xs text-slate-600 max-w-md mx-auto leading-relaxed">
                  Your AI outreach campaign <strong>{campaignName}</strong> has been successfully scheduled under sales representative{" "}
                  <strong>{assignedRepName}</strong>.
                </p>
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs max-w-md mx-auto space-y-1 text-slate-700 text-left">
                  <div>• <strong>Dispatch Start:</strong> {scheduleMode === "now" ? "Immediately (queued)" : new Date(scheduledDateTime).toLocaleString()}</div>
                  <div>• <strong>Send Pacing:</strong> 1 email every {pacingMinutes} minutes</div>
                  {enableFollowUp && (
                    <div>• <strong>Automated Follow-Up:</strong> In {followUpDays} days if no client reply</div>
                  )}
                </div>
              </div>
              <div className="pt-2">
                <Button
                  type="button"
                  onClick={onClose}
                  className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs h-9 px-6 shadow-xs cursor-pointer"
                >
                  Done
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Modal for Inspecting & Editing Individual Lead Draft */}
        {editingLead && (
          <div className="fixed inset-0 z-60 bg-slate-900/60 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl max-w-xl w-full p-5 space-y-4 shadow-2xl border border-slate-100">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div>
                  <h4 className="text-sm font-bold text-slate-900">
                    Inspect &amp; Fine-Tune Email for {editingLead.leadName}
                  </h4>
                  <span className="text-[11px] text-slate-500">
                    {editingLead.companyName} • {editingLead.jobTitle || "Executive"}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setEditingLead(null)}
                  className="p-1 text-slate-400 hover:text-slate-600 rounded-md cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-3.5 max-h-[65vh] overflow-y-auto pr-1">
                <div>
                  <label className="block text-xs font-bold text-slate-800 mb-1">
                    Custom Subject Line
                  </label>
                  <Input
                    type="text"
                    value={editSubject}
                    onChange={(e) => setEditSubject(e.target.value)}
                    className="text-xs font-semibold text-slate-900"
                  />
                  <span className="text-[10px] text-slate-400 mt-0.5 block">
                    Bespoke subject generated based on lead domain, role, and company matrix.
                  </span>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-800 mb-1">
                    Initial Outreach Email Body
                  </label>
                  <textarea
                    rows={6}
                    value={editBody}
                    onChange={(e) => setEditBody(e.target.value)}
                    className="w-full text-xs p-3 rounded-xl border border-slate-200 text-slate-900 leading-relaxed resize-y focus:outline-none focus:ring-2 focus:ring-blue-500 font-sans"
                  />
                </div>

                {editingLead.followUpEmail && (
                  <div className="pt-2 border-t border-slate-100 space-y-2.5">
                    <span className="text-xs font-bold text-emerald-900 flex items-center gap-1">
                      <Mail className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Step 2 Automated Follow-Up Email</span>
                    </span>

                    <div>
                      <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                        Follow-Up Subject
                      </label>
                      <Input
                        type="text"
                        value={editFollowUpSubject}
                        onChange={(e) => setEditFollowUpSubject(e.target.value)}
                        className="text-xs"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                        Follow-Up Body
                      </label>
                      <textarea
                        rows={4}
                        value={editFollowUpBody}
                        onChange={(e) => setEditFollowUpBody(e.target.value)}
                        className="w-full text-xs p-2.5 rounded-xl border border-slate-200 text-slate-900 leading-relaxed resize-y focus:outline-none focus:ring-2 focus:ring-blue-500 font-sans"
                      />
                    </div>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setEditingLead(null)}
                  className="text-xs h-8 cursor-pointer"
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  size="sm"
                  onClick={handleSaveLeadEdit}
                  className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs h-8 cursor-pointer"
                >
                  Save Changes
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

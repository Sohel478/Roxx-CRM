"use client";

import { useState, useTransition } from "react";
import {
  FileText,
  Mail,
  PhoneCall,
  Calendar,
  CheckSquare,
  Sparkles,
  Send,
  Loader2,
  Clock,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { logActivityAction } from "@/actions/activities";
import { createTaskAction } from "@/actions/tasks";
import {
  SALES_EMAIL_TEMPLATES,
  applyMergeTags,
  MergeContext,
} from "@/lib/templates/email-templates";
import { ActivityType } from "@/lib/validations/activities";

interface InlineComposerProps {
  entityId: string;
  entityType: "opportunity" | "lead" | "company" | "contact";
  mergeContext: MergeContext;
  onActivityCreated: () => void;
}

type ComposerTab = "NOTE" | "EMAIL" | "CALL" | "MEETING" | "TASK";

export function InlineComposer({
  entityId,
  entityType,
  mergeContext,
  onActivityCreated,
}: InlineComposerProps) {
  const [activeTab, setActiveTab] = useState<ComposerTab>("NOTE");
  const [isPending, startTransition] = useTransition();
  const [successBanner, setSuccessBanner] = useState<string | null>(null);
  const [errorBanner, setErrorBanner] = useState<string | null>(null);

  // Common fields
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");

  // Call / Meeting fields
  const [callOutcome, setCallOutcome] = useState("Connected");
  const [duration, setDuration] = useState<number>(15);

  // Task fields
  const [taskPriority, setTaskPriority] = useState<"LOW" | "MEDIUM" | "HIGH" | "URGENT">("MEDIUM");
  const [taskDueDate, setTaskDueDate] = useState(
    new Date(Date.now() + 86400000).toISOString().split("T")[0]
  );

  // Email Template Selection
  const [selectedTemplateId, setSelectedTemplateId] = useState("");

  const handleSelectTemplate = (templateId: string) => {
    setSelectedTemplateId(templateId);
    if (!templateId) return;

    const tpl = SALES_EMAIL_TEMPLATES.find((t) => t.id === templateId);
    if (tpl) {
      setSubject(applyMergeTags(tpl.subject, mergeContext));
      setDescription(applyMergeTags(tpl.body, mergeContext));
    }
  };

  const resetForm = () => {
    setSubject("");
    setDescription("");
    setSelectedTemplateId("");
    setCallOutcome("Connected");
    setDuration(15);
  };

  const handleSaveActivity = (type: ActivityType) => {
    if (!description.trim() && type === "NOTE") return;

    setErrorBanner(null);
    setSuccessBanner(null);

    const defaultSubjects: Record<ActivityType, string> = {
      NOTE: "Internal Strategy Note",
      EMAIL: subject.trim() || `Email to ${mergeContext.firstName || "Customer"}`,
      CALL: subject.trim() || `Call with ${mergeContext.firstName || "Customer"}`,
      MEETING: subject.trim() || `Meeting with ${mergeContext.companyName || "Client"}`,
      WHATSAPP: "WhatsApp Message",
      OTHER: "Other touchpoint",
    };

    startTransition(async () => {
      const res = await logActivityAction({
        type,
        subject: subject.trim() || defaultSubjects[type],
        description: description.trim(),
        activityAt: new Date().toISOString(),
        durationMinutes: type === "CALL" || type === "MEETING" ? duration : undefined,
        outcome: type === "CALL" ? callOutcome : undefined,
        opportunityId: entityType === "opportunity" ? entityId : undefined,
        leadId: entityType === "lead" ? entityId : undefined,
        companyId: entityType === "company" ? entityId : undefined,
        contactId: entityType === "contact" ? entityId : undefined,
      });

      if (res.success) {
        setSuccessBanner(
          type === "EMAIL"
            ? "Email logged & touchpoint recorded."
            : type === "NOTE"
            ? "Note saved to activity feed."
            : `${type.toLowerCase()} logged successfully.`
        );
        resetForm();
        onActivityCreated();
        setTimeout(() => setSuccessBanner(null), 4000);
      } else {
        setErrorBanner(res.error || "Failed to log activity");
      }
    });
  };

  const handleCreateTask = () => {
    if (!subject.trim()) return;

    setErrorBanner(null);
    setSuccessBanner(null);

    startTransition(async () => {
      const res = await createTaskAction({
        title: subject.trim(),
        description: description.trim() || undefined,
        status: "PENDING",
        priority: taskPriority,
        dueAt: taskDueDate,
        opportunityId: entityType === "opportunity" ? entityId : undefined,
        leadId: entityType === "lead" ? entityId : undefined,
      });

      if (res.success) {
        setSuccessBanner("Follow-up task created & added to queue.");
        resetForm();
        onActivityCreated();
        setTimeout(() => setSuccessBanner(null), 4000);
      } else {
        setErrorBanner(res.error || "Failed to create task");
      }
    });
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
      {/* Tab Navigation */}
      <div className="flex border-b border-slate-100 bg-slate-50/75 px-3 pt-2 gap-1 overflow-x-auto">
        <button
          type="button"
          onClick={() => {
            setActiveTab("NOTE");
            resetForm();
          }}
          className={`flex items-center gap-1.5 px-3 py-2 text-xs font-bold rounded-t-xl transition-all ${
            activeTab === "NOTE"
              ? "bg-white text-blue-600 border-t-2 border-t-blue-600 shadow-2xs"
              : "text-slate-500 hover:text-slate-800"
          }`}
        >
          <FileText className="w-3.5 h-3.5" />
          <span>Note</span>
        </button>

        <button
          type="button"
          onClick={() => {
            setActiveTab("EMAIL");
            resetForm();
          }}
          className={`flex items-center gap-1.5 px-3 py-2 text-xs font-bold rounded-t-xl transition-all ${
            activeTab === "EMAIL"
              ? "bg-white text-blue-600 border-t-2 border-t-blue-600 shadow-2xs"
              : "text-slate-500 hover:text-slate-800"
          }`}
        >
          <Mail className="w-3.5 h-3.5 text-purple-600" />
          <span>Email &amp; Templates</span>
        </button>

        <button
          type="button"
          onClick={() => {
            setActiveTab("CALL");
            resetForm();
          }}
          className={`flex items-center gap-1.5 px-3 py-2 text-xs font-bold rounded-t-xl transition-all ${
            activeTab === "CALL"
              ? "bg-white text-blue-600 border-t-2 border-t-blue-600 shadow-2xs"
              : "text-slate-500 hover:text-slate-800"
          }`}
        >
          <PhoneCall className="w-3.5 h-3.5 text-emerald-600" />
          <span>Log Call</span>
        </button>

        <button
          type="button"
          onClick={() => {
            setActiveTab("MEETING");
            resetForm();
          }}
          className={`flex items-center gap-1.5 px-3 py-2 text-xs font-bold rounded-t-xl transition-all ${
            activeTab === "MEETING"
              ? "bg-white text-blue-600 border-t-2 border-t-blue-600 shadow-2xs"
              : "text-slate-500 hover:text-slate-800"
          }`}
        >
          <Calendar className="w-3.5 h-3.5 text-amber-600" />
          <span>Log Meeting</span>
        </button>

        <button
          type="button"
          onClick={() => {
            setActiveTab("TASK");
            resetForm();
          }}
          className={`flex items-center gap-1.5 px-3 py-2 text-xs font-bold rounded-t-xl transition-all ${
            activeTab === "TASK"
              ? "bg-white text-blue-600 border-t-2 border-t-blue-600 shadow-2xs"
              : "text-slate-500 hover:text-slate-800"
          }`}
        >
          <CheckSquare className="w-3.5 h-3.5 text-blue-600" />
          <span>New Task</span>
        </button>
      </div>

      {/* Composer Content Area */}
      <div className="p-4 space-y-3">
        {successBanner && (
          <div className="p-2.5 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-800 text-xs flex items-center gap-2 animate-in fade-in">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{successBanner}</span>
          </div>
        )}

        {errorBanner && (
          <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-lg text-rose-800 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{errorBanner}</span>
          </div>
        )}

        {/* EMAIL TAB: Template Selector & Subject */}
        {activeTab === "EMAIL" && (
          <div className="space-y-2.5">
            <div className="flex flex-col sm:flex-row gap-2 items-start sm:items-center justify-between bg-purple-50/50 p-2.5 rounded-xl border border-purple-100">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-purple-600 shrink-0" />
                <span className="text-xs font-bold text-purple-900">
                  HubSpot Template Snippet:
                </span>
              </div>
              <select
                value={selectedTemplateId}
                onChange={(e) => handleSelectTemplate(e.target.value)}
                className="text-xs rounded-lg border border-purple-200 bg-white px-3 py-1.5 text-purple-950 font-medium focus:outline-none focus:ring-2 focus:ring-purple-500"
              >
                <option value="">Insert a sales template...</option>
                {SALES_EMAIL_TEMPLATES.map((t) => (
                  <option key={t.id} value={t.id}>
                    [{t.category}] {t.name}
                  </option>
                ))}
              </select>
            </div>

            <Input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Subject: e.g. Following up on our platform evaluation..."
              className="text-xs font-semibold"
            />
          </div>
        )}

        {/* CALL / MEETING TAB: Parameters */}
        {(activeTab === "CALL" || activeTab === "MEETING") && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pb-1">
            <div className="sm:col-span-1">
              <label className="block text-[11px] font-bold text-slate-500 mb-1">
                {activeTab === "CALL" ? "Call Outcome" : "Meeting Status"}
              </label>
              <select
                value={callOutcome}
                onChange={(e) => setCallOutcome(e.target.value)}
                className="w-full text-xs rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="Connected">Connected &amp; Discussed</option>
                <option value="Left voicemail">Left Voicemail</option>
                <option value="Demo scheduled">Demo Scheduled</option>
                <option value="No answer">No Answer / Busy</option>
                <option value="Gatekeeper reached">Gatekeeper Reached</option>
              </select>
            </div>

            <div className="sm:col-span-1">
              <label className="block text-[11px] font-bold text-slate-500 mb-1">
                Duration (min)
              </label>
              <div className="flex gap-1">
                {[15, 30, 45, 60].map((mins) => (
                  <button
                    key={mins}
                    type="button"
                    onClick={() => setDuration(mins)}
                    className={`flex-1 py-1 text-xs rounded-lg font-bold border transition-colors ${
                      duration === mins
                        ? "bg-blue-600 text-white border-blue-600"
                        : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                    }`}
                  >
                    {mins}m
                  </button>
                ))}
              </div>
            </div>

            <div className="sm:col-span-1">
              <label className="block text-[11px] font-bold text-slate-500 mb-1">
                Subject
              </label>
              <Input
                type="text"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder={activeTab === "CALL" ? "Introductory Phone Call" : "Demo Review"}
                className="text-xs"
              />
            </div>
          </div>
        )}

        {/* TASK TAB: Title, Priority, Due Date */}
        {activeTab === "TASK" && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pb-1">
            <div className="sm:col-span-1">
              <label className="block text-[11px] font-bold text-slate-500 mb-1">
                Task Title *
              </label>
              <Input
                type="text"
                required
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="e.g. Send updated pricing proposal"
                className="text-xs"
              />
            </div>

            <div className="sm:col-span-1">
              <label className="block text-[11px] font-bold text-slate-500 mb-1">
                Priority
              </label>
              <select
                value={taskPriority}
                onChange={(e) =>
                  setTaskPriority(e.target.value as "LOW" | "MEDIUM" | "HIGH" | "URGENT")
                }
                className="w-full text-xs rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="LOW">Low</option>
                <option value="MEDIUM">Medium</option>
                <option value="HIGH">High</option>
                <option value="URGENT">Urgent ⚡</option>
              </select>
            </div>

            <div className="sm:col-span-1">
              <label className="block text-[11px] font-bold text-slate-500 mb-1">
                Due Date
              </label>
              <Input
                type="date"
                value={taskDueDate}
                onChange={(e) => setTaskDueDate(e.target.value)}
                className="text-xs"
              />
            </div>
          </div>
        )}

        {/* Text Area Description */}
        <div>
          <textarea
            rows={activeTab === "EMAIL" ? 5 : 3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder={
              activeTab === "NOTE"
                ? "Click here to type a quick note, meeting takeaway, or internal briefing..."
                : activeTab === "EMAIL"
                ? "Draft your email message..."
                : activeTab === "CALL"
                ? "Call discussion points, objections, and agreements..."
                : activeTab === "MEETING"
                ? "Meeting minutes and next steps..."
                : "Additional task context or instructions (optional)..."
            }
            className="w-full rounded-xl border border-slate-200 p-3 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all resize-y"
          />
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between pt-1">
          <div className="text-[11px] text-slate-400">
            {activeTab === "EMAIL" && "Merge tags automatically applied from customer record"}
            {activeTab === "NOTE" && "Visible immediately to all team members"}
            {activeTab === "CALL" && `Duration: ${duration} minutes • ${callOutcome}`}
          </div>

          <div className="flex gap-2">
            {(description || subject) && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={resetForm}
                className="text-xs h-8"
              >
                Clear
              </Button>
            )}

            {activeTab === "TASK" ? (
              <Button
                type="button"
                size="sm"
                onClick={handleCreateTask}
                disabled={isPending || !subject.trim()}
                className="bg-blue-600 hover:bg-blue-700 text-xs h-8 gap-1.5"
              >
                {isPending ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <CheckSquare className="w-3.5 h-3.5" />
                )}
                <span>Create Task</span>
              </Button>
            ) : (
              <Button
                type="button"
                size="sm"
                onClick={() => handleSaveActivity(activeTab as ActivityType)}
                disabled={isPending || (!description.trim() && activeTab === "NOTE")}
                className={`text-xs h-8 gap-1.5 ${
                  activeTab === "EMAIL"
                    ? "bg-purple-600 hover:bg-purple-700"
                    : activeTab === "CALL"
                    ? "bg-emerald-600 hover:bg-emerald-700"
                    : "bg-blue-600 hover:bg-blue-700"
                }`}
              >
                {isPending ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : activeTab === "EMAIL" ? (
                  <Send className="w-3.5 h-3.5" />
                ) : (
                  <FileText className="w-3.5 h-3.5" />
                )}
                <span>
                  {activeTab === "EMAIL"
                    ? "Log Email"
                    : activeTab === "NOTE"
                    ? "Save Note"
                    : activeTab === "CALL"
                    ? "Save Call"
                    : "Save Meeting"}
                </span>
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

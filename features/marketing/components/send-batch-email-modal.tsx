"use client";

import { useState } from "react";
import {
  X,
  Mail,
  Send,
  Loader2,
  Sparkles,
  AlertCircle,
  CheckCircle2,
  Eye,
  FileText,
  AlertTriangle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  SALES_EMAIL_TEMPLATES,
  applyMergeTags,
} from "@/lib/templates/email-templates";
import { sendBatchEmailAction } from "@/actions/marketing";
import type { MarketingBatchItem } from "@/lib/validations/marketing";

interface SendBatchEmailModalProps {
  isOpen: boolean;
  onClose: () => void;
  batch: MarketingBatchItem;
  sampleLead?: {
    firstName: string;
    lastName?: string | null;
    companyName?: string | null;
    email?: string | null;
  } | null;
  onCampaignDispatched?: () => void;
}

export function SendBatchEmailModal({
  isOpen,
  onClose,
  batch,
  sampleLead,
  onCampaignDispatched,
}: SendBatchEmailModalProps) {
  const [activeTab, setActiveTab] = useState<"compose" | "preview">("compose");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [senderName, setSenderName] = useState("");
  const [replyTo, setReplyTo] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successResult, setSuccessResult] = useState<{
    sent: number;
    failed: number;
    message: string;
  } | null>(null);

  if (!isOpen) return null;

  const handleSelectTemplate = (templateId: string) => {
    const tpl = SALES_EMAIL_TEMPLATES.find((t) => t.id === templateId);
    if (tpl) {
      setSubject(tpl.subject);
      setBody(tpl.body);
    }
  };

  const insertMergeTag = (tag: string) => {
    setBody((prev) => `${prev} {{${tag}}}`);
  };

  const previewSubject = applyMergeTags(subject || "(No Subject)", {
    firstName: sampleLead?.firstName || "Sarah",
    lastName: sampleLead?.lastName || "Jenkins",
    companyName: sampleLead?.companyName || "Apex Retail Corp",
    repName: senderName || "Sales Rep",
    email: sampleLead?.email || "sarah@apexretail.com",
  });

  const previewBody = applyMergeTags(
    body || "Hello {{first_name}},\n\nYour message content will appear here.",
    {
      firstName: sampleLead?.firstName || "Sarah",
      lastName: sampleLead?.lastName || "Jenkins",
      companyName: sampleLead?.companyName || "Apex Retail Corp",
      repName: senderName || "Sales Rep",
      email: sampleLead?.email || "sarah@apexretail.com",
    }
  );

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subject.trim()) {
      setError("Please provide a subject line for your email.");
      return;
    }
    if (!body.trim()) {
      setError("Please provide email body content.");
      return;
    }

    setIsSending(true);
    setError(null);

    try {
      const res = await sendBatchEmailAction({
        batchId: batch.id,
        subject: subject.trim(),
        body: body.trim(),
        senderName: senderName.trim() || undefined,
        replyTo: replyTo.trim() || undefined,
      });

      if (!res.success) {
        setError(res.error || "Failed to dispatch batch emails");
        setIsSending(false);
        return;
      }

      setSuccessResult({
        sent: res.data?.sentCount || 0,
        failed: res.data?.failedCount || 0,
        message:
          res.message ||
          `Batch campaign dispatched successfully to ${res.data?.sentCount || 0} leads.`,
      });

      if (onCampaignDispatched) {
        onCampaignDispatched();
      }
    } catch (err: unknown) {
      setError((err as Error)?.message || "An unexpected error occurred while sending emails.");
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[92vh] flex flex-col shadow-2xl border border-slate-100 animate-in fade-in zoom-in-95 duration-150">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
              <Mail className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <span>Send Bulk Email to Batch</span>
                <Badge variant="secondary" className="bg-blue-100 text-blue-800 text-[11px]">
                  {batch.name}
                </Badge>
              </h2>
              <p className="text-xs text-slate-500">
                Dispatches individual personalized emails to {batch.leadCount} leads via your SMTP server
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

        {/* Success Modal Screen */}
        {successResult ? (
          <div className="p-8 text-center space-y-4">
            <div className="w-14 h-14 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <h3 className="text-lg font-bold text-slate-900">Campaign Dispatched!</h3>
            <p className="text-sm text-slate-600 max-w-md mx-auto">{successResult.message}</p>
            <div className="flex items-center justify-center gap-3 pt-2">
              <Badge variant="success" className="px-3 py-1 text-xs">
                {successResult.sent} Delivered Successfully
              </Badge>
              {successResult.failed > 0 && (
                <Badge variant="destructive" className="px-3 py-1 text-xs">
                  {successResult.failed} Skipped / Failed
                </Badge>
              )}
            </div>
            <p className="text-xs text-slate-400 pt-2">
              All interactions have been automatically logged to each recipient lead&apos;s activity timeline.
            </p>
            <div className="pt-4">
              <Button
                type="button"
                onClick={onClose}
                className="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-6"
              >
                Done
              </Button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSend} className="flex flex-col flex-1 overflow-hidden">
            {/* Tab Switcher & Template Picker */}
            <div className="px-6 py-2.5 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-1 bg-slate-200/80 p-0.5 rounded-lg text-xs font-semibold">
                <button
                  type="button"
                  onClick={() => setActiveTab("compose")}
                  className={`px-3 py-1 rounded-md transition-all ${
                    activeTab === "compose"
                      ? "bg-white text-blue-700 shadow-2xs"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  <span className="flex items-center gap-1.5">
                    <FileText className="w-3.5 h-3.5" /> Compose
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab("preview")}
                  className={`px-3 py-1 rounded-md transition-all ${
                    activeTab === "preview"
                      ? "bg-white text-blue-700 shadow-2xs"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  <span className="flex items-center gap-1.5">
                    <Eye className="w-3.5 h-3.5" /> Live Preview
                  </span>
                </button>
              </div>

              {/* Template Quick Load */}
              <div className="flex items-center gap-1.5 text-xs">
                <span className="text-slate-500 font-medium hidden sm:inline">Template:</span>
                <select
                  onChange={(e) => handleSelectTemplate(e.target.value)}
                  defaultValue=""
                  className="bg-white border border-slate-200 rounded-lg px-2.5 py-1 text-xs text-slate-700 font-medium focus:ring-1 focus:ring-blue-500"
                >
                  <option value="" disabled>
                    Choose template...
                  </option>
                  {SALES_EMAIL_TEMPLATES.map((tpl) => (
                    <option key={tpl.id} value={tpl.id}>
                      {tpl.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-4 overflow-y-auto flex-1">
              {error && (
                <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              {activeTab === "compose" ? (
                <>
                  {/* Subject Line */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-xs font-semibold text-slate-700">
                        Subject Line <span className="text-red-500">*</span>
                      </label>
                      <span className="text-[11px] text-slate-400">Supports merge tags</span>
                    </div>
                    <input
                      type="text"
                      placeholder="e.g. Special Holiday Greetings for {{company_name}}!"
                      value={subject}
                      onChange={(e) => setSubject(e.target.value)}
                      className="w-full px-3.5 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all font-medium text-slate-900"
                      required
                    />
                  </div>

                  {/* Merge Tag Pills */}
                  <div>
                    <span className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                      Insert Merge Tag
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {[
                        { label: "First Name", tag: "first_name" },
                        { label: "Last Name", tag: "last_name" },
                        { label: "Company Name", tag: "company_name" },
                        { label: "Lead Email", tag: "email" },
                        { label: "Sender Name", tag: "rep_name" },
                      ].map((item) => (
                        <button
                          key={item.tag}
                          type="button"
                          onClick={() => insertMergeTag(item.tag)}
                          className="bg-slate-100 hover:bg-blue-50 hover:text-blue-600 hover:border-blue-200 text-slate-700 border border-slate-200 text-[11px] font-mono px-2 py-0.5 rounded-md transition-colors"
                        >
                          +{`{{${item.tag}}}`}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Body Textarea */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Email Body <span className="text-red-500">*</span>
                    </label>
                    <textarea
                      rows={7}
                      placeholder={`Hi {{first_name}},\n\nHappy New Year from our team! We wanted to thank you for connecting with us...\n\nBest regards,\n{{rep_name}}`}
                      value={body}
                      onChange={(e) => setBody(e.target.value)}
                      className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all text-slate-800 font-normal leading-relaxed resize-y"
                      required
                    />
                  </div>

                  {/* Advanced Sender Options */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-slate-100">
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">
                        Display Sender Name (Optional)
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. Alex Sales / Roxx Team"
                        value={senderName}
                        onChange={(e) => setSenderName(e.target.value)}
                        className="w-full px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">
                        Reply-To Email (Optional)
                      </label>
                      <input
                        type="email"
                        placeholder="e.g. replies@yourdomain.com"
                        value={replyTo}
                        onChange={(e) => setReplyTo(e.target.value)}
                        className="w-full px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>
                </>
              ) : (
                /* Live Preview Mode */
                <div className="space-y-4">
                  <div className="bg-amber-50 border border-amber-200 text-amber-800 p-3 rounded-xl text-xs flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-amber-600 shrink-0" />
                    <span>
                      Previewing email as it will be rendered for sample recipient:{" "}
                      <strong>
                        {sampleLead?.firstName || "Sarah"} ({sampleLead?.companyName || "Apex Retail Corp"})
                      </strong>
                    </span>
                  </div>

                  {/* Rendered Preview Card */}
                  <div className="border border-slate-200 rounded-xl overflow-hidden shadow-xs bg-white">
                    <div className="bg-slate-50 px-4 py-3 border-b border-slate-200 space-y-1.5 text-xs">
                      <div>
                        <span className="text-slate-400 font-medium">To:</span>{" "}
                        <span className="text-slate-800 font-mono">
                          {sampleLead?.email || "sarah@apexretail.com"}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-400 font-medium">Subject:</span>{" "}
                        <span className="text-slate-900 font-semibold">{previewSubject}</span>
                      </div>
                    </div>
                    <div className="p-4 text-sm text-slate-800 whitespace-pre-wrap leading-relaxed font-sans min-h-[140px]">
                      {previewBody}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-between px-6 py-4 bg-slate-50 border-t border-slate-200">
              <div className="flex items-center gap-1.5 text-xs text-slate-500">
                <AlertTriangle className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                <span>
                  Will dispatch <strong>{batch.leadCount}</strong> personalized emails via SMTP.
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={onClose}
                  disabled={isSending}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={isSending || !subject.trim() || !body.trim()}
                  className="bg-blue-600 hover:bg-blue-700 text-white shadow-xs font-semibold px-4"
                >
                  {isSending ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />
                      <span>Sending Batch...</span>
                    </>
                  ) : (
                    <>
                      <Send className="w-3.5 h-3.5 mr-1.5" />
                      <span>Send to {batch.leadCount} Leads</span>
                    </>
                  )}
                </Button>
              </div>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

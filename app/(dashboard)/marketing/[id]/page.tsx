"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Users2,
  Mail,
  Send,
  Building2,
  Phone,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Loader2,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { getMarketingBatchByIdAction } from "@/actions/marketing";
import type { MarketingBatchDetail } from "@/lib/validations/marketing";
import { SendBatchEmailModal } from "@/features/marketing/components/send-batch-email-modal";
import { AiBatchStudyModal } from "@/features/marketing/components/ai-batch-study-modal";

export default function MarketingBatchDetailPage() {
  const params = useParams();
  const router = useRouter();
  const batchId = params.id as string;

  const [batch, setBatch] = useState<MarketingBatchDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"leads" | "campaigns">("leads");
  const [isSendOpen, setIsSendOpen] = useState(false);
  const [isAiStudyOpen, setIsAiStudyOpen] = useState(false);
  const [expandedCampaignId, setExpandedCampaignId] = useState<string | null>(null);

  const fetchBatch = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await getMarketingBatchByIdAction(batchId);
      if (res.success && res.data) {
        const batchData = res.data;
        setBatch(batchData);
        if (batchData.campaigns.length > 0) {
          setExpandedCampaignId((prev) => prev || batchData.campaigns[0].id);
        }
      } else {
        setError(res.error || "Batch not found");
      }
    } catch (err: unknown) {
      setError((err as Error)?.message || "Failed to load batch");
    } finally {
      setIsLoading(false);
    }
  }, [batchId]);

  useEffect(() => {
    if (batchId) {
      fetchBatch();
    }
  }, [batchId, fetchBatch]);

  if (isLoading) {
    return (
      <div className="p-12 text-center text-xs text-slate-400 flex flex-col items-center justify-center gap-2">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
        <span>Loading batch details...</span>
      </div>
    );
  }

  if (error || !batch) {
    return (
      <div className="p-8 max-w-xl mx-auto text-center space-y-4">
        <div className="w-12 h-12 rounded-full bg-red-50 text-red-600 flex items-center justify-center mx-auto">
          <XCircle className="w-6 h-6" />
        </div>
        <h2 className="text-lg font-bold text-slate-900">Unable to load batch</h2>
        <p className="text-xs text-slate-500">{error || "Batch does not exist or you do not have permission to view it."}</p>
        <Button
          type="button"
          variant="outline"
          onClick={() => router.push("/marketing")}
          className="text-xs"
        >
          <ArrowLeft className="w-3.5 h-3.5 mr-1.5" /> Back to Marketing
        </Button>
      </div>
    );
  }

  const sampleLead = batch.leads.length > 0 ? batch.leads[0] : null;

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Back Link */}
      <div>
        <Link
          href="/marketing"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-blue-600 transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Back to Marketing Batches
        </Link>
      </div>

      {/* Batch Header Card */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2.5 flex-wrap">
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">
              {batch.name}
            </h1>
            <Badge variant="secondary" className="bg-blue-50 text-blue-700 font-semibold text-xs">
              <Users2 className="w-3 h-3 mr-1" />
              {batch.leadCount} Leads
            </Badge>
          </div>
          {batch.description && (
            <p className="text-xs text-slate-500 max-w-2xl">{batch.description}</p>
          )}
          <div className="flex items-center gap-4 text-xs text-slate-400 pt-1 flex-wrap">
            <span>Owner: <strong className="text-slate-700">{batch.ownerName || "Sales Rep"}</strong></span>
            <span>Created: <strong className="text-slate-700">{new Date(batch.createdAt).toLocaleDateString()}</strong></span>
            <span>Campaigns Dispatched: <strong className="text-slate-700">{batch.campaigns.length}</strong></span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => setIsAiStudyOpen(true)}
            className="border-purple-200 text-purple-700 hover:bg-purple-50 font-semibold text-xs px-3.5 h-9 shadow-xs"
          >
            <Sparkles className="w-3.5 h-3.5 mr-1.5 text-purple-600" />
            <span>AI Study &amp; Schedule</span>
          </Button>

          <Button
            type="button"
            onClick={() => setIsSendOpen(true)}
            className="bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs px-4 h-9 shadow-xs"
          >
            <Send className="w-4 h-4 mr-1.5" />
            <span>Send Email to Batch</span>
          </Button>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="border-b border-slate-200 flex items-center gap-2">
        <button
          type="button"
          onClick={() => setActiveTab("leads")}
          className={`px-4 py-2.5 text-xs font-bold border-b-2 transition-all ${
            activeTab === "leads"
              ? "border-blue-600 text-blue-600"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          <span className="flex items-center gap-1.5">
            <Users2 className="w-4 h-4" /> Leads in this Batch ({batch.leads.length})
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("campaigns")}
          className={`px-4 py-2.5 text-xs font-bold border-b-2 transition-all ${
            activeTab === "campaigns"
              ? "border-blue-600 text-blue-600"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          <span className="flex items-center gap-1.5">
            <Mail className="w-4 h-4" /> Campaign Logs ({batch.campaigns.length})
          </span>
        </button>
      </div>

      {/* Tab 1: Member Leads List */}
      {activeTab === "leads" && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/75 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  <th className="py-3 px-4">Lead</th>
                  <th className="py-3 px-4">Company &amp; Title</th>
                  <th className="py-3 px-4">Email</th>
                  <th className="py-3 px-4">Phone</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Rating</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {batch.leads.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-xs text-slate-400">
                      No leads present in this batch.
                    </td>
                  </tr>
                ) : (
                  batch.leads.map((lead) => (
                    <tr key={lead.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3.5 px-4">
                        <Link
                          href={`/leads/${lead.id}`}
                          className="font-bold text-slate-900 hover:text-blue-600 transition-colors flex items-center gap-1 group"
                        >
                          <span className="group-hover:underline">{lead.fullName}</span>
                          <ExternalLink className="w-3 h-3 text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                        </Link>
                        <span className="text-[11px] text-slate-400 font-mono">
                          {lead.leadNumber}
                        </span>
                      </td>

                      <td className="py-3.5 px-4 text-xs text-slate-600">
                        {lead.companyName && (
                          <div className="font-medium text-slate-800 flex items-center gap-1">
                            <Building2 className="w-3 h-3 text-slate-400" />
                            <span>{lead.companyName}</span>
                          </div>
                        )}
                        {lead.jobTitle && (
                          <span className="text-slate-400 text-[11px]">{lead.jobTitle}</span>
                        )}
                      </td>

                      <td className="py-3.5 px-4 text-xs text-slate-700 font-mono">
                        {lead.email ? (
                          <div className="flex items-center gap-1">
                            <Mail className="w-3 h-3 text-slate-400" />
                            <span>{lead.email}</span>
                          </div>
                        ) : (
                          <span className="text-amber-600 italic">No email</span>
                        )}
                      </td>

                      <td className="py-3.5 px-4 text-xs text-slate-600">
                        {lead.phone ? (
                          <div className="flex items-center gap-1">
                            <Phone className="w-3 h-3 text-slate-400" />
                            <span>{lead.phone}</span>
                          </div>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>

                      <td className="py-3.5 px-4">
                        <Badge variant="secondary" className="text-[10px] font-semibold">
                          {lead.status}
                        </Badge>
                      </td>

                      <td className="py-3.5 px-4">
                        <span
                          className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                            lead.rating === "Hot"
                              ? "bg-red-50 text-red-600"
                              : lead.rating === "Warm"
                              ? "bg-amber-50 text-amber-600"
                              : "bg-blue-50 text-blue-600"
                          }`}
                        >
                          {lead.rating}
                        </span>
                      </td>

                      <td className="py-3.5 px-4 text-right">
                        <Link
                          href={`/leads/${lead.id}`}
                          className="text-xs font-semibold text-blue-600 hover:text-blue-800 hover:underline"
                        >
                          View Lead
                        </Link>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 2: Campaign Logs & Delivery History */}
      {activeTab === "campaigns" && (
        <div className="space-y-4">
          {batch.campaigns.length === 0 ? (
            <div className="bg-white rounded-xl border border-slate-200 p-12 text-center text-slate-400 space-y-3">
              <Mail className="w-10 h-10 mx-auto text-slate-300" />
              <p className="font-semibold text-slate-700">No email campaigns sent yet</p>
              <p className="text-xs text-slate-400 max-w-sm mx-auto">
                Click &ldquo;Send Email to Batch&rdquo; to compose and dispatch your first bulk email campaign.
              </p>
              <Button
                type="button"
                onClick={() => setIsSendOpen(true)}
                className="bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs h-8 px-4"
              >
                Send First Campaign
              </Button>
            </div>
          ) : (
            batch.campaigns.map((camp) => {
              const isExpanded = expandedCampaignId === camp.id;
              return (
                <div
                  key={camp.id}
                  className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden"
                >
                  {/* Campaign Header / Summary Banner */}
                  <div
                    onClick={() =>
                      setExpandedCampaignId(isExpanded ? null : camp.id)
                    }
                    className="p-4.5 bg-slate-50/75 flex items-center justify-between cursor-pointer hover:bg-slate-100/70 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-blue-100/70 text-blue-700 flex items-center justify-center font-bold shrink-0">
                        <Mail className="w-4 h-4" />
                      </div>
                      <div>
                        <h3 className="text-sm font-bold text-slate-900">{camp.subject}</h3>
                        <div className="flex items-center gap-3 text-xs text-slate-500 mt-0.5 flex-wrap">
                          <span>
                            Sender: <strong>{camp.senderName}</strong>
                          </span>
                          <span>&bull;</span>
                          <span>
                            Sent:{" "}
                            <strong>
                              {camp.sentAt
                                ? new Date(camp.sentAt).toLocaleString()
                                : new Date(camp.createdAt).toLocaleString()}
                            </strong>
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-2">
                        <Badge
                          variant="success"
                          className="bg-emerald-50 text-emerald-700 border-emerald-200 text-xs font-semibold"
                        >
                          <CheckCircle2 className="w-3 h-3 mr-1" />
                          {camp.sentCount} Sent
                        </Badge>
                        {camp.failedCount > 0 && (
                          <Badge
                            variant="destructive"
                            className="bg-red-50 text-red-700 border-red-200 text-xs font-semibold"
                          >
                            <AlertTriangle className="w-3 h-3 mr-1" />
                            {camp.failedCount} Failed / Skipped
                          </Badge>
                        )}
                      </div>
                      <button
                        type="button"
                        className="p-1 text-slate-400 hover:text-slate-600 rounded-md"
                      >
                        {isExpanded ? (
                          <ChevronUp className="w-4 h-4" />
                        ) : (
                          <ChevronDown className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Expanded Content: Body preview + Recipient logs */}
                  {isExpanded && (
                    <div className="p-5 border-t border-slate-200 space-y-4">
                      {/* Body Preview */}
                      <div>
                        <span className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                          Template Message
                        </span>
                        <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 text-xs text-slate-700 whitespace-pre-wrap leading-relaxed max-h-40 overflow-y-auto font-sans">
                          {camp.body}
                        </div>
                      </div>

                      {/* Recipient Logs Table */}
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                            Recipient Delivery Logs ({camp.recipientLogs.length})
                          </span>
                        </div>
                        <div className="border border-slate-200 rounded-xl overflow-hidden overflow-x-auto">
                          <table className="w-full text-left text-xs border-collapse">
                            <thead>
                              <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                                <th className="py-2.5 px-3">Lead Name</th>
                                <th className="py-2.5 px-3">Email Address</th>
                                <th className="py-2.5 px-3">Status</th>
                                <th className="py-2.5 px-3">Details / Timestamp</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                              {camp.recipientLogs.map((log, idx) => (
                                <tr key={`${log.leadId}_${idx}`} className="hover:bg-slate-50/50">
                                  <td className="py-2.5 px-3 font-semibold text-slate-900">
                                    {log.leadName}
                                  </td>
                                  <td className="py-2.5 px-3 font-mono text-slate-600">
                                    {log.email}
                                  </td>
                                  <td className="py-2.5 px-3">
                                    {log.status === "SENT" ? (
                                      <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                                        <CheckCircle2 className="w-3 h-3" /> Delivered
                                      </span>
                                    ) : log.status === "SKIPPED" ? (
                                      <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                                        <AlertTriangle className="w-3 h-3" /> Skipped
                                      </span>
                                    ) : (
                                      <span className="inline-flex items-center gap-1 text-[11px] font-bold text-red-700 bg-red-50 px-2 py-0.5 rounded-full border border-red-200">
                                        <XCircle className="w-3 h-3" /> Failed
                                      </span>
                                    )}
                                  </td>
                                  <td className="py-2.5 px-3 text-slate-500 text-[11px]">
                                    {log.error ? (
                                      <span className="text-red-600 font-medium">{log.error}</span>
                                    ) : log.sentAt ? (
                                      new Date(log.sentAt).toLocaleTimeString()
                                    ) : (
                                      "—"
                                    )}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}

      {/* Send Email Modal */}
      {isSendOpen && (
        <SendBatchEmailModal
          isOpen={isSendOpen}
          onClose={() => setIsSendOpen(false)}
          batch={batch}
          sampleLead={sampleLead}
          onCampaignDispatched={() => {
            fetchBatch();
          }}
        />
      )}

      {/* AI Batch Study & Schedule Modal */}
      {isAiStudyOpen && (
        <AiBatchStudyModal
          batch={batch}
          onClose={() => setIsAiStudyOpen(false)}
          onCampaignScheduled={() => {
            fetchBatch();
          }}
        />
      )}
    </div>
  );
}

"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  Megaphone,
  Plus,
  Users2,
  Mail,
  Send,
  Trash2,
  ExternalLink,
  Loader2,
  Calendar,
  AlertCircle,
  Sparkles,
  RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  getMarketingBatchesAction,
  deleteMarketingBatchAction,
} from "@/actions/marketing";
import {
  getScheduledAiCampaignsAction,
  processScheduledAiQueueAction,
} from "@/actions/ai-email";
import type { MarketingBatchItem } from "@/lib/validations/marketing";
import type { MockAiCampaign } from "@/lib/db/mock-store";
import { CreateBatchModal } from "@/features/marketing/components/create-batch-modal";
import { SendBatchEmailModal } from "@/features/marketing/components/send-batch-email-modal";
import { AiBatchStudyModal } from "@/features/marketing/components/ai-batch-study-modal";

export default function MarketingPage() {
  const [activeTab, setActiveTab] = useState<"batches" | "ai_campaigns">("batches");
  const [batches, setBatches] = useState<MarketingBatchItem[]>([]);
  const [aiCampaigns, setAiCampaigns] = useState<MockAiCampaign[]>([]);
  const [stats, setStats] = useState({
    totalBatches: 0,
    totalCampaigns: 0,
    totalSentEmails: 0,
    totalLeadsBatched: 0,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessingQueue, setIsProcessingQueue] = useState(false);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [selectedBatchForSend, setSelectedBatchForSend] = useState<MarketingBatchItem | null>(null);
  const [selectedBatchForAi, setSelectedBatchForAi] = useState<MarketingBatchItem | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchBatches = async () => {
    setIsLoading(true);
    try {
      const [res, aiRes] = await Promise.all([
        getMarketingBatchesAction(),
        getScheduledAiCampaignsAction(),
      ]);
      if (res.success && res.data) {
        setBatches(res.data.batches);
        setStats(res.data.stats);
      } else {
        setError(res.error || "Failed to load marketing batches");
      }
      if (aiRes.success && aiRes.data) {
        setAiCampaigns(aiRes.data);
      }
    } catch (err: unknown) {
      setError((err as Error)?.message || "Failed to connect to marketing service");
    } finally {
      setIsLoading(false);
    }
  };

  const handleProcessQueue = async () => {
    setIsProcessingQueue(true);
    try {
      const res = await processScheduledAiQueueAction();
      if (res.success) {
        await fetchBatches();
      }
    } finally {
      setIsProcessingQueue(false);
    }
  };

  useEffect(() => {
    fetchBatches();
  }, []);

  const handleDelete = async (batchId: string) => {
    if (!confirm("Are you sure you want to delete this marketing batch?")) return;
    setDeletingId(batchId);
    try {
      const res = await deleteMarketingBatchAction(batchId);
      if (res.success) {
        fetchBatches();
      } else {
        alert(res.error || "Failed to delete batch");
      }
    } catch {
      alert("Error deleting batch");
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {error && (
        <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-sm shadow-blue-500/20">
              <Megaphone className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900 tracking-tight">
                Marketing &amp; Bulk Campaigns
              </h1>
              <p className="text-xs text-slate-500">
                Create targeted lead batches, compose personalized outreach, and send via SMTP
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            type="button"
            onClick={() => setIsCreateOpen(true)}
            className="bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs px-4 h-9 shadow-xs"
          >
            <Plus className="w-4 h-4 mr-1.5" />
            <span>Create Batch</span>
          </Button>
        </div>
      </div>

      {/* KPI Metric Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">Total Batches</span>
            <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
              <Megaphone className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-bold text-slate-900 mt-2">{stats.totalBatches}</p>
          <span className="text-[11px] text-slate-400">Created across organization</span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">Batched Leads</span>
            <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <Users2 className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-bold text-slate-900 mt-2">{stats.totalLeadsBatched}</p>
          <span className="text-[11px] text-slate-400">Targeted for campaigns</span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">Campaigns Sent</span>
            <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <Send className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-bold text-slate-900 mt-2">{stats.totalCampaigns}</p>
          <span className="text-[11px] text-slate-400">Dispatched via SMTP</span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">Emails Delivered</span>
            <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
              <Mail className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-bold text-slate-900 mt-2">{stats.totalSentEmails}</p>
          <span className="text-[11px] text-slate-400">Recorded touchpoints</span>
        </div>
      </div>

      {/* Batches & AI Campaigns Tab Bar */}
      <div className="flex items-center justify-between border-b border-slate-200 pb-2">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setActiveTab("batches")}
            className={`flex items-center gap-2 px-3 py-1.5 text-xs font-bold rounded-lg transition-colors cursor-pointer ${
              activeTab === "batches"
                ? "bg-blue-600 text-white shadow-2xs"
                : "text-slate-600 hover:bg-slate-100"
            }`}
          >
            <Users2 className="w-3.5 h-3.5" />
            <span>Lead Batches ({batches.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("ai_campaigns")}
            className={`flex items-center gap-2 px-3 py-1.5 text-xs font-bold rounded-lg transition-colors cursor-pointer ${
              activeTab === "ai_campaigns"
                ? "bg-purple-600 text-white shadow-2xs"
                : "text-slate-600 hover:bg-purple-50 hover:text-purple-700"
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>✨ AI Autonomous Campaigns ({aiCampaigns.length})</span>
          </button>
        </div>

        {activeTab === "ai_campaigns" && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleProcessQueue}
            disabled={isProcessingQueue}
            className="text-xs h-8 gap-1.5 text-purple-700 border-purple-200 hover:bg-purple-50 font-semibold"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isProcessingQueue ? "animate-spin text-purple-600" : ""}`} />
            <span>{isProcessingQueue ? "Processing Queue..." : "Run Due Queue Now"}</span>
          </Button>
        )}
      </div>

      {activeTab === "batches" ? (
        /* Batches Table Section */
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-bold text-slate-900">Lead Batches</h2>
            <p className="text-xs text-slate-500">
              Only visible to the batch creator and administrators
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={fetchBatches}
            className="text-xs h-8 text-slate-600"
          >
            Refresh
          </Button>
        </div>

        {isLoading ? (
          <div className="py-16 text-center text-xs text-slate-400 flex flex-col items-center justify-center gap-2">
            <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
            <span>Loading marketing batches...</span>
          </div>
        ) : batches.length === 0 ? (
          <div className="py-16 text-center text-slate-400 max-w-sm mx-auto space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center mx-auto">
              <Megaphone className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm font-bold text-slate-700">No Batches Created Yet</p>
              <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                Group leads into a batch (e.g. &ldquo;New Year Email&rdquo;) to compose customized emails and dispatch bulk campaigns.
              </p>
            </div>
            <Button
              type="button"
              onClick={() => setIsCreateOpen(true)}
              className="bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs h-8 px-4"
            >
              <Plus className="w-3.5 h-3.5 mr-1.5" />
              <span>Create Your First Batch</span>
            </Button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/75 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  <th className="py-3 px-4">Batch Name</th>
                  <th className="py-3 px-4">Leads</th>
                  <th className="py-3 px-4">Created By</th>
                  <th className="py-3 px-4">Last Campaign Status</th>
                  <th className="py-3 px-4">Created Date</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {batches.map((batch) => (
                  <tr key={batch.id} className="hover:bg-slate-50/80 transition-colors">
                    {/* Batch Name */}
                    <td className="py-3.5 px-4">
                      <div className="flex flex-col">
                        <Link
                          href={`/marketing/${batch.id}`}
                          className="font-bold text-slate-900 hover:text-blue-600 transition-colors flex items-center gap-1.5"
                        >
                          <span>{batch.name}</span>
                          <ExternalLink className="w-3 h-3 text-slate-400" />
                        </Link>
                        {batch.description && (
                          <span className="text-xs text-slate-500 line-clamp-1 mt-0.5">
                            {batch.description}
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Leads Count */}
                    <td className="py-3.5 px-4">
                      <Badge
                        variant="secondary"
                        className="bg-blue-50 text-blue-700 border-blue-200 font-semibold text-xs"
                      >
                        <Users2 className="w-3 h-3 mr-1" />
                        {batch.leadCount} leads
                      </Badge>
                    </td>

                    {/* Owner */}
                    <td className="py-3.5 px-4 text-xs font-medium text-slate-700">
                      {batch.ownerName || "Sales Rep"}
                    </td>

                    {/* Last Campaign Status */}
                    <td className="py-3.5 px-4">
                      {batch.lastCampaign ? (
                        <div className="flex flex-col gap-0.5">
                          <div className="flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                            <span className="text-xs font-semibold text-slate-800 truncate max-w-[200px]">
                              {batch.lastCampaign.subject}
                            </span>
                          </div>
                          <span className="text-[11px] text-slate-500 font-medium">
                            Delivered {batch.lastCampaign.sentCount} of {batch.lastCampaign.totalRecipients}
                            {batch.lastCampaign.failedCount > 0 && (
                              <span className="text-red-500 ml-1">
                                ({batch.lastCampaign.failedCount} failed)
                              </span>
                            )}
                          </span>
                        </div>
                      ) : (
                        <span className="text-xs text-slate-400 italic">No campaigns sent</span>
                      )}
                    </td>

                    {/* Created Date */}
                    <td className="py-3.5 px-4 text-xs text-slate-500">
                      <div className="flex items-center gap-1">
                        <Calendar className="w-3 h-3 text-slate-400" />
                        <span>{new Date(batch.createdAt).toLocaleDateString()}</span>
                      </div>
                    </td>

                    {/* Actions */}
                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5 flex-wrap">
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => setSelectedBatchForAi(batch)}
                          className="bg-purple-50 hover:bg-purple-100/80 text-purple-700 border-purple-200 text-xs h-7 px-2.5 shadow-2xs font-bold"
                          title="AI studies every lead in this batch and drafts personalized emails with automated follow-ups"
                        >
                          <Sparkles className="w-3 h-3 mr-1 text-purple-600" />
                          <span>AI Study</span>
                        </Button>

                        <Button
                          type="button"
                          size="sm"
                          onClick={() => setSelectedBatchForSend(batch)}
                          className="bg-blue-600 hover:bg-blue-700 text-white text-xs h-7 px-2.5 shadow-2xs font-semibold"
                        >
                          <Send className="w-3 h-3 mr-1" />
                          <span>Send Email</span>
                        </Button>

                        <Link href={`/marketing/${batch.id}`}>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="text-xs h-7 px-2 text-slate-600 hover:text-slate-900"
                          >
                            Details
                          </Button>
                        </Link>

                        <button
                          type="button"
                          onClick={() => handleDelete(batch.id)}
                          disabled={deletingId === batch.id}
                          className="p-1.5 text-slate-400 hover:text-red-600 rounded-lg hover:bg-red-50 transition-colors"
                          title="Delete Batch"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      ) : (
        /* AI Autonomous Campaigns View */
        <div className="space-y-4">
          {aiCampaigns.length === 0 ? (
            <div className="bg-white rounded-xl border border-slate-200 p-12 text-center space-y-3">
              <div className="w-12 h-12 rounded-full bg-purple-50 text-purple-600 flex items-center justify-center mx-auto">
                <Sparkles className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <h3 className="text-sm font-bold text-slate-900">No AI campaigns scheduled yet</h3>
                <p className="text-xs text-slate-500 max-w-sm mx-auto">
                  Pick any lead batch and click &quot;AI Study&quot; to study each lead individually, compose bespoke emails, and schedule automated follow-ups.
                </p>
              </div>
              <Button
                type="button"
                onClick={() => setActiveTab("batches")}
                className="bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs h-8 px-4"
              >
                <span>Select a Batch to Study &rarr;</span>
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4">
              {aiCampaigns.map((camp) => (
                <div
                  key={camp.id}
                  className="bg-white rounded-2xl border border-slate-200 p-5 space-y-4 shadow-xs"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-900 text-sm">{camp.name}</span>
                        <Badge
                          className={
                            camp.status === "COMPLETED"
                              ? "bg-emerald-100 text-emerald-800"
                              : camp.status === "ACTIVE"
                              ? "bg-blue-100 text-blue-800"
                              : "bg-purple-100 text-purple-800"
                          }
                        >
                          {camp.status}
                        </Badge>
                        {camp.enableFollowUp && (
                          <Badge variant="outline" className="text-emerald-700 border-emerald-300 text-[10px]">
                            ⚡ {camp.followUpDays}d Follow-Up Active
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-slate-500">
                        Batch: <strong>{camp.batchName}</strong> • Created by {camp.creatorName} • Pacing: Every {camp.pacingMinutes}m
                      </p>
                    </div>

                    <div className="flex items-center gap-4 text-xs font-semibold">
                      <div className="text-right">
                        <span className="text-slate-400 block text-[10px] uppercase font-bold">Progress</span>
                        <span className="text-slate-800">
                          {camp.sentCount} / {camp.totalLeads} dispatched
                        </span>
                      </div>
                      <div className="text-right">
                        <span className="text-slate-400 block text-[10px] uppercase font-bold">Replies</span>
                        <span className="text-emerald-600 font-bold">
                          {camp.repliedCount} detected
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Leads Queue Preview */}
                  <div className="border border-slate-100 rounded-xl overflow-hidden bg-slate-50/50">
                    <div className="px-3 py-2 bg-slate-100/60 border-b border-slate-200 text-[11px] font-bold text-slate-600 flex justify-between">
                      <span>Scheduled Recipient Queue ({camp.schedules.length} leads)</span>
                      <span>Next Run: {new Date(camp.scheduledStartDate).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                    </div>
                    <div className="divide-y divide-slate-100 max-h-48 overflow-y-auto">
                      {camp.schedules.map((item) => (
                        <div key={item.id} className="px-3 py-2 text-xs flex items-center justify-between gap-3">
                          <div className="truncate">
                            <span className="font-bold text-slate-900 mr-2">{item.leadName}</span>
                            <span className="text-slate-500 text-[11px]">({item.companyName})</span>
                            <span className="text-slate-400 text-[11px] block truncate">
                              Subject: &quot;{item.initialSubject}&quot;
                            </span>
                          </div>
                          <Badge
                            variant={
                              item.status === "SENT" || item.status === "FOLLOW_UP_SENT"
                                ? "success"
                                : item.status === "REPLIED"
                                ? "default"
                                : item.status === "AWAITING_REPLY"
                                ? "warning"
                                : "secondary"
                            }
                            className="text-[10px] shrink-0 font-bold"
                          >
                            {item.status}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Create Batch Modal */}
      <CreateBatchModal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        onBatchCreated={() => {
          fetchBatches();
        }}
      />

      {/* Send Email Modal */}
      {selectedBatchForSend && (
        <SendBatchEmailModal
          isOpen={Boolean(selectedBatchForSend)}
          onClose={() => setSelectedBatchForSend(null)}
          batch={selectedBatchForSend}
          onCampaignDispatched={() => {
            fetchBatches();
          }}
        />
      )}

      {/* AI Batch Study & Schedule Modal */}
      {selectedBatchForAi && (
        <AiBatchStudyModal
          batch={selectedBatchForAi}
          onClose={() => setSelectedBatchForAi(null)}
          onCampaignScheduled={() => {
            fetchBatches();
            setActiveTab("ai_campaigns");
          }}
        />
      )}
    </div>
  );
}

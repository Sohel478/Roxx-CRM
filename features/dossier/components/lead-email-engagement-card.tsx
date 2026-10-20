"use client";

import { useState } from "react";
import {
  Mail,
  Eye,
  MousePointerClick,
  AlertTriangle,
  UserX,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  Send,
  ExternalLink,
  ShieldCheck,
  RefreshCw,
  Copy,
  Check,
  Info,
  Sparkles,
  RotateCcw,
  HelpCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import type { LeadEmailEngagementSummary, LeadEmailDispatchItem } from "@/actions/marketing";
import {
  simulateLeadEmailEngagementAction,
  sendTestTrackedEmailAction,
} from "@/actions/marketing";
import { generateTrackingUrls } from "@/lib/email/tracking-urls";

interface LeadEmailEngagementCardProps {
  summary: LeadEmailEngagementSummary | null;
  isLoading?: boolean;
  onRefresh?: () => void;
  leadId?: string;
  leadEmail?: string | null;
  leadName?: string | null;
}

export function LeadEmailEngagementCard({
  summary,
  isLoading = false,
  onRefresh,
  leadId,
  leadEmail,
  leadName,
}: LeadEmailEngagementCardProps) {
  const [isCardExpanded, setIsCardExpanded] = useState(true);
  const [isHistoryExpanded, setIsHistoryExpanded] = useState(true);
  const [showDiagnostics, setShowDiagnostics] = useState(false);

  const [activeSimId, setActiveSimId] = useState<string | null>(null);
  const [isSendingTest, setIsSendingTest] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [simBanner, setSimBanner] = useState<{ type: "success" | "error"; message: string } | null>(
    null
  );

  if (isLoading && !summary) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs animate-pulse">
        <div className="h-4 bg-slate-200 rounded w-1/3 mb-3"></div>
        <div className="h-8 bg-slate-100 rounded w-full"></div>
      </div>
    );
  }

  const items = summary?.items || [];
  const overallStatus = summary?.overallStatus || "NONE";
  const totalSent = summary?.totalSent || 0;
  const totalOpens = summary?.totalOpens || 0;
  const totalClicks = summary?.totalClicks || 0;
  const isBounced = Boolean(summary?.isBounced);
  const isUnsubscribed = Boolean(summary?.isUnsubscribed);

  const openRate = totalSent > 0 ? Math.round((totalOpens / totalSent) * 100) : 0;
  const clickRate = totalOpens > 0 ? Math.round((totalClicks / totalOpens) * 100) : 0;

  const handleSimulate = async (
    dispatchId: string,
    event: "OPEN" | "CLICK" | "BOUNCED" | "UNSUBSCRIBE" | "RESET"
  ) => {
    if (!leadId) return;
    setActiveSimId(`${dispatchId}_${event}`);
    try {
      const res = await simulateLeadEmailEngagementAction({
        leadId,
        dispatchId,
        event,
        targetUrl: "https://roxx-crm.com/demo",
      });
      if (res.success) {
        setSimBanner({ type: "success", message: res.message });
        onRefresh?.();
        setTimeout(() => setSimBanner(null), 4500);
      } else {
        setSimBanner({ type: "error", message: res.error || "Simulation failed" });
      }
    } catch (e: any) {
      setSimBanner({ type: "error", message: e?.message || "Simulation failed" });
    } finally {
      setActiveSimId(null);
    }
  };

  const handleSendTestOutreach = async () => {
    if (!leadId) return;
    setIsSendingTest(true);
    try {
      const res = await sendTestTrackedEmailAction({
        leadId,
        toEmail: leadEmail || undefined,
        subject: `Product Overview & Demo for ${leadName || "Client"}`,
      });
      if (res.success) {
        setSimBanner({ type: "success", message: res.message });
        onRefresh?.();
        setTimeout(() => setSimBanner(null), 5000);
      } else {
        setSimBanner({ type: "error", message: res.error || "Failed to dispatch test email" });
      }
    } catch (e: any) {
      setSimBanner({ type: "error", message: e?.message || "Failed to dispatch test email" });
    } finally {
      setIsSendingTest(false);
    }
  };

  const handleCopyTrackingLink = (dispatchId: string) => {
    if (!leadId) return;
    const urls = generateTrackingUrls(dispatchId, leadId, leadEmail || undefined);
    navigator.clipboard.writeText(urls.openTrackingUrl);
    setCopiedId(dispatchId);
    setSimBanner({
      type: "success",
      message: "Open tracking pixel URL copied! Paste it in a browser tab to test immediate trigger.",
    });
    setTimeout(() => {
      setCopiedId(null);
      setSimBanner(null);
    }, 4000);
  };

  const renderStatusBadge = (
    status: "DELIVERED" | "OPENED" | "CLICKED" | "BOUNCED" | "UNSUBSCRIBED" | "NONE",
    openCount?: number,
    clickCount?: number
  ) => {
    switch (status) {
      case "CLICKED":
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200 shadow-2xs">
            <MousePointerClick className="w-3.5 h-3.5 text-blue-600" />
            <span>Clicked (CTR){clickCount && clickCount > 1 ? ` • ${clickCount}x` : ""}</span>
          </span>
        );
      case "OPENED":
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 shadow-2xs">
            <Eye className="w-3.5 h-3.5 text-emerald-600" />
            <span>Opened / Read{openCount && openCount > 1 ? ` • ${openCount}x` : ""}</span>
          </span>
        );
      case "BOUNCED":
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-red-50 text-red-700 border border-red-200 shadow-2xs">
            <AlertTriangle className="w-3.5 h-3.5 text-red-600" />
            <span>Bounced (Delivery Failed)</span>
          </span>
        );
      case "UNSUBSCRIBED":
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200 shadow-2xs">
            <UserX className="w-3.5 h-3.5 text-amber-600" />
            <span>Unsubscribed</span>
          </span>
        );
      case "DELIVERED":
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-700 border border-slate-200 shadow-2xs">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            <span>Delivered</span>
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-slate-50 text-slate-500 border border-slate-200">
            <Clock className="w-3.5 h-3.5 text-slate-400" />
            <span>No Outreach Yet</span>
          </span>
        );
    }
  };

  const formatDateTime = (isoString?: string | null) => {
    if (!isoString) return "";
    try {
      const d = new Date(isoString);
      return d.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
      });
    } catch {
      return isoString;
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
      {/* Top Banner Header */}
      <div className="p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-gradient-to-r from-slate-50/70 to-white">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center border border-blue-100 shadow-2xs shrink-0">
            <Mail className="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-sm font-bold text-slate-900">
                Email Delivery &amp; Engagement Status
              </h3>
              <span className="text-[10px] font-bold uppercase tracking-wider bg-blue-50 text-blue-700 px-2 py-0.5 rounded">
                Live Tracking
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Tracks batch marketing campaigns and 1-on-1 direct outbound emails
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {renderStatusBadge(overallStatus, totalOpens, totalClicks)}
          {onRefresh && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onRefresh}
              disabled={isLoading}
              className="h-8 px-2 text-slate-500 hover:text-slate-700"
              title="Refresh email tracking status"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin" : ""}`} />
            </Button>
          )}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setIsCardExpanded((prev) => !prev)}
            className="h-8 px-2.5 text-xs font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-100 flex items-center gap-1.5"
            title={isCardExpanded ? "Collapse email status card" : "Expand email status card"}
          >
            <span>{isCardExpanded ? "Collapse" : "Expand"}</span>
            {isCardExpanded ? (
              <ChevronUp className="w-3.5 h-3.5 text-slate-500" />
            ) : (
              <ChevronDown className="w-3.5 h-3.5 text-slate-500" />
            )}
          </Button>
        </div>
      </div>

      {isCardExpanded && (
        <>
          {/* Action / Simulation Feedback Banner */}
          {simBanner && (
            <div
              className={`px-5 py-2.5 text-xs font-medium border-b flex items-center justify-between gap-2 transition-all ${
                simBanner.type === "success"
                  ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                  : "bg-red-50 text-red-800 border-red-200"
              }`}
            >
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>{simBanner.message}</span>
              </div>
              <button
                type="button"
                onClick={() => setSimBanner(null)}
                className="text-slate-400 hover:text-slate-600 text-xs font-bold"
              >
                &times;
              </button>
            </div>
          )}

          {/* Bounce Warning Alert */}
      {isBounced && (
        <div className="bg-red-50/90 border-b border-red-200 px-5 py-3.5 flex items-start gap-3">
          <AlertTriangle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
          <div className="text-xs space-y-0.5">
            <p className="font-bold text-red-900">
              Delivery Bounced &bull; Mailbox Unavailable
            </p>
            <p className="text-red-700">
              {summary?.bounceReason || "Remote mail server rejected delivery (550 User unknown)."} This email address is suppressed from future outreach.
            </p>
          </div>
        </div>
      )}

      {/* Unsubscribe Alert */}
      {isUnsubscribed && !isBounced && (
        <div className="bg-amber-50/90 border-b border-amber-200 px-5 py-3.5 flex items-start gap-3">
          <UserX className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <div className="text-xs space-y-0.5">
            <p className="font-bold text-amber-900">
              Recipient Opted Out &bull; Unsubscribed
            </p>
            <p className="text-amber-700">
              {summary?.unsubscribedAt
                ? `Opted out on ${formatDateTime(summary.unsubscribedAt)}.`
                : "Recipient opted out from marketing communications."}{" "}
              Suppression active to ensure CAN-SPAM / GDPR compliance.
            </p>
          </div>
        </div>
      )}

      {/* KPI Metric Summary Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 divide-x divide-y sm:divide-y-0 divide-slate-100 border-b border-slate-100 bg-white">
        <div className="p-4 text-center">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
            Emails Sent
          </span>
          <div className="text-lg font-black text-slate-900 flex items-center justify-center gap-1">
            <Send className="w-4 h-4 text-slate-400 inline" />
            <span>{totalSent}</span>
          </div>
          <span className="text-[11px] text-slate-400 font-medium">Batch + 1-on-1</span>
        </div>

        <div className="p-4 text-center">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
            Total Opens
          </span>
          <div className="text-lg font-black text-emerald-600 flex items-center justify-center gap-1">
            <Eye className="w-4 h-4 text-emerald-500 inline" />
            <span>{totalOpens}</span>
          </div>
          <span className="text-[11px] text-emerald-700 font-medium">
            {totalSent > 0 ? `${openRate}% open rate` : "No reads yet"}
          </span>
        </div>

        <div className="p-4 text-center">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
            Link Clicks
          </span>
          <div className="text-lg font-black text-blue-600 flex items-center justify-center gap-1">
            <MousePointerClick className="w-4 h-4 text-blue-500 inline" />
            <span>{totalClicks}</span>
          </div>
          <span className="text-[11px] text-blue-700 font-medium">
            {totalOpens > 0 ? `${clickRate}% CTR` : "0% CTR"}
          </span>
        </div>

        <div className="p-4 text-center">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
            Deliverability
          </span>
          <div className="text-lg font-black text-slate-900 flex items-center justify-center gap-1">
            <ShieldCheck className="w-4 h-4 text-emerald-500 inline" />
            <span>{isBounced ? "Failed" : totalSent > 0 ? "100%" : "Ready"}</span>
          </div>
          <span className="text-[11px] text-slate-400 font-medium">
            {isBounced ? "Suppressed" : isUnsubscribed ? "Unsubscribed" : "Clean domain"}
          </span>
        </div>
      </div>

      {/* Dispatched Emails History */}
      <div className="p-5">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Clock className="w-3.5 h-3.5 text-slate-400" />
            <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
              Outbound Email Log ({items.length})
            </h4>
          </div>

          <div className="flex items-center gap-2">
            {leadId && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleSendTestOutreach}
                disabled={isSendingTest}
                className="h-7 px-2.5 text-xs text-blue-600 border-blue-200 hover:bg-blue-50 font-medium flex items-center gap-1"
              >
                <Sparkles className="w-3 h-3 text-blue-500" />
                <span>{isSendingTest ? "Sending..." : "Send Test Tracked Email"}</span>
              </Button>
            )}

            {items.length > 0 && (
              <button
                type="button"
                onClick={() => setIsHistoryExpanded((prev) => !prev)}
                className="text-xs font-semibold text-blue-600 hover:text-blue-700 flex items-center gap-1 transition-colors"
              >
                <span>{isHistoryExpanded ? "Collapse History" : "View All Dispatches"}</span>
                {isHistoryExpanded ? (
                  <ChevronUp className="w-3.5 h-3.5" />
                ) : (
                  <ChevronDown className="w-3.5 h-3.5" />
                )}
              </button>
            )}
          </div>
        </div>

        {items.length === 0 ? (
          <div className="py-7 px-4 text-center bg-slate-50 rounded-xl border border-dashed border-slate-200">
            <Mail className="w-8 h-8 text-slate-300 mx-auto mb-2" />
            <p className="text-xs font-bold text-slate-800">No outbound emails dispatched yet</p>
            <p className="text-[11px] text-slate-500 mt-1 max-w-md mx-auto leading-relaxed">
              Emails sent via Marketing Campaigns, AI Sequences, or the 1-on-1 composer will appear
              here with live open and click tracking.
            </p>
            {leadId && (
              <Button
                type="button"
                onClick={handleSendTestOutreach}
                disabled={isSendingTest}
                className="mt-3.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs h-8 px-4 inline-flex items-center gap-1.5 shadow-xs"
              >
                <Send className="w-3.5 h-3.5" />
                <span>{isSendingTest ? "Dispatching..." : "Send Test Outreach Email Now"}</span>
              </Button>
            )}
          </div>
        ) : isHistoryExpanded ? (
          <div className="space-y-3">
            {items.map((item) => (
              <div
                key={item.id}
                className="p-3.5 rounded-xl border border-slate-200 hover:border-slate-300 transition-all bg-white shadow-2xs space-y-2.5"
              >
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2">
                  <div className="min-w-0 space-y-0.5">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-bold text-slate-900 truncate">
                        {item.subject}
                      </span>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200 shrink-0">
                        {item.source === "BATCH_CAMPAIGN"
                          ? "Batch Campaign"
                          : item.source === "AI_CAMPAIGN"
                          ? "AI Sequence"
                          : "1-on-1 Direct"}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400">
                      To <span className="font-semibold text-slate-600">{item.recipientEmail}</span>{" "}
                      &bull; Sent {formatDateTime(item.sentAt)}
                      {item.senderName ? ` by ${item.senderName}` : ""}
                    </p>
                  </div>

                  <div className="shrink-0 flex items-center gap-2 flex-wrap">
                    {renderStatusBadge(item.status, item.openCount, item.clickCount)}
                  </div>
                </div>

                {/* Additional event details: openedAt, clickedAt, bounceReason */}
                <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-slate-50 text-[11px] text-slate-500">
                  {item.openedAt && (
                    <span className="inline-flex items-center gap-1 text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-100">
                      <Eye className="w-3 h-3 text-emerald-600" />
                      Opened {formatDateTime(item.openedAt)} ({item.openCount}{" "}
                      {item.openCount === 1 ? "open" : "opens"})
                    </span>
                  )}

                  {item.clickedAt && (
                    <span className="inline-flex items-center gap-1 text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-100">
                      <MousePointerClick className="w-3 h-3 text-blue-600" />
                      Clicked {formatDateTime(item.clickedAt)} ({item.clickCount}{" "}
                      {item.clickCount === 1 ? "click" : "clicks"})
                    </span>
                  )}

                  {item.lastClickedUrl && (
                    <a
                      href={item.lastClickedUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-blue-600 hover:underline max-w-xs truncate"
                      title={item.lastClickedUrl}
                    >
                      <ExternalLink className="w-3 h-3 shrink-0" />
                      <span className="truncate">{item.lastClickedUrl}</span>
                    </a>
                  )}

                  {item.bouncedAt && item.bounceReason && (
                    <span className="inline-flex items-center gap-1 text-red-700 bg-red-50 px-2 py-0.5 rounded border border-red-100">
                      <AlertTriangle className="w-3 h-3 text-red-600" />
                      Reason: {item.bounceReason}
                    </span>
                  )}

                  {item.unsubscribedAt && (
                    <span className="inline-flex items-center gap-1 text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-100">
                      <UserX className="w-3 h-3 text-amber-600" />
                      Unsubscribed on {formatDateTime(item.unsubscribedAt)}
                    </span>
                  )}

                  {!item.openedAt &&
                    !item.bouncedAt &&
                    !item.unsubscribedAt &&
                    item.status === "DELIVERED" && (
                      <span className="inline-flex items-center gap-1 text-slate-400">
                        <Clock className="w-3 h-3" />
                        Delivered &bull; Awaiting recipient open
                      </span>
                    )}
                </div>

                {/* Interactive Tracking Simulation & Verification Bar */}
                <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2 bg-slate-50/60 -mx-3.5 -mb-3.5 p-2.5 rounded-b-xl">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mr-1">
                      Live Test Actions:
                    </span>

                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => handleSimulate(item.id, "OPEN")}
                      disabled={Boolean(activeSimId)}
                      className="h-6 px-2 text-[11px] font-semibold text-emerald-700 border-emerald-200 hover:bg-emerald-50 bg-white"
                      title="Simulate recipient opening this email"
                    >
                      <Eye className="w-3 h-3 text-emerald-600 mr-1" />
                      {activeSimId === `${item.id}_OPEN` ? "Recording..." : "Test Open"}
                    </Button>

                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => handleSimulate(item.id, "CLICK")}
                      disabled={Boolean(activeSimId)}
                      className="h-6 px-2 text-[11px] font-semibold text-blue-700 border-blue-200 hover:bg-blue-50 bg-white"
                      title="Simulate recipient clicking a link"
                    >
                      <MousePointerClick className="w-3 h-3 text-blue-600 mr-1" />
                      {activeSimId === `${item.id}_CLICK` ? "Recording..." : "Test Click"}
                    </Button>

                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => handleSimulate(item.id, "BOUNCED")}
                      disabled={Boolean(activeSimId)}
                      className="h-6 px-2 text-[11px] font-semibold text-red-700 border-red-200 hover:bg-red-50 bg-white"
                      title="Simulate a remote delivery bounce"
                    >
                      <AlertTriangle className="w-3 h-3 text-red-600 mr-1" />
                      {activeSimId === `${item.id}_BOUNCED` ? "Recording..." : "Test Bounce"}
                    </Button>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => handleCopyTrackingLink(item.id)}
                      className="h-6 px-2 text-[11px] text-slate-500 hover:text-slate-700 flex items-center gap-1"
                      title="Copy tracking pixel URL to test in browser"
                    >
                      {copiedId === item.id ? (
                        <>
                          <Check className="w-3 h-3 text-emerald-600" />
                          <span className="text-emerald-700 font-bold">Copied!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3 h-3 text-slate-400" />
                          <span>Copy Pixel Link</span>
                        </>
                      )}
                    </Button>

                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => handleSimulate(item.id, "RESET")}
                      disabled={Boolean(activeSimId)}
                      className="h-6 px-2 text-[11px] text-slate-400 hover:text-slate-600"
                      title="Reset tracking stats back to Delivered"
                    >
                      <RotateCcw className="w-3 h-3 text-slate-400 mr-1" />
                      Reset
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : null}

        {/* Diagnostics & Live Help Drawer */}
        <div className="mt-4 pt-3 border-t border-slate-100">
          <button
            type="button"
            onClick={() => setShowDiagnostics((prev) => !prev)}
            className="text-[11px] text-slate-500 hover:text-slate-700 flex items-center gap-1.5 transition-colors"
          >
            <HelpCircle className="w-3.5 h-3.5 text-blue-500" />
            <span className="font-semibold">How Live Email Behavior Tracking Works</span>
            <ChevronDown
              className={`w-3 h-3 transition-transform ${showDiagnostics ? "rotate-180" : ""}`}
            />
          </button>

          {showDiagnostics && (
            <div className="mt-2.5 p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-600 space-y-2">
              <div className="flex items-start gap-2">
                <Info className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                <p className="leading-relaxed">
                  <strong>Open Tracking:</strong> Embedded 1&times;1 transparent GIF pixel (
                  <code className="text-[11px] bg-slate-200/80 px-1 py-0.5 rounded">
                    /api/v1/email/track/open
                  </code>
                  ). When the client&apos;s email program loads images, the open count and timestamp
                  automatically update.
                </p>
              </div>
              <div className="flex items-start gap-2">
                <Info className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <p className="leading-relaxed">
                  <strong>Click Tracking:</strong> Hyperlinks are automatically wrapped with our secure 302
                  redirector (
                  <code className="text-[11px] bg-slate-200/80 px-1 py-0.5 rounded">
                    /api/v1/email/track/click
                  </code>
                  ), instantly recording CTR before redirecting to the target URL.
                </p>
              </div>
              <div className="flex items-start gap-2">
                <Info className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <p className="leading-relaxed">
                  <strong>Localhost vs Remote Notice:</strong> Remote mail providers (such as Gmail
                  Image Proxy) cannot load images hosted on <code className="text-[11px] bg-slate-200/80 px-1 py-0.5 rounded">localhost</code>.
                  For live local testing, use the <strong>Test Open</strong> or <strong>Test Click</strong> buttons
                  above, copy the live pixel link into a browser, or set{" "}
                  <code className="text-[11px] bg-slate-200/80 px-1 py-0.5 rounded">NEXT_PUBLIC_APP_URL</code> to a public domain / ngrok tunnel.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
        </>
      )}
    </div>
  );
}

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
} from "lucide-react";
import { Button } from "@/components/ui/button";
import type { LeadEmailEngagementSummary, LeadEmailDispatchItem } from "@/actions/marketing";

interface LeadEmailEngagementCardProps {
  summary: LeadEmailEngagementSummary | null;
  isLoading?: boolean;
  onRefresh?: () => void;
}

export function LeadEmailEngagementCard({
  summary,
  isLoading = false,
  onRefresh,
}: LeadEmailEngagementCardProps) {
  const [isHistoryExpanded, setIsHistoryExpanded] = useState(true);

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
        </div>
      </div>

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

        {items.length === 0 ? (
          <div className="py-6 text-center bg-slate-50 rounded-xl border border-dashed border-slate-200">
            <Mail className="w-7 h-7 text-slate-300 mx-auto mb-2" />
            <p className="text-xs font-bold text-slate-700">No outbound emails dispatched yet</p>
            <p className="text-[11px] text-slate-400 mt-0.5 max-w-sm mx-auto">
              Emails sent via Marketing Campaigns, AI Sequences, or the 1-on-1 composer below will appear here with live open &amp; click tracking.
            </p>
          </div>
        ) : isHistoryExpanded ? (
          <div className="space-y-3">
            {items.map((item) => (
              <div
                key={item.id}
                className="p-3.5 rounded-xl border border-slate-200 hover:border-slate-300 transition-all bg-white shadow-2xs space-y-2.5"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
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
                      To <span className="font-semibold text-slate-600">{item.recipientEmail}</span> &bull; Sent {formatDateTime(item.sentAt)}
                      {item.senderName ? ` by ${item.senderName}` : ""}
                    </p>
                  </div>

                  <div className="shrink-0">
                    {renderStatusBadge(item.status, item.openCount, item.clickCount)}
                  </div>
                </div>

                {/* Additional event details: openedAt, clickedAt, bounceReason */}
                <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-slate-50 text-[11px] text-slate-500">
                  {item.openedAt && (
                    <span className="inline-flex items-center gap-1 text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-100">
                      <Eye className="w-3 h-3 text-emerald-600" />
                      Opened {formatDateTime(item.openedAt)} ({item.openCount} {item.openCount === 1 ? "open" : "opens"})
                    </span>
                  )}

                  {item.clickedAt && (
                    <span className="inline-flex items-center gap-1 text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-100">
                      <MousePointerClick className="w-3 h-3 text-blue-600" />
                      Clicked {formatDateTime(item.clickedAt)} ({item.clickCount} {item.clickCount === 1 ? "click" : "clicks"})
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

                  {!item.openedAt && !item.bouncedAt && !item.unsubscribedAt && item.status === "DELIVERED" && (
                    <span className="inline-flex items-center gap-1 text-slate-400">
                      <Clock className="w-3 h-3" />
                      Delivered &bull; Awaiting recipient open
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}

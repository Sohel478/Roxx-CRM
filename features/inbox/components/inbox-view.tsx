"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  Inbox,
  Mail,
  MailOpen,
  Search,
  RefreshCw,
  Send,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Clock,
  User,
  ArrowLeft,
  Settings,
  Reply,
  ExternalLink,
  Tag,
  Check,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  getInboxEmailsAction,
  getInboxAccountStatusAction,
  syncInboxAction,
  markEmailAsReadAction,
  replyToClientAction,
  InboxAccountStatus,
} from "@/actions/inbox";
import type { InboxEmailItem } from "@/lib/validations/email";

export function InboxView() {
  const [emails, setEmails] = useState<InboxEmailItem[]>([]);
  const [selectedEmail, setSelectedEmail] = useState<InboxEmailItem | null>(null);
  const [filter, setFilter] = useState<"all" | "replies" | "unread">("all");
  const [search, setSearch] = useState("");
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [accountStatus, setAccountStatus] = useState<InboxAccountStatus | null>(null);
  const [syncFeedback, setSyncFeedback] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  // Reply Form State
  const [isReplying, setIsReplying] = useState(false);
  const [replyBody, setReplyBody] = useState("");
  const [isSendingReply, setIsSendingReply] = useState(false);
  const [replyFeedback, setReplyFeedback] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  const [mobileShowDetail, setMobileShowDetail] = useState(false);

  const loadData = async (targetFilter = filter, targetSearch = search) => {
    setIsLoading(true);
    try {
      const [emailRes, statusRes] = await Promise.all([
        getInboxEmailsAction({
          filter: targetFilter,
          search: targetSearch,
        }),
        getInboxAccountStatusAction(),
      ]);

      if (statusRes.success && statusRes.data) {
        setAccountStatus(statusRes.data);
      }

      if (emailRes.success) {
        setEmails(emailRes.data);
        setUnreadCount(emailRes.unreadCount);
        // If an email is selected, update its reference in the list
        if (selectedEmail) {
          const updated = emailRes.data.find((e) => e.id === selectedEmail.id);
          if (updated) setSelectedEmail(updated);
        } else if (emailRes.data.length > 0 && typeof window !== "undefined" && window.innerWidth >= 1024) {
          // Auto-select first email on desktop
          setSelectedEmail(emailRes.data[0]);
        }
      }
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData(filter, search);
  }, [filter]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    loadData(filter, search);
  };

  const handleSync = async () => {
    setIsSyncing(true);
    setSyncFeedback(null);
    try {
      const res = await syncInboxAction();
      if (res.success) {
        setSyncFeedback({
          type: "success",
          text: res.message || "Inbox synchronized successfully.",
        });
        await loadData(filter, search);
      } else {
        setSyncFeedback({
          type: "error",
          text: res.error || "Failed to synchronize incoming mail.",
        });
      }
    } finally {
      setIsSyncing(false);
      setTimeout(() => setSyncFeedback(null), 6000);
    }
  };

  const handleSelectEmail = async (email: InboxEmailItem) => {
    setSelectedEmail(email);
    setMobileShowDetail(true);
    setIsReplying(false);
    setReplyBody("");
    setReplyFeedback(null);

    // If unread, mark as read
    if (!email.isRead) {
      setEmails((prev) =>
        prev.map((e) => (e.id === email.id ? { ...e, isRead: true } : e))
      );
      setUnreadCount((c) => Math.max(0, c - 1));
      await markEmailAsReadAction(email.id, true);
    }
  };

  const handleToggleReadStatus = async (e: React.MouseEvent, email: InboxEmailItem) => {
    e.stopPropagation();
    const nextReadState = !email.isRead;
    setEmails((prev) =>
      prev.map((item) =>
        item.id === email.id ? { ...item, isRead: nextReadState } : item
      )
    );
    if (selectedEmail && selectedEmail.id === email.id) {
      setSelectedEmail({ ...selectedEmail, isRead: nextReadState });
    }
    setUnreadCount((c) => (nextReadState ? Math.max(0, c - 1) : c + 1));
    await markEmailAsReadAction(email.id, nextReadState);
  };

  const handleSendReply = async () => {
    if (!selectedEmail || !replyBody.trim()) return;

    setIsSendingReply(true);
    setReplyFeedback(null);

    try {
      const replySubject = selectedEmail.subject.startsWith("Re:")
        ? selectedEmail.subject
        : `Re: ${selectedEmail.subject}`;

      const res = await replyToClientAction({
        emailId: selectedEmail.id,
        to: selectedEmail.fromEmail,
        subject: replySubject,
        body: replyBody.trim(),
        leadId: selectedEmail.leadId,
        inReplyTo: selectedEmail.messageId,
      });

      if (res.success) {
        setReplyFeedback({
          type: "success",
          text: res.message || "Reply delivered successfully to client!",
        });
        setReplyBody("");
        setIsReplying(false);
      } else {
        setReplyFeedback({
          type: "error",
          text: res.error || "Failed to dispatch email reply.",
        });
      }
    } finally {
      setIsSendingReply(false);
      setTimeout(() => setReplyFeedback(null), 6000);
    }
  };

  const formatEmailDate = (dateString: string) => {
    try {
      const d = new Date(dateString);
      const now = new Date();
      const isToday = d.toDateString() === now.toDateString();
      if (isToday) {
        return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
      }
      return d.toLocaleDateString([], { month: "short", day: "numeric" });
    } catch {
      return dateString;
    }
  };

  const activeConnectedEmail =
    accountStatus?.connectedEmail || "infotflux@gmail.com";

  return (
    <div className="space-y-4">
      {/* Top Header Card */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0 border border-blue-100">
            <Inbox className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-bold text-slate-900 tracking-tight">CRM Inbox</h1>
              {unreadCount > 0 && (
                <Badge variant="default" className="text-[11px] font-bold bg-blue-600">
                  {unreadCount} Unread
                </Badge>
              )}
            </div>

            {/* Connected Mailbox Pill */}
            <div className="flex items-center gap-2 mt-1.5 flex-wrap">
              {accountStatus?.isConfigured ? (
                <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-50 border border-emerald-200 text-xs">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shrink-0" />
                  <span className="text-slate-600 font-medium">Connected Mailbox:</span>
                  <span className="font-mono font-bold text-slate-900 bg-white px-2 py-0.5 rounded border border-emerald-300 text-[11px]">
                    {activeConnectedEmail}
                  </span>
                  <span className="text-emerald-700 font-semibold text-[11px] hidden sm:inline">
                    • Synced to Outbound Relay
                  </span>
                </div>
              ) : (
                <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-800">
                  <AlertCircle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                  <span>No email account connected yet.</span>
                  <Link href="/settings" className="font-bold underline text-amber-900">
                    Connect Email in Settings &rarr;
                  </Link>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleSync}
            disabled={isSyncing}
            className="text-xs font-semibold gap-1.5 h-9"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-blue-600 ${isSyncing ? "animate-spin" : ""}`} />
            <span>{isSyncing ? "Syncing Mail..." : "Sync Mail"}</span>
          </Button>

          <Link href="/settings">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="text-xs font-semibold gap-1.5 h-9 text-slate-600 hover:text-slate-900"
            >
              <Settings className="w-3.5 h-3.5 text-slate-500" />
              <span>Email Settings</span>
            </Button>
          </Link>
        </div>
      </div>

      {/* Sync Status Banner */}
      {syncFeedback && (
        <div
          className={`p-3.5 rounded-xl border text-xs flex items-center gap-2.5 animate-in fade-in ${
            syncFeedback.type === "success"
              ? "bg-emerald-50 border-emerald-200 text-emerald-800"
              : "bg-rose-50 border-rose-200 text-rose-800"
          }`}
        >
          {syncFeedback.type === "success" ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
          )}
          <span className="font-semibold">{syncFeedback.text}</span>
        </div>
      )}

      {/* Main Two-Column Inbox Workspace */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden flex flex-col lg:flex-row min-h-[620px]">
        {/* Left Column: Email List */}
        <div
          className={`w-full lg:w-5/12 border-r border-slate-200 flex flex-col ${
            mobileShowDetail ? "hidden lg:flex" : "flex"
          }`}
        >
          {/* Filter Pills & Search Bar */}
          <div className="p-4 border-b border-slate-200 space-y-3 bg-slate-50/50">
            {/* Search Input */}
            <form onSubmit={handleSearchSubmit} className="relative">
              <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
              <Input
                type="text"
                placeholder="Search sender, subject, lead..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 h-9 text-xs bg-white"
              />
            </form>

            {/* Filter Tags */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
              <button
                type="button"
                onClick={() => setFilter("all")}
                className={`px-3 py-1 rounded-lg font-bold transition-all text-xs whitespace-nowrap ${
                  filter === "all"
                    ? "bg-blue-600 text-white shadow-2xs"
                    : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-100"
                }`}
              >
                All Messages
              </button>

              <button
                type="button"
                onClick={() => setFilter("replies")}
                className={`px-3 py-1 rounded-lg font-bold transition-all text-xs whitespace-nowrap flex items-center gap-1.5 ${
                  filter === "replies"
                    ? "bg-purple-600 text-white shadow-2xs"
                    : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-100"
                }`}
              >
                <Tag className="w-3 h-3" />
                <span>Lead Replies</span>
              </button>

              <button
                type="button"
                onClick={() => setFilter("unread")}
                className={`px-3 py-1 rounded-lg font-bold transition-all text-xs whitespace-nowrap flex items-center gap-1.5 ${
                  filter === "unread"
                    ? "bg-blue-600 text-white shadow-2xs"
                    : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-100"
                }`}
              >
                <span>Unread</span>
                {unreadCount > 0 && (
                  <span
                    className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                      filter === "unread" ? "bg-white text-blue-600" : "bg-blue-100 text-blue-700"
                    }`}
                  >
                    {unreadCount}
                  </span>
                )}
              </button>
            </div>
          </div>

          {/* Email Item Rows */}
          <div className="flex-1 overflow-y-auto divide-y divide-slate-100 max-h-[640px]">
            {isLoading ? (
              <div className="p-12 text-center text-slate-400">
                <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-blue-600" />
                <p className="text-xs font-semibold">Loading messages...</p>
              </div>
            ) : emails.length === 0 ? (
              <div className="p-12 text-center text-slate-400 space-y-3">
                <MailOpen className="w-8 h-8 mx-auto text-slate-300" />
                <p className="text-xs font-bold text-slate-700">No client replies yet</p>
                <p className="text-[11px] text-slate-400 max-w-xs mx-auto">
                  Connected to <strong className="text-slate-700 font-mono">{activeConnectedEmail}</strong>. Incoming replies from clients will automatically appear here.
                </p>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={handleSync}
                  disabled={isSyncing}
                  className="text-xs font-semibold gap-1.5 h-8"
                >
                  <RefreshCw className={`w-3.5 h-3.5 text-blue-600 ${isSyncing ? "animate-spin" : ""}`} />
                  <span>Sync Now</span>
                </Button>
              </div>
            ) : (
              emails.map((email) => {
                const isSelected = selectedEmail?.id === email.id;
                return (
                  <div
                    key={email.id}
                    onClick={() => handleSelectEmail(email)}
                    className={`p-4 cursor-pointer transition-all hover:bg-slate-50 relative ${
                      isSelected ? "bg-blue-50/60 border-l-4 border-l-blue-600" : ""
                    } ${!email.isRead ? "bg-white" : "bg-slate-50/30 text-slate-600"}`}
                  >
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <div className="flex items-center gap-2 min-w-0">
                        {!email.isRead && (
                          <span className="w-2 h-2 rounded-full bg-blue-600 shrink-0" />
                        )}
                        <span
                          className={`text-xs truncate ${
                            !email.isRead ? "font-bold text-slate-900" : "font-semibold text-slate-700"
                          }`}
                        >
                          {email.fromName || email.fromEmail}
                        </span>
                      </div>
                      <span className="text-[11px] text-slate-400 shrink-0 font-medium">
                        {formatEmailDate(email.date)}
                      </span>
                    </div>

                    <div className="text-xs font-semibold text-slate-900 truncate mb-1">
                      {email.subject}
                    </div>

                    <p className="text-[11px] text-slate-500 line-clamp-2 leading-relaxed mb-2">
                      {email.snippet}
                    </p>

                    <div className="flex items-center justify-between gap-2">
                      {email.leadName ? (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-purple-700 bg-purple-50 px-2 py-0.5 rounded border border-purple-200">
                          <User className="w-3 h-3" />
                          <span>Lead: {email.leadName}</span>
                        </span>
                      ) : (
                        <span className="text-[10px] text-slate-400 truncate font-mono">
                          {email.fromEmail}
                        </span>
                      )}

                      <button
                        type="button"
                        onClick={(e) => handleToggleReadStatus(e, email)}
                        className="text-[10px] font-semibold text-slate-400 hover:text-slate-600 shrink-0"
                      >
                        {email.isRead ? "Mark unread" : "Mark read"}
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right Column: Reading & Reply Pane */}
        <div
          className={`w-full lg:w-7/12 flex-col bg-white ${
            mobileShowDetail ? "flex" : "hidden lg:flex"
          }`}
        >
          {selectedEmail ? (
            <div className="flex flex-col h-full">
              {/* Reading Header */}
              <div className="p-5 border-b border-slate-200 space-y-4">
                {/* Mobile Back Button */}
                <div className="flex items-center justify-between lg:hidden pb-2 border-b border-slate-100">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setMobileShowDetail(false)}
                    className="text-xs font-semibold gap-1 -ml-2 text-slate-600"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    <span>Back to Inbox</span>
                  </Button>
                </div>

                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-1 min-w-0">
                    <h2 className="text-base font-bold text-slate-900 leading-snug break-words">
                      {selectedEmail.subject}
                    </h2>
                    <div className="flex items-center gap-2 flex-wrap text-xs text-slate-500">
                      <span className="font-semibold text-slate-800">
                        {selectedEmail.fromName}
                      </span>
                      <span>&lt;{selectedEmail.fromEmail}&gt;</span>
                      <span className="text-slate-300">•</span>
                      <span>
                        Received by:{" "}
                        <strong className="font-mono text-slate-700">
                          {selectedEmail.toEmail || activeConnectedEmail}
                        </strong>
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => setIsReplying(true)}
                      className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold gap-1.5 h-8"
                    >
                      <Reply className="w-3.5 h-3.5" />
                      <span>Reply</span>
                    </Button>
                  </div>
                </div>

                {/* Lead Connection Banner */}
                <div className="flex items-center justify-between bg-slate-50 p-3 rounded-xl border border-slate-200/80 text-xs">
                  <div className="flex items-center gap-2">
                    <Clock className="w-3.5 h-3.5 text-slate-400" />
                    <span className="text-slate-600">
                      Received: {new Date(selectedEmail.date).toLocaleString()}
                    </span>
                  </div>

                  {selectedEmail.leadId && (
                    <Link
                      href={`/leads/${selectedEmail.leadId}`}
                      className="inline-flex items-center gap-1 font-bold text-blue-600 hover:text-blue-800"
                    >
                      <span>View Lead: {selectedEmail.leadName}</span>
                      <ExternalLink className="w-3 h-3" />
                    </Link>
                  )}
                </div>
              </div>

              {/* Email Content Body */}
              <div className="p-6 flex-1 overflow-y-auto space-y-4">
                <div className="text-xs text-slate-800 leading-relaxed whitespace-pre-wrap font-sans">
                  {selectedEmail.bodyText || selectedEmail.snippet}
                </div>
              </div>

              {/* Inline Reply Box */}
              {isReplying ? (
                <div className="p-5 border-t border-slate-200 bg-slate-50/70 space-y-3 animate-in fade-in">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                      <Reply className="w-3.5 h-3.5 text-blue-600" />
                      <span>
                        Reply to {selectedEmail.fromName} ({selectedEmail.fromEmail})
                      </span>
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setIsReplying(false);
                        setReplyFeedback(null);
                      }}
                      className="text-xs text-slate-400 hover:text-slate-600"
                    >
                      Cancel
                    </button>
                  </div>

                  <div className="text-[11px] text-slate-500 font-medium">
                    Sending response from:{" "}
                    <strong className="font-mono text-slate-800">
                      {activeConnectedEmail}
                    </strong>
                  </div>

                  <textarea
                    rows={4}
                    value={replyBody}
                    onChange={(e) => setReplyBody(e.target.value)}
                    placeholder="Type your response to the client here..."
                    className="w-full text-xs p-3 rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 font-sans leading-relaxed"
                  />

                  {replyFeedback && (
                    <div
                      className={`p-2.5 rounded-lg text-xs flex items-center gap-2 ${
                        replyFeedback.type === "success"
                          ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                          : "bg-rose-50 text-rose-800 border border-rose-200"
                      }`}
                    >
                      {replyFeedback.type === "success" ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                      ) : (
                        <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                      )}
                      <span>{replyFeedback.text}</span>
                    </div>
                  )}

                  <div className="flex items-center justify-between pt-1">
                    <span className="text-[11px] text-slate-400">
                      Dispatched via your authenticated SMTP relay and logged to the lead activity timeline.
                    </span>
                    <Button
                      type="button"
                      size="sm"
                      onClick={handleSendReply}
                      disabled={isSendingReply || !replyBody.trim()}
                      className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold gap-1.5 h-8 shadow-xs"
                    >
                      {isSendingReply ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Send className="w-3.5 h-3.5" />
                      )}
                      <span>{isSendingReply ? "Sending..." : "Send Reply"}</span>
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="p-4 border-t border-slate-200 bg-slate-50/50 flex items-center justify-between">
                  <span className="text-xs text-slate-500">
                    Click Reply to send an email response directly to this client.
                  </span>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setIsReplying(true)}
                    className="text-xs font-semibold gap-1.5 h-8"
                  >
                    <Reply className="w-3.5 h-3.5 text-blue-600" />
                    <span>Quick Reply</span>
                  </Button>
                </div>
              )}
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center p-12 text-center text-slate-400 space-y-3">
              <Mail className="w-12 h-12 text-slate-200" />
              <h3 className="text-sm font-bold text-slate-700">No message selected</h3>
              <p className="text-xs text-slate-400 max-w-sm">
                Select an email from the left pane to view the conversation history and reply to the client.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

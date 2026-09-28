"use client";

import React, { useState, useEffect, useRef, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Bell,
  CheckCheck,
  Check,
  Trash2,
  UserCheck,
  CheckSquare,
  Trophy,
  UserPlus,
  Building2,
  Sparkles,
  Inbox,
  Clock,
  Loader2,
} from "lucide-react";
import {
  getNotificationsAction,
  markNotificationAsReadAction,
  markAllNotificationsAsReadAction,
  deleteNotificationAction,
} from "@/actions/notifications";
import { NotificationItem, NotificationType } from "@/lib/validations/notifications";

function formatTimeAgo(isoString: string): string {
  try {
    const date = new Date(isoString);
    const now = new Date();
    const diffSec = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (diffSec < 60) return "Just now";
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffHour = Math.floor(diffMin / 60);
    if (diffHour < 24) return `${diffHour}h ago`;
    const diffDay = Math.floor(diffHour / 24);
    if (diffDay < 7) return `${diffDay}d ago`;
    return date.toLocaleDateString("en-IN", { month: "short", day: "numeric" });
  } catch {
    return "Recent";
  }
}

function getNotificationIcon(type: NotificationType) {
  switch (type) {
    case "LEAD_ASSIGNED":
    case "LEAD_CREATED":
      return <UserCheck className="w-4 h-4 text-blue-600" />;
    case "TASK_DUE":
    case "TASK_OVERDUE":
    case "TASK_CREATED":
      return <CheckSquare className="w-4 h-4 text-amber-600" />;
    case "OPPORTUNITY_WON":
      return <Trophy className="w-4 h-4 text-emerald-600" />;
    case "CONTACT_CREATED":
      return <UserPlus className="w-4 h-4 text-purple-600" />;
    case "COMPANY_CREATED":
      return <Building2 className="w-4 h-4 text-indigo-600" />;
    case "SUBSCRIPTION_UPDATE":
      return <Sparkles className="w-4 h-4 text-sky-600" />;
    default:
      return <Bell className="w-4 h-4 text-slate-600" />;
  }
}

function getIconBg(type: NotificationType) {
  switch (type) {
    case "LEAD_ASSIGNED":
    case "LEAD_CREATED":
      return "bg-blue-50 border-blue-200/60";
    case "TASK_DUE":
    case "TASK_OVERDUE":
    case "TASK_CREATED":
      return "bg-amber-50 border-amber-200/60";
    case "OPPORTUNITY_WON":
      return "bg-emerald-50 border-emerald-200/60";
    case "CONTACT_CREATED":
      return "bg-purple-50 border-purple-200/60";
    case "COMPANY_CREATED":
      return "bg-indigo-50 border-indigo-200/60";
    case "SUBSCRIPTION_UPDATE":
      return "bg-sky-50 border-sky-200/60";
    default:
      return "bg-slate-50 border-slate-200";
  }
}

export function NotificationDropdown() {
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [filter, setFilter] = useState<"all" | "unread">("all");
  const [isLoading, setIsLoading] = useState(false);
  const [isPending, startTransition] = useTransition();

  const dropdownRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  const fetchNotifications = async () => {
    try {
      const res = await getNotificationsAction();
      if (res.success && res.data) {
        setNotifications(res.data.notifications);
        setUnreadCount(res.data.unreadCount);
      }
    } catch (err) {
      console.error("[NotificationDropdown] fetch error:", err);
    }
  };

  useEffect(() => {
    fetchNotifications();

    // Auto-refresh every 45 seconds to catch new activities
    const interval = setInterval(fetchNotifications, 45000);
    return () => clearInterval(interval);
  }, []);

  // Close on click outside or Escape
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("keydown", handleKeyDown);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  const handleToggle = () => {
    if (!isOpen) {
      setIsLoading(true);
      fetchNotifications().finally(() => setIsLoading(false));
    }
    setIsOpen((prev) => !prev);
  };

  const handleMarkAsRead = (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    // Optimistic update
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, isRead: true, readAt: new Date().toISOString() } : n))
    );
    setUnreadCount((prev) => Math.max(0, prev - 1));

    startTransition(async () => {
      await markNotificationAsReadAction(id);
    });
  };

  const handleMarkAllAsRead = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    // Optimistic update
    setNotifications((prev) =>
      prev.map((n) => ({ ...n, isRead: true, readAt: new Date().toISOString() }))
    );
    setUnreadCount(0);

    startTransition(async () => {
      await markAllNotificationsAsReadAction();
    });
  };

  const handleDelete = (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const itemToDelete = notifications.find((n) => n.id === id);
    // Optimistic update
    setNotifications((prev) => prev.filter((n) => n.id !== id));
    if (itemToDelete && !itemToDelete.isRead) {
      setUnreadCount((prev) => Math.max(0, prev - 1));
    }

    startTransition(async () => {
      await deleteNotificationAction(id);
    });
  };

  const handleNotificationClick = (n: NotificationItem) => {
    if (!n.isRead) {
      handleMarkAsRead(n.id);
    }
    setIsOpen(false);

    // Navigate to target entity
    if (n.entityType === "lead") {
      router.push("/leads");
    } else if (n.entityType === "task") {
      router.push("/tasks");
    } else if (n.entityType === "opportunity") {
      router.push("/opportunities");
    } else if (n.entityType === "contact") {
      router.push("/contacts");
    } else if (n.entityType === "company") {
      router.push("/companies");
    } else if (n.entityType === "subscription") {
      router.push("/subscription");
    }
  };

  const displayedNotifications =
    filter === "unread"
      ? notifications.filter((n) => !n.isRead)
      : notifications;

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Notification Bell Button */}
      <button
        type="button"
        onClick={handleToggle}
        aria-label={`Notifications (${unreadCount} unread)`}
        aria-expanded={isOpen}
        className="relative p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500/20"
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 bg-blue-600 text-white text-[10px] font-bold rounded-full flex items-center justify-center ring-2 ring-white shadow-xs animate-in zoom-in-50 duration-200">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {/* Popover Dropdown */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white rounded-xl shadow-2xl border border-slate-200/90 z-50 overflow-hidden animate-in fade-in-0 zoom-in-95 duration-150">
          {/* Header */}
          <div className="px-4 py-3 bg-slate-50/80 border-b border-slate-200 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold text-slate-900">Notifications</h3>
              {unreadCount > 0 && (
                <span className="px-2 py-0.5 text-[11px] font-medium bg-blue-100 text-blue-700 rounded-full">
                  {unreadCount} new
                </span>
              )}
            </div>

            {unreadCount > 0 && (
              <button
                type="button"
                onClick={handleMarkAllAsRead}
                disabled={isPending}
                className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-800 transition-colors cursor-pointer"
                title="Mark all as read"
              >
                <CheckCheck className="w-3.5 h-3.5" />
                <span>Mark all read</span>
              </button>
            )}
          </div>

          {/* Filter Tabs */}
          <div className="flex border-b border-slate-100 px-4 bg-white text-xs">
            <button
              type="button"
              onClick={() => setFilter("all")}
              className={`py-2 px-3 font-medium border-b-2 transition-colors cursor-pointer ${
                filter === "all"
                  ? "border-blue-600 text-blue-600"
                  : "border-transparent text-slate-500 hover:text-slate-700"
              }`}
            >
              All ({notifications.length})
            </button>
            <button
              type="button"
              onClick={() => setFilter("unread")}
              className={`py-2 px-3 font-medium border-b-2 transition-colors cursor-pointer ${
                filter === "unread"
                  ? "border-blue-600 text-blue-600"
                  : "border-transparent text-slate-500 hover:text-slate-700"
              }`}
            >
              Unread ({unreadCount})
            </button>
          </div>

          {/* List of Notifications */}
          <div className="max-h-[380px] overflow-y-auto divide-y divide-slate-100">
            {isLoading ? (
              <div className="py-12 flex flex-col items-center justify-center text-slate-400 gap-2">
                <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
                <span className="text-xs">Loading notifications...</span>
              </div>
            ) : displayedNotifications.length === 0 ? (
              <div className="py-12 px-6 flex flex-col items-center justify-center text-center">
                <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center mb-2.5 text-slate-400">
                  <Inbox className="w-5 h-5" />
                </div>
                <p className="text-xs font-semibold text-slate-800">
                  {filter === "unread" ? "No unread notifications" : "No notifications yet"}
                </p>
                <p className="text-[11px] text-slate-500 mt-1 max-w-[220px]">
                  {filter === "unread"
                    ? "You are all caught up with your latest updates and alerts."
                    : "Activity updates and reminders will appear here."}
                </p>
              </div>
            ) : (
              displayedNotifications.map((n) => (
                <div
                  key={n.id}
                  onClick={() => handleNotificationClick(n)}
                  className={`group relative p-3.5 flex items-start gap-3 hover:bg-slate-50/80 transition-colors cursor-pointer ${
                    !n.isRead ? "bg-blue-50/30" : "bg-white"
                  }`}
                >
                  {/* Type Icon */}
                  <div
                    className={`mt-0.5 w-8 h-8 rounded-lg flex items-center justify-center border shrink-0 ${getIconBg(
                      n.type
                    )}`}
                  >
                    {getNotificationIcon(n.type)}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0 pr-6">
                    <div className="flex items-center gap-1.5">
                      <p
                        className={`text-xs leading-snug truncate ${
                          !n.isRead ? "font-semibold text-slate-900" : "font-medium text-slate-700"
                        }`}
                      >
                        {n.title}
                      </p>
                      {!n.isRead && (
                        <span className="w-1.5 h-1.5 rounded-full bg-blue-600 shrink-0" />
                      )}
                    </div>
                    <p className="text-[11px] text-slate-600 leading-normal mt-0.5 line-clamp-2">
                      {n.message}
                    </p>
                    <div className="flex items-center gap-1 text-[10px] text-slate-400 mt-1.5">
                      <Clock className="w-3 h-3" />
                      <span>{formatTimeAgo(n.createdAt)}</span>
                      {n.entityType && (
                        <>
                          <span>•</span>
                          <span className="capitalize">{n.entityType}</span>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Actions on hover */}
                  <div className="absolute top-3 right-3 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    {!n.isRead && (
                      <button
                        type="button"
                        onClick={(e) => handleMarkAsRead(n.id, e)}
                        className="p-1 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                        title="Mark as read"
                      >
                        <Check className="w-3.5 h-3.5" />
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={(e) => handleDelete(n.id, e)}
                      className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition-colors"
                      title="Delete notification"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Footer */}
          <div className="px-4 py-2 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
            <span>Roxx CRM Notifications</span>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="text-slate-600 hover:text-slate-900 font-medium"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

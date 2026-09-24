"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Search, Bell, Plus, LogOut, Sparkles, ShieldCheck } from "lucide-react";
import { logoutAction, getCurrentUserAction } from "@/actions/auth";
import { CommandPalette } from "@/components/search/command-palette";
import { LeadModal } from "@/features/leads/components/lead-modal";
import type { SessionUser } from "@/lib/auth/session";

function formatRoleName(role?: string): string {
  if (!role || typeof role !== "string") return "User";
  const upper = role.toUpperCase();
  if (upper === "ADMIN" || upper === "ADMINISTRATOR") return "Administrator";
  if (upper === "MANAGER") return "Manager";
  if (upper === "SALES_USER" || upper === "SALES") return "Sales Rep";
  if (upper === "READ_ONLY") return "Viewer";
  return role.charAt(0).toUpperCase() + role.slice(1).toLowerCase().replace(/_/g, " ");
}

function getInitials(name?: string, email?: string): string {
  if (typeof name === "string" && name.trim()) {
    const parts = name.trim().split(/\s+/).filter(Boolean);
    if (parts.length >= 2 && parts[0] && parts[1]) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name.trim().slice(0, 2).toUpperCase();
  }
  if (typeof email === "string" && email.trim()) {
    return email.trim().slice(0, 2).toUpperCase();
  }
  return "U";
}

interface NavbarProps {
  session?: SessionUser | null;
}

export function Navbar({ session: initialSession }: NavbarProps = {}) {
  const router = useRouter();
  const [session, setSession] = useState<SessionUser | null>(initialSession || null);
  const [isPaletteOpen, setIsPaletteOpen] = useState(false);
  const [isLeadModalOpen, setIsLeadModalOpen] = useState(false);

  useEffect(() => {
    if (initialSession) {
      setSession(initialSession);
    } else {
      getCurrentUserAction()
        .then((s) => {
          if (s) setSession(s);
        })
        .catch(() => {
          // ignore session fetch error
        });
    }
  }, [initialSession]);

  // Global listener for Cmd+K / Ctrl+K
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setIsPaletteOpen((prev) => !prev);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const userName = session?.name || "User";
  const userRole = formatRoleName(session?.role);
  const userInitials = getInitials(session?.name, session?.email);

  return (
    <header className="h-16 border-b border-slate-200 bg-white/95 backdrop-blur sticky top-0 z-20 flex items-center justify-between px-6">
      {/* Global Search Button / Trigger */}
      <div className="flex items-center w-full max-w-md">
        <button
          type="button"
          onClick={() => setIsPaletteOpen(true)}
          className="relative w-full flex items-center text-left pl-9 pr-3 py-2 bg-slate-100/80 hover:bg-slate-100 border border-slate-200 hover:border-slate-300 rounded-lg text-sm text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all cursor-pointer group"
        >
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 group-hover:text-slate-600 transition-colors" />
          <span className="flex-1 truncate">Search leads, companies, contacts, deals...</span>
          <kbd className="hidden sm:inline-flex items-center px-1.5 py-0.5 text-[10px] font-mono font-semibold bg-white text-slate-500 rounded border border-slate-200 shadow-2xs">
            ⌘K
          </kbd>
        </button>
      </div>

      {/* Right Actions */}
      <div className="flex items-center gap-3">
        {/* SaaS Subscription / Plan Status Badge */}
        {session?.isSuperAdmin ? (
          <Link
            href="/admin/tenants"
            className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200/80 rounded-full text-[11px] font-bold transition-colors cursor-pointer"
            title="Super Admin - Manage Tenants"
          >
            <Sparkles className="w-3 h-3 text-purple-600" />
            <span>Super Admin</span>
          </Link>
        ) : session?.subscriptionStatus === "TRIAL" ? (
          <Link
            href="/settings?tab=billing"
            className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200/80 rounded-full text-[11px] font-semibold transition-colors cursor-pointer"
            title="Free Trial Active - Click to view billing"
          >
            <Sparkles className="w-3 h-3 text-amber-600 animate-pulse" />
            <span>Free Trial</span>
            <span className="text-[10px] text-amber-900 bg-amber-200/70 px-1.5 py-0.2 rounded-full font-bold">
              Upgrade
            </span>
          </Link>
        ) : session?.subscriptionStatus === "ACTIVE" ? (
          <Link
            href="/settings?tab=billing"
            className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200/80 rounded-full text-[11px] font-semibold transition-colors cursor-pointer"
            title="Active Plan - Click to view billing"
          >
            <ShieldCheck className="w-3 h-3 text-emerald-600" />
            <span>
              {session.subscriptionPlan === "GROWTH_50"
                ? "Growth Plan"
                : session.subscriptionPlan === "ENTERPRISE"
                ? "Enterprise"
                : "Starter Plan"}
            </span>
          </Link>
        ) : null}

        {/* Quick Add Button */}
        <button
          type="button"
          onClick={() => setIsLeadModalOpen(true)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-sm transition-colors cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>New Lead</span>
        </button>

        {/* Notifications Icon */}
        <button
          type="button"
          aria-label="Notifications"
          className="relative p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors"
        >
          <Bell className="w-5 h-5" />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-blue-600 rounded-full ring-2 ring-white" />
        </button>

        {/* Profile Avatar & Logout */}
        <div className="flex items-center gap-3 pl-3 border-l border-slate-200">
          <div
            className="w-8 h-8 rounded-full bg-slate-800 text-white flex items-center justify-center font-bold text-xs shadow-sm select-none"
            title={userName}
          >
            {userInitials}
          </div>
          <div className="hidden md:block text-left">
            <p className="text-xs font-semibold text-slate-900 leading-tight truncate max-w-[130px]">
              {userName}
            </p>
            <p className="text-[11px] text-slate-500 font-medium truncate max-w-[130px]">
              {userRole}
            </p>
          </div>
          <form action={logoutAction}>
            <button
              type="submit"
              title="Sign out"
              className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors ml-1 cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </form>
        </div>
      </div>

      {/* Global Spotlight Search Modal */}
      <CommandPalette isOpen={isPaletteOpen} onClose={() => setIsPaletteOpen(false)} />

      {/* Quick Add Lead Modal */}
      <LeadModal
        isOpen={isLeadModalOpen}
        onClose={() => setIsLeadModalOpen(false)}
        onSuccess={() => {
          setIsLeadModalOpen(false);
          window.dispatchEvent(new CustomEvent("leadCreated"));
          router.push("/leads");
          router.refresh();
        }}
      />
    </header>
  );
}

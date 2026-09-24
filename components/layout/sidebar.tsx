"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Users2,
  Building2,
  UserSquare2,
  Kanban,
  CheckSquare,
  Activity,
  BarChart3,
  Settings,
  Flame,
  Crown,
} from "lucide-react";
import { cn } from "@/lib/utils";

export const navigationItems = [
  { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { name: "Leads", href: "/leads", icon: Users2 },
  { name: "Companies", href: "/companies", icon: Building2 },
  { name: "Contacts", href: "/contacts", icon: UserSquare2 },
  { name: "Opportunities", href: "/opportunities", icon: Kanban },
  { name: "Tasks", href: "/tasks", icon: CheckSquare },
  { name: "Activities", href: "/activities", icon: Activity },
  { name: "Reports", href: "/reports", icon: BarChart3 },
  { name: "Settings", href: "/settings", icon: Settings },
];

import type { SessionUser } from "@/lib/auth/session";

interface SidebarProps {
  session?: SessionUser | null;
}

export function Sidebar({ session }: SidebarProps = {}) {
  const pathname = usePathname();

  const orgName = (session?.organizationName && typeof session.organizationName === "string" && session.organizationName.trim())
    ? session.organizationName.trim()
    : "Demo Company";

  const orgInitials = orgName
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w[0])
    .filter(Boolean)
    .join("")
    .slice(0, 2)
    .toUpperCase() || "DC";

  const orgIdDisplay = session?.organizationId && typeof session.organizationId === "string"
    ? `Org: ${session.organizationId.length > 14 ? session.organizationId.slice(0, 12) + "…" : session.organizationId}`
    : "Org: demo-org";

  return (
    <aside className="w-64 border-r border-slate-200 bg-white flex flex-col h-screen fixed left-0 top-0 z-30 select-none">
      {/* Brand Header */}
      <div className="h-16 flex items-center px-6 border-b border-slate-200 gap-3">
        <div className="w-9 h-9 rounded-lg bg-blue-600 flex items-center justify-center text-white shadow-sm shadow-blue-500/30">
          <Flame className="w-5 h-5 fill-white" />
        </div>
        <div>
          <span className="font-bold text-lg text-slate-900 tracking-tight">Roxx CRM</span>
          <span className="block text-xs text-slate-500 font-medium -mt-1">Sales & Pipeline</span>
        </div>
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {navigationItems.map((item) => {
          const isActive = pathname === item.href || pathname?.startsWith(`${item.href}/`);
          const Icon = item.icon;
          return (
            <Link
              key={item.name}
              href={item.href}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                isActive
                  ? "bg-blue-50 text-blue-700 font-semibold"
                  : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
              )}
            >
              <Icon className={cn("w-5 h-5", isActive ? "text-blue-600" : "text-slate-400")} />
              {item.name}
            </Link>
          );
        })}

        {/* Super Admin Access */}
        {session?.isSuperAdmin && (
          <div className="pt-3 mt-3 border-t border-slate-100">
            <p className="px-3 text-[10px] font-bold uppercase tracking-wider text-purple-600 mb-1">
              Super Admin
            </p>
            <Link
              href="/admin/tenants"
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                pathname?.startsWith("/admin")
                  ? "bg-purple-50 text-purple-700 font-semibold"
                  : "text-slate-600 hover:bg-purple-50/50 hover:text-purple-900"
              )}
            >
              <Crown className={cn("w-5 h-5", pathname?.startsWith("/admin") ? "text-purple-600" : "text-purple-400")} />
              <span>Tenants &amp; SaaS</span>
            </Link>
          </div>
        )}
      </nav>

      {/* Organization Badge Footer */}
      <div className="p-4 border-t border-slate-200 bg-slate-50/70">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-slate-200 text-slate-700 flex items-center justify-center text-xs font-bold shrink-0">
            {orgInitials}
          </div>
          <div className="truncate">
            <p className="text-xs font-semibold text-slate-900 truncate" title={orgName}>
              {orgName}
            </p>
            <p className="text-[11px] text-slate-500 truncate" title={session?.organizationId || "demo-org"}>
              {orgIdDisplay}
            </p>
          </div>
        </div>
      </div>
    </aside>
  );
}

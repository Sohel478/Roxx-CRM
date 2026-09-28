"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Building2,
  Layers,
  CreditCard,
  DollarSign,
  BarChart3,
  ShieldAlert,
  Settings,
  ShieldCheck,
  LogOut,
} from "lucide-react";
import { logoutAction } from "@/actions/auth";

interface SuperAdminSidebarProps {
  user: {
    name: string;
    email: string;
  };
}

export function SuperAdminSidebar({ user }: SuperAdminSidebarProps) {
  const pathname = usePathname();

  const navItems = [
    {
      label: "Dashboard",
      href: "/super-admin/dashboard",
      icon: LayoutDashboard,
    },
    {
      label: "Organizations",
      href: "/super-admin/organizations",
      icon: Building2,
    },
    {
      label: "Plans & Pricing",
      href: "/super-admin/plans",
      icon: Layers,
    },
    {
      label: "Subscriptions",
      href: "/super-admin/subscriptions",
      icon: CreditCard,
    },
    {
      label: "Payments Ledger",
      href: "/super-admin/payments",
      icon: DollarSign,
    },
    {
      label: "Resource Usage",
      href: "/super-admin/usage",
      icon: BarChart3,
    },
    {
      label: "Audit Logs",
      href: "/super-admin/audit-logs",
      icon: ShieldAlert,
    },
    {
      label: "Platform Settings",
      href: "/super-admin/settings",
      icon: Settings,
    },
  ];

  return (
    <aside className="w-64 bg-slate-900 border-r border-slate-800 text-slate-200 flex flex-col fixed inset-y-0 left-0 z-40">
      {/* Brand & Super Admin Badge */}
      <div className="p-5 border-b border-slate-800 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/20 text-white font-bold text-lg">
            R
          </div>
          <div>
            <div className="font-bold text-white tracking-tight flex items-center gap-1.5">
              <span>Roxx CRM</span>
            </div>
            <div className="flex items-center gap-1 text-[11px] font-semibold text-purple-400 bg-purple-950/60 px-1.5 py-0.5 rounded border border-purple-800/60 mt-0.5">
              <ShieldCheck className="w-3 h-3 text-purple-400" />
              <span>SUPER ADMIN</span>
            </div>
          </div>
        </div>
      </div>

      {/* Nav items */}
      <div className="flex-1 py-4 px-3 overflow-y-auto space-y-1">
        <div className="px-3 pb-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">
          Platform Management
        </div>
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                isActive
                  ? "bg-purple-600/20 text-purple-300 border border-purple-500/30 font-semibold"
                  : "text-slate-300 hover:bg-slate-800/80 hover:text-white"
              }`}
            >
              <Icon
                className={`w-4 h-4 ${
                  isActive ? "text-purple-400" : "text-slate-400 group-hover:text-white"
                }`}
              />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </div>

      {/* Super Admin User Footer */}
      <div className="p-4 border-t border-slate-800 bg-slate-950/40">
        <div className="flex items-center justify-between">
          <div className="min-w-0 pr-2">
            <div className="text-xs font-semibold text-white truncate">{user.name}</div>
            <div className="text-[11px] text-slate-400 truncate">{user.email}</div>
          </div>
          <form action={logoutAction}>
            <button
              type="submit"
              title="Sign out of platform"
              className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-950/30 border border-transparent hover:border-rose-900/50 transition-all cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </form>
        </div>
      </div>
    </aside>
  );
}

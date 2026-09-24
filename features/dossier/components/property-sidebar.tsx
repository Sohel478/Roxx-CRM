"use client";

import {
  Flame,
  AlertTriangle,
  Clock,
  DollarSign,
  Calendar,
  User,
  Shield,
  Tag,
  Building,
} from "lucide-react";

export interface PropertyItem {
  label: string;
  value: string | number | null | undefined;
  icon?: React.ReactNode;
  badge?: boolean;
}

interface PropertySidebarProps {
  title: string;
  subtitle?: string;
  badge?: string;
  badgeVariant?: "success" | "warning" | "danger" | "neutral";
  daysInactive?: number;
  isOpen?: boolean;
  properties: PropertyItem[];
}

export function PropertySidebar({
  title,
  subtitle,
  badge,
  badgeVariant = "neutral",
  daysInactive = 0,
  isOpen = true,
  properties,
}: PropertySidebarProps) {
  const isRotten = isOpen && daysInactive >= 14;
  const isStale = isOpen && daysInactive >= 7 && !isRotten;
  const isFresh = isOpen && daysInactive <= 3;

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-5">
      {/* Profile Header */}
      <div>
        <div className="flex items-center gap-2 mb-2 flex-wrap">
          {badge && (
            <span
              className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
                badgeVariant === "success"
                  ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                  : badgeVariant === "warning"
                  ? "bg-amber-50 text-amber-800 border border-amber-200"
                  : badgeVariant === "danger"
                  ? "bg-rose-50 text-rose-700 border border-rose-200"
                  : "bg-blue-50 text-blue-700 border border-blue-200"
              }`}
            >
              {badge}
            </span>
          )}

          {/* Deal Inactivity Health Badge */}
          {isRotten && (
            <span className="flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
              <Clock className="w-3 h-3 text-rose-600 animate-pulse" />
              <span>Rotten ({daysInactive}d inactive)</span>
            </span>
          )}

          {isStale && (
            <span className="flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold bg-amber-50 text-amber-800 border border-amber-200">
              <AlertTriangle className="w-3 h-3 text-amber-600" />
              <span>Stale ({daysInactive}d inactive)</span>
            </span>
          )}

          {isFresh && (
            <span className="flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200">
              <Flame className="w-3 h-3 text-emerald-500" />
              <span>Active Touchpoints</span>
            </span>
          )}
        </div>

        <h2 className="text-lg font-bold text-slate-900 tracking-tight leading-snug">
          {title}
        </h2>
        {subtitle && (
          <p className="text-xs text-slate-500 font-medium mt-0.5">{subtitle}</p>
        )}
      </div>

      {/* About this Record / Key Properties */}
      <div className="space-y-3 pt-3 border-t border-slate-100">
        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
          About this Record
        </h3>

        <div className="space-y-3 text-xs">
          {properties.map((prop, idx) => (
            <div key={idx} className="flex flex-col gap-0.5">
              <span className="text-slate-400 font-medium text-[11px]">
                {prop.label}
              </span>
              <div className="flex items-center gap-1.5 font-semibold text-slate-800">
                {prop.icon}
                <span className="truncate">
                  {prop.value !== null && prop.value !== undefined
                    ? prop.value.toString()
                    : "—"}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

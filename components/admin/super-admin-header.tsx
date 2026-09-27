"use client";

import Link from "next/link";
import { ExternalLink, Globe } from "lucide-react";

interface SuperAdminHeaderProps {
  title?: string;
}

export function SuperAdminHeader({ title }: SuperAdminHeaderProps) {
  return (
    <header className="h-16 bg-white border-b border-slate-200 px-6 flex items-center justify-between sticky top-0 z-30 shadow-sm">
      <div className="flex items-center gap-3">
        <h1 className="text-xl font-bold text-slate-900 tracking-tight">
          {title || "Super Admin Portal"}
        </h1>
        <span className="hidden sm:inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1.5 animate-pulse"></span>
          Platform Online
        </span>
      </div>

      <div className="flex items-center gap-3">
        <Link
          href="/"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 transition-colors border border-slate-200"
        >
          <Globe className="w-3.5 h-3.5 text-slate-500" />
          <span>View Public Site</span>
          <ExternalLink className="w-3 h-3 text-slate-400" />
        </Link>
      </div>
    </header>
  );
}

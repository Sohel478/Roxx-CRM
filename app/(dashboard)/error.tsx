"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AlertCircle, RotateCcw, Users2 } from "lucide-react";

export default function DashboardErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Dashboard Module Error:", error);
  }, [error]);

  return (
    <div className="py-12 flex items-center justify-center">
      <div className="max-w-lg w-full bg-white rounded-2xl border border-slate-200 shadow-xs p-8 text-center space-y-5">
        <div className="w-12 h-12 rounded-xl bg-amber-50 text-amber-600 border border-amber-200 flex items-center justify-center mx-auto">
          <AlertCircle className="w-6 h-6" />
        </div>

        <div className="space-y-2">
          <h2 className="text-lg font-bold text-slate-900">
            Unable to load dashboard data
          </h2>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            A temporary issue occurred while communicating with the database. You can try reloading or navigate to other CRM modules.
          </p>
          {error?.digest && (
            <p className="text-[11px] font-mono text-slate-400 bg-slate-50 py-1 px-2.5 rounded-md inline-block">
              Code: {error.digest}
            </p>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
          <button
            type="button"
            onClick={() => reset()}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-xs transition-colors cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Try Again</span>
          </button>

          <Link
            href="/leads"
            className="inline-flex items-center gap-2 px-4 py-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-lg text-xs font-semibold shadow-xs transition-colors"
          >
            <Users2 className="w-3.5 h-3.5 text-slate-500" />
            <span>Go to Leads</span>
          </Link>
        </div>
      </div>
    </div>
  );
}

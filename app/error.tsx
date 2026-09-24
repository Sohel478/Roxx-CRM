"use client";

import { useEffect } from "react";
import { AlertTriangle, RotateCcw, LogIn, RefreshCw } from "lucide-react";

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log error for debugging
    console.error("Application Error:", error);
  }, [error]);

  const handleClearSessionAndLogin = () => {
    try {
      // Clear session cookie locally on the client
      document.cookie = "roxx_crm_session=; path=/; max-age=0; expires=Thu, 01 Jan 1970 00:00:00 GMT";
    } catch {}
    // Force direct full navigation to login with reset flag to bypass middleware cache
    window.location.href = "/login?reset=true";
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-2xl border border-slate-200 shadow-sm p-8 text-center space-y-6">
        <div className="w-14 h-14 rounded-2xl bg-amber-50 text-amber-600 border border-amber-200 flex items-center justify-center mx-auto">
          <AlertTriangle className="w-7 h-7" />
        </div>

        <div className="space-y-2">
          <h1 className="text-xl font-bold text-slate-900">
            Something unexpected occurred
          </h1>
          <p className="text-sm text-slate-500">
            The application encountered a temporary issue while loading this page.
          </p>
          {error?.message && error.message !== "NEXT_REDIRECT" && (
            <p className="text-xs text-red-600 bg-red-50 py-1.5 px-3 rounded-lg border border-red-100 max-w-sm mx-auto break-words">
              {error.message}
            </p>
          )}
          {error?.digest && (
            <p className="text-xs font-mono text-slate-400 bg-slate-100 py-1 px-2 rounded-md inline-block">
              Code: {error.digest}
            </p>
          )}
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
          <button
            type="button"
            onClick={() => reset()}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-semibold shadow-xs transition-colors cursor-pointer"
          >
            <RotateCcw className="w-4 h-4" />
            <span>Try Again</span>
          </button>

          <button
            type="button"
            onClick={handleClearSessionAndLogin}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-lg text-sm font-semibold shadow-xs transition-colors cursor-pointer"
          >
            <LogIn className="w-4 h-4" />
            <span>Sign In</span>
          </button>
        </div>

        <div className="pt-2 border-t border-slate-100">
          <button
            type="button"
            onClick={handleClearSessionAndLogin}
            className="text-xs text-blue-600 hover:text-blue-800 underline font-medium inline-flex items-center gap-1 cursor-pointer"
          >
            <RefreshCw className="w-3 h-3" />
            <span>Reset session &amp; return to login screen</span>
          </button>
        </div>
      </div>
    </div>
  );
}

"use client";

import { useEffect } from "react";
import "./globals.css";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Root Layout Global Error:", error);
  }, [error]);

  return (
    <html lang="en">
      <body className="font-sans antialiased bg-slate-50 min-h-screen flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-2xl border border-slate-200 shadow-sm p-8 text-center space-y-6">
          <div className="w-14 h-14 rounded-2xl bg-rose-50 text-rose-600 border border-rose-200 flex items-center justify-center mx-auto text-2xl font-bold">
            !
          </div>

          <div className="space-y-2">
            <h1 className="text-xl font-bold text-slate-900">
              Application Error
            </h1>
            <p className="text-sm text-slate-500">
              An unexpected error occurred while loading the application.
            </p>
            {error?.digest && (
              <p className="text-xs font-mono text-slate-400 bg-slate-100 py-1 px-2 rounded-md inline-block">
                Digest: {error.digest}
              </p>
            )}
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
            <button
              type="button"
              onClick={() => reset()}
              className="w-full sm:w-auto px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-semibold shadow-xs transition-colors cursor-pointer"
            >
              Try Again
            </button>

            <a
              href="/login"
              className="w-full sm:w-auto px-4 py-2.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-lg text-sm font-semibold shadow-xs transition-colors"
            >
              Go to Sign In
            </a>
          </div>
        </div>
      </body>
    </html>
  );
}

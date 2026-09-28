"use client";

import { useActionState, useState, useMemo, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  Flame,
  Lock,
  Mail,
  AlertCircle,
  Loader2,
  ShieldCheck,
  UserCheck,
  Briefcase,
  Sparkles,
} from "lucide-react";
import { loginAction } from "@/actions/auth";
import type { AuthState } from "@/types/auth";

const initialState: AuthState = {
  success: false,
};

type DetectedPersona = "ADMIN" | "MANAGER" | "SALES";

function detectPersona(emailStr: string): DetectedPersona | null {
  const lower = emailStr.toLowerCase().trim();
  if (!lower) return null;
  if (lower.includes("admin")) return "ADMIN";
  if (lower.includes("manager") || lower.includes("mgr") || lower.includes("lead")) return "MANAGER";
  if (lower.includes("sales") || lower.includes("rep") || lower.includes("agent") || lower.includes("exec")) return "SALES";
  return null;
}

function LoginForm() {
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") || "";

  const [state, formAction, isPending] = useActionState(loginAction, initialState);
  const [selectedRole, setSelectedRole] = useState<DetectedPersona>("ADMIN");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const detectedRole = useMemo(() => detectPersona(email), [email]);
  const activeRole = detectedRole || selectedRole;

  const handleSelectRole = (role: DetectedPersona) => {
    setSelectedRole(role);
    setEmail("");
    setPassword("");
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="w-12 h-12 rounded-xl bg-blue-600 flex items-center justify-center text-white mx-auto shadow-md shadow-blue-500/30">
          <Flame className="w-7 h-7 fill-white" />
        </div>
        <h2 className="mt-4 text-center text-2xl font-bold tracking-tight text-slate-900">
          Subscription Employee Login
        </h2>
        <p className="mt-1 text-center text-xs text-slate-500">
          Sign in to access your organization&apos;s CRM workspace
        </p>
      </div>

      <div className="mt-6 sm:mx-auto sm:w-full sm:max-w-md px-4">
        {/* Role Select Buttons on top - Login & Password kept empty */}
        <div className="mb-4 bg-white p-3 rounded-xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between mb-2">
            <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
              Select Role:
            </p>
            {detectedRole && (
              <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                <Sparkles className="w-3 h-3 text-blue-500" />
                Auto-detected: {detectedRole === "ADMIN" ? "Admin" : detectedRole === "MANAGER" ? "Manager" : "Sales"}
              </span>
            )}
          </div>
          <div className="grid grid-cols-3 gap-2">
            <button
              type="button"
              onClick={() => handleSelectRole("ADMIN")}
              className={`flex items-center justify-center gap-1.5 px-3 py-2 border rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                activeRole === "ADMIN"
                  ? "bg-blue-50 border-blue-400 text-blue-700 ring-2 ring-blue-500/20 shadow-xs"
                  : "bg-slate-50 hover:bg-blue-50/50 border-slate-200 text-slate-700"
              }`}
            >
              <ShieldCheck className="w-3.5 h-3.5 text-blue-600 shrink-0" />
              <span>Admin</span>
            </button>
            <button
              type="button"
              onClick={() => handleSelectRole("MANAGER")}
              className={`flex items-center justify-center gap-1.5 px-3 py-2 border rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                activeRole === "MANAGER"
                  ? "bg-purple-50 border-purple-400 text-purple-700 ring-2 ring-purple-500/20 shadow-xs"
                  : "bg-slate-50 hover:bg-purple-50/50 border-slate-200 text-slate-700"
              }`}
            >
              <Briefcase className="w-3.5 h-3.5 text-purple-600 shrink-0" />
              <span>Manager</span>
            </button>
            <button
              type="button"
              onClick={() => handleSelectRole("SALES")}
              className={`flex items-center justify-center gap-1.5 px-3 py-2 border rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                activeRole === "SALES"
                  ? "bg-emerald-50 border-emerald-400 text-emerald-700 ring-2 ring-emerald-500/20 shadow-xs"
                  : "bg-slate-50 hover:bg-emerald-50/50 border-slate-200 text-slate-700"
              }`}
            >
              <UserCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
              <span>Sales</span>
            </button>
          </div>
        </div>

        <div className="bg-white py-8 px-6 shadow-sm border border-slate-200 rounded-2xl sm:px-10">
          {/* Error Alert */}
          {state?.error && (
            <div className="mb-5 p-3 rounded-lg bg-red-50 border border-red-200 flex items-start gap-2.5 text-red-700 text-xs">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-red-500" />
              <span>{state.error}</span>
            </div>
          )}

          <form action={formAction} className="space-y-5">
            <input type="hidden" name="callbackUrl" value={callbackUrl} />

            <div>
              <label
                htmlFor="email"
                className="block text-xs font-semibold text-slate-700 uppercase tracking-wider"
              >
                Work Email Address
              </label>
              <div className="mt-1.5 relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <Mail className="w-4 h-4" />
                </div>
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={
                    activeRole === "ADMIN"
                      ? "admin@yourcompany.com"
                      : activeRole === "MANAGER"
                      ? "manager@yourcompany.com"
                      : "sales@yourcompany.com"
                  }
                  className="block w-full pl-9 pr-3 py-2 border border-slate-200 rounded-lg text-sm placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between">
                <label
                  htmlFor="password"
                  className="block text-xs font-semibold text-slate-700 uppercase tracking-wider"
                >
                  Password
                </label>
              </div>
              <div className="mt-1.5 relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  className="block w-full pl-9 pr-3 py-2 border border-slate-200 rounded-lg text-sm placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                />
              </div>
            </div>

            <div>
              <button
                type="submit"
                disabled={isPending}
                className="w-full flex items-center justify-center py-2.5 px-4 border border-transparent rounded-lg shadow-sm text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-60 transition-colors cursor-pointer"
              >
                {isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Signing in...
                  </>
                ) : (
                  "Sign in to Organization"
                )}
              </button>
            </div>
          </form>

          <div className="mt-5 space-y-2 text-center text-xs">
            <p className="text-slate-600">
              New organization?{" "}
              <Link
                href="/register"
                className="font-bold text-blue-600 hover:text-blue-500 underline"
              >
                Start 30-Day Free Trial (20 Seats)
              </Link>
            </p>
            <p className="text-slate-500">
              Looking for an instant sandbox?{" "}
              <Link
                href="/demo/login"
                className="font-semibold text-slate-700 hover:text-blue-600 underline"
              >
                Go to Demo Login
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-slate-50 flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}

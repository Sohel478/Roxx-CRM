"use client";

import { useActionState, useState, useEffect, Suspense } from "react";
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
  Crown,
} from "lucide-react";
import { loginAction } from "@/actions/auth";
import type { AuthState } from "@/types/auth";

const initialState: AuthState = {
  success: false,
};

function LoginForm() {
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") || "";
  const portal = searchParams.get("portal");
  const isSuperAdminRequested =
    portal === "super_admin" ||
    callbackUrl.includes("/super-admin") ||
    searchParams.get("notice") === "unauthorized_tenant";

  const [state, formAction, isPending] = useActionState(loginAction, initialState);
  const [email, setEmail] = useState(
    isSuperAdminRequested ? "sohel@techflux.in" : "admin@roxx-crm.local"
  );
  const [password, setPassword] = useState(
    isSuperAdminRequested ? "Momo$143" : "password123"
  );

  useEffect(() => {
    if (isSuperAdminRequested) {
      setEmail("sohel@techflux.in");
      setPassword("Momo$143");
    }
  }, [isSuperAdminRequested]);

  const fillAccount = (accEmail: string, accPass = "password123") => {
    setEmail(accEmail);
    setPassword(accPass);
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="w-12 h-12 rounded-xl bg-blue-600 flex items-center justify-center text-white mx-auto shadow-md shadow-blue-500/30">
          <Flame className="w-7 h-7 fill-white" />
        </div>
        <h2 className="mt-4 text-center text-2xl font-bold tracking-tight text-slate-900">
          {isSuperAdminRequested ? "Super Admin Portal Login" : "Sign in to Roxx CRM"}
        </h2>
        <p className="mt-1 text-center text-xs text-slate-500">
          {isSuperAdminRequested
            ? "Platform Owner console for multi-tenant management and billing"
            : "Multi-tenant sales pipeline and customer relationship management"}
        </p>
      </div>

      <div className="mt-6 sm:mx-auto sm:w-full sm:max-w-md px-4">
        {/* Notice if redirected from /super-admin */}
        {isSuperAdminRequested && (
          <div className="mb-4 p-3.5 rounded-xl bg-purple-50 border border-purple-200 text-purple-900 text-xs flex items-start gap-2.5">
            <Crown className="w-4 h-4 text-purple-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-purple-950">SaaS Platform Owner Portal</p>
              <p className="text-[11px] text-purple-800 mt-0.5">
                Sign in with SaaS Owner credentials (<code className="font-mono font-semibold">sohel@techflux.in</code>) to access the Super Admin Console.
              </p>
            </div>
          </div>
        )}

        {/* Quick-Switch Pills */}
        <div className="mb-4 bg-white p-3 rounded-xl border border-slate-200 shadow-xs">
          <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-2">
            One-Click Login Accounts:
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <button
              type="button"
              onClick={() => fillAccount("admin@roxx-crm.local")}
              className={`flex items-center justify-center gap-1 px-2 py-1.5 border rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                email === "admin@roxx-crm.local"
                  ? "bg-blue-50 border-blue-300 text-blue-700"
                  : "bg-slate-50 hover:bg-blue-50 border-slate-200 text-slate-700"
              }`}
            >
              <ShieldCheck className="w-3.5 h-3.5 text-blue-600 shrink-0" />
              <span className="truncate">Admin</span>
            </button>
            <button
              type="button"
              onClick={() => fillAccount("manager@roxx-crm.local")}
              className={`flex items-center justify-center gap-1 px-2 py-1.5 border rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                email === "manager@roxx-crm.local"
                  ? "bg-purple-50 border-purple-300 text-purple-700"
                  : "bg-slate-50 hover:bg-purple-50 border-slate-200 text-slate-700"
              }`}
            >
              <Briefcase className="w-3.5 h-3.5 text-purple-600 shrink-0" />
              <span className="truncate">Manager</span>
            </button>
            <button
              type="button"
              onClick={() => fillAccount("sales@roxx-crm.local")}
              className={`flex items-center justify-center gap-1 px-2 py-1.5 border rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                email === "sales@roxx-crm.local"
                  ? "bg-emerald-50 border-emerald-300 text-emerald-700"
                  : "bg-slate-50 hover:bg-emerald-50 border-slate-200 text-slate-700"
              }`}
            >
              <UserCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
              <span className="truncate">Sales</span>
            </button>
            <button
              type="button"
              onClick={() => fillAccount("sohel@techflux.in", "Momo$143")}
              className={`flex items-center justify-center gap-1 px-2 py-1.5 border rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                email === "sohel@techflux.in"
                  ? "bg-purple-100 border-purple-400 text-purple-900 shadow-xs"
                  : "bg-purple-50 hover:bg-purple-100 border-purple-200 text-purple-800"
              }`}
            >
              <Crown className="w-3.5 h-3.5 text-purple-600 shrink-0" />
              <span className="truncate">Super Admin</span>
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
                Email address
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
                  placeholder="name@company.com"
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
                <div className="text-xs">
                  <a href="#" className="font-semibold text-blue-600 hover:text-blue-500">
                    Forgot password?
                  </a>
                </div>
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
                  "Sign in"
                )}
              </button>
            </div>
          </form>

          <div className="mt-5 text-center">
            <p className="text-xs text-slate-600">
              New to Roxx CRM?{" "}
              <Link
                href="/register"
                className="font-bold text-blue-600 hover:text-blue-500 underline"
              >
                Start 30-Day Free Trial (20 Seats)
              </Link>
            </p>
          </div>

          <div className="mt-4 border-t border-slate-100 pt-3 text-center">
            <p className="text-xs text-slate-400">
              SaaS Owner: <code className="text-slate-600 font-mono">sohel@techflux.in</code> &bull; Demo: <code className="text-slate-600 font-mono">password123</code>
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

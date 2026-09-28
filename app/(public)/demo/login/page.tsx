"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Sparkles,
  ShieldCheck,
  Briefcase,
  UserCheck,
  AlertTriangle,
  Loader2,
  Lock,
  Mail,
  ArrowRight,
} from "lucide-react";
import { loginAsDemoAction } from "@/actions/demo";
import { loginAction } from "@/actions/auth";

export default function DemoLoginPage() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [selectedRole, setSelectedRole] = useState<"ADMIN" | "MANAGER" | "SALES">("ADMIN");
  const [email, setEmail] = useState("admin@roxx-crm.local");
  const [password, setPassword] = useState("password123");

  const demoAccounts = {
    ADMIN: { email: "admin@roxx-crm.local", name: "Demo Admin", desc: "Full organization privileges & settings" },
    MANAGER: { email: "manager@roxx-crm.local", name: "Demo Manager", desc: "Team pipeline supervision & reports" },
    SALES: { email: "sales@roxx-crm.local", name: "Demo Sales Rep", desc: "Lead prospecting, deals, & activities" },
  };

  const handleSelectRole = (role: "ADMIN" | "MANAGER" | "SALES") => {
    setSelectedRole(role);
    setEmail(demoAccounts[role].email);
    setPassword("password123");
    setError(null);
  };

  const handle1ClickLaunch = (role: "ADMIN" | "MANAGER" | "SALES") => {
    handleSelectRole(role);
    setError(null);
    startTransition(async () => {
      try {
        const demoRole = role === "SALES" ? "SALES_USER" : "ADMIN";
        const res = await loginAsDemoAction(demoRole);
        if (res.success) {
          router.push("/dashboard");
          router.refresh();
        } else {
          // Fallback to form action
          const formData = new FormData();
          formData.append("email", demoAccounts[role].email);
          formData.append("password", "password123");
          const formRes = await loginAction({ success: false }, formData);
          if (formRes?.error) {
            setError(formRes.error);
          }
        }
      } catch (err: unknown) {
        const errorMsg = err instanceof Error ? err.message : "Failed to launch demo session";
        setError(errorMsg);
      }
    });
  };

  const handleCustomSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const formData = new FormData();
      formData.append("email", email);
      formData.append("password", password);
      const res = await loginAction({ success: false }, formData);
      if (res?.error) {
        setError(res.error);
      }
    });
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
        <div className="w-12 h-12 rounded-2xl bg-amber-500 text-white flex items-center justify-center mx-auto shadow-md shadow-amber-500/25 mb-3">
          <Sparkles className="w-6 h-6 fill-white" />
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">
          Roxx CRM Live Demo Login
        </h1>
        <p className="mt-1 text-xs text-slate-500 max-w-sm mx-auto">
          Explore a complete, isolated sandbox workspace preloaded with realistic CRM data.
        </p>
      </div>

      <div className="mt-6 sm:mx-auto sm:w-full sm:max-w-md px-4">
        {/* Role Selector Buttons on Top */}
        <div className="mb-4 bg-white p-3 rounded-2xl border border-slate-200 shadow-xs">
          <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2 text-center">
            Select Demo Persona (1-Click Launch)
          </p>
          <div className="grid grid-cols-3 gap-2">
            <button
              type="button"
              onClick={() => handle1ClickLaunch("ADMIN")}
              disabled={isPending}
              className={`flex flex-col items-center justify-center p-2.5 rounded-xl border text-center transition-all cursor-pointer ${
                selectedRole === "ADMIN"
                  ? "bg-blue-50/80 border-blue-400 text-blue-900 shadow-2xs ring-2 ring-blue-500/20"
                  : "bg-slate-50/60 hover:bg-blue-50/40 border-slate-200 text-slate-700"
              }`}
            >
              <ShieldCheck className="w-5 h-5 text-blue-600 mb-1" />
              <span className="text-xs font-bold">Admin</span>
              <span className="text-[10px] text-slate-400">Full Access</span>
            </button>

            <button
              type="button"
              onClick={() => handle1ClickLaunch("MANAGER")}
              disabled={isPending}
              className={`flex flex-col items-center justify-center p-2.5 rounded-xl border text-center transition-all cursor-pointer ${
                selectedRole === "MANAGER"
                  ? "bg-purple-50/80 border-purple-400 text-purple-900 shadow-2xs ring-2 ring-purple-500/20"
                  : "bg-slate-50/60 hover:bg-purple-50/40 border-slate-200 text-slate-700"
              }`}
            >
              <Briefcase className="w-5 h-5 text-purple-600 mb-1" />
              <span className="text-xs font-bold">Manager</span>
              <span className="text-[10px] text-slate-400">Pipelines</span>
            </button>

            <button
              type="button"
              onClick={() => handle1ClickLaunch("SALES")}
              disabled={isPending}
              className={`flex flex-col items-center justify-center p-2.5 rounded-xl border text-center transition-all cursor-pointer ${
                selectedRole === "SALES"
                  ? "bg-emerald-50/80 border-emerald-400 text-emerald-900 shadow-2xs ring-2 ring-emerald-500/20"
                  : "bg-slate-50/60 hover:bg-emerald-50/40 border-slate-200 text-slate-700"
              }`}
            >
              <UserCheck className="w-5 h-5 text-emerald-600 mb-1" />
              <span className="text-xs font-bold">Sales Rep</span>
              <span className="text-[10px] text-slate-400">Deals & Rep</span>
            </button>
          </div>
        </div>

        {/* Form Card */}
        <div className="bg-white py-6 px-6 shadow-sm border border-slate-200 rounded-2xl sm:px-8">
          {error && (
            <div className="mb-4 p-3 rounded-xl bg-red-50 border border-red-200 flex items-start gap-2.5 text-red-700 text-xs">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-red-500" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleCustomSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider">
                Demo User Account
              </label>
              <div className="mt-1.5 relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <Mail className="w-4 h-4" />
                </div>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="block w-full pl-9 pr-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider">
                Demo Password
              </label>
              <div className="mt-1.5 relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="block w-full pl-9 pr-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isPending}
              className="w-full flex items-center justify-center py-2.5 px-4 rounded-xl text-sm font-bold text-white bg-amber-600 hover:bg-amber-700 shadow-sm transition-colors cursor-pointer disabled:opacity-60"
            >
              {isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Entering Sandbox...
                </>
              ) : (
                <>
                  Launch Demo Workspace
                  <ArrowRight className="w-4 h-4 ml-1.5" />
                </>
              )}
            </button>
          </form>

          {/* Switch to Subscription Organization Login */}
          <div className="mt-5 border-t border-slate-100 pt-4 text-center">
            <p className="text-xs text-slate-500">
              Have a dedicated subscription account?{" "}
              <Link
                href="/login"
                className="font-bold text-blue-600 hover:text-blue-700 hover:underline"
              >
                Sign in to Subscription Workspace &rarr;
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

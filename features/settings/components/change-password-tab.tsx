"use client";

import { useActionState, useState } from "react";
import {
  KeyRound,
  Lock,
  Eye,
  EyeOff,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ShieldCheck,
  Info,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { changePasswordAction, type ChangePasswordState } from "@/actions/auth";

const initialState: ChangePasswordState = {
  success: false,
};

export function ChangePasswordTab() {
  const [state, formAction, isPending] = useActionState(
    changePasswordAction,
    initialState
  );

  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 pt-4">
      {/* Form Card */}
      <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 shadow-xs p-6 space-y-6">
        <div>
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <KeyRound className="w-5 h-5 text-blue-600" />
            <span>Change Your Password</span>
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Update your account password regularly to keep your CRM workspace secure.
          </p>
        </div>

        {/* Success Alert */}
        {state?.success && state?.message && (
          <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-start gap-2.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-emerald-950">Password Updated</p>
              <p className="text-emerald-700 mt-0.5">{state.message}</p>
            </div>
          </div>
        )}

        {/* Error Alert */}
        {state?.error && (
          <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-800 text-xs flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-red-950">Update Failed</p>
              <p className="text-red-700 mt-0.5">{state.error}</p>
            </div>
          </div>
        )}

        <form action={formAction} className="space-y-5">
          {/* Current Password */}
          <div>
            <label
              htmlFor="currentPassword"
              className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5"
            >
              Current Password <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                <Lock className="w-4 h-4" />
              </div>
              <Input
                id="currentPassword"
                name="currentPassword"
                type={showCurrent ? "text" : "password"}
                required
                autoComplete="current-password"
                placeholder="Enter your current password"
                className="pl-9 pr-10 text-sm h-10"
              />
              <button
                type="button"
                onClick={() => setShowCurrent(!showCurrent)}
                tabIndex={-1}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 cursor-pointer"
                aria-label={showCurrent ? "Hide current password" : "Show current password"}
              >
                {showCurrent ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* New Password */}
          <div>
            <label
              htmlFor="newPassword"
              className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5"
            >
              New Password <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                <Lock className="w-4 h-4" />
              </div>
              <Input
                id="newPassword"
                name="newPassword"
                type={showNew ? "text" : "password"}
                required
                minLength={6}
                autoComplete="new-password"
                placeholder="Enter at least 6 characters"
                className="pl-9 pr-10 text-sm h-10"
              />
              <button
                type="button"
                onClick={() => setShowNew(!showNew)}
                tabIndex={-1}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 cursor-pointer"
                aria-label={showNew ? "Hide new password" : "Show new password"}
              >
                {showNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            <p className="text-[11px] text-slate-400 mt-1">
              Minimum 6 characters with a combination of letters, numbers, and symbols.
            </p>
          </div>

          {/* Confirm Password */}
          <div>
            <label
              htmlFor="confirmPassword"
              className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5"
            >
              Confirm New Password <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                <Lock className="w-4 h-4" />
              </div>
              <Input
                id="confirmPassword"
                name="confirmPassword"
                type={showConfirm ? "text" : "password"}
                required
                minLength={6}
                autoComplete="new-password"
                placeholder="Re-enter your new password"
                className="pl-9 pr-10 text-sm h-10"
              />
              <button
                type="button"
                onClick={() => setShowConfirm(!showConfirm)}
                tabIndex={-1}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 cursor-pointer"
                aria-label={showConfirm ? "Hide confirmation password" : "Show confirmation password"}
              >
                {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div className="pt-2">
            <Button
              type="submit"
              disabled={isPending}
              className="w-full sm:w-auto px-6 h-10 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs rounded-xl flex items-center justify-center gap-2 cursor-pointer shadow-xs transition-colors"
            >
              {isPending ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Updating Password...</span>
                </>
              ) : (
                <>
                  <KeyRound className="w-4 h-4" />
                  <span>Update Password</span>
                </>
              )}
            </Button>
          </div>
        </form>
      </div>

      {/* Security Guidance Sidebar */}
      <div className="space-y-4">
        <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 space-y-3">
          <div className="flex items-center gap-2 text-slate-900 font-bold text-xs uppercase tracking-wider">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <span>Password Guidelines</span>
          </div>
          <ul className="text-xs text-slate-600 space-y-2 list-disc pl-4">
            <li>Must contain at least 6 characters.</li>
            <li>Must differ from your current password.</li>
            <li>Avoid using common phrases or easily guessed personal info.</li>
            <li>Passwords are hashed with bcrypt encryption before storage.</li>
          </ul>
        </div>

        <div className="bg-blue-50/60 border border-blue-100 rounded-2xl p-5 space-y-2 text-xs text-blue-900">
          <div className="flex items-center gap-1.5 font-bold">
            <Info className="w-4 h-4 text-blue-600 shrink-0" />
            <span>Session &amp; Security</span>
          </div>
          <p className="text-[11px] leading-relaxed text-blue-800">
            Changing your password updates your active credentials immediately. Your current session will remain authenticated.
          </p>
        </div>
      </div>
    </div>
  );
}

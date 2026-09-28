"use client";

import { useState, useEffect, useTransition, useCallback } from "react";
import {
  Target,
  ChevronLeft,
  ChevronRight,
  Save,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Users2,
  TrendingUp,
  Percent,
  Sparkles,
  DollarSign,
  ShieldAlert,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  getMonthlyTargetsAction,
  updateMonthlyTargetsAction,
} from "@/actions/targets";
import type { MonthlyTargetData, UserTargetData } from "@/lib/validations/settings";

function formatMonthLabel(monthStr: string): string {
  try {
    const [year, month] = monthStr.split("-");
    const date = new Date(parseInt(year, 10), parseInt(month, 10) - 1, 1);
    return date.toLocaleDateString("en-US", { month: "long", year: "numeric" });
  } catch {
    return monthStr;
  }
}

export function SalesTargetsTab() {
  const [selectedMonth, setSelectedMonth] = useState<string>(() => {
    return new Date().toISOString().slice(0, 7);
  });
  const [data, setData] = useState<MonthlyTargetData | null>(null);
  const [orgTargetInput, setOrgTargetInput] = useState<number>(100000);
  const [userTargetsState, setUserTargetsState] = useState<Record<string, number>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, startSaving] = useTransition();
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const loadData = useCallback(async (month: string) => {
    setIsLoading(true);
    setSuccessMsg(null);
    setErrorMsg(null);
    try {
      const res = await getMonthlyTargetsAction(month);
      if (res.success && res.data) {
        setData(res.data);
        setOrgTargetInput(res.data.orgTarget);
        const map: Record<string, number> = {};
        for (const u of res.data.users) {
          map[u.userId] = u.targetAmount;
        }
        setUserTargetsState(map);
      } else {
        setErrorMsg(res.error || "Failed to load sales targets");
      }
    } catch {
      setErrorMsg("An unexpected error occurred while loading targets");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData(selectedMonth);
  }, [selectedMonth, loadData]);

  const handlePrevMonth = () => {
    const [year, month] = selectedMonth.split("-").map(Number);
    const date = new Date(year, month - 2, 1);
    setSelectedMonth(date.toISOString().slice(0, 7));
  };

  const handleNextMonth = () => {
    const [year, month] = selectedMonth.split("-").map(Number);
    const date = new Date(year, month, 1);
    setSelectedMonth(date.toISOString().slice(0, 7));
  };

  const handleUserTargetChange = (userId: string, val: number) => {
    setUserTargetsState((prev) => ({
      ...prev,
      [userId]: Math.max(0, val || 0),
    }));
  };

  const totalAllocated = Object.values(userTargetsState).reduce((sum, v) => sum + (v || 0), 0);
  const allocationPercent = orgTargetInput > 0 ? Math.round((totalAllocated / orgTargetInput) * 100) : 0;

  const handleDistributeEvenly = () => {
    if (!data?.users || data.users.length === 0) return;
    // Distribute among Sales reps and managers (or all active members)
    const targetCandidates = data.users.filter((u) => u.role === "SALES_USER" || u.role === "MANAGER");
    const count = targetCandidates.length > 0 ? targetCandidates.length : data.users.length;
    const splitAmount = Math.round(orgTargetInput / count);

    const newMap: Record<string, number> = {};
    for (const u of data.users) {
      if (targetCandidates.length > 0) {
        newMap[u.userId] = u.role === "SALES_USER" || u.role === "MANAGER" ? splitAmount : 0;
      } else {
        newMap[u.userId] = splitAmount;
      }
    }
    setUserTargetsState(newMap);
  };

  const handleSave = () => {
    setSuccessMsg(null);
    setErrorMsg(null);
    startSaving(async () => {
      const userTargets = Object.entries(userTargetsState).map(([userId, targetAmount]) => ({
        userId,
        targetAmount,
      }));

      const res = await updateMonthlyTargetsAction({
        month: selectedMonth,
        orgTarget: orgTargetInput,
        userTargets,
      });

      if (!res.success) {
        setErrorMsg(res.error || "Failed to save monthly targets");
      } else {
        setSuccessMsg(res.message || "Monthly targets saved successfully.");
        await loadData(selectedMonth);
      }
    });
  };

  return (
    <div className="space-y-6 pt-4">
      {/* Month Navigator Header */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <Target className="w-5 h-5 text-blue-600" />
            <span>Monthly Sales Target &amp; Quota Configuration</span>
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Configure organization goals and assign individual monthly quotas for each sales representative and manager.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handlePrevMonth}
            disabled={isLoading || isSaving}
            className="h-9 px-2.5 text-xs text-slate-600"
            title="Previous Month"
          >
            <ChevronLeft className="w-4 h-4" />
          </Button>

          <div className="px-3.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-800 text-center min-w-[150px]">
            {formatMonthLabel(selectedMonth)}
          </div>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleNextMonth}
            disabled={isLoading || isSaving}
            className="h-9 px-2.5 text-xs text-slate-600"
            title="Next Month"
          >
            <ChevronRight className="w-4 h-4" />
          </Button>

          <Input
            type="month"
            value={selectedMonth}
            onChange={(e) => e.target.value && setSelectedMonth(e.target.value)}
            className="w-36 h-9 text-xs"
          />
        </div>
      </div>

      {/* Notifications */}
      {successMsg && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-start gap-2.5">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-emerald-950">Success</p>
            <p className="text-emerald-700 mt-0.5">{successMsg}</p>
          </div>
        </div>
      )}

      {errorMsg && (
        <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-800 text-xs flex items-start gap-2.5">
          <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-red-950">Error</p>
            <p className="text-red-700 mt-0.5">{errorMsg}</p>
          </div>
        </div>
      )}

      {/* KPI Cards: Org Target & Quota Allocation */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Organization Target Input */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Organization Target
            </span>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
              {data?.currency || "USD"}
            </span>
          </div>

          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400 font-bold text-sm">
              {data?.currency === "INR" ? "₹" : "$"}
            </div>
            <Input
              type="number"
              min={0}
              step={1000}
              value={orgTargetInput || ""}
              onChange={(e) => setOrgTargetInput(Math.max(0, Number(e.target.value) || 0))}
              placeholder="100000"
              className="pl-8 pr-3 text-lg font-bold text-slate-900 h-11"
            />
          </div>
          <p className="text-[11px] text-slate-400">
            Overall revenue target for {formatMonthLabel(selectedMonth)}.
          </p>
        </div>

        {/* Total Allocated to Team */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Allocated to Team
            </span>
            <span
              className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                allocationPercent === 100
                  ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                  : allocationPercent > 100
                  ? "bg-amber-50 text-amber-700 border-amber-200"
                  : "bg-blue-50 text-blue-700 border-blue-200"
              }`}
            >
              {allocationPercent}% Assigned
            </span>
          </div>

          <div>
            <div className="text-2xl font-extrabold text-slate-900 tracking-tight">
              {data?.currency === "INR" ? "₹" : "$"}
              {totalAllocated.toLocaleString()}
            </div>
            <div className="w-full bg-slate-100 h-2 rounded-full mt-2.5 overflow-hidden">
              <div
                className={`h-full transition-all duration-500 ${
                  allocationPercent > 100 ? "bg-amber-500" : "bg-blue-600"
                }`}
                style={{ width: `${Math.min(allocationPercent, 100)}%` }}
              />
            </div>
          </div>
          <p className="text-[11px] text-slate-400">
            {totalAllocated >= orgTargetInput
              ? "All or more of the quota has been assigned."
              : `Gap of ${data?.currency === "INR" ? "₹" : "$"}${(
                  orgTargetInput - totalAllocated
                ).toLocaleString()} unallocated.`}
          </p>
        </div>

        {/* Closed Won Progress */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Current Month Attainment
            </span>
            <span
              className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                (data?.attainmentPercent || 0) >= 100
                  ? "bg-emerald-100 text-emerald-800"
                  : (data?.attainmentPercent || 0) >= 50
                  ? "bg-blue-100 text-blue-800"
                  : "bg-rose-100 text-rose-800"
              }`}
            >
              {(data?.attainmentPercent || 0) >= 100 ? "Crushed 🎉" : "Active 📈"}
            </span>
          </div>

          <div>
            <div className="text-2xl font-extrabold text-slate-900 tracking-tight">
              {data?.currency === "INR" ? "₹" : "$"}
              {(data?.totalWon || 0).toLocaleString()}
            </div>
            <div className="flex items-center gap-1.5 mt-2">
              <span className="text-xs font-bold text-blue-600">
                {data?.attainmentPercent || 0}%
              </span>
              <span className="text-xs text-slate-400">of organization target achieved</span>
            </div>
          </div>
          <p className="text-[11px] text-slate-400">
            Calculated from all deals closed won in this calendar month.
          </p>
        </div>
      </div>

      {/* Team Member Quota Allocation Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Users2 className="w-4 h-4 text-blue-600" />
              <span>Team Member Monthly Targets</span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Set specific monthly revenue goals for individual sales reps and managers.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleDistributeEvenly}
              disabled={isLoading || isSaving}
              className="text-xs gap-1.5 h-9"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-500" />
              <span>Distribute Target Evenly</span>
            </Button>

            <Button
              type="button"
              onClick={handleSave}
              disabled={isLoading || isSaving}
              className="bg-blue-600 hover:bg-blue-700 text-white text-xs gap-1.5 h-9 px-4 rounded-xl font-semibold shadow-xs"
            >
              {isSaving ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Saving...</span>
                </>
              ) : (
                <>
                  <Save className="w-3.5 h-3.5" />
                  <span>Save Targets</span>
                </>
              )}
            </Button>
          </div>
        </div>

        {isLoading ? (
          <div className="py-16 text-center text-xs text-slate-400 flex flex-col items-center justify-center gap-2">
            <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
            <span>Loading sales quotas for {formatMonthLabel(selectedMonth)}...</span>
          </div>
        ) : !data?.users || data.users.length === 0 ? (
          <div className="py-12 text-center text-xs text-slate-400">
            No active team members found in organization.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50/75 text-slate-600 font-semibold border-b border-slate-100 uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="py-3 px-4">Team Member</th>
                  <th className="py-3 px-4">Role</th>
                  <th className="py-3 px-4 min-w-[180px]">Monthly Target</th>
                  <th className="py-3 px-4">Won Revenue</th>
                  <th className="py-3 px-4 min-w-[150px]">Quota Attainment</th>
                  <th className="py-3 px-4 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.users.map((user) => {
                  const currentTarget = userTargetsState[user.userId] ?? user.targetAmount;
                  const currentAttainment =
                    currentTarget > 0 ? Math.round((user.revenueWon / currentTarget) * 100) : 0;

                  return (
                    <tr key={user.userId} className="hover:bg-slate-50/50 transition-colors">
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-xs uppercase shrink-0">
                            {user.userName.charAt(0)}
                          </div>
                          <div className="min-w-0">
                            <p className="font-bold text-slate-900 truncate">{user.userName}</p>
                            <p className="text-[11px] text-slate-400 truncate">{user.userEmail}</p>
                          </div>
                        </div>
                      </td>

                      <td className="py-3.5 px-4">
                        <span
                          className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            user.role === "ADMIN"
                              ? "bg-blue-50 text-blue-700 border border-blue-200"
                              : user.role === "MANAGER"
                              ? "bg-purple-50 text-purple-700 border border-purple-200"
                              : "bg-emerald-50 text-emerald-700 border border-emerald-200"
                          }`}
                        >
                          {user.role === "SALES_USER" ? "Sales Rep" : user.role}
                        </span>
                      </td>

                      <td className="py-3.5 px-4">
                        <div className="relative max-w-[160px]">
                          <div className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none text-slate-400 font-bold text-xs">
                            {data?.currency === "INR" ? "₹" : "$"}
                          </div>
                          <Input
                            type="number"
                            min={0}
                            step={1000}
                            value={currentTarget || ""}
                            onChange={(e) =>
                              handleUserTargetChange(user.userId, Number(e.target.value) || 0)
                            }
                            placeholder="0"
                            className="pl-6 pr-2 h-8 text-xs font-semibold text-slate-900"
                          />
                        </div>
                      </td>

                      <td className="py-3.5 px-4 font-bold text-slate-900">
                        {data?.currency === "INR" ? "₹" : "$"}
                        {user.revenueWon.toLocaleString()}
                      </td>

                      <td className="py-3.5 px-4">
                        <div className="space-y-1">
                          <div className="flex items-center justify-between text-[11px]">
                            <span className="font-bold text-slate-700">{currentAttainment}%</span>
                            <span className="text-slate-400">
                              {data?.currency === "INR" ? "₹" : "$"}
                              {currentTarget.toLocaleString()}
                            </span>
                          </div>
                          <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                            <div
                              className={`h-full transition-all duration-300 ${
                                currentAttainment >= 100
                                  ? "bg-emerald-500"
                                  : currentAttainment >= 50
                                  ? "bg-blue-500"
                                  : "bg-rose-400"
                              }`}
                              style={{ width: `${Math.min(currentAttainment, 100)}%` }}
                            />
                          </div>
                        </div>
                      </td>

                      <td className="py-3.5 px-4 text-right">
                        <span
                          className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            currentAttainment >= 100
                              ? "bg-emerald-100 text-emerald-800"
                              : currentAttainment >= 75
                              ? "bg-blue-100 text-blue-800"
                              : currentAttainment >= 40
                              ? "bg-amber-100 text-amber-800"
                              : "bg-rose-100 text-rose-800"
                          }`}
                        >
                          {currentAttainment >= 100
                            ? "Achieved 🎉"
                            : currentAttainment >= 75
                            ? "On Track 🚀"
                            : currentAttainment >= 40
                            ? "Pacing ⚡"
                            : "Needs Push 📈"}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <div className="p-4 bg-slate-50/75 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-slate-500">
          <p>
            💡 Note: Individual quotas help managers and executives align team objectives with overall company targets.
          </p>
          <Button
            type="button"
            onClick={handleSave}
            disabled={isLoading || isSaving}
            className="bg-blue-600 hover:bg-blue-700 text-white text-xs gap-1.5 h-9 px-5 rounded-xl font-semibold shadow-xs self-end sm:self-auto"
          >
            {isSaving ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Saving Targets...</span>
              </>
            ) : (
              <>
                <Save className="w-3.5 h-3.5" />
                <span>Save All Targets</span>
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}

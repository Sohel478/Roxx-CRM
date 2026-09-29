"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import {
  Users2,
  Kanban,
  CheckCircle2,
  TrendingUp,
  Clock,
  ArrowUpRight,
  Award,
  ChevronRight,
  BarChart3,
  Target,
  Pencil,
} from "lucide-react";
import { getReportsAnalyticsAction } from "@/actions/reports";
import { getTasksAction } from "@/actions/tasks";
import { getMonthlyTargetsAction } from "@/actions/targets";
import { getCurrentUserAction } from "@/actions/auth";
import type { ReportsAnalyticsData } from "@/lib/validations/reports";
import type { MonthlyTargetData } from "@/lib/validations/settings";
import type { SessionUser } from "@/lib/auth/session";

export default function DashboardPage() {
  const [analytics, setAnalytics] = useState<ReportsAnalyticsData | null>(null);
  const [targetsData, setTargetsData] = useState<MonthlyTargetData | null>(null);
  const [currentUser, setCurrentUser] = useState<SessionUser | null>(null);
  const [taskSummary, setTaskSummary] = useState({
    total: 0,
    dueToday: 0,
    overdue: 0,
    upcoming: 0,
    completed: 0,
  });
  const [isLoading, setIsLoading] = useState(true);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    const [reportRes, tasksRes, targetsRes, userRes] = await Promise.all([
      getReportsAnalyticsAction("all"),
      getTasksAction(),
      getMonthlyTargetsAction(),
      getCurrentUserAction(),
    ]);

    if (reportRes.success && reportRes.data) {
      setAnalytics(reportRes.data);
    }
    if (tasksRes.success && tasksRes.data) {
      setTaskSummary(tasksRes.data.summary);
    }
    if (targetsRes.success && targetsRes.data) {
      setTargetsData(targetsRes.data);
    }
    if (userRes) {
      setCurrentUser(userRes);
    }
    setIsLoading(false);
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const summary = analytics?.summary;
  const funnel = analytics?.funnel || [];
  const leaderboard = analytics?.teamLeaderboard || [];

  const roleUpper = currentUser?.role?.toUpperCase();
  const isAdmin =
    roleUpper === "ADMIN" ||
    roleUpper === "ADMINISTRATOR" ||
    Boolean(currentUser?.isSuperAdmin);
  const isManager = roleUpper === "MANAGER";
  const isAdminOrManager = isAdmin || isManager;
  const isPersonalView = Boolean(targetsData?.isPersonalView) || !isAdminOrManager;

  const monthlyQuotaTarget = targetsData?.orgTarget ?? (isPersonalView ? 0 : 100000);
  const currencySymbol = targetsData?.currency === "INR" ? "₹" : "$";
  const wonRevenue = isPersonalView
    ? (targetsData?.totalWon ?? 0)
    : (summary?.totalRevenueWon || targetsData?.totalWon || 0);
  const attainmentPercent =
    monthlyQuotaTarget > 0 ? Math.round((wonRevenue / monthlyQuotaTarget) * 100) : 0;
  const remainingGap = Math.max(0, monthlyQuotaTarget - wonRevenue);
  const weightedPipeline = summary?.weightedForecast || 0;
  const pipelineCoverage =
    remainingGap > 0 ? ((weightedPipeline / remainingGap) * 100).toFixed(0) : "100";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Sales Executive Dashboard
          </h1>
          <p className="text-sm text-slate-500">
            Real-time pipeline metrics, probability-adjusted revenue forecasts, and team performance.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/reports"
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-lg text-xs font-semibold shadow-xs transition-colors"
          >
            <BarChart3 className="w-3.5 h-3.5 text-blue-600" />
            <span>Full Reports</span>
          </Link>
          <Link
            href="/leads"
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-xs transition-colors"
          >
            <span>+ New Lead</span>
          </Link>
        </div>
      </div>

      {/* Urgent Task Follow-up Alert Banner */}
      {(taskSummary.overdue > 0 || taskSummary.dueToday > 0) && (
        <div className="bg-amber-50/80 border border-amber-200 rounded-xl p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-amber-500 text-white flex items-center justify-center shrink-0">
              <Clock className="w-4 h-4" />
            </div>
            <div>
              <h4 className="text-xs font-bold text-amber-950">
                Action Required: {taskSummary.dueToday} task(s) due today
                {taskSummary.overdue > 0 ? `, ${taskSummary.overdue} overdue` : ""}
              </h4>
              <p className="text-[11px] text-amber-700">
                Follow up with assigned leads and scheduled deal milestones to maintain pipeline momentum.
              </p>
            </div>
          </div>
          <Link
            href="/tasks"
            className="inline-flex items-center gap-1 text-xs font-bold text-amber-900 hover:text-amber-700 bg-white px-3 py-1.5 rounded-lg border border-amber-200 shadow-2xs self-start sm:self-center"
          >
            <span>View Tasks Checklist</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      )}

      {/* Top Metric KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Open Pipeline */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-xs font-medium uppercase tracking-wider text-slate-500">
              Open Pipeline
            </span>
            <div className="p-2 rounded-lg bg-purple-50 text-purple-600 border border-purple-100">
              <Kanban className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div className="text-2xl font-bold text-slate-900">
              {isLoading ? "..." : `$${(summary?.totalPipeline || 0).toLocaleString()}`}
            </div>
            <p className="text-[11px] text-purple-700 font-medium mt-1">
              Active across {summary?.totalDeals || 0} opportunity deals
            </p>
          </div>
        </div>

        {/* Weighted Forecast */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-xs font-medium uppercase tracking-wider text-slate-500">
              Weighted Forecast
            </span>
            <div className="p-2 rounded-lg bg-blue-50 text-blue-600 border border-blue-100">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div className="text-2xl font-bold text-slate-900">
              {isLoading ? "..." : `$${(summary?.weightedForecast || 0).toLocaleString()}`}
            </div>
            <p className="text-[11px] text-blue-600 font-medium mt-1">
              Probability-weighted expected revenue
            </p>
          </div>
        </div>

        {/* Closed Won Revenue */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-xs font-medium uppercase tracking-wider text-slate-500">
              Revenue Won
            </span>
            <div className="p-2 rounded-lg bg-emerald-50 text-emerald-600 border border-emerald-100">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div className="text-2xl font-bold text-slate-900">
              {isLoading ? "..." : `$${(summary?.totalRevenueWon || 0).toLocaleString()}`}
            </div>
            <p className="text-[11px] text-emerald-600 font-medium mt-1">
              Win Rate: {summary?.winRate || 0}% ({summary?.wonDealsCount || 0} deals won)
            </p>
          </div>
        </div>

        {/* Leads Qualification */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-xs font-medium uppercase tracking-wider text-slate-500">
              Lead Qualification
            </span>
            <div className="p-2 rounded-lg bg-amber-50 text-amber-600 border border-amber-100">
              <Users2 className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div className="text-2xl font-bold text-slate-900">
              {isLoading ? "..." : `${summary?.conversionRate || 0}%`}
            </div>
            <p className="text-[11px] text-slate-500 mt-1">
              {summary?.qualifiedLeads || 0} qualified of {summary?.totalLeads || 0} total leads
            </p>
          </div>
        </div>
      </div>

      {/* Monthly Sales Quota & Target Attainment */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-100 flex items-center justify-center shrink-0">
              <Target className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-base font-bold text-slate-900">
                  {isPersonalView
                    ? "My Monthly Sales Target & Quota Attainment"
                    : "Monthly Team Sales Target & Quota Attainment"}
                </h3>
                <span
                  className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${
                    monthlyQuotaTarget === 0
                      ? "bg-slate-100 text-slate-600"
                      : attainmentPercent >= 100
                      ? "bg-emerald-100 text-emerald-800"
                      : attainmentPercent >= 75
                      ? "bg-blue-100 text-blue-800"
                      : attainmentPercent >= 50
                      ? "bg-amber-100 text-amber-800"
                      : "bg-rose-100 text-rose-800"
                  }`}
                >
                  {monthlyQuotaTarget === 0
                    ? "No Quota Set"
                    : attainmentPercent >= 100
                    ? "Quota Crushed 🎉"
                    : attainmentPercent >= 75
                    ? "On Track 🚀"
                    : attainmentPercent >= 50
                    ? "Pacing Well ⚡"
                    : "Needs Push 📈"}
                </span>

                {isAdmin && (
                  <Link
                    href="/settings?tab=targets"
                    className="inline-flex items-center gap-1 text-[11px] font-semibold text-blue-600 hover:text-blue-700 bg-blue-50 hover:bg-blue-100 px-2 py-0.5 rounded-md transition-colors"
                  >
                    <Pencil className="w-3 h-3" />
                    <span>Edit Targets</span>
                  </Link>
                )}
              </div>
              <p className="text-xs text-slate-500">
                {isPersonalView
                  ? monthlyQuotaTarget > 0
                    ? `Pacing against your monthly personal quota of ${currencySymbol}${monthlyQuotaTarget.toLocaleString()} ${targetsData?.currency || "USD"}`
                    : "No individual quota assigned for this month yet. Check with your sales manager."
                  : `Pacing against monthly organization goal of ${currencySymbol}${monthlyQuotaTarget.toLocaleString()} ${targetsData?.currency || "USD"}`}
              </p>
            </div>
          </div>

          <div className="flex items-baseline gap-1 self-start sm:self-auto">
            <span className="text-3xl font-extrabold text-slate-900 tracking-tight">
              {monthlyQuotaTarget > 0 ? `${attainmentPercent}%` : "—"}
            </span>
            <span className="text-xs font-semibold text-slate-400">
              {monthlyQuotaTarget > 0 ? "of goal achieved" : "quota unassigned"}
            </span>
          </div>
        </div>

        {/* Multi-tier Progress Bar */}
        <div className="space-y-1.5">
          <div className="w-full h-3.5 bg-slate-100 rounded-full overflow-hidden flex shadow-inner">
            {/* Won Revenue segment */}
            <div
              className="bg-emerald-500 h-full rounded-l-full transition-all duration-700"
              style={{
                width: `${monthlyQuotaTarget > 0 ? Math.min(attainmentPercent, 100) : 0}%`,
              }}
              title={`Won: ${currencySymbol}${wonRevenue.toLocaleString()}`}
            />
            {/* Weighted Pipeline contribution preview */}
            {monthlyQuotaTarget > 0 && attainmentPercent < 100 && (
              <div
                className="bg-blue-400/80 h-full transition-all duration-700"
                style={{
                  width: `${Math.min(
                    Math.round((weightedPipeline / monthlyQuotaTarget) * 100),
                    100 - Math.min(attainmentPercent, 100)
                  )}%`,
                }}
                title={`Weighted Forecast: ${currencySymbol}${weightedPipeline.toLocaleString()}`}
              />
            )}
          </div>

          {/* Progress Legend */}
          <div className="flex flex-wrap items-center justify-between text-xs text-slate-500 pt-1 gap-2">
            <div className="flex items-center gap-4 flex-wrap">
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                <span>Closed Won: <strong className="text-slate-900">{currencySymbol}{wonRevenue.toLocaleString()}</strong></span>
              </span>
              {!isPersonalView && (
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-blue-400" />
                  <span>Weighted Forecast: <strong className="text-slate-900">{currencySymbol}{weightedPipeline.toLocaleString()}</strong></span>
                </span>
              )}
            </div>
            <div className="flex items-center gap-3">
              <span>Remaining Gap: <strong className="text-slate-800">{currencySymbol}{remainingGap.toLocaleString()}</strong></span>
              {!isPersonalView && (
                <>
                  <span>&bull;</span>
                  <span>Pipeline Coverage: <strong className="text-blue-600">{pipelineCoverage}%</strong></span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* For Admin / Manager: Team Member Target Status Table */}
        {!isPersonalView && targetsData?.users && targetsData.users.length > 0 && (
          <div className="pt-4 border-t border-slate-100 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                  <Users2 className="w-3.5 h-3.5 text-blue-600" />
                  <span>Team Quota Attainment &amp; Target Status</span>
                </h4>
                <p className="text-[11px] text-slate-400">
                  Individual quotas and revenue attainment for sales reps and managers.
                </p>
              </div>
              <Link
                href="/settings?tab=targets"
                className="text-xs font-semibold text-blue-600 hover:text-blue-700 flex items-center gap-1"
              >
                <span>Adjust Quotas</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            <div className="overflow-x-auto rounded-xl border border-slate-200">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50 text-[11px] font-bold text-slate-500 uppercase tracking-wider border-b border-slate-200">
                    <th className="py-2.5 px-3">Team Member</th>
                    <th className="py-2.5 px-3">Role</th>
                    <th className="py-2.5 px-3 text-right">Quota Target</th>
                    <th className="py-2.5 px-3 text-right">Won Revenue</th>
                    <th className="py-2.5 px-3">Attainment</th>
                    <th className="py-2.5 px-3 text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {targetsData.users.map((u) => {
                    const uAttainment =
                      u.targetAmount > 0 ? Math.round((u.revenueWon / u.targetAmount) * 100) : 0;
                    return (
                      <tr key={u.userId} className="hover:bg-slate-50/75 transition-colors">
                        <td className="py-2.5 px-3 font-semibold text-slate-900">
                          <div>{u.userName}</div>
                          <div className="text-[10px] text-slate-400 font-normal">{u.userEmail}</div>
                        </td>
                        <td className="py-2.5 px-3 text-slate-600 text-[11px]">
                          <span className="bg-slate-100 px-1.5 py-0.5 rounded text-slate-700 font-medium">
                            {u.role.replace(/_/g, " ")}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-right font-medium text-slate-800">
                          {u.targetAmount > 0 ? `${currencySymbol}${u.targetAmount.toLocaleString()}` : "—"}
                        </td>
                        <td className="py-2.5 px-3 text-right font-bold text-slate-900">
                          {currencySymbol}{u.revenueWon.toLocaleString()}
                        </td>
                        <td className="py-2.5 px-3 min-w-[130px]">
                          <div className="flex items-center gap-2">
                            <div className="flex-1 bg-slate-100 h-2 rounded-full overflow-hidden">
                              <div
                                className={`h-full rounded-full transition-all duration-500 ${
                                  uAttainment >= 100
                                    ? "bg-emerald-500"
                                    : uAttainment >= 75
                                    ? "bg-blue-600"
                                    : uAttainment >= 50
                                    ? "bg-amber-500"
                                    : "bg-rose-500"
                                }`}
                                style={{ width: `${Math.min(uAttainment, 100)}%` }}
                              />
                            </div>
                            <span className="text-[11px] font-bold text-slate-700 w-8 text-right">
                              {uAttainment}%
                            </span>
                          </div>
                        </td>
                        <td className="py-2.5 px-3 text-right">
                          {u.targetAmount === 0 ? (
                            <span className="text-[10px] font-semibold text-slate-400 bg-slate-50 border border-slate-200 px-2 py-0.5 rounded-full">
                              No Target
                            </span>
                          ) : uAttainment >= 100 ? (
                            <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                              Crushed 🎉
                            </span>
                          ) : uAttainment >= 75 ? (
                            <span className="text-[10px] font-bold text-blue-700 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-full">
                              On Track 🚀
                            </span>
                          ) : uAttainment >= 50 ? (
                            <span className="text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
                              Pacing ⚡
                            </span>
                          ) : (
                            <span className="text-[10px] font-bold text-rose-700 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded-full">
                              Needs Push 📈
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Middle Grid: Funnel & Leaderboard */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Pipeline Stage Funnel */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                Pipeline Stage Breakdown
              </h3>
              <p className="text-xs text-slate-500">
                Deal volume and value across all sales stages
              </p>
            </div>
            <Link
              href="/opportunities"
              className="text-xs text-blue-600 hover:underline font-semibold flex items-center gap-1"
            >
              <span>Kanban Board</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="space-y-3 pt-1">
            {funnel.map((stage) => {
              const maxVal = Math.max(...funnel.map((s) => s.totalValue), 10000);
              const percent = Math.min(Math.round((stage.totalValue / maxVal) * 100), 100);

              return (
                <div key={stage.stageId} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <span
                        className="w-2.5 h-2.5 rounded-full"
                        style={{ backgroundColor: stage.color }}
                      />
                      <span className="font-semibold text-slate-800">
                        {stage.stageName}
                      </span>
                      <span className="text-[11px] text-slate-400">
                        ({stage.probability}% prob)
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-slate-500 font-medium">
                        {stage.count} {stage.count === 1 ? "deal" : "deals"}
                      </span>
                      <span className="font-bold text-slate-900 w-20 text-right">
                        ${stage.totalValue.toLocaleString()}
                      </span>
                    </div>
                  </div>
                  {/* Progress visual bar */}
                  <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${Math.max(percent, 4)}%`,
                        backgroundColor: stage.color,
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Sales Rep Leaderboard */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                Team Productivity Leaderboard
              </h3>
              <p className="text-xs text-slate-500">
                Top sales performers by closed revenue &amp; deal velocity
              </p>
            </div>
            <div className="p-1 rounded-lg bg-amber-50 text-amber-600">
              <Award className="w-4 h-4" />
            </div>
          </div>

          {leaderboard.length === 0 ? (
            <div className="py-8 text-center text-xs text-slate-400">
              No sales activity recorded yet.
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {leaderboard.map((rep, idx) => (
                <div
                  key={rep.userId}
                  className="py-3 flex items-center justify-between gap-3 first:pt-0 last:pb-0"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                        idx === 0
                          ? "bg-amber-100 text-amber-800 ring-2 ring-amber-300"
                          : "bg-slate-100 text-slate-700"
                      }`}
                    >
                      {idx + 1}
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-slate-900 truncate">
                        {rep.userName}
                      </p>
                      <p className="text-[11px] text-slate-500">
                        {rep.dealsWon} won &bull; {rep.activeDeals} active deals &bull; {rep.activitiesLogged} touches
                      </p>
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <p className="text-xs font-bold text-emerald-600">
                      {currencySymbol}{rep.revenueWon.toLocaleString()}
                    </p>
                    {(() => {
                      const repTarget = targetsData?.users?.find((u) => u.userId === rep.userId);
                      if (repTarget && repTarget.targetAmount > 0) {
                        return (
                          <p className="text-[10px] text-blue-600 font-semibold">
                            Target: {currencySymbol}{repTarget.targetAmount.toLocaleString()} ({repTarget.attainmentPercent}%)
                          </p>
                        );
                      }
                      return (
                        <p className="text-[10px] text-slate-400">
                          Pipe: {currencySymbol}{rep.pipelineValue.toLocaleString()}
                        </p>
                      );
                    })()}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

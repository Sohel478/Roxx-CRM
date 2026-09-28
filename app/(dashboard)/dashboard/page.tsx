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
  UserCheck,
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

  const monthlyQuotaTarget = targetsData?.orgTarget || 100000;
  const currencySymbol = targetsData?.currency === "INR" ? "₹" : "$";
  const wonRevenue = summary?.totalRevenueWon || targetsData?.totalWon || 0;
  const attainmentPercent = Math.round((wonRevenue / monthlyQuotaTarget) * 100);
  const remainingGap = Math.max(0, monthlyQuotaTarget - wonRevenue);
  const weightedPipeline = summary?.weightedForecast || 0;
  const pipelineCoverage =
    remainingGap > 0 ? ((weightedPipeline / remainingGap) * 100).toFixed(0) : "100";

  const isAdmin =
    currentUser?.role?.toUpperCase() === "ADMIN" ||
    currentUser?.role?.toUpperCase() === "ADMINISTRATOR" ||
    currentUser?.isSuperAdmin;

  const myTarget = targetsData?.users?.find(
    (u) =>
      u.userId === currentUser?.id ||
      u.userEmail?.toLowerCase() === currentUser?.email?.toLowerCase()
  );

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
                  Monthly Team Sales Target &amp; Quota Attainment
                </h3>
                <span
                  className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${
                    attainmentPercent >= 100
                      ? "bg-emerald-100 text-emerald-800"
                      : attainmentPercent >= 75
                      ? "bg-blue-100 text-blue-800"
                      : attainmentPercent >= 50
                      ? "bg-amber-100 text-amber-800"
                      : "bg-rose-100 text-rose-800"
                  }`}
                >
                  {attainmentPercent >= 100
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
                Pacing against monthly organization goal of {currencySymbol}{monthlyQuotaTarget.toLocaleString()} {targetsData?.currency || "USD"}
              </p>
            </div>
          </div>

          <div className="flex items-baseline gap-1 self-start sm:self-auto">
            <span className="text-3xl font-extrabold text-slate-900 tracking-tight">
              {attainmentPercent}%
            </span>
            <span className="text-xs font-semibold text-slate-400">of goal achieved</span>
          </div>
        </div>

        {/* Multi-tier Progress Bar */}
        <div className="space-y-1.5">
          <div className="w-full h-3.5 bg-slate-100 rounded-full overflow-hidden flex shadow-inner">
            {/* Won Revenue segment */}
            <div
              className="bg-emerald-500 h-full rounded-l-full transition-all duration-700"
              style={{
                width: `${Math.min(attainmentPercent, 100)}%`,
              }}
              title={`Won: ${currencySymbol}${wonRevenue.toLocaleString()}`}
            />
            {/* Weighted Pipeline contribution preview */}
            {attainmentPercent < 100 && (
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
            <div className="flex items-center gap-4">
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                <span>Closed Won: <strong className="text-slate-900">{currencySymbol}{wonRevenue.toLocaleString()}</strong></span>
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-blue-400" />
                <span>Weighted Forecast: <strong className="text-slate-900">{currencySymbol}{weightedPipeline.toLocaleString()}</strong></span>
              </span>
            </div>
            <div className="flex items-center gap-3">
              <span>Remaining Gap: <strong className="text-slate-800">{currencySymbol}{remainingGap.toLocaleString()}</strong></span>
              <span>&bull;</span>
              <span>Pipeline Coverage: <strong className="text-blue-600">{pipelineCoverage}%</strong></span>
            </div>
          </div>
        </div>

        {/* Personal Target Pill (if user has an individual target assigned) */}
        {myTarget && myTarget.targetAmount > 0 && (
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2">
              <UserCheck className="w-4 h-4 text-blue-600 shrink-0" />
              <div>
                <span className="font-bold text-slate-800">My Monthly Quota: </span>
                <span className="text-slate-600">
                  {currencySymbol}{myTarget.revenueWon.toLocaleString()} won of {currencySymbol}{myTarget.targetAmount.toLocaleString()} target
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2.5 min-w-[140px]">
              <div className="flex-1 bg-slate-200 h-2 rounded-full overflow-hidden">
                <div
                  className="bg-blue-600 h-full rounded-full transition-all duration-500"
                  style={{ width: `${Math.min(myTarget.attainmentPercent, 100)}%` }}
                />
              </div>
              <span className="font-bold text-blue-700 text-xs shrink-0">
                {myTarget.attainmentPercent}%
              </span>
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

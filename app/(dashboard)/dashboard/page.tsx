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
} from "lucide-react";
import { getReportsAnalyticsAction } from "@/actions/reports";
import { getTasksAction } from "@/actions/tasks";
import { ReportsAnalyticsData } from "@/lib/validations/reports";

export default function DashboardPage() {
  const [analytics, setAnalytics] = useState<ReportsAnalyticsData | null>(null);
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
    const [reportRes, tasksRes] = await Promise.all([
      getReportsAnalyticsAction("all"),
      getTasksAction(),
    ]);

    if (reportRes.success && reportRes.data) {
      setAnalytics(reportRes.data);
    }
    if (tasksRes.success && tasksRes.data) {
      setTaskSummary(tasksRes.data.summary);
    }
    setIsLoading(false);
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const summary = analytics?.summary;
  const funnel = analytics?.funnel || [];
  const leaderboard = analytics?.teamLeaderboard || [];

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
                      ${rep.revenueWon.toLocaleString()}
                    </p>
                    <p className="text-[10px] text-slate-400">
                      Pipe: ${rep.pipelineValue.toLocaleString()}
                    </p>
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

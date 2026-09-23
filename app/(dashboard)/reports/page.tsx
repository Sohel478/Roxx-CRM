"use client";

import { useEffect, useState, useCallback, useTransition } from "react";
import {
  Download,
  FileSpreadsheet,
  Loader2,
} from "lucide-react";
import {
  getReportsAnalyticsAction,
  exportReportCsvAction,
} from "@/actions/reports";
import {
  DateRangeOption,
  ReportsAnalyticsData,
} from "@/lib/validations/reports";
import { Button } from "@/components/ui/button";

export default function ReportsPage() {
  const [dateRange, setDateRange] = useState<DateRangeOption>("30d");
  const [activeTab, setActiveTab] = useState<
    "funnel" | "winloss" | "sources" | "leaderboard"
  >("funnel");
  const [analytics, setAnalytics] = useState<ReportsAnalyticsData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isExporting, startExportTransition] = useTransition();

  const loadReport = useCallback(async () => {
    setIsLoading(true);
    const res = await getReportsAnalyticsAction(dateRange);
    if (res.success && res.data) {
      setAnalytics(res.data);
    }
    setIsLoading(false);
  }, [dateRange]);

  useEffect(() => {
    loadReport();
  }, [loadReport]);

  const handleExportCsv = (
    type: "pipeline" | "leads" | "leaderboard" | "sources"
  ) => {
    startExportTransition(async () => {
      const res = await exportReportCsvAction(type);
      if (res.success && res.csv && res.filename) {
        const blob = new Blob([res.csv], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.setAttribute("download", res.filename);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }
    });
  };

  const summary = analytics?.summary;
  const funnel = analytics?.funnel || [];
  const sources = analytics?.sources || [];
  const lossReasons = analytics?.lossReasons || [];
  const leaderboard = analytics?.teamLeaderboard || [];

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              Reports &amp; Sales Analytics
            </h1>
            {isLoading && <Loader2 className="w-4 h-4 animate-spin text-blue-600" />}
          </div>
          <p className="text-sm text-slate-500">
            Pipeline health, lead conversion funnel, win/loss analytics, and rep productivity.
          </p>
        </div>

        {/* Export & Date Filter Controls */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Date Range Selector */}
          <div className="inline-flex rounded-lg border border-slate-200 bg-white p-1 shadow-2xs">
            {[
              { label: "7D", value: "7d" },
              { label: "30D", value: "30d" },
              { label: "MTD", value: "mtd" },
              { label: "QTD", value: "qtd" },
              { label: "YTD", value: "ytd" },
              { label: "All Time", value: "all" },
            ].map((r) => (
              <button
                key={r.value}
                type="button"
                onClick={() => setDateRange(r.value as DateRangeOption)}
                className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-all ${
                  dateRange === r.value
                    ? "bg-slate-900 text-white shadow-xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                {r.label}
              </button>
            ))}
          </div>

          {/* CSV Export Button */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleExportCsv("pipeline")}
            disabled={isExporting}
            className="text-xs h-9 gap-1.5"
          >
            <Download className="w-3.5 h-3.5 text-blue-600" />
            <span>{isExporting ? "Exporting..." : "Export CSV"}</span>
          </Button>
        </div>
      </div>

      {/* KPI Highlights Bar */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <span className="text-xs font-medium text-slate-500 uppercase tracking-wider block">
            Pipeline Value
          </span>
          <div className="text-2xl font-bold text-slate-900 mt-1">
            ${(summary?.totalPipeline || 0).toLocaleString()}
          </div>
          <span className="text-[11px] text-purple-700 font-medium">
            Active in open pipeline
          </span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <span className="text-xs font-medium text-slate-500 uppercase tracking-wider block">
            Weighted Forecast
          </span>
          <div className="text-2xl font-bold text-blue-600 mt-1">
            ${(summary?.weightedForecast || 0).toLocaleString()}
          </div>
          <span className="text-[11px] text-slate-500">
            Probability-adjusted projection
          </span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <span className="text-xs font-medium text-slate-500 uppercase tracking-wider block">
            Revenue Closed Won
          </span>
          <div className="text-2xl font-bold text-emerald-600 mt-1">
            ${(summary?.totalRevenueWon || 0).toLocaleString()}
          </div>
          <span className="text-[11px] text-emerald-700 font-medium">
            {summary?.wonDealsCount || 0} deals won
          </span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <span className="text-xs font-medium text-slate-500 uppercase tracking-wider block">
            Win Rate
          </span>
          <div className="text-2xl font-bold text-slate-900 mt-1">
            {summary?.winRate || 0}%
          </div>
          <span className="text-[11px] text-slate-500">
            Avg deal: ${(summary?.avgDealSize || 0).toLocaleString()}
          </span>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="flex border-b border-slate-200 bg-white px-4 rounded-t-xl">
        <button
          type="button"
          onClick={() => setActiveTab("funnel")}
          className={`py-3 px-4 text-xs font-bold border-b-2 transition-all ${
            activeTab === "funnel"
              ? "border-blue-600 text-blue-600"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          Pipeline &amp; Funnel
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("winloss")}
          className={`py-3 px-4 text-xs font-bold border-b-2 transition-all ${
            activeTab === "winloss"
              ? "border-blue-600 text-blue-600"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          Win / Loss Analysis
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("sources")}
          className={`py-3 px-4 text-xs font-bold border-b-2 transition-all ${
            activeTab === "sources"
              ? "border-blue-600 text-blue-600"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          Lead Sources &amp; ROI
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("leaderboard")}
          className={`py-3 px-4 text-xs font-bold border-b-2 transition-all ${
            activeTab === "leaderboard"
              ? "border-blue-600 text-blue-600"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          Team Productivity
        </button>
      </div>

      {/* Tab 1: Funnel & Forecast */}
      {activeTab === "funnel" && (
        <div className="bg-white rounded-b-xl border border-t-0 border-slate-200 p-6 shadow-xs space-y-6">
          <div>
            <h3 className="text-base font-bold text-slate-900">
              Sales Stage Conversion Funnel
            </h3>
            <p className="text-xs text-slate-500">
              Pipeline progression through 7 defined stages with value distribution
            </p>
          </div>

          <div className="space-y-4">
            {funnel.map((stage) => {
              const maxVal = Math.max(...funnel.map((s) => s.totalValue), 10000);
              const percent = Math.min(Math.round((stage.totalValue / maxVal) * 100), 100);

              return (
                <div key={stage.stageId} className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <span
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: stage.color }}
                      />
                      <span className="font-bold text-slate-900">
                        {stage.order}. {stage.stageName}
                      </span>
                      <span className="text-slate-400">({stage.probability}% win probability)</span>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="text-slate-500 font-medium">
                        {stage.count} {stage.count === 1 ? "deal" : "deals"}
                      </span>
                      <span className="font-extrabold text-slate-900 w-24 text-right">
                        ${stage.totalValue.toLocaleString()}
                      </span>
                    </div>
                  </div>
                  <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${Math.max(percent, 3)}%`,
                        backgroundColor: stage.color,
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Tab 2: Win / Loss Analysis */}
      {activeTab === "winloss" && (
        <div className="bg-white rounded-b-xl border border-t-0 border-slate-200 p-6 shadow-xs space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-slate-900">
                Win / Loss Reason Analytics
              </h3>
              <p className="text-xs text-slate-500">
                Categorized root causes for lost deals to pinpoint competitive and pricing risks
              </p>
            </div>
            <div className="flex items-center gap-2 text-xs">
              <span className="inline-flex items-center gap-1 font-semibold text-emerald-700 bg-emerald-50 px-2 py-1 rounded">
                {summary?.wonDealsCount || 0} Deals Won
              </span>
              <span className="inline-flex items-center gap-1 font-semibold text-red-700 bg-red-50 px-2 py-1 rounded">
                {summary?.lostDealsCount || 0} Deals Lost
              </span>
            </div>
          </div>

          {lossReasons.length === 0 ? (
            <div className="py-12 text-center text-xs text-slate-400">
              No lost deals recorded in this timeframe. Excellent win rate!
            </div>
          ) : (
            <div className="space-y-4">
              {lossReasons.map((lr) => (
                <div key={lr.reason} className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-slate-800">{lr.reason}</span>
                    <div className="flex items-center gap-4">
                      <span className="text-slate-500">{lr.count} deals ({lr.percentage}%)</span>
                      <span className="font-bold text-red-600 w-24 text-right">
                        -${lr.totalLostValue.toLocaleString()}
                      </span>
                    </div>
                  </div>
                  <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-red-500 rounded-full transition-all duration-500"
                      style={{ width: `${Math.max(lr.percentage, 5)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tab 3: Lead Sources & ROI */}
      {activeTab === "sources" && (
        <div className="bg-white rounded-b-xl border border-t-0 border-slate-200 p-6 shadow-xs space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-slate-900">
                Lead Source Conversion &amp; ROI
              </h3>
              <p className="text-xs text-slate-500">
                Marketing channel efficacy and generated pipeline volume
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleExportCsv("sources")}
              className="text-xs h-8 gap-1.5"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              <span>Export Sources CSV</span>
            </Button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider font-semibold border-y border-slate-200">
                <tr>
                  <th className="py-2.5 px-4">Acquisition Channel</th>
                  <th className="py-2.5 px-4 text-center">Total Inflow</th>
                  <th className="py-2.5 px-4 text-center">Qualified Leads</th>
                  <th className="py-2.5 px-4 text-center">Conversion %</th>
                  <th className="py-2.5 px-4 text-right">Generated Pipeline</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {sources.map((s) => (
                  <tr key={s.source} className="hover:bg-slate-50/75 transition-colors">
                    <td className="py-3 px-4 font-bold text-slate-900">{s.source}</td>
                    <td className="py-3 px-4 text-center text-slate-600">{s.leadsCount}</td>
                    <td className="py-3 px-4 text-center font-semibold text-emerald-700">
                      {s.qualifiedCount}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full font-bold bg-blue-50 text-blue-700">
                        {s.conversionRate}%
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right font-extrabold text-slate-900">
                      ${s.totalValue.toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 4: Team Productivity */}
      {activeTab === "leaderboard" && (
        <div className="bg-white rounded-b-xl border border-t-0 border-slate-200 p-6 shadow-xs space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-slate-900">
                Sales Rep Quota &amp; Activity Productivity
              </h3>
              <p className="text-xs text-slate-500">
                Performance tracking by closed revenue, open pipeline, and touchpoint counts
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleExportCsv("leaderboard")}
              className="text-xs h-8 gap-1.5"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              <span>Export Team CSV</span>
            </Button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider font-semibold border-y border-slate-200">
                <tr>
                  <th className="py-2.5 px-4">Sales Representative</th>
                  <th className="py-2.5 px-4">Role</th>
                  <th className="py-2.5 px-4 text-center">Deals Won</th>
                  <th className="py-2.5 px-4 text-right">Closed Revenue</th>
                  <th className="py-2.5 px-4 text-center">Active Deals</th>
                  <th className="py-2.5 px-4 text-right">Open Pipeline</th>
                  <th className="py-2.5 px-4 text-center">Calls</th>
                  <th className="py-2.5 px-4 text-center">Meetings</th>
                  <th className="py-2.5 px-4 text-center">Total Touches</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {leaderboard.map((r) => (
                  <tr key={r.userId} className="hover:bg-slate-50/75 transition-colors">
                    <td className="py-3 px-4 font-bold text-slate-900">{r.userName}</td>
                    <td className="py-3 px-4 text-slate-500 font-medium">{r.role}</td>
                    <td className="py-3 px-4 text-center font-bold text-emerald-700">
                      {r.dealsWon}
                    </td>
                    <td className="py-3 px-4 text-right font-extrabold text-emerald-700">
                      ${r.revenueWon.toLocaleString()}
                    </td>
                    <td className="py-3 px-4 text-center text-slate-700">{r.activeDeals}</td>
                    <td className="py-3 px-4 text-right font-bold text-slate-900">
                      ${r.pipelineValue.toLocaleString()}
                    </td>
                    <td className="py-3 px-4 text-center text-slate-600">{r.callsLogged}</td>
                    <td className="py-3 px-4 text-center text-slate-600">{r.meetingsLogged}</td>
                    <td className="py-3 px-4 text-center font-bold text-blue-600">
                      {r.activitiesLogged}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

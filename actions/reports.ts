"use server";

import { prisma } from "@/lib/db/prisma";
import { requireAuth } from "@/lib/auth/session";
import {
  mockLeadsStore,
  mockOpportunitiesStore,
  mockActivitiesStore,
} from "@/lib/db/mock-store";
import { PIPELINE_STAGES } from "@/lib/validations/opportunities";
import {
  DateRangeOption,
  ReportsAnalyticsData,
  ReportSummary,
  FunnelStageMetric,
  SourceRoiMetric,
  LossReasonMetric,
  RepProductivityMetric,
} from "@/lib/validations/reports";

export type { ReportsAnalyticsData, ReportSummary, DateRangeOption };

function getDateCutoff(range: DateRangeOption): Date {
  const now = new Date();
  switch (range) {
    case "7d":
      return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    case "30d":
      return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    case "mtd":
      return new Date(now.getFullYear(), now.getMonth(), 1);
    case "qtd": {
      const quarterMonth = Math.floor(now.getMonth() / 3) * 3;
      return new Date(now.getFullYear(), quarterMonth, 1);
    }
    case "ytd":
      return new Date(now.getFullYear(), 0, 1);
    case "all":
    default:
      return new Date(0);
  }
}

/**
 * Fetch complete sales intelligence & analytics data
 */
export async function getReportsAnalyticsAction(
  dateRange: DateRangeOption = "30d"
): Promise<{ success: boolean; data?: ReportsAnalyticsData; error?: string }> {
  const session = await requireAuth();
  const cutoff = getDateCutoff(dateRange);

  try {
    // 1. Fetch Opportunities
    const opportunities = await prisma.opportunity.findMany({
      where: {
        organizationId: session.organizationId,
        createdAt: { gte: cutoff },
        deletedAt: null,
      },
      include: {
        stage: true,
        owner: { select: { id: true, name: true, role: { select: { name: true } } } },
      },
    });

    // 2. Fetch Leads
    const leads = await prisma.lead.findMany({
      where: {
        organizationId: session.organizationId,
        createdAt: { gte: cutoff },
        deletedAt: null,
      },
    });

    // 3. Fetch Activities
    const activities = await prisma.activity.findMany({
      where: {
        organizationId: session.organizationId,
        activityAt: { gte: cutoff },
      },
      include: {
        user: { select: { id: true, name: true } },
      },
    });

    // Build metrics
    const wonDeals = opportunities.filter((o) => o.status === "WON");
    const lostDeals = opportunities.filter((o) => o.status === "LOST");
    const openDeals = opportunities.filter((o) => o.status === "OPEN");

    const totalRevenueWon = wonDeals.reduce((sum, o) => sum + Number(o.amount || 0), 0);
    const totalPipeline = openDeals.reduce((sum, o) => sum + Number(o.amount || 0), 0);
    const weightedForecast = openDeals.reduce(
      (sum, o) => sum + (Number(o.amount || 0) * (o.probability || 10)) / 100,
      0
    );

    const closedDealsCount = wonDeals.length + lostDealsCount(lostDeals);
    const winRate = closedDealsCount > 0 ? Math.round((wonDeals.length / closedDealsCount) * 100) : 0;

    const totalLeads = leads.length;
    const qualifiedLeads = leads.filter(
      (l) => l.status === "Qualified" || l.status === "Converted"
    ).length;
    const conversionRate = totalLeads > 0 ? Math.round((qualifiedLeads / totalLeads) * 100) : 0;
    const avgDealSize = wonDeals.length > 0 ? Math.round(totalRevenueWon / wonDeals.length) : 0;

    // Funnel stage breakdown
    const funnel: FunnelStageMetric[] = PIPELINE_STAGES.map((stage) => {
      const stageDeals = opportunities.filter((o) => o.stageId === stage.id || o.stage?.name === stage.name);
      return {
        stageId: stage.id,
        stageName: stage.name,
        order: stage.order,
        count: stageDeals.length,
        totalValue: stageDeals.reduce((sum, o) => sum + Number(o.amount || 0), 0),
        color: stage.color,
        probability: stage.probability,
      };
    });

    // Lead Sources breakdown
    const sourceMap = new Map<string, { count: number; qualified: number; value: number }>();
    leads.forEach((l) => {
      const src = l.source || "Other";
      const existing = sourceMap.get(src) || { count: 0, qualified: 0, value: 0 };
      existing.count += 1;
      if (l.status === "Qualified" || l.status === "Converted") {
        existing.qualified += 1;
      }
      existing.value += Number(l.estimatedValue || 0);
      sourceMap.set(src, existing);
    });

    const sources: SourceRoiMetric[] = Array.from(sourceMap.entries()).map(([source, stats]) => ({
      source,
      leadsCount: stats.count,
      qualifiedCount: stats.qualified,
      conversionRate: stats.count > 0 ? Math.round((stats.qualified / stats.count) * 100) : 0,
      totalValue: stats.value,
    }));

    // Loss reasons breakdown
    const lossMap = new Map<string, { count: number; value: number }>();
    lostDeals.forEach((o) => {
      const reason = o.lossReason || "Unspecified";
      const existing = lossMap.get(reason) || { count: 0, value: 0 };
      existing.count += 1;
      existing.value += Number(o.amount || 0);
      lossMap.set(reason, existing);
    });

    const totalLostCount = lostDeals.length;
    const lossReasons: LossReasonMetric[] = Array.from(lossMap.entries()).map(([reason, stats]) => ({
      reason,
      count: stats.count,
      totalLostValue: stats.value,
      percentage: totalLostCount > 0 ? Math.round((stats.count / totalLostCount) * 100) : 0,
    }));

    // Team Leaderboard
    const userMap = new Map<string, RepProductivityMetric>();
    opportunities.forEach((o) => {
      const uid = o.ownerId;
      const uname = o.owner?.name || "Team Member";
      const urole = o.owner?.role?.name || "SALES_USER";

      if (!userMap.has(uid)) {
        userMap.set(uid, {
          userId: uid,
          userName: uname,
          role: urole,
          dealsWon: 0,
          revenueWon: 0,
          activeDeals: 0,
          pipelineValue: 0,
          activitiesLogged: 0,
          callsLogged: 0,
          meetingsLogged: 0,
        });
      }

      const rep = userMap.get(uid)!;
      if (o.status === "WON") {
        rep.dealsWon += 1;
        rep.revenueWon += Number(o.amount || 0);
      } else if (o.status === "OPEN") {
        rep.activeDeals += 1;
        rep.pipelineValue += Number(o.amount || 0);
      }
    });

    activities.forEach((a) => {
      const uid = a.userId;
      if (userMap.has(uid)) {
        const rep = userMap.get(uid)!;
        rep.activitiesLogged += 1;
        if (a.type === "CALL") rep.callsLogged += 1;
        if (a.type === "MEETING") rep.meetingsLogged += 1;
      }
    });

    const teamLeaderboard = Array.from(userMap.values()).sort(
      (a, b) => b.revenueWon - a.revenueWon || b.pipelineValue - a.pipelineValue
    );

    const summary: ReportSummary = {
      totalRevenueWon,
      totalPipeline,
      weightedForecast: Math.round(weightedForecast),
      winRate,
      totalLeads,
      qualifiedLeads,
      conversionRate,
      avgDealSize,
      totalDeals: opportunities.length,
      wonDealsCount: wonDeals.length,
      lostDealsCount: lostDeals.length,
    };

    return {
      success: true,
      data: {
        summary,
        funnel,
        sources,
        lossReasons,
        teamLeaderboard,
        dateRange,
      },
    };
  } catch {
    // In-memory Fallback
    const opps = mockOpportunitiesStore.filter((o) => {
      if (dateRange === "all") return true;
      return new Date(o.createdAt) >= cutoff;
    });

    const leads = mockLeadsStore.filter((l) => {
      if (dateRange === "all") return true;
      return new Date(l.createdAt) >= cutoff;
    });

    const acts = mockActivitiesStore.filter((a) => {
      if (dateRange === "all") return true;
      return new Date(a.activityAt) >= cutoff;
    });

    const wonDeals = opps.filter((o) => o.status === "WON");
    const lostDeals = opps.filter((o) => o.status === "LOST");
    const openDeals = opps.filter((o) => o.status === "OPEN");

    const totalRevenueWon = wonDeals.reduce((sum, o) => sum + o.amount, 0);
    const totalPipeline = openDeals.reduce((sum, o) => sum + o.amount, 0);
    const weightedForecast = openDeals.reduce(
      (sum, o) => sum + (o.amount * (o.probability || 10)) / 100,
      0
    );

    const closedDeals = wonDeals.length + lostDeals.length;
    const winRate = closedDeals > 0 ? Math.round((wonDeals.length / closedDeals) * 100) : 0;

    const totalLeads = leads.length;
    const qualifiedLeads = leads.filter(
      (l) => l.status === "Qualified" || l.status === "Converted"
    ).length;
    const conversionRate = totalLeads > 0 ? Math.round((qualifiedLeads / totalLeads) * 100) : 0;
    const avgDealSize = wonDeals.length > 0 ? Math.round(totalRevenueWon / wonDeals.length) : 0;

    const funnel: FunnelStageMetric[] = PIPELINE_STAGES.map((stage) => {
      const stageDeals = opps.filter((o) => o.stageName.toLowerCase() === stage.name.toLowerCase());
      return {
        stageId: stage.id,
        stageName: stage.name,
        order: stage.order,
        count: stageDeals.length,
        totalValue: stageDeals.reduce((sum, o) => sum + o.amount, 0),
        color: stage.color,
        probability: stage.probability,
      };
    });

    // Lead Sources
    const sourceMap = new Map<string, { count: number; qualified: number; value: number }>();
    leads.forEach((l) => {
      const src = l.source || "Other";
      const existing = sourceMap.get(src) || { count: 0, qualified: 0, value: 0 };
      existing.count += 1;
      if (l.status === "Qualified" || l.status === "Converted") existing.qualified += 1;
      existing.value += l.estimatedValue || 0;
      sourceMap.set(src, existing);
    });

    const sources: SourceRoiMetric[] = Array.from(sourceMap.entries()).map(([source, stats]) => ({
      source,
      leadsCount: stats.count,
      qualifiedCount: stats.qualified,
      conversionRate: stats.count > 0 ? Math.round((stats.qualified / stats.count) * 100) : 0,
      totalValue: stats.value,
    }));

    // Loss reasons
    const lossMap = new Map<string, { count: number; value: number }>();
    lostDeals.forEach((o) => {
      const reason = o.lossReason || "Unspecified";
      const existing = lossMap.get(reason) || { count: 0, value: 0 };
      existing.count += 1;
      existing.value += o.amount;
      lossMap.set(reason, existing);
    });

    const totalLost = lostDeals.length;
    const lossReasons: LossReasonMetric[] = Array.from(lossMap.entries()).map(([reason, stats]) => ({
      reason,
      count: stats.count,
      totalLostValue: stats.value,
      percentage: totalLost > 0 ? Math.round((stats.count / totalLost) * 100) : 0,
    }));

    // Team Leaderboard
    const userMap = new Map<string, RepProductivityMetric>();
    opps.forEach((o) => {
      const uid = o.ownerId;
      const uname = o.ownerName;

      if (!userMap.has(uid)) {
        userMap.set(uid, {
          userId: uid,
          userName: uname,
          role: "SALES_USER",
          dealsWon: 0,
          revenueWon: 0,
          activeDeals: 0,
          pipelineValue: 0,
          activitiesLogged: 0,
          callsLogged: 0,
          meetingsLogged: 0,
        });
      }

      const rep = userMap.get(uid)!;
      if (o.status === "WON") {
        rep.dealsWon += 1;
        rep.revenueWon += o.amount;
      } else if (o.status === "OPEN") {
        rep.activeDeals += 1;
        rep.pipelineValue += o.amount;
      }
    });

    acts.forEach((a) => {
      const uid = a.userId;
      if (userMap.has(uid)) {
        const rep = userMap.get(uid)!;
        rep.activitiesLogged += 1;
        if (a.type === "CALL") rep.callsLogged += 1;
        if (a.type === "MEETING") rep.meetingsLogged += 1;
      }
    });

    const teamLeaderboard = Array.from(userMap.values()).sort(
      (a, b) => b.revenueWon - a.revenueWon || b.pipelineValue - a.pipelineValue
    );

    const summary: ReportSummary = {
      totalRevenueWon,
      totalPipeline,
      weightedForecast: Math.round(weightedForecast),
      winRate,
      totalLeads,
      qualifiedLeads,
      conversionRate,
      avgDealSize,
      totalDeals: opps.length,
      wonDealsCount: wonDeals.length,
      lostDealsCount: lostDeals.length,
    };

    return {
      success: true,
      data: {
        summary,
        funnel,
        sources,
        lossReasons,
        teamLeaderboard,
        dateRange,
      },
    };
  }
}

function lostDealsCount(deals: any[]): number {
  return deals.length;
}

/**
 * Generate CSV export of analytics and reporting data
 */
export async function exportReportCsvAction(
  type: "pipeline" | "leads" | "leaderboard" | "sources" = "pipeline"
): Promise<{ success: boolean; csv?: string; filename?: string; error?: string }> {
  await requireAuth();
  const dateStr = new Date().toISOString().split("T")[0];

  try {
    const res = await getReportsAnalyticsAction("all");
    if (!res.success || !res.data) {
      return { success: false, error: "Failed to generate report" };
    }

    const { summary, funnel, sources, teamLeaderboard } = res.data;
    let csv = "";
    let filename = "";

    if (type === "pipeline") {
      filename = `sales_pipeline_report_${dateStr}.csv`;
      csv = "Stage,Order,Probability,Deal Count,Total Value (USD)\n";
      funnel.forEach((f) => {
        csv += `"${f.stageName}",${f.order},${f.probability}%,${f.count},${f.totalValue}\n`;
      });
      csv += `\n"Total Open Pipeline",,,,"${summary.totalPipeline}"\n`;
      csv += `"Weighted Revenue Forecast",,,,"${summary.weightedForecast}"\n`;
      csv += `"Closed Won Revenue",,,,"${summary.totalRevenueWon}"\n`;
    } else if (type === "sources") {
      filename = `lead_sources_report_${dateStr}.csv`;
      csv = "Lead Source,Total Leads,Qualified Leads,Conversion Rate,Estimated Pipeline Value (USD)\n";
      sources.forEach((s) => {
        csv += `"${s.source}",${s.leadsCount},${s.qualifiedCount},${s.conversionRate}%,${s.totalValue}\n`;
      });
    } else if (type === "leaderboard") {
      filename = `team_productivity_report_${dateStr}.csv`;
      csv = "Sales Rep,Role,Deals Won,Won Revenue (USD),Active Deals,Open Pipeline (USD),Total Activities,Calls,Meetings\n";
      teamLeaderboard.forEach((r) => {
        csv += `"${r.userName}","${r.role}",${r.dealsWon},${r.revenueWon},${r.activeDeals},${r.pipelineValue},${r.activitiesLogged},${r.callsLogged},${r.meetingsLogged}\n`;
      });
    } else {
      filename = `sales_summary_report_${dateStr}.csv`;
      csv = "Metric,Value\n";
      csv += `"Total Leads",${summary.totalLeads}\n`;
      csv += `"Qualified Leads",${summary.qualifiedLeads}\n`;
      csv += `"Lead Qualification Rate",${summary.conversionRate}%\n`;
      csv += `"Total Open Pipeline Value (USD)",${summary.totalPipeline}\n`;
      csv += `"Weighted Revenue Forecast (USD)",${summary.weightedForecast}\n`;
      csv += `"Closed Won Revenue (USD)",${summary.totalRevenueWon}\n`;
      csv += `"Overall Win Rate",${summary.winRate}%\n`;
      csv += `"Average Deal Size (USD)",${summary.avgDealSize}\n`;
    }

    return { success: true, csv, filename };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to export report" };
  }
}

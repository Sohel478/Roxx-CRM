import { z } from "zod";

export const DATE_RANGE_OPTIONS = ["7d", "30d", "mtd", "qtd", "ytd", "all"] as const;
export const dateRangeSchema = z.enum(DATE_RANGE_OPTIONS);
export type DateRangeOption = (typeof DATE_RANGE_OPTIONS)[number];

export interface ReportSummary {
  totalRevenueWon: number;
  totalPipeline: number;
  weightedForecast: number;
  winRate: number;
  totalLeads: number;
  qualifiedLeads: number;
  conversionRate: number;
  avgDealSize: number;
  totalDeals: number;
  wonDealsCount: number;
  lostDealsCount: number;
}

export interface FunnelStageMetric {
  stageId: string;
  stageName: string;
  order: number;
  count: number;
  totalValue: number;
  color: string;
  probability: number;
}

export interface SourceRoiMetric {
  source: string;
  leadsCount: number;
  qualifiedCount: number;
  conversionRate: number;
  totalValue: number;
}

export interface LossReasonMetric {
  reason: string;
  count: number;
  totalLostValue: number;
  percentage: number;
}

export interface RepProductivityMetric {
  userId: string;
  userName: string;
  role: string;
  dealsWon: number;
  revenueWon: number;
  activeDeals: number;
  pipelineValue: number;
  activitiesLogged: number;
  callsLogged: number;
  meetingsLogged: number;
}

export interface ReportsAnalyticsData {
  summary: ReportSummary;
  funnel: FunnelStageMetric[];
  sources: SourceRoiMetric[];
  lossReasons: LossReasonMetric[];
  teamLeaderboard: RepProductivityMetric[];
  dateRange: DateRangeOption;
}

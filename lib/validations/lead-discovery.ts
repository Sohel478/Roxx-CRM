import { z } from "zod";

export const evidenceStatusSchema = z
  .enum([
    "Verified Fact",
    "Reasonable Hypothesis",
    "Needs Client Confirmation",
    "Unverified",
  ])
  .default("Reasonable Hypothesis");

export type EvidenceStatus = z.infer<typeof evidenceStatusSchema>;

export const confidenceLevelSchema = z
  .enum(["High", "Medium", "Low"])
  .default("Medium");

export type ConfidenceLevel = z.infer<typeof confidenceLevelSchema>;

export const researchSourceSchema = z.object({
  title: z.string(),
  url: z.string(),
  dateAccessed: z.string(),
  excerpt: z.string().optional().nullable(),
  evidenceStatus: z.string().optional().nullable(),
});

export type ResearchSource = z.infer<typeof researchSourceSchema>;

export const qualificationRubricSchema = z.object({
  totalScore: z.number().min(0).max(100).default(50),
  category: z
    .enum([
      "High Priority",
      "Medium Priority",
      "Low Priority",
      "Insufficient Information",
    ])
    .default("Medium Priority"),
  dimensionScores: z
    .object({
      fitWithServices: z.number().min(0).max(25).default(15),
      evidenceOfNeed: z.number().min(0).max(20).default(10),
      buyingIntent: z.number().min(0).max(20).default(5),
      decisionMakerAccess: z.number().min(0).max(10).default(5),
      timelineClarity: z.number().min(0).max(10).default(5),
      budgetClarity: z.number().min(0).max(10).default(5),
      researchReliability: z.number().min(0).max(5).default(3),
    })
    .default({
      fitWithServices: 15,
      evidenceOfNeed: 10,
      buyingIntent: 5,
      decisionMakerAccess: 5,
      timelineClarity: 5,
      budgetClarity: 5,
      researchReliability: 3,
    }),
  buyingIntentStatus: z.string().default("Unknown"),
  requirementStatus: z.string().default("Unknown"),
  budgetStatus: z.string().default("Unknown"),
  timelineStatus: z.string().default("Unknown"),
  decisionMakerStatus: z.string().default("Unknown"),
  rationale: z.array(z.string()).default([]),
  recommendedNextAction: z
    .string()
    .default(
      "Schedule initial discovery call to validate operations and requirements"
    ),
});

export type QualificationRubric = z.infer<typeof qualificationRubricSchema>;

export const fitAssessmentSchema = z.object({
  fitLevel: z.enum(["EXCELLENT", "GOOD", "POOR"]).default("GOOD"),
  fitScore: z.number().min(0).max(100).default(75),
  isWorthTime: z.boolean().default(true),
  timeInvestmentGuidance: z
    .string()
    .default("WORTH SPENDING TIME (Standard Priority)"),
  fitReasons: z.array(z.string()).default([]),
  exclusionAlert: z.string().optional().nullable(),
});

export type FitAssessment = z.infer<typeof fitAssessmentSchema>;

export const companyOverviewDetailsSchema = z.object({
  companyName: z.string().optional().nullable(),
  industry: z.string().optional().nullable(),
  location: z.string().optional().nullable(),
  businessHistory: z.string().optional().nullable(),
  businessModel: z.string().optional().nullable(),
  digitalOperationsSummary: z.string().optional().nullable(),
  mainProductsOrServices: z.array(z.string()).optional().nullable(),
  targetCustomerSegments: z.array(z.string()).optional().nullable(),
  geographicMarkets: z.string().optional().nullable(),
  researchConfidence: confidenceLevelSchema.optional().nullable(),
  evidenceStatus: evidenceStatusSchema.optional().nullable(),
});

export type CompanyOverviewDetails = z.infer<
  typeof companyOverviewDetailsSchema
>;

export const discoveryOpportunitySchema = z.object({
  title: z.string(),
  observationOrHypothesis: z.string(),
  supportingEvidence: z.array(z.string()).default([]),
  potentialBusinessImpact: z.string(),
  evidenceStatus: evidenceStatusSchema,
  confidence: confidenceLevelSchema,
  clientValidationQuestion: z.string(),
  recommendedSolution: z.string(),
  techfluxServiceFit: z.string(),
  priority: z.enum(["High", "Medium", "Low"]).default("Medium"),
});

export type DiscoveryOpportunity = z.infer<typeof discoveryOpportunitySchema>;

export const strategicRecommendationDetailsSchema = z.object({
  primaryService: z.string(),
  whyRelevant: z.string(),
  expectedBenefit: z.string(),
  supportingEvidence: z.array(z.string()).default([]),
  whatMustBeConfirmed: z.array(z.string()).default([]),
  alternatives: z.array(z.string()).default([]),
  techfluxServiceFit: z.string(),
  assumptions: z.array(z.string()).default([]),
});

export type StrategicRecommendationDetails = z.infer<
  typeof strategicRecommendationDetailsSchema
>;

export const discoveryQuestionsDetailsSchema = z.object({
  priorityQuestions: z.array(z.string()).default([]),
  followUpQuestions: z.array(z.string()).default([]),
});

export type DiscoveryQuestionsDetails = z.infer<
  typeof discoveryQuestionsDetailsSchema
>;

export const openingHookDetailsSchema = z.object({
  text: z.string(),
  channel: z.enum(["phone", "email", "both"]).default("both"),
  evidenceBasis: z.array(z.string()).default([]),
  avoidedAntipatterns: z.array(z.string()).default([]),
});

export type OpeningHookDetails = z.infer<typeof openingHookDetailsSchema>;

export const projectEstimateDetailsSchema = z.object({
  status: z
    .enum(["Not enough information", "Preliminary estimate"])
    .default("Not enough information"),
  reason: z
    .string()
    .default("Requirements and implementation scope have not been confirmed"),
  effortRange: z.string().optional().nullable(),
  valueRange: z.string().optional().nullable(),
  currency: z.string().optional().nullable(),
  scopeAssumptions: z.array(z.string()).default([]),
  confidence: confidenceLevelSchema.default("Low"),
});

export type ProjectEstimateDetails = z.infer<
  typeof projectEstimateDetailsSchema
>;

export const researchMetadataSchema = z.object({
  researchedAt: z.string(),
  sources: z.array(researchSourceSchema).default([]),
  limitations: z.array(z.string()).default([]),
  promptVersion: z.string().default("lead-discovery-v2"),
});

export type ResearchMetadata = z.infer<typeof researchMetadataSchema>;

export const outreachEmailDraftSchema = z.object({
  subject: z.string(),
  body: z.string(),
  purpose: z.string().default("Introductory Discovery & Quick Meeting Request"),
  suggestedMeetingCta: z
    .string()
    .default("10-15 minute introductory conversation"),
});

export type OutreachEmailDraft = z.infer<typeof outreachEmailDraftSchema>;

export const leadDiscoverySchema = z.object({
  leadId: z.string(),
  clientBusiness: z.string().min(1, "Client business is required"),
  businessSummary: z.string().min(1, "Business summary is required"),
  companyOverviewDetails: companyOverviewDetailsSchema.optional().nullable(),
  currentNeeds: z
    .array(z.string())
    .min(1, "At least one discovery need is required"),
  recommendations: z
    .array(z.string())
    .min(1, "At least one recommendation is required"),
  targetOffering: z.string().min(1, "Target offering is required"),
  talkingPoints: z.array(z.string()).default([]),
  openingPitchHook: z.string().default(""),
  fitAssessment: fitAssessmentSchema.optional().nullable(),
  estimatedBudgetFit: z.string().optional().nullable(),

  // Enhanced evidence-backed structures
  qualificationSummary: qualificationRubricSchema.optional().nullable(),
  discoveryOpportunities: z
    .array(discoveryOpportunitySchema)
    .optional()
    .nullable(),
  strategicRecommendation: strategicRecommendationDetailsSchema
    .optional()
    .nullable(),
  discoveryQuestions: discoveryQuestionsDetailsSchema.optional().nullable(),
  openingHookDetails: openingHookDetailsSchema.optional().nullable(),
  projectEstimate: projectEstimateDetailsSchema.optional().nullable(),
  researchMetadata: researchMetadataSchema.optional().nullable(),
  outreachEmailDraft: outreachEmailDraftSchema.optional().nullable(),

  provider: z.enum(["builtin", "openai", "gemini"]).default("builtin"),
  modelUsed: z.string().default("neural-heuristic"),
  analyzedAt: z.string(),
});

export type LeadDiscoveryData = z.infer<typeof leadDiscoverySchema>;

export interface LeadDiscoveryInputContext {
  id: string;
  fullName: string;
  firstName: string;
  lastName?: string | null;
  companyName?: string | null;
  jobTitle?: string | null;
  email?: string | null;
  phone?: string | null;
  website?: string | null;
  source?: string | null;
  sourceDetail?: string | null;
  status?: string | null;
  rating?: string | null;
  description?: string | null;
  customerLinkedin?: string | null;
  companyLinkedin?: string | null;
  estimatedValue?: number | null;
  pastActivitiesSummary?: string | null;
}

export interface LeadResearchSources {
  website: string | null;
  customerLinkedin: string | null;
  companyLinkedin: string | null;
  hasAnySource: boolean;
  primarySourceUrl: string | null;
}

/**
 * Extracts and normalizes prospect research source URLs:
 * 1. Company Website URL
 * 2. Personal LinkedIn Profile URL
 * 3. Company LinkedIn URL
 *
 * Scans explicit lead fields as well as formatted discovery notes in description.
 */
export function extractLeadResearchSources(lead?: {
  website?: string | null;
  customerLinkedin?: string | null;
  companyLinkedin?: string | null;
  description?: string | null;
}): LeadResearchSources {
  const desc = lead?.description || "";

  const cleanUrl = (u?: string | null): string | null => {
    if (!u || typeof u !== "string") return null;
    const trimmed = u.trim();
    if (!trimmed || trimmed === "null" || trimmed === "undefined") return null;
    return trimmed;
  };

  // 1. Website: explicit field, or description note "Website: ...", or generic non-linkedin URL
  const websiteExplicit = cleanUrl(lead?.website);
  const websiteFromDesc = cleanUrl(
    desc.match(/(?:Website|Site|URL):\s*([^\s\n\r]+)/i)?.[1] ||
    desc.match(/https?:\/\/(?!www\.linkedin\.com|linkedin\.com)[^\s\n\r]+/i)?.[0]
  );
  let website = websiteExplicit || websiteFromDesc || null;
  if (website && !website.startsWith("http://") && !website.startsWith("https://")) {
    website = `https://${website}`;
  }

  // 2. Personal LinkedIn: explicit field, or description note "LinkedIn Profile: ...", or linkedin.com/in/...
  const personalLinkedinExplicit = cleanUrl(lead?.customerLinkedin);
  const personalLinkedinFromDesc = cleanUrl(
    desc.match(/(?:LinkedIn Profile|Personal LinkedIn|Customer LinkedIn):\s*([^\s\n\r]+)/i)?.[1] ||
    desc.match(/https?:\/\/(?:www\.)?linkedin\.com\/(?:in|search)\/[^\s\n\r]+/i)?.[0]
  );
  let customerLinkedin = personalLinkedinExplicit || personalLinkedinFromDesc || null;
  if (customerLinkedin && !customerLinkedin.startsWith("http://") && !customerLinkedin.startsWith("https://")) {
    customerLinkedin = `https://${customerLinkedin}`;
  }

  // 3. Company LinkedIn: explicit field, or description note "Company LinkedIn: ...", or linkedin.com/company/...
  const companyLinkedinExplicit = cleanUrl(lead?.companyLinkedin);
  const companyLinkedinFromDesc = cleanUrl(
    desc.match(/Company LinkedIn:\s*([^\s\n\r]+)/i)?.[1] ||
    desc.match(/https?:\/\/(?:www\.)?linkedin\.com\/company\/[^\s\n\r]+/i)?.[0]
  );
  let companyLinkedin = companyLinkedinExplicit || companyLinkedinFromDesc || null;
  if (companyLinkedin && !companyLinkedin.startsWith("http://") && !companyLinkedin.startsWith("https://")) {
    companyLinkedin = `https://${companyLinkedin}`;
  }

  const hasAnySource = Boolean(website || customerLinkedin || companyLinkedin);

  return {
    website,
    customerLinkedin,
    companyLinkedin,
    hasAnySource,
    primarySourceUrl: website || companyLinkedin || customerLinkedin || null,
  };
}

import { z } from "zod";

export const createMarketingBatchSchema = z.object({
  name: z
    .string()
    .min(1, "Batch name is required")
    .max(100, "Batch name cannot exceed 100 characters"),
  description: z.string().max(500).optional().nullable(),
  leadIds: z
    .array(z.string())
    .min(1, "At least one lead must be selected for the batch"),
});

export type CreateMarketingBatchInput = z.infer<typeof createMarketingBatchSchema>;

export const updateMarketingBatchSchema = z.object({
  id: z.string().min(1, "Batch ID is required"),
  name: z
    .string()
    .min(1, "Batch name is required")
    .max(100, "Batch name cannot exceed 100 characters"),
  description: z.string().max(500).optional().nullable(),
  leadIds: z.array(z.string()).optional(),
});

export type UpdateMarketingBatchInput = z.infer<typeof updateMarketingBatchSchema>;

export const sendBatchEmailSchema = z.object({
  batchId: z.string().min(1, "Batch ID is required"),
  subject: z.string().min(1, "Subject line is required"),
  body: z.string().min(1, "Email body message is required"),
  senderName: z.string().optional(),
  replyTo: z.string().email("Invalid reply-to email").optional().nullable(),
});

export type SendBatchEmailInput = z.infer<typeof sendBatchEmailSchema>;

export interface RecipientLogItem {
  leadId: string;
  leadName: string;
  email: string;
  companyName?: string | null;
  status: "SENT" | "FAILED" | "SKIPPED";
  error?: string | null;
  sentAt?: string | null;
}

export interface MarketingCampaignItem {
  id: string;
  batchId: string;
  organizationId: string;
  senderId: string;
  senderName: string;
  senderEmail?: string | null;
  subject: string;
  body: string;
  status: "DRAFT" | "SENDING" | "SENT" | "FAILED";
  totalRecipients: number;
  sentCount: number;
  failedCount: number;
  recipientLogs: RecipientLogItem[];
  sentAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface MarketingBatchItem {
  id: string;
  organizationId: string;
  name: string;
  description?: string | null;
  ownerId: string;
  ownerName?: string | null;
  leadIds: string[];
  leadCount: number;
  createdAt: string;
  updatedAt: string;
  lastCampaign?: {
    id: string;
    subject: string;
    sentAt: string | null;
    status: string;
    sentCount: number;
    failedCount: number;
    totalRecipients: number;
  } | null;
}

export interface MarketingBatchDetail extends MarketingBatchItem {
  leads: {
    id: string;
    leadNumber: string;
    firstName: string;
    lastName: string | null;
    fullName: string;
    email: string | null;
    companyName: string | null;
    jobTitle: string | null;
    status: string;
    rating: string;
    phone: string | null;
  }[];
  campaigns: MarketingCampaignItem[];
}

export const aiStudyBatchSchema = z.object({
  batchId: z.string().min(1, "Batch ID is required"),
  objective: z
    .enum([
      "INITIAL_OUTREACH",
      "MEETING_INVITE",
      "FOLLOW_UP",
      "RE_ENGAGEMENT",
      "VALUE_CASE_STUDY",
    ])
    .default("INITIAL_OUTREACH"),
  tone: z
    .enum(["PROFESSIONAL", "WARM", "EXECUTIVE", "CONSULTATIVE"])
    .default("PROFESSIONAL"),
  valueProposition: z.string().max(1000).optional(),
  customInstruction: z.string().max(1000).optional(),
  enableFollowUp: z.boolean().default(true),
  followUpDays: z.number().int().min(1).max(30).default(3),
});

export type AiStudyBatchInput = z.infer<typeof aiStudyBatchSchema>;

export const aiScheduleLeadItemSchema = z.object({
  leadId: z.string().min(1),
  leadName: z.string(),
  leadEmail: z.string().email(),
  companyName: z.string(),
  jobTitle: z.string().optional().nullable(),
  initialSubject: z.string().min(1, "Subject is required"),
  initialBody: z.string().min(1, "Email body is required"),
  followUpSubject: z.string().optional().nullable(),
  followUpBody: z.string().optional().nullable(),
});

export const aiScheduleBatchSchema = z.object({
  batchId: z.string().min(1, "Batch ID is required"),
  campaignName: z.string().min(1, "Campaign name is required").max(100),
  objective: z.string(),
  tone: z.string(),
  startDate: z.string(), // ISO string or 'now'
  pacingMinutes: z.number().int().min(1).max(60).default(2),
  enableFollowUp: z.boolean().default(true),
  followUpDays: z.number().int().min(1).max(30).default(3),
  leads: z.array(aiScheduleLeadItemSchema).min(1, "At least one lead is required"),
});

export type AiScheduleBatchInput = z.infer<typeof aiScheduleBatchSchema>;

export const aiLeadEmailGenerateSchema = z.object({
  leadId: z.string().min(1, "Lead ID is required"),
  objective: z
    .enum([
      "INITIAL_OUTREACH",
      "MEETING_INVITE",
      "FOLLOW_UP",
      "RE_ENGAGEMENT",
      "VALUE_CASE_STUDY",
    ])
    .default("INITIAL_OUTREACH"),
  tone: z
    .enum(["PROFESSIONAL", "WARM", "EXECUTIVE", "CONSULTATIVE"])
    .default("PROFESSIONAL"),
  customInstruction: z.string().max(1000).optional(),
  valueProposition: z.string().max(1000).optional(),
});

export type AiLeadEmailGenerateInput = z.infer<typeof aiLeadEmailGenerateSchema>;

export const companyCaseStudySchema = z.object({
  id: z.string().optional(),
  title: z.string().min(1, "Title is required"),
  metric: z.string().optional().nullable(),
  summary: z.string().min(1, "Summary is required"),
  industry: z.string().optional().nullable(),
});

export type CompanyCaseStudy = z.infer<typeof companyCaseStudySchema>;

export const companyMatrixSchema = z.object({
  websiteUrl: z.string().optional().nullable(),
  elevatorPitch: z.string().max(1000).optional().nullable(),
  coreSkillsets: z.array(z.string()).default([]),
  serviceOfferings: z.array(z.string()).default([]),
  targetIndustries: z.array(z.string()).default([]),
  caseStudies: z.array(companyCaseStudySchema).default([]),
  outOfScopeExclusions: z.array(z.string()).default([]),
});

export type CompanyMatrix = z.infer<typeof companyMatrixSchema>;

export const aiConfigSchema = z.object({
  aiProvider: z.enum(["builtin", "openai", "gemini"]).default("builtin"),
  apiKey: z.string().max(300).optional().nullable(),
  defaultCompanyPitch: z.string().max(1000).optional().nullable(),
  defaultFollowUpDays: z.number().int().min(1).max(30).default(3),
  defaultPacingMinutes: z.number().int().min(1).max(60).default(2),
  companyMatrix: companyMatrixSchema.optional().nullable(),
});

export type AiConfigInput = z.infer<typeof aiConfigSchema>;


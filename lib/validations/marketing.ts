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

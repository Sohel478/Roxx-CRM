import { z } from "zod";

export const leadDiscoverySchema = z.object({
  leadId: z.string(),
  clientBusiness: z.string().min(1, "Client business is required"),
  businessSummary: z.string().min(1, "Business summary is required"),
  currentNeeds: z.array(z.string()).min(1, "At least one discovery need is required"),
  recommendations: z.array(z.string()).min(1, "At least one recommendation is required"),
  targetOffering: z.string().min(1, "Target offering is required"),
  talkingPoints: z.array(z.string()).default([]),
  openingPitchHook: z.string().default(""),
  estimatedBudgetFit: z.string().optional().nullable(),
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

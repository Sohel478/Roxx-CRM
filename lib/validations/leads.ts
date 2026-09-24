import { z } from "zod";

export const leadSchema = z.object({
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().optional(),
  email: z.string().email("Must be a valid email").or(z.literal("")).optional(),
  phone: z.string().optional(),
  companyName: z.string().optional(),
  jobTitle: z.string().optional(),
  source: z.string().default("Website"),
  sourceDetail: z.string().optional(),
  status: z.enum(["New", "Contacted", "Qualified", "Unqualified", "Nurture", "Converted", "Lost"]).default("New"),
  rating: z.enum(["Hot", "Warm", "Cold"]).default("Warm"),
  estimatedValue: z.coerce.number().min(0, "Estimated value cannot be negative").default(0),
  currency: z.string().default("USD"),
  description: z.string().optional(),
});

export type LeadFormData = z.infer<typeof leadSchema>;

export interface LeadItem {
  id: string;
  leadNumber: string;
  firstName: string;
  lastName: string | null;
  fullName: string;
  email: string | null;
  phone: string | null;
  companyName: string | null;
  jobTitle: string | null;
  source: string;
  status: string;
  rating: string;
  estimatedValue: number;
  currency: string;
  description?: string | null;
  ownerName: string | null;
  createdAt: string;
  convertedAt?: string | null;
  convertedCompanyId?: string | null;
  convertedContactId?: string | null;
  convertedOpportunityId?: string | null;
  convertedInfo?: {
    companyId?: string | null;
    companyName?: string | null;
    contactId?: string | null;
    contactName?: string | null;
    opportunityId?: string | null;
    opportunityName?: string | null;
    opportunityAmount?: number | null;
  } | null;
}

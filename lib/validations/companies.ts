import { z } from "zod";

export const companySchema = z.object({
  name: z.string().min(2, "Company name must be at least 2 characters"),
  industry: z.string().optional(),
  website: z.string().url("Must be a valid URL (e.g. https://example.com)").or(z.literal("")).optional(),
  email: z.string().email("Must be a valid email").or(z.literal("")).optional(),
  phone: z.string().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  country: z.string().optional(),
  status: z.enum(["Active", "Prospect", "Customer", "Inactive"]).default("Active"),
  description: z.string().optional(),
});

export type CompanyFormData = z.infer<typeof companySchema>;

export interface CompanyItem {
  id: string;
  name: string;
  industry: string | null;
  website: string | null;
  email: string | null;
  phone: string | null;
  city: string | null;
  country: string | null;
  status: string;
  description?: string | null;
  createdAt: string;
  contactCount: number;
}

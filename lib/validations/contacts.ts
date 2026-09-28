import { z } from "zod";

export const contactSchema = z.object({
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().optional(),
  email: z.string().email("Must be a valid email").or(z.literal("")).optional(),
  phone: z.string().optional(),
  alternatePhone: z.string().optional(),
  jobTitle: z.string().optional(),
  department: z.string().optional(),
  linkedinUrl: z.string().optional(),
  instagramUrl: z.string().optional(),
  companyId: z.string().optional(),
  newCompanyName: z.string().optional(),
  newCompanyWebsite: z.string().optional(),
  address: z.string().optional(),
});

export type ContactFormData = z.infer<typeof contactSchema>;

export interface ContactItem {
  id: string;
  firstName: string;
  lastName: string | null;
  fullName: string;
  email: string | null;
  phone: string | null;
  alternatePhone?: string | null;
  jobTitle: string | null;
  department: string | null;
  linkedinUrl?: string | null;
  instagramUrl?: string | null;
  companyId: string | null;
  companyName: string | null;
  address?: string | null;
  createdAt: string;
}

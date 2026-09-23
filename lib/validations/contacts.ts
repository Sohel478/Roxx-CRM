import { z } from "zod";

export const contactSchema = z.object({
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().optional(),
  email: z.string().email("Must be a valid email").or(z.literal("")).optional(),
  phone: z.string().optional(),
  alternatePhone: z.string().optional(),
  jobTitle: z.string().optional(),
  department: z.string().optional(),
  linkedinUrl: z.string().url("Must be a valid URL").or(z.literal("")).optional(),
  companyId: z.string().optional(),
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
  jobTitle: string | null;
  department: string | null;
  companyId: string | null;
  companyName: string | null;
  createdAt: string;
}

import { z } from "zod";

export const IMPORT_ENTITIES = ["leads", "companies", "contacts"] as const;
export type ImportEntityType = (typeof IMPORT_ENTITIES)[number];

export interface RowImportError {
  rowNumber: number;
  field?: string;
  message: string;
}

export interface ImportResult {
  entityType: ImportEntityType;
  totalRows: number;
  importedCount: number;
  failedCount: number;
  errors: RowImportError[];
}

export const leadImportRowSchema = z.object({
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().optional().nullable(),
  email: z.string().email("Invalid email").optional().nullable().or(z.literal("")),
  phone: z.string().optional().nullable(),
  companyName: z.string().optional().nullable(),
  jobTitle: z.string().optional().nullable(),
  source: z.string().optional().default("Website"),
  estimatedValue: z.coerce.number().min(0).optional().default(0),
  rating: z.enum(["Hot", "Warm", "Cold"]).optional().default("Warm"),
  description: z.string().optional().nullable(),
});

export const companyImportRowSchema = z.object({
  name: z.string().min(2, "Company name must be at least 2 characters"),
  industry: z.string().optional().nullable(),
  website: z.string().optional().nullable(),
  email: z.string().email("Invalid email").optional().nullable().or(z.literal("")),
  phone: z.string().optional().nullable(),
  city: z.string().optional().nullable(),
  country: z.string().optional().nullable(),
  status: z.enum(["Lead", "Prospect", "Customer", "Churned"]).optional().default("Prospect"),
  description: z.string().optional().nullable(),
});

export const contactImportRowSchema = z.object({
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().optional().nullable(),
  email: z.string().email("Invalid email").optional().nullable().or(z.literal("")),
  phone: z.string().optional().nullable(),
  jobTitle: z.string().optional().nullable(),
  department: z.string().optional().nullable(),
  companyName: z.string().optional().nullable(),
});

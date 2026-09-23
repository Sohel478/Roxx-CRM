import { z } from "zod";

export const conversionSchema = z
  .object({
    companyMode: z.enum(["NEW", "EXISTING"]).default("NEW"),
    companyName: z.string().optional(),
    companyId: z.string().optional(),
    contactFirstName: z.string().min(1, "Contact first name is required"),
    contactLastName: z.string().optional(),
    contactEmail: z.string().email("Must be a valid email").or(z.literal("")).optional(),
    contactPhone: z.string().optional(),
    contactJobTitle: z.string().optional(),
    createOpportunity: z.boolean().default(true),
    opportunityName: z.string().optional(),
    opportunityAmount: z.coerce.number().min(0, "Amount cannot be negative").default(0),
    opportunityStage: z.string().default("Qualified"),
    expectedCloseDate: z.string().optional(),
  })
  .refine(
    (data) => {
      if (data.companyMode === "NEW") {
        return Boolean(data.companyName && data.companyName.trim().length >= 2);
      }
      return Boolean(data.companyId && data.companyId.trim().length > 0);
    },
    {
      message: "Company name must be at least 2 characters",
      path: ["companyName"],
    }
  )
  .refine(
    (data) => {
      if (data.createOpportunity) {
        return Boolean(data.opportunityName && data.opportunityName.trim().length >= 2);
      }
      return true;
    },
    {
      message: "Deal name must be at least 2 characters",
      path: ["opportunityName"],
    }
  );

export type ConversionFormData = z.infer<typeof conversionSchema>;

export interface ConversionResult {
  leadId: string;
  companyId: string;
  companyName: string;
  contactId: string;
  contactName: string;
  opportunityId?: string | null;
  opportunityName?: string | null;
  opportunityAmount?: number | null;
}

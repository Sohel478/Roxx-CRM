import { z } from "zod";

export const resetCrmEntitySchema = z.enum(["leads", "companies", "contacts", "all"]);
export type CrmResetEntity = z.infer<typeof resetCrmEntitySchema>;

export const resetCrmDataSchema = z.object({
  entity: resetCrmEntitySchema,
  confirmationText: z
    .string()
    .trim()
    .refine((val) => val.toUpperCase() === "RESET", {
      message: "Please type RESET to confirm data deletion.",
    }),
});

export type ResetCrmDataInput = z.infer<typeof resetCrmDataSchema>;

export interface CrmDataCounts {
  leadsCount: number;
  companiesCount: number;
  contactsCount: number;
  opportunitiesCount: number;
}

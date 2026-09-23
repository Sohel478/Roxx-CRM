import { z } from "zod";

export const ACTIVITY_TYPES = [
  "CALL",
  "EMAIL",
  "MEETING",
  "WHATSAPP",
  "NOTE",
  "OTHER",
] as const;

export type ActivityType = (typeof ACTIVITY_TYPES)[number];

export const activitySchema = z.object({
  type: z.enum(ACTIVITY_TYPES, {
    errorMap: () => ({ message: "Please select a valid activity type" }),
  }),
  subject: z
    .string()
    .min(2, "Subject must be at least 2 characters")
    .max(255, "Subject cannot exceed 255 characters"),
  description: z.string().optional().nullable(),
  leadId: z.string().optional().nullable(),
  leadName: z.string().optional().nullable(),
  companyId: z.string().optional().nullable(),
  companyName: z.string().optional().nullable(),
  contactId: z.string().optional().nullable(),
  contactName: z.string().optional().nullable(),
  opportunityId: z.string().optional().nullable(),
  opportunityName: z.string().optional().nullable(),
  activityAt: z
    .string()
    .optional()
    .default(() => new Date().toISOString()),
  durationMinutes: z
    .coerce
    .number()
    .min(0, "Duration cannot be negative")
    .max(1440, "Duration cannot exceed 24 hours (1440 mins)")
    .optional()
    .nullable(),
  outcome: z.string().optional().nullable(),
});

export type ActivityFormData = z.infer<typeof activitySchema>;

export interface ActivityItem {
  id: string;
  organizationId: string;
  type: ActivityType;
  subject: string;
  description: string | null;
  leadId: string | null;
  leadName: string | null;
  companyId: string | null;
  companyName: string | null;
  contactId: string | null;
  contactName: string | null;
  opportunityId: string | null;
  opportunityName: string | null;
  userId: string;
  userName: string;
  activityAt: string;
  durationMinutes: number | null;
  outcome: string | null;
  createdAt: string;
}

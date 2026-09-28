import { z } from "zod";

export type NotificationType =
  | "LEAD_ASSIGNED"
  | "LEAD_CREATED"
  | "TASK_DUE"
  | "TASK_OVERDUE"
  | "TASK_CREATED"
  | "OPPORTUNITY_WON"
  | "OPPORTUNITY_STAGE_CHANGED"
  | "CONTACT_CREATED"
  | "COMPANY_CREATED"
  | "SUBSCRIPTION_UPDATE"
  | "SYSTEM";

export interface NotificationItem {
  id: string;
  organizationId: string;
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  entityType?: "lead" | "contact" | "company" | "opportunity" | "task" | "subscription" | "system" | string | null;
  entityId?: string | null;
  isRead: boolean;
  readAt?: string | null;
  createdAt: string;
}

export const notificationFilterSchema = z.object({
  unreadOnly: z.boolean().optional(),
  limit: z.number().min(1).max(100).optional().default(30),
});

export type NotificationFilterInput = z.infer<typeof notificationFilterSchema>;

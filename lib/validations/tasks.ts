import { z } from "zod";

export const TASK_PRIORITIES = ["LOW", "MEDIUM", "HIGH", "URGENT"] as const;
export type TaskPriority = (typeof TASK_PRIORITIES)[number];

export const TASK_STATUSES = ["PENDING", "IN_PROGRESS", "COMPLETED", "CANCELLED"] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];

export const taskSchema = z.object({
  title: z
    .string()
    .min(2, "Task title must be at least 2 characters")
    .max(255, "Task title cannot exceed 255 characters"),
  description: z.string().optional().nullable(),
  assignedToId: z.string().optional().nullable(),
  assignedToName: z.string().optional().nullable(),
  leadId: z.string().optional().nullable(),
  companyId: z.string().optional().nullable(),
  contactId: z.string().optional().nullable(),
  opportunityId: z.string().optional().nullable(),
  dueAt: z
    .string()
    .min(1, "Due date is required")
    .refine((val) => !isNaN(Date.parse(val)), {
      message: "Invalid due date format",
    }),
  priority: z.enum(TASK_PRIORITIES).default("MEDIUM"),
  status: z.enum(TASK_STATUSES).default("PENDING"),
});

export type TaskFormData = z.infer<typeof taskSchema>;

export interface TaskItem {
  id: string;
  organizationId: string;
  title: string;
  description: string | null;
  assignedToId: string;
  assignedToName: string;
  createdById: string;
  createdByName: string;
  leadId: string | null;
  leadName: string | null;
  companyId: string | null;
  companyName: string | null;
  contactId: string | null;
  contactName: string | null;
  opportunityId: string | null;
  opportunityName: string | null;
  dueAt: string;
  priority: TaskPriority;
  status: TaskStatus;
  completedAt: string | null;
  createdAt: string;
}

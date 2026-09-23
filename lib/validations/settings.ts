import { z } from "zod";

export const USER_ROLES = ["ADMIN", "MANAGER", "SALES_USER", "READ_ONLY"] as const;
export type UserRole = (typeof USER_ROLES)[number];

export const userCreateSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters").max(60, "Name cannot exceed 60 characters"),
  email: z.string().email("Valid email address is required"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  role: z.enum(USER_ROLES, {
    errorMap: () => ({ message: "Select a valid role (ADMIN, MANAGER, SALES_USER, READ_ONLY)" }),
  }),
});

export type UserCreateInput = z.infer<typeof userCreateSchema>;

export const userUpdateSchema = z.object({
  id: z.string().min(1, "User ID is required"),
  name: z.string().min(2, "Name must be at least 2 characters").max(60, "Name cannot exceed 60 characters"),
  role: z.enum(USER_ROLES, {
    errorMap: () => ({ message: "Select a valid role" }),
  }),
  isActive: z.boolean(),
});

export type UserUpdateInput = z.infer<typeof userUpdateSchema>;

export const organizationSettingsSchema = z.object({
  name: z.string().min(2, "Organization name must be at least 2 characters").max(100),
  timezone: z.string().min(1, "Timezone is required"),
  defaultCurrency: z.string().length(3, "Currency code must be 3 characters (e.g. USD)"),
  fiscalYearStart: z.string().min(1, "Fiscal year start month is required"),
  dateFormat: z.string().min(1, "Date format is required"),
});

export type OrganizationSettings = z.infer<typeof organizationSettingsSchema>;

export const pipelineStageSchema = z.object({
  id: z.string(),
  name: z.string().min(1, "Stage name is required"),
  order: z.number().int().min(1),
  probability: z.number().min(0).max(100),
  color: z.string(),
  isWon: z.boolean(),
  isLost: z.boolean(),
});

export type PipelineStageItem = z.infer<typeof pipelineStageSchema>;

export interface UserItem {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  isActive: boolean;
  avatarUrl: string | null;
  createdAt: string;
  lastLoginAt: string | null;
}

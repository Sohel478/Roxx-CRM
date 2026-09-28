import { z } from "zod";

export const smtpConfigSchema = z.object({
  host: z.string().min(1, "SMTP host is required"),
  port: z.coerce.number().int().min(1, "Port must be positive").max(65535, "Port out of range"),
  secure: z.boolean().default(false),
  username: z.string().min(1, "Username/Email is required"),
  password: z.string().optional(),
  fromName: z.string().min(1, "From Name is required"),
  fromEmail: z.string().email("Valid sender email is required"),
});

export type SmtpConfigInput = z.infer<typeof smtpConfigSchema>;

export interface SmtpConfigDisplay {
  host: string;
  port: number;
  secure: boolean;
  username: string;
  hasPassword: boolean;
  maskedPassword?: string;
  fromName: string;
  fromEmail: string;
  isConfigured: boolean;
  updatedAt?: string;
}

export const testSmtpSchema = z.object({
  recipientEmail: z.string().email("Valid recipient email is required for testing"),
  tempConfig: smtpConfigSchema.partial().optional(),
});

export type TestSmtpInput = z.infer<typeof testSmtpSchema>;

export const sendEmailSchema = z.object({
  to: z.string().email("Valid recipient email address is required"),
  subject: z.string().min(1, "Email subject is required"),
  body: z.string().min(1, "Email body is required"),
  entityType: z.enum(["lead", "opportunity", "company", "contact"]).default("lead"),
  entityId: z.string().optional(),
});

export type SendEmailInput = z.infer<typeof sendEmailSchema>;

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

export const imapConfigSchema = z.object({
  host: z.string().min(1, "IMAP host is required"),
  port: z.coerce.number().int().min(1, "Port must be positive").max(65535, "Port out of range").default(993),
  secure: z.boolean().default(true),
  username: z.string().min(1, "Username/Email is required"),
  password: z.string().optional(),
  useSmtpCredentials: z.boolean().default(false),
});

export type ImapConfigInput = z.infer<typeof imapConfigSchema>;

export interface ImapConfigDisplay {
  host: string;
  port: number;
  secure: boolean;
  username: string;
  hasPassword: boolean;
  maskedPassword?: string;
  isConfigured: boolean;
  updatedAt?: string;
  lastSyncedAt?: string;
}

export const testImapSchema = z.object({
  tempConfig: imapConfigSchema.partial().optional(),
});

export type TestImapInput = z.infer<typeof testImapSchema>;

export interface DnsDeliverabilityResult {
  domain: string;
  fromEmail: string;
  smtpUsername: string;
  alignmentStatus: "aligned" | "mismatched";
  alignmentDetails: string;
  spf: {
    status: "valid" | "warning" | "missing";
    record: string;
    instructions: string;
  };
  dkim: {
    status: "valid" | "warning" | "missing";
    selector: string;
    record: string;
    instructions: string;
  };
  dmarc: {
    status: "valid" | "warning" | "missing";
    record: string;
    instructions: string;
  };
  score: number;
  recommendations: string[];
}

export const inboxEmailSchema = z.object({
  id: z.string(),
  messageId: z.string(),
  fromEmail: z.string().email(),
  fromName: z.string(),
  toEmail: z.string().email(),
  subject: z.string(),
  snippet: z.string(),
  bodyText: z.string(),
  bodyHtml: z.string().optional(),
  date: z.string(),
  isRead: z.boolean().default(false),
  leadId: z.string().optional(),
  leadName: z.string().optional(),
  contactId: z.string().optional(),
  inReplyTo: z.string().optional(),
});

export type InboxEmailItem = z.infer<typeof inboxEmailSchema>;

export const replyEmailSchema = z.object({
  emailId: z.string().min(1, "Email ID is required"),
  to: z.string().email("Valid recipient email is required"),
  subject: z.string().min(1, "Subject is required"),
  body: z.string().min(1, "Message body is required"),
  leadId: z.string().optional(),
  inReplyTo: z.string().optional(),
});

export type ReplyEmailInput = z.infer<typeof replyEmailSchema>;
